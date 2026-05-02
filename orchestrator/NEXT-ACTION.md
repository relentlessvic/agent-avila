# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now (this turn or the next safe step)

**Commit O-4 orchestrator docs separately from `dashboard.js`.**

Specifically:
1. Stage by name only:
   ```
   git add \
     orchestrator/STATUS.md \
     orchestrator/CHECKLIST.md \
     orchestrator/APPROVAL-GATES.md \
     orchestrator/NEXT-ACTION.md \
     orchestrator/AUTOPILOT-RULES.md \
     orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md \
     orchestrator/prompts/CODEX-REVIEW.md \
     orchestrator/prompts/PHASE-CLOSEOUT.md
   ```
2. Commit with a phase-tagged message, e.g.:
   ```
   Phase O-4: orchestrator automation layer (status, checklist, gates, autopilot, prompts)
   ```
3. Do **NOT** stage `dashboard.js`. It carries uncommitted Phase B.1 implementation.
4. Do **NOT** stage `position.json.snap.20260502T020154Z`. It is a drift forensics snapshot.

## After O-4 docs are committed

**Send Phase B.1 `dashboard.js` diff to Codex for implementation review.**

- Use the prompt template at `orchestrator/prompts/CODEX-REVIEW.md`.
- Include in the prompt:
  - `git status --short`
  - `node --check dashboard.js` result
  - `git diff -U80 -- dashboard.js`
  - Numbered file views of the helper region (around lines 390–460) and handler region (around lines 1340–1460)
- Ask Codex for final B.1 implementation verdict: PASS / FAIL / FAIL-WITH-CONDITIONS.
- Do **NOT** commit `dashboard.js` until Codex returns PASS.

## After Codex PASS for B.1

Stage and commit `dashboard.js` only:
```
git add dashboard.js
git commit -m "Phase B.1: paper close-source cleanup (CLOSE_POSITION + SELL_ALL DB-canonical)"
```

Then update:
- `orchestrator/STATUS.md` — move B.1 to "closed, committed `<hash>`"
- `orchestrator/CHECKLIST.md` — mark B.1 boxes complete
- `orchestrator/NEXT-ACTION.md` — set the next action

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase B.2 (paper SL/TP DB-first) | Operator lifts `db.js` HARD BLOCK + `migrations/` HARD BLOCK + new schema migration approved |
| Live mode write-path changes | Phase D-5.12 (live persistence gate lift) |
| Editing `bot.js` / `db.js` / `migrations/` | Explicit operator instruction |
| Touching Kraken execution / SL / TP / BE / trailing logic | Explicit operator instruction |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |

## Working tree truth

- `dashboard.js` is **modified, uncommitted**. Contains Phase B.1 implementation. Has not yet been Codex-implementation-reviewed.
- `dashboard.js` must NOT be committed until Codex returns PASS on the B.1 diff.
- `position.json.snap.20260502T020154Z` is untracked. Not for commit.
- `orchestrator/*` (this directory) holds the only files on the safe-list for the immediate next commit.
