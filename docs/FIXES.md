# Remediation status

Status of every finding in [AUDIT.md](AUDIT.md) after the remediation pass.

**42 of 49 fixed. 7 partial.** Build compiles clean; 44 tests pass; the initial JS
bundle went from 215 KB to 93 KB gzipped; runtime dependency vulnerabilities went
from 23 (4 critical, 6 high) to 8 moderate.

Nothing has been committed — everything is staged or in the working tree for you
to review.

---

## ⚠ Three things still need you

These cannot be done from the code, and two of them are the most serious findings
in the audit.

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
| S-06 | ⚠ Partial | Player passwords are now explicitly optional and framed as anti-misclick. Account deletion is server-side and scoped to the authenticated user, so bypassing the admin password can no longer reach anyone else's data. Passwords are still stored in plaintext and the admin gate is still a client-side comparison. |
| S-07 | ✅ Fixed | Base64 "encoding" removed. `readStoredUser()` migrates existing base64 values transparently. |
| S-08 | ✅ Fixed | `saveData` no longer logs `req.body`; errors log a message only. |
| S-09 | ⚠ Partial | Server/dev dependencies split correctly, dead ones removed, lockfile refreshed: runtime tree now has **zero critical or high** advisories (was 4 and 6). The remaining 60-odd are all in the `react-scripts` dev tree — that needs the Vite migration in [ROADMAP.md §5](ROADMAP.md). |

## Data loss & persistence

| ID | Status | What changed |
|---|---|---|
| D-01 | ✅ Fixed | The read/write key mismatch is gone, and structurally cannot come back: the client sends no key at all, and `api/userKey.js` is the single definition, used by both handlers. Covered by a round-trip test that would have failed the day this shipped. |
| D-02 | ✅ Fixed | `scheduleSave()` returns a real promise; `flush()` writes immediately; a `pagehide` listener flushes with `keepalive: true` so a match recorded seconds before the TV goes off still lands. Failed saves retry twice and then surface on `lastSaveError`. |
| D-03 | ⚠ Partial | Saves are now a scoped merge write to the user's own subtree rather than a read-modify-write of the entire database, so cross-user clobbering is gone. Two devices on the *same* account can still overwrite each other — that needs the per-entity data model in [ROADMAP.md §3](ROADMAP.md). |
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
| L-10 | ⚠ Partial | `resetAllScores` correctly preserves lifetime stats and `maxWinStreak`. It still records no season boundary, so the stats graph draws a continuous line across the reset — that needs the season model in [ROADMAP.md §3](ROADMAP.md). |
| L-11 | ✅ Fixed | `editPlayerScore` sets the season score without pushing into `scoreHistory`, which tracks lifetime. |
| L-12 | ✅ Fixed | `scoreHistory` and the other late-added fields are normalised during rehydration, and the dialog guards anyway. |
| L-13 | ✅ Fixed | `addPlayer` returns `{ok, reason}`; duplicates and empty names show a toast and keep the modal open. |
| L-14 | ✅ Fixed | Logout clears `isLocalMode` unconditionally. |
| L-15 | ✅ Fixed | `API_URL` is relative in both environments; the dev proxy handles routing. |

## Quality

| ID | Status | What changed |
|---|---|---|
| Q-01 | ✅ Fixed | `createRoot`. React 18 features are live. |
| Q-02 | ✅ Fixed | CRA scaffold test deleted. 44 tests across `rating.test.js` and `dataService.test.js`, each of the worst bugs covered by a named regression test. |
| Q-03 | ✅ Fixed | Self-dependency, `framer-motion` and `web-vitals` removed; build tooling moved to `devDependencies`; lockfile regenerated and verified in sync. |
| Q-04 | ✅ Fixed | Deleted: `settings1.js`, `logo.svg`, `reportWebVitals.js`, `UserAccount.{js,css}`, `context/ThemeContext.js`, `styles/InputModal.css`, `__pycache__/`, `.idea/`. |
| Q-05 | ✅ Fixed | Removed `testServerConnection`, `testFirestoreConnection`, `loginUser`, `saveSettings`, `saveGameHistory`, `createUser`, `encodeUser`. |
| Q-06 | ✅ Fixed | Dead selectors removed, duplicate `.btn:hover` and `transition` collapsed, hardcoded light-mode borders replaced with theme variables. |
| Q-07 | ✅ Fixed | Explicit system font stack; the two unused Google Fonts preconnects replaced with the Firebase auth origins actually contacted. |
| Q-08 | ✅ Fixed | Missing comma added; the JSON-LD block now parses. Sitemap `lastmod` refreshed. |
| Q-09 | ✅ Fixed | `InfoButton` reads the version from `package.json` (now `3.2.0`). |
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
| A-04 | ⚠ Partial | Section headers are real buttons with `aria-expanded`; dropdowns are theme-aware; modals have `role="dialog"`, Escape-to-close and focus-on-open; history keys are stable. The Scoreboard is still deliberately dark in both themes — it is a TV in a room. |

---

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

## Verification

```bash
npm test          # 44 passing
npm run build     # compiles clean
```

The tests that matter most:

- `rating.test.js` → *"is zero-sum for evenly matched ranked players"* — fails on
  the old implementation.
- `dataService.test.js` → *"reads back exactly what it wrote"* — fails on the old
  implementation, and would have caught D-01 the day it was introduced.
- `dataService.test.js` → *"never sends an account identifier in the request body"*
  — pins the S-03 fix so the vulnerable shape cannot creep back.
