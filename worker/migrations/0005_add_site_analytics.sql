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
  colo        TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_events_day ON login_events(day);
CREATE INDEX IF NOT EXISTS idx_login_events_user_day ON login_events(user_id, day);
CREATE INDEX IF NOT EXISTS idx_page_events_day ON page_events(day);
CREATE INDEX IF NOT EXISTS idx_page_events_session_day ON page_events(session_id, day);
CREATE INDEX IF NOT EXISTS idx_page_events_visitor_day ON page_events(visitor_id, day);
