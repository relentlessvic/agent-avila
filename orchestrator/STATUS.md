# Orchestrator Status

Last updated: 2026-05-02

## Current phase

**Phase B.2a — closed (source committed `a324290`, migration 007 applied to production).** B.2a infrastructure (transactional helper + event_type CHECK extension) is in place and runtime-inert. No active code phase right now. Phase B.2b is the next planned phase but remains in design-review-only state.

## Recent commits (most recent first)

| Phase | Commit | Description |
|---|---|---|
| Phase B.2a | `a324290` | Phase B.2a: add updatePositionRiskLevelsTx + migration 007 (event_type SL/TP updates) |
| Phase B.1 closeout | `63bbac4` | Phase B.1 closeout: update STATUS, CHECKLIST, NEXT-ACTION |
| Phase B.1 | `cb7facb` | Phase B.1: paper close-source cleanup (CLOSE_POSITION + SELL_ALL DB-canonical) |
| Phase O-4 | `f080b24` | Phase O-4: add orchestrator automation layer |
| Phase A.2 | `959fef7` | Phase A.2: make paper manual trades DB-first |
| Orchestrator docs (initial) | `685a905` | Add Orchestrator blueprint and fix plan |
| Phase A.1 | `5bcda59` | Phase A.1: return status from paper shadow helpers |

## Production schema state

- **Migration 007** (`event_type_sl_tp_updates`) — applied 2026-05-02. `trade_events_event_type_check` constraint now allows 10 event types: 8 pre-existing + `manual_sl_update`, `manual_tp_update`. Verified via post-migration `pg_constraint` query.
- **Migration 006** (`positions_reconciliation_metadata`) — applied 2026-05-02 as a **side effect** of running the migration runner for B.2a (see "Side effect note" below).

## Working tree state (truth)

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Excluded from all commits.

## Phase status summary

| Phase | Status |
|---|---|
| Phase A.1 | Closed, committed `5bcda59` |
| Phase A.2 | Closed, committed `959fef7` |
| Phase O-4 | Closed, committed `f080b24` |
| Phase B.1 | Closed, committed `cb7facb` (closeout `63bbac4`) |
| Phase B.2a — design | Codex APPROVE (3 review rounds: initial → Option β → final) |
| Phase B.2a — implementation | **Closed, committed `a324290` (Codex PASS-WITH-NOTES, no required edits)** |
| Phase B.2a — migration 007 applied | **Applied 2026-05-02 to production** |
| Phase B.2b | Deferred — design-review-only state, awaiting design decisions |

## Current allowed next action

> **Phase B.2b design-only review. No code.**

B.2b implementation cannot proceed until prerequisites listed in `NEXT-ACTION.md` are satisfied (design questions resolved, Codex design review, operator authorization).

The operator may also choose to advance an alternative phase (O-5 / O-6 / O-7 / O-8) instead.

## Side effect note — migration 006 applied

When applying migration 007 via `scripts/run-migrations.js`, the runner also applied migration 006 (`positions_reconciliation_metadata`). The runner has no concept of "deferred" — it applies all unapplied migrations in sequence. Migration 006 had been on disk but unapplied as a deliberate operator gate.

**What 006 did:**
- Added 3 nullable columns to `positions`: `last_reconciled_at`, `last_reconciled_verdict`, `last_reconciliation_snapshot`
- Added a CHECK constraint on `last_reconciled_verdict` ∈ {NULL, OK, WARN, HALT, CATASTROPHIC}
- Per its own header: *"This migration is **inert at runtime**: nothing in bot.js, dashboard.js, or db.js reads or writes these columns yet."*
- Populated only by operator-driven `scripts/reconciliation-shadow.js --persist`

**Practical impact:**
- No automatic behavior change in bot.js or dashboard.js.
- bot.js startup gate at line 1011 (`schema_version >= 5`) was already satisfied — no change.
- Operator-driven `--persist` mode of the reconciliation-shadow CLI is now unblocked at the schema level (would have errored before with "column does not exist").

**Safety posture:**
- **Do not revert 006** without explicit safety review. Reverting requires DROPping the three columns — destructive operation. As of this writing, no production code reads or writes these columns, so they should be empty/null on existing rows — but verify before any DROP.
- Memory note about "006 unapplied" is now stale and should be updated.

## Blocked actions (require explicit operator approval)

- Editing `bot.js`
- Editing `db.js` (HARD BLOCK reinstated post-B.2a; the B.2a lift was scoped to that phase only)
- Editing `migrations/` (HARD BLOCK reinstated post-B.2a; same scope)
- Phase B.2b implementation (caller integration in `dashboard.js`)
- Touching live trading logic
- Touching Kraken execution
- Touching SL / TP / breakeven / trailing stop / position management logic in bot.js
- Deploying or pushing to remote
- Force push, `git reset --hard`, interactive rebase, branch deletion, file deletion
- Reverting migration 006 (destructive — explicit safety review required)

## Current risk level

**LOW.** No uncommitted code. Paper open/close paths are DB-canonical (Phase A + B.1). B.2a infrastructure is in place but runtime-inert (helper has no callers; new event types accepted by schema but never inserted yet).

The known remaining dual-truth surface is Phase B.2b territory: paper `SET_STOP_LOSS` / `SET_TAKE_PROFIT` still write `position.json` directly without DB updates. Dashboard SL/TP edits in paper mode are reverted within ≤5 min by bot.js's next rehydrate cycle. Design-known and tracked.
