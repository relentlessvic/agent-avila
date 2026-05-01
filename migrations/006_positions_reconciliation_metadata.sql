-- Phase D-5.10.5.8.1 — additive metadata columns on `positions` to hold
-- the output of the field-level reconciliation comparator (D-5.10.5.8.x).
--
-- This migration is **inert at runtime in 8.1**: nothing in bot.js,
-- dashboard.js, or db.js reads or writes these columns yet. The columns
-- are populated only by the operator-driven shadow CLI
-- (scripts/reconciliation-shadow.js --persist) once the operator chooses
-- to record a reconciliation snapshot. Wiring into the bot's preflight
-- chain — and HALT enforcement — is deferred to D-5.10.5.8.2.
--
-- The runtime min-schema gate in bot.js (`schema_version < 5` at line
-- 1011) is intentionally NOT bumped in 8.1 — old code is forward-
-- compatible with schema 6 because it never reads these columns.
--
-- Forward-only, additive, idempotent (IF NOT EXISTS). All three columns
-- are nullable with no default so existing rows are unaffected.

ALTER TABLE positions ADD COLUMN IF NOT EXISTS last_reconciled_at           TIMESTAMPTZ;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS last_reconciled_verdict      TEXT;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS last_reconciliation_snapshot JSONB;

-- CHECK constraint added separately (and idempotently) so re-runs don't
-- error on the constraint already existing. The verdict column is left
-- nullable; rows that have never been reconciled stay NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'positions_last_reconciled_verdict_check'
  ) THEN
    ALTER TABLE positions
      ADD CONSTRAINT positions_last_reconciled_verdict_check
      CHECK (
        last_reconciled_verdict IS NULL
        OR last_reconciled_verdict IN ('OK','WARN','HALT','CATASTROPHIC')
      );
  END IF;
END$$;
