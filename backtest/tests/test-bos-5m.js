// Phase SV2-3B — node-script test runner for the 5-minute bullish
// Break-of-Structure (BOS) detector.
//
// Builds synthetic 5m candle streams in-memory and verifies:
//   - INSUFFICIENT_DATA returned for the first `lookback` bars
//   - bullish BOS fires when close > priorSwingHigh
//   - boundary close == priorSwingHigh does NOT trigger
//   - look-ahead protection
//   - determinism
//   - custom lookback works
//   - error paths fail cleanly
//
// Pure: no DB, no Kraken, no network, no env reads.

import {
  detectBos5m, bosAt, REASONS, DEFAULT_BOS_LOOKBACK,
} from "../src/features/bos-5m.js";

const RESET = "\x1b[0m"; const RED = "\x1b[31m"; const GREEN = "\x1b[32m"; const DIM = "\x1b[2m";
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }

let passCount = 0, failCount = 0;
const failed = [];
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 64)}`); passCount++; }
  else      { console.log(`  ${RED}FAIL${RESET}  ${pad(name, 64)} ${DIM}${detail}${RESET}`); failCount++; failed.push({ name, detail }); }
}

const FIVE_MIN_MS = 5 * 60 * 1000;

// Helper: build candles with explicit per-bar (high, close). open/low
// auto-derived to satisfy invariants but are not consulted by the BOS
// detector.
function makeCandles(specs, startTs = 1704067200000) {
  return specs.map((s, i) => {
    const high  = s.high;
    const close = s.close;
    const open  = s.open  ?? close;
    const low   = s.low   ?? Math.min(open, close, high) - 0.0001;
    return {
      ts:    s.ts ?? (startTs + i * FIVE_MIN_MS),
      open, high, low, close,
      volume: s.volume ?? 1000 + i,
    };
  });
}

function flatRun(n, level = 1.00) {
  return Array.from({ length: n }, () => ({ high: level, close: level }));
}

console.log("=== SV2-3B 5m bullish-BOS tests ===");
console.log("");

// ─── Default constants ────────────────────────────────────────────────────
{
  assert("DEFAULT_BOS_LOOKBACK === 12", DEFAULT_BOS_LOOKBACK === 12);
  assert("REASONS has 3 values",
    Object.keys(REASONS).length === 3
    && REASONS.INSUFFICIENT_DATA === "insufficient_data"
    && REASONS.NO_CLOSE_ABOVE === "no_close_above"
    && REASONS.BULLISH_BOS === "bullish_bos");
}

// ─── Empty input ──────────────────────────────────────────────────────────
{
  assert("detectBos5m: empty input → empty output",
    detectBos5m([]).length === 0);
}

// ─── Insufficient data: first 12 bars (default lookback=12) ──────────────
{
  const cs = makeCandles(flatRun(20, 1.00));
  const r = detectBos5m(cs);
  assert("insufficient: r length matches input", r.length === 20);
  let allInsufficient = true;
  for (let i = 0; i < 12; i++) {
    if (r[i].reason !== REASONS.INSUFFICIENT_DATA || r[i].bos !== false || r[i].priorSwingHigh !== null || r[i].direction !== null) {
      allInsufficient = false; break;
    }
  }
  assert("insufficient: r[0..11] all INSUFFICIENT, bos=false, priorSwingHigh=null, direction=null",
    allInsufficient);
  assert("insufficient: r[12] has priorSwingHigh !== null",
    r[12].priorSwingHigh !== null);
}

// ─── Custom lookback=5: only first 5 bars insufficient ───────────────────
{
  const cs = makeCandles(flatRun(10, 1.00));
  const r = detectBos5m(cs, { lookback: 5 });
  let firstFiveAllInsuf = true;
  for (let i = 0; i < 5; i++) if (r[i].reason !== REASONS.INSUFFICIENT_DATA) { firstFiveAllInsuf = false; break; }
  assert("custom lookback 5: r[0..4] all INSUFFICIENT", firstFiveAllInsuf);
  assert("custom lookback 5: r[5] not INSUFFICIENT",
    r[5].reason !== REASONS.INSUFFICIENT_DATA);
}

// ─── No close above: close <= priorSwingHigh → no_close_above ────────────
{
  // 12 bars at high=1.00, then a bar with close=1.00 (equal, not strictly above)
  const specs = [...flatRun(12, 1.00), { high: 1.005, close: 1.00 }];
  const cs = makeCandles(specs);
  const r = detectBos5m(cs);
  assert("no close above (close == priorSwingHigh): bos=false (strict >)",
    r[12].bos === false);
  assert("no close above: reason=no_close_above",
    r[12].reason === REASONS.NO_CLOSE_ABOVE);
  assert("no close above: priorSwingHigh recorded as 1.00",
    Math.abs(r[12].priorSwingHigh - 1.00) < 1e-12);
}

// ─── No close above: close strictly below priorSwingHigh ────────────────
{
  const specs = [...flatRun(12, 1.00), { high: 0.99, close: 0.985 }];
  const cs = makeCandles(specs);
  const r = detectBos5m(cs);
  assert("no close above (close < priorSwingHigh): bos=false",
    r[12].bos === false);
  assert("no close above (close < priorSwingHigh): reason=no_close_above",
    r[12].reason === REASONS.NO_CLOSE_ABOVE);
}

// ─── Boundary: close == priorSwingHigh → no_close_above (strict >) ──────
{
  const specs = [...flatRun(12, 1.00), { high: 1.005, close: 1.00 }];
  const cs = makeCandles(specs);
  const r = detectBos5m(cs);
  assert("boundary close == priorSwingHigh: bos=false (strict >)",
    r[12].bos === false && r[12].reason === REASONS.NO_CLOSE_ABOVE);
}

// ─── Bullish BOS: close > priorSwingHigh ────────────────────────────────
{
  const specs = [...flatRun(12, 1.00), { high: 1.05, close: 1.04 }];
  const cs = makeCandles(specs);
  const r = detectBos5m(cs);
  assert("bullish BOS: bos=true",
    r[12].bos === true);
  assert("bullish BOS: direction='bullish'",
    r[12].direction === "bullish");
  assert("bullish BOS: reason=bullish_bos",
    r[12].reason === REASONS.BULLISH_BOS);
  assert("bullish BOS: priorSwingHigh recorded as 1.00",
    Math.abs(r[12].priorSwingHigh - 1.00) < 1e-12);
  assert("bullish BOS: high recorded as 1.05",
    r[12].high === 1.05);
  assert("bullish BOS: close recorded as 1.04",
    r[12].close === 1.04);
}

// ─── priorSwingHigh = max over prior `lookback` bars (excludes current) ─
{
  // First 12 bars: highs alternating 1.00 and 1.01. priorSwingHigh at index 12 = 1.01.
  const highs = [];
  for (let i = 0; i < 12; i++) highs.push(i % 2 === 0 ? 1.00 : 1.01);
  const specs = highs.map(h => ({ high: h, close: h - 0.005 }));
  // Add a current bar that closes at 1.02 (above priorSwingHigh=1.01)
  specs.push({ high: 1.025, close: 1.02 });
  const cs = makeCandles(specs);
  const r = detectBos5m(cs);
  assert("priorSwingHigh excludes current bar: detected 1.01, not 1.025",
    Math.abs(r[12].priorSwingHigh - 1.01) < 1e-12);
  assert("priorSwingHigh excludes current bar: bullish BOS fires",
    r[12].bos === true && r[12].reason === REASONS.BULLISH_BOS);
}

// ─── Sliding lookback window ─────────────────────────────────────────────
{
  // 20 bars where the highest high (1.50) is at index 2.
  // After bar 14, the lookback window [3..14] no longer includes the 1.50.
  const specs = [];
  for (let i = 0; i < 20; i++) {
    if (i === 2) specs.push({ high: 1.50, close: 1.45 });
    else         specs.push({ high: 1.00, close: 0.995 });
  }
  // Bar 20: close=1.05 (above priorSwingHigh=1.00 from window [8..19])
  specs.push({ high: 1.06, close: 1.05 });
  const cs = makeCandles(specs);
  const r = detectBos5m(cs);
  assert("sliding lookback: priorSwingHigh at index 20 is 1.00 (not 1.50)",
    Math.abs(r[20].priorSwingHigh - 1.00) < 1e-12);
  assert("sliding lookback: bullish BOS fires at index 20",
    r[20].bos === true);
}

// ─── bosAt API ───────────────────────────────────────────────────────────
{
  const specs = [...flatRun(12, 1.00), { high: 1.05, close: 1.04 }];
  const cs = makeCandles(specs);
  const at12 = bosAt(cs, 12);
  assert("bosAt(12): returns annotation object",
    at12 && typeof at12 === "object" && "ts" in at12 && "bos" in at12);
  assert("bosAt(12): bos=true",
    at12.bos === true);
  const at0 = bosAt(cs, 0);
  assert("bosAt(0): INSUFFICIENT_DATA",
    at0.reason === REASONS.INSUFFICIENT_DATA);
  // out-of-range
  let nThrow = false, hThrow = false;
  try { bosAt(cs, -1); } catch (e) { nThrow = e instanceof RangeError; }
  try { bosAt(cs, 99); } catch (e) { hThrow = e instanceof RangeError; }
  assert("bosAt: negative index → RangeError", nThrow);
  assert("bosAt: out-of-bounds index → RangeError", hThrow);
}

// ─── Look-ahead protection ──────────────────────────────────────────────
{
  // Construct a 30-bar series with a known BOS at index 15.
  const specs = [];
  for (let i = 0; i < 12; i++) specs.push({ high: 1.00 + i * 0.0001, close: 0.995 });
  specs.push({ high: 1.06, close: 1.05 });   // BOS at index 12
  for (let i = 13; i < 30; i++) specs.push({ high: 1.10, close: 1.105 });
  const cs30 = makeCandles(specs);
  const r30 = detectBos5m(cs30);
  // Truncate to 20 bars and re-detect
  const r20 = detectBos5m(cs30.slice(0, 20));
  let identical = true;
  for (let i = 0; i < 20; i++) {
    if (r30[i].bos !== r20[i].bos
        || r30[i].reason !== r20[i].reason
        || r30[i].direction !== r20[i].direction
        || r30[i].priorSwingHigh !== r20[i].priorSwingHigh) {
      identical = false;
      console.log(`    diverge at i=${i}: r30=${JSON.stringify(r30[i])} r20=${JSON.stringify(r20[i])}`);
      break;
    }
  }
  assert("look-ahead: classify(0..19) identical when full set is 30", identical);
  // bosAt(cs30, 12) === detectBos5m(cs30.slice(0, 13))[12]
  const a = bosAt(cs30, 12);
  const b = detectBos5m(cs30.slice(0, 13))[12];
  assert("look-ahead: bosAt slicing matches manual slice",
    a.bos === b.bos && a.reason === b.reason);
}

// ─── Determinism ────────────────────────────────────────────────────────
{
  const specs = [];
  for (let i = 0; i < 50; i++) {
    const phase = Math.sin(i * 0.4);
    specs.push({ high: 1.00 + phase * 0.05 + 0.05, close: 1.00 + phase * 0.05 });
  }
  const cs = makeCandles(specs);
  const r1 = detectBos5m(cs);
  const r2 = detectBos5m(cs);
  assert("determinism: two runs JSON-equal",
    JSON.stringify(r1) === JSON.stringify(r2));
}

// ─── Multiple BOS in a single stream ────────────────────────────────────
{
  // 12 flat bars, BOS at 12, 4 flat bars near new high, BOS at 17, etc.
  const specs = [
    ...flatRun(12, 1.00),
    { high: 1.06, close: 1.05 },                  // BOS #1 at index 12 (prior high 1.00)
    ...Array.from({ length: 4 }, () => ({ high: 1.05, close: 1.05 })),
    { high: 1.11, close: 1.10 },                  // BOS #2 at index 17 (prior high 1.06)
    ...flatRun(5, 1.10),
  ];
  const cs = makeCandles(specs);
  const r = detectBos5m(cs);
  assert("multiple BOS: r[12].bos=true",
    r[12].bos === true && r[12].reason === REASONS.BULLISH_BOS);
  assert("multiple BOS: r[17].bos=true",
    r[17].bos === true && r[17].reason === REASONS.BULLISH_BOS);
  // r[18..22] should NOT be BOS (close=1.10 not above their priorSwingHigh which now includes 1.11)
  let postAllNonBos = true;
  for (let i = 18; i < r.length; i++) if (r[i].bos) { postAllNonBos = false; break; }
  assert("multiple BOS: bars after second BOS aren't BOS (close not above 1.11)",
    postAllNonBos);
}

// ─── Annotation shape ───────────────────────────────────────────────────
{
  const cs = makeCandles([...flatRun(12, 1.00), { high: 1.05, close: 1.04 }]);
  const r = detectBos5m(cs);
  const a = r[12];
  const expectedKeys = ["ts", "high", "close", "priorSwingHigh", "bos", "direction", "reason"];
  let allPresent = true;
  for (const k of expectedKeys) if (!(k in a)) { allPresent = false; break; }
  assert(`annotation has all 7 keys: ${expectedKeys.join(",")}`,
    allPresent);
}

// ─── Error paths ────────────────────────────────────────────────────────
{
  let t1 = false; try { detectBos5m("not-an-array"); } catch (e) { t1 = e instanceof TypeError; }
  assert("non-array input → TypeError", t1);

  let t2 = false;
  try { detectBos5m([{ ts: 1, high: NaN, close: 1 }]); } catch (e) { t2 = e instanceof TypeError; }
  assert("non-finite high → TypeError", t2);

  let t3 = false;
  try { detectBos5m([{ ts: 1, high: 1, close: 1 }], { lookback: 0 }); } catch (e) { t3 = e instanceof RangeError; }
  assert("lookback <= 0 → RangeError", t3);

  let t4 = false;
  try { detectBos5m([{ ts: 1, high: 1, close: 1 }], { lookback: 1.5 }); } catch (e) { t4 = e instanceof RangeError; }
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
