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
  status      TEXT NOT NULL DEFAULT 'active',
  admin_note  TEXT NOT NULL DEFAULT '',
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

CREATE TABLE IF NOT EXISTS publication_submissions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  system TEXT NOT NULL DEFAULT 'unknown',
  journal TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  manuscript_id TEXT NOT NULL DEFAULT '',
  status_raw TEXT NOT NULL DEFAULT '',
  status_normalized TEXT NOT NULL DEFAULT 'unknown',
  submitted_at INTEGER,
  status_at INTEGER,
  source_url TEXT NOT NULL DEFAULT '',
  evidence_text TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  watch_enabled INTEGER NOT NULL DEFAULT 0,
  notify_enabled INTEGER NOT NULL DEFAULT 1,
  last_checked_at INTEGER,
  last_error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_publication_submissions_user_updated
  ON publication_submissions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_publication_submissions_user_key
  ON publication_submissions(user_id, system, manuscript_id);

-- Confirmed publication footprint records, shared by the website and account.
-- The browser keeps a local copy for offline use; this table is the account copy.
CREATE TABLE IF NOT EXISTS publication_footprints (
  id                 TEXT PRIMARY KEY,
  user_id            INTEGER NOT NULL,
  journal_key        TEXT NOT NULL,
  name               TEXT NOT NULL,
  papers             INTEGER NOT NULL DEFAULT 0,
  citations          INTEGER NOT NULL DEFAULT 0,
  years_json         TEXT NOT NULL DEFAULT '[]',
  titles_json        TEXT NOT NULL DEFAULT '[]',
  issns_json         TEXT NOT NULL DEFAULT '[]',
  badges_json        TEXT NOT NULL DEFAULT '[]',
  organizations_json TEXT NOT NULL DEFAULT '[]',
  countries_json     TEXT NOT NULL DEFAULT '[]',
  fields_json        TEXT NOT NULL DEFAULT '[]',
  source_profiles_json TEXT NOT NULL DEFAULT '[]',
  metadata_json      TEXT NOT NULL DEFAULT '{}',
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  UNIQUE(user_id, journal_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_publication_footprints_user_updated
  ON publication_footprints(user_id, updated_at DESC);

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

CREATE TABLE IF NOT EXISTS login_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  provider  TEXT,
  day       TEXT NOT NULL,
  event_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  day         TEXT NOT NULL,
  event_at    INTEGER NOT NULL,
  path        TEXT,
  referrer    TEXT,
  session_id  TEXT,
  visitor_id  TEXT,
  country     TEXT,
  colo        TEXT,
  client_timezone TEXT,
  client_language TEXT
);

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

CREATE INDEX IF NOT EXISTS idx_fav_lists_user ON fav_lists(user_id);

-- Owner console (soft-delete/override records; all writes are owner-gated).
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS project_registry (
  project_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  host TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'product',
  status TEXT NOT NULL DEFAULT 'active',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_registry_status ON project_registry(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS content_overrides (
  project_id TEXT NOT NULL,
  record_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  payload_json TEXT NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT '',
  updated_by INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, record_key)
);
CREATE INDEX IF NOT EXISTS idx_content_overrides_project ON content_overrides(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google   ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_ratings_journal ON ratings(journal_key);
CREATE INDEX IF NOT EXISTS idx_ratings_user    ON ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_day ON login_events(day);
CREATE INDEX IF NOT EXISTS idx_login_events_user_day ON login_events(user_id, day);
CREATE INDEX IF NOT EXISTS idx_page_events_day ON page_events(day);
CREATE INDEX IF NOT EXISTS idx_page_events_session_day ON page_events(session_id, day);
CREATE INDEX IF NOT EXISTS idx_page_events_visitor_day ON page_events(visitor_id, day);
CREATE INDEX IF NOT EXISTS idx_pick_usage_user_period ON pick_usage(user_id, period, period_key);
