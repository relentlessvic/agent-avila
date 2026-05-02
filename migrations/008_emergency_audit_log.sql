-- Phase D-5.12c — emergency_audit_log: durable record of post-Kraken-success
-- DB persistence failures so an operator can reconstruct what happened
-- after a real-money order succeeded but its DB row failed to commit.
--
-- ⚠️  DO NOT APPLY VIA scripts/run-migrations.js WITHOUT EXPLICIT OPERATOR
-- AUTHORIZATION. Migration 006 was applied as a side effect of running
-- the runner during Phase B.2a. This migration must NOT be applied that
-- way — application to production is a separate operator decision after
-- the D-5.12c code commit lands. Before running the runner, verify with
-- `git ls-files migrations/` that 008 is the ONLY unapplied file on
-- disk; if any later migration appears, halt and re-confirm scope with
-- the operator.
--
-- Forward-only, idempotent. Re-runs are no-ops once the table exists.
-- Reverse path is destructive (DROP TABLE drops historical incident
-- rows) — explicit safety review required before any rollback.

CREATE TABLE IF NOT EXISTS emergency_audit_log (
  id                 BIGSERIAL    PRIMARY KEY,
  event_id           TEXT         NOT NULL UNIQUE,
  timestamp          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  mode               TEXT         NOT NULL CHECK (mode IN ('paper','live')),
  source             TEXT         NOT NULL,
  kraken_order_id    TEXT,
  failure_class      TEXT         NOT NULL,
  error_message      TEXT,
  attempted_payload  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  resolved_at        TIMESTAMPTZ,
  resolved_by        TEXT,
  resolution_notes   TEXT,
  metadata           JSONB        NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS emergency_audit_log_unresolved_idx
  ON emergency_audit_log (mode, timestamp DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS emergency_audit_log_kraken_order_id_idx
  ON emergency_audit_log (kraken_order_id)
  WHERE kraken_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS emergency_audit_log_source_timestamp_idx
  ON emergency_audit_log (source, timestamp DESC);

CREATE INDEX IF NOT EXISTS emergency_audit_log_failure_class_timestamp_idx
  ON emergency_audit_log (failure_class, timestamp DESC);
