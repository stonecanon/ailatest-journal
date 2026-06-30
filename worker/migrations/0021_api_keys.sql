CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  name         TEXT NOT NULL DEFAULT 'My API',
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL,
  key_tail     TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  revoked_at   INTEGER,
  last_used_at INTEGER,
  call_count   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user
  ON api_keys(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash
  ON api_keys(key_hash);
