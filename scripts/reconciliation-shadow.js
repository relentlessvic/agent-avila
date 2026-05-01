// Phase D-5.10.5.8.1 — operator-driven reconciliation shadow CLI.
//
// Reads a paper or live position from Postgres, builds a "venue" snapshot
// either from a canned mock fixture, from the DB itself (synthetic — used
// to validate the comparator wiring without touching Kraken), or — in a
// future phase — from a live Kraken read-only snapshot.
//
// In Phase 8.1, --from-kraken is intentionally REFUSED. The Kraken read
// integration lands in D-5.10.5.8.2 alongside the bot.js preflight wiring.
//
// SAFETY CONTRACT
// ---------------
// 1. Read-only by default. The only DB-mutating SQL in this file is one
//    guarded UPDATE (--persist path) that targets paper-mode rows only.
// 2. --persist is gated on schema version >= 6 AND on the operator passing
//    the explicit flag. In 8.1, do not run --persist (per directive).
// 3. No Kraken HTTP calls. --from-kraken is refused with a clear message
//    pointing to D-5.10.5.8.2.
// 4. No bot_control reads or writes. No Discord. No filesystem writes.
// 5. No imports from bot.js, manageActiveTrade, placeKrakenOrder,
//    signKraken, or any code path that places/cancels orders.
// 6. Refuses --from-kraken for paper-mode rows even after 8.2 lands
//    (paper rows must use --from-db or --mock).
// 7. Refuses --persist for live-mode rows (live persistence is gated to
//    8.2 once HALT enforcement is wired).
//
// USAGE
// -----
//   DATABASE_URL=$PGURL node scripts/reconciliation-shadow.js \
//     --mode <mock|from-db|from-kraken> \
//     [--mock-fixture <name>]      # required with --mode mock
//     [--position-id <id>]         # required with --mode from-db
//     [--persist]                  # operator-only; refused in 8.1
//
// EXIT CODES
// ----------
//   0 — comparator ran, verdict printed
//   1 — preflight refusal (missing/invalid args, mode mismatch, etc.)
//   2 — comparator threw (treated as bug; verdict not trustworthy)
//   3 — uncaught error

import "dotenv/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { reconcile } from "../lib/reconciliation.js";
import { FIXTURES, FROZEN_NOW } from "../lib/reconciliation-fixtures.js";
import {
  query,
  schemaVersion as dbSchemaVersion,
  close as dbClose,
} from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const MIN_SCHEMA_FOR_PERSIST = 6;
const PHASE_TAG = "d-5.10.5.8.1";

// ─── Arg parsing ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {
    mode: null, mockFixture: null, positionId: null,
    persist: false, help: false, unknown: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode")               out.mode = argv[++i] ?? null;
    else if (a === "--mock-fixture")  out.mockFixture = argv[++i] ?? null;
    else if (a === "--position-id")   out.positionId = argv[++i] ?? null;
    else if (a === "--persist")       out.persist = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else out.unknown.push(a);
  }
  return out;
}

function printUsage() {
  console.log(
`Agent Avila — Reconciliation Shadow CLI (D-5.10.5.8.1)

USAGE:
  DATABASE_URL=... node scripts/reconciliation-shadow.js \\
    --mode <mock|from-db|from-kraken> \\
    [--mock-fixture <name>]   # required with --mode mock
    [--position-id <id>]      # required with --mode from-db
    [--persist]               # refused in 8.1

Modes:
  mock         Replay a canned (db, venue) fixture from
               lib/reconciliation-fixtures.js. Operator names the fixture
               via --mock-fixture <name>.
  from-db      Read a position from Postgres and synthesize a "venue"
               snapshot from the DB row itself. Comparator runs and
               (modulo timestamp drift) returns OK trivially. Useful for
               wiring validation.
  from-kraken  REFUSED in 8.1. Live Kraken read integration lands in
               D-5.10.5.8.2.

Persistence:
  --persist    Writes last_reconciled_at, last_reconciled_verdict, and
               last_reconciliation_snapshot to the positions row.
               Gated on schema version >= ${MIN_SCHEMA_FOR_PERSIST}. Refused
               for live-mode rows. Do not use in 8.1.

Available mock fixtures:
${Object.keys(FIXTURES).map(k => `  - ${k}  (${FIXTURES[k].expected})`).join("\n")}
`
  );
}

// ─── Preflight refusals ─────────────────────────────────────────────────────
function preflightErrors(args) {
  const errs = [];
  if (!process.env.DATABASE_URL && (args.mode === "from-db" || args.persist)) {
    errs.push("DATABASE_URL not set (required for --mode from-db and --persist).");
  }
  if (!args.mode) {
    errs.push("--mode is required. Pick one of: mock, from-db, from-kraken.");
  } else if (!["mock", "from-db", "from-kraken"].includes(args.mode)) {
    errs.push(`--mode "${args.mode}" is not supported. Pick one of: mock, from-db, from-kraken.`);
  }
  if (args.mode === "mock") {
    if (!args.mockFixture) {
      errs.push("--mock-fixture <name> is required with --mode mock.");
    } else if (!Object.prototype.hasOwnProperty.call(FIXTURES, args.mockFixture)) {
      errs.push(`--mock-fixture "${args.mockFixture}" not found. Available: ${Object.keys(FIXTURES).join(", ")}`);
    }
  }
  if (args.mode === "from-db" && !args.positionId) {
    errs.push("--position-id <id> is required with --mode from-db.");
  }
  if (args.mode === "from-kraken") {
    errs.push("REFUSED — --mode from-kraken is intentionally not implemented in D-5.10.5.8.1. The live Kraken read integration lands in D-5.10.5.8.2 alongside the bot preflight wiring and HALT enforcement. Use --mode mock or --mode from-db in 8.1.");
  }
  if (args.unknown.length > 0) {
    errs.push(`Unknown arguments: ${args.unknown.map(s => JSON.stringify(s)).join(", ")}`);
  }
  return errs;
}

// ─── Mode handlers ──────────────────────────────────────────────────────────
function runMockMode(args) {
  const fixture = FIXTURES[args.mockFixture];
  console.log(`source:        mock fixture "${args.mockFixture}"`);
  console.log(`description:   ${fixture.description}`);
  console.log(`expected:      ${fixture.expected}`);
  // Use a frozen `now` so staleness checks are deterministic against fixture data.
  const verdict = reconcile(fixture.db, fixture.venue, { now: FROZEN_NOW });
  return { verdict, dbPosition: fixture.db, mode: fixture.db.mode };
}

async function loadDbPosition(positionId) {
  const r = await query(
    `SELECT id, mode, symbol, side, quantity, leverage,
            entry_price, stop_loss, take_profit,
            kraken_order_id, status,
            entry_time, updated_at, metadata
       FROM positions
      WHERE id = $1
      LIMIT 1`,
    [positionId]
  );
  return r.rows[0] || null;
}

function buildSyntheticVenueFromDb(dbPos) {
  if (!dbPos) {
    return { source: "db-synthetic", mode: null, fetchedAt: new Date().toISOString(),
             position: null, workingOrders: { stopLoss: null, takeProfit: null } };
  }
  const venueSide = dbPos.side === "long" ? "buy" : (dbPos.side === "short" ? "sell" : null);
  const qty = parseFloat(dbPos.quantity) || 0;
  const entry = parseFloat(dbPos.entry_price) || 0;
  return {
    source: "db-synthetic",
    mode: dbPos.mode,
    fetchedAt: new Date().toISOString(),
    position: dbPos.status === "open" ? {
      txid: dbPos.kraken_order_id,
      pair: dbPos.symbol,
      side: venueSide,
      volume: qty,
      volumeClosed: 0,
      cost: qty * entry,
      fee: 0,
      value: qty * entry,
      net: 0,
      leverage: parseInt(dbPos.leverage, 10) || null,
      terms: null,
      entryPrice: entry,
      linkedOrderTxids: dbPos.kraken_order_id ? [dbPos.kraken_order_id] : [],
    } : null,
    workingOrders: dbPos.status === "open" ? {
      stopLoss: dbPos.stop_loss != null ? {
        orderId: null,    // 8.3 will capture; null in 8.1
        pair: dbPos.symbol,
        ordertype: "stop-loss",
        price: parseFloat(dbPos.stop_loss),
        volume: qty,
      } : null,
      takeProfit: dbPos.take_profit != null ? {
        orderId: null,
        pair: dbPos.symbol,
        ordertype: "take-profit",
        price: parseFloat(dbPos.take_profit),
        volume: qty,
      } : null,
    } : { stopLoss: null, takeProfit: null },
  };
}

async function runFromDbMode(args) {
  const dbPos = await loadDbPosition(args.positionId);
  if (!dbPos) {
    console.error(`REFUSED — no position found with id=${args.positionId}.`);
    process.exit(1);
  }
  const venueSnapshot = buildSyntheticVenueFromDb(dbPos);
  console.log(`source:        db-synthetic (position id=${dbPos.id}, mode=${dbPos.mode}, status=${dbPos.status})`);
  // For from-db mode, freeze "now" to fetchedAt so the staleness check is OK.
  const verdict = reconcile(dbPos, venueSnapshot, { now: venueSnapshot.fetchedAt });
  return { verdict, dbPosition: dbPos, mode: dbPos.mode };
}

// ─── --persist (gated; not exercised in 8.1) ────────────────────────────────
async function maybePersist(args, mode, dbPosId, verdict, dbPosSnapshot, venueSnapshotForPersist) {
  if (!args.persist) return;
  // Refuse for live-mode rows in 8.1.
  if (mode !== "paper") {
    console.error("REFUSED — --persist is restricted to paper-mode rows in 8.1. Live persistence lands in 8.2.");
    process.exit(1);
  }
  // Verify migration 006 is applied; refuse otherwise.
  const sv = await dbSchemaVersion();
  if (!sv || (sv.version ?? 0) < MIN_SCHEMA_FOR_PERSIST) {
    console.error(`REFUSED — --persist requires schema version >= ${MIN_SCHEMA_FOR_PERSIST}. Current: ${sv ? sv.version : "(none)"}. Apply migration 006 first.`);
    process.exit(1);
  }
  if (!dbPosId) {
    console.error("REFUSED — --persist requires a real position id (not available in mock mode).");
    process.exit(1);
  }
  const snapshotJson = {
    db: dbPosSnapshot,
    venue: venueSnapshotForPersist,
    verdict,
    persistedBy: PHASE_TAG,
    persistedAt: new Date().toISOString(),
  };
  // Single guarded UPDATE. WHERE id=$1 AND mode='paper' is the safety
  // pin: even if the operator points at a live row by mistake, the row
  // filter prevents any live-mode write.
  const r = await query(
    `UPDATE positions
        SET last_reconciled_at        = NOW(),
            last_reconciled_verdict   = $2,
            last_reconciliation_snapshot = $3::jsonb
      WHERE id = $1 AND mode = 'paper'
      RETURNING id, mode, last_reconciled_verdict, last_reconciled_at`,
    [dbPosId, verdict.verdict, JSON.stringify(snapshotJson)]
  );
  if (r.rowCount === 0) {
    console.error(`REFUSED — no paper-mode row matched id=${dbPosId}. No write performed.`);
    process.exit(1);
  }
  console.log(`persisted:     id=${r.rows[0].id} verdict=${r.rows[0].last_reconciled_verdict} at=${r.rows[0].last_reconciled_at?.toISOString?.() ?? r.rows[0].last_reconciled_at}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printUsage(); process.exit(0); }

  const errs = preflightErrors(args);
  if (errs.length > 0) {
    console.error("REFUSED — preflight checks failed:");
    for (const e of errs) console.error(`  - ${e}`);
    console.error("\nRun with --help to see usage.");
    process.exit(1);
  }

  console.log("=== Agent Avila — Reconciliation Shadow CLI (D-5.10.5.8.1) ===");
  console.log("This CLI is operator-driven only. The bot does not call it.");
  console.log("HALT verdicts are NOT enforced in this phase. Live remains NO-GO.");
  console.log(`Started at:    ${new Date().toISOString()}`);
  console.log(`Mode:          ${args.mode}`);
  console.log("");

  let result;
  let venueSnapshotForPersist = null;
  try {
    if (args.mode === "mock") {
      result = runMockMode(args);
      venueSnapshotForPersist = FIXTURES[args.mockFixture].venue;
    } else if (args.mode === "from-db") {
      result = await runFromDbMode(args);
      venueSnapshotForPersist = buildSyntheticVenueFromDb(result.dbPosition);
    }
  } catch (err) {
    console.error("\nERROR (comparator threw): " + (err?.message ?? String(err)));
    if (err?.stack) console.error(err.stack);
    try { await dbClose(); } catch {}
    process.exit(2);
  }

  const { verdict, dbPosition, mode } = result;

  console.log("");
  console.log(`verdict:       ${verdict.verdict}`);
  console.log(`counts:        catastrophic=${verdict.catastrophicCount} halt=${verdict.haltCount} warn=${verdict.warnCount} ok=${verdict.okCount}`);
  console.log(`generatedAt:   ${verdict.generatedAt}`);
  console.log("");
  console.log("Per-field:");
  for (const f of verdict.fields) {
    const tag = f.severity.padEnd(13);
    console.log(`  ${tag} ${f.field.padEnd(20)} ${f.reasonCode.padEnd(20)} ${f.message}`);
  }

  // --persist path is gated and refused for live-mode rows in 8.1.
  // In 8.1 the operator is instructed not to run --persist; this branch
  // is a no-op when --persist is absent.
  await maybePersist(args, mode, dbPosition?.id ?? null, verdict, dbPosition, venueSnapshotForPersist);

  await dbClose();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\nERROR: " + (err?.message ?? String(err)));
  if (err?.stack) console.error(err.stack);
  try { await dbClose(); } catch {}
  process.exit(3);
});
