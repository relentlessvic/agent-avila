// Phase SV2-6 — offline Strategy V2 risk manager and daily caps.
//
// Wraps the simulator's trade stream with:
//
//   1. Currency-based equity accounting (compounding):
//        riskAmount = currentEquity × trade.riskPct
//        pnl        = trade.realizedR  × riskAmount
//        equity    += pnl
//
//   2. Daily caps using UTC day boundaries:
//        a. max `maxTradesPerDay` filled trades per UTC day  (default 3)
//        b. max `maxLossesPerDay` losing trades per UTC day (default 2)
//        c. max `maxDailyDrawdownPct` cumulative day P&L     (default 3%)
//           (any subsequent same-day trade is skipped once the threshold
//            has been crossed by a completed trade)
//
//   3. Equity floor:
//        if equity falls TO or BELOW `initialEquity × equityFloorPct`
//        after any trade settles, the entire backtest is halted; all
//        later trades are skipped with reason = "halted".
//
// IMPORTANT: tier classification is upstream
// -------------------------------------------
// `trade.riskPct` is trusted as supplied. The risk manager does NOT
// decide whether a setup is "perfect" (1.5%) or "standard" (1.0%) — that
// classification is the signal combiner's job (SV2-4 §`tier`) and is
// copied into the simulator's trade record (SV2-5). This module simply
// multiplies `currentEquity × trade.riskPct` to produce the position's
// risk amount.
//
// SAFETY CONTRACT
// ---------------
// 1. No imports outside backtest/**. (No imports at all in this module.)
// 2. No I/O. No env vars. No clock reads. No global state.
// 3. Deterministic given the same inputs.
// 4. No bot.js / db.js / dashboard.js / Postgres / Kraken access.
// 5. Cannot place real orders. Cannot mutate `bot_control` or
//    `position.json`. Pure function semantics.

export const DEFAULT_RISK_CONFIG = Object.freeze({
  initialEquity:        10000,
  maxTradesPerDay:      3,
  maxLossesPerDay:      2,
  maxDailyDrawdownPct:  0.03,
  equityFloorPct:       0.5,
});

export const SKIP_REASONS = Object.freeze({
  MAX_TRADES_DAY:  "max_trades_day",
  MAX_LOSSES_DAY:  "max_losses_day",
  MAX_DAILY_DD:    "max_daily_drawdown",
  EQUITY_FLOOR:    "equity_floor",
  HALTED:          "halted",
});

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Public API ────────────────────────────────────────────────────────────
export function applyRiskManagement(trades, options = {}) {
  if (!Array.isArray(trades)) throw new TypeError("applyRiskManagement: trades must be an array");
  const cfg = mergeConfig(options);
  validateTrades(trades);

  // Sort defensively — simulator emits in order but we don't rely on it.
  const sorted = [...trades].sort((a, b) => a.entryTs - b.entryTs);

  let equity = cfg.initialEquity;
  let halted = false;
  let haltReason = null;

  const accepted = [];
  const skipped  = [];
  const equityCurve = [{ ts: null, equity }];   // pre-trading anchor
  const dailyStatsMap = new Map();

  // Per-day rolling state.
  let currentDay   = null;
  let dayStartEq   = equity;
  let dayFilled    = 0;
  let dayLosses    = 0;
  let dayPnl       = 0;

  function ensureStats(day) {
    if (!dailyStatsMap.has(day)) {
      dailyStatsMap.set(day, {
        dayUtcMs:        day,
        dayStartEquity:  0,
        dayEndEquity:    0,
        tradesFilled:    0,
        tradesSkipped:   0,
        wins:            0,
        losses:          0,
        breakevens:      0,
        dailyPnl:        0,
        ddHit:           false,
        capHit:          null,
      });
    }
    return dailyStatsMap.get(day);
  }
  function rollDay(day) {
    currentDay = day;
    dayStartEq = equity;
    dayFilled = 0;
    dayLosses = 0;
    dayPnl = 0;
    const s = ensureStats(day);
    s.dayStartEquity = dayStartEq;
    s.dayEndEquity   = dayStartEq;
  }

  for (const trade of sorted) {
    const tradeDay = Math.floor(trade.entryTs / DAY_MS) * DAY_MS;
    if (currentDay === null || tradeDay !== currentDay) rollDay(tradeDay);
    const stats = ensureStats(tradeDay);

    if (halted) {
      skipped.push({ trade, reason: SKIP_REASONS.HALTED, dayUtcMs: tradeDay });
      stats.tradesSkipped++;
      if (!stats.capHit) stats.capHit = SKIP_REASONS.HALTED;
      continue;
    }

    // Cap order: trades-per-day → losses-per-day → daily-DD.
    if (dayFilled >= cfg.maxTradesPerDay) {
      skipped.push({ trade, reason: SKIP_REASONS.MAX_TRADES_DAY, dayUtcMs: tradeDay });
      stats.tradesSkipped++;
      if (!stats.capHit) stats.capHit = SKIP_REASONS.MAX_TRADES_DAY;
      continue;
    }
    if (dayLosses >= cfg.maxLossesPerDay) {
      skipped.push({ trade, reason: SKIP_REASONS.MAX_LOSSES_DAY, dayUtcMs: tradeDay });
      stats.tradesSkipped++;
      if (!stats.capHit) stats.capHit = SKIP_REASONS.MAX_LOSSES_DAY;
      continue;
    }
    const ddThreshold = -dayStartEq * cfg.maxDailyDrawdownPct;
    if (dayPnl <= ddThreshold) {
      skipped.push({ trade, reason: SKIP_REASONS.MAX_DAILY_DD, dayUtcMs: tradeDay });
      stats.tradesSkipped++;
      stats.ddHit = true;
      if (!stats.capHit) stats.capHit = SKIP_REASONS.MAX_DAILY_DD;
      continue;
    }

    // Accept the trade. Risk sizing uses CURRENT equity (compounding).
    const riskAmount = equity * trade.riskPct;
    const pnl        = trade.realizedR * riskAmount;
    const entryEquity = equity;
    equity += pnl;
    dayPnl += pnl;
    dayFilled++;
    if (trade.realizedR < 0) {
      dayLosses++;
      stats.losses++;
    } else if (trade.realizedR > 0) {
      stats.wins++;
    } else {
      stats.breakevens++;
    }
    stats.tradesFilled++;
    stats.dailyPnl     = dayPnl;
    stats.dayEndEquity = equity;

    accepted.push({
      ...trade,
      entryEquity,
      riskAmount,
      pnl,
      equityAfter: equity,
      dayUtcMs:    tradeDay,
    });
    equityCurve.push({ ts: trade.exitTs, equity });

    // Equity floor: post-trade check. Once tripped, halt remains for all
    // subsequent trades (they're skipped with reason "halted"). Uses `<=`
    // so equity falling exactly to the floor also halts (per Codex review
    // 2026-05-01 — "falls to or below").
    if (equity <= cfg.initialEquity * cfg.equityFloorPct) {
      halted = true;
      haltReason = SKIP_REASONS.EQUITY_FLOOR;
    }
  }

  return {
    initialEquity:    cfg.initialEquity,
    finalEquity:      equity,
    acceptedTrades:   accepted,
    skippedTrades:    skipped,
    equityCurve,
    dailyStats:       [...dailyStatsMap.values()].sort((a, b) => a.dayUtcMs - b.dayUtcMs),
    halted,
    haltReason,
    config:           cfg,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function mergeConfig(options) {
  const cfg = { ...DEFAULT_RISK_CONFIG, ...(options || {}) };
  if (!Number.isFinite(cfg.initialEquity) || cfg.initialEquity <= 0) {
    throw new RangeError(`initialEquity must be a positive finite number, got ${cfg.initialEquity}`);
  }
  if (!Number.isInteger(cfg.maxTradesPerDay) || cfg.maxTradesPerDay <= 0) {
    throw new RangeError(`maxTradesPerDay must be a positive integer, got ${cfg.maxTradesPerDay}`);
  }
  if (!Number.isInteger(cfg.maxLossesPerDay) || cfg.maxLossesPerDay <= 0) {
    throw new RangeError(`maxLossesPerDay must be a positive integer, got ${cfg.maxLossesPerDay}`);
  }
  if (!Number.isFinite(cfg.maxDailyDrawdownPct) || cfg.maxDailyDrawdownPct <= 0 || cfg.maxDailyDrawdownPct >= 1) {
    throw new RangeError(`maxDailyDrawdownPct must be in (0, 1), got ${cfg.maxDailyDrawdownPct}`);
  }
  if (!Number.isFinite(cfg.equityFloorPct) || cfg.equityFloorPct <= 0 || cfg.equityFloorPct >= 1) {
    throw new RangeError(`equityFloorPct must be in (0, 1), got ${cfg.equityFloorPct}`);
  }
  return cfg;
}

// `trade.riskPct` is trusted as supplied by upstream. The risk manager
// does NOT decide whether a setup is "perfect" or "standard" — that
// classification is made by the signal combiner (SV2-4) and copied into
// the simulator's trade record (SV2-5). The risk manager simply applies
// the supplied `riskPct` to compute position size.
function validateTrades(trades) {
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (!t || typeof t !== "object") {
      throw new TypeError(`applyRiskManagement: trade[${i}] is not an object`);
    }
    if (!Number.isFinite(t.entryTs)) {
      throw new TypeError(`applyRiskManagement: trade[${i}].entryTs is not finite`);
    }
    if (!Number.isFinite(t.exitTs)) {
      throw new TypeError(`applyRiskManagement: trade[${i}].exitTs is not finite`);
    }
    if (!Number.isFinite(t.realizedR)) {
      throw new TypeError(`applyRiskManagement: trade[${i}].realizedR is not finite`);
    }
    if (!Number.isFinite(t.riskPct) || t.riskPct <= 0 || t.riskPct >= 1) {
      throw new TypeError(`applyRiskManagement: trade[${i}].riskPct must be in (0, 1), got ${t.riskPct}`);
    }
  }
}
