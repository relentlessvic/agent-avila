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
