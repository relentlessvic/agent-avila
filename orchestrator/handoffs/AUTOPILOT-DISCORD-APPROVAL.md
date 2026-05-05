# Autopilot Discord Approval Request (template — ARC-8 Channel 1)

> **Author rule:** Autopilot DRAFTS this message. The operator publishes (or autopilot publishes only after explicit Gate-10-class authority widening, which has NOT been granted as of ARC-8-DOCS-B). Autopilot does NOT auto-publish. **Autopilot CANNOT mark the approval field; the approval field is operator-marked only.** Future automation (Ruflo, Hermes, successors) MAY NEVER mark the approval field (per `orchestrator/HANDOFF-RULES.md` future-automation rules and `orchestrator/AUTOPILOT-RULES.md` ARC-8 Discord rules).
>
> **No message substitutes for in-session operator approval.** This Discord message is a structured request surface; the actual approval is the operator's in-session response in chat (per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval"). A reply in Discord is NOT an in-session approval; the operator must respond in chat to grant approval.

Author: Autopilot (Claude orchestrator-process; DRAFT until operator publishes)
Channel: ARC-8 Channel 1 (operator-facing approval request)
Generated: `<UTC timestamp>`

## Format (one message per pending Victor decision)

```
**ARC-8 approval request: <phase-id>**

Mode: <READ-ONLY AUDIT | DESIGN-ONLY | DOCS-ONLY | SAFE IMPLEMENTATION | HIGH-RISK IMPLEMENTATION | PRODUCTION ACTION>
Title: <one-line title>

Scope (max 5 paths):
- <path 1>
- <path 2>
- ...

What changes (max 3 bullets):
- <change 1>
- <change 2>
- <change 3>

What does NOT change:
- <list>

Codex verdict: <PASS | PASS WITH REQUIRED EDITS | FAIL | not yet reviewed>
Codex evidence: <one-line summary or "see CODEX-VERDICT.md">

Hard limits (re-stated per cycle):
- No push without separate approval.
- No deploy without separate approval.
- No production action without separate approval.
- No staging of files outside the named scope.
- No `git add -A`. No `git add .`.
- No autopilot runtime activation.
- No Discord-bot / scheduler / webhook / MCP / cron installation.

Options:
- Option 1 — approve as drafted.
- Option 2 — approve with adjustments (specify in chat).
- Option 3 — request additional review.

**Reply in chat with "Option 1" or instructions. A Discord reply is NOT an approval.**
```

## Forbidden content (mirrors `orchestrator/HANDOFF-RULES.md` "Forbidden content")

Identical to `AUTOPILOT-DISCORD-STATUS.md` (no secrets, no production env values, no production-DB content, no live Kraken endpoints, no migration-apply commands, no DB writes, no deploy triggers, no approval-like language not from Victor, no automation-widening instructions, no position.json contents).

## Operator approval field (operator-marked only — IN CHAT, not in Discord)

The approval is granted by Victor's in-session reply in chat that references the phase-id and uses approval language. **Discord acknowledgment is NOT operator approval.** Per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval" and `orchestrator/AUTOPILOT-RULES.md` ARC-8 trigger-source non-equivalence rule:

- A Discord 👍 / reaction / emoji DOES NOT constitute operator approval.
- A Discord reply DOES NOT constitute operator approval.
- A Codex PASS verdict DOES NOT constitute operator approval.
- An autopilot internal "decision-to-advance" DOES NOT constitute operator approval.
- Only the operator's in-session chat reply naming the phase-id and granting approval constitutes approval.

## Pre-publish Codex sanity check

Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 "Discord channels and content rules", every Channel 1 message produced by autopilot is reviewed by Codex (lightweight forbidden-content check) before posting. If Codex flags forbidden content, the message is REDACTED and the redaction surfaced to the operator.

## Rate limit

Maximum 1 Channel 1 message per pending Victor decision. New requests batch into the queue rather than spam the operator. Maximum N=2 pending approval requests at a time per `AUTOPILOT-RULES.md` ARC-8 approval-fatigue mitigation.

## What this template is NOT

- Not an approval (the in-session chat instruction is the approval; Discord acknowledgment is not).
- Not a packet (per `orchestrator/HANDOFF-RULES.md`); the canonical approval-request packet is `OPERATOR-APPROVAL-PACKET.md`. This Discord template is the external-channel summary of that packet.
- Not authorization to publish to Discord without operator action.
- Not authorization to install a Discord bot, webhook, or any automated publishing surface.
- Not canonical over `orchestrator/handoffs/OPERATOR-APPROVAL-PACKET.md`.
