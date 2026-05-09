# DASH-4 — Paper Controls Cleanup Design

> **DOCS-ONLY ARTIFACT.** This document is a design record. It does NOT authorize any code phase, deploy, Kraken action, `MANUAL_LIVE_ARMED` toggle, migration application, production state mutation, autopilot runtime activation, or Relay runtime install. The downstream DASH-4.A implementation sub-phase, the deferred DASH-4.B / DASH-4.C sub-phases, the interleaved D-5.12f impl Phase 8 and D-5.12e.1 cleanup Phase 9, and Phase 11 ARC-8-RUN-D each remain separately gated.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` (per `HANDOFF-RULES.md`). If this document ever conflicts with either canonical source, the canonical source wins.
>
> **No packet substitutes for in-session operator approval** (per `orchestrator/APPROVAL-GATES.md`).

**Codification phase:** `DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN-SPEC`
**Source design phase:** `DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN` (Design-only PASS; Codex round-1 methodology FAIL + round-2 clean PASS on all 38 checks; conversation-only; no commit by the design phase itself)
**Phase mode:** DOCS-ONLY (Mode 3 per `orchestrator/PHASE-MODES.md`)
**Author:** Claude (Lead Engineer / Builder)
**Date:** 2026-05-07
**Status:** DRAFT — pending Codex docs-only review and explicit operator approval before commit.

## §1 — Phase scope and intent

DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN-SPEC persists the Codex round-2 PASS-verified DASH-4 design as a permanent, version-controlled SAFE-class design record. The design itself was a conversation-only DESIGN-ONLY (Mode 2) phase that Codex cleared in round 2 (after the round-1 methodology FAIL was resolved by an explicit pattern-anchor preamble citing the four prior in-cycle conversation-only DESIGN-ONLY phases — ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN, DASH-1-READ-STATE-AUDIT, DASH-2-UI-STABILITY-CLEANUP design, DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN — each of which PASSed conversation-only without an on-disk artifact at review time).

**In scope (this DOCS-ONLY codification phase):**
- Authoring this design record at `orchestrator/handoffs/DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`.

**Out of scope:**
- Any edit to `dashboard.js`, `bot.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.env`, `.env.example`, `.nvmrc`, `position.json`, `position.json.snap.20260502T020154Z`, deploy config.
- Any edit to safety-policy docs (`PROTECTED-FILES.md`, `APPROVAL-GATES.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, `AUTOMATION-PERMISSIONS.md`, `HANDOFF-RULES.md`, `BLUEPRINT.md`, `AUTOPILOT-RULES.md`, `COMM-HUB-RULES.md`, `COMM-HUB-HERMES-RULES.md`, `CLAUDE.md`).
- Any deploy, migration application, Kraken action, `MANUAL_LIVE_ARMED` toggle, env / secret read or write, production DB query or mutation, Railway command, autopilot runtime activation.
- **DASH-4.A implementation is NOT authorized by this codification.** DASH-4.A requires its own separately-gated SAFE IMPLEMENTATION phase with operator-granted scoped lift on RESTRICTED `dashboard.js` for DASH-4.A only + Codex implementation review + commit + push approvals.
- DASH-4.B and DASH-4.C are deferred (see §5).
- Any DASH-5, Phase 8, Phase 9, DASH-6, Phase 11 work. Each separately gated.
- Any Relay runtime authoring / repo creation / deployment / install resumption.

## §2 — Audit context

**HEAD at design time:** `5d0abcb15c008d669e5653b21f4c15091d474aed` (DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN-SPEC landed and pushed; the design record at `orchestrator/handoffs/DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN.md` is canonical and version-controlled).

**Phase state at design time:**
- ARC-8-UNPAUSE CLOSED at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`.
- ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN CLOSED — Design-only PASS.
- ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC CLOSED at `b7ce42fa79b493ae532fe5a5ba89692c4ad6ae89`.
- DASH-1-READ-STATE-AUDIT CLOSED — READ-ONLY AUDIT verdict.
- DASH-1-READ-STATE-AUDIT-SPEC CLOSED at `dcf453acf5d8ee281646cacb07810dcfe5d2850a`.
- DASH-2.A CLOSED at `d6c77af3f203d1e17f6238eb53a7232592dd670d`.
- DASH-2-A-CLOSEOUT-SYNC CLOSED at `dbdda33e9bb4608e7a19d225f872a73d7146db69`.
- DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN CLOSED — Design-only PASS.
- DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN-SPEC CLOSED at `5d0abcb15c008d669e5653b21f4c15091d474aed`.
- DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN CLOSED — Design-only PASS (round-1 methodology FAIL + round-2 clean PASS on all 38 checks).
- Phase-loop counter 0 of 3.
- Autopilot DORMANT. Relay shelved. Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`. N-3 CLOSED. Approvers `{Victor}`.
- Working tree clean except `position.json.snap.20260502T020154Z` pre-existing untracked carve-out.

**`dashboard.js` classification:** RESTRICTED per `PROTECTED-FILES.md:53-73`. The DASH-2.A scoped lift was consumed at commit `d6c77af…` per `PROTECTED-FILES.md:59`. DASH-4.A implementation will require a new operator-granted scoped lift.

## §3 — Paper-handler DB-first verification

Verified by direct read of `dashboard.js` at HEAD `5d0abcb…`. **All 5 paper handlers verified DB-first.**

| Command | Paper-branch lines | Canonical read | Persistence helper | DB-first | Throws on DB failure | `balanceCache=null` after DB write |
|---|---|---|---|:---:|---|:---:|
| BUY / OPEN_LONG | `:1867-1900` | (none — fresh entry) | `shadowRecordManualPaperBuy(entry, newPos)` at `:1889` | ✓ | ✓ — `Manual paper BUY not recorded in DB (${r.reason}). Trade NOT persisted.` | ✗ (defensible — paper BUY does not move Kraken balance) |
| CLOSE_POSITION | `:2050-2074` | `loadOpenPosition("paper")` at `:2052` | `shadowRecordManualPaperClose(exitEntry)` at `:2061` | ✓ | ✓ — `Manual paper CLOSE not recorded in DB (${r.reason}). Position NOT closed.` | ✓ at `:2073` |
| SELL_ALL | `:2227-2251` | `loadOpenPosition("paper")` at `:2229` | `shadowRecordManualPaperClose(exitEntry)` at `:2238` | ✓ | ✓ — `Manual paper SELL_ALL not recorded in DB (${r.reason}). Position NOT closed.` | ✓ at `:2250` |
| SET_STOP_LOSS | `:2265-2280` | `loadOpenPosition("paper")` at `:2269` | `shadowRecordManualPaperSLUpdate(dbPos, newSL)` at `:2274` | ✓ | ✓ — `Manual paper SL update not recorded in DB (${r.reason}). Stop loss NOT updated.` | ✗ (defensible) |
| SET_TAKE_PROFIT | `:2290-2306` | `loadOpenPosition("paper")` at `:2295` | `shadowRecordManualPaperTPUpdate(dbPos, newTP)` at `:2300` | ✓ | ✓ — `Manual paper TP update not recorded in DB (${r.reason}). Take profit NOT updated.` | ✗ (defensible) |

**Conclusion:** the paper-mode persistence contract is sound. There is no DB-first regression to fix. No paper handler bypasses the DB; every successful paper response represents a row written via Phase A.2 / B.1 / B.2b / B.2d helpers.

## §4 — Envelope inconsistency analysis

### §4.1 Success-response field grid

| Handler | `ok` | `message` | `price` | `orderId` | `quantity` | `pnlPct` | `pnlUSD` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| BUY (`:2046`) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| CLOSE_POSITION (`:2074`) | ✓ | ✓ | ✓ | ✓ | **✗** | ✓ | ✓ |
| SELL_ALL (`:2251`) | ✓ | ✓ | ✓ | ✓ | **✓** | ✓ | ✓ |
| SET_STOP_LOSS (`:2279`) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| SET_TAKE_PROFIT (`:2305`) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### §4.2 Inconsistencies identified

- **I1 (concrete envelope drift):** paper `CLOSE_POSITION` lacks `quantity` while paper `SELL_ALL` includes it. Both commands close paper positions and call the same persistence helper (`shadowRecordManualPaperClose`); they should return the same shape. The variable `quantity` is already in scope at `:2056` (CLOSE) and `:2233` (SELL_ALL), so this is purely an envelope omission.
- **I2 (defensible asymmetry, low priority):** paper `BUY` returns no P&L fields. P&L at entry is by definition 0; not returning the field is OK but inconsistent. Lower priority.
- **I3 (defensible asymmetry, low priority):** SL/TP responses have only `ok` + `message`. The handlers know `entryPrice` (and the new SL/TP price); UI could surface them as fields rather than parsing the human-readable message. Lower priority.
- **I4 (low priority):** error throw messages have wording drift but consistent shape (`throw new Error(string)` across all 5 handlers; same `log.warn("d-5.7.1 dual-write", ...)` label); no structured `errorCode` field.

### §4.3 Exit-entry helper input shape (CLOSE vs SELL_ALL)

The `exitEntry` object passed to `shadowRecordManualPaperClose` differs between CLOSE and SELL_ALL only in `exitReason` (`"MANUAL_CLOSE"` vs `"MANUAL_SELLALL"`) and `orderId` prefix (`PAPER-SELL-` vs `PAPER-SELLALL-`). All other fields identical. Consistent — no fix needed.

## §5 — Proposed sub-phase split

| Sub-phase | Mode | Scope | Ins/del estimate | Risk | Notes |
|---|---|---|---|---|---|
| **DASH-4.A** (deferred — separately gated) | SAFE IMPLEMENTATION (Mode 4) | `dashboard.js:2074` only — add `quantity` to the paper CLOSE_POSITION return object so it matches paper SELL_ALL's envelope shape. Touch perimeter is exactly 1 line. | +1 ins / -1 del (or +1 ins / 0 del depending on placement) | LOW | Addresses **I1**. `quantity` is already computed at `:2056` from the DB row. No new helper, no new code path, no new DB call. Symmetric with paper SELL_ALL. |
| **DASH-4.B** (deferred indefinitely) | SAFE IMPLEMENTATION | Optional: add `entryPrice` + new SL/TP price as structured fields to SET_STOP_LOSS / SET_TAKE_PROFIT responses, while preserving `message` byte-stable. | ~+4 ins / 0 del | LOW | Addresses **I3**. Deferred — UI doesn't currently consume those fields; landing this without a UI-side consumer is dead code. |
| **DASH-4.C** (deferred indefinitely) | SAFE IMPLEMENTATION | Optional: add structured `errorCode` field via custom `Error` subclass or `{ ok: false, errorCode, reason, message }` return shape across all 5 paper handlers. | ~+15 ins / -5 del | MEDIUM | Addresses **I4**. Deferred indefinitely — current message-string approach works for the current human-operator UI; structured error codes only pay off once an automated consumer (e.g., autopilot Loop D in Phase 11) needs to branch on them. |

**Recommended sequence:** land **DASH-4.A only** as the narrowest safe sub-phase. DASH-4.B / DASH-4.C remain deferred and gated on actual UI/consumer demand.

## §6 — DASH-4.A touch perimeter (exact)

**Before** (`dashboard.js:2074` at HEAD `5d0abcb…`):
```javascript
return { ok: true, message: `Position closed — P&L: ${pnlPct}% ($${pnlUSD}) | Paper SELL at $${price.toFixed(4)}`, price, orderId: exitOrderId, pnlPct, pnlUSD };
```

**After** (proposed, applied only when DASH-4.A is separately authorized):
```javascript
return { ok: true, message: `Position closed — P&L: ${pnlPct}% ($${pnlUSD}) | Paper SELL at $${price.toFixed(4)}`, price, orderId: exitOrderId, quantity, pnlPct, pnlUSD };
```

**Net change:** insert `quantity, ` after `orderId: exitOrderId, `. **+1 net character cluster on a single line.** No control-flow change, no DB call change, no `position.json` interaction, no Kraken interaction, no `balanceCache` change. `quantity` is already a `const` at `:2056`.

## §7 — Live-path exclusion enumeration

**Every live branch is excluded from this design and from any DASH-4 sub-phase.** Specifically:

| Command | Live-branch lines | Excluded from DASH-4 |
|---|---|:---:|
| BUY (live) | `dashboard.js:1901-2045` | ✓ |
| CLOSE_POSITION (live) | `dashboard.js:2076-2223` | ✓ |
| SELL_ALL (live) | `dashboard.js:2253-2261` | ✓ |
| SET_STOP_LOSS (live) | `dashboard.js:2281-2286` | ✓ |
| SET_TAKE_PROFIT (live) | `dashboard.js:2307-2312` | ✓ |

DASH-1 audit's G5.1 (live SELL_ALL DB persistence) is owned by D-5.12f / Phase 8. G5.2 (live SL unwired) and G5.3 (live TP unwired) are owned by DASH-5 / Phase 8 / Phase 9. G5.4 (live BUY 10-key mutation re-audit) is owned by DASH-5. **DASH-4 does not touch any live path.**

## §8 — Hard-blocked surfaces

### Hard-blocked during this DOCS-ONLY codification phase

Everything except the 4 named files. No file edits outside `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`, and the new `orchestrator/handoffs/DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN.md`. No commits, no pushes, no runtime actions until operator approval.

### Hard-blocked across the entire DASH-4 track (DASH-4.A and any future DASH-4.B / DASH-4.C step)

| Excluded | Reason |
|---|---|
| `bot.js` | HARD BLOCK throughout |
| `db.js` | HARD BLOCK throughout (no new DB helper added by any DASH-4 sub-phase) |
| `migrations/` | HARD BLOCK throughout (no schema change) |
| `position.json` | HARD BLOCK throughout (paper handlers don't write it; DASH-4.A doesn't either) |
| `position.json.snap.20260502T020154Z` | HARD BLOCK throughout (pre-existing untracked carve-out) |
| `package.json`, `package-lock.json`, `.nvmrc` | RESTRICTED; no scoped lift granted in DASH-4 |
| `.env*` | HARD BLOCK forever for automation |
| All safety-policy docs | HARD BLOCK throughout the DASH track |
| All Relay templates / runtime | HARD BLOCK; Relay stays shelved |
| `tests/*.spec.js` | RESTRICTED; DASH-6 territory |
| Live BUY / CLOSE / SELL_ALL / SL / TP handlers | RESTRICTED-not-lifted in DASH-4 (DASH-5 / Phase 8 / Phase 9 territory) |
| `MANUAL_LIVE_ARMED` env reads | RESTRICTED-not-lifted in DASH-4 |
| Emergency-audit code (`_emergencyAuditWrite`, `_loglineFallback`, `_redactAttemptedPayload`) | RESTRICTED-not-lifted in DASH-4 |
| Railway CLI / Kraken API / production DB queries / migration application / deploy / Discord post | RED-tier; not pre-authorized |
| Autopilot runtime activation | Phase 11 territory; explicitly NOT activated |

## §9 — Risk assessment

### DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN-SPEC (this codification phase)

| Risk | Severity | Mitigation |
|---|---|---|
| Live-trading regression | **None** | No code edited. |
| Paper-trading regression | **None** | No code edited. |
| UI regression | **None** | No code edited. |
| Future-phase coupling | **None** | Pre-authorizes nothing — DASH-4.A is separately gated. |

### DASH-4.A (deferred — separately gated)

| Risk | Severity | Mitigation |
|---|---|---|
| Live-trading regression | **None** | The change is in the paper branch only (paper CLOSE_POSITION return at `:2074`). No live code path is touched. No `paperTrading === false` branch is reached. |
| Paper-trading persistence regression | **None** | No DB write path, no DB helper, no `loadOpenPosition` call site is modified. The existing `await shadowRecordManualPaperClose(exitEntry)` at `:2061` is unchanged. |
| Front-end consumer breakage | **Low** | `quantity` is an additive field. Front-end consumers of paper CLOSE_POSITION today read `{ ok, message, price, orderId, pnlPct, pnlUSD }`; adding an unread field cannot break them. |
| Symmetry verification | **None** | Paper SELL_ALL already returns `quantity` at `:2251`; the same `quantity` const exists at both call sites. |
| Test impact | **None** | No existing Playwright spec asserts paper CLOSE_POSITION response field set. |

### DASH-4.B / DASH-4.C (deferred indefinitely)

| Risk | Severity | Mitigation |
|---|---|---|
| Premature implementation without UI consumer | **Medium** | Defer until a UI-side or autopilot Loop D consumer exists. Codify here so the rationale is preserved, but do not implement. |

## §10 — Codex review history

**Round 1 (DASH-4 design — 2026-05-07) — FAIL** on B1 / B2 / C1-C6 / D1-D6 / E1-E3 (17 checks). All FAILs were methodology-only — Codex looked for an on-disk DASH-4 design artifact and could not find one. Substance checks A1-A7 (DB-first verification), B3 (exit-entry shape symmetry), and F1-F8 (forbidden-content compliance) all PASSed against direct code read of `dashboard.js` at HEAD `5d0abcb…`. Codex's own operator note: *"The FAIL is a review-methodology failure, not a code correctness failure."*

**Resolution:** the operator authorized a round-2 re-send with an explicit pattern-anchor preamble citing the four prior in-cycle conversation-only DESIGN-ONLY phases that PASSed without on-disk artifacts at review time:
- ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN — Codex round-2 PASS on all 24 checks; on-disk codification followed at ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC commit `b7ce42f…`.
- DASH-1-READ-STATE-AUDIT — conversation-only READ-ONLY AUDIT; on-disk codification followed at DASH-1-READ-STATE-AUDIT-SPEC commit `dcf453a…`.
- DASH-2-UI-STABILITY-CLEANUP design — Codex round-2 PASS on all 30 checks; implementation followed at DASH-2.A commit `d6c77af…`.
- DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN — Codex round-2 PASS on all 31 checks; on-disk codification followed at DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN-SPEC commit `5d0abcb…`.

The preamble explicitly framed the packet body itself as the reviewable design artifact for DESIGN-ONLY phases, with on-disk codification following the design PASS rather than preceding it.

**Round 2 (DASH-4 design — 2026-05-07) — clean PASS on all 38 checks** (A1-A7, B1-B3, C1-C6, D1-D6, E1-E3, F1-F8). No required edits. Codex confirmed all DB-first claims by direct read of `dashboard.js` and `db.js`; confirmed the I1 envelope discrepancy at `:2074` vs `:2251`; confirmed `quantity` is already declared at `:2056`; confirmed exit-entry shape symmetry between CLOSE and SELL_ALL except `exitReason` and `orderId` prefix; confirmed DASH-4.A is exactly 1 additive line at `:2074` with no new control flow / DB call / helper / file write / Kraken call / `balanceCache` change; confirmed DASH-4.B and DASH-4.C are properly deferred; confirmed all live branch line ranges; confirmed hard-block set; confirmed CEILING-PAUSE / Relay / Migration 008 / N-3 / approver preservation; confirmed forbidden-content compliance.

## §11 — Path A vs Path B

After Codex round-2 PASS, the operator faced a decision:

- **Path A (chosen):** open `DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN-SPEC` as a DOCS-ONLY phase to persist the design as on-disk SAFE-class artifact (this current phase). Provides a stable on-disk reference for future DASH-4.A implementation review. Matches the prior in-cycle pattern (ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC, DASH-1-READ-STATE-AUDIT-SPEC, DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN-SPEC).
- **Path B (rejected/deferred):** skip on-disk codification and go directly to DASH-4.A SAFE IMPLEMENTATION. Saves one commit cycle but loses the on-disk reference; future Codex reviews would need the pattern-anchor preamble each time. Operator chose Path A.

This document IS the Path A persistence step. **DASH-4.A implementation is NOT authorized by this codification.** DASH-4.A requires its own separately-gated SAFE IMPLEMENTATION phase with operator-granted scoped lift on RESTRICTED `dashboard.js` for DASH-4.A only + Codex implementation review + commit + push approvals.

## §12 — Cross-references

- `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md` — current-phase journal.
- `orchestrator/NEXT-ACTION-SELECTOR.md` — ten ordered selector rules; master-order discipline.
- `orchestrator/PHASE-MODES.md` — six phase modes; Mode 2 (DESIGN-ONLY) for the source design phase, Mode 3 (DOCS-ONLY) for this codification, Mode 4 (SAFE IMPLEMENTATION) for DASH-4.A.
- `orchestrator/PROTECTED-FILES.md` — per-path classification; `dashboard.js` is RESTRICTED (Level 2 at lines 53-73). Lift expires at commit per `:59`.
- `orchestrator/APPROVAL-GATES.md` — 16-gate matrix.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules; ARC-8 phase-loop ceiling rule.
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers.
- `orchestrator/HANDOFF-RULES.md` — packet rules; "Forbidden content" list.
- `orchestrator/BLUEPRINT.md` — Critical File Guard; Read-Only First Rule.
- `orchestrator/FIX-PLAN.md` — Postgres-as-only-source-of-truth contract; paper-mode immediate / live-mode gated.
- `orchestrator/handoffs/DASH-1-READ-STATE-AUDIT.md` — canonical Phase 3 inventory; G2.5 / G4.x / G5.1-G5.4 source.
- `orchestrator/handoffs/ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md` — Phase 2 dashboard stability design (already canonical).
- `orchestrator/handoffs/DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN.md` — Phase 5 design (DASH-3.A done at this codification's HEAD; DASH-3.B / DASH-3.C deferred).
- `orchestrator/handoffs/D-5-12F-LIVE-SELLALL-DESIGN.md` — Phase 8 design (live SELL_ALL only; not contradicted by DASH-4).

## §13 — Authorization scope

DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN-SPEC (this codification phase) authorizes ONLY:
- Authoring this design record at `orchestrator/handoffs/DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`.

DASH-4-PAPER-CONTROLS-CLEANUP-DESIGN-SPEC explicitly does NOT authorize:
- Any DASH-4.A implementation. Separately gated; requires operator-granted scoped lift on RESTRICTED `dashboard.js` for DASH-4.A only + Codex implementation review + commit + push approvals.
- Any DASH-4.B implementation. Deferred indefinitely; would require a separate phase open + design re-review + same approval cascade.
- Any DASH-4.C implementation. Deferred indefinitely; same.
- Any DASH-5, Phase 8, Phase 9, DASH-6, Phase 11 work. Each separately gated.
- Any edit to `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.nvmrc`, `.env*`, `position.json`, `position.json.snap.20260502T020154Z`, deploy config.
- Any safety-policy doc edit.
- Any Relay runtime authoring / repo creation / deployment / install resumption.
- Any production action: Railway CLI, Railway env, Railway redeploy, Kraken action (live or otherwise), production DB query / mutation, migration application, `MANUAL_LIVE_ARMED` change, deploy, env / secret read or write, autopilot runtime activation, automation install / widening, Discord post, webhook / scheduler / MCP / cron / Ruflo install.
