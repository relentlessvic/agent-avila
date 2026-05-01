// Phase SV2-1 — UTC-aligned resampler.
//
// Converts a sorted stream of 5m OHLCV candles into 15m and 4h streams
// using strict UTC bar boundaries. A higher-TF bar is emitted ONLY when
// every constituent 5m bar is present at its expected timestamp. Missing
// any bar in a bucket → that higher-TF bar is dropped (no silent fill).
//
// SAFETY CONTRACT
// ---------------
// 1. No imports from db.js, lib/, bot.js, dashboard.js, or anything
//    outside backtest/**. Pure algorithmic module.
// 2. No I/O. No env vars. No global state.
// 3. Caller-determined UTC alignment: 15m buckets start at HH:00/15/30/45;
//    4h buckets start at 00/04/08/12/16/20 UTC.
// 4. Look-ahead protection: each emitted bar's timestamp is its bucket
//    start. The bar is "available" only after the bucket's end time
//    has passed in the simulation clock — callers enforce this.

import { FIVE_MIN_MS } from "./data-loader.js";

export const FIFTEEN_MIN_MS = 15 * 60 * 1000;
export const FOUR_HOUR_MS   = 4 * 60 * 60 * 1000;

// ─── Public API ────────────────────────────────────────────────────────────
export function resampleTo15m(candles5m) {
  return resample(candles5m, FIFTEEN_MIN_MS, FIVE_MIN_MS);
}

export function resampleTo4h(candles5m) {
  return resample(candles5m, FOUR_HOUR_MS, FIVE_MIN_MS);
}

// ─── Core ──────────────────────────────────────────────────────────────────
export function resample(candles, bucketMs, sourceIntervalMs) {
  if (!Array.isArray(candles)) {
    throw new TypeError("resample: candles must be an array");
  }
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) {
    throw new TypeError("resample: bucketMs must be a positive finite number");
  }
  if (!Number.isFinite(sourceIntervalMs) || sourceIntervalMs <= 0) {
    throw new TypeError("resample: sourceIntervalMs must be a positive finite number");
  }
  if (bucketMs % sourceIntervalMs !== 0) {
    throw new RangeError(
      `resample: bucketMs (${bucketMs}) must be an integer multiple of sourceIntervalMs (${sourceIntervalMs})`
    );
  }

  const expectedPerBucket = bucketMs / sourceIntervalMs;
  if (candles.length === 0) return [];

  // Group candles by bucket-start, preserving input order. We rely on the
  // caller having ascending, deduplicated timestamps (the data-loader
  // integrity checks guarantee this for clean inputs).
  const groups = new Map();   // bucketStart → { firstIdx, lastIdx, count, ... }
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!Number.isFinite(c.ts)) continue;
    const bucketStart = bucketStartFor(c.ts, bucketMs);
    let g = groups.get(bucketStart);
    if (!g) {
      g = {
        bucketStart,
        firstTs: c.ts,
        lastTs: c.ts,
        open: c.open,
        close: c.close,
        high: c.high,
        low: c.low,
        volume: c.volume,
        count: 1,
      };
      groups.set(bucketStart, g);
      continue;
    }
    // Extend group with this candle.
    g.lastTs = c.ts;
    g.close  = c.close;
    if (c.high > g.high) g.high = c.high;
    if (c.low  < g.low)  g.low  = c.low;
    g.volume += c.volume;
    g.count  += 1;
  }

  // Emit only buckets that contain ALL expected source bars at the
  // expected timestamps (firstTs === bucketStart, lastTs === bucketEnd
  // - sourceInterval, count === expectedPerBucket).
  const emitted = [];
  for (const g of groups.values()) {
    const expectedFirstTs = g.bucketStart;
    const expectedLastTs  = g.bucketStart + bucketMs - sourceIntervalMs;
    if (g.count !== expectedPerBucket) continue;
    if (g.firstTs !== expectedFirstTs) continue;
    if (g.lastTs  !== expectedLastTs)  continue;
    emitted.push({
      ts:     g.bucketStart,
      open:   g.open,
      high:   g.high,
      low:    g.low,
      close:  g.close,
      volume: g.volume,
      bucketSize: g.count,
    });
  }

  // Sort by ts ascending — Map iteration order is insertion order; if the
  // input is sorted (which the loader guarantees), no sort is necessary.
  // We sort defensively for callers that pass unsorted input.
  emitted.sort((a, b) => a.ts - b.ts);
  return emitted;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
export function bucketStartFor(ts, bucketMs) {
  // Math.floor of integer division. JS numbers are doubles; for ms-scale
  // timestamps in the modern range, this is exact.
  return Math.floor(ts / bucketMs) * bucketMs;
}

export function expectedBucketBars(bucketMs, sourceIntervalMs = FIVE_MIN_MS) {
  return bucketMs / sourceIntervalMs;
}
