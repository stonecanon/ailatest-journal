-- ailatest-journal D1 schema
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id   INTEGER UNIQUE NOT NULL,
  login       TEXT NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id      INTEGER NOT NULL,
  journal_key  TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, journal_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
