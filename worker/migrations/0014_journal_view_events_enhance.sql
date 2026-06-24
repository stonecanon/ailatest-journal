-- Migration v14 — Journal view events enhancement
-- Add columns one at a time, each wrapped in a try block

-- referrer
ALTER TABLE journal_view_events ADD COLUMN referrer TEXT DEFAULT '';

-- user_agent  
ALTER TABLE journal_view_events ADD COLUMN user_agent TEXT DEFAULT '';

-- is_bot
ALTER TABLE journal_view_events ADD COLUMN is_bot INTEGER DEFAULT 0;

-- country
ALTER TABLE journal_view_events ADD COLUMN country TEXT DEFAULT '';

-- ip_hash
ALTER TABLE journal_view_events ADD COLUMN ip_hash TEXT DEFAULT '';

-- device
ALTER TABLE journal_view_events ADD COLUMN device TEXT DEFAULT '';

-- browser
ALTER TABLE journal_view_events ADD COLUMN browser TEXT DEFAULT '';

-- event_time
ALTER TABLE journal_view_events ADD COLUMN event_time INTEGER DEFAULT 0;

-- index
CREATE INDEX IF NOT EXISTS idx_journal_view_events_visitor ON journal_view_events(visitor_id, viewed_at);
