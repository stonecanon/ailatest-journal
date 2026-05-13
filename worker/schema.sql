-- ailatest-journal D1 schema (v2 — supports email/github/google)
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT UNIQUE,
  github_id   INTEGER UNIQUE,
  google_id   TEXT UNIQUE,
  login       TEXT,
  name        TEXT,
  avatar_url  TEXT,
  provider    TEXT,                    -- 'email' | 'github' | 'google'
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

-- 邮箱一次性验证码
CREATE TABLE IF NOT EXISTS email_codes (
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,           -- sha256(code + pepper)
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (email)
);

-- 期刊评分（综合推荐，0.5-5.0，0.5 步长）
CREATE TABLE IF NOT EXISTS ratings (
  user_id      INTEGER NOT NULL,
  journal_key  TEXT    NOT NULL,
  rating       REAL    NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, journal_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 多收藏清单（每个用户可有多个 list）
CREATE TABLE IF NOT EXISTS fav_lists (
  user_id     INTEGER NOT NULL,
  list_id     TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  sort_index  INTEGER NOT NULL DEFAULT 0,
  ids_json    TEXT    NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, list_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fav_lists_user ON fav_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google   ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_ratings_journal ON ratings(journal_key);
CREATE INDEX IF NOT EXISTS idx_ratings_user    ON ratings(user_id);
