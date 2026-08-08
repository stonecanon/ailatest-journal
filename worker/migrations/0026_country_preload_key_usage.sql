-- Track the preload budget per OpenAlex key so keys are consumed
-- sequentially instead of sharing one global daily cap.

CREATE TABLE IF NOT EXISTS country_output_preload_key_usage (
  usage_day TEXT NOT NULL,
  key_index INTEGER NOT NULL,
  reserved_jobs INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (usage_day, key_index)
);

CREATE INDEX IF NOT EXISTS idx_country_preload_key_usage_day
  ON country_output_preload_key_usage(usage_day, key_index);

-- Preserve the requests already reserved under the old global counter by
-- assigning them to the first key. The global table remains as an aggregate
-- compatibility view for existing operational queries.
INSERT OR IGNORE INTO country_output_preload_key_usage
  (usage_day, key_index, reserved_jobs, updated_at)
SELECT usage_day, 0, reserved_jobs, updated_at
FROM country_output_preload_usage;
