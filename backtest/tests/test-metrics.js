// Phase SV2-7A — node-script test runner for the offline metrics module.
//
// Builds synthetic risk-manager-result objects in-memory and verifies
// arithmetic, edge cases, and determinism. Pure: no DB, no Kraken, no
// network, no env reads, no filesystem writes.

import { computeMetrics, SCHEMA_VERSION, ANNUALIZATION_FACTOR } from "../src/metrics.js";

const RESET = "\x1b[0m"; const RED = "\x1b[31m"; const GREEN = "\x1b[32m"; const DIM = "\x1b[2m";
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }
let passCount = 0, failCount = 0;
const failed = [];
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 64)}`); passCount++; }
  else      { console.log(`  ${RED}FAIL${RESET}  ${pad(name, 64)} ${DIM}${detail}${RESET}`); failCount++; failed.push({ name, detail }); }
}
const APPROX = (a, b, tol = 1e-6) => a == null ? b == null : (b == null ? false : Math.abs(a - b) < tol);

const FIVE_MIN_MS = 5 * 60 * 1000;
const DAY_MS      = 24 * 60 * 60 * 1000;
const T0          = 1704067200000;   // 2024-01-01T00:00:00Z

// ─── Test fixture builders ────────────────────────────────────────────────
function makeTrade({
  entryTs, exitTs = entryTs + FIVE_MIN_MS,
  realizedR, riskPct = 0.01, riskAmount = null,
  pnl = null, entryEquity = 10000, equityAfter = null,
  tier = "standard", outcome = null,
  tp1Ts = "auto", tp2Ts = "auto",
  bars = null,
} = {}) {
  if (riskAmount === null)  riskAmount  = entryEquity * riskPct;
  if (pnl === null)         pnl         = realizedR * riskAmount;
  if (equityAfter === null) equityAfter = entryEquity + pnl;
  if (outcome === null) {
    outcome = realizedR >= 1.3 ? "tp1_then_tp2"
            : realizedR >  0  ? "tp1_then_be_sl"
            : realizedR <  0  ? "sl_full"
            : "tp1_then_be_sl";  // R === 0 default
  }
  if (tp1Ts === "auto") tp1Ts = realizedR > 0 ? entryTs + 1 * FIVE_MIN_MS : null;
  if (tp2Ts === "auto") tp2Ts = realizedR >= 1.3 ? exitTs : null;
  if (bars  === null)   bars  = Math.round((exitTs - entryTs) / FIVE_MIN_MS);
  return {
    signalTs:   entryTs,
    entryTs, exitTs,
    riskPct, riskAmount, pnl, entryEquity, equityAfter,
    tier, outcome,
    realizedR,
    tp1Ts, tp2Ts,
    slTs:       realizedR < 0 ? exitTs : null,
    beSlTs:     outcome === "tp1_then_be_sl" ? exitTs : null,
    incomplete: outcome === "incomplete",
    bars,
    fills:      [],
  };
}

function makeDay({ dayUtcMs, dayStartEquity, dayEndEquity, dailyPnl, tradesFilled = 1, wins = 0, losses = 0, breakevens = 0, tradesSkipped = 0, ddHit = false, capHit = null }) {
  return {
    dayUtcMs, dayStartEquity, dayEndEquity, dailyPnl,
    tradesFilled, wins, losses, breakevens, tradesSkipped,
    ddHit, capHit,
  };
}

function makeRisk({
  trades = [], skipped = [], dailyStats = [], equityCurve = null,
  initialEquity = 10000, finalEquity = null,
  halted = false, haltReason = null,
  config = null,
}) {
  let curve = equityCurve;
  if (curve === null) {
    curve = [{ ts: null, equity: initialEquity }];
    let eq = initialEquity;
    for (const t of trades) {
      eq = t.equityAfter ?? (eq + (t.pnl ?? 0));
      curve.push({ ts: t.exitTs, equity: eq });
    }
  }
  const fin = finalEquity ?? (curve.length > 0 ? curve[curve.length - 1].equity : initialEquity);
  return {
    initialEquity,
    finalEquity: fin,
    acceptedTrades: trades,
    skippedTrades:  skipped,
    equityCurve:    curve,
    dailyStats,
    halted, haltReason,
    config: config ?? { initialEquity, equityFloorPct: 0.5, maxTradesPerDay: 3, maxLossesPerDay: 2, maxDailyDrawdownPct: 0.03 },
  };
}

console.log("=== SV2-7A metrics tests ===");
console.log("");

// ─── Schema constants ─────────────────────────────────────────────────────
{
  assert("SCHEMA_VERSION === '1.0'", SCHEMA_VERSION === "1.0");
  assert("ANNUALIZATION_FACTOR ≈ sqrt(365)",
    Math.abs(ANNUALIZATION_FACTOR - Math.sqrt(365)) < 1e-12);
}

// ─── Empty input → all nulls + zero counts, no NaN/Infinity ───────────────
{
  const r = computeMetrics({ riskResult: makeRisk({}) });
  assert("empty: schemaVersion present", r.schemaVersion === "1.0");
  assert("empty: headline.totalTrades === 0", r.headline.totalTrades === 0);
  assert("empty: headline.wins/losses/breakevens === 0",
    r.headline.wins === 0 && r.headline.losses === 0 && r.headline.breakevens === 0);
  assert("empty: winRate === null", r.headline.winRate === null);
  assert("empty: profitFactor === null", r.headline.profitFactor === null);
  assert("empty: expectancy === null", r.headline.expectancy === null);
  assert("empty: avgR === null", r.headline.avgR === null);
  assert("empty: avgWinnerR/avgLoserR === null",
    r.headline.avgWinnerR === null && r.headline.avgLoserR === null);
  assert("empty: largestWinnerR/Loser === null",
    r.headline.largestWinnerR === null && r.headline.largestLoserR === null);
  assert("empty: maxDrawdownPct === 0", r.headline.maxDrawdownPct === 0);
  assert("empty: longestUnderwaterBars === 0", r.headline.longestUnderwaterBars === 0);
  assert("empty: dailyDrawdownMaxPct === null", r.dailyRisk.dailyDrawdownMaxPct === null);
  assert("empty: equityFloorHalted === false", r.dailyRisk.equityFloorHalted === false);
  assert("empty: tp1HitRate === null", r.strategyV2.tp1HitRate === null);
  assert("empty: tp2HitRate === null", r.strategyV2.tp2HitRate === null);
  assert("empty: outcomeBreakdown all zero",
    r.strategyV2.outcomeBreakdown.sl_full === 0
    && r.strategyV2.outcomeBreakdown.tp1_then_be_sl === 0
    && r.strategyV2.outcomeBreakdown.tp1_then_tp2 === 0
    && r.strategyV2.outcomeBreakdown.incomplete === 0);
  assert("empty: sharpe/sortino === null",
    r.riskAdjusted.sharpe === null && r.riskAdjusted.sortino === null);
  assert("empty: avgTimeInTradeMin === null", r.health.avgTimeInTradeMin === null);
  assert("empty: longest streaks === 0",
    r.health.longestWinningStreak === 0 && r.health.longestLosingStreak === 0);
  // Sanity: no NaN/Infinity anywhere
  const json = JSON.stringify(r);
  assert("empty: JSON has no 'NaN' substring", !/NaN/.test(json));
  assert("empty: JSON has no 'Infinity' substring", !/Infinity/.test(json));
}

// ─── Single TP1+TP2 winner ────────────────────────────────────────────────
{
  const t = makeTrade({ entryTs: T0, realizedR: 1.3, tier: "perfect", riskPct: 0.015 });
  // pnl = 1.3 × 150 = 195; equityAfter = 10195
  const r = computeMetrics({ riskResult: makeRisk({ trades: [t] }) });
  assert("1 winner: totalTrades === 1", r.headline.totalTrades === 1);
  assert("1 winner: wins === 1, losses === 0", r.headline.wins === 1 && r.headline.losses === 0);
  assert("1 winner: winRate === 1.0", r.headline.winRate === 1);
  assert("1 winner: profitFactor === null (no losers)", r.headline.profitFactor === null);
  assert("1 winner: avgR ≈ 1.3", APPROX(r.headline.avgR, 1.3));
  assert("1 winner: expectancy ≈ 195", APPROX(r.headline.expectancy, 195));
  assert("1 winner: largestWinnerR === 1.3", r.headline.largestWinnerR === 1.3);
  assert("1 winner: largestLoserR === null", r.headline.largestLoserR === null);
  assert("1 winner: maxDrawdownPct === 0 (monotonic up)",
    r.headline.maxDrawdownPct === 0);
  assert("1 winner: tp1HitRate === 1, tp2HitRate === 1",
    r.strategyV2.tp1HitRate === 1 && r.strategyV2.tp2HitRate === 1);
  assert("1 winner: outcomeBreakdown.tp1_then_tp2 === 1",
    r.strategyV2.outcomeBreakdown.tp1_then_tp2 === 1);
  assert("1 winner: perfect.count === 1", r.strategyV2.perfect.count === 1);
  assert("1 winner: standard.count === 0", r.strategyV2.standard.count === 0);
}

// ─── Single SL loser ──────────────────────────────────────────────────────
{
  const t = makeTrade({ entryTs: T0, realizedR: -1, riskPct: 0.01 });
  // pnl = -100, equityAfter = 9900
  const r = computeMetrics({ riskResult: makeRisk({ trades: [t] }) });
  assert("1 loser: totalTrades === 1", r.headline.totalTrades === 1);
  assert("1 loser: losses === 1, wins === 0", r.headline.losses === 1 && r.headline.wins === 0);
  assert("1 loser: winRate === 0", r.headline.winRate === 0);
  assert("1 loser: profitFactor === 0 (zero gross profit)",
    r.headline.profitFactor === 0);
  assert("1 loser: expectancy ≈ -100", APPROX(r.headline.expectancy, -100));
  assert("1 loser: largestLoserR === -1, largestWinnerR === null",
    r.headline.largestLoserR === -1 && r.headline.largestWinnerR === null);
  assert("1 loser: maxDrawdownPct ≈ 1.0", APPROX(r.headline.maxDrawdownPct, 1.0));
  assert("1 loser: maxDrawdownAbs === 100", r.headline.maxDrawdownAbs === 100);
  assert("1 loser: longestUnderwaterBars === 1", r.headline.longestUnderwaterBars === 1);
  assert("1 loser: tp1HitRate === 0", r.strategyV2.tp1HitRate === 0);
  assert("1 loser: tp2HitRate === null (tp1Hit === 0)",
    r.strategyV2.tp2HitRate === null);
  assert("1 loser: outcomeBreakdown.sl_full === 1",
    r.strategyV2.outcomeBreakdown.sl_full === 1);
}

// ─── Mix of all 4 outcomes ────────────────────────────────────────────────
{
  // 5 trades:
  //   T1: TP2 (1.3R) → +130
  //   T2: SL (-1R)   → -100 × compound? simplified: -130 (using 0.01 of 13000)
  //   T3: BE-SL after TP1 (0.7R) → +70 + ...
  //   T4: TP2 (1.3R)
  //   T5: incomplete (R=0.5) but outcome="incomplete"
  const trades = [
    makeTrade({ entryTs: T0 + 0*FIVE_MIN_MS, realizedR: 1.3, tier: "perfect" }),
    makeTrade({ entryTs: T0 + 1*FIVE_MIN_MS, realizedR: -1,  tier: "standard" }),
    makeTrade({ entryTs: T0 + 2*FIVE_MIN_MS, realizedR: 0.7, tier: "perfect", outcome: "tp1_then_be_sl", tp2Ts: null }),
    makeTrade({ entryTs: T0 + 3*FIVE_MIN_MS, realizedR: 1.3, tier: "perfect" }),
    makeTrade({ entryTs: T0 + 4*FIVE_MIN_MS, realizedR: 0.5, tier: "standard", outcome: "incomplete", tp1Ts: T0 + 4*FIVE_MIN_MS + 1, tp2Ts: null }),
  ];
  const r = computeMetrics({ riskResult: makeRisk({ trades }) });
  assert("mix: totalTrades === 5", r.headline.totalTrades === 5);
  assert("mix: wins === 4, losses === 1, breakevens === 0",
    r.headline.wins === 4 && r.headline.losses === 1 && r.headline.breakevens === 0);
  assert("mix: outcomeBreakdown shape",
    r.strategyV2.outcomeBreakdown.sl_full === 1
    && r.strategyV2.outcomeBreakdown.tp1_then_be_sl === 1
    && r.strategyV2.outcomeBreakdown.tp1_then_tp2 === 2
    && r.strategyV2.outcomeBreakdown.incomplete === 1);
  assert("mix: perfect tier count === 3",
    r.strategyV2.perfect.count === 3);
  assert("mix: standard tier count === 2",
    r.strategyV2.standard.count === 2);
  // tp1Hit: T1 (yes), T2 (no), T3 (yes), T4 (yes), T5 (yes — manually set) → 4/5
  assert("mix: tp1HitRate === 4/5",
    APPROX(r.strategyV2.tp1HitRate, 4/5));
  // tp2Hit: T1 (yes), T4 (yes) → 2 of 4 tp1-hits
  assert("mix: tp2HitRate === 2/4",
    APPROX(r.strategyV2.tp2HitRate, 2/4));
}

// ─── Profit factor: all winners → null ────────────────────────────────────
{
  const trades = [
    makeTrade({ entryTs: T0,                  realizedR: 1.3 }),
    makeTrade({ entryTs: T0 + 1*FIVE_MIN_MS,  realizedR: 0.7 }),
  ];
  const r = computeMetrics({ riskResult: makeRisk({ trades }) });
  assert("all winners: profitFactor === null", r.headline.profitFactor === null);
}

// ─── Profit factor: mix arithmetic ────────────────────────────────────────
{
  // 1 winner +130 (R=1.3, riskPct=0.01, equity=10000); 1 loser -100
  // PF = 130 / 100 = 1.3
  const trades = [
    makeTrade({ entryTs: T0,                  realizedR: 1.3 }),
    makeTrade({ entryTs: T0 + 1*FIVE_MIN_MS,  realizedR: -1  }),
  ];
  const r = computeMetrics({ riskResult: makeRisk({ trades }) });
  assert("PF: mix arithmetic ≈ 1.3", APPROX(r.headline.profitFactor, 1.3));
}

// ─── Drawdown: V-shape ────────────────────────────────────────────────────
{
  // Equity: 10000 → 10500 → 9000 → 9500
  // Peak after first trade: 10500. Trough: 9000. Max DD = 1500/10500 = 14.286%
  const equityCurve = [
    { ts: null, equity: 10000 },
    { ts: T0,                  equity: 10500 },
    { ts: T0 + FIVE_MIN_MS,    equity: 9000  },
    { ts: T0 + 2*FIVE_MIN_MS,  equity: 9500  },
  ];
  const r = computeMetrics({ riskResult: makeRisk({ equityCurve, finalEquity: 9500 }) });
  assert("V-shape DD: maxDrawdownPct ≈ 14.286%",
    APPROX(r.headline.maxDrawdownPct, (1500 / 10500) * 100));
  assert("V-shape DD: maxDrawdownAbs === 1500",
    r.headline.maxDrawdownAbs === 1500);
  assert("V-shape DD: longestUnderwaterBars === 2",
    r.headline.longestUnderwaterBars === 2);
}

// ─── Drawdown: monotonic up → 0 ───────────────────────────────────────────
{
  const equityCurve = [
    { ts: null, equity: 10000 },
    { ts: T0,                  equity: 10100 },
    { ts: T0 + FIVE_MIN_MS,    equity: 10250 },
  ];
  const r = computeMetrics({ riskResult: makeRisk({ equityCurve, finalEquity: 10250 }) });
  assert("monotonic up: maxDrawdownPct === 0", r.headline.maxDrawdownPct === 0);
  assert("monotonic up: longestUnderwaterBars === 0",
    r.headline.longestUnderwaterBars === 0);
}

// ─── Daily risk: dailyDrawdownMaxPct + cap counts ─────────────────────────
{
  const days = [
    makeDay({ dayUtcMs: T0,             dayStartEquity: 10000, dayEndEquity: 10100, dailyPnl:  100, wins: 1 }),
    makeDay({ dayUtcMs: T0 + DAY_MS,    dayStartEquity: 10100, dayEndEquity: 9800,  dailyPnl: -300, losses: 2, capHit: "max_losses_day", tradesSkipped: 1 }),
    makeDay({ dayUtcMs: T0 + 2*DAY_MS,  dayStartEquity: 9800,  dayEndEquity: 9500,  dailyPnl: -300, losses: 1, capHit: "max_daily_drawdown", ddHit: true, tradesSkipped: 2 }),
  ];
  const r = computeMetrics({ riskResult: makeRisk({ dailyStats: days }) });
  // Max DD pct: day 2 = 300/10100 = 2.97%; day 3 = 300/9800 = 3.06%; max ≈ 3.06%
  assert("daily DD max ≈ 3.06% (day 3)",
    APPROX(r.dailyRisk.dailyDrawdownMaxPct, (300/9800) * 100));
  // Avg over loss days: (2.97% + 3.06%) / 2
  const expectedAvg = ((300/10100) + (300/9800)) / 2 * 100;
  assert("daily DD avg over loss days",
    APPROX(r.dailyRisk.dailyDrawdownAvgPct, expectedAvg));
  assert("daysWithMaxLossesHit === 1",  r.dailyRisk.daysWithMaxLossesHit === 1);
  assert("daysWithMaxTradesHit === 0",  r.dailyRisk.daysWithMaxTradesHit === 0);
  assert("daysWithDailyDdHit === 1",    r.dailyRisk.daysWithDailyDdHit === 1);
}

// ─── Equity floor halted: haltAt is the trade that breached ──────────────
{
  const trades = [
    makeTrade({ entryTs: T0,                realizedR: -1, riskPct: 0.01 }),  // 10000 → 9900
    makeTrade({ entryTs: T0 + FIVE_MIN_MS,  realizedR: -1, riskPct: 0.5  }),  // 9900 → 4950 (breaches 50% floor of 5000)
  ];
  // Manually set equityAfter for compounding
  trades[0].entryEquity = 10000; trades[0].equityAfter = 9900;
  trades[1].entryEquity = 9900;  trades[1].equityAfter = 4950;
  const config = { initialEquity: 10000, equityFloorPct: 0.5 };
  const r = computeMetrics({
    riskResult: makeRisk({ trades, halted: true, haltReason: "equity_floor", config }),
  });
  assert("halted: equityFloorHalted === true",
    r.dailyRisk.equityFloorHalted === true);
  assert("halted: haltAt === second trade's exitTs",
    r.dailyRisk.haltAt === trades[1].exitTs);
}

// ─── Sharpe / Sortino: < 2 days → null ────────────────────────────────────
{
  const days = [makeDay({ dayUtcMs: T0, dayStartEquity: 10000, dayEndEquity: 10100, dailyPnl: 100 })];
  const r = computeMetrics({ riskResult: makeRisk({ dailyStats: days }) });
  assert("Sharpe < 2 days → null", r.riskAdjusted.sharpe === null);
  assert("Sortino < 2 days → null", r.riskAdjusted.sortino === null);
}

// ─── Sharpe arithmetic with canned daily returns ─────────────────────────
{
  // 5 days with controlled returns:
  // r = [+0.01, -0.005, +0.02, -0.01, +0.015]
  // mean = (0.01 - 0.005 + 0.02 - 0.01 + 0.015)/5 = 0.030/5 = 0.006
  // sample variance = Σ(r - mean)² / (n-1)
  // (0.004² + (-0.011)² + 0.014² + (-0.016)² + 0.009²) / 4
  // = (0.000016 + 0.000121 + 0.000196 + 0.000256 + 0.000081) / 4
  // = 0.000670 / 4 = 0.0001675
  // stdDev = sqrt(0.0001675) ≈ 0.012942
  // Sharpe = 0.006 / 0.012942 × sqrt(365) ≈ 0.4636 × 19.1050 ≈ 8.857
  const startEqs = [10000, 10100, 10049.5, 10250.49, 10148.0];
  const pnls     = [100, -50.5, 200.99, -102.5049, 152.22];
  const days = startEqs.map((eq, i) => makeDay({
    dayUtcMs: T0 + i * DAY_MS,
    dayStartEquity: eq,
    dayEndEquity: eq + pnls[i],
    dailyPnl: pnls[i],
  }));
  const r = computeMetrics({ riskResult: makeRisk({ dailyStats: days }) });
  // Compute expected from same definitions in-test for cross-check
  const returns = pnls.map((p, i) => p / startEqs[i]);
  const mean = returns.reduce((s, x) => s + x, 0) / returns.length;
  const varNum = returns.reduce((s, x) => s + (x - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(varNum);
  const expectedSharpe = (mean / std) * Math.sqrt(365);
  assert("Sharpe arithmetic cross-checks",
    APPROX(r.riskAdjusted.sharpe, expectedSharpe, 1e-9));
}

// ─── Sortino: no negative-return days → null ─────────────────────────────
{
  const days = [
    makeDay({ dayUtcMs: T0,         dayStartEquity: 10000, dayEndEquity: 10100, dailyPnl: 100 }),
    makeDay({ dayUtcMs: T0+DAY_MS,  dayStartEquity: 10100, dayEndEquity: 10250, dailyPnl: 150 }),
    makeDay({ dayUtcMs: T0+2*DAY_MS,dayStartEquity: 10250, dayEndEquity: 10400, dailyPnl: 150 }),
  ];
  const r = computeMetrics({ riskResult: makeRisk({ dailyStats: days }) });
  assert("Sortino no-neg-days → null", r.riskAdjusted.sortino === null);
  assert("Sharpe no-neg-days still computable", r.riskAdjusted.sharpe !== null);
}

// ─── Streaks: longest winning / losing / breakeven resets ────────────────
{
  // Sequence: W W L W W W L L BE W
  //   maxWinningStreak: 3 (after 1st loss)
  //   maxLosingStreak: 2 (then BE resets, then W)
  const seq = [1, 1, -1, 1, 1, 1, -1, -1, 0, 1];
  const trades = seq.map((R, i) => makeTrade({ entryTs: T0 + i * FIVE_MIN_MS, realizedR: R }));
  const r = computeMetrics({ riskResult: makeRisk({ trades }) });
  assert("streaks: longestWinningStreak === 3",
    r.health.longestWinningStreak === 3);
  assert("streaks: longestLosingStreak === 2",
    r.health.longestLosingStreak === 2);
}

// ─── Skipped trades by reason ────────────────────────────────────────────
{
  const skipped = [
    { trade: {}, reason: "max_trades_day", dayUtcMs: T0 },
    { trade: {}, reason: "max_trades_day", dayUtcMs: T0 + DAY_MS },
    { trade: {}, reason: "max_losses_day", dayUtcMs: T0 + DAY_MS },
    { trade: {}, reason: "halted",         dayUtcMs: T0 + 2*DAY_MS },
  ];
  const r = computeMetrics({ riskResult: makeRisk({ skipped }) });
  assert("skipped reasons: max_trades_day === 2",
    r.health.skippedTradesByReason.max_trades_day === 2);
  assert("skipped reasons: max_losses_day === 1",
    r.health.skippedTradesByReason.max_losses_day === 1);
  assert("skipped reasons: halted === 1",
    r.health.skippedTradesByReason.halted === 1);
  assert("skipped reasons: max_daily_drawdown === 0",
    r.health.skippedTradesByReason.max_daily_drawdown === 0);
}

// ─── avgTimeInTradeMin ───────────────────────────────────────────────────
{
  const trades = [
    makeTrade({ entryTs: T0, exitTs: T0 + 10*FIVE_MIN_MS, realizedR: 1.3 }),  // 50 min
    makeTrade({ entryTs: T0 + DAY_MS, exitTs: T0 + DAY_MS + 30*FIVE_MIN_MS, realizedR: -1 }),  // 150 min
  ];
  const r = computeMetrics({ riskResult: makeRisk({ trades }) });
  assert("avgTimeInTradeMin === (50 + 150) / 2 === 100",
    APPROX(r.health.avgTimeInTradeMin, 100));
}

// ─── Determinism ─────────────────────────────────────────────────────────
{
  const trades = [
    makeTrade({ entryTs: T0,                  realizedR: 1.3 }),
    makeTrade({ entryTs: T0 + 1*FIVE_MIN_MS,  realizedR: -1  }),
    makeTrade({ entryTs: T0 + 2*FIVE_MIN_MS,  realizedR: 0.7 }),
  ];
  const days = [makeDay({ dayUtcMs: T0, dayStartEquity: 10000, dayEndEquity: 10100, dailyPnl: 100 })];
  const risk = makeRisk({ trades, dailyStats: days });
  const r1 = computeMetrics({ riskResult: risk });
  const r2 = computeMetrics({ riskResult: risk });
  assert("determinism: two runs JSON-equal",
    JSON.stringify(r1) === JSON.stringify(r2));
}

// ─── No NaN/Infinity leaks across mixed scenarios ────────────────────────
{
  // Construct a risk result with various edge fields
  const trades = [
    makeTrade({ entryTs: T0,                 realizedR: 1.3 }),
    makeTrade({ entryTs: T0 + 1*FIVE_MIN_MS, realizedR: 0   }),
    makeTrade({ entryTs: T0 + 2*FIVE_MIN_MS, realizedR: -1  }),
  ];
  const days = [
    makeDay({ dayUtcMs: T0, dayStartEquity: 10000, dayEndEquity: 9990, dailyPnl: -10 }),
  ];
  const r = computeMetrics({ riskResult: makeRisk({ trades, dailyStats: days }) });
  const json = JSON.stringify(r);
  assert("no NaN in JSON output", !/NaN/.test(json));
  assert("no Infinity in JSON output", !/Infinity/.test(json));
  assert("no -Infinity in JSON output", !/-Infinity/.test(json));
}

// ─── Output shape: all required top-level sections ───────────────────────
{
  const r = computeMetrics({ riskResult: makeRisk({}) });
  const expectedKeys = ["schemaVersion", "headline", "dailyRisk", "strategyV2", "riskAdjusted", "health"];
  let allPresent = true;
  for (const k of expectedKeys) if (!(k in r)) { allPresent = false; break; }
  assert(`top-level has all ${expectedKeys.length} sections`, allPresent);

  const headlineKeys = ["initialEquity", "finalEquity", "totalReturnPct", "totalTrades",
                        "wins", "losses", "breakevens", "winRate", "profitFactor",
                        "expectancy", "avgR", "avgWinnerR", "avgLoserR", "avgWinnerPnl",
                        "avgLoserPnl", "largestWinnerR", "largestLoserR",
                        "maxDrawdownPct", "maxDrawdownAbs", "longestUnderwaterBars"];
  let hAll = true;
  for (const k of headlineKeys) if (!(k in r.headline)) { hAll = false; break; }
  assert(`headline has all ${headlineKeys.length} keys`, hAll);
}

// ─── Mutation safety: input objects unchanged ────────────────────────────
{
  const trades = [makeTrade({ entryTs: T0, realizedR: 1.3 })];
  const risk   = makeRisk({ trades });
  const before = JSON.stringify(risk);
  computeMetrics({ riskResult: risk });
  const after  = JSON.stringify(risk);
  assert("input riskResult unchanged after computeMetrics", before === after);
}

// ─── Error paths ─────────────────────────────────────────────────────────
{
  let t1 = false; try { computeMetrics(); } catch (e) { t1 = e instanceof TypeError; }
  assert("missing input → TypeError", t1);

  let t2 = false; try { computeMetrics({}); } catch (e) { t2 = e instanceof TypeError; }
  assert("missing riskResult → TypeError", t2);

  let t3 = false; try { computeMetrics({ riskResult: { acceptedTrades: "x", skippedTrades: [], equityCurve: [], dailyStats: [], initialEquity: 100, finalEquity: 100, halted: false } }); } catch (e) { t3 = e instanceof TypeError; }
  assert("non-array acceptedTrades → TypeError", t3);

  let t4 = false; try { computeMetrics({ riskResult: { acceptedTrades: [], skippedTrades: [], equityCurve: [], dailyStats: [], initialEquity: -1, finalEquity: 100, halted: false } }); } catch (e) { t4 = e instanceof TypeError; }
  assert("negative initialEquity → TypeError", t4);

  let t5 = false; try { computeMetrics({ riskResult: { acceptedTrades: [], skippedTrades: [], equityCurve: [], dailyStats: [], initialEquity: 100, finalEquity: NaN, halted: false } }); } catch (e) { t5 = e instanceof TypeError; }
  assert("non-finite finalEquity → TypeError", t5);

  let t6 = false; try { computeMetrics({ riskResult: { acceptedTrades: [], skippedTrades: [], equityCurve: [], dailyStats: [], initialEquity: 100, finalEquity: 100, halted: "true" } }); } catch (e) { t6 = e instanceof TypeError; }
  assert("non-boolean halted → TypeError", t6);
}

// ─── Daily risk: empty dailyStats but halted ─────────────────────────────
{
  // Halted but no daily-stats (edge case)
  const r = computeMetrics({ riskResult: makeRisk({ halted: true, haltReason: "equity_floor" }) });
  assert("empty dailyStats halted: equityFloorHalted === true",
    r.dailyRisk.equityFloorHalted === true);
  assert("empty dailyStats halted: haltAt === null (no trades)",
    r.dailyRisk.haltAt === null);
  assert("empty dailyStats halted: maxDdPct === null",
    r.dailyRisk.dailyDrawdownMaxPct === null);
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
