-- Phase B.2a — extend trade_events.event_type CHECK to allow manual SL/TP
-- update events. Adds two new event types:
--   - manual_sl_update
--   - manual_tp_update
--
-- These types will be inserted by Phase B.2b (dashboard manual SET_STOP_LOSS
-- and SET_TAKE_PROFIT) once the caller integration ships. B.2a is inert at
-- runtime: the helper updatePositionRiskLevelsTx (db.js) is added but has
-- no callers until B.2b. No existing event types are removed; the eight
-- live values are preserved verbatim.
--
-- Verified constraint name (against production DB at pre-flight):
-- `trade_events_event_type_check` (Postgres-default for the inline CHECK
-- in migration 002). Verified live constraint definition matches the
-- migration 002 source exactly — no drift.
--
-- Forward-only, idempotent. Re-runs are a no-op when the constraint
-- already includes the new values.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trade_events_event_type_check'
      AND conrelid = 'trade_events'::regclass
      AND pg_get_constraintdef(oid) NOT LIKE '%manual_sl_update%'
  ) THEN
    ALTER TABLE trade_events DROP CONSTRAINT trade_events_event_type_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trade_events_event_type_check'
      AND conrelid = 'trade_events'::regclass
  ) THEN
    ALTER TABLE trade_events
      ADD CONSTRAINT trade_events_event_type_check
      CHECK (event_type IN (
        'buy_filled','exit_filled',
        'manual_buy','manual_close',
        'reentry_close','reentry_buy',
        'buy_attempt','exit_attempt',
        'manual_sl_update','manual_tp_update'
      ));
  END IF;
END$$;
