// scripts/v2-compare.js — Phase A offline analyzer.
//
// Reads safety-check-log.json (the bot's per-cycle decision log) and prints
// a V1-vs-V2-shadow comparison report to the terminal. STRICTLY READ-ONLY:
// no writes, no mutations, no orders, no position changes.
//
// Run with:  node scripts/v2-compare.js
//
// What this analyzes
// ──────────────────
//   V1: existing strategy. Realized P&L from EXIT entries the bot has
//       already produced (paper or live, whichever the bot was in).
//   V2: shadow verdicts attached to each cycle since V2 deploy. For each
//       `decision: "TRADE"` verdict we simulate the trade by walking
//       forward through subsequent cycles' close prices and applying the
//       verdict's SL / TP1 / TP2 levels with the spec'd partial-close
//       (70% at TP1, 30% at TP2) and BE move after TP1.
//   Agreement: per-cycle V1-vs-V2 decisions.
//
// Caveat: V2 sim uses cycle CLOSE prices only. We don't have intra-cycle
// high/low in the safety-check-log, so the simulation under-counts wick-
// based TP fills and SL hits. Fine for first-pass calibration; not a
// substitute for real backtest.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const LOG_FILE = path.resolve("safety-check-log.json");

// V2 simulator settings — mirror the strategy spec
const SIM_NOTIONAL_USD = 100;       // every sim trade sized $100 notional
const TP1_FRAC = 0.70;              // 70% closed at TP1
const TP2_FRAC = 0.30;              // 30% closed at TP2
const MAX_FORWARD_CYCLES = 200;     // ~16h of 5m bars; mark unresolved beyond this

// ─── Load ────────────────────────────────────────────────────────────────────

if (!existsSync(LOG_FILE)) {
  console.error("✗ " + LOG_FILE + " not found. Run from project root.");
  process.exit(1);
}

let raw;
try { raw = JSON.parse(readFileSync(LOG_FILE, "utf8")); }
catch (e) { console.error("✗ Failed to parse safety-check-log.json: " + e.message); process.exit(1); }

const cycles = Array.isArray(raw.trades) ? raw.trades : [];
if (cycles.length === 0) {
  console.log("Log is empty. Bot has not run yet.");
  process.exit(0);
}

// ─── V1 stats (from existing EXIT entries) ──────────────────────────────────

const v1Exits = cycles.filter(c =>
  c && c.type === "EXIT" && c.exitReason !== "REENTRY_SIGNAL" &&
  Number.isFinite(parseFloat(c.pnlUSD))
);

function statsFromPnlUSD(arr) {
  const wins   = arr.filter(t => parseFloat(t.pnlUSD) >  0);
  const losses = arr.filter(t => parseFloat(t.pnlUSD) <  0);
  const totalPnl = arr.reduce((s, t) => s + parseFloat(t.pnlUSD), 0);
  const sumWins   = wins.reduce((s, t) => s + parseFloat(t.pnlUSD), 0);
  const sumLosses = losses.reduce((s, t) => s + Math.abs(parseFloat(t.pnlUSD)), 0);
  const decided = wins.length + losses.length;
  const winRate = decided > 0 ? wins.length / decided : 0;
  const avgWin  = wins.length   > 0 ? sumWins   / wins.length   : 0;
  const avgLoss = losses.length > 0 ? sumLosses / losses.length : 0;
  const profitFactor = sumLosses > 0 ? sumWins / sumLosses : (sumWins > 0 ? Infinity : 0);

  // Max drawdown of the running P&L curve
  let peak = 0, runPnl = 0, maxDD = 0;
  for (const t of arr) {
    runPnl += parseFloat(t.pnlUSD);
    if (runPnl > peak) peak = runPnl;
    const dd = peak - runPnl;
    if (dd > maxDD) maxDD = dd;
  }
  return {
    trades: arr.length, wins: wins.length, losses: losses.length,
    winRate, avgWin, avgLoss, profitFactor, totalPnl, maxDrawdown: maxDD,
  };
}

const v1Stats = statsFromPnlUSD(v1Exits);

// ─── V2 sim — walk-forward each TRADE verdict ───────────────────────────────

// Build a price track from all cycles (each cycle has a price). Used to walk
// forward from each verdict's cycle index.
const priceTrack = cycles.map((c, i) => ({
  i,
  ts: c?.timestamp || null,
  price: Number.isFinite(parseFloat(c?.price)) ? parseFloat(c.price) : null,
}));

function simulateV2Trade(startIdx, verdict) {
  const entry = parseFloat(verdict.entryPrice);
  let sl      = parseFloat(verdict.stopLoss);
  const tp1   = parseFloat(verdict.tp1);
  const tp2   = parseFloat(verdict.tp2);
  if (![entry, sl, tp1, tp2].every(Number.isFinite)) {
    return { resolved: false, reason: "invalid-levels" };
  }

  const qty = SIM_NOTIONAL_USD / entry;
  let qtyTp1 = qty * TP1_FRAC, qtyTp2 = qty * TP2_FRAC, qtyOpen = qty;
  let tp1Hit = false, pnl = 0;

  const end = Math.min(priceTrack.length - 1, startIdx + MAX_FORWARD_CYCLES);
  for (let j = startIdx + 1; j <= end; j++) {
    const p = priceTrack[j].price;
    if (!Number.isFinite(p)) continue;

    // Order matters: check SL first (worst-case in same cycle), then TPs
    if (p <= sl) {
      pnl += (sl - entry) * qtyOpen; // close remainder at SL
      return { resolved: true, reason: tp1Hit ? "BE_STOPPED" : "SL", pnlUSD: pnl, exitIdx: j, exitTs: priceTrack[j].ts, tp1Hit };
    }

    if (!tp1Hit && p >= tp1) {
      pnl += (tp1 - entry) * qtyTp1;
      qtyOpen -= qtyTp1;
      tp1Hit = true;
      sl = entry; // move to BE
      // Don't return — TP2 may also hit on the same cycle close
    }

    if (tp1Hit && p >= tp2) {
      pnl += (tp2 - entry) * qtyTp2;
      qtyOpen -= qtyTp2;
      return { resolved: true, reason: "TP2", pnlUSD: pnl, exitIdx: j, exitTs: priceTrack[j].ts, tp1Hit };
    }
  }
  return { resolved: false, reason: tp1Hit ? "OPEN_PARTIAL" : "OPEN", pnlUSD: pnl, tp1Hit };
}

const v2SimTrades = [];
for (let i = 0; i < cycles.length; i++) {
  const v = cycles[i]?.strategyV2;
  if (!v || v.decision !== "TRADE") continue;
  const sim = simulateV2Trade(i, v);
  v2SimTrades.push({ openIdx: i, openTs: cycles[i].timestamp, setupQuality: v.setupQuality, ...sim });
}

const v2Resolved = v2SimTrades.filter(t => t.resolved && Number.isFinite(t.pnlUSD));
const v2Unresolved = v2SimTrades.filter(t => !t.resolved);
const v2Stats = statsFromPnlUSD(v2Resolved);

// ─── Agreement ──────────────────────────────────────────────────────────────

const cycleAnalysis = cycles.map(c => {
  const v1Took = c?.orderPlaced === true && c?.type !== "EXIT";
  const v2Said = c?.strategyV2?.decision || "no-data";
  const agree = v2Said === "no-data" ? null : (v1Took === (v2Said === "TRADE"));
  return { v1Took, v2Said, agree, c };
});

const cyclesWithV2 = cycleAnalysis.filter(x => x.v2Said !== "no-data");
const agreed       = cyclesWithV2.filter(x => x.agree).length;
const v1Only       = cyclesWithV2.filter(x =>  x.v1Took && x.v2Said !== "TRADE");
const v2Only       = cyclesWithV2.filter(x => !x.v1Took && x.v2Said === "TRADE");

// V1 entries → look up the next EXIT to determine outcome
function findExitFor(entryIdx) {
  for (let j = entryIdx + 1; j < cycles.length; j++) {
    if (cycles[j]?.type === "EXIT" && cycles[j]?.exitReason !== "REENTRY_SIGNAL") return cycles[j];
  }
  return null;
}

const v1OnlyOutcomes = v1Only.map(x => {
  const idx = cycles.indexOf(x.c);
  const exit = findExitFor(idx);
  if (!exit) return { unresolved: true };
  return { resolved: true, pnl: parseFloat(exit.pnlUSD || 0), win: parseFloat(exit.pnlUSD || 0) > 0 };
});
const v1OnlyResolved = v1OnlyOutcomes.filter(o => o.resolved);
const v1OnlyWins   = v1OnlyResolved.filter(o => o.win).length;
const v1OnlyLoss   = v1OnlyResolved.length - v1OnlyWins;
const v1OnlyPnl    = v1OnlyResolved.reduce((s, o) => s + o.pnl, 0);

// V1 losing trades — how many had V2 say NO_TRADE (V2 filter value)
const v1Losers = v1Exits.filter(c => parseFloat(c.pnlUSD) < 0);
let v1LossesV2Rejected = 0;
for (const exit of v1Losers) {
  const exitIdx = cycles.indexOf(exit);
  // Find the entry cycle that preceded this exit (orderPlaced=true, type != EXIT)
  for (let j = exitIdx - 1; j >= 0; j--) {
    const c = cycles[j];
    if (c && c.orderPlaced === true && c.type !== "EXIT") {
      if (c.strategyV2 && c.strategyV2.decision !== "TRADE") v1LossesV2Rejected++;
      break;
    }
  }
}

// ─── Print report ───────────────────────────────────────────────────────────

const fmt$ = (n) => (n >= 0 ? "+" : "-") + "$" + Math.abs(n).toFixed(2);
const fmt$signed = (n) => (n > 0 ? "+" : n < 0 ? "-" : " ") + "$" + Math.abs(n).toFixed(2);
const pct = (n) => (n * 100).toFixed(1) + "%";
const pf  = (n) => Number.isFinite(n) ? n.toFixed(2) : "∞";

const firstTs = cycles[0]?.timestamp || "?";
const lastTs  = cycles[cycles.length - 1]?.timestamp || "?";
const spanH = (firstTs && lastTs && firstTs !== "?" && lastTs !== "?")
  ? ((new Date(lastTs).getTime() - new Date(firstTs).getTime()) / 3600000).toFixed(1)
  : "?";

const sampleNote = (n) =>
  n < 10 ? "very small (n=" + n + ") — directional only" :
  n < 30 ? "small (n=" + n + ") — caution"               :
  n < 100 ? "moderate (n=" + n + ")"                     :
            "large (n=" + n + ") — usable";

console.log("═══════════════════════════════════════════════════════════");
console.log("  V1 vs V2 SHADOW COMPARISON  (offline analyzer, read-only)");
console.log("═══════════════════════════════════════════════════════════");
console.log("  Window: " + firstTs + " → " + lastTs);
console.log("  Span:   " + spanH + "h");
console.log("  Total cycles in log:        " + cycles.length);
console.log("  Cycles with V2 shadow data: " + cyclesWithV2.length);
console.log();

console.log("─── V1 (realized P&L from EXIT entries) ───────────────────");
console.log("  Trades:          " + v1Stats.trades + "   (sample: " + sampleNote(v1Stats.trades) + ")");
console.log("  Wins / Losses:   " + v1Stats.wins + " / " + v1Stats.losses);
console.log("  Win rate:        " + pct(v1Stats.winRate));
console.log("  Total P&L:       " + fmt$signed(v1Stats.totalPnl));
console.log("  Avg win:         " + fmt$signed(v1Stats.avgWin));
console.log("  Avg loss:        " + fmt$signed(-v1Stats.avgLoss));
console.log("  Profit factor:   " + pf(v1Stats.profitFactor));
console.log("  Max drawdown:    " + fmt$signed(-v1Stats.maxDrawdown));
console.log();

console.log("─── V2 SIM (hypothetical — $" + SIM_NOTIONAL_USD + " notional) ────────────");
console.log("  TRADE verdicts:  " + v2SimTrades.length + "   (sample: " + sampleNote(v2Resolved.length) + ")");
console.log("    Resolved:      " + v2Resolved.length);
console.log("    Unresolved:    " + v2Unresolved.length + "   (still open at end of log)");
if (v2Resolved.length > 0) {
  console.log("  Wins / Losses:   " + v2Stats.wins + " / " + v2Stats.losses);
  console.log("  Win rate:        " + pct(v2Stats.winRate));
  console.log("  Total P&L (sim): " + fmt$signed(v2Stats.totalPnl));
  console.log("  Avg win:         " + fmt$signed(v2Stats.avgWin));
  console.log("  Avg loss:        " + fmt$signed(-v2Stats.avgLoss));
  console.log("  Profit factor:   " + pf(v2Stats.profitFactor));
  console.log("  Max drawdown:    " + fmt$signed(-v2Stats.maxDrawdown));
} else {
  console.log("  (no resolved V2 sim trades yet — keep shadow mode running)");
}
console.log();

console.log("─── Agreement ─────────────────────────────────────────────");
console.log("  Cycles compared:  " + cyclesWithV2.length);
console.log("  Both agreed:      " + agreed + "/" + cyclesWithV2.length +
            (cyclesWithV2.length > 0 ? "  (" + pct(agreed / cyclesWithV2.length) + ")" : ""));
console.log("  V1-only trades:   " + v1Only.length +
            (v1OnlyResolved.length > 0
              ? "   (" + v1OnlyWins + "W / " + v1OnlyLoss + "L, P&L " + fmt$signed(v1OnlyPnl) + ")"
              : ""));
console.log("  V2-only setups:   " + v2Only.length +
            "   (V2 saw a setup; V1 did not enter)");
console.log("  V1 losing trades V2 rejected: " + v1LossesV2Rejected + " of " + v1Losers.length +
            (v1Losers.length > 0 ? "   (" + pct(v1LossesV2Rejected / v1Losers.length) + ")" : ""));
console.log();

console.log("─── Caveats ───────────────────────────────────────────────");
console.log("  • V2 sim uses cycle CLOSE prices only (no intra-cycle wick).");
console.log("    Real fills would catch some TPs/SLs we miss here.");
console.log("  • V1 P&L is realized (paper or live, whichever the bot was in).");
console.log("    V2 P&L is HYPOTHETICAL at $" + SIM_NOTIONAL_USD + " notional.");
console.log("  • Sample size dominates. Treat n<30 as directional only.");
console.log("  • This script writes nothing. To re-run: node scripts/v2-compare.js");
console.log("═══════════════════════════════════════════════════════════");
