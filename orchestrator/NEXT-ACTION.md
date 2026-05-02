# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase D-5.12a is closed: design-only, 4-iteration Codex refinement, v4 PASS WITH NOTES.** Live persistence gate lift design audit completed across v1 (PASS-WITH-EDITS, 5 HIGH/MEDIUM concerns) → v2 (PASS-WITH-EDITS, 4 required + 2 MEDIUM) → v3 (PASS-WITH-EDITS, 5 required + 5 minor) → v4 (PASS WITH NOTES; 9 LOW operational concerns; **none are design blockers**). Operator accepted all eight design decision defaults. D-5.12 sub-phase plan approved (D-5.12b through D-5.12i). **No code, no commits, no migrations, no deploys, no edits to `dashboard.js` / `bot.js` / `db.js` / `scripts/` / `migrations/` during D-5.12a review.**

**Operator decision defaults — accepted for D-5.12 (all 8):**
1. SELL_ALL semantics — close one known bot position only.
2. DB-failure-after-Kraken — fail-loud + emergency audit + LOG_FILE/stderr double-fault + triple-fault stderr-only fallback. **No JSON fallback.**
3. Live DB-to-position.json rehydrate — enable in D-5.12h after d/e/f/g.
4. `MANUAL_LIVE_ARMED` two-layer check — `/api/trade` entry AND inside `handleTradeCommand` at `dashboard.js:1434-1439`.
5. Event_type naming — reuse existing `manual_*` (mode-agnostic per migration 007).
6. Emergency audit surface — separate `emergency_audit_log` table via migration 008.
7. Transition-lock — process-local mutex with lock-before-read.
8. `MANUAL_LIVE_ARMED` env-var-only for D-5.12 (DB-backed disarm deferred to D-5.13).

The next safe action is:

> **Phase D-5.12b — manual live gating implementation. Awaiting scoped `dashboard.js` HARD BLOCK lift.**

D-5.12b implements the `MANUAL_LIVE_ARMED` env-var two-layer check + `/api/control` transition-lock per the v4 design. Implementation cannot proceed until: scoped `dashboard.js` HARD BLOCK lift, Codex design review of the D-5.12b implementation diff, and explicit operator authorization.

## Phase D-5.12b — scope (per accepted v4 design)

- **Layer 1 — `/api/trade` POST entry handler.** Reject HTTP 403 *before* body parsing if `command` is one of OPEN_LONG/BUY_MARKET/CLOSE_POSITION/SELL_ALL/SET_STOP_LOSS/SET_TAKE_PROFIT, paperTrading=false, and `process.env.MANUAL_LIVE_ARMED !== "true"`.
- **Layer 2 — Inside `handleTradeCommand` at `dashboard.js:1434-1439`** (after `const isPaper = ctrl.paperTrading !== false;`). Throw if `!isPaper && process.env.MANUAL_LIVE_ARMED !== "true"`.
- **`/api/control` transition-lock** — process-local mutex; lock acquired BEFORE reading current mode/state. Prevents the TOCTOU race where `/api/control` reads paperTrading=false → live BUY commits Kraken → `/api/control` flips to paper → BUY persistence sees mode='paper' → split-mode persistence state.
- **Out of scope for D-5.12b:** any DB-write changes, any helper additions, any migration. Pure gating + lock work.

LOW carry-forward concerns to address in D-5.12b implementation:
- Process-local lock check/set must be synchronous within Node event loop; verify no async yield between check and set (Codex v4 note 9.f).

## Pre-D-5.12b acknowledgment — migration 006 side effect

This carryover note from B.2 / C track still applies for any future reconciliation-related work but does NOT block D-5.12b implementation:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

## Phase D-5.12b prerequisites

| Prerequisite | Status |
|---|---|
| D-5.12a design closed (v4 PASS WITH NOTES) | **Satisfied** |
| Operator decisions #1-#8 accepted | **Satisfied** |
| D-5.12b design review with Codex | Not started |
| Codex implementation review of D-5.12b diff | Not started |
| `dashboard.js` HARD BLOCK lift for D-5.12b (scoped) | Not given |
| Explicit operator authorization for D-5.12b commit | Not given |

Until **all** remaining prerequisites are satisfied, D-5.12b implementation cannot begin.

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
5. Process-local lock check/set must avoid async yield → D-5.12b.
6. D-5.12h testcontainer infrastructure scope (existing repo has none) → D-5.12h.
7. Emergency audit insert latency budget (real-money critical path) → D-5.12i operator playbook.
8. Deploy warning is documentation-only / no CI enforcement → D-5.13 hardening.
9. Emergency rows pre-rollback export format → D-5.12i operator playbook.

## What D-5.12a did NOT do (still on the table)

- Did not touch `dashboard.js`, `bot.js`, `db.js`, `migrations/`, or any `scripts/*` file.
- Did not change live trading behavior, Kraken execution, or any DB write path.
- Did not begin any D-5.12b through D-5.12i implementation.
- Did not create or apply migration 008.
- Did not deploy to Railway.
- Did not begin any O-* automation work.

## Alternative phases (operator may choose any)

If D-5.12b is not the next priority, the operator can advance instead to:

- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

None of these have started.

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase D-5.12b implementation (manual live gating) | Codex implementation review of diff + scoped `dashboard.js` HARD BLOCK lift + operator authorization |
| Phase D-5.12c through D-5.12i implementation | Sequential per-sub-phase design review + scoped HARD BLOCK lift(s) + Codex implementation review + operator authorization |
| Live mode write-path changes | Completion of D-5.12b through D-5.12h |
| Editing `bot.js` / `db.js` / `migrations/` / `dashboard.js` | Explicit operator instruction (all prior scoped lifts expired post-commit; D-5.12b will lift `dashboard.js` scoped) |
| Editing `scripts/recovery-inspect.js` | Explicit operator instruction (post-C.3 scoped lift expired) |
| Editing `scripts/smoke-test-live-writes.js` | Explicit operator instruction (post-smoke-test-cleanup scoped lift expired) |
| Editing any other `scripts/` file | Explicit operator instruction (per-file scoped lift required) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Creating Migration 008 (`emergency_audit_log`) | Phase D-5.12c scoped `migrations/` lift + operator authorization |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across all B.2 / Phase C / smoke-test cleanup commits and the D-5.12a design phase; explicitly excluded.

## How to proceed

For Phase D-5.12b implementation: use `orchestrator/prompts/CODEX-REVIEW.md` as a template. Structure the review around the D-5.12b scope above (Layer 1 + Layer 2 `MANUAL_LIVE_ARMED` checks + `/api/control` transition-lock with lock-before-read). The design must confirm: `dashboard.js`-only scope, no `bot.js` / `db.js` / `migrations/` / `scripts/` touches, no Kraken execution path changes, no DB-write changes (D-5.12b is gating only — DB-write work is D-5.12c onward), and Node event-loop synchronous lock semantics (Codex v4 note 9.f). Do not write code, edit `dashboard.js`, or touch any HARD BLOCK file until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If D-5.12b advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
