-- Aggregated, privacy-preserving usage telemetry for the extension and API.
-- No page content, email, raw IP, or per-request identifiers are stored.
ALTER TABLE extension_usage ADD COLUMN requests INTEGER NOT NULL DEFAULT 0;
ALTER TABLE extension_usage ADD COLUMN heartbeats INTEGER NOT NULL DEFAULT 0;
ALTER TABLE extension_usage ADD COLUMN last_seen_at INTEGER;

CREATE TABLE IF NOT EXISTS api_request_metrics (
  day          TEXT NOT NULL,
  path         TEXT NOT NULL,
  method       TEXT NOT NULL,
  requests     INTEGER NOT NULL DEFAULT 0,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (day, path, method)
);

CREATE INDEX IF NOT EXISTS idx_api_request_metrics_day
  ON api_request_metrics(day);
