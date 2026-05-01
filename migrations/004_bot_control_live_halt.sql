-- Phase D-5.10.5.2 — track last live halt reason on bot_control for
-- Discord dedup. The new columns hold the most recent halt-reason streak:
--
--   last_live_halt_reason         — e.g. "paper-still-open" / "phantom-in-db"
--   last_live_halt_detail         — short context: "count=1", "dbOrderId=…"
--   last_live_halt_phase          — source: "d-5.10.3" / "d-5.10.5" / "d-5.10.5.5"
--   last_live_halt_first_seen_at  — timestamp of the first cycle in this streak
--   last_live_halt_last_seen_at   — timestamp of the most recent cycle observed
--   last_live_halt_count          — cycles in the current streak (resets on transition)
--
-- bot_control is a single-row table (CHECK (id = 1)). All columns are nullable
-- (the count defaults to 0) so existing rows are unaffected by this DDL.
-- Forward-only additive — IF NOT EXISTS makes the migration idempotent.
--
-- Read/write only by bot.js's _emitLiveHaltAlert / _emitLiveHaltCleared
-- wrappers (via db.js's recordLiveHaltState / clearLiveHaltState helpers).
-- bot.js trading flow (halt-or-proceed decisions) does NOT depend on these
-- columns — they are observability/dedup state only.

ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS last_live_halt_reason         TEXT;
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS last_live_halt_detail         TEXT;
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS last_live_halt_phase          TEXT;
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS last_live_halt_first_seen_at  TIMESTAMPTZ;
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS last_live_halt_last_seen_at   TIMESTAMPTZ;
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS last_live_halt_count          INTEGER NOT NULL DEFAULT 0;
