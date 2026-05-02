// Phase SV2-7B — offline Strategy V2 report formatter.
//
// Pure-function formatter. Consumes the metrics object produced by
// SV2-7A (./metrics.js) plus a small amount of report metadata (run id,
// generatedAt, optional config / data / notes) and emits two strings:
// a deterministic JSON document and a human-readable Markdown summary.
//
// File I/O is intentionally NOT in this module. Writing the strings to
// disk is the orchestrator's job (SV2-7C).
//
// Output JSON shape (stable, schema-versioned):
//   {
//     schemaVersion, phase, generatedAt, runId,
//     config, data,
//     headline, dailyRisk, strategyV2, riskAdjusted, health
//   }
//
// Output Markdown sections (per SV2-7 design):
//   Headline / Strategy V2 Outcomes / Outcome Breakdown /
//   Risk Management / Risk Adjusted / Skipped Trades /
//   Configuration Snapshot / Notes
//
// Formatting conventions (locked):
//   - Currency:   `$N,NNN.NN`        (negatives: `-$N,NNN.NN`)
//   - Signed currency for P&L: `+$N,NNN.NN` / `-$N,NNN.NN` / `$0.00`
//   - Percentage: 1 decimal place    (`4.9%`)
//   - Signed pct: `+4.9%` / `-1.9%` / `0.0%`
//   - Drawdown pct: rendered as negative (`-2.4%`)
//   - R-multiple: 2 decimals, signed (`+1.30R`, `-1.00R`)
//   - null / undefined / non-finite → `n/a`
//   - Boolean → `Yes` / `No` / `n/a`
//
// SAFETY CONTRACT
// ---------------
// 1. No imports outside backtest/**. Only sibling import: `./metrics.js`
//    for the SCHEMA_VERSION constant.
// 2. No file I/O. No network. No env reads. No clock reads — caller
//    passes `generatedAt` as a string.
// 3. No global state. Pure function: same input → bit-identical output.
// 4. Cannot mutate inputs.
// 5. No bot.js / db.js / dashboard.js / Postgres / Kraken access.
// 6. Cannot place real orders. Cannot trigger live trading.

import { SCHEMA_VERSION } from "./metrics.js";

const PHASE_TAG = "SV2-7";

// ─── Public API ────────────────────────────────────────────────────────────
export function formatReport(input = {}) {
  validateInput(input);
  const { metrics, runId, generatedAt, config = null, data = null, notes = null } = input;

  // Build the report object in a stable key order so JSON.stringify is
  // deterministic for a given input.
  const reportObj = {
    schemaVersion: SCHEMA_VERSION,
    phase:         PHASE_TAG,
    generatedAt,
    runId,
    config,
    data,
    headline:      metrics.headline,
    dailyRisk:     metrics.dailyRisk,
    strategyV2:    metrics.strategyV2,
    riskAdjusted:  metrics.riskAdjusted,
    health:        metrics.health,
  };

  const json     = JSON.stringify(reportObj, null, 2);
  const markdown = renderMarkdown(reportObj, notes);

  return { json, markdown };
}

// ─── Markdown rendering ────────────────────────────────────────────────────
function renderMarkdown(report, notes) {
  const out = [];

  // Title block
  out.push(`# Agent Avila — Strategy V2 Backtest Report`);
  out.push(``);
  out.push(`**Run ID:** \`${report.runId}\``);
  out.push(`**Generated:** ${report.generatedAt}`);
  out.push(`**Phase:** ${report.phase}`);
  out.push(`**Schema:** ${report.schemaVersion}`);
  if (report.data && typeof report.data === "object") {
    if (report.data.asset)      out.push(`**Asset:** ${report.data.asset}`);
    if (report.data.rangeStart) out.push(`**Range:** ${report.data.rangeStart} → ${report.data.rangeEnd ?? "n/a"}`);
  }
  out.push(``);

  // Headline
  const h = report.headline;
  out.push(`## Headline`);
  out.push(``);
  out.push(`| Metric | Value |`);
  out.push(`|---|---|`);
  out.push(`| Initial equity | ${fmtCurrency(h.initialEquity)} |`);
  out.push(`| Final equity | ${fmtCurrency(h.finalEquity)} |`);
  out.push(`| Total return | ${fmtPctSigned(h.totalReturnPct)} |`);
  out.push(`| Total trades | ${fmtInt(h.totalTrades)} |`);
  out.push(`| Wins / Losses / Breakevens | ${fmtInt(h.wins)} / ${fmtInt(h.losses)} / ${fmtInt(h.breakevens)} |`);
  out.push(`| Win rate | ${fmtPctFromFraction(h.winRate)} |`);
  out.push(`| Profit factor | ${fmtFloat(h.profitFactor, 2)} |`);
  out.push(`| Expectancy | ${fmtCurrencySigned(h.expectancy)} |`);
  out.push(`| Avg R | ${fmtR(h.avgR)} |`);
  out.push(`| Avg winner R / loser R | ${fmtR(h.avgWinnerR)} / ${fmtR(h.avgLoserR)} |`);
  out.push(`| Avg winner P&L / loser P&L | ${fmtCurrencySigned(h.avgWinnerPnl)} / ${fmtCurrencySigned(h.avgLoserPnl)} |`);
  out.push(`| Largest winner R / loser R | ${fmtR(h.largestWinnerR)} / ${fmtR(h.largestLoserR)} |`);
  out.push(`| Max drawdown | ${fmtNegPct(h.maxDrawdownPct)} (${fmtCurrencySigned(safeNegate(h.maxDrawdownAbs))}) |`);
  out.push(`| Longest underwater (bars) | ${fmtInt(h.longestUnderwaterBars)} |`);
  out.push(``);

  // Strategy V2 outcomes
  const sv = report.strategyV2;
  out.push(`## Strategy V2 Outcomes`);
  out.push(``);
  out.push(`| Metric | Value |`);
  out.push(`|---|---|`);
  out.push(`| TP1 hit rate | ${fmtPctFromFraction(sv.tp1HitRate)} |`);
  out.push(`| TP2 hit rate (conditional on TP1) | ${fmtPctFromFraction(sv.tp2HitRate)} |`);
  out.push(`| Perfect setups | count=${fmtInt(sv.perfect.count)}, wins=${fmtInt(sv.perfect.wins)}, winRate=${fmtPctFromFraction(sv.perfect.winRate)}, avgR=${fmtR(sv.perfect.avgR)} |`);
  out.push(`| Standard setups | count=${fmtInt(sv.standard.count)}, wins=${fmtInt(sv.standard.wins)}, winRate=${fmtPctFromFraction(sv.standard.winRate)}, avgR=${fmtR(sv.standard.avgR)} |`);
  out.push(``);

  // Outcome Breakdown
  const ob = sv.outcomeBreakdown;
  out.push(`## Outcome Breakdown`);
  out.push(``);
  out.push(`| Outcome | Count |`);
  out.push(`|---|---|`);
  out.push(`| TP1 + TP2 (full)         | ${fmtInt(ob.tp1_then_tp2)} |`);
  out.push(`| TP1 + BE-SL              | ${fmtInt(ob.tp1_then_be_sl)} |`);
  out.push(`| SL (full)                | ${fmtInt(ob.sl_full)} |`);
  out.push(`| Incomplete (end-of-data) | ${fmtInt(ob.incomplete)} |`);
  out.push(``);

  // Risk Management
  const dr = report.dailyRisk;
  out.push(`## Risk Management`);
  out.push(``);
  out.push(`| Metric | Value |`);
  out.push(`|---|---|`);
  out.push(`| Daily DD max | ${fmtNegPct(dr.dailyDrawdownMaxPct)} |`);
  out.push(`| Daily DD avg (loss days) | ${fmtNegPct(dr.dailyDrawdownAvgPct)} |`);
  out.push(`| Days hit max-trades cap | ${fmtInt(dr.daysWithMaxTradesHit)} |`);
  out.push(`| Days hit max-losses cap | ${fmtInt(dr.daysWithMaxLossesHit)} |`);
  out.push(`| Days hit DD cap | ${fmtInt(dr.daysWithDailyDdHit)} |`);
  out.push(`| Equity floor halted | ${fmtBool(dr.equityFloorHalted)} |`);
  out.push(`| Halt at | ${fmtTs(dr.haltAt)} |`);
  out.push(``);

  // Risk Adjusted
  const ra = report.riskAdjusted;
  out.push(`## Risk Adjusted`);
  out.push(``);
  out.push(`| Metric | Value |`);
  out.push(`|---|---|`);
  out.push(`| Sharpe (annualized via √365) | ${fmtFloat(ra.sharpe, 2)} |`);
  out.push(`| Sortino (annualized via √365) | ${fmtFloat(ra.sortino, 2)} |`);
  out.push(``);

  // Skipped Trades
  const sk = report.health.skippedTradesByReason;
  out.push(`## Skipped Trades`);
  out.push(``);
  out.push(`| Reason | Count |`);
  out.push(`|---|---|`);
  out.push(`| Max trades / day | ${fmtInt(sk.max_trades_day)} |`);
  out.push(`| Max losses / day | ${fmtInt(sk.max_losses_day)} |`);
  out.push(`| Max daily drawdown | ${fmtInt(sk.max_daily_drawdown)} |`);
  out.push(`| Halted (post equity floor) | ${fmtInt(sk.halted)} |`);
  out.push(``);

  // Configuration Snapshot
  out.push(`## Configuration Snapshot`);
  out.push(``);
  if (report.config && typeof report.config === "object") {
    const c = report.config;
    if (c.strategy)   { out.push(`### Strategy`);  out.push(codeBlock(c.strategy)); }
    if (c.signal)     { out.push(`### Signal`);    out.push(codeBlock(c.signal));   }
    if (c.simulator)  { out.push(`### Simulator`); out.push(codeBlock(c.simulator));}
    if (c.risk)       { out.push(`### Risk`);      out.push(codeBlock(c.risk));     }
    if (!c.strategy && !c.signal && !c.simulator && !c.risk) {
      out.push(`(no recognised config sections)`);
    }
  } else {
    out.push(`(no config provided)`);
  }
  out.push(``);

  // Notes
  out.push(`## Notes`);
  out.push(``);
  out.push(notes != null && notes.length > 0 ? notes : `(none provided)`);
  out.push(``);

  return out.join("\n");
}

function codeBlock(obj) {
  return "```json\n" + JSON.stringify(obj, null, 2) + "\n```";
}

// ─── Number / value formatters ─────────────────────────────────────────────
function fmtCurrency(value) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value < 0 ? "-" : "";
  const abs  = Math.abs(value);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}.${decPart}`;
}

function fmtCurrencySigned(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (value === 0) return "$0.00";
  if (value > 0)   return `+${fmtCurrency(value)}`;
  return fmtCurrency(value);   // already prefixed with `-`
}

function fmtPctSigned(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (value === 0)  return `0.0%`;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function fmtNegPct(value) {
  // For drawdowns: treat the magnitude as positive in input, render
  // as a negative percentage. 0 stays "0.0%" (no sign).
  if (!Number.isFinite(value)) return "n/a";
  if (value === 0) return "0.0%";
  return `-${value.toFixed(1)}%`;
}

function fmtPctFromFraction(value) {
  // Input is a fraction in [0, 1] (e.g., winRate). Multiply by 100.
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function fmtR(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (value === 0) return "0.00R";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}

function fmtInt(value) {
  if (!Number.isFinite(value)) return "n/a";
  return Math.trunc(value).toString();
}

function fmtFloat(value, decimals) {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
}

function fmtBool(value) {
  if (value === true)  return "Yes";
  if (value === false) return "No";
  return "n/a";
}

function fmtTs(value) {
  // Numeric ms-epoch → ISO 8601 UTC string. Hand-rolled (no `new Date`)
  // per Codex 2026-05-02 review of SV2-7B — keeps the formatter free of
  // any platform/TZ-coupled API. Pure function of the numeric input.
  if (!Number.isFinite(value)) return "n/a";
  return msEpochToIso(value);
}

// Convert a numeric ms-epoch to an ISO 8601 UTC string ("YYYY-MM-DDTHH:MM:SS.MMMZ")
// without invoking `new Date(...)`. Uses Howard Hinnant's days-from-civil
// inverse algorithm. Deterministic and TZ-independent.
function msEpochToIso(ms) {
  const msInt    = Math.trunc(ms);
  const totalSec = Math.floor(msInt / 1000);
  let   millis   = msInt - totalSec * 1000;
  if (millis < 0) millis += 1000;   // canonicalise negative-ms remainders

  const SEC_PER_DAY = 86400;
  let days   = Math.floor(totalSec / SEC_PER_DAY);
  let remSec = totalSec - days * SEC_PER_DAY;
  if (remSec < 0) { remSec += SEC_PER_DAY; days -= 1; }
  const hh = Math.floor(remSec / 3600);
  const mm = Math.floor((remSec - hh * 3600) / 60);
  const ss = remSec - hh * 3600 - mm * 60;

  // days-since-1970-01-01 → (year, month, day)  via Hinnant's algorithm.
  const z      = days + 719468;
  const era    = Math.floor(z / 146097);
  const doe    = z - era * 146097;
  const yoe    = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const yShift = yoe + era * 400;
  const doy    = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp     = Math.floor((5 * doy + 2) / 153);
  const day    = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month  = mp + (mp < 10 ? 3 : -9);
  const year   = yShift + (month <= 2 ? 1 : 0);

  const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
  const pad3 = (n) => (n < 10 ? "00" + n : n < 100 ? "0" + n : "" + n);
  const pad4 = (n) => {
    const s = "" + Math.abs(n);
    const padded = s.length >= 4 ? s : "0".repeat(4 - s.length) + s;
    return n < 0 ? "-" + padded : padded;
  };

  return `${pad4(year)}-${pad2(month)}-${pad2(day)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}.${pad3(millis)}Z`;
}

function safeNegate(value) {
  if (!Number.isFinite(value)) return null;
  return -value;
}

// ─── Validation ────────────────────────────────────────────────────────────
function validateInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("formatReport: input must be an object");
  }
  if (!input.metrics || typeof input.metrics !== "object") {
    throw new TypeError("formatReport: input.metrics must be an object");
  }
  for (const key of ["headline", "dailyRisk", "strategyV2", "riskAdjusted", "health"]) {
    if (!input.metrics[key] || typeof input.metrics[key] !== "object") {
      throw new TypeError(`formatReport: input.metrics.${key} must be an object`);
    }
  }
  if (typeof input.runId !== "string" || input.runId.length === 0) {
    throw new TypeError("formatReport: input.runId must be a non-empty string");
  }
  if (input.runId.length > 200) {
    throw new RangeError("formatReport: input.runId exceeds 200 chars");
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(input.runId)) {
    throw new RangeError("formatReport: input.runId contains control characters");
  }
  if (input.runId.includes("..") || input.runId.includes("/") || input.runId.includes("\\")) {
    throw new RangeError("formatReport: input.runId contains path-traversal characters");
  }
  // Backtick would break the inline-code rendering of the run id in
  // the Markdown title block (`Run ID: \`...\``). Reject up front rather
  // than escape, so the JSON `runId` field stays a clean operator-supplied
  // identifier. Per Codex 2026-05-02 review of SV2-7B.
  if (input.runId.includes("`")) {
    throw new RangeError("formatReport: input.runId contains a backtick character");
  }
  if (typeof input.generatedAt !== "string" || input.generatedAt.length === 0) {
    throw new TypeError("formatReport: input.generatedAt must be a non-empty ISO timestamp string");
  }
  if (input.notes !== null && input.notes !== undefined && typeof input.notes !== "string") {
    throw new TypeError("formatReport: input.notes must be a string when provided");
  }
}
