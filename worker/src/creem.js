/**
 * Creem 支付：产品映射、Checkout、Webhook → 写 user_entitlements
 * 产品与 Todo 分离（名称 / ID 均为 Journal）。
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

/** 默认产品（可被 env.CREEM_*_PRODUCT_ID 覆盖） */
export const CREEM_PRODUCTS = {
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

function productIdFromEnv(env, key) {
  const map = {
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

export function resolveCreemPlan(env, { plan = 'pro', period = 'year', edu = false } = {}) {
  const p = plan === 'max' || plan === 'pro_max' ? 'max' : 'pro';
  const y = period === 'month' || period === 'monthly' ? 'monthly' : 'yearly';
  const key = edu ? `${p}_edu_${y === 'monthly' ? 'monthly' : 'yearly'}` : `${p}_${y === 'monthly' ? 'monthly' : 'yearly'}`;
  const base = CREEM_PRODUCTS[key];
  if (!base) return null;
  const product_id = productIdFromEnv(env, key) || base.product_id;
  return {
    ...base,
    key,
    product_id,
    checkout_url: `https://creem.io/product/${product_id}?discount_code=${base.discount_code}`,
  };
}

/** 缺 period_end 时按产品账单周期推算到期（月≈31 天，年≈366 天） */
function defaultPaidUntilSec(env, productId, nowSec) {
  const id = String(productId || '').trim();
  let period = 'year';
  for (const key of Object.keys(CREEM_PRODUCTS)) {
    if (productIdFromEnv(env, key) === id || CREEM_PRODUCTS[key].product_id === id) {
      period = CREEM_PRODUCTS[key].period;
      break;
    }
  }
  const days = period === 'month' ? 31 : 366;
  return nowSec + days * 86400;
}

export function tierForProductId(env, productId) {
  const id = String(productId || '').trim();
  if (!id) return null;
  for (const key of Object.keys(CREEM_PRODUCTS)) {
    if (productIdFromEnv(env, key) === id) return CREEM_PRODUCTS[key].tier;
  }
  // fallback hardcoded
  for (const [key, meta] of Object.entries(CREEM_PRODUCTS)) {
    if (meta.product_id === id) return meta.tier;
  }
  return null;
}

export function eduForProductId(env, productId) {
  const id = String(productId || '').trim();
  for (const key of Object.keys(CREEM_PRODUCTS)) {
    if (productIdFromEnv(env, key) === id) return !!CREEM_PRODUCTS[key].edu;
  }
  for (const meta of Object.values(CREEM_PRODUCTS)) {
    if (meta.product_id === id) return !!meta.edu;
  }
  return false;
}

export function listCreemCatalog(env) {
  return Object.keys(CREEM_PRODUCTS).map((key) => {
    const base = CREEM_PRODUCTS[key];
    const product_id = productIdFromEnv(env, key) || base.product_id;
    return {
      key,
      product_id,
      discount_code: base.discount_code,
      tier: base.tier,
      product_tier: base.tier === 'pro' ? 'max' : 'pro',
      period: base.period,
      edu: base.edu,
      checkout_url: `https://creem.io/product/${product_id}?discount_code=${base.discount_code}`,
    };
  });
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

/**
 * POST /checkout/creem  { plan, period, edu? }
 * 登录用户：创建带 metadata.userId 的 Checkout；否则返回公开 product 链接。
 * 教育价：必须登录 + 机构邮箱，绝不返回公开 EDU 产品链接给非 edu 用户。
 */
export async function routeCreemCheckout(req, env, getUser) {
  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan || 'pro').toLowerCase();
  const period = String(body.period || 'year').toLowerCase();
  const edu = body.edu === true || body.edu === 1 || body.edu === '1';
  const resolved = resolveCreemPlan(env, { plan, period, edu });
  if (!resolved) return { status: 400, body: { error: 'invalid plan' } };

  const u = getUser ? await getUser(req, env).catch(() => null) : null;
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

  // 无 key 或未登录 → 公开链接（webhook 靠邮箱匹配）；教育价已在上方强制登录
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
        need_login: !u,
        edu: !!edu,
      },
    };
  }

  const payload = {
    product_id: resolved.product_id,
    discount_code: resolved.discount_code,
    success_url: `${env.SITE_URL || 'https://journal.ailatest.org'}/account/?subscription=success`,
    request_id: `jl_${u.id}_${Date.now()}`,
    customer: u.email ? { email: String(u.email).toLowerCase() } : undefined,
    metadata: {
      userId: String(u.id),
      email: u.email || '',
      plan: resolved.tier === 'pro' ? 'max' : 'pro',
      product_key: resolved.key,
      app: 'ailatest-journal',
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
    // 回退公开链接
    return {
      status: 200,
      body: {
        ok: true,
        mode: 'product_link_fallback',
        checkout_url: resolved.checkout_url,
        product_id: resolved.product_id,
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
    },
  };
}

export async function routeCreemCatalog(_req, env) {
  return { status: 200, body: { ok: true, products: listCreemCatalog(env) } };
}

/**
 * POST /webhooks/creem
 */
export async function routeCreemWebhook(req, env) {
  const secret = String(env.CREEM_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return { status: 503, body: { error: 'webhook_not_configured' } };
  }
  const signature = (req.headers.get('creem-signature') || '').trim().toLowerCase();
  const rawBody = await req.text();
  if (!signature || !(await verifyCreemSignature(rawBody, signature, secret))) {
    return { status: 401, body: { error: 'invalid_signature' } };
  }

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
  // checkout.completed: object=checkout（含 nested subscription/product/customer）
  // subscription.*: object=subscription 本体
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

  // metadata 可能在 checkout 或 subscription 上
  const metadata = {
    ...asRecord(subRoot.metadata),
    ...asRecord(object.metadata),
  };

  const tier = tierForProductId(env, productId);
  if (!tier) {
    // 非 Journal 产品（如 Todo）→ 忽略
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO creem_webhook_events (event_id, event_type, processed_at) VALUES (?, ?, ?)'
    ).bind(eventId, eventType, now).run();
    return { status: 200, body: { ok: true, ignored: true, reason: 'unknown_or_foreign_product' } };
  }

  const payEmail = String(customer.email || metadata.email || '').trim().toLowerCase();
  // 教育产品：付款邮箱也必须是机构域名，防止绕过前端拿公开链接
  if (eduForProductId(env, productId) && !isEduEmail(payEmail)) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO creem_webhook_events (event_id, event_type, processed_at) VALUES (?, ?, ?)'
    ).bind(eventId, eventType, now).run().catch(() => {});
    console.error('creem edu product paid with non-edu email', { productId, payEmail, eventType });
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

  const userId = await findUserId(env, {
    userId: metadata.userId || metadata.referenceId || metadata.user_id || metadata.internal_customer_id,
    email: customer.email || metadata.email,
  });
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
  // 权威开通：subscription.paid；同步也接受 active/trialing/checkout.completed
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
    // 取消但仍在账期内 → 保留权益到 period_end
    status === 'canceled' && periodEnd && periodEnd > now
  );

  // 缺 period_end 时按产品周期兜底，避免 paid_until=null 变成“永久”
  if (stillActive && !periodEnd) {
    periodEnd = defaultPaidUntilSec(env, productId, now);
  }

  const hardRevoke = revokeEvents.has(eventType)
    || (cancelEvents.has(eventType) && !(periodEnd && periodEnd > now));

  if (stillActive) {
    await applyPaidSubscription(env, userId, {
      tier,
      paidUntilSec: periodEnd,
      productId,
      eduVerified: eduForProductId(env, productId),
    });
  } else if (hardRevoke) {
    await revokePaidSubscription(env, userId);
  }
  // past_due 等：不立刻降级，等 expired/canceled

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
      tier: hardRevoke ? 'free' : tier,
      product_tier: hardRevoke ? 'free' : (tier === 'pro' ? 'max' : 'pro'),
      paid_until: periodEnd,
      granted: stillActive,
      revoked: hardRevoke,
    },
  };
}
