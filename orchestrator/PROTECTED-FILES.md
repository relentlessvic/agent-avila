# Orchestrator Protection Matrix

Formal file-classification matrix for the Agent Avila orchestrator. Defines which files are safe, restricted, or hard-blocked, and the review and approval requirements that gate any change.

This file is the canonical source for **what may change without re-asking** vs **what requires explicit operator authorization**. It complements (does not replace) `orchestrator/APPROVAL-GATES.md` (action-level gating), `orchestrator/AUTOPILOT-RULES.md` (supervised-autopilot rules), and `orchestrator/BLUEPRINT.md` (architectural blueprint).

Last updated: 2026-05-02 (ARC-1 — docs-only; pending Codex docs-only review and operator approval before commit).

## Classification levels

Three levels, applied per-file (or per-glob):

| Level | Meaning | Default behavior |
|---|---|---|
| **SAFE** | Low-risk: docs, design reports, audit reports, templates | Auto-allowed after Codex docs-only review (or trivially for pure `orchestrator/*` doc edits inside an active phase) |
| **RESTRICTED** | Production code or scripts that affect runtime but are not by themselves real-money paths | Default-blocked; per-file scoped lift required; Codex implementation review required before commit |
| **HARD BLOCK** | Real-money / safety-critical code, schema, secrets, or deploy surfaces | Blocked unless explicitly authorized in-session by the operator; Codex PASS alone does NOT authorize |

A file may move between levels only via an explicit, scoped operator lift for a single phase. The lift expires at commit; the prior level is automatically reinstated.

## Level 1 — SAFE / low-risk

Safe to edit during normal orchestrator work after Codex docs-only review (or, for `orchestrator/*` docs inside an active phase, immediately):

| Path / glob | Notes |
|---|---|
| `orchestrator/STATUS.md` | Phase status journal |
| `orchestrator/CHECKLIST.md` | End-to-end progression checklist |
| `orchestrator/NEXT-ACTION.md` | Single source of truth for the next allowed action |
| `orchestrator/BLUEPRINT.md` | Architectural blueprint |
| `orchestrator/FIX-PLAN.md` | Fix-track plan |
| `orchestrator/APPROVAL-GATES.md` | Action-level gate canonical source (action-class gating, complement to this file) |
| `orchestrator/AUTOPILOT-RULES.md` | Supervised-autopilot rule set |
| `orchestrator/PROTECTED-FILES.md` | This file |
| `orchestrator/PHASE-MODES.md` | Phase-mode system; safety-policy doc |
| `orchestrator/NEXT-ACTION-SELECTOR.md` | Next-action selector; safety-policy doc |
| `orchestrator/ROLE-HIERARCHY.md` | Role hierarchy and prompt templates; safety-policy doc |
| `orchestrator/AUTOMATION-PERMISSIONS.md` | Automation permission rules; safety-policy doc |
| `orchestrator/HANDOFF-RULES.md` | Handoff packet rules; safety-policy doc |
| `orchestrator/handoffs/**` | Handoff packet templates and instances; SAFE-class governance docs |
| `orchestrator/prompts/**` | Prompt templates for Codex / operator workflows |
| Design reports (any `*.md` produced as a design-only deliverable) | Must be design-only; no code touched |
| Read-only audit reports (`*.md`) | Audit observations, no mutations |
| Docs-only templates | Skeleton text, no executable changes |
| `README.md`, root-level docs | Documentation only |

**Rule:** SAFE files may be edited as part of any phase, including orchestrator-only phases (e.g., the Hands-Free ARC track or closeout doc commits). When an orchestrator-only phase changes only ordinary status or report docs, a Codex docs-only safety review is sufficient — no separate operator approval is required beyond the in-session phase context. Changes to safety-policy docs that govern future automation behavior (orchestrator/PROTECTED-FILES.md, orchestrator/APPROVAL-GATES.md, orchestrator/AUTOPILOT-RULES.md, orchestrator/BLUEPRINT.md, orchestrator/PHASE-MODES.md, orchestrator/NEXT-ACTION-SELECTOR.md, orchestrator/ROLE-HIERARCHY.md, orchestrator/AUTOMATION-PERMISSIONS.md, or orchestrator/HANDOFF-RULES.md) require Codex docs-only review and explicit operator approval before commit.

## Level 2 — RESTRICTED

Production code or scripts that affect runtime, but are not by themselves real-money paths. Default-blocked; require a scoped per-file lift, a design review (when non-trivial), and a Codex implementation review.

| Path / glob | Notes |
|---|---|
| `dashboard.js` | Web UI + manual `/api/trade` handlers; lift expires at commit |
| `db.js` | Postgres helpers; lift expires at commit |
| `scripts/**` | All scripts default-blocked per file; lift required per file |
| `scripts/smoke-test-*.js` | Smoke-test files (subset of `scripts/`) — same per-file lift discipline |
| `scripts/backtest-*.js`, any `backtest*` file | Backtest files (subset of `scripts/`) — same per-file lift discipline; must remain offline and separate from live trading per `CLAUDE.md` |
| `scripts/recovery-inspect.js`, `scripts/reconciliation-shadow.js`, `scripts/recovery-cleanup.js` | Operator-driven recovery / reconciliation scripts |
| `package.json`, `package-lock.json` | Dependency surface — RESTRICTED; adding/removing deps requires operator approval |
| `position.json.snap.*` (existing drift snapshot) | Read-only forensic artifact; do not edit, delete, or commit without explicit operator instruction |

**Rules for RESTRICTED files:**
- A scoped lift names exactly one file (or a tightly-scoped glob) and one phase.
- The lift expires at commit; the file returns to RESTRICTED automatically.
- A Codex implementation review is required on the diff before commit.
- For non-trivial changes, a Codex design review is required first.
- `git add` must stage by name. Never `git add -A` / `git add .`.

## Level 3 — HARD BLOCK (real-money / safety-critical)

These paths cannot be touched without an explicit, in-session operator instruction. **Codex PASS alone does NOT authorize these.** A scoped lift may be granted for a single phase; the lift expires at commit.

| Path / surface | Reason |
|---|---|
| `bot.js` | Autonomous live trading loop; SL / TP / breakeven / trailing-stop logic; live Kraken execution |
| `migrations/**` | Schema mutations are destructive on revert; production application is a separate gate |
| `position.json` | Live + paper position-state cache; manual edits desync DB / JSON / Kraken truths |
| Live Kraken execution paths (any code path called when `paperTrading === false`) | Real-money order placement |
| Deployment configuration (`railway.json`, deploy scripts, CI/CD config) | Production deploy surface |
| Production environment variables / secrets (`.env`, `MANUAL_LIVE_ARMED`, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, `DATABASE_URL`, etc.) | Credential and arming surface |
| Risk-management logic (SL / TP / BE / trailing-stop in `bot.js`) | Real-money loss-prevention logic |
| Real-money behavior surface (any code that places a live Kraken order, modifies a live SL / TP, or executes a live SELL_ALL) | Real-money irreversible actions |
| Migration application to production (`scripts/run-migrations.js` against the prod DB) | Schema-mutation deploy — separate from the migration-file commit gate |

## Review requirements

| Change type | Codex review | Operator approval |
|---|---|---|
| Edit to an ordinary SAFE file (orchestrator/* status doc, design report, audit report) | Docs-only review (recommended) | Not required beyond in-session phase context |
| Edit to a safety-policy SAFE file (orchestrator/PROTECTED-FILES.md, orchestrator/APPROVAL-GATES.md, orchestrator/AUTOPILOT-RULES.md, orchestrator/BLUEPRINT.md, orchestrator/PHASE-MODES.md, orchestrator/NEXT-ACTION-SELECTOR.md, orchestrator/ROLE-HIERARCHY.md, orchestrator/AUTOMATION-PERMISSIONS.md, orchestrator/HANDOFF-RULES.md) | Docs-only review required | Required: explicit operator approval before commit |
| Edit to a RESTRICTED file | Design review (non-trivial changes) + implementation review (always) | Required: scoped per-file lift |
| Edit to a HARD BLOCK file | Design review (always) + implementation review (always) | Required: explicit in-session authorization, scoped to one phase |
| Migration application to production | Production runner execution is operator-only; the migration application plan / checklist / runbook requires Codex docs-only or design review before operator approval | Required: separate explicit authorization gate, distinct from the commit-time approval |
| Deploy to Railway | Production deploy execution is operator-only; the deploy plan / checklist / runbook requires Codex docs-only or design review before operator approval | Required: explicit operator command |
| First production live exercise (live BUY / live CLOSE / live SELL_ALL / live SL / live TP) | Production live execution is operator-only; the live-exercise plan / checklist / runbook requires Codex docs-only or design review before operator approval | Required: explicit operator command + `MANUAL_LIVE_ARMED="true"` + all preceding migration / deploy gates satisfied |

## Stop conditions — must halt immediately

The orchestrator (Claude) MUST stop and surface the situation to the operator if any of the following occur, regardless of phase:

- A protected file (RESTRICTED or HARD BLOCK) is unexpectedly modified outside the active scoped lift.
- `git status` shows an untracked or modified file that was not authorized for the current phase (excluding the pre-existing `position.json.snap.*` drift snapshot).
- A Codex review returns FAIL, FAIL-WITH-CONDITIONS, or REJECT.
- A migration runner is about to execute against production without explicit authorization for that exact migration.
- A live Kraken call would execute outside an explicitly authorized live exercise (i.e., `MANUAL_LIVE_ARMED !== "true"` or no operator instruction).
- A deployment trigger (Railway push, `git push`, `npm run deploy`, etc.) is encountered without operator instruction.
- A destructive git operation (`reset --hard`, `push --force`, `branch -D`, file deletion, interactive rebase) is requested without operator instruction.
- A scoped lift appears to be widening beyond the named file or phase.
- The working tree state diverges from what the active phase expects.

On stop: report the unexpected state, do not attempt automatic recovery, and wait for operator instruction.

## Must never be automated (operator-only forever)

These actions must NEVER be taken by Claude or any future automation layer (e.g., Ruflo) without an explicit, in-session operator instruction. They are not auto-approvable by any Codex PASS, by any scoped lift, or by any orchestrator policy:

- Applying a migration to production.
- Deploying to Railway (or any production target).
- Placing a real-money Kraken order, or modifying a live SL / TP / SELL_ALL.
- Setting or unsetting `MANUAL_LIVE_ARMED` in production.
- Modifying production environment variables or secrets.
- Force-pushing, hard-resetting, deleting branches, or otherwise rewriting shared git history.
- Reverting a migration that has been applied to production (destructive).
- Bulk operations against `scripts/`, `migrations/`, or any HARD BLOCK glob (e.g., lifting all of `scripts/` at once).
- Executing the first live exercise of any newly wired live persistence path without explicit operator instruction.

## Ruflo / future-automation rule

Any future automation layer (named "Ruflo" or otherwise) that wraps or extends the orchestrator inherits the protections in this file **without exception**. Specifically:

- **Ruflo / future automation cannot auto-approve dangerous work.** Any HARD BLOCK action, any migration application, any deploy, any real-money exercise, and any destructive git operation requires an explicit, in-session human operator instruction.
- A passing Codex review, a passing test suite, a green CI status, or a clean working tree DOES NOT constitute approval for HARD BLOCK actions.
- An automation layer's own internal "approval" model (LLM self-approval, policy stub, signed token, scheduled-task trigger, etc.) DOES NOT constitute operator approval.
- The phrase "the operator pre-approved this" is not durable beyond the scope explicitly stated in the original approval. Approvals do not extend across phases, files, or actions.
- If Ruflo or any successor proposes to widen, batch, or automate any HARD BLOCK action, the request must be surfaced to the operator and the existing protections in this file must be honored as-is.
- Automation may freely execute SAFE-class read-only verification (status checks, diffs, log reads, audit reports) and may draft proposed changes for HARD BLOCK files — but cannot apply, commit, deploy, or execute them without operator instruction.

## Scope of an operator approval

An approval grants permission for a specific action and nothing more. In particular:

- A lift on `dashboard.js` for one phase does not extend to the next phase.
- An approval to apply migration N does not extend to migration N+1.
- A live BUY exercise authorization does not authorize a subsequent live CLOSE.
- A "proceed" on a Codex-PASS diff authorizes the diff Codex saw, scoped to the named files, and nothing beyond.

When in doubt: ask.

## Cross-references

- `orchestrator/APPROVAL-GATES.md` — action-class gating (auto-allow vs HARD BLOCK by action type); complementary to this file's per-path matrix.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules (when to halt, when to ask, how Codex PASS interacts with autopilot loops).
- `orchestrator/BLUEPRINT.md` — architectural blueprint and Safety Enforcement Layer.
- `orchestrator/STATUS.md` — current-phase journal; cites which scoped lifts are active.
- `orchestrator/NEXT-ACTION.md` — single source of truth for the next allowed action.
- `CLAUDE.md` (repo root) — top-level role / safety / change-discipline rules.

## Change history

- **ARC-1 (2026-05-02):** Initial protection matrix drafted; pending Codex docs-only review and operator approval before commit.
