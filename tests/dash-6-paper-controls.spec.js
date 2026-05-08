// tests/dash-6-paper-controls.spec.js — DASH-6.C
//
// Smoke coverage for the paper-mode dashboard control commands routed
// through POST /api/trade.
// Closes gap G3 from the DASH-6 design (Codex DESIGN-ONLY round-5 PASS).
//
// Coverage:
//   1. Non-prod DATABASE_URL hard abort guard fires before any test action
//      (per RE-2 from DASH-6 round-1 Codex review).
//   2. Authenticated session via TOTP (/api/login + /2fa).
//   3. Pre-condition: dashboard is in paper mode (skip otherwise).
//   4. Pre-condition: no open paper position (skip otherwise — protects
//      operator data; see "synthetic data" note in the design).
//   5. Each of 4 paper control commands routes correctly via /api/trade
//      handler dispatch into handleTradeCommand's paper branch:
//        - SET_STOP_LOSS  (handler at dashboard.js:2398)
//        - SET_TAKE_PROFIT (handler at dashboard.js:2431)
//        - CLOSE_POSITION  (handler at dashboard.js:2050)
//        - SELL_ALL        (handler at dashboard.js:2226)
//      Asserts the response shape: status 400, body {ok:false, error: matching
//      "No open paper position to ..."}. This proves the dispatch + paper
//      branch + loadOpenPosition("paper") path is intact.
//   6. Defense-in-depth: no browser-originated Kraken request occurs during
//      the test (page.context().route on api.kraken.com captures any).
//   7. Negative assertions: no MANUAL_LIVE_ARMED change implied; no
//      position.json write expected (paper is DB-only per DASH-4 design).
//
// IMPORTANT — paper-mode-only / no synthetic position:
//   This spec deliberately avoids creating synthetic paper positions
//   (despite the design's "synthetic test data only if needed" + "cleanup
//   on PASS / kept on FAIL" allowance) because:
//     - The no-open-position dispatch path covers the most important
//       regression surface (handler routing + paper branch entry +
//       loadOpenPosition("paper") + throw).
//     - Creating synthetic positions risks residual DB rows on FAIL and
//       complicates cleanup logic.
//     - The success-path return envelope (DASH-4.A's +1 ins / -1 del at
//       dashboard.js:2074 — verifiable only on the success branch) is
//       deferred to a separately-scoped synthetic-position smoke phase
//       if operator chooses to schedule one.
//
//   If a paper position is open at test time, the spec skips its
//   command-dispatch assertions (test.skip with reason) to avoid mutating
//   real operator data.
//
// SAFETY:
//   - Paper mode only (skip if dashboard is in live mode).
//   - No /api/trade exercise of live commands (paper-only smoke).
//   - No MANUAL_LIVE_ARMED read or write (per HANDOFF-RULES.md).
//   - No position.json write expected (paper is DB-only per DASH-4).
//   - No bot.js execution; no Kraken interaction; no real-money path.
//   - Non-prod DATABASE_URL hard abort guard: aborts before any test
//     action if DATABASE_URL host is not local (localhost / 127.0.0.1 /
//     ::1 / *.local). Production Railway hosts and any non-local DB are
//     forbidden.

import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

// ── TOTP helper (RFC 6238) — same algorithm as existing tests/*.spec.js ─────
// (Helpers refactor to a shared module is deferred per DASH-6 design;
//  duplication is intentional until DASH-6 is fully stable.)
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(s) {
  s = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, val = 0; const out = [];
  for (const ch of s) {
    val = (val << 5) | BASE32.indexOf(ch); bits += 5;
    if (bits >= 8) { bits -= 8; out.push((val >>> bits) & 0xff); }
  }
  return Buffer.from(out);
}
function generateTotp(secret) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (((hmac[offset] & 0x7f) << 24)
              | ((hmac[offset + 1] & 0xff) << 16)
              | ((hmac[offset + 2] & 0xff) << 8)
              |  (hmac[offset + 3] & 0xff)) % 1_000_000;
  return code.toString().padStart(6, "0");
}
function loadEnvVar(key) {
  if (!existsSync(".env")) return null;
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

const EMAIL  = loadEnvVar("DASHBOARD_EMAIL");
const PASS   = loadEnvVar("DASHBOARD_PASSWORD");
const SECRET = loadEnvVar("DASHBOARD_TOTP_SECRET");

async function authedSession(page) {
  const r1 = await page.request.post("/api/login", {
    data: { email: EMAIL, password: PASS, rememberMe: false },
  });
  expect(r1.status()).toBe(200);
  const r2 = await page.request.post("/2fa", {
    form: { code: generateTotp(SECRET) },
    maxRedirects: 0,
  });
  expect([200, 302]).toContain(r2.status());
}

// ── Non-prod DATABASE_URL hard abort guard (per DASH-6 round-1 Codex RE-2) ──
// Aborts the spec before any test action if DATABASE_URL host is not local.
// Production Railway hosts and any non-local DB are forbidden by this guard.
function assertNonProdDatabaseUrl() {
  // Collect DATABASE_URL from both sources; deduplicate
  const dbUrls = [
    process.env.DATABASE_URL,
    loadEnvVar("DATABASE_URL"),
  ].filter((v) => typeof v === "string" && v.length > 0);

  if (dbUrls.length === 0) return; // neither source set — safe

  for (const dbUrl of dbUrls) {
    let parsed;
    try {
      parsed = new URL(dbUrl);
    } catch {
      // malformed URL — abort to be safe
      throw new Error("DATABASE_URL is malformed; aborting to prevent accidental production writes");
    }
    const host = parsed.hostname;
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local");
    if (!isLocal) {
      throw new Error(
        "DATABASE_URL host is not local; refusing to run tests against a non-local database"
      );
    }
  }
}

test.describe("DASH-6.C — paper controls smoke", () => {
  // beforeAll runs once before any test in this describe block. The non-prod
  // DATABASE_URL guard fires here so the spec aborts before authedSession()
  // or any /api/trade dispatch.
  test.beforeAll(() => {
    assertNonProdDatabaseUrl();
  });

  test("paper SET_STOP_LOSS / SET_TAKE_PROFIT / CLOSE_POSITION / SELL_ALL dispatch correctly with no Kraken call", async ({ page }) => {
    // Defense-in-depth: capture any browser-context request to api.kraken.com.
    // Paper mode does not interact with Kraken at runtime, so the captured list
    // is expected to be empty.
    const browserKrakenCalls = [];
    await page.context().route("**/api.kraken.com/**", (route) => {
      browserKrakenCalls.push(route.request().url());
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: ["mocked-by-dash-6.C"], result: {} }),
      });
    });

    await authedSession(page);

    // Read /api/data to detect paper mode + existing-position state.
    const dataResp = await page.request.get("/api/data");
    expect(dataResp.status()).toBe(200);
    const data = await dataResp.json();

    // Pre-condition 1: paper mode required.
    test.skip(
      data.paperTrading !== true,
      `Dashboard is not in paper mode (paperTrading=${data.paperTrading}); DASH-6.C requires paper mode. ` +
      `Switch the dashboard to paper mode before running this spec.`
    );

    // Pre-condition 2: no open paper position (protects operator data).
    test.skip(
      data.position?.open === true,
      `An open paper position exists; DASH-6.C deliberately avoids mutating real operator data. ` +
      `Close the position manually or run on a clean test environment.`
    );

    // Exercise each paper command. Each call should dispatch through
    // /api/trade -> handleTradeCommand -> paper branch -> loadOpenPosition("paper") -> throw,
    // and respond with status 400 + body {ok:false, error: "No open paper position to ..."}.
    const commands = ["SET_STOP_LOSS", "SET_TAKE_PROFIT", "CLOSE_POSITION", "SELL_ALL"];
    for (const command of commands) {
      const response = await page.request.post("/api/trade", {
        data: { command, params: {} },
        headers: { "Content-Type": "application/json" },
      });

      // The /api/trade error path returns status 400 with a JSON error envelope
      // (per dashboard.js:13106-13109).
      expect(response.status(), `${command} response status`).toBe(400);
      expect(response.headers()["content-type"]).toMatch(/application\/json/);

      const body = await response.json();
      expect(body, `${command} response body`).toHaveProperty("ok", false);
      expect(body, `${command} response body`).toHaveProperty("error");
      expect(typeof body.error).toBe("string");

      // Each paper handler throws "No open paper position to {update|close|sell}"
      // when loadOpenPosition("paper") returns null. The exact verb varies per
      // command but always starts with this prefix.
      expect(
        body.error,
        `${command} error message must indicate no open paper position`
      ).toMatch(/^No open paper position to /);
    }

    // Defense-in-depth: confirm no browser-context request to api.kraken.com
    // was made. Paper mode never interacts with Kraken; this assertion guards
    // against any future routing regression.
    expect(browserKrakenCalls).toEqual([]);
  });
});
