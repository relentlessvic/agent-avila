// Phase D-5.10.5.8.1 — canned `(db, venue)` fixture pairs for the
// reconciliation comparator. One fixture per verdict tier the comparator
// can produce. The test runner (scripts/test-reconciliation.js) replays
// these against `reconcile(...)` and asserts the expected verdict.
//
// All fixtures use a frozen `now` so staleness checks are deterministic.
// All venue snapshots include a `fetchedAt` ISO timestamp; freshness
// is computed relative to FROZEN_NOW.

export const FROZEN_NOW = "2026-05-01T19:00:00.000Z";

// Helper: produce a venue snapshot with a "matching, healthy" XRPUSD long
// position so each fixture can override a single field for its scenario.
function baseVenue(overrides = {}) {
  return {
    source: "mock",
    mode: "live",
    fetchedAt: FROZEN_NOW,
    position: {
      txid: "TXR12345",
      pair: "XRPUSD",
      side: "buy",
      volume: 10.0,
      volumeClosed: 0.0,
      cost: 13.96,
      fee: 0.05,
      value: 14.00,
      net: 0.04,
      leverage: 3,
      terms: "30 day",
      entryPrice: 1.396,
      linkedOrderTxids: ["OENTRY-001"],
    },
    workingOrders: {
      stopLoss: {
        orderId: "OSL-001",
        pair: "XRPUSD",
        ordertype: "stop-loss",
        price: 1.380,
        volume: 10.0,
      },
      takeProfit: {
        orderId: "OTP-001",
        pair: "XRPUSD",
        ordertype: "take-profit",
        price: 1.420,
        volume: 10.0,
      },
    },
    ...overrides,
  };
}

function baseDb(overrides = {}) {
  return {
    id: 99,
    mode: "live",
    symbol: "XRPUSD",
    side: "long",
    leverage: 3,
    quantity: 10.0,
    entry_price: 1.396,
    stop_loss: 1.380,
    take_profit: 1.420,
    kraken_order_id: "OENTRY-001",
    kraken_sl_order_id: "OSL-001",
    kraken_tp_order_id: "OTP-001",
    status: "open",
    ...overrides,
  };
}

export const FIXTURES = Object.freeze({
  // ─── Baseline: everything matches → OK ─────────────────────────────────
  ok_baseline: {
    description: "Healthy live position with all fields matching",
    db: baseDb(),
    venue: baseVenue(),
    expected: "OK",
  },

  // ─── Paper-shadow: no position on either side ─────────────────────────
  ok_paper_flat_both_sides: {
    description: "Paper-mode DB row, no venue position; trivial OK",
    db: baseDb({ mode: "paper", status: "closed" }),
    venue: {
      source: "mock",
      mode: "paper",
      fetchedAt: FROZEN_NOW,
      position: null,
      workingOrders: { stopLoss: null, takeProfit: null },
    },
    expected: "OK",
  },

  // ─── HALTs ────────────────────────────────────────────────────────────
  halt_mode_mismatch: {
    description: "DB says paper, venue snapshot is live",
    db: baseDb({ mode: "paper" }),
    venue: baseVenue(),
    expected: "HALT",
  },
  catastrophic_symbol_mismatch: {
    description: "DB symbol XRPUSD vs venue symbol ETHUSD",
    db: baseDb(),
    venue: baseVenue({ position: { ...baseVenue().position, pair: "ETHUSD" } }),
    expected: "CATASTROPHIC",
  },
  catastrophic_side_mismatch: {
    description: "DB long vs venue sell (short)",
    db: baseDb(),
    venue: baseVenue({ position: { ...baseVenue().position, side: "sell" } }),
    expected: "CATASTROPHIC",
  },
  halt_leverage_mismatch: {
    description: "DB leverage 3 vs venue leverage 5",
    db: baseDb({ leverage: 3 }),
    venue: baseVenue({ position: { ...baseVenue().position, leverage: 5 } }),
    expected: "HALT",
  },
  halt_quantity_drift: {
    description: "DB qty 10.0 vs venue qty 9.5 (5% drift, beyond 0.5% tolerance)",
    db: baseDb({ quantity: 10.0 }),
    venue: baseVenue({ position: { ...baseVenue().position, volume: 9.5 } }),
    expected: "HALT",
  },
  halt_order_id_linkage_broken: {
    description: "DB kraken_order_id=OENTRY-001 vs venue txid=OOTHER",
    db: baseDb({ kraken_order_id: "OENTRY-001" }),
    venue: baseVenue({ position: { ...baseVenue().position, txid: "OOTHER", linkedOrderTxids: [] } }),
    expected: "HALT",
  },
  catastrophic_sl_missing_with_capture: {
    description: "DB has kraken_sl_order_id captured but venue working SL is gone",
    db: baseDb(),
    venue: baseVenue({ workingOrders: { stopLoss: null, takeProfit: baseVenue().workingOrders.takeProfit } }),
    expected: "CATASTROPHIC",
  },
  warn_sl_missing_no_capture: {
    description: "DB has SL set but no kraken_sl_order_id captured (8.3 deferred); venue SL absent → WARN advisory",
    db: baseDb({ kraken_sl_order_id: null }),
    venue: baseVenue({ workingOrders: { stopLoss: null, takeProfit: baseVenue().workingOrders.takeProfit } }),
    expected: "WARN",
  },
  halt_sl_price_drift: {
    description: "DB SL=$1.380 vs venue SL=$1.350 (~2.2% drift, beyond 0.1% tolerance)",
    db: baseDb({ stop_loss: 1.380 }),
    venue: baseVenue({
      workingOrders: {
        stopLoss: { ...baseVenue().workingOrders.stopLoss, price: 1.350 },
        takeProfit: baseVenue().workingOrders.takeProfit,
      },
    }),
    expected: "HALT",
  },
  halt_stale_snapshot: {
    description: "Snapshot fetchedAt is 45 minutes before FROZEN_NOW (> 30min halt threshold)",
    db: baseDb(),
    venue: baseVenue({ fetchedAt: "2026-05-01T18:15:00.000Z" }),
    expected: "HALT",
  },

  // ─── WARNs ────────────────────────────────────────────────────────────
  warn_entry_price_drift: {
    description: "DB entry $1.396 vs venue $1.410 (~1% drift, beyond 0.5% tolerance)",
    db: baseDb({ entry_price: 1.396 }),
    venue: baseVenue({ position: { ...baseVenue().position, entryPrice: 1.410 } }),
    expected: "WARN",
  },
  warn_tp_missing: {
    description: "DB has TP set, venue has no TP working order",
    db: baseDb(),
    venue: baseVenue({
      workingOrders: {
        stopLoss: baseVenue().workingOrders.stopLoss,
        takeProfit: null,
      },
    }),
    expected: "WARN",
  },
  warn_tp_price_drift: {
    description: "DB TP=$1.420 vs venue TP=$1.450 (~2% drift, beyond 0.1% tolerance)",
    db: baseDb({ take_profit: 1.420 }),
    venue: baseVenue({
      workingOrders: {
        stopLoss: baseVenue().workingOrders.stopLoss,
        takeProfit: { ...baseVenue().workingOrders.takeProfit, price: 1.450 },
      },
    }),
    expected: "WARN",
  },
  warn_stale_snapshot_short: {
    description: "Snapshot fetchedAt is 7 minutes before FROZEN_NOW (> 5min warn, < 30min halt)",
    db: baseDb(),
    venue: baseVenue({ fetchedAt: "2026-05-01T18:53:00.000Z" }),
    expected: "WARN",
  },
});
