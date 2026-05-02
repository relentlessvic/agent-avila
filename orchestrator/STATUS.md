# Orchestrator Status

Last updated: 2026-05-02

## Current phase

**Phase C.3 — closed (source committed `1a16dd8`).** `scripts/recovery-inspect.js` `showNullFkTradeEvents(mode)` heuristic refined: the previous 1-line ternary at line 159 (split between `_attempt$` "expected" and a default "suspicious" tag) is now a 3-way classification — `_attempt$` → "expected — failed attempt", `manual_sl_update` / `manual_tp_update` → "audit-only — investigate if seen", everything else → "suspicious — review". A function-local `AUDIT_ONLY_EVENT_TYPES` Set holds the new types. SQL query, SAFETY CONTRACT, function signature, bind params, and per-row `console.log` print pattern are all unchanged. `scripts/recovery-inspect.js`-only; `dashboard.js` / `bot.js` / `db.js` / `migrations/` / `scripts/smoke-test-live-writes.js` untouched. Codex implementation review = PASS, all checklist items PASS, no required edits.

**Full Phase C track is now functionally landed.** All three sub-phases closed:
- **C.1** — `db.js` `loadRecentTradeEvents` admits `manual_sl_update` / `manual_tp_update` (`d0c8817`, closeout `a967a12`)
- **C.2** — `dashboard.js` mapper + dedicated "Recent Risk Edits" panel in the Performance tab (`2d10107`, closeout `1372392`)
- **C.3** — `scripts/recovery-inspect.js` 3-way classification of audit-only event types (`1a16dd8`)

The C.1 rough-rendering / visibility gap closed by C.2; the operator-playbook misclassification gap closed by C.3.

**Codex non-blocking notes from the C.3 implementation review (informational, not required edits):**
- Any in-repo runbooks quoting old classification wording should be updated if found. (No blocking surface identified during the review.)
- Future audit-only event types (beyond `manual_sl_update` / `manual_tp_update`) must be manually added to `AUDIT_ONLY_EVENT_TYPES` — no mechanism currently enforces this. Track at the migration-author level: any new audit-only `event_type` introduced in a future migration should ship alongside a one-line update to this Set.

**Full B.2 paper-mode dual-truth track remains functionally landed.** All paper-mode write paths are DB-canonical:
- paper BUY DB-first (Phase A.2, `959fef7`)
- paper CLOSE DB-first (Phase B.1, `cb7facb`)
- paper SELL_ALL DB-first (Phase B.1, `cb7facb`)
- paper SET_STOP_LOSS DB-first (Phase B.2b-SL, `511f94e`)
- paper SET_TAKE_PROFIT DB-first (Phase B.2d, `eca2659`)

Live-mode write paths remain `position.json`-only behind Phase D-5.12.

## Recent commits (most recent first)

| Phase | Commit | Description |
|---|---|---|
| Phase C.3 | `1a16dd8` | Phase C.3: classify manual SL/TP audit events in recovery inspect |
| Phase C.2 closeout | `1372392` | Phase C.2 closeout: update STATUS, CHECKLIST, NEXT-ACTION |
| Phase C.2 | `2d10107` | Phase C.2: render manual SL/TP risk edits in performance dashboard |
| Phase C.1 closeout | `a967a12` | Phase C.1 closeout: update STATUS, CHECKLIST, NEXT-ACTION |
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
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`), B.2c-bot-preserve-TP (`cc6bd2e`), B.2d-dashboard-TP (`eca2659`), C.1 (`d0c8817`), C.2 (`2d10107`), and C.3 (`1a16dd8`) commits; explicitly excluded from all commits.
- `scripts/smoke-test-live-writes.js:225–239` — wording is still stale ("active management dual-write" / "take_profit unchanged but rewritten") because `bot.js` no longer rewrites `take_profit` from manage-update. Test logic remains valid (it calls the helper directly, which still supports both fields). Cleanup tracked as LOW/cosmetic; the Phase C track has now closed (C.1 + C.2 + C.3 landed), so this is the natural next safe action.

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
| Phase C.1 — implementation | Closed, committed `d0c8817` (Codex implementation review = PASS with notes; one LOW cosmetic class-name discrepancy in C.1 design report wording, deferred to C.2 design verification) — closeout `a967a12` |
| Phase C.2 — design | Codex APPROVE-WITH-REQUIRED-EDITS (Option B — dedicated "Recent Risk Edits" panel; required edits: MEDIUM "displayed window" caveat for shared LIMIT 30, LOW Order ID escaping via btEsc) |
| Phase C.2 — implementation | Closed, committed `2d10107` (Codex implementation review = PASS, all 41 checklist items PASS, no required edits; both required edits from design review confirmed present) — closeout `1372392` |
| Phase C.3 — design | Codex APPROVE-WITH-REQUIRED-EDITS (3-way classification — `_attempt$` / audit-only / suspicious; one LOW required edit: replace "review if non-zero" wording with "investigate if seen") |
| Phase C.3 — implementation | **Closed, committed `1a16dd8` (Codex implementation review = PASS, all checklist items PASS, no required edits; required wording edit from design review confirmed present)** |
| Full Phase C track | **Functionally landed.** C.1 (read filter) + C.2 (Recent Risk Edits panel) + C.3 (recovery-inspect heuristic refinement) all closed. Manual SL/TP audit visibility complete from DB read → UI render → operator-playbook classification. |

## Current allowed next action

> **Smoke-test wording cleanup design-only review. LOW/cosmetic. No code.**

The full Phase C track has now closed; the natural next item is the deferred LOW/cosmetic smoke-test wording cleanup. `scripts/smoke-test-live-writes.js:225–239` step label ("active management dual-write") and assertion message ("take_profit unchanged but rewritten") have been stale since the B.2c-bot-preserve-TP commit (`cc6bd2e`) narrowed bot.js's manage-update payload to `{ stop_loss }` only. Test logic still passes because the script calls the `db.js` helper directly with both fields, and the helper still supports both-field calls. The cleanup is purely wording — no logic change, no test-assertion change beyond the message strings.

This phase cannot enter implementation until: Codex design review, explicit operator authorization, and a scoped `scripts/smoke-test-live-writes.js` HARD BLOCK lift (mirror of the C.3 scoped lift discipline).

The operator may also choose to advance an alternative phase instead:
- Phase D-5.12 — Live persistence gate lift (only remaining write-side dual-truth surface; requires its own design audit and operator-led safety review)
- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist now schema-unblocked after migration 006 applied)
- Phase O-8 — Performance & Reliability Upgrades

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
- Editing `dashboard.js` (HARD BLOCK reinstated post-C.2; the C.2 lift was scoped to that phase only)
- Editing `scripts/recovery-inspect.js` (HARD BLOCK reinstated post-C.3; the C.3 lift was scoped to that phase only)
- Editing `scripts/smoke-test-live-writes.js` (smoke-test wording cleanup is now the recommended next safe action; lift required)
- Editing any other `scripts/` file (default HARD BLOCK; lift required per file)
- Phase D-5.12 implementation (live persistence gate lift — design-only review pending; safety review required)
- Touching live trading logic
- Touching Kraken execution
- Touching SL / TP / breakeven / trailing stop / position management logic in bot.js
- Deploying or pushing to remote
- Force push, `git reset --hard`, interactive rebase, branch deletion, file deletion
- Reverting migration 006 (destructive — explicit safety review required)

## Current risk level

**LOW.** No uncommitted code. Full paper-mode write surface is DB-canonical: paper BUY (`959fef7`), CLOSE/SELL_ALL (`cb7facb`), SET_STOP_LOSS (`511f94e`), SET_TAKE_PROFIT (`eca2659`). Both `manual_sl_update` and `manual_tp_update` are now live event types with active dashboard-driven inserts (B.2b-SL / B.2d), active dashboard reads (C.1, `d0c8817`), active dashboard rendering via the dedicated "Recent Risk Edits" panel (C.2, `2d10107`), and active operator-playbook classification in `recovery-inspect.js` (C.3, `1a16dd8`). `bot.js` `manageActiveTrade` no longer overwrites DB `take_profit` from in-memory state (`cc6bd2e`). Paper dashboard edits cannot be silently overwritten by bot rehydrate.

**All Phase C visibility gaps closed.** Read filter (C.1), UI rendering (C.2), and operator-playbook classification (C.3) all landed. `fired` counter, P&L aggregates, win-loss aggregates, and `renderTradeTable` are all unchanged (allowlist / exit-only filtering preserves the existing semantics).

**No remaining paper dual-truth surface.** The only remaining write-side dual-truth surface in the system is **live mode**: live `SET_STOP_LOSS` / `SET_TAKE_PROFIT` / `SELL_ALL` paths still write `position.json` directly without a DB update. This is intentional and gated behind Phase D-5.12 (Live persistence gate lift). Until D-5.12 lifts, live mode remains JSON-authoritative by design. D-5.12 has its own design-only review pending and is NOT started.
