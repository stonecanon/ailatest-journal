/**
 * 服务端 entitlements 判权 — 唯一权威实现。
 * 规则镜像 docs/entitlements.spec.json（SPEC_VERSION），改规则先改 spec 再同步这里。
 * 注意：注册不送 credits（spec 2026-06-12.4 已移除 signup_bonus）；credits 仅来自
 * Pro 月度额度 / 加油包购买 / 投稿记录贡献奖励。
 *
 * spec enforcement 四条规则的落点：
 *  1. 限额服务端写入时校验拒绝 → enforceFavoritesWrite / enforceListsWrite
 *  2. tier/trial_expires_at/edu_verified 为服务端字段，快照 ≤24h → getEntitlements 的 expires_at
 *  3. 匿名 24h 为纯客户端宽限期 → 服务端不涉及（无账号即无行）
 *  4. credits 扣减与调用同事务 → spendCredits 单语句条件更新（调用方失败时 refundCredits）
 */

export const SPEC_VERSION = '2026-07-15.1';

const TRIAL_DAYS = 7;
const SNAPSHOT_TTL_SEC = 24 * 3600;
const FLASH_OFFER_WINDOW_SEC = 24 * 3600;
/** Max/Pro 顶档月度 AI credits（DeepSeek V4 Flash：1000 ≈ 100 次完整荐刊，满用 API ≈ ¥0.8/月） */
const PRO_MONTHLY_CREDITS = 1000;
const UPGRADE_URL = 'https://journal.ailatest.org/pricing.html';
const PRO_COMING_SOON = true;

const PREMIUM_LABELS_LOCKED = {
  cas_zone: false,
  cas_top: false,
  warning: false,
  citic_warning: false,
  under_review: false,
  on_hold: false,
  retraction: false,
  cnkx_tier: false,
};
const PREMIUM_LABELS_OPEN = {
  cas_zone: true,
  cas_top: true,
  warning: true,
  citic_warning: true,
  under_review: true,
  on_hold: true,
  retraction: true,
  cnkx_tier: true,
};

// tier → 功能面。favorites 限额由服务端强制，其余开关下发给客户端渲染 UI。
const TIERS = {
  free: {
    badge_display: true,
    journal_detail: true,
    premium_labels: PREMIUM_LABELS_LOCKED,
    favorites: { max_items: 5, max_lists: 2 },
    cloud_sync: true,
    tags: false,
    notes: false,
    submission_history: false,
    export: false,
    integrations: false,
    ai: { enabled: false },
    extension: { queries_per_day: 80, devices: 1, sites: 'basic', advanced_sort: false },
  },
  plus: {
    badge_display: true,
    journal_detail: true,
    premium_labels: PREMIUM_LABELS_OPEN,
    favorites: { max_items: 50, max_lists: 5 },
    cloud_sync: true,
    tags: false,
    notes: false,
    submission_history: false,
    export: false,
    integrations: false,
    ai: { enabled: false },
    extension: { queries_per_day: 20000, devices: 2, sites: 'enhanced', advanced_sort: true },
  },
  trial: {
    badge_display: true,
    journal_detail: true,
    premium_labels: PREMIUM_LABELS_OPEN,
    favorites: { max_items: null, max_lists: null },
    cloud_sync: true,
    tags: true,
    notes: true,
    submission_history: true,
    drag_sort: true,
    advanced_filters: true,
    export: { formats: ['csv', 'ris', 'bibtex', 'xlsx'] },
    integrations: ['zotero', 'notion', 'endnote', 'obsidian'],
    // trial 继承 pro 但 AI 锁定
    ai: { enabled: false, ui: 'visible_locked', locked_hint: 'AI 荐刊为 Max 功能，订阅后每月含 1000 credits' },
    extension: { queries_per_day: 50000, devices: 4, sites: 'enhanced', advanced_sort: true },
  },
  pro: {
    badge_display: true,
    journal_detail: true,
    premium_labels: PREMIUM_LABELS_OPEN,
    favorites: { max_items: null, max_lists: null },
    cloud_sync: true,
    tags: true,
    notes: true,
    submission_history: true,
    drag_sort: true,
    advanced_filters: true,
    export: { formats: ['csv', 'ris', 'bibtex', 'xlsx'] },
    integrations: ['zotero', 'notion', 'endnote', 'obsidian'],
    ai: { enabled: true, monthly_credits: PRO_MONTHLY_CREDITS, credits_rollover: false },
    extension: { queries_per_day: 50000, devices: 4, sites: 'enhanced', advanced_sort: true },
  },
};

const nowSec = () => Math.floor(Date.now() / 1000);
const monthOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 7);

let schemaReady = false;
export async function ensureEntitlementsTables(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS user_entitlements (
        user_id          INTEGER PRIMARY KEY,
        tier             TEXT    NOT NULL DEFAULT 'free',
        trial_started_at INTEGER,
        trial_expires_at INTEGER,
        trial_used       INTEGER NOT NULL DEFAULT 0,
        edu_verified     INTEGER NOT NULL DEFAULT 0,
        updated_at       INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS user_credits (
        user_id         INTEGER PRIMARY KEY,
        monthly_credits INTEGER NOT NULL DEFAULT 0,
        monthly_period  TEXT    NOT NULL DEFAULT '',
        pack_credits    INTEGER NOT NULL DEFAULT 0,
        updated_at      INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS credit_ledger (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL,
        delta         INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reason        TEXT    NOT NULL,
        ref           TEXT,
        created_at    INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id, created_at)'),
  ]);
  schemaReady = true;
}

/**
 * 注册时调用（也被 getEntitlements 懒触发，覆盖此功能上线前的存量用户）。
 * 新行即激活一次性 7 天 trial；trial_used 保证一个账号仅一次。
 */
export async function activateTrialForNewUser(env, userId) {
  await ensureEntitlementsTables(env);
  const now = nowSec();
  if (PRO_COMING_SOON) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO user_entitlements
         (user_id, tier, trial_started_at, trial_expires_at, trial_used, edu_verified, updated_at)
       VALUES (?, 'free', NULL, NULL, 0, 0, ?)`
    ).bind(userId, now).run();
    return;
  }
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_entitlements
       (user_id, tier, trial_started_at, trial_expires_at, trial_used, edu_verified, updated_at)
     VALUES (?, 'trial', ?, ?, 1, 0, ?)`
  ).bind(userId, now, now + TRIAL_DAYS * 86400, now).run();
}

async function getOrCreateRow(env, userId) {
  await activateTrialForNewUser(env, userId); // INSERT OR IGNORE：已有行时是空操作
  return env.DB.prepare(
    'SELECT tier, trial_started_at, trial_expires_at, trial_used, edu_verified FROM user_entitlements WHERE user_id = ?'
  ).bind(userId).first();
}

/** trial 到期 → 降级 free（数据冻结不删除，由写入路径的 enforce 实现） */
async function effectiveTier(env, userId, row) {
  const now = nowSec();
  // 付费通道未开时，除已手工标 pro/plus 外一律 free
  if (PRO_COMING_SOON && row.tier !== 'pro' && row.tier !== 'plus') return 'free';
  if (row.tier === 'trial' && row.trial_expires_at && now > row.trial_expires_at) {
    await env.DB.prepare(
      "UPDATE user_entitlements SET tier='free', updated_at=? WHERE user_id=? AND tier='trial'"
    ).bind(now, userId).run();
    return 'free';
  }
  return TIERS[row.tier] ? row.tier : 'free';
}

/** Pro 月度额度：换月时重置为 PRO_MONTHLY_CREDITS（不结转）；free/plus/trial 无月度额度 */
async function getCredits(env, userId, tier) {
  const now = nowSec();
  const period = monthOf(now);
  let row = await env.DB.prepare(
    'SELECT monthly_credits, monthly_period, pack_credits FROM user_credits WHERE user_id = ?'
  ).bind(userId).first();
  if (!row) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO user_credits (user_id, monthly_credits, monthly_period, pack_credits, updated_at) VALUES (?, 0, ?, 0, ?)'
    ).bind(userId, period, now).run();
    row = { monthly_credits: 0, monthly_period: period, pack_credits: 0 };
  }
  if (tier === 'pro' && row.monthly_period !== period) {
    await env.DB.prepare(
      'UPDATE user_credits SET monthly_credits=?, monthly_period=?, updated_at=? WHERE user_id=?'
    ).bind(PRO_MONTHLY_CREDITS, period, now, userId).run();
    await env.DB.prepare(
      'INSERT INTO credit_ledger (user_id, delta, balance_after, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, PRO_MONTHLY_CREDITS, PRO_MONTHLY_CREDITS + row.pack_credits, 'monthly_refill', period, now).run();
    row.monthly_credits = PRO_MONTHLY_CREDITS;
  }
  return { monthly: row.monthly_credits, pack: row.pack_credits, total: row.monthly_credits + row.pack_credits };
}

/**
 * 权限快照（客户端用来渲染 UI，有效期 ≤24h；一切写入仍由服务端校验）。
 * isOwner 由调用方判定（index.js 的 isOwnerUser）。
 */
export async function getEntitlements(env, user, isOwner = false) {
  await ensureEntitlementsTables(env);
  const now = nowSec();

  if (isOwner) {
    return {
      spec_version: SPEC_VERSION,
      tier: 'pro',
      plan: 'owner',
      trial_expires_at: null,
      edu_verified: true,
      features: TIERS.pro,
      credits: { monthly: null, pack: null, total: null, unlimited: true },
      generated_at: now,
      expires_at: now + SNAPSHOT_TTL_SEC,
    };
  }

  const row = await getOrCreateRow(env, user.id);
  const tier = await effectiveTier(env, user.id, row);
  const credits = await getCredits(env, user.id, tier);

  const snapshot = {
    spec_version: SPEC_VERSION,
    tier,
    pro_status: PRO_COMING_SOON ? 'coming_soon' : 'active',
    trial_expires_at: row.trial_expires_at || null,
    edu_verified: !!row.edu_verified,
    features: TIERS[tier],
    credits,
    generated_at: now,
    expires_at: now + SNAPSHOT_TTL_SEC,
  };

  // trial 到期 24h 内且未教育认证 → 下发限时年付优惠（spec: on_expire.conversion_offer）
  if (tier === 'free' && row.trial_used && row.trial_expires_at
      && now - row.trial_expires_at < FLASH_OFFER_WINDOW_SEC && !row.edu_verified) {
    snapshot.offer = { price_id: 'pro_annual_flash', expires_at: row.trial_expires_at + FLASH_OFFER_WINDOW_SEC };
  }
  return snapshot;
}

function limitError(message, tier, limit) {
  return {
    ok: false,
    status: 403,
    body: { error: message, code: 'limit_exceeded', tier, limit, upgrade: UPGRADE_URL },
  };
}

/**
 * PUT /favorites 整组替换的限额校验。
 * 规则：数量 ≤ 上限放行；超上限时仅当没有新增（删除/排序）才放行 —— 即
 * spec 的冻结策略 favorites_over_limit: read_write_existing, no_new_adds。
 */
export async function enforceFavoritesWrite(env, user, isOwner, newKeys) {
  const ents = await getEntitlements(env, user, isOwner);
  const limit = ents.features.favorites.max_items;
  if (limit == null || newKeys.length <= limit) return { ok: true };

  const rows = await env.DB.prepare(
    'SELECT journal_key FROM favorites WHERE user_id = ?'
  ).bind(user.id).all();
  const existing = new Set((rows.results || []).map((r) => r.journal_key));
  const adds = newKeys.filter((k) => !existing.has(k));
  if (adds.length === 0) return { ok: true };
  return limitError(`免费版收藏上限 ${limit} 本：现有收藏可管理，新增需升级 Pro`, ents.tier, limit);
}

/**
 * PUT /lists 整组替换的限额校验。
 * 清单数 ≤ 上限放行；超上限时只允许删除（子集）且保留的清单内容不变
 * —— spec 的冻结策略 lists_over_limit: read_only。
 * 同时校验跨清单去重后的收藏总数（与 favorites 同一限额与冻结规则）。
 */
export async function enforceListsWrite(env, user, isOwner, cleanLists) {
  const ents = await getEntitlements(env, user, isOwner);
  const { max_items: itemLimit, max_lists: listLimit } = ents.features.favorites;

  if (listLimit != null && cleanLists.length > listLimit) {
    const rows = await env.DB.prepare(
      'SELECT list_id, name, ids_json FROM fav_lists WHERE user_id = ?'
    ).bind(user.id).all();
    const existing = new Map((rows.results || []).map((r) => [r.list_id, r]));
    for (const l of cleanLists) {
      const old = existing.get(l.id);
      if (!old) return limitError(`免费版清单上限 ${listLimit} 个：新建清单需升级 Pro`, ents.tier, listLimit);
      let oldIds = [];
      try { oldIds = JSON.parse(old.ids_json) || []; } catch (_) {}
      if (old.name !== l.name || JSON.stringify(oldIds) !== JSON.stringify(l.ids)) {
        return limitError(`超出免费版清单上限的清单为只读：删除部分清单或升级 Pro 后可编辑`, ents.tier, listLimit);
      }
    }
  }

  if (itemLimit != null) {
    const union = [...new Set(cleanLists.flatMap((l) => l.ids))];
    if (union.length > itemLimit) {
      const rows = await env.DB.prepare(
        'SELECT ids_json FROM fav_lists WHERE user_id = ?'
      ).bind(user.id).all();
      const existing = new Set();
      for (const r of rows.results || []) {
        try { for (const id of JSON.parse(r.ids_json) || []) existing.add(id); } catch (_) {}
      }
      if (union.some((id) => !existing.has(id))) {
        return limitError(`免费版收藏上限 ${itemLimit} 本：现有收藏可管理，新增需升级 Pro`, ents.tier, itemLimit);
      }
    }
  }
  return { ok: true };
}

/**
 * 扣减 credits（AI 调用前）。单条条件 UPDATE 保证不超扣；先扣月度额度再扣加油包。
 * 返回 { ok, monthly, pack, total }；余额不足返回 { ok:false }。
 * 调用方在 LLM 失败时用 refundCredits 退回。
 */
export async function spendCredits(env, user, isOwner, amount, reason, ref = '') {
  if (isOwner) return { ok: true, unlimited: true };
  await ensureEntitlementsTables(env);
  const now = nowSec();
  const res = await env.DB.prepare(
    `UPDATE user_credits SET
       monthly_credits = monthly_credits - MIN(monthly_credits, ?1),
       pack_credits    = pack_credits - (?1 - MIN(monthly_credits, ?1)),
       updated_at      = ?2
     WHERE user_id = ?3 AND monthly_credits + pack_credits >= ?1`
  ).bind(amount, now, user.id).run();
  if (!res.meta.changes) return { ok: false, error: 'credits 余额不足', code: 'insufficient_credits' };

  const row = await env.DB.prepare(
    'SELECT monthly_credits, pack_credits FROM user_credits WHERE user_id = ?'
  ).bind(user.id).first();
  const total = (row?.monthly_credits || 0) + (row?.pack_credits || 0);
  await env.DB.prepare(
    'INSERT INTO credit_ledger (user_id, delta, balance_after, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.id, -amount, total, reason, ref, now).run();
  return { ok: true, monthly: row?.monthly_credits || 0, pack: row?.pack_credits || 0, total };
}

/** 加 credits：加油包购买 / 贡献奖励 / 失败退款（退回加油包侧，避免月底被清） */
export async function grantCredits(env, userId, amount, reason, ref = '') {
  await ensureEntitlementsTables(env);
  const now = nowSec();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO user_credits (user_id, monthly_credits, monthly_period, pack_credits, updated_at) VALUES (?, 0, ?, 0, ?)'
  ).bind(userId, monthOf(now), now).run();
  await env.DB.prepare(
    'UPDATE user_credits SET pack_credits = pack_credits + ?, updated_at = ? WHERE user_id = ?'
  ).bind(amount, now, userId).run();
  const row = await env.DB.prepare(
    'SELECT monthly_credits, pack_credits FROM user_credits WHERE user_id = ?'
  ).bind(userId).first();
  const total = (row?.monthly_credits || 0) + (row?.pack_credits || 0);
  await env.DB.prepare(
    'INSERT INTO credit_ledger (user_id, delta, balance_after, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, amount, total, reason, ref, now).run();
  return { ok: true, total };
}

export const refundCredits = (env, userId, amount, ref = '') =>
  grantCredits(env, userId, amount, 'refund', ref);
