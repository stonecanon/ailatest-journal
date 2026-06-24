CREATE TABLE IF NOT EXISTS interaction_events (
  event_id          TEXT PRIMARY KEY,
  event_type        TEXT NOT NULL,
  site              TEXT NOT NULL,
  path              TEXT,
  tab               TEXT,
  query             TEXT,
  result_count      INTEGER,
  visitor_id        TEXT,
  session_id        TEXT,
  user_id           INTEGER,
  event_ts          INTEGER NOT NULL,
  received_at       INTEGER NOT NULL,
  event_day_utc     TEXT NOT NULL,
  client_timezone   TEXT,
  client_language   TEXT,
  metadata_json     TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_interaction_events_type_day ON interaction_events(event_type, event_day_utc);
CREATE INDEX IF NOT EXISTS idx_interaction_events_site_day ON interaction_events(site, event_day_utc);
