CREATE TABLE IF NOT EXISTS extension_download_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asset           TEXT NOT NULL,
  event_at        INTEGER NOT NULL,
  day             TEXT NOT NULL,
  visitor_id      TEXT DEFAULT '',
  session_id      TEXT DEFAULT '',
  referrer        TEXT DEFAULT '',
  user_agent      TEXT DEFAULT '',
  ip_hash         TEXT DEFAULT '',
  country         TEXT DEFAULT '',
  client_language TEXT DEFAULT '',
  source_path     TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS extension_download_stats (
  asset     TEXT PRIMARY KEY,
  total     INTEGER NOT NULL DEFAULT 0,
  latest_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_extension_download_events_asset_time
  ON extension_download_events(asset, event_at);

CREATE INDEX IF NOT EXISTS idx_extension_download_events_day
  ON extension_download_events(day);
