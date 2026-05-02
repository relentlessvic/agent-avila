# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase B.2c-bot-preserve-TP is closed: source committed (`cc6bd2e`).** `bot.js` `manageActiveTrade` no longer writes `take_profit` to DB during breakeven/trail dual-writes; the payload is narrowed to `{ stop_loss }`. The bot-side stale-TP overwrite race that previously gated paper-TP DB-first work is eliminated. Codex implementation review = PASS with notes (one LOW cosmetic concern about stale wording in `scripts/smoke-test-live-writes.js:225–239`; cleanup deferred). Paper `SET_TAKE_PROFIT` itself is still pre-B.2b form (`position.json`-only). The dashboard-side wiring is the next planned step.

The next safe action is:

> **Phase B.2d-dashboard-TP design-only review. No code.**

B.2d covers the paper `SET_TAKE_PROFIT` DB-first dashboard wiring (mirror of B.2b-SL). Implementation cannot proceed yet; only design discussion / Codex design review is allowed at this stage.

## B.2d-dashboard-TP — design blocker resolved

The original B.2c-TP design blocker was: bot.js trailing/breakeven could write stale `take_profit` back to DB after rehydrate, silently overwriting a manual dashboard TP edit. **This blocker is resolved by `cc6bd2e`** — bot.js no longer writes `take_profit` from manage-update at all (Option C: bot preserves DB take_profit when only updating SL). With the bot-side write path now narrowed to `{ stop_loss }`, the dashboard can safely become the sole DB writer for paper `take_profit` after B.2d lands.

Residual TP write paths (read-only inspection summary; please re-verify before B.2d implementation):
- Dashboard `SET_TAKE_PROFIT` paper handler (`dashboard.js:1540-1546`) — still `position.json`-only; this is what B.2d will rewire.
- bot.js `loadPosition` reads DB TP into in-memory `position.takeProfit` (`bot.js:836-840`); read-only, no DB write.
- bot.js initial position open writes both SL and TP at entry (`bot.js:587-603`); this is intentional and unchanged.
- bot.js `_rehydratePositionJson` mirrors DB → JSON, including TP (`bot.js:930-955`); read-from-DB / write-to-JSON, no DB write.
- After B.2d: dashboard `SET_TAKE_PROFIT` paper handler → `shadowRecordManualPaperTPUpdate` → `updatePositionRiskLevelsTx` + atomic `manual_tp_update` audit insert. This is the new DB write site.

## Pre-B.2d acknowledgment — migration 006 side effect

This carryover note from B.2b/B.2c is still relevant for B.2d:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

This acknowledgment does NOT block B.2d.

## Phase B.2d-dashboard-TP prerequisites

| Prerequisite | Status |
|---|---|
| Bot-side stale-TP overwrite race resolved | **Satisfied** (`cc6bd2e`, Phase B.2c-bot-preserve-TP) |
| `manual_tp_update` event_type accepted by schema | **Satisfied** (`a324290`, Phase B.2a, migration 007) |
| `updatePositionRiskLevelsTx` helper available for atomic TP + audit insert | **Satisfied** (`a324290`, Phase B.2a) |
| Codex design review for B.2d (mirror of B.2b-SL design) | Not started |
| Decision on best-effort LOG_FILE entry for paper TP update | Not decided |
| Caller throw wording approval (precedent: B.2b-SL) | Not designed |
| Comment block update in `dashboard.js` (lift the B.2c deferral note; record B.2d wiring) | Not drafted |
| `dashboard.js` HARD BLOCK lift for B.2d (scoped) | Not given |
| Explicit operator authorization | Not given |

Until **all** remaining prerequisites are satisfied, B.2d implementation cannot begin. B.2d design discussion is allowed and does not write any code.

## What B.2c-bot-preserve-TP did NOT do (still on the table for B.2d)

- Did not add `shadowRecordManualPaperTPUpdate` to dashboard.js (still absent; will be added in B.2d).
- Did not change `SET_TAKE_PROFIT` handler behavior — paper TP still writes `position.json` and is reverted by bot.js's next rehydrate cycle.
- Did not insert any `manual_tp_update` events at runtime (still no caller).
- Did not touch dashboard.js, db.js, migrations, or scripts/smoke-test-live-writes.js.

## Deferred follow-up — smoke-test wording

`scripts/smoke-test-live-writes.js:225–239` step label ("active management dual-write") and assertion message ("take_profit unchanged but rewritten") are now stale wording, because `bot.js` no longer rewrites `take_profit` from manage-update. Test logic remains valid (the script calls the `db.js` helper directly with both fields, and the helper still supports both-field calls). Cleanup tracked as LOW/cosmetic, best run after B.2d closes so the new wording can also reflect the dashboard-driven TP write path.

## Alternative phases (operator may choose any)

If Phase B.2d is not the next priority, the operator can advance instead to a phase that does not require any HARD BLOCK lift:

- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase B.2d-dashboard-TP implementation (paper TP DB-first dashboard wiring) | All B.2d prerequisites above |
| Live mode write-path changes | Phase D-5.12 |
| Editing `bot.js` / `db.js` / `migrations/` | Explicit operator instruction (prior scoped lifts expired post-commit) |
| Editing `dashboard.js` | Explicit operator instruction (B.2b-SL's scoped lift expired post-commit) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`) and B.2c-bot-preserve-TP (`cc6bd2e`) commits; explicitly excluded.

## How to proceed

For Phase B.2d design review: use `orchestrator/prompts/CODEX-REVIEW.md` as a template. The bot-side blocker is now resolved; structure the review around the dashboard-side wiring (mirror of B.2b-SL — new `shadowRecordManualPaperTPUpdate`, atomic `manual_tp_update` audit insert, no JSON fallback, throws on `!ok`, idempotency seed). Do not write code, edit `dashboard.js`, or touch any HARD BLOCK file until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If B.2d advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
