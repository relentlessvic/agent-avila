import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, appendFileSync, unlinkSync, statSync } from "fs";
import path from "path";
import { createServer } from "http";
import { spawn } from "child_process";
import crypto from "crypto";
import { buildSystemStatus, runSystemCheck } from "./system-guardian.js";
// Phase D-5.4 — Postgres connection module. /api/health and the boot
// banner read DB liveness. Phase D-5.5 adds a fire-and-forget dual-write
// of bot_control after every successful writeFileSync(CONTROL_FILE,...).
// Phase D-5.7.1 adds inTransaction + trade_events/positions helpers for
// the manual PAPER_BUY / PAPER_CLOSE shadow writes inside handleTradeCommand.
// Phase D-5.8 adds the read-side helpers (loadRecent*/loadOpenPosition/
// loadPnL*/loadWinLoss*) used by getApiData, getHomeSummary,
// modeScopedSummary, and buildV2DashboardPayload to source trade history,
// P&L, W/L, and positions from Postgres instead of JSON/CSV.
import {
  query as dbQuery,
  ping as dbPing,
  schemaVersion as dbSchemaVersion,
  dbAvailable,
  databaseUrlPresent,
  maskedDatabaseUrl,
  inTransaction,
  buildEventId,
  insertTradeEvent,
  upsertPositionOpen,
  closePosition,
  loadRecentTradeEvents,
  loadOpenPosition,
  loadClosedPositions,
  loadPnLAggregates,
  loadWinLossAggregates,
} from "./db.js";

const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 3000;

// ─── Phase D-5.2 — DATA_DIR resolver + persistence probe ────────────────────
// Mirror of the bot.js resolver. Both processes share the same Railway
// container filesystem, so they MUST agree on where state files live. When
// DATA_DIR is set (e.g. DATA_DIR=/data on a Railway service with a Volume
// mounted at /data) every JSON/CSV state file lives on the persistent mount
// and survives redeploys. When DATA_DIR is unset, paths resolve to the
// current working directory — byte-identical to pre-D-5.2 behavior.
//
// PERSISTENCE.ok is exposed via /api/health (this phase) and consumed by
// the live-mode safety gate in a later phase.
const DATA_DIR = process.env.DATA_DIR || ".";
const dataPath = (name) => path.join(DATA_DIR, name);
const PERSISTENCE = (() => {
  try {
    if (!existsSync(DATA_DIR)) {
      return { ok: false, dir: DATA_DIR, isVolume: false, reason: "DATA_DIR does not exist" };
    }
    const probe = path.join(DATA_DIR, ".write-probe");
    writeFileSync(probe, String(Date.now()));
    unlinkSync(probe);
    const isVolume = /^\/(data|mnt|var\/data)/.test(DATA_DIR);
    return { ok: true, dir: DATA_DIR, isVolume, reason: null };
  } catch (e) {
    return { ok: false, dir: DATA_DIR, isVolume: false, reason: e.message };
  }
})();

// ─── Phase D-5.2 — runtime state-file path constants ────────────────────────
// All file reads/writes below this block route through these constants so
// the only place we declare a state-file path is here. Inline string
// literals like readFileSync(LOG_FILE) have been replaced.
const LOG_FILE          = dataPath("safety-check-log.json");
const POSITION_FILE     = dataPath("position.json");
const CSV_FILE          = dataPath("trades.csv");
const CONTROL_FILE      = dataPath("bot-control.json");
const PERF_STATE_FILE   = dataPath("performance-state.json");
const CAPITAL_FILE      = dataPath("capital-state.json");
const PORTFOLIO_FILE    = dataPath("portfolio-state.json");

// Structured logger — appears in Railway console, browser fetch errors, and local stdout
const log = {
  info:  (src, msg, ...x) => console.log(`[${new Date().toISOString()}] [INFO]  [${src}]`,  msg, ...x),
  warn:  (src, msg, ...x) => console.warn(`[${new Date().toISOString()}] [WARN]  [${src}]`,  msg, ...x),
  error: (src, msg, ...x) => console.error(`[${new Date().toISOString()}] [ERROR] [${src}]`, msg, ...x),
};

// ─── Standardized response helpers (success/fail) ────────────────────────────
function success(data) { return { success: true, data, ok: true }; }
function fail(error)   { return { success: false, error: (error?.message || error || "Unknown error"), ok: false }; }

function handleError(err, res, source) {
  log.error(source || "unhandled", err.message || String(err));
  console.error("🔥 Backend Error:", err);
  const status = err.status || 500;
  if (!res.headersSent) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(fail(err)));
  }
}

async function handleApiRoute(req, res, source, fn) {
  try {
    const data = await fn();
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(success(data)));
  } catch (err) {
    handleError(err, res, source);
  }
}

// Retry helper for ANY async function (Kraken, fetch, etc) — exponential backoff
async function withRetry(fn, retries = 2, delay = 500) {
  try { return await fn(); }
  catch (err) {
    if (retries <= 0) throw err;
    log.warn("retry", `attempt failed: ${err.message} — retrying in ${delay}ms`);
    await new Promise(res => setTimeout(res, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

// ─── Phase D-5.6 — bot_control read flip (DB-preferred, JSON fallback) ─────
// Read-side counterpart to D-5.5. Dashboard read paths now consume
// loadControl() instead of inline existsSync(CONTROL_FILE)+JSON.parse, which
// returns the Postgres-cached row when DB is healthy, the JSON file when DB
// is unavailable, and JSON when JSON's mtime is newer than the DB row's
// updated_at (the latter handles bot.js auto-pause / auto-kill / cooldown
// updates that haven't been replicated to Postgres yet — bot.js still writes
// JSON only; that dual-write lands in a future phase).
//
// Sync semantics preserved: existing callers (getApiData, getHomeSummary,
// modeScopedSummary) remain synchronous. The DB cache is refreshed on a
// 30-second TTL by fire-and-forget background reads, plus immediately after
// every successful syncBotControlToDb() upsert.
//
// Mutation paths (/api/control POST, /api/chat auto-execute) intentionally
// keep JSON-direct reads so a stale DB cache cannot mask the latest
// bot-driven state when applying a user command.

let _dbCtrlCache = null;
let _dbCtrlCacheTs = 0;
const DB_CTRL_CACHE_TTL_MS = 30_000;

function _mapDbRowToCtrl(row) {
  if (!row) return null;
  // Inverse of the snake_case→camelCase mapping done by syncBotControlToDb.
  // pg returns NUMERIC as strings (precision-preserving) and TIMESTAMPTZ /
  // DATE as Date objects; coerce to the JSON shape every consumer expects.
  const toIso = (v) => v ? (v instanceof Date ? v.toISOString() : String(v)) : null;
  const toDate = (v) => v ? (v instanceof Date ? v.toISOString().slice(0,10) : String(v)) : null;
  return {
    paperTrading:           row.paper_trading,
    stopped:                row.stopped,
    paused:                 row.paused,
    pausedUntil:            toIso(row.paused_until),
    killed:                 row.killed,
    leverage:               row.leverage,
    riskPct:                parseFloat(row.risk_pct),
    dynamicSizing:          row.dynamic_sizing,
    maxDailyLossPct:        parseFloat(row.max_daily_loss_pct),
    cooldownMinutes:        row.cooldown_minutes,
    killSwitchEnabled:      row.kill_switch_enabled,
    killSwitchDrawdownPct:  parseFloat(row.kill_switch_drawdown_pct),
    pauseAfterLosses:       row.pause_after_losses,
    consecutiveLosses:      row.consecutive_losses,
    lastTradeTime:          toIso(row.last_trade_time),
    leverageDisabledUntil:  toIso(row.leverage_disabled_until),
    lastSummaryDate:        toDate(row.last_summary_date),
    updatedBy:              row.updated_by,
    updatedAt:              toIso(row.updated_at),
  };
}

async function _refreshDbCtrlCache() {
  if (!dbAvailable()) return;
  try {
    const r = await dbQuery("SELECT * FROM bot_control WHERE id = 1");
    if (r.rows.length) {
      _dbCtrlCache = _mapDbRowToCtrl(r.rows[0]);
      _dbCtrlCacheTs = Date.now();
    }
  } catch (e) {
    // Don't clear an existing cache — stale-but-set beats empty during a blip.
    log.warn("d-5.6 cache", `bot_control DB read failed: ${e.message}`);
  }
}

function _loadControlFromJson() {
  if (!existsSync(CONTROL_FILE)) return {};
  try { return JSON.parse(readFileSync(CONTROL_FILE, "utf8")); }
  catch { return {}; }
}

// Sync API. Returns the freshest available control state.
//
// Decision tree:
//   1. If DATABASE_URL unset → JSON only. (Local dev / pre-Postgres.)
//   2. If DB cache fresh (<30s) AND JSON mtime <= cache.updated_at + 2s
//        → return cache.
//   3. If DB cache fresh BUT JSON mtime newer than cache by >2s
//        → return JSON, kick async sync to push JSON state into DB cache+row.
//          (This is the bot.js-wrote-JSON-but-not-DB reconciliation path.)
//   4. If DB cache stale or missing → return JSON, kick async refresh.
//      Next call should land in branch 2 or 3.
function loadControl() {
  if (!dbAvailable()) return _loadControlFromJson();

  const now = Date.now();
  const cacheFresh = _dbCtrlCache && (now - _dbCtrlCacheTs) < DB_CTRL_CACHE_TTL_MS;

  if (cacheFresh) {
    // Reconcile against JSON mtime: if JSON is newer than the cached DB
    // row's updated_at by >2s (clock-skew tolerance), bot.js wrote a
    // bot-driven update and Postgres is behind. Use JSON, sync DB.
    let jsonMtime = 0;
    try {
      if (existsSync(CONTROL_FILE)) jsonMtime = statSync(CONTROL_FILE).mtimeMs;
    } catch {}
    const cacheUpdatedMs = _dbCtrlCache.updatedAt ? new Date(_dbCtrlCache.updatedAt).getTime() : 0;
    if (jsonMtime > cacheUpdatedMs + 2000) {
      const jsonCtrl = _loadControlFromJson();
      if (Object.keys(jsonCtrl).length > 0) {
        // Push the JSON state to DB so subsequent reads converge. The
        // sync helper updates _dbCtrlCache on success, so the next
        // loadControl() call will land in the cacheFresh branch with a
        // matching updated_at and skip this reconcile.
        syncBotControlToDb(jsonCtrl);
        return jsonCtrl;
      }
    }
    return _dbCtrlCache;
  }

  // Cache stale or missing — kick a refresh, return JSON now so the caller
  // gets fresh-as-possible state without blocking.
  _refreshDbCtrlCache().catch(() => {});
  return _loadControlFromJson();
}

// Module-load warm-up: populate _dbCtrlCache before the first request lands.
// Fire-and-forget — local dev or pre-Postgres deploys silently no-op.
if (databaseUrlPresent) {
  _refreshDbCtrlCache().catch(() => {});
}

// ─── Phase D-5.5 — bot_control dual-write to Postgres ──────────────────────
// Shadow write: every successful writeFileSync(CONTROL_FILE, ...) is followed
// by an UPSERT into the Postgres bot_control row (id=1). The dual-write also
// updates _dbCtrlCache on success so loadControl() converges immediately.
// Fire-and-forget: failure logs a warn line and is invisible to the
// /api/control caller, so paper controls are never blocked by DB latency.
//
// Mapping JSON-camelCase → SQL-snake_case is done explicitly here; the
// SQL column list mirrors migrations/001_init.sql. Defaults match
// bot.js DEFAULT_CONTROL so an undefined JSON key never writes a NULL
// where a NOT NULL DEFAULT is expected.
function syncBotControlToDb(ctrl) {
  if (!dbAvailable()) return;          // local dev / DATABASE_URL not set
  if (!ctrl || typeof ctrl !== "object") return;
  // Fire-and-forget. Any error inside the helper is caught and logged;
  // the caller never awaits.
  (async () => {
    try {
      await dbQuery(
        `INSERT INTO bot_control (
           id, paper_trading, stopped, paused, paused_until, killed,
           leverage, risk_pct, dynamic_sizing, max_daily_loss_pct,
           cooldown_minutes, kill_switch_enabled, kill_switch_drawdown_pct,
           pause_after_losses, consecutive_losses,
           last_trade_time, leverage_disabled_until, last_summary_date,
           updated_by, updated_at
         ) VALUES (
           1, $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12,
           $13, $14,
           $15, $16, $17,
           $18, COALESCE($19::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           paper_trading            = EXCLUDED.paper_trading,
           stopped                  = EXCLUDED.stopped,
           paused                   = EXCLUDED.paused,
           paused_until             = EXCLUDED.paused_until,
           killed                   = EXCLUDED.killed,
           leverage                 = EXCLUDED.leverage,
           risk_pct                 = EXCLUDED.risk_pct,
           dynamic_sizing           = EXCLUDED.dynamic_sizing,
           max_daily_loss_pct       = EXCLUDED.max_daily_loss_pct,
           cooldown_minutes         = EXCLUDED.cooldown_minutes,
           kill_switch_enabled      = EXCLUDED.kill_switch_enabled,
           kill_switch_drawdown_pct = EXCLUDED.kill_switch_drawdown_pct,
           pause_after_losses       = EXCLUDED.pause_after_losses,
           consecutive_losses       = EXCLUDED.consecutive_losses,
           last_trade_time          = EXCLUDED.last_trade_time,
           leverage_disabled_until  = EXCLUDED.leverage_disabled_until,
           last_summary_date        = EXCLUDED.last_summary_date,
           updated_by               = EXCLUDED.updated_by,
           updated_at               = EXCLUDED.updated_at`,
        [
          ctrl.paperTrading !== false,                 // $1  (default true)
          !!ctrl.stopped,                              // $2
          !!ctrl.paused,                               // $3
          ctrl.pausedUntil ?? null,                    // $4
          !!ctrl.killed,                               // $5
          ctrl.leverage ?? 2,                          // $6
          ctrl.riskPct ?? 1.0,                         // $7
          ctrl.dynamicSizing !== false,                // $8  (default true)
          ctrl.maxDailyLossPct ?? 3.0,                 // $9
          ctrl.cooldownMinutes ?? 15,                  // $10
          ctrl.killSwitchEnabled !== false,            // $11 (default true)
          ctrl.killSwitchDrawdownPct ?? 5.0,           // $12
          ctrl.pauseAfterLosses ?? 3,                  // $13
          ctrl.consecutiveLosses ?? 0,                 // $14
          ctrl.lastTradeTime ?? null,                  // $15 (ISO string ok)
          ctrl.leverageDisabledUntil ?? null,          // $16
          ctrl.lastSummaryDate ?? null,                // $17 (YYYY-MM-DD)
          ctrl.updatedBy ?? null,                      // $18
          ctrl.updatedAt ?? null,                      // $19 (COALESCE → NOW())
        ]
      );
      // Phase D-5.6 — mirror the just-written state into the read cache so
      // the next loadControl() call sees consistent state without waiting
      // for the 30s TTL refresh.
      _dbCtrlCache = { ...ctrl };
      _dbCtrlCacheTs = Date.now();
    } catch (e) {
      log.warn("d-5.5 dual-write", `bot_control DB sync failed: ${e.message}`);
    }
  })();
}

// ─── Phase D-5.7.1 — manual paper trade dual-write ──────────────────────────
// Two fire-and-forget shadow writers wired into handleTradeCommand's
// PAPER_BUY (BUY_MARKET / OPEN_LONG) and PAPER_CLOSE (CLOSE_POSITION)
// branches AFTER the existing JSON writes. Reuses D-5.7's transactional
// db.js helpers (upsertPositionOpen / closePosition / insertTradeEvent)
// so positions and trade_events stay in lockstep with a single BEGIN/COMMIT.
//
// Paper-only: the call sites guard with `if (isPaper)` so live manual
// commands continue writing JSON only — that path waits for D-5.12.
//
// Failure mode: caught .catch() emits a [d-5.7.1 dual-write] warn line;
// JSON has already succeeded, so the manual trade response is unaffected.

function shadowRecordManualPaperBuy(entry, newPos) {
  if (!dbAvailable()) return;
  if (!entry || !newPos || !newPos.orderId) return;
  inTransaction(async (client) => {
    const positionId = await upsertPositionOpen(client, {
      mode: "paper",
      symbol: newPos.symbol,
      side: newPos.side ?? "long",
      entry_price: newPos.entryPrice,
      entry_time: newPos.entryTime,
      entry_signal_score: null,                  // manual; no strategy score
      quantity: newPos.quantity,
      trade_size_usd: newPos.tradeSize,
      leverage: newPos.leverage ?? 1,
      effective_size_usd: newPos.effectiveSize ?? null,
      stop_loss: newPos.stopLoss,
      take_profit: newPos.takeProfit,
      volatility_level: null,
      kraken_order_id: newPos.orderId,
      metadata: { from: "dashboard", source: "manual_buy" },
    });
    await insertTradeEvent(client, {
      event_id: buildEventId(newPos.orderId, "manual_buy"),
      timestamp: entry.timestamp,
      mode: "paper",
      event_type: "manual_buy",
      symbol: entry.symbol,
      position_id: positionId,
      price: entry.price,
      quantity: newPos.quantity,
      usd_amount: entry.tradeSize,
      leverage: entry.leverage,
      kraken_order_id: newPos.orderId,
      decision_log: null,
      metadata: { source: "manual_buy" },
    });
  }).catch((e) => {
    log.warn("d-5.7.1 dual-write", `manual BUY DB write failed: ${e.message}`);
  });
}

function shadowRecordManualPaperClose(exitEntry) {
  if (!dbAvailable()) return;
  if (!exitEntry || !exitEntry.orderId) return;
  inTransaction(async (client) => {
    const positionId = await closePosition(client, "paper", {
      exit_price: exitEntry.price,
      exit_time: exitEntry.timestamp,
      exit_reason: "MANUAL_CLOSE",
      realized_pnl_usd: exitEntry.pnlUSD != null ? parseFloat(exitEntry.pnlUSD) : null,
      realized_pnl_pct: exitEntry.pct != null ? parseFloat(exitEntry.pct) : null,
      kraken_exit_order_id: exitEntry.orderId,
    });
    await insertTradeEvent(client, {
      event_id: buildEventId(exitEntry.orderId, "manual_close"),
      timestamp: exitEntry.timestamp,
      mode: "paper",
      event_type: "manual_close",
      symbol: exitEntry.symbol,
      position_id: positionId,
      price: exitEntry.price,
      quantity: exitEntry.quantity,
      usd_amount: exitEntry.tradeSize,
      pnl_usd: exitEntry.pnlUSD != null ? parseFloat(exitEntry.pnlUSD) : null,
      pnl_pct: exitEntry.pct != null ? parseFloat(exitEntry.pct) : null,
      kraken_order_id: exitEntry.orderId,
      decision_log: null,
      metadata: { source: "manual_close" },
    });
  }).catch((e) => {
    log.warn("d-5.7.1 dual-write", `manual CLOSE DB write failed: ${e.message}`);
  });
}

// ─── Phase D-5.8 — Postgres-first trade-history read wrappers ──────────────
// Two layers:
//   - Pure shape mappers (DB row → legacy log/position shape) so existing
//     consumers/UI render functions don't have to change.
//   - "_safe" wrappers around the db.js helpers that implement the
//     Postgres-first / JSON-fallback / degraded-state policy:
//       * dbAvailable() === false → caller falls through to JSON
//       * DB query throws         → return { degraded: true, ... } so UI
//         renders "—" / "Unavailable" rather than fake zeros (per scope)
//
// Policy rationale: JSON is wiped on every Railway deploy (no volume),
// so silently falling back to JSON when the DB is degraded would lie to
// the operator. The degraded shape makes it visible.

function _dbTradeEventToLegacyShape(r) {
  if (!r) return null;
  // event_type → legacy 'type' field that consumers / UI render against
  let type = null;
  switch (r.event_type) {
    case "buy_filled":     type = "BUY"; break;
    case "manual_buy":     type = "MANUAL_BUY"; break;
    case "reentry_buy":    type = "BUY_REENTRY"; break;
    case "exit_filled":
    case "manual_close":
    case "reentry_close":  type = "EXIT"; break;
    default:               type = String(r.event_type).toUpperCase();
  }
  // exit_reason: derive from event_type + metadata
  let exitReason = null;
  if (type === "EXIT") {
    if      (r.event_type === "manual_close")  exitReason = "MANUAL_CLOSE";
    else if (r.event_type === "reentry_close") exitReason = "REENTRY_SIGNAL";
    else if (r.metadata && typeof r.metadata === "object" && r.metadata.original_exit_reason) {
      exitReason = r.metadata.original_exit_reason;
    }
  }
  const ts = r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp);
  return {
    type,
    timestamp:    ts,
    symbol:       r.symbol,
    price:        r.price       != null ? parseFloat(r.price)       : null,
    quantity:     r.quantity    != null ? parseFloat(r.quantity)    : null,
    tradeSize:    r.usd_amount  != null ? parseFloat(r.usd_amount)  : null,
    pnlUSD:       r.pnl_usd     != null ? parseFloat(r.pnl_usd).toFixed(2) : null,
    pct:          r.pnl_pct     != null ? parseFloat(r.pnl_pct).toFixed(2) : null,
    exitReason,
    orderPlaced:  true,                               // these are lifecycle events, all "placed"
    paperTrading: r.mode === "paper",
    orderId:      r.kraken_order_id,
    signalScore:  r.signal_score,
    decisionLog:  r.decision_log,
    entryPrice:   r.pos_entry_price != null ? parseFloat(r.pos_entry_price) : null,
    // metadata flags useful for UI follow-ups (not currently rendered)
    _imported:    !!(r.metadata && r.metadata.imported_from),
  };
}

function _dbPositionToLegacyShape(r) {
  if (!r) return null;
  return {
    open:           r.status === "open",
    side:           r.side,
    symbol:         r.symbol,
    entryPrice:     r.entry_price        != null ? parseFloat(r.entry_price)        : null,
    entryTime:      r.entry_time instanceof Date ? r.entry_time.toISOString() : String(r.entry_time),
    quantity:       r.quantity           != null ? parseFloat(r.quantity)           : null,
    tradeSize:      r.trade_size_usd     != null ? parseFloat(r.trade_size_usd)     : null,
    leverage:       r.leverage,
    effectiveSize:  r.effective_size_usd != null ? parseFloat(r.effective_size_usd) : null,
    orderId:        r.kraken_order_id,
    stopLoss:       r.stop_loss          != null ? parseFloat(r.stop_loss)          : null,
    takeProfit:     r.take_profit        != null ? parseFloat(r.take_profit)        : null,
    entrySignalScore: r.entry_signal_score,
    volatilityLevel:  r.volatility_level,
  };
}

// Read four mode-scoped DB results in parallel. Returns either:
//   { source: "postgres", recentTrades, position, pnl, winLoss, fired, exits }
// or:
//   { source: "postgres-degraded", reason, degraded: true, plus null fields }
//
// Caller uses Postgres results when source === "postgres", and renders a
// degraded UI state when source === "postgres-degraded". When the DB is
// not configured at all (dbAvailable() === false), the caller skips this
// helper entirely and uses its existing JSON path.
async function _loadModeFromDb(mode) {
  try {
    const [te, op, plAgg, wlAgg] = await Promise.all([
      loadRecentTradeEvents(mode, 30),
      loadOpenPosition(mode),
      loadPnLAggregates(mode),
      loadWinLossAggregates(mode),
    ]);
    const recentTrades = te.map(_dbTradeEventToLegacyShape);
    const position     = _dbPositionToLegacyShape(op);
    const fired = te.filter(r => ["buy_filled", "manual_buy", "reentry_buy"].includes(r.event_type)).length;
    return {
      source: "postgres",
      recentTrades,
      position,
      pnl: { totalUSD: plAgg.totalUSD, exitCount: plAgg.exitCount, orphanExitCount: plAgg.orphanExitCount },
      winLoss: wlAgg,
      fired,
      exits: plAgg.exitCount,
    };
  } catch (e) {
    log.warn("d-5.8 read", `_loadModeFromDb(${mode}) failed: ${e.message}`);
    return {
      source: "postgres-degraded",
      degraded: true,
      reason: e.message,
      recentTrades: [],
      position: null,
      pnl:     { totalUSD: null, exitCount: 0, degraded: true },
      winLoss: { wins: null, losses: null, breakeven: 0, total: 0, winRate: null, degraded: true },
      fired: 0,
      exits: 0,
    };
  }
}

// ─── Bot Log / CSV ────────────────────────────────────────────────────────────

function loadLog() {
  if (!existsSync(LOG_FILE)) return { trades: [] };
  try { return JSON.parse(readFileSync(LOG_FILE, "utf8")); }
  catch { return { trades: [] }; }
}

function parseCsvLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { result.push(cur); cur = ""; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function loadCsv() {
  if (!existsSync(CSV_FILE)) return [];
  const lines = readFileSync(CSV_FILE, "utf8").trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines
    .slice(1)
    .filter((l) => !l.startsWith(",,,,,,,,,,"))
    .map((l) => {
      const vals = parseCsvLine(l);
      return Object.fromEntries(headers.map((h, i) => [h.trim(), (vals[i] || "").trim()]));
    });
}

function calcPaperPnL(rows, currentPrice) {
  const paperTrades = rows.filter(r => r["Mode"] === "PAPER" && r["Side"] === "BUY" && parseFloat(r["Quantity"]) > 0);
  if (!paperTrades.length) return { tradeCount: 0, totalInvested: 0, totalQty: 0, currentValue: 0, pnl: 0, pnlPct: 0, wins: 0, losses: 0, winRate: 0 };

  const totalQty      = paperTrades.reduce((s, r) => s + parseFloat(r["Quantity"] || 0), 0);
  const totalInvested = paperTrades.reduce((s, r) => s + parseFloat(r["Total USD"] || 0), 0);
  const currentValue  = currentPrice ? totalQty * currentPrice : 0;
  const pnl           = currentValue - totalInvested;
  const pnlPct        = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

  // Per-trade win/loss: compare each entry price to current price
  const wins   = currentPrice ? paperTrades.filter(r => currentPrice > parseFloat(r["Price"])).length : 0;
  const losses = currentPrice ? paperTrades.filter(r => currentPrice < parseFloat(r["Price"])).length : 0;
  const winRate = paperTrades.length > 0 ? (wins / paperTrades.length) * 100 : 0;

  return { tradeCount: paperTrades.length, totalInvested, totalQty, currentValue, pnl, pnlPct, wins, losses, winRate };
}

// Phase D-5.8 — async; paperPnLRealized + modeWinLoss + position now
// sourced from Postgres when DB is available. Other fields (latest,
// stats, recentTrades-from-CSV, paperPnL legacy mark-to-market, perfState,
// capitalState, portfolioState) keep their JSON/CSV sources because they
// belong to surfaces (legacy /dashboard panels) that haven't been
// migrated yet — the D-2-h paper-fix script reads paperPnLRealized
// specifically, which is the field this phase corrects.
async function getApiData() {
  const log = loadLog();
  const rows = loadCsv();
  const latest = log.trades.length ? log.trades[log.trades.length - 1] : null;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = log.trades.filter(
    (t) => t.timestamp.startsWith(today) && t.orderPlaced && t.type !== "EXIT"
  ).length;
  const stats = {
    total: log.trades.length,
    fired: rows.filter((r) => r["Mode"] === "PAPER" || r["Mode"] === "LIVE").length,
    blocked: rows.filter((r) => r["Mode"] === "BLOCKED").length,
    live: rows.filter((r) => r["Mode"] === "LIVE").length,
    todayCount,
  };
  const currentPrice = latest?.price || null;
  const paperPnL = calcPaperPnL(rows, currentPrice);
  const paperStartingBalance = parseFloat(process.env.PAPER_STARTING_BALANCE || "500");
  // Phase D-5.6 — DB-preferred read with JSON fallback. Safe defaults
  // preserved by spreading loadControl() over the defaults: any missing
  // field falls back to the historical safe value.
  const control = { stopped: false, paused: false, paperTrading: true, leverage: 2, riskPct: 1, ...loadControl() };
  let perfState = {};
  try { if (existsSync(PERF_STATE_FILE)) perfState = JSON.parse(readFileSync(PERF_STATE_FILE, "utf8")); } catch {}
  let capitalState = { xrpRole: "HOLD_ASSET", autoConversion: false, activePct: 70, reservePct: 30 };
  try { if (existsSync(CAPITAL_FILE)) capitalState = JSON.parse(readFileSync(CAPITAL_FILE, "utf8")); } catch {}
  let portfolioState = {};
  try { if (existsSync(PORTFOLIO_FILE)) portfolioState = JSON.parse(readFileSync(PORTFOLIO_FILE, "utf8")); } catch {}

  // ── Phase D-5.8 — modeWinLoss + paperPnLRealized + position from DB ──
  // Postgres-first; JSON fallback when DB unavailable; degraded shape on
  // DB query failure. Consumers (Combined /dashboard's D-2-h paper-fix
  // overlay; legacy /dashboard's per-mode W/L card) read these fields.
  let modeWinLoss = { paper: null, live: null };
  let paperPnLRealized;
  let position = null;

  if (dbAvailable()) {
    const [paperResult, liveResult] = await Promise.all([
      _loadModeFromDb("paper"),
      _loadModeFromDb("live"),
    ]);
    // mode-segregated W/L: null when no closed exits in mode, else { wins, losses, total, winRate }.
    const toWLOrNull = (r) => (r.degraded || !r.winLoss || r.winLoss.total === 0)
      ? (r.degraded ? r.winLoss : null)
      : { wins: r.winLoss.wins, losses: r.winLoss.losses, total: r.winLoss.total, winRate: r.winLoss.winRate };
    modeWinLoss = { paper: toWLOrNull(paperResult), live: toWLOrNull(liveResult) };

    // paperPnLRealized: matches the legacy field shape; consumed by the
    // D-2-h paper-fix script in the combined /dashboard.
    const pnlUsd = paperResult.degraded ? null : paperResult.pnl.totalUSD;
    paperPnLRealized = {
      source: paperResult.degraded
        ? `postgres-degraded: ${paperResult.reason}`
        : "postgres trade_events (paper exits)",
      realizedPnL_USD: pnlUsd,
      exitCount: paperResult.exits,
      wins:      paperResult.winLoss.wins,
      losses:    paperResult.winLoss.losses,
      breakeven: paperResult.winLoss.breakeven,
      winRate:   paperResult.winLoss.winRate,
      startingBalance: paperStartingBalance,
      currentBalance: pnlUsd == null ? null : paperStartingBalance + pnlUsd,
      asOf: paperResult.recentTrades.length
        ? paperResult.recentTrades[0].timestamp   // newest-first → [0] is most recent
        : null,
    };

    // position: prefer the active mode's open position (if any).
    const activeMode = control.paperTrading !== false ? "paper" : "live";
    const activeResult = activeMode === "paper" ? paperResult : liveResult;
    if (activeResult.degraded) {
      position = { open: false, _degraded: true, _reason: activeResult.reason };
    } else if (activeResult.position) {
      position = activeResult.position;
    } else {
      position = { open: false };
    }
  } else {
    // JSON fallback (local dev / pre-Postgres deploy).
    const modeWL = (wantPaper) => {
      const exits = log.trades.filter(t => t.type === "EXIT" && Boolean(t.paperTrading) === wantPaper);
      if (!exits.length) return null;
      const w = exits.filter(t => parseFloat(t.pnlUSD) > 0).length;
      const l = exits.filter(t => parseFloat(t.pnlUSD) < 0).length;
      return { wins: w, losses: l, total: w + l, winRate: (w + l) > 0 ? (w / (w + l)) * 100 : null };
    };
    modeWinLoss = { paper: modeWL(true), live: modeWL(false) };

    const paperExits = log.trades.filter(t =>
      t && Boolean(t.paperTrading) === true && t.type === "EXIT");
    const paperWins = paperExits.filter(t => parseFloat(t.pnlUSD) > 0).length;
    const paperLosses = paperExits.filter(t => parseFloat(t.pnlUSD) < 0).length;
    const paperBreakeven = paperExits.filter(t => parseFloat(t.pnlUSD) === 0).length;
    const paperRealizedPnL = paperExits.reduce((s, t) => s + (parseFloat(t.pnlUSD) || 0), 0);
    const paperWLTotal = paperWins + paperLosses;
    paperPnLRealized = {
      source: "safety-check-log.json paper-filtered EXIT rows + PAPER_STARTING_BALANCE",
      realizedPnL_USD: paperRealizedPnL,
      exitCount: paperExits.length,
      wins: paperWins,
      losses: paperLosses,
      breakeven: paperBreakeven,
      winRate: paperWLTotal > 0 ? (paperWins / paperWLTotal) * 100 : null,
      startingBalance: paperStartingBalance,
      currentBalance: paperStartingBalance + paperRealizedPnL,
      asOf: paperExits.length ? paperExits[paperExits.length - 1].timestamp : null,
    };

    let pos = { open: false };
    try { if (existsSync(POSITION_FILE)) pos = JSON.parse(readFileSync(POSITION_FILE, "utf8")); } catch {}
    position = pos;
  }

  return { latest, stats, recentTrades: [...rows].reverse().slice(0, 30), paperPnL, paperPnLRealized, paperStartingBalance, position, control, perfState, capitalState, portfolioState, modeWinLoss, recentLogs: log.trades.slice(-8).reverse(), allLogs: log.trades.slice(-20).reverse() };
}

// ─── Home summary (Phase 6e + 8d) ────────────────────────────────────────────
// Slim endpoint for /. Phase 8d adds paper + live mini-stats so the homepage
// mode cards can show "$X balance · NW/NL · +$P P&L" without hitting the
// full /api/data payload.
//
// Phase D-5.8 — async; mode mini-stats now Postgres-first via modeScopedSummary.
// `latest` (the most recent decision overall, including skip cycles) stays
// on JSON because trade_events doesn't capture skip cycles (D-5.9 territory).
async function getHomeSummary() {
  const control = loadControl();
  let latest = null;
  try {
    if (existsSync(LOG_FILE)) {
      const log = JSON.parse(readFileSync(LOG_FILE,"utf8"));
      const t = log.trades.length ? log.trades[log.trades.length - 1] : null;
      if (t) latest = {
        timestamp:  t.timestamp,
        price:      t.price ?? null,
        type:       t.type || null,
        exitReason: t.exitReason || null,
        allPass:    t.allPass === true,
      };
    }
  } catch {}

  let paper = null, live = null;
  try {
    const pBase = await modeScopedSummary(true);
    const startingBal = parseFloat(process.env.PAPER_STARTING_BALANCE || "500");
    // Phase D-5.8 — pBase.pnl.totalUSD may be null when DB read is degraded.
    // Pass null through the balance computation so the home card shows "—"
    // rather than a misleading "$startingBal + null = NaN".
    const pnlUsd = pBase.pnl?.totalUSD;
    paper = {
      balance:  pnlUsd == null ? null : startingBal + pnlUsd,
      winLoss:  pBase.winLoss,
      pnl:      pBase.pnl,
    };
  } catch {}
  try {
    const lBase = await modeScopedSummary(false);
    live = {
      winLoss: lBase.winLoss,
      pnl:     lBase.pnl,
    };
  } catch {}

  return {
    control: {
      paperTrading: control.paperTrading !== false,
      stopped:      !!control.stopped,
      paused:       !!control.paused,
      killed:       !!control.killed,
    },
    latest,
    paper,
    live,
  };
}

// ─── Mode-scoped data (Paper / Live) ──────────────────────────────────────────
// Phase 1: data separation only. Each helper filters safety-check-log.json by
// the .paperTrading flag so paper and live stats never mix. Position and
// control are shared files; we surface them ONLY when the bot is currently in
// the matching mode. Otherwise the page shows "Unavailable".

// Phase D-5.8 — async; trade-history fields source from Postgres when
// available, with JSON fallback ONLY when DB is hard-down (DATABASE_URL
// unset / pool unavailable). On DB query failure (pool reachable but
// query throws), returns degraded fields so the UI shows "—" rather
// than fake zeros. latestDecision and recentSignalCycles stay on JSON
// because skip-cycle data is not in trade_events (D-5.9 territory).
async function modeScopedSummary(wantPaper) {
  const mode = wantPaper ? "paper" : "live";
  const log = loadLog();
  const trades = log.trades.filter(t => Boolean(t.paperTrading) === wantPaper);

  // ── Always-from-JSON fields (skip-cycle context) ─────────────────
  // latestDecision and recentSignalCycles include skip cycles which
  // trade_events does not capture. Until strategy_signals lands
  // (D-5.9), JSON remains the source of truth for these.
  const last = trades.length ? trades[trades.length - 1] : null;
  const latestDecision = last ? {
    type: last.type || null,
    timestamp: last.timestamp,
    price: last.price ?? null,
    exitReason: last.exitReason || null,
    orderPlaced: last.orderPlaced === true,
    allPass: last.allPass === true,
  } : null;
  const recentSignalCycles = trades.slice(-30).reverse();
  const totalTradesFromJson = trades.length;

  // ── Control state (Postgres-first since D-5.6) ───────────────────
  const control = loadControl();
  const botInPaperMode = control.paperTrading !== false;
  const isActive = wantPaper ? botInPaperMode : !botInPaperMode;

  // ── Trade history + P&L + W/L + position ────────────────────────
  let recentTrades, position, pnl, winLoss, fired, exits, source, degraded = false, degradedReason = null;
  if (dbAvailable()) {
    const dbResult = await _loadModeFromDb(mode);
    source = dbResult.source;
    if (dbResult.degraded) {
      degraded = true;
      degradedReason = dbResult.reason;
    }
    recentTrades = dbResult.recentTrades;
    position     = dbResult.position;
    pnl          = dbResult.pnl;
    winLoss      = dbResult.winLoss;
    fired        = dbResult.fired;
    exits        = dbResult.exits;
  } else {
    // JSON fallback (local dev / pre-Postgres deploy). Same logic as
    // pre-D-5.8: filter the paper/live-scoped trades for lifecycle
    // events and aggregate. Position from position.json.
    source = "json";
    const exitsFromJson = trades.filter(t => t.type === "EXIT");
    const wins   = exitsFromJson.filter(t => parseFloat(t.pnlUSD) > 0).length;
    const losses = exitsFromJson.filter(t => parseFloat(t.pnlUSD) < 0).length;
    const totalPnL = exitsFromJson.reduce((s, t) => s + (parseFloat(t.pnlUSD) || 0), 0);
    pnl = { totalUSD: totalPnL, exitCount: exitsFromJson.length };
    winLoss = {
      wins, losses,
      total: wins + losses,
      winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : null,
    };
    fired = trades.filter(t => t.orderPlaced === true && t.type !== "EXIT").length;
    exits = exitsFromJson.length;
    recentTrades = trades
      .filter(t => t && (t.type === "EXIT" || (t.orderPlaced === true && t.type !== "EXIT")))
      .slice(-30)
      .reverse();
    let pos = { open: false };
    try { if (existsSync(POSITION_FILE)) pos = JSON.parse(readFileSync(POSITION_FILE, "utf8")); } catch {}
    position = (isActive && pos.open) ? pos : null;
  }

  return {
    mode,
    isActive,
    botMode: botInPaperMode ? "paper" : "live",
    totalTrades: totalTradesFromJson,
    fired,
    exits,
    winLoss,
    pnl,
    position: isActive ? position : null,
    positionUnavailableReason: !isActive
      ? `Bot currently in ${botInPaperMode ? "PAPER" : "LIVE"} mode — ${wantPaper ? "paper" : "live"} position not active`
      : (position ? null : "No open position"),
    latestDecision,
    // Phase D-4-P-a — recentTrades is the last 30 actual trade events.
    // Phase D-5.8 — sourced from Postgres when DB available; JSON fallback.
    recentTrades,
    // recentSignalCycles preserves the old "last 30 cycles" stream;
    // includes skip cycles which Postgres does not store (D-5.9 territory).
    recentSignalCycles,
    control: {
      stopped: !!control.stopped,
      paused:  !!control.paused,
      killed:  !!control.killed,
      riskPct: control.riskPct ?? null,
      leverage: control.leverage ?? null,
      maxDailyLossPct: control.maxDailyLossPct ?? null,
      cooldownMinutes: control.cooldownMinutes ?? null,
      pauseAfterLosses: control.pauseAfterLosses ?? null,
      consecutiveLosses: control.consecutiveLosses ?? 0,
    },
    // Phase D-5.8 — informational; lets clients detect degraded state
    // without breaking on missing field. Existing UI ignores these.
    source,
    degraded,
    degradedReason,
  };
}

// Phase D-5.8 — async (modeScopedSummary is now async).
async function getPaperSummary() {
  const base = await modeScopedSummary(true);
  const startingBalance = parseFloat(process.env.PAPER_STARTING_BALANCE || "500");
  // Phase D-5.8 — when DB read is degraded, base.pnl.totalUSD may be null.
  // Pass through unchanged so the balance card renders "—" rather than a
  // misleading "$startingBalance + null" computation.
  const pnl = base.pnl?.totalUSD;
  const currentBalance = (pnl == null) ? null : startingBalance + pnl;
  return {
    ...base,
    balance: {
      source: "computed",
      startingBalance,
      currentBalance,
      currency: "USD",
    },
  };
}

async function getLiveSummary() {
  const base = await modeScopedSummary(false);
  let kraken;
  try { kraken = await fetchKrakenBalance(); }
  catch (e) { kraken = { error: e.message }; }
  const balance = kraken && !kraken.error
    ? { source: "kraken", totalUSD: kraken.totalUSD, balances: kraken.balances, updatedAt: kraken.updatedAt, currency: "USD" }
    : { unavailable: true, reason: kraken?.error || "Kraken balance unavailable" };
  return { ...base, balance };
}

// ─── Phase B — /api/v2/dashboard payload builder ─────────────────────────────
// Cached Kraken health probe so /api/v2/dashboard polled every 5s doesn't hit
// Kraken's /Time endpoint 720× per hour. /api/health stays the place that
// always probes fresh; this cache is consumed by the v2 endpoint only.
let _krakenHealthCache = { ts: 0, result: null };
async function getCachedKrakenHealth(maxAgeMs = 30_000) {
  const now = Date.now();
  if (_krakenHealthCache.result && (now - _krakenHealthCache.ts) < maxAgeMs) {
    return _krakenHealthCache.result;
  }
  const t0 = now;
  let kraken = "offline", krakenOk = false, krakenLatency = 0;
  const errors = [];
  try {
    const r = await fetch("https://api.kraken.com/0/public/Time", { signal: AbortSignal.timeout(5000) });
    krakenLatency = Date.now() - t0; krakenOk = r.ok;
    if (r.ok) kraken = "online";
    else errors.push({ source: "kraken", message: "HTTP " + r.status });
  } catch (e) {
    errors.push({ source: "kraken", message: e.message });
  }
  const result = { kraken, krakenOk, krakenLatency, errors };
  _krakenHealthCache = { ts: now, result };
  return result;
}

// Single mode-tagged payload for /dashboard-v2 (server-render + 5s polling).
// Wraps existing safe helpers — no new state files, no bot-logic changes,
// no writes. Includes a Safety Buffer that accounts for BOTH realized
// today's loss AND unrealized open-position exposure, so an operator
// cannot be misled by a "healthy" buffer while a position is bleeding.
async function buildV2DashboardPayload() {
  // Phase D-5.6 — DB-preferred read with JSON fallback.
  const ctrl = loadControl();
  const isPaper = ctrl.paperTrading !== false;

  // Mode-scoped summary (paper or live, never both).
  // Phase D-5.8 — getPaperSummary, getLiveSummary, modeScopedSummary are
  // all now async. await the active one; on Kraken-balance failure for
  // live, fall back to modeScopedSummary (which is awaited too).
  const summary = isPaper
    ? await getPaperSummary()
    : await getLiveSummary().catch(() => modeScopedSummary(false));

  // Latest log entry (last decision + V2 shadow data) — stays JSON-sourced
  // because skip cycles aren't in trade_events (D-5.9 territory).
  let latest = null;
  let allTrades = [];
  try {
    if (existsSync(LOG_FILE)) {
      const log = JSON.parse(readFileSync(LOG_FILE,"utf8"));
      allTrades = log.trades || [];
      latest = allTrades.length ? allTrades[allTrades.length - 1] : null;
    }
  } catch {}
  // Phase D-5.8.1 — top-level position now uses summary.position (which
  // is Postgres-sourced via getPaperSummary/getLiveSummary → modeScopedSummary
  // → _loadModeFromDb in D-5.8). Previously this re-read position.json,
  // which is wiped on every Railway redeploy (no volume); after a deploy
  // the v2 dashboard's Open Position card showed "no open trade" even
  // when Postgres had a real open position row.
  const position = summary.position ?? { open: false };

  // Today-only realized P&L for the active mode.
  const todayDate = new Date().toISOString().slice(0, 10);
  const todayUsd = allTrades
    .filter(t => t.type === "EXIT"
              && Boolean(t.paperTrading) === isPaper
              && (t.timestamp || "").startsWith(todayDate))
    .reduce((s, t) => s + (parseFloat(t.pnlUSD) || 0), 0);

  // Unrealized P&L from current open position (mode-aware: only count if
  // the current bot mode matches the view).
  const currentPrice = latest?.price ?? null;
  let unrealizedUsd = 0;
  const positionMatchesMode = position?.open && (Boolean(position.paperTrading ?? isPaper) === isPaper);
  if (positionMatchesMode && currentPrice && position.entryPrice && position.tradeSize) {
    const lev = position.leverage || 1;
    unrealizedUsd = ((currentPrice - position.entryPrice) / position.entryPrice) * (position.tradeSize * lev);
  }

  // Safety Buffer — single source of truth for daily-loss room.
  const baselineUsd = isPaper
    ? parseFloat(process.env.PAPER_STARTING_BALANCE || "500")
    : parseFloat(process.env.PORTFOLIO_VALUE_USD || "850");
  const capPct = Number(ctrl.maxDailyLossPct ?? 3);
  const realizedLossTodayPct = todayUsd < 0 ? Math.abs(todayUsd) / baselineUsd * 100 : 0;
  const unrealizedLossPct    = unrealizedUsd < 0 ? Math.abs(unrealizedUsd) / baselineUsd * 100 : 0;
  const totalExposurePct     = realizedLossTodayPct + unrealizedLossPct;
  const remainingHardPct     = Math.max(0, capPct - realizedLossTodayPct);    // what kill switch sees right now
  const remainingSoftPct     = Math.max(0, capPct - totalExposurePct);        // includes unrealized
  const openPositionPct      = (positionMatchesMode && unrealizedUsd !== 0)
    ? unrealizedUsd / baselineUsd * 100
    : null;

  // Health snapshot — cached Kraken probe + bot status from log freshness.
  const k = await getCachedKrakenHealth();
  const lastRunAge = latest?.timestamp ? (Date.now() - new Date(latest.timestamp).getTime()) / 60000 : null;
  const botStatus = ctrl.killed  ? "killed"
                  : ctrl.stopped ? "stopped"
                  : ctrl.paused  ? "paused"
                  : (lastRunAge != null && lastRunAge <= 15) ? "running"
                  : "stale";

  return {
    mode: isPaper ? "paper" : "live",
    serverTime: Date.now(),
    control: {
      paperTrading: isPaper,
      stopped: !!ctrl.stopped,
      paused: !!ctrl.paused,
      killed: !!ctrl.killed,
      leverage: ctrl.leverage ?? 2,
      riskPct: ctrl.riskPct ?? 1,
      maxDailyLossPct: capPct,
      cooldownMinutes: ctrl.cooldownMinutes ?? null,
      lastTradeTime: ctrl.lastTradeTime ?? null,
      consecutiveLosses: ctrl.consecutiveLosses ?? 0,
    },
    health: {
      kraken: k.kraken,
      krakenOk: k.krakenOk,
      krakenLatency: k.krakenLatency,
      websocket: "client-managed",
      bot: botStatus,
      lastRunAge,
      errors: k.errors,
    },
    summary: {
      mode: summary.mode,
      isActive: summary.isActive,
      totalTrades: summary.totalTrades,
      fired: summary.fired,
      exits: summary.exits,
      winLoss: summary.winLoss,
      pnl: {
        totalUsd: summary.pnl?.totalUSD ?? 0,
        todayUsd,
        exitCount: summary.pnl?.exitCount ?? 0,
      },
    },
    position: positionMatchesMode ? position : null,
    latest: latest ? {
      timestamp:    latest.timestamp,
      type:         latest.type ?? null,
      price:        latest.price ?? null,
      exitReason:   latest.exitReason ?? null,
      orderPlaced:  latest.orderPlaced === true,
      allPass:      latest.allPass === true,
      signalScore:  latest.signalScore ?? null,
      decisionLog:  latest.decisionLog ?? null,
      perfState:    latest.perfState ?? null,
      strategyV2:   latest.strategyV2 ?? null,
    } : null,
    // Phase D-1-e-3 / D-1-f-1 — recent cycle decisionLogs. The Conditions
    // Pass Rates card caps internally at 15 cycles; the Advanced tab Raw
    // Decision Log shows up to 30 (D-1-f-1). Mode-blind on purpose
    // (decisionLog has no mode tag). Newest-first. Strings only.
    recentDecisionLogs: allTrades
      .slice(-30)
      .map(t => ({ timestamp: t.timestamp ?? null, decisionLog: t.decisionLog ?? null }))
      .reverse(),
    // Phase D-1-f-2 — last 20 cycles projected for the Advanced tab Recent
    // Bot Activity timeline. Mode-blind, read-only. Includes paperTrading
    // only so the timeline can render a PAPER/LIVE pill on traded/exited
    // rows; never aggregated as account P&L.
    recentActivity: allTrades
      .slice(-20)
      .map(t => ({
        timestamp:    t.timestamp ?? null,
        type:         t.type ?? null,
        allPass:      t.allPass === true,
        exitReason:   t.exitReason ?? null,
        price:        t.price ?? null,
        pct:          t.pct ?? null,
        pnlUSD:       t.pnlUSD ?? null,
        paperTrading: t.paperTrading !== false,
        decisionLog:  t.decisionLog ?? null,
      }))
      .reverse(),
    // Phase D-1-e-4 — last 15 cycles' V1 outcome (allPass) + V2 verdict for
    // the cycle-level shadow-analysis card. Same scope as recentDecisionLogs:
    // mode-blind, read-only, last 15 cycles, newest-first. V2 is shadow only;
    // this surface never feeds back into trading. Projects strategyV2 to the
    // two fields the card actually renders so we don't bloat the payload.
    recentStrategyV2: allTrades
      .slice(-15)
      .map(t => ({
        timestamp: t.timestamp ?? null,
        type: t.type ?? null,
        allPass: t.allPass === true,
        strategyV2: t.strategyV2 ? {
          decision:   t.strategyV2.decision ?? null,
          skipReason: t.strategyV2.skipReason ?? null,
        } : null,
      }))
      .reverse(),
    safetyBuffer: {
      capPct,
      baselineUsd,
      realizedLossTodayPct,
      unrealizedLossPct,
      totalExposurePct,
      remainingHardPct,
      remainingSoftPct,
      openPositionPct,
    },
  };
}

// ─── Chart Data ───────────────────────────────────────────────────────────────

const PAIR_MAP = {
  BTCUSDT: "XBTUSD", ETHUSDT: "ETHUSD", SOLUSDT: "SOLUSD",
  ADAUSDT: "ADAUSD", XRPUSDT: "XRPUSD", DOGEUSDT: "XDGUSD",
  LTCUSDT: "XLTCUSD", LINKUSDT: "LINKUSD", DOTUSDT: "DOTUSD",
  AVAXUSDT: "AVAXUSD", MATICUSDT: "MATICUSD", BNBUSDT: "BNBUSD",
};

const INTERVAL_MAP = {
  "1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30,
  "1H": 60, "4H": 240, "1D": 1440, "1W": 10080,
};

// Retry helper — Kraken occasionally rate-limits or times out. 2 retries with 500ms backoff.
async function fetchWithRetry(url, opts, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r;
    } catch (e) {
      console.error("[" + (label || "fetch") + "] attempt " + attempt + " failed:", e.message);
      if (attempt === 3) throw e;
      await new Promise(res => setTimeout(res, 500 * attempt));
    }
  }
}

// ─── Kraken Balance ───────────────────────────────────────────────────────────

const ASSET_LABELS = {
  ZUSD: "USD", XXBT: "BTC", XETH: "ETH", XXRP: "XRP",
  XLTC: "LTC", XDOT: "DOT", ADA: "ADA", SOL: "SOL",
  AVAX: "AVAX", LINK: "LINK", MATIC: "MATIC", XDG: "DOGE", XXDG: "DOGE", BNBUSDT: "BNB",
};

const ASSET_TO_PAIR = {
  BTC: "XBTUSD", ETH: "ETHUSD", XRP: "XRPUSD", LTC: "LTCUSD",
  SOL: "SOLUSD", ADA: "ADAUSD", AVAX: "AVAXUSD", LINK: "LINKUSD",
  DOT: "DOTUSD", DOGE: "XDGUSD", MATIC: "MATICUSD",
};

const TICKER_RESPONSE_KEY = {
  XBTUSD: "XXBTZUSD", ETHUSD: "XETHZUSD", XRPUSD: "XXRPZUSD", LTCUSD: "XLTCZUSD",
};

async function fetchAssetPrices(assetNames) {
  const pairs = assetNames.filter(a => a !== "USD" && ASSET_TO_PAIR[a]).map(a => ASSET_TO_PAIR[a]);
  if (!pairs.length) return {};
  try {
    const data = await withRetry(async () => {
      const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pairs.join(",")}`);
      if (!res.ok) throw new Error(`Kraken Ticker HTTP ${res.status}`);
      const j = await res.json();
      if (j.error?.length) throw new Error(`Kraken Ticker: ${j.error.join(", ")}`);
      return j;
    });
    const prices = {};
    for (const [asset, pair] of Object.entries(ASSET_TO_PAIR)) {
      if (!assetNames.includes(asset)) continue;
      const key = TICKER_RESPONSE_KEY[pair] || pair;
      const ticker = data.result[key] || data.result[pair];
      if (ticker) prices[asset] = parseFloat(ticker.c[0]);
    }
    return prices;
  } catch (e) {
    log.error("kraken-ticker", e.message);
    return {}; // safe fallback — same as before
  }
}

function signKrakenRequest(path, nonce, postData) {
  const secretBuffer = Buffer.from(process.env.KRAKEN_SECRET_KEY, "base64");
  const sha256Hash = crypto.createHash("sha256").update(nonce + postData).digest();
  return crypto.createHmac("sha512", secretBuffer)
    .update(Buffer.concat([Buffer.from(path), sha256Hash]))
    .digest("base64");
}

// ─── Trade Execution ──────────────────────────────────────────────────────────

const PAIR_TO_KRAKEN = {
  XRPUSDT: "XRPUSD", BTCUSDT: "XBTUSD", ETHUSDT: "ETHUSD",
  SOLUSDT: "SOLUSD", ADAUSDT: "ADAUSD", DOGEUSDT: "XDGUSD",
};

async function fetchCurrentPrice(symbol) {
  const pair = PAIR_TO_KRAKEN[symbol] || symbol;
  return withRetry(async () => {
    const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`);
    if (!res.ok) throw new Error(`Kraken Ticker HTTP ${res.status}`);
    const data = await res.json();
    if (data.error?.length) throw new Error(data.error.join(", "));
    const key  = Object.keys(data.result)[0];
    return parseFloat(data.result[key].c[0]);
  }); // throws after 3 attempts — caller's existing try/catch handles it
}

async function execKrakenOrder(side, pair, volume, leverage = 1) {
  const apiKey    = process.env.KRAKEN_API_KEY;
  const secretKey = process.env.KRAKEN_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("Kraken credentials not set");
  // Retry network/transport errors only — never retry once Kraken accepts the request
  // (avoids duplicate orders if first attempt actually placed but we missed the response)
  let res;
  try {
    res = await withRetry(async () => {
      const nonce    = Date.now().toString();
      const path     = "/0/private/AddOrder";
      const params   = { nonce, ordertype: "market", type: side, volume, pair };
      if (leverage > 1) params.leverage = leverage;
      const postData = new URLSearchParams(params).toString();
      const sig      = signKrakenRequest(path, nonce, postData);
      const r = await fetch(`https://api.kraken.com${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "API-Key": apiKey, "API-Sign": sig },
        body: postData,
      });
      if (!r.ok) throw new Error(`Kraken AddOrder HTTP ${r.status}`);
      return r;
    }, 1); // only ONE retry on transport failure for safety
  } catch (e) {
    log.error("kraken-order", `transport failure: ${e.message}`);
    throw e;
  }
  const data = await res.json();
  // Once we have a JSON response, do NOT retry — Kraken rejections are final
  if (data.error?.length) {
    log.error("kraken-order", `rejected: ${data.error.join(", ")}`);
    throw new Error(data.error.join(", "));
  }
  return { orderId: data.result.txid[0] };
}

async function handleTradeCommand(command, params = {}) {
  // Phase D-5.6 — DB-preferred read with JSON fallback. Manual paper trade
  // commands (BUY/CLOSE) gate on paperTrading; loadControl() returns the
  // freshest known state.
  const ctrl = loadControl();
  const isPaper = ctrl.paperTrading !== false;
  const symbol  = "XRPUSDT";
  const krakenPair = PAIR_TO_KRAKEN[symbol];
  let   pos  = { open: false };
  try { if (existsSync(POSITION_FILE)) pos = JSON.parse(readFileSync(POSITION_FILE, "utf8")); } catch {}

  const leverage = Math.min(Math.max(parseInt(ctrl.leverage || 2), 1), 3);
  const riskPct  = parseFloat(ctrl.riskPct || 1);
  const portfolioUSD = parseFloat(process.env.PORTFOLIO_VALUE_USD || "850");
  const tradeSize    = portfolioUSD * (riskPct / 100);

  const price = await fetchCurrentPrice(symbol);
  const volume = (tradeSize / price).toFixed(8);

  const log = existsSync(LOG_FILE)
    ? JSON.parse(readFileSync(LOG_FILE, "utf8"))
    : { trades: [] };

  if (command === "BUY_MARKET" || command === "OPEN_LONG") {
    if (pos.open) throw new Error("Position already open — close it first");
    const useLev = command === "OPEN_LONG" ? (params.leverage || leverage) : 1;
    let orderId = isPaper ? `PAPER-${Date.now()}` : null;
    if (!isPaper) {
      const order = await execKrakenOrder("buy", krakenPair, volume, useLev);
      orderId = order.orderId;
    }
    const slPct = parseFloat(params.slPct || ctrl.stopLossPct || 1.25);
    const tpPct = parseFloat(params.tpPct || ctrl.takeProfitPct || 2.0);
    const newPos = {
      open: true, side: "long", symbol, entryPrice: price,
      entryTime: new Date().toISOString(),
      quantity: (tradeSize * useLev) / price,
      tradeSize, leverage: useLev, effectiveSize: tradeSize * useLev,
      orderId,
      stopLoss:   price * (1 - slPct   / 100),
      takeProfit: price * (1 + tpPct   / 100),
    };
    writeFileSync(POSITION_FILE, JSON.stringify(newPos, null, 2));
    const entry = { type: "MANUAL_BUY", timestamp: new Date().toISOString(), symbol, price, tradeSize, leverage: useLev, orderId, paperTrading: isPaper, conditions: [], allPass: true, orderPlaced: true };
    log.trades.push(entry);
    writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
    // Phase D-5.7.1 — shadow-write manual paper BUY to Postgres after
    // JSON writes have settled. Paper-only; live manual commands continue
    // writing JSON only until D-5.12 lifts the live persistence gate.
    if (isPaper) shadowRecordManualPaperBuy(entry, newPos);
    return { ok: true, message: `${isPaper ? "Paper" : "Live"} BUY — ${volume} XRP at $${price.toFixed(4)} | SL $${newPos.stopLoss.toFixed(4)} | TP $${newPos.takeProfit.toFixed(4)}`, price, orderId };
  }

  if (command === "CLOSE_POSITION") {
    if (!pos.open) throw new Error("No open position to close");
    let orderId = isPaper ? `PAPER-SELL-${Date.now()}` : null;
    if (!isPaper) {
      const sellVol = pos.quantity.toFixed(8);
      const order   = await execKrakenOrder("sell", krakenPair, sellVol, 1);
      orderId = order.orderId;
    }
    const pnlPct = ((price - pos.entryPrice) / pos.entryPrice * 100).toFixed(2);
    const pnlUSD = ((price - pos.entryPrice) / pos.entryPrice * pos.tradeSize).toFixed(2);
    const exitEntry = { type: "EXIT", timestamp: new Date().toISOString(), symbol, price, quantity: pos.quantity, tradeSize: pos.tradeSize, entryPrice: pos.entryPrice, exitReason: "MANUAL_CLOSE", pct: pnlPct, pnlUSD, paperTrading: isPaper, orderId, conditions: [], allPass: false, orderPlaced: true };
    log.trades.push(exitEntry);
    writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
    writeFileSync(POSITION_FILE, JSON.stringify({ open: false }, null, 2));
    // Phase D-5.7.1 — shadow-write manual paper CLOSE to Postgres after
    // JSON writes have settled. Paper-only gate matches the BUY branch.
    if (isPaper) shadowRecordManualPaperClose(exitEntry);
    balanceCache = null;
    return { ok: true, message: `Position closed — P&L: ${pnlPct}% ($${pnlUSD}) | ${isPaper ? "Paper" : "Live"} SELL at $${price.toFixed(4)}`, price, orderId, pnlPct, pnlUSD };
  }

  if (command === "SELL_ALL") {
    const bal = await fetchKrakenBalance();
    const xrp = bal.balances?.find(b => b.asset === "XRP");
    if (!xrp || xrp.amount < 0.001) throw new Error("No XRP balance to sell");
    let orderId = isPaper ? `PAPER-SELLALL-${Date.now()}` : null;
    if (!isPaper) {
      const order = await execKrakenOrder("sell", krakenPair, xrp.amount.toFixed(8), 1);
      orderId = order.orderId;
    }
    writeFileSync(POSITION_FILE, JSON.stringify({ open: false }, null, 2));
    balanceCache = null;
    return { ok: true, message: `${isPaper ? "Paper" : "Live"} SELL ALL — ${xrp.amount.toFixed(4)} XRP at $${price.toFixed(4)}`, price, orderId, quantity: xrp.amount };
  }

  if (command === "SET_STOP_LOSS") {
    if (!pos.open) throw new Error("No open position — open a trade first");
    const pct    = parseFloat(params.pct || 1.25);
    pos.stopLoss = pos.entryPrice * (1 - pct / 100);
    writeFileSync(POSITION_FILE, JSON.stringify(pos, null, 2));
    return { ok: true, message: `Stop loss updated to $${pos.stopLoss.toFixed(4)} (-${pct}% from entry $${pos.entryPrice.toFixed(4)})` };
  }

  if (command === "SET_TAKE_PROFIT") {
    if (!pos.open) throw new Error("No open position — open a trade first");
    const pct       = parseFloat(params.pct || 2.0);
    pos.takeProfit  = pos.entryPrice * (1 + pct / 100);
    writeFileSync(POSITION_FILE, JSON.stringify(pos, null, 2));
    return { ok: true, message: `Take profit updated to $${pos.takeProfit.toFixed(4)} (+${pct}% from entry $${pos.entryPrice.toFixed(4)})` };
  }

  throw new Error("Unknown trade command: " + command);
}

let balanceCache = null;
let balanceCacheTime = 0;

async function fetchKrakenBalance() {
  const now = Date.now();
  if (balanceCache && now - balanceCacheTime < 30000) return balanceCache;

  const apiKey = process.env.KRAKEN_API_KEY;
  const secretKey = process.env.KRAKEN_SECRET_KEY;
  if (!apiKey || !secretKey) return { error: "KRAKEN_API_KEY / KRAKEN_SECRET_KEY not set in .env" };

  let data;
  try {
    data = await withRetry(async () => {
      const path = "/0/private/Balance";
      const nonce = Date.now().toString();
      const postData = new URLSearchParams({ nonce }).toString();
      const signature = signKrakenRequest(path, nonce, postData);
      const res = await fetch(`https://api.kraken.com${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "API-Key": apiKey,
          "API-Sign": signature,
        },
        body: postData,
      });
      if (!res.ok) throw new Error(`Kraken Balance HTTP ${res.status}`);
      const j = await res.json();
      if (j.error?.length) throw new Error(j.error.join(", "));
      return j;
    });
  } catch (e) {
    log.error("kraken-balance", e.message);
    return { error: e.message }; // safe fallback — same return shape as before
  }

  const HIDE = new Set(["PEPE", "DOGE", "ELIZAOS"]);

  const balances = Object.entries(data.result)
    .map(([raw, amt]) => ({ asset: ASSET_LABELS[raw] || raw, amount: parseFloat(amt) }))
    .filter(b => b.amount > 0.000001 && !HIDE.has(b.asset))
    .sort((a, b) => (a.asset === "USD" ? -1 : b.asset === "USD" ? 1 : a.asset.localeCompare(b.asset)));

  const assetNames = balances.map(b => b.asset);
  const prices = await fetchAssetPrices(assetNames);

  let totalUSD = 0;
  for (const b of balances) {
    if (b.asset === "USD") {
      b.usdValue = b.amount;
    } else if (prices[b.asset]) {
      b.price = prices[b.asset];
      b.usdValue = b.amount * prices[b.asset];
    }
    if (b.usdValue) totalUSD += b.usdValue;
  }

  balanceCache = { balances, totalUSD, updatedAt: new Date().toISOString() };
  balanceCacheTime = now;
  return balanceCache;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

// File-backed session store. Persists across Railway redeploys so users with
// valid cookies stay logged in. Single-writer (only this process), atomic via
// fs.writeFileSync. Two Sets serialized to one JSON file.
const SESSIONS_FILE = dataPath("sessions-store.json");
function loadPersistedSessions() {
  if (!existsSync(SESSIONS_FILE)) return { sessions: [], pending: [] };
  try {
    const raw = JSON.parse(readFileSync(SESSIONS_FILE, "utf8"));
    return { sessions: Array.isArray(raw.sessions) ? raw.sessions : [], pending: Array.isArray(raw.pending) ? raw.pending : [] };
  } catch { return { sessions: [], pending: [] }; }
}
function persistSessions() {
  try {
    writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions: [...sessions], pending: [...pendingSessions] }));
  } catch (e) { log.warn("sessions", `persist failed: ${e.message}`); }
}
const _persisted = loadPersistedSessions();
const sessions = new Set(_persisted.sessions);

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Append `; Secure` to cookies on Railway (HTTPS-only). Empty in local dev so
// http://localhost:3000 keeps working — browsers reject Secure cookies over
// plain HTTP and the user would silently never get a session.
const COOKIE_SECURE = process.env.RAILWAY_ENVIRONMENT ? "; Secure" : "";

// Constant-time string compare. SHA-256 normalizes both sides to a 32-byte
// buffer so timingSafeEqual never sees a length mismatch (which would either
// throw or short-circuit). Non-strings are rejected up front. Empty strings
// still match each other — preserves the existing behavior of the
// `(process.env.X || "")` fallback in the login compare.
function safeStringEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ah = crypto.createHash("sha256").update(a).digest();
  const bh = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ah, bh);
}

function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 1) continue;
    cookies[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return cookies;
}

function isAuthenticated(req) {
  return sessions.has(parseCookies(req.headers.cookie).session);
}

function readBody(req) {
  return new Promise(resolve => {
    let buf = "";
    req.on("data", c => buf += c);
    req.on("end", () => resolve(buf));
  });
}

function loginPage(error = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign in — Agent Avila</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  /* Phase 9a — palette aligned with Phase 8 (cyan + magenta accents). */
  :root {
    --bg: #0A0F1A; --bg-deep: #040711; --card: #121A2A;
    --border: rgba(0,212,255,0.12);
    --text: #E6EDF3; --muted: #8B98A5;
    --cyan: #00D4FF; --magenta: #FF00C8;
    --red: #FF4D6A; --green: #00FF9A;
  }
  html, body { height: 100%; }
  body {
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 20px;
    overflow: hidden;
    background:
      radial-gradient(ellipse 80% 50% at 50% 0%,    rgba(0,212,255,0.06)  0%, transparent 60%),
      radial-gradient(ellipse 80% 50% at 50% 100%,  rgba(255,0,200,0.05)  0%, transparent 60%),
      linear-gradient(180deg, var(--bg) 0%, var(--bg-deep) 100%);
    background-attachment: fixed;
  }
  /* Subtle blueprint grid behind content. */
  body::before {
    content: ""; position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.020) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.020) 1px, transparent 1px);
    background-size: 50px 50px;
    mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%);
    -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%);
    pointer-events: none;
  }
  .card {
    position: relative; width: 100%; max-width: 420px;
    background: rgba(18,26,42,0.85);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--border); border-radius: 20px;
    padding: 44px 40px;
    box-shadow:
      0 20px 60px rgba(0,0,0,0.5),
      0 0 40px rgba(0,212,255,0.08),
      inset 0 1px 0 rgba(255,255,255,0.04);
    animation: cardIn 0.6s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }
  /* Gradient border accent (cyan → magenta). */
  .card::before {
    content: ""; position: absolute; inset: -1px; border-radius: 20px;
    background: linear-gradient(135deg, rgba(0,212,255,0.5), rgba(255,0,200,0.5), transparent 60%);
    z-index: -1; opacity: 0.4;
  }
  .logo-wrap { display: flex; flex-direction: column; align-items: center; margin-bottom: 32px; }
  .logo {
    width: 56px; height: 56px; border-radius: 16px;
    background: linear-gradient(135deg, var(--cyan), var(--magenta));
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 900; color: #fff;
    box-shadow: 0 8px 24px rgba(0,212,255,0.30), inset 0 1px 0 rgba(255,255,255,0.2);
    margin-bottom: 16px;
    animation: logoPulse 3s ease-in-out infinite;
  }
  @keyframes logoPulse {
    0%,100% { box-shadow: 0 8px 24px rgba(0,212,255,0.30), inset 0 1px 0 rgba(255,255,255,0.2); }
    50%     { box-shadow: 0 8px 32px rgba(255,0,200,0.40), inset 0 1px 0 rgba(255,255,255,0.2); }
  }
  h1 {
    font-size: 24px; font-weight: 800; letter-spacing: -0.02em;
    background: linear-gradient(90deg, var(--cyan), var(--magenta));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sub { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .field { margin-bottom: 16px; }
  label {
    display: block; font-size: 12px; font-weight: 600;
    color: var(--muted); margin-bottom: 7px;
    letter-spacing: 0.02em;
  }
  input[type="email"], input[type="password"] {
    width: 100%; background: rgba(0,0,0,0.3);
    border: 1px solid var(--border); border-radius: 12px;
    color: var(--text); font-size: 14px; padding: 13px 16px;
    outline: none; transition: all 0.2s;
    font-family: inherit;
  }
  input[type="email"]::placeholder, input[type="password"]::placeholder {
    color: rgba(139,152,165,0.5);
  }
  input[type="email"]:focus, input[type="password"]:focus {
    border-color: var(--cyan);
    background: rgba(0,212,255,0.04);
    box-shadow: 0 0 0 4px rgba(0,212,255,0.12);
  }
  .row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 24px; font-size: 12px;
  }
  .checkbox-wrap { display: flex; align-items: center; gap: 8px; color: var(--muted); cursor: pointer; user-select: none; }
  .checkbox-wrap input { width: 14px; height: 14px; accent-color: var(--cyan); cursor: pointer; }
  .forgot { color: var(--cyan); text-decoration: none; font-weight: 500; transition: opacity 0.15s; }
  .forgot:hover { opacity: 0.75; }
  button[type="submit"] {
    width: 100%; padding: 14px;
    background: linear-gradient(135deg, var(--cyan), var(--magenta));
    color: #fff; border: none; border-radius: 12px;
    font-size: 14px; font-weight: 700; letter-spacing: 0.01em;
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 14px rgba(0,212,255,0.25);
    font-family: inherit;
  }
  button[type="submit"]:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(255,0,200,0.35);
  }
  button[type="submit"]:active:not(:disabled) { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,212,255,0.3); }
  button[type="submit"]:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  /* Show/hide password toggle */
  .password-wrap { position: relative; }
  .password-wrap input { padding-right: 48px !important; }
  .password-toggle {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: var(--muted); cursor: pointer;
    font-size: 18px; padding: 6px 8px; border-radius: 6px; line-height: 1;
    transition: opacity 0.15s, background 0.15s;
    opacity: 0.7;
  }
  .password-toggle:hover { opacity: 1; background: rgba(255,255,255,0.05); }
  /* Loading spinner */
  .btn-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff; border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin-right: 8px; vertical-align: -2px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error {
    background: rgba(255,77,106,0.08);
    border: 1px solid rgba(255,77,106,0.25);
    color: var(--red); border-radius: 10px;
    padding: 11px 14px; font-size: 13px;
    margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
  }
  .footer-text {
    text-align: center; color: var(--muted); font-size: 12px;
    margin-top: 24px; padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.04);
  }
  .footer-text a { color: var(--cyan); text-decoration: none; }
  @media (max-width: 480px) {
    .card { padding: 32px 24px; border-radius: 16px; }
    h1 { font-size: 22px; }
    .logo { width: 48px; height: 48px; font-size: 22px; }
  }
</style>
</head>
<body>
<div class="card">
  <div class="logo-wrap">
    <div class="logo">⚡</div>
    <h1>Agent Avila</h1>
    <p class="sub">Sign in to your trading dashboard</p>
  </div>
  ${error ? `<div class="error">⚠ ${error}</div>` : ""}
  <form method="POST" action="/api/login" autocomplete="on" id="login-form" onsubmit="return handleLoginSubmit(event)">
    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" name="email" placeholder="you@example.com" autocomplete="email" required autofocus>
    </div>
    <div class="field">
      <label for="password">Password</label>
      <div class="password-wrap">
        <input id="password" type="password" name="password" placeholder="••••••••" autocomplete="current-password" required>
        <button type="button" class="password-toggle" onclick="togglePassword()" id="pw-toggle" aria-label="Toggle password visibility">👁</button>
      </div>
    </div>
    <div class="row">
      <label class="checkbox-wrap">
        <input type="checkbox" name="rememberMe" id="rememberMe"> Remember me
      </label>
      <button type="button" class="forgot" id="forgot-link" onclick="openForgot()" style="background:none;border:none;padding:0;font:inherit;cursor:pointer">Forgot password?</button>
    </div>
    <button type="submit" id="login-submit"><span id="login-btn-text">Sign in →</span></button>
  </form>
  <div class="footer-text">
    <p style="margin-bottom:4px">Secured by encrypted session · 2FA ready</p>
    <a href="https://github.com/relentlessvic/agent-avila" style="text-decoration:underline">github.com/relentlessvic/agent-avila</a>
  </div>
  <script>
    function togglePassword() {
      var pw = document.getElementById("password");
      var btn = document.getElementById("pw-toggle");
      if (pw.type === "password") { pw.type = "text"; btn.textContent = "🙈"; }
      else { pw.type = "password"; btn.textContent = "👁"; }
    }
    function showLoginError(msg) {
      var existing = document.querySelector(".error");
      if (existing) existing.remove();
      var card = document.querySelector(".card");
      var form = document.getElementById("login-form");
      var err = document.createElement("div");
      err.className = "error";
      err.textContent = "⚠ " + msg;
      card.insertBefore(err, form);
    }
    function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
    var submitting = false;
    function setLoginPhase(phase, message) {
      var btn = document.getElementById("login-submit");
      var txt = document.getElementById("login-btn-text");
      if (!btn || !txt) return;
      if (phase === "idle")        { btn.disabled = false; txt.textContent = "Sign in →"; }
      else if (phase === "loading"){ btn.disabled = true;  txt.innerHTML = '<span class="btn-spinner"></span>Signing in...'; }
      else if (phase === "success"){ btn.disabled = true;  txt.innerHTML = '<span class="btn-spinner"></span>Redirecting...'; }
      else if (phase === "error")  { btn.disabled = false; txt.textContent = "Sign in →"; if (message) showLoginError(message); }
    }
    function readApiResponse(data) {
      // Single envelope: success/data/error. Legacy 'ok' tolerated on READ
      // for one transition window — never written by the server now.
      if (!data || typeof data !== "object") return { ok: false, error: "Malformed response" };
      var success = data.success === true || data.ok === true;
      var payload = data.data || {};
      return {
        ok:       success,
        error:    data.error || data.message || null,
        redirect: payload.redirect || data.redirect || null,
      };
    }
    async function handleLoginSubmit(e) {
      e.preventDefault();
      if (submitting) return false;
      var email = document.getElementById("email").value.trim();
      var pw    = document.getElementById("password").value;
      var rememberMe = document.getElementById("rememberMe")?.checked || false;

      if (!email || !pw)        { showLoginError("Email and password are required"); return false; }
      if (!isValidEmail(email)) { showLoginError("Invalid email format");            return false; }

      submitting = true;
      setLoginPhase("loading");

      try {
        var controller = new AbortController();
        var timer = setTimeout(function(){ controller.abort(); }, 15000);
        var res;
        try {
          res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, password: pw, rememberMe: rememberMe }),
            signal: controller.signal,
          });
        } catch (netErr) {
          clearTimeout(timer);
          if (netErr.name === "AbortError") throw new Error("Request timed out — please try again");
          throw new Error("Network error — check your connection");
        }
        clearTimeout(timer);

        var data;
        try { data = await res.json(); }
        catch { throw new Error("Server returned invalid response"); }

        var parsed = readApiResponse(data);

        if (!res.ok || !parsed.ok) {
          if (res.status === 401) throw new Error(parsed.error || "Invalid email or password");
          if (res.status === 429) throw new Error("Too many attempts — please wait a minute and try again");
          if (res.status >= 500)  throw new Error("Server error — please try again shortly");
          throw new Error(parsed.error || "Login failed");
        }

        // Auth carrier is the HttpOnly pending_2fa / session cookie set by the
        // server. Frontend only persists the remembered email for UX autofill.
        if (rememberMe) localStorage.setItem("avila_email", email);
        else            localStorage.removeItem("avila_email");

        setLoginPhase("success");
        setTimeout(function(){ window.location.href = parsed.redirect || "/2fa"; }, 250);
        return false;
      } catch (err) {
        submitting = false;
        setLoginPhase("error", err.message || "Login failed");
        return false;
      }
    }
    // Forgot password — real modal action, hits /api/forgot-password
    function openForgot() {
      if (document.getElementById("forgot-modal")) return;
      var overlay = document.createElement("div");
      overlay.id = "forgot-modal";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px";
      overlay.innerHTML = '<div style="background:#0F1525;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;max-width:380px;width:100%;color:#E6EAF1">' +
        '<h2 style="margin:0 0 8px;font-size:18px;font-weight:700">Reset access</h2>' +
        '<p style="margin:0 0 16px;font-size:13px;color:#8B98A5;line-height:1.5">Enter your account email. If it matches, recovery instructions will be sent and you can authenticate via your backup phrase on the 2FA screen.</p>' +
        '<input id="forgot-email" type="email" placeholder="you@example.com" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#E6EAF1;font-size:14px;padding:11px 14px;outline:none;margin-bottom:14px;font-family:inherit" />' +
        '<div id="forgot-msg" style="font-size:12px;margin-bottom:12px;min-height:16px"></div>' +
        '<div style="display:flex;gap:8px">' +
          '<button type="button" id="forgot-cancel" style="flex:1;padding:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#E6EAF1;border-radius:10px;cursor:pointer;font-family:inherit;font-size:13px">Cancel</button>' +
          '<button type="button" id="forgot-submit" style="flex:1;padding:11px;background:linear-gradient(135deg,#00D4FF,#7C5CFF);border:none;color:#fff;border-radius:10px;cursor:pointer;font-weight:600;font-family:inherit;font-size:13px">Send</button>' +
        '</div></div>';
      document.body.appendChild(overlay);
      function close() { overlay.remove(); }
      document.getElementById("forgot-cancel").onclick = close;
      overlay.addEventListener("click", function(e){ if (e.target === overlay) close(); });
      document.getElementById("forgot-submit").onclick = async function() {
        var em = document.getElementById("forgot-email").value.trim();
        var msg = document.getElementById("forgot-msg");
        var btn = document.getElementById("forgot-submit");
        if (!isValidEmail(em)) { msg.style.color = "#FF4D6A"; msg.textContent = "Invalid email format"; return; }
        btn.disabled = true; btn.textContent = "Sending…";
        try {
          var r = await fetch("/api/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: em }),
          });
          var d; try { d = await r.json(); } catch { d = {}; }
          msg.style.color = "#10D9A0";
          msg.textContent = (d && (d.data?.message || d.message || d.error)) || "If that email exists, recovery instructions have been sent.";
          btn.textContent = "Done";
          setTimeout(close, 2200);
        } catch (e) {
          msg.style.color = "#FF4D6A"; msg.textContent = "Network error — try again";
          btn.disabled = false; btn.textContent = "Send";
        }
      };
    }
    // Auto-restore email on page load if previously remembered
    (function() {
      var saved = localStorage.getItem("avila_email");
      if (saved) {
        var emailInput = document.getElementById("email");
        var rememberInput = document.getElementById("rememberMe");
        if (emailInput && !emailInput.value) emailInput.value = saved;
        if (rememberInput) rememberInput.checked = true;
      }
    })();
  </script>
</div>
</body>
</html>`;
}

const pendingSessions = new Set(_persisted.pending);
// File-backed rate-limit state — survives Railway restarts so a redeploy or
// container shuffle can't reset an attacker's counter. File is gitignored.
const RATE_LIMIT_FILE = dataPath(".rate-limit-state.json");
function loadRateLimitState() {
  if (!existsSync(RATE_LIMIT_FILE)) return { login: [], twofa: [], forgot: [] };
  try {
    const raw = JSON.parse(readFileSync(RATE_LIMIT_FILE, "utf8"));
    return {
      login:  Array.isArray(raw.login)  ? raw.login  : [],
      twofa:  Array.isArray(raw.twofa)  ? raw.twofa  : [],
      forgot: Array.isArray(raw.forgot) ? raw.forgot : [],
    };
  } catch { return { login: [], twofa: [], forgot: [] }; } // corrupt → start clean
}
const _rl = loadRateLimitState();
const loginAttempts  = new Map(_rl.login);  // ip -> { count, first } — sliding 5-min window
const twofaAttempts  = new Map(_rl.twofa);  // ip -> { count, first } — POST /2fa
const forgotAttempts = new Map(_rl.forgot); // ip -> { count, first } — POST /api/forgot-password

function persistRateLimits() {
  try {
    writeFileSync(RATE_LIMIT_FILE, JSON.stringify({
      login:  [...loginAttempts],
      twofa:  [...twofaAttempts],
      forgot: [...forgotAttempts],
    }));
  } catch (e) { log.warn("rate-limit", `persist failed: ${e.message}`); }
}

// Shared sliding-window check — same shape as /api/login uses inline.
// Returns true if the request is allowed; false if the IP has exceeded `limit`
// within the trailing `windowMs`. Mutates the bucket in place and persists.
function rateLimited(bucket, ip, limit = 8, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const rec = bucket.get(ip) || { count: 0, first: now };
  if (now - rec.first > windowMs) { rec.count = 0; rec.first = now; }
  rec.count++;
  bucket.set(ip, rec);
  persistRateLimits();
  return rec.count > limit;
}
function clientIp(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .toString().split(",")[0].trim();
}

// ── Canonical login response envelope ─────────────────────────────────────
//   success → { success: true,  data: {...} }
//   failure → { success: false, error: "..." }
// One contract. No `ok`, no parallel keys. Frontend transition layer still
// accepts legacy `ok` reads, but no new emitter writes it.
function authOk(data)   { return JSON.stringify({ success: true,  data }); }
function authFail(err)  { return JSON.stringify({ success: false, error: err }); }

// Single login handler. /api/login (canonical) and /login (deprecated alias)
// both route here. Response shape varies by Accept/Content-Type so the form
// keeps working with or without JS.
async function processLogin(req, res) {
  try {
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().split(",")[0].trim();
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;
    const limit = 8;
    const rec = loginAttempts.get(ip) || { count: 0, first: now };
    if (now - rec.first > windowMs) { rec.count = 0; rec.first = now; }
    rec.count++;
    loginAttempts.set(ip, rec);
    persistRateLimits();

    const body = await readBody(req);
    const ctype = (req.headers["content-type"] || "").toLowerCase();
    const accept = (req.headers["accept"] || "").toLowerCase();
    const wantsJson = ctype.includes("application/json") || accept.includes("application/json");

    let email = "", password = "", rememberMe = false;
    if (ctype.includes("application/json")) {
      try {
        const j = JSON.parse(body);
        email = j.email || "";
        password = j.password || "";
        rememberMe = !!(j.rememberMe || j.remember);
      } catch { /* fall through to urlencoded */ }
    }
    if (!email && !password) {
      const p = new URLSearchParams(body);
      email = p.get("email") || "";
      password = p.get("password") || "";
      rememberMe = !!(p.get("rememberMe") || p.get("remember"));
    }

    if (rec.count > limit) {
      log.warn("/api/login", `rate-limited ${ip} (${rec.count} attempts)`);
      if (wantsJson) {
        res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "60" });
        res.end(authFail("Too many attempts. Try again in a minute."));
      } else {
        res.writeHead(429, { "Content-Type": "text/html", "Retry-After": "60" });
        res.end(loginPage("Too many attempts. Try again in a minute."));
      }
      return;
    }

    const valid =
      email === (process.env.DASHBOARD_EMAIL || "") &&
      safeStringEqual(password, process.env.DASHBOARD_PASSWORD || "");

    if (valid) {
      loginAttempts.delete(ip);
      persistRateLimits();
      const pending = generateToken();
      pendingSessions.add(pending);
      persistSessions();
      const cookieMaxAge = rememberMe ? "; Max-Age=2592000" : "";
      const setCookie = `pending_2fa=${pending}; HttpOnly; SameSite=Strict; Path=/${cookieMaxAge}${COOKIE_SECURE}`;
      if (wantsJson) {
        res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": setCookie });
        res.end(authOk({ redirect: "/2fa", rememberMe }));
      } else {
        res.writeHead(302, { "Set-Cookie": setCookie, Location: "/2fa" });
        res.end();
      }
      return;
    }

    log.warn("/api/login", `failed login attempt for "${email.slice(0,40)}"`);
    if (wantsJson) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(authFail("Invalid email or password."));
    } else {
      res.writeHead(401, { "Content-Type": "text/html" });
      res.end(loginPage("Invalid email or password."));
    }
  } catch (e) {
    log.error("/api/login", e.message);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(authFail("Server error."));
    }
  }
}

// TOTP (RFC 6238) — no external deps
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(s) {
  s = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, val = 0;
  const out = [];
  for (const ch of s) {
    val = (val << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((val >>> bits) & 0xff); }
  }
  return Buffer.from(out);
}

function genBase32Secret() {
  const buf = crypto.randomBytes(20);
  let result = "", bits = 0, val = 0;
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { bits -= 5; result += BASE32[(val >>> bits) & 31]; }
  }
  if (bits > 0) result += BASE32[(val << (5 - bits)) & 31];
  return result;
}

function verifyTotp(secret, code) {
  const key = base32Decode(secret);
  const step = Math.floor(Date.now() / 1000 / 30);
  for (const drift of [-1, 0, 1]) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(step + drift));
    const hmac = crypto.createHmac("sha1", key).update(buf).digest();
    const offset = hmac[19] & 0xf;
    const otp = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1_000_000;
    if (String(otp).padStart(6, "0") === String(code).trim()) return true;
  }
  return false;
}

function twoFaPage(error = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>2FA — Agent Avila</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  /* Phase 9a — palette aligned with Phase 8 (cyan + magenta accents). */
  :root {
    --bg: #0A0F1A; --bg-deep: #040711; --card: #121A2A;
    --border: rgba(0,212,255,0.12);
    --text: #E6EDF3; --muted: #8B98A5;
    --cyan: #00D4FF; --magenta: #FF00C8;
    --red: #FF4D6A; --green: #00FF9A;
  }
  html, body { height: 100%; }
  body {
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 20px;
    overflow: hidden;
    background:
      radial-gradient(ellipse 80% 50% at 50% 0%,    rgba(0,212,255,0.06)  0%, transparent 60%),
      radial-gradient(ellipse 80% 50% at 50% 100%,  rgba(255,0,200,0.05)  0%, transparent 60%),
      linear-gradient(180deg, var(--bg) 0%, var(--bg-deep) 100%);
    background-attachment: fixed;
  }
  /* Subtle blueprint grid behind content. */
  body::before {
    content: ""; position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.020) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.020) 1px, transparent 1px);
    background-size: 50px 50px;
    mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%);
    -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%);
    pointer-events: none;
  }
  .card {
    position: relative; width: 100%; max-width: 420px;
    background: rgba(18,26,42,0.85);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--border); border-radius: 20px;
    padding: 44px 40px;
    box-shadow:
      0 20px 60px rgba(0,0,0,0.5),
      0 0 40px rgba(0,212,255,0.08),
      inset 0 1px 0 rgba(255,255,255,0.04);
    animation: cardIn 0.6s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }
  /* Gradient border accent (cyan → magenta). */
  .card::before {
    content: ""; position: absolute; inset: -1px; border-radius: 20px;
    background: linear-gradient(135deg, rgba(0,212,255,0.5), rgba(255,0,200,0.5), transparent 60%);
    z-index: -1; opacity: 0.4;
  }
  .logo-wrap { display: flex; flex-direction: column; align-items: center; margin-bottom: 28px; text-align: center; }
  .logo {
    width: 56px; height: 56px; border-radius: 16px;
    background: linear-gradient(135deg, var(--cyan), var(--magenta));
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; color: #fff;
    box-shadow: 0 8px 24px rgba(0,212,255,0.30), inset 0 1px 0 rgba(255,255,255,0.2);
    margin-bottom: 16px;
    animation: logoPulse 3s ease-in-out infinite;
  }
  @keyframes logoPulse {
    0%,100% { box-shadow: 0 8px 24px rgba(0,212,255,0.30), inset 0 1px 0 rgba(255,255,255,0.2); }
    50%     { box-shadow: 0 8px 32px rgba(255,0,200,0.40), inset 0 1px 0 rgba(255,255,255,0.2); }
  }
  h1 {
    font-size: 22px; font-weight: 800; letter-spacing: -0.02em;
    background: linear-gradient(90deg, var(--cyan), var(--magenta));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sub { color: var(--muted); font-size: 13px; margin-top: 4px; }
  label {
    display: block; font-size: 11px; font-weight: 600;
    color: var(--muted); margin-bottom: 7px;
    letter-spacing: 0.05em; text-transform: uppercase;
  }
  .totp-input, .phrase-input {
    width: 100%; background: rgba(0,0,0,0.3);
    border: 1px solid var(--border); border-radius: 12px;
    color: var(--text); padding: 13px 16px;
    outline: none; transition: all 0.2s;
    font-family: inherit; margin-bottom: 14px;
  }
  .totp-input {
    font-size: 24px; letter-spacing: 8px; text-align: center;
    font-variant-numeric: tabular-nums; font-weight: 600;
  }
  .phrase-input { font-size: 14px; }
  .totp-input::placeholder, .phrase-input::placeholder { color: rgba(139,152,165,0.5); letter-spacing: normal; }
  .totp-input:focus, .phrase-input:focus {
    border-color: var(--cyan);
    background: rgba(0,212,255,0.04);
    box-shadow: 0 0 0 4px rgba(0,212,255,0.12);
  }
  .btn-primary {
    width: 100%; padding: 14px;
    background: linear-gradient(135deg, var(--cyan), var(--magenta));
    color: #fff; border: none; border-radius: 12px;
    font-size: 14px; font-weight: 700; letter-spacing: 0.01em;
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 14px rgba(0,212,255,0.25);
    font-family: inherit;
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255,0,200,0.35); }
  .btn-primary:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,212,255,0.25); }
  .btn-secondary {
    width: 100%; padding: 12px;
    background: transparent; color: var(--text);
    border: 1px solid var(--border); border-radius: 12px;
    font-size: 13px; font-weight: 600;
    cursor: pointer; transition: border-color 0.2s, background 0.2s;
    font-family: inherit;
  }
  .btn-secondary:hover { border-color: rgba(0,212,255,0.4); background: rgba(0,212,255,0.04); }
  .error {
    background: rgba(255,77,106,0.08);
    border: 1px solid rgba(255,77,106,0.25);
    color: var(--red); border-radius: 10px;
    padding: 11px 14px; font-size: 13px;
    margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
  }
  .divider { display: flex; align-items: center; gap: 12px; margin: 22px 0 18px; color: var(--muted); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
  .backup-label { font-size: 12px; color: var(--muted); margin-bottom: 12px; line-height: 1.5; }
  .footer-text {
    text-align: center; color: var(--muted); font-size: 12px;
    margin-top: 22px; padding-top: 18px;
    border-top: 1px solid rgba(255,255,255,0.04);
  }
  .footer-text a { color: var(--muted); text-decoration: none; transition: color 0.15s; }
  .footer-text a:hover { color: var(--text); }
  @media (max-width: 480px) {
    .card { padding: 32px 24px; border-radius: 16px; }
    h1 { font-size: 20px; }
    .logo { width: 48px; height: 48px; font-size: 22px; }
    .totp-input { font-size: 20px; letter-spacing: 6px; }
  }
</style>
</head>
<body>
<div class="card">
  <div class="logo-wrap">
    <div class="logo">⚡</div>
    <h1>Two-Factor Auth</h1>
    <p class="sub">Enter the 6-digit code from your authenticator app</p>
  </div>
  ${error ? `<div class="error">⚠ ${error}</div>` : ""}
  <form method="POST" action="/2fa">
    <label>Authenticator Code</label>
    <input class="totp-input" type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" placeholder="000000" autofocus>
    <button class="btn-primary" type="submit">Verify →</button>
  </form>
  <div class="divider">or use backup</div>
  <p class="backup-label">Can't access your authenticator? Use the backup phrase you saved when 2FA was set up.</p>
  <form method="POST" action="/2fa">
    <label>Backup Phrase</label>
    <input class="phrase-input" type="password" name="backup" autocomplete="off" placeholder="Enter backup phrase">
    <button class="btn-secondary" type="submit">Use Backup Phrase</button>
  </form>
  <div class="footer-text">
    <a href="/login">← Back to login</a>
  </div>
</div>
</body>
</html>`;
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>Agent Avila</title>
<!-- PWA -->
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0B0F1A">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Agent Avila">
<link rel="apple-touch-icon" href="/icon-192.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<script src="https://s3.tradingview.com/tv.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    /* Dark Pro Trading Theme */
    --bg:      #0B0F1A;
    --card:    #121A2A;
    --border:  rgba(0,212,255,0.12);
    --text:    #E6EDF3;
    --muted:   #8B98A5;
    --green:   #00FF9A;
    --red:     #FF4D6A;
    --yellow:  #FFB547;
    --blue:    #00D4FF;
    --purple:  #7C5CFF;
    --glow-blue:  rgba(0,212,255,0.15);
    --glow-green: rgba(0,255,154,0.15);
    --glow-red:   rgba(255,77,106,0.12);
    --glass-bg:   rgba(18,26,42,0.75);
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    min-height: 100vh;
  }

  nav {
    background: rgba(18,26,42,0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .nav-left { display: flex; align-items: center; gap: 16px; }
  .nav-title { font-size: 16px; font-weight: 700; background: linear-gradient(90deg, var(--blue), var(--purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .nav-right { display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: 13px; }
  /* ── Hamburger ── */
  .hamburger { background:none; border:none; cursor:pointer; padding:6px; display:flex; flex-direction:column; gap:4px; }
  .hamburger span { display:block; width:20px; height:2px; background:var(--muted); border-radius:1px; transition:all 0.2s; }
  .hamburger:hover span { background:var(--text); }
  /* ── Nav Drawer ── */
  .nav-drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:200; opacity:0; pointer-events:none; transition:opacity 0.2s; }
  .nav-drawer-overlay.open { opacity:1; pointer-events:all; }
  .nav-drawer { position:fixed; left:0; top:0; bottom:0; width:260px; background:rgba(18,26,42,0.97); backdrop-filter:blur(20px); border-right:1px solid var(--border); z-index:201; transform:translateX(-100%); transition:transform 0.25s cubic-bezier(0.4,0,0.2,1); padding:0; display:flex; flex-direction:column; }
  .nav-drawer.open { transform:translateX(0); }
  .nav-drawer-header { padding:20px 20px 16px; border-bottom:1px solid var(--border); }
  .nav-drawer-logo { font-size:18px; font-weight:800; background:linear-gradient(90deg,var(--blue),var(--purple)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .nav-drawer-sub { font-size:11px; color:var(--muted); margin-top:2px; }
  .nav-drawer-items { flex:1; overflow-y:auto; padding:12px 0; }
  .nav-item { display:flex; align-items:center; gap:12px; padding:10px 20px; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; transition:all 0.15s; border-left:2px solid transparent; text-decoration:none; }
  .nav-item:hover { color:var(--text); background:rgba(255,255,255,0.03); border-left-color:var(--border); }
  .nav-item.active { color:var(--blue); background:rgba(0,212,255,0.06); border-left-color:var(--blue); }
  .nav-item-icon { font-size:16px; width:20px; text-align:center; flex-shrink:0; }
  .nav-section-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--muted); padding:12px 20px 4px; }
  .nav-drawer-footer { padding:16px 20px; border-top:1px solid var(--border); }
  .nav-health-dot { width:7px; height:7px; border-radius:50%; display:inline-block; margin-right:6px; }
  /* ── System Health Panel ── */
  .health-monitor { background:var(--glass-bg); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:10px; padding:16px 20px; margin-bottom:24px; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  .health-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .health-check-item { display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid var(--border); }
  .health-check-icon { font-size:20px; }
  .health-check-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; text-align:center; }
  .health-check-status { font-size:12px; font-weight:700; }
  .health-ok   { color:var(--green); }
  .health-warn { color:var(--yellow); }
  .health-fail { color:var(--red); }
  @media(max-width:768px) { .health-grid { grid-template-columns:repeat(2,1fr); } }
  .badge {
    padding: 3px 10px; border-radius: 20px; font-size: 12px;
    font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
  }
  .badge-paper  { background: rgba(255,181,71,0.12);  color: var(--yellow); border: 1px solid rgba(255,181,71,0.3); }
  .badge-live   { background: rgba(0,255,154,0.1);    color: var(--green);  border: 1px solid rgba(0,255,154,0.3); }
  .badge-symbol { background: rgba(0,212,255,0.1);    color: var(--blue);   border: 1px solid rgba(0,212,255,0.2); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); display: inline-block; animation: pulse 2s infinite; box-shadow: 0 0 6px var(--green); }
  @keyframes pulse { 0%,100% { opacity: 1; box-shadow: 0 0 6px var(--green); } 50% { opacity: 0.5; box-shadow: 0 0 2px var(--green); } }

  /* ── Cards (lightweight, with hover lift) ── */
  .card, .stat-card, .pnl-card, .chart-card, .balance-card, .trade-terminal, .ctrl-panel, .paper-wallet, .position-card, .table-card, .perf-panel, .capital-panel, .portfolio-panel, .health-monitor {
    background: var(--card) !important;
    border: 1px solid var(--border) !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .card:hover, .stat-card:hover, .pnl-card:hover, .balance-card:hover, .perf-panel:hover, .capital-panel:hover, .portfolio-panel:hover, .health-monitor:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35), 0 0 12px rgba(0,212,255,0.05), inset 0 1px 0 rgba(255,255,255,0.05);
    border-color: rgba(0,212,255,0.18) !important;
  }

  /* ── Compact Status Bar (sticky, single source of truth) ── */
  .status-bar {
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    margin: -24px -24px 16px;
    padding: 10px 24px;
    background: rgba(11,15,26,0.92);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 50;
  }
  @media (max-width: 768px) {
    .status-bar { padding: 8px 14px; margin: -12px -12px 12px; gap: 6px; }
    .pill { font-size: 11px; padding: 4px 9px; }
  }
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; font-size: 12px; font-weight: 700;
    border-radius: 999px; border: 1px solid var(--border);
    background: rgba(255,255,255,0.02);
    transition: transform 0.15s, border-color 0.15s;
    white-space: nowrap;
  }
  .pill:hover { transform: translateY(-1px); }
  .pill strong { color: var(--text); font-weight: 800; }
  .pill-mode.live { background: rgba(255,77,106,0.1); border-color: rgba(255,77,106,0.4); color: var(--red); }
  .pill-mode      { color: var(--yellow); border-color: rgba(255,181,71,0.3); background: rgba(255,181,71,0.06); }
  .pill-symbol   { color: var(--text); }
  .pill-regime.trending { color: var(--blue);   border-color: rgba(0,212,255,0.3); background: rgba(0,212,255,0.06); }
  .pill-regime.range    { color: var(--yellow); border-color: rgba(255,181,71,0.3); background: rgba(255,181,71,0.06); }
  .pill-regime.volatile { color: var(--red);    border-color: rgba(255,77,106,0.3); background: rgba(255,77,106,0.06); }
  .pill-score-high { color: var(--green); border-color: rgba(0,255,154,0.35); background: rgba(0,255,154,0.05); }
  .pill-score-mid  { color: var(--yellow); }
  .pill-score-low  { color: var(--muted); }
  .pill-bot.running { color: var(--green); border-color: rgba(0,255,154,0.3); background: rgba(0,255,154,0.05); }
  .pill-bot.stopped { color: var(--red);   border-color: rgba(255,77,106,0.3); background: rgba(255,77,106,0.06); }
  .pill-pnl-pos { color: var(--green); }
  .pill-pnl-neg { color: var(--red); }
  .pill-last-trade { color: var(--muted); }
  .pill-max-trade  { color: var(--muted); }
  .pill-max-trade-na { color: var(--muted); opacity: 0.7; }
  .pill-daily-loss-ok     { color: var(--muted); }
  .pill-daily-loss-warn   { color: var(--yellow); border-color: rgba(255,181,71,0.4); background: rgba(255,181,71,0.06); }
  .pill-daily-loss-danger { color: var(--red);    border-color: rgba(255,77,106,0.4); background: rgba(255,77,106,0.08); }
  .pill-daily-loss-na     { color: var(--muted); opacity: 0.7; }
  /* Phase 6c — SSE stream health pill. Hidden when fresh; shown when the
     EventSource hasn't delivered an event in > 15s. */
  .pill-stream-warn { color: var(--yellow); border-color: rgba(255,181,71,0.4); background: rgba(255,181,71,0.08); }
  .pill-stream-err  { color: var(--red);    border-color: rgba(255,77,106,0.4); background: rgba(255,77,106,0.10); }

  /* ── Risk Alert Feed ── compact persistent list of last 5 risk events */
  .risk-feed {
    background: rgba(255,77,106,0.04);
    border: 1px solid rgba(255,77,106,0.18);
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 16px;
  }
  .risk-feed-header {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
    color: var(--red); text-transform: uppercase;
    margin-bottom: 6px;
  }
  .risk-feed-count { color: var(--muted); font-weight: 500; letter-spacing: 0; text-transform: none; }
  .risk-feed-list { display: flex; flex-direction: column; gap: 4px; }
  .risk-feed-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: var(--text);
    padding: 4px 0;
  }
  .risk-feed-row .ts { color: var(--muted); font-variant-numeric: tabular-nums; min-width: 56px; font-size: 11px; }
  .risk-feed-row .icon { font-size: 13px; line-height: 1; min-width: 16px; text-align: center; }
  .risk-feed-row .msg { flex: 1; }
  .risk-feed-empty {
    font-size: 12px; color: var(--muted); padding: 4px 0; opacity: 0.85;
  }
  .risk-feed-na { opacity: 0.65; }

  /* ── Strategy V2 Shadow card ── purple-tinted to visually separate from
     V1's existing surfaces. Shows the latest V2 verdict from safety-check
     log. Phase 1: read-only, no trade actions. */
  .v2-shadow {
    background: rgba(124,92,255,0.04);
    border: 1px solid rgba(124,92,255,0.22);
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 16px;
  }
  .v2-shadow-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 8px; gap: 10px; flex-wrap: wrap;
  }
  .v2-shadow-title {
    font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
    color: var(--purple); text-transform: uppercase;
  }
  .v2-shadow-disclaimer {
    font-size: 11px; color: var(--muted); font-style: italic;
  }
  .v2-shadow-body { display: flex; flex-direction: column; gap: 4px; }
  .v2-shadow-row {
    display: grid; grid-template-columns: 110px 1fr;
    gap: 10px; align-items: baseline;
    font-size: 12px;
    padding: 2px 0;
  }
  .v2-shadow-label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .v2-shadow-val   { color: var(--text); font-variant-numeric: tabular-nums; }
  .v2-shadow-decision { font-weight: 700; }
  .v2-shadow-decision-trade    { color: var(--green); }
  .v2-shadow-decision-deferred { color: var(--yellow); }
  .v2-shadow-decision-skip     { color: var(--muted); }
  .v2-shadow-empty {
    font-size: 12px; color: var(--muted); padding: 4px 0; opacity: 0.85;
  }
  @media (max-width: 768px) {
    .v2-shadow-row { grid-template-columns: 90px 1fr; gap: 8px; font-size: 11px; }
  }

  /* ── Discord status indicator (in health-strip) ── */
  .discord-status {
    font-size: 11px; font-weight: 600;
    padding: 2px 8px; border-radius: 999px;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .discord-status-ok      { color: var(--green);  background: rgba(0,255,154,0.06);  border-color: rgba(0,255,154,0.25); }
  .discord-status-warn    { color: var(--yellow); background: rgba(255,181,71,0.08); border-color: rgba(255,181,71,0.3); }
  .discord-status-unknown { color: var(--muted);  opacity: 0.75; }

  /* ── Emergency Kill button (top nav) ── */
  /* Visible but recessed — outline-only by default so it's not click-by-accident.
     Hover/focus fills red to make the action obvious before clicking. */
  .nav-kill-btn {
    background: transparent;
    color: var(--red);
    border: 1px solid rgba(255,77,106,0.45);
    border-radius: 6px;
    padding: 4px 10px;
    margin-left: 10px;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    font-family: inherit;
  }
  .nav-kill-btn:hover, .nav-kill-btn:focus-visible {
    background: var(--red);
    color: #fff;
    border-color: var(--red);
    outline: none;
  }
  .nav-kill-btn:active { transform: translateY(1px); }
  @media (max-width: 768px) {
    .nav-kill-btn { padding: 4px 8px; font-size: 11px; margin-left: 6px; }
    /* Keep label readable on narrow widths — let it shrink to icon if cramped */
  }

  /* ── Trading Status banner ── single READY/BLOCKED answer at the top */
  .trading-status {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 18px;
    margin: -24px -24px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 13px; font-weight: 700;
    letter-spacing: 0.02em;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 51;  /* above status-bar's z-index 50 */
    transition: background 0.2s, color 0.2s, border-color 0.2s;
  }
  .trading-status.ready {
    background: rgba(0,255,154,0.10);
    border-bottom-color: rgba(0,255,154,0.35);
    color: var(--green);
  }
  .trading-status.blocked {
    background: rgba(255,77,106,0.10);
    border-bottom-color: rgba(255,77,106,0.4);
    color: var(--red);
  }
  .trading-status.paper {
    background: rgba(255,181,71,0.10);
    border-bottom-color: rgba(255,181,71,0.35);
    color: var(--yellow);
  }
  .trading-status-icon { font-size: 16px; line-height: 1; }
  @media (max-width: 768px) {
    .trading-status { padding: 8px 14px; margin: -12px -12px 12px; font-size: 12px; }
  }

  /* ── How It Works accordion ── */
  .how-it-works { background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
  .how-toggle { width: 100%; background: transparent; border: none; color: var(--text); font-size: 13px; font-weight: 700; padding: 12px 18px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
  .how-toggle:hover { background: rgba(255,255,255,0.02); }
  .how-arrow { transition: transform 0.2s; opacity: 0.6; font-size: 10px; }
  .how-it-works.open .how-arrow { transform: rotate(180deg); }
  .how-body { display: none; padding: 0 18px 16px; font-size: 13px; line-height: 1.7; color: var(--muted); }
  .how-it-works.open .how-body { display: block; animation: slideDown 0.25s ease-out; }
  @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }
  .how-section { margin-bottom: 12px; }
  .how-section:last-child { margin-bottom: 0; }
  .how-section ul { padding-left: 18px; margin: 6px 0; }
  .how-section li { margin: 3px 0; }

  /* ── Last Decision Panel ── */
  .last-decision { padding: 18px 22px !important; margin-bottom: 20px; }
  .last-decision-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .last-decision-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; }
  .last-decision-time { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .last-decision-body { display: flex; flex-direction: column; gap: 6px; }
  .last-decision-result { display: flex; align-items: center; gap: 10px; }
  .last-decision-icon { font-size: 22px; }
  .last-decision-text { font-size: 16px; font-weight: 700; color: var(--text); }
  .last-decision-reason { font-size: 13px; color: var(--muted); padding-left: 32px; }
  .next-trade-block { margin-top: 12px; padding: 12px 14px; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(0,212,255,0.12); }
  .next-trade-label { font-size: 10px; color: var(--blue); text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; margin-bottom: 8px; }
  .next-trade-list { list-style: none; padding: 0; margin: 0; }
  .next-trade-list li { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 5px 0; color: var(--muted); border-bottom: 1px solid rgba(255,255,255,0.03); }
  .next-trade-list li:last-child { border-bottom: none; }
  .next-trade-list li.cond-pass { color: var(--green); }
  .next-trade-list li .cond-status { font-size: 12px; min-width: 16px; }

  /* ── Mode Banner ── */
  .mode-banner { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-radius: 10px; margin-bottom: 20px; font-size: 13px; line-height: 1.4; border: 1px solid; transition: all 0.3s; }
  .mode-banner-icon { font-size: 18px; }
  .mode-banner.mode-paper { background: rgba(255,181,71,0.06); border-color: rgba(255,181,71,0.25); color: var(--text); }
  .mode-banner.mode-paper strong { color: var(--yellow); }
  .mode-banner.mode-live { background: rgba(255,77,106,0.08); border-color: rgba(255,77,106,0.4); color: var(--text); box-shadow: 0 0 18px rgba(255,77,106,0.1); animation: pulseLive 3s ease-in-out infinite; }
  .mode-banner.mode-live strong { color: var(--red); }
  @keyframes pulseLive { 0%,100% { box-shadow: 0 0 18px rgba(255,77,106,0.1); } 50% { box-shadow: 0 0 26px rgba(255,77,106,0.22); } }

  /* ── Check Log (terminal-style) ── */
  .check-log { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; line-height: 1.7; padding: 16px 20px; background: rgba(0,0,0,0.25) !important; max-height: 280px; overflow-y: auto; }
  .check-log-line { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .check-log-line.muted    { opacity: 0.5; }
  .check-log-line.cl-skip  { color: var(--muted); }
  .check-log-line.cl-trade { color: var(--green); font-weight: 700; }
  .check-log-line.cl-exit  { color: var(--blue); }
  .check-log-line.cl-block { color: var(--yellow); }
  .check-log-line.cl-loss  { color: var(--red); font-weight: 700; }
  .check-log-time { color: rgba(139,148,158,0.55); margin-right: 6px; }

  /* Phase 8b — button spinner injected by lockBtn while a request is in flight. */
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn-spinner { display:inline-block; width:12px; height:12px; border:2px solid rgba(255,255,255,0.25); border-top-color:currentColor; border-radius:50%; animation:spin 0.7s linear infinite; vertical-align:middle; margin-right:6px; }

  /* ── Toast Notifications ── */
  .toast-container { position: fixed; top: 16px; right: 16px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; max-width: 360px; }
  .toast { background: rgba(18,26,42,0.95); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 10px; min-width: 240px; pointer-events: all; animation: toastIn 0.3s cubic-bezier(0.16,1,0.3,1); transform-origin: top right; }
  .toast.toast-out { animation: toastOut 0.25s ease-in forwards; }
  @keyframes toastIn  { from { opacity: 0; transform: translateX(20px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
  @keyframes toastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(20px); } }
  .toast-icon  { font-size: 18px; flex-shrink: 0; }
  .toast-msg   { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; line-height: 1.4; }
  .toast-success { border-color: rgba(0,255,154,0.3); box-shadow: 0 8px 24px rgba(0,255,154,0.1); }
  .toast-error   { border-color: rgba(255,77,106,0.3); box-shadow: 0 8px 24px rgba(255,77,106,0.1); }
  .toast-info    { border-color: rgba(0,212,255,0.3);  box-shadow: 0 8px 24px rgba(0,212,255,0.1); }
  .toast-warn    { border-color: rgba(255,181,71,0.3); box-shadow: 0 8px 24px rgba(255,181,71,0.1); }

  /* ── Modal Dialog ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center; z-index: 10000; padding: 20px; pointer-events: none; }
  .modal-overlay.open { display: flex; animation: fadeIn 0.2s ease-out; pointer-events: auto; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; max-width: 420px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,212,255,0.1); animation: modalIn 0.25s cubic-bezier(0.16,1,0.3,1); }
  @keyframes modalIn { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .modal-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(255,77,106,0.12); display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px; }
  .modal-title { font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
  .modal-msg { font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
  .modal-input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 14px; padding: 12px 14px; outline: none; margin-bottom: 16px; font-family: inherit; }
  .modal-input:focus { border-color: var(--red); box-shadow: 0 0 0 3px rgba(255,77,106,0.15); }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .modal-btn { padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; transition: all 0.15s; font-family: inherit; }
  .modal-btn-cancel { background: rgba(255,255,255,0.05); color: var(--muted); }
  .modal-btn-cancel:hover { background: rgba(255,255,255,0.08); color: var(--text); }
  .modal-btn-confirm { background: linear-gradient(135deg, var(--red), #d63a55); color: #fff; box-shadow: 0 4px 12px rgba(255,77,106,0.3); }
  .modal-btn-confirm:hover { box-shadow: 0 6px 20px rgba(255,77,106,0.45); transform: translateY(-1px); }
  .modal-btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

  /* ── Loading skeletons ── */
  .skeleton { display: inline-block; min-width: 60px; min-height: 1em; background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%); background-size: 200% 100%; animation: shimmer-bg 1.5s ease-in-out infinite; border-radius: 4px; color: transparent !important; }
  @keyframes shimmer-bg { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* ── Keyboard shortcut hint ── */
  .kbd { display: inline-block; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; padding: 1px 5px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 4px; color: var(--muted); margin: 0 2px; }

  /* ── Hero Live Ticker ── */
  .hero-ticker { display:flex; align-items:center; justify-content:space-between; padding:18px 28px; margin-bottom:24px; background: linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(124,92,255,0.06) 100%); border:1px solid rgba(0,212,255,0.18); border-radius:14px; box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04); position:relative; overflow:hidden; }
  .hero-ticker::before { content:""; position:absolute; top:0; left:-100%; width:100%; height:1px; background:linear-gradient(90deg, transparent, var(--blue), transparent); animation: shimmer 3s ease-in-out infinite; }
  @keyframes shimmer { 0% { left:-100%; } 100% { left:100%; } }
  .ticker-left { display:flex; align-items:center; gap:18px; }
  .ticker-pair { font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:1.5px; }
  .ticker-symbol-icon { width:36px; height:36px; border-radius:50%; background: linear-gradient(135deg, var(--blue), var(--purple)); display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:900; color:#fff; box-shadow: 0 0 18px rgba(0,212,255,0.35); }
  .ticker-price { font-size:32px; font-weight:900; font-variant-numeric:tabular-nums; transition:color 0.4s ease; line-height:1; }
  .ticker-arrow { display:inline-block; font-size:18px; transition:transform 0.3s; }
  .ticker-arrow.up   { color:var(--green); animation: bounce-up   0.5s; }
  .ticker-arrow.down { color:var(--red);   animation: bounce-down 0.5s; }
  @keyframes bounce-up   { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
  @keyframes bounce-down { 0%,100% { transform:translateY(0); } 50% { transform:translateY(4px); } }
  .ticker-right { display:flex; gap:24px; align-items:center; }
  .ticker-stat { text-align:right; }
  .ticker-stat-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .ticker-stat-value { font-size:18px; font-weight:800; font-variant-numeric:tabular-nums; }
  .ticker-pulse-dot { width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow: 0 0 8px var(--green); animation: pulse-glow 2s ease-in-out infinite; display:inline-block; margin-right:6px; }
  @keyframes pulse-glow { 0%,100% { box-shadow:0 0 8px var(--green); opacity:1; } 50% { box-shadow:0 0 14px var(--green); opacity:0.7; } }
  .ticker-live-label { font-size:11px; font-weight:700; color:var(--green); letter-spacing:1px; }
  @media(max-width:768px) { .hero-ticker { flex-direction:column; gap:12px; padding:14px 18px; } .ticker-right { width:100%; justify-content:space-around; } .ticker-price { font-size:24px; } }

  /* Health ring pulse */
  .portfolio-score-ring { animation: ring-breathe 4s ease-in-out infinite; }
  @keyframes ring-breathe { 0%,100% { box-shadow: 0 0 20px rgba(0,212,255,0.15); } 50% { box-shadow: 0 0 32px rgba(0,212,255,0.3); } }

  /* Number tween animation */
  .num-flash-up   { animation: flash-green 0.8s ease-out; }
  .num-flash-down { animation: flash-red   0.8s ease-out; }
  @keyframes flash-green { 0% { color:var(--green); text-shadow:0 0 10px var(--green); } 100% { } }
  @keyframes flash-red   { 0% { color:var(--red);   text-shadow:0 0 10px var(--red);   } 100% { } }

  /* Cards (lightweight) closing wrapper */
  .position-card.pos-open {
    border-color: rgba(0,212,255,0.3) !important;
    box-shadow: 0 0 30px var(--glow-blue), 0 8px 32px rgba(0,0,0,0.4) !important;
  }
  .position-card.pos-profit {
    border-color: rgba(0,255,154,0.3) !important;
    box-shadow: 0 0 30px var(--glow-green), 0 8px 32px rgba(0,0,0,0.4) !important;
  }
  .position-card.pos-loss {
    border-color: rgba(255,77,106,0.3) !important;
    box-shadow: 0 0 20px var(--glow-red), 0 8px 32px rgba(0,0,0,0.4) !important;
  }

  main { padding: 24px; padding-bottom: 96px; max-width: 1400px; margin: 0 auto; }

  /* ── Mobile responsive ── */
  @media (max-width: 768px) {
    main { padding: 12px; }
    nav { padding: 0 14px; height: 50px; }
    .nav-title { font-size: 14px; }
    .ctrl-groups { grid-template-columns: 1fr 1fr !important; }
    .trade-cmd-grid { grid-template-columns: 1fr !important; }
    .position-grid { grid-template-columns: repeat(2,1fr) !important; }
    .pnl-grid { grid-template-columns: repeat(2,1fr) !important; }
    .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
    .info-cards { grid-template-columns: repeat(2,1fr) !important; }
    .indicators-safety-grid { grid-template-columns: 1fr !important; }
    .heatmap-scroll { overflow-x: auto; }
    .rsi-hide-mobile { display: none; }
    .section-header { flex-wrap: wrap; gap: 8px; }
    .view-toggle { font-size: 11px; }
    .trade-pct-label { width: 60px; font-size: 10px; }
    .ctrl-btn { padding: 10px 12px; font-size: 13px; }
  }
  @media (max-width: 480px) {
    .ctrl-groups { grid-template-columns: 1fr !important; }
    .pnl-grid { grid-template-columns: 1fr 1fr !important; }
    nav .nav-right { display: none; }
  }
  /* ── Page Tabs ── */
  .tab-strip { background: rgba(18,26,42,0.9); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); padding: 0 24px; display: flex; gap: 0; }
  .tab-btn { padding: 12px 20px; font-size: 13px; font-weight: 600; color: var(--muted); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s; margin-bottom: -1px; }
  .tab-btn:hover { color: var(--text); }
  .tab-btn.active { color: var(--blue); border-bottom-color: var(--blue); text-shadow: 0 0 12px rgba(0,212,255,0.4); }
  /* ── Info Page ── */
  .info-page { max-width: 780px; margin: 0 auto; padding: 32px 24px; display: none; }
  .info-hero { background: linear-gradient(135deg, rgba(0,212,255,0.06), rgba(124,92,255,0.06)); border: 1px solid rgba(0,212,255,0.2); border-radius: 12px; padding: 28px 32px; margin-bottom: 32px; }
  .info-hero h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
  .info-hero p { font-size: 14px; color: var(--muted); line-height: 1.7; }
  .info-section { margin-bottom: 32px; }
  .info-section h2 { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
  .info-step { display: flex; gap: 16px; align-items: flex-start; padding: 14px 0; border-bottom: 1px solid rgba(48,54,61,0.5); }
  .info-step:last-child { border-bottom: none; }
  .info-step-num { width: 32px; height: 32px; border-radius: 50%; background: rgba(88,166,255,0.12); color: var(--blue); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .info-step-body h3 { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .info-step-body p { font-size: 13px; color: var(--muted); line-height: 1.6; }
  .info-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .info-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px 18px; }
  .info-card-icon { font-size: 20px; margin-bottom: 8px; }
  .info-card-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 4px; }
  .info-card-value { font-size: 18px; font-weight: 700; color: var(--text); }
  .info-card-sub { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .info-alert { background: rgba(210,153,34,0.08); border: 1px solid rgba(210,153,34,0.25); border-radius: 8px; padding: 14px 18px; font-size: 13px; color: var(--text); line-height: 1.6; margin-bottom: 24px; }
  .info-alert strong { color: var(--yellow); }
  @media (max-width: 600px) { .info-cards { grid-template-columns: repeat(2,1fr); } }

  .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 12px; }

  .refresh-bar { height: 2px; background: var(--border); border-radius: 1px; margin-bottom: 24px; overflow: hidden; }
  .refresh-progress { height: 100%; background: var(--blue); width: 100%; transition: width 1s linear; }

  /* ── Chart ── */
  .chart-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .chart-card iframe { min-height: 420px; }
  @media (max-width: 768px) {
    .chart-card iframe { min-height: 320px; }
  }
  /* ── Stats ── */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; }
  .stat-label { font-size: 12px; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-value { font-size: 28px; font-weight: 700; line-height: 1; }
  .stat-sub { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .green { color: var(--green); } .red { color: var(--red); }
  .blue  { color: var(--blue);  } .yellow { color: var(--yellow); }

  /* ── Mid row ── */
  .mid-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
  .card-title { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }

  .indicator-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .indicator-row:last-child { border-bottom: none; }
  .ind-label { color: var(--muted); }
  .ind-value { font-weight: 600; font-size: 15px; }
  .bias-bullish { color: var(--green); } .bias-bearish { color: var(--red); } .bias-neutral { color: var(--yellow); }

  .condition { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .condition:last-child { border-bottom: none; }
  .cond-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .cond-text { flex: 1; }
  .cond-label { font-size: 13px; }
  .cond-detail { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .cond-pass .cond-label { color: var(--green); }
  .cond-fail .cond-label { color: var(--red); }
  .empty-state { color: var(--muted); font-size: 13px; text-align: center; padding: 20px 0; }

  .decision-banner { border-radius: 6px; padding: 10px 14px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
  .decision-pass { background: rgba(63,185,80,0.1); color: var(--green); border: 1px solid rgba(63,185,80,0.2); }
  .decision-fail { background: rgba(248,81,73,0.1); color: var(--red);   border: 1px solid rgba(248,81,73,0.2); }

  /* ── Table ── */
  .table-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
  .table-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); }
  td { padding: 10px 16px; border-bottom: 1px solid rgba(48,54,61,0.5); font-size: 13px; white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  .mode-paper   { color: var(--yellow); font-weight: 600; }
  .mode-live    { color: var(--green);  font-weight: 600; }
  .mode-blocked { color: var(--red);    font-weight: 600; }
  .empty-row td { text-align: center; color: var(--muted); padding: 32px; }

  .footer { text-align: center; color: var(--muted); font-size: 12px; padding-bottom: 32px; }

  /* ── Balance ── */
  .balance-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
  .balance-assets { display: flex; flex-wrap: wrap; gap: 0; align-items: stretch; }
  .balance-asset { padding: 4px 24px 4px 0; margin-right: 24px; border-right: 1px solid var(--border); }
  .balance-asset:last-child { border-right: none; margin-right: 0; padding-right: 0; }
  .balance-asset-name { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 4px; }
  .balance-asset-amount { font-size: 22px; font-weight: 700; }
  .balance-asset-usd { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .balance-total { padding: 4px 0 4px 24px; margin-left: 24px; border-left: 2px solid var(--border); }
  .balance-total-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 4px; }
  .balance-total-value { font-size: 26px; font-weight: 700; color: var(--green); }
  .balance-updated { font-size: 11px; color: var(--muted); white-space: nowrap; }

  /* ── Bot Mode Presets ── */
  .bot-modes { background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
  .bot-modes-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 10px; }
  .bot-modes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .bot-mode-btn { padding: 10px 12px; border-radius: 8px; background: var(--bg); border: 1px solid var(--border); cursor: pointer; transition: all 0.15s; text-align: center; font-family: inherit; }
  .bot-mode-btn:hover { border-color: rgba(0,212,255,0.4); transform: translateY(-1px); }
  .bot-mode-btn.active { border-color: rgba(0,212,255,0.5); background: rgba(0,212,255,0.06); box-shadow: 0 0 12px rgba(0,212,255,0.1); }
  .mode-icon { font-size: 18px; margin-bottom: 4px; }
  .mode-name { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 3px; }
  .mode-detail { font-size: 10px; color: var(--muted); line-height: 1.3; }
  @media (max-width: 600px) { .bot-modes-grid { grid-template-columns: 1fr; } }

  /* ── Trading Terminal ── */
  .trade-terminal { background:var(--card); border:1px solid var(--border); border-radius:10px; overflow:hidden; margin-bottom:24px; }
  .trade-terminal-header { padding:14px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }
  .trade-terminal-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted); }
  .trade-terminal-mode { font-size:11px; font-weight:700; }
  .trade-cmd-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0; }
  .trade-cmd-col { padding:16px 18px; border-right:1px solid var(--border); }
  .trade-cmd-col:last-child { border-right:none; }
  .trade-cmd-col-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); margin-bottom:10px; }
  .trade-cmd-btn { width:100%; padding:9px 14px; font-size:12px; font-weight:700; border-radius:6px; border:1px solid; background:transparent; cursor:pointer; margin-bottom:6px; text-align:left; transition:all 0.15s; }
  .trade-cmd-btn:last-child { margin-bottom:0; }
  .trade-btn-buy  { border-color:rgba(63,185,80,0.4);  color:var(--green);  }
  .trade-btn-buy:hover  { background:rgba(63,185,80,0.1); }
  .trade-btn-sell { border-color:rgba(248,81,73,0.4);  color:var(--red);    }
  .trade-btn-sell:hover { background:rgba(248,81,73,0.1); }
  .trade-btn-set  { border-color:rgba(88,166,255,0.4); color:var(--blue);   }
  .trade-btn-set:hover  { background:rgba(88,166,255,0.1); }
  .trade-pct-row { display:flex; gap:6px; align-items:center; margin-bottom:6px; }
  .trade-pct-label { font-size:11px; color:var(--muted); width:80px; flex-shrink:0; }
  .trade-pct-input { flex:1; background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); font-size:12px; font-weight:600; padding:6px 8px; outline:none; }
  .trade-pct-input:focus { border-color:var(--blue); }
  .trade-log { padding:12px 18px; border-top:1px solid var(--border); background:rgba(0,0,0,0.2); min-height:40px; max-height:80px; overflow-y:auto; }
  .trade-log-entry { font-size:12px; color:var(--muted); font-family:monospace; margin-bottom:2px; }
  .trade-log-ok  { color:var(--green); }
  .trade-log-err { color:var(--red); }
  @media(max-width:700px) { .trade-cmd-grid { grid-template-columns:1fr; } .trade-cmd-col { border-right:none; border-bottom:1px solid var(--border); } .trade-cmd-col:last-child { border-bottom:none; } }

  /* ── Agent Avila Chatbox ── */
  .chat-bubble { position:fixed; bottom:24px; right:24px; z-index:500; }
  .chat-toggle-btn { width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--purple)); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:0 4px 20px rgba(0,212,255,0.4); transition:transform 0.2s,box-shadow 0.2s; }
  .chat-toggle-btn:hover { transform:scale(1.08); box-shadow:0 6px 28px rgba(0,212,255,0.6); }
  .chat-unread { position:absolute; top:-4px; right:-4px; width:18px; height:18px; border-radius:50%; background:var(--red); color:#fff; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; }
  .chat-panel { position:fixed; bottom:92px; right:24px; width:380px; max-height:560px; background:rgba(18,26,42,0.97); backdrop-filter:blur(24px); border:1px solid rgba(0,212,255,0.2); border-radius:16px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 30px rgba(0,212,255,0.08); z-index:499; transform:scale(0.95) translateY(10px); opacity:0; pointer-events:none; transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
  .chat-panel.open { transform:scale(1) translateY(0); opacity:1; pointer-events:all; }
  .chat-header { padding:14px 16px; border-bottom:1px solid rgba(0,212,255,0.12); display:flex; align-items:center; gap:10px; }
  .chat-header-icon { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--purple)); display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
  .chat-header-title { font-size:13px; font-weight:700; color:var(--text); }
  .chat-header-sub { font-size:11px; color:var(--muted); }
  .chat-close { margin-left:auto; background:none; border:none; color:var(--muted); cursor:pointer; font-size:18px; padding:2px 6px; border-radius:4px; }
  .chat-close:hover { color:var(--text); background:rgba(255,255,255,0.06); }
  .chat-messages { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:10px; min-height:200px; }
  .chat-msg { max-width:90%; padding:10px 13px; border-radius:12px; font-size:13px; line-height:1.55; }
  .chat-msg-user { background:linear-gradient(135deg,rgba(0,212,255,0.2),rgba(124,92,255,0.2)); border:1px solid rgba(0,212,255,0.2); color:var(--text); align-self:flex-end; border-bottom-right-radius:4px; }
  .chat-msg-bot  { background:rgba(255,255,255,0.04); border:1px solid var(--border); color:var(--text); align-self:flex-start; border-bottom-left-radius:4px; }
  .chat-msg-executed { background:rgba(0,255,154,0.06); border:1px solid rgba(0,255,154,0.2); color:var(--green); align-self:flex-start; font-size:11px; font-weight:600; padding:6px 10px; border-radius:8px; }
  .chat-msg-confirm  { background:rgba(255,181,71,0.08); border:1px solid rgba(255,181,71,0.25); color:var(--yellow); align-self:flex-start; font-size:12px; border-radius:8px; padding:8px 12px; }
  .chat-confirm-btns { display:flex; gap:8px; margin-top:8px; }
  .chat-confirm-yes { background:rgba(0,255,154,0.15); border:1px solid rgba(0,255,154,0.3); color:var(--green); padding:5px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700; }
  .chat-confirm-no  { background:rgba(255,77,106,0.1);  border:1px solid rgba(255,77,106,0.3); color:var(--red);   padding:5px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700; }
  .chat-typing { align-self:flex-start; color:var(--muted); font-size:12px; padding:8px 12px; font-style:italic; }
  .chat-input-wrap { padding:10px 12px; border-top:1px solid rgba(0,212,255,0.1); display:flex; gap:8px; }
  .chat-input { flex:1; background:rgba(0,0,0,0.3); border:1px solid var(--border); border-radius:10px; color:var(--text); font-size:13px; padding:9px 13px; outline:none; resize:none; max-height:80px; font-family:inherit; }
  .chat-input:focus { border-color:rgba(0,212,255,0.4); }
  .chat-send-btn { background:linear-gradient(135deg,var(--blue),var(--purple)); border:none; border-radius:10px; color:#fff; padding:9px 14px; cursor:pointer; font-size:14px; transition:opacity 0.15s; flex-shrink:0; }
  .chat-send-btn:hover { opacity:0.85; }
  .chat-suggestions { display:flex; gap:6px; padding:0 12px 8px; flex-wrap:wrap; }
  .chat-suggest-btn { background:rgba(0,212,255,0.08); border:1px solid rgba(0,212,255,0.2); color:var(--blue); font-size:11px; padding:4px 10px; border-radius:20px; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
  .chat-suggest-btn:hover { background:rgba(0,212,255,0.15); }
  @media(max-width:768px) {
    .chat-panel { bottom:0; right:0; left:0; width:100%; max-height:85vh; border-radius:20px 20px 0 0; border-bottom:none; }
    .chat-bubble { bottom:12px; right:12px; transform:scale(0.92); }
  }

  /* ── Active Strategies ── */
  .strategy-row { padding:14px 16px; border:1px solid var(--border); border-radius:8px; transition:all 0.2s; }
  .strategy-row.strategy-active   { border-color:rgba(0,255,154,0.3); background:rgba(0,255,154,0.04); box-shadow:0 0 12px rgba(0,255,154,0.06); }
  .strategy-row.strategy-inactive { opacity:0.55; background:rgba(255,255,255,0.02); }
  .strategy-row.strategy-inactive:hover { opacity:0.85; }
  .strategy-status { font-size:10px; font-weight:800; letter-spacing:1px; margin-bottom:6px; }
  .strategy-active   .strategy-status { color:var(--green); }
  .strategy-inactive .strategy-status { color:var(--muted); }
  .strategy-name { font-size:14px; font-weight:700; color:var(--text); margin-bottom:4px; }
  .strategy-desc { font-size:12px; color:var(--muted); line-height:1.5; }

  /* ── Portfolio Intelligence ── */
  .portfolio-panel { background:var(--glass-bg); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-bottom:24px; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  .portfolio-header-bar { display:flex; align-items:center; justify-content:space-between; padding-bottom:14px; margin-bottom:14px; border-bottom:1px solid var(--border); gap:20px; flex-wrap:wrap; }
  .portfolio-hero-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; font-weight:600; margin-bottom:4px; }
  .portfolio-hero-value { font-size:26px; font-weight:900; font-variant-numeric:tabular-nums; transition:color 0.4s ease; line-height:1; }
  .portfolio-hero-change { font-size:14px; font-weight:700; }
  @media(max-width:600px) { .portfolio-header-bar { flex-direction:column; align-items:flex-start; gap:12px; } .portfolio-header-bar > div:last-child { text-align:left !important; width:100%; } }
  .portfolio-top { display:grid; grid-template-columns:auto 1fr; gap:24px; align-items:start; margin-bottom:16px; }
  .portfolio-score-ring { display:flex; flex-direction:column; align-items:center; justify-content:center; width:100px; height:100px; border-radius:50%; border:4px solid var(--blue); box-shadow:0 0 20px var(--glow-blue); }
  .portfolio-score-num { font-size:28px; font-weight:900; color:var(--blue); line-height:1; }
  .portfolio-score-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-top:2px; }
  .portfolio-metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  .pm-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
  .pm-value { font-size:16px; font-weight:700; }
  .pm-sub   { font-size:11px; color:var(--muted); margin-top:2px; }
  .alloc-bar-wrap { margin-top:14px; }
  .alloc-bar-labels { display:flex; justify-content:space-between; font-size:11px; margin-bottom:5px; }
  .alloc-bar-track { height:10px; background:rgba(255,255,255,0.06); border-radius:5px; overflow:hidden; display:flex; }
  .alloc-usd  { background:linear-gradient(90deg,var(--blue),#00A3C4); transition:width 0.5s; }
  .alloc-xrp  { background:linear-gradient(90deg,var(--purple),#5A3FCC); transition:width 0.5s; }
  .alloc-risk { background:rgba(255,77,106,0.6); transition:width 0.5s; }
  @media(max-width:768px) { .portfolio-top { grid-template-columns:1fr; } .portfolio-metrics { grid-template-columns:repeat(2,1fr); } }

  /* ── Capital Router ── */
  .capital-panel { background:var(--glass-bg); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-bottom:24px; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  .capital-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .capital-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted); }
  .capital-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
  .capital-item-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
  .capital-item-value { font-size:18px; font-weight:700; }
  .capital-item-sub   { font-size:11px; color:var(--muted); margin-top:3px; }
  .capital-bar-wrap { margin-bottom:14px; }
  .capital-bar-labels { display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-bottom:4px; }
  .capital-bar-track { height:8px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden; display:flex; }
  .capital-bar-active  { background:linear-gradient(90deg,var(--blue),var(--purple)); border-radius:4px 0 0 4px; transition:width 0.5s; }
  .capital-bar-reserve { background:rgba(139,148,158,0.3); border-radius:0 4px 4px 0; }
  .capital-controls { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .capital-role-btn { padding:5px 12px; font-size:11px; font-weight:700; border-radius:4px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; transition:all 0.15s; }
  .capital-role-btn.active-role { background:rgba(0,212,255,0.12); color:var(--blue); border-color:rgba(0,212,255,0.3); }
  .capital-role-btn:hover { border-color:var(--blue); color:var(--blue); }
  .capital-danger { border-color:rgba(255,77,106,0.3) !important; color:var(--red) !important; }
  @media(max-width:768px) { .capital-grid { grid-template-columns:repeat(2,1fr); } }

  /* ── Performance Panel (3.0) ── */
  .perf-panel { background:var(--glass-bg); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-bottom:24px; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  .perf-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
  .perf-item-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
  .perf-item-value { font-size:20px; font-weight:700; }
  .perf-item-sub   { font-size:11px; color:var(--muted); margin-top:3px; }
  .perf-adaptations { display:flex; gap:8px; flex-wrap:wrap; padding:10px 14px; background:rgba(0,0,0,0.2); border-radius:6px; }
  .perf-adapt-badge { font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; }
  .adapt-default { background:rgba(139,148,158,0.1); color:var(--muted); border:1px solid var(--border); }
  .adapt-warn    { background:rgba(255,181,71,0.12);  color:var(--yellow); border:1px solid rgba(255,181,71,0.3); }
  .adapt-danger  { background:rgba(255,77,106,0.12);  color:var(--red);    border:1px solid rgba(255,77,106,0.3); }
  .adapt-good    { background:rgba(0,255,154,0.1);    color:var(--green);  border:1px solid rgba(0,255,154,0.3); }
  /* Decision log */
  .decision-log-box { background:rgba(0,0,0,0.3); border:1px solid var(--border); border-radius:6px; padding:12px 14px; font-family:monospace; font-size:12px; color:var(--muted); line-height:1.8; margin-top:12px; }
  .decision-log-box .dl-trade { color:var(--green); font-weight:700; }
  .decision-log-box .dl-skip  { color:var(--red);   font-weight:700; }
  @media(max-width:768px) { .perf-grid { grid-template-columns:repeat(2,1fr); } }

  /* ── Bot Controls ── */
  .ctrl-panel { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-bottom:24px; }
  .ctrl-panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
  .ctrl-panel-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted); }
  .ctrl-status-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
  .ctrl-badge { font-size:11px; font-weight:700; border-radius:4px; padding:3px 10px; border:1px solid; }
  .ctrl-badge-green  { background:rgba(63,185,80,0.12);  color:var(--green);  border-color:rgba(63,185,80,0.3); }
  .ctrl-badge-red    { background:rgba(248,81,73,0.12);  color:var(--red);    border-color:rgba(248,81,73,0.3); }
  .ctrl-badge-yellow { background:rgba(210,153,34,0.12); color:var(--yellow); border-color:rgba(210,153,34,0.3); }
  .ctrl-badge-muted  { background:rgba(139,148,158,0.1); color:var(--muted);  border-color:var(--border); }
  .ctrl-badge-blue   { background:rgba(88,166,255,0.12); color:var(--blue);   border-color:rgba(88,166,255,0.3); }
  .ctrl-groups { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
  .ctrl-group-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); margin-bottom:8px; }
  .ctrl-btns { display:flex; flex-direction:column; gap:6px; }
  .ctrl-btn { padding:8px 14px; font-size:12px; font-weight:600; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--text); cursor:pointer; text-align:left; transition:all 0.15s; }
  .ctrl-btn:hover { border-color:var(--blue); color:var(--blue); }
  .ctrl-btn-danger:hover  { border-color:var(--red);    color:var(--red); }
  .ctrl-btn-success:hover { border-color:var(--green);  color:var(--green); }
  .ctrl-btn-warn:hover    { border-color:var(--yellow); color:var(--yellow); }
  /* Active-state highlights for current settings */
  .ctrl-btn.is-active-green  { background:rgba(0,255,154,0.12); border-color:rgba(0,255,154,0.5); color:var(--green); box-shadow:0 0 12px rgba(0,255,154,0.15); }
  .ctrl-btn.is-active-red    { background:rgba(255,77,106,0.12); border-color:rgba(255,77,106,0.5); color:var(--red);   box-shadow:0 0 12px rgba(255,77,106,0.15); }
  .ctrl-btn.is-active-yellow { background:rgba(255,181,71,0.12); border-color:rgba(255,181,71,0.5); color:var(--yellow); box-shadow:0 0 12px rgba(255,181,71,0.15); }
  .ctrl-btn.is-active-blue   { background:rgba(0,212,255,0.12);  border-color:rgba(0,212,255,0.5); color:var(--blue);   box-shadow:0 0 12px rgba(0,212,255,0.15); }
  .ctrl-btn.is-active-green::after,
  .ctrl-btn.is-active-red::after,
  .ctrl-btn.is-active-yellow::after,
  .ctrl-btn.is-active-blue::after { content:" ✓ active"; font-size:10px; font-weight:700; opacity:0.8; margin-left:4px; }
  .ctrl-input-row { display:flex; gap:6px; align-items:center; }
  .ctrl-input { width:88px; background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); font-size:13px; font-weight:600; padding:7px 10px; outline:none; transition:all 0.15s; }
  .ctrl-input::placeholder { color:rgba(139,148,158,0.5); font-weight:500; font-size:11px; }
  .ctrl-input:focus { border-color:var(--blue); box-shadow:0 0 0 3px rgba(0,212,255,0.15); }
  .ctrl-input:invalid { border-color:rgba(255,77,106,0.4); }
  .trade-pct-input::placeholder { color:rgba(139,148,158,0.5); font-weight:500; font-size:11px; }
  .trade-pct-input:focus { border-color:var(--blue); box-shadow:0 0 0 3px rgba(0,212,255,0.15); }
  .trade-pct-input:invalid { border-color:rgba(255,77,106,0.4); }
  @media(max-width:700px) { .ctrl-groups { grid-template-columns:1fr 1fr; } }

  /* ── Open Position Card ── */
  .position-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px; }
  .position-card.pos-open { border-color: rgba(88,166,255,0.4); background: rgba(88,166,255,0.04); }
  .position-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .position-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted); }
  .position-badge-open   { font-size:11px; font-weight:700; background:rgba(88,166,255,0.15); color:var(--blue); border:1px solid rgba(88,166,255,0.3); border-radius:4px; padding:2px 8px; }
  .position-badge-closed { font-size:11px; font-weight:700; background:rgba(139,148,158,0.1); color:var(--muted); border:1px solid var(--border); border-radius:4px; padding:2px 8px; }
  .position-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:16px; }
  .position-item-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px; }
  .position-item-value { font-size:18px; font-weight:700; }
  .position-item-sub   { font-size:11px; color:var(--muted); margin-top:3px; }
  .position-bar-wrap { margin-top:4px; }
  .position-bar-label { display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-bottom:5px; }
  .position-bar-track { height:6px; background:var(--border); border-radius:3px; position:relative; overflow:visible; }
  .position-bar-fill  { height:100%; border-radius:3px; transition:width 0.4s; }
  .position-bar-marker { position:absolute; top:-3px; width:2px; height:12px; background:var(--text); border-radius:1px; }
  .position-no-trade { color:var(--muted); font-size:13px; text-align:center; padding:12px 0; }
  @media (max-width:700px) { .position-grid { grid-template-columns:repeat(2,1fr); } }

  /* ── Paper Portfolio Wallet ── */
  .paper-wallet { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px; }
  .paper-wallet-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
  .paper-wallet-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted); }
  .paper-wallet-badge { font-size:11px; font-weight:700; background:rgba(210,153,34,0.15); color:var(--yellow); border:1px solid rgba(210,153,34,0.3); border-radius:4px; padding:2px 8px; }
  .paper-wallet-row { display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-bottom:16px; }
  .paper-wallet-item {}
  .paper-wallet-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px; }
  .paper-wallet-value { font-size:20px; font-weight:700; }
  .paper-wallet-sub { font-size:11px; color:var(--muted); margin-top:3px; }
  .paper-wallet-divider { border:none; border-top:1px solid var(--border); margin:14px 0; }
  .paper-wallet-footer { display:flex; align-items:center; justify-content:space-between; }
  .paper-wallet-total-label { font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
  .paper-wallet-total-value { font-size:26px; font-weight:700; }
  .paper-wallet-pnl { font-size:13px; font-weight:600; }
  @media (max-width: 700px) { .paper-wallet-row { grid-template-columns: repeat(2,1fr); } }

  /* ── P&L ── */
  .pnl-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
  .pnl-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; }
  .pnl-label { font-size: 12px; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .pnl-value { font-size: 24px; font-weight: 700; line-height: 1; }
  .pnl-sub   { font-size: 12px; color: var(--muted); margin-top: 5px; }
  .pnl-pos { color: var(--green); } .pnl-neg { color: var(--red); } .pnl-zero { color: var(--muted); }
  @media (max-width: 900px) { .pnl-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 600px) { .pnl-grid { grid-template-columns: repeat(2, 1fr); } }

  @media (max-width: 768px) {
    .stats-grid  { grid-template-columns: repeat(2, 1fr); }
    .pnl-grid    { grid-template-columns: repeat(2, 1fr); }
    .mid-grid    { grid-template-columns: 1fr; }
    nav { padding: 0 14px; }
    main { padding: 14px; }
    .health-strip { padding: 6px 14px; gap: 14px; }
    .balance-card { flex-direction: column; align-items: flex-start; }
    .balance-total { border-left: none; border-top: 1px solid var(--border); padding: 8px 0 0; margin: 8px 0 0; }
    .stat-value { font-size: 22px; }
    .pnl-value  { font-size: 20px; }
    table { font-size: 12px; }
    th, td { padding: 8px 10px; }
  }

  /* ── Compact Trader Bar ── */
  .health-strip {
    background: rgba(18,26,42,0.85); backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    padding: 8px 24px; display: flex; align-items: center; gap: 20px;
    font-size: 12px; color: var(--muted); flex-wrap: wrap;
  }
  .health-item { display: flex; align-items: center; gap: 6px; }
  .h-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .h-dot-green  { background: var(--green); box-shadow: 0 0 5px var(--green); }
  .h-dot-yellow { background: var(--yellow); }
  .h-dot-red    { background: var(--red); animation: pulse 1.5s infinite; }
  .countdown-val { font-weight: 700; color: var(--blue); }
  /* Live status items */
  .live-status-item { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; }
  .regime-trending { background:rgba(0,212,255,0.1); color:var(--blue); border:1px solid rgba(0,212,255,0.2); }
  .regime-range    { background:rgba(255,181,71,0.1); color:var(--yellow); border:1px solid rgba(255,181,71,0.2); }
  .regime-volatile { background:rgba(255,77,106,0.1); color:var(--red);    border:1px solid rgba(255,77,106,0.2); }
  .confidence-bar-wrap { display:flex; align-items:center; gap:6px; }
  .confidence-bar { height:4px; width:60px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden; }
  .confidence-bar-fill { height:100%; border-radius:2px; transition:width 0.5s; }
  /* RSI section toggle */
  .section-collapsible { cursor:pointer; user-select:none; }
  .section-collapsible:hover { color:var(--text); }
  .collapse-icon { font-size:10px; margin-left:4px; transition:transform 0.2s; }
  .collapsed .collapse-icon { transform:rotate(-90deg); }

  /* ── RSI History ── */
  .rsi-history-wrap { display: flex; align-items: flex-end; gap: 5px; height: 90px; position: relative; }
  .rsi-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; height: 100%; justify-content: flex-end; min-width: 24px; }
  .rsi-bar { width: 100%; border-radius: 3px 3px 0 0; min-height: 3px; transition: height 0.3s; }
  .rsi-bar-val { font-size: 9px; color: var(--muted); }
  .rsi-threshold { position: absolute; left: 0; right: 0; border-top: 1px dashed rgba(248,81,73,0.5); pointer-events: none; }
  .rsi-legend { display: flex; gap: 16px; font-size: 11px; color: var(--muted); margin-top: 10px; }
  .rsi-legend-item { display: flex; align-items: center; gap: 5px; }
  .rsi-legend-dot { width: 8px; height: 8px; border-radius: 2px; }

  /* ── Heatmap ── */
  .heatmap-scroll { overflow-x: auto; }
  .heatmap-table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 400px; }
  .heatmap-table th { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); padding: 8px 10px; text-align: center; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .heatmap-table th:first-child { text-align: left; }
  .heatmap-table td { padding: 6px 10px; border-bottom: 1px solid rgba(48,54,61,0.4); text-align: center; }
  .heatmap-table td:first-child { text-align: left; }
  .heatmap-table tr:last-child td { border-bottom: none; }
  .hm-cell { width: 22px; height: 22px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
  .hm-pass { background: rgba(63,185,80,0.2);  color: var(--green); }
  .hm-fail { background: rgba(248,81,73,0.15); color: var(--red); }
  .hm-na   { background: rgba(139,148,158,0.1); color: var(--muted); }
  .hm-time { color: var(--muted); font-size: 11px; white-space: nowrap; }
  .hm-result-pass { color: var(--green); font-weight: 700; font-size: 11px; }
  .hm-result-fail { color: var(--red);   font-weight: 700; font-size: 11px; }

  /* ── Bot Reasoning ── */
  .reasoning-summary {
    font-size: 14px; line-height: 1.65; color: var(--text);
    padding: 14px 16px;
    background: rgba(88,166,255,0.05);
    border: 1px solid rgba(88,166,255,0.15);
    border-radius: 6px;
    margin-bottom: 16px;
  }
  .reasoning-summary strong { color: var(--blue); }
  .run-item { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .run-item:last-child { border-bottom: none; }
  .run-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
  .run-dot-blocked { background: var(--red); }
  .run-dot-traded  { background: var(--green); }
  .run-dot-neutral { background: var(--yellow); }
  .run-time   { font-size: 12px; color: var(--muted); margin-bottom: 3px; }
  .run-reason { font-size: 13px; color: var(--text); }

  /* ── View Toggle ── */
  .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .section-header .section-title { margin-bottom:0; }
  .view-toggle { display:flex; border:1px solid var(--border); border-radius:6px; overflow:hidden; }
  .view-toggle-btn { padding:5px 14px; font-size:12px; font-weight:600; border:none; background:transparent; color:var(--muted); cursor:pointer; transition:all 0.15s; }
  .view-toggle-btn.active { background:var(--blue); color:#fff; }
  /* Confidence dots */
  .conf-dot { display:inline-block; width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-top:5px; }
  .conf-high { background:#3fb950; }
  .conf-med  { background:#d29922; }
  .conf-low  { background:#f85149; }
  /* Simple view items */
  .run-item-simple { display:flex; gap:12px; align-items:flex-start; padding:12px 0; border-bottom:1px solid var(--border); }
  .run-item-simple:last-child { border-bottom:none; }
  .run-simple-body { flex:1; min-width:0; }
  .run-simple-label { font-size:13px; font-weight:700; color:var(--text); margin-bottom:3px; }
  .run-simple-reason { font-size:13px; color:var(--muted); line-height:1.5; }
  .run-simple-time { font-size:11px; color:var(--muted); margin-top:4px; }
  /* Grouped items */
  .run-group-item { display:flex; gap:12px; align-items:flex-start; padding:10px 0; border-bottom:1px solid var(--border); }
  .run-group-item:last-child { border-bottom:none; }
  .run-group-body { flex:1; min-width:0; }
  .run-group-label { font-size:13px; font-weight:700; color:var(--text); margin-bottom:3px; }
  .run-group-detail { font-size:12px; color:var(--muted); line-height:1.5; }
  .run-group-badge { font-size:11px; font-weight:700; background:rgba(248,81,73,0.12); color:var(--red); border-radius:4px; padding:1px 7px; margin-left:6px; vertical-align:middle; }
</style>
</head>
<body>

<!-- Toast Container -->
<div class="toast-container" id="toast-container"></div>

<!-- Confirm Modal -->
<div class="modal-overlay" id="modal-overlay">
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-icon" id="modal-icon">⚠</div>
    <div class="modal-title" id="modal-title">Confirm action</div>
    <div class="modal-msg" id="modal-msg">Are you sure?</div>
    <input class="modal-input" id="modal-input" placeholder="Type CONFIRM" style="display:none">
    <div class="modal-actions">
      <button class="modal-btn modal-btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="modal-btn modal-btn-confirm" id="modal-confirm-btn" onclick="confirmModalAction()">Confirm</button>
    </div>
  </div>
</div>

<!-- Nav Drawer Overlay -->
<div class="nav-drawer-overlay" id="nav-overlay" onclick="closeNav()"></div>

<!-- Nav Drawer -->
<div class="nav-drawer" id="nav-drawer" role="navigation" aria-label="Main menu" aria-hidden="true">
  <div class="nav-drawer-header">
    <div class="nav-drawer-logo">⚡ Agent Avila</div>
    <div class="nav-drawer-sub">Adaptive Quant System · v3.0</div>
  </div>
  <div class="nav-drawer-items">
    <div class="nav-section-label">Overview</div>
    <a class="nav-item active" tabindex="0" role="button" onclick="navTo('section-portfolio')"><span class="nav-item-icon">🧠</span>Portfolio Intelligence</a>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-capital')"><span class="nav-item-icon">💰</span>Capital Router</a>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-health')"><span class="nav-item-icon">🩺</span>System Health</a>
    <div class="nav-section-label">Trading</div>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-position')"><span class="nav-item-icon">📈</span>Open Position</a>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-terminal')"><span class="nav-item-icon">⚡</span>Trading Terminal</a>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-chart')"><span class="nav-item-icon">📊</span>Live Chart</a>
    <div class="nav-section-label">Performance</div>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-strategies')"><span class="nav-item-icon">🎯</span>Active Strategies</a>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-performance')"><span class="nav-item-icon">📉</span>Performance State</a>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-paper')"><span class="nav-item-icon">🏦</span>Paper Wallet Snapshot</a>
    <div class="nav-section-label">History & Controls</div>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-history')"><span class="nav-item-icon">📜</span>Trade History</a>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-controls')"><span class="nav-item-icon">🎛</span>Lifecycle Controls</a>
    <a class="nav-item" tabindex="0" role="button" onclick="navTo('section-risk')"><span class="nav-item-icon">🛑</span>Risk Controls</a>
  </div>
  <div class="nav-drawer-footer">
    <span style="font-size:11px;color:var(--muted)"><span class="nav-health-dot" id="nav-drawer-health-dot" style="background:var(--green)"></span>System operational</span>
  </div>
</div>

<nav>
  <div class="nav-left">
    <button class="hamburger" onclick="toggleNav()" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <span class="nav-title">Agent Avila</span>
    <span class="badge badge-symbol" id="nav-symbol">—</span>
  </div>
  <div class="nav-right">
    <span id="last-updated">Loading...</span>
    <span class="dot"></span>
    <span style="color:var(--green);font-size:12px;font-weight:600">LIVE</span>
    <button id="nav-kill-btn" class="nav-kill-btn" type="button" onclick="confirmEmergencyKill()" title="Trigger kill switch — bot stops trading until reset" aria-label="Emergency Kill">🚨 Emergency Kill</button>
    <a href="/logout" style="color:var(--muted);font-size:12px;text-decoration:none;margin-left:8px;padding:4px 10px;border:1px solid var(--border);border-radius:6px" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">Sign out</a>
  </div>
</nav>

<div class="tab-strip">
  <button class="tab-btn active" id="tab-dashboard" onclick="switchTab('dashboard')">📊 Dashboard</button>
  <button class="tab-btn" id="tab-info" onclick="switchTab('info')">⚡ Agent 3.0</button>
</div>

<!-- Info Page -->
<div class="info-page" id="info-page">
  <div class="info-hero">
    <h1 style="background:linear-gradient(90deg,#00D4FF,#7C5CFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">⚡ Agent Avila — System Evolution Log</h1>
    <p>Agent Avila is a <strong style="color:var(--text)">deterministic, rule-based trading engine with adaptive parameters</strong> driven by measurable performance metrics. Not AI — a statistical adaptive execution engine that changes behavior based on win rate, drawdown, market regime, and volatility.</p>
  </div>

  <div class="info-section">
    <h2>📋 Version History</h2>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="info-card" style="border-color:rgba(139,148,158,0.2)">
        <div class="info-card-label" style="color:var(--muted)">Agent 1.0 — Entry Bot (initial)</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-top:6px">4-condition hard lock · Fixed $8.50 size · No exit logic · No leverage · No mobile support</div>
      </div>
      <div class="info-card" style="border-color:rgba(0,212,255,0.15)">
        <div class="info-card-label" style="color:var(--blue)">Agent 1.1 — Full Trading System</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-top:6px">Exit strategy (SL/TP) · Leverage 2x with volatility guard · Liquidation protection · Simple/Advanced toggle · Paper portfolio tracking</div>
      </div>
      <div class="info-card" style="border-color:rgba(124,92,255,0.2)">
        <div class="info-card-label" style="color:var(--purple)">Agent 2.0 — Leverage Risk Engine</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-top:6px">Score ≥75/100 entry system · Dynamic position sizing · Adaptive SL/TP by volatility · Breakeven +trail stop · Re-entry logic · Dark Pro theme · Mobile layout</div>
      </div>
      <div class="info-card" style="border-color:rgba(0,255,154,0.2)">
        <div class="info-card-label" style="color:var(--green)">Agent 3.0 — Adaptive Quant System</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-top:6px">Performance feedback loop · EMA slope regime detection · Adaptive entry threshold (70–85) · Timed pauses · Capital Router (70/30) · Portfolio Intelligence panel · Decision logger</div>
      </div>
      <div class="info-card" style="border-color:rgba(0,212,255,0.3);box-shadow:0 0 15px rgba(0,212,255,0.08)">
        <div class="info-card-label" style="color:var(--blue)">⚡ Agent Avila (Current) — Full Trading Platform</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-top:6px">Hero Live Ticker · Portfolio Intelligence · Capital Router · Trading Terminal · Bot Controls · Chat Assistant · System Health Monitor · Nav drawer · Live Railway deployment · Engagement animations</div>
      </div>
    </div>
  </div>

  <div class="info-section">
    <h2>🎛 What's On Your Dashboard</h2>
    <div class="info-step">
      <div class="info-step-num">⚡</div>
      <div class="info-step-body">
        <h3>Hero Live Ticker (top of page)</h3>
        <p>Big animated XRP price with up/down arrows that bounce on each tick. Shows session P&L %, 24h price range, and a pulsing LIVE indicator. Updates sub-second from Kraken WebSocket — no polling.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🩺</div>
      <div class="info-step-body">
        <h3>System Health Monitor</h3>
        <p>4-card status grid: Kraken API (online + latency), WebSocket Feed (connected/reconnecting), Data Freshness (minutes since last bot run), and Bot Engine (running/stale). Auto-checks every 30 seconds.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🧠</div>
      <div class="info-step-body">
        <h3>Portfolio Intelligence Panel</h3>
        <p>Glowing health ring (0–100 composite score) with system status. Shows Open Risk %, Unrealized P&L, Realized P&L, Efficiency Score, Total Balance, Drawdown. Allocation bar shows USD/XRP/at-risk split.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">💰</div>
      <div class="info-step-body">
        <h3>Capital Router</h3>
        <p>Enforces 70/30 active/reserve capital split. XRP is locked to HOLD_ASSET — never traded. Auto-conversion is OFF by default. Three role buttons (HOLD/ACTIVE/AGGRESSIVE) with confirmation gate on the dangerous one.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">📊</div>
      <div class="info-step-body">
        <h3>Performance State Panel</h3>
        <p>Live win rate, profit factor, R-ratio, drawdown — all color-coded. Adaptation badges show what the bot is doing right now: tightening on losses, loosening on wins, locking leverage on streaks.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🎛</div>
      <div class="info-step-body">
        <h3>Bot Controls + Trading Terminal</h3>
        <p>Bot Controls = software-side commands (START/STOP, PAUSE/RESUME, set risk %, set leverage, mode toggle). Trading Terminal = manual market actions (BUY MARKET, OPEN LONG, CLOSE POSITION, SELL ALL, manually set SL/TP). Live mode requires typed CONFIRM.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">📈</div>
      <div class="info-step-body">
        <h3>Open Position Card (with glow)</h3>
        <p>Entry price, current price, live P&L, time in trade, risk $ if stopped. Visual progress bar between SL ←→ TP with entry marker. Card glows green when profitable, red when underwater, blue when neutral.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">⚡</div>
      <div class="info-step-body">
        <h3>Chat Assistant (bottom right ⚡ bubble)</h3>
        <p>Powered by Claude. Asks questions about your bot, explains decisions, runs commands. Try: "Why did the bot skip?" "What's my exposure?" "Reduce risk to 0.5%". Safe commands auto-execute; live trades require confirmation.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">📜</div>
      <div class="info-step-body">
        <h3>Trade History + Decision Log</h3>
        <p>Every run is logged with full reasoning: signal score breakdown (EMA +30, RSI +28, VWAP +20, etc.), regime, leverage used, threshold applied, and why a trade fired or was skipped. Toggle Simple/Advanced view at the top.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">☰</div>
      <div class="info-step-body">
        <h3>Nav Drawer (top-left hamburger)</h3>
        <p>Slide-in navigation organized into Overview, Trading, Performance, History & Controls. Click any item to smooth-scroll to that section. Mobile-friendly.</p>
      </div>
    </div>
  </div>

  <div class="info-section">
    <h2>🌐 Where Agent Avila Runs</h2>
    <div class="info-cards" style="grid-template-columns:repeat(2,1fr)">
      <div class="info-card">
        <div class="info-card-icon">💻</div>
        <div class="info-card-label">Local Mac</div>
        <div class="info-card-value" style="font-size:14px">localhost:3000</div>
        <div class="info-card-sub">Cron runs bot every 5 min · Dashboard reads local files</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">☁️</div>
        <div class="info-card-label">Railway (Cloud)</div>
        <div class="info-card-value" style="font-size:13px">agent-avila-dashboard-production.up.railway.app</div>
        <div class="info-card-sub">Dashboard live publicly · Bot runs on Railway cron</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">📦</div>
        <div class="info-card-label">GitHub</div>
        <div class="info-card-value" style="font-size:14px">github.com/relentlessvic/agent-avila</div>
        <div class="info-card-sub">All code version-controlled, pushable from Mac</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">🔑</div>
        <div class="info-card-label">Kraken</div>
        <div class="info-card-value" style="font-size:14px">XRP/USD margin enabled</div>
        <div class="info-card-sub">Up to 10x leverage available, capped at 3x</div>
      </div>
    </div>
  </div>

  <div class="info-alert" style="background:rgba(0,212,255,0.06);border-color:rgba(0,212,255,0.2)">
    <strong style="color:var(--blue)">📋 Currently in Paper Trading Mode</strong> — No real money is being used. Running on a simulated $100 account to validate performance before going live.
  </div>

  <div class="info-section">
    <h2>📊 Evolution Map</h2>
    <div class="info-cards" style="grid-template-columns:repeat(3,1fr)">
      <div class="info-card">
        <div class="info-card-label" style="color:var(--muted)">Agent 1.1</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;margin-top:8px">
          4-condition hard lock<br>Fixed $8.50 size<br>Static SL/TP<br>No exit logic<br>No leverage control
        </div>
      </div>
      <div class="info-card" style="border-color:rgba(0,212,255,0.2)">
        <div class="info-card-label" style="color:var(--blue)">Agent 2.0</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;margin-top:8px">
          Score ≥ 75/100<br>Dynamic sizing<br>Adaptive SL/TP<br>Breakeven + trail stop<br>Regime-aware leverage
        </div>
      </div>
      <div class="info-card" style="border-color:rgba(0,255,154,0.2)">
        <div class="info-card-label" style="color:var(--green)">Agent 3.0 ← You are here</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;margin-top:8px">
          Performance feedback loop<br>EMA slope regime detection<br>Adaptive thresholds + risk<br>Timed pauses (not indefinite)<br>Decision logger
        </div>
      </div>
    </div>
  </div>

  <div class="info-alert">
    <strong>⚠️ Currently in Paper Trading Mode</strong> — No real money is being used. The bot is running on a simulated $100 account so you can see exactly how it performs before going live.
  </div>

  <div class="info-section">
    <h2>📋 How Agent 3.0 Works — Step by Step</h2>
    <div class="info-step">
      <div class="info-step-num">1</div>
      <div class="info-step-body">
        <h3>Every 5 min: manage trade OR find entry</h3>
        <p>If a position is open → check stop loss, take profit, breakeven, trail stop, and re-entry quality. If no position → run all entry guards and evaluate the signal score.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">2</div>
      <div class="info-step-body">
        <h3>Classify market regime (TRENDING / RANGE / VOLATILE)</h3>
        <p>Uses EMA slope to distinguish trending from ranging markets. VOLATILE (candle spike &gt; 2× ATR) blocks the trade entirely. Regime sets the leverage and SL/TP automatically.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">3</div>
      <div class="info-step-body">
        <h3>Load performance state and apply adaptations</h3>
        <p>Before entering, the bot checks its own win rate, drawdown, and streak. If performance is poor, it raises the entry bar. If drawdown &gt; 3%, it cuts trade size by half. If 2 losses in a row, leverage is locked for 30 minutes.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">4</div>
      <div class="info-step-body">
        <h3>Score the signal (0–100). Trade if ≥ adapted threshold</h3>
        <p>EMA uptrend (+30), RSI dip below 35 (+30), VWAP support (+20), not overextended (+20). Default threshold is 75. Poor win rate raises it to 85. Good win rate drops it to 70.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">5</div>
      <div class="info-step-body">
        <h3>Set SL/TP/leverage from regime, enter trade</h3>
        <p>TRENDING: 2× leverage, 1.25% SL, 2% TP. RANGE: 1× leverage, 1.0% SL, 1.5% TP. Position size = dollar risk ÷ SL distance (not a fixed amount).</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">6</div>
      <div class="info-step-body">
        <h3>Active trade management until exit</h3>
        <p>Every 5 min while in a trade: move SL to breakeven at +1% profit, activate trailing stop at +1.5%. Exit on SL hit, TP hit, or if a significantly better signal appears (score improvement &gt; 20 pts).</p>
      </div>
    </div>
  </div>

  <div class="info-section">
    <h2>📊 Performance Feedback Rules (Exact Logic)</h2>
    <div class="info-cards" style="grid-template-columns:repeat(2,1fr)">
      <div class="info-card">
        <div class="info-card-label" style="color:var(--red)">🔴 Tighten when struggling</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;margin-top:8px">
          Win rate &lt; 45% → raise threshold to 85<br>
          2 consecutive losses → lock leverage 30 min<br>
          3 consecutive losses → pause trading 60 min<br>
          Drawdown &gt; 2% → force leverage 1×<br>
          Drawdown &gt; 3% → cut risk by 50%<br>
          Drawdown ≥ 5% → kill switch activated
        </div>
      </div>
      <div class="info-card">
        <div class="info-card-label" style="color:var(--green)">🟢 Loosen when performing</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;margin-top:8px">
          Win rate &gt; 65% → lower threshold to 70<br>
          Profit factor &gt; 1.5 → increase size max +10%<br>
          Timed pauses auto-expire (no manual reset needed)<br>
          Leverage lock auto-clears after 30 min
        </div>
      </div>
    </div>
  </div>

  <div class="info-section">
    <h2>⚙️ Current Settings</h2>
    <div class="info-cards">
      <div class="info-card">
        <div class="info-card-icon">💱</div>
        <div class="info-card-label">Trading Pair</div>
        <div class="info-card-value">XRP / USD</div>
        <div class="info-card-sub">Kraken exchange</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">⏱</div>
        <div class="info-card-label">Check Frequency</div>
        <div class="info-card-value">Every 5 min</div>
        <div class="info-card-sub">288 checks/day</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">📊</div>
        <div class="info-card-label">Entry Score</div>
        <div class="info-card-value">≥ 75 / 100</div>
        <div class="info-card-sub">adapts 70–85</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">💵</div>
        <div class="info-card-label">Risk Per Trade</div>
        <div class="info-card-value">1% of balance</div>
        <div class="info-card-sub">dynamic sizing</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">🛑</div>
        <div class="info-card-label">Stop Loss</div>
        <div class="info-card-value">1.0–1.25%</div>
        <div class="info-card-sub">regime-based</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">🎯</div>
        <div class="info-card-label">Take Profit</div>
        <div class="info-card-value">1.5–2.0%</div>
        <div class="info-card-sub">regime-based</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">⚡</div>
        <div class="info-card-label">Leverage</div>
        <div class="info-card-value">1–2× (regime)</div>
        <div class="info-card-sub">3× hard cap</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">🏦</div>
        <div class="info-card-label">Paper Budget</div>
        <div class="info-card-value">$100</div>
        <div class="info-card-sub">mirrors live deposit</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">📉</div>
        <div class="info-card-label">Kill Switch</div>
        <div class="info-card-value">5% drawdown</div>
        <div class="info-card-sub">halts all trading</div>
      </div>
    </div>
  </div>

  <div class="info-section">
    <h2>🚦 Reading the Dashboard</h2>
    <div class="info-step">
      <div class="info-step-num">📊</div>
      <div class="info-step-body">
        <h3>Performance State panel</h3>
        <p>Shows win rate, profit factor, R-ratio, and drawdown. Adaptation badges below it tell you exactly what the bot has changed and why — e.g. "Threshold 85 (low win rate)" or "Risk 50% (drawdown guard)".</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🧠</div>
      <div class="info-step-body">
        <h3>Compact Trader Bar (top strip)</h3>
        <p>Live market regime badge (📈 TRENDING / ↔️ RANGE / ⚡ VOLATILE), signal confidence bar (0–100), active leverage, and current mode. Updates in real time from Kraken's WebSocket feed.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🔍</div>
      <div class="info-step-body">
        <h3>Decision Log in Safety Check</h3>
        <p>Every run logs a structured explanation: what each condition scored, the total, the threshold used, and whether a trade fired. This is the "why" behind every decision — not a label, the actual numbers.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🔵</div>
      <div class="info-step-body">
        <h3>Simple View vs Advanced View</h3>
        <p>Toggle at the top of Trade History. Simple View uses plain language for all sections. Advanced View shows raw numbers, RSI values, and technical labels. Both views update live.</p>
      </div>
    </div>
  </div>
</div>

<div id="dashboard-page">
<div class="health-strip">
  <div class="health-item">
    <div class="h-dot h-dot-green" id="health-dot"></div>
    <span id="health-last-run" style="color:var(--text)">—</span>
  </div>
  <div class="health-item">
    ⏱ <span class="countdown-val" id="next-run-countdown">—</span>
  </div>
  <div class="health-item" id="live-regime-item" style="display:none">
    <span class="live-status-item regime-range" id="live-regime">— RANGE</span>
  </div>
  <div class="health-item" id="live-confidence-item" style="display:none">
    <span style="color:var(--muted)">Score</span>
    <div class="confidence-bar-wrap">
      <div class="confidence-bar"><div class="confidence-bar-fill" id="live-confidence-bar" style="width:0%;background:var(--blue)"></div></div>
      <span id="live-confidence-val" style="font-weight:700;color:var(--blue)">—</span>
    </div>
  </div>
  <div class="health-item" id="live-leverage-item" style="display:none">
    <span class="live-status-item" id="live-leverage-badge" style="background:rgba(124,92,255,0.1);color:var(--purple);border:1px solid rgba(124,92,255,0.2)">—</span>
  </div>
  <div class="health-item" id="discord-status-item" style="margin-left:auto">
    <span class="discord-status discord-status-unknown" id="discord-status">Discord: ? unknown</span>
  </div>
</div>

<main>

  <!-- Compact Status Bar — single source of truth -->
  <!-- Trading Status banner — single answer to "can the bot trade right now?" -->
  <div class="trading-status" id="trading-status" role="status" aria-live="polite">
    <span class="trading-status-icon" id="trading-status-icon">⏳</span>
    <span class="trading-status-text"  id="trading-status-text">Checking system…</span>
  </div>

  <div class="status-bar">
    <span class="pill pill-mode" id="pill-mode">🔒 PAPER MODE</span>
    <span class="pill pill-symbol" id="pill-symbol">XRP <strong id="pill-price">$—</strong> <span id="pill-arrow">—</span></span>
    <span class="pill pill-regime" id="pill-regime">— REGIME</span>
    <span class="pill pill-score" id="pill-score">Score: —</span>
    <span class="pill pill-bot" id="pill-bot">Bot: —</span>
    <span class="pill pill-risk" id="pill-risk">Risk: —%</span>
    <span class="pill pill-max-trade" id="pill-max-trade">Max Trade: —</span>
    <span class="pill pill-pnl" id="pill-pnl">P&L: —</span>
    <span class="pill pill-daily-loss" id="pill-daily-loss">Daily: —</span>
    <span class="pill pill-last-trade" id="pill-last-trade">Last trade: —</span>
    <span class="pill" id="pill-stream" style="display:none">Stream: —</span>
  </div>

  <!-- Persistent Risk Alert Feed — last 5 risk events from safety-check-log -->
  <!-- Strategy V2 — Shadow Decision card. Read-only view of the latest
       V2 verdict from safety-check-log.json. V2 is analysis-only in
       Phase 1 — never places trades. -->
  <section class="v2-shadow" id="v2-shadow">
    <div class="v2-shadow-header">
      <span class="v2-shadow-title">🛰 V2 SHADOW MODE</span>
      <span class="v2-shadow-disclaimer">Shadow only — no trades placed</span>
    </div>
    <div class="v2-shadow-body" id="v2-shadow-body">
      <div class="v2-shadow-empty">Loading…</div>
    </div>
  </section>

  <!-- Open Position — moved to top of operator view -->
  <div class="section-title" id="section-position">Open Position</div>
  <div class="position-card" id="position-card">
    <div class="position-header">
      <span class="position-title">Current Trade</span>
      <span class="position-badge-closed" id="position-badge">No Position</span>
    </div>
    <div id="position-body">
      <div class="position-no-trade">No open trade — bot is watching for the next entry signal.</div>
    </div>
  </div>

  <!-- Paper Wallet Snapshot — quick on-dashboard view; canonical view is /paper -->
  <div class="section-title" id="section-paper">Paper Wallet Snapshot</div>
  <div class="paper-wallet">
    <div class="paper-wallet-header">
      <span class="paper-wallet-title">Virtual Wallet</span>
      <span class="paper-wallet-badge">📋 Paper Money</span>
      <a href="/paper" class="paper-wallet-link" style="margin-left:auto;font-size:12px;color:var(--accent,#00D4FF);text-decoration:none;border:1px solid rgba(0,212,255,0.3);padding:4px 10px;border-radius:6px">View Full Paper Dashboard →</a>
    </div>
    <div class="paper-wallet-note" style="font-size:11px;color:var(--muted);padding:6px 0 4px;letter-spacing:0.2px">Snapshot only — official paper account view lives on <a href="/paper" style="color:var(--accent,#00D4FF);text-decoration:none">/paper</a>.</div>
    <div class="paper-wallet-row">
      <div class="paper-wallet-item">
        <div class="paper-wallet-label">Starting Balance</div>
        <div class="paper-wallet-value" id="pw-starting">—</div>
        <div class="paper-wallet-sub">your paper budget</div>
      </div>
      <div class="paper-wallet-item">
        <div class="paper-wallet-label">USD Remaining</div>
        <div class="paper-wallet-value" id="pw-usd-remaining">—</div>
        <div class="paper-wallet-sub" id="pw-usd-spent">$0 spent</div>
      </div>
      <div class="paper-wallet-item">
        <div class="paper-wallet-label">XRP Held</div>
        <div class="paper-wallet-value" id="pw-xrp-held">—</div>
        <div class="paper-wallet-sub" id="pw-xrp-value">current value: —</div>
      </div>
      <div class="paper-wallet-item">
        <div class="paper-wallet-label">Trades Taken</div>
        <div class="paper-wallet-value" id="pw-trade-count">—</div>
        <div class="paper-wallet-sub" id="pw-avg-entry">avg entry: —</div>
      </div>
    </div>
    <hr class="paper-wallet-divider">
    <div class="paper-wallet-footer">
      <div>
        <div class="paper-wallet-total-label">Total Portfolio Value</div>
        <div class="paper-wallet-total-value" id="pw-total-value">—</div>
      </div>
      <div style="text-align:right">
        <div class="paper-wallet-total-label">Overall P&amp;L</div>
        <div class="paper-wallet-pnl" id="pw-pnl">—</div>
      </div>
    </div>
  </div>

  <!-- "How the system works" collapsible -->
  <div class="how-it-works" id="how-it-works">
    <button class="how-toggle" onclick="toggleHowItWorks()">
      <span>📘 How the system works</span>
      <span class="how-arrow">▼</span>
    </button>
    <div class="how-body" id="how-body">
      <div class="how-section">
        <strong>Every 5 minutes</strong> the bot scores 4 conditions:
        <ul>
          <li><strong>EMA(8) Uptrend</strong> — price above moving average → <span style="color:var(--green)">+30 pts</span></li>
          <li><strong>RSI(3) Dip</strong> — momentum oversold (smooth 0–30 partial credit) → <span style="color:var(--green)">+30 pts</span></li>
          <li><strong>VWAP Support</strong> — buyers in control → <span style="color:var(--green)">+20 pts</span></li>
          <li><strong>Not Overextended</strong> — price within 1.5% of VWAP → <span style="color:var(--green)">+20 pts</span></li>
        </ul>
        Score ≥ 75/100 triggers a buy. Exits at -1.25% (stop loss) or +2% (take profit).
      </div>
      <div class="how-section">
        <strong>Active Strategy:</strong> RSI Dip (only). Reversal logic is disabled. Max 1 open position, 3 trades/day, 5% drawdown kill switch.
      </div>
    </div>
  </div>

  <!-- Last Decision — prominent single-decision focus -->
  <div class="last-decision card" id="last-decision">
    <div class="last-decision-header">
      <span class="last-decision-label">Last Decision</span>
      <span class="last-decision-time" id="ld-time">—</span>
    </div>
    <div class="last-decision-body">
      <div class="last-decision-result">
        <span class="last-decision-icon" id="ld-icon">⏳</span>
        <span class="last-decision-text" id="ld-result">Loading…</span>
      </div>
      <div class="last-decision-reason" id="ld-reason">—</div>
      <div class="next-trade-block" id="next-trade-block" style="display:none">
        <div class="next-trade-label">Next Trade Requires</div>
        <ul class="next-trade-list" id="next-trade-list"></ul>
      </div>
    </div>
  </div>

  <!-- Hero Live Ticker -->
  <div class="hero-ticker">
    <div class="ticker-left">
      <div class="ticker-symbol-icon">X</div>
      <div>
        <div class="ticker-pair">XRP / USD · Live</div>
        <div style="display:flex;align-items:baseline;gap:10px">
          <span class="ticker-price skeleton" id="ticker-price">$—.——</span>
          <span class="ticker-arrow" id="ticker-arrow">—</span>
        </div>
      </div>
    </div>
    <div class="ticker-right">
      <div class="ticker-stat" style="text-align:left">
        <div class="ticker-stat-label">Live Trend</div>
        <svg id="ticker-sparkline" width="120" height="28" style="display:block;margin-top:2px"></svg>
      </div>
      <div class="ticker-stat">
        <div class="ticker-stat-label">Session P&L</div>
        <div class="ticker-stat-value" id="ticker-pnl" style="color:var(--muted)">—</div>
      </div>
      <div class="ticker-stat">
        <div class="ticker-stat-label">24h Range</div>
        <div class="ticker-stat-value" id="ticker-range" style="font-size:13px">—</div>
      </div>
      <div class="ticker-stat" style="text-align:right">
        <div class="ticker-stat-label">Status</div>
        <div style="display:flex;align-items:center;justify-content:flex-end">
          <span class="ticker-pulse-dot"></span>
          <span class="ticker-live-label">LIVE</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Mode Banner -->
  <div class="mode-banner mode-paper" id="mode-banner">
    <span class="mode-banner-icon">🔒</span>
    <span class="mode-banner-text"><strong>PAPER MODE</strong> — Real trading disabled. Bot uses simulated funds only.</span>
  </div>

  <!-- System Health -->
  <div class="section-title" id="section-health">🩺 System Health</div>
  <div class="health-monitor">
    <div class="health-grid">
      <div class="health-check-item">
        <div class="health-check-icon">🌐</div>
        <div class="health-check-label">Kraken API</div>
        <div class="health-check-status" id="hc-api">Checking...</div>
        <div style="font-size:10px;color:var(--muted)" id="hc-api-latency">—</div>
      </div>
      <div class="health-check-item">
        <div class="health-check-icon">📡</div>
        <div class="health-check-label">WebSocket Feed</div>
        <div class="health-check-status" id="hc-ws">Connecting...</div>
        <div style="font-size:10px;color:var(--muted)" id="hc-ws-detail">—</div>
      </div>
      <div class="health-check-item">
        <div class="health-check-icon">⏱</div>
        <div class="health-check-label">Data Freshness</div>
        <div class="health-check-status" id="hc-data">—</div>
        <div style="font-size:10px;color:var(--muted)" id="hc-data-age">—</div>
      </div>
      <div class="health-check-item">
        <div class="health-check-icon">🤖</div>
        <div class="health-check-label">Bot Engine</div>
        <div class="health-check-status" id="hc-bot">—</div>
        <div style="font-size:10px;color:var(--muted)" id="hc-bot-detail">—</div>
      </div>
    </div>
  </div>

  <!-- Portfolio Intelligence -->
  <div class="section-title" id="section-portfolio">Portfolio Intelligence</div>
  <div class="portfolio-panel">
    <div class="portfolio-header-bar">
      <div>
        <div class="portfolio-hero-label">Total Portfolio Value</div>
        <div style="display:flex;align-items:baseline;gap:10px">
          <span class="portfolio-hero-value" id="port-hero-value">$—</span>
          <span class="portfolio-hero-change" id="port-hero-change" style="color:var(--muted)">—</span>
        </div>
      </div>
      <div style="text-align:right">
        <div class="portfolio-hero-label" style="margin-bottom:4px">Live Trend (60 ticks)</div>
        <svg id="portfolio-sparkline" width="180" height="40" style="display:block"></svg>
      </div>
    </div>
    <div class="portfolio-top">
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div class="portfolio-score-ring" id="port-score-ring">
          <span class="portfolio-score-num" id="port-score">—</span>
          <span class="portfolio-score-label">Health</span>
        </div>
        <span style="font-size:11px;color:var(--muted);text-align:center" id="port-score-label">—</span>
      </div>
      <div class="portfolio-metrics">
        <div>
          <div class="pm-label">Open Risk</div>
          <div class="pm-value" id="port-open-risk">—</div>
          <div class="pm-sub">% of balance at risk</div>
        </div>
        <div>
          <div class="pm-label">Unrealized P&amp;L</div>
          <div class="pm-value" id="port-unrealized">—</div>
          <div class="pm-sub">open position</div>
        </div>
        <div>
          <div class="pm-label">Realized P&amp;L</div>
          <div class="pm-value" id="port-realized">—</div>
          <div class="pm-sub">closed trades</div>
        </div>
        <div>
          <div class="pm-label">Efficiency Score</div>
          <div class="pm-value" id="port-efficiency">—</div>
          <div class="pm-sub">profit per unit risk</div>
        </div>
        <div>
          <div class="pm-label">Total Balance</div>
          <div class="pm-value" id="port-total-bal" style="color:var(--blue)">—</div>
          <div class="pm-sub">paper portfolio</div>
        </div>
        <div>
          <div class="pm-label">Drawdown</div>
          <div class="pm-value" id="port-drawdown">—</div>
          <div class="pm-sub">from start</div>
        </div>
      </div>
    </div>
    <div class="alloc-bar-wrap">
      <div class="alloc-bar-labels">
        <span style="color:var(--blue)" id="alloc-usd-label">USD 60%</span>
        <span style="color:var(--purple)" id="alloc-xrp-label">XRP 40%</span>
        <span style="color:var(--red)" id="alloc-risk-label">Open risk 0%</span>
      </div>
      <div class="alloc-bar-track">
        <div class="alloc-usd"  id="alloc-bar-usd"  style="width:60%"></div>
        <div class="alloc-xrp"  id="alloc-bar-xrp"  style="width:40%"></div>
        <div class="alloc-risk" id="alloc-bar-risk" style="width:0%"></div>
      </div>
    </div>
  </div>

  <!-- Capital Router -->
  <div class="section-title" id="section-capital">Capital Router</div>
  <div class="capital-panel">
    <div class="capital-header">
      <span class="capital-title">Portfolio Allocation</span>
      <span id="capital-xrp-badge" class="ctrl-badge ctrl-badge-green">🔒 XRP: HOLD ASSET</span>
    </div>
    <div class="capital-grid">
      <div>
        <div class="capital-item-label">Active Capital (70%)</div>
        <div class="capital-item-value" id="cap-active">—</div>
        <div class="capital-item-sub">available for trading</div>
      </div>
      <div>
        <div class="capital-item-label">Reserve (30%)</div>
        <div class="capital-item-value" id="cap-reserve" style="color:var(--muted)">—</div>
        <div class="capital-item-sub">untouched buffer</div>
      </div>
      <div>
        <div class="capital-item-label">USD Balance</div>
        <div class="capital-item-value" id="cap-usd-total" style="color:var(--blue)">—</div>
        <div class="capital-item-sub">paper trading</div>
      </div>
      <div>
        <div class="capital-item-label">Auto-Convert XRP</div>
        <div class="capital-item-value" id="cap-autoconvert" style="color:var(--muted)">OFF</div>
        <div class="capital-item-sub">safe mode</div>
      </div>
    </div>
    <div class="capital-bar-wrap">
      <div class="capital-bar-labels">
        <span style="color:var(--blue)" id="cap-bar-active-label">Active 70%</span>
        <span id="cap-bar-reserve-label">Reserve 30%</span>
      </div>
      <div class="capital-bar-track">
        <div class="capital-bar-active" id="cap-bar-active" style="width:70%"></div>
        <div class="capital-bar-reserve" style="flex:1"></div>
      </div>
    </div>
    <div class="capital-controls">
      <span style="font-size:11px;color:var(--muted);font-weight:600">XRP ROLE:</span>
      <button class="capital-role-btn active-role" id="cap-btn-hold"    onclick="setCapital('SET_XRP_ROLE','HOLD_ASSET')">🔒 HOLD_ASSET</button>
      <button class="capital-role-btn" id="cap-btn-active"   onclick="setCapital('SET_XRP_ROLE','ACTIVE')">⚡ ACTIVE</button>
      <button class="capital-role-btn capital-danger" id="cap-btn-aggressive" onclick="confirmCapital()">🔥 AGGRESSIVE</button>
      <span style="font-size:11px;color:var(--muted);font-weight:600;margin-left:8px">ACTIVE %:</span>
      <input class="ctrl-input" id="cap-active-pct" type="number" min="10" max="95" step="5" value="70" placeholder="% (e.g. 70)" title="Active trading capital % (10–95, rest is reserve)" style="width:64px">
      <button class="ctrl-btn" onclick="setCapital('SET_ACTIVE_PCT', document.getElementById('cap-active-pct').value)">Set</button>
    </div>
  </div>

  <!-- Active Strategies Panel -->
  <div class="section-title" id="section-strategies">Active Strategies</div>
  <div class="card" style="padding:18px 22px;margin-bottom:24px">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
      <div class="strategy-row strategy-active">
        <div class="strategy-status">✅ ACTIVE</div>
        <div class="strategy-name">RSI Dip Strategy</div>
        <div class="strategy-desc">Buy on RSI &lt; 35 oversold pullback in uptrend (EMA(8) + VWAP confirmed)</div>
      </div>
      <div class="strategy-row strategy-inactive">
        <div class="strategy-status">❌ INACTIVE</div>
        <div class="strategy-name">RSI Reversal Strategy</div>
        <div class="strategy-desc">Sell on RSI &gt; 70 overbought reversal in downtrend (requires shorting)</div>
      </div>
      <div class="strategy-row strategy-inactive">
        <div class="strategy-status">❌ INACTIVE</div>
        <div class="strategy-name">Bollinger Squeeze Breakout</div>
        <div class="strategy-desc">Buy when BB(20) tightens and price breaks upper band (volatility expansion)</div>
      </div>
      <div class="strategy-row strategy-inactive">
        <div class="strategy-status">❌ INACTIVE</div>
        <div class="strategy-name">Mean Reversion (BB Lower)</div>
        <div class="strategy-desc">Buy when price touches lower Bollinger Band with RSI &lt; 30</div>
      </div>
    </div>
  </div>

  <!-- Strategy Performance (combined paper + live W/L; see Paper Wallet Snapshot above for paper-only ledger) -->
  <div class="section-title" id="section-performance">Strategy Performance</div>
  <div class="perf-panel">
    <div class="perf-grid">
      <div>
        <div class="perf-item-label">Win Rate <span id="perf-wr-mode-tag" style="font-size:9px;color:var(--muted);font-weight:500;letter-spacing:0.5px">—</span></div>
        <div class="perf-item-value" id="perf-winrate">—</div>
        <div class="perf-item-sub" id="perf-wl-paper">Paper W/L: —</div>
        <div class="perf-item-sub" id="perf-wl-live">Live W/L: unavailable</div>
      </div>
      <div>
        <div class="perf-item-label">Profit Factor</div>
        <div class="perf-item-value" id="perf-pf">—</div>
        <div class="perf-item-sub" id="perf-pf-sub">gross profit ÷ gross loss</div>
      </div>
      <div>
        <div class="perf-item-label">Avg Profit / Avg Loss</div>
        <div class="perf-item-value" id="perf-avgpl">—</div>
        <div class="perf-item-sub" id="perf-avgpl-sub">—</div>
      </div>
      <div>
        <div class="perf-item-label">Session Drawdown</div>
        <div class="perf-item-value" id="perf-drawdown">—</div>
        <div class="perf-item-sub" id="perf-dd-sub">from starting balance</div>
      </div>
    </div>
    <div class="perf-adaptations" id="perf-adaptations">
      <span class="perf-adapt-badge adapt-default">Loading adaptations...</span>
    </div>
  </div>

  <!-- Lifecycle Controls — bot start/stop/pause, mode toggle, resets, status badges -->
  <div class="section-title" id="section-controls">Lifecycle Controls</div>
  <div class="ctrl-panel">
    <div class="ctrl-status-row" id="ctrl-status-row">
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-running">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-mode">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-paused">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-killed">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-leverage">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-risk">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-losses">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-cooldown">—</span>
    </div>
    <div class="ctrl-groups" style="grid-template-columns:repeat(2,1fr)">
      <div>
        <div class="ctrl-group-label">Bot State</div>
        <div class="ctrl-btns">
          <button class="ctrl-btn ctrl-btn-success" id="btn-start"   onclick="sendCmd('START_BOT')">▶ START_BOT</button>
          <button class="ctrl-btn ctrl-btn-danger"  id="btn-stop"    onclick="confirmStop()">⛔ STOP_BOT</button>
          <button class="ctrl-btn ctrl-btn-warn"    id="btn-pause"   onclick="sendCmd('PAUSE_TRADING')">⏸ PAUSE</button>
          <button class="ctrl-btn ctrl-btn-success" id="btn-resume"  onclick="sendCmd('RESUME_TRADING')">▶ RESUME</button>
        </div>
      </div>
      <div>
        <div class="ctrl-group-label">Trading Mode</div>
        <div class="ctrl-btns">
          <button class="ctrl-btn ctrl-btn-warn"    id="btn-mode-live"  onclick="confirmLive()">🔴 Switch to Live</button>
          <button class="ctrl-btn ctrl-btn-success" id="btn-mode-paper" onclick="sendCmd('SET_MODE_PAPER')">📋 Switch to Paper</button>
        </div>
        <div class="ctrl-group-label" style="margin-top:12px">Resets</div>
        <div class="ctrl-btns">
          <button class="ctrl-btn ctrl-btn-success" onclick="confirmResetKill()">🔓 Reset Kill Switch</button>
          <button class="ctrl-btn ctrl-btn-success" onclick="sendCmd('RESET_LOSSES')">↺ Reset Loss Counter</button>
          <button class="ctrl-btn ctrl-btn-success" onclick="sendCmd('RESET_COOLDOWN')">⏩ Skip Cooldown</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Risk Controls — leverage, risk %, daily loss cap, cooldown, kill threshold, pause-on-losses -->
  <div class="section-title" id="section-risk">Risk Controls</div>
  <div class="ctrl-panel">
    <div class="bot-modes">
      <div class="bot-modes-label">⚙️ Quick Mode Preset:</div>
      <div class="bot-modes-grid">
        <button class="bot-mode-btn" id="mode-preset-conservative" onclick="applyBotMode('conservative')">
          <div class="mode-icon">🛡</div>
          <div class="mode-name">Conservative</div>
          <div class="mode-detail">Risk 0.5% · Threshold 85 · 1× lev</div>
        </button>
        <button class="bot-mode-btn active" id="mode-preset-balanced" onclick="applyBotMode('balanced')">
          <div class="mode-icon">⚖️</div>
          <div class="mode-name">Balanced</div>
          <div class="mode-detail">Risk 1% · Threshold 75 · 2× lev</div>
        </button>
        <button class="bot-mode-btn" id="mode-preset-aggressive" onclick="applyBotMode('aggressive')">
          <div class="mode-icon">🔥</div>
          <div class="mode-name">Aggressive</div>
          <div class="mode-detail">Risk 2% · Threshold 65 · 3× lev</div>
        </button>
      </div>
    </div>
    <div class="ctrl-groups" style="grid-template-columns:repeat(2,1fr)">
      <div>
        <div class="ctrl-group-label">Risk Settings</div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-leverage-val" type="number" min="1" max="3" step="1" value="2" placeholder="1–3" title="Leverage 1× to 3× (hard cap)">
          <button class="ctrl-btn" style="flex:1" onclick="sendNum('SET_LEVERAGE','ctrl-leverage-val',1,3,'Leverage',true)">Leverage ×</button>
        </div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-risk-val" type="number" min="0.1" max="5" step="0.1" value="1" placeholder="Risk % (e.g. 1)" title="Risk per trade as % of balance (0.1–5)">
          <button class="ctrl-btn" style="flex:1" onclick="sendNum('SET_RISK','ctrl-risk-val',0.1,5,'Risk %',false)">Risk %</button>
        </div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-dailyloss-val" type="number" min="0.5" max="20" step="0.5" value="3" placeholder="Max % (e.g. 3)" title="Stop trading if daily loss exceeds this % (0.5–20)">
          <button class="ctrl-btn" style="flex:1" onclick="sendNum('SET_MAX_DAILY_LOSS','ctrl-dailyloss-val',0.5,20,'Max Daily Loss %',false)">Max Daily Loss %</button>
        </div>
      </div>
      <div>
        <div class="ctrl-group-label">Safety Guards</div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-cooldown-val" type="number" min="0" max="120" step="5" value="15" placeholder="Min (e.g. 15)" title="Wait N minutes between trades (0–120)">
          <button class="ctrl-btn" style="flex:1" onclick="sendNum('SET_COOLDOWN','ctrl-cooldown-val',0,120,'Cooldown (min)',false)">Cooldown (min)</button>
        </div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-killpct-val" type="number" min="1" max="50" step="0.5" value="5" placeholder="Drawdown % (e.g. 5)" title="Halt all trading if drawdown exceeds this % (1–50)">
          <button class="ctrl-btn" style="flex:1" onclick="sendNum('SET_KILL_DRAWDOWN','ctrl-killpct-val',1,50,'Kill Switch %',false)">Kill Switch %</button>
        </div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-pauselosses-val" type="number" min="1" max="10" step="1" value="3" placeholder="Streak (e.g. 3)" title="Auto-pause after N consecutive losses (1–10)">
          <button class="ctrl-btn" style="flex:1" onclick="sendNum('SET_PAUSE_LOSSES','ctrl-pauselosses-val',1,10,'Pause After Losses',true)">Pause After Losses</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Trading Terminal -->
  <div class="section-title" id="section-terminal">Trading Terminal</div>
  <div class="trade-terminal">
    <div class="trade-terminal-header">
      <span class="trade-terminal-title">⚡ Manual Commands — XRPUSDT</span>
      <span class="trade-terminal-mode" id="trade-mode-label">—</span>
    </div>
    <div class="trade-cmd-grid">
      <div class="trade-cmd-col">
        <div class="trade-cmd-col-label">Buy / Long</div>
        <button class="trade-cmd-btn trade-btn-buy" onclick="tradeCmd('BUY_MARKET')">BUY XRP MARKET</button>
        <button class="trade-cmd-btn trade-btn-buy" onclick="tradeCmd('OPEN_LONG', { leverage: document.getElementById('t-lev').value })">OPEN LONG XRP <span id="t-lev-display">2</span>×</button>
        <div class="trade-pct-row" style="margin-top:8px">
          <span class="trade-pct-label">Leverage</span>
          <input class="trade-pct-input" id="t-lev" type="number" min="1" max="3" step="1" value="2" placeholder="× (1–3)" title="Leverage multiplier 1×–3×" oninput="document.getElementById('t-lev-display').textContent=this.value">
        </div>
      </div>
      <div class="trade-cmd-col">
        <div class="trade-cmd-col-label">Sell / Close</div>
        <button class="trade-cmd-btn trade-btn-sell" onclick="confirmTrade('CLOSE_POSITION', 'Close your open position at market price?')">CLOSE POSITION</button>
        <button class="trade-cmd-btn trade-btn-sell" onclick="confirmTrade('SELL_ALL', 'SELL ALL XRP on Kraken? This sells your entire balance.')">SELL ALL</button>
      </div>
      <div class="trade-cmd-col">
        <div class="trade-cmd-col-label">Set Exit Levels</div>
        <div class="trade-pct-row">
          <span class="trade-pct-label">Stop Loss %</span>
          <input class="trade-pct-input" id="t-sl" type="number" min="0.1" max="10" step="0.05" value="1.25" placeholder="SL % (e.g. 1.25)" title="Stop loss % below entry (0.1–10)">
        </div>
        <button class="trade-cmd-btn trade-btn-set" onclick="tradeCmd('SET_STOP_LOSS', { pct: document.getElementById('t-sl').value })">SET STOP LOSS</button>
        <div class="trade-pct-row" style="margin-top:6px">
          <span class="trade-pct-label">Take Profit %</span>
          <input class="trade-pct-input" id="t-tp" type="number" min="0.1" max="20" step="0.1" value="2" placeholder="TP % (e.g. 2)" title="Take profit % above entry (0.1–20)">
        </div>
        <button class="trade-cmd-btn trade-btn-set" onclick="tradeCmd('SET_TAKE_PROFIT', { pct: document.getElementById('t-tp').value })">SET TAKE PROFIT</button>
      </div>
    </div>
    <div class="trade-log" id="trade-log">
      <div class="trade-log-entry" style="color:var(--muted)">Ready — commands will appear here</div>
    </div>
  </div>

  <!-- Live Chart -->
  <div class="section-header">
    <div class="section-title" id="section-chart">Live Chart — <span id="chart-symbol-label">XRPUSDT</span></div>
  </div>

  <!-- TradingView widget -->
  <div class="chart-card" id="chart-card-tv">
    <div id="tv_chart" style="width:100%;height:540px"></div>
  </div>

  <!-- Balance -->
  <div class="section-header">
    <div class="section-title">Kraken Balance</div>
    <span class="ctrl-badge ctrl-badge-yellow" id="balance-mode-badge" style="font-size:10px">🔴 LIVE EXCHANGE DATA · NOT USED IN PAPER MODE</span>
  </div>
  <div class="balance-card">
    <div style="display:flex;align-items:center;gap:0;flex-wrap:wrap;flex:1">
      <div class="balance-assets" id="balance-content">
        <span style="color:var(--muted);font-size:13px">Loading...</span>
      </div>
      <div class="balance-total" id="balance-total" style="display:none">
        <div class="balance-total-label">Portfolio</div>
        <div class="balance-total-value" id="balance-total-value">—</div>
      </div>
    </div>
    <span class="balance-updated" id="balance-updated"></span>
  </div>

  <!-- Paper P&L -->
  <div class="section-title">Paper Trading P&amp;L</div>
  <div class="pnl-grid">
    <div class="pnl-card">
      <div class="pnl-label">Unrealized P&amp;L</div>
      <div class="pnl-value pnl-zero" id="pnl-value">—</div>
      <div class="pnl-sub" id="pnl-pct">no trades yet</div>
    </div>
    <div class="pnl-card">
      <div class="pnl-label">Current Value</div>
      <div class="pnl-value blue" id="pnl-current">—</div>
      <div class="pnl-sub" id="pnl-qty">— units held</div>
    </div>
    <div class="pnl-card">
      <div class="pnl-label">Total Invested</div>
      <div class="pnl-value" id="pnl-invested" style="color:var(--text)">—</div>
      <div class="pnl-sub" id="pnl-trades">— paper trades</div>
    </div>
    <div class="pnl-card">
      <div class="pnl-label">Avg Entry Price</div>
      <div class="pnl-value" id="pnl-avg-entry" style="color:var(--text)">—</div>
      <div class="pnl-sub" id="pnl-current-price">current: —</div>
    </div>
    <div class="pnl-card">
      <div class="pnl-label">Paper W/L Ratio</div>
      <div class="pnl-value pnl-zero" id="pnl-wl-ratio">—</div>
      <div class="pnl-sub" id="pnl-wl-detail">no paper trades yet</div>
    </div>
  </div>

  <!-- RSI History (collapsible) -->
  <div class="section-title section-collapsible rsi-hide-mobile" id="rsi-section-title" onclick="toggleRsiHistory()" style="display:flex;align-items:center;justify-content:space-between">
    <span>RSI(3) History — Recent Runs</span>
    <span class="collapse-icon">▼</span>
  </div>
  <div class="card rsi-hide-mobile" id="rsi-section-body" style="margin-bottom:24px">
    <div class="rsi-history-wrap" id="rsi-history-wrap">
      <div style="color:var(--muted);font-size:13px">No data yet</div>
    </div>
    <div class="rsi-legend">
      <div class="rsi-legend-item"><div class="rsi-legend-dot" style="background:var(--green)"></div> &gt;70 — reversal zone (trade possible)</div>
      <div class="rsi-legend-item"><div class="rsi-legend-dot" style="background:rgba(248,81,73,0.5)"></div> &lt;70 — waiting</div>
      <div class="rsi-legend-item"><span style="border-top:1px dashed rgba(248,81,73,0.6);width:16px;display:inline-block;margin-bottom:3px"></span> 70 threshold</div>
    </div>
  </div>

  <!-- Stats -->
  <div class="section-title">Overview</div>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Runs</div>
      <div class="stat-value blue" id="stat-total">—</div>
      <div class="stat-sub">all time</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Trades Fired</div>
      <div class="stat-value green" id="stat-fired">—</div>
      <div class="stat-sub" id="stat-fired-sub">paper + live</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Blocked</div>
      <div class="stat-value red" id="stat-blocked">—</div>
      <div class="stat-sub">safety check stopped</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Today's Trades</div>
      <div class="stat-value yellow" id="stat-today">—</div>
      <div class="stat-sub" id="stat-today-sub">of 3 max · UTC day</div>
    </div>
  </div>

  <!-- Indicators + Safety Check -->
  <div class="section-title">Latest Run</div>
  <div class="mid-grid">
    <div class="card">
      <div class="card-title">Market Indicators</div>
      <div id="indicators-content">
        <div class="empty-state">No data yet — run the bot first</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Safety Check</div>
      <div id="safety-content">
        <div class="empty-state">No data yet — run the bot first</div>
      </div>
    </div>
  </div>

  <!-- Risk Alert Feed — moved here to group with logs/history -->
  <section class="risk-feed" id="risk-feed">
    <div class="risk-feed-header">
      <span>⚠️ Recent Risk Alerts</span>
      <span class="risk-feed-count" id="risk-feed-count"></span>
    </div>
    <div class="risk-feed-list" id="risk-feed-list">
      <div class="risk-feed-empty">Loading…</div>
    </div>
  </section>

  <!-- Trade History / Recent Runs -->
  <div class="section-header">
    <div class="section-title" id="section-history">Trade History — Recent Runs</div>
    <div class="view-toggle">
      <button class="view-toggle-btn active" id="toggle-simple" onclick="setView('simple')">Simple View</button>
      <button class="view-toggle-btn" id="toggle-advanced" onclick="setView('advanced')">Advanced View</button>
    </div>
  </div>
  <div class="card" style="margin-bottom:24px" id="reasoning-card">
    <div id="reasoning-summary" class="reasoning-summary">Loading...</div>
    <div id="reasoning-summary-adv" class="reasoning-summary" style="display:none">Loading...</div>
    <div id="reasoning-timeline"></div>
    <div id="reasoning-timeline-advanced" style="display:none"></div>
  </div>

  <!-- Check Log (terminal-style activity feed) -->
  <div class="section-title">Recent Bot Activity</div>
  <div class="check-log card" id="check-log">
    <div class="check-log-line muted">Loading recent activity…</div>
  </div>

  <!-- Condition Heatmap -->
  <div class="section-title">Condition Heatmap — Last 10 Runs</div>
  <div class="card" style="margin-bottom:24px">
    <div class="heatmap-scroll">
      <div id="heatmap-content"><div class="empty-state">No data yet</div></div>
    </div>
  </div>

  <!-- Trade Log -->
  <div class="table-card">
    <div class="table-header">
      <div class="section-title" style="margin:0">Trade Log</div>
      <span style="color:var(--muted);font-size:12px">Follows Simple / Advanced toggle above</span>
    </div>
    <table>
      <thead id="trade-table-head">
        <tr>
          <th>Date</th><th>Time</th><th>Symbol</th><th>Price</th><th>Result</th><th>What Happened</th>
        </tr>
      </thead>
      <tbody id="trade-table-body">
        <tr class="empty-row"><td colspan="6">No trades recorded yet</td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">Live price every tick · Data refresh every 5s · <span id="footer-mode">Paper trading mode — no real money</span></div>
</main>
</div>

<!-- Agent Avila Chatbox -->
<div class="chat-bubble">
  <div class="chat-panel" id="chat-panel">
    <div class="chat-header">
      <div class="chat-header-icon">⚡</div>
      <div>
        <div class="chat-header-title">Agent Avila Assistant</div>
        <div class="chat-header-sub" id="chat-status">Ask me anything about your bot</div>
      </div>
      <button class="chat-close" onclick="toggleChat()">✕</button>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="chat-msg chat-msg-bot">Hey! I'm your Agent Avila assistant. I can explain trades, analyze your performance, and control the bot. Try asking:<br><br>• <em>"Why did the bot skip?"</em><br>• <em>"What's my current exposure?"</em><br>• <em>"Reduce risk to 0.5%"</em></div>
    </div>
    <div class="chat-suggestions">
      <button class="chat-suggest-btn" onclick="sendSuggestion('Why did the bot skip last trade?')">Why skip?</button>
      <button class="chat-suggest-btn" onclick="sendSuggestion('What is my current exposure?')">Exposure?</button>
      <button class="chat-suggest-btn" onclick="sendSuggestion('Analyze my performance')">Performance</button>
      <button class="chat-suggest-btn" onclick="sendSuggestion('What is the market regime right now?')">Regime</button>
    </div>
    <div class="chat-input-wrap">
      <textarea class="chat-input" id="chat-input" rows="1" placeholder="Ask Agent Avila..." onkeydown="chatKeyDown(event)"></textarea>
      <button class="chat-send-btn" onclick="sendChat()" title="Send (Enter)">➤</button>
    </div>
    <div style="padding:6px 12px 10px;font-size:10px;color:var(--muted);text-align:center;border-top:1px solid rgba(255,255,255,0.04)">
      <span class="kbd">⌘K</span> open chat · <span class="kbd">⌘P</span> pause · <span class="kbd">⌘L</span> live mode · <span class="kbd">esc</span> close
    </div>
  </div>
  <button class="chat-toggle-btn" onclick="toggleChat()" title="Agent Avila Assistant">⚡</button>
  <span class="chat-unread" id="chat-unread" style="display:none">1</span>
</div>

<script>
  // Safe JSON fetch — never throws on HTML responses (e.g. session expired → login redirect)
  async function safeJson(url, opts) {
    const res = await fetch(url, opts);
    const text = await res.text();
    if (!res.ok && res.status === 302) throw new Error("Session expired — please log in");
    try { return JSON.parse(text); }
    catch (e) {
      console.error("[safeJson] Invalid JSON from " + url + ":", text.slice(0, 200));
      throw new Error("Server returned non-JSON response (status " + res.status + ")");
    }
  }

  // ── Balance ────────────────────────────────────────────────────────────────
  function renderBalance(data) {
      const el = document.getElementById("balance-content");
      const upd = document.getElementById("balance-updated");
      if (data.error) {
        el.innerHTML = \`<span style="color:var(--muted);font-size:13px">\${data.error}</span>\`;
        return;
      }
      if (!data.balances || !data.balances.length) {
        el.innerHTML = \`<span style="color:var(--muted);font-size:13px">No balance data</span>\`;
        return;
      }
      el.innerHTML = data.balances.map(b => {
        const isUSD = b.asset === "USD";
        const color = isUSD ? "var(--green)" : "var(--text)";
        const formatted = isUSD
          ? "$" + b.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : b.amount < 1 ? b.amount.toFixed(6) : b.amount.toFixed(4);
        const usdSub = !isUSD && b.usdValue
          ? \`<div class="balance-asset-usd">≈ $\${b.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>\`
          : "";
        return \`
          <div class="balance-asset">
            <div class="balance-asset-name">\${b.asset}</div>
            <div class="balance-asset-amount" style="color:\${color}">\${formatted}</div>
            \${usdSub}
          </div>\`;
      }).join("");

      if (data.totalUSD > 0) {
        const totalEl = document.getElementById("balance-total");
        const totalVal = document.getElementById("balance-total-value");
        totalEl.style.display = "block";
        totalVal.textContent = "$" + data.totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      upd.textContent = "Updated " + new Date(data.updatedAt).toLocaleTimeString();
  }

  // ── Stats / Indicators ─────────────────────────────────────────────────────
  function fmt(n) {
    if (n === null || n === undefined || n === "") return "—";
    const num = parseFloat(n);
    if (isNaN(num)) return n;
    return num < 10 ? num.toFixed(4) : num.toFixed(2);
  }

  function timeAgo(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60) return diff + "s ago";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    return Math.floor(diff / 3600) + "h ago";
  }

  function biasClass(bias) {
    if (!bias) return "";
    const b = bias.toUpperCase();
    if (b.includes("BULL")) return "bias-bullish";
    if (b.includes("BEAR")) return "bias-bearish";
    return "bias-neutral";
  }

  // ── Countdown ──────────────────────────────────────────────────────────────
  function getNextCronTime() {
    const now = new Date();
    const h = now.getUTCHours();
    const slots = [0, 4, 8, 12, 16, 20];
    const next = slots.find(s => s > h);
    const d = new Date(now);
    d.setUTCMinutes(0, 0, 0);
    if (next !== undefined) { d.setUTCHours(next); }
    else { d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0); }
    return d;
  }

  function updateCountdown() {
    const diff = getNextCronTime() - Date.now();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const el = document.getElementById('next-run-countdown');
    if (el) el.textContent = h > 0 ? \`\${h}h \${m}m\` : \`\${m}m \${s}s\`;
  }
  setInterval(updateCountdown, 1000);
  updateCountdown();

  // ── Health Status ──────────────────────────────────────────────────────────
  function renderHealthStatus(latest) {
    if (!latest) return;
    const diffMin = (Date.now() - new Date(latest.timestamp)) / 60000;
    const dot = document.getElementById('health-dot');
    // Bot should run every 5 minutes — anything > 10 min is concerning
    if (dot) dot.className = 'h-dot ' + (diffMin < 10 ? 'h-dot-green' : diffMin < 30 ? 'h-dot-yellow' : 'h-dot-red');
    const el = document.getElementById('health-last-run');
    if (el) el.textContent = 'Bot last ran ' + timeAgo(latest.timestamp);
  }

  // ── RSI History ────────────────────────────────────────────────────────────
  function renderRSIHistory(allLogs) {
    const wrap = document.getElementById('rsi-history-wrap');
    if (!wrap || !allLogs || !allLogs.length) return;
    const logs = [...allLogs].reverse(); // oldest first
    const threshold = 70;
    const thresholdPct = (threshold / 100) * 100;
    wrap.style.position = 'relative';
    wrap.innerHTML = \`<div class="rsi-threshold" style="bottom:\${thresholdPct}%"></div>\` +
      logs.map(run => {
        const rsi = run.indicators?.rsi3 ?? 0;
        const pct = Math.max(3, Math.min(100, (rsi / 100) * 100));
        const color = rsi >= 70 ? 'var(--green)' : 'rgba(248,81,73,0.45)';
        const ago = timeAgo(run.timestamp);
        return \`<div class="rsi-bar-col" title="\${ago}\\nRSI: \${rsi.toFixed(1)}\\n\${run.allPass ? 'TRADE' : 'BLOCKED'}">
          <div class="rsi-bar-val">\${rsi.toFixed(0)}</div>
          <div class="rsi-bar" style="height:\${pct}%;background:\${color}"></div>
        </div>\`;
      }).join('');
  }

  // ── Condition Heatmap ──────────────────────────────────────────────────────
  function renderHeatmap(allLogs) {
    const el = document.getElementById('heatmap-content');
    if (!el || !allLogs || !allLogs.length) return;

    const shortLabel = l => {
      if (l === 'Market bias')              return 'Bias';
      if (l.includes('VWAP') && l.includes('above'))  return 'P>VWAP';
      if (l.includes('VWAP') && l.includes('below'))  return 'P<VWAP';
      if (l.includes('EMA')  && l.includes('above'))  return 'P>EMA';
      if (l.includes('EMA')  && l.includes('below'))  return 'P<EMA';
      if (l.includes('RSI')  && l.includes('30'))      return 'RSI<30';
      if (l.includes('RSI')  && l.includes('50'))      return 'RSI>50↑';
      if (l.includes('RSI')  && l.includes('70'))      return 'RSI>70';
      if (l.includes('1.5%') || l.includes('overext')) return '±VWAP';
      return l.slice(0, 7);
    };

    const simpleLabel = (l) => {
      if (l === 'Market bias')              return 'Direction';
      if (l.includes('VWAP') && l.includes('above'))  return 'Buyers in Control';
      if (l.includes('VWAP') && l.includes('below'))  return 'Sellers in Control';
      if (l.includes('EMA')  && l.includes('above'))  return 'Uptrend';
      if (l.includes('EMA')  && l.includes('below'))  return 'Downtrend';
      if (l.includes('RSI')  && l.includes('30'))      return 'Good Dip';
      if (l.includes('RSI')  && l.includes('50'))      return 'Momentum';
      if (l.includes('RSI')  && l.includes('70'))      return 'Overheated';
      if (l.includes('1.5%') || l.includes('overext')) return 'Not Overextended';
      return l.slice(0, 10);
    };

    const labelSet = new Set();
    for (const run of allLogs) for (const c of (run.conditions || [])) labelSet.add(c.label);
    const labels = [...labelSet];
    const simple = currentView === "simple";

    const header = \`<tr><th>Run</th>\${labels.map(l => \`<th title="\${l}">\${simple ? simpleLabel(l) : shortLabel(l)}</th>\`).join('')}<th>Result</th></tr>\`;

    const rows = allLogs.map(run => {
      const cells = labels.map(label => {
        const cond = (run.conditions || []).find(c => c.label === label);
        if (!cond) return \`<td><span class="hm-cell hm-na">—</span></td>\`;
        return \`<td title="\${label}\\nRequired: \${cond.required}\\nActual: \${cond.actual}"><span class="hm-cell \${cond.pass ? 'hm-pass' : 'hm-fail'}">\${cond.pass ? '✓' : '✗'}</span></td>\`;
      }).join('');
      const res = run.allPass
        ? \`<td><span class="hm-result-pass">\${simple ? "✅ Bought" : "TRADE"}</span></td>\`
        : \`<td><span class="hm-result-fail">\${simple ? "⛔ Skipped" : "BLOCKED"}</span></td>\`;
      return \`<tr><td class="hm-time">\${timeAgo(run.timestamp)}</td>\${cells}\${res}</tr>\`;
    }).join('');

    el.innerHTML = \`<table class="heatmap-table"><thead>\${header}</thead><tbody>\${rows}</tbody></table>\`;
  }

  function renderPosition(position, currentPrice) {
    const card  = document.getElementById("position-card");
    const badge = document.getElementById("position-badge");
    const body  = document.getElementById("position-body");
    if (!card || !badge || !body) return;

    if (!position || !position.open) {
      card.className  = "position-card";
      badge.className = "position-badge-closed";
      badge.textContent = "No Position";
      body.innerHTML = \`<div class="position-no-trade">No open trade — bot is watching for the next entry signal.</div>\`;
      return;
    }

    const price      = currentPrice || position.entryPrice;
    const pnlPct     = ((price - position.entryPrice) / position.entryPrice * 100);
    const pnlUSD     = (pnlPct / 100 * position.tradeSize);
    const pnlSign    = pnlPct >= 0 ? "+" : "";
    const pnlColor   = pnlPct > 0 ? "var(--green)" : pnlPct < 0 ? "var(--red)" : "var(--muted)";

    // Progress bar: position of current price between SL and TP
    const range      = position.takeProfit - position.stopLoss;
    const filled     = Math.min(Math.max((price - position.stopLoss) / range * 100, 0), 100);
    const barColor   = pnlPct >= 0 ? "var(--green)" : "var(--red)";

    const distToSL   = ((price - position.stopLoss)   / position.entryPrice * 100).toFixed(2);
    const distToTP   = ((position.takeProfit - price)  / position.entryPrice * 100).toFixed(2);
    const entryPct   = ((position.entryPrice - position.stopLoss) / range * 100).toFixed(1);

    const lev = position.leverage || 1;
    const glowClass = pnlPct > 0.3 ? " pos-profit" : pnlPct < -0.3 ? " pos-loss" : "";
    card.className  = "position-card pos-open" + glowClass;
    badge.className = "position-badge-open";
    badge.textContent = (position.side === "long" ? "📈 Long" : "📉 Short") + " · " + lev + "x Leverage";

    body.innerHTML = \`
      <div class="position-grid">
        <div>
          <div class="position-item-label">Entry Price</div>
          <div class="position-item-value">$\${position.entryPrice.toFixed(4)}</div>
          <div class="position-item-sub">\${position.entryTime ? (() => { const mins = Math.floor((Date.now() - new Date(position.entryTime).getTime()) / 60000); return mins < 60 ? mins + "m in trade" : Math.floor(mins/60) + "h " + (mins%60) + "m in trade"; })() : "—"}</div>
        </div>
        <div>
          <div class="position-item-label">Current Price</div>
          <div class="position-item-value" style="color:\${pnlColor}">$\${price.toFixed(4)}</div>
          <div class="position-item-sub" style="color:\${pnlColor}">\${pnlSign}\${pnlPct.toFixed(2)}% (\${pnlSign}$\${Math.abs(pnlUSD).toFixed(2)})</div>
        </div>
        <div>
          <div class="position-item-label">🛑 Stop Loss</div>
          <div class="position-item-value" style="color:var(--red)">$\${position.stopLoss.toFixed(4)}</div>
          <div class="position-item-sub">\${distToSL}% · risk $\${(Math.abs((price - position.stopLoss) / position.entryPrice) * (position.tradeSize || 0)).toFixed(2)}</div>
        </div>
        <div>
          <div class="position-item-label">🎯 Take Profit</div>
          <div class="position-item-value" style="color:var(--green)">$\${position.takeProfit.toFixed(4)}</div>
          <div class="position-item-sub">\${distToTP}% to go</div>
        </div>
      </div>
      <div class="position-bar-wrap">
        <div class="position-bar-label">
          <span style="color:var(--red)">SL $\${position.stopLoss.toFixed(4)}</span>
          <span style="color:var(--muted)">← Price range →</span>
          <span style="color:var(--green)">TP $\${position.takeProfit.toFixed(4)}</span>
        </div>
        <div class="position-bar-track">
          <div class="position-bar-fill" style="width:\${filled}%;background:\${barColor}"></div>
          <div class="position-bar-marker" style="left:\${entryPct}%" title="Entry price"></div>
        </div>
      </div>\`;
  }

  function simpleCondLabel(label) {
    if (label.includes("VWAP") && label.includes("above"))   return "Buyers are in control";
    if (label.includes("VWAP") && label.includes("below"))   return "Sellers are in control";
    if (label.includes("EMA")  && label.includes("above"))   return "Price is in an uptrend";
    if (label.includes("EMA")  && label.includes("below"))   return "Price is in a downtrend";
    if (label.includes("RSI")  && label.includes("30"))       return "Waiting for a dip";
    if (label.includes("RSI")  && label.includes("70"))       return "Waiting for a peak";
    if (label.includes("overextended") || label.includes("1.5%")) return "Price is at a safe distance";
    return label;
  }

  function simpleCondNote(c) {
    if (c.pass) return "";
    if (c.label.includes("RSI") && c.label.includes("30"))
      return \`Market is currently overheated (\${parseFloat(c.actual).toFixed(0)}), needs to cool to 30 or below\`;
    if (c.label.includes("RSI") && c.label.includes("70"))
      return \`Market is currently weak (\${parseFloat(c.actual).toFixed(0)}), needs to reach 70 or above\`;
    if (c.label.includes("overextended") || c.label.includes("1.5%"))
      return \`Price is \${c.actual} away from center — too stretched to enter safely\`;
    if (c.label.includes("VWAP")) return "Price needs to be on the right side of the session average";
    if (c.label.includes("EMA"))  return "Price needs to confirm the trend direction";
    return "";
  }

  function renderSafetyCheck(latest) {
    if (!latest) return;
    const el = document.getElementById("safety-content");
    if (!el) return;
    const conditions = latest.conditions.filter(c => c.label !== "Market bias");
    const simple = currentView === "simple";

    const score     = latest.signalScore;
    const ql        = score !== undefined ? signalQualityLabel(score) : null;
    const scoreBanner = ql ? \`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(0,0,0,0.2);border-radius:6px;margin-bottom:8px">
      <span style="font-size:13px;font-weight:700;color:\${ql.color}">\${ql.label}</span>
      <span style="font-size:20px;font-weight:900;color:\${score >= 75 ? "var(--green)" : score >= 55 ? "var(--yellow)" : "var(--red)"}">\${score.toFixed(0)}<span style="font-size:12px;color:var(--muted)">/100</span></span>
    </div>\` : "";
    const vol = latest.volatility;
    const lev = latest.effectiveLeverage;
    const volBanner = vol
      ? (vol.stable
          ? \`<div class="decision-banner" style="background:rgba(63,185,80,0.08);border-color:rgba(63,185,80,0.2);color:var(--green);margin-bottom:8px">✅ Market is stable — \${lev}x leverage active (spike ratio: \${vol.spikeRatio}x ATR)</div>\`
          : \`<div class="decision-banner" style="background:rgba(210,153,34,0.08);border-color:rgba(210,153,34,0.3);color:var(--yellow);margin-bottom:8px">⚠️ Market is chaotic — leverage disabled, using 1x only (spike ratio: \${vol.spikeRatio}x ATR)</div>\`)
      : "";
    // Classify the block reason for clarity
    function classifyBlock(latest) {
      const failed = (latest.conditions || []).filter(c => !c.pass);
      const labels = failed.map(c => c.label || "");
      if (labels.some(l => l.toLowerCase().includes("regime") || l.toLowerCase().includes("volatil")))     return { type: "REGIME",   text: "Blocked by REGIME — volatile market" };
      if (labels.some(l => l.toLowerCase().includes("liquidation")))                                       return { type: "SAFETY",   text: "Blocked by SAFETY — liquidation risk" };
      if (labels.some(l => l.toLowerCase().includes("daily trade limit") || l.toLowerCase().includes("daily limit"))) return { type: "LIMIT", text: "Blocked by LIMIT — daily max reached" };
      if (latest.holding) return { type: "HOLDING", text: "Holding position — monitoring SL/TP" };
      return { type: "SIGNAL", text: "Blocked by SIGNAL (not regime) — score below threshold" };
    }
    const block = classifyBlock(latest);

    const decisionHtml = latest.allPass
      ? \`\${scoreBanner}\${volBanner}<div class="decision-banner decision-pass">\${simple ? "✅ Ready to buy — all signals are aligned" : "✅ All conditions met — trade would fire"}</div>\`
      : \`\${scoreBanner}\${volBanner}\` + (simple
        ? \`<div class="decision-banner decision-fail">⏳ Waiting — not the right entry point yet</div>\`
        : \`<div class="decision-banner decision-fail">⛔ \${block.text}\${block.type === "SIGNAL" && latest.signalScore !== undefined ? " (\" + latest.signalScore.toFixed(0) + \"/75)" : ""}</div>\`);

    // Map each condition to its max possible score
    const condMaxScore = (label) => {
      if (label.includes("EMA"))         return 30;
      if (label.includes("RSI"))         return 30;
      if (label.includes("VWAP"))        return 20;
      if (label.includes("Overextended")) return 20;
      return 0;
    };

    const condHtml = conditions.length === 0
      ? \`<div class="empty-state">No conditions evaluated</div>\`
      : conditions.map(c => {
          const note = simple ? simpleCondNote(c) : "";
          const score = c.score !== undefined ? c.score : (c.pass ? condMaxScore(c.label) : 0);
          const maxS  = condMaxScore(c.label) || 30;
          const pct   = maxS > 0 ? (score / maxS) : 0;
          let icon, badge, badgeColor;
          if (pct >= 0.95)      { icon = "✅"; badge = "full confidence";    badgeColor = "var(--green)"; }
          else if (pct >= 0.5)  { icon = "🟡"; badge = "high confidence";    badgeColor = "var(--green)"; }
          else if (pct > 0)     { icon = "⚠️"; badge = "partial confidence"; badgeColor = "var(--yellow)"; }
          else                  { icon = "🚫"; badge = "no signal";          badgeColor = "var(--red)"; }
          const cls = pct >= 0.5 ? "cond-pass" : "cond-fail";
          return \`
          <div class="condition \${cls}">
            <span class="cond-icon">\${icon}</span>
            <div class="cond-text">
              <div class="cond-label" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
                <span>\${simple ? simpleCondLabel(c.label) : c.label}</span>
                <span style="font-family:ui-monospace,monospace;font-size:12px;font-weight:700;color:\${badgeColor}">+\${score.toFixed(0)} / \${maxS} <span style="font-size:10px;font-weight:500;opacity:0.8">(\${badge})</span></span>
              </div>
              \${simple
                ? (note ? \`<div class="cond-detail">\${note}</div>\` : "")
                : \`<div class="cond-detail">Required: \${c.required} &nbsp;·&nbsp; Actual: \${c.actual}</div>\`}
            </div>
          </div>\`;
        }).join("");

    const dlRaw = latest.decisionLog || "";
    const dlHtml = dlRaw ? \`<div class="decision-log-box"><span class="\${latest.allPass ? "dl-trade" : "dl-skip"}">\${dlRaw.replace(/\\|/g, "<br>")}</span></div>\` : "";
    el.innerHTML = decisionHtml + condHtml + dlHtml;
  }

  function plainBlockReason(run) {
    const failed = (run.conditions || []).filter(c => !c.pass);
    if (!failed.length) return "Conditions not met";
    const f = failed[0];
    if (f.label === "Market bias") {
      const p = run.price, e = run.indicators?.ema8, v = run.indicators?.vwap;
      const aboveEma = p > e, aboveVwap = p > v;
      if (aboveEma && !aboveVwap) return "Price above EMA but below VWAP — mixed signals, no clear direction";
      if (!aboveEma && aboveVwap) return "Price above VWAP but below EMA — mixed signals, no clear direction";
      return "Price is stuck between VWAP and EMA(8) — market has no clear direction";
    }
    if (f.label.includes("RSI")) {
      const rsi = run.indicators?.rsi3;
      const needed = f.label.includes("below 30") ? "below 30 for a pullback entry" : "above 70 for a reversal entry";
      return \`RSI(3) is \${rsi !== null && rsi !== undefined ? rsi.toFixed(1) : "?"} — needs to be \${needed}\`;
    }
    if (f.label.includes("VWAP")) return \`Price not in the right position relative to VWAP (needed \${f.required}, got \${f.actual})\`;
    if (f.label.includes("EMA"))  return \`Price not confirming the trend via EMA(8) (needed \${f.required}, got \${f.actual})\`;
    if (f.label.includes("overextended")) return \`Price is too far from VWAP to enter safely (\${f.actual} away, limit is 1.5%)\`;
    return \`\${f.label} — needed \${f.required}, got \${f.actual}\`;
  }

  function tradeLog(msg, type = "ok") {
    const log = document.getElementById("trade-log");
    if (!log) return;
    const ts   = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const div  = document.createElement("div");
    div.className = "trade-log-entry trade-log-" + type;
    div.textContent = "[" + ts + "] " + msg;
    log.insertBefore(div, log.firstChild);
  }

  // Phase 6b — after a successful trade, fetch /api/data once and re-render
  // so the UI reflects new position/control/balance immediately instead of
  // waiting up to 5s for the next SSE tick. SSE keeps running normally; this
  // is just an extra one-shot. In-flight guard prevents rapid trades from
  // stacking refreshes.
  let _tradeRefreshInflight = false;
  async function refreshAfterTrade() {
    if (_tradeRefreshInflight) return;
    _tradeRefreshInflight = true;
    try {
      const data = await safeJson("/api/data");
      if (data) render(data);
    } catch (e) {
      // SSE will catch up; suppress noise here.
      console.warn("[refreshAfterTrade]", e.message);
    } finally {
      _tradeRefreshInflight = false;
    }
  }

  async function tradeCmd(command, params = {}, _btn) {
    // Phase 5b — button lock. Capture btn synchronously before any await.
    const release = lockBtn(_btn !== undefined ? _btn : _activeBtn());
    try {
    // LIVE mode safety gate — every market action requires CONFIRM
    const isPaper = lastRenderData?.control?.paperTrading !== false;
    const liveActions = ["BUY_MARKET", "OPEN_LONG", "CLOSE_POSITION", "SELL_ALL"];
    if (!isPaper && liveActions.includes(command)) {
      const labels = {
        BUY_MARKET:     "BUY XRP at market",
        OPEN_LONG:      "OPEN LONG with " + (params.leverage || 2) + "× leverage",
        CLOSE_POSITION: "CLOSE your open position",
        SELL_ALL:       "SELL ALL XRP holdings",
      };
      const ok = await showModal({
        icon: "🔴",
        title: "Type CONFIRM to execute live trade",
        msg: "<strong style='color:var(--red)'>This is a LIVE trade with real money.</strong><br>Action: <strong style='color:var(--text)'>" + (labels[command] || command) + "</strong>",
        confirmText: "Execute Live Trade",
        requireText: "CONFIRM",
      });
      if (!ok) { tradeLog("❌ Cancelled — " + command, "err"); showToast("Live trade cancelled", "info"); return; }
      showToast("⚡ Executing live trade: " + command, "warn");
    }

    tradeLog("⏳ " + command + "...", "ok");
    try {
      // Phase 3 — live trades require server-side confirm. The modal above
      // already gated the action with typed CONFIRM; forward it in the body.
      const tradeBody = { command, params };
      if (!isPaper && liveActions.includes(command)) tradeBody.confirm = "CONFIRM";
      const res  = await fetch("/api/trade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tradeBody) });
      const data = await res.json();
      if (data.ok || data.message) {
        tradeLog("✅ " + (data.message || command + " OK"), "ok");
        if (!isPaper) showToast("✅ Live trade executed", "success");
        refreshAfterTrade();
      } else {
        tradeLog("❌ " + data.error, "err");
        showToast("❌ Trade failed: " + data.error, "error");
      }
    } catch (e) {
      tradeLog("❌ " + e.message, "err");
      showToast("❌ " + e.message, "error");
    }
    } finally { release(); }
  }

  async function confirmTrade(command, message) {
    // Phase 5a — typed CONFIRM in live mode for CLOSE_POSITION / SELL_ALL.
    // Existing tradeCmd live guard remains as defense-in-depth.
    const isPaper = lastRenderData?.control?.paperTrading !== false;
    const ok = await showModal({
      icon: "⚠",
      title: "Confirm trade action",
      msg: message,
      confirmText: "Execute",
      requireText: isPaper ? null : "CONFIRM",
    });
    if (ok) tradeCmd(command);
  }

  // ── Bot Mode Presets ────────────────────────────────────────────────────
  const BOT_MODE_PRESETS = {
    conservative: { riskPct: 0.5, leverage: 1, label: "Conservative" },
    balanced:     { riskPct: 1.0, leverage: 2, label: "Balanced" },
    aggressive:   { riskPct: 2.0, leverage: 3, label: "Aggressive" },
  };

  // Phase 5d — small inline /api/control helper for the preset flow only.
  // Returns { ok, data?, error? } so applyBotMode can decide what to render
  // and what to toast. Mirrors the error-handling pattern from setCapital.
  async function _applyPresetCmd(command, value) {
    try {
      const res = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, value }),
      });
      if (!res.ok)           return { ok: false, error: "HTTP " + res.status };
      const data = await res.json();
      if (data.ok === false) return { ok: false, error: data.error || "unknown" };
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function applyBotMode(mode) {
    const preset = BOT_MODE_PRESETS[mode];
    if (!preset) return;
    if (mode === "aggressive") {
      const ok = await showModal({
        icon: "🔥", title: "Switch to Aggressive mode?",
        msg: "<strong style='color:var(--red)'>This increases risk to 2% per trade and leverage to 3×.</strong> Use only after validating in paper mode.",
        confirmText: "Apply Aggressive"
      });
      if (!ok) return;
    }
    // Phase 5d — atomic preset application. Lock all 3 preset buttons for
    // the FULL await chain (no fixed setTimeout). Apply SET_RISK then
    // SET_LEVERAGE sequentially. Mark the visual "active" state ONLY after
    // both succeed. On any failure, show error toast and leave the existing
    // active class untouched — the next SSE highlightActiveBotMode tick will
    // reflect actual server state.
    const presetBtns = [...document.querySelectorAll(".bot-mode-btn")];
    const releases = presetBtns.map(b => lockBtn(b));
    try {
      const r1 = await _applyPresetCmd("SET_RISK", String(preset.riskPct));
      if (!r1.ok) { showToast("Preset failed: SET_RISK — " + r1.error, "error"); return; }
      const r2 = await _applyPresetCmd("SET_LEVERAGE", String(preset.leverage));
      if (!r2.ok) { showToast("Preset failed: SET_LEVERAGE — " + r2.error, "error"); return; }
      // Both succeeded — now mark active visually + sync control panel.
      document.querySelectorAll(".bot-mode-btn").forEach(b => b.classList.remove("active"));
      document.getElementById("mode-preset-" + mode)?.classList.add("active");
      if (r2.data?.control) renderControl(r2.data.control);
      showToast("⚙️ Mode preset applied: " + preset.label, "success");
    } finally {
      releases.forEach(r => r());
    }
  }

  function highlightActiveBotMode(ctrl) {
    if (!ctrl) return;
    document.querySelectorAll(".bot-mode-btn").forEach(b => b.classList.remove("active"));
    const r = parseFloat(ctrl.riskPct), l = parseInt(ctrl.leverage);
    let mode = null;
    if (r === 0.5 && l === 1) mode = "conservative";
    else if (r === 1   && l === 2) mode = "balanced";
    else if (r === 2   && l === 3) mode = "aggressive";
    if (mode) document.getElementById("mode-preset-" + mode)?.classList.add("active");
  }

  function commandSuccessMessage(command, value, ctrl) {
    const messages = {
      START_BOT:               () => "✅ Bot started",
      STOP_BOT:                () => "⛔ Bot stopped",
      PAUSE_TRADING:           () => "⏸ Trading paused",
      RESUME_TRADING:          () => "▶ Trading resumed",
      SET_MODE_PAPER:          () => "📋 Switched to PAPER mode",
      SET_MODE_LIVE:           () => "🔴 Switched to LIVE mode — real money active",
      SET_LEVERAGE:            () => "✅ Leverage updated to " + (ctrl?.leverage || value) + "×",
      SET_RISK:                () => "✅ Risk updated to " + (ctrl?.riskPct || value) + "%",
      SET_MAX_DAILY_LOSS:      () => "✅ Max daily loss set to " + (ctrl?.maxDailyLossPct || value) + "%",
      SET_COOLDOWN:            () => "✅ Cooldown set to " + (ctrl?.cooldownMinutes || value) + " min",
      SET_KILL_DRAWDOWN:       () => "✅ Kill switch threshold set to " + (ctrl?.killSwitchDrawdownPct || value) + "%",
      SET_PAUSE_LOSSES:        () => "✅ Pause-after-losses set to " + (ctrl?.pauseAfterLosses || value),
      KILL_NOW:                () => "🚨 Kill switch activated — bot halted. Reset from Bot Controls when ready.",
      RESET_KILL_SWITCH:       () => "🔓 Kill switch reset",
      RESET_COOLDOWN:          () => "⏩ Cooldown skipped",
      RESET_LOSSES:            () => "↺ Loss counter reset",
      SET_XRP_ROLE:            () => "✅ XRP role: " + value,
      SET_AUTO_CONVERT:        () => "✅ Auto-conversion " + (value === "true" ? "ON" : "OFF"),
      SET_ACTIVE_PCT:          () => "✅ Active capital set to " + value + "%",
    };
    const fn = messages[command];
    return fn ? fn() : "✅ " + command + " applied";
  }

  // ── Emergency Kill (top-nav button) ──────────────────────────────────────
  // Hard-stop the bot now. Reuses showModal's requireText guard so the
  // operator has to type "KILL" to confirm — prevents accidental clicks.
  // After confirm, sends KILL_NOW via the existing /api/control endpoint.
  async function confirmEmergencyKill() {
    const ok = await showModal({
      icon: "🚨",
      title: "Emergency Kill — bot will halt immediately",
      msg: "This activates the kill switch. The bot will <strong>stop trading</strong> until you manually reset it from Bot Controls. Type <strong>KILL</strong> below to confirm.",
      confirmText: "Activate Kill Switch",
      requireText: "KILL",
    });
    if (!ok) return;
    try {
      // Phase C-0 — pass typed "KILL" to satisfy the new server-side gate.
      await sendCmd("KILL_NOW", undefined, undefined, "KILL");
      // sendCmd already updates status pills + shows toast on success.
    } catch (e) {
      showToast("Kill switch failed: " + (e?.message || "unknown error"), "error");
    }
  }

  // Phase 5a — STOP_BOT confirmation (light, reversible by START_BOT).
  async function confirmStop() {
    const ok = await showModal({
      icon: "⛔",
      title: "Stop the bot?",
      msg: "The bot will halt trading until you click <strong>Start Bot</strong>. Any open position remains untouched.",
      confirmText: "Stop Bot",
    });
    if (ok) sendCmd("STOP_BOT");
  }

  // Phase 5a — RESET_KILL_SWITCH confirmation. Live mode requires typed
  // CONFIRM because resetting re-enables real-money trading.
  async function confirmResetKill() {
    const isPaper = lastRenderData?.control?.paperTrading !== false;
    const ok = await showModal({
      icon: "🔓",
      title: "Reset kill switch?",
      msg: isPaper
        ? "This re-enables trading after a forced halt. The bot can resume placing trades on its next cycle."
        : "<strong style='color:var(--red)'>This re-enables LIVE trading.</strong> The bot can resume placing real-money orders on its next cycle. Type <strong>CONFIRM</strong> below.",
      confirmText: "Reset Kill Switch",
      requireText: isPaper ? null : "CONFIRM",
    });
    if (ok) sendCmd("RESET_KILL_SWITCH", undefined, undefined, isPaper ? undefined : "CONFIRM");
  }

  // Phase 5e — client-side validation for SET_* numeric inputs. Mirrors the
  // server's Math.min/max clamp ranges so bad input is rejected early with a
  // toast (server still validates as the source of truth — this is preflight
  // polish only). Single-quoted strings only — this is inside a backtick
  // template, where escape sequences like \" collapse to literal " on the
  // wire and would break the toast call.
  function sendNum(command, inputId, min, max, label, isInt) {
    const el = document.getElementById(inputId);
    const raw = el ? el.value : '';
    const n = isInt ? parseInt(raw, 10) : parseFloat(raw);
    if (Number.isNaN(n) || n < min || n > max) {
      showToast(label + ' must be ' + min + '–' + max + ' (got: ' + raw + ')', 'error');
      return;
    }
    sendCmd(command, String(n));
  }

  async function sendCmd(command, value, _btn, _confirm) {
    // Phase 5b — button lock. Capture btn synchronously before any await.
    const release = lockBtn(_btn !== undefined ? _btn : _activeBtn());
    try {
      const body = value !== undefined ? { command, value } : { command };
      // Phase 3 — forward typed-confirm token for live-trigger commands.
      if (_confirm) body.confirm = _confirm;
      const res  = await fetch("/api/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.ok) {
        renderControl(data.control);
        const msg = commandSuccessMessage(command, value, data.control);
        const type = command === "SET_MODE_LIVE" ? "warn" : command === "STOP_BOT" || command === "PAUSE_TRADING" ? "warn" : "success";
        showToast(msg, type);
      }
      else showToast("Command failed: " + data.error, "error");
    } catch (e) { showToast("Error: " + e.message, "error"); }
    finally { release(); }
  }

  async function confirmLive() {
    const ok = await showModal({
      icon: "🔴", title: "Switch to LIVE mode?",
      msg: "<strong style='color:var(--red)'>Real money will be used.</strong> Your next trade signal will place a real order on Kraken. The bot still uses your kill switch and stop loss protections.",
      confirmText: "Go LIVE", requireText: "CONFIRM"
    });
    if (ok) { sendCmd("SET_MODE_LIVE", undefined, undefined, "CONFIRM"); showToast("Switched to LIVE mode — real money active", "warn"); }
    else showToast("Cancelled — still in Paper mode", "info");
  }

  function renderControl(ctrl) {
    if (!ctrl) return;

    // Persist to localStorage for instant UI restore on next page load
    try {
      // Simple key for trading mode (matches user pattern)
      localStorage.setItem("tradingMode", ctrl.paperTrading === false ? "LIVE" : "PAPER");
      // Full snapshot for richer restoration
      localStorage.setItem("agent_avila_ctrl", JSON.stringify({
        paperTrading: ctrl.paperTrading,
        stopped: ctrl.stopped,
        paused: ctrl.paused,
        killed: ctrl.killed,
        leverage: ctrl.leverage,
        riskPct: ctrl.riskPct,
      }));
    } catch {}

    const set = (id, text, cls) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.className = "ctrl-badge " + cls;
    };
    set("ctrl-badge-running",  ctrl.stopped  ? "⛔ STOPPED"  : "▶ RUNNING",          ctrl.stopped  ? "ctrl-badge-red"    : "ctrl-badge-green");
    set("ctrl-badge-mode",     ctrl.paperTrading !== false ? "📋 PAPER" : "🔴 LIVE", ctrl.paperTrading !== false ? "ctrl-badge-blue" : "ctrl-badge-red");
    set("ctrl-badge-paused",   ctrl.paused   ? "⏸ PAUSED"  : "✅ ACTIVE",           ctrl.paused   ? "ctrl-badge-yellow" : "ctrl-badge-green");
    set("ctrl-badge-killed",   ctrl.killed   ? "🚨 KILLED"  : "🛡 Safe",             ctrl.killed   ? "ctrl-badge-red"    : "ctrl-badge-green");
    set("ctrl-badge-leverage", (ctrl.leverage || 2) + "× Lev",                        "ctrl-badge-blue");
    set("ctrl-badge-risk",     "Risk " + (ctrl.riskPct || 1) + "%",                   "ctrl-badge-muted");
    set("ctrl-badge-losses",   (ctrl.consecutiveLosses || 0) + " consec losses",      (ctrl.consecutiveLosses || 0) >= 2 ? "ctrl-badge-yellow" : "ctrl-badge-muted");
    set("ctrl-badge-cooldown", ctrl.lastTradeTime ? "⏳ Cooldown" : "✅ No cooldown", ctrl.lastTradeTime ? "ctrl-badge-yellow" : "ctrl-badge-muted");

    const inputs = { "ctrl-leverage-val": ctrl.leverage, "ctrl-risk-val": ctrl.riskPct, "ctrl-dailyloss-val": ctrl.maxDailyLossPct, "ctrl-cooldown-val": ctrl.cooldownMinutes, "ctrl-killpct-val": ctrl.killSwitchDrawdownPct, "ctrl-pauselosses-val": ctrl.pauseAfterLosses };
    for (const [id, val] of Object.entries(inputs)) {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    }

    const modeLabel = document.getElementById("trade-mode-label");
    if (modeLabel) {
      modeLabel.textContent = ctrl.paperTrading !== false ? "📋 PAPER MODE" : "🔴 LIVE MODE";
      modeLabel.style.color = ctrl.paperTrading !== false ? "var(--blue)" : "var(--red)";
    }

    // Mode banner at top of dashboard
    const banner = document.getElementById("mode-banner");
    if (banner) {
      if (ctrl.paperTrading === false) {
        banner.className = "mode-banner mode-live";
        banner.innerHTML = '<span class="mode-banner-icon">🔴</span><span class="mode-banner-text"><strong>LIVE MODE</strong> — Real money is being used. Trades execute on Kraken.</span>';
      } else {
        banner.className = "mode-banner mode-paper";
        banner.innerHTML = '<span class="mode-banner-icon">🔒</span><span class="mode-banner-text"><strong>PAPER MODE</strong> — Real trading disabled. Bot uses simulated funds only.</span>';
      }
    }

    // Kraken Balance badge — make it clear what data the bot uses
    const balBadge = document.getElementById("balance-mode-badge");
    if (balBadge) {
      if (ctrl.paperTrading === false) {
        balBadge.textContent = "🟢 LIVE TRADING ACTIVE · BOT USES THIS BALANCE";
        balBadge.className = "ctrl-badge ctrl-badge-green";
      } else {
        balBadge.textContent = "🔴 LIVE EXCHANGE DATA · NOT USED IN PAPER MODE";
        balBadge.className = "ctrl-badge ctrl-badge-yellow";
      }
    }

    // Highlight active state buttons + disable redundant clicks
    const setActive = (id, active, color) => {
      const el = document.getElementById(id);
      if (!el) return;
      ["is-active-green","is-active-red","is-active-yellow","is-active-blue"].forEach(c => el.classList.remove(c));
      if (active) {
        el.classList.add("is-active-" + color);
        el.disabled = true;
        el.style.cursor = "default";
        el.style.opacity = "0.85";
      } else {
        el.disabled = false;
        el.style.cursor = "pointer";
        el.style.opacity = "1";
      }
    };
    setActive("btn-start",      !ctrl.stopped, "green");
    setActive("btn-stop",        ctrl.stopped, "red");
    setActive("btn-pause",       ctrl.paused,  "yellow");
    setActive("btn-resume",     !ctrl.paused,  "green");
    setActive("btn-mode-paper",  ctrl.paperTrading !== false, "blue");
    setActive("btn-mode-live",   ctrl.paperTrading === false, "red");
    highlightActiveBotMode(ctrl);
  }

  // Restore control state from localStorage immediately on page load (before SSE arrives)
  try {
    // Try full snapshot first (richer state)
    const cached = JSON.parse(localStorage.getItem("agent_avila_ctrl") || "null");
    if (cached) {
      renderControl(cached);
    } else {
      // Fallback to simple tradingMode key
      const mode = localStorage.getItem("tradingMode") || "PAPER";
      renderControl({ paperTrading: mode !== "LIVE" });
    }
  } catch {}

  // ── Toast Notifications ───────────────────────────────────────────────────
  function showToast(msg, type) {
    type = type || "info";
    const c = document.getElementById("toast-container");
    if (!c) return;
    const div = document.createElement("div");
    div.className = "toast toast-" + type;
    const icons = { success: "✅", error: "❌", info: "ℹ️", warn: "⚠️" };
    div.innerHTML = '<span class="toast-icon">' + (icons[type] || "ℹ️") + '</span><span class="toast-msg">' + msg + '</span>';
    c.appendChild(div);
    setTimeout(() => { div.classList.add("toast-out"); setTimeout(() => div.remove(), 300); }, 3500);
  }

  // ── Custom Confirm Modal ──────────────────────────────────────────────────
  let modalAction = null;
  function showModal(opts) {
    // If another modal is already open, resolve it as cancelled before
    // opening the new one so the previous promise doesn't hang forever.
    if (modalAction) modalAction(false);
    return new Promise(resolve => {
      const o = document.getElementById("modal-overlay");
      document.getElementById("modal-icon").textContent  = opts.icon  || "⚠";
      document.getElementById("modal-title").textContent = opts.title || "Confirm action";
      document.getElementById("modal-msg").innerHTML     = opts.msg   || "Are you sure?";
      const input = document.getElementById("modal-input");
      const btn   = document.getElementById("modal-confirm-btn");
      btn.textContent = opts.confirmText || "Confirm";
      if (opts.requireText) {
        input.style.display = ""; input.value = "";
        input.placeholder = 'Type "' + opts.requireText + '"';
        btn.disabled = true;
        input.oninput = () => { btn.disabled = input.value.trim() !== opts.requireText; };
        setTimeout(() => input.focus(), 100);
      } else {
        input.style.display = "none"; btn.disabled = false;
      }
      // Single owner: lambda closes the overlay AND resolves the promise.
      // closeModal/confirmModalAction just delegate. No callbacks back into
      // closeModal -> avoids the infinite recursion that froze the page.
      // Setting modalAction = null FIRST means a fast double-click on
      // Cancel/Confirm becomes a no-op on the second click.
      modalAction = (confirmed) => {
        modalAction = null;
        o.classList.remove("open");
        resolve(confirmed);
      };
      o.classList.add("open");
    });
  }
  function closeModal()         { if (modalAction) modalAction(false); }
  function confirmModalAction() { if (modalAction) modalAction(true);  }

  // Phase 5b — button lock helper. Disables the triggering button while a
  // request is in flight and releases on settle. _activeBtn() reads
  // window.event SYNCHRONOUSLY at handler entry (before any await) so async
  // drift can't lock the wrong target. Callers in chained flows (e.g.
  // applyBotMode → sendCmd) pass an explicit btn (or null) to override.
  function lockBtn(btn) {
    if (!btn || btn.disabled) return () => {};
    btn.disabled = true;
    // Phase 8b — visible spinner so the in-flight state is obvious. Save and
    // restore innerHTML so any inline child (icons, badges, etc) is preserved.
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span>' + original;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      btn.disabled = false;
      btn.innerHTML = original;
    };
  }
  function _activeBtn() {
    const e = (typeof window !== "undefined") ? window.event : null;
    const t = e && (e.currentTarget || e.target);
    return (t && typeof t === "object" && "disabled" in t) ? t : null;
  }
  // ESC closes modal
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const o = document.getElementById("modal-overlay");
      if (o && o.classList.contains("open")) closeModal();
    }
  });

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  document.addEventListener("keydown", async e => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (e.key === "k") {
      e.preventDefault(); toggleChat(); showToast("Chat toggled", "info");
    } else if (e.key === "p") {
      e.preventDefault();
      const ctrl = lastRenderData?.control || {};
      if (ctrl.paused) { sendCmd("RESUME_TRADING"); showToast("Trading resumed", "success"); }
      else             { sendCmd("PAUSE_TRADING");  showToast("Trading paused", "warn"); }
    } else if (e.key === "l") {
      e.preventDefault();
      const ctrl = lastRenderData?.control || {};
      if (ctrl.paperTrading === false) {
        sendCmd("SET_MODE_PAPER"); showToast("Switched to PAPER mode", "info");
      } else {
        const ok = await showModal({
          icon: "🔴", title: "Switch to LIVE mode?",
          msg: "<strong style='color:var(--red)'>Real money will be used.</strong> Your next trade signal will place a real order on Kraken with leverage.",
          confirmText: "Go LIVE", requireText: "CONFIRM"
        });
        if (ok) { sendCmd("SET_MODE_LIVE", undefined, undefined, "CONFIRM"); showToast("Switched to LIVE mode — real money active", "warn"); }
      }
    }
  });

  // ── Nav Drawer ────────────────────────────────────────────────────────────
  function toggleNav() {
    const drawer = document.getElementById("nav-drawer");
    const overlay = document.getElementById("nav-overlay");
    const open = drawer.classList.toggle("open");
    overlay.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    if (open) {
      // Focus first nav item for keyboard users
      drawer.querySelector(".nav-item")?.focus?.();
    }
  }
  function closeNav() {
    const drawer = document.getElementById("nav-drawer");
    drawer.classList.remove("open");
    document.getElementById("nav-overlay").classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
  }
  // Escape key closes the drawer when open
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.getElementById("nav-drawer")?.classList.contains("open")) {
      closeNav();
    }
  });
  // Make <a class="nav-item"> elements keyboard-activatable
  document.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target?.classList?.contains("nav-item")) {
      e.preventDefault();
      e.target.click();
    }
  });
  function navTo(sectionId) {
    closeNav();
    // All nav-items target sections inside #dashboard-page. If we're on the
    // Agent 3.0 (info) tab, switch back to dashboard first so scrollIntoView
    // actually has a visible target.
    const onInfoTab = document.getElementById("info-page")?.style.display !== "none"
                   && document.getElementById("info-page")?.style.display !== "";
    if (onInfoTab) switchTab("dashboard");
    // Defer scroll one frame so layout reflows after the tab swap
    requestAnimationFrame(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    const activeItem = document.querySelector(\`[onclick="navTo('\${sectionId}')"]\`);
    if (activeItem) activeItem.classList.add("active");
  }

  // ── System Health Monitor ─────────────────────────────────────────────────
  let wsConnected = false;
  // Vestigial flag referenced by updateHealthPanel below — its declaration
  // was removed in an earlier refactor but two read sites stayed. Default
  // to true so the existing "downgrade health when chart fails" branch
  // stays inert (matches behavior pre-bug, since the throw used to skip it).
  let chartOk = true;

  function updateHealthPanel(krakenOk, krakenLatency, lastRunAge, wsOk) {
    const set = (id, text, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = text; el.className = "health-check-status " + cls; };
    // Standard status badges: 🟢 DATA OK / 🟡 PARTIAL / 🔴 ERROR
    set("hc-api", krakenOk ? "🟢 DATA OK" : "🔴 ERROR", krakenOk ? "health-ok" : "health-fail");
    const latEl = document.getElementById("hc-api-latency");
    if (latEl) latEl.textContent = krakenOk ? krakenLatency + "ms" : "Connection failed";
    set("hc-ws",  wsOk ? "🟢 DATA OK" : "🟡 PARTIAL", wsOk ? "health-ok" : "health-warn");
    const wsDetail = document.getElementById("hc-ws-detail");
    if (wsDetail) wsDetail.textContent = wsOk ? "Real-time feed active" : "Reconnecting...";
    const fresh = lastRunAge !== null;
    set("hc-data", fresh ? (lastRunAge <= 10 ? "🟢 DATA OK" : lastRunAge <= 30 ? "🟡 PARTIAL" : "🔴 ERROR") : "🟡 PARTIAL", fresh ? (lastRunAge <= 10 ? "health-ok" : lastRunAge <= 30 ? "health-warn" : "health-fail") : "health-warn");
    const ageEl = document.getElementById("hc-data-age");
    if (ageEl) ageEl.textContent = fresh ? lastRunAge + " min ago" : "No data yet";
    const botOk = fresh && lastRunAge <= 15;
    set("hc-bot", botOk ? "🟢 DATA OK" : fresh ? "🟡 PARTIAL" : "🔴 ERROR", botOk ? "health-ok" : fresh ? "health-warn" : "health-fail");
    const botDetail = document.getElementById("hc-bot-detail");
    if (botDetail) botDetail.textContent = botOk ? "On schedule (5m)" : fresh ? "Last run > 15m ago" : "Bot has not run yet";
    const navDot = document.getElementById("nav-drawer-health-dot");
    if (navDot) {
      const allOk = krakenOk && wsOk && botOk && chartOk;
      navDot.style.background = allOk ? "var(--green)" : (krakenOk && botOk) ? "var(--yellow)" : "var(--red)";
    }
    // Track chart status as part of health
    if (!chartOk) {
      const dataEl = document.getElementById("hc-data");
      if (dataEl && dataEl.textContent === "🟢 DATA OK") {
        dataEl.textContent = "🟡 PARTIAL"; dataEl.className = "health-check-status health-warn";
        const ageEl = document.getElementById("hc-data-age");
        if (ageEl) ageEl.textContent = "Chart load failed";
      }
    }
  }

  // Latest health snapshot — populated by runHealthCheck, read by renderTradingStatus.
  // Allows the banner to combine SSE-driven render data + /api/health polling.
  let lastHealth = { krakenOk: true, lastRunAge: null };

  // ── Trading Status banner ─────────────────────────────────────────────────
  // Single answer to "can the bot trade right now?". Priority order: most
  // severe blocker wins. Reads control flags + recent trades from
  // lastRenderData; reads kraken/health from lastHealth (set by runHealthCheck).
  function renderTradingStatus() {
    const el     = document.getElementById("trading-status");
    const icon   = document.getElementById("trading-status-icon");
    const text   = document.getElementById("trading-status-text");
    if (!el || !icon || !text) return;

    const data = lastRenderData || {};
    const ctrl = data.control || {};
    const recent = Array.isArray(data.recentTrades) ? data.recentTrades : [];

    // Severity-ordered checks. First match wins.
    let state = "ready", iconCh = "✅", reason = "Ready — bot can trade if a valid signal appears";

    if (ctrl.killed) {
      state = "blocked"; iconCh = "🚨"; reason = "BLOCKED — Kill switch active";
    } else if (ctrl.stopped) {
      state = "blocked"; iconCh = "⛔"; reason = "BLOCKED — Bot stopped";
    } else if (ctrl.paused) {
      state = "blocked"; iconCh = "⏸"; reason = "BLOCKED — Bot paused";
    } else if (lastHealth.krakenOk === false) {
      state = "blocked"; iconCh = "🔴"; reason = "BLOCKED — Kraken offline";
    } else if (lastHealth.lastRunAge !== null && lastHealth.lastRunAge > 15) {
      state = "blocked"; iconCh = "⚠️"; reason = "BLOCKED — Bot data stale (last run " + lastHealth.lastRunAge.toFixed(0) + " min ago)";
    } else {
      // Cooldown
      if (ctrl.lastTradeTime && ctrl.cooldownMinutes) {
        const elapsedMin = (Date.now() - new Date(ctrl.lastTradeTime).getTime()) / 60000;
        if (elapsedMin < ctrl.cooldownMinutes) {
          state = "blocked"; iconCh = "⏳"; reason = "BLOCKED — Cooldown active (" + Math.ceil(ctrl.cooldownMinutes - elapsedMin) + " min remaining)";
        }
      }
      // Daily loss limit (only if not already blocked)
      if (state === "ready" && ctrl.maxDailyLossPct) {
        const today = new Date().toISOString().slice(0, 10);
        const realizedToday = recent
          .filter(function(t) { return t.type === "EXIT" && t.timestamp && t.timestamp.slice(0,10) === today && t.exitReason !== "REENTRY_SIGNAL"; })
          .reduce(function(s, t) { return s + parseFloat(t.pnlUSD || 0); }, 0);
        const startBalance = 100; // mirrors PAPER_STARTING_BALANCE default
        const maxLossUSD = startBalance * (ctrl.maxDailyLossPct / 100);
        if (realizedToday < 0 && Math.abs(realizedToday) >= maxLossUSD) {
          state = "blocked"; iconCh = "🛑"; reason = "BLOCKED — Daily loss limit reached";
        }
      }
      // Pending exit retry from a failed live SELL (C-1 path)
      if (state === "ready") {
        const lastEntry = recent[recent.length - 1];
        if (lastEntry && typeof lastEntry.exitReason === "string" && lastEntry.exitReason.indexOf("FAILED_RETRY_PENDING") !== -1) {
          state = "blocked"; iconCh = "🔁"; reason = "BLOCKED — Exit retry pending (last live SELL did not confirm fill)";
        }
      }
    }

    // Paper mode is its own visual state — bot trades simulated orders, but
    // no live execution will fire. Distinct yellow styling.
    if (state === "ready" && ctrl.paperTrading !== false) {
      state = "paper"; iconCh = "📋"; reason = "PAPER MODE — simulated trades only, no live orders";
    }

    el.className = "trading-status " + state;
    icon.textContent = iconCh;
    text.textContent = reason;
  }

  // ── Risk Alert Feed ───────────────────────────────────────────────────────
  // Classify a single safety-check-log entry as a risk alert. Returns
  // { icon, text } for risk-relevant entries; null for normal cycles. Uses
  // ONLY data already in the entry — no new endpoint, no extra fetch.
  function classifyRiskAlert(t) {
    if (!t || typeof t !== "object") return null;
    // 1. Live order failures (M-2 / C-1 path)
    if (t.error && typeof t.error === "string" && t.error.length) {
      const trimmed = t.error.length > 70 ? t.error.slice(0, 67) + "…" : t.error;
      return { icon: "❌", text: "Live order failed — " + trimmed };
    }
    // 2. C-1 path: failed live exit, position retained for retry
    if (typeof t.exitReason === "string" && t.exitReason.indexOf("FAILED_RETRY_PENDING") !== -1) {
      return { icon: "🔁", text: "Exit retry pending — position kept open" };
    }
    // 3. Skip reasons we surface as risk events (regime/liquidation/limit).
    //    Score-too-low skips intentionally NOT included — they are normal.
    const cond = (Array.isArray(t.conditions) && t.conditions[0]) || null;
    const label = (cond && typeof cond.label === "string") ? cond.label.toLowerCase() : "";
    if (label.indexOf("regime guard") !== -1)        return { icon: "⛔", text: "Volatile market — no trade" };
    if (label.indexOf("liquidation safety") !== -1)  return { icon: "🚫", text: "Liquidation risk — SL too wide for leverage" };
    if (label.indexOf("daily trade limit") !== -1)   return { icon: "🛑", text: "Daily trade limit reached" };
    return null;
  }

  function renderRiskAlertFeed(data) {
    const list  = document.getElementById("risk-feed-list");
    const count = document.getElementById("risk-feed-count");
    if (!list) return;

    const recent = data && Array.isArray(data.recentTrades) ? data.recentTrades : null;
    if (recent === null) {
      list.innerHTML = '<div class="risk-feed-empty risk-feed-na">Risk alerts unavailable</div>';
      if (count) count.textContent = "";
      return;
    }

    // Most-recent-first, classified, limited to 5
    const alerts = [];
    for (let i = recent.length - 1; i >= 0 && alerts.length < 5; i--) {
      const cls = classifyRiskAlert(recent[i]);
      if (cls) alerts.push({ ...cls, ts: recent[i].timestamp });
    }

    if (alerts.length === 0) {
      list.innerHTML = '<div class="risk-feed-empty">No recent risk alerts.</div>';
      if (count) count.textContent = "";
      return;
    }

    list.innerHTML = alerts.map(function (a) {
      const t = a.ts ? new Date(a.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—:—";
      // Escape user-visible strings to prevent any HTML injection from log content
      const safeMsg = String(a.text)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return '<div class="risk-feed-row"><span class="ts">' + t +
             '</span><span class="icon">' + a.icon +
             '</span><span class="msg">' + safeMsg + '</span></div>';
    }).join("");
    if (count) count.textContent = alerts.length + " event" + (alerts.length === 1 ? "" : "s");
  }

  // ── Strategy V2 Shadow card ────────────────────────────────────────────
  // Read-only display of the latest V2 verdict pulled from data.latest.strategyV2.
  // Phase 1 — no trade actions. If no V2 data exists yet (older log entries
  // pre-shadow-deploy, fetch errors), shows a friendly empty state.
  function renderV2Shadow(data) {
    const body = document.getElementById("v2-shadow-body");
    if (!body) return;

    const v2 = data?.latest?.strategyV2;
    if (!v2 || typeof v2 !== "object") {
      body.innerHTML = '<div class="v2-shadow-empty">No V2 shadow data yet.</div>';
      return;
    }

    const trendIcon = (t) => t === "bullish" ? "📈" : t === "bearish" ? "📉" : "—";
    const checkIcon = (b) => b ? "✓" : "✗";
    const checkColor = (b) => b ? "var(--green)" : "var(--muted)";

    const decision = (v2.decision || "NO_TRADE").toString();
    let decClass = "v2-shadow-decision-skip";
    if (decision === "TRADE")                     decClass = "v2-shadow-decision-trade";
    else if (decision === "NO_TRADE_SHORT_DEFERRED") decClass = "v2-shadow-decision-deferred";

    // Optional sub-details
    const sweepDepth = (v2.sweep && Number.isFinite(v2.sweep.depthPct))
      ? " (depth " + v2.sweep.depthPct.toFixed(2) + "%)" : "";
    const pullbackPct = (v2.pullback && Number.isFinite(v2.pullback.retracementPct))
      ? " (" + v2.pullback.retracementPct.toFixed(0) + "% retracement)" : "";

    // Escape user-visible text from log content
    const esc = (s) => String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    const skipLine = v2.skipReason
      ? '<div class="v2-shadow-row"><span class="v2-shadow-label">Skip reason</span><span class="v2-shadow-val">' + esc(v2.skipReason) + '</span></div>'
      : "";

    const qualityLine = v2.setupQuality
      ? '<div class="v2-shadow-row"><span class="v2-shadow-label">Quality</span><span class="v2-shadow-val">' + esc(v2.setupQuality) + '</span></div>'
      : "";

    body.innerHTML =
      '<div class="v2-shadow-row"><span class="v2-shadow-label">4H trend</span><span class="v2-shadow-val">' +
        trendIcon(v2.trend4h) + " " + esc(v2.trend4h || "—") + '</span></div>' +
      '<div class="v2-shadow-row"><span class="v2-shadow-label">15M trend</span><span class="v2-shadow-val">' +
        trendIcon(v2.trend15m) + " " + esc(v2.trend15m || "—") + '</span></div>' +
      '<div class="v2-shadow-row"><span class="v2-shadow-label">Liq sweep</span><span class="v2-shadow-val" style="color:' + checkColor(v2.sweep?.detected) + '">' +
        checkIcon(v2.sweep?.detected) + (v2.sweep?.detected ? " detected" + sweepDepth : " not detected") + '</span></div>' +
      '<div class="v2-shadow-row"><span class="v2-shadow-label">5M BOS</span><span class="v2-shadow-val" style="color:' + checkColor(v2.bos?.detected) + '">' +
        checkIcon(v2.bos?.detected) + (v2.bos?.detected ? " confirmed" : " not confirmed") + '</span></div>' +
      '<div class="v2-shadow-row"><span class="v2-shadow-label">Pullback</span><span class="v2-shadow-val" style="color:' + checkColor(v2.pullback?.ok) + '">' +
        checkIcon(v2.pullback?.ok) + (v2.pullback?.ok ? " valid" + pullbackPct : " not valid") + '</span></div>' +
      '<div class="v2-shadow-row"><span class="v2-shadow-label">Decision</span><span class="v2-shadow-val v2-shadow-decision ' + decClass + '">' +
        esc(decision) + '</span></div>' +
      skipLine +
      qualityLine;
  }

  // ── Discord status indicator ──────────────────────────────────────────────
  // Polls /api/system-status (auth-gated, dashboard cookie auto-attached).
  // If discord.enabled is true → green "Enabled". If false → yellow
  // "Missing webhook". On fetch failure → muted "unknown" so the UI never
  // breaks if the endpoint is briefly unreachable.
  function setDiscordStatus(state) {
    const el = document.getElementById("discord-status");
    if (!el) return;
    const cfg = {
      ok:      { text: "Discord: ✓ Enabled",        cls: "discord-status discord-status-ok" },
      warn:    { text: "Discord: ⚠ Missing webhook", cls: "discord-status discord-status-warn" },
      unknown: { text: "Discord: ? unknown",         cls: "discord-status discord-status-unknown" },
    };
    const c = cfg[state] || cfg.unknown;
    el.textContent = c.text;
    el.className   = c.cls;
  }
  async function refreshDiscordStatus() {
    try {
      const r = await safeJson("/api/system-status");
      const enabled = r?.data?.discord?.enabled === true || r?.discord?.enabled === true;
      setDiscordStatus(enabled ? "ok" : "warn");
    } catch {
      setDiscordStatus("unknown");
    }
  }

  async function runHealthCheck() {
    // Discord status piggybacks on the same 30s cadence — independent fetch
    // so a /api/system-status failure can't break /api/health rendering.
    refreshDiscordStatus();
    try {
      const data = await safeJson("/api/health");
      // Single source of truth: derive lastRunAge from latest.timestamp if available (matches nav clock)
      let ageMin = data.lastRunAge;
      if (lastRenderData?.latest?.timestamp) {
        ageMin = (Date.now() - new Date(lastRenderData.latest.timestamp).getTime()) / 60000;
      }
      lastHealth = { krakenOk: !!data.krakenOk, lastRunAge: ageMin };
      updateHealthPanel(data.krakenOk, data.krakenLatency, ageMin, wsConnected);
      renderTradingStatus();
      // Self-heal: if data is stale (> 6 min), trigger a bot run to wake Railway from sleep
      if (ageMin !== null && ageMin > 6) {
        console.log("[self-heal] Data is " + ageMin.toFixed(1) + " min stale — triggering bot run");
        try {
          const r = await safeJson("/api/run-bot", { method: "POST" });
          if (r?.data?.triggered || r?.triggered) showToast("Bot was sleeping — woke it up", "info");
        } catch {}
      }
    } catch {
      lastHealth = { krakenOk: false, lastRunAge: lastHealth.lastRunAge };
      updateHealthPanel(false, 0, null, wsConnected);
      renderTradingStatus();
    }
  }
  runHealthCheck();
  setInterval(runHealthCheck, 30000);
  // Re-check when tab becomes visible (user comes back to the page)
  document.addEventListener("visibilitychange", () => { if (!document.hidden) runHealthCheck(); });

  function toggleRsiHistory() {
    const body  = document.getElementById("rsi-section-body");
    const title = document.getElementById("rsi-section-title");
    if (!body) return;
    const hidden = body.style.display === "none";
    body.style.display  = hidden ? "" : "none";
    if (title) title.classList.toggle("collapsed", !hidden);
  }

  function toggleHowItWorks() {
    document.getElementById("how-it-works").classList.toggle("open");
  }

  function renderStatusBar(data) {
    if (!data) return;
    const { latest, control, position } = data;
    const ctrl = control || {};

    // Mode pill
    const pillMode = document.getElementById("pill-mode");
    if (pillMode) {
      const live = ctrl.paperTrading === false;
      pillMode.textContent = live ? "🔴 LIVE MODE" : "🔒 PAPER MODE";
      pillMode.className = "pill pill-mode" + (live ? " live" : "");
    }

    // Price + arrow (uses livePrice for instant updates)
    const pillPrice = document.getElementById("pill-price");
    const pillArrow = document.getElementById("pill-arrow");
    const price = livePrice || latest?.price;
    if (pillPrice && price) pillPrice.textContent = "$" + price.toFixed(4);
    if (pillArrow && prevTickerPrice !== null && price) {
      pillArrow.textContent = price > prevTickerPrice ? "▲" : price < prevTickerPrice ? "▼" : "—";
      pillArrow.style.color = price > prevTickerPrice ? "var(--green)" : price < prevTickerPrice ? "var(--red)" : "var(--muted)";
    }

    // Regime
    const pillRegime = document.getElementById("pill-regime");
    if (pillRegime && latest?.volatility?.regime) {
      const r = latest.volatility.regime;
      const icons = { TRENDING: "📈", RANGE: "↔", VOLATILE: "⚡", VOLATILE_HIGH: "⚡" };
      pillRegime.textContent = (icons[r] || "—") + " " + r;
      pillRegime.className = "pill pill-regime " + r.toLowerCase();
    }

    // Score
    const pillScore = document.getElementById("pill-score");
    if (pillScore && latest?.signalScore !== undefined) {
      const s = latest.signalScore;
      pillScore.textContent = "Score: " + s.toFixed(0) + "/100";
      pillScore.className = "pill " + (s >= 75 ? "pill-score-high" : s >= 50 ? "pill-score-mid" : "pill-score-low");
    }

    // Bot status
    const pillBot = document.getElementById("pill-bot");
    if (pillBot) {
      const stopped = ctrl.stopped, paused = ctrl.paused;
      const text = stopped ? "STOPPED" : paused ? "PAUSED" : "RUNNING";
      pillBot.textContent = "Bot: " + text;
      pillBot.className = "pill pill-bot " + (stopped ? "stopped" : "running");
    }

    // Risk
    const pillRisk = document.getElementById("pill-risk");
    if (pillRisk) pillRisk.textContent = "Risk: " + (ctrl.riskPct ?? 1) + "%";

    // Max trade size — bot writes CONFIG.maxTradeSizeUSD into every safety-
    // check-log entry under .limits. Read from data.latest first; fall back
    // to scanning recentTrades for the most recent entry that has it. If
    // neither path yields a finite number → "unavailable".
    const pillMaxTrade = document.getElementById("pill-max-trade");
    if (pillMaxTrade) {
      let cap = data.latest?.limits?.maxTradeSizeUSD;
      if (!Number.isFinite(cap)) {
        const trades = Array.isArray(data.recentTrades) ? data.recentTrades : [];
        for (let i = trades.length - 1; i >= 0; i--) {
          const v = trades[i]?.limits?.maxTradeSizeUSD;
          if (Number.isFinite(v)) { cap = v; break; }
        }
      }
      if (Number.isFinite(cap)) {
        pillMaxTrade.textContent = "Max Trade: $" + cap.toFixed(0);
        pillMaxTrade.className   = "pill pill-max-trade";
      } else {
        pillMaxTrade.textContent = "Max Trade: unavailable";
        pillMaxTrade.className   = "pill pill-max-trade pill-max-trade-na";
      }
    }

    // P&L (unrealized + realized combined)
    const pillPnl = document.getElementById("pill-pnl");
    if (pillPnl) {
      const realized   = parseFloat(data.portfolioState?.realizedPnl || 0);
      const unrealized = position?.open && price ? ((price - position.entryPrice) / position.entryPrice * position.tradeSize) : 0;
      const totalPnl   = realized + unrealized;
      const pct        = (totalPnl / 100) * 100;
      const sign = totalPnl >= 0 ? "+" : "";
      pillPnl.textContent = "P&L: " + sign + pct.toFixed(2) + "%";
      pillPnl.className = "pill " + (totalPnl > 0 ? "pill-pnl-pos" : totalPnl < 0 ? "pill-pnl-neg" : "");
    }

    // Daily loss vs configured cap. Shows USD used + % of cap. Style escalates:
    //   <50%  -> ok (muted), 50-90% -> warn (yellow), >=100% -> danger (red).
    // If maxDailyLossPct or recentTrades are missing, falls back to "unavailable".
    const pillDailyLoss = document.getElementById("pill-daily-loss");
    if (pillDailyLoss) {
      const maxPct = ctrl.maxDailyLossPct;
      const recent = Array.isArray(data.recentTrades) ? data.recentTrades : null;
      if (!Number.isFinite(maxPct) || maxPct <= 0 || recent === null) {
        pillDailyLoss.textContent = "Daily loss: unavailable";
        pillDailyLoss.className   = "pill pill-daily-loss pill-daily-loss-na";
      } else {
        // Realized loss today (REENTRY mechanics excluded)
        const today = new Date().toISOString().slice(0, 10);
        const realizedToday = recent
          .filter(t => t.type === "EXIT" && t.timestamp && t.timestamp.slice(0,10) === today && t.exitReason !== "REENTRY_SIGNAL")
          .reduce((s, t) => s + parseFloat(t.pnlUSD || 0), 0);
        const lossUSD = realizedToday < 0 ? -realizedToday : 0; // positive number = loss magnitude
        const startBalance = parseFloat(data.portfolioState?.totalBalanceUSD) || 100;
        const capUSD = startBalance * (maxPct / 100);
        const usedPct = capUSD > 0 ? (lossUSD / capUSD) * 100 : 0;
        const tier = usedPct >= 100 ? "danger" : usedPct >= 50 ? "warn" : "ok";
        pillDailyLoss.textContent = "Daily: -$" + lossUSD.toFixed(2) + " / -$" + capUSD.toFixed(2) + " (" + Math.min(usedPct, 999).toFixed(0) + "%)";
        pillDailyLoss.className   = "pill pill-daily-loss pill-daily-loss-" + tier;
      }
    }

    // Last trade — most recent execution (entry OR exit), excludes skipped cycles
    const pillLastTrade = document.getElementById("pill-last-trade");
    if (pillLastTrade) {
      const trades = Array.isArray(data.recentTrades) ? data.recentTrades : [];
      const lastExec = [...trades].reverse().find(t => t.orderPlaced === true);
      if (lastExec?.timestamp) {
        const t = new Date(lastExec.timestamp);
        const isExit = lastExec.type === "EXIT";
        pillLastTrade.textContent = "Last " + (isExit ? "exit" : "entry") + ": " + t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else {
        pillLastTrade.textContent = "Last trade: —";
      }
    }
  }

  function renderLastDecision(latest) {
    if (!latest) return;
    const ld = {
      time:   document.getElementById("ld-time"),
      icon:   document.getElementById("ld-icon"),
      result: document.getElementById("ld-result"),
      reason: document.getElementById("ld-reason"),
    };
    if (!ld.time) return;
    ld.time.textContent = "Run " + timeAgo(latest.timestamp);

    if (latest.allPass && latest.orderPlaced) {
      ld.icon.textContent   = "✅";
      ld.result.textContent = "Bought";
      ld.result.style.color = "var(--green)";
      ld.reason.textContent = "All signals aligned — bought XRP at $" + (latest.price?.toFixed(4) ?? "?") + " (score " + (latest.signalScore?.toFixed(0) ?? "?") + "/100)";
    } else if (latest.type === "EXIT") {
      const pnl = parseFloat(latest.pnlUSD || 0);
      ld.icon.textContent   = pnl >= 0 ? "🎯" : "🛑";
      ld.result.textContent = "Closed: " + (latest.exitReason || "EXIT").replace("_", " ");
      ld.result.style.color = pnl >= 0 ? "var(--green)" : "var(--red)";
      ld.reason.textContent = "P&L: " + (pnl >= 0 ? "+" : "") + "$" + pnl.toFixed(2) + " (" + latest.pct + "%)";
    } else if (latest.holding) {
      ld.icon.textContent   = "⏸";
      ld.result.textContent = "Holding";
      ld.result.style.color = "var(--blue)";
      ld.reason.textContent = "Position open — monitoring SL/TP";
    } else {
      const failed = (latest.conditions || []).filter(c => !c.pass);
      const f = failed[0]?.label || "";
      ld.icon.textContent   = "⛔";
      ld.result.textContent = "Skipped";
      ld.result.style.color = "var(--muted)";
      let reason = "Conditions not aligned";
      if (f.includes("Daily")) {
        // Calculate countdown to midnight UTC (when daily limit resets)
        const now = new Date();
        const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
        const remainMs = nextMidnight - now;
        const hrs = Math.floor(remainMs / 3600000);
        const mins = Math.floor((remainMs % 3600000) / 60000);
        reason = "Daily limit reached (3/3) — Resets in " + hrs + "h " + mins + "m";
      }
      else if (f.includes("Liquidation")) reason = "Liquidation safety triggered";
      else if (f.includes("Volatility") || f.includes("Regime")) reason = "Volatile market — no trade allowed";
      else if (latest.signalScore !== undefined) reason = "Score " + latest.signalScore.toFixed(0) + "/75 (below threshold)";
      ld.reason.textContent = reason;
    }

    // Next Trade Requires — show what's missing for entry
    const block = document.getElementById("next-trade-block");
    const list  = document.getElementById("next-trade-list");
    if (!block || !list) return;
    const ind = latest.indicators;
    const failedConds = (latest.conditions || []).filter(c => c.label && !c.pass);
    if (failedConds.length === 0 || latest.allPass || latest.holding) {
      block.style.display = "none";
      return;
    }
    const items = failedConds.map(c => {
      let txt = c.label;
      const score = c.score ?? 0;
      const maxS = c.label.includes("EMA") ? 30 : c.label.includes("RSI") ? 30 : 20;
      if (c.label.includes("EMA") && ind?.ema8)         txt = "EMA(8) trend confirmation — price > $" + ind.ema8.toFixed(4);
      else if (c.label.includes("RSI"))                  txt = "RSI(3) drop below 35 (now " + (ind?.rsi3?.toFixed(0) ?? "?") + ")";
      else if (c.label.includes("VWAP"))                 txt = "VWAP reclaim — price > $" + (ind?.vwap?.toFixed(4) ?? "?");
      else if (c.label.includes("Overext"))              txt = "Price within 1.5% of VWAP";
      else if (c.label.includes("Daily"))                txt = "Wait for daily limit reset (midnight UTC)";
      else if (c.label.includes("Volatility") || c.label.includes("Regime")) txt = "Wait for market to calm (currently volatile)";
      return '<li><span class="cond-status">○</span><span>' + txt + ' <span style="opacity:0.6;font-size:11px;font-family:monospace">+' + score.toFixed(0) + '/' + maxS + '</span></span></li>';
    }).join("");
    list.innerHTML = items;
    block.style.display = "";
  }

  function renderCheckLog(allLogs) {
    const el = document.getElementById("check-log");
    if (!el || !allLogs?.length) return;
    const fmt = (run) => {
      const d = new Date(run.timestamp);
      const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      let line, cls;
      if (run.type === "EXIT") {
        const pnl = parseFloat(run.pnlUSD || 0);
        const reason = (run.exitReason || "EXIT").replace("_", " ").toLowerCase();
        line = "Closed position → " + reason + " (" + (pnl >= 0 ? "+" : "") + "$" + pnl.toFixed(2) + ")";
        cls  = pnl < 0 ? "cl-loss" : "cl-exit";
      } else if (run.allPass && run.orderPlaced) {
        line = "Bought XRP at $" + (run.price?.toFixed(4) || "?") + " (score " + (run.signalScore?.toFixed(0) || "?") + "/100)";
        cls  = "cl-trade";
      } else if (run.holding) {
        line = "Holding position — SL/TP monitoring";
        cls  = "cl-skip";
      } else {
        const failed = (run.conditions || []).filter(c => !c.pass);
        let reason = "Skipped";
        if (failed.length) {
          const f = failed[0].label || "";
          if (f.includes("Daily"))         reason = "Skipped (Daily limit)";
          else if (f.includes("Liquidation")) reason = "Skipped (Liquidation risk)";
          else if (f.includes("Volatility") || f.includes("Regime")) reason = "Skipped (Volatile market)";
          else if (f.includes("EMA"))      reason = "Skipped (EMA fail)";
          else if (f.includes("RSI"))      reason = "Skipped (RSI " + (run.indicators?.rsi3?.toFixed(0) || "?") + ")";
          else if (f.includes("VWAP"))     reason = "Skipped (VWAP fail)";
          else if (f.includes("Overext"))  reason = "Skipped (Overextended)";
          else                              reason = "Skipped (Score " + (run.signalScore?.toFixed(0) || "?") + "/75)";
        }
        line = "Checked conditions → " + reason;
        cls  = "cl-skip";
      }
      return '<div class="check-log-line ' + cls + '"><span class="check-log-time">[' + t + ']</span>' + line + '</div>';
    };
    // Most recent first, max 15 lines
    el.innerHTML = allLogs.slice(0, 15).map(fmt).join("");
  }

  function renderPortfolioPanel(port, perf, position, livePrice) {
    if (!port && !perf) return;

    // Health score calculation (mirrors bot.js logic)
    const wr   = perf?.winRate  || 0;
    const pf   = perf?.profitFactor || 0;
    const dd   = perf?.drawdown || port?.drawdown || 0;
    const eff  = port?.efficiencyScore ?? 50;
    const enough = (perf?.totalTrades || 0) >= 3;

    const wrScore  = enough ? Math.min(wr * 100, 100) * 0.30 : 15;
    const pfScore  = enough ? Math.min(pf / 2, 1) * 100 * 0.30 : 15;
    const ddScore  = Math.max(0, 1 - dd / 5) * 100 * 0.20;
    const score    = Math.min(100, Math.round(wrScore + pfScore + 20 + ddScore));

    const scoreEl  = document.getElementById("port-score");
    const ringEl   = document.getElementById("port-score-ring");
    const labelEl  = document.getElementById("port-score-label");
    if (scoreEl) scoreEl.textContent = enough ? score : "—";
    const scoreColor = score >= 70 ? "var(--green)" : score >= 45 ? "var(--yellow)" : "var(--red)";
    if (ringEl)  { ringEl.style.borderColor = scoreColor; ringEl.style.boxShadow = "0 0 20px " + scoreColor.replace(")", ",0.2)").replace("var(","rgba(").replace("--green","0,255,154").replace("--yellow","255,181,71").replace("--red","255,77,106"); }
    if (scoreEl) scoreEl.style.color = scoreColor;
    if (labelEl) labelEl.textContent = score >= 70 ? "System Healthy" : score >= 45 ? "Monitor Closely" : "Reduce Risk";

    // Metrics
    const price  = livePrice || position?.entryPrice || 0;
    const unrealPnl = position?.open && price ? ((price - position.entryPrice) / position.entryPrice * position.tradeSize) : 0;
    const realPnl   = parseFloat(port?.realizedPnl || 0);
    const openRisk  = parseFloat(port?.openRiskPct || 0);
    const totalBal  = parseFloat(port?.totalBalanceUSD || 0);

    const s = (id, val, color) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; if (color) el.style.color = color; };
    s("port-open-risk",   openRisk.toFixed(2) + "%",                                 openRisk > 3 ? "var(--red)" : "var(--text)");
    s("port-unrealized",  (unrealPnl >= 0 ? "+" : "") + "$" + unrealPnl.toFixed(2), unrealPnl >= 0 ? "var(--green)" : "var(--red)");
    s("port-realized",    (realPnl   >= 0 ? "+" : "") + "$" + realPnl.toFixed(2),   realPnl   >= 0 ? "var(--green)" : "var(--red)");
    s("port-efficiency",  eff + "/100",                                               eff >= 60 ? "var(--green)" : eff >= 40 ? "var(--yellow)" : "var(--red)");
    s("port-total-bal",   "$" + totalBal.toFixed(2));
    s("port-drawdown",    dd.toFixed(2) + "%",                                        dd >= 5 ? "var(--red)" : dd >= 2 ? "var(--yellow)" : "var(--green)");

    // Allocation bar
    const usdPct  = 60; const xrpPct = 40 - Math.min(openRisk, 10); const riskPct = Math.min(openRisk, 10);
    const setBar  = (id, w) => { const el = document.getElementById(id); if (el) el.style.width = Math.max(0, w).toFixed(1) + "%"; };
    setBar("alloc-bar-usd",  usdPct);
    setBar("alloc-bar-xrp",  Math.max(0, xrpPct));
    setBar("alloc-bar-risk", riskPct);
    s("alloc-usd-label",  "USD " + usdPct + "%");
    s("alloc-xrp-label",  "XRP " + xrpPct.toFixed(0) + "%");
    s("alloc-risk-label", "Open risk " + openRisk.toFixed(1) + "%");
  }

  async function setCapital(command, value, _btn) {
    // Phase 5b — button lock. Capture btn synchronously before any await.
    const release = lockBtn(_btn !== undefined ? _btn : _activeBtn());
    // Phase 5c — surface failures. Network errors, non-200 HTTP, and
    // { ok: false } payloads now show a toast instead of silent no-op.
    try {
      const res = await fetch("/api/control", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ command, value }) });
      if (!res.ok) {
        showToast("Capital update failed: HTTP " + res.status, "error");
        return;
      }
      const data = await res.json();
      if (data.ok === false) {
        showToast("Capital update failed: " + (data.error || "unknown"), "error");
        return;
      }
      if (data.capitalState) renderCapitalPanel(data.capitalState, null);
      showToast(commandSuccessMessage(command, value, data.control), "success");
    } catch (e) {
      showToast("Capital update failed: " + e.message, "error");
    } finally { release(); }
  }

  async function confirmCapital() {
    const ok = await showModal({
      icon: "🔥", title: "Set XRP role to AGGRESSIVE?",
      msg: "<strong style='color:var(--red)'>This makes your XRP holdings part of the trading pool.</strong> The bot can liquidate XRP to fund trades. Not recommended in your stage.",
      confirmText: "Set Aggressive", requireText: "CONFIRM"
    });
    if (ok) { setCapital("SET_XRP_ROLE", "AGGRESSIVE"); showToast("XRP role: AGGRESSIVE", "warn"); }
    else { showToast("AGGRESSIVE role change cancelled — XRP role unchanged", "info"); }
  }

  function renderCapitalPanel(cap, paperPnL) {
    if (!cap) return;
    const startBal  = parseFloat(process?.env?.PAPER_STARTING_BALANCE || "100") || 100;
    const pnl       = paperPnL?.pnl || 0;
    const usdTotal  = startBal + pnl;
    const active    = usdTotal * ((cap.activePct || 70) / 100);
    const reserve   = usdTotal * ((cap.reservePct || 30) / 100);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("cap-active",        "$" + active.toFixed(2));
    set("cap-reserve",       "$" + reserve.toFixed(2));
    set("cap-usd-total",     "$" + usdTotal.toFixed(2));
    set("cap-autoconvert",   cap.autoConversion ? "ON ⚠️" : "OFF");
    set("cap-bar-active-label",  "Active " + (cap.activePct || 70) + "%");
    set("cap-bar-reserve-label", "Reserve " + (cap.reservePct || 30) + "%");

    const bar = document.getElementById("cap-bar-active");
    if (bar) bar.style.width = (cap.activePct || 70) + "%";

    const pctInput = document.getElementById("cap-active-pct");
    if (pctInput) pctInput.value = cap.activePct || 70;

    // Role badge
    const badge = document.getElementById("capital-xrp-badge");
    if (badge) {
      const roleMap = { "HOLD_ASSET": ["🔒 XRP: HOLD ASSET", "ctrl-badge-green"], "ACTIVE": ["⚡ XRP: ACTIVE", "ctrl-badge-yellow"], "AGGRESSIVE": ["🔥 XRP: AGGRESSIVE", "ctrl-badge-red"] };
      const [text, cls] = roleMap[cap.xrpRole] || roleMap["HOLD_ASSET"];
      badge.textContent = text; badge.className = "ctrl-badge " + cls;
    }

    // Role buttons
    ["hold","active","aggressive"].forEach(r => {
      const btn = document.getElementById("cap-btn-" + r);
      if (btn) btn.classList.toggle("active-role", cap.xrpRole === r.toUpperCase().replace("HOLD","HOLD_ASSET"));
    });
    const holdBtn = document.getElementById("cap-btn-hold");
    if (holdBtn) holdBtn.classList.toggle("active-role", cap.xrpRole === "HOLD_ASSET");
    const activeBtn = document.getElementById("cap-btn-active");
    if (activeBtn) activeBtn.classList.toggle("active-role", cap.xrpRole === "ACTIVE");
    const aggBtn = document.getElementById("cap-btn-aggressive");
    if (aggBtn) aggBtn.classList.toggle("active-role", cap.xrpRole === "AGGRESSIVE");
  }

  // Phase 3 — explicit per-mode W/L labels under the Win Rate stat. Paper and
  // Live are rendered as two separate sub-lines; whichever side has no data
  // shows "unavailable" instead of borrowing from the other mode.
  function fmtModeWL(o) {
    if (!o || !o.total) return "unavailable";
    const wr = o.winRate !== null && o.winRate !== undefined ? o.winRate.toFixed(0) + "%" : "—";
    return o.wins + "W / " + o.losses + "L  (" + wr + ")";
  }
  function renderModeWL(modeWL, ctrl) {
    const tag = document.getElementById("perf-wr-mode-tag");
    if (tag) tag.textContent = "(active mode: " + (ctrl && ctrl.paperTrading !== false ? "PAPER" : "LIVE") + ")";
    const pEl = document.getElementById("perf-wl-paper");
    const lEl = document.getElementById("perf-wl-live");
    if (pEl) pEl.textContent = "Paper W/L: " + fmtModeWL(modeWL && modeWL.paper);
    if (lEl) lEl.textContent = "Live W/L: "  + fmtModeWL(modeWL && modeWL.live);
  }

  function renderPerfPanel(perf, modeWL, ctrl) {
    if (!perf || !perf.totalTrades) {
      // Even without perf state, still render the explicit Paper/Live W/L
      // sub-lines below so the labels are never blank or ambiguous.
      renderModeWL(modeWL, ctrl);
      return;
    }
    const wr    = perf.winRate ?? 0;
    const pf    = perf.profitFactor ?? 0;
    const dd    = perf.drawdown ?? 0;
    const ap    = perf.avgProfit ?? 0;
    const al    = perf.avgLoss  ?? 0;
    const thresh = perf.adaptedThreshold ?? 75;
    const rm     = perf.adaptedRiskMultiplier ?? 1.0;

    const wrEl = document.getElementById("perf-winrate");
    if (wrEl) { wrEl.textContent = (wr * 100).toFixed(0) + "%"; wrEl.style.color = wr >= 0.55 ? "var(--green)" : wr >= 0.45 ? "var(--yellow)" : "var(--red)"; }
    renderModeWL(modeWL, ctrl);

    const pfEl = document.getElementById("perf-pf");
    if (pfEl) { pfEl.textContent = pf === 999 ? "∞" : pf.toFixed(2); pfEl.style.color = pf >= 1.5 ? "var(--green)" : pf >= 1.0 ? "var(--yellow)" : "var(--red)"; }

    const avgEl = document.getElementById("perf-avgpl");
    if (avgEl) { avgEl.textContent = "+" + ap.toFixed(2) + " / -" + al.toFixed(2); avgEl.style.color = ap > al ? "var(--green)" : "var(--yellow)"; }
    const avgSub = document.getElementById("perf-avgpl-sub");
    if (avgSub) avgSub.textContent = "R-ratio: " + (al > 0 ? (ap / al).toFixed(2) : "∞");

    const ddEl = document.getElementById("perf-drawdown");
    if (ddEl) { ddEl.textContent = dd.toFixed(2) + "%"; ddEl.style.color = dd >= 5 ? "var(--red)" : dd >= 2 ? "var(--yellow)" : "var(--green)"; }

    // Adaptations
    const badges = [];
    if (thresh > 75) badges.push({ text: "⬆ Threshold " + thresh + " (low win rate)", cls: "adapt-warn" });
    else if (thresh < 75) badges.push({ text: "⬇ Threshold " + thresh + " (high win rate)", cls: "adapt-good" });
    else badges.push({ text: "Threshold 75 (default)", cls: "adapt-default" });
    if (rm < 1.0) badges.push({ text: "⬇ Risk " + (rm * 100).toFixed(0) + "% (drawdown guard)", cls: "adapt-danger" });
    else if (rm > 1.0) badges.push({ text: "⬆ Risk " + (rm * 100).toFixed(0) + "% (good performance)", cls: "adapt-good" });
    else badges.push({ text: "Risk 100% (default)", cls: "adapt-default" });
    if (perf.consecutiveLosses >= 2) badges.push({ text: "⚡ Leverage locked (loss streak)", cls: "adapt-warn" });
    if (dd >= 3) badges.push({ text: "⚠ Risk halved (drawdown > 3%)", cls: "adapt-danger" });
    if (dd >= 5) badges.push({ text: "🚨 Kill switch zone", cls: "adapt-danger" });

    const adaptEl = document.getElementById("perf-adaptations");
    if (adaptEl) adaptEl.innerHTML = badges.map(b => \`<span class="perf-adapt-badge \${b.cls}">\${b.text}</span>\`).join("");
  }

  function signalQualityLabel(score) {
    if (score >= 90) return { label: "🔥 High Quality Setup",  color: "var(--green)"  };
    if (score >= 75) return { label: "✅ Valid Setup",          color: "var(--green)"  };
    if (score >= 55) return { label: "🟡 Medium Setup",         color: "var(--yellow)" };
    if (score >= 30) return { label: "⚠️ Weak Setup",          color: "var(--yellow)" };
    return              { label: "🔴 Avoid Zone",             color: "var(--red)"    };
  }

  function detectRegime(latest) {
    if (!latest) return "UNKNOWN";
    const vol = latest.volatility;
    if (vol?.level === "HIGH" || (parseFloat(vol?.spikeRatio) > 1.8)) return "VOLATILE";
    const score = latest.signalScore || 0;
    if (score >= 50) return "TRENDING";
    return "RANGE";
  }

  function renderLiveStatus(data) {
    const latest = data.latest;
    if (!latest) return;

    const regime      = detectRegime(latest);
    const score       = latest.signalScore ?? null;
    const effLev      = latest.effectiveLeverage || latest.volatility?.leverage;
    const isPaper     = data.control?.paperTrading !== false;

    // Market regime badge
    const regimeEl = document.getElementById("live-regime");
    const regimeItem = document.getElementById("live-regime-item");
    if (regimeEl && regimeItem) {
      regimeItem.style.display = "";
      const regimeClass = regime === "TRENDING" ? "regime-trending" : regime === "VOLATILE" ? "regime-volatile" : "regime-range";
      const regimeIcon  = regime === "TRENDING" ? "📈" : regime === "VOLATILE" ? "⚡" : "↔️";
      regimeEl.className = "live-status-item " + regimeClass;
      regimeEl.textContent = regimeIcon + " " + regime;
    }

    // Confidence score bar
    if (score !== null) {
      const confItem = document.getElementById("live-confidence-item");
      const confBar  = document.getElementById("live-confidence-bar");
      const confVal  = document.getElementById("live-confidence-val");
      if (confItem) confItem.style.display = "";
      if (confBar)  { confBar.style.width = score + "%"; confBar.style.background = score >= 75 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)"; }
      if (confVal)  { confVal.textContent = score.toFixed(0); confVal.style.color = score >= 75 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)"; }
    }

    // Leverage badge
    if (effLev !== undefined) {
      const levItem  = document.getElementById("live-leverage-item");
      const levBadge = document.getElementById("live-leverage-badge");
      if (levItem)  levItem.style.display = "";
      if (levBadge) levBadge.textContent = "⚡ " + effLev + "x";
    }

    // (live-mode-bar removed — mode now shown in trading-status banner + pill-mode)
  }

  function switchTab(tab) {
    const isDash = tab === "dashboard";
    document.getElementById("dashboard-page").style.display = isDash ? "" : "none";
    document.getElementById("info-page").style.display      = isDash ? "none" : "block";
    document.getElementById("tab-dashboard").classList.toggle("active", isDash);
    document.getElementById("tab-info").classList.toggle("active", !isDash);
  }

  let currentView = "simple";
  let lastRenderData = null;

  function setView(v) {
    currentView = v;
    document.getElementById("toggle-simple").classList.toggle("active", v === "simple");
    document.getElementById("toggle-advanced").classList.toggle("active", v === "advanced");
    document.getElementById("reasoning-summary").style.display     = v === "simple"   ? "" : "none";
    document.getElementById("reasoning-summary-adv").style.display = v === "advanced" ? "" : "none";
    document.getElementById("reasoning-timeline").style.display          = v === "simple"   ? "" : "none";
    document.getElementById("reasoning-timeline-advanced").style.display = v === "advanced" ? "" : "none";
    if (lastRenderData) {
      renderSafetyCheck(lastRenderData.latest);
      renderTradeTable(lastRenderData.recentTrades);
      renderHeatmap(lastRenderData.allLogs);
    }
  }

  function simpleNote(r) {
    const mode  = r["Mode"]  || "";
    const notes = r["Notes"] || "";
    if (mode === "PAPER" || mode === "LIVE") return "Bought — all signals aligned";
    if (notes.includes("RSI") && notes.includes("below 30"))                         return "Skipped — market wasn't at the right dip level yet";
    if (notes.includes("RSI") && notes.includes("above 50") && notes.includes("falling")) return "Skipped — price was still dropping";
    if (notes.includes("RSI") && notes.includes("above 50") && notes.includes("rising"))  return "Skipped — market was overheated";
    if (notes.includes("RSI") && notes.includes("above 70"))                         return "Skipped — market was too hot to enter";
    if (notes.includes("RSI") && notes.includes("below 50"))                         return "Skipped — momentum wasn't ready";
    if (notes.includes("Market bias") || notes.includes("market bias"))              return "Skipped — no clear market direction";
    if (notes.includes("overextended"))                                              return "Skipped — price moved too far too fast";
    if (notes.includes("VWAP"))                                                      return "Skipped — sellers were in control";
    if (notes.includes("EMA"))                                                       return "Skipped — trend wasn't confirmed";
    return "Skipped — conditions weren't right";
  }

  function renderTradeTable(recentTrades) {
    const tbody = document.getElementById("trade-table-body");
    const thead = document.getElementById("trade-table-head");
    if (!recentTrades || !recentTrades.length) {
      tbody.innerHTML = \`<tr class="empty-row"><td colspan="6">No trades recorded yet</td></tr>\`;
      return;
    }
    const simple = currentView === "simple";
    if (thead) {
      thead.innerHTML = simple
        ? \`<tr><th>Date</th><th>Time</th><th>Symbol</th><th>Price</th><th>Result</th><th>What Happened</th></tr>\`
        : \`<tr><th>Date</th><th>Time (UTC)</th><th>Symbol</th><th>Side</th><th>Price</th><th>Total</th><th>Mode</th><th>Notes</th></tr>\`;
    }
    tbody.innerHTML = recentTrades.map(r => {
      const mode      = r["Mode"] || "";
      const modeClass = mode === "PAPER" ? "mode-paper" : mode === "LIVE" ? "mode-live" : "mode-blocked";
      const price     = r["Price"] ? "$" + parseFloat(r["Price"]).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:4 }) : "—";
      const total     = r["Total USD"] ? "$" + parseFloat(r["Total USD"]).toFixed(2) : "—";
      if (simple) {
        const resultLabel = mode === "PAPER" ? "✅ Paper Buy" : mode === "LIVE" ? "✅ Live Buy" : "⛔ Skipped";
        const noteText    = simpleNote(r);
        return \`
          <tr>
            <td>\${r["Date"]||"—"}</td>
            <td>\${(r["Time (UTC)"]||"—").slice(0,5)}</td>
            <td>\${r["Symbol"]||"—"}</td>
            <td>\${price}</td>
            <td class="\${modeClass}">\${resultLabel}</td>
            <td style="color:var(--muted)">\${noteText}</td>
          </tr>\`;
      }
      return \`
        <tr>
          <td>\${r["Date"]||"—"}</td>
          <td>\${r["Time (UTC)"]||"—"}</td>
          <td>\${r["Symbol"]||"—"}</td>
          <td>\${r["Side"]||"—"}</td>
          <td>\${price}</td>
          <td>\${total}</td>
          <td class="\${modeClass}">\${mode}</td>
          <td style="color:var(--muted);max-width:300px;overflow:hidden;text-overflow:ellipsis">\${r["Notes"]||"—"}</td>
        </tr>\`;
    }).join("");
  }

  function simpleLabel(run) {
    if (run.allPass) return "✅ Strong Buy Opportunity";
    const failed = (run.conditions || []).filter(c => !c.pass);
    if (!failed.length) return "⚠️ Unclear Conditions";
    const f = failed[0];
    if (f.label === "Market bias") return "⚠️ Unclear Conditions";
    if (f.label.includes("RSI")) {
      const rsi = run.indicators?.rsi3;
      if (rsi != null) return rsi > 70 ? "❌ Market Too Hot" : "❌ Weak Setup";
      return "❌ Weak Setup";
    }
    if (f.label.includes("overextended")) return "❌ Overextended — Too Risky";
    if (f.label.includes("EMA"))  return "❌ Trend Not Confirmed";
    return "❌ No Clear Opportunity";
  }

  function simpleReason(run) {
    if (run.allPass) {
      const p = run.price < 10 ? run.price.toFixed(4) : run.price.toLocaleString("en-US", { minimumFractionDigits: 2 });
      return \`Bought — strong dip in an uptrend, high-probability setup at $\${p}\`;
    }
    const failed = (run.conditions || []).filter(c => !c.pass);
    if (!failed.length) return "Skipped — no clear opportunity at this time";
    const f = failed[0];
    if (f.label === "Market bias")        return "Skipped — market had no clear direction, buyers and sellers were balanced";
    if (f.label.includes("RSI")) {
      const rsi = run.indicators?.rsi3;
      if (rsi != null) {
        if (rsi > 70) return "Skipped — market was too overheated to safely buy";
        if (rsi > 30) return "Skipped — price was still dropping, waiting for the right dip";
        return "Skipped — momentum not at the right level yet";
      }
      return "Skipped — momentum not ready for entry";
    }
    if (f.label.includes("overextended")) return "Skipped — price moved too far too fast, waiting for it to calm down";
    if (f.label.includes("VWAP"))         return "Skipped — sellers were in control of the session";
    if (f.label.includes("EMA"))          return "Skipped — price trend wasn't confirmed, too risky to enter";
    return "Skipped — conditions weren't aligned for a safe trade";
  }

  function getConfidence(run) {
    if (run.allPass) return "high";
    const total = (run.conditions || []).length;
    if (!total) return "low";
    const passed = (run.conditions || []).filter(c => c.pass).length;
    return (passed >= total - 1 && total > 1) ? "med" : "low";
  }

  function groupRuns(runs) {
    const groups = [];
    for (const run of runs) {
      if (!run.allPass && groups.length) {
        const last    = groups[groups.length - 1];
        const curKey  = (run.conditions || []).find(c => !c.pass)?.label || "";
        const lastKey = last.isGroup
          ? last.reason
          : (last.run.conditions || []).find(c => !c.pass)?.label || "";
        if (curKey && curKey === lastKey && !last.run?.allPass) {
          if (last.isGroup) { last.count++; last.latestTime = run.timestamp; }
          else groups[groups.length - 1] = { isGroup: true, run: last.run, count: 2, reason: curKey, latestTime: run.timestamp };
          continue;
        }
      }
      groups.push({ isGroup: false, run });
    }
    return groups;
  }

  function renderReasoning(recentLogs) {
    if (!recentLogs || !recentLogs.length) {
      document.getElementById("reasoning-summary").textContent     = "No run history yet.";
      document.getElementById("reasoning-summary-adv").textContent = "No run history yet.";
      document.getElementById("reasoning-timeline").innerHTML          = "";
      document.getElementById("reasoning-timeline-advanced").innerHTML = "";
      return;
    }

    const blocked = recentLogs.filter(r => !r.allPass);
    const traded  = recentLogs.filter(r => r.allPass);
    const n = recentLogs.length;

    // ── Simple summary ────────────────────────────────────────────────────────
    let simpleSummary = "";
    if (traded.length === 0) {
      simpleSummary = \`The bot checked \${n} time\${n > 1 ? "s" : ""} recently and didn't find a good entry. <strong>This is normal</strong> — it only acts when everything aligns perfectly, so most checks will be skipped.\`;
    } else if (blocked.length === 0) {
      simpleSummary = \`All \${n} recent checks found a good entry — the bot has been consistently active and finding setups.\`;
    } else {
      simpleSummary = \`Out of \${n} recent checks, <strong>\${traded.length} resulted in a trade</strong> and \${blocked.length} were skipped. Skipped checks mean conditions weren't right — the bot is being selective, which is healthy.\`;
    }

    // ── Advanced summary (original) ───────────────────────────────────────────
    const reasonCount = {};
    for (const run of blocked) {
      const key = (run.conditions || []).filter(c => !c.pass)[0]?.label || "Unknown";
      reasonCount[key] = (reasonCount[key] || 0) + 1;
    }
    const topReason = Object.entries(reasonCount).sort((a, b) => b[1] - a[1])[0];
    let advSummary = "";
    if (traded.length === 0) {
      advSummary = \`The bot has checked \${n} time\${n > 1 ? "s" : ""} recently and been blocked every time. \`;
      if (topReason?.[0] === "Market bias") {
        advSummary += \`The market has <strong>no clear direction</strong> — price keeps landing between VWAP and EMA(8) with no bullish or bearish lean. The bot waits for one side to take control before it acts. \`;
      } else if (topReason) {
        advSummary += \`The most common block: <strong>\${topReason[0]}</strong>. \`;
      }
      advSummary += \`This is the strategy working correctly — no signal, no trade.\`;
    } else if (blocked.length === 0) {
      advSummary = \`All \${n} recent runs fired a trade. The bot is finding setups consistently.\`;
    } else {
      advSummary = \`Out of \${n} recent runs, <strong>\${traded.length} resulted in a trade</strong> and \${blocked.length} were blocked. \`;
      if (topReason) advSummary += \`Most common block reason: <strong>\${topReason[0]}</strong>.\`;
    }

    // ── Simple timeline (with grouping) ──────────────────────────────────────
    const simpleHtml = groupRuns(recentLogs).map(g => {
      if (g.isGroup) {
        return \`
          <div class="run-group-item">
            <div class="conf-dot conf-low"></div>
            <div class="run-group-body">
              <div class="run-group-label">\${simpleLabel(g.run)} <span class="run-group-badge">×\${g.count}</span></div>
              <div class="run-group-detail">\${simpleReason(g.run)}</div>
              <div class="run-simple-time">\${timeAgo(g.latestTime)}</div>
            </div>
          </div>\`;
      }
      const { run } = g;
      const conf = getConfidence(run);
      return \`
        <div class="run-item-simple">
          <div class="conf-dot conf-\${conf}"></div>
          <div class="run-simple-body">
            <div class="run-simple-label">\${simpleLabel(run)}</div>
            <div class="run-simple-reason">\${simpleReason(run)}</div>
            <div class="run-simple-time">\${timeAgo(run.timestamp)}</div>
          </div>
        </div>\`;
    }).join("");

    // ── Advanced timeline (original) ──────────────────────────────────────────
    const advancedHtml = recentLogs.map(run => {
      const dotClass = run.allPass ? "run-dot-traded" : "run-dot-blocked";
      const ago    = timeAgo(run.timestamp);
      const utcStr = new Date(run.timestamp).toUTCString().replace(" GMT","").slice(5,-4) + " UTC";
      const reason = run.allPass
        ? \`✅ All conditions met — \${run.paperTrading ? "paper" : "live"} trade at $\${run.price < 10 ? run.price.toFixed(4) : run.price.toLocaleString("en-US",{minimumFractionDigits:2})}\`
        : \`🚫 \${plainBlockReason(run)}\`;
      return \`
        <div class="run-item">
          <div class="run-dot \${dotClass}"></div>
          <div class="run-body">
            <div class="run-time">\${ago} &nbsp;·&nbsp; \${utcStr} &nbsp;·&nbsp; \${run.symbol} \${run.timeframe}</div>
            <div class="run-reason">\${reason}</div>
          </div>
        </div>\`;
    }).join("");

    document.getElementById("reasoning-summary").innerHTML     = simpleSummary;
    document.getElementById("reasoning-summary-adv").innerHTML = advSummary;
    document.getElementById("reasoning-timeline").innerHTML          = simpleHtml;
    document.getElementById("reasoning-timeline-advanced").innerHTML = advancedHtml;
    setView(currentView);
  }

  function render(data) {
    const { latest, stats, recentTrades } = data;

    if (latest) {
      document.getElementById("nav-symbol").textContent = latest.symbol;
      // (nav-mode badge removed — mode shown in trading-status banner + pill-mode)
      document.getElementById("last-updated").textContent = "Last run " + timeAgo(latest.timestamp);
    }

    // Paper Portfolio Wallet
    const pw = data.paperPnL;
    const startBal = data.paperStartingBalance || 500;
    document.getElementById("pw-starting").textContent = "$" + startBal.toLocaleString("en-US", { minimumFractionDigits: 2 });
    if (pw && pw.tradeCount > 0) {
      const usdRemaining = startBal - pw.totalInvested;
      const xrpValue     = pw.currentValue || 0;
      const totalValue   = usdRemaining + xrpValue;
      const walletPnl    = totalValue - startBal;
      const walletPnlPct = ((walletPnl / startBal) * 100).toFixed(2);
      const pnlSign      = walletPnl >= 0 ? "+" : "";
      const avgEntry     = pw.totalQty > 0 ? pw.totalInvested / pw.totalQty : 0;
      document.getElementById("pw-usd-remaining").textContent = "$" + usdRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("pw-usd-spent").textContent     = "$" + pw.totalInvested.toFixed(2) + " spent";
      document.getElementById("pw-xrp-held").textContent      = pw.totalQty.toFixed(4) + " XRP";
      document.getElementById("pw-xrp-value").textContent     = xrpValue > 0 ? "current value: $" + xrpValue.toFixed(2) : "current value: —";
      document.getElementById("pw-trade-count").textContent   = pw.tradeCount;
      document.getElementById("pw-avg-entry").textContent     = avgEntry > 0 ? "avg entry: $" + avgEntry.toFixed(4) : "avg entry: —";
      const totalEl = document.getElementById("pw-total-value");
      totalEl.textContent = "$" + totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 });
      totalEl.className = "paper-wallet-total-value " + (walletPnl > 0 ? "pnl-pos" : walletPnl < 0 ? "pnl-neg" : "");
      const pnlEl = document.getElementById("pw-pnl");
      pnlEl.textContent = pnlSign + "$" + Math.abs(walletPnl).toFixed(2) + " (" + pnlSign + walletPnlPct + "%)";
      pnlEl.className = "paper-wallet-pnl " + (walletPnl > 0 ? "pnl-pos" : walletPnl < 0 ? "pnl-neg" : "pnl-zero");
    } else {
      document.getElementById("pw-usd-remaining").textContent = "$" + startBal.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("pw-usd-spent").textContent     = "$0 spent";
      document.getElementById("pw-xrp-held").textContent      = "0 XRP";
      document.getElementById("pw-xrp-value").textContent     = "current value: —";
      document.getElementById("pw-trade-count").textContent   = "0";
      document.getElementById("pw-avg-entry").textContent     = "avg entry: —";
      document.getElementById("pw-total-value").textContent   = "$" + startBal.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("pw-pnl").textContent           = "$0.00 (0.00%)";
      document.getElementById("pw-pnl").className             = "paper-wallet-pnl pnl-zero";
    }

    // Paper P&L
    const p = data.paperPnL;
    if (p && p.tradeCount > 0) {
      const pnlEl  = document.getElementById("pnl-value");
      const pnlSign = p.pnl >= 0 ? "+" : "";
      pnlEl.textContent = pnlSign + "$" + Math.abs(p.pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      pnlEl.className   = "pnl-value " + (p.pnl > 0 ? "pnl-pos" : p.pnl < 0 ? "pnl-neg" : "pnl-zero");
      document.getElementById("pnl-pct").textContent      = pnlSign + p.pnlPct.toFixed(2) + "%";
      document.getElementById("pnl-current").textContent  = p.currentValue > 0 ? "$" + p.currentValue.toFixed(2) : "—";
      document.getElementById("pnl-qty").textContent      = p.totalQty.toFixed(4) + " units held";
      document.getElementById("pnl-invested").textContent = "$" + p.totalInvested.toFixed(2);
      document.getElementById("pnl-trades").textContent   = p.tradeCount + " paper trade" + (p.tradeCount !== 1 ? "s" : "");
      const avgEntry = p.totalQty > 0 ? p.totalInvested / p.totalQty : 0;
      document.getElementById("pnl-avg-entry").textContent = avgEntry > 0 ? "$" + avgEntry.toFixed(4) : "—";
      const curPrice = data.latest?.price;
      document.getElementById("pnl-current-price").textContent = curPrice ? "current: $" + curPrice.toFixed(4) : "current: —";

      const wlEl = document.getElementById("pnl-wl-ratio");
      const ratio = p.losses > 0 ? (p.wins / p.losses).toFixed(2) + ":1" : p.wins > 0 ? p.wins + ":0" : "—";
      wlEl.textContent = ratio;
      wlEl.className = "pnl-value " + (p.wins > p.losses ? "pnl-pos" : p.losses > p.wins ? "pnl-neg" : "pnl-zero");
      document.getElementById("pnl-wl-detail").textContent = \`\${p.wins}W / \${p.losses}L · \${p.winRate.toFixed(0)}% win rate\`;
    }

    document.getElementById("stat-total").textContent   = stats.total;
    document.getElementById("stat-fired").textContent   = stats.fired;
    document.getElementById("stat-blocked").textContent = stats.blocked;
    document.getElementById("stat-today").textContent   = stats.todayCount;
    // Phase D-4-P-c — make the UTC-day scope explicit. Bot.js's
    // countTodaysTrades / checkTradeLimits both bucket by UTC day for
    // safety; surfacing that here prevents the post-UTC-midnight "0 today"
    // surprise that hides trades made earlier in the user's local day.
    document.getElementById("stat-today-sub").textContent =
      \`of \${latest?.limits?.maxTradesPerDay ?? 3} max · UTC day (resets 00:00 UTC)\`;

    if (latest) {
      const { price, indicators, timestamp } = latest;
      const bias = latest.conditions.find(c => c.label === "Market bias");
      const biasVal = bias ? bias.actual : (latest.allPass ? "Active" : "Neutral");

      document.getElementById("indicators-content").innerHTML = \`
        <div class="indicator-row">
          <span class="ind-label">Price</span>
          <span class="ind-value">\${price < 100 ? "$" + price.toFixed(4) : "$" + price.toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </div>
        <div class="indicator-row">
          <span class="ind-label">EMA(8)</span>
          <span class="ind-value" style="color:var(--purple)">\${indicators.ema8 < 100 ? "$" + indicators.ema8.toFixed(4) : "$" + indicators.ema8.toFixed(2)}</span>
        </div>
        <div class="indicator-row">
          <span class="ind-label">VWAP</span>
          <span class="ind-value" style="color:var(--blue)">\${indicators.vwap < 100 ? "$" + indicators.vwap.toFixed(4) : "$" + indicators.vwap.toFixed(2)}</span>
        </div>
        <div class="indicator-row">
          <span class="ind-label">RSI(3)</span>
          <span class="ind-value" style="color:var(--yellow)">\${indicators.rsi3 !== null ? indicators.rsi3.toFixed(2) : "N/A"}</span>
        </div>
        <div class="indicator-row">
          <span class="ind-label">Bias</span>
          <span class="ind-value \${biasClass(biasVal)}">\${biasVal}</span>
        </div>
        <div class="indicator-row">
          <span class="ind-label">Volatility</span>
          \${latest.volatility
            ? \`<span class="ind-value" style="color:\${latest.volatility.stable ? "var(--green)" : "var(--yellow)"}">\${latest.volatility.stable ? "✅ Stable" : "⚠️ Chaotic"}</span>\`
            : \`<span class="ind-value" style="color:var(--muted)">—</span>\`}
        </div>
        <div class="indicator-row">
          <span class="ind-label">Leverage</span>
          \${latest.effectiveLeverage
            ? \`<span class="ind-value" style="color:\${latest.volatility?.stable ? "var(--blue)" : "var(--yellow)"}">\${latest.effectiveLeverage}x \${latest.volatility?.stable ? "" : "(capped — chaotic)"}</span>\`
            : \`<span class="ind-value" style="color:var(--muted)">—</span>\`}
        </div>
        <div class="indicator-row">
          <span class="ind-label">Checked</span>
          <span class="ind-value" style="font-size:13px;color:var(--muted)">\${new Date(timestamp).toUTCString().replace(" GMT","").slice(0,-4)} UTC</span>
        </div>
      \`;

      renderSafetyCheck(latest);
    }

    const safe = (name, fn) => { try { fn(); } catch (e) { console.warn("[render]", name, "failed:", e.message); } };
    safe("portfolio", () => renderPortfolioPanel(data.portfolioState, data.perfState, data.position, livePrice));
    safe("capital",   () => renderCapitalPanel(data.capitalState, data.paperPnL));
    safe("perf",      () => renderPerfPanel(data.perfState, data.modeWinLoss, data.control));
    safe("control",   () => renderControl(data.control));
    safe("liveStatus",() => renderLiveStatus(data));
    safe("position",  () => renderPosition(data.position, data.latest?.price));
    lastRenderData = data;
    safe("tradeTable", () => renderTradeTable(recentTrades));
    safe("reasoning",  () => renderReasoning(data.recentLogs));
    safe("health",     () => renderHealthStatus(data.latest));
    safe("rsiHistory", () => renderRSIHistory(data.allLogs));
    safe("checkLog",   () => renderCheckLog(data.allLogs));
    safe("heatmap",    () => renderHeatmap(data.allLogs));
    safe("statusBar",     () => renderStatusBar(data));
    safe("tradingStatus", () => renderTradingStatus());
    safe("riskAlertFeed", () => renderRiskAlertFeed(data));
    safe("v2Shadow",      () => renderV2Shadow(data));
    safe("lastDecision",  () => renderLastDecision(data.latest));
  }

  // ── SSE live stream ────────────────────────────────────────────────────────
  // Phase 6c — track timestamp of last successful SSE event so a 5s checker
  // can surface a non-scary pill when the stream goes silent. Phase 6e —
  // exponential backoff on reconnect (3s → 30s cap, reset on success).
  let _lastSSEEventAt = Date.now();
  let _sseAttempts = 0;

  function connectStream() {
    const es = new EventSource("/api/stream");

    es.addEventListener("data", e => {
      _lastSSEEventAt = Date.now();
      _sseAttempts = 0;
      try { render(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener("balance", e => {
      _lastSSEEventAt = Date.now();
      _sseAttempts = 0;
      try { renderBalance(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener("error", () => {
      es.close();
      _sseAttempts++;
      const delay = Math.min(3000 * Math.pow(2, _sseAttempts - 1), 30000);
      setTimeout(connectStream, delay);
    });
  }
  connectStream();

  function checkStreamHealth() {
    const el = document.getElementById("pill-stream");
    if (!el) return;
    const ageMs = Date.now() - _lastSSEEventAt;
    if (ageMs < 15000) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    const s = Math.round(ageMs / 1000);
    if (ageMs < 30000) {
      el.className = "pill pill-stream-warn";
      el.textContent = "Stream: slow (" + s + "s)";
    } else {
      el.className = "pill pill-stream-err";
      el.textContent = "Stream: offline (" + s + "s)";
    }
  }
  setInterval(checkStreamHealth, 5000);

  // ── Kraken WebSocket — real-time live price ───────────────────────────────
  let livePrice = null;

  let prevTickerPrice = null;
  let sessionOpenPrice = null;
  let priceHigh = null, priceLow = null;
  let priceHistory = []; // last 60 ticks for sparkline
  let portfolioHistory = []; // last 60 portfolio values for sparkline
  let portfolioOpenValue = null;

  function updateLivePrice(price) {
    livePrice = price;
    if (sessionOpenPrice === null) sessionOpenPrice = price;
    if (priceHigh === null || price > priceHigh) priceHigh = price;
    if (priceLow  === null || price < priceLow)  priceLow  = price;

    // Hero ticker
    const tp = document.getElementById("ticker-price");
    const ta = document.getElementById("ticker-arrow");
    const tpnl = document.getElementById("ticker-pnl");
    const trange = document.getElementById("ticker-range");
    if (tp)   { tp.textContent = "$" + price.toFixed(4); tp.classList.remove("skeleton"); }
    if (ta && prevTickerPrice !== null) {
      if (price > prevTickerPrice)      { ta.textContent = "▲"; ta.className = "ticker-arrow up"; if (tp) tp.style.color = "var(--green)"; }
      else if (price < prevTickerPrice) { ta.textContent = "▼"; ta.className = "ticker-arrow down"; if (tp) tp.style.color = "var(--red)"; }
      setTimeout(() => { if (tp) tp.style.color = "var(--text)"; }, 600);
    }
    if (tpnl && sessionOpenPrice) {
      const pct = ((price - sessionOpenPrice) / sessionOpenPrice) * 100;
      const sign = pct >= 0 ? "+" : "";
      tpnl.textContent = sign + pct.toFixed(3) + "%";
      tpnl.style.color = pct > 0 ? "var(--green)" : pct < 0 ? "var(--red)" : "var(--muted)";
    }
    if (trange && priceHigh && priceLow) trange.textContent = "$" + priceLow.toFixed(4) + " — $" + priceHigh.toFixed(4);
    prevTickerPrice = price;

    // Update price in indicators panel
    const rows = document.querySelectorAll("#indicators-content .indicator-row");
    if (rows.length > 0) {
      const val = rows[0].querySelector(".ind-value");
      if (val) val.textContent = "$" + price.toFixed(4);
    }

    // Update open position P&L + bar live
    if (lastRenderData?.position?.open) renderPosition(lastRenderData.position, price);
    if (lastRenderData) {
      renderPortfolioPanel(lastRenderData.portfolioState, lastRenderData.perfState, lastRenderData.position, price);
      renderStatusBar(lastRenderData);
    }

    // Push to sparkline history (keep last 60 ticks)
    priceHistory.push(price);
    if (priceHistory.length > 60) priceHistory.shift();
    renderSparkline();

    // Update portfolio sparkline + hero value
    updatePortfolioLive(price);
  }

  function updatePortfolioLive(price) {
    if (!lastRenderData) return;
    const port = lastRenderData.portfolioState || {};
    const pos  = lastRenderData.position;
    const realized = parseFloat(port.realizedPnl || 0);
    const baseBalance = parseFloat(port.totalBalanceUSD || 100);
    const unrealized = pos?.open ? ((price - pos.entryPrice) / pos.entryPrice * pos.tradeSize) : 0;
    const totalValue = baseBalance + unrealized;

    if (portfolioOpenValue === null) portfolioOpenValue = totalValue;
    portfolioHistory.push(totalValue);
    if (portfolioHistory.length > 60) portfolioHistory.shift();

    const hv = document.getElementById("port-hero-value");
    const hc = document.getElementById("port-hero-change");
    if (hv) hv.textContent = "$" + totalValue.toFixed(2);
    if (hc && portfolioOpenValue) {
      const change    = totalValue - portfolioOpenValue;
      const changePct = (change / portfolioOpenValue) * 100;
      const sign = change >= 0 ? "+" : "";
      hc.textContent = sign + "$" + Math.abs(change).toFixed(2) + " (" + sign + changePct.toFixed(3) + "%)";
      hc.style.color = change > 0 ? "var(--green)" : change < 0 ? "var(--red)" : "var(--muted)";
      if (hv) hv.style.color = change > 0 ? "var(--green)" : change < 0 ? "var(--red)" : "var(--text)";
    }

    renderPortfolioSparkline();
  }

  function renderPortfolioSparkline() {
    const svg = document.getElementById("portfolio-sparkline");
    if (!svg || portfolioHistory.length < 2) return;
    const w = 180, h = 40;
    const min = Math.min(...portfolioHistory), max = Math.max(...portfolioHistory);
    const range = (max - min) || 0.001;
    const pts = portfolioHistory.map((v, i) => {
      const x = (i / (portfolioHistory.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    const last = portfolioHistory[portfolioHistory.length - 1];
    const first = portfolioHistory[0];
    const color = last >= first ? "#00FF9A" : "#FF4D6A";
    const fillColor = last >= first ? "rgba(0,255,154,0.12)" : "rgba(255,77,106,0.12)";
    // Build area fill path
    const areaPath = "M0," + h + " L" + pts.replace(/,/g, " ").split(" ").map((v,i) => i % 2 === 0 ? v : v).join(",").replace(/,([0-9.]+),/g, ' L$1,').replace(/^L/,'') + " L" + w + "," + h + " Z";
    svg.innerHTML =
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + (w).toFixed(1) + '" cy="' + (h - ((last - min) / range) * (h - 4) - 2).toFixed(1) + '" r="3" fill="' + color + '"/>';
  }

  function renderSparkline() {
    const svg = document.getElementById("ticker-sparkline");
    if (!svg || priceHistory.length < 2) return;
    const w = 120, h = 28;
    const min = Math.min(...priceHistory), max = Math.max(...priceHistory);
    const range = (max - min) || 0.0001;
    const pts = priceHistory.map((p, i) => {
      const x = (i / (priceHistory.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    const last = priceHistory[priceHistory.length - 1];
    const first = priceHistory[0];
    const color = last >= first ? "#00FF9A" : "#FF4D6A";
    svg.innerHTML = '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  // Phase 6e — exponential backoff on Kraken WS reconnect (3s → 30s cap).
  let _wsAttempts = 0;
  function connectTickerWS() {
    const ws = new WebSocket("wss://ws.kraken.com");
    ws.onopen = () => { wsConnected = true; ws.send(JSON.stringify({ event: "subscribe", pair: ["XRP/USD"], subscription: { name: "ticker" } })); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (Array.isArray(msg) && msg[2] === "ticker") {
          _wsAttempts = 0;
          updateLivePrice(parseFloat(msg[1].c[0]));
        }
      } catch {}
    };
    ws.onclose = () => {
      wsConnected = false;
      _wsAttempts++;
      const delay = Math.min(3000 * Math.pow(2, _wsAttempts - 1), 30000);
      setTimeout(connectTickerWS, delay);
    };
    ws.onerror  = () => { wsConnected = false; ws.close(); };
  }
  connectTickerWS();

  // ── Agent Avila Chatbox ───────────────────────────────────────────────────
  let chatOpen = false;
  let chatHistory = [];
  let chatPending = false;

  function toggleChat() {
    chatOpen = !chatOpen;
    document.getElementById("chat-panel").classList.toggle("open", chatOpen);
    document.getElementById("chat-unread").style.display = "none";
    if (chatOpen) setTimeout(() => document.getElementById("chat-input")?.focus(), 200);
  }

  function appendMsg(text, type, id) {
    const msgs = document.getElementById("chat-messages");
    const div  = document.createElement("div");
    div.className = "chat-msg " + type;
    div.innerHTML = text.replace(/\\n/g, "<br>").replace(/\\[EXECUTE:[^\\]]+\\]/g, "").replace(/\\[CONFIRM_REQUIRED\\]/g, "");
    if (id) div.id = id;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function chatKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
  }

  function sendSuggestion(text) {
    document.getElementById("chat-input").value = text;
    sendChat();
  }

  async function sendChat() {
    const input = document.getElementById("chat-input");
    const msg   = input.value.trim();
    if (!msg || chatPending) return;
    input.value = "";
    input.style.height = "auto";

    appendMsg(msg, "chat-msg-user");
    chatHistory.push({ role: "user", content: msg });

    chatPending = true;
    const typingEl = appendMsg("typing…", "chat-typing", "chat-typing-indicator");
    document.getElementById("chat-status").textContent = "Thinking...";

    try {
      const res  = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, history: chatHistory.slice(-8) }) });
      const data = await res.json();
      typingEl.remove();

      const reply = data.reply || "No response.";
      const cleanReply = reply.replace(/\\[EXECUTE:[^\\]]+\\]/g, "").replace(/\\[CONFIRM_REQUIRED\\]/g, "").trim();
      appendMsg(cleanReply, "chat-msg-bot");
      chatHistory.push({ role: "assistant", content: reply });

      // Show executed commands
      if (data.executed?.length) {
        appendMsg("✅ Executed: " + data.executed.join(", "), "chat-msg-executed");
      }

      // Show confirmation request
      if (data.confirmRequired && data.commands?.length) {
        const cmd = data.commands[0].cmd;
        const confirmDiv = document.createElement("div");
        confirmDiv.className = "chat-msg chat-msg-confirm";
        const friendly = (() => {
          const parts = cmd.split(" ");
          const c = parts[0]; const v = parts.slice(1).join(" ");
          const map = {
            SET_RISK:        "Reduce risk to " + v + "%",
            SET_LEVERAGE:    "Change leverage to " + v + "×",
            SET_MAX_DAILY_LOSS: "Set max daily loss to " + v + "%",
            SET_COOLDOWN:    "Set cooldown to " + v + " min",
            PAUSE_TRADING:   "Pause all trading",
            RESUME_TRADING:  "Resume trading",
            STOP_BOT:        "Stop the bot",
            START_BOT:       "Start the bot",
            SET_MODE_LIVE:   "Switch to LIVE trading mode",
            SET_MODE_PAPER:  "Switch to PAPER trading mode",
            CLOSE_POSITION:  "Close the open position",
            SELL_ALL:        "Sell ALL XRP holdings",
          };
          return map[c] || cmd;
        })();
        confirmDiv.innerHTML = \`⚠ About to execute: <strong>\${friendly}</strong><div class="chat-confirm-btns"><button class="chat-confirm-yes" onclick="confirmChatCmd('\${cmd}', this)">Confirm</button><button class="chat-confirm-no" onclick="this.closest('.chat-msg').remove()">Cancel</button></div>\`;
        document.getElementById("chat-messages").appendChild(confirmDiv);
        document.getElementById("chat-messages").scrollTop = 999999;
      }

      document.getElementById("chat-status").textContent = "Ask me anything about your bot";
      if (!chatOpen) { document.getElementById("chat-unread").style.display = "flex"; }

    } catch (e) {
      typingEl.remove();
      appendMsg("❌ Error contacting assistant: " + e.message, "chat-msg-bot");
      document.getElementById("chat-status").textContent = "Error — try again";
    }
    chatPending = false;
  }

  async function confirmChatCmd(cmd, btn) {
    btn.closest(".chat-msg").remove();
    const parts = cmd.split(" ");
    try {
      const res  = await fetch("/api/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: parts[0], value: parts.slice(1).join(" ") || undefined }) });
      const data = await res.json();
      if (data.ok) appendMsg("✅ Confirmed and executed: " + cmd, "chat-msg-executed");
      else appendMsg("❌ Failed: " + (data.error || "unknown error"), "chat-msg-bot");
    } catch (e) { appendMsg("❌ " + e.message, "chat-msg-bot"); }
  }

  // ── TradingView Widget ────────────────────────────────────────────────────
  let tvWidget = null;
  function initTradingViewWidget() {
    if (typeof TradingView === "undefined") { setTimeout(initTradingViewWidget, 500); return; }
    if (tvWidget) return;
    tvWidget = new TradingView.widget({
      container_id: "tv_chart",
      symbol: "KRAKEN:XRPUSD",
      interval: "5",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      autosize: true,
      hide_side_toolbar: false,
      toolbar_bg: "#0B0F1A",
      backgroundColor: "#0B0F1A",
      gridColor: "rgba(48,54,61,0.3)",
      studies: ["MAExp@tv-basicstudies", "VWAP@tv-basicstudies", "RSI@tv-basicstudies"],
      withdateranges: true,
      hide_volume: false,
    });
  }
  initTradingViewWidget();
</script>
</body>
</html>`;

// ─── Homepage (Phase 2 — minimal splash) ─────────────────────────────────────
// Shows only: bot status, current mode, XRP price, last decision, and two
// big buttons to /paper and /live. No trading data is rendered here. The
// detailed legacy UI is preserved at /dashboard for power users and tests.
//
// Phase 8b — homepagePage(initial) embeds initial data inline so the cards
// render real values on first paint instead of "—". Falls back to fetch if
// initial is null/undefined or malformed.

function homepagePage(initial) {
  // Escape </ inside JSON to keep the closing </script> unambiguous.
  const initialJson = JSON.stringify(initial || null).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Avila</title>
<!-- Phase 8f — warm TLS to Kraken WSS host so the ticker subscription is fast. -->
<link rel="preconnect" href="https://ws.kraken.com" crossorigin>
<style>
  /* Phase 8c — futuristic terminal palette. */
  :root {
    --bg-deep:#040711; --bg-base:#0A0F1A;
    --text:#E6EAF1; --muted:#7A8499; --line:rgba(255,255,255,0.08);
    --cyan:#00D4FF; --magenta:#FF00C8;
    --green:#00FF9A; --yellow:#FFC107; --red:#FF4D6A;
  }
  * { box-sizing:border-box; }
  body {
    color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    margin:0; min-height:100vh; padding:24px;
    display:flex; align-items:center; justify-content:center;
    /* Layered radial gradients for depth — no JS, no animation cost. */
    background:
      radial-gradient(ellipse 80% 50% at 50% 0%,   rgba(0,212,255,0.05)  0%, transparent 60%),
      radial-gradient(ellipse 80% 50% at 50% 100%, rgba(255,0,200,0.04)  0%, transparent 60%),
      linear-gradient(180deg, var(--bg-base) 0%, var(--bg-deep) 100%);
    background-attachment:fixed;
  }
  /* Subtle blueprint grid behind content (2% opacity). */
  body::before {
    content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
    background-image:
      linear-gradient(rgba(255,255,255,0.020) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.020) 1px, transparent 1px);
    background-size:50px 50px;
    mask-image:radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%);
    -webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%);
  }
  .splash { position:relative; z-index:1; max-width:720px; width:100%; }
  .hero-head { text-align:center; margin-bottom:18px; }
  h1 {
    font-size:32px; margin:0 0 4px; letter-spacing:0.5px; font-weight:800;
    background:linear-gradient(90deg, var(--text) 0%, var(--cyan) 50%, var(--magenta) 100%);
    -webkit-background-clip:text; background-clip:text;
    -webkit-text-fill-color:transparent; color:transparent;
  }
  .tagline { color:var(--muted); font-size:11px; letter-spacing:2.5px; text-transform:uppercase; font-weight:500; }
  /* Phase 8d — hero price section. Centered, big, mono digits. */
  .hero-price-section {
    text-align:center; margin:8px 0 24px; padding:24px 16px;
    background:rgba(20,28,45,0.35);
    -webkit-backdrop-filter:blur(20px) saturate(160%); backdrop-filter:blur(20px) saturate(160%);
    border:1px solid var(--line); border-radius:18px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.25);
  }
  .hero-price-label { font-size:10px; color:var(--muted); letter-spacing:2.5px; text-transform:uppercase; margin-bottom:8px; font-weight:700; }
  .hero-price {
    font-size:60px; font-weight:800; line-height:1; letter-spacing:-1.5px;
    font-variant-numeric:tabular-nums;
    background:linear-gradient(180deg, var(--text) 0%, rgba(230,234,241,0.65) 100%);
    -webkit-background-clip:text; background-clip:text;
    -webkit-text-fill-color:transparent; color:transparent;
    transition:background 0.4s ease;
  }
  .hero-price.flash-up   { animation:heroFlashUp   600ms ease-out; }
  .hero-price.flash-down { animation:heroFlashDown 600ms ease-out; }
  @keyframes heroFlashUp   { 0% { color:var(--green); -webkit-text-fill-color:var(--green); text-shadow:0 0 28px rgba(0,255,154,0.55); } 100% { -webkit-text-fill-color:transparent; text-shadow:none; } }
  @keyframes heroFlashDown { 0% { color:var(--red);   -webkit-text-fill-color:var(--red);   text-shadow:0 0 28px rgba(255,77,106,0.55); } 100% { -webkit-text-fill-color:transparent; text-shadow:none; } }
  .hero-price-sub { font-size:12px; color:var(--muted); margin-top:8px; letter-spacing:0.5px; }
  /* Phase 8d — status badges row. */
  .badge-row { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-bottom:24px; }
  .badge {
    padding:6px 12px; border-radius:999px;
    background:rgba(20,28,45,0.55);
    -webkit-backdrop-filter:blur(20px); backdrop-filter:blur(20px);
    border:1px solid var(--line);
    font-size:11px; font-weight:600; letter-spacing:0.5px;
    color:var(--muted);
    transition:border-color 0.18s ease, color 0.18s ease;
  }
  .badge.running       { color:var(--green); border-color:rgba(0,255,154,0.4); }
  .badge.stopped       { color:var(--red);   border-color:rgba(255,77,106,0.4); }
  .badge.paused        { color:var(--yellow);border-color:rgba(255,193,7,0.4); }
  .badge.mode-paper    { color:var(--cyan);    border-color:rgba(0,212,255,0.4); }
  .badge.mode-live     { color:var(--magenta); border-color:rgba(255,0,200,0.4); }
  .badge.dec-buy       { color:var(--green); border-color:rgba(0,255,154,0.4); }
  .badge.dec-exit      { color:var(--red);   border-color:rgba(255,77,106,0.4); }
  .badge.dec-blocked   { color:var(--muted); }
  /* Phase 8d — mode cards (replaces the old big-btn pair). */
  .mode-cards { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:24px; }
  .mode-card {
    display:block; text-decoration:none; color:var(--text);
    padding:20px;
    background:linear-gradient(135deg, rgba(20,28,45,0.70) 0%, rgba(15,22,35,0.50) 100%);
    -webkit-backdrop-filter:blur(20px) saturate(160%); backdrop-filter:blur(20px) saturate(160%);
    border:1px solid var(--line); border-radius:16px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.25);
    transition:transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .mode-card.paper { border-color:rgba(0,212,255,0.32); }
  .mode-card.live  { border-color:rgba(255,0,200,0.32); }
  .mode-card:hover { transform:translateY(-2px); }
  .mode-card.paper:hover { border-color:rgba(0,212,255,0.65); box-shadow:0 0 32px rgba(0,212,255,0.22), 0 12px 36px rgba(0,0,0,0.5); }
  .mode-card.live:hover  { border-color:rgba(255,0,200,0.65); box-shadow:0 0 32px rgba(255,0,200,0.22), 0 12px 36px rgba(0,0,0,0.5); }
  .mode-card-head { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
  .mode-card-icon { width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:16px; font-weight:700; }
  .mode-card.paper .mode-card-icon { color:var(--cyan);    background:rgba(0,212,255,0.10);   border:1px solid rgba(0,212,255,0.3); }
  .mode-card.live  .mode-card-icon { color:var(--magenta); background:rgba(255,0,200,0.10);   border:1px solid rgba(255,0,200,0.3); }
  .mode-card-title { font-size:13px; font-weight:700; flex:1; letter-spacing:1px; text-transform:uppercase; }
  .mode-card.paper .mode-card-title { color:var(--cyan); }
  .mode-card.live  .mode-card-title { color:var(--magenta); }
  .mode-card-arrow { color:var(--muted); font-size:18px; transition:transform 0.2s ease, color 0.2s ease; }
  .mode-card:hover .mode-card-arrow { color:var(--text); transform:translateX(3px); }
  .mode-card-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .mode-stat { min-width:0; }
  .mode-stat-label { font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:4px; font-weight:600; }
  .mode-stat-value { font-size:14px; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pos-good { color:var(--green); } .pos-bad { color:var(--red); }
  .footer { font-size:13px; color:var(--muted); text-align:center; }
  .footer a { color:var(--muted); text-decoration:none; margin:0 8px; transition:color 0.18s ease; }
  .footer a:hover { color:var(--text); }
  @media (max-width: 600px) {
    .mode-cards { grid-template-columns:1fr; }
    .hero-price { font-size:44px; }
    h1 { font-size:26px; }
  }
  /* Phase 6a — stale-data banner. Non-scary; only appears after 20s without
     a successful refresh. Yellow at 20–60s ("retrying"), red after 60s.
     Phase 7a — when visible, body gets .with-stale-banner so the splash
     content shifts below the fixed banner instead of overlapping it. */
  .stale-banner { position:fixed; top:0; left:0; right:0; padding:8px 16px; text-align:center; font-size:13px; font-weight:500; z-index:1000; }
  .stale-banner.stale-warn { background:rgba(255,193,7,0.15); color:#ffc107; border-bottom:1px solid rgba(255,193,7,0.4); }
  .stale-banner.stale-err  { background:rgba(239,68,68,0.18); color:#ef4444; border-bottom:1px solid rgba(239,68,68,0.4); }
  body.with-stale-banner { padding-top:56px; }
  /* Phase 8b — skeleton loaders. Animated shimmer bar that approximates the
     shape of the eventual content. Hidden once real data lands. */
  @keyframes skel-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  .skel { display:inline-block; vertical-align:middle; border-radius:4px; background:linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.05) 100%); background-size:200% 100%; animation:skel-shimmer 1.4s linear infinite; }
  .skel-line { width:80%; height:1.1em; }
</style>
</head>
<body>
<div id="stale-banner" class="stale-banner" style="display:none"></div>
<div class="splash">
  <header class="hero-head">
    <h1>Agent Avila</h1>
    <div class="tagline">Command Center &middot; XRP/USDT &middot; 5m</div>
  </header>

  <section class="hero-price-section">
    <div class="hero-price-label">XRP / USD</div>
    <div class="hero-price" id="hp-price">&mdash;</div>
    <div class="hero-price-sub" id="hp-price-sub">connecting&hellip;</div>
  </section>

  <div class="badge-row">
    <span class="badge" id="hp-status-badge"><span class="skel skel-line" style="width:60px"></span></span>
    <span class="badge" id="hp-mode-badge"><span class="skel skel-line" style="width:50px"></span></span>
    <span class="badge" id="hp-decision-badge"><span class="skel skel-line" style="width:70px"></span></span>
  </div>

  <div class="mode-cards">
    <a class="mode-card paper" href="/paper">
      <div class="mode-card-head">
        <span class="mode-card-icon">◆</span>
        <span class="mode-card-title">Paper Dashboard</span>
        <span class="mode-card-arrow">&rarr;</span>
      </div>
      <div class="mode-card-stats">
        <div class="mode-stat"><div class="mode-stat-label">Balance</div><div class="mode-stat-value" id="hp-paper-balance"><span class="skel skel-line"></span></div></div>
        <div class="mode-stat"><div class="mode-stat-label">W/L</div><div class="mode-stat-value" id="hp-paper-wl"><span class="skel skel-line"></span></div></div>
        <div class="mode-stat"><div class="mode-stat-label">P&amp;L</div><div class="mode-stat-value" id="hp-paper-pnl"><span class="skel skel-line"></span></div></div>
      </div>
    </a>

    <a class="mode-card live" href="/live">
      <div class="mode-card-head">
        <span class="mode-card-icon">⬢</span>
        <span class="mode-card-title">Live Dashboard</span>
        <span class="mode-card-arrow">&rarr;</span>
      </div>
      <div class="mode-card-stats">
        <div class="mode-stat"><div class="mode-stat-label">Kraken</div><div class="mode-stat-value" id="hp-live-balance">via /live</div></div>
        <div class="mode-stat"><div class="mode-stat-label">W/L</div><div class="mode-stat-value" id="hp-live-wl"><span class="skel skel-line"></span></div></div>
        <div class="mode-stat"><div class="mode-stat-label">P&amp;L</div><div class="mode-stat-value" id="hp-live-pnl"><span class="skel skel-line"></span></div></div>
      </div>
    </a>
  </div>

  <div class="footer">
    <a href="/dashboard">Detailed view</a> &middot; <a href="/logout">Logout</a>
  </div>
</div>
<script>
// Phase 8b — inline initial data injected by server. Falsy if unavailable.
window.__INIT__ = ${initialJson};

// Phase 6a — refresh reliability state.
let _lastOk = Date.now(), _inflight = false, _hidden = false;

// Phase 8d — small format helpers shared by mode cards.
function _fmtUSD(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const s = (n >= 0 ? "+" : "−") + "$" + Math.abs(n).toFixed(2);
  return s;
}
function _setBadge(el, label, cls) {
  if (!el) return;
  el.textContent = label;
  el.className   = "badge " + (cls || "");
}

function renderHome(d) {
  const ctrl = d.control || {};

  // Status badge.
  let st = "Running", cls = "running";
  if (ctrl.killed)        { st = "Killed";  cls = "stopped"; }
  else if (ctrl.stopped)  { st = "Stopped"; cls = "stopped"; }
  else if (ctrl.paused)   { st = "Paused";  cls = "paused";  }
  _setBadge(document.getElementById("hp-status-badge"), "● " + st, cls);

  // Mode badge.
  const isPaperMode = ctrl.paperTrading !== false;
  _setBadge(document.getElementById("hp-mode-badge"), isPaperMode ? "◆ Paper" : "⬢ Live", isPaperMode ? "mode-paper" : "mode-live");

  // Hero price (replaced by WS tick if/when available).
  const px = d.latest && d.latest.price;
  const heroEl = document.getElementById("hp-price");
  if (heroEl && !heroEl.dataset.wsLive) {
    heroEl.textContent = px ? "$" + Number(px).toFixed(4) : "—";
  }
  const subEl = document.getElementById("hp-price-sub");
  if (subEl && !subEl.dataset.wsLive) {
    subEl.textContent = px ? "from latest log entry" : "no price data yet";
  }

  // Last decision badge.
  let dec = "—", decCls = "";
  if (d.latest) {
    const t = d.latest.type;
    if (t === "EXIT")              { dec = "EXIT · " + (d.latest.exitReason || "—"); decCls = "dec-exit"; }
    else if (t === "BUY" || t === "BUY_REENTRY" || t === "MANUAL_BUY") { dec = t; decCls = "dec-buy"; }
    else if (t)                    { dec = t; decCls = "dec-blocked"; }
    else                           { dec = d.latest.allPass ? "PASS" : "BLOCKED"; decCls = "dec-blocked"; }
  }
  _setBadge(document.getElementById("hp-decision-badge"), dec, decCls);

  // Paper mode mini-stats.
  const p = d.paper;
  if (p) {
    document.getElementById("hp-paper-balance").textContent = "$" + Number(p.balance).toFixed(2);
    const pwl = p.winLoss;
    document.getElementById("hp-paper-wl").textContent = pwl && pwl.total ? (pwl.wins + "W / " + pwl.losses + "L") : "—";
    const pPnL = p.pnl ? p.pnl.totalUSD : 0;
    const pEl  = document.getElementById("hp-paper-pnl");
    pEl.textContent = _fmtUSD(pPnL);
    pEl.className   = "mode-stat-value " + (pPnL > 0 ? "pos-good" : pPnL < 0 ? "pos-bad" : "");
  }

  // Live mode mini-stats. Balance comes from /live (Kraken); not on home.
  const l = d.live;
  if (l) {
    const lwl = l.winLoss;
    document.getElementById("hp-live-wl").textContent = lwl && lwl.total ? (lwl.wins + "W / " + lwl.losses + "L") : "—";
    const lPnL = l.pnl ? l.pnl.totalUSD : 0;
    const lEl  = document.getElementById("hp-live-pnl");
    lEl.textContent = lwl && lwl.total ? _fmtUSD(lPnL) : "—";
    lEl.className   = "mode-stat-value " + (lPnL > 0 ? "pos-good" : lPnL < 0 ? "pos-bad" : "");
  }
}

async function loadHome() {
  try {
    const r = await fetch("/api/home-summary", { credentials: "same-origin" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    renderHome(d);
  } catch (e) {
    _setBadge(document.getElementById("hp-status-badge"), "● Unavailable", "stopped");
    throw e;
  }
}

// Phase 8b — paint inline data immediately so first frame isn't skeletons.
if (window.__INIT__) {
  try { renderHome(window.__INIT__); _lastOk = Date.now(); } catch (e) { console.warn("[__INIT__]", e.message); }
}

// Phase 8d — Kraken WebSocket for real-time hero price + flash on tick.
// Falls back silently to polled price (from log entry) if WS fails.
let _hpWsPrice = null;
let _hpWsAttempts = 0;
function _hpWsBackoff() { return Math.min(3000 * Math.pow(2, _hpWsAttempts - 1), 30000); }
function connectHomeTickerWS() {
  let ws;
  try { ws = new WebSocket("wss://ws.kraken.com"); }
  catch (e) { _hpWsAttempts++; setTimeout(connectHomeTickerWS, _hpWsBackoff()); return; }
  ws.onopen = () => {
    try { ws.send(JSON.stringify({ event: "subscribe", pair: ["XRP/USD"], subscription: { name: "ticker" } })); } catch {}
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (Array.isArray(msg) && msg[2] === "ticker") {
        const newPrice = parseFloat(msg[1].c[0]);
        const heroEl = document.getElementById("hp-price");
        const subEl  = document.getElementById("hp-price-sub");
        if (!heroEl) return;
        const direction = (_hpWsPrice !== null && newPrice !== _hpWsPrice) ? (newPrice > _hpWsPrice ? "up" : "down") : null;
        _hpWsPrice = newPrice;
        _hpWsAttempts = 0;
        heroEl.textContent = "$" + newPrice.toFixed(4);
        heroEl.dataset.wsLive = "1"; // tells renderHome to stop overwriting from log
        if (subEl) { subEl.textContent = "● live · Kraken"; subEl.dataset.wsLive = "1"; }
        if (direction) {
          heroEl.classList.remove("flash-up", "flash-down");
          void heroEl.offsetWidth; // restart animation
          heroEl.classList.add(direction === "up" ? "flash-up" : "flash-down");
        }
      }
    } catch {}
  };
  ws.onclose = () => {
    _hpWsAttempts++;
    const heroEl = document.getElementById("hp-price");
    if (heroEl) delete heroEl.dataset.wsLive;
    const subEl = document.getElementById("hp-price-sub");
    if (subEl) { subEl.textContent = "reconnecting…"; delete subEl.dataset.wsLive; }
    setTimeout(connectHomeTickerWS, _hpWsBackoff());
  };
  ws.onerror = () => { try { ws.close(); } catch {} };
}
connectHomeTickerWS();

// Phase 8f — prefetch /paper and /live HTML so the next click feels instant.
// Once-only per session. Hovers cover desktop; idle timer covers mobile/early
// clickers. Browser keeps prefetched responses for ~5 min.
const _prefetched = { "/paper": false, "/live": false };
function prefetchOnce(path) {
  if (_prefetched[path]) return;
  _prefetched[path] = true;
  try {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = path;
    document.head.appendChild(link);
  } catch {}
}
const _paperTile = document.querySelector(".mode-card.paper");
const _liveTile  = document.querySelector(".mode-card.live");
if (_paperTile) _paperTile.addEventListener("mouseenter", () => prefetchOnce("/paper"), { once: true });
if (_liveTile)  _liveTile .addEventListener("mouseenter", () => prefetchOnce("/live"),  { once: true });
// Mobile/keyboard fallback: warm both routes 1.5s after page settles.
window.addEventListener("load", () => {
  setTimeout(() => { prefetchOnce("/paper"); prefetchOnce("/live"); }, 1500);
});

async function safePoll() {
  if (_inflight || _hidden) return;
  _inflight = true;
  try { await loadHome(); _lastOk = Date.now(); }
  catch (e) { /* banner takes over */ }
  finally { _inflight = false; }
}

function showStale() {
  const el = document.getElementById("stale-banner");
  if (!el) return;
  const ageMs = Date.now() - _lastOk;
  if (ageMs < 20000) {
    el.style.display = "none";
    document.body.classList.remove("with-stale-banner");
    return;
  }
  el.style.display = "block";
  document.body.classList.add("with-stale-banner");
  const s = Math.round(ageMs / 1000);
  if (ageMs < 60000) {
    el.className = "stale-banner stale-warn";
    el.textContent = "Last updated " + s + "s ago — retrying…";
  } else {
    el.className = "stale-banner stale-err";
    el.textContent = "Connection issue — last update " + s + "s ago.";
  }
}

document.addEventListener("visibilitychange", () => {
  _hidden = document.hidden;
  if (!_hidden) safePoll();
});

safePoll();
setInterval(safePoll, 10000);
setInterval(showStale, 1000);
</script>
</body>
</html>`;
}

// ─── Mode pages: /paper and /live (Phase 1 — data separation only) ───────────
// These are deliberately minimal HTML so the existing main "/" dashboard is
// untouched. Each page fetches a single mode-scoped JSON endpoint and renders
// it. Controls reuse the existing /api/control endpoint. No paper/live mixing.

function modePage(mode, initial) {
  const isPaper = mode === "paper";
  const title   = isPaper ? "Paper Trading" : "Live Trading";
  const apiUrl  = isPaper ? "/api/paper-summary" : "/api/live-summary";
  const otherRoute = isPaper ? "/live" : "/paper";
  const otherLabel = isPaper ? "Live" : "Paper";
  // Phase 8c — cyan for paper, magenta for live (matching Phase 8a brief).
  const accent  = isPaper ? "#00D4FF" : "#FF00C8";
  const accentSoft = isPaper ? "rgba(0,212,255,0.12)" : "rgba(255,0,200,0.12)";
  const pillBg  = isPaper ? "rgba(0,212,255,0.10)" : "rgba(255,0,200,0.10)";
  const wlLabel = isPaper ? "Paper W/L" : "Live W/L";
  const balLabel = isPaper ? "Paper Balance" : "Kraken Live Balance";
  const tradesLabel = isPaper ? "Paper Trades" : "Live Trades";
  const pnlLabel = isPaper ? "Paper P&L" : "Live P&L";
  const ctrlLabel = isPaper ? "Paper Controls" : "Live Controls";
  // Phase 8b — escape </ inside JSON to keep </script> unambiguous.
  const initialJson = JSON.stringify(initial || null).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Agent Avila</title>
<!-- Phase 8f — warm TLS to Kraken WSS host so the ticker subscription is fast. -->
<link rel="preconnect" href="https://ws.kraken.com" crossorigin>
<style>
  /* Phase 8c — futuristic terminal palette. Cyan = paper, magenta = live. */
  :root {
    --bg-deep:#040711; --bg-base:#0A0F1A;
    --card:rgba(20,28,45,0.55); --line:rgba(255,255,255,0.08);
    --muted:#7A8499; --text:#E6EAF1;
    --accent:${accent}; --accent-soft:${accentSoft};
    --green:#00FF9A; --red:#FF4D6A; --yellow:#FFC107;
  }
  * { box-sizing:border-box; }
  body {
    margin:0; color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; padding:24px;
    /* Layered radial gradients + side accent matching the active mode. */
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%,    var(--accent-soft)    0%, transparent 60%),
      radial-gradient(ellipse 80% 50% at 50% 100%,  rgba(255,0,200,0.03)  0%, transparent 60%),
      linear-gradient(180deg, var(--bg-base) 0%, var(--bg-deep) 100%);
    background-attachment:fixed;
  }
  /* Subtle blueprint grid behind content (2% opacity). */
  body::before {
    content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
    background-image:
      linear-gradient(rgba(255,255,255,0.020) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.020) 1px, transparent 1px);
    background-size:50px 50px;
    mask-image:radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%);
    -webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%);
  }
  .topbar, .grid, details.advanced { position:relative; z-index:1; }
  .topbar { display:flex; justify-content:space-between; align-items:center; max-width:1100px; margin:0 auto 24px; flex-wrap:wrap; gap:12px; }
  .topbar h1 {
    margin:0; font-size:22px; font-weight:700; letter-spacing:0.5px;
    background:linear-gradient(90deg, var(--text) 0%, var(--accent) 100%);
    -webkit-background-clip:text; background-clip:text;
    -webkit-text-fill-color:transparent; color:transparent;
  }
  .pill {
    display:inline-block; padding:5px 12px; border-radius:999px;
    background:${pillBg}; color:var(--accent);
    border:1px solid var(--line);
    font-size:12px; font-weight:600; letter-spacing:0.5px;
    transition:border-color 0.18s ease, background 0.18s ease;
  }
  .badge-warn { background:rgba(255,193,7,0.12); color:var(--yellow); padding:5px 12px; border-radius:999px; font-size:12px; border:1px solid rgba(255,193,7,0.25); }
  .nav-links a { color:var(--muted); text-decoration:none; margin-left:14px; font-size:13px; transition:color 0.18s ease; }
  .nav-links a:hover { color:var(--text); }
  /* Phase 8e — 3-col grid; hero balance + decision span the full row. */
  .grid { max-width:1100px; margin:0 auto; display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
  .hero { grid-column:1 / -1; }
  /* Glass card. */
  .card {
    background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px;
    -webkit-backdrop-filter:blur(20px) saturate(160%); backdrop-filter:blur(20px) saturate(160%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.25);
    transition:border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  }
  .card:hover { border-color:rgba(255,255,255,0.18); transform:translateY(-1px); box-shadow:inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 28px rgba(0,0,0,0.4), 0 0 24px var(--accent-soft); }
  .card-title { font-size:10px; letter-spacing:1.5px; color:var(--muted); text-transform:uppercase; margin-bottom:10px; font-weight:600; }
  .stat { font-size:28px; font-weight:700; font-variant-numeric:tabular-nums; }
  .stat-sub { font-size:13px; color:var(--muted); margin-top:4px; }
  /* Phase 8e — hero balance card: bigger padding + premium gradient + accent halo. */
  .hero-balance {
    padding:32px 28px;
    background:
      radial-gradient(ellipse 60% 100% at 50% 50%, var(--accent-soft) 0%, transparent 70%),
      var(--card);
    border-color:rgba(255,255,255,0.12);
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4), 0 0 80px var(--accent-soft);
  }
  .hero-balance .card-title { font-size:11px; letter-spacing:2px; }
  /* Parent-driven sizes so render() (which sets className="stat ...") doesn't
     need to know about the hero treatment. */
  .hero-balance .stat {
    font-size:48px; font-weight:800; line-height:1.05; letter-spacing:-1px;
    background:linear-gradient(180deg, var(--text) 0%, rgba(230,234,241,0.65) 100%);
    -webkit-background-clip:text; background-clip:text;
    -webkit-text-fill-color:transparent; color:transparent;
  }
  /* "Unavailable" state should fall back to plain muted text — gradient on
     a transparent fill would invisible-out var(--muted) otherwise. */
  .hero-balance .stat.unavail {
    background:none;
    -webkit-text-fill-color:var(--muted); color:var(--muted);
    font-style:italic; font-weight:600; font-size:24px;
  }
  .hero-balance .stat-sub { font-size:13px; margin-top:8px; }
  /* Phase 8e — decision card: wider band, slightly compact stat. */
  .hero-decision { padding:18px 24px; }
  .hero-decision .stat { font-size:22px; }
  /* Phase 8e — secondary cards — slightly compact for visual hierarchy. */
  .secondary .stat { font-size:24px; }
  .pos-good { color:var(--green); } .pos-bad { color:var(--red); }
  .unavail { color:var(--muted); font-style:italic; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:500; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; }
  .row-win td { color:var(--green); } .row-loss td { color:var(--red); }
  .ctrl-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
  .ctrl-row button {
    background:rgba(20,28,45,0.55); color:var(--text);
    border:1px solid var(--line); padding:8px 14px; border-radius:8px;
    cursor:pointer; font-size:13px; font-family:inherit;
    transition:border-color 0.18s ease, background 0.18s ease, transform 0.1s ease, box-shadow 0.18s ease;
  }
  .ctrl-row button:hover { border-color:var(--accent); background:var(--accent-soft); box-shadow:0 0 18px var(--accent-soft); transform:translateY(-1px); }
  .ctrl-row button.danger { border-color:rgba(239,68,68,0.4); color:var(--red); }
  .ctrl-row button.danger:hover { border-color:rgba(255,77,106,0.7); background:rgba(255,77,106,0.08); box-shadow:0 0 18px rgba(255,77,106,0.18); }
  .ctrl-row button:disabled { opacity:0.45; cursor:not-allowed; transform:none; box-shadow:none; }
  .balances-list { font-size:13px; }
  .balances-list .row { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--line); }
  .balances-list .row:last-child { border-bottom:0; }
  .full { grid-column:1/-1; }
  .empty { color:var(--muted); font-style:italic; padding:14px 0; }
  details.advanced { max-width:1100px; margin:24px auto 0; background:var(--card); border:1px solid var(--line); border-radius:14px; -webkit-backdrop-filter:blur(20px) saturate(160%); backdrop-filter:blur(20px) saturate(160%); box-shadow:inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.25); }
  details.advanced > summary { padding:14px 18px; cursor:pointer; font-size:13px; letter-spacing:1px; color:var(--muted); text-transform:uppercase; user-select:none; outline:none; }
  details.advanced > summary:hover { color:var(--text); }
  details.advanced[open] > summary { border-bottom:1px solid var(--line); }
  details.advanced .adv-body { padding:18px; display:flex; flex-direction:column; gap:24px; }
  .adv-section-title { font-size:11px; letter-spacing:1px; color:var(--muted); text-transform:uppercase; margin-bottom:10px; }
  /* Phase 8e — mobile: stack 3-col grid to 1 col, scale down hero. */
  @media (max-width: 700px) {
    .grid { grid-template-columns:1fr; }
    .hero-balance { padding:24px 18px; }
    .hero-balance .stat { font-size:36px; letter-spacing:-0.5px; }
    .hero-balance .stat.unavail { font-size:20px; }
    .secondary .stat { font-size:22px; }
    .hero-decision .stat { font-size:18px; }
  }
  /* Phase 6a — stale-data banner. Hidden until 20s without a successful
     refresh. Yellow at 20–60s ("retrying"), red after 60s.
     Phase 7a — when visible, body gets .with-stale-banner so the topbar
     content shifts below the fixed banner instead of overlapping it. */
  .stale-banner { position:fixed; top:0; left:0; right:0; padding:8px 16px; text-align:center; font-size:13px; font-weight:500; z-index:1000; }
  .stale-banner.stale-warn { background:rgba(255,193,7,0.15); color:#ffc107; border-bottom:1px solid rgba(255,193,7,0.4); }
  .stale-banner.stale-err  { background:rgba(239,68,68,0.18); color:#ef4444; border-bottom:1px solid rgba(239,68,68,0.4); }
  body.with-stale-banner { padding-top:56px; }
  /* Phase 6d — live-price pill. State classes override the base .pill bg/color. */
  .price-live    { background:rgba(34,197,94,0.10);  border:1px solid rgba(34,197,94,0.4); color:#22c55e; box-shadow:0 0 12px rgba(0,255,154,0.12); }
  .price-warn    { background:rgba(255,193,7,0.10);  border:1px solid rgba(255,193,7,0.4); color:#ffc107; }
  .price-err     { background:rgba(239,68,68,0.10);  border:1px solid rgba(239,68,68,0.4); color:#ef4444; }
  .price-pending { background:rgba(122,132,153,0.10);border:1px solid var(--line);          color:var(--muted); }
  /* Phase 8c — brief flash on price tick (added after a successful WS message). */
  @keyframes priceFlashUp   { 0% { background:rgba(0,255,154,0.40); border-color:var(--green); box-shadow:0 0 32px rgba(0,255,154,0.45); } 100% { background:rgba(34,197,94,0.10); border-color:rgba(34,197,94,0.4); box-shadow:0 0 12px rgba(0,255,154,0.12); } }
  @keyframes priceFlashDown { 0% { background:rgba(255,77,106,0.40); border-color:var(--red);   box-shadow:0 0 32px rgba(255,77,106,0.45); } 100% { background:rgba(34,197,94,0.10); border-color:rgba(34,197,94,0.4); box-shadow:0 0 12px rgba(0,255,154,0.12); } }
  .price-flash-up   { animation:priceFlashUp   600ms ease-out; }
  .price-flash-down { animation:priceFlashDown 600ms ease-out; }
  /* Phase 7a — small mode-switch button in the topbar. */
  .mode-switch-btn { padding:4px 10px; border-radius:999px; background:transparent; border:1px solid var(--line); color:var(--muted); cursor:pointer; font-size:12px; font-weight:500; font-family:inherit; }
  .mode-switch-btn:hover { color:var(--text); border-color:var(--accent); }
  .mode-switch-btn:disabled { opacity:0.4; cursor:not-allowed; }
  /* Phase 8b — skeleton loaders + button spinner. */
  @keyframes skel-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  .skel { display:inline-block; vertical-align:middle; border-radius:4px; background:linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.05) 100%); background-size:200% 100%; animation:skel-shimmer 1.4s linear infinite; }
  .skel-line { width:80%; height:1.1em; }
  .skel-stat { width:60%; height:1.6em; }
  .skel-row { width:100%; height:18px; margin:6px 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn-spinner { display:inline-block; width:12px; height:12px; border:2px solid rgba(255,255,255,0.25); border-top-color:currentColor; border-radius:50%; animation:spin 0.7s linear infinite; vertical-align:middle; margin-right:6px; }
  /* Phase 3 — typed-confirm modal (replaces window.prompt for live mode switch). */
  .mp-modal-overlay { position:fixed; inset:0; background:rgba(4,7,17,0.78); display:none; align-items:center; justify-content:center; z-index:1000; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); }
  .mp-modal-overlay.open { display:flex; }
  .mp-modal { background:linear-gradient(180deg,#101725 0%,#0A0F1A 100%); border:1px solid rgba(255,77,106,0.4); border-radius:14px; padding:22px 24px; width:min(440px,92vw); box-shadow:0 12px 40px rgba(0,0,0,0.6); }
  .mp-modal-title { font-size:16px; font-weight:700; margin:0 0 8px; color:var(--text); }
  .mp-modal-msg { font-size:13px; color:var(--muted); line-height:1.5; margin-bottom:14px; }
  .mp-modal-input { width:100%; box-sizing:border-box; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:var(--text); padding:10px 12px; border-radius:8px; font-family:inherit; font-size:14px; margin-bottom:14px; }
  .mp-modal-input:focus { outline:none; border-color:var(--red); }
  .mp-modal-row { display:flex; gap:10px; justify-content:flex-end; }
  .mp-modal-btn { padding:9px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.06); color:var(--text); font-size:13px; font-weight:600; cursor:pointer; }
  .mp-modal-btn-confirm { background:linear-gradient(180deg,#FF4D6A 0%,#D8334E 100%); border-color:rgba(255,77,106,0.6); }
  .mp-modal-btn-confirm:disabled { opacity:0.4; cursor:not-allowed; }
</style>
</head>
<body>
<div id="stale-banner" class="stale-banner" style="display:none"></div>
<!-- Phase 3 — typed-confirm modal for live-mode switch. -->
<div id="mp-modal-overlay" class="mp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="mp-modal-title">
  <div class="mp-modal">
    <h3 id="mp-modal-title" class="mp-modal-title">Confirm action</h3>
    <div id="mp-modal-msg" class="mp-modal-msg"></div>
    <input id="mp-modal-input" class="mp-modal-input" type="text" autocomplete="off" />
    <div class="mp-modal-row">
      <button id="mp-modal-cancel" class="mp-modal-btn" type="button">Cancel</button>
      <button id="mp-modal-confirm" class="mp-modal-btn mp-modal-btn-confirm" type="button" disabled>Confirm</button>
    </div>
  </div>
</div>

<div class="topbar">
  <div>
    <h1>${title}</h1>
    <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <span class="pill">${mode.toUpperCase()} ROUTE</span>
      <span id="active-badge"></span>
      <span id="live-price-pill" class="pill price-pending">Live: connecting…</span>
      <button class="mode-switch-btn" onclick="switchMode(${isPaper ? "true" : "false"})">${isPaper ? "Switch to Live →" : "Switch to Paper →"}</button>
    </div>
  </div>
  <div class="nav-links">
    <a href="/">Main Dashboard</a>
    <a href="${otherRoute}">${otherLabel} →</a>
    <a href="/logout">Logout</a>
  </div>
</div>

<div class="grid">

  <div class="card hero hero-balance">
    <div class="card-title">${balLabel}</div>
    <div id="balance-stat" class="stat"><span class="skel skel-stat"></span></div>
    <div id="balance-sub" class="stat-sub"></div>
  </div>

  <div class="card secondary">
    <div class="card-title">${mode} Open Position</div>
    <div id="pos-stat" class="stat"><span class="skel skel-stat"></span></div>
    <div id="pos-sub" class="stat-sub"></div>
  </div>

  <div class="card secondary">
    <div class="card-title">${wlLabel}</div>
    <div id="wl-stat" class="stat"><span class="skel skel-stat"></span></div>
    <div id="wl-sub" class="stat-sub"></div>
  </div>

  <div class="card secondary">
    <div class="card-title">${pnlLabel}</div>
    <div id="pnl-stat" class="stat"><span class="skel skel-stat"></span></div>
    <div id="pnl-sub" class="stat-sub"></div>
  </div>

  <div class="card hero hero-decision">
    <div class="card-title">Last Bot Decision</div>
    <div id="dec-stat" class="stat"><span class="skel skel-stat"></span></div>
    <div id="dec-sub" class="stat-sub"></div>
  </div>

</div>

<details class="advanced">
  <summary>+ Advanced Details</summary>
  <div class="adv-body">

    <div>
      <div class="adv-section-title">${tradesLabel} (history)</div>
      <div id="trades-body"><div class="skel skel-row"></div><div class="skel skel-row"></div><div class="skel skel-row"></div></div>
    </div>

    <div>
      <div class="adv-section-title">${ctrlLabel}</div>
      <div id="ctrl-note" class="stat-sub" style="margin-bottom:10px"></div>
      <div class="ctrl-row">
        <button id="mp-btn-start"      onclick="ctrl('START_BOT')">Start Bot</button>
        <button id="mp-btn-stop"       onclick="ctrl('STOP_BOT', true)" class="danger">Stop Bot</button>
        <button id="mp-btn-pause"      onclick="ctrl('PAUSE_TRADING')">Pause</button>
        <button id="mp-btn-resume"     onclick="ctrl('RESUME_TRADING')">Resume</button>
        <button id="mp-btn-reset-kill" onclick="ctrl('RESET_KILL_SWITCH', true)" class="danger">Reset Kill Switch</button>
        <button onclick="ctrl('RESET_LOSSES')">Reset Losses</button>
        <button onclick="ctrl('RESET_COOLDOWN')">Reset Cooldown</button>
      </div>
      <div id="ctrl-result" class="stat-sub" style="margin-top:10px"></div>
    </div>

  </div>
</details>

<script>
const MODE = ${JSON.stringify(mode)};
const API  = ${JSON.stringify(apiUrl)};
// Phase 8b — inline initial data injected by server. Falsy if unavailable.
window.__INIT__ = ${initialJson};

function fmtUSD(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const s = (n >= 0 ? "+" : "") + "$" + Math.abs(n).toFixed(2);
  return n >= 0 ? s.replace("+", "+") : s;
}
function fmtNum(n, d=2) { return (n === null || n === undefined || isNaN(n)) ? "—" : Number(n).toFixed(d); }

// Phase 6a — refresh reliability state for /paper /live.
let _lastOk = Date.now(), _inflight = false, _hidden = false;
// Phase 6e — declared early so render() (called via safePoll) can safely
// write to it before the Phase 6d WS block parses further down the script.
let _polledPrice = null;
// Phase 8f — cache of recent trades; rendered into the table only when the
// Advanced Details disclosure is open.
let _lastRecentTrades = [];

function buildTradesTable() {
  const body = document.getElementById("trades-body");
  if (!body) return;
  if (!_lastRecentTrades.length) {
    // Phase D-4-P-e — empty here means no trade events in the windowed range
    // (D-4-P-a). Full history is preserved on disk in safety-check-log.json.
    body.innerHTML = '<div class="empty">No ' + MODE + ' trades in this displayed window. Full ' + MODE + ' history is still stored in the bot log.</div>';
    return;
  }
  const rows = _lastRecentTrades.map(t => {
    const pnl = t.pnlUSD !== undefined ? parseFloat(t.pnlUSD) : null;
    const cls = pnl > 0 ? "row-win" : pnl < 0 ? "row-loss" : "";
    return '<tr class="' + cls + '">' +
      '<td>' + escapeHtml(t.timestamp.slice(0, 16).replace("T", " ")) + '</td>' +
      '<td>' + escapeHtml(t.type || "") + '</td>' +
      '<td>' + escapeHtml(t.symbol || "") + '</td>' +
      '<td>' + (t.price !== undefined ? Number(t.price).toFixed(4) : "—") + '</td>' +
      '<td>' + (pnl !== null ? fmtUSD(pnl) : "—") + '</td>' +
      '<td>' + escapeHtml(t.exitReason || (t.orderPlaced ? "FILLED" : "—")) + '</td>' +
      '</tr>';
  }).join("");
  body.innerHTML = '<table><thead><tr><th>Time</th><th>Type</th><th>Symbol</th><th>Price</th><th>P&L</th><th>Reason</th></tr></thead><tbody>' + rows + '</tbody></table>';
}
// Phase 6e — cross-route self-heal. If safety-check log is > 6 min stale,
// POST /api/run-bot once. Throttled client-side; the server has its own
// "skipped if last run < 4 min" guard as the source of truth.
let _lastSelfHealAt = 0;
function maybeSelfHeal(latestTimestamp) {
  if (!latestTimestamp) return;
  const ageMin = (Date.now() - new Date(latestTimestamp).getTime()) / 60000;
  if (ageMin <= 6) return;
  if (Date.now() - _lastSelfHealAt < 6 * 60 * 1000) return;
  _lastSelfHealAt = Date.now();
  fetch("/api/run-bot", { method: "POST", credentials: "same-origin" }).catch(() => {});
}

async function loadSummary() {
  try {
    const r = await fetch(API, { credentials: "same-origin" });
    // Phase D-2-paper-json-fix-a — guard against non-JSON responses. The
    // server auth catch-all returns 302 -> /login on session expiry; fetch
    // follows the redirect transparently, lands on the login HTML page,
    // and r.json() would otherwise throw "Unexpected token '<'..." which
    // surfaces as a confusing "JSON parse error" in the balance and trades
    // panels. Detect redirect-to-login or non-JSON content-type and surface
    // a clear "session expired" message instead.
    const ct = r.headers.get("content-type") || "";
    const looksLikeLogin =
      r.redirected ||
      /\\/login(\\?|$)/.test(r.url || "") ||
      !ct.includes("application/json");
    if (looksLikeLogin) {
      const err = new Error("Session expired — please reload and log in again.");
      err.code = "session-expired";
      throw err;
    }
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (!j.success) throw new Error(j.error || "load failed");
    render(j.data);
  } catch (e) {
    if (e && e.code === "session-expired") {
      document.getElementById("balance-stat").textContent = "Session expired";
      document.getElementById("balance-sub").innerHTML    = 'Please <a href="/login" style="color:var(--accent)">reload and log in again</a>.';
      document.getElementById("trades-body").innerHTML    = '<div class="empty">Session expired — please <a href="/login" style="color:var(--accent)">reload and log in again</a>.</div>';
    } else {
      document.getElementById("balance-stat").textContent = "Unavailable";
      document.getElementById("balance-sub").textContent  = e.message;
      document.getElementById("trades-body").innerHTML    = '<div class="empty">Unavailable: ' + escapeHtml(e.message) + '</div>';
    }
    throw e;
  }
}

async function safePoll() {
  if (_inflight || _hidden) return;
  _inflight = true;
  try { await loadSummary(); _lastOk = Date.now(); }
  catch (e) { /* banner takes over */ }
  finally { _inflight = false; }
}

function showStale() {
  const el = document.getElementById("stale-banner");
  if (!el) return;
  const ageMs = Date.now() - _lastOk;
  if (ageMs < 20000) {
    el.style.display = "none";
    document.body.classList.remove("with-stale-banner");
    return;
  }
  el.style.display = "block";
  document.body.classList.add("with-stale-banner");
  const s = Math.round(ageMs / 1000);
  if (ageMs < 60000) {
    el.className = "stale-banner stale-warn";
    el.textContent = "Last updated " + s + "s ago — retrying…";
  } else {
    el.className = "stale-banner stale-err";
    el.textContent = "Connection issue — last update " + s + "s ago.";
  }
}

document.addEventListener("visibilitychange", () => {
  _hidden = document.hidden;
  if (!_hidden) {
    safePoll();
    // Phase 6e — pill setInterval gets browser-throttled while tab is hidden.
    // Refresh the live-price pill immediately so it reflects state on return.
    if (typeof renderPricePill === "function") renderPricePill();
  }
});

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

function render(d) {
  // Phase 6d — capture polled price for live-price pill fallback.
  _polledPrice = (d.latestDecision && typeof d.latestDecision.price === "number") ? d.latestDecision.price : _polledPrice;
  if (typeof renderPricePill === "function") renderPricePill();
  // Phase 6e — wake the bot if its log is stale (server self-throttles).
  if (d.latestDecision && d.latestDecision.timestamp) maybeSelfHeal(d.latestDecision.timestamp);

  // Active badge
  const badge = document.getElementById("active-badge");
  if (d.isActive) {
    badge.innerHTML = '<span class="pill">BOT ACTIVE IN ${mode.toUpperCase()}</span>';
  } else {
    badge.innerHTML = '<span class="badge-warn">BOT IS IN ' + d.botMode.toUpperCase() + ' MODE</span>';
  }

  // Balance
  const balStat = document.getElementById("balance-stat");
  const balSub  = document.getElementById("balance-sub");
  if (d.balance.unavailable) {
    balStat.textContent = "Unavailable";
    balStat.className   = "stat unavail";
    balSub.textContent  = d.balance.reason || "";
  } else if (d.balance.source === "computed") {
    balStat.textContent = "$" + d.balance.currentBalance.toFixed(2);
    balStat.className   = "stat";
    balSub.textContent  = "Starting $" + d.balance.startingBalance.toFixed(2) + " + paper P&L";
  } else if (d.balance.source === "kraken") {
    balStat.textContent = "$" + d.balance.totalUSD.toFixed(2);
    balStat.className   = "stat";
    const pieces = (d.balance.balances || []).slice(0, 4).map(b => b.asset + " " + fmtNum(b.amount, 4)).join(" · ");
    balSub.textContent  = pieces || "—";
  }

  // P&L
  const pnlStat = document.getElementById("pnl-stat");
  const pnlSub  = document.getElementById("pnl-sub");
  pnlStat.textContent = fmtUSD(d.pnl.totalUSD);
  pnlStat.className   = "stat " + (d.pnl.totalUSD > 0 ? "pos-good" : d.pnl.totalUSD < 0 ? "pos-bad" : "");
  pnlSub.textContent  = "Across " + d.pnl.exitCount + " closed trade" + (d.pnl.exitCount === 1 ? "" : "s");

  // W/L
  const wlStat = document.getElementById("wl-stat");
  const wlSub  = document.getElementById("wl-sub");
  if (d.winLoss.total === 0) {
    wlStat.textContent = "0 / 0";
    wlStat.className   = "stat unavail";
    wlSub.textContent  = "No closed trades yet";
  } else {
    wlStat.textContent = d.winLoss.wins + "W / " + d.winLoss.losses + "L";
    wlStat.className   = "stat";
    wlSub.textContent  = (d.winLoss.winRate ?? 0).toFixed(1) + "% win rate";
  }

  // Position
  const posStat = document.getElementById("pos-stat");
  const posSub  = document.getElementById("pos-sub");
  if (d.position) {
    posStat.textContent = "Open · " + d.position.side.toUpperCase();
    posStat.className   = "stat";
    posSub.textContent  = "Entry $" + Number(d.position.entryPrice).toFixed(4) + " · qty " + Number(d.position.quantity).toFixed(4);
  } else {
    posStat.textContent = "Unavailable";
    posStat.className   = "stat unavail";
    posSub.textContent  = d.positionUnavailableReason || "—";
  }

  // Last Bot Decision
  const decStat = document.getElementById("dec-stat");
  const decSub  = document.getElementById("dec-sub");
  if (!d.latestDecision) {
    decStat.textContent = "Unavailable";
    decStat.className   = "stat unavail";
    decSub.textContent  = "No " + MODE + " decisions logged yet";
  } else {
    const ld = d.latestDecision;
    let label, cls = "stat";
    if (ld.type === "EXIT")               { label = "EXIT"; cls = "stat pos-bad"; }
    else if (ld.type === "BUY" || ld.type === "BUY_REENTRY" || ld.type === "MANUAL_BUY") { label = ld.type; cls = "stat pos-good"; }
    else if (ld.type)                     { label = ld.type; }
    else                                  { label = ld.allPass ? "PASS" : "BLOCKED"; cls = "stat unavail"; }
    decStat.textContent = label;
    decStat.className   = cls;
    const when = ld.timestamp ? ld.timestamp.slice(0, 16).replace("T", " ") : "";
    const px   = ld.price !== null && ld.price !== undefined ? "$" + Number(ld.price).toFixed(4) : "";
    const reason = ld.exitReason ? " · " + ld.exitReason : "";
    decSub.textContent = [when, px].filter(Boolean).join(" · ") + reason;
  }

  // Phase 8f — lazy-render trades. Cache the latest list, but only build the
  // DOM when the Advanced Details disclosure is open. Saves ~30 rows of HTML
  // generation on every poll for users who keep the details closed.
  _lastRecentTrades = d.recentTrades || [];
  const _adv = document.querySelector("details.advanced");
  if (_adv && _adv.open) buildTradesTable();

  // Control note
  const note = document.getElementById("ctrl-note");
  if (d.isActive) {
    note.textContent = "Bot is active in " + MODE.toUpperCase() + " mode. Controls below take effect immediately.";
  } else {
    note.textContent = "Bot is currently in " + d.botMode.toUpperCase() + " mode. Lifecycle controls still work but apply to whichever mode is active.";
  }

  // Phase D-3-paper-button-states — gate the lifecycle buttons on the
  // current control flags so Start/Stop/Pause/Resume/Reset Kill show the
  // correct active/disabled state. Pure read-only UI gating; clicking a
  // disabled button does nothing client-side, and the existing /api/control
  // server gates would still reject unsafe transitions even if this gating
  // were bypassed.
  applyControlButtonStates(d.control);
}

function applyControlButtonStates(control) {
  if (!control) return;
  const stopped = !!control.stopped;
  const paused  = !!control.paused;
  const killed  = !!control.killed;
  const running = !stopped && !killed;
  const setDisabled = (id, disabled) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !!disabled;
  };
  // Start: disabled when bot is already running. Enabled when stopped or killed.
  setDisabled("mp-btn-start",      running);
  // Stop: disabled when not running (already stopped or killed).
  setDisabled("mp-btn-stop",       !running);
  // Pause: disabled when paused, stopped, or killed.
  setDisabled("mp-btn-pause",      paused || !running);
  // Resume: disabled when not paused (or stopped/killed).
  setDisabled("mp-btn-resume",     !paused || !running);
  // Reset Kill Switch: disabled when not killed (nothing to reset).
  setDisabled("mp-btn-reset-kill", !killed);
}

// Phase 5b — button lock helper for /paper /live. Disables triggering button
// while in flight; release on settle. Captures window.event SYNCHRONOUSLY at
// handler entry (before any await) so async drift can't lock the wrong target.
function lockBtn(btn) {
  if (!btn || btn.disabled) return () => {};
  btn.disabled = true;
  // Phase 8b — visible spinner during in-flight action. Save+restore innerHTML.
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span>' + original;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    btn.disabled = false;
    btn.innerHTML = original;
  };
}
function _activeBtn() {
  const e = (typeof window !== "undefined") ? window.event : null;
  const t = e && (e.currentTarget || e.target);
  return (t && typeof t === "object" && "disabled" in t) ? t : null;
}

// Phase 5e — ctrl-result auto-clear. Each setCtrlMsg call cancels any
// pending clear and schedules a fresh 4s clear, so a quick chain of actions
// keeps showing the latest message and never leaves a stale one behind.
let _ctrlMsgTimer = null;
function setCtrlMsg(text) {
  const out = document.getElementById("ctrl-result");
  if (!out) return;
  out.textContent = text;
  if (_ctrlMsgTimer) clearTimeout(_ctrlMsgTimer);
  _ctrlMsgTimer = setTimeout(() => { out.textContent = ""; _ctrlMsgTimer = null; }, 4000);
}

async function ctrl(command, danger) {
  // Capture the originating button BEFORE window.confirm() (the dialog
  // doesn't shift window.event but we want btn captured pre-await regardless).
  const btn = _activeBtn();
  if (danger) {
    const friendly = command === "STOP_BOT" ? "stop the bot"
                  : command === "RESET_KILL_SWITCH" ? "reset the kill switch (re-enables trading after a forced halt)"
                  : "run " + command;
    if (!window.confirm("Are you sure you want to " + friendly + "?")) {
      setCtrlMsg(command + " cancelled.");
      return;
    }
  }
  const release = lockBtn(btn);
  setCtrlMsg("Sending " + command + "…");
  try {
    const r = await fetch("/api/control", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    const j = await r.json();
    setCtrlMsg(j.ok ? command + " OK" : "Failed: " + (j.error || "unknown"));
    if (j.ok) setTimeout(safePoll, 400);
  } catch (e) {
    setCtrlMsg("Failed: " + e.message);
  } finally { release(); }
}

// Phase 8b — paint inline data immediately so first frame has real values.
if (window.__INIT__) {
  try { render(window.__INIT__); _lastOk = Date.now(); } catch (e) { console.warn("[__INIT__]", e.message); }
}
safePoll();
setInterval(safePoll, 10000);
setInterval(showStale, 1000);

// Phase 6d — Kraken WebSocket ticker. Real-time XRP/USD price. Updates only
// the topbar live-price pill; never touches trade/W/L state. If WS fails or
// times out, the pill falls back to the last polled summary price.
let _wsPrice = null;
let _wsState = "connecting";
let _lastWSMsgAt = 0;
// _polledPrice declared earlier (Phase 6e) so render() can write it before
// this WS block parses; see top of script.

// Phase 6e — exponential backoff on WS reconnect (3s → 30s cap).
let _wsAttempts = 0;
function _wsBackoff() { return Math.min(3000 * Math.pow(2, _wsAttempts - 1), 30000); }

function connectTickerWS() {
  let ws;
  try { ws = new WebSocket("wss://ws.kraken.com"); }
  catch (e) { _wsState = "reconnecting"; renderPricePill(); _wsAttempts++; setTimeout(connectTickerWS, _wsBackoff()); return; }
  ws.onopen = () => {
    try { ws.send(JSON.stringify({ event: "subscribe", pair: ["XRP/USD"], subscription: { name: "ticker" } })); } catch {}
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (Array.isArray(msg) && msg[2] === "ticker") {
        const newPrice = parseFloat(msg[1].c[0]);
        // Phase 8c — flash direction on tick.
        const direction = (_wsPrice !== null && newPrice !== _wsPrice) ? (newPrice > _wsPrice ? "up" : "down") : null;
        _wsPrice = newPrice;
        _wsState = "live";
        _lastWSMsgAt = Date.now();
        _wsAttempts = 0;
        renderPricePill();
        if (direction) {
          const el = document.getElementById("live-price-pill");
          if (el) {
            el.classList.remove("price-flash-up", "price-flash-down");
            void el.offsetWidth; // restart animation
            el.classList.add(direction === "up" ? "price-flash-up" : "price-flash-down");
          }
        }
      }
    } catch {}
  };
  ws.onclose = () => {
    if (_wsState !== "connecting") _wsState = "reconnecting";
    renderPricePill();
    _wsAttempts++;
    setTimeout(connectTickerWS, _wsBackoff());
  };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

function renderPricePill() {
  const el = document.getElementById("live-price-pill");
  if (!el) return;
  // Phase 8c — only swap state classes; let any active flash class survive.
  el.classList.remove("price-live", "price-warn", "price-err", "price-pending");
  if (!el.classList.contains("pill")) el.classList.add("pill");
  const liveStale = _wsState === "live" && _lastWSMsgAt && (Date.now() - _lastWSMsgAt) > 30000;
  if (_wsState === "live" && _wsPrice !== null && !liveStale) {
    el.textContent = "Live: $" + _wsPrice.toFixed(4);
    el.classList.add("price-live");
    return;
  }
  if (_wsPrice !== null) {
    el.textContent = "$" + _wsPrice.toFixed(4) + " (delayed)";
    el.classList.add("price-warn");
  } else if (_polledPrice !== null) {
    el.textContent = "$" + _polledPrice.toFixed(4) + " (last logged)";
    el.classList.add("price-warn");
  } else if (_wsState === "connecting") {
    el.textContent = "Live: connecting…";
    el.classList.add("price-pending");
  } else {
    el.textContent = "Live: unavailable";
    el.classList.add("price-err");
  }
}

setInterval(renderPricePill, 1000);
connectTickerWS();

// Phase 7a — Advanced Details open/closed state persists per mode.
// Phase 8f — also builds the trades table the first time the disclosure opens
// (and on subsequent opens after data has changed). buildTradesTable() reads
// from _lastRecentTrades which render() updates on every successful poll.
(() => {
  const adv = document.querySelector("details.advanced");
  if (!adv) return;
  const KEY = "agentavila.advanced." + MODE;
  try { if (localStorage.getItem(KEY) === "1") adv.open = true; } catch {}
  // If restored open AND data already arrived (inline init or first poll),
  // build immediately so user doesn't see skeleton on a fresh page reload.
  if (adv.open && _lastRecentTrades.length) buildTradesTable();
  adv.addEventListener("toggle", () => {
    try { localStorage.setItem(KEY, adv.open ? "1" : "0"); } catch {}
    if (adv.open) buildTradesTable();
  });
})();

// Phase 3 — typed-confirm modal for /paper /live live-mode switch. Replaces
// the old window.prompt with a Promise-based showModal that mirrors the
// /dashboard pattern (visible overlay, disabled button until exact match).
function mpShowConfirm(opts) {
  return new Promise(resolve => {
    const o   = document.getElementById("mp-modal-overlay");
    const ttl = document.getElementById("mp-modal-title");
    const msg = document.getElementById("mp-modal-msg");
    const inp = document.getElementById("mp-modal-input");
    const cnf = document.getElementById("mp-modal-confirm");
    const cnl = document.getElementById("mp-modal-cancel");
    ttl.textContent = opts.title || "Confirm action";
    msg.innerHTML   = opts.msg   || "";
    inp.value = "";
    inp.placeholder = 'Type "' + (opts.requireText || "CONFIRM") + '"';
    cnf.textContent = opts.confirmText || "Confirm";
    cnf.disabled = true;
    const onInput = () => { cnf.disabled = inp.value.trim() !== (opts.requireText || "CONFIRM"); };
    const close = (val) => {
      o.classList.remove("open");
      inp.removeEventListener("input", onInput);
      cnf.onclick = null; cnl.onclick = null;
      resolve(val);
    };
    inp.addEventListener("input", onInput);
    cnf.onclick = () => close(true);
    cnl.onclick = () => close(false);
    o.classList.add("open");
    setTimeout(() => inp.focus(), 80);
  });
}

// Phase 7a — mode switch button. Paper direction uses a light confirm.
// Phase 3 — Live direction now uses mpShowConfirm (typed CONFIRM) and the
// server-side gate on /api/control rejects requests without it.
async function switchMode(toLive) {
  if (toLive) {
    const ok = await mpShowConfirm({
      title: "Switch to LIVE mode?",
      msg: "<strong style='color:#FF4D6A'>Real money will be used.</strong> Your next trade signal will place a real order on Kraken. Type <strong>CONFIRM</strong> to proceed.",
      confirmText: "Go LIVE",
      requireText: "CONFIRM",
    });
    if (!ok) { setCtrlMsg("Mode switch cancelled."); return; }
  } else {
    if (!window.confirm("Switch to PAPER mode? Bot will use simulated funds only.")) {
      setCtrlMsg("Mode switch cancelled.");
      return;
    }
  }
  const btn = _activeBtn();
  const release = lockBtn(btn);
  setCtrlMsg("Switching to " + (toLive ? "LIVE" : "PAPER") + "…");
  try {
    const body = { command: toLive ? "SET_MODE_LIVE" : "SET_MODE_PAPER" };
    if (toLive) body.confirm = "CONFIRM";
    const r = await fetch("/api/control", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.ok) {
      setCtrlMsg("Mode switched to " + (toLive ? "LIVE" : "PAPER") + " — redirecting…");
      setTimeout(() => { window.location.href = toLive ? "/live" : "/paper"; }, 700);
    } else {
      setCtrlMsg("Failed: " + (j.error || "unknown"));
    }
  } catch (e) {
    setCtrlMsg("Failed: " + e.message);
  } finally { release(); }
}
</script>

</body>
</html>`;
}

// ─── Phase A — /dashboard-v2 read-only command-center preview ────────────────
// Lives alongside /dashboard. No new POST endpoints, no SSE writes; client
// refreshes by polling existing read-only GETs (/api/health, /api/paper-summary,
// /api/live-summary, /api/control). Every control button renders disabled with
// a "Preview only" badge — Phase B will wire actions through the Phase 3
// typed-confirm gate. Strategy V2 stays shadow-only end to end.

// Phase D-2-b — frozen v2 backup wrapper.
// /dashboard-v2 routes through this wrapper instead of calling dashboardV2HTML
// directly. While /dashboard is still on dashboardV2HTML the two are visually
// identical, but they are now independent function references so future D-2
// phases (D-2-d onward) can change /dashboard's body without touching this
// backup URL. Once /dashboard switches to dashboardCombinedHTML, the function
// dashboardV2HTML below becomes reachable ONLY through this wrapper — at that
// point it must not be edited under D-2 work or the backup will drift.
function dashboardV2BackupHTML(initial) {
  return dashboardV2HTML(initial);
}

// Phase D-2-d — combined /dashboard shell. Wraps the legacy HTML body in
// a tab framework with the LEGACY visual style. Tab 1 ("Dashboard") shows
// the full legacy body verbatim — every legacy script, every legacy panel,
// every legacy CSS rule passes through unchanged. Other 5 tabs render
// placeholders for now; later D-2 phases will move v2 content into them.
// /dashboard-v2 (frozen v2 backup) and /dashboard-legacy (untouched legacy
// fallback) keep their own URLs and are not affected by this shell.
//
// Phase D-2-f — Bot Thinking and Controls panes are populated by reusing
// the v2 dashboard's render lifecycle. We call dashboardV2HTML(null) once
// per request, extract its inline <style> + <script> + the two tab-pane
// blocks (#tab-bot-thinking and #tab-controls) + the confirm modal/toast
// infrastructure, and inject them into the combined page. The v2 5s
// refresh poll then drives renderBotThinking and the Controls button
// handlers exactly as it does on /dashboard-v2.
function dashboardCombinedHTML(_initial) {
  let html = HTML;

  // Phase D-2-f — pull the v2 dashboard chunks. dashboardV2HTML is the
  // frozen-by-D-2-b backup body that /dashboard-v2 also serves; we don't
  // modify it here, just regex out the parts the combined view needs.
  const v2Full = dashboardV2HTML(null);
  function _extract(str, re) { const m = str.match(re); return m ? m[0] : ''; }
  function _extractInner(str, re) { const m = str.match(re); return m ? m[1] : ''; }
  const v2Style       = _extract     (v2Full, /<style>[\s\S]*?<\/style>/);
  const v2Script      = _extract     (v2Full, /<script>[\s\S]*?<\/script>(?=\s*<\/body>)/);
  const v2BTPane      = _extract     (v2Full, /<section class="tab-pane" id="tab-bot-thinking"[\s\S]*?<\/section>/);
  const v2CtrlPane    = _extract     (v2Full, /<section class="tab-pane" id="tab-controls"[\s\S]*?<\/section>/);
  // Phase D-2-g — Performance and Advanced sections. Performance contains
  // the segmented [Paper][Live] selector, KPI tiles, Recent Trades table,
  // Conditions Pass Rates + heatmap, and the V2 Shadow Analysis card. The
  // Advanced section contains Raw Decision Log, Recent Bot Activity,
  // Active Strategies, and the Legacy Dashboard link card. Both panes use
  // the v2 5s polling that's already embedded for Bot Thinking + Controls.
  const v2PerfPane    = _extract     (v2Full, /<section class="tab-pane" id="tab-performance"[\s\S]*?<\/section>(?=\s*<section class="tab-pane" id="tab-advanced")/);
  const v2AdvPane     = _extract     (v2Full, /<section class="tab-pane" id="tab-advanced"[\s\S]*?<\/section>/);
  const v2Modal       = _extract     (v2Full, /<div id="v2-modal-overlay"[\s\S]*?<\/div>\s*<\/div>/);
  const v2ToastCont   = _extract     (v2Full, /<div id="v2-toast-container"[^>]*><\/div>/);

  const TAB_CSS = "<style>" +
    /* Phase D-2-d / D-2-e — combined dashboard tab framework. .dc- prefix on
       every class/attribute so we cannot collide with any legacy class or id. */
    ".dc-tabs {" +
      "position: sticky; top: 0; z-index: 50;" +
      "display: flex; gap: 4px; padding: 10px 16px 0;" +
      "background: rgba(11, 15, 26, 0.92);" +
      "backdrop-filter: blur(10px);" +
      "-webkit-backdrop-filter: blur(10px);" +
      "border-bottom: 1px solid var(--border);" +
      "overflow-x: auto;" +
    "}" +
    ".dc-tab {" +
      "flex-shrink: 0; padding: 8px 14px;" +
      "background: transparent; border: none;" +
      "border-bottom: 2px solid transparent;" +
      "color: var(--muted);" +
      "font-size: 13px; font-weight: 600; letter-spacing: 0.02em;" +
      "cursor: pointer;" +
      "transition: color 150ms ease, border-color 150ms ease, background 150ms ease;" +
    "}" +
    ".dc-tab:hover { color: var(--text); background: rgba(255,255,255,0.03); }" +
    ".dc-tab-active {" +
      "color: var(--blue); border-bottom-color: var(--blue);" +
      "text-shadow: 0 0 8px var(--glow-blue);" +
    "}" +
    ".dc-pane[hidden] { display: none !important; }" +
    ".dc-placeholder {" +
      "max-width: 720px; margin: 80px auto; padding: 40px 24px;" +
      "text-align: center; color: var(--muted);" +
      "background: var(--card); border: 1px solid var(--border); border-radius: 12px;" +
    "}" +
    ".dc-placeholder h2 { color: var(--text); margin-bottom: 8px; font-size: 20px; }" +
    ".dc-placeholder p { font-size: 14px; line-height: 1.6; }" +
    /* Phase D-2-e — hide the legacy .tab-strip (Dashboard/Agent 3.0 sub-tabs)
       since the new top tabs now drive that swap. The legacy switchTab() and
       #dashboard-page / #info-page DOM are preserved unchanged. */
    ".tab-strip { display: none !important; }" +
    /* Phase D-2-f / D-2-g — v2's CSS hides .tab-pane by default and only
       shows .tab-pane.active. Inside our combined .dc-pane wrappers, the
       tab pane should always be visible — the .dc-pane[hidden] attribute
       already controls visibility at the outer level. Override v2 here. */
    ".dc-pane > .tab-pane#tab-bot-thinking," +
    ".dc-pane > .tab-pane#tab-controls," +
    ".dc-pane > .tab-pane#tab-performance," +
    ".dc-pane > .tab-pane#tab-advanced { display: block !important; }" +
  "</style>";

  const TAB_BAR =
    '<nav class="dc-tabs" role="tablist" aria-label="Dashboard sections">' +
      '<button class="dc-tab dc-tab-active" type="button" role="tab" data-dc-tab="dashboard">Dashboard</button>' +
      '<button class="dc-tab" type="button" role="tab" data-dc-tab="agent3">Agent 3.0</button>' +
      '<button class="dc-tab" type="button" role="tab" data-dc-tab="bot-thinking">Bot Thinking</button>' +
      '<button class="dc-tab" type="button" role="tab" data-dc-tab="performance">Performance</button>' +
      '<button class="dc-tab" type="button" role="tab" data-dc-tab="controls">Controls</button>' +
      '<button class="dc-tab" type="button" role="tab" data-dc-tab="advanced">Advanced</button>' +
    '</nav>' +
    '<section class="dc-pane" data-dc-pane="dashboard">';

  const TAB_PANES_END =
    '</section>' +
    /* Phase D-2-e — Agent 3.0 pane is intentionally empty. The Agent 3.0
       content lives in the legacy #info-page element inside the Dashboard
       pane; the new top-tab JS calls legacy switchTab("info") to reveal it
       while keeping the Dashboard pane visible. This keeps every legacy
       script that references getElementById("info-page") working unchanged. */
    '<section class="dc-pane" data-dc-pane="agent3" hidden></section>' +
    /* Phase D-2-f — Bot Thinking pane mounts the extracted v2 #tab-bot-thinking
       block. The v2 5s refresh poll drives renderBotThinking() which populates
       these cards. */
    '<section class="dc-pane" data-dc-pane="bot-thinking" hidden>' +
      v2BTPane +
    '</section>' +
    /* Phase D-2-g — Performance pane mounts the extracted v2 #tab-performance
       block. The v2 5s refresh poll drives renderPerformance() (KPIs, Recent
       Trades, Conditions, V2 Shadow Analysis collapsed). Help-icon tooltips
       (D-1-h) come along verbatim. */
    '<section class="dc-pane" data-dc-pane="performance" hidden>' +
      v2PerfPane +
    '</section>' +
    /* Phase D-2-f — Controls pane mounts the extracted v2 #tab-controls block
       plus the v2 confirm modal + toast container so Start / Stop / Reset Kill
       buttons show their existing typed-confirm dialogs. */
    '<section class="dc-pane" data-dc-pane="controls" hidden>' +
      v2CtrlPane +
    '</section>' +
    /* Phase D-2-g — Advanced pane mounts the extracted v2 #tab-advanced block
       (Raw Decision Log, Recent Bot Activity, Active Strategies, Legacy
       Dashboard link). Same v2 polling drives all four cards. */
    '<section class="dc-pane" data-dc-pane="advanced" hidden>' +
      v2AdvPane +
    '</section>';

  const TAB_JS = "<script>" +
    "(function () {" +
      'var validTabs = ["dashboard","agent3","bot-thinking","performance","controls","advanced"];' +
      'var tabs = document.querySelectorAll(".dc-tab");' +
      'var panes = document.querySelectorAll(".dc-pane");' +
      "function activate(name, fromClick) {" +
        "for (var i = 0; i < tabs.length; i++) {" +
          'tabs[i].classList.toggle("dc-tab-active", tabs[i].dataset.dcTab === name);' +
        "}" +
        // Phase D-2-e — Dashboard and Agent 3.0 both share the legacy body
        // pane; instead of swapping our own panes for those two we keep the
        // Dashboard pane visible and call legacy switchTab() to flip between
        // #dashboard-page and #info-page. Other tabs use the standard pane
        // swap. Legacy DOM untouched either way.
        'var isLegacyTab = (name === "dashboard" || name === "agent3");' +
        "for (var j = 0; j < panes.length; j++) {" +
          "var paneName = panes[j].dataset.dcPane;" +
          'if (paneName === "dashboard") {' +
            "panes[j].hidden = !isLegacyTab;" +
          "} else {" +
            "panes[j].hidden = (paneName !== name);" +
          "}" +
        "}" +
        'if (isLegacyTab && typeof switchTab === "function") {' +
          'try { switchTab(name === "dashboard" ? "dashboard" : "info"); } catch (e) {}' +
        "}" +
        "if (fromClick) {" +
          'try { history.replaceState(null, "", "#" + name); } catch (e) {}' +
        "}" +
      "}" +
      "for (var k = 0; k < tabs.length; k++) {" +
        "(function (btn) {" +
          'btn.addEventListener("click", function () { activate(btn.dataset.dcTab, true); });' +
        "})(tabs[k]);" +
      "}" +
      'var hash = (location.hash || "").slice(1);' +
      'activate(validTabs.indexOf(hash) >= 0 ? hash : "dashboard", false);' +
      // Also handle hash-only navigation (browser back/forward, anchor links
      // pasted into the URL bar). For any hash not in validTabs the handler
      // falls back to "dashboard" — the browser's native scroll-to-anchor
      // still works for legacy nav-drawer links because we don't preventDefault.
      'window.addEventListener("hashchange", function () {' +
        'var h = (location.hash || "").slice(1);' +
        'activate(validTabs.indexOf(h) >= 0 ? h : "dashboard", false);' +
      '});' +
    "})();" +
  "</script>";

  // Phase D-2-f — v2's confirm modal + toast container live at the bottom of
  // the v2 body. They are referenced by ID from the v2 control button
  // handlers (v2ShowConfirm reads #v2-modal-overlay, v2Toast reads
  // #v2-toast-container). Append them after the placeholder panes so the
  // global IDs are available regardless of which top tab is active.
  const V2_INFRA = v2Modal + v2ToastCont;

  // Phase D-2-h — paper data alignment fix on the combined /dashboard.
  // Two parts:
  //  (1) Augment the legacy section headers (#section-paper, #section-performance,
  //      #section-capital) with clarifying notes so the operator can tell at a
  //      glance which one is the official paper wallet vs the bot classifier
  //      vs the capital-router debug snapshot.
  //  (2) Periodically fetch /api/data and override pw-pnl + pw-total-value with
  //      the paperPnLRealized fields (added in D-2-c). This makes the legacy
  //      Paper Wallet card on /dashboard match /paper exactly (realized P&L
  //      from closed exits + PAPER_STARTING_BALANCE), instead of the legacy
  //      mark-to-market computation that treats every BUY row as still open.
  // /dashboard-legacy is NOT touched — it still serves the byte-identical
  // legacy HTML with the original calcPaperPnL output. The combined /dashboard
  // is the only surface where the alignment fix runs.
  const PAPER_FIX_SCRIPT = "<script>" +
    "(function () {" +
      // Idempotent label augmentation. Each section header gets one
      // muted note inserted after it, marked with data-dc-aligned so a
      // re-run does not duplicate the note.
      "function dcAugmentLabels() {" +
        "var anchors = [" +
          '{ id: "section-paper",       text: "Bot-recorded realized P&L from closed exits · aligned with /paper" },' +
          '{ id: "section-performance", text: "Bot per-trade classifier · separate from Paper Wallet" },' +
          '{ id: "section-capital",     text: "Snapshot · debug · not the official paper wallet" }' +
        "];" +
        "for (var i = 0; i < anchors.length; i++) {" +
          "var a = anchors[i];" +
          "var hdr = document.getElementById(a.id);" +
          'if (!hdr || hdr.dataset.dcAligned === "1") continue;' +
          'hdr.dataset.dcAligned = "1";' +
          'var note = document.createElement("div");' +
          'note.className = "dc-section-note";' +
          'note.style.cssText = "font-size:11px;color:var(--muted);margin:2px 0 10px;letter-spacing:0.2px";' +
          "note.textContent = a.text;" +
          'hdr.insertAdjacentElement("afterend", note);' +
        "}" +
      "}" +
      // Override pw-pnl + pw-total-value with realized values from
      // /api/data's paperPnLRealized. Runs after each fetch.
      "function dcApplyPaperOverride(p) {" +
        "if (!p) return;" +
        'var pnlEl = document.getElementById("pw-pnl");' +
        'var totalEl = document.getElementById("pw-total-value");' +
        "if (pnlEl) {" +
          "var pnl = Number(p.realizedPnL_USD || 0);" +
          'var sign = pnl >= 0 ? "+" : "−";' +
          'pnlEl.textContent = sign + "$" + Math.abs(pnl).toFixed(2);' +
          'pnlEl.style.color = pnl >= 0 ? "var(--green)" : "var(--red)";' +
        "}" +
        "if (totalEl) {" +
          'totalEl.textContent = "$" + Number(p.currentBalance || 0).toFixed(2);' +
        "}" +
      "}" +
      "function dcFetchAndApply() {" +
        'fetch("/api/data", { credentials: "same-origin" }).then(function(r) {' +
          // Reuse the D-2-paper-json-fix-a session-expired guard pattern.
          'var ct = r.headers.get("content-type") || "";' +
          'if (r.redirected || /\\/login(\\?|$)/.test(r.url || "") || !ct.includes("application/json")) return null;' +
          "if (!r.ok) return null;" +
          "return r.json();" +
        "}).then(function(d) {" +
          "if (d && d.paperPnLRealized) dcApplyPaperOverride(d.paperPnLRealized);" +
        "}).catch(function () {});" +
      "}" +
      "dcAugmentLabels();" +
      "dcFetchAndApply();" +
      "setInterval(dcAugmentLabels, 1500);" +
      "setInterval(dcFetchAndApply, 6000);" +
    "})();" +
  "</script>";

  // Inject the tab CSS + v2 style before </head>, the tab bar + Dashboard
  // pane wrapper start right after <body>, the placeholder panes + v2
  // modal/toast + tab JS + v2 script + paper-fix script before </body>.
  //
  // IMPORTANT: every replacement uses a function callback rather than a
  // string. JavaScript's String.replace treats $&, $`, $', $0–$9 as special
  // tokens inside string replacements — and the v2 script body contains
  // literal "$'" sequences (e.g. '...val">$' + Number(...)) which would
  // otherwise be substituted with the post-match text "</html>", silently
  // corrupting the script and producing "Invalid or unexpected token" at
  // parse time. Function callbacks bypass that interpretation entirely.
  html = html.replace("</head>", () => TAB_CSS + v2Style + "</head>");
  html = html.replace(/<body([^>]*)>/, (_, attrs) => "<body" + attrs + ">" + TAB_BAR);
  html = html.replace("</body>", () => TAB_PANES_END + V2_INFRA + TAB_JS + v2Script + PAPER_FIX_SCRIPT + "</body>");

  return html;
}

function dashboardV2HTML(initial) {
  const ctrl    = initial?.control || {};
  const isPaper = ctrl.paperTrading !== false;
  const accent  = isPaper ? "#00D4FF" : "#FF00C8";
  const accentSoft = isPaper ? "rgba(0,212,255,0.12)" : "rgba(255,0,200,0.12)";
  const modeLabel = isPaper ? "PAPER" : "LIVE";
  const modeIcon  = isPaper ? "◆" : "⬢";
  // Phase 8b — escape </ inside JSON to keep </script> unambiguous.
  const initialJson = JSON.stringify(initial || null).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Command Center (Preview) — Agent Avila</title>
<link rel="preconnect" href="https://ws.kraken.com" crossorigin>
<style>
  :root {
    --bg-deep:#040711; --bg-base:#0A0F1A;
    --card:rgba(20,28,45,0.55); --line:rgba(255,255,255,0.08);
    --muted:#7A8499; --text:#E6EAF1;
    --accent:${accent}; --accent-soft:${accentSoft};
    --green:#00FF9A; --red:#FF4D6A; --yellow:#FFC107;
  }
  * { box-sizing:border-box; }
  body {
    margin:0; color:var(--text); padding:24px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%,    var(--accent-soft)    0%, transparent 60%),
      radial-gradient(ellipse 80% 50% at 50% 100%,  rgba(255,0,200,0.03)  0%, transparent 60%),
      linear-gradient(180deg, var(--bg-base) 0%, var(--bg-deep) 100%);
    background-attachment:fixed;
  }
  body::before {
    content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
    background-image:
      linear-gradient(rgba(255,255,255,0.020) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.020) 1px, transparent 1px);
    background-size:50px 50px;
    mask-image:radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%);
    -webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%);
  }
  .wrap { position:relative; z-index:1; max-width:1100px; margin:0 auto; }
  .topbar { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
  .topbar h1 {
    margin:0; font-size:22px; font-weight:700; letter-spacing:0.5px;
    background:linear-gradient(90deg, var(--text) 0%, var(--accent) 100%);
    -webkit-background-clip:text; background-clip:text;
    -webkit-text-fill-color:transparent; color:transparent;
  }
  .preview-tag {
    display:inline-block; padding:3px 10px; border-radius:999px;
    background:rgba(255,193,7,0.12); color:var(--yellow);
    border:1px solid rgba(255,193,7,0.3); font-size:11px; font-weight:700; letter-spacing:0.6px;
    margin-left:8px;
  }
  .nav-links a { color:var(--muted); text-decoration:none; margin-left:14px; font-size:13px; }
  .nav-links a:hover { color:var(--text); }

  /* Quick Status Strip (Section 1) */
  .strip {
    display:flex; align-items:center; gap:10px; flex-wrap:wrap;
    background:var(--card); border:1px solid var(--line); border-radius:12px;
    padding:10px 14px; margin-bottom:14px;
    -webkit-backdrop-filter:blur(20px) saturate(160%); backdrop-filter:blur(20px) saturate(160%);
  }
  .pill {
    display:inline-flex; align-items:center; gap:6px;
    padding:5px 11px; border-radius:999px;
    background:var(--accent-soft); color:var(--accent);
    border:1px solid var(--line); font-size:12px; font-weight:600; letter-spacing:0.5px;
  }
  .pill-muted   { background:rgba(255,255,255,0.04); color:var(--muted); }
  .pill-green   { background:rgba(0,255,154,0.10);  color:var(--green);  border-color:rgba(0,255,154,0.25); }
  .pill-red     { background:rgba(255,77,106,0.10); color:var(--red);    border-color:rgba(255,77,106,0.25); }
  .pill-yellow  { background:rgba(255,193,7,0.10);  color:var(--yellow); border-color:rgba(255,193,7,0.25); }
  .dot { width:8px; height:8px; border-radius:50%; background:var(--green); display:inline-block; }
  .dot.warn { background:var(--yellow); }
  .dot.err  { background:var(--red); }
  /* Phase C-2 — KILL NOW pill at the far right of the Quick Status Strip.
     Outlined red by default; fills solid red on hover. Click opens the
     v2 modal requiring typed "KILL" — the server-side C-0 gate also
     enforces { confirm: "KILL" }, so a stray POST cannot bypass it. */
  .strip-kill {
    margin-left:auto;
    display:inline-flex; align-items:center; gap:6px;
    padding:5px 14px; border-radius:999px;
    background:transparent; color:var(--red);
    border:1.5px solid var(--red);
    font-family:inherit; font-size:12px; font-weight:700; letter-spacing:0.6px;
    cursor:pointer;
    transition:background 0.15s, color 0.15s, transform 0.05s, box-shadow 0.15s;
  }
  .strip-kill:hover:not(:disabled)  { background:var(--red); color:#fff; box-shadow:0 0 14px rgba(255,77,106,0.35); }
  .strip-kill:active:not(:disabled) { transform:translateY(1px); }
  .strip-kill:disabled { opacity:0.55; cursor:not-allowed; }
  /* Phase D-1-c — Pause/Resume promoted to the Quick Status Strip so
     reactive safety actions are zero-click. Neutral pill style; no modal. */
  .strip-action {
    display:inline-flex; align-items:center; gap:6px;
    padding:5px 12px; border-radius:999px;
    background:rgba(255,255,255,0.05); color:var(--text);
    border:1px solid rgba(255,255,255,0.14);
    font-family:inherit; font-size:12px; font-weight:600; letter-spacing:0.3px;
    cursor:pointer;
    transition:background 0.15s, border-color 0.15s, transform 0.05s;
  }
  .strip-action:hover:not(:disabled)  { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.24); }
  .strip-action:active:not(:disabled) { transform:translateY(1px); }
  .strip-action:disabled { opacity:0.5; cursor:not-allowed; }

  /* Hero KPI Strip (Section 2) */
  .kpis { display:grid; grid-template-columns:repeat(5, 1fr); gap:12px; margin-bottom:14px; }
  .kpi {
    background:var(--card); border:1px solid var(--line); border-radius:14px;
    padding:14px 16px;
    -webkit-backdrop-filter:blur(20px) saturate(160%); backdrop-filter:blur(20px) saturate(160%);
  }
  .kpi-label { font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted); }
  .kpi-val   { font-size:22px; font-weight:700; margin-top:4px; font-variant-numeric:tabular-nums; }
  .kpi-sub   { font-size:11px; color:var(--muted); margin-top:2px; }
  .kpi-good { color:var(--green); }
  .kpi-bad  { color:var(--red); }
  .kpi-warn { color:var(--yellow); }
  @media (max-width: 800px) { .kpis { grid-template-columns:repeat(2,1fr); } }

  /* Account Quick Links (Section 3) */
  .links { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
  .link-card {
    display:flex; justify-content:space-between; align-items:center;
    background:var(--card); border:1px solid var(--line); border-radius:14px;
    padding:16px 18px; text-decoration:none; color:var(--text);
    transition:border-color 0.15s, transform 0.15s;
  }
  .link-card:hover { border-color:var(--accent); transform:translateY(-1px); }
  .link-card-paper { border-color:rgba(0,212,255,0.3); }
  .link-card-live  { border-color:rgba(255,0,200,0.3); }
  .link-card-title { font-size:14px; font-weight:700; }
  .link-card-sub   { font-size:11px; color:var(--muted); margin-top:2px; }
  .link-card-arrow { font-size:18px; opacity:0.7; }
  @media (max-width: 700px) { .links { grid-template-columns:1fr; } }

  /* Cards (Sections 4–7) */
  .card {
    background:var(--card); border:1px solid var(--line); border-radius:14px;
    padding:16px 18px; margin-bottom:14px;
    -webkit-backdrop-filter:blur(20px) saturate(160%); backdrop-filter:blur(20px) saturate(160%);
  }
  .card-title {
    font-size:11px; text-transform:uppercase; letter-spacing:0.1em;
    color:var(--muted); margin-bottom:8px; display:flex; align-items:center; gap:8px;
  }
  .card-row { display:flex; justify-content:space-between; padding:6px 0; font-size:13px; border-bottom:1px solid rgba(255,255,255,0.04); }
  .card-row:last-child { border-bottom:0; }
  .card-row-label { color:var(--muted); }
  .card-row-val   { color:var(--text); font-variant-numeric:tabular-nums; font-weight:600; }
  .card-empty { color:var(--muted); font-size:13px; padding:6px 0; }

  /* V2 Shadow disclaimer */
  .v2-disclaimer {
    background:rgba(255,193,7,0.08); border:1px solid rgba(255,193,7,0.25);
    color:var(--yellow); padding:8px 12px; border-radius:8px;
    font-size:12px; font-weight:600; letter-spacing:0.3px; margin-bottom:10px;
  }

  /* Advanced Details placeholder */
  details.adv {
    background:var(--card); border:1px solid var(--line); border-radius:14px;
    padding:0; margin-bottom:14px;
  }
  details.adv > summary {
    cursor:pointer; padding:14px 18px; list-style:none;
    font-size:13px; color:var(--muted); font-weight:600;
    display:flex; justify-content:space-between; align-items:center;
  }
  details.adv > summary::-webkit-details-marker { display:none; }
  details.adv[open] > summary { border-bottom:1px solid var(--line); }
  .adv-body { padding:14px 18px; }
  .adv-section { margin-bottom:14px; }
  .adv-section-title {
    font-size:10px; text-transform:uppercase; letter-spacing:0.08em;
    color:var(--muted); margin-bottom:6px;
  }
  .ctrl-row { display:flex; flex-wrap:wrap; gap:8px; }
  /* Phase A: all buttons rendered :disabled with PREVIEW badge.
     Phase C-1: lifecycle buttons (Pause/Resume/Start/Stop) become active;
     remaining dangerous buttons keep :disabled until C-2/C-3. CSS now
     supports both states via the :disabled pseudo. */
  .ctrl-btn {
    background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14);
    color:var(--text); padding:8px 14px; border-radius:8px;
    font-size:12px; font-weight:600; cursor:pointer; opacity:1;
    position:relative;
    transition:background 0.15s, border-color 0.15s, transform 0.05s;
  }
  .ctrl-btn:hover:not(:disabled)  { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.24); }
  .ctrl-btn:active:not(:disabled) { transform:translateY(1px); }
  .ctrl-btn:disabled { cursor:not-allowed; opacity:0.55; color:var(--muted); }
  .ctrl-btn-danger { border-color:rgba(255,77,106,0.30); color:var(--red); }
  .ctrl-btn-danger:hover:not(:disabled) { background:rgba(255,77,106,0.10); border-color:rgba(255,77,106,0.50); }
  .ctrl-btn-danger:disabled { color:rgba(255,77,106,0.55); border-color:rgba(255,77,106,0.18); }
  /* Phase C-4-b — link variant. Used for "Manage Mode → /paper" so the
     element is an <a> (navigates), not a <button> (would imply a POST). */
  .ctrl-btn-link { text-decoration:none; }
  .preview-only-badge {
    display:inline-block; margin-left:6px; padding:1px 6px; border-radius:4px;
    background:rgba(255,193,7,0.18); color:var(--yellow);
    font-size:9px; letter-spacing:0.4px; vertical-align:middle;
  }

  /* Stale-data banner (full-width, animated when stale > 60s) */
  .stale-banner {
    background:rgba(255,193,7,0.10); color:var(--yellow);
    border:1px solid rgba(255,193,7,0.3); border-radius:8px;
    padding:8px 12px; margin-bottom:12px; font-size:12px; font-weight:600;
    display:none;
  }
  .stale-banner.on { display:block; }
  .stale-banner.critical { background:rgba(255,77,106,0.12); color:var(--red); border-color:rgba(255,77,106,0.4); }

  /* Phase C-1 — confirm modal + toast for /dashboard-v2. requireText is
     accepted via the same opts API as modePage's mp-modal so C-2/C-3
     (Switch to Live, Reset Kill Switch, KILL NOW) can reuse this surface. */
  .v2-modal-overlay { position:fixed; inset:0; background:rgba(4,7,17,0.78); display:none; align-items:center; justify-content:center; z-index:1000; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); }
  .v2-modal-overlay.open { display:flex; }
  .v2-modal { background:linear-gradient(180deg,#101725 0%,#0A0F1A 100%); border:1px solid var(--line); border-radius:14px; padding:22px 24px; width:min(440px,92vw); box-shadow:0 12px 40px rgba(0,0,0,0.6); }
  .v2-modal-title { font-size:16px; font-weight:700; margin:0 0 8px; color:var(--text); }
  .v2-modal-msg { font-size:13px; color:var(--muted); line-height:1.5; margin-bottom:14px; }
  .v2-modal-input { width:100%; box-sizing:border-box; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:var(--text); padding:10px 12px; border-radius:8px; font-family:inherit; font-size:14px; margin-bottom:14px; display:none; }
  .v2-modal-input.show { display:block; }
  .v2-modal-input:focus { outline:none; border-color:var(--accent); }
  .v2-modal-row { display:flex; gap:10px; justify-content:flex-end; }
  .v2-modal-btn { padding:9px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.06); color:var(--text); font-size:13px; font-weight:600; cursor:pointer; }
  .v2-modal-btn-confirm { background:linear-gradient(180deg,rgba(0,212,255,0.20) 0%,rgba(0,150,200,0.15) 100%); border-color:var(--accent); }
  .v2-modal-btn-confirm.danger { background:linear-gradient(180deg,#FF4D6A 0%,#D8334E 100%); border-color:rgba(255,77,106,0.6); color:#fff; }
  .v2-modal-btn-confirm:disabled { opacity:0.4; cursor:not-allowed; }

  .v2-toast-container { position:fixed; bottom:24px; right:24px; display:flex; flex-direction:column; gap:8px; z-index:999; pointer-events:none; }
  .v2-toast { background:rgba(20,28,45,0.95); border:1px solid var(--line); border-radius:10px; padding:10px 16px; color:var(--text); font-size:13px; font-weight:500; box-shadow:0 8px 24px rgba(0,0,0,0.4); animation:v2toastin 0.2s ease-out; pointer-events:auto; }
  .v2-toast.success { border-color:rgba(0,255,154,0.3); color:var(--green); }
  .v2-toast.warn    { border-color:rgba(255,193,7,0.3); color:var(--yellow); }
  .v2-toast.error   { border-color:rgba(255,77,106,0.3); color:var(--red); }
  @keyframes v2toastin { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

  /* Phase D-1-a — tab framework. Quick Status Strip stays ABOVE the tabs so
     KILL NOW + bot status are always one click away. Tab content sits in
     panes — only the active pane renders. URL hash drives selection. */
  .tabs {
    display:flex; gap:4px; max-width:1100px; margin:0 auto 14px;
    border-bottom:1px solid var(--line); flex-wrap:wrap;
    position:relative; z-index:1;
  }
  .tab {
    padding:10px 18px; background:transparent; color:var(--muted);
    border:0; border-bottom:2px solid transparent;
    font-family:inherit; font-size:13px; font-weight:600; letter-spacing:0.2px;
    cursor:pointer; margin-bottom:-1px;
    transition:color 0.15s, border-color 0.15s, background 0.15s;
  }
  .tab:hover:not(.active) { color:var(--text); background:rgba(255,255,255,0.03); }
  .tab.active { color:var(--accent); border-bottom-color:var(--accent); }
  .tab:focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:4px 4px 0 0; }
  .tab-pane { display:none; }
  .tab-pane.active { display:block; }

  .placeholder-card { text-align:center; padding:48px 24px; }
  .placeholder-icon { font-size:42px; margin-bottom:12px; line-height:1; }
  .placeholder-title { font-size:16px; font-weight:700; color:var(--text); margin-bottom:8px; letter-spacing:0.3px; }
  .placeholder-body { color:var(--muted); font-size:14px; line-height:1.5; max-width:480px; margin:0 auto; }

  /* Phase D-1-e-1 — Performance tab segmented mode tabs + bot-recorded
     P&L caveat. KPI grid reuses the existing .kpis / .kpi rules from the
     Hero KPI Strip — five tiles in one row, two-up on narrow viewports. */
  .perf-seg-row {
    display:flex; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap;
  }
  .perf-seg-label {
    font-size:11px; color:var(--muted);
    text-transform:uppercase; letter-spacing:0.08em;
  }
  .perf-seg-group {
    display:inline-flex;
    background:rgba(255,255,255,0.04);
    border:1px solid var(--line);
    border-radius:999px; padding:3px; gap:2px;
  }
  .perf-seg {
    padding:6px 18px; border-radius:999px; border:0;
    background:transparent; color:var(--muted);
    font-family:inherit; font-size:12px; font-weight:600; letter-spacing:0.4px;
    cursor:pointer;
    transition:background 0.15s, color 0.15s;
  }
  .perf-seg:hover:not(.active) { color:var(--text); background:rgba(255,255,255,0.04); }
  .perf-seg.active {
    background:var(--accent-soft); color:var(--accent);
    box-shadow:0 1px 4px rgba(0,0,0,0.18) inset;
  }
  .perf-seg:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .perf-context {
    background:var(--card); border:1px solid var(--line); border-radius:10px;
    padding:10px 14px; font-size:11px; color:var(--muted); line-height:1.55;
  }

  /* Phase D-1-h — small help-icon tooltip for Performance metrics.
     CSS-only tooltip via ::after on the icon, keyboard-accessible via
     :focus-visible. data-help carries the wording; title attribute is
     a fallback for assistive tech. No JS, no click handlers. */
  .help-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 14px; height: 14px; margin-left: 6px; vertical-align: middle;
    border-radius: 50%; background: rgba(255,255,255,0.08);
    color: var(--muted); font-size: 9px; font-weight: 700;
    cursor: help; position: relative; user-select: none;
    transition: background 120ms ease, color 120ms ease;
  }
  .help-icon:hover, .help-icon:focus-visible {
    background: rgba(255,255,255,0.16); color: var(--text); outline: none;
  }
  .help-icon::after {
    content: attr(data-help);
    position: absolute; bottom: calc(100% + 6px); left: 50%;
    transform: translateX(-50%);
    background: rgba(20,20,28,0.98);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 4px; padding: 8px 10px;
    font-size: 11px; font-weight: 400;
    color: var(--text); line-height: 1.5;
    text-transform: none; letter-spacing: 0;
    white-space: normal; width: max-content; max-width: 240px;
    text-align: left; pointer-events: none;
    opacity: 0; visibility: hidden;
    transition: opacity 120ms ease, visibility 120ms ease;
    z-index: 100; box-shadow: 0 6px 18px rgba(0,0,0,0.5);
  }
  .help-icon:hover::after, .help-icon:focus-visible::after {
    opacity: 1; visibility: visible;
  }
  @media (max-width: 780px) {
    .help-icon::after { max-width: 200px; }
  }

  /* Phase D-1-f-4 — Advanced tab Legacy Dashboard link card. Final card,
     navigation only. No POST, no JS — pure anchor. Visually quiet so it
     reads as "way out" rather than as another live data card. */
  .adv-legacy-card { padding:14px 18px; margin-top:14px; }
  .adv-legacy-card .card-title { margin-bottom:4px; }
  .adv-legacy-card .card-sublabel {
    font-size:12px; color:var(--muted); margin-bottom:14px; line-height:1.55;
  }
  .adv-legacy-link {
    display:inline-flex; align-items:center; gap:6px;
    padding: 8px 14px; border-radius: 5px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.10);
    color: var(--text); text-decoration: none;
    font-size: 12px; font-weight: 600;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .adv-legacy-link:hover {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.25);
  }
  .adv-legacy-link:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px;
  }

  /* Phase D-1-f-3 — Advanced tab Active Strategies card. Two side-by-side
     tiles describing V1 (primary) and V2 (shadow). Description-only;
     parameters live on Controls / Bot Thinking. Read-only badges. */
  .adv-strategies-card { padding:14px 18px; margin-top:14px; }
  .adv-strategies-card .card-title { margin-bottom:4px; }
  .adv-strategies-card .card-sublabel {
    font-size:11px; color:var(--muted); margin-bottom:14px; line-height:1.45;
  }
  .adv-strategies-grid {
    display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;
  }
  .strategy-tile {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 6px; padding: 12px 14px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .strategy-tile-head {
    display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  }
  .strategy-tile-name {
    font-weight: 700; font-size: 13px;
  }
  .strategy-role {
    font-weight: 700; font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 2px 8px; border-radius: 3px;
    display: inline-block; line-height: 1.3;
  }
  .strategy-role.primary { background: rgba(46,204,113,0.15); color: var(--green); }
  .strategy-role.shadow  { background: rgba(245,158,11,0.18); color: rgba(255,210,120,0.95);
                           border: 1px solid rgba(245,158,11,0.45); }
  .strategy-status {
    font-weight: 600; font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 2px 6px; border-radius: 3px;
    display: inline-block; line-height: 1.3;
    border: 1px solid rgba(255,255,255,0.10);
  }
  .strategy-status.running { color: var(--green); border-color: rgba(46,204,113,0.40); }
  .strategy-status.paused  { color: rgba(251,191,36,0.95); border-color: rgba(251,191,36,0.40); }
  .strategy-status.stopped { color: rgba(244,63,94,0.90); border-color: rgba(244,63,94,0.40); }
  .strategy-status.killed  { color: rgba(244,63,94,1.00); border-color: rgba(244,63,94,0.65);
                              background: rgba(244,63,94,0.10); }
  .strategy-status.analyzing { color: rgba(180,180,255,0.90); border-color: rgba(180,180,255,0.30); }
  .strategy-mode {
    font-weight: 600; font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 2px 6px; border-radius: 3px;
    display: inline-block; line-height: 1.3;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .strategy-mode.paper { color: rgba(0,210,255,0.85); border-color: rgba(0,210,255,0.25); }
  .strategy-mode.live  { color: rgba(255, 80,200,0.90); border-color: rgba(255, 80,200,0.30); }
  .strategy-warning {
    font-size: 11px; line-height: 1.45;
    color: rgba(255,210,120,0.95);
    background: rgba(245,158,11,0.10);
    border: 1px solid rgba(245,158,11,0.40);
    border-radius: 4px;
    padding: 6px 10px;
  }
  .strategy-desc { font-size: 12px; color: var(--text); line-height: 1.55; }
  .strategy-note { font-size: 11px; color: var(--muted); line-height: 1.45; }
  @media (max-width: 780px) {
    .adv-strategies-grid { grid-template-columns: 1fr; }
  }

  /* Phase D-1-f-2 — Advanced tab Recent Bot Activity timeline. Compact
     vertical list, one row per cycle, with a left action badge, optional
     mode pill, and a plain-English summary. Read-only narrative view. */
  .adv-activity-card { padding:14px 18px; margin-top:14px; }
  .adv-activity-card .card-title { margin-bottom:4px; }
  .adv-activity-card .card-sublabel {
    font-size:11px; color:var(--muted); margin-bottom:14px; line-height:1.45;
  }
  .adv-activity-list { display: flex; flex-direction: column; }
  .adv-activity-row {
    display: grid;
    grid-template-columns: 80px 170px 1fr;
    gap: 12px; align-items: start;
    padding: 8px 4px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 12px;
  }
  .adv-activity-row:last-child { border-bottom: 0; }
  .adv-activity-time {
    color: var(--muted); white-space: nowrap;
    font-variant-numeric: tabular-nums; font-size: 11px;
  }
  .adv-activity-action-col { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .adv-activity-action {
    font-weight: 700; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 2px 8px; border-radius: 3px;
    display: inline-block; line-height: 1.3;
  }
  .adv-activity-action.trade   { background: rgba(46,204,113,0.15);  color: var(--green); }
  .adv-activity-action.exit    { background: rgba(251,191, 36,0.14); color: rgba(251,191, 36, 0.95); }
  .adv-activity-action.skip    { background: rgba(255,255,255,0.06); color: var(--muted); }
  .adv-activity-action.limit   { background: rgba(244, 63, 94,0.12); color: rgba(244, 63, 94, 0.90); }
  .adv-activity-action.halt    { background: rgba(244, 63, 94,0.22); color: rgba(244, 63, 94, 1.00); }
  .adv-activity-action.unknown { background: rgba(255,255,255,0.06); color: var(--muted); }
  .adv-activity-mode {
    font-weight: 600; font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 2px 6px; border-radius: 3px;
    display: inline-block; line-height: 1.3;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .adv-activity-mode.paper { color: rgba(0,210,255,0.85); border-color: rgba(0,210,255,0.25); }
  .adv-activity-mode.live  { color: rgba(255, 80,200,0.90); border-color: rgba(255, 80,200,0.30); }
  .adv-activity-summary { color: var(--text); line-height: 1.45; word-break: break-word; }
  @media (max-width: 780px) {
    .adv-activity-row { grid-template-columns: 70px 1fr; }
    .adv-activity-action-col { grid-column: 2; }
    .adv-activity-summary { grid-column: 2; }
  }

  /* Phase D-1-f-1 — Advanced tab Raw Decision Log. Scrollable monospace
     list of recent decisionLog strings. Read-only debug view; the sub-label
     is load-bearing — operators must not read this as account performance. */
  .adv-rawlog-card { padding:14px 18px; }
  .adv-rawlog-card .card-title { margin-bottom:4px; }
  .adv-rawlog-card .card-sublabel {
    font-size:11px; color:var(--muted); margin-bottom:14px; line-height:1.45;
  }
  .adv-rawlog-list {
    max-height: 480px; overflow-y: auto;
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 6px;
    background: rgba(0,0,0,0.18);
  }
  .adv-rawlog-row {
    display: grid;
    grid-template-columns: 80px 110px 1fr;
    gap: 10px; align-items: start;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 11px;
  }
  .adv-rawlog-row:last-child { border-bottom: 0; }
  .adv-rawlog-time {
    color: var(--muted); white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .adv-rawlog-verdict {
    font-weight: 600; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 2px 6px; border-radius: 3px;
    display: inline-block; line-height: 1.3;
    word-break: break-word;
  }
  .adv-rawlog-verdict.trade   { background: rgba(46,204,113,0.15);  color: var(--green); }
  .adv-rawlog-verdict.skip    { background: rgba(244, 63, 94,0.12); color: rgba(244, 63, 94, 0.85); }
  .adv-rawlog-verdict.exit    { background: rgba(251,191, 36,0.12); color: rgba(251,191, 36, 0.90); }
  .adv-rawlog-verdict.unknown { background: rgba(255,255,255,0.06); color: var(--muted); }
  .adv-rawlog-text {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    color: var(--text);
    word-break: break-word;
    line-height: 1.45;
  }
  @media (max-width: 780px) {
    .adv-rawlog-row { grid-template-columns: 70px 1fr; }
    .adv-rawlog-row > :nth-child(2) { grid-column: 2; }
    .adv-rawlog-text { grid-column: 2; }
  }

  /* Phase D-1-e-4 — Strategy V2 Shadow Analysis card. Collapsed by default
     via a native <details> element. Loud disclaimer banner at the top of the
     expanded body in a warning hue so an operator cannot mistake V2 numbers
     for account performance or as a signal to act on. Cycle-level only —
     never aggregated as account P&L. */
  .perf-v2-card { padding:0; margin-top:14px; }
  .perf-v2-card[open] { padding-bottom:14px; }
  .perf-v2-summary {
    list-style: none; cursor: pointer;
    padding:14px 18px; display:flex; align-items:center; justify-content:space-between;
    gap:12px; user-select:none;
  }
  .perf-v2-summary::-webkit-details-marker { display:none; }
  .perf-v2-summary::before {
    content: "▸"; color: var(--muted); font-size: 12px;
    transition: transform 150ms ease; display:inline-block;
  }
  .perf-v2-card[open] > .perf-v2-summary::before { transform: rotate(90deg); }
  .perf-v2-summary .card-title { margin:0; flex:1; }
  .perf-v2-toggle-hint {
    color: var(--muted); font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .perf-v2-card[open] .perf-v2-toggle-hint { opacity: 0.6; }
  .perf-v2-body { padding:0 18px; }
  .perf-v2-disclaimer {
    background: rgba(245, 158, 11, 0.10);
    border: 1px solid rgba(245, 158, 11, 0.45);
    color: rgba(255, 220, 160, 0.95);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 11px; line-height: 1.55;
    margin-bottom: 12px;
  }
  .perf-v2-card .card-sublabel {
    font-size:11px; color:var(--muted); margin-bottom:14px; line-height:1.45;
  }
  .perf-v2-section { margin-bottom:14px; }
  .perf-v2-section:last-child { margin-bottom:0; }
  .perf-v2-section-title {
    font-size:10px; color:var(--muted); text-transform:uppercase;
    letter-spacing:0.06em; font-weight:600; margin-bottom:8px;
  }
  .perf-v2-grid {
    display:grid; grid-template-columns: repeat(2, 1fr); gap:8px 14px;
  }
  .perf-v2-stat {
    display:flex; align-items:center; justify-content:space-between;
    padding: 6px 10px; background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04); border-radius: 5px;
    font-size: 12px;
  }
  .perf-v2-stat-label { color: var(--muted); font-size: 11px; }
  .perf-v2-stat-val { font-weight: 600; font-variant-numeric: tabular-nums; }
  @media (max-width: 780px) {
    .perf-v2-grid { grid-template-columns: 1fr; }
  }

  /* Phase D-1-e-3 — Condition Pass Rates card. Cycle-level (mode-blind),
     intentionally separate visual treatment from the mode-scoped KPIs and
     trades table so the operator does not read it as account performance. */
  .perf-conditions-card { padding:14px 18px; margin-top:14px; }
  .perf-conditions-card .card-title { margin-bottom:4px; }
  .perf-conditions-card .card-sublabel {
    font-size:11px; color:var(--muted); margin-bottom:14px; line-height:1.45;
  }
  .perf-cond-list { display:flex; flex-direction:column; gap:10px; margin-bottom:18px; }
  .perf-cond-row {
    display:grid; grid-template-columns: 130px 1fr 180px;
    gap:12px; align-items:center; font-size:12px;
  }
  .perf-cond-label { color:var(--text); font-weight:500; }
  .perf-cond-bar {
    height:8px; background:rgba(255,255,255,0.06);
    border-radius:4px; overflow:hidden;
  }
  .perf-cond-bar-fill {
    height:100%;
    background:linear-gradient(90deg, var(--accent), var(--green));
    transition: width 200ms ease;
  }
  .perf-cond-count {
    color:var(--muted); font-size:11px; text-align:right;
    font-variant-numeric:tabular-nums;
  }
  .perf-heatmap {
    border-top: 1px solid rgba(255,255,255,0.06);
    padding-top:12px;
  }
  .perf-heatmap-header, .perf-heatmap-row {
    display:grid; grid-template-columns: 80px repeat(4, 1fr); gap:6px; align-items:center;
  }
  .perf-heatmap-header {
    margin-bottom:6px; padding-bottom:6px;
    border-bottom:1px solid rgba(255,255,255,0.04);
  }
  .perf-heatmap-col {
    font-size:10px; color:var(--muted); text-transform:uppercase;
    letter-spacing:0.06em; font-weight:600; text-align:center;
  }
  .perf-heatmap-row { padding:4px 0; font-size:11px; }
  .perf-heatmap-time { color:var(--muted); white-space:nowrap; font-size:11px; }
  .perf-heatmap-dot {
    display:block; width:12px; height:12px; border-radius:50%;
    margin:0 auto;
  }
  .perf-heatmap-dot.pass { background: var(--green); box-shadow: 0 0 4px rgba(46,204,113,0.35); }
  .perf-heatmap-dot.fail { background: rgba(244, 63, 94, 0.55); }
  .perf-heatmap-dot.na   { background: rgba(255,255,255,0.10); }
  @media (max-width: 780px) {
    .perf-cond-row { grid-template-columns: 100px 1fr 120px; gap:8px; }
    .perf-heatmap-header, .perf-heatmap-row { grid-template-columns: 60px repeat(4, 1fr); gap:4px; }
  }

  /* Phase D-1-e-2 — Recent Trades table inside the Performance tab.
     Compact rows, tabular-num alignment, mode-scoped (rendered from the
     selected segment's recentTrades). Hides the Exit Reason column on
     narrow viewports rather than wrapping. */
  .perf-trades-card { padding:14px 18px; margin-top:14px; }
  .perf-trades-card .card-title { margin-bottom:10px; }
  .perf-trades-table { width:100%; border-collapse:collapse; font-size:12px; font-variant-numeric:tabular-nums; }
  .perf-trades-table th {
    text-align:left; padding:8px 8px;
    color:var(--muted); font-weight:600; font-size:10px;
    text-transform:uppercase; letter-spacing:0.06em;
    border-bottom:1px solid var(--line);
    background:rgba(255,255,255,0.02);
  }
  .perf-trades-table td {
    padding:8px 8px; color:var(--text);
    border-bottom:1px solid rgba(255,255,255,0.04);
  }
  .perf-trades-table tbody tr:last-child td { border-bottom:0; }
  .perf-trades-table tbody tr:hover { background:rgba(255,255,255,0.02); }
  .perf-trades-table .col-time   { color:var(--muted); white-space:nowrap; font-size:11px; }
  .perf-trades-table .col-pct,
  .perf-trades-table .col-usd    { text-align:right; font-weight:600; }
  .perf-trades-table .col-reason { color:var(--muted); font-size:11px; }
  .perf-trades-table .pnl-good   { color:var(--green); }
  .perf-trades-table .pnl-bad    { color:var(--red); }
  @media (max-width: 780px) {
    .perf-trades-table th, .perf-trades-table td { padding:6px 6px; }
    .perf-trades-table .col-reason { display:none; }
    .perf-trades-table th:nth-child(7), .perf-trades-table td:nth-child(7) { display:none; }
  }

  /* Phase D-1-b — Bot Thinking tab. Visual language consistent with the
     existing .card rows; one new interpretive-note style and a list. */
  .bt-card { padding:14px 18px; }
  .bt-score { font-size:14px; color:var(--text); margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--line); }
  .bt-section-label { font-size:11px; text-transform:uppercase; color:var(--muted); margin-top:8px; margin-bottom:4px; letter-spacing:0.06em; }
  .bt-list { list-style:none; padding:0; margin:0; font-size:13px; }
  .bt-list li { padding:4px 0; color:var(--text); }
  .bt-pts { font-size:11px; color:var(--muted); margin-left:6px; }
  .bt-context { font-size:11px; color:var(--muted); margin-top:8px; padding-top:8px; border-top:1px solid var(--line); }
  .bt-interpretive-note {
    font-size:12px; color:var(--yellow); font-style:italic;
    margin-bottom:10px; padding:8px 12px;
    background:rgba(255,193,7,0.06); border-left:2px solid var(--yellow);
    border-radius:0 6px 6px 0; line-height:1.45;
  }
  .bt-verdict { font-size:18px; font-weight:700; margin-bottom:10px; line-height:1.3; }
  .bt-raw {
    background:rgba(255,255,255,0.04); padding:8px 10px; border-radius:6px;
    font-family:ui-monospace,Menlo,Monaco,monospace; font-size:11px;
    color:var(--muted); white-space:pre-wrap; word-break:break-word;
    border:1px solid var(--line);
  }
  .bt-raw-label { font-size:11px; color:var(--yellow); margin-bottom:6px; font-style:italic; }
</style>
</head>
<body>

<div class="wrap">
  <div class="topbar">
    <div>
      <h1>Agent Avila — Command Center</h1>
      <span class="preview-tag">PREVIEW · /dashboard-v2</span>
    </div>
    <div class="nav-links">
      <a href="/dashboard-legacy">Legacy Dashboard</a>
      <a href="/paper">/paper</a>
      <a href="/live">/live</a>
      <a href="/logout">Logout</a>
    </div>
  </div>

  <div id="stale-banner" class="stale-banner"></div>

  <!-- Phase C-1 — confirm modal + toast container. -->
  <div id="v2-modal-overlay" class="v2-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="v2-modal-title">
    <div class="v2-modal">
      <h3 id="v2-modal-title" class="v2-modal-title">Confirm action</h3>
      <div id="v2-modal-msg" class="v2-modal-msg"></div>
      <input id="v2-modal-input" class="v2-modal-input" type="text" autocomplete="off" />
      <div class="v2-modal-row">
        <button id="v2-modal-cancel" class="v2-modal-btn" type="button">Cancel</button>
        <button id="v2-modal-confirm" class="v2-modal-btn v2-modal-btn-confirm" type="button">Confirm</button>
      </div>
    </div>
  </div>
  <div id="v2-toast-container" class="v2-toast-container"></div>

  <!-- Section 1 — Quick Status Strip -->
  <div class="strip">
    <span class="pill">${modeIcon} ${modeLabel} MODE</span>
    <span class="pill" id="strip-bot"><span class="dot" id="strip-bot-dot"></span><span id="strip-bot-text">Loading…</span></span>
    <span class="pill" id="strip-buffer"><span id="strip-buffer-text">Daily-loss buffer: —</span></span>
    <span class="pill pill-muted" id="strip-cooldown"><span id="strip-cooldown-text">Cooldown: —</span></span>
    <span class="pill pill-muted" id="strip-data"><span id="strip-data-text">Data: —</span></span>
    <!-- Phase D-1-c: Pause/Resume promoted from Advanced Details. Reactive
         safety actions stay zero-click and never leave the operator's view.
         No confirmation modal — instant action + toast (matches C-1 spec). -->
    <button id="strip-pause"  class="strip-action" type="button" title="Pause trading: no new entries; existing exits still run" onclick="pauseBot(event)">⏸ Pause</button>
    <button id="strip-resume" class="strip-action" type="button" title="Resume trading: re-arm entry signals" onclick="resumeBot(event)">▶ Resume</button>
    <!-- Phase C-2: emergency override, always visible. Typed "KILL" required. -->
    <button id="strip-kill" class="strip-kill" type="button" aria-label="Activate kill switch — halts the bot immediately" title="Activate kill switch — halts the bot immediately (typed KILL required)" onclick="confirmKillNow(event)">⚠ KILL NOW</button>
  </div>

  <!-- Phase D-1-a — tab bar. Strip above stays sticky/visible across tabs;
       only this section and below switches per active tab. -->
  <nav class="tabs" role="tablist" aria-label="Dashboard sections">
    <button class="tab active" type="button" role="tab" data-tab="overview">Overview</button>
    <button class="tab"        type="button" role="tab" data-tab="bot-thinking">Bot Thinking</button>
    <button class="tab"        type="button" role="tab" data-tab="controls">Controls</button>
    <button class="tab"        type="button" role="tab" data-tab="performance">Performance</button>
    <button class="tab"        type="button" role="tab" data-tab="advanced">Advanced</button>
  </nav>

  <section class="tab-pane active" id="tab-overview" role="tabpanel" aria-labelledby="tab-overview">

  <!-- Section 2 — Hero KPI Strip -->
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Bot Mode</div>
      <div class="kpi-val" id="kpi-mode">${modeIcon} ${modeLabel}</div>
      <div class="kpi-sub" id="kpi-mode-sub">${isPaper ? "Simulated funds only" : "Real money active"}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">System Health</div>
      <div class="kpi-val" id="kpi-health">—</div>
      <div class="kpi-sub" id="kpi-health-sub">Loading…</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Position P&amp;L</div>
      <div class="kpi-val" id="kpi-pos">—</div>
      <div class="kpi-sub" id="kpi-pos-sub">No open trade</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Safety Buffer</div>
      <div class="kpi-val" id="kpi-buffer">—</div>
      <div class="kpi-sub" id="kpi-buffer-sub">Daily loss remaining</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Signal Score</div>
      <div class="kpi-val" id="kpi-signal">—</div>
      <div class="kpi-sub" id="kpi-signal-sub">vs threshold</div>
    </div>
  </div>

  <!-- Section 3 — Account Quick Links -->
  <div class="links">
    <a href="/paper" class="link-card link-card-paper">
      <div>
        <div class="link-card-title">View Full Paper Dashboard</div>
        <div class="link-card-sub">Canonical paper account view, history, W/L</div>
      </div>
      <span class="link-card-arrow">→</span>
    </a>
    <a href="/live" class="link-card link-card-live">
      <div>
        <div class="link-card-title">View Full Live Dashboard</div>
        <div class="link-card-sub">Canonical live account view, Kraken balance</div>
      </div>
      <span class="link-card-arrow">→</span>
    </a>
  </div>

  <!-- Section 4 — Open Position -->
  <div class="card">
    <div class="card-title">Open Position <span id="pos-mode-tag" class="pill pill-muted">${modeLabel}</span></div>
    <div id="pos-body"><div class="card-empty">Loading…</div></div>
  </div>

  <!-- Section 5 — Last Decision -->
  <div class="card">
    <div class="card-title">Last Decision <span id="dec-mode-tag" class="pill pill-muted">${modeLabel}</span></div>
    <div id="dec-body"><div class="card-empty">Loading…</div></div>
  </div>

  <!-- Section 6 — Bot Health Summary (renamed from Portfolio Intelligence) -->
  <div class="card">
    <div class="card-title">Bot Health Summary</div>
    <div id="health-body"><div class="card-empty">Loading…</div></div>
  </div>

  <!-- Section 7 — Strategy V2 Shadow -->
  <div class="card">
    <div class="card-title">🛰 Strategy V2 Shadow</div>
    <div class="v2-disclaimer">Shadow only — does not trade. V2 verdicts are read-only and do NOT place orders.</div>
    <div id="v2-body"><div class="card-empty">No V2 shadow data yet.</div></div>
  </div>

  <!-- Section 8 — Advanced Details placeholder (closed by default) -->
  <details class="adv">
    <summary>+ Advanced Details <span style="font-size:10px; color:var(--muted)">(heavy panels migration pointer)</span></summary>
    <div class="adv-body">
      <!-- Phase D-1-c — Lifecycle controls moved out of Overview. Pause and
           Resume live in the Quick Status Strip (zero-click); Start, Stop,
           Reset Kill Switch, and Manage Account Mode live in the Controls
           tab (one-click, behind the existing confirmation modals). KILL NOW
           remains in the Quick Status Strip. -->
      <div class="adv-section">
        <div class="adv-section-title">Heavy panels (will move here in Phase D)</div>
        <ul style="font-size:12px; color:var(--muted); padding-left:18px; margin:6px 0;">
          <li>Trade History &amp; Recent Runs (currently on /dashboard-legacy)</li>
          <li>Capital Router &amp; Active Strategies (currently on /dashboard-legacy)</li>
          <li>Trading Terminal &amp; Live Chart (currently on /dashboard-legacy)</li>
          <li>RSI History, Stats Overview (currently on /dashboard-legacy)</li>
          <li>How Agent 3.0 Works docs (currently on /dashboard-legacy)</li>
        </ul>
        <div style="font-size:11px;color:var(--muted)">Until Phase D ships, use the <a href="/dashboard-legacy" style="color:var(--accent)">Legacy Dashboard</a> for these views.</div>
      </div>

    </div>
  </details>

  </section><!-- /#tab-overview -->

  <!-- Phase D-1-a — placeholder panes. Each tab below ships its real
       content in a follow-up phase (D-1-b … D-1-e). For now they hold
       only a one-line "coming next" card so the route is wired and the
       tab bar feels complete. No data sources are added by these panes. -->
  <section class="tab-pane" id="tab-bot-thinking" role="tabpanel" aria-labelledby="tab-bot-thinking">
    <!-- Phase D-1-b — Bot Thinking. Read-only plain-English explanation
         derived entirely from the existing /api/v2/dashboard payload.
         No POSTs, no new endpoints, no bot.js coupling. -->
    <div class="card bt-card">
      <div class="card-title">📍 Right Now</div>
      <div id="bt-rightnow"><div class="card-empty">Loading…</div></div>
    </div>
    <div class="card bt-card">
      <div class="card-title" id="bt-why-title">🤔 Why It Skipped or Traded</div>
      <div id="bt-why"><div class="card-empty">Loading…</div></div>
    </div>
    <div class="card bt-card">
      <div class="card-title">📋 Last Check Snapshot — Missing Conditions</div>
      <div class="bt-interpretive-note">Based on the last bot check, these are the conditions that were still missing.</div>
      <div id="bt-waiting"><div class="card-empty">Loading…</div></div>
    </div>
    <div class="card bt-card">
      <div class="card-title">🛡 Risk Status</div>
      <div id="bt-risk"><div class="card-empty">Loading…</div></div>
    </div>
    <div class="card bt-card">
      <div class="card-title">🛰 Strategy V2 — Shadow Only</div>
      <div class="v2-disclaimer">Shadow only — informational only — does not place orders.</div>
      <div id="bt-v2"><div class="card-empty">Loading…</div></div>
    </div>
    <div class="card bt-card">
      <div class="card-title">✅ Is the Bot Safe to Keep Running?</div>
      <div id="bt-safe"><div class="card-empty">Loading…</div></div>
    </div>
  </section>

  <section class="tab-pane" id="tab-controls" role="tabpanel" aria-labelledby="tab-controls">
    <!-- Phase D-1-c — control reorganization. Pause/Resume + KILL NOW live in
         the always-visible Quick Status Strip (zero-click). Start/Stop and
         Reset Kill Switch live here behind their existing confirmations.
         Mode flip routes through /paper. No new POST surface; no new gate. -->
    <div class="card">
      <div class="card-title">🎛 Lifecycle</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Pause and Resume are in the top status strip for instant safety-up actions. Start and Stop are intentional structural changes — they ask for a single confirmation.</div>
      <div class="ctrl-row">
        <button class="ctrl-btn"            id="v2-btn-start" type="button" onclick="confirmStartBot(event)">Start Bot</button>
        <button class="ctrl-btn ctrl-btn-danger" id="v2-btn-stop" type="button" onclick="confirmStopBot(event)">Stop Bot</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">🔓 Recovery</div>
      <div class="ctrl-row">
        <button class="ctrl-btn ctrl-btn-danger" id="v2-btn-reset-kill" type="button" onclick="confirmResetKill(event)">Reset Kill Switch</button>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:10px">Paper mode: simple confirm. Live mode: typed CONFIRM (the Phase 3 server gate at /api/control independently rejects unconfirmed live POSTs). Activate KILL NOW from the top status strip; reset it here once the situation is handled.</div>
    </div>
    <div class="card">
      <div class="card-title">🔁 Account Mode</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Mode switching lives on the canonical /paper view, where you can audit positions and balance before flipping. Server-side preflight blocks unsafe flips with 409 regardless of source.</div>
      <a class="ctrl-btn ctrl-btn-link" href="/paper" title="Mode switching lives on the canonical /paper view, where you can audit positions and balance before flipping. Server-side preflight blocks unsafe flips with 409 regardless of source.">Manage Account Mode →</a>
    </div>
  </section>

  <section class="tab-pane" id="tab-performance" role="tabpanel" aria-labelledby="tab-performance">
    <!-- Phase D-1-e-1 — Performance tab (KPI tiles only). Read-only, no
         new endpoints, no POST. Reads /api/paper-summary or /api/live-summary
         (already shipped, mode-scoped) based on the segmented tab below.
         Profit Factor + Realized Drawdown computed client-side from the
         mode-filtered EXIT entries in summary.recentTrades. perfState is
         intentionally NOT read here (mode-blind). -->
    <div class="perf-seg-row">
      <span class="perf-seg-label">Showing performance for:</span>
      <div class="perf-seg-group" role="tablist" aria-label="Performance mode">
        <button class="perf-seg" type="button" role="tab" data-perf-mode="paper">Paper</button>
        <button class="perf-seg" type="button" role="tab" data-perf-mode="live">Live</button>
      </div>
    </div>

    <div class="kpis perf-kpis">
      <div class="kpi">
        <div class="kpi-label">Today's P&amp;L<span class="help-icon" tabindex="0" role="button" aria-label="Today's P&L scope explained" data-help="Today is the current UTC calendar day. Daily limits use UTC day for bot safety, so this resets at 00:00 UTC regardless of your local time." title="Today is the current UTC calendar day. Daily limits use UTC day for bot safety, so this resets at 00:00 UTC regardless of your local time.">?</span></div>
        <div class="kpi-val" id="pf-today">—</div>
        <div class="kpi-sub">today UTC · bot-recorded · resets 00:00 UTC</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Win Rate</div>
        <div class="kpi-val" id="pf-winrate">—</div>
        <div class="kpi-sub" id="pf-winrate-sub">how often the bot wins</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Profit Factor<span class="help-icon" tabindex="0" role="button" aria-label="Profit Factor explained" data-help="Total $ won divided by total $ lost on closed exits. Above 1.0 means winners outweigh losers." title="Total $ won divided by total $ lost on closed exits. Above 1.0 means winners outweigh losers.">?</span></div>
        <div class="kpi-val" id="pf-profitfactor">—</div>
        <div class="kpi-sub" id="pf-profitfactor-sub">$ made per $ lost</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">All-time P&amp;L</div>
        <div class="kpi-val" id="pf-alltime">—</div>
        <div class="kpi-sub">total · bot-recorded</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Realized Drawdown<span class="help-icon" tabindex="0" role="button" aria-label="Realized Drawdown explained" data-help="Biggest peak-to-trough drop in cumulative P&amp;L across closed exits. Needs at least 5 closed exits to compute." title="Biggest peak-to-trough drop in cumulative P&L across closed exits. Needs at least 5 closed exits to compute.">?</span></div>
        <div class="kpi-val" id="pf-drawdown">—</div>
        <div class="kpi-sub" id="pf-drawdown-sub">peak-to-trough · closed exits</div>
      </div>
    </div>

    <!-- Phase D-1-e-2 — Recent Trades table for the selected mode segment.
         Reads recentTrades from /api/paper-summary or /api/live-summary
         (already shipped); shows the last EXIT entries with orderPlaced=true.
         No new endpoint, no POST, no bot.js change. -->
    <div class="card perf-trades-card">
      <div class="card-title">📜 Recent Trades — bot-recorded P&amp;L</div>
      <div id="pf-trades-body"><div class="card-empty">Loading…</div></div>
    </div>

    <!-- Phase D-1-e-3 — Condition Pass Rates + 10-cycle heatmap. Reads
         decisionLog strings from the v2 dashboard payload (mode-blind,
         cycle-level). The sub-label makes that scope explicit so the
         operator does not read this as account P&L. -->
    <div class="card perf-conditions-card">
      <div class="card-title">📊 Condition Pass Rates — cycle-level<span class="help-icon" tabindex="0" role="button" aria-label="Condition Pass Rates explained" data-help="How often each strategy condition (EMA trend, RSI dip, VWAP support, Not extended) cleared in recent cycles. Cycle-level — not account performance." title="How often each strategy condition cleared in recent cycles. Cycle-level — not account performance.">?</span></div>
      <div class="card-sublabel">Cycle-level signal quality from recent bot checks. Not paper/live account performance.</div>
      <div id="pf-conditions-body"><div class="card-empty">Loading…</div></div>
    </div>

    <!-- Phase D-1-e-4 — Strategy V2 Shadow Analysis. Collapsed by default
         (native <details>). Reads recentStrategyV2 from /api/v2/dashboard;
         shadow-only. The disclaimer at the top of the expanded body is
         load-bearing — V2 must never be read as a trade signal. -->
    <details class="card perf-v2-card">
      <summary class="perf-v2-summary">
        <span class="card-title" style="margin:0">🔬 Strategy V2 Shadow Analysis — cycle-level<span class="help-icon" tabindex="0" role="button" aria-label="Strategy V2 Shadow Analysis explained" data-help="Compares the bot's actual decisions to V2's hypothetical ones. Read-only — V2 never places orders." title="Compares the bot's actual decisions to V2's hypothetical ones. Read-only — V2 never places orders.">?</span></span>
        <span class="perf-v2-toggle-hint">click to expand</span>
      </summary>
      <div class="perf-v2-body">
        <div class="perf-v2-disclaimer">
          Strategy V2 is shadow analysis only. It does not place orders, alter sizing, pause trading, or change V1 decisions. These numbers compare V1 decisions with V2 hypothetical verdicts for observation only.
        </div>
        <div class="card-sublabel">Cycle-level shadow comparison, not account performance.</div>
        <div id="pf-v2-body"><div class="card-empty">Loading…</div></div>
      </div>
    </details>

    <div class="perf-context">
      <strong>Note:</strong> P&amp;L values are bot-recorded and may differ from the broker on live trades due to fees and slippage. Live mode reconciliation lives on <a href="/live" style="color:var(--accent)">/live</a>.
    </div>
  </section>

  <section class="tab-pane" id="tab-advanced" role="tabpanel" aria-labelledby="tab-advanced">
    <!-- Phase D-1-f-1 — Advanced tab Raw Decision Log. Read-only,
         cycle-level (mode-blind), reuses recentDecisionLogs already
         exposed on /api/v2/dashboard. No new endpoint, no POST. -->
    <div class="card adv-rawlog-card">
      <div class="card-title">🐛 Raw Decision Log</div>
      <div class="card-sublabel">Raw debug view — for troubleshooting. Not account performance.</div>
      <div id="adv-rawlog-body"><div class="card-empty">Loading…</div></div>
    </div>

    <!-- Phase D-1-f-2 — Advanced tab Recent Bot Activity timeline. Read-only,
         narrative view of the last 20 cycles. Mode pill shows on TRADED and
         EXITED rows only. Reuses recentActivity from /api/v2/dashboard. -->
    <div class="card adv-activity-card">
      <div class="card-title">📜 Recent Bot Activity</div>
      <div class="card-sublabel">Last 20 cycles, newest first. Action narrative — not account performance.</div>
      <div id="adv-activity-body"><div class="card-empty">Loading…</div></div>
    </div>

    <!-- Phase D-1-f-3 — Advanced tab Active Strategies. Description-only.
         No parameter rows; tunables live on Controls / Bot Thinking. Reads
         only the existing control snapshot for V1 status + mode badges. -->
    <div class="card adv-strategies-card">
      <div class="card-title">🧠 Active Strategies</div>
      <div class="card-sublabel">Which strategies are wired and how. Read-only — strategy logic lives in the bot.</div>
      <div id="adv-strategies-body"><div class="card-empty">Loading…</div></div>
    </div>

    <!-- Phase D-1-f-4 — Legacy Dashboard link card. Navigation only. The
         heavy panels (RSI history, Capital Router, full Trade History,
         Trading Terminal) still live on /dashboard-legacy; this card keeps
         that escape hatch one click away from the new dashboard. -->
    <div class="card adv-legacy-card">
      <div class="card-title">📂 Legacy Dashboard</div>
      <div class="card-sublabel">Need the full old detailed view? Open the legacy dashboard for heavy panels, charts, history, and raw tools.</div>
      <a class="adv-legacy-link" href="/dashboard-legacy">View full detail in Legacy Dashboard →</a>
    </div>
  </section>

</div>

<script>
// Phase A — read-only client. ONLY GET requests, ONLY existing endpoints.
// No POST. No SSE writes. No /api/control, /api/trade, /api/run-bot.
window.__INIT__ = ${initialJson};
let _lastTickAt = Date.now();
// Phase C-3 / D-1-e-1 — last-seen control snapshot. Hoisted ABOVE the
// initial activateTab() call below so handlers wired into tab activation
// (e.g. initPerfModeIfNeeded) can read it without hitting the TDZ.
let _lastCtrl = window.__INIT__?.control ?? null;
// Phase D-1-e-1 — Performance tab state. Hoisted for the same TDZ reason:
// activateTab("performance") on initial hash-load triggers initPerfModeIfNeeded
// which reads these.
let _perfMode = null;
const _perfCache = { paper: null, live: null };
// Phase D-1-e-3 — recent cycle decisionLogs for the cycle-level Condition
// Pass Rates card. Mode-blind on purpose. Same TDZ reasoning as above.
let _recentDecisionLogs = window.__INIT__?.recentDecisionLogs ?? null;
// Phase D-1-e-4 — recent cycle V1/V2 outcomes for the Strategy V2 Shadow
// Analysis card. Mode-blind, read-only. Same TDZ reasoning as above.
let _recentStrategyV2 = window.__INIT__?.recentStrategyV2 ?? null;
// Phase D-1-f-2 — recent cycle activity projection for the Advanced tab
// Recent Bot Activity timeline. Mode-blind, read-only. TDZ-safe hoist.
let _recentActivity = window.__INIT__?.recentActivity ?? null;

// Phase D-1-a — tab routing via URL hash. Hashes: #overview, #bot-thinking,
// #controls, #performance, #advanced. Default = overview. Invalid hash falls
// back to overview. The Quick Status Strip (with KILL) lives ABOVE the tab
// bar so it stays visible regardless of which tab is active.
const TAB_NAMES = ["overview","bot-thinking","controls","performance","advanced"];
function activateTab(name) {
  if (!TAB_NAMES.includes(name)) name = "overview";
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("active", p.id === "tab-" + name));
  // Phase D-1-e-1 — populate the Performance tab the first time it's opened.
  if (name === "performance" && typeof initPerfModeIfNeeded === "function") initPerfModeIfNeeded();
}
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
  const name = t.dataset.tab;
  if (window.location.hash !== "#" + name) {
    window.location.hash = name;
  } else {
    activateTab(name);
  }
}));
window.addEventListener("hashchange", () => {
  activateTab(window.location.hash.slice(1) || "overview");
});
activateTab(window.location.hash.slice(1) || "overview");

function fmtMoney(n) { if (n == null || isNaN(n)) return "—"; const sign = n >= 0 ? "+" : "−"; return sign + "$" + Math.abs(n).toFixed(2); }
function fmtPct(n)   { if (n == null || isNaN(n)) return "—"; return (n >= 0 ? "+" : "") + n.toFixed(2) + "%"; }
function timeAgo(ts) {
  if (!ts) return "—";
  const sec = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (sec < 60)  return sec + "s ago";
  if (sec < 3600) return Math.round(sec/60) + "m ago";
  return Math.round(sec/3600) + "h ago";
}
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
function setHTML(id, h) { const el = document.getElementById(id); if (el) el.innerHTML = h; }

function renderStrip(ctrl, health, latest) {
  // Bot status pill
  const botDot   = document.getElementById("strip-bot-dot");
  const botTxt   = document.getElementById("strip-bot-text");
  // Phase D-2-f — defensive guard. The strip lives on /dashboard-v2 only;
  // on the combined /dashboard the strip elements are absent. Skip silently
  // so applyData can continue to renderBotThinking / Controls etc.
  if (!botDot || !botTxt) return;
  if (ctrl?.killed)        { botDot.className = "dot err";  botTxt.textContent = "KILLED"; }
  else if (ctrl?.stopped)  { botDot.className = "dot err";  botTxt.textContent = "STOPPED"; }
  else if (ctrl?.paused)   { botDot.className = "dot warn"; botTxt.textContent = "PAUSED"; }
  else if (health?.bot === "running") { botDot.className = "dot"; botTxt.textContent = "RUNNING"; }
  else                     { botDot.className = "dot warn"; botTxt.textContent = (health?.bot || "unknown"); }
  // Daily-loss buffer
  const cap = ctrl?.maxDailyLossPct ?? 3;
  setText("strip-buffer-text", "Daily-loss cap: " + cap + "%");
  // Cooldown
  setText("strip-cooldown-text", ctrl?.lastTradeTime ? "Cooldown ⏳ active" : "Cooldown ✓ clear");
  // Data freshness
  if (latest?.timestamp) {
    const age = Math.round((Date.now() - new Date(latest.timestamp).getTime()) / 1000);
    setText("strip-data-text", "Last cycle " + (age < 60 ? age + "s" : Math.round(age/60) + "m") + " ago");
  } else {
    setText("strip-data-text", "Last cycle: n/a");
  }
}

function renderKpis(ctrl, health, position, latest, summary, safetyBuffer) {
  // System health
  const allOk = health?.krakenOk && health?.bot === "running" && (health?.lastRunAge ?? 99) < 10;
  const el = document.getElementById("kpi-health");
  // Phase D-2-f — defensive guard for combined /dashboard (KPI tiles absent).
  if (!el) return;
  el.textContent = allOk ? "✓ Healthy" : "⚠ Degraded";
  el.className = "kpi-val " + (allOk ? "kpi-good" : "kpi-warn");
  setText("kpi-health-sub",
    "Kraken " + (health?.krakenLatency ?? "—") + "ms · " +
    "data " + (health?.lastRunAge != null ? Math.round(health.lastRunAge) + "m" : "—"));

  // Position P&L
  if (position?.open && latest?.price && position.entryPrice) {
    const pnlPct = ((latest.price - position.entryPrice) / position.entryPrice) * 100;
    const posEl = document.getElementById("kpi-pos");
    posEl.textContent = fmtPct(pnlPct);
    posEl.className = "kpi-val " + (pnlPct >= 0 ? "kpi-good" : "kpi-bad");
    setText("kpi-pos-sub", "Entry $" + Number(position.entryPrice).toFixed(4));
  } else {
    setText("kpi-pos", "—");
    document.getElementById("kpi-pos").className = "kpi-val";
    setText("kpi-pos-sub", "No open trade");
  }

  // Safety Buffer — Phase B: server-computed, includes BOTH realized today
  // AND unrealized open-position exposure. Shows the SOFT remaining (after
  // unrealized) as the headline so the operator can't see "Healthy" while
  // a position is bleeding. The hard remaining (kill-switch view) lives in
  // the sub-line when an open position is in the red.
  const sb = safetyBuffer || {};
  const cap            = Number(sb.capPct ?? ctrl?.maxDailyLossPct ?? 3);
  const realizedPct    = Number(sb.realizedLossTodayPct ?? 0);
  const unrealizedPct  = Number(sb.unrealizedLossPct ?? 0);
  const remainingSoft  = Number(sb.remainingSoftPct ?? cap);
  const openPosPct     = sb.openPositionPct;
  const bufEl = document.getElementById("kpi-buffer");
  bufEl.textContent = remainingSoft.toFixed(2) + "%";
  bufEl.className = "kpi-val " + (remainingSoft > cap * 0.5 ? "kpi-good" : remainingSoft > 0 ? "kpi-warn" : "kpi-bad");
  let sub;
  if (openPosPct != null && openPosPct < 0) {
    // Open position is in the red — the buffer headline already includes
    // its unrealized hit. Surface the breakdown so the math is auditable.
    sub = "Realized: " + realizedPct.toFixed(2) + "% · Open: " + openPosPct.toFixed(2) + "% (incl.)";
  } else if (openPosPct != null && openPosPct >= 0) {
    sub = "Realized: " + realizedPct.toFixed(2) + "% · Open: +" + openPosPct.toFixed(2) + "% (excluded)";
  } else if (realizedPct > 0) {
    sub = "Realized today: " + realizedPct.toFixed(2) + "% of " + cap + "% cap";
  } else {
    sub = "of " + cap + "% daily cap";
  }
  setText("kpi-buffer-sub", sub);

  // Signal score
  if (latest?.signalScore != null) {
    const score = Number(latest.signalScore);
    const thr   = Number(latest?.perfState?.adaptedThreshold ?? 75);
    const sigEl = document.getElementById("kpi-signal");
    sigEl.textContent = Math.round(score) + "/100";
    sigEl.className = "kpi-val " + (score >= thr ? "kpi-good" : "kpi-warn");
    setText("kpi-signal-sub", "threshold " + thr);
  } else {
    setText("kpi-signal", "—");
    setText("kpi-signal-sub", "no recent decision");
  }
}

function renderPosition(position, latest) {
  const el = document.getElementById("pos-body");
  // Phase D-2-f — defensive guard for combined /dashboard (pos-body absent).
  if (!el) return;
  if (!position?.open) {
    el.innerHTML = '<div class="card-empty">No open trade — bot is watching for the next entry signal.</div>';
    return;
  }
  const pnl = (latest?.price && position.entryPrice)
    ? ((latest.price - position.entryPrice) / position.entryPrice) * 100
    : null;
  el.innerHTML =
    '<div class="card-row"><span class="card-row-label">Side</span><span class="card-row-val">' + (position.side || "long").toUpperCase() + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Entry</span><span class="card-row-val">$' + Number(position.entryPrice).toFixed(4) + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Stop loss</span><span class="card-row-val">$' + Number(position.stopLoss || 0).toFixed(4) + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Take profit</span><span class="card-row-val">$' + Number(position.takeProfit || 0).toFixed(4) + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Leverage</span><span class="card-row-val">' + (position.leverage || 1) + '×</span></div>' +
    '<div class="card-row"><span class="card-row-label">P&amp;L</span><span class="card-row-val" style="color:' + (pnl == null ? 'var(--muted)' : pnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (pnl == null ? "—" : fmtPct(pnl)) + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Opened</span><span class="card-row-val">' + timeAgo(position.entryTime) + '</span></div>';
}

function renderDecision(latest) {
  const el = document.getElementById("dec-body");
  // Phase D-2-f — defensive guard for combined /dashboard (dec-body absent).
  if (!el) return;
  if (!latest) { el.innerHTML = '<div class="card-empty">No decision logged yet.</div>'; return; }
  const verdict = latest.type === "EXIT"
    ? "EXIT · " + (latest.exitReason || "—")
    : (latest.allPass ? "TRADE FIRED" : "SKIP");
  const score = latest.signalScore != null ? Math.round(latest.signalScore) + "/100" : "—";
  el.innerHTML =
    '<div class="card-row"><span class="card-row-label">Verdict</span><span class="card-row-val">' + verdict + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">When</span><span class="card-row-val">' + timeAgo(latest.timestamp) + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Price</span><span class="card-row-val">$' + (latest.price != null ? Number(latest.price).toFixed(4) : "—") + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Signal score</span><span class="card-row-val">' + score + '</span></div>' +
    (latest.decisionLog ? '<div class="card-row"><span class="card-row-label">Detail</span><span class="card-row-val" style="font-size:11px;text-align:right;max-width:60%">' +
      String(latest.decisionLog).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") + '</span></div>' : "");
}

function renderHealth(health) {
  const el = document.getElementById("health-body");
  // Phase D-2-f — defensive guard for combined /dashboard (health-body absent).
  if (!el) return;
  if (!health) { el.innerHTML = '<div class="card-empty">Health data unavailable.</div>'; return; }
  el.innerHTML =
    '<div class="card-row"><span class="card-row-label">Kraken API</span><span class="card-row-val" style="color:' + (health.krakenOk ? 'var(--green)' : 'var(--red)') + '">' + (health.kraken || "?") + ' · ' + (health.krakenLatency || "—") + 'ms</span></div>' +
    '<div class="card-row"><span class="card-row-label">WebSocket</span><span class="card-row-val">' + (health.websocket || "—") + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Bot engine</span><span class="card-row-val" style="color:' + (health.bot === "running" ? 'var(--green)' : 'var(--yellow)') + '">' + (health.bot || "?") + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Last run age</span><span class="card-row-val">' + (health.lastRunAge != null ? Math.round(health.lastRunAge) + " min" : "—") + '</span></div>';
}

function renderV2(latest) {
  const v2 = latest?.strategyV2;
  const el = document.getElementById("v2-body");
  // Phase D-2-f — defensive guard for combined /dashboard (v2-body absent).
  if (!el) return;
  if (!v2 || typeof v2 !== "object") {
    el.innerHTML = '<div class="card-empty">No V2 shadow data yet.</div>';
    return;
  }
  const tIcon = (t) => t === "bullish" ? "📈" : t === "bearish" ? "📉" : "—";
  const cIcon = (b) => b ? "✓" : "✗";
  const cCol  = (b) => b ? "var(--green)" : "var(--muted)";
  const decision = String(v2.decision || "NO_TRADE");
  const skip  = v2.skipReason ? '<div class="card-row"><span class="card-row-label">Skip reason</span><span class="card-row-val">' + String(v2.skipReason) + '</span></div>' : "";
  el.innerHTML =
    '<div class="card-row"><span class="card-row-label">4H trend</span><span class="card-row-val">' + tIcon(v2.trend4h) + ' ' + (v2.trend4h || "—") + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">15M trend</span><span class="card-row-val">' + tIcon(v2.trend15m) + ' ' + (v2.trend15m || "—") + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Liq sweep</span><span class="card-row-val" style="color:' + cCol(v2.sweep?.detected) + '">' + cIcon(v2.sweep?.detected) + (v2.sweep?.detected ? " detected" : " not detected") + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">5M BOS</span><span class="card-row-val" style="color:' + cCol(v2.bos?.detected) + '">' + cIcon(v2.bos?.detected) + (v2.bos?.detected ? " confirmed" : " not confirmed") + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Pullback</span><span class="card-row-val" style="color:' + cCol(v2.pullback?.ok) + '">' + cIcon(v2.pullback?.ok) + (v2.pullback?.ok ? " valid" : " not valid") + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Decision</span><span class="card-row-val" style="font-weight:700;color:' + (decision === "TRADE" ? 'var(--green)' : decision.includes("DEFERRED") ? 'var(--yellow)' : 'var(--muted)') + '">' + decision + ' (shadow)</span></div>' +
    skip;
}

// Phase D-1-b — Bot Thinking helpers. Defensive parser + plain-English
// translator. Read-only: never POSTs, never mutates state, never imports
// from bot.js. Per Codex guardrails:
//  - parser wrapped in try/catch; unknown tokens silently ignored
//  - parseFailed → display escaped raw decisionLog
//  - never hardcode the score threshold (75) or RSI cutoff (35) — read from
//    the parsed decisionLog itself or perfState.adaptedThreshold
//  - all dynamic text escaped via btEsc()
//  - V2 surfaced read-only with the unconditional shadow disclaimer
//  - "Next trade waiting for" prefaced as interpretive
function btEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
const BT_CONDITION_PLAIN = {
  "ema trend":     "Price uptrend (EMA(8) rising)",
  "ema":           "Price uptrend (EMA(8) rising)",
  "rsi dip":       "RSI(3) showing oversold dip",
  "rsi":           "RSI(3) showing oversold dip",
  "vwap support":  "VWAP buyers in control",
  "vwap":          "VWAP buyers in control",
  "not extended":  "Price not stretched from recent peaks",
};
function btConditionPlain(name) {
  if (!name) return "—";
  const key = String(name).toLowerCase().trim();
  return BT_CONDITION_PLAIN[key] || name;
}
function btParseDecisionLog(str) {
  if (!str || typeof str !== "string") return { parseFailed: true, raw: "" };
  try {
    const segments = str.split("|").map(s => s.trim()).filter(Boolean);
    if (segments.length === 0) throw new Error("empty");
    const result = {
      verdict: null, conditions: [], total: null, threshold: null,
      regime: null, leverage: null, missing: [], parseFailed: false, raw: str,
    };
    result.verdict = segments[0].replace(/^[^A-Za-z]+/, "").trim() || segments[0];
    // NOTE: this script body lives inside a backtick template literal in
    // dashboard.js, which silently swallows unknown JS escape sequences in
    // regex literals (\\d → d, \\s → s, \\/ → /). Use double-escaped forms
    // here so the *emitted* regex receives \\d, \\s, \\/ as intended.
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      let m;
      if      ((m = seg.match(/^TOTAL SCORE:\\s*(\\d+)\\s*\\/\\s*\\d+/i))) result.total = parseInt(m[1], 10);
      else if ((m = seg.match(/^THRESHOLD:\\s*(\\d+)/i)))                   result.threshold = parseInt(m[1], 10);
      else if ((m = seg.match(/^REGIME:\\s*(.+)/i)))                       result.regime = m[1].trim();
      else if ((m = seg.match(/^LEVERAGE:\\s*(.+)/i)))                     result.leverage = m[1].trim();
      else if ((m = seg.match(/^MISSING:\\s*(.+)/i)))                      result.missing = m[1].split(",").map(s => s.trim()).filter(Boolean);
      else if ((m = seg.match(/^([^:]+):\\s*\\+?(-?\\d+)\\s*$/)))           result.conditions.push({ name: m[1].trim(), points: parseInt(m[2], 10) });
      // unknown segments silently ignored
    }
    return result;
  } catch (e) {
    return { parseFailed: true, raw: str };
  }
}

function renderBtRightNow(ctrl, latest, parsed) {
  const el = document.getElementById("bt-rightnow");
  if (!el) return;
  if (!latest) { el.innerHTML = '<div class="card-empty">No bot cycle logged yet.</div>'; return; }
  const price = latest.price != null ? "$" + Number(latest.price).toFixed(4) : "—";
  const regime = parsed && !parsed.parseFailed && parsed.regime ? btEsc(parsed.regime) : "—";
  const ago = timeAgo(latest.timestamp);
  const verdictRaw = parsed && !parsed.parseFailed && parsed.verdict
    ? parsed.verdict
    : (latest.type === "EXIT" ? "EXITED" : (latest.allPass ? "TRADE FIRED" : "SKIPPED"));
  const score = (parsed && !parsed.parseFailed && parsed.total != null && parsed.threshold != null)
    ? parsed.total + "/100 (needs " + parsed.threshold + ")" : "";
  const modeLabel = ctrl?.paperTrading !== false ? "📋 PAPER" : "🔴 LIVE";
  el.innerHTML =
    '<div class="card-row"><span class="card-row-label">Mode</span><span class="card-row-val">' + modeLabel + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Current price</span><span class="card-row-val">' + price + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Market Environment</span><span class="card-row-val">' + regime + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Last cycle</span><span class="card-row-val">' + ago + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Verdict</span><span class="card-row-val">' + btEsc(verdictRaw) + (score ? ' <span class="bt-pts">' + score + '</span>' : '') + '</span></div>';
}

function renderBtWhy(latest, parsed) {
  const titleEl = document.getElementById("bt-why-title");
  const bodyEl = document.getElementById("bt-why");
  if (!bodyEl) return;
  if (!latest) { bodyEl.innerHTML = '<div class="card-empty">No bot decision logged yet.</div>'; return; }
  const verb = latest.type === "EXIT" ? "Exited"
             : (parsed && !parsed.parseFailed && parsed.verdict && parsed.verdict.toUpperCase().includes("TRADE")) ? "Traded"
             : (latest.allPass ? "Traded" : "Skipped");
  if (titleEl) titleEl.textContent = "🤔 Why It " + verb;
  if (parsed && parsed.parseFailed) {
    bodyEl.innerHTML =
      '<div class="bt-raw-label">Raw — parsing failed:</div>' +
      '<div class="bt-raw">' + btEsc(parsed.raw) + '</div>';
    return;
  }
  let html = '';
  if (parsed.total != null && parsed.threshold != null) {
    const passed = parsed.total >= parsed.threshold;
    html += '<div class="bt-score">Score: <strong>' + parsed.total + '/100</strong> — needs ' + parsed.threshold + (passed ? ' ✓' : ' (not met)') + '</div>';
  }
  if (latest.type === "EXIT" && latest.exitReason) {
    html += '<div class="bt-context" style="margin-top:0;border-top:0;padding-top:0">Exit reason: <strong>' + btEsc(latest.exitReason) + '</strong></div>';
  }
  if (parsed.conditions && parsed.conditions.length > 0) {
    const passedC = parsed.conditions.filter(c => c.points > 0);
    const failedC = parsed.conditions.filter(c => c.points <= 0);
    if (passedC.length > 0) {
      html += '<div class="bt-section-label">✓ Passed</div><ul class="bt-list">';
      for (const c of passedC) html += '<li>🟢 ' + btEsc(btConditionPlain(c.name)) + ' <span class="bt-pts">+' + c.points + ' pts · ' + btEsc(c.name) + '</span></li>';
      html += '</ul>';
    }
    if (failedC.length > 0) {
      html += '<div class="bt-section-label">✗ Did not pass</div><ul class="bt-list">';
      for (const c of failedC) html += '<li>🔴 ' + btEsc(btConditionPlain(c.name)) + ' <span class="bt-pts">+' + c.points + ' pts · ' + btEsc(c.name) + '</span></li>';
      html += '</ul>';
    }
  } else if (latest.type !== "EXIT") {
    html += '<div class="card-empty">No condition breakdown available for this cycle.</div>';
  }
  if (parsed.regime || parsed.leverage) {
    html += '<div class="bt-context">' + (parsed.regime ? 'Regime: <strong>' + btEsc(parsed.regime) + '</strong>' : '') +
            (parsed.regime && parsed.leverage ? ' · ' : '') +
            (parsed.leverage ? 'Leverage: <strong>' + btEsc(parsed.leverage) + '</strong>' : '') + '</div>';
  }
  bodyEl.innerHTML = html || '<div class="card-empty">No further detail.</div>';
}

function renderBtWaiting(latest, parsed) {
  const el = document.getElementById("bt-waiting");
  if (!el) return;
  if (!latest || !parsed || parsed.parseFailed) {
    el.innerHTML = '<div class="card-empty">No data on what the bot is waiting for.</div>';
    return;
  }
  if (latest.type === "EXIT") {
    el.innerHTML = '<div class="card-empty">Bot just exited a position. Watching for the next entry signal.</div>';
    return;
  }
  if (parsed.verdict && parsed.verdict.toUpperCase().includes("TRADE")) {
    el.innerHTML = '<div class="card-empty">Bot just opened a trade. Monitoring exit conditions.</div>';
    return;
  }
  if (Array.isArray(parsed.missing) && parsed.missing.length > 0) {
    let html = '<ul class="bt-list">';
    for (const item of parsed.missing) html += '<li>▸ ' + btEsc(item) + '</li>';
    html += '</ul>';
    if (parsed.threshold != null && parsed.total != null) {
      const gap = parsed.threshold - parsed.total;
      html += '<div class="bt-context">Score gap: needs ' + Math.max(0, gap) + ' more points before threshold (' + parsed.threshold + ').</div>';
    }
    el.innerHTML = html;
  } else {
    el.innerHTML = '<div class="card-empty">No specific conditions listed in the latest cycle.</div>';
  }
}

function renderBtRisk(ctrl, sb) {
  const el = document.getElementById("bt-risk");
  if (!el) return;
  const cap = Number(sb?.capPct ?? ctrl?.maxDailyLossPct ?? 3);
  const realized = Number(sb?.realizedLossTodayPct ?? 0);
  const unrealized = Number(sb?.unrealizedLossPct ?? 0);
  const remainingSoft = Number(sb?.remainingSoftPct ?? cap);
  const consec = ctrl?.consecutiveLosses ?? 0;
  const pauseAt = ctrl?.pauseAfterLosses ?? null;
  const bufferIcon = remainingSoft > cap * 0.5 ? "🟢" : remainingSoft > 0 ? "🟡" : "🔴";
  const cooldownState = ctrl?.lastTradeTime ? "⏳ active" : "✓ clear";
  const killedState = ctrl?.killed ? "🚨 ACTIVE — bot halted" : "🛡 armed";
  let html = '';
  html += '<div class="card-row"><span class="card-row-label">Daily-loss buffer</span><span class="card-row-val">' + bufferIcon + ' ' + remainingSoft.toFixed(2) + '% of ' + cap + '% cap</span></div>';
  html += '<div class="card-row" style="font-size:11px"><span class="card-row-label" style="padding-left:14px">↳ Realized today</span><span class="card-row-val">' + realized.toFixed(2) + '%</span></div>';
  if (unrealized > 0) {
    html += '<div class="card-row" style="font-size:11px"><span class="card-row-label" style="padding-left:14px">↳ Unrealized open</span><span class="card-row-val">' + unrealized.toFixed(2) + '%</span></div>';
  }
  html += '<div class="card-row"><span class="card-row-label">Consecutive losses</span><span class="card-row-val">' + consec + (pauseAt != null ? ' (auto-pauses at ' + pauseAt + ')' : '') + '</span></div>';
  html += '<div class="card-row"><span class="card-row-label">Kill switch</span><span class="card-row-val">' + killedState + '</span></div>';
  html += '<div class="card-row"><span class="card-row-label">Cooldown</span><span class="card-row-val">' + cooldownState + '</span></div>';
  el.innerHTML = html;
}

function renderBtV2(latest) {
  const el = document.getElementById("bt-v2");
  if (!el) return;
  const v2 = latest?.strategyV2;
  if (!v2 || typeof v2 !== "object") {
    el.innerHTML = '<div class="card-empty">No V2 shadow data yet.</div>';
    return;
  }
  const tIcon = (t) => t === "bullish" ? "📈" : t === "bearish" ? "📉" : "—";
  const cIcon = (b) => b ? "✓" : "✗";
  const cCol  = (b) => b ? "var(--green)" : "var(--muted)";
  const decision = String(v2.decision || "NO_TRADE");
  let html = '';
  html += '<div class="card-row"><span class="card-row-label">4H trend</span><span class="card-row-val">' + tIcon(v2.trend4h) + ' ' + btEsc(v2.trend4h || "—") + '</span></div>';
  html += '<div class="card-row"><span class="card-row-label">15M trend</span><span class="card-row-val">' + tIcon(v2.trend15m) + ' ' + btEsc(v2.trend15m || "—") + '</span></div>';
  html += '<div class="card-row"><span class="card-row-label">Liquidity sweep</span><span class="card-row-val" style="color:' + cCol(v2.sweep?.detected) + '">' + cIcon(v2.sweep?.detected) + ' ' + (v2.sweep?.detected ? "detected" : "not detected") + '</span></div>';
  html += '<div class="card-row"><span class="card-row-label">5M BOS</span><span class="card-row-val" style="color:' + cCol(v2.bos?.detected) + '">' + cIcon(v2.bos?.detected) + ' ' + (v2.bos?.detected ? "confirmed" : "not confirmed") + '</span></div>';
  html += '<div class="card-row"><span class="card-row-label">Pullback</span><span class="card-row-val" style="color:' + cCol(v2.pullback?.ok) + '">' + cIcon(v2.pullback?.ok) + ' ' + (v2.pullback?.ok ? "valid" : "not valid") + '</span></div>';
  html += '<div class="card-row"><span class="card-row-label">V2 verdict</span><span class="card-row-val" style="font-weight:700">' + btEsc(decision) + ' (shadow)</span></div>';
  if (v2.skipReason) {
    html += '<div class="card-row"><span class="card-row-label">Reason</span><span class="card-row-val" style="font-size:11px;text-align:right;max-width:60%">' + btEsc(v2.skipReason) + '</span></div>';
  }
  if (v2.setupQuality) {
    html += '<div class="card-row"><span class="card-row-label">Setup quality</span><span class="card-row-val">' + btEsc(v2.setupQuality) + '</span></div>';
  }
  el.innerHTML = html;
}

function renderBtSafe(ctrl, health, sb) {
  const el = document.getElementById("bt-safe");
  if (!el) return;
  const cap = Number(sb?.capPct ?? ctrl?.maxDailyLossPct ?? 3);
  const remainingSoft = Number(sb?.remainingSoftPct ?? cap);
  const lastRunAge = health?.lastRunAge;
  const krakenLatency = health?.krakenLatency;
  const krakenOk = health?.krakenOk !== false;
  const consec = ctrl?.consecutiveLosses ?? 0;
  let verdictText = "✅ SAFE — clear to keep running";
  let verdictColor = "var(--green)";
  if (ctrl?.killed) {
    verdictText = "🚨 HALTED — kill switch active. Reset before continuing.";
    verdictColor = "var(--red)";
  } else if (ctrl?.stopped) {
    verdictText = "🚨 STOPPED — bot is not running.";
    verdictColor = "var(--red)";
  } else if (lastRunAge != null && lastRunAge > 15) {
    verdictText = "🚨 STALE — no bot cycle in over 15 minutes.";
    verdictColor = "var(--red)";
  } else if (remainingSoft <= 0) {
    verdictText = "🚨 NO BUFFER — daily-loss cap exhausted.";
    verdictColor = "var(--red)";
  } else if (
    (lastRunAge != null && lastRunAge > 10) ||
    (krakenLatency != null && krakenLatency > 1000) ||
    !krakenOk ||
    remainingSoft < cap * 0.5 ||
    consec > 0
  ) {
    verdictText = "⚠ DEGRADED — keep an eye on it.";
    verdictColor = "var(--yellow)";
  }
  const ws = health?.websocket || "—";
  const lat = krakenLatency != null ? krakenLatency + "ms" : "—";
  const age = lastRunAge != null ? Math.round(lastRunAge) + "m" : "—";
  el.innerHTML =
    '<div class="bt-verdict" style="color:' + verdictColor + '">' + btEsc(verdictText) + '</div>' +
    '<div class="card-row"><span class="card-row-label">Kraken latency</span><span class="card-row-val">' + lat + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">WebSocket</span><span class="card-row-val">' + btEsc(ws) + '</span></div>' +
    '<div class="card-row"><span class="card-row-label">Last bot cycle</span><span class="card-row-val">' + age + ' ago</span></div>' +
    '<div class="card-row"><span class="card-row-label">Buffer remaining</span><span class="card-row-val">' + remainingSoft.toFixed(2) + '% / ' + cap + '%</span></div>' +
    '<div class="card-row"><span class="card-row-label">Consecutive losses</span><span class="card-row-val">' + consec + '</span></div>';
}

// Phase D-1-e-1 — Performance tab. Read-only KPI tiles only (Today's P&L,
// Win Rate, Profit Factor, All-time P&L, Realized Drawdown). Reads
// /api/paper-summary or /api/live-summary — both already shipped, both
// mode-scoped. Profit Factor + Realized Drawdown computed client-side from
// the recentTrades EXIT entries. Never reads perfState.* (mode-blind).
// State (_perfMode, _perfCache) is hoisted above activateTab — see top of
// this script — so the initial activateTab("performance") on hash-load
// can call initPerfModeIfNeeded without hitting the TDZ.

function pfFmtMoney(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "−";
  return sign + "$" + Math.abs(n).toFixed(2);
}
function pfClassFor(n) {
  if (n == null || !Number.isFinite(n)) return "kpi-val";
  if (n > 0) return "kpi-val kpi-good";
  if (n < 0) return "kpi-val kpi-bad";
  return "kpi-val";
}

function pfComputeProfitFactor(exits) {
  if (!Array.isArray(exits) || exits.length === 0) {
    return { label: "—", subLabel: "no recent EXITs in displayed window" };
  }
  let gp = 0, gl = 0, count = 0;
  for (const e of exits) {
    if (e.orderPlaced !== true) continue;
    const pnl = parseFloat(e.pnlUSD);
    if (!Number.isFinite(pnl)) continue;
    count++;
    if (pnl > 0) gp += pnl;
    else if (pnl < 0) gl += -pnl;
  }
  if (count === 0) return { label: "—", subLabel: "no recent EXITs in displayed window" };
  if (gl === 0) {
    if (gp === 0) return { label: "—", subLabel: "no realized P&L yet" };
    return { label: "∞", subLabel: "no losing exits" };
  }
  const ratio = gp / gl;
  return { label: ratio.toFixed(2), subLabel: "$ made per $ lost" };
}

function pfComputeRealizedDrawdown(chronoExits) {
  if (!Array.isArray(chronoExits) || chronoExits.length < 5) {
    return { label: "—", subLabel: "needs more closed trades" };
  }
  let cum = 0, peak = 0, maxDD = 0, count = 0;
  for (const e of chronoExits) {
    if (e.orderPlaced !== true) continue;
    const pnl = parseFloat(e.pnlUSD);
    if (!Number.isFinite(pnl)) continue;
    cum += pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
    count++;
  }
  if (count < 5) return { label: "—", subLabel: "needs more closed trades" };
  return { label: "$" + maxDD.toFixed(2), subLabel: "peak-to-trough · last " + count + " exits" };
}

async function pfFetch(mode) {
  if (mode !== "paper" && mode !== "live") return;
  try {
    const r = await fetch("/api/" + mode + "-summary", { credentials: "same-origin" });
    // Phase D-2-paper-json-fix-a — same non-JSON guard as /paper's loadSummary.
    // On session expiry the auth gate redirects to /login (HTML); without this
    // guard, r.json() would throw and pollute the console with "Unexpected
    // token '<'..." every poll tick. Silent return preserves the existing
    // "keep prior cache" behavior for the Performance tab.
    const ct = r.headers.get("content-type") || "";
    const looksLikeLogin =
      r.redirected ||
      /\\/login(\\?|$)/.test(r.url || "") ||
      !ct.includes("application/json");
    if (looksLikeLogin) return;
    if (!r.ok) return;
    const j = await r.json();
    _perfCache[mode] = j?.data ?? j;
    if (_perfMode === mode) renderPerformance();
  } catch (e) { /* keep prior cache */ }
}

function renderPerformanceLoading() {
  for (const id of ["pf-today","pf-winrate","pf-profitfactor","pf-alltime","pf-drawdown"]) {
    const el = document.getElementById(id);
    if (el) { el.textContent = "…"; el.className = "kpi-val"; }
  }
  const tbody = document.getElementById("pf-trades-body");
  if (tbody) tbody.innerHTML = '<div class="card-empty">Loading…</div>';
  // Phase D-1-e-3 — only show "Loading…" if we don't already have parseable
  // cycle data cached. The conditions card is mode-blind, so a segment
  // switch shouldn't flicker it back to a loading state.
  const cbody = document.getElementById("pf-conditions-body");
  if (cbody && !_recentDecisionLogs) cbody.innerHTML = '<div class="card-empty">Loading…</div>';
  // Phase D-1-e-4 — same anti-flicker rule for the V2 Shadow card.
  const v2body = document.getElementById("pf-v2-body");
  if (v2body && !_recentStrategyV2) v2body.innerHTML = '<div class="card-empty">Loading…</div>';
}

// Phase D-1-e-3 — Condition Pass Rates + 10-cycle heatmap. Cycle-level,
// mode-blind. Uses the existing btParseDecisionLog parser; if fewer than 5
// cycles are parseable, shows the "need at least 5" empty state instead of
// rendering a misleading partial chart.
const PF_COND_KEYS = ["ema trend", "rsi dip", "vwap support", "not extended"];
const PF_COND_LABELS = {
  "ema trend":     "EMA trend",
  "rsi dip":       "RSI dip",
  "vwap support":  "VWAP support",
  "not extended":  "Not extended",
};
function pfNormCondName(name) {
  if (!name) return null;
  const k = String(name).toLowerCase().trim();
  return PF_COND_KEYS.includes(k) ? k : null;
}
function renderPerfConditions() {
  const body = document.getElementById("pf-conditions-body");
  if (!body) return;
  const logs = Array.isArray(_recentDecisionLogs) ? _recentDecisionLogs : [];
  if (logs.length === 0) {
    body.innerHTML = '<div class="card-empty">Need at least 5 cycles with decision data.</div>';
    return;
  }
  const parsed = logs.map(l => {
    let p = null;
    try { p = btParseDecisionLog(l && l.decisionLog); } catch { p = { parseFailed: true, raw: "" }; }
    return { ts: l && l.timestamp, parsed: p };
  });
  const parseable = parsed.filter(x =>
    x.parsed && !x.parsed.parseFailed && Array.isArray(x.parsed.conditions) && x.parsed.conditions.length > 0);
  if (parseable.length < 5) {
    body.innerHTML = '<div class="card-empty">Need at least 5 cycles with decision data.</div>';
    return;
  }
  const window15 = parseable.slice(0, 15);
  const passCounts = { "ema trend": 0, "rsi dip": 0, "vwap support": 0, "not extended": 0 };
  for (const x of window15) {
    for (const c of x.parsed.conditions) {
      const k = pfNormCondName(c.name);
      if (k && Number(c.points) > 0) passCounts[k]++;
    }
  }
  const denom = window15.length;
  let html = '<div class="perf-cond-list">';
  for (const k of PF_COND_KEYS) {
    const passed = passCounts[k];
    const pct = denom > 0 ? (passed / denom * 100) : 0;
    html += '<div class="perf-cond-row">' +
              '<div class="perf-cond-label">' + btEsc(PF_COND_LABELS[k]) + '</div>' +
              '<div class="perf-cond-bar"><div class="perf-cond-bar-fill" style="width:' + pct.toFixed(0) + '%"></div></div>' +
              '<div class="perf-cond-count">Passed in ' + passed + ' of last ' + denom + ' cycles</div>' +
            '</div>';
  }
  html += '</div>';
  // 10-cycle heatmap, newest first, dot per condition.
  const window10 = parseable.slice(0, 10);
  html += '<div class="perf-heatmap">' +
            '<div class="perf-heatmap-header">' +
              '<div></div>' +
              PF_COND_KEYS.map(k => '<div class="perf-heatmap-col">' + btEsc(PF_COND_LABELS[k]) + '</div>').join('') +
            '</div>';
  for (const x of window10) {
    const passByKey = {};
    for (const c of x.parsed.conditions) {
      const k = pfNormCondName(c.name);
      if (k) passByKey[k] = Number(c.points) > 0;
    }
    html += '<div class="perf-heatmap-row">' +
              '<div class="perf-heatmap-time">' + btEsc(timeAgo(x.ts)) + '</div>';
    for (const k of PF_COND_KEYS) {
      const has = Object.prototype.hasOwnProperty.call(passByKey, k);
      const cls = !has ? "na" : (passByKey[k] ? "pass" : "fail");
      const tip = !has
        ? PF_COND_LABELS[k] + " — not evaluated"
        : (passByKey[k] ? PF_COND_LABELS[k] + " — passed" : PF_COND_LABELS[k] + " — failed");
      html += '<div><span class="perf-heatmap-dot ' + cls + '" title="' + btEsc(tip) + '"></span></div>';
    }
    html += '</div>';
  }
  html += '</div>';
  body.innerHTML = html;
}

// Phase D-1-e-2 — Recent Trades table. Pure render: reads exits straight
// out of the mode-segment cache (already filtered by /api/paper-summary or
// /api/live-summary on the server). Top 20 EXITs with orderPlaced=true,
// newest first. Empty state mirrors the Profit Factor wording so the two
// stay consistent when the 30-row recentTrades window has no exits.
function renderPerfTrades() {
  const body = document.getElementById("pf-trades-body");
  if (!body) return;
  const data = _perfCache[_perfMode];
  if (!data) { body.innerHTML = '<div class="card-empty">Loading…</div>'; return; }
  const exits = (data.recentTrades || []).filter(t =>
    t && t.type === "EXIT" && t.orderPlaced === true);
  if (exits.length === 0) {
    const modeLabel = _perfMode === "live" ? "Live" : "Paper";
    // Phase D-4-P-e — the previous "No closed trades in the last 30 cycles"
    // wording read as "trades disappeared." With D-4-P-a's trade-event
    // window, an empty list here means no closed trade events have been
    // recorded yet in the windowed range (full history is still on disk).
    body.innerHTML = '<div class="card-empty">No ' + modeLabel.toLowerCase() + ' trades in this displayed window. Full ' + modeLabel.toLowerCase() + ' history is still stored in the bot log.</div>';
    return;
  }
  const top = exits.slice(0, 20);  // recentTrades is already newest-first
  let html = '<table class="perf-trades-table"><thead><tr>' +
    '<th class="col-time">Time</th>' +
    '<th>Side</th>' +
    '<th>Entry</th>' +
    '<th>Exit</th>' +
    '<th class="col-pct">P&amp;L %</th>' +
    '<th class="col-usd">P&amp;L $</th>' +
    '<th class="col-reason">Exit Reason</th>' +
    '</tr></thead><tbody>';
  for (const e of top) {
    const pct = parseFloat(e.pct);
    const usd = parseFloat(e.pnlUSD);
    const entry = parseFloat(e.entryPrice);
    const exit  = parseFloat(e.price);
    const pctClass = Number.isFinite(pct) ? (pct >= 0 ? "pnl-good" : "pnl-bad") : "";
    const usdClass = Number.isFinite(usd) ? (usd >= 0 ? "pnl-good" : "pnl-bad") : "";
    const pctStr = Number.isFinite(pct) ? (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%" : "—";
    const usdStr = Number.isFinite(usd) ? (usd >= 0 ? "+$" : "−$") + Math.abs(usd).toFixed(2) : "—";
    const entryStr = Number.isFinite(entry) ? "$" + entry.toFixed(4) : "—";
    const exitStr  = Number.isFinite(exit)  ? "$" + exit.toFixed(4)  : "—";
    html += '<tr>' +
      '<td class="col-time">' + btEsc(timeAgo(e.timestamp)) + '</td>' +
      '<td>Long</td>' +
      '<td>' + entryStr + '</td>' +
      '<td>' + exitStr + '</td>' +
      '<td class="col-pct ' + pctClass + '">' + pctStr + '</td>' +
      '<td class="col-usd ' + usdClass + '">' + usdStr + '</td>' +
      '<td class="col-reason">' + btEsc(e.exitReason || "—") + '</td>' +
      '</tr>';
  }
  html += '</tbody></table>';
  body.innerHTML = html;
}

// Phase D-1-f-1 — Advanced tab Raw Decision Log. Pure render: takes the
// already-cached _recentDecisionLogs (max 30 entries from /api/v2/dashboard),
// classifies each verdict for color, and emits a scrollable monospace list.
// All dynamic text escaped. Never modifies bot state.
function advRawlogVerdictClass(v) {
  if (!v) return "unknown";
  const s = String(v).toUpperCase();
  if (s.includes("EXIT")) return "exit";
  if (s.includes("TRADE")) return "trade";
  if (s.includes("SKIP") || s.includes("LIMIT") || s.includes("KILL") || s.includes("STOP")) return "skip";
  return "unknown";
}
function renderAdvancedRawLog() {
  const body = document.getElementById("adv-rawlog-body");
  if (!body) return;
  const arr = Array.isArray(_recentDecisionLogs) ? _recentDecisionLogs : [];
  if (arr.length === 0) {
    body.innerHTML = '<div class="card-empty">No recent decision logs available.</div>';
    return;
  }
  let rows = '';
  for (const e of arr) {
    const t = e && e.timestamp ? timeAgo(e.timestamp) : "—";
    const raw = e && typeof e.decisionLog === "string" ? e.decisionLog : "";
    let verdict = "";
    if (raw) {
      try {
        const p = btParseDecisionLog(raw);
        if (p && !p.parseFailed && p.verdict) verdict = p.verdict;
      } catch { /* unparseable → blank verdict + unknown class */ }
    }
    const cls = advRawlogVerdictClass(verdict);
    rows += '<div class="adv-rawlog-row">' +
              '<div class="adv-rawlog-time">' + btEsc(t) + '</div>' +
              '<div><span class="adv-rawlog-verdict ' + cls + '">' + btEsc(verdict || "—") + '</span></div>' +
              '<div class="adv-rawlog-text">' + btEsc(raw || "—") + '</div>' +
            '</div>';
  }
  body.innerHTML = '<div class="adv-rawlog-list">' + rows + '</div>';
}

// Phase D-1-f-2 — Advanced tab Recent Bot Activity timeline. Pure render.
// Classifies each cycle into TRADED / EXITED / SKIPPED / LIMIT / HALTED
// from the projected fields server-side, then formats a plain-English
// summary. All dynamic text escaped via btEsc. Read-only.
function pfFmtPriceShort(p) {
  const n = parseFloat(p);
  if (!Number.isFinite(n)) return "—";
  return "$" + (n < 10 ? n.toFixed(4) : n.toFixed(2));
}
function renderAdvancedActivity() {
  const body = document.getElementById("adv-activity-body");
  if (!body) return;
  const arr = Array.isArray(_recentActivity) ? _recentActivity : [];
  if (arr.length === 0) {
    body.innerHTML = '<div class="card-empty">No recent bot activity available.</div>';
    return;
  }
  let rows = '';
  for (const e of arr) {
    const ts = e && e.timestamp;
    const type = e && e.type;
    const allPass = e && e.allPass === true;
    const decisionLog = (e && typeof e.decisionLog === "string") ? e.decisionLog : "";
    const exitReason = e && e.exitReason ? String(e.exitReason) : "";
    const isPaper = !(e && e.paperTrading === false);
    const upperLog = decisionLog.toUpperCase();

    let action = "UNKNOWN", actionClass = "unknown", summary = "", showMode = false;

    if (type === "EXIT") {
      action = "EXITED"; actionClass = "exit"; showMode = true;
      const pct = parseFloat(e && e.pct);
      const pctStr = Number.isFinite(pct) ? (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%" : "—";
      summary = "Exited at " + pfFmtPriceShort(e && e.price) + (exitReason ? " · " + exitReason : "") + " · " + pctStr;
    } else if (upperLog.includes("DAILY LIMIT")) {
      action = "LIMIT"; actionClass = "limit";
      summary = "Daily limit reached";
    } else if (upperLog.includes("KILL") || upperLog.includes("HALT") || upperLog.includes("STOPPED")) {
      action = "HALTED"; actionClass = "halt";
      summary = "Bot halted";
    } else if (allPass === true || type === "MANUAL_BUY") {
      action = "TRADED"; actionClass = "trade"; showMode = true;
      summary = "Bought at " + pfFmtPriceShort(e && e.price);
    } else {
      action = "SKIPPED"; actionClass = "skip";
      try {
        const p = btParseDecisionLog(decisionLog);
        if (p && !p.parseFailed) {
          if (p.total != null && p.threshold != null) {
            summary = "Score " + p.total + "/" + p.threshold + " (needs " + p.threshold + ")";
            if (p.missing && p.missing.length) summary += " · missing " + p.missing[0];
          } else if (p.missing && p.missing.length) {
            summary = "Missing " + p.missing[0];
          } else {
            summary = "Conditions not met";
          }
        } else {
          summary = "Conditions not met";
        }
      } catch { summary = "Conditions not met"; }
    }

    const modeText = isPaper ? "PAPER" : "LIVE";
    const modeClass = isPaper ? "paper" : "live";

    rows += '<div class="adv-activity-row">' +
              '<div class="adv-activity-time">' + btEsc(timeAgo(ts)) + '</div>' +
              '<div class="adv-activity-action-col">' +
                '<span class="adv-activity-action ' + actionClass + '">' + btEsc(action) + '</span>' +
                (showMode ? '<span class="adv-activity-mode ' + modeClass + '">' + btEsc(modeText) + '</span>' : '') +
              '</div>' +
              '<div class="adv-activity-summary">' + btEsc(summary) + '</div>' +
            '</div>';
  }
  body.innerHTML = '<div class="adv-activity-list">' + rows + '</div>';
}

// Phase D-1-f-3 — Advanced tab Active Strategies. Description-only.
// Reads _lastCtrl for V1 status + mode badges; V2 is hardcoded SHADOW.
// Wording is intentionally explicit — V2 must never look "active" or
// "tradeable" to an operator scanning this card.
function pfStrategyV1Status(ctrl) {
  if (!ctrl) return { label: "Unknown", cls: "stopped" };
  if (ctrl.killed)  return { label: "Killed",  cls: "killed"  };
  if (ctrl.stopped) return { label: "Stopped", cls: "stopped" };
  if (ctrl.paused)  return { label: "Paused",  cls: "paused"  };
  return { label: "Running", cls: "running" };
}
function renderAdvancedStrategies() {
  const body = document.getElementById("adv-strategies-body");
  if (!body) return;
  if (!_lastCtrl) {
    body.innerHTML = '<div class="card-empty">Strategy info unavailable — no control snapshot yet.</div>';
    return;
  }
  const v1Status = pfStrategyV1Status(_lastCtrl);
  const isPaper = _lastCtrl.paperTrading !== false;
  const v1ModeLabel = isPaper ? "Paper" : "Live";
  const v1ModeClass = isPaper ? "paper" : "live";

  const v1Tile =
    '<div class="strategy-tile">' +
      '<div class="strategy-tile-head">' +
        '<span class="strategy-tile-name">Strategy V1</span>' +
        '<span class="strategy-role primary">Primary</span>' +
        '<span class="strategy-status ' + v1Status.cls + '">' + btEsc(v1Status.label) + '</span>' +
        '<span class="strategy-mode ' + v1ModeClass + '">' + btEsc(v1ModeLabel) + '</span>' +
      '</div>' +
      '<div class="strategy-desc">Primary live bot strategy. Uses EMA trend, RSI dip, VWAP buyer support, and not-overextended scoring before allowing entries.</div>' +
    '</div>';

  const v2Tile =
    '<div class="strategy-tile">' +
      '<div class="strategy-tile-head">' +
        '<span class="strategy-tile-name">Strategy V2</span>' +
        '<span class="strategy-role shadow">Shadow</span>' +
        '<span class="strategy-status analyzing">Analyzing</span>' +
      '</div>' +
      '<div class="strategy-warning">Shadow only — does not place orders.</div>' +
      '<div class="strategy-desc">Prototype multi-timeframe strategy using 4H trend, 15M liquidity sweep, and 5M BOS/pullback checks.</div>' +
      '<div class="strategy-note">Short setups remain deferred until shorting/margin support is safely confirmed.</div>' +
    '</div>';

  body.innerHTML = '<div class="adv-strategies-grid">' + v1Tile + v2Tile + '</div>';
}

// Phase D-1-e-4 — Strategy V2 Shadow Analysis. Cycle-level (mode-blind),
// read-only. Three sub-sections inside the collapsed card body: V2 verdict
// frequency, latest V2 verdict + skip reason, and a V1-vs-V2 outcome
// breakdown (entry-decision cycles only). Wording is intentionally neutral
// — never frames disagreements as "missed trades" and never claims V2 is
// better/worse than V1.
function renderPerfV2Shadow() {
  const body = document.getElementById("pf-v2-body");
  if (!body) return;
  const arr = Array.isArray(_recentStrategyV2) ? _recentStrategyV2 : [];
  const withV2 = arr.filter(x => x && x.strategyV2 && typeof x.strategyV2 === "object");
  if (withV2.length < 5) {
    body.innerHTML = '<div class="card-empty">Need at least 5 V2 shadow cycles.</div>';
    return;
  }
  const counts = { TRADE: 0, NO_TRADE: 0, NO_TRADE_SHORT_DEFERRED: 0, OTHER: 0 };
  for (const x of withV2) {
    const d = x.strategyV2.decision;
    if (d === "TRADE" || d === "NO_TRADE" || d === "NO_TRADE_SHORT_DEFERRED") counts[d]++;
    else counts.OTHER++;
  }
  const total = withV2.length;
  const latest = withV2[0];
  const latestDecision = String(latest.strategyV2.decision || "—");
  const latestReason = latest.strategyV2.skipReason || "—";
  const latestTime = timeAgo(latest.timestamp);
  // V1 vs V2 outcome — only over entry-decision cycles (skip EXIT rows so
  // a manual close doesn't get counted as a "V1 skipped" decision).
  const entryCycles = withV2.filter(x => x.type !== "EXIT");
  let bothTrade = 0, bothSkip = 0, different = 0;
  for (const x of entryCycles) {
    const v1Trade = x.allPass === true;
    const v2Trade = x.strategyV2.decision === "TRADE";
    if (v1Trade && v2Trade) bothTrade++;
    else if (!v1Trade && !v2Trade) bothSkip++;
    else different++;
  }
  const totalEntry = entryCycles.length;
  const fmt  = (n) => total > 0      ? n + ' (' + Math.round(n / total * 100) + '%)'      : '0';
  const fmtE = (n) => totalEntry > 0 ? n + ' (' + Math.round(n / totalEntry * 100) + '%)' : '0';
  let html = '';
  html += '<div class="perf-v2-section">' +
            '<div class="perf-v2-section-title">V2 verdict frequency — last ' + total + ' shadow cycles</div>' +
            '<div class="perf-v2-grid">' +
              '<div class="perf-v2-stat"><div class="perf-v2-stat-label">TRADE</div><div class="perf-v2-stat-val">' + fmt(counts.TRADE) + '</div></div>' +
              '<div class="perf-v2-stat"><div class="perf-v2-stat-label">NO_TRADE</div><div class="perf-v2-stat-val">' + fmt(counts.NO_TRADE) + '</div></div>' +
              '<div class="perf-v2-stat"><div class="perf-v2-stat-label">NO_TRADE_SHORT_DEFERRED</div><div class="perf-v2-stat-val">' + fmt(counts.NO_TRADE_SHORT_DEFERRED) + '</div></div>' +
              '<div class="perf-v2-stat"><div class="perf-v2-stat-label">Other</div><div class="perf-v2-stat-val">' + fmt(counts.OTHER) + '</div></div>' +
            '</div>' +
          '</div>';
  html += '<div class="perf-v2-section">' +
            '<div class="perf-v2-section-title">Latest V2 verdict</div>' +
            '<div class="card-row"><span class="card-row-label">When</span><span class="card-row-val">' + btEsc(latestTime) + '</span></div>' +
            '<div class="card-row"><span class="card-row-label">Verdict</span><span class="card-row-val">' + btEsc(latestDecision) + ' (shadow)</span></div>' +
            '<div class="card-row"><span class="card-row-label">Reason</span><span class="card-row-val" style="font-size:11px;text-align:right;max-width:60%">' + btEsc(latestReason) + '</span></div>' +
          '</div>';
  html += '<div class="perf-v2-section">';
  if (totalEntry === 0) {
    html += '<div class="perf-v2-section-title">V1 vs V2 outcome</div>' +
            '<div class="card-empty">No V1 entry-decision cycles in the last window.</div>';
  } else {
    html += '<div class="perf-v2-section-title">V1 vs V2 outcome — last ' + totalEntry + ' entry-decision cycles</div>' +
            '<div class="perf-v2-grid">' +
              '<div class="perf-v2-stat"><div class="perf-v2-stat-label">Both would trade</div><div class="perf-v2-stat-val">' + fmtE(bothTrade) + '</div></div>' +
              '<div class="perf-v2-stat"><div class="perf-v2-stat-label">Both would skip</div><div class="perf-v2-stat-val">' + fmtE(bothSkip) + '</div></div>' +
              '<div class="perf-v2-stat"><div class="perf-v2-stat-label">Different outcome</div><div class="perf-v2-stat-val">' + fmtE(different) + '</div></div>' +
            '</div>';
  }
  html += '</div>';
  body.innerHTML = html;
}

function renderPerformance() {
  const data = _perfCache[_perfMode];
  if (!data) return renderPerformanceLoading();

  // Today's P&L (mode-scoped, server-computed)
  const todayUsd = Number.isFinite(data?.pnl?.todayUsd) ? data.pnl.todayUsd : 0;
  const todayEl = document.getElementById("pf-today");
  if (todayEl) {
    todayEl.textContent = pfFmtMoney(todayUsd);
    todayEl.className = pfClassFor(todayUsd);
  }

  // Win Rate (mode-scoped via modeScopedSummary's filter)
  const wl = data?.winLoss || {};
  const wlEl = document.getElementById("pf-winrate");
  const wlSub = document.getElementById("pf-winrate-sub");
  if (wl.total > 0 && Number.isFinite(wl.winRate)) {
    wlEl.textContent = wl.winRate.toFixed(0) + "%";
    wlEl.className = wl.winRate >= 50 ? "kpi-val kpi-good" : wl.winRate >= 30 ? "kpi-val kpi-warn" : "kpi-val kpi-bad";
    if (wlSub) wlSub.textContent = (wl.wins ?? 0) + "W / " + (wl.losses ?? 0) + "L · " + wl.total + " closed";
  } else {
    wlEl.textContent = "—";
    wlEl.className = "kpi-val";
    if (wlSub) wlSub.textContent = "no closed trades yet";
  }

  // Profit Factor (computed from mode-filtered EXIT entries)
  const exits = (data.recentTrades || []).filter(t => t && t.type === "EXIT");
  const pf = pfComputeProfitFactor(exits);
  const pfEl = document.getElementById("pf-profitfactor");
  const pfSub = document.getElementById("pf-profitfactor-sub");
  if (pfEl) {
    pfEl.textContent = pf.label;
    pfEl.className = "kpi-val" + (pf.label !== "—" && pf.label !== "∞" && parseFloat(pf.label) >= 1.5 ? " kpi-good" : pf.label === "∞" ? " kpi-good" : "");
  }
  if (pfSub) pfSub.textContent = pf.subLabel;

  // All-time P&L (mode-scoped)
  const totalUsd = Number.isFinite(data?.pnl?.totalUsd) ? data.pnl.totalUsd : 0;
  const allEl = document.getElementById("pf-alltime");
  if (allEl) {
    allEl.textContent = pfFmtMoney(totalUsd);
    allEl.className = pfClassFor(totalUsd);
  }

  // Realized Drawdown (computed peak-to-trough from chronologically-ordered EXIT entries)
  // recentTrades is newest-first; reverse for chronological cumulative-equity walk.
  const chronoExits = exits.slice().reverse();
  const dd = pfComputeRealizedDrawdown(chronoExits);
  const ddEl = document.getElementById("pf-drawdown");
  const ddSub = document.getElementById("pf-drawdown-sub");
  if (ddEl) {
    ddEl.textContent = dd.label;
    ddEl.className = dd.label === "—" ? "kpi-val" : "kpi-val kpi-warn";
  }
  if (ddSub) ddSub.textContent = dd.subLabel;

  // Phase D-1-e-2 — Recent Trades table for the selected mode.
  renderPerfTrades();

  // Phase D-1-e-3 — Condition Pass Rates card. Mode-blind (cycle-level), so
  // the segment switch redraws the same data — no flicker, no mode mixing.
  renderPerfConditions();

  // Phase D-1-e-4 — Strategy V2 Shadow Analysis card. Mode-blind, collapsed
  // by default. Re-render is harmless (the <details> open state is preserved
  // by the browser; we only swap the inner body).
  renderPerfV2Shadow();
}

function setPerfMode(mode) {
  if (mode !== "paper" && mode !== "live") return;
  _perfMode = mode;
  document.querySelectorAll(".perf-seg").forEach(b =>
    b.classList.toggle("active", b.dataset.perfMode === mode));
  if (_perfCache[mode]) renderPerformance(); else renderPerformanceLoading();
  pfFetch(mode);
}

function initPerfModeIfNeeded() {
  if (_perfMode != null) return;
  // Default to current bot mode (paper unless explicitly live).
  const startingMode = (_lastCtrl?.paperTrading === false) ? "live" : "paper";
  setPerfMode(startingMode);
}

function refreshPerfIfActive() {
  // Phase D-2-g — recognize both the v2 .tab.active selector (used on
  // /dashboard-v2) and the combined dashboard's .dc-tab.dc-tab-active
  // selector (used on /dashboard). On /dashboard-v2 only the first
  // selector matches; behavior is unchanged. On /dashboard only the
  // second matches. Without this, the Performance KPI tiles never poll
  // /api/{paper,live}-summary on /dashboard and stay stuck on "Loading…".
  const v2Active = document.querySelector(".tab.active")?.dataset?.tab;
  const dcActive = document.querySelector(".dc-tab.dc-tab-active")?.dataset?.dcTab;
  if (v2Active !== "performance" && dcActive !== "performance") return;
  initPerfModeIfNeeded();
  pfFetch(_perfMode);
}

// Wire segmented-tab clicks once on script load.
document.querySelectorAll(".perf-seg").forEach(b =>
  b.addEventListener("click", () => setPerfMode(b.dataset.perfMode)));

function renderBotThinking(d) {
  const ctrl = d?.control || {};
  const health = d?.health || {};
  const latest = d?.latest;
  const sb = d?.safetyBuffer || {};
  const parsed = latest ? btParseDecisionLog(latest.decisionLog) : null;
  renderBtRightNow(ctrl, latest, parsed);
  renderBtWhy(latest, parsed);
  renderBtWaiting(latest, parsed);
  renderBtRisk(ctrl, sb);
  renderBtV2(latest);
  renderBtSafe(ctrl, health, sb);
}

function applyData({ control, health, summary, latest, position, safetyBuffer, recentDecisionLogs, recentStrategyV2, recentActivity }) {
  if (control) _lastCtrl = control;
  if (control)  renderStrip(control, health, latest);
  if (control || health || latest)  renderKpis(control || {}, health, position, latest, summary, safetyBuffer);
  renderPosition(position, latest);
  renderDecision(latest);
  if (health)   renderHealth(health);
  renderV2(latest);
  // Phase D-1-b — Bot Thinking tab. Read-only, derived from the same payload.
  renderBotThinking({ control, health, summary, latest, position, safetyBuffer });

  // Phase D-1-e-3 — refresh cycle-level conditions cache + render. Card lives
  // on the Performance tab, but we redraw on every tick regardless of which
  // tab is active so it's already up-to-date when the operator switches in.
  if (Array.isArray(recentDecisionLogs)) _recentDecisionLogs = recentDecisionLogs;
  renderPerfConditions();
  // Phase D-1-f-1 — Advanced tab Raw Decision Log. Same source array as
  // the conditions card; rendered on every tick so the Advanced tab is
  // up-to-date when the operator switches into it.
  renderAdvancedRawLog();

  // Phase D-1-f-2 — Advanced tab Recent Bot Activity timeline. Mode-blind,
  // read-only. Cache update + render every tick.
  if (Array.isArray(recentActivity)) _recentActivity = recentActivity;
  renderAdvancedActivity();

  // Phase D-1-f-3 — Advanced tab Active Strategies. Description-only.
  // Re-renders cheaply each tick so V1 status + mode badges stay current.
  renderAdvancedStrategies();

  // Phase D-1-e-4 — same lifecycle for the V2 Shadow card. Cache update
  // and render every tick; visible only when the operator expands it.
  if (Array.isArray(recentStrategyV2)) _recentStrategyV2 = recentStrategyV2;
  renderPerfV2Shadow();

  // Stale banner — turn on if last cycle > 60s
  const banner = document.getElementById("stale-banner");
  if (latest?.timestamp) {
    const ageSec = (Date.now() - new Date(latest.timestamp).getTime()) / 1000;
    if (ageSec > 600) { banner.className = "stale-banner critical on"; banner.textContent = "⚠ No bot cycle in over " + Math.round(ageSec/60) + " minutes — check Bot Health Summary."; }
    else if (ageSec > 60) { banner.className = "stale-banner on"; banner.textContent = "Last bot cycle " + Math.round(ageSec/60) + " min ago — fresher data should arrive within 5 min."; }
    else { banner.className = "stale-banner"; }
  }
  _lastTickAt = Date.now();
}

// Initial render from inline data (same shape as /api/v2/dashboard).
const init = window.__INIT__;
if (init && !init.error) {
  applyData({
    control:      init.control,
    health:       init.health,
    summary:      init.summary,
    latest:       init.latest,
    position:     init.position,
    safetyBuffer: init.safetyBuffer,
    recentDecisionLogs: init.recentDecisionLogs,
    recentStrategyV2:   init.recentStrategyV2,
    recentActivity:     init.recentActivity,
  });
}

// Phase C-1 — confirm modal, toast, button-lock, and POST helper for the
// lifecycle controls. Only Pause/Resume/Start/Stop are wired this round;
// Switch to Live, Reset Kill Switch, and KILL NOW remain :disabled with
// PREVIEW badges and are wired in C-2/C-3.
function v2ShowConfirm(opts) {
  return new Promise(resolve => {
    const o   = document.getElementById("v2-modal-overlay");
    const ttl = document.getElementById("v2-modal-title");
    const msg = document.getElementById("v2-modal-msg");
    const inp = document.getElementById("v2-modal-input");
    const cnf = document.getElementById("v2-modal-confirm");
    const cnl = document.getElementById("v2-modal-cancel");
    ttl.textContent = opts.title || "Confirm action";
    msg.innerHTML   = opts.msg   || "";
    cnf.textContent = opts.confirmText || "Confirm";
    cnf.className   = "v2-modal-btn v2-modal-btn-confirm" + (opts.danger ? " danger" : "");
    if (opts.requireText) {
      inp.classList.add("show");
      inp.value = "";
      inp.placeholder = 'Type "' + opts.requireText + '"';
      cnf.disabled = true;
      inp.oninput = () => { cnf.disabled = inp.value.trim() !== opts.requireText; };
      setTimeout(() => inp.focus(), 80);
    } else {
      inp.classList.remove("show");
      cnf.disabled = false;
    }
    const close = (val) => {
      o.classList.remove("open");
      inp.oninput = null;
      cnf.onclick = null; cnl.onclick = null;
      resolve(val);
    };
    cnf.onclick = () => close(true);
    cnl.onclick = () => close(false);
    o.classList.add("open");
  });
}

function v2Toast(msg, type) {
  const c = document.getElementById("v2-toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className = "v2-toast" + (type ? " " + type : "");
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function v2LockBtn(btn) {
  if (!btn || btn.disabled) return () => {};
  btn.disabled = true;
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span>' + original;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    btn.disabled = false;
    btn.innerHTML = original;
  };
}

// POST to /api/control with optional confirm token. /api/control already
// enforces the Phase 3 + C-0 typed-confirm gates server-side, so v2 cannot
// bypass them by omitting the token — the server will simply return 403.
async function v2SendCmd(command, btn, confirm) {
  const release = v2LockBtn(btn);
  try {
    const body = { command };
    if (confirm) body.confirm = confirm;
    const r = await fetch("/api/control", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok !== false) {
      v2Toast(commandSuccessText(command), "success");
      refresh();
    } else {
      v2Toast("Failed: " + (j.error || ("HTTP " + r.status)), "error");
    }
  } catch (e) {
    v2Toast("Error: " + e.message, "error");
  } finally { release(); }
}

function commandSuccessText(command) {
  switch (command) {
    case "PAUSE_TRADING":   return "⏸ Trading paused";
    case "RESUME_TRADING":  return "▶ Trading resumed";
    case "START_BOT":       return "✅ Bot started";
    case "STOP_BOT":        return "⛔ Bot stopped";
    default:                return "✓ " + command + " applied";
  }
}

// Pause/Resume: instant; safety-up actions; no modal (avoids confirmation fatigue).
function pauseBot(e)  { v2SendCmd("PAUSE_TRADING",  e?.currentTarget); }
function resumeBot(e) { v2SendCmd("RESUME_TRADING", e?.currentTarget); }

// Start/Stop: simple confirm (no typed text). Stop carries the live-position
// warning copy verbatim from the Phase C-1 spec.
async function confirmStartBot(e) {
  const btn = e?.currentTarget;
  const ok = await v2ShowConfirm({
    title: "Start the bot?",
    msg: "The bot will resume looking for entry signals on its next cycle.",
    confirmText: "Start Bot",
  });
  if (!ok) return;
  v2SendCmd("START_BOT", btn);
}
async function confirmStopBot(e) {
  const btn = e?.currentTarget;
  const ok = await v2ShowConfirm({
    title: "Stop the bot?",
    msg: '<strong style="color:var(--yellow)">Trading halted. Open positions will NOT be closed by the bot. You must manage them manually via the exchange until the bot is restarted to resume auto-exit logic.</strong>',
    confirmText: "Stop Bot",
    danger: true,
  });
  if (!ok) return;
  v2SendCmd("STOP_BOT", btn);
}

// Phase C-3 — Reset Kill Switch. Paper mode: simple confirm. Live mode:
// typed-CONFIRM (the Phase 3 server gate at /api/control already requires
// { confirm: "CONFIRM" } when paperTrading=false, so the typed token cannot
// be bypassed by a stray authenticated POST).
async function confirmResetKill(e) {
  const btn = e?.currentTarget;
  const isPaper = (_lastCtrl?.paperTrading !== false);
  const ok = await v2ShowConfirm({
    title: isPaper ? "Reset kill switch?" : "🔓 Reset LIVE kill switch?",
    msg: isPaper
      ? "This re-enables trading after a forced halt. The bot can resume placing trades on its next cycle."
      : '<strong style="color:var(--red)">This re-enables LIVE trading.</strong><br><br>The bot can resume placing real-money orders on its next cycle.<br><br>Type <strong>CONFIRM</strong> to proceed.',
    confirmText: "Reset Kill Switch",
    requireText: isPaper ? null : "CONFIRM",
    danger: !isPaper,
  });
  if (!ok) return;
  v2SendCmd("RESET_KILL_SWITCH", btn, isPaper ? undefined : "CONFIRM");
}

// Phase C-2 — typed-KILL emergency override. The Phase C-0 server gate at
// /api/control rejects any KILL_NOW POST without { confirm: "KILL" }, so
// even an authenticated session cannot bypass this confirmation.
async function confirmKillNow(e) {
  const btn = e?.currentTarget;
  const ok = await v2ShowConfirm({
    title: "🚨 Activate Kill Switch?",
    msg: '<strong style="color:var(--red)">This halts the bot immediately and disables trading.</strong><br><br>Open positions will NOT be auto-managed until you reset the kill switch from /dashboard.<br><br>Type <strong>KILL</strong> to confirm.',
    confirmText: "Activate Kill Switch",
    requireText: "KILL",
    danger: true,
  });
  if (!ok) return;
  v2SendCmd("KILL_NOW", btn, "KILL");
}

// Phase B — single read-only poll to /api/v2/dashboard (no POSTs).
async function refresh() {
  try {
    const r = await fetch("/api/v2/dashboard", { credentials: "same-origin" });
    if (!r.ok) return;
    const j = await r.json();
    const d = j?.data;
    if (!d) return;
    applyData({
      control:      d.control,
      health:       d.health,
      summary:      d.summary,
      latest:       d.latest,
      position:     d.position,
      safetyBuffer: d.safetyBuffer,
      recentDecisionLogs: d.recentDecisionLogs,
      recentStrategyV2:   d.recentStrategyV2,
      recentActivity:     d.recentActivity,
    });
  } catch (e) { /* keep prior values; next tick may succeed */ }
  // Phase D-1-e-1 — Performance tab refresh, only when active (avoids
  // hitting /api/live-summary's Kraken balance call every 5s when not
  // viewing Performance).
  refreshPerfIfActive();
}
refresh();
setInterval(refresh, 5000);
</script>

</body>
</html>`;
}

// ─── SSE Push ─────────────────────────────────────────────────────────────────

const sseClients = new Set();

function pushSSE(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
}

function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) { try { client.write(msg); } catch {} }
}

async function sseLoop() {
  if (sseClients.size > 0) {
    // Phase D-5.8 — getApiData is now async.
    try { broadcastSSE("data", await getApiData()); } catch {}
    try { broadcastSSE("balance", await fetchKrakenBalance()); } catch {}
  }
  setTimeout(sseLoop, 5000);
}
sseLoop();

// ─── Phase C-4-a — single-process mode/trade transition lock ─────────────────
// Try-acquire (non-blocking): if held, returns null and the caller responds
// 409 instead of queuing — avoids deadlock if a holder ever forgets to
// release. Used by SET_MODE_LIVE, SET_MODE_PAPER, /api/trade, /api/run-bot to
// reduce the race where a paper-mode trade body executes after mode flips
// but before its own gate sees the new state.
let _transitionLock = null;
function acquireTransitionLock(name) {
  if (_transitionLock) return null;
  _transitionLock = name;
  return () => { if (_transitionLock === name) _transitionLock = null; };
}
function transitionLockHolder() { return _transitionLock; }

// ─── Server ───────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // ── Login: GET serves page; POST is deprecated (routed to canonical) ──
  if (req.url === "/login") {
    if (req.method === "POST") {
      log.warn("/login", "deprecated POST /login — routing to /api/login");
      return processLogin(req, res);
    }
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store, must-revalidate",
    });
    res.end(loginPage());
    return;
  }

  // ── Canonical login endpoint ────────────────────────────────────────────
  if (req.url === "/api/login" && req.method === "POST") {
    return processLogin(req, res);
  }

  // ── Forgot password (real action — never confirms account existence) ────
  if (req.url === "/api/forgot-password" && req.method === "POST") {
    try {
      const ip = clientIp(req);
      if (rateLimited(forgotAttempts, ip)) {
        log.warn("/api/forgot-password", `rate-limited ${ip}`);
        res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "60" });
        res.end(JSON.stringify({ success: false, error: "Too many attempts. Please try again later." }));
        return;
      }
      const body = await readBody(req);
      let email = "";
      try { email = (JSON.parse(body).email || "").toString(); }
      catch { email = (new URLSearchParams(body).get("email") || ""); }
      const isAccount = !!email && email === (process.env.DASHBOARD_EMAIL || "");
      // Don't echo arbitrary email values into logs (avoids log injection from
      // attacker-supplied input). Log a non-PII fingerprint instead.
      const emailFp = email ? `len=${email.length}` : "empty";
      if (isAccount) {
        log.info("/api/forgot-password", `recovery request for known account (${emailFp})`);
      } else {
        log.warn("/api/forgot-password", `recovery request for unknown email (${emailFp})`);
      }
      // Same response either way — never leak whether the account exists
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        data: { message: "If that email exists, use your backup phrase on the 2FA screen to regain access." },
      }));
    } catch (e) {
      log.error("/api/forgot-password", e.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Server error." }));
    }
    return;
  }

  if (req.url === "/logout") {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.session)     sessions.delete(cookies.session);
    if (cookies.pending_2fa) pendingSessions.delete(cookies.pending_2fa);
    persistSessions();
    res.writeHead(302, {
      "Set-Cookie": [
        "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" + COOKIE_SECURE,
        "pending_2fa=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" + COOKIE_SECURE,
      ],
      Location: "/login",
    });
    res.end();
    return;
  }

  // ── 2FA ─────────────────────────────────────────────────────────────────────
  if (req.url === "/2fa") {
    const pending = parseCookies(req.headers.cookie).pending_2fa;
    if (!pending || !pendingSessions.has(pending)) {
      res.writeHead(302, { Location: "/login" });
      res.end();
      return;
    }
    if (req.method === "POST") {
      const ip = clientIp(req);
      if (rateLimited(twofaAttempts, ip)) {
        log.warn("/2fa", `rate-limited ${ip}`);
        res.writeHead(429, {
          "Content-Type": "text/html",
          "Retry-After": "60",
          "Cache-Control": "no-store, must-revalidate",
        });
        res.end(twoFaPage("Too many attempts. Please try again later."));
        return;
      }
      const body = await readBody(req);
      const params = new URLSearchParams(body);
      const code   = params.get("code")   || "";
      const backup = params.get("backup") || "";
      const totpOk   = code   && verifyTotp(process.env.DASHBOARD_TOTP_SECRET, code);
      const backupOk = !!backup && !!process.env.DASHBOARD_BACKUP_PHRASE && safeStringEqual(backup, process.env.DASHBOARD_BACKUP_PHRASE);
      if (totpOk || backupOk) {
        twofaAttempts.delete(ip); // success resets the counter
        persistRateLimits();
        pendingSessions.delete(pending);
        const token = generateToken();
        sessions.add(token);
        persistSessions();
        res.writeHead(302, {
          "Set-Cookie": [
            `session=${token}; HttpOnly; SameSite=Strict; Path=/${COOKIE_SECURE}`,
            `pending_2fa=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${COOKIE_SECURE}`,
          ],
          Location: "/",
        });
        res.end();
      } else {
        res.writeHead(401, { "Content-Type": "text/html" });
        res.end(twoFaPage(code ? "Invalid code — please try again." : "Invalid backup phrase."));
      }
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store, must-revalidate",
    });
    res.end(twoFaPage());
    return;
  }


  // ── PWA assets (no auth required) ────────────────────────────────────────
  if (req.url === "/manifest.json") {
    res.writeHead(200, { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" });
    res.end(JSON.stringify({
      name: "Agent Avila", short_name: "Avila",
      description: "Adaptive quant trading system",
      start_url: "/", display: "standalone", orientation: "portrait",
      background_color: "#0B0F1A", theme_color: "#0B0F1A",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ]
    }));
    return;
  }
  if (req.url === "/favicon.svg" || req.url === "/icon-192.png" || req.url === "/icon-512.png") {
    // Inline SVG icon — gradient lightning bolt on dark background
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
      + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00D4FF"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs>'
      + '<rect width="512" height="512" rx="96" fill="#0B0F1A"/>'
      + '<path d="M280 90 L160 280 L240 280 L210 422 L350 230 L270 230 Z" fill="url(#g)" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>'
      + '</svg>';
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" });
    res.end(svg);
    return;
  }

  // ── Public health endpoint (no auth required) ────────────────────────────
  if (req.url === "/api/health") {
    const t0 = Date.now();
    const errors = [];
    let krakenOk = false; let krakenLatency = 0;
    try {
      const r = await fetch("https://api.kraken.com/0/public/Time", { signal: AbortSignal.timeout(5000) });
      krakenLatency = Date.now() - t0; krakenOk = r.ok;
      if (!r.ok) errors.push({ source: "kraken", message: "HTTP " + r.status });
    } catch (e) {
      errors.push({ source: "kraken", message: e.message });
    }
    let lastRun = null; let lastRunAge = null; let bot = "stopped";
    try {
      if (existsSync(LOG_FILE)) {
        const log = JSON.parse(readFileSync(LOG_FILE, "utf8"));
        const last = log.trades[log.trades.length - 1];
        if (last) {
          lastRun    = last.timestamp;
          lastRunAge = Math.round((Date.now() - new Date(last.timestamp).getTime()) / 60000);
          bot        = lastRunAge <= 15 ? "running" : "stale";
        }
      }
    } catch (e) {
      errors.push({ source: "log-file", message: e.message });
    }
    // Phase D-5.2 — persistence visibility on the public health endpoint.
    // Lets an operator (or a future banner card) verify the volume status
    // without authenticating. Read-only: reuses the boot-time PERSISTENCE
    // probe plus a per-file existsSync/statSync sweep done now (cheap —
    // microseconds — and reflects current state, not boot state).
    const stateFiles = [
      ["safety-check-log.json", LOG_FILE],
      ["position.json",         POSITION_FILE],
      ["trades.csv",            CSV_FILE],
      ["bot-control.json",      CONTROL_FILE],
      ["performance-state.json",PERF_STATE_FILE],
      ["capital-state.json",    CAPITAL_FILE],
      ["portfolio-state.json",  PORTFOLIO_FILE],
      ["sessions-store.json",   SESSIONS_FILE],
      [".rate-limit-state.json",RATE_LIMIT_FILE],
    ];
    const filesView = {};
    for (const [name, full] of stateFiles) {
      try {
        const exists = existsSync(full);
        filesView[name] = exists
          ? { exists: true, bytes: statSync(full).size }
          : { exists: false, bytes: 0 };
      } catch (e) {
        filesView[name] = { exists: false, bytes: 0, error: e.message };
      }
    }
    const persistence = {
      ok:       PERSISTENCE.ok,
      dataDir:  PERSISTENCE.dir,
      isVolume: PERSISTENCE.isVolume,
      reason:   PERSISTENCE.reason,
      files:    filesView,
    };

    // Phase D-5.4 — Postgres health visibility on the public health
    // endpoint. Always probes fresh (no cache here — this is the canonical
    // liveness URL). Schema version comes from a separate quick query that
    // tolerates a missing schema_migrations table (returns null).
    //
    // Phase D-5.7.2 — adds database.tables row counts (bot_control,
    // trade_events, positions). Each count query runs in its own try/catch
    // so a single-table failure (schema drift, missing relation) degrades
    // gracefully without taking down /api/health. Skipped entirely when
    // the DB is unreachable (tables: null).
    let database;
    if (!databaseUrlPresent) {
      database = {
        ok: false,
        engine: "postgres",
        latencyMs: 0,
        url: null,
        schemaVersion: null,
        schemaName: null,
        reason: "DATABASE_URL not set",
        tables: null,
      };
    } else {
      const h = await dbPing();
      const sv = h.ok ? await dbSchemaVersion() : null;
      let tables = null;
      if (h.ok) {
        tables = {};
        // bot_control — single-row table; trivial COUNT.
        try {
          const r = await dbQuery("SELECT count(*)::int AS rows FROM bot_control");
          tables.bot_control = { rows: r.rows[0].rows };
        } catch (e) {
          log.warn("d-5.7.2 health", `bot_control count failed: ${e.message}`);
          tables.bot_control = { error: e.message };
        }
        // trade_events — total + paper/live split + most recent timestamp.
        // Single round-trip via FILTER aggregates; uses the (mode, ts) index.
        try {
          const r = await dbQuery(
            `SELECT count(*)::int                                   AS total,
                    count(*) FILTER (WHERE mode = 'paper')::int     AS paper,
                    count(*) FILTER (WHERE mode = 'live')::int      AS live,
                    MAX(timestamp)                                  AS last_inserted
             FROM trade_events`
          );
          const row = r.rows[0];
          tables.trade_events = {
            rows:         row.total,
            paper:        row.paper,
            live:         row.live,
            lastInsertAt: row.last_inserted ? row.last_inserted.toISOString() : null,
          };
        } catch (e) {
          log.warn("d-5.7.2 health", `trade_events count failed: ${e.message}`);
          tables.trade_events = { error: e.message };
        }
        // positions — total + 6-way (mode × status) breakdown in one round-trip.
        try {
          const r = await dbQuery(
            `SELECT count(*)::int                                                      AS total,
                    count(*) FILTER (WHERE mode='paper' AND status='open')::int       AS paper_open,
                    count(*) FILTER (WHERE mode='live'  AND status='open')::int       AS live_open,
                    count(*) FILTER (WHERE mode='paper' AND status='closed')::int     AS paper_closed,
                    count(*) FILTER (WHERE mode='live'  AND status='closed')::int     AS live_closed,
                    count(*) FILTER (WHERE mode='paper' AND status='orphaned')::int   AS paper_orphaned,
                    count(*) FILTER (WHERE mode='live'  AND status='orphaned')::int   AS live_orphaned
             FROM positions`
          );
          const row = r.rows[0];
          tables.positions = {
            rows:     row.total,
            open:     { paper: row.paper_open,     live: row.live_open },
            closed:   { paper: row.paper_closed,   live: row.live_closed },
            orphaned: { paper: row.paper_orphaned, live: row.live_orphaned },
          };
        } catch (e) {
          log.warn("d-5.7.2 health", `positions count failed: ${e.message}`);
          tables.positions = { error: e.message };
        }
      }
      database = {
        ok: h.ok,
        engine: "postgres",
        latencyMs: h.latencyMs,
        url: maskedDatabaseUrl,
        schemaVersion: sv ? sv.version : null,
        schemaName:    sv ? sv.name : null,
        reason: h.reason,
        tables,
      };
    }

    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({
      success: errors.length === 0,
      kraken:    krakenOk ? "online" : "offline",
      websocket: "client-managed", // client tracks WS state; included for API consistency
      bot,
      lastRun,
      lastRunAge,
      krakenLatency,
      serverTime: Date.now(),
      errors,
      persistence,
      database,
      // legacy fields kept for backwards compat with existing UI
      krakenOk,
    }));
    return;
  }

  // ── /api/me — session check, returns own 401 instead of redirect ─────────
  if (req.url === "/api/me") {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Not authenticated" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      data: { user: { email: process.env.DASHBOARD_EMAIL || null }, authenticated: true },
    }));
    return;
  }

  // ── Auth guard (catch-all). NOTE: any new endpoint that needs to return ─
  // its OWN 401 instead of a redirect (e.g. /api/me) MUST be placed ABOVE
  // this gate. Anything below is auth-required and will redirect to /login.
  if (!isAuthenticated(req)) {
    res.writeHead(302, { Location: "/login" });
    res.end();
    return;
  }

  // ── Bot run trigger (auth-required; dashboard self-heal calls this) ─────
  if (req.url === "/api/run-bot" && req.method === "POST") {
    // Phase C-4-a — acquire the transition lock before spawning the bot. If
    // a SET_MODE_* or /api/trade is mid-flight, we'd rather refuse than read
    // possibly-stale control state into a freshly-spawned bot.js.
    const _release = acquireTransitionLock("run-bot");
    if (!_release) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Cannot run bot: a mode/trade transition is in progress (" + transitionLockHolder() + "). Try again in a moment." }));
      return;
    }
    try {
      // Phase 3 — server-side confirmation gate. Spawning the bot in LIVE
      // mode requires explicit { confirm: "CONFIRM" } in the body. Paper-mode
      // self-heal keeps its no-confirm path so the dashboard stays self-healing.
      // Phase D-5.6 — DB-preferred read with JSON fallback for the gate check.
      const ctrlNow = loadControl();
      if (ctrlNow.paperTrading === false) {
        let body = {};
        try { body = JSON.parse(await readBody(req)); } catch {}
        if (body.confirm !== "CONFIRM") {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Confirmation required for live bot run" }));
          return;
        }
      }
      let lastRunAge = null;
      if (existsSync(LOG_FILE)) {
        const log = JSON.parse(readFileSync(LOG_FILE,"utf8"));
        const last = log.trades[log.trades.length - 1];
        if (last) lastRunAge = (Date.now() - new Date(last.timestamp).getTime()) / 60000;
      }
      if (lastRunAge !== null && lastRunAge < 4) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, data: { skipped: true, reason: "Last run was " + lastRunAge.toFixed(1) + " min ago" } }));
        return;
      }
      console.log("[run-bot] Triggered via API (last run age: " + (lastRunAge?.toFixed(1) ?? "n/a") + " min)");
      const proc = spawn("node", ["bot.js"], { stdio: "inherit" });
      proc.on("exit", code => console.log("[run-bot] bot.js exited with code " + code));
      proc.on("error", err => console.log("[run-bot] error: " + err.message));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { triggered: true } }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: e.message }));
    } finally {
      // Phase C-4-a — always release the transition lock on this path.
      _release();
    }
    return;
  }

  // ── Paper-only summary (paper trades, paper P&L, computed paper balance) ─
  if (req.url === "/api/paper-summary") {
    try {
      // Phase D-5.8 — getPaperSummary is now async (Postgres-first via modeScopedSummary).
      const data = await getPaperSummary();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ success: true, data }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // ── Live-only summary (live trades, live P&L, real Kraken balance) ──────
  if (req.url === "/api/live-summary") {
    try {
      const data = await getLiveSummary();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ success: true, data }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // ── /api/v2/dashboard — Phase B slim mode-tagged payload ────────────────
  // Single GET that wraps existing safe helpers. Powers /dashboard-v2's 5s
  // refresh and its inline server-render. Read-only; no body parsing; no
  // writes. Strategy V2 is included only as latest.strategyV2 (read-only).
  if (req.url === "/api/v2/dashboard" && req.method === "GET") {
    try {
      const data = await buildV2DashboardPayload();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ success: true, data }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // ── /paper and /live mode-scoped pages (Phase 1: data separation only) ──
  if (req.url === "/paper" || req.url === "/live") {
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store, must-revalidate" });
    // Phase 8b — inline initial summary so first paint has real values.
    let initial = null;
    try {
      // Phase D-5.8 — both summaries are now async.
      initial = req.url === "/paper" ? await getPaperSummary() : await getLiveSummary();
    } catch {}
    res.end(modePage(req.url === "/paper" ? "paper" : "live", initial));
    return;
  }

  // ── /dashboard — combined shell (D-2-d) ─────────────────────────────────
  // /dashboard now serves dashboardCombinedHTML — the legacy HTML body
  // wrapped in a tab framework. Tab 1 ("Dashboard") shows the legacy
  // panels verbatim; the other 5 tabs render placeholders for now.
  // /dashboard-v2 (frozen v2 backup) still serves the old command center
  // via dashboardV2BackupHTML; /dashboard-legacy serves the byte-identical
  // legacy HTML untouched. The combined view is read-only and does not
  // depend on buildV2DashboardPayload — its inner legacy body polls
  // /api/data on its own.
  if (req.url === "/dashboard") {
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store, must-revalidate" });
    res.end(dashboardCombinedHTML(null));
    return;
  }

  // ── /dashboard-v2 — frozen backup of the current command center (D-2-b)
  // /dashboard-v2 is intentionally split off from /dashboard's handler so
  // that future D-2 phases can change /dashboard's body without changing
  // this URL. dashboardV2BackupHTML is a thin wrapper that delegates to the
  // current dashboardV2HTML; once /dashboard switches to the new combined
  // view in D-2-d, dashboardV2HTML becomes unreachable except through this
  // backup URL — at which point it MUST NOT be edited under D-2 work.
  if (req.url === "/dashboard-v2") {
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store, must-revalidate" });
    let initial = null;
    try { initial = await buildV2DashboardPayload(); }
    catch (e) { initial = { error: e.message }; }
    res.end(dashboardV2BackupHTML(initial));
    return;
  }

  // ── /dashboard-legacy — previous detailed UI (preserved for emergency
  // rollback). The heavy panels (Trading Terminal, full Trade History,
  // Capital Router, RSI History, etc.) still live here until Phase D
  // migrates them into the v2 Advanced Details. Operators with muscle
  // memory for the old dashboard reach it explicitly via this URL.
  if (req.url === "/dashboard-legacy") {
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store, must-revalidate" });
    res.end(HTML);
    return;
  }

  // ── System status (auth-required, broader than /api/health) ────────────
  if (req.url === "/api/system-status") {
    try {
      const data = buildSystemStatus({
        sessionsView: { activeSessions: sessions.size, pendingSessions: pendingSessions.size },
      });
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ success: true, data }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  if (req.url === "/api/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    res.write(":ok\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    // Send current state immediately on connect.
    // Phase D-5.8 — getApiData is now async; fire-and-forget the SSE push.
    getApiData().then(d => pushSSE(res, "data", d)).catch(() => {});
    fetchKrakenBalance().then(b => pushSSE(res, "balance", b)).catch(() => {});
    return;
  } else if (req.url === "/api/data") {
    // Phase D-5.8 — getApiData is now async (Postgres-first for paperPnLRealized,
    // modeWinLoss, position; JSON fallback when DB unavailable).
    const data = await getApiData();
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(data));
  } else if (req.url === "/api/home-summary") {
    // Phase 6e — slim endpoint for the homepage. Returns only what / renders.
    // Phase D-5.8 — getHomeSummary is now async.
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(await getHomeSummary()));
  } else if (req.url === "/api/balance") {
    try {
      const data = await fetchKrakenBalance();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    } catch (e) {
      console.error("[/api/balance] error:", e.message);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: true, message: e.message, source: "kraken-balance" }));
    }
  } else if (req.url === "/api/control" && req.method === "POST") {
    let _release = null;
    try {
      const body  = JSON.parse(await readBody(req));
      // Phase C-4-a — read bot-control.json defensively so a malformed file
      // routes to the mode-switch preflight (which returns 409 fail-closed),
      // not the outer catch (which returns 400). For non-mode commands the
      // pre-existing soft-default ({}) behavior is preserved.
      let ctrl = {};
      let _ctrlReadable = true;
      try {
        if (existsSync(CONTROL_FILE)) ctrl = JSON.parse(readFileSync(CONTROL_FILE, "utf8"));
      } catch (e) {
        _ctrlReadable = false;
      }
      const { command, value } = body;
      // Phase 3 — server-side confirmation gate for live-trading triggers.
      // Client modals can be bypassed by an authenticated POST; this rejects
      // any such POST that doesn't carry { confirm: "CONFIRM" }.
      const requiresConfirm =
        command === "SET_MODE_LIVE" ||
        (command === "RESET_KILL_SWITCH" && ctrl.paperTrading === false);
      if (requiresConfirm && body.confirm !== "CONFIRM") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Confirmation required for " + command }));
        return;
      }
      // Phase C-0 — KILL_NOW gains its own typed-confirm gate. Mirrors the
      // existing client-side "KILL" modal so an authenticated POST cannot
      // bypass it. No back-compat: every caller MUST send { confirm: "KILL" }.
      if (command === "KILL_NOW" && body.confirm !== "KILL") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Confirmation required for KILL_NOW" }));
        return;
      }
      // Phase C-4-a — mode-switch preflight + transition lock. Closes the
      // open-position hazard (position.json has no mode tag, so a paper
      // position would be managed as live after a flip) and the killed-state
      // surprise (resetting kill via paper logic before a live flip is the
      // operator's responsibility). Fails CLOSED on missing/malformed state.
      if (command === "SET_MODE_LIVE" || command === "SET_MODE_PAPER") {
        let pos = null;
        try {
          if (!existsSync(POSITION_FILE)) throw new Error("position.json missing");
          pos = JSON.parse(readFileSync(POSITION_FILE, "utf8"));
        } catch (e) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Cannot switch mode: position state is unreadable. Aborting for safety." }));
          return;
        }
        if (!_ctrlReadable || !existsSync(CONTROL_FILE)) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Cannot switch mode: control state is unreadable. Aborting for safety." }));
          return;
        }
        if (pos && pos.open === true) {
          const px = (typeof pos.entryPrice === "number") ? " (entry $" + pos.entryPrice.toFixed(4) + ")" : "";
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Cannot switch mode: an open position exists" + px + ". Close it first via the Trading Terminal on /dashboard, /paper, or /live." }));
          return;
        }
        if (command === "SET_MODE_LIVE" && ctrl.killed === true) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Cannot switch to live: kill switch is active. Reset the kill switch first." }));
          return;
        }
        _release = acquireTransitionLock(command);
        if (!_release) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Cannot switch mode: another transition is in progress (" + transitionLockHolder() + "). Try again in a moment." }));
          return;
        }
      }
      switch (command) {
        case "START_BOT":       ctrl.stopped = false; break;
        case "STOP_BOT":        ctrl.stopped = true;  break;
        case "SET_MODE_LIVE":   ctrl.paperTrading = false; break;
        case "SET_MODE_PAPER":  ctrl.paperTrading = true;  break;
        case "PAUSE_TRADING":   ctrl.paused = true;   break;
        case "RESUME_TRADING":  ctrl.paused = false;  break;
        case "SET_LEVERAGE":         ctrl.leverage              = Math.min(Math.max(parseInt(value) || 2, 1), 3); break;
        case "SET_RISK":             ctrl.riskPct               = Math.min(Math.max(parseFloat(value) || 1, 0.1), 5); break;
        case "SET_MAX_DAILY_LOSS":   ctrl.maxDailyLossPct       = Math.min(Math.max(parseFloat(value) || 3, 0.5), 20); break;
        case "SET_COOLDOWN":         ctrl.cooldownMinutes       = Math.min(Math.max(parseFloat(value) || 15, 0), 120); break;
        case "SET_KILL_DRAWDOWN":    ctrl.killSwitchDrawdownPct = Math.min(Math.max(parseFloat(value) || 5, 1), 50); break;
        case "SET_PAUSE_LOSSES":     ctrl.pauseAfterLosses      = Math.min(Math.max(parseInt(value) || 3, 1), 10); break;
        case "SET_XRP_ROLE": {
          const cap = existsSync(CAPITAL_FILE) ? JSON.parse(readFileSync(CAPITAL_FILE,"utf8")) : {};
          cap.xrpRole = ["HOLD_ASSET","ACTIVE","AGGRESSIVE"].includes(value) ? value : "HOLD_ASSET";
          cap.updatedAt = new Date().toISOString();
          writeFileSync(CAPITAL_FILE, JSON.stringify(cap, null, 2));
          break;
        }
        case "SET_AUTO_CONVERT": {
          const cap = existsSync(CAPITAL_FILE) ? JSON.parse(readFileSync(CAPITAL_FILE,"utf8")) : {};
          cap.autoConversion = value === "true" || value === true;
          cap.updatedAt = new Date().toISOString();
          writeFileSync(CAPITAL_FILE, JSON.stringify(cap, null, 2));
          break;
        }
        case "SET_ACTIVE_PCT": {
          const cap = existsSync(CAPITAL_FILE) ? JSON.parse(readFileSync(CAPITAL_FILE,"utf8")) : {};
          const pct = Math.min(Math.max(parseInt(value) || 70, 10), 95);
          cap.activePct = pct; cap.reservePct = 100 - pct;
          cap.updatedAt = new Date().toISOString();
          writeFileSync(CAPITAL_FILE, JSON.stringify(cap, null, 2));
          break;
        }
        case "KILL_NOW":             ctrl.killed = true;  ctrl.paused = true; break;
        case "RESET_KILL_SWITCH":    ctrl.killed = false; ctrl.paused = false; ctrl.consecutiveLosses = 0; break;
        case "RESET_COOLDOWN":       ctrl.lastTradeTime = null; break;
        case "RESET_LOSSES":         ctrl.consecutiveLosses = 0; ctrl.paused = false; break;
        default: throw new Error("Unknown command: " + command);
      }
      ctrl.updatedAt = new Date().toISOString();
      ctrl.updatedBy = command;
      writeFileSync(CONTROL_FILE, JSON.stringify(ctrl, null, 2));
      // Phase D-5.5 — shadow-write to Postgres bot_control. Fire-and-forget;
      // failure logs only and never blocks the /api/control response.
      syncBotControlToDb(ctrl);
      let capState = {};
      try { if (existsSync(CAPITAL_FILE)) capState = JSON.parse(readFileSync(CAPITAL_FILE,"utf8")); } catch {}
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, control: ctrl, capitalState: capState }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    } finally {
      // Phase C-4-a — always release the transition lock on this path.
      if (_release) _release();
    }
  } else if (req.url === "/api/control" && req.method === "GET") {
    // Phase D-5.6 — DB-preferred read with JSON fallback.
    const ctrl = loadControl();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(ctrl));
  } else if (req.url === "/api/trade" && req.method === "POST") {
    // Phase C-4-a — acquire the transition lock before doing anything else.
    // Returns 409 if a SET_MODE_* or another /api/trade or /api/run-bot is
    // currently committing, eliminating the race where a paper-trade body
    // executes after a mode flip but before this handler's gate sees it.
    const _release = acquireTransitionLock("trade");
    if (!_release) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Cannot place trade: a mode/trade transition is in progress (" + transitionLockHolder() + "). Try again in a moment." }));
      return;
    }
    try {
      const body = JSON.parse(await readBody(req));
      // Phase 3 — server-side confirmation gate. Live trades require
      // { confirm: "CONFIRM" } so a stray authenticated POST can't place an
      // order. Paper trades stay unguarded to match existing UX.
      // Phase D-5.6 — DB-preferred read with JSON fallback for the gate check.
      const ctrlNow = loadControl();
      if (ctrlNow.paperTrading === false && body.confirm !== "CONFIRM") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Confirmation required for live trade" }));
        return;
      }
      const result = await handleTradeCommand(body.command, body.params || {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    } finally {
      // Phase C-4-a — always release the transition lock on this path.
      _release();
    }
  } else if (req.url === "/api/chat" && req.method === "POST") {
    try {
      const { message, history = [] } = JSON.parse(await readBody(req));
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ reply: "⚠️ ANTHROPIC_API_KEY not set. Add it to your .env file to enable the assistant." })); return; }

      // Build live bot context for the system prompt
      let ctx = "";
      try {
        const log  = existsSync(LOG_FILE) ? JSON.parse(readFileSync(LOG_FILE,"utf8")) : { trades: [] };
        const pos  = existsSync(POSITION_FILE)         ? JSON.parse(readFileSync(POSITION_FILE,"utf8"))         : { open: false };
        // Phase D-5.6 — DB-preferred read with JSON fallback. Chat context
        // builder is read-only (used to compose the AI assistant's system
        // prompt); auto-execute mutations below stay on JSON.
        const ctrl = loadControl();
        const perf = existsSync(PERF_STATE_FILE)? JSON.parse(readFileSync(PERF_STATE_FILE,"utf8")): {};
        const cap  = existsSync(CAPITAL_FILE)    ? JSON.parse(readFileSync(CAPITAL_FILE,"utf8"))    : {};
        const latest = log.trades.length ? log.trades[log.trades.length - 1] : null;
        const recentExits = log.trades.filter(t => t.type === "EXIT").slice(-5);

        ctx = `
LIVE BOT STATE (${new Date().toISOString()}):
- Mode: ${ctrl.paperTrading !== false ? "PAPER TRADING" : "LIVE TRADING"}
- Bot: ${ctrl.stopped ? "STOPPED" : ctrl.paused ? "PAUSED" : "RUNNING"}
- Symbol: XRPUSDT | Timeframe: 5m

OPEN POSITION: ${pos.open ? `YES — entry $${pos.entryPrice?.toFixed(4)}, SL $${pos.stopLoss?.toFixed(4)} (-${ctrl.stopLossPct||1.25}%), TP $${pos.takeProfit?.toFixed(4)} (+${ctrl.takeProfitPct||2}%), leverage ${pos.leverage||2}x` : "None"}

LATEST RUN (${latest ? new Date(latest.timestamp).toLocaleTimeString() : "n/a"}):
- Signal score: ${latest?.signalScore ?? "n/a"}/100 | Threshold: ${latest?.perfState?.adaptedThreshold ?? 75}
- RSI: ${latest?.indicators?.rsi3?.toFixed(2) ?? "n/a"} | EMA: $${latest?.indicators?.ema8?.toFixed(4) ?? "n/a"} | VWAP: $${latest?.indicators?.vwap?.toFixed(4) ?? "n/a"}
- Market regime: ${latest?.volatility?.regime ?? "n/a"} | Price: $${latest?.price?.toFixed(4) ?? "n/a"}
- Decision: ${latest?.allPass ? "TRADE FIRED" : "SKIPPED"}
${latest?.decisionLog ? "- Decision log: " + latest.decisionLog : ""}

PERFORMANCE:
- Win rate: ${perf.winRate ? (perf.winRate*100).toFixed(0) + "%" : "n/a"} | Profit factor: ${perf.profitFactor?.toFixed(2) ?? "n/a"}
- Drawdown: ${perf.drawdown?.toFixed(2) ?? 0}% | Consecutive losses: ${perf.consecutiveLosses ?? 0}
- Adapted threshold: ${latest?.perfState?.adaptedThreshold ?? 75} | Risk multiplier: ${latest?.perfState?.riskMultiplier ?? 1}x

RISK SETTINGS:
- Leverage: ${ctrl.leverage ?? 2}x (max 3x) | Risk/trade: ${ctrl.riskPct ?? 1}%
- Max daily loss: ${ctrl.maxDailyLossPct ?? 3}% | Cooldown: ${ctrl.cooldownMinutes ?? 15} min
- Kill switch: ${ctrl.killed ? "TRIGGERED" : "Armed at " + (ctrl.killSwitchDrawdownPct ?? 5) + "% drawdown"}

CAPITAL:
- XRP role: ${cap.xrpRole ?? "HOLD_ASSET"} | Auto-convert: ${cap.autoConversion ? "ON" : "OFF"}
- Active capital: ${cap.activePct ?? 70}% | Reserve: ${cap.reservePct ?? 30}%

RECENT EXITS (last 5): ${recentExits.length ? recentExits.map(t => `${t.exitReason} ${t.pct}% ($${t.pnlUSD})`).join(", ") : "None yet"}
`;
      } catch {}

      const systemPrompt = `You are Agent Avila's trading assistant — an intelligent copilot for a live XRP trading bot on Kraken.

You have access to real-time bot state data (injected below). Your job is to help the user understand and control their trading system.

${ctx}

CAPABILITIES:
1. Explain why the bot traded or skipped (use the decision log and signal scores)
2. Analyze performance metrics and suggest improvements
3. Answer questions about risk, position, regime, and settings
4. Execute safe commands by outputting [EXECUTE: COMMAND] — these run automatically
5. Flag dangerous commands with [CONFIRM_REQUIRED] before execution

SAFE COMMANDS (auto-execute):
[EXECUTE: PAUSE_TRADING] [EXECUTE: RESUME_TRADING] [EXECUTE: START_BOT] [EXECUTE: STOP_BOT]
[EXECUTE: SET_RISK 0.5] [EXECUTE: SET_LEVERAGE 2] [EXECUTE: SET_MAX_DAILY_LOSS 3]
[EXECUTE: RESET_KILL_SWITCH] [EXECUTE: RESET_COOLDOWN] [EXECUTE: RESET_LOSSES]

CONFIRMATION REQUIRED (output [CONFIRM_REQUIRED] first):
[EXECUTE: SET_MODE_LIVE] [EXECUTE: CLOSE_POSITION] [EXECUTE: SELL_ALL]

RULES:
- Be concise and direct — max 3-4 sentences for analysis
- Use numbers from the live state, not hypotheticals
- Never suggest disabling liquidation protection or kill switch permanently
- If unsure, say so — don't invent data
- When user asks "why skip?" use the signal conditions and score breakdown
- Format numbers clearly: $1.3935, 67%, 2x`;

      const messages = [
        ...history.slice(-8),
        { role: "user", content: message }
      ];

      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 600, system: systemPrompt, messages }),
      });
      const apiData = await apiRes.json();
      if (!apiRes.ok) throw new Error(apiData.error?.message || "Claude API error");

      const reply = apiData.content[0].text;

      // Parse commands from response
      const cmdRegex = /\[EXECUTE: ([^\]]+)\]/g;
      const confirmRequired = reply.includes("[CONFIRM_REQUIRED]");
      const commands = [];
      let m;
      while ((m = cmdRegex.exec(reply)) !== null) {
        commands.push({ cmd: m[1].trim(), confirmRequired });
      }

      // Auto-execute safe commands (not confirm-required)
      const executed = [];
      if (!confirmRequired) {
        for (const { cmd } of commands) {
          try {
            const parts = cmd.split(" ");
            const command = parts[0]; const value = parts.slice(1).join(" ") || undefined;
            const ctrl = existsSync(CONTROL_FILE) ? JSON.parse(readFileSync(CONTROL_FILE,"utf8")) : {};
            // Phase 3 — RESET_KILL_SWITCH is auto-exec only in PAPER mode.
            // In LIVE mode it requires the typed-confirm modal (server-side
            // gate on /api/control rejects un-confirmed POSTs anyway, but we
            // also remove it here so chat never even attempts the write).
            const SAFE = ["PAUSE_TRADING","RESUME_TRADING","START_BOT","STOP_BOT","SET_RISK","SET_LEVERAGE","SET_MAX_DAILY_LOSS","RESET_COOLDOWN","RESET_LOSSES","SET_COOLDOWN","SET_PAUSE_LOSSES"];
            if (ctrl.paperTrading !== false) SAFE.push("RESET_KILL_SWITCH");
            if (!SAFE.includes(command)) continue;
            switch (command) {
              case "PAUSE_TRADING":   ctrl.paused = true; break;
              case "RESUME_TRADING":  ctrl.paused = false; break;
              case "START_BOT":       ctrl.stopped = false; break;
              case "STOP_BOT":        ctrl.stopped = true; break;
              case "SET_RISK":        ctrl.riskPct = Math.min(Math.max(parseFloat(value)||1, 0.1), 5); break;
              case "SET_LEVERAGE":    ctrl.leverage = Math.min(Math.max(parseInt(value)||2, 1), 3); break;
              case "SET_MAX_DAILY_LOSS": ctrl.maxDailyLossPct = Math.min(Math.max(parseFloat(value)||3, 0.5), 20); break;
              case "RESET_KILL_SWITCH":  ctrl.killed = false; ctrl.paused = false; ctrl.consecutiveLosses = 0; break;
              case "RESET_COOLDOWN":     ctrl.lastTradeTime = null; break;
              case "RESET_LOSSES":       ctrl.consecutiveLosses = 0; ctrl.paused = false; break;
              case "SET_COOLDOWN":    ctrl.cooldownMinutes = Math.min(Math.max(parseFloat(value)||15, 0), 120); break;
              case "SET_PAUSE_LOSSES": ctrl.pauseAfterLosses = Math.min(Math.max(parseInt(value)||3, 1), 10); break;
            }
            ctrl.updatedAt = new Date().toISOString(); ctrl.updatedBy = "CHAT_" + command;
            writeFileSync(CONTROL_FILE, JSON.stringify(ctrl, null, 2));
            // Phase D-5.5 — shadow-write to Postgres bot_control. Same
            // fire-and-forget pattern as /api/control; chat handler's
            // outer try/catch already swallows errors here, so the
            // helper's internal error log is the only failure surface.
            syncBotControlToDb(ctrl);
            executed.push(command);
          } catch {}
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ reply, commands, executed, confirmRequired }));
    } catch (e) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ reply: "❌ Error: " + e.message }));
    }

  } else {
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store, must-revalidate",
    });
    // Phase 8b — inline initial summary so first paint has real values.
    // Phase D-5.8 — getHomeSummary is now async.
    let initial = null;
    try { initial = await getHomeSummary(); } catch {}
    res.end(homepagePage(initial));
  }
});

// ─── TOTP Init ────────────────────────────────────────────────────────────────

if (!process.env.DASHBOARD_BACKUP_PHRASE) {
  const phrase = crypto.randomBytes(18).toString("base64url");
  appendFileSync(".env", `\nDASHBOARD_BACKUP_PHRASE=${phrase}\n`);
  process.env.DASHBOARD_BACKUP_PHRASE = phrase;
  console.log(`\n  Backup phrase generated: ${phrase}`);
  console.log(`  Save this somewhere safe — it lets you skip 2FA if your app is unavailable.\n`);
}

if (!process.env.DASHBOARD_TOTP_SECRET) {
  const secret = genBase32Secret();
  appendFileSync(".env", `\nDASHBOARD_TOTP_SECRET=${secret}\n`);
  process.env.DASHBOARD_TOTP_SECRET = secret;
  const account = encodeURIComponent(process.env.DASHBOARD_EMAIL || "dashboard");
  const uri = `otpauth://totp/Claude%20Trading%20Bot:${account}?secret=${secret}&issuer=Claude%20Trading%20Bot`;
  console.log(`\n  ┌─ 2FA Setup ───────────────────────────────────────────────┐`);
  console.log(`  │  Open this URL to get your QR code:                       │`);
  console.log(`  │  https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`);
  console.log(`  │                                                            │`);
  console.log(`  │  Or enter this secret manually in your app:               │`);
  console.log(`  │  ${secret.match(/.{1,4}/g).join(" ")}                     │`);
  console.log(`  └────────────────────────────────────────────────────────────┘\n`);
}

server.listen(PORT, () => {
  console.log(`\n  Dashboard → http://localhost:${PORT}\n`);
  // Phase D-5.2 — persistence boot banner. Single block on dashboard startup
  // so Railway logs always show which DATA_DIR the process is reading/writing
  // against, plus a per-file presence + size inventory so a wiped volume is
  // obvious in 10 seconds. Mirrors bot.js's per-cycle banner. Read-only.
  console.log(`[boot] DATA_DIR=${PERSISTENCE.dir}  persistence=${PERSISTENCE.ok ? "ok" : "FAIL"}  volume=${PERSISTENCE.isVolume ? "yes" : "no/local"}`);
  if (!PERSISTENCE.ok) console.error(`[boot] persistence FAILED: ${PERSISTENCE.reason}`);
  for (const f of [LOG_FILE, POSITION_FILE, CSV_FILE, CONTROL_FILE, PERF_STATE_FILE, PORTFOLIO_FILE, CAPITAL_FILE, SESSIONS_FILE, RATE_LIMIT_FILE]) {
    let exists = false, size = 0;
    try { exists = existsSync(f); if (exists) size = statSync(f).size; } catch {}
    console.log(`[boot] ${exists ? "✓" : "·"}  ${path.relative(DATA_DIR, f) || path.basename(f)}  (${size} bytes)`);
  }
  // Phase D-5.4 — Postgres connectivity probe at boot. Surfaces DB state
  // alongside the persistence banner so an operator sees both signals
  // together. Async-fired-and-forget so the listen callback isn't blocked
  // by a slow DB; result lands in logs ~ms later. /api/health remains the
  // authoritative on-demand probe.
  (async () => {
    if (!databaseUrlPresent) {
      console.log(`[boot] db=DISABLED  reason=DATABASE_URL not set`);
      return;
    }
    try {
      const h = await dbPing();
      const sv = h.ok ? await dbSchemaVersion() : null;
      const ver = sv && sv.version != null ? `v${sv.version}` : "no-schema";
      console.log(`[boot] db=${h.ok ? "ok" : "FAIL"}  latency=${h.latencyMs}ms  schema=${ver}  url=${maskedDatabaseUrl}`);
      if (!h.ok) console.error(`[boot] db FAILED: ${h.reason}`);
    } catch (e) {
      console.error(`[boot] db probe threw: ${e.message}`);
    }
  })();
});

// ─── Embedded bot runner — only on Railway, runs every 5 minutes ─────────────
// On local Mac, the cron job already runs the bot, so we skip this to avoid duplicates.
if (process.env.RAILWAY_ENVIRONMENT) {
  const runBot = () => {
    log.info("bot-runner", "Starting bot.js…");
    const proc = spawn("node", ["bot.js"], { stdio: "inherit" });
    proc.on("exit", code => log.info("bot-runner", "bot.js exited", { code }));
    proc.on("error", err => log.error("bot-runner", err.message));
  };
  // First run after 10 seconds (let server warm up)
  setTimeout(runBot, 10000);
  // Then every 5 minutes
  setInterval(runBot, 5 * 60 * 1000);
  console.log("  Bot runner enabled (Railway env detected)");
}

// ─── Embedded health watchdog — runs every 5 minutes on Railway ─────────────
// Logic lives in system-guardian.js. Reads file-based state (safety-check-log,
// .bot.lock, bot-control.json) so this works across the dashboard <-> bot
// process boundary without shared memory.
async function runHealthWatchdog() {
  try {
    const { issues } = await runSystemCheck({
      sessionsView: { activeSessions: sessions.size, pendingSessions: pendingSessions.size },
    });
    for (const [key, msg] of issues) log.warn("watchdog", `${key}: ${msg}`);
  } catch (e) { log.error("watchdog", e.message); }
}

if (process.env.RAILWAY_ENVIRONMENT) {
  setTimeout(runHealthWatchdog, 30 * 1000);          // first check 30s after boot
  setInterval(runHealthWatchdog, 5 * 60 * 1000);     // every 5 min thereafter
  console.log("  Health watchdog enabled");
}
