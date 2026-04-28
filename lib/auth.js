// lib/auth.js — JWT (HS256) + refresh rotation. Zero deps beyond node:crypto.
import crypto from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ACCESS_TTL_SEC  = 15 * 60;            // 15 min
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;  // 30 days
const REFRESH_STORE   = "refresh-tokens.json";

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || process.env.DASHBOARD_PASSWORD || "change-me-access";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.DASHBOARD_TOTP_SECRET || "change-me-refresh";

// ── base64url ──────────────────────────────────────────────────────────────
const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const b64uJSON = (obj) => b64u(JSON.stringify(obj));
const fromB64u = (s) => Buffer.from(s.replace(/-/g,"+").replace(/_/g,"/"), "base64");

function sign(payload, secret, ttlSec) {
  const header = { alg: "HS256", typ: "JWT" };
  const body   = { ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + ttlSec };
  const data   = `${b64uJSON(header)}.${b64uJSON(body)}`;
  const sig    = b64u(crypto.createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

function verify(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = b64u(crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest());
  // constant-time compare
  const a = Buffer.from(s); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(fromB64u(p).toString("utf8")); } catch { return null; }
  if (payload.exp && payload.exp < Math.floor(Date.now()/1000)) return null;
  return payload;
}

// ── refresh-token rotation store ───────────────────────────────────────────
function loadStore() {
  if (!existsSync(REFRESH_STORE)) return {};
  try { return JSON.parse(readFileSync(REFRESH_STORE, "utf8")); } catch { return {}; }
}
function saveStore(s) { writeFileSync(REFRESH_STORE, JSON.stringify(s, null, 2)); }
function hashToken(t) { return crypto.createHash("sha256").update(t).digest("hex"); }

function recordRefresh(jti, sub) {
  const store = loadStore();
  store[jti] = { sub, createdAt: Date.now() };
  saveStore(store);
}
function invalidateRefresh(jti) {
  const store = loadStore();
  delete store[jti];
  saveStore(store);
}
function isRefreshActive(jti) {
  const store = loadStore();
  return !!store[jti];
}

// ── public API ─────────────────────────────────────────────────────────────
export function signAccess(sub, extra = {}) {
  return sign({ sub, ...extra, typ: "access" }, ACCESS_SECRET, ACCESS_TTL_SEC);
}
export function signRefresh(sub) {
  const jti = crypto.randomBytes(16).toString("hex");
  const token = sign({ sub, jti, typ: "refresh" }, REFRESH_SECRET, REFRESH_TTL_SEC);
  recordRefresh(jti, sub);
  return { token, jti };
}
export function verifyAccess(token)  { const p = verify(token, ACCESS_SECRET);  return p?.typ === "access"  ? p : null; }
export function verifyRefresh(token) {
  const p = verify(token, REFRESH_SECRET);
  if (!p || p.typ !== "refresh" || !p.jti) return null;
  if (!isRefreshActive(p.jti)) return null;
  return p;
}
export function rotateRefresh(oldToken) {
  const p = verifyRefresh(oldToken);
  if (!p) return null;
  invalidateRefresh(p.jti);            // single-use: invalidate old
  return signRefresh(p.sub);           // issue new
}
export function revokeRefresh(token) {
  const p = verify(token, REFRESH_SECRET);
  if (p?.jti) invalidateRefresh(p.jti);
}
export function revokeAllForSub(sub) {
  const store = loadStore();
  for (const [jti, rec] of Object.entries(store)) if (rec.sub === sub) delete store[jti];
  saveStore(store);
}

// ── cookie helpers ─────────────────────────────────────────────────────────
export function refreshCookie(token, persistent = true) {
  const maxAge = persistent ? REFRESH_TTL_SEC : 0;     // 0 = session cookie
  const ageStr = persistent ? `; Max-Age=${maxAge}` : "";
  return `refresh=${token}; HttpOnly; SameSite=Strict; Path=/auth${ageStr}; Secure`;
}
export function clearRefreshCookie() {
  return `refresh=; HttpOnly; SameSite=Strict; Path=/auth; Max-Age=0`;
}

export const TTL = { ACCESS_TTL_SEC, REFRESH_TTL_SEC };
