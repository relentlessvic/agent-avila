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

## Autopilot-fillable fields (ARC-8)

When the autopilot system (per `orchestrator/AUTOPILOT-RULES.md` ARC-8) DRAFTS this packet in Loop D (Approve→Execute→Report), it populates the following autopilot-specific fields in addition to the fields above. Operator-driven (manual) approval requests may omit these fields.

- **Autopilot loop:** `<D — Approve→Execute→Report>`
- **Phase candidate first-firing rule:** `<rule N from NEXT-ACTION-SELECTOR.md rules 1-10>` (cross-reference to `AUTOPILOT-PHASE-CANDIDATE.md` Loop B output)
- **Codex auto-trigger fired:** `<criterion>` (per `AUTOPILOT-RULES.md` ARC-8 "Codex auto-trigger criteria")
- **Pending approval queue position:** `<n of N=2>` (per `AUTOPILOT-RULES.md` ARC-8 approval-fatigue mitigation; max N=2 pending requests at a time)
- **Phase-loop ceiling counter:** `<n of 3>` (per `AUTOPILOT-RULES.md` ARC-8 phase-loop ceiling; max 3 sequential autopilot-driven phases without operator-initiated direction change)
- **Discord draft (Channel 1):** `<reference to AUTOPILOT-DISCORD-APPROVAL.md if applicable; pre-publish Codex sanity-checked; NOT auto-published>`

### Hard limits restated per cycle (mandatory in every autopilot-drafted approval request)

Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 approval-fatigue mitigation, autopilot MUST restate these hard limits in every approval request — autopilot must NOT abbreviate them across cycles:

- No push without separate approval.
- No deploy without separate approval.
- No production action without separate approval.
- No staging of files outside the named scope.
- No `git add -A`. No `git add .`.
- No autopilot runtime activation (autopilot remains DORMANT post-this-approval unless operator explicitly says otherwise).
- No scheduler / webhook / MCP / cron / Discord-bot installation.
- No safety-policy doc commit unless explicitly named in the approval scope.
- No HARD BLOCK or RESTRICTED file edit unless explicitly named in a scoped lift.

### Autopilot CANNOT mark the approval field

Per `orchestrator/HANDOFF-RULES.md` "Per-packet authorship and approval rules" and `orchestrator/AUTOPILOT-RULES.md` ARC-8 "Operator approval-request packet rules":

- Autopilot CANNOT mark the operator-approval field.
- Autopilot's own scheduling, internal tick, Loop A re-entry, or any internal "decision-to-advance" signal DOES NOT constitute operator approval.
- A Codex PASS verdict DOES NOT constitute operator approval.
- A Discord 👍 / reaction / emoji / reply DOES NOT constitute operator approval.
- Only Victor's in-session chat reply that names the phase-id and uses approval language constitutes approval.

## What this packet is NOT

- Not an approval (the in-session instruction is the approval).
- Not a commit (a commit is a separate explicit operator instruction).
- Not authorization to advance until the operator's in-session response is received.
- Not authorization for autopilot to auto-publish the corresponding Discord Channel 1 message; autopilot drafts only.
- Not authorization to widen autopilot authority, lower a tier, remove a HARD BLOCK, or modify a safety-policy doc unless explicitly named in the approval scope.
