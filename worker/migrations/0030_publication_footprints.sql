-- Confirmed publication footprint records shared by the website and account.
-- No publisher credentials or session tokens are stored here.
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
