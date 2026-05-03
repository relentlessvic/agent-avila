# Approval Gates

Defines what Claude may do automatically, what requires explicit operator approval, and what an operator approval must contain to be valid. This file is the canonical action-class safety gate for the orchestrator's supervised autopilot loop. It complements (does not replace) `orchestrator/PROTECTED-FILES.md` (per-path classification matrix), `orchestrator/AUTOPILOT-RULES.md` (supervised-autopilot rules), and `orchestrator/BLUEPRINT.md` (architectural blueprint).

Last updated: 2026-05-02 (ARC-2 — docs-only; pending Codex docs-only review and operator approval before commit).

## Auto-allowed after Codex PASS

These actions can proceed without re-asking the operator, **provided Codex has returned a PASS verdict on the relevant diff** and the action stays inside the scope Codex reviewed:

- Documentation updates to ordinary status / report docs (`orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`, `orchestrator/FIX-PLAN.md`, design reports, audit reports, comments in code, README)
- Read-only audits (`grep`, `find`, file reads, log inspections, `git log` / `git diff` / `git status`)
- Dashboard UI-only cleanup (CSS, render-only logic, label text — no state-mutation paths) within an active scoped lift
- Non-live paper dashboard fixes (paper-mode persistence, paper-mode UI labels) within an active scoped lift
- Running existing test suites and reading test results
- Syntax checks (`node --check`, lint)
- Diff review (`git diff`, `git status`, `git diff --cached`)
- Commits **for the specific files Codex reviewed and approved** (stage by name, never `git add -A`)

Note: edits to safety-policy docs (`orchestrator/PROTECTED-FILES.md`, `orchestrator/APPROVAL-GATES.md`, `orchestrator/AUTOPILOT-RULES.md`, `orchestrator/BLUEPRINT.md`, `orchestrator/PHASE-MODES.md`, `orchestrator/NEXT-ACTION-SELECTOR.md`, `orchestrator/ROLE-HIERARCHY.md`, `orchestrator/AUTOMATION-PERMISSIONS.md`) require Codex docs-only review **and** explicit operator approval before commit, per `orchestrator/PROTECTED-FILES.md`. They are not auto-allowed.

## Requires explicit operator approval (HARD BLOCK list)

These actions must NOT be taken without an explicit, in-session operator instruction. Codex PASS alone does **not** authorize these:

- Editing `bot.js`
- Editing `db.js`
- Editing `migrations/`
- Editing or invoking Kraken execution paths
- Editing live trading logic (any code path that runs when `paperTrading === false`)
- Editing stop loss, take profit, breakeven, trailing stop, or position management logic
- Live persistence migration (Phase D-5.12 and related)
- Deployment (Railway, any production target)
- Real-money behavior changes (live order placement, live SL/TP/SELL_ALL changes)
- Deleting files (`rm`, `git rm`, removing whole functions)
- Force push / `git reset --hard` / interactive rebase / branch deletion
- Lifting any HARD BLOCK declared in `BLUEPRINT.md`, `PROTECTED-FILES.md`, or this file
- Adding new `event_type` values (requires schema migration + operator approval)
- Modifying environment variables, `.env`, or API keys

## Numbered approval-gate matrix

Each row defines a specific class of action that requires explicit, in-session operator approval. Codex PASS, clean `git status`, green tests, Claude self-approval, and Ruflo / future-automation approval do NOT satisfy these gates.

| # | Action class | Approval required | Codex review required first |
|---|---|---|---|
| 1 | Any `bot.js` change | Explicit operator approval, scoped per-phase | Design review (when non-trivial) + implementation review (always) |
| 2 | Any `db.js` change | Explicit operator approval, scoped per-phase | Design review (when non-trivial) + implementation review (always) |
| 3 | Any migration file change (`migrations/*.sql`) | Explicit operator approval, scoped per-phase | Design review + implementation review |
| 4 | Any production migration application (running the runner against the prod DB) | **Separate** explicit operator approval, distinct from the migration-file commit-time approval | Migration-application plan / checklist / runbook requires Codex docs-only or design review before operator approval |
| 5 | Any Railway deployment | Explicit operator approval, per-deploy | Deploy plan / checklist / runbook requires Codex docs-only or design review before operator approval |
| 6 | Any live Kraken action (live order, live cancel, live balance-mutation call) | Explicit operator approval, per-action | Live-exercise plan / checklist / runbook requires Codex docs-only or design review before operator approval |
| 7 | Any live dashboard handler implementation (any `dashboard.js` code path executed when `paperTrading === false`) | Explicit operator approval, scoped per-phase | Design review + implementation review |
| 8 | Any `position.json` write or reconciliation (manual edit, recovery script writing to it, reconciliation persist run) | Explicit operator approval, per-write | Plan must be reviewed when the write originates from an automated path |
| 9 | Any real-money behavior change (live order placement, live SL / TP / SELL_ALL semantics, sizing, leverage, risk caps) | Explicit operator approval, per-change | Design review + implementation review |
| 10 | Any Ruflo install or automation upgrade (adding a new automation layer, widening an existing one, enabling new triggers, scheduling new agents) | Explicit operator approval | Docs-only or design review of the automation-upgrade plan |
| 11 | Any Claude Code permission change (`settings.json`, hooks, permission allowlist, MCP server install/upgrade, slash-command install) | Explicit operator approval | Docs-only review of the permission-change plan |
| 12 | Any command that can mutate production state (DB writes, file writes outside the working tree to prod paths, network calls to prod APIs, deploy triggers, scheduler triggers) | Explicit operator approval, per-command | Plan must be reviewed before approval |
| 13 | Any production environment variable or secret change (`.env`, Railway env vars, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, `DATABASE_URL`, etc.) | Explicit operator approval | Docs-only review when the change affects safety policy |
| 14 | Any action involving `MANUAL_LIVE_ARMED` (setting, unsetting, reading from prod, embedding in code) | Explicit operator approval, per-action | Plan must be reviewed before approval |
| 15 | Any destructive git operation (`reset --hard`, `push --force`, `branch -D`, file deletion, interactive rebase, `git rm`, `git clean -f`) | Explicit operator approval, per-operation | Not Codex-gated; operator-only |
| 16 | Any command that could widen automation authority (lifting HARD BLOCKs in bulk, scheduling new automation, adding new auto-allow patterns to settings, enabling new MCP tools, granting new shell permissions) | Explicit operator approval | Docs-only review of the widening plan |

## Actions that do NOT need operator approval

These actions are safe under the orchestrator's read-only or planning posture and do not require operator approval (a Codex docs-only review may still be applied where it improves quality):

- Read-only audits (`grep`, `find`, file reads, log inspections)
- Design-only reports (Markdown files describing a proposed design with no code touched)
- Draft documentation in the working tree before commit (any `orchestrator/*` doc edit prior to staging)
- Codex review prompts and the act of invoking Codex for review
- `git status` / `git status --short` / `git diff` / `git diff --cached` / `git log` / `git show`
- `node --check`, lint runs, and other read-only validators
- Reading test fixtures and existing test logs

## What requires Codex review BEFORE operator approval

The operator should not be asked to approve these without a prior Codex review on the artifact:

- Migration plans (Codex docs-only or design review of the plan, runbook, and verification steps)
- Deployment plans (Codex docs-only or design review of the deploy plan and rollback plan)
- Live-exercise plans (Codex docs-only or design review of the live-exercise plan and rollback plan)
- High-risk implementation plans (Codex design review for any RESTRICTED or HARD BLOCK file edit)
- Approval-gate, phase-mode, next-action-selector, role-hierarchy, or automation-permissions changes (Codex docs-only review of any change to this file, `PROTECTED-FILES.md`, `AUTOPILOT-RULES.md`, `BLUEPRINT.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, or `AUTOMATION-PERMISSIONS.md`)
- Automation permission changes (Codex docs-only review of any change to Claude Code settings, MCP server install/upgrade, hook install, or slash-command install that affects automation authority)

A Codex PASS on the plan is necessary but not sufficient: the operator must still grant explicit approval before any production action runs.

## What a valid operator approval must include

For an operator approval to be honored as a gate-clearing instruction, it must specify:

- **Exact phase name** (e.g., "Phase D-5.12f", "ARC-2", "Migration 008 production application").
- **Exact files allowed** (the named paths or globs the approval covers; an approval to edit `dashboard.js` does not extend to `db.js`).
- **Exact action allowed** (edit / commit / apply / deploy / execute live / etc.).
- **Whether commit is allowed** — and if so, exactly which paths may be staged. `git add` must stage by name; never `git add -A` / `git add .`.
- **Whether production action is allowed** — code commit approval does NOT imply production deploy approval. Migration commit approval does NOT imply migration application approval. Live wiring approval does NOT imply first-live-exercise approval.
- **Whether approval expires after the phase / action** — the default is YES. Approval expires at commit (for code/doc work) or at the end of the named action (for production-side actions). Renewal requires a fresh, explicit approval.

Approvals that omit any of these elements should be treated as ambiguous; the orchestrator should ask the operator to specify the missing element rather than assume.

## What is NOT operator approval

The following are **not** operator approvals and must never be treated as such:

- **Codex PASS is not operator approval.** Codex PASS authorizes the diff Codex saw, scoped to the named files. It does not authorize HARD BLOCK file edits, production actions, or any action class flagged in the numbered gate matrix above.
- **Clean `git status` is not operator approval.** A clean working tree means nothing is currently uncommitted; it does not authorize any action.
- **Green tests are not operator approval.** Passing test suites are evidence of correctness for the tested surface, not authorization to act.
- **Claude self-approval is not operator approval.** The orchestrator (Claude) cannot grant itself approval to bypass any gate. A model's internal "this looks fine" does not satisfy any gate.
- **Ruflo or future-automation approval is not operator approval.** Any future automation layer's internal "approval" model — LLM self-approval, policy stub, signed token, scheduled-trigger event, green CI, clean tree — DOES NOT satisfy any gate.
- **Prior approval does not carry across phases.** An approval to edit `dashboard.js` for Phase D-5.12d does not extend to Phase D-5.12e. An approval to apply Migration 007 does not extend to Migration 008.
- **Approval does not widen to other files or actions.** A lift on `dashboard.js` does not extend to `bot.js`. A migration-file edit approval does not extend to migration application. A live BUY exercise approval does not extend to live CLOSE.

## Production actions require separate explicit approval from code/doc commits

For each phase that touches a production-mutating action, two distinct operator approvals are required:

1. **Commit-time approval** — to stage and commit the code/doc change.
2. **Production-action approval** — to apply the migration, deploy to Railway, or execute the first live exercise.

These approvals are not bundled. A commit-time approval never authorizes the production action. A production-action approval is granted separately, after the commit has landed and after any plan / checklist / runbook has passed Codex review.

This separation applies to:

- Migration file commit → Migration application to production (separate approvals).
- D-5.12d/e source commit → Production deploy to Railway (separate approvals).
- D-5.12d/e production deploy → First live BUY / live CLOSE exercise (separate approvals).

## In-between actions (default to ask)

When an action could plausibly fall under either column, default to asking. Examples:

- Refactoring code that touches a HARD BLOCK file even slightly
- Changing the call shape of a function used by live trading
- Adding a dependency or package
- Running scripts that write to disk (e.g., `recovery-cleanup.js`)
- Anything that requires lifting an existing HARD BLOCK
- Anything matching one of the 16 numbered gates above

## Codex PASS authority

A Codex PASS verdict authorizes the change **Codex was shown** and nothing beyond:

- It does NOT authorize additional edits not in the reviewed diff.
- It does NOT authorize re-running on a wider scope.
- It does NOT authorize acting on the same file again later without a fresh review.
- It does NOT authorize touching HARD BLOCK files even if the change seems trivial.
- It does NOT satisfy any production-action gate (migration apply, deploy, live exercise).

If Codex returns FAIL, FAIL-WITH-CONDITIONS, or REJECT, execution stops per blueprint Safety Enforcement Layer. Codex's required edits must be incorporated and re-reviewed before any commit.

## Operator override

The operator can explicitly lift any gate at any time. Phrasing such as:

- "Approved — proceed"
- "Lift HARD BLOCK on `db.js` for this phase"
- "Override Codex on this point"
- "Apply Migration 008 to production now"
- "Authorize first live BUY exercise"

…unblocks specifically the named action. Override is scoped to the action stated; it does not extend.

## Stop conditions

The orchestrator MUST halt and surface the situation to the operator if any of the following occur:

- A protected file is modified outside an active scoped lift.
- A Codex review returns FAIL, FAIL-WITH-CONDITIONS, or REJECT.
- A migration runner is about to execute against production without a separate, explicit application approval (commit approval is insufficient).
- A live Kraken call would execute outside an explicitly authorized live exercise.
- A deployment trigger appears without operator instruction.
- A destructive git operation is requested without operator instruction.
- A scoped approval appears to be widening beyond the named action / files / phase.
- Any of the 16 numbered gates would be cleared by a non-operator signal (Codex PASS, green tests, clean tree, Claude self-approval, Ruflo / future-automation signal).

On stop: report the unexpected state, do not attempt automatic recovery, and wait for operator instruction.

## Cross-references

- `orchestrator/PROTECTED-FILES.md` — per-path classification matrix (SAFE / RESTRICTED / HARD BLOCK); complementary to this file's action-class gating.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules.
- `orchestrator/BLUEPRINT.md` — architectural blueprint and Safety Enforcement Layer.
- `orchestrator/STATUS.md` — current-phase journal.
- `orchestrator/NEXT-ACTION.md` — single source of truth for the next allowed action.
- `CLAUDE.md` (repo root) — top-level role / safety / change-discipline rules.

## Change history

- **ARC-2 (2026-05-02):** Expanded with numbered approval-gate matrix (16 gates), explicit "what does NOT need operator approval" list, "Codex review before operator approval" requirements, structured "what an approval must include" form, "what is NOT operator approval" non-equivalence list, "production actions require separate approval" separation rule, refreshed stop conditions, and cross-references to `PROTECTED-FILES.md`. Pending Codex docs-only review and operator approval before commit.
- **ARC-1 (committed `95157ae`):** Cross-referenced from new `orchestrator/PROTECTED-FILES.md` as the action-class gate; left otherwise unchanged in ARC-1 itself.
- **Phase O-4 (initial):** Original five sections (auto-allowed, HARD BLOCK list, in-between, Codex PASS authority, operator override) committed in `f080b24`.
