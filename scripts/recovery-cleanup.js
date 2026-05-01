// Phase D-5.10.5.6.2 — recovery cleanup tool (paper-orphans only).
//
// Operator-driven CLI cleanup tool. Marks paper-mode 'orphaned' positions
// as 'closed' so they no longer block the D-5.10.5.5 cutover gate (Gate 9).
// Each row requires interactive per-row confirmation. Live rows are
// categorically rejected at the SQL layer (WHERE mode='paper').
//
// SAFETY CONTRACT
// ---------------
//  1. Paper orphans only. Live cases are categorically rejected.
//  2. Real cleanup requires:
//       --case paper-orphans
//       --operator "<name>"
//       --confirm "I have reviewed and accept responsibility"
//       interactive TTY
//       per-row operator-name match (no bulk approve, no --yes-to-all)
//  3. Dry-run is read-only: no DB writes, no audit-log writes.
//  4. SQL UPDATE is guarded:
//       WHERE id = $1 AND mode = 'paper' AND status = 'orphaned'
//     (id, mode='paper', and status='orphaned' all required — three guards.)
//  5. No INSERT, DELETE, UPSERT, or schema changes.
//  6. No Kraken API calls of any kind.
//  7. No bot_control mutation.
//  8. No env-var writes.
//  9. No position open/close beyond the orphaned→closed status flip.
// 10. The bot.js source code does not import this script.
// 11. The dashboard.js source code does not import this script.
// 12. No live activation, no Strategy V2 toggle.
//
// USAGE
// -----
//   DATABASE_URL=$PGURL node scripts/recovery-cleanup.js \
//     --case paper-orphans \
//     --operator "<name>" \
//     --confirm "I have reviewed and accept responsibility" \
//     [--dry-run] \
//     [--reason "<optional reason>"]
//
// EXIT CODES
// ----------
//   0  success (dry-run completed, or real cleanup completed)
//   1  refused at preflight or post-connection guard (no DB writes performed)
//   2  aborted mid-run by operator (some rows may have been updated; see audit log)
//   3  uncaught error

import "dotenv/config";
import readline from "node:readline";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  query,
  schemaVersion as dbSchemaVersion,
  countOrphanedPositions,
  close as dbClose,
} from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = resolve(__dirname, "..");
const AUDIT_LOG_PATH = resolve(REPO_ROOT, "docs/live-readiness/RECOVERY_AUDIT_LOG.md");

const REQUIRED_CONFIRM   = "I have reviewed and accept responsibility";
const ALLOWED_CASES      = new Set(["paper-orphans"]);
const SCHEMA_VERSION_MIN = 5;
const TOOL_TAG           = "d-5.10.5.6.2";
// Operator: 1-64 chars, letters/digits/space/._@()+- only. Rejects newlines,
// control chars, quotes, semicolons, backticks, and other markdown / shell
// metacharacters that would break the audit log or hint at injection.
const OPERATOR_REGEX     = /^[A-Za-z0-9 ._@()+\-]{1,64}$/;
const REASON_MAX_LEN     = 200;

// ─── Arg parsing ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {
    case: null,
    operator: null,
    confirm: null,
    dryRun: false,
    reason: null,
    help: false,
    unknown: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--case")          out.case     = argv[++i] ?? null;
    else if (a === "--operator") out.operator = argv[++i] ?? null;
    else if (a === "--confirm")  out.confirm  = argv[++i] ?? null;
    else if (a === "--reason")   out.reason   = argv[++i] ?? null;
    else if (a === "--dry-run")  out.dryRun   = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else out.unknown.push(a);
  }
  return out;
}

function printUsage() {
  console.log(
`Agent Avila — Recovery Cleanup Tool (D-5.10.5.6.2)

USAGE:
  DATABASE_URL=... node scripts/recovery-cleanup.js \\
    --case paper-orphans \\
    --operator "<name>" \\
    --confirm "${REQUIRED_CONFIRM}" \\
    [--dry-run] \\
    [--reason "<optional reason>"]

Notes:
  * Real cleanup requires an interactive TTY and per-row confirmation.
  * Dry-run is read-only; it never writes to the DB or to the audit log.
  * Only paper orphans (mode='paper' AND status='orphaned') are eligible.
  * Live rows are categorically rejected. There is no live case in v1.
  * No --yes-to-all, no --force, no bulk approve.

Refusal conditions (preflight, before any DB connection):
  * DATABASE_URL not set
  * --case missing or not one of: ${[...ALLOWED_CASES].join(", ")}
  * any --case beginning with "live" / "live-"
  * --operator missing or fails the safe-name regex
  * --confirm missing or does not match the required phrase verbatim
  * --reason longer than ${REASON_MAX_LEN} chars or contains control chars
  * real cleanup invoked from a non-TTY context (CI, cron, pipe)

Refusal conditions (post-connection):
  * schema version < ${SCHEMA_VERSION_MIN}
  * bot_control.killed = false (bot is not halted) — real cleanup only
  * zero paper orphans found (nothing to clean)
`
  );
}

// ─── Preflight checks ───────────────────────────────────────────────────────
function preflightErrors(args) {
  const errs = [];

  if (!process.env.DATABASE_URL) errs.push("DATABASE_URL not set.");

  if (!args.case) {
    errs.push("--case is required.");
  } else if (/^live[-_]?/i.test(args.case)) {
    errs.push(`Live cases are not supported by this tool (D-5.10.5.6.2 is paper-orphans only). Refusing --case "${args.case}".`);
  } else if (!ALLOWED_CASES.has(args.case)) {
    errs.push(`--case "${args.case}" is not supported. Allowed: ${[...ALLOWED_CASES].join(", ")}.`);
  }

  if (args.operator == null || args.operator === "") {
    errs.push("--operator is required.");
  } else if (!OPERATOR_REGEX.test(args.operator)) {
    errs.push(`--operator "${args.operator}" contains invalid characters or exceeds 64 chars. Allowed: letters, digits, spaces, and ._@()+-`);
  }

  if (args.confirm == null) {
    errs.push("--confirm is required.");
  } else if (args.confirm !== REQUIRED_CONFIRM) {
    errs.push(`--confirm phrase did not match. Required (verbatim): "${REQUIRED_CONFIRM}"`);
  }

  if (args.reason != null) {
    if (args.reason.length > REASON_MAX_LEN) {
      errs.push(`--reason exceeds ${REASON_MAX_LEN} chars.`);
    }
    // Reject ASCII control chars (incl. CR, LF, TAB) and DEL.
    if (/[\u0000-\u001f\u007f]/.test(args.reason)) {
      errs.push("--reason contains control characters or newlines.");
    }
  }

  if (args.unknown.length > 0) {
    errs.push(`Unknown arguments: ${args.unknown.map(s => JSON.stringify(s)).join(", ")}`);
  }

  return errs;
}

function isCiOrCronContext() {
  return Boolean(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE ||
    process.env.CIRCLECI ||
    process.env.CRON_JOB_ID ||
    process.env.CRON_DRIVER ||
    process.env.AGENT_AVILA_NONINTERACTIVE
  );
}

// ─── DB helpers ─────────────────────────────────────────────────────────────
async function selectPaperOrphans() {
  const r = await query(
    `SELECT id, kraken_order_id, side, leverage, entry_price, quantity,
            entry_time, exit_time, exit_reason,
            realized_pnl_usd, realized_pnl_pct, metadata
       FROM positions
      WHERE mode = 'paper' AND status = 'orphaned'
      ORDER BY entry_time ASC, id ASC`
  );
  return r.rows;
}

async function readBotControlKilled() {
  const r = await query(
    `SELECT killed, paper_trading FROM bot_control WHERE id = 1`
  );
  return r.rows[0] || null;
}

// Three-guard UPDATE. WHERE mode='paper' is the linchpin that makes it
// physically impossible for this statement to touch a live row even if
// the operator somehow supplied a live id.
const PAPER_ORPHAN_UPDATE_SQL = `
  UPDATE positions
     SET status = 'closed',
         metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{cleanup}',
           jsonb_build_object(
             'at', to_jsonb(NOW()),
             'by', to_jsonb($2::text),
             'tool', to_jsonb($5::text),
             'case', to_jsonb('paper-orphans'::text),
             'previous_status', to_jsonb('orphaned'::text),
             'reason', to_jsonb($3::text),
             'schema_version_at_cleanup', to_jsonb($4::int)
           ),
           true
         ),
         updated_at = NOW()
   WHERE id = $1 AND mode = 'paper' AND status = 'orphaned'
   RETURNING id, mode, status, kraken_order_id,
             metadata->'cleanup' AS cleanup_meta,
             updated_at
`;

async function updatePaperOrphan(id, operator, reason, schemaVer) {
  const r = await query(PAPER_ORPHAN_UPDATE_SQL, [
    id,
    operator,
    reason ?? null,
    schemaVer,
    TOOL_TAG,
  ]);
  return r.rows[0] || null;
}

// ─── Audit log ──────────────────────────────────────────────────────────────
async function ensureAuditLogHeader() {
  try {
    await fs.access(AUDIT_LOG_PATH);
    return;
  } catch {
    // not present — create it
  }
  const header =
`# Recovery Audit Log

This file is append-only. Each entry records a real (non-dry-run) cleanup
action performed by \`scripts/recovery-cleanup.js\` (Phase D-5.10.5.6.2).
Dry-run invocations never append to this file.

`;
  await fs.writeFile(AUDIT_LOG_PATH, header, { encoding: "utf8", flag: "wx" });
}

function formatAuditEntry({
  startedAt, completedAt, operator, reason, dryRun, schemaVer,
  caseName, processed, skipped,
}) {
  const lines = [];
  lines.push(`---`);
  lines.push(``);
  lines.push(`## ${completedAt} — ${caseName}`);
  lines.push(``);
  lines.push(`- operator: ${operator}`);
  lines.push(`- tool: ${TOOL_TAG}`);
  lines.push(`- case: ${caseName}`);
  lines.push(`- reason: ${reason ? reason : "(none provided)"}`);
  lines.push(`- dry_run: ${dryRun}`);
  lines.push(`- schema_version_at_cleanup: ${schemaVer}`);
  lines.push(`- run_started_at: ${startedAt}`);
  lines.push(`- run_completed_at: ${completedAt}`);
  if (processed.length === 0) {
    lines.push(`- rows_processed: (none)`);
  } else {
    lines.push(`- rows_processed:`);
    for (const p of processed) {
      lines.push(`  - id=${p.id}  kraken=${p.kraken_order_id || "(none)"}  status_before=orphaned  status_after=${p.status_after}`);
    }
  }
  if (skipped.length > 0) {
    lines.push(`- rows_skipped:`);
    for (const s of skipped) {
      lines.push(`  - id=${s.id}  kraken=${s.kraken_order_id || "(none)"}  reason=${s.reason}`);
    }
  }
  lines.push(``);
  return lines.join("\n");
}

async function appendAuditEntry(entry) {
  await fs.appendFile(AUDIT_LOG_PATH, entry, { encoding: "utf8" });
}

// ─── Readline prompt ────────────────────────────────────────────────────────
function makePromptInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  rl.on("SIGINT", () => { rl.close(); });
  return rl;
}

function ask(rl, prompt) {
  return new Promise((resolveAns) => {
    let done = false;
    const onClose = () => {
      if (done) return;
      done = true;
      resolveAns(null); // EOF / SIGINT
    };
    rl.once("close", onClose);
    rl.question(prompt, (answer) => {
      if (done) return;
      done = true;
      rl.removeListener("close", onClose);
      resolveAns(answer);
    });
  });
}

// ─── Format helpers ─────────────────────────────────────────────────────────
function isoOrString(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}
function fmtUSD(v, dp = 2) {
  if (v == null) return "?";
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return "?";
  return (n >= 0 ? "+" : "-") + "$" + Math.abs(n).toFixed(dp);
}

function describeRow(row) {
  const pnl = row.realized_pnl_usd != null ? fmtUSD(row.realized_pnl_usd, 2) : "?";
  const pnlPct = row.realized_pnl_pct != null ? parseFloat(row.realized_pnl_pct).toFixed(2) + "%" : "?";
  const lines = [];
  lines.push(`  id=${row.id}  kraken=${row.kraken_order_id || "(none)"}  side=${row.side}  lev=${row.leverage}x`);
  lines.push(`  entry=${row.entry_price}  qty=${row.quantity}  exit_reason=${row.exit_reason || "(none)"}  pnl=${pnl} (${pnlPct})`);
  if (row.entry_time) lines.push(`  opened ${isoOrString(row.entry_time)}`);
  if (row.exit_time)  lines.push(`  exit   ${isoOrString(row.exit_time)}`);
  return lines.join("\n");
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  // Preflight (no DB connection yet)
  const preErrors = preflightErrors(args);
  if (preErrors.length > 0) {
    console.error("REFUSED — preflight checks failed:");
    for (const e of preErrors) console.error(`  - ${e}`);
    console.error("");
    console.error("Run with --help to see usage.");
    process.exit(1);
  }

  // TTY / CI guard. Dry-run is allowed non-interactively; real cleanup is not.
  const stdinIsTty = Boolean(process.stdin.isTTY);
  const inCi = isCiOrCronContext();
  if (!args.dryRun) {
    if (!stdinIsTty) {
      console.error("REFUSED — real cleanup requires an interactive TTY.");
      console.error("  process.stdin.isTTY is false (piped input, redirect, or background context).");
      console.error("  Re-run from an interactive terminal, or pass --dry-run to inspect without writing.");
      process.exit(1);
    }
    if (inCi) {
      console.error("REFUSED — real cleanup is not permitted from CI / cron context.");
      console.error("  Detected one of: CI, GITHUB_ACTIONS, GITLAB_CI, JENKINS_URL, BUILDKITE,");
      console.error("  CIRCLECI, CRON_JOB_ID, CRON_DRIVER, AGENT_AVILA_NONINTERACTIVE.");
      process.exit(1);
    }
  }

  console.log("=== Agent Avila — Recovery Cleanup Tool (D-5.10.5.6.2) ===");
  console.log(`Started at:     ${new Date().toISOString()}`);
  console.log(`Mode:           ${args.dryRun ? "DRY-RUN (read-only)" : "REAL CLEANUP"}`);
  console.log(`Case:           ${args.case}`);
  console.log(`Operator:       ${args.operator}`);
  console.log(`Reason:         ${args.reason || "(none provided)"}`);
  console.log(`Confirm phrase: matched`);
  console.log("");

  // Post-connection guards
  const sv = await dbSchemaVersion();
  if (!sv) {
    console.error("REFUSED — schema_migrations table missing or unreadable.");
    await dbClose();
    process.exit(1);
  }
  if (sv.version < SCHEMA_VERSION_MIN) {
    console.error(`REFUSED — schema version ${sv.version} < required ${SCHEMA_VERSION_MIN}. Run migrations first.`);
    await dbClose();
    process.exit(1);
  }
  console.log(`schema version: ${sv.version} (${sv.name})`);

  const bc = await readBotControlKilled();
  if (!bc) {
    console.error("REFUSED — bot_control row #1 not found.");
    await dbClose();
    process.exit(1);
  }
  console.log(`bot_control:    paper_trading=${bc.paper_trading}  killed=${bc.killed}`);
  if (!args.dryRun && bc.killed === false) {
    console.error("REFUSED — bot_control.killed is false (bot is not halted).");
    console.error("  Real cleanup requires the bot to be halted to avoid races with the live cron.");
    console.error("  Set bot_control.killed=true (or pause the deploy) and re-run.");
    await dbClose();
    process.exit(1);
  }

  // Load candidates
  const orphanCount = await countOrphanedPositions("paper");
  const rows = await selectPaperOrphans();
  if (rows.length === 0) {
    console.log("");
    console.log(`No paper orphans found (count=${orphanCount}). Nothing to do.`);
    await dbClose();
    process.exit(0);
  }
  console.log(`paper orphans:  ${rows.length} candidate row${rows.length === 1 ? "" : "s"} loaded.`);
  console.log("");

  if (args.dryRun) {
    console.log("DRY-RUN — listing candidate rows. No DB writes. No audit-log writes.");
    console.log("");
    rows.forEach((row, idx) => {
      console.log(`[${idx + 1}/${rows.length}] paper orphan candidate:`);
      console.log(describeRow(row));
      console.log(`  WOULD UPDATE id=${row.id}  status: orphaned -> closed`);
      console.log(`  WOULD ADD metadata.cleanup = { tool: ${TOOL_TAG}, case: paper-orphans, by: ${args.operator}, ... }`);
      console.log("");
    });
    console.log("(end of dry-run; no changes applied)");
    await dbClose();
    process.exit(0);
  }

  // Real cleanup — interactive
  const startedAt = new Date().toISOString();
  const processed = [];
  const skipped = [];
  let aborted = false;

  const rl = makePromptInterface();
  console.log("REAL CLEANUP — per-row confirmation required.");
  console.log(`For each row, type your operator name verbatim ("${args.operator}") to apply,`);
  console.log(`type "skip" to skip, or "abort" to stop the run.`);
  console.log(`A typo or any other input is treated as a skip for that row.`);
  console.log("");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.log(`[${i + 1}/${rows.length}] paper orphan candidate:`);
    console.log(describeRow(row));
    const answer = await ask(rl, `  Confirm cleanup of id=${row.id}? `);
    if (answer === null) {
      // EOF / SIGINT — treat as abort
      console.log("  (input closed) -> aborting run.");
      skipped.push({ id: row.id, kraken_order_id: row.kraken_order_id, reason: "input_closed" });
      aborted = true;
      break;
    }
    const trimmed = answer.trim();
    if (trimmed === "abort") {
      console.log("  -> abort requested. Stopping run.");
      skipped.push({ id: row.id, kraken_order_id: row.kraken_order_id, reason: "operator_abort" });
      aborted = true;
      break;
    }
    if (trimmed === "skip") {
      console.log("  -> skipped.");
      skipped.push({ id: row.id, kraken_order_id: row.kraken_order_id, reason: "operator_skipped" });
      continue;
    }
    if (trimmed !== args.operator) {
      console.log(`  -> input did not match operator name verbatim. Treating as skip.`);
      skipped.push({ id: row.id, kraken_order_id: row.kraken_order_id, reason: "name_mismatch" });
      continue;
    }
    // Match — perform UPDATE
    let updated;
    try {
      updated = await updatePaperOrphan(row.id, args.operator, args.reason, sv.version);
    } catch (err) {
      console.error(`  -> UPDATE failed for id=${row.id}: ${err.message}`);
      skipped.push({ id: row.id, kraken_order_id: row.kraken_order_id, reason: `update_error:${err.code || "unknown"}` });
      continue;
    }
    if (!updated) {
      // RETURNING came back empty — row no longer matched the WHERE guard (race or already cleaned)
      console.log(`  -> no row updated (id=${row.id} no longer matches paper+orphaned). Skipped.`);
      skipped.push({ id: row.id, kraken_order_id: row.kraken_order_id, reason: "guard_no_match" });
      continue;
    }
    if (updated.mode !== "paper") {
      // Defense-in-depth: this should be impossible because the WHERE clause requires mode='paper'.
      console.error(`  -> SAFETY ALARM: UPDATE returned mode=${updated.mode} (expected 'paper'). Aborting run.`);
      skipped.push({ id: row.id, kraken_order_id: row.kraken_order_id, reason: "safety_alarm_non_paper" });
      aborted = true;
      break;
    }
    console.log(`  -> id=${updated.id} status: orphaned -> ${updated.status}  (cleanup metadata recorded)`);
    processed.push({
      id: updated.id,
      kraken_order_id: updated.kraken_order_id,
      status_after: updated.status,
    });
  }

  rl.close();

  const completedAt = new Date().toISOString();

  // Audit log — only on real cleanup, only if at least one row was processed
  // OR if rows were skipped/aborted (we want a record of the run either way,
  // since real cleanup was attempted). Dry-run never writes the audit log.
  if (processed.length > 0 || skipped.length > 0) {
    try {
      await ensureAuditLogHeader();
      const entry = formatAuditEntry({
        startedAt,
        completedAt,
        operator: args.operator,
        reason: args.reason,
        dryRun: false,
        schemaVer: sv.version,
        caseName: args.case,
        processed,
        skipped,
      });
      await appendAuditEntry(entry);
      console.log("");
      console.log(`audit log:      appended to ${AUDIT_LOG_PATH}`);
    } catch (err) {
      console.error(`WARNING: failed to write audit log: ${err.message}`);
      console.error("  DB updates (if any) are persisted. Please record the run manually.");
    }
  }

  console.log("");
  console.log(`SUMMARY: processed=${processed.length}  skipped=${skipped.length}  aborted=${aborted}`);
  await dbClose();
  process.exit(aborted ? 2 : 0);
}

main().catch(async (err) => {
  console.error("\nERROR: " + (err && err.message ? err.message : String(err)));
  if (err && err.stack) console.error(err.stack);
  try { await dbClose(); } catch {}
  process.exit(3);
});
