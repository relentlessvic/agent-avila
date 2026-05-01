// Phase SV2-3A — node-script test runner for the 15-minute bullish
// liquidity-sweep detector.
//
// Builds synthetic 15m candle streams in-memory and verifies:
//   - INSUFFICIENT_DATA returned for the first `lookback` bars
//   - bullish sweep fires when low < priorLow AND close > priorLow
//   - boundary cases (low == priorLow, close == priorLow) do NOT trigger
//   - look-ahead protection
//   - determinism
//   - custom lookback works
//   - error paths fail cleanly
//
// Pure: no DB, no Kraken, no network, no env reads.

import {
  detectSweeps15m, sweepAt, REASONS, DEFAULT_SWEEP_LOOKBACK,
} from "../src/features/sweep-15m.js";

const RESET = "\x1b[0m"; const RED = "\x1b[31m"; const GREEN = "\x1b[32m"; const DIM = "\x1b[2m";
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }

let passCount = 0, failCount = 0;
const failed = [];
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 64)}`); passCount++; }
  else      { console.log(`  ${RED}FAIL${RESET}  ${pad(name, 64)} ${DIM}${detail}${RESET}`); failCount++; failed.push({ name, detail }); }
}

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

// Helper: build candles with explicit per-bar (low, close). open/high
// auto-derived to satisfy invariants but they are not consulted by the
// sweep detector.
function makeCandles(specs, startTs = 1704067200000) {
  return specs.map((s, i) => {
    const low   = s.low;
    const close = s.close;
    const open  = s.open  ?? close;
    const high  = s.high  ?? Math.max(open, close, low) + 0.0001;
    return {
      ts:    s.ts ?? (startTs + i * FIFTEEN_MIN_MS),
      open, high, low, close,
      volume: s.volume ?? 1000 + i,
    };
  });
}

// Helper: a series of identical low=1.00 close=1.00 candles
function flatRun(n, level = 1.00) {
  return Array.from({ length: n }, () => ({ low: level, close: level }));
}

console.log("=== SV2-3A 15m bullish-sweep tests ===");
console.log("");

// ─── Default lookback constant ────────────────────────────────────────────
{
  assert("DEFAULT_SWEEP_LOOKBACK === 20", DEFAULT_SWEEP_LOOKBACK === 20);
  assert("REASONS has all 4 values",
    Object.keys(REASONS).length === 4
    && REASONS.INSUFFICIENT_DATA === "insufficient_data"
    && REASONS.NO_BREAK_BELOW === "no_break_below"
    && REASONS.NO_CLOSE_ABOVE === "no_close_above"
    && REASONS.BULLISH_SWEEP === "bullish_sweep");
}

// ─── Empty input ──────────────────────────────────────────────────────────
{
  assert("detectSweeps15m: empty input → empty output",
    detectSweeps15m([]).length === 0);
}

// ─── Insufficient data: first 20 bars (default lookback=20) ──────────────
{
  const cs = makeCandles(flatRun(25, 1.00));
  const r = detectSweeps15m(cs);
  assert("insufficient: r length matches input", r.length === 25);
  let allInsufficient = true;
  for (let i = 0; i < 20; i++) {
    if (r[i].reason !== REASONS.INSUFFICIENT_DATA || r[i].swept !== false || r[i].priorLow !== null || r[i].direction !== null) {
      allInsufficient = false; break;
    }
  }
  assert("insufficient: r[0..19] all INSUFFICIENT, swept=false, priorLow=null, direction=null",
    allInsufficient);
  // r[20] should have a priorLow value (not null)
  assert("insufficient: r[20] has priorLow !== null",
    r[20].priorLow !== null);
}

// ─── Custom lookback=5: only first 5 bars insufficient ───────────────────
{
  const cs = makeCandles(flatRun(10, 1.00));
  const r = detectSweeps15m(cs, { lookback: 5 });
  let firstFiveAllInsuf = true;
  for (let i = 0; i < 5; i++) if (r[i].reason !== REASONS.INSUFFICIENT_DATA) { firstFiveAllInsuf = false; break; }
  assert("custom lookback 5: r[0..4] all INSUFFICIENT", firstFiveAllInsuf);
  assert("custom lookback 5: r[5] not INSUFFICIENT",
    r[5].reason !== REASONS.INSUFFICIENT_DATA);
}

// ─── No break below: low >= priorLow → no_break_below ────────────────────
{
  // 20 bars at low=1.00, then a bar with low=1.00 (equal, not strictly below) and close above
  const specs = [...flatRun(20, 1.00), { low: 1.00, close: 1.10 }];
  const cs = makeCandles(specs);
  const r = detectSweeps15m(cs);
  assert("no break below (low == priorLow): swept=false",
    r[20].swept === false);
  assert("no break below (low == priorLow): reason=no_break_below",
    r[20].reason === REASONS.NO_BREAK_BELOW);
  assert("no break below: priorLow recorded as 1.00",
    Math.abs(r[20].priorLow - 1.00) < 1e-12);
}

// ─── Wick but no close back: low < priorLow, close <= priorLow ──────────
{
  // 20 bars at low=1.00, close=1.00; then bar low=0.95, close=0.97 (below priorLow)
  const specs = [...flatRun(20, 1.00), { low: 0.95, close: 0.97 }];
  const cs = makeCandles(specs);
  const r = detectSweeps15m(cs);
  assert("wick no close back (close < priorLow): swept=false",
    r[20].swept === false);
  assert("wick no close back: reason=no_close_above",
    r[20].reason === REASONS.NO_CLOSE_ABOVE);
}

// ─── Boundary: close == priorLow → no_close_above (strict >) ─────────────
{
  const specs = [...flatRun(20, 1.00), { low: 0.95, close: 1.00 }];
  const cs = makeCandles(specs);
  const r = detectSweeps15m(cs);
  assert("boundary close == priorLow: swept=false (strict >)",
    r[20].swept === false);
  assert("boundary close == priorLow: reason=no_close_above",
    r[20].reason === REASONS.NO_CLOSE_ABOVE);
}

// ─── Bullish sweep: low < priorLow AND close > priorLow ─────────────────
{
  const specs = [...flatRun(20, 1.00), { low: 0.95, close: 1.05 }];
  const cs = makeCandles(specs);
  const r = detectSweeps15m(cs);
  assert("bullish sweep: swept=true",
    r[20].swept === true);
  assert("bullish sweep: direction='bullish'",
    r[20].direction === "bullish");
  assert("bullish sweep: reason=bullish_sweep",
    r[20].reason === REASONS.BULLISH_SWEEP);
  assert("bullish sweep: priorLow recorded as 1.00",
    Math.abs(r[20].priorLow - 1.00) < 1e-12);
  assert("bullish sweep: low recorded as 0.95",
    r[20].low === 0.95);
  assert("bullish sweep: close recorded as 1.05",
    r[20].close === 1.05);
}

// ─── priorLow is min over the prior `lookback` bars, NOT including current ─
{
  // First 20 bars: lows alternating 1.00 and 0.99. priorLow at index 20 = 0.99.
  const lows = [];
  for (let i = 0; i < 20; i++) lows.push(i % 2 === 0 ? 1.00 : 0.99);
  const specs = lows.map(l => ({ low: l, close: l + 0.005 }));
  // Add a current bar that wicks to 0.98 (below priorLow=0.99) and closes 1.00
  specs.push({ low: 0.98, close: 1.00 });
  const cs = makeCandles(specs);
  const r = detectSweeps15m(cs);
  assert("priorLow excludes current bar: detected 0.99 from lookback, not 0.98",
    Math.abs(r[20].priorLow - 0.99) < 1e-12);
  assert("priorLow excludes current bar: bullish sweep fires (0.98<0.99 and 1.00>0.99)",
    r[20].swept === true && r[20].reason === REASONS.BULLISH_SWEEP);
}

// ─── priorLow window slides forward ─────────────────────────────────────
{
  // Build 30 bars where the lowest low (0.50) is in the first 5 bars.
  // After bar 25, the lookback window [5..24] no longer includes the 0.50.
  const specs = [];
  for (let i = 0; i < 30; i++) {
    if (i === 2) specs.push({ low: 0.50, close: 0.55 });
    else         specs.push({ low: 1.00, close: 1.005 });
  }
  // Add bar 30: low=0.95, close=1.05 — should sweep against priorLow=1.00 (window [10..29])
  specs.push({ low: 0.95, close: 1.05 });
  const cs = makeCandles(specs);
  const r = detectSweeps15m(cs);
  assert("sliding lookback: priorLow at index 30 is 1.00 (not 0.50)",
    Math.abs(r[30].priorLow - 1.00) < 1e-12);
  assert("sliding lookback: bullish sweep fires at index 30",
    r[30].swept === true);
}

// ─── sweepAt API ─────────────────────────────────────────────────────────
{
  const specs = [...flatRun(20, 1.00), { low: 0.95, close: 1.05 }];
  const cs = makeCandles(specs);
  const at20 = sweepAt(cs, 20);
  assert("sweepAt(20): returns annotation object",
    at20 && typeof at20 === "object" && "ts" in at20 && "swept" in at20);
  assert("sweepAt(20): swept=true",
    at20.swept === true);
  const at0 = sweepAt(cs, 0);
  assert("sweepAt(0): INSUFFICIENT_DATA",
    at0.reason === REASONS.INSUFFICIENT_DATA);
  // out-of-range
  let nThrow = false, hThrow = false;
  try { sweepAt(cs, -1); } catch (e) { nThrow = e instanceof RangeError; }
  try { sweepAt(cs, 99); } catch (e) { hThrow = e instanceof RangeError; }
  assert("sweepAt: negative index → RangeError", nThrow);
  assert("sweepAt: out-of-bounds index → RangeError", hThrow);
}

// ─── Look-ahead protection ──────────────────────────────────────────────
{
  // Construct a 30-bar series with a known sweep at index 20.
  const specs = [];
  for (let i = 0; i < 20; i++) specs.push({ low: 1.00 + i * 0.0001, close: 1.005 });
  specs.push({ low: 0.95, close: 1.05 });   // sweep at index 20
  for (let i = 21; i < 30; i++) specs.push({ low: 1.10, close: 1.105 });
  const cs30 = makeCandles(specs);
  const r30 = detectSweeps15m(cs30);
  // Truncate to 25 bars and re-detect
  const r25 = detectSweeps15m(cs30.slice(0, 25));
  let identical = true;
  for (let i = 0; i < 25; i++) {
    if (r30[i].swept !== r25[i].swept
        || r30[i].reason !== r25[i].reason
        || r30[i].direction !== r25[i].direction
        || r30[i].priorLow !== r25[i].priorLow) {
      identical = false;
      console.log(`    diverge at i=${i}: r30=${JSON.stringify(r30[i])} r25=${JSON.stringify(r25[i])}`);
      break;
    }
  }
  assert("look-ahead: classify(0..24) identical when full set is 30", identical);
  // sweepAt(cs30, 20) === detectSweeps15m(cs30.slice(0, 21))[20]
  const a = sweepAt(cs30, 20);
  const b = detectSweeps15m(cs30.slice(0, 21))[20];
  assert("look-ahead: sweepAt slicing matches manual slice",
    a.swept === b.swept && a.reason === b.reason);
}

// ─── Determinism ────────────────────────────────────────────────────────
{
  const specs = [];
  for (let i = 0; i < 50; i++) {
    const phase = Math.sin(i * 0.4);
    specs.push({ low: 1.00 + phase * 0.05 - 0.05, close: 1.00 + phase * 0.05 });
  }
  const cs = makeCandles(specs);
  const r1 = detectSweeps15m(cs);
  const r2 = detectSweeps15m(cs);
  assert("determinism: two runs JSON-equal",
    JSON.stringify(r1) === JSON.stringify(r2));
}

// ─── Multiple sweeps in a single stream ─────────────────────────────────
{
  // 20 flat bars, sweep at 20, 4 flat bars, sweep at 25, 5 flat bars
  const specs = [
    ...flatRun(20, 1.00),
    { low: 0.95, close: 1.05 },                 // sweep #1 at index 20
    ...flatRun(4, 1.00),
    { low: 0.90, close: 1.10 },                 // sweep #2 at index 25
    ...flatRun(5, 1.00),
  ];
  const cs = makeCandles(specs);
  const r = detectSweeps15m(cs);
  assert("multiple sweeps: r[20].swept=true",
    r[20].swept === true && r[20].reason === REASONS.BULLISH_SWEEP);
  assert("multiple sweeps: r[25].swept=true",
    r[25].swept === true && r[25].reason === REASONS.BULLISH_SWEEP);
  // Verify r[26..29] are not sweeps (no further breaks)
  let postAllNonSweep = true;
  for (let i = 26; i < r.length; i++) if (r[i].swept) { postAllNonSweep = false; break; }
  assert("multiple sweeps: post-sweep flat bars are not swept",
    postAllNonSweep);
}

// ─── Annotation shape ───────────────────────────────────────────────────
{
  const cs = makeCandles([...flatRun(20, 1.00), { low: 0.95, close: 1.05 }]);
  const r = detectSweeps15m(cs);
  const a = r[20];
  const expectedKeys = ["ts", "low", "close", "priorLow", "swept", "direction", "reason"];
  let allPresent = true;
  for (const k of expectedKeys) if (!(k in a)) { allPresent = false; break; }
  assert(`annotation has all 7 keys: ${expectedKeys.join(",")}`,
    allPresent);
}

// ─── Error paths ────────────────────────────────────────────────────────
{
  let t1 = false; try { detectSweeps15m("not-an-array"); } catch (e) { t1 = e instanceof TypeError; }
  assert("non-array input → TypeError", t1);

  let t2 = false;
  try { detectSweeps15m([{ ts: 1, low: NaN, close: 1 }]); } catch (e) { t2 = e instanceof TypeError; }
  assert("non-finite low → TypeError", t2);

  let t3 = false;
  try { detectSweeps15m([{ ts: 1, low: 1, close: 1 }], { lookback: 0 }); } catch (e) { t3 = e instanceof RangeError; }
  assert("lookback <= 0 → RangeError", t3);

  let t4 = false;
  try { detectSweeps15m([{ ts: 1, low: 1, close: 1 }], { lookback: 1.5 }); } catch (e) { t4 = e instanceof RangeError; }
  assert("non-integer lookback → RangeError", t4);
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
