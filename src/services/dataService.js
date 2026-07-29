import API_URL from '../config/api';
import { auth, authReady } from '../config/firebase';
import {
  computeMatchDeltas,
  isActive,
  MIN_LIFETIME_SCORE,
  STARTING_SCORE,
  DEFAULT_ACTIVITY_THRESHOLD,
} from './rating';

/**
 * Hard ceiling on stored match history, as a safety valve only.
 *
 * GAME_HISTORY_KEEP used to be applied to the *stored* array, so lowering a
 * setting the admin panel describes as "number of games to show" silently and
 * permanently destroyed matches (docs/AUDIT.md D-08). It is now a display limit
 * applied at render time, and this constant exists purely so a long-lived
 * account cannot grow the Firestore document past its 1 MB cap.
 */
export const MAX_STORED_HISTORY = 1000;

/** How long to wait for more changes before writing. */
const SAVE_DELAY = 1000;

/** Retry schedule for failed cloud saves, in milliseconds. */
const SAVE_RETRY_DELAYS = [500, 2000];

class Player {
  constructor(name, score = STARTING_SCORE, password = '') {
    this.name = name;
    this.score = score;
    this.gamesPlayed = 0;
    this.wins = 0;
    this.losses = 0;
    this.password = password;
    this.currentStreak = 0;
    this.maxWinStreak = 0;
    this.lifetimeGamesPlayed = 0;
    this.lifetimeWins = 0;
    this.lifetimeLosses = 0;
    this.lifetimeScore = score;
    this.active = false;
    this.scoreHistory = [score];
  }

  /**
   * Apply one match result to this player.
   *
   * `deltas` comes from computeMatchDeltas, which reads a snapshot of both
   * players taken before either was touched. This method must therefore never
   * look at the opponent — doing so is exactly what made the old implementation
   * order-dependent (docs/AUDIT.md L-02).
   */
  applyMatch({ score: scoreDelta, lifetimeScore: lifetimeDelta }, won, activityThreshold) {
    this.score += scoreDelta;
    this.lifetimeScore = Math.max(MIN_LIFETIME_SCORE, this.lifetimeScore + lifetimeDelta);

    this.gamesPlayed += 1;
    this.lifetimeGamesPlayed += 1;

    if (!Array.isArray(this.scoreHistory)) this.scoreHistory = [];
    this.scoreHistory.push(Math.round(this.lifetimeScore * 100) / 100);

    this.active = isActive(this.gamesPlayed, activityThreshold);

    if (won) {
      this.wins += 1;
      this.lifetimeWins += 1;
      this.currentStreak += 1;
      if (this.currentStreak > this.maxWinStreak) this.maxWinStreak = this.currentStreak;
    } else {
      this.losses += 1;
      this.lifetimeLosses += 1;
      this.currentStreak = 0;
    }

    return scoreDelta;
  }

  /** A plain, immutable view of the fields the rating maths needs. */
  snapshot() {
    return { score: this.score, lifetimeScore: this.lifetimeScore, active: this.active };
  }

  winLossRatio() {
    return this.gamesPlayed === 0 ? '0/0' : `${this.wins}/${this.losses}`;
  }
}

class DataService {
  constructor() {
    this.defaultSettings = {
      SCORE_CHANGE_K_FACTOR: 70,
      POINT_DIFFERENCE_WEIGHT: 6,
      ACTIVITY_THRESHOLD: DEFAULT_ACTIVITY_THRESHOLD,
      DEFAULT_RANK: 'Unranked',
      PLAYER1_SCOREBOARD_COLOR: '#4CAF50',
      PLAYER2_SCOREBOARD_COLOR: '#2196F3',
      GAME_HISTORY_KEEP: 30,
      ADDPLAYER_ADMINONLY: false,
      DISABLE_WIN_ANIMATION: false,
    };

    this.players = {};
    this.gameHistory = [];
    this.settings = { ...this.defaultSettings, ADMIN_PASSWORD: '' };
    this.currentUser = readStoredUser();
    this.isLocalMode = localStorage.getItem('isLocalMode') === 'true';

    /** Set when the most recent cloud save failed, so the UI can say so. */
    this.lastSaveError = null;

    /**
     * Revision of the account document this state was loaded from.
     *
     * The server rejects a write whose baseRevision no longer matches, which is
     * what stops two devices signed into the same account from silently
     * overwriting each other (docs/AUDIT.md D-03).
     */
    this.revision = 0;

    /** Set when a save was merged with a concurrent change from another device. */
    this.lastMergeNotice = null;

    this._saveTimer = null;
    this._pendingSave = null;
    this._replaying = false;
    this._listeners = new Set();

    // Bumped on every change. useSyncExternalStore needs a snapshot value that
    // is cheap to compare and stable between changes; a counter is both.
    this._version = 0;
  }

  get version() {
    return this._version;
  }

  // ---------------------------------------------------------------------------
  // Change notification
  //
  // The app used to keep three uncoordinated copies of this data (App's state,
  // SettingsContext's state, AdminControls' state) with nothing to keep them in
  // sync, which is why settings changes appeared to do nothing until a reload
  // (docs/AUDIT.md L-03) and why admin edits did not show on the leaderboard.
  // ---------------------------------------------------------------------------

  /** Subscribe to any change. Returns an unsubscribe function. */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _emit() {
    this._version += 1;
    this._listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('dataService listener threw:', error);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  setLocalMode(isLocal) {
    this.isLocalMode = isLocal;
    localStorage.setItem('isLocalMode', isLocal.toString());
  }

  setCurrentUser(username) {
    this.currentUser = username;
    localStorage.setItem('currentUser', username);
    return this.loadData();
  }

  clearCurrentUser() {
    this.currentUser = null;
    this.players = {};
    this.gameHistory = [];
    this.settings = { ...this.defaultSettings, ADMIN_PASSWORD: '' };
    this._emit();
  }

  /**
   * Attach the caller's Firebase ID token. The server verifies this and derives
   * the storage key from it, so a client can no longer read or overwrite an
   * arbitrary account by naming it (docs/AUDIT.md S-03).
   */
  async _authHeaders() {
    // Wait for Firebase to restore any persisted session, or the first request
    // after a page reload goes out unauthenticated. See config/firebase.js.
    await authReady;

    const user = auth.currentUser;
    if (!user) return {};
    try {
      return { Authorization: `Bearer ${await user.getIdToken()}` };
    } catch (error) {
      console.error('Could not get an auth token:', error);
      return {};
    }
  }

  async loadData() {
    if (this.isLocalMode) {
      const raw = localStorage.getItem('localGameData');
      if (!raw) return false;

      let localData;
      try {
        localData = JSON.parse(raw);
      } catch (error) {
        console.error('Local save data is corrupt, ignoring it:', error);
        return false;
      }
      this._hydrate(localData);
      return true;
    }

    if (!this.currentUser) return false;

    const response = await fetch(`${API_URL}/api/getData`, {
      headers: await this._authHeaders(),
    });
    if (!response.ok) throw new Error(`Failed to fetch data (${response.status})`);

    this._hydrate(await response.json());
    return true;
  }

  /** Rebuild in-memory state from a stored document. */
  _hydrate(data) {
    this.settings = { ...this.defaultSettings, ...(data.settings || {}) };
    this.gameHistory = (Array.isArray(data.gameHistory) ? data.gameHistory : []).map(
      // Matches written before ids existed get a stable one derived from their
      // contents, so conflict merging can tell them apart.
      (game) => (game.id ? game : { ...game, id: derivedGameId(game) })
    );
    this.revision = Number.isFinite(data.revision) ? data.revision : 0;
    this.players = {};

    Object.entries(data.players || {}).forEach(([name, playerData]) => {
      const player = new Player(playerData.name || name, playerData.score, playerData.password);
      Object.assign(player, playerData);

      // Older saves predate these fields. Normalising here means the rest of the
      // app can assume they exist — the stats dialog used to crash on a missing
      // scoreHistory (docs/AUDIT.md L-12).
      if (!Array.isArray(player.scoreHistory)) {
        player.scoreHistory = [player.lifetimeScore ?? player.score ?? STARTING_SCORE];
      }
      if (!Number.isFinite(player.lifetimeScore)) player.lifetimeScore = player.score;
      if (!Number.isFinite(player.maxWinStreak)) player.maxWinStreak = 0;
      if (!Number.isFinite(player.currentStreak)) player.currentStreak = 0;

      this.players[name] = player;
    });

    // Recompute from the *current* threshold rather than trusting the stored
    // flag, so raising ACTIVITY_THRESHOLD demotes players immediately instead of
    // waiting for each of them to play again.
    this._recomputeActiveStatus();
    this._emit();
  }

  _recomputeActiveStatus() {
    const threshold = this.settings.ACTIVITY_THRESHOLD;
    Object.values(this.players).forEach((player) => {
      player.active = isActive(player.gamesPlayed, threshold);
    });
  }

  _serialise() {
    return {
      settings: this.settings,
      players: this.players,
      gameHistory: this.gameHistory,
    };
  }

  /**
   * Schedule a save, coalescing rapid changes.
   *
   * Returns a promise that resolves when the write actually lands. The old
   * version returned undefined, so callers that wrote `await debouncedSave()`
   * were not waiting for anything (docs/AUDIT.md D-02).
   */
  scheduleSave() {
    // Replaying matches during a conflict merge goes through the normal record
    // path, which would otherwise schedule a save from inside a save.
    if (this._replaying) return Promise.resolve(true);

    if (this._saveTimer) clearTimeout(this._saveTimer);

    if (!this._pendingSave) {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // Nothing may await this promise; don't let a rejection become unhandled.
      promise.catch(() => {});
      this._pendingSave = { promise, resolve, reject };
    }

    const pending = this._pendingSave;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._pendingSave = null;
      this.saveData().then(pending.resolve, pending.reject);
    }, SAVE_DELAY);

    return pending.promise;
  }

  /** True if there are changes waiting to be written. */
  hasPendingSave() {
    return this._saveTimer !== null;
  }

  /**
   * Write any scheduled save immediately. Call this before the page goes away —
   * without it, a match recorded in the last second before the TV is switched
   * off is simply lost (docs/AUDIT.md D-02).
   */
  async flush({ keepalive = false } = {}) {
    if (!this._saveTimer) return true;

    clearTimeout(this._saveTimer);
    this._saveTimer = null;
    const pending = this._pendingSave;
    this._pendingSave = null;

    try {
      const result = await this.saveData({ keepalive, retries: 0 });
      pending?.resolve(result);
      return result;
    } catch (error) {
      pending?.reject(error);
      throw error;
    }
  }

  async saveData({
    keepalive = false,
    retries = SAVE_RETRY_DELAYS.length,
    allowMerge = true,
  } = {}) {
    if (this.isLocalMode) {
      localStorage.setItem('localGameData', JSON.stringify(this._serialise()));
      this.lastSaveError = null;
      return true;
    }

    const headers = { 'Content-Type': 'application/json', ...(await this._authHeaders()) };

    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await fetch(`${API_URL}/api/saveData`, {
          method: 'POST',
          headers,
          // Rebuilt each attempt: a merge changes both the payload and the
          // revision we are writing against.
          //
          // The unload flush omits baseRevision deliberately. The page is going
          // away, so there is nobody left to handle a 409 and merge — losing the
          // race is better than losing the write.
          body: JSON.stringify({
            ...this._serialise(),
            ...(keepalive ? {} : { baseRevision: this.revision }),
          }),
          keepalive,
        });

        // Somebody else wrote to this account since we loaded it.
        if (response.status === 409) {
          if (!allowMerge) throw new Error('Save failed (409)');
          const conflict = await response.json();
          this._mergeRemote(conflict.current);
          // One merge attempt only. If it conflicts again we are in a write
          // storm and backing off is better than looping.
          return this.saveData({ keepalive, retries, allowMerge: false });
        }

        if (!response.ok) throw new Error(`Save failed (${response.status})`);

        const result = await response.json().catch(() => ({}));
        if (Number.isFinite(result.revision)) this.revision = result.revision;

        this.lastSaveError = null;
        this._emit();
        return true;
      } catch (error) {
        if (attempt >= retries) {
          this.lastSaveError = error;
          this._emit();
          console.error('Error saving data:', error);
          throw error;
        }
        await delay(SAVE_RETRY_DELAYS[attempt]);
      }
    }
  }

  /**
   * Reconcile with a concurrent write from another device.
   *
   * Previously the loser of a race simply had their matches overwritten with no
   * indication anything had happened (docs/AUDIT.md D-03). Matches are
   * append-only and carry stable ids, so the common case — two people recording
   * games on two devices — merges exactly: adopt the server's state, then replay
   * whichever of our matches it has not seen. Replaying through recordGame means
   * ratings are recomputed against the server's player state rather than being
   * carried over from a stale base.
   *
   * Settings and player edits are not mergeable, so the server's copy wins for
   * those. That is a deliberate, documented choice rather than a silent one:
   * `lastMergeNotice` is set so the UI can say what happened.
   */
  _mergeRemote(serverDocument) {
    const localHistory = this.gameHistory;
    const serverIds = new Set((serverDocument?.gameHistory || []).map((g) => g.id));
    const unseen = localHistory.filter((game) => !serverIds.has(game.id));

    this._hydrate(serverDocument || { settings: {}, players: {}, gameHistory: [] });

    let replayed = 0;
    let dropped = 0;
    this._replaying = true;
    try {
      unseen.forEach((game) => {
        if (this._replayGame(game)) replayed += 1;
        else dropped += 1;
      });
    } finally {
      this._replaying = false;
    }

    this.lastMergeNotice = {
      replayed,
      dropped,
      message:
        dropped > 0
          ? `Merged with a change from another device. ${replayed} game(s) kept, ${dropped} could not be replayed.`
          : `Merged with a change from another device. ${replayed} game(s) kept.`,
    };
  }

  /** Re-apply one historical match on top of the current state. */
  _replayGame(game) {
    if (!this.players[game.player1] || !this.players[game.player2]) return false;

    if (game.score === 'Quit') {
      this.quitGame(game.player1, game.player2, { id: game.id, date: game.date });
      return true;
    }

    const [s1, s2] = String(game.score).split(' - ').map(Number);
    if (!Number.isFinite(s1) || !Number.isFinite(s2)) return false;

    return this.recordGame(game.player1, game.player2, s1, s2, {
      id: game.id,
      date: game.date,
    }).ok;
  }

  // ---------------------------------------------------------------------------
  // Players
  // ---------------------------------------------------------------------------

  /**
   * @returns {{ok: boolean, reason?: string}} — the old version returned a bare
   * false on a duplicate name and every caller ignored it, so adding a duplicate
   * player looked like it had worked (docs/AUDIT.md L-13).
   */
  addPlayer(name, password) {
    const trimmed = (name || '').trim();
    if (!trimmed) return { ok: false, reason: 'Player name cannot be empty.' };
    if (trimmed in this.players) {
      return { ok: false, reason: `There is already a player called "${trimmed}".` };
    }

    this.players[trimmed] = new Player(trimmed, STARTING_SCORE, password);
    this._emit();
    this.scheduleSave();
    return { ok: true };
  }

  async editPlayerPassword(playerName, newPassword) {
    const player = this.players[playerName];
    if (!player) return false;
    player.password = newPassword;
    this._emit();
    this.scheduleSave();
    return true;
  }

  /**
   * Admin override of a player's *season* score.
   *
   * This deliberately does not touch scoreHistory. That series records
   * lifetimeScore, so the old implementation was pushing a value from the wrong
   * series into the stats graph (docs/AUDIT.md L-11).
   */
  async editPlayerScore(playerName, newScore) {
    const player = this.players[playerName];
    if (!player || !Number.isFinite(newScore)) return false;
    player.score = newScore;
    this._emit();
    this.scheduleSave();
    return true;
  }

  async deletePlayer(playerName) {
    if (!this.players[playerName]) return false;
    delete this.players[playerName];
    this._emit();
    this.scheduleSave();
    return true;
  }

  async resetAllScores() {
    Object.values(this.players).forEach((player) => {
      player.score = STARTING_SCORE;
      player.gamesPlayed = 0;
      player.wins = 0;
      player.losses = 0;
      player.currentStreak = 0;
      player.active = false;
      // maxWinStreak and everything lifetime-prefixed survive on purpose: the
      // confirmation dialog promises a season reset, not a wipe.
    });
    this._emit();
    this.scheduleSave();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Matches
  // ---------------------------------------------------------------------------

  /**
   * @returns {{ok: false, reason: string} | {ok: true, game: object}}
   */
  recordGame(player1Name, player2Name, player1Score, player2Score, meta = {}) {
    if (!Number.isFinite(player1Score) || !Number.isFinite(player2Score)) {
      return { ok: false, reason: 'Scores must be numbers.' };
    }
    if (player1Score === player2Score) {
      // The display layer has always been able to render a tie, but the data
      // layer silently handed the win to player 2 (docs/AUDIT.md L-06).
      return { ok: false, reason: 'A game cannot end in a tie — play it out.' };
    }
    if (player1Score === 0 && player2Score === 0) {
      return { ok: false, reason: 'Nobody has scored yet.' };
    }

    const player1 = this.players[player1Name];
    const player2 = this.players[player2Name];
    if (!player1 || !player2) {
      return { ok: false, reason: 'One of those players no longer exists.' };
    }

    const p1Won = player1Score > player2Score;
    const pointDifference = Math.abs(player1Score - player2Score);
    const threshold = this.settings.ACTIVITY_THRESHOLD;

    // Ranks are the pre-match standings — that is what "player1Rank" means to
    // anyone reading the history.
    const player1Rank = this.getPlayerRank(player1Name);
    const player2Rank = this.getPlayerRank(player2Name);

    // Snapshot both players before either is modified. See rating.js.
    const deltas = computeMatchDeltas(
      player1.snapshot(),
      player2.snapshot(),
      p1Won,
      pointDifference,
      this.settings
    );

    const pointChange1 = player1.applyMatch(deltas.p1, p1Won, threshold);
    const pointChange2 = player2.applyMatch(deltas.p2, !p1Won, threshold);

    const game = {
      id: meta.id || newGameId(),
      player1: player1Name,
      player2: player2Name,
      score: `${player1Score} - ${player2Score}`,
      player1Rank,
      player2Rank,
      pointChange1,
      pointChange2,
      date: meta.date || new Date().toISOString(),
    };

    this._appendToHistory(game);
    this._emit();
    this.scheduleSave();
    return { ok: true, game };
  }

  /** Record an abandoned game. No rating effect. */
  quitGame(player1Name, player2Name, meta = {}) {
    const game = {
      id: meta.id || newGameId(),
      player1: player1Name,
      player2: player2Name,
      score: 'Quit',
      player1Rank: this.getPlayerRank(player1Name),
      player2Rank: this.getPlayerRank(player2Name),
      pointChange1: 0,
      pointChange2: 0,
      date: meta.date || new Date().toISOString(),
    };

    this._appendToHistory(game);
    this._emit();
    this.scheduleSave();
    return game;
  }

  _appendToHistory(game) {
    this.gameHistory = [...this.gameHistory, game].slice(-MAX_STORED_HISTORY);
  }

  /** Remove the most recent match and undo its rating effect. */
  undoLastGame() {
    const last = this.gameHistory[this.gameHistory.length - 1];
    if (!last) return { ok: false, reason: 'There is nothing to undo.' };

    const player1 = this.players[last.player1];
    const player2 = this.players[last.player2];
    if (!player1 || !player2) {
      return { ok: false, reason: 'One of those players no longer exists.' };
    }

    if (last.score !== 'Quit') {
      const p1Won = last.pointChange1 > last.pointChange2;
      revertMatch(player1, last.pointChange1, p1Won, this.settings.ACTIVITY_THRESHOLD);
      revertMatch(player2, last.pointChange2, !p1Won, this.settings.ACTIVITY_THRESHOLD);
    }

    this.gameHistory = this.gameHistory.slice(0, -1);
    this._emit();
    this.scheduleSave();
    return { ok: true, game: last };
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  getPlayerRank(playerName) {
    const ranked = Object.values(this.players)
      .filter((p) => p.active)
      .sort((a, b) => b.score - a.score);
    const index = ranked.findIndex((p) => p.name === playerName);
    return index !== -1 ? index + 1 : 'Unranked';
  }

  getLeaderboard() {
    const active = Object.values(this.players)
      .filter((player) => player.active)
      .sort((a, b) => b.score - a.score)
      .map((player) => ({
        name: player.name,
        score: player.score.toFixed(2),
        ratio: player.winLossRatio(),
        currentStreak: player.currentStreak,
        active: true,
      }));

    const inactive = Object.values(this.players)
      .filter((player) => !player.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((player) => ({
        name: player.name,
        score: this.settings.DEFAULT_RANK,
        ratio: player.winLossRatio(),
        currentStreak: player.currentStreak,
        active: false,
      }));

    return [...active, ...inactive];
  }

  /** Most recent matches first is how they are stored; oldest first is how they read. */
  getGameHistory(limit = this.settings.GAME_HISTORY_KEEP) {
    if (!Number.isFinite(limit) || limit <= 0) return this.gameHistory;
    return this.gameHistory.slice(-limit);
  }

  getSettings() {
    return this.settings;
  }

  getPlayers() {
    return Object.values(this.players);
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this._recomputeActiveStatus();
    this._emit();
    return this.scheduleSave();
  }

  async setAdminPassword(password) {
    return this.updateSettings({ ADMIN_PASSWORD: password });
  }

  // ---------------------------------------------------------------------------
  // Whole-account operations
  // ---------------------------------------------------------------------------

  /** Replace everything, e.g. from an uploaded backup. */
  async importAccount(data) {
    if (!data || !data.settings || !data.players || !data.gameHistory) {
      throw new Error('Invalid save file format');
    }
    this._hydrate(data);
    if (this.isLocalMode) return this.saveData();
    return this.flushNow();
  }

  /** Save right now, bypassing the debounce. */
  async flushNow() {
    if (this._saveTimer) return this.flush();
    return this.saveData();
  }

  /**
   * Delete this account's data.
   *
   * The old implementation fetched the entire database into the browser, deleted
   * one key and posted the whole thing back — which threw, and would have been a
   * one-click wipe of every user on the platform if anyone had "fixed" it
   * (docs/AUDIT.md D-05). Deletion is now scoped server-side to the caller's own
   * authenticated account.
   */
  async eraseAccount() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
      this._pendingSave = null;
    }

    if (this.isLocalMode) {
      localStorage.removeItem('localGameData');
    } else {
      const response = await fetch(`${API_URL}/api/deleteAccount`, {
        method: 'POST',
        headers: await this._authHeaders(),
      });
      if (!response.ok) throw new Error(`Failed to delete account (${response.status})`);
    }

    localStorage.removeItem('currentUser');
    localStorage.removeItem('isLocalMode');
    this.clearCurrentUser();
    return true;
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Stable identity for a match, so a merge can tell two devices' games apart. */
function newGameId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Identity for a match recorded before ids existed.
 *
 * Derived from the fields that identify it rather than random, so the same old
 * match gets the same id on every device and merging does not duplicate it.
 */
function derivedGameId(game) {
  return `legacy-${game.date}-${game.player1}-${game.player2}-${game.score}`;
}

/**
 * Read the stored identity.
 *
 * This used to be `atob(localStorage.getItem('currentUser'))` with no guard, at
 * module scope. Both login paths write the raw value before anything re-encodes
 * it, so an interrupted login left a value that atob throws on — during module
 * evaluation, before React renders and outside any error boundary. The result was
 * a white screen that survived reloads (docs/AUDIT.md D-06).
 *
 * The base64 is gone (it was never protecting anything — docs/AUDIT.md S-07) but
 * we still decode legacy values so existing sessions survive the upgrade.
 */
function readStoredUser() {
  const stored = localStorage.getItem('currentUser');
  if (!stored) return null;

  // Values written by the current code are stored as-is.
  if (stored.includes('@') || stored === 'local_user') return stored;

  try {
    const decoded = atob(stored);
    localStorage.setItem('currentUser', decoded);
    return decoded;
  } catch {
    // Not base64 either — take it at face value rather than bricking the app.
    return stored;
  }
}

/** Undo one match's effect on one player. */
function revertMatch(player, pointChange, won, activityThreshold) {
  player.score -= pointChange;
  player.gamesPlayed = Math.max(0, player.gamesPlayed - 1);
  player.lifetimeGamesPlayed = Math.max(0, player.lifetimeGamesPlayed - 1);

  if (Array.isArray(player.scoreHistory) && player.scoreHistory.length > 1) {
    player.scoreHistory.pop();
    player.lifetimeScore = player.scoreHistory[player.scoreHistory.length - 1];
  }

  if (won) {
    player.wins = Math.max(0, player.wins - 1);
    player.lifetimeWins = Math.max(0, player.lifetimeWins - 1);
    player.currentStreak = Math.max(0, player.currentStreak - 1);
  } else {
    player.losses = Math.max(0, player.losses - 1);
    player.lifetimeLosses = Math.max(0, player.lifetimeLosses - 1);
  }

  player.active = isActive(player.gamesPlayed, activityThreshold);
}

const dataService = new DataService();

// A match recorded in the last second before the page goes away used to be lost.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (dataService.hasPendingSave()) {
      dataService.flush({ keepalive: true }).catch(() => {});
    }
  });
}

export default dataService;
export { Player, DataService };
