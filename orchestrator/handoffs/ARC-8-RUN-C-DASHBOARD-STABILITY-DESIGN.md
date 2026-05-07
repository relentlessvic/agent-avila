# ARC-8-RUN-C — Dashboard Stability Design

> **DOCS-ONLY ARTIFACT.** This document is a design record. It does NOT authorize any code phase, deploy, Kraken action, `MANUAL_LIVE_ARMED` toggle, migration application, production state mutation, autopilot runtime activation, or Hermes runtime install. Per `orchestrator/HANDOFF-RULES.md` and `orchestrator/APPROVAL-GATES.md`, every downstream DASH-N phase, the interleaved D-5.12f and D-5.12e.1 phases, and Phase 11 (`ARC-8-RUN-D-AUTOPILOT-BUILD-LOOP`) are each separately gated and require their own scoped approvals.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` (per `HANDOFF-RULES.md`). If this document ever conflicts with either canonical source, the canonical source wins and this document is treated as stale.
>
> **No packet substitutes for in-session operator approval** (per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval"). This document records the shape of a design; commit and downstream-phase approvals are Victor's in-session instructions.

**Codification phase:** `ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC`
**Source design phase:** `ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN` (Design-only PASS, Codex round-2; conversation-only; no commit by the design phase itself)
**Phase mode:** DOCS-ONLY (Mode 3 per `orchestrator/PHASE-MODES.md`)
**Author:** Claude (Lead Engineer / Builder)
**Date:** 2026-05-07
**Status:** DRAFT — pending Codex docs-only review and explicit operator approval before commit. Conversation-only Codex round-1 (2026-05-07) returned PASS WITH REQUIRED EDITS on A1, A4, B1, C3; Codex round-2 (2026-05-07) returned clean PASS on all 24 checks (Codex enumerated 28; same set), zero required edits.

## §1 — Phase scope and intent

ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC codifies the Codex-PASS-verified Phase 2 dashboard stability design as a permanent, version-controlled SAFE-class design record. The design itself was a conversation-only DESIGN-ONLY (Mode 2) phase that Codex cleared in round 2. This DOCS-ONLY phase persists the corrected design as on-disk reference for the downstream DASH-1 through DASH-6 phases plus the interleaved Phase 8 (D-5.12f impl) and Phase 9 (D-5.12e.1 cleanup) at master-order positions 8 and 9.

**In scope (this DOCS-ONLY phase):**
- Authoring this design record at `orchestrator/handoffs/ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md` recording the source design phase as Codex-PASS / no-commit and the codification phase as in progress.

**Out of scope:**
- Any edit to `dashboard.js`, `bot.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.env`, `.env.example`, `.nvmrc`, `position.json`, `position.json.snap.20260502T020154Z`.
- Any edit to safety-policy docs (`PROTECTED-FILES.md`, `APPROVAL-GATES.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, `AUTOMATION-PERMISSIONS.md`, `HANDOFF-RULES.md`, `BLUEPRINT.md`, `AUTOPILOT-RULES.md`, `COMM-HUB-RULES.md`, `COMM-HUB-HERMES-RULES.md`, `CLAUDE.md`).
- Any deploy, migration application, Kraken action, `MANUAL_LIVE_ARMED` toggle, env / secret read or write, production DB query or mutation, Railway command, or autopilot runtime activation.
- Any DASH-1 through DASH-6 implementation, any D-5.12f code-implementation, any D-5.12e.1 cleanup. Each separately gated.
- Any Hermes runtime authoring, Hermes repo creation, Hermes runtime deployment.

## §2 — Current state at design time

**HEAD:** `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6` (ARC-8-UNPAUSE landed and pushed). Working tree clean except 1 pre-existing untracked carve-out (`position.json.snap.20260502T020154Z`).

**Phase state:**
- ARC-8-UNPAUSE closed at HEAD `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`. CEILING-PAUSE broken on canonical record.
- Phase-loop counter: 0 of 3.
- Active master-order position: Phase 2 of 11 — ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.
- Autopilot runtime: DORMANT.
- Hermes: shelved (passive bot member of `Agent Avila Hub` with `System-Writer` role + canonical channel overrides; no runtime running; no posting capability). Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED.
- Migration 008: APPLIED to production at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` (Attempt 6 — 2026-05-04, runner exit 0).
- N-3: CLOSED.
- Approvers: exactly `{Victor}`.

**Architecture facts (read-only sweep of `dashboard.js` 13,212 lines, `bot.js` 3,295 lines, `db.js` 995 lines, plus existing design docs `FIX-PLAN.md`, `BLUEPRINT.md`, `D-5-12F-LIVE-SELLALL-DESIGN.md`):**

| Domain | Canonical location |
|---|---|
| Paper position (current) | Postgres `positions` (DB-only per `FIX-PLAN.md`); dashboard does not write `position.json` for paper. |
| Live position (current) | Postgres `positions` is primary; `position.json` is a compatibility cache written only after DB success on BUY/OPEN_LONG and CLOSE_POSITION; live SELL_ALL still writes `{open:false}` to `position.json` directly with no DB persistence (targeted by Phase 8 D-5.12f impl). |
| Trade history | Postgres `trade_events` (mode-tagged); legacy `trades.csv` retained for paper-trade count only at `dashboard.js:1133`. |
| Control state | Postgres `bot_control` (DB-first, `loadControl()` at `dashboard.js:148-227`) shadow-mirrored to `bot-control.json` (`dashboard.js:287-291`) for compatibility. |
| Emergency audit | Postgres `emergency_audit_log` (Migration 008 APPLIED) accessed via `_emergencyAuditWrite` at `dashboard.js:654`; failure ladder Layer 2 → 3 → 4. |
| Live balance | Kraken API via `fetchKrakenBalance()` (`dashboard.js:2315-2372`), 30s `balanceCache`, invalidated post-trade at lines 1927 / 2067 / 2109 / 2198 / 2244 / 2254. |
| Live arming | `MANUAL_LIVE_ARMED` env, read fresh every request at Layer 1 (`dashboard.js:12931`) and Layer 2 (`dashboard.js:1841`). |
| Front-end | `dashboard.js` contains multiple inline HTML-generating surfaces, including the legacy `const HTML` at `dashboard.js:3163-13002` plus `loginPage` (`:2439`), `twoFaPage` (`:2980`), `homepagePage` (`:7746`), `liveReadinessHTML` (`:8165`), `modePage` (`:8457`), `dashboardV2BackupHTML` (`:9287`), `dashboardCombinedHTML` (`:9306`), and `dashboardV2HTML` (`:9567`). Polling/interval inventory must be finalized by DASH-1 rather than asserted as a fixed count here (rough scan: ≥14 `setInterval` calls plus SSE stream subscribers). |

## §3 — Next-phase verification

Walking `NEXT-ACTION-SELECTOR.md` rules 1–10 at design time:

- **Rule 1** (active closeout): no active closeout pending — ARC-8-UNPAUSE landed cleanly at `22ba4a7…` with three-way SHA consistency PASS verified post-push (operator-attested per §8 below).
- **Rule 2** (READ-ONLY AUDIT confirm): local HEAD and local `origin/main` tracking ref match `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; working tree clean except known untracked `position.json.snap.20260502T020154Z`; live remote equality is operator-attested per §8 below.
- **Rule 3** (audit / design before implementation): ARC-8-RUN-C IS the design phase. Aligns.
- **Rule 4** (ARC / safety-control before risky trading): correct order.
- **Rule 5** (Codex on high-risk): N/A — DESIGN-ONLY conversation; codification is DOCS-ONLY.
- **Rule 6** (operator approval list): pending — Codex docs-only review on this codification + commit + push approvals are separate.
- **Rule 7** (ambiguous mode): unambiguous — DESIGN-ONLY for the source phase per Mode 2; DOCS-ONLY for this codification per Mode 3.
- **Rule 8** (file scope): codification scope is exactly 4 files (1 new SAFE-class doc + 3 status doc updates).
- **Rule 9** (Codex required-edits): round-1 required edits applied verbatim; round-2 returned clean PASS (§7).
- **Rule 10** (non-operator-signal-as-approval): only Victor's in-session direction confirmation opens any subsequent phase.

**Verdict:** persisting the Codex-PASS Phase 2 design as a SAFE-class on-disk record via DOCS-ONLY codification is the correct next action.

## §4 — Dashboard stability risk map (R1–R10)

### R1 — Postgres ↔ position.json drift (live mode)

**Where:** `dashboard.js:1847` (read), `:1919` (live BUY write), `:2101` (live CLOSE write), `:2253` (live SELL_ALL write), plus dashboard rendering at `:5447-5516` and `:10791-10810`.

**Why it bites:** live BUY/CLOSE write `position.json` only on DB success — that is correct. Live SELL_ALL writes `position.json` without DB persistence at all (the target of D-5.12f impl). If a live SELL_ALL succeeds at Kraken, `position.json` flips to `{open:false}` but the `positions` row in Postgres still says `status='open'`. Subsequent dashboard fetches render an inconsistent state depending on whether the rendering pipeline reads JSON-first or DB-first. The `_emergencyAuditWrite` ladder is also bypassed because there is no DB call to fail.

**Severity:** structural — affects accuracy of live position display until D-5.12f impl lands.

### R2 — Stale browser / PWA cache

**Where:** `dashboard.js:12198-12219` (manifest + icons cached `public, max-age=86400`), HTML routes at `:12078` and `:12189` use `no-store, must-revalidate` (good). No service worker registered in `dashboard.js`. Asset versioning: none — operator depends on Railway redeploy to flush the inline JS.

**Why it bites:** if a deploy lands without a hard cache-bust, the operator's browser may run *old* JS against the *new* server — leading to silent rendering mismatches and stale polls hitting decommissioned routes. Multiple polling intervals (≥14 `setInterval` calls plus SSE) overlap; if any single endpoint mutates response shape, multiple polling consumers can disagree.

**Severity:** medium — operator-facing reliability.

### R3 — API response shape divergence between routes

**Where:** `/api/v2/dashboard` (`:12529`), `/api/data` (`:12717`), `/api/home-summary` (`:12723`), `/api/paper-summary` (`:12499`), `/api/live-summary` (`:12513`). Each composes a position payload from Postgres (and, for live, possibly `position.json`) on a different code path.

**Why it bites:** during a paper↔live mode switch (transition lock at `:12790` and `:12906`), routes can be sampled in different windows and yield divergent results in the same UI render. The transition lock prevents *commit* races but does not freeze *reads*.

**Severity:** medium — visible during mode-switch.

### R4 — Browser/PWA mode-switch race

**Where:** Layer 1 `/api/trade` checks `paperTrading` against a fresh `loadControl()` snapshot (`:12805-12811`) but the front-end mode pill is whatever the last poll returned. A user clicking BUY in a UI that thinks "paper" while the back-end has switched to "live" gets caught at Layer 1 — but the UX gives no signal until error response.

**Severity:** medium — UX, not safety. Layer 1 / Layer 2 protect live-money correctness.

### R5 — Manual control safety surface mismatch

**Where:** `MANUAL_LIVE_COMMANDS` allowlist (`:94-100`); Layer 1 (`:12928-12936`); Layer 2 (`:1841-1843`); typed-CONFIRM modal (`:5680-5697`, `confirmTrade` at `:5722-5734`). Six commands: `BUY_MARKET`, `OPEN_LONG`, `CLOSE_POSITION`, `SELL_ALL`, `SET_STOP_LOSS`, `SET_TAKE_PROFIT`.

Inventory by current persistence state:
- **Paper:** all 6 use DB-first (`shadowRecordManualPaper*` helpers). Compliant with `FIX-PLAN.md`.
- **Live BUY/OPEN_LONG (`:1861-2033`):** Kraken-first then DB; emergency audit ladder present (`:1970-2023`).
- **Live CLOSE_POSITION (`:2087-2217`):** D-5.12d/e DB-first contract; emergency audit ladder; `position.json` only on DB success.
- **Live SELL_ALL (`:2247-2255`):** no DB persistence (R1).
- **Live SET_STOP_LOSS / SET_TAKE_PROFIT:** dashboard.js paper-only paths exist at `:2258-2306`; live SL/TP paths follow Kraken-first flow but DB persistence patterns weren't fully verified in this design and need DASH-1 cataloging.

**Severity:** structural to high — depends on whether DASH track broadens to "all live controls" or scopes only to SELL_ALL.

### R6 — Emergency audit gaps

**Where:** `D-5-12F-LIVE-SELLALL-DESIGN.md` §10 records the **D-5.12e.1 cleanup** at `dashboard.js:2138-2139` — the shipped CLOSE_POSITION code mutates `attempted_payload` by appending `attempted_payload_hash` as a 10th key. This breaks byte-stability of the canonical hash. The same pattern was caught and dropped from D-5.12f's design (round-1 M2 → round-2 PASS), but the live shipped CLOSE_POSITION code still has it.

Plus: live BUY/OPEN_LONG path at `:1970-2023` should be re-audited against the D-5.12e contract for the same 10-key mutation issue (similar code shape; not verified by this design's read-only sweep).

**Severity:** medium — auditability of post-Kraken-DB-failure events.

### R7 — Paper-control failure surfacing

**Where:** paper handlers at `:1861-1927` (BUY), `:2043-2069` (CLOSE), `:2220-2245` (SELL_ALL), `:2258-2306` (SL/TP). Per `FIX-PLAN.md`: "Surface error to operator (UI / API response). Trade must be considered NOT executed." Each paper handler must return a `{ok:false, error}` consistent shape and `/api/trade` must propagate it to the UI banner.

**Severity:** low — already mostly DB-first; risk is consistency of error UX.

### R8 — Smoke / regression coverage gap

**Where:** `tests/` directory exists with 3 Playwright spec files (`tests/nav.spec.js`, `tests/modal.spec.js`, `tests/mode-pages.spec.js`) exercising selected dashboard surfaces (`/dashboard-legacy`, `/paper`, `/live`). However, there is no full dashboard smoke harness that boots against isolated synthetic state, hits every API route, validates route-shape contracts, and asserts position-render parity across `/api/v2/dashboard` / `/api/data` / `/api/home-summary` for the canonical fixtures.

**Severity:** structural — existing tests reduce but do not close the Phase 11 gating risk. DASH-6 is the work that closes it.

### R9 — Multiple HTML-generating surfaces; inline-template fragility

**Where:** `dashboard.js:3163-13002` (legacy `const HTML`) plus 8 additional page generators: `loginPage` (`:2439`), `twoFaPage` (`:2980`), `homepagePage` (`:7746`), `liveReadinessHTML` (`:8165`), `modePage` (`:8457`), `dashboardV2BackupHTML` (`:9287`), `dashboardCombinedHTML` (`:9306`), `dashboardV2HTML` (`:9567`). Each is a template-literal string. No build step, no minification, no source-map. Total UI surface area larger than a single inline template; exact rendering pipeline boundaries (which generator serves which route, which generators are dead, what overlap exists) must be finalized by DASH-1 audit.

**Severity:** structural — every UI change is high-blast-radius. ARC-2 / `PROTECTED-FILES.md` already classify `dashboard.js` as RESTRICTED for write.

### R10 — Capital-state / performance-state JSON sidecars

**Where:** `capital-state.json` (`dashboard.js:12852-12870`), `performance-state.json` (`:1331`, `:1969`). Both are JSON sidecars read at startup and updated on certain events. On Railway (ephemeral filesystem), these silently reset across deploys.

**Severity:** medium — invisible drift across deploys; affects displayed stats but not trading correctness.

## §5 — DASH-1 → DASH-6 roadmap

| # | Phase | Mode | Scope (touch perimeter) | Codex review required? | Operator approval gates | Closes risks |
|---|---|---|---|---|---|---|
| 3 | **DASH-1-READ-STATE-AUDIT** | READ-ONLY AUDIT (Mode 1) | Read-only sweep. Output is a single new SAFE-class audit report doc at `orchestrator/handoffs/DASH-1-READ-STATE-AUDIT.md` (DOCS-ONLY closeout phase), or conversation-only audit. Catalogs every state source the dashboard reads, every API route, every front-end fetch, every polling interval, every render pipeline, every live/paper code-path divergence, the precise mapping of HTML-generating surfaces (legacy `const HTML` + 8 page generators per R9) to routes. No runtime read or write. | No (audit phase only); commit-time Codex docs-only review on the report doc itself if persisted | Operator approval to commit the audit doc | Foundational — names every drift surface so DASH-2/3/4 can target it; finalizes R9 inventory |
| 4 | **DASH-2-UI-STABILITY-CLEANUP** | SAFE IMPLEMENTATION (Mode 4); requires scoped lift on `dashboard.js` per ARC-1 RESTRICTED rule | `dashboard.js` only, narrow band. Targets: cache-control hardening (asset versioning / inline-JS cache-bust), polling-interval consolidation, removal of dead routes / dead front-end branches identified by DASH-1, safer error UX surfacing for paper failures (R7) | Codex implementation review on diff | Scoped HARD BLOCK lift on `dashboard.js`; commit + push approvals | R2, R3, R4 (UX side), R7 |
| 5 | **DASH-3-POSITION-DISPLAY-CANONICALIZATION** | SAFE IMPLEMENTATION (Mode 4) | `dashboard.js` only. Unifies position rendering through a single canonical pipeline that prefers Postgres and explicitly surfaces drift if `position.json` disagrees (live only). No new write paths. No changes to live-trading hot path. May add a "drift" pill / badge to the UI when DB ↔ JSON mismatch detected. | Codex design + implementation review | Scoped lift; commit + push approvals | R1 (display-side mitigation only — full fix needs D-5.12f impl), R3, R4 |
| 6 | **DASH-4-PAPER-CONTROLS-CLEANUP** | SAFE IMPLEMENTATION (Mode 4) | `dashboard.js` paper-mode handlers only (`:1861-1927`, `:2043-2069`, `:2220-2245`, `:2258-2306`). Tighten `{ok:false,error}` propagation; remove any residual JSON fallback paths in paper handlers; standardize error envelopes. **Live paths NOT touched.** | Codex implementation review | Scoped lift; commit + push approvals | R7 (paper); locks in `FIX-PLAN.md` paper-mode contract |
| 7 | **DASH-5-LIVE-CONTROLS-DESIGN-ONLY** | DESIGN-ONLY (Mode 2) | Conversation + a new SAFE-class design record at `orchestrator/handoffs/DASH-5-LIVE-CONTROLS-DESIGN.md`. Documents the target end-state for every live control (BUY, OPEN_LONG, CLOSE, SL, TP, SELL_ALL): unified DB-first contract, emergency-audit ladder consistency, `_redactAttemptedPayload` field-shape rules per command, exact failure-class taxonomy, post-Kraken `balanceCache` invariants. **No live code touched.** Cross-references the existing `D-5-12F-LIVE-SELLALL-DESIGN.md` and the D-5.12d/e shipped CLOSE_POSITION contract. | Codex docs-only review on the design record | Operator approval to commit the design record | Pre-condition for Phase 8 (D-5.12f impl) and any later live-control implementation phase |
| 8 (master order Phase 8) | **D-5.12f-LIVE-SELLALL-IMPLEMENTATION** | HIGH-RISK IMPLEMENTATION (Mode 5); ARC-2 Gate 9 | Already designed (`D-5-12F-LIVE-SELLALL-DESIGN.md`); this is the impl phase. Touches `dashboard.js` SELL_ALL block ONLY (~140-155 ins / ~10 del). Resolves R1 for SELL_ALL. | Codex design + implementation reviews; both must PASS | Scoped HARD BLOCK lift; commit + push + per-action live-trading approvals all separate | R1 (SELL_ALL), R6 partially (carries forward the corrected pattern) |
| 9 (master order Phase 9) | **D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP** | SAFE IMPLEMENTATION (Mode 4) — narrow | `dashboard.js:2138-2139` only. Removes the 10-key mutation that violates `attempted_payload` byte-stability in the shipped D-5.12e CLOSE_POSITION code. Aligns with the corrected D-5.12f pattern. | Codex implementation review | Scoped lift; commit + push approvals | R6 |
| 10 | **DASH-6-FULL-DASHBOARD-SMOKE-HARNESS** | SAFE IMPLEMENTATION (Mode 4); test scaffolding | Extend the existing Playwright surface (`tests/nav.spec.js`, `tests/modal.spec.js`, `tests/mode-pages.spec.js`) into a full smoke harness. Either expand `tests/` or add `scripts/dashboard-smoke/`. End-to-end harness that boots `dashboard.js` against an isolated test DB, hits every API route, asserts route-shape contracts, asserts position-render parity across `/api/v2/dashboard` / `/api/data` / `/api/home-summary` for canonical fixtures (paper-no-position, paper-open, paper-closed, live-open, live-closed, live-orphan-DB, live-orphan-JSON, mode-switch-mid-poll). **No live trading. No Kraken. No production DB. No env touch.** | Codex implementation review on the harness design + diff | Scoped lift on `tests/` or `scripts/` (RESTRICTED per `PROTECTED-FILES.md`); commit + push approvals | R3, R8, R9 (regression coverage) — gating prerequisite for Phase 11 ARC-8-RUN-D |

## §6 — Hard-blocked surfaces

### Hard-blocked during this DOCS-ONLY codification phase

Everything except the 4 named files. No file edits outside `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`, and the new `orchestrator/handoffs/ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md`. No commits, no pushes, no runtime actions until operator approval.

### Hard-blocked across the entire DASH track (DASH-1 through DASH-6)

- `bot.js` — HARD BLOCK throughout. The DASH track does not touch the trading runtime hot path.
- `db.js` — HARD BLOCK throughout. No new DB helpers needed; existing helpers (`loadOpenPosition`, `closePosition`, `insertTradeEvent`, `_emergencyAuditWrite`) are sufficient.
- `migrations/` — HARD BLOCK throughout. No new migrations.
- `position.json` — HARD BLOCK throughout. The DASH track does not write to `position.json`; that file's role narrows or expands only via D-5.12f / future live-control impl phases, not via DASH-2/3/4/6.
- `position.json.snap.20260502T020154Z` — HARD BLOCK throughout. Pre-existing untracked carve-out; never staged or modified.
- `package.json`, `package-lock.json`, `.nvmrc` — HARD BLOCK throughout (DASH-6 may add `tests/` runner config only via a separately-scoped lift if the phase actually needs it; default is to use existing tools).
- `.env*` — HARD BLOCK forever for automation per ARC-6.
- All safety-policy docs (`PROTECTED-FILES.md`, `APPROVAL-GATES.md`, `AUTOPILOT-RULES.md`, `BLUEPRINT.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, `AUTOMATION-PERMISSIONS.md`, `HANDOFF-RULES.md`, `COMM-HUB-RULES.md`, `COMM-HUB-HERMES-RULES.md`) — HARD BLOCK throughout the DASH track.
- All Hermes templates / runtime — HARD BLOCK; Hermes stays shelved.

### Hard-blocked production-side surfaces across the entire DASH track

- Railway CLI, Railway env, Railway redeploy triggers — RED-tier; no automation touches them.
- Kraken API (live or otherwise) — RED-tier.
- Production DB queries / mutations — RED-tier.
- Migration application (009+) — RED-tier; not on this roadmap.
- `MANUAL_LIVE_ARMED` env value reads or writes — RED-tier.
- Any deploy — RED-tier per ARC-2 Gate 5.
- Discord post via Hermes runtime — would require Hermes runtime to exist; doesn't, and isn't being built by this track.

### Out-of-scope phase boundaries

- **D-5.12f-LIVE-SELLALL-IMPLEMENTATION** (Phase 8) and **D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP** (Phase 9) are HIGH-RISK and SAFE IMPLEMENTATION respectively, **outside** the DASH-N umbrella but **interleaved** in the master order at positions 8 and 9. Each is gated independently. The DASH track does not pre-authorize them.
- **Phase 11** (`ARC-8-RUN-D-AUTOPILOT-BUILD-LOOP`) requires DASH-6 PASS as a structural prerequisite. The DASH track does not pre-authorize Phase 11.

## §7 — Codex review history (source design phase)

**Round 1 (2026-05-07) — PASS WITH REQUIRED EDITS** on 4 of 24 checks (A1, A4, B1, C3). PASS on the other 20 checks.

- **A1 / B1 — UNVERIFIABLE:** live-remote SHA equality could not be independently confirmed from inside Codex's read-only sandbox (Q11-class limitation; same pattern that surfaced in `COMM-HUB-HERMES-INSTALL-READINESS-CODEX-REVIEW`). Resolution: operator clarification packet (§8 below) provided in-session live-remote evidence.
- **A4 — FAIL:** front-end inventory facts overstated. Original design said "single inline HTML template at `dashboard.js:3163-13141`" with "~7978 lines" and "6 polling intervals". Verified independently: `const HTML` actually ends at `:13002`; 8 additional HTML page generators exist (`loginPage`, `twoFaPage`, `homepagePage`, `liveReadinessHTML`, `modePage`, `dashboardV2BackupHTML`, `dashboardCombinedHTML`, `dashboardV2HTML`); `setInterval` calls = 14, not 6. Resolution: Section 1 front-end row + R9 corrected per Codex's verbatim required edit text.
- **C3 — FAIL:** R8 falsely denied the existence of a `tests/` directory. Verified independently: `tests/nav.spec.js`, `tests/modal.spec.js`, `tests/mode-pages.spec.js` exist and exercise selected dashboard routes. Resolution: R8 + DASH-6 row scope corrected per Codex's verbatim required edit text — DASH-6 reframed from "build from scratch" to "extend existing Playwright surface".

**Round 2 (2026-05-07) — clean PASS on all 24 checks** (Codex enumerated 28; same set), zero required edits. Codex's note: *"This PASS does not open the next phase; operator approval and the APPROVAL-GATES process remain required before DASH-1 or any subsequent phase proceeds."* All four round-1 findings resolved: A4 + C3 by corrected design text applied verbatim; A1 + B1 by operator clarification packet.

## §8 — Operator-attested live-remote evidence (A1 + B1 clarification)

The live-remote leg of the three-way SHA consistency check at the ARC-8-UNPAUSE push was independently verified by the operator-side Claude in-session, with operator oversight, immediately after pushing the ARC-8-UNPAUSE commit `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`. Evidence captured in this session:

- `git push origin main` output: `1245554..22ba4a7  main -> main` (fast-forward, no force, no upstream rewrite).
- `git rev-parse HEAD` = `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`.
- `git rev-parse origin/main` = `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`.
- `git ls-remote origin main` = `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6  refs/heads/main` (live network query against GitHub).
- `git merge-base --is-ancestor 22ba4a7… origin/main` returned exit 0 (ancestor confirmed).

The three-way SHA consistency PASS was reported back to the operator in real time, immediately following the push. This matches the **N-2q stale-proof precedent** and the **`COMM-HUB-HERMES-INSTALL-READINESS-CODEX-REVIEW` Q11 sandbox-limitation clarification pattern** (where Codex round 1 returned NOT READY due to Q11 sandbox limitation and round 2 returned PASS after operator clarification packet provided live-remote evidence). Codex round-2 accepted this evidence as operator-attested for A1 and B1 and returned clean PASS.

## §9 — Cross-references

- `orchestrator/STATUS.md` — current-phase journal.
- `orchestrator/CHECKLIST.md` — open / closed / in-progress state per phase.
- `orchestrator/NEXT-ACTION.md` — single source of truth for the next allowed action.
- `orchestrator/NEXT-ACTION-SELECTOR.md` — ten ordered selector rules; master-order discipline.
- `orchestrator/PHASE-MODES.md` — six phase modes; DESIGN-ONLY (Mode 2) and DOCS-ONLY (Mode 3) referenced here.
- `orchestrator/PROTECTED-FILES.md` — per-path SAFE / RESTRICTED / HARD BLOCK matrix; `dashboard.js` is RESTRICTED.
- `orchestrator/APPROVAL-GATES.md` — 16-gate matrix; Gate 5 (deploy), Gate 9 (real-money behavior), Gate 16 (automation widening) referenced here.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules; ARC-8 phase-loop ceiling rule referenced here.
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers; ARC-8 mapping subsection.
- `orchestrator/HANDOFF-RULES.md` — packet rules; "Forbidden content" list referenced here.
- `orchestrator/BLUEPRINT.md` — Critical File Guard; Read-Only First Rule.
- `orchestrator/FIX-PLAN.md` — Postgres-as-only-source-of-truth contract; paper-mode immediate / live-mode gated.
- `orchestrator/handoffs/D-5-12F-LIVE-SELLALL-DESIGN.md` — Phase 8 design (already canonical).
- `tests/nav.spec.js`, `tests/modal.spec.js`, `tests/mode-pages.spec.js` — existing Playwright coverage of selected dashboard surfaces.

## §10 — Authorization scope

ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC (this codification phase) authorizes ONLY:
- Authoring this design record at `orchestrator/handoffs/ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`.

ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC explicitly does NOT authorize:
- Any DASH-1 through DASH-6 implementation. Each is separately gated.
- Any D-5.12f code-implementation (Phase 8). Separately gated per ARC-2 Gate 9.
- Any D-5.12e.1 cleanup (Phase 9). Separately gated.
- Any Phase 11 (`ARC-8-RUN-D-AUTOPILOT-BUILD-LOOP`) work. Separately gated; DASH-6 PASS is a structural prerequisite.
- Any edit to `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.nvmrc`, `.env*`, `position.json`, `position.json.snap.20260502T020154Z`, deploy config.
- Any safety-policy doc edit.
- Any Hermes runtime authoring, Hermes repo creation, Hermes runtime deployment, Hermes install resumption (Steps 14–21).
- Any production action: Railway CLI, Railway env, Railway redeploy, Kraken action (live or otherwise), production DB query / mutation, migration application, `MANUAL_LIVE_ARMED` change, deploy, env / secret read or write, autopilot runtime activation, automation install / widening, Discord post, webhook / scheduler / MCP / cron / Ruflo install.
