ALTER TABLE page_events ADD COLUMN site TEXT;

CREATE INDEX IF NOT EXISTS idx_page_events_site_day ON page_events(site, day);
