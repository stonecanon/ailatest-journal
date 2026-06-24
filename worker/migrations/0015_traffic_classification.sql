ALTER TABLE raw_events ADD COLUMN traffic_type TEXT NOT NULL DEFAULT 'human';
ALTER TABLE raw_events ADD COLUMN visitor_hash TEXT DEFAULT '';

ALTER TABLE interaction_events ADD COLUMN traffic_type TEXT NOT NULL DEFAULT 'human';
ALTER TABLE interaction_events ADD COLUMN bot_reason TEXT DEFAULT '';
ALTER TABLE interaction_events ADD COLUMN visitor_hash TEXT DEFAULT '';

ALTER TABLE journal_view_events ADD COLUMN traffic_type TEXT NOT NULL DEFAULT 'human';
ALTER TABLE journal_view_events ADD COLUMN bot_reason TEXT DEFAULT '';
ALTER TABLE journal_view_events ADD COLUMN visitor_hash TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS traffic_classification_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  event_ref      TEXT NOT NULL,
  event_table    TEXT NOT NULL,
  visitor_hash   TEXT DEFAULT '',
  traffic_type   TEXT NOT NULL,
  rule_code      TEXT NOT NULL,
  rule_detail    TEXT DEFAULT '',
  classified_at  INTEGER NOT NULL,
  UNIQUE(event_ref, event_table, rule_code)
);

CREATE INDEX IF NOT EXISTS idx_raw_events_traffic_type ON raw_events(traffic_type, event_ts);
CREATE INDEX IF NOT EXISTS idx_raw_events_visitor_hash ON raw_events(visitor_hash, event_ts);
CREATE INDEX IF NOT EXISTS idx_interaction_events_traffic_type ON interaction_events(traffic_type, event_ts);
CREATE INDEX IF NOT EXISTS idx_interaction_events_visitor_hash ON interaction_events(visitor_hash, event_ts);
CREATE INDEX IF NOT EXISTS idx_journal_view_events_traffic_type ON journal_view_events(traffic_type, viewed_at);
CREATE INDEX IF NOT EXISTS idx_journal_view_events_visitor_hash ON journal_view_events(visitor_hash, viewed_at);
CREATE INDEX IF NOT EXISTS idx_traffic_classification_events_type ON traffic_classification_events(traffic_type, classified_at);

ALTER TABLE hourly_stats ADD COLUMN human_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hourly_stats ADD COLUMN search_engine_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hourly_stats ADD COLUMN ai_agent_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hourly_stats ADD COLUMN scraper_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hourly_stats ADD COLUMN suspected_bot_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hourly_stats ADD COLUMN unknown_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hourly_stats ADD COLUMN all_pv INTEGER NOT NULL DEFAULT 0;

ALTER TABLE daily_stats ADD COLUMN human_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN search_engine_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN ai_agent_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN scraper_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN suspected_bot_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN unknown_pv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN all_pv INTEGER NOT NULL DEFAULT 0;
