# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase C.2 is closed: source committed (`2d10107`).** `dashboard.js` `_dbTradeEventToLegacyShape` switch extended with `manual_sl_update` → `SL_UPDATE` and `manual_tp_update` → `TP_UPDATE` cases plus four metadata-backed legacy-shape fields. New dedicated "Recent Risk Edits" panel added in the Performance tab with operator-friendly Time / Type / Old / New / Order ID columns; Order ID escaped via `btEsc()`; sublabel includes the required LIMIT 30 caveat verbatim. `dashboard.js`-only; `bot.js` / `db.js` / `migrations/` / `scripts/` untouched. Codex implementation review = PASS, all 41 checklist items PASS, no required edits.

**The C.1 rough-rendering / visibility gap is now closed.** `manual_sl_update` and `manual_tp_update` audit rows are admitted by the C.1 read filter (`d0c8817`) and rendered via the C.2 dedicated panel (`2d10107`). The legacy-shape default branch is no longer the rendering path for these event types.

**Phase C track status:**
- **C.1** (db.js read filter) — landed (`d0c8817`, closeout `a967a12`).
- **C.2** (dashboard.js mapper + UI rendering) — landed (`2d10107`).
- **C.3** (`scripts/recovery-inspect.js` heuristic refinement) — design-only next.

The next safe action is:

> **Phase C.3 design-only `scripts/recovery-inspect.js` heuristic cleanup. No code.**

C.3 covers a small refinement to the null-FK trade_events heuristic so the operator playbook isn't burdened with false-positive "suspicious — review" tags for `manual_sl_update` / `manual_tp_update`. Implementation cannot proceed yet; only design discussion / Codex design review is allowed at this stage.

## Phase C.3 — scope

- **`scripts/recovery-inspect.js:159`** — extend the existing `/_attempt$/` heuristic so `manual_sl_update` and `manual_tp_update` are also recognized as benign event types (audit-only, intentionally produce null FK only when the in-transaction race fires; B.2b-SL / B.2d wrappers skip `insertTradeEvent` on `!positionId`, so the null-FK case is theoretical).
- **Conservative-safe today.** The current behavior is "flag for review," not "fail." So C.3 is operator-playbook clarity, not correctness.
- **Out of scope for C.3:** any change to `db.js` / `bot.js` / `migrations/` / `dashboard.js`. Any new heuristics beyond the audit-event recognition. Any change to the SELECT query at `scripts/recovery-inspect.js:146-150`.

## Pre-C.3 acknowledgment — migration 006 side effect

This carryover note from B.2 / C.1 / C.2 still applies for any future reconciliation-related work but does NOT block C.3:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

## Phase C.3 prerequisites

| Prerequisite | Status |
|---|---|
| C.1 read filter landed | **Satisfied** (`d0c8817`, Phase C.1) |
| C.2 dashboard rendering landed | **Satisfied** (`2d10107`, Phase C.2) |
| C.3 design review with Codex | Not started |
| Decision on heuristic shape (allowlist vs regex extension vs explicit case) | Not decided |
| `scripts/` HARD BLOCK lift for C.3 (scoped) | Not given |
| Explicit operator authorization | Not given |

Until **all** remaining prerequisites are satisfied, C.3 implementation cannot begin. C.3 design discussion is allowed and does not write any code.

## What C.2 did NOT do (still on the table)

- Did not touch `scripts/recovery-inspect.js` — Phase C.3 territory.
- Did not touch `scripts/smoke-test-live-writes.js` — separate LOW/cosmetic phase.
- Did not touch `bot.js`, `db.js`, or `migrations/`.
- Did not change live trading behavior or Kraken execution.
- Did not modify the latest-decision badge, `renderTradeTable`, `fired` counter, P&L aggregates, or win-loss aggregates.

## Deferred follow-ups

- **Smoke-test wording cleanup.** `scripts/smoke-test-live-writes.js:225–239` step label ("active management dual-write") and assertion message ("take_profit unchanged but rewritten") remain stale wording. Test logic still valid. LOW/cosmetic. Best run after C.3 closes so the wording cleanup can reflect the full Phase C state.

## Alternative phases (operator may choose any)

If C.3 is not the next priority, the operator can advance instead to:

- Smoke-test wording cleanup (described above).
- Phase D-5.12 — Live persistence gate lift (the only remaining write-side dual-truth surface in the system; requires its own design audit and operator-led safety review).
- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase C.3 implementation (`scripts/recovery-inspect.js` heuristic refinement) | All C.3 prerequisites above (design review, scoped `scripts/` lift, authorization) |
| Phase D-5.12 implementation (live persistence gate lift) | Its own design review + safety audit + operator authorization |
| Live mode write-path changes | Phase D-5.12 |
| Editing `bot.js` / `db.js` / `migrations/` / `dashboard.js` | Explicit operator instruction (all prior scoped lifts expired post-commit) |
| Editing `scripts/recovery-inspect.js` | Explicit operator instruction (Phase C.3 scoped lift required) |
| Editing `scripts/smoke-test-live-writes.js` | Explicit operator instruction (deferred LOW/cosmetic phase) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`), B.2c-bot-preserve-TP (`cc6bd2e`), B.2d-dashboard-TP (`eca2659`), C.1 (`d0c8817`), and C.2 (`2d10107`) commits; explicitly excluded.

## How to proceed

For Phase C.3 design review: use `orchestrator/prompts/CODEX-REVIEW.md` as a template. Structure the review around the C.3 scope above; the design audit should confirm whether to extend the regex, add an explicit allowlist, or use a hybrid approach for recognizing `manual_sl_update` / `manual_tp_update` as benign. Do not write code, edit `scripts/`, or touch any HARD BLOCK file until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If C.3 advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
