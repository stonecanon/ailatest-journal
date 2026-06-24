CREATE TABLE IF NOT EXISTS journal_view_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_key TEXT NOT NULL,
  user_id     INTEGER,
  visitor_id  TEXT,
  session_id  TEXT,
  path        TEXT,
  viewed_at   INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_view_events_viewed_at ON journal_view_events(viewed_at);
CREATE INDEX IF NOT EXISTS idx_journal_view_events_key ON journal_view_events(journal_key, viewed_at);
