// Phase D-5.7.3 — historical paper trade import.
//
// One-shot, idempotent, transactional. Reads safety-check-log.json /
// position.json / trades.csv from a source directory and seeds the existing
// trade_events + positions tables with the historical paper trade lifecycle
// events that were never persisted to Postgres before D-5.7 shipped.
//
// Usage:
//   DATABASE_URL=$DATABASE_PUBLIC_URL node scripts/import-trade-history.js --dry-run
//   DATABASE_URL=$DATABASE_PUBLIC_URL node scripts/import-trade-history.js
//   node scripts/import-trade-history.js --source ~/local-snapshot --dry-run
//
// Exit codes:
//   0 — success
//   1 — fatal/unhandled error
//   2 — config error (DATABASE_URL missing, source missing, bad flag)
//   4 — SQL execution failure (transaction auto-rolled-back)
// 130 — SIGINT (transaction auto-rolled-back)
//
// Source files are read-only; this script never writes to local disk.
// Production runtime files (bot.js, dashboard.js, db.js, migrations/*) are
// not modified by this script — it only consumes existing db.js exports.

import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  query,
  inTransaction,
  dbAvailable,
  close as dbClose,
  buildEventId,
  insertTradeEvent,
  upsertPositionOpen,
  closePosition,
} from "../db.js";

// Suppress "query" unused import warning at runtime — it's exported by db.js
// and may be useful for future extensions of this script.
void query;

// ─── CLI parsing ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { dryRun: false, source: null, mode: "paper", help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run")            args.dryRun = true;
    else if (a === "--source")        args.source = argv[++i];
    else if (a === "--mode")          args.mode = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else { console.error("[import] unknown arg:", a); process.exit(2); }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/import-trade-history.js [options]

Imports paper trade lifecycle events from local JSON/CSV into Postgres.
The trade_events and positions tables (created in migration 002) are
seeded with deterministic event_ids so re-runs are no-ops.

Options:
  --dry-run            Run all queries but ROLLBACK at the end (preview)
  --source <dir>       Directory containing source files (default: cwd)
  --mode paper|live    Which mode to import (default: paper; live not
                       supported in D-5.7.3 — operator must opt in later)
  --help, -h           Show this message

Required environment:
  DATABASE_URL         Postgres connection string. Use DATABASE_PUBLIC_URL
                       form when running from outside the Railway network.

Source files (read-only; never modified):
  safety-check-log.json    REQUIRED — primary source of trade lifecycle
  position.json            REQUIRED — used to detect a still-open position
  trades.csv               OPTIONAL — used as a cross-check (not required)

Idempotency:
  trade_events.event_id is a deterministic UUID derived from
  (kraken_order_id, event_type) — re-runs over the same source produce the
  same UUIDs and ON CONFLICT (event_id) DO NOTHING skips them. positions
  similarly de-duped via the partial unique index on kraken_order_id.

Rollback (after a real run, if needed):
  DELETE FROM trade_events WHERE metadata->>'imported_from' = 'safety-check-log.json';
  DELETE FROM positions    WHERE metadata->>'imported_from' = 'safety-check-log.json';
`);
}

// ─── Source loading ─────────────────────────────────────────────────────────
function loadSources(sourceDir) {
  const logPath = path.join(sourceDir, "safety-check-log.json");
  const posPath = path.join(sourceDir, "position.json");
  const csvPath = path.join(sourceDir, "trades.csv");

  if (!existsSync(logPath)) {
    console.error(`[import] required source missing: ${logPath}`);
    process.exit(2);
  }
  let log;
  try { log = JSON.parse(readFileSync(logPath, "utf8")); }
  catch (e) {
    console.error(`[import] failed to parse ${logPath}: ${e.message}`);
    process.exit(2);
  }
  if (!Array.isArray(log.trades)) {
    console.error(`[import] ${logPath}: log.trades is not an array`);
    process.exit(2);
  }

  let position = { open: false };
  if (existsSync(posPath)) {
    try { position = JSON.parse(readFileSync(posPath, "utf8")); } catch {}
  }

  const csvExists = existsSync(csvPath);
  return { logTrades: log.trades, position, csvExists };
}

// ─── Event classifier ──────────────────────────────────────────────────────
// Mirrors D-5.7's runtime classification (shadowRecordBuy/Exit/FailedAttempt).
// Returns { eventType } or null when the entry is a non-lifecycle row
// (cycle, hold, blocked, score-skip, etc) that should be filtered out.
function classifyEvent(entry) {
  const isExit      = entry.type === "EXIT";
  const orderPlaced = entry.orderPlaced === true;
  const exitReason  = entry.exitReason || "";

  if (isExit) {
    if (orderPlaced) {
      if (exitReason === "MANUAL_CLOSE")    return { eventType: "manual_close" };
      if (exitReason === "REENTRY_SIGNAL")  return { eventType: "reentry_close" };
      return { eventType: "exit_filled" };
    }
    if (exitReason.endsWith("_FAILED_RETRY_PENDING")) {
      return { eventType: "exit_attempt" };
    }
    return null;
  }

  // Non-exit
  if (orderPlaced) {
    if (entry.type === "MANUAL_BUY")   return { eventType: "manual_buy" };
    if (entry.type === "BUY_REENTRY")  return { eventType: "reentry_buy" };
    if (entry.type === "BUY")          return { eventType: "buy_filled" };  // D-4-P-b explicit
    if (entry.allPass === true)        return { eventType: "buy_filled" };  // legacy pre-D-4-P-b
    return null;
  }

  // Failed live BUY attempt: signal passed but order didn't fill
  if (entry.error && entry.allPass === true) {
    return { eventType: "buy_attempt" };
  }

  return null;  // skip / hold / blocked / non-lifecycle
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  if (args.mode !== "paper") {
    console.error(`[import] --mode ${args.mode} not supported in D-5.7.3 strict (paper only)`);
    process.exit(2);
  }
  if (!dbAvailable()) {
    console.error("[import] DATABASE_URL not set; cannot import.");
    console.error("[import] export DATABASE_URL=<your postgres url> and re-run.");
    process.exit(2);
  }

  const sourceDir = args.source ? path.resolve(args.source) : process.cwd();
  const prefix = args.dryRun ? "[DRY-RUN]" : "[import]";

  console.log(`[import] source dir: ${sourceDir}`);
  console.log(`[import] mode:       ${args.mode}`);
  console.log(`[import] dry-run:    ${args.dryRun ? "YES (will ROLLBACK)" : "no (will COMMIT)"}`);
  console.log();

  const { logTrades, position, csvExists } = loadSources(sourceDir);
  console.log(`[import] loaded ${logTrades.length} entries from safety-check-log.json`);
  console.log(`[import] position.json: open=${position.open === true ? "true" : "false"}` +
              (position.orderId ? ` orderId=${position.orderId}` : ""));
  console.log(`[import] trades.csv: ${csvExists ? "found (informational only; not required)" : "absent (ok)"}`);
  console.log();

  // Filter to paper lifecycle events
  const lifecycle = [];
  for (let i = 0; i < logTrades.length; i++) {
    const t = logTrades[i];
    if (t.paperTrading !== true) continue;       // strict paper-only
    const c = classifyEvent(t);
    if (!c) continue;
    lifecycle.push({ entry: t, eventType: c.eventType, sourceIndex: i });
  }
  console.log(`[import] filtered to ${lifecycle.length} paper lifecycle events`);

  if (lifecycle.length === 0) {
    console.log("[import] nothing to import.");
    await dbClose();
    process.exit(0);
  }

  // Sort chronologically (ISO 8601 timestamps lex-sort correctly)
  lifecycle.sort((a, b) => a.entry.timestamp.localeCompare(b.entry.timestamp));

  const summary = {
    eventsInserted:    0,
    eventsSkipped:     0,
    positionsInserted: 0,
    positionsSkipped:  0,
    orphansFlagged:    0,
    realizedPnL:       0,
    byEventType:       {},
    orphanLog:         [],
  };

  const tracker = { paper: null, live: null };
  let dryRunRolledBack = false;

  try {
    await inTransaction(async (client) => {
      console.log(`${prefix} BEGIN`);

      for (const item of lifecycle) {
        const { entry, eventType, sourceIndex } = item;
        const mode = "paper";
        const orderId = entry.orderId || null;
        const seed = orderId
          ? orderId
          : `${entry.timestamp}:${entry.symbol || "XRPUSDT"}:${eventType}`;
        const eventId = buildEventId(seed, eventType);
        const importedMeta = {
          imported_from: "safety-check-log.json",
          imported_at:   new Date().toISOString(),
          source_index:  sourceIndex,
          original_type: entry.type ?? null,
          original_exit_reason: entry.exitReason ?? null,
        };

        const eventRow = {
          event_id:         eventId,
          timestamp:        entry.timestamp,
          mode,
          event_type:       eventType,
          symbol:           entry.symbol || "XRPUSDT",
          position_id:      null,                           // patched after position resolution
          price:            entry.price ?? null,
          quantity:         entry.quantity ?? null,
          usd_amount:       entry.tradeSize ?? null,
          pnl_usd:          entry.pnlUSD != null ? parseFloat(entry.pnlUSD) : null,
          pnl_pct:          entry.pct    != null ? parseFloat(entry.pct)    : null,
          signal_score:     entry.signalScore ?? null,
          signal_threshold: entry.perfState?.adaptedThreshold ?? null,
          regime:           entry.volatility?.regime ?? entry.volatility?.level ?? null,
          leverage:         entry.effectiveLeverage ?? entry.volatility?.leverage ?? null,
          kraken_order_id:  orderId,
          decision_log:     entry.decisionLog ?? null,
          error:            entry.error ?? null,
          metadata:         importedMeta,
        };

        // INSERT trade_event (idempotent via event_id UNIQUE)
        const insertResult = await insertTradeEvent(client, eventRow);
        const wasFreshInsert = insertResult.rows.length > 0;
        if (wasFreshInsert) {
          summary.eventsInserted++;
          summary.byEventType[eventType] = (summary.byEventType[eventType] || 0) + 1;
          console.log(`${prefix}   + event #${insertResult.rows[0].id} type=${eventType} ts=${entry.timestamp}`);
        } else {
          summary.eventsSkipped++;
          // Don't continue — still resolve position lifecycle so the tracker
          // stays consistent on re-runs (idempotent re-resolution of position
          // linkage is a no-op via existing partial unique constraints).
        }

        // ── Position lifecycle ─────────────────────────────────────────────
        if (eventType === "buy_filled" || eventType === "manual_buy" || eventType === "reentry_buy") {
          // Anomaly: BUY when prior position is still tracked open (no exit
          // between them in the source log). Orphan the prior to free the
          // partial unique slot, then proceed with the new BUY.
          if (tracker[mode] != null) {
            console.log(`${prefix}   ! orphaning prior position id=${tracker[mode].positionId} (REENTRY-gap)`);
            await client.query(
              `UPDATE positions SET status='orphaned', updated_at=NOW(),
                 metadata = metadata || $1::jsonb
               WHERE id=$2 AND status='open'`,
              [JSON.stringify({ orphan_reason: "IMPORT_ORPHAN_REENTRY_GAP" }), tracker[mode].positionId]
            );
            summary.orphansFlagged++;
            summary.orphanLog.push({ kind: "REENTRY_GAP", positionId: tracker[mode].positionId });
            tracker[mode] = null;
          }

          const tradeSize  = parseFloat(entry.tradeSize) || 0;
          const leverage   = entry.effectiveLeverage ?? entry.volatility?.leverage ?? 1;
          // Defensive defaults for legacy rows that didn't store SL/TP%.
          const slPct      = entry.volatility?.slPct ?? 1.25;
          const tpPct      = entry.volatility?.tpPct ?? 2.0;
          const stopLoss   = (entry.price || 0) * (1 - slPct / 100);
          const takeProfit = (entry.price || 0) * (1 + tpPct / 100);

          // Pre-check whether the position already exists (for accurate
          // inserted-vs-skipped accounting). Cost: one extra SELECT per BUY.
          let existsAlready = false;
          if (orderId) {
            const ex = await client.query(
              `SELECT id FROM positions WHERE kraken_order_id=$1 LIMIT 1`,
              [orderId]
            );
            existsAlready = ex.rows.length > 0;
          }

          const positionId = await upsertPositionOpen(client, {
            mode,
            symbol:               eventRow.symbol,
            side:                 "long",
            entry_price:          entry.price,
            entry_time:           entry.timestamp,
            entry_signal_score:   entry.signalScore ?? null,
            quantity:             entry.quantity ?? (tradeSize * leverage / (entry.price || 1)),
            trade_size_usd:       tradeSize,
            leverage,
            effective_size_usd:   tradeSize * leverage,
            stop_loss:            stopLoss,
            take_profit:          takeProfit,
            volatility_level:     entry.volatility?.level ?? null,
            kraken_order_id:      orderId,
            metadata:             importedMeta,
          });

          if (positionId == null) {
            console.log(`${prefix}   ! could not resolve position for orderId=${orderId}; skipping link`);
          } else {
            if (existsAlready) summary.positionsSkipped++;
            else               summary.positionsInserted++;
            await client.query(
              `UPDATE trade_events SET position_id=$1 WHERE event_id=$2`,
              [positionId, eventId]
            );
            tracker[mode] = { positionId, eventId, orderId };
            if (wasFreshInsert) console.log(`${prefix}     -> linked position id=${positionId}`);
          }
        }
        else if (eventType === "exit_filled" || eventType === "manual_close" || eventType === "reentry_close") {
          if (tracker[mode] == null) {
            // Class B orphan: EXIT without a tracked open position. The
            // trade_event keeps position_id=null; tag the metadata so the
            // operator can find these later.
            console.log(`${prefix}   ! orphan exit (no open position to close)`);
            await client.query(
              `UPDATE trade_events SET metadata = metadata || $1::jsonb WHERE event_id=$2`,
              [JSON.stringify({ orphan_reason: "no open position at exit time" }), eventId]
            );
            summary.orphansFlagged++;
            summary.orphanLog.push({ kind: "EXIT_WITHOUT_OPEN", eventId });
            continue;
          }

          const closedId = await closePosition(client, mode, {
            exit_price:            entry.price,
            exit_time:             entry.timestamp,
            exit_reason:           entry.exitReason ?? null,
            realized_pnl_usd:      entry.pnlUSD != null ? parseFloat(entry.pnlUSD) : null,
            realized_pnl_pct:      entry.pct    != null ? parseFloat(entry.pct)    : null,
            kraken_exit_order_id:  orderId,
          });

          if (closedId != null) {
            await client.query(
              `UPDATE trade_events SET position_id=$1 WHERE event_id=$2`,
              [closedId, eventId]
            );
            const pnl = entry.pnlUSD != null ? parseFloat(entry.pnlUSD) : 0;
            summary.realizedPnL += pnl;
            if (wasFreshInsert) {
              const sign = pnl >= 0 ? "+" : "-";
              console.log(`${prefix}     -> closed position id=${closedId} pnl=${sign}$${Math.abs(pnl).toFixed(2)}`);
            }
          } else if (wasFreshInsert) {
            // closePosition returned null — the open row was already closed
            // (e.g., re-run with prior-import linkage). Skip linkage update.
            console.log(`${prefix}     -> close found no open row (already closed)`);
          }
          tracker[mode] = null;
        }
        // buy_attempt / exit_attempt: no position transition; trade_event
        // already has position_id=null. Nothing more to do.
      }

      // End-of-walk reconciliation: trailing un-closed BUY?
      for (const m of ["paper"]) {
        if (tracker[m] == null) continue;
        const matchesPositionJson =
          position && position.open === true && position.orderId === tracker[m].orderId;
        if (matchesPositionJson) {
          console.log(`${prefix}   ✓ trailing position id=${tracker[m].positionId} matches position.json (kept as 'open')`);
        } else {
          console.log(`${prefix}   ! trailing position id=${tracker[m].positionId} has no matching exit (marking 'orphaned')`);
          await client.query(
            `UPDATE positions SET status='orphaned', updated_at=NOW(),
               metadata = metadata || $1::jsonb
             WHERE id=$2 AND status='open'`,
            [JSON.stringify({ orphan_reason: "no matching exit in source log" }), tracker[m].positionId]
          );
          summary.orphansFlagged++;
          summary.orphanLog.push({ kind: "TRAILING_NO_EXIT", positionId: tracker[m].positionId });
        }
      }

      if (args.dryRun) {
        // Force inTransaction to ROLLBACK by throwing a sentinel error.
        // We catch it below so the rollback isn't reported as a failure.
        throw new Error("__DRY_RUN_ROLLBACK_SENTINEL__");
      }

      console.log(`${prefix} COMMIT`);
    });
  } catch (e) {
    if (e.message === "__DRY_RUN_ROLLBACK_SENTINEL__") {
      dryRunRolledBack = true;
      console.log(`${prefix} ROLLBACK (dry-run sentinel — zero rows committed)`);
    } else {
      console.error(`[import] FAILED: ${e.message}`);
      console.error("[import] transaction rolled back; no changes committed.");
      try { await dbClose(); } catch {}
      process.exit(4);
    }
  }

  // Summary
  console.log();
  console.log(`${prefix} Summary:`);
  console.log(`${prefix}   trade_events ${dryRunRolledBack ? "would-insert" : "inserted"}: ${summary.eventsInserted} (skipped/duplicate: ${summary.eventsSkipped})`);
  if (Object.keys(summary.byEventType).length > 0) {
    console.log(`${prefix}     by event_type:`);
    for (const [k, v] of Object.entries(summary.byEventType)) {
      console.log(`${prefix}       ${k}: ${v}`);
    }
  }
  console.log(`${prefix}   positions ${dryRunRolledBack ? "would-insert" : "inserted"}: ${summary.positionsInserted} (skipped/duplicate: ${summary.positionsSkipped})`);
  console.log(`${prefix}   orphans flagged: ${summary.orphansFlagged}`);
  for (const o of summary.orphanLog) {
    console.log(`${prefix}     - ${JSON.stringify(o)}`);
  }
  const pnlSign = summary.realizedPnL >= 0 ? "+" : "-";
  console.log(`${prefix}   realized paper P&L (${dryRunRolledBack ? "would-import" : "imported"}): ${pnlSign}$${Math.abs(summary.realizedPnL).toFixed(2)}`);

  await dbClose();
  process.exit(0);
}

// SIGINT cleanup — transaction auto-rolls-back when the connection drops
process.on("SIGINT", async () => {
  console.error("\n[import] interrupted; transaction will roll back");
  try { await dbClose(); } catch {}
  process.exit(130);
});

main().catch(async (e) => {
  console.error("[import] fatal:", e.message);
  try { await dbClose(); } catch {}
  process.exit(1);
});
