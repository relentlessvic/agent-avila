// tests/nav.spec.js — proves the menu (hamburger drawer) works on every tab,
// specifically the Agent 3.0 tab where nav items target sections in the
// hidden dashboard page.

import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

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
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : null;
}
const EMAIL = loadEnvVar("DASHBOARD_EMAIL");
const PASS  = loadEnvVar("DASHBOARD_PASSWORD");
const SECRET = loadEnvVar("DASHBOARD_TOTP_SECRET");

async function authedSession(page) {
  const r1 = await page.request.post("/api/login", { data: { email: EMAIL, password: PASS, rememberMe: false } });
  expect(r1.status()).toBe(200);
  const r2 = await page.request.post("/2fa", { form: { code: generateTotp(SECRET) }, maxRedirects: 0 });
  expect([200, 302]).toContain(r2.status());
}

test.describe("Nav drawer on Agent 3.0 tab", () => {
  test.beforeEach(async ({ page }) => {
    await authedSession(page);
    await page.goto("/");
    await expect(page.locator(".status-bar")).toBeVisible();
  });

  test("Menu opens AND nav items work while on Agent 3.0 tab", async ({ page }) => {
    // Switch to Agent 3.0
    await page.click("#tab-info");
    await expect(page.locator("#info-page")).toBeVisible();
    await expect(page.locator("#dashboard-page")).toBeHidden();

    // Open the menu (hamburger). Drawer should slide in.
    await page.click(".hamburger");
    await expect(page.locator("#nav-drawer")).toHaveClass(/open/);

    // Click "Open Position" nav item — its target lives inside #dashboard-page
    await page.click('[onclick="navTo(\'section-position\')"]');

    // The fix: clicking should switch back to the dashboard tab so scrollIntoView
    // has a visible target. Verify the tab swap actually happened.
    await expect(page.locator("#dashboard-page")).toBeVisible();
    await expect(page.locator("#info-page")).toBeHidden();
    await expect(page.locator("#tab-dashboard")).toHaveClass(/active/);

    // Drawer should be closed (closeNav fires inside navTo)
    await expect(page.locator("#nav-drawer")).not.toHaveClass(/open/);
  });

  test("Menu still works on dashboard tab (no regression)", async ({ page }) => {
    await page.click(".hamburger");
    await expect(page.locator("#nav-drawer")).toHaveClass(/open/);

    await page.click('[onclick="navTo(\'section-terminal\')"]');

    // Tab should stay on dashboard, drawer closes
    await expect(page.locator("#dashboard-page")).toBeVisible();
    await expect(page.locator("#nav-drawer")).not.toHaveClass(/open/);
  });
});
