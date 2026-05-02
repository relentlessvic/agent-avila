# Orchestrator Checklist

End-to-end progression for the Agent Avila dual-truth fix and surrounding orchestrator work.

## Completed phases

- [x] Phase 1 — Repo / Safety Baseline Audit (closed 2026-05-01)
- [x] Phase 1.5 — Deep Audit + Gap Closure
- [x] Phase 2 — Position Truth Audit (read-only) — surfaced P0-1 / P0-2 dual-truth risks
- [x] Phase O-1 — Blueprint (`orchestrator/BLUEPRINT.md`)
- [x] Phase O-2 — Project Attachment Audit (read-only)
- [x] Phase O-3 — 3-Brain CLI Verification (Claude builder, Codex reviewer)
- [x] Phase A.1 — Paper shadow helpers refactored to async + `{ ok, reason }` return contract — commit `5bcda59`
- [x] Phase A.2 — Paper BUY/CLOSE DB-first persistence; LOG_FILE best-effort post-DB; live unchanged — commit `959fef7`
- [x] Orchestrator BLUEPRINT and FIX-PLAN committed — commit `685a905`
- [x] Phase O-4 — Orchestrator automation layer (STATUS, CHECKLIST, APPROVAL-GATES, NEXT-ACTION, AUTOPILOT-RULES, prompts/) — commit `f080b24`
- [x] Phase B.1 — Paper close-source cleanup — commit `cb7facb` (closeout `63bbac4`)
  - [x] B.1 design approved by Codex (4 review rounds, final = APPROVE)
  - [x] B.1 implementation written to `dashboard.js` (3 hunks: helper hardening, CLOSE_POSITION rewrite, SELL_ALL rewrite)
  - [x] B.1 Codex implementation review = PASS-WITH-NOTES
  - [x] B.1 committed (`cb7facb`)
  - [x] B.1 closeout docs committed (`63bbac4`)
- [x] **Phase B.2a — Infrastructure: transactional helper + event_type CHECK extension — commit `a324290`** (closeout `f081b6f`)
  - [x] B.2a design audit found existing `updatePositionRiskLevels` already does similar work; chose Option β (additive transactional variant)
  - [x] B.2a design Codex-approved (3 review rounds: initial → Option β → final)
  - [x] B.2a pre-flight: live constraint name verified (`trade_events_event_type_check`) via safe non-secret-printing query
  - [x] B.2a implementation: new `updatePositionRiskLevelsTx(client, mode, orderId, fields)` in db.js (existing `updatePositionRiskLevels` untouched)
  - [x] B.2a implementation: new migration `007_event_type_sl_tp_updates.sql` (idempotent ALTER CHECK extending allowed event types from 8 to 10)
  - [x] `node --check db.js` PASS
  - [x] B.2a Codex implementation review = PASS-WITH-NOTES (no required edits)
  - [x] B.2a committed (`a324290`)
  - [x] B.2a migration 007 applied to production via `scripts/run-migrations.js`; verified via post-migration `pg_constraint` query
  - [x] **Side effect documented:** migration 006 also applied (runner applies all unapplied; 006 was on disk but unapplied). 006 is runtime-inert; no automatic behavior change. Do not revert without explicit safety review.
  - [x] HARD BLOCK on `db.js` and `migrations/` reinstated after B.2a commit (the lift was scoped to B.2a only)
- [x] **Phase B.2b-SL — Paper SET_STOP_LOSS DB-first caller integration in `dashboard.js` — commit `511f94e`** (closeout `e520db0`)
  - [x] Original B.2b (paper SL + paper TP) Codex implementation review = FAIL-WITH-CONDITIONS over a MEDIUM TP stale-overwrite risk (bot.js trailing/breakeven can write stale `take_profit` back to DB after rehydrate)
  - [x] Operator decision: split phase — keep SL, defer TP to a separate B.2c-TP track pending bot/dashboard TP conflict-policy design
  - [x] Implementation: new `shadowRecordManualPaperSLUpdate` wrapper in `dashboard.js` (calls `updatePositionRiskLevelsTx` + atomic `manual_sl_update` audit insert via `inTransaction`); event-id seed uses `Date.now()` + `crypto.randomBytes(4)` to avoid PK collision on repeated updates; no `position.json` or `LOG_FILE` write on the paper branch; caller throws on `!ok` (no JSON fallback)
  - [x] Live `SET_STOP_LOSS` byte-identical to pre-phase (still writes `position.json`; no DB call)
  - [x] `SET_TAKE_PROFIT` handler restored to pre-B.2b form (single shared paper+live path, `position.json` write only); `shadowRecordManualPaperTPUpdate` removed; no `manual_tp_update` references remain in `dashboard.js`
  - [x] Comment block at `dashboard.js:337–381` updated: B.2b covers paper SET_STOP_LOSS only, ratchet-up SL wording, migration 007 required for `manual_sl_update`, paper SET_TAKE_PROFIT explicitly deferred to B.2c with stale-overwrite reason
  - [x] `node --check dashboard.js` PASS
  - [x] B.2b-SL Codex re-review = PASS, safe to commit
  - [x] B.2b-SL committed (`511f94e`) — `dashboard.js` only; `bot.js`, `db.js`, `migrations/` untouched; `position.json.snap.20260502T020154Z` remained untracked
  - [x] HARD BLOCK on `dashboard.js` reinstated after B.2b-SL commit (the lift was scoped to B.2b-SL only)
- [x] **Phase B.2c-bot-preserve-TP — bot-side stale-TP overwrite fix in `bot.js` `manageActiveTrade` — commit `cc6bd2e`** (closeout `689dad4`)
  - [x] Design audit identified Option C (bot preserves DB `take_profit` when only updating SL) as the lowest-blast-radius conflict-resolution policy among five enumerated options (A=last-writer-wins, B=manual_tp_override flag, C=Option C, D=block-while-active, E=optimistic concurrency)
  - [x] B.2c-bot-preserve-TP design Codex-approved (PASS, lowest-complexity policy, `manageActiveTrade` provably never mutates `position.takeProfit`, `db.js` helper already supports partial updates)
  - [x] Implementation: payload at `bot.js:1519-1521` narrowed from `{ stop_loss, take_profit }` to `{ stop_loss }`. Comment block at `bot.js:1507-1516` documents the B.2c-bot-preserve-TP rationale and the B.2d gating relationship.
  - [x] Behavior invariants preserved: BREAKEVEN trigger (≥1.0% pnl), TRAIL trigger (≥1.5% pnl), SL calculation, `savePosition(position)` JSON write (mode-agnostic), `dbAvailable() && position.orderId` guard, fire-and-forget chain, `.catch` warn-log, `_pendingDbWrites.push`, return shape — all byte-identical to pre-phase
  - [x] Kraken execution paths untouched (no calls in this region)
  - [x] Live mode behavior preserved (`savePosition` still writes JSON for both modes; no DB write narrowing affects live since live path was always SL-only-touched here as well)
  - [x] `node --check bot.js` PASS
  - [x] B.2c-bot-preserve-TP Codex implementation review = PASS with notes
  - [x] **LOW concern (deferred):** `scripts/smoke-test-live-writes.js:225–239` wording is now stale ("active management dual-write" / "take_profit unchanged but rewritten"). Test logic remains valid because the script calls the `db.js` helper directly with both fields, and the helper still supports both-field calls. Cleanup deferred as cosmetic.
  - [x] B.2c-bot-preserve-TP committed (`cc6bd2e`) — `bot.js` only; `dashboard.js`, `db.js`, `migrations/`, and `scripts/smoke-test-live-writes.js` untouched; `position.json.snap.20260502T020154Z` remained untracked
  - [x] HARD BLOCK on `bot.js` reinstated after B.2c-bot-preserve-TP commit (the lift was scoped to B.2c-bot-preserve-TP only)
- [x] **Phase B.2d-dashboard-TP — Paper SET_TAKE_PROFIT DB-first caller integration in `dashboard.js` — commit `eca2659`** (closeout `1563310`)
  - [x] B.2d design audit produced a mirror-of-B.2b-SL design: new `shadowRecordManualPaperTPUpdate` wrapper, atomic `manual_tp_update` audit insert, no JSON fallback, throws on `!ok`, idempotency seed using `Date.now()` + `crypto.randomBytes(4)`
  - [x] B.2d design Codex-approved (PASS — bot-side prerequisite resolved by `cc6bd2e`, mirror fidelity to SL helper checked, residual TP write paths inventoried; one LOW concern about audit-row noise from repeated UI clicks, parity with SL helper)
  - [x] Implementation: new `shadowRecordManualPaperTPUpdate(dbPos, newTP)` in `dashboard.js` placed immediately after the SL wrapper. Paper `SET_TAKE_PROFIT` handler wrapped with `if (isPaper) { … }` paper-DB-first branch using `loadOpenPosition("paper")` + DB `entry_price` + `shadowRecordManualPaperTPUpdate`. Caller throws on `!ok` with operator-visible "Manual paper TP update not recorded in DB ({reason}). Take profit NOT updated." No `position.json` or `LOG_FILE` write on the paper branch.
  - [x] Live `SET_TAKE_PROFIT` byte-identical to pre-phase (existing `pos.open` guard, default pct 2.0, `pos.takeProfit` calc, `writeFileSync(POSITION_FILE, …)`, original success message)
  - [x] Comment block at `dashboard.js:337–385` updated: B.2c TP-deferral wording removed, B.2d active TP behavior documented, `cc6bd2e` cited as the bot-side prerequisite, migration 007 / `manual_tp_update` prerequisite mentioned, D-5.12 live-gate language preserved
  - [x] `node --check dashboard.js` PASS
  - [x] B.2d Codex implementation review = PASS, safe to commit, no required edits
  - [x] B.2d committed (`eca2659`) — `dashboard.js` only; `bot.js`, `db.js`, `migrations/`, and `scripts/` untouched; `position.json.snap.20260502T020154Z` remained untracked
  - [x] HARD BLOCK on `dashboard.js` reinstated after B.2d commit (the lift was scoped to B.2d only)
- [x] **Phase C — design-only audit (read-only).** Audit produced a 3-sub-phase split for the only operator-visible truth gap (manual SL/TP audit rows being write-only). Other audit targets (residual `position.json` reads, reconciliation playbook, bot.js rehydrate vs new TP write surface) confirmed safe / no-action-needed. Smoke-test wording cleanup kept as a separate deferred LOW/cosmetic phase. Sub-phases: C.1 (db.js read filter), C.2 (dashboard.js mapper + UI rendering), C.3 (`scripts/recovery-inspect.js` heuristic refinement).
- [x] **Phase C.1 — `db.js` `loadRecentTradeEvents` event-type filter expansion — commit `d0c8817`**
  - [x] C.1 design audit determined the smallest safe wedge: literal-only `WHERE … IN (…)` expansion at `db.js:422`. No SELECT / JOIN / ORDER BY / LIMIT / signature / migration changes.
  - [x] C.1 design Codex-approved (PASS — minimal change, single caller `dashboard.js:656`, no live-mode regression possible because dashboard wrappers hard-code `mode: "paper"`; two LOW concerns acknowledged: external monitoring dependencies cannot be ruled out from repo search alone; heavy SL/TP-edit sessions could transiently push lifecycle events past LIMIT 30 until C.2 lands)
  - [x] Implementation: WHERE clause at `db.js:425` extended from 6 to 8 event types. Added literals are exactly `'manual_sl_update'` and `'manual_tp_update'`. Original six (`buy_filled`, `exit_filled`, `manual_buy`, `manual_close`, `reentry_buy`, `reentry_close`) preserved byte-identical in original order. Comment block at `db.js:406-411` updated to cite Phase C.1 and document inclusion of manual SL/TP audit rows for dashboard visibility.
  - [x] Behavior invariants preserved: function signature `loadRecentTradeEvents(mode, limit = 30)`, `_requireMode` validation, SELECT column list, LEFT JOIN, `WHERE te.mode = $1`, `ORDER BY te.timestamp DESC`, `LIMIT $2`, bind params `[mode, limit]` — all byte-identical to pre-phase
  - [x] No write behavior changed: `insertTradeEvent`, `updatePositionRiskLevels`, `updatePositionRiskLevelsTx`, `loadOpenPosition`, all other helpers unchanged. Helper remains SELECT-only.
  - [x] No migration required (migration 007 from `a324290` already extended the CHECK constraint)
  - [x] No live trading behavior change (no live row of the new event types can exist; `mode = 'live'` query results unchanged)
  - [x] `node --check db.js` PASS
  - [x] C.1 Codex implementation review = PASS with notes
  - [x] **LOW concern (deferred to C.2 design):** C.1 design report mentioned a `dec_blocked` CSS class for the rough-rendering window, but the actual class name in `dashboard.js` is `mode-blocked`. C.2 design must verify exact class names (`mode-paper` / `mode-live` / `mode-blocked` / `dec-buy` / `dec-exit` / `dec-blocked`) before proposing labels.
  - [x] C.1 committed (`d0c8817`) — `db.js` only; `dashboard.js`, `bot.js`, `migrations/`, and `scripts/` untouched; `position.json.snap.20260502T020154Z` remained untracked
  - [x] HARD BLOCK on `db.js` reinstated after C.1 commit (the lift was scoped to C.1 only)
  - [x] **Intermediate rough-rendering window now open:** `manual_sl_update` / `manual_tp_update` rows can appear in the dashboard `recentTrades` payload; `_dbTradeEventToLegacyShape` default branch produces raw uppercase types until C.2 lands. `fired` counter unchanged (allowlist-based); P&L aggregates exclude SL/TP audit rows; LIMIT 30 unchanged. Bounded and reversible by C.2.

## Full B.2 paper-mode dual-truth track — closed

All paper-mode write paths are now DB-canonical:

| Path | DB-canonical since | Commit |
|---|---|---|
| Paper BUY (BUY_MARKET / OPEN_LONG) | Phase A.2 | `959fef7` |
| Paper CLOSE_POSITION | Phase B.1 | `cb7facb` |
| Paper SELL_ALL | Phase B.1 | `cb7facb` |
| Paper SET_STOP_LOSS | Phase B.2b-SL | `511f94e` |
| Paper SET_TAKE_PROFIT | Phase B.2d-dashboard-TP | `eca2659` |

Live-mode write paths remain `position.json`-only by design until **Phase D-5.12** (Live persistence gate lift). The only currently active remaining dual-truth surface in the system is the live-mode write path, which is intentional.

## Active phase

- [~] **Phase C.2 — design-only dashboard rendering review (deferred).** No active code work. Will close the rough-rendering window opened by C.1 by adding `_dbTradeEventToLegacyShape` cases for `manual_sl_update` / `manual_tp_update`, updating `renderTradeTable` placeholders, and adjusting the latest-decision badge logic (after verifying the actual `dashboard.js` class names).

## Future phases

- [ ] Phase C.2 — Dashboard mapper + UI rendering for `manual_sl_update` / `manual_tp_update` (`dashboard.js` only)
  - Add cases to `_dbTradeEventToLegacyShape` switch (`dashboard.js:584-591`) so the new event types map to a friendly type label (e.g., `SL_UPDATE` / `TP_UPDATE`) instead of falling through the `default` branch as raw uppercase.
  - Update `renderTradeTable` (`dashboard.js:6342-…`) to render risk-level edits with appropriate placeholders for null `price` / `quantity` / `total` and surface the metadata-driven "old → new" values.
  - Update the latest-decision badge logic (`dashboard.js:7299-7304`). **C.2 design must verify the actual class names** (`mode-paper` / `mode-live` / `mode-blocked` / `dec-buy` / `dec-exit` / `dec-blocked`) before proposing any new label or class — Codex flagged that the C.1 design report mentioned `dec_blocked`, but the real class observed in `dashboard.js` is `mode-blocked`.
  - Required: `dashboard.js` HARD BLOCK lift for C.2 (scoped, precedent: B.2b-SL / B.2d).
  - Required: Codex design review.
  - Required: explicit operator authorization.
- [ ] Phase C.3 — `scripts/recovery-inspect.js` heuristic refinement (`scripts/` only)
  - Update the null-FK trade_events heuristic at `scripts/recovery-inspect.js:159` to recognize `manual_sl_update` / `manual_tp_update` as benign event types (currently they would be tagged "suspicious — review" if a null-FK row of these types ever appeared, which the B.2b-SL / B.2d helpers prevent by skipping `insertTradeEvent` on `!positionId`).
  - Required: `scripts/` HARD BLOCK lift for C.3 (scoped).
  - Required: Codex design review.
  - Required: explicit operator authorization.
  - Lower priority than C.2; the current behavior is "flag for review" not "fail," so the heuristic is conservative-safe today.
- [ ] Smoke-test wording cleanup in `scripts/smoke-test-live-writes.js:225-239` — refresh the step label and the "take_profit unchanged but rewritten" assertion message to reflect that `bot.js` no longer rewrites `take_profit` from manage-update. LOW priority / cosmetic; not a blocker for C.2 or C.3. Best run after the Phase C track closes so the cleanup can also reflect any wording impact from C.2 / C.3.
- [ ] Phase D-5.12 — Live persistence gate lift (live mode JSON → DB-authoritative)
  - Required before live `SET_STOP_LOSS` / `SET_TAKE_PROFIT` / `SELL_ALL` can be moved to DB-first
- [ ] Phase O-5 — Bug Audit System
- [ ] Phase O-6 — Security Audit System
- [ ] Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist now schema-unblocked after migration 006 applied)
- [ ] Phase O-8 — Performance & Reliability Upgrades
- [ ] Future reliability item — DB statement timeout via Postgres-side cancellation (`statement_timeout` / `pg_cancel_backend`); not JS-side `Promise.race`
- [ ] Future reliability item — fix latent CLOSE_POSITION live-side stale-source pattern (deferred to D-5.12 since live is JSON-authoritative)

## High-risk approval gates

| Gate | Requires | Status |
|---|---|---|
| `db.js` modifications | Operator approval | Closed (post-C.1; lift was scoped) |
| `migrations/` modifications | Operator approval | Closed (post-B.2a; lift was scoped) |
| `dashboard.js` modifications | Operator approval | Closed (post-B.2d-dashboard-TP; lift was scoped) |
| `bot.js` modifications | Operator approval | Closed (post-B.2c-bot-preserve-TP; lift was scoped) |
| `scripts/` modifications | Operator approval | Closed (Phase C.3 heuristic refinement and smoke-test wording cleanup remain separate deferred phases) |
| Live mode write-path changes | Operator approval + Phase D-5.12 | Closed |
| Phase C.2 implementation | Codex design review + `dashboard.js` scoped lift + operator authorization | Closed |
| Phase C.3 implementation | Codex design review + `scripts/` scoped lift + operator authorization | Closed |
| Force push / `git reset --hard` / rebase | Explicit operator command | Closed |
| Deployment to Railway | Explicit operator command | Closed |
| Adding new `event_type` values beyond the current 10 | Migration + operator approval | Closed |
| Touching SL / TP / BE / trailing stop logic in bot.js | Explicit operator command | Closed |
| Real-money behavior changes | Operator approval + live mode gate | Closed |
| Reverting migration 006 (drop columns) | Explicit safety review (destructive) | Closed |
