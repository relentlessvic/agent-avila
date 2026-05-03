# Operator Approval Packet (template)

> **Author rule:** Claude DRAFTS this packet as a request to the operator. Claude does NOT mark the operator-approval field; only the operator may mark it, and only by an in-session instruction (typed in the chat). Future automation (Ruflo, Hermes, successors) MAY NEVER mark this field (per `orchestrator/HANDOFF-RULES.md` future-automation rules).
>
> **No packet substitutes for in-session operator approval.** This packet is a structured request; the actual approval is the operator's in-session response (per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval").

Author: Claude (DRAFT) — operator marks approval field in-session
Phase: `<name>` — Mode: `<mode>`
Generated: `<UTC timestamp>`

## What I am asking the operator to approve

`<exact action — e.g., "commit the four ARC-X paths", "apply Migration 008 to production", "execute first live BUY exercise">`

## Why approval is required

- Gate citation: `<e.g., APPROVAL-GATES.md gate 4 (production migration application), gate 1 (bot.js change), etc.>`
- Phase mode: `<DOCS-ONLY | SAFE IMPLEMENTATION | HIGH-RISK IMPLEMENTATION | PRODUCTION ACTION>`
- Tier (per `AUTOMATION-PERMISSIONS.md`): `<YELLOW | RED>`

## What approval would authorize

- Exact files to be staged: `<list — staged by name only, never `git add -A`>`
- Exact action: `<edit / commit / apply / deploy / execute live / etc.>`
- Exact scope: `<phase name + mode + named files>`
- Approval expires at: `<commit | end of phase | named action complete>`

## What approval would NOT authorize

- `<explicit list — e.g., "this approval does NOT authorize Migration 008 application; that requires a separate N-3 approval per gate 4">`
- `<other actions explicitly excluded>`

## Codex verdict (if applicable)

- Latest entry from `CODEX-VERDICT.md`: `<PASS | PASS WITH REQUIRED EDITS | FAIL | not yet reviewed>`
- Round number: `<n>`

## Operator approval field (operator-marked only)

- [ ] **APPROVED** — operator types "approved" in-session and (optionally) marks this checkbox.
- [ ] **REJECTED** — operator types "rejected" or specifies required changes in-session.
- Operator's verbatim in-session approval/rejection text: `<paste from chat after operator responds; left blank by Claude>`

## What this packet is NOT

- Not an approval (the in-session instruction is the approval).
- Not a commit (a commit is a separate explicit operator instruction).
- Not authorization to advance until the operator's in-session response is received.
