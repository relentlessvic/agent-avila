-- Phase D-5.7 — trade_events + positions tables.
--
-- Both tables are dual-written by bot.js's BUY/EXIT/REENTRY/failed-attempt
-- paths starting in this phase. Dashboard reads stay on JSON/CSV until
-- D-5.8; bot reads stay on JSON/CSV indefinitely until a future phase.
--
-- Order of CREATE TABLE matters: positions is built first because
-- trade_events.position_id has a FK on positions(id).
--
-- pgcrypto is created defensively for any future migration that wants
-- gen_random_uuid() server-side. D-5.7 generates deterministic event_ids
-- in userland (bot.js buildEventId), so this CREATE EXTENSION is
-- forward-looking only. CREATE EXTENSION IF NOT EXISTS is idempotent
-- and safe to run on a Postgres that already has the extension.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── positions ──────────────────────────────────────────────────────────────
-- One row per position lifecycle. status transitions:
--   open    → closed     (normal SL/TP/manual/REENTRY close)
--   open    → orphaned   (live reconciliation mismatch — manual fix needed)
--
-- Partial unique index `positions_one_open_per_mode_idx` enforces "at most
-- one open position per mode at a time" at the DDL level, independent of
-- any in-memory check in bot.js. A bug or duplicate retry that tries to
-- INSERT a second 'open' row in the same mode hits a unique-violation
-- and the surrounding transaction rolls back — no DB corruption.
CREATE TABLE IF NOT EXISTS positions (
  id                    BIGSERIAL    PRIMARY KEY,
  mode                  TEXT         NOT NULL CHECK (mode IN ('paper','live')),
  symbol                TEXT         NOT NULL,
  side                  TEXT         NOT NULL CHECK (side IN ('long','short')),
  status                TEXT         NOT NULL CHECK (status IN ('open','closed','orphaned')),
  entry_price           NUMERIC(18,8) NOT NULL,
  entry_time            TIMESTAMPTZ  NOT NULL,
  entry_signal_score    INTEGER,
  quantity              NUMERIC(18,8) NOT NULL,
  trade_size_usd        NUMERIC(18,4) NOT NULL,
  leverage              INTEGER      NOT NULL DEFAULT 1,
  effective_size_usd    NUMERIC(18,4),
  stop_loss             NUMERIC(18,8) NOT NULL,
  take_profit           NUMERIC(18,8) NOT NULL,
  volatility_level      TEXT,
  kraken_order_id       TEXT,
  exit_price            NUMERIC(18,8),
  exit_time             TIMESTAMPTZ,
  exit_reason           TEXT,
  realized_pnl_usd      NUMERIC(18,4),
  realized_pnl_pct      NUMERIC(10,4),
  kraken_exit_order_id  TEXT,
  metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  inserted_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS positions_one_open_per_mode_idx
  ON positions (mode) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS positions_mode_status_idx
  ON positions (mode, status, entry_time DESC);

-- Live reconciliation safety: a single Kraken BUY order id can only be
-- attached to one position row. Idempotent retries that re-insert the
-- same kraken_order_id hit ON CONFLICT DO NOTHING; the caller looks up
-- the existing id rather than creating a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS positions_kraken_order_unique
  ON positions (kraken_order_id) WHERE kraken_order_id IS NOT NULL;

-- ─── trade_events ───────────────────────────────────────────────────────────
-- Append-only journal of every trade lifecycle event. event_id is a
-- deterministic UUID derived from kraken_order_id + event_type so a
-- crash-and-retry between the JSON write and the DB write does not
-- create a duplicate row (ON CONFLICT (event_id) DO NOTHING).
--
-- position_id is nullable: failed *_attempt events do not transition a
-- position, and historical imports may lack a matching position row.
-- ON DELETE SET NULL means deleting an old position (rare, manual)
-- doesn't cascade-delete the audit journal.
CREATE TABLE IF NOT EXISTS trade_events (
  id                BIGSERIAL    PRIMARY KEY,
  event_id          UUID         NOT NULL UNIQUE,
  timestamp         TIMESTAMPTZ  NOT NULL,
  mode              TEXT         NOT NULL CHECK (mode IN ('paper','live')),
  event_type        TEXT         NOT NULL CHECK (event_type IN (
                       'buy_filled','exit_filled',
                       'manual_buy','manual_close',
                       'reentry_close','reentry_buy',
                       'buy_attempt','exit_attempt'
                    )),
  symbol            TEXT         NOT NULL,
  position_id       BIGINT       REFERENCES positions(id) ON DELETE SET NULL,
  price             NUMERIC(18,8),
  quantity          NUMERIC(18,8),
  usd_amount        NUMERIC(18,4),
  fees_usd          NUMERIC(18,6),
  slippage_bps      INTEGER,
  pnl_usd           NUMERIC(18,4),
  pnl_pct           NUMERIC(10,4),
  signal_score      INTEGER,
  signal_threshold  INTEGER,
  regime            TEXT,
  leverage          INTEGER,
  kraken_order_id   TEXT,
  decision_log      TEXT,
  error             TEXT,
  metadata          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  inserted_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_events_mode_ts_idx
  ON trade_events (mode, timestamp DESC);

CREATE INDEX IF NOT EXISTS trade_events_mode_type_ts_idx
  ON trade_events (mode, event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS trade_events_position_idx
  ON trade_events (position_id);

CREATE INDEX IF NOT EXISTS trade_events_kraken_idx
  ON trade_events (kraken_order_id) WHERE kraken_order_id IS NOT NULL;
