// Phase D-5.4 — forward-only migration runner.
//
// Reads migrations/*.sql in version order, applies un-applied ones in
// transactions, records each in schema_migrations with SHA-256 checksum.
//
// Idempotent: re-runs are no-ops once everything is applied.
// Safety  : applied migrations are immutable. If a file's checksum differs
//           from what's recorded, the runner aborts with a clear error so an
//           accidental edit to an applied migration can't silently drift.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/run-migrations.js
//   npm run migrate
//   railway run npm run migrate            (against the prod Postgres)
//
// Exit codes:
//   0 — success (or nothing to do)
//   1 — fatal error (connection, etc)
//   2 — DATABASE_URL missing or migrations/ directory missing
//   3 — checksum mismatch on an already-applied migration
//   4 — a migration SQL statement failed

import "dotenv/config";
import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import pg from "pg";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL || null;

if (!DATABASE_URL) {
  console.error("[migrate] DATABASE_URL not set — migrations cannot run.");
  console.error("[migrate] If running locally, export DATABASE_URL=<your postgres url>.");
  console.error("[migrate] If running in Railway, ensure the Postgres add-on is linked");
  console.error("[migrate]   and the service variable references ${{Postgres.DATABASE_URL}}.");
  process.exit(2);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

if (!existsSync(MIGRATIONS_DIR)) {
  console.error(`[migrate] migrations directory missing: ${MIGRATIONS_DIR}`);
  process.exit(2);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => /^\d+_.+\.sql$/.test(f))
  .sort(); // string-sorted; zero-padded version prefixes keep order correct

if (!files.length) {
  console.log("[migrate] no migration files found in", MIGRATIONS_DIR);
  process.exit(0);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function parseFile(name) {
  const m = name.match(/^(\d+)_(.+)\.sql$/);
  if (!m) return null;
  return { version: parseInt(m[1], 10), name: m[2] };
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function ensureMigrationsTable(client) {
  // Bootstrap: the very first time the runner sees a fresh DB, the
  // schema_migrations table doesn't exist yet, so we cannot SELECT against
  // it. CREATE IF NOT EXISTS bootstraps it before we read.
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum   TEXT NOT NULL
    )
  `);
}

async function getApplied(client) {
  const r = await client.query("SELECT version, name, checksum FROM schema_migrations");
  const map = new Map();
  for (const row of r.rows) map.set(row.version, row);
  return map;
}

async function main() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);

    const toApply = [];
    for (const f of files) {
      const meta = parseFile(f);
      if (!meta) continue;
      const body = readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
      const checksum = sha256(body);
      const prev = applied.get(meta.version);
      if (prev) {
        if (prev.checksum !== checksum) {
          console.error(`[migrate] CHECKSUM MISMATCH on already-applied migration ${meta.version} (${meta.name})`);
          console.error(`[migrate]   applied: ${prev.checksum.slice(0, 16)}...`);
          console.error(`[migrate]   file:    ${checksum.slice(0, 16)}...`);
          console.error(`[migrate] Applied migrations are immutable. Revert the edit and create`);
          console.error(`[migrate] a new migration file (e.g. 002_*.sql) instead.`);
          process.exit(3);
        }
        continue; // already applied, checksum matches — skip
      }
      toApply.push({ ...meta, body, checksum, file: f });
    }

    if (!toApply.length) {
      console.log(`[migrate] all migrations applied (${files.length} on disk, ${applied.size} in DB, nothing to do)`);
      return;
    }

    for (const m of toApply) {
      const stamp = String(m.version).padStart(3, "0");
      console.log(`[migrate] applying ${stamp}_${m.name}.sql ...`);
      try {
        await client.query("BEGIN");
        await client.query(m.body);
        await client.query(
          "INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)",
          [m.version, m.name, m.checksum]
        );
        await client.query("COMMIT");
        console.log(`[migrate]   ✓ applied version ${m.version}`);
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        console.error(`[migrate]   ✗ FAILED at version ${m.version}: ${e.message}`);
        process.exit(4);
      }
    }
    console.log(`[migrate] done — ${toApply.length} migration(s) applied`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[migrate] fatal:", e.message);
  process.exit(1);
});
