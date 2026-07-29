# Ping Pong Pi — Architecture (as-built)

> This document describes how the app **actually works today**, not how it was
> intended to work. Where the two differ, the gap is marked ⚠ and cross-referenced
> to [AUDIT.md](AUDIT.md).
>
> Audited at commit `5653345` on branch `Webapp`.

---

## 1. What this is

A single-page React app that acts as a ping-pong scoreboard for a TV, plus an
ELO-style leaderboard and match history. It began life as a Python program on a
Raspberry Pi (vestiges: `__pycache__/settings.cpython-312.pyc`, `src/settings1.js`)
and was rewritten as a React web app deployed to Vercel at `pingpongpi.com`.

The intended physical setup is a Pi wired to a TV with a numeric keypad or button
box: keys `7`/`8` and `4`/`5` adjust the two scores, `1` ends the game, `3` quits.

---

## 2. Runtime topology

```
                    ┌──────────────────────────────────────────┐
   Browser / TV     │  React SPA (CRA 5, React 18)             │
                    │                                          │
                    │  index.js                                │
                    │   └─ SettingsProvider ──┐                │
                    │       └─ App            │ two independent│
                    │           └─ ThemeProvider   reads of    │
                    │               └─ screens     the same    │
                    │                             data ⚠ D-07  │
                    │  dataService  ← module-level singleton   │
                    └───────┬──────────────────────┬───────────┘
                            │                      │
            isLocalMode=true│                      │isLocalMode=false
                            ▼                      ▼
                 ┌──────────────────┐   ┌────────────────────────────┐
                 │ localStorage     │   │ GET  /api/getData?userId=  │
                 │  localGameData   │   │ POST /api/saveData         │
                 │  (whole DB blob) │   │        (no auth ⚠ S-03)    │
                 └──────────────────┘   └─────────────┬──────────────┘
                                                      │
                                        ┌─────────────▼──────────────┐
                                        │ Vercel serverless          │
                                        │  api/index.js (express)    │
                                        │  firebase-admin SDK        │
                                        └─────────────┬──────────────┘
                                                      │
                                        ┌─────────────▼──────────────┐
                                        │ Firestore                  │
                                        │  collection "pingpong"     │
                                        │   └ doc "data"             │
                                        │      └ users: { … }        │
                                        │   ONE DOC FOR EVERY USER   │
                                        └────────────────────────────┘
```

Firebase Auth (Google popup) runs **entirely in the browser**. The server never
sees or verifies an ID token. Auth is a UI gate, not a security boundary. ⚠ S-03

---

## 3. Source map

| Path | Role | Notes |
|---|---|---|
| `src/index.js` | Mount point | Uses legacy `ReactDOM.render` ⚠ Q-01 |
| `src/App.js` | Screen router + all top-level state | `login` / `main` / `game` / `admin` |
| `src/services/dataService.js` | **Everything**: model, persistence, ELO, HTTP | 658 lines, singleton |
| `src/contexts/SettingsContext.js` | Boot-time settings snapshot | Never refreshes ⚠ L-03 |
| `src/contexts/ThemeContext.js` | Dark/light, writes `data-theme` on `<html>` | |
| `src/context/ThemeContext.js` | **Dead duplicate** of the above | ⚠ Q-06 |
| `src/config/api.js` | Base URL selection | Wrong dev port ⚠ L-15 |
| `src/config/firebase.js` | Firebase client init | |
| `src/components/Scoreboard.js` | The game screen, keyboard handler | |
| `src/components/Leaderboard.js` | Ranked + unranked tables | |
| `src/components/GameHistory.js` | Match feed | Renders raw HTML ⚠ S-05 |
| `src/components/AdminControls.js` | Settings, player edits, import/export | |
| `src/components/LoginScreen.js` | Google vs. local-storage choice | |
| `src/components/LifetimeStatsDialog.js` | Per-player stats + recharts graph | |
| `api/index.js` | Express app (Vercel entry) | `cors: *` ⚠ S-04 |
| `api/getData.js` / `api/saveData.js` | The entire backend, 65 lines total | |
| `server.js` | Local dev server on :3001 | |
| `public/data/data.json` | **A production database dump** | ⚠ S-02 |

**Dead weight** (imported by nothing): `src/settings1.js`, `src/logo.svg` (0 bytes),
`src/reportWebVitals.js`, `src/components/UserAccount.{js,css}`,
`src/styles/InputModal.css`, `src/context/ThemeContext.js`, `__pycache__/`, `.idea/`.

---

## 4. Data model

One Firestore document (`pingpong/data`) holds every user of the entire product:

```jsonc
{
  "users": {
    "someone@gmail_DOT_com": {          // '.' → '_DOT_' so it's a legal map key
      "settings": {
        "SCORE_CHANGE_K_FACTOR": 70,    // base ELO K
        "POINT_DIFFERENCE_WEIGHT": 6,   // K += pointDiff * this
        "ACTIVITY_THRESHOLD": 3,        // ⚠ L-04 ignored, hardcoded to 3
        "DEFAULT_RANK": "Unranked",
        "PLAYER1_SCOREBOARD_COLOR": "#4CAF50",  // ⚠ L-05 never read
        "PLAYER2_SCOREBOARD_COLOR": "#2196F3",  // ⚠ L-05 never read
        "GAME_HISTORY_KEEP": 30,
        "ADDPLAYER_ADMINONLY": false,
        "DISABLE_WIN_ANIMATION": false,
        "ADMIN_PASSWORD": "hunter2"     // ⚠ S-06 plaintext, served to any client
      },
      "players": {
        "Alice": {
          "name": "Alice",
          "password": "1234",           // ⚠ S-06 plaintext
          "score": 1043.7,              // season score, reset by "Reset All Scores"
          "lifetimeScore": 1102.4,      // never reset, floored at 100
          "gamesPlayed": 12, "wins": 8, "losses": 4,
          "lifetimeGamesPlayed": 40, "lifetimeWins": 25, "lifetimeLosses": 15,
          "currentStreak": 3, "maxWinStreak": 6,
          "active": true,               // derived: gamesPlayed >= 3
          "scoreHistory": [1000, 1012.3, …]   // lifetimeScore over time
        }
      },
      "gameHistory": [
        { "player1": "Alice", "player2": "Bob", "score": "11 - 7",
          "player1Rank": 1, "player2Rank": 4,
          "pointChange1": 21.4, "pointChange2": -19.8,
          "date": "2025-02-15T18:04:11.000Z" }
      ]
    }
  }
}
```

Notes on the shape:

- **A "user" is an account owner** (the person who logs in with Google). A
  **"player"** is a name on the leaderboard. One user owns many players.
- `players` is a **map keyed by display name**, so renaming a player is impossible
  and two people can never share a name.
- `gameHistory` is truncated to `GAME_HISTORY_KEEP` on every write
  (`dataService.js:257`). Lowering that setting **permanently destroys** the
  trimmed matches on the next save — there is no archive.
- Player objects are rehydrated into the `Player` class on load via
  `Object.assign(new Player(...), playerData)` (`dataService.js:139-146`), which is
  what keeps old records working when new fields are added.

---

## 5. The two storage modes

`dataService.isLocalMode` (mirrored in `localStorage.isLocalMode`) switches every
read and write between two completely separate code paths.

| | **Local mode** | **Cloud mode** |
|---|---|---|
| Chosen at | "Use Local Storage" button | "Login with Google" button |
| Identity | literal string `local_user` | Google account email |
| Store | `localStorage.localGameData` | Firestore `pingpong/data` |
| Write timing | synchronous, immediate | debounced 1000 ms ⚠ D-02 |
| Multi-device | no | yes, but last-write-wins ⚠ D-03 |
| Quit Game | broken ⚠ L-01 | broken ⚠ L-01 |
| Erase Account | works | broken ⚠ D-05 |

Switching from local to Google **deletes** `localGameData` after a `confirm()`
(`LoginScreen.js:74-87`). Switching back is not offered; there is no merge or
migration path in either direction other than the manual JSON download/upload in
Admin → Data Management.

---

## 6. Boot sequence (what actually happens on load)

```
1. index.html paints #initial-loader (hidden on window 'load', not on React mount)
2. dataService.js module executes
     └─ new DataService()
          └─ atob(localStorage.currentUser)   ⚠ D-06 unguarded, can throw here
                                                 and brick the whole bundle
3. SettingsProvider mounts, fires its effect  ──┐
4. App mounts, fires its effect                 ├─ both call dataService.loadData()
                                                │  concurrently, and both write to
                                                │  the SAME singleton ⚠ L-03 / D-07
     App effect:
       - no currentUser?  → render <LoginScreen>, stop
       - dataService.setCurrentUser(user)   → localStorage.currentUser = btoa(user)
       - dataService.loadData()             → fills players/settings/gameHistory
       - copy into React state
       - no ADMIN_PASSWORD? → <AdminPasswordPrompt>
       - else                → screen 'main'
```

`SettingsProvider`'s copy of `settings` is captured **once, here, forever**. Nothing
invalidates it. Everything that reads `useSettings()` — `ADDPLAYER_ADMINONLY` in
`App.js:307`, `DISABLE_WIN_ANIMATION` in `Scoreboard.js:43`, `DEFAULT_RANK` in
`Leaderboard.js:20` — is reading a boot-time snapshot. ⚠ L-03

---

## 7. Screen flow

```
        ┌──────────────┐
        │ LoginScreen  │  (rendered by an early return in App.js:75-77,
        └──────┬───────┘   outside ThemeProvider)
               │ Google  /  Local
               ▼
     ┌────────────────────┐   first run, no ADMIN_PASSWORD
     │ AdminPasswordPrompt│◄──────────────────────────────┐
     └─────────┬──────────┘                               │
               ▼                                          │
        ┌──────────────┐  "Admin" + password        ┌─────┴──────────┐
        │  main        │ ─────────────────────────► │ AdminControls  │
        │  leaderboard │ ◄───────────────────────── │                │
        │  + history   │      "Save and Exit"       └────────────────┘
        └──────┬───────┘
               │ pick 2 players (each needs its own password), "Start Game"
               ▼
        ┌──────────────┐
        │  Scoreboard  │  keys 7/8 = P1 ±1, 4/5 = P2 ±1
        │              │  key 1 ×2 = End Game  → records result, ELO, history
        │              │  key 3 ×2 = Quit Game → ⚠ L-01 does nothing
        └──────────────┘
```

`currentScreen` also has a `'login'` value that is set but never rendered — the
login screen is selected by the `!currentUser` early return instead. The
`!currentUser` and loading branches inside the main `return` (`App.js:265-274`) are
**unreachable**, because the early returns above them already handled those cases.

---

## 8. The rating system

Implemented in `Player.updateScore` / `Player.calculateScoreChange`
(`dataService.js:22-80`).

```
expected   = 1 / (1 + 10^((opponentScore - myScore) / 450))
K          = SCORE_CHANGE_K_FACTOR + pointDifference × POINT_DIFFERENCE_WEIGHT
change     = K × (result − expected)
if upset (expected < 0.45 and won) or (expected > 0.65 and lost):
             change × 1.3
```

Modifiers layered on top of `K`:

| Situation | K becomes |
|---|---|
| both players unranked | `K × 1.2` |
| I am unranked, opponent ranked | `K × 1.2` |
| I am ranked, opponent unranked | `20` (flat — discards point difference) |

Two ratings are maintained per player: `score` (the season number, wiped by "Reset
All Scores") and `lifetimeScore` (never wiped, floored at 100, plotted in the stats
dialog). `active` — whether you appear in the ranked table at all — is
`gamesPlayed >= 3`, hardcoded. ⚠ L-04

The divisor `450` (vs. chess's 400) flattens the curve slightly, so upsets cost the
favourite a little less than standard ELO. Combined with `K = 70 + 6×pointDiff`, an
11–0 blowout can swing **136 points**, which is why ratings move so violently.

⚠ **The implementation is not zero-sum.** `recordGame` updates the winner first,
then the loser — and the loser's expectation is computed against the winner's
*already-updated* rating (`dataService.js:240-241`). Two evenly matched active
players trading an 11–9 game create **+4.29 points out of nothing**. See L-02.

---

## 9. Persistence lifecycle

```
recordGame()
  ├─ mutate both Player objects in place
  ├─ append to gameHistory, slice(-GAME_HISTORY_KEEP)
  └─ local?  localStorage.setItem(...)          ← synchronous, safe
     cloud?  debouncedSave()                    ← setTimeout 1000ms
                └─ saveData()
                     └─ POST /api/saveData with the ENTIRE user document
                          └─ server: read whole doc, spread, write whole doc
```

Consequences of this design, all of which show up in the commit log as "fixed
critical data wipe bug" / "fixed duplicate game history bug" / "fixed player save
data bug":

- **Nothing is atomic.** Every save is a full-document overwrite of everything the
  user owns. Two browsers on the same account silently overwrite each other. ⚠ D-03
- **A 1-second loss window** on every write, with no `beforeunload` flush. Turn the
  TV off right after a match and the match is gone. ⚠ D-02
- **Re-reads clobber unsaved work.** `getPlayers()` / `getSettings()` call
  `loadData()`, which replaces the in-memory singleton wholesale. `AdminControls`
  does this on every dark-mode toggle. ⚠ D-04
- ⚠ **In cloud mode, saves currently land in a different Firestore key than reads.**
  The write key is `btoa(email)`; the read key is `email.replace('.','_DOT_')`.
  They have not matched since commit `7378d8d`, so every cloud-mode match is
  written to an orphan document and lost on reload. This is the single most
  damaging bug in the codebase. ⚠ **D-01**

---

## 10. Build & deploy

- `npm start` — CRA dev server on :3000, proxying `/api/*` to :3001 via the
  `proxy` field. `npm run dev` runs that plus `server.js` concurrently.
- `npm run build` → `build/`, ~215 KB gzipped JS.
- Vercel: legacy `builds` config in `vercel.json`; `api/index.js` becomes a Node
  serverless function, everything else is static, with a catch-all rewrite to
  `index.html`.
- Secrets come from Vercel project env vars in production and `.env` / `.env.local`
  locally. ⚠ `.env` is committed and public — see S-01.

---

## 11. What's good here

Worth stating plainly, since the rest of this document is a list of problems:

- The **local-storage mode is a genuinely good idea** — the app is fully usable with
  zero backend, which is exactly right for a device bolted to a wall.
- **Player rehydration via `Object.assign` onto a fresh `Player`** is a simple,
  effective schema-migration strategy that has clearly saved older saves more than once.
- The **keyboard-first control scheme** (single digits, double-press to confirm
  destructive actions, on-screen confirmation text) is well matched to a keypad
  bolted next to a TV.
- **JSON export/import** in the admin panel is the reason the data-loss bugs have
  been survivable.
- The **two-tier rating** (season `score` + `lifetimeScore`) is a thoughtful design
  that most hobby leaderboards get wrong.
- `vh`-based sizing throughout the scoreboard means it genuinely scales to any TV.
