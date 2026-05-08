# DASH-5 — Live Controls Design

> **DOCS-ONLY ARTIFACT.** This document is a design record. It does NOT authorize any code phase, deploy, Kraken action, `MANUAL_LIVE_ARMED` toggle, migration application, production state mutation, autopilot runtime activation, or Hermes runtime install. The downstream DASH-5.A / DASH-5.B / DASH-5.D sub-phases, the interleaved Phase 8 (D-5.12f-LIVE-SELLALL-IMPLEMENTATION) and Phase 9 (D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP), and Phase 11 ARC-8-RUN-D each remain separately gated.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` (per `HANDOFF-RULES.md`). If this document ever conflicts with either canonical source, the canonical source wins.
>
> **No packet substitutes for in-session operator approval** (per `orchestrator/APPROVAL-GATES.md`).

**Codification phase:** `DASH-5-LIVE-CONTROLS-DESIGN-SPEC`
**Source design phase:** `DASH-5-LIVE-CONTROLS-DESIGN-ONLY` (Design-only PASS; Codex round-1 PASS WITH REQUIRED EDITS on D5 / E3 / F1 + round-2 clean PASS on all 38 checks; conversation-only; no commit by the design phase itself)
**Phase mode:** DOCS-ONLY (Mode 3 per `orchestrator/PHASE-MODES.md`)
**Author:** Claude (Lead Engineer / Builder)
**Date:** 2026-05-07
**Status:** DRAFT — pending Codex docs-only review and explicit operator approval before commit.

## §1 — Current state

**HEAD at design time:** `c8b0e3c6d8eeca3f9cc6efcaa86a72ae57174ddb` (DASH-4-A-CLOSEOUT-SYNC pushed; the journal at HEAD `c8b0e3c…` records DASH-4.A at `5e1509e…` and DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN-SPEC at `3061901…` as closed).

**Working tree state:** clean except `position.json.snap.20260502T020154Z` (pre-existing untracked carve-out).

**Phase state at design time:**
- ARC-8-UNPAUSE CLOSED at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`. CEILING-PAUSE broken; phase-loop counter 0/3.
- ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC CLOSED at `b7ce42fa79b493ae532fe5a5ba89692c4ad6ae89`.
- DASH-1-READ-STATE-AUDIT-SPEC CLOSED at `dcf453acf5d8ee281646cacb07810dcfe5d2850a`.
- DASH-2.A CLOSED at `d6c77af3f203d1e17f6238eb53a7232592dd670d`.
- DASH-2-A-CLOSEOUT-SYNC CLOSED at `dbdda33e9bb4608e7a19d225f872a73d7146db69`.
- DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN-SPEC CLOSED at `5d0abcb15c008d669e5653b21f4c15091d474aed`.
- DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN-SPEC CLOSED at `3061901718257db5bf4f6edb7923a96246b40bda`.
- DASH-4.A-PAPER-CLOSE-QUANTITY-ENVELOPE-FIX CLOSED at `5e1509eebffacd7b73172367a157baadd9552df5`.
- DASH-4-A-CLOSEOUT-SYNC CLOSED at `c8b0e3c6d8eeca3f9cc6efcaa86a72ae57174ddb`.
- DASH-5-LIVE-CONTROLS-DESIGN-ONLY CLOSED — Design-only PASS (Codex round-1 PASS WITH REQUIRED EDITS on D5 / E3 / F1 + round-2 clean PASS on all 38 checks).
- Phase 8 (D-5.12f-LIVE-SELLALL-IMPLEMENTATION; HIGH-RISK; ARC-2 Gate 9), Phase 9 (D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP; HIGH-RISK), Phase 10 (DASH-6), Phase 11 (ARC-8-RUN-D) all separately gated.
- Hermes shelved. Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`. N-3 CLOSED. Approvers `{Victor}`.

**`dashboard.js` classification:** RESTRICTED per `PROTECTED-FILES.md:53-73`. The DASH-4.A scoped lift was CONSUMED at `5e1509e…` per `PROTECTED-FILES.md:59`. No active lift held. Any DASH-5.A / DASH-5.B implementation will require a fresh operator-granted scoped lift.

## §2 — Live SELL_ALL behavior (G5.1)

**Lines:** `dashboard.js:2253-2261` (live branch of `if (command === "SELL_ALL")`)

**Code path at HEAD `c8b0e3c…`:**
```
:2254  const bal = await fetchKrakenBalance();                     // Kraken read
:2255  const xrp = bal.balances?.find(b => b.asset === "XRP");
:2256  if (!xrp || xrp.amount < 0.001) throw new Error("...");
:2257  const order = await execKrakenOrder("sell", krakenPair,     // Kraken write — real money moves
                       xrp.amount.toFixed(8), 1);
:2258  const orderId = order.orderId;
:2259  writeFileSync(POSITION_FILE, JSON.stringify({ open: false }, null, 2));   // direct JSON write
:2260  balanceCache = null;
:2261  return { ok: true, message: ..., price, orderId, quantity: xrp.amount };
```

**G5.1 finding:** **DB-bypass.** No `loadOpenPosition("live")` read. No `shadowRecordManualLiveSellAll` helper exists. After successful Kraken sell, only `position.json` is updated to `{ open: false }`; no row written to `positions` (no status flip), no row written to `trade_events` (no exit event), no row written to `emergency_audit_log` even on degraded paths. Postgres `positions.status='open'` for live still says open while `position.json.open === false` after this command.

**Comparison vs live CLOSE_POSITION:** the live CLOSE_POSITION branch at `:2076-2223` has the full D-5.12e fail-loud caller-driven failure ladder (Layer 1 helper → Layer 2 `emergency_audit_log` → Layer 3 LOG_FILE → Layer 4 stderr triple-fault). Live SELL_ALL at `:2253-2261` is byte-identical-to-pre-D-5.12d code — no DB persistence, no emergency-audit ladder, no `shadowRecordManualLiveSellAll` helper exists.

**Phase ownership:** Phase 8 (`D-5.12f-LIVE-SELLALL-IMPLEMENTATION`). The canonical Phase 8 design lives at `orchestrator/handoffs/D-5-12F-LIVE-SELLALL-DESIGN.md` and was approved at commit `5165b555a3de215d18f50c758393fd6ae8479019` (with closeout-sync at `d90d19a64a9459e12e9eeb8b8e2916b68b6dfeaa`, rolled into ARC-8-UNPAUSE at `22ba4a7…`). DASH-5 cross-references this record without duplicating; G5.1 is NOT designed by DASH-5.

## §3 — Live stop-loss behavior (G5.2)

**Lines:** `dashboard.js:2281-2286` (live branch of `if (command === "SET_STOP_LOSS")`)

**Code path at HEAD `c8b0e3c…`:**
```
:2281  // Live path: byte-identical to today (writes position.json directly).
:2282  if (!pos.open) throw new Error("No open position — open a trade first");
:2283  const pct    = parseFloat(params.pct || 1.25);
:2284  pos.stopLoss = pos.entryPrice * (1 - pct / 100);
:2285  writeFileSync(POSITION_FILE, JSON.stringify(pos, null, 2));
:2286  return { ok: true, message: `Stop loss updated to $...` };
```

**G5.2 finding:** **DB-bypass with helper present.** The DB-first persistence helper `shadowRecordManualLiveSLUpdate(dbPos, newSL)` exists at `dashboard.js:846-903` and is functionally complete:
- Opens a transaction via `inTransaction` (`db.js`).
- Calls `updatePositionRiskLevelsTx(client, "live", dbPos.kraken_order_id, { stop_loss: newSL })`.
- Inserts a `manual_sl_update` event into `trade_events` with `metadata.source = "manual_live_sl_update"` + `old_stop_loss` + `new_stop_loss`.
- Classifies DB errors via `classifyDbError(e)`.
- Returns `{ ok, reason, error?, errorClass?, emergency_context? }` with the same shape as `shadowRecordManualLiveBuy` and `shadowRecordManualLiveClose`.
- Has an early-return path `if (!dbAvailable()) return { ok: false, reason: "db_unavailable" };` at `:847`.
- Has an early-return path `if (!dbPos || !dbPos.kraken_order_id) return { ok: false, reason: "validation_failed" };` at `:848`.
- Sets `raceDetected` when `updatePositionRiskLevelsTx` returns no row (race) and returns `{ ok: false, reason: "no_open_position" }` at `:880`.
- Returns `{ ok: false, reason: "db_error", error, errorClass, emergency_context }` from the catch block.

**The helper is unwired.** The live SL caller at `:2281-2286` does not invoke it. The paper SL caller at `:2274` correctly calls `shadowRecordManualPaperSLUpdate`. The gap is a missing call-site change, not a missing helper.

**Critical asymmetry:** unlike live SELL_ALL (which moves real money and is HIGH-RISK), live SL does NOT make a Kraken call — it's a local-state mutation only. So this is not "post-Kraken DB persist" risk; it's "DB persist without Kraken interaction." The failure ladder simplifies: there is no Kraken cancellation question, no real-money movement, no need for emergency_audit_log routing. The simplest fail-loud pattern is paper-symmetric: try the helper, throw on `!r.ok`, do not write `position.json`.

## §4 — Live take-profit behavior (G5.3)

**Lines:** `dashboard.js:2307-2312` (live branch of `if (command === "SET_TAKE_PROFIT")`)

**Code path at HEAD `c8b0e3c…`:**
```
:2307  // Live path: byte-identical to today (writes position.json directly).
:2308  if (!pos.open) throw new Error("No open position — open a trade first");
:2309  const pct       = parseFloat(params.pct || 2.0);
:2310  pos.takeProfit  = pos.entryPrice * (1 + pct / 100);
:2311  writeFileSync(POSITION_FILE, JSON.stringify(pos, null, 2));
:2312  return { ok: true, message: `Take profit updated to $...` };
```

**G5.3 finding:** **DB-bypass with helper present.** Mirror of G5.2. The helper `shadowRecordManualLiveTPUpdate(dbPos, newTP)` exists at `dashboard.js:906-964` and is structurally identical to the SL helper except it writes `take_profit` instead of `stop_loss` and emits a `manual_tp_update` event with `metadata.source = "manual_live_tp_update"`. Same `db_unavailable` / `validation_failed` / `no_open_position` / `db_error` early-return paths. Same unwired-call-site pattern. Same simplification (no Kraken interaction, no real-money movement, no emergency_audit_log routing).

## §5 — Live BUY mutation re-audit (G5.4)

**Lines:** `dashboard.js:1956-1975` (live BUY post-Kraken-failure ladder; the call-site fallback that locally redacts when the helper's early-return paths don't populate `emergency_context`)

**Code path excerpt at HEAD `c8b0e3c…`:**
```
:1956  let attempted_payload, attempted_payload_hash;
:1957  if (r.emergency_context && r.emergency_context.attempted_payload) {
:1958    attempted_payload = r.emergency_context.attempted_payload;
:1959    attempted_payload_hash = r.emergency_context.attempted_payload_hash ?? sha256HexCanonical(attempted_payload);
:1960  } else {
:1961    attempted_payload = _redactAttemptedPayload({...});  // 11-field allow-list
…
:1974    attempted_payload_hash = sha256HexCanonical(attempted_payload);
:1975  }
```

**G5.4 finding (re-audit at HEAD `c8b0e3c…`):** **Already clean.** Live BUY computes `attempted_payload_hash = sha256HexCanonical(attempted_payload)` at `:1974` and **does not** mutate `attempted_payload` to write the hash back into it. The redacted payload is a pure 11-field object (symbol / side / entry_price / entry_time / quantity / trade_size_usd / leverage / effective_size_usd / stop_loss / take_profit / kraken_order_id) with no embedded hash field.

**Contrast with live CLOSE_POSITION at `:2128-2146`:** the live CLOSE_POSITION fallback at `:2145` does mutate the payload — `attempted_payload.attempted_payload_hash = attempted_payload_hash;` — writing the hash back into the redacted object. This is the D-5.12e.1 cleanup target identified in `D-5-12F-LIVE-SELLALL-DESIGN.md` §10 as a separately-gated Phase 9.

**Conclusion for G5.4:** live BUY does NOT share the D-5.12e mutation pattern. The DASH-1 audit hypothesis ("live BUY may share the 10-key mutation") is closed by direct re-audit at HEAD `c8b0e3c…`. **G5.4 is closed as a no-finding.** The mutation lives only in live CLOSE_POSITION at `:2145` and is owned by Phase 9 (D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP). DASH-5 does not advance Phase 9.

## §6 — Failure-class taxonomy (G5.5)

### §6.1 Existing failure-class strings in `dashboard.js`

| Site | failure_class string | Used in |
|---|---|---|
| `:1942-1945` | `kraken_post_success_db_unique_violation` | live BUY (D-5.12d) |
| `:1942-1945` | `kraken_post_success_db_other_error` | live BUY (D-5.12d) |
| `:2124-2127` | `kraken_post_success_db_no_open_position` | live CLOSE_POSITION (D-5.12e) |
| `:2124-2127` | `kraken_post_success_db_other_error` | live CLOSE_POSITION (D-5.12e) |

### §6.2 Existing source strings in `failureContext.source` field

| Site | source string |
|---|---|
| `:1978` | `manual_live_buy` |
| `:2149` | `manual_live_close` |
| `:874` (helper) | `manual_live_sl_update` |
| `:934` (helper) | `manual_live_tp_update` |

### §6.3 Proposed taxonomy (DASH-5 design)

The existing `kraken_post_success_*` prefix correctly captures live BUY and live CLOSE post-Kraken DB-failure cases. Live SL/TP failures occur **without any Kraken interaction** (helper is invoked before any Kraken call site), so the prefix `kraken_post_success_*` would mislead the operator into thinking a Kraken state movement is in question. The `db_only_*` prefix signals "no Kraken side-effect; operator must understand DB state mismatch only."

**Full proposed failure-class set (Codex round-2 PASS, 4-class `db_only_*` set):**

| failure_class | source | Pre/post-Kraken | Used by |
|---|---|---|---|
| `kraken_post_success_db_unique_violation` | `manual_live_buy` | post-Kraken | live BUY (existing) |
| `kraken_post_success_db_other_error` | `manual_live_buy` / `manual_live_close` / `manual_live_sellall` | post-Kraken | live BUY (existing), live CLOSE (existing), live SELL_ALL (D-5.12f) |
| `kraken_post_success_db_no_open_position` | `manual_live_close` / `manual_live_sellall` | post-Kraken | live CLOSE (existing), live SELL_ALL (D-5.12f) |
| `db_only_validation_failed` | `manual_live_sl_update` / `manual_live_tp_update` | pre-Kraken (no Kraken call) | DASH-5.A / DASH-5.B |
| `db_only_db_unavailable` | `manual_live_sl_update` / `manual_live_tp_update` | pre-Kraken (no Kraken call) | DASH-5.A / DASH-5.B |
| `db_only_db_error` | `manual_live_sl_update` / `manual_live_tp_update` | pre-Kraken (no Kraken call) | DASH-5.A / DASH-5.B |
| `db_only_no_open_position` | `manual_live_sl_update` / `manual_live_tp_update` | pre-Kraken (no Kraken call) | DASH-5.A / DASH-5.B |

**Note on `db_only_db_unavailable`:** both helpers `shadowRecordManualLiveSLUpdate` at `:847` and `shadowRecordManualLiveTPUpdate` at `:907` have an early-return `if (!dbAvailable()) return { ok: false, reason: "db_unavailable" };` path. This is a distinct failure mode from `db_error` (which is a thrown/caught exception within a transaction) — `db_unavailable` is detected before any DB connection is attempted. The taxonomy must include both.

**Codification venue (DASH-5.D):** the failure-class taxonomy will be codified by either:
- Extending `D-5-12F-LIVE-SELLALL-DESIGN.md` §11 with the full 7-class set above; or
- Creating a new dedicated SAFE-class doc at `orchestrator/handoffs/LIVE-MANUAL-CONTROL-FAILURE-TAXONOMY.md`.

Operator preference deferred to the DASH-5.D codification phase. DASH-5.D is DOCS-ONLY; it does not modify runtime code.

## §7 — Sub-phase split

| Sub-phase | Mode | Scope | Risk | Phase ordering |
|---|---|---|---|---|
| **DASH-5.A** (deferred — separately gated) | SAFE IMPLEMENTATION (Mode 4) | `dashboard.js:2281-2286` only — replace live SL JSON-write with `await shadowRecordManualLiveSLUpdate(dbPos, newSL)` + paper-symmetric throw on `!r.ok`. ~+15 ins / -5 del; net +10 lines. | LOW (no Kraken call; helper already exists; paper-symmetric pattern) | Can land before Phase 8 |
| **DASH-5.B** (deferred — separately gated) | SAFE IMPLEMENTATION | `dashboard.js:2307-2312` only — mirror DASH-5.A for TP. ~+15 ins / -5 del; net +10 lines. | LOW (mirror of DASH-5.A) | Can land before Phase 8 |
| **DASH-5.C / Phase 8** (deferred — Phase 8 owns) | DESIGN already done at `D-5-12F-LIVE-SELLALL-DESIGN.md`; future SAFE/HIGH-RISK IMPLEMENTATION | Already covered by Phase 8 = D-5.12f-LIVE-SELLALL-IMPLEMENTATION + Phase 9 = D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP. DASH-5 cross-references the existing record without duplicating. | HIGH (real-money path; ARC-2 Gate 9) | Owned by Phase 8 |
| **DASH-5.D** (deferred — separately gated) | DOCS-ONLY | Codify the failure-class taxonomy from §6 into either `D-5-12F-LIVE-SELLALL-DESIGN.md` §11 or a new SAFE-class doc at `orchestrator/handoffs/LIVE-MANUAL-CONTROL-FAILURE-TAXONOMY.md`. | LOW (docs only; no runtime touch) | Can land before or after Phase 8 |
| **DASH-5.E / Phase 9** (deferred — Phase 9 owns) | HIGH-RISK IMPLEMENTATION (Mode 5) | D-5.12e.1 cleanup of `dashboard.js:2145` payload mutation. Owned by Phase 9 per `D-5-12F-LIVE-SELLALL-DESIGN.md` §10. DASH-5 records the ownership reference; does not re-design. | HIGH-RISK IMPLEMENTATION despite the narrow single-line touch perimeter (per D-5.12f §10 — small diffs in safety-critical post-Kraken emergency-audit code do not get to call themselves low-risk). | Owned by Phase 9 |

**Recommended sequence:**
1. **DASH-5-LIVE-CONTROLS-DESIGN-SPEC** (this current phase) — persist this design as on-disk SAFE-class artifact.
2. **DASH-5.A** (SAFE IMPLEMENTATION) — wire live SL helper. Operator-granted scoped lift on RESTRICTED `dashboard.js` for DASH-5.A only.
3. **DASH-5-A-CLOSEOUT-SYNC** (DOCS-ONLY) — roll-in stale-tail per established pattern.
4. **DASH-5.B** (SAFE IMPLEMENTATION) — wire live TP helper. Separate scoped lift.
5. **DASH-5-B-CLOSEOUT-SYNC** (DOCS-ONLY) — roll-in stale-tail.
6. (Optional) **DASH-5.D** (DOCS-ONLY) — codify failure-class taxonomy.
7. **Phase 8: D-5.12f-LIVE-SELLALL-IMPLEMENTATION** (HIGH-RISK) — separately gated under ARC-2 Gate 9.

## §8 — Future touch lines (exact perimeters by line range)

### DASH-5.A — live SL helper wiring (deferred — separately gated)

**Touch perimeter:** `dashboard.js:2281-2286` only (the live branch of `SET_STOP_LOSS`).

**Before** (current at HEAD `c8b0e3c…`):
```javascript
    // Live path: byte-identical to today (writes position.json directly).
    if (!pos.open) throw new Error("No open position — open a trade first");
    const pct    = parseFloat(params.pct || 1.25);
    pos.stopLoss = pos.entryPrice * (1 - pct / 100);
    writeFileSync(POSITION_FILE, JSON.stringify(pos, null, 2));
    return { ok: true, message: `Stop loss updated to $${pos.stopLoss.toFixed(4)} (-${pct}% from entry $${pos.entryPrice.toFixed(4)})` };
```

**After** (proposed; pseudo-code, paper-symmetric — applied only when DASH-5.A is separately authorized):
```javascript
    // Phase DASH-5.A — DB-canonical live SL update. Helper at dashboard.js:846-903
    // already implemented; this is the call-site wiring. No Kraken interaction;
    // failure ladder collapses to throw-on-DB-failure (paper-symmetric).
    const dbPos = await loadOpenPosition("live");
    if (!dbPos) throw new Error("No open live position to update");
    const pct = parseFloat(params.pct || 1.25);
    const entryPrice = parseFloat(dbPos.entry_price);
    const newSL = entryPrice * (1 - pct / 100);
    const r = await shadowRecordManualLiveSLUpdate(dbPos, newSL);
    if (!r.ok) {
      log.warn("d-5.12c live-helper", `manual SL caller: ${r.reason}`);
      throw new Error(`Manual live SL update not recorded in DB (${r.reason}). Stop loss NOT updated.`);
    }
    return { ok: true, message: `Stop loss updated to $${newSL.toFixed(4)} (-${pct}% from entry $${entryPrice.toFixed(4)})` };
```

**Estimated diff:** ~+15 ins / -5 del. Net +10 lines.
**Excluded:** the helper definition at `:846-903` (RESTRICTED-not-lifted unless a separate helper-edit is needed; the helper is already complete and shouldn't need changes).

### DASH-5.B — live TP helper wiring (deferred — separately gated)

**Touch perimeter:** `dashboard.js:2307-2312` only. Mirror of DASH-5.A.

**Estimated diff:** ~+15 ins / -5 del. Net +10 lines.

### DASH-5.C / Phase 8 — D-5.12f live SELL_ALL implementation (deferred — Phase 8 owns)

**Touch perimeter:** `dashboard.js:2253-2261` plus a new `shadowRecordManualLiveSellAll` helper insertion. Estimated diff per `D-5-12F-LIVE-SELLALL-DESIGN.md`: ~140-155 ins / ~10 del across the SELL_ALL block + a new helper. **NOT designed by DASH-5;** owned by Phase 8.

### DASH-5.D — failure-class taxonomy codification (deferred — separately gated)

**Touch perimeter:** new on-disk SAFE-class doc at `orchestrator/handoffs/LIVE-MANUAL-CONTROL-FAILURE-TAXONOMY.md` OR an extension to `D-5-12F-LIVE-SELLALL-DESIGN.md` §11. **No `dashboard.js` touch.**

### DASH-5.E / Phase 9 — D-5.12e.1 emergency payload mutation cleanup (deferred — Phase 9 owns)

**Touch perimeter:** `dashboard.js:2145` only (a single-line removal of the `attempted_payload.attempted_payload_hash = attempted_payload_hash;` mutation). **NOT designed by DASH-5;** owned by Phase 9.

## §9 — Blocked files and actions (hard-blocked surfaces)

### Hard-blocked during this DOCS-ONLY codification phase

Everything except the 4 named files. No file edits outside `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`, and the new `orchestrator/handoffs/DASH-5-LIVE-CONTROLS-DESIGN.md`. No commits, no pushes, no runtime actions until operator approval.

### Hard-blocked across the entire DASH-5 track

| Excluded | Reason |
|---|---|
| `bot.js` | HARD BLOCK throughout |
| `db.js` | HARD BLOCK throughout (no new DB helper added by DASH-5; existing helpers `shadowRecordManualLiveSLUpdate` at `dashboard.js:846-903` and `shadowRecordManualLiveTPUpdate` at `:906-964` are complete) |
| `migrations/` | HARD BLOCK throughout (no schema change) |
| `scripts/` | RESTRICTED; no scoped lift in DASH-5; per DASH-1 protected-surface list (`DASH-1-READ-STATE-AUDIT.md` lines 409-412) |
| `tests/` | RESTRICTED; DASH-6 territory; per DASH-1 protected-surface list (`DASH-1-READ-STATE-AUDIT.md` lines 409-412) |
| `.nvmrc` | RESTRICTED; no scoped lift in DASH-5; per DASH-1 protected-surface list (`DASH-1-READ-STATE-AUDIT.md` lines 409-412) |
| deploy config | RESTRICTED; no scoped lift in DASH-5; per DASH-1 protected-surface list (`DASH-1-READ-STATE-AUDIT.md` lines 409-412) |
| `position.json` | HARD BLOCK throughout (DASH-5.A/B remove writes from live SL/TP path) |
| `position.json.snap.20260502T020154Z` | HARD BLOCK (pre-existing carve-out) |
| `package.json`, `package-lock.json` | RESTRICTED; no scoped lift in DASH-5 |
| `.env*` | HARD BLOCK forever for automation |
| `MANUAL_LIVE_ARMED` env reads | RESTRICTED-not-lifted in DASH-5; Layer 1 at `:12937` and Layer 2 at `:1847` byte-stable across DASH-5 sub-phases |
| `_emergencyAuditWrite`, `_loglineFallback`, `_redactAttemptedPayload` | RESTRICTED-not-lifted in DASH-5 — DASH-5.A / DASH-5.B do NOT use the emergency-audit ladder (no Kraken call, no real-money movement) |
| All safety-policy docs | HARD BLOCK throughout the DASH track |
| All Hermes templates / runtime | HARD BLOCK; Hermes stays shelved |
| Live BUY at `:1867-2046` | RESTRICTED-not-lifted in DASH-5 (G5.4 closed as no-finding) |
| Live CLOSE_POSITION at `:2049-2223` | RESTRICTED-not-lifted in DASH-5 (D-5.12e mutation cleanup is Phase 9; DASH-5 does not touch) |
| Live SELL_ALL at `:2253-2261` | RESTRICTED-not-lifted in DASH-5 (D-5.12f implementation is Phase 8; DASH-5 does not touch) |
| All paper handlers | RESTRICTED-not-lifted in DASH-5 (paper paths already DB-first per DASH-4 design) |
| Railway CLI / Kraken API / production DB queries / migration application / deploy / Discord post | RED-tier; not pre-authorized |
| Autopilot runtime activation | Phase 11 territory; explicitly NOT activated |

## §10 — Risk notes

### DASH-5-LIVE-CONTROLS-DESIGN-SPEC (this codification phase)

| Risk | Severity | Mitigation |
|---|---|---|
| Live-trading regression | **None** | No code edited |
| Paper-trading regression | **None** | No code edited |
| Future-phase coupling | **None** | Pre-authorizes nothing — all sub-phases separately gated; DASH-5.A is NOT authorized by this codification |

### DASH-5.A (deferred — separately gated)

| Risk | Severity | Mitigation |
|---|---|---|
| Live-trading order-execution regression | **None** | No Kraken call site touched. The change is local to the live SL branch which never makes a Kraken call. |
| DB persistence risk | **Low** | Helper exists and is functionally complete. Failure path is paper-symmetric: throw on `!r.ok` without writing `position.json`. No real-money side-effect on failure. |
| `position.json` consumer breakage | **Low** | Removing the `writeFileSync(POSITION_FILE, ...)` at `:2285` means the front-end legacy `renderPosition` (which reads `position.json` for live-mode display per DASH-3.C drift detection design) won't see the updated SL until either bot.js next reconciliation cycle OR a `position.json` write-out from a separate path. Mitigation: rely on the front-end's existing reconciliation behavior (it polls `/api/v2/dashboard` which is Postgres-first via DASH-3 design). Operator preference: paper-symmetric (no compat write), per the DASH-1 Postgres-canonical contract. |
| `MANUAL_LIVE_ARMED` gate | **None** | The Layer 1 / Layer 2 gates at `:12937` / `:1847` are upstream of `handleTradeCommand`'s SL branch; DASH-5.A inherits the existing gate without modification. |
| Helper race condition (`raceDetected` at `:856` / `:880`) | **Low** | Helper already returns `{ ok: false, reason: "no_open_position" }` on race; caller's throw-on-`!r.ok` covers it cleanly. |

### DASH-5.B (deferred — separately gated)

Mirror of DASH-5.A; same risk profile.

### DASH-5.C / Phase 8 (deferred — Phase 8 owns)

| Risk | Severity | Mitigation |
|---|---|---|
| Real-money order regression | **HIGH** | ARC-2 Gate 9 — explicit per-change Victor approval. Owned by Phase 8 design (`D-5-12F-LIVE-SELLALL-DESIGN.md`). DASH-5 does not advance, alter, or pre-authorize Phase 8. |

### DASH-5.D (deferred — separately gated)

| Risk | Severity | Mitigation |
|---|---|---|
| Doc-spec regression | **None** | DOCS-ONLY phase. No runtime touch. |

### DASH-5.E / Phase 9 (deferred — Phase 9 owns)

**DASH-5.E / Phase 9: D-5.12e.1 emergency payload mutation cleanup at `:2145`. Owned by Phase 9; not duplicated by DASH-5. Risk follows D-5.12f §10: HIGH-RISK IMPLEMENTATION despite the narrow single-line touch perimeter.** Removing `attempted_payload.attempted_payload_hash = attempted_payload_hash` restores hash integrity but the surface is post-Kraken emergency-audit code; safety-critical code in a small diff is not automatically low-risk. Owned by Phase 9 per D-5.12f §10. DASH-5 does not advance, alter, or pre-authorize Phase 9.

## §11 — Codex review history

**Round 1 (DASH-5 design — 2026-05-07) — PASS WITH REQUIRED EDITS** on **3 of 38 checks**: D5, E3, F1. Other 35 checks (A1–A5, B1–B5, C1–C5, D1–D4, E1–E2, F2–F3, G1–G3, H1–H8) PASSed against direct code read of `dashboard.js` at HEAD `c8b0e3c…`.

The round-1 substance findings PASSed:
- All 5 live handlers correctly characterized (G5.1 SELL_ALL DB-bypass, G5.2 SL helper unwired, G5.3 TP helper unwired, G5.4 BUY clean of mutation, G5.5 CLOSE has mutation owned by Phase 9).
- Sub-phase split internally coherent (DASH-5.A SL / DASH-5.B TP / Phase 8 / Phase 9 / DASH-5.D taxonomy).
- Phase ownership map correct (no duplication of Phase 8 or Phase 9).
- Paper-symmetric pattern correctly proposed for SL/TP wiring.

The 3 round-1 FAILs were precision/completeness corrections:

- **D5** — design called Phase 9 "LOW risk (1-line removal)" but `D-5-12F-LIVE-SELLALL-DESIGN.md` §10 already classifies D-5.12e.1 as HIGH-RISK IMPLEMENTATION despite the narrow touch perimeter. Required verbatim text: *"DASH-5.E/Phase 9: D-5.12e.1 emergency payload mutation cleanup at :2145. Owned by Phase 9; not duplicated by DASH-5. Risk follows D-5.12f §10: HIGH-RISK IMPLEMENTATION despite the narrow single-line touch perimeter."*
- **E3** — proposed `db_only_*` taxonomy listed 3 classes (validation_failed / db_error / no_open_position). Both helpers `shadowRecordManualLiveSLUpdate` at `:847` and `shadowRecordManualLiveTPUpdate` at `:907` have an early-return `db_unavailable` path that needs its own named class. Required: add `db_only_db_unavailable` for full 4-class set.
- **F1** — §10 hard-block table didn't explicitly include `scripts/`, `tests/`, `.nvmrc`, deploy config (DASH-1 protected-surface list at lines 409-412). Required: re-cite explicitly.

**Round 2 (DASH-5 design — 2026-05-07) — clean PASS on all 38 checks.** D5 / E3 / F1 all flipped from FAIL to PASS after verbatim corrections. Codex confirmed all DB-bypass identifications by direct read of `dashboard.js` and `db.js`; confirmed live BUY at `:1956-1975` is clean of mutation; confirmed CLOSE mutation lives at `:2145`; confirmed SL helper at `:846-903` and TP helper at `:906-964` are functionally complete-but-unwired; confirmed the 4-class db_only_* taxonomy matches helper early-return paths; confirmed §10 hard-block list is complete; confirmed CEILING-PAUSE / Hermes / Migration 008 / N-3 / approver preservation; confirmed forbidden-content compliance.

## §12 — What this phase does NOT authorize

DASH-5-LIVE-CONTROLS-DESIGN-SPEC (this codification phase) authorizes ONLY:
- Authoring this design record at `orchestrator/handoffs/DASH-5-LIVE-CONTROLS-DESIGN.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`.

DASH-5-LIVE-CONTROLS-DESIGN-SPEC explicitly does NOT authorize:
- **Any DASH-5.A implementation.** Separately gated; requires operator-granted scoped lift on RESTRICTED `dashboard.js` for DASH-5.A only + Codex implementation review + commit + push approvals.
- **Any DASH-5.B implementation.** Separately gated; same approval cascade.
- **Any DASH-5.D codification.** Separately gated; DOCS-ONLY when authorized.
- **Any DASH-5.C / Phase 8 (D-5.12f-LIVE-SELLALL-IMPLEMENTATION) work.** Owned by Phase 8 per master order; ARC-2 Gate 9; HIGH-RISK; not pre-authorized.
- **Any DASH-5.E / Phase 9 (D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP) work.** Owned by Phase 9 per master order; HIGH-RISK; not pre-authorized.
- **Any DASH-6 / Phase 11 (ARC-8-RUN-D) work.** Each separately gated.
- Any edit to `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.nvmrc`, `.env*`, `position.json`, `position.json.snap.20260502T020154Z`, deploy config.
- Any safety-policy doc edit.
- Any Hermes runtime authoring / repo creation / deployment / install resumption.
- Any production action: Railway CLI, Railway env, Railway redeploy, Kraken action (live or otherwise), production DB query / mutation, migration application, `MANUAL_LIVE_ARMED` change, deploy, env / secret read or write, autopilot runtime activation, automation install / widening, Discord post, webhook / scheduler / MCP / cron / Ruflo install.

## §13 — Cross-references

- `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md` — current-phase journal.
- `orchestrator/NEXT-ACTION-SELECTOR.md` — ten ordered selector rules; master-order discipline.
- `orchestrator/PHASE-MODES.md` — six phase modes; Mode 2 (DESIGN-ONLY) for the source design phase, Mode 3 (DOCS-ONLY) for this codification, Mode 4 (SAFE IMPLEMENTATION) for DASH-5.A / DASH-5.B, Mode 5 (HIGH-RISK IMPLEMENTATION) for Phase 8 / Phase 9.
- `orchestrator/PROTECTED-FILES.md` — per-path classification; `dashboard.js` is RESTRICTED (Level 2 at lines 53-73). Lift expires at commit per `:59`.
- `orchestrator/APPROVAL-GATES.md` — 16-gate matrix; Phase 8 binds ARC-2 Gate 9.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules; ARC-8 phase-loop ceiling rule.
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers.
- `orchestrator/HANDOFF-RULES.md` — packet rules; "Forbidden content" list.
- `orchestrator/BLUEPRINT.md` — Critical File Guard; Read-Only First Rule.
- `orchestrator/FIX-PLAN.md` — Postgres-as-only-source-of-truth contract; live-mode gated.
- `orchestrator/handoffs/DASH-1-READ-STATE-AUDIT.md` — canonical Phase 3 inventory; G5.1–G5.5 source.
- `orchestrator/handoffs/ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md` — Phase 2 dashboard stability design.
- `orchestrator/handoffs/DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN.md` — position-display reconciliation rationale.
- `orchestrator/handoffs/DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN.md` — paper-symmetric pattern reference.
- `orchestrator/handoffs/D-5-12F-LIVE-SELLALL-DESIGN.md` — Phase 8 design (live SELL_ALL); §10 records D-5.12e.1 cleanup as separately-gated Phase 9.
