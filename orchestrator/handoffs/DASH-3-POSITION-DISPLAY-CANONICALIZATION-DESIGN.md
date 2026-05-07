# DASH-3 — Position Display Canonicalization Design

> **DOCS-ONLY ARTIFACT.** This document is a design record. It does NOT authorize any code phase, deploy, Kraken action, `MANUAL_LIVE_ARMED` toggle, migration application, production state mutation, autopilot runtime activation, or Hermes runtime install. Every downstream DASH-3 sub-phase (DASH-3.B, DASH-3.C), the interleaved D-5.12f impl Phase 8 and D-5.12e.1 cleanup Phase 9, and Phase 11 ARC-8-RUN-D each remain separately gated.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` (per `HANDOFF-RULES.md`). If this document ever conflicts with either canonical source, the canonical source wins.
>
> **No packet substitutes for in-session operator approval** (per `orchestrator/APPROVAL-GATES.md`).

**Codification phase:** `DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN-SPEC`
**Source design phase:** `DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN` (DASH-3.A; Design-only PASS, Codex round-2 clean PASS on all 31 checks; conversation-only; no commit by the design phase itself)
**Phase mode:** DOCS-ONLY (Mode 3 per `orchestrator/PHASE-MODES.md`)
**Author:** Claude (Lead Engineer / Builder)
**Date:** 2026-05-07
**Status:** DRAFT — pending Codex docs-only review and explicit operator approval before commit.

## §1 — Phase scope and intent

DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN-SPEC persists the Codex-PASS-verified DASH-3 design as a permanent, version-controlled SAFE-class design record. The design itself was a conversation-only DESIGN-ONLY (Mode 2) phase that Codex cleared in round 2 (after the DASH-2-A-CLOSEOUT-SYNC commit at `dbdda33…` resolved the round-1 A2/A3 journal-staleness blocker, and after the proposal body was extended with the F4 gap-to-DASH map). This DOCS-ONLY phase persists the corrected design as on-disk reference for the downstream DASH-3.B and DASH-3.C implementation sub-phases.

**In scope (this DOCS-ONLY codification phase):**
- Authoring this design record at `orchestrator/handoffs/DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`.

**Out of scope:**
- Any edit to `dashboard.js`, `bot.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.env`, `.env.example`, `.nvmrc`, `position.json`, `position.json.snap.20260502T020154Z`, deploy config.
- Any edit to safety-policy docs (`PROTECTED-FILES.md`, `APPROVAL-GATES.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, `AUTOMATION-PERMISSIONS.md`, `HANDOFF-RULES.md`, `BLUEPRINT.md`, `AUTOPILOT-RULES.md`, `COMM-HUB-RULES.md`, `COMM-HUB-HERMES-RULES.md`, `CLAUDE.md`).
- Any deploy, migration application, Kraken action, `MANUAL_LIVE_ARMED` toggle, env / secret read or write, production DB query or mutation, Railway command, autopilot runtime activation.
- Any DASH-3.B or DASH-3.C implementation. Each separately gated.
- Any DASH-4, DASH-5, Phase 8, Phase 9, DASH-6, Phase 11 work. Each separately gated.
- Any Hermes runtime authoring / repo creation / deployment / install resumption.

## §2 — Audit context

**HEAD at design time:** `dbdda33e9bb4608e7a19d225f872a73d7146db69` (DASH-2-A-CLOSEOUT-SYNC landed and pushed; the commit that resolved the DASH-3 design round-1 A2/A3 journal-staleness blocker by recording DASH-1-READ-STATE-AUDIT-SPEC closure at `dcf453a…` and DASH-2.A closure at `d6c77af…` in the canonical journal).

**Phase state at design time:**
- ARC-8-UNPAUSE CLOSED at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`.
- ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN CLOSED — Design-only PASS.
- ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC CLOSED at `b7ce42fa79b493ae532fe5a5ba89692c4ad6ae89`.
- DASH-1-READ-STATE-AUDIT CLOSED — READ-ONLY AUDIT verdict.
- DASH-1-READ-STATE-AUDIT-SPEC CLOSED at `dcf453acf5d8ee281646cacb07810dcfe5d2850a`.
- DASH-2.A CLOSED at `d6c77af3f203d1e17f6238eb53a7232592dd670d`.
- DASH-2-A-CLOSEOUT-SYNC CLOSED at `dbdda33e9bb4608e7a19d225f872a73d7146db69`.
- Phase-loop counter 0 of 3.
- Autopilot DORMANT. Hermes shelved. Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`. N-3 CLOSED. Approvers `{Victor}`.
- Working tree clean except `position.json.snap.20260502T020154Z` pre-existing untracked carve-out.

**`dashboard.js` classification:** RESTRICTED per `PROTECTED-FILES.md:53-73`. The DASH-2.A scoped lift was consumed at commit `d6c77af…` per `PROTECTED-FILES.md:59`. Any DASH-3.B or DASH-3.C implementation step requires a new operator-granted scoped lift.

**Note on dashboard.js line numbers:** all `dashboard.js` line numbers in this document are post-DASH-2.A (HEAD `dbdda33…`). The DASH-1 audit's numbers were at HEAD `dcf453a…` and shifted by +6 lines for everything past the DASH-2.A insertion at `:88-92`.

## §3 — DASH-1 gap-to-DASH map (F4 fix)

| DASH-1 audit gap | DASH-3 sub-phase coverage | Notes |
|---|---|---|
| **G3.1** — `position.json` read at startup; surface drift visibly when DB ↔ JSON disagree | **DASH-3.C** (deferred) — server-side live-mode drift detection in `modeScopedSummary` at `dashboard.js:1378-1417` + v2 `renderPosition` badge at `dashboard.js:10797-10815` | Drift detection is read-only; live-mode only; requires `dbAvailable()` to avoid false positives |
| **G3.2** — All 5 dashboard data routes use the same Postgres-first position read | **DASH-3.B** (deferred) — `getApiData` JSON-fallback consolidation at `dashboard.js:1272-1275` | Already largely mitigated via D-5.8.1 (Phase D-5.8.1 already moved `/api/v2/dashboard`'s top-level position read from `position.json` to `summary.position` via `_loadModeFromDb`); remaining work is consolidating the duplicate JSON-fallback in `getApiData` |
| **G3.3** — Two `renderPosition` definitions need unified data shape contract | **DASH-3.B / DASH-3.C** (server-side data-shape contract; do NOT extract legacy `renderPosition`) | Legacy `renderPosition` at `:5453` lives inside `const HTML` template literal at `:3169-7741`; template-escape risk is HIGH; the data-shape contract is enforced server-side via `summary.position` so both renderers consume the same shape without touching the legacy template |
| **G3.4** — Mode-mismatch detection across 9 HTML generators | **Already mostly mitigated** by `modeScopedSummary`'s `position: isActive ? position : null` + `positionUnavailableReason` fields; verify renderer handling in DASH-3.C | The 5 generators that don't render position (`loginPage`, `twoFaPage`, `liveReadinessHTML`, `dashboardV2BackupHTML`, `dashboardCombinedHTML`) are unaffected; verification is read-only |
| **G2.x** — All five DASH-1 G2.x gaps (G2.1 `renderPosition` drift, G2.2 polling intervals, G2.3 cache-bust, G2.4 `dashboardCombinedHTML` regex composer, G2.5 paper handler envelope) | **DASH-2 family**, NOT DASH-3 | G2.3 was addressed by DASH-2.A (deploy-identity observability); G2.1 / G2.2 / G2.4 / G2.5 remain deferred to future DASH-2.B/C/D or DASH-4 sub-phases |
| **G4.x** — All paper-handler-envelope gaps | **DASH-4** (paper controls cleanup), NOT DASH-3 | Separately gated; DASH-3 does not touch any paper handler |
| **G5.x** — All live-control gaps (G5.1 SELL_ALL, G5.2 SL helper unwired, G5.3 TP helper unwired, G5.4 BUY 10-key mutation re-audit, G5.5 failure-class taxonomy) | **DASH-5 / Phase 8 / Phase 9**, NOT DASH-3 | DASH-3 does not touch any live-control persistence; DASH-3.C reads `position.json` for drift detection only, never writes |
| **G6.x** — DASH-6 smoke harness scope refinement | **DASH-6**, NOT DASH-3 | The new `deploy` field added by DASH-2.A is a candidate for DASH-6 contract assertion; DASH-3.C drift detection field would also be a candidate; DASH-3 does not touch `tests/` |

## §4 — G3.1–G3.4 re-evaluation findings

### G3.1 — `position.json` read at startup; surface drift visibly when DB ↔ JSON disagree

**Confirmed.** `position.json` is read at:
- `:1273` (in `getApiData` JSON-fallback branch)
- `:1415` (in `modeScopedSummary` JSON-fallback branch)
- `:1853` (entry to `handleTradeCommand`)

Plus 5 writes at `:1925` (live BUY), `:2107` (live CLOSE), `:2259` (live SELL_ALL), `:2285` (live SL), `:2311` (live TP) — three of which bypass DB persistence per DASH-1 F2.

**Drift surface:** live SELL_ALL / SL / TP write `position.json` directly without DB persistence. After such a write, Postgres `positions.status='open'` while `position.json.open === false` (or vice versa). Currently no UI surface flags this.

### G3.2 — All 5 dashboard data routes use the same Postgres-first position read

**Largely confirmed; partial divergence found.**

| Route | Composer | Position source | Postgres-first? |
|---|---|---|---|
| `/api/v2/dashboard` (`:1520`) | `buildV2DashboardPayload` | `summary.position` (via `getPaperSummary` / `getLiveSummary` → `modeScopedSummary` → `_loadModeFromDb`) | YES |
| `/api/data` (`:1163`) | `getApiData` | `_loadModeFromDb(activeMode)` when `dbAvailable()`; else direct `position.json` read at `:1273` | YES (with JSON fallback) |
| `/api/home-summary` (`:1288`) | `getHomeSummary` | **No top-level `position` field** (homepage cards show balance/W/L/P&L only) | N/A — does not surface position |
| `/api/paper-summary` (`:1459`) | `getPaperSummary` | `base.position` via `modeScopedSummary(true)` → `_loadModeFromDb("paper")` | YES |
| `/api/live-summary` (`:1478`) | `getLiveSummary` | `base.position` via `modeScopedSummary(false)` → `_loadModeFromDb("live")` | YES |

**Analysis:**
- `modeScopedSummary` (`:1352`) is the central composer used by 4 of the 5 routes.
- `getApiData` has its own JSON-fallback branch at `:1273` parallel to but separate from `modeScopedSummary`'s at `:1415`. Two fallback code paths for the same purpose.
- The Postgres-first contract is **already in place** via D-5.8.1 (per the comment at `:1544-1549`: *"Phase D-5.8.1 — top-level position now uses `summary.position`… Previously this re-read `position.json`…"*).

**Remaining G3.2 work:** narrow — verify the JSON-fallback paths at `:1273` and `:1415` return the same field shape; consolidate to one fallback in DASH-3.B.

### G3.3 — Two `renderPosition` definitions need unified data shape contract

**Confirmed.** Two definitions:

| Function | Location | Container | Consumed fields | Renders into |
|---|---|---|---|---|
| Legacy `renderPosition(position, currentPrice)` | `:5453-5521+` | INSIDE `const HTML` template literal at `:3169-7741` | `open`, `entryPrice`, `tradeSize`, `stopLoss`, `takeProfit`, `leverage`, `side`, `entryTime` | `position-card`, `position-badge`, `position-body` DOM ids |
| v2/mode-pages `renderPosition(position, latest)` | `:10797-10815` | Module-level (regular JS function) | `open`, `side`, `entryPrice`, `stopLoss`, `takeProfit`, `leverage`, `entryTime` | `pos-body` DOM id |

**Critical risk:** the legacy function lives inside the `const HTML` template literal (`:3169-7741`). Editing inside that template requires maintaining the escape level (`\${...}`, `\``). Risk: HIGH for any structural edit.

**Resolution:** server-side data-shape contract via `summary.position` ensures both renderers receive the same shape. DASH-3.B's JSON-fallback consolidation reinforces this. DASH-3.C's drift-badge field adds an optional read-only flag both renderers can consume (or ignore). Legacy `renderPosition` extraction is **deferred indefinitely** — the data-shape contract is enforced server-side without touching the legacy template.

### G3.4 — Mode-mismatch detection across 9 HTML generators

**Already partially mitigated.** `modeScopedSummary` returns `position: isActive ? position : null` — surfaces position only when bot mode matches the requested route's mode. When mode mismatches, `position` is null and `positionUnavailableReason` is set.

The 9 HTML generators consume position via the central composer pipelines (G3.2). Mode-mismatch is therefore handled server-side. The remaining work is ensuring the renderers display `positionUnavailableReason` cleanly in all 9 generators — but only the generators that actually render position (not all 9 do: `loginPage`, `twoFaPage`, `liveReadinessHTML`, `dashboardV2BackupHTML`, `dashboardCombinedHTML` don't render position cards directly).

## §5 — Sub-phase split

| Sub-phase | Mode | Scope | Lift required | Risk |
|---|---|---|---|---|
| **DASH-3.A** (this design + this codification = DASH-3-DESIGN + DASH-3-DESIGN-SPEC) | DESIGN-ONLY (Mode 2) for the design step; DOCS-ONLY (Mode 3) for this codification | Conversation-only design + audit + this on-disk persistence. No code touched. | None (no code touched; status docs are SAFE class) | None |
| **DASH-3.B** (deferred — separate scoped lift required) | SAFE IMPLEMENTATION (Mode 4) | Server-side payload contract normalization. Touch perimeter: `dashboard.js` `getApiData` JSON-fallback at `:1272-1275` only. Goal: consolidate `getApiData`'s direct `position.json` read at `:1273` to delegate to `modeScopedSummary` (which has the same fallback at `:1415`), eliminating the duplicate fallback path. Estimated diff ~5 ins, ~5 del; possibly net 0. | Operator-granted scoped lift on RESTRICTED `dashboard.js` for DASH-3.B only | LOW |
| **DASH-3.C** (deferred — separate scoped lift required) | SAFE IMPLEMENTATION (Mode 4) | Server-side drift detection + v2 `renderPosition` badge. Touch perimeter: `dashboard.js` `modeScopedSummary` (`:1352`) for live-mode drift detection helper + v2 `renderPosition` (`:10797-10815`) for badge rendering. Adds `position._dbJsonDriftDetected` boolean + `position._dbJsonDriftReason` string when live mode + DB and JSON disagree. v2 `renderPosition` reads the field and renders a small "⚠ drift" badge. **Legacy `renderPosition` at `:5453` NOT touched** (template-escape risk). Estimated diff ~20-35 ins, 0 del. | Operator-granted scoped lift on RESTRICTED `dashboard.js` for DASH-3.C only | MEDIUM |

**Notably NOT included as a DASH-3 sub-phase:** legacy `renderPosition` extraction / unification. The legacy `:5453` definition's location inside the `const HTML` template literal `:3169-7741` makes any structural edit HIGH risk. Recommendation: defer indefinitely. Both functions already consume mostly-aligned field shapes; unification adds little value and introduces template-escape risk.

## §6 — Touch perimeters (deferred sub-phases)

### DASH-3.B (deferred — separate scoped lift required)

| Region | Lines | Change |
|---|---|---|
| `getApiData` JSON-fallback branch | `dashboard.js:1272-1275` | Replace direct `position.json` read with delegation to `modeScopedSummary` so JSON fallback path lives in exactly one place. ~5 ins / ~5 del. Net: -0 to -3 lines. |

### DASH-3.C (deferred — separate scoped lift required)

| Region | Lines | Change |
|---|---|---|
| `modeScopedSummary` live-mode branch | `dashboard.js:1378-1417` | Add live-mode drift detection: read `position.json` once and compare against `_loadModeFromDb("live").position`; set `position._dbJsonDriftDetected` boolean + `position._dbJsonDriftReason` string when fields diverge or open/closed mismatch. ~15-25 ins, 0 del. |
| v2 `renderPosition` body | `dashboard.js:10797-10815` | Add a small drift badge render (e.g., `<div class="drift-badge">⚠ DB ↔ JSON drift: <reason></div>`) when `position._dbJsonDriftDetected === true`. ~5-10 ins, 0 del. |

**Legacy `renderPosition` at `:5453` NOT touched** — drift badge appears only in the v2 / mode-pages / homepage path, not in `/dashboard-legacy`. Acceptable because `/dashboard-legacy` is a sunset surface.

## §7 — Risk assessment

### DASH-3.A (this turn = the design phase + this codification)

| Risk | Severity | Mitigation |
|---|---|---|
| Live-trading regression | **None** | No code edited. |
| Paper-trading regression | **None** | No code edited. |
| UI regression | **None** | No code edited. |
| Future-phase coupling | **None** | Pre-authorizes nothing. |

### DASH-3.B (deferred)

| Risk | Severity | Mitigation |
|---|---|---|
| Live-trading regression | **None** | No `paperTrading===false` code path touched. The JSON-fallback branch in `getApiData` runs only when `!dbAvailable()`. |
| Paper-trading regression | **Low** | The fallback path's behavior must match `modeScopedSummary`'s fallback at `:1415` byte-for-byte for the position field. Codex impl review verifies parity. |
| `/api/data` response shape break | **Low** | `position` field shape preserved; the only change is the source-side dedup. |
| Mode-mismatch detection | **None** | `modeScopedSummary` already handles `isActive` filtering. |

### DASH-3.C (deferred)

| Risk | Severity | Mitigation |
|---|---|---|
| Live-trading regression | **None** | Drift detection is read-only; no write paths touched. No Kraken call, no `position.json` write. |
| Drift detection latency | **Low** | One additional `existsSync` + `readFileSync` per `modeScopedSummary("live")` call when DB is available. Sub-ms. |
| False-positive drift signaling | **Medium** | Drift comparison must tolerate the legitimate "position.json wiped on Railway redeploy" case (covered by D-5.8.1 comment). Mitigation: live-mode only AND require `dbAvailable()`. |
| v2 `renderPosition` UI break | **Low** | Additive badge; missing fields read as `undefined` and the badge defaults to hidden. |
| Legacy `renderPosition` divergence | **Acceptable** | Legacy `/dashboard-legacy` won't show the badge. Sunset surface. |
| Mode-mismatch false positive | **Low** | Drift check runs only when bot mode matches requested mode (`isActive === true`). |

## §8 — Codex review history

**Round 1 (DASH-3 design — 2026-05-07) — FAIL** on 3 of 31 checks: A2, A3 (canonical journal docs were stale relative to git history; DASH-2.A's closure was not yet recorded in `STATUS.md` / `CHECKLIST.md` / `NEXT-ACTION.md`), F4 (proposal body did not include an explicit DASH-1 gap-to-DASH map). Codex correctly refused to PASS until the journal was brought into alignment with `git log` and the gap map was added.

**Resolution chain:** the DASH-2-A-CLOSEOUT-SYNC phase was opened to roll in two stale-tail closures (DASH-1-READ-STATE-AUDIT-SPEC closure at `dcf453a…` + DASH-2.A closure at `d6c77af…`) in a single DOCS-ONLY commit. That phase went through 3 Codex review rounds:
- Round 1 PASS WITH REQUIRED EDITS on A2/A3/A4 (stale "in progress" markers in deeply-historical text), B6/C2 (HARD BLOCK vs RESTRICTED terminology), F4 (current-state internal consistency).
- Round 2 PASS WITH REQUIRED EDITS on B6/C2 (one missed site for the terminology fix).
- Round 3 clean PASS on all 31 checks.

The closeout-sync committed at `dbdda33e9bb4608e7a19d225f872a73d7146db69` and pushed to origin/main with three-way SHA consistency PASS verified post-push. The canonical journal at HEAD `dbdda33…` now accurately reflects DASH-1-READ-STATE-AUDIT-SPEC closure at `dcf453a…`, DASH-2.A closure at `d6c77af…`, and DASH-2-A-CLOSEOUT-SYNC closure at `dbdda33…`.

**Round 2 (DASH-3 design — 2026-05-07) — clean PASS on all 31 checks.** A2 / A3 / F4 all flipped from FAIL to PASS. Codex confirmed the closeout-sync chain worked end-to-end and the gap-to-DASH map (added to the proposal body in §3 of this document) covers all eight gap classes (G3.1 → DASH-3.C; G3.2 → DASH-3.B; G3.3 → DASH-3.B/C; G3.4 → already mostly mitigated; G2.x → DASH-2 family; G4.x → DASH-4; G5.x → DASH-5/Phase 8/Phase 9; G6.x → DASH-6).

## §9 — Hard-blocked surfaces

### Hard-blocked during this DOCS-ONLY codification phase

Everything except the 4 named files. No file edits outside `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`, and the new `orchestrator/handoffs/DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN.md`. No commits, no pushes, no runtime actions until operator approval.

### Hard-blocked across the entire DASH-3 track (DASH-3.A and any future DASH-3.B / DASH-3.C implementation step)

| Excluded | Reason |
|---|---|
| **DASH-4** — paper controls cleanup | Separate phase; G4.1–G4.3 + G2.5 envelope. DASH-3 does not touch any paper handler. |
| **DASH-5** — live controls design-only | Separate phase; G5.1–G5.5. DASH-3 does not touch live SELL_ALL / SET_STOP_LOSS / SET_TAKE_PROFIT / BUY / OPEN_LONG persistence. |
| **Phase 8** — D-5.12f-LIVE-SELLALL-IMPLEMENTATION | HIGH-RISK; ARC-2 Gate 9. DASH-3 is SAFE IMPLEMENTATION only. |
| **Phase 9** — D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP | Separate SAFE IMPLEMENTATION. DASH-3 does not touch the 10-key mutation site. |
| **DASH-6** — full-dashboard smoke harness | Separate SAFE IMPLEMENTATION on `tests/`. DASH-3 does not touch `tests/`. |
| **Legacy `renderPosition` extraction / merger** | Deferred indefinitely. Legacy `:5453` lives inside template literal `:3169-7741`; high template-escape risk. |
| `bot.js` | HARD BLOCK throughout. |
| `db.js` | HARD BLOCK throughout. **No new DB helpers added by any DASH-3 sub-phase.** |
| `migrations/` | HARD BLOCK throughout. **No DB schema change in DASH-3.** |
| `position.json` | HARD BLOCK throughout. **DASH-3 reads `position.json` for drift detection only; never writes.** |
| `position.json.snap.20260502T020154Z` | HARD BLOCK throughout (pre-existing untracked carve-out). |
| `package.json`, `package-lock.json`, `.nvmrc` | RESTRICTED; no scoped lift granted in DASH-3. |
| `.env*` | HARD BLOCK forever for automation. |
| All safety-policy docs | HARD BLOCK throughout the DASH track. |
| All Hermes templates / runtime | HARD BLOCK; Hermes stays shelved. |
| `tests/*.spec.js` | RESTRICTED; DASH-6 territory. |
| `/api/trade` handler | RESTRICTED-not-lifted in DASH-3. |
| Live SL/TP/SELL_ALL/BUY/OPEN_LONG handlers | RESTRICTED-not-lifted in DASH-3. **DASH-3 does NOT add DB writes for these.** |
| Emergency-audit code (`_emergencyAuditWrite`, `_loglineFallback`, `_redactAttemptedPayload`) | RESTRICTED-not-lifted in DASH-3. |
| `MANUAL_LIVE_ARMED` env reads | RESTRICTED-not-lifted in DASH-3. |
| Railway CLI / Kraken API / production DB queries / migration application / deploy / Discord post | RED-tier; not pre-authorized. |
| Autopilot runtime activation | Phase 11 territory; explicitly NOT activated. |

## §10 — Cross-references

- `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md` — current-phase journal.
- `orchestrator/NEXT-ACTION-SELECTOR.md` — ten ordered selector rules; master-order discipline.
- `orchestrator/PHASE-MODES.md` — six phase modes; Mode 2 (DESIGN-ONLY) for the source design phase, Mode 3 (DOCS-ONLY) for this codification, Mode 4 (SAFE IMPLEMENTATION) for DASH-3.B and DASH-3.C.
- `orchestrator/PROTECTED-FILES.md` — per-path classification; `dashboard.js` is RESTRICTED (Level 2 at lines 53-73). Lift expires at commit per `:59`.
- `orchestrator/APPROVAL-GATES.md` — 16-gate matrix.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules; ARC-8 phase-loop ceiling rule.
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers.
- `orchestrator/HANDOFF-RULES.md` — packet rules; "Forbidden content" list.
- `orchestrator/BLUEPRINT.md` — Critical File Guard; Read-Only First Rule.
- `orchestrator/FIX-PLAN.md` — Postgres-as-only-source-of-truth contract; paper-mode immediate / live-mode gated.
- `orchestrator/handoffs/DASH-1-READ-STATE-AUDIT.md` — canonical Phase 3 inventory; G3.1–G3.4 source.
- `orchestrator/handoffs/ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md` — Phase 2 dashboard stability design (already canonical).
- `orchestrator/handoffs/D-5-12F-LIVE-SELLALL-DESIGN.md` — Phase 8 design (covers SELL_ALL only; not contradicted by DASH-3).

## §11 — Authorization scope

DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN-SPEC (this codification phase) authorizes ONLY:
- Authoring this design record at `orchestrator/handoffs/DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`.

DASH-3-POSITION-DISPLAY-CANONICALIZATION-DESIGN-SPEC explicitly does NOT authorize:
- Any DASH-3.B implementation. Separately gated; requires operator-granted scoped lift on RESTRICTED `dashboard.js` for DASH-3.B only + Codex implementation review + commit + push approvals.
- Any DASH-3.C implementation. Separately gated; same approval cascade.
- Any DASH-4, DASH-5, Phase 8, Phase 9, DASH-6, Phase 11 work. Each separately gated.
- Any edit to `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.nvmrc`, `.env*`, `position.json`, `position.json.snap.20260502T020154Z`, deploy config.
- Any safety-policy doc edit.
- Any Hermes runtime authoring / repo creation / deployment / install resumption.
- Any production action: Railway CLI, Railway env, Railway redeploy, Kraken action (live or otherwise), production DB query / mutation, migration application, `MANUAL_LIVE_ARMED` change, deploy, env / secret read or write, autopilot runtime activation, automation install / widening, Discord post, webhook / scheduler / MCP / cron / Ruflo install.
- Any extraction or merger of the legacy `renderPosition` at `dashboard.js:5453`. Deferred indefinitely.
