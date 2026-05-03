# Next-Phase Prompt (template)

> **Author rule:** Claude DRAFTS this prompt for the next session. The operator approves before pasting it into a new chat. The prompt itself does NOT grant authority — the next session must still ask for explicit operator approval before any RED action (per `orchestrator/AUTOMATION-PERMISSIONS.md` and `orchestrator/HANDOFF-RULES.md`).

Author: Claude (DRAFT until operator approves)
Target session: next chat with Claude (or operator-routed elsewhere — VP / Director / Codex)
Generated: `<UTC timestamp>`

---

## Phase label (mandatory — must be present in the first message of the next session)

```
Phase <name> — mode: <READ-ONLY AUDIT | DESIGN-ONLY | DOCS-ONLY | SAFE IMPLEMENTATION | HIGH-RISK IMPLEMENTATION | PRODUCTION ACTION>
```

## Scope

- Allowed files: `<explicit list>`
- Disallowed files: `<explicit list — at minimum: bot.js, dashboard.js, db.js, migrations/, scripts/, position.json, deploy config, env files; plus phase-specific additions>`

## Constraints (per phase mode)

- `<bullet list>`

## Required deliverables

- `<bullet list>`

## Required reviews

- `<Codex review of … (when applicable)>`
- `<Operator approval before commit (when applicable)>`

## Self-attestation reminders for the next session

- This prompt does NOT grant authority.
- This prompt does NOT promote phase mode.
- The next session must still ask for explicit operator approval before any RED action listed in `orchestrator/AUTOMATION-PERMISSIONS.md`.
- A passing Codex review, clean tree, green tests, scheduled trigger, signed token, or LLM self-approval DOES NOT constitute approval.
- Stop on scope drift, ambiguity, or any non-operator signal being mistaken for approval.
- Do not become a trading actor.

---

## Operator approval to paste this prompt

- [ ] **APPROVED to paste this prompt verbatim into the next session.** Operator types "approved" in-session.
- Operator's verbatim in-session approval text: `<paste; left blank by Claude>`

## What this packet is NOT

- Not an approval.
- Not authorization to begin the next phase (the operator decides when to start it).
- Not canonical over `orchestrator/NEXT-ACTION.md` / `orchestrator/NEXT-ACTION-SELECTOR.md` — if the master order has changed since this prompt was drafted, the canonical source wins.
