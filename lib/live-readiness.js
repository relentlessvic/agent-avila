// Phase LC-2.1 — live-readiness object generator.
//
// PURE READ-ONLY informational data builder. Mirrors the operator-facing
// LC-1 markdown checklist (docs/live-readiness/LIVE_READINESS_CHECKLIST.md)
// in a machine-readable shape so dashboards, monitors, and operator scripts
// can consume GO / NO-GO state programmatically.
//
// CRITICAL SAFETY CONTRACT
// ------------------------
// 1. This module is informational only. The bot does NOT consume the
//    returned object's finalStatus to decide whether to trade live.
// 2. Live trading still requires:
//      a) CONFIG.paperTrading === false
//      b) process.env.LIVE_TRADING_ARMED set
//      c) all D-5.10.x runtime gates passing at trade-decision time
//      d) manual operator approval (LC-1 §10.4 sign-off)
//      e) D-5.10.6 final activation gate (not yet implemented)
// 3. The generator runs SELECT queries only. No INSERT, UPDATE, DELETE on
//    any table. Verified by code review and by the read-only nature of
//    every imported helper.
// 4. The generator never returns credentials, API keys, signing material,
//    or webhook URLs. ENV-var checks return only boolean presence flags.
// 5. On any error path (DB outage, helper throw, unexpected shape), the
//    generator returns finalStatus = "NO-GO" with a synthetic blocker.
// 6. The bot.js source code does NOT import this module. Verified at
//    pre-commit by grep.
//
// USAGE
// -----
//   import { buildLiveReadiness } from "./lib/live-readiness.js";
//   const obj = await buildLiveReadiness();              // standalone
//   const obj = await buildLiveReadiness({ healthSnapshot }); // optional
//                                                              // /api/health
//                                                              // pre-computed
//                                                              // by caller

import {
  query,
  schemaVersion as dbSchemaVersion,
  ping as dbPing,
  countOpenPositions,
  countOrphanedPositions,
} from "../db.js";

// ─── Constants ──────────────────────────────────────────────────────────────
const SCHEMA_VERSION = 1;
const REQUIRED_DB_SCHEMA_VERSION = 5;     // matches live-preflight Gate 4
const PG_LATENCY_OK_MS = 200;
const KRAKEN_LATENCY_OK_MS = 500;
const LAST_RUN_AGE_OK_SEC = 360;          // 6 minutes — bot cron is 5 min
const RISK_PCT_MAX = 1.0;
const MAX_DAILY_LOSS_PCT_MAX = 3.0;
const KILL_SWITCH_DD_PCT_MAX = 5.0;
const FIRST_ACTIVATION_LEVERAGE_MAX = 2;

// ─── Status helpers ─────────────────────────────────────────────────────────
const PASS    = (observation = null) => ({ status: "PASS",    observation });
const FAIL    = (observation = null) => ({ status: "FAIL",    observation });
const WAITING = (observation = null) => ({ status: "WAITING", observation });
const BLOCKED = (observation = null) => ({ status: "BLOCKED", observation });
const MANUAL  = (observation = null) => ({ status: "MANUAL",  observation });

// ─── Static section / item definitions ──────────────────────────────────────
// Each item declares static metadata + an optional verify(ctx) function.
// Verify functions are SYNCHRONOUS and PURE — they read from the pre-loaded
// context and return { status, observation }. Async I/O happens once in
// loadCtx() and is shared across all verifiers.
//
// Items without verify are MANUAL by default — operator must attest.

const SECTIONS = [
  {
    id: "current-mode-safety",
    ordinal: 1,
    title: "Current Mode Safety",
    items: [
      {
        id: "paper-trading-true",
        ordinal: 1,
        title: "bot_control.paper_trading is true",
        whyItMatters:   "A stale paper_trading=false in the database would enable live mode the moment all gates pass. This must remain true until the operator is ready to flip.",
        howToVerify:    "SELECT paper_trading, killed, paused FROM bot_control WHERE id=1",
        passCondition:  "paper_trading: true, killed: false, paused: false",
        blockerMessage: "If paper_trading=false, do not proceed. Manually flip back to paper, investigate why, and restart this checklist.",
        autoVerifiable: true,
        requiredForGo:  true,
        source: { type: "postgres", detail: "bot_control row #1" },
        verify: (ctx) => {
          const c = ctx.botControl;
          if (!c) return BLOCKED("bot_control row #1 missing");
          const ok = c.paper_trading === true && c.killed === false && c.paused === false;
          const obs = `paper_trading=${c.paper_trading} killed=${c.killed} paused=${c.paused}`;
          return ok ? PASS(obs) : FAIL(obs);
        },
      },
      {
        id: "live-trading-armed-unset",
        ordinal: 2,
        title: "LIVE_TRADING_ARMED env var is unset in production",
        whyItMatters:   "This umbrella flag is the explicit operator opt-in for live cycles. It must remain unset until the operator is ready.",
        howToVerify:    "Railway dashboard → service → Variables → confirm LIVE_TRADING_ARMED is not present, or is set to a value other than '1' / 'true'",
        passCondition:  "Env var unset OR set to anything that is not '1' / 'true' (case-insensitive)",
        blockerMessage: "If the variable is '1' and paper_trading flips, the next live cycle will execute. Unset the variable before continuing.",
        autoVerifiable: true,
        requiredForGo:  true,
        source: { type: "env-var", detail: "LIVE_TRADING_ARMED" },
        verify: (ctx) => {
          // Returns only presence flag — never the value (avoid leaking config).
          if (!ctx.env.liveTradingArmedSet) {
            return PASS("LIVE_TRADING_ARMED unset");
          }
          return FAIL("LIVE_TRADING_ARMED set to truthy value");
        },
      },
      {
        id: "no-ambiguous-paper-live-state",
        ordinal: 3,
        title: "No ambiguous paper/live state",
        whyItMatters:   "Catches scenarios like paper_trading=true but bot.lastRun shows live-mode log lines, indicating something is half configured.",
        howToVerify:    "Scan recent Railway logs for 'Mode: LIVE TRADING' — should never appear while paper-trading is on",
        passCondition:  "Cycle log shows 'Mode: PAPER TRADING' consistently",
        blockerMessage: "If any cycle in the last hour shows live mode, pause the bot and investigate before proceeding.",
        autoVerifiable: false,
        requiredForGo:  true,
        source: { type: "logs", detail: "railway logs / Mode: marker" },
        verify: null, // MANUAL — log scanning is too expensive inline
      },
    ],
  },
  {
    id: "d-5-10-5-3-active-management-verification",
    ordinal: 2,
    title: "D-5.10.5.3 Active-Management Verification",
    items: [
      {
        id: "real-trigger-fired",
        ordinal: 1,
        title: "BREAKEVEN or TRAIL has fired in production at least once",
        whyItMatters:   "The active-management dual-write code path has only been verified via the D-5.10.5.7 smoke test using synthetic rows. A real BREAKEVEN or TRAIL on a real paper position must confirm the production code path works on in-flight position state.",
        howToVerify:    "Cron a053e287 polls every 15 min and emits a verification report when triggered",
        passCondition:  "Cron has emitted '[cron D-5.10.5.3] verification complete — auto-stopping' AND verification report passed",
        blockerMessage: "Live trading must remain NO-GO until this verification completes. Wait for market action to trigger naturally.",
        autoVerifiable: false, // would require log-scan or new bot_control flag
        requiredForGo:  true,
        source: { type: "logs", detail: "cron a053e287 output" },
        verify: () => WAITING("cron a053e287 still polling; manually mark PASS once verification report is produced"),
      },
      {
        id: "no-d51053-dual-write-warns",
        ordinal: 2,
        title: "No [d-5.10.5.3 dual-write] warnings in production logs",
        whyItMatters:   "Warnings would indicate the DB write portion of the dual-write fails while JSON succeeds, leading to JSON↔DB drift.",
        howToVerify:    "railway logs --service agent-avila-dashboard --json | grep '[d-5.10.5.3 dual-write]'",
        passCondition:  "Zero matches over the past 24 hours",
        blockerMessage: "Any match indicates a real bug. Capture the warn message detail and resolve before live activation.",
        autoVerifiable: false,
        requiredForGo:  true,
        source: { type: "logs", detail: "[d-5.10.5.3 dual-write]" },
        verify: null,
      },
      {
        id: "container-restart-preserves-trailed-sl",
        ordinal: 3,
        title: "Container restart does not lose trailed SL state",
        whyItMatters:   "The whole point of D-5.10.5.3 is that a deploy or restart preserves the trailed stop. If the bot reads back a stale SL after restart, real money is at risk under live mode.",
        howToVerify:    "After §2.1 fires, manually trigger a Railway redeploy. Confirm the post-deploy cycle reads the trailed SL from DB and rehydrates position.json to match.",
        passCondition:  "[d-5.10.2 rehydrate] line shows the trailed SL (not the original entry-time SL)",
        blockerMessage: "If the bot reverts to the original SL after restart, D-5.10.5.3 is broken at the read layer. Halt and investigate before live activation.",
        autoVerifiable: false,
        requiredForGo:  true,
        source: { type: "manual", detail: "post-redeploy cycle log inspection" },
        verify: null,
      },
    ],
  },
  {
    id: "paper-state-cleanliness",
    ordinal: 3,
    title: "Paper State Cleanliness",
    items: [
      {
        id: "no-open-paper-positions",
        ordinal: 1,
        title: "Zero open paper positions",
        whyItMatters:   "Switching to live while paper has an open position would silently abandon it (paper SL/TP/trailing stops never fire). The D-5.10.5.5 gate would refuse live cycles until this is cleared.",
        howToVerify:    "SELECT count(*) FROM positions WHERE mode='paper' AND status='open'",
        passCondition:  "count = 0",
        blockerMessage: "Close any open paper position manually (via dashboard's manual close, or wait for SL/TP). Do not attempt live activation while any paper position is open.",
        autoVerifiable: true,
        requiredForGo:  true,
        source: { type: "postgres", detail: "positions WHERE mode='paper' AND status='open'" },
        verify: (ctx) => {
          if (typeof ctx.paperOpenCount !== "number") return BLOCKED("paper open count unavailable");
          return ctx.paperOpenCount === 0
            ? PASS(`count=${ctx.paperOpenCount}`)
            : BLOCKED(`count=${ctx.paperOpenCount}`);
        },
      },
      {
        id: "no-paper-orphans",
        ordinal: 2,
        title: "Zero paper orphan rows",
        whyItMatters:   "Orphans are unresolved state by definition. Adding live exposure on top of a dirty paper-side audit trail is unsafe. D-5.10.5.5 Gate 9 enforces this.",
        howToVerify:    "SELECT count(*) FROM positions WHERE mode='paper' AND status='orphaned'",
        passCondition:  "count = 0",
        blockerMessage: "Investigate each orphan and either reconcile (via manual SQL with a justification recorded in metadata) or accept the loss in realized_pnl_usd and mark status='closed'. Do not bulk-delete without per-row review.",
        autoVerifiable: true,
        requiredForGo:  true,
        source: { type: "postgres", detail: "positions WHERE mode='paper' AND status='orphaned'" },
        verify: (ctx) => {
          if (typeof ctx.paperOrphanCount !== "number") return BLOCKED("paper orphan count unavailable");
          return ctx.paperOrphanCount === 0
            ? PASS(`count=${ctx.paperOrphanCount}`)
            : BLOCKED(`count=${ctx.paperOrphanCount}`);
        },
      },
      {
        id: "position-json-matches-db",
        ordinal: 3,
        title: "position.json matches DB for the currently-open paper position",
        whyItMatters:   "D-5.10.2 rehydration writes JSON from DB on each cycle. A persistent mismatch indicates a write-path bug.",
        howToVerify:    "Compare /api/health.persistence.files['position.json'].bytes to expected size from _dbPosToLegacy(...) of the open paper row",
        passCondition:  "Byte-equal match",
        blockerMessage: "If mismatch persists across several cycles, investigate _legacyPositionsEqual and _rehydratePositionJson in bot.js.",
        autoVerifiable: false, // requires _dbPosToLegacy serialization not exposed here
        requiredForGo:  true,
        source: { type: "manual", detail: "/api/health + JSON size comparison" },
        verify: null,
      },
    ],
  },
  {
    id: "database-readiness",
    ordinal: 4,
    title: "Database Readiness",
    items: [
      {
        id: "schema-version-at-least-5",
        ordinal: 1,
        title: "schemaVersion >= 5",
        whyItMatters:   "Live preflight Gate 4 requires schema >= 5 so the bot_control halt-tracking columns (D-5.10.5.2) and Kraken permission cache columns (D-5.10.5.4) exist. Older schemas would halt every live cycle.",
        howToVerify:    "curl /api/health | jq '.database.schemaVersion'",
        passCondition:  ">= 5",
        blockerMessage: "Run npm run migrate against the production Postgres until schemaVersion catches up.",
        autoVerifiable: true,
        requiredForGo:  true,
        source: { type: "postgres", detail: "schema_migrations" },
        verify: (ctx) => {
          const sv = ctx.schemaVersion;
          if (!sv) return BLOCKED("schema_migrations unreachable");
          const v = sv.version ?? 0;
          return v >= REQUIRED_DB_SCHEMA_VERSION
            ? PASS(`version=${v} name=${sv.name}`)
            : FAIL(`version=${v} required>=${REQUIRED_DB_SCHEMA_VERSION}`);
        },
      },
      {
        id: "core-tables-present",
        ordinal: 2,
        title: "All four core tables present and queryable",
        whyItMatters:   "The live shadow-write paths depend on bot_control, trade_events, positions, and strategy_signals all being healthy.",
        howToVerify:    "curl /api/health | jq '.database.tables'",
        passCondition:  "All four tables listed with non-error row counts",
        blockerMessage: "Any table missing or returning an error indicates a schema or permission problem. Investigate before live activation.",
        autoVerifiable: true,
        requiredForGo:  true,
        source: { type: "postgres", detail: "information_schema / count() probes" },
        verify: (ctx) => {
          if (ctx.tablesPresent === true) return PASS("4/4 tables queryable");
          if (ctx.tablesPresent === false) return FAIL(ctx.tablesError ?? "table probe failed");
          return BLOCKED("tables probe not run");
        },
      },
      {
        id: "postgres-latency-reasonable",
        ordinal: 3,
        title: "Postgres latency reasonable",
        whyItMatters:   "High DB latency could cause shadow writes to lag behind JSON, widening the JSON↔DB drift window.",
        howToVerify:    "curl /api/health | jq '.database.latencyMs' over several samples",
        passCondition:  `latency < ${PG_LATENCY_OK_MS} ms typical`,
        blockerMessage: "If latency spikes are routine, investigate Railway's DB tier or network path before live activation.",
        autoVerifiable: true,
        requiredForGo:  true,
        source: { type: "postgres", detail: "ping() round-trip" },
        verify: (ctx) => {
          if (typeof ctx.dbLatencyMs !== "number") return BLOCKED("ping unavailable");
          return ctx.dbLatencyMs < PG_LATENCY_OK_MS
            ? PASS(`latencyMs=${ctx.dbLatencyMs}`)
            : FAIL(`latencyMs=${ctx.dbLatencyMs} threshold=${PG_LATENCY_OK_MS}`);
        },
      },
      {
        id: "bot-control-row-1-healthy",
        ordinal: 4,
        title: "bot_control row #1 exists and is healthy",
        whyItMatters:   "The single-row table holds halt-tracking, permission-cache, and risk-rule state. A missing row would break multiple gates.",
        howToVerify:    "SELECT count(*) FROM bot_control",
        passCondition:  "Exactly one row, id=1",
        blockerMessage: "Re-run migration 001 if the row is missing (migration is idempotent and re-seeds via INSERT … ON CONFLICT DO NOTHING).",
        autoVerifiable: true,
        requiredForGo:  true,
        source: { type: "postgres", detail: "bot_control" },
        verify: (ctx) => {
          if (ctx.botControl && ctx.botControl.id === 1) return PASS("row id=1 present");
          return FAIL("bot_control row #1 missing or wrong id");
        },
      },
    ],
  },
  {
    id: "kraken-readiness",
    ordinal: 5,
    title: "Kraken Readiness",
    items: [
      { id: "kraken-account-funded",        ordinal: 1, title: "Kraken account funded with margin balance",
        whyItMatters: "Live trades require margin. An unfunded account fails at order placement.",
        howToVerify: "Kraken UI → Account → Funding → confirm USD balance present and margin enabled",
        passCondition: "balance >= 5x intended position size",
        blockerMessage: "Fund the account before activation. Recommended initial balance: $50-100 for the first staged rollout step.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "Kraken UI" }, verify: null },
      { id: "kraken-key-permissions-correct", ordinal: 2, title: "Kraken API key has correct permissions",
        whyItMatters: "Read-only keys pass D-5.10.3 / D-5.10.4 / D-5.10.5 but fail at first AddOrder. D-5.10.5.4's cached probe catches this, but the operator should verify directly.",
        howToVerify: "Kraken UI → Account → API → key permissions tab",
        passCondition: "Required: Query Funds, Query Open & Closed Orders, Modify Orders, Cancel/Close Orders. Forbidden: Withdraw Funds, Transfer Funds.",
        blockerMessage: "Update the key in Kraken UI before activation. A bot running with Withdraw Funds permission is a critical risk.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "Kraken UI key tab" }, verify: null },
      { id: "kraken-2fa-enabled", ordinal: 3, title: "2FA enabled on Kraken account",
        whyItMatters: "Protects the account itself. A bot trading on a non-2FA account is a security failure.",
        howToVerify: "Kraken UI → Security → Two-Factor Authentication",
        passCondition: "2FA enabled (TOTP or hardware key)",
        blockerMessage: "Enable 2FA before activation. Non-negotiable.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "Kraken UI" }, verify: null },
      { id: "kraken-withdrawal-whitelist", ordinal: 4, title: "Withdrawal whitelist enabled and tested",
        whyItMatters: "Even though the bot's API key shouldn't have withdraw permission, account-level whitelisting prevents funds from being moved if the master account is compromised.",
        howToVerify: "Kraken UI → Funding → Withdrawal Limits / Address Book → confirm whitelist on, only operator addresses",
        passCondition: "Whitelist active; only operator addresses present",
        blockerMessage: "Configure whitelist in Kraken before activation.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "Kraken UI" }, verify: null },
      { id: "kraken-account-flat", ordinal: 5, title: "Kraken account is currently flat",
        whyItMatters: "Live activation should start from a known zero-position state. Existing positions would trigger D-5.10.5 reconciliation halts.",
        howToVerify: "Kraken UI → Trade → Positions → confirm 'No open positions for any pair'",
        passCondition: "Zero open positions across all pairs",
        blockerMessage: "Close all positions on Kraken before activation, or accept they will trigger D-5.10.5 reconciliation halts.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "Kraken UI" }, verify: null },
      { id: "kraken-perm-cache-ok", ordinal: 6, title: "D-5.10.5.4 permission probe cache shows ok=true",
        whyItMatters: "The cached probe needs to have run at least once successfully so subsequent cycles skip the AddOrder validate=true call.",
        howToVerify: "SELECT kraken_perm_check_at, kraken_perm_check_ok, kraken_perm_check_reason FROM bot_control WHERE id=1",
        passCondition: "kraken_perm_check_ok = true AND kraken_perm_check_at is recent",
        blockerMessage: "This can only be verified after first armed live cycle. Document as expected pre-activation state.",
        autoVerifiable: true, requiredForGo: true,
        source: { type: "postgres", detail: "bot_control.kraken_perm_check_*" },
        verify: (ctx) => {
          const c = ctx.botControl;
          if (!c) return BLOCKED("bot_control row missing");
          if (c.kraken_perm_check_at == null) {
            return WAITING("probe never run (expected pre-activation)");
          }
          if (c.kraken_perm_check_ok === true) return PASS(`ok=true at=${c.kraken_perm_check_at}`);
          return FAIL(`ok=false reason=${c.kraken_perm_check_reason}`);
        } },
    ],
  },
  {
    id: "db-vs-kraken-reconciliation",
    ordinal: 6,
    title: "DB vs Kraken Reconciliation",
    items: [
      { id: "d-5-10-5-reconcile-tested", ordinal: 1, title: "D-5.10.5 reconciliation differ unit-tested",
        whyItMatters: "The pure-function differ has 11 mismatch cases. A bug here would either falsely halt or, worse, falsely pass.",
        howToVerify: "D-5.10.5 commit (2e3fa27) records the 12-row test matrix",
        passCondition: "All matrix cases passed at implementation",
        blockerMessage: "Re-run the synthetic matrix if any helper changed since.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "git log / commit message" },
        verify: () => MANUAL("verified at D-5.10.5 commit 2e3fa27 (12/12 matrix)") },
      { id: "d-5-10-5-7-smoke-test-passed", ordinal: 2, title: "D-5.10.5.7 live shadow-write smoke test passed",
        whyItMatters: "Confirms the mode='live' write paths work end-to-end against real Postgres.",
        howToVerify: "Run scripts/smoke-test-live-writes.js",
        passCondition: "Exit 0, all assertions PASS, post-cleanup live row counts equal pre-test snapshot",
        blockerMessage: "Any assertion failure indicates a real bug in the live write path. Fix before activation.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "smoke test exit code + output" },
        verify: () => MANUAL("verified at D-5.10.5.7 run (38/38 assertions, exit 0)") },
      { id: "no-live-rows-in-db", ordinal: 3, title: "No live rows in production DB pre-activation",
        whyItMatters: "Live row counts must start at 0 so the first armed cycle's reconciliation has a clean baseline.",
        howToVerify: "SELECT count(*) FROM trade_events WHERE mode='live'; (and positions, strategy_signals)",
        passCondition: "All three return 0",
        blockerMessage: "If any non-zero, identify the source and DELETE before activation.",
        autoVerifiable: true, requiredForGo: true,
        source: { type: "postgres", detail: "live row counts" },
        verify: (ctx) => {
          const t = ctx.liveTradeEventsCount, p = ctx.liveOpenCount, s = ctx.liveStrategySignalsCount;
          if (typeof t !== "number" || typeof p !== "number" || typeof s !== "number") {
            return BLOCKED("live counts unavailable");
          }
          if (t === 0 && p === 0 && s === 0) return PASS("all zero");
          return FAIL(`trade_events=${t} positions(open)=${p} strategy_signals=${s}`);
        } },
      { id: "d-5-10-6-implemented", ordinal: 4, title: "D-5.10.6 final activation gate implemented",
        whyItMatters: "The actual live-trading authorization gate that permits the trade-decision branch to fire placeKrakenOrder does not yet exist.",
        howToVerify: "Search bot.js for 'D-5.10.6' references",
        passCondition: "D-5.10.6 implemented and verified",
        blockerMessage: "Live activation is impossible without D-5.10.6. This is the headline blocker.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "bot.js source" },
        verify: () => BLOCKED("D-5.10.6 not yet implemented") },
    ],
  },
  {
    id: "dashboard-readiness",
    ordinal: 7,
    title: "Dashboard Readiness",
    items: [
      { id: "api-health-reachable", ordinal: 1, title: "/api/health endpoint reachable and well-formed",
        whyItMatters: "External monitoring and the operator's primary visibility tool depend on /api/health being live.",
        howToVerify: "curl /api/health | jq '.success'",
        passCondition: "Returns true; full schema present",
        blockerMessage: "Dashboard service down. Investigate Railway logs.",
        autoVerifiable: true, requiredForGo: true,
        source: { type: "http", detail: "/api/health" },
        verify: (ctx) => {
          if (!ctx.healthSnapshot) return MANUAL("no health snapshot supplied to generator");
          return ctx.healthSnapshot.success === true ? PASS("success=true") : FAIL("success=false");
        } },
      { id: "bot-running-and-cron-current", ordinal: 2, title: "/api/health.bot = 'running' and lastRunAge < 6 minutes",
        whyItMatters: "Confirms the bot's cron is firing on schedule.",
        howToVerify: "curl /api/health | jq '{bot, lastRunAge}'",
        passCondition: `bot: 'running' AND lastRunAge < ${LAST_RUN_AGE_OK_SEC}`,
        blockerMessage: "Stuck cron — check Railway service status.",
        autoVerifiable: true, requiredForGo: true,
        source: { type: "http", detail: "/api/health" },
        verify: (ctx) => {
          const h = ctx.healthSnapshot;
          if (!h) return MANUAL("no health snapshot supplied to generator");
          const ok = h.bot === "running" && (h.lastRunAge ?? 9999) < LAST_RUN_AGE_OK_SEC;
          return ok ? PASS(`bot=${h.bot} lastRunAge=${h.lastRunAge}`)
                    : FAIL(`bot=${h.bot} lastRunAge=${h.lastRunAge}`);
        } },
      { id: "kraken-online-and-low-latency", ordinal: 3, title: "/api/health.kraken = 'online' with reasonable latency",
        whyItMatters: "Kraken connectivity must be healthy at activation time.",
        howToVerify: "curl /api/health | jq '{kraken, krakenLatency}'",
        passCondition: `kraken: 'online', krakenLatency < ${KRAKEN_LATENCY_OK_MS}`,
        blockerMessage: "Investigate Kraken's status page or the network path before activation.",
        autoVerifiable: true, requiredForGo: true,
        source: { type: "http", detail: "/api/health" },
        verify: (ctx) => {
          const h = ctx.healthSnapshot;
          if (!h) return MANUAL("no health snapshot supplied to generator");
          const ok = h.kraken === "online" && (h.krakenLatency ?? 9999) < KRAKEN_LATENCY_OK_MS;
          return ok ? PASS(`kraken=${h.kraken} latency=${h.krakenLatency}`)
                    : FAIL(`kraken=${h.kraken} latency=${h.krakenLatency}`);
        } },
      { id: "dashboard-pages-render", ordinal: 4, title: "Dashboard pages render",
        whyItMatters: "Operator needs the dashboard for live monitoring.",
        howToVerify: "Visit / /paper /live /dashboard-v2 while authenticated",
        passCondition: "All four pages render",
        blockerMessage: "Dashboard regression. Investigate before activation.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "browser inspection" }, verify: null },
      { id: "v2-in-shadow-mode", ordinal: 5, title: "V2 strategy is in shadow mode (not live)",
        whyItMatters: "V2 is a separate strategy that should NOT be active in live mode without its own readiness review.",
        howToVerify: "Cycle log lines should show '[V2-shadow]' prefix on V2 evaluations, never '[V2-live]'",
        passCondition: "Every V2 log line in the past hour begins with '[V2-shadow]'",
        blockerMessage: "V2 live activation is a separate phase; do not proceed if V2 is somehow live.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "logs", detail: "[V2-...] prefix" }, verify: null },
    ],
  },
  {
    id: "discord-alert-readiness",
    ordinal: 8,
    title: "Discord / Alert Readiness",
    items: [
      { id: "discord-webhook-set", ordinal: 1, title: "DISCORD_WEBHOOK env var set in production",
        whyItMatters: "Live halts emit Discord alerts. Without a configured webhook the operator gets no real-time notification.",
        howToVerify: "Railway dashboard → service → Variables → confirm DISCORD_WEBHOOK is present and non-empty",
        passCondition: "Variable present, value is a valid Discord webhook URL",
        blockerMessage: "Configure webhook before activation.",
        autoVerifiable: true, requiredForGo: true,
        source: { type: "env-var", detail: "DISCORD_WEBHOOK presence" },
        verify: (ctx) => ctx.env.discordWebhookSet
          ? PASS("DISCORD_WEBHOOK set (URL not exposed)")
          : FAIL("DISCORD_WEBHOOK unset") },
      { id: "discord-webhook-delivery-tested", ordinal: 2, title: "Discord webhook delivery test passes",
        whyItMatters: "A stale or revoked webhook URL silently fails. Operator must confirm a real test message lands.",
        howToVerify: "POST a test message to DISCORD_WEBHOOK and confirm HTTP 204",
        passCondition: "HTTP 204 response; message visible in Discord channel",
        blockerMessage: "Webhook broken. Generate a new one in Discord channel settings.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "operator-driven test post" }, verify: null },
      { id: "d-5-10-5-2-templates-loaded", ordinal: 3, title: "D-5.10.5.2 plain-English templates loaded",
        whyItMatters: "Operators need clear, actionable alerts — not technical jargon — to respond effectively.",
        howToVerify: "D-5.10.5.2 commit (b6c4c64) ships 20 templates",
        passCondition: "Templates present",
        blockerMessage: "Unlikely; would require code regression.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "git log / bot.js HALT_TEMPLATES" },
        verify: () => MANUAL("verified at D-5.10.5.2 commit b6c4c64") },
      { id: "operator-subscribed-to-discord", ordinal: 4, title: "Operator subscribed to Discord channel with push notifications",
        whyItMatters: "Alerts fire at any hour. Operator must be reachable.",
        howToVerify: "Operator confirms personal device has the channel in a notifications-enabled state",
        passCondition: "Operator self-attests",
        blockerMessage: "Do not activate without operator notification readiness.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "operator attestation" }, verify: null },
      { id: "d-5-10-5-2-dedup-verified", ordinal: 5, title: "D-5.10.5.2 dedup verified end-to-end",
        whyItMatters: "Without dedup, a persistent halt would emit one Discord alert every 5 minutes (~288/day) and operators would mute the channel.",
        howToVerify: "Synthetic test of one halt-then-clear cycle in sandbox",
        passCondition: "Dedup observed working in a real (or sandbox) halt scenario",
        blockerMessage: "Production has not yet exercised any live halt (paper mode dormant for D-5.10.x). Verify in sandbox or wait for first armed cycle.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "sandbox test outcome" },
        verify: () => WAITING("no production live halts yet; verify in sandbox") },
    ],
  },
  {
    id: "risk-protection",
    ordinal: 9,
    title: "Risk Protection",
    items: [
      { id: "risk-pct-bounded", ordinal: 1, title: `bot_control.risk_pct <= ${RISK_PCT_MAX}`,
        whyItMatters: "Caps per-trade risk relative to account balance. 1% is the design conservative default; higher is generally unsafe for first activation.",
        howToVerify: "SELECT risk_pct FROM bot_control WHERE id=1",
        passCondition: `risk_pct <= ${RISK_PCT_MAX}`,
        blockerMessage: "Lower via dashboard or SQL before activation.",
        autoVerifiable: true, requiredForGo: true,
        source: { type: "postgres", detail: "bot_control.risk_pct" },
        verify: (ctx) => {
          if (!ctx.botControl) return BLOCKED("bot_control row missing");
          const v = parseFloat(ctx.botControl.risk_pct);
          return Number.isFinite(v) && v <= RISK_PCT_MAX
            ? PASS(`risk_pct=${v}`)
            : FAIL(`risk_pct=${v} threshold=${RISK_PCT_MAX}`);
        } },
      { id: "max-daily-loss-bounded", ordinal: 2, title: `bot_control.max_daily_loss_pct <= ${MAX_DAILY_LOSS_PCT_MAX}`,
        whyItMatters: "Daily kill-switch. Caps total loss per day across all trades.",
        howToVerify: "SELECT max_daily_loss_pct FROM bot_control WHERE id=1",
        passCondition: `<= ${MAX_DAILY_LOSS_PCT_MAX}`,
        blockerMessage: "Lower before activation.",
        autoVerifiable: true, requiredForGo: true,
        source: { type: "postgres", detail: "bot_control.max_daily_loss_pct" },
        verify: (ctx) => {
          if (!ctx.botControl) return BLOCKED("bot_control row missing");
          const v = parseFloat(ctx.botControl.max_daily_loss_pct);
          return Number.isFinite(v) && v <= MAX_DAILY_LOSS_PCT_MAX
            ? PASS(`max_daily_loss_pct=${v}`)
            : FAIL(`max_daily_loss_pct=${v} threshold=${MAX_DAILY_LOSS_PCT_MAX}`);
        } },
      { id: "kill-switch-enabled-and-bounded", ordinal: 3, title: `kill_switch_enabled = true AND kill_switch_drawdown_pct <= ${KILL_SWITCH_DD_PCT_MAX}`,
        whyItMatters: "Drawdown circuit breaker. Halts trading entirely on cumulative drawdown threshold.",
        howToVerify: "SELECT kill_switch_enabled, kill_switch_drawdown_pct FROM bot_control WHERE id=1",
        passCondition: `kill_switch_enabled=true AND kill_switch_drawdown_pct <= ${KILL_SWITCH_DD_PCT_MAX}`,
        blockerMessage: "Enable kill switch and set conservative threshold before activation.",
        autoVerifiable: true, requiredForGo: true,
        source: { type: "postgres", detail: "bot_control.kill_switch_*" },
        verify: (ctx) => {
          if (!ctx.botControl) return BLOCKED("bot_control row missing");
          const en = ctx.botControl.kill_switch_enabled;
          const dd = parseFloat(ctx.botControl.kill_switch_drawdown_pct);
          if (en === true && Number.isFinite(dd) && dd <= KILL_SWITCH_DD_PCT_MAX) {
            return PASS(`enabled=${en} drawdown_pct=${dd}`);
          }
          return FAIL(`enabled=${en} drawdown_pct=${dd} threshold=${KILL_SWITCH_DD_PCT_MAX}`);
        } },
      { id: "leverage-bounded", ordinal: 4, title: `bot_control.leverage <= ${FIRST_ACTIVATION_LEVERAGE_MAX} for first activation`,
        whyItMatters: "3x leverage is too aggressive for a live debut. First activation should use 2x or 1x.",
        howToVerify: "SELECT leverage FROM bot_control WHERE id=1",
        passCondition: `<= ${FIRST_ACTIVATION_LEVERAGE_MAX}`,
        blockerMessage: "Lower leverage before activation.",
        autoVerifiable: true, requiredForGo: true,
        source: { type: "postgres", detail: "bot_control.leverage" },
        verify: (ctx) => {
          if (!ctx.botControl) return BLOCKED("bot_control row missing");
          const lev = ctx.botControl.leverage;
          return typeof lev === "number" && lev <= FIRST_ACTIVATION_LEVERAGE_MAX
            ? PASS(`leverage=${lev}`)
            : FAIL(`leverage=${lev} threshold=${FIRST_ACTIVATION_LEVERAGE_MAX}`);
        } },
      { id: "d-5-10-5-5-cutover-active", ordinal: 5, title: "D-5.10.5.5 mode-cutover gates active",
        whyItMatters: "Refuses live activation while paper has open positions or orphans. Prevents accidental cutover.",
        howToVerify: "D-5.10.5.5 commit (3ab4f02) added Gates 8 and 9 to _liveDbPreflight()",
        passCondition: "Gates present",
        blockerMessage: "Unlikely; would require code regression.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "git log / bot.js _liveDbPreflight" },
        verify: () => MANUAL("verified at D-5.10.5.5 commit 3ab4f02") },
      { id: "recovery-runbook-rehearsed", ordinal: 6, title: "Recovery runbook rehearsed",
        whyItMatters: "When something goes wrong at 3 a.m., operator needs muscle memory, not improvisation.",
        howToVerify: "Operator has rehearsed each recovery level at least once in a sandbox",
        passCondition: "Operator self-attests; written runbook exists",
        blockerMessage: "Do not activate without runbook practice.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "operator attestation" }, verify: null },
    ],
  },
  {
    id: "final-operator-approval",
    ordinal: 10,
    title: "Final Operator Approval",
    items: [
      { id: "all-preceding-complete", ordinal: 1, title: "All preceding sections complete",
        whyItMatters: "This is the gate that blocks live activation.",
        howToVerify: "Every checkbox above is [X] and every status field is PASS or MANUAL (with operator confirmation)",
        passCondition: "Zero FAIL / WAITING / BLOCKED items",
        blockerMessage: "Complete the outstanding items first.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "operator review of preceding sections" }, verify: null },
      { id: "staged-rollout-agreed", ordinal: 2, title: "Staged rollout plan agreed",
        whyItMatters: "Full-size live activation on day one is too risky.",
        howToVerify: "Operator has documented sequence: $5 → $50 → $500 → full size",
        passCondition: "Operator commits to staged rollout in writing",
        blockerMessage: "Do not jump to full size on activation. Start small.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "operator attestation" }, verify: null },
      { id: "oncall-schedule-set", ordinal: 3, title: "On-call schedule for first 24 hours",
        whyItMatters: "First 24 hours of live trading need active monitoring.",
        howToVerify: "Operator schedule documented; backup briefed",
        passCondition: "Schedule exists with named primary and backup",
        blockerMessage: "Arrange coverage before activation.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "operator attestation" }, verify: null },
      { id: "operator-signoff", ordinal: 4, title: "Final go/no-go signed by operator",
        whyItMatters: "The explicit human sign-off prevents accidental activation from automation, drift, or misunderstanding.",
        howToVerify: "Operator signs LC-1 §10.4 with date and full name",
        passCondition: "Sign-off recorded",
        blockerMessage: "Without explicit sign-off, live trading must remain disabled.",
        autoVerifiable: false, requiredForGo: true,
        source: { type: "manual", detail: "LC-1 §10.4 signed line" }, verify: null },
    ],
  },
];

// ─── Context loader ─────────────────────────────────────────────────────────
// Single batched load. Runs SELECT-only queries via existing read-only db.js
// helpers. On individual query failures, the corresponding ctx field is left
// undefined; verifiers see undefined and emit BLOCKED so the overall object
// still produces a finalStatus = NO-GO with diagnostic observations.

async function loadCtx({ healthSnapshot } = {}) {
  const ctx = {
    botControl: null,
    paperOpenCount: undefined,
    paperOrphanCount: undefined,
    liveOpenCount: undefined,
    liveTradeEventsCount: undefined,
    liveStrategySignalsCount: undefined,
    schemaVersion: null,
    tablesPresent: undefined,
    tablesError: null,
    dbLatencyMs: undefined,
    healthSnapshot: healthSnapshot ?? null,
    env: {
      // Booleans only — never expose env-var values themselves.
      liveTradingArmedSet: (() => {
        const v = (process.env.LIVE_TRADING_ARMED || "").trim().toLowerCase();
        return v === "1" || v === "true";
      })(),
      discordWebhookSet: !!(process.env.DISCORD_WEBHOOK || "").trim(),
    },
  };

  // Run independent queries in parallel; each individual failure caught.
  const tasks = await Promise.allSettled([
    query(`SELECT id, paper_trading, killed, paused, leverage, risk_pct,
                  max_daily_loss_pct, kill_switch_enabled, kill_switch_drawdown_pct,
                  kraken_perm_check_at, kraken_perm_check_ok,
                  kraken_perm_check_reason, kraken_perm_check_detail
           FROM bot_control WHERE id = 1`),
    countOpenPositions("paper"),
    countOrphanedPositions("paper"),
    countOpenPositions("live"),
    query("SELECT count(*)::int AS c FROM trade_events     WHERE mode = 'live'"),
    query("SELECT count(*)::int AS c FROM strategy_signals WHERE mode = 'live'"),
    dbSchemaVersion(),
    dbPing(),
  ]);

  if (tasks[0].status === "fulfilled") {
    ctx.botControl = tasks[0].value.rows[0] ?? null;
  }
  if (tasks[1].status === "fulfilled") ctx.paperOpenCount   = tasks[1].value;
  if (tasks[2].status === "fulfilled") ctx.paperOrphanCount = tasks[2].value;
  if (tasks[3].status === "fulfilled") ctx.liveOpenCount    = tasks[3].value;
  if (tasks[4].status === "fulfilled") ctx.liveTradeEventsCount     = tasks[4].value.rows[0].c;
  if (tasks[5].status === "fulfilled") ctx.liveStrategySignalsCount = tasks[5].value.rows[0].c;
  if (tasks[6].status === "fulfilled") ctx.schemaVersion    = tasks[6].value;
  if (tasks[7].status === "fulfilled") ctx.dbLatencyMs      = tasks[7].value.latencyMs ?? null;

  // tablesPresent is true if all four core tables responded. Each task above
  // touches one of: bot_control / positions / trade_events / strategy_signals.
  const dbTaskStatuses = [tasks[0], tasks[1], tasks[4], tasks[5]].map(t => t.status);
  if (dbTaskStatuses.every(s => s === "fulfilled")) {
    ctx.tablesPresent = true;
  } else {
    ctx.tablesPresent = false;
    const firstErr = [tasks[0], tasks[1], tasks[4], tasks[5]].find(t => t.status === "rejected");
    ctx.tablesError = firstErr?.reason?.message ?? "one or more table probes failed";
  }

  return ctx;
}

// ─── Aggregation helpers ────────────────────────────────────────────────────

function computeBlockers(sections) {
  const blockers = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (!item.requiredForGo) continue;
      // PASS clears the item; MANUAL with attestation clears it too.
      if (item.status === "PASS") continue;
      if (item.status === "MANUAL" && item.attestation) continue;
      blockers.push({
        sectionId: section.id,
        itemId: item.id,
        status: item.status,
        summary: item.title,
        blockerMessage: item.blockerMessage,
        ...(item.observation ? { observation: item.observation } : {}),
      });
    }
  }
  return blockers;
}

function computeSummary(sections) {
  const counts = { PASS: 0, FAIL: 0, WAITING: 0, BLOCKED: 0, MANUAL: 0 };
  let total = 0, requiredForGo = 0, informationalOnly = 0;
  for (const section of sections) {
    for (const item of section.items) {
      total++;
      if (item.requiredForGo) requiredForGo++; else informationalOnly++;
      if (item.status in counts) counts[item.status]++;
    }
  }
  return { totalItems: total, byStatus: counts, requiredForGo, informationalOnly };
}

function computeFinalStatus(sections) {
  // Conservative: any required item that's not PASS (or MANUAL-with-attestation)
  // forces NO-GO. Final operator sign-off (§10.4) is an additional hard gate.
  for (const section of sections) {
    for (const item of section.items) {
      if (!item.requiredForGo) continue;
      if (item.status === "PASS") continue;
      if (item.status === "MANUAL" && item.attestation) continue;
      return "NO-GO";
    }
  }
  // Final operator sign-off must be explicitly attested.
  const final = sections
    .find(s => s.id === "final-operator-approval")
    ?.items.find(i => i.id === "operator-signoff");
  if (!final || !final.attestation) return "NO-GO";
  return "GO";
}

function synthesizeNoGo(generatedAt, errMsg) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    finalStatus: "NO-GO",
    summary: {
      totalItems: 0,
      byStatus: { PASS: 0, FAIL: 0, WAITING: 0, BLOCKED: 1, MANUAL: 0 },
      requiredForGo: 1,
      informationalOnly: 0,
    },
    blockers: [
      {
        sectionId: "object-generation",
        itemId: "generator-error",
        status: "BLOCKED",
        summary: "Live-readiness object could not be computed",
        blockerMessage: "The generator threw or failed to load context. Live trading must remain blocked until the underlying issue is resolved.",
        observation: errMsg,
      },
    ],
    sections: [],
  };
}

// ─── Main entry point ──────────────────────────────────────────────────────

export async function buildLiveReadiness(opts = {}) {
  const generatedAt = new Date().toISOString();

  let ctx;
  try {
    ctx = await loadCtx(opts);
  } catch (e) {
    return synthesizeNoGo(generatedAt, `loadCtx failed: ${e.message}`);
  }

  let sections;
  try {
    sections = SECTIONS.map((section) => {
      const items = section.items.map((item) => {
        let result;
        try {
          result = item.verify ? item.verify(ctx) : MANUAL(null);
        } catch (e) {
          result = BLOCKED(`verifier error: ${e.message}`);
        }
        return {
          id: item.id,
          ordinal: item.ordinal,
          title: item.title,
          status: result.status,
          whyItMatters: item.whyItMatters,
          howToVerify: item.howToVerify,
          passCondition: item.passCondition,
          blockerMessage: item.blockerMessage,
          autoVerifiable: item.autoVerifiable,
          requiredForGo: item.requiredForGo,
          source: item.source,
          observation: result.observation ?? null,
          observationAt: result.observation != null ? generatedAt : null,
          lastChecked: generatedAt,
          attestation: null, // future LC-2.x phase will populate
        };
      });
      return { id: section.id, ordinal: section.ordinal, title: section.title, items };
    });
  } catch (e) {
    return synthesizeNoGo(generatedAt, `section build failed: ${e.message}`);
  }

  let blockers, summary, finalStatus;
  try {
    blockers = computeBlockers(sections);
    summary = computeSummary(sections);
    finalStatus = computeFinalStatus(sections);
  } catch (e) {
    return synthesizeNoGo(generatedAt, `aggregation failed: ${e.message}`);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    finalStatus,
    summary,
    blockers,
    sections,
  };
}
