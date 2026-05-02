# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase C.3 is closed: source committed (`1a16dd8`).** `scripts/recovery-inspect.js` `showNullFkTradeEvents(mode)` heuristic refined from a 1-line ternary to a 3-way classification: `_attempt$` → "expected — failed attempt" (preserved verbatim), `manual_sl_update` / `manual_tp_update` → "audit-only — investigate if seen" (NEW; Codex-required wording), all others → "suspicious — review" (preserved verbatim). New function-local `AUDIT_ONLY_EVENT_TYPES` Set holds the audit event types. SQL query, SAFETY CONTRACT, function signature, bind params, per-row print pattern all unchanged. `scripts/recovery-inspect.js`-only; `dashboard.js` / `bot.js` / `db.js` / `migrations/` / `scripts/smoke-test-live-writes.js` untouched. Codex implementation review = PASS, all checklist items PASS, no required edits.

**Full Phase C track is now functionally landed:**
- **C.1** (db.js read filter) — `d0c8817`, closeout `a967a12`.
- **C.2** (dashboard.js mapper + Recent Risk Edits panel) — `2d10107`, closeout `1372392`.
- **C.3** (recovery-inspect heuristic refinement) — `1a16dd8`.

Manual SL/TP audit visibility is now complete: DB read (C.1) → UI render (C.2) → operator-playbook classification (C.3).

**Codex non-blocking notes from the C.3 implementation review:**
- Any in-repo runbooks quoting old classification wording verbatim should be updated if found. (No blocking surface identified during the review.)
- Future audit-only event types (beyond `manual_sl_update` / `manual_tp_update`) must be manually added to `AUDIT_ONLY_EVENT_TYPES` — no mechanism currently enforces this.

The next safe action is:

> **Smoke-test wording cleanup design-only review. LOW/cosmetic. No code.**

The deferred smoke-test wording cleanup is now the natural next item. `scripts/smoke-test-live-writes.js:225-239` step label ("active management dual-write") and assertion message ("take_profit unchanged but rewritten") have been stale since the B.2c-bot-preserve-TP commit (`cc6bd2e`) narrowed bot.js's manage-update payload to `{ stop_loss }` only. Test logic still passes today (the script calls the `db.js` helper directly with both fields, and the helper still supports both-field calls); cleanup is purely wording. Implementation cannot proceed yet; only design discussion / Codex design review is allowed at this stage.

## Smoke-test wording cleanup — scope

- **`scripts/smoke-test-live-writes.js:225-239`** — refresh the step label at line 226 ("active management dual-write") and the assertion message at line 238 ("take_profit unchanged but rewritten") to reflect that `bot.js` no longer rewrites `take_profit` from manage-update.
- **No assertion-logic change.** The script calls the `db.js` helper directly with both fields; the helper still supports both-field calls. Only the printed wording changes; the underlying assertions still pass.
- **Out of scope:** any change to `dashboard.js` / `bot.js` / `db.js` / `migrations/`. Any other `scripts/` file. Any actual test assertion or logic change.

## Pre-cleanup acknowledgment — migration 006 side effect

This carryover note from B.2 / C.1 / C.2 / C.3 still applies for any future reconciliation-related work but does NOT block the smoke-test wording cleanup:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

## Smoke-test wording cleanup prerequisites

| Prerequisite | Status |
|---|---|
| Phase C track landed (C.1 + C.2 + C.3) | **Satisfied** (`d0c8817` + `2d10107` + `1a16dd8`) |
| Smoke-test cleanup design review with Codex | Not started |
| Decision on exact replacement wording | Not decided |
| `scripts/smoke-test-live-writes.js` HARD BLOCK lift (scoped) | Not given |
| Explicit operator authorization | Not given |

Until **all** remaining prerequisites are satisfied, the cleanup implementation cannot begin. Design discussion is allowed and does not write any code.

## What C.3 did NOT do (still on the table)

- Did not touch `scripts/smoke-test-live-writes.js` — the deferred LOW/cosmetic phase remains.
- Did not touch `dashboard.js`, `bot.js`, `db.js`, or `migrations/`.
- Did not change live trading behavior, Kraken execution, or any DB write path.
- Did not modify the latest-decision badge, `renderTradeTable`, `fired` counter, P&L aggregates, or win-loss aggregates.
- Did not extend `AUDIT_ONLY_EVENT_TYPES` beyond the two B.2b-SL / B.2d audit event types.

## Alternative phases (operator may choose any)

If the smoke-test wording cleanup is not the next priority, the operator can advance instead to:

- Phase D-5.12 — Live persistence gate lift (the only remaining write-side dual-truth surface in the system; requires its own design audit and operator-led safety review). NOT started; no D-5.12 work has been initiated and the design-only review remains pending behind a separate safety pass.
- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Smoke-test wording cleanup implementation (`scripts/smoke-test-live-writes.js`) | All prerequisites above (design review, scoped lift, authorization) |
| Phase D-5.12 implementation (live persistence gate lift) | Its own design review + safety audit + operator authorization |
| Live mode write-path changes | Phase D-5.12 |
| Editing `bot.js` / `db.js` / `migrations/` / `dashboard.js` | Explicit operator instruction (all prior scoped lifts expired post-commit) |
| Editing `scripts/recovery-inspect.js` | Explicit operator instruction (post-C.3 scoped lift expired) |
| Editing `scripts/smoke-test-live-writes.js` | Explicit operator instruction (deferred LOW/cosmetic phase, scoped lift required) |
| Editing any other `scripts/` file | Explicit operator instruction (per-file scoped lift required) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`), B.2c-bot-preserve-TP (`cc6bd2e`), B.2d-dashboard-TP (`eca2659`), C.1 (`d0c8817`), C.2 (`2d10107`), and C.3 (`1a16dd8`) commits; explicitly excluded.

## How to proceed

For the smoke-test wording cleanup design review: use `orchestrator/prompts/CODEX-REVIEW.md` as a template. Structure the review around the wording-only scope above; confirm the proposed replacement strings, that no test logic changes, and that the SAFETY CONTRACT analog of `scripts/smoke-test-live-writes.js` (this is a DB-writing live-test script — not read-only) is not weakened. Do not write code, edit `scripts/`, or touch any HARD BLOCK file until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If the smoke-test wording cleanup advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
