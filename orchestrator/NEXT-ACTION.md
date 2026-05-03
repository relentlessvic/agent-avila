# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Hands-Free ARC track — ARC-1 closed (`95157ae`), ARC-2 closed (`3b53223`), ARC-3 closed (`9b5093f`), ARC-4 closed (`afd5930`), ARC-5 closed (`698e0d3`), ARC-6 closed (`9eff3c9`), N-1 PASS, N-1 closeout sync closed (`4d472e2`), N-1.5 design review PASS, ARC-7 closed (`8266db2`), N-2 design review PASS WITH REQUIRED EDITS, N-2b closed (`e6c9189`), N-2c closed (`9ae139d`), N-3 attempt 2026-05-03 HALTED (runner exit 1; `getaddrinfo ENOTFOUND` for Railway-internal Postgres hostname; no SQL executed; production-DB unchanged; Migration 008 NOT applied; prior Victor approval consumed), N-2d closed (`3732721`), N-2e closed (`afe94d1`), N-2f closed (`3af1e44`), N-2g closed (`926eb7f`), N-2h in progress (Phase N-2h — mode: DOCS-ONLY).** ARC-1 through ARC-7 closed in sequence. N-2 / N-2b / N-2c / N-2d / N-2e / N-2f / N-2g established, stabilized, connectivity-preflight-extended, N-3-preflight-tightened, DDL-baseline + rollback-blocker-tightened, and runtime-identity + DB-baseline-tightened the production-plan runbook. The single N-3 attempt on 2026-05-03 HALTED before any SQL executed because the runner was invoked from a non-Railway-attached execution context. Production-DB state is unchanged. Migration 008 is still NOT applied. The prior Victor approval was consumed by the failed attempt and cannot be reused. The fresh Codex N-3 preflight review on the N-2g-committed runbook (HEAD `926eb7f`) returned PASS WITH REQUIRED EDITS over a single finding — the §14 N-2g entry's tail still said "Pending Codex docs-only review and explicit operator approval before commit" even though N-2g had committed — and Codex itself recognized this as a recurring stale-tail loop pattern (every N-2x commit creates a stale §14 tail in its own change-history entry that the next preflight then flags, requiring an N-2(x+1) commit to close). **N-2h (DOCS-ONLY)** breaks the loop structurally: adds a §14 preamble making §14 descriptive-only with §1 Status block as canonical HEAD-of-record and §11 as canonical N-3 gate; strips stale-prone "Committed at HEAD `<hash>`" / "Pending commit" / "This entry does not authorize N-3" tails from N-2b → N-2g §14 entries; preserves what each phase changed and why; adds an N-2h history entry; updates §11 condition (1) and §9 gate-separation chain. No §4 / §5 / §6 / §7 / §8 / §11 substance changed. Pre-flight remains at eleven checks (i)–(xi); no new check added. The runbook remains fully prose-only — no literal Railway runner commands, no `DATABASE_URL` values, no hostname/port/URL values added. **N-3 remains hard-blocked** behind a fresh five-condition gate: (1) Codex docs-only PASS on this N-2h update; (2) fresh Codex N-3 preflight PASS on the now-updated runbook; (3) fresh Victor explicit in-session production-action approval naming the exact current HEAD at retry time; (4) all eleven pre-flight checks (i)–(xi) PASS at execution time; (5) target Railway service / production database confirmation without exposing secrets. **No edits to `bot.js` / `dashboard.js` / `db.js` / `scripts/` / `migrations/` / `position.json`. No migration applied. No deploy. No production-DB query. No Railway command. No live Kraken action. No env / secret read or write. No `MANUAL_LIVE_ARMED` change. No commit yet.** Pending Codex docs-only review and explicit operator approval before any N-2h commit.

The next allowed action after this N-2h doc draft is: (a) Codex docs-only review of the runbook diff + the three minimal status-doc edits; (b) on Codex PASS (or PASS WITH REQUIRED EDITS, after applying any wording fixes), explicit operator approval to commit N-2h; (c) commit exactly those four paths — never stage or modify any HARD BLOCK file. After N-2h commit, **N-3 remains hard-blocked** until all five gate conditions are simultaneously satisfied. Per `orchestrator/APPROVAL-GATES.md` gate 4 separation rule, **N-2h commit-time approval does NOT authorize N-3.** **D-5.12f (live SELL_ALL design-only review) remains hard-blocked** until ARC-7 / N-2 / N-2b / N-2c / N-2d / N-2e / N-2f / N-2g / N-2h / N-3 are all handled per the master order, unless the operator explicitly changes the master order again.

**Phase D-5.12e is closed: source committed `95f39f2`; closeout docs committed.** Live CLOSE_POSITION DB-first persistence wired through the failure ladder. `dashboard.js`-only diff (+145 / -10). Replaces the pre-existing JSON-only live CLOSE branch (which used stale `pos` from `position.json` and called Kraken sell against `pos.quantity`) with a DB-first failure-ladder block: `loadOpenPosition("live")` is the canonical pre-Kraken source (throws "No open live position to close" if null, BEFORE Kraken executes); Kraken sell uses `parseFloat(dbPos.quantity).toFixed(8)` (no balance check added); after Kraken success calls `shadowRecordManualLiveClose(exitEntry)`. On helper success: write `position.json {open: false}` compatibility cache, best-effort LOG_FILE append, set `balanceCache = null`, return existing live-close shape. On helper failure: map `r.reason === "no_open_position"` → `kraken_post_success_db_no_open_position`; otherwise → `kraken_post_success_db_other_error`. Helper-provided `r.emergency_context` preferred when present; otherwise call-site computes fallback `attempted_payload` from `dbPos` + `exitEntry` via `_redactAttemptedPayload(...)` (9-field helper-matching shape with `symbol: exitEntry.symbol`), `attempted_payload_hash` injected post-canonicalization. Calls `_emergencyAuditWrite(failureContext)` (Layer 2); on audit failure calls `_loglineFallback(line)` (Layer 3 / 4 floor). **Per Codex v2 design ruling option (b):** `balanceCache = null` runs on EVERY post-Kraken outcome — success path AND every DB-failure class — placed AFTER audit/log work and BEFORE the conditional throws. Operator-visible pointer-only error thrown — does NOT include `attempted_payload`. No `position.json` write on DB failure. No LOG_FILE success-row append on DB failure. No Kraken cancellation. No auto-retry. Codex implementation review round 1 = FAIL [HIGH] over `symbol: dbPos.symbol` in the call-site fallback (would produce non-byte-stable emergency-audit hashes if `CONFIG.symbol` ever drifted from helper-internal `exitEntry.symbol`); round 2 post-revision (targeted one-line swap to `symbol: exitEntry.symbol`) = **PASS, safe to commit** (all 6 sub-items PASS).

**D-5.12e did NOT add:** wiring of SELL_ALL / SET_STOP_LOSS / SET_TAKE_PROFIT (D-5.12f/g); live rehydrate (D-5.12h); smoke harness (D-5.12h); recovery-script updates (D-5.12h). **Migration 008 is NOT applied to production** — and per the accepted v2 D-5.12d design, application remains a HARD prerequisite before any D-5.12d/e production deploy or live exercise. `bot.js` / `db.js` / `migrations/` / `scripts/` / `orchestrator/` untouched in the source commit.

**Phase D-5.12d is closed: source committed `1c20177`; closeout docs committed.** Live OPEN_LONG / BUY_MARKET wired through the failure ladder. `dashboard.js`-only diff (+146 / -3). Replaces the pre-existing JSON-only live BUY branch with a DB-first failure-ladder block that calls `shadowRecordManualLiveBuy(entry, newPos)` after `execKrakenOrder` returns. On helper success: write `position.json` compatibility cache, best-effort LOG_FILE append, set `balanceCache = null`, fall through to existing return shape. On helper failure: map errorClass to `failure_class` (`kraken_post_success_db_unique_violation` / `kraken_post_success_db_other_error`); call `_emergencyAuditWrite(failureContext)` (Layer 2); on audit failure call `_loglineFallback(line)` (Layer 3); throw operator-visible pointer-only error. No `position.json` write on DB failure. No LOG_FILE success-row append on DB failure. No Kraken cancellation. No auto-retry. Codex implementation review round 1 = FAIL [HIGH] over the helper's early-return paths defaulting `attempted_payload` to `{}`; round 2 post-revision = **PASS, safe to commit** (all 21 sub-items PASS): when `r.emergency_context` is missing, the call-site computes a fallback `attempted_payload` locally from `newPos` via `_redactAttemptedPayload` + `sha256HexCanonical`, with the helper-matching field shape; helper-provided `r.emergency_context` is preferred when present.

**D-5.12d did NOT add:** wiring of CLOSE_POSITION (D-5.12e — now landed) / SELL_ALL / SET_STOP_LOSS / SET_TAKE_PROFIT (D-5.12f/g); live rehydrate (D-5.12h); smoke harness (D-5.12h); recovery-script updates (D-5.12h). **Migration 008 is NOT applied to production** — and per the accepted v2 D-5.12d design, application is a HARD prerequisite before any production deploy or live BUY exercise. `bot.js` / `db.js` / `migrations/` / `scripts/` untouched.

**Phase D-5.12c is closed: source committed `4ae3689`.** Live helper wrappers + Migration 008 (`emergency_audit_log`) + `db.js` emergency-audit insert helper + `dashboard.js` emergency utility helpers. `dashboard.js` (+379 lines) adds four `shadowRecordManualLive{Buy,Close,SLUpdate,TPUpdate}` wrappers (mirror paper return contract `{ ok, reason, error?, errorClass?, emergency_context? }` with `mode: "live"` hard-coded), `_redactAttemptedPayload`, `_loglineFallback`, and `_emergencyAuditWrite`. `db.js` (+118 lines) adds `insertEmergencyAuditLog` (`ON CONFLICT (event_id) DO UPDATE` with `metadata.retry_history` `jsonb_set` append; `attempted_payload` not overwritten on conflict; first `error_message` preserved via `COALESCE`), `buildEmergencyEventId` (`d512-emergency-` prefix), `sha256HexCanonical` (RFC-8785-style canonicalization), and `classifyDbError` (returns `unique_violation_one_open_per_mode` / `unique_violation_kraken_order_id` / `other`). New `migrations/008_emergency_audit_log.sql` (46 lines) with operator warning header forbidding runner application without explicit authorization, 13-column schema, inline `mode CHECK`, `event_id UNIQUE`, four triage indexes. Codex review: design v1 = PASS-WITH-REQUIRED-EDITS (3 HIGH + 1 MEDIUM); v2 = **PASS, design ready**. Implementation review round 1 = FAIL [MEDIUM] over `classifyDbError` constraint-name mismatch; round 2 post-revision = **PASS, safe to commit** (all 22 sub-items PASS).

**D-5.12c did NOT add:** wiring of any live `/api/trade` handler to call `shadowRecordManualLive*`; P0-L3 unique-violation recovery branch (D-5.12d, now landed); live rehydrate (D-5.12h); smoke harness (D-5.12h); recovery-script updates (D-5.12h). **Migration 008 is NOT applied to production** — application is a separate explicit operator authorization gate. `bot.js` / `scripts/` untouched.

**Phase D-5.12b is closed: source committed `24246d8`.** Manual live gating implementation in `dashboard.js`. Adds defense-in-depth `MANUAL_LIVE_ARMED` env-var gating across two layers (Layer 1 at `/api/trade` POST entry; Layer 2 inside `handleTradeCommand` after `isPaper` derivation), plus `/api/control` SET_MODE lock-before-read with a scoped under-lock re-read of `CONTROL_FILE`. New `MANUAL_LIVE_COMMANDS` Set with the six manual-live action tokens. Codex implementation review took two rounds: round 1 = FAIL [MEDIUM] over a stale outer ctrl snapshot consumed by SET_MODE preflight after lock acquisition; round 2 (post-revision applying Codex's own option (b) — scoped under-lock CONTROL_FILE re-read inside the SET_MODE branch, leaving the outer pre-lock ctrl read intact for non-SET_MODE requiresConfirm logic) = **PASS, safe to commit** (all 34 sub-items PASS).

**D-5.12b did NOT add:** DB persistence, helper wrappers (`shadowRecordManualLive*`), `emergency_audit_log` table, Migration 008, Kraken execution changes, SL/TP/breakeven/trailing-stop logic changes. `bot.js` / `db.js` / `migrations/` / `scripts/` untouched.

**Phase D-5.12a is closed: design-only, 4-iteration Codex refinement, v4 PASS WITH NOTES.** Live persistence gate lift design audit completed across v1 (PASS-WITH-EDITS, 5 HIGH/MEDIUM concerns) → v2 (PASS-WITH-EDITS, 4 required + 2 MEDIUM) → v3 (PASS-WITH-EDITS, 5 required + 5 minor) → v4 (PASS WITH NOTES; 9 LOW operational concerns; **none are design blockers**). Operator accepted all eight design decision defaults. D-5.12 sub-phase plan approved (D-5.12b through D-5.12i). **No code, no commits, no migrations, no deploys, no edits to `dashboard.js` / `bot.js` / `db.js` / `scripts/` / `migrations/` during D-5.12a review.**

**Operator decision defaults — accepted for D-5.12 (all 8):**
1. SELL_ALL semantics — close one known bot position only.
2. DB-failure-after-Kraken — fail-loud + emergency audit + LOG_FILE/stderr double-fault + triple-fault stderr-only fallback. **No JSON fallback.**
3. Live DB-to-position.json rehydrate — enable in D-5.12h after d/e/f/g.
4. `MANUAL_LIVE_ARMED` two-layer check — `/api/trade` entry AND inside `handleTradeCommand` at `dashboard.js:1434-1439`. **Implemented in D-5.12b at `dashboard.js:12247-12282` (Layer 1) and `dashboard.js:1449-1464` (Layer 2).**
5. Event_type naming — reuse existing `manual_*` (mode-agnostic per migration 007). **Implemented in D-5.12c: live helpers reuse `manual_buy` / `manual_close` / `manual_sl_update` / `manual_tp_update` event types differentiated only by `trade_events.mode = 'live'`. `metadata.source` is mode-tagged (`manual_live_*`); paper tags unchanged.**
6. Emergency audit surface — separate `emergency_audit_log` table via migration 008. **File landed in D-5.12c at `migrations/008_emergency_audit_log.sql`. NOT YET APPLIED to production — separate operator authorization gate.**
7. Transition-lock — process-local mutex with lock-before-read. **Implemented in D-5.12b at `dashboard.js:12124-12137` for SET_MODE; the lock primitive at `dashboard.js:11380-11385` is synchronous (Codex v4 note 9.f satisfied). Outer pre-lock ctrl snapshot retained for non-SET_MODE requiresConfirm; SET_MODE branch re-reads CONTROL_FILE under the lock at `dashboard.js:12142-12157`.**
8. `MANUAL_LIVE_ARMED` env-var-only for D-5.12 (DB-backed disarm deferred to D-5.13).

The next safe action is:

> **N-2h Codex docs-only review of the structural §14 stale-tail loop fix runbook update, then explicit operator approval before any N-2h commit; N-3 remains hard-blocked behind a fresh five-condition gate (Codex docs-only PASS on N-2h, fresh Codex N-3 preflight PASS, fresh Victor approval naming exact current HEAD, all eleven pre-flight checks (i)–(xi) PASS, target confirmation without exposing secrets).**

With D-5.12e closeout committed, the operator can choose between two gated paths. Both are mutually independent and require their own explicit authorization:

- **(a) Phase D-5.12f design-only review** — live `SELL_ALL` persistence (mirror of B.1 close-source cleanup for the SELL_ALL surface, with the same DB-first failure-ladder integration D-5.12d/e added for OPEN_LONG / BUY_MARKET and CLOSE_POSITION; close one known bot position; LOG_FILE write to close P0-L2 audit gap per accepted v4 D-5.12 design). D-5.12f implementation requires design-only review with Codex first, then scoped `dashboard.js` HARD BLOCK lift, Codex implementation review, and explicit operator authorization. **No code yet.**
- **(b) Migration 008 production application** — gated separately. Per the accepted v2 D-5.12d design and the corrected N-2c runbook, Migration 008 application is a HARD prerequisite before any D-5.12d/e production deploy or live exercise. N-3 remains blocked until fresh Codex N-3 preflight PASS on the corrected runbook, explicit Victor in-session production-action approval naming the exact current HEAD, all runbook pre-flight checks pass at execution time, and the operator confirms the target Railway service / production `DATABASE_URL` without exposing secrets.

**No deploy is authorized. No D-5.12f code work is authorized.**

## Phase D-5.12f — pre-design scope sketch (informational; no work yet)

For when the operator authorizes D-5.12f design-only review:

- **Live `SELL_ALL` handler in `/api/trade` at `dashboard.js:2220-2255`** (post-D-5.12e line numbers). Currently calls `fetchKrakenBalance` to gate, sells `xrp.amount` via Kraken, writes `position.json {open: false}`, sets `balanceCache = null`, returns. D-5.12f wires the existing `shadowRecordManualLiveClose` (or a new `shadowRecordManualLiveSellAll` if Codex design rules a separate semantics) into the post-Kraken-success path; integrates the same failure ladder D-5.12d/e added; LOG_FILE write to close P0-L2 audit gap per accepted v4 D-5.12 design (operator decision #1: SELL_ALL closes one known bot position only).
- **P0-L2 audit gap** — current live SELL_ALL never writes a trade_event row; D-5.12f will write one via the helper-driven DB-first path.
- **Out of scope for D-5.12f:** SL/TP (D-5.12g), live rehydrate (D-5.12h), smoke harness (D-5.12h).

HIGH carry-forward discipline:
- Every partial deploy must smoke-test ALL FIVE live manual handlers (Codex v4 note 9.c) — but D-5.12d/e/f/g are themselves partial deploys; this discipline applies to operator deploy decisions, not the code commit.

## Pre-next-phase acknowledgment — Migration 008 application gate

Migration 008 (`emergency_audit_log` table) landed in repo via D-5.12c (`4ae3689`) but is **NOT applied to production**:

- The migration file's header explicitly forbids running it via `scripts/run-migrations.js` without operator authorization.
- D-5.12d code is committed (`1c20177`) and D-5.12e is committed (`95f39f2`); per the accepted v2 D-5.12d design, **Migration 008 application is a HARD prerequisite before any D-5.12d/e production deploy or live exercise.**
- **D-5.12f code work does NOT require Migration 008 to be applied first** — the wiring can be reviewed and committed before the table exists in production. However, deploying D-5.12d/e (or D-5.12f once it lands) requires Migration 008 applied + verified first.
- Before applying Migration 008: follow the current N-2h runbook gate — fresh Codex N-3 preflight PASS, fresh Victor approval naming exact current HEAD, all eleven §4 pre-flight checks (i)–(xi) PASS at execution time, target confirmation without exposing secrets, then the full §6 verification after runner exit.

## Pre-next-phase acknowledgment — migration 006 side effect

This carryover note from B.2 / C track still applies for any future reconciliation-related work but does NOT block D-5.12f or any later D-5.12 sub-phase:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

## D-5.12e post-commit prerequisites (all satisfied)

| Prerequisite | Status |
|---|---|
| D-5.12a design closed (v4 PASS WITH NOTES) | **Satisfied** |
| Operator decisions #1-#8 accepted | **Satisfied** |
| D-5.12b implementation closed (`24246d8`) | **Satisfied** |
| D-5.12c implementation closed (`4ae3689`) | **Satisfied** |
| D-5.12d implementation closed (`1c20177`) | **Satisfied** |
| D-5.12e design v2 = Codex PASS | **Satisfied** |
| D-5.12e implementation review round 2 = Codex PASS | **Satisfied** |
| D-5.12e source committed (`95f39f2`) | **Satisfied** |
| D-5.12e closeout docs committed | **Committed** |

## D-5.12f implementation prerequisites (none satisfied yet)

| Prerequisite | Status |
|---|---|
| D-5.12e closeout committed | Committed |
| D-5.12f design-only review with Codex | Not started |
| Codex implementation review of D-5.12f diff | Not started |
| `dashboard.js` HARD BLOCK lift for D-5.12f (scoped) | Not given |
| Explicit operator authorization for D-5.12f commit | Not given |

## D-5.12d/e production deploy prerequisites (none satisfied yet)

| Prerequisite | Status |
|---|---|
| Migration 008 applied to production | Not applied |
| Migration 008 verified queryable in production (`SELECT 1 FROM emergency_audit_log LIMIT 1;`) | Not verified |
| `MANUAL_LIVE_ARMED="true"` set in production env | Operator-controlled |
| Explicit operator authorization for production deploy | Not given |
| Explicit operator authorization for first live BUY / live CLOSE exercise | Not given |

## D-5.12 sub-phase plan (per accepted v4 design)

| Sub-phase | Scope | HARD BLOCK lifts |
|---|---|---|
| D-5.12a | Design review (4-iteration Codex refinement; v4 PASS WITH NOTES; operator decisions accepted) | None — design-only |
| **D-5.12b** | Manual live gating: `MANUAL_LIVE_ARMED` two-layer check + `/api/control` transition-lock | dashboard.js |
| D-5.12c | Live helper wrappers (`shadowRecordManualLive*`) + Migration 008 (`emergency_audit_log`) + db.js emergency-audit insert helper | dashboard.js + db.js + migrations/ |
| D-5.12d | Live OPEN_LONG persistence with P0-L3 unique-violation recovery + P0-L4 fail-loud + P1-L4 retry-aware emergency audit | dashboard.js |
| D-5.12e | Live CLOSE_POSITION persistence (DB-first; close P1-L1 stale-source pattern) | dashboard.js |
| D-5.12f | Live SELL_ALL persistence (close one bot position; LOG_FILE write to close P0-L2 audit gap) | dashboard.js |
| D-5.12g | Live SET_STOP_LOSS + SET_TAKE_PROFIT persistence (mirror of B.2b-SL / B.2d) | dashboard.js |
| D-5.12h | Live rehydrate enable + recovery scripts + new `scripts/smoke-test-live-dashboard-flow.js` end-to-end harness + rollback plan | bot.js (potentially) + scripts/ |
| D-5.12i | Closeout documentation sync | orchestrator/* |
| D-5.13 (post-D-5.12) | DB-backed `MANUAL_LIVE_ARMED` immediate-disarm + CI deploy-warning enforcement | TBD |

Each implementation sub-phase: design review → Codex implementation review → commit → closeout docs. Mirror of B.2 / Phase C cadence.

## Codex v4 LOW operational notes — carried forward

Nine LOW operational concerns from the v4 review, none blocking, all tracked for downstream sub-phase docs:

1. Canonical event_id precision (kraken_order_id-as-string, UTC ISO bucket math) → fold into D-5.12c. **Closed in D-5.12c (`4ae3689`):** `_canonicalJsonSorted` (RFC-8785-style) + `sha256HexCanonical` enforce stable canonicalization; `_emergencyAuditWrite` coerces `kraken_order_id` to string when present and computes `timestamp_bucket` via `new Date(Math.floor(Date.now()/1000)*1000).toISOString()`.
2. `retry_history` growth/retention cap → D-5.12c. **Partially closed in D-5.12c (`4ae3689`):** `metadata.retry_history` append shape locked (`retried_at`, `failure_class`, `error_message`, `layer`, `source`); explicit retention cap deferred to D-5.12i operator playbook.
3. All-handler smoke deploy-velocity / staging Kraken API quota → D-5.12d/e/f/g closeouts.
4. Railway stderr retention finite → D-5.12i operator playbook.
5. Process-local lock check/set must avoid async yield → D-5.12b. **Closed in D-5.12b (`24246d8`):** the `acquireTransitionLock` primitive at `dashboard.js:11380-11385` is synchronous; no async yield between check and set.
6. D-5.12h testcontainer infrastructure scope (existing repo has none) → D-5.12h.
7. Emergency audit insert latency budget (real-money critical path) → D-5.12i operator playbook.
8. Deploy warning is documentation-only / no CI enforcement → D-5.13 hardening.
9. Emergency rows pre-rollback export format → D-5.12i operator playbook.

## What D-5.12e did NOT do (still on the table)

- Did not wire SELL_ALL (D-5.12f).
- Did not wire SET_STOP_LOSS or SET_TAKE_PROFIT (D-5.12g).
- Did not enable `_rehydratePositionJson` for live (D-5.12h).
- Did not update `scripts/reconciliation-shadow.js` for live `--persist` (D-5.12h).
- Did not update `scripts/recovery-inspect.js` for `emergency_audit_log` triage (D-5.12h).
- Did not add the `scripts/smoke-test-live-dashboard-flow.js` end-to-end harness (D-5.12h).
- Did not change Kraken execution paths.
- Did not change SL / TP / breakeven / trailing-stop logic.
- Did not change `bot.js`, `db.js`, `migrations/`, `scripts/`, `orchestrator/` (in the source commit), paper helpers, paper handlers, D-5.12b gates, or D-5.12d live BUY logic.
- Did not apply Migration 008 to production.
- Did not deploy to Railway.
- Did not begin any O-* automation work.

## Alternative phases (operator may choose any)

If D-5.12f is not the next priority, the operator can advance instead to:

- Migration 008 production-application planning (HARD prerequisite for any D-5.12d/e production deploy)
- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

None of the O-* phases have started.

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase D-5.12f implementation (live SELL_ALL persistence) | Codex design-only review + Codex implementation review of diff + scoped `dashboard.js` HARD BLOCK lift + operator authorization |
| Phase D-5.12g through D-5.12i implementation | Sequential per-sub-phase design review + scoped HARD BLOCK lift(s) + Codex implementation review + operator authorization |
| Live SELL_ALL / SL / TP write-path changes | Completion of D-5.12f through D-5.12h |
| Editing `bot.js` / `db.js` / `migrations/` / `dashboard.js` | Explicit operator instruction (all prior scoped lifts expired post-commit; D-5.12e's `dashboard.js` lift expired post-`95f39f2`) |
| Editing `scripts/recovery-inspect.js` | Explicit operator instruction (post-C.3 scoped lift expired) |
| Editing `scripts/smoke-test-live-writes.js` | Explicit operator instruction (post-smoke-test-cleanup scoped lift expired) |
| Editing any other `scripts/` file | Explicit operator instruction (per-file scoped lift required) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Applying Migration 008 (`emergency_audit_log`) to production | **Separate explicit operator authorization** (file landed in D-5.12c at `migrations/008_emergency_audit_log.sql`, header forbids runner application without authorization). HARD prerequisite before any D-5.12d/e production deploy or live exercise per accepted v2 D-5.12d design. |
| D-5.12d/e production deployment to Railway | Migration 008 applied + verified + explicit operator authorization |
| First production live BUY / live CLOSE exercise | D-5.12d/e deployed + `MANUAL_LIVE_ARMED="true"` + explicit operator authorization |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |
| Reverting migration 008 (drop emergency_audit_log) | Explicit safety review (destructive — drops historical incident rows; pre-rollback export format is D-5.12i operator-playbook deliverable) |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across all B.2 / Phase C / smoke-test cleanup commits, the D-5.12a design phase, the D-5.12b implementation commit (`24246d8`), the D-5.12b closeout (`58951ee`), the D-5.12c implementation commit (`4ae3689`), the D-5.12c closeout (`e2583df`), the D-5.12d implementation commit (`1c20177`), the D-5.12d closeout (`d8f5950`), and the D-5.12e implementation commit (`95f39f2`); explicitly excluded.

## How to proceed

After the D-5.12e closeout-docs commit lands, **HOLD**. No coding should happen until the operator chooses the next gated phase.

For **Phase D-5.12f design-only review** (when authorized): use `orchestrator/prompts/CODEX-REVIEW.md` as a template. Structure the design review around live `SELL_ALL` persistence (mirror of B.1 close-source cleanup for the SELL_ALL surface, with the same DB-first failure-ladder integration D-5.12d/e added). The design must confirm: scoped to `dashboard.js` only, no `bot.js` / `db.js` / `migrations/` / `scripts/` touches, no Kraken execution path changes, no live SL / TP wiring (D-5.12g handles those), no live rehydrate (D-5.12h), `_emergencyAuditWrite` invoked only after Kraken success + DB persist failure, `_loglineFallback` floor preserves redacted attempted_payload + attempted_payload_hash, no auto-retry on Layer-2 audit failure, `balanceCache = null` on every post-Kraken outcome. Do not write code, edit any HARD BLOCK file, or apply Migration 008 until the operator explicitly authorizes.

For **Migration 008 production-application planning** (when authorized): the operator-driven sequence is — (1) satisfy the current N-2h runbook gate, including fresh Codex N-3 preflight PASS, fresh Victor approval naming exact current HEAD, all eleven §4 pre-flight checks (i)–(xi) PASS at execution time, and target confirmation without exposing secrets; (2) apply Migration 008 only under that explicit production-action approval; (3) complete the full §6 post-application verification; (4) document the application timestamp in `STATUS.md`. After application, D-5.12d/e production deployment is unblocked (still requires its own explicit operator authorization).

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

D-5.12e closeout docs are committed in STATUS / CHECKLIST / NEXT-ACTION. If D-5.12f advances next, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
