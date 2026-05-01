// Phase SV2-5 — offline Strategy V2 position simulator.
//
// State machine that consumes a chronologically-sorted 5m candle stream
// and a signal stream (from ./signal.js) and produces a list of
// completed-or-incomplete trade records. R-multiple accounting only;
// position sizing in currency is deferred to SV2-6+.
//
// State machine
// -------------
//   FLAT     no position is open
//   OPEN     entry filled, no TPs hit yet, original SL active
//   TP1_HIT  TP1 hit; 70% closed at TP1; runner (30%) trades with BE-SL
//   CLOSED   terminal per-trade state (only used internally; no global state
//            persists between trades — after each close we go back to FLAT)
//
// Entry semantics
// ---------------
// At each 5m bar i in FLAT state, look up `signalsByTs.get(candles5m[i].ts)`.
// If a signal is found, fill at `candles5m[i].open` (the bar's open). The
// signal's `entryTriggerTs` was set by the combiner to (pullback5mTs +
// FIVE_MIN_MS), which equals exactly this bar's open timestamp.
//
// SL derivation (placeholder; live SL logic intentionally NOT used)
// -----------------------------------------------------------------
// SL = bosLegLow × (1 − slBufferPct)
// where bosLegLow = min(low) over candles5m[bosIdx−bosLookback .. bosIdx−1]
// and bosIdx = the 5m candle whose ts matches signal.bos5mTs.
//
// risk_per_unit = entry − SL  (must be > 0; degenerate trades are skipped)
// TP1 = entry + tp1RR × risk_per_unit       (default 1.0R)
// TP2 = entry + tp2RR × risk_per_unit       (default 2.0R)
//
// Same-bar fill priority (conservative, per parent design SV2-0 §8)
// ------------------------------------------------------------------
// Pre-TP1: if a single bar's low ≤ initialSl AND its high ≥ tp1 → SL FIRST
//          (the worst-case for the trader; understates strategy edge).
// Post-TP1: if a single bar's low ≤ entry AND its high ≥ tp2 → BE-SL FIRST.
// These rules apply across the entry bar as well (intra-entry-bar fills).
//
// Concurrency
// -----------
// At most one position open at a time. Signals at later bars are silently
// skipped while a position is open — no queuing, no overlap.
//
// End-of-data
// -----------
// If a position is still open at the last candle, close at that candle's
// close, mark `outcome: "incomplete"` and `incomplete: true`. Realized R
// includes the mark-to-market on whichever fraction was still open.
//
// SAFETY CONTRACT
// ---------------
// 1. No imports outside backtest/**. Only sibling-feature import:
//    DEFAULT_BOS_LOOKBACK from ./features/bos-5m.js (a constant).
// 2. No I/O. No env vars. No clock reads. No global state.
// 3. Deterministic given the same inputs.
// 4. No bot.js / db.js / dashboard.js / Postgres / Kraken access.
// 5. Cannot place real orders. Cannot mutate `bot_control` or
//    `position.json`. R-multiple accounting only.
// 6. Live SL/TP logic from manageActiveTrade is NOT imported and NOT used.

import { DEFAULT_BOS_LOOKBACK } from "./features/bos-5m.js";

export const STATE = Object.freeze({
  FLAT:     "FLAT",
  OPEN:     "OPEN",
  TP1_HIT:  "TP1_HIT",
  CLOSED:   "CLOSED",
});

export const OUTCOMES = Object.freeze({
  SL_FULL:           "sl_full",
  TP1_THEN_BE_SL:    "tp1_then_be_sl",
  TP1_THEN_TP2:      "tp1_then_tp2",
  INCOMPLETE:        "incomplete",
});

export const DEFAULT_SIMULATOR_CONFIG = Object.freeze({
  bosLookback:  DEFAULT_BOS_LOOKBACK,   // matches signal combiner's bos.lookback
  slBufferPct:  0.005,                  // 0.5% below bosLegLow
  tp1RR:        1.0,
  tp2RR:        2.0,
  tp1ClosePct:  0.7,
  tp2ClosePct:  0.3,
});

// ─── Public API ────────────────────────────────────────────────────────────
export function simulate({ candles5m, signals } = {}, options = {}) {
  if (!Array.isArray(candles5m)) throw new TypeError("simulate: candles5m must be an array");
  if (!Array.isArray(signals))   throw new TypeError("simulate: signals must be an array");
  const cfg = mergeConfig(options);
  if (candles5m.length === 0) return [];
  validateCandles(candles5m);
  validateSignals(signals);

  // Index signals by entryTriggerTs for O(1) lookup at each bar.
  const signalsByTs = new Map();
  for (const s of signals) signalsByTs.set(s.entryTriggerTs, s);

  const trades = [];
  let openTrade = null;
  let state = STATE.FLAT;

  for (let i = 0; i < candles5m.length; i++) {
    const c = candles5m[i];

    // FLAT: try to enter on this bar.
    if (state === STATE.FLAT) {
      const sig = signalsByTs.get(c.ts);
      if (sig) {
        const entryAttempt = openEntry(candles5m, i, sig, cfg);
        if (entryAttempt) {
          openTrade = entryAttempt;
          state = STATE.OPEN;
          // Fall through to evaluate intra-entry-bar SL/TP1.
        }
      }
    }

    // OPEN: check SL and TP1 against this bar.
    if (state === STATE.OPEN) {
      const closed = stepOpen(c, openTrade);
      if (closed === "sl_full") {
        finalizeAndPush(openTrade, trades);
        openTrade = null;
        state = STATE.FLAT;
        continue;
      }
      if (closed === "tp1_hit") {
        // Promote to TP1_HIT and re-evaluate same bar for BE-SL/TP2.
        state = STATE.TP1_HIT;
      }
    }

    // TP1_HIT: check BE-SL and TP2 against this bar.
    if (state === STATE.TP1_HIT) {
      const closed = stepTp1Hit(c, openTrade);
      if (closed) {
        finalizeAndPush(openTrade, trades);
        openTrade = null;
        state = STATE.FLAT;
      }
    }
  }

  // End-of-data: incomplete trade (still open).
  if (openTrade) {
    const lastBar = candles5m[candles5m.length - 1];
    closeIncomplete(openTrade, lastBar);
    finalizeAndPush(openTrade, trades);
  }
  return trades;
}

// ─── Trade lifecycle ───────────────────────────────────────────────────────
function openEntry(candles, i, signal, cfg) {
  // Recover BOS bar index from the signal.
  const bosIdx = findCandleIdxByTs(candles, signal.bos5mTs);
  if (bosIdx === -1) return null;

  // Compute bosLegLow over the prior `bosLookback` 5m bars.
  if (bosIdx < cfg.bosLookback) return null;
  let bosLegLow = Infinity;
  for (let k = bosIdx - cfg.bosLookback; k < bosIdx; k++) {
    if (candles[k].low < bosLegLow) bosLegLow = candles[k].low;
  }
  if (!Number.isFinite(bosLegLow)) return null;

  const entryPrice = candles[i].open;
  const initialSl  = bosLegLow * (1 - cfg.slBufferPct);
  const riskPerUnit = entryPrice - initialSl;
  if (riskPerUnit <= 0) return null;     // degenerate; skip

  const tp1Price = entryPrice + cfg.tp1RR * riskPerUnit;
  const tp2Price = entryPrice + cfg.tp2RR * riskPerUnit;

  return {
    signal,
    signalTs:    signal.ts,
    entryTs:     candles[i].ts,
    entryBarIdx: i,
    entryPrice,
    initialSl,
    bosLegLow,
    tp1Price,
    tp2Price,
    riskPerUnit,
    tp1ClosePct: cfg.tp1ClosePct,
    tp2ClosePct: cfg.tp2ClosePct,
    fills:       [],
    tp1Ts:  null,
    tp2Ts:  null,
    slTs:   null,
    beSlTs: null,
    exitTs: null,
    exitPrice: null,
    exitBarIdx: null,
    outcome: null,
    incomplete: false,
  };
}

function stepOpen(c, t) {
  const slHit  = c.low  <= t.initialSl;
  const tp1Hit = c.high >= t.tp1Price;
  // Same-bar SL+TP1: SL FIRST per parent design.
  if (slHit) {
    t.fills.push({ ts: c.ts, price: t.initialSl, fraction: 1.0, label: "sl" });
    t.slTs       = c.ts;
    t.exitTs     = c.ts;
    t.exitPrice  = t.initialSl;
    t.outcome    = OUTCOMES.SL_FULL;
    return "sl_full";
  }
  if (tp1Hit) {
    t.fills.push({ ts: c.ts, price: t.tp1Price, fraction: t.tp1ClosePct, label: "tp1" });
    t.tp1Ts = c.ts;
    return "tp1_hit";
  }
  return null;
}

function stepTp1Hit(c, t) {
  const beSlHit = c.low  <= t.entryPrice;
  const tp2Hit  = c.high >= t.tp2Price;
  // Same-bar BE-SL+TP2: BE-SL FIRST per parent design.
  if (beSlHit) {
    t.fills.push({ ts: c.ts, price: t.entryPrice, fraction: t.tp2ClosePct, label: "be_sl" });
    t.beSlTs    = c.ts;
    t.exitTs    = c.ts;
    t.exitPrice = t.entryPrice;
    t.outcome   = OUTCOMES.TP1_THEN_BE_SL;
    return true;
  }
  if (tp2Hit) {
    t.fills.push({ ts: c.ts, price: t.tp2Price, fraction: t.tp2ClosePct, label: "tp2" });
    t.tp2Ts     = c.ts;
    t.exitTs    = c.ts;
    t.exitPrice = t.tp2Price;
    t.outcome   = OUTCOMES.TP1_THEN_TP2;
    return true;
  }
  return false;
}

function closeIncomplete(t, lastBar) {
  // If we never hit TP1, the entire position closes mark-to-market at last close.
  // If we hit TP1, the runner closes mark-to-market at last close.
  if (t.tp1Ts == null) {
    t.fills.push({ ts: lastBar.ts, price: lastBar.close, fraction: 1.0, label: "incomplete" });
  } else {
    t.fills.push({ ts: lastBar.ts, price: lastBar.close, fraction: t.tp2ClosePct, label: "incomplete_runner" });
  }
  t.exitTs    = lastBar.ts;
  t.exitPrice = lastBar.close;
  t.outcome   = OUTCOMES.INCOMPLETE;
  t.incomplete = true;
}

function finalizeAndPush(t, trades) {
  // Compute realized R as the sum over each fill's contribution:
  //   fill.fraction × (fill.price − entry) / riskPerUnit
  let realizedR = 0;
  for (const f of t.fills) {
    realizedR += f.fraction * (f.price - t.entryPrice) / t.riskPerUnit;
  }
  // Compute bar count.
  const exitBarTs = t.exitTs ?? t.entryTs;
  const bars = Math.max(0, Math.round((exitBarTs - t.entryTs) / (5 * 60 * 1000)));
  trades.push({
    signalTs:    t.signalTs,
    signal:      t.signal,
    entryTs:     t.entryTs,
    entryPrice:  t.entryPrice,
    initialSl:   t.initialSl,
    bosLegLow:   t.bosLegLow,
    tp1Price:    t.tp1Price,
    tp2Price:    t.tp2Price,
    riskPerUnit: t.riskPerUnit,
    riskPct:     t.signal.riskPct,
    tier:        t.signal.tier,
    tp1Ts:       t.tp1Ts,
    tp2Ts:       t.tp2Ts,
    slTs:        t.slTs,
    beSlTs:      t.beSlTs,
    exitTs:      t.exitTs,
    exitPrice:   t.exitPrice,
    outcome:     t.outcome,
    incomplete:  t.incomplete,
    realizedR,
    bars,
    fills:       t.fills.slice(),
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function findCandleIdxByTs(candles, ts) {
  // Binary search; candles array must be sorted by ts ascending.
  let lo = 0, hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = candles[mid].ts;
    if (t === ts) return mid;
    if (t < ts) lo = mid + 1;
    else        hi = mid - 1;
  }
  return -1;
}

function mergeConfig(options) {
  const cfg = { ...DEFAULT_SIMULATOR_CONFIG, ...(options || {}) };
  if (!Number.isInteger(cfg.bosLookback) || cfg.bosLookback <= 0) {
    throw new RangeError(`bosLookback must be a positive integer, got ${cfg.bosLookback}`);
  }
  if (!Number.isFinite(cfg.slBufferPct) || cfg.slBufferPct < 0 || cfg.slBufferPct >= 1) {
    throw new RangeError(`slBufferPct must be in [0, 1), got ${cfg.slBufferPct}`);
  }
  if (!Number.isFinite(cfg.tp1RR) || cfg.tp1RR <= 0) {
    throw new RangeError(`tp1RR must be positive, got ${cfg.tp1RR}`);
  }
  if (!Number.isFinite(cfg.tp2RR) || cfg.tp2RR <= cfg.tp1RR) {
    throw new RangeError(`tp2RR (${cfg.tp2RR}) must be > tp1RR (${cfg.tp1RR})`);
  }
  if (!Number.isFinite(cfg.tp1ClosePct) || cfg.tp1ClosePct <= 0 || cfg.tp1ClosePct >= 1) {
    throw new RangeError(`tp1ClosePct must be in (0, 1), got ${cfg.tp1ClosePct}`);
  }
  if (!Number.isFinite(cfg.tp2ClosePct) || cfg.tp2ClosePct <= 0 || cfg.tp2ClosePct >= 1) {
    throw new RangeError(`tp2ClosePct must be in (0, 1), got ${cfg.tp2ClosePct}`);
  }
  if (Math.abs(cfg.tp1ClosePct + cfg.tp2ClosePct - 1.0) > 1e-9) {
    throw new RangeError(`tp1ClosePct + tp2ClosePct must equal 1.0, got ${cfg.tp1ClosePct + cfg.tp2ClosePct}`);
  }
  return cfg;
}

function validateCandles(candles) {
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!c || typeof c !== "object") {
      throw new TypeError(`simulate: candle[${i}] is not an object`);
    }
    if (!Number.isFinite(c.ts) || !Number.isFinite(c.open)
        || !Number.isFinite(c.high) || !Number.isFinite(c.low) || !Number.isFinite(c.close)) {
      throw new TypeError(`simulate: candle[${i}] has non-finite ts/open/high/low/close`);
    }
  }
}

function validateSignals(signals) {
  for (let i = 0; i < signals.length; i++) {
    const s = signals[i];
    if (!s || typeof s !== "object") {
      throw new TypeError(`simulate: signal[${i}] is not an object`);
    }
    if (!Number.isFinite(s.entryTriggerTs) || !Number.isFinite(s.bos5mTs)) {
      throw new TypeError(`simulate: signal[${i}] missing finite entryTriggerTs/bos5mTs`);
    }
    if (!Number.isFinite(s.riskPct)) {
      throw new TypeError(`simulate: signal[${i}] missing finite riskPct`);
    }
    if (typeof s.tier !== "string") {
      throw new TypeError(`simulate: signal[${i}] missing string tier`);
    }
  }
}
