-- Phase D-5.4 — initial schema (subset).
--
-- Creates schema_migrations + bot_control only. The other 8 tables from the
-- D-5.3B design (trade_events, positions, portfolio_snapshots,
-- performance_snapshots, system_events, strategy_signals, sessions,
-- rate_limits) ship in subsequent migrations as their respective phases land.
--
-- Migrations are immutable once applied — never edit this file after it has
-- been run anywhere. Add a new 002_*.sql file instead. The migration runner
-- compares SHA-256 checksums and aborts if an applied migration changed.

-- ─── Migration version log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER     PRIMARY KEY,
  name       TEXT        NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum   TEXT        NOT NULL
);

-- ─── Bot control (single row) ───────────────────────────────────────────────
-- Mirror of the existing bot-control.json file. CHECK (id = 1) enforces a
-- single global row at the DB level. D-5.4 only creates the table and seeds
-- the row; reads still come from JSON until D-5.6 flips them.
CREATE TABLE IF NOT EXISTS bot_control (
  id                       SMALLINT     PRIMARY KEY CHECK (id = 1),
  paper_trading            BOOLEAN      NOT NULL DEFAULT true,
  stopped                  BOOLEAN      NOT NULL DEFAULT false,
  paused                   BOOLEAN      NOT NULL DEFAULT false,
  paused_until             TIMESTAMPTZ,
  killed                   BOOLEAN      NOT NULL DEFAULT false,
  leverage                 INTEGER      NOT NULL DEFAULT 2,
  risk_pct                 NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  dynamic_sizing           BOOLEAN      NOT NULL DEFAULT true,
  max_daily_loss_pct       NUMERIC(5,2) NOT NULL DEFAULT 3.00,
  cooldown_minutes         INTEGER      NOT NULL DEFAULT 15,
  kill_switch_enabled      BOOLEAN      NOT NULL DEFAULT true,
  kill_switch_drawdown_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  pause_after_losses       INTEGER      NOT NULL DEFAULT 3,
  consecutive_losses       INTEGER      NOT NULL DEFAULT 0,
  last_trade_time          TIMESTAMPTZ,
  leverage_disabled_until  TIMESTAMPTZ,
  last_summary_date        DATE,
  updated_by               TEXT,
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed the single row. ON CONFLICT keeps existing values if the row already
-- exists (idempotent across re-runs even after the table is populated).
INSERT INTO bot_control (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
