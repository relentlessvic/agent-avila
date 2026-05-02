# Continue Next Safe Step (operator → Claude prompt template)

Paste the block below to Claude when you want to advance the orchestrator one safe step.

---

Read the following files in order and act on them:

1. `orchestrator/STATUS.md` — current phase and working tree state
2. `orchestrator/CHECKLIST.md` — completed / active / future phases
3. `orchestrator/APPROVAL-GATES.md` — what is auto-allowed vs operator-approval
4. `orchestrator/NEXT-ACTION.md` — single source of truth for the next allowed action
5. `orchestrator/AUTOPILOT-RULES.md` — supervised autopilot loop and stop conditions

Continue only the next allowed safe Orchestrator action as defined in `NEXT-ACTION.md`.

Stop at any hard approval gate listed in `APPROVAL-GATES.md`.

Do not invent next actions. Do not skip Codex review. Do not touch HARD BLOCK files. Do not stage files outside the next-action's scope.

Before acting:
- Verify working tree state matches `STATUS.md`. If not, surface the discrepancy and stop.
- Verify the action does not touch a HARD BLOCK file. If it does, surface and stop.

When the action is complete:
- Run the verification commands stated in `NEXT-ACTION.md`.
- Send the diff to Codex via `orchestrator/prompts/CODEX-REVIEW.md` (if a code change).
- On Codex PASS, commit only the listed files; on Codex FAIL or FAIL-WITH-CONDITIONS, stop and report.
- Update `STATUS.md`, `CHECKLIST.md`, `NEXT-ACTION.md` per `orchestrator/prompts/PHASE-CLOSEOUT.md`.

Report:
- What you did
- Codex verdict (if applicable)
- Commit hash (if any)
- What's next
- Any blockers
