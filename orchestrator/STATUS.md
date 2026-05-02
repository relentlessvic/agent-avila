# Orchestrator Status

Last updated: 2026-05-02

## Current phase

**Phase B.2c-bot-preserve-TP — closed (source committed `cc6bd2e`).** `bot.js` `manageActiveTrade` no longer writes `take_profit` to DB during breakeven/trail dual-writes; the payload is narrowed to `{ stop_loss }`. This eliminates the stale-TP overwrite race that previously gated the B.2c-TP track. Codex implementation review = PASS with notes (one LOW cosmetic concern: stale wording in `scripts/smoke-test-live-writes.js:225–239` — test logic still passes; cleanup deferred). Paper `SET_TAKE_PROFIT` itself is still pre-B.2b form (`position.json`-only); the dashboard-side wiring is the next track (B.2d-dashboard-TP), which remains in design-review-only state.

## Recent commits (most recent first)

| Phase | Commit | Description |
|---|---|---|
| Phase B.2c-bot-preserve-TP | `cc6bd2e` | Phase B.2c: preserve DB take_profit during bot SL updates |
| Phase B.2b-SL closeout | `e520db0` | Phase B.2b-SL closeout: update STATUS, CHECKLIST, NEXT-ACTION |
| Phase B.2b-SL | `511f94e` | Phase B.2b-SL: make paper SET_STOP_LOSS DB-first |
| Phase B.2a closeout | `f081b6f` | Phase B.2a closeout: update STATUS, CHECKLIST, NEXT-ACTION (incl. 006 side-effect note) |
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
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`) and B.2c-bot-preserve-TP (`cc6bd2e`) commits; explicitly excluded from all commits.
- `scripts/smoke-test-live-writes.js:225–239` — wording is now stale ("active management dual-write" / "take_profit unchanged but rewritten") because `bot.js` no longer rewrites `take_profit` from manage-update. Test logic remains valid (it calls the helper directly, which still supports both fields). Cleanup deferred as LOW/cosmetic.

## Phase status summary

| Phase | Status |
|---|---|
| Phase A.1 | Closed, committed `5bcda59` |
| Phase A.2 | Closed, committed `959fef7` |
| Phase O-4 | Closed, committed `f080b24` |
| Phase B.1 | Closed, committed `cb7facb` (closeout `63bbac4`) |
| Phase B.2a — design | Codex APPROVE (3 review rounds: initial → Option β → final) |
| Phase B.2a — implementation | Closed, committed `a324290` (Codex PASS-WITH-NOTES, no required edits) |
| Phase B.2a — migration 007 applied | Applied 2026-05-02 to production |
| Phase B.2b — original (SL+TP) review | FAIL-WITH-CONDITIONS (MEDIUM TP stale-overwrite risk) — drove the SL-only scope split |
| Phase B.2b-SL — implementation | Closed, committed `511f94e` (Codex re-review = PASS, safe to commit) — closeout `e520db0` |
| Phase B.2c-bot-preserve-TP — design | Codex APPROVE (Option C — bot preserves DB `take_profit` when only updating SL) |
| Phase B.2c-bot-preserve-TP — implementation | **Closed, committed `cc6bd2e` (Codex implementation review = PASS with notes; one LOW concern about stale smoke-test wording)** |
| Phase B.2d-dashboard-TP | Deferred — design-review-only state. Bot-side TP overwrite risk now resolved by `cc6bd2e`; dashboard-side wiring is the next planned step |

## Current allowed next action

> **Phase B.2d-dashboard-TP design-only review. No code.**

B.2d covers the paper `SET_TAKE_PROFIT` DB-first dashboard wiring (mirror of B.2b-SL). The bot-side prerequisite was satisfied by `cc6bd2e`: `bot.js` no longer writes `take_profit` from manage-update, so a future paper-TP DB-first dashboard handler can no longer be silently overwritten by stale in-memory bot state. B.2d implementation still requires Codex design review, a scoped `dashboard.js` HARD BLOCK lift, and explicit operator authorization.

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

- Editing `bot.js` (HARD BLOCK reinstated post-B.2c-bot-preserve-TP; the lift was scoped to that phase only)
- Editing `db.js` (HARD BLOCK reinstated post-B.2a; the B.2a lift was scoped to that phase only)
- Editing `migrations/` (HARD BLOCK reinstated post-B.2a; same scope)
- Editing `dashboard.js` (HARD BLOCK reinstated post-B.2b-SL; the B.2b-SL lift was scoped to that phase only)
- Phase B.2d-dashboard-TP implementation (paper SET_TAKE_PROFIT DB-first dashboard wiring)
- Touching live trading logic
- Touching Kraken execution
- Touching SL / TP / breakeven / trailing stop / position management logic in bot.js
- Deploying or pushing to remote
- Force push, `git reset --hard`, interactive rebase, branch deletion, file deletion
- Reverting migration 006 (destructive — explicit safety review required)

## Current risk level

**LOW.** No uncommitted code. Paper open / close / SL paths are DB-canonical (Phase A + B.1 + B.2b-SL). B.2a infrastructure is in place; `manual_sl_update` is a live event type with active inserts via `shadowRecordManualPaperSLUpdate`. `manual_tp_update` is accepted by the schema but has no active callers (B.2d-dashboard-TP deferred). `bot.js` `manageActiveTrade` no longer overwrites DB `take_profit` from in-memory state (B.2c-bot-preserve-TP, `cc6bd2e`).

The known remaining dual-truth surface is now Phase B.2d-dashboard-TP territory: paper `SET_TAKE_PROFIT` still writes `position.json` directly without a DB update. Dashboard TP edits in paper mode are still reverted within ≤5 min by bot.js's next rehydrate cycle (because the dashboard never persists to DB). The bot-side stale-overwrite race that previously gated this work has been eliminated; what remains is the dashboard-side wiring (mirror of B.2b-SL).
