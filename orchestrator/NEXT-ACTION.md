# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase B.2b-SL is closed: source committed (`511f94e`).** Paper `SET_STOP_LOSS` is now DB-first via `shadowRecordManualPaperSLUpdate` → `updatePositionRiskLevelsTx` + atomic `manual_sl_update` audit insert. `dashboard.js` only; `bot.js` / `db.js` / `migrations/` untouched. Codex re-review = PASS. The schema-accepted event type `manual_tp_update` still has no callers (B.2c-TP deferred).

The next safe action is:

> **Phase B.2c-TP design-only review. No code.**

B.2c-TP covers paper `SET_TAKE_PROFIT` cleanup in `dashboard.js`. Implementation cannot proceed yet; only design discussion / Codex design review is allowed at this stage.

## B.2c-TP design blocker

Paper SET_TAKE_PROFIT cannot move to DB-first until the following is resolved:

- **bot.js trailing/breakeven can write stale `take_profit` back to DB after rehydrate**, silently overwriting a manual dashboard TP edit. This was the MEDIUM finding from the prior B.2b Codex review and is the reason TP was split out of B.2b-SL into a separate phase.
- A conflict-resolution policy must be chosen and Codex-reviewed before any TP DB-first code is written:
  - last-writer-wins (simplest; manual TP can still be reverted by next bot cycle)
  - manual-overrides-bot (manual edits set a flag bot.js must respect)
  - mutual exclusion (manual TP edit pauses bot trailing/breakeven for that position)
- Each option has different bot.js implications. Note: bot.js is HARD BLOCK; any policy that requires bot.js changes will need a scoped lift in addition to the dashboard.js lift.

## Pre-B.2c-TP acknowledgment — migration 006 side effect

This carryover note from B.2b is still relevant for B.2c-TP:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

This acknowledgment does NOT block B.2c-TP.

## Phase B.2c-TP prerequisites (none yet satisfied)

| Prerequisite | Status |
|---|---|
| B.2c-TP design review with Codex | Not started |
| Conflict-resolution policy (manual TP vs bot trailing/breakeven) | Not designed (DESIGN BLOCKER) |
| Decision on best-effort LOG_FILE entry for paper TP update | Not decided |
| Caller throw wording approval (precedent: B.2b-SL) | Not designed |
| Comment block update in `dashboard.js` (lift the B.2c deferral note once TP lands) | Not drafted |
| `dashboard.js` HARD BLOCK lift for B.2c-TP (scoped) | Not given |
| Explicit operator authorization | Not given |

Until **all** prerequisites are satisfied, B.2c-TP implementation cannot begin. B.2c-TP design discussion is allowed and does not write any code.

## What B.2b-SL did NOT do (still on the table for B.2c-TP)

- Did not add `shadowRecordManualPaperTPUpdate` (intentionally removed from the original B.2b diff).
- Did not insert any `manual_tp_update` events at runtime (no code path constructs one).
- Did not change `SET_TAKE_PROFIT` behavior — paper TP still writes `position.json` and is silently revertible by bot.js's next rehydrate cycle.
- Did not touch bot.js, db.js, or migrations.

## Alternative phases (operator may choose any)

If Phase B.2b is not the next priority, the operator can advance instead to a phase that does not require any HARD BLOCK lift:

- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase B.2c-TP implementation (paper TP DB-first) | All B.2c-TP prerequisites above |
| Live mode write-path changes | Phase D-5.12 |
| Editing `bot.js` / `db.js` / `migrations/` | Explicit operator instruction (prior scoped lifts expired post-commit) |
| Editing `dashboard.js` | Explicit operator instruction (B.2b-SL's scoped lift expired post-commit) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL commit (`511f94e`); explicitly excluded.

## How to proceed

For Phase B.2c-TP design review: use `orchestrator/prompts/CODEX-REVIEW.md` as a template, structuring the review around the conflict-policy design blocker and the prerequisites enumerated above. Do not write code, edit `dashboard.js`, or touch any HARD BLOCK file until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If B.2c-TP advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
