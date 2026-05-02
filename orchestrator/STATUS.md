# Orchestrator Status

Last updated: 2026-05-02

## Current phase

**Phase D-5.12a — closed (design-only; v4 PASS WITH NOTES).** Live persistence gate lift design audit produced a 4-iteration design refinement track: v1 (Codex PASS-WITH-EDITS, 5 HIGH/MEDIUM concerns) → v2 (PASS-WITH-EDITS, 4 required + 2 MEDIUM schema concerns) → v3 (PASS-WITH-EDITS, 5 required + 5 minor concerns) → v4 (Codex PASS WITH NOTES; 9 LOW operational concerns; **none are design blockers**). Operator accepted all eight design decision defaults (see "Operator decision defaults — accepted for D-5.12" below). D-5.12 sub-phase plan is approved (D-5.12b through D-5.12i). **No code, no commits, no migrations, no deploys, no edits to dashboard.js / bot.js / db.js / scripts/ / migrations/ during D-5.12a.** Next safe action is D-5.12b (manual live gating), gated behind a scoped `dashboard.js` HARD BLOCK lift.

**Smoke-test wording cleanup — closed (source committed `735b10f`).** `scripts/smoke-test-live-writes.js` four wording sites refreshed: file-header coverage table at line 11, Step 3 banner at line 225, Step 3 operator-visible label at line 226, and Step 3 assertion message at line 238. New line 238 message: `"take_profit round-trips through helper both-field path"`. The stale "active management dual-write" / "take_profit unchanged but rewritten" wording (which had been inaccurate since B.2c-bot-preserve-TP narrowed bot.js's manage-update payload to `{ stop_loss }` only) is removed from the script. Test logic byte-identical: helper call, fixture constants, assertion booleans, cleanup, exit codes, imports, SAFETY framing all preserved. Codex implementation review = PASS with notes (three LOW-severity informational notes about stale wording in archival prose, line-11 length, and speculative label-string matchers — none blocking).

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
| Smoke-test wording cleanup | `735b10f` | smoke-test wording cleanup |
| Phase C.3 closeout | `a18b9be` | Phase C.3 closeout: update STATUS, CHECKLIST, NEXT-ACTION |
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
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`), B.2c-bot-preserve-TP (`cc6bd2e`), B.2d-dashboard-TP (`eca2659`), C.1 (`d0c8817`), C.2 (`2d10107`), C.3 (`1a16dd8`), and smoke-test wording cleanup (`735b10f`) commits; explicitly excluded from all commits.
- `scripts/smoke-test-live-writes.js` wording cleanup — **closed** (`735b10f`). The stale "active management dual-write" / "take_profit unchanged but rewritten" wording is gone; line 238 now reads `"take_profit round-trips through helper both-field path"`. Test logic byte-identical.

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
| Phase C.3 — implementation | Closed, committed `1a16dd8` (Codex implementation review = PASS, all checklist items PASS, no required edits; required wording edit from design review confirmed present) — closeout `a18b9be` |
| Full Phase C track | **Functionally landed.** C.1 (read filter) + C.2 (Recent Risk Edits panel) + C.3 (recovery-inspect heuristic refinement) all closed. Manual SL/TP audit visibility complete from DB read → UI render → operator-playbook classification. |
| Smoke-test wording cleanup — design | Codex APPROVE (4-site wording-only refresh; three LOW-severity informational concerns about archival prose, line-11 length, and speculative label-string matchers — none blocking) |
| Smoke-test wording cleanup — implementation | Closed, committed `735b10f` (Codex implementation review = PASS with notes; verbatim match against the approved design at all four sites; no test-logic changes) — closeout `026252a` |
| Phase D-5.12a — design (v1) | Codex PASS-WITH-EDITS (5 HIGH/MEDIUM concerns: manual gating order, P0-L3 unique-index race, fail-loud DB-failure policy, SELL_ALL split, helper-strategy decision; plus three hidden risks added) |
| Phase D-5.12a — design (v2) | Codex PASS-WITH-EDITS (4 required: emergency-audit double-fault, MANUAL_LIVE_ARMED two-layer, /api/control TOCTOU, interim-state invariant; plus 2 MEDIUM schema hardenings) |
| Phase D-5.12a — design (v3) | Codex PASS-WITH-EDITS (5 required: canonical event_id, staged-rollout smoke checklist, triple-fault stderr contract, operator decision #8, D-5.12h harness scope; plus 5 minor concerns folded in) |
| Phase D-5.12a — design (v4) | **Codex PASS WITH NOTES — design ready for operator decision gates.** All v3 required edits incorporated; all 5 minor concerns folded in. 9 LOW operational concerns flagged (none blocking). |
| Phase D-5.12 — operator decision gates | **All 8 defaults accepted.** Decisions enumerated in "Operator decision defaults — accepted for D-5.12" section below. |
| Phase D-5.12b through D-5.12i | Deferred — design-only state. D-5.12b (manual live gating) is the next planned phase but has not started; requires scoped `dashboard.js` HARD BLOCK lift before implementation. |

## Current allowed next action

> **Phase D-5.12b — manual live gating implementation (`MANUAL_LIVE_ARMED` two-layer check). Awaiting scoped `dashboard.js` HARD BLOCK lift.**

D-5.12a closed with Codex PASS WITH NOTES (v4) and operator-accepted defaults for all 8 decisions. The next sub-phase is D-5.12b: implement the `MANUAL_LIVE_ARMED` env-var gate at `/api/trade` POST entry AND inside `handleTradeCommand` at `dashboard.js:1434-1439` (defense-in-depth). Add `/api/control` transition-lock (process-local mutex, lock-acquired-before-read). Implementation cannot proceed until: scoped `dashboard.js` HARD BLOCK lift, Codex design review of the D-5.12b implementation diff, and explicit operator authorization.

The operator may also choose to advance an alternative phase instead:
- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist now schema-unblocked after migration 006 applied)
- Phase O-8 — Performance & Reliability Upgrades

## Operator decision defaults — accepted for D-5.12

All 8 defaults from the v4 design were accepted by the operator at D-5.12a closeout:

| # | Decision | Accepted default |
|---|---|---|
| 1 | SELL_ALL semantics | Close one known bot position only. "Sell all holdings" is a separately armed future action, not part of D-5.12f. |
| 2 | DB-failure-after-Kraken policy | Fail-loud + emergency audit + LOG_FILE/stderr double-fault fallback + triple-fault stderr-only fallback. **No JSON fallback at any layer.** |
| 3 | Live DB-to-position.json rehydrate policy | Enable in D-5.12h only after D-5.12d/e/f/g have landed with JSON cache intact. |
| 4 | `MANUAL_LIVE_ARMED` env var (two-layer check) | Add separate `MANUAL_LIVE_ARMED` env var; check at both `/api/trade` entry AND inside `handleTradeCommand` (Layer 2 at `dashboard.js:1434-1439`). |
| 5 | Event_type naming | Reuse existing `manual_*` event types and differentiate live vs paper by mode column (mode-agnostic per migration 007). |
| 6 | Emergency audit surface | Separate `emergency_audit_log` table via migration 008 with `event_id UNIQUE` (canonical SHA-256 recipe), `mode CHECK`, `retry_history` append, and triage indexes. |
| 7 | Transition-lock implementation | Process-local mutex with lock-before-read. Valid only while Railway dashboard is single-replica. Postgres advisory lock becomes required if multi-replica scaling is introduced. |
| 8 | `MANUAL_LIVE_ARMED` env-var-only vs DB-backed immediate-disarm | Env-var-only for D-5.12. DB-backed immediate-disarm is a post-D-5.12 enhancement (D-5.13 candidate). |

## Codex v4 LOW operational notes — carried forward to downstream sub-phases

Nine LOW operational concerns flagged in the v4 review. None are design blockers. Tracked for incorporation into the relevant downstream sub-phase docs:

1. **Canonical event_id precision** — kraken_order_id always string, UTC ISO bucket math platform-stable. Fold into D-5.12c helper design.
2. **`retry_history` growth/retention** — unbounded retry array could grow beyond Postgres TOAST limits under storms. Cap or retention note in D-5.12c.
3. **All-handler smoke deploy-velocity** — staging Kraken API quota / mocked-harness mitigates, but flag for D-5.12d/e/f/g closeouts.
4. **Railway stderr retention is finite** — stderr is the floor of durability but loses beyond Railway's retention window; operator must act within that window. Fold into D-5.12i operator playbook.
5. **Process-local lock check/set must avoid async yield** — Node event-loop semantics; review required in D-5.12b.
6. **D-5.12h testcontainer infrastructure** — existing repo shows no testcontainer; D-5.12h must build or document it (added scope).
7. **Emergency audit latency budget** — emergency audit insert is on real-money critical path; correctness dominates but operator playbook in D-5.12i should document acceptable latency range.
8. **Deploy warning is documentation-only** — no CI/tooling enforcement of the all-handler smoke checklist; acceptable for D-5.12, recommended as D-5.13 hardening item.
9. **Emergency rows retention/export format** — pre-rollback export format not specified; add to D-5.12i operator playbook.

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
- Editing `scripts/smoke-test-live-writes.js` (HARD BLOCK reinstated post-smoke-test-cleanup; the lift was scoped to that phase only)
- Editing any other `scripts/` file (default HARD BLOCK; lift required per file)
- Phase D-5.12b implementation (manual live gating — design closed; awaiting scoped `dashboard.js` HARD BLOCK lift + Codex implementation review)
- Phase D-5.12c through D-5.12i implementation (live helper wrappers, OPEN_LONG/CLOSE/SELL_ALL/SL/TP persistence, rehydrate, smoke harness, closeout — design closed; require sequential per-sub-phase scoped HARD BLOCK lifts)
- Touching live trading logic
- Touching Kraken execution
- Touching SL / TP / breakeven / trailing stop / position management logic in bot.js
- Deploying or pushing to remote
- Force push, `git reset --hard`, interactive rebase, branch deletion, file deletion
- Reverting migration 006 (destructive — explicit safety review required)

## Current risk level

**LOW.** No uncommitted code. Full paper-mode write surface is DB-canonical: paper BUY (`959fef7`), CLOSE/SELL_ALL (`cb7facb`), SET_STOP_LOSS (`511f94e`), SET_TAKE_PROFIT (`eca2659`). Both `manual_sl_update` and `manual_tp_update` are live event types with active dashboard-driven inserts (B.2b-SL / B.2d), active dashboard reads (C.1, `d0c8817`), active dashboard rendering via the dedicated "Recent Risk Edits" panel (C.2, `2d10107`), and active operator-playbook classification in `recovery-inspect.js` (C.3, `1a16dd8`). `bot.js` `manageActiveTrade` no longer overwrites DB `take_profit` from in-memory state (`cc6bd2e`). Paper dashboard edits cannot be silently overwritten by bot rehydrate. Smoke-test wording is now consistent with the post-B.2c bot-side state (`735b10f`).

**All Phase C visibility gaps closed.** Read filter (C.1), UI rendering (C.2), and operator-playbook classification (C.3) all landed. `fired` counter, P&L aggregates, win-loss aggregates, and `renderTradeTable` are all unchanged (allowlist / exit-only filtering preserves the existing semantics). Smoke-test wording cleanup (`735b10f`) brings test-suite documentation in line with the post-B.2c bot-side payload narrowing.

**No remaining paper dual-truth surface.** The only remaining write-side dual-truth surface in the system is **live mode**: live `SET_STOP_LOSS` / `SET_TAKE_PROFIT` / `SELL_ALL` (and `OPEN_LONG` / `CLOSE_POSITION`) paths still write `position.json` directly without a DB update. This is intentional and gated behind Phase D-5.12 (Live persistence gate lift). Until D-5.12 lifts, live mode remains JSON-authoritative by design. **D-5.12a design is closed (Codex v4 PASS WITH NOTES); operator decisions accepted; D-5.12b through D-5.12i implementation has NOT started. No code, commits, migrations, deployments, or runtime/trading file edits occurred during D-5.12a review.** **No O-* automation phase has started.**
