import { DataService, MAX_STORED_HISTORY } from './dataService';
import { userKey } from '../../api/userKey';

// Firebase is not initialised in tests; the service only needs an ID token.
jest.mock('../config/firebase', () => ({
  auth: { currentUser: { getIdToken: async () => 'fake-token' } },
  authReady: Promise.resolve(null),
}));

const EMAIL = 'someone@example.com';
const EMPTY_ACCOUNT = { settings: {}, players: {}, gameHistory: [] };

/**
 * An in-memory stand-in for api/getData + api/saveData.
 *
 * It mirrors the real handlers on the point that matters: the storage key is
 * derived from the *authenticated* identity on both the read and the write path,
 * using the shared userKey() the server actually uses. It never reads a key from
 * the request body, because the real API no longer accepts one.
 */
function createFakeServer(email = EMAIL) {
  const documents = {};
  const requests = [];

  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    const key = userKey(email);

    if (url.endsWith('/api/getData')) {
      if (!options.headers?.Authorization) {
        return { ok: false, status: 401, json: async () => ({ error: 'unauthenticated' }) };
      }
      return { ok: true, status: 200, json: async () => documents[key] || EMPTY_ACCOUNT };
    }

    if (url.endsWith('/api/saveData')) {
      if (!options.headers?.Authorization) {
        return { ok: false, status: 401, json: async () => ({ error: 'unauthenticated' }) };
      }
      const { settings, players, gameHistory, baseRevision } = JSON.parse(options.body);
      const currentRevision = documents[key]?.revision ?? 0;

      // Mirrors the transaction in api/saveData.js.
      if (Number.isFinite(baseRevision) && baseRevision !== currentRevision) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            error: 'conflict',
            current: documents[key] || {
              settings: {},
              players: {},
              gameHistory: [],
              revision: currentRevision,
            },
          }),
        };
      }

      const revision = currentRevision + 1;
      documents[key] = JSON.parse(
        JSON.stringify({ settings, players, gameHistory, revision })
      );
      return { ok: true, status: 200, json: async () => ({ message: 'ok', revision }) };
    }

    if (url.endsWith('/api/deleteAccount')) {
      delete documents[key];
      return { ok: true, status: 200, json: async () => ({ message: 'ok' }) };
    }

    throw new Error(`Unexpected request to ${url}`);
  };

  return { documents, requests, fetchImpl };
}

function cloudService(server) {
  global.fetch = server.fetchImpl;
  const service = new DataService();
  service.setLocalMode(false);
  service.currentUser = EMAIL;
  return service;
}

function localService() {
  const service = new DataService();
  service.setLocalMode(true);
  service.currentUser = 'local_user';
  return service;
}

beforeEach(() => {
  localStorage.clear();
  jest.useRealTimers();
});

// -----------------------------------------------------------------------------

describe('cloud persistence round-trip', () => {
  /**
   * The regression test for docs/AUDIT.md D-01.
   *
   * A save followed by a load must return what was saved. The old code wrote
   * under btoa(email) and read under email.replace('.','_DOT_'), so this
   * assertion would have failed the moment that change was made — instead the
   * bug shipped and silently discarded every cloud-mode game.
   */
  it('reads back exactly what it wrote', async () => {
    const server = createFakeServer();
    const writer = cloudService(server);

    writer.addPlayer('Alice', 'pw1');
    writer.addPlayer('Bob', 'pw2');
    const result = writer.recordGame('Alice', 'Bob', 11, 7);
    expect(result.ok).toBe(true);
    await writer.flushNow();

    const reader = cloudService(server);
    await reader.loadData();

    expect(Object.keys(reader.players).sort()).toEqual(['Alice', 'Bob']);
    expect(reader.gameHistory).toHaveLength(1);
    expect(reader.gameHistory[0].score).toBe('11 - 7');
    expect(reader.players.Alice.score).toBeCloseTo(writer.players.Alice.score, 10);
    expect(reader.players.Bob.score).toBeCloseTo(writer.players.Bob.score, 10);
  });

  it('never sends an account identifier in the request body', async () => {
    const server = createFakeServer();
    const service = cloudService(server);
    service.addPlayer('Alice', '');
    await service.flushNow();

    const save = server.requests.find((r) => r.url.endsWith('/api/saveData'));
    const body = JSON.parse(save.options.body);
    expect(body).not.toHaveProperty('currentUser');
    expect(body).not.toHaveProperty('userId');
  });

  it('authenticates every request', async () => {
    const server = createFakeServer();
    const service = cloudService(server);
    await service.loadData();
    service.addPlayer('Alice', '');
    await service.flushNow();

    expect(server.requests.length).toBeGreaterThan(0);
    server.requests.forEach((request) => {
      expect(request.options.headers.Authorization).toBe('Bearer fake-token');
    });
  });

  /**
   * Regression tests for docs/AUDIT.md D-03.
   *
   * Two devices signed into the same account used to overwrite each other with
   * no error and no indication anything had been lost.
   */
  describe('concurrent devices', () => {
    it('merges instead of clobbering when both record a game', async () => {
      const server = createFakeServer();

      const tv = cloudService(server);
      tv.addPlayer('Alice', '');
      tv.addPlayer('Bob', '');
      await tv.flushNow();

      // A second device loads the same account.
      const phone = cloudService(server);
      await phone.loadData();
      expect(phone.revision).toBe(tv.revision);

      // Both record a different game against the same base revision.
      tv.recordGame('Alice', 'Bob', 11, 4);
      await tv.flushNow();

      phone.recordGame('Bob', 'Alice', 11, 9);
      await phone.flushNow();

      // Neither game was lost.
      const stored = server.documents[userKey(EMAIL)];
      expect(stored.gameHistory).toHaveLength(2);
      expect(stored.gameHistory.map((g) => g.score).sort()).toEqual(['11 - 4', '11 - 9']);

      // And both players' records reflect both games.
      const reader = cloudService(server);
      await reader.loadData();
      expect(reader.players.Alice.gamesPlayed).toBe(2);
      expect(reader.players.Bob.gamesPlayed).toBe(2);
      expect(reader.players.Alice.wins + reader.players.Bob.wins).toBe(2);
    });

    it('tells the caller a merge happened', async () => {
      const server = createFakeServer();
      const tv = cloudService(server);
      tv.addPlayer('Alice', '');
      tv.addPlayer('Bob', '');
      await tv.flushNow();

      const phone = cloudService(server);
      await phone.loadData();

      tv.recordGame('Alice', 'Bob', 11, 4);
      await tv.flushNow();

      phone.recordGame('Bob', 'Alice', 11, 9);
      await phone.flushNow();

      expect(phone.lastMergeNotice).toBeTruthy();
      expect(phone.lastMergeNotice.replayed).toBe(1);
      expect(phone.lastMergeNotice.dropped).toBe(0);
    });

    it('does not duplicate a game both devices already have', async () => {
      const server = createFakeServer();
      const tv = cloudService(server);
      tv.addPlayer('Alice', '');
      tv.addPlayer('Bob', '');
      tv.recordGame('Alice', 'Bob', 11, 4);
      await tv.flushNow();

      const phone = cloudService(server);
      await phone.loadData();

      // The TV writes again (a settings change, say) so the phone's base is stale,
      // but the phone has nothing new of its own.
      await tv.updateSettings({ GAME_HISTORY_KEEP: 15 });
      await tv.flushNow();

      await phone.updateSettings({ DEFAULT_RANK: 'Rookie' });
      await phone.flushNow();

      expect(server.documents[userKey(EMAIL)].gameHistory).toHaveLength(1);
      expect(phone.lastMergeNotice.replayed).toBe(0);
    });

    it('assigns stable ids to matches recorded before ids existed', async () => {
      const server = createFakeServer();
      const key = userKey(EMAIL);
      server.documents[key] = {
        settings: {},
        players: {},
        gameHistory: [
          { player1: 'A', player2: 'B', score: '11 - 3', date: '2025-01-01T00:00:00.000Z' },
        ],
        revision: 1,
      };

      const first = cloudService(server);
      await first.loadData();
      const second = cloudService(server);
      await second.loadData();

      expect(first.gameHistory[0].id).toBeTruthy();
      expect(first.gameHistory[0].id).toBe(second.gameHistory[0].id);
    });

    it('skips the revision check on the unload flush', async () => {
      const server = createFakeServer();
      const service = cloudService(server);
      service.addPlayer('Alice', '');
      await service.flushNow();

      // Pretend another device moved the revision on.
      server.documents[userKey(EMAIL)].revision = 99;

      service.addPlayer('Bob', '');
      await service.flush({ keepalive: true });

      const save = server.requests.filter((r) => r.url.endsWith('/api/saveData')).pop();
      expect(JSON.parse(save.options.body)).not.toHaveProperty('baseRevision');
      expect(Object.keys(server.documents[userKey(EMAIL)].players).sort()).toEqual([
        'Alice',
        'Bob',
      ]);
    });
  });

  it('surfaces a failed save instead of silently dropping it', async () => {
    const server = createFakeServer();
    const service = cloudService(server);
    global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });

    await expect(service.saveData({ retries: 0 })).rejects.toThrow(/500/);
    expect(service.lastSaveError).toBeTruthy();
  });
});

describe('local persistence round-trip', () => {
  it('reads back exactly what it wrote', async () => {
    const writer = localService();
    writer.addPlayer('Alice', 'pw');
    writer.addPlayer('Bob', 'pw');
    writer.recordGame('Alice', 'Bob', 11, 3);
    await writer.saveData();

    const reader = localService();
    await reader.loadData();

    expect(Object.keys(reader.players).sort()).toEqual(['Alice', 'Bob']);
    expect(reader.gameHistory).toHaveLength(1);
    expect(reader.players.Alice.wins).toBe(1);
    expect(reader.players.Bob.losses).toBe(1);
  });

  it('survives corrupt local data rather than throwing', async () => {
    localStorage.setItem('localGameData', '{not json');
    const service = localService();
    await expect(service.loadData()).resolves.toBe(false);
  });
});

describe('recordGame', () => {
  const service = () => {
    const s = localService();
    s.addPlayer('Alice', '');
    s.addPlayer('Bob', '');
    return s;
  };

  /** docs/AUDIT.md L-06 — a tie used to be recorded, handing the win to player 2. */
  it('refuses a tie', () => {
    const result = service().recordGame('Alice', 'Bob', 10, 10);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/tie/i);
  });

  it('refuses a game nobody has scored in', () => {
    expect(service().recordGame('Alice', 'Bob', 0, 0).ok).toBe(false);
  });

  it('refuses non-numeric scores', () => {
    expect(service().recordGame('Alice', 'Bob', '11', 9).ok).toBe(false);
  });

  it('refuses an unknown player', () => {
    expect(service().recordGame('Alice', 'Nobody', 11, 9).ok).toBe(false);
  });

  it('records pre-match ranks, not post-match ones', () => {
    const s = service();
    const { game } = s.recordGame('Alice', 'Bob', 11, 9);
    // Neither player is ranked before their first game.
    expect(game.player1Rank).toBe('Unranked');
    expect(game.player2Rank).toBe('Unranked');
  });

  it('moves the winner up and the loser down', () => {
    const s = service();
    s.recordGame('Alice', 'Bob', 11, 9);
    expect(s.players.Alice.score).toBeGreaterThan(1000);
    expect(s.players.Bob.score).toBeLessThan(1000);
  });
});

describe('ACTIVITY_THRESHOLD', () => {
  /** docs/AUDIT.md L-04 — the setting was ignored and 3 was hardcoded. */
  it('is honoured when deciding who is ranked', async () => {
    const s = localService();
    await s.updateSettings({ ACTIVITY_THRESHOLD: 5 });
    s.addPlayer('Alice', '');
    s.addPlayer('Bob', '');

    for (let i = 0; i < 4; i += 1) s.recordGame('Alice', 'Bob', 11, 5);
    expect(s.players.Alice.active).toBe(false);

    s.recordGame('Alice', 'Bob', 11, 5);
    expect(s.players.Alice.active).toBe(true);
  });

  it('re-evaluates existing players when the threshold changes', async () => {
    const s = localService();
    s.addPlayer('Alice', '');
    s.addPlayer('Bob', '');
    for (let i = 0; i < 3; i += 1) s.recordGame('Alice', 'Bob', 11, 5);
    expect(s.players.Alice.active).toBe(true);

    await s.updateSettings({ ACTIVITY_THRESHOLD: 10 });
    expect(s.players.Alice.active).toBe(false);
  });
});

describe('game history', () => {
  /** docs/AUDIT.md D-08 — GAME_HISTORY_KEEP used to truncate stored data. */
  it('keeps every match even when the display limit is small', async () => {
    const s = localService();
    await s.updateSettings({ GAME_HISTORY_KEEP: 2 });
    s.addPlayer('Alice', '');
    s.addPlayer('Bob', '');

    for (let i = 0; i < 6; i += 1) s.recordGame('Alice', 'Bob', 11, i);

    expect(s.gameHistory).toHaveLength(6);
    expect(s.getGameHistory()).toHaveLength(2);
  });

  it('caps stored history so one account cannot grow without bound', () => {
    const s = localService();
    s.gameHistory = new Array(MAX_STORED_HISTORY).fill(null).map((_, i) => ({ n: i }));
    s._appendToHistory({ n: 'newest' });

    expect(s.gameHistory).toHaveLength(MAX_STORED_HISTORY);
    expect(s.gameHistory[s.gameHistory.length - 1].n).toBe('newest');
  });
});

describe('quitGame', () => {
  /** docs/AUDIT.md L-01 — this used to throw and return null in both modes. */
  it('records an abandoned game without touching ratings', () => {
    const s = localService();
    s.addPlayer('Alice', '');
    s.addPlayer('Bob', '');

    const game = s.quitGame('Alice', 'Bob');

    expect(game.score).toBe('Quit');
    expect(s.gameHistory).toHaveLength(1);
    expect(s.players.Alice.score).toBe(1000);
    expect(s.players.Alice.gamesPlayed).toBe(0);
  });

  it('works in cloud mode too', async () => {
    const server = createFakeServer();
    const s = cloudService(server);
    s.addPlayer('Alice', '');
    s.addPlayer('Bob', '');

    expect(s.quitGame('Alice', 'Bob').score).toBe('Quit');
    await s.flushNow();
    expect(server.documents[userKey(EMAIL)].gameHistory).toHaveLength(1);
  });
});

describe('undoLastGame', () => {
  it('restores both players to their pre-match state', () => {
    const s = localService();
    s.addPlayer('Alice', '');
    s.addPlayer('Bob', '');

    const before = { alice: s.players.Alice.score, bob: s.players.Bob.score };
    s.recordGame('Alice', 'Bob', 11, 9);
    const result = s.undoLastGame();

    expect(result.ok).toBe(true);
    expect(s.gameHistory).toHaveLength(0);
    expect(s.players.Alice.score).toBeCloseTo(before.alice, 10);
    expect(s.players.Bob.score).toBeCloseTo(before.bob, 10);
    expect(s.players.Alice.gamesPlayed).toBe(0);
    expect(s.players.Alice.wins).toBe(0);
    expect(s.players.Bob.losses).toBe(0);
  });

  it('reports when there is nothing to undo', () => {
    expect(localService().undoLastGame().ok).toBe(false);
  });
});

describe('addPlayer', () => {
  /** docs/AUDIT.md L-13 — duplicates failed silently. */
  it('reports a duplicate name instead of returning a bare false', () => {
    const s = localService();
    expect(s.addPlayer('Alice', '').ok).toBe(true);

    const duplicate = s.addPlayer('Alice', '');
    expect(duplicate.ok).toBe(false);
    expect(duplicate.reason).toMatch(/already/i);
  });

  it('rejects an empty name', () => {
    expect(localService().addPlayer('   ', '').ok).toBe(false);
  });
});

describe('legacy session values', () => {
  /**
   * docs/AUDIT.md D-06 — an unguarded atob() at module scope meant an
   * interrupted login left a value that threw during import, producing a white
   * screen that survived reloads.
   */
  it('does not throw on a raw email left by an interrupted login', () => {
    localStorage.setItem('currentUser', 'someone@example.com');
    expect(() => new DataService()).not.toThrow();
    expect(new DataService().currentUser).toBe('someone@example.com');
  });

  it('does not throw on an unparseable value', () => {
    localStorage.setItem('currentUser', '!!!not base64!!!');
    expect(() => new DataService()).not.toThrow();
  });

  it('migrates a base64 value written by the previous version', () => {
    localStorage.setItem('currentUser', btoa('someone@example.com'));
    expect(new DataService().currentUser).toBe('someone@example.com');
    expect(localStorage.getItem('currentUser')).toBe('someone@example.com');
  });
});

describe('resetAllScores', () => {
  it('clears the season but keeps lifetime stats', () => {
    const s = localService();
    s.addPlayer('Alice', '');
    s.addPlayer('Bob', '');
    for (let i = 0; i < 3; i += 1) s.recordGame('Alice', 'Bob', 11, 5);

    const lifetimeWins = s.players.Alice.lifetimeWins;
    const maxStreak = s.players.Alice.maxWinStreak;
    s.resetAllScores();

    expect(s.players.Alice.score).toBe(1000);
    expect(s.players.Alice.gamesPlayed).toBe(0);
    expect(s.players.Alice.active).toBe(false);
    expect(s.players.Alice.lifetimeWins).toBe(lifetimeWins);
    expect(s.players.Alice.maxWinStreak).toBe(maxStreak);
  });
});

describe('subscribers', () => {
  it('are notified when data changes', () => {
    const s = localService();
    const listener = jest.fn();
    const unsubscribe = s.subscribe(listener);

    s.addPlayer('Alice', '');
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    const callCount = listener.mock.calls.length;
    s.addPlayer('Bob', '');
    expect(listener).toHaveBeenCalledTimes(callCount);
  });
});
