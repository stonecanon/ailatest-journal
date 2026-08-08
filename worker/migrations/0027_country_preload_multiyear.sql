-- Re-seed the country-output queue when the preload year set changes.
-- Existing rows keep their status; the next seed pass adds missing years.

ALTER TABLE country_output_preload_state
  ADD COLUMN seed_version INTEGER NOT NULL DEFAULT 1;
