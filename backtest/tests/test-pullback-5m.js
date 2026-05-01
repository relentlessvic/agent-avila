// Phase SV2-3C — node-script test runner for the 5-minute long-only
// pullback entry-zone detector.
//
// Builds synthetic 5m candle streams in-memory and verifies:
//   - INSUFFICIENT_DATA / NO_ACTIVE_BOS / IN_PULLBACK_ZONE / ABOVE_ZONE /
//     BELOW_ZONE / LEG_INVALIDATED classifications fire correctly
//   - fib50 / fib79 arithmetic is correct for known legs
//   - leg invalidation is sticky (once blown, stays blown until next BOS)
//   - bosHorizon expiration drops the leg
//   - look-ahead protection
//   - determinism
//   - custom config + error paths
//
// Pure: no DB, no Kraken, no network, no env reads.

import {
  detectPullbacks5m, pullbackAt, REASONS, DEFAULT_PULLBACK_CONFIG,
} from "../src/features/pullback-5m.js";

const RESET = "\x1b[0m"; const RED = "\x1b[31m"; const GREEN = "\x1b[32m"; const DIM = "\x1b[2m";
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }

let passCount = 0, failCount = 0;
const failed = [];
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 64)}`); passCount++; }
  else      { console.log(`  ${RED}FAIL${RESET}  ${pad(name, 64)} ${DIM}${detail}${RESET}`); failCount++; failed.push({ name, detail }); }
}

const FIVE_MIN_MS = 5 * 60 * 1000;
const APPROX = (a, b) => Math.abs(a - b) < 1e-9;

// Build candles from explicit { high, low, close } specs.
function makeCandles(specs, startTs = 1704067200000) {
  return specs.map((s, i) => {
    const high  = s.high;
    const low   = s.low;
    const close = s.close ?? (high + low) / 2;
    const open  = s.open ?? close;
    return {
      ts: s.ts ?? (startTs + i * FIVE_MIN_MS),
      open, high, low, close,
      volume: s.volume ?? 1000 + i,
    };
  });
}

// Helper: build a baseline "pre-BOS" leg.
//   12 prior bars: high=1.00, low=0.95, close=0.99
//   priorSwingHigh (BOS detector) = 1.00
//   bosLegLow (pullback feature) = 0.95
//   At index 12, the BOS bar with high=1.10, low=1.05, close=1.05 confirms BOS.
//   Leg: high=1.10, low=0.95, range=0.15
//   fib50 = 1.10 − 0.5*0.15 = 1.025
//   fib79 = 1.10 − 0.79*0.15 = 0.9815
function baselineWithBos() {
  const specs = [];
  for (let i = 0; i < 12; i++) {
    specs.push({ high: 1.00, low: 0.95, close: 0.99 });
  }
  // BOS bar at index 12
  specs.push({ high: 1.10, low: 1.05, close: 1.05 });
  return specs;
}

console.log("=== SV2-3C 5m pullback-zone tests ===");
console.log("");

// ─── Default config + REASONS ────────────────────────────────────────────
{
  assert("DEFAULT bosLookback === 12", DEFAULT_PULLBACK_CONFIG.bosLookback === 12);
  assert("DEFAULT bosHorizon === 24",  DEFAULT_PULLBACK_CONFIG.bosHorizon === 24);
  assert("DEFAULT fibLowerPct === 0.50", DEFAULT_PULLBACK_CONFIG.fibLowerPct === 0.50);
  assert("DEFAULT fibUpperPct === 0.79", DEFAULT_PULLBACK_CONFIG.fibUpperPct === 0.79);
  assert("REASONS has all 6 values",
    Object.keys(REASONS).length === 6
    && REASONS.INSUFFICIENT_DATA === "insufficient_data"
    && REASONS.NO_ACTIVE_BOS === "no_active_bos"
    && REASONS.LEG_INVALIDATED === "leg_invalidated"
    && REASONS.ABOVE_ZONE === "above_zone"
    && REASONS.IN_PULLBACK_ZONE === "in_pullback_zone"
    && REASONS.BELOW_ZONE === "below_zone");
}

// ─── Empty input ──────────────────────────────────────────────────────────
{
  assert("detectPullbacks5m: empty input → empty output",
    detectPullbacks5m([]).length === 0);
}

// ─── Insufficient data: indices < bosLookback (12) ───────────────────────
{
  const specs = [];
  for (let i = 0; i < 20; i++) specs.push({ high: 1.0, low: 0.95, close: 0.99 });
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs);
  assert("insufficient: r length matches input", r.length === 20);
  let allInsuf = true;
  for (let i = 0; i < 12; i++) {
    if (r[i].reason !== REASONS.INSUFFICIENT_DATA
        || r[i].inPullbackZone !== false
        || r[i].bosLegLow !== null || r[i].bosLegHigh !== null
        || r[i].fib50 !== null || r[i].fib79 !== null) {
      allInsuf = false; break;
    }
  }
  assert("insufficient: r[0..11] all INSUFFICIENT_DATA with all leg/fib fields null",
    allInsuf);
}

// ─── No BOS in stream → NO_ACTIVE_BOS after warmup ────────────────────────
{
  // 30 bars of flat sideways action, no BOS ever fires
  const specs = Array.from({ length: 30 }, () => ({ high: 1.00, low: 0.99, close: 0.995 }));
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs);
  assert("no BOS: r[12..29] all NO_ACTIVE_BOS",
    r.slice(12).every(x => x.reason === REASONS.NO_ACTIVE_BOS));
  assert("no BOS: inPullbackZone false everywhere",
    r.every(x => x.inPullbackZone === false));
  assert("no BOS: bosLegLow/High/fib50/fib79 all null",
    r.every(x => x.bosLegLow === null && x.bosLegHigh === null && x.fib50 === null && x.fib79 === null));
}

// ─── Baseline scenario: BOS at i=12, pullback at i=13 ────────────────────
{
  const specs = baselineWithBos();
  // Bar 13: pullback into zone. low=1.00, high=1.04, close=1.01
  specs.push({ high: 1.04, low: 1.00, close: 1.01 });
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs);

  // BOS bar (index 12) itself: NO_ACTIVE_BOS (BOS hasn't "fired yet" from i=12's pov)
  assert("BOS bar i=12: NO_ACTIVE_BOS (no prior BOS exists at j<12)",
    r[12].reason === REASONS.NO_ACTIVE_BOS);

  // Pullback bar (index 13)
  const a = r[13];
  assert("pullback i=13: bosLegHigh = 1.10",
    APPROX(a.bosLegHigh, 1.10), `got ${a.bosLegHigh}`);
  assert("pullback i=13: bosLegLow = 0.95",
    APPROX(a.bosLegLow, 0.95), `got ${a.bosLegLow}`);
  assert("pullback i=13: fib50 = 1.025",
    APPROX(a.fib50, 1.025), `got ${a.fib50}`);
  assert("pullback i=13: fib79 ≈ 0.9815",
    APPROX(a.fib79, 0.9815), `got ${a.fib79}`);
  assert("pullback i=13: inPullbackZone === true",
    a.inPullbackZone === true);
  assert("pullback i=13: reason === IN_PULLBACK_ZONE",
    a.reason === REASONS.IN_PULLBACK_ZONE);
}

// ─── ABOVE_ZONE: candle entirely above fib50 ─────────────────────────────
{
  const specs = baselineWithBos();
  // Bar 13: low=1.04, high=1.06, close=1.05 → above fib50 (1.025)
  specs.push({ high: 1.06, low: 1.04, close: 1.05 });
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs);
  assert("above zone: r[13].reason === ABOVE_ZONE",
    r[13].reason === REASONS.ABOVE_ZONE);
  assert("above zone: inPullbackZone === false", r[13].inPullbackZone === false);
}

// ─── BELOW_ZONE: candle below fib79 but above bosLegLow ──────────────────
{
  const specs = baselineWithBos();
  // Bar 13: low=0.96, high=0.97, close=0.965 → below fib79 (0.9815) but above bosLegLow (0.95)
  specs.push({ high: 0.97, low: 0.96, close: 0.965 });
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs);
  assert("below zone: r[13].reason === BELOW_ZONE",
    r[13].reason === REASONS.BELOW_ZONE);
  assert("below zone: inPullbackZone === false", r[13].inPullbackZone === false);
  // fib levels should still be reported
  assert("below zone: fib50 reported", APPROX(r[13].fib50, 1.025));
  assert("below zone: fib79 reported", APPROX(r[13].fib79, 0.9815));
}

// ─── LEG_INVALIDATED: bar's low strictly breaks bosLegLow ────────────────
{
  const specs = baselineWithBos();
  // Bar 13: low=0.94 (< bosLegLow=0.95), high=1.00, close=0.98
  specs.push({ high: 1.00, low: 0.94, close: 0.98 });
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs);
  assert("invalidation: r[13].reason === LEG_INVALIDATED",
    r[13].reason === REASONS.LEG_INVALIDATED);
  assert("invalidation: inPullbackZone === false",
    r[13].inPullbackZone === false);
  assert("invalidation: bosLegLow still reported (0.95)",
    APPROX(r[13].bosLegLow, 0.95));
}

// ─── Strict invalidation: low == bosLegLow does NOT invalidate ───────────
{
  const specs = baselineWithBos();
  // Bar 13: low=0.95 (equal to bosLegLow), high=1.04, close=1.01 → still in zone
  specs.push({ high: 1.04, low: 0.95, close: 1.01 });
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs);
  assert("strict invalidation: low == bosLegLow does NOT invalidate (still IN_PULLBACK_ZONE)",
    r[13].reason === REASONS.IN_PULLBACK_ZONE && r[13].inPullbackZone === true);
}

// ─── Sticky invalidation: bar 13 invalidates, bar 14 in zone but still LEG_INVALIDATED ──
{
  const specs = baselineWithBos();
  specs.push({ high: 1.00, low: 0.94, close: 0.98 });   // bar 13 invalidates
  specs.push({ high: 1.04, low: 1.00, close: 1.01 });   // bar 14 would be IN_PULLBACK_ZONE if leg were alive
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs);
  assert("sticky invalidation: r[14] is LEG_INVALIDATED (not IN_PULLBACK_ZONE)",
    r[14].reason === REASONS.LEG_INVALIDATED && r[14].inPullbackZone === false);
}

// ─── BOS horizon expiration: > bosHorizon bars after BOS → NO_ACTIVE_BOS ──
{
  const specs = baselineWithBos();
  // Add 25 bars staying above the zone (no pullback into zone, no invalidation)
  for (let k = 0; k < 25; k++) {
    specs.push({ high: 1.06, low: 1.04, close: 1.05 });
  }
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs);
  // bosIdx = 12, bosHorizon=24
  // At i=12+24=36: bosIdx is at i-bosHorizon=12 → still in range → ABOVE_ZONE
  assert("horizon: r[36] still references the BOS (within horizon)",
    r[36].reason === REASONS.ABOVE_ZONE);
  // At i=12+25=37: bosIdx=12 is at i-bosHorizon-1 → out of range → NO_ACTIVE_BOS
  assert("horizon: r[37] BOS expired (NO_ACTIVE_BOS)",
    r[37].reason === REASONS.NO_ACTIVE_BOS);
  assert("horizon expired: bosLegLow/High null",
    r[37].bosLegLow === null && r[37].bosLegHigh === null);
}

// ─── Multiple BOS: most recent one is used ───────────────────────────────
{
  const specs = baselineWithBos();
  // Bar 13: above zone (bar still has bosIdx=12 active)
  specs.push({ high: 1.06, low: 1.04, close: 1.05 });
  // Bars 14..23: stay above 1.10 to set up new priorSwingHigh ≈ 1.06 within next lookback
  for (let k = 0; k < 11; k++) {
    specs.push({ high: 1.06, low: 1.05, close: 1.055 });
  }
  // Bar 25: a fresh BOS — close > priorSwingHigh of recent 12 bars (which is 1.06)
  specs.push({ high: 1.20, low: 1.15, close: 1.15 });
  // Bar 26: pullback for the NEW BOS
  // New leg: bosLegHigh = 1.20, bosLegLow = min over candles[13..24].low
  //   candles[13]: low=1.04
  //   candles[14..24]: low=1.05
  //   So bosLegLow = 1.04
  // range = 0.16, fib50 = 1.20 - 0.08 = 1.12, fib79 = 1.20 - 0.1264 = 1.0736
  // Bar 26: low=1.10, high=1.14, close=1.11 → in zone (1.10 <= 1.12 AND 1.14 >= 1.0736)
  specs.push({ high: 1.14, low: 1.10, close: 1.11 });
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs);
  const a = r[26];
  assert("multiple BOS: r[26].bosLegHigh = 1.20 (newer BOS)",
    APPROX(a.bosLegHigh, 1.20), `got ${a.bosLegHigh}`);
  assert("multiple BOS: r[26].bosLegLow = 1.04 (newer leg low)",
    APPROX(a.bosLegLow, 1.04), `got ${a.bosLegLow}`);
  assert("multiple BOS: r[26] inPullbackZone === true",
    a.inPullbackZone === true && a.reason === REASONS.IN_PULLBACK_ZONE);
}

// ─── pullbackAt API ──────────────────────────────────────────────────────
{
  const specs = baselineWithBos();
  specs.push({ high: 1.04, low: 1.00, close: 1.01 });
  const cs = makeCandles(specs);
  const at13 = pullbackAt(cs, 13);
  assert("pullbackAt(13): returns annotation object",
    at13 && typeof at13 === "object" && "inPullbackZone" in at13);
  assert("pullbackAt(13): inPullbackZone === true",
    at13.inPullbackZone === true);
  const at0 = pullbackAt(cs, 0);
  assert("pullbackAt(0): INSUFFICIENT_DATA",
    at0.reason === REASONS.INSUFFICIENT_DATA);
  let nThrow = false, hThrow = false;
  try { pullbackAt(cs, -1); } catch (e) { nThrow = e instanceof RangeError; }
  try { pullbackAt(cs, 999); } catch (e) { hThrow = e instanceof RangeError; }
  assert("pullbackAt: negative index → RangeError", nThrow);
  assert("pullbackAt: out-of-bounds → RangeError", hThrow);
}

// ─── Look-ahead protection ──────────────────────────────────────────────
{
  const specs = baselineWithBos();
  specs.push({ high: 1.04, low: 1.00, close: 1.01 });    // pullback at 13
  for (let k = 0; k < 10; k++) specs.push({ high: 1.06, low: 1.04, close: 1.05 });  // 14..23
  const cs = makeCandles(specs);
  const rFull = detectPullbacks5m(cs);
  const rTrunc = detectPullbacks5m(cs.slice(0, 16));
  let identical = true;
  for (let i = 0; i < 16; i++) {
    if (rFull[i].reason !== rTrunc[i].reason
        || rFull[i].inPullbackZone !== rTrunc[i].inPullbackZone
        || (rFull[i].bosLegLow ?? null) !== (rTrunc[i].bosLegLow ?? null)
        || (rFull[i].bosLegHigh ?? null) !== (rTrunc[i].bosLegHigh ?? null)) {
      identical = false;
      console.log(`    diverge at i=${i}: full=${JSON.stringify(rFull[i])} trunc=${JSON.stringify(rTrunc[i])}`);
      break;
    }
  }
  assert("look-ahead: classify(0..15) identical when full set is 24", identical);
  const a = pullbackAt(cs, 13);
  const b = detectPullbacks5m(cs.slice(0, 14))[13];
  assert("look-ahead: pullbackAt slicing matches manual slice",
    a.reason === b.reason && a.inPullbackZone === b.inPullbackZone);
}

// ─── Determinism ────────────────────────────────────────────────────────
{
  const specs = baselineWithBos();
  for (let k = 0; k < 20; k++) {
    specs.push({ high: 1.05 + Math.sin(k) * 0.01, low: 1.00 + Math.sin(k) * 0.01, close: 1.025 + Math.sin(k) * 0.01 });
  }
  const cs = makeCandles(specs);
  const r1 = detectPullbacks5m(cs);
  const r2 = detectPullbacks5m(cs);
  assert("determinism: two runs JSON-equal",
    JSON.stringify(r1) === JSON.stringify(r2));
}

// ─── Custom config: tighter fib (50%-65%) and shorter horizon ────────────
{
  const specs = baselineWithBos();
  // Bar 13: low=1.05, high=1.06, close=1.055 (i.e., between fib65 and fib50 of default; only IN_ZONE under tighter config)
  // For default 50-79: zone = [0.9815, 1.025], 1.05/1.06 above zone → ABOVE_ZONE
  // For tighter 50-65: range=0.15, fib65 = 1.10 - 0.0975 = 1.0025, zone=[1.0025, 1.025]
  //   bar [1.05, 1.06]: low=1.05 > fib50=1.025 → ABOVE_ZONE still
  // Need a different test: bar fully in [0.9815, 1.025] with default but outside [1.0025, 1.025] tight
  //   bar [1.00, 1.02, close=1.01]: in default zone (1.00<=1.025 and 1.02>=0.9815) ✓
  //   in tight zone [1.0025, 1.025]: low=1.00 <= 1.025 ✓ AND high=1.02 >= 1.0025 ✓ → IN_PULLBACK_ZONE
  // OK both classify as IN_PULLBACK_ZONE. That doesn't differentiate.
  // Let's make a test that just verifies the custom fib levels are used:
  specs.push({ high: 1.04, low: 1.00, close: 1.01 });   // baseline pullback bar
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs, { fibLowerPct: 0.30, fibUpperPct: 0.40 });
  // Custom fib: fib30 = 1.10 - 0.30*0.15 = 1.055; fib40 = 1.10 - 0.40*0.15 = 1.04
  // Custom zone: [1.04, 1.055]
  // Bar [1.00, 1.04, close=1.01]: low=1.00 <= 1.055 ✓ AND high=1.04 >= 1.04 ✓ → IN_PULLBACK_ZONE
  assert("custom fib: still classifies in zone",
    r[13].reason === REASONS.IN_PULLBACK_ZONE);
  assert("custom fib: fib50 (now @ 30%) ≈ 1.055",
    APPROX(r[13].fib50, 1.055));
  assert("custom fib: fib79 (now @ 40%) ≈ 1.04",
    APPROX(r[13].fib79, 1.04));
}

// ─── Custom shorter bosHorizon expires earlier ──────────────────────────
{
  const specs = baselineWithBos();
  for (let k = 0; k < 10; k++) specs.push({ high: 1.06, low: 1.04, close: 1.05 });
  const cs = makeCandles(specs);
  const r = detectPullbacks5m(cs, { bosHorizon: 5 });
  // bosIdx=12, bosHorizon=5. At i=17 (within horizon) → ABOVE_ZONE. At i=18 (out of horizon) → NO_ACTIVE_BOS
  assert("custom horizon=5: r[17] still tracks BOS",
    r[17].reason === REASONS.ABOVE_ZONE);
  assert("custom horizon=5: r[18] BOS expired",
    r[18].reason === REASONS.NO_ACTIVE_BOS);
}

// ─── Annotation shape ───────────────────────────────────────────────────
{
  const specs = baselineWithBos();
  specs.push({ high: 1.04, low: 1.00, close: 1.01 });
  const cs = makeCandles(specs);
  const a = detectPullbacks5m(cs)[13];
  const expectedKeys = ["ts", "low", "high", "close", "bosLegLow", "bosLegHigh", "fib50", "fib79", "inPullbackZone", "reason"];
  let allPresent = true;
  for (const k of expectedKeys) if (!(k in a)) { allPresent = false; break; }
  assert(`annotation has all 10 keys`, allPresent);
}

// ─── Error paths ────────────────────────────────────────────────────────
{
  let t1 = false; try { detectPullbacks5m("not-an-array"); } catch (e) { t1 = e instanceof TypeError; }
  assert("non-array input → TypeError", t1);

  let t2 = false;
  try { detectPullbacks5m([{ ts: 1, high: NaN, low: 0, close: 1 }]); } catch (e) { t2 = e instanceof TypeError; }
  assert("non-finite high → TypeError", t2);

  let t3 = false;
  try { detectPullbacks5m([], { bosLookback: 0 }); } catch (e) { t3 = e instanceof RangeError; }
  assert("bosLookback <= 0 → RangeError", t3);

  let t4 = false;
  try { detectPullbacks5m([], { bosHorizon: -1 }); } catch (e) { t4 = e instanceof RangeError; }
  assert("bosHorizon <= 0 → RangeError", t4);

  let t5 = false;
  try { detectPullbacks5m([], { fibLowerPct: 0.8, fibUpperPct: 0.5 }); } catch (e) { t5 = e instanceof RangeError; }
  assert("fibLowerPct >= fibUpperPct → RangeError", t5);

  let t6 = false;
  try { detectPullbacks5m([], { fibLowerPct: 1.5 }); } catch (e) { t6 = e instanceof RangeError; }
  assert("fibLowerPct out of (0,1) → RangeError", t6);
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
