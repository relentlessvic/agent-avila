// Phase SV2-3B — 5-minute bullish Break-of-Structure (BOS) detector.
//
// Pure-function annotator. Takes a chronologically-sorted array of
// completed 5m OHLCV candles (used as the entry timeframe in
// Strategy V2) and emits one annotation per candle indicating whether
// that candle constitutes a bullish BOS:
//
//   bullish BOS  ↔  candle.close  >  priorSwingHigh
//
// where priorSwingHigh = max over the prior `lookback` (default 12)
// candles' highs (NOT including the current candle).
//
// Strategy V2 is long-only, so only bullish BOS is surfaced here.
// Bearish BOS detection is intentionally out of scope.
//
// Annotation shape per candle:
//   {
//     ts:              number,                  // candle's timestamp
//     high:            number,                  // candle's high
//     close:           number,                  // candle's close
//     priorSwingHigh:  number | null,           // null if insufficient data
//     bos:             boolean,                 // true on bullish BOS
//     direction:       "bullish" | null,
//     reason:          string                   // see REASONS below
//   }
//
// SAFETY CONTRACT
// ---------------
// 1. No imports from db.js, lib/, bot.js, dashboard.js, or anywhere
//    outside backtest/**. Pure module.
// 2. No I/O. No env vars. No clock reads. No global state.
// 3. Look-ahead protection: annotation at index `i` depends solely on
//    candles[0..i] (current bar plus the prior `lookback` bars). The
//    single-index helper `bosAt` enforces this by slicing.
// 4. Deterministic: same input → bit-identical output.

export const DEFAULT_BOS_LOOKBACK = 12;

export const REASONS = Object.freeze({
  INSUFFICIENT_DATA: "insufficient_data",
  NO_CLOSE_ABOVE:    "no_close_above",
  BULLISH_BOS:       "bullish_bos",
});

// ─── Public API ────────────────────────────────────────────────────────────
export function detectBos5m(candles5m, options = {}) {
  if (!Array.isArray(candles5m)) {
    throw new TypeError("detectBos5m: candles5m must be an array");
  }
  const cfg = mergeConfig(options);
  if (candles5m.length === 0) return [];

  // Validate input shape & finiteness up front.
  for (let i = 0; i < candles5m.length; i++) {
    const c = candles5m[i];
    if (!c || typeof c !== "object") {
      throw new TypeError(`detectBos5m: candle[${i}] is not an object`);
    }
    if (!Number.isFinite(c.high) || !Number.isFinite(c.close) || !Number.isFinite(c.ts)) {
      throw new TypeError(`detectBos5m: candle[${i}] has non-finite ts/high/close`);
    }
  }

  const out = new Array(candles5m.length);
  for (let i = 0; i < candles5m.length; i++) {
    out[i] = annotate(candles5m, i, cfg);
  }
  return out;
}

export function bosAt(candles5m, index, options = {}) {
  if (!Array.isArray(candles5m)) {
    throw new TypeError("bosAt: candles5m must be an array");
  }
  if (!Number.isInteger(index) || index < 0 || index >= candles5m.length) {
    throw new RangeError(`bosAt: index ${index} out of range [0, ${candles5m.length})`);
  }
  // Slice to enforce no-future-peek at the API level: only candles[0..index]
  // are visible.
  const window = candles5m.slice(0, index + 1);
  const result = detectBos5m(window, options);
  return result[index];
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function mergeConfig(options) {
  const cfg = {
    lookback: options?.lookback ?? DEFAULT_BOS_LOOKBACK,
  };
  if (!Number.isInteger(cfg.lookback) || cfg.lookback <= 0) {
    throw new RangeError(`detectBos5m: lookback must be a positive integer, got ${cfg.lookback}`);
  }
  return cfg;
}

function annotate(candles, i, cfg) {
  const c = candles[i];

  // Insufficient data: need `lookback` prior bars before index i.
  if (i < cfg.lookback) {
    return {
      ts:             c.ts,
      high:           c.high,
      close:          c.close,
      priorSwingHigh: null,
      bos:            false,
      direction:      null,
      reason:         REASONS.INSUFFICIENT_DATA,
    };
  }

  // priorSwingHigh = max(high) over candles[i - lookback .. i - 1] (excludes current).
  let priorSwingHigh = -Infinity;
  for (let k = i - cfg.lookback; k < i; k++) {
    const hk = candles[k].high;
    if (hk > priorSwingHigh) priorSwingHigh = hk;
  }
  if (!Number.isFinite(priorSwingHigh)) {
    return {
      ts:             c.ts,
      high:           c.high,
      close:          c.close,
      priorSwingHigh: null,
      bos:            false,
      direction:      null,
      reason:         REASONS.INSUFFICIENT_DATA,
    };
  }

  // Bullish BOS test (strict): close above priorSwingHigh.
  if (c.close > priorSwingHigh) {
    return {
      ts: c.ts, high: c.high, close: c.close,
      priorSwingHigh,
      bos: true, direction: "bullish",
      reason: REASONS.BULLISH_BOS,
    };
  }
  return {
    ts: c.ts, high: c.high, close: c.close,
    priorSwingHigh,
    bos: false, direction: null,
    reason: REASONS.NO_CLOSE_ABOVE,
  };
}
