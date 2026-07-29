# CLAUDE.md

Guidance for working in this repo. See `docs/` for the full architecture, audit,
remediation status, and roadmap — read `docs/README.md` first.

## Commands

```bash
npm run dev     # API (:3001) + Vite app (:3000) together
npm start       # Vite app only
npm run server  # API only
npm test        # Jest
npm run lint    # ESLint (flat config in eslint.config.mjs)
npm run build   # Vite production build → build/
```

Run `npm run lint` before committing — it catches unused vars/imports and React
hook-dependency bugs. The tree is kept lint-clean.

## What this is

A React + Vite single-page ping-pong scoreboard for a TV, with an ELO leaderboard
and match history. Data lives either in `localStorage` (local mode, no backend) or
in Firestore behind a small Express API on Vercel (cloud mode, Google sign-in).

## Conventions that will bite you if you don't know them

- **Build tooling is Vite, tests are standalone Jest.** Not CRA — `react-scripts`
  was removed (docs/AUDIT.md S-09). JSX files are `.jsx`; logic/service/config
  files are `.js`. `api/*.js` and `server.js` are CommonJS and must stay that way
  (no `"type": "module"` in package.json).
- **Env vars keep the `REACT_APP_` prefix.** The code reads
  `process.env.REACT_APP_*`; `vite.config.js` substitutes those at build time via
  `define`, so Vercel's variables did not need renaming and the source still runs
  under Jest. Do **not** switch to `import.meta.env` — it breaks Jest.
- **`dataService` is a singleton store.** Components read straight from it and
  re-render via `useSyncExternalStore(subscribe, () => dataService.version)`. There
  is deliberately no second copy of players/history/settings in React state — that
  duplication was the source of several fixed bugs. Mutations call `_emit()`.
- **The rating maths lives in `src/services/rating.js` and is pure.** No I/O, no
  mutation. `computeMatchDeltas` snapshots both players *before* either changes, so
  matches are order-independent and zero-sum (outside the intentional upset bonus).
  It is heavily tested — keep it that way.
- **All cloud access goes through the authenticated API.** `api/_auth.js` verifies
  a Firebase ID token; the account key is derived from the verified email
  (`api/userKey.js`), never from client input. The browser never uses the Firestore
  client SDK — only Firebase Auth.
- **Passwords are hashed** (`src/services/credentials.js`, PBKDF2). Legacy plaintext
  values are accepted once and upgraded transparently. Never store or compare a raw
  password; go through `checkPlayerPassword` / `checkAdminPassword` /
  `setAdminPasswordValue`.
- **Cloud saves are optimistically concurrent.** Each account carries a `revision`;
  the server rejects a stale write with 409, and the client merges by replaying its
  unseen (id'd) matches on top of the server state. See `saveData` / `_mergeRemote`.

## Guardrails

- Commit automatically with clear messages, authored as the repo owner, no Claude
  co-author trailer. Don't push unless asked.
- Before committing a non-trivial change: `npm test` and `npm run build` must pass;
  for anything observable, smoke-test it in a browser.
- **Do not reshape stored Firestore/localStorage data shape autonomously** (e.g.
  the per-entity data-model migration in docs/ROADMAP.md §3) — do that with the
  owner present; tests alone can't catch a bad data migration.
- Outstanding manual security actions (rotate the exposed Firebase key, purge git
  history) are the owner's to do — see docs/FIXES.md.
