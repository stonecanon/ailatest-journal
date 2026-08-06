-- Browser-extension quotas and device slots.
-- Anonymous requests use a hashed IP + install id scope; signed-in requests
-- use user id and are subject to the entitlement feature limits.
CREATE TABLE IF NOT EXISTS extension_usage (
  scope_key   TEXT NOT NULL,
  day         TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (scope_key, day)
);

CREATE TABLE IF NOT EXISTS extension_devices (
  user_id       INTEGER NOT NULL,
  install_id    TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, install_id)
);

CREATE INDEX IF NOT EXISTS idx_extension_usage_day
  ON extension_usage(day, scope_key);

CREATE INDEX IF NOT EXISTS idx_extension_devices_user_seen
  ON extension_devices(user_id, last_seen_at);
