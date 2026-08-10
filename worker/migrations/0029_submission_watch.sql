-- Automatic tracking metadata. The browser extension performs the authenticated
-- page read; Worker stores the watch state and emits notifications only when a
-- normalized status changes.
ALTER TABLE publication_submissions ADD COLUMN watch_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE publication_submissions ADD COLUMN notify_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE publication_submissions ADD COLUMN last_checked_at INTEGER;
ALTER TABLE publication_submissions ADD COLUMN last_error TEXT NOT NULL DEFAULT '';
