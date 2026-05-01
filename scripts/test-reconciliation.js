// Phase D-5.10.5.8.1 — node-script test runner for the reconciliation
// comparator. Replays each fixture in lib/reconciliation-fixtures.js
// against `reconcile(...)` and asserts the expected top-level verdict.
// Exits 0 if all fixtures pass; 1 if any fails.
//
// No DB. No Kraken. No filesystem writes. Pure deterministic harness.

import { reconcile } from "../lib/reconciliation.js";
import { FIXTURES, FROZEN_NOW } from "../lib/reconciliation-fixtures.js";

const RESET  = "\x1b[0m";
const RED    = "\x1b[31m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM    = "\x1b[2m";

function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }

function dumpFields(fields) {
  for (const f of fields) {
    if (f.severity === "OK") continue;
    console.log(DIM + `      ${pad(f.severity,13)} ${pad(f.field,20)} ${pad(f.reasonCode,20)} ${f.message}` + RESET);
  }
}

function runOne(name, fx) {
  let actual;
  try {
    actual = reconcile(fx.db, fx.venue, { now: FROZEN_NOW });
  } catch (err) {
    return { name, pass: false, expected: fx.expected, actual: "THREW", err, fields: [] };
  }
  const pass = actual.verdict === fx.expected;
  return { name, pass, expected: fx.expected, actual: actual.verdict,
           description: fx.description, fields: actual.fields };
}

console.log("=== reconciliation comparator — fixture test runner (D-5.10.5.8.1) ===");
console.log(`fixtures:   ${Object.keys(FIXTURES).length}`);
console.log(`frozen now: ${FROZEN_NOW}`);
console.log("");

let passCount = 0;
let failCount = 0;
const failed = [];

for (const [name, fx] of Object.entries(FIXTURES)) {
  const r = runOne(name, fx);
  if (r.pass) {
    console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 38)} ${DIM}expected=${r.expected}${RESET}`);
    passCount++;
  } else {
    console.log(`  ${RED}FAIL${RESET}  ${pad(name, 38)} expected=${r.expected}  actual=${r.actual}`);
    if (r.description) console.log(DIM + `        ${r.description}` + RESET);
    if (r.err) console.log(RED + `        threw: ${r.err.message}` + RESET);
    if (r.fields?.length) dumpFields(r.fields);
    failCount++;
    failed.push(r);
  }
}

console.log("");
console.log(`SUMMARY:    pass=${passCount}  fail=${failCount}  total=${passCount + failCount}`);

if (failCount > 0) {
  console.log(`\n${RED}FAIL${RESET} — ${failCount} fixture(s) did not match expected verdict.`);
  process.exit(1);
}
console.log(`\n${GREEN}OK${RESET} — all fixtures match expected verdicts.`);
process.exit(0);
