// routes.example.js — Express route structure wiring auth + Kraken + bot safety + sync.
// Reference implementation. Mount in your Express app: app.use(routes).
import express from "express";
import cookieParser from "cookie-parser";
import {
  signAccess, signRefresh, verifyAccess, verifyRefresh, rotateRefresh, revokeRefresh,
  refreshCookie, clearRefreshCookie, TTL,
} from "./lib/auth.js";
import { safePublicGet, makePrivateCaller, breakerStatus } from "./lib/kraken-safe.js";
import { evaluateBotSafety } from "./lib/bot-safety.js";

const router = express.Router();
router.use(express.json());
router.use(cookieParser());

// ── Standard response helpers ────────────────────────────────────────────
const ok   = (data)        => ({ success: true, ok: true, data });
const fail = (error, code) => ({ success: false, ok: false, error, code });

// ── Auth middleware ──────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const payload = token && verifyAccess(token);
  if (!payload) return res.status(401).json(fail("Unauthorized", "AUTH_REQUIRED"));
  req.user = { sub: payload.sub };
  next();
}

// ── /auth/login ──────────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  const { email = "", password = "", rememberMe = false } = req.body || {};
  // Single-user creds via env (replace with user lookup if multi-user)
  if (email !== process.env.DASHBOARD_EMAIL || password !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json(fail("Invalid email or password", "BAD_CREDS"));
  }
  const sub = email;
  const access  = signAccess(sub, { email });
  const { token: refresh } = signRefresh(sub);
  const accessExp = Math.floor(Date.now()/1000) + TTL.ACCESS_TTL_SEC;
  res.setHeader("Set-Cookie", refreshCookie(refresh, !!rememberMe));
  return res.json(ok({ accessToken: access, accessExp, persistent: !!rememberMe, user: { sub, email } }));
});

// ── /auth/refresh ────────────────────────────────────────────────────────
router.post("/auth/refresh", async (req, res) => {
  const old = req.cookies?.refresh;
  if (!old) return res.status(401).json(fail("No refresh token", "NO_REFRESH"));
  const rotated = rotateRefresh(old);
  if (!rotated) {
    res.setHeader("Set-Cookie", clearRefreshCookie());
    return res.status(401).json(fail("Refresh token invalid or expired", "REFRESH_INVALID"));
  }
  const payload = verifyRefresh(rotated.token);
  const access = signAccess(payload.sub);
  const accessExp = Math.floor(Date.now()/1000) + TTL.ACCESS_TTL_SEC;
  res.setHeader("Set-Cookie", refreshCookie(rotated.token, true));
  return res.json(ok({ accessToken: access, accessExp, persistent: true }));
});

// ── /auth/logout ─────────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res) => {
  const old = req.cookies?.refresh;
  if (old) revokeRefresh(old);
  res.setHeader("Set-Cookie", clearRefreshCookie());
  return res.json(ok({ loggedOut: true }));
});

// ── /auth/me ─────────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, (req, res) => {
  return res.json(ok({ user: { sub: req.user.sub } }));
});

// ── Kraken-backed dashboard endpoints ────────────────────────────────────
// In your real app inject the signing fn from your existing kraken module.
const krakenPrivate = makePrivateCaller({
  apiKey: process.env.KRAKEN_API_KEY,
  signRequest: (path, nonce, body) => {
    // delegate to your existing HMAC-SHA512 signer
    // return signKrakenRequest(path, nonce, body, process.env.KRAKEN_SECRET_KEY);
    return ""; // <-- replace with real signer
  },
});

router.get("/api/market", requireAuth, async (req, res) => {
  const symbol = (req.query.symbol || "XXRPZUSD").toString();
  const r = await safePublicGet(`/0/public/Ticker?pair=${encodeURIComponent(symbol)}`);
  if (!r.success) return res.status(503).json(fail(r.error, "KRAKEN_DOWN"));
  return res.json(ok({ symbol, ticker: r.data, fetchedAt: Date.now() }));
});

router.get("/api/bot-status", requireAuth, async (req, res) => {
  // Pull last-run + confidence from your bot-state files (existing bot.js writes these)
  // Below is a stub showing the safety-gate evaluation.
  const state = {
    lastDataTimestamp: req.app.locals.lastDataTimestamp || null,
    confidenceScore:   req.app.locals.lastConfidence ?? null,
    paperTrading:      process.env.PAPER_TRADING === "true",
  };
  const verdict = evaluateBotSafety(state);
  return res.json(ok({
    state,
    safety: verdict.data,
    breaker: breakerStatus(),
  }));
});

router.get("/api/positions", requireAuth, async (req, res) => {
  const r = await krakenPrivate("/0/private/OpenPositions", {});
  if (!r.success) return res.status(503).json(fail(r.error, "KRAKEN_DOWN"));
  return res.json(ok({ positions: r.data, fetchedAt: Date.now() }));
});

// ── Bot trade endpoint — gated by safety ─────────────────────────────────
router.post("/api/bot/execute", requireAuth, async (req, res) => {
  const { intent } = req.body || {};
  const verdict = evaluateBotSafety({
    lastDataTimestamp: req.app.locals.lastDataTimestamp,
    confidenceScore:   intent?.confidence,
    paperTrading:      process.env.PAPER_TRADING === "true",
  });
  if (!verdict.data.allowLive) {
    return res.json(ok({ executed: false, mode: verdict.data.mode, reasons: verdict.data.reasons }));
  }
  const r = await krakenPrivate("/0/private/AddOrder", {
    pair: intent.pair, type: intent.side, ordertype: "market", volume: intent.volume,
  });
  if (!r.success) return res.status(503).json(fail(r.error, "ORDER_FAILED"));
  return res.json(ok({ executed: true, mode: "LIVE", order: r.data }));
});

// ── Health (unauthenticated) ─────────────────────────────────────────────
router.get("/api/health", (req, res) => res.json(ok({ uptime: process.uptime(), breaker: breakerStatus() })));

// ── Global error guard ───────────────────────────────────────────────────
router.use((err, req, res, _next) => {
  // never leak stack traces to clients
  const status = err?.status || 500;
  res.status(status).json(fail(err?.publicMessage || "Server error", err?.code || "INTERNAL"));
});

export default router;
