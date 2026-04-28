// lib/kraken-safe.js — hardened wrapper: timeout + retry(2) + circuit breaker.
// Standard return: { success, data?, error? }
import crypto from "node:crypto";

const TIMEOUT_MS    = 8000;
const MAX_RETRIES   = 2;
const BREAKER_FAILS = 4;       // consecutive failures before opening
const BREAKER_OPEN_MS = 30_000;

const breaker = { failures: 0, openedAt: 0 };

function breakerOpen() {
  if (breaker.failures < BREAKER_FAILS) return false;
  if (Date.now() - breaker.openedAt < BREAKER_OPEN_MS) return true;
  // half-open: allow one trial
  breaker.failures = BREAKER_FAILS - 1;
  return false;
}
function noteFailure() {
  breaker.failures++;
  if (breaker.failures >= BREAKER_FAILS) breaker.openedAt = Date.now();
}
function noteSuccess() { breaker.failures = 0; breaker.openedAt = 0; }

export function breakerStatus() {
  return {
    open: breakerOpen(),
    failures: breaker.failures,
    cooldownMs: breaker.openedAt ? Math.max(0, BREAKER_OPEN_MS - (Date.now() - breaker.openedAt)) : 0,
  };
}

async function withTimeout(promiseFactory, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await promiseFactory(ctl.signal); }
  finally { clearTimeout(t); }
}

// kraken public/private call wrapper.
// `fn` MUST accept (signal) and return parsed JSON or throw.
export async function safeKrakenCall(label, fn, { retries = MAX_RETRIES, timeoutMs = TIMEOUT_MS } = {}) {
  if (breakerOpen()) {
    return { success: false, error: `kraken-circuit-open (${label})` };
  }
  let attempt = 0, lastErr;
  while (attempt <= retries) {
    try {
      const data = await withTimeout((signal) => fn(signal), timeoutMs);
      // Kraken responses include `error: []` on success
      if (data && Array.isArray(data.error) && data.error.length) {
        // API-level error — DON'T retry (avoids duplicate orders, etc.)
        noteFailure();
        return { success: false, error: data.error.join("; ") };
      }
      noteSuccess();
      return { success: true, data: data?.result ?? data };
    } catch (err) {
      lastErr = err;
      attempt++;
      // Only retry on transport/timeout errors
      const transient = err.name === "AbortError" || /ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(err.message || "");
      if (!transient || attempt > retries) break;
      await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
    }
  }
  noteFailure();
  return { success: false, error: `kraken-${label}-failed: ${lastErr?.message || "unknown"}` };
}

// Convenience: signed private POST. Pass an existing kraken-signing fn from your codebase.
export function makePrivateCaller({ apiKey, signRequest, baseUrl = "https://api.kraken.com" }) {
  return async function privateCall(path, params = {}) {
    return safeKrakenCall(path, async (signal) => {
      const nonce = Date.now().toString();
      const body = new URLSearchParams({ nonce, ...params }).toString();
      const sig  = signRequest(path, nonce, body);
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        signal,
        headers: {
          "API-Key": apiKey,
          "API-Sign": sig,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      return res.json();
    });
  };
}

// Convenience: public GET
export async function safePublicGet(path, baseUrl = "https://api.kraken.com") {
  return safeKrakenCall(path, async (signal) => {
    const res = await fetch(`${baseUrl}${path}`, { signal });
    return res.json();
  });
}
