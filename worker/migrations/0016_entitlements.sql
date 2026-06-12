-- Entitlements 判权：tier / 试用 / credits（规则唯一来源 docs/entitlements.spec.json v2026-06-12.4）
-- 注意：注册不送 credits（spec 已移除 signup_bonus）。
-- 独立表而非 ALTER users：与 user_quotas/pick_usage 的运行时 ensure 模式保持一致。

CREATE TABLE IF NOT EXISTS user_entitlements (
  user_id          INTEGER PRIMARY KEY,
  tier             TEXT    NOT NULL DEFAULT 'free',   -- free | trial | pro
  trial_started_at INTEGER,
  trial_expires_at INTEGER,
  trial_used       INTEGER NOT NULL DEFAULT 0,        -- 一个账号仅一次
  edu_verified     INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- credits 余额：月度额度（月底清零，不结转）与加油包（永不过期）分开记
CREATE TABLE IF NOT EXISTS user_credits (
  user_id         INTEGER PRIMARY KEY,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  monthly_period  TEXT    NOT NULL DEFAULT '',        -- 'YYYY-MM'，换月时重置
  pack_credits    INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- credits 流水（审计与对账；消耗顺序：先月度额度，再加油包）
CREATE TABLE IF NOT EXISTS credit_ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  delta         INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason        TEXT    NOT NULL,                     -- monthly_refill | pack_purchase | ai_spend | contribution_reward | refund
  ref           TEXT,
  created_at    INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id, created_at);
