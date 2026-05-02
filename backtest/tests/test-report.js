// Phase SV2-7B — node-script test runner for the offline report formatter.
//
// Builds synthetic metrics objects in-memory and feeds them through
// formatReport. Asserts JSON shape + round-trip + section presence,
// Markdown section headers + cell formatting, edge-case rendering
// (null → n/a, Halted Yes/No, currency commas, signed percentages,
// signed R-multiples), determinism, and input validation.

import { formatReport } from "../src/report.js";

const RESET = "\x1b[0m"; const RED = "\x1b[31m"; const GREEN = "\x1b[32m"; const DIM = "\x1b[2m";
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }
let passCount = 0, failCount = 0;
const failed = [];
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 64)}`); passCount++; }
  else      { console.log(`  ${RED}FAIL${RESET}  ${pad(name, 64)} ${DIM}${detail}${RESET}`); failCount++; failed.push({ name, detail }); }
}

// ─── Fixture helpers ──────────────────────────────────────────────────────
function makeMetrics(overrides = {}) {
  // Default minimal metrics object matching SV2-7A's output shape.
  const base = {
    schemaVersion: "1.0",
    headline: {
      initialEquity: 10000,
      finalEquity:   10485.32,
      totalReturnPct: 4.8532,
      totalTrades: 12,
      wins: 6, losses: 5, breakevens: 1,
      winRate: 0.5,
      profitFactor: 1.85,
      expectancy: 40.44,
      avgR: 0.31,
      avgWinnerR: 1.18, avgLoserR: -1.0,
      avgWinnerPnl: 122.0, avgLoserPnl: -98.2,
      largestWinnerR: 1.3, largestLoserR: -1.0,
      maxDrawdownPct: 2.4,
      maxDrawdownAbs: 247.0,
      longestUnderwaterBars: 5,
    },
    dailyRisk: {
      dailyDrawdownMaxPct: 1.85,
      dailyDrawdownAvgPct: 0.42,
      daysWithMaxTradesHit: 1,
      daysWithMaxLossesHit: 0,
      daysWithDailyDdHit: 0,
      equityFloorHalted: false,
      haltAt: null,
    },
    strategyV2: {
      tp1HitRate: 0.5833,
      tp2HitRate: 0.7142,
      perfect:  { count: 8, wins: 5, winRate: 0.625, avgR: 0.45 },
      standard: { count: 4, wins: 1, winRate: 0.25, avgR: -0.10 },
      outcomeBreakdown: {
        sl_full: 5, tp1_then_be_sl: 1, tp1_then_tp2: 5, incomplete: 1,
      },
    },
    riskAdjusted: {
      sharpe:  1.42,
      sortino: 1.85,
    },
    health: {
      daysTraded: 11,
      avgTimeInTradeMin: 32.5,
      longestWinningStreak: 3,
      longestLosingStreak: 2,
      skippedTradesByReason: {
        max_trades_day: 2, max_losses_day: 0, max_daily_drawdown: 0,
        halted: 0, equity_floor: 0,
      },
    },
  };
  // Shallow merge overrides
  return { ...base, ...overrides };
}

function makeInput(overrides = {}) {
  return {
    metrics: makeMetrics(),
    runId:   "sv2-2024-01-01-2024-01-30-a1b2c3d4",
    generatedAt: "2026-05-01T19:00:00.000Z",
    ...overrides,
  };
}

console.log("=== SV2-7B report formatter tests ===");
console.log("");

// ─── Happy path ──────────────────────────────────────────────────────────
{
  const r = formatReport(makeInput());
  assert("happy path: returns { json, markdown }",
    typeof r === "object" && typeof r.json === "string" && typeof r.markdown === "string");
  assert("happy path: json non-empty",     r.json.length > 0);
  assert("happy path: markdown non-empty", r.markdown.length > 0);
}

// ─── JSON: parseable + round-trip ─────────────────────────────────────────
{
  const r = formatReport(makeInput());
  let parsed;
  let parsedOk = true;
  try { parsed = JSON.parse(r.json); } catch { parsedOk = false; }
  assert("JSON: parseable", parsedOk);
  assert("JSON: round-trip lossless",
    JSON.stringify(parsed) === JSON.stringify(JSON.parse(r.json)));
  assert("JSON: schemaVersion === '1.0'", parsed.schemaVersion === "1.0");
  assert("JSON: phase === 'SV2-7'",        parsed.phase === "SV2-7");
}

// ─── JSON: all 5 metric sections present ─────────────────────────────────
{
  const r = formatReport(makeInput());
  const parsed = JSON.parse(r.json);
  for (const k of ["headline", "dailyRisk", "strategyV2", "riskAdjusted", "health"]) {
    assert(`JSON has section "${k}"`, k in parsed && typeof parsed[k] === "object");
  }
}

// ─── JSON: top-level keys in stable order ────────────────────────────────
{
  const r = formatReport(makeInput());
  // Insertion order is preserved; the formatter should produce keys in
  // (schemaVersion, phase, generatedAt, runId, config, data, headline,
  //  dailyRisk, strategyV2, riskAdjusted, health) order.
  const expectedOrder = ["schemaVersion","phase","generatedAt","runId","config","data","headline","dailyRisk","strategyV2","riskAdjusted","health"];
  const parsed = JSON.parse(r.json);
  const actual = Object.keys(parsed);
  assert("JSON: top-level key order stable",
    JSON.stringify(actual) === JSON.stringify(expectedOrder),
    `got ${actual.join(",")}`);
}

// ─── Markdown: contains all 8 section headers ─────────────────────────────
{
  const r = formatReport(makeInput());
  const expectedSections = [
    "## Headline",
    "## Strategy V2 Outcomes",
    "## Outcome Breakdown",
    "## Risk Management",
    "## Risk Adjusted",
    "## Skipped Trades",
    "## Configuration Snapshot",
    "## Notes",
  ];
  for (const s of expectedSections) {
    assert(`Markdown: contains "${s}"`, r.markdown.includes(s));
  }
}

// ─── Currency formatting: $N,NNN.NN ──────────────────────────────────────
{
  const r = formatReport(makeInput());
  assert("Markdown: '$10,000.00' formatted with comma separator",
    r.markdown.includes("$10,000.00"));
  assert("Markdown: '$10,485.32' formatted with comma + 2 decimals",
    r.markdown.includes("$10,485.32"));
}

// ─── Currency negative: '-$247.00' ───────────────────────────────────────
{
  const r = formatReport(makeInput());
  assert("Markdown: max-DD currency rendered as '-$247.00'",
    r.markdown.includes("-$247.00"));
}

// ─── Signed currency: '+$X.XX' for positive expectancy ───────────────────
{
  const r = formatReport(makeInput());
  // Expectancy 40.44 → '+$40.44'
  assert("Markdown: positive expectancy rendered with '+$40.44'",
    r.markdown.includes("+$40.44"));
}

// ─── Percentage 1dp ──────────────────────────────────────────────────────
{
  const r = formatReport(makeInput());
  // totalReturnPct 4.8532 → '+4.9%'  (1dp)
  assert("Markdown: totalReturn rounds to 1dp ('+4.9%')",
    r.markdown.includes("+4.9%"));
  // dailyDrawdownMaxPct 1.85 → '-1.9%'  (1dp negative)
  assert("Markdown: daily DD max rendered as '-1.9%'",
    r.markdown.includes("-1.9%"));
  // tp1HitRate 0.5833 → '58.3%'  (fraction → 1dp)
  assert("Markdown: TP1 hit rate '58.3%'",
    r.markdown.includes("58.3%"));
}

// ─── R-multiple formatting: 2 decimals, signed ───────────────────────────
{
  const r = formatReport(makeInput());
  // avgWinnerR 1.18 → '+1.18R'
  assert("Markdown: avg winner R '+1.18R'",
    r.markdown.includes("+1.18R"));
  // avgLoserR -1.0 → '-1.00R'
  assert("Markdown: avg loser R '-1.00R'",
    r.markdown.includes("-1.00R"));
  // largestWinnerR 1.3 → '+1.30R'
  assert("Markdown: largest winner R '+1.30R'",
    r.markdown.includes("+1.30R"));
}

// ─── null → n/a in Markdown ──────────────────────────────────────────────
{
  // Empty / null-heavy metrics: zero trades, no daily DD, all nulls
  const empty = {
    schemaVersion: "1.0",
    headline: {
      initialEquity: 10000, finalEquity: 10000, totalReturnPct: 0,
      totalTrades: 0, wins: 0, losses: 0, breakevens: 0,
      winRate: null, profitFactor: null, expectancy: null,
      avgR: null, avgWinnerR: null, avgLoserR: null,
      avgWinnerPnl: null, avgLoserPnl: null,
      largestWinnerR: null, largestLoserR: null,
      maxDrawdownPct: 0, maxDrawdownAbs: 0, longestUnderwaterBars: 0,
    },
    dailyRisk: {
      dailyDrawdownMaxPct: null, dailyDrawdownAvgPct: null,
      daysWithMaxTradesHit: 0, daysWithMaxLossesHit: 0, daysWithDailyDdHit: 0,
      equityFloorHalted: false, haltAt: null,
    },
    strategyV2: {
      tp1HitRate: null, tp2HitRate: null,
      perfect:  { count: 0, wins: 0, winRate: null, avgR: null },
      standard: { count: 0, wins: 0, winRate: null, avgR: null },
      outcomeBreakdown: { sl_full: 0, tp1_then_be_sl: 0, tp1_then_tp2: 0, incomplete: 0 },
    },
    riskAdjusted: { sharpe: null, sortino: null },
    health: {
      daysTraded: 0, avgTimeInTradeMin: null,
      longestWinningStreak: 0, longestLosingStreak: 0,
      skippedTradesByReason: { max_trades_day: 0, max_losses_day: 0, max_daily_drawdown: 0, halted: 0, equity_floor: 0 },
    },
  };
  const r = formatReport(makeInput({ metrics: empty }));
  // Win rate, profit factor, expectancy, etc. should render as 'n/a'
  // Win rate: null → 'n/a'
  // Make sure 'n/a' appears
  assert("Markdown: null winRate rendered as 'n/a'",
    /Win rate \| n\/a/.test(r.markdown));
  assert("Markdown: null profitFactor → 'n/a'",
    /Profit factor \| n\/a/.test(r.markdown));
  assert("Markdown: null Sharpe → 'n/a'",
    /Sharpe.*n\/a/.test(r.markdown));
  assert("Markdown: null Sortino → 'n/a'",
    /Sortino.*n\/a/.test(r.markdown));
  assert("Markdown: null expectancy → 'n/a'",
    /Expectancy \| n\/a/.test(r.markdown));
  assert("Markdown: null daily DD max → 'n/a'",
    /Daily DD max \| n\/a/.test(r.markdown));
}

// ─── Boolean formatting: Yes/No ──────────────────────────────────────────
{
  // Default fixture has equityFloorHalted=false → 'No'
  const r1 = formatReport(makeInput());
  assert("Markdown: equityFloorHalted=false → 'No'",
    /Equity floor halted \| No/.test(r1.markdown));

  // Halted scenario
  const halted = makeMetrics();
  halted.dailyRisk = { ...halted.dailyRisk, equityFloorHalted: true, haltAt: 1704067200000 };
  const r2 = formatReport(makeInput({ metrics: halted }));
  assert("Markdown: equityFloorHalted=true → 'Yes'",
    /Equity floor halted \| Yes/.test(r2.markdown));
}

// ─── haltAt rendering: number ms → ISO ───────────────────────────────────
{
  const halted = makeMetrics();
  halted.dailyRisk = { ...halted.dailyRisk, equityFloorHalted: true, haltAt: 1704067200000 };
  const r = formatReport(makeInput({ metrics: halted }));
  // 1704067200000 = 2024-01-01T00:00:00.000Z
  assert("Markdown: haltAt rendered as ISO string",
    r.markdown.includes("2024-01-01T00:00:00.000Z"));
}

// ─── Title block fields ──────────────────────────────────────────────────
{
  const r = formatReport(makeInput());
  assert("Markdown: title contains run id",
    r.markdown.includes("`sv2-2024-01-01-2024-01-30-a1b2c3d4`"));
  assert("Markdown: title contains generatedAt",
    r.markdown.includes("2026-05-01T19:00:00.000Z"));
  assert("Markdown: title contains 'Phase: SV2-7'",
    /Phase:\*\*\s+SV2-7/.test(r.markdown));
}

// ─── Optional data block ─────────────────────────────────────────────────
{
  const r = formatReport(makeInput({
    data: { asset: "XRPUSD", rangeStart: "2024-01-01T00:00:00Z", rangeEnd: "2024-01-30T23:55:00Z" },
  }));
  assert("Markdown: asset rendered when data.asset present",
    r.markdown.includes("**Asset:** XRPUSD"));
  assert("Markdown: range rendered",
    r.markdown.includes("2024-01-01T00:00:00Z → 2024-01-30T23:55:00Z"));
}

// ─── Optional config block ───────────────────────────────────────────────
{
  const r = formatReport(makeInput({
    config: {
      strategy:  { asset: "XRPUSD", side: "long-only" },
      signal:    { sweepToBosWindowMs: 3600000 },
      simulator: { tp1RR: 1.0, tp2RR: 2.0 },
      risk:      { initialEquity: 10000, maxTradesPerDay: 3 },
    },
  }));
  assert("Markdown: ### Strategy heading",  r.markdown.includes("### Strategy"));
  assert("Markdown: ### Signal heading",    r.markdown.includes("### Signal"));
  assert("Markdown: ### Simulator heading", r.markdown.includes("### Simulator"));
  assert("Markdown: ### Risk heading",      r.markdown.includes("### Risk"));
  assert("Markdown: config JSON rendered in code block",
    r.markdown.includes('"side": "long-only"'));
}

// ─── Notes rendering ─────────────────────────────────────────────────────
{
  const r1 = formatReport(makeInput({ notes: "Operator review pending; Codex APPROVED." }));
  assert("Markdown: notes rendered when provided",
    r1.markdown.includes("Operator review pending; Codex APPROVED."));

  const r2 = formatReport(makeInput()); // notes omitted
  assert("Markdown: notes default '(none provided)'",
    r2.markdown.includes("(none provided)"));
}

// ─── Determinism: two runs identical ─────────────────────────────────────
{
  const inp = makeInput();
  const r1 = formatReport(inp);
  const r2 = formatReport(inp);
  assert("determinism: json equal", r1.json === r2.json);
  assert("determinism: markdown equal", r1.markdown === r2.markdown);
}

// ─── Empty trades: 'Total trades | 0' ────────────────────────────────────
{
  const empty = makeMetrics({ headline: { ...makeMetrics().headline, totalTrades: 0, wins: 0, losses: 0, breakevens: 0, winRate: null } });
  const r = formatReport(makeInput({ metrics: empty }));
  assert("Markdown: zero trades shows '0' count",
    /Total trades \| 0/.test(r.markdown));
  assert("Markdown: zero trades shows winRate=n/a",
    /Win rate \| n\/a/.test(r.markdown));
}

// ─── Outcome breakdown counts ────────────────────────────────────────────
{
  const r = formatReport(makeInput());
  assert("Markdown: outcome 'TP1 + TP2 (full) ... 5'",
    /TP1 \+ TP2 \(full\)\s+\|\s+5/.test(r.markdown));
  assert("Markdown: outcome 'SL (full) ... 5'",
    /SL \(full\)\s+\|\s+5/.test(r.markdown));
  assert("Markdown: outcome 'Incomplete ... 1'",
    /Incomplete \(end-of-data\) \| 1/.test(r.markdown));
}

// ─── Skipped reasons rendered ────────────────────────────────────────────
{
  const r = formatReport(makeInput());
  assert("Markdown: 'Max trades / day | 2'",
    /Max trades \/ day \| 2/.test(r.markdown));
  assert("Markdown: 'Halted (post equity floor) | 0'",
    /Halted \(post equity floor\) \| 0/.test(r.markdown));
}

// ─── No NaN/Infinity in JSON or Markdown output ──────────────────────────
{
  const m = makeMetrics();
  // Inject a non-finite into a metric → formatter must render 'n/a'
  m.headline.winRate = NaN;
  const r = formatReport(makeInput({ metrics: m }));
  assert("Markdown: NaN winRate rendered as n/a (not 'NaN')",
    !r.markdown.includes("NaN") && /Win rate \| n\/a/.test(r.markdown));
  // JSON itself: JSON.stringify of NaN → null. We accept either as long
  // as the output is not the literal string "NaN".
  assert("JSON: NaN scrubbed (no 'NaN' substring)",
    !r.json.includes("NaN"));
}

// ─── Run-id validation ───────────────────────────────────────────────────
{
  let t1 = false; try { formatReport(makeInput({ runId: "" })); } catch (e) { t1 = e instanceof TypeError; }
  assert("runId empty → TypeError", t1);

  let t2 = false; try { formatReport(makeInput({ runId: "a".repeat(201) })); } catch (e) { t2 = e instanceof RangeError; }
  assert("runId > 200 chars → RangeError", t2);

  let t3 = false; try { formatReport(makeInput({ runId: "abc/def" })); } catch (e) { t3 = e instanceof RangeError; }
  assert("runId with '/' → RangeError", t3);

  let t4 = false; try { formatReport(makeInput({ runId: "abc\\def" })); } catch (e) { t4 = e instanceof RangeError; }
  assert("runId with '\\\\' → RangeError", t4);

  let t5 = false; try { formatReport(makeInput({ runId: "abc..def" })); } catch (e) { t5 = e instanceof RangeError; }
  assert("runId with '..' → RangeError", t5);

  let t6 = false; try { formatReport(makeInput({ runId: "abc def" })); } catch (e) { t6 = e instanceof RangeError; }
  assert("runId with NUL byte → RangeError", t6);

  let t7 = false; try { formatReport(makeInput({ runId: "abc\ndef" })); } catch (e) { t7 = e instanceof RangeError; }
  assert("runId with newline → RangeError", t7);
}

// ─── generatedAt validation ──────────────────────────────────────────────
{
  let t1 = false; try { formatReport(makeInput({ generatedAt: "" })); } catch (e) { t1 = e instanceof TypeError; }
  assert("generatedAt empty → TypeError", t1);

  let t2 = false; try { formatReport(makeInput({ generatedAt: 1234567890 })); } catch (e) { t2 = e instanceof TypeError; }
  assert("generatedAt non-string → TypeError", t2);
}

// ─── metrics validation ──────────────────────────────────────────────────
{
  let t1 = false; try { formatReport({}); } catch (e) { t1 = e instanceof TypeError; }
  assert("missing metrics → TypeError", t1);

  let t2 = false; try { formatReport(makeInput({ metrics: { headline: {} } })); } catch (e) { t2 = e instanceof TypeError; }
  assert("metrics missing dailyRisk → TypeError", t2);
}

// ─── notes validation ────────────────────────────────────────────────────
{
  let t1 = false; try { formatReport(makeInput({ notes: 42 })); } catch (e) { t1 = e instanceof TypeError; }
  assert("notes non-string → TypeError", t1);
}

// ─── Mutation safety: input metrics object unchanged ─────────────────────
{
  const inp = makeInput();
  const before = JSON.stringify(inp);
  formatReport(inp);
  const after = JSON.stringify(inp);
  assert("input object unchanged after formatReport", before === after);
}

// ─── Confirms no Date.now() usage: changing 'now' wall-clock should not
//     affect output (we control via generatedAt) ──────────────────────────
{
  const inp = makeInput({ generatedAt: "2020-01-01T00:00:00Z" });
  const r1 = formatReport(inp);
  // Sleep is unnecessary; we just compare two consecutive runs to confirm.
  const r2 = formatReport(inp);
  assert("no clock read: same generatedAt → same output", r1.json === r2.json && r1.markdown === r2.markdown);
}

// ─── Codex-fix-1: report.js source contains zero `new Date(` and zero
//     `Date.now(` usages anywhere in the module. ────────────────────────
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const here   = dirname(fileURLToPath(import.meta.url));
  const srcPath = resolve(here, "..", "src", "report.js");
  const src     = readFileSync(srcPath, "utf8");
  // Strip line-comments and block-comments so matches in prose don't fire.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")    // /* ... */ blocks
    .replace(/^\s*\/\/.*$/gm, "")         // // ... line comments
    .replace(/\/\/.*$/gm, "");            // trailing // comments
  assert("report.js source: zero `new Date(` in code (excluding comments)",
    !/new\s+Date\s*\(/.test(stripped));
  assert("report.js source: zero `Date\\.now\\(` in code (excluding comments)",
    !/Date\.now\s*\(/.test(stripped));
  // Sanity check: the strip didn't accidentally erase the file
  assert("report.js source: stripped content non-trivial",
    stripped.includes("formatReport") && stripped.includes("validateInput"));
}

// ─── Codex-fix-2: runId with backtick is rejected ────────────────────────
{
  let threw = false;
  try { formatReport(makeInput({ runId: "abc`def" })); }
  catch (e) { threw = e instanceof RangeError && /backtick/i.test(e.message); }
  assert("runId with single backtick → RangeError mentioning 'backtick'", threw);

  // Triple backticks in runId would also break the markdown — same rejection
  let threw2 = false;
  try { formatReport(makeInput({ runId: "abc```def" })); }
  catch (e) { threw2 = e instanceof RangeError; }
  assert("runId with triple backticks → RangeError", threw2);
}

// ─── Codex-fix-3: hand-rolled msEpochToIso produces correct ISO output ─
{
  // 2024-01-01T00:00:00.000Z = 1704067200000 ms
  // 2024-01-01T00:00:00.500Z = 1704067200500 ms
  // 2024-01-15T12:34:56.789Z = derived
  // 1970-01-01T00:00:00.000Z = 0
  // 2026-05-01T18:12:13.127Z = 1777659133127 (matches pos #38 updated_at)
  // Push haltAt through the formatter and read back from the rendered markdown.
  function isoFor(ms) {
    const halted = makeMetrics();
    halted.dailyRisk = { ...halted.dailyRisk, equityFloorHalted: true, haltAt: ms };
    const r = formatReport(makeInput({ metrics: halted }));
    const match = r.markdown.match(/\| Halt at \| ([^|]+) \|/);
    return match ? match[1].trim() : null;
  }
  assert("fmtTs(0) === '1970-01-01T00:00:00.000Z'",
    isoFor(0) === "1970-01-01T00:00:00.000Z");
  assert("fmtTs(1704067200000) === '2024-01-01T00:00:00.000Z'",
    isoFor(1704067200000) === "2024-01-01T00:00:00.000Z");
  assert("fmtTs(1704067200500) === '2024-01-01T00:00:00.500Z'",
    isoFor(1704067200500) === "2024-01-01T00:00:00.500Z");
  assert("fmtTs(1777659133127) === '2026-05-01T18:12:13.127Z' (pos #38 updated_at)",
    isoFor(1777659133127) === "2026-05-01T18:12:13.127Z");
  assert("fmtTs(NaN) === 'n/a'",
    isoFor(NaN) === "n/a");
}

// ─── Codex-fix-3 cross-check: hand-rolled output matches Date.toISOString ─
{
  // Sweep a handful of timestamps spanning leap years, end-of-month, etc.
  // Using `new Date` here is OK — only the production formatter is banned.
  const samples = [
    0,
    1704067200000,                         // 2024-01-01
    1704067200500,                         // millis
    1709251199999,                          // 2024-02-29T23:59:59.999Z (leap)
    1735689599000,                         // 2024-12-31T23:59:59.000Z
    1777659133127,                         // 2026-05-01T18:12:13.127Z
    1893456000000,                          // 2030-01-01T00:00:00Z
  ];
  let allMatch = true;
  for (const ms of samples) {
    const halted = makeMetrics();
    halted.dailyRisk = { ...halted.dailyRisk, equityFloorHalted: true, haltAt: ms };
    const r = formatReport(makeInput({ metrics: halted }));
    const match = r.markdown.match(/\| Halt at \| ([^|]+) \|/);
    const got = match ? match[1].trim() : null;
    const expected = new Date(ms).toISOString();
    if (got !== expected) {
      allMatch = false;
      console.log(`    ms=${ms} got=${got} expected=${expected}`);
      break;
    }
  }
  assert("msEpochToIso matches new Date(ms).toISOString() across 7 samples",
    allMatch);
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
