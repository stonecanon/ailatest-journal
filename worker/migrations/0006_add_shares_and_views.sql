-- 0006: shares (一键分享收藏夹) + journal_views (期刊浏览计数)

-- 分享出去的收藏夹快照（短链）
CREATE TABLE IF NOT EXISTS shares (
  id          TEXT    PRIMARY KEY,         -- 8 位 base62 短码
  owner_uid   INTEGER NOT NULL,
  owner_name  TEXT,                        -- 冗余，给受众展示用
  name        TEXT    NOT NULL,            -- 收藏夹名称（快照）
  items_json  TEXT    NOT NULL,            -- JSON array of journal_key (ISSN 等)
  view_count  INTEGER NOT NULL DEFAULT 0,
  import_count INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER,                     -- NULL = 永久
  FOREIGN KEY (owner_uid) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shares_owner   ON shares(owner_uid);
CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at);

-- 期刊维度浏览计数（详情抽屉打开 / 列表 viewport 触发）
CREATE TABLE IF NOT EXISTS journal_views (
  journal_key TEXT    PRIMARY KEY,         -- ISSN / cn_code
  count       INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);
