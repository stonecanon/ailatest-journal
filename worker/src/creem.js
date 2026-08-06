/**
 * Creem 支付：产品映射、Checkout、Webhook → 写权益
 * - Journal 产品 → user_entitlements（plus=Pro / pro=Max）
 * - Grant 产品  → product_memberships(product='grant')
 * 命名与 SKU 与 Todo 分离。
 */

import { applyPaidSubscription, revokePaidSubscription } from './entitlements.js';

const CREEM_API = 'https://api.creem.io';

/** 与 docs/entitlements.spec.json → billing.edu_verification.domain_whitelist 一致 */
export const EDU_DOMAIN_SUFFIXES = [
  '.edu.cn', '.edu', '.ac.uk', '.ac.jp', '.ac.kr',
  '.edu.au', '.edu.sg', '.edu.hk', '.edu.mo', '.edu.tw',
];

export function isEduEmail(email) {
  const m = String(email || '').trim().toLowerCase().match(/^[^@\s]+@([^@\s]+)$/);
  if (!m) return false;
  const domain = m[1];
  return EDU_DOMAIN_SUFFIXES.some((suf) => domain === suf.slice(1) || domain.endsWith(suf));
}

/** Journal 默认产品（可被 env.CREEM_*_PRODUCT_ID 覆盖） */
export const CREEM_PRODUCTS = {
  // 中国区：一次性 365 天通行证；与月付/年付 SKU 完全分开。
  pro_cn_365: {
    product_id: 'prod_3Mea8BVSYJ5nbVJeYQ3qWN',
    discount_code: '',
    tier: 'plus',
    period: 'one_time',
    duration_days: 365,
    one_time: true,
    edu: false,
  },
  max_cn_365: {
    product_id: 'prod_2OXrWFSu1RSxeJddAHUxcL',
    discount_code: '',
    tier: 'pro',
    period: 'one_time',
    duration_days: 365,
    one_time: true,
    edu: false,
  },
  pro_monthly: {
    product_id: 'prod_4U7xCv0XuvaQwngA8GzAwk',
    discount_code: 'JNPROM',
    tier: 'plus',
    period: 'month',
    edu: false,
    checkout_url: 'https://creem.io/product/prod_4U7xCv0XuvaQwngA8GzAwk?discount_code=JNPROM',
  },
  pro_yearly: {
    product_id: 'prod_4qPTXwWFki7H97CnEGg0UU',
    discount_code: 'JNPROY',
    tier: 'plus',
    period: 'year',
    edu: false,
    checkout_url: 'https://creem.io/product/prod_4qPTXwWFki7H97CnEGg0UU?discount_code=JNPROY',
  },
  max_monthly: {
    product_id: 'prod_4dQ8oxI13n13UujKijvupS',
    discount_code: 'JNMAXM',
    tier: 'pro',
    period: 'month',
    edu: false,
    checkout_url: 'https://creem.io/product/prod_4dQ8oxI13n13UujKijvupS?discount_code=JNMAXM',
  },
  max_yearly: {
    product_id: 'prod_5ndNsgM1cIcItVoNCpQxLK',
    discount_code: 'JNMAXY',
    tier: 'pro',
    period: 'year',
    edu: false,
    checkout_url: 'https://creem.io/product/prod_5ndNsgM1cIcItVoNCpQxLK?discount_code=JNMAXY',
  },
  pro_edu_monthly: {
    product_id: 'prod_2UjZDHaflN6qnqyPKsSWzu',
    discount_code: 'JNEPROM',
    tier: 'plus',
    period: 'month',
    edu: true,
    checkout_url: 'https://creem.io/product/prod_2UjZDHaflN6qnqyPKsSWzu?discount_code=JNEPROM',
  },
  pro_edu_yearly: {
    product_id: 'prod_2KUfnQxKKFYS2zIRX8bIyD',
    discount_code: 'JNEPROY',
    tier: 'plus',
    period: 'year',
    edu: true,
    checkout_url: 'https://creem.io/product/prod_2KUfnQxKKFYS2zIRX8bIyD?discount_code=JNEPROY',
  },
  max_edu_monthly: {
    product_id: 'prod_2Il9sgrjBPMbgCA4eALdCz',
    discount_code: 'JNEMAXM',
    tier: 'pro',
    period: 'month',
    edu: true,
    checkout_url: 'https://creem.io/product/prod_2Il9sgrjBPMbgCA4eALdCz?discount_code=JNEMAXM',
  },
  max_edu_yearly: {
    product_id: 'prod_1a4d3MaM7X10XbTUP6ixCW',
    discount_code: 'JNEMAXY',
    tier: 'pro',
    period: 'year',
    edu: true,
    checkout_url: 'https://creem.io/product/prod_1a4d3MaM7X10XbTUP6ixCW?discount_code=JNEMAXY',
  },
};

/**
 * Grant 产品目录（与 Journal 分离）。
 * product_id 默认空：需在 Creem 建品后写入 env CREEM_GRANT_*_PRODUCT_ID，
 * 或在部署前填入下方默认值（见 docs/CREEM_PRODUCTS.md / grant 仓库 docs）。
 */
export const GRANT_CREEM_PRODUCTS = {
  pro_monthly: {
    product_id: 'prod_wqMlq44x2Z1mmOGhIyyxi',
    discount_code: 'GRPROM',
    tier: 'plus',
    period: 'month',
    edu: false,
    checkout_url: 'https://creem.io/product/prod_wqMlq44x2Z1mmOGhIyyxi?discount_code=GRPROM',
  },
  pro_yearly: {
    product_id: 'prod_1FKHL9bMk6mVSwNpYOB5pB',
    discount_code: 'GRPROY',
    tier: 'plus',
    period: 'year',
    edu: false,
    checkout_url: 'https://creem.io/product/prod_1FKHL9bMk6mVSwNpYOB5pB?discount_code=GRPROY',
  },
  max_monthly: {
    product_id: 'prod_4WLAmX8fyShA0rav8X8kPo',
    discount_code: 'GRMAXM',
    tier: 'pro',
    period: 'month',
    edu: false,
    checkout_url: 'https://creem.io/product/prod_4WLAmX8fyShA0rav8X8kPo?discount_code=GRMAXM',
  },
  max_yearly: {
    product_id: 'prod_4DW4yl3zfcQR8SPDuzWz1u',
    discount_code: 'GRMAXY',
    tier: 'pro',
    period: 'year',
    edu: false,
    checkout_url: 'https://creem.io/product/prod_4DW4yl3zfcQR8SPDuzWz1u?discount_code=GRMAXY',
  },
  pro_edu_monthly: {
    product_id: 'prod_2DhAXcFRYCyHoi2aJSinhJ',
    discount_code: 'GREPROM',
    tier: 'plus',
    period: 'month',
    edu: true,
    checkout_url: 'https://creem.io/product/prod_2DhAXcFRYCyHoi2aJSinhJ?discount_code=GREPROM',
  },
  pro_edu_yearly: {
    product_id: 'prod_5J2FqPO8k4bssN4KKh3Lp6',
    discount_code: 'GREPROY',
    tier: 'plus',
    period: 'year',
    edu: true,
    checkout_url: 'https://creem.io/product/prod_5J2FqPO8k4bssN4KKh3Lp6?discount_code=GREPROY',
  },
  max_edu_monthly: {
    product_id: 'prod_4kuY9jhjzsqdDmFo1IFhJe',
    discount_code: 'GREMAXM',
    tier: 'pro',
    period: 'month',
    edu: true,
    checkout_url: 'https://creem.io/product/prod_4kuY9jhjzsqdDmFo1IFhJe?discount_code=GREMAXM',
  },
  max_edu_yearly: {
    product_id: 'prod_2DWHbc7FvP3iPM7o8YkljH',
    discount_code: 'GREMAXY',
    tier: 'pro',
    period: 'year',
    edu: true,
    checkout_url: 'https://creem.io/product/prod_2DWHbc7FvP3iPM7o8YkljH?discount_code=GREMAXY',
  },
};

function normalizeApp(app) {
  const a = String(app || 'journal').toLowerCase().trim();
  if (a === 'grant' || a === 'grants' || a === 'ailatest-grant') return 'grant';
  if (a === 'todo' || a === 'ailatest-todo') return 'todo';
  return 'journal';
}

function catalogForApp(app) {
  return normalizeApp(app) === 'grant' ? GRANT_CREEM_PRODUCTS : CREEM_PRODUCTS;
}

function productIdFromEnv(env, key, app = 'journal') {
  if (normalizeApp(app) === 'grant') {
    const map = {
      pro_monthly: env.CREEM_GRANT_PRO_MONTHLY_PRODUCT_ID,
      pro_yearly: env.CREEM_GRANT_PRO_YEARLY_PRODUCT_ID,
      max_monthly: env.CREEM_GRANT_MAX_MONTHLY_PRODUCT_ID,
      max_yearly: env.CREEM_GRANT_MAX_YEARLY_PRODUCT_ID,
      pro_edu_monthly: env.CREEM_GRANT_PRO_EDU_MONTHLY_PRODUCT_ID,
      pro_edu_yearly: env.CREEM_GRANT_PRO_EDU_YEARLY_PRODUCT_ID,
      max_edu_monthly: env.CREEM_GRANT_MAX_EDU_MONTHLY_PRODUCT_ID,
      max_edu_yearly: env.CREEM_GRANT_MAX_EDU_YEARLY_PRODUCT_ID,
    };
    const fromEnv = String(map[key] || '').trim();
    if (fromEnv) return fromEnv;
    return String(GRANT_CREEM_PRODUCTS[key]?.product_id || '').trim();
  }
  const map = {
    pro_cn_365: env.CREEM_PRO_CN_365_PRODUCT_ID,
    max_cn_365: env.CREEM_MAX_CN_365_PRODUCT_ID,
    pro_monthly: env.CREEM_PRO_MONTHLY_PRODUCT_ID,
    pro_yearly: env.CREEM_PRO_YEARLY_PRODUCT_ID,
    max_monthly: env.CREEM_MAX_MONTHLY_PRODUCT_ID,
    max_yearly: env.CREEM_MAX_YEARLY_PRODUCT_ID,
    pro_edu_monthly: env.CREEM_PRO_EDU_MONTHLY_PRODUCT_ID,
    pro_edu_yearly: env.CREEM_PRO_EDU_YEARLY_PRODUCT_ID,
    max_edu_monthly: env.CREEM_MAX_EDU_MONTHLY_PRODUCT_ID,
    max_edu_yearly: env.CREEM_MAX_EDU_YEARLY_PRODUCT_ID,
  };
  return String(map[key] || CREEM_PRODUCTS[key]?.product_id || '').trim();
}

function checkoutUrlFor(productId, discountCode) {
  if (!productId) return '';
  const base = `https://creem.io/product/${productId}`;
  return discountCode ? `${base}?discount_code=${encodeURIComponent(discountCode)}` : base;
}

export function resolveCreemPlan(env, { plan = 'pro', period = 'year', edu = false, app = 'journal', market = '' } = {}) {
  const appKey = normalizeApp(app);
  if (appKey === 'todo') return null;
  const catalog = catalogForApp(appKey);
  const p = plan === 'max' || plan === 'pro_max' ? 'max' : 'pro';
  const isChinaOneTime = appKey === 'journal'
    && (String(market || '').toLowerCase() === 'cn' || ['one_time', '365', '365days', '365_day'].includes(String(period || '').toLowerCase()));
  if (isChinaOneTime && edu) return null;
  if (isChinaOneTime) {
    const key = `${p}_cn_365`;
    const base = catalog[key];
    if (!base) return null;
    const product_id = productIdFromEnv(env, key, appKey) || base.product_id;
    return {
      ...base,
      key,
      app: appKey,
      market: 'cn',
      product_id,
      configured: !!product_id,
      checkout_url: checkoutUrlFor(product_id, base.discount_code),
    };
  }
  const y = period === 'month' || period === 'monthly' ? 'monthly' : 'yearly';
  const key = edu ? `${p}_edu_${y}` : `${p}_${y}`;
  const base = catalog[key];
  if (!base) return null;
  const product_id = productIdFromEnv(env, key, appKey) || base.product_id;
  if (!product_id) {
    return {
      ...base,
      key,
      app: appKey,
      product_id: '',
      checkout_url: '',
      configured: false,
    };
  }
  return {
    ...base,
    key,
    app: appKey,
    product_id,
    configured: true,
    checkout_url: checkoutUrlFor(product_id, base.discount_code),
  };
}

/** 缺 period_end 时按产品账单周期推算到期（月≈31 天，年≈366 天） */
function defaultPaidUntilSec(env, productId, nowSec) {
  const id = String(productId || '').trim();
  let period = 'year';
  for (const app of ['journal', 'grant']) {
    const catalog = catalogForApp(app);
    for (const key of Object.keys(catalog)) {
      if (productIdFromEnv(env, key, app) === id || catalog[key].product_id === id) {
        period = catalog[key].period;
        return nowSec + (period === 'month' ? 31 : period === 'one_time' ? 365 : 366) * 86400;
      }
    }
  }
  return nowSec + 366 * 86400;
}

/** @returns {{ tier: string, app: string, edu: boolean, key: string } | null} */
export function metaForProductId(env, productId) {
  const id = String(productId || '').trim();
  if (!id) return null;
  for (const app of ['journal', 'grant']) {
    const catalog = catalogForApp(app);
    for (const key of Object.keys(catalog)) {
      const pid = productIdFromEnv(env, key, app);
      if (pid && pid === id) {
        return { tier: catalog[key].tier, app, edu: !!catalog[key].edu, key, period: catalog[key].period, market: catalog[key].market || (key.endsWith('_cn_365') ? 'cn' : 'intl') };
      }
    }
    for (const [key, meta] of Object.entries(catalog)) {
      if (meta.product_id && meta.product_id === id) {
        return { tier: meta.tier, app, edu: !!meta.edu, key, period: meta.period, market: meta.market || (key.endsWith('_cn_365') ? 'cn' : 'intl') };
      }
    }
  }
  return null;
}

export function tierForProductId(env, productId) {
  return metaForProductId(env, productId)?.tier || null;
}

export function eduForProductId(env, productId) {
  return !!metaForProductId(env, productId)?.edu;
}

export function listCreemCatalog(env, appFilter) {
  const apps = appFilter ? [normalizeApp(appFilter)] : ['journal', 'grant'];
  const out = [];
  for (const app of apps) {
    if (app === 'todo') continue;
    const catalog = catalogForApp(app);
    for (const key of Object.keys(catalog)) {
      const base = catalog[key];
      const product_id = productIdFromEnv(env, key, app) || base.product_id || '';
      out.push({
        app,
        key,
        product_id,
        discount_code: base.discount_code,
        tier: base.tier,
        product_tier: base.tier === 'pro' ? 'max' : 'pro',
        period: base.period,
        market: base.market || (key.endsWith('_cn_365') ? 'cn' : 'intl'),
        duration_days: base.duration_days || null,
        one_time: !!base.one_time,
        edu: base.edu,
        configured: !!product_id,
        checkout_url: checkoutUrlFor(product_id, base.discount_code),
      });
    }
  }
  return out;
}

function asRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

function parsePeriodEndSec(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

async function verifyCreemSignature(body, signature, secret) {
  if (!/^[a-f0-9]{64}$/i.test(signature || '')) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  const hex = signature.toLowerCase();
  const received = new Uint8Array(hex.match(/.{2}/g).map((b) => Number.parseInt(b, 16)));
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ received[i];
  return diff === 0;
}

let creemTablesReady = false;
export async function ensureCreemTables(env) {
  if (creemTablesReady || !env?.DB) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS creem_subscriptions (
      user_id               INTEGER PRIMARY KEY,
      tier                  TEXT NOT NULL DEFAULT 'free',
      status                TEXT NOT NULL DEFAULT 'inactive',
      product_id            TEXT,
      creem_subscription_id TEXT,
      customer_id           TEXT,
      customer_email        TEXT,
      current_period_end    INTEGER,
      updated_at            INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS creem_webhook_events (
      event_id     TEXT PRIMARY KEY,
      event_type   TEXT NOT NULL,
      processed_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS product_memberships (
      user_id INTEGER NOT NULL,
      product TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'inactive',
      paid_until INTEGER,
      external_user_key TEXT,
      source TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, product)
    )`),
  ]);
  creemTablesReady = true;
}

async function findUserId(env, { userId, email }) {
  if (userId) {
    const n = Number(userId);
    if (Number.isFinite(n) && n > 0) {
      const row = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(n).first();
      if (row) return Number(row.id);
    }
  }
  const em = String(email || '').trim().toLowerCase();
  if (em) {
    const row = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?').bind(em).first();
    if (row) return Number(row.id);
  }
  return null;
}

/** 付款邮箱在统一账号库中不存在时自动建用户（Grant/跨产品 webhook 用） */
async function ensureUserByEmail(env, email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em || !em.includes('@')) return null;
  const existing = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?').bind(em).first();
  if (existing) return Number(existing.id);
  const now = Math.floor(Date.now() / 1000);
  const login = em.split('@')[0] || em;
  const ins = await env.DB.prepare(
    `INSERT INTO users (email, login, name, provider, created_at, updated_at)
     VALUES (?, ?, ?, 'creem', ?, ?)`
  ).bind(em, login, login, now, now).run();
  return Number(ins.meta.last_row_id) || null;
}

async function upsertGrantMembership(env, userId, { plan, status, paidUntilSec, source, email }) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO product_memberships (user_id, product, plan, status, paid_until, external_user_key, source, updated_at)
     VALUES (?, 'grant', ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(user_id, product) DO UPDATE SET
       plan = excluded.plan,
       status = excluded.status,
       paid_until = excluded.paid_until,
       source = excluded.source,
       updated_at = excluded.updated_at`
  ).bind(userId, plan, status, paidUntilSec || null, source || 'creem', now).run();

  // 同步到 Grant 站点本地会员表（Pages Functions /ailatest-auth-db），便于 /api/auth/me 立即生效
  const em = String(email || '').trim().toLowerCase();
  const grantSite = String(env.GRANT_SITE_URL || 'https://grant.ailatest.org').replace(/\/+$/, '');
  const syncSecret = String(
    env.ACCOUNT_SYNC_SECRET || env.TODO_INTERNAL_SECRET || env.GRANT_MEMBERSHIP_SYNC_SECRET || '',
  ).trim();
  if (em && grantSite && syncSecret) {
    try {
      await fetch(`${grantSite}/api/auth/internal/grant-membership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': syncSecret,
        },
        body: JSON.stringify({
          email: em,
          plan,
          status,
          paid_until: paidUntilSec || null,
          source: source || 'creem',
        }),
      });
    } catch (e) {
      console.error('grant membership sync failed', e?.message || e);
    }
  }
}

function b64UrlToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 兼容 Journal JWT 与 Grant Pages 共用/默认密钥 */
async function verifyJwtPayload(token, secret) {
  try {
    if (!token || !secret) return null;
    const [header, body, sig] = String(token).split('.');
    if (!header || !body || !sig) return null;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      b64UrlToBytes(sig),
      new TextEncoder().encode(`${header}.${body}`),
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64UrlToBytes(body)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Grant 站点 JWT 与 Journal 用户库可能不一致：按 Bearer 解析邮箱并 ensure 统一账号。
 */
async function resolveCheckoutUser(req, env, getUser) {
  const primary = getUser ? await getUser(req, env).catch(() => null) : null;
  if (primary) return primary;

  const h = req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) return null;

  const secrets = [
    env.JWT_SECRET,
    env.GRANT_JWT_SECRET,
    'AILATEST_SHARED_AUTH_SECRET',
  ].map((s) => String(s || '').trim()).filter(Boolean);

  for (const secret of secrets) {
    const payload = await verifyJwtPayload(token, secret);
    if (!payload) continue;
    const email = String(payload.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) continue;
    const userId = await ensureUserByEmail(env, email);
    if (!userId) continue;
    return {
      id: userId,
      email,
      login: email.split('@')[0] || email,
      name: String(payload.name || email.split('@')[0] || ''),
    };
  }
  return null;
}

/**
 * POST /checkout/creem  { plan, period, edu?, app? }
 * app: journal (默认) | grant
 */
export async function routeCreemCheckout(req, env, getUser) {
  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan || 'pro').toLowerCase();
  const period = String(body.period || 'year').toLowerCase();
  const market = String(body.market || '').toLowerCase();
  const edu = body.edu === true || body.edu === 1 || body.edu === '1';
  const app = normalizeApp(body.app || body.product || 'journal');
  const resolved = resolveCreemPlan(env, { plan, period, edu, app, market });
  if (!resolved) return { status: 400, body: { error: 'invalid plan' } };

  if (!resolved.configured || !resolved.product_id) {
    return {
      status: 503,
      body: {
        ok: false,
        error: app === 'grant' ? 'grant_products_not_configured' : 'product_not_configured',
        message: app === 'grant'
          ? 'Grant Creem products are not configured yet. Create SKUs and set CREEM_GRANT_*_PRODUCT_ID.'
          : resolved.market === 'cn'
            ? 'China one-time 365-day Creem SKU is not configured yet. Create a one-time product and set CREEM_PRO_CN_365_PRODUCT_ID / CREEM_MAX_CN_365_PRODUCT_ID.'
            : 'Creem product IDs are not configured.',
        app,
        key: resolved.key,
        market: resolved.market || 'intl',
      },
    };
  }

  const u = await resolveCheckoutUser(req, env, getUser);
  const apiKey = String(env.CREEM_API_KEY || '').trim();

  if (edu) {
    if (!u) {
      return {
        status: 401,
        body: {
          ok: false,
          error: 'login_required',
          message: 'Education pricing requires sign-in with an institutional email.',
        },
      };
    }
    if (!isEduEmail(u.email)) {
      return {
        status: 403,
        body: {
          ok: false,
          error: 'edu_email_required',
          message: 'Education pricing is only available for institutional emails (.edu / .edu.cn / .ac.uk, etc.).',
          email: u.email || null,
        },
      };
    }
  }

  if (!apiKey || !u) {
    return {
      status: 200,
      body: {
        ok: true,
        mode: u ? 'product_link' : 'product_link_login_recommended',
        checkout_url: resolved.checkout_url,
        product_id: resolved.product_id,
        discount_code: resolved.discount_code,
        tier: resolved.tier,
        app,
        market: resolved.market || 'intl',
        need_login: !u,
        edu: !!edu,
      },
    };
  }

  const successBase = app === 'grant'
    ? (env.GRANT_SITE_URL || 'https://grant.ailatest.org')
    : (env.SITE_URL || 'https://journal.ailatest.org');
  // 勿在 success_url 里带 #hash，否则 Creem 追加的 checkout_id 等 query 会丢
  const successPath = app === 'grant'
    ? '/?subscription=success'
    : '/account/?subscription=success';

  const payload = {
    product_id: resolved.product_id,
    discount_code: resolved.discount_code,
    success_url: `${successBase}${successPath}`,
    request_id: `${app === 'grant' ? 'gr' : 'jl'}_${u.id}_${Date.now()}`,
    customer: u.email ? { email: String(u.email).toLowerCase() } : undefined,
    metadata: {
      userId: String(u.id),
      email: u.email || '',
      plan: resolved.tier === 'pro' ? 'max' : 'pro',
      product_key: resolved.key,
      app: app === 'grant' ? 'ailatest-grant' : 'ailatest-journal',
    },
  };

  const resp = await fetch(`${CREEM_API}/v1/checkouts`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error('creem checkout failed', resp.status, data);
    return {
      status: 200,
      body: {
        ok: true,
        mode: 'product_link_fallback',
        checkout_url: resolved.checkout_url,
        product_id: resolved.product_id,
        app,
        error_detail: data?.message || data?.error || `http_${resp.status}`,
      },
    };
  }
  const url = data.checkout_url || data.url || resolved.checkout_url;
  return {
    status: 200,
    body: {
      ok: true,
      mode: 'checkout_session',
      checkout_url: url,
      checkout_id: data.id || null,
      product_id: resolved.product_id,
      discount_code: resolved.discount_code,
      app,
      market: resolved.market || 'intl',
    },
  };
}

export async function routeCreemCatalog(req, env) {
  const url = new URL(req.url);
  const app = url.searchParams.get('app') || '';
  return { status: 200, body: { ok: true, products: listCreemCatalog(env, app || undefined) } };
}

/**
 * 校验 Creem 支付成功回跳签名（用 API Key 作 salt，不需要 Webhook Secret）
 * 参数顺序必须与 URL 中出现顺序一致；空值跳过。
 * @see https://docs.creem.io/features/checkout/checkout-api
 */
export async function verifyCreemRedirectSignature(orderedPairs, signature, apiKey) {
  const sig = String(signature || '').trim().toLowerCase();
  if (!sig || !apiKey) return false;
  const parts = [];
  for (const [k, v] of orderedPairs) {
    if (k === 'signature') continue;
    if (v == null || v === '' || v === 'null') continue;
    parts.push(`${k}=${v}`);
  }
  parts.push(`salt=${apiKey}`);
  const data = parts.join('|');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const expected = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

async function creemGet(env, path) {
  const apiKey = String(env.CREEM_API_KEY || '').trim();
  if (!apiKey) return { ok: false, status: 0, data: null };
  const resp = await fetch(`${CREEM_API}${path}`, {
    headers: { 'x-api-key': apiKey },
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

/**
 * 根据 product_id 开通会员（Grant → product_memberships + 同步站点；Journal → entitlements）
 */
async function grantFromProduct(env, {
  productId,
  userId,
  email,
  paidUntilSec,
  source = 'creem_redirect',
}) {
  const meta = metaForProductId(env, productId);
  if (!meta) {
    return { ok: false, error: 'unknown_product', product_id: productId };
  }
  if (meta.edu && email && !isEduEmail(email)) {
    return { ok: false, error: 'edu_email_required', product_id: productId };
  }
  const productLabel = meta.tier === 'pro' ? 'max' : 'pro';
  const now = Math.floor(Date.now() / 1000);
  const until = paidUntilSec || defaultPaidUntilSec(env, productId, now);

  if (meta.app === 'grant') {
    await ensureCreemTables(env);
    await upsertGrantMembership(env, userId, {
      plan: productLabel,
      status: 'active',
      paidUntilSec: until,
      source,
      email,
    });
  } else {
    await applyPaidSubscription(env, userId, {
      tier: meta.tier,
      paidUntilSec: until,
      productId,
      eduVerified: !!meta.edu,
    });
  }
  return {
    ok: true,
    app: meta.app,
    plan: productLabel,
    tier: meta.tier,
    paid_until: until,
    product_id: productId,
  };
}

/**
 * POST /checkout/creem/confirm
 * 支付成功回跳后用 API Key 校验并开通会员（不依赖 Webhook Secret）
 * body 或 query: checkout_id, product_id, customer_id, order_id, subscription_id, signature, request_id, app
 */
export async function routeCreemConfirm(req, env, getUser) {
  const apiKey = String(env.CREEM_API_KEY || '').trim();
  if (!apiKey) {
    return { status: 503, body: { ok: false, error: 'creem_api_key_missing' } };
  }

  const url = new URL(req.url);
  let body = {};
  if (req.method === 'POST') {
    body = await req.json().catch(() => ({}));
  }

  // 保留 URL 参数出现顺序（签名校验需要）
  const orderedFromUrl = [];
  for (const [k, v] of url.searchParams.entries()) {
    orderedFromUrl.push([k, v]);
  }

  const pick = (key) => {
    if (body[key] != null && body[key] !== '') return String(body[key]);
    const q = url.searchParams.get(key);
    return q != null && q !== '' ? q : '';
  };

  const checkoutId = pick('checkout_id');
  let productId = pick('product_id');
  const customerId = pick('customer_id');
  const orderId = pick('order_id');
  const subscriptionId = pick('subscription_id');
  const requestId = pick('request_id');
  const signature = pick('signature');
  const appHint = normalizeApp(pick('app') || body.app || 'grant');

  const u = await resolveCheckoutUser(req, env, getUser);
  if (!u) {
    return {
      status: 401,
      body: {
        ok: false,
        error: 'login_required',
        message: 'Sign in with the same email used at checkout to activate membership.',
      },
    };
  }

  // 有 signature 则必须校验通过；无 signature 则后续靠 Creem API 拉订单核实
  if (signature) {
    let ordered = orderedFromUrl.length
      ? orderedFromUrl
      : [
        ['request_id', requestId],
        ['checkout_id', checkoutId],
        ['order_id', orderId],
        ['customer_id', customerId],
        ['subscription_id', subscriptionId],
        ['product_id', productId],
      ];
    // body 场景：前端可传 raw_query 保留顺序
    if (body.raw_query && typeof body.raw_query === 'string') {
      ordered = [];
      for (const pair of body.raw_query.replace(/^\?/, '').split('&')) {
        if (!pair) continue;
        const eq = pair.indexOf('=');
        const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
        const v = decodeURIComponent(eq >= 0 ? pair.slice(eq + 1) : '');
        ordered.push([k, v]);
      }
    }
    const valid = await verifyCreemRedirectSignature(ordered, signature, apiKey);
    if (!valid) {
      return { status: 401, body: { ok: false, error: 'invalid_redirect_signature' } };
    }
  }

  let paidUntilSec = null;
  let payEmail = String(u.email || '').toLowerCase().trim();

  // 优先用 checkout_id 向 Creem 核实
  if (checkoutId) {
    const got = await creemGet(env, `/v1/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`);
    // 部分环境用 path 形式
    const got2 = got.ok ? got : await creemGet(env, `/v1/checkouts/${encodeURIComponent(checkoutId)}`);
    const data = (got2.ok ? got2 : got).data || {};
    if (got.ok || got2.ok) {
      const status = String(data.status || data.checkout_status || '').toLowerCase();
      if (status === 'pending' || status === 'open' || status === 'expired' || status === 'failed') {
        return {
          status: 402,
          body: { ok: false, error: 'checkout_not_paid', status, checkout_id: checkoutId },
        };
      }
      const prod = data.product;
      const pid = typeof prod === 'string'
        ? prod
        : (prod?.id || data.product_id || productId);
      if (pid) productId = String(pid);
      const cust = data.customer;
      const cem = typeof cust === 'string' ? '' : (cust?.email || '');
      if (cem) payEmail = String(cem).toLowerCase().trim();
      const sub = asRecord(data.subscription);
      paidUntilSec = parsePeriodEndSec(
        sub.current_period_end_date
          ?? sub.current_period_end
          ?? data.current_period_end,
      );
    } else if (!signature && !productId) {
      return {
        status: 502,
        body: {
          ok: false,
          error: 'creem_checkout_fetch_failed',
          checkout_id: checkoutId,
          detail: data?.message || data?.error || `http_${got.status}`,
        },
      };
    }
  }

  // 仍无 product_id：按付款邮箱查 Creem 客户（尽力）
  if (!productId && payEmail) {
    const cust = await creemGet(env, `/v1/customers?email=${encodeURIComponent(payEmail)}`);
    if (cust.ok && cust.data) {
      // 响应可能是对象或带 subscriptions 的扩展字段
      const subs = cust.data.subscriptions || cust.data.subscription || [];
      const list = Array.isArray(subs) ? subs : (subs?.id ? [subs] : []);
      for (const s of list) {
        const prod = s.product;
        const pid = typeof prod === 'string' ? prod : (prod?.id || s.product_id);
        if (pid && metaForProductId(env, pid)) {
          productId = String(pid);
          paidUntilSec = parsePeriodEndSec(s.current_period_end_date ?? s.current_period_end) || paidUntilSec;
          break;
        }
      }
    }
  }

  if (!productId) {
    // 最后兜底：登录用户 + 有 signature/checkout 但缺 product 时，按 app 默认不猜套餐
    return {
      status: 400,
      body: {
        ok: false,
        error: 'missing_product_id',
        message: 'Could not determine purchased product. Open the success link from Creem again while signed in.',
        checkout_id: checkoutId || null,
      },
    };
  }

  // 防止用 Journal 商品开 Grant（除非 metadata 标明）
  const meta = metaForProductId(env, productId);
  if (!meta) {
    return { status: 400, body: { ok: false, error: 'unknown_product', product_id: productId } };
  }
  if (appHint === 'grant' && meta.app !== 'grant') {
    return {
      status: 400,
      body: { ok: false, error: 'product_app_mismatch', product_app: meta.app, expected: 'grant' },
    };
  }

  // 确保用登录邮箱写会员；付款邮箱不一致时仍以登录账号为准，但 edu 商品校验付款/登录邮箱
  const emailForGrant = payEmail || String(u.email || '').toLowerCase().trim();
  if (meta.edu && !isEduEmail(emailForGrant) && !isEduEmail(u.email)) {
    return { status: 403, body: { ok: false, error: 'edu_email_required' } };
  }

  const result = await grantFromProduct(env, {
    productId,
    userId: u.id,
    email: String(u.email || emailForGrant).toLowerCase().trim(),
    paidUntilSec,
    source: signature ? 'creem_redirect' : 'creem_api_confirm',
  });

  if (!result.ok) {
    return { status: 400, body: result };
  }

  return {
    status: 200,
    body: {
      ok: true,
      ...result,
      checkout_id: checkoutId || null,
      user_id: u.id,
      email: u.email,
    },
  };
}

/**
 * POST /webhooks/creem
 * Webhook Secret 可选：有则验签；没有则跳过（生产仍建议配置）
 */
export async function routeCreemWebhook(req, env) {
  const secret = String(env.CREEM_WEBHOOK_SECRET || '').trim();
  const signature = (req.headers.get('creem-signature') || '').trim().toLowerCase();
  const rawBody = await req.text();

  if (secret) {
    if (!signature || !(await verifyCreemSignature(rawBody, signature, secret))) {
      return { status: 401, body: { error: 'invalid_signature' } };
    }
  } else if (!String(env.CREEM_API_KEY || '').trim()) {
    // 既无 webhook secret 也无 API key，无法安全处理
    return { status: 503, body: { error: 'webhook_not_configured' } };
  }
  // 无 secret 时仍处理 body（主开通路径是 success 回跳 confirm）

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'invalid_json' } };
  }

  const eventId = String(event.id || '').trim();
  const eventType = String(event.eventType || event.event_type || '').trim();
  if (!eventId || !eventType || !event.object) {
    return { status: 400, body: { error: 'invalid_event' } };
  }

  await ensureCreemTables(env);
  const dup = await env.DB.prepare(
    'SELECT event_id FROM creem_webhook_events WHERE event_id = ?'
  ).bind(eventId).first();
  if (dup) return { status: 200, body: { ok: true, duplicate: true } };

  const object = asRecord(event.object);
  const nestedSub = asRecord(object.subscription);
  const isCheckout = object.object === 'checkout' || eventType.startsWith('checkout.');
  const subRoot = isCheckout ? nestedSub : object;

  const productRaw = object.product ?? subRoot.product ?? nestedSub.product;
  const product = typeof productRaw === 'string'
    ? { id: productRaw }
    : asRecord(productRaw);
  const productId = String(
    product.id
      || object.product_id
      || subRoot.product_id
      || (typeof nestedSub.product === 'string' ? nestedSub.product : '')
      || '',
  ).trim();

  const customerRaw = object.customer ?? subRoot.customer;
  const customer = typeof customerRaw === 'string'
    ? { id: customerRaw }
    : asRecord(customerRaw);

  const metadata = {
    ...asRecord(subRoot.metadata),
    ...asRecord(object.metadata),
  };

  const meta = metaForProductId(env, productId);
  if (!meta) {
    // 非 Journal/Grant 产品（如 Todo）→ 忽略
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO creem_webhook_events (event_id, event_type, processed_at) VALUES (?, ?, ?)'
    ).bind(eventId, eventType, now).run();
    return { status: 200, body: { ok: true, ignored: true, reason: 'unknown_or_foreign_product' } };
  }

  const { tier, app: productApp, edu: isEduSku } = meta;
  const payEmail = String(customer.email || metadata.email || '').trim().toLowerCase();

  if (isEduSku && !isEduEmail(payEmail)) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO creem_webhook_events (event_id, event_type, processed_at) VALUES (?, ?, ?)'
    ).bind(eventId, eventType, now).run().catch(() => {});
    console.error('creem edu product paid with non-edu email', { productId, payEmail, eventType, productApp });
    return {
      status: 200,
      body: {
        ok: true,
        ignored: true,
        reason: 'edu_email_required',
        hint: 'edu SKU requires institutional payer email; no entitlement granted',
      },
    };
  }

  let userId = await findUserId(env, {
    userId: metadata.userId || metadata.referenceId || metadata.user_id || metadata.internal_customer_id,
    email: customer.email || metadata.email,
  });
  // Grant：允许按付款邮箱自动建统一账号，避免 Pages 本地 auth 与 API 库未对齐
  if (!userId && productApp === 'grant' && payEmail) {
    userId = await ensureUserByEmail(env, payEmail);
  }
  if (!userId) {
    return { status: 422, body: { error: 'missing_user', hint: 'checkout with login or matching email' } };
  }

  const revokeEvents = new Set([
    'subscription.expired',
    'subscription.paused',
    'refund.created',
    'dispute.created',
  ]);
  const cancelEvents = new Set(['subscription.canceled']);
  const grantEvents = new Set([
    'subscription.paid',
    'subscription.active',
    'subscription.trialing',
    'subscription.update',
    'subscription.scheduled_cancel',
    'checkout.completed',
  ]);

  const now = Math.floor(Date.now() / 1000);
  let periodEnd = parsePeriodEndSec(
    subRoot.current_period_end_date
      ?? subRoot.current_period_end
      ?? nestedSub.current_period_end_date
      ?? nestedSub.current_period_end
      ?? object.current_period_end_date
      ?? object.current_period_end
      ?? subRoot.next_transaction_date,
  );

  let status = String(subRoot.status || object.status || 'active').toLowerCase();
  if (revokeEvents.has(eventType)) status = 'inactive';
  else if (cancelEvents.has(eventType)) status = 'canceled';
  else if (eventType === 'checkout.completed') status = status === 'completed' ? 'active' : status;

  const stillActive = grantEvents.has(eventType) && (
    ['active', 'paid', 'trialing', 'scheduled_cancel', 'completed'].includes(status)
    || (status === 'canceled' && periodEnd && periodEnd > now)
  ) || (
    status === 'canceled' && periodEnd && periodEnd > now
  );

  if (stillActive && !periodEnd) {
    periodEnd = defaultPaidUntilSec(env, productId, now);
  }

  const hardRevoke = revokeEvents.has(eventType)
    || (cancelEvents.has(eventType) && !(periodEnd && periodEnd > now));

  const productLabel = tier === 'pro' ? 'max' : 'pro';

  if (productApp === 'grant') {
    if (stillActive) {
      await upsertGrantMembership(env, userId, {
        plan: productLabel,
        status: 'active',
        paidUntilSec: periodEnd,
        source: 'creem',
        email: payEmail,
      });
    } else if (hardRevoke) {
      await upsertGrantMembership(env, userId, {
        plan: 'free',
        status: 'inactive',
        paidUntilSec: null,
        source: 'creem',
        email: payEmail,
      });
    }
  } else if (stillActive) {
    await applyPaidSubscription(env, userId, {
      tier,
      paidUntilSec: periodEnd,
      productId,
      eduVerified: isEduSku,
    });
  } else if (hardRevoke) {
    await revokePaidSubscription(env, userId);
  }

  const subId = String(
    subRoot.id || nestedSub.id || object.subscription_id || '',
  ).trim() || null;
  const custId = String(
    customer.id || object.customer_id || '',
  ).trim() || null;
  const recordedTier = stillActive || !hardRevoke ? tier : 'free';

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO creem_subscriptions (
        user_id, tier, status, product_id, creem_subscription_id, customer_id,
        customer_email, current_period_end, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        tier = excluded.tier,
        status = excluded.status,
        product_id = excluded.product_id,
        creem_subscription_id = excluded.creem_subscription_id,
        customer_id = excluded.customer_id,
        customer_email = excluded.customer_email,
        current_period_end = excluded.current_period_end,
        updated_at = excluded.updated_at`
    ).bind(
      userId,
      recordedTier,
      status,
      productId || null,
      subId,
      custId,
      String(customer.email || metadata.email || '').trim().toLowerCase() || null,
      periodEnd,
      now,
    ),
    env.DB.prepare(
      'INSERT INTO creem_webhook_events (event_id, event_type, processed_at) VALUES (?, ?, ?)'
    ).bind(eventId, eventType, now),
  ]);

  return {
    status: 200,
    body: {
      ok: true,
      user_id: userId,
      app: productApp,
      tier: hardRevoke ? 'free' : tier,
      product_tier: hardRevoke ? 'free' : productLabel,
      paid_until: periodEnd,
      granted: stillActive,
      revoked: hardRevoke,
    },
  };
}
