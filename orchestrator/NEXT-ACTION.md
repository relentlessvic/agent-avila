# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase B.1 is closed and committed (`cb7facb`).** No active code phase.

The next safe action is:

> **Phase B.2 design-only planning/review. No code.**

B.2 covers paper `SET_STOP_LOSS` and `SET_TAKE_PROFIT` cleanup. Implementation cannot proceed yet; only design discussion / Codex design review is allowed at this stage.

## Phase B.2 prerequisites (none yet satisfied)

| Prerequisite | Status |
|---|---|
| Operator lifts `db.js` HARD BLOCK | Not yet |
| Operator lifts `migrations/` HARD BLOCK | Not yet |
| New migration extends `trade_events.event_type` CHECK to allow `manual_sl_update` and `manual_tp_update` | Not designed |
| New `db.js` helpers `updatePositionStopLoss` and `updatePositionTakeProfit` | Not designed |
| Codex design review (helper signatures, migration shape, caller pattern) | Not started |
| Explicit operator authorization to lift HARD BLOCKs | Not given |

Until **all** prerequisites are satisfied, B.2 implementation cannot begin. Phase B.2 design discussion is allowed and does not write any code.

## Alternative phases (operator may choose any)

If Phase B.2 is not the next priority, the operator can advance instead to a phase that does not require any HARD BLOCK lift:

- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation)
- Phase O-8 — Performance & Reliability Upgrades

Each is allowed without lifting any current HARD BLOCK.

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase B.2 implementation (paper SL/TP DB-first) | All B.2 prerequisites above |
| Live mode write-path changes | Phase D-5.12 (live persistence gate lift) |
| Editing `bot.js` / `db.js` / `migrations/` | Explicit operator instruction |
| Touching Kraken execution / SL / TP / BE / trailing logic | Explicit operator instruction |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |

## Working tree truth

- `dashboard.js` — clean (committed in `cb7facb`).
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Not for commit. Excluded.
- No tracked files modified.

## How to proceed

For Phase B.2 design review (no code): use `orchestrator/prompts/CODEX-REVIEW.md` as a template, structuring the review around helper signatures + migration shape + caller pattern. Do not write code, edit `db.js`, or edit `migrations/` until the operator explicitly lifts both HARD BLOCKs.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If you advance Phase B.2 design beyond this turn, update:
- `orchestrator/STATUS.md` — reflect new active phase
- `orchestrator/CHECKLIST.md` — mark progress
- `orchestrator/NEXT-ACTION.md` — set the new "right now"

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
