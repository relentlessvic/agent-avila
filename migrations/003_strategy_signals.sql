-- Phase D-5.9.1 — strategy_signals table.
--
-- One row per bot cycle that actually evaluates a signal. Captures the
-- decision context (signal score, threshold, indicators, regime gates,
-- optional V2 shadow preview) so the cycle stream UI and signal forensics
-- have a durable Postgres-backed source instead of safety-check-log.json,
-- which Railway wipes on every deploy.
--
-- D-5.9.1 is shadow-write only: bot.js dual-writes JSON-first then DB.
-- Dashboard reads continue to come from JSON; the read flip lands in
-- D-5.9.6. No bot decision logic depends on this table.
--
-- Mode-scoped like positions/trade_events:
--   - CHECK constraint enforces ('paper'|'live') at the DDL level.
--   - All indexes lead with mode so paper/live queries stay disjoint.
--   - Partial unique index on (mode, cycle_id) makes a duplicate cycle
--     write a no-op via ON CONFLICT DO NOTHING (idempotent retries).
--
-- Score/metric columns use NUMERIC, not INTEGER — direct lesson from
-- D-5.7.3.1 where evalSignal's RSI-dip subscore can be fractional
-- (e.g. 99.047619...). NUMERIC keeps fidelity without round-trip coercion.

CREATE TABLE IF NOT EXISTS strategy_signals (
  id                BIGSERIAL    PRIMARY KEY,
  mode              TEXT         NOT NULL CHECK (mode IN ('paper','live')),
  cycle_id          TEXT         NOT NULL,
  symbol            TEXT         NOT NULL,
  timeframe         TEXT,
  cycle_ts          TIMESTAMPTZ  NOT NULL,
  signal_score      NUMERIC(10,4),
  signal_threshold  NUMERIC(10,4),
  signal_decision   TEXT,                    -- BUY | HOLD | SKIP | BLOCKED
  decision_reason   TEXT,                    -- volatile-skip | score-below-threshold | liquidation-risk | trade-limit | paused | …
  all_pass          BOOLEAN,
  bullish_bias      BOOLEAN,
  price             NUMERIC(18,8) NOT NULL,
  rsi_3             NUMERIC(10,4),
  rsi_14            NUMERIC(10,4),
  ema_fast          NUMERIC(18,8),           -- ema8
  vwap              NUMERIC(18,8),
  atr_14            NUMERIC(18,8),
  regime            TEXT,                    -- TRENDING | RANGE | VOLATILE | …
  volatility_level  TEXT,                    -- HIGH | NORMAL | LOW
  spike_ratio       NUMERIC(10,4),
  effective_lev     INTEGER,
  paper_trading     BOOLEAN      NOT NULL,
  subscores         JSONB        NOT NULL DEFAULT '{}'::jsonb,   -- {emaScore, rsiScore, vwapScore, extScore} or per-condition map
  conditions        JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- evalSignal conditions[] for forensics
  gates             JSONB        NOT NULL DEFAULT '{}'::jsonb,   -- {paused, killed, drawdown, cooldown, tradeLimit, liquidationSafety, …}
  v2_shadow         JSONB        NOT NULL DEFAULT '{}'::jsonb,   -- V2 strategy preview when enabled (D-4-V2)
  decision_log      TEXT,
  metadata          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  inserted_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS strategy_signals_mode_cycle_ts_idx
  ON strategy_signals (mode, cycle_ts DESC);

CREATE INDEX IF NOT EXISTS strategy_signals_mode_decision_ts_idx
  ON strategy_signals (mode, signal_decision, cycle_ts DESC);

-- Idempotency boundary: same (mode, cycle_id) → ON CONFLICT DO NOTHING in
-- insertStrategySignal. cycle_id is ISO timestamp + symbol so a retry of
-- the exact same cycle never duplicates the row.
CREATE UNIQUE INDEX IF NOT EXISTS strategy_signals_mode_cycle_unique
  ON strategy_signals (mode, cycle_id);
