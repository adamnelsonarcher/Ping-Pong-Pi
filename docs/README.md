# Ping Pong Pi — Documentation

Full audit of commit `5653345` on branch `Webapp`, July 2026.

| Document | Read it when |
|---|---|
| [FIXES.md](FIXES.md) | **Start here.** Status of all 49 findings after the remediation pass, and the three things that still need you. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | You need to know how the app works — data flow, storage modes, boot sequence, the rating formula, screen flow. |
| [AUDIT.md](AUDIT.md) | You want the original findings. 49 of them — 4 critical, 14 high, 16 medium, 15 low — each with file:line, reproduction, and a fix. Kept as written. |
| [ROADMAP.md](ROADMAP.md) | You're deciding what to do next — the structural work that remains: per-entity data model, derived ratings, Vite migration, live sync. |

## Start here

42 of the 49 findings are fixed. **Three things still need a human**, because they
cannot be done from the code:

1. **[S-01](AUDIT.md#-s-01--firebase-admin-private-key-is-committed-and-public)** — the Firebase Admin private key is in git history on the public repo. The file is untracked now, but the value must be **rotated** and the history purged.
2. **[S-02](AUDIT.md#-s-02--a-production-database-dump-is-published-on-your-website)** — `public/data/data.json` is deleted, but it is still in history. Change the passwords it contained (`admin`, `1234`, `123`) anywhere they are reused.
3. **[D-01](AUDIT.md#-d-01--cloud-saves-write-to-a-different-firestore-key-than-reads)** — *fixed*, but any games saved to the orphaned base64 documents since commit `7378d8d` need merging by hand in the Firestore console, or they stay lost.

[FIXES.md](FIXES.md) has the full status table; [ROADMAP.md §1](ROADMAP.md#1-triage) has the original ordered checklist.

## Finding ID scheme

| Prefix | Category |
|---|---|
| `S-` | Security & exposure |
| `D-` | Data loss & persistence |
| `L-` | Logic & correctness |
| `Q-` | Quality & maintainability |
| `A-` | Accessibility & user safety |

## How this was verified

Not just read. The build and test suite were run (`react-scripts build` compiles
clean; the single test fails), `npm audit` was run (71 vulnerabilities), the
Firestore key mismatch in D-01 was reproduced, and the rating maths in L-02 was
extracted into a standalone harness and executed to measure the actual inflation
per match. Claims that were checked this way say so in the finding.
