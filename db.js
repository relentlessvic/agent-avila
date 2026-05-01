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
