# Phase Closeout (template)

Use this template when wrapping up a phase. Update `STATUS.md`, `CHECKLIST.md`, and `NEXT-ACTION.md` to reflect the new state.

---

## Phase {{phase}} closeout

**Checks run:**
- `node --check {{file}}` → {{PASS / FAIL}}
- `git diff -U80 -- {{file}}` → reviewed; scope matches plan
- {{any additional verification, e.g. targeted greps, syntax checks, smoke runs}}

**Files changed:**
- `{{file 1}}` — {{brief description, e.g. "3 hunks: helper hardening + 2 handler rewrites"}}
- `{{file 2}}` — {{brief description}}

**Codex verdict:** {{PASS / PASS-WITH-NOTES / FAIL-WITH-CONDITIONS / REJECT}}
- Codex agentId: `{{agentId}}`
- Round: {{N}} (final)
- Required edits incorporated: {{list specific edits or "none"}}

**Commit:**
- Hash: `{{commit hash}}`
- Message: `{{commit message}}`
- Files in commit: `{{file list — e.g. "1 file changed, X insertions(+), Y deletions(-)"}}`

**Remaining risks:**
- {{risk 1, with severity tag}}
- {{risk 2, with severity tag}}
- {{any deferred items}}

**Next phase / next action:**
- {{phase name or "Awaiting operator decision"}}
- {{action description}}
- Blocked by: {{HARD BLOCKs / approval gates / external dependencies}}

**Doc updates required:**
- [ ] `STATUS.md` updated to reflect new committed state
- [ ] `CHECKLIST.md` boxes ticked
- [ ] `NEXT-ACTION.md` rewritten for the new "now" and "after"
- [ ] Memory updated (if applicable; only for project-state-level changes)

**Post-closeout invariants verified:**
- [ ] Working tree clean except expected untracked / next-action items
- [ ] `git log` shows expected commit
- [ ] No HARD BLOCK files modified
- [ ] No unauthorized files staged

---

Append the closeout to the conversation as the operator-facing report. Keep it brief (≤200 words).
