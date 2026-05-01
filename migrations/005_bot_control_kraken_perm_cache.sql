-- Phase D-5.10.5.4 — cache the Kraken API key permission probe so bot.js
-- doesn't issue a signed AddOrder validate=true on every live cycle.
--
-- The probe is a one-time-per-process check that the live key has the
-- required write permissions (Modify Orders, Cancel/Close Orders) before
-- the bot reaches the trade-decision branch. Without this cache, the probe
-- would run every 5-min cycle even when the key is known healthy — that's
-- ~12 unnecessary signed AddOrder calls per hour.
--
-- bot_control is a single-row table (CHECK (id = 1)). All four columns
-- are nullable — fresh installs (or operator cache-flushes via UPDATE …
-- = NULL) trigger a re-probe on the next live cycle. Forward-only,
-- additive, idempotent (IF NOT EXISTS).
--
-- Read/write paths:
--   - db.js getKrakenPermCheckState() reads the row.
--   - db.js recordKrakenPermCheck(ok, reason, detail) writes the result
--     after each probe attempt.
-- bot.js trading flow (halt-or-proceed) does NOT depend on these columns
-- — they are observability/cache state only. A missing or stale row just
-- forces another probe; it cannot block trading on its own.

ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS kraken_perm_check_at      TIMESTAMPTZ;
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS kraken_perm_check_ok      BOOLEAN;
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS kraken_perm_check_reason  TEXT;
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS kraken_perm_check_detail  TEXT;
