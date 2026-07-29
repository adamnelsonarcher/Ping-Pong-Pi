# Ping Pong Pi — Remediation & Design Roadmap

Companion to [AUDIT.md](AUDIT.md) (what's wrong) and
[ARCHITECTURE.md](ARCHITECTURE.md) (how it works today). This document is about
**what to do next**, in what order, and what the app could become.

---

## 1. Triage

Ordered by (damage × likelihood) ÷ effort. Steps 0 and 1 are hours, not days.

### Step 0 — Stop the bleeding (do today)

| # | Action | Finding |
|---|---|---|
| 1 | **Revoke the Firebase service-account key**, issue a new one, store it only in Vercel env vars | S-01 |
| 2 | `git rm --cached .env public/data/data.json`, commit, push | S-01, S-02 |
| 3 | Purge both from git history (`git filter-repo`), force-push | S-01, S-02 |
| 4 | Change every password that appeared in `data.json`; notify `donutcraft34@` that their address and password were exposed | S-02 |
| 5 | Revert `dataService.js:191` to `currentUser: this.currentUser` — one line, restores cloud saving | D-01 |
| 6 | Delete the orphaned base64 documents in the Firestore console (merge anything worth keeping first) | D-01 |

Step 5 is a one-line fix for the most damaging bug in the app. Do it before
anything architectural.

### Step 1 — Make the core reliable (a weekend)

| # | Action | Finding |
|---|---|---|
| 7 | Add server-side ID-token verification; derive the doc key from the verified `uid` | S-03, S-04 |
| 8 | Rewrite `quitGame` to use the in-memory + normal save path | L-01 |
| 9 | Guard both `atob` call sites with the existing `decodeUser()`; add an error boundary | D-06, Q-10 |
| 10 | Replace `dangerouslySetInnerHTML` in `GameHistory` with JSX | S-05 |
| 11 | Snapshot ratings before updating either player | L-02 |
| 12 | Flush pending saves on `beforeunload`; make `debouncedSave` awaitable | D-02 |
| 13 | Make `getSettings`/`getPlayers` read the singleton instead of refetching | D-04 |

### Step 2 — Make the settings real (a week)

Wire up the settings that are advertised but inert (L-04, L-05, L-08), give
`SettingsContext` a write path so changes apply without a reload (L-03), reject
ties and 0–0 (L-06), guard against double-recording (L-07), and stop truncating
stored history (D-08).

### Step 3 — Structural (the sections below)

Data model, state ownership, toolchain, tests.

---

## 2. Authentication — the smallest correct version

Today the client asserts who it is. It should prove it.

**Client** — attach the Firebase ID token to every request:

```js
// src/services/dataService.js
import { auth } from '../config/firebase';

async function authedFetch(path, init = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  const token = await user.getIdToken();          // cached; refreshes automatically
  return fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
}
```

**Server** — verify it, and never trust a client-supplied identity:

```js
// api/_auth.js
const admin = require('./firebase-admin');

module.exports = async function requireUser(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'missing token' }); return null; }
  try {
    return await admin.auth().verifyIdToken(token);   // → { uid, email, ... }
  } catch {
    res.status(401).json({ error: 'invalid token' });
    return null;
  }
};
```

```js
// api/getData.js
const requireUser = require('./_auth');

module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const doc = await db.collection('users').doc(user.uid).get();   // uid, not email
  res.json(doc.exists ? doc.data() : emptyAccount());
};
```

Three things fall out of this for free:

- **The `_DOT_` escaping disappears.** A Firebase `uid` is already a safe document
  ID. That deletes the entire class of bug D-01 belongs to.
- **CORS can be locked to your own origin** (S-04), because the token is the
  authority rather than the origin.
- **`ADMIN_PASSWORD` becomes optional.** "Is this the Google account that owns this
  data" is a stronger check than a shared password stored in plaintext (S-06). Keep
  the password only as a local-mode kiosk lock, and rename it so its scope is clear.

Local mode is unaffected — it never touches the network.

---

## 3. Data model — get off the single document

Everything in `pingpong/data` is one Firestore document shared by every user of the
product. That single decision causes D-03 (last-write-wins), D-08 (history
truncation), the O(all users) read on every load, and eventually a hard wall:
**Firestore documents cap at 1 MB.** The committed dump is 11 KB for three
accounts — so somewhere around a few hundred active accounts the entire product
stops writing.

### Target shape

```
users/{uid}                          ← settings, display name; one small doc
users/{uid}/players/{playerId}       ← one doc per player, id is a generated key
users/{uid}/matches/{matchId}        ← append-only, never rewritten
```

Three properties worth the migration:

1. **Writes stop colliding.** Recording a match is `matches.add(...)` plus two
   player updates. Two devices can record simultaneously without either losing.
2. **History becomes unbounded and cheap.** `GAME_HISTORY_KEEP` goes back to being
   what its description claims — a display limit — because you query
   `orderBy('date','desc').limit(n)` instead of truncating stored data (D-08).
3. **Renaming a player becomes possible.** Keying `players` by display name is why
   it currently isn't; a generated `playerId` with `name` as a mutable field fixes
   it, and lets two people share a nickname.

### Ratings become derived, not stored

You already record every match, including `pointChange1`/`pointChange2`. That means
ratings are a **fold over the match log** rather than primary data:

```js
const ratings = matches.reduce(applyMatch, seedRatings(players));
```

This is worth doing for reasons beyond tidiness:

- **Rating bugs become fixable retroactively.** L-02 changes everyone's numbers —
  with derived ratings you replay the log and the leaderboard is simply correct,
  instead of carrying inflation forward forever.
- **Tuning K-factor stops being destructive.** Today, changing
  `SCORE_CHANGE_K_FACTOR` only affects future games, so the ladder is a mix of
  eras. Replay makes "what if K were 40?" a preview.
- **Seasons become a filter**, not a destructive reset (L-10). "Reset All Scores"
  becomes `seasonStart = now`, and the lifetime view is the same fold without the
  filter. Nothing is ever destroyed.
- **Undo becomes possible.** Deleting the last match and re-folding is exact. Today
  a mis-scored game is permanent unless an admin hand-edits a rating (L-11).

Cache the fold in `users/{uid}` for fast first paint; recompute on load. With
`GAME_HISTORY_KEEP` at 30 the current data set is trivially small, and even a
thousand matches folds in under a millisecond.

### Migration path

Write a one-shot script that reads each `users[key]` blob, creates the
subcollections, and stamps `schemaVersion: 2`. Have the client handle both shapes
for one release, then delete the old path. The existing JSON export/import in Admin
→ Data Management is your rollback.

---

## 4. State ownership — one source of truth

The current design has three copies of the same data drifting apart:

```
dataService (module singleton) ──┬─► App's useState (players, leaderboard, history)
                                 ├─► SettingsContext's useState (frozen at boot)
                                 └─► AdminControls' gameSettings useState
```

Nothing synchronises them. That is the direct cause of L-03 (settings that don't
apply), D-04 (admin reload discarding edits), D-07 (the boot race), and the
`DEFAULT_RANK` split-brain where `getLeaderboard` and `Leaderboard.formatScore` read
the same setting from two places.

**The fix is not a bigger framework — it's picking one owner.** Two good options:

**Option A — keep the singleton, make it observable.** Smallest diff. Add a
subscribe/notify to `dataService`; components read through
`useSyncExternalStore`. React re-renders when the data actually changes, and
`SettingsContext` disappears entirely.

```js
// dataService
subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
_emit() { this._subs.forEach(f => f()); }
// call this._emit() after every mutation

// hook
const players = useSyncExternalStore(
  dataService.subscribe.bind(dataService),
  () => dataService.playersSnapshot          // must be referentially stable
);
```

**Option B — move to a small store** (Zustand is ~1 KB and fits this app well).
Slightly larger diff, but you get devtools, selectors and no manual snapshot
discipline.

Either way, `dataService` should split into three files that currently share one
658-line class:

| Module | Responsibility |
|---|---|
| `rating.js` | Pure functions: `expectedScore`, `applyMatch`, `foldMatches`. No I/O. |
| `store.js` | In-memory state + subscriptions. No I/O. |
| `persistence/{cloud,local}.js` | Two implementations of one interface: `load()`, `save()`, `deleteAccount()` |

`rating.js` being pure is what makes the maths testable (§6). The
`if (this.isLocalMode)` branch that currently appears in six methods collapses into
one adapter choice at startup.

---

## 5. Toolchain

`react-scripts` 5.0.1 is a dead end: CRA was retired in February 2025, it's the
source of most of the 71 `npm audit` findings (S-09), and its own build output tells
you it's unmaintained.

**Migrate to Vite.** For an app this size it's a half-day:

1. `npm create vite@latest` in a scratch dir, copy the config over
2. `index.html` moves from `public/` to the project root, with
   `<script type="module" src="/src/index.js">`
3. Rename any file containing JSX from `.js` to `.jsx`
4. `process.env.REACT_APP_*` → `import.meta.env.VITE_*`
5. `proxy` in `package.json` → `server.proxy` in `vite.config.js`
6. Delete `react-scripts`, `@babel/*` leftovers

Expected: cold start from ~20 s to under a second, HMR from seconds to instant, and
most of the vulnerability list gone because the dependency tree shrinks by an order
of magnitude.

While there, take Q-01 (`createRoot`) and Q-11 (`React.lazy` around
`LifetimeStatsDialog`, which alone should cut a large slice of the 215 KB bundle).

---

## 6. Testing — the 20% that would have caught 80% of these

There are currently zero real tests (Q-02). Do not aim for coverage; aim at the
three places every historical bug has come from.

**1. Rating maths — pure, fast, high value.** Once `rating.js` is extracted:

```js
test('a match is zero-sum', () => {
  const [w, l] = applyMatch(alice, bob, 11, 9, settings);
  expect(w.change + l.change).toBeCloseTo(0, 6);      // catches L-02
});

test('update order does not affect the result', () => {
  expect(applyMatch(a, b, 11, 9, s)).toEqual(mirror(applyMatch(b, a, 9, 11, s)));
});

test('ACTIVITY_THRESHOLD is honoured', () => {
  const p = playAfter(9, { ...settings, ACTIVITY_THRESHOLD: 10 });
  expect(p.active).toBe(false);                        // catches L-04
});

test('replaying the match log reproduces stored ratings', () => {
  expect(foldMatches(seed, fixtureMatches)).toEqual(fixtureLeaderboard);
});
```

That last one is a regression net for the entire scoring system, and it becomes
possible for free once §3's derived ratings land.

**2. A persistence round-trip contract, run against both adapters.**
`save(state) → load() → deepEqual(state)`. Run it against local and a Firestore
emulator. This is precisely the test that would have caught D-01 the moment it was
written — the key mismatch fails a round-trip immediately.

**3. Two or three end-to-end paths** (Playwright): log in → add player → play a
game → **reload** → the game is still there. The reload is the assertion that
matters; every data-loss bug in the log would have failed it.

Delete `src/App.test.js` — it has never passed and it makes `npm test` red by
default, which trains everyone to ignore the signal.

---

## 7. Intended workflows

Worth writing down, because several audit findings are really "the code doesn't
support the workflow the product implies".

### A. First-time setup (works today)

Open the site → choose Local or Google → set an admin password → add players →
play. Good flow. Two gaps: adding a duplicate player fails silently (L-13), and
there's no way to seed a roster in bulk — the JSON upload is the only path and it
requires knowing the internal shape.

> **Idea:** a "paste a list of names" box in Admin. Ten seconds instead of ten modals.

### B. Match day (the core loop, and where it hurts)

Two people walk up to the TV. Select two names, each types a password, Start Game,
play, `1` `1` to end.

The friction is the passwords. They exist to stop misclicks, but on a shared
device everyone knows everyone's PIN anyway (S-06), and typing on a TV is slow.

> **Idea:** make the PIN opt-in per player (`requirePin: false` by default), or
> replace it with a 3-second undo toast on the resulting match. The undo is
> strictly better: it fixes the actual problem (wrong name recorded) without
> friction, and §3's append-only log makes it exact.

Also missing here: **there is no way to correct a finished match.** The only tool is
an admin rating edit, which corrupts the stats graph (L-11). Delete-last-match plus
replay (§3) is the right primitive.

### C. Quit / abandon (broken — L-01)

Should return to the main screen with no rating effect. Currently does nothing and
strands the user. The `'Quit'` records that *do* exist in history are rendered as
"the game was quit" but carry no rank fields, which is why `formatGameResult` has to
special-case them.

### D. Admin session

Open Admin, adjust settings, exit. Currently: several settings do nothing
(L-04, L-05, L-08), changes need a page reload to take effect (L-03), and toggling
dark mode discards unsaved edits (D-04). The Game Settings form also has **no submit
button** — the only way to save is the "Save and Exit" button at the bottom, or
pressing Enter in a text field.

> **Idea:** a persistent "3 unsaved changes — Save / Discard" bar, and live preview
> for the visual settings. The scoreboard colours in particular are pointless
> without a preview — which is moot until L-05 makes them work at all.

### E. Season reset

"Reset All Scores" wipes season ratings but keeps lifetime. Sound idea, roughly
implemented (L-10) — no record of when a season started, so the stats graph draws a
continuous line across the discontinuity.

> **Idea:** name the seasons. "Q1 2026" with a frozen final table. You already store
> everything needed; this is presentation over existing data, and it gives the
> ladder stakes.

### F. Multi-device / sync

Advertised on the login screen ("allows for sync between computers"). In practice
concurrent devices overwrite each other (D-03) and nothing lives-updates — the TV
shows a stale leaderboard until someone reloads it.

> **Idea:** once §3 lands, subscribe with `onSnapshot`. The leaderboard on the wall
> then updates as matches are recorded from a phone, which is what "real-time
> scoreboard" in the README currently promises but doesn't do.

### G. Kiosk / unattended operation

This is a device bolted to a wall that nobody logs into for months. It needs:

- **An error boundary** (Q-10) — a white screen is an outage nobody can fix.
- **Offline tolerance.** Cloud mode has no retry queue; a Wi-Fi blip loses matches
  (D-02).
- **Session persistence.** Fine today, but D-06 can brick it permanently.
- **Screen-burn protection.** A static leaderboard on an OLED for months will ghost.
  `TIMER_INTERVAL` (L-08) was probably reaching for this — a periodic idle state
  would serve both purposes.

> **Idea:** an "attract mode" after N minutes idle — cycle the leaderboard,
> head-to-head records, longest streak, biggest upset of the week. It solves burn-in
> and makes the wall display interesting when nobody's playing.

---

## 8. Features the existing data already supports

No schema changes needed beyond §3 — these are all folds over the match log:

| Feature | Basis |
|---|---|
| **Head-to-head records** — "Alice leads Bob 12–7" | filter matches by pair |
| **Rivalry detection** — closest records, most-played pairs | pair frequency + margin |
| **Upset of the week** — biggest rating swing | `pointChange` is already stored |
| **Streak leaderboard** | `currentStreak` / `maxWinStreak` exist and are unused outside the stats dialog |
| **Rating history for everyone** | `scoreHistory` is stored per player; only one player's is ever plotted |
| **Time-of-day / day-of-week patterns** | `date` on every match |
| **Predicted win probability** shown at player-select time | `expectedScore` is already the ELO formula |
| **Skunk tracker** | detection logic already exists in `GameHistory.js:58`, but the 7–0 / 11–1 thresholds are hardcoded — make them settings |

The most valuable of these is probably **head-to-head**, because it's what people
actually argue about, and it's a pure query over data you already have.

---

## 9. Suggested sequencing

| Phase | Work | Rough effort |
|---|---|---|
| **0** | Triage §1 Step 0 — key rotation, history purge, D-01 one-liner | half a day |
| **1** | Triage §1 Step 1 — auth (§2), quit, atob guard, XSS, ELO snapshot, save flush | a weekend |
| **2** | Vite + `createRoot` + lazy chart (§5); delete dead files Q-04/Q-05 | a day |
| **3** | Rating tests + persistence round-trip (§6) — **before** touching the data model | a day |
| **4** | Data model migration (§3) and state ownership (§4) | a week, incremental |
| **5** | Settings that work, live sync, undo, workflow polish (§7) | ongoing |

Phase 3 sits before phase 4 deliberately: the round-trip test is what makes the
migration safe, and it is the test that would have caught the bug currently losing
everyone's games.
