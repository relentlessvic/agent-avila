# Next-Action Selector

Formal selector that determines what Agent Avila should do next. Claude **must consult this file** before proposing or starting a new phase, and must never guess.

This file is a safety-policy doc (per `orchestrator/PROTECTED-FILES.md`). Edits require Codex docs-only review **and** explicit operator approval before commit.

Last updated: 2026-05-02 (ARC-4 — docs-only; pending Codex docs-only review and operator approval before commit).

## Purpose

The selector exists because the orchestrator handles long, multi-track work where it is easy to:
- Skip a closeout and start the next phase prematurely.
- Begin implementation before audit / design / Codex review.
- Treat a passing test or Codex PASS as operator approval.
- Jump past safety-control work (the ARC track) to high-risk trading work (D-5.12*) because the trading work is more interesting.

The selector blocks all of these.

## Selector logic — strict ordering

Claude MUST evaluate these rules in order before any new phase begins. The first rule that fires determines the next allowed action; subsequent rules are not evaluated for that turn.

1. **Finish active closeout if source work is already completed.** If a phase's source commit has landed but its closeout docs (`STATUS.md` / `CHECKLIST.md` / `NEXT-ACTION.md`) have not yet been updated, the next allowed action is the closeout doc commit, NOT a new phase. The closeout phase is itself DOCS-ONLY and follows the docs-only review and approval cadence.
2. **Verify repo state before new work.** Before starting any new phase, run a READ-ONLY AUDIT (per `orchestrator/PHASE-MODES.md`) confirming: HEAD matches the expected commit, working tree is clean except for known untracked artifacts (e.g., `position.json.snap.*`), no protected file is unexpectedly modified, and the phase mode label is unambiguous.
3. **Prefer READ-ONLY AUDIT or DESIGN-ONLY before implementation.** When a new phase is being considered, the first attempt should be a READ-ONLY AUDIT or DESIGN-ONLY phase (per `orchestrator/PHASE-MODES.md`) to surface risks, define scope, and produce a Codex-reviewable design before any runtime edit.
4. **Prefer ARC / docs / control-layer improvements before risky trading edits.** When the master order has both safety-control work (ARC track, orchestrator/* docs, audit / reconciliation tooling) and high-risk trading work (D-5.12*, live handler wiring, migration application) available, the selector prefers the safety-control work first. Trading work proceeds only after the operator has explicitly cleared the gating safety-control phases.
5. **Require Codex review before high-risk implementation.** No HIGH-RISK IMPLEMENTATION or PRODUCTION ACTION phase begins before Codex has returned PASS on the relevant design and (for HIGH-RISK IMPLEMENTATION) on the implementation diff itself.
6. **Require explicit operator approval before any of these actions:**
   - Production migration application
   - Railway (or any production target) deployment
   - Live Kraken action (live order, live cancel, live balance-mutation call)
   - Production-state mutation (DB writes, file writes outside the working tree to prod paths, network calls to prod APIs, deploy triggers, scheduler triggers)
   - `bot.js` change
   - `db.js` change
   - Live `dashboard.js` handler change (any code path executed when `paperTrading === false`)
   - `position.json` write or reconciliation
   - Real-money behavior change (live order placement, live SL / TP / SELL_ALL semantics, sizing, leverage, risk caps)
   - Automation permission change (Claude Code `settings.json`, hooks, allowlist, MCP server install/upgrade, slash-command install, Ruflo install or upgrade)

   This list maps to a subset of `orchestrator/APPROVAL-GATES.md`'s 16-gate matrix (gates 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, and 16). Gate 3 (migration file edits), gate 13 (production environment or secret changes), gate 14 (`MANUAL_LIVE_ARMED` actions), and gate 15 (destructive git operations) remain governed directly by `orchestrator/APPROVAL-GATES.md`.
7. **Stop if the current phase is ambiguous.** If the next-action choice fits two or more rules, two or more phase modes (per `orchestrator/PHASE-MODES.md`), or two or more candidate phases without a clear preference, Claude must stop and ask the operator. Default fallback (per `PHASE-MODES.md`) is the higher-risk classification.
8. **Stop if files changed do not match the active phase mode.** If `git status --short` shows a file modified or untracked outside the active phase mode's allowed scope (per `orchestrator/PHASE-MODES.md` and `orchestrator/PROTECTED-FILES.md`), Claude must stop and surface the divergence to the operator. Examples: a DOCS-ONLY phase showing modified `bot.js`; a SAFE IMPLEMENTATION phase showing modified `migrations/`.
9. **Stop if Codex returns FAIL / REJECT / required edits.** A Codex verdict of FAIL, FAIL-WITH-CONDITIONS, REJECT, or PASS-WITH-REQUIRED-EDITS halts the commit and the production action that the commit enables. Required edits must be applied verbatim and the artifact must be re-reviewed by Codex before the next selector evaluation proceeds.
10. **Stop if any non-operator signal is treated as approval.** Codex PASS, clean `git status`, green tests, Claude self-approval, Ruflo / future-automation approval, scheduled trigger, signed token, and LLM self-approval are NOT operator approvals (per `orchestrator/APPROVAL-GATES.md` and `orchestrator/PROTECTED-FILES.md`). If any of these appear to be clearing a gate that requires explicit operator approval, Claude must stop.

## Current selector output — master order (as of 2026-05-02 / HEAD `9b5093f`)

The selector evaluates the current state and produces this ordered roadmap. Phases must be executed in order; jumping ahead is forbidden unless the operator explicitly changes the master order.

| # | Phase | Mode | Gating |
|---|---|---|---|
| 1 | **ARC-4 — Next-Action Selector** (this phase, in progress) | DOCS-ONLY | New safety-policy doc; Codex docs-only review + explicit operator approval |
| 2 | **ARC-5 — Claude / Codex / operator prompt templates** | DOCS-ONLY | Prompt-template doc; Codex docs-only review + explicit operator approval |
| 3 | **ARC-6 — Automation permission rules** | DOCS-ONLY | Automation-permission policy doc; Codex docs-only review + explicit operator approval |
| 4 | **N-1 — Repo confirmation** | READ-ONLY AUDIT | No edits; verifies state of repo, migrations, JSON cache, and orchestrator docs |
| 5 | **N-2 — Migration 008 production-application planning** | DESIGN-ONLY | Plan / checklist / runbook drafted as a design report; Codex docs-only or design review required before operator approval (per `PHASE-MODES.md` PRODUCTION ACTION precondition) |
| 6 | **N-3 — Migration 008 production application** | PRODUCTION ACTION | Runs only after N-2 has Codex-reviewed plan + explicit operator authorization for the application; commit-time approval is NOT sufficient (per `APPROVAL-GATES.md` gate 4) |
| 7 | **N-4 — D-5.12f live SELL_ALL design-only review** | DESIGN-ONLY | Mirror of B.1 close-source cleanup for the SELL_ALL surface; Codex design review required before any code phase |

## Hard ordering rule — no jumping to D-5.12f

D-5.12f (live SELL_ALL) is a HIGH-RISK IMPLEMENTATION phase that touches live trading behavior. It cannot start until **ARC-4, ARC-5, and ARC-6 are all closed**, the orchestrator's safety-control surface is fully landed, and the gated N-1 / N-2 / N-3 production-application track is at least scoped (N-2 + N-3 may run in parallel with later D-5.12* sub-phases per the operator's choice, but D-5.12f code work cannot precede the ARC-4 → ARC-6 closure).

The operator may explicitly change the master order at any time by issuing an in-session instruction. Without such an instruction, the order above is binding.

## Operator override

The operator can override the selector by explicitly stating a new master order, e.g.:

- "Skip ARC-5 / ARC-6 for now; advance to N-1 next."
- "Run N-2 in parallel with ARC-5."
- "Defer D-5.12f indefinitely; start O-5 instead."

An override must specify: which phase(s) move, what their new mode label is, and any new approval requirements. Override is scoped to the new order stated; it does not extend.

A passing Codex review, green tests, clean working tree, scheduled trigger, signed token, or LLM self-approval DO NOT constitute an operator override.

## Stop conditions (consolidated)

Claude must halt and surface to the operator if any of the following occur during selector evaluation or while a phase is in progress:

- The active phase's source commit has landed but its closeout docs are not committed yet, and a new phase is being attempted (rule 1 violation).
- A new phase is being attempted before a READ-ONLY AUDIT confirms repo state (rule 2 violation).
- An implementation phase is being attempted before a corresponding DESIGN-ONLY phase has produced a Codex-reviewed design (rule 3 violation, where applicable).
- A trading-track phase (D-5.12*) is being attempted before the gating ARC-4 / ARC-5 / ARC-6 phases are closed (rule 4 violation).
- A HIGH-RISK IMPLEMENTATION or PRODUCTION ACTION phase is being attempted without Codex PASS on the relevant artifact (rule 5 violation).
- An action from the rule-6 list is being attempted without explicit operator approval (rule 6 violation).
- The phase mode is ambiguous, conflicting, or missing (rule 7 violation).
- Files changed in the working tree do not match the active phase mode's allowed scope (rule 8 violation).
- Codex returns FAIL / FAIL-WITH-CONDITIONS / REJECT / PASS-WITH-REQUIRED-EDITS and a commit or production action is being attempted (rule 9 violation).
- A non-operator signal is being treated as operator approval (rule 10 violation).

On stop: report the unexpected state, do not attempt automatic recovery, and wait for operator instruction.

## Cross-references

- `orchestrator/PHASE-MODES.md` — six phase modes; mode labels referenced in the master-order table.
- `orchestrator/APPROVAL-GATES.md` — 16-gate action-class matrix; rule 6 enumerates a subset directly.
- `orchestrator/PROTECTED-FILES.md` — per-path SAFE / RESTRICTED / HARD BLOCK matrix; rule 8 referenced.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules.
- `orchestrator/BLUEPRINT.md` — architectural blueprint.
- `orchestrator/STATUS.md` — current-phase journal; selector consults this for "what's already done".
- `orchestrator/NEXT-ACTION.md` — single source of truth for the next allowed action; selector populates this.
- `CLAUDE.md` (repo root) — top-level role / safety / change-discipline rules.

## Change history

- **ARC-4 (2026-05-02):** Initial Next-Action Selector drafted. Ten ordered selector rules established. Master order through D-5.12f populated (ARC-4 → ARC-5 → ARC-6 → N-1 → N-2 → N-3 → N-4). Hard rule preventing trading-track jumps before ARC-4 → ARC-6 closure. Pending Codex docs-only review and explicit operator approval before commit.
