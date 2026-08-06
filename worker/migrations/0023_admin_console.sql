-- Unified owner console for every AILatest project.
-- The Worker also creates these tables lazily so an older D1 can be upgraded
-- without blocking normal public traffic.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON admin_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS project_registry (
  project_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  host TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'product',
  status TEXT NOT NULL DEFAULT 'active',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_registry_status
  ON project_registry(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS content_overrides (
  project_id TEXT NOT NULL,
  record_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  payload_json TEXT NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT '',
  updated_by INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, record_key)
);

CREATE INDEX IF NOT EXISTS idx_content_overrides_project
  ON content_overrides(project_id, updated_at DESC);
