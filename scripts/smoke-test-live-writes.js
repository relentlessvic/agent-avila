// Phase D-5.10.5.7 — live shadow-write smoke test
//
// Verifies the mode='live' DB write paths end-to-end without placing real
// orders, without activating live trading, and without touching bot.js. Uses
// synthetic IDs prefixed "SMOKE-LIVE-" so the test rows are clearly marked
// and trivially cleanable.
//
// Coverage (7 helper paths, in order):
//   1. upsertPositionOpen (mode='live')
//   2. insertTradeEvent (buy_filled, linked to position_id)
//   3. updatePositionRiskLevels — direct helper test (D-5.10.5.3 helper; bot.js now SL-only post-B.2c).
//   4. closePosition (mode='live')
//   5. insertTradeEvent (exit_filled, linked to same position_id)
//   6. updatePositionRiskLevels post-close — should no-op (rowCount=0)
//   7. insertStrategySignal (mode='live')
//
// On all-pass: DELETEs the synthetic rows in safe order, verifies post-cleanup
// row counts match pre-test snapshot, exits 0.
// On assertion failure: keeps rows for forensic inspection, prints the
// cleanup SQL, exits 1.
// On cleanup failure: rows kept; cleanup SQL printed; exits 2.
//
// SAFETY: zero Kraken imports, zero HTTP calls, zero bot.js execution. The
// script makes only Postgres connections via the existing db.js exports.
// Production paper trading continues undisturbed during the run.

import "dotenv/config";
import {
  query,
  inTransaction,
  buildEventId,
  insertTradeEvent,
  upsertPositionOpen,
  closePosition,
  insertStrategySignal,
  updatePositionRiskLevels,
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
  return {
    trade_events:     tradeEvents.rows[0].c,
    positions:        positions.rows[0].c,
    strategy_signals: strategySignals.rows[0].c,
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
  return {
    trade_events:     te.rows.length,
    positions:        po.rows.length,
    strategy_signals: ss.rows.length,
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

  const pre = await snapshot();
  log(`pre-test live counts: trade_events=${pre.trade_events} positions=${pre.positions} strategy_signals=${pre.strategy_signals}`);

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
  log(`cleanup: trade_events=${cleanupCounts.trade_events} positions=${cleanupCounts.positions} strategy_signals=${cleanupCounts.strategy_signals}`);

  const post = await snapshot();
  log(`post-cleanup live counts: trade_events=${post.trade_events} positions=${post.positions} strategy_signals=${post.strategy_signals}`);
  const counts_match =
    post.trade_events     === pre.trade_events &&
    post.positions        === pre.positions &&
    post.strategy_signals === pre.strategy_signals;
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
