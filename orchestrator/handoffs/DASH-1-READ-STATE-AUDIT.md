# DASH-1 — Read-State Audit (Dashboard Inventory)

> **DOCS-ONLY ARTIFACT.** This document is the canonical audit report produced by the DASH-1-READ-STATE-AUDIT phase (READ-ONLY AUDIT, Mode 1) and persisted by the DASH-1-READ-STATE-AUDIT-SPEC phase (DOCS-ONLY, Mode 3). It does NOT authorize any code phase, deploy, Kraken action, `MANUAL_LIVE_ARMED` toggle, migration application, production state mutation, autopilot runtime activation, or Hermes runtime install. Every downstream DASH phase (DASH-2 through DASH-6), the interleaved D-5.12f impl Phase 8 and D-5.12e.1 cleanup Phase 9, and Phase 11 ARC-8-RUN-D each remain separately gated.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` (per `HANDOFF-RULES.md`). If this document ever conflicts with either canonical source, the canonical source wins.
>
> **No packet substitutes for in-session operator approval** (per `orchestrator/APPROVAL-GATES.md`).

**Codification phase:** `DASH-1-READ-STATE-AUDIT-SPEC`
**Source audit phase:** `DASH-1-READ-STATE-AUDIT` (READ-ONLY AUDIT, Mode 1; conversation-only; no commit by audit phase itself)
**Phase mode:** DOCS-ONLY (Mode 3 per `orchestrator/PHASE-MODES.md`)
**Author:** Claude (Lead Engineer / Builder)
**Date:** 2026-05-07
**Status:** DRAFT — pending Codex docs-only review and explicit operator approval before commit.

## §1 — Phase scope and intent

DASH-1-READ-STATE-AUDIT-SPEC persists the read-only dashboard inventory produced by the DASH-1-READ-STATE-AUDIT phase as a permanent, version-controlled SAFE-class audit report. The audit corrects three concrete factual errors in the previously-persisted `orchestrator/handoffs/ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md` (F1, F2, F3 below) and surfaces three new live-control gaps (G5.2, G5.3, G5.4) plus a DASH-6 scope refinement that the Phase 2 design and codification both missed.

**In scope (this DOCS-ONLY codification phase):**
- Authoring this audit report at `orchestrator/handoffs/DASH-1-READ-STATE-AUDIT.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`.

**Out of scope:**
- Any edit to `dashboard.js`, `bot.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.env`, `.env.example`, `.nvmrc`, `position.json`, `position.json.snap.20260502T020154Z`, deploy config.
- Any edit to safety-policy docs.
- Any deploy, migration application, Kraken action, `MANUAL_LIVE_ARMED` toggle, env / secret read or write, production DB query or mutation, Railway command, or autopilot runtime activation.
- Any DASH-2 / DASH-3 / DASH-4 / DASH-5 / DASH-6 implementation.
- Any D-5.12f code-implementation (Phase 8) or D-5.12e.1 cleanup (Phase 9) or Phase 11 work.
- Any Hermes runtime authoring / repo creation / deployment / install resumption.

## §2 — Audit context

**HEAD at audit time:** `b7ce42fa79b493ae532fe5a5ba89692c4ad6ae89` (ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC landed and pushed).

**Phase state at audit time:**
- ARC-8-UNPAUSE CLOSED at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`.
- ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN CLOSED — Design-only PASS (Codex round-1 PASS WITH REQUIRED EDITS on A1/A4/B1/C3 + round-2 clean PASS on all 24 checks).
- ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN-SPEC CLOSED at `b7ce42fa79b493ae532fe5a5ba89692c4ad6ae89` (Codex round-1 PASS WITH REQUIRED EDITS on A4/F4/F6 + round-2 PASS WITH REQUIRED EDITS on A4/F4 + round-3 clean PASS on all 36 checks).
- Phase-loop counter 0 of 3.
- Autopilot DORMANT. Hermes shelved. Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`. N-3 CLOSED. Approvers `{Victor}`.
- Working tree clean except `position.json.snap.20260502T020154Z` pre-existing untracked carve-out.

**Source files inventoried (read-only):**
- `dashboard.js` (13,212 lines).
- `bot.js` (3,295 lines) — only state-boundary identification.
- `db.js` (995 lines) — exports identified.
- `position.json` (16 lines), 5 JSON sidecars (`bot-control.json`, `safety-check-log.json`, `capital-state.json`, `performance-state.json`, `trades.csv`).
- `tests/nav.spec.js`, `tests/modal.spec.js`, `tests/mode-pages.spec.js`.
- `orchestrator/handoffs/ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md` (251 lines; the design record this audit corrects).

## §3 — Dashboard inventory

### §3.1 — State-source inventory

| State | Source | Where read | Where written | Authority |
|---|---|---|---|---|
| Open position (paper) | Postgres `positions` (mode=paper, status=open) | `loadOpenPosition("paper")` at `:1066`, `:2046`, `:2223`, `:2263`, `:2289` | bot.js (DB-canonical); dashboard never writes paper position | Postgres SOLE truth (per `FIX-PLAN.md`) |
| Open position (live) | Postgres `positions` (mode=live, status=open) + `position.json` compatibility cache | `loadOpenPosition("live")` (DB primary); `position.json` read at `:1267`, `:1409`, `:1847` | `position.json` written at `:1919` (live BUY), `:2101` (live CLOSE), `:2253` (live SELL_ALL), `:2279` (live SL), `:2305` (live TP) | Postgres primary; `position.json` is a compatibility cache — but **3 of 5 live-handler write sites bypass DB persistence** (see §3.7, §3.12, F2 below) |
| Trade history | Postgres `trade_events` (mode-tagged) + legacy `trades.csv` | `loadRecentTradeEvents()` at `:960-1090`; CSV read at `:1133` | bot.js + `insertTradeEvent` (8 call sites in dashboard.js) | Postgres SOLE truth; CSV legacy paper-trade-count only |
| Control state | Postgres `bot_control` (id=1) + `bot-control.json` shadow | `loadControl()` at `:148-227` (DB-preferred, JSON fallback at `:211`); `_dbCtrlCache` 30s TTL at `:163-165` | DB upsert at `:288-348` after every `writeFileSync(CONTROL_FILE)` (`:346`) | Postgres preferred; JSON shadow for bot.js compat |
| Emergency audit | Postgres `emergency_audit_log` (Migration 008 APPLIED) | (write-only) | `_emergencyAuditWrite` at `:654` | Postgres SOLE truth; `safety-check-log.json` is Layer 3 fallback only |
| Live balance | Kraken API via `fetchKrakenBalance()` at `:2315-2372` | 30s `balanceCache` (`:2312`) | Cache invalidated post-trade at `:1927`, `:2067`, `:2109`, `:2198`, `:2244`, `:2254` | Kraken (transient) |
| Current price | Kraken API via `fetchCurrentPrice()` at `:1780-1788`; Kraken WSS ticker | per-fetch | (none) | Kraken (transient) |
| Live arming | `process.env.MANUAL_LIVE_ARMED` | Layer 1 at `:12931`; Layer 2 at `:1841`; read fresh every request | (env, not modifiable from runtime) | env (RED-tier) |
| Capital allocation | `capital-state.json` (173 B) | `:1182`, `:12852-12870` | dashboard at `:12852-12870` | local JSON; ephemeral on Railway redeploy |
| Performance metrics | `performance-state.json` (379 B) | `:1180`, `:1331`, `:1969` | bot.js | local JSON; ephemeral on Railway redeploy |
| Safety check log | `safety-check-log.json` (1.07 MB) | `:1101-1102`, `:1286-1287`, `:1532-1533`, `:1857-1858` | appended at `:1890-1891`, `:2062-2063`, `:2104-2105` | local JSON best-effort audit; ephemeral |
| Auth secrets | `.env` (DASHBOARD_TOTP_SECRET, DASHBOARD_BACKUP_PHRASE) | env at startup | dashboard appends to `.env` on first boot if missing (`:13123`, `:13135`) | env (RED-tier; flagged below) |

### §3.2 — API route inventory (30 endpoints)

Routes are dispatched by string equality on `req.url` via `createServer` from `node:http` — no Express, no router, no regex matching. First match wins. Catch-all root `/` falls through to `homepagePage`.

| Route | Method | Auth | Cache | Line | Purpose |
|---|---|---|---|---|---|
| `/login` | GET | public | `no-store, must-revalidate` | `:12070` | Login form (`loginPage()`) |
| `/api/login` | POST | public (rate-limited) | — | `:12084` | Email/password → 2FA pending cookie |
| `/api/forgot-password` | POST | public (rate-limited) | — | `:12089` | Password reset trigger |
| `/2fa` | GET/POST | pending_2fa cookie | `no-store, must-revalidate` | `:12142` | TOTP / backup-phrase form |
| `/logout` | GET | session | — | `:12125` | Clear cookies |
| `/manifest.json` | GET | public | `public, max-age=86400` | `:12198` | PWA manifest |
| `/favicon.svg`, `/icon-192.png`, `/icon-512.png` | GET | public | `public, max-age=86400` | `:12212` | Inline SVG + icons |
| `/api/health` | GET | public | `no-store` | `:12225` | Kraken liveness, bot status, DB schema, table counts |
| `/api/me` | GET | session | `no-store` | `:12422` | `{user, authenticated}` |
| `/api/run-bot` | POST | session | — | `:12446` | Spawn bot.js (transition-locked) |
| `/api/paper-summary` | GET | session | `no-store` | `:12499` | Paper trades, P&L, balance |
| `/api/live-summary` | GET | session | `no-store` | `:12513` | Live trades, P&L, real Kraken balance |
| `/api/v2/dashboard` | GET | session | `no-store` | `:12529` | Slim mode-tagged payload via `buildV2DashboardPayload` |
| `/api/live-readiness` | GET only | session | `no-store` | `:12548` | LC-3.1 read-only readiness |
| `/live-readiness` | GET | session | `no-store, must-revalidate` | `:12622` | Live readiness UI (`liveReadinessHTML()`) |
| `/paper`, `/live` | GET | session | `no-store, must-revalidate` | `:12634` | Mode pages (`modePage()`) |
| `/dashboard` | GET | session | `no-store, must-revalidate` | `:12655` | v2 command center (`dashboardCombinedHTML(null)`) |
| `/dashboard-v2` | GET | session | `no-store, must-revalidate` | `:12668` | Frozen v2 backup (`dashboardV2BackupHTML(initial)`) |
| `/dashboard-legacy` | GET | session | `no-store, must-revalidate` | `:12682` | Legacy `const HTML` (covered by all 3 Playwright specs) |
| `/api/system-status` | GET | session | `no-store` | `:12689` | system-guardian.js status |
| `/api/stream` | GET | session | `no-cache` (SSE) | `:12703` | Server-Sent Events stream |
| `/api/data` | GET | session | `no-store` | `:12717` | Postgres-first trade history, position, P&L |
| `/api/home-summary` | GET | session | `no-store` | `:12723` | Lightweight payload for `/` |
| `/api/balance` | GET | session | `no-store` | `:12728` | Live Kraken balance (cached 30s) |
| `/api/control` | POST | session | — | `:12738` | 24+ command cases (mode, leverage, risk, kill switch, etc.) |
| `/api/control` | GET | session | `no-store` | `:12896` | Read control state |
| `/api/trade` | POST | session | — | `:12901` | Layer 1 MANUAL_LIVE_ARMED gate + transition lock + CONFIRM gate → `handleTradeCommand` |
| `/api/chat` | POST | session | — | `:12952` | Claude assistant context builder |
| `/` (catch-all root) | GET | session | `no-store, must-revalidate` | `:13106` | Homepage splash (`homepagePage(initial)`) |

**Cache-Control posture:** 23 routes carry `no-store` or `no-store, must-revalidate`; manifest + icons cached 1 day (`max-age=86400`). No service worker registered. No asset versioning; redeploy is the only flush mechanism.

### §3.3 — Front-end HTML generators (corrected line ranges)

**Verification method:** `grep -n 'html>\`;$' dashboard.js` returned 7 closing-`</html>\`;` lines: `:2795`, `:3158`, `:7735`, `:8149`, `:8449`, `:9269`, `:12026`.

| # | Generator | Start line | End line | Span | Serves |
|---|---|---|---|---|---|
| 1 | `loginPage(error)` | 2439 | 2795 | 357 | `/login`; error variants on bad cred |
| 2 | `twoFaPage(error)` | 2980 | 3158 | 179 | `/2fa` |
| 3 | `const HTML` (legacy) | **3163** | **7735** | **4573** | `/dashboard-legacy` only — also embedded by `dashboardCombinedHTML` regex extraction |
| 4 | `homepagePage(initial)` | 7746 | 8149 | 404 | `/` (catch-all root) |
| 5 | `liveReadinessHTML()` | 8165 | 8449 | 285 | `/live-readiness` |
| 6 | `modePage(mode, initial)` | 8457 | 9269 | 813 | `/paper` and `/live` |
| 7 | `dashboardV2BackupHTML(initial)` | 9287 | 9289 | 3 | `/dashboard-v2` — thin wrapper that returns `dashboardV2HTML(initial)` |
| 8 | `dashboardCombinedHTML(_initial)` | 9306 | 9565 | 260 | `/dashboard` — composer; regex-extracts chunks from `const HTML` + `dashboardV2HTML` and concatenates |
| 9 | `dashboardV2HTML(initial)` | 9567 | 12026 | 2460 | Reused by `/dashboard-v2` (via wrapper) and `/dashboard` (via composer) |

### §3.4 — Front-end fetch / poll / SSE inventory

**Front-end network sites — 34 total:**

| Type | Count | Notable targets |
|---|---|---|
| `fetch("https://api.kraken.com/...")` | 6 | `:1497`, `:1745`, `:1783`, `:1807` (server-side only), `:12230`, `:12563` |
| `fetch("/api/...")` from front-end | 18 | `/api/data`, `/api/trade`, `/api/control`, `/api/chat`, `/api/run-bot`, `/api/system-status`, `/api/health`, `/api/v2/dashboard`, `/api/{mode}-summary`, `/api/home-summary`, `/api/login`, `/api/forgot-password` |
| `safeJson("/api/...")` | 4 | `/api/data`, `/api/system-status`, `/api/health`, `/api/run-bot` |
| `new EventSource("/api/stream")` | 1 | `:7402` |
| `new WebSocket("wss://ws.kraken.com")` | 4 | `:7574`, `:8048`, `:9108` (frontend, public ticker only) |
| `fetch("https://api.anthropic.com/v1/messages")` | 1 | `:13039` server-side only (chat handler) |

**Polling cadences — 14 `setInterval` + 26 `setTimeout` calls in dashboard.js:**

| Cadence | Function | Line | Surface |
|---|---|---|---|
| 1s | `updateCountdown` | 5359 | legacy `const HTML` |
| 30s | `runHealthCheck` | 6485 | legacy |
| 5s | `checkStreamHealth` | 7443 | legacy |
| 10s | `safePoll` | 8145 | `homepagePage` |
| 1s | `showStale` | 8146 | `homepagePage` |
| 30s | `refresh` (live-readiness) | 8445 | `liveReadinessHTML` |
| 10s | `safePoll` | 9090 | `modePage` |
| 1s | `showStale` | 9091 | `modePage` |
| 1s | `renderPricePill` | 9172 | `modePage` |
| 1.5s | `dcAugmentLabels` | 9544 | `dashboardCombinedHTML` (string-injected) |
| 6s | `dcFetchAndApply` | 9545 | `dashboardCombinedHTML` (string-injected) |
| 5s | `refresh` | 12022 | `dashboardV2HTML` |
| 5min | `runBot` | 13191 | server-side bot scheduler |
| 5min | `runHealthWatchdog` | 13210 | server-side |

26 `setTimeout` calls — most are reconnect backoffs for WebSocket / SSE, toast dismissals, and prefetch helpers. Polling cadences overlap and span 5 different HTML generators.

### §3.5 — Render pipeline inventory

**30 distinct `render*` functions in dashboard.js:** `renderBalance` (`:5278`), `renderHealthStatus` (`:5363`), `renderRSIHistory` (`:5374`), `renderHeatmap` (`:5395`), **`renderPosition` (`:5447` AND `:10791` — two definitions)**, `renderSafetyCheck` (`:5542`), `renderControl` (`:5929`), `renderTradingStatus` (`:6246`), `renderRiskAlertFeed` (`:6334`), `renderV2Shadow` (`:6375`), `renderStatusBar` (`:6502`), `renderLastDecision` (`:6631`), `renderCheckLog` (`:6706`), `renderPortfolioPanel` (`:6747`), `renderCapitalPanel` (`:6830`), `renderModeWL` (`:6881`), `renderPerfPanel` (`:6890`), `renderLiveStatus` (`:6953`), `renderTradeTable` (`:7036`), `renderReasoning` (`:7149`), `renderPortfolioSparkline` (`:7532`), `renderSparkline` (`:7554`), `renderHome` (`:7964`), `renderObj` (`:8327`), `renderPricePill` (`:9145`), `renderStrip` (`:10697`), `renderKpis` (`:10724`), `renderDecision` (`:10812`), `renderHealth` (`:10830`).

**Orchestrator:** `applyData({control, health, summary, latest, position, safetyBuffer, recentDecisionLogs, recentStrategyV2, recentActivity})` at `:11771`. Called from `:11820` and `:12004` after each poll fetch.

### §3.6 — Postgres usage inventory

**db.js exports (32 total):** `dbAvailable`, `query`, `inTransaction`, `ping`, `getCachedDbHealth`, `schemaVersion`, `maskUrl`, `databaseUrlPresent`, `maskedDatabaseUrl`, `close`, `buildEventId`, `insertTradeEvent`, `upsertPositionOpen`, `closePosition`, `updatePositionRiskLevels`, `updatePositionRiskLevelsTx`, `sha256HexCanonical`, `buildEmergencyEventId`, `classifyDbError`, `insertEmergencyAuditLog`, `loadRecentTradeEvents`, `loadOpenPosition`, `loadClosedPositions`, `loadPnLAggregates`, `countOpenPositions`, `countOrphanedPositions`, `loadWinLossAggregates`, `buildCycleId`, `insertStrategySignal`, `loadRecentStrategySignals`, `recordLiveHaltState`, `clearLiveHaltState`, `getKrakenPermCheckState`, `recordKrakenPermCheck`, `upsertBotControl`.

**dashboard.js usage counts:** `loadControl(` × 16 / `sha256HexCanonical(` × 9 / `insertTradeEvent(` × 8 / `emergencyAudit*` × 8 / `modeScopedSummary(` × 6 / `loadOpenPosition(` × 6 / `closePosition(` × 2 / `loadRecentTradeEvents(` × 1 / `buildEmergencyEventId(` × 1.

**Postgres tables in scope:** `bot_control` (id=1), `positions` (mode-tagged), `trade_events`, `emergency_audit_log` (Migration 008), `strategy_signals` (read-only display), `schema_migrations` (version check).

### §3.7 — `position.json` usage inventory (36 references)

**5 reads** at `:1267`, `:1409`, `:1847` plus 2 startup-defensive reads.

**5 writes — and the critical finding:**

| Line | Handler | Mode | DB persistence in same path? |
|---|---|---|---|
| 1919 | live BUY/OPEN_LONG | live | YES — written only after DB success (D-5.7.x contract) |
| 2101 | live CLOSE_POSITION | live | YES — written only after DB success (D-5.12d/e contract) |
| 2253 | live SELL_ALL | live | **NO — direct JSON write, no DB persistence (Phase 8 D-5.12f impl target)** |
| 2279 | live SET_STOP_LOSS | live | **NO — comment at `:2275`: "Live path: byte-identical to today (writes position.json directly)"** |
| 2305 | live SET_TAKE_PROFIT | live | **NO — comment at `:2301`: "Live path: byte-identical to today (writes position.json directly)"** |

### §3.8 — JSON sidecar inventory

| File | Size | Read by dashboard | Written by dashboard | Ephemeral on Railway? |
|---|---|---|---|---|
| `position.json` | 16 lines | 5 reads | 5 writes (live only) | YES — bot.js rehydrates from DB on next cycle |
| `bot-control.json` | 517 B | `loadControl()` JSON-fallback at `:211` | `:346` after DB upsert | YES — DB is canonical via D-5.6 |
| `safety-check-log.json` | 1.07 MB | `:1101-1102`, `:1286-1287`, `:1532-1533`, `:1857-1858` | appended at `:1890-1891`, `:2062-2063`, `:2104-2105` | YES — Layer 3 emergency audit fallback |
| `capital-state.json` | 173 B | `:1182`, `:12852-12870` | `:12852-12870` | YES — silently resets across deploys |
| `performance-state.json` | 379 B | `:1180`, `:1331`, `:1969` | bot.js | YES — silently resets across deploys |
| `trades.csv` | 41 KB | `:1133` (paper-trade count) | bot.js (`bot.js:2406`) | YES — legacy paper-trade audit |

### §3.9 — Kraken / live-balance usage inventory

- `fetchKrakenBalance()` at `:2315-2372` — 30s `balanceCache` (`:2312`); invalidated post-trade at `:1927`, `:2067`, `:2109`, `:2198`, `:2244`, `:2254`.
- `execKrakenOrder(side, pair, volume, leverage)` at `:1792-1827`. Called from `:1866` (live BUY/OPEN_LONG), `:2090` (live CLOSE), `:2251` (live SELL_ALL).
- `fetchCurrentPrice(symbol)` at `:1780-1788` — public ticker fetch.
- Server-side public Time fetch at `:1497`, `:12230`, `:12563` for liveness probe.
- Kraken WSS ticker at `:7574`, `:8048`, `:9108` (frontend, public ticker only).

### §3.10 — `bot_control` / control-state usage inventory

- DB-first via `loadControl()` at `:148-227`; queries `SELECT * FROM bot_control WHERE id = 1`; row mapped via `_mapDbRowToCtrl` at `:175-208`; cached in `_dbCtrlCache` for 30s (`:163-165`).
- Falls back to `_loadControlFromJson()` at `:211-218` if DB unavailable.
- Reconciliation rule at `:236-244`: if `bot-control.json` mtime > DB row's `updated_at` + 2s clock-skew, trust JSON (bot.js-wrote-JSON-but-not-DB path).
- Shadow write at `:288-348`: every `writeFileSync(CONTROL_FILE)` followed by upsert; updates `_dbCtrlCache` immediately on success.
- Module-load warm-up at `:263`.
- 24+ control commands: START_BOT, STOP_BOT, SET_MODE_LIVE, SET_MODE_PAPER, PAUSE_TRADING, RESUME_TRADING, SET_LEVERAGE, SET_RISK, SET_MAX_DAILY_LOSS, SET_COOLDOWN, SET_KILL_DRAWDOWN, SET_PAUSE_LOSSES, SET_XRP_ROLE, SET_AUTO_CONVERT, SET_ACTIVE_PCT, KILL_NOW, RESET_KILL_SWITCH, RESET_COOLDOWN, RESET_LOSSES (mode-switch with `confirm:"CONFIRM"`; KILL_NOW with `confirm:"KILL"`).

### §3.11 — Paper manual-control path inventory

| Command | Lines | Helper | Persistence |
|---|---|---|---|
| BUY_MARKET / OPEN_LONG (paper) | 1861–1927 | `shadowRecordManualPaperBuy` (`:407`) | DB-first; no `position.json` write |
| CLOSE_POSITION (paper) | 2043–2069 | `shadowRecordManualPaperClose` (`:452`) | DB-first; no `position.json` write |
| SELL_ALL (paper) | 2220–2245 | `shadowRecordManualPaperClose` (reused) | DB-first; no Kraken balance call |
| SET_STOP_LOSS (paper) | 2258–2273 | `shadowRecordManualPaperSLUpdate` (`:497`) | DB-first |
| SET_TAKE_PROFIT (paper) | 2283–2298 | `shadowRecordManualPaperTPUpdate` (`:541`) | DB-first |

**All 5 paper paths are DB-first and `FIX-PLAN.md` compliant.**

### §3.12 — Live manual-control path inventory

| Command | Lines | Helper | Kraken-first / DB-first | `position.json` write | Emergency audit ladder |
|---|---|---|---|---|---|
| BUY_MARKET / OPEN_LONG (live) | 1861–2033 | `shadowRecordManualLiveBuy` (`:704`) | Kraken-first then DB | `:1919` after DB success | YES (`:1970-2023`) |
| CLOSE_POSITION (live) | 2087–2217 | `shadowRecordManualLiveClose` (`:774`) | DB-pre-gate → Kraken → DB persist | `:2101` after DB success | YES (D-5.12d/e contract; **`:2138-2139` 10-key mutation bug → D-5.12e.1 cleanup**) |
| SELL_ALL (live) | 2247–2255 | none — direct path | Kraken balance → Kraken sell → JSON | `:2253` direct, **no DB** | NO — bypassed (Phase 8 D-5.12f target) |
| SET_STOP_LOSS (live) | 2275–2280 | `shadowRecordManualLiveSLUpdate` (`:840`) | Kraken-first then JSON | `:2279` direct, **no DB** | **Helper exists at `:840` but is NOT called in the dashboard.js live SL path** |
| SET_TAKE_PROFIT (live) | 2301–2306 | `shadowRecordManualLiveTPUpdate` (`:900`) | Kraken-first then JSON | `:2305` direct, **no DB** | **Helper exists at `:900` but is NOT called in the dashboard.js live TP path** |

### §3.13 — Emergency-audit path inventory (4-layer ladder per D-5.12d/e contract)

- **Layer 1:** call-site computes `attempted_payload` via `_redactAttemptedPayload` (`:613`) and `attempted_payload_hash` via `sha256HexCanonical`.
- **Layer 2:** call-site invokes `_emergencyAuditWrite(failureContext)` at `:654` → inserts into Postgres `emergency_audit_log` (Migration 008 APPLIED).
- **Layer 3:** on Layer 2 failure, call-site invokes `_loglineFallback(line)` at `:629` → appends JSON line to `safety-check-log.json` (`LOG_FILE`).
- **Layer 4:** on Layer 3 failure, internal stderr triple-fault inside `_loglineFallback`.

Live BUY emergency ladder at `:1970-2023`. Live CLOSE emergency ladder at `:2127-2215`. Live SELL_ALL has no ladder (no DB call to fail). Live SL/TP have no ladder.

### §3.14 — Browser / PWA / cache / stale-state risk inventory

- Service worker NOT registered (`grep -nE 'serviceWorker|sw\.js|navigator\.serviceWorker' dashboard.js` returned 0 hits). No SW-cache-staleness vector.
- PWA manifest cached `public, max-age=86400`; HTML routes all `no-store, must-revalidate`.
- Asset versioning: none. Operator depends on Railway redeploy to flush inline JS.
- Polling overlap: 14 `setInterval` calls span 5 HTML generators. Stale endpoint response gets re-rendered by multiple concurrent polls.
- `renderPosition` defined twice (`:5447` legacy + `:10791` v2/mode-pages) — drift surface.
- `.env` write on first boot at `:13123`, `:13135` — appends `DASHBOARD_BACKUP_PHRASE` and `DASHBOARD_TOTP_SECRET` if missing. Fires once per fresh deploy. Worth flagging.

### §3.15 — Existing tests / smoke coverage inventory

| File | Size | Coverage |
|---|---|---|
| `tests/nav.spec.js` | 5,842 B | Logs in via `POST /api/login`, navigates to `/dashboard-legacy`, exercises nav drawer (legacy `const HTML` only) |
| `tests/modal.spec.js` | 5,770 B | Logs in, navigates to `/dashboard-legacy`, exercises confirm modal recursion fix (legacy `const HTML` only) |
| `tests/mode-pages.spec.js` | 3,948 B | Logs in, loads `/paper` and `/live`, asserts script parses without error (`modePage` only) |

**Coverage gaps:**
- Zero coverage of six page routes: /login, /2fa, /, /dashboard, /dashboard-v2, /live-readiness.
- Zero coverage of any API JSON-shape contract.
- Zero coverage of position-render parity across `/api/v2/dashboard` / `/api/data` / `/api/home-summary` for canonical fixtures.
- Zero coverage of failure modes (Postgres down, Kraken down, MANUAL_LIVE_ARMED unset, mode-switch race).
- Zero coverage of paper-DB-first path end-to-end.
- Zero coverage of emergency-audit ladder (Layer 1 → 2 → 3 → 4 transitions).
- Existing tests run against `/dashboard-legacy` only — they would NOT catch a regression in the v2 dashboard or the homepage.

## §4 — Findings (corrections to ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md)

### F1 — Legacy `const HTML` line range was wrong

**Previously persisted (incorrect):** `legacy const HTML at dashboard.js:3163-13002`.

**Correct:** `dashboard.js:3163-7735`.

**Verification method:** `grep -n 'html>\`;$' dashboard.js` returns 7 closing-`</html>\`;` lines: `:2795` (loginPage close), `:3158` (twoFaPage close), `:7735` (`const HTML` close), `:8149` (homepagePage close), `:8449` (liveReadinessHTML close), `:9269` (modePage close), `:12026` (dashboardV2HTML close). Line 13002 is the closing backtick of an unrelated chat-handler system-prompt template (a different template literal entirely).

**Why missed in prior reviews:** Codex round-1, round-2 of Phase 2 design + round-1, round-2, round-3 of ARC-8-RUN-C codification all PASSed without catching this. Codex's read-only sandbox did not parse template-literal boundaries; it relied on heuristic `rg` output. DASH-1's READ-ONLY AUDIT is the gate that catches it.

**Impact:** DASH-2 (UI cleanup) and DASH-3 (position display canonicalization) must use the corrected `:3163-7735` range when scoping edits. The 5,267-line difference is non-trivial — most of `:7736-13002` is OTHER template literals (page generators 4–9 in §3.3 above) and supporting JS code.

### F2 — Live-controls-bypass-DB inventory undercounted

**Previously persisted (incomplete):** R5 in `ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md` flagged only live SELL_ALL as bypassing DB persistence (target of Phase 8 D-5.12f impl).

**Correct:** **Three** live manual-control paths bypass DB persistence — live SELL_ALL (`:2247-2255`), live SET_STOP_LOSS (`:2275-2280`), live SET_TAKE_PROFIT (`:2301-2306`).

**Verification method:** §3.12 column "DB persistence" + `grep -nE 'writeFileSync\(POSITION_FILE' dashboard.js` returns 5 write sites: `:1919` (BUY, after DB success), `:2101` (CLOSE, after DB success), `:2253` (SELL_ALL, no DB), `:2279` (SL, no DB), `:2305` (TP, no DB). The last three are direct JSON writes with no preceding DB persistence call. Source-side comments at `:2275`, `:2301` explicitly confirm: *"Live path: byte-identical to today (writes position.json directly)"*.

**Impact:** DASH-5 (live controls design-only) must extend the unified live-control DB-first contract to all three commands, not just SELL_ALL. The Phase 8 D-5.12f design at `orchestrator/handoffs/D-5-12F-LIVE-SELLALL-DESIGN.md` only addresses SELL_ALL. Live SL and TP need their own design treatment as part of DASH-5 — possibly as new design records or as appended sections to a unified live-controls design.

### F3 — Ephemeral-sidecar inventory undercounted

**Previously persisted (incomplete):** R10 in `ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md` flagged `capital-state.json` and `performance-state.json` as ephemeral on Railway.

**Correct:** **Six** sidecars are ephemeral on Railway (per §3.8): `position.json`, `bot-control.json`, `safety-check-log.json`, `capital-state.json`, `performance-state.json`, `trades.csv`.

**Mitigations already in place for some:** `position.json` is rehydrated by bot.js from DB on next cycle. `bot-control.json` has a Postgres shadow via D-5.6 reconciliation. `trade_events` Postgres table holds full trade history (CSV legacy paper-trade-count only).

**Mitigations NOT in place:** `safety-check-log.json` (1.07 MB Layer 3 emergency-audit fallback) is wiped on every Railway redeploy, losing any locally-buffered Layer 3 fallback rows that hadn't been promoted to `emergency_audit_log` (Layer 2). `capital-state.json` and `performance-state.json` silently reset across deploys, affecting displayed stats but not trading correctness.

**Impact:** DASH-2 (UI stability) should consider explicit "displayed stats reset on deploy" UX surfacing for capital/performance. DASH-5 (live controls design) should consider whether `safety-check-log.json` Layer 3 rows that pre-exist on the running container at deploy time need a Postgres-backed durable equivalent.

## §5 — New gaps surfaced by DASH-1

### G5.2 — Live SET_STOP_LOSS bypasses DB; helper exists but is unwired

`shadowRecordManualLiveSLUpdate` is defined at `dashboard.js:840-898`. Its paper counterpart `shadowRecordManualPaperSLUpdate` is wired into the paper SET_STOP_LOSS path at `:2268`. The live SET_STOP_LOSS path at `:2275-2280` skips the live helper entirely and writes `position.json` directly via `writeFileSync(POSITION_FILE, JSON.stringify(pos, null, 2))` at `:2279`. **DASH-5 must wire `shadowRecordManualLiveSLUpdate` into the live SET_STOP_LOSS path** with the same DB-first contract pattern used by D-5.12d/e CLOSE_POSITION and (after Phase 8) D-5.12f SELL_ALL.

### G5.3 — Live SET_TAKE_PROFIT bypasses DB; helper exists but is unwired

Identical pattern: `shadowRecordManualLiveTPUpdate` at `dashboard.js:900-936`. Paper TP at `:2294` calls `shadowRecordManualPaperTPUpdate`. Live TP at `:2301-2306` writes `position.json` directly via `writeFileSync(POSITION_FILE, JSON.stringify(pos, null, 2))` at `:2305`. **DASH-5 must wire `shadowRecordManualLiveTPUpdate` into the live SET_TAKE_PROFIT path.**

### G5.4 — Live BUY/OPEN_LONG may share the D-5.12e 10-key emergency-payload mutation pattern

The D-5.12f-LIVE-SELLALL-DESIGN-SPEC §10 records the D-5.12e.1 cleanup at `dashboard.js:2138-2139` — the shipped CLOSE_POSITION code mutates `attempted_payload` by appending `attempted_payload_hash` as a 10th key, breaking byte-stability of the canonical hash. **The live BUY/OPEN_LONG emergency-audit ladder at `:1970-2023` should be re-audited for the same 10-key mutation pattern.** The line numbers in question are around `:1955-1957` per the prior design's hint. DASH-5 must explicitly audit this and fold any cleanup into the design.

### G6.1 (refinement) — DASH-6 must extend, not build from zero

`tests/` already contains 3 Playwright spec files exercising selected dashboard surfaces. **DASH-6 scope must be reframed from "build smoke harness from scratch" to "extend the existing Playwright surface into a full smoke harness".** Specifically: add specs for `/`, `/dashboard`, `/dashboard-v2`, `/live-readiness`; add JSON-shape contract assertions on every API route; add position-render parity assertions across `/api/v2/dashboard` / `/api/data` / `/api/home-summary` / `/api/paper-summary` / `/api/live-summary` for the 8 canonical fixture states (paper-no-position, paper-open, paper-closed, live-open, live-closed, live-orphan-DB, live-orphan-JSON, mode-switch-mid-poll). Failure-mode tests (Postgres down, Kraken down, MANUAL_LIVE_ARMED unset, mode-switch race). Emergency-audit ladder transition tests (Layer 1 → 2 → 3 → 4).

## §6 — Gap-to-DASH map (consolidated)

### DASH-2 (UI stability cleanup) — SAFE IMPLEMENTATION on dashboard.js

- **G2.1** — Two `renderPosition` implementations (`:5447` + `:10791`) drift surface. Unify or canonicalize.
- **G2.2** — 14 `setInterval` polls across 5 HTML generators with overlapping cadences. Consolidate where possible.
- **G2.3** — No asset versioning / inline-JS cache-bust. Add a build-time hash or per-deploy nonce.
- **G2.4** — `dashboardCombinedHTML` regex extraction pipeline at `:9306-9565` is fragile.
- **G2.5** — Paper handler `{ok:false, error}` envelope shape consistency.

### DASH-3 (position display canonicalization) — SAFE IMPLEMENTATION on dashboard.js

- **G3.1** — `position.json` read at startup but Postgres canonical via `loadOpenPosition`. Surface drift visibly when DB ↔ JSON disagree.
- **G3.2** — Verify all 5 dashboard data routes use the same Postgres-first position read.
- **G3.3** — Two `renderPosition` definitions need unified data shape contract.
- **G3.4** — Mode-mismatch detection (G3.1) renders cleanly across all 9 HTML generators.

### DASH-4 (paper controls cleanup) — SAFE IMPLEMENTATION on dashboard.js, PAPER ONLY

- **G4.1** — All 5 paper handlers return `{ok:false, error}` and `/api/trade` propagates to UI.
- **G4.2** — `safety-check-log.json` 1.07 MB unbounded growth + ephemeral. Decide policy.
- **G4.3** — Paper TP helper `shadowRecordManualPaperTPUpdate` idempotency under retry.

### DASH-5 (live controls design-only) — DESIGN-ONLY

- **G5.1** — Live SELL_ALL bypasses DB (already designed in D-5.12f, Phase 8).
- **G5.2 — NEW (DASH-1 finding)** — Live SET_STOP_LOSS bypasses DB; wire `shadowRecordManualLiveSLUpdate` (`:840`).
- **G5.3 — NEW (DASH-1 finding)** — Live SET_TAKE_PROFIT bypasses DB; wire `shadowRecordManualLiveTPUpdate` (`:900`).
- **G5.4 — NEW (DASH-1 finding)** — Live BUY/OPEN_LONG at `:1955-1957` may share D-5.12e 10-key mutation pattern. Re-audit.
- **G5.5** — Re-confirm all 6 live commands have consistent failure-class taxonomy + failure-ladder routing.

### DASH-6 (full smoke harness) — SAFE IMPLEMENTATION extending existing tests/

- **G6.1 (refined per DASH-1)** — Extend existing Playwright surface, not greenfield. Add 6 uncovered routes + JSON-shape contracts + position-render parity + failure-mode + emergency-audit ladder coverage.

## §7 — Hard-blocked surfaces

### Hard-blocked during this DOCS-ONLY codification phase

Everything except the 4 named files. No file edits outside `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`, and the new `orchestrator/handoffs/DASH-1-READ-STATE-AUDIT.md`. No commits, no pushes, no runtime actions until operator approval.

### Hard-blocked across the entire DASH track

- `bot.js`, `db.js`, `migrations/`, `position.json`, `position.json.snap.20260502T020154Z`, `package.json`, `package-lock.json`, `.nvmrc`, `.env*`, all safety-policy docs, all Hermes templates / runtime — HARD BLOCK throughout.
- `tests/` — RESTRICTED: DASH-6 may extend `tests/` only via a separately-scoped lift at DASH-6 phase open time.

### Hard-blocked production-side surfaces

- Railway CLI / env / redeploy triggers, Kraken API (live or otherwise), production DB queries / mutations, migration application (009+), `MANUAL_LIVE_ARMED` env value reads or writes, any deploy, Discord post via Hermes runtime — RED-tier.

### Out-of-scope phase boundaries

- DASH-2 / DASH-3 / DASH-4 / DASH-5 / DASH-6 implementation — each separately gated.
- D-5.12f-LIVE-SELLALL-IMPLEMENTATION (Phase 8) and D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP (Phase 9) — each separately gated.
- Phase 11 (`ARC-8-RUN-D-AUTOPILOT-BUILD-LOOP`) — separately gated; DASH-6 PASS is structural prerequisite.

## §8 — Cross-references

- `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md` — current-phase journal.
- `orchestrator/NEXT-ACTION-SELECTOR.md` — selector rules 1–10.
- `orchestrator/PHASE-MODES.md` — Mode 1 (READ-ONLY AUDIT) for source phase, Mode 3 (DOCS-ONLY) for codification.
- `orchestrator/PROTECTED-FILES.md` — `dashboard.js` is RESTRICTED.
- `orchestrator/APPROVAL-GATES.md` — 16-gate matrix.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules.
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers.
- `orchestrator/HANDOFF-RULES.md` — packet rules; "Forbidden content" list.
- `orchestrator/BLUEPRINT.md` — Critical File Guard; Read-Only First Rule.
- `orchestrator/FIX-PLAN.md` — Postgres-as-only-source-of-truth contract.
- `orchestrator/handoffs/D-5-12F-LIVE-SELLALL-DESIGN.md` — Phase 8 design (covers SELL_ALL only; live SL/TP need separate design per G5.2/G5.3).
- `orchestrator/handoffs/ARC-8-RUN-C-DASHBOARD-STABILITY-DESIGN.md` — Phase 2 design record (this audit corrects F1 / F2 / F3 from §2 / §4 R5 / §4 R10).
- `tests/nav.spec.js`, `tests/modal.spec.js`, `tests/mode-pages.spec.js` — existing Playwright coverage.

## §9 — Authorization scope

DASH-1-READ-STATE-AUDIT-SPEC (this codification phase) authorizes ONLY:
- Authoring this audit report at `orchestrator/handoffs/DASH-1-READ-STATE-AUDIT.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`.

DASH-1-READ-STATE-AUDIT-SPEC explicitly does NOT authorize:
- Any DASH-2 / DASH-3 / DASH-4 / DASH-5 / DASH-6 implementation. Each separately gated.
- Any D-5.12f code-implementation (Phase 8). Separately gated per ARC-2 Gate 9.
- Any D-5.12e.1 cleanup (Phase 9). Separately gated.
- Any Phase 11 (`ARC-8-RUN-D-AUTOPILOT-BUILD-LOOP`) work. Separately gated.
- Any edit to `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.nvmrc`, `.env*`, `position.json`, `position.json.snap.20260502T020154Z`, deploy config.
- Any safety-policy doc edit.
- Any Hermes runtime authoring / repo creation / deployment / install resumption.
- Any production action: Railway CLI, Railway env, Railway redeploy, Kraken action (live or otherwise), production DB query / mutation, migration application, `MANUAL_LIVE_ARMED` change, deploy, env / secret read or write, autopilot runtime activation, automation install / widening, Discord post, webhook / scheduler / MCP / cron / Ruflo install.
