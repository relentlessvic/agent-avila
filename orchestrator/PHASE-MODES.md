# Phase Modes

Formal phase-mode system for the Agent Avila orchestrator. Every phase must be labeled with one of the six modes below **before work starts**, and the labeled mode determines what is allowed, what is blocked, what reviews are required, what approvals are required, and what conditions must trigger an immediate stop.

This file is a safety-policy doc (per `orchestrator/PROTECTED-FILES.md`). Edits to it require Codex docs-only review **and** explicit operator approval before commit.

Last updated: 2026-05-02 (ARC-3 — docs-only; pending Codex docs-only review and operator approval before commit).

## Index

| # | Mode | Risk profile |
|---|---|---|
| 1 | READ-ONLY AUDIT | Lowest — no mutations of any kind |
| 2 | DESIGN-ONLY | Low — produces reports / design notes only |
| 3 | DOCS-ONLY | Low / medium (medium when safety-policy docs are involved) |
| 4 | SAFE IMPLEMENTATION | Medium — scoped runtime edit, no live behavior |
| 5 | HIGH-RISK IMPLEMENTATION | High — live handlers, `db.js`, migrations, risk logic, real-money behavior |
| 6 | PRODUCTION ACTION | Highest — migration apply, deploy, live Kraken, env/secret, `MANUAL_LIVE_ARMED` |

## Mode 1 — READ-ONLY AUDIT

**Definition.** Pure read-only investigation. No file is created, modified, deleted, or staged. No process mutates state.

**Allowed actions.**
- `grep`, `find`, file reads, log / journal inspection.
- `git status`, `git status --short`, `git diff`, `git diff --cached`, `git log`, `git show`.
- `node --check`, lint runs, and other read-only validators.
- Reading test fixtures and existing test logs.
- Drafting an audit report in conversation only (not in the working tree).

**Blocked actions.**
- Any file edit (Write / Edit / NotebookEdit / shell redirect / `cp` / `mv` / `rm` to a tracked path).
- Any commit, stage, or `git add`.
- Any migration application.
- Any deployment.
- Any production-state mutation.
- Any live Kraken action.
- Drafting documentation files in the working tree (use DOCS-ONLY for that).

**Required reviews.** None. Read-only investigation does not require Codex review.

**Required approvals.** None for the audit itself. If the audit reveals a need for follow-up that isn't read-only, that follow-up phase must be re-labeled and re-approved as the appropriate higher-risk mode before any further action.

**Stop conditions.**
- A tool call would mutate state.
- A file modification appears in `git status`.
- A new untracked file is created in the working tree (other than already-pre-existing untracked artifacts).
- The audit scope appears to be widening into design or implementation.

## Mode 2 — DESIGN-ONLY

**Definition.** Produces design reports, design notes, or audit reports — either in conversation or as new docs in the working tree. No runtime or source file is touched.

**Allowed actions.**
- Reading any file.
- Drafting a design report or design note as a Markdown file in the working tree (a SAFE doc, per `PROTECTED-FILES.md`).
- All actions allowed in READ-ONLY AUDIT.

**Blocked actions.**
- Editing any runtime or source file (`bot.js`, `dashboard.js`, `db.js`, `scripts/**`, `migrations/**`, `position.json`).
- Editing deploy config or env files.
- Committing any runtime change.
- Applying any migration.
- Deploying.
- Any production action.

**Required reviews.** Codex design review of the design doc itself when the design will inform a downstream HIGH-RISK IMPLEMENTATION or PRODUCTION ACTION phase. (Optional otherwise.)

**Required approvals.** Operator approval is required to advance from DESIGN-ONLY into any implementation or production phase. The DESIGN-ONLY phase itself does not require operator approval to draft the design.

**Stop conditions.**
- An edit would touch a non-doc file.
- `git diff --name-only` shows runtime / source files.
- The design appears to be auto-promoting into implementation without an explicit operator instruction.

## Mode 3 — DOCS-ONLY

**Definition.** Edits to approved documentation files only. No runtime or source file is touched.

**Allowed actions.**
- Editing approved `orchestrator/*` files (`STATUS.md`, `CHECKLIST.md`, `NEXT-ACTION.md`, `BLUEPRINT.md`, `FIX-PLAN.md`, `APPROVAL-GATES.md`, `AUTOPILOT-RULES.md`, `PROTECTED-FILES.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, `AUTOMATION-PERMISSIONS.md`, `HANDOFF-RULES.md`, `handoffs/**`, `prompts/**`).
- Editing other documentation files (root-level docs, design reports, audit reports, READMEs).
- Staging by explicit filename and committing those edits after the appropriate review.
- All actions allowed in DESIGN-ONLY and READ-ONLY AUDIT.

**Blocked actions.**
- Editing any runtime / source file (`bot.js`, `dashboard.js`, `db.js`, `scripts/**`, `migrations/**`, `position.json`).
- Editing deploy config or env files.
- `git add -A` / `git add .` (always stage by name).
- Any production action.

**Required reviews.**
- Ordinary status / report docs: Codex docs-only review recommended.
- **Safety-policy docs** (`orchestrator/PROTECTED-FILES.md`, `orchestrator/APPROVAL-GATES.md`, `orchestrator/AUTOPILOT-RULES.md`, `orchestrator/BLUEPRINT.md`, `orchestrator/PHASE-MODES.md`, `orchestrator/NEXT-ACTION-SELECTOR.md`, `orchestrator/ROLE-HIERARCHY.md`, `orchestrator/AUTOMATION-PERMISSIONS.md`, `orchestrator/HANDOFF-RULES.md`): Codex docs-only review **required** before commit.

**Required approvals.**
- Ordinary status / report docs: not required beyond in-session phase context.
- **Safety-policy docs:** explicit operator approval **required** before commit, per `PROTECTED-FILES.md` and `APPROVAL-GATES.md`.

**Stop conditions.**
- An edit would touch a runtime / source file.
- `git diff --name-only` shows non-doc files.
- A safety-policy doc commit is being attempted without Codex docs-only PASS or without explicit operator approval.

## Mode 4 — SAFE IMPLEMENTATION

**Definition.** Scoped runtime edit confined to a small, named file or tightly-scoped glob. No live trading behavior. No production mutation. No HARD BLOCK files touched.

**Allowed actions.**
- Editing the named scoped file(s) within an active operator-granted scoped lift (e.g., a single `dashboard.js` file under a per-phase lift, with no live-mode code path touched).
- Running existing test suites and reading results.
- Staging by name; committing after Codex implementation review.
- All actions allowed in lower modes.

**Blocked actions.**
- Editing files outside the scoped lift.
- Touching live trading paths (any `dashboard.js` code path executed when `paperTrading === false`).
- Touching `bot.js`, `db.js`, `migrations/**`, `position.json`, deploy config, or env files (those are HIGH-RISK IMPLEMENTATION or PRODUCTION ACTION).
- Production actions of any kind.
- `git add -A` / `git add .`.

**Required reviews.**
- Codex implementation review on the diff (always) before commit.
- Codex design review (when the change is non-trivial).

**Required approvals.**
- Operator-granted scoped lift for the named file(s) and phase.
- Operator approval to commit (the lift expires at commit; the commit approval is implicit in the lift unless stated otherwise).

**Stop conditions.**
- An edit drifts outside the scoped lift.
- Tests fail in a way that masks a behavior change.
- The scope appears to be widening (a "small" SL change becoming a SL/TP change, etc.).
- Any live-trading code path enters the diff (re-label as HIGH-RISK IMPLEMENTATION and re-seek approval).

## Mode 5 — HIGH-RISK IMPLEMENTATION

**Definition.** Edits that touch live handlers, `db.js`, `migrations/**`, risk-management logic, real-money behavior surfaces, or any HARD BLOCK file from `PROTECTED-FILES.md`.

**Allowed actions.**
- Editing the named HARD BLOCK file(s) within an active operator-granted scoped lift.
- Staging by name; committing after Codex design review **and** implementation review both PASS.
- All actions allowed in lower modes.

**Blocked actions.**
- Editing files outside the scoped lift.
- Bundling multiple HARD BLOCK files in a single phase without per-file scoped lifts.
- Running the production action that the implementation enables (that is a separate PRODUCTION ACTION phase with its own approval).
- Committing while any Codex review is FAIL / FAIL-WITH-CONDITIONS / REJECT.
- `git add -A` / `git add .`.

**Required reviews.**
- Codex design review (always) before implementation begins.
- Codex implementation review on the diff (always) before commit.

**Required approvals.**
- Operator-granted scoped lift for the named HARD BLOCK file(s) and phase.
- Operator approval to commit.
- **Production action requires SEPARATE explicit approval** after the commit lands; the commit approval does NOT authorize the production action.

**Stop conditions.**
- Scope drift.
- Codex review returns FAIL / FAIL-WITH-CONDITIONS / REJECT.
- A commit is attempted before all required Codex re-reviews have returned PASS.
- A production action is being attempted on the back of the commit-time approval alone.

## Mode 6 — PRODUCTION ACTION

**Definition.** Mutating production state. Includes migration application to the production DB, Railway deployment, live Kraken action, production DB mutation, env/secret change, or any `MANUAL_LIVE_ARMED` action.

**Allowed actions.**
- The specific operator-authorized production action and the verification queries / commands explicitly named in the authorization.
- Reading production-state outputs (logs, post-action verification queries) immediately after the authorized action.

**Blocked actions.**
- Any action beyond the specific authorized scope.
- Bundling multiple production actions in a single approval (each production action is its own gate per `APPROVAL-GATES.md`).
- Treating commit-time approval as production-action approval.
- Treating any non-operator signal (Codex PASS, green tests, clean tree, automation trigger) as approval.
- Auto-retry on failure without a fresh operator instruction.

**Required reviews.**
- A separate production-action plan / checklist / runbook must exist before Codex review or operator approval.
- Codex docs-only or design review of the production-action plan / checklist / runbook **before** operator approval.

**Required approvals.**
- Explicit, in-session operator approval, separate from any commit-time approval.
- For each production action class: a per-action approval (a Migration 008 application approval does not extend to a Migration 009 application).

**Stop conditions.**
- Any signal-mismatch (`MANUAL_LIVE_ARMED !== "true"`, missing migration prerequisite, missing deploy verification).
- Any non-operator signal being treated as approval.
- Any attempt to widen the action beyond the authorized scope.
- Any unexpected error during the action — stop and surface to operator; do not attempt automatic recovery.
- A scheduled / automated trigger firing the production action without explicit in-session operator instruction.

## Phase-labeling rule (mandatory)

**Before any work begins, Claude must label the phase with exactly one of the six modes above.**

- The label must appear in the phase's first ARC / orchestrator entry, or in the first user-visible turn of the work, before any tool call that mutates state.
- The label format is: `Phase <name> — mode: <MODE NAME>` (e.g., `Phase D-5.12f — mode: HIGH-RISK IMPLEMENTATION`).
- The label binds the phase: actions outside the labeled mode's "allowed" list are blocked until a re-label is approved by the operator.

## Ambiguous-mode rule

**If a phase could plausibly fit two or more modes, Claude must stop and ask the operator for classification.**

- The default fallback (when ambiguity persists after asking) is the **higher-risk** mode of the candidates.
- Examples:
  - A phase that edits a doc *and* a script: ambiguous between DOCS-ONLY and SAFE IMPLEMENTATION → ask; default to SAFE IMPLEMENTATION.
  - A phase that "just applies" a migration: ambiguous between PRODUCTION ACTION (the apply itself) and DOCS-ONLY (the runbook draft) → ask; default to PRODUCTION ACTION for the apply, DOCS-ONLY for the runbook.
  - A phase that adds a "small" `dashboard.js` change in a paper-mode-only path: ambiguous between SAFE IMPLEMENTATION and HIGH-RISK IMPLEMENTATION → ask; default to HIGH-RISK IMPLEMENTATION if any code path called when `paperTrading === false` is even arguably affected.
- A phase that explicitly bundles multiple modes (e.g., DOCS-ONLY + PRODUCTION ACTION) must be split into separate phases with separate labels and separate approvals.

## Automation / Ruflo rule

**Automation (Ruflo or any successor) cannot upgrade phase mode and cannot self-approve.**

- Promoting a phase from a lower-risk mode (e.g., DESIGN-ONLY) to a higher-risk mode (e.g., HIGH-RISK IMPLEMENTATION) requires explicit, in-session operator instruction. A passing Codex review, green tests, clean working tree, scheduled trigger, signed token, or any LLM-self-approval DOES NOT promote the mode.
- Automation may freely operate within a labeled mode's allowed actions, may draft proposed changes for higher modes, and may surface mode-promotion requests to the operator — but it cannot apply, commit, deploy, or execute outside the labeled mode without explicit operator instruction.
- This rule is consistent with `orchestrator/PROTECTED-FILES.md` (Ruflo / future-automation rule) and `orchestrator/APPROVAL-GATES.md` ("Ruflo or future-automation approval is not operator approval").

**ARC-8 phase-candidate proposals.** Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 section, autopilot's phase-candidate proposals are READ-ONLY AUDIT outputs (Mode 1) — they consist of consulting `orchestrator/NEXT-ACTION-SELECTOR.md` rules 1–10 and surfacing the highest-priority candidate(s) to the operator. The proposal itself does not mutate any file or state and does not require operator approval to generate. Confirming a candidate (i.e., advancing into the candidate phase) requires the operator's explicit instruction and re-labels the phase to the candidate's intended mode. Autopilot CANNOT promote phase modes; phase-mode promotion remains operator-only per the Automation / Ruflo rule above.

## Cross-references

- `orchestrator/PROTECTED-FILES.md` — per-path classification (SAFE / RESTRICTED / HARD BLOCK) referenced by every mode's allowed/blocked lists.
- `orchestrator/APPROVAL-GATES.md` — action-class gating (16 numbered gates) referenced by Modes 4 / 5 / 6 review and approval requirements.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules.
- `orchestrator/BLUEPRINT.md` — architectural blueprint and Safety Enforcement Layer.
- `orchestrator/STATUS.md` — current-phase journal; cites the labeled mode.
- `orchestrator/NEXT-ACTION.md` — single source of truth for the next allowed action.
- `CLAUDE.md` (repo root) — top-level role / safety / change-discipline rules.

## Change history

- **ARC-3 (2026-05-02):** Initial phase-mode system drafted. Six modes defined (READ-ONLY AUDIT, DESIGN-ONLY, DOCS-ONLY, SAFE IMPLEMENTATION, HIGH-RISK IMPLEMENTATION, PRODUCTION ACTION) with allowed actions, blocked actions, required reviews, required approvals, and stop conditions per mode. Phase-labeling rule, ambiguous-mode rule, and automation/Ruflo non-promotion rule established. Pending Codex docs-only review and operator approval before commit.
