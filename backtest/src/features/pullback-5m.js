// Phase SV2-3C — 5-minute long-only pullback entry-zone detector.
//
// Annotates each 5m candle with whether its range falls inside the
// 50%–79% Fibonacci retracement zone of the most recent (still-valid)
// bullish-BOS leg. A BOS leg is defined as:
//
//   bosLegHigh = candles[bosIdx].high                     (BOS candle's high)
//   bosLegLow  = min(low) over candles[bosIdx-bosLookback .. bosIdx-1]
//                (matches the BOS detector's prior-swing-high lookback,
//                 so the same window defines the leg's swing low)
//
// Fib zone:
//   fib50 = bosLegHigh − 0.50 × (bosLegHigh − bosLegLow)
//   fib79 = bosLegHigh − 0.79 × (bosLegHigh − bosLegLow)
//   zone  = [fib79, fib50]    (fib79 < fib50)
//
// A candle "is in the pullback zone" when its range overlaps that
// zone — i.e. `candle.low ≤ fib50 AND candle.high ≥ fib79`.
//
// Leg invalidation: if any candle from bosIdx+1 through the current
// bar (inclusive) has `low < bosLegLow` (strict), the BOS context is
// blown and no further pullback can register against it.
//
// FVG (fair-value-gap) fill detection is intentionally OUT OF SCOPE
// for SV2-3C and deferred to a later phase. SV2-3C surfaces only the
// fib-zone variant, which is the deterministic, easy-to-test case.
//
// Annotation shape per candle:
//   {
//     ts:             number,
//     low:            number,
//     high:           number,
//     close:          number,
//     bosLegLow:      number | null,
//     bosLegHigh:     number | null,
//     fib50:          number | null,
//     fib79:          number | null,
//     inPullbackZone: boolean,
//     reason:         string                    // see REASONS below
//   }
//
// SAFETY CONTRACT
// ---------------
// 1. No imports from db.js, lib/, bot.js, dashboard.js, or anywhere
//    outside backtest/**. Sibling-only import: `./bos-5m.js`.
// 2. No I/O. No env vars. No clock reads. No global state.
// 3. Look-ahead protection: annotation at index `i` depends solely on
//    candles[0..i] (i.e. the BOS detector + the leg-invalidation walk
//    only consult bars at or before i). The `pullbackAt` helper slices.
// 4. Deterministic: same input → bit-identical output.

import { detectBos5m, DEFAULT_BOS_LOOKBACK } from "./bos-5m.js";

export const DEFAULT_PULLBACK_CONFIG = Object.freeze({
  bosLookback:  DEFAULT_BOS_LOOKBACK,   // 12 — must match BOS detector lookback
  bosHorizon:   24,                     // bars after BOS to keep the leg "alive"
  fibLowerPct:  0.50,                   // upper edge of zone (closer to leg high)
  fibUpperPct:  0.79,                   // lower edge of zone (deeper retrace)
});

export const REASONS = Object.freeze({
  INSUFFICIENT_DATA: "insufficient_data",
  NO_ACTIVE_BOS:     "no_active_bos",
  LEG_INVALIDATED:   "leg_invalidated",
  ABOVE_ZONE:        "above_zone",
  IN_PULLBACK_ZONE:  "in_pullback_zone",
  BELOW_ZONE:        "below_zone",
});

// ─── Public API ────────────────────────────────────────────────────────────
export function detectPullbacks5m(candles5m, options = {}) {
  if (!Array.isArray(candles5m)) {
    throw new TypeError("detectPullbacks5m: candles5m must be an array");
  }
  const cfg = mergeConfig(options);
  if (candles5m.length === 0) return [];
  validateCandles(candles5m);

  // Run the BOS detector once over the full input. Look-ahead-safe because
  // BOS at index j only consults candles[0..j].
  const bosAnnotations = detectBos5m(candles5m, { lookback: cfg.bosLookback });

  const out = new Array(candles5m.length);
  for (let i = 0; i < candles5m.length; i++) {
    out[i] = annotate(candles5m, bosAnnotations, i, cfg);
  }
  return out;
}

export function pullbackAt(candles5m, index, options = {}) {
  if (!Array.isArray(candles5m)) {
    throw new TypeError("pullbackAt: candles5m must be an array");
  }
  if (!Number.isInteger(index) || index < 0 || index >= candles5m.length) {
    throw new RangeError(`pullbackAt: index ${index} out of range [0, ${candles5m.length})`);
  }
  const window = candles5m.slice(0, index + 1);
  const result = detectPullbacks5m(window, options);
  return result[index];
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function mergeConfig(options) {
  const cfg = { ...DEFAULT_PULLBACK_CONFIG, ...(options || {}) };
  if (!Number.isInteger(cfg.bosLookback) || cfg.bosLookback <= 0) {
    throw new RangeError(`bosLookback must be a positive integer, got ${cfg.bosLookback}`);
  }
  if (!Number.isInteger(cfg.bosHorizon) || cfg.bosHorizon <= 0) {
    throw new RangeError(`bosHorizon must be a positive integer, got ${cfg.bosHorizon}`);
  }
  if (!Number.isFinite(cfg.fibLowerPct) || cfg.fibLowerPct <= 0 || cfg.fibLowerPct >= 1) {
    throw new RangeError(`fibLowerPct must be in (0, 1), got ${cfg.fibLowerPct}`);
  }
  if (!Number.isFinite(cfg.fibUpperPct) || cfg.fibUpperPct <= 0 || cfg.fibUpperPct >= 1) {
    throw new RangeError(`fibUpperPct must be in (0, 1), got ${cfg.fibUpperPct}`);
  }
  if (cfg.fibLowerPct >= cfg.fibUpperPct) {
    throw new RangeError(`fibLowerPct (${cfg.fibLowerPct}) must be less than fibUpperPct (${cfg.fibUpperPct})`);
  }
  return cfg;
}

function validateCandles(candles) {
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!c || typeof c !== "object") {
      throw new TypeError(`detectPullbacks5m: candle[${i}] is not an object`);
    }
    if (!Number.isFinite(c.ts) || !Number.isFinite(c.low) || !Number.isFinite(c.high) || !Number.isFinite(c.close)) {
      throw new TypeError(`detectPullbacks5m: candle[${i}] has non-finite ts/low/high/close`);
    }
  }
}

function emptyAnnotation(c, reason, fields = {}) {
  return {
    ts: c.ts, low: c.low, high: c.high, close: c.close,
    bosLegLow:  fields.bosLegLow  ?? null,
    bosLegHigh: fields.bosLegHigh ?? null,
    fib50:      fields.fib50      ?? null,
    fib79:      fields.fib79      ?? null,
    inPullbackZone: false,
    reason,
  };
}

function annotate(candles, bosAnnotations, i, cfg) {
  const c = candles[i];

  // Insufficient history to have any BOS at all.
  if (i < cfg.bosLookback) {
    return emptyAnnotation(c, REASONS.INSUFFICIENT_DATA);
  }

  // Find the most recent BOS at j < i within `bosHorizon` bars.
  const horizonMin = Math.max(0, i - cfg.bosHorizon);
  let bosIdx = -1;
  for (let j = i - 1; j >= horizonMin; j--) {
    if (bosAnnotations[j].bos === true) {
      bosIdx = j;
      break;
    }
  }
  if (bosIdx === -1) {
    return emptyAnnotation(c, REASONS.NO_ACTIVE_BOS);
  }

  // Compute the leg.
  const bosLegHigh = candles[bosIdx].high;
  let bosLegLow = Infinity;
  for (let k = bosIdx - cfg.bosLookback; k < bosIdx; k++) {
    if (candles[k].low < bosLegLow) bosLegLow = candles[k].low;
  }
  if (!Number.isFinite(bosLegLow)) {
    return emptyAnnotation(c, REASONS.NO_ACTIVE_BOS);
  }
  const range = bosLegHigh - bosLegLow;
  if (range <= 0) {
    // Degenerate leg (zero or negative range — shouldn't happen on real data)
    return emptyAnnotation(c, REASONS.NO_ACTIVE_BOS, { bosLegLow, bosLegHigh });
  }

  const fib50 = bosLegHigh - cfg.fibLowerPct * range;
  const fib79 = bosLegHigh - cfg.fibUpperPct * range;

  // Leg invalidation: any candle from bosIdx+1 through i (inclusive)
  // whose low strictly breaks below bosLegLow blows the leg.
  for (let k = bosIdx + 1; k <= i; k++) {
    if (candles[k].low < bosLegLow) {
      return {
        ts: c.ts, low: c.low, high: c.high, close: c.close,
        bosLegLow, bosLegHigh, fib50, fib79,
        inPullbackZone: false,
        reason: REASONS.LEG_INVALIDATED,
      };
    }
  }

  // Classify the current candle vs the [fib79, fib50] zone.
  if (c.high < fib79) {
    return {
      ts: c.ts, low: c.low, high: c.high, close: c.close,
      bosLegLow, bosLegHigh, fib50, fib79,
      inPullbackZone: false,
      reason: REASONS.BELOW_ZONE,
    };
  }
  if (c.low > fib50) {
    return {
      ts: c.ts, low: c.low, high: c.high, close: c.close,
      bosLegLow, bosLegHigh, fib50, fib79,
      inPullbackZone: false,
      reason: REASONS.ABOVE_ZONE,
    };
  }
  // Range overlaps the zone: low ≤ fib50 AND high ≥ fib79.
  return {
    ts: c.ts, low: c.low, high: c.high, close: c.close,
    bosLegLow, bosLegHigh, fib50, fib79,
    inPullbackZone: true,
    reason: REASONS.IN_PULLBACK_ZONE,
  };
}
