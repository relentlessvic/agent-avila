# Autopilot Phase Candidate Proposal (template — ARC-8 Loop B output)

> **Author rule:** Autopilot DRAFTS this proposal in Loop B (Decide). The operator confirms one candidate, redirects to a different action, or rejects all candidates in-session in chat. Autopilot CANNOT self-execute the candidate. Future automation (Ruflo, Relay, successors) MAY NEVER self-execute (per `orchestrator/HANDOFF-RULES.md` future-automation rules and `orchestrator/AUTOPILOT-RULES.md` ARC-8 phase-candidate proposal mechanism).
>
> **Phase mode of THIS proposal: READ-ONLY AUDIT** (Mode 1 per `orchestrator/PHASE-MODES.md`). Generating the proposal does NOT mutate any file or state and does NOT require operator approval. Confirming a candidate (advancing into the candidate phase) requires the operator's explicit instruction and re-labels the phase to the candidate's intended mode.

Author: Autopilot (Claude orchestrator-process; DRAFT until operator confirms)
Loop: ARC-8 Loop B — Decide / propose
Generated: `<UTC timestamp>`

## Sense-state inputs (Loop A snapshot, used to generate this proposal)

- `git rev-parse HEAD`: `<full SHA>`
- Latest pushed HEAD on origin/main: `<full SHA>`
- Working-tree state: `<clean | N modified files | M untracked files>`
- Latest closed phase: `<phase-id at SHA>`
- Open phases (in-progress): `<list>`
- Pending Codex verdicts: `<list>`
- Pending operator approvals: `<list>`
- Active phase mode (per `orchestrator/STATUS.md`): `<mode>`

## Selector evaluation (per `orchestrator/NEXT-ACTION-SELECTOR.md` rules 1–10 in strict order)

| Rule | Fired? | Evidence |
|---|---|---|
| 1. Finish active closeout if source work is already completed | <yes/no> | <evidence> |
| 2. Verify repo state before new work | <yes/no> | <evidence> |
| 3. Prefer READ-ONLY AUDIT or DESIGN-ONLY before implementation | <yes/no> | <evidence> |
| 4. Prefer ARC / docs / control-layer improvements before risky trading edits | <yes/no> | <evidence> |
| 5. Require Codex review before high-risk implementation | <yes/no> | <evidence> |
| 6. Require explicit operator approval for production-action class | <yes/no> | <evidence> |
| 7. Stop if the current phase is ambiguous | <yes/no> | <evidence> |
| 8. Stop if files changed do not match the active phase mode | <yes/no> | <evidence> |
| 9. Stop if Codex returns FAIL / REJECT / required edits | <yes/no> | <evidence> |
| 10. Stop if any non-operator signal is treated as approval | <yes/no> | <evidence> |

The first-firing rule determines the candidate phase. Subsequent rules are not evaluated for the proposal; they remain in force at runtime.

## Candidate proposals (up to N=3, ranked by selector priority)

### Candidate 1 (highest priority)

- **Candidate ID:** `<id, e.g., ARC-8-RUN-A | ARC-8-DOCS-C | etc.>`
- **Candidate name:** `<one-line name>`
- **Candidate mode:** `<READ-ONLY AUDIT | DESIGN-ONLY | DOCS-ONLY | SAFE IMPLEMENTATION | HIGH-RISK IMPLEMENTATION | PRODUCTION ACTION>` (per `orchestrator/PHASE-MODES.md`)
- **First-firing rule:** `<rule N>` (per the table above)
- **Rationale:** `<one paragraph explaining why this candidate is the highest-priority next action per the first-firing rule>`
- **Scope hint:** `<file list or "TBD — DESIGN-ONLY phase will define scope">`
- **Required reviews:** `<Codex docs-only review | Codex design review | Codex implementation review | none>`
- **Required approvals:** `<commit-time approval | scoped lift on file X | RED-tier production-action approval | none>`

### Candidate 2 (second priority)

(Same fields as Candidate 1.)

### Candidate 3 (third priority — optional)

(Same fields as Candidate 1.)

## Hard exclusions (autopilot cannot propose these candidates)

Autopilot may NOT propose candidates that would:

- Activate the autopilot runtime (ARC-8-RUN-A is an exception requiring explicit operator instruction; autopilot may surface ARC-8-RUN-A as a candidate but cannot itself initiate it).
- Install schedulers, webhooks, MCP triggers, cron jobs, Discord bots, or any background automation.
- Modify any ARC-1 through ARC-8 safety-policy doc (per `orchestrator/AUTOPILOT-RULES.md` ARC-8 self-modification HARD BLOCK).
- Modify autopilot's own permission tier or phase-candidate ranking logic.
- Bypass any of `orchestrator/NEXT-ACTION-SELECTOR.md` rules 1–10.
- Promote a phase mode (e.g., DESIGN-ONLY → HIGH-RISK IMPLEMENTATION) without explicit operator instruction.
- Rewrite the master order in `orchestrator/NEXT-ACTION-SELECTOR.md`.
- Apply Migration 009+ or any future migration.
- Touch `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json`, lockfiles, `.nvmrc`, `.env*`, `position.json`, deploy config, or any HARD BLOCK / RESTRICTED file without operator-granted scoped lift.

## Append-only rule

This proposal is append-only — autopilot cannot rewrite a prior proposal. A new proposal supersedes a prior one only after operator instruction (per `orchestrator/HANDOFF-RULES.md` autopilot-packet conventions).

## Operator action

In-session in chat:

- **Confirm candidate N** — operator types "approve candidate N" or "open candidate N as the next phase".
- **Redirect** — operator specifies a different next phase / scope / mode.
- **Reject all** — operator types "reject all candidates" and specifies what to do instead.

A Discord acknowledgment / reaction / emoji DOES NOT constitute operator confirmation. Per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval".

## What this template is NOT

- Not an approval signal of any kind.
- Not authorization to advance into the candidate phase.
- Not a substitute for `orchestrator/NEXT-ACTION-SELECTOR.md`.
- Not canonical — `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` are canonical.
