// tests/mode-pages.spec.js — regression for /paper and /live script parse.
//
// Catches the Phase 7a switchMode() bug where "\n\n" inside a backtick
// template literal decoded to literal newlines on the wire, breaking the
// inline <script> with SyntaxError: Invalid or unexpected token. The whole
// script never ran, leaving every card stuck on its skeleton placeholder.
//
// Asserts on each route:
//   1. No pageerror events fire (script parses).
//   2. window.__INIT__ is an object (Phase 8b inline data is consumed).
//   3. Main cards have non-skeleton content (render() ran).

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
  const code = (((hmac[offset]     & 0x7f) << 24)
              | ((hmac[offset + 1] & 0xff) << 16)
              | ((hmac[offset + 2] & 0xff) << 8)
              |  (hmac[offset + 3] & 0xff)) % 1_000_000;
  return code.toString().padStart(6, "0");
}
function loadEnvVar(key) {
  const m = readFileSync(".env", "utf8").match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : null;
}
const EMAIL  = loadEnvVar("DASHBOARD_EMAIL");
const PASS   = loadEnvVar("DASHBOARD_PASSWORD");
const SECRET = loadEnvVar("DASHBOARD_TOTP_SECRET");

async function authedSession(page) {
  const r1 = await page.request.post("/api/login", { data: { email: EMAIL, password: PASS, rememberMe: false } });
  expect(r1.status()).toBe(200);
  const r2 = await page.request.post("/2fa", { form: { code: generateTotp(SECRET) }, maxRedirects: 0 });
  expect([200, 302]).toContain(r2.status());
}

for (const route of ["/paper", "/live"]) {
  test(`${route} — script parses, __INIT__ consumed, cards render`, async ({ page }) => {
    await authedSession(page);

    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push("console.error: " + m.text()); });

    await page.goto(route);
    // Allow inline-init render + first WS tick to settle.
    await page.waitForTimeout(1500);

    expect(errors, `unexpected page errors on ${route}: ${errors.join(" | ")}`).toEqual([]);

    // Phase 8b inline data must be consumed.
    const initType = await page.evaluate(() => typeof window.__INIT__);
    expect(initType, `window.__INIT__ on ${route}`).toBe("object");

    // Main cards should have content beyond the skeleton placeholder.
    const cards = await page.evaluate(() => ({
      balance: document.getElementById("balance-stat")?.innerHTML.trim() || "",
      pos:     document.getElementById("pos-stat")?.innerHTML.trim()     || "",
      wl:      document.getElementById("wl-stat")?.innerHTML.trim()      || "",
      pnl:     document.getElementById("pnl-stat")?.innerHTML.trim()     || "",
      dec:     document.getElementById("dec-stat")?.innerHTML.trim()     || "",
    }));
    for (const [name, html] of Object.entries(cards)) {
      // Skeleton was the initial state; once render() runs, textContent is
      // populated with real data (or "Unavailable") — never just a skel span.
      expect(html, `${name} card on ${route} should not be skeleton-only`).not.toMatch(/^<span[^>]*class="skel/);
      expect(html.length, `${name} card on ${route} should not be empty`).toBeGreaterThan(0);
    }
  });
}
