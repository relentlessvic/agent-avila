# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase B.2a is closed: source committed (`a324290`), migration 007 applied to production.** The transactional helper `updatePositionRiskLevelsTx` exists in db.js but has no callers. The new event types `manual_sl_update` / `manual_tp_update` are accepted by the schema but no code inserts them yet. **Phase B.2a is runtime-inert by design.**

The next safe action is:

> **Phase B.2b design-only review. No code.**

B.2b covers paper `SET_STOP_LOSS` and `SET_TAKE_PROFIT` cleanup in `dashboard.js`. Implementation cannot proceed yet; only design discussion / Codex design review is allowed at this stage.

## Pre-B.2b acknowledgment — migration 006 side effect

Before B.2b begins, the operator should acknowledge the **migration 006 side effect** documented in `STATUS.md`:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).
- Project memory note about "006 unapplied" is now stale and should be updated.

This acknowledgment does NOT block B.2b — but the operator should be aware before declaring B.2b prerequisites satisfied.

## Phase B.2b prerequisites (none yet satisfied)

| Prerequisite | Status |
|---|---|
| B.2b design review with Codex | Not started |
| Conflict-resolution policy (manual SL/TP vs bot trailing-stop) | Not designed |
| Timestamp-based event_id strategy (avoid PK collision on repeated updates) | Acknowledged design item; needs Codex sign-off |
| Decision on best-effort LOG_FILE entry for paper SL/TP update | Not decided |
| Caller throw wording approval | Not designed |
| Comment block update for `dashboard.js` Phase D-5.7.1 / A.2 block | Not drafted |
| `dashboard.js` HARD BLOCK lift for B.2b (scoped) | Not given |
| Explicit operator authorization | Not given |

Until **all** prerequisites are satisfied, B.2b implementation cannot begin. B.2b design discussion is allowed and does not write any code.

## Alternative phases (operator may choose any)

If Phase B.2b is not the next priority, the operator can advance instead to a phase that does not require any HARD BLOCK lift:

- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase B.2b implementation (paper SL/TP DB-first) | All B.2b prerequisites above |
| Live mode write-path changes | Phase D-5.12 |
| Editing `bot.js` / `db.js` / `migrations/` | Explicit operator instruction (B.2a's scoped lift expired post-commit) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Excluded.

## How to proceed

For Phase B.2b design review: use `orchestrator/prompts/CODEX-REVIEW.md` as a template, structuring the review around the design questions enumerated above. Do not write code, edit `dashboard.js`, or touch any HARD BLOCK file until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If B.2b advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
