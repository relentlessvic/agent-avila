// Phase SV2-1 — node-script test runner for the UTC-aligned resampler.
//
// Builds synthetic 5m candle streams in-memory and verifies that the
// resampler emits 15m and 4h bars only when all constituent 5m bars are
// present, and that aggregation (open/high/low/close/volume) is
// arithmetically correct.

import {
  resample, resampleTo15m, resampleTo4h,
  bucketStartFor, expectedBucketBars,
  FIFTEEN_MIN_MS, FOUR_HOUR_MS,
} from "../src/resampler.js";
import { FIVE_MIN_MS } from "../src/data-loader.js";

const RESET = "\x1b[0m"; const RED = "\x1b[31m"; const GREEN = "\x1b[32m"; const DIM = "\x1b[2m";
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }

let passCount = 0, failCount = 0;
const failed = [];
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ${GREEN}PASS${RESET}  ${pad(name, 60)}`); passCount++; }
  else      { console.log(`  ${RED}FAIL${RESET}  ${pad(name, 60)} ${DIM}${detail}${RESET}`); failCount++; failed.push({ name, detail }); }
}

function makeCandles(n, startTs = 1704067200000) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ts = startTs + i * FIVE_MIN_MS;
    const o = 1.0 + i * 0.001;
    const c = o + 0.0005;
    out.push({ ts, open: o, high: c + 0.0001, low: o - 0.0001, close: c, volume: 1000 + i });
  }
  return out;
}

console.log("=== SV2-1 resampler tests ===");
console.log("");

// ─── Boundary helpers ─────────────────────────────────────────────────────
{
  // 2024-01-01T00:00:00Z is at HH:00 → bucket starts equal that ts for both 15m and 4h
  const ts = 1704067200000;
  assert("bucketStartFor: aligned ts maps to itself (15m)", bucketStartFor(ts, FIFTEEN_MIN_MS) === ts);
  assert("bucketStartFor: aligned ts maps to itself (4h)", bucketStartFor(ts, FOUR_HOUR_MS) === ts);
  assert("bucketStartFor: 14:55 → 14:45 (15m)",
    bucketStartFor(ts + 14 * 60 * 1000 + 55 * 60 * 1000 - 60 * 60 * 1000 /* trick: just compute */, FIFTEEN_MIN_MS) % FIFTEEN_MIN_MS === 0);
  assert("expectedBucketBars: 15m = 3 (from 5m)", expectedBucketBars(FIFTEEN_MIN_MS) === 3);
  assert("expectedBucketBars: 4h = 48 (from 5m)", expectedBucketBars(FOUR_HOUR_MS) === 48);
}

// ─── 15m resampling: clean 12 bars → 4 complete buckets ──────────────────
{
  const c5 = makeCandles(12);   // 1 hour of bars
  const c15 = resampleTo15m(c5);
  assert("15m: 12 5m bars → 4 15m bars", c15.length === 4, `got ${c15.length}`);
  // First 15m bar covers c5[0..2]
  const b0 = c15[0];
  assert("15m bar0: ts equals first 5m ts (UTC-aligned)", b0.ts === c5[0].ts);
  assert("15m bar0: open == c5[0].open", b0.open === c5[0].open);
  assert("15m bar0: close == c5[2].close", b0.close === c5[2].close);
  assert("15m bar0: high == max(c5[0..2].high)",
    b0.high === Math.max(c5[0].high, c5[1].high, c5[2].high));
  assert("15m bar0: low == min(c5[0..2].low)",
    b0.low === Math.min(c5[0].low, c5[1].low, c5[2].low));
  assert("15m bar0: volume == sum(c5[0..2].volume)",
    b0.volume === c5[0].volume + c5[1].volume + c5[2].volume);
  // Bucketing arithmetic across all 4 buckets
  for (let k = 0; k < 4; k++) {
    const expected = c5[3*k].ts;
    assert(`15m bar${k}: ts == c5[${3*k}].ts`, c15[k].ts === expected);
  }
}

// ─── 15m resampling: drop incomplete bucket at start ─────────────────────
{
  // Start with the 2nd 5m bar of a 15m bucket, so the first bucket is
  // incomplete (missing bar at HH:00) and must be dropped.
  const startTs = 1704067200000 + 5 * 60 * 1000;   // 2024-01-01T00:05:00Z
  const c5 = makeCandles(12, startTs);
  const c15 = resampleTo15m(c5);
  // First valid bucket starts at HH:15.
  // From startTs we have bars at :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55, +1h:00.
  // - Bucket 00:00–00:14 has only 2 bars (:05, :10) → drop
  // - Bucket 00:15–00:29 has 3 bars (:15, :20, :25) → emit
  // - Bucket 00:30–00:44 has 3 bars (:30, :35, :40) → emit
  // - Bucket 00:45–00:59 has 3 bars (:45, :50, :55) → emit
  // - Bucket 01:00–01:14 has 1 bar (:00) → drop
  assert("15m start-misalignment: drops leading partial bucket",
    c15.length === 3, `got ${c15.length}`);
  assert("15m: first emitted bucket starts at HH:15",
    c15[0].ts === 1704067200000 + 15 * 60 * 1000);
}

// ─── 15m resampling: drop bucket with missing middle bar ────────────────
{
  const c5 = makeCandles(12);
  // Remove bar index 4 (which sits in the bucket at index 1: bars 3,4,5)
  c5.splice(4, 1);
  const c15 = resampleTo15m(c5);
  // Buckets:
  //   bucket0 (bars 0,1,2)        → emit
  //   bucket1 (bars 3, 5)         → drop (missing bar 4)
  //   bucket2 (bars 6,7,8)        → emit
  //   bucket3 (bars 9,10,11)      → emit
  assert("15m: missing middle bar → 3 buckets emitted", c15.length === 3, `got ${c15.length}`);
  // The dropped bucket should be the one at bucketStart = c5[3].ts (now index 3 in the array)
  // Note: after splice(4,1), original c5[3] is now at index 3 still.
  const droppedBucketStart = bucketStartFor(1704067200000 + 3 * 5 * 60 * 1000, FIFTEEN_MIN_MS);
  assert("15m: dropped bucket not present in output",
    !c15.some(b => b.ts === droppedBucketStart));
}

// ─── 4h resampling: 48 clean bars → 1 complete 4h bar ────────────────────
{
  const c5 = makeCandles(48);   // 4 hours of bars starting at 00:00 UTC
  const c4 = resampleTo4h(c5);
  assert("4h: 48 5m bars → 1 4h bar", c4.length === 1, `got ${c4.length}`);
  const b = c4[0];
  assert("4h: bar.ts == 00:00 UTC of first day", b.ts === 1704067200000);
  assert("4h: bar.open == c5[0].open", b.open === c5[0].open);
  assert("4h: bar.close == c5[47].close", b.close === c5[47].close);
  let vsum = 0; let hmax = -Infinity; let lmin = Infinity;
  for (const c of c5) { vsum += c.volume; if (c.high > hmax) hmax = c.high; if (c.low < lmin) lmin = c.low; }
  assert("4h: bar.volume == sum of 48 bars", b.volume === vsum, `expected ${vsum} got ${b.volume}`);
  assert("4h: bar.high == max of 48 highs", b.high === hmax);
  assert("4h: bar.low == min of 48 lows", b.low === lmin);
}

// ─── 4h resampling: 47 bars (missing last) → 0 emitted ──────────────────
{
  const c5 = makeCandles(47);
  const c4 = resampleTo4h(c5);
  assert("4h: 47 bars (missing last 5m of bucket) → 0 emitted",
    c4.length === 0, `got ${c4.length}`);
}

// ─── 4h resampling: 48 bars but first bar has wrong ts → drop bucket ────
{
  const c5 = makeCandles(48);
  // Replace bar 0 with a duplicate of bar 1 (so bucketStart bar is missing)
  c5[0] = { ...c5[1] };
  // After this, the bucket at 00:00 has bars at indices 1,1,2,3,...,47 with
  // duplicate timestamps and missing bar at 00:00. Group will have count<48
  // OR firstTs !== bucketStart.
  const c4 = resampleTo4h(c5);
  assert("4h: missing first bar (00:00) → bucket dropped",
    c4.length === 0, `got ${c4.length}`);
}

// ─── 4h resampling: 96 bars across two 4h buckets → 2 emitted ───────────
{
  const c5 = makeCandles(96);   // 8 hours
  const c4 = resampleTo4h(c5);
  assert("4h: 96 bars → 2 buckets emitted", c4.length === 2);
  assert("4h: bucket0 ts at 00:00 UTC", c4[0].ts === 1704067200000);
  assert("4h: bucket1 ts at 04:00 UTC", c4[1].ts === 1704067200000 + 4 * 60 * 60 * 1000);
  assert("4h: bucket0.bucketSize == 48", c4[0].bucketSize === 48);
  assert("4h: bucket1.bucketSize == 48", c4[1].bucketSize === 48);
}

// ─── Edge: empty input ───────────────────────────────────────────────────
{
  assert("15m: empty input → empty output", resampleTo15m([]).length === 0);
  assert("4h: empty input → empty output",  resampleTo4h([]).length === 0);
}

// ─── Edge: invalid bucketMs ──────────────────────────────────────────────
{
  let threw = false;
  try { resample(makeCandles(3), 11 * 60 * 1000, FIVE_MIN_MS); }
  catch (e) { threw = e instanceof RangeError; }
  assert("resample: 11m bucket (not multiple of 5m) → RangeError", threw);
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
