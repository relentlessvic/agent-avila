// Phase SV2-7A — offline Strategy V2 metrics computation.
//
// Pure-function metrics layer. Consumes the SV2-6 risk-manager result
// object and produces a structured metrics dictionary covering five
// sections that map 1:1 to the JSON report's top-level keys:
//
//   headline       — equity, return, win rate, profit factor, expectancy,
//                    avg R, drawdown, largest winner / loser
//   dailyRisk      — daily DD, cap-hit counts, equity floor halt
//   strategyV2     — TP1/TP2 hit rates, perfect / standard tier breakdown,
//                    outcome breakdown
//   riskAdjusted   — Sharpe, Sortino  (annualised via sqrt(365) for crypto;
//                                       null when statistically unsafe)
//   health         — days traded, avg time in trade, streaks,
//                    skipped trades by reason
//
// Edge-case policy
// ----------------
// Every metric that can divide by zero or is statistically meaningless
// on a tiny sample returns `null` rather than `NaN` / `Infinity`. The
// JSON layer (SV2-7B) emits literal `null`; the Markdown layer renders
// `null` as `n/a`.
//
// SAFETY CONTRACT
// ---------------
// 1. No imports outside backtest/**. (No imports at all in this module.)
// 2. No I/O. No env vars. No clock reads. No global state. Pure function.
// 3. Deterministic given the same inputs.
// 4. No bot.js / db.js / dashboard.js / Postgres / Kraken access.
// 5. Cannot place real orders. Cannot mutate `bot_control` or
//    `position.json`. Cannot mutate inputs.

export const SCHEMA_VERSION = "1.0";

// Crypto trades 24/7; standard convention for daily-return annualisation
// uses sqrt(252) for equities, sqrt(365) for crypto.
export const ANNUALIZATION_FACTOR = Math.sqrt(365);

// ─── Public API ────────────────────────────────────────────────────────────
export function computeMetrics(input = {}) {
  validateInput(input);
  const {
    acceptedTrades, skippedTrades,
    equityCurve, dailyStats,
    initialEquity, finalEquity,
    halted, config,
  } = input.riskResult;

  return {
    schemaVersion: SCHEMA_VERSION,
    headline:      computeHeadline(acceptedTrades, equityCurve, initialEquity, finalEquity),
    dailyRisk:     computeDailyRisk(dailyStats, halted, acceptedTrades, config || {}),
    strategyV2:    computeStrategyV2(acceptedTrades),
    riskAdjusted:  computeRiskAdjusted(dailyStats),
    health:        computeHealth(acceptedTrades, skippedTrades, dailyStats),
  };
}

// ─── Headline ──────────────────────────────────────────────────────────────
function computeHeadline(trades, equityCurve, initialEquity, finalEquity) {
  const n          = trades.length;
  const winners    = trades.filter(t => t.realizedR > 0);
  const losers     = trades.filter(t => t.realizedR < 0);
  const breakeven  = trades.filter(t => t.realizedR === 0);
  const wins       = winners.length;
  const losses     = losers.length;
  const breakevens = breakeven.length;

  const winnerPnl  = winners.map(t => t.pnl);
  const loserPnl   = losers.map(t => t.pnl);
  const winnerR    = winners.map(t => t.realizedR);
  const loserR     = losers.map(t => t.realizedR);
  const allR       = trades.map(t => t.realizedR);
  const allPnl     = trades.map(t => t.pnl);

  const sumWinners = sum(winnerPnl);
  const sumLosers  = sum(loserPnl);

  // Profit factor:
  //   no trades              → null
  //   ≥1 winners, 0 losers   → null  (undefined; div by zero)
  //   0 winners, ≥1 losers   → 0     (well-defined zero gross profit)
  //   ≥1 winners, ≥1 losers  → sum(winners)/|sum(losers)|
  let profitFactor;
  if (n === 0)               profitFactor = null;
  else if (losses === 0)     profitFactor = null;
  else                       profitFactor = sumWinners / Math.abs(sumLosers);

  const dd = computeDrawdown(equityCurve);

  return {
    initialEquity,
    finalEquity,
    totalReturnPct:        ((finalEquity - initialEquity) / initialEquity) * 100,
    totalTrades:           n,
    wins, losses, breakevens,
    winRate:               n === 0 ? null : wins / n,
    profitFactor,
    expectancy:            n === 0 ? null : sum(allPnl) / n,
    avgR:                  n === 0 ? null : sum(allR) / n,
    avgWinnerR:            wins   === 0 ? null : sum(winnerR) / wins,
    avgLoserR:             losses === 0 ? null : sum(loserR)  / losses,
    avgWinnerPnl:          wins   === 0 ? null : sumWinners   / wins,
    avgLoserPnl:           losses === 0 ? null : sumLosers    / losses,
    largestWinnerR:        wins   === 0 ? null : Math.max(...winnerR),
    largestLoserR:         losses === 0 ? null : Math.min(...loserR),
    maxDrawdownPct:        dd.maxDdPct,
    maxDrawdownAbs:        dd.maxDdAbs,
    longestUnderwaterBars: dd.longestUnderwater,
  };
}

// Compute peak-to-trough drawdown over the equity curve. Skips the
// SV2-6 anchor (`{ ts: null, equity: initialEquity }`) when present —
// it's an anchor, not a real equity-curve point. Equality is treated as
// recovery (no underwater step accumulated).
function computeDrawdown(equityCurve) {
  const curve = equityCurve.filter(p => p.ts !== null);
  if (curve.length === 0) {
    return { maxDdPct: 0, maxDdAbs: 0, longestUnderwater: 0 };
  }
  const anchor = equityCurve.find(p => p.ts === null);
  let peak = anchor ? anchor.equity : curve[0].equity;
  let maxDdPct = 0, maxDdAbs = 0;
  let underwaterLen = 0, longestUnderwater = 0;
  for (const p of curve) {
    if (p.equity >= peak) {
      peak = p.equity;
      underwaterLen = 0;
    } else {
      const ddAbs = peak - p.equity;
      const ddPct = ddAbs / peak;
      if (ddPct > maxDdPct) maxDdPct = ddPct;
      if (ddAbs > maxDdAbs) maxDdAbs = ddAbs;
      underwaterLen++;
      if (underwaterLen > longestUnderwater) longestUnderwater = underwaterLen;
    }
  }
  return { maxDdPct: maxDdPct * 100, maxDdAbs, longestUnderwater };
}

// ─── Daily risk ────────────────────────────────────────────────────────────
function computeDailyRisk(dailyStats, halted, trades, config) {
  // haltAt detection runs independently of dailyStats — a backtest can
  // halt on an equity-floor breach even before any day-level rollup is
  // produced. Compute this first.
  let haltAt = null;
  if (halted) {
    const initEq   = config.initialEquity;
    const floorPct = config.equityFloorPct ?? 0.5;
    if (Number.isFinite(initEq) && Number.isFinite(floorPct)) {
      const floor = initEq * floorPct;
      const haltTrade = trades.find(t => Number.isFinite(t.equityAfter) && t.equityAfter <= floor);
      if (haltTrade) haltAt = haltTrade.exitTs;
    }
  }

  if (dailyStats.length === 0) {
    return {
      dailyDrawdownMaxPct:  null,
      dailyDrawdownAvgPct:  null,
      daysWithMaxTradesHit: 0,
      daysWithMaxLossesHit: 0,
      daysWithDailyDdHit:   0,
      equityFloorHalted:    halted === true,
      haltAt,
    };
  }

  let maxDdPct = 0;
  const lossDayPcts = [];
  for (const d of dailyStats) {
    if (!Number.isFinite(d.dayStartEquity) || d.dayStartEquity <= 0) continue;
    const ddPct = Math.max(0, -d.dailyPnl / d.dayStartEquity);
    if (ddPct > maxDdPct) maxDdPct = ddPct;
    if (d.dailyPnl < 0) lossDayPcts.push(ddPct);
  }
  const dailyDrawdownAvgPct = lossDayPcts.length === 0
    ? null
    : (sum(lossDayPcts) / lossDayPcts.length) * 100;

  return {
    dailyDrawdownMaxPct:  maxDdPct * 100,
    dailyDrawdownAvgPct,
    daysWithMaxTradesHit: dailyStats.filter(d => d.capHit === "max_trades_day").length,
    daysWithMaxLossesHit: dailyStats.filter(d => d.capHit === "max_losses_day").length,
    daysWithDailyDdHit:   dailyStats.filter(d => d.ddHit === true || d.capHit === "max_daily_drawdown").length,
    equityFloorHalted:    halted === true,
    haltAt,
  };
}

// ─── Strategy V2 specific ──────────────────────────────────────────────────
function computeStrategyV2(trades) {
  const n = trades.length;
  if (n === 0) {
    return {
      tp1HitRate:       null,
      tp2HitRate:       null,
      perfect:          { count: 0, wins: 0, winRate: null, avgR: null },
      standard:         { count: 0, wins: 0, winRate: null, avgR: null },
      outcomeBreakdown: { sl_full: 0, tp1_then_be_sl: 0, tp1_then_tp2: 0, incomplete: 0 },
    };
  }

  const tp1Hit = trades.filter(t => t.tp1Ts != null).length;
  const tp2Hit = trades.filter(t => t.tp2Ts != null).length;

  const tierStats = (tier) => {
    const sub = trades.filter(t => t.tier === tier);
    if (sub.length === 0) return { count: 0, wins: 0, winRate: null, avgR: null };
    const wins = sub.filter(t => t.realizedR > 0).length;
    const avgR = sum(sub.map(t => t.realizedR)) / sub.length;
    return { count: sub.length, wins, winRate: wins / sub.length, avgR };
  };

  const breakdown = { sl_full: 0, tp1_then_be_sl: 0, tp1_then_tp2: 0, incomplete: 0 };
  for (const t of trades) {
    if (Object.prototype.hasOwnProperty.call(breakdown, t.outcome)) {
      breakdown[t.outcome]++;
    }
  }

  return {
    tp1HitRate:       tp1Hit / n,
    tp2HitRate:       tp1Hit === 0 ? null : tp2Hit / tp1Hit,
    perfect:          tierStats("perfect"),
    standard:         tierStats("standard"),
    outcomeBreakdown: breakdown,
  };
}

// ─── Risk-adjusted (Sharpe, Sortino) ──────────────────────────────────────
function computeRiskAdjusted(dailyStats) {
  if (dailyStats.length < 2) return { sharpe: null, sortino: null };
  const returns = [];
  for (const d of dailyStats) {
    if (!Number.isFinite(d.dayStartEquity) || d.dayStartEquity <= 0) continue;
    if (!Number.isFinite(d.dailyPnl)) continue;
    returns.push(d.dailyPnl / d.dayStartEquity);
  }
  if (returns.length < 2) return { sharpe: null, sortino: null };

  const meanR = sum(returns) / returns.length;
  // Sample standard deviation (n-1 denominator).
  const variance = sum(returns.map(r => (r - meanR) ** 2)) / (returns.length - 1);
  const stdDev   = Math.sqrt(variance);
  const sharpe   = stdDev === 0 ? null : (meanR / stdDev) * ANNUALIZATION_FACTOR;

  // Sortino: downside-only second moment around target = 0, divisor = N
  // (population, not sample), per standard definition. Returns null when
  // there are zero negative-return days.
  const hasNeg     = returns.some(r => r < 0);
  const negDevsSq  = returns.map(r => Math.min(0, r) ** 2);
  const downVar    = sum(negDevsSq) / returns.length;
  const downDev    = Math.sqrt(downVar);
  const sortino    = (!hasNeg || downDev === 0)
    ? null
    : (meanR / downDev) * ANNUALIZATION_FACTOR;

  return { sharpe, sortino };
}

// ─── Health ────────────────────────────────────────────────────────────────
function computeHealth(trades, skipped, dailyStats) {
  const n = trades.length;
  const avgTimeInTradeMin = n === 0
    ? null
    : sum(trades.map(t => t.exitTs - t.entryTs)) / n / 60000;

  // Streaks: walk in chronological order. Breakevens (R === 0) reset
  // both running counters. Wins increment win streak, losses increment
  // loss streak; each resets the other.
  const sorted = [...trades].sort((a, b) => a.entryTs - b.entryTs);
  let curWin = 0, curLoss = 0, maxWin = 0, maxLoss = 0;
  for (const t of sorted) {
    if (t.realizedR > 0) {
      curWin += 1;
      curLoss = 0;
      if (curWin > maxWin) maxWin = curWin;
    } else if (t.realizedR < 0) {
      curLoss += 1;
      curWin = 0;
      if (curLoss > maxLoss) maxLoss = curLoss;
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }

  const reasons = {
    max_trades_day:     0,
    max_losses_day:     0,
    max_daily_drawdown: 0,
    halted:             0,
    equity_floor:       0,
  };
  for (const s of skipped) {
    if (Object.prototype.hasOwnProperty.call(reasons, s.reason)) {
      reasons[s.reason]++;
    }
  }

  return {
    daysTraded:            dailyStats.length,
    avgTimeInTradeMin,
    longestWinningStreak:  maxWin,
    longestLosingStreak:   maxLoss,
    skippedTradesByReason: reasons,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function sum(arr) {
  let s = 0;
  for (const x of arr) s += x;
  return s;
}

function validateInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("computeMetrics: input must be an object");
  }
  const r = input.riskResult;
  if (!r || typeof r !== "object") {
    throw new TypeError("computeMetrics: input.riskResult is required");
  }
  for (const k of ["acceptedTrades", "skippedTrades", "equityCurve", "dailyStats"]) {
    if (!Array.isArray(r[k])) {
      throw new TypeError(`computeMetrics: riskResult.${k} must be an array`);
    }
  }
  if (!Number.isFinite(r.initialEquity) || r.initialEquity <= 0) {
    throw new TypeError("computeMetrics: riskResult.initialEquity must be a positive finite number");
  }
  if (!Number.isFinite(r.finalEquity)) {
    throw new TypeError("computeMetrics: riskResult.finalEquity must be a finite number");
  }
  if (typeof r.halted !== "boolean") {
    throw new TypeError("computeMetrics: riskResult.halted must be a boolean");
  }
}
