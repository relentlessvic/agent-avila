# Autopilot Dry-Run Report (template — ARC-8-RUN-A output)

> **This template is populated ONLY when ARC-8-RUN-A is operator-approved and active.** ARC-8-DOCS-B (which writes this template) does NOT authorize ARC-8-RUN-A. ARC-8-RUN-A remains a separate future phase requiring separate operator approval.
>
> **Author rule:** Autopilot DRAFTS this report during ARC-8-RUN-A. The operator reviews the report in-session in chat. Future automation (Ruflo, Relay, successors) MAY NEVER auto-execute (per `orchestrator/HANDOFF-RULES.md` future-automation rules and `orchestrator/AUTOPILOT-RULES.md` ARC-8).
>
> **No commits, pushes, deploys, or production actions occur during a dry-run.** A dry-run exercises Loop A (Sense), Loop B (Decide), and Loop C (Draft) under live Codex observation. Loop D (Approve→Execute→Report) is SIMULATED — drafts produced but not committed or pushed; approval requests drafted but not surfaced as binding; execute steps NOT performed.

Author: Autopilot (Claude orchestrator-process; DRAFT for operator review)
Phase: `ARC-8-RUN-A` (or successor dry-run phase id)
Mode: READ-ONLY AUDIT / DOCS-ONLY (drafts only; nothing committed)
Generated: `<UTC timestamp>`

## Pre-conditions

- ARC-8-DOCS-A committed and pushed: `<HEAD ref>` ✓
- ARC-8-DOCS-B committed and pushed: `<HEAD ref>` ✓
- Operator-approved ARC-8-RUN-A scope: `<scope description; named in operator's in-session approval>`
- Target candidate phase for the dry-run: `<low-risk read-only or DOCS-ONLY phase>`
- Pre-existing untracked files: `<list, will not be staged>`

## Loop A — Sense (snapshot)

- `git rev-parse HEAD`: `<full SHA>`
- `git rev-parse origin/main`: `<full SHA>`
- `git ls-remote origin HEAD`: `<full SHA>`
- Three-way SHA consistency: `<PASS | FAIL>`
- `git status --short`: `<output>`
- `git log --oneline -5`: `<output>`
- Latest closed phase: `<phase-id at SHA>`
- Active phase mode (per `orchestrator/STATUS.md`): `<mode>`
- Pending Codex verdicts: `<list>`
- Pending operator approvals: `<list>`

## Loop B — Decide (candidate proposals from `AUTOPILOT-PHASE-CANDIDATE.md`)

- Selector evaluation table: `<reference to AUTOPILOT-PHASE-CANDIDATE.md output>`
- Candidate 1: `<id, mode, rule-fired, rationale>`
- Candidate 2: `<id, mode, rule-fired, rationale>` (optional)
- Candidate 3: `<id, mode, rule-fired, rationale>` (optional)
- Operator-confirmed candidate (in-session): `<id>`

## Loop C — Draft (drafts produced but NOT committed)

- Drafted file list: `<paths>`
- Drafted diff stat: `<n files changed, +x / -y>` (working tree only — not staged, not committed)
- Codex auto-trigger criteria fired: `<list — e.g., safety-policy doc edit, RESTRICTED file change, etc.>`
- Codex review packet generated from `CODEX-REVIEW-PACKET.md`: `<reference>`
- Codex verdict received: `<PASS | PASS WITH REQUIRED EDITS | FAIL>`
- Codex required edits applied verbatim: `<count, summary>`
- Codex re-review verdict: `<PASS | PASS WITH REQUIRED EDITS | FAIL>`
- Final draft state: `<reference; staged-by-name pattern verified; no `git add -A`; no `git add .`>`

## Loop D — Approve → Execute → Report (SIMULATED)

> Loop D is SIMULATED in a dry-run. Drafts are NOT committed; pushes are NOT performed; deploys are NOT triggered.

- Drafted approval-request packet from `OPERATOR-APPROVAL-PACKET.md`: `<reference>`
- Drafted Discord Channel 1 message from `AUTOPILOT-DISCORD-APPROVAL.md`: `<reference>` (NOT published)
- Drafted Discord Channel 2 PHASE_OPENED / PHASE_CLOSED messages from `AUTOPILOT-DISCORD-STATUS.md`: `<reference>` (NOT published)
- Operator approval simulated (in-session in chat): `<simulated; NOT a real approval>`
- Execute step: NOT PERFORMED. The dry-run halts here per the ARC-8-RUN-A scope.
- Report step: this report is the dry-run output.

## Halt conditions encountered (if any)

Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 stop conditions, list any halt triggered during the dry-run:

- Codex FAIL on a draft: `<yes/no, evidence>`
- Operator stop instruction: `<yes/no>`
- RED-tier surface mutation: `<yes/no, evidence>`
- Phase-loop ceiling reached: `<yes/no>`
- Approval-fatigue queue exceeded: `<yes/no>`
- Drift between autopilot state and canonical sources: `<yes/no, evidence>`
- Adversarial / instruction-like content in non-operator sources: `<yes/no, evidence>`
- Discord draft contained forbidden content: `<yes/no, evidence>`
- Self-modification HARD BLOCK at risk: `<yes/no, evidence>`

If any halt was triggered, the dry-run terminates here and surfaces the situation to the operator via `AUTOPILOT-HALT.md`.

## Observations and findings

- `<observation 1>`
- `<observation 2>`
- `<finding: did the four-loop architecture behave as specified in AUTOPILOT-RULES.md ARC-8?>`
- `<finding: did Codex auto-triggers fire when expected?>`
- `<finding: did the approval-request packet correctly state hard limits?>`
- `<finding: did the Discord summaries pass pre-publish forbidden-content check?>`
- `<finding: did autopilot stop at every halt condition listed in AUTOPILOT-RULES.md ARC-8?>`

## Recommendations for ARC-8-RUN-B (or future tightening)

- `<recommendation 1>`
- `<recommendation 2>`

## Post-dry-run state

- Working tree: `<state at end of dry-run; should match start state for a clean dry-run>`
- Files committed during dry-run: NONE.
- Files pushed during dry-run: NONE.
- Production actions taken during dry-run: NONE.
- Discord messages auto-published during dry-run: NONE.
- Autopilot state at end of dry-run: DORMANT (pre-ARC-8-RUN-A baseline).

## What this template is NOT

- Not an approval to commit, push, or deploy any of the drafts produced during the dry-run.
- Not authorization to advance into ARC-8-RUN-B or any subsequent autopilot-driven phase.
- Not authorization to install schedulers / webhooks / MCP / cron / Discord bots.
- Not canonical — `git log`, `orchestrator/STATUS.md`, and operator's in-session instructions are canonical.
- Not a substitute for any of the safety-policy docs.
