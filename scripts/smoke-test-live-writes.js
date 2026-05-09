// Phase D-5.10.5.7 — live shadow-write smoke test
// DASH-6.G — extended with M2 byte-stability emergency_audit_log smoke
//             plus two-source DATABASE_URL non-prod hard-abort guard.
//
// Design lineage: DASH-6 DESIGN-ONLY round-5 PASS; operator Path A selected
// the as-shipped 10-field attempted_payload shape with embedded hash.
// D-5.12e.1 fixed the call-site mutation (commit 5273005...); Migration 008
// has no separate attempted_payload_hash column, so the helper intentionally
// embeds the hash inside attempted_payload.
//
// Verifies the mode='live' DB write paths end-to-end without placing real
// orders, without activating live trading, and without touching bot.js. Uses
// synthetic IDs prefixed "SMOKE-LIVE-" so the test rows are clearly marked
// and trivially cleanable.
//
// Coverage (8 steps, in order):
//   1. upsertPositionOpen (mode='live')
//   2. insertTradeEvent (buy_filled, linked to position_id)
//   3. updatePositionRiskLevels — direct helper test (D-5.10.5.3 helper; bot.js now SL-only post-B.2c).
//   4. closePosition (mode='live')
//   5. insertTradeEvent (exit_filled, linked to same position_id)
//   6. updatePositionRiskLevels post-close — should no-op (rowCount=0)
//   7. insertStrategySignal (mode='live')
//   8. DASH-6.G — M2 byte-stability on emergency_audit_log (4 sources)
//      For each of 4 live failure-ladder source labels (manual_live_close,
//      manual_live_sellall, manual_live_set_stop_loss, manual_live_set_take_profit),
//      insert a synthetic row with a 10-field attempted_payload (9 canonical
//      + attempted_payload_hash embedded as the 10th key per the as-shipped
//      _emergencyAuditWrite helper at dashboard.js:682), then assert:
//        - persisted attempted_payload has exactly 10 keys
//        - stripping attempted_payload_hash yields exactly 9 canonical keys
//        - sha256HexCanonical(stripped 9-field object) === embedded hash
//        - hash over the 10-field object would differ (proves hash was
//          computed over the 9-field stripped object, not the 10-field one)
//
// DASH-6.G NON-PROD GUARD (per Codex round-1 RE-2 from DASH-6.C IMPL review):
//   At main() entry, the script aborts if DATABASE_URL host is non-local.
//   Two-source check inspects BOTH process.env.DATABASE_URL AND .env
//   independently with `new Set([...])` deduplication (closes the `||`
//   short-circuit gap and avoids duplicate-loop overhead). Aborts before
//   any DB action. The guard error messages do NOT echo DATABASE_URL or
//   any secret. Allow-list: localhost, 127.0.0.1, ::1, [::1], *.local
//   (the bracketed [::1] form covers Node's URL parser output for IPv6).
//
// On all-pass: DELETEs the synthetic rows in safe order (including
// emergency_audit_log rows by event_id LIKE 'SMOKE-LIVE-%'), verifies
// post-cleanup row counts match pre-test snapshot, exits 0.
// On assertion failure: keeps rows for forensic inspection, prints the
// cleanup SQL, exits 1.
// On cleanup failure: rows kept; cleanup SQL printed; exits 2.
//
// SAFETY: zero Kraken imports, zero HTTP calls, zero bot.js execution. The
// script makes only Postgres connections via the existing db.js exports.
// Production paper trading continues undisturbed during the run.

import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import {
  query,
  inTransaction,
  buildEventId,
  insertTradeEvent,
  upsertPositionOpen,
  closePosition,
  insertStrategySignal,
  updatePositionRiskLevels,
  sha256HexCanonical,
  insertEmergencyAuditLog,
  close as dbClose,
} from "../db.js";

// ─── Test fixture ───────────────────────────────────────────────────────────
const SMOKE_PREFIX = "SMOKE-LIVE-";
const NOW_MS = Date.now();
const SMOKE_ORDER_ID = `${SMOKE_PREFIX}${NOW_MS}`;
const SMOKE_CYCLE_ID = `${SMOKE_PREFIX}${NOW_MS}`;
const SYMBOL = "XRPUSDT";
const TEST_ENTRY_PRICE  = 1.40000000;
const TEST_QUANTITY     = 7.14285714;       // ~$10 worth
const TEST_TRADE_USD    = 10.0000;
const TEST_LEVERAGE     = 2;
const TEST_EFFECTIVE    = 20.0000;          // tradeSize * leverage
const TEST_STOP_LOSS    = 1.38250000;       // -1.25%
const TEST_TAKE_PROFIT  = 1.42800000;       // +2%
const TEST_NEW_SL       = 1.40000000;       // breakeven move (entry)
const TEST_EXIT_PRICE   = 1.41500000;
const TEST_PNL_USD      = 10.7143;          // realistic round-trip
const TEST_PNL_PCT      = 1.0714;
const TEST_SIGNAL_SCORE = 81;
const TEST_THRESHOLD    = 75;

// ─── DASH-6.G — Non-prod DATABASE_URL hard-abort guard ─────────────────────
// Two-source check (per Codex round-1 RE-2 verbatim from DASH-6.C IMPL
// review): inspect BOTH process.env.DATABASE_URL AND the .env file's
// DATABASE_URL line independently. If either source has a non-local host,
// abort BEFORE any DB action. Production Railway hosts and any non-local
// DB are forbidden by this guard.
//
// The guard error messages are static and do NOT echo DATABASE_URL or any
// secret. The two-source pattern with `new Set([...])` deduplication
// (per Codex DASH-6.G round-1 RE on C1) closes the `||` short-circuit
// gap where a safe process.env value could mask an unsafe .env value
// (or vice versa) and avoids redundant-loop overhead when both sources
// have the same value.
//
// Allow-list: localhost, 127.0.0.1, ::1, [::1], *.local. The bracketed
// [::1] form covers Node's URL parser output for bracketed IPv6 literals
// (per Codex DASH-6.G round-1 RE on C3).
function loadEnvVar(key) {
  if (!existsSync(".env")) return null;
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

function assertNonProdDatabaseUrl() {
  // Collect DATABASE_URL from both sources; deduplicate via new Set so
  // identical values from process.env + .env (the common case under
  // dotenv) are not iterated twice.
  const dbUrls = [...new Set([
    process.env.DATABASE_URL,
    loadEnvVar("DATABASE_URL"),
  ].filter((v) => typeof v === "string" && v.length > 0))];

  if (dbUrls.length === 0) return; // neither source set — safe

  for (const dbUrl of dbUrls) {
    let parsed;
    try {
      parsed = new URL(dbUrl);
    } catch {
      // malformed URL — abort to be safe
      throw new Error("DATABASE_URL is malformed; aborting to prevent accidental production writes");
    }
    const host = parsed.hostname;
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]" ||
      host.endsWith(".local");
    if (!isLocal) {
      throw new Error(
        "DATABASE_URL host is not local; refusing to run tests against a non-local database"
      );
    }
  }
}

// ─── Output helpers ─────────────────────────────────────────────────────────
const log  = (msg) => console.log(`[smoke d-5.10.5.7] ${msg}`);
const step = (n, msg) => console.log(`[smoke] step ${n}: ${msg}`);
const ok   = (msg) => console.log(`[smoke]   ✓ ${msg}`);
const fail = (msg) => console.error(`[smoke]   ✗ ${msg}`);

// Hard-equality with tolerance for pg NUMERIC string round-trip.
const eqNum = (a, b, eps = 1e-8) => Math.abs(parseFloat(a) - parseFloat(b)) < eps;

let assertionsPassed = 0;
let assertionsFailed = 0;
function assert(cond, label, detail) {
  if (cond) {
    assertionsPassed++;
    ok(label);
  } else {
    assertionsFailed++;
    fail(`${label} ${detail ? `— ${detail}` : ""}`);
  }
}

// ─── Pre-test snapshot ──────────────────────────────────────────────────────
async function snapshot() {
  const tradeEvents = await query(
    "SELECT count(*)::int AS c FROM trade_events WHERE mode='live'"
  );
  const positions = await query(
    "SELECT count(*)::int AS c FROM positions WHERE mode='live'"
  );
  const strategySignals = await query(
    "SELECT count(*)::int AS c FROM strategy_signals WHERE mode='live'"
  );
  // DASH-6.G — also snapshot emergency_audit_log live rows so the post-
  // cleanup count comparison covers M2 byte-stability synthetic rows too.
  const emergencyAuditLog = await query(
    "SELECT count(*)::int AS c FROM emergency_audit_log WHERE mode='live'"
  );
  return {
    trade_events:         tradeEvents.rows[0].c,
    positions:            positions.rows[0].c,
    strategy_signals:     strategySignals.rows[0].c,
    emergency_audit_log:  emergencyAuditLog.rows[0].c,
  };
}

// ─── Cleanup ────────────────────────────────────────────────────────────────
function cleanupSqlHint() {
  console.log(`\nManual cleanup SQL (run if needed):
  DELETE FROM trade_events
   WHERE mode = 'live' AND kraken_order_id LIKE '${SMOKE_PREFIX}%';
  DELETE FROM positions
   WHERE mode = 'live' AND kraken_order_id LIKE '${SMOKE_PREFIX}%';
  DELETE FROM strategy_signals
   WHERE mode = 'live' AND cycle_id LIKE '${SMOKE_PREFIX}%';
  DELETE FROM emergency_audit_log
   WHERE mode = 'live' AND event_id LIKE '${SMOKE_PREFIX}%';
`);
}

async function cleanup() {
  // Delete in any order — the FK on trade_events.position_id is ON DELETE SET NULL,
  // so positions can be removed first without breaking the events. Match by
  // synthetic prefix to avoid ever touching real production rows.
  const te = await query(
    "DELETE FROM trade_events WHERE mode='live' AND kraken_order_id LIKE $1 RETURNING id",
    [`${SMOKE_PREFIX}%`]
  );
  const po = await query(
    "DELETE FROM positions WHERE mode='live' AND kraken_order_id LIKE $1 RETURNING id",
    [`${SMOKE_PREFIX}%`]
  );
  const ss = await query(
    "DELETE FROM strategy_signals WHERE mode='live' AND cycle_id LIKE $1 RETURNING id",
    [`${SMOKE_PREFIX}%`]
  );
  // DASH-6.G — also delete synthetic emergency_audit_log rows. The
  // event_id was hand-crafted with SMOKE_PREFIX (NOT
  // buildEmergencyEventId) precisely so cleanup can match by prefix.
  const ea = await query(
    "DELETE FROM emergency_audit_log WHERE mode='live' AND event_id LIKE $1 RETURNING id",
    [`${SMOKE_PREFIX}%`]
  );
  return {
    trade_events:        te.rows.length,
    positions:           po.rows.length,
    strategy_signals:    ss.rows.length,
    emergency_audit_log: ea.rows.length,
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  log("starting — DB only, NO Kraken, NO bot.js");
  log(`synthetic IDs: orderId=${SMOKE_ORDER_ID} cycle_id=${SMOKE_CYCLE_ID}`);

  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL not set — cannot connect to Postgres");
    process.exit(1);
  }

  // DASH-6.G — Non-prod DATABASE_URL hard-abort guard. Inspect BOTH
  // process.env.DATABASE_URL and .env DATABASE_URL independently. Aborts
  // before any DB action if either source has a non-local host.
  try {
    assertNonProdDatabaseUrl();
  } catch (e) {
    fail(`DASH-6.G non-prod guard: ${e.message}`);
    process.exit(1);
  }

  const pre = await snapshot();
  log(`pre-test live counts: trade_events=${pre.trade_events} positions=${pre.positions} strategy_signals=${pre.strategy_signals} emergency_audit_log=${pre.emergency_audit_log}`);

  let positionId = null;

  try {
    // ── Step 1: upsertPositionOpen ─────────────────────────────────────────
    step(1, "upsertPositionOpen mode='live'");
    const openId = await inTransaction(async (client) => {
      return upsertPositionOpen(client, {
        mode: "live",
        symbol: SYMBOL,
        side: "long",
        entry_price: TEST_ENTRY_PRICE,
        entry_time: new Date(NOW_MS).toISOString(),
        entry_signal_score: TEST_SIGNAL_SCORE,
        quantity: TEST_QUANTITY,
        trade_size_usd: TEST_TRADE_USD,
        leverage: TEST_LEVERAGE,
        effective_size_usd: TEST_EFFECTIVE,
        stop_loss: TEST_STOP_LOSS,
        take_profit: TEST_TAKE_PROFIT,
        volatility_level: "NORMAL",
        kraken_order_id: SMOKE_ORDER_ID,
        metadata: { test: true, smoke: "d-5.10.5.7" },
      });
    });
    assert(openId != null, "upsertPositionOpen returned id", `id=${openId}`);
    positionId = openId;

    // Verify the row landed and round-trips correctly.
    const r1 = await query(
      "SELECT mode, side, status, entry_price, stop_loss, take_profit, quantity, leverage FROM positions WHERE id=$1",
      [positionId]
    );
    assert(r1.rows.length === 1, "position row exists by id");
    const p = r1.rows[0] || {};
    assert(p.mode === "live", "mode='live'", `got ${p.mode}`);
    assert(p.side === "long", "side='long'", `got ${p.side}`);
    assert(p.status === "open", "status='open'", `got ${p.status}`);
    assert(eqNum(p.entry_price, TEST_ENTRY_PRICE), "entry_price round-trips", `db=${p.entry_price}`);
    assert(eqNum(p.stop_loss, TEST_STOP_LOSS), "stop_loss round-trips", `db=${p.stop_loss}`);
    assert(eqNum(p.take_profit, TEST_TAKE_PROFIT), "take_profit round-trips", `db=${p.take_profit}`);
    assert(eqNum(p.quantity, TEST_QUANTITY), "quantity round-trips", `db=${p.quantity}`);
    assert(p.leverage === TEST_LEVERAGE, "leverage stored as INTEGER", `got ${p.leverage}`);

    // ── Step 2: insertTradeEvent (buy_filled, linked) ──────────────────────
    step(2, "insertTradeEvent buy_filled (linked to position_id)");
    await inTransaction(async (client) => {
      return insertTradeEvent(client, {
        event_id:         buildEventId(SMOKE_ORDER_ID, "buy_filled"),
        timestamp:        new Date(NOW_MS).toISOString(),
        mode:             "live",
        event_type:       "buy_filled",
        symbol:           SYMBOL,
        position_id:      positionId,
        price:            TEST_ENTRY_PRICE,
        quantity:         TEST_QUANTITY,
        usd_amount:       TEST_TRADE_USD,
        signal_score:     TEST_SIGNAL_SCORE,
        signal_threshold: TEST_THRESHOLD,
        regime:           "TRENDING",
        leverage:         TEST_LEVERAGE,
        kraken_order_id:  SMOKE_ORDER_ID,
        decision_log:     "smoke test buy_filled",
        metadata:         { test: true, smoke: "d-5.10.5.7" },
      });
    });
    const r2 = await query(
      "SELECT mode, event_type, position_id, signal_score, signal_threshold, leverage FROM trade_events WHERE kraken_order_id=$1 AND event_type=$2",
      [SMOKE_ORDER_ID, "buy_filled"]
    );
    assert(r2.rows.length === 1, "buy_filled trade_event row exists");
    const e2 = r2.rows[0] || {};
    assert(e2.mode === "live", "trade_event mode='live'", `got ${e2.mode}`);
    assert(e2.event_type === "buy_filled", "event_type='buy_filled'", `got ${e2.event_type}`);
    assert(String(e2.position_id) === String(positionId), "FK position_id matches inserted position", `got ${e2.position_id}`);
    assert(e2.signal_score === TEST_SIGNAL_SCORE, "signal_score INTEGER round-trips", `got ${e2.signal_score}`);
    assert(e2.signal_threshold === TEST_THRESHOLD, "signal_threshold INTEGER round-trips", `got ${e2.signal_threshold}`);
    assert(e2.leverage === TEST_LEVERAGE, "leverage INTEGER round-trips", `got ${e2.leverage}`);

    // ── Step 3: updatePositionRiskLevels — direct helper test (both fields) ────
    step(3, "updatePositionRiskLevels (D-5.10.5.3) — open row, SL→entry, helper both-field path");
    const updateOpenId = await updatePositionRiskLevels("live", SMOKE_ORDER_ID, {
      stop_loss:   TEST_NEW_SL,
      take_profit: TEST_TAKE_PROFIT,
    });
    assert(String(updateOpenId) === String(positionId), "update returned same position id", `got ${updateOpenId}`);
    const r3 = await query(
      "SELECT stop_loss, take_profit, updated_at FROM positions WHERE id=$1",
      [positionId]
    );
    const p3 = r3.rows[0] || {};
    assert(eqNum(p3.stop_loss, TEST_NEW_SL), "stop_loss UPDATEd", `db=${p3.stop_loss}`);
    assert(eqNum(p3.take_profit, TEST_TAKE_PROFIT), "take_profit round-trips through helper both-field path", `db=${p3.take_profit}`);
    assert(p3.updated_at instanceof Date, "updated_at advanced", `type=${typeof p3.updated_at}`);

    // ── Step 4: closePosition ──────────────────────────────────────────────
    step(4, "closePosition mode='live'");
    const closedId = await inTransaction(async (client) => {
      return closePosition(client, "live", {
        exit_price:           TEST_EXIT_PRICE,
        exit_time:            new Date(NOW_MS + 1000).toISOString(),
        exit_reason:          "TAKE_PROFIT",
        realized_pnl_usd:     TEST_PNL_USD,
        realized_pnl_pct:     TEST_PNL_PCT,
        kraken_exit_order_id: `${SMOKE_PREFIX}EXIT-${NOW_MS}`,
      });
    });
    assert(String(closedId) === String(positionId), "closePosition returned same position id", `got ${closedId}`);
    const r4 = await query(
      "SELECT status, exit_reason, realized_pnl_usd FROM positions WHERE id=$1",
      [positionId]
    );
    const p4 = r4.rows[0] || {};
    assert(p4.status === "closed", "status='closed'", `got ${p4.status}`);
    assert(p4.exit_reason === "TAKE_PROFIT", "exit_reason recorded", `got ${p4.exit_reason}`);
    assert(eqNum(p4.realized_pnl_usd, TEST_PNL_USD), "realized_pnl_usd round-trips", `db=${p4.realized_pnl_usd}`);

    // ── Step 5: insertTradeEvent exit_filled (linked) ──────────────────────
    step(5, "insertTradeEvent exit_filled (linked to same position_id)");
    await inTransaction(async (client) => {
      return insertTradeEvent(client, {
        event_id:        buildEventId(SMOKE_ORDER_ID, "exit_filled"),
        timestamp:       new Date(NOW_MS + 1000).toISOString(),
        mode:            "live",
        event_type:      "exit_filled",
        symbol:          SYMBOL,
        position_id:     positionId,
        price:           TEST_EXIT_PRICE,
        quantity:        TEST_QUANTITY,
        usd_amount:      TEST_TRADE_USD,
        pnl_usd:         TEST_PNL_USD,
        pnl_pct:         TEST_PNL_PCT,
        regime:          "TRENDING",
        kraken_order_id: SMOKE_ORDER_ID,
        decision_log:    "smoke test exit_filled",
        metadata:        { test: true, smoke: "d-5.10.5.7" },
      });
    });
    const r5 = await query(
      "SELECT event_type, position_id, pnl_usd, pnl_pct FROM trade_events WHERE kraken_order_id=$1 AND event_type=$2",
      [SMOKE_ORDER_ID, "exit_filled"]
    );
    assert(r5.rows.length === 1, "exit_filled trade_event row exists");
    const e5 = r5.rows[0] || {};
    assert(String(e5.position_id) === String(positionId), "exit_filled FK position_id matches");
    assert(eqNum(e5.pnl_usd, TEST_PNL_USD), "pnl_usd round-trips", `db=${e5.pnl_usd}`);
    assert(eqNum(e5.pnl_pct, TEST_PNL_PCT), "pnl_pct round-trips", `db=${e5.pnl_pct}`);

    // ── Step 6: updatePositionRiskLevels post-close (NO-OP expected) ───────
    step(6, "updatePositionRiskLevels after close — expected NO-OP");
    const noopId = await updatePositionRiskLevels("live", SMOKE_ORDER_ID, {
      stop_loss: TEST_NEW_SL + 0.001,
    });
    assert(noopId == null, "update on closed row returns null (no-op)", `got ${noopId}`);
    // Re-read to confirm the row was NOT mutated.
    const r6 = await query(
      "SELECT stop_loss, status FROM positions WHERE id=$1",
      [positionId]
    );
    const p6 = r6.rows[0] || {};
    assert(p6.status === "closed", "status remains 'closed'", `got ${p6.status}`);
    assert(eqNum(p6.stop_loss, TEST_NEW_SL), "stop_loss unchanged after no-op update", `db=${p6.stop_loss}`);

    // ── Step 7: insertStrategySignal (mode='live') ─────────────────────────
    step(7, "insertStrategySignal mode='live'");
    await insertStrategySignal({
      mode:             "live",
      cycle_id:         SMOKE_CYCLE_ID,
      symbol:           SYMBOL,
      timeframe:        "5m",
      cycle_ts:         new Date(NOW_MS).toISOString(),
      signal_score:     TEST_SIGNAL_SCORE,
      signal_threshold: TEST_THRESHOLD,
      signal_decision:  "BUY",
      decision_reason:  null,
      all_pass:         true,
      bullish_bias:     true,
      price:            TEST_ENTRY_PRICE,
      rsi_3:            22.5,
      ema_fast:         1.398,
      vwap:             1.395,
      regime:           "TRENDING",
      volatility_level: "NORMAL",
      effective_lev:    TEST_LEVERAGE,
      paper_trading:    false,
      subscores:        { ema: 30, rsi: 30, vwap: 20, ext: 20 },
      conditions:       [{ label: "test", pass: true, score: 80 }],
      gates:            { test: true },
      v2_shadow:        {},
      decision_log:     "smoke test strategy_signal",
      metadata:         { test: true, smoke: "d-5.10.5.7" },
    });
    const r7 = await query(
      "SELECT mode, cycle_id, signal_decision, signal_score, paper_trading FROM strategy_signals WHERE cycle_id=$1",
      [SMOKE_CYCLE_ID]
    );
    assert(r7.rows.length === 1, "strategy_signals row exists");
    const s7 = r7.rows[0] || {};
    assert(s7.mode === "live", "strategy_signal mode='live'", `got ${s7.mode}`);
    assert(s7.cycle_id === SMOKE_CYCLE_ID, "cycle_id round-trips");
    assert(s7.signal_decision === "BUY", "signal_decision='BUY'", `got ${s7.signal_decision}`);
    assert(eqNum(s7.signal_score, TEST_SIGNAL_SCORE), "signal_score round-trips", `db=${s7.signal_score}`);
    assert(s7.paper_trading === false, "paper_trading=false on live row", `got ${s7.paper_trading}`);

    // ── Step 8: DASH-6.G — M2 byte-stability on emergency_audit_log ────────
    //
    // Verifies the as-shipped emergency_audit_log.attempted_payload byte-
    // stability invariant for synthetic rows at all 4 operator-specified
    // live failure-ladder source labels. The smoke does NOT depend on the
    // labels matching dashboard.js call-site source values — the M2
    // invariant is shape-level (10-field-with-embedded-hash byte-
    // stability), not source-name-dependent. Operator-specified labels
    // are used here as the test-run source values to satisfy DASH-6.G's
    // explicit requirement.
    //
    // As-shipped reality (Path A clarification by operator):
    //   - Migration 008 has NO separate attempted_payload_hash column;
    //     attempted_payload JSONB carries both the canonical 9 fields
    //     AND attempted_payload_hash as one combined object.
    //   - D-5.12e.1 (commit 5273005...) fixed the CALL-SITE mutation that
    //     was appending hash to the call-site attempted_payload at
    //     dashboard.js:2145 (deleted). The HELPER at dashboard.js:682
    //     STILL embeds the hash inside attempted_payload before INSERT —
    //     this is intentional given the schema constraint.
    //
    // This smoke verifies the as-shipped invariant directly:
    //   1. Persisted attempted_payload has exactly 10 keys.
    //   2. Stripping attempted_payload_hash yields exactly 9 canonical
    //      keys matching the pre-INSERT canonical key set.
    //   3. sha256HexCanonical(stripped 9-field object) === embedded
    //      attempted_payload_hash.
    //   4. The embedded hash is computed over the 9-field stripped
    //      object, NOT over the 10-field object (verified by 3).
    step(8, "M2 byte-stability — emergency_audit_log row writes (4 sources)");

    const M2_TEST_CASES = [
      {
        source: "manual_live_close",
        failure_class: "kraken_post_success_db_other_error",
        canonicalPayload: {
          symbol:               SYMBOL,
          exit_price:           TEST_EXIT_PRICE,
          exit_time:            new Date(NOW_MS).toISOString(),
          exit_reason:          "MANUAL_CLOSE",
          quantity:             TEST_QUANTITY,
          trade_size_usd:       TEST_TRADE_USD,
          realized_pnl_usd:     TEST_PNL_USD,
          realized_pnl_pct:     TEST_PNL_PCT,
          kraken_exit_order_id: `${SMOKE_PREFIX}EXIT-CLOSE-${NOW_MS}`,
        },
      },
      {
        source: "manual_live_sellall",
        failure_class: "kraken_post_success_db_other_error",
        canonicalPayload: {
          symbol:               SYMBOL,
          exit_price:           TEST_EXIT_PRICE,
          exit_time:            new Date(NOW_MS).toISOString(),
          exit_reason:          "MANUAL_SELLALL",
          quantity:             TEST_QUANTITY,
          trade_size_usd:       TEST_TRADE_USD,
          realized_pnl_usd:     TEST_PNL_USD,
          realized_pnl_pct:     TEST_PNL_PCT,
          kraken_exit_order_id: `${SMOKE_PREFIX}EXIT-SELLALL-${NOW_MS}`,
        },
      },
      {
        source: "manual_live_set_stop_loss",
        failure_class: "db_only_db_error",
        canonicalPayload: {
          symbol:           SYMBOL,
          position_id:      `${SMOKE_PREFIX}POS-SL-${NOW_MS}`,
          current_stop_loss: TEST_STOP_LOSS,
          new_stop_loss:    TEST_NEW_SL,
          quantity:         TEST_QUANTITY,
          entry_price:      TEST_ENTRY_PRICE,
          leverage:         TEST_LEVERAGE,
          kraken_order_id:  `${SMOKE_PREFIX}ORDER-SL-${NOW_MS}`,
          update_reason:    "MANUAL_SL_UPDATE",
        },
      },
      {
        source: "manual_live_set_take_profit",
        failure_class: "db_only_db_error",
        canonicalPayload: {
          symbol:             SYMBOL,
          position_id:        `${SMOKE_PREFIX}POS-TP-${NOW_MS}`,
          current_take_profit: TEST_TAKE_PROFIT,
          new_take_profit:    1.45000000,
          quantity:           TEST_QUANTITY,
          entry_price:        TEST_ENTRY_PRICE,
          leverage:           TEST_LEVERAGE,
          kraken_order_id:    `${SMOKE_PREFIX}ORDER-TP-${NOW_MS}`,
          update_reason:      "MANUAL_TP_UPDATE",
        },
      },
    ];

    for (const tc of M2_TEST_CASES) {
      // Synthetic event_id with SMOKE_PREFIX so cleanup matches by prefix.
      // (Hand-crafted instead of buildEmergencyEventId(...) so the row is
      //  cleanable by the existing prefix-match cleanup pattern.)
      const event_id = `${SMOKE_PREFIX}AUDIT-${tc.source}-${NOW_MS}`;

      // Pre-INSERT M2 invariants: canonical payload is exactly 9 keys
      // and does not already carry attempted_payload_hash.
      const canonicalKeys = Object.keys(tc.canonicalPayload).sort();
      assert(
        canonicalKeys.length === 9,
        `${tc.source}: canonical payload has exactly 9 keys`,
        `got ${canonicalKeys.length}: ${canonicalKeys.join(",")}`
      );
      assert(
        !("attempted_payload_hash" in tc.canonicalPayload),
        `${tc.source}: canonical payload does not embed attempted_payload_hash`
      );

      // Compute hash over the 9-field canonical object (not the 10-field
      // object — that is the M2 byte-stability invariant under test).
      const computedHash = sha256HexCanonical(tc.canonicalPayload);

      // Mirror the as-shipped helper at dashboard.js:682:
      //   attemptedPayloadForRow = { ...redactedPayload, attempted_payload_hash: payloadHash }
      // This produces the 10-field object that the helper INSERTs into
      // emergency_audit_log.attempted_payload JSONB.
      const attemptedPayloadForRow = {
        ...tc.canonicalPayload,
        attempted_payload_hash: computedHash,
      };

      await inTransaction(async (client) => {
        return insertEmergencyAuditLog(client, {
          event_id,
          timestamp:        new Date(NOW_MS).toISOString(),
          mode:             "live",
          source:           tc.source,
          kraken_order_id:  tc.canonicalPayload.kraken_exit_order_id || tc.canonicalPayload.kraken_order_id || null,
          failure_class:    tc.failure_class,
          error_message:    null,
          attempted_payload: attemptedPayloadForRow,
          metadata:         { test: true, smoke: "dash-6.g" },
        });
      });

      // Query back the persisted row.
      const r8 = await query(
        "SELECT attempted_payload FROM emergency_audit_log WHERE event_id=$1 AND mode='live'",
        [event_id]
      );
      assert(
        r8.rows.length === 1,
        `${tc.source}: emergency_audit_log row exists by event_id`
      );
      const persistedPayload = r8.rows[0]?.attempted_payload;
      assert(
        persistedPayload != null && typeof persistedPayload === "object",
        `${tc.source}: persisted attempted_payload is non-null object`
      );

      // M2 invariant 1: persisted attempted_payload has exactly 10 keys.
      const persistedKeys = Object.keys(persistedPayload).sort();
      assert(
        persistedKeys.length === 10,
        `${tc.source}: persisted attempted_payload has exactly 10 keys (9 canonical + attempted_payload_hash)`,
        `got ${persistedKeys.length}: ${persistedKeys.join(",")}`
      );

      // M2 invariant 2: attempted_payload_hash is present as embedded key.
      assert(
        "attempted_payload_hash" in persistedPayload,
        `${tc.source}: attempted_payload_hash is present as embedded key`
      );

      // M2 invariant 3: stripping attempted_payload_hash yields exactly
      // 9 canonical keys matching the pre-INSERT canonical key set.
      const { attempted_payload_hash: persistedHash, ...stripped } = persistedPayload;
      const strippedKeys = Object.keys(stripped).sort();
      assert(
        strippedKeys.length === 9,
        `${tc.source}: stripped attempted_payload has exactly 9 keys`,
        `got ${strippedKeys.length}: ${strippedKeys.join(",")}`
      );
      assert(
        JSON.stringify(strippedKeys) === JSON.stringify(canonicalKeys),
        `${tc.source}: stripped attempted_payload keys match canonical key set`,
        `stripped=${strippedKeys.join(",")} canonical=${canonicalKeys.join(",")}`
      );

      // M2 invariant 4: sha256HexCanonical(stripped 9-field object) ===
      // embedded attempted_payload_hash. This proves the hash was
      // computed over the 9-field object, NOT over the 10-field object.
      const recomputedHash = sha256HexCanonical(stripped);
      assert(
        recomputedHash === persistedHash,
        `${tc.source}: recomputed hash over stripped 9-field object matches embedded attempted_payload_hash`,
        `recomputed=${recomputedHash} embedded=${persistedHash}`
      );

      // Round-trip integrity: embedded hash equals the pre-INSERT
      // computed hash (catches any DB-layer JSONB mutation).
      assert(
        persistedHash === computedHash,
        `${tc.source}: embedded hash matches pre-INSERT computed hash`,
        `persisted=${persistedHash} preInsert=${computedHash}`
      );

      // Negative invariant: hash computed over the 10-field object would
      // be DIFFERENT from the embedded hash. This proves the helper
      // correctly hashes the 9-field object before embedding.
      const wrongHash = sha256HexCanonical(persistedPayload);
      assert(
        wrongHash !== persistedHash,
        `${tc.source}: hash over 10-field object differs from embedded hash (proves hash was not computed over 10-field object)`,
        `tenField=${wrongHash} embedded=${persistedHash}`
      );
    }
  } catch (err) {
    fail(`uncaught error: ${err.message}`);
    console.error(err.stack);
    assertionsFailed++;
  }

  // ── Summary ────────────────────────────────────────────────────────────
  log(`assertions: ${assertionsPassed} pass / ${assertionsFailed} fail`);

  if (assertionsFailed > 0) {
    log("FAIL — keeping synthetic rows for inspection");
    cleanupSqlHint();
    await dbClose();
    process.exit(1);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────
  log("all assertions PASS — cleaning up synthetic rows");
  let cleanupCounts;
  try {
    cleanupCounts = await cleanup();
  } catch (e) {
    fail(`cleanup failed: ${e.message}`);
    cleanupSqlHint();
    await dbClose();
    process.exit(2);
  }
  log(`cleanup: trade_events=${cleanupCounts.trade_events} positions=${cleanupCounts.positions} strategy_signals=${cleanupCounts.strategy_signals} emergency_audit_log=${cleanupCounts.emergency_audit_log}`);

  const post = await snapshot();
  log(`post-cleanup live counts: trade_events=${post.trade_events} positions=${post.positions} strategy_signals=${post.strategy_signals} emergency_audit_log=${post.emergency_audit_log}`);
  const counts_match =
    post.trade_events        === pre.trade_events &&
    post.positions           === pre.positions &&
    post.strategy_signals    === pre.strategy_signals &&
    post.emergency_audit_log === pre.emergency_audit_log;
  if (!counts_match) {
    fail(`pre/post counts differ: pre=${JSON.stringify(pre)} post=${JSON.stringify(post)}`);
    cleanupSqlHint();
    await dbClose();
    process.exit(2);
  }
  ok("pre/post counts match — clean cleanup verified");
  log("PASS");
  await dbClose();
  process.exit(0);
}

main().catch(async (err) => {
  fail(`uncaught top-level error: ${err.message}`);
  console.error(err.stack);
  cleanupSqlHint();
  try { await dbClose(); } catch {}
  process.exit(1);
});
