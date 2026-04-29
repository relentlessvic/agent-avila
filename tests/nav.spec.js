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
    await page.goto("/dashboard");
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

  test("All 12 nav items resolve to a real DOM section (no dead links)", async ({ page }) => {
    // Targets every nav-item — fails if any sectionId doesn't exist in the DOM.
    const targets = await page.$$eval(".nav-item[onclick]", els =>
      els.map(el => el.getAttribute("onclick").match(/navTo\('([^']+)'\)/)?.[1]).filter(Boolean)
    );
    expect(targets.length).toBeGreaterThanOrEqual(12);

    for (const id of targets) {
      const exists = await page.locator("#" + id).count();
      expect(exists, `nav target #${id} must exist in DOM`).toBeGreaterThan(0);
    }
  });

  test("Escape key closes the nav drawer", async ({ page }) => {
    await page.click(".hamburger");
    await expect(page.locator("#nav-drawer")).toHaveClass(/open/);
    await page.keyboard.press("Escape");
    await expect(page.locator("#nav-drawer")).not.toHaveClass(/open/);
  });

  test("Section actually lands in viewport (full scroll-into-view check)", async ({ page }) => {
    // Set a known viewport so the assertion is deterministic
    await page.setViewportSize({ width: 1280, height: 800 });

    // Switch to Agent 3.0
    await page.click("#tab-info");
    await expect(page.locator("#info-page")).toBeVisible();

    // Open menu and click Trading Terminal
    await page.click(".hamburger");
    await page.click('[onclick="navTo(\'section-terminal\')"]');

    // Dashboard should now be visible
    await expect(page.locator("#dashboard-page")).toBeVisible();

    // Wait for smooth scroll + rAF to settle
    await page.waitForTimeout(700);

    // The target section should now be in the visible viewport area —
    // not just "exists somewhere on the page". Top should be in upper
    // ~half of the viewport (allowing for sticky nav + status-bar height).
    const target = page.locator("#section-terminal");
    const box = await target.boundingBox();
    expect(box, "section-terminal must have a layout box").toBeTruthy();
    expect(box.y, "section should be near the top of the viewport after scroll").toBeLessThan(400);
    expect(box.y, "section should be below sticky header").toBeGreaterThan(-50);
  });
});
