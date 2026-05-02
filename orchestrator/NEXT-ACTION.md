# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Phase C.1 is closed: source committed (`d0c8817`).** `db.js` `loadRecentTradeEvents` WHERE clause expanded from 6 to 8 event types — `manual_sl_update` and `manual_tp_update` are now admitted alongside the existing six lifecycle types. Comment block updated to cite Phase C.1. `db.js`-only; `dashboard.js` / `bot.js` / `migrations/` / `scripts/` untouched. Codex implementation review = PASS with notes (one LOW cosmetic class-name discrepancy in the C.1 design report — deferred to C.2 design verification).

**Phase C audit produced a 3-sub-phase split:**
- **C.1** (db.js read filter) — landed (`d0c8817`).
- **C.2** (dashboard.js mapper + UI rendering) — design-only next.
- **C.3** (`scripts/recovery-inspect.js` heuristic refinement) — design-only later.

**Intermediate rough-rendering window is now open.** Until C.2 lands, `manual_sl_update` and `manual_tp_update` rows can appear in the dashboard `recentTrades` payload and will render via `_dbTradeEventToLegacyShape`'s default branch — raw uppercase types ("MANUAL_SL_UPDATE" / "MANUAL_TP_UPDATE"), `—` placeholders for null numeric fields, and the latest-decision badge falling into the unknown-type class. Cosmetic only — `fired` counter is allowlist-based and unchanged; P&L aggregates exclude SL/TP audit rows; `loadOpenPosition` is unchanged; LIMIT 30 is preserved.

The next safe action is:

> **Phase C.2 design-only dashboard rendering review. No code.**

C.2 covers `dashboard.js` mapper / UI rendering for the new audit event types. Implementation cannot proceed yet; only design discussion / Codex design review is allowed at this stage.

## Phase C.2 — scope

- **`_dbTradeEventToLegacyShape` switch (`dashboard.js:584-591`).** Add cases for `manual_sl_update` / `manual_tp_update` so they map to friendly type labels (e.g., `SL_UPDATE` / `TP_UPDATE`) instead of falling through `default` as raw uppercase.
- **`renderTradeTable` (`dashboard.js:6342-…`).** Render risk-level edits with appropriate placeholders for null `price` / `quantity` / `total`. Optionally surface the metadata-driven "old → new" values (`metadata.old_stop_loss` / `new_stop_loss` for SL, `metadata.old_take_profit` / `new_take_profit` for TP).
- **Latest-decision badge logic (`dashboard.js:7299-7304`).** Update the `else if (t)` branch (or add a new branch) so SL/TP updates display with appropriate styling instead of the generic blocked-class fallback.
- **Class-name verification.** C.2 design must verify the actual class names in use (`mode-paper` / `mode-live` / `mode-blocked` / `dec-buy` / `dec-exit` / `dec-blocked`) before proposing any new label or class. Codex flagged that the C.1 design report mentioned `dec_blocked`, but the real class observed in `dashboard.js` is `mode-blocked`. Do not invent class names; verify against the source first.
- **Out of scope for C.2:** any change to `db.js` / `bot.js` / `migrations/` / `scripts/`. Any backend trade-event filtering or aggregation logic.

## Pre-C.2 acknowledgment — migration 006 side effect

This carryover note from B.2 / C.1 still applies for any future reconciliation-related work but does NOT block C.2:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

## Phase C.2 prerequisites

| Prerequisite | Status |
|---|---|
| C.1 read filter landed | **Satisfied** (`d0c8817`, Phase C.1) |
| C.2 design review with Codex | Not started |
| Class-name verification against `dashboard.js` source | Not done (LOW carryover from C.1 review) |
| Decision on friendly type labels (`SL_UPDATE` / `TP_UPDATE` vs alternatives) | Not decided |
| Decision on whether to render `metadata.old_*` / `new_*` values inline | Not decided |
| `dashboard.js` HARD BLOCK lift for C.2 (scoped) | Not given |
| Explicit operator authorization | Not given |

Until **all** remaining prerequisites are satisfied, C.2 implementation cannot begin. C.2 design discussion is allowed and does not write any code.

## What C.1 did NOT do (still on the table for C.2)

- Did not add cases to `_dbTradeEventToLegacyShape` for the new event types (still falls through to `default` as raw uppercase).
- Did not update `renderTradeTable` placeholders for null numeric fields on risk-level edits.
- Did not update the latest-decision badge logic for SL/TP audit rows.
- Did not touch `dashboard.js`, `bot.js`, `migrations/`, or `scripts/`.

## Deferred follow-ups

- **Phase C.3 — `scripts/recovery-inspect.js` heuristic refinement.** Update the null-FK trade_events heuristic at `scripts/recovery-inspect.js:159` to recognize `manual_sl_update` / `manual_tp_update` as benign event types. Lower priority than C.2; current behavior is conservative-safe (flags for review, doesn't fail).
- **Smoke-test wording cleanup.** `scripts/smoke-test-live-writes.js:225–239` step label ("active management dual-write") and assertion message ("take_profit unchanged but rewritten") remain stale wording. Test logic still valid. LOW/cosmetic. Best run after the full Phase C track (C.2 + C.3) closes so the wording cleanup can also reflect any Phase C findings.

## Alternative phases (operator may choose any)

If C.2 is not the next priority, the operator can advance instead to:

- Phase C.3 — `scripts/recovery-inspect.js` heuristic refinement (described above).
- Phase D-5.12 — Live persistence gate lift (the only remaining write-side dual-truth surface in the system; requires its own design audit and operator-led safety review).
- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase C.2 implementation (dashboard.js mapper + UI rendering) | All C.2 prerequisites above (design review, class-name verification, label decisions, scoped `dashboard.js` lift, authorization) |
| Phase C.3 implementation (`scripts/recovery-inspect.js` heuristic refinement) | Its own design review + scoped `scripts/` lift + operator authorization |
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
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`), B.2c-bot-preserve-TP (`cc6bd2e`), B.2d-dashboard-TP (`eca2659`), and C.1 (`d0c8817`) commits; explicitly excluded.

## How to proceed

For Phase C.2 design review: use `orchestrator/prompts/CODEX-REVIEW.md` as a template. Structure the review around the C.2 scope above; the design must include the class-name verification step (read the actual `dashboard.js` source for the badge / row CSS classes before proposing any new label or class). Do not write code, edit `dashboard.js`, or touch any HARD BLOCK file until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If C.2 advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
