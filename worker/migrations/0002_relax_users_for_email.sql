DROP TABLE IF EXISTS users_new;

CREATE TABLE users_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT UNIQUE,
  github_id   INTEGER UNIQUE,
  google_id   TEXT UNIQUE,
  login       TEXT,
  name        TEXT,
  avatar_url  TEXT,
  provider    TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

INSERT INTO users_new (
  id, email, github_id, google_id, login, name, avatar_url, provider, created_at, updated_at
)
SELECT
  id, email, github_id, google_id, login, name, avatar_url, COALESCE(provider, 'github'), created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
