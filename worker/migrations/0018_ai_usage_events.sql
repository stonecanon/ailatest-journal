CREATE TABLE IF NOT EXISTS ai_usage_events (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at        INTEGER NOT NULL,
  day               TEXT NOT NULL,
  user_id           INTEGER,
  app               TEXT,
  feature           TEXT,
  provider          TEXT,
  model             TEXT,
  range_label       TEXT,
  query_chars       INTEGER DEFAULT 0,
  terms_count       INTEGER DEFAULT 0,
  evidence_count    INTEGER DEFAULT 0,
  prompt_tokens     INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens      INTEGER DEFAULT 0,
  cache_hit_tokens  INTEGER DEFAULT 0,
  cache_miss_tokens INTEGER DEFAULT 0,
  input_cny         REAL DEFAULT 0,
  output_cny        REAL DEFAULT 0,
  total_cny         REAL DEFAULT 0,
  input_usd         REAL DEFAULT 0,
  output_usd        REAL DEFAULT 0,
  total_usd         REAL DEFAULT 0,
  latency_ms        INTEGER DEFAULT 0,
  success           INTEGER DEFAULT 1,
  error             TEXT DEFAULT '',
  metadata_json     TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_day ON ai_usage_events(day);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_app_day ON ai_usage_events(app, day);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_feature_day ON ai_usage_events(feature, day);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_day ON ai_usage_events(user_id, day);
