-- Journal ratings (single "综合推荐" dimension, 0.5 - 5.0 with 0.5 step)
CREATE TABLE IF NOT EXISTS ratings (
  user_id      INTEGER NOT NULL,
  journal_key  TEXT    NOT NULL,
  rating       REAL    NOT NULL,          -- 0.5, 1.0, ..., 5.0
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, journal_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ratings_journal ON ratings(journal_key);
CREATE INDEX IF NOT EXISTS idx_ratings_user    ON ratings(user_id);
