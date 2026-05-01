// Phase SV2-1 — node-script test runner for the backtest data loader.
//
// Exercises every integrity check against synthetic candles produced
// in-memory and against the fixture file at
// backtest/fixtures/tiny-replay-1day.json. Pure: no DB, no Kraken,
// no network.

import { writeFileSync, mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { loadCandles, IntegrityError, FIVE_MIN_MS } from "../src/data-loader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const FIXTURE_PATH = resolve(__dirname, "..", "fixtures", "tiny-replay-1day.json");

const RESET = "\x1b[0m"; const RED = "\x1b[31m"; const GREEN = "\x1b[32m"; const DIM = "\x1b[2m";
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }

let passCount = 0, failCount = 0;
const failed = [];
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 56)}`); passCount++; }
  else      { console.log(`  ${RED}FAIL${RESET}  ${pad(name, 56)} ${DIM}${detail}${RESET}`); failCount++; failed.push({ name, detail }); }
}

// Helper: write a temp JSON file with a candle array
function writeTempJson(filename, body) {
  const dir = mkdtempSync(join(tmpdir(), "sv2-test-"));
  const p = join(dir, filename);
  writeFileSync(p, JSON.stringify(body), "utf8");
  return { path: p, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function makeCleanCandles(n = 24, startTs = 1704067200000) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ts = startTs + i * FIVE_MIN_MS;
    const o = 1.0 + i * 0.0005;
    const c = o + 0.0005;
    out.push({ ts, open: o, high: c + 0.0001, low: o - 0.0001, close: c, volume: 1000 + i });
  }
  return out;
}

console.log("=== SV2-1 data loader tests ===");
console.log("");

// ─── Test 1: load fixture file successfully ────────────────────────────────
{
  assert("fixture: file exists", existsSync(FIXTURE_PATH), `expected fixture at ${FIXTURE_PATH}`);
  const result = loadCandles(FIXTURE_PATH);
  assert("fixture: loaded 24 candles", result.candles.length === 24,
    `got ${result.candles.length}`);
  assert("fixture: zero hard fails", result.integrity.hardFails.length === 0,
    JSON.stringify(result.integrity.hardFails));
  assert("fixture: zero soft warnings", result.integrity.softWarnings.length === 0,
    JSON.stringify(result.integrity.softWarnings));
  const c0 = result.candles[0];
  assert("fixture: first ts is 2024-01-01T00:00:00Z", c0.ts === 1704067200000, `got ${c0.ts}`);
  assert("fixture: first OHLC is finite", [c0.open, c0.high, c0.low, c0.close, c0.volume].every(Number.isFinite));
  const last = result.candles[result.candles.length - 1];
  assert("fixture: last ts = first + 23*5m", last.ts === 1704067200000 + 23 * FIVE_MIN_MS,
    `got ${last.ts}`);
}

// ─── Test 2: missing file ─────────────────────────────────────────────────
{
  let threw = false;
  try {
    loadCandles("/nonexistent/path.json");
  } catch (err) {
    threw = err instanceof IntegrityError && err.integrity.hardFails.some(f => f.check === "file_exists");
  }
  assert("missing file: throws IntegrityError with file_exists fail", threw);

  // Same with throwOnHard=false should return result with hard fail recorded
  const r = loadCandles("/nonexistent/path.json", { throwOnHard: false });
  assert("missing file (no-throw): hard fail recorded",
    r.integrity.hardFails.some(f => f.check === "file_exists"));
}

// ─── Test 3: unparseable JSON ─────────────────────────────────────────────
{
  const t = writeTempJson("bad.json", null);  // valid JSON but wrong shape
  // Overwrite with garbage
  writeFileSync(t.path, "{not valid json", "utf8");
  let hit = false;
  try { loadCandles(t.path); } catch (err) {
    hit = err instanceof IntegrityError && err.integrity.hardFails.some(f => f.check === "parseable");
  }
  assert("unparseable JSON: throws with parseable fail", hit);
  t.cleanup();
}

// ─── Test 4: non-finite OHLCV ─────────────────────────────────────────────
{
  const candles = makeCleanCandles(5);
  candles[2].close = "not-a-number";
  const t = writeTempJson("bad.json", { candles });
  let hit = false;
  try { loadCandles(t.path); } catch (err) {
    hit = err instanceof IntegrityError && err.integrity.hardFails.some(f => f.check === "finite_ohlcv");
  }
  assert("non-finite OHLCV: throws with finite_ohlcv fail", hit);
  t.cleanup();
}

// ─── Test 5: duplicate timestamps ─────────────────────────────────────────
{
  const candles = makeCleanCandles(5);
  candles[3].ts = candles[2].ts;   // duplicate
  // Sort to keep ascending where possible
  candles.sort((a, b) => a.ts - b.ts);
  const t = writeTempJson("bad.json", { candles });
  const r = loadCandles(t.path, { throwOnHard: false });
  assert("duplicate timestamps: hard fail recorded",
    r.integrity.hardFails.some(f => f.check === "no_duplicate_timestamps"));
  t.cleanup();
}

// ─── Test 6: non-ascending timestamps ─────────────────────────────────────
{
  const candles = makeCleanCandles(5);
  // Swap to introduce a descending pair
  const tmp = candles[1].ts; candles[1].ts = candles[3].ts; candles[3].ts = tmp;
  const t = writeTempJson("bad.json", { candles });
  const r = loadCandles(t.path, { throwOnHard: false });
  assert("non-ascending timestamps: hard fail recorded",
    r.integrity.hardFails.some(f => f.check === "strict_ascending_timestamps"));
  t.cleanup();
}

// ─── Test 7: high invariant violated ─────────────────────────────────────
{
  const candles = makeCleanCandles(5);
  candles[2].high = candles[2].open - 0.1;     // now high < open
  const t = writeTempJson("bad.json", { candles });
  const r = loadCandles(t.path, { throwOnHard: false });
  assert("high < open: hard fail recorded",
    r.integrity.hardFails.some(f => f.check === "high_invariant"));
  t.cleanup();
}

// ─── Test 8: low invariant violated ──────────────────────────────────────
{
  const candles = makeCleanCandles(5);
  candles[2].low = candles[2].close + 0.1;     // now low > close
  const t = writeTempJson("bad.json", { candles });
  const r = loadCandles(t.path, { throwOnHard: false });
  assert("low > close: hard fail recorded",
    r.integrity.hardFails.some(f => f.check === "low_invariant"));
  t.cleanup();
}

// ─── Test 9: volume negative ─────────────────────────────────────────────
{
  const candles = makeCleanCandles(5);
  candles[2].volume = -1;
  const t = writeTempJson("bad.json", { candles });
  const r = loadCandles(t.path, { throwOnHard: false });
  assert("negative volume: hard fail recorded",
    r.integrity.hardFails.some(f => f.check === "volume_nonneg"));
  t.cleanup();
}

// ─── Test 10: small gap (interval mismatch but < hard threshold) ─────────
{
  const candles = makeCleanCandles(10);
  // shift a single bar's ts to create a 10-min gap (one bar skipped, < 30min)
  candles[5].ts += FIVE_MIN_MS;
  for (let i = 6; i < candles.length; i++) candles[i].ts += FIVE_MIN_MS;
  const t = writeTempJson("bad.json", { candles });
  const r = loadCandles(t.path, { throwOnHard: false });
  assert("small gap: no hard fail",
    r.integrity.hardFails.length === 0,
    JSON.stringify(r.integrity.hardFails));
  assert("small gap: soft warning recorded for five_min_interval",
    r.integrity.softWarnings.some(w => w.check === "five_min_interval"));
  assert("small gap: stats.intervalGapCount > 0", r.integrity.stats.intervalGapCount > 0);
  t.cleanup();
}

// ─── Test 11: large gap (>30 min) hard fails by default ──────────────────
{
  const candles = makeCleanCandles(10);
  // Skip 10 bars (50 min gap)
  for (let i = 5; i < candles.length; i++) candles[i].ts += 10 * FIVE_MIN_MS;
  const t = writeTempJson("bad.json", { candles });
  let hit = false;
  try { loadCandles(t.path); } catch (err) {
    hit = err instanceof IntegrityError && err.integrity.hardFails.some(f => f.check === "max_gap");
  }
  assert("large gap (>30m): throws with max_gap fail by default", hit);

  // With allowGaps: true, should soften to warning
  const r = loadCandles(t.path, { allowGaps: true });
  assert("large gap with allowGaps:true: no hard fail",
    r.integrity.hardFails.length === 0,
    JSON.stringify(r.integrity.hardFails));
  assert("large gap with allowGaps:true: soft warning for max_gap",
    r.integrity.softWarnings.some(w => w.check === "max_gap"));
  t.cleanup();
}

// ─── Test 12: CSV format ─────────────────────────────────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), "sv2-test-csv-"));
  const p = join(dir, "candles.csv");
  const lines = ["timestamp,open,high,low,close,volume"];
  const candles = makeCleanCandles(5);
  for (const c of candles) {
    lines.push(`${c.ts},${c.open},${c.high},${c.low},${c.close},${c.volume}`);
  }
  writeFileSync(p, lines.join("\n"), "utf8");
  const r = loadCandles(p);
  assert("CSV: loaded 5 candles", r.candles.length === 5);
  assert("CSV: zero hard fails", r.integrity.hardFails.length === 0);
  assert("CSV: first ts matches", r.candles[0].ts === candles[0].ts);
  rmSync(dir, { recursive: true, force: true });
}

// ─── Test 13: CSV missing required column ────────────────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), "sv2-test-csv-"));
  const p = join(dir, "candles.csv");
  writeFileSync(p, "timestamp,open,high,low,close\n1704067200000,1,1,1,1\n", "utf8");  // no volume
  let hit = false;
  try { loadCandles(p); } catch (err) {
    hit = err instanceof IntegrityError && err.integrity.hardFails.some(f => f.check === "parseable");
  }
  assert("CSV missing 'volume' column: throws parseable fail", hit);
  rmSync(dir, { recursive: true, force: true });
}

// ─── Test 14: empty file ─────────────────────────────────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), "sv2-test-csv-"));
  const p = join(dir, "empty.json");
  writeFileSync(p, JSON.stringify({ candles: [] }), "utf8");
  let hit = false;
  try { loadCandles(p); } catch (err) {
    hit = err instanceof IntegrityError && err.integrity.hardFails.some(f => f.check === "non_empty");
  }
  assert("empty candles array: throws non_empty fail", hit);
  rmSync(dir, { recursive: true, force: true });
}

// ─── Summary ────────────────────────────────────────────────────────────
console.log("");
console.log(`SUMMARY:    pass=${passCount}  fail=${failCount}  total=${passCount + failCount}`);
if (failCount > 0) {
  console.log(`\n${RED}FAIL${RESET}`);
  for (const f of failed) console.log(`  - ${f.name} :: ${f.detail}`);
  process.exit(1);
}
console.log(`\n${GREEN}OK${RESET}`);
process.exit(0);
