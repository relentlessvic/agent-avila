# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase D-5.12d is closed: source committed `1c20177`; closeout docs committed.** Live OPEN_LONG / BUY_MARKET wired through the failure ladder. `dashboard.js`-only diff (+146 / -3). Replaces the pre-existing JSON-only live BUY branch with a DB-first failure-ladder block that calls `shadowRecordManualLiveBuy(entry, newPos)` after `execKrakenOrder` returns. On helper success: write `position.json` compatibility cache, best-effort LOG_FILE append, set `balanceCache = null`, fall through to existing return shape. On helper failure: map errorClass to `failure_class` (`kraken_post_success_db_unique_violation` / `kraken_post_success_db_other_error`); call `_emergencyAuditWrite(failureContext)` (Layer 2); on audit failure call `_loglineFallback(line)` (Layer 3); throw operator-visible pointer-only error. No `position.json` write on DB failure. No LOG_FILE success-row append on DB failure. No Kraken cancellation. No auto-retry. Codex implementation review round 1 = FAIL [HIGH] over the helper's early-return paths defaulting `attempted_payload` to `{}`; round 2 post-revision = **PASS, safe to commit** (all 21 sub-items PASS): when `r.emergency_context` is missing, the call-site computes a fallback `attempted_payload` locally from `newPos` via `_redactAttemptedPayload` + `sha256HexCanonical`, with the helper-matching field shape; helper-provided `r.emergency_context` is preferred when present.

**D-5.12d did NOT add:** wiring of CLOSE_POSITION / SELL_ALL / SET_STOP_LOSS / SET_TAKE_PROFIT (D-5.12e/f/g); live rehydrate (D-5.12h); smoke harness (D-5.12h); recovery-script updates (D-5.12h). **Migration 008 is NOT applied to production** — and per the accepted v2 D-5.12d design, application is a HARD prerequisite before any production deploy or live BUY exercise. `bot.js` / `db.js` / `migrations/` / `scripts/` untouched.

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

> **D-5.12d closeout docs committed; HOLD for operator-chosen next gated phase. No coding should happen until the operator chooses.**

With D-5.12d closeout committed, the operator can choose between two gated paths. Both are mutually independent and require their own explicit authorization:

- **(a) Phase D-5.12e design-only review** — live `CLOSE_POSITION` persistence (mirror of B.1 paper close-source cleanup, but for live mode with the same DB-first failure-ladder integration D-5.12d added for OPEN_LONG / BUY_MARKET). D-5.12e implementation requires design-only review with Codex first, then scoped `dashboard.js` HARD BLOCK lift, Codex implementation review, and explicit operator authorization. **No code yet.**
- **(b) Migration 008 production-application planning** — gated separately. Per the accepted v2 D-5.12d design, Migration 008 application is a HARD prerequisite before any D-5.12d production deploy or live BUY exercise. The migration runner must NOT be invoked without explicit operator authorization. Verification step required: `SELECT 1 FROM emergency_audit_log LIMIT 1;` returns successfully post-application. Before applying: verify `git ls-files migrations/` shows 008 as the only unapplied file on disk.

**No deploy is authorized. No D-5.12e code work is authorized.**

## Phase D-5.12e — pre-design scope sketch (informational; no work yet)

For when the operator authorizes D-5.12e design-only review:

- **Live `CLOSE_POSITION` handler in `/api/trade` at `dashboard.js:1929-1942`.** Currently uses `pos` (from stale position.json) for entry-price / quantity / tradeSize, calls Kraken sell, writes LOG_FILE + position.json `{ open: false }`. D-5.12e mirrors the paper close pattern (`dashboard.js:1903-1928`): use `loadOpenPosition("live")` for canonical entry price/quantity instead of stale JSON; call `shadowRecordManualLiveClose(exitEntry)` after `execKrakenOrder("sell", ...)` returns; integrate the same failure ladder D-5.12d added (Layer 1 helper return → Layer 2 `_emergencyAuditWrite` with `failure_class: "kraken_post_success_db_other_error"` for generic, plus the closer-specific class set TBD; Layer 3 `_loglineFallback`; Layer 4 stderr).
- **P1-L1 stale-source pattern** — closing the same dual-truth gap on the live close path that B.1 closed for paper.
- **Out of scope for D-5.12e:** SELL_ALL (D-5.12f), SL/TP (D-5.12g), live rehydrate (D-5.12h), smoke harness (D-5.12h).

HIGH carry-forward discipline:
- Every partial deploy must smoke-test ALL FIVE live manual handlers (Codex v4 note 9.c) — but D-5.12d/e/f/g are themselves partial deploys; this discipline applies to operator deploy decisions, not the code commit.

## Pre-next-phase acknowledgment — Migration 008 application gate

Migration 008 (`emergency_audit_log` table) landed in repo via D-5.12c (`4ae3689`) but is **NOT applied to production**:

- The migration file's header explicitly forbids running it via `scripts/run-migrations.js` without operator authorization.
- D-5.12d code is committed (`1c20177`); per the accepted v2 D-5.12d design, **Migration 008 application is a HARD prerequisite before any D-5.12d production deploy or live BUY exercise.**
- **D-5.12e code work does NOT require Migration 008 to be applied first** — the wiring can be reviewed and committed before the table exists in production. However, deploying D-5.12d (or D-5.12e once it lands) requires Migration 008 applied + verified first.
- Before applying Migration 008: verify `git ls-files migrations/` shows 008 as the only unapplied file on disk. Then apply, then verify `SELECT 1 FROM emergency_audit_log LIMIT 1;` returns successfully.

## Pre-next-phase acknowledgment — migration 006 side effect

This carryover note from B.2 / C track still applies for any future reconciliation-related work but does NOT block D-5.12e or any later D-5.12 sub-phase:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

## D-5.12d post-commit prerequisites (all satisfied)

| Prerequisite | Status |
|---|---|
| D-5.12a design closed (v4 PASS WITH NOTES) | **Satisfied** |
| Operator decisions #1-#8 accepted | **Satisfied** |
| D-5.12b implementation closed (`24246d8`) | **Satisfied** |
| D-5.12c implementation closed (`4ae3689`) | **Satisfied** |
| D-5.12d design v2 = Codex PASS | **Satisfied** |
| D-5.12d implementation review round 2 = Codex PASS | **Satisfied** |
| D-5.12d source committed (`1c20177`) | **Satisfied** |
| D-5.12d closeout docs committed | **Committed** |

## D-5.12e implementation prerequisites (none satisfied yet)

| Prerequisite | Status |
|---|---|
| D-5.12d closeout committed | Committed |
| D-5.12e design-only review with Codex | Not started |
| Codex implementation review of D-5.12e diff | Not started |
| `dashboard.js` HARD BLOCK lift for D-5.12e (scoped) | Not given |
| Explicit operator authorization for D-5.12e commit | Not given |

## D-5.12d production deploy prerequisites (none satisfied yet)

| Prerequisite | Status |
|---|---|
| Migration 008 applied to production | Not applied |
| Migration 008 verified queryable in production (`SELECT 1 FROM emergency_audit_log LIMIT 1;`) | Not verified |
| `MANUAL_LIVE_ARMED="true"` set in production env | Operator-controlled |
| Explicit operator authorization for production deploy | Not given |
| Explicit operator authorization for first live BUY exercise | Not given |

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

## What D-5.12d did NOT do (still on the table)

- Did not wire CLOSE_POSITION (D-5.12e).
- Did not wire SELL_ALL (D-5.12f).
- Did not wire SET_STOP_LOSS or SET_TAKE_PROFIT (D-5.12g).
- Did not enable `_rehydratePositionJson` for live (D-5.12h).
- Did not update `scripts/reconciliation-shadow.js` for live `--persist` (D-5.12h).
- Did not update `scripts/recovery-inspect.js` for `emergency_audit_log` triage (D-5.12h).
- Did not add the `scripts/smoke-test-live-dashboard-flow.js` end-to-end harness (D-5.12h).
- Did not change Kraken execution paths.
- Did not change SL / TP / breakeven / trailing-stop logic.
- Did not change `bot.js`, `db.js`, `migrations/`, paper helpers, paper handlers, or D-5.12b gates.
- Did not apply Migration 008 to production.
- Did not deploy to Railway.
- Did not begin any O-* automation work.

## Alternative phases (operator may choose any)

If D-5.12e is not the next priority, the operator can advance instead to:

- Migration 008 production-application planning (HARD prerequisite for any D-5.12d production deploy)
- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

None of the O-* phases have started.

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase D-5.12e implementation (live CLOSE_POSITION persistence) | Codex design-only review + Codex implementation review of diff + scoped `dashboard.js` HARD BLOCK lift + operator authorization |
| Phase D-5.12f through D-5.12i implementation | Sequential per-sub-phase design review + scoped HARD BLOCK lift(s) + Codex implementation review + operator authorization |
| Live CLOSE_POSITION / SELL_ALL / SL / TP write-path changes | Completion of D-5.12e through D-5.12h |
| Editing `bot.js` / `db.js` / `migrations/` / `dashboard.js` | Explicit operator instruction (all prior scoped lifts expired post-commit; D-5.12d's `dashboard.js` lift expired post-`1c20177`) |
| Editing `scripts/recovery-inspect.js` | Explicit operator instruction (post-C.3 scoped lift expired) |
| Editing `scripts/smoke-test-live-writes.js` | Explicit operator instruction (post-smoke-test-cleanup scoped lift expired) |
| Editing any other `scripts/` file | Explicit operator instruction (per-file scoped lift required) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Applying Migration 008 (`emergency_audit_log`) to production | **Separate explicit operator authorization** (file landed in D-5.12c at `migrations/008_emergency_audit_log.sql`, header forbids runner application without authorization). HARD prerequisite before any D-5.12d production deploy or live BUY exercise per accepted v2 D-5.12d design. |
| D-5.12d production deployment to Railway | Migration 008 applied + verified + explicit operator authorization |
| First production live BUY exercise | D-5.12d deployed + `MANUAL_LIVE_ARMED="true"` + explicit operator authorization |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |
| Reverting migration 008 (drop emergency_audit_log) | Explicit safety review (destructive — drops historical incident rows; pre-rollback export format is D-5.12i operator-playbook deliverable) |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across all B.2 / Phase C / smoke-test cleanup commits, the D-5.12a design phase, the D-5.12b implementation commit (`24246d8`), the D-5.12b closeout (`58951ee`), the D-5.12c implementation commit (`4ae3689`), the D-5.12c closeout (`e2583df`), and the D-5.12d implementation commit (`1c20177`); explicitly excluded.

## How to proceed

After the D-5.12d closeout-docs commit lands, **HOLD**. No coding should happen until the operator chooses the next gated phase.

For **Phase D-5.12e design-only review** (when authorized): use `orchestrator/prompts/CODEX-REVIEW.md` as a template. Structure the design review around live `CLOSE_POSITION` persistence (mirror of B.1 paper close-source cleanup, but for live mode). The design must confirm: scoped to `dashboard.js` only, no `bot.js` / `db.js` / `migrations/` / `scripts/` touches, no Kraken execution path changes, no live SELL_ALL / SL / TP wiring (D-5.12f/g handle those), no live rehydrate (D-5.12h), `_emergencyAuditWrite` invoked only after Kraken success + DB persist failure, `_loglineFallback` floor preserves redacted attempted_payload + attempted_payload_hash, no auto-retry on Layer-2 audit failure. Do not write code, edit any HARD BLOCK file, or apply Migration 008 until the operator explicitly authorizes.

For **Migration 008 production-application planning** (when authorized): the operator-driven sequence is — (1) verify `git ls-files migrations/` shows 008 as the only unapplied file on disk; (2) apply Migration 008 to production via the migration runner under explicit authorization; (3) verify post-application: `SELECT 1 FROM emergency_audit_log LIMIT 1;` returns successfully; (4) document the application timestamp in `STATUS.md`. After application, D-5.12d production deployment is unblocked (still requires its own explicit operator authorization).

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

D-5.12d closeout docs are committed in STATUS / CHECKLIST / NEXT-ACTION. If D-5.12e advances next, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
