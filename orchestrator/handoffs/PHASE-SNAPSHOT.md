# Phase Snapshot (template)

> **This packet is a mirror, not a source of authority.** The canonical sources are `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md`. If this snapshot ever conflicts with either, the canonical source wins and this packet is stale (per `orchestrator/HANDOFF-RULES.md` stop condition 3).

Generated: `<UTC timestamp>`
Source: `orchestrator/STATUS.md` + `orchestrator/NEXT-ACTION-SELECTOR.md`

## Phase

- Phase: `<e.g., N-2>`
- Mode: `<READ-ONLY AUDIT | DESIGN-ONLY | DOCS-ONLY | SAFE IMPLEMENTATION | HIGH-RISK IMPLEMENTATION | PRODUCTION ACTION>`

## Scope

- Allowed files: `<explicit list>`
- Disallowed files: `bot.js`, `dashboard.js`, `db.js`, `migrations/**`, `scripts/**`, `position.json`, deployment config, env files (plus any phase-specific additions)

## Selector context (verbatim from `orchestrator/NEXT-ACTION-SELECTOR.md`)

- Master order position: `<which step is active>`
- Current master order: `<list>`

## Constraints (per phase mode, summarized from `orchestrator/PHASE-MODES.md`)

- `<bullet list of allowed actions>`
- `<bullet list of blocked actions>`

## What this packet is NOT

- Not an approval.
- Not a phase-mode promotion.
- Not authorization to commit, apply, deploy, or run any production action.
- Not canonical over `orchestrator/NEXT-ACTION.md` / `orchestrator/NEXT-ACTION-SELECTOR.md`.
