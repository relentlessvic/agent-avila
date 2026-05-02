# Autopilot Rules

Supervised autopilot loop for Claude executing Orchestrator phases.

This is **supervised autopilot, not reckless autopilot.** The operator is always in control. Claude must stop at any hard approval gate.

## Loop

1. **Read state.** Read `STATUS.md` and `NEXT-ACTION.md` to understand the current phase and the next allowed action.
2. **Confirm phase.** Cross-check `CHECKLIST.md` to confirm the active phase is consistent with the next-action declaration.
3. **Perform only the allowed action.** Do exactly what `NEXT-ACTION.md` authorizes — nothing more, nothing less.
4. **Run required checks.** Per the action type:
   - Code change → `node --check`, syntax verification, targeted greps for HARD BLOCK files
   - Doc-only change → no syntax check; visual diff review only
   - Audit → read-only operations only; no writes
5. **Send diff to Codex.** Use `orchestrator/prompts/CODEX-REVIEW.md` as the prompt template. Provide:
   - `git status --short`
   - `git diff -U80 -- <file>`
   - Syntax-check output
   - Numbered file views of changed regions
   - A focused verification checklist tied to the action's scope
6. **If Codex returns PASS, commit only approved files.** Stage by name (`git add <file1> <file2>`). Never use `git add -A` or `git add .`. Use a phase-tagged commit message.
7. **Update orchestrator docs.** Update `STATUS.md`, `CHECKLIST.md`, and `NEXT-ACTION.md` to reflect the new state. Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the closeout template.
8. **Move to next phase only if not blocked.** Re-read `APPROVAL-GATES.md` to confirm the next phase doesn't need explicit operator approval. If it does, stop and ask.
9. **Stop at hard approval gates.** Hard gates listed in `APPROVAL-GATES.md` (`bot.js`, `db.js`, `migrations/`, live trading, deployment, destructive git, etc.) require an explicit operator instruction. Never bypass.

## What this is NOT

- This is **not** unsupervised autonomy. Claude does not invent next actions.
- This is **not** authority to skip Codex review for code changes.
- This is **not** authority to commit anything not explicitly listed in `NEXT-ACTION.md`.
- This is **not** authority to touch HARD BLOCK files even if the action seems trivial.
- This is **not** authority to act on stale plan documents — verify against the working tree before acting.

## When to stop the loop and surface to the operator

- Codex returns FAIL, REJECT, or FAIL-WITH-CONDITIONS that require non-trivial design changes.
- Working tree state contradicts `STATUS.md`.
- Next-action requires touching a HARD BLOCK file.
- An unexpected file is modified or untracked.
- A test or check fails.
- Anything is unclear, ambiguous, or could be interpreted multiple ways.

## Safety invariants (always true)

- Every code commit must have Codex PASS on its diff.
- `dashboard.js` is in the Critical File Guard. Write actions require Codex PASS + scoped change.
- `bot.js`, `db.js`, `migrations/` are HARD BLOCK. Read-only inspection allowed; edits require explicit operator authorization.
- Live trading paths must remain byte-identical until Phase D-5.12.
- No JSON fallback in paper failure (Railway is ephemeral; per `dashboard.js` D-5.8 policy at lines ~423–435).
- Every commit stages files by name. No `git add -A`. No `git add .`.

## Tone

When in doubt, **ask**. An honest "I'm not sure if this is allowed" is always preferred over silent action.

## Single-line autopilot prompt

Operator can paste this when they want one safe step:

> "Read `orchestrator/STATUS.md`, `CHECKLIST.md`, `APPROVAL-GATES.md`, `NEXT-ACTION.md`, and `AUTOPILOT-RULES.md`. Continue only the next allowed safe Orchestrator action. Stop at any hard approval gate."

(Full template at `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md`.)
