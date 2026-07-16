/**
 * 服务端 entitlements 判权 — 唯一权威实现。
 * 规则镜像 docs/entitlements.spec.json（SPEC_VERSION），改规则先改 spec 再同步这里。
 * 注意：注册不送 credits（spec 已移除 signup_bonus）；credits 仅来自
 * Pro(plus)=500 / Max(pro)=1000 月度额度、加油包购买、投稿记录贡献奖励。
 *
 * spec enforcement 四条规则的落点：
 *  1. 限额服务端写入时校验拒绝 → enforceFavoritesWrite / enforceListsWrite
 *  2. tier/trial_expires_at/edu_verified 为服务端字段，快照 ≤24h → getEntitlements 的 expires_at
 *  3. 匿名 24h 为纯客户端宽限期 → 服务端不涉及（无账号即无行）
 *  4. credits 扣减与调用同事务 → spendCredits 单语句条件更新（调用方失败时 refundCredits）
 */

export const SPEC_VERSION = '2026-07-15.9';

const TRIAL_DAYS = 7;
const SNAPSHOT_TTL_SEC = 24 * 3600;
const FLASH_OFFER_WINDOW_SEC = 24 * 3600;
/** 月度 AI credits（约 10 credits / 次完整荐刊） */
const PLUS_MONTHLY_CREDITS = 500;  // 产品名 Pro ≈ 50 次
const PRO_MONTHLY_CREDITS = 1000;  // 产品名 Max ≈ 100 次
const UPGRADE_URL = 'https://journal.ailatest.org/#pricing';
/** 收银台已接通 Creem；仍允许 free 直用（不自动 trial） */
const PRO_COMING_SOON = false;

const PREMIUM_LABELS_LOCKED = {
  cas_zone: false,
  cas_top: false,
  warning: false,
  citic_warning: false,
  under_review: false,
  on_hold: false,
  retraction: false,
  cnkx_tier: false,
  publish_fee: false, // 是否付费发表 / APC
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
  publish_fee: true,
};
/** 插件 Pro：中科院/新锐/发表费用；预警·撤稿·科协 仅 Max */
const PREMIUM_LABELS_EXT_PLUS = {
  cas_zone: true,
  cas_top: true,
  warning: false,
  citic_warning: false,
  under_review: false,
  on_hold: false,
  retraction: false,
  cnkx_tier: false,
  publish_fee: true,
};

// tier → 功能面。favorites 限额由服务端强制，其余开关下发给客户端渲染 UI。
const TIERS = {
  free: {
    badge_display: true,
    journal_detail: true,
    // 网站：查刊字段基本全开，但发表费用（是否免费发表/APC）对 Free 关闭
    premium_labels: { ...PREMIUM_LABELS_OPEN, publish_fee: false },
    publish_fee_info: false,
    favorites: { enabled: false, max_items: 0, max_lists: 0 },
    cloud_sync: false,
    tags: false,
    notes: false,
    submission_history: false,
    export: false,
    integrations: false,
    fulltext: { max_total: 30 }, // 原文/OA 全文查找终身累计篇数
    ai: { enabled: false },
    regions: {
      free_base: ['dom'],
      max_custom_pins: 0,
      daily_views: 3,
      unlock_all: false,
    },
    extension: {
      queries_per_day: 80,
      devices: 1,
      sites: 'basic',
      advanced_sort: false,
      premium_labels: PREMIUM_LABELS_LOCKED,
      fulltext: { max_total: 30 },
      export: false,
      integrations: false,
    },
  },
  plus: {
    // 产品名 Pro
    badge_display: true,
    journal_detail: true,
    premium_labels: PREMIUM_LABELS_OPEN,
    publish_fee_info: true,
    favorites: { enabled: true, max_items: 50, max_lists: 5 },
    cloud_sync: true,
    tags: false,
    notes: false,
    submission_history: false,
    // 导出 / 文献管理联动仅 Max
    export: false,
    integrations: false,
    fulltext: { max_per_month: 200 }, // 插件原文查找：Pro 每月 200 篇
    ai: { enabled: true, monthly_credits: PLUS_MONTHLY_CREDITS, credits_rollover: false },
    regions: {
      free_base: ['dom'],
      max_custom_pins: 2,
      daily_views: null,
      unlock_all: false,
    },
    extension: {
      queries_per_day: 20000,
      devices: 2,
      sites: 'basic', // 全站点增强识别（PubMed 等）仅 Max
      advanced_sort: true,
      premium_labels: PREMIUM_LABELS_EXT_PLUS,
      fulltext: { max_per_month: 200 },
      export: false,
      integrations: false,
    },
  },
  trial: {
    badge_display: true,
    journal_detail: true,
    premium_labels: PREMIUM_LABELS_OPEN,
    publish_fee_info: true,
    favorites: { enabled: true, max_items: null, max_lists: null },
    cloud_sync: true,
    tags: true,
    notes: true,
    submission_history: true,
    drag_sort: true,
    advanced_filters: true,
    export: { formats: ['csv', 'ris', 'bibtex', 'markdown', 'xlsx'] },
    integrations: ['zotero', 'notion', 'obsidian', 'endnote'],
    fulltext: { max_total: null },
    // trial 继承 pro 但 AI 锁定
    ai: { enabled: false, ui: 'visible_locked', locked_hint: 'AI 荐刊为订阅功能：Pro 500 / Max 1000 credits/月' },
    regions: { free_base: ['dom'], max_custom_pins: null, daily_views: null, unlock_all: true },
    extension: {
      queries_per_day: 50000,
      devices: 4,
      sites: 'enhanced',
      advanced_sort: true,
      premium_labels: PREMIUM_LABELS_OPEN,
      fulltext: { max_total: null },
      export: true,
      integrations: true,
    },
  },
  pro: {
    // 产品名 Max
    badge_display: true,
    journal_detail: true,
    premium_labels: PREMIUM_LABELS_OPEN,
    publish_fee_info: true,
    favorites: { enabled: true, max_items: null, max_lists: null },
    cloud_sync: true,
    tags: true,
    notes: true,
    submission_history: true,
    drag_sort: true,
    advanced_filters: true,
    export: { formats: ['csv', 'ris', 'bibtex', 'markdown', 'xlsx'] },
    integrations: ['zotero', 'notion', 'obsidian', 'endnote'],
    fulltext: { max_total: null },
    ai: { enabled: true, monthly_credits: PRO_MONTHLY_CREDITS, credits_rollover: false },
    regions: { free_base: ['dom'], max_custom_pins: null, daily_views: null, unlock_all: true },
    extension: {
      queries_per_day: 50000,
      devices: 4,
      sites: 'enhanced',
      advanced_sort: true,
      premium_labels: PREMIUM_LABELS_OPEN,
      fulltext: { max_total: null }, // Max 原文不限
      export: true,
      integrations: true,
    },
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
        paid_until       INTEGER,
        product_id       TEXT,
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
  // 存量表补列
  try { await env.DB.prepare('ALTER TABLE user_entitlements ADD COLUMN paid_until INTEGER').run(); } catch (_) {}
  try { await env.DB.prepare('ALTER TABLE user_entitlements ADD COLUMN product_id TEXT').run(); } catch (_) {}
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
    'SELECT tier, trial_started_at, trial_expires_at, trial_used, edu_verified, paid_until, product_id FROM user_entitlements WHERE user_id = ?'
  ).bind(userId).first();
}

/** trial / 付费到期 → 降级 free（数据冻结不删除，由写入路径的 enforce 实现） */
async function effectiveTier(env, userId, row) {
  const now = nowSec();
  if (!row) return 'free';
  // 付费档：paid_until 到期则降级
  if ((row.tier === 'plus' || row.tier === 'pro') && row.paid_until && now > Number(row.paid_until)) {
    await env.DB.prepare(
      "UPDATE user_entitlements SET tier='free', paid_until=NULL, product_id=NULL, updated_at=? WHERE user_id=? AND tier IN ('plus','pro')"
    ).bind(now, userId).run();
    return 'free';
  }
  // 付费档无 paid_until（手工开通 / 终身）→ 仍有效
  if (row.tier === 'plus' || row.tier === 'pro') return row.tier;
  if (PRO_COMING_SOON && row.tier !== 'pro' && row.tier !== 'plus') return 'free';
  if (row.tier === 'trial' && row.trial_expires_at && now > row.trial_expires_at) {
    await env.DB.prepare(
      "UPDATE user_entitlements SET tier='free', updated_at=? WHERE user_id=? AND tier='trial'"
    ).bind(now, userId).run();
    return 'free';
  }
  return TIERS[row.tier] ? row.tier : 'free';
}

/**
 * Creem 支付成功后写入权益。
 * @param {'plus'|'pro'} tier  产品档：plus=Pro, pro=Max
 * @param {number|null} paidUntilSec  周期结束 unix 秒；null 表示不设到期
 */
export async function applyPaidSubscription(env, userId, {
  tier,
  paidUntilSec = null,
  productId = null,
  eduVerified = null,
} = {}) {
  await ensureEntitlementsTables(env);
  if (tier !== 'plus' && tier !== 'pro') throw new Error('invalid tier');
  const now = nowSec();
  await env.DB.prepare(
    `INSERT INTO user_entitlements
       (user_id, tier, trial_started_at, trial_expires_at, trial_used, edu_verified, paid_until, product_id, updated_at)
     VALUES (?, ?, NULL, NULL, 0, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       tier = excluded.tier,
       paid_until = excluded.paid_until,
       product_id = excluded.product_id,
       edu_verified = CASE WHEN excluded.edu_verified = 1 THEN 1 ELSE user_entitlements.edu_verified END,
       updated_at = excluded.updated_at`
  ).bind(
    userId,
    tier,
    eduVerified ? 1 : 0,
    paidUntilSec,
    productId,
    now,
  ).run();

  // 立刻发放当月 credits（若本月尚未发放）
  const allowance = monthlyCreditsForTier(tier);
  if (allowance > 0) {
    const period = monthOf(now);
    await env.DB.prepare(
      'INSERT OR IGNORE INTO user_credits (user_id, monthly_credits, monthly_period, pack_credits, updated_at) VALUES (?, 0, ?, 0, ?)'
    ).bind(userId, period, now).run();
    const crow = await env.DB.prepare(
      'SELECT monthly_credits, monthly_period, pack_credits FROM user_credits WHERE user_id = ?'
    ).bind(userId).first();
    if (!crow || crow.monthly_period !== period || Number(crow.monthly_credits || 0) < allowance) {
      await env.DB.prepare(
        'UPDATE user_credits SET monthly_credits=?, monthly_period=?, updated_at=? WHERE user_id=?'
      ).bind(allowance, period, now, userId).run();
      await env.DB.prepare(
        'INSERT INTO credit_ledger (user_id, delta, balance_after, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(userId, allowance, allowance + Number(crow?.pack_credits || 0), 'subscription_grant', productId || period, now).run();
    }
  }
  return { ok: true, tier, paid_until: paidUntilSec };
}

/** 订阅过期 / 退款 → free */
export async function revokePaidSubscription(env, userId) {
  await ensureEntitlementsTables(env);
  const now = nowSec();
  await env.DB.prepare(
    "UPDATE user_entitlements SET tier='free', paid_until=NULL, product_id=NULL, updated_at=? WHERE user_id=?"
  ).bind(now, userId).run();
  return { ok: true, tier: 'free' };
}

/** 月度 AI credits：plus(Pro)=500 · pro(Max)=1000；换月重置不结转；free/trial 无月度额度 */
function monthlyCreditsForTier(tier) {
  if (tier === 'pro') return PRO_MONTHLY_CREDITS;
  if (tier === 'plus') return PLUS_MONTHLY_CREDITS;
  return 0;
}

async function getCredits(env, userId, tier) {
  const now = nowSec();
  const period = monthOf(now);
  const allowance = monthlyCreditsForTier(tier);
  let row = await env.DB.prepare(
    'SELECT monthly_credits, monthly_period, pack_credits FROM user_credits WHERE user_id = ?'
  ).bind(userId).first();
  if (!row) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO user_credits (user_id, monthly_credits, monthly_period, pack_credits, updated_at) VALUES (?, 0, ?, 0, ?)'
    ).bind(userId, period, now).run();
    row = { monthly_credits: 0, monthly_period: period, pack_credits: 0 };
  }
  if (allowance > 0 && row.monthly_period !== period) {
    await env.DB.prepare(
      'UPDATE user_credits SET monthly_credits=?, monthly_period=?, updated_at=? WHERE user_id=?'
    ).bind(allowance, period, now, userId).run();
    await env.DB.prepare(
      'INSERT INTO credit_ledger (user_id, delta, balance_after, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, allowance, allowance + row.pack_credits, 'monthly_refill', period, now).run();
    row.monthly_credits = allowance;
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
    // 站长 = 产品 Max（内部 tier=pro）+ 无限 credits
    return {
      spec_version: SPEC_VERSION,
      tier: 'pro',
      product_tier: 'max',
      plan: 'owner',
      is_owner: true,
      trial_expires_at: null,
      paid_until: null,
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
    product_tier: tier === 'pro' ? 'max' : tier === 'plus' ? 'pro' : 'free',
    pro_status: 'active',
    trial_expires_at: row.trial_expires_at || null,
    paid_until: row.paid_until || null,
    product_id: row.product_id || null,
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
  const favFeat = ents.features.favorites || {};
  if (favFeat.enabled === false) {
    return limitError('免费版不支持云收藏，请升级 Pro', ents.tier, 0);
  }
  const limit = favFeat.max_items;
  if (limit === 0 && newKeys.length > 0) {
    return limitError('免费版不支持云收藏，请升级 Pro', ents.tier, 0);
  }
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
  const favFeat = ents.features.favorites || {};
  if (favFeat.enabled === false) {
    return limitError('免费版不支持清单，请升级 Pro', ents.tier, 0);
  }
  const { max_items: itemLimit, max_lists: listLimit } = favFeat;

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
