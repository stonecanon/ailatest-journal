-- =========================================================================
-- Migration v3 — Analytics Enhancements
-- =========================================================================
-- Apply: npx wrangler d1 execute ailatest-journal --file=migrations/003_analytics_enhance.sql
-- =========================================================================

-- Add new columns to raw_events (safe ALTER TABLE ADD COLUMN)
ALTER TABLE raw_events ADD COLUMN IF NOT EXISTS screen_resolution TEXT DEFAULT '';

-- Bot statistics table
CREATE TABLE IF NOT EXISTS bot_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  day TEXT NOT NULL,
  bot_name TEXT NOT NULL,
  pv INTEGER NOT NULL DEFAULT 0,
  uv INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT unique_bot_day UNIQUE (site, day, bot_name)
);
CREATE INDEX IF NOT EXISTS idx_bot_stats_day ON bot_stats(site, day);

-- Add event fields to interaction_events
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT '';
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS is_bot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS journal_key TEXT DEFAULT '';
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS journal_name TEXT DEFAULT '';
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS journal_issn TEXT DEFAULT '';

-- Analytics metadata table
CREATE TABLE IF NOT EXISTS analytics_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO analytics_meta (key, value, updated_at) VALUES
  ('schema_version', '3', unixepoch()),
  ('last_full_aggregation', '', unixepoch()),
  ('last_daily_finalize', '', unixepoch());
