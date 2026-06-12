ALTER TABLE journal_view_events ADD COLUMN journal_name TEXT DEFAULT '';
ALTER TABLE journal_view_events ADD COLUMN journal_issn TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_journal_view_events_source ON journal_view_events(view_source, viewed_at);
CREATE INDEX IF NOT EXISTS idx_journal_view_events_tab ON journal_view_events(tab, viewed_at);
