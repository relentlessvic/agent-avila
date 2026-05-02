// Phase D-5.10.5.6.1 — recovery inspect tool (read-only).
//
// Operator-driven CLI diagnostic. Prints a comprehensive recovery report:
// schema version, paper / live position counts by status, NULL-FK
// trade_events, bot_control state, D-5.10.5.5 cutover gate verdict, and
// recommended next actions. Pure read-only SELECT queries via existing
// db.js exports. No mutation capability; the script does not import any
// helper that performs writes.
//
// SAFETY CONTRACT
// ---------------
// 1. Inspect-only. No INSERT, UPDATE, DELETE, or UPSERT.
// 2. No Kraken API calls of any kind.
// 3. No env-var writes; reads DATABASE_URL only.
// 4. No bot_control mutations.
// 5. No position open / close actions.
// 6. The bot.js source code does not import this script.
// 7. The dashboard.js source code does not import this script.
// 8. Output never includes credentials, API keys, or webhook URLs.
// 9. Exit 0 on successful inspection; exit 1 on missing DATABASE_URL or
//    on any uncaught error.
//
// USAGE
// -----
//   PGURL=$(railway variables --service Postgres --json | python3 -c \
//     "import json,sys;print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])")
//   DATABASE_URL="$PGURL" node scripts/recovery-inspect.js

import "dotenv/config";
import {
  query,
  schemaVersion as dbSchemaVersion,
  countOpenPositions,
  countOrphanedPositions,
  close as dbClose,
} from "../db.js";

// ─── Format helpers (no emoji per CLAUDE.md) ────────────────────────────────
function isoOrString(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}
function fmtAge(timestampLike) {
  if (!timestampLike) return "(unknown age)";
  const t = new Date(timestampLike).getTime();
  if (!Number.isFinite(t)) return "(unknown age)";
  const ageMs = Date.now() - t;
  const ageMin = Math.round(ageMs / 60000);
  if (ageMin < 60)   return `~${ageMin} min ago`;
  if (ageMin < 1440) return `~${(ageMin / 60).toFixed(1)} hours ago`;
  return `~${(ageMin / 1440).toFixed(1)} days ago`;
}
function fmtUSD(v, dp = 2) {
  if (v == null) return "?";
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return "?";
  return (n >= 0 ? "+" : "-") + "$" + Math.abs(n).toFixed(dp);
}
function fmtNum(v, dp = 8) {
  if (v == null) return "?";
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return "?";
  return n.toFixed(dp);
}
function header(title) {
  console.log(`\n─── ${title} ───`);
}

// ─── Inspection passes ──────────────────────────────────────────────────────

async function showSchemaVersion() {
  const sv = await dbSchemaVersion();
  if (!sv) {
    console.log("schema version: unknown (schema_migrations table missing)");
    return;
  }
  console.log(`schema version: ${sv.version} (${sv.name})`);
}

async function showOpenPositions(mode) {
  const r = await query(
    `SELECT id, kraken_order_id, entry_price, stop_loss, take_profit,
            quantity, leverage, side, entry_time, updated_at
     FROM positions
     WHERE mode = $1 AND status = 'open'
     ORDER BY entry_time DESC`,
    [mode]
  );
  header(`${mode === "paper" ? "Paper" : "Live"} open positions (${r.rows.length})`);
  if (r.rows.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const p of r.rows) {
    const ep  = fmtNum(p.entry_price, 5);
    const sl  = fmtNum(p.stop_loss, 8);
    const tp  = fmtNum(p.take_profit, 8);
    const qty = fmtNum(p.quantity, 6);
    console.log(`  id=${p.id}  ${p.kraken_order_id || "(no orderId)"}  side=${p.side}  lev=${p.leverage}x`);
    console.log(`         entry=$${ep}  SL=$${sl}  TP=$${tp}  qty=${qty}`);
    console.log(`         opened ${isoOrString(p.entry_time)} (${fmtAge(p.entry_time)})`);
    console.log(`         updated ${isoOrString(p.updated_at)}`);
  }
}

async function showOrphanedPositions(mode) {
  const r = await query(
    `SELECT id, kraken_order_id, entry_time, exit_time, exit_reason,
            realized_pnl_usd, realized_pnl_pct, metadata
     FROM positions
     WHERE mode = $1 AND status = 'orphaned'
     ORDER BY entry_time DESC`,
    [mode]
  );
  header(`${mode === "paper" ? "Paper" : "Live"} orphaned positions (${r.rows.length})`);
  if (r.rows.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const p of r.rows) {
    const pnl    = p.realized_pnl_usd != null ? fmtUSD(p.realized_pnl_usd, 2) : "?";
    const pnlPct = p.realized_pnl_pct != null ? parseFloat(p.realized_pnl_pct).toFixed(2) + "%" : "?";
    console.log(`  id=${p.id}  ${p.kraken_order_id || "(no orderId)"}  reason=${p.exit_reason || "?"}`);
    console.log(`         pnl=${pnl}  pct=${pnlPct}`);
    if (p.entry_time) console.log(`         opened ${isoOrString(p.entry_time)}`);
    if (p.exit_time)  console.log(`         exit   ${isoOrString(p.exit_time)}`);
    if (p.metadata && typeof p.metadata === "object" && Object.keys(p.metadata).length > 0) {
      console.log(`         metadata ${JSON.stringify(p.metadata)}`);
    }
  }
}

async function showLiveTradeEventsCount() {
  const r = await query("SELECT count(*)::int AS c FROM trade_events WHERE mode='live'");
  header(`Live trade_events (${r.rows[0].c})`);
  if (r.rows[0].c === 0) {
    console.log("  (none — live mode has never traded)");
  } else {
    console.log("  (count above; details intentionally omitted from inspector for brevity)");
  }
}

async function showNullFkTradeEvents(mode) {
  const r = await query(
    `SELECT count(*)::int AS c, event_type
     FROM trade_events
     WHERE mode = $1 AND position_id IS NULL
     GROUP BY event_type
     ORDER BY event_type`,
    [mode]
  );
  console.log(`  ${mode}:`);
  if (r.rows.length === 0) {
    console.log("    (none)");
    return;
  }
  // Phase C.3 — audit-only event types from B.2b-SL / B.2d manual SL/TP
  // edits. The dashboard wrappers (shadowRecordManualPaperSLUpdate /
  // shadowRecordManualPaperTPUpdate) skip insertTradeEvent when
  // updatePositionRiskLevelsTx returns null, so a null-FK row of these
  // types should not be produced by current code paths. The dedicated
  // classification here is operator-playbook clarity, not correctness.
  const AUDIT_ONLY_EVENT_TYPES = new Set(["manual_sl_update", "manual_tp_update"]);
  for (const row of r.rows) {
    let note;
    if (/_attempt$/.test(row.event_type)) {
      note = "  (expected — failed attempt)";
    } else if (AUDIT_ONLY_EVENT_TYPES.has(row.event_type)) {
      note = "  (audit-only — investigate if seen)";
    } else {
      note = "  (suspicious — review)";
    }
    console.log(`    ${row.event_type.padEnd(20)} = ${row.c}${note}`);
  }
}

async function showBotControlState() {
  const r = await query(
    `SELECT paper_trading, killed, paused, leverage, risk_pct, max_daily_loss_pct,
            kill_switch_enabled, kill_switch_drawdown_pct, cooldown_minutes, pause_after_losses,
            consecutive_losses, last_trade_time, updated_by, updated_at,
            last_live_halt_reason, last_live_halt_phase, last_live_halt_count,
            last_live_halt_first_seen_at, last_live_halt_last_seen_at,
            kraken_perm_check_at, kraken_perm_check_ok, kraken_perm_check_reason
     FROM bot_control
     WHERE id = 1`
  );
  const bc = r.rows[0];
  header("bot_control state (row #1)");
  if (!bc) {
    console.log("  WARNING: bot_control row #1 missing.");
    return;
  }
  console.log(`  paper_trading=${bc.paper_trading}  killed=${bc.killed}  paused=${bc.paused}`);
  console.log(`  leverage=${bc.leverage}  risk_pct=${bc.risk_pct}  max_daily_loss_pct=${bc.max_daily_loss_pct}`);
  console.log(`  kill_switch_enabled=${bc.kill_switch_enabled}  drawdown_threshold=${bc.kill_switch_drawdown_pct}%`);
  console.log(`  cooldown_minutes=${bc.cooldown_minutes}  pause_after_losses=${bc.pause_after_losses}  consecutive_losses=${bc.consecutive_losses}`);
  console.log(`  last_trade_time=${isoOrString(bc.last_trade_time) || "(none)"}`);
  console.log(`  updated_by=${bc.updated_by || "(unknown)"}  updated_at=${isoOrString(bc.updated_at) || "?"}`);
  console.log(`  D-5.10.5.2 last_live_halt_reason: ${bc.last_live_halt_reason || "(none)"}`);
  if (bc.last_live_halt_reason) {
    console.log(`    phase=${bc.last_live_halt_phase}  streak_count=${bc.last_live_halt_count}`);
    console.log(`    first_seen=${isoOrString(bc.last_live_halt_first_seen_at)}`);
    console.log(`    last_seen=${isoOrString(bc.last_live_halt_last_seen_at)}`);
  }
  console.log(`  D-5.10.5.4 kraken_perm_check_ok: ${bc.kraken_perm_check_ok === null ? "(never run)" : bc.kraken_perm_check_ok}`);
  if (bc.kraken_perm_check_at) {
    console.log(`    last_checked=${isoOrString(bc.kraken_perm_check_at)}`);
    if (bc.kraken_perm_check_reason) {
      console.log(`    reason=${bc.kraken_perm_check_reason}`);
    }
  }
}

async function showD51055Verdict(paperOpenCount, paperOrphanCount) {
  header("D-5.10.5.5 cutover gate verdict");
  const gate8 = paperOpenCount > 0 ? "BLOCK" : "PASS";
  const gate9 = paperOrphanCount > 0 ? "BLOCK" : "PASS";
  console.log(`  Gate 8 paper-still-open:    ${gate8}  (count=${paperOpenCount})`);
  console.log(`  Gate 9 paper-orphans:       ${gate9}  (count=${paperOrphanCount})`);
  if (gate8 === "PASS" && gate9 === "PASS") {
    console.log(`  -> Paper-side gates clear.`);
    console.log(`     Live activation still requires D-5.10.6 + LIVE_TRADING_ARMED + sign-off.`);
  } else {
    console.log(`  -> Live activation refused at the cutover layer.`);
  }
}

function showRecommendedActions(paperOpenCount, paperOrphanCount, liveOpenCount, liveOrphanCount) {
  header("Recommended next actions");
  if (paperOpenCount > 0) {
    console.log(`  - ${paperOpenCount} paper position${paperOpenCount === 1 ? "" : "s"} open.`);
    console.log(`    Will close naturally on TP/SL/operator close (use /paper dashboard for manual close).`);
  }
  if (paperOrphanCount > 0) {
    console.log(`  - ${paperOrphanCount} paper orphan${paperOrphanCount === 1 ? "" : "s"} block live activation (D-5.10.5.5 Gate 9).`);
    console.log(`    Cleanup tool not yet implemented (D-5.10.5.6.2 deferred).`);
    console.log(`    Manual SQL is currently the only path. Each row should be reviewed individually before any UPDATE.`);
  }
  if (liveOpenCount > 0) {
    console.log(`  - WARNING: ${liveOpenCount} live position${liveOpenCount === 1 ? "" : "s"} present in DB.`);
    console.log(`    Live mode has not been activated; investigate immediately.`);
  }
  if (liveOrphanCount > 0) {
    console.log(`  - WARNING: ${liveOrphanCount} live orphan${liveOrphanCount === 1 ? "" : "s"} present in DB.`);
    console.log(`    Investigate before any future live activation.`);
  }
  if (paperOpenCount === 0 && paperOrphanCount === 0 && liveOpenCount === 0 && liveOrphanCount === 0) {
    console.log(`  - DB state is clean. Live activation still requires:`);
    console.log(`      1. D-5.10.6 final activation gate (NOT IMPLEMENTED)`);
    console.log(`      2. LIVE_TRADING_ARMED env var set`);
    console.log(`      3. paperTrading=false`);
    console.log(`      4. LC-1 §10.4 operator sign-off`);
    console.log(`      5. All other LC-1 checklist items resolved`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set — cannot inspect.");
    console.error("Hint: prefix with DATABASE_URL=$(railway variables ...) or set the variable in your shell.");
    process.exit(1);
  }

  console.log("=== Agent Avila — Recovery Inspector (D-5.10.5.6.1) ===");
  console.log(`Generated at: ${new Date().toISOString()}`);
  console.log("Read-only diagnostic. No mutations. No Kraken calls.");
  console.log("");

  await showSchemaVersion();

  // Position-state passes
  await showOpenPositions("paper");
  await showOrphanedPositions("paper");
  await showOpenPositions("live");
  await showOrphanedPositions("live");

  // Trade-event integrity passes
  await showLiveTradeEventsCount();
  header("trade_events with NULL position_id (informational)");
  await showNullFkTradeEvents("paper");
  await showNullFkTradeEvents("live");

  // Control + gate state
  await showBotControlState();

  // Gate verdict
  const paperOpenCount   = await countOpenPositions("paper");
  const paperOrphanCount = await countOrphanedPositions("paper");
  const liveOpenCount    = await countOpenPositions("live");
  const liveOrphanCount  = await countOrphanedPositions("live");
  await showD51055Verdict(paperOpenCount, paperOrphanCount);

  // Recommendations
  showRecommendedActions(paperOpenCount, paperOrphanCount, liveOpenCount, liveOrphanCount);

  console.log("\n(end of inspector report)");
  await dbClose();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\nERROR: " + err.message);
  console.error(err.stack);
  try { await dbClose(); } catch {}
  process.exit(1);
});
