CREATE TABLE IF NOT EXISTS raw_events (
  event_id          TEXT PRIMARY KEY,
  event_type        TEXT NOT NULL DEFAULT 'pageview',
  site              TEXT NOT NULL,
  path              TEXT,
  referrer          TEXT,
  visitor_id        TEXT,
  session_id        TEXT,
  event_ts          INTEGER NOT NULL,
  received_at       INTEGER NOT NULL,
  event_hour_utc    TEXT NOT NULL,
  event_day_utc     TEXT NOT NULL,
  client_timezone   TEXT,
  client_language   TEXT,
  user_agent        TEXT,
  ip_hash           TEXT,
  country           TEXT,
  colo              TEXT,
  is_bot            INTEGER NOT NULL DEFAULT 0,
  bot_reason        TEXT,
  metadata_json     TEXT
);

CREATE INDEX IF NOT EXISTS idx_raw_events_site_ts ON raw_events(site, event_ts);
CREATE INDEX IF NOT EXISTS idx_raw_events_hour ON raw_events(event_hour_utc, site);
CREATE INDEX IF NOT EXISTS idx_raw_events_day ON raw_events(event_day_utc, site);
CREATE INDEX IF NOT EXISTS idx_raw_events_visitor ON raw_events(visitor_id, event_ts);
CREATE INDEX IF NOT EXISTS idx_raw_events_session ON raw_events(session_id, event_ts);
CREATE INDEX IF NOT EXISTS idx_raw_events_ip_ts ON raw_events(ip_hash, event_ts);
CREATE INDEX IF NOT EXISTS idx_raw_events_bot ON raw_events(is_bot, event_ts);

CREATE TABLE IF NOT EXISTS hourly_stats (
  site                  TEXT NOT NULL,
  hour_start_utc        TEXT NOT NULL,
  pageviews             INTEGER NOT NULL DEFAULT 0,
  visitors              INTEGER NOT NULL DEFAULT 0,
  sessions              INTEGER NOT NULL DEFAULT 0,
  cn_hint_events        INTEGER NOT NULL DEFAULT 0,
  cn_hint_visitors      INTEGER NOT NULL DEFAULT 0,
  cn_hint_sessions      INTEGER NOT NULL DEFAULT 0,
  bot_events            INTEGER NOT NULL DEFAULT 0,
  unique_ips            INTEGER NOT NULL DEFAULT 0,
  top_paths_json        TEXT NOT NULL DEFAULT '[]',
  countries_json        TEXT NOT NULL DEFAULT '[]',
  aggregated_at         INTEGER NOT NULL,
  PRIMARY KEY (site, hour_start_utc)
);

CREATE TABLE IF NOT EXISTS daily_stats (
  site                  TEXT NOT NULL,
  day_utc               TEXT NOT NULL,
  pageviews             INTEGER NOT NULL DEFAULT 0,
  visitors              INTEGER NOT NULL DEFAULT 0,
  sessions              INTEGER NOT NULL DEFAULT 0,
  cn_hint_events        INTEGER NOT NULL DEFAULT 0,
  cn_hint_visitors      INTEGER NOT NULL DEFAULT 0,
  cn_hint_sessions      INTEGER NOT NULL DEFAULT 0,
  bot_events            INTEGER NOT NULL DEFAULT 0,
  unique_ips            INTEGER NOT NULL DEFAULT 0,
  top_paths_json        TEXT NOT NULL DEFAULT '[]',
  countries_json        TEXT NOT NULL DEFAULT '[]',
  aggregated_at         INTEGER NOT NULL,
  calibrated            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site, day_utc)
);

CREATE INDEX IF NOT EXISTS idx_hourly_stats_hour ON hourly_stats(hour_start_utc);
CREATE INDEX IF NOT EXISTS idx_daily_stats_day ON daily_stats(day_utc);

INSERT OR IGNORE INTO raw_events (
  event_id, event_type, site, path, referrer, visitor_id, session_id,
  event_ts, received_at, event_hour_utc, event_day_utc,
  client_timezone, client_language, country, colo, is_bot, bot_reason
)
SELECT
  'legacy-page-' || id,
  'pageview',
  COALESCE(NULLIF(site, ''), 'journal.ailatest.org'),
  path,
  referrer,
  visitor_id,
  session_id,
  event_at,
  event_at,
  strftime('%Y-%m-%dT%H:00:00Z', event_at, 'unixepoch'),
  day,
  client_timezone,
  client_language,
  country,
  colo,
  0,
  ''
FROM page_events
WHERE event_at IS NOT NULL;
