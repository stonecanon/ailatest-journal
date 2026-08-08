-- Controlled, resumable OpenAlex country-output preload.
--
-- The queue is seeded from data/country_preload_top_2025.json and consumed by
-- the daily Cloudflare scheduled task.  The usage table is an explicit budget
-- guard: a run reserves jobs before calling OpenAlex, so retries cannot turn
-- into an unbounded daily request storm.

CREATE TABLE IF NOT EXISTS country_output_preload_jobs (
  job_key TEXT PRIMARY KEY,
  issn TEXT NOT NULL,
  eissn TEXT NOT NULL DEFAULT '',
  year INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  journal_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_status INTEGER,
  last_error TEXT NOT NULL DEFAULT '',
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  claimed_at INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  source TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_country_preload_jobs_status
  ON country_output_preload_jobs(status, next_attempt_at, rank);

CREATE INDEX IF NOT EXISTS idx_country_preload_jobs_year
  ON country_output_preload_jobs(year, status, rank);

CREATE INDEX IF NOT EXISTS idx_country_output_cache_issns
  ON country_output_cache(issns, expires_at);

CREATE TABLE IF NOT EXISTS country_output_preload_state (
  state_key TEXT PRIMARY KEY,
  seed_cursor INTEGER NOT NULL DEFAULT 0,
  lock_until INTEGER NOT NULL DEFAULT 0,
  last_run_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS country_output_preload_usage (
  usage_day TEXT PRIMARY KEY,
  reserved_jobs INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
