# Ping Pong Pi — Documentation

Full audit of commit `5653345` on branch `Webapp`, July 2026.

| Document | Read it when |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | You need to know how the app works today — data flow, storage modes, boot sequence, the rating formula, screen flow. Written as-built, not as-intended. |
| [AUDIT.md](AUDIT.md) | You want the list of defects. 49 findings — 4 critical, 14 high, 16 medium, 15 low — each with file:line, reproduction, and a fix. |
| [ROADMAP.md](ROADMAP.md) | You're deciding what to do next — triage order, auth/data-model redesigns, toolchain migration, testing strategy, product workflows. |

## Start here

Three things need attention before anything else:

1. **[S-01](AUDIT.md#-s-01--firebase-admin-private-key-is-committed-and-public)** — the Firebase Admin private key is in the public GitHub repo. Rotate it.
2. **[S-02](AUDIT.md#-s-02--a-production-database-dump-is-published-on-your-website)** — `public/data/data.json` is a real database dump, including a third party's email and plaintext passwords, served from your live site.
3. **[D-01](AUDIT.md#-d-01--cloud-saves-write-to-a-different-firestore-key-than-reads)** — cloud saves write to a different Firestore document than reads, so every Google-mode game is silently lost. One-line fix.

[ROADMAP.md §1](ROADMAP.md#1-triage) has the ordered checklist.

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
