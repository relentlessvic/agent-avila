// lib/bot-safety.js — gates that decide LIVE vs SAFE_MODE before any order.
// Standard return: { success, data?: { mode, allowLive, reasons[] }, error? }
import { breakerStatus } from "./kraken-safe.js";

const STALE_DATA_MS_DEFAULT   = 5 * 60 * 1000;  // 5 min
const MIN_CONFIDENCE_DEFAULT  = 0.6;

export function evaluateBotSafety({
  lastDataTimestamp,        // number | Date | ISO string
  confidenceScore,          // 0..1
  staleDataMs   = STALE_DATA_MS_DEFAULT,
  minConfidence = MIN_CONFIDENCE_DEFAULT,
  paperTrading  = false,
} = {}) {
  const reasons = [];

  const breaker = breakerStatus();
  if (breaker.open) reasons.push(`kraken-circuit-open (cooldown ${Math.ceil(breaker.cooldownMs/1000)}s)`);

  if (lastDataTimestamp == null) {
    reasons.push("no-data-timestamp");
  } else {
    const ts = lastDataTimestamp instanceof Date ? lastDataTimestamp.getTime() : new Date(lastDataTimestamp).getTime();
    if (!Number.isFinite(ts)) reasons.push("invalid-data-timestamp");
    else if (Date.now() - ts > staleDataMs) reasons.push(`stale-data (age ${Math.round((Date.now()-ts)/1000)}s)`);
  }

  if (typeof confidenceScore !== "number" || !Number.isFinite(confidenceScore)) {
    reasons.push("missing-confidence");
  } else if (confidenceScore < minConfidence) {
    reasons.push(`low-confidence (${confidenceScore.toFixed(2)} < ${minConfidence})`);
  }

  const allowLive = reasons.length === 0 && !paperTrading;
  const mode = allowLive ? "LIVE" : (paperTrading ? "PAPER" : "SAFE_MODE");
  return { success: true, data: { mode, allowLive, reasons, breaker } };
}

// Guard wrapper: blocks live trade execution unless safe.
export async function withSafetyGate(checkArgs, executeLiveFn, executeSafeFn) {
  const verdict = evaluateBotSafety(checkArgs);
  if (verdict.data.allowLive) return executeLiveFn(verdict.data);
  return executeSafeFn(verdict.data);
}
