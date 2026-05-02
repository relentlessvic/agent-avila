# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase D-5.12c is closed: source committed `4ae3689`.** Live helper wrappers + Migration 008 (`emergency_audit_log`) + `db.js` emergency-audit insert helper + `dashboard.js` emergency utility helpers. `dashboard.js` (+379 lines) adds four `shadowRecordManualLive{Buy,Close,SLUpdate,TPUpdate}` wrappers (mirror paper return contract `{ ok, reason, error?, errorClass?, emergency_context? }` with `mode: "live"` hard-coded), `_redactAttemptedPayload`, `_loglineFallback`, and `_emergencyAuditWrite`. `db.js` (+118 lines) adds `insertEmergencyAuditLog` (`ON CONFLICT (event_id) DO UPDATE` with `metadata.retry_history` `jsonb_set` append; `attempted_payload` not overwritten on conflict; first `error_message` preserved via `COALESCE`), `buildEmergencyEventId` (`d512-emergency-` prefix), `sha256HexCanonical` (RFC-8785-style canonicalization), and `classifyDbError` (returns `unique_violation_one_open_per_mode` / `unique_violation_kraken_order_id` / `other`). New `migrations/008_emergency_audit_log.sql` (46 lines) with operator warning header forbidding runner application without explicit authorization, 13-column schema, inline `mode CHECK`, `event_id UNIQUE`, four triage indexes. Codex review: design v1 = PASS-WITH-REQUIRED-EDITS (3 HIGH + 1 MEDIUM); v2 = **PASS, design ready**. Implementation review round 1 = FAIL [MEDIUM] over `classifyDbError` constraint-name mismatch; round 2 post-revision = **PASS, safe to commit** (all 22 sub-items PASS).

**D-5.12c did NOT add:** wiring of any live `/api/trade` handler to call `shadowRecordManualLive*`; P0-L3 unique-violation recovery branch (D-5.12d); live rehydrate (D-5.12h); smoke harness (D-5.12h); recovery-script updates (D-5.12h). **Migration 008 is NOT applied to production** — application is a separate explicit operator authorization gate. `bot.js` / `scripts/` untouched.

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

> **Phase D-5.12d — live OPEN_LONG persistence design-only review (with P0-L3 unique-violation recovery + P0-L4 fail-loud + P1-L4 retry-aware emergency audit). Design phase only — no scoped HARD BLOCK lift required for design.**

D-5.12d designs the live OPEN_LONG handler wiring that calls `shadowRecordManualLiveBuy` from `/api/trade` and integrates the failure ladder per the accepted v4 design: Layer 1 helper return → caller decision (was Kraken executed?) → Layer 2 `_emergencyAuditWrite(emergency_context)` → Layer 3 `_loglineFallback(line)` → Layer 4 stderr. Catches helper's `errorClass: "unique_violation_one_open_per_mode"` for the P0-L3 race and routes through emergency audit with no auto-retry. D-5.12d implementation cannot proceed until: design-only review with Codex, scoped `dashboard.js` HARD BLOCK lift, Codex implementation review of the D-5.12d diff, and explicit operator authorization.

## Phase D-5.12d — scope (per accepted v4 design)

- **Live `OPEN_LONG` / `BUY_MARKET` handler in `/api/trade`.** Currently writes `position.json` directly. D-5.12d wires the existing `shadowRecordManualLiveBuy` (landed in D-5.12c) into the post-Kraken-success path. Branch via `if (isPaper)` — paper path unchanged; live path adds DB-first persist with cascading failure ladder.
- **P0-L3 unique-violation recovery.** Catch helper's `{ ok: false, errorClass: "unique_violation_one_open_per_mode" }`. Build emergency_context, call `_emergencyAuditWrite`, throw operator-visible HTTP 500 with reconstruction guidance, no auto-retry.
- **P0-L4 fail-loud.** Any other helper failure after Kraken execution must call `_emergencyAuditWrite` then surface to operator. Position.json is NOT updated when DB persist fails (interim-state invariant: `position.json` is best-effort cache during D-5.12d-g, becomes optional cache after D-5.12h rehydrate).
- **P1-L4 retry-aware emergency audit.** Single retry of `_emergencyAuditWrite` allowed before falling through to `_loglineFallback`.
- **Out of scope for D-5.12d:** CLOSE_POSITION (D-5.12e), SELL_ALL (D-5.12f), SL/TP wiring (D-5.12g), live rehydrate (D-5.12h), smoke harness (D-5.12h).

HIGH carry-forward discipline:
- Every partial deploy of D-5.12d must smoke-test ALL FIVE live manual handlers, not just OPEN_LONG (Codex v4 note 9.c).

## Pre-D-5.12d acknowledgment — Migration 008 application gate

Migration 008 (`emergency_audit_log` table) landed in repo via D-5.12c (`4ae3689`) but is **NOT applied to production**:

- The migration file's header explicitly forbids running it via `scripts/run-migrations.js` without operator authorization.
- D-5.12d code work does NOT require Migration 008 to be applied first — the wiring can be reviewed and committed before the table exists in production. However, calling `_emergencyAuditWrite` against an unmigrated DB will fail (the helper will throw a Postgres "table does not exist" error which falls through to `_loglineFallback` at Layer 3). This is intentional — Layer 3 is the floor of durability; LOG_FILE preserves enough context for manual reconstruction.
- **Operator must apply Migration 008 to production BEFORE relying on Layer 2 emergency audit recovery.** Application is a separate authorization gate.
- Before applying Migration 008: verify `git ls-files migrations/` shows 008 as the only unapplied file on disk.

## Pre-D-5.12d acknowledgment — migration 006 side effect

This carryover note from B.2 / C track still applies for any future reconciliation-related work but does NOT block D-5.12d implementation:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

## Phase D-5.12d prerequisites

| Prerequisite | Status |
|---|---|
| D-5.12a design closed (v4 PASS WITH NOTES) | **Satisfied** |
| Operator decisions #1-#8 accepted | **Satisfied** |
| D-5.12b implementation closed (`24246d8`) | **Satisfied** |
| D-5.12c implementation closed (`4ae3689`) | **Satisfied** |
| D-5.12d design review with Codex | Not started |
| Codex implementation review of D-5.12d diff | Not started |
| `dashboard.js` HARD BLOCK lift for D-5.12d (scoped) | Not given |
| Explicit operator authorization for D-5.12d commit | Not given |
| Migration 008 applied to production (recommended before D-5.12d wiring is exercised in production) | Not applied (separate gate) |

Until **all** remaining prerequisites are satisfied, D-5.12d implementation cannot begin.

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

## What D-5.12c did NOT do (still on the table)

- Did not wire any live `/api/trade` handler to call `shadowRecordManualLive*` (D-5.12d/e/f/g).
- Did not implement P0-L3 unique-violation recovery branch (D-5.12d).
- Did not enable `_rehydratePositionJson` for live (D-5.12h).
- Did not update `scripts/reconciliation-shadow.js` for live `--persist` (D-5.12h).
- Did not update `scripts/recovery-inspect.js` for `emergency_audit_log` triage (D-5.12h).
- Did not add the `scripts/smoke-test-live-dashboard-flow.js` end-to-end harness (D-5.12h).
- Did not change Kraken execution paths.
- Did not change SL / TP / breakeven / trailing-stop logic.
- Did not change `bot.js`, paper helpers, paper handlers, or D-5.12b gates.
- Did not apply Migration 008 to production.
- Did not deploy to Railway.
- Did not begin any O-* automation work.

## Alternative phases (operator may choose any)

If D-5.12d is not the next priority, the operator can advance instead to:

- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

None of these have started.

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase D-5.12d implementation (live OPEN_LONG persistence + P0-L3 recovery) | Codex design review + Codex implementation review of diff + scoped `dashboard.js` HARD BLOCK lift + operator authorization |
| Phase D-5.12e through D-5.12i implementation | Sequential per-sub-phase design review + scoped HARD BLOCK lift(s) + Codex implementation review + operator authorization |
| Live mode write-path changes | Completion of D-5.12d through D-5.12h |
| Editing `bot.js` / `db.js` / `migrations/` / `dashboard.js` | Explicit operator instruction (all prior scoped lifts expired post-commit; D-5.12c's `dashboard.js` + `db.js` + `migrations/` lifts expired post-`4ae3689`) |
| Editing `scripts/recovery-inspect.js` | Explicit operator instruction (post-C.3 scoped lift expired) |
| Editing `scripts/smoke-test-live-writes.js` | Explicit operator instruction (post-smoke-test-cleanup scoped lift expired) |
| Editing any other `scripts/` file | Explicit operator instruction (per-file scoped lift required) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Applying Migration 008 (`emergency_audit_log`) to production | **Separate explicit operator authorization** (file landed in D-5.12c at `migrations/008_emergency_audit_log.sql`, header forbids runner application without authorization) |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |
| Reverting migration 008 (drop emergency_audit_log) | Explicit safety review (destructive — drops historical incident rows; pre-rollback export format is D-5.12i operator-playbook deliverable) |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across all B.2 / Phase C / smoke-test cleanup commits, the D-5.12a design phase, the D-5.12b implementation commit (`24246d8`), the D-5.12b closeout (`58951ee`), and the D-5.12c implementation commit (`4ae3689`); explicitly excluded.

## How to proceed

For Phase D-5.12d implementation: use `orchestrator/prompts/CODEX-REVIEW.md` as a template. Structure the design review around the D-5.12d scope above (live OPEN_LONG handler wiring of `shadowRecordManualLiveBuy` + failure-ladder integration + P0-L3 unique-violation recovery + P0-L4 fail-loud + P1-L4 retry-aware emergency audit). The design must confirm: scoped to `dashboard.js` only, no `bot.js` / `db.js` / `migrations/` / `scripts/` touches, no Kraken execution path changes, no live CLOSE_POSITION / SELL_ALL / SL / TP wiring (D-5.12e/f/g handle those), no live rehydrate (D-5.12h), `_emergencyAuditWrite` invoked only after Kraken success + DB persist failure, `_loglineFallback` floor preserves redacted attempted_payload + attempted_payload_hash, no auto-retry on P0-L3 unique-violation. Do not write code, edit any HARD BLOCK file, or apply Migration 008 until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If D-5.12d advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
