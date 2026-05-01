// Phase SV2-1 — backtest data loader + integrity checks.
//
// Reads OHLCV candles from a local CSV or JSON fixture file, normalizes
// to a uniform { ts, open, high, low, close, volume } shape, and runs a
// suite of integrity checks. Returns a structured result; throws if any
// HARD check fails (unless `allowGaps` is set, which softens only the
// gap thresholds).
//
// SAFETY CONTRACT
// ---------------
// 1. No imports from db.js, lib/, bot.js, dashboard.js, or anything
//    outside backtest/**. Uses only `fs` and `path` from node:.
// 2. No network calls. Reads only from the path the caller passes.
// 3. No env vars consumed.
// 4. No global state. Pure function semantics: same input file, same
//    options → same result.
// 5. No mutation of the file or any other system state.

import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

export const FIVE_MIN_MS = 5 * 60 * 1000;
export const DEFAULT_GAP_HARD_MS = 30 * 60 * 1000;

const CSV_HEADERS_REQUIRED = ["timestamp", "open", "high", "low", "close", "volume"];

// ─── Public entry ──────────────────────────────────────────────────────────
export function loadCandles(filePath, options = {}) {
  const opts = {
    allowGaps:    options.allowGaps    ?? false,
    maxGapMs:     options.maxGapMs     ?? DEFAULT_GAP_HARD_MS,
    intervalMs:   options.intervalMs   ?? FIVE_MIN_MS,
    throwOnHard:  options.throwOnHard  ?? true,
  };

  // Check 1: file exists
  if (!existsSync(filePath)) {
    const integrity = withFails(emptyIntegrity(), {
      check: "file_exists",
      detail: `file not found: ${filePath}`,
    });
    if (opts.throwOnHard) throw new IntegrityError(integrity);
    return { candles: [], integrity };
  }

  // Check 2: parseable
  let candles;
  try {
    candles = parseFile(filePath);
  } catch (err) {
    const integrity = withFails(emptyIntegrity(), {
      check: "parseable",
      detail: `parse error: ${err.message}`,
    });
    if (opts.throwOnHard) throw new IntegrityError(integrity);
    return { candles: [], integrity };
  }

  // Run all integrity checks
  const integrity = checkIntegrity(candles, opts);

  if (integrity.hardFails.length > 0 && opts.throwOnHard) {
    throw new IntegrityError(integrity);
  }

  return { candles, integrity };
}

// ─── File parsing ──────────────────────────────────────────────────────────
function parseFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  const raw = readFileSync(filePath, "utf8");
  if (ext === ".json") return parseJson(raw);
  if (ext === ".csv")  return parseCsv(raw);
  throw new Error(`unsupported file extension: ${ext}`);
}

function parseJson(raw) {
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data
            : Array.isArray(data.candles) ? data.candles
            : null;
  if (!arr) throw new Error("JSON must be an array or an object with a `candles` array");
  return arr.map((c, i) => normalizeCandle(c, i));
}

function parseCsv(raw) {
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) throw new Error("CSV is empty");
  const header = lines[0].split(",").map(s => s.trim().toLowerCase());
  for (const h of CSV_HEADERS_REQUIRED) {
    if (!header.includes(h)) throw new Error(`CSV header missing required column "${h}". Found: ${header.join(",")}`);
  }
  const idx = Object.fromEntries(CSV_HEADERS_REQUIRED.map(h => [h, header.indexOf(h)]));
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    out.push(normalizeCandle({
      timestamp: cells[idx.timestamp],
      open:      cells[idx.open],
      high:      cells[idx.high],
      low:       cells[idx.low],
      close:     cells[idx.close],
      volume:    cells[idx.volume],
    }, i - 1));
  }
  return out;
}

function normalizeCandle(c, i) {
  // Accept either { timestamp, ... } or compact { ts, o, h, l, c, v }.
  const tsRaw = c.timestamp ?? c.ts;
  const o = c.open   ?? c.o;
  const h = c.high   ?? c.h;
  const l = c.low    ?? c.l;
  const cl = c.close ?? c.c;
  const v = c.volume ?? c.v;

  const ts = parseTimestamp(tsRaw);
  return {
    ts,
    open:   numberOrNaN(o),
    high:   numberOrNaN(h),
    low:    numberOrNaN(l),
    close:  numberOrNaN(cl),
    volume: numberOrNaN(v),
    _row: i,
  };
}

function parseTimestamp(raw) {
  if (raw == null) return NaN;
  if (typeof raw === "number") {
    // Heuristic: 13-digit numbers are ms; 10-digit are seconds.
    if (raw > 1e12) return raw;
    if (raw > 1e9)  return raw * 1000;
    return raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (n > 1e12) return n;
      if (n > 1e9)  return n * 1000;
      return n;
    }
    const t = Date.parse(trimmed);
    return Number.isFinite(t) ? t : NaN;
  }
  return NaN;
}

function numberOrNaN(v) {
  if (typeof v === "number") return v;
  if (v == null) return NaN;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

// ─── Integrity checks ──────────────────────────────────────────────────────
function emptyIntegrity() {
  return {
    hardFails:     [],
    softWarnings:  [],
    stats: {
      rows: 0, firstTs: null, lastTs: null, gapCount: 0, intervalGapCount: 0,
    },
  };
}

function withFails(integrity, ...fails) {
  return { ...integrity, hardFails: [...integrity.hardFails, ...fails] };
}

function checkIntegrity(candles, opts) {
  const integrity = emptyIntegrity();
  integrity.stats.rows = candles.length;

  if (candles.length === 0) {
    integrity.hardFails.push({ check: "non_empty", detail: "no candles parsed" });
    return integrity;
  }

  integrity.stats.firstTs = candles[0].ts;
  integrity.stats.lastTs  = candles[candles.length - 1].ts;

  // Per-bar checks: parseable OHLCV finiteness, OHLCV invariants, volume >= 0
  let parseFailRow = -1;
  let finiteFailRow = -1;
  let highInvariantFailRow = -1;
  let lowInvariantFailRow  = -1;
  let volumeNegRow         = -1;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!Number.isFinite(c.ts)) {
      if (parseFailRow < 0) parseFailRow = i;
      continue;
    }
    if (![c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite)) {
      if (finiteFailRow < 0) finiteFailRow = i;
      continue;
    }
    if (c.high < c.open || c.high < c.close || c.high < c.low) {
      if (highInvariantFailRow < 0) highInvariantFailRow = i;
    }
    if (c.low > c.open || c.low > c.close || c.low > c.high) {
      if (lowInvariantFailRow < 0) lowInvariantFailRow = i;
    }
    if (c.volume < 0) {
      if (volumeNegRow < 0) volumeNegRow = i;
    }
  }
  if (parseFailRow >= 0) {
    integrity.hardFails.push({
      check: "parseable_timestamp",
      detail: `row ${parseFailRow} has unparseable timestamp`,
    });
  }
  if (finiteFailRow >= 0) {
    integrity.hardFails.push({
      check: "finite_ohlcv",
      detail: `row ${finiteFailRow} has non-finite OHLCV value`,
    });
  }
  if (highInvariantFailRow >= 0) {
    integrity.hardFails.push({
      check: "high_invariant",
      detail: `row ${highInvariantFailRow}: high < open/close/low`,
    });
  }
  if (lowInvariantFailRow >= 0) {
    integrity.hardFails.push({
      check: "low_invariant",
      detail: `row ${lowInvariantFailRow}: low > open/close/high`,
    });
  }
  if (volumeNegRow >= 0) {
    integrity.hardFails.push({
      check: "volume_nonneg",
      detail: `row ${volumeNegRow}: volume < 0`,
    });
  }

  // Sequence checks: strict ascending timestamps, no duplicates
  let ascFailRow = -1;
  let dupFailRow = -1;
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].ts;
    const cur  = candles[i].ts;
    if (Number.isFinite(prev) && Number.isFinite(cur)) {
      if (cur === prev && dupFailRow < 0) dupFailRow = i;
      else if (cur <= prev && ascFailRow < 0) ascFailRow = i;
    }
  }
  if (dupFailRow >= 0) {
    integrity.hardFails.push({
      check: "no_duplicate_timestamps",
      detail: `row ${dupFailRow} duplicates row ${dupFailRow - 1}`,
    });
  }
  if (ascFailRow >= 0) {
    integrity.hardFails.push({
      check: "strict_ascending_timestamps",
      detail: `row ${ascFailRow} ts <= prior row ts`,
    });
  }

  // Interval / gap detection (5m expected)
  let gapCount = 0;
  let intervalGapCount = 0;
  let bigGapRow = -1;
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].ts;
    const cur  = candles[i].ts;
    if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue;
    const dt = cur - prev;
    if (dt !== opts.intervalMs) {
      intervalGapCount++;
    }
    if (dt > opts.intervalMs) {
      gapCount++;
      if (dt > opts.maxGapMs && bigGapRow < 0) bigGapRow = i;
    }
  }
  integrity.stats.gapCount = gapCount;
  integrity.stats.intervalGapCount = intervalGapCount;
  if (intervalGapCount > 0) {
    integrity.softWarnings.push({
      check: "five_min_interval",
      detail: `${intervalGapCount} bar boundary(ies) not exactly ${opts.intervalMs}ms`,
      count: intervalGapCount,
    });
  }
  if (bigGapRow >= 0 && !opts.allowGaps) {
    integrity.hardFails.push({
      check: "max_gap",
      detail: `gap > ${opts.maxGapMs}ms first occurs at row ${bigGapRow}; pass {allowGaps:true} to soften`,
    });
  } else if (bigGapRow >= 0) {
    integrity.softWarnings.push({
      check: "max_gap",
      detail: `gap > ${opts.maxGapMs}ms at row ${bigGapRow} (allowed via allowGaps)`,
    });
  }

  return integrity;
}

// ─── Errors ────────────────────────────────────────────────────────────────
export class IntegrityError extends Error {
  constructor(integrity) {
    super(`integrity check failed: ${integrity.hardFails.map(f => f.check).join(", ")}`);
    this.name = "IntegrityError";
    this.integrity = integrity;
  }
}
