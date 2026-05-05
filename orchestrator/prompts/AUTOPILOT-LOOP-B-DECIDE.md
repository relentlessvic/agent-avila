# Autopilot Loop B — Decide / Propose (prompt template)

> **This is a documentation prompt template. It does NOT execute. It describes WHAT autopilot should do during Loop B, not a script that DOES it.**
>
> Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 four-loop architecture, Loop B is GREEN tier — proposal-only. Loop B does not mutate any file or state. Loop B CANNOT self-execute. Loop B output is a phase-candidate proposal surfaced to the operator.

## When Loop B runs

- After every Loop A snapshot completes successfully (no stop-conditions fired).
- On operator instruction to "propose next action" or equivalent.
- After any halt-and-resume event, after Loop A resync confirms consistency.

## What Loop B does

Generate up to N=3 phase-candidate proposals ranked by `orchestrator/NEXT-ACTION-SELECTOR.md` rules 1–10 in strict order. Surface them to the operator via the `AUTOPILOT-PHASE-CANDIDATE.md` template. Loop B does NOT advance into any candidate phase.

### Selector evaluation (strict order)

Evaluate `orchestrator/NEXT-ACTION-SELECTOR.md` rules 1–10 in order. The first-firing rule determines the candidate phase. Subsequent rules are not evaluated for the proposal but remain in force at runtime.

1. **Finish active closeout if source work is already completed.**
2. **Verify repo state before new work.**
3. **Prefer READ-ONLY AUDIT or DESIGN-ONLY before implementation.**
4. **Prefer ARC / docs / control-layer improvements before risky trading edits.**
5. **Require Codex review before high-risk implementation.**
6. **Require explicit operator approval for production-action class.**
7. **Stop if the current phase is ambiguous.**
8. **Stop if files changed do not match the active phase mode.**
9. **Stop if Codex returns FAIL / REJECT / required edits.**
10. **Stop if any non-operator signal is treated as approval.**

### Candidate ranking

Up to N=3 candidates. Each candidate has:

- Candidate ID (e.g., `ARC-8-RUN-A`, `ARC-8-DOCS-C`, `O-X.Y`, etc.).
- Candidate name (one-line title).
- Candidate mode (per `orchestrator/PHASE-MODES.md`: READ-ONLY AUDIT / DESIGN-ONLY / DOCS-ONLY / SAFE IMPLEMENTATION / HIGH-RISK IMPLEMENTATION / PRODUCTION ACTION).
- First-firing rule (one of rules 1–10).
- Rationale (one paragraph tying the candidate to the first-firing rule).
- Scope hint (file list or "TBD — DESIGN-ONLY phase will define scope").
- Required reviews and approvals.

### Hard exclusions (autopilot cannot propose)

Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 phase-candidate proposal mechanism, autopilot may NOT propose candidates that would:

- Activate the autopilot runtime without explicit operator instruction.
- Install schedulers, webhooks, MCP triggers, cron jobs, Discord bots, or any background automation.
- Modify any ARC-1 through ARC-8 safety-policy doc (per `AUTOPILOT-RULES.md` ARC-8 self-modification HARD BLOCK).
- Modify autopilot's own permission tier or phase-candidate ranking logic.
- Bypass any of `NEXT-ACTION-SELECTOR.md` rules 1–10.
- Promote a phase mode without explicit operator instruction.
- Rewrite the master order in `NEXT-ACTION-SELECTOR.md`.
- Apply Migration 009+ or any future migration.
- Touch HARD BLOCK / RESTRICTED files without operator-granted scoped lift.

### Output

Use `orchestrator/handoffs/AUTOPILOT-PHASE-CANDIDATE.md` as the output format. Surface the proposal to the operator in-session in chat. Optionally surface a Channel 2 Discord status message ("ARC-8: <phase-id> Loop B proposal generated") drafted from `AUTOPILOT-DISCORD-STATUS.md` (NOT auto-published).

## Operator action

In-session in chat:

- **Confirm candidate N** — operator types "approve candidate N" or "open candidate N as the next phase".
- **Redirect** — operator specifies a different next phase / scope / mode.
- **Reject all** — operator types "reject all candidates" and specifies what to do instead.

A Discord acknowledgment / reaction / emoji DOES NOT constitute operator confirmation. Per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval".

## Constraints (re-stated for Loop B)

- Proposal-only. No file edit. No staging. No commit. No push. No deploy. No DB query. No Railway command. No Kraken action. No env access.
- Do not self-execute. Loop B proposes; Loop C drafts only after operator confirms.
- Do not advance the master order. Master-order changes are operator-only per `APPROVAL-GATES.md`.
- Do not promote phase modes. Per `PHASE-MODES.md` automation non-promotion rule.
- Do not bypass any of `NEXT-ACTION-SELECTOR.md` rules 1–10.
- HALT immediately on any of the supervised-autopilot stop conditions or ARC-8 stop conditions.

## What Loop B is NOT

- Not Loop A (which senses state).
- Not Loop C (which drafts).
- Not Loop D (which seeks approval and executes).
- Not authorization to advance any phase.
- Not a substitute for `orchestrator/NEXT-ACTION-SELECTOR.md`.
- Not authorization to install schedulers / webhooks / MCP / cron / Discord-bots; all such candidates are HARD-EXCLUDED from Loop B output.
