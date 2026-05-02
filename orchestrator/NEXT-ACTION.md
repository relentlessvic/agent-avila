# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right now

**Smoke-test wording cleanup is closed: source committed (`735b10f`).** `scripts/smoke-test-live-writes.js` had four wording sites refreshed: file-header coverage table at line 11, Step 3 banner at line 225, Step 3 operator-visible label at line 226, and Step 3 assertion message at line 238 (now reads `"take_profit round-trips through helper both-field path"`). The stale "active management dual-write" / "take_profit unchanged but rewritten" wording — inaccurate since B.2c-bot-preserve-TP narrowed bot.js's manage-update payload to `{ stop_loss }` only — is removed from the script. Test logic byte-identical: helper call, fixture constants, assertion booleans, cleanup, exit codes, imports, SAFETY framing all preserved. `scripts/smoke-test-live-writes.js`-only; `dashboard.js` / `bot.js` / `db.js` / `migrations/` and all other `scripts/` files untouched. Codex implementation review = PASS with notes (three LOW-severity informational concerns about archival prose elsewhere in the orchestrator docs, line-11 length, and speculative label-string matchers — none blocking).

**Full Phase C track + smoke-test cleanup are all landed:**
- **C.1** (db.js read filter) — `d0c8817`, closeout `a967a12`.
- **C.2** (dashboard.js mapper + Recent Risk Edits panel) — `2d10107`, closeout `1372392`.
- **C.3** (recovery-inspect heuristic refinement) — `1a16dd8`, closeout `a18b9be`.
- **Smoke-test wording cleanup** — `735b10f`.

Manual SL/TP audit visibility is now complete end-to-end: DB read (C.1) → UI render (C.2) → operator-playbook classification (C.3) → smoke-test wording in line with bot-side state (smoke-test cleanup).

**Codex non-blocking notes (informational, not required edits):**
- Three LOW-severity items from the smoke-test cleanup implementation review: stale wording survives in archival prose elsewhere in the orchestrator docs (this is acceptable historical context), line 11 of `scripts/smoke-test-live-writes.js` is 106 characters (no enforced linter, worth noting if one is ever added), and no test runner string-matching the line-238 assertion label was found (speculative risk).
- From C.3: any in-repo runbooks quoting old classification wording verbatim should be updated if found. Future audit-only event types (beyond `manual_sl_update` / `manual_tp_update`) must be manually added to `AUDIT_ONLY_EVENT_TYPES` — no mechanism currently enforces this.

The next safe action is:

> **Phase D-5.12 design-only review. Live persistence gate lift. No code.**

D-5.12 is the only remaining write-side dual-truth surface in the system: live `SET_STOP_LOSS` / `SET_TAKE_PROFIT` / `SELL_ALL` (and `OPEN_LONG` / `CLOSE_POSITION`) paths in `dashboard.js` still write `position.json` directly without a DB update. D-5.12 will lift that gate. Implementation cannot proceed yet; only design discussion / Codex design review is allowed at this stage. D-5.12 needs its own design audit and operator-led safety review before any implementation lift.

## Phase D-5.12 — scope (preview, to be confirmed in design review)

- Move live-mode `dashboard.js` write paths (`OPEN_LONG`, `CLOSE_POSITION`, `SELL_ALL`, `SET_STOP_LOSS`, `SET_TAKE_PROFIT`) from `position.json`-only to DB-first via the existing `shadowRecordManualPaper*` helper family or a live-mode equivalent. The B.2 paper-mode track is the design template.
- Confirm that bot.js manage-update payload (currently `{ stop_loss }` only after B.2c) remains correct for live mode under the lifted gate.
- Audit live-mode reconciliation paths (`scripts/reconciliation-shadow.js`) for any assumptions that depend on the current `position.json`-authoritative posture.
- Confirm Kraken execution paths are untouched (the B.2 discipline of "no Kraken / no order-placement changes during persistence-layer phases" must hold for D-5.12 too).
- Identify any new event_type values needed (`manual_sl_update_live` / `manual_tp_update_live`?) or whether the existing `manual_sl_update` / `manual_tp_update` types (already in the migration 007 CHECK constraint, currently paper-only by hard-coded mode) are extended to accept live mode.

These are starting points; the D-5.12 design review may refine the scope. The phase may turn out to require multiple sub-phases (mirror of B.2 sub-phase split).

## Pre-D-5.12 acknowledgment — migration 006 side effect

This carryover note from B.2 / C track still applies for any future reconciliation-related work but does NOT block D-5.12 design review:

- Migration 006 (`positions_reconciliation_metadata`) was applied 2026-05-02 as a side effect of running the migration runner for B.2a.
- The runner applies all unapplied migrations sequentially; 006 had been on disk but unapplied (deliberate gate).
- 006 is runtime-inert for `bot.js` / `dashboard.js` — no code reads or writes the new columns. Operator-driven `scripts/reconciliation-shadow.js --persist` is now schema-unblocked.
- **Do not revert 006 without explicit safety review.** Reverting requires DROPping columns (destructive).

## Phase D-5.12 prerequisites

| Prerequisite | Status |
|---|---|
| Full B.2 paper-mode track landed (template for live-mode wiring) | **Satisfied** (`959fef7` + `cb7facb` + `511f94e` + `eca2659`, with `cc6bd2e` for bot-side payload narrowing) |
| Full Phase C visibility track landed (manual SL/TP audit visibility) | **Satisfied** (`d0c8817` + `2d10107` + `1a16dd8`) |
| Smoke-test wording aligned with post-B.2c bot-side state | **Satisfied** (`735b10f`) |
| D-5.12 design review with Codex | Not started |
| D-5.12 operator-led safety review | Not started |
| Decision on event_type extension or new live-mode event types | Not decided |
| `dashboard.js` HARD BLOCK lift for D-5.12 (scoped) | Not given |
| Possibly `db.js` HARD BLOCK lift for new helpers (scoped) | Not given |
| Possibly `migrations/` HARD BLOCK lift for new event_type CHECK (scoped) | Not given |
| Explicit operator authorization | Not given |

Until **all** remaining prerequisites are satisfied, D-5.12 implementation cannot begin. D-5.12 design discussion is allowed and does not write any code.

## What the smoke-test cleanup did NOT do (still on the table)

- Did not touch `dashboard.js`, `bot.js`, `db.js`, or `migrations/`.
- Did not change live trading behavior, Kraken execution, or any DB write path.
- Did not refresh archival prose in the orchestrator docs that quotes the old "active management dual-write" / "unchanged but rewritten" wording — those are historical context for B.2c / C.1 / C.2 / C.3 / smoke-test-cleanup design records and remain accurate as-of the date they were written. No follow-up needed unless a future phase explicitly chooses to scrub them.
- Did not begin any D-5.12 work.
- Did not begin any O-* automation work.

## Alternative phases (operator may choose any)

If D-5.12 is not the next priority, the operator can advance instead to:

- Phase O-5 — Bug Audit System
- Phase O-6 — Security Audit System
- Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist is now schema-unblocked)
- Phase O-8 — Performance & Reliability Upgrades

None of these have started.

## What's blocked right now

| Blocked action | Unblock requires |
|---|---|
| Phase D-5.12 implementation (live persistence gate lift) | Its own design review + safety audit + operator authorization |
| Live mode write-path changes | Phase D-5.12 |
| Editing `bot.js` / `db.js` / `migrations/` / `dashboard.js` | Explicit operator instruction (all prior scoped lifts expired post-commit) |
| Editing `scripts/recovery-inspect.js` | Explicit operator instruction (post-C.3 scoped lift expired) |
| Editing `scripts/smoke-test-live-writes.js` | Explicit operator instruction (post-smoke-test-cleanup scoped lift expired) |
| Editing any other `scripts/` file | Explicit operator instruction (per-file scoped lift required) |
| Touching Kraken execution / SL / TP / BE / trailing logic in bot.js | Explicit operator instruction |
| Deploying or pushing to remote | Explicit operator instruction |
| Force push / reset / rebase / file deletion | Explicit operator instruction |
| Reverting migration 006 (drop columns) | Explicit safety review |

## Working tree truth

- All tracked source files clean apart from this closeout's pending doc edits.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Remained untracked across the B.2b-SL (`511f94e`), B.2c-bot-preserve-TP (`cc6bd2e`), B.2d-dashboard-TP (`eca2659`), C.1 (`d0c8817`), C.2 (`2d10107`), C.3 (`1a16dd8`), and smoke-test wording cleanup (`735b10f`) commits; explicitly excluded.

## How to proceed

For Phase D-5.12 design review: use `orchestrator/prompts/CODEX-REVIEW.md` as a template. Structure the review around the D-5.12 scope-preview above; the design audit must confirm the live-mode wiring template against the B.2 paper-mode track, identify whether new event_type values are needed, audit reconciliation tooling for `position.json`-authoritative assumptions, and confirm Kraken execution paths remain untouched. Do not write code, edit `dashboard.js`, or touch any HARD BLOCK file until the operator explicitly authorizes.

For other phases: paste `orchestrator/prompts/CONTINUE-NEXT-SAFE-STEP.md` after first updating this file (`NEXT-ACTION.md`) to point at the new active phase.

## Closeout for this phase

If D-5.12 advances, update:
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

Use `orchestrator/prompts/PHASE-CLOSEOUT.md` as the template.
