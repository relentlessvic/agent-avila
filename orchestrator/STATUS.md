# Orchestrator Status

Last updated: 2026-05-02

## Current phase

**Phase D-5.12e — closed (source committed `95f39f2`); closeout docs committed.** Live CLOSE_POSITION DB-first persistence wired through the failure ladder. `dashboard.js`-only diff (+145 / -10). Replaces the pre-existing JSON-only live CLOSE branch (which used stale `pos` from `position.json`, called Kraken sell against `pos.quantity`, then unconditionally wrote LOG_FILE + `position.json {open: false}`) with a DB-first failure-ladder block: pre-Kraken `loadOpenPosition("live")` is the canonical source (throws "No open live position to close" if null, BEFORE Kraken executes); Kraken sell uses `parseFloat(dbPos.quantity).toFixed(8)` (no balance check added); pnl computed from DB `entry_price` and `trade_size_usd`; after Kraken success, `shadowRecordManualLiveClose(exitEntry)` is invoked. **On helper success:** write `position.json {open: false}` compatibility cache, best-effort try/catch LOG_FILE append, set `balanceCache = null`, return existing live-close response shape. **On helper failure:** map `r.reason === "no_open_position"` → `failure_class: "kraken_post_success_db_no_open_position"`; otherwise → `"kraken_post_success_db_other_error"`. Helper-provided `r.emergency_context` preferred when present; otherwise call-site computes fallback `attempted_payload` from `dbPos` + `exitEntry` values via `_redactAttemptedPayload(...)` with the helper-matching field shape (9 fields: `symbol: exitEntry.symbol`, `exit_price`, `exit_time`, `exit_reason`, `quantity`, `trade_size_usd`, `realized_pnl_usd`, `realized_pnl_pct`, `kraken_exit_order_id`), `attempted_payload_hash = sha256HexCanonical(attempted_payload)`, hash injected post-canonicalization via `attempted_payload.attempted_payload_hash = attempted_payload_hash`. Calls `_emergencyAuditWrite(failureContext)` (Layer 2). On audit success: structured operator-visible `log.error` with `no_open_position` distinction or generic. On audit failure: builds JSON reconstruction line carrying `auditResult.event_id ?? null`, `attempted_payload`, `attempted_payload_hash`, `prior_failures`, timestamp; calls `_loglineFallback(line)` (Layer 3 → LOG_FILE; Layer 4 stderr triple-fault floor). **Per Codex v2 design ruling option (b):** `balanceCache = null` runs on EVERY post-Kraken outcome — success path AND every DB-failure class — placed AFTER audit/log work and BEFORE the conditional throws (OUTSIDE the `auditResult.ok` if/else logging branch). Kraken transacted in every post-Kraken path, so cached pre-sell balances would mislead the operator through `/api/balance` for up to 30s. Operator-visible pointer-only error thrown — does NOT include `attempted_payload`. No `position.json` write on DB failure. No LOG_FILE success-row append on DB failure. No Kraken cancellation. No auto-retry. Codex implementation review took two rounds: round 1 = FAIL [HIGH] over `symbol: dbPos.symbol` in the call-site fallback (would diverge from helper-internal `exitEntry.symbol` if `CONFIG.symbol` ever drifted, producing non-byte-stable emergency hashes); round 2 (post-revision: targeted one-line swap to `symbol: exitEntry.symbol`) = **PASS, safe to commit** (all 6 sub-items PASS). No `bot.js` / `db.js` / `migrations/` / `scripts/` / `orchestrator/` changes. Migration 008 (`emergency_audit_log`) remains **NOT applied to production** — separate explicit operator authorization gate; this is a HARD prerequisite before any D-5.12d/e production deploy or live exercise per accepted v2 design. **Remaining live dual-truth surfaces:** SELL_ALL (D-5.12f), SET_STOP_LOSS / SET_TAKE_PROFIT (D-5.12g).

**Phase D-5.12d — closed (source committed `1c20177`); closeout docs committed.** Live OPEN_LONG / BUY_MARKET persistence wired through the failure ladder. `dashboard.js`-only diff (+146 / -3). Replaces the pre-existing JSON-only live BUY branch (the two `writeFileSync` calls + LOG_FILE append) with a DB-first failure ladder that calls `shadowRecordManualLiveBuy(entry, newPos)` after `execKrakenOrder` returns. On helper success: write `position.json` compatibility cache, best-effort LOG_FILE append, set `balanceCache = null`, fall through to existing return shape. On helper failure: map `r.errorClass === "unique_violation_one_open_per_mode"` → `failure_class: "kraken_post_success_db_unique_violation"`; otherwise `"kraken_post_success_db_other_error"`. Build `failureContext` (mode, source, kraken_order_id, failure_class, error_message, attempted_payload). Call `_emergencyAuditWrite(failureContext)` (Layer 2). On audit success: structured operator-visible `log.error` with P0-L3 distinction. On audit failure: build a JSON reconstruction line carrying `auditResult.event_id ?? null`, `attempted_payload`, `attempted_payload_hash`, `prior_failures`, and timestamp; call `_loglineFallback(line)` (Layer 3 → LOG_FILE; Layer 4 stderr triple-fault floor inside `_loglineFallback`). No `position.json` write on DB failure. No LOG_FILE success-row append on DB failure. No Kraken cancellation. No auto-retry. Operator-visible pointer-only error thrown — does NOT include `attempted_payload`. Codex implementation review took two rounds: round 1 = FAIL [HIGH] over the early-return `db_unavailable` / `validation_failed` paths defaulting `attempted_payload` to `{}` (loses reconstruction context exactly when audit recovery is most critical); round 2 (post-revision: when `r.emergency_context` is missing, the call-site computes a fallback `attempted_payload` locally from `newPos` via `_redactAttemptedPayload(...)` with the helper-matching field shape and `attempted_payload_hash = sha256HexCanonical(attempted_payload)`; helper-provided `r.emergency_context` is preferred when present) = **PASS, safe to commit** (all 21 sub-items PASS). No `bot.js` / `db.js` / `migrations/` / `scripts/` changes. Migration 008 (`emergency_audit_log`) remains **NOT applied to production** — separate explicit operator authorization gate; this is a HARD prerequisite before any D-5.12d production deploy or live production exercise per accepted v2 design.

**Phase D-5.12c — closed (source committed `4ae3689`).** Live helper wrappers + Migration 008 (`emergency_audit_log`) + `db.js` emergency-audit insert helper + dashboard.js emergency utility helpers. Implementation diff: `dashboard.js` (+379 lines), `db.js` (+118 lines), new `migrations/008_emergency_audit_log.sql` (46 lines). Adds: (1) four `shadowRecordManualLive{Buy,Close,SLUpdate,TPUpdate}` wrappers in dashboard.js mirroring paper-helper return contract `{ ok, reason, error?, errorClass?, emergency_context? }` with `mode: "live"` hard-coded; (2) `db.js` `insertEmergencyAuditLog(client, event)` with `ON CONFLICT (event_id) DO UPDATE` appending `metadata.retry_history` via `jsonb_set`, preserving first-attempt `attempted_payload` and `error_message` via `COALESCE`; (3) `db.js` `buildEmergencyEventId(allowlistedPayload)` (canonical SHA-256 with `d512-emergency-` prefix); (4) `db.js` `sha256HexCanonical(obj)` (RFC-8785-style canonicalization); (5) `db.js` `classifyDbError(err)` returning `unique_violation_one_open_per_mode` / `unique_violation_kraken_order_id` / `other`; (6) dashboard.js `_emergencyAuditWrite(failureContext)` (fresh `inTransaction`), `_loglineFallback(line)` (LOG_FILE append + stderr `triple_fault` fallback), `_redactAttemptedPayload(rawObj)` (recursive secret/key/token/cookie/auth/signature/password/credential/nonce stripping); (7) `migrations/008_emergency_audit_log.sql` with operator warning header forbidding runner application without explicit authorization, 13 columns, inline `mode CHECK`, `event_id TEXT NOT NULL UNIQUE`, four triage indexes (`unresolved`, `kraken_order_id`, `source/timestamp`, `failure_class/timestamp`). `attempted_payload_hash` stored in BOTH the event_id allowlist AND inside `attempted_payload`. Helpers remain unused at end of phase — D-5.12d/e/f/g call-sites wire them. Codex review: design v1 = PASS-WITH-REQUIRED-EDITS (3 HIGH + 1 MEDIUM); v2 = **PASS, design ready for operator scoped-file approval**. Implementation review round 1 = FAIL [MEDIUM] over `classifyDbError` constraint-name mismatch (`positions_kraken_order_id_key` vs actual `positions_kraken_order_unique`); round 2 post-revision = **PASS, safe to commit** (all 22 sub-items PASS).

**Phase D-5.12b — closed (source committed `24246d8`).** Manual live gating implementation in `dashboard.js`. Adds defense-in-depth `MANUAL_LIVE_ARMED` env-var gating across two layers (Layer 1 at `/api/trade` POST entry; Layer 2 inside `handleTradeCommand` after `isPaper` derivation), plus `/api/control` SET_MODE lock-before-read with a scoped under-lock re-read of `CONTROL_FILE` so `_ctrlReadable` / `ctrl.killed` / the SET_MODE `writeFileSync` operate on a snapshot coherent with the transition-lock window. New `MANUAL_LIVE_COMMANDS` Set (six tokens: `BUY_MARKET`, `OPEN_LONG`, `CLOSE_POSITION`, `SELL_ALL`, `SET_STOP_LOSS`, `SET_TAKE_PROFIT`). No DB-write changes, no helper additions, no migration created, no Kraken / SL / TP / breakeven / trailing-stop changes. `bot.js` / `db.js` / `migrations/` / `scripts/` untouched. Codex implementation review took two rounds: round 1 = FAIL [MEDIUM] over a stale outer ctrl snapshot consumed by the SET_MODE preflight after lock acquisition; round 2 (post-revision applying Codex's own option (b)) = **PASS, safe to commit** (all 34 sub-items PASS).

**Phase D-5.12a — closed (design-only; v4 PASS WITH NOTES).** Live persistence gate lift design audit produced a 4-iteration design refinement track: v1 (Codex PASS-WITH-EDITS, 5 HIGH/MEDIUM concerns) → v2 (PASS-WITH-EDITS, 4 required + 2 MEDIUM schema concerns) → v3 (PASS-WITH-EDITS, 5 required + 5 minor concerns) → v4 (Codex PASS WITH NOTES; 9 LOW operational concerns; **none are design blockers**). Operator accepted all eight design decision defaults (see "Operator decision defaults — accepted for D-5.12" below). D-5.12 sub-phase plan is approved (D-5.12b through D-5.12i). **No code, no commits, no migrations, no deploys, no edits to dashboard.js / bot.js / db.js / scripts/ / migrations/ during D-5.12a.** D-5.12b has now landed; next safe action is D-5.12c (live helper wrappers + Migration 008 emergency_audit_log).

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
| Phase D-5.12e | `95f39f2` | Phase D-5.12e: live CLOSE_POSITION DB-first persistence |
| Phase D-5.12d closeout | `d8f5950` | Phase D-5.12d closeout: update STATUS, CHECKLIST, NEXT-ACTION |
| Phase D-5.12d | `1c20177` | Phase D-5.12d: preserve live BUY emergency reconstruction payload |
| Phase D-5.12c closeout | `e2583df` | Phase D-5.12c closeout: update STATUS, CHECKLIST, NEXT-ACTION |
| Phase D-5.12c | `4ae3689` | Phase D-5.12c: add live helper wrappers and emergency audit log |
| Phase D-5.12b closeout | `58951ee` | Phase D-5.12b closeout: update STATUS, CHECKLIST, NEXT-ACTION |
| Phase D-5.12b | `24246d8` | Phase D-5.12b: add manual live gating |
| Phase D-5.12a closeout | `8340aec` | Phase D-5.12a closeout: record v4 design acceptance |
| Smoke-test wording cleanup closeout | `026252a` | Smoke-test wording cleanup closeout: update STATUS, CHECKLIST, NEXT-ACTION |
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

- **Migration 008** (`emergency_audit_log`) — file landed in repo at `migrations/008_emergency_audit_log.sql` via D-5.12c (`4ae3689`). **NOT YET APPLIED to production.** Application requires a separate explicit operator authorization gate. The file's header explicitly warns against running it via `scripts/run-migrations.js` without operator authorization. Before any future application, verify `git ls-files migrations/` shows 008 as the only unapplied file on disk.
- **Migration 007** (`event_type_sl_tp_updates`) — applied 2026-05-02. `trade_events_event_type_check` constraint now allows 10 event types: 8 pre-existing + `manual_sl_update`, `manual_tp_update`. Verified via post-migration `pg_constraint` query.
- **Migration 006** (`positions_reconciliation_metadata`) — applied 2026-05-02 as a **side effect** of running the migration runner for B.2a (see "Side effect note" below).

## Working tree state (truth)

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`), B.2c-bot-preserve-TP (`cc6bd2e`), B.2d-dashboard-TP (`eca2659`), C.1 (`d0c8817`), C.2 (`2d10107`), C.3 (`1a16dd8`), smoke-test wording cleanup (`735b10f`), D-5.12a closeout (`8340aec`), D-5.12b (`24246d8`), D-5.12b closeout (`58951ee`), D-5.12c (`4ae3689`), D-5.12c closeout (`e2583df`), D-5.12d (`1c20177`), D-5.12d closeout (`d8f5950`), and D-5.12e (`95f39f2`) commits; explicitly excluded from all commits.
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
| Phase D-5.12b — Codex implementation review (round 1) | FAIL [MEDIUM] — stale outer ctrl snapshot consumed by SET_MODE preflight after lock acquisition; required edit was Codex option (b): scoped under-lock re-read of CONTROL_FILE inside the SET_MODE branch. |
| Phase D-5.12b — Codex implementation review (round 2) | **PASS, safe to commit.** All 34 sub-items PASS post-revision; outer pre-lock ctrl snapshot retained for non-SET_MODE requiresConfirm logic; SET_MODE branch uses locked fresh snapshot for ctrl.killed and writeFileSync. |
| Phase D-5.12b — implementation | Closed, committed `24246d8` (`dashboard.js` only; gating + lock-safety only). |
| Phase D-5.12c — design (v1) | Codex PASS-WITH-REQUIRED-EDITS (3 HIGH: SQL contract DO NOTHING vs DO UPDATE contradiction, helper-vs-caller emergency-audit responsibility, P0-L3 unique-violation claim wrong; 1 MEDIUM: retry_history concrete storage; 2 PASS-with-notes: attempted_payload_hash dual placement, redaction guard) |
| Phase D-5.12c — design (v2) | **Codex PASS — design ready for operator scoped-file approval.** All 3 HIGH edits resolved + MEDIUM concrete + 2 PASS-with-notes folded; all 9 prior Codex Q-rulings preserved. |
| Phase D-5.12c — Codex implementation review (round 1) | FAIL [MEDIUM] — `classifyDbError` matched the Postgres-default `positions_kraken_order_id_key` constraint name; actual constraint declared in `migrations/002_*.sql:66-67` is `positions_kraken_order_unique`. Required fix: literal-string swap in the classifier. |
| Phase D-5.12c — Codex implementation review (round 2) | **PASS, safe to commit.** All 22 sub-items PASS post-revision; constraint-name swap confined to `classifyDbError`; no other behavior changed. |
| Phase D-5.12c — implementation | Closed, committed `4ae3689` (`dashboard.js` + `db.js` + new `migrations/008_emergency_audit_log.sql`; helpers + Migration 008 file scaffolding only). |
| Phase D-5.12c — Migration 008 application to production | **NOT APPLIED.** Separate explicit operator authorization gate. |
| Phase D-5.12d — design (v1) | Codex PASS-WITH-REQUIRED-EDITS (1 HIGH: Migration 008 application must be a hard prerequisite for production deploy, not a recommendation; 1 PASS-with-notes: implementation review must verify no raw payload path enters `_loglineFallback`) |
| Phase D-5.12d — design (v2) | **Codex PASS — design ready for scoped `dashboard.js` implementation.** All 9 prior Q-rulings preserved; production sequencing tightened to mandatory order: D-5.12d code commit → closeout → apply+verify Migration 008 → deploy → first live BUY. |
| Phase D-5.12d — Codex implementation review (round 1) | FAIL [HIGH] — early-return `db_unavailable` / `validation_failed` paths defaulted `failureContext.attempted_payload` to `{}`, losing reconstruction context exactly when audit recovery is most critical. Required fix: fall back to a locally-computed redacted payload from `newPos`. |
| Phase D-5.12d — Codex implementation review (round 2) | **PASS, safe to commit.** All 21 sub-items PASS post-revision; helper-provided `r.emergency_context` preferred when present; otherwise `_redactAttemptedPayload(newPos-fields)` + `sha256HexCanonical` compute the fallback; no `{}` default remains in the live-BUY failure path. |
| Phase D-5.12d — implementation | Closed, committed `1c20177` (`dashboard.js` only; live OPEN_LONG / BUY_MARKET wiring + emergency-audit failure ladder). |
| Phase D-5.12e — design (v1) | Codex PASS-WITH-REQUIRED-EDITS (1 MEDIUM: `balanceCache` invalidation must lock to option (b) — every post-Kraken outcome including DB persistence failure). |
| Phase D-5.12e — design (v2) | **Codex PASS — design ready for scoped `dashboard.js` implementation.** `balanceCache = null` locked to fire on success path AND every DB-failure class, placed BEFORE the operator-visible throw and OUTSIDE the `auditResult.ok` if/else. All 7 verification items PASS. |
| Phase D-5.12e — Codex implementation review (round 1) | FAIL [HIGH] — call-site fallback `attempted_payload` used `symbol: dbPos.symbol` (raw DB column value), which would diverge from helper-internal `symbol: exitEntry.symbol` if `CONFIG.symbol` ever drifted, producing non-byte-stable emergency-audit hashes. |
| Phase D-5.12e — Codex implementation review (round 2) | **PASS, safe to commit.** All 6 sub-items PASS post-revision; targeted one-line swap `dbPos.symbol` → `exitEntry.symbol` confined to the fallback `attempted_payload` block. |
| Phase D-5.12e — implementation | Closed, committed `95f39f2` (`dashboard.js` only; live CLOSE_POSITION wiring + emergency-audit failure ladder + locked-on-every-post-Kraken-outcome `balanceCache` invalidation). |
| Phase D-5.12f through D-5.12i | Deferred — D-5.12f (live SELL_ALL persistence) is the next planned phase but has not started; requires its own scoped `dashboard.js` HARD BLOCK lift, design-only review with Codex, implementation review with Codex, and operator authorization. |

## Current allowed next action

> **Phase D-5.12e closeout doc commit, then operator-chosen next gated phase.**

D-5.12e source landed at `95f39f2` and Codex returned PASS on all 6 sub-items (round-2 re-review post-revision: targeted one-line swap `dbPos.symbol` → `exitEntry.symbol` in the call-site fallback `attempted_payload` block, restoring byte-stable emergency-audit hashes across helper-driven and call-site-driven failure paths). Closeout doc updates are committed in STATUS / CHECKLIST / NEXT-ACTION. HOLD for operator-chosen next gated phase; no coding should happen until the operator chooses. The two natural candidates are:

- **Phase D-5.12f — design-only review** for live `SELL_ALL` persistence (mirror of B.1 close-source cleanup for the SELL_ALL surface, with the same DB-first failure-ladder integration D-5.12d/e added for OPEN_LONG and CLOSE_POSITION; close one known bot position; LOG_FILE write to close P0-L2 audit gap per accepted v4 D-5.12 design). D-5.12f implementation requires its own design-only Codex review, scoped `dashboard.js` HARD BLOCK lift, Codex implementation review, and explicit operator authorization. **No code yet.**
- **Migration 008 production-application planning** — gated separately. Per the accepted v2 D-5.12d design, Migration 008 application to production is a HARD prerequisite before any production deployment of D-5.12d/e. The migration runner must NOT be invoked without explicit operator authorization. Verification step required: confirm `emergency_audit_log` exists and is queryable post-application (`SELECT 1 FROM emergency_audit_log LIMIT 1;`).

No deploy is authorized. No D-5.12f code work is authorized. Operator decides next.

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
- Editing `db.js` (HARD BLOCK reinstated post-D-5.12c; the D-5.12c lift was scoped to that phase only)
- Editing `migrations/` (HARD BLOCK reinstated post-D-5.12c; the D-5.12c lift was scoped to that phase only)
- Editing `dashboard.js` (HARD BLOCK reinstated post-D-5.12c; the D-5.12c lift was scoped to that phase only)
- Editing `scripts/recovery-inspect.js` (HARD BLOCK reinstated post-C.3; the C.3 lift was scoped to that phase only)
- Editing `scripts/smoke-test-live-writes.js` (HARD BLOCK reinstated post-smoke-test-cleanup; the lift was scoped to that phase only)
- Editing any other `scripts/` file (default HARD BLOCK; lift required per file)
- Applying Migration 008 (`emergency_audit_log`) to production — separate explicit operator authorization gate; the migration file's header forbids running via `scripts/run-migrations.js` without authorization
- Phase D-5.12f implementation (live SELL_ALL persistence — design has not started; will require its own scoped `dashboard.js` HARD BLOCK lift + Codex design review + Codex implementation review + operator authorization)
- Phase D-5.12g through D-5.12i implementation (live SL/TP, rehydrate + smoke harness, closeout — design has not started; require sequential per-sub-phase scoped HARD BLOCK lifts)
- D-5.12d/e production deployment to Railway (separate explicit operator authorization; gated behind Migration 008 production-application + verification per accepted v2 D-5.12d design)
- First production live BUY / live CLOSE exercise (separate explicit operator authorization; requires `MANUAL_LIVE_ARMED` env var set to `"true"` per D-5.12b; requires Migration 008 applied + verified per D-5.12d hard prerequisite)
- Touching live trading logic
- Touching Kraken execution
- Touching SL / TP / breakeven / trailing stop / position management logic in bot.js
- Deploying or pushing to remote
- Force push, `git reset --hard`, interactive rebase, branch deletion, file deletion
- Reverting migration 006 (destructive — explicit safety review required)

## Current risk level

**LOW.** No uncommitted code. Full paper-mode write surface is DB-canonical: paper BUY (`959fef7`), CLOSE/SELL_ALL (`cb7facb`), SET_STOP_LOSS (`511f94e`), SET_TAKE_PROFIT (`eca2659`). Both `manual_sl_update` and `manual_tp_update` are live event types with active dashboard-driven inserts (B.2b-SL / B.2d), active dashboard reads (C.1, `d0c8817`), active dashboard rendering via the dedicated "Recent Risk Edits" panel (C.2, `2d10107`), and active operator-playbook classification in `recovery-inspect.js` (C.3, `1a16dd8`). `bot.js` `manageActiveTrade` no longer overwrites DB `take_profit` from in-memory state (`cc6bd2e`). Paper dashboard edits cannot be silently overwritten by bot rehydrate. Smoke-test wording is now consistent with the post-B.2c bot-side state (`735b10f`).

**All Phase C visibility gaps closed.** Read filter (C.1), UI rendering (C.2), and operator-playbook classification (C.3) all landed. `fired` counter, P&L aggregates, win-loss aggregates, and `renderTradeTable` are all unchanged (allowlist / exit-only filtering preserves the existing semantics). Smoke-test wording cleanup (`735b10f`) brings test-suite documentation in line with the post-B.2c bot-side payload narrowing.

**Live OPEN_LONG / BUY_MARKET write path is now DB-canonical via D-5.12d** (`1c20177`); **live CLOSE_POSITION write path is now DB-canonical via D-5.12e** (`95f39f2`). `position.json` becomes a write-after-DB compatibility cache for both paths; the LOG_FILE remains best-effort local audit. **The remaining live dual-truth surfaces are SELL_ALL / SET_STOP_LOSS / SET_TAKE_PROFIT** — those still write `position.json` directly without a DB update and are intentional, gated behind D-5.12f/g. Until those sub-phases land, those three live paths remain JSON-authoritative by design. **D-5.12a design is closed (Codex v4 PASS WITH NOTES); operator decisions accepted. D-5.12b is closed (`24246d8`, gating-only — no DB writes, no helpers, no migrations, no Kraken changes). D-5.12c is closed (`4ae3689`, helpers + Migration 008 file scaffolding only — helpers added but unused, no live handler wiring, Migration 008 NOT applied to production). D-5.12d source is closed (`1c20177`, live OPEN_LONG / BUY_MARKET wired through the failure ladder). D-5.12e source is closed (`95f39f2`, live CLOSE_POSITION wired through the failure ladder + locked-on-every-post-Kraken-outcome `balanceCache` invalidation; Migration 008 still NOT applied to production — separate operator gate). D-5.12f through D-5.12i implementation has NOT started.** **No O-* automation phase has started.**
