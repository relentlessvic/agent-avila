/**
 * Claude + TradingView MCP — Automated Trading Bot
 *
 * Cloud mode: runs on Railway on a schedule. Pulls candle data direct from
 * Binance (free, no auth), calculates all indicators, runs safety check,
 * executes via Kraken if everything lines up.
 *
 * Local mode: run manually — node bot.js
 * Cloud mode: deploy to Railway, set env vars, Railway triggers on cron schedule
 */

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, appendFileSync, unlinkSync } from "fs";
import crypto from "crypto";
import { execSync } from "child_process";

// ─── Single-instance lock ─────────────────────────────────────────────────────
// Prevents duplicate bot.js processes from running concurrently. Three
// triggers can spawn this script (Railway cron, dashboard embedded runner,
// /api/run-bot endpoint); without a lock they could double-execute trades.
const LOCK_FILE = ".bot.lock";

function acquireBotLock() {
  if (existsSync(LOCK_FILE)) {
    const raw = readFileSync(LOCK_FILE, "utf8").trim();
    const pid = parseInt(raw, 10);
    if (Number.isFinite(pid)) {
      try { process.kill(pid, 0); return false; } // process alive -> lock held
      catch { /* stale lock, fall through and overwrite */ }
    }
  }
  writeFileSync(LOCK_FILE, String(process.pid));
  return true;
}
function releaseBotLock() {
  try {
    const raw = existsSync(LOCK_FILE) ? readFileSync(LOCK_FILE, "utf8").trim() : "";
    if (raw === String(process.pid)) unlinkSync(LOCK_FILE);
  } catch {}
}
// Always release on any exit path (clean, signal, uncaught throw)
process.on("exit",   releaseBotLock);
process.on("SIGINT", () => { releaseBotLock(); process.exit(130); });
process.on("SIGTERM",() => { releaseBotLock(); process.exit(143); });

// ─── Onboarding ───────────────────────────────────────────────────────────────

function checkOnboarding() {
  const required = ["KRAKEN_API_KEY", "KRAKEN_SECRET_KEY"];
  const missing = required.filter((k) => !process.env[k]);

  // On Railway, env vars are injected directly — no .env file needed
  if (process.env.RAILWAY_ENVIRONMENT) {
    if (missing.length > 0) {
      console.log(`\n⚠️  Missing Railway env vars: ${missing.join(", ")}`);
      console.log("Add them in your Railway project → Variables tab.\n");
      process.exit(1);
    }
    return;
  }

  if (!existsSync(".env")) {
    console.log(
      "\n⚠️  No .env file found — opening it for you to fill in...\n",
    );
    writeFileSync(
      ".env",
      [
        "# Kraken credentials",
        "KRAKEN_API_KEY=",
        "KRAKEN_SECRET_KEY=",
        "",
        "# Trading config",
        "PORTFOLIO_VALUE_USD=1000",
        "MAX_TRADE_SIZE_USD=100",
        "MAX_TRADES_PER_DAY=3",
        "PAPER_TRADING=true",
        "SYMBOL=BTCUSDT",
        "TIMEFRAME=5m",
        "PAPER_STARTING_BALANCE=500",
      ].join("\n") + "\n",
    );
    try {
      execSync("open .env");
    } catch {}
    console.log(
      "Fill in your Kraken credentials in .env then re-run: node bot.js\n",
    );
    process.exit(0);
  }

  if (missing.length > 0) {
    console.log(`\n⚠️  Missing Kraken credentials in .env: ${missing.join(", ")}`);
    console.log("Opening .env for you now...\n");
    try {
      execSync("open .env");
    } catch {}
    console.log("Add the missing values then re-run: node bot.js\n");
    process.exit(0);
  }

  // Always print the CSV location so users know where to find their trade log
  const csvPath = new URL("trades.csv", import.meta.url).pathname;
  console.log(`\n📄 Trade log: ${csvPath}`);
  console.log(
    `   Open in Google Sheets or Excel any time — or tell Claude to move it:\n` +
      `   "Move my trades.csv to ~/Desktop" or "Move it to my Documents folder"\n`,
  );
}

// ─── Discord Notifications (one-way webhook) ────────────────────────────────

// Translate the agent's 4-condition signal into human-readable reasoning.
// Picks the strongest signal contributors and pairs them with regime context.
function describeSignalReason(signal, vol, rsi3) {
  const parts = [];
  if (rsi3 < 25)               parts.push("RSI oversold");
  else if (rsi3 < 35)          parts.push("RSI dip");
  if (signal.bullishBias)      parts.push("EMA+VWAP bullish");
  else if (signal.conditions?.[0]?.pass) parts.push("EMA uptrend");
  else if (signal.conditions?.[2]?.pass) parts.push("VWAP support");
  if (signal.conditions?.[3]?.pass) parts.push("not overextended");
  if (vol.regime && vol.regime !== "VOLATILE") parts.push(`${vol.regime.toLowerCase()} regime`);
  return parts.length ? parts.join(" · ") : "strategy trigger";
}

async function notifyDiscord(message) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return false; // no webhook configured -> not delivered
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message.slice(0, 1900) }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    return res.ok; // Discord returns 204 on success
  } catch (err) {
    console.log(`[discord] notification failed: ${err.message}`);
    return false; // never let Discord failures block the bot
  }
}

// Compose and send a once-per-day summary covering yesterday's UTC trades.
// Idempotent: tracks lastSummaryDate in bot-control.json so a 5-min cron
// can't re-emit. Skips if today's UTC date matches the last-sent date.
async function maybeSendDailySummary(log, ctrl) {
  const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (ctrl.lastSummaryDate === todayUtc) return;          // already sent today

  // Summarize yesterday's trades (the day that just closed)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const yTrades = log.trades.filter(t => t.timestamp?.startsWith(yesterday));
  const exits   = yTrades.filter(t => t.type === "EXIT" && t.exitReason !== "REENTRY_SIGNAL");
  const entries = yTrades.filter(t => t.orderPlaced && t.type !== "EXIT");
  const wins    = exits.filter(t => parseFloat(t.pnlUSD) > 0);
  const losses  = exits.filter(t => parseFloat(t.pnlUSD) < 0);
  const pnlUsd  = exits.reduce((s, t) => s + parseFloat(t.pnlUSD || 0), 0);
  const peakScore = Math.max(0, ...yTrades.map(t => t.signalScore || 0));
  const skips = yTrades.filter(t => !t.orderPlaced && t.type !== "EXIT").length;

  const winRate = exits.length ? `${Math.round((wins.length / exits.length) * 100)}%` : "—";
  const pnlStr  = pnlUsd >= 0 ? `+$${pnlUsd.toFixed(2)}` : `-$${Math.abs(pnlUsd).toFixed(2)}`;

  const delivered = await notifyDiscord(
    `📊 DAILY SUMMARY · ${yesterday}\n` +
    `Asset: ${CONFIG.symbol}\n` +
    `Trades: ${entries.length} entries · ${exits.length} exits (${wins.length}W / ${losses.length}L · ${winRate})\n` +
    `P&L: ${pnlStr}${CONFIG.paperTrading ? " · paper" : " · live"}\n` +
    `Peak score: ${peakScore.toFixed(0)}/100 · ${skips} skipped cycles`
  );

  if (delivered) {
    ctrl.lastSummaryDate = todayUtc;
    saveControl(ctrl);
  } else {
    console.log("[summary] Discord delivery failed — will retry next cycle");
  }
}

// ─── Config ────────────────────────────────────────────────────────────────

const CONFIG = {
  symbol: process.env.SYMBOL || "BTCUSDT",
  timeframe: process.env.TIMEFRAME || "5m",
  portfolioValue: parseFloat(process.env.PORTFOLIO_VALUE_USD || "1000"),
  maxTradeSizeUSD: parseFloat(process.env.MAX_TRADE_SIZE_USD || "100"),
  maxTradesPerDay: parseInt(process.env.MAX_TRADES_PER_DAY || "3"),
  paperTrading: process.env.PAPER_TRADING !== "false",
  tradeMode: process.env.TRADE_MODE || "spot",
  stopLossPct: parseFloat(process.env.STOP_LOSS_PCT || "1.25"),
  takeProfitPct: parseFloat(process.env.TAKE_PROFIT_PCT || "2.0"),
  leverage: Math.min(Math.max(parseInt(process.env.LEVERAGE || "2"), 1), 3),
  riskPct: parseFloat(process.env.RISK_PCT || "1.0"),
  dynamicSizing: true,
  maxDailyLossPct: 3.0,
  cooldownMinutes: 15,
  killSwitchEnabled: true,
  killSwitchDrawdownPct: 5.0,
  pauseAfterLosses: 3,
  paperStartingBalance: parseFloat(process.env.PAPER_STARTING_BALANCE || "100"),
  kraken: {
    apiKey: process.env.KRAKEN_API_KEY,
    secretKey: process.env.KRAKEN_SECRET_KEY,
    baseUrl: "https://api.kraken.com",
  },
};

const LOG_FILE          = "safety-check-log.json";
const CONTROL_FILE      = "bot-control.json";
const PERF_STATE_FILE   = "performance-state.json";
const CAPITAL_FILE      = "capital-state.json";
const PORTFOLIO_FILE    = "portfolio-state.json";

// ─── Portfolio Intelligence ──────────────────────────────────────────────────

function calcPortfolioHealthScore(perf, vol) {
  if (perf.totalTrades < 3) return { score: 50, components: { winRate: 50, profitFactor: 50, volatility: 50, drawdown: 50 } };

  const winRateScore      = Math.min(perf.winRate * 100, 100) * 0.30;
  const pfNorm            = Math.min(perf.profitFactor / 2.0, 1.0);
  const pfScore           = pfNorm * 100 * 0.30;
  const spikeR            = parseFloat(vol?.spikeRatio || "1") || 1;
  const volEfficiency     = Math.max(0, 1 - (spikeR - 0.5) / 3.5) * 100;
  const volScore          = volEfficiency * 0.20;
  const drawdownStability = Math.max(0, 1 - perf.drawdown / 5) * 100;
  const ddScore           = drawdownStability * 0.20;

  const score = Math.min(100, winRateScore + pfScore + volScore + ddScore);
  return { score: Math.round(score), components: { winRate: Math.round(winRateScore/0.3), profitFactor: Math.round(pfScore/0.3), volatility: Math.round(volEfficiency), drawdown: Math.round(drawdownStability) } };
}

function calcMarketQualityMultiplier(signalScore) {
  if (signalScore >= 85) return { multiplier: 1.0,  quality: "High",   label: "High Quality — full size" };
  if (signalScore >= 75) return { multiplier: 0.85, quality: "Medium", label: "Medium — reduced size" };
  return                        { multiplier: 0.7,  quality: "Low",    label: "Low — minimum size" };
}

function updatePortfolioState(perf, position, vol, price) {
  const realizedPnl   = perf ? perf.avgProfit * (perf.wins || 0) - perf.avgLoss * (perf.losses || 0) : 0;
  const paperBalance  = CONFIG.paperStartingBalance + realizedPnl;
  const unrealizedPnl = position?.open ? ((price - position.entryPrice) / position.entryPrice) * position.tradeSize : 0;
  const openRiskUSD   = position?.open ? Math.abs(position.entryPrice - position.stopLoss) / position.entryPrice * position.tradeSize : 0;
  const openRiskPct   = paperBalance > 0 ? (openRiskUSD / paperBalance) * 100 : 0;
  const efficiencyScore = perf?.avgLoss > 0 ? Math.min((perf.avgProfit / perf.avgLoss) * 50, 100) : 50;

  const state = {
    healthScore: 0,
    totalBalanceUSD: paperBalance,
    openRiskPct: openRiskPct.toFixed(2),
    unrealizedPnl: unrealizedPnl.toFixed(2),
    realizedPnl: realizedPnl.toFixed(2),
    drawdown: perf?.drawdown || 0,
    targetUsdPct: 60, targetXrpPct: 40,
    efficiencyScore: Math.round(efficiencyScore),
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(PORTFOLIO_FILE, JSON.stringify(state, null, 2));
  return state;
}

// ─── Capital Router ──────────────────────────────────────────────────────────

function loadCapitalState() {
  if (!existsSync(CAPITAL_FILE)) return { xrpRole: "HOLD_ASSET", autoConversion: false, activePct: 70, reservePct: 30 };
  try { return JSON.parse(readFileSync(CAPITAL_FILE, "utf8")); } catch { return {}; }
}

function checkCapitalAvailability(tradeSize, log) {
  const cap = loadCapitalState();

  // Estimate available USD from paper balance
  const realizedPnL    = log.trades.filter(t => t.type === "EXIT" && t.pnlUSD).reduce((s, t) => s + parseFloat(t.pnlUSD), 0);
  const paperBalance   = Math.max(CONFIG.paperStartingBalance + realizedPnL, 0);
  const activeCapital  = paperBalance * (cap.activePct / 100);
  const reserveCapital = paperBalance * (cap.reservePct / 100);

  const sufficient = tradeSize <= activeCapital;

  console.log("\n── Capital Router ───────────────────────────────────────\n");
  console.log(`  XRP role:       ${cap.xrpRole}`);
  console.log(`  Auto-convert:   ${cap.autoConversion ? "ON" : "OFF (safe mode)"}`);
  console.log(`  Active capital: $${activeCapital.toFixed(2)} (${cap.activePct}% of $${paperBalance.toFixed(2)})`);
  console.log(`  Reserve:        $${reserveCapital.toFixed(2)} (${cap.reservePct}%)`);
  console.log(`  Trade size:     $${tradeSize.toFixed(2)} → ${sufficient ? "✅ within active capital" : "⚠️  exceeds active capital — capping"}`);

  return { sufficient, activeCapital, reserveCapital, paperBalance, cap, cappedSize: Math.min(tradeSize, activeCapital) };
}

// ─── Performance State ───────────────────────────────────────────────────────

function loadPerfState() {
  if (!existsSync(PERF_STATE_FILE)) return { totalTrades: 0, wins: 0, losses: 0, winRate: 0, avgProfit: 0, avgLoss: 0, profitFactor: 0, drawdown: 0, consecutiveWins: 0, consecutiveLosses: 0, adaptedThreshold: 75, adaptedRiskMultiplier: 1.0, leverageDisabledUntil: null };
  try { return JSON.parse(readFileSync(PERF_STATE_FILE, "utf8")); } catch { return {}; }
}

function updatePerfState(log) {
  // Only count REAL exits — exclude internal re-entry mechanics (REENTRY_SIGNAL)
  // and only count exits where the position actually closed for a P&L
  const realExits = log.trades.filter(t =>
    t.type === "EXIT" &&
    t.pnlUSD !== undefined &&
    t.exitReason !== "REENTRY_SIGNAL"
  );
  if (!realExits.length) return loadPerfState();

  const wins      = realExits.filter(t => parseFloat(t.pnlUSD) > 0);
  const losses    = realExits.filter(t => parseFloat(t.pnlUSD) < 0);
  const breakeven = realExits.filter(t => parseFloat(t.pnlUSD) === 0);

  const totalTrades  = realExits.length;
  // Win rate excludes breakeven trades from denominator (decisive trades only)
  const decisive     = wins.length + losses.length;
  const winRate      = decisive > 0 ? wins.length / decisive : 0;
  const avgProfit    = wins.length   > 0 ? wins.reduce((s, t)   => s + parseFloat(t.pnlUSD), 0) / wins.length   : 0;
  const avgLoss      = losses.length > 0 ? losses.reduce((s, t) => s + Math.abs(parseFloat(t.pnlUSD)), 0) / losses.length : 0;
  const grossProfit  = wins.reduce((s, t) => s + parseFloat(t.pnlUSD), 0);
  const grossLoss    = losses.reduce((s, t) => s + Math.abs(parseFloat(t.pnlUSD)), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const totalPnL     = realExits.reduce((s, t) => s + parseFloat(t.pnlUSD), 0);
  const drawdown     = totalPnL < 0 ? Math.abs(totalPnL) / CONFIG.paperStartingBalance * 100 : 0;

  // Consecutive wins/losses (skip breakeven)
  let consecutiveWins = 0, consecutiveLosses = 0;
  for (let i = realExits.length - 1; i >= 0; i--) {
    const pnl = parseFloat(realExits[i].pnlUSD);
    if (pnl === 0) continue;
    if (pnl > 0) { if (consecutiveLosses === 0) consecutiveWins++; else break; }
    else         { if (consecutiveWins === 0)   consecutiveLosses++; else break; }
  }

  const perf = { totalTrades, wins: wins.length, losses: losses.length, breakeven: breakeven.length, winRate, avgProfit, avgLoss, profitFactor, drawdown, consecutiveWins, consecutiveLosses, adaptedThreshold: 75, adaptedRiskMultiplier: 1.0, leverageDisabledUntil: null, updatedAt: new Date().toISOString() };
  writeFileSync(PERF_STATE_FILE, JSON.stringify(perf, null, 2));
  return perf;
}

function calcAdaptations(perf, ctrl) {
  const enough = perf.totalTrades >= 5;

  // Entry threshold adaptation
  let entryThreshold = 75;
  if (enough && perf.winRate < 0.45) entryThreshold = 85;
  else if (enough && perf.winRate > 0.65) entryThreshold = 70;

  // Risk multiplier
  let riskMultiplier = 1.0;
  if (perf.drawdown > 3.0) riskMultiplier = 0.5;
  else if (enough && perf.profitFactor > 1.5) riskMultiplier = Math.min(1.1, 1.0 + (perf.profitFactor - 1.5) * 0.1);

  // Force leverage=1x if drawdown > 2%
  const forceLev1x = perf.drawdown > 2.0;

  // Leverage disable timer (30 min on loss_streak >= 2)
  let leverageDisabledUntil = ctrl.leverageDisabledUntil || null;
  if (perf.consecutiveLosses >= 2 && !leverageDisabledUntil) {
    leverageDisabledUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  }
  const leverageLocked = leverageDisabledUntil && new Date(leverageDisabledUntil) > new Date();

  return { entryThreshold, riskMultiplier, forceLev1x, leverageLocked, leverageDisabledUntil };
}

// ─── Market Regime Classification (EMA slope + volatility) ───────────────────

function calcEMASlope(closes, period, lookback = 3) {
  if (closes.length < period + lookback) return 0;
  const current = calcEMA(closes, period);
  const prev    = calcEMA(closes.slice(0, -lookback), period);
  return (current - prev) / prev * 100;
}

function classifyRegime(candles, ema8) {
  const closes     = candles.map(c => c.close);
  const atr        = calcATR(candles, 14);
  if (!atr) return { regime: "RANGE", slPct: 1.25, tpPct: 2.0, leverage: 1 };

  const lastCandle = candles[candles.length - 1];
  const spikeRatio = (lastCandle.high - lastCandle.low) / atr;

  // VOLATILE: spike > 2x ATR → no trade
  if (spikeRatio > 2.0) return { regime: "VOLATILE", slPct: null, tpPct: null, leverage: 1, spikeRatio: spikeRatio.toFixed(2) };

  // EMA slope for TRENDING vs RANGE
  const slope = calcEMASlope(closes, 8, 3);
  const isTrending = Math.abs(slope) > 0.05;

  const regime = isTrending ? "TRENDING" : "RANGE";
  const slPct  = spikeRatio < 0.7 ? 1.0   : 1.25;
  const tpPct  = spikeRatio < 0.7 ? 1.5   : 2.0;
  const leverage = regime === "TRENDING" ? Math.min(2, CONFIG.leverage) : 1;

  console.log("\n── Market Regime ────────────────────────────────────────\n");
  console.log(`  EMA slope: ${slope.toFixed(3)}% | Spike: ${spikeRatio.toFixed(2)}x ATR`);
  console.log(`  Regime: ${regime} | SL: ${slPct}% | TP: ${tpPct}% | Leverage: ${leverage}x`);

  return { regime, slPct, tpPct, leverage, slope: slope.toFixed(3), spikeRatio: spikeRatio.toFixed(2), stable: true };
}

// ─── Decision Logger ─────────────────────────────────────────────────────────

function buildDecisionLog(signal, regime, adaptations) {
  const lines = [
    signal.allPass ? "✅ TRADE FIRED" : "⛔ SKIPPED",
    `EMA trend:    +${signal.conditions[0].score.toFixed(0)}`,
    `RSI dip:      +${signal.conditions[1].score.toFixed(0)}`,
    `VWAP support: +${signal.conditions[2].score.toFixed(0)}`,
    `Not extended: +${signal.conditions[3].score.toFixed(0)}`,
    `TOTAL SCORE:  ${signal.score.toFixed(0)}/100`,
    `THRESHOLD:    ${adaptations.entryThreshold}`,
    `REGIME:       ${regime.regime}`,
    `LEVERAGE:     ${regime.leverage}x`,
  ];
  if (!signal.allPass) {
    const missing = signal.conditions.filter(c => !c.pass).map(c => c.label).join(", ");
    lines.push(`MISSING:      ${missing}`);
  }
  return lines.join(" | ");
}

const DEFAULT_CONTROL = {
  stopped: false, paused: false, killed: false,
  paperTrading: true, leverage: 2, riskPct: 1,
  dynamicSizing: true, maxDailyLossPct: 3, cooldownMinutes: 15,
  killSwitchEnabled: true, killSwitchDrawdownPct: 5, pauseAfterLosses: 3,
  lastTradeTime: null, consecutiveLosses: 0,
};

function loadControl() {
  if (!existsSync(CONTROL_FILE)) {
    writeFileSync(CONTROL_FILE, JSON.stringify(DEFAULT_CONTROL, null, 2));
    return { ...DEFAULT_CONTROL };
  }
  try { return JSON.parse(readFileSync(CONTROL_FILE, "utf8")); }
  catch { return { ...DEFAULT_CONTROL }; }
}

// Override CONFIG with any values set via control file
function saveControl(ctrl) {
  writeFileSync(CONTROL_FILE, JSON.stringify(ctrl, null, 2));
}

function applyControl() {
  const ctrl = loadControl();
  if (ctrl.paperTrading          !== undefined) CONFIG.paperTrading          = ctrl.paperTrading;
  if (ctrl.leverage              !== undefined) CONFIG.leverage              = Math.min(Math.max(parseInt(ctrl.leverage), 1), 3);
  if (ctrl.riskPct               !== undefined) CONFIG.riskPct               = parseFloat(ctrl.riskPct);
  if (ctrl.dynamicSizing         !== undefined) CONFIG.dynamicSizing         = ctrl.dynamicSizing;
  if (ctrl.maxDailyLossPct       !== undefined) CONFIG.maxDailyLossPct       = parseFloat(ctrl.maxDailyLossPct);
  if (ctrl.cooldownMinutes       !== undefined) CONFIG.cooldownMinutes       = parseFloat(ctrl.cooldownMinutes);
  if (ctrl.killSwitchEnabled     !== undefined) CONFIG.killSwitchEnabled     = ctrl.killSwitchEnabled;
  if (ctrl.killSwitchDrawdownPct !== undefined) CONFIG.killSwitchDrawdownPct = parseFloat(ctrl.killSwitchDrawdownPct);
  if (ctrl.pauseAfterLosses      !== undefined) CONFIG.pauseAfterLosses      = parseInt(ctrl.pauseAfterLosses);
  return ctrl;
}

// ─── Logging ────────────────────────────────────────────────────────────────

function loadLog() {
  if (!existsSync(LOG_FILE)) return { trades: [] };
  return JSON.parse(readFileSync(LOG_FILE, "utf8"));
}

function saveLog(log) {
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

// ─── Position Tracking ───────────────────────────────────────────────────────

const POSITION_FILE = "position.json";

function loadPosition() {
  if (!existsSync(POSITION_FILE)) return { open: false };
  try { return JSON.parse(readFileSync(POSITION_FILE, "utf8")); }
  catch { return { open: false }; }
}

function savePosition(pos) {
  writeFileSync(POSITION_FILE, JSON.stringify(pos, null, 2));
}

// On first run, auto-restore any existing open paper trade from the log
function initPosition(log) {
  if (existsSync(POSITION_FILE)) return loadPosition();
  const buys = log.trades.filter(t => t.orderPlaced && t.price);
  if (!buys.length) return { open: false };
  const last = buys[buys.length - 1];
  const pos = {
    open: true,
    side: "long",
    symbol: last.symbol,
    entryPrice: last.price,
    entryTime: last.timestamp,
    quantity: last.tradeSize / last.price,
    tradeSize: last.tradeSize,
    orderId: last.orderId,
    stopLoss: last.price * (1 - CONFIG.stopLossPct / 100),
    takeProfit: last.price * (1 + CONFIG.takeProfitPct / 100),
  };
  savePosition(pos);
  console.log(`  ↩️  Restored open position from log — entry $${pos.entryPrice.toFixed(4)}`);
  return pos;
}

// ─── Volatility Check (ATR-based) ────────────────────────────────────────────

function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = candles.length - period - 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low  - candles[i - 1].close)
    );
    trs.push(tr);
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

function classifyVolatility(candles, price) {
  const atr = calcATR(candles, 14);
  if (atr === null) return { level: "NORMAL", slPct: 1.25, tpPct: 2.0, leverage: 2, spikeRatio: "n/a", atrPct: "n/a" };

  const lastCandle = candles[candles.length - 1];
  const lastRange  = lastCandle.high - lastCandle.low;
  const spikeRatio = lastRange / atr;
  const atrPct     = (atr / price) * 100;

  let level, slPct, tpPct, leverage;
  if (spikeRatio > 2.0)      { level = "HIGH";   slPct = null;  tpPct = null;  leverage = 1; }
  else if (spikeRatio < 0.7) { level = "LOW";    slPct = 1.0;   tpPct = 1.5;   leverage = Math.min(3, CONFIG.leverage + 1); }
  else                        { level = "NORMAL"; slPct = 1.25;  tpPct = 2.0;   leverage = CONFIG.leverage; }

  leverage = Math.min(leverage, 3);

  console.log("\n── Volatility Classification ────────────────────────────\n");
  console.log(`  ATR(14): ${atrPct.toFixed(3)}% | Spike ratio: ${spikeRatio.toFixed(2)}x`);
  console.log(`  Level: ${level === "HIGH" ? "🔴 HIGH" : level === "LOW" ? "🟢 LOW" : "🟡 NORMAL"} → SL: ${slPct ?? "N/A"}% | TP: ${tpPct ?? "N/A"}% | Leverage: ${leverage}x`);

  return { level, slPct, tpPct, leverage, spikeRatio: spikeRatio.toFixed(2), atrPct: atrPct.toFixed(3), stable: level !== "HIGH" };
}

function checkLiquidationSafety(leverage) {
  const liquidationDist  = (1 / leverage) * 100;
  const safetyThreshold  = liquidationDist / 3;
  const pass = CONFIG.stopLossPct < safetyThreshold;

  console.log("\n── Liquidation Safety Check ─────────────────────────────\n");
  console.log(`  Leverage:              ${leverage}x`);
  console.log(`  Liquidation distance:  ${liquidationDist.toFixed(2)}%`);
  console.log(`  Safety threshold (÷3): ${safetyThreshold.toFixed(2)}%`);
  console.log(`  Stop loss set at:      ${CONFIG.stopLossPct}%`);
  console.log(`  ${pass ? "✅" : "🚫"} SL ${CONFIG.stopLossPct}% ${pass ? "<" : "≥"} threshold ${safetyThreshold.toFixed(2)}%`);

  return { pass, liquidationDist, safetyThreshold };
}

// ─── Agent 2.0 Guards ────────────────────────────────────────────────────────

function calcDynamicTradeSize(log, slPct) {
  const realizedPnL    = log.trades.filter(t => t.type === "EXIT" && t.pnlUSD).reduce((sum, t) => sum + parseFloat(t.pnlUSD), 0);
  const currentBalance = Math.max(CONFIG.paperStartingBalance + realizedPnL, 10);
  const dollarRisk     = currentBalance * (CONFIG.riskPct / 100);
  // position_size = dollar_risk / SL_distance
  const positionSize   = dollarRisk / (slPct / 100);
  console.log(`  Dynamic sizing: balance $${currentBalance.toFixed(2)} | risk $${dollarRisk.toFixed(2)} | SL ${slPct}% → position $${positionSize.toFixed(2)}`);
  return Math.min(positionSize, CONFIG.maxTradeSizeUSD);
}

function checkMaxDailyLoss(log) {
  const today    = new Date().toISOString().slice(0, 10);
  const losses   = log.trades
    .filter(t => t.type === "EXIT" && t.timestamp?.startsWith(today) && parseFloat(t.pnlUSD || 0) < 0)
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.pnlUSD)), 0);
  const maxLoss  = CONFIG.paperStartingBalance * (CONFIG.maxDailyLossPct / 100);
  const exceeded = losses >= maxLoss;

  console.log("\n── Daily Loss Check ─────────────────────────────────────\n");
  console.log(`  Losses today: $${losses.toFixed(2)} | Limit: $${maxLoss.toFixed(2)} (${CONFIG.maxDailyLossPct}%)`);
  console.log(`  ${exceeded ? "🚫 Daily loss limit REACHED — no more trades today" : "✅ Within limit"}`);
  return { exceeded, losses, maxLoss };
}

function checkCooldown(ctrl) {
  if (!ctrl.lastTradeTime) return { inCooldown: false };
  const elapsed = (Date.now() - new Date(ctrl.lastTradeTime).getTime()) / 60000;
  const inCooldown = elapsed < CONFIG.cooldownMinutes;

  console.log("\n── Cooldown Check ───────────────────────────────────────\n");
  console.log(`  Last trade: ${elapsed.toFixed(1)} min ago | Cooldown: ${CONFIG.cooldownMinutes} min`);
  console.log(`  ${inCooldown ? `⏳ In cooldown — ${(CONFIG.cooldownMinutes - elapsed).toFixed(1)} min remaining` : "✅ Cooldown cleared"}`);
  return { inCooldown, elapsed, remaining: CONFIG.cooldownMinutes - elapsed };
}

function checkKillSwitch(ctrl, log) {
  if (!CONFIG.killSwitchEnabled) return { triggered: false };
  if (ctrl.killed) return { triggered: true, reason: "already triggered" };

  const realizedPnL = log.trades
    .filter(t => t.type === "EXIT" && t.pnlUSD)
    .reduce((sum, t) => sum + parseFloat(t.pnlUSD), 0);
  const drawdownPct = realizedPnL < 0
    ? (Math.abs(realizedPnL) / CONFIG.paperStartingBalance) * 100
    : 0;
  const triggered = drawdownPct >= CONFIG.killSwitchDrawdownPct;

  console.log("\n── Kill Switch Check ────────────────────────────────────\n");
  console.log(`  Realized P&L: $${realizedPnL.toFixed(2)} | Drawdown: ${drawdownPct.toFixed(2)}%`);
  console.log(`  Kill threshold: ${CONFIG.killSwitchDrawdownPct}%`);
  console.log(`  ${triggered ? "🚨 KILL SWITCH TRIGGERED" : "✅ Safe"}`);
  return { triggered, drawdownPct };
}

function checkConsecutiveLosses(log) {
  const exits = log.trades.filter(t => t.type === "EXIT" && t.pnlUSD !== undefined);
  let consecutive = 0;
  for (let i = exits.length - 1; i >= 0; i--) {
    if (parseFloat(exits[i].pnlUSD) < 0) consecutive++;
    else break;
  }
  return consecutive;
}

function checkExitConditions(position, price) {
  if (price <= position.stopLoss)   return { shouldExit: true, reason: "STOP_LOSS",   pct: ((price - position.entryPrice) / position.entryPrice * 100).toFixed(2) };
  if (price >= position.takeProfit) return { shouldExit: true, reason: "TAKE_PROFIT", pct: ((price - position.entryPrice) / position.entryPrice * 100).toFixed(2) };
  return { shouldExit: false };
}

function manageActiveTrade(position, price) {
  const pnlPct = ((price - position.entryPrice) / position.entryPrice) * 100;
  const slDist = (position.entryPrice - position.stopLoss) / position.entryPrice * 100;
  let updated = false;
  let action  = null;

  // Breakeven: profit > 1% → move SL to entry
  if (pnlPct >= 1.0 && position.stopLoss < position.entryPrice) {
    position.stopLoss = position.entryPrice;
    updated = true; action = "BREAKEVEN";
    console.log(`  🔒 Breakeven — SL moved to entry $${position.entryPrice.toFixed(4)}`);
  }

  // Trailing stop: profit > 1.5% → trail SL below current price
  if (pnlPct >= 1.5) {
    const trailSL = price * (1 - slDist / 100);
    if (trailSL > position.stopLoss) {
      position.stopLoss = trailSL;
      updated = true; action = "TRAIL";
      console.log(`  📈 Trailing stop → $${trailSL.toFixed(4)} (${pnlPct.toFixed(2)}% profit locked)`);
    }
  }

  if (updated) savePosition(position);
  return { updated, action, pnlPct };
}

function countTodaysTrades(log) {
  const today = new Date().toISOString().slice(0, 10);
  // Count entries only (BUYs) — exclude EXIT (sells) and holding monitoring entries
  return log.trades.filter(
    (t) => t.timestamp.startsWith(today) && t.orderPlaced && t.type !== "EXIT",
  ).length;
}

// ─── Market Data (Kraken public API — free, no auth, no geo-restrictions) ────

async function fetchCandles(symbol, interval, limit = 720) {
  const intervalMap = {
    "1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30,
    "1H": 60, "4H": 240, "1D": 1440, "1W": 10080,
  };
  const krakenInterval = intervalMap[interval] || 1;
  const krakenPair = mapToKrakenPair(symbol);

  const url = `https://api.kraken.com/0/public/OHLC?pair=${krakenPair}&interval=${krakenInterval}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kraken market API error: ${res.status}`);
  const data = await res.json();
  if (data.error && data.error.length > 0) {
    throw new Error(`Kraken market API: ${data.error.join(", ")}`);
  }

  // Response key is the full pair name (e.g. XXBTZUSD) — find it by excluding "last"
  const pairKey = Object.keys(data.result).find((k) => k !== "last");
  const candles = data.result[pairKey];

  // Kraken OHLC format: [time, open, high, low, close, vwap, volume, count]
  return candles.slice(-limit).map((k) => ({
    time: k[0] * 1000,
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[6]),
  }));
}

// ─── Indicator Calculations ──────────────────────────────────────────────────

function calcEMA(closes, period) {
  const multiplier = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * multiplier + ema * (1 - multiplier);
  }
  return ema;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0,
    losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// VWAP — session-based, resets at midnight UTC
function calcVWAP(candles) {
  const midnightUTC = new Date();
  midnightUTC.setUTCHours(0, 0, 0, 0);
  const sessionCandles = candles.filter((c) => c.time >= midnightUTC.getTime());
  if (sessionCandles.length === 0) return null;
  const cumTPV = sessionCandles.reduce(
    (sum, c) => sum + ((c.high + c.low + c.close) / 3) * c.volume,
    0,
  );
  const cumVol = sessionCandles.reduce((sum, c) => sum + c.volume, 0);
  return cumVol === 0 ? null : cumTPV / cumVol;
}

// ─── Signal Scoring System (Agent 2.0) ──────────────────────────────────────

function evalSignal(price, ema8, vwap, rsi3, threshold = 75) {
  const bullishBias = price > vwap && price > ema8;
  const distVWAP    = Math.abs((price - vwap) / vwap) * 100;

  const emaScore  = price > ema8 ? 30 : 0;
  // Partial-confidence RSI scoring:
  //   RSI ≤ 20 → 30pts (full dip)
  //   RSI 35  → 15pts (threshold)
  //   RSI 50  → 7pts  (neutral)
  //   RSI ≥ 70 → 0pts  (overbought, no buy)
  const rsiScore = rsi3 <= 20 ? 30
                 : rsi3 <= 35 ? 30 - ((rsi3 - 20) / 15) * 15
                 : rsi3 <= 50 ? 15 - ((rsi3 - 35) / 15) * 8
                 : rsi3 <= 70 ? 7  - ((rsi3 - 50) / 20) * 7
                 : 0;
  const vwapScore = price > vwap ? 20 : 0;
  const extScore  = distVWAP < 1.5 ? 20 : 0;

  const score = emaScore + rsiScore + vwapScore + extScore;

  const conditions = [
    { label: "EMA(8) Uptrend",          required: `> ${ema8.toFixed(4)}`,  actual: price.toFixed(4),            pass: price > ema8,    score: emaScore  },
    { label: "RSI(3) Dip (< 35)",       required: "< 35",                  actual: rsi3.toFixed(2),             pass: rsi3 < 35,       score: rsiScore  },
    { label: "VWAP Buyers in Control",  required: `> ${vwap.toFixed(4)}`,  actual: price.toFixed(4),            pass: price > vwap,    score: vwapScore },
    { label: "Not Overextended",        required: "< 1.5%",                actual: distVWAP.toFixed(2) + "%",   pass: distVWAP < 1.5,  score: extScore  },
  ];

  const allPass = score >= threshold;

  console.log("\n── Signal Score ─────────────────────────────────────────\n");
  console.log(`  Bias: ${bullishBias ? "BULLISH" : "NEUTRAL/BEARISH"}`);
  conditions.forEach(c => console.log(`  ${c.pass ? "✅" : "🔲"} ${c.label}: ${c.actual} (+${c.score.toFixed(0)}pts)`));
  console.log(`  Total: ${score.toFixed(0)}/100 ${allPass ? `→ ✅ TRADE (≥${threshold})` : `→ 🚫 SKIP (<${threshold})`}`);

  return { score, conditions, allPass, bullishBias, threshold };
}

// ─── Trade Limits ────────────────────────────────────────────────────────────

function checkTradeLimits(log) {
  const todayCount = countTodaysTrades(log);

  console.log("\n── Trade Limits ─────────────────────────────────────────\n");

  if (todayCount >= CONFIG.maxTradesPerDay) {
    console.log(
      `🚫 Max trades per day reached: ${todayCount}/${CONFIG.maxTradesPerDay}`,
    );
    return false;
  }

  console.log(
    `✅ Trades today: ${todayCount}/${CONFIG.maxTradesPerDay} — within limit`,
  );

  const tradeSize = Math.min(
    CONFIG.portfolioValue * 0.01,
    CONFIG.maxTradeSizeUSD,
  );

  if (tradeSize > CONFIG.maxTradeSizeUSD) {
    console.log(
      `🚫 Trade size $${tradeSize.toFixed(2)} exceeds max $${CONFIG.maxTradeSizeUSD}`,
    );
    return false;
  }

  console.log(
    `✅ Trade size: $${tradeSize.toFixed(2)} — within max $${CONFIG.maxTradeSizeUSD}`,
  );

  return true;
}

// ─── Kraken Execution ────────────────────────────────────────────────────────

// Maps Binance-style symbols to Kraken pair names
function mapToKrakenPair(symbol) {
  const map = {
    BTCUSDT: "XBTUSD",
    ETHUSDT: "ETHUSD",
    SOLUSDT: "SOLUSD",
    ADAUSDT: "ADAUSD",
    XRPUSDT: "XRPUSD",
    DOGEUSDT: "XDGUSD",
    LTCUSDT: "XLTCUSD",
    LINKUSDT: "LINKUSD",
    DOTUSDT: "DOTUSD",
    AVAXUSDT: "AVAXUSD",
    MATICUSDT: "MATICUSD",
    BNBUSDT: "BNBUSD",
  };
  return map[symbol] || symbol;
}

// Kraken HMAC-SHA512 signing: API-Sign = HMAC-SHA512(path + SHA256(nonce + postdata), base64_decode(secret))
function signKraken(path, nonce, postData) {
  const secretBuffer = Buffer.from(CONFIG.kraken.secretKey, "base64");
  const sha256Hash = crypto
    .createHash("sha256")
    .update(nonce + postData)
    .digest();
  return crypto
    .createHmac("sha512", secretBuffer)
    .update(Buffer.concat([Buffer.from(path), sha256Hash]))
    .digest("base64");
}

async function placeKrakenOrder(symbol, side, sizeUSD, price, leverage = 1) {
  const krakenPair = mapToKrakenPair(symbol);
  const volume = (sizeUSD / price).toFixed(8);
  const nonce = Date.now().toString();
  const path = "/0/private/AddOrder";

  const orderParams = { nonce, ordertype: "market", type: side, volume, pair: krakenPair };
  if (leverage > 1) orderParams.leverage = leverage;
  const postData = new URLSearchParams(orderParams).toString();

  const signature = signKraken(path, nonce, postData);

  const res = await fetch(`${CONFIG.kraken.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "API-Key": CONFIG.kraken.apiKey,
      "API-Sign": signature,
    },
    body: postData,
  });

  const data = await res.json();
  if (data.error && data.error.length > 0) {
    throw new Error(`Kraken order failed: ${data.error.join(", ")}`);
  }

  return { orderId: data.result.txid[0] };
}

// ─── Tax CSV Logging ─────────────────────────────────────────────────────────

const CSV_FILE = "trades.csv";

// Always ensure trades.csv exists with headers — open it in Excel/Sheets any time
function initCsv() {
  if (!existsSync(CSV_FILE)) {
    const funnyNote = `,,,,,,,,,,,"NOTE","Hey, if you're at this stage of the video, you must be enjoying it... perhaps you could hit subscribe now? :)"`;
    writeFileSync(CSV_FILE, CSV_HEADERS + "\n" + funnyNote + "\n");
    console.log(
      `📄 Created ${CSV_FILE} — open in Google Sheets or Excel to track trades.`,
    );
  }
}
const CSV_HEADERS = [
  "Date",
  "Time (UTC)",
  "Exchange",
  "Symbol",
  "Side",
  "Quantity",
  "Price",
  "Total USD",
  "Fee (est.)",
  "Net Amount",
  "Order ID",
  "Mode",
  "Notes",
].join(",");

function writeTradeCsv(logEntry) {
  const now = new Date(logEntry.timestamp);
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19);

  let side = "";
  let quantity = "";
  let totalUSD = "";
  let fee = "";
  let netAmount = "";
  let orderId = "";
  let mode = "";
  let notes = "";

  if (logEntry.type === "EXIT") {
    side = "SELL";
    quantity = logEntry.quantity.toFixed(6);
    totalUSD = (logEntry.quantity * logEntry.price).toFixed(2);
    fee = (parseFloat(totalUSD) * 0.001).toFixed(4);
    netAmount = (parseFloat(totalUSD) - parseFloat(fee)).toFixed(2);
    orderId = logEntry.orderId || "";
    mode = logEntry.paperTrading ? "PAPER" : "LIVE";
    notes = `${logEntry.exitReason} | P&L: ${logEntry.pct}% ($${logEntry.pnlUSD})`;
  } else if (!logEntry.allPass) {
    const failed = logEntry.conditions
      .filter((c) => !c.pass)
      .map((c) => c.label)
      .join("; ");
    mode = "BLOCKED";
    orderId = "BLOCKED";
    notes = `Failed: ${failed}`;
  } else if (logEntry.paperTrading) {
    side = "BUY";
    quantity = (logEntry.tradeSize / logEntry.price).toFixed(6);
    totalUSD = logEntry.tradeSize.toFixed(2);
    fee = (logEntry.tradeSize * 0.001).toFixed(4);
    netAmount = (logEntry.tradeSize - parseFloat(fee)).toFixed(2);
    orderId = logEntry.orderId || "";
    mode = "PAPER";
    notes = "All conditions met";
  } else {
    side = "BUY";
    quantity = (logEntry.tradeSize / logEntry.price).toFixed(6);
    totalUSD = logEntry.tradeSize.toFixed(2);
    fee = (logEntry.tradeSize * 0.001).toFixed(4);
    netAmount = (logEntry.tradeSize - parseFloat(fee)).toFixed(2);
    orderId = logEntry.orderId || "";
    mode = "LIVE";
    notes = logEntry.error ? `Error: ${logEntry.error}` : "All conditions met";
  }

  const row = [
    date,
    time,
    "Kraken",
    logEntry.symbol,
    side,
    quantity,
    logEntry.price.toFixed(2),
    totalUSD,
    fee,
    netAmount,
    orderId,
    mode,
    `"${notes}"`,
  ].join(",");

  if (!existsSync(CSV_FILE)) {
    writeFileSync(CSV_FILE, CSV_HEADERS + "\n");
  }

  appendFileSync(CSV_FILE, row + "\n");
  console.log(`Tax record saved → ${CSV_FILE}`);
}

// Tax summary command: node bot.js --tax-summary
function generateTaxSummary() {
  if (!existsSync(CSV_FILE)) {
    console.log("No trades.csv found — no trades have been recorded yet.");
    return;
  }

  const lines = readFileSync(CSV_FILE, "utf8").trim().split("\n");
  const rows = lines.slice(1).map((l) => l.split(","));

  const live = rows.filter((r) => r[11] === "LIVE");
  const paper = rows.filter((r) => r[11] === "PAPER");
  const blocked = rows.filter((r) => r[11] === "BLOCKED");

  const totalVolume = live.reduce((sum, r) => sum + parseFloat(r[7] || 0), 0);
  const totalFees = live.reduce((sum, r) => sum + parseFloat(r[8] || 0), 0);

  console.log("\n── Tax Summary ──────────────────────────────────────────\n");
  console.log(`  Total decisions logged : ${rows.length}`);
  console.log(`  Live trades executed   : ${live.length}`);
  console.log(`  Paper trades           : ${paper.length}`);
  console.log(`  Blocked by safety check: ${blocked.length}`);
  console.log(`  Total volume (USD)     : $${totalVolume.toFixed(2)}`);
  console.log(`  Total fees paid (est.) : $${totalFees.toFixed(4)}`);
  console.log(`\n  Full record: ${CSV_FILE}`);
  console.log("─────────────────────────────────────────────────────────\n");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  if (!acquireBotLock()) {
    console.log("[lock] another bot.js process is running — skipping this cycle");
    return;
  }
  checkOnboarding();
  initCsv();

  // Apply control file overrides before anything else
  const ctrl = applyControl();

  // Daily summary check runs regardless of bot state — useful during pause/kill
  try { await maybeSendDailySummary(loadLog(), ctrl); } catch (e) { console.log("[summary] failed:", e.message); }

  if (ctrl.killed) {
    console.log("🚨 Kill switch is active — trading halted. Reset via dashboard to resume.");
    return;
  }

  if (ctrl.stopped) {
    console.log("⛔ Bot is stopped via control command. Skipping run.");
    return;
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Agent Avila");
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  Mode: ${CONFIG.paperTrading ? "📋 PAPER TRADING" : "🔴 LIVE TRADING"}${ctrl.paused ? " | ⏸ PAUSED" : ""}`);
  console.log("═══════════════════════════════════════════════════════════");

  const rules = JSON.parse(readFileSync("rules.json", "utf8"));
  console.log(`\nStrategy: ${rules.strategy.name}`);
  console.log(`Symbol: ${CONFIG.symbol} | Timeframe: ${CONFIG.timeframe}`);

  const log = loadLog();
  const position = initPosition(log);

  // Fetch market data
  console.log("\n── Fetching market data from Kraken ────────────────────\n");
  const candles = await fetchCandles(CONFIG.symbol, CONFIG.timeframe, 500);
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const ema8  = calcEMA(closes, 8);
  const vwap  = calcVWAP(candles);
  const rsi3  = calcRSI(closes, 3);

  console.log(`  Current price: $${price.toFixed(4)}`);
  console.log(`  EMA(8):  $${ema8.toFixed(4)}`);
  console.log(`  VWAP:    $${vwap ? vwap.toFixed(4) : "N/A"}`);
  console.log(`  RSI(3):  ${rsi3 !== null ? rsi3.toFixed(2) : "N/A"}`);

  if (vwap === null || rsi3 === null) {
    console.log("\n⚠️  Not enough data to calculate indicators. Exiting.");
    return;
  }

  // ── Check exit conditions if position is open ───────────────────────────────
  if (position.open) {
    console.log("\n── Open Position ────────────────────────────────────────\n");
    const pnlPct = ((price - position.entryPrice) / position.entryPrice * 100).toFixed(2);
    const pnlUSD = ((price - position.entryPrice) / position.entryPrice * position.tradeSize).toFixed(2);
    console.log(`  Entry:       $${position.entryPrice.toFixed(4)}`);
    console.log(`  Current:     $${price.toFixed(4)}`);
    console.log(`  Stop Loss:   $${position.stopLoss.toFixed(4)} (-${CONFIG.stopLossPct}%)`);
    console.log(`  Take Profit: $${position.takeProfit.toFixed(4)} (+${CONFIG.takeProfitPct}%)`);
    console.log(`  P&L:         ${pnlPct}% ($${pnlUSD})`);

    const exit = checkExitConditions(position, price);

    if (exit.shouldExit) {
      const exitLabel = exit.reason === "STOP_LOSS" ? "🛑 STOP LOSS HIT" : "🎯 TAKE PROFIT HIT";
      const exitUSD   = ((price - position.entryPrice) / position.entryPrice * position.tradeSize).toFixed(2);
      console.log(`\n  ${exitLabel} — closing position`);
      console.log(`  Exit price: $${price.toFixed(4)} | P&L: ${exit.pct}% ($${exitUSD})`);

      const exitEntry = {
        type: "EXIT",
        timestamp: new Date().toISOString(),
        symbol: position.symbol,
        timeframe: CONFIG.timeframe,
        price,
        quantity: position.quantity,
        tradeSize: position.tradeSize,
        entryPrice: position.entryPrice,
        exitReason: exit.reason,
        pct: exit.pct,
        pnlUSD: exitUSD,
        paperTrading: CONFIG.paperTrading,
        orderId: null,
        indicators: { ema8, vwap, rsi3 },
        conditions: [],
        allPass: false,
        orderPlaced: false,
      };

      if (CONFIG.paperTrading) {
        console.log(`\n  📋 PAPER SELL — ${position.quantity.toFixed(6)} ${position.symbol} at $${price.toFixed(4)}`);
        exitEntry.orderId = `PAPER-SELL-${Date.now()}`;
        exitEntry.orderPlaced = true;
      } else {
        console.log(`\n  🔴 PLACING LIVE SELL — ${position.quantity.toFixed(6)} ${position.symbol}`);
        try {
          const order = await placeKrakenOrder(position.symbol, "sell", position.tradeSize, price);
          exitEntry.orderId = order.orderId;
          exitEntry.orderPlaced = true;
          console.log(`  ✅ SELL ORDER PLACED — ${order.orderId}`);
        } catch (err) {
          console.log(`  ❌ SELL ORDER FAILED — ${err.message}`);
          exitEntry.error = err.message;
          notifyDiscord(
            `⚠️ RISK ALERT\n` +
            `Issue: live SELL order FAILED on ${CONFIG.symbol} @ $${price.toFixed(4)} — ${err.message}`
          );
        }
      }

      savePosition({ open: false });
      log.trades.push(exitEntry);
      saveLog(log);
      writeTradeCsv(exitEntry);

      notifyDiscord(
        `📉 SELL XRP SIGNAL\n` +
        `Asset: ${CONFIG.symbol}\n` +
        `Price: ${price.toFixed(4)}\n` +
        `Reason: ${exit.reason.toLowerCase().replace(/_/g, " ")} · P&L ${exit.pct}% ($${exitUSD})${CONFIG.paperTrading ? " · paper" : ""}`
      );

      // Update cooldown + consecutive loss tracking
      const isLoss = parseFloat(exitEntry.pnlUSD) < 0;
      ctrl.lastTradeTime     = new Date().toISOString();
      ctrl.consecutiveLosses = isLoss ? (parseInt(ctrl.consecutiveLosses || 0) + 1) : 0;
      ctrl.updatedAt         = new Date().toISOString();
      saveControl(ctrl);

      if (isLoss && ctrl.consecutiveLosses >= CONFIG.pauseAfterLosses) {
        ctrl.paused    = true;
        ctrl.updatedBy = "AUTO_PAUSE_LOSSES";
        saveControl(ctrl);
        console.log(`\n⚠️  ${ctrl.consecutiveLosses} consecutive losses — trading auto-paused.`);
        notifyDiscord(
          `⚠️ RISK ALERT\n` +
          `Issue: system pause · ${ctrl.consecutiveLosses} consecutive losses on ${CONFIG.symbol}`
        );
      }

      console.log(`\nPosition closed. Decision log saved → ${LOG_FILE}`);
    } else {
      // Active trade management — breakeven + trailing stop
      const mgmt = manageActiveTrade(position, price);

      // Re-entry signal evaluation
      const newSig    = evalSignal(price, ema8, vwap, rsi3);
      const entryScore = position.entrySignalScore || 0;
      const improvement = newSig.score - entryScore;
      const pnlPct      = ((price - position.entryPrice) / position.entryPrice) * 100;
      const reentryThreshold = pnlPct > 0.5 ? 40 : 20;

      console.log(`\n  📊 New signal score: ${newSig.score.toFixed(0)}/100 (entry was ${entryScore.toFixed(0)}, improvement: ${improvement > 0 ? "+" : ""}${improvement.toFixed(0)})`);

      if (newSig.score >= 65 && improvement >= reentryThreshold) {
        console.log(`\n  🔄 STRONGER SIGNAL (+${improvement.toFixed(0)} pts) — early exit + re-entry`);

        // Close current position
        const exitUSD = ((price - position.entryPrice) / position.entryPrice * position.tradeSize).toFixed(2);
        const pnlStr  = ((price - position.entryPrice) / position.entryPrice * 100).toFixed(2);
        const reexitEntry = {
          type: "EXIT", timestamp: new Date().toISOString(), symbol: position.symbol,
          timeframe: CONFIG.timeframe, price, quantity: position.quantity,
          tradeSize: position.tradeSize, entryPrice: position.entryPrice,
          exitReason: "REENTRY_SIGNAL", pct: pnlStr, pnlUSD: exitUSD,
          paperTrading: CONFIG.paperTrading, orderId: CONFIG.paperTrading ? `PAPER-REXIT-${Date.now()}` : null,
          conditions: [], allPass: false, orderPlaced: true,
        };
        if (!CONFIG.paperTrading) {
          try {
            const o = await placeKrakenOrder(position.symbol, "sell", position.tradeSize, price);
            reexitEntry.orderId = o.orderId;
          } catch (err) { reexitEntry.error = err.message; }
        }
        savePosition({ open: false });
        log.trades.push(reexitEntry);
        saveLog(log);
        writeTradeCsv(reexitEntry);

        // Immediately re-enter with new signal
        const vol2 = classifyRegime(candles, ema8);
        if (vol2.level !== "HIGH") {
          const ts2 = calcDynamicTradeSize(log, vol2.slPct);
          const sl2 = price * (1 - vol2.slPct / 100);
          const tp2 = price * (1 + vol2.tpPct / 100);
          const reorderId = CONFIG.paperTrading ? `PAPER-REENTRY-${Date.now()}` : null;
          if (!CONFIG.paperTrading) {
            try {
              const o = await placeKrakenOrder(position.symbol, "buy", ts2, price, vol2.leverage);
              reorderId = o.orderId;
            } catch (err) { console.log(`  ❌ Re-entry order failed: ${err.message}`); }
          }
          savePosition({
            open: true, side: "long", symbol: CONFIG.symbol,
            entryPrice: price, entryTime: new Date().toISOString(),
            quantity: (ts2 * vol2.leverage) / price, tradeSize: ts2,
            leverage: vol2.leverage, effectiveSize: ts2 * vol2.leverage,
            orderId: reorderId, stopLoss: sl2, takeProfit: tp2,
            entrySignalScore: newSig.score, volatilityLevel: vol2.level,
          });
          console.log(`  ✅ Re-entered — SL $${sl2.toFixed(4)} | TP $${tp2.toFixed(4)} | score ${newSig.score.toFixed(0)}`);
        }
      } else {
        const perfNow = loadPerfState();
      updatePortfolioState(perfNow, position, null, price);
      console.log(`  ✅ Holding — SL/TP monitoring | Active management: ${mgmt.action || "none"}`);
        const holdEntry = {
          timestamp: new Date().toISOString(), symbol: CONFIG.symbol, timeframe: CONFIG.timeframe, price,
          indicators: { ema8, vwap, rsi3 },
          conditions: [{ label: "Holding — monitoring SL/TP", required: "Exit trigger", actual: `SL $${position.stopLoss.toFixed(4)} | TP $${position.takeProfit.toFixed(4)}`, pass: false }],
          allPass: false, orderPlaced: false, paperTrading: CONFIG.paperTrading,
          holding: true, signalScore: newSig.score,
        };
        log.trades.push(holdEntry);
        saveLog(log);
      }
    }

    console.log("═══════════════════════════════════════════════════════════\n");
    return;
  }

  // ── No open position — run all 2.0 entry guards ───────────────────────────
  if (ctrl.paused) {
    console.log("\n⏸ Trading is paused — skipping entry check.");
    console.log("═══════════════════════════════════════════════════════════\n");
    return;
  }

  // Kill switch — drawdown check
  const ks = checkKillSwitch(ctrl, log);
  if (ks.triggered) {
    const wasAlreadyKilled = ctrl.killed === true;
    ctrl.killed = true;
    ctrl.updatedAt = new Date().toISOString();
    ctrl.updatedBy = "KILL_SWITCH_AUTO";
    saveControl(ctrl);
    console.log("🚨 Kill switch triggered — bot halted. Go to dashboard to reset.");
    console.log("═══════════════════════════════════════════════════════════\n");
    if (!wasAlreadyKilled) {
      notifyDiscord(
        `⚠️ RISK ALERT\n` +
        `Issue: kill switch · drawdown ${ks.drawdownPct?.toFixed(2)}% ≥ ${CONFIG.killSwitchDrawdownPct}% on ${CONFIG.symbol}`
      );
    }
    return;
  }

  // Max daily loss
  const dailyLoss = checkMaxDailyLoss(log);
  if (dailyLoss.exceeded) {
    console.log("═══════════════════════════════════════════════════════════\n");
    return;
  }

  // Cooldown after last trade
  const cooldown = checkCooldown(ctrl);
  if (cooldown.inCooldown) {
    console.log(`\n⏳ Cooldown active — ${cooldown.remaining.toFixed(1)} min remaining. Skipping entry.`);
    console.log("═══════════════════════════════════════════════════════════\n");
    return;
  }

  // ── 3.0 Performance state + adaptations ──────────────────────────────────
  const perf        = updatePerfState(log);
  const adaptations = calcAdaptations(perf, ctrl);

  // Timed pause on 3 consecutive losses (60 min)
  const consLosses = perf.consecutiveLosses;
  if (consLosses >= CONFIG.pauseAfterLosses) {
    if (!ctrl.pausedUntil || new Date(ctrl.pausedUntil) <= new Date()) {
      // Set 60-minute timed pause
      ctrl.paused     = true;
      ctrl.pausedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      ctrl.updatedAt  = new Date().toISOString();
      ctrl.updatedBy  = "AUTO_PAUSE_LOSSES_60MIN";
      saveControl(ctrl);
    }
    console.log(`\n🚫 ${consLosses} consecutive losses — paused for 60 min.`);
    console.log("═══════════════════════════════════════════════════════════\n");
    return;
  }
  // Auto-resume timed pause if time has passed
  if (ctrl.pausedUntil && new Date(ctrl.pausedUntil) <= new Date()) {
    ctrl.paused     = false;
    ctrl.pausedUntil = null;
    ctrl.updatedAt  = new Date().toISOString();
    saveControl(ctrl);
    console.log("  ↺ Timed pause expired — trading resumed.");
  }

  // Save leverage disable timer if triggered
  if (adaptations.leverageDisabledUntil && adaptations.leverageDisabledUntil !== ctrl.leverageDisabledUntil) {
    ctrl.leverageDisabledUntil = adaptations.leverageDisabledUntil;
    saveControl(ctrl);
  }

  console.log("\n── Performance State ────────────────────────────────────\n");
  console.log(`  Win rate: ${(perf.winRate * 100).toFixed(0)}% | Profit factor: ${perf.profitFactor.toFixed(2)} | Drawdown: ${perf.drawdown.toFixed(2)}%`);
  console.log(`  Adapted threshold: ${adaptations.entryThreshold} | Risk multiplier: ${adaptations.riskMultiplier.toFixed(2)}x | Leverage locked: ${adaptations.leverageLocked ? "YES (30min)" : "no"}`);

  const withinLimits = checkTradeLimits(log);
  if (!withinLimits) {
    console.log("\nBot stopping — trade limits reached for today.");
    const limitEntry = {
      timestamp: new Date().toISOString(), symbol: CONFIG.symbol, timeframe: CONFIG.timeframe, price,
      indicators: { ema8, vwap, rsi3 },
      conditions: [{ label: "Daily trade limit", required: `< ${CONFIG.maxTradesPerDay}`, actual: `${countTodaysTrades(log)}/${CONFIG.maxTradesPerDay}`, pass: false }],
      allPass: false, orderPlaced: false, paperTrading: CONFIG.paperTrading,
      decisionLog: `⛔ DAILY LIMIT REACHED | Trades today: ${countTodaysTrades(log)}/${CONFIG.maxTradesPerDay} | Resets at midnight UTC`,
    };
    log.trades.push(limitEntry);
    saveLog(log);
    writeTradeCsv(limitEntry);
    return;
  }

  // ── Regime classification (EMA slope + ATR) → SL/TP/leverage ────────────
  const vol = classifyRegime(candles, ema8);

  if (vol.regime === "VOLATILE") {
    console.log(`\n🚫 VOLATILE MARKET — no trade.`);
    const volEntry = {
      timestamp: new Date().toISOString(), symbol: CONFIG.symbol, timeframe: CONFIG.timeframe, price,
      indicators: { ema8, vwap, rsi3 },
      conditions: [{ label: "Regime guard", required: "TRENDING or RANGE", actual: `VOLATILE (${vol.spikeRatio}x ATR)`, pass: false, score: 0 }],
      allPass: false, orderPlaced: false, paperTrading: CONFIG.paperTrading, signalScore: 0,
      volatility: { stable: false, regime: "VOLATILE", spikeRatio: vol.spikeRatio },
      decisionLog: `⛔ SKIPPED | REGIME: VOLATILE | Spike: ${vol.spikeRatio}x ATR`,
    };
    log.trades.push(volEntry);
    saveLog(log);
    writeTradeCsv(volEntry);
    console.log("═══════════════════════════════════════════════════════════\n");
    return;
  }

  // Apply leverage adaptations
  if (adaptations.forceLev1x || adaptations.leverageLocked) {
    vol.leverage = 1;
    console.log(`  ⚠️  Leverage forced to 1x (${adaptations.forceLev1x ? "drawdown > 2%" : "30-min loss protection"})`);
  }

  // ── Signal scoring with adapted threshold ────────────────────────────────
  const signal = evalSignal(price, ema8, vwap, rsi3, adaptations.entryThreshold);

  // ── Liquidation safety with dynamic SL/leverage ───────────────────────────
  const liqSafety = checkLiquidationSafety(vol.leverage);
  if (!liqSafety.pass) {
    console.log(`\n🚫 LIQUIDATION RISK — SL ${vol.slPct}% is too wide for ${vol.leverage}x leverage.`);
    const liqEntry = {
      timestamp: new Date().toISOString(), symbol: CONFIG.symbol, timeframe: CONFIG.timeframe, price,
      indicators: { ema8, vwap, rsi3 },
      conditions: [{ label: "Liquidation safety", required: `SL < ${liqSafety.safetyThreshold.toFixed(2)}%`, actual: `${vol.slPct}%`, pass: false }],
      allPass: false, orderPlaced: false, paperTrading: CONFIG.paperTrading,
      volatility: { stable: true, level: vol.level, spikeRatio: vol.spikeRatio },
    };
    log.trades.push(liqEntry);
    saveLog(log);
    writeTradeCsv(liqEntry);
    console.log("═══════════════════════════════════════════════════════════\n");
    return;
  }

  // Portfolio health + market quality multiplier
  const portfolioHealth = calcPortfolioHealthScore(perf, vol);
  const marketQuality   = calcMarketQualityMultiplier(signal.score);
  console.log(`\n  📊 Portfolio score: ${portfolioHealth.score}/100 | Market quality: ${marketQuality.quality} (${marketQuality.multiplier}x)`);

  const baseSize     = calcDynamicTradeSize(log, vol.slPct);
  const rawSize      = Math.min(baseSize * adaptations.riskMultiplier * marketQuality.multiplier, CONFIG.maxTradeSizeUSD);
  const capitalCheck = checkCapitalAvailability(rawSize, log);
  const tradeSize    = capitalCheck.cappedSize;
  updatePortfolioState(perf, position, vol, price);
  if (adaptations.riskMultiplier !== 1.0 || marketQuality.multiplier !== 1.0) console.log(`  Size: $${tradeSize.toFixed(2)} (perf×${adaptations.riskMultiplier.toFixed(2)} quality×${marketQuality.multiplier})`);

  console.log("\n── Decision ─────────────────────────────────────────────\n");

  const logEntry = {
    timestamp: new Date().toISOString(),
    symbol: CONFIG.symbol,
    timeframe: CONFIG.timeframe,
    price,
    indicators: { ema8, vwap, rsi3 },
    conditions: signal.conditions,
    allPass: signal.allPass,
    signalScore: signal.score,
    tradeSize,
    orderPlaced: false,
    orderId: null,
    paperTrading: CONFIG.paperTrading,
    volatility: { stable: vol.stable, regime: vol.regime, spikeRatio: vol.spikeRatio, slope: vol.slope },
    effectiveLeverage: vol.leverage,
    limits: { maxTradeSizeUSD: CONFIG.maxTradeSizeUSD, maxTradesPerDay: CONFIG.maxTradesPerDay, tradesToday: countTodaysTrades(log) },
    decisionLog: buildDecisionLog(signal, vol, adaptations),
    perfState: { winRate: perf.winRate, drawdown: perf.drawdown, adaptedThreshold: adaptations.entryThreshold, riskMultiplier: adaptations.riskMultiplier },
    capitalState: { xrpRole: capitalCheck.cap.xrpRole, activeCapital: capitalCheck.activeCapital, paperBalance: capitalCheck.paperBalance },
  };

  if (!signal.allPass) {
    console.log(`🚫 SCORE ${signal.score.toFixed(0)}/100 — below 75 threshold, skipping.`);
  } else {
    console.log(`✅ SCORE ${signal.score.toFixed(0)}/100 — entering trade`);

    if (CONFIG.paperTrading) {
      console.log(`\n📋 PAPER TRADE — ${CONFIG.symbol} $${tradeSize.toFixed(2)} × ${vol.leverage}x | SL ${vol.slPct}% | TP ${vol.tpPct}%`);
      logEntry.orderPlaced = true;
      logEntry.orderId = `PAPER-${Date.now()}`;
    } else {
      console.log(`\n🔴 LIVE ORDER — $${tradeSize.toFixed(2)} BUY ${CONFIG.symbol} × ${vol.leverage}x`);
      try {
        const order = await placeKrakenOrder(CONFIG.symbol, "buy", tradeSize, price, vol.leverage);
        logEntry.orderPlaced = true;
        logEntry.orderId = order.orderId;
        console.log(`✅ ORDER PLACED — ${order.orderId}`);
      } catch (err) {
        console.log(`❌ ORDER FAILED — ${err.message}`);
        logEntry.error = err.message;
        notifyDiscord(
          `⚠️ RISK ALERT\n` +
          `Issue: live BUY order FAILED on ${CONFIG.symbol} @ $${price.toFixed(4)} — ${err.message}`
        );
      }
    }

    if (logEntry.orderPlaced) {
      const stopLoss   = price * (1 - vol.slPct   / 100);
      const takeProfit = price * (1 + vol.tpPct   / 100);
      savePosition({
        open: true, side: "long",
        symbol: CONFIG.symbol,
        entryPrice: price,
        entryTime: logEntry.timestamp,
        quantity: (tradeSize * vol.leverage) / price,
        tradeSize,
        leverage: vol.leverage,
        effectiveSize: tradeSize * vol.leverage,
        orderId: logEntry.orderId,
        stopLoss, takeProfit,
        entrySignalScore: signal.score,
        volatilityLevel: vol.level,
      });
      console.log(`  📌 SL $${stopLoss.toFixed(4)} | TP $${takeProfit.toFixed(4)} | ${vol.leverage}x | score ${signal.score.toFixed(0)}`);
      ctrl.lastTradeTime     = new Date().toISOString();
      ctrl.consecutiveLosses = 0;
      ctrl.updatedAt         = new Date().toISOString();
      saveControl(ctrl);

      notifyDiscord(
        `📈 BUY XRP SIGNAL\n` +
        `Asset: ${CONFIG.symbol}\n` +
        `Price: ${price.toFixed(4)}\n` +
        `Reason: ${describeSignalReason(signal, vol, rsi3)} · score ${signal.score.toFixed(0)}/100 · ${vol.leverage}x${CONFIG.paperTrading ? " · paper" : ""}`
      );
    }
  }

  log.trades.push(logEntry);
  saveLog(log);
  writeTradeCsv(logEntry);
  console.log(`\nDecision log saved → ${LOG_FILE}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

if (process.argv.includes("--tax-summary")) {
  generateTaxSummary();
} else {
  run().catch((err) => {
    console.error("Bot error:", err);
    process.exit(1);
  });
}
