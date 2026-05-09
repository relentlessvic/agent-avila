# Live Manual-Control Failure Taxonomy

> **DOCS-ONLY ARTIFACT.** This document is a SAFE-class taxonomy reference. It does NOT authorize any code phase, deploy, Kraken action, `MANUAL_LIVE_ARMED` toggle, migration application, production state mutation, autopilot runtime activation, or Relay runtime install. Every consumer of this taxonomy (DASH-5.A SL caller, DASH-5.B TP caller, future Phase 8 SELL_ALL implementation, future Phase 9 cleanup) is separately gated.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md`. If this document ever conflicts with either canonical source, the canonical source wins.

**Codification phase:** `DASH-5.D-LIVE-MANUAL-CONTROL-FAILURE-TAXONOMY-CODIFICATION`
**Source design:** `DASH-5-LIVE-CONTROLS-DESIGN-ONLY` §6 (codified at `orchestrator/handoffs/DASH-5-LIVE-CONTROLS-DESIGN.md` §6, committed at `5d53fd6b7e1011623184878636e0284c6863e950`)
**Phase mode:** DOCS-ONLY (Mode 3 per `orchestrator/PHASE-MODES.md`)
**Author:** Claude (Lead Engineer / Builder)
**Date:** 2026-05-08
**Status:** DRAFT — pending Codex docs-only review and explicit operator approval before commit.

## §1 — Phase scope and intent

DASH-5.D-LIVE-MANUAL-CONTROL-FAILURE-TAXONOMY-CODIFICATION codifies the 7-class failure taxonomy proposed in `DASH-5-LIVE-CONTROLS-DESIGN.md` §6 as a permanent on-disk SAFE-class reference. The taxonomy distinguishes **post-Kraken-success DB-failure** classes (where Kraken has executed and real money has moved before the DB persistence failure) from **pre-Kraken DB-only** classes (where no Kraken interaction occurred and the failure is purely DB-side). This distinction matters operationally: post-Kraken classes require emergency-audit ladder routing and operator reconciliation against Kraken state, while pre-Kraken classes require only operator retry without Kraken-state concerns.

**In scope (this codification phase):**
- Authoring this taxonomy reference at `orchestrator/handoffs/LIVE-MANUAL-CONTROL-FAILURE-TAXONOMY.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`.

**Out of scope:**
- Any edit to `dashboard.js`, `bot.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.env`, `.env.example`, `.nvmrc`, `position.json`, `position.json.snap.20260502T020154Z`, deploy config.
- Any edit to safety-policy docs (`PROTECTED-FILES.md`, `APPROVAL-GATES.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, `AUTOMATION-PERMISSIONS.md`, `HANDOFF-RULES.md`, `BLUEPRINT.md`, `AUTOPILOT-RULES.md`, `COMM-HUB-RULES.md`, `COMM-HUB-RELAY-RULES.md`, `CLAUDE.md`).
- Any edit to other handoff records (`DASH-1-READ-STATE-AUDIT.md`, `ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md`, `DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN.md`, `DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN.md`, `DASH-5-LIVE-CONTROLS-DESIGN.md`, `D-5-12F-LIVE-SELLALL-DESIGN.md` — referenced but not modified).
- Any deploy, migration application, Kraken action, `MANUAL_LIVE_ARMED` toggle, env / secret read or write, production DB query or mutation, Railway command, autopilot runtime activation.
- Any DASH-5.A / DASH-5.B / Phase 8 / Phase 9 / DASH-6 / Phase 11 work.
- Any Relay runtime authoring / repo creation / deployment / install resumption.

## §2 — Audit context

**HEAD at codification time:** `1c9766a8cfe569abed9c8ee83ce609ff6b0beebc` (DASH-5-B-CLOSEOUT-SYNC pushed; the journal records DASH-5.B at `9eb21f8…` and DASH-5-A-CLOSEOUT-SYNC at `8819b36…` as closed; DASH-5.A at `5683a5a…` and DASH-5-LIVE-CONTROLS-DESIGN-SPEC at `5d53fd6…` already recorded as closed).

**Working tree state at codification time:** clean except `position.json.snap.20260502T020154Z` (pre-existing untracked carve-out).

**Phase state:**
- ARC-8-UNPAUSE CLOSED at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`. CEILING-PAUSE broken; phase-loop counter 0/3.
- DASH-5-LIVE-CONTROLS-DESIGN-ONLY CLOSED — Design-only PASS.
- DASH-5-LIVE-CONTROLS-DESIGN-SPEC CLOSED at `5d53fd6b7e1011623184878636e0284c6863e950`.
- DASH-5.A-LIVE-STOP-LOSS-HELPER-WIRING CLOSED at `5683a5a76c5094827be8a3bae8c04c599a85bf36` (live SL wired to `shadowRecordManualLiveSLUpdate` at `dashboard.js:846-903`; addresses G5.2).
- DASH-5-A-CLOSEOUT-SYNC CLOSED at `8819b364ccc6413ad4641b35e1be650153957662`.
- DASH-5.B-LIVE-TAKE-PROFIT-HELPER-WIRING CLOSED at `9eb21f8f9ac73a452ff5822fdeb05029bf642da8` (live TP wired to `shadowRecordManualLiveTPUpdate` at `dashboard.js:906-964`; addresses G5.3).
- DASH-5-B-CLOSEOUT-SYNC CLOSED at `1c9766a8cfe569abed9c8ee83ce609ff6b0beebc`.
- Phase 8 (D-5.12f-LIVE-SELLALL-IMPLEMENTATION; HIGH-RISK; ARC-2 Gate 9), Phase 9 (D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP; HIGH-RISK), DASH-6, Phase 11 separately gated.
- Relay shelved. Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`. N-3 CLOSED. Approvers `{Victor}`.

## §3 — The 7-class taxonomy

### §3.1 Full class set

| failure_class | source string | Pre/post-Kraken | Operator-visible meaning |
|---|---|---|---|
| `kraken_post_success_db_unique_violation` | `manual_live_buy` | post-Kraken (real money moved) | Kraken accepted the order; DB INSERT failed because `positions_one_open_per_mode_idx` is already satisfied (a live position is already open). Operator must reconcile: which Kraken order is canonical, close the stale one, decide whether to import via `emergency_audit_log.event_id`. |
| `kraken_post_success_db_other_error` | `manual_live_buy` / `manual_live_close` / `manual_live_sellall` | post-Kraken (real money moved) | Kraken accepted the order; DB persistence failed for a non-uniqueness reason (connection lost / transaction abort / unexpected schema error). Operator must reconstruct position state from `emergency_audit_log` (Layer 2) or LOG_FILE (Layer 3). |
| `kraken_post_success_db_no_open_position` | `manual_live_close` / `manual_live_sellall` | post-Kraken (real money moved) | Kraken sold; no live position exists in DB at the moment of post-sell update (race or pre-existing drift). Operator must reconcile: where did the in-memory `pos` come from, and which Kraken order ID is now uncontracted on the DB side. |
| `db_only_validation_failed` | `manual_live_sl_update` / `manual_live_tp_update` | pre-Kraken (no Kraken call) | Helper rejected the update before any DB write because input was malformed (`!dbPos` or missing `kraken_order_id`). No Kraken interaction; no DB row mutated. Operator should retry after verifying DB has an open live position. |
| `db_only_db_unavailable` | `manual_live_sl_update` / `manual_live_tp_update` | pre-Kraken (no Kraken call) | Helper detected DB unreachable (`!dbAvailable()`) before attempting write. No Kraken interaction; no DB row mutated. Operator should retry once DB connectivity is restored. |
| `db_only_db_error` | `manual_live_sl_update` / `manual_live_tp_update` | pre-Kraken (no Kraken call) | DB transaction threw mid-flight (caught at the helper's catch block; classified by `classifyDbError`). No Kraken interaction; the transaction rolled back. Operator should retry. |
| `db_only_no_open_position` | `manual_live_sl_update` / `manual_live_tp_update` | pre-Kraken (no Kraken call) | `updatePositionRiskLevelsTx` returned no row (race condition: position closed mid-update). No Kraken interaction; no row mutated. Operator should re-fetch position state and retry if a live position is still open. |

### §3.2 Prefix semantics

- **`kraken_post_success_*` (3 classes)** — Kraken has already executed and real money has moved before the DB-side failure. These classes route through the post-Kraken emergency-audit ladder: Layer 1 (helper return) → Layer 2 (`_emergencyAuditWrite` to `emergency_audit_log`) → Layer 3 (`_loglineFallback` to LOG_FILE) → Layer 4 (stderr triple-fault). Operator-visible error includes a pointer to the recorded reconstruction surface; raw `attempted_payload` does NOT enter the operator error message. Caller throws an Error with `auditPointer` reference.
- **`db_only_*` (4 classes)** — No Kraken interaction occurred. The failure is purely DB-side. Failure ladder collapses to throw-on-`!r.ok` with the `r.reason` value; no emergency_audit_log write, no `position.json` modification, no Kraken cancellation question. Operator-visible error message includes the literal `r.reason` string for clarity.

### §3.3 Why distinguish pre/post-Kraken

The DASH-1 audit's R5 + DASH-3 design's G3.1 together establish that **post-Kraken DB failures cannot be silently retried**. Real money has moved; the operator must know whether reconciliation requires DB cleanup, position.json update, or Kraken cancellation. The `kraken_post_success_*` prefix triggers the emergency-audit ladder and explicit operator-visible error messaging.

Pre-Kraken DB failures, by contrast, are recoverable by simple operator retry: the request never reached Kraken, no real-money state moved, no reconciliation question exists. The `db_only_*` prefix signals this lower-severity recovery path.

A taxonomy that conflated the two (e.g., treating all DB failures as `kraken_post_success_db_other_error`) would mislead the operator into investigating Kraken state for purely-DB-side failures. Operationally, the distinction is the difference between "Kraken sold but DB didn't update — reconcile" vs "DB rejected the input — retry."

## §4 — Class-by-class semantics

### `kraken_post_success_db_unique_violation`

**Trigger:** live BUY only. The helper `shadowRecordManualLiveBuy` returns `{ ok: false, errorClass: "unique_violation_one_open_per_mode" }` when the DB INSERT into `positions` fails because `positions_one_open_per_mode_idx` is already satisfied (a live position is already open).

**Caller behavior:** caller (live BUY at `dashboard.js:1944`) wraps as `failure_class = "kraken_post_success_db_unique_violation"`, populates `failureContext` with `kraken_order_id`, calls `_emergencyAuditWrite`, throws an Error with `auditPointer`.

**Operator action:** check `emergency_audit_log.event_id` for the failed insert; reconcile by querying which live position is currently open in `positions` and which Kraken order corresponds; close the stale one or import the new one via `event_id`.

### `kraken_post_success_db_other_error`

**Trigger:** live BUY (`:1945`), live CLOSE (`:2127`), or future live SELL_ALL (D-5.12f). The helper returns `{ ok: false, errorClass: "<some-other-DB-error>" }` for any post-Kraken DB persistence failure that is NOT a unique-violation race.

**Caller behavior:** wrap as `failure_class = "kraken_post_success_db_other_error"`, route through emergency-audit ladder, throw with `auditPointer`.

**Operator action:** reconstruct position state from `emergency_audit_log` (preferred) or LOG_FILE (fallback). Position is NOT recorded in DB; operator must manually insert via the recorded `attempted_payload`.

### `kraken_post_success_db_no_open_position`

**Trigger:** live CLOSE (`:2126`) or future live SELL_ALL (D-5.12f). The helper returns `{ ok: false, reason: "no_open_position" }` when `updatePositionTx` (or equivalent close transaction) finds no live row to update — meaning either a race against bot.js or pre-existing drift (e.g., bot saw the position close at the same moment as the manual close).

**Caller behavior:** wrap as `failure_class = "kraken_post_success_db_no_open_position"`, route through emergency-audit ladder, throw with `auditPointer`.

**Operator action:** verify DB state vs Kraken state. The Kraken sell already happened; the DB shows no open position. Either the bot already closed the position (matching state, the dual-close is idempotent on Kraken's side because the order ID is unique) or the position was closed by an earlier event the operator wasn't aware of.

### `db_only_validation_failed`

**Trigger:** live SL (DASH-5.A wired) or live TP (DASH-5.B wired). The helper at `dashboard.js:848` (SL) or `:908` (TP) returns `{ ok: false, reason: "validation_failed" }` when `!dbPos || !dbPos.kraken_order_id`.

**Caller behavior:** caller throws Error with the literal message: `Manual live {SL|TP} update not recorded in DB (validation_failed). {Stop loss|Take profit} NOT updated.`

**Operator action:** confirm a live position is open in the DB (`SELECT * FROM positions WHERE mode='live' AND status='open'`); if so, retry the update; if not, the input was correctly rejected and no action is needed.

### `db_only_db_unavailable`

**Trigger:** live SL (DASH-5.A wired) or live TP (DASH-5.B wired). The helper at `dashboard.js:847` (SL) or `:907` (TP) returns `{ ok: false, reason: "db_unavailable" }` when `!dbAvailable()`.

**Caller behavior:** caller throws Error with the literal message: `Manual live {SL|TP} update not recorded in DB (db_unavailable). {Stop loss|Take profit} NOT updated.`

**Operator action:** check Postgres connectivity (Railway DB status); retry once connectivity is restored. No retry is auto-attempted; the operator owns the recovery decision.

### `db_only_db_error`

**Trigger:** live SL (DASH-5.A wired) or live TP (DASH-5.B wired). The helper's transaction throws mid-flight; caught at the helper's catch block. The `errorClass` is set via `classifyDbError(e)`. Helper returns `{ ok: false, reason: "db_error", error, errorClass, emergency_context }`.

**Caller behavior:** caller throws Error with the literal message: `Manual live {SL|TP} update not recorded in DB (db_error). {Stop loss|Take profit} NOT updated.` The `emergency_context` field is populated by the helper but NOT consumed by the caller (no emergency-audit ladder for DB-only failures).

**Operator action:** check Postgres logs for the underlying SQL error; retry after verifying DB state.

### `db_only_no_open_position`

**Trigger:** live SL (DASH-5.A wired) or live TP (DASH-5.B wired). The helper's `updatePositionRiskLevelsTx` returns no row — meaning the position closed mid-update (race against bot.js or against a separate manual command). Helper sets `raceDetected = true` and returns `{ ok: false, reason: "no_open_position" }`.

**Caller behavior:** caller throws Error with the literal message: `Manual live {SL|TP} update not recorded in DB (no_open_position). {Stop loss|Take profit} NOT updated.`

**Operator action:** re-fetch live position state; if no live position is open, no action is needed (the SL/TP request was for a position that no longer exists). If a live position is open, retry the update.

## §5 — Operator response guide

### Quick decision tree

```
Did Kraken interact?
├── YES (kraken_post_success_*):
│   ├── unique_violation? → reconcile which Kraken order is canonical
│   ├── no_open_position? → bot may have closed; verify DB-vs-Kraken state
│   └── other_error?      → reconstruct from emergency_audit_log
└── NO (db_only_*):
    ├── validation_failed? → verify input + retry
    ├── db_unavailable?   → check DB connectivity + retry
    ├── db_error?         → check Postgres logs + retry
    └── no_open_position? → verify position still open + retry
```

### Severity classification

| Class | Severity | Why |
|---|---|---|
| `kraken_post_success_db_unique_violation` | **HIGH** | Real money moved; DB drift between Kraken-executed order and DB-recorded position |
| `kraken_post_success_db_other_error` | **HIGH** | Real money moved; DB has no record of the new position |
| `kraken_post_success_db_no_open_position` | **HIGH** | Real money moved; closing-side DB failed to find target row |
| `db_only_validation_failed` | LOW | No Kraken interaction; pure-input rejection; no state at risk |
| `db_only_db_unavailable` | LOW | No Kraken interaction; transient infrastructure issue |
| `db_only_db_error` | LOW | No Kraken interaction; DB transaction rolled back; no state at risk |
| `db_only_no_open_position` | LOW | No Kraken interaction; race condition that closed cleanly |

## §6 — Mapping to existing call sites

### As of HEAD `1c9766a…`

| Call site | File:line | Class consumed |
|---|---|---|
| Live BUY post-Kraken-success unique violation branch | `dashboard.js:1944` | `kraken_post_success_db_unique_violation` |
| Live BUY post-Kraken-success other-error branch | `dashboard.js:1945` | `kraken_post_success_db_other_error` |
| Live CLOSE post-Kraken-success no-open-position branch | `dashboard.js:2126` | `kraken_post_success_db_no_open_position` |
| Live CLOSE post-Kraken-success other-error branch | `dashboard.js:2127` | `kraken_post_success_db_other_error` |
| Live SL caller throw on `!r.ok` (DASH-5.A wired) | `dashboard.js:2291-2294` | `db_only_validation_failed` / `db_only_db_unavailable` / `db_only_db_error` / `db_only_no_open_position` (all 4 reachable depending on helper return path) |
| Live TP caller throw on `!r.ok` (DASH-5.B wired) | `dashboard.js:2325-2328` | same 4 db_only_* classes |

### Helper sites that surface `r.reason` to callers

| Helper | File:line | Reason values |
|---|---|---|
| `shadowRecordManualLiveBuy` | `dashboard.js:710-?` | `db_unavailable`, `validation_failed`, `db_error`, `unique_violation_one_open_per_mode` (errorClass) |
| `shadowRecordManualLiveClose` | `dashboard.js:780-?` | `db_unavailable`, `validation_failed`, `no_open_position`, `db_error` |
| `shadowRecordManualLiveSLUpdate` | `dashboard.js:846-903` | `db_unavailable` (`:847`), `validation_failed` (`:848`), `no_open_position` (`:880`), `db_error` (catch) |
| `shadowRecordManualLiveTPUpdate` | `dashboard.js:906-964` | `db_unavailable` (`:907`), `validation_failed` (`:908`), `no_open_position` (`:940`), `db_error` (catch) |

## §7 — Mapping to future call sites

### Phase 8: D-5.12f-LIVE-SELLALL-IMPLEMENTATION

**Per `D-5-12F-LIVE-SELLALL-DESIGN.md`:** the live SELL_ALL implementation will introduce a new `shadowRecordManualLiveSellAll` helper (currently does not exist). When live SELL_ALL is wired with the post-Kraken emergency-audit ladder, it will consume two classes:

| Phase 8 class | Used in |
|---|---|
| `kraken_post_success_db_other_error` | live SELL_ALL post-Kraken DB-failure (generic) |
| `kraken_post_success_db_no_open_position` | live SELL_ALL post-Kraken race (no open live position to close) |

Phase 8 implementation must NOT introduce new failure-class strings outside this taxonomy without a separate operator-directed phase to extend the taxonomy.

### Phase 9: D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP

**Per `D-5-12F-LIVE-SELLALL-DESIGN.md` §10:** Phase 9 cleans up the emergency-audit payload mutation at `dashboard.js:2145` (`attempted_payload.attempted_payload_hash = attempted_payload_hash;`). This is a structural cleanup of how the live CLOSE post-Kraken ladder handles `attempted_payload`; it does NOT introduce or modify any failure-class string. The 3 existing post-Kraken classes used by live CLOSE remain unchanged.

### Future taxonomy extensions

Any future phase that introduces a NEW failure-class string outside this 7-class set MUST:
1. Open a separate operator-directed phase to extend the taxonomy.
2. Update this document at `orchestrator/handoffs/LIVE-MANUAL-CONTROL-FAILURE-TAXONOMY.md`.
3. Pass Codex docs-only review on the taxonomy extension.
4. Receive explicit operator approval before the new class is introduced into runtime code.

## §8 — Hard-blocked surfaces

### Hard-blocked during this DOCS-ONLY codification phase

Everything except the 4 named files. No file edits outside `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`, and the new `orchestrator/handoffs/LIVE-MANUAL-CONTROL-FAILURE-TAXONOMY.md`. No commits, no pushes, no runtime actions until operator approval.

### Hard-blocked across the entire DASH-5.D track and beyond

| Excluded | Reason |
|---|---|
| `dashboard.js` | RESTRICTED; no scoped lift granted in DASH-5.D (this is a DOCS-ONLY phase) |
| `bot.js` | HARD BLOCK throughout |
| `db.js` | HARD BLOCK throughout (no helper introduced or modified) |
| `migrations/` | HARD BLOCK throughout (no schema change) |
| `position.json` | HARD BLOCK throughout |
| `position.json.snap.20260502T020154Z` | HARD BLOCK (pre-existing carve-out) |
| `package.json`, `package-lock.json`, `.nvmrc` | RESTRICTED; no scoped lift granted |
| `.env*` | HARD BLOCK forever for automation |
| `MANUAL_LIVE_ARMED` env reads | RESTRICTED-not-lifted |
| All safety-policy docs | HARD BLOCK throughout the DASH track |
| All Relay templates / runtime | HARD BLOCK; Relay stays shelved |
| `tests/*.spec.js` | RESTRICTED; DASH-6 territory |
| Other handoff records (`DASH-1-READ-STATE-AUDIT.md`, `ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md`, `DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN.md`, `DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN.md`, `DASH-5-LIVE-CONTROLS-DESIGN.md`, `D-5-12F-LIVE-SELLALL-DESIGN.md`) | Cross-referenced but NOT modified by this codification |
| All paper handlers, live handlers, emergency-audit code | RESTRICTED-not-lifted in DASH-5.D |
| Railway / Kraken / production DB / migration application / deploy / Discord post | RED-tier; not pre-authorized |
| Autopilot runtime activation | Phase 11 territory; explicitly NOT activated |

## §9 — Authorization scope

DASH-5.D-LIVE-MANUAL-CONTROL-FAILURE-TAXONOMY-CODIFICATION (this codification phase) authorizes ONLY:
- Authoring this taxonomy reference at `orchestrator/handoffs/LIVE-MANUAL-CONTROL-FAILURE-TAXONOMY.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`.

DASH-5.D explicitly does NOT authorize:
- Any change to the runtime code that consumes any of the 7 classes.
- Any introduction of a NEW failure-class string outside the 7-class set (any such change must open a separate operator-directed taxonomy-extension phase).
- Any DASH-6 / Phase 11 work.
- Phase 8 (D-5.12f-LIVE-SELLALL-IMPLEMENTATION) — separately gated; HIGH-RISK; ARC-2 Gate 9.
- Phase 9 (D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP) — separately gated; HIGH-RISK per D-5.12f §10.
- Any edit to `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.nvmrc`, `.env*`, `position.json`, `position.json.snap.20260502T020154Z`, deploy config.
- Any safety-policy doc edit.
- Any Relay runtime authoring / repo creation / deployment / install resumption.
- Any production action: Railway CLI, Railway env, Railway redeploy, Kraken action, production DB query / mutation, migration application, `MANUAL_LIVE_ARMED` change, deploy, env / secret read or write, autopilot runtime activation, automation install / widening, Discord post, webhook / scheduler / MCP / cron / Ruflo install.

## §10 — Cross-references

- `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md` — current-phase journal.
- `orchestrator/PHASE-MODES.md` — six phase modes; Mode 3 (DOCS-ONLY) for this codification.
- `orchestrator/PROTECTED-FILES.md` — per-path classification.
- `orchestrator/APPROVAL-GATES.md` — 16-gate matrix.
- `orchestrator/HANDOFF-RULES.md` — packet rules; "Forbidden content" list.
- `orchestrator/FIX-PLAN.md` — Postgres-as-only-source-of-truth contract.
- `orchestrator/handoffs/DASH-1-READ-STATE-AUDIT.md` — G5.1–G5.5 source.
- `orchestrator/handoffs/DASH-5-LIVE-CONTROLS-DESIGN.md` — §6 is the design source for this taxonomy.
- `orchestrator/handoffs/D-5-12F-LIVE-SELLALL-DESIGN.md` — Phase 8 design; uses `kraken_post_success_db_other_error` and `kraken_post_success_db_no_open_position` classes per §11; §10 records D-5.12e.1 cleanup.
- Runtime call sites: `dashboard.js:1944` / `:1945` / `:2126` / `:2127` / `:2291-2294` / `:2325-2328` consume classes from this taxonomy. Helpers at `dashboard.js:846-903` / `:906-964` / `:710-?` / `:780-?` surface `r.reason` values that map to these classes.
