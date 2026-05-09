# Commit Packet (template)

> **Author rule:** Claude DRAFTS this packet. The operator-approval field is operator-marked only; only an in-session instruction (typed in the chat) constitutes approval. Future automation (Ruflo, Relay, successors) MAY NEVER mark the approval field (per `orchestrator/HANDOFF-RULES.md` future-automation rules).
>
> **A commit packet is NOT a commit.** A commit happens only when the operator approves in-session and Claude runs `git add` (by name) followed by `git commit -m`. The packet is a description; the action is a separate, named operator instruction.

Author: Claude (DRAFT until operator approves)
Phase: `<name>` — Mode: `<mode>`
Generated: `<UTC timestamp>`

## Files to stage by name

```
<explicit list>
```

> `git add` MUST stage by explicit filename. Never `git add -A` / `git add .` (per `orchestrator/APPROVAL-GATES.md` and `orchestrator/AUTOMATION-PERMISSIONS.md`).

## Files NOT to stage

```
<explicit exclusion list — at minimum: bot.js, dashboard.js, db.js, migrations/, scripts/, position.json, deployment config, env files>
```

## Proposed commit message

```
<single line per repo convention>
```

## Codex verdict reference

- Latest entry from `CODEX-VERDICT.md`: `<PASS | PASS WITH REQUIRED EDITS | FAIL | not yet reviewed>`
- Round number: `<n>`
- Commit may proceed only when latest Codex verdict for these files is `PASS`.

## Operator approval (operator-marked only)

- [ ] **APPROVED to stage exactly the files above and commit with the message above.** Operator types "approved" in-session.
- Operator's verbatim in-session approval text: `<paste; left blank by Claude>`

## What this commit does NOT authorize

- Production migration application (separate operator approval per `orchestrator/APPROVAL-GATES.md` gate 4).
- Railway deployment (separate per gate 5).
- Live Kraken action (separate per gate 6).
- First live exercise of any newly wired live persistence path (separate explicit approval).
- Any subsequent commit (each commit is its own approval).

## What this packet is NOT

- Not a commit.
- Not an approval (the in-session instruction is the approval).
- Not authorization for any production-side action; per `APPROVAL-GATES.md` "Production actions require separate explicit approval from code/doc commits."
