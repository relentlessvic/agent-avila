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

## Autopilot-fillable fields (ARC-8)

When the autopilot system (per `orchestrator/AUTOPILOT-RULES.md` ARC-8) DRAFTS this packet at the end of Loop D (Approve→Execute→Report), it populates the following autopilot-specific fields in addition to the fields above. Operator-driven (manual) closeouts may omit these fields.

- **Autopilot phase ID:** `<phase-id>`
- **Autopilot loop completed:** `<A | B | C | D | all four>`
- **Codex verdicts received during phase (round count):** `<n>`
- **Codex auto-triggers fired during phase:** `<list of criteria from AUTOPILOT-RULES.md ARC-8 "Codex auto-trigger criteria">`
- **Approval requests issued during phase:** `<n>` (cross-reference to `OPERATOR-APPROVAL-PACKET.md` instances)
- **Operator approvals received during phase:** `<list of in-session approval instructions, with timestamps>`
- **Commits landed during phase (staged-by-name):** `<list of commit SHAs and file lists>`
- **Pushes completed during phase:** `<list of pushes with three-way SHA consistency confirmation>`
- **Halt conditions encountered (if any):** `<list, with reference to AUTOPILOT-HALT.md instances>`
- **Phase-loop ceiling counter status at close:** `<n of 3>` (per `AUTOPILOT-RULES.md` ARC-8 phase-loop ceiling)
- **Approval-fatigue queue at close:** `<n of N=2 pending>`
- **Discord drafts produced during phase (Channels 1 + 2):** `<count, references to AUTOPILOT-DISCORD-* drafts; whether operator-published or not>`

### Loop B next-action proposal (cross-reference to `AUTOPILOT-PHASE-CANDIDATE.md`)

Autopilot's Loop B output for the next-action proposal:

- Candidate 1: `<id, mode, rule-fired>`
- Candidate 2: `<id, mode, rule-fired>` (optional)
- Candidate 3: `<id, mode, rule-fired>` (optional)
- The operator confirms one candidate or redirects in-session in chat. Autopilot CANNOT self-execute the candidate.

## What this packet is NOT

- Not a commit.
- Not an approval (the in-session instruction is the approval).
- Not authorization for the next phase to begin; the operator decides when to start the next phase.
- Not canonical over `orchestrator/NEXT-ACTION.md` / `orchestrator/NEXT-ACTION-SELECTOR.md`.
- Not authorization for autopilot to advance through the next-action proposal without operator confirmation in-session in chat.
- Not authorization to auto-publish any Discord summary; autopilot drafts only.
