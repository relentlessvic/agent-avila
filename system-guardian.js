// system-guardian.js
// Single-source-of-truth system status + auto-alert engine for Agent Avila.
// State is read from files (not in-memory) so the dashboard process can see
// what the bot process has been doing.

import { existsSync, readFileSync } from "fs";

// ── Throttle ────────────────────────────────────────────────────────────────
// Per-issue cooldown so a sustained outage doesn't spam Discord. Each issue
// type can fire at most once per ALERT_COOLDOWN_MS.
const _alertCooldown = new Map();
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1h

async function sendAlert(issueKey, message) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return false;
  const last = _alertCooldown.get(issueKey) || 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return false;
  _alertCooldown.set(issueKey, Date.now());
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `⚠️ RISK ALERT\nIssue: watchdog · ${message}` }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch (err) {
    console.log(`[guardian] discord post failed: ${err.message}`);
    return false;
  }
}

// ── Build system status from file-based state ───────────────────────────────
// `sessionsView` is { activeSessions, pendingSessions } passed by the caller
// (dashboard.js owns the in-process session Sets — guardian can't reach them
//  from a child module without a circular import).
export function buildSystemStatus({ sessionsView = { activeSessions: 0, pendingSessions: 0 } } = {}) {
  // Bot last-run derives from the trade log (single source of truth)
  let lastRun = null, lastRunAgeMin = null;
  if (existsSync("safety-check-log.json")) {
    try {
      const blog = JSON.parse(readFileSync("safety-check-log.json", "utf8"));
      const last = blog.trades?.[blog.trades.length - 1];
      if (last?.timestamp) {
        lastRun = last.timestamp;
        lastRunAgeMin = (Date.now() - new Date(last.timestamp).getTime()) / 60000;
      }
    } catch {}
  }

  // Lock liveness — file present AND PID alive
  let lockActive = false, lockPid = null;
  if (existsSync(".bot.lock")) {
    try {
      const pid = parseInt(readFileSync(".bot.lock", "utf8").trim(), 10);
      if (Number.isFinite(pid)) {
        lockPid = pid;
        try { process.kill(pid, 0); lockActive = true; } catch {}
      }
    } catch {}
  }

  // Bot control flags
  let ctrl = {};
  if (existsSync("bot-control.json")) {
    try { ctrl = JSON.parse(readFileSync("bot-control.json", "utf8")); } catch {}
  }

  return {
    auth: {
      activeSessions: sessionsView.activeSessions,
      pendingSessions: sessionsView.pendingSessions,
    },
    bot: {
      lastRun,
      lastRunAgeMin,
      running: lockActive,                 // single signal: lock alive == running
      lockPid,
      paperTrading: ctrl.paperTrading !== false,
      paused:  !!ctrl.paused,
      stopped: !!ctrl.stopped,
      killed:  !!ctrl.killed,
    },
    execution: {
      lockActive,
      lockFile: ".bot.lock",
    },
    discord: {
      enabled: !!process.env.DISCORD_WEBHOOK_URL,
      lastSummaryDate: ctrl.lastSummaryDate || null,
    },
    runtime: {
      uptimeSec: Math.round(process.uptime()),
      memoryMB:  Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp: Date.now(),
      railway:   !!process.env.RAILWAY_ENVIRONMENT,
    },
  };
}

// ── Evaluate health → list of [issueKey, message] tuples ────────────────────
export function evaluateSystemHealth(status) {
  const issues = [];

  // CRITICAL
  if (status.bot.lastRun === null) {
    issues.push(["bot-no-run", "bot has not run yet (no safety-check-log)"]);
  } else if (status.bot.lastRunAgeMin > 15) {
    issues.push(["bot-stale", `bot last ran ${status.bot.lastRunAgeMin.toFixed(1)} min ago (expected every 5 min)`]);
  }

  // Stale lock — file present with dead PID, persisting >8 min (so it's not just
  // a normal in-flight handover between cron cycles).
  if (existsSync(".bot.lock") && !status.execution.lockActive && status.bot.lastRunAgeMin !== null && status.bot.lastRunAgeMin > 8) {
    issues.push(["lock-stale", `bot lockfile present with dead PID ${status.bot.lockPid} for >8 min — next run will auto-clean`]);
  }

  if (status.runtime.memoryMB > 700) {
    issues.push(["mem-high", `dashboard memory ${status.runtime.memoryMB}MB > 700MB threshold`]);
  }

  if (status.bot.killed) {
    issues.push(["bot-killed", "kill switch is active (drawdown-triggered halt)"]);
  }

  return issues;
}

// ── One-shot check + alert ──────────────────────────────────────────────────
export async function runSystemCheck(opts = {}) {
  const status = buildSystemStatus(opts);
  const issues = evaluateSystemHealth(status);
  for (const [key, msg] of issues) {
    await sendAlert(key, msg);
  }
  return { status, issues };
}
