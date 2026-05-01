// Phase SV2-5 — node-script test runner for the offline Strategy V2
// position simulator.
//
// Builds synthetic 5m candle streams in-memory and feeds them — along
// with hand-crafted signal events — through the simulator. Asserts each
// state-machine transition, fill priority rule, and outcome class.

import {
  simulate, STATE, OUTCOMES, DEFAULT_SIMULATOR_CONFIG,
} from "../src/simulator.js";

const RESET = "\x1b[0m"; const RED = "\x1b[31m"; const GREEN = "\x1b[32m"; const DIM = "\x1b[2m";
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }
let passCount = 0, failCount = 0;
const failed = [];
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 64)}`); passCount++; }
  else      { console.log(`  ${RED}FAIL${RESET}  ${pad(name, 64)} ${DIM}${detail}${RESET}`); failCount++; failed.push({ name, detail }); }
}

const APPROX = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
const FIVE_MIN_MS = 5 * 60 * 1000;
const T0 = 1704067200000;

// Test config: small bosLookback, zero slBuffer for clean math.
const TEST_CFG = { bosLookback: 2, slBufferPct: 0 };

function bar(ts, open, high, low, close, volume = 1000) {
  return { ts, open, high, low, close, volume };
}

// Build a 5m candle stream of length n starting at startTs with custom OHLCV
// for selected bars. Default unspecified bars are flat at price `level`.
function makeStream({ n, startTs = T0, level = 1.20, overrides = {} }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(bar(startTs + i * FIVE_MIN_MS, level, level, level, level));
  }
  for (const [idx, override] of Object.entries(overrides)) {
    const i = Number(idx);
    out[i] = { ...out[i], ...override, ts: out[i].ts };
  }
  return out;
}

// Build a signal pointing at entry-trigger ts.
function signalAt({ entryTriggerTs, bos5mTs, tier = "perfect", riskPct = 0.015 }) {
  return {
    ts: entryTriggerTs,
    side: "long",
    trend4hTs:    entryTriggerTs - 100 * FIVE_MIN_MS,   // dummy
    sweep15mTs:   entryTriggerTs - 5  * FIVE_MIN_MS,    // dummy
    bos5mTs,
    pullback5mTs: entryTriggerTs - FIVE_MIN_MS,
    entryTriggerTs,
    tier,
    riskPct,
    reason: "all_conditions_met",
  };
}

// Standard scenario: bars 0..2 establish bosLegLow=1.15. Bar 3 is BOS bar.
// Bar 4 is "noise". Bar 5 = pullback. Bar 6 = entry trigger.
//   bosLegLow = min(low) over [bars 1, 2] (bos.lookback=2) = 1.15
//   With slBufferPct=0: SL = 1.15
function buildBaseStream() {
  const stream = makeStream({
    n: 7, level: 1.20,
    overrides: {
      // bars 1..2 set bosLegLow:
      1: { open: 1.16, high: 1.16, low: 1.15, close: 1.16 },
      2: { open: 1.16, high: 1.18, low: 1.15, close: 1.17 },
      // bar 3 is the BOS bar (used by signal.bos5mTs); content irrelevant for SL math
      3: { open: 1.17, high: 1.21, low: 1.17, close: 1.20 },
      4: { open: 1.20, high: 1.20, low: 1.20, close: 1.20 },
      5: { open: 1.20, high: 1.20, low: 1.20, close: 1.20 },
      // bar 6 will be overridden by each test (entry bar)
      6: { open: 1.20, high: 1.20, low: 1.20, close: 1.20 },
    },
  });
  // Signal: entry triggers at bar 6 (its ts), BOS bar is bar 3.
  const sig = signalAt({
    entryTriggerTs: stream[6].ts,
    bos5mTs:        stream[3].ts,
  });
  return { stream, sig };
}

console.log("=== SV2-5 simulator tests ===");
console.log("");

// ─── Defaults exposed ─────────────────────────────────────────────────────
{
  assert("STATE.FLAT/OPEN/TP1_HIT/CLOSED present",
    STATE.FLAT === "FLAT" && STATE.OPEN === "OPEN" && STATE.TP1_HIT === "TP1_HIT" && STATE.CLOSED === "CLOSED");
  assert("OUTCOMES has 4 keys",
    Object.keys(OUTCOMES).length === 4
    && OUTCOMES.SL_FULL === "sl_full"
    && OUTCOMES.TP1_THEN_BE_SL === "tp1_then_be_sl"
    && OUTCOMES.TP1_THEN_TP2 === "tp1_then_tp2"
    && OUTCOMES.INCOMPLETE === "incomplete");
  assert("DEFAULT_SIMULATOR_CONFIG.tp1RR === 1.0",  DEFAULT_SIMULATOR_CONFIG.tp1RR === 1.0);
  assert("DEFAULT_SIMULATOR_CONFIG.tp2RR === 2.0",  DEFAULT_SIMULATOR_CONFIG.tp2RR === 2.0);
  assert("DEFAULT_SIMULATOR_CONFIG.tp1ClosePct === 0.7", DEFAULT_SIMULATOR_CONFIG.tp1ClosePct === 0.7);
  assert("DEFAULT_SIMULATOR_CONFIG.tp2ClosePct === 0.3", DEFAULT_SIMULATOR_CONFIG.tp2ClosePct === 0.3);
}

// ─── Empty inputs ─────────────────────────────────────────────────────────
{
  assert("empty candles → empty trades",
    simulate({ candles5m: [], signals: [] }).length === 0);
  assert("candles but no signals → empty trades",
    simulate({ candles5m: makeStream({ n: 5 }), signals: [] }).length === 0);
}

// ─── Signal not in candle stream → no trade ──────────────────────────────
{
  const { stream } = buildBaseStream();
  // Signal pointing at a ts that doesn't exist in the stream
  const sig = signalAt({ entryTriggerTs: T0 + 999 * FIVE_MIN_MS, bos5mTs: stream[3].ts });
  const trades = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  assert("signal w/ missing entryTriggerTs in stream → no trade",
    trades.length === 0);
}

// ─── Outcome: sl_full (SL hits, TP1 not hit) ─────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  // Bar 6: open=1.20 (entry), low=1.13 < 1.15 = SL → SL hit; high=1.21 < 1.25 = TP1 not hit
  stream[6] = bar(stream[6].ts, 1.20, 1.21, 1.13, 1.16);
  const trades = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  assert("sl_full: 1 trade", trades.length === 1);
  if (trades.length === 1) {
    const t = trades[0];
    assert("sl_full: outcome === sl_full", t.outcome === OUTCOMES.SL_FULL);
    assert("sl_full: realizedR ≈ -1", APPROX(t.realizedR, -1));
    assert("sl_full: tp1Ts === null && tp2Ts === null", t.tp1Ts === null && t.tp2Ts === null);
    assert("sl_full: slTs equals entry-bar ts", t.slTs === stream[6].ts);
    assert("sl_full: incomplete === false", t.incomplete === false);
    assert("sl_full: 1 fill at fraction 1.0", t.fills.length === 1 && t.fills[0].fraction === 1.0);
    assert("sl_full: initialSl === 1.15", APPROX(t.initialSl, 1.15));
    assert("sl_full: tp1Price === 1.25", APPROX(t.tp1Price, 1.25));
    assert("sl_full: tp2Price === 1.30", APPROX(t.tp2Price, 1.30));
  }
}

// ─── Same-bar SL+TP1 → SL FIRST ───────────────────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  // Bar 6: low=1.13 (< SL 1.15), high=1.30 (> TP1 1.25 AND > TP2 1.30)
  stream[6] = bar(stream[6].ts, 1.20, 1.30, 1.13, 1.20);
  const trades = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  assert("same-bar SL+TP1: outcome === sl_full (SL first)",
    trades.length === 1 && trades[0].outcome === OUTCOMES.SL_FULL);
  assert("same-bar SL+TP1: realizedR ≈ -1",
    trades.length === 1 && APPROX(trades[0].realizedR, -1));
  assert("same-bar SL+TP1: tp1Ts === null (never recorded)",
    trades.length === 1 && trades[0].tp1Ts === null);
}

// ─── Outcome: tp1_then_tp2 (clean run-up) ────────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  // Bar 6: open=1.20, low=1.21 (no SL, no BE-SL), high=1.30 (TP1 1.25, TP2 1.30 both hit, BE-SL 1.20 not hit)
  stream[6] = bar(stream[6].ts, 1.20, 1.30, 1.21, 1.28);
  const trades = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  assert("tp1_then_tp2: 1 trade",
    trades.length === 1);
  if (trades.length === 1) {
    const t = trades[0];
    assert("tp1_then_tp2: outcome === tp1_then_tp2",
      t.outcome === OUTCOMES.TP1_THEN_TP2);
    assert("tp1_then_tp2: realizedR ≈ 1.3 (0.7×1 + 0.3×2)",
      APPROX(t.realizedR, 0.7 * 1 + 0.3 * 2));
    assert("tp1_then_tp2: tp1Ts and tp2Ts both set",
      t.tp1Ts !== null && t.tp2Ts !== null);
    assert("tp1_then_tp2: 2 fills (0.7 + 0.3)",
      t.fills.length === 2
      && APPROX(t.fills[0].fraction, 0.7)
      && APPROX(t.fills[1].fraction, 0.3));
  }
}

// ─── Outcome: tp1_then_be_sl (same bar) ──────────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  // Bar 6: low=1.18 (no SL, but ≤ BE-SL 1.20), high=1.30 (TP1 1.25 hit, TP2 1.30 hit)
  // After TP1 fill: state TP1_HIT, BE-SL+TP2 same bar → BE-SL first
  stream[6] = bar(stream[6].ts, 1.20, 1.30, 1.18, 1.22);
  const trades = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  assert("tp1_then_be_sl (same bar): outcome",
    trades.length === 1 && trades[0].outcome === OUTCOMES.TP1_THEN_BE_SL);
  assert("tp1_then_be_sl (same bar): realizedR ≈ 0.7",
    trades.length === 1 && APPROX(trades[0].realizedR, 0.7 * 1 + 0.3 * 0));
  assert("tp1_then_be_sl (same bar): tp1Ts and beSlTs set, tp2Ts null",
    trades.length === 1 && trades[0].tp1Ts !== null && trades[0].beSlTs !== null && trades[0].tp2Ts === null);
}

// ─── Outcome: tp1_then_be_sl (sequential bars) ───────────────────────────
{
  const { stream, sig } = buildBaseStream();
  // Bar 6 (entry): open=1.20, no movement
  stream[6] = bar(stream[6].ts, 1.20, 1.20, 1.20, 1.20);
  // Add bar 7: TP1 hits (high=1.27 ≥ 1.25), no BE-SL (low=1.21)
  stream.push(bar(stream[6].ts + FIVE_MIN_MS, 1.20, 1.27, 1.21, 1.26));
  // Add bar 8: BE-SL hits (low=1.18 ≤ 1.20)
  stream.push(bar(stream[6].ts + 2 * FIVE_MIN_MS, 1.26, 1.27, 1.18, 1.19));
  const trades = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  assert("tp1_then_be_sl (sequential): outcome",
    trades.length === 1 && trades[0].outcome === OUTCOMES.TP1_THEN_BE_SL);
  assert("tp1_then_be_sl (sequential): tp1Ts on bar 7, beSlTs on bar 8",
    trades.length === 1
    && trades[0].tp1Ts === stream[7].ts
    && trades[0].beSlTs === stream[8].ts);
  assert("tp1_then_be_sl (sequential): realizedR ≈ 0.7",
    trades.length === 1 && APPROX(trades[0].realizedR, 0.7));
}

// ─── Outcome: incomplete (open at end of data, no TP1 hit) ───────────────
{
  const { stream, sig } = buildBaseStream();
  // Entry at bar 6, no movement after; data ends at bar 6
  stream[6] = bar(stream[6].ts, 1.20, 1.22, 1.18, 1.21);   // no SL (1.18 > 1.15), no TP1 (1.22 < 1.25)
  const trades = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  assert("incomplete (no tp1): 1 trade",
    trades.length === 1);
  if (trades.length === 1) {
    const t = trades[0];
    assert("incomplete (no tp1): outcome === incomplete",
      t.outcome === OUTCOMES.INCOMPLETE);
    assert("incomplete (no tp1): incomplete === true", t.incomplete === true);
    assert("incomplete (no tp1): tp1Ts === null", t.tp1Ts === null);
    assert("incomplete (no tp1): exitPrice === last close (1.21)",
      APPROX(t.exitPrice, 1.21));
    // realizedR = 1.0 × (1.21 - 1.20) / 0.05 = 0.2
    assert("incomplete (no tp1): realizedR ≈ 0.2 (mark-to-market)",
      APPROX(t.realizedR, 0.2));
    assert("incomplete (no tp1): 1 fill labeled 'incomplete'",
      t.fills.length === 1 && t.fills[0].label === "incomplete" && t.fills[0].fraction === 1.0);
  }
}

// ─── Outcome: incomplete (open at end of data, after TP1) ────────────────
{
  const { stream, sig } = buildBaseStream();
  stream[6] = bar(stream[6].ts, 1.20, 1.20, 1.20, 1.20);
  stream.push(bar(stream[6].ts + FIVE_MIN_MS, 1.20, 1.27, 1.21, 1.26));   // TP1 hits at bar 7
  // Data ends here; runner is open with BE-SL=1.20
  const trades = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  assert("incomplete (after tp1): outcome === incomplete",
    trades.length === 1 && trades[0].outcome === OUTCOMES.INCOMPLETE);
  if (trades.length === 1) {
    const t = trades[0];
    // realizedR = 0.7 × 1.0 + 0.3 × (1.26 - 1.20) / 0.05 = 0.7 + 0.3 × 1.2 = 0.7 + 0.36 = 1.06
    assert("incomplete (after tp1): realizedR ≈ 0.7 + 0.3×1.2 = 1.06",
      APPROX(t.realizedR, 0.7 + 0.3 * 1.2));
    assert("incomplete (after tp1): 2 fills (tp1 + incomplete_runner)",
      t.fills.length === 2 && t.fills[1].label === "incomplete_runner");
  }
}

// ─── Concurrency: second signal during open trade is dropped ─────────────
{
  const { stream, sig } = buildBaseStream();
  // Entry at bar 6, no exit (data continues; trade stays OPEN)
  stream[6] = bar(stream[6].ts, 1.20, 1.22, 1.18, 1.21);
  // Add bars 7..9 with no movement
  for (let i = 0; i < 3; i++) {
    stream.push(bar(stream[6].ts + (i + 1) * FIVE_MIN_MS, 1.21, 1.21, 1.21, 1.21));
  }
  // Second signal targeting bar 8 — should be ignored while position is open
  const sig2 = signalAt({ entryTriggerTs: stream[8].ts, bos5mTs: stream[3].ts });
  const trades = simulate({ candles5m: stream, signals: [sig, sig2] }, TEST_CFG);
  assert("concurrency: only 1 trade (second signal dropped)",
    trades.length === 1);
}

// ─── Multiple sequential signals: both filled ────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  // First signal at bar 6 closes at SL on entry bar
  stream[6] = bar(stream[6].ts, 1.20, 1.21, 1.13, 1.16);   // sl_full
  // Add bars 7..10 to set up second BOS context
  // Use the same bosLegLow context; new BOS bar at 9, entry at 10
  // For simplicity, second signal points back to BOS bar 3 (same context)
  for (let i = 7; i < 11; i++) {
    stream.push(bar(stream[6].ts + (i - 6) * FIVE_MIN_MS, 1.20, 1.20, 1.20, 1.20));
  }
  // Second signal entry at bar 10
  const sig2 = signalAt({ entryTriggerTs: stream[10].ts, bos5mTs: stream[3].ts });
  // Make bar 10 a clean tp1_then_tp2
  stream[10] = bar(stream[10].ts, 1.20, 1.30, 1.21, 1.28);
  const trades = simulate({ candles5m: stream, signals: [sig, sig2] }, TEST_CFG);
  assert("sequential signals: 2 trades", trades.length === 2);
  if (trades.length === 2) {
    assert("sequential signals: trade 1 sl_full",
      trades[0].outcome === OUTCOMES.SL_FULL);
    assert("sequential signals: trade 2 tp1_then_tp2",
      trades[1].outcome === OUTCOMES.TP1_THEN_TP2);
  }
}

// ─── Same-bar entry + TP1 + TP2 + no BE-SL ───────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  // open=1.20, high=1.32, low=1.21 → no SL, no BE-SL, both TP1+TP2 hit
  stream[6] = bar(stream[6].ts, 1.20, 1.32, 1.21, 1.30);
  const trades = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  assert("entry-bar TP1+TP2 (no BE-SL): tp1_then_tp2",
    trades.length === 1 && trades[0].outcome === OUTCOMES.TP1_THEN_TP2);
}

// ─── Determinism ──────────────────────────────────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  stream[6] = bar(stream[6].ts, 1.20, 1.30, 1.21, 1.28);
  const r1 = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  const r2 = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG);
  assert("determinism: two runs JSON-equal",
    JSON.stringify(r1) === JSON.stringify(r2));
}

// ─── slBufferPct applied correctly ───────────────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  // With slBufferPct=0.01: SL = 1.15 × 0.99 = 1.1385
  // Bar 6 low=1.14 > 1.1385 → no SL; high=1.27 ≥ 1.25 (TP1), but TP1 = 1.20 + (1.20 - 1.1385) = 1.20 + 0.0615 = 1.2615
  // Hmm with new SL=1.1385: riskPerUnit = 1.20 - 1.1385 = 0.0615; TP1 = 1.2615; TP2 = 1.323
  // bar 6 high=1.27 >= 1.2615 → TP1 hits, low=1.14 > 1.20 is false (1.14 < 1.20) → BE-SL hits
  stream[6] = bar(stream[6].ts, 1.20, 1.27, 1.14, 1.20);
  const trades = simulate({ candles5m: stream, signals: [sig] }, { bosLookback: 2, slBufferPct: 0.01 });
  assert("slBufferPct=0.01: SL ≈ 1.1385",
    trades.length === 1 && APPROX(trades[0].initialSl, 1.15 * 0.99));
}

// ─── Trade record shape: all keys present ─────────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  stream[6] = bar(stream[6].ts, 1.20, 1.30, 1.21, 1.28);
  const t = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG)[0];
  const expectedKeys = [
    "signalTs","signal","entryTs","entryPrice","initialSl","bosLegLow",
    "tp1Price","tp2Price","riskPerUnit","riskPct","tier",
    "tp1Ts","tp2Ts","slTs","beSlTs","exitTs","exitPrice","outcome",
    "incomplete","realizedR","bars","fills",
  ];
  let allPresent = true;
  for (const k of expectedKeys) if (!(k in t)) { allPresent = false; break; }
  assert(`trade has all ${expectedKeys.length} keys`, allPresent);
}

// ─── Bar count ───────────────────────────────────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  stream[6] = bar(stream[6].ts, 1.20, 1.20, 1.20, 1.20);
  // Bar 7: TP1 hits
  stream.push(bar(stream[6].ts + FIVE_MIN_MS, 1.20, 1.27, 1.21, 1.26));
  // Bar 8: BE-SL hits
  stream.push(bar(stream[6].ts + 2 * FIVE_MIN_MS, 1.26, 1.27, 1.18, 1.19));
  const t = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG)[0];
  // Entry at bar 6, exit at bar 8 → 2 bars
  assert("bars count: entry to exit",
    t.bars === 2, `got ${t.bars}`);
}

// ─── Signal carries through to trade record ──────────────────────────────
{
  const { stream, sig } = buildBaseStream();
  stream[6] = bar(stream[6].ts, 1.20, 1.30, 1.21, 1.28);
  const t = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG)[0];
  assert("trade.signal === original signal", t.signal === sig);
  assert("trade.tier === 'perfect' (from signal)", t.tier === "perfect");
  assert("trade.riskPct === 0.015 (from signal)", t.riskPct === 0.015);
}

// ─── Standard tier signal carries through ────────────────────────────────
{
  const { stream } = buildBaseStream();
  const sig = signalAt({
    entryTriggerTs: stream[6].ts,
    bos5mTs:        stream[3].ts,
    tier: "standard", riskPct: 0.01,
  });
  stream[6] = bar(stream[6].ts, 1.20, 1.30, 1.21, 1.28);
  const t = simulate({ candles5m: stream, signals: [sig] }, TEST_CFG)[0];
  assert("standard tier carries: tier === 'standard'", t.tier === "standard");
  assert("standard tier carries: riskPct === 0.01", t.riskPct === 0.01);
}

// ─── Error paths ──────────────────────────────────────────────────────────
{
  let t1 = false;
  try { simulate({ candles5m: "x", signals: [] }); } catch (e) { t1 = e instanceof TypeError; }
  assert("non-array candles5m → TypeError", t1);

  let t2 = false;
  try { simulate({ candles5m: [], signals: "x" }); } catch (e) { t2 = e instanceof TypeError; }
  assert("non-array signals → TypeError", t2);

  let t3 = false;
  try {
    simulate({ candles5m: [{ ts: 1, open: NaN, high: 1, low: 1, close: 1 }], signals: [] });
  } catch (e) { t3 = e instanceof TypeError; }
  assert("non-finite OHLC → TypeError", t3);

  let t4 = false;
  try {
    simulate({ candles5m: [{ ts: 1, open: 1, high: 1, low: 1, close: 1 }], signals: [{ entryTriggerTs: NaN }] });
  } catch (e) { t4 = e instanceof TypeError; }
  assert("signal with non-finite entryTriggerTs → TypeError", t4);

  let t5 = false;
  try { simulate({ candles5m: [], signals: [] }, { tp1RR: -1 }); } catch (e) { t5 = e instanceof RangeError; }
  assert("negative tp1RR → RangeError", t5);

  let t6 = false;
  try { simulate({ candles5m: [], signals: [] }, { tp2RR: 1.0, tp1RR: 1.5 }); } catch (e) { t6 = e instanceof RangeError; }
  assert("tp2RR <= tp1RR → RangeError", t6);

  let t7 = false;
  try { simulate({ candles5m: [], signals: [] }, { tp1ClosePct: 0.6, tp2ClosePct: 0.5 }); } catch (e) { t7 = e instanceof RangeError; }
  assert("tp1+tp2 close pct != 1.0 → RangeError", t7);

  let t8 = false;
  try { simulate({ candles5m: [], signals: [] }, { slBufferPct: 1.5 }); } catch (e) { t8 = e instanceof RangeError; }
  assert("slBufferPct out of [0,1) → RangeError", t8);
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
