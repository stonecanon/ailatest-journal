-- Durable cache for author-affiliation country shares.
--
-- OpenAlex is an optional enrichment source and Crossref is the public
-- fallback. Persisting successful responses in D1 prevents a cold Cloudflare
-- POP or a short upstream outage from forcing every detail-page request to
-- re-fetch the same journal/year window.

CREATE TABLE IF NOT EXISTS country_output_cache (
  cache_key TEXT PRIMARY KEY,
  issns TEXT NOT NULL,
  years TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_country_output_cache_expires
  ON country_output_cache(expires_at);
