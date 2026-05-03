# Claude Phase Prompt (template)

> **This packet is the prompt the operator (or ChatGPT VP) feeds INTO a Claude session at the start of a phase.** It is not authored by Claude. Per `orchestrator/HANDOFF-RULES.md`, Claude does not author the prompt that authorizes its own scope.

Author: Operator (or VP / ChatGPT, with operator approval)
Generated: `<UTC timestamp>`

## Phase label (mandatory)

```
Phase <name> — mode: <READ-ONLY AUDIT | DESIGN-ONLY | DOCS-ONLY | SAFE IMPLEMENTATION | HIGH-RISK IMPLEMENTATION | PRODUCTION ACTION>
```

## Scope

- Allowed files: `<explicit list>`
- Disallowed files: `<explicit list — at minimum: bot.js, dashboard.js, db.js, migrations/, scripts/, position.json, deploy config, env files; plus any phase-specific additions>`

## Constraints (per phase mode)

- `<bullet list>`

## Required deliverables

- `<bullet list — what the phase should produce>`

## Required reviews

- `<Codex review of … (when applicable)>`
- `<Operator approval before commit (when applicable)>`

## Stop conditions (reminders to Claude)

- Stay inside the named scope.
- Stop on scope drift, ambiguity, or any non-operator signal being mistaken for operator approval.
- Do not commit, stage, or run a production action without explicit operator approval.
- Do not promote phase mode.
- Do not become a trading actor.

## What this packet is NOT

- Not an approval.
- Not authorization to take any RED action listed in `orchestrator/AUTOMATION-PERMISSIONS.md`.
- Not a substitute for the canonical phase definition in `orchestrator/NEXT-ACTION.md` / `orchestrator/NEXT-ACTION-SELECTOR.md`.
