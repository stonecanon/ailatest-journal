-- 多收藏清单（每个用户可有多个 list，每个 list 一组 journal_key 顺序）
CREATE TABLE IF NOT EXISTS fav_lists (
  user_id     INTEGER NOT NULL,
  list_id     TEXT    NOT NULL,             -- 客户端生成的稳定 ID
  name        TEXT    NOT NULL,
  sort_index  INTEGER NOT NULL DEFAULT 0,   -- 清单在用户面板中的展示顺序
  ids_json    TEXT    NOT NULL DEFAULT '[]',-- JSON array of journal_key
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, list_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fav_lists_user ON fav_lists(user_id);
