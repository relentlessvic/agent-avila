// tests/dash-6-health.spec.js — DASH-6.A
//
// Smoke coverage for the public /api/health endpoint.
// Closes gap G1 from the DASH-6 design (Codex DESIGN-ONLY round-5 PASS).
//
// Coverage:
//   1. /api/health returns 200 with Content-Type: application/json
//   2. Response shape includes the full health envelope (success, kraken,
//      websocket, bot, lastRun, lastRunAge, krakenLatency, serverTime,
//      errors, krakenOk)
//   3. Response includes the persistence sub-shape (D-5.2)
//   4. Response includes the database sub-shape (D-5.4 / D-5.7.2)
//   5. Response includes the deploy-identity sub-shape (DASH-2.A — the
//      gap G1 target): commitSha, commitShortSha, deploymentId, bootTime
//   6. Defense-in-depth: no browser-originated request to api.kraken.com
//      occurred during the test (route interception captures any such
//      request)
//
// IMPORTANT — server-side Kraken Time call is permitted:
//   The /api/health handler in dashboard.js (line 12385) performs a
//   server-side fetch to https://api.kraken.com/0/public/Time. This call
//   is made by the dashboard process (a separate node subprocess started
//   by Playwright's webServer config), not by the browser. Playwright
//   route interception in the test process cannot reach the dashboard
//   process's outbound network; this is a fundamental architectural
//   boundary, not a missing safeguard.
//
//   This server-side Kraken call is permitted as a documented low-risk
//   exception because the Kraken /0/public/Time endpoint is:
//     - public and unauthenticated (no API key, no signed request)
//     - read-only (returns only server time)
//     - never uses KRAKEN_API_KEY or KRAKEN_SECRET_KEY
//     - never queries wallet, balance, position, order, SL/TP, SELL_ALL,
//       or any trading data
//     - identical to what production /api/health performs on every health
//       probe (Railway uptime checks, frontend status polling, etc.)
//
//   The browser-side route interception below is defense-in-depth: it
//   ensures no test-process or page-context fetch to api.kraken.com
//   slips through, and asserts that count is exactly zero.
//
// SAFETY:
//   - No authentication required (/api/health is public per
//     dashboard.js:12379 "no auth required").
//   - No /api/trade exercise, no live handler call, no MANUAL_LIVE_ARMED
//     read or write, no position.json write, no bot.js execution.
//   - The only test-process network call is to the local dashboard at
//     PORT=3050 (per playwright.config.js).
//   - The transitive server-side Kraken call goes to a public read-only
//     endpoint (see above).

import { test, expect } from "@playwright/test";

test.describe("DASH-6.A — /api/health smoke", () => {
  test("/api/health returns 200 + JSON with full health and deploy-identity shape; no browser-side Kraken call", async ({ page }) => {
    // Defense-in-depth: install route interception on the browser context
    // for any request to api.kraken.com. The server-side Kraken Time call
    // from dashboard.js:12385 will NOT appear here (it happens in the
    // dashboard subprocess, outside Playwright's reach), but any
    // browser-context or page-context call would be captured.
    const browserKrakenCalls = [];
    await page.context().route("**/api.kraken.com/**", (route) => {
      browserKrakenCalls.push(route.request().url());
      // Fulfill with a synthetic empty Kraken Time response. If anything
      // were to reach this route, the assertion below would still fail.
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: ["mocked-by-dash-6.A"], result: { unixtime: 0 } }),
      });
    });

    // Hit /api/health — public endpoint, no auth needed (dashboard.js:12379).
    const response = await page.request.get("/api/health");

    // Basic response correctness
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/application\/json/);

    const body = await response.json();

    // Top-level health envelope shape
    expect(body).toHaveProperty("success");
    expect(typeof body.success).toBe("boolean");
    expect(body).toHaveProperty("kraken");
    expect(["online", "offline"]).toContain(body.kraken);
    expect(body).toHaveProperty("websocket", "client-managed");
    expect(body).toHaveProperty("bot");
    expect(["running", "stale", "stopped"]).toContain(body.bot);
    expect(body).toHaveProperty("lastRun");
    expect(body.lastRun === null || typeof body.lastRun === "string").toBe(true);
    expect(body).toHaveProperty("lastRunAge");
    expect(body.lastRunAge === null || typeof body.lastRunAge === "number").toBe(true);
    expect(body).toHaveProperty("krakenLatency");
    expect(typeof body.krakenLatency).toBe("number");
    expect(body).toHaveProperty("serverTime");
    expect(typeof body.serverTime).toBe("number");
    expect(body).toHaveProperty("errors");
    expect(Array.isArray(body.errors)).toBe(true);
    // Legacy boolean field kept for backwards compat per dashboard.js:12577
    expect(body).toHaveProperty("krakenOk");
    expect(typeof body.krakenOk).toBe("boolean");

    // Persistence sub-shape (D-5.2)
    expect(body).toHaveProperty("persistence");
    expect(body.persistence).toHaveProperty("ok");
    expect(body.persistence).toHaveProperty("dataDir");
    expect(body.persistence).toHaveProperty("isVolume");
    expect(body.persistence).toHaveProperty("reason");
    expect(body.persistence).toHaveProperty("files");
    expect(typeof body.persistence.files).toBe("object");

    // Database sub-shape (D-5.4 / D-5.7.2)
    expect(body).toHaveProperty("database");
    expect(body.database).toHaveProperty("ok");
    expect(body.database).toHaveProperty("engine", "postgres");
    expect(body.database).toHaveProperty("latencyMs");
    expect(body.database).toHaveProperty("schemaVersion");
    expect(body.database).toHaveProperty("schemaName");
    expect(body.database).toHaveProperty("reason");
    expect(body.database).toHaveProperty("tables");

    // Deploy-identity sub-shape (DASH-2.A — the gap G1 target)
    expect(body).toHaveProperty("deploy");
    expect(body.deploy).toHaveProperty("commitSha");
    expect(body.deploy).toHaveProperty("commitShortSha");
    expect(body.deploy).toHaveProperty("deploymentId");
    expect(body.deploy).toHaveProperty("bootTime");

    // Defense-in-depth: no browser-context request to api.kraken.com
    // occurred during this test. The server-side Kraken Time call from
    // dashboard.js:12385 is NOT captured here (it is a documented
    // low-risk exception per the spec header above).
    expect(browserKrakenCalls).toEqual([]);
  });
});
