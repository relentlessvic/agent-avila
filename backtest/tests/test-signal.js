// Phase SV2-4 — node-script test runner for the offline Strategy V2
// signal combiner.
//
// Builds carefully-aligned synthetic 4h / 15m / 5m candle streams
// in-memory and verifies that combineSignals emits the expected event
// stream for a variety of scenarios. All tests run with a "small"
// custom config (smaller warmups) so the candle arrays stay tractable.

import { combineSignals, DEFAULT_SIGNAL_CONFIG, FIVE_MIN_MS, FIFTEEN_MIN_MS, FOUR_HOUR_MS } from "../src/signal.js";

const RESET = "\x1b[0m"; const RED = "\x1b[31m"; const GREEN = "\x1b[32m"; const DIM = "\x1b[2m";
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }
let passCount = 0, failCount = 0;
const failed = [];
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 64)}`); passCount++; }
  else      { console.log(`  ${RED}FAIL${RESET}  ${pad(name, 64)} ${DIM}${detail}${RESET}`); failCount++; failed.push({ name, detail }); }
}

// ─── Small custom config (used by all multi-TF scenarios) ─────────────────
//   trend.smaLong=3 → 3 4h bars warmup
//   sweep.lookback=2, bos.lookback=2, pullback.bosLookback=2 (inherits bos.lookback)
//   pullback.bosHorizon=8
//   cleanWindowBars=4
const SMALL_CFG = {
  trend:    { smaShort: 2, smaLong: 3 },
  sweep:    { lookback: 2 },
  bos:      { lookback: 2 },
  pullback: { bosHorizon: 8, fibLowerPct: 0.50, fibUpperPct: 0.79 },
  sweepToBosWindowMs: 60 * 60 * 1000,
  cleanWindowBars: 4,
};

const T0 = 1704067200000;   // 2024-01-01T00:00:00Z

// Helper: an OHLCV bar shape.
function bar(ts, low, high, close, open = close, volume = 1000) {
  return { ts, open, high, low, close, volume };
}

// ─── Build a "happy-path" scenario ─────────────────────────────────────────
//
// Timeline (relative to T0):
//   t=0..16h        4h bars 0..3 establishing UP trend (closes 1.00, 1.04, 1.09, 1.14)
//   t=16h           4h bar 4 closes at 20h with close=1.19 → trend UP at the 4h boundary
//   t=20h           start of 5m and 15m streams in this scenario window
//   t=20h+0..30min  15m bars 0..1 (warmup), low=1.18 each
//   t=20h+30..45min 15m bar 2: low=1.15 (wicks below), close=1.20 → BULLISH SWEEP
//                   sweep close = 20h+45min
//   t=20h..20h+45m  5m bars 0..8 are pre-sweep (irrelevant for BOS detection here)
//   t=20h+45..50m   5m bar 9: warmup, h=1.20
//   t=20h+50..55m   5m bar 10: BOS — h=1.25, low=1.18, close=1.24 (close > priorSwingHigh=1.20)
//                   BOS close = 20h+55min. Sweep→BOS gap = 10min ≤ 60min ✓
//   t=20h+55..60m   5m bar 11: low=1.22, h=1.24, c=1.23 → above zone (no signal yet)
//   t=21h..21h+5m   5m bar 12: low=1.20, h=1.23, c=1.21 → IN_PULLBACK_ZONE
//                   Pullback bar - BOS bar = 12-10 = 2 ≤ cleanWindow=4 → "perfect"
//   t=21h+5..10m    5m bar 13: similar pullback (would re-fire if not deduped)
//
// Leg arithmetic:
//   bos.lookback=2 → priorSwingHigh = max(h) over 5m bars 8,9 = 1.20
//   bos5m bar 10 close=1.24 > 1.20 ✓  → BOS
//   pullback.bosLookback=2 → bosLegLow = min(l) over 5m bars 8,9 = 1.18
//   bosLegHigh = bar 10 high = 1.25
//   range = 0.07
//   fib50 = 1.25 − 0.5*0.07 = 1.215
//   fib79 = 1.25 − 0.79*0.07 = 1.1947
//   pullback bar 12 (l=1.20, h=1.23): 1.20 ≤ 1.215 ✓ AND 1.23 ≥ 1.1947 ✓ → IN_PULLBACK_ZONE
//
function happyPath() {
  // 4h: 5 bars to satisfy smaLong=3
  const candles4h = [
    bar(T0,                     0.99, 1.01, 1.00),
    bar(T0 + 1 * FOUR_HOUR_MS,  1.00, 1.05, 1.04),
    bar(T0 + 2 * FOUR_HOUR_MS,  1.04, 1.10, 1.09),
    bar(T0 + 3 * FOUR_HOUR_MS,  1.09, 1.15, 1.14),
    bar(T0 + 4 * FOUR_HOUR_MS,  1.14, 1.20, 1.19),
  ];
  // 15m: 4 bars starting at T0+20h, sweep at index 2
  const c15Start = T0 + 5 * FOUR_HOUR_MS;
  const candles15m = [
    bar(c15Start + 0 * FIFTEEN_MIN_MS, 1.18, 1.21, 1.20),         // warmup
    bar(c15Start + 1 * FIFTEEN_MIN_MS, 1.18, 1.21, 1.20),         // warmup
    bar(c15Start + 2 * FIFTEEN_MIN_MS, 1.15, 1.21, 1.20),         // SWEEP (low=1.15<1.18, close=1.20>1.18)
    bar(c15Start + 3 * FIFTEEN_MIN_MS, 1.18, 1.22, 1.20),
  ];
  // 5m: 14 bars starting at T0+20h
  const c5Start = T0 + 5 * FOUR_HOUR_MS;
  const candles5m = [];
  for (let i = 0; i < 8; i++) {
    // pre-sweep / pre-BOS warmup bars: low=1.18, high=1.20, close=1.19
    candles5m.push(bar(c5Start + i * FIVE_MIN_MS, 1.18, 1.20, 1.19));
  }
  // bars 8..9: BOS lookback warmup → priorSwingHigh = 1.20, bosLegLow = 1.18
  candles5m.push(bar(c5Start + 8 * FIVE_MIN_MS, 1.18, 1.20, 1.19));
  candles5m.push(bar(c5Start + 9 * FIVE_MIN_MS, 1.18, 1.20, 1.19));
  // bar 10: BOS — high=1.25, low=1.18, close=1.24 (>1.20)
  candles5m.push(bar(c5Start + 10 * FIVE_MIN_MS, 1.18, 1.25, 1.24));
  // bar 11: above zone
  candles5m.push(bar(c5Start + 11 * FIVE_MIN_MS, 1.22, 1.24, 1.23));
  // bar 12: pullback → IN_PULLBACK_ZONE
  candles5m.push(bar(c5Start + 12 * FIVE_MIN_MS, 1.20, 1.23, 1.21));
  // bar 13: still in zone (would re-fire if combiner didn't dedup)
  candles5m.push(bar(c5Start + 13 * FIVE_MIN_MS, 1.20, 1.22, 1.21));

  return { candles5m, candles15m, candles4h, c5Start };
}

console.log("=== SV2-4 signal combiner tests ===");
console.log("");

// ─── Defaults exposed ─────────────────────────────────────────────────────
{
  assert("DEFAULT_SIGNAL_CONFIG exposes trend.smaLong",
    DEFAULT_SIGNAL_CONFIG.trend.smaLong === 50);
  assert("DEFAULT_SIGNAL_CONFIG exposes sweep.lookback",
    DEFAULT_SIGNAL_CONFIG.sweep.lookback === 20);
  assert("DEFAULT_SIGNAL_CONFIG exposes bos.lookback",
    DEFAULT_SIGNAL_CONFIG.bos.lookback === 12);
  assert("DEFAULT_SIGNAL_CONFIG.pullback.bosHorizon === 24",
    DEFAULT_SIGNAL_CONFIG.pullback.bosHorizon === 24);
  assert("DEFAULT_SIGNAL_CONFIG.sweepToBosWindowMs === 60min",
    DEFAULT_SIGNAL_CONFIG.sweepToBosWindowMs === 60 * 60 * 1000);
  assert("DEFAULT_SIGNAL_CONFIG.cleanWindowBars === 6",
    DEFAULT_SIGNAL_CONFIG.cleanWindowBars === 6);
  assert("DEFAULT_SIGNAL_CONFIG.perfectRiskPct === 0.015",
    DEFAULT_SIGNAL_CONFIG.perfectRiskPct === 0.015);
  assert("DEFAULT_SIGNAL_CONFIG.standardRiskPct === 0.01",
    DEFAULT_SIGNAL_CONFIG.standardRiskPct === 0.01);
}

// ─── Empty inputs → empty signals ─────────────────────────────────────────
{
  assert("empty 5m: no signals",
    combineSignals({ candles5m: [], candles15m: [], candles4h: [] }).length === 0);
}

// ─── Happy path: one perfect signal ───────────────────────────────────────
{
  const s = happyPath();
  const signals = combineSignals(s, SMALL_CFG);
  assert("happy path: exactly 1 signal emitted",
    signals.length === 1, `got ${signals.length}: ${JSON.stringify(signals)}`);
  if (signals.length === 1) {
    const sig = signals[0];
    assert("happy path: side === 'long'", sig.side === "long");
    assert("happy path: tier === 'perfect'",
      sig.tier === "perfect", `got ${sig.tier}`);
    assert("happy path: riskPct === 0.015",
      sig.riskPct === 0.015);
    assert("happy path: pullback5mTs === bar 12 ts",
      sig.pullback5mTs === s.c5Start + 12 * FIVE_MIN_MS);
    assert("happy path: bos5mTs === bar 10 ts",
      sig.bos5mTs === s.c5Start + 10 * FIVE_MIN_MS);
    assert("happy path: sweep15mTs === 15m bar 2 ts",
      sig.sweep15mTs === s.c5Start + 2 * FIFTEEN_MIN_MS);
    assert("happy path: trend4hTs === 4h bar 4 ts",
      sig.trend4hTs === T0 + 4 * FOUR_HOUR_MS);
    assert("happy path: entryTriggerTs === pullback5mTs + 5min",
      sig.entryTriggerTs === sig.pullback5mTs + FIVE_MIN_MS);
    assert("happy path: ts === entryTriggerTs",
      sig.ts === sig.entryTriggerTs);
    assert("happy path: reason === 'all_conditions_met'",
      sig.reason === "all_conditions_met");
  }
}

// ─── Same BOS, second pullback bar → NO duplicate signal ─────────────────
{
  // happyPath builds bars 12 AND 13 both in zone for the same BOS.
  // The combiner must emit only one signal.
  const s = happyPath();
  const signals = combineSignals(s, SMALL_CFG);
  assert("dedup: only 1 signal even though bars 12 AND 13 are in zone",
    signals.length === 1);
}

// ─── Trend NEUTRAL → no signal ────────────────────────────────────────────
{
  const s = happyPath();
  // Force 4h trend to NEUTRAL: flatten the closes
  const c4h = s.candles4h.map(c => ({ ...c, close: 1.00, open: 1.00, high: 1.01, low: 0.99 }));
  const signals = combineSignals({ ...s, candles4h: c4h }, SMALL_CFG);
  assert("trend NEUTRAL: 0 signals", signals.length === 0);
}

// ─── Trend DOWN → no signal ───────────────────────────────────────────────
{
  const s = happyPath();
  const c4h = [
    bar(T0,                     1.20, 1.21, 1.19),
    bar(T0 + 1 * FOUR_HOUR_MS,  1.15, 1.20, 1.14),
    bar(T0 + 2 * FOUR_HOUR_MS,  1.10, 1.15, 1.09),
    bar(T0 + 3 * FOUR_HOUR_MS,  1.05, 1.10, 1.04),
    bar(T0 + 4 * FOUR_HOUR_MS,  1.00, 1.05, 0.99),
  ];
  const signals = combineSignals({ ...s, candles4h: c4h }, SMALL_CFG);
  assert("trend DOWN: 0 signals", signals.length === 0);
}

// ─── No 15m sweep → no signal ─────────────────────────────────────────────
{
  const s = happyPath();
  // Replace the sweep bar with a non-sweep bar
  const c15 = s.candles15m.map(c => ({ ...c }));
  c15[2] = bar(c15[2].ts, 1.19, 1.21, 1.20);   // low=1.19 (no break below 1.18)
  const signals = combineSignals({ ...s, candles15m: c15 }, SMALL_CFG);
  assert("no sweep: 0 signals", signals.length === 0);
}

// ─── No 5m BOS → no signal ────────────────────────────────────────────────
{
  const s = happyPath();
  // Replace the BOS bar with a non-BOS bar (close <= priorSwingHigh)
  const c5 = s.candles5m.map(c => ({ ...c }));
  c5[10] = bar(c5[10].ts, 1.18, 1.25, 1.20);   // close=1.20 (not strictly > 1.20)
  const signals = combineSignals({ ...s, candles5m: c5 }, SMALL_CFG);
  assert("no BOS: 0 signals", signals.length === 0);
}

// ─── No pullback → no signal ──────────────────────────────────────────────
{
  const s = happyPath();
  const c5 = s.candles5m.map(c => ({ ...c }));
  // Make bars 11..13 stay above the zone (low > fib50 = 1.215)
  c5[11] = bar(c5[11].ts, 1.22, 1.26, 1.25);
  c5[12] = bar(c5[12].ts, 1.22, 1.26, 1.25);
  c5[13] = bar(c5[13].ts, 1.22, 1.26, 1.25);
  const signals = combineSignals({ ...s, candles5m: c5 }, SMALL_CFG);
  assert("no pullback: 0 signals", signals.length === 0);
}

// ─── Sweep too far before BOS (outside sweepToBosWindow) → no signal ─────
{
  const s = happyPath();
  // Pass a very tight window — only 5 minutes — between sweep and BOS
  // Sweep close = 20h+45min, BOS close = 20h+55min → diff = 10 min > 5 min → reject
  const signals = combineSignals(s, { ...SMALL_CFG, sweepToBosWindowMs: 5 * 60 * 1000 });
  assert("sweep window too tight: 0 signals", signals.length === 0);
}

// ─── Standard tier: pullback after cleanWindow ────────────────────────────
{
  // Modify happy path so pullback is at bar 16 instead of 12.
  // BOS still at bar 10. Distance = 6 > cleanWindowBars=4.
  // But bosHorizon=8 so still within range.
  const s = happyPath();
  const c5 = s.candles5m.map(c => ({ ...c }));
  // Add bars 14, 15 above zone (extending the array)
  const c5Start = s.c5Start;
  c5[12] = bar(c5[12].ts, 1.22, 1.24, 1.23);   // make 12 above zone
  c5[13] = bar(c5[13].ts, 1.22, 1.24, 1.23);   // make 13 above zone
  c5.push(bar(c5Start + 14 * FIVE_MIN_MS, 1.22, 1.24, 1.23));
  c5.push(bar(c5Start + 15 * FIVE_MIN_MS, 1.22, 1.24, 1.23));
  c5.push(bar(c5Start + 16 * FIVE_MIN_MS, 1.20, 1.23, 1.21));   // pullback at 16
  const signals = combineSignals({ ...s, candles5m: c5 }, SMALL_CFG);
  assert("standard tier: 1 signal", signals.length === 1);
  if (signals.length === 1) {
    assert("standard tier: tier === 'standard'",
      signals[0].tier === "standard", `got ${signals[0].tier}`);
    assert("standard tier: riskPct === 0.01",
      signals[0].riskPct === 0.01);
  }
}

// ─── Pullback outside bosHorizon → no signal ─────────────────────────────
{
  // Push pullback to bar 20 (BOS at 10, distance=10 > bosHorizon=8)
  const s = happyPath();
  const c5 = s.candles5m.map(c => ({ ...c }));
  const c5Start = s.c5Start;
  c5[12] = bar(c5[12].ts, 1.22, 1.24, 1.23);
  c5[13] = bar(c5[13].ts, 1.22, 1.24, 1.23);
  for (let i = 14; i <= 19; i++) c5.push(bar(c5Start + i * FIVE_MIN_MS, 1.22, 1.24, 1.23));
  c5.push(bar(c5Start + 20 * FIVE_MIN_MS, 1.20, 1.23, 1.21));   // would be pullback, but out of horizon
  const signals = combineSignals({ ...s, candles5m: c5 }, SMALL_CFG);
  assert("pullback outside horizon: 0 signals", signals.length === 0);
}

// ─── Determinism ──────────────────────────────────────────────────────────
{
  const s = happyPath();
  const r1 = combineSignals(s, SMALL_CFG);
  const r2 = combineSignals(s, SMALL_CFG);
  assert("determinism: two runs JSON-equal",
    JSON.stringify(r1) === JSON.stringify(r2));
}

// ─── Look-ahead protection: signal at i is independent of bars > pullback bar ─
{
  // Run the combiner twice: once on full happyPath, once on the same data
  // truncated AT the pullback bar (i=12, length 13). The signal at bar 12
  // must be present in both — and only those.
  const s = happyPath();
  const sFull = combineSignals(s, SMALL_CFG);
  const truncatedC5m = s.candles5m.slice(0, 13);   // bars 0..12 inclusive
  const sTrunc = combineSignals({ ...s, candles5m: truncatedC5m }, SMALL_CFG);
  assert("look-ahead: full and truncated both emit 1 signal",
    sFull.length === 1 && sTrunc.length === 1);
  if (sFull.length === 1 && sTrunc.length === 1) {
    assert("look-ahead: signals identical",
      JSON.stringify(sFull[0]) === JSON.stringify(sTrunc[0]));
  }
}

// ─── Output shape: all 10 keys present ────────────────────────────────────
{
  const s = happyPath();
  const signals = combineSignals(s, SMALL_CFG);
  if (signals.length === 1) {
    const expectedKeys = ["ts", "side", "trend4hTs", "sweep15mTs", "bos5mTs", "pullback5mTs", "entryTriggerTs", "tier", "riskPct", "reason"];
    let allPresent = true;
    for (const k of expectedKeys) if (!(k in signals[0])) { allPresent = false; break; }
    assert(`signal has all 10 keys: ${expectedKeys.join(",")}`,
      allPresent);
  } else {
    assert("signal shape (skipped, no signal)", false, "happy path didn't emit");
  }
}

// ─── Error paths ──────────────────────────────────────────────────────────
{
  let t1 = false;
  try { combineSignals({ candles5m: "x", candles15m: [], candles4h: [] }); } catch (e) { t1 = e instanceof TypeError; }
  assert("non-array candles5m → TypeError", t1);

  let t2 = false;
  try { combineSignals({ candles5m: [], candles15m: [], candles4h: [] }, { sweepToBosWindowMs: -1 }); } catch (e) { t2 = e instanceof RangeError; }
  assert("negative sweepToBosWindowMs → RangeError", t2);

  let t3 = false;
  try { combineSignals({ candles5m: [], candles15m: [], candles4h: [] }, { cleanWindowBars: 0 }); } catch (e) { t3 = e instanceof RangeError; }
  assert("cleanWindowBars=0 → RangeError", t3);

  let t4 = false;
  try { combineSignals({ candles5m: [], candles15m: [], candles4h: [] }, { perfectRiskPct: 1.5 }); } catch (e) { t4 = e instanceof RangeError; }
  assert("perfectRiskPct out of (0,1) → RangeError", t4);

  let t5 = false;
  try { combineSignals({ candles5m: [], candles15m: [], candles4h: [] }, { standardRiskPct: 0.02, perfectRiskPct: 0.01 }); } catch (e) { t5 = e instanceof RangeError; }
  assert("standardRiskPct > perfectRiskPct → RangeError", t5);
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
