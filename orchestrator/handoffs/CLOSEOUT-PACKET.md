# Closeout Packet (template)

> **Author rule:** Claude DRAFTS this packet (the proposed status-doc updates). The operator approves the closeout in-session before any commit. Future automation (Ruflo, Hermes, successors) MAY NEVER mark the approval field (per `orchestrator/HANDOFF-RULES.md` future-automation rules).

Author: Claude (DRAFT until operator approves)
Phase: `<name>` — Mode: `<mode>`
Generated: `<UTC timestamp>`

## Status updates to apply

### `orchestrator/STATUS.md`

```markdown
<draft text — replacement for the active-phase block>
```

### `orchestrator/CHECKLIST.md`

```markdown
<draft text — phase marked CLOSED with commit hash; sub-checklist updated; new in-progress block for the next phase if applicable>
```

### `orchestrator/NEXT-ACTION.md`

```markdown
<draft text — "Right now" preface + "Current allowed next action" pointer retargeted to the next phase>
```

## Selector advance

- Old position: `<step>`
- New position: `<step>`
- Master order (verbatim from `orchestrator/NEXT-ACTION-SELECTOR.md`): `<list>`
- D-5.12f hard-block status: `<still hard-blocked / unblocked by operator master-order change>`

## Operator approval (operator-marked only)

- [ ] **APPROVED to commit the status-doc updates above.** Operator types "approved" in-session.
- Operator's verbatim in-session approval text: `<paste; left blank by Claude>`

## Constraints

- This closeout does NOT modify any safety-policy doc beyond the three status journals (`STATUS.md`, `CHECKLIST.md`, `NEXT-ACTION.md`) unless the closeout is itself a safety-policy phase (e.g., an ARC closeout that includes the relevant safety-policy doc edits — those would be a separate phase, not this closeout).
- This closeout does NOT trigger any production action.
- This closeout does NOT advance the selector beyond the natural step in the master order; advancing past the natural step requires an explicit master-order change (RED-tier).

## What this packet is NOT

- Not a commit.
- Not an approval (the in-session instruction is the approval).
- Not authorization for the next phase to begin; the operator decides when to start the next phase.
- Not canonical over `orchestrator/NEXT-ACTION.md` / `orchestrator/NEXT-ACTION-SELECTOR.md`.
