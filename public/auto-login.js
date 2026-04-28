// public/auto-login.js — silent refresh + dashboard sync.
// Loaded by the dashboard <script src="/auto-login.js" defer></script>.
(function () {
  const ACCESS_KEY  = "avila_access";
  const ACCESS_EXP  = "avila_access_exp";
  const CACHE_KEY   = (path) => `avila_cache:${path}`;

  // ── Token store ─────────────────────────────────────────────────────────
  function getAccess() {
    const t = localStorage.getItem(ACCESS_KEY) || sessionStorage.getItem(ACCESS_KEY);
    const exp = parseInt(localStorage.getItem(ACCESS_EXP) || sessionStorage.getItem(ACCESS_EXP) || "0", 10);
    if (!t) return null;
    if (exp && exp - 30 < Math.floor(Date.now()/1000)) return null; // expiring soon
    return t;
  }
  function setAccess(token, expSec, persistent) {
    const store = persistent ? localStorage : sessionStorage;
    const other = persistent ? sessionStorage : localStorage;
    store.setItem(ACCESS_KEY, token);
    store.setItem(ACCESS_EXP, String(expSec));
    other.removeItem(ACCESS_KEY); other.removeItem(ACCESS_EXP);
  }
  function clearAccess() {
    [localStorage, sessionStorage].forEach(s => { s.removeItem(ACCESS_KEY); s.removeItem(ACCESS_EXP); });
  }

  // ── Silent refresh ──────────────────────────────────────────────────────
  let refreshInFlight = null;
  async function refreshAccess() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const r = await fetch("/auth/refresh", { method: "POST", credentials: "include" });
        if (!r.ok) return null;
        const d = await r.json();
        if (!(d.success || d.ok) || !d.data?.accessToken) return null;
        const persistent = !!d.data.persistent;
        setAccess(d.data.accessToken, d.data.accessExp, persistent);
        return d.data.accessToken;
      } catch { return null; }
      finally { refreshInFlight = null; }
    })();
    return refreshInFlight;
  }

  // ── Authed fetch with auto-refresh-on-401 ───────────────────────────────
  async function authFetch(url, opts = {}) {
    let token = getAccess() || await refreshAccess();
    const headers = { ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    let res = await fetch(url, { ...opts, headers, credentials: "include" });
    if (res.status === 401) {
      token = await refreshAccess();
      if (!token) { window.location.href = "/login"; return res; }
      headers["Authorization"] = `Bearer ${token}`;
      res = await fetch(url, { ...opts, headers, credentials: "include" });
    }
    return res;
  }

  // ── Standard response unwrap (success | ok) ─────────────────────────────
  function unwrap(d) {
    if (!d || typeof d !== "object") return { ok: false, error: "Malformed response" };
    return { ok: d.success === true || d.ok === true, data: d.data, error: d.error || null };
  }

  // ── Dashboard sync: per-block polling, last-updated, cache fallback ─────
  const blocks = new Map(); // path -> { intervalMs, listeners:Set, timer, lastUpdated, loading, error, data }

  function emit(path) {
    const b = blocks.get(path); if (!b) return;
    b.listeners.forEach(fn => { try { fn({ ...b }); } catch {} });
  }

  async function pull(path) {
    const b = blocks.get(path); if (!b) return;
    b.loading = true; b.error = null; emit(path);
    try {
      const res = await authFetch(path);
      const json = await res.json().catch(() => ({}));
      const u = unwrap(json);
      if (!u.ok) throw new Error(u.error || `HTTP ${res.status}`);
      b.data = u.data; b.lastUpdated = Date.now(); b.error = null;
      try { localStorage.setItem(CACHE_KEY(path), JSON.stringify({ data: u.data, ts: b.lastUpdated })); } catch {}
    } catch (err) {
      b.error = err.message || "fetch-failed";
      // fallback to cache
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY(path)) || "null");
        if (c && b.data == null) { b.data = c.data; b.lastUpdated = c.ts; }
      } catch {}
    } finally {
      b.loading = false; emit(path);
    }
  }

  function subscribe(path, intervalMs, listener) {
    let b = blocks.get(path);
    if (!b) {
      b = { intervalMs, listeners: new Set(), timer: null, lastUpdated: 0, loading: false, error: null, data: null };
      blocks.set(path, b);
    }
    b.listeners.add(listener);
    if (!b.timer) {
      pull(path);
      b.timer = setInterval(() => pull(path), intervalMs);
    }
    // emit cached state immediately
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY(path)) || "null");
      if (c) { b.data = b.data ?? c.data; b.lastUpdated = b.lastUpdated || c.ts; emit(path); }
    } catch {}
    return function unsubscribe() {
      b.listeners.delete(listener);
      if (b.listeners.size === 0) { clearInterval(b.timer); b.timer = null; blocks.delete(path); }
    };
  }

  // ── Bootstrap: silent auto-login ────────────────────────────────────────
  async function bootstrap() {
    if (getAccess()) { window.dispatchEvent(new Event("avila:auth-ready")); return; }
    const t = await refreshAccess();
    window.dispatchEvent(new CustomEvent("avila:auth-ready", { detail: { authed: !!t } }));
  }

  // ── Public API ──────────────────────────────────────────────────────────
  window.Avila = Object.freeze({
    authFetch,
    refreshAccess,
    getAccess,
    clearAccess,
    unwrap,
    sync: {
      // Default block subscriptions per the spec
      market:   (cb, ms = 5000)  => subscribe("/api/market", ms, cb),
      botStatus:(cb, ms = 7000)  => subscribe("/api/bot-status", ms, cb),
      positions:(cb, ms = 4000)  => subscribe("/api/positions", ms, cb),
      // Generic
      subscribe,
    },
    async logout() {
      try { await fetch("/auth/logout", { method: "POST", credentials: "include" }); } catch {}
      clearAccess();
      window.location.href = "/login";
    },
  });

  bootstrap();
})();
