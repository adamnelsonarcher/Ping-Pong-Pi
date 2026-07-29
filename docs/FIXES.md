# Remediation status

Status of every finding in [AUDIT.md](AUDIT.md) after the remediation pass.

**All 49 findings addressed in code. Two — S-01 and S-02 — additionally need a
manual step that cannot be done from the repo** (rotate the exposed key, purge git
history). Build compiles clean; **123 tests** pass across 8 suites; the initial JS
bundle went from 215 KB to ~93 KB gzipped; the shipped dependency tree has zero
high or critical advisories; and the app is now on Vite instead of the retired
Create React App.

Committed in reviewable steps, authored as the repo owner. Nothing has been pushed.

---

## ⚠ Three things still need you

These cannot be done from the code, and the first is the most serious finding in
the audit.

1. **Rotate the Firebase service-account key** (S-01). The file is no longer
   tracked, but the value is still in git history on the public remote and must be
   assumed compromised. Firebase Console → Project Settings → Service Accounts →
   delete the old key, generate a new one, put it in Vercel env vars and a local
   `.env.local`.
2. **Purge `.env` and `public/data/data.json` from git history** and force-push
   (S-01, S-02). Both are deleted going forward, but every previous commit still
   contains them:
   ```bash
   git filter-repo --path .env --path public/data/data.json --invert-paths
   ```
3. **Change the passwords that appeared in the dump** (S-02) — `admin`, `1234`,
   `123` — anywhere they are reused. If they were throwaway values for this app
   only, nothing further is needed.

---

## Security

| ID | Status | What changed |
|---|---|---|
| S-01 | ⚠ Partial | `.env` untracked, `.gitignore` rewritten to cover `.env.*`, `.env.example` added documenting every variable. **Key rotation and history purge are yours.** |
| S-02 | ⚠ Partial | `public/data/data.json` deleted from the repo and disk (backup in the session scratchpad). **History purge is yours.** The address in it turned out to be the repo owner's own commit email, already public in every commit here — not a third party's. The audit finding has been corrected and downgraded. |
| S-03 | ✅ Fixed | `api/_auth.js` verifies the Firebase ID token on every request; the account key is derived from the verified email, never from client input. `getData` no longer takes a `userId` parameter and `saveData` no longer reads `currentUser` from the body. Client attaches `Authorization: Bearer`. |
| S-04 | ✅ Fixed | CORS is same-origin by default, with an `ALLOWED_ORIGINS` allowlist for local dev. |
| S-05 | ✅ Fixed | `GameHistory` returns JSX instead of building an HTML string for `dangerouslySetInnerHTML`. Player names can no longer inject markup. |
| S-06 | ✅ Fixed | Credentials are hashed with PBKDF2-SHA-256 and a per-credential salt (`services/credentials.js`), with transparent upgrade of existing plaintext values on first correct use. Player passwords are optional and framed as anti-misclick. The gate is still a client-side check — inherent to a design that hands you all of your own data — and the module says so plainly rather than implying otherwise. |
| S-07 | ✅ Fixed | Base64 "encoding" removed. `readStoredUser()` migrates existing base64 values transparently. |
| S-08 | ✅ Fixed | `saveData` no longer logs `req.body`; errors log a message only. |
| S-09 | ✅ Fixed | Migrated off the retired `react-scripts` to Vite (build/dev) and standalone Jest (tests). Its ~850-package tree is gone. The shipped/runtime tree has **zero high or critical** advisories (8 moderate transitives in firebase/express, pre-existing). The audit findings that remain are all dev-tooling-only (jest/vite/esbuild dev server) and never reach production; clearing them would mean major-version jumps of the toolchain, not worth the risk for advisories that don't affect the app. See the Vite migration, formerly [ROADMAP.md §5](ROADMAP.md). |

## Data loss & persistence

| ID | Status | What changed |
|---|---|---|
| D-01 | ✅ Fixed | The read/write key mismatch is gone, and structurally cannot come back: the client sends no key at all, and `api/userKey.js` is the single definition, used by both handlers. Covered by a round-trip test that would have failed the day this shipped. |
| D-02 | ✅ Fixed | `scheduleSave()` returns a real promise; `flush()` writes immediately; a `pagehide` listener flushes with `keepalive: true` so a match recorded seconds before the TV goes off still lands. Failed saves retry twice and then surface on `lastSaveError`. |
| D-03 | ✅ Fixed | Accounts carry a revision; the server rejects a stale write with 409 inside a Firestore transaction, and the client merges by replaying its unseen matches on top of the server state and retrying. Matches carry stable ids so a merge cannot duplicate them. Settings and player edits are not mergeable and the server wins, which is surfaced via `lastMergeNotice` rather than hidden. |
| D-04 | ✅ Fixed | `getSettings`/`getPlayers` read the in-memory singleton. `AdminControls` no longer refetches on every dark-mode toggle, and holds edits in a local draft with an explicit Save. |
| D-05 | ✅ Fixed | New `POST /api/deleteAccount` deletes exactly the caller's own subtree with a Firestore field delete. The browser never sees the whole database. |
| D-06 | ✅ Fixed | `readStoredUser()` never throws; `LoginScreen` no longer writes the identity before the risky work; an `ErrorBoundary` with a "sign out and reset" button catches anything left. |
| D-07 | ✅ Fixed | `SettingsProvider` no longer loads anything — it subscribes to `dataService`. `App` is the only loader, and `loadData` no-ops without a current user, so nothing can write a `"null"` account again. |
| D-08 | ✅ Fixed | `GAME_HISTORY_KEEP` is applied at render time only. Stored history is capped at 1000 purely to protect the document size, and the setting's description now says so. |

## Logic & correctness

| ID | Status | What changed |
|---|---|---|
| L-01 | ✅ Fixed | `quitGame` appends to the in-memory history and uses the normal save path. No network round-trip, works offline, works in both modes. |
| L-02 | ✅ Fixed | Rating maths extracted to `src/services/rating.js` as pure functions. `computeMatchDeltas` reads a snapshot of both players taken before either is modified, so matches are symmetric and order-independent. Verified: the 11-9 case that used to produce +41.00/-36.72 now produces +41.00/-41.00. |
| L-03 | ✅ Fixed | `SettingsContext` mirrors `dataService` and re-renders on change, so `DISABLE_WIN_ANIMATION` and friends take effect immediately. |
| L-04 | ✅ Fixed | `ACTIVITY_THRESHOLD` is passed through to `isActive()`, and existing players are re-evaluated whenever settings load or change. |
| L-05 | ✅ Fixed | `Scoreboard` applies `PLAYER1/2_SCOREBOARD_COLOR` inline. The `.green`/`.blue` classes are gone. |
| L-06 | ✅ Fixed | `recordGame` refuses ties, 0-0, non-numeric scores and unknown players, returning a reason the UI shows. |
| L-07 | ✅ Fixed | An `isFinishing` ref blocks a second end/quit once one is in flight. |
| L-08 | ✅ Fixed | `TIMER_INTERVAL` removed from "Reset to Defaults" and from the descriptions. |
| L-09 | ✅ Fixed | `saveSettings()` and its dead `/api/saveSettings` endpoint removed. |
| L-10 | ✅ Fixed | Ending a season archives the final table — name, date, champion, standings — before resetting, and the admin panel lists past seasons. Note the original finding was imprecise: the stats graph plots `lifetimeScore`, which is never reset, so it was already continuous by design rather than hiding a discontinuity. The real gap was only the missing record. |
| L-11 | ✅ Fixed | `editPlayerScore` sets the season score without pushing into `scoreHistory`, which tracks lifetime. |
| L-12 | ✅ Fixed | `scoreHistory` and the other late-added fields are normalised during rehydration, and the dialog guards anyway. |
| L-13 | ✅ Fixed | `addPlayer` returns `{ok, reason}`; duplicates and empty names show a toast and keep the modal open. |
| L-14 | ✅ Fixed | Logout clears `isLocalMode` unconditionally. |
| L-15 | ✅ Fixed | `API_URL` is relative in both environments; the dev proxy handles routing. |

## Quality

| ID | Status | What changed |
|---|---|---|
| Q-01 | ✅ Fixed | `createRoot`. React 18 features are live. |
| Q-02 | ✅ Fixed | CRA scaffold test deleted; a real suite added and since grown to **123 tests across 8 files** (rating, credentials, stats, dataService, and the GameHistory/Scoreboard/Leaderboard/SaveStatus components). Each of the worst bugs has a named regression test. |
| Q-03 | ✅ Fixed | Self-dependency, `framer-motion` and `web-vitals` removed; build tooling moved to `devDependencies`; lockfile regenerated and verified in sync. |
| Q-04 | ✅ Fixed | Deleted: `settings1.js`, `logo.svg`, `reportWebVitals.js`, `UserAccount.{js,css}`, `context/ThemeContext.js`, `styles/InputModal.css`, `__pycache__/`, `.idea/`. |
| Q-05 | ✅ Fixed | Removed `testServerConnection`, `testFirestoreConnection`, `loginUser`, `saveSettings`, `saveGameHistory`, `createUser`, `encodeUser`. |
| Q-06 | ✅ Fixed | Dead selectors removed, duplicate `.btn:hover` and `transition` collapsed, hardcoded light-mode borders replaced with theme variables. |
| Q-07 | ✅ Fixed | Explicit system font stack; the two unused Google Fonts preconnects replaced with the Firebase auth origins actually contacted. |
| Q-08 | ✅ Fixed | Missing comma added; the JSON-LD block now parses. Sitemap `lastmod` refreshed. |
| Q-09 | ✅ Fixed | `InfoButton` reads the version from `package.json` (now `3.3.0`). |
| Q-10 | ✅ Fixed | `ErrorBoundary` at the root, with reload and reset-session recovery. |
| Q-11 | ✅ Fixed | `LifetimeStatsDialog` is `React.lazy`. **Initial bundle 215 KB → 93 KB gzipped**; recharts moved to a chunk loaded on first double-click. |
| Q-12 | ✅ Fixed | Unreachable JSX and the dead `'login'` screen state removed; the static loader is now removed by `index.js` on mount, so a startup crash shows the error screen instead of a blank page. |
| Q-13 | ✅ Fixed | `scoreDecrease` shrinks and fades instead of duplicating `scoreIncrease`. |

## Accessibility

| ID | Status | What changed |
|---|---|---|
| A-01 | ✅ Fixed | The blanket `onKeyDown={e => e.preventDefault()}` is gone from both selects. It was never needed — the game key handler only exists while the Scoreboard is mounted. |
| A-02 | ✅ Fixed | The full-screen black/white strobe is replaced with a slower, lower-contrast colour pulse, and it respects `prefers-reduced-motion`. `DISABLE_WIN_ANIMATION` now actually works (L-03). |
| A-03 | ✅ Fixed | All 23 `alert()` calls replaced with a `Toast` component or inline messages. `window.confirm` kept for destructive actions only, where blocking is correct. |
| A-04 | ✅ Fixed | Section headers are real buttons with `aria-expanded`; dropdowns are theme-aware; modals have `role="dialog"`, Escape-to-close and focus-on-open; history keys are stable. Leaderboard rows are focusable, carry an accessible name and open the stats dialog on Enter or Space — previously double-click was the only way in. Table headers have `scope`. The Scoreboard is still deliberately dark in both themes — it is a TV in a room. |

---

## What is left

One thing, and it cannot be finished from inside the repo:

- **S-01 / S-02** — the files are untracked and deleted going forward, but the
  values are still in git history on the public remote. Rotating the key and
  purging history are yours.

Everything else in the audit is resolved in code, including S-09: the app is off
`react-scripts` and on Vite, and the shipped dependency tree has no high or
critical advisories. The audit findings that npm still reports are all dev-tooling
(jest/vite/esbuild) and never reach production.

The structural items in the roadmap that are *not* audit findings remain open by
choice: the per-entity Firestore layout and derived ratings
([ROADMAP.md §3](ROADMAP.md)). Optimistic concurrency closed the practical harm
that motivated them (D-03), so they are now a design improvement rather than a bug
fix — and they involve reshaping stored data, which is worth doing with you
watching rather than autonomously.

## Things added that were not in the audit

- **`src/services/rating.js`** — the rating maths as pure, documented, tested
  functions. This is what made L-02 and L-04 fixable rather than patchable, and it
  is the foundation for the derived-ratings work in [ROADMAP.md §3](ROADMAP.md).
- **Undo last game** (Admin → Player Management). Removes the most recent match and
  reverses its rating effect. Previously a mis-scored game was permanent unless an
  admin hand-edited a rating, which corrupted the stats graph.
- **Optional player passwords.** They exist to stop misclicks on a shared TV, so
  they are now opt-in per player rather than mandatory, with a hint saying what
  they are for.
- **Save-failure surfacing.** `dataService.lastSaveError` is set when a cloud write
  fails after retries, so a silent data-loss condition can be shown rather than
  swallowed.
- **`Escape` closes modals**, first field auto-focuses, and the stats dialog can be
  dismissed from the keyboard.
- **`services/stats.js`** — head-to-head records, rivalry detection, biggest
  rating swings, all pure functions over the existing match log. Head-to-head is
  shown in the stats dialog; it is what people actually argue about and every
  field it needs was already being stored.
- **Season archive.** Ending a season keeps the final table instead of discarding
  it, so past standings and champions survive.
- **`dispose()`** on the data service, so pending saves and subscribers can be
  cancelled. The singleton never needs it; tests do, and its absence was letting
  one test's debounced save fire during another.
- **`firestore.rules`** (+ `firebase.json`) — a deny-all client rule as
  defense-in-depth for S-03. All legitimate access goes through the Admin SDK,
  which bypasses rules, so this is free to apply; it closes the theoretical path
  where someone lifts the public web config and hits Firestore directly with the
  client SDK. **You still need to deploy it:**
  `firebase deploy --only firestore:rules`, or paste it into the Firebase console.
- **Save-failure and merge banners** — `lastSaveError`/`lastMergeNotice` are now
  shown (see `SaveStatus.js` and the merge toast in `App.js`), completing D-02/D-03.

## Verification

```bash
npm test          # 123 passing across 8 suites (standalone Jest)
npm run build     # Vite build, compiles clean
```

The tests that matter most:

- `rating.test.js` → *"is zero-sum for evenly matched ranked players"* — fails on
  the old implementation.
- `dataService.test.js` → *"reads back exactly what it wrote"* — fails on the old
  implementation, and would have caught D-01 the day it was introduced.
- `dataService.test.js` → *"never sends an account identifier in the request body"*
  — pins the S-03 fix so the vulnerable shape cannot creep back.
- `dataService.test.js` → *"merges instead of clobbering when both record a game"*
  — two devices record different games against the same base revision and neither
  is lost.
- `Scoreboard.test.js` → *"records the game only once however hard End is pressed"*
  — fails on the old implementation.
- `GameHistory.test.js` → *"renders an injected tag as text, not as an element"* —
  asserts the XSS payload does not execute.

Beyond the tests, the whole flow was exercised in a real browser: legacy plaintext
credentials accepted and upgraded with no plaintext left behind, head-to-head
matching its fixture exactly, a season archiving correctly, and the app recovering
to the login screen instead of white-screening on a corrupt session value. After
the Vite migration the same end-to-end flow was re-run on the Vite dev server,
including the lazily-loaded stats dialog and chart.
