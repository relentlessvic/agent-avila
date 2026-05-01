// Phase SV2-2 — 4-hour trend-filter feature.
//
// Pure-function classifier. Takes a chronologically-sorted array of 4h
// OHLCV candles (typically the output of resampleTo4h from
// ../resampler.js) and emits one trend label per candle:
//
//   UP                 close > SMA50  AND  SMA20 > SMA50
//   DOWN               close < SMA50  AND  SMA20 < SMA50
//   NEUTRAL            otherwise (mixed signals; includes ties)
//   INSUFFICIENT_DATA  fewer than `smaLong` (default 50) bars precede it
//                      (i.e., index < smaLong - 1)
//
// SAFETY CONTRACT
// ---------------
// 1. No imports from db.js, lib/, bot.js, dashboard.js, or anywhere
//    outside backtest/**.
// 2. No I/O. No env vars. No global state. No clock reads.
// 3. Look-ahead protection: classification at index `i` depends solely
//    on `candles[0..i]` (inclusive). The single-index helper `trendAt`
//    enforces this by slicing before computing.
// 4. Deterministic: same input → bit-identical output.

export const TREND_UP            = "UP";
export const TREND_DOWN          = "DOWN";
export const TREND_NEUTRAL       = "NEUTRAL";
export const TREND_INSUFFICIENT  = "INSUFFICIENT_DATA";

export const TREND_LABELS = Object.freeze([
  TREND_UP, TREND_DOWN, TREND_NEUTRAL, TREND_INSUFFICIENT,
]);

export const DEFAULT_TREND_CONFIG = Object.freeze({
  smaShort: 20,
  smaLong:  50,
});

// ─── Public API ────────────────────────────────────────────────────────────
export function classifyTrend4h(candles4h, options = {}) {
  if (!Array.isArray(candles4h)) {
    throw new TypeError("classifyTrend4h: candles4h must be an array");
  }
  const cfg = mergeConfig(options);
  if (cfg.smaShort >= cfg.smaLong) {
    throw new RangeError(
      `classifyTrend4h: smaShort (${cfg.smaShort}) must be less than smaLong (${cfg.smaLong})`
    );
  }
  if (candles4h.length === 0) return [];

  const closes = new Array(candles4h.length);
  for (let i = 0; i < candles4h.length; i++) {
    const c = candles4h[i].close;
    if (!Number.isFinite(c)) {
      throw new TypeError(`classifyTrend4h: candle[${i}].close is not finite`);
    }
    closes[i] = c;
  }

  const smaShort = rollingSma(closes, cfg.smaShort);
  const smaLong  = rollingSma(closes, cfg.smaLong);

  const out = new Array(candles4h.length);
  for (let i = 0; i < candles4h.length; i++) {
    const close = closes[i];
    const s20   = smaShort[i];
    const s50   = smaLong[i];
    let trend;
    if (s50 == null) {
      trend = TREND_INSUFFICIENT;
    } else if (close > s50 && s20 > s50) {
      trend = TREND_UP;
    } else if (close < s50 && s20 < s50) {
      trend = TREND_DOWN;
    } else {
      trend = TREND_NEUTRAL;
    }
    out[i] = {
      ts:    candles4h[i].ts,
      close,
      sma20: s20,
      sma50: s50,
      trend,
    };
  }
  return out;
}

export function trendAt(candles4h, index, options = {}) {
  if (!Array.isArray(candles4h)) {
    throw new TypeError("trendAt: candles4h must be an array");
  }
  if (!Number.isInteger(index) || index < 0 || index >= candles4h.length) {
    throw new RangeError(`trendAt: index ${index} out of range [0, ${candles4h.length})`);
  }
  // Slice to enforce no-future-peek at the API level: only candles[0..index]
  // are visible to the underlying classifier.
  const window = candles4h.slice(0, index + 1);
  const result = classifyTrend4h(window, options);
  return result[index];
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function mergeConfig(options) {
  const cfg = { ...DEFAULT_TREND_CONFIG, ...(options || {}) };
  if (!Number.isInteger(cfg.smaShort) || cfg.smaShort <= 0) {
    throw new RangeError(`smaShort must be a positive integer, got ${cfg.smaShort}`);
  }
  if (!Number.isInteger(cfg.smaLong) || cfg.smaLong <= 0) {
    throw new RangeError(`smaLong must be a positive integer, got ${cfg.smaLong}`);
  }
  return cfg;
}

// Rolling simple moving average. Returns an array of the same length as
// `values`. Indices [0 .. period-2] are filled with `null` (insufficient
// history). Index `i >= period - 1` holds the average of values[i-period+1 .. i].
// Look-ahead-free by construction: each output index reads only values
// at or before that index.
export function rollingSma(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    out[i] = sum / period;
  }
  return out;
}
