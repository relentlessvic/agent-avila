# Orchestrator Status

Last updated: 2026-05-02

## Current phase

**Phase C.1 — closed (source committed `d0c8817`).** `db.js` `loadRecentTradeEvents` WHERE clause expanded to admit `manual_sl_update` and `manual_tp_update` audit rows alongside the existing six lifecycle event types. Comment block updated to cite Phase C.1 lineage. `db.js`-only; `dashboard.js` / `bot.js` / `migrations/` / `scripts/` untouched. Codex implementation review = PASS with notes (one LOW cosmetic note about a class-name reference in the C.1 design report, deferred to C.2 design verification). Phase C audit produced a 3-sub-phase split: **C.1 (db.js read filter, landed), C.2 (dashboard.js mapper + UI rendering, design-only next), C.3 (`scripts/recovery-inspect.js` heuristic refinement, design-only later)**.

**Intermediate rough-rendering window is now open.** Until C.2 lands, `manual_sl_update` and `manual_tp_update` rows can appear in the dashboard's `recentTrades` payload and will render via `_dbTradeEventToLegacyShape`'s default branch — raw uppercase types ("MANUAL_SL_UPDATE" / "MANUAL_TP_UPDATE"), `—` placeholders for null numeric fields, and the latest-decision badge falling into the unknown-type class. The `fired` counter is unchanged (allowlist excludes the new types). LIMIT 30 is unchanged — heavy SL/TP-edit sessions could push lifecycle events out of the recent feed temporarily; bounded and reversible by C.2 work.

**Full B.2 paper-mode dual-truth track is functionally landed.** All paper-mode write paths are DB-canonical:
- paper BUY DB-first (Phase A.2, `959fef7`)
- paper CLOSE DB-first (Phase B.1, `cb7facb`)
- paper SELL_ALL DB-first (Phase B.1, `cb7facb`)
- paper SET_STOP_LOSS DB-first (Phase B.2b-SL, `511f94e`)
- paper SET_TAKE_PROFIT DB-first (Phase B.2d, `eca2659`)

Live-mode write paths remain `position.json`-only behind Phase D-5.12.

## Recent commits (most recent first)

| Phase | Commit | Description |
|---|---|---|
| Phase C.1 | `d0c8817` | Phase C.1: include manual SL/TP audit events in recent trades |
| Phase B.2d-dashboard-TP closeout | `1563310` | Phase B.2d-dashboard-TP closeout: update STATUS, CHECKLIST, NEXT-ACTION |
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
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`), B.2c-bot-preserve-TP (`cc6bd2e`), B.2d-dashboard-TP (`eca2659`), and C.1 (`d0c8817`) commits; explicitly excluded from all commits.
- `scripts/smoke-test-live-writes.js:225–239` — wording is still stale ("active management dual-write" / "take_profit unchanged but rewritten") because `bot.js` no longer rewrites `take_profit` from manage-update. Test logic remains valid (it calls the helper directly, which still supports both fields). Cleanup tracked as LOW/cosmetic; best run after Phase C track closes so wording can also reflect any Phase C cleanup.

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
| Phase B.2d-dashboard-TP — implementation | Closed, committed `eca2659` (Codex implementation review = PASS, safe to commit, no required edits) — closeout `1563310` |
| Full B.2 paper-mode dual-truth track | **Functionally landed.** Paper BUY / CLOSE / SELL_ALL / SET_STOP_LOSS / SET_TAKE_PROFIT all DB-canonical. Live mode unchanged behind D-5.12. |
| Phase C — audit | Codex audit produced 3-sub-phase split: C.1 (db.js read filter), C.2 (dashboard.js mapper + UI rendering), C.3 (`scripts/recovery-inspect.js` heuristic refinement) |
| Phase C.1 — design | Codex APPROVE (smallest safe wedge — literal-only `WHERE … IN (…)` expansion; two LOW concerns: external monitoring dependencies cannot be fully ruled out from repo search, heavy SL/TP-edit sessions could transiently push lifecycle events past LIMIT 30) |
| Phase C.1 — implementation | **Closed, committed `d0c8817` (Codex implementation review = PASS with notes; one LOW cosmetic class-name discrepancy in C.1 design report wording, deferred to C.2 design verification)** |
| Phase C.2 — dashboard.js mapper + UI rendering | Deferred — design-review-only state. Will close the rough-rendering window opened by C.1. |
| Phase C.3 — `scripts/recovery-inspect.js` heuristic refinement | Deferred — design-review-only state. Recognize `manual_sl_update` / `manual_tp_update` as benign event types. |

## Current allowed next action

> **Phase C.2 design-only dashboard rendering review. No code.**

C.2 covers `dashboard.js` mapper / UI rendering for `manual_sl_update` and `manual_tp_update` rows. Scope:
- Add cases to `_dbTradeEventToLegacyShape` switch (`dashboard.js:584-591`) so the new event types map to a friendly type label instead of falling through the `default` branch as raw uppercase.
- Update `renderTradeTable` (`dashboard.js:6342-…`) to render risk-level edits with appropriate placeholders for null price/quantity/total.
- Update the latest-decision badge logic (`dashboard.js:7299-7304`). **C.2 design must verify the actual class names in use** — Codex flagged that the C.1 design report mentioned `dec_blocked`, but the real class observed in `dashboard.js` is `mode-blocked`. Confirm exact class names (`mode-paper` / `mode-live` / `mode-blocked` / `dec-buy` / `dec-exit` / `dec-blocked`) before proposing labels.

C.2 cannot enter implementation until: Codex design review, explicit operator authorization, and a scoped `dashboard.js` HARD BLOCK lift.

The operator may also choose to advance C.3 ahead of C.2, advance an alternative phase (O-5 / O-6 / O-7 / O-8), or lift Phase D-5.12 (live persistence gate) — D-5.12 is the only remaining write-side dual-truth surface in the system.

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
- Editing `db.js` (HARD BLOCK reinstated post-C.1; the C.1 lift was scoped to that phase only)
- Editing `migrations/` (HARD BLOCK reinstated post-B.2a; same scope)
- Editing `dashboard.js` (HARD BLOCK reinstated post-B.2d-dashboard-TP; the B.2d lift was scoped to that phase only)
- Editing `scripts/smoke-test-live-writes.js` (smoke-test wording cleanup remains a separate deferred LOW/cosmetic phase)
- Editing `scripts/recovery-inspect.js` (Phase C.3 heuristic refinement — design-only review pending; lift required)
- Phase C.2 implementation (design-only review allowed; implementation requires authorization + scoped `dashboard.js` lift)
- Phase C.3 implementation (design-only review allowed; implementation requires authorization + scoped `scripts/` lift)
- Touching live trading logic
- Touching Kraken execution
- Touching SL / TP / breakeven / trailing stop / position management logic in bot.js
- Deploying or pushing to remote
- Force push, `git reset --hard`, interactive rebase, branch deletion, file deletion
- Reverting migration 006 (destructive — explicit safety review required)

## Current risk level

**LOW.** No uncommitted code. Full paper-mode write surface is DB-canonical: paper BUY (`959fef7`), CLOSE/SELL_ALL (`cb7facb`), SET_STOP_LOSS (`511f94e`), SET_TAKE_PROFIT (`eca2659`). Both `manual_sl_update` and `manual_tp_update` are now live event types with active dashboard-driven inserts AND active dashboard reads (C.1, `d0c8817`). `bot.js` `manageActiveTrade` no longer overwrites DB `take_profit` from in-memory state (`cc6bd2e`). Paper dashboard edits cannot be silently overwritten by bot rehydrate.

**Cosmetic-only intermediate state:** between C.1 and C.2, manual SL/TP audit rows render via the dashboard's default branch (raw uppercase types, "—" placeholders for null fields). Does not affect correctness of any audit, count, or P&L surface — `fired` counter is allowlist-based and unchanged; `pnl` aggregates filter to exit event types only and exclude SL/TP audit rows; `loadOpenPosition` is unchanged.

**No remaining paper dual-truth surface.** The only remaining write-side dual-truth surface in the system is **live mode**: live `SET_STOP_LOSS` / `SET_TAKE_PROFIT` / `SELL_ALL` paths still write `position.json` directly without a DB update. This is intentional and gated behind Phase D-5.12 (Live persistence gate lift). Until D-5.12 lifts, live mode remains JSON-authoritative by design.
