// tests/modal.spec.js — proves the modal recursion fix in a real browser.
// Auth flow: POST /api/login -> generate TOTP -> POST /2fa -> session cookie set.
// Then drive showModal() and assert recursion-free close + page interactivity.

import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

// ── TOTP helper (RFC 6238) — same algorithm dashboard.js uses ───────────────
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(s) {
  s = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, val = 0;
  const out = [];
  for (const ch of s) {
    val = (val << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((val >>> bits) & 0xff); }
  }
  return Buffer.from(out);
}
function generateTotp(secret) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (((hmac[offset] & 0x7f) << 24)
              | ((hmac[offset + 1] & 0xff) << 16)
              | ((hmac[offset + 2] & 0xff) << 8)
              |  (hmac[offset + 3] & 0xff)) % 1_000_000;
  return code.toString().padStart(6, "0");
}

function loadEnvVar(key) {
  const env = readFileSync(".env", "utf8");
  const m = env.match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

const EMAIL  = loadEnvVar("DASHBOARD_EMAIL");
const PASS   = loadEnvVar("DASHBOARD_PASSWORD");
const SECRET = loadEnvVar("DASHBOARD_TOTP_SECRET");

async function authedSession(page) {
  const r1 = await page.request.post("/api/login", {
    data: { email: EMAIL, password: PASS, rememberMe: false },
  });
  expect(r1.status(), "login should return 200").toBe(200);

  const code = generateTotp(SECRET);
  const r2 = await page.request.post("/2fa", {
    form: { code },
    maxRedirects: 0,
  });
  expect([200, 302]).toContain(r2.status());
}

test.describe("Modal recursion fix", () => {
  test.beforeEach(async ({ page }) => {
    await authedSession(page);
    // Cutover: /dashboard now serves the v2 command center; the legacy modal
    // recursion fix this spec verifies still lives at /dashboard-legacy.
    await page.goto("/dashboard-legacy");
    await expect(page.locator(".status-bar")).toBeVisible();
    // Sanity check: showModal must be reachable on window
    const fnType = await page.evaluate(() => typeof window.showModal);
    expect(fnType, "window.showModal should be a function").toBe("function");
  });

  test("Cancel closes modal — page remains interactive", async ({ page }) => {
    const overlay = page.locator("#modal-overlay");

    // Stash the Promise on window so evaluateHandle doesn't auto-await it
    await page.evaluate(() => {
      window.__modalP = window.showModal({ title: "Test", msg: "Confirm test action?" });
    });
    await expect(overlay).toHaveClass(/open/);

    await page.click(".modal-btn-cancel");

    // Modal closes (no recursion freeze)
    await expect(overlay).not.toHaveClass(/open/, { timeout: 1000 });

    // Promise resolved with false
    const result = await page.evaluate(() => window.__modalP);
    expect(result).toBe(false);

    // Page interactive: clicking Agent 3.0 tab actually switches view
    await page.click("#tab-info");
    await expect(page.locator("#tab-info")).toHaveClass(/active/);
    await expect(page.locator("#info-page")).toBeVisible();
  });

  test("Confirm closes modal — page remains interactive", async ({ page }) => {
    const overlay = page.locator("#modal-overlay");

    await page.evaluate(() => {
      window.__modalP = window.showModal({ title: "Test", msg: "Confirm test action?" });
    });
    await expect(overlay).toHaveClass(/open/);

    await page.click(".modal-btn-confirm");

    await expect(overlay).not.toHaveClass(/open/, { timeout: 1000 });
    const result = await page.evaluate(() => window.__modalP);
    expect(result).toBe(true);

    await page.click("#tab-info");
    await expect(page.locator("#info-page")).toBeVisible();
  });

  test("Reopening while open auto-resolves the first promise", async ({ page }) => {
    // Open modal A
    await page.evaluate(() => {
      window.__modalA = window.showModal({ title: "Modal A", msg: "First" });
    });

    // Open modal B without dismissing A
    await page.evaluate(() => {
      window.__modalB = window.showModal({ title: "Modal B", msg: "Second" });
    });

    // First promise should resolve as `false` (cancelled)
    const resultA = await page.evaluate(() => window.__modalA);
    expect(resultA).toBe(false);

    // Modal B is still open
    await expect(page.locator("#modal-overlay")).toHaveClass(/open/);
    await expect(page.locator("#modal-title")).toHaveText("Modal B");

    // Cancel modal B
    await page.click(".modal-btn-cancel");
    const resultB = await page.evaluate(() => window.__modalB);
    expect(resultB).toBe(false);
  });

  test("Closed modal does not block clicks (pointer-events guard)", async ({ page }) => {
    // No modal initially — tab navigation must work
    await page.click("#tab-info");
    await expect(page.locator("#info-page")).toBeVisible();

    // Open then immediately cancel
    await page.evaluate(() => { window.__quickP = window.showModal({ title: "Quick", msg: "Test" }); });
    await page.click(".modal-btn-cancel");
    expect(await page.evaluate(() => window.__quickP)).toBe(false);

    // Now click another tab — must not be blocked
    await page.click("#tab-dashboard");
    await expect(page.locator("#dashboard-page")).toBeVisible();
  });
});
