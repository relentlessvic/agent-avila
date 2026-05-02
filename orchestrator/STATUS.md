# Orchestrator Status

Last updated: 2026-05-02

## Current phase

**Phase B.2d-dashboard-TP — closed (source committed `eca2659`).** Paper `SET_TAKE_PROFIT` is now DB-first via `shadowRecordManualPaperTPUpdate` → `updatePositionRiskLevelsTx` + atomic `manual_tp_update` audit insert. `dashboard.js` only; `bot.js` / `db.js` / `migrations/` / `scripts/` untouched. Codex implementation review = PASS, safe to commit, no required edits. Live `SET_TAKE_PROFIT` remains byte-identical (`position.json`-only behind the D-5.12 gate).

**Full B.2 paper-mode dual-truth track is now functionally landed.** All paper-mode write paths are DB-canonical:
- paper BUY DB-first (Phase A.2, `959fef7`)
- paper CLOSE DB-first (Phase B.1, `cb7facb`)
- paper SELL_ALL DB-first (Phase B.1, `cb7facb`)
- paper SET_STOP_LOSS DB-first (Phase B.2b-SL, `511f94e`)
- paper SET_TAKE_PROFIT DB-first (Phase B.2d, `eca2659`)

Live-mode write paths remain `position.json`-only behind Phase D-5.12. The bot-side trailing/breakeven dual-write was narrowed to `{ stop_loss }` only by Phase B.2c-bot-preserve-TP (`cc6bd2e`), so manual dashboard TP edits cannot be silently overwritten by stale in-memory bot state.

## Recent commits (most recent first)

| Phase | Commit | Description |
|---|---|---|
| Phase B.2d-dashboard-TP | `eca2659` | Phase B.2d: make paper SET_TAKE_PROFIT DB-first |
| Phase B.2c-bot-preserve-TP closeout | `689dad4` | Phase B.2c-bot-preserve-TP closeout: update STATUS, CHECKLIST, NEXT-ACTION |
| Phase B.2c-bot-preserve-TP | `cc6bd2e` | Phase B.2c: preserve DB take_profit during bot SL updates |
| Phase B.2b-SL closeout | `e520db0` | Phase B.2b-SL closeout: update STATUS, CHECKLIST, NEXT-ACTION |
| Phase B.2b-SL | `511f94e` | Phase B.2b-SL: make paper SET_STOP_LOSS DB-first |
| Phase B.2a closeout | `f081b6f` | Phase B.2a closeout: update STATUS, CHECKLIST, NEXT-ACTION (incl. 006 side-effect note) |
| Phase B.2a | `a324290` | Phase B.2a: add updatePositionRiskLevelsTx + migration 007 (event_type SL/TP updates) |
| Phase B.1 closeout | `63bbac4` | Phase B.1 closeout: update STATUS, CHECKLIST, NEXT-ACTION |
| Phase B.1 | `cb7facb` | Phase B.1: paper close-source cleanup (CLOSE_POSITION + SELL_ALL DB-canonical) |
| Phase O-4 | `f080b24` | Phase O-4: add orchestrator automation layer |
| Phase A.2 | `959fef7` | Phase A.2: make paper manual trades DB-first |

## Production schema state

- **Migration 007** (`event_type_sl_tp_updates`) — applied 2026-05-02. `trade_events_event_type_check` constraint now allows 10 event types: 8 pre-existing + `manual_sl_update`, `manual_tp_update`. Verified via post-migration `pg_constraint` query.
- **Migration 006** (`positions_reconciliation_metadata`) — applied 2026-05-02 as a **side effect** of running the migration runner for B.2a (see "Side effect note" below).

## Working tree state (truth)

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`), B.2c-bot-preserve-TP (`cc6bd2e`), and B.2d-dashboard-TP (`eca2659`) commits; explicitly excluded from all commits.
- `scripts/smoke-test-live-writes.js:225–239` — wording is still stale ("active management dual-write" / "take_profit unchanged but rewritten") because `bot.js` no longer rewrites `take_profit` from manage-update. Test logic remains valid (it calls the helper directly, which still supports both fields). Cleanup tracked as LOW/cosmetic; best run after Phase C closes so wording can also reflect any Phase C cleanup.

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
| Phase B.2c-bot-preserve-TP — implementation | Closed, committed `cc6bd2e` (Codex implementation review = PASS with notes; one LOW concern about stale smoke-test wording) — closeout `689dad4` |
| Phase B.2d-dashboard-TP — design | Codex APPROVE (mirror of B.2b-SL; one LOW concern about audit-row noise from repeated UI clicks, parity with SL helper) |
| Phase B.2d-dashboard-TP — implementation | **Closed, committed `eca2659` (Codex implementation review = PASS, safe to commit, no required edits)** |
| Full B.2 paper-mode dual-truth track | **Functionally landed.** Paper BUY / CLOSE / SELL_ALL / SET_STOP_LOSS / SET_TAKE_PROFIT all DB-canonical. Live mode unchanged behind D-5.12. |
| Phase C — dashboard truth cleanup / reconciliation review | Deferred — design-review-only state. To be scoped against any residual dual-truth surfaces in `dashboard.js` and reconciliation pathways. |

## Current allowed next action

> **Phase C design-only dashboard truth cleanup / reconciliation review. No code.**

Phase C scope is to be defined in the design review. Candidate audit targets (read-only inspection only at this stage):
- Residual `position.json` reads in `dashboard.js` outside the live write paths (e.g., the `pos = JSON.parse(readFileSync(POSITION_FILE, ...))` at the top of `handleTradeCommand`) and whether any of them now feed only the live branch after the B.2 paper-mode track landed.
- Reconciliation pathways: `scripts/reconciliation-shadow.js` schema-unblock status (migration 006 applied), and whether B.2 closure changes the operator's reconciliation playbook.
- Whether the bot.js `_rehydratePositionJson` / `_legacyPositionsEqual` semantics still match the new dashboard write surface for paper TP.
- Any UI surface that may need updates to reflect that paper TP edits now produce `manual_tp_update` audit rows.

Phase C cannot enter implementation until: design review (Codex), explicit operator authorization, and any required scoped HARD BLOCK lift. Phase C may turn out to be split into multiple sub-phases depending on the audit findings.

The operator may also choose to advance an alternative phase (O-5 / O-6 / O-7 / O-8) instead, or to lift Phase D-5.12 (live persistence gate) — D-5.12 is currently the only remaining dual-truth surface after B.2 closed.

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
- Editing `dashboard.js` (HARD BLOCK reinstated post-B.2d-dashboard-TP; the B.2d lift was scoped to that phase only)
- Editing `scripts/smoke-test-live-writes.js` (smoke-test wording cleanup remains a separate deferred LOW/cosmetic phase)
- Phase C implementation (design-only review allowed; implementation requires authorization)
- Touching live trading logic
- Touching Kraken execution
- Touching SL / TP / breakeven / trailing stop / position management logic in bot.js
- Deploying or pushing to remote
- Force push, `git reset --hard`, interactive rebase, branch deletion, file deletion
- Reverting migration 006 (destructive — explicit safety review required)

## Current risk level

**LOW.** No uncommitted code. Full paper-mode write surface is DB-canonical: paper BUY (`959fef7`), CLOSE/SELL_ALL (`cb7facb`), SET_STOP_LOSS (`511f94e`), SET_TAKE_PROFIT (`eca2659`). Both `manual_sl_update` and `manual_tp_update` are now live event types with active dashboard-driven inserts. `bot.js` `manageActiveTrade` no longer overwrites DB `take_profit` from in-memory state (`cc6bd2e`). Paper dashboard edits cannot be silently overwritten by bot rehydrate.

**No remaining paper dual-truth surface.** The only remaining dual-truth surface in the system is **live mode**: live `SET_STOP_LOSS` / `SET_TAKE_PROFIT` / `SELL_ALL` paths still write `position.json` directly without a DB update. This is intentional and gated behind Phase D-5.12 (Live persistence gate lift). Until D-5.12 lifts, live mode remains JSON-authoritative by design.
