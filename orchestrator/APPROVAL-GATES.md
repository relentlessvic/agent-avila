# Approval Gates

Defines what Claude may do automatically and what requires explicit operator approval. This file is the canonical safety gate for the orchestrator's supervised autopilot loop.

## Auto-allowed after Codex PASS

These actions can proceed without re-asking the operator, **provided Codex has returned a PASS verdict on the relevant diff** and the action stays inside the scope Codex reviewed:

- Documentation updates (`orchestrator/*`, comments in code, README)
- Read-only audits (`grep`, `find`, file reads, log inspections, `git log` / `git diff`)
- Dashboard UI-only cleanup (CSS, render-only logic, label text — no state-mutation paths)
- Non-live paper dashboard fixes (paper-mode persistence, paper-mode UI labels)
- Running existing test suites and reading test results
- Syntax checks (`node --check`, lint)
- Diff review (`git diff`, `git status`)
- Commits **for the specific files Codex reviewed and approved** (stage by name, never `git add -A`)

## Requires explicit operator approval (HARD BLOCK)

These actions must NOT be taken without an explicit, in-session operator instruction. Codex PASS alone does **not** authorize these:

- Editing `bot.js`
- Editing `db.js`
- Editing `migrations/`
- Editing or invoking Kraken execution paths
- Editing live trading logic (any code path that runs when `paperTrading === false`)
- Editing stop loss, take profit, breakeven, trailing stop, or position management logic
- Live persistence migration (Phase D-5.12 and related)
- Deployment (Railway, any production target)
- Real-money behavior changes (live order placement, live SL/TP/SELL_ALL changes)
- Deleting files (`rm`, `git rm`, removing whole functions)
- Force push / `git reset --hard` / interactive rebase / branch deletion
- Lifting any HARD BLOCK declared in `BLUEPRINT.md` or this file
- Adding new `event_type` values (requires schema migration + operator approval)
- Modifying environment variables, `.env`, or API keys

## In-between actions (default to ask)

When an action could plausibly fall under either column, default to asking. Examples:

- Refactoring code that touches a HARD BLOCK file even slightly
- Changing the call shape of a function used by live trading
- Adding a dependency or package
- Running scripts that write to disk (e.g., `recovery-cleanup.js`)
- Anything that requires lifting an existing HARD BLOCK

## Codex PASS authority

A Codex PASS verdict authorizes the change **Codex was shown** and nothing beyond:

- It does NOT authorize additional edits not in the reviewed diff.
- It does NOT authorize re-running on a wider scope.
- It does NOT authorize acting on the same file again later without a fresh review.
- It does NOT authorize touching HARD BLOCK files even if the change seems trivial.

If Codex returns FAIL, FAIL-WITH-CONDITIONS, or REJECT, execution stops per blueprint Safety Enforcement Layer. Codex's required edits must be incorporated and re-reviewed before any commit.

## Operator override

The operator can explicitly lift any gate at any time. Phrasing such as:

- "Approved — proceed"
- "Lift HARD BLOCK on `db.js` for this phase"
- "Override Codex on this point"

…unblocks specifically the named action. Override is scoped to the action stated; it does not extend.
