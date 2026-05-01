// Phase D-5.4 — Postgres connection module.
//
// Single shared pg.Pool used by both bot.js and dashboard.js. Only this file
// imports the `pg` driver. Reads DATABASE_URL from env (Railway injects it
// via the linked Postgres add-on as ${{Postgres.DATABASE_URL}}).
//
// Read-only behaviorally for D-5.4: the module exposes the connection
// primitives (query, inTransaction, ping, getCachedDbHealth) but no caller
// writes anything except the migration runner. Trading state writes start
// landing in D-5.5 onward.
//
// When DATABASE_URL is unset, the module is harmless: every primitive
// returns a benign "DB_UNAVAILABLE" or { ok: false } shape so local dev
// without a Postgres URL keeps working unchanged.

import "dotenv/config";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL || null;

// Lazy pool init — importing db.js without DATABASE_URL set should not
// throw; the first .query() call surfaces the missing-config error.
let _pool = null;
function getPool() {
  if (_pool) return _pool;
  if (!DATABASE_URL) return null;
  _pool = new Pool({
    connectionString: DATABASE_URL,
    // Railway Postgres terminates TLS with a self-signed cert chain.
    // rejectUnauthorized:false is the documented Railway setting; we
    // would tighten it if we ever bring our own cert.
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  // The pool emits 'error' on idle clients independently of any active
  // query. Log so we know the connection blew up between cycles.
  _pool.on("error", (err) => {
    console.error("[db] idle pool error:", err.message);
  });
  return _pool;
}

export const dbAvailable = () => !!DATABASE_URL;

export async function query(sql, params = []) {
  const pool = getPool();
  if (!pool) throw new Error("DB_UNAVAILABLE: DATABASE_URL not set");
  return pool.query(sql, params);
}

export async function inTransaction(fn) {
  const pool = getPool();
  if (!pool) throw new Error("DB_UNAVAILABLE: DATABASE_URL not set");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// One-shot health probe. SELECT 1 round-trip with a small timeout window
// (the pool already enforces connectionTimeoutMillis=5s for a fresh
// connection; this query rides an existing pooled connection).
export async function ping() {
  if (!DATABASE_URL) {
    return { ok: false, engine: "postgres", reason: "DATABASE_URL not set", latencyMs: 0 };
  }
  const pool = getPool();
  const t0 = Date.now();
  try {
    const r = await pool.query("SELECT 1 AS ok");
    return { ok: r.rows[0].ok === 1, engine: "postgres", latencyMs: Date.now() - t0, reason: null };
  } catch (e) {
    return { ok: false, engine: "postgres", latencyMs: Date.now() - t0, reason: e.message };
  }
}

// 30-second cache so /api/v2/dashboard polled every 5s doesn't hit the DB
// just to surface liveness. /api/health is the place that always probes
// fresh state via ping() directly when an operator needs ground truth.
let _healthCache = { ts: 0, result: null };
export async function getCachedDbHealth(maxAgeMs = 30_000) {
  const now = Date.now();
  if (_healthCache.result && now - _healthCache.ts < maxAgeMs) return _healthCache.result;
  const result = await ping();
  _healthCache = { ts: now, result };
  return result;
}

// Returns the highest applied migration version, or null if the
// schema_migrations table doesn't exist yet (pre-D-5.4 / fresh DB).
// Wrapped in try/catch so a query failure doesn't take down /api/health.
export async function schemaVersion() {
  if (!DATABASE_URL) return null;
  try {
    const r = await query(
      "SELECT MAX(version) AS v, (SELECT name FROM schema_migrations WHERE version = MAX(sm.version)) AS name " +
      "FROM schema_migrations sm"
    );
    if (!r.rows.length) return null;
    return { version: r.rows[0].v ?? null, name: r.rows[0].name ?? null };
  } catch {
    return null; // table missing or any other error
  }
}

// Mask password in a postgres URL for safe display in /api/health.
// Input  : postgres://user:secret@host:5432/db
// Output : postgres://user:***@host:5432/db
export function maskUrl(url) {
  if (!url) return null;
  try { return url.replace(/:[^:@/]+@/, ":***@"); }
  catch { return null; }
}

export const databaseUrlPresent = !!DATABASE_URL;
export const maskedDatabaseUrl = maskUrl(DATABASE_URL);

export async function close() {
  if (_pool) {
    const p = _pool;
    _pool = null;
    await p.end();
  }
}

// ─── Phase D-5.6.1 — bot_control upsert ─────────────────────────────────────
// Domain helper called by both processes that mutate bot_control:
//   - dashboard.js syncBotControlToDb() (kept inline in dashboard.js for now;
//     a future cleanup phase can route it through here)
//   - bot.js saveControl() (D-5.6.1 — uses this directly)
//
// Idempotent UPSERT: row exists (seeded by migration 001) → UPDATE; missing
// → INSERT. Throws on connection or schema failure; callers wrap in their
// own try/catch and log so dual-write failure never breaks the JSON write
// path or the bot cycle.
//
// Field mapping (camelCase → snake_case) and defaults match bot.js
// DEFAULT_CONTROL so a partial ctrl object never writes a NULL where a
// NOT NULL DEFAULT is expected.
// ─── Phase D-5.7 — trade_events + positions helpers ────────────────────────
// Three small helpers used by bot.js's BUY/EXIT/REENTRY/failed-attempt
// dual-writes. All take a transactional `client` from inTransaction(...)
// so the caller controls BEGIN/COMMIT/ROLLBACK boundaries: a position
// insert + its trade_event insert commit atomically or not at all.

// Deterministic UUID derived from a stable seed. Idempotent on retry:
// same (seed, eventType) → same UUID → ON CONFLICT (event_id) DO NOTHING
// in trade_events safely deduplicates re-runs after a crash mid-write.
//
// Seeds we use:
//   - kraken_order_id (real or PAPER-<ts>) for normal events
//   - "<timestamp>:<symbol>" for failed live attempts (no orderId yet)
export function buildEventId(seed, eventType) {
  if (!seed || !eventType) throw new Error("buildEventId: seed and eventType required");
  const h = crypto.createHash("sha256").update(`${seed}:${eventType}`).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

// Phase D-5.7.3.1 — coerce float-shaped values to integers for INTEGER
// columns. bot.js's evalSignal accumulates condition subscores including
// fractional terms (e.g. RSI-dip = 30 * (45 - rsi3) / 10), so signal_score
// can arrive as e.g. 99.047619... — Postgres rejects floats on INTEGER
// columns. Round defensively. Returns null for missing/non-finite input
// so optional columns stay nullable.
function _coerceInt(v) {
  if (v == null) return null;
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

// INSERT ... ON CONFLICT (event_id) DO NOTHING. Returns { id } of the
// inserted row, or undefined if a conflict skipped the insert (caller
// can no-op since the existing row is already correct).
export async function insertTradeEvent(client, event) {
  if (!client) throw new Error("insertTradeEvent: client required (use inTransaction)");
  if (!event || !event.event_id) throw new Error("insertTradeEvent: event.event_id required");
  return client.query(
    `INSERT INTO trade_events (
       event_id, timestamp, mode, event_type, symbol, position_id,
       price, quantity, usd_amount, fees_usd, slippage_bps,
       pnl_usd, pnl_pct, signal_score, signal_threshold, regime,
       leverage, kraken_order_id, decision_log, error, metadata
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16,
       $17, $18, $19, $20, $21
     )
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [
      event.event_id,
      event.timestamp,
      event.mode,
      event.event_type,
      event.symbol,
      event.position_id ?? null,
      event.price ?? null,
      event.quantity ?? null,
      event.usd_amount ?? null,
      event.fees_usd ?? null,
      event.slippage_bps ?? null,
      event.pnl_usd ?? null,
      event.pnl_pct ?? null,
      _coerceInt(event.signal_score),       // Phase D-5.7.3.1 — INTEGER column; round defensively
      _coerceInt(event.signal_threshold),   // Phase D-5.7.3.1 — INTEGER column
      event.regime ?? null,
      _coerceInt(event.leverage),           // Phase D-5.7.3.1 — INTEGER column
      event.kraken_order_id ?? null,
      event.decision_log ?? null,
      event.error ?? null,
      event.metadata ?? {},
    ]
  );
}

// INSERT a new position with status='open'. ON CONFLICT (kraken_order_id)
// DO NOTHING handles a retry that would create a duplicate row. Returns
// the id of the newly-inserted row, OR the id of the existing row when
// a conflict skipped the insert. Returns null if neither resolves
// (caller logs and gives up on linking the trade_event to a position).
export async function upsertPositionOpen(client, pos) {
  if (!client) throw new Error("upsertPositionOpen: client required");
  if (!pos || !pos.mode || !pos.symbol) throw new Error("upsertPositionOpen: pos.mode + pos.symbol required");
  const r = await client.query(
    `INSERT INTO positions (
       mode, symbol, side, status, entry_price, entry_time, entry_signal_score,
       quantity, trade_size_usd, leverage, effective_size_usd,
       stop_loss, take_profit, volatility_level, kraken_order_id, metadata
     ) VALUES (
       $1, $2, $3, 'open', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
     )
     ON CONFLICT (kraken_order_id) WHERE kraken_order_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [
      pos.mode,
      pos.symbol,
      pos.side ?? "long",
      pos.entry_price,
      pos.entry_time,
      _coerceInt(pos.entry_signal_score),    // Phase D-5.7.3.1 — INTEGER column
      pos.quantity,
      pos.trade_size_usd,
      _coerceInt(pos.leverage) ?? 1,         // Phase D-5.7.3.1 — INTEGER column; default 1 if missing
      pos.effective_size_usd ?? null,
      pos.stop_loss,
      pos.take_profit,
      pos.volatility_level ?? null,
      pos.kraken_order_id ?? null,
      pos.metadata ?? {},
    ]
  );
  if (r.rows.length > 0) return r.rows[0].id;
  // Conflict — row already exists. Look up its id by kraken_order_id.
  if (pos.kraken_order_id) {
    const existing = await client.query(
      `SELECT id FROM positions WHERE kraken_order_id = $1 LIMIT 1`,
      [pos.kraken_order_id]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
  }
  return null;
}

// UPDATE the open position for the given mode to closed. Optimistic-
// concurrency via WHERE status='open' makes a duplicate close a no-op
// (rowCount=0). Returns the id of the closed position, or null if no
// open position existed (caller continues with a null position_id on
// the trade_event — historical reconstruction can still link via
// kraken_order_id metadata).
export async function closePosition(client, mode, exit) {
  if (!client) throw new Error("closePosition: client required");
  if (!mode) throw new Error("closePosition: mode required");
  const r = await client.query(
    `UPDATE positions SET
       status               = 'closed',
       exit_price           = $1,
       exit_time            = $2,
       exit_reason          = $3,
       realized_pnl_usd     = $4,
       realized_pnl_pct     = $5,
       kraken_exit_order_id = $6,
       updated_at           = NOW()
     WHERE mode = $7 AND status = 'open'
     RETURNING id`,
    [
      exit.exit_price ?? null,
      exit.exit_time ?? null,
      exit.exit_reason ?? null,
      exit.realized_pnl_usd ?? null,
      exit.realized_pnl_pct ?? null,
      exit.kraken_exit_order_id ?? null,
      mode,
    ]
  );
  return r.rows[0]?.id ?? null;
}

export async function upsertBotControl(ctrl) {
  if (!ctrl || typeof ctrl !== "object") throw new Error("upsertBotControl: ctrl must be an object");
  return query(
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
      ctrl.lastTradeTime ?? null,                  // $15
      ctrl.leverageDisabledUntil ?? null,          // $16
      ctrl.lastSummaryDate ?? null,                // $17
      ctrl.updatedBy ?? null,                      // $18
      ctrl.updatedAt ?? null,                      // $19 (COALESCE → NOW())
    ]
  );
}
