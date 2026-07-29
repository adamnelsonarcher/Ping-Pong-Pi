# Ping Pong Pi — Architecture

How the app works. Where a design has a history worth knowing, it is noted inline
with a pointer to [AUDIT.md](AUDIT.md); [FIXES.md](FIXES.md) tracks what has been
addressed.

Structural work that is still outstanding is marked ⚠ and cross-referenced to
[ROADMAP.md](ROADMAP.md).

---

## 1. What this is

A single-page React app that acts as a ping-pong scoreboard for a TV, plus an
ELO-style leaderboard and match history. It began life as a Python program on a
Raspberry Pi and was rewritten as a React web app deployed to Vercel at
`pingpongpi.com`.

The intended physical setup is a Pi wired to a TV with a numeric keypad or button
box: keys `7`/`8` and `4`/`5` adjust the two scores, `1` ends the game, `3` quits.

---

## 2. Runtime topology

```
                    ┌──────────────────────────────────────────┐
   Browser / TV     │  React SPA (CRA 5, React 18)             │
                    │                                          │
                    │  index.js                                │
                    │   └─ ErrorBoundary                       │
                    │       └─ ThemeProvider                   │
                    │           └─ SettingsProvider ──┐        │
                    │               └─ App            │ both   │
                    │                   └─ screens    │ read   │
                    │                                 │ from   │
                    │  dataService ◄──────────────────┘ one    │
                    │   (singleton + subscribe/notify)  source  │
                    └───────┬──────────────────────┬───────────┘
                            │                      │
            isLocalMode=true│                      │isLocalMode=false
                            ▼                      ▼
                 ┌──────────────────┐   ┌────────────────────────────┐
                 │ localStorage     │   │ Authorization: Bearer <ID> │
                 │  localGameData   │   │  GET  /api/getData         │
                 │  (whole DB blob) │   │  POST /api/saveData        │
                 │                  │   │  POST /api/deleteAccount   │
                 └──────────────────┘   └─────────────┬──────────────┘
                                                      │
                                        ┌─────────────▼──────────────┐
                                        │ Vercel serverless          │
                                        │  api/index.js (express)    │
                                        │  _auth.js verifies token   │
                                        │  → account key from email  │
                                        └─────────────┬──────────────┘
                                                      │
                                        ┌─────────────▼──────────────┐
                                        │ Firestore                  │
                                        │  pingpong/data             │
                                        │   └ users: { <key>: {…} }  │
                                        │   ⚠ still one doc, ROADMAP§3│
                                        └────────────────────────────┘
```

**Identity comes from the token, never from the request.** Every API call carries a
Firebase ID token; `api/_auth.js` verifies it and returns the decoded claims, and
the handlers derive the storage key from `decoded.email` via `api/userKey.js`.
There is no `userId` query parameter and no `currentUser` body field — a client
cannot name an account, only prove which one it is.

This is the single most important structural property of the current design. It
closes S-03 (anyone could read or overwrite any account) and makes D-01 (reads and
writes using different key encodings) impossible rather than merely fixed, because
there is now exactly one place the key is computed.

---

## 3. Source map

| Path | Role |
|---|---|
| `src/index.js` | `createRoot`, provider stack, removes the static loader |
| `src/App.js` | Screen router, top-level UI state, subscribes to `dataService` |
| `src/services/rating.js` | **Pure** rating maths. No I/O, no mutation. Fully tested. |
| `src/services/dataService.js` | State + persistence singleton, with subscribe/notify |
| `src/contexts/SettingsContext.js` | Live mirror of `dataService.settings` |
| `src/contexts/ThemeContext.js` | Dark/light, writes `data-theme` on `<html>` |
| `src/config/api.js` | Base URL (relative in both environments) |
| `src/config/firebase.js` | Firebase client init + `authReady` |
| `src/components/ErrorBoundary.js` | Root crash handler with recovery actions |
| `src/components/Toast.js` | Transient messages (replaced every `alert()`) |
| `src/components/Scoreboard.js` | The game screen and keyboard handler |
| `src/components/Leaderboard.js` | Ranked + unranked tables; lazy-loads the stats dialog |
| `src/components/GameHistory.js` | Match feed, rendered as JSX |
| `src/components/AdminControls.js` | Settings, player edits, undo, import/export |
| `src/components/LifetimeStatsDialog.js` | Per-player stats + chart (lazy chunk) |
| `api/_auth.js` | Token verification |
| `api/userKey.js` | **The** account-key encoding, shared by handlers and tests |
| `api/getData.js` / `saveData.js` / `deleteAccount.js` | The backend |
| `api/index.js` | Express app (Vercel entry, CORS) |
| `server.js` | Local dev server; serves the same express app |

Tests live next to what they test: `src/services/rating.test.js` and
`src/services/dataService.test.js`.

---

## 4. Data model

One Firestore document (`pingpong/data`) holds every account. ⚠ This is the main
piece of structural debt left — see [ROADMAP.md §3](ROADMAP.md).

```jsonc
{
  "users": {
    "someone@gmail_DOT_com": {          // api/userKey.js: '.' → '_DOT_'
      "settings": {
        "SCORE_CHANGE_K_FACTOR": 70,    // base ELO K
        "POINT_DIFFERENCE_WEIGHT": 6,   // K += pointDiff * this
        "ACTIVITY_THRESHOLD": 3,        // games needed to become ranked
        "DEFAULT_RANK": "Unranked",
        "PLAYER1_SCOREBOARD_COLOR": "#4CAF50",
        "PLAYER2_SCOREBOARD_COLOR": "#2196F3",
        "GAME_HISTORY_KEEP": 30,        // display limit only
        "ADDPLAYER_ADMINONLY": false,
        "DISABLE_WIN_ANIMATION": false,
        "ADMIN_PASSWORD": "hunter2"     // ⚠ plaintext, AUDIT S-06
      },
      "players": {
        "Alice": {
          "name": "Alice",
          "password": "1234",           // optional; anti-misclick, not security
          "score": 1043.7,              // season score, cleared by "Reset All Scores"
          "lifetimeScore": 1102.4,      // never reset, floored at 100
          "gamesPlayed": 12, "wins": 8, "losses": 4,
          "lifetimeGamesPlayed": 40, "lifetimeWins": 25, "lifetimeLosses": 15,
          "currentStreak": 3, "maxWinStreak": 6,
          "active": true,               // derived from ACTIVITY_THRESHOLD on load
          "scoreHistory": [1000, 1012.3, …]   // lifetimeScore over time
        }
      },
      "gameHistory": [
        { "player1": "Alice", "player2": "Bob", "score": "11 - 7",
          "player1Rank": 1, "player2Rank": 4,     // pre-match standings
          "pointChange1": 21.4, "pointChange2": -21.4,
          "date": "2026-07-29T18:04:11.000Z" }
      ]
    }
  }
}
```

Notes on the shape:

- **A "user" is an account owner** (whoever signs in with Google). A **"player"** is
  a name on the leaderboard. One user owns many players.
- `players` is keyed by display name, so a player cannot be renamed and two people
  cannot share a name. ⚠ [ROADMAP.md §3](ROADMAP.md).
- `gameHistory` keeps everything. `GAME_HISTORY_KEEP` is applied at render time by
  `getGameHistory()`; `MAX_STORED_HISTORY` (1000) is a document-size guard, not a
  user setting.
- `active` is recomputed from the current `ACTIVITY_THRESHOLD` every time data
  loads or settings change, rather than trusting the stored flag.
- Player records are rehydrated into the `Player` class by `_hydrate()`, which also
  normalises fields added in later versions. That is what keeps old saves working.

---

## 5. The two storage modes

`dataService.isLocalMode` (mirrored in `localStorage.isLocalMode`) switches every
read and write.

| | **Local mode** | **Cloud mode** |
|---|---|---|
| Chosen at | "Use Local Storage" | "Login with Google" |
| Identity | literal `local_user` | verified Google account |
| Store | `localStorage.localGameData` | Firestore, keyed by verified email |
| Write timing | debounced 1s, then synchronous | debounced 1s, retried twice |
| Flush on unload | yes | yes, via `fetch(keepalive)` |
| Multi-device | no | yes; ⚠ same-account writes still last-wins |
| Erase account | clears localStorage | scoped server-side delete |

Switching from local to Google leaves the local save in place but unused, after a
confirmation. To move data between modes, use Admin → Data Management → Download,
then Upload in the other mode.

---

## 6. Boot sequence

```
1. index.html paints #initial-loader
2. dataService.js module executes
     └─ new DataService()
          └─ readStoredUser()  — guarded; migrates legacy base64; never throws
3. React renders; index.js removes #initial-loader
     ErrorBoundary → ThemeProvider → SettingsProvider → App

     SettingsProvider: subscribes to dataService. Loads nothing.
     App effect (the only loader):
       - no currentUser?  → <LoginScreen>, stop
       - setLocalMode from localStorage
       - dataService.setCurrentUser(user) → loadData()
            cloud: await authReady, then GET /api/getData with a Bearer token
            local: read localGameData
       - no ADMIN_PASSWORD? → <AdminPasswordPrompt>
       - else → screen 'main'
```

`App` reads players, leaderboard and history straight from `dataService` on every
render, re-rendering via `useSyncExternalStore`. There is no second copy to drift
out of sync — which is what used to make admin edits invisible on the leaderboard
and settings changes appear to do nothing (AUDIT L-03, D-04, D-07).

`authReady` matters: Firebase restores a persisted session asynchronously, so
`auth.currentUser` is null for the first moments after a reload. Requests await it
before reading a token.

---

## 7. Screen flow

```
        ┌──────────────┐
        │ LoginScreen  │
        └──────┬───────┘
               │ Google  /  Local
               ▼
     ┌────────────────────┐   first run, no ADMIN_PASSWORD
     │ AdminPasswordPrompt│◄──────────────────────────────┐
     └─────────┬──────────┘                               │
               ▼                                          │
        ┌──────────────┐  "Admin" + password        ┌─────┴──────────┐
        │  main        │ ─────────────────────────► │ AdminControls  │
        │  leaderboard │ ◄───────────────────────── │                │
        │  + history   │        "Exit"              └────────────────┘
        └──────┬───────┘
               │ pick 2 players (password only if that player set one)
               ▼
        ┌──────────────┐
        │  Scoreboard  │  7/8 = P1 ±1, 4/5 = P2 ±1
        │              │  1 ×2 = End Game  → records result, ELO, history
        │              │  3 ×2 = Quit Game → records an abandoned game
        └──────────────┘
```

Both End and Quit return to the main screen and clear the player selection.

---

## 8. The rating system

Implemented in `src/services/rating.js` as pure functions.

```
expected   = 1 / (1 + 10^((opponentScore - myScore) / 450))
K          = SCORE_CHANGE_K_FACTOR + pointDifference × POINT_DIFFERENCE_WEIGHT
change     = K × (result − expected)
if upset:    change × 1.3
```

An upset is a win where your expectation was below 0.45, or a loss where it was
above 0.65. K is modified per player:

| Situation | K |
|---|---|
| I am unranked | `K × 1.2` |
| I am ranked, opponent unranked | `20` (flat) |
| both ranked | `K` |

Two ratings are maintained: `score` (the season number, cleared by "Reset All
Scores") and `lifetimeScore` (never cleared, floored at 100, plotted in the stats
dialog). `active` — whether you appear in the ranked table — is
`gamesPlayed >= ACTIVITY_THRESHOLD`.

**Matches are computed from a snapshot.** `computeMatchDeltas` takes plain
`{score, lifetimeScore, active}` views of both players captured *before* either is
modified, so the result is symmetric and does not depend on evaluation order. This
is the fix for AUDIT L-02, where updating the winner first meant the loser was
scored against the winner's already-updated rating — inventing about 4.3 points of
rating on every evenly-matched game and systematically favouring winners.

Outside the upset band the system is exactly zero-sum, and there is a test pinning
that. Inside the band — roughly a 40-to-120-point rating gap — the underdog
receives the 1.3× bonus while the favourite does not yet pay it, so a small amount
of rating enters the pool. That asymmetry is intentional; the test
`leaks rating into the pool only when one side qualifies for the bonus` documents
both edges of it so nobody mistakes it for the old bug.

The `450` divisor (chess uses 400) slightly flattens the curve. With
`K = 70 + 6 × pointDiff`, an 11-0 can swing 136 points, which is why ratings move
so fast.

---

## 9. Persistence lifecycle

```
recordGame()  /  quitGame()  /  addPlayer()  /  updateSettings()  …
  ├─ mutate in-memory state
  ├─ _emit()          → bumps version, notifies subscribers, React re-renders
  └─ scheduleSave()   → debounced 1s, returns a promise that resolves on write

     saveData()
       local: localStorage.setItem
       cloud: POST /api/saveData with a Bearer token, 2 retries with backoff
                └─ server: scoped merge write to users.<key> only

     flush()          → write now; called on pagehide with keepalive:true
```

Properties worth knowing:

- **Saves are awaitable.** `scheduleSave()` returns a real promise. The old
  `debouncedSave()` returned `undefined`, so `await debouncedSave()` waited for
  nothing (AUDIT D-02).
- **The last match before shutdown survives.** A `pagehide` listener flushes with
  `keepalive: true`, so a game recorded seconds before the TV goes off still lands.
- **Failures surface.** After two retries, `lastSaveError` is set and subscribers
  are notified, rather than the error being swallowed.
- **Writes are scoped.** The server merges into `users.<key>` only. It no longer
  reads the whole document into memory and writes it back, so one account can no
  longer clobber another.
- ⚠ **Same-account concurrency is still last-write-wins.** Two browsers signed into
  the same account will overwrite each other's matches. That needs the per-entity
  model in [ROADMAP.md §3](ROADMAP.md).

---

## 10. Build & deploy

- `npm start` — CRA dev server on :3000, proxying `/api/*` to :3001.
- `npm run dev` — that plus `server.js`, which serves the same express app as
  production.
- `npm test` — 44 tests. `npm run build` → `build/`, ~93 KB gzipped initial JS plus
  a ~104 KB chart chunk loaded on demand.
- Vercel: `api/index.js` becomes a Node serverless function; everything else is
  static, with a catch-all rewrite to `index.html`.
- Secrets come from Vercel project env vars in production and `.env.local` locally.
  See `.env.example`. ⚠ The previously committed key must still be rotated — see
  [FIXES.md](FIXES.md).

---

## 11. What's good here

- The **local-storage mode** is a genuinely good idea — fully usable with no
  backend, which is right for a device bolted to a wall.
- **Player rehydration through a constructor plus field normalisation** is a simple,
  effective schema-migration strategy that has repeatedly saved older data.
- The **keyboard-first control scheme** — single digits, double-press to confirm
  destructive actions, on-screen confirmation text — is well matched to a keypad
  next to a TV.
- **JSON export/import** is why the historical data-loss bugs were survivable.
- The **two-tier rating** (season + lifetime) is a thoughtful design most hobby
  leaderboards get wrong.
- `vh`-based sizing throughout the scoreboard means it scales to any TV.
