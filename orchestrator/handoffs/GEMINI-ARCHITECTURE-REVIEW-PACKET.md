# Gemini Architecture Review Packet (template)

> **Author rule:** This packet is written by the operator, who pastes Gemini's verbatim response into the body. Claude does NOT synthesize Gemini output. Future automation (Ruflo, Hermes, successors) MAY NEVER write to this file (per `orchestrator/HANDOFF-RULES.md` future-automation rules).
>
> **Advisory only.** Gemini's review is advisory. It does NOT gate Codex review and is NOT operator approval (per `orchestrator/ROLE-HIERARCHY.md` Director role).

Author: Operator (transcribing Gemini's response)
Phase: `<name>` — Mode: `<mode>`
Generated: `<UTC timestamp>`

## Artifact reviewed

`<paths or design-report reference>`

## Gemini's verbatim response

```
<paste>
```

## Operator interpretation (one or two sentences)

`<what the operator takes from it; advisory only>`

## Effect on phase

- This review is advisory only.
- It does NOT gate Codex review.
- It does NOT constitute operator approval.
- If Gemini surfaces a safety concern that Codex missed, route it through a fresh `CODEX-REVIEW-PACKET.md` — do not act on it from this packet alone.

## What this packet is NOT

- Not an approval.
- Not a Codex verdict.
- Not authorization to commit, apply, deploy, or execute any RED action.
- Not canonical over `orchestrator/NEXT-ACTION.md` / `orchestrator/NEXT-ACTION-SELECTOR.md`.
