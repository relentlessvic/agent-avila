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

// ─── Phase D-5.10.5.3 — active-management dual-write helper ────────────────
// Update SL/TP on the currently-open position matching (mode, kraken_order_id).
// Used by bot.js's manageActiveTrade() to dual-write breakeven and trailing-
// stop adjustments alongside the existing JSON write. Pool-level call (single
// statement, no FK ripple) — no inTransaction needed.
//
// Strict scoping: WHERE clause includes mode, kraken_order_id, AND status='open'
// so a closed position can never be silently updated via this helper. Returns
// the updated row id, or null if no row matched (caller logs and skips —
// JSON remains authoritative).
//
// Dynamic SET clause: only the fields actually present in the input object
// participate in the UPDATE. updated_at = NOW() always advances on any change.
// If no fields are provided, returns null without issuing a query.
export async function updatePositionRiskLevels(mode, orderId, fields) {
  _requireMode("updatePositionRiskLevels", mode);
  if (!orderId) throw new Error("updatePositionRiskLevels: orderId required");
  if (!fields || typeof fields !== "object") {
    throw new Error("updatePositionRiskLevels: fields object required");
  }
  const sets = [];
  const params = [mode, orderId];
  let i = 3;
  if (fields.stop_loss != null) {
    sets.push(`stop_loss = $${i++}`);
    params.push(fields.stop_loss);
  }
  if (fields.take_profit != null) {
    sets.push(`take_profit = $${i++}`);
    params.push(fields.take_profit);
  }
  if (sets.length === 0) return null;
  sets.push(`updated_at = NOW()`);
  const r = await query(
    `UPDATE positions SET ${sets.join(", ")}
     WHERE mode = $1 AND kraken_order_id = $2 AND status = 'open'
     RETURNING id`,
    params
  );
  return r.rows[0]?.id ?? null;
}

// ─── Phase B.2a — transactional variant of updatePositionRiskLevels ────────
// Same SQL and contract as updatePositionRiskLevels above, but takes a
// client parameter so callers can wrap the UPDATE inside an inTransaction
// block alongside an audit insertTradeEvent (manual_sl_update /
// manual_tp_update events). Existing updatePositionRiskLevels is kept
// unchanged for its existing callers (bot.js trailing-stop management,
// scripts/smoke-test-live-writes.js).
//
// Returns the updated row id, or null if no row matched (race-friendly:
// caller maps null to { ok: false, reason: "no_open_position" }).
export async function updatePositionRiskLevelsTx(client, mode, orderId, fields) {
  _requireMode("updatePositionRiskLevelsTx", mode);
  if (!client) throw new Error("updatePositionRiskLevelsTx: client required");
  if (!orderId) throw new Error("updatePositionRiskLevelsTx: orderId required");
  if (!fields || typeof fields !== "object") {
    throw new Error("updatePositionRiskLevelsTx: fields object required");
  }
  const sets = [];
  const params = [mode, orderId];
  let i = 3;
  if (fields.stop_loss != null) {
    sets.push(`stop_loss = $${i++}`);
    params.push(fields.stop_loss);
  }
  if (fields.take_profit != null) {
    sets.push(`take_profit = $${i++}`);
    params.push(fields.take_profit);
  }
  if (sets.length === 0) return null;
  sets.push(`updated_at = NOW()`);
  const r = await client.query(
    `UPDATE positions SET ${sets.join(", ")}
     WHERE mode = $1 AND kraken_order_id = $2 AND status = 'open'
     RETURNING id`,
    params
  );
  return r.rows[0]?.id ?? null;
}

// ─── Phase D-5.12c — emergency audit log (post-Kraken-success persist fail) ─
// Durable record of DB persistence failures that occur AFTER Kraken has
// already accepted a real-money order. Operators reconstruct the lost
// row from this table. Helpers are added in D-5.12c but unused at end
// of phase — D-5.12d/e/f/g call-sites wire them when live persistence
// for OPEN_LONG / CLOSE_POSITION / SELL_ALL / SL / TP first lands.
//
// Concurrency primitive: emergency_audit_log.event_id UNIQUE (db-level).
// Idempotency contract: same canonical allowlisted payload within the
// same UTC second → same event_id → ON CONFLICT DO UPDATE appends to
// metadata.retry_history without overwriting attempted_payload or the
// first populated error_message.

// RFC-8785-style canonicalization (simplified): keys sorted lex at every
// level, null serialized as null (not omitted), arrays preserved in
// caller-provided order, numbers via JSON.stringify (no NaN/Infinity).
function _canonicalJsonSorted(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonicalJson: non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return "[" + value.map((v) => _canonicalJsonSorted(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + _canonicalJsonSorted(value[k])).join(",") + "}";
  }
  throw new Error(`canonicalJson: unsupported type ${typeof value}`);
}

// SHA-256 hex of the canonical-JSON serialization. Used for both the
// emergency event_id allowlisted payload AND the attempted_payload_hash
// surfaced inside attempted_payload for triage queries.
export function sha256HexCanonical(obj) {
  return crypto.createHash("sha256").update(_canonicalJsonSorted(obj)).digest("hex");
}

// Canonical emergency event_id. The "d512-emergency-" prefix gives a
// strong visual differentiation from trade_events.event_id (UUID-shaped)
// in operator queries. The caller MUST construct the allowlistedPayload
// per the v4 design recipe (mode, source, kraken_order_id-as-string-or-
// null, failure_class, attempted_payload_hash, timestamp_bucket as UTC
// ISO8601 truncated to 1 second).
export function buildEmergencyEventId(allowlistedPayload) {
  if (!allowlistedPayload || typeof allowlistedPayload !== "object") {
    throw new Error("buildEmergencyEventId: allowlistedPayload object required");
  }
  return "d512-emergency-" + sha256HexCanonical(allowlistedPayload);
}

// Postgres error classifier. D-5.12d's live OPEN_LONG handler will branch
// on the partial unique index `positions_one_open_per_mode_idx`; the
// kraken_order_id conflict branch is already absorbed inside
// upsertPositionOpen (post-conflict SELECT recovers the existing id).
// Anything else is generic and routes to db_persistence_failed.
export function classifyDbError(err) {
  if (!err || err.code !== "23505") return "other";
  const constraint = err.constraint ?? "";
  if (constraint === "positions_one_open_per_mode_idx") return "unique_violation_one_open_per_mode";
  if (constraint === "positions_kraken_order_unique" || constraint.includes("kraken_order_id")) {
    return "unique_violation_kraken_order_id";
  }
  return "other";
}

// INSERT with ON CONFLICT (event_id) DO UPDATE. Unlike insertTradeEvent's
// DO NOTHING, this APPENDS the caller's metadata.retry_history singleton
// to the existing array via jsonb_set, and backfills error_message only
// when the first attempt left it null. attempted_payload is INSERT-time-
// only — never overwritten on conflict. Returns the row id (always
// populated under DO UPDATE).
//
// Caller MUST pass a fresh inTransaction client. By the time this is
// invoked the original DB-persistence transaction has already rolled
// back AND released its client (db.js:55-69), so this helper cannot
// share that transaction.
export async function insertEmergencyAuditLog(client, event) {
  if (!client) throw new Error("insertEmergencyAuditLog: client required");
  if (!event || !event.event_id) throw new Error("insertEmergencyAuditLog: event.event_id required");
  if (!event.mode || !event.source || !event.failure_class) {
    throw new Error("insertEmergencyAuditLog: mode, source, failure_class required");
  }
  return client.query(
    `INSERT INTO emergency_audit_log (
       event_id, timestamp, mode, source, kraken_order_id,
       failure_class, error_message, attempted_payload, metadata
     ) VALUES (
       $1, COALESCE($2, NOW()), $3, $4, $5,
       $6, $7, $8, $9
     )
     ON CONFLICT (event_id) DO UPDATE SET
       metadata = jsonb_set(
         COALESCE(emergency_audit_log.metadata, '{}'::jsonb),
         '{retry_history}',
         COALESCE(emergency_audit_log.metadata->'retry_history', '[]'::jsonb)
           || COALESCE(EXCLUDED.metadata->'retry_history', '[]'::jsonb),
         true
       ),
       error_message = COALESCE(emergency_audit_log.error_message, EXCLUDED.error_message)
     RETURNING id`,
    [
      event.event_id,
      event.timestamp ?? null,
      event.mode,
      event.source,
      event.kraken_order_id ?? null,
      event.failure_class,
      event.error_message ?? null,
      event.attempted_payload ?? {},
      event.metadata ?? {},
    ]
  );
}

// ─── Phase D-5.8 — read-side helpers for dashboard flip ────────────────────
// Read-only domain queries used by dashboard.js's modeScopedSummary,
// getApiData, getHomeSummary, and buildV2DashboardPayload to surface
// trade history + positions + aggregates from Postgres instead of
// JSON/CSV. Each helper validates `mode` strictly so callers cannot
// silently mix paper/live data via a typo.

function _requireMode(fn, mode) {
  if (mode !== "paper" && mode !== "live") {
    throw new Error(`${fn}: mode must be 'paper' or 'live' (got ${JSON.stringify(mode)})`);
  }
}

// Returns the most recent trade lifecycle events for a mode, newest first.
// Phase C.1 — also includes manual_sl_update / manual_tp_update audit rows
// so the dashboard can surface operator-driven risk-level changes alongside
// lifecycle events. Excludes failed *_attempt rows (those are operational
// audit, not trade history). LEFT JOIN positions for entry-price context on
// EXIT rows.
export async function loadRecentTradeEvents(mode, limit = 30) {
  _requireMode("loadRecentTradeEvents", mode);
  const r = await query(
    `SELECT
       te.id, te.event_id, te.timestamp, te.mode, te.event_type, te.symbol,
       te.position_id, te.price, te.quantity, te.usd_amount,
       te.pnl_usd, te.pnl_pct, te.signal_score, te.signal_threshold,
       te.regime, te.leverage, te.kraken_order_id, te.decision_log,
       te.error, te.metadata,
       p.entry_price AS pos_entry_price, p.entry_time AS pos_entry_time
     FROM trade_events te
     LEFT JOIN positions p ON p.id = te.position_id
     WHERE te.mode = $1
       AND te.event_type IN ('buy_filled','exit_filled','manual_buy','manual_close','reentry_buy','reentry_close','manual_sl_update','manual_tp_update')
     ORDER BY te.timestamp DESC
     LIMIT $2`,
    [mode, limit]
  );
  return r.rows;
}

// Returns the (at most one) currently-open position for a mode, or null.
// Joined with the corresponding entry trade_event so callers have the
// open-event timestamp for UI context.
export async function loadOpenPosition(mode) {
  _requireMode("loadOpenPosition", mode);
  const r = await query(
    `SELECT p.id, p.mode, p.symbol, p.side, p.status,
            p.entry_price, p.entry_time, p.entry_signal_score,
            p.quantity, p.trade_size_usd, p.leverage, p.effective_size_usd,
            p.stop_loss, p.take_profit, p.volatility_level,
            p.kraken_order_id, p.metadata,
            te.event_id  AS open_event_id,
            te.timestamp AS open_event_ts
     FROM positions p
     LEFT JOIN trade_events te
            ON te.position_id = p.id
           AND te.event_type IN ('buy_filled','manual_buy','reentry_buy')
     WHERE p.mode = $1 AND p.status = 'open'
     ORDER BY p.entry_time DESC
     LIMIT 1`,
    [mode]
  );
  return r.rows[0] ?? null;
}

// Returns up to `limit` most-recently-closed positions for a mode,
// newest exit first. Used by Performance tab Recent Trades.
export async function loadClosedPositions(mode, limit = 30) {
  _requireMode("loadClosedPositions", mode);
  const r = await query(
    `SELECT id, mode, symbol, side, entry_price, entry_time, exit_price,
            exit_time, exit_reason, realized_pnl_usd, realized_pnl_pct,
            kraken_order_id, kraken_exit_order_id, leverage, trade_size_usd,
            metadata
     FROM positions
     WHERE mode = $1 AND status = 'closed'
     ORDER BY exit_time DESC
     LIMIT $2`,
    [mode, limit]
  );
  return r.rows;
}

// Aggregate realized P&L across all paper-or-live exit events.
// INCLUDES orphan exits (position_id IS NULL) — orphans are real
// closes whose source-data BUY chain wasn't fully recoverable, but the
// pnl_usd is real money. Operator can see orphan_exit_count separately.
// Returns numeric totalUSD (parsed from NUMERIC string by pg).
export async function loadPnLAggregates(mode) {
  _requireMode("loadPnLAggregates", mode);
  const r = await query(
    `SELECT
       count(*)::int                                                       AS exit_count,
       sum(pnl_usd)                                                        AS total_pnl_usd,
       count(*) FILTER (WHERE position_id IS NULL)::int                    AS orphan_exit_count
     FROM trade_events
     WHERE mode = $1
       AND event_type IN ('exit_filled','manual_close','reentry_close')`,
    [mode]
  );
  const row = r.rows[0];
  return {
    exitCount: row.exit_count,
    totalUSD: row.total_pnl_usd != null ? parseFloat(row.total_pnl_usd) : 0,
    orphanExitCount: row.orphan_exit_count,
  };
}

// ─── Phase D-5.10.2 — paper integrity guard helpers ────────────────────────
// Two trivial count queries used by bot.js's _paperConflictGuard. Both ride
// the existing positions_mode_status_idx BTREE for an index-only scan; the
// guard fires both in parallel via Promise.all in the calling cycle.
//
// Defined here (not inline in bot.js) so a future system_events / live-mode
// guard can reuse them without duplicating the SQL.

export async function countOpenPositions(mode) {
  _requireMode("countOpenPositions", mode);
  const r = await query(
    "SELECT count(*)::int AS c FROM positions WHERE mode = $1 AND status = 'open'",
    [mode]
  );
  return r.rows[0].c;
}

export async function countOrphanedPositions(mode) {
  _requireMode("countOrphanedPositions", mode);
  const r = await query(
    "SELECT count(*)::int AS c FROM positions WHERE mode = $1 AND status = 'orphaned'",
    [mode]
  );
  return r.rows[0].c;
}

// W/L counts for a mode. Same orphan-inclusive rule as loadPnLAggregates.
// Returns wins, losses, breakeven, total, and computed winRate (0–100
// percent or null when total=0).
export async function loadWinLossAggregates(mode) {
  _requireMode("loadWinLossAggregates", mode);
  const r = await query(
    `SELECT
       count(*) FILTER (WHERE pnl_usd > 0)::int   AS wins,
       count(*) FILTER (WHERE pnl_usd < 0)::int   AS losses,
       count(*) FILTER (WHERE pnl_usd = 0)::int   AS breakeven,
       count(*)::int                              AS total
     FROM trade_events
     WHERE mode = $1
       AND event_type IN ('exit_filled','manual_close','reentry_close')`,
    [mode]
  );
  const row = r.rows[0];
  const wins = row.wins, losses = row.losses;
  const decided = wins + losses;
  return {
    wins,
    losses,
    breakeven: row.breakeven,
    total: row.total,
    winRate: decided > 0 ? (wins / decided) * 100 : null,
  };
}

// ─── Phase D-5.9.1 — strategy_signals helpers ──────────────────────────────
// One row per bot cycle that evaluates a signal. Shadow-write only in this
// phase: bot.js calls insertStrategySignal after evalSignal() / before the
// decision branch. ON CONFLICT (mode, cycle_id) DO NOTHING makes retries a
// no-op (the partial unique index `strategy_signals_mode_cycle_unique`
// supplies the conflict target).
//
// Dashboard reads stay on safety-check-log.json until D-5.9.6. The
// loadRecentStrategySignals helper is defined here so the read flip is a
// pure dashboard.js change with no further db.js work.

// Build a deterministic cycle id from a stable seed. Used by callers that
// don't already have one. Default seed is a fresh timestamp+symbol pair.
export function buildCycleId(seed) {
  if (!seed) throw new Error("buildCycleId: seed required");
  return String(seed);
}

// INSERT ... ON CONFLICT (mode, cycle_id) DO NOTHING. Pool-level call (no
// surrounding transaction needed — single statement, no FK dependencies).
// Returns { id } of the inserted row, or undefined when a conflict skipped
// the insert. Throws on schema/connection failure; the bot.js caller
// catches and emits a [d-5.9.1 dual-write] warn line.
export async function insertStrategySignal(signal) {
  if (!signal || typeof signal !== "object") {
    throw new Error("insertStrategySignal: signal must be an object");
  }
  if (!signal.mode || (signal.mode !== "paper" && signal.mode !== "live")) {
    throw new Error(`insertStrategySignal: mode must be 'paper' or 'live' (got ${JSON.stringify(signal.mode)})`);
  }
  if (!signal.cycle_id) throw new Error("insertStrategySignal: cycle_id required");
  if (!signal.symbol)   throw new Error("insertStrategySignal: symbol required");
  if (signal.cycle_ts == null) throw new Error("insertStrategySignal: cycle_ts required");
  if (signal.price == null)    throw new Error("insertStrategySignal: price required");

  return query(
    `INSERT INTO strategy_signals (
       mode, cycle_id, symbol, timeframe, cycle_ts,
       signal_score, signal_threshold, signal_decision, decision_reason,
       all_pass, bullish_bias,
       price, rsi_3, rsi_14, ema_fast, vwap, atr_14,
       regime, volatility_level, spike_ratio, effective_lev,
       paper_trading,
       subscores, conditions, gates, v2_shadow,
       decision_log, metadata
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11,
       $12, $13, $14, $15, $16, $17,
       $18, $19, $20, $21,
       $22,
       $23, $24, $25, $26,
       $27, $28
     )
     ON CONFLICT (mode, cycle_id) DO NOTHING
     RETURNING id`,
    [
      signal.mode,
      String(signal.cycle_id),
      signal.symbol,
      signal.timeframe ?? null,
      signal.cycle_ts,
      signal.signal_score ?? null,
      signal.signal_threshold ?? null,
      signal.signal_decision ?? null,
      signal.decision_reason ?? null,
      signal.all_pass ?? null,
      signal.bullish_bias ?? null,
      signal.price,
      signal.rsi_3 ?? null,
      signal.rsi_14 ?? null,
      signal.ema_fast ?? null,
      signal.vwap ?? null,
      signal.atr_14 ?? null,
      signal.regime ?? null,
      signal.volatility_level ?? null,
      signal.spike_ratio ?? null,
      _coerceInt(signal.effective_lev),
      !!signal.paper_trading,
      // Phase D-5.9.1.1 — explicit JSON.stringify on every JSONB-bound param.
      // node-postgres auto-stringifies plain objects for JSONB columns but
      // routes JS arrays through its Postgres-array formatter (text[] / int[]
      // literals), which the JSONB column rejects with "invalid input syntax
      // for type json". `conditions` is the only array param here, but we
      // stringify all five for uniformity so a future caller adding an
      // array-shaped value to any JSONB field doesn't reintroduce the bug.
      JSON.stringify(signal.subscores  ?? {}),
      JSON.stringify(signal.conditions ?? []),
      JSON.stringify(signal.gates      ?? {}),
      JSON.stringify(signal.v2_shadow  ?? {}),
      signal.decision_log ?? null,
      JSON.stringify(signal.metadata ?? {}),
    ]
  );
}

// Returns up to `limit` most recent strategy_signals for a mode, newest first.
// Defined here for the D-5.9.6 cycle-stream read flip; not yet wired in
// D-5.9.1. JSON safety-check-log.json remains the dashboard source until
// the flip lands.
export async function loadRecentStrategySignals(mode, limit = 50) {
  _requireMode("loadRecentStrategySignals", mode);
  const r = await query(
    `SELECT id, mode, cycle_id, symbol, timeframe, cycle_ts,
            signal_score, signal_threshold, signal_decision, decision_reason,
            all_pass, bullish_bias,
            price, rsi_3, rsi_14, ema_fast, vwap, atr_14,
            regime, volatility_level, spike_ratio, effective_lev,
            paper_trading,
            subscores, conditions, gates, v2_shadow,
            decision_log, metadata, inserted_at
     FROM strategy_signals
     WHERE mode = $1
     ORDER BY cycle_ts DESC
     LIMIT $2`,
    [mode, limit]
  );
  return r.rows;
}

// ─── Phase D-5.10.5.2 — live halt dedup state on bot_control ────────────────
// bot_control row #1 records the most recent halt-reason streak. Two helpers:
//
//   recordLiveHaltState(phase, reason, detail) — called whenever a live cycle
//     halts. Reads current state; if (reason, detail) is unchanged, increments
//     count and advances last_seen_at silently. If changed (or first halt),
//     resets to a new streak. Returns { shouldAlert, transition, count }.
//     Caller (bot.js _emitLiveHaltAlert) uses shouldAlert to gate Discord.
//
//   clearLiveHaltState() — called after a successful live cycle (all gates
//     pass + reconciliation aligned). Returns { shouldAlert, previousReason }
//     so the caller can emit a single "all-clear" Discord on transition.
//
// Both helpers are isolation-light (single-row UPDATE on bot_control). They
// do not mutate paused/killed/leverage/risk_pct/etc. — only the new
// last_live_halt_* columns introduced by migration 004.

export async function recordLiveHaltState(phase, reason, detail) {
  if (!reason) throw new Error("recordLiveHaltState: reason required");
  const detailStr = detail == null ? null : String(detail);
  const phaseStr = phase == null ? null : String(phase);
  // Read current state in one round-trip with the UPDATE to avoid a race.
  // Step 1: read prior state.
  const prior = await query(
    `SELECT last_live_halt_reason, last_live_halt_detail, last_live_halt_count
     FROM bot_control WHERE id = 1`
  );
  const p = prior.rows[0] || {};
  const sameStreak =
    p.last_live_halt_reason === reason &&
    (p.last_live_halt_detail ?? null) === (detailStr ?? null);
  if (sameStreak) {
    // Continue existing streak silently.
    const r = await query(
      `UPDATE bot_control SET
         last_live_halt_last_seen_at = NOW(),
         last_live_halt_count        = COALESCE(last_live_halt_count, 0) + 1,
         updated_at                  = NOW()
       WHERE id = 1
       RETURNING last_live_halt_count`
    );
    return {
      shouldAlert: false,
      transition: "repeat",
      count: r.rows[0]?.last_live_halt_count ?? null,
    };
  }
  // New or transitioned streak — reset and alert.
  await query(
    `UPDATE bot_control SET
       last_live_halt_reason        = $1,
       last_live_halt_detail        = $2,
       last_live_halt_phase         = $3,
       last_live_halt_first_seen_at = NOW(),
       last_live_halt_last_seen_at  = NOW(),
       last_live_halt_count         = 1,
       updated_at                   = NOW()
     WHERE id = 1`,
    [reason, detailStr, phaseStr]
  );
  return {
    shouldAlert: true,
    transition: p.last_live_halt_reason ? "changed" : "new",
    count: 1,
  };
}

export async function clearLiveHaltState() {
  // Read prior state, clear it if any, return whether the operator should
  // see a single "all-clear" Discord. No-op when state is already clear.
  const prior = await query(
    `SELECT last_live_halt_reason FROM bot_control WHERE id = 1`
  );
  const previousReason = prior.rows[0]?.last_live_halt_reason ?? null;
  if (!previousReason) {
    return { shouldAlert: false, previousReason: null };
  }
  await query(
    `UPDATE bot_control SET
       last_live_halt_reason        = NULL,
       last_live_halt_detail        = NULL,
       last_live_halt_phase         = NULL,
       last_live_halt_first_seen_at = NULL,
       last_live_halt_last_seen_at  = NOW(),
       last_live_halt_count         = 0,
       updated_at                   = NOW()
     WHERE id = 1`
  );
  return { shouldAlert: true, previousReason };
}

// ─── Phase D-5.10.5.4 — Kraken API key permission probe cache ──────────────
// Two helpers: getKrakenPermCheckState() reads the cache; recordKrakenPermCheck()
// writes the result after each probe. The cache lives on bot_control row #1
// so it survives container restarts, deploys, and bot.js process churn (every
// cycle is a fresh process; in-memory state can't persist).
//
// Cache semantics:
//   - kraken_perm_check_at IS NULL                → never probed (cold cache)
//   - kraken_perm_check_at IS NOT NULL, ok = TRUE  → cached pass; bot.js skips probe
//   - kraken_perm_check_at IS NOT NULL, ok = FALSE → cached fail; bot.js re-probes
//                                                    every cycle until pass
//
// Operator manual flush: UPDATE bot_control SET
//   kraken_perm_check_at = NULL,
//   kraken_perm_check_ok = NULL,
//   kraken_perm_check_reason = NULL,
//   kraken_perm_check_detail = NULL
// WHERE id = 1;

export async function getKrakenPermCheckState() {
  const r = await query(
    `SELECT kraken_perm_check_at, kraken_perm_check_ok,
            kraken_perm_check_reason, kraken_perm_check_detail
     FROM bot_control WHERE id = 1`
  );
  const row = r.rows[0];
  if (!row || row.kraken_perm_check_at == null) return null;
  return {
    at:     row.kraken_perm_check_at,
    ok:     row.kraken_perm_check_ok,
    reason: row.kraken_perm_check_reason,
    detail: row.kraken_perm_check_detail,
  };
}

export async function recordKrakenPermCheck(ok, reason, detail) {
  const reasonStr = reason == null ? null : String(reason);
  const detailStr = detail == null ? null : String(detail);
  await query(
    `UPDATE bot_control SET
       kraken_perm_check_at      = NOW(),
       kraken_perm_check_ok      = $1,
       kraken_perm_check_reason  = $2,
       kraken_perm_check_detail  = $3,
       updated_at                = NOW()
     WHERE id = 1`,
    [!!ok, reasonStr, detailStr]
  );
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
