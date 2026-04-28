import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { createServer } from "http";
import { spawn } from "child_process";
import crypto from "crypto";

const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 3000;

// ─── Bot Log / CSV ────────────────────────────────────────────────────────────

function loadLog() {
  if (!existsSync("safety-check-log.json")) return { trades: [] };
  try { return JSON.parse(readFileSync("safety-check-log.json", "utf8")); }
  catch { return { trades: [] }; }
}

function parseCsvLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { result.push(cur); cur = ""; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function loadCsv() {
  if (!existsSync("trades.csv")) return [];
  const lines = readFileSync("trades.csv", "utf8").trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines
    .slice(1)
    .filter((l) => !l.startsWith(",,,,,,,,,,"))
    .map((l) => {
      const vals = parseCsvLine(l);
      return Object.fromEntries(headers.map((h, i) => [h.trim(), (vals[i] || "").trim()]));
    });
}

function calcPaperPnL(rows, currentPrice) {
  const paperTrades = rows.filter(r => r["Mode"] === "PAPER" && r["Side"] === "BUY" && parseFloat(r["Quantity"]) > 0);
  if (!paperTrades.length) return { tradeCount: 0, totalInvested: 0, totalQty: 0, currentValue: 0, pnl: 0, pnlPct: 0, wins: 0, losses: 0, winRate: 0 };

  const totalQty      = paperTrades.reduce((s, r) => s + parseFloat(r["Quantity"] || 0), 0);
  const totalInvested = paperTrades.reduce((s, r) => s + parseFloat(r["Total USD"] || 0), 0);
  const currentValue  = currentPrice ? totalQty * currentPrice : 0;
  const pnl           = currentValue - totalInvested;
  const pnlPct        = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

  // Per-trade win/loss: compare each entry price to current price
  const wins   = currentPrice ? paperTrades.filter(r => currentPrice > parseFloat(r["Price"])).length : 0;
  const losses = currentPrice ? paperTrades.filter(r => currentPrice < parseFloat(r["Price"])).length : 0;
  const winRate = paperTrades.length > 0 ? (wins / paperTrades.length) * 100 : 0;

  return { tradeCount: paperTrades.length, totalInvested, totalQty, currentValue, pnl, pnlPct, wins, losses, winRate };
}

function getApiData() {
  const log = loadLog();
  const rows = loadCsv();
  const latest = log.trades.length ? log.trades[log.trades.length - 1] : null;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = log.trades.filter(
    (t) => t.timestamp.startsWith(today) && t.orderPlaced && t.type !== "EXIT"
  ).length;
  const stats = {
    total: log.trades.length,
    fired: rows.filter((r) => r["Mode"] === "PAPER" || r["Mode"] === "LIVE").length,
    blocked: rows.filter((r) => r["Mode"] === "BLOCKED").length,
    live: rows.filter((r) => r["Mode"] === "LIVE").length,
    todayCount,
  };
  const currentPrice = latest?.price || null;
  const paperPnL = calcPaperPnL(rows, currentPrice);
  const paperStartingBalance = parseFloat(process.env.PAPER_STARTING_BALANCE || "500");
  let position = { open: false };
  try { if (existsSync("position.json")) position = JSON.parse(readFileSync("position.json", "utf8")); } catch {}
  let control = { stopped: false, paused: false, paperTrading: true, leverage: 2, riskPct: 1 };
  try { if (existsSync("bot-control.json")) control = JSON.parse(readFileSync("bot-control.json", "utf8")); } catch {}
  let perfState = {};
  try { if (existsSync("performance-state.json")) perfState = JSON.parse(readFileSync("performance-state.json", "utf8")); } catch {}
  let capitalState = { xrpRole: "HOLD_ASSET", autoConversion: false, activePct: 70, reservePct: 30 };
  try { if (existsSync("capital-state.json")) capitalState = JSON.parse(readFileSync("capital-state.json", "utf8")); } catch {}
  let portfolioState = {};
  try { if (existsSync("portfolio-state.json")) portfolioState = JSON.parse(readFileSync("portfolio-state.json", "utf8")); } catch {}
  return { latest, stats, recentTrades: [...rows].reverse().slice(0, 30), paperPnL, paperStartingBalance, position, control, perfState, capitalState, portfolioState, recentLogs: log.trades.slice(-8).reverse(), allLogs: log.trades.slice(-20).reverse() };
}

// ─── Chart Data ───────────────────────────────────────────────────────────────

const PAIR_MAP = {
  BTCUSDT: "XBTUSD", ETHUSDT: "ETHUSD", SOLUSDT: "SOLUSD",
  ADAUSDT: "ADAUSD", XRPUSDT: "XRPUSD", DOGEUSDT: "XDGUSD",
  LTCUSDT: "XLTCUSD", LINKUSDT: "LINKUSD", DOTUSDT: "DOTUSD",
  AVAXUSDT: "AVAXUSD", MATICUSDT: "MATICUSD", BNBUSDT: "BNBUSD",
};

const INTERVAL_MAP = {
  "1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30,
  "1H": 60, "4H": 240, "1D": 1440, "1W": 10080,
};

async function fetchCandlesForChart(symbol, timeframe) {
  const pair = PAIR_MAP[symbol] || symbol;
  const interval = INTERVAL_MAP[timeframe] || 5;
  const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kraken API error: ${res.status}`);
  const data = await res.json();
  if (data.error?.length) throw new Error(data.error.join(", "));
  const pairKey = Object.keys(data.result).find(k => k !== "last");
  const seen = new Set();
  return data.result[pairKey]
    .map(k => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[6]),
    }))
    .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; });
}

function calcEMASeries(candles, period) {
  if (candles.length < period) return [];
  const mult = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  const series = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    if (i === period - 1) { series.push({ time: candles[i].time, value: +ema.toFixed(8) }); continue; }
    ema = candles[i].close * mult + ema * (1 - mult);
    series.push({ time: candles[i].time, value: +ema.toFixed(8) });
  }
  return series;
}

function calcVWAPSeries(candles) {
  const series = [];
  let cumTPV = 0, cumVol = 0, currentDay = null;
  for (const c of candles) {
    const day = Math.floor(c.time / 86400);
    if (day !== currentDay) { cumTPV = 0; cumVol = 0; currentDay = day; }
    cumTPV += ((c.high + c.low + c.close) / 3) * c.volume;
    cumVol += c.volume;
    if (cumVol > 0) series.push({ time: c.time, value: +(cumTPV / cumVol).toFixed(8) });
  }
  return series;
}

function calcRSISeries(candles, period) {
  const closes = candles.map(c => c.close);
  const series = [];
  for (let i = period; i < candles.length; i++) {
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - closes[j - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    series.push({ time: candles[i].time, value: +rsi.toFixed(4) });
  }
  return series;
}

function calcBollingerBands(candles, period = 20, mult = 2) {
  const upper = [], lower = [], middle = [];
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const closes = slice.map(c => c.close);
    const sma = closes.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(closes.reduce((s, c) => s + (c - sma) ** 2, 0) / period);
    const time = candles[i].time;
    upper.push({ time, value: +(sma + mult * std).toFixed(8) });
    lower.push({ time, value: +(sma - mult * std).toFixed(8) });
    middle.push({ time, value: +sma.toFixed(8) });
  }
  return { upper, lower, middle };
}

let chartCache = null;
let chartCacheTime = 0;

async function getChartData() {
  const now = Date.now();
  if (chartCache && now - chartCacheTime < 15000) return chartCache;

  const log = loadLog();
  const latest = log.trades.length ? log.trades[log.trades.length - 1] : null;
  const symbol = latest?.symbol || "XRPUSDT";
  const timeframe = latest?.timeframe || "5m";
  const intervalSecs = (INTERVAL_MAP[timeframe] || 5) * 60;

  const candles = await fetchCandlesForChart(symbol, timeframe);

  const markers = log.trades
    .filter(t => t.orderPlaced)
    .map(t => ({
      time: Math.floor(Math.floor(new Date(t.timestamp).getTime() / 1000) / intervalSecs) * intervalSecs,
      position: "belowBar",
      color: "#3fb950",
      shape: "arrowUp",
      text: "BUY",
    }))
    .sort((a, b) => a.time - b.time);

  chartCache = {
    symbol, timeframe,
    candles,
    ema8: calcEMASeries(candles, 8),
    vwap: calcVWAPSeries(candles),
    rsi3: calcRSISeries(candles, 3),
    bollinger: calcBollingerBands(candles, 20, 2),
    volume: candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? "rgba(63,185,80,0.35)" : "rgba(248,81,73,0.35)",
    })),
    markers,
  };
  chartCacheTime = now;
  return chartCache;
}

// ─── Kraken Balance ───────────────────────────────────────────────────────────

const ASSET_LABELS = {
  ZUSD: "USD", XXBT: "BTC", XETH: "ETH", XXRP: "XRP",
  XLTC: "LTC", XDOT: "DOT", ADA: "ADA", SOL: "SOL",
  AVAX: "AVAX", LINK: "LINK", MATIC: "MATIC", XDG: "DOGE", XXDG: "DOGE", BNBUSDT: "BNB",
};

const ASSET_TO_PAIR = {
  BTC: "XBTUSD", ETH: "ETHUSD", XRP: "XRPUSD", LTC: "LTCUSD",
  SOL: "SOLUSD", ADA: "ADAUSD", AVAX: "AVAXUSD", LINK: "LINKUSD",
  DOT: "DOTUSD", DOGE: "XDGUSD", MATIC: "MATICUSD",
};

const TICKER_RESPONSE_KEY = {
  XBTUSD: "XXBTZUSD", ETHUSD: "XETHZUSD", XRPUSD: "XXRPZUSD", LTCUSD: "XLTCZUSD",
};

async function fetchAssetPrices(assetNames) {
  const pairs = assetNames.filter(a => a !== "USD" && ASSET_TO_PAIR[a]).map(a => ASSET_TO_PAIR[a]);
  if (!pairs.length) return {};
  const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pairs.join(",")}`);
  const data = await res.json();
  if (data.error?.length) return {};
  const prices = {};
  for (const [asset, pair] of Object.entries(ASSET_TO_PAIR)) {
    if (!assetNames.includes(asset)) continue;
    const key = TICKER_RESPONSE_KEY[pair] || pair;
    const ticker = data.result[key] || data.result[pair];
    if (ticker) prices[asset] = parseFloat(ticker.c[0]);
  }
  return prices;
}

function signKrakenRequest(path, nonce, postData) {
  const secretBuffer = Buffer.from(process.env.KRAKEN_SECRET_KEY, "base64");
  const sha256Hash = crypto.createHash("sha256").update(nonce + postData).digest();
  return crypto.createHmac("sha512", secretBuffer)
    .update(Buffer.concat([Buffer.from(path), sha256Hash]))
    .digest("base64");
}

// ─── Trade Execution ──────────────────────────────────────────────────────────

const PAIR_TO_KRAKEN = {
  XRPUSDT: "XRPUSD", BTCUSDT: "XBTUSD", ETHUSDT: "ETHUSD",
  SOLUSDT: "SOLUSD", ADAUSDT: "ADAUSD", DOGEUSDT: "XDGUSD",
};

async function fetchCurrentPrice(symbol) {
  const pair = PAIR_TO_KRAKEN[symbol] || symbol;
  const res  = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`);
  const data = await res.json();
  if (data.error?.length) throw new Error(data.error.join(", "));
  const key  = Object.keys(data.result)[0];
  return parseFloat(data.result[key].c[0]);
}

async function execKrakenOrder(side, pair, volume, leverage = 1) {
  const apiKey    = process.env.KRAKEN_API_KEY;
  const secretKey = process.env.KRAKEN_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("Kraken credentials not set");
  const nonce    = Date.now().toString();
  const path     = "/0/private/AddOrder";
  const params   = { nonce, ordertype: "market", type: side, volume, pair };
  if (leverage > 1) params.leverage = leverage;
  const postData = new URLSearchParams(params).toString();
  const sig      = signKrakenRequest(path, nonce, postData);
  const res = await fetch(`https://api.kraken.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "API-Key": apiKey, "API-Sign": sig },
    body: postData,
  });
  const data = await res.json();
  if (data.error?.length) throw new Error(data.error.join(", "));
  return { orderId: data.result.txid[0] };
}

async function handleTradeCommand(command, params = {}) {
  const ctrl = existsSync("bot-control.json") ? JSON.parse(readFileSync("bot-control.json", "utf8")) : {};
  const isPaper = ctrl.paperTrading !== false;
  const symbol  = "XRPUSDT";
  const krakenPair = PAIR_TO_KRAKEN[symbol];
  let   pos  = { open: false };
  try { if (existsSync("position.json")) pos = JSON.parse(readFileSync("position.json", "utf8")); } catch {}

  const leverage = Math.min(Math.max(parseInt(ctrl.leverage || 2), 1), 3);
  const riskPct  = parseFloat(ctrl.riskPct || 1);
  const portfolioUSD = parseFloat(process.env.PORTFOLIO_VALUE_USD || "850");
  const tradeSize    = portfolioUSD * (riskPct / 100);

  const price = await fetchCurrentPrice(symbol);
  const volume = (tradeSize / price).toFixed(8);

  const log = existsSync("safety-check-log.json")
    ? JSON.parse(readFileSync("safety-check-log.json", "utf8"))
    : { trades: [] };

  if (command === "BUY_MARKET" || command === "OPEN_LONG") {
    if (pos.open) throw new Error("Position already open — close it first");
    const useLev = command === "OPEN_LONG" ? (params.leverage || leverage) : 1;
    let orderId = isPaper ? `PAPER-${Date.now()}` : null;
    if (!isPaper) {
      const order = await execKrakenOrder("buy", krakenPair, volume, useLev);
      orderId = order.orderId;
    }
    const slPct = parseFloat(params.slPct || ctrl.stopLossPct || 1.25);
    const tpPct = parseFloat(params.tpPct || ctrl.takeProfitPct || 2.0);
    const newPos = {
      open: true, side: "long", symbol, entryPrice: price,
      entryTime: new Date().toISOString(),
      quantity: (tradeSize * useLev) / price,
      tradeSize, leverage: useLev, effectiveSize: tradeSize * useLev,
      orderId,
      stopLoss:   price * (1 - slPct   / 100),
      takeProfit: price * (1 + tpPct   / 100),
    };
    writeFileSync("position.json", JSON.stringify(newPos, null, 2));
    const entry = { type: "MANUAL_BUY", timestamp: new Date().toISOString(), symbol, price, tradeSize, leverage: useLev, orderId, paperTrading: isPaper, conditions: [], allPass: true, orderPlaced: true };
    log.trades.push(entry);
    writeFileSync("safety-check-log.json", JSON.stringify(log, null, 2));
    return { ok: true, message: `${isPaper ? "Paper" : "Live"} BUY — ${volume} XRP at $${price.toFixed(4)} | SL $${newPos.stopLoss.toFixed(4)} | TP $${newPos.takeProfit.toFixed(4)}`, price, orderId };
  }

  if (command === "CLOSE_POSITION") {
    if (!pos.open) throw new Error("No open position to close");
    let orderId = isPaper ? `PAPER-SELL-${Date.now()}` : null;
    if (!isPaper) {
      const sellVol = pos.quantity.toFixed(8);
      const order   = await execKrakenOrder("sell", krakenPair, sellVol, 1);
      orderId = order.orderId;
    }
    const pnlPct = ((price - pos.entryPrice) / pos.entryPrice * 100).toFixed(2);
    const pnlUSD = ((price - pos.entryPrice) / pos.entryPrice * pos.tradeSize).toFixed(2);
    const exitEntry = { type: "EXIT", timestamp: new Date().toISOString(), symbol, price, quantity: pos.quantity, tradeSize: pos.tradeSize, entryPrice: pos.entryPrice, exitReason: "MANUAL_CLOSE", pct: pnlPct, pnlUSD, paperTrading: isPaper, orderId, conditions: [], allPass: false, orderPlaced: true };
    log.trades.push(exitEntry);
    writeFileSync("safety-check-log.json", JSON.stringify(log, null, 2));
    writeFileSync("position.json", JSON.stringify({ open: false }, null, 2));
    balanceCache = null;
    return { ok: true, message: `Position closed — P&L: ${pnlPct}% ($${pnlUSD}) | ${isPaper ? "Paper" : "Live"} SELL at $${price.toFixed(4)}`, price, orderId, pnlPct, pnlUSD };
  }

  if (command === "SELL_ALL") {
    const bal = await fetchKrakenBalance();
    const xrp = bal.balances?.find(b => b.asset === "XRP");
    if (!xrp || xrp.amount < 0.001) throw new Error("No XRP balance to sell");
    let orderId = isPaper ? `PAPER-SELLALL-${Date.now()}` : null;
    if (!isPaper) {
      const order = await execKrakenOrder("sell", krakenPair, xrp.amount.toFixed(8), 1);
      orderId = order.orderId;
    }
    writeFileSync("position.json", JSON.stringify({ open: false }, null, 2));
    balanceCache = null;
    return { ok: true, message: `${isPaper ? "Paper" : "Live"} SELL ALL — ${xrp.amount.toFixed(4)} XRP at $${price.toFixed(4)}`, price, orderId, quantity: xrp.amount };
  }

  if (command === "SET_STOP_LOSS") {
    if (!pos.open) throw new Error("No open position — open a trade first");
    const pct    = parseFloat(params.pct || 1.25);
    pos.stopLoss = pos.entryPrice * (1 - pct / 100);
    writeFileSync("position.json", JSON.stringify(pos, null, 2));
    return { ok: true, message: `Stop loss updated to $${pos.stopLoss.toFixed(4)} (-${pct}% from entry $${pos.entryPrice.toFixed(4)})` };
  }

  if (command === "SET_TAKE_PROFIT") {
    if (!pos.open) throw new Error("No open position — open a trade first");
    const pct       = parseFloat(params.pct || 2.0);
    pos.takeProfit  = pos.entryPrice * (1 + pct / 100);
    writeFileSync("position.json", JSON.stringify(pos, null, 2));
    return { ok: true, message: `Take profit updated to $${pos.takeProfit.toFixed(4)} (+${pct}% from entry $${pos.entryPrice.toFixed(4)})` };
  }

  throw new Error("Unknown trade command: " + command);
}

let balanceCache = null;
let balanceCacheTime = 0;

async function fetchKrakenBalance() {
  const now = Date.now();
  if (balanceCache && now - balanceCacheTime < 30000) return balanceCache;

  const apiKey = process.env.KRAKEN_API_KEY;
  const secretKey = process.env.KRAKEN_SECRET_KEY;
  if (!apiKey || !secretKey) return { error: "KRAKEN_API_KEY / KRAKEN_SECRET_KEY not set in .env" };

  const path = "/0/private/Balance";
  const nonce = Date.now().toString();
  const postData = new URLSearchParams({ nonce }).toString();
  const signature = signKrakenRequest(path, nonce, postData);

  const res = await fetch(`https://api.kraken.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "API-Key": apiKey,
      "API-Sign": signature,
    },
    body: postData,
  });

  const data = await res.json();
  if (data.error?.length) return { error: data.error.join(", ") };

  const HIDE = new Set(["PEPE", "DOGE", "ELIZAOS"]);

  const balances = Object.entries(data.result)
    .map(([raw, amt]) => ({ asset: ASSET_LABELS[raw] || raw, amount: parseFloat(amt) }))
    .filter(b => b.amount > 0.000001 && !HIDE.has(b.asset))
    .sort((a, b) => (a.asset === "USD" ? -1 : b.asset === "USD" ? 1 : a.asset.localeCompare(b.asset)));

  const assetNames = balances.map(b => b.asset);
  const prices = await fetchAssetPrices(assetNames);

  let totalUSD = 0;
  for (const b of balances) {
    if (b.asset === "USD") {
      b.usdValue = b.amount;
    } else if (prices[b.asset]) {
      b.price = prices[b.asset];
      b.usdValue = b.amount * prices[b.asset];
    }
    if (b.usdValue) totalUSD += b.usdValue;
  }

  balanceCache = { balances, totalUSD, updatedAt: new Date().toISOString() };
  balanceCacheTime = now;
  return balanceCache;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

const sessions = new Set();

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 1) continue;
    cookies[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return cookies;
}

function isAuthenticated(req) {
  return sessions.has(parseCookies(req.headers.cookie).session);
}

function readBody(req) {
  return new Promise(resolve => {
    let buf = "";
    req.on("data", c => buf += c);
    req.on("end", () => resolve(buf));
  });
}

function loginPage(error = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign in — Agent Avila</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0B0F1A; --card: #121A2A; --border: rgba(0,212,255,0.12);
    --text: #E6EDF3; --muted: #8B98A5; --blue: #00D4FF; --purple: #7C5CFF;
    --red: #FF4D6A; --green: #00FF9A;
  }
  html, body { height: 100%; }
  body {
    background: var(--bg);
    background-image:
      radial-gradient(ellipse 600px 400px at 25% 30%, rgba(0,212,255,0.08), transparent 70%),
      radial-gradient(ellipse 600px 500px at 80% 80%, rgba(124,92,255,0.08), transparent 70%);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 20px;
    overflow: hidden;
  }
  /* Animated background grid */
  body::before {
    content: ""; position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
    pointer-events: none;
  }
  .card {
    position: relative; width: 100%; max-width: 420px;
    background: rgba(18,26,42,0.85);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--border); border-radius: 20px;
    padding: 44px 40px;
    box-shadow:
      0 20px 60px rgba(0,0,0,0.5),
      0 0 40px rgba(0,212,255,0.08),
      inset 0 1px 0 rgba(255,255,255,0.04);
    animation: cardIn 0.6s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }
  /* Gradient border accent */
  .card::before {
    content: ""; position: absolute; inset: -1px; border-radius: 20px;
    background: linear-gradient(135deg, rgba(0,212,255,0.5), rgba(124,92,255,0.5), transparent 60%);
    z-index: -1; opacity: 0.4;
  }
  .logo-wrap { display: flex; flex-direction: column; align-items: center; margin-bottom: 32px; }
  .logo {
    width: 56px; height: 56px; border-radius: 16px;
    background: linear-gradient(135deg, var(--blue), var(--purple));
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 900; color: #fff;
    box-shadow: 0 8px 24px rgba(0,212,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2);
    margin-bottom: 16px;
    animation: logoPulse 3s ease-in-out infinite;
  }
  @keyframes logoPulse {
    0%,100% { box-shadow: 0 8px 24px rgba(0,212,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2); }
    50%     { box-shadow: 0 8px 32px rgba(0,212,255,0.55), inset 0 1px 0 rgba(255,255,255,0.2); }
  }
  h1 {
    font-size: 24px; font-weight: 800; letter-spacing: -0.02em;
    background: linear-gradient(90deg, var(--blue), var(--purple));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sub { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .field { margin-bottom: 16px; }
  label {
    display: block; font-size: 12px; font-weight: 600;
    color: var(--muted); margin-bottom: 7px;
    letter-spacing: 0.02em;
  }
  input[type="email"], input[type="password"] {
    width: 100%; background: rgba(0,0,0,0.3);
    border: 1px solid var(--border); border-radius: 12px;
    color: var(--text); font-size: 14px; padding: 13px 16px;
    outline: none; transition: all 0.2s;
    font-family: inherit;
  }
  input[type="email"]::placeholder, input[type="password"]::placeholder {
    color: rgba(139,152,165,0.5);
  }
  input[type="email"]:focus, input[type="password"]:focus {
    border-color: var(--blue);
    background: rgba(0,212,255,0.04);
    box-shadow: 0 0 0 4px rgba(0,212,255,0.12);
  }
  .row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 24px; font-size: 12px;
  }
  .checkbox-wrap { display: flex; align-items: center; gap: 8px; color: var(--muted); cursor: pointer; user-select: none; }
  .checkbox-wrap input { width: 14px; height: 14px; accent-color: var(--blue); cursor: pointer; }
  .forgot { color: var(--blue); text-decoration: none; font-weight: 500; transition: opacity 0.15s; }
  .forgot:hover { opacity: 0.75; }
  button[type="submit"] {
    width: 100%; padding: 14px;
    background: linear-gradient(135deg, var(--blue), var(--purple));
    color: #fff; border: none; border-radius: 12px;
    font-size: 14px; font-weight: 700; letter-spacing: 0.01em;
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 14px rgba(0,212,255,0.3);
    font-family: inherit;
  }
  button[type="submit"]:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(0,212,255,0.45);
  }
  button[type="submit"]:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,212,255,0.3); }
  .error {
    background: rgba(255,77,106,0.08);
    border: 1px solid rgba(255,77,106,0.25);
    color: var(--red); border-radius: 10px;
    padding: 11px 14px; font-size: 13px;
    margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
  }
  .footer-text {
    text-align: center; color: var(--muted); font-size: 12px;
    margin-top: 24px; padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.04);
  }
  .footer-text a { color: var(--blue); text-decoration: none; }
  @media (max-width: 480px) {
    .card { padding: 32px 24px; border-radius: 16px; }
    h1 { font-size: 22px; }
    .logo { width: 48px; height: 48px; font-size: 22px; }
  }
</style>
</head>
<body>
<div class="card">
  <div class="logo-wrap">
    <div class="logo">⚡</div>
    <h1>Agent Avila</h1>
    <p class="sub">Sign in to your trading dashboard</p>
  </div>
  ${error ? `<div class="error">⚠ ${error}</div>` : ""}
  <form method="POST" action="/login" autocomplete="on">
    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" name="email" placeholder="you@example.com" autocomplete="email" required autofocus>
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input id="password" type="password" name="password" placeholder="••••••••" autocomplete="current-password" required>
    </div>
    <div class="row">
      <label class="checkbox-wrap">
        <input type="checkbox" name="remember" checked> Remember me
      </label>
      <a href="#" class="forgot" onclick="alert('Reset via .env DASHBOARD_PASSWORD or backup phrase'); return false">Forgot password?</a>
    </div>
    <button type="submit">Sign in →</button>
  </form>
  <div class="footer-text">Protected by 2FA · <a href="https://github.com/relentlessvic/agent-avila">github.com/relentlessvic/agent-avila</a></div>
</div>
</body>
</html>`;
}

const pendingSessions = new Set();

// TOTP (RFC 6238) — no external deps
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(s) {
  s = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, val = 0;
  const out = [];
  for (const ch of s) {
    val = (val << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((val >>> bits) & 0xff); }
  }
  return Buffer.from(out);
}

function genBase32Secret() {
  const buf = crypto.randomBytes(20);
  let result = "", bits = 0, val = 0;
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { bits -= 5; result += BASE32[(val >>> bits) & 31]; }
  }
  if (bits > 0) result += BASE32[(val << (5 - bits)) & 31];
  return result;
}

function verifyTotp(secret, code) {
  const key = base32Decode(secret);
  const step = Math.floor(Date.now() / 1000 / 30);
  for (const drift of [-1, 0, 1]) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(step + drift));
    const hmac = crypto.createHmac("sha1", key).update(buf).digest();
    const offset = hmac[19] & 0xf;
    const otp = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1_000_000;
    if (String(otp).padStart(6, "0") === String(code).trim()) return true;
  }
  return false;
}

function twoFaPage(error = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>2FA — Agent Avila</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #e6edf3; --muted: #8b949e; --blue: #58a6ff; --red: #f85149; --yellow: #d29922; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 40px; width: 380px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 28px; }
  label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 6px; }
  .totp-input { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 22px; letter-spacing: 6px; text-align: center; padding: 12px; outline: none; margin-bottom: 16px; transition: border-color 0.15s; }
  .phrase-input { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 14px; padding: 10px 12px; outline: none; margin-bottom: 16px; transition: border-color 0.15s; }
  input:focus { border-color: var(--blue); }
  .btn-primary { width: 100%; background: var(--blue); color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; padding: 11px; cursor: pointer; transition: opacity 0.15s; }
  .btn-primary:hover { opacity: 0.85; }
  .error { background: rgba(248,81,73,0.1); border: 1px solid rgba(248,81,73,0.3); color: var(--red); border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
  .divider { display: flex; align-items: center; gap: 12px; margin: 24px 0; color: var(--muted); font-size: 12px; }
  .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: var(--border); }
  .backup-label { font-size: 12px; color: var(--muted); margin-bottom: 12px; }
  .back { display: block; text-align: center; margin-top: 20px; font-size: 13px; color: var(--muted); text-decoration: none; }
  .back:hover { color: var(--text); }
</style>
</head>
<body>
<div class="card">
  <h1>Two-Factor Auth</h1>
  <p class="sub">Enter the 6-digit code from your authenticator app</p>
  ${error ? `<div class="error">${error}</div>` : ""}
  <form method="POST" action="/2fa">
    <label>Authenticator Code</label>
    <input class="totp-input" type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" autofocus>
    <button class="btn-primary" type="submit">Verify</button>
  </form>
  <div class="divider">or</div>
  <p class="backup-label">Can't access your authenticator app? Use your backup phrase.</p>
  <form method="POST" action="/2fa">
    <label>Backup Phrase</label>
    <input class="phrase-input" type="password" name="backup" autocomplete="off" placeholder="Enter backup phrase">
    <button class="btn-primary" type="submit">Use Backup Phrase</button>
  </form>
  <a href="/login" class="back">← Back to login</a>
</div>
</body>
</html>`;
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>Agent Avila</title>
<!-- PWA -->
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0B0F1A">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Agent Avila">
<link rel="apple-touch-icon" href="/icon-192.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    /* Dark Pro Trading Theme */
    --bg:      #0B0F1A;
    --card:    #121A2A;
    --border:  rgba(0,212,255,0.12);
    --text:    #E6EDF3;
    --muted:   #8B98A5;
    --green:   #00FF9A;
    --red:     #FF4D6A;
    --yellow:  #FFB547;
    --blue:    #00D4FF;
    --purple:  #7C5CFF;
    --glow-blue:  rgba(0,212,255,0.15);
    --glow-green: rgba(0,255,154,0.15);
    --glow-red:   rgba(255,77,106,0.12);
    --glass-bg:   rgba(18,26,42,0.75);
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    min-height: 100vh;
  }

  nav {
    background: rgba(18,26,42,0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .nav-left { display: flex; align-items: center; gap: 16px; }
  .nav-title { font-size: 16px; font-weight: 700; background: linear-gradient(90deg, var(--blue), var(--purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .nav-right { display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: 13px; }
  /* ── Hamburger ── */
  .hamburger { background:none; border:none; cursor:pointer; padding:6px; display:flex; flex-direction:column; gap:4px; }
  .hamburger span { display:block; width:20px; height:2px; background:var(--muted); border-radius:1px; transition:all 0.2s; }
  .hamburger:hover span { background:var(--text); }
  /* ── Nav Drawer ── */
  .nav-drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:200; opacity:0; pointer-events:none; transition:opacity 0.2s; }
  .nav-drawer-overlay.open { opacity:1; pointer-events:all; }
  .nav-drawer { position:fixed; left:0; top:0; bottom:0; width:260px; background:rgba(18,26,42,0.97); backdrop-filter:blur(20px); border-right:1px solid var(--border); z-index:201; transform:translateX(-100%); transition:transform 0.25s cubic-bezier(0.4,0,0.2,1); padding:0; display:flex; flex-direction:column; }
  .nav-drawer.open { transform:translateX(0); }
  .nav-drawer-header { padding:20px 20px 16px; border-bottom:1px solid var(--border); }
  .nav-drawer-logo { font-size:18px; font-weight:800; background:linear-gradient(90deg,var(--blue),var(--purple)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .nav-drawer-sub { font-size:11px; color:var(--muted); margin-top:2px; }
  .nav-drawer-items { flex:1; overflow-y:auto; padding:12px 0; }
  .nav-item { display:flex; align-items:center; gap:12px; padding:10px 20px; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; transition:all 0.15s; border-left:2px solid transparent; text-decoration:none; }
  .nav-item:hover { color:var(--text); background:rgba(255,255,255,0.03); border-left-color:var(--border); }
  .nav-item.active { color:var(--blue); background:rgba(0,212,255,0.06); border-left-color:var(--blue); }
  .nav-item-icon { font-size:16px; width:20px; text-align:center; flex-shrink:0; }
  .nav-section-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--muted); padding:12px 20px 4px; }
  .nav-drawer-footer { padding:16px 20px; border-top:1px solid var(--border); }
  .nav-health-dot { width:7px; height:7px; border-radius:50%; display:inline-block; margin-right:6px; }
  /* ── System Health Panel ── */
  .health-monitor { background:var(--glass-bg); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:10px; padding:16px 20px; margin-bottom:24px; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  .health-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .health-check-item { display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid var(--border); }
  .health-check-icon { font-size:20px; }
  .health-check-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; text-align:center; }
  .health-check-status { font-size:12px; font-weight:700; }
  .health-ok   { color:var(--green); }
  .health-warn { color:var(--yellow); }
  .health-fail { color:var(--red); }
  @media(max-width:768px) { .health-grid { grid-template-columns:repeat(2,1fr); } }
  .badge {
    padding: 3px 10px; border-radius: 20px; font-size: 12px;
    font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
  }
  .badge-paper  { background: rgba(255,181,71,0.12);  color: var(--yellow); border: 1px solid rgba(255,181,71,0.3); }
  .badge-live   { background: rgba(0,255,154,0.1);    color: var(--green);  border: 1px solid rgba(0,255,154,0.3); }
  .badge-symbol { background: rgba(0,212,255,0.1);    color: var(--blue);   border: 1px solid rgba(0,212,255,0.2); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); display: inline-block; animation: pulse 2s infinite; box-shadow: 0 0 6px var(--green); }
  @keyframes pulse { 0%,100% { opacity: 1; box-shadow: 0 0 6px var(--green); } 50% { opacity: 0.5; box-shadow: 0 0 2px var(--green); } }

  /* ── Cards (lightweight, with hover lift) ── */
  .card, .stat-card, .pnl-card, .chart-card, .balance-card, .trade-terminal, .ctrl-panel, .paper-wallet, .position-card, .table-card, .perf-panel, .capital-panel, .portfolio-panel, .health-monitor {
    background: var(--card) !important;
    border: 1px solid var(--border) !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .card:hover, .stat-card:hover, .pnl-card:hover, .balance-card:hover, .perf-panel:hover, .capital-panel:hover, .portfolio-panel:hover, .health-monitor:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35), 0 0 12px rgba(0,212,255,0.05), inset 0 1px 0 rgba(255,255,255,0.05);
    border-color: rgba(0,212,255,0.18) !important;
  }

  /* ── Toast Notifications ── */
  .toast-container { position: fixed; top: 16px; right: 16px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; max-width: 360px; }
  .toast { background: rgba(18,26,42,0.95); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 10px; min-width: 240px; pointer-events: all; animation: toastIn 0.3s cubic-bezier(0.16,1,0.3,1); transform-origin: top right; }
  .toast.toast-out { animation: toastOut 0.25s ease-in forwards; }
  @keyframes toastIn  { from { opacity: 0; transform: translateX(20px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
  @keyframes toastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(20px); } }
  .toast-icon  { font-size: 18px; flex-shrink: 0; }
  .toast-msg   { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; line-height: 1.4; }
  .toast-success { border-color: rgba(0,255,154,0.3); box-shadow: 0 8px 24px rgba(0,255,154,0.1); }
  .toast-error   { border-color: rgba(255,77,106,0.3); box-shadow: 0 8px 24px rgba(255,77,106,0.1); }
  .toast-info    { border-color: rgba(0,212,255,0.3);  box-shadow: 0 8px 24px rgba(0,212,255,0.1); }
  .toast-warn    { border-color: rgba(255,181,71,0.3); box-shadow: 0 8px 24px rgba(255,181,71,0.1); }

  /* ── Modal Dialog ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center; z-index: 10000; padding: 20px; }
  .modal-overlay.open { display: flex; animation: fadeIn 0.2s ease-out; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; max-width: 420px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,212,255,0.1); animation: modalIn 0.25s cubic-bezier(0.16,1,0.3,1); }
  @keyframes modalIn { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .modal-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(255,77,106,0.12); display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px; }
  .modal-title { font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
  .modal-msg { font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
  .modal-input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 14px; padding: 12px 14px; outline: none; margin-bottom: 16px; font-family: inherit; }
  .modal-input:focus { border-color: var(--red); box-shadow: 0 0 0 3px rgba(255,77,106,0.15); }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .modal-btn { padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; transition: all 0.15s; font-family: inherit; }
  .modal-btn-cancel { background: rgba(255,255,255,0.05); color: var(--muted); }
  .modal-btn-cancel:hover { background: rgba(255,255,255,0.08); color: var(--text); }
  .modal-btn-confirm { background: linear-gradient(135deg, var(--red), #d63a55); color: #fff; box-shadow: 0 4px 12px rgba(255,77,106,0.3); }
  .modal-btn-confirm:hover { box-shadow: 0 6px 20px rgba(255,77,106,0.45); transform: translateY(-1px); }
  .modal-btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

  /* ── Loading skeletons ── */
  .skeleton { display: inline-block; min-width: 60px; min-height: 1em; background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%); background-size: 200% 100%; animation: shimmer-bg 1.5s ease-in-out infinite; border-radius: 4px; color: transparent !important; }
  @keyframes shimmer-bg { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* ── Keyboard shortcut hint ── */
  .kbd { display: inline-block; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; padding: 1px 5px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 4px; color: var(--muted); margin: 0 2px; }

  /* ── Hero Live Ticker ── */
  .hero-ticker { display:flex; align-items:center; justify-content:space-between; padding:18px 28px; margin-bottom:24px; background: linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(124,92,255,0.06) 100%); border:1px solid rgba(0,212,255,0.18); border-radius:14px; box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04); position:relative; overflow:hidden; }
  .hero-ticker::before { content:""; position:absolute; top:0; left:-100%; width:100%; height:1px; background:linear-gradient(90deg, transparent, var(--blue), transparent); animation: shimmer 3s ease-in-out infinite; }
  @keyframes shimmer { 0% { left:-100%; } 100% { left:100%; } }
  .ticker-left { display:flex; align-items:center; gap:18px; }
  .ticker-pair { font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:1.5px; }
  .ticker-symbol-icon { width:36px; height:36px; border-radius:50%; background: linear-gradient(135deg, var(--blue), var(--purple)); display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:900; color:#fff; box-shadow: 0 0 18px rgba(0,212,255,0.35); }
  .ticker-price { font-size:32px; font-weight:900; font-variant-numeric:tabular-nums; transition:color 0.4s ease; line-height:1; }
  .ticker-arrow { display:inline-block; font-size:18px; transition:transform 0.3s; }
  .ticker-arrow.up   { color:var(--green); animation: bounce-up   0.5s; }
  .ticker-arrow.down { color:var(--red);   animation: bounce-down 0.5s; }
  @keyframes bounce-up   { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
  @keyframes bounce-down { 0%,100% { transform:translateY(0); } 50% { transform:translateY(4px); } }
  .ticker-right { display:flex; gap:24px; align-items:center; }
  .ticker-stat { text-align:right; }
  .ticker-stat-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .ticker-stat-value { font-size:18px; font-weight:800; font-variant-numeric:tabular-nums; }
  .ticker-pulse-dot { width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow: 0 0 8px var(--green); animation: pulse-glow 2s ease-in-out infinite; display:inline-block; margin-right:6px; }
  @keyframes pulse-glow { 0%,100% { box-shadow:0 0 8px var(--green); opacity:1; } 50% { box-shadow:0 0 14px var(--green); opacity:0.7; } }
  .ticker-live-label { font-size:11px; font-weight:700; color:var(--green); letter-spacing:1px; }
  @media(max-width:768px) { .hero-ticker { flex-direction:column; gap:12px; padding:14px 18px; } .ticker-right { width:100%; justify-content:space-around; } .ticker-price { font-size:24px; } }

  /* Health ring pulse */
  .portfolio-score-ring { animation: ring-breathe 4s ease-in-out infinite; }
  @keyframes ring-breathe { 0%,100% { box-shadow: 0 0 20px rgba(0,212,255,0.15); } 50% { box-shadow: 0 0 32px rgba(0,212,255,0.3); } }

  /* Number tween animation */
  .num-flash-up   { animation: flash-green 0.8s ease-out; }
  .num-flash-down { animation: flash-red   0.8s ease-out; }
  @keyframes flash-green { 0% { color:var(--green); text-shadow:0 0 10px var(--green); } 100% { } }
  @keyframes flash-red   { 0% { color:var(--red);   text-shadow:0 0 10px var(--red);   } 100% { } }

  /* Cards (lightweight) closing wrapper */
  .position-card.pos-open {
    border-color: rgba(0,212,255,0.3) !important;
    box-shadow: 0 0 30px var(--glow-blue), 0 8px 32px rgba(0,0,0,0.4) !important;
  }
  .position-card.pos-profit {
    border-color: rgba(0,255,154,0.3) !important;
    box-shadow: 0 0 30px var(--glow-green), 0 8px 32px rgba(0,0,0,0.4) !important;
  }
  .position-card.pos-loss {
    border-color: rgba(255,77,106,0.3) !important;
    box-shadow: 0 0 20px var(--glow-red), 0 8px 32px rgba(0,0,0,0.4) !important;
  }

  main { padding: 24px; max-width: 1400px; margin: 0 auto; }

  /* ── Mobile responsive ── */
  @media (max-width: 768px) {
    main { padding: 12px; }
    nav { padding: 0 14px; height: 50px; }
    .nav-title { font-size: 14px; }
    .ctrl-groups { grid-template-columns: 1fr 1fr !important; }
    .trade-cmd-grid { grid-template-columns: 1fr !important; }
    .position-grid { grid-template-columns: repeat(2,1fr) !important; }
    .pnl-grid { grid-template-columns: repeat(2,1fr) !important; }
    .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
    .info-cards { grid-template-columns: repeat(2,1fr) !important; }
    .indicators-safety-grid { grid-template-columns: 1fr !important; }
    .heatmap-scroll { overflow-x: auto; }
    .rsi-hide-mobile { display: none; }
    .section-header { flex-wrap: wrap; gap: 8px; }
    .view-toggle { font-size: 11px; }
    .trade-pct-label { width: 60px; font-size: 10px; }
    .ctrl-btn { padding: 10px 12px; font-size: 13px; }
  }
  @media (max-width: 480px) {
    .ctrl-groups { grid-template-columns: 1fr !important; }
    .pnl-grid { grid-template-columns: 1fr 1fr !important; }
    nav .nav-right { display: none; }
  }
  /* ── Page Tabs ── */
  .tab-strip { background: rgba(18,26,42,0.9); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); padding: 0 24px; display: flex; gap: 0; }
  .tab-btn { padding: 12px 20px; font-size: 13px; font-weight: 600; color: var(--muted); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s; margin-bottom: -1px; }
  .tab-btn:hover { color: var(--text); }
  .tab-btn.active { color: var(--blue); border-bottom-color: var(--blue); text-shadow: 0 0 12px rgba(0,212,255,0.4); }
  /* ── Info Page ── */
  .info-page { max-width: 780px; margin: 0 auto; padding: 32px 24px; display: none; }
  .info-hero { background: linear-gradient(135deg, rgba(0,212,255,0.06), rgba(124,92,255,0.06)); border: 1px solid rgba(0,212,255,0.2); border-radius: 12px; padding: 28px 32px; margin-bottom: 32px; }
  .info-hero h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
  .info-hero p { font-size: 14px; color: var(--muted); line-height: 1.7; }
  .info-section { margin-bottom: 32px; }
  .info-section h2 { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
  .info-step { display: flex; gap: 16px; align-items: flex-start; padding: 14px 0; border-bottom: 1px solid rgba(48,54,61,0.5); }
  .info-step:last-child { border-bottom: none; }
  .info-step-num { width: 32px; height: 32px; border-radius: 50%; background: rgba(88,166,255,0.12); color: var(--blue); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .info-step-body h3 { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .info-step-body p { font-size: 13px; color: var(--muted); line-height: 1.6; }
  .info-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .info-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px 18px; }
  .info-card-icon { font-size: 20px; margin-bottom: 8px; }
  .info-card-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 4px; }
  .info-card-value { font-size: 18px; font-weight: 700; color: var(--text); }
  .info-card-sub { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .info-alert { background: rgba(210,153,34,0.08); border: 1px solid rgba(210,153,34,0.25); border-radius: 8px; padding: 14px 18px; font-size: 13px; color: var(--text); line-height: 1.6; margin-bottom: 24px; }
  .info-alert strong { color: var(--yellow); }
  @media (max-width: 600px) { .info-cards { grid-template-columns: repeat(2,1fr); } }

  .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 12px; }

  .refresh-bar { height: 2px; background: var(--border); border-radius: 1px; margin-bottom: 24px; overflow: hidden; }
  .refresh-progress { height: 100%; background: var(--blue); width: 100%; transition: width 1s linear; }

  /* ── Chart ── */
  .chart-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .chart-header {
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .legend { display: flex; gap: 20px; font-size: 12px; color: var(--muted); align-items: center; }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-line { width: 16px; height: 2px; border-radius: 1px; }
  #chart-container { width: 100%; height: 420px; }
  #rsi-container   { width: 100%; height: 120px; border-top: 1px solid var(--border); }
  .chart-error { padding: 40px; text-align: center; color: var(--muted); font-size: 13px; }

  /* ── Stats ── */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; }
  .stat-label { font-size: 12px; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-value { font-size: 28px; font-weight: 700; line-height: 1; }
  .stat-sub { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .green { color: var(--green); } .red { color: var(--red); }
  .blue  { color: var(--blue);  } .yellow { color: var(--yellow); }

  /* ── Mid row ── */
  .mid-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
  .card-title { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }

  .indicator-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .indicator-row:last-child { border-bottom: none; }
  .ind-label { color: var(--muted); }
  .ind-value { font-weight: 600; font-size: 15px; }
  .bias-bullish { color: var(--green); } .bias-bearish { color: var(--red); } .bias-neutral { color: var(--yellow); }

  .condition { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .condition:last-child { border-bottom: none; }
  .cond-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .cond-text { flex: 1; }
  .cond-label { font-size: 13px; }
  .cond-detail { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .cond-pass .cond-label { color: var(--green); }
  .cond-fail .cond-label { color: var(--red); }
  .empty-state { color: var(--muted); font-size: 13px; text-align: center; padding: 20px 0; }

  .decision-banner { border-radius: 6px; padding: 10px 14px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
  .decision-pass { background: rgba(63,185,80,0.1); color: var(--green); border: 1px solid rgba(63,185,80,0.2); }
  .decision-fail { background: rgba(248,81,73,0.1); color: var(--red);   border: 1px solid rgba(248,81,73,0.2); }

  /* ── Table ── */
  .table-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
  .table-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); }
  td { padding: 10px 16px; border-bottom: 1px solid rgba(48,54,61,0.5); font-size: 13px; white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  .mode-paper   { color: var(--yellow); font-weight: 600; }
  .mode-live    { color: var(--green);  font-weight: 600; }
  .mode-blocked { color: var(--red);    font-weight: 600; }
  .empty-row td { text-align: center; color: var(--muted); padding: 32px; }

  .footer { text-align: center; color: var(--muted); font-size: 12px; padding-bottom: 32px; }

  /* ── Balance ── */
  .balance-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
  .balance-assets { display: flex; flex-wrap: wrap; gap: 0; align-items: stretch; }
  .balance-asset { padding: 4px 24px 4px 0; margin-right: 24px; border-right: 1px solid var(--border); }
  .balance-asset:last-child { border-right: none; margin-right: 0; padding-right: 0; }
  .balance-asset-name { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 4px; }
  .balance-asset-amount { font-size: 22px; font-weight: 700; }
  .balance-asset-usd { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .balance-total { padding: 4px 0 4px 24px; margin-left: 24px; border-left: 2px solid var(--border); }
  .balance-total-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 4px; }
  .balance-total-value { font-size: 26px; font-weight: 700; color: var(--green); }
  .balance-updated { font-size: 11px; color: var(--muted); white-space: nowrap; }

  /* ── Trading Terminal ── */
  .trade-terminal { background:var(--card); border:1px solid var(--border); border-radius:10px; overflow:hidden; margin-bottom:24px; }
  .trade-terminal-header { padding:14px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }
  .trade-terminal-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted); }
  .trade-terminal-mode { font-size:11px; font-weight:700; }
  .trade-cmd-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0; }
  .trade-cmd-col { padding:16px 18px; border-right:1px solid var(--border); }
  .trade-cmd-col:last-child { border-right:none; }
  .trade-cmd-col-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); margin-bottom:10px; }
  .trade-cmd-btn { width:100%; padding:9px 14px; font-size:12px; font-weight:700; border-radius:6px; border:1px solid; background:transparent; cursor:pointer; margin-bottom:6px; text-align:left; transition:all 0.15s; }
  .trade-cmd-btn:last-child { margin-bottom:0; }
  .trade-btn-buy  { border-color:rgba(63,185,80,0.4);  color:var(--green);  }
  .trade-btn-buy:hover  { background:rgba(63,185,80,0.1); }
  .trade-btn-sell { border-color:rgba(248,81,73,0.4);  color:var(--red);    }
  .trade-btn-sell:hover { background:rgba(248,81,73,0.1); }
  .trade-btn-set  { border-color:rgba(88,166,255,0.4); color:var(--blue);   }
  .trade-btn-set:hover  { background:rgba(88,166,255,0.1); }
  .trade-pct-row { display:flex; gap:6px; align-items:center; margin-bottom:6px; }
  .trade-pct-label { font-size:11px; color:var(--muted); width:80px; flex-shrink:0; }
  .trade-pct-input { flex:1; background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); font-size:12px; font-weight:600; padding:6px 8px; outline:none; }
  .trade-pct-input:focus { border-color:var(--blue); }
  .trade-log { padding:12px 18px; border-top:1px solid var(--border); background:rgba(0,0,0,0.2); min-height:40px; max-height:80px; overflow-y:auto; }
  .trade-log-entry { font-size:12px; color:var(--muted); font-family:monospace; margin-bottom:2px; }
  .trade-log-ok  { color:var(--green); }
  .trade-log-err { color:var(--red); }
  @media(max-width:700px) { .trade-cmd-grid { grid-template-columns:1fr; } .trade-cmd-col { border-right:none; border-bottom:1px solid var(--border); } .trade-cmd-col:last-child { border-bottom:none; } }

  /* ── Agent Avila Chatbox ── */
  .chat-bubble { position:fixed; bottom:24px; right:24px; z-index:500; }
  .chat-toggle-btn { width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--purple)); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:0 4px 20px rgba(0,212,255,0.4); transition:transform 0.2s,box-shadow 0.2s; }
  .chat-toggle-btn:hover { transform:scale(1.08); box-shadow:0 6px 28px rgba(0,212,255,0.6); }
  .chat-unread { position:absolute; top:-4px; right:-4px; width:18px; height:18px; border-radius:50%; background:var(--red); color:#fff; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; }
  .chat-panel { position:fixed; bottom:92px; right:24px; width:380px; max-height:560px; background:rgba(18,26,42,0.97); backdrop-filter:blur(24px); border:1px solid rgba(0,212,255,0.2); border-radius:16px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 30px rgba(0,212,255,0.08); z-index:499; transform:scale(0.95) translateY(10px); opacity:0; pointer-events:none; transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
  .chat-panel.open { transform:scale(1) translateY(0); opacity:1; pointer-events:all; }
  .chat-header { padding:14px 16px; border-bottom:1px solid rgba(0,212,255,0.12); display:flex; align-items:center; gap:10px; }
  .chat-header-icon { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--purple)); display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
  .chat-header-title { font-size:13px; font-weight:700; color:var(--text); }
  .chat-header-sub { font-size:11px; color:var(--muted); }
  .chat-close { margin-left:auto; background:none; border:none; color:var(--muted); cursor:pointer; font-size:18px; padding:2px 6px; border-radius:4px; }
  .chat-close:hover { color:var(--text); background:rgba(255,255,255,0.06); }
  .chat-messages { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:10px; min-height:200px; }
  .chat-msg { max-width:90%; padding:10px 13px; border-radius:12px; font-size:13px; line-height:1.55; }
  .chat-msg-user { background:linear-gradient(135deg,rgba(0,212,255,0.2),rgba(124,92,255,0.2)); border:1px solid rgba(0,212,255,0.2); color:var(--text); align-self:flex-end; border-bottom-right-radius:4px; }
  .chat-msg-bot  { background:rgba(255,255,255,0.04); border:1px solid var(--border); color:var(--text); align-self:flex-start; border-bottom-left-radius:4px; }
  .chat-msg-executed { background:rgba(0,255,154,0.06); border:1px solid rgba(0,255,154,0.2); color:var(--green); align-self:flex-start; font-size:11px; font-weight:600; padding:6px 10px; border-radius:8px; }
  .chat-msg-confirm  { background:rgba(255,181,71,0.08); border:1px solid rgba(255,181,71,0.25); color:var(--yellow); align-self:flex-start; font-size:12px; border-radius:8px; padding:8px 12px; }
  .chat-confirm-btns { display:flex; gap:8px; margin-top:8px; }
  .chat-confirm-yes { background:rgba(0,255,154,0.15); border:1px solid rgba(0,255,154,0.3); color:var(--green); padding:5px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700; }
  .chat-confirm-no  { background:rgba(255,77,106,0.1);  border:1px solid rgba(255,77,106,0.3); color:var(--red);   padding:5px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700; }
  .chat-typing { align-self:flex-start; color:var(--muted); font-size:12px; padding:8px 12px; font-style:italic; }
  .chat-input-wrap { padding:10px 12px; border-top:1px solid rgba(0,212,255,0.1); display:flex; gap:8px; }
  .chat-input { flex:1; background:rgba(0,0,0,0.3); border:1px solid var(--border); border-radius:10px; color:var(--text); font-size:13px; padding:9px 13px; outline:none; resize:none; max-height:80px; font-family:inherit; }
  .chat-input:focus { border-color:rgba(0,212,255,0.4); }
  .chat-send-btn { background:linear-gradient(135deg,var(--blue),var(--purple)); border:none; border-radius:10px; color:#fff; padding:9px 14px; cursor:pointer; font-size:14px; transition:opacity 0.15s; flex-shrink:0; }
  .chat-send-btn:hover { opacity:0.85; }
  .chat-suggestions { display:flex; gap:6px; padding:0 12px 8px; flex-wrap:wrap; }
  .chat-suggest-btn { background:rgba(0,212,255,0.08); border:1px solid rgba(0,212,255,0.2); color:var(--blue); font-size:11px; padding:4px 10px; border-radius:20px; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
  .chat-suggest-btn:hover { background:rgba(0,212,255,0.15); }
  @media(max-width:768px) {
    .chat-panel { bottom:0; right:0; left:0; width:100%; max-height:85vh; border-radius:20px 20px 0 0; border-bottom:none; }
    .chat-bubble { bottom:16px; right:16px; }
  }

  /* ── Portfolio Intelligence ── */
  .portfolio-panel { background:var(--glass-bg); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-bottom:24px; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  .portfolio-header-bar { display:flex; align-items:center; justify-content:space-between; padding-bottom:14px; margin-bottom:14px; border-bottom:1px solid var(--border); gap:20px; flex-wrap:wrap; }
  .portfolio-hero-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; font-weight:600; margin-bottom:4px; }
  .portfolio-hero-value { font-size:26px; font-weight:900; font-variant-numeric:tabular-nums; transition:color 0.4s ease; line-height:1; }
  .portfolio-hero-change { font-size:14px; font-weight:700; }
  @media(max-width:600px) { .portfolio-header-bar { flex-direction:column; align-items:flex-start; gap:12px; } .portfolio-header-bar > div:last-child { text-align:left !important; width:100%; } }
  .portfolio-top { display:grid; grid-template-columns:auto 1fr; gap:24px; align-items:start; margin-bottom:16px; }
  .portfolio-score-ring { display:flex; flex-direction:column; align-items:center; justify-content:center; width:100px; height:100px; border-radius:50%; border:4px solid var(--blue); box-shadow:0 0 20px var(--glow-blue); }
  .portfolio-score-num { font-size:28px; font-weight:900; color:var(--blue); line-height:1; }
  .portfolio-score-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-top:2px; }
  .portfolio-metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  .pm-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
  .pm-value { font-size:16px; font-weight:700; }
  .pm-sub   { font-size:11px; color:var(--muted); margin-top:2px; }
  .alloc-bar-wrap { margin-top:14px; }
  .alloc-bar-labels { display:flex; justify-content:space-between; font-size:11px; margin-bottom:5px; }
  .alloc-bar-track { height:10px; background:rgba(255,255,255,0.06); border-radius:5px; overflow:hidden; display:flex; }
  .alloc-usd  { background:linear-gradient(90deg,var(--blue),#00A3C4); transition:width 0.5s; }
  .alloc-xrp  { background:linear-gradient(90deg,var(--purple),#5A3FCC); transition:width 0.5s; }
  .alloc-risk { background:rgba(255,77,106,0.6); transition:width 0.5s; }
  @media(max-width:768px) { .portfolio-top { grid-template-columns:1fr; } .portfolio-metrics { grid-template-columns:repeat(2,1fr); } }

  /* ── Capital Router ── */
  .capital-panel { background:var(--glass-bg); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-bottom:24px; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  .capital-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .capital-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted); }
  .capital-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
  .capital-item-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
  .capital-item-value { font-size:18px; font-weight:700; }
  .capital-item-sub   { font-size:11px; color:var(--muted); margin-top:3px; }
  .capital-bar-wrap { margin-bottom:14px; }
  .capital-bar-labels { display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-bottom:4px; }
  .capital-bar-track { height:8px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden; display:flex; }
  .capital-bar-active  { background:linear-gradient(90deg,var(--blue),var(--purple)); border-radius:4px 0 0 4px; transition:width 0.5s; }
  .capital-bar-reserve { background:rgba(139,148,158,0.3); border-radius:0 4px 4px 0; }
  .capital-controls { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .capital-role-btn { padding:5px 12px; font-size:11px; font-weight:700; border-radius:4px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; transition:all 0.15s; }
  .capital-role-btn.active-role { background:rgba(0,212,255,0.12); color:var(--blue); border-color:rgba(0,212,255,0.3); }
  .capital-role-btn:hover { border-color:var(--blue); color:var(--blue); }
  .capital-danger { border-color:rgba(255,77,106,0.3) !important; color:var(--red) !important; }
  @media(max-width:768px) { .capital-grid { grid-template-columns:repeat(2,1fr); } }

  /* ── Performance Panel (3.0) ── */
  .perf-panel { background:var(--glass-bg); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-bottom:24px; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  .perf-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
  .perf-item-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
  .perf-item-value { font-size:20px; font-weight:700; }
  .perf-item-sub   { font-size:11px; color:var(--muted); margin-top:3px; }
  .perf-adaptations { display:flex; gap:8px; flex-wrap:wrap; padding:10px 14px; background:rgba(0,0,0,0.2); border-radius:6px; }
  .perf-adapt-badge { font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; }
  .adapt-default { background:rgba(139,148,158,0.1); color:var(--muted); border:1px solid var(--border); }
  .adapt-warn    { background:rgba(255,181,71,0.12);  color:var(--yellow); border:1px solid rgba(255,181,71,0.3); }
  .adapt-danger  { background:rgba(255,77,106,0.12);  color:var(--red);    border:1px solid rgba(255,77,106,0.3); }
  .adapt-good    { background:rgba(0,255,154,0.1);    color:var(--green);  border:1px solid rgba(0,255,154,0.3); }
  /* Decision log */
  .decision-log-box { background:rgba(0,0,0,0.3); border:1px solid var(--border); border-radius:6px; padding:12px 14px; font-family:monospace; font-size:12px; color:var(--muted); line-height:1.8; margin-top:12px; }
  .decision-log-box .dl-trade { color:var(--green); font-weight:700; }
  .decision-log-box .dl-skip  { color:var(--red);   font-weight:700; }
  @media(max-width:768px) { .perf-grid { grid-template-columns:repeat(2,1fr); } }

  /* ── Bot Controls ── */
  .ctrl-panel { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-bottom:24px; }
  .ctrl-panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
  .ctrl-panel-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted); }
  .ctrl-status-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
  .ctrl-badge { font-size:11px; font-weight:700; border-radius:4px; padding:3px 10px; border:1px solid; }
  .ctrl-badge-green  { background:rgba(63,185,80,0.12);  color:var(--green);  border-color:rgba(63,185,80,0.3); }
  .ctrl-badge-red    { background:rgba(248,81,73,0.12);  color:var(--red);    border-color:rgba(248,81,73,0.3); }
  .ctrl-badge-yellow { background:rgba(210,153,34,0.12); color:var(--yellow); border-color:rgba(210,153,34,0.3); }
  .ctrl-badge-muted  { background:rgba(139,148,158,0.1); color:var(--muted);  border-color:var(--border); }
  .ctrl-badge-blue   { background:rgba(88,166,255,0.12); color:var(--blue);   border-color:rgba(88,166,255,0.3); }
  .ctrl-groups { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
  .ctrl-group-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); margin-bottom:8px; }
  .ctrl-btns { display:flex; flex-direction:column; gap:6px; }
  .ctrl-btn { padding:8px 14px; font-size:12px; font-weight:600; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--text); cursor:pointer; text-align:left; transition:all 0.15s; }
  .ctrl-btn:hover { border-color:var(--blue); color:var(--blue); }
  .ctrl-btn-danger:hover  { border-color:var(--red);    color:var(--red); }
  .ctrl-btn-success:hover { border-color:var(--green);  color:var(--green); }
  .ctrl-btn-warn:hover    { border-color:var(--yellow); color:var(--yellow); }
  /* Active-state highlights for current settings */
  .ctrl-btn.is-active-green  { background:rgba(0,255,154,0.12); border-color:rgba(0,255,154,0.5); color:var(--green); box-shadow:0 0 12px rgba(0,255,154,0.15); }
  .ctrl-btn.is-active-red    { background:rgba(255,77,106,0.12); border-color:rgba(255,77,106,0.5); color:var(--red);   box-shadow:0 0 12px rgba(255,77,106,0.15); }
  .ctrl-btn.is-active-yellow { background:rgba(255,181,71,0.12); border-color:rgba(255,181,71,0.5); color:var(--yellow); box-shadow:0 0 12px rgba(255,181,71,0.15); }
  .ctrl-btn.is-active-blue   { background:rgba(0,212,255,0.12);  border-color:rgba(0,212,255,0.5); color:var(--blue);   box-shadow:0 0 12px rgba(0,212,255,0.15); }
  .ctrl-btn.is-active-green::after,
  .ctrl-btn.is-active-red::after,
  .ctrl-btn.is-active-yellow::after,
  .ctrl-btn.is-active-blue::after { content:" ✓ active"; font-size:10px; font-weight:700; opacity:0.8; margin-left:4px; }
  .ctrl-input-row { display:flex; gap:6px; align-items:center; }
  .ctrl-input { width:64px; background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); font-size:13px; font-weight:600; padding:7px 10px; outline:none; }
  .ctrl-input:focus { border-color:var(--blue); }
  @media(max-width:700px) { .ctrl-groups { grid-template-columns:1fr 1fr; } }

  /* ── Open Position Card ── */
  .position-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px; }
  .position-card.pos-open { border-color: rgba(88,166,255,0.4); background: rgba(88,166,255,0.04); }
  .position-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .position-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted); }
  .position-badge-open   { font-size:11px; font-weight:700; background:rgba(88,166,255,0.15); color:var(--blue); border:1px solid rgba(88,166,255,0.3); border-radius:4px; padding:2px 8px; }
  .position-badge-closed { font-size:11px; font-weight:700; background:rgba(139,148,158,0.1); color:var(--muted); border:1px solid var(--border); border-radius:4px; padding:2px 8px; }
  .position-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:16px; }
  .position-item-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px; }
  .position-item-value { font-size:18px; font-weight:700; }
  .position-item-sub   { font-size:11px; color:var(--muted); margin-top:3px; }
  .position-bar-wrap { margin-top:4px; }
  .position-bar-label { display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-bottom:5px; }
  .position-bar-track { height:6px; background:var(--border); border-radius:3px; position:relative; overflow:visible; }
  .position-bar-fill  { height:100%; border-radius:3px; transition:width 0.4s; }
  .position-bar-marker { position:absolute; top:-3px; width:2px; height:12px; background:var(--text); border-radius:1px; }
  .position-no-trade { color:var(--muted); font-size:13px; text-align:center; padding:12px 0; }
  @media (max-width:700px) { .position-grid { grid-template-columns:repeat(2,1fr); } }

  /* ── Paper Portfolio Wallet ── */
  .paper-wallet { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px; }
  .paper-wallet-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
  .paper-wallet-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted); }
  .paper-wallet-badge { font-size:11px; font-weight:700; background:rgba(210,153,34,0.15); color:var(--yellow); border:1px solid rgba(210,153,34,0.3); border-radius:4px; padding:2px 8px; }
  .paper-wallet-row { display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-bottom:16px; }
  .paper-wallet-item {}
  .paper-wallet-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px; }
  .paper-wallet-value { font-size:20px; font-weight:700; }
  .paper-wallet-sub { font-size:11px; color:var(--muted); margin-top:3px; }
  .paper-wallet-divider { border:none; border-top:1px solid var(--border); margin:14px 0; }
  .paper-wallet-footer { display:flex; align-items:center; justify-content:space-between; }
  .paper-wallet-total-label { font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
  .paper-wallet-total-value { font-size:26px; font-weight:700; }
  .paper-wallet-pnl { font-size:13px; font-weight:600; }
  @media (max-width: 700px) { .paper-wallet-row { grid-template-columns: repeat(2,1fr); } }

  /* ── P&L ── */
  .pnl-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
  .pnl-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; }
  .pnl-label { font-size: 12px; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .pnl-value { font-size: 24px; font-weight: 700; line-height: 1; }
  .pnl-sub   { font-size: 12px; color: var(--muted); margin-top: 5px; }
  .pnl-pos { color: var(--green); } .pnl-neg { color: var(--red); } .pnl-zero { color: var(--muted); }
  @media (max-width: 900px) { .pnl-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 600px) { .pnl-grid { grid-template-columns: repeat(2, 1fr); } }

  @media (max-width: 768px) {
    .stats-grid  { grid-template-columns: repeat(2, 1fr); }
    .pnl-grid    { grid-template-columns: repeat(2, 1fr); }
    .mid-grid    { grid-template-columns: 1fr; }
    #chart-container { height: 300px; }
    nav { padding: 0 14px; }
    main { padding: 14px; }
    .health-strip { padding: 6px 14px; gap: 14px; }
    .balance-card { flex-direction: column; align-items: flex-start; }
    .balance-total { border-left: none; border-top: 1px solid var(--border); padding: 8px 0 0; margin: 8px 0 0; }
    .stat-value { font-size: 22px; }
    .pnl-value  { font-size: 20px; }
    table { font-size: 12px; }
    th, td { padding: 8px 10px; }
  }

  /* ── Compact Trader Bar ── */
  .health-strip {
    background: rgba(18,26,42,0.85); backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    padding: 8px 24px; display: flex; align-items: center; gap: 20px;
    font-size: 12px; color: var(--muted); flex-wrap: wrap;
  }
  .health-item { display: flex; align-items: center; gap: 6px; }
  .h-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .h-dot-green  { background: var(--green); box-shadow: 0 0 5px var(--green); }
  .h-dot-yellow { background: var(--yellow); }
  .h-dot-red    { background: var(--red); animation: pulse 1.5s infinite; }
  .countdown-val { font-weight: 700; color: var(--blue); }
  /* Live status items */
  .live-status-item { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; }
  .regime-trending { background:rgba(0,212,255,0.1); color:var(--blue); border:1px solid rgba(0,212,255,0.2); }
  .regime-range    { background:rgba(255,181,71,0.1); color:var(--yellow); border:1px solid rgba(255,181,71,0.2); }
  .regime-volatile { background:rgba(255,77,106,0.1); color:var(--red);    border:1px solid rgba(255,77,106,0.2); }
  .confidence-bar-wrap { display:flex; align-items:center; gap:6px; }
  .confidence-bar { height:4px; width:60px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden; }
  .confidence-bar-fill { height:100%; border-radius:2px; transition:width 0.5s; }
  /* RSI section toggle */
  .section-collapsible { cursor:pointer; user-select:none; }
  .section-collapsible:hover { color:var(--text); }
  .collapse-icon { font-size:10px; margin-left:4px; transition:transform 0.2s; }
  .collapsed .collapse-icon { transform:rotate(-90deg); }

  /* ── RSI History ── */
  .rsi-history-wrap { display: flex; align-items: flex-end; gap: 5px; height: 90px; position: relative; }
  .rsi-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; height: 100%; justify-content: flex-end; min-width: 24px; }
  .rsi-bar { width: 100%; border-radius: 3px 3px 0 0; min-height: 3px; transition: height 0.3s; }
  .rsi-bar-val { font-size: 9px; color: var(--muted); }
  .rsi-threshold { position: absolute; left: 0; right: 0; border-top: 1px dashed rgba(248,81,73,0.5); pointer-events: none; }
  .rsi-legend { display: flex; gap: 16px; font-size: 11px; color: var(--muted); margin-top: 10px; }
  .rsi-legend-item { display: flex; align-items: center; gap: 5px; }
  .rsi-legend-dot { width: 8px; height: 8px; border-radius: 2px; }

  /* ── Heatmap ── */
  .heatmap-scroll { overflow-x: auto; }
  .heatmap-table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 400px; }
  .heatmap-table th { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); padding: 8px 10px; text-align: center; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .heatmap-table th:first-child { text-align: left; }
  .heatmap-table td { padding: 6px 10px; border-bottom: 1px solid rgba(48,54,61,0.4); text-align: center; }
  .heatmap-table td:first-child { text-align: left; }
  .heatmap-table tr:last-child td { border-bottom: none; }
  .hm-cell { width: 22px; height: 22px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
  .hm-pass { background: rgba(63,185,80,0.2);  color: var(--green); }
  .hm-fail { background: rgba(248,81,73,0.15); color: var(--red); }
  .hm-na   { background: rgba(139,148,158,0.1); color: var(--muted); }
  .hm-time { color: var(--muted); font-size: 11px; white-space: nowrap; }
  .hm-result-pass { color: var(--green); font-weight: 700; font-size: 11px; }
  .hm-result-fail { color: var(--red);   font-weight: 700; font-size: 11px; }

  /* ── Bot Reasoning ── */
  .reasoning-summary {
    font-size: 14px; line-height: 1.65; color: var(--text);
    padding: 14px 16px;
    background: rgba(88,166,255,0.05);
    border: 1px solid rgba(88,166,255,0.15);
    border-radius: 6px;
    margin-bottom: 16px;
  }
  .reasoning-summary strong { color: var(--blue); }
  .run-item { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .run-item:last-child { border-bottom: none; }
  .run-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
  .run-dot-blocked { background: var(--red); }
  .run-dot-traded  { background: var(--green); }
  .run-dot-neutral { background: var(--yellow); }
  .run-time   { font-size: 12px; color: var(--muted); margin-bottom: 3px; }
  .run-reason { font-size: 13px; color: var(--text); }

  /* ── View Toggle ── */
  .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .section-header .section-title { margin-bottom:0; }
  .view-toggle { display:flex; border:1px solid var(--border); border-radius:6px; overflow:hidden; }
  .view-toggle-btn { padding:5px 14px; font-size:12px; font-weight:600; border:none; background:transparent; color:var(--muted); cursor:pointer; transition:all 0.15s; }
  .view-toggle-btn.active { background:var(--blue); color:#fff; }
  /* Confidence dots */
  .conf-dot { display:inline-block; width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-top:5px; }
  .conf-high { background:#3fb950; }
  .conf-med  { background:#d29922; }
  .conf-low  { background:#f85149; }
  /* Simple view items */
  .run-item-simple { display:flex; gap:12px; align-items:flex-start; padding:12px 0; border-bottom:1px solid var(--border); }
  .run-item-simple:last-child { border-bottom:none; }
  .run-simple-body { flex:1; min-width:0; }
  .run-simple-label { font-size:13px; font-weight:700; color:var(--text); margin-bottom:3px; }
  .run-simple-reason { font-size:13px; color:var(--muted); line-height:1.5; }
  .run-simple-time { font-size:11px; color:var(--muted); margin-top:4px; }
  /* Grouped items */
  .run-group-item { display:flex; gap:12px; align-items:flex-start; padding:10px 0; border-bottom:1px solid var(--border); }
  .run-group-item:last-child { border-bottom:none; }
  .run-group-body { flex:1; min-width:0; }
  .run-group-label { font-size:13px; font-weight:700; color:var(--text); margin-bottom:3px; }
  .run-group-detail { font-size:12px; color:var(--muted); line-height:1.5; }
  .run-group-badge { font-size:11px; font-weight:700; background:rgba(248,81,73,0.12); color:var(--red); border-radius:4px; padding:1px 7px; margin-left:6px; vertical-align:middle; }
</style>
</head>
<body>

<!-- Toast Container -->
<div class="toast-container" id="toast-container"></div>

<!-- Confirm Modal -->
<div class="modal-overlay" id="modal-overlay">
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-icon" id="modal-icon">⚠</div>
    <div class="modal-title" id="modal-title">Confirm action</div>
    <div class="modal-msg" id="modal-msg">Are you sure?</div>
    <input class="modal-input" id="modal-input" placeholder="Type CONFIRM" style="display:none">
    <div class="modal-actions">
      <button class="modal-btn modal-btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="modal-btn modal-btn-confirm" id="modal-confirm-btn" onclick="confirmModalAction()">Confirm</button>
    </div>
  </div>
</div>

<!-- Nav Drawer Overlay -->
<div class="nav-drawer-overlay" id="nav-overlay" onclick="closeNav()"></div>

<!-- Nav Drawer -->
<div class="nav-drawer" id="nav-drawer">
  <div class="nav-drawer-header">
    <div class="nav-drawer-logo">⚡ Agent Avila</div>
    <div class="nav-drawer-sub">Adaptive Quant System · v3.0</div>
  </div>
  <div class="nav-drawer-items">
    <div class="nav-section-label">Overview</div>
    <a class="nav-item active" onclick="navTo('section-portfolio')"><span class="nav-item-icon">🧠</span>Portfolio Intelligence</a>
    <a class="nav-item" onclick="navTo('section-capital')"><span class="nav-item-icon">💰</span>Capital Router</a>
    <a class="nav-item" onclick="navTo('section-health')"><span class="nav-item-icon">🩺</span>System Health</a>
    <div class="nav-section-label">Trading</div>
    <a class="nav-item" onclick="navTo('section-position')"><span class="nav-item-icon">📈</span>Open Position</a>
    <a class="nav-item" onclick="navTo('section-terminal')"><span class="nav-item-icon">⚡</span>Trading Terminal</a>
    <a class="nav-item" onclick="navTo('section-chart')"><span class="nav-item-icon">📊</span>Live Chart</a>
    <div class="nav-section-label">Performance</div>
    <a class="nav-item" onclick="navTo('section-performance')"><span class="nav-item-icon">📉</span>Performance State</a>
    <a class="nav-item" onclick="navTo('section-paper')"><span class="nav-item-icon">🏦</span>Paper Portfolio</a>
    <div class="nav-section-label">History & Controls</div>
    <a class="nav-item" onclick="navTo('section-history')"><span class="nav-item-icon">📜</span>Trade History</a>
    <a class="nav-item" onclick="navTo('section-controls')"><span class="nav-item-icon">🎛</span>Bot Controls</a>
    <a class="nav-item" onclick="navTo('section-risk')"><span class="nav-item-icon">🛑</span>Risk Controls</a>
  </div>
  <div class="nav-drawer-footer">
    <span style="font-size:11px;color:var(--muted)"><span class="nav-health-dot" id="nav-drawer-health-dot" style="background:var(--green)"></span>System operational</span>
  </div>
</div>

<nav>
  <div class="nav-left">
    <button class="hamburger" onclick="toggleNav()" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
    <span class="nav-title">Agent Avila</span>
    <span class="badge badge-symbol" id="nav-symbol">—</span>
    <span class="badge" id="nav-mode">—</span>
  </div>
  <div class="nav-right">
    <span id="last-updated">Loading...</span>
    <span class="dot"></span>
    <span style="color:var(--green);font-size:12px;font-weight:600">LIVE</span>
    <a href="/logout" style="color:var(--muted);font-size:12px;text-decoration:none;margin-left:8px;padding:4px 10px;border:1px solid var(--border);border-radius:6px" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">Sign out</a>
  </div>
</nav>

<div class="tab-strip">
  <button class="tab-btn active" id="tab-dashboard" onclick="switchTab('dashboard')">📊 Dashboard</button>
  <button class="tab-btn" id="tab-info" onclick="switchTab('info')">⚡ Agent 3.0</button>
</div>

<!-- Info Page -->
<div class="info-page" id="info-page">
  <div class="info-hero">
    <h1 style="background:linear-gradient(90deg,#00D4FF,#7C5CFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">⚡ Agent Avila — System Evolution Log</h1>
    <p>Agent Avila is a <strong style="color:var(--text)">deterministic, rule-based trading engine with adaptive parameters</strong> driven by measurable performance metrics. Not AI — a statistical adaptive execution engine that changes behavior based on win rate, drawdown, market regime, and volatility.</p>
  </div>

  <div class="info-section">
    <h2>📋 Version History</h2>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="info-card" style="border-color:rgba(139,148,158,0.2)">
        <div class="info-card-label" style="color:var(--muted)">Agent 1.0 — Entry Bot (initial)</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-top:6px">4-condition hard lock · Fixed $8.50 size · No exit logic · No leverage · No mobile support</div>
      </div>
      <div class="info-card" style="border-color:rgba(0,212,255,0.15)">
        <div class="info-card-label" style="color:var(--blue)">Agent 1.1 — Full Trading System</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-top:6px">Exit strategy (SL/TP) · Leverage 2x with volatility guard · Liquidation protection · Simple/Advanced toggle · Paper portfolio tracking</div>
      </div>
      <div class="info-card" style="border-color:rgba(124,92,255,0.2)">
        <div class="info-card-label" style="color:var(--purple)">Agent 2.0 — Leverage Risk Engine</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-top:6px">Score ≥75/100 entry system · Dynamic position sizing · Adaptive SL/TP by volatility · Breakeven +trail stop · Re-entry logic · Dark Pro theme · Mobile layout</div>
      </div>
      <div class="info-card" style="border-color:rgba(0,255,154,0.2)">
        <div class="info-card-label" style="color:var(--green)">Agent 3.0 — Adaptive Quant System</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-top:6px">Performance feedback loop · EMA slope regime detection · Adaptive entry threshold (70–85) · Timed pauses · Capital Router (70/30) · Portfolio Intelligence panel · Decision logger</div>
      </div>
      <div class="info-card" style="border-color:rgba(0,212,255,0.3);box-shadow:0 0 15px rgba(0,212,255,0.08)">
        <div class="info-card-label" style="color:var(--blue)">⚡ Agent Avila (Current) — Full Trading Platform</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-top:6px">Hero Live Ticker · Portfolio Intelligence · Capital Router · Trading Terminal · Bot Controls · Chat Assistant · System Health Monitor · Nav drawer · Live Railway deployment · Engagement animations</div>
      </div>
    </div>
  </div>

  <div class="info-section">
    <h2>🎛 What's On Your Dashboard</h2>
    <div class="info-step">
      <div class="info-step-num">⚡</div>
      <div class="info-step-body">
        <h3>Hero Live Ticker (top of page)</h3>
        <p>Big animated XRP price with up/down arrows that bounce on each tick. Shows session P&L %, 24h price range, and a pulsing LIVE indicator. Updates sub-second from Kraken WebSocket — no polling.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🩺</div>
      <div class="info-step-body">
        <h3>System Health Monitor</h3>
        <p>4-card status grid: Kraken API (online + latency), WebSocket Feed (connected/reconnecting), Data Freshness (minutes since last bot run), and Bot Engine (running/stale). Auto-checks every 30 seconds.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🧠</div>
      <div class="info-step-body">
        <h3>Portfolio Intelligence Panel</h3>
        <p>Glowing health ring (0–100 composite score) with system status. Shows Open Risk %, Unrealized P&L, Realized P&L, Efficiency Score, Total Balance, Drawdown. Allocation bar shows USD/XRP/at-risk split.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">💰</div>
      <div class="info-step-body">
        <h3>Capital Router</h3>
        <p>Enforces 70/30 active/reserve capital split. XRP is locked to HOLD_ASSET — never traded. Auto-conversion is OFF by default. Three role buttons (HOLD/ACTIVE/AGGRESSIVE) with confirmation gate on the dangerous one.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">📊</div>
      <div class="info-step-body">
        <h3>Performance State Panel</h3>
        <p>Live win rate, profit factor, R-ratio, drawdown — all color-coded. Adaptation badges show what the bot is doing right now: tightening on losses, loosening on wins, locking leverage on streaks.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🎛</div>
      <div class="info-step-body">
        <h3>Bot Controls + Trading Terminal</h3>
        <p>Bot Controls = software-side commands (START/STOP, PAUSE/RESUME, set risk %, set leverage, mode toggle). Trading Terminal = manual market actions (BUY MARKET, OPEN LONG, CLOSE POSITION, SELL ALL, manually set SL/TP). Live mode requires typed CONFIRM.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">📈</div>
      <div class="info-step-body">
        <h3>Open Position Card (with glow)</h3>
        <p>Entry price, current price, live P&L, time in trade, risk $ if stopped. Visual progress bar between SL ←→ TP with entry marker. Card glows green when profitable, red when underwater, blue when neutral.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">⚡</div>
      <div class="info-step-body">
        <h3>Chat Assistant (bottom right ⚡ bubble)</h3>
        <p>Powered by Claude. Asks questions about your bot, explains decisions, runs commands. Try: "Why did the bot skip?" "What's my exposure?" "Reduce risk to 0.5%". Safe commands auto-execute; live trades require confirmation.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">📜</div>
      <div class="info-step-body">
        <h3>Trade History + Decision Log</h3>
        <p>Every run is logged with full reasoning: signal score breakdown (EMA +30, RSI +28, VWAP +20, etc.), regime, leverage used, threshold applied, and why a trade fired or was skipped. Toggle Simple/Advanced view at the top.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">☰</div>
      <div class="info-step-body">
        <h3>Nav Drawer (top-left hamburger)</h3>
        <p>Slide-in navigation organized into Overview, Trading, Performance, History & Controls. Click any item to smooth-scroll to that section. Mobile-friendly.</p>
      </div>
    </div>
  </div>

  <div class="info-section">
    <h2>🌐 Where Agent Avila Runs</h2>
    <div class="info-cards" style="grid-template-columns:repeat(2,1fr)">
      <div class="info-card">
        <div class="info-card-icon">💻</div>
        <div class="info-card-label">Local Mac</div>
        <div class="info-card-value" style="font-size:14px">localhost:3000</div>
        <div class="info-card-sub">Cron runs bot every 5 min · Dashboard reads local files</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">☁️</div>
        <div class="info-card-label">Railway (Cloud)</div>
        <div class="info-card-value" style="font-size:13px">agent-avila-dashboard-production.up.railway.app</div>
        <div class="info-card-sub">Dashboard live publicly · Bot runs on Railway cron</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">📦</div>
        <div class="info-card-label">GitHub</div>
        <div class="info-card-value" style="font-size:14px">github.com/relentlessvic/agent-avila</div>
        <div class="info-card-sub">All code version-controlled, pushable from Mac</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">🔑</div>
        <div class="info-card-label">Kraken</div>
        <div class="info-card-value" style="font-size:14px">XRP/USD margin enabled</div>
        <div class="info-card-sub">Up to 10x leverage available, capped at 3x</div>
      </div>
    </div>
  </div>

  <div class="info-alert" style="background:rgba(0,212,255,0.06);border-color:rgba(0,212,255,0.2)">
    <strong style="color:var(--blue)">📋 Currently in Paper Trading Mode</strong> — No real money is being used. Running on a simulated $100 account to validate performance before going live.
  </div>

  <div class="info-section">
    <h2>📊 Evolution Map</h2>
    <div class="info-cards" style="grid-template-columns:repeat(3,1fr)">
      <div class="info-card">
        <div class="info-card-label" style="color:var(--muted)">Agent 1.1</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;margin-top:8px">
          4-condition hard lock<br>Fixed $8.50 size<br>Static SL/TP<br>No exit logic<br>No leverage control
        </div>
      </div>
      <div class="info-card" style="border-color:rgba(0,212,255,0.2)">
        <div class="info-card-label" style="color:var(--blue)">Agent 2.0</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;margin-top:8px">
          Score ≥ 75/100<br>Dynamic sizing<br>Adaptive SL/TP<br>Breakeven + trail stop<br>Regime-aware leverage
        </div>
      </div>
      <div class="info-card" style="border-color:rgba(0,255,154,0.2)">
        <div class="info-card-label" style="color:var(--green)">Agent 3.0 ← You are here</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;margin-top:8px">
          Performance feedback loop<br>EMA slope regime detection<br>Adaptive thresholds + risk<br>Timed pauses (not indefinite)<br>Decision logger
        </div>
      </div>
    </div>
  </div>

  <div class="info-alert">
    <strong>⚠️ Currently in Paper Trading Mode</strong> — No real money is being used. The bot is running on a simulated $100 account so you can see exactly how it performs before going live.
  </div>

  <div class="info-section">
    <h2>📋 How Agent 3.0 Works — Step by Step</h2>
    <div class="info-step">
      <div class="info-step-num">1</div>
      <div class="info-step-body">
        <h3>Every 5 min: manage trade OR find entry</h3>
        <p>If a position is open → check stop loss, take profit, breakeven, trail stop, and re-entry quality. If no position → run all entry guards and evaluate the signal score.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">2</div>
      <div class="info-step-body">
        <h3>Classify market regime (TRENDING / RANGE / VOLATILE)</h3>
        <p>Uses EMA slope to distinguish trending from ranging markets. VOLATILE (candle spike &gt; 2× ATR) blocks the trade entirely. Regime sets the leverage and SL/TP automatically.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">3</div>
      <div class="info-step-body">
        <h3>Load performance state and apply adaptations</h3>
        <p>Before entering, the bot checks its own win rate, drawdown, and streak. If performance is poor, it raises the entry bar. If drawdown &gt; 3%, it cuts trade size by half. If 2 losses in a row, leverage is locked for 30 minutes.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">4</div>
      <div class="info-step-body">
        <h3>Score the signal (0–100). Trade if ≥ adapted threshold</h3>
        <p>EMA uptrend (+30), RSI dip below 35 (+30), VWAP support (+20), not overextended (+20). Default threshold is 75. Poor win rate raises it to 85. Good win rate drops it to 70.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">5</div>
      <div class="info-step-body">
        <h3>Set SL/TP/leverage from regime, enter trade</h3>
        <p>TRENDING: 2× leverage, 1.25% SL, 2% TP. RANGE: 1× leverage, 1.0% SL, 1.5% TP. Position size = dollar risk ÷ SL distance (not a fixed amount).</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">6</div>
      <div class="info-step-body">
        <h3>Active trade management until exit</h3>
        <p>Every 5 min while in a trade: move SL to breakeven at +1% profit, activate trailing stop at +1.5%. Exit on SL hit, TP hit, or if a significantly better signal appears (score improvement &gt; 20 pts).</p>
      </div>
    </div>
  </div>

  <div class="info-section">
    <h2>📊 Performance Feedback Rules (Exact Logic)</h2>
    <div class="info-cards" style="grid-template-columns:repeat(2,1fr)">
      <div class="info-card">
        <div class="info-card-label" style="color:var(--red)">🔴 Tighten when struggling</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;margin-top:8px">
          Win rate &lt; 45% → raise threshold to 85<br>
          2 consecutive losses → lock leverage 30 min<br>
          3 consecutive losses → pause trading 60 min<br>
          Drawdown &gt; 2% → force leverage 1×<br>
          Drawdown &gt; 3% → cut risk by 50%<br>
          Drawdown ≥ 5% → kill switch activated
        </div>
      </div>
      <div class="info-card">
        <div class="info-card-label" style="color:var(--green)">🟢 Loosen when performing</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;margin-top:8px">
          Win rate &gt; 65% → lower threshold to 70<br>
          Profit factor &gt; 1.5 → increase size max +10%<br>
          Timed pauses auto-expire (no manual reset needed)<br>
          Leverage lock auto-clears after 30 min
        </div>
      </div>
    </div>
  </div>

  <div class="info-section">
    <h2>⚙️ Current Settings</h2>
    <div class="info-cards">
      <div class="info-card">
        <div class="info-card-icon">💱</div>
        <div class="info-card-label">Trading Pair</div>
        <div class="info-card-value">XRP / USD</div>
        <div class="info-card-sub">Kraken exchange</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">⏱</div>
        <div class="info-card-label">Check Frequency</div>
        <div class="info-card-value">Every 5 min</div>
        <div class="info-card-sub">288 checks/day</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">📊</div>
        <div class="info-card-label">Entry Score</div>
        <div class="info-card-value">≥ 75 / 100</div>
        <div class="info-card-sub">adapts 70–85</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">💵</div>
        <div class="info-card-label">Risk Per Trade</div>
        <div class="info-card-value">1% of balance</div>
        <div class="info-card-sub">dynamic sizing</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">🛑</div>
        <div class="info-card-label">Stop Loss</div>
        <div class="info-card-value">1.0–1.25%</div>
        <div class="info-card-sub">regime-based</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">🎯</div>
        <div class="info-card-label">Take Profit</div>
        <div class="info-card-value">1.5–2.0%</div>
        <div class="info-card-sub">regime-based</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">⚡</div>
        <div class="info-card-label">Leverage</div>
        <div class="info-card-value">1–2× (regime)</div>
        <div class="info-card-sub">3× hard cap</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">🏦</div>
        <div class="info-card-label">Paper Budget</div>
        <div class="info-card-value">$100</div>
        <div class="info-card-sub">mirrors live deposit</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">📉</div>
        <div class="info-card-label">Kill Switch</div>
        <div class="info-card-value">5% drawdown</div>
        <div class="info-card-sub">halts all trading</div>
      </div>
    </div>
  </div>

  <div class="info-section">
    <h2>🚦 Reading the Dashboard</h2>
    <div class="info-step">
      <div class="info-step-num">📊</div>
      <div class="info-step-body">
        <h3>Performance State panel</h3>
        <p>Shows win rate, profit factor, R-ratio, and drawdown. Adaptation badges below it tell you exactly what the bot has changed and why — e.g. "Threshold 85 (low win rate)" or "Risk 50% (drawdown guard)".</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🧠</div>
      <div class="info-step-body">
        <h3>Compact Trader Bar (top strip)</h3>
        <p>Live market regime badge (📈 TRENDING / ↔️ RANGE / ⚡ VOLATILE), signal confidence bar (0–100), active leverage, and current mode. Updates in real time from Kraken's WebSocket feed.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🔍</div>
      <div class="info-step-body">
        <h3>Decision Log in Safety Check</h3>
        <p>Every run logs a structured explanation: what each condition scored, the total, the threshold used, and whether a trade fired. This is the "why" behind every decision — not a label, the actual numbers.</p>
      </div>
    </div>
    <div class="info-step">
      <div class="info-step-num">🔵</div>
      <div class="info-step-body">
        <h3>Simple View vs Advanced View</h3>
        <p>Toggle at the top of Trade History. Simple View uses plain language for all sections. Advanced View shows raw numbers, RSI values, and technical labels. Both views update live.</p>
      </div>
    </div>
  </div>
</div>

<div id="dashboard-page">
<div class="health-strip">
  <div class="health-item">
    <div class="h-dot h-dot-green" id="health-dot"></div>
    <span id="health-last-run" style="color:var(--text)">—</span>
  </div>
  <div class="health-item">
    ⏱ <span class="countdown-val" id="next-run-countdown">—</span>
  </div>
  <div class="health-item" id="live-regime-item" style="display:none">
    <span class="live-status-item regime-range" id="live-regime">— RANGE</span>
  </div>
  <div class="health-item" id="live-confidence-item" style="display:none">
    <span style="color:var(--muted)">Score</span>
    <div class="confidence-bar-wrap">
      <div class="confidence-bar"><div class="confidence-bar-fill" id="live-confidence-bar" style="width:0%;background:var(--blue)"></div></div>
      <span id="live-confidence-val" style="font-weight:700;color:var(--blue)">—</span>
    </div>
  </div>
  <div class="health-item" id="live-leverage-item" style="display:none">
    <span class="live-status-item" id="live-leverage-badge" style="background:rgba(124,92,255,0.1);color:var(--purple);border:1px solid rgba(124,92,255,0.2)">—</span>
  </div>
  <div class="health-item" style="margin-left:auto">
    <span id="live-mode-bar" style="font-size:11px;font-weight:600;color:var(--muted)">📋 PAPER · 5m · XRPUSDT</span>
  </div>
</div>

<main>

  <!-- Hero Live Ticker -->
  <div class="hero-ticker">
    <div class="ticker-left">
      <div class="ticker-symbol-icon">X</div>
      <div>
        <div class="ticker-pair">XRP / USD · Live</div>
        <div style="display:flex;align-items:baseline;gap:10px">
          <span class="ticker-price skeleton" id="ticker-price">$—.——</span>
          <span class="ticker-arrow" id="ticker-arrow">—</span>
        </div>
      </div>
    </div>
    <div class="ticker-right">
      <div class="ticker-stat" style="text-align:left">
        <div class="ticker-stat-label">Live Trend</div>
        <svg id="ticker-sparkline" width="120" height="28" style="display:block;margin-top:2px"></svg>
      </div>
      <div class="ticker-stat">
        <div class="ticker-stat-label">Session P&L</div>
        <div class="ticker-stat-value" id="ticker-pnl" style="color:var(--muted)">—</div>
      </div>
      <div class="ticker-stat">
        <div class="ticker-stat-label">24h Range</div>
        <div class="ticker-stat-value" id="ticker-range" style="font-size:13px">—</div>
      </div>
      <div class="ticker-stat" style="text-align:right">
        <div class="ticker-stat-label">Status</div>
        <div style="display:flex;align-items:center;justify-content:flex-end">
          <span class="ticker-pulse-dot"></span>
          <span class="ticker-live-label">LIVE</span>
        </div>
      </div>
    </div>
  </div>

  <!-- System Health -->
  <div class="section-title" id="section-health">🩺 System Health</div>
  <div class="health-monitor">
    <div class="health-grid">
      <div class="health-check-item">
        <div class="health-check-icon">🌐</div>
        <div class="health-check-label">Kraken API</div>
        <div class="health-check-status" id="hc-api">Checking...</div>
        <div style="font-size:10px;color:var(--muted)" id="hc-api-latency">—</div>
      </div>
      <div class="health-check-item">
        <div class="health-check-icon">📡</div>
        <div class="health-check-label">WebSocket Feed</div>
        <div class="health-check-status" id="hc-ws">Connecting...</div>
        <div style="font-size:10px;color:var(--muted)" id="hc-ws-detail">—</div>
      </div>
      <div class="health-check-item">
        <div class="health-check-icon">⏱</div>
        <div class="health-check-label">Data Freshness</div>
        <div class="health-check-status" id="hc-data">—</div>
        <div style="font-size:10px;color:var(--muted)" id="hc-data-age">—</div>
      </div>
      <div class="health-check-item">
        <div class="health-check-icon">🤖</div>
        <div class="health-check-label">Bot Engine</div>
        <div class="health-check-status" id="hc-bot">—</div>
        <div style="font-size:10px;color:var(--muted)" id="hc-bot-detail">—</div>
      </div>
    </div>
  </div>

  <!-- Portfolio Intelligence -->
  <div class="section-title" id="section-portfolio">Portfolio Intelligence</div>
  <div class="portfolio-panel">
    <div class="portfolio-header-bar">
      <div>
        <div class="portfolio-hero-label">Total Portfolio Value</div>
        <div style="display:flex;align-items:baseline;gap:10px">
          <span class="portfolio-hero-value" id="port-hero-value">$—</span>
          <span class="portfolio-hero-change" id="port-hero-change" style="color:var(--muted)">—</span>
        </div>
      </div>
      <div style="text-align:right">
        <div class="portfolio-hero-label" style="margin-bottom:4px">Live Trend (60 ticks)</div>
        <svg id="portfolio-sparkline" width="180" height="40" style="display:block"></svg>
      </div>
    </div>
    <div class="portfolio-top">
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div class="portfolio-score-ring" id="port-score-ring">
          <span class="portfolio-score-num" id="port-score">—</span>
          <span class="portfolio-score-label">Health</span>
        </div>
        <span style="font-size:11px;color:var(--muted);text-align:center" id="port-score-label">—</span>
      </div>
      <div class="portfolio-metrics">
        <div>
          <div class="pm-label">Open Risk</div>
          <div class="pm-value" id="port-open-risk">—</div>
          <div class="pm-sub">% of balance at risk</div>
        </div>
        <div>
          <div class="pm-label">Unrealized P&amp;L</div>
          <div class="pm-value" id="port-unrealized">—</div>
          <div class="pm-sub">open position</div>
        </div>
        <div>
          <div class="pm-label">Realized P&amp;L</div>
          <div class="pm-value" id="port-realized">—</div>
          <div class="pm-sub">closed trades</div>
        </div>
        <div>
          <div class="pm-label">Efficiency Score</div>
          <div class="pm-value" id="port-efficiency">—</div>
          <div class="pm-sub">profit per unit risk</div>
        </div>
        <div>
          <div class="pm-label">Total Balance</div>
          <div class="pm-value" id="port-total-bal" style="color:var(--blue)">—</div>
          <div class="pm-sub">paper portfolio</div>
        </div>
        <div>
          <div class="pm-label">Drawdown</div>
          <div class="pm-value" id="port-drawdown">—</div>
          <div class="pm-sub">from start</div>
        </div>
      </div>
    </div>
    <div class="alloc-bar-wrap">
      <div class="alloc-bar-labels">
        <span style="color:var(--blue)" id="alloc-usd-label">USD 60%</span>
        <span style="color:var(--purple)" id="alloc-xrp-label">XRP 40%</span>
        <span style="color:var(--red)" id="alloc-risk-label">Open risk 0%</span>
      </div>
      <div class="alloc-bar-track">
        <div class="alloc-usd"  id="alloc-bar-usd"  style="width:60%"></div>
        <div class="alloc-xrp"  id="alloc-bar-xrp"  style="width:40%"></div>
        <div class="alloc-risk" id="alloc-bar-risk" style="width:0%"></div>
      </div>
    </div>
  </div>

  <!-- Capital Router -->
  <div class="section-title" id="section-capital">Capital Router</div>
  <div class="capital-panel">
    <div class="capital-header">
      <span class="capital-title">Portfolio Allocation</span>
      <span id="capital-xrp-badge" class="ctrl-badge ctrl-badge-green">🔒 XRP: HOLD ASSET</span>
    </div>
    <div class="capital-grid">
      <div>
        <div class="capital-item-label">Active Capital (70%)</div>
        <div class="capital-item-value" id="cap-active">—</div>
        <div class="capital-item-sub">available for trading</div>
      </div>
      <div>
        <div class="capital-item-label">Reserve (30%)</div>
        <div class="capital-item-value" id="cap-reserve" style="color:var(--muted)">—</div>
        <div class="capital-item-sub">untouched buffer</div>
      </div>
      <div>
        <div class="capital-item-label">USD Balance</div>
        <div class="capital-item-value" id="cap-usd-total" style="color:var(--blue)">—</div>
        <div class="capital-item-sub">paper trading</div>
      </div>
      <div>
        <div class="capital-item-label">Auto-Convert XRP</div>
        <div class="capital-item-value" id="cap-autoconvert" style="color:var(--muted)">OFF</div>
        <div class="capital-item-sub">safe mode</div>
      </div>
    </div>
    <div class="capital-bar-wrap">
      <div class="capital-bar-labels">
        <span style="color:var(--blue)" id="cap-bar-active-label">Active 70%</span>
        <span id="cap-bar-reserve-label">Reserve 30%</span>
      </div>
      <div class="capital-bar-track">
        <div class="capital-bar-active" id="cap-bar-active" style="width:70%"></div>
        <div class="capital-bar-reserve" style="flex:1"></div>
      </div>
    </div>
    <div class="capital-controls">
      <span style="font-size:11px;color:var(--muted);font-weight:600">XRP ROLE:</span>
      <button class="capital-role-btn active-role" id="cap-btn-hold"    onclick="setCapital('SET_XRP_ROLE','HOLD_ASSET')">🔒 HOLD_ASSET</button>
      <button class="capital-role-btn" id="cap-btn-active"   onclick="setCapital('SET_XRP_ROLE','ACTIVE')">⚡ ACTIVE</button>
      <button class="capital-role-btn capital-danger" id="cap-btn-aggressive" onclick="confirmCapital()">🔥 AGGRESSIVE</button>
      <span style="font-size:11px;color:var(--muted);font-weight:600;margin-left:8px">ACTIVE %:</span>
      <input class="ctrl-input" id="cap-active-pct" type="number" min="10" max="95" step="5" value="70" style="width:56px">
      <button class="ctrl-btn" onclick="setCapital('SET_ACTIVE_PCT', document.getElementById('cap-active-pct').value)">Set</button>
    </div>
  </div>

  <!-- Performance Panel (3.0) -->
  <div class="section-title" id="section-performance">Performance State — Agent 3.0</div>
  <div class="perf-panel">
    <div class="perf-grid">
      <div>
        <div class="perf-item-label">Win Rate</div>
        <div class="perf-item-value" id="perf-winrate">—</div>
        <div class="perf-item-sub" id="perf-wl-detail">no exits yet</div>
      </div>
      <div>
        <div class="perf-item-label">Profit Factor</div>
        <div class="perf-item-value" id="perf-pf">—</div>
        <div class="perf-item-sub" id="perf-pf-sub">gross profit ÷ gross loss</div>
      </div>
      <div>
        <div class="perf-item-label">Avg Profit / Avg Loss</div>
        <div class="perf-item-value" id="perf-avgpl">—</div>
        <div class="perf-item-sub" id="perf-avgpl-sub">—</div>
      </div>
      <div>
        <div class="perf-item-label">Session Drawdown</div>
        <div class="perf-item-value" id="perf-drawdown">—</div>
        <div class="perf-item-sub" id="perf-dd-sub">from starting balance</div>
      </div>
    </div>
    <div class="perf-adaptations" id="perf-adaptations">
      <span class="perf-adapt-badge adapt-default">Loading adaptations...</span>
    </div>
  </div>

  <!-- Bot Controls -->
  <div class="section-title" id="section-controls">Bot Controls</div>
  <div class="ctrl-panel">
    <div class="ctrl-status-row" id="ctrl-status-row">
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-running">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-mode">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-paused">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-killed">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-leverage">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-risk">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-losses">—</span>
      <span class="ctrl-badge ctrl-badge-muted" id="ctrl-badge-cooldown">—</span>
    </div>
    <div class="ctrl-groups" style="grid-template-columns:repeat(4,1fr)">
      <div>
        <div class="ctrl-group-label">Bot State</div>
        <div class="ctrl-btns">
          <button class="ctrl-btn ctrl-btn-success" id="btn-start"   onclick="sendCmd('START_BOT')">▶ START_BOT</button>
          <button class="ctrl-btn ctrl-btn-danger"  id="btn-stop"    onclick="sendCmd('STOP_BOT')">⛔ STOP_BOT</button>
          <button class="ctrl-btn ctrl-btn-warn"    id="btn-pause"   onclick="sendCmd('PAUSE_TRADING')">⏸ PAUSE</button>
          <button class="ctrl-btn ctrl-btn-success" id="btn-resume"  onclick="sendCmd('RESUME_TRADING')">▶ RESUME</button>
        </div>
      </div>
      <div>
        <div class="ctrl-group-label">Trading Mode</div>
        <div class="ctrl-btns">
          <button class="ctrl-btn ctrl-btn-warn"    id="btn-mode-live"  onclick="confirmLive()">🔴 SET_MODE_LIVE</button>
          <button class="ctrl-btn ctrl-btn-success" id="btn-mode-paper" onclick="sendCmd('SET_MODE_PAPER')">📋 SET_MODE_PAPER</button>
        </div>
        <div class="ctrl-group-label" style="margin-top:12px">Resets</div>
        <div class="ctrl-btns">
          <button class="ctrl-btn ctrl-btn-success" onclick="sendCmd('RESET_KILL_SWITCH')">🔓 Reset Kill Switch</button>
          <button class="ctrl-btn ctrl-btn-success" onclick="sendCmd('RESET_LOSSES')">↺ Reset Loss Counter</button>
          <button class="ctrl-btn ctrl-btn-success" onclick="sendCmd('RESET_COOLDOWN')">⏩ Skip Cooldown</button>
        </div>
      </div>
      <div>
        <div class="ctrl-group-label">Risk Settings</div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-leverage-val" type="number" min="1" max="3" value="2">
          <button class="ctrl-btn" style="flex:1" onclick="sendCmd('SET_LEVERAGE', document.getElementById('ctrl-leverage-val').value)">Leverage ×</button>
        </div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-risk-val" type="number" min="0.1" max="5" step="0.1" value="1">
          <button class="ctrl-btn" style="flex:1" onclick="sendCmd('SET_RISK', document.getElementById('ctrl-risk-val').value)">Risk %</button>
        </div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-dailyloss-val" type="number" min="0.5" max="20" step="0.5" value="3">
          <button class="ctrl-btn" style="flex:1" onclick="sendCmd('SET_MAX_DAILY_LOSS', document.getElementById('ctrl-dailyloss-val').value)">Max Daily Loss %</button>
        </div>
      </div>
      <div>
        <div class="ctrl-group-label">2.0 Guards</div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-cooldown-val" type="number" min="0" max="120" step="5" value="15">
          <button class="ctrl-btn" style="flex:1" onclick="sendCmd('SET_COOLDOWN', document.getElementById('ctrl-cooldown-val').value)">Cooldown (min)</button>
        </div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-killpct-val" type="number" min="1" max="50" step="0.5" value="5">
          <button class="ctrl-btn" style="flex:1" onclick="sendCmd('SET_KILL_DRAWDOWN', document.getElementById('ctrl-killpct-val').value)">Kill Switch %</button>
        </div>
        <div class="ctrl-input-row">
          <input class="ctrl-input" id="ctrl-pauselosses-val" type="number" min="1" max="10" value="3">
          <button class="ctrl-btn" style="flex:1" onclick="sendCmd('SET_PAUSE_LOSSES', document.getElementById('ctrl-pauselosses-val').value)">Pause After Losses</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Trading Terminal -->
  <div class="section-title" id="section-terminal">Trading Terminal</div>
  <div class="trade-terminal">
    <div class="trade-terminal-header">
      <span class="trade-terminal-title">⚡ Manual Commands — XRPUSDT</span>
      <span class="trade-terminal-mode" id="trade-mode-label">—</span>
    </div>
    <div class="trade-cmd-grid">
      <div class="trade-cmd-col">
        <div class="trade-cmd-col-label">Buy / Long</div>
        <button class="trade-cmd-btn trade-btn-buy" onclick="tradeCmd('BUY_MARKET')">BUY XRP MARKET</button>
        <button class="trade-cmd-btn trade-btn-buy" onclick="tradeCmd('OPEN_LONG', { leverage: document.getElementById('t-lev').value })">OPEN LONG XRP <span id="t-lev-display">2</span>×</button>
        <div class="trade-pct-row" style="margin-top:8px">
          <span class="trade-pct-label">Leverage</span>
          <input class="trade-pct-input" id="t-lev" type="number" min="1" max="3" value="2" oninput="document.getElementById('t-lev-display').textContent=this.value">
        </div>
      </div>
      <div class="trade-cmd-col">
        <div class="trade-cmd-col-label">Sell / Close</div>
        <button class="trade-cmd-btn trade-btn-sell" onclick="confirmTrade('CLOSE_POSITION', 'Close your open position at market price?')">CLOSE POSITION</button>
        <button class="trade-cmd-btn trade-btn-sell" onclick="confirmTrade('SELL_ALL', 'SELL ALL XRP on Kraken? This sells your entire balance.')">SELL ALL</button>
      </div>
      <div class="trade-cmd-col">
        <div class="trade-cmd-col-label">Set Exit Levels</div>
        <div class="trade-pct-row">
          <span class="trade-pct-label">Stop Loss %</span>
          <input class="trade-pct-input" id="t-sl" type="number" min="0.1" max="10" step="0.05" value="1.25">
        </div>
        <button class="trade-cmd-btn trade-btn-set" onclick="tradeCmd('SET_STOP_LOSS', { pct: document.getElementById('t-sl').value })">SET STOP LOSS</button>
        <div class="trade-pct-row" style="margin-top:6px">
          <span class="trade-pct-label">Take Profit %</span>
          <input class="trade-pct-input" id="t-tp" type="number" min="0.1" max="20" step="0.1" value="2">
        </div>
        <button class="trade-cmd-btn trade-btn-set" onclick="tradeCmd('SET_TAKE_PROFIT', { pct: document.getElementById('t-tp').value })">SET TAKE PROFIT</button>
      </div>
    </div>
    <div class="trade-log" id="trade-log">
      <div class="trade-log-entry" style="color:var(--muted)">Ready — commands will appear here</div>
    </div>
  </div>

  <!-- Live Chart -->
  <div class="section-title">Live Chart — <span id="chart-symbol-label">Loading...</span></div>
  <div class="chart-card">
    <div class="chart-header">
      <div class="legend">
        <div class="legend-item">
          <div class="legend-line" style="background:linear-gradient(90deg,#3fb950,#f85149)"></div>
          Candles
        </div>
        <div class="legend-item">
          <div class="legend-line" style="background:var(--purple)"></div>
          EMA(8)
        </div>
        <div class="legend-item">
          <div class="legend-line" style="background:var(--blue)"></div>
          VWAP
        </div>
        <div class="legend-item">
          <div class="legend-line" style="background:rgba(255,165,0,0.7);border-top:1px dashed rgba(255,165,0,0.7);height:0"></div>
          BB(20)
        </div>
        <div class="legend-item">
          <div class="legend-line" style="background:rgba(139,148,158,0.4)"></div>
          Volume
        </div>
        <div class="legend-item" style="color:var(--muted)">
          RSI(3) below
        </div>
      </div>
      <span style="color:var(--muted);font-size:12px" id="chart-updated">—</span>
    </div>
    <div id="chart-container"></div>
    <div id="rsi-container"></div>
  </div>

  <!-- Balance -->
  <div class="section-title">Kraken Balance</div>
  <div class="balance-card">
    <div style="display:flex;align-items:center;gap:0;flex-wrap:wrap;flex:1">
      <div class="balance-assets" id="balance-content">
        <span style="color:var(--muted);font-size:13px">Loading...</span>
      </div>
      <div class="balance-total" id="balance-total" style="display:none">
        <div class="balance-total-label">Portfolio</div>
        <div class="balance-total-value" id="balance-total-value">—</div>
      </div>
    </div>
    <span class="balance-updated" id="balance-updated"></span>
  </div>

  <!-- Open Position -->
  <div class="section-title" id="section-position">Open Position</div>
  <div class="position-card" id="position-card">
    <div class="position-header">
      <span class="position-title">Current Trade</span>
      <span class="position-badge-closed" id="position-badge">No Position</span>
    </div>
    <div id="position-body">
      <div class="position-no-trade">No open trade — bot is watching for the next entry signal.</div>
    </div>
  </div>

  <!-- Paper Portfolio Wallet -->
  <div class="section-title" id="section-paper">Paper Portfolio</div>
  <div class="paper-wallet">
    <div class="paper-wallet-header">
      <span class="paper-wallet-title">Virtual Wallet</span>
      <span class="paper-wallet-badge">📋 Paper Money</span>
    </div>
    <div class="paper-wallet-row">
      <div class="paper-wallet-item">
        <div class="paper-wallet-label">Starting Balance</div>
        <div class="paper-wallet-value" id="pw-starting">—</div>
        <div class="paper-wallet-sub">your paper budget</div>
      </div>
      <div class="paper-wallet-item">
        <div class="paper-wallet-label">USD Remaining</div>
        <div class="paper-wallet-value" id="pw-usd-remaining">—</div>
        <div class="paper-wallet-sub" id="pw-usd-spent">$0 spent</div>
      </div>
      <div class="paper-wallet-item">
        <div class="paper-wallet-label">XRP Held</div>
        <div class="paper-wallet-value" id="pw-xrp-held">—</div>
        <div class="paper-wallet-sub" id="pw-xrp-value">current value: —</div>
      </div>
      <div class="paper-wallet-item">
        <div class="paper-wallet-label">Trades Taken</div>
        <div class="paper-wallet-value" id="pw-trade-count">—</div>
        <div class="paper-wallet-sub" id="pw-avg-entry">avg entry: —</div>
      </div>
    </div>
    <hr class="paper-wallet-divider">
    <div class="paper-wallet-footer">
      <div>
        <div class="paper-wallet-total-label">Total Portfolio Value</div>
        <div class="paper-wallet-total-value" id="pw-total-value">—</div>
      </div>
      <div style="text-align:right">
        <div class="paper-wallet-total-label">Overall P&amp;L</div>
        <div class="paper-wallet-pnl" id="pw-pnl">—</div>
      </div>
    </div>
  </div>

  <!-- Paper P&L -->
  <div class="section-title">Paper Trading P&amp;L</div>
  <div class="pnl-grid">
    <div class="pnl-card">
      <div class="pnl-label">Unrealized P&amp;L</div>
      <div class="pnl-value pnl-zero" id="pnl-value">—</div>
      <div class="pnl-sub" id="pnl-pct">no trades yet</div>
    </div>
    <div class="pnl-card">
      <div class="pnl-label">Current Value</div>
      <div class="pnl-value blue" id="pnl-current">—</div>
      <div class="pnl-sub" id="pnl-qty">— units held</div>
    </div>
    <div class="pnl-card">
      <div class="pnl-label">Total Invested</div>
      <div class="pnl-value" id="pnl-invested" style="color:var(--text)">—</div>
      <div class="pnl-sub" id="pnl-trades">— paper trades</div>
    </div>
    <div class="pnl-card">
      <div class="pnl-label">Avg Entry Price</div>
      <div class="pnl-value" id="pnl-avg-entry" style="color:var(--text)">—</div>
      <div class="pnl-sub" id="pnl-current-price">current: —</div>
    </div>
    <div class="pnl-card">
      <div class="pnl-label">Win / Loss Ratio</div>
      <div class="pnl-value pnl-zero" id="pnl-wl-ratio">—</div>
      <div class="pnl-sub" id="pnl-wl-detail">no trades yet</div>
    </div>
  </div>

  <!-- RSI History (collapsible) -->
  <div class="section-title section-collapsible rsi-hide-mobile" id="rsi-section-title" onclick="toggleRsiHistory()" style="display:flex;align-items:center;justify-content:space-between">
    <span>RSI(3) History — Recent Runs</span>
    <span class="collapse-icon">▼</span>
  </div>
  <div class="card rsi-hide-mobile" id="rsi-section-body" style="margin-bottom:24px">
    <div class="rsi-history-wrap" id="rsi-history-wrap">
      <div style="color:var(--muted);font-size:13px">No data yet</div>
    </div>
    <div class="rsi-legend">
      <div class="rsi-legend-item"><div class="rsi-legend-dot" style="background:var(--green)"></div> &gt;70 — reversal zone (trade possible)</div>
      <div class="rsi-legend-item"><div class="rsi-legend-dot" style="background:rgba(248,81,73,0.5)"></div> &lt;70 — waiting</div>
      <div class="rsi-legend-item"><span style="border-top:1px dashed rgba(248,81,73,0.6);width:16px;display:inline-block;margin-bottom:3px"></span> 70 threshold</div>
    </div>
  </div>

  <!-- Stats -->
  <div class="section-title">Overview</div>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Runs</div>
      <div class="stat-value blue" id="stat-total">—</div>
      <div class="stat-sub">all time</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Trades Fired</div>
      <div class="stat-value green" id="stat-fired">—</div>
      <div class="stat-sub" id="stat-fired-sub">paper + live</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Blocked</div>
      <div class="stat-value red" id="stat-blocked">—</div>
      <div class="stat-sub">safety check stopped</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Today's Trades</div>
      <div class="stat-value yellow" id="stat-today">—</div>
      <div class="stat-sub" id="stat-today-sub">of 3 max</div>
    </div>
  </div>

  <!-- Indicators + Safety Check -->
  <div class="section-title">Latest Run</div>
  <div class="mid-grid">
    <div class="card">
      <div class="card-title">Market Indicators</div>
      <div id="indicators-content">
        <div class="empty-state">No data yet — run the bot first</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Safety Check</div>
      <div id="safety-content">
        <div class="empty-state">No data yet — run the bot first</div>
      </div>
    </div>
  </div>

  <!-- Trade History / Recent Runs -->
  <div class="section-header">
    <div class="section-title">Trade History — Recent Runs</div>
    <div class="view-toggle">
      <button class="view-toggle-btn active" id="toggle-simple" onclick="setView('simple')">Simple View</button>
      <button class="view-toggle-btn" id="toggle-advanced" onclick="setView('advanced')">Advanced View</button>
    </div>
  </div>
  <div class="card" style="margin-bottom:24px" id="reasoning-card">
    <div id="reasoning-summary" class="reasoning-summary">Loading...</div>
    <div id="reasoning-summary-adv" class="reasoning-summary" style="display:none">Loading...</div>
    <div id="reasoning-timeline"></div>
    <div id="reasoning-timeline-advanced" style="display:none"></div>
  </div>

  <!-- Condition Heatmap -->
  <div class="section-title">Condition Heatmap — Last 10 Runs</div>
  <div class="card" style="margin-bottom:24px">
    <div class="heatmap-scroll">
      <div id="heatmap-content"><div class="empty-state">No data yet</div></div>
    </div>
  </div>

  <!-- Trade Log -->
  <div class="table-card">
    <div class="table-header">
      <div class="section-title" style="margin:0">Trade Log</div>
      <span style="color:var(--muted);font-size:12px">Follows Simple / Advanced toggle above</span>
    </div>
    <table>
      <thead id="trade-table-head">
        <tr>
          <th>Date</th><th>Time</th><th>Symbol</th><th>Price</th><th>Result</th><th>What Happened</th>
        </tr>
      </thead>
      <tbody id="trade-table-body">
        <tr class="empty-row"><td colspan="6">No trades recorded yet</td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">Live price every tick · Data refresh every 5s · <span id="footer-mode">Paper trading mode — no real money</span></div>
</main>
</div>

<!-- Agent Avila Chatbox -->
<div class="chat-bubble">
  <div class="chat-panel" id="chat-panel">
    <div class="chat-header">
      <div class="chat-header-icon">⚡</div>
      <div>
        <div class="chat-header-title">Agent Avila Assistant</div>
        <div class="chat-header-sub" id="chat-status">Ask me anything about your bot</div>
      </div>
      <button class="chat-close" onclick="toggleChat()">✕</button>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="chat-msg chat-msg-bot">Hey! I'm your Agent Avila assistant. I can explain trades, analyze your performance, and control the bot. Try asking:<br><br>• <em>"Why did the bot skip?"</em><br>• <em>"What's my current exposure?"</em><br>• <em>"Reduce risk to 0.5%"</em></div>
    </div>
    <div class="chat-suggestions">
      <button class="chat-suggest-btn" onclick="sendSuggestion('Why did the bot skip last trade?')">Why skip?</button>
      <button class="chat-suggest-btn" onclick="sendSuggestion('What is my current exposure?')">Exposure?</button>
      <button class="chat-suggest-btn" onclick="sendSuggestion('Analyze my performance')">Performance</button>
      <button class="chat-suggest-btn" onclick="sendSuggestion('What is the market regime right now?')">Regime</button>
    </div>
    <div class="chat-input-wrap">
      <textarea class="chat-input" id="chat-input" rows="1" placeholder="Ask Agent Avila..." onkeydown="chatKeyDown(event)"></textarea>
      <button class="chat-send-btn" onclick="sendChat()" title="Send (Enter)">➤</button>
    </div>
    <div style="padding:6px 12px 10px;font-size:10px;color:var(--muted);text-align:center;border-top:1px solid rgba(255,255,255,0.04)">
      <span class="kbd">⌘K</span> open chat · <span class="kbd">⌘P</span> pause · <span class="kbd">⌘L</span> live mode · <span class="kbd">esc</span> close
    </div>
  </div>
  <button class="chat-toggle-btn" onclick="toggleChat()" title="Agent Avila Assistant">⚡</button>
  <span class="chat-unread" id="chat-unread" style="display:none">1</span>
</div>

<script>
  // ── Chart ──────────────────────────────────────────────────────────────────
  let chartInst = null, candleSeries, emaSeries, vwapSeries, bbUpperSeries, bbLowerSeries, volSeries, rsiInst, rsiSeries;

  // Safe JSON fetch — never throws on HTML responses (e.g. session expired → login redirect)
  async function safeJson(url, opts) {
    const res = await fetch(url, opts);
    const text = await res.text();
    if (!res.ok && res.status === 302) throw new Error("Session expired — please log in");
    try { return JSON.parse(text); }
    catch (e) {
      console.error("[safeJson] Invalid JSON from " + url + ":", text.slice(0, 200));
      throw new Error("Server returned non-JSON response (status " + res.status + ")");
    }
  }

  async function initOrUpdateChart() {
    let data;
    try {
      data = await safeJson("/api/candles");
      if (data.error) throw new Error(data.error);
    } catch (e) {
      document.getElementById("chart-container").innerHTML =
        \`<div class="chart-error">Chart unavailable: \${e.message}</div>\`;
      return;
    }

    const container    = document.getElementById("chart-container");
    const rsiContainer = document.getElementById("rsi-container");
    const isFirst = !chartInst;

    if (isFirst) {
      chartInst = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 420,
        layout: { background: { color: "#0d1117" }, textColor: "#e6edf3" },
        grid:   { vertLines: { color: "rgba(48,54,61,0.6)" }, horzLines: { color: "rgba(48,54,61,0.6)" } },
        crosshair: { mode: 0 },
        localization: { timeFormatter: ts => new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) },
        timeScale: {
          timeVisible: true, secondsVisible: false, borderColor: "#30363d",
          tickMarkFormatter: (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
        },
        rightPriceScale: { borderColor: "#30363d" },
        watermark: {
          visible: true, fontSize: 28, horzAlign: "center", vertAlign: "center",
          color: "rgba(88,166,255,0.04)", text: "XRPUSDT · 5m",
        },
      });

      // Volume histogram (behind candles)
      volSeries = chartInst.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      chartInst.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

      // Bollinger Bands
      bbUpperSeries = chartInst.addLineSeries({
        color: "rgba(255,165,0,0.55)", lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: "BB Upper",
      });
      bbLowerSeries = chartInst.addLineSeries({
        color: "rgba(255,165,0,0.55)", lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false, title: "BB Lower",
      });

      candleSeries = chartInst.addCandlestickSeries({
        upColor: "#3fb950", downColor: "#f85149",
        borderUpColor: "#3fb950", borderDownColor: "#f85149",
        wickUpColor: "#3fb950", wickDownColor: "#f85149",
      });
      emaSeries = chartInst.addLineSeries({
        color: "#bc8cff", lineWidth: 1.5,
        priceLineVisible: false, lastValueVisible: true, title: "EMA8",
      });
      vwapSeries = chartInst.addLineSeries({
        color: "#58a6ff", lineWidth: 1.5,
        priceLineVisible: false, lastValueVisible: true, title: "VWAP",
      });

      rsiInst = LightweightCharts.createChart(rsiContainer, {
        width: rsiContainer.clientWidth,
        height: 120,
        layout: { background: { color: "#0d1117" }, textColor: "#8b949e" },
        grid:   { vertLines: { color: "rgba(48,54,61,0.4)" }, horzLines: { color: "rgba(48,54,61,0.4)" } },
        timeScale: { visible: false, borderColor: "#30363d" },
        rightPriceScale: { borderColor: "#30363d", scaleMargins: { top: 0.1, bottom: 0.1 } },
      });
      rsiSeries = rsiInst.addAreaSeries({
        lineColor: "#d29922", lineWidth: 2,
        topColor: "rgba(210,153,34,0.35)", bottomColor: "rgba(210,153,34,0.0)",
        priceLineVisible: false, lastValueVisible: true, title: "RSI3",
      });
      rsiSeries.createPriceLine({ price: 70, color: "rgba(248,81,73,0.7)",   lineWidth: 1, lineStyle: 2 });
      rsiSeries.createPriceLine({ price: 50, color: "rgba(139,148,158,0.4)", lineWidth: 1, lineStyle: 4 });
      rsiSeries.createPriceLine({ price: 30, color: "rgba(63,185,80,0.7)",   lineWidth: 1, lineStyle: 2 });

      let syncing = false;
      chartInst.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (syncing || !range) return;
        syncing = true;
        rsiInst.timeScale().setVisibleLogicalRange(range);
        syncing = false;
      });
      rsiInst.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (syncing || !range) return;
        syncing = true;
        chartInst.timeScale().setVisibleLogicalRange(range);
        syncing = false;
      });

      window.addEventListener("resize", () => {
        chartInst.resize(container.clientWidth, 420);
        rsiInst.resize(rsiContainer.clientWidth, 120);
      });
    }

    if (data.volume)              volSeries.setData(data.volume);
    if (data.bollinger?.upper)    bbUpperSeries.setData(data.bollinger.upper);
    if (data.bollinger?.lower)    bbLowerSeries.setData(data.bollinger.lower);
    candleSeries.setData(data.candles);
    emaSeries.setData(data.ema8);
    vwapSeries.setData(data.vwap);
    rsiSeries.setData(data.rsi3);
    if (data.markers && data.markers.length) candleSeries.setMarkers(data.markers);

    document.getElementById("chart-symbol-label").textContent =
      \`\${data.symbol} · \${data.timeframe}\`;
    document.getElementById("chart-updated").textContent =
      "Updated " + new Date().toLocaleTimeString();

    if (isFirst) chartInst.timeScale().scrollToRealTime();
  }

  // ── Balance ────────────────────────────────────────────────────────────────
  function renderBalance(data) {
      const el = document.getElementById("balance-content");
      const upd = document.getElementById("balance-updated");
      if (data.error) {
        el.innerHTML = \`<span style="color:var(--muted);font-size:13px">\${data.error}</span>\`;
        return;
      }
      if (!data.balances || !data.balances.length) {
        el.innerHTML = \`<span style="color:var(--muted);font-size:13px">No balance data</span>\`;
        return;
      }
      el.innerHTML = data.balances.map(b => {
        const isUSD = b.asset === "USD";
        const color = isUSD ? "var(--green)" : "var(--text)";
        const formatted = isUSD
          ? "$" + b.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : b.amount < 1 ? b.amount.toFixed(6) : b.amount.toFixed(4);
        const usdSub = !isUSD && b.usdValue
          ? \`<div class="balance-asset-usd">≈ $\${b.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>\`
          : "";
        return \`
          <div class="balance-asset">
            <div class="balance-asset-name">\${b.asset}</div>
            <div class="balance-asset-amount" style="color:\${color}">\${formatted}</div>
            \${usdSub}
          </div>\`;
      }).join("");

      if (data.totalUSD > 0) {
        const totalEl = document.getElementById("balance-total");
        const totalVal = document.getElementById("balance-total-value");
        totalEl.style.display = "block";
        totalVal.textContent = "$" + data.totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      upd.textContent = "Updated " + new Date(data.updatedAt).toLocaleTimeString();
  }

  // ── Stats / Indicators ─────────────────────────────────────────────────────
  function fmt(n) {
    if (n === null || n === undefined || n === "") return "—";
    const num = parseFloat(n);
    if (isNaN(num)) return n;
    return num < 10 ? num.toFixed(4) : num.toFixed(2);
  }

  function timeAgo(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60) return diff + "s ago";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    return Math.floor(diff / 3600) + "h ago";
  }

  function biasClass(bias) {
    if (!bias) return "";
    const b = bias.toUpperCase();
    if (b.includes("BULL")) return "bias-bullish";
    if (b.includes("BEAR")) return "bias-bearish";
    return "bias-neutral";
  }

  // ── Countdown ──────────────────────────────────────────────────────────────
  function getNextCronTime() {
    const now = new Date();
    const h = now.getUTCHours();
    const slots = [0, 4, 8, 12, 16, 20];
    const next = slots.find(s => s > h);
    const d = new Date(now);
    d.setUTCMinutes(0, 0, 0);
    if (next !== undefined) { d.setUTCHours(next); }
    else { d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0); }
    return d;
  }

  function updateCountdown() {
    const diff = getNextCronTime() - Date.now();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const el = document.getElementById('next-run-countdown');
    if (el) el.textContent = h > 0 ? \`\${h}h \${m}m\` : \`\${m}m \${s}s\`;
  }
  setInterval(updateCountdown, 1000);
  updateCountdown();

  // ── Health Status ──────────────────────────────────────────────────────────
  function renderHealthStatus(latest) {
    if (!latest) return;
    const diffMin = (Date.now() - new Date(latest.timestamp)) / 60000;
    const dot = document.getElementById('health-dot');
    // Bot should run every 5 minutes — anything > 10 min is concerning
    if (dot) dot.className = 'h-dot ' + (diffMin < 10 ? 'h-dot-green' : diffMin < 30 ? 'h-dot-yellow' : 'h-dot-red');
    const el = document.getElementById('health-last-run');
    if (el) el.textContent = 'Bot last ran ' + timeAgo(latest.timestamp);
  }

  // ── RSI History ────────────────────────────────────────────────────────────
  function renderRSIHistory(allLogs) {
    const wrap = document.getElementById('rsi-history-wrap');
    if (!wrap || !allLogs || !allLogs.length) return;
    const logs = [...allLogs].reverse(); // oldest first
    const threshold = 70;
    const thresholdPct = (threshold / 100) * 100;
    wrap.style.position = 'relative';
    wrap.innerHTML = \`<div class="rsi-threshold" style="bottom:\${thresholdPct}%"></div>\` +
      logs.map(run => {
        const rsi = run.indicators?.rsi3 ?? 0;
        const pct = Math.max(3, Math.min(100, (rsi / 100) * 100));
        const color = rsi >= 70 ? 'var(--green)' : 'rgba(248,81,73,0.45)';
        const ago = timeAgo(run.timestamp);
        return \`<div class="rsi-bar-col" title="\${ago}\\nRSI: \${rsi.toFixed(1)}\\n\${run.allPass ? 'TRADE' : 'BLOCKED'}">
          <div class="rsi-bar-val">\${rsi.toFixed(0)}</div>
          <div class="rsi-bar" style="height:\${pct}%;background:\${color}"></div>
        </div>\`;
      }).join('');
  }

  // ── Condition Heatmap ──────────────────────────────────────────────────────
  function renderHeatmap(allLogs) {
    const el = document.getElementById('heatmap-content');
    if (!el || !allLogs || !allLogs.length) return;

    const shortLabel = l => {
      if (l === 'Market bias')              return 'Bias';
      if (l.includes('VWAP') && l.includes('above'))  return 'P>VWAP';
      if (l.includes('VWAP') && l.includes('below'))  return 'P<VWAP';
      if (l.includes('EMA')  && l.includes('above'))  return 'P>EMA';
      if (l.includes('EMA')  && l.includes('below'))  return 'P<EMA';
      if (l.includes('RSI')  && l.includes('30'))      return 'RSI<30';
      if (l.includes('RSI')  && l.includes('50'))      return 'RSI>50↑';
      if (l.includes('RSI')  && l.includes('70'))      return 'RSI>70';
      if (l.includes('1.5%') || l.includes('overext')) return '±VWAP';
      return l.slice(0, 7);
    };

    const simpleLabel = (l) => {
      if (l === 'Market bias')              return 'Direction';
      if (l.includes('VWAP') && l.includes('above'))  return 'Buyers in Control';
      if (l.includes('VWAP') && l.includes('below'))  return 'Sellers in Control';
      if (l.includes('EMA')  && l.includes('above'))  return 'Uptrend';
      if (l.includes('EMA')  && l.includes('below'))  return 'Downtrend';
      if (l.includes('RSI')  && l.includes('30'))      return 'Good Dip';
      if (l.includes('RSI')  && l.includes('50'))      return 'Momentum';
      if (l.includes('RSI')  && l.includes('70'))      return 'Overheated';
      if (l.includes('1.5%') || l.includes('overext')) return 'Not Overextended';
      return l.slice(0, 10);
    };

    const labelSet = new Set();
    for (const run of allLogs) for (const c of (run.conditions || [])) labelSet.add(c.label);
    const labels = [...labelSet];
    const simple = currentView === "simple";

    const header = \`<tr><th>Run</th>\${labels.map(l => \`<th title="\${l}">\${simple ? simpleLabel(l) : shortLabel(l)}</th>\`).join('')}<th>Result</th></tr>\`;

    const rows = allLogs.map(run => {
      const cells = labels.map(label => {
        const cond = (run.conditions || []).find(c => c.label === label);
        if (!cond) return \`<td><span class="hm-cell hm-na">—</span></td>\`;
        return \`<td title="\${label}\\nRequired: \${cond.required}\\nActual: \${cond.actual}"><span class="hm-cell \${cond.pass ? 'hm-pass' : 'hm-fail'}">\${cond.pass ? '✓' : '✗'}</span></td>\`;
      }).join('');
      const res = run.allPass
        ? \`<td><span class="hm-result-pass">\${simple ? "✅ Bought" : "TRADE"}</span></td>\`
        : \`<td><span class="hm-result-fail">\${simple ? "⛔ Skipped" : "BLOCKED"}</span></td>\`;
      return \`<tr><td class="hm-time">\${timeAgo(run.timestamp)}</td>\${cells}\${res}</tr>\`;
    }).join('');

    el.innerHTML = \`<table class="heatmap-table"><thead>\${header}</thead><tbody>\${rows}</tbody></table>\`;
  }

  function renderPosition(position, currentPrice) {
    const card  = document.getElementById("position-card");
    const badge = document.getElementById("position-badge");
    const body  = document.getElementById("position-body");
    if (!card || !badge || !body) return;

    if (!position || !position.open) {
      card.className  = "position-card";
      badge.className = "position-badge-closed";
      badge.textContent = "No Position";
      body.innerHTML = \`<div class="position-no-trade">No open trade — bot is watching for the next entry signal.</div>\`;
      return;
    }

    const price      = currentPrice || position.entryPrice;
    const pnlPct     = ((price - position.entryPrice) / position.entryPrice * 100);
    const pnlUSD     = (pnlPct / 100 * position.tradeSize);
    const pnlSign    = pnlPct >= 0 ? "+" : "";
    const pnlColor   = pnlPct > 0 ? "var(--green)" : pnlPct < 0 ? "var(--red)" : "var(--muted)";

    // Progress bar: position of current price between SL and TP
    const range      = position.takeProfit - position.stopLoss;
    const filled     = Math.min(Math.max((price - position.stopLoss) / range * 100, 0), 100);
    const barColor   = pnlPct >= 0 ? "var(--green)" : "var(--red)";

    const distToSL   = ((price - position.stopLoss)   / position.entryPrice * 100).toFixed(2);
    const distToTP   = ((position.takeProfit - price)  / position.entryPrice * 100).toFixed(2);
    const entryPct   = ((position.entryPrice - position.stopLoss) / range * 100).toFixed(1);

    const lev = position.leverage || 1;
    const glowClass = pnlPct > 0.3 ? " pos-profit" : pnlPct < -0.3 ? " pos-loss" : "";
    card.className  = "position-card pos-open" + glowClass;
    badge.className = "position-badge-open";
    badge.textContent = (position.side === "long" ? "📈 Long" : "📉 Short") + " · " + lev + "x Leverage";

    body.innerHTML = \`
      <div class="position-grid">
        <div>
          <div class="position-item-label">Entry Price</div>
          <div class="position-item-value">$\${position.entryPrice.toFixed(4)}</div>
          <div class="position-item-sub">\${position.entryTime ? (() => { const mins = Math.floor((Date.now() - new Date(position.entryTime).getTime()) / 60000); return mins < 60 ? mins + "m in trade" : Math.floor(mins/60) + "h " + (mins%60) + "m in trade"; })() : "—"}</div>
        </div>
        <div>
          <div class="position-item-label">Current Price</div>
          <div class="position-item-value" style="color:\${pnlColor}">$\${price.toFixed(4)}</div>
          <div class="position-item-sub" style="color:\${pnlColor}">\${pnlSign}\${pnlPct.toFixed(2)}% (\${pnlSign}$\${Math.abs(pnlUSD).toFixed(2)})</div>
        </div>
        <div>
          <div class="position-item-label">🛑 Stop Loss</div>
          <div class="position-item-value" style="color:var(--red)">$\${position.stopLoss.toFixed(4)}</div>
          <div class="position-item-sub">\${distToSL}% · risk $\${(Math.abs((price - position.stopLoss) / position.entryPrice) * (position.tradeSize || 0)).toFixed(2)}</div>
        </div>
        <div>
          <div class="position-item-label">🎯 Take Profit</div>
          <div class="position-item-value" style="color:var(--green)">$\${position.takeProfit.toFixed(4)}</div>
          <div class="position-item-sub">\${distToTP}% to go</div>
        </div>
      </div>
      <div class="position-bar-wrap">
        <div class="position-bar-label">
          <span style="color:var(--red)">SL $\${position.stopLoss.toFixed(4)}</span>
          <span style="color:var(--muted)">← Price range →</span>
          <span style="color:var(--green)">TP $\${position.takeProfit.toFixed(4)}</span>
        </div>
        <div class="position-bar-track">
          <div class="position-bar-fill" style="width:\${filled}%;background:\${barColor}"></div>
          <div class="position-bar-marker" style="left:\${entryPct}%" title="Entry price"></div>
        </div>
      </div>\`;
  }

  function simpleCondLabel(label) {
    if (label.includes("VWAP") && label.includes("above"))   return "Buyers are in control";
    if (label.includes("VWAP") && label.includes("below"))   return "Sellers are in control";
    if (label.includes("EMA")  && label.includes("above"))   return "Price is in an uptrend";
    if (label.includes("EMA")  && label.includes("below"))   return "Price is in a downtrend";
    if (label.includes("RSI")  && label.includes("30"))       return "Waiting for a dip";
    if (label.includes("RSI")  && label.includes("70"))       return "Waiting for a peak";
    if (label.includes("overextended") || label.includes("1.5%")) return "Price is at a safe distance";
    return label;
  }

  function simpleCondNote(c) {
    if (c.pass) return "";
    if (c.label.includes("RSI") && c.label.includes("30"))
      return \`Market is currently overheated (\${parseFloat(c.actual).toFixed(0)}), needs to cool to 30 or below\`;
    if (c.label.includes("RSI") && c.label.includes("70"))
      return \`Market is currently weak (\${parseFloat(c.actual).toFixed(0)}), needs to reach 70 or above\`;
    if (c.label.includes("overextended") || c.label.includes("1.5%"))
      return \`Price is \${c.actual} away from center — too stretched to enter safely\`;
    if (c.label.includes("VWAP")) return "Price needs to be on the right side of the session average";
    if (c.label.includes("EMA"))  return "Price needs to confirm the trend direction";
    return "";
  }

  function renderSafetyCheck(latest) {
    if (!latest) return;
    const el = document.getElementById("safety-content");
    if (!el) return;
    const conditions = latest.conditions.filter(c => c.label !== "Market bias");
    const simple = currentView === "simple";

    const score     = latest.signalScore;
    const ql        = score !== undefined ? signalQualityLabel(score) : null;
    const scoreBanner = ql ? \`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(0,0,0,0.2);border-radius:6px;margin-bottom:8px">
      <span style="font-size:13px;font-weight:700;color:\${ql.color}">\${ql.label}</span>
      <span style="font-size:20px;font-weight:900;color:\${score >= 75 ? "var(--green)" : score >= 55 ? "var(--yellow)" : "var(--red)"}">\${score.toFixed(0)}<span style="font-size:12px;color:var(--muted)">/100</span></span>
    </div>\` : "";
    const vol = latest.volatility;
    const lev = latest.effectiveLeverage;
    const volBanner = vol
      ? (vol.stable
          ? \`<div class="decision-banner" style="background:rgba(63,185,80,0.08);border-color:rgba(63,185,80,0.2);color:var(--green);margin-bottom:8px">✅ Market is stable — \${lev}x leverage active (spike ratio: \${vol.spikeRatio}x ATR)</div>\`
          : \`<div class="decision-banner" style="background:rgba(210,153,34,0.08);border-color:rgba(210,153,34,0.3);color:var(--yellow);margin-bottom:8px">⚠️ Market is chaotic — leverage disabled, using 1x only (spike ratio: \${vol.spikeRatio}x ATR)</div>\`)
      : "";
    const decisionHtml = latest.allPass
      ? \`\${scoreBanner}\${volBanner}<div class="decision-banner decision-pass">\${simple ? "✅ Ready to buy — all signals are aligned" : "✅ All conditions met — trade would fire"}</div>\`
      : \`\${scoreBanner}\${volBanner}\` + (simple
        ? \`<div class="decision-banner decision-fail">⏳ Waiting — not the right entry point yet</div>\`
        : \`<div class="decision-banner decision-fail">🚫 Blocked — \${latest.conditions.filter(c=>!c.pass).map(c=>c.label).join(", ")}</div>\`);

    const condHtml = conditions.length === 0
      ? \`<div class="empty-state">No conditions evaluated</div>\`
      : conditions.map(c => {
          const note = simple ? simpleCondNote(c) : "";
          return \`
          <div class="condition \${c.pass ? "cond-pass" : "cond-fail"}">
            <span class="cond-icon">\${c.pass ? "✅" : "🚫"}</span>
            <div class="cond-text">
              <div class="cond-label">\${simple ? simpleCondLabel(c.label) : c.label}</div>
              \${simple
                ? (note ? \`<div class="cond-detail">\${note}</div>\` : "")
                : \`<div class="cond-detail">Required: \${c.required} &nbsp;·&nbsp; Actual: \${c.actual}</div>\`}
            </div>
          </div>\`;
        }).join("");

    const dlRaw = latest.decisionLog || "";
    const dlHtml = dlRaw ? \`<div class="decision-log-box"><span class="\${latest.allPass ? "dl-trade" : "dl-skip"}">\${dlRaw.replace(/\\|/g, "<br>")}</span></div>\` : "";
    el.innerHTML = decisionHtml + condHtml + dlHtml;
  }

  function plainBlockReason(run) {
    const failed = (run.conditions || []).filter(c => !c.pass);
    if (!failed.length) return "Conditions not met";
    const f = failed[0];
    if (f.label === "Market bias") {
      const p = run.price, e = run.indicators?.ema8, v = run.indicators?.vwap;
      const aboveEma = p > e, aboveVwap = p > v;
      if (aboveEma && !aboveVwap) return "Price above EMA but below VWAP — mixed signals, no clear direction";
      if (!aboveEma && aboveVwap) return "Price above VWAP but below EMA — mixed signals, no clear direction";
      return "Price is stuck between VWAP and EMA(8) — market has no clear direction";
    }
    if (f.label.includes("RSI")) {
      const rsi = run.indicators?.rsi3;
      const needed = f.label.includes("below 30") ? "below 30 for a pullback entry" : "above 70 for a reversal entry";
      return \`RSI(3) is \${rsi !== null && rsi !== undefined ? rsi.toFixed(1) : "?"} — needs to be \${needed}\`;
    }
    if (f.label.includes("VWAP")) return \`Price not in the right position relative to VWAP (needed \${f.required}, got \${f.actual})\`;
    if (f.label.includes("EMA"))  return \`Price not confirming the trend via EMA(8) (needed \${f.required}, got \${f.actual})\`;
    if (f.label.includes("overextended")) return \`Price is too far from VWAP to enter safely (\${f.actual} away, limit is 1.5%)\`;
    return \`\${f.label} — needed \${f.required}, got \${f.actual}\`;
  }

  function tradeLog(msg, type = "ok") {
    const log = document.getElementById("trade-log");
    if (!log) return;
    const ts   = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const div  = document.createElement("div");
    div.className = "trade-log-entry trade-log-" + type;
    div.textContent = "[" + ts + "] " + msg;
    log.insertBefore(div, log.firstChild);
  }

  async function tradeCmd(command, params = {}) {
    tradeLog("⏳ " + command + "...", "ok");
    try {
      const res  = await fetch("/api/trade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command, params }) });
      const data = await res.json();
      if (data.ok || data.message) {
        tradeLog("✅ " + (data.message || command + " OK"), "ok");
      } else {
        tradeLog("❌ " + data.error, "err");
      }
    } catch (e) { tradeLog("❌ " + e.message, "err"); }
  }

  async function confirmTrade(command, message) {
    const ok = await showModal({ icon: "⚠", title: "Confirm trade action", msg: message, confirmText: "Execute" });
    if (ok) tradeCmd(command);
  }

  async function sendCmd(command, value) {
    try {
      const body = value !== undefined ? { command, value } : { command };
      const res  = await fetch("/api/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.ok) renderControl(data.control);
      else showToast("Command failed: " + data.error, "error");
    } catch (e) { showToast("Error: " + e.message, "error"); }
  }

  async function confirmLive() {
    const ok = await showModal({
      icon: "🔴", title: "Switch to LIVE mode?",
      msg: "<strong style='color:var(--red)'>Real money will be used.</strong> Your next trade signal will place a real order on Kraken. The bot still uses your kill switch and stop loss protections.",
      confirmText: "Go LIVE", requireText: "CONFIRM"
    });
    if (ok) { sendCmd("SET_MODE_LIVE"); showToast("Switched to LIVE mode — real money active", "warn"); }
    else showToast("Cancelled — still in Paper mode", "info");
  }

  function renderControl(ctrl) {
    if (!ctrl) return;

    // Persist to localStorage for instant UI restore on next page load
    try { localStorage.setItem("agent_avila_ctrl", JSON.stringify({
      paperTrading: ctrl.paperTrading,
      stopped: ctrl.stopped,
      paused: ctrl.paused,
      killed: ctrl.killed,
      leverage: ctrl.leverage,
      riskPct: ctrl.riskPct,
    })); } catch {}

    const set = (id, text, cls) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.className = "ctrl-badge " + cls;
    };
    set("ctrl-badge-running",  ctrl.stopped  ? "⛔ STOPPED"  : "▶ RUNNING",          ctrl.stopped  ? "ctrl-badge-red"    : "ctrl-badge-green");
    set("ctrl-badge-mode",     ctrl.paperTrading !== false ? "📋 PAPER" : "🔴 LIVE", ctrl.paperTrading !== false ? "ctrl-badge-blue" : "ctrl-badge-red");
    set("ctrl-badge-paused",   ctrl.paused   ? "⏸ PAUSED"  : "✅ ACTIVE",           ctrl.paused   ? "ctrl-badge-yellow" : "ctrl-badge-green");
    set("ctrl-badge-killed",   ctrl.killed   ? "🚨 KILLED"  : "🛡 Safe",             ctrl.killed   ? "ctrl-badge-red"    : "ctrl-badge-green");
    set("ctrl-badge-leverage", (ctrl.leverage || 2) + "× Lev",                        "ctrl-badge-blue");
    set("ctrl-badge-risk",     "Risk " + (ctrl.riskPct || 1) + "%",                   "ctrl-badge-muted");
    set("ctrl-badge-losses",   (ctrl.consecutiveLosses || 0) + " consec losses",      (ctrl.consecutiveLosses || 0) >= 2 ? "ctrl-badge-yellow" : "ctrl-badge-muted");
    set("ctrl-badge-cooldown", ctrl.lastTradeTime ? "⏳ Cooldown" : "✅ No cooldown", ctrl.lastTradeTime ? "ctrl-badge-yellow" : "ctrl-badge-muted");

    const inputs = { "ctrl-leverage-val": ctrl.leverage, "ctrl-risk-val": ctrl.riskPct, "ctrl-dailyloss-val": ctrl.maxDailyLossPct, "ctrl-cooldown-val": ctrl.cooldownMinutes, "ctrl-killpct-val": ctrl.killSwitchDrawdownPct, "ctrl-pauselosses-val": ctrl.pauseAfterLosses };
    for (const [id, val] of Object.entries(inputs)) {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    }

    const modeLabel = document.getElementById("trade-mode-label");
    if (modeLabel) {
      modeLabel.textContent = ctrl.paperTrading !== false ? "📋 PAPER MODE" : "🔴 LIVE MODE";
      modeLabel.style.color = ctrl.paperTrading !== false ? "var(--blue)" : "var(--red)";
    }

    // Highlight active state buttons + disable redundant clicks
    const setActive = (id, active, color) => {
      const el = document.getElementById(id);
      if (!el) return;
      ["is-active-green","is-active-red","is-active-yellow","is-active-blue"].forEach(c => el.classList.remove(c));
      if (active) {
        el.classList.add("is-active-" + color);
        el.disabled = true;
        el.style.cursor = "default";
        el.style.opacity = "0.85";
      } else {
        el.disabled = false;
        el.style.cursor = "pointer";
        el.style.opacity = "1";
      }
    };
    setActive("btn-start",      !ctrl.stopped, "green");
    setActive("btn-stop",        ctrl.stopped, "red");
    setActive("btn-pause",       ctrl.paused,  "yellow");
    setActive("btn-resume",     !ctrl.paused,  "green");
    setActive("btn-mode-paper",  ctrl.paperTrading !== false, "blue");
    setActive("btn-mode-live",   ctrl.paperTrading === false, "red");
  }

  // Restore control state from localStorage immediately on page load (before SSE arrives)
  try {
    const cached = JSON.parse(localStorage.getItem("agent_avila_ctrl") || "null");
    if (cached) renderControl(cached);
  } catch {}

  // ── Toast Notifications ───────────────────────────────────────────────────
  function showToast(msg, type) {
    type = type || "info";
    const c = document.getElementById("toast-container");
    if (!c) return;
    const div = document.createElement("div");
    div.className = "toast toast-" + type;
    const icons = { success: "✅", error: "❌", info: "ℹ️", warn: "⚠️" };
    div.innerHTML = '<span class="toast-icon">' + (icons[type] || "ℹ️") + '</span><span class="toast-msg">' + msg + '</span>';
    c.appendChild(div);
    setTimeout(() => { div.classList.add("toast-out"); setTimeout(() => div.remove(), 300); }, 3500);
  }

  // ── Custom Confirm Modal ──────────────────────────────────────────────────
  let modalAction = null;
  function showModal(opts) {
    return new Promise(resolve => {
      const o = document.getElementById("modal-overlay");
      document.getElementById("modal-icon").textContent  = opts.icon  || "⚠";
      document.getElementById("modal-title").textContent = opts.title || "Confirm action";
      document.getElementById("modal-msg").innerHTML     = opts.msg   || "Are you sure?";
      const input = document.getElementById("modal-input");
      const btn   = document.getElementById("modal-confirm-btn");
      btn.textContent = opts.confirmText || "Confirm";
      if (opts.requireText) {
        input.style.display = ""; input.value = "";
        input.placeholder = 'Type "' + opts.requireText + '"';
        btn.disabled = true;
        input.oninput = () => { btn.disabled = input.value.trim() !== opts.requireText; };
        setTimeout(() => input.focus(), 100);
      } else {
        input.style.display = "none"; btn.disabled = false;
      }
      modalAction = (confirmed) => { closeModal(); resolve(confirmed); };
      o.classList.add("open");
    });
  }
  function closeModal() {
    document.getElementById("modal-overlay").classList.remove("open");
    if (modalAction) modalAction(false);
    modalAction = null;
  }
  function confirmModalAction() { if (modalAction) modalAction(true); }
  // ESC closes modal
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const o = document.getElementById("modal-overlay");
      if (o && o.classList.contains("open")) closeModal();
    }
  });

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  document.addEventListener("keydown", async e => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (e.key === "k") {
      e.preventDefault(); toggleChat(); showToast("Chat toggled", "info");
    } else if (e.key === "p") {
      e.preventDefault();
      const ctrl = lastRenderData?.control || {};
      if (ctrl.paused) { sendCmd("RESUME_TRADING"); showToast("Trading resumed", "success"); }
      else             { sendCmd("PAUSE_TRADING");  showToast("Trading paused", "warn"); }
    } else if (e.key === "l") {
      e.preventDefault();
      const ctrl = lastRenderData?.control || {};
      if (ctrl.paperTrading === false) {
        sendCmd("SET_MODE_PAPER"); showToast("Switched to PAPER mode", "info");
      } else {
        const ok = await showModal({
          icon: "🔴", title: "Switch to LIVE mode?",
          msg: "<strong style='color:var(--red)'>Real money will be used.</strong> Your next trade signal will place a real order on Kraken with leverage.",
          confirmText: "Go LIVE", requireText: "CONFIRM"
        });
        if (ok) { sendCmd("SET_MODE_LIVE"); showToast("Switched to LIVE mode — real money active", "warn"); }
      }
    }
  });

  // ── Nav Drawer ────────────────────────────────────────────────────────────
  function toggleNav() {
    document.getElementById("nav-drawer").classList.toggle("open");
    document.getElementById("nav-overlay").classList.toggle("open");
  }
  function closeNav() {
    document.getElementById("nav-drawer").classList.remove("open");
    document.getElementById("nav-overlay").classList.remove("open");
  }
  function navTo(sectionId) {
    closeNav();
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    const activeItem = document.querySelector(\`[onclick="navTo('\${sectionId}')"]\`);
    if (activeItem) activeItem.classList.add("active");
  }

  // ── System Health Monitor ─────────────────────────────────────────────────
  let wsConnected = false;

  function updateHealthPanel(krakenOk, krakenLatency, lastRunAge, wsOk) {
    const set = (id, text, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = text; el.className = "health-check-status " + cls; };
    set("hc-api", krakenOk ? "✅ Online" : "❌ Offline", krakenOk ? "health-ok" : "health-fail");
    const latEl = document.getElementById("hc-api-latency");
    if (latEl) latEl.textContent = krakenOk ? krakenLatency + "ms" : "—";
    set("hc-ws",  wsOk ? "✅ Connected" : "⚠️ Reconnecting", wsOk ? "health-ok" : "health-warn");
    const wsDetail = document.getElementById("hc-ws-detail");
    if (wsDetail) wsDetail.textContent = wsOk ? "Real-time feed active" : "Attempting reconnect...";
    const fresh = lastRunAge !== null;
    set("hc-data", fresh ? (lastRunAge <= 10 ? "✅ Fresh" : lastRunAge <= 30 ? "⚠️ Delayed" : "❌ Stale") : "—", fresh ? (lastRunAge <= 10 ? "health-ok" : lastRunAge <= 30 ? "health-warn" : "health-fail") : "");
    const ageEl = document.getElementById("hc-data-age");
    if (ageEl) ageEl.textContent = fresh ? lastRunAge + " min ago" : "No data";
    const botOk = fresh && lastRunAge <= 15;
    set("hc-bot", botOk ? "✅ Running" : "⚠️ Check cron", botOk ? "health-ok" : "health-warn");
    const botDetail = document.getElementById("hc-bot-detail");
    if (botDetail) botDetail.textContent = botOk ? "On schedule (5m)" : "Last run > 15m ago";
    const navDot = document.getElementById("nav-drawer-health-dot");
    if (navDot) { const allOk = krakenOk && wsOk && botOk; navDot.style.background = allOk ? "var(--green)" : "var(--yellow)"; }
  }

  async function runHealthCheck() {
    try {
      const data = await safeJson("/api/health");
      updateHealthPanel(data.krakenOk, data.krakenLatency, data.lastRunAge, wsConnected);
      // Self-heal: if data is stale (> 6 min), trigger a bot run to wake Railway from sleep
      if (data.lastRunAge !== null && data.lastRunAge > 6) {
        console.log("[self-heal] Data is " + data.lastRunAge + " min stale — triggering bot run");
        try {
          const r = await safeJson("/api/run-bot", { method: "POST" });
          if (r.triggered) showToast("Bot was sleeping — woke it up", "info");
        } catch {}
      }
    } catch { updateHealthPanel(false, 0, null, wsConnected); }
  }
  runHealthCheck();
  setInterval(runHealthCheck, 30000);
  // Re-check when tab becomes visible (user comes back to the page)
  document.addEventListener("visibilitychange", () => { if (!document.hidden) runHealthCheck(); });

  function toggleRsiHistory() {
    const body  = document.getElementById("rsi-section-body");
    const title = document.getElementById("rsi-section-title");
    if (!body) return;
    const hidden = body.style.display === "none";
    body.style.display  = hidden ? "" : "none";
    if (title) title.classList.toggle("collapsed", !hidden);
  }

  function renderPortfolioPanel(port, perf, position, livePrice) {
    if (!port && !perf) return;

    // Health score calculation (mirrors bot.js logic)
    const wr   = perf?.winRate  || 0;
    const pf   = perf?.profitFactor || 0;
    const dd   = perf?.drawdown || port?.drawdown || 0;
    const eff  = port?.efficiencyScore ?? 50;
    const enough = (perf?.totalTrades || 0) >= 3;

    const wrScore  = enough ? Math.min(wr * 100, 100) * 0.30 : 15;
    const pfScore  = enough ? Math.min(pf / 2, 1) * 100 * 0.30 : 15;
    const ddScore  = Math.max(0, 1 - dd / 5) * 100 * 0.20;
    const score    = Math.min(100, Math.round(wrScore + pfScore + 20 + ddScore));

    const scoreEl  = document.getElementById("port-score");
    const ringEl   = document.getElementById("port-score-ring");
    const labelEl  = document.getElementById("port-score-label");
    if (scoreEl) scoreEl.textContent = enough ? score : "—";
    const scoreColor = score >= 70 ? "var(--green)" : score >= 45 ? "var(--yellow)" : "var(--red)";
    if (ringEl)  { ringEl.style.borderColor = scoreColor; ringEl.style.boxShadow = "0 0 20px " + scoreColor.replace(")", ",0.2)").replace("var(","rgba(").replace("--green","0,255,154").replace("--yellow","255,181,71").replace("--red","255,77,106"); }
    if (scoreEl) scoreEl.style.color = scoreColor;
    if (labelEl) labelEl.textContent = score >= 70 ? "System Healthy" : score >= 45 ? "Monitor Closely" : "Reduce Risk";

    // Metrics
    const price  = livePrice || position?.entryPrice || 0;
    const unrealPnl = position?.open && price ? ((price - position.entryPrice) / position.entryPrice * position.tradeSize) : 0;
    const realPnl   = parseFloat(port?.realizedPnl || 0);
    const openRisk  = parseFloat(port?.openRiskPct || 0);
    const totalBal  = parseFloat(port?.totalBalanceUSD || 0);

    const s = (id, val, color) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; if (color) el.style.color = color; };
    s("port-open-risk",   openRisk.toFixed(2) + "%",                                 openRisk > 3 ? "var(--red)" : "var(--text)");
    s("port-unrealized",  (unrealPnl >= 0 ? "+" : "") + "$" + unrealPnl.toFixed(2), unrealPnl >= 0 ? "var(--green)" : "var(--red)");
    s("port-realized",    (realPnl   >= 0 ? "+" : "") + "$" + realPnl.toFixed(2),   realPnl   >= 0 ? "var(--green)" : "var(--red)");
    s("port-efficiency",  eff + "/100",                                               eff >= 60 ? "var(--green)" : eff >= 40 ? "var(--yellow)" : "var(--red)");
    s("port-total-bal",   "$" + totalBal.toFixed(2));
    s("port-drawdown",    dd.toFixed(2) + "%",                                        dd >= 5 ? "var(--red)" : dd >= 2 ? "var(--yellow)" : "var(--green)");

    // Allocation bar
    const usdPct  = 60; const xrpPct = 40 - Math.min(openRisk, 10); const riskPct = Math.min(openRisk, 10);
    const setBar  = (id, w) => { const el = document.getElementById(id); if (el) el.style.width = Math.max(0, w).toFixed(1) + "%"; };
    setBar("alloc-bar-usd",  usdPct);
    setBar("alloc-bar-xrp",  Math.max(0, xrpPct));
    setBar("alloc-bar-risk", riskPct);
    s("alloc-usd-label",  "USD " + usdPct + "%");
    s("alloc-xrp-label",  "XRP " + xrpPct.toFixed(0) + "%");
    s("alloc-risk-label", "Open risk " + openRisk.toFixed(1) + "%");
  }

  async function setCapital(command, value) {
    const res  = await fetch("/api/control", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ command, value }) });
    const data = await res.json();
    if (data.capitalState) renderCapitalPanel(data.capitalState, null);
  }

  async function confirmCapital() {
    const ok = await showModal({
      icon: "🔥", title: "Set XRP role to AGGRESSIVE?",
      msg: "<strong style='color:var(--red)'>This makes your XRP holdings part of the trading pool.</strong> The bot can liquidate XRP to fund trades. Not recommended in your stage.",
      confirmText: "Set Aggressive", requireText: "CONFIRM"
    });
    if (ok) { setCapital("SET_XRP_ROLE", "AGGRESSIVE"); showToast("XRP role: AGGRESSIVE", "warn"); }
  }

  function renderCapitalPanel(cap, paperPnL) {
    if (!cap) return;
    const startBal  = parseFloat(process?.env?.PAPER_STARTING_BALANCE || "100") || 100;
    const pnl       = paperPnL?.pnl || 0;
    const usdTotal  = startBal + pnl;
    const active    = usdTotal * ((cap.activePct || 70) / 100);
    const reserve   = usdTotal * ((cap.reservePct || 30) / 100);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("cap-active",        "$" + active.toFixed(2));
    set("cap-reserve",       "$" + reserve.toFixed(2));
    set("cap-usd-total",     "$" + usdTotal.toFixed(2));
    set("cap-autoconvert",   cap.autoConversion ? "ON ⚠️" : "OFF");
    set("cap-bar-active-label",  "Active " + (cap.activePct || 70) + "%");
    set("cap-bar-reserve-label", "Reserve " + (cap.reservePct || 30) + "%");

    const bar = document.getElementById("cap-bar-active");
    if (bar) bar.style.width = (cap.activePct || 70) + "%";

    const pctInput = document.getElementById("cap-active-pct");
    if (pctInput) pctInput.value = cap.activePct || 70;

    // Role badge
    const badge = document.getElementById("capital-xrp-badge");
    if (badge) {
      const roleMap = { "HOLD_ASSET": ["🔒 XRP: HOLD ASSET", "ctrl-badge-green"], "ACTIVE": ["⚡ XRP: ACTIVE", "ctrl-badge-yellow"], "AGGRESSIVE": ["🔥 XRP: AGGRESSIVE", "ctrl-badge-red"] };
      const [text, cls] = roleMap[cap.xrpRole] || roleMap["HOLD_ASSET"];
      badge.textContent = text; badge.className = "ctrl-badge " + cls;
    }

    // Role buttons
    ["hold","active","aggressive"].forEach(r => {
      const btn = document.getElementById("cap-btn-" + r);
      if (btn) btn.classList.toggle("active-role", cap.xrpRole === r.toUpperCase().replace("HOLD","HOLD_ASSET"));
    });
    const holdBtn = document.getElementById("cap-btn-hold");
    if (holdBtn) holdBtn.classList.toggle("active-role", cap.xrpRole === "HOLD_ASSET");
    const activeBtn = document.getElementById("cap-btn-active");
    if (activeBtn) activeBtn.classList.toggle("active-role", cap.xrpRole === "ACTIVE");
    const aggBtn = document.getElementById("cap-btn-aggressive");
    if (aggBtn) aggBtn.classList.toggle("active-role", cap.xrpRole === "AGGRESSIVE");
  }

  function renderPerfPanel(perf) {
    if (!perf || !perf.totalTrades) return;
    const wr    = perf.winRate ?? 0;
    const pf    = perf.profitFactor ?? 0;
    const dd    = perf.drawdown ?? 0;
    const ap    = perf.avgProfit ?? 0;
    const al    = perf.avgLoss  ?? 0;
    const thresh = perf.adaptedThreshold ?? 75;
    const rm     = perf.adaptedRiskMultiplier ?? 1.0;

    const wrEl = document.getElementById("perf-winrate");
    if (wrEl) { wrEl.textContent = (wr * 100).toFixed(0) + "%"; wrEl.style.color = wr >= 0.55 ? "var(--green)" : wr >= 0.45 ? "var(--yellow)" : "var(--red)"; }
    const wlEl = document.getElementById("perf-wl-detail");
    if (wlEl) wlEl.textContent = perf.wins + "W / " + perf.losses + "L of " + perf.totalTrades + " trades";

    const pfEl = document.getElementById("perf-pf");
    if (pfEl) { pfEl.textContent = pf === 999 ? "∞" : pf.toFixed(2); pfEl.style.color = pf >= 1.5 ? "var(--green)" : pf >= 1.0 ? "var(--yellow)" : "var(--red)"; }

    const avgEl = document.getElementById("perf-avgpl");
    if (avgEl) { avgEl.textContent = "+" + ap.toFixed(2) + " / -" + al.toFixed(2); avgEl.style.color = ap > al ? "var(--green)" : "var(--yellow)"; }
    const avgSub = document.getElementById("perf-avgpl-sub");
    if (avgSub) avgSub.textContent = "R-ratio: " + (al > 0 ? (ap / al).toFixed(2) : "∞");

    const ddEl = document.getElementById("perf-drawdown");
    if (ddEl) { ddEl.textContent = dd.toFixed(2) + "%"; ddEl.style.color = dd >= 5 ? "var(--red)" : dd >= 2 ? "var(--yellow)" : "var(--green)"; }

    // Adaptations
    const badges = [];
    if (thresh > 75) badges.push({ text: "⬆ Threshold " + thresh + " (low win rate)", cls: "adapt-warn" });
    else if (thresh < 75) badges.push({ text: "⬇ Threshold " + thresh + " (high win rate)", cls: "adapt-good" });
    else badges.push({ text: "Threshold 75 (default)", cls: "adapt-default" });
    if (rm < 1.0) badges.push({ text: "⬇ Risk " + (rm * 100).toFixed(0) + "% (drawdown guard)", cls: "adapt-danger" });
    else if (rm > 1.0) badges.push({ text: "⬆ Risk " + (rm * 100).toFixed(0) + "% (good performance)", cls: "adapt-good" });
    else badges.push({ text: "Risk 100% (default)", cls: "adapt-default" });
    if (perf.consecutiveLosses >= 2) badges.push({ text: "⚡ Leverage locked (loss streak)", cls: "adapt-warn" });
    if (dd >= 3) badges.push({ text: "⚠ Risk halved (drawdown > 3%)", cls: "adapt-danger" });
    if (dd >= 5) badges.push({ text: "🚨 Kill switch zone", cls: "adapt-danger" });

    const adaptEl = document.getElementById("perf-adaptations");
    if (adaptEl) adaptEl.innerHTML = badges.map(b => \`<span class="perf-adapt-badge \${b.cls}">\${b.text}</span>\`).join("");
  }

  function signalQualityLabel(score) {
    if (score >= 90) return { label: "🔥 High Quality Setup",  color: "var(--green)"  };
    if (score >= 75) return { label: "✅ Valid Setup",          color: "var(--green)"  };
    if (score >= 55) return { label: "🟡 Medium Setup",         color: "var(--yellow)" };
    if (score >= 30) return { label: "⚠️ Weak Setup",          color: "var(--yellow)" };
    return              { label: "🔴 Avoid Zone",             color: "var(--red)"    };
  }

  function detectRegime(latest) {
    if (!latest) return "UNKNOWN";
    const vol = latest.volatility;
    if (vol?.level === "HIGH" || (parseFloat(vol?.spikeRatio) > 1.8)) return "VOLATILE";
    const score = latest.signalScore || 0;
    if (score >= 50) return "TRENDING";
    return "RANGE";
  }

  function renderLiveStatus(data) {
    const latest = data.latest;
    if (!latest) return;

    const regime      = detectRegime(latest);
    const score       = latest.signalScore ?? null;
    const effLev      = latest.effectiveLeverage || latest.volatility?.leverage;
    const isPaper     = data.control?.paperTrading !== false;

    // Market regime badge
    const regimeEl = document.getElementById("live-regime");
    const regimeItem = document.getElementById("live-regime-item");
    if (regimeEl && regimeItem) {
      regimeItem.style.display = "";
      const regimeClass = regime === "TRENDING" ? "regime-trending" : regime === "VOLATILE" ? "regime-volatile" : "regime-range";
      const regimeIcon  = regime === "TRENDING" ? "📈" : regime === "VOLATILE" ? "⚡" : "↔️";
      regimeEl.className = "live-status-item " + regimeClass;
      regimeEl.textContent = regimeIcon + " " + regime;
    }

    // Confidence score bar
    if (score !== null) {
      const confItem = document.getElementById("live-confidence-item");
      const confBar  = document.getElementById("live-confidence-bar");
      const confVal  = document.getElementById("live-confidence-val");
      if (confItem) confItem.style.display = "";
      if (confBar)  { confBar.style.width = score + "%"; confBar.style.background = score >= 75 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)"; }
      if (confVal)  { confVal.textContent = score.toFixed(0); confVal.style.color = score >= 75 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)"; }
    }

    // Leverage badge
    if (effLev !== undefined) {
      const levItem  = document.getElementById("live-leverage-item");
      const levBadge = document.getElementById("live-leverage-badge");
      if (levItem)  levItem.style.display = "";
      if (levBadge) levBadge.textContent = "⚡ " + effLev + "x";
    }

    // Mode bar
    const modeBar = document.getElementById("live-mode-bar");
    if (modeBar) modeBar.textContent = (isPaper ? "📋 PAPER" : "🔴 LIVE") + " · 5m · XRPUSDT";
  }

  function switchTab(tab) {
    const isDash = tab === "dashboard";
    document.getElementById("dashboard-page").style.display = isDash ? "" : "none";
    document.getElementById("info-page").style.display      = isDash ? "none" : "block";
    document.getElementById("tab-dashboard").classList.toggle("active", isDash);
    document.getElementById("tab-info").classList.toggle("active", !isDash);
  }

  let currentView = "simple";
  let lastRenderData = null;

  function setView(v) {
    currentView = v;
    document.getElementById("toggle-simple").classList.toggle("active", v === "simple");
    document.getElementById("toggle-advanced").classList.toggle("active", v === "advanced");
    document.getElementById("reasoning-summary").style.display     = v === "simple"   ? "" : "none";
    document.getElementById("reasoning-summary-adv").style.display = v === "advanced" ? "" : "none";
    document.getElementById("reasoning-timeline").style.display          = v === "simple"   ? "" : "none";
    document.getElementById("reasoning-timeline-advanced").style.display = v === "advanced" ? "" : "none";
    if (lastRenderData) {
      renderSafetyCheck(lastRenderData.latest);
      renderTradeTable(lastRenderData.recentTrades);
      renderHeatmap(lastRenderData.allLogs);
    }
  }

  function simpleNote(r) {
    const mode  = r["Mode"]  || "";
    const notes = r["Notes"] || "";
    if (mode === "PAPER" || mode === "LIVE") return "Bought — all signals aligned";
    if (notes.includes("RSI") && notes.includes("below 30"))                         return "Skipped — market wasn't at the right dip level yet";
    if (notes.includes("RSI") && notes.includes("above 50") && notes.includes("falling")) return "Skipped — price was still dropping";
    if (notes.includes("RSI") && notes.includes("above 50") && notes.includes("rising"))  return "Skipped — market was overheated";
    if (notes.includes("RSI") && notes.includes("above 70"))                         return "Skipped — market was too hot to enter";
    if (notes.includes("RSI") && notes.includes("below 50"))                         return "Skipped — momentum wasn't ready";
    if (notes.includes("Market bias") || notes.includes("market bias"))              return "Skipped — no clear market direction";
    if (notes.includes("overextended"))                                              return "Skipped — price moved too far too fast";
    if (notes.includes("VWAP"))                                                      return "Skipped — sellers were in control";
    if (notes.includes("EMA"))                                                       return "Skipped — trend wasn't confirmed";
    return "Skipped — conditions weren't right";
  }

  function renderTradeTable(recentTrades) {
    const tbody = document.getElementById("trade-table-body");
    const thead = document.getElementById("trade-table-head");
    if (!recentTrades || !recentTrades.length) {
      tbody.innerHTML = \`<tr class="empty-row"><td colspan="6">No trades recorded yet</td></tr>\`;
      return;
    }
    const simple = currentView === "simple";
    if (thead) {
      thead.innerHTML = simple
        ? \`<tr><th>Date</th><th>Time</th><th>Symbol</th><th>Price</th><th>Result</th><th>What Happened</th></tr>\`
        : \`<tr><th>Date</th><th>Time (UTC)</th><th>Symbol</th><th>Side</th><th>Price</th><th>Total</th><th>Mode</th><th>Notes</th></tr>\`;
    }
    tbody.innerHTML = recentTrades.map(r => {
      const mode      = r["Mode"] || "";
      const modeClass = mode === "PAPER" ? "mode-paper" : mode === "LIVE" ? "mode-live" : "mode-blocked";
      const price     = r["Price"] ? "$" + parseFloat(r["Price"]).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:4 }) : "—";
      const total     = r["Total USD"] ? "$" + parseFloat(r["Total USD"]).toFixed(2) : "—";
      if (simple) {
        const resultLabel = mode === "PAPER" ? "✅ Paper Buy" : mode === "LIVE" ? "✅ Live Buy" : "⛔ Skipped";
        const noteText    = simpleNote(r);
        return \`
          <tr>
            <td>\${r["Date"]||"—"}</td>
            <td>\${(r["Time (UTC)"]||"—").slice(0,5)}</td>
            <td>\${r["Symbol"]||"—"}</td>
            <td>\${price}</td>
            <td class="\${modeClass}">\${resultLabel}</td>
            <td style="color:var(--muted)">\${noteText}</td>
          </tr>\`;
      }
      return \`
        <tr>
          <td>\${r["Date"]||"—"}</td>
          <td>\${r["Time (UTC)"]||"—"}</td>
          <td>\${r["Symbol"]||"—"}</td>
          <td>\${r["Side"]||"—"}</td>
          <td>\${price}</td>
          <td>\${total}</td>
          <td class="\${modeClass}">\${mode}</td>
          <td style="color:var(--muted);max-width:300px;overflow:hidden;text-overflow:ellipsis">\${r["Notes"]||"—"}</td>
        </tr>\`;
    }).join("");
  }

  function simpleLabel(run) {
    if (run.allPass) return "✅ Strong Buy Opportunity";
    const failed = (run.conditions || []).filter(c => !c.pass);
    if (!failed.length) return "⚠️ Unclear Conditions";
    const f = failed[0];
    if (f.label === "Market bias") return "⚠️ Unclear Conditions";
    if (f.label.includes("RSI")) {
      const rsi = run.indicators?.rsi3;
      if (rsi != null) return rsi > 70 ? "❌ Market Too Hot" : "❌ Weak Setup";
      return "❌ Weak Setup";
    }
    if (f.label.includes("overextended")) return "❌ Overextended — Too Risky";
    if (f.label.includes("EMA"))  return "❌ Trend Not Confirmed";
    return "❌ No Clear Opportunity";
  }

  function simpleReason(run) {
    if (run.allPass) {
      const p = run.price < 10 ? run.price.toFixed(4) : run.price.toLocaleString("en-US", { minimumFractionDigits: 2 });
      return \`Bought — strong dip in an uptrend, high-probability setup at $\${p}\`;
    }
    const failed = (run.conditions || []).filter(c => !c.pass);
    if (!failed.length) return "Skipped — no clear opportunity at this time";
    const f = failed[0];
    if (f.label === "Market bias")        return "Skipped — market had no clear direction, buyers and sellers were balanced";
    if (f.label.includes("RSI")) {
      const rsi = run.indicators?.rsi3;
      if (rsi != null) {
        if (rsi > 70) return "Skipped — market was too overheated to safely buy";
        if (rsi > 30) return "Skipped — price was still dropping, waiting for the right dip";
        return "Skipped — momentum not at the right level yet";
      }
      return "Skipped — momentum not ready for entry";
    }
    if (f.label.includes("overextended")) return "Skipped — price moved too far too fast, waiting for it to calm down";
    if (f.label.includes("VWAP"))         return "Skipped — sellers were in control of the session";
    if (f.label.includes("EMA"))          return "Skipped — price trend wasn't confirmed, too risky to enter";
    return "Skipped — conditions weren't aligned for a safe trade";
  }

  function getConfidence(run) {
    if (run.allPass) return "high";
    const total = (run.conditions || []).length;
    if (!total) return "low";
    const passed = (run.conditions || []).filter(c => c.pass).length;
    return (passed >= total - 1 && total > 1) ? "med" : "low";
  }

  function groupRuns(runs) {
    const groups = [];
    for (const run of runs) {
      if (!run.allPass && groups.length) {
        const last    = groups[groups.length - 1];
        const curKey  = (run.conditions || []).find(c => !c.pass)?.label || "";
        const lastKey = last.isGroup
          ? last.reason
          : (last.run.conditions || []).find(c => !c.pass)?.label || "";
        if (curKey && curKey === lastKey && !last.run?.allPass) {
          if (last.isGroup) { last.count++; last.latestTime = run.timestamp; }
          else groups[groups.length - 1] = { isGroup: true, run: last.run, count: 2, reason: curKey, latestTime: run.timestamp };
          continue;
        }
      }
      groups.push({ isGroup: false, run });
    }
    return groups;
  }

  function renderReasoning(recentLogs) {
    if (!recentLogs || !recentLogs.length) {
      document.getElementById("reasoning-summary").textContent     = "No run history yet.";
      document.getElementById("reasoning-summary-adv").textContent = "No run history yet.";
      document.getElementById("reasoning-timeline").innerHTML          = "";
      document.getElementById("reasoning-timeline-advanced").innerHTML = "";
      return;
    }

    const blocked = recentLogs.filter(r => !r.allPass);
    const traded  = recentLogs.filter(r => r.allPass);
    const n = recentLogs.length;

    // ── Simple summary ────────────────────────────────────────────────────────
    let simpleSummary = "";
    if (traded.length === 0) {
      simpleSummary = \`The bot checked \${n} time\${n > 1 ? "s" : ""} recently and didn't find a good entry. <strong>This is normal</strong> — it only acts when everything aligns perfectly, so most checks will be skipped.\`;
    } else if (blocked.length === 0) {
      simpleSummary = \`All \${n} recent checks found a good entry — the bot has been consistently active and finding setups.\`;
    } else {
      simpleSummary = \`Out of \${n} recent checks, <strong>\${traded.length} resulted in a trade</strong> and \${blocked.length} were skipped. Skipped checks mean conditions weren't right — the bot is being selective, which is healthy.\`;
    }

    // ── Advanced summary (original) ───────────────────────────────────────────
    const reasonCount = {};
    for (const run of blocked) {
      const key = (run.conditions || []).filter(c => !c.pass)[0]?.label || "Unknown";
      reasonCount[key] = (reasonCount[key] || 0) + 1;
    }
    const topReason = Object.entries(reasonCount).sort((a, b) => b[1] - a[1])[0];
    let advSummary = "";
    if (traded.length === 0) {
      advSummary = \`The bot has checked \${n} time\${n > 1 ? "s" : ""} recently and been blocked every time. \`;
      if (topReason?.[0] === "Market bias") {
        advSummary += \`The market has <strong>no clear direction</strong> — price keeps landing between VWAP and EMA(8) with no bullish or bearish lean. The bot waits for one side to take control before it acts. \`;
      } else if (topReason) {
        advSummary += \`The most common block: <strong>\${topReason[0]}</strong>. \`;
      }
      advSummary += \`This is the strategy working correctly — no signal, no trade.\`;
    } else if (blocked.length === 0) {
      advSummary = \`All \${n} recent runs fired a trade. The bot is finding setups consistently.\`;
    } else {
      advSummary = \`Out of \${n} recent runs, <strong>\${traded.length} resulted in a trade</strong> and \${blocked.length} were blocked. \`;
      if (topReason) advSummary += \`Most common block reason: <strong>\${topReason[0]}</strong>.\`;
    }

    // ── Simple timeline (with grouping) ──────────────────────────────────────
    const simpleHtml = groupRuns(recentLogs).map(g => {
      if (g.isGroup) {
        return \`
          <div class="run-group-item">
            <div class="conf-dot conf-low"></div>
            <div class="run-group-body">
              <div class="run-group-label">\${simpleLabel(g.run)} <span class="run-group-badge">×\${g.count}</span></div>
              <div class="run-group-detail">\${simpleReason(g.run)}</div>
              <div class="run-simple-time">\${timeAgo(g.latestTime)}</div>
            </div>
          </div>\`;
      }
      const { run } = g;
      const conf = getConfidence(run);
      return \`
        <div class="run-item-simple">
          <div class="conf-dot conf-\${conf}"></div>
          <div class="run-simple-body">
            <div class="run-simple-label">\${simpleLabel(run)}</div>
            <div class="run-simple-reason">\${simpleReason(run)}</div>
            <div class="run-simple-time">\${timeAgo(run.timestamp)}</div>
          </div>
        </div>\`;
    }).join("");

    // ── Advanced timeline (original) ──────────────────────────────────────────
    const advancedHtml = recentLogs.map(run => {
      const dotClass = run.allPass ? "run-dot-traded" : "run-dot-blocked";
      const ago    = timeAgo(run.timestamp);
      const utcStr = new Date(run.timestamp).toUTCString().replace(" GMT","").slice(5,-4) + " UTC";
      const reason = run.allPass
        ? \`✅ All conditions met — \${run.paperTrading ? "paper" : "live"} trade at $\${run.price < 10 ? run.price.toFixed(4) : run.price.toLocaleString("en-US",{minimumFractionDigits:2})}\`
        : \`🚫 \${plainBlockReason(run)}\`;
      return \`
        <div class="run-item">
          <div class="run-dot \${dotClass}"></div>
          <div class="run-body">
            <div class="run-time">\${ago} &nbsp;·&nbsp; \${utcStr} &nbsp;·&nbsp; \${run.symbol} \${run.timeframe}</div>
            <div class="run-reason">\${reason}</div>
          </div>
        </div>\`;
    }).join("");

    document.getElementById("reasoning-summary").innerHTML     = simpleSummary;
    document.getElementById("reasoning-summary-adv").innerHTML = advSummary;
    document.getElementById("reasoning-timeline").innerHTML          = simpleHtml;
    document.getElementById("reasoning-timeline-advanced").innerHTML = advancedHtml;
    setView(currentView);
  }

  function render(data) {
    const { latest, stats, recentTrades } = data;

    if (latest) {
      document.getElementById("nav-symbol").textContent = latest.symbol;
      const modeEl = document.getElementById("nav-mode");
      if (latest.paperTrading) {
        modeEl.textContent = "Paper"; modeEl.className = "badge badge-paper";
      } else {
        modeEl.textContent = "Live";  modeEl.className = "badge badge-live";
      }
      document.getElementById("last-updated").textContent = "Last run " + timeAgo(latest.timestamp);
    }

    // Paper Portfolio Wallet
    const pw = data.paperPnL;
    const startBal = data.paperStartingBalance || 500;
    document.getElementById("pw-starting").textContent = "$" + startBal.toLocaleString("en-US", { minimumFractionDigits: 2 });
    if (pw && pw.tradeCount > 0) {
      const usdRemaining = startBal - pw.totalInvested;
      const xrpValue     = pw.currentValue || 0;
      const totalValue   = usdRemaining + xrpValue;
      const walletPnl    = totalValue - startBal;
      const walletPnlPct = ((walletPnl / startBal) * 100).toFixed(2);
      const pnlSign      = walletPnl >= 0 ? "+" : "";
      const avgEntry     = pw.totalQty > 0 ? pw.totalInvested / pw.totalQty : 0;
      document.getElementById("pw-usd-remaining").textContent = "$" + usdRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("pw-usd-spent").textContent     = "$" + pw.totalInvested.toFixed(2) + " spent";
      document.getElementById("pw-xrp-held").textContent      = pw.totalQty.toFixed(4) + " XRP";
      document.getElementById("pw-xrp-value").textContent     = xrpValue > 0 ? "current value: $" + xrpValue.toFixed(2) : "current value: —";
      document.getElementById("pw-trade-count").textContent   = pw.tradeCount;
      document.getElementById("pw-avg-entry").textContent     = avgEntry > 0 ? "avg entry: $" + avgEntry.toFixed(4) : "avg entry: —";
      const totalEl = document.getElementById("pw-total-value");
      totalEl.textContent = "$" + totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 });
      totalEl.className = "paper-wallet-total-value " + (walletPnl > 0 ? "pnl-pos" : walletPnl < 0 ? "pnl-neg" : "");
      const pnlEl = document.getElementById("pw-pnl");
      pnlEl.textContent = pnlSign + "$" + Math.abs(walletPnl).toFixed(2) + " (" + pnlSign + walletPnlPct + "%)";
      pnlEl.className = "paper-wallet-pnl " + (walletPnl > 0 ? "pnl-pos" : walletPnl < 0 ? "pnl-neg" : "pnl-zero");
    } else {
      document.getElementById("pw-usd-remaining").textContent = "$" + startBal.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("pw-usd-spent").textContent     = "$0 spent";
      document.getElementById("pw-xrp-held").textContent      = "0 XRP";
      document.getElementById("pw-xrp-value").textContent     = "current value: —";
      document.getElementById("pw-trade-count").textContent   = "0";
      document.getElementById("pw-avg-entry").textContent     = "avg entry: —";
      document.getElementById("pw-total-value").textContent   = "$" + startBal.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("pw-pnl").textContent           = "$0.00 (0.00%)";
      document.getElementById("pw-pnl").className             = "paper-wallet-pnl pnl-zero";
    }

    // Paper P&L
    const p = data.paperPnL;
    if (p && p.tradeCount > 0) {
      const pnlEl  = document.getElementById("pnl-value");
      const pnlSign = p.pnl >= 0 ? "+" : "";
      pnlEl.textContent = pnlSign + "$" + Math.abs(p.pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      pnlEl.className   = "pnl-value " + (p.pnl > 0 ? "pnl-pos" : p.pnl < 0 ? "pnl-neg" : "pnl-zero");
      document.getElementById("pnl-pct").textContent      = pnlSign + p.pnlPct.toFixed(2) + "%";
      document.getElementById("pnl-current").textContent  = p.currentValue > 0 ? "$" + p.currentValue.toFixed(2) : "—";
      document.getElementById("pnl-qty").textContent      = p.totalQty.toFixed(4) + " units held";
      document.getElementById("pnl-invested").textContent = "$" + p.totalInvested.toFixed(2);
      document.getElementById("pnl-trades").textContent   = p.tradeCount + " paper trade" + (p.tradeCount !== 1 ? "s" : "");
      const avgEntry = p.totalQty > 0 ? p.totalInvested / p.totalQty : 0;
      document.getElementById("pnl-avg-entry").textContent = avgEntry > 0 ? "$" + avgEntry.toFixed(4) : "—";
      const curPrice = data.latest?.price;
      document.getElementById("pnl-current-price").textContent = curPrice ? "current: $" + curPrice.toFixed(4) : "current: —";

      const wlEl = document.getElementById("pnl-wl-ratio");
      const ratio = p.losses > 0 ? (p.wins / p.losses).toFixed(2) + ":1" : p.wins > 0 ? p.wins + ":0" : "—";
      wlEl.textContent = ratio;
      wlEl.className = "pnl-value " + (p.wins > p.losses ? "pnl-pos" : p.losses > p.wins ? "pnl-neg" : "pnl-zero");
      document.getElementById("pnl-wl-detail").textContent = \`\${p.wins}W / \${p.losses}L · \${p.winRate.toFixed(0)}% win rate\`;
    }

    document.getElementById("stat-total").textContent   = stats.total;
    document.getElementById("stat-fired").textContent   = stats.fired;
    document.getElementById("stat-blocked").textContent = stats.blocked;
    document.getElementById("stat-today").textContent   = stats.todayCount;
    document.getElementById("stat-today-sub").textContent =
      \`of \${latest?.limits?.maxTradesPerDay ?? 3} max today\`;

    if (latest) {
      const { price, indicators, timestamp } = latest;
      const bias = latest.conditions.find(c => c.label === "Market bias");
      const biasVal = bias ? bias.actual : (latest.allPass ? "Active" : "Neutral");

      document.getElementById("indicators-content").innerHTML = \`
        <div class="indicator-row">
          <span class="ind-label">Price</span>
          <span class="ind-value">\${price < 100 ? "$" + price.toFixed(4) : "$" + price.toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </div>
        <div class="indicator-row">
          <span class="ind-label">EMA(8)</span>
          <span class="ind-value" style="color:var(--purple)">\${indicators.ema8 < 100 ? "$" + indicators.ema8.toFixed(4) : "$" + indicators.ema8.toFixed(2)}</span>
        </div>
        <div class="indicator-row">
          <span class="ind-label">VWAP</span>
          <span class="ind-value" style="color:var(--blue)">\${indicators.vwap < 100 ? "$" + indicators.vwap.toFixed(4) : "$" + indicators.vwap.toFixed(2)}</span>
        </div>
        <div class="indicator-row">
          <span class="ind-label">RSI(3)</span>
          <span class="ind-value" style="color:var(--yellow)">\${indicators.rsi3 !== null ? indicators.rsi3.toFixed(2) : "N/A"}</span>
        </div>
        <div class="indicator-row">
          <span class="ind-label">Bias</span>
          <span class="ind-value \${biasClass(biasVal)}">\${biasVal}</span>
        </div>
        <div class="indicator-row">
          <span class="ind-label">Volatility</span>
          \${latest.volatility
            ? \`<span class="ind-value" style="color:\${latest.volatility.stable ? "var(--green)" : "var(--yellow)"}">\${latest.volatility.stable ? "✅ Stable" : "⚠️ Chaotic"}</span>\`
            : \`<span class="ind-value" style="color:var(--muted)">—</span>\`}
        </div>
        <div class="indicator-row">
          <span class="ind-label">Leverage</span>
          \${latest.effectiveLeverage
            ? \`<span class="ind-value" style="color:\${latest.volatility?.stable ? "var(--blue)" : "var(--yellow)"}">\${latest.effectiveLeverage}x \${latest.volatility?.stable ? "" : "(capped — chaotic)"}</span>\`
            : \`<span class="ind-value" style="color:var(--muted)">—</span>\`}
        </div>
        <div class="indicator-row">
          <span class="ind-label">Checked</span>
          <span class="ind-value" style="font-size:13px;color:var(--muted)">\${new Date(timestamp).toUTCString().replace(" GMT","").slice(0,-4)} UTC</span>
        </div>
      \`;

      renderSafetyCheck(latest);
    }

    const safe = (name, fn) => { try { fn(); } catch (e) { console.warn("[render]", name, "failed:", e.message); } };
    safe("portfolio", () => renderPortfolioPanel(data.portfolioState, data.perfState, data.position, livePrice));
    safe("capital",   () => renderCapitalPanel(data.capitalState, data.paperPnL));
    safe("perf",      () => renderPerfPanel(data.perfState));
    safe("control",   () => renderControl(data.control));
    safe("liveStatus",() => renderLiveStatus(data));
    safe("position",  () => renderPosition(data.position, data.latest?.price));
    lastRenderData = data;
    safe("tradeTable", () => renderTradeTable(recentTrades));
    safe("reasoning",  () => renderReasoning(data.recentLogs));
    safe("health",     () => renderHealthStatus(data.latest));
    safe("rsiHistory", () => renderRSIHistory(data.allLogs));
    safe("heatmap",    () => renderHeatmap(data.allLogs));
  }

  // ── SSE live stream ────────────────────────────────────────────────────────
  function connectStream() {
    const es = new EventSource("/api/stream");

    es.addEventListener("data", e => {
      try { render(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener("balance", e => {
      try { renderBalance(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener("error", () => {
      es.close();
      setTimeout(connectStream, 3000);
    });
  }
  connectStream();

  // ── Kraken WebSocket — real-time live price ───────────────────────────────
  let livePrice = null;

  let prevTickerPrice = null;
  let sessionOpenPrice = null;
  let priceHigh = null, priceLow = null;
  let liveCandle = null; // current 5m candle being built from WS ticks
  let priceHistory = []; // last 60 ticks for sparkline
  let portfolioHistory = []; // last 60 portfolio values for sparkline
  let portfolioOpenValue = null;

  function updateLivePrice(price) {
    livePrice = price;
    if (sessionOpenPrice === null) sessionOpenPrice = price;
    if (priceHigh === null || price > priceHigh) priceHigh = price;
    if (priceLow  === null || price < priceLow)  priceLow  = price;

    // Hero ticker
    const tp = document.getElementById("ticker-price");
    const ta = document.getElementById("ticker-arrow");
    const tpnl = document.getElementById("ticker-pnl");
    const trange = document.getElementById("ticker-range");
    if (tp)   { tp.textContent = "$" + price.toFixed(4); tp.classList.remove("skeleton"); }
    if (ta && prevTickerPrice !== null) {
      if (price > prevTickerPrice)      { ta.textContent = "▲"; ta.className = "ticker-arrow up"; if (tp) tp.style.color = "var(--green)"; }
      else if (price < prevTickerPrice) { ta.textContent = "▼"; ta.className = "ticker-arrow down"; if (tp) tp.style.color = "var(--red)"; }
      setTimeout(() => { if (tp) tp.style.color = "var(--text)"; }, 600);
    }
    if (tpnl && sessionOpenPrice) {
      const pct = ((price - sessionOpenPrice) / sessionOpenPrice) * 100;
      const sign = pct >= 0 ? "+" : "";
      tpnl.textContent = sign + pct.toFixed(3) + "%";
      tpnl.style.color = pct > 0 ? "var(--green)" : pct < 0 ? "var(--red)" : "var(--muted)";
    }
    if (trange && priceHigh && priceLow) trange.textContent = "$" + priceLow.toFixed(4) + " — $" + priceHigh.toFixed(4);
    prevTickerPrice = price;

    // Update price in indicators panel
    const rows = document.querySelectorAll("#indicators-content .indicator-row");
    if (rows.length > 0) {
      const val = rows[0].querySelector(".ind-value");
      if (val) val.textContent = "$" + price.toFixed(4);
    }

    // Update open position P&L + bar live
    if (lastRenderData?.position?.open) renderPosition(lastRenderData.position, price);
    if (lastRenderData) renderPortfolioPanel(lastRenderData.portfolioState, lastRenderData.perfState, lastRenderData.position, price);

    // Push to sparkline history (keep last 60 ticks)
    priceHistory.push(price);
    if (priceHistory.length > 60) priceHistory.shift();
    renderSparkline();

    // Update live candle on chart (TradingView-style)
    updateLiveCandle(price);

    // Update portfolio sparkline + hero value
    updatePortfolioLive(price);
  }

  function updatePortfolioLive(price) {
    if (!lastRenderData) return;
    const port = lastRenderData.portfolioState || {};
    const pos  = lastRenderData.position;
    const realized = parseFloat(port.realizedPnl || 0);
    const baseBalance = parseFloat(port.totalBalanceUSD || 100);
    const unrealized = pos?.open ? ((price - pos.entryPrice) / pos.entryPrice * pos.tradeSize) : 0;
    const totalValue = baseBalance + unrealized;

    if (portfolioOpenValue === null) portfolioOpenValue = totalValue;
    portfolioHistory.push(totalValue);
    if (portfolioHistory.length > 60) portfolioHistory.shift();

    const hv = document.getElementById("port-hero-value");
    const hc = document.getElementById("port-hero-change");
    if (hv) hv.textContent = "$" + totalValue.toFixed(2);
    if (hc && portfolioOpenValue) {
      const change    = totalValue - portfolioOpenValue;
      const changePct = (change / portfolioOpenValue) * 100;
      const sign = change >= 0 ? "+" : "";
      hc.textContent = sign + "$" + Math.abs(change).toFixed(2) + " (" + sign + changePct.toFixed(3) + "%)";
      hc.style.color = change > 0 ? "var(--green)" : change < 0 ? "var(--red)" : "var(--muted)";
      if (hv) hv.style.color = change > 0 ? "var(--green)" : change < 0 ? "var(--red)" : "var(--text)";
    }

    renderPortfolioSparkline();
  }

  function renderPortfolioSparkline() {
    const svg = document.getElementById("portfolio-sparkline");
    if (!svg || portfolioHistory.length < 2) return;
    const w = 180, h = 40;
    const min = Math.min(...portfolioHistory), max = Math.max(...portfolioHistory);
    const range = (max - min) || 0.001;
    const pts = portfolioHistory.map((v, i) => {
      const x = (i / (portfolioHistory.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    const last = portfolioHistory[portfolioHistory.length - 1];
    const first = portfolioHistory[0];
    const color = last >= first ? "#00FF9A" : "#FF4D6A";
    const fillColor = last >= first ? "rgba(0,255,154,0.12)" : "rgba(255,77,106,0.12)";
    // Build area fill path
    const areaPath = "M0," + h + " L" + pts.replace(/,/g, " ").split(" ").map((v,i) => i % 2 === 0 ? v : v).join(",").replace(/,([0-9.]+),/g, ' L$1,').replace(/^L/,'') + " L" + w + "," + h + " Z";
    svg.innerHTML =
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + (w).toFixed(1) + '" cy="' + (h - ((last - min) / range) * (h - 4) - 2).toFixed(1) + '" r="3" fill="' + color + '"/>';
  }

  function renderSparkline() {
    const svg = document.getElementById("ticker-sparkline");
    if (!svg || priceHistory.length < 2) return;
    const w = 120, h = 28;
    const min = Math.min(...priceHistory), max = Math.max(...priceHistory);
    const range = (max - min) || 0.0001;
    const pts = priceHistory.map((p, i) => {
      const x = (i / (priceHistory.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    const last = priceHistory[priceHistory.length - 1];
    const first = priceHistory[0];
    const color = last >= first ? "#00FF9A" : "#FF4D6A";
    svg.innerHTML = '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function updateLiveCandle(price) {
    if (!candleSeries) return;
    // 5m bucket: floor to 300-second boundary
    const now = Math.floor(Date.now() / 1000);
    const bucketTime = Math.floor(now / 300) * 300;

    if (!liveCandle || liveCandle.time !== bucketTime) {
      // New candle bucket
      liveCandle = { time: bucketTime, open: price, high: price, low: price, close: price };
    } else {
      // Update existing candle
      liveCandle.high = Math.max(liveCandle.high, price);
      liveCandle.low  = Math.min(liveCandle.low,  price);
      liveCandle.close = price;
    }
    try { candleSeries.update(liveCandle); } catch {}
  }

  function connectTickerWS() {
    const ws = new WebSocket("wss://ws.kraken.com");
    ws.onopen = () => { wsConnected = true; ws.send(JSON.stringify({ event: "subscribe", pair: ["XRP/USD"], subscription: { name: "ticker" } })); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (Array.isArray(msg) && msg[2] === "ticker") updateLivePrice(parseFloat(msg[1].c[0]));
      } catch {}
    };
    ws.onclose = () => { wsConnected = false; setTimeout(connectTickerWS, 3000); };
    ws.onerror  = () => { wsConnected = false; ws.close(); };
  }
  connectTickerWS();

  // ── Agent Avila Chatbox ───────────────────────────────────────────────────
  let chatOpen = false;
  let chatHistory = [];
  let chatPending = false;

  function toggleChat() {
    chatOpen = !chatOpen;
    document.getElementById("chat-panel").classList.toggle("open", chatOpen);
    document.getElementById("chat-unread").style.display = "none";
    if (chatOpen) setTimeout(() => document.getElementById("chat-input")?.focus(), 200);
  }

  function appendMsg(text, type, id) {
    const msgs = document.getElementById("chat-messages");
    const div  = document.createElement("div");
    div.className = "chat-msg " + type;
    div.innerHTML = text.replace(/\\n/g, "<br>").replace(/\\[EXECUTE:[^\\]]+\\]/g, "").replace(/\\[CONFIRM_REQUIRED\\]/g, "");
    if (id) div.id = id;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function chatKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
  }

  function sendSuggestion(text) {
    document.getElementById("chat-input").value = text;
    sendChat();
  }

  async function sendChat() {
    const input = document.getElementById("chat-input");
    const msg   = input.value.trim();
    if (!msg || chatPending) return;
    input.value = "";
    input.style.height = "auto";

    appendMsg(msg, "chat-msg-user");
    chatHistory.push({ role: "user", content: msg });

    chatPending = true;
    const typingEl = appendMsg("typing…", "chat-typing", "chat-typing-indicator");
    document.getElementById("chat-status").textContent = "Thinking...";

    try {
      const res  = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, history: chatHistory.slice(-8) }) });
      const data = await res.json();
      typingEl.remove();

      const reply = data.reply || "No response.";
      const cleanReply = reply.replace(/\\[EXECUTE:[^\\]]+\\]/g, "").replace(/\\[CONFIRM_REQUIRED\\]/g, "").trim();
      appendMsg(cleanReply, "chat-msg-bot");
      chatHistory.push({ role: "assistant", content: reply });

      // Show executed commands
      if (data.executed?.length) {
        appendMsg("✅ Executed: " + data.executed.join(", "), "chat-msg-executed");
      }

      // Show confirmation request
      if (data.confirmRequired && data.commands?.length) {
        const cmd = data.commands[0].cmd;
        const confirmDiv = document.createElement("div");
        confirmDiv.className = "chat-msg chat-msg-confirm";
        confirmDiv.innerHTML = \`⚠️ This command requires confirmation: <strong>\${cmd}</strong><div class="chat-confirm-btns"><button class="chat-confirm-yes" onclick="confirmChatCmd('\${cmd}', this)">✅ Confirm</button><button class="chat-confirm-no" onclick="this.closest('.chat-msg').remove()">❌ Cancel</button></div>\`;
        document.getElementById("chat-messages").appendChild(confirmDiv);
        document.getElementById("chat-messages").scrollTop = 999999;
      }

      document.getElementById("chat-status").textContent = "Ask me anything about your bot";
      if (!chatOpen) { document.getElementById("chat-unread").style.display = "flex"; }

    } catch (e) {
      typingEl.remove();
      appendMsg("❌ Error contacting assistant: " + e.message, "chat-msg-bot");
      document.getElementById("chat-status").textContent = "Error — try again";
    }
    chatPending = false;
  }

  async function confirmChatCmd(cmd, btn) {
    btn.closest(".chat-msg").remove();
    const parts = cmd.split(" ");
    try {
      const res  = await fetch("/api/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: parts[0], value: parts.slice(1).join(" ") || undefined }) });
      const data = await res.json();
      if (data.ok) appendMsg("✅ Confirmed and executed: " + cmd, "chat-msg-executed");
      else appendMsg("❌ Failed: " + (data.error || "unknown error"), "chat-msg-bot");
    } catch (e) { appendMsg("❌ " + e.message, "chat-msg-bot"); }
  }

  // ── Chart refresh (independent, every 30s) ─────────────────────────────────
  initOrUpdateChart().catch(console.error);
  setInterval(() => initOrUpdateChart().catch(console.error), 30000);
</script>
</body>
</html>`;

// ─── SSE Push ─────────────────────────────────────────────────────────────────

const sseClients = new Set();

function pushSSE(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
}

function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) { try { client.write(msg); } catch {} }
}

async function sseLoop() {
  if (sseClients.size > 0) {
    broadcastSSE("data", getApiData());
    try { broadcastSSE("balance", await fetchKrakenBalance()); } catch {}
  }
  setTimeout(sseLoop, 5000);
}
sseLoop();

// ─── Server ───────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // ── Login / Logout ──────────────────────────────────────────────────────────
  if (req.url === "/login") {
    if (req.method === "POST") {
      const body = await readBody(req);
      const params = new URLSearchParams(body);
      const email    = params.get("email")    || "";
      const password = params.get("password") || "";
      if (
        email    === (process.env.DASHBOARD_EMAIL    || "") &&
        password === (process.env.DASHBOARD_PASSWORD || "")
      ) {
        const pending = generateToken();
        pendingSessions.add(pending);
        res.writeHead(302, {
          "Set-Cookie": `pending_2fa=${pending}; HttpOnly; SameSite=Strict; Path=/`,
          Location: "/2fa",
        });
        res.end();
      } else {
        res.writeHead(401, { "Content-Type": "text/html" });
        res.end(loginPage("Invalid email or password."));
      }
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(loginPage());
    return;
  }

  if (req.url === "/logout") {
    const token = parseCookies(req.headers.cookie).session;
    if (token) sessions.delete(token);
    res.writeHead(302, {
      "Set-Cookie": "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      Location: "/login",
    });
    res.end();
    return;
  }

  // ── 2FA ─────────────────────────────────────────────────────────────────────
  if (req.url === "/2fa") {
    const pending = parseCookies(req.headers.cookie).pending_2fa;
    if (!pending || !pendingSessions.has(pending)) {
      res.writeHead(302, { Location: "/login" });
      res.end();
      return;
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const params = new URLSearchParams(body);
      const code   = params.get("code")   || "";
      const backup = params.get("backup") || "";
      const totpOk   = code   && verifyTotp(process.env.DASHBOARD_TOTP_SECRET, code);
      const backupOk = backup && process.env.DASHBOARD_BACKUP_PHRASE && backup === process.env.DASHBOARD_BACKUP_PHRASE;
      if (totpOk || backupOk) {
        pendingSessions.delete(pending);
        const token = generateToken();
        sessions.add(token);
        res.writeHead(302, {
          "Set-Cookie": [
            `session=${token}; HttpOnly; SameSite=Strict; Path=/`,
            `pending_2fa=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
          ],
          Location: "/",
        });
        res.end();
      } else {
        res.writeHead(401, { "Content-Type": "text/html" });
        res.end(twoFaPage(code ? "Invalid code — please try again." : "Invalid backup phrase."));
      }
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(twoFaPage());
    return;
  }


  // ── Bot run trigger (rate-limited, no auth — wakes Railway from sleep) ──
  if (req.url === "/api/run-bot" && req.method === "POST") {
    try {
      let lastRunAge = null;
      if (existsSync("safety-check-log.json")) {
        const log = JSON.parse(readFileSync("safety-check-log.json","utf8"));
        const last = log.trades[log.trades.length - 1];
        if (last) lastRunAge = (Date.now() - new Date(last.timestamp).getTime()) / 60000;
      }
      // Only run if stale (>4 min) to prevent abuse
      if (lastRunAge !== null && lastRunAge < 4) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, skipped: true, reason: "Last run was " + lastRunAge.toFixed(1) + " min ago" }));
        return;
      }
      console.log("[run-bot] Triggered via API (last run age: " + (lastRunAge?.toFixed(1) ?? "n/a") + " min)");
      const proc = spawn("node", ["bot.js"], { stdio: "inherit" });
      proc.on("exit", code => console.log("[run-bot] bot.js exited with code " + code));
      proc.on("error", err => console.log("[run-bot] error: " + err.message));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, triggered: true }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // ── PWA assets (no auth required) ────────────────────────────────────────
  if (req.url === "/manifest.json") {
    res.writeHead(200, { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" });
    res.end(JSON.stringify({
      name: "Agent Avila", short_name: "Avila",
      description: "Adaptive quant trading system",
      start_url: "/", display: "standalone", orientation: "portrait",
      background_color: "#0B0F1A", theme_color: "#0B0F1A",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ]
    }));
    return;
  }
  if (req.url === "/favicon.svg" || req.url === "/icon-192.png" || req.url === "/icon-512.png") {
    // Inline SVG icon — gradient lightning bolt on dark background
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
      + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00D4FF"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs>'
      + '<rect width="512" height="512" rx="96" fill="#0B0F1A"/>'
      + '<path d="M280 90 L160 280 L240 280 L210 422 L350 230 L270 230 Z" fill="url(#g)" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>'
      + '</svg>';
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" });
    res.end(svg);
    return;
  }

  // ── Public health endpoint (no auth required) ────────────────────────────
  if (req.url === "/api/health") {
    const t0 = Date.now();
    let krakenOk = false; let krakenLatency = 0;
    try { const r = await fetch("https://api.kraken.com/0/public/Time"); krakenLatency = Date.now() - t0; krakenOk = r.ok; } catch {}
    let lastRunAge = null;
    try {
      if (existsSync("safety-check-log.json")) {
        const log = JSON.parse(readFileSync("safety-check-log.json", "utf8"));
        const last = log.trades[log.trades.length - 1];
        if (last) lastRunAge = Math.round((Date.now() - new Date(last.timestamp).getTime()) / 60000);
      }
    } catch {}
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ krakenOk, krakenLatency, lastRunAge, serverTime: Date.now() }));
    return;
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (!isAuthenticated(req)) {
    res.writeHead(302, { Location: "/login" });
    res.end();
    return;
  }

  if (req.url === "/api/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    res.write(":ok\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    // Send current state immediately on connect
    pushSSE(res, "data", getApiData());
    fetchKrakenBalance().then(b => pushSSE(res, "balance", b)).catch(() => {});
    return;
  } else if (req.url === "/api/data") {
    const data = getApiData();
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(data));
  } else if (req.url === "/api/balance") {
    try {
      const data = await fetchKrakenBalance();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
  } else if (req.url === "/api/control" && req.method === "POST") {
    try {
      const body  = JSON.parse(await readBody(req));
      const ctrl  = existsSync("bot-control.json") ? JSON.parse(readFileSync("bot-control.json", "utf8")) : {};
      const { command, value } = body;
      switch (command) {
        case "START_BOT":       ctrl.stopped = false; break;
        case "STOP_BOT":        ctrl.stopped = true;  break;
        case "SET_MODE_LIVE":   ctrl.paperTrading = false; break;
        case "SET_MODE_PAPER":  ctrl.paperTrading = true;  break;
        case "PAUSE_TRADING":   ctrl.paused = true;   break;
        case "RESUME_TRADING":  ctrl.paused = false;  break;
        case "SET_LEVERAGE":         ctrl.leverage              = Math.min(Math.max(parseInt(value) || 2, 1), 3); break;
        case "SET_RISK":             ctrl.riskPct               = Math.min(Math.max(parseFloat(value) || 1, 0.1), 5); break;
        case "SET_MAX_DAILY_LOSS":   ctrl.maxDailyLossPct       = Math.min(Math.max(parseFloat(value) || 3, 0.5), 20); break;
        case "SET_COOLDOWN":         ctrl.cooldownMinutes       = Math.min(Math.max(parseFloat(value) || 15, 0), 120); break;
        case "SET_KILL_DRAWDOWN":    ctrl.killSwitchDrawdownPct = Math.min(Math.max(parseFloat(value) || 5, 1), 50); break;
        case "SET_PAUSE_LOSSES":     ctrl.pauseAfterLosses      = Math.min(Math.max(parseInt(value) || 3, 1), 10); break;
        case "SET_XRP_ROLE": {
          const cap = existsSync("capital-state.json") ? JSON.parse(readFileSync("capital-state.json","utf8")) : {};
          cap.xrpRole = ["HOLD_ASSET","ACTIVE","AGGRESSIVE"].includes(value) ? value : "HOLD_ASSET";
          cap.updatedAt = new Date().toISOString();
          writeFileSync("capital-state.json", JSON.stringify(cap, null, 2));
          break;
        }
        case "SET_AUTO_CONVERT": {
          const cap = existsSync("capital-state.json") ? JSON.parse(readFileSync("capital-state.json","utf8")) : {};
          cap.autoConversion = value === "true" || value === true;
          cap.updatedAt = new Date().toISOString();
          writeFileSync("capital-state.json", JSON.stringify(cap, null, 2));
          break;
        }
        case "SET_ACTIVE_PCT": {
          const cap = existsSync("capital-state.json") ? JSON.parse(readFileSync("capital-state.json","utf8")) : {};
          const pct = Math.min(Math.max(parseInt(value) || 70, 10), 95);
          cap.activePct = pct; cap.reservePct = 100 - pct;
          cap.updatedAt = new Date().toISOString();
          writeFileSync("capital-state.json", JSON.stringify(cap, null, 2));
          break;
        }
        case "RESET_KILL_SWITCH":    ctrl.killed = false; ctrl.paused = false; ctrl.consecutiveLosses = 0; break;
        case "RESET_COOLDOWN":       ctrl.lastTradeTime = null; break;
        case "RESET_LOSSES":         ctrl.consecutiveLosses = 0; ctrl.paused = false; break;
        default: throw new Error("Unknown command: " + command);
      }
      ctrl.updatedAt = new Date().toISOString();
      ctrl.updatedBy = command;
      writeFileSync("bot-control.json", JSON.stringify(ctrl, null, 2));
      let capState = {};
      try { if (existsSync("capital-state.json")) capState = JSON.parse(readFileSync("capital-state.json","utf8")); } catch {}
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, control: ctrl, capitalState: capState }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  } else if (req.url === "/api/control" && req.method === "GET") {
    const ctrl = existsSync("bot-control.json") ? JSON.parse(readFileSync("bot-control.json", "utf8")) : {};
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(ctrl));
  } else if (req.url === "/api/trade" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const result = await handleTradeCommand(body.command, body.params || {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  } else if (req.url === "/api/candles") {
    try {
      const data = await getChartData();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }

  } else if (req.url === "/api/chat" && req.method === "POST") {
    try {
      const { message, history = [] } = JSON.parse(await readBody(req));
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ reply: "⚠️ ANTHROPIC_API_KEY not set. Add it to your .env file to enable the assistant." })); return; }

      // Build live bot context for the system prompt
      let ctx = "";
      try {
        const log  = existsSync("safety-check-log.json") ? JSON.parse(readFileSync("safety-check-log.json","utf8")) : { trades: [] };
        const pos  = existsSync("position.json")         ? JSON.parse(readFileSync("position.json","utf8"))         : { open: false };
        const ctrl = existsSync("bot-control.json")      ? JSON.parse(readFileSync("bot-control.json","utf8"))      : {};
        const perf = existsSync("performance-state.json")? JSON.parse(readFileSync("performance-state.json","utf8")): {};
        const cap  = existsSync("capital-state.json")    ? JSON.parse(readFileSync("capital-state.json","utf8"))    : {};
        const latest = log.trades.length ? log.trades[log.trades.length - 1] : null;
        const recentExits = log.trades.filter(t => t.type === "EXIT").slice(-5);

        ctx = `
LIVE BOT STATE (${new Date().toISOString()}):
- Mode: ${ctrl.paperTrading !== false ? "PAPER TRADING" : "LIVE TRADING"}
- Bot: ${ctrl.stopped ? "STOPPED" : ctrl.paused ? "PAUSED" : "RUNNING"}
- Symbol: XRPUSDT | Timeframe: 5m

OPEN POSITION: ${pos.open ? `YES — entry $${pos.entryPrice?.toFixed(4)}, SL $${pos.stopLoss?.toFixed(4)} (-${ctrl.stopLossPct||1.25}%), TP $${pos.takeProfit?.toFixed(4)} (+${ctrl.takeProfitPct||2}%), leverage ${pos.leverage||2}x` : "None"}

LATEST RUN (${latest ? new Date(latest.timestamp).toLocaleTimeString() : "n/a"}):
- Signal score: ${latest?.signalScore ?? "n/a"}/100 | Threshold: ${latest?.perfState?.adaptedThreshold ?? 75}
- RSI: ${latest?.indicators?.rsi3?.toFixed(2) ?? "n/a"} | EMA: $${latest?.indicators?.ema8?.toFixed(4) ?? "n/a"} | VWAP: $${latest?.indicators?.vwap?.toFixed(4) ?? "n/a"}
- Market regime: ${latest?.volatility?.regime ?? "n/a"} | Price: $${latest?.price?.toFixed(4) ?? "n/a"}
- Decision: ${latest?.allPass ? "TRADE FIRED" : "SKIPPED"}
${latest?.decisionLog ? "- Decision log: " + latest.decisionLog : ""}

PERFORMANCE:
- Win rate: ${perf.winRate ? (perf.winRate*100).toFixed(0) + "%" : "n/a"} | Profit factor: ${perf.profitFactor?.toFixed(2) ?? "n/a"}
- Drawdown: ${perf.drawdown?.toFixed(2) ?? 0}% | Consecutive losses: ${perf.consecutiveLosses ?? 0}
- Adapted threshold: ${latest?.perfState?.adaptedThreshold ?? 75} | Risk multiplier: ${latest?.perfState?.riskMultiplier ?? 1}x

RISK SETTINGS:
- Leverage: ${ctrl.leverage ?? 2}x (max 3x) | Risk/trade: ${ctrl.riskPct ?? 1}%
- Max daily loss: ${ctrl.maxDailyLossPct ?? 3}% | Cooldown: ${ctrl.cooldownMinutes ?? 15} min
- Kill switch: ${ctrl.killed ? "TRIGGERED" : "Armed at " + (ctrl.killSwitchDrawdownPct ?? 5) + "% drawdown"}

CAPITAL:
- XRP role: ${cap.xrpRole ?? "HOLD_ASSET"} | Auto-convert: ${cap.autoConversion ? "ON" : "OFF"}
- Active capital: ${cap.activePct ?? 70}% | Reserve: ${cap.reservePct ?? 30}%

RECENT EXITS (last 5): ${recentExits.length ? recentExits.map(t => `${t.exitReason} ${t.pct}% ($${t.pnlUSD})`).join(", ") : "None yet"}
`;
      } catch {}

      const systemPrompt = `You are Agent Avila's trading assistant — an intelligent copilot for a live XRP trading bot on Kraken.

You have access to real-time bot state data (injected below). Your job is to help the user understand and control their trading system.

${ctx}

CAPABILITIES:
1. Explain why the bot traded or skipped (use the decision log and signal scores)
2. Analyze performance metrics and suggest improvements
3. Answer questions about risk, position, regime, and settings
4. Execute safe commands by outputting [EXECUTE: COMMAND] — these run automatically
5. Flag dangerous commands with [CONFIRM_REQUIRED] before execution

SAFE COMMANDS (auto-execute):
[EXECUTE: PAUSE_TRADING] [EXECUTE: RESUME_TRADING] [EXECUTE: START_BOT] [EXECUTE: STOP_BOT]
[EXECUTE: SET_RISK 0.5] [EXECUTE: SET_LEVERAGE 2] [EXECUTE: SET_MAX_DAILY_LOSS 3]
[EXECUTE: RESET_KILL_SWITCH] [EXECUTE: RESET_COOLDOWN] [EXECUTE: RESET_LOSSES]

CONFIRMATION REQUIRED (output [CONFIRM_REQUIRED] first):
[EXECUTE: SET_MODE_LIVE] [EXECUTE: CLOSE_POSITION] [EXECUTE: SELL_ALL]

RULES:
- Be concise and direct — max 3-4 sentences for analysis
- Use numbers from the live state, not hypotheticals
- Never suggest disabling liquidation protection or kill switch permanently
- If unsure, say so — don't invent data
- When user asks "why skip?" use the signal conditions and score breakdown
- Format numbers clearly: $1.3935, 67%, 2x`;

      const messages = [
        ...history.slice(-8),
        { role: "user", content: message }
      ];

      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 600, system: systemPrompt, messages }),
      });
      const apiData = await apiRes.json();
      if (!apiRes.ok) throw new Error(apiData.error?.message || "Claude API error");

      const reply = apiData.content[0].text;

      // Parse commands from response
      const cmdRegex = /\[EXECUTE: ([^\]]+)\]/g;
      const confirmRequired = reply.includes("[CONFIRM_REQUIRED]");
      const commands = [];
      let m;
      while ((m = cmdRegex.exec(reply)) !== null) {
        commands.push({ cmd: m[1].trim(), confirmRequired });
      }

      // Auto-execute safe commands (not confirm-required)
      const executed = [];
      if (!confirmRequired) {
        for (const { cmd } of commands) {
          try {
            const parts = cmd.split(" ");
            const command = parts[0]; const value = parts.slice(1).join(" ") || undefined;
            const ctrl = existsSync("bot-control.json") ? JSON.parse(readFileSync("bot-control.json","utf8")) : {};
            const SAFE = ["PAUSE_TRADING","RESUME_TRADING","START_BOT","STOP_BOT","SET_RISK","SET_LEVERAGE","SET_MAX_DAILY_LOSS","RESET_KILL_SWITCH","RESET_COOLDOWN","RESET_LOSSES","SET_COOLDOWN","SET_PAUSE_LOSSES"];
            if (!SAFE.includes(command)) continue;
            switch (command) {
              case "PAUSE_TRADING":   ctrl.paused = true; break;
              case "RESUME_TRADING":  ctrl.paused = false; break;
              case "START_BOT":       ctrl.stopped = false; break;
              case "STOP_BOT":        ctrl.stopped = true; break;
              case "SET_RISK":        ctrl.riskPct = Math.min(Math.max(parseFloat(value)||1, 0.1), 5); break;
              case "SET_LEVERAGE":    ctrl.leverage = Math.min(Math.max(parseInt(value)||2, 1), 3); break;
              case "SET_MAX_DAILY_LOSS": ctrl.maxDailyLossPct = Math.min(Math.max(parseFloat(value)||3, 0.5), 20); break;
              case "RESET_KILL_SWITCH":  ctrl.killed = false; ctrl.paused = false; ctrl.consecutiveLosses = 0; break;
              case "RESET_COOLDOWN":     ctrl.lastTradeTime = null; break;
              case "RESET_LOSSES":       ctrl.consecutiveLosses = 0; ctrl.paused = false; break;
              case "SET_COOLDOWN":    ctrl.cooldownMinutes = Math.min(Math.max(parseFloat(value)||15, 0), 120); break;
              case "SET_PAUSE_LOSSES": ctrl.pauseAfterLosses = Math.min(Math.max(parseInt(value)||3, 1), 10); break;
            }
            ctrl.updatedAt = new Date().toISOString(); ctrl.updatedBy = "CHAT_" + command;
            writeFileSync("bot-control.json", JSON.stringify(ctrl, null, 2));
            executed.push(command);
          } catch {}
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ reply, commands, executed, confirmRequired }));
    } catch (e) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ reply: "❌ Error: " + e.message }));
    }

  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML);
  }
});

// ─── TOTP Init ────────────────────────────────────────────────────────────────

if (!process.env.DASHBOARD_BACKUP_PHRASE) {
  const phrase = crypto.randomBytes(18).toString("base64url");
  appendFileSync(".env", `\nDASHBOARD_BACKUP_PHRASE=${phrase}\n`);
  process.env.DASHBOARD_BACKUP_PHRASE = phrase;
  console.log(`\n  Backup phrase generated: ${phrase}`);
  console.log(`  Save this somewhere safe — it lets you skip 2FA if your app is unavailable.\n`);
}

if (!process.env.DASHBOARD_TOTP_SECRET) {
  const secret = genBase32Secret();
  appendFileSync(".env", `\nDASHBOARD_TOTP_SECRET=${secret}\n`);
  process.env.DASHBOARD_TOTP_SECRET = secret;
  const account = encodeURIComponent(process.env.DASHBOARD_EMAIL || "dashboard");
  const uri = `otpauth://totp/Claude%20Trading%20Bot:${account}?secret=${secret}&issuer=Claude%20Trading%20Bot`;
  console.log(`\n  ┌─ 2FA Setup ───────────────────────────────────────────────┐`);
  console.log(`  │  Open this URL to get your QR code:                       │`);
  console.log(`  │  https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`);
  console.log(`  │                                                            │`);
  console.log(`  │  Or enter this secret manually in your app:               │`);
  console.log(`  │  ${secret.match(/.{1,4}/g).join(" ")}                     │`);
  console.log(`  └────────────────────────────────────────────────────────────┘\n`);
}

server.listen(PORT, () => {
  console.log(`\n  Dashboard → http://localhost:${PORT}\n`);
});

// ─── Embedded bot runner — only on Railway, runs every 5 minutes ─────────────
// On local Mac, the cron job already runs the bot, so we skip this to avoid duplicates.
if (process.env.RAILWAY_ENVIRONMENT) {
  const runBot = () => {
    console.log("[bot-runner] Starting bot.js…");
    const proc = spawn("node", ["bot.js"], { stdio: "inherit" });
    proc.on("exit", code => console.log(`[bot-runner] bot.js exited with code ${code}`));
    proc.on("error", err => console.log(`[bot-runner] error: ${err.message}`));
  };
  // First run after 10 seconds (let server warm up)
  setTimeout(runBot, 10000);
  // Then every 5 minutes
  setInterval(runBot, 5 * 60 * 1000);
  console.log("  Bot runner enabled (Railway env detected)");
}
