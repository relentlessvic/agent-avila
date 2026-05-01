// Phase SV2-4 — offline Strategy V2 signal combiner.
//
// Composes the four already-committed feature modules into a single
// long-only entry-trigger event stream:
//
//     classifyTrend4h    →  4h bias (UP / DOWN / NEUTRAL / INSUFFICIENT_DATA)
//     detectSweeps15m    →  per-15m bullish liquidity-sweep flag
//     detectBos5m        →  per-5m bullish break-of-structure flag
//     detectPullbacks5m  →  per-5m fib-zone pullback annotation
//
// A signal is emitted on a 5m bar i when ALL of the following hold:
//
//   1. Trend at the latest completed 4h bar (close ≤ bar_i close) is UP.
//   2. There is a bullish 15m sweep whose close is at-or-before the BOS
//      bar's close, and within `sweepToBosWindowMs` ms before the BOS.
//   3. There is a bullish 5m BOS at some j < i within
//      `pullback.bosHorizon` bars before i (the "active BOS" for this i).
//   4. The pullback annotation at bar i is `IN_PULLBACK_ZONE`
//      (the leg has not been invalidated and the candle range overlaps
//      the [fib79, fib50] zone).
//
// Tier rule (conservative per spec):
//
//   tier = "perfect"   if (i - bosIdx) ≤ cleanWindowBars   (default 6)
//   tier = "standard"  otherwise
//
//   No leg-invalidation check is required for "perfect" because the
//   pullback module already filters that out — a bar with `inPullbackZone`
//   true has by definition not been invalidated.
//
// One signal per BOS context. Subsequent same-zone bars under the same
// BOS do not re-emit; the trigger is the FIRST in-zone bar.
//
// Output signal:
//   {
//     ts:              number,         // = entryTriggerTs (next 5m bar's open ts)
//     side:            "long",
//     trend4hTs:       number,         // ts of the latest UP 4h bar at signal time
//     sweep15mTs:      number,         // ts of the bullish sweep that triggered
//     bos5mTs:         number,         // ts of the bullish BOS that triggered
//     pullback5mTs:    number,         // ts of the pullback bar
//     entryTriggerTs:  number,         // pullback5mTs + FIVE_MIN_MS
//     tier:            "perfect" | "standard",
//     riskPct:         number,         // 0.015 perfect | 0.01 standard
//     reason:          "all_conditions_met"
//   }
//
// SAFETY CONTRACT
// ---------------
// 1. No imports outside backtest/**. Only sibling-feature imports.
// 2. No I/O. No env vars. No clock reads. No global state.
// 3. Look-ahead protection: each higher-TF lookup uses only completed
//    bars (close_ts ≤ current 5m bar's close_ts). Each per-TF feature
//    module is itself look-ahead-safe (verified in their own tests).
// 4. Deterministic: same inputs → identical signal arrays.
// 5. No simulator. No risk manager. No trade execution. No position
//    sizing. No order placement. No DB or Kraken access.

import { classifyTrend4h, TREND_UP, DEFAULT_TREND_CONFIG } from "./features/trend-4h.js";
import { detectSweeps15m, DEFAULT_SWEEP_LOOKBACK } from "./features/sweep-15m.js";
import { detectBos5m, DEFAULT_BOS_LOOKBACK } from "./features/bos-5m.js";
import { detectPullbacks5m, DEFAULT_PULLBACK_CONFIG } from "./features/pullback-5m.js";

export const FIVE_MIN_MS    = 5  * 60 * 1000;
export const FIFTEEN_MIN_MS = 15 * 60 * 1000;
export const FOUR_HOUR_MS   = 4  * 60 * 60 * 1000;

export const DEFAULT_SIGNAL_CONFIG = Object.freeze({
  trend: { ...DEFAULT_TREND_CONFIG },
  sweep: { lookback: DEFAULT_SWEEP_LOOKBACK },
  bos:   { lookback: DEFAULT_BOS_LOOKBACK },
  pullback: {
    bosHorizon: DEFAULT_PULLBACK_CONFIG.bosHorizon,
    fibLowerPct: DEFAULT_PULLBACK_CONFIG.fibLowerPct,
    fibUpperPct: DEFAULT_PULLBACK_CONFIG.fibUpperPct,
  },
  sweepToBosWindowMs: 60 * 60 * 1000,   // 60 minutes
  cleanWindowBars:    6,                // pullback within 6 5m bars after BOS = "perfect"
  perfectRiskPct:     0.015,            // matches strategy_v2.json risk.perfectPct
  standardRiskPct:    0.01,             // matches strategy_v2.json risk.standardPct
});

// ─── Public API ────────────────────────────────────────────────────────────
export function combineSignals({ candles5m, candles15m, candles4h } = {}, options = {}) {
  if (!Array.isArray(candles5m))  throw new TypeError("combineSignals: candles5m must be an array");
  if (!Array.isArray(candles15m)) throw new TypeError("combineSignals: candles15m must be an array");
  if (!Array.isArray(candles4h))  throw new TypeError("combineSignals: candles4h must be an array");

  const cfg = mergeConfig(options);
  if (candles5m.length === 0) return [];

  // Run all four feature modules. Each is look-ahead-safe.
  const trend4h     = classifyTrend4h(candles4h, cfg.trend);
  const sweeps15m   = detectSweeps15m(candles15m, cfg.sweep);
  const bos5m       = detectBos5m(candles5m, cfg.bos);
  const pullbacks5m = detectPullbacks5m(candles5m, {
    bosLookback: cfg.bos.lookback,
    bosHorizon:  cfg.pullback.bosHorizon,
    fibLowerPct: cfg.pullback.fibLowerPct,
    fibUpperPct: cfg.pullback.fibUpperPct,
  });

  const signals = [];
  const emittedBosIdxes = new Set();

  // Forward-walking pointers into the higher-TF arrays. They advance
  // monotonically as we walk the 5m stream. Both sentinels start at -1
  // ("no completed higher-TF bar yet").
  let trend4hPtr  = -1;
  let sweep15mPtr = -1;

  for (let i = 0; i < candles5m.length; i++) {
    const bar5mCloseTs = candles5m[i].ts + FIVE_MIN_MS;

    // Advance trend4hPtr to the latest 4h bar whose close ≤ bar5mCloseTs.
    while (trend4hPtr + 1 < candles4h.length
           && candles4h[trend4hPtr + 1].ts + FOUR_HOUR_MS <= bar5mCloseTs) {
      trend4hPtr++;
    }
    // Same for sweep15m.
    while (sweep15mPtr + 1 < candles15m.length
           && candles15m[sweep15mPtr + 1].ts + FIFTEEN_MIN_MS <= bar5mCloseTs) {
      sweep15mPtr++;
    }

    // Pullback gate (cheapest dominant filter).
    const pb = pullbacks5m[i];
    if (!pb.inPullbackZone) continue;

    // Find the active BOS for this pullback by walking back through bos5m.
    // (The pullback module references this exact BOS internally; we recover
    // its index here so we can emit it in the signal.)
    let bosIdx = -1;
    const horizonMin = Math.max(0, i - cfg.pullback.bosHorizon);
    for (let j = i - 1; j >= horizonMin; j--) {
      if (bos5m[j].bos === true) { bosIdx = j; break; }
    }
    if (bosIdx === -1) continue;            // shouldn't happen, defensive
    if (emittedBosIdxes.has(bosIdx)) continue;

    // Trend gate.
    if (trend4hPtr === -1) continue;
    const t4h = trend4h[trend4hPtr];
    if (t4h.trend !== TREND_UP) continue;

    // Sweep gate: most recent bullish 15m sweep before BOS, within window.
    const bosCloseTs = candles5m[bosIdx].ts + FIVE_MIN_MS;
    let sweepIdx = -1;
    for (let k = sweep15mPtr; k >= 0; k--) {
      if (!sweeps15m[k].swept) continue;
      const sweepCloseTs = candles15m[k].ts + FIFTEEN_MIN_MS;
      if (sweepCloseTs > bosCloseTs) continue;
      if (bosCloseTs - sweepCloseTs > cfg.sweepToBosWindowMs) break;
      sweepIdx = k;
      break;
    }
    if (sweepIdx === -1) continue;

    // All conditions met — emit signal.
    const tier   = (i - bosIdx <= cfg.cleanWindowBars) ? "perfect" : "standard";
    const riskPct = tier === "perfect" ? cfg.perfectRiskPct : cfg.standardRiskPct;
    const entryTriggerTs = candles5m[i].ts + FIVE_MIN_MS;

    signals.push({
      ts:             entryTriggerTs,
      side:           "long",
      trend4hTs:      t4h.ts,
      sweep15mTs:     candles15m[sweepIdx].ts,
      bos5mTs:        candles5m[bosIdx].ts,
      pullback5mTs:   candles5m[i].ts,
      entryTriggerTs,
      tier,
      riskPct,
      reason:         "all_conditions_met",
    });
    emittedBosIdxes.add(bosIdx);
  }
  return signals;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function mergeConfig(options) {
  const cfg = {
    trend:    { ...DEFAULT_SIGNAL_CONFIG.trend,    ...(options.trend    || {}) },
    sweep:    { ...DEFAULT_SIGNAL_CONFIG.sweep,    ...(options.sweep    || {}) },
    bos:      { ...DEFAULT_SIGNAL_CONFIG.bos,      ...(options.bos      || {}) },
    pullback: { ...DEFAULT_SIGNAL_CONFIG.pullback, ...(options.pullback || {}) },
    sweepToBosWindowMs: options.sweepToBosWindowMs ?? DEFAULT_SIGNAL_CONFIG.sweepToBosWindowMs,
    cleanWindowBars:    options.cleanWindowBars    ?? DEFAULT_SIGNAL_CONFIG.cleanWindowBars,
    perfectRiskPct:     options.perfectRiskPct     ?? DEFAULT_SIGNAL_CONFIG.perfectRiskPct,
    standardRiskPct:    options.standardRiskPct    ?? DEFAULT_SIGNAL_CONFIG.standardRiskPct,
  };
  if (!Number.isFinite(cfg.sweepToBosWindowMs) || cfg.sweepToBosWindowMs <= 0) {
    throw new RangeError(`sweepToBosWindowMs must be positive finite, got ${cfg.sweepToBosWindowMs}`);
  }
  if (!Number.isInteger(cfg.cleanWindowBars) || cfg.cleanWindowBars <= 0) {
    throw new RangeError(`cleanWindowBars must be a positive integer, got ${cfg.cleanWindowBars}`);
  }
  if (!Number.isFinite(cfg.perfectRiskPct) || cfg.perfectRiskPct <= 0 || cfg.perfectRiskPct >= 1) {
    throw new RangeError(`perfectRiskPct must be in (0, 1), got ${cfg.perfectRiskPct}`);
  }
  if (!Number.isFinite(cfg.standardRiskPct) || cfg.standardRiskPct <= 0 || cfg.standardRiskPct >= 1) {
    throw new RangeError(`standardRiskPct must be in (0, 1), got ${cfg.standardRiskPct}`);
  }
  if (cfg.standardRiskPct > cfg.perfectRiskPct) {
    throw new RangeError(`standardRiskPct (${cfg.standardRiskPct}) must be <= perfectRiskPct (${cfg.perfectRiskPct})`);
  }
  return cfg;
}
