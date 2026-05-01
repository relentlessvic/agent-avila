// Phase SV2-6 — node-script test runner for the offline risk manager.
//
// Builds synthetic trade streams in-memory and feeds them through
// applyRiskManagement to verify cap behavior, compounding arithmetic,
// equity-floor halt, daily stats, and equity-curve shape.

import {
  applyRiskManagement, DEFAULT_RISK_CONFIG, SKIP_REASONS,
} from "../src/risk-manager.js";

const RESET = "\x1b[0m"; const RED = "\x1b[31m"; const GREEN = "\x1b[32m"; const DIM = "\x1b[2m";
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }
let passCount = 0, failCount = 0;
const failed = [];
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 64)}`); passCount++; }
  else      { console.log(`  ${RED}FAIL${RESET}  ${pad(name, 64)} ${DIM}${detail}${RESET}`); failCount++; failed.push({ name, detail }); }
}
const APPROX = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

const FIVE_MIN_MS = 5 * 60 * 1000;
const DAY_MS      = 24 * 60 * 60 * 1000;
const T0          = 1704067200000;   // 2024-01-01T00:00:00Z

// Build a minimal trade record (only fields the risk manager reads).
let tradeCounter = 0;
function makeTrade({
  entryTs,
  exitTs    = entryTs + FIVE_MIN_MS,
  realizedR,
  riskPct   = 0.01,
  tier      = "standard",
}) {
  tradeCounter++;
  return {
    signalTs:  entryTs,
    signal:    { ts: entryTs, side: "long", tier, riskPct },
    entryTs,
    exitTs,
    riskPct,
    tier,
    realizedR,
    outcome:   realizedR < 0 ? "sl_full" : (realizedR >= 1.3 ? "tp1_then_tp2" : "tp1_then_be_sl"),
    incomplete: false,
    bars:      Math.round((exitTs - entryTs) / FIVE_MIN_MS),
    fills:     [],
    _id:       tradeCounter,
  };
}

console.log("=== SV2-6 risk-manager tests ===");
console.log("");

// ─── Defaults exposed ─────────────────────────────────────────────────────
{
  assert("DEFAULT initialEquity === 10000",         DEFAULT_RISK_CONFIG.initialEquity === 10000);
  assert("DEFAULT maxTradesPerDay === 3",           DEFAULT_RISK_CONFIG.maxTradesPerDay === 3);
  assert("DEFAULT maxLossesPerDay === 2",           DEFAULT_RISK_CONFIG.maxLossesPerDay === 2);
  assert("DEFAULT maxDailyDrawdownPct === 0.03",    DEFAULT_RISK_CONFIG.maxDailyDrawdownPct === 0.03);
  assert("DEFAULT equityFloorPct === 0.5",          DEFAULT_RISK_CONFIG.equityFloorPct === 0.5);
  assert("SKIP_REASONS has 5 keys",
    Object.keys(SKIP_REASONS).length === 5
    && SKIP_REASONS.MAX_TRADES_DAY === "max_trades_day"
    && SKIP_REASONS.MAX_LOSSES_DAY === "max_losses_day"
    && SKIP_REASONS.MAX_DAILY_DD   === "max_daily_drawdown"
    && SKIP_REASONS.EQUITY_FLOOR   === "equity_floor"
    && SKIP_REASONS.HALTED         === "halted");
}

// ─── Empty input ──────────────────────────────────────────────────────────
{
  const r = applyRiskManagement([]);
  assert("empty trades: no accepted",  r.acceptedTrades.length === 0);
  assert("empty trades: no skipped",   r.skippedTrades.length === 0);
  assert("empty trades: finalEquity === initialEquity",
    r.finalEquity === DEFAULT_RISK_CONFIG.initialEquity);
  assert("empty trades: equityCurve has 1 anchor", r.equityCurve.length === 1);
  assert("empty trades: dailyStats empty",         r.dailyStats.length === 0);
  assert("empty trades: not halted",               r.halted === false && r.haltReason === null);
}

// ─── Single accepted trade: arithmetic ────────────────────────────────────
{
  // 1 trade, riskPct=0.01, realizedR=1.3, initialEquity=10000
  // riskAmount = 100, pnl = 130 → finalEquity = 10130
  const trades = [makeTrade({ entryTs: T0, realizedR: 1.3, riskPct: 0.01 })];
  const r = applyRiskManagement(trades);
  assert("single trade: 1 accepted, 0 skipped",
    r.acceptedTrades.length === 1 && r.skippedTrades.length === 0);
  assert("single trade: pnl ≈ 130", APPROX(r.acceptedTrades[0].pnl, 130));
  assert("single trade: riskAmount ≈ 100", APPROX(r.acceptedTrades[0].riskAmount, 100));
  assert("single trade: equityAfter ≈ 10130", APPROX(r.acceptedTrades[0].equityAfter, 10130));
  assert("single trade: finalEquity ≈ 10130", APPROX(r.finalEquity, 10130));
  assert("single trade: equityCurve has 2 entries (anchor + exit)", r.equityCurve.length === 2);
  assert("single trade: dailyStats has 1 day",     r.dailyStats.length === 1);
  assert("single trade: dailyStats day wins=1",    r.dailyStats[0].wins === 1);
}

// ─── Compounding: trade 2 sizes against post-trade-1 equity ──────────────
{
  // T1: realizedR=1.3, riskPct=0.01 → equity 10000 → 10130
  // T2: realizedR=-1, riskPct=0.01 → riskAmount = 10130 × 0.01 = 101.30, pnl = -101.30 → equity 10028.70
  const trades = [
    makeTrade({ entryTs: T0,                  realizedR: 1.3, riskPct: 0.01 }),
    makeTrade({ entryTs: T0 + FIVE_MIN_MS,    realizedR: -1,  riskPct: 0.01 }),
  ];
  const r = applyRiskManagement(trades);
  assert("compounding: 2 accepted",
    r.acceptedTrades.length === 2);
  assert("compounding: trade 2 riskAmount ≈ 101.30",
    APPROX(r.acceptedTrades[1].riskAmount, 101.30));
  assert("compounding: trade 2 pnl ≈ -101.30",
    APPROX(r.acceptedTrades[1].pnl, -101.30));
  assert("compounding: finalEquity ≈ 10028.70",
    APPROX(r.finalEquity, 10028.70));
}

// ─── Cap: max trades per day ──────────────────────────────────────────────
{
  // 4 trades same UTC day, each at +0.7R standard risk
  // First 3 accepted, 4th skipped (max_trades_day)
  const trades = [];
  for (let i = 0; i < 4; i++) {
    trades.push(makeTrade({ entryTs: T0 + i * FIVE_MIN_MS, realizedR: 0.7 }));
  }
  const r = applyRiskManagement(trades);
  assert("max trades/day: 3 accepted",  r.acceptedTrades.length === 3);
  assert("max trades/day: 1 skipped",   r.skippedTrades.length === 1);
  assert("max trades/day: skip reason === max_trades_day",
    r.skippedTrades[0].reason === SKIP_REASONS.MAX_TRADES_DAY);
  assert("max trades/day: dailyStats[0].tradesFilled === 3",
    r.dailyStats[0].tradesFilled === 3);
  assert("max trades/day: dailyStats[0].tradesSkipped === 1",
    r.dailyStats[0].tradesSkipped === 1);
  assert("max trades/day: dailyStats[0].capHit === max_trades_day",
    r.dailyStats[0].capHit === SKIP_REASONS.MAX_TRADES_DAY);
}

// ─── Cap: max losses per day ──────────────────────────────────────────────
{
  // Custom config: maxLossesPerDay=2, maxTradesPerDay=10 (effectively no trade cap)
  // 3 losing trades same day → 3rd skipped (max_losses_day)
  const trades = [];
  for (let i = 0; i < 3; i++) {
    trades.push(makeTrade({ entryTs: T0 + i * FIVE_MIN_MS, realizedR: -1, riskPct: 0.005 }));
  }
  const r = applyRiskManagement(trades, { maxTradesPerDay: 10, maxLossesPerDay: 2, maxDailyDrawdownPct: 0.5 });
  assert("max losses/day: 2 accepted",  r.acceptedTrades.length === 2);
  assert("max losses/day: 1 skipped",   r.skippedTrades.length === 1);
  assert("max losses/day: skip reason === max_losses_day",
    r.skippedTrades[0].reason === SKIP_REASONS.MAX_LOSSES_DAY);
  assert("max losses/day: dailyStats[0].losses === 2",
    r.dailyStats[0].losses === 2);
}

// ─── Cap: max daily drawdown ──────────────────────────────────────────────
{
  // initialEquity=10000, maxDailyDDpct=0.03 → threshold = -300
  // Custom risk to cleanly cross threshold:
  //   trade 1: riskPct=0.04, realizedR=-1 → pnl = -400, dayPnl = -400 (< -300) → next skipped
  // Use maxLossesPerDay=10 so loss cap doesn't fire first.
  const trades = [
    makeTrade({ entryTs: T0,                  realizedR: -1, riskPct: 0.04 }),
    makeTrade({ entryTs: T0 + FIVE_MIN_MS,    realizedR: 0.7, riskPct: 0.01 }),
  ];
  const r = applyRiskManagement(trades, { maxTradesPerDay: 10, maxLossesPerDay: 10 });
  assert("max DD: 1 accepted",     r.acceptedTrades.length === 1);
  assert("max DD: 1 skipped",      r.skippedTrades.length === 1);
  assert("max DD: skip reason === max_daily_drawdown",
    r.skippedTrades[0].reason === SKIP_REASONS.MAX_DAILY_DD);
  assert("max DD: dailyStats[0].ddHit === true",
    r.dailyStats[0].ddHit === true);
}

// ─── Cap: equity floor → halts entire backtest ───────────────────────────
{
  // Custom: equityFloorPct = 0.99 → floor = 9900
  // trade 1: riskPct=0.02, realizedR=-1 → pnl = -200 → equity = 9800 < 9900 → halted
  // trade 2 (next day): should be skipped with reason "halted"
  const trades = [
    makeTrade({ entryTs: T0,         realizedR: -1, riskPct: 0.02 }),
    makeTrade({ entryTs: T0 + DAY_MS, realizedR: 1.3 }),     // next day
  ];
  const r = applyRiskManagement(trades, { equityFloorPct: 0.99 });
  assert("equity floor: 1 accepted",     r.acceptedTrades.length === 1);
  assert("equity floor: 1 skipped",      r.skippedTrades.length === 1);
  assert("equity floor: halted === true",  r.halted === true);
  assert("equity floor: haltReason === equity_floor",
    r.haltReason === SKIP_REASONS.EQUITY_FLOOR);
  assert("equity floor: skipped.reason === halted (subsequent trade)",
    r.skippedTrades[0].reason === SKIP_REASONS.HALTED);
}

// ─── Day boundary: new UTC day resets all counters ───────────────────────
{
  // Day 1: 3 winning trades (max trades/day=3, no skip)
  // Day 2: 3 winning trades (counters reset)
  const trades = [];
  for (let i = 0; i < 3; i++) trades.push(makeTrade({ entryTs: T0 + i * FIVE_MIN_MS, realizedR: 0.7 }));
  for (let i = 0; i < 3; i++) trades.push(makeTrade({ entryTs: T0 + DAY_MS + i * FIVE_MIN_MS, realizedR: 0.7 }));
  const r = applyRiskManagement(trades);
  assert("day boundary: 6 accepted (3 per day)", r.acceptedTrades.length === 6);
  assert("day boundary: 0 skipped",              r.skippedTrades.length === 0);
  assert("day boundary: 2 entries in dailyStats", r.dailyStats.length === 2);
  assert("day boundary: each day has 3 trades",
    r.dailyStats[0].tradesFilled === 3 && r.dailyStats[1].tradesFilled === 3);
}

// ─── 4th trade on day 2 still skipped (caps reset to fresh counters) ─────
{
  const trades = [];
  for (let i = 0; i < 4; i++) trades.push(makeTrade({ entryTs: T0 + DAY_MS + i * FIVE_MIN_MS, realizedR: 0.7 }));
  const r = applyRiskManagement(trades);
  assert("day 2 4th: 3 accepted",
    r.acceptedTrades.length === 3);
  assert("day 2 4th: skip reason === max_trades_day",
    r.skippedTrades.length === 1 && r.skippedTrades[0].reason === SKIP_REASONS.MAX_TRADES_DAY);
}

// ─── Daily stats: dayStartEquity, dayEndEquity, dailyPnl ─────────────────
{
  const trades = [
    makeTrade({ entryTs: T0,                  realizedR: 1.3, riskPct: 0.01 }),    // +130
    makeTrade({ entryTs: T0 + FIVE_MIN_MS,    realizedR: -1,  riskPct: 0.01 }),    // -101.30
  ];
  const r = applyRiskManagement(trades);
  const day = r.dailyStats[0];
  assert("dailyStats: dayStartEquity === 10000",  APPROX(day.dayStartEquity, 10000));
  assert("dailyStats: dayEndEquity ≈ 10028.70",   APPROX(day.dayEndEquity, 10028.70));
  assert("dailyStats: dailyPnl ≈ 28.70",          APPROX(day.dailyPnl, 28.70));
  assert("dailyStats: tradesFilled === 2",         day.tradesFilled === 2);
  assert("dailyStats: wins === 1, losses === 1",   day.wins === 1 && day.losses === 1);
  assert("dailyStats: capHit === null",            day.capHit === null);
  assert("dailyStats: ddHit === false",            day.ddHit === false);
}

// ─── Breakeven (realizedR === 0) is not a loss ───────────────────────────
{
  // 4 trades same day: all realizedR=0 → maxLossesPerDay=2 doesn't trigger; max_trades_day=3 does
  const trades = [];
  for (let i = 0; i < 4; i++) trades.push(makeTrade({ entryTs: T0 + i * FIVE_MIN_MS, realizedR: 0 }));
  const r = applyRiskManagement(trades);
  assert("breakeven: 3 accepted (trade cap, not loss cap)",
    r.acceptedTrades.length === 3);
  assert("breakeven: skip reason === max_trades_day (not max_losses_day)",
    r.skippedTrades[0].reason === SKIP_REASONS.MAX_TRADES_DAY);
  assert("breakeven: dailyStats[0].breakevens === 3",
    r.dailyStats[0].breakevens === 3);
  assert("breakeven: dailyStats[0].losses === 0",
    r.dailyStats[0].losses === 0);
}

// ─── Risk tier (perfect 1.5%) reflected in sizing ────────────────────────
{
  const trade = makeTrade({ entryTs: T0, realizedR: 1, riskPct: 0.015, tier: "perfect" });
  const r = applyRiskManagement([trade]);
  assert("perfect tier: riskAmount ≈ 150",
    APPROX(r.acceptedTrades[0].riskAmount, 150));
  assert("perfect tier: pnl ≈ 150",
    APPROX(r.acceptedTrades[0].pnl, 150));
}

// ─── Unsorted input is sorted defensively ─────────────────────────────────
{
  const trades = [
    makeTrade({ entryTs: T0 + FIVE_MIN_MS, realizedR: 1 }),    // out of order
    makeTrade({ entryTs: T0,                realizedR: 0.7 }),
  ];
  const r = applyRiskManagement(trades);
  assert("unsorted input: trades processed in chronological order",
    r.acceptedTrades[0].entryTs < r.acceptedTrades[1].entryTs);
}

// ─── Equity curve shape ──────────────────────────────────────────────────
{
  const trades = [
    makeTrade({ entryTs: T0,                  realizedR: 1.3 }),
    makeTrade({ entryTs: T0 + FIVE_MIN_MS,    realizedR: -1 }),
  ];
  const r = applyRiskManagement(trades);
  assert("equity curve: 1 anchor + 2 trade exits = 3 entries",
    r.equityCurve.length === 3);
  assert("equity curve: anchor has ts === null",
    r.equityCurve[0].ts === null);
  assert("equity curve: anchor equity === initialEquity",
    r.equityCurve[0].equity === 10000);
  assert("equity curve: monotonic exitTs",
    r.equityCurve[1].ts < r.equityCurve[2].ts);
}

// ─── Determinism ─────────────────────────────────────────────────────────
{
  const trades = [
    makeTrade({ entryTs: T0,                  realizedR: 1.3 }),
    makeTrade({ entryTs: T0 + FIVE_MIN_MS,    realizedR: -1  }),
    makeTrade({ entryTs: T0 + 2*FIVE_MIN_MS,  realizedR: 0.7 }),
  ];
  const r1 = applyRiskManagement(trades);
  const r2 = applyRiskManagement(trades);
  // Avoid signal/trade reference equality issue by comparing key fields only
  assert("determinism: finalEquity equal",
    APPROX(r1.finalEquity, r2.finalEquity));
  assert("determinism: accepted count equal",
    r1.acceptedTrades.length === r2.acceptedTrades.length);
  assert("determinism: equityCurve equal",
    JSON.stringify(r1.equityCurve) === JSON.stringify(r2.equityCurve));
}

// ─── Output shape ────────────────────────────────────────────────────────
{
  const r = applyRiskManagement([makeTrade({ entryTs: T0, realizedR: 1 })]);
  const expectedKeys = ["initialEquity", "finalEquity", "acceptedTrades", "skippedTrades",
                         "equityCurve", "dailyStats", "halted", "haltReason", "config"];
  let allPresent = true;
  for (const k of expectedKeys) if (!(k in r)) { allPresent = false; break; }
  assert(`top-level result has all ${expectedKeys.length} keys`, allPresent);

  const trade = r.acceptedTrades[0];
  const tradeKeys = ["entryEquity", "riskAmount", "pnl", "equityAfter", "dayUtcMs"];
  let tradeAllPresent = true;
  for (const k of tradeKeys) if (!(k in trade)) { tradeAllPresent = false; break; }
  assert(`accepted trade has currency fields: ${tradeKeys.join(",")}`, tradeAllPresent);
}

// ─── Halt persists: trade after halt skipped with 'halted' ───────────────
{
  // Drop equity below floor, then 3 more trades on different days
  const trades = [
    makeTrade({ entryTs: T0,                realizedR: -1, riskPct: 0.02 }),
    makeTrade({ entryTs: T0 + 1*DAY_MS,     realizedR: 1.3 }),
    makeTrade({ entryTs: T0 + 2*DAY_MS,     realizedR: 1.3 }),
  ];
  const r = applyRiskManagement(trades, { equityFloorPct: 0.99 });
  assert("halt persists: 1 accepted, 2 skipped",
    r.acceptedTrades.length === 1 && r.skippedTrades.length === 2);
  assert("halt persists: all skipped reason === halted",
    r.skippedTrades.every(s => s.reason === SKIP_REASONS.HALTED));
}

// ─── Error paths ─────────────────────────────────────────────────────────
{
  let t1 = false; try { applyRiskManagement("x"); } catch (e) { t1 = e instanceof TypeError; }
  assert("non-array input → TypeError", t1);

  let t2 = false;
  try { applyRiskManagement([{ entryTs: NaN, realizedR: 1, riskPct: 0.01 }]); } catch (e) { t2 = e instanceof TypeError; }
  assert("non-finite entryTs → TypeError", t2);

  let t3 = false;
  try { applyRiskManagement([{ entryTs: 1, realizedR: NaN, riskPct: 0.01 }]); } catch (e) { t3 = e instanceof TypeError; }
  assert("non-finite realizedR → TypeError", t3);

  let t4 = false;
  try { applyRiskManagement([{ entryTs: 1, realizedR: 1, riskPct: 0 }]); } catch (e) { t4 = e instanceof TypeError; }
  assert("riskPct out of (0,1) → TypeError", t4);

  let t5 = false;
  try { applyRiskManagement([], { initialEquity: -100 }); } catch (e) { t5 = e instanceof RangeError; }
  assert("negative initialEquity → RangeError", t5);

  let t6 = false;
  try { applyRiskManagement([], { maxTradesPerDay: 0 }); } catch (e) { t6 = e instanceof RangeError; }
  assert("maxTradesPerDay=0 → RangeError", t6);

  let t7 = false;
  try { applyRiskManagement([], { maxDailyDrawdownPct: 1.5 }); } catch (e) { t7 = e instanceof RangeError; }
  assert("maxDailyDrawdownPct > 1 → RangeError", t7);

  let t8 = false;
  try { applyRiskManagement([], { equityFloorPct: 0 }); } catch (e) { t8 = e instanceof RangeError; }
  assert("equityFloorPct === 0 → RangeError", t8);
}

// ─── Custom initialEquity scales risk amount ─────────────────────────────
{
  const trades = [makeTrade({ entryTs: T0, realizedR: 1, riskPct: 0.01 })];
  const r = applyRiskManagement(trades, { initialEquity: 50000 });
  assert("custom initialEquity: riskAmount = 500",
    APPROX(r.acceptedTrades[0].riskAmount, 500));
  assert("custom initialEquity: finalEquity = 50500",
    APPROX(r.finalEquity, 50500));
}

// ─── Codex-fix-1: equity falling EXACTLY to the floor halts ──────────────
{
  // Engineer a trade that drops equity exactly to 9900 (= 10000 × 0.99 floor):
  //   pnl = -100 → riskPct=0.01 with realizedR=-1 on initialEquity=10000.
  const trade = makeTrade({ entryTs: T0, realizedR: -1, riskPct: 0.01 });
  const r = applyRiskManagement([trade], { equityFloorPct: 0.99 });
  assert("equity floor equality: equity exactly === floor halts (<= rule)",
    r.halted === true && r.haltReason === SKIP_REASONS.EQUITY_FLOOR
    && APPROX(r.finalEquity, 9900));
  // And a follow-on trade is skipped with reason "halted"
  const trade2 = makeTrade({ entryTs: T0 + DAY_MS, realizedR: 1.3 });
  const r2 = applyRiskManagement([trade, trade2], { equityFloorPct: 0.99 });
  assert("equity floor equality: subsequent trade skipped with 'halted'",
    r2.skippedTrades.length === 1
    && r2.skippedTrades[0].reason === SKIP_REASONS.HALTED);
}

// ─── Codex-fix-2: missing exitTs throws ──────────────────────────────────
{
  let threw = false;
  try {
    // Construct a minimal trade WITHOUT exitTs
    applyRiskManagement([{
      entryTs: T0,
      realizedR: 1,
      riskPct: 0.01,
      // exitTs intentionally omitted → undefined → not finite
    }]);
  } catch (e) { threw = e instanceof TypeError && /exitTs/.test(e.message); }
  assert("missing exitTs → TypeError mentioning exitTs", threw);
}

// ─── Codex-fix-2: non-finite exitTs throws ───────────────────────────────
{
  let threw = false;
  try {
    applyRiskManagement([{
      entryTs: T0,
      exitTs: NaN,
      realizedR: 1,
      riskPct: 0.01,
    }]);
  } catch (e) { threw = e instanceof TypeError && /exitTs/.test(e.message); }
  assert("non-finite exitTs (NaN) → TypeError", threw);

  let threw2 = false;
  try {
    applyRiskManagement([{
      entryTs: T0,
      exitTs: Infinity,
      realizedR: 1,
      riskPct: 0.01,
    }]);
  } catch (e) { threw2 = e instanceof TypeError && /exitTs/.test(e.message); }
  assert("non-finite exitTs (Infinity) → TypeError", threw2);
}

// ─── Codex-fix-4: riskPct is trusted; no tier-vs-riskPct enforcement ─────
{
  // A trade declaring tier="standard" but supplying riskPct=0.015 is
  // accepted as-is. The risk manager does NOT cross-validate that the
  // tier label matches a "canonical" risk for that tier — that is the
  // signal combiner / simulator's responsibility upstream.
  const trade = makeTrade({ entryTs: T0, realizedR: 1, riskPct: 0.015, tier: "standard" });
  const r = applyRiskManagement([trade]);
  assert("upstream trust: tier='standard' with riskPct=0.015 is accepted (no cross-validation)",
    r.acceptedTrades.length === 1 && APPROX(r.acceptedTrades[0].riskAmount, 150));
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
