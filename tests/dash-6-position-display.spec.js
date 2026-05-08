// tests/dash-6-position-display.spec.js — DASH-6.B
//
// Smoke coverage for the position display surface. Closes gap G2 from
// the DASH-6 design (Codex DESIGN-ONLY round-5 PASS).
//
// Coverage:
//   1. GET /api/data returns 200 + JSON with a top-level `position` field
//      (route verified at dashboard.js:12878; mode-agnostic).
//   2. The position object follows the real shipped camelCase shape per
//      _dbPositionToLegacyShape (dashboard.js:1041-1056):
//        Open state (when activeResult.position is non-null):
//          open, side, symbol, entryPrice, entryTime, quantity,
//          tradeSize, leverage, effectiveSize, orderId, stopLoss,
//          takeProfit, entrySignalScore, volatilityLevel
//        Empty state (when no open position):
//          { open: false }     (per dashboard.js:1239)
//        Empty + degraded (when DB is degraded):
//          { open: false, _degraded: true, _reason: <string> }
//          (per dashboard.js:1235)
//   3. The position object DOES NOT contain absent snake_case fields
//      (mode, entry_price, stop_loss, take_profit, opened_at). These
//      were design-intent names from DASH-3 that did NOT become runtime
//      field names.
//   4. The /paper and /live pages render a non-skeleton-stuck pos-stat
//      card after the inline-init + first WS tick settles. This extends
//      the existing tests/mode-pages.spec.js no-skeleton-stuck assertion
//      style scoped specifically to the position display card.
//   5. Defense-in-depth: no browser-originated request to api.kraken.com
//      occurs during the test (page.context().route on api.kraken.com
//      captures any).
//
// IMPORTANT — read-only smoke; no DB writes:
//   This spec is strictly read-only. It calls GET /api/data and visits
//   /paper and /live pages. It does NOT call /api/trade, /api/control,
//   or any mutation endpoint. It does NOT create synthetic DB rows.
//   It does NOT mutate any state. The non-prod DATABASE_URL hard-abort
//   guard from DASH-6.C is NOT required here because no DB write
//   occurs (and the spec accepts both DB-backed and JSON-fallback
//   position shapes per dashboard.js:1232-1275).
//
//   Note: legacy renderPosition at dashboard.js:5453 (inside the const
//   HTML template literal) is NOT touched per DASH-3 deferral. This
//   spec asserts the /api/data + page-render surface only.
//
// SAFETY:
//   - No /api/trade calls (no live or paper command exercise).
//   - No MANUAL_LIVE_ARMED read or write.
//   - No Kraken interaction (defense-in-depth route mock asserts zero
//     browser-context Kraken requests).
//   - No position.json write (read-only spec).
//   - No bot.js execution.
//   - No DB mutation (only GET /api/data which is read-only).

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

// Real shipped camelCase position fields per dashboard.js:1041-1056
// (_dbPositionToLegacyShape return shape).
const OPEN_POSITION_FIELDS = [
  "open",
  "side",
  "symbol",
  "entryPrice",
  "entryTime",
  "quantity",
  "tradeSize",
  "leverage",
  "effectiveSize",
  "orderId",
  "stopLoss",
  "takeProfit",
  "entrySignalScore",
  "volatilityLevel",
];

// Forbidden absent snake_case fields (DASH-3 design-intent names that did
// NOT become runtime field names; asserted absent to catch any future
// snake_case regression).
const FORBIDDEN_SNAKE_CASE_FIELDS = [
  "mode",
  "entry_price",
  "stop_loss",
  "take_profit",
  "opened_at",
];

test.describe("DASH-6.B — position display smoke", () => {
  test("GET /api/data returns position object with real camelCase shape (empty or open); no browser-side Kraken call", async ({ page }) => {
    // Defense-in-depth: capture any browser-context request to
    // api.kraken.com. This spec does not invoke any /api/trade or
    // /api/balance call, so no Kraken request is expected.
    const browserKrakenCalls = [];
    await page.context().route("**/api.kraken.com/**", (route) => {
      browserKrakenCalls.push(route.request().url());
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: ["mocked-by-dash-6.B"], result: {} }),
      });
    });

    await authedSession(page);

    const response = await page.request.get("/api/data");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/application\/json/);

    const body = await response.json();
    expect(body).toHaveProperty("position");
    const position = body.position;
    expect(typeof position).toBe("object");
    expect(position).not.toBeNull();

    // `open` is always present (true or false) per dashboard.js:1235/1239.
    expect(position).toHaveProperty("open");
    expect(typeof position.open).toBe("boolean");

    if (position.open === true) {
      // Open-state: assert all 14 real camelCase fields are present.
      // Types per _dbPositionToLegacyShape (dashboard.js:1041-1056):
      //   side, symbol, entryTime, orderId, entrySignalScore,
      //   volatilityLevel: string-or-null (entrySignalScore + leverage
      //   may also be numeric depending on DB column type)
      //   entryPrice, quantity, tradeSize, effectiveSize, stopLoss,
      //   takeProfit: number-or-null (parseFloat output)
      //   leverage: numeric (no parseFloat; passed through)
      // We assert presence here; type-strictness is intentionally loose
      // because some fields can legitimately be null even on an open
      // position (e.g., entrySignalScore for legacy positions imported
      // before that column existed).
      for (const field of OPEN_POSITION_FIELDS) {
        expect(position, `open position must include camelCase field "${field}"`).toHaveProperty(field);
      }
    } else {
      // Empty state — either {open: false} (per :1239) or
      // {open: false, _degraded: true, _reason: <string>} (per :1235).
      // Both are acceptable shapes; we just assert that position.open
      // is strictly false.
      expect(position.open).toBe(false);
      if (position._degraded === true) {
        expect(position).toHaveProperty("_reason");
        expect(typeof position._reason).toBe("string");
      }
    }

    // Forbidden snake_case fields must NOT appear in the position object.
    // These were DASH-3 design-intent names that did not become runtime
    // field names. Asserting their absence catches any future snake_case
    // regression in the /api/data position surface.
    for (const field of FORBIDDEN_SNAKE_CASE_FIELDS) {
      expect(position, `position must NOT include forbidden snake_case field "${field}"`).not.toHaveProperty(field);
    }

    // Defense-in-depth: confirm no browser-context request to
    // api.kraken.com was made.
    expect(browserKrakenCalls).toEqual([]);
  });

  // Mode-page assertion — extends tests/mode-pages.spec.js no-skeleton-stuck
  // pattern, scoped specifically to the pos-stat card. The /paper and
  // /live pages internally fetch /api/data; this test verifies that the
  // position display surface reaches a rendered (non-skeleton) state on
  // both pages.
  for (const route of ["/paper", "/live"]) {
    test(`${route} — pos-stat card renders without staying on skeleton`, async ({ page }) => {
      // Defense-in-depth: capture any browser-context request to
      // api.kraken.com on this page navigation too.
      const browserKrakenCalls = [];
      await page.context().route("**/api.kraken.com/**", (route2) => {
        browserKrakenCalls.push(route2.request().url());
        route2.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ error: ["mocked-by-dash-6.B"], result: {} }),
        });
      });

      await authedSession(page);

      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push("console.error: " + m.text());
      });

      await page.goto(route);
      // Allow inline-init render + first WS tick to settle (matches
      // tests/mode-pages.spec.js timing).
      await page.waitForTimeout(1500);

      expect(errors, `unexpected page errors on ${route}: ${errors.join(" | ")}`).toEqual([]);

      // Phase 8b inline data must be consumed.
      const initType = await page.evaluate(() => typeof window.__INIT__);
      expect(initType, `window.__INIT__ on ${route}`).toBe("object");

      // pos-stat card must have content beyond the skeleton placeholder.
      // This confirms the position display surface flowed from /api/data
      // through render() and produced real content (or "Unavailable") —
      // never just a skel span.
      const posHtml = await page.evaluate(() => {
        const el = document.getElementById("pos-stat");
        return el ? el.innerHTML.trim() : "";
      });
      expect(posHtml.length, `pos-stat card on ${route} should not be empty`).toBeGreaterThan(0);
      expect(posHtml, `pos-stat card on ${route} should not be skeleton-only`).not.toMatch(/^<span[^>]*class="skel/);

      // Defense-in-depth: no browser-context request to api.kraken.com.
      expect(browserKrakenCalls).toEqual([]);
    });
  }
});
