# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase D-5.12b is closed: source committed `24246d8`.** Manual live gating implementation in `dashboard.js`. Adds defense-in-depth `MANUAL_LIVE_ARMED` env-var gating across two layers (Layer 1 at `/api/trade` POST entry; Layer 2 inside `handleTradeCommand` after `isPaper` derivation), plus `/api/control` SET_MODE lock-before-read with a scoped under-lock re-read of `CONTROL_FILE`. New `MANUAL_LIVE_COMMANDS` Set with the six manual-live action tokens. Codex implementation review took two rounds: round 1 = FAIL [MEDIUM] over a stale outer ctrl snapshot consumed by SET_MODE preflight after lock acquisition; round 2 (post-revision applying Codex's own option (b) — scoped under-lock CONTROL_FILE re-read inside the SET_MODE branch, leaving the outer pre-lock ctrl read intact for non-SET_MODE requiresConfirm logic) = **PASS, safe to commit** (all 34 sub-items PASS).

**D-5.12b did NOT add:** DB persistence, helper wrappers (`shadowRecordManualLive*`), `emergency_audit_log` table, Migration 008, Kraken execution changes, SL/TP/breakeven/trailing-stop logic changes. `bot.js` / `db.js` / `migrations/` / `scripts/` untouched.

**Phase D-5.12a is closed: design-only, 4-iteration Codex refinement, v4 PASS WITH NOTES.** Live persistence gate lift design audit completed across v1 (PASS-WITH-EDITS, 5 HIGH/MEDIUM concerns) → v2 (PASS-WITH-EDITS, 4 required + 2 MEDIUM) → v3 (PASS-WITH-EDITS, 5 required + 5 minor) → v4 (PASS WITH NOTES; 9 LOW operational concerns; **none are design blockers**). Operator accepted all eight design decision defaults. D-5.12 sub-phase plan approved (D-5.12b through D-5.12i). **No code, no commits, no migrations, no deploys, no edits to `dashboard.js` / `bot.js` / `db.js` / `scripts/` / `migrations/` during D-5.12a review.**

**Operator decision defaults — accepted for D-5.12 (all 8):**
1. SELL_ALL semantics — close one known bot position only.
2. DB-failure-after-Kraken — fail-loud + emergency audit + LOG_FILE/stderr double-fault + triple-fault stderr-only fallback. **No JSON fallback.**
3. Live DB-to-position.json rehydrate — enable in D-5.12h after d/e/f/g.
4. `MANUAL_LIVE_ARMED` two-layer check — `/api/trade` entry AND inside `handleTradeCommand` at `dashboard.js:1434-1439`. **Implemented in D-5.12b at `dashboard.js:12247-12282` (Layer 1) and `dashboard.js:1449-1464` (Layer 2).**
5. Event_type naming — reuse existing `manual_*` (mode-agnostic per migration 007).
6. Emergency audit surface — separate `emergency_audit_log` table via migration 008.
7. Transition-lock — process-local mutex with lock-before-read. **Implemented in D-5.12b at `dashboard.js:12124-12137` for SET_MODE; the lock primitive at `dashboard.js:11380-11385` is synchronous (Codex v4 note 9.f satisfied). Outer pre-lock ctrl snapshot retained for non-SET_MODE requiresConfirm; SET_MODE branch re-reads CONTROL_FILE under the lock at `dashboard.js:12142-12157`.**
8. `MANUAL_LIVE_ARMED` env-var-only for D-5.12 (DB-backed disarm deferred to D-5.13).

The next safe action is:

> **Phase D-5.12c — live helper wrappers (`shadowRecordManualLive*`) + Migration 008 (`emergency_audit_log`) + `db.js` emergency-audit insert helper. Awaiting scoped `dashboard.js` + `db.js` + `migrations/` HARD BLOCK lifts.**

D-5.12c implements the live-mode helper wrappers in `dashboard.js`, creates Migration 008 with the `emergency_audit_log` table, and adds the `db.js` emergency-audit insert helper. Implementation cannot proceed until: scoped `dashboard.js` + `db.js` + `migrations/` HARD BLOCK lifts, Codex design review of the D-5.12c diff, Codex implementation review of the D-5.12c diff, and explicit operator authorization.

## Phase D-5.12c — scope (per accepted v4 design)

- **`db.js` emergency-audit insert helper.** Atomic insert into `emergency_audit_log` via `inTransaction`. Canonical `event_id` recipe: SHA-256 of allowlisted payload tuple (`mode`, `source`, `kraken_order_id` as string, `failure_class`, `attempted_payload_hash`, `timestamp_bucket` as UTC ISO). RFC-8785-style canonicalization. `event_id UNIQUE` enforces idempotency at the DB layer. `retry_history` is `jsonb` and appended via `jsonb_set` so retries don't lose prior attempt context.
- **Migration 008 — `emergency_audit_log` table.** Columns: `event_id TEXT NOT NULL UNIQUE`, `mode TEXT NOT NULL CHECK (mode IN ('paper','live'))`, `source TEXT`, `kraken_order_id TEXT`, `failure_class TEXT`, `attempted_payload JSONB`, `attempted_payload_hash TEXT`, `retry_history JSONB`, timestamps. Four triage indexes per the v4 design. Idempotent ALTER guards.
- **`dashboard.js` `shadowRecordManualLive*` helper wrappers.** Mirrors of the paper-mode `shadowRecordManualPaper*` wrappers. Wrappers do NOT yet wire into the live `/api/trade` handlers — that is D-5.12d through D-5.12g. D-5.12c only adds the helpers and the table; live persistence call sites are out of scope.
- **Out of scope for D-5.12c:** wiring helpers into live `OPEN_LONG` / `CLOSE_POSITION` / `SELL_ALL` / `SET_STOP_LOSS` / `SET_TAKE_PROFIT` handlers; live rehydrate; smoke harness; recovery-script updates. All of those land in D-5.12d through D-5.12h.

LOW carry-forward concerns to address in D-5.12c implementation:
- Canonical event_id precision — kraken_order_id always string, UTC ISO bucket math platform-stable (Codex v4 note 9.a).
- `retry_history` growth/retention — unbounded retry array could grow beyond Postgres TOAST limits under storms; cap or retention note (Codex v4 note 9.b).

## Pre-D-5.12c acknowledgment — migration 006 side effect

This carryover note from B.2 / C track still applies for any future reconciliation-related work but does NOT block D-5.12c implementation:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).
- **Migration 008 will be the next-applied migration when D-5.12c lands.** The runner will apply only 008 at that point with no further side effects (only 008 will be unapplied at that moment).

## Phase D-5.12c prerequisites

| Prerequisite | Status |
|---|---|
| D-5.12a design closed (v4 PASS WITH NOTES) | **Satisfied** |
| Operator decisions #1-#8 accepted | **Satisfied** |
| D-5.12b implementation closed (`24246d8`) | **Satisfied** |
| D-5.12c design review with Codex | Not started |
| Codex implementation review of D-5.12c diff | Not started |
| `dashboard.js` HARD BLOCK lift for D-5.12c (scoped) | Not given |
| `db.js` HARD BLOCK lift for D-5.12c (scoped) | Not given |
| `migrations/` HARD BLOCK lift for D-5.12c (scoped) | Not given |
| Explicit operator authorization for D-5.12c commit | Not given |
| Explicit operator authorization to apply Migration 008 to production | Not given |

Until **all** remaining prerequisites are satisfied, D-5.12c implementation cannot begin.

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

1. Canonical event_id precision (kraken_order_id-as-string, UTC ISO bucket math) → fold into D-5.12c.
2. `retry_history` growth/retention cap → D-5.12c.
3. All-handler smoke deploy-velocity / staging Kraken API quota → D-5.12d/e/f/g closeouts.
4. Railway stderr retention finite → D-5.12i operator playbook.
5. Process-local lock check/set must avoid async yield → D-5.12b. **Closed in D-5.12b (`24246d8`):** the `acquireTransitionLock` primitive at `dashboard.js:11380-11385` is synchronous; no async yield between check and set.
6. D-5.12h testcontainer infrastructure scope (existing repo has none) → D-5.12h.
7. Emergency audit insert latency budget (real-money critical path) → D-5.12i operator playbook.
8. Deploy warning is documentation-only / no CI enforcement → D-5.13 hardening.
9. Emergency rows pre-rollback export format → D-5.12i operator playbook.

## What D-5.12b did NOT do (still on the table)

- Did not add any DB write path or DB persistence (no `INSERT`, `UPDATE`, or `DELETE` added; `dbAvailable()` is not called from any new code path).
- Did not add any helper wrappers (`shadowRecordManualLive*` are still pending).
- Did not create or apply Migration 008 (`emergency_audit_log`).
- Did not change Kraken execution paths.
- Did not change SL / TP / breakeven / trailing-stop logic.
- Did not change `bot.js`, `db.js`, `migrations/`, or any `scripts/*` file.
- Did not change paper-mode behavior.
- Did not begin D-5.12c through D-5.12i implementation.
- Did not deploy to Railway.
- Did not begin any O-* automation work.

## Alternative phases (operator may choose any)

If D-5.12c is not the next priority, the operator can advance instead to:

- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

None of these have started.

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase D-5.12c implementation (live helper wrappers + Migration 008 + db.js insert helper) | Codex design review + Codex implementation review of diff + scoped `dashboard.js` + `db.js` + `migrations/` HARD BLOCK lifts + operator authorization |
| Phase D-5.12d through D-5.12i implementation | Sequential per-sub-phase design review + scoped HARD BLOCK lift(s) + Codex implementation review + operator authorization |
| Live mode write-path changes | Completion of D-5.12c through D-5.12h |
| Editing `bot.js` / `db.js` / `migrations/` / `dashboard.js` | Explicit operator instruction (all prior scoped lifts expired post-commit; D-5.12b's `dashboard.js` lift expired post-`24246d8`) |
| Editing `scripts/recovery-inspect.js` | Explicit operator instruction (post-C.3 scoped lift expired) |
| Editing `scripts/smoke-test-live-writes.js` | Explicit operator instruction (post-smoke-test-cleanup scoped lift expired) |
| Editing any other `scripts/` file | Explicit operator instruction (per-file scoped lift required) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Creating Migration 008 (`emergency_audit_log`) | Phase D-5.12c scoped `migrations/` lift + operator authorization |
| Applying Migration 008 to production | Phase D-5.12c implementation closed + explicit operator authorization |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across all B.2 / Phase C / smoke-test cleanup commits, the D-5.12a design phase, and the D-5.12b implementation commit (`24246d8`); explicitly excluded.

## How to proceed

For Phase D-5.12c implementation: use `orchestrator/prompts/CODEX-REVIEW.md` as a template. Structure the review around the D-5.12c scope above (`db.js` emergency-audit insert helper + Migration 008 `emergency_audit_log` + `dashboard.js` `shadowRecordManualLive*` wrappers). The design must confirm: scoped to `dashboard.js` + `db.js` + `migrations/` only, no `bot.js` / `scripts/` touches, no Kraken execution path changes, no live-handler call-site wiring (D-5.12d through D-5.12g handle wiring), no live rehydrate (D-5.12h), Migration 008 idempotent ALTER guards, `event_id UNIQUE` + `mode CHECK` schema, canonical SHA-256 event_id recipe with stable inputs (kraken_order_id-as-string, UTC ISO bucket math), `retry_history` jsonb append via `jsonb_set`, retention/growth cap discussed. Do not write code, edit any HARD BLOCK file, or apply Migration 008 until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If D-5.12c advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
