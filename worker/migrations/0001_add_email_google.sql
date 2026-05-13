-- Migration: v1 → v2 (add email / google / provider columns; new email_codes table)
-- Run on existing DB without data loss.
ALTER TABLE users ADD COLUMN email    TEXT;
ALTER TABLE users ADD COLUMN google_id TEXT;
ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'github';

UPDATE users SET provider = 'github' WHERE provider IS NULL;

CREATE TABLE IF NOT EXISTS email_codes (
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (email)
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
