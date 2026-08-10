-- Submission status records shared by the publication footprint and browser extension.
-- The table intentionally stores normalized status/evidence only; credentials and
-- session cookies are never persisted.
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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_publication_submissions_user_updated
  ON publication_submissions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_publication_submissions_user_key
  ON publication_submissions(user_id, system, manuscript_id);
