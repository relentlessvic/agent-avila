# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase B.2d-dashboard-TP is closed: source committed (`eca2659`).** Paper `SET_TAKE_PROFIT` is now DB-first via `shadowRecordManualPaperTPUpdate` → `updatePositionRiskLevelsTx` + atomic `manual_tp_update` audit insert. `dashboard.js` only; `bot.js` / `db.js` / `migrations/` / `scripts/` untouched. Codex implementation review = PASS, no required edits.

**Full B.2 paper-mode dual-truth track is now functionally landed.** All paper-mode write paths are DB-canonical:
- paper BUY (`959fef7`)
- paper CLOSE / SELL_ALL (`cb7facb`)
- paper SET_STOP_LOSS (`511f94e`)
- paper SET_TAKE_PROFIT (`eca2659`)

Live-mode write paths remain `position.json`-only by design behind Phase D-5.12.

The next safe action is:

> **Phase C design-only dashboard truth cleanup / reconciliation review. No code.**

Phase C is an audit pass over what (if anything) still needs cleanup in `dashboard.js` and the reconciliation tooling now that the B.2 paper-mode track has landed. Implementation cannot proceed yet; only design discussion / Codex design review is allowed at this stage.

## Phase C — candidate audit targets (read-only at this stage)

- **Residual `position.json` reads in `dashboard.js` outside live write paths.** Specifically the `pos = JSON.parse(readFileSync(POSITION_FILE, ...))` at the top of `handleTradeCommand` (`dashboard.js:1378-1379`) and any other dashboard-side JSON reads. After the B.2 paper-mode track, these should feed only the live branch and the no-position guards. Audit whether any remain that could mislead a paper-mode operator.
- **Reconciliation tooling.** `scripts/reconciliation-shadow.js` is now schema-unblocked at the operator-driven `--persist` mode (migration 006 applied). Audit whether B.2 closure changes the operator's reconciliation playbook (e.g., should the playbook reference the new `manual_sl_update` / `manual_tp_update` audit rows, are there edge cases between rehydrate and dashboard-driven TP writes).
- **bot.js rehydrate semantics vs new dashboard write surface.** `_rehydratePositionJson` and `_legacyPositionsEqual` (`bot.js:909-955`) compare DB → JSON. Verify they continue to behave correctly when the dashboard has just written `take_profit` to DB (no bot dual-write path overlap, but worth re-reading after `eca2659`).
- **UI surface for audit rows.** `manual_tp_update` is now actively inserted by `shadowRecordManualPaperTPUpdate`. Mirror of `manual_sl_update` (B.2b-SL). Audit whether the dashboard's trade-history UI renders these new rows correctly, and whether any UI text needs updating to surface manual TP edits with parity to manual SL edits.

These are starting points; the Phase C design review may add or drop targets. The phase may turn out to be a single dashboard.js cleanup, a series of small commits, or no-op (audit clean) depending on findings.

## Pre-Phase C acknowledgment — migration 006 side effect

The migration 006 carryover note still applies for any reconciliation-related work in Phase C:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

## Phase C prerequisites

| Prerequisite | Status |
|---|---|
| Full B.2 paper-mode track landed | **Satisfied** (`eca2659`, Phase B.2d-dashboard-TP) |
| Phase C design review with Codex | Not started |
| Phase C scope agreed (which audit targets are in/out) | Not decided |
| Any required HARD BLOCK lift identified by audit (e.g., scoped `dashboard.js`) | Not yet known — depends on findings |
| Explicit operator authorization for any implementation step | Not given |

## Deferred follow-up — smoke-test wording

`scripts/smoke-test-live-writes.js:225–239` step label ("active management dual-write") and assertion message ("take_profit unchanged but rewritten") remain stale wording, because `bot.js` no longer rewrites `take_profit` from manage-update. Test logic remains valid (the script calls the `db.js` helper directly with both fields). Cleanup tracked as LOW/cosmetic, best run after Phase C closes so the wording cleanup can also reflect any Phase C findings.

## Alternative phases (operator may choose any)

If Phase C is not the next priority, the operator can advance instead to:

- Phase D-5.12 — Live persistence gate lift (the only remaining dual-truth surface in the system; requires its own design audit and operator-led safety review).
- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase C implementation | All Phase C prerequisites above (design review, scope, any HARD BLOCK lifts, authorization) |
| Phase D-5.12 implementation (live persistence gate lift) | Its own design review + safety audit + operator authorization |
| Live mode write-path changes | Phase D-5.12 |
| Editing `bot.js` / `db.js` / `migrations/` / `dashboard.js` | Explicit operator instruction (all prior scoped lifts expired post-commit) |
| Editing `scripts/smoke-test-live-writes.js` | Explicit operator instruction (deferred LOW/cosmetic phase) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`), B.2c-bot-preserve-TP (`cc6bd2e`), and B.2d-dashboard-TP (`eca2659`) commits; explicitly excluded.

## How to proceed

For Phase C design review: use `orchestrator/prompts/CODEX-REVIEW.md` as a template. Structure the review around the candidate audit targets above; the goal is to (a) confirm or refute that each target is in/out of Phase C scope and (b) produce a phase plan (single phase, multi-phase split, or no-op). Do not write code, edit `dashboard.js`, or touch any HARD BLOCK file until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If Phase C advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
