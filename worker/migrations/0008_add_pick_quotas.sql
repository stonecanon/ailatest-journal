CREATE TABLE IF NOT EXISTS user_quotas (
  user_id       INTEGER PRIMARY KEY,
  plan          TEXT    NOT NULL DEFAULT 'free',
  daily_limit   INTEGER NOT NULL DEFAULT 5,
  monthly_limit INTEGER,
  paid_until    INTEGER,
  updated_at    INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pick_usage (
  user_id     INTEGER NOT NULL,
  period      TEXT    NOT NULL,
  period_key  TEXT    NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, period, period_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pick_usage_user_period ON pick_usage(user_id, period, period_key);
