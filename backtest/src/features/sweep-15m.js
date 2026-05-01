// Phase SV2-3A — 15-minute bullish liquidity-sweep detector.
//
// Pure-function annotator. Takes a chronologically-sorted array of
// completed 15m OHLCV candles (typically the output of resampleTo15m
// from ../resampler.js) and emits one annotation per candle indicating
// whether that candle constitutes a bullish liquidity sweep:
//
//   bullish sweep  ↔  candle.low  <  priorLow  AND  candle.close  >  priorLow
//
// where priorLow = min over the prior `lookback` (default 20) candles
// (NOT including the current candle).
//
// Strategy V2 is long-only, so only bullish sweeps are surfaced here.
// Bearish sweep detection is intentionally out of scope for SV2-3A.
//
// Annotation shape per candle:
//   {
//     ts:        number,                       // candle's timestamp
//     low:       number,                       // candle's low
//     close:     number,                       // candle's close
//     priorLow:  number | null,                // null if insufficient data
//     swept:     boolean,                      // true on bullish sweep
//     direction: "bullish" | null,             // "bullish" iff swept===true
//     reason:    string                        // see REASONS below
//   }
//
// SAFETY CONTRACT
// ---------------
// 1. No imports from db.js, lib/, bot.js, dashboard.js, or anywhere
//    outside backtest/**. Pure module.
// 2. No I/O. No env vars. No clock reads. No global state.
// 3. Look-ahead protection: annotation at index `i` depends solely on
//    candles[0..i] (current bar plus the prior `lookback` bars). The
//    single-index helper `sweepAt` enforces this by slicing.
// 4. Deterministic: same input → bit-identical output.

export const DEFAULT_SWEEP_LOOKBACK = 20;

export const REASONS = Object.freeze({
  INSUFFICIENT_DATA:     "insufficient_data",
  NO_BREAK_BELOW:        "no_break_below",
  NO_CLOSE_ABOVE:        "no_close_above",
  BULLISH_SWEEP:         "bullish_sweep",
});

// ─── Public API ────────────────────────────────────────────────────────────
export function detectSweeps15m(candles15m, options = {}) {
  if (!Array.isArray(candles15m)) {
    throw new TypeError("detectSweeps15m: candles15m must be an array");
  }
  const cfg = mergeConfig(options);
  if (candles15m.length === 0) return [];

  // Validate input shape & finiteness up front.
  for (let i = 0; i < candles15m.length; i++) {
    const c = candles15m[i];
    if (!c || typeof c !== "object") {
      throw new TypeError(`detectSweeps15m: candle[${i}] is not an object`);
    }
    if (!Number.isFinite(c.low) || !Number.isFinite(c.close) || !Number.isFinite(c.ts)) {
      throw new TypeError(`detectSweeps15m: candle[${i}] has non-finite ts/low/close`);
    }
  }

  const out = new Array(candles15m.length);
  for (let i = 0; i < candles15m.length; i++) {
    out[i] = annotate(candles15m, i, cfg);
  }
  return out;
}

export function sweepAt(candles15m, index, options = {}) {
  if (!Array.isArray(candles15m)) {
    throw new TypeError("sweepAt: candles15m must be an array");
  }
  if (!Number.isInteger(index) || index < 0 || index >= candles15m.length) {
    throw new RangeError(`sweepAt: index ${index} out of range [0, ${candles15m.length})`);
  }
  // Slice to enforce no-future-peek at the API level: only candles[0..index]
  // are visible.
  const window = candles15m.slice(0, index + 1);
  const result = detectSweeps15m(window, options);
  return result[index];
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function mergeConfig(options) {
  const cfg = {
    lookback: options?.lookback ?? DEFAULT_SWEEP_LOOKBACK,
  };
  if (!Number.isInteger(cfg.lookback) || cfg.lookback <= 0) {
    throw new RangeError(`detectSweeps15m: lookback must be a positive integer, got ${cfg.lookback}`);
  }
  return cfg;
}

function annotate(candles, i, cfg) {
  const c = candles[i];

  // Insufficient data: need `lookback` prior bars before index i.
  if (i < cfg.lookback) {
    return {
      ts:        c.ts,
      low:       c.low,
      close:     c.close,
      priorLow:  null,
      swept:     false,
      direction: null,
      reason:    REASONS.INSUFFICIENT_DATA,
    };
  }

  // priorLow is the minimum low over candles[i - lookback .. i - 1] (excludes current).
  let priorLow = Infinity;
  for (let k = i - cfg.lookback; k < i; k++) {
    const lk = candles[k].low;
    if (lk < priorLow) priorLow = lk;
  }
  // priorLow is finite by construction (we validated all lows above), but
  // guard defensively in case of future edits.
  if (!Number.isFinite(priorLow)) {
    return {
      ts:        c.ts,
      low:       c.low,
      close:     c.close,
      priorLow:  null,
      swept:     false,
      direction: null,
      reason:    REASONS.INSUFFICIENT_DATA,
    };
  }

  // Bullish sweep test (strict): wick below AND close back above.
  const wickedBelow = c.low < priorLow;
  const closedBack  = c.close > priorLow;

  if (!wickedBelow) {
    return {
      ts: c.ts, low: c.low, close: c.close,
      priorLow,
      swept: false, direction: null,
      reason: REASONS.NO_BREAK_BELOW,
    };
  }
  if (!closedBack) {
    return {
      ts: c.ts, low: c.low, close: c.close,
      priorLow,
      swept: false, direction: null,
      reason: REASONS.NO_CLOSE_ABOVE,
    };
  }
  return {
    ts: c.ts, low: c.low, close: c.close,
    priorLow,
    swept: true, direction: "bullish",
    reason: REASONS.BULLISH_SWEEP,
  };
}
