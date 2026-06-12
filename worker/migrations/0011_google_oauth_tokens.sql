CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider       TEXT NOT NULL,
  account_email  TEXT NOT NULL,
  scope          TEXT,
  refresh_token  TEXT NOT NULL,
  access_token   TEXT,
  expires_at     INTEGER,
  updated_at     INTEGER NOT NULL,
  PRIMARY KEY (provider, account_email)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON oauth_tokens(provider, updated_at);
