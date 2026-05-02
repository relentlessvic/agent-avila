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
import { readFileSync, writeFileSync, existsSync, appendFileSync, unlinkSync, renameSync, statSync } from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
// Phase D-5.6.1 — Postgres dual-write of bot_control auto-updates.
// Phase D-5.7  — adds trade_events + positions dual-writes via the
// inTransaction helper so a position INSERT and its trade_event INSERT
// commit atomically. All db.js exports below are no-ops when
// DATABASE_URL is unset (dbAvailable() returns false).
import {
  upsertBotControl, dbAvailable, close as dbClose,
  inTransaction, buildEventId, insertTradeEvent,
  upsertPositionOpen, closePosition,
  insertStrategySignal,
  loadOpenPosition as dbLoadOpenPosition,
  countOpenPositions as dbCountOpenPositions,
  countOrphanedPositions as dbCountOrphanedPositions,
  ping as dbPing,
  schemaVersion as dbSchemaVersion,
  updatePositionRiskLevels as dbUpdatePositionRiskLevels,
  recordLiveHaltState as dbRecordLiveHaltState,
  clearLiveHaltState as dbClearLiveHaltState,
  getKrakenPermCheckState as dbGetKrakenPermCheckState,
  recordKrakenPermCheck as dbRecordKrakenPermCheck,
} from "./db.js";

// ─── Phase D-5.2 — DATA_DIR resolver + persistence probe ────────────────────
// Routes every runtime state file through dataPath(...). When DATA_DIR is set
// (e.g. DATA_DIR=/data on a Railway service with a Volume mounted at /data)
// every JSON/CSV state file lives on the persistent mount and survives
// redeploys, restarts, and image rebuilds. When DATA_DIR is unset, paths
// resolve to the current working directory — byte-identical to pre-D-5.2
// behavior, so local dev and any container without a volume keep working
// unchanged. Read-only probe: this phase ships the plumbing only; the
// live-mode persistence gate lands in a later phase.
const DATA_DIR = process.env.DATA_DIR || ".";
const dataPath = (name) => path.join(DATA_DIR, name);
const PERSISTENCE = (() => {
  try {
    if (!existsSync(DATA_DIR)) {
      return { ok: false, dir: DATA_DIR, isVolume: false, reason: "DATA_DIR does not exist" };
    }
    const probe = path.join(DATA_DIR, ".write-probe");
    writeFileSync(probe, String(Date.now()));
    unlinkSync(probe);
    const isVolume = /^\/(data|mnt|var\/data)/.test(DATA_DIR);
    return { ok: true, dir: DATA_DIR, isVolume, reason: null };
  } catch (e) {
    return { ok: false, dir: DATA_DIR, isVolume: false, reason: e.message };
  }
})();

// ─── Atomic state-file write ──────────────────────────────────────────────────
// Write to a per-process tmp file then rename into place. POSIX rename is
// atomic within the same filesystem, so a SIGKILL or container restart
// mid-write either leaves the original file fully intact (rename never ran)
// or fully replaced (rename completed). No truncation window.
function atomicWrite(file, content) {
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, content);
  renameSync(tmp, file);
}

// ─── Single-instance lock ─────────────────────────────────────────────────────
// Prevents duplicate bot.js processes from running concurrently. Three
// triggers can spawn this script (Railway cron, dashboard embedded runner,
// /api/run-bot endpoint); without a lock they could double-execute trades.
const LOCK_FILE = dataPath(".bot.lock");

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

// ─── Log dedup (cuts repeat-skip spam in Railway logs) ───────────────────────
// File-backed because bot.js is a fresh process every 5 min — an in-memory
// cache would reset every cycle and never actually dedup across cycles.
// Keyed on failing-condition signature; suppresses the verbose score block
// when nothing has changed for cooldownMs. Trades and new skip reasons always
// log in full. Strategy logic is untouched — this only affects what we print.
const LOG_STATE_FILE = dataPath(".bot-log-state.json");
function loadLogState() {
  if (!existsSync(LOG_STATE_FILE)) return {};
  try { return JSON.parse(readFileSync(LOG_STATE_FILE, "utf8")); } catch { return {}; }
}
function saveLogState(state) {
  try { atomicWrite(LOG_STATE_FILE, JSON.stringify(state)); } catch {}
}
function shouldLog(key, cooldownMs = 2 * 60 * 1000) {
  const state = loadLogState();
  const now = Date.now();
  const last = state[key] || 0;
  if (now - last < cooldownMs) return false;
  state[key] = now;
  saveLogState(state);
  return true;
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

const LOG_FILE          = dataPath("safety-check-log.json");
const CONTROL_FILE      = dataPath("bot-control.json");
const PERF_STATE_FILE   = dataPath("performance-state.json");
const CAPITAL_FILE      = dataPath("capital-state.json");
const PORTFOLIO_FILE    = dataPath("portfolio-state.json");

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
  atomicWrite(PORTFOLIO_FILE, JSON.stringify(state, null, 2));
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
  atomicWrite(PERF_STATE_FILE, JSON.stringify(perf, null, 2));
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
    atomicWrite(CONTROL_FILE, JSON.stringify(DEFAULT_CONTROL, null, 2));
    return { ...DEFAULT_CONTROL };
  }
  try { return JSON.parse(readFileSync(CONTROL_FILE, "utf8")); }
  catch { return { ...DEFAULT_CONTROL }; }
}

// Phase D-5.6.1 — track in-flight Postgres dual-writes from saveControl()
// so the process-exit handler can drain them before closing the pg pool.
// bot.js is a 5-min cron one-shot; without an explicit drain a fire-and-
// forget DB call could be cut mid-flight when the process exits naturally.
const _pendingDbWrites = [];

// Override CONFIG with any values set via control file
function saveControl(ctrl) {
  atomicWrite(CONTROL_FILE, JSON.stringify(ctrl, null, 2));
  // Phase D-5.6.1 — shadow-write to Postgres bot_control. Fire-and-forget
  // with internal try/catch (via .catch) so a DB outage cannot break paper
  // mode — the JSON write above is the source of truth in this phase. On
  // success the dashboard's loadControl() (D-5.6) sees the fresh DB row on
  // its next 30s refresh cycle, which closes the JSON-newer-than-DB
  // reconciliation window for bot-driven auto-updates (consecutiveLosses,
  // lastTradeTime, paused, killed, etc.).
  if (dbAvailable()) {
    const p = upsertBotControl(ctrl).catch((e) => {
      console.warn(`[d-5.6.1 dual-write] bot_control DB sync failed: ${e.message}`);
    });
    _pendingDbWrites.push(p);
  }
}

// Phase D-5.6.1 — drain in-flight dual-writes at process exit so the bot
// cycle finishes cleanly without leaving open Postgres connections or
// abandoning a write mid-flight. Hard 5-second budget so a stuck DB
// cannot wedge the cron-driven exit. D-5.7 reuses the same queue.
async function drainDbWritesAndClose() {
  if (_pendingDbWrites.length > 0) {
    const all = Promise.allSettled(_pendingDbWrites);
    const timeout = new Promise((resolve) => setTimeout(() => resolve("timeout"), 5000));
    const result = await Promise.race([all, timeout]);
    if (result === "timeout") {
      console.warn(`[d-5.6.1 drain] ${_pendingDbWrites.length} pending DB writes timed out — abandoning`);
    }
    _pendingDbWrites.length = 0;
  }
  try { await dbClose(); } catch {}
}

// ─── Phase D-5.7 — trade_events + positions dual-write helpers ─────────────
// Three fire-and-forget shadow writers wired into bot.js's BUY/EXIT/REENTRY/
// failed-attempt paths AFTER the existing JSON/CSV writes. Each writer
// wraps related INSERT/UPDATE statements in a single Postgres transaction
// so a partial-write rolls back. Failure logs a [d-5.7 dual-write] warn
// line; paper trading continues unimpaired because JSON is authoritative.
//
// All three are no-ops when DATABASE_URL is unset.

function _modeFromConfig() { return CONFIG.paperTrading ? "paper" : "live"; }

// BUY: insert the open position + the buy_filled trade_event in one tx.
// Used for signal-driven auto BUYs (event_type='buy_filled'), MANUAL_BUY
// (event_type='manual_buy'), and REENTRY new BUYs (event_type='reentry_buy').
function shadowRecordBuy(entry, vol, signal) {
  if (!dbAvailable()) return;
  if (!entry || !entry.orderPlaced || !entry.orderId) return; // failed paths use shadowRecordFailedAttempt
  const mode = _modeFromConfig();
  const eventType = entry.type === "MANUAL_BUY" ? "manual_buy"
                  : entry.type === "BUY_REENTRY" ? "reentry_buy"
                  : "buy_filled";
  const tradeSize = Number(entry.tradeSize);
  const leverage = vol?.leverage ?? 1;
  const stopLoss = entry.price * (1 - (vol?.slPct ?? 1.25) / 100);
  const takeProfit = entry.price * (1 + (vol?.tpPct ?? 2.0) / 100);

  const p = inTransaction(async (client) => {
    const positionId = await upsertPositionOpen(client, {
      mode,
      symbol: entry.symbol,
      side: "long",
      entry_price: entry.price,
      entry_time: entry.timestamp,
      entry_signal_score: signal?.score ?? null,
      quantity: (tradeSize * leverage) / entry.price,
      trade_size_usd: tradeSize,
      leverage,
      effective_size_usd: tradeSize * leverage,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      volatility_level: vol?.level ?? null,
      kraken_order_id: entry.orderId,
      metadata: { from: "bot.js", filledPrice: entry.filledPrice ?? null, filledVolume: entry.filledVolume ?? null },
    });
    await insertTradeEvent(client, {
      event_id: buildEventId(entry.orderId, eventType),
      timestamp: entry.timestamp,
      mode,
      event_type: eventType,
      symbol: entry.symbol,
      position_id: positionId,
      price: entry.price,
      quantity: (tradeSize * leverage) / entry.price,
      usd_amount: tradeSize,
      signal_score: signal?.score ?? entry.signalScore ?? null,
      signal_threshold: signal?.threshold ?? null,
      regime: vol?.regime ?? vol?.level ?? null,
      leverage,
      kraken_order_id: entry.orderId,
      decision_log: entry.decisionLog ?? null,
      metadata: {},
    });
  }).catch((e) => {
    console.warn(`[d-5.7 dual-write] BUY DB write failed: ${e.message}`);
  });
  _pendingDbWrites.push(p);
}

// EXIT: close the open position + insert the exit trade_event in one tx.
// Used for SL/TP closes (event_type='exit_filled'), MANUAL_CLOSE
// (event_type='manual_close'), and REENTRY closes (event_type='reentry_close').
function shadowRecordExit(exitEntry) {
  if (!dbAvailable()) return;
  if (!exitEntry || !exitEntry.orderPlaced) return; // failed paths use shadowRecordFailedAttempt
  const mode = _modeFromConfig();
  const eventType = exitEntry.exitReason === "MANUAL_CLOSE" ? "manual_close"
                  : exitEntry.exitReason === "REENTRY_SIGNAL" ? "reentry_close"
                  : "exit_filled";
  const orderId = exitEntry.orderId;
  // Seed the event_id with the orderId when available; fall back to a
  // timestamp+symbol seed so historical entries that lack orderId still
  // generate stable UUIDs.
  const seed = orderId || `${exitEntry.timestamp}:${exitEntry.symbol}:exit`;

  const p = inTransaction(async (client) => {
    const positionId = await closePosition(client, mode, {
      exit_price: exitEntry.price,
      exit_time: exitEntry.timestamp,
      exit_reason: exitEntry.exitReason ?? null,
      realized_pnl_usd: exitEntry.pnlUSD != null ? parseFloat(exitEntry.pnlUSD) : null,
      realized_pnl_pct: exitEntry.pct != null ? parseFloat(exitEntry.pct) : null,
      kraken_exit_order_id: orderId ?? null,
    });
    await insertTradeEvent(client, {
      event_id: buildEventId(seed, eventType),
      timestamp: exitEntry.timestamp,
      mode,
      event_type: eventType,
      symbol: exitEntry.symbol,
      position_id: positionId,
      price: exitEntry.price,
      quantity: exitEntry.quantity ?? null,
      usd_amount: exitEntry.tradeSize ?? null,
      pnl_usd: exitEntry.pnlUSD != null ? parseFloat(exitEntry.pnlUSD) : null,
      pnl_pct: exitEntry.pct != null ? parseFloat(exitEntry.pct) : null,
      kraken_order_id: orderId ?? null,
      decision_log: exitEntry.decisionLog ?? null,
      metadata: {},
    });
  }).catch((e) => {
    console.warn(`[d-5.7 dual-write] EXIT DB write failed: ${e.message}`);
  });
  _pendingDbWrites.push(p);
}

// FAILED live order attempt (BUY or EXIT). Single trade_event INSERT;
// no position transition because the order didn't actually fill.
function shadowRecordFailedAttempt(failedEntry, attemptType) {
  if (!dbAvailable()) return;
  if (!failedEntry) return;
  const mode = _modeFromConfig();
  const seed = `${failedEntry.timestamp}:${failedEntry.symbol || CONFIG.symbol}:${attemptType}`;
  const p = inTransaction(async (client) => {
    await insertTradeEvent(client, {
      event_id: buildEventId(seed, attemptType),
      timestamp: failedEntry.timestamp,
      mode,
      event_type: attemptType, // 'buy_attempt' or 'exit_attempt'
      symbol: failedEntry.symbol || CONFIG.symbol,
      position_id: null,
      price: failedEntry.price ?? null,
      signal_score: failedEntry.signalScore ?? null,
      regime: failedEntry.volatility?.regime ?? failedEntry.volatility?.level ?? null,
      kraken_order_id: null,
      decision_log: failedEntry.decisionLog ?? null,
      error: failedEntry.error ?? null,
      metadata: {},
    });
  }).catch((e) => {
    console.warn(`[d-5.7 dual-write] failed-attempt DB write failed: ${e.message}`);
  });
  _pendingDbWrites.push(p);
}

// ─── Phase D-5.9.1 — strategy_signals shadow-write ──────────────────────────
// Per-cycle signal evaluation snapshot. Called from run() after evalSignal()
// and after the cycle's logEntry is built, BEFORE the signal.allPass
// decision branch. Captures the EVALUATION (score, threshold, indicators,
// regime) independent of trade outcome — D-5.7's trade_events still cover
// the OUTCOME (filled/failed) when a trade is actually attempted.
//
// Idempotent on retry: ON CONFLICT (mode, cycle_id) DO NOTHING in the
// db.js helper. cycle_id = entry.timestamp (ISO string) is unique per
// run() invocation. Reuses _pendingDbWrites so the D-5.6.1 drain catches
// it on cron exit. JSON safety-check-log.json remains authoritative;
// dashboard reads stay on JSON until D-5.9.6.
function shadowRecordStrategySignal(entry, vol, signal) {
  if (!dbAvailable()) return;
  if (!entry || !entry.timestamp) return;
  const mode = _modeFromConfig();
  const decision        = signal?.allPass ? "BUY" : "SKIP";
  const decisionReason  = signal?.allPass ? null : "score-below-threshold";

  // Per-condition subscore map keyed by condition label, e.g.:
  //   { "EMA(8) Uptrend": 30, "RSI(3) Dip (< 35)": 0, "VWAP …": 20, "Not Overextended": 20 }
  // Resilient to evalSignal returning fewer/renamed conditions.
  const subscores = {};
  if (Array.isArray(signal?.conditions)) {
    for (const c of signal.conditions) {
      if (c && c.label) subscores[c.label] = c.score ?? null;
    }
  }

  const p = insertStrategySignal({
    mode,
    cycle_id: entry.timestamp,
    symbol: entry.symbol || CONFIG.symbol,
    timeframe: entry.timeframe ?? CONFIG.timeframe ?? null,
    cycle_ts: entry.timestamp,
    signal_score: signal?.score ?? entry.signalScore ?? null,
    signal_threshold: signal?.threshold ?? null,
    signal_decision: decision,
    decision_reason: decisionReason,
    all_pass: !!signal?.allPass,
    bullish_bias: signal?.bullishBias ?? null,
    price: entry.price,
    rsi_3: entry.indicators?.rsi3 ?? null,
    rsi_14: null,
    ema_fast: entry.indicators?.ema8 ?? null,
    vwap: entry.indicators?.vwap ?? null,
    atr_14: null,
    regime: vol?.regime ?? null,
    volatility_level: vol?.level ?? null,
    spike_ratio: vol?.spikeRatio != null ? parseFloat(vol.spikeRatio) : null,
    effective_lev: entry.effectiveLeverage ?? vol?.leverage ?? null,
    paper_trading: !!entry.paperTrading,
    subscores,
    conditions: signal?.conditions ?? [],
    gates: {},
    v2_shadow: {},
    decision_log: entry.decisionLog ?? null,
    metadata: {},
  }).catch((e) => {
    console.warn(`[d-5.9.1 dual-write] strategy_signal DB write failed: ${e.message}`);
  });
  _pendingDbWrites.push(p);
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
  atomicWrite(LOG_FILE, JSON.stringify(log, null, 2));
}

// ─── Position Tracking ───────────────────────────────────────────────────────

const POSITION_FILE = dataPath("position.json");

// ─── Phase D-5.10.1 — paper position read flip ──────────────────────────────
// loadPosition() is now async + mode-aware.
//
// Paper mode:
//   - DB available → query positions WHERE mode='paper' AND status='open'.
//     If a row is returned → map it to the legacy position.json shape.
//     If no row → return { open: false } authoritatively (no log-scan rebuild).
//   - DB query throws → log a [d-5.10 paper-read] warn line and fall back to
//     the existing JSON read.
//   - DB unavailable (DATABASE_URL unset) → existing JSON read; log-scan
//     rebuild path in initPosition() preserved for that legacy environment.
//
// Live mode:
//   - Unchanged in this phase. Reads JSON (and the existing log-scan rebuild
//     fallback) exactly as before. Kraken reconciliation lands in D-5.10.3+.
//
// _source is a private discriminator only used by initPosition() to decide
// whether to skip the legacy log-scan rebuild (DB-authoritative empty) or
// preserve it (JSON-fallback path with a missing file). It is stripped
// before the position object propagates to run() so downstream callers
// (and savePosition writes) never see it.
function _dbPosToLegacy(p) {
  if (!p) return null;
  const num = (v) => (v == null ? null : parseFloat(v));
  return {
    open: true,
    side: p.side ?? "long",
    symbol: p.symbol,
    entryPrice: num(p.entry_price),
    entryTime: p.entry_time instanceof Date ? p.entry_time.toISOString() : p.entry_time,
    quantity: num(p.quantity),
    tradeSize: num(p.trade_size_usd),
    leverage: p.leverage,
    effectiveSize: num(p.effective_size_usd),
    orderId: p.kraken_order_id,
    stopLoss: num(p.stop_loss),
    takeProfit: num(p.take_profit),
    entrySignalScore: p.entry_signal_score,
    volatilityLevel: p.volatility_level,
  };
}

function _loadPositionFromJson() {
  if (!existsSync(POSITION_FILE)) return { open: false, _source: "json-missing" };
  try {
    const parsed = JSON.parse(readFileSync(POSITION_FILE, "utf8"));
    return { ...parsed, _source: "json" };
  } catch {
    return { open: false, _source: "json" };
  }
}

async function loadPosition() {
  const mode = CONFIG.paperTrading ? "paper" : "live";
  if (mode === "paper" && dbAvailable()) {
    try {
      const dbPos = await dbLoadOpenPosition("paper");
      if (dbPos) return { ..._dbPosToLegacy(dbPos), _source: "db" };
      return { open: false, _source: "db-empty" };
    } catch (e) {
      console.warn(`[d-5.10 paper-read] DB read failed: ${e.message} — falling back to JSON`);
      return _loadPositionFromJson();
    }
  }
  return _loadPositionFromJson();
}

function savePosition(pos) {
  atomicWrite(POSITION_FILE, JSON.stringify(pos, null, 2));
}

// ─── Phase D-5.10.2 — paper integrity guard + JSON rehydration ──────────────
// _paperConflictGuard runs once per cycle (paper + DB available only).
// Returns { ok, action, reason, detail }:
//   - action='halt'    → multi-open detected; run() early-returns. Defensive
//                        only; the partial unique index makes this state
//                        theoretically impossible.
//   - action='proceed' with reason='orphans-present' → visibility warn; cycle
//                        continues normally (orphans don't block trading).
//   - action='proceed' with reason='guard-skipped'   → count query failed;
//                        continue with existing fallback behavior.
//   - action='proceed' with no reason                → all healthy, silent.
async function _paperConflictGuard() {
  let openCount, orphanCount;
  try {
    [openCount, orphanCount] = await Promise.all([
      dbCountOpenPositions("paper"),
      dbCountOrphanedPositions("paper"),
    ]);
  } catch (e) {
    console.warn(`[d-5.10.2 guard] count query failed: ${e.message} — proceeding under JSON fallback`);
    return { ok: true, action: "proceed", reason: "guard-skipped", detail: e.message };
  }
  if (openCount > 1) {
    console.warn(`[d-5.10.2 halt] paper multi-open detected (count=${openCount}) — refusing to trade this cycle`);
    return { ok: false, action: "halt", reason: "multi-open", detail: { count: openCount } };
  }
  if (orphanCount > 0) {
    console.warn(`[d-5.10.2 guard] paper orphans present (count=${orphanCount}) — visibility only, continuing`);
    return { ok: true, action: "proceed", reason: "orphans-present", detail: { count: orphanCount } };
  }
  return { ok: true, action: "proceed", reason: null, detail: null };
}

// Compare two legacy-shape position objects for semantic equality. Both-closed
// (open=false on both) is equal. Both-open is equal when the discriminating
// fields agree within float tolerance and orderId/symbol/leverage match.
// Returns false on any null/missing input so the caller falls into rewrite.
function _legacyPositionsEqual(a, b) {
  if (!a || !b) return false;
  if (a.open !== b.open) return false;
  if (!a.open) return true;
  const eqNum = (x, y, eps) => Math.abs((x ?? 0) - (y ?? 0)) < eps;
  return (
    a.orderId === b.orderId &&
    a.symbol  === b.symbol  &&
    a.leverage === b.leverage &&
    eqNum(a.entryPrice, b.entryPrice, 1e-6) &&
    eqNum(a.stopLoss,   b.stopLoss,   1e-6) &&
    eqNum(a.takeProfit, b.takeProfit, 1e-6) &&
    eqNum(a.quantity,   b.quantity,   1e-6) &&
    eqNum(a.tradeSize,  b.tradeSize,  1e-4)
  );
}

// _rehydratePositionJson keeps position.json as a write-through cache of the
// DB-authoritative paper position state. Idempotent: skips the write when JSON
// already matches. OrderId mismatch is detected first so the conflict warn
// always fires, even if other fields happen to align.
function _rehydratePositionJson(canonical) {
  let onDisk = null;
  if (existsSync(POSITION_FILE)) {
    try {
      onDisk = JSON.parse(readFileSync(POSITION_FILE, "utf8"));
    } catch (e) {
      console.warn(`[d-5.10.2 json-parse] position.json corrupt — rewriting from DB: ${e.message}`);
      onDisk = null;
    }
  }
  if (canonical.open && onDisk?.open && onDisk.orderId && onDisk.orderId !== canonical.orderId) {
    console.warn(
      `[d-5.10.2 conflict] JSON had stale orderId=${onDisk.orderId}, DB has ${canonical.orderId} — overwriting JSON to match DB`
    );
    savePosition(canonical);
    return;
  }
  if (_legacyPositionsEqual(canonical, onDisk)) return;
  if (canonical.open) {
    console.log(
      `[d-5.10.2 rehydrate] paper open from Postgres: orderId=${canonical.orderId} entry=$${(canonical.entryPrice ?? 0).toFixed(4)}`
    );
  } else {
    console.log(`[d-5.10.2 rehydrate] DB shows no open paper — clearing JSON`);
  }
  savePosition(canonical);
}

// Strip private discriminator keys before propagating the position object to
// the rest of run(). Keeps downstream code (savePosition writes, manual close
// path, signal evaluation) free of internal-only metadata.
function _stripPrivateKeys(p) {
  if (!p || typeof p !== "object") return p;
  const { _source, _halted, _haltReason, ...rest } = p;
  return rest;
}

// ─── Phase D-5.10.3 — live-mode DB preflight gate ──────────────────────────
// Necessary-but-not-sufficient first safety layer for live trading. Runs in
// run() before any market data fetch when CONFIG.paperTrading === false.
// Kraken reconciliation is the next safety layer (D-5.10.4+); this phase only
// validates that the local environment is plausibly safe to attempt a live
// cycle — the umbrella LIVE_TRADING_ARMED arm flag, DATABASE_URL presence,
// Postgres liveness, schema version, and the live positions table's integrity
// (existence, queryable, no impossible multi-open state).
//
// Returns { ok, reason, detail }. Caller (run()) early-returns on ok=false
// with one warn line and one Discord alert. No bot_control mutation; each
// cycle independently re-runs the gates so transient failures self-heal.
//
// Intentionally minimal in this phase: no Kraken probe, no bot_control read/
// write, no pause-or-kill. Those land in later sub-phases when their own
// preconditions are tested in isolation first.

function _liveArmed() {
  const v = (process.env.LIVE_TRADING_ARMED || "").trim().toLowerCase();
  return v === "1" || v === "true";
}

async function _liveDbPreflight() {
  // Gate 1 — arm flag. Operator must explicitly opt in to live cycles.
  if (!_liveArmed()) {
    return { ok: false, reason: "not-armed", detail: "LIVE_TRADING_ARMED env var unset" };
  }
  // Gate 2 — DATABASE_URL present.
  if (!dbAvailable()) {
    return { ok: false, reason: "db-unavailable", detail: "DATABASE_URL not set" };
  }
  // Gate 3 — Postgres reachable.
  const pg = await dbPing();
  if (!pg.ok) {
    return { ok: false, reason: "db-ping-failed", detail: pg.reason || "unknown" };
  }
  // Gate 4 — schema version high enough to support live helpers.
  // Phase D-5.10.5.2 — bumped from >=3 to >=4 (migration 004 adds the
  // bot_control halt-tracking columns used by recordLiveHaltState/
  // clearLiveHaltState in the dedup wrappers).
  // Phase D-5.10.5.4 — bumped from >=4 to >=5 (migration 005 adds the
  // bot_control kraken_perm_check_* columns used by the cached Kraken
  // permission probe).
  const sv = await dbSchemaVersion();
  if (!sv || (sv.version ?? 0) < 5) {
    return { ok: false, reason: "schema-too-old", detail: `version=${sv?.version ?? "null"} required>=5` };
  }
  // Gate 5 — positions table healthy. The query exercises the table, the
  // partial unique index, and the mode='live' filter in one round-trip.
  let openCount;
  try {
    openCount = await dbCountOpenPositions("live");
  } catch (e) {
    return { ok: false, reason: "positions-table-unhealthy", detail: e.message };
  }
  // Gate 6 — defensive multi-open check. The DDL-level partial unique index
  // makes this state impossible; if it ever holds, never trade.
  if (openCount > 1) {
    return { ok: false, reason: "live-multi-open", detail: `count=${openCount}` };
  }
  // Gate 7 — orphan visibility (info only). Non-fatal: if the orphan query
  // fails after Gate 5 passed, swallow silently; the operator-blocking case
  // would need full reconciliation (D-5.10.5).
  try {
    const orphanCount = await dbCountOrphanedPositions("live");
    if (orphanCount > 0) {
      console.warn(`[d-5.10.3 live-orphans] count=${orphanCount} — visibility only, continuing`);
    }
  } catch (_) {}
  // ─── Phase D-5.10.5.5 — mode-cutover protection ────────────────────────
  // Refuse to enter live cycles while paper-side state is still active or
  // dirty. The bot would silently abandon any open paper position after a
  // mode flip (positions table is mode-scoped — flipping to live makes the
  // paper row invisible to loadPosition()), leaving it stale in Postgres
  // forever. Orphans are operator-investigation-required by definition;
  // adding live exposure on top of unresolved paper-side state is unsafe.
  //
  // Both gates are conservative-by-design — they refuse activation rather
  // than auto-resolve. Operator manually closes paper positions and
  // reconciles orphans before live activation.
  // Gate 8 — paper still open. Headline cutover protection.
  let paperOpenCount;
  try {
    paperOpenCount = await dbCountOpenPositions("paper");
  } catch (e) {
    return { ok: false, reason: "paper-table-unhealthy", detail: e.message };
  }
  if (paperOpenCount > 0) {
    return {
      ok: false,
      reason: "paper-still-open",
      detail: `count=${paperOpenCount}`,
    };
  }
  // Gate 9 — paper orphans block live cutover.
  let paperOrphanCount;
  try {
    paperOrphanCount = await dbCountOrphanedPositions("paper");
  } catch (e) {
    return { ok: false, reason: "paper-orphan-query-failed", detail: e.message };
  }
  if (paperOrphanCount > 0) {
    return {
      ok: false,
      reason: "paper-orphans-blocking",
      detail: `count=${paperOrphanCount}`,
    };
  }
  return { ok: true, reason: null, detail: null };
}

// ─── Phase D-5.10.5.2 — live halt Discord dedup + plain-English messages ───
// Operator-facing Discord copy. Style: calm, professional, plain English, no
// developer jargon, one clear action item per message. Each template returns
// the body paragraph; _formatDiscordMessage appends a short technical footer
// for grep / ticket-filing. Console.warn keeps its phase-prefixed log format
// so Railway logs remain greppable.
//
// HALT_TEMPLATES is a pure lookup map. Adding a new halt reason only requires
// adding an entry here and (optionally) updating _phaseFromHaltReason if it
// belongs to a new phase.

const HALT_TEMPLATES = {
  "not-armed": () =>
    "Live mode tried to run but live trading is not armed. " +
    "The bot did not place any live trades. " +
    "To enable live mode, set the LIVE_TRADING_ARMED environment variable. " +
    "To stay on paper, switch the bot back to paper mode.",

  "paper-still-open": (_d) =>
    "Live mode was blocked because paper trading still has an open position. " +
    "The bot did not place any live trades. " +
    "Close or resolve the paper position before trying live mode again.",

  "paper-orphans-blocking": (_d) =>
    "Live mode was blocked because there are unresolved paper-side records that " +
    "still need attention. " +
    "The bot did not place any live trades. " +
    "Review and clean up the paper orphan rows before retrying live mode.",

  "phantom-in-db": (_d) =>
    "The bot's records show an open live position, but Kraken's account is " +
    "currently flat. " +
    "The bot stopped this cycle to avoid trading on a mismatch. " +
    "Please check Kraken directly and reconcile the records manually before " +
    "resuming live mode.",

  "orphan-on-venue": (_d) =>
    "Kraken has an open position that the bot's records don't recognize. " +
    "The bot did not touch the position. " +
    "Please review on Kraken and decide whether to close it or register it " +
    "with the bot before resuming live mode.",

  "orderid-mismatch": (_d) =>
    "The bot's records and Kraken disagree on which order is open. " +
    "The bot stopped this cycle to avoid trading on a mismatch. " +
    "Please check Kraken and reconcile manually before resuming live mode.",

  "side-mismatch": (_d) =>
    "The bot's records and Kraken disagree on whether the position is long " +
    "or short. " +
    "The bot stopped this cycle for safety. " +
    "Please check Kraken and reconcile manually before resuming live mode.",

  "qty-drift": (_d) =>
    "The bot's records and Kraken disagree on the position size by more than " +
    "the safe threshold. " +
    "The bot stopped this cycle for safety. " +
    "Please check Kraken and reconcile the size before resuming live mode.",

  "venue-auth": (_d) =>
    "Kraken rejected the bot's API credentials. " +
    "The bot did not place any live trades. " +
    "Please verify the API key and secret are valid, unexpired, and have " +
    "the right permissions.",

  "kraken-perms-missing": (_d) =>
    "The bot's Kraken API key is missing one or more permissions required " +
    "for live trading. The bot did not place any live trades. " +
    "Please update the key on Kraken to include: Query Funds, Query Open & " +
    "Closed Orders, Modify Orders, and Cancel/Close Orders. " +
    "Withdraw Funds must remain disabled.",

  "venue-rate-limit": (_d) =>
    "Kraken rate-limited the bot's API calls. " +
    "The bot did not place any live trades. " +
    "The next cycle will retry automatically. If this persists for several " +
    "cycles, reduce trading frequency or contact Kraken about your tier.",

  "venue-unreachable": (_d) =>
    "Kraken was unreachable this cycle. " +
    "The bot did not place any live trades. " +
    "This is usually a transient network issue and will retry on the next " +
    "cycle automatically. If it persists, check Kraken's status page or " +
    "your network.",

  "venue-unexpected": (_d) =>
    "Kraken returned an unexpected response. " +
    "The bot did not place any live trades. " +
    "Please check Kraken's status page and the bot's logs for details.",

  "live-multi-open": (_d) =>
    "The bot's records show more than one open live position, which should " +
    "never happen. " +
    "The bot stopped this cycle for safety. " +
    "Please review and resolve manually before resuming live mode.",

  "schema-too-old": (_d) =>
    "The bot's database schema is older than this code version requires. " +
    "The bot did not run live this cycle. " +
    "Please apply the pending database migrations and try again.",

  "db-unavailable": () =>
    "The bot couldn't reach its database. " +
    "The bot did not run live this cycle. " +
    "Please check that the database is up and the connection string is set.",

  "db-ping-failed": (_d) =>
    "The bot reached its database but the health check failed. " +
    "The bot did not run live this cycle. " +
    "This is usually transient; if it persists, check the database service.",

  "positions-table-unhealthy": (_d) =>
    "The bot couldn't read the positions table. " +
    "The bot did not run live this cycle. " +
    "Please check the database for schema or permission problems.",

  "paper-table-unhealthy": (_d) =>
    "The bot couldn't read the paper positions table during the safety check. " +
    "The bot did not run live this cycle. " +
    "Please check the database for schema or permission problems.",

  "paper-orphan-query-failed": (_d) =>
    "The bot couldn't check for paper orphan rows during the safety check. " +
    "The bot did not run live this cycle. " +
    "Please check the database for schema or permission problems.",
};

function _formatDiscordMessage(_phase, reason, detail) {
  const template = HALT_TEMPLATES[reason];
  const body = template
    ? template(detail)
    : "The bot stopped a live cycle for safety. " +
      "The bot did not place any live trades. " +
      "Please check the logs for details.";
  return `${body}\n\nReason: ${reason}\nDetail: ${detail || "n/a"}`;
}

function _formatDiscordCleared(previousReason) {
  return (
    "All previous live mode issues have cleared. " +
    "The bot is operating normally on live mode again.\n\n" +
    `Previous reason: ${previousReason}`
  );
}

// Phase tag derivation from halt reason. Used by _emitLiveHaltAlert to record
// the source phase on bot_control.last_live_halt_phase. Keep in sync with the
// gates in _liveDbPreflight() and reasons in reconcileLivePosition().
function _phaseFromHaltReason(reason) {
  if (!reason) return null;
  if (reason === "kraken-perms-missing") return "d-5.10.5.4";
  if (reason.startsWith("paper-")) return "d-5.10.5.5";
  if (
    reason === "phantom-in-db" ||
    reason === "orphan-on-venue" ||
    reason === "orderid-mismatch" ||
    reason === "side-mismatch" ||
    reason === "qty-drift" ||
    reason.startsWith("venue-")
  ) return "d-5.10.5";
  return "d-5.10.3";
}

// Halt-emit wrapper. Always writes the technical console.warn line (logs are
// the unconditional contract). Then attempts to record the halt state in
// bot_control via dbRecordLiveHaltState; if (reason, detail) is unchanged
// from the prior streak, suppresses the Discord alert. Fails open: if the
// dedup write throws, emits Discord anyway plus a [d-5.10.5.2 dedup-error]
// warn so the operator sees both the original alert and the dedup failure.
//
// Trading halt behavior is independent: caller (run()) early-returns after
// this wrapper resolves regardless of outcome. Discord delivery failures are
// swallowed so the cycle exits cleanly under partial outages.
async function _emitLiveHaltAlert(phase, reason, detail) {
  const detailStr =
    typeof detail === "string" ? detail : detail == null ? "" : JSON.stringify(detail);
  // 1. Console — preserves existing phase-prefixed log format for grep.
  const logTag = phase === "d-5.10.5" ? "d-5.10.5 reconcile" : `${phase} live-preflight`;
  console.warn(`[${logTag}] halt: ${reason} — ${detailStr}`);

  // 2. Dedup decision (fail-open on storage error).
  let shouldAlert = true;
  try {
    const r = await dbRecordLiveHaltState(phase, reason, detailStr);
    shouldAlert = !!r?.shouldAlert;
  } catch (e) {
    console.warn(`[d-5.10.5.2 dedup-error] state record failed: ${e.message}`);
    // shouldAlert stays true — better to alert than miss.
  }

  // 3. Discord — plain-English message + technical footer.
  if (shouldAlert) {
    try {
      await notifyDiscord(_formatDiscordMessage(phase, reason, detailStr));
    } catch (_) {}
  }
}

// Cleared-emit wrapper. Called once per live cycle that proceeds past every
// gate (preflight + reconcile). dbClearLiveHaltState returns shouldAlert=true
// only on the actual transition (prior reason was non-null); subsequent
// cleared cycles silently no-op.
async function _emitLiveHaltCleared() {
  let r;
  try {
    r = await dbClearLiveHaltState();
  } catch (e) {
    console.warn(`[d-5.10.5.2 dedup-error] clear failed: ${e.message}`);
    return;
  }
  if (r?.shouldAlert && r.previousReason) {
    console.log(`[d-5.10.5.2 cleared] previous reason: ${r.previousReason}`);
    try {
      await notifyDiscord(_formatDiscordCleared(r.previousReason));
    } catch (_) {}
  }
}

// On first run, auto-restore any existing open paper trade from the log.
// Phase D-5.10.1 — async because loadPosition() is now async; preserves the
// legacy log-scan rebuild fallback only when the read came from JSON and the
// JSON file was missing (paper-DB-down or live-no-JSON path). When the answer
// came from Postgres (DB-authoritative empty), no rebuild occurs.
// Phase D-5.10.2 — orchestrates _paperConflictGuard (halt-or-proceed) and
// _rehydratePositionJson (write-through cache) for paper mode with DB up.
async function initPosition(log) {
  const mode = CONFIG.paperTrading ? "paper" : "live";
  const dbGuardActive = mode === "paper" && dbAvailable();

  // Step 1: paper integrity guard. Halt the cycle on multi-open; warn on
  // orphans/guard-skipped; proceed silently otherwise.
  if (dbGuardActive) {
    const guard = await _paperConflictGuard();
    if (guard.action === "halt") {
      return { open: false, _halted: true, _haltReason: guard.reason };
    }
  }

  // Step 2: read position (D-5.10.1 — DB-first paper, JSON live).
  const pos = await loadPosition();

  // Step 3: paper JSON rehydration. Only rewrites when the read was DB-
  // authoritative (db / db-empty); the JSON-fallback path leaves position.json
  // untouched so a transient DB error doesn't churn the file.
  if (dbGuardActive && (pos._source === "db" || pos._source === "db-empty")) {
    const canonical = pos.open ? _stripPrivateKeys(pos) : { open: false };
    _rehydratePositionJson(canonical);
  }

  if (pos.open) return _stripPrivateKeys(pos);

  // No open position. Decide whether to run the legacy log-scan rebuild.
  const src = pos._source;
  if (src === "db" || src === "db-empty" || src === "json") {
    // DB-authoritative empty, or JSON-exists-but-empty (open=false). No rebuild.
    return { open: false };
  }
  // src === "json-missing" → preserve original log-scan rebuild path.
  const buys = log.trades.filter(t => t.orderPlaced && t.price);
  if (!buys.length) return { open: false };
  const last = buys[buys.length - 1];
  const rebuilt = {
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
  savePosition(rebuilt);
  console.log(`  ↩️  Restored open position from log — entry $${rebuilt.entryPrice.toFixed(4)}`);
  return rebuilt;
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

  if (updated) {
    savePosition(position);
    // Phase D-5.10.5.3 — dual-write SL changes to Postgres so the DB stays
    // in lock-step with JSON across container restarts. Fire-and-forget;
    // failure logs and JSON remains authoritative.
    //
    // Phase B.2c-bot-preserve-TP — payload narrowed to stop_loss only.
    // manageActiveTrade mutates position.stopLoss only (breakeven + trail);
    // it never modifies position.takeProfit. Writing the in-memory
    // take_profit back here would clobber a manual dashboard TP edit
    // landed between this cycle's loadPosition and this dual-write, which
    // is the race that gates Phase B.2d-dashboard-TP.
    if (dbAvailable() && position.orderId) {
      const mode = _modeFromConfig();
      const p = dbUpdatePositionRiskLevels(mode, position.orderId, {
        stop_loss: position.stopLoss,
      }).catch((e) => {
        console.warn(`[d-5.10.5.3 dual-write] manage-update DB write failed: ${e.message}`);
      });
      _pendingDbWrites.push(p);
    }
  }
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

// ─── Strategy V2 — Shadow Analysis (Phase 1) ────────────────────────────────
// XRP Aggressive High-Probability Strategy. PHASE 1 ONLY: log decisions, never
// place orders. V1 remains the sole entry-decision authority. V2 emits a
// verdict object that gets attached to safety-check-log.json under
// strategyV2 so we can compare V2 setups vs V1 entries over time.
//
// Long-only by design — bearish trends short-circuit to NO_TRADE_SHORT_DEFERRED
// since current Kraken setup is spot-only.

function v2_trend(candles) {
  if (!Array.isArray(candles) || candles.length < 25) return "neutral";
  const closes = candles.map(c => c.close);
  const ema20Now  = calcEMA(closes, 20);
  const ema20Prev = calcEMA(closes.slice(0, -5), 20);
  if (!Number.isFinite(ema20Now) || !Number.isFinite(ema20Prev) || ema20Prev <= 0) return "neutral";
  const slope = (ema20Now - ema20Prev) / ema20Prev;
  const last  = closes[closes.length - 1];
  if (slope >  0.0005 && last > ema20Now) return "bullish";
  if (slope < -0.0005 && last < ema20Now) return "bearish";
  return "neutral";
}

// Find the lowest swing-low (fractal-2) within the last `lookback` confirmed
// candles. A fractal-2 swing low requires 2 lower lows on each side.
function v2_swingLow(candles, lookback = 20) {
  if (!Array.isArray(candles) || candles.length < 5) return null;
  const end   = candles.length - 2;
  const start = Math.max(2, end - lookback);
  let best = null;
  for (let i = start; i < end; i++) {
    const c = candles[i];
    if (c.low < candles[i-1].low && c.low < candles[i-2].low &&
        c.low < candles[i+1].low && c.low < candles[i+2].low) {
      if (!best || c.low < best.low) best = { index: i, low: c.low, time: c.time };
    }
  }
  return best;
}

// Sweep: a candle in the last 3 closed candles whose LOW pierced refLow by
// ≥0.05% AND whose CLOSE returned above refLow (liquidity grabbed, rejected).
function v2_sweep(candles15m, refLow) {
  if (!Array.isArray(candles15m) || candles15m.length < 3) {
    return { detected: false, depthPct: 0, candle: null };
  }
  const last3 = candles15m.slice(-3);
  for (let i = last3.length - 1; i >= 0; i--) {
    const c = last3[i];
    if (c.low < refLow * 0.9995 && c.close > refLow) {
      return {
        detected: true,
        depthPct: ((refLow - c.low) / refLow) * 100,
        candle: { time: c.time, low: c.low, close: c.close },
      };
    }
  }
  return { detected: false, depthPct: 0, candle: null };
}

// BOS: post-sweep, find the highest fractal-2 swing high in 5M candles after
// the sweep, then check if any 5M candle CLOSED above that level.
function v2_bos(candles5m, sweepTime) {
  if (!Array.isArray(candles5m) || sweepTime == null) {
    return { detected: false, level: null, breakoutCandle: null };
  }
  const after = candles5m.filter(c => c.time >= sweepTime);
  if (after.length < 5) return { detected: false, level: null, breakoutCandle: null };
  // Highest fractal-2 swing high in `after` (excluding last 2 unconfirmed)
  const end = after.length - 2;
  let refHigh = null;
  for (let i = 2; i < end; i++) {
    const c = after[i];
    if (c.high > after[i-1].high && c.high > after[i-2].high &&
        c.high > after[i+1].high && c.high > after[i+2].high) {
      if (refHigh === null || c.high > refHigh) refHigh = c.high;
    }
  }
  if (refHigh === null) return { detected: false, level: null, breakoutCandle: null };
  // First candle to close above refHigh = breakout
  for (let i = 0; i < after.length; i++) {
    if (after[i].close > refHigh) {
      return {
        detected: true,
        level: refHigh,
        breakoutCandle: { time: after[i].time, close: after[i].close },
      };
    }
  }
  return { detected: false, level: refHigh, breakoutCandle: null };
}

// Pullback: after BOS breakout, price retraces 50–62% of the BOS leg without
// breaking the structure low; first bullish reaction candle is the trigger.
function v2_pullback(candles5m, bosBreakoutCandle, bosLow) {
  if (!Array.isArray(candles5m) || !bosBreakoutCandle || !Number.isFinite(bosLow)) {
    return { ok: false, retracementPct: null, triggerCandle: null };
  }
  const after = candles5m.filter(c => c.time > bosBreakoutCandle.time);
  if (after.length < 2) return { ok: false, retracementPct: null, triggerCandle: null };
  const range = bosBreakoutCandle.close - bosLow;
  if (range <= 0) return { ok: false, retracementPct: null, triggerCandle: null };
  const target50 = bosBreakoutCandle.close - 0.50 * range;
  const target62 = bosBreakoutCandle.close - 0.62 * range;
  for (let i = 0; i < after.length - 1; i++) {
    const c = after[i];
    if (c.low > bosLow && c.low <= target50 && c.low >= target62) {
      const next = after[i + 1];
      if (next.close > next.open) {
        const retPct = ((bosBreakoutCandle.close - c.low) / range) * 100;
        return {
          ok: true,
          retracementPct: retPct,
          triggerCandle: { time: next.time, close: next.close, open: next.open },
        };
      }
    }
  }
  return { ok: false, retracementPct: null, triggerCandle: null };
}

// Compose a verdict object for one cycle. Pure function — no side effects,
// no orders, no state mutations. Always returns a populated object.
function analyzeStrategyV2(c4h, c15m, c5m) {
  const out = {
    shadow: true,
    trend4h: "neutral",
    trend15m: "neutral",
    trendsAgree: false,
    sweep:    { detected: false, depthPct: 0, candle: null },
    bos:      { detected: false, level: null, breakoutCandle: null },
    pullback: { ok: false, retracementPct: null, triggerCandle: null },
    entryPrice: null, stopLoss: null, tp1: null, tp2: null,
    setupQuality: null,
    decision: "NO_TRADE",
    skipReason: "",
  };

  try {
    out.trend4h  = v2_trend(c4h);
    out.trend15m = v2_trend(c15m);

    // Bearish trend → short setup; deferred until Kraken margin support exists.
    if (out.trend4h === "bearish" || out.trend15m === "bearish") {
      out.decision   = "NO_TRADE_SHORT_DEFERRED";
      out.skipReason = "Bearish trend — short setups deferred until margin support";
      return out;
    }

    out.trendsAgree = (out.trend4h === "bullish" && out.trend15m === "bullish");
    if (!out.trendsAgree) {
      out.skipReason = "4H/15M trends do not both agree on bullish";
      return out;
    }

    const swing = v2_swingLow(c15m, 20);
    if (!swing) { out.skipReason = "No 15M swing low in 20-candle lookback"; return out; }

    out.sweep = v2_sweep(c15m, swing.low);
    if (!out.sweep.detected) { out.skipReason = "No 15M liquidity sweep of recent swing low"; return out; }

    out.bos = v2_bos(c5m, out.sweep.candle.time);
    if (!out.bos.detected) { out.skipReason = "No 5M break of structure after sweep"; return out; }

    // Compute the structure low (lowest 5m low between sweep time and BOS time)
    const bosLow = Math.min(
      ...c5m
        .filter(c => c.time >= out.sweep.candle.time && c.time <= out.bos.breakoutCandle.time)
        .map(c => c.low)
    );
    if (!Number.isFinite(bosLow)) { out.skipReason = "Could not derive structure low"; return out; }

    out.pullback = v2_pullback(c5m, out.bos.breakoutCandle, bosLow);
    if (!out.pullback.ok) { out.skipReason = "No valid pullback into 50–62% retracement zone"; return out; }

    // Entry / SL / TP construction
    const entry = out.pullback.triggerCandle.close;
    const sl    = out.sweep.candle.low * 0.999; // 10 bps below the swept low
    const r     = entry - sl;
    if (r <= 0) { out.skipReason = "Computed SL is at or above entry — invalid"; return out; }

    out.entryPrice = entry;
    out.stopLoss   = sl;
    out.tp1        = entry + r;       // 1 : 1 R
    out.tp2        = entry + 2 * r;   // 1 : 2 R

    // Setup-quality classifier (perfect needs all 4 confluences)
    const sweepDepthOk   = out.sweep.depthPct >= 0.10;
    const bosStrengthOk  = ((out.bos.breakoutCandle.close - out.bos.level) / out.bos.level) * 100 >= 0.15;
    const retInTightZone = out.pullback.retracementPct >= 50 && out.pullback.retracementPct <= 62;
    const rsi5m          = Array.isArray(c5m) ? calcRSI(c5m.map(c => c.close), 14) : null;
    const rsiOk          = Number.isFinite(rsi5m) && rsi5m < 40;
    out.setupQuality     = (sweepDepthOk && bosStrengthOk && retInTightZone && rsiOk) ? "perfect" : "standard";

    out.decision   = "TRADE";   // shadow only — caller MUST NOT act on this in Phase 1
    out.skipReason = null;
  } catch (e) {
    out.decision   = "NO_TRADE";
    out.skipReason = "v2-analysis-error: " + (e?.message || String(e));
  }
  return out;
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

  // Always log full block on TRADE; dedup repeat-skip blocks by failing-condition signature
  const failingKey = conditions.filter(c => !c.pass).map(c => c.label).join("|") || "ALL_PASS";
  const skipSig    = `signal-skip:${failingKey}:${Math.round(score / 5) * 5}`;
  const showFull   = allPass || shouldLog(skipSig);

  if (showFull) {
    console.log("\n── Signal Score ─────────────────────────────────────────\n");
    console.log(`  Bias: ${bullishBias ? "BULLISH" : "NEUTRAL/BEARISH"}`);
    conditions.forEach(c => console.log(`  ${c.pass ? "✅" : "🔲"} ${c.label}: ${c.actual} (+${c.score.toFixed(0)}pts)`));
    console.log(`  Total: ${score.toFixed(0)}/100 ${allPass ? `→ ✅ TRADE (≥${threshold})` : `→ 🚫 SKIP (<${threshold})`}`);
  } else {
    console.log(`  🔲 SKIP — same conditions (${failingKey || "—"}) score ${score.toFixed(0)}/100 — waiting`);
  }

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

// Phase D-5.10.4 — inverse of mapToKrakenPair. Kraken's private endpoints
// (OpenPositions, Trades) often return canonical pair names with X/Z
// prefixes (e.g. "XXRPZUSD"), while AddOrder accepts the short form
// ("XRPUSD"). Handle both response shapes; unknown pairs pass through.
function _krakenPairToSymbol(pair) {
  if (!pair) return null;
  const map = {
    XBTUSD:   "BTCUSDT", XXBTZUSD: "BTCUSDT",
    ETHUSD:   "ETHUSDT", XETHZUSD: "ETHUSDT",
    SOLUSD:   "SOLUSDT", SOLZUSD:  "SOLUSDT",
    ADAUSD:   "ADAUSDT", ADAZUSD:  "ADAUSDT",
    XRPUSD:   "XRPUSDT", XXRPZUSD: "XRPUSDT",
    XDGUSD:   "DOGEUSDT", XXDGZUSD: "DOGEUSDT",
    XLTCUSD:  "LTCUSDT", XLTCZUSD: "LTCUSDT",
    LINKUSD:  "LINKUSDT", LINKZUSD: "LINKUSDT",
    DOTUSD:   "DOTUSDT",
    AVAXUSD:  "AVAXUSDT",
    MATICUSD: "MATICUSDT",
    BNBUSD:   "BNBUSDT",
  };
  return map[pair] || pair;
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

// Poll Kraken QueryOrders for a given txid. Returns { status, filledVolume,
// filledPrice }. Market orders settle within tens-of-ms but network +
// matching-engine latency can leave them "open" for ~1s. We wait briefly and
// re-check once. Throws only on transport/auth failure — an "open" or
// "canceled" status returns normally so the caller can decide.
async function queryKrakenOrder(orderId) {
  const tryOnce = async () => {
    const nonce = Date.now().toString();
    const path = "/0/private/QueryOrders";
    const postData = new URLSearchParams({ nonce, txid: orderId }).toString();
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
    if (data.error?.length) throw new Error(`QueryOrders: ${data.error.join(", ")}`);
    const ord = data.result?.[orderId];
    if (!ord) throw new Error(`QueryOrders: txid ${orderId} not in response`);
    return {
      status: ord.status,                              // pending / open / closed / canceled / expired
      filledVolume: parseFloat(ord.vol_exec || "0"),
      filledPrice:  parseFloat(ord.price    || "0"),   // weighted-avg fill price for closed orders
    };
  };
  let r;
  try { r = await tryOnce(); }
  catch (e) { return { status: "unknown", filledVolume: 0, filledPrice: 0, error: e.message }; }
  // If still settling, wait 1.2s and re-check once
  if (r.status === "pending" || r.status === "open") {
    await new Promise(res => setTimeout(res, 1200));
    try { r = await tryOnce(); }
    catch (e) { return { status: "unknown", filledVolume: 0, filledPrice: 0, error: e.message }; }
  }
  return r;
}

async function placeKrakenOrder(symbol, side, sizeUSD, price, leverage = 1) {
  const krakenPair = mapToKrakenPair(symbol);
  const volume = (sizeUSD / price).toFixed(8);
  const requestedVolume = parseFloat(volume);
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

  const orderId = data.result.txid[0];

  // Confirm the order actually filled. Kraken accepting an order is NOT the
  // same as Kraken filling it — partial fills, post-only rejects, and
  // accepted-then-canceled orders all return a txid here.
  const fill = await queryKrakenOrder(orderId);
  const fullyFilled = fill.status === "closed" && fill.filledVolume >= requestedVolume * 0.99;
  if (!fullyFilled) {
    const detail = `status=${fill.status} filled=${fill.filledVolume}/${requestedVolume}` +
                   (fill.error ? ` (${fill.error})` : "");
    throw new Error(`Kraken order not confirmed filled — ${detail}`);
  }

  return {
    orderId,
    requestedVolume,
    filledVolume: fill.filledVolume,
    filledPrice: fill.filledPrice,
  };
}

// ─── Phase D-5.10.4 — read-only Kraken venue state fetcher ──────────────────
// Signed POST to /0/private/OpenPositions. Read-only: no AddOrder, no
// CancelOrder, no CancelAll, no SetLeverage. Used by run() in live mode
// (after the D-5.10.3 preflight passes) for observation only; D-5.10.5+
// will consume this output for reconciliation against Postgres positions.
//
// Never throws. Returns one of three shapes:
//   - null                                — venue confirms flat for this symbol
//   - { found: true,  state:'open',  ... }  — venue has a margin position; full normalized fields
//   - { found: false, state:'error', error:{ kind, message } }
//                                          — fetch failed (auth/rate-limit/unreachable/unexpected)
//
// Multiple position fragments for the same symbol+side are aggregated:
// totalQty is summed, entryPrice is volume-weighted average, multiple=true.
// Conflicting sides (long+short same symbol) returns 'unexpected' error.
async function fetchKrakenOpenPosition(symbol) {
  const targetPair = mapToKrakenPair(symbol);

  let res, data;
  try {
    const nonce = Date.now().toString();
    const path = "/0/private/OpenPositions";
    const postData = new URLSearchParams({ nonce, docalcs: "true" }).toString();
    const signature = signKraken(path, nonce, postData);
    res = await fetch(`${CONFIG.kraken.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "API-Key": CONFIG.kraken.apiKey,
        "API-Sign": signature,
      },
      body: postData,
    });
  } catch (e) {
    return { found: false, state: "error", error: { kind: "unreachable", message: e.message } };
  }

  if (!res.ok) {
    let kind = "unexpected";
    if (res.status === 401 || res.status === 403) kind = "auth";
    else if (res.status >= 500) kind = "unreachable";
    return { found: false, state: "error", error: { kind, message: `HTTP ${res.status}` } };
  }

  try {
    data = await res.json();
  } catch (_) {
    return { found: false, state: "error", error: { kind: "unexpected", message: "non-JSON response" } };
  }

  if (Array.isArray(data?.error) && data.error.length > 0) {
    const errStr = data.error.join(", ");
    let kind = "unexpected";
    if (/Invalid (key|signature|permissions|nonce)/i.test(errStr)) kind = "auth";
    else if (/Rate limit/i.test(errStr)) kind = "rate-limit";
    return { found: false, state: "error", error: { kind, message: errStr } };
  }

  if (!data || typeof data.result !== "object" || data.result === null) {
    return { found: false, state: "error", error: { kind: "unexpected", message: "missing result field" } };
  }

  const result = data.result;
  const positionIds = Object.keys(result);
  if (positionIds.length === 0) return null;

  // Filter to fragments matching the target symbol (handles canonical X/Z-prefixed
  // pair names AND short-form pair names; unknown pairs pass through unchanged).
  const matching = positionIds.filter(id => {
    const p = result[id];
    if (!p?.pair) return false;
    return _krakenPairToSymbol(p.pair) === symbol || p.pair === targetPair;
  });

  if (matching.length === 0) {
    // Operator has positions in non-target pairs. Visibility-only info hint.
    console.log(`[d-5.10.4 venue-other] ${positionIds.length} positions in non-target pairs`);
    return null;
  }

  let totalQty = 0;
  let totalCost = 0;
  let totalNet = 0;
  const sides = new Set();
  const orderTxIds = [];
  let krakenPair = null;
  let leverage = null;

  for (const id of matching) {
    const p = result[id];
    const vol = parseFloat(p.vol || "0");
    const volClosed = parseFloat(p.vol_closed || "0");
    const openVol = vol - volClosed;
    if (!Number.isFinite(openVol) || openVol <= 0) continue;
    const fragCost = vol > 0 ? parseFloat(p.cost || "0") * (openVol / vol) : 0;
    totalQty  += openVol;
    totalCost += fragCost;
    totalNet  += parseFloat(p.net || "0");
    sides.add(p.type === "buy" ? "long" : "short");
    krakenPair = krakenPair || p.pair;
    if (leverage === null) {
      const lev = (p.leverage || "").split(":")[0];
      const parsed = parseFloat(lev);
      if (Number.isFinite(parsed)) leverage = parsed;
    }
    if (p.ordertxid) orderTxIds.push(p.ordertxid);
  }

  if (sides.size > 1) {
    return { found: false, state: "error", error: { kind: "unexpected", message: "conflicting sides for symbol" } };
  }
  if (totalQty <= 0) return null;

  return {
    found:           true,
    state:           "open",
    side:            [...sides][0],
    symbol,
    krakenPair,
    quantity:        totalQty,
    entryPrice:      totalCost / totalQty,
    costUSD:         totalCost,
    positionIds:     matching,
    orderTxIds,
    leverage,
    unrealizedPnLUSD: totalNet,
    multiple:        matching.length > 1,
    raw:             result,
  };
}

// One-line dispatch over the three return shapes from fetchKrakenOpenPosition.
// Observation-only: no halt, no Discord, no decision gate. Consumed by D-5.10.5+
// reconciliation in a later phase.
function _logVenueObservation(venue) {
  if (venue === null) {
    console.log(`[d-5.10.4 venue] flat (no Kraken margin position for ${CONFIG.symbol})`);
    return;
  }
  if (venue.found) {
    const ep  = venue.entryPrice != null ? `$${venue.entryPrice.toFixed(5)}` : "?";
    const ids = (venue.positionIds || []).join(",");
    const tag = venue.multiple ? " (multi-fragment)" : "";
    console.log(
      `[d-5.10.4 venue] open: side=${venue.side} qty=${(venue.quantity ?? 0).toFixed(6)} entry=${ep} positionIds=[${ids}]${tag}`
    );
    return;
  }
  console.warn(`[d-5.10.4 venue-error] kind=${venue.error?.kind} message=${venue.error?.message}`);
}

// ─── Phase D-5.10.5.4 — Kraken API key permission probe ────────────────────
// Signed POST to /0/private/AddOrder with validate=true. Confirms the live
// API key has Modify Orders permission BEFORE the trade-decision branch can
// reach a real placeKrakenOrder call. Without this probe, a read-only key
// would pass D-5.10.3-5 entirely and fail mid-cycle on the first AddOrder.
//
// SAFETY GUARANTEES (audited at every commit via grep):
//   - validate is HARD-CODED to "true" — the order is server-validated only,
//     NEVER placed. Cannot be derived from variables, configurable, or
//     conditional.
//   - volume is HARD-CODED to "0.00000001" (1e-8). Even if validate=true
//     somehow leaked server-side, this size is below Kraken's minimum order
//     size (XRPUSD min ~0.5 XRP) and would be rejected before matching.
//     Two-layer defense.
//   - This function is dedicated and isolated. It does NOT share its request
//     body builder with placeKrakenOrder; cannot be confused or accidentally
//     reused in the order-placement code path.
//
// Returns one of:
//   - { ok: true,  reason: null,                   detail: null }
//   - { ok: false, reason: "venue-auth",           detail: "<msg>" }
//   - { ok: false, reason: "kraken-perms-missing", detail: "<msg>" }
//   - { ok: false, reason: "venue-rate-limit",     detail: "<msg>" }
//   - { ok: false, reason: "venue-unreachable",    detail: "<msg>" }
//   - { ok: false, reason: "venue-unexpected",     detail: "<msg>" }
//
// Whitelisted as PASS: any EOrder:* error response (insufficient funds,
// order minimum not met, trading agreement required, etc.). These confirm
// the auth path worked; downstream order issues are not the probe's concern.
async function probeKrakenPermissions() {
  let res, data;
  try {
    const nonce = Date.now().toString();
    const path = "/0/private/AddOrder";
    // SAFETY: hard-coded validate="true" + volume="0.00000001". Never derived.
    const probeBody = {
      nonce,
      pair:      mapToKrakenPair(CONFIG.symbol),
      type:      "buy",
      ordertype: "market",
      volume:    "0.00000001",
      validate:  "true",
    };
    const postData = new URLSearchParams(probeBody).toString();
    const signature = signKraken(path, nonce, postData);
    res = await fetch(`${CONFIG.kraken.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "API-Key": CONFIG.kraken.apiKey,
        "API-Sign": signature,
      },
      body: postData,
    });
  } catch (e) {
    return { ok: false, reason: "venue-unreachable", detail: e.message };
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "venue-auth", detail: `HTTP ${res.status}` };
    }
    if (res.status >= 500) {
      return { ok: false, reason: "venue-unreachable", detail: `HTTP ${res.status}` };
    }
    return { ok: false, reason: "venue-unexpected", detail: `HTTP ${res.status}` };
  }

  try {
    data = await res.json();
  } catch (_) {
    return { ok: false, reason: "venue-unexpected", detail: "non-JSON response" };
  }

  // Kraken puts errors in data.error array. Empty array = success.
  if (Array.isArray(data?.error) && data.error.length > 0) {
    const errStr = data.error.join(", ");
    // Whitelist: EOrder:* errors confirm the auth path worked. The order
    // itself wouldn't have placed for downstream reasons (size, funds,
    // trading-agreement) — but those are not the probe's concern.
    if (/^EOrder:/.test(errStr) || data.error.every((e) => /^EOrder:/.test(e))) {
      return { ok: true, reason: null, detail: null };
    }
    if (/Permission denied/i.test(errStr)) {
      return { ok: false, reason: "kraken-perms-missing", detail: errStr };
    }
    if (/Invalid (key|signature|nonce|permissions)/i.test(errStr)) {
      return { ok: false, reason: "venue-auth", detail: errStr };
    }
    if (/Rate limit/i.test(errStr)) {
      return { ok: false, reason: "venue-rate-limit", detail: errStr };
    }
    return { ok: false, reason: "venue-unexpected", detail: errStr };
  }

  if (!data || typeof data.result !== "object" || data.result === null) {
    return { ok: false, reason: "venue-unexpected", detail: "missing result field" };
  }

  // result.descr or result.txid present → server validated successfully.
  return { ok: true, reason: null, detail: null };
}

// ─── Phase D-5.10.5 — live reconciliation logic ─────────────────────────────
// Pure function: diffs the Postgres "live open position" row (from D-5.8
// loadOpenPosition('live')) against the Kraken venue read (from D-5.10.4
// fetchKrakenOpenPosition). Returns { aligned, reason, detail } — no I/O,
// no console, no Discord, no DB writes. The orchestration layer (run())
// owns the halt-on-mismatch behavior + alert emission.
//
// Mismatch reasons (one per matrix row):
//   - orphan-on-venue   — DB flat, Kraken has a position
//   - phantom-in-db     — DB has a position, Kraken flat
//   - orderid-mismatch  — both open, dbPos.kraken_order_id ∉ venue.orderTxIds
//   - side-mismatch     — both open, dbPos.side !== venue.side
//   - qty-drift         — both open, |dbQty - venueQty| / dbQty > tolerance
//   - venue-auth        — Kraken fetch returned auth error
//   - venue-rate-limit  — Kraken fetch returned rate-limit error
//   - venue-unreachable — Kraken fetch threw / 5xx / DNS / timeout
//   - venue-unexpected  — Kraken fetch returned malformed/unknown shape
//
// Never auto-resolves. Caller (run()) halts the cycle on any non-aligned
// outcome; operator inspects every mismatch.
const RECONCILE_QTY_TOLERANCE = 0.01; // 1% relative drift before halt

function reconcileLivePosition(dbPos, venueResult) {
  // Venue fetch failed → halt with a kind-specific reason. Independent of
  // dbPos because we cannot trust either side's view when the read errored.
  if (venueResult && venueResult.found === false) {
    const k = venueResult.error?.kind;
    let reason = "venue-unexpected";
    if (k === "auth")             reason = "venue-auth";
    else if (k === "rate-limit")  reason = "venue-rate-limit";
    else if (k === "unreachable") reason = "venue-unreachable";
    return {
      aligned: false,
      reason,
      detail: venueResult.error?.message ?? "unknown",
    };
  }

  const venueOpen = !!(venueResult && venueResult.found === true);

  // Both flat → aligned.
  if (!dbPos && !venueOpen) {
    return { aligned: true, reason: null, detail: null };
  }

  // DB flat, venue open.
  if (!dbPos && venueOpen) {
    const ids = (venueResult.orderTxIds || []).join(",");
    return {
      aligned: false,
      reason:  "orphan-on-venue",
      detail:  `qty=${venueResult.quantity} orderTxIds=[${ids}]`,
    };
  }

  // DB open, venue flat.
  if (dbPos && !venueOpen) {
    return {
      aligned: false,
      reason:  "phantom-in-db",
      detail:  `dbOrderId=${dbPos.kraken_order_id ?? "null"} qty=${dbPos.quantity ?? "null"}`,
    };
  }

  // Both open — diff fields. Order checked: orderId membership → side → qty.
  // (orderId mismatch is the most diagnostic; qty drift is the most permissive.)
  const dbOrderId       = dbPos.kraken_order_id;
  const venueOrderTxIds = venueResult.orderTxIds || [];
  if (dbOrderId && venueOrderTxIds.length > 0 && !venueOrderTxIds.includes(dbOrderId)) {
    return {
      aligned: false,
      reason:  "orderid-mismatch",
      detail:  `dbOrderId=${dbOrderId} venueOrderTxIds=[${venueOrderTxIds.join(",")}]`,
    };
  }
  if (dbPos.side && venueResult.side && dbPos.side !== venueResult.side) {
    return {
      aligned: false,
      reason:  "side-mismatch",
      detail:  `dbSide=${dbPos.side} venueSide=${venueResult.side}`,
    };
  }
  const dbQty    = dbPos.quantity != null ? parseFloat(dbPos.quantity) : null;
  const venueQty = venueResult.quantity != null ? Number(venueResult.quantity) : null;
  if (Number.isFinite(dbQty) && Number.isFinite(venueQty) && dbQty > 0) {
    const drift = Math.abs(dbQty - venueQty) / dbQty;
    if (drift > RECONCILE_QTY_TOLERANCE) {
      return {
        aligned: false,
        reason:  "qty-drift",
        detail:  `db=${dbQty} venue=${venueQty} drift=${(drift * 100).toFixed(2)}%`,
      };
    }
  }
  return { aligned: true, reason: null, detail: null };
}

// ─── Tax CSV Logging ─────────────────────────────────────────────────────────

const CSV_FILE = dataPath("trades.csv");

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
  // Phase D-5.2 — persistence boot banner. Emits one block at the start of
  // each bot cycle so Railway logs always show which DATA_DIR the cycle is
  // reading/writing against. Read-only diagnostic; no behavior change.
  console.log(`[boot] DATA_DIR=${PERSISTENCE.dir}  persistence=${PERSISTENCE.ok ? "ok" : "FAIL"}  volume=${PERSISTENCE.isVolume ? "yes" : "no/local"}`);
  if (!PERSISTENCE.ok) console.error(`[boot] persistence FAILED: ${PERSISTENCE.reason}`);
  for (const f of [LOG_FILE, POSITION_FILE, CSV_FILE, CONTROL_FILE, PERF_STATE_FILE, PORTFOLIO_FILE, CAPITAL_FILE, LOG_STATE_FILE, LOCK_FILE]) {
    let exists = false, size = 0;
    try { exists = existsSync(f); if (exists) size = statSync(f).size; } catch {}
    console.log(`[boot] ${exists ? "✓" : "·"}  ${path.relative(DATA_DIR, f) || path.basename(f)}  (${size} bytes)`);
  }

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
  const position = await initPosition(log);

  // Phase D-5.10.2 — paper integrity guard halt. The guard runs inside
  // initPosition() and returns a sentinel here when DB invariants are
  // violated (currently only multi-open). No market fetch, no signal eval,
  // no trade — exit cleanly so the D-5.6.1 finally-drain still runs.
  if (position._halted) {
    console.log(`⛔ Cycle skipped — paper integrity guard halted (reason=${position._haltReason})`);
    console.log("═══════════════════════════════════════════════════════════\n");
    return;
  }

  // Phase D-5.10.3 — live-mode DB preflight gate. Runs before any Kraken
  // activity when paperTrading is off. Each halt is per-cycle no-trade; no
  // bot_control mutation; transient failures self-heal on the next cron tick.
  // Production is paperTrading=true, so this block is dormant in prod.
  if (!CONFIG.paperTrading) {
    const pre = await _liveDbPreflight();
    if (!pre.ok) {
      // Phase D-5.10.5.2 — dedup-gated plain-English Discord. Console.warn
      // is emitted by _emitLiveHaltAlert in the original phase-prefixed
      // format for log greppability.
      const detailStr = typeof pre.detail === "string" ? pre.detail : JSON.stringify(pre.detail);
      const phase = _phaseFromHaltReason(pre.reason);
      await _emitLiveHaltAlert(phase, pre.reason, detailStr);
      console.log("═══════════════════════════════════════════════════════════\n");
      return;
    }

    // Phase D-5.10.5.4 — Kraken API key permission probe (cached).
    // Confirms the live key has Modify Orders permission BEFORE the trade-
    // decision branch can reach a real placeKrakenOrder call. Cache lives
    // on bot_control row #1 so the probe runs once per failure-resolution
    // cycle, not on every 5-min tick.
    {
      const cache = await dbGetKrakenPermCheckState();
      let probe;
      if (cache?.ok === true) {
        // Cache hit — trust it; no Kraken call this cycle.
        console.log(`[d-5.10.5.4 probe] cached ok (since ${cache.at instanceof Date ? cache.at.toISOString() : cache.at})`);
        probe = { ok: true };
      } else {
        const why = cache == null ? "empty" : `prior=${cache.ok}`;
        console.log(`[d-5.10.5.4 probe] running (cache=${why})`);
        probe = await probeKrakenPermissions();
        try {
          await dbRecordKrakenPermCheck(probe.ok, probe.reason ?? null, probe.detail ?? null);
        } catch (e) {
          console.warn(`[d-5.10.5.4 cache-write-error] ${e.message}`);
          // Don't block the cycle on a cache write failure — use the in-memory
          // probe result for this cycle. Next cycle will probe again (cache
          // remains empty/stale until DB recovers).
        }
      }
      if (!probe.ok) {
        await _emitLiveHaltAlert("d-5.10.5.4", probe.reason, probe.detail);
        console.log("═══════════════════════════════════════════════════════════\n");
        return;
      }
    }

    // Phase D-5.10.5 — Postgres-vs-Kraken reconciliation. Halts the cycle
    // on any mismatch via per-cycle no-trade. Never auto-resolves: no
    // auto-close, no auto-open, no DB write. Operator inspects every halt.
    // D-5.10.6 will replace the "aligned" fall-through with the actual live
    // activation gate; for now an aligned cycle still falls through to the
    // dormant live JSON read path from D-5.10.1.
    const dbPos = await dbLoadOpenPosition("live");
    const venue = await fetchKrakenOpenPosition(CONFIG.symbol);
    _logVenueObservation(venue);
    const recon = reconcileLivePosition(dbPos, venue);
    if (!recon.aligned) {
      // Phase D-5.10.5.2 — dedup-gated plain-English Discord.
      await _emitLiveHaltAlert("d-5.10.5", recon.reason, recon.detail);
      console.log("═══════════════════════════════════════════════════════════\n");
      return;
    }
    console.log(`[d-5.10.5 reconcile] aligned (${dbPos ? "open" : "flat"})`);
    // Phase D-5.10.5.2 — emit one Discord "all-clear" if the prior streak just
    // ended. Silent on subsequent aligned cycles.
    await _emitLiveHaltCleared();
  }

  // Fetch market data
  console.log("\n── Fetching market data from Kraken ────────────────────\n");
  const candles = await fetchCandles(CONFIG.symbol, CONFIG.timeframe, 500);

  // Candle-count guard — Kraken can return short responses on edge conditions
  // (just-listed pair, partial fetch, low-volume window). Indicators computed
  // on too few candles produce weak/garbage output. Longest indicator lookback
  // we use is 20 (Bollinger Bands); 30 leaves a safety margin.
  if (!Array.isArray(candles) || candles.length < 30) {
    const got = Array.isArray(candles) ? candles.length : "n/a";
    console.log(`\n⚠️  Insufficient candle data from Kraken: got ${got}, need ≥30. Skipping cycle — no trade evaluated.`);
    if (shouldLog("candles-insufficient")) {
      notifyDiscord(
        `⚠️ RISK ALERT\n` +
        `Issue: insufficient candle data on ${CONFIG.symbol} — got ${got}, need ≥30. ` +
        `Skipping cycle; no trade evaluated.`
      );
    }
    return;
  }

  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];

  // Price sanity check — Kraken can return malformed candles (zeros, nulls,
  // stale ticks) during edge conditions. Every downstream check (SL/TP
  // comparison, signal scoring, sizing) silently produces undefined behavior
  // on NaN. Fail closed: skip the cycle, alert once per cooldown window.
  if (!Number.isFinite(price) || price <= 0) {
    console.log(`\n⚠️  Invalid price data from Kraken: ${JSON.stringify(price)}. Skipping cycle — no trade evaluated.`);
    if (shouldLog("price-bad-data")) {
      notifyDiscord(
        `⚠️ RISK ALERT\n` +
        `Issue: bad price data on ${CONFIG.symbol} — got "${JSON.stringify(price)}". ` +
        `Skipping cycle; no trade evaluated.`
      );
    }
    return;
  }

  // ── Strategy V2 — SHADOW analysis (Phase 1: log only, NEVER trades) ──────
  // Runs alongside V1 every cycle. Result is attached to every log entry as
  // `strategyV2` via attachV2() below. V1 logic below is completely unaffected.
  let strategyV2 = null;
  const attachV2 = (entry) => {
    if (entry && typeof entry === "object" && strategyV2) entry.strategyV2 = strategyV2;
    return entry;
  };
  try {
    const c15m = await fetchCandles(CONFIG.symbol, "15m", 100);
    const c4h  = await fetchCandles(CONFIG.symbol, "4H", 80);
    strategyV2 = analyzeStrategyV2(c4h, c15m, candles);
    console.log(
      "\n  📊 [V2-shadow] " +
      "trend4h=" + strategyV2.trend4h + " " +
      "trend15m=" + strategyV2.trend15m + " " +
      "sweep=" + strategyV2.sweep.detected + " " +
      "bos=" + strategyV2.bos.detected + " " +
      "pullback=" + strategyV2.pullback.ok +
      " → " + strategyV2.decision +
      (strategyV2.skipReason ? " (" + strategyV2.skipReason + ")" : "") +
      (strategyV2.setupQuality ? " [" + strategyV2.setupQuality + "]" : "")
    );
  } catch (e) {
    strategyV2 = { shadow: true, decision: "NO_TRADE", skipReason: "v2-fetch-error: " + e.message };
    console.log("  ⚠️  V2 shadow analysis failed: " + e.message);
  }

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
          exitEntry.filledVolume = order.filledVolume;
          exitEntry.filledPrice = order.filledPrice;
          exitEntry.orderPlaced = true;
          console.log(`  ✅ SELL FILLED — ${order.orderId} | ${order.filledVolume.toFixed(6)} @ $${order.filledPrice.toFixed(4)}`);
        } catch (err) {
          console.log(`  ❌ SELL ORDER FAILED — ${err.message}`);
          console.log(`  ⚠️  Position kept OPEN — bot will retry exit on next cycle.`);
          exitEntry.error = err.message;
          notifyDiscord(
            `⚠️ RISK ALERT\n` +
            `Issue: live SELL not confirmed filled on ${CONFIG.symbol} @ $${price.toFixed(4)} — ${err.message}. ` +
            `Position kept OPEN; bot will retry exit next cycle. Reconcile manually if Kraken position differs.`
          );
        }
      }

      // Only flip position to closed and emit the SELL signal if the order actually placed.
      // On live-failure, leave position.open=true so the next cycle retries this exit.
      if (exitEntry.orderPlaced) {
        savePosition({ open: false });
        log.trades.push(attachV2(exitEntry));
        saveLog(log);
        writeTradeCsv(exitEntry);
        // Phase D-5.7 — shadow-write the EXIT to Postgres after JSON/CSV
        // have settled. Fire-and-forget; failure logs warn line.
        shadowRecordExit(exitEntry);

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
        // Live SELL failed. Record the attempt for visibility but DO NOT mark
        // position closed, DO NOT write to trades.csv (no actual trade), DO NOT
        // update cooldown (no trade time advanced), DO NOT fire SELL signal.
        exitEntry.exitReason = `${exit.reason}_FAILED_RETRY_PENDING`;
        log.trades.push(attachV2(exitEntry));
        saveLog(log);
        // Phase D-5.7 — shadow-write the failed exit attempt for audit
        // visibility. position_id stays null; no position transition.
        shadowRecordFailedAttempt(exitEntry, "exit_attempt");
        console.log(`\nDecision log saved → ${LOG_FILE} (exit attempt failed; position retained as OPEN)`);
      }
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
          conditions: [], allPass: false,
          // Paper "trades" always succeed; for live, prove success in the try below.
          orderPlaced: !!CONFIG.paperTrading,
        };
        if (!CONFIG.paperTrading) {
          try {
            const o = await placeKrakenOrder(position.symbol, "sell", position.tradeSize, price);
            reexitEntry.orderId = o.orderId;
            reexitEntry.filledVolume = o.filledVolume;
            reexitEntry.filledPrice = o.filledPrice;
            reexitEntry.orderPlaced = true;
          } catch (err) {
            reexitEntry.error = err.message;
            console.log(`  ❌ REENTRY-SELL FAILED — ${err.message}`);
            console.log(`  ⚠️  Position kept OPEN — re-entry aborted.`);
            notifyDiscord(
              `⚠️ RISK ALERT\n` +
              `Issue: live REENTRY-SELL not confirmed filled on ${CONFIG.symbol} @ $${price.toFixed(4)} — ${err.message}. ` +
              `Position kept OPEN; re-entry aborted. Reconcile manually if Kraken position differs.`
            );
          }
        }

        // Only proceed to close + immediate re-entry if the close actually placed.
        // On failure, leave the existing position open and skip the BUY entirely
        // (otherwise we'd have two open positions on Kraken).
        if (reexitEntry.orderPlaced) {
          savePosition({ open: false });
          log.trades.push(attachV2(reexitEntry));
          saveLog(log);
          writeTradeCsv(reexitEntry);
          // Phase D-5.7 — shadow-write the REENTRY close. event_type
          // resolves to 'reentry_close' via reexitEntry.exitReason='REENTRY_SIGNAL'.
          shadowRecordExit(reexitEntry);

          // Immediately re-enter with new signal
          const vol2 = classifyRegime(candles, ema8);
          if (vol2.level !== "HIGH") {
            const ts2 = calcDynamicTradeSize(log, vol2.slPct);
            const sl2 = price * (1 - vol2.slPct / 100);
            const tp2 = price * (1 + vol2.tpPct / 100);
            let reorderId = CONFIG.paperTrading ? `PAPER-REENTRY-${Date.now()}` : null;
            // Paper auto-fills; live must be confirmed via QueryOrders.
            let buyFilled = !!CONFIG.paperTrading;
            let filledVol = null, filledPx = null;
            if (!CONFIG.paperTrading) {
              try {
                const o = await placeKrakenOrder(position.symbol, "buy", ts2, price, vol2.leverage);
                reorderId = o.orderId;
                buyFilled = true;
                filledVol = o.filledVolume;
                filledPx  = o.filledPrice;
              } catch (err) {
                console.log(`  ❌ Re-entry BUY failed: ${err.message}`);
                console.log(`  ⚠️  Position NOT marked open — re-entry aborted.`);
                notifyDiscord(
                  `⚠️ RISK ALERT\n` +
                  `Issue: live REENTRY-BUY not confirmed filled on ${CONFIG.symbol} @ $${price.toFixed(4)} — ${err.message}. ` +
                  `Position NOT marked open. Reconcile manually if Kraken position differs.`
                );
              }
            }
            // Only mark position open when the BUY is confirmed filled.
            if (buyFilled) {
              savePosition({
                open: true, side: "long", symbol: CONFIG.symbol,
                entryPrice: filledPx || price, entryTime: new Date().toISOString(),
                quantity: (ts2 * vol2.leverage) / price, tradeSize: ts2,
                leverage: vol2.leverage, effectiveSize: ts2 * vol2.leverage,
                orderId: reorderId, stopLoss: sl2, takeProfit: tp2,
                entrySignalScore: newSig.score, volatilityLevel: vol2.level,
                filledVolume: filledVol, filledPrice: filledPx,
              });
              console.log(`  ✅ Re-entered — SL $${sl2.toFixed(4)} | TP $${tp2.toFixed(4)} | score ${newSig.score.toFixed(0)}`);
              // Phase D-5.7 — shadow-write the REENTRY new BUY. The reentry
              // path is the one place where bot.js writes a new position
              // without pushing to safety-check-log; this dual-write makes
              // the new BUY visible in Postgres for the first time. JSON
              // behavior is unchanged.
              shadowRecordBuy({
                timestamp: new Date().toISOString(),
                symbol: CONFIG.symbol,
                price: filledPx || price,
                orderId: reorderId,
                type: "BUY_REENTRY",
                orderPlaced: true,
                tradeSize: ts2,
                filledPrice: filledPx,
                filledVolume: filledVol,
                signalScore: newSig.score,
                decisionLog: null,
              }, vol2, { score: newSig.score });
            }
          }
        } else {
          // Failed live close — record attempt for visibility, no csv, position retained.
          reexitEntry.exitReason = "REENTRY_SIGNAL_FAILED_RETRY_PENDING";
          log.trades.push(attachV2(reexitEntry));
          saveLog(log);
          // Phase D-5.7 — shadow-write the failed reentry close attempt.
          shadowRecordFailedAttempt(reexitEntry, "exit_attempt");
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
        log.trades.push(attachV2(holdEntry));
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
    if (shouldLog("cooldown-skip")) {
      console.log(`\n⏳ Cooldown active — ${cooldown.remaining.toFixed(1)} min remaining. Skipping entry.`);
      console.log("═══════════════════════════════════════════════════════════\n");
    }
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
    if (shouldLog("daily-limit-skip")) {
      console.log("\nBot stopping — trade limits reached for today.");
    }
    const limitEntry = {
      timestamp: new Date().toISOString(), symbol: CONFIG.symbol, timeframe: CONFIG.timeframe, price,
      indicators: { ema8, vwap, rsi3 },
      conditions: [{ label: "Daily trade limit", required: `< ${CONFIG.maxTradesPerDay}`, actual: `${countTodaysTrades(log)}/${CONFIG.maxTradesPerDay}`, pass: false }],
      allPass: false, orderPlaced: false, paperTrading: CONFIG.paperTrading,
      decisionLog: `⛔ DAILY LIMIT REACHED | Trades today: ${countTodaysTrades(log)}/${CONFIG.maxTradesPerDay} | Resets at midnight UTC`,
    };
    log.trades.push(attachV2(limitEntry));
    saveLog(log);
    writeTradeCsv(limitEntry);
    return;
  }

  // ── Regime classification (EMA slope + ATR) → SL/TP/leverage ────────────
  const vol = classifyRegime(candles, ema8);

  if (vol.regime === "VOLATILE") {
    if (shouldLog("volatile-skip")) console.log(`\n🚫 VOLATILE MARKET — no trade.`);
    const volEntry = {
      timestamp: new Date().toISOString(), symbol: CONFIG.symbol, timeframe: CONFIG.timeframe, price,
      indicators: { ema8, vwap, rsi3 },
      conditions: [{ label: "Regime guard", required: "TRENDING or RANGE", actual: `VOLATILE (${vol.spikeRatio}x ATR)`, pass: false, score: 0 }],
      allPass: false, orderPlaced: false, paperTrading: CONFIG.paperTrading, signalScore: 0,
      volatility: { stable: false, regime: "VOLATILE", spikeRatio: vol.spikeRatio },
      decisionLog: `⛔ SKIPPED | REGIME: VOLATILE | Spike: ${vol.spikeRatio}x ATR`,
    };
    log.trades.push(attachV2(volEntry));
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
    log.trades.push(attachV2(liqEntry));
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

  // Phase D-5.9.1 — shadow-write the cycle's signal evaluation to Postgres.
  // Records the score+threshold+indicators+regime independent of trade
  // outcome. Fire-and-forget; failure logs [d-5.9.1 dual-write] and the
  // JSON write below stays authoritative.
  shadowRecordStrategySignal(logEntry, vol, signal);

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
        logEntry.filledVolume = order.filledVolume;
        logEntry.filledPrice = order.filledPrice;
        console.log(`✅ BUY FILLED — ${order.orderId} | ${order.filledVolume.toFixed(6)} @ $${order.filledPrice.toFixed(4)}`);
      } catch (err) {
        console.log(`❌ ORDER FAILED — ${err.message}`);
        logEntry.error = err.message;
        notifyDiscord(
          `⚠️ RISK ALERT\n` +
          `Issue: live BUY not confirmed filled on ${CONFIG.symbol} @ $${price.toFixed(4)} — ${err.message}. ` +
          `Position NOT marked open.`
        );
      }
    }

    if (logEntry.orderPlaced) {
      // Phase D-4-P-b — explicit type label for successful signal-driven
      // BUY entries. Display-only: dashboards (modePage label resolver,
      // /paper history table, Performance Recent Trades filter) already
      // recognize type === "BUY"; previously this field was unset, which
      // caused successful auto-BUYs to render as "PASS" on the Last Bot
      // Decision card and leave the Type column blank in trade history.
      // No effect on strategy, sizing, SL/TP, gating, or order placement.
      logEntry.type = "BUY";
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

  log.trades.push(attachV2(logEntry));
  saveLog(log);
  writeTradeCsv(logEntry);
  // Phase D-5.7 — shadow-write the cycle's terminal event. Three branches:
  //   1. orderPlaced=true  → BUY (event_type='buy_filled')
  //   2. allPass=true but not orderPlaced AND error set → live BUY failed
  //   3. otherwise → SKIP/BLOCKED/HOLD; not a trade event, do nothing
  //      (skipped/blocked decisions belong in a future strategy_signals
  //       table — out of D-5.7 scope per the design doc).
  if (logEntry.orderPlaced) {
    shadowRecordBuy(logEntry, vol, signal);
  } else if (logEntry.error && signal && signal.allPass) {
    shadowRecordFailedAttempt(logEntry, "buy_attempt");
  }
  console.log(`\nDecision log saved → ${LOG_FILE}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

if (process.argv.includes("--tax-summary")) {
  generateTaxSummary();
} else {
  // Phase D-5.6.1 — wrap run() in a finally that drains pending DB writes
  // and closes the pool. Without this, a fire-and-forget upsertBotControl()
  // could be cut mid-flight when Node exits the event loop, AND the open
  // pg pool would otherwise hold the loop open and block the cron exit.
  // process.exitCode (instead of process.exit) lets the finally block
  // complete before the actual exit.
  run()
    .catch((err) => {
      console.error("Bot error:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      try { await drainDbWritesAndClose(); } catch {}
    });
}
