/**
 * Google Play subscriptions for the Android client.
 *
 * The app only forwards a purchase token. This Worker verifies the token with
 * the Google Play Developer API, acknowledges the purchase, and writes the
 * same user_entitlements row used by Creem/web checkout. RTDN can refresh the
 * row after renewals, cancellations, grace-period changes, and expiry.
 */

import { applyPaidSubscription, getEntitlements } from './entitlements.js';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_PUBLISHER_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const DEFAULT_PACKAGE_NAME = 'org.ailatest.journal';

let accessTokenCache = { value: '', expiresAt: 0 };
let googlePlayTablesReady = false;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Google-Play-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
  },
});

const error = (message, status = 400, extra = {}) => json({ ok: false, error: message, ...extra }, status);

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function b64urlBytes(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlJson(value) {
  return b64urlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToBytes(pem) {
  const base64 = String(pem || '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function signServiceAccountJwt(serviceAccount) {
  const header = b64urlJson({ alg: 'RS256', typ: 'JWT' });
  const issuedAt = nowSec();
  const payload = b64urlJson({
    iss: serviceAccount.client_email,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_ENDPOINT,
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(input),
  );
  return `${input}.${b64urlBytes(new Uint8Array(signature))}`;
}

function serviceAccountFromEnv(env) {
  const raw = String(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is invalid JSON');
  }
  if (!parsed.client_email || !parsed.private_key) throw new Error('Google Play service account is incomplete');
  return parsed;
}

async function googleAccessToken(env, forceRefresh = false) {
  if (!forceRefresh && accessTokenCache.value && accessTokenCache.expiresAt > nowSec() + 60) {
    return accessTokenCache.value;
  }
  const assertion = await signServiceAccountJwt(serviceAccountFromEnv(env));
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(`Google OAuth ${response.status}: ${data.error_description || data.error || 'token request failed'}`);
  }
  accessTokenCache = {
    value: data.access_token,
    expiresAt: nowSec() + Number(data.expires_in || 3600),
  };
  return accessTokenCache.value;
}

async function googlePublisherFetch(env, path, init = {}, retried = false) {
  const token = await googleAccessToken(env, retried);
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  const response = await fetch(`${GOOGLE_PUBLISHER_BASE}${path}`, { ...init, headers });
  if (response.status === 401 && !retried) {
    accessTokenCache = { value: '', expiresAt: 0 };
    return googlePublisherFetch(env, path, init, true);
  }
  return response;
}

function packageName(env) {
  return String(env.ANDROID_PACKAGE_NAME || DEFAULT_PACKAGE_NAME).trim();
}

function playTier(env, productId) {
  const proId = String(env.GOOGLE_PLAY_PRO_PRODUCT_ID || 'ailatest_pro').trim();
  const maxId = String(env.GOOGLE_PLAY_MAX_PRODUCT_ID || 'ailatest_max').trim();
  if (productId === proId) return 'plus'; // internal entitlement tier = product Pro
  if (productId === maxId) return 'pro';  // internal entitlement tier = product Max
  return null;
}

function productLabel(tier) {
  return tier === 'pro' ? 'max' : 'pro';
}

function expirySeconds(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function activeState(state, expiryAt) {
  if (!expiryAt || expiryAt <= nowSec()) return false;
  return [
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_CANCELED',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  ].includes(String(state || ''));
}

function normalizePurchase(data, expectedProductId = '') {
  const lineItems = Array.isArray(data?.lineItems) ? data.lineItems : [];
  const products = lineItems.map((line) => String(line.productId || '').trim()).filter(Boolean);
  const productId = products.find((id) => !expectedProductId || id === expectedProductId) || products[0] || '';
  const expiryAt = lineItems
    .map((line) => expirySeconds(line.expiryTime))
    .filter((value) => value != null)
    .sort((a, b) => b - a)[0] || null;
  return {
    productId,
    tier: productId ? null : null,
    products,
    state: String(data?.subscriptionState || ''),
    expiryAt,
    orderId: String(data?.latestOrderId || '').trim() || null,
    active: activeState(data?.subscriptionState, expiryAt),
    regionCode: String(data?.regionCode || '').trim() || null,
  };
}

async function ensureGooglePlayTables(env) {
  if (googlePlayTablesReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS google_play_purchases (
      purchase_token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      package_name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      order_id TEXT,
      subscription_state TEXT,
      expiry_at INTEGER,
      last_verified_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_google_play_user ON google_play_purchases(user_id, updated_at)'),
  ]);
  googlePlayTablesReady = true;
}

async function tokenHash(token) {
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(data)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getSubscription(env, packageId, purchaseToken, expectedProductId = '') {
  const path = `/applications/${encodeURIComponent(packageId)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await googlePublisherFetch(env, path);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = data?.error?.message || `Google Play verification failed (${response.status})`;
    throw Object.assign(new Error(reason), { statusCode: response.status });
  }
  const purchase = normalizePurchase(data, expectedProductId);
  purchase.tier = playTier(env, purchase.productId);
  return purchase;
}

async function acknowledgeSubscription(env, packageId, productId, purchaseToken) {
  const path = `/applications/${encodeURIComponent(packageId)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const response = await googlePublisherFetch(env, path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ developerPayload: 'ailatest-journal' }),
  });
  if (!response.ok && response.status !== 409) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Google Play acknowledgement failed (${response.status})`);
  }
}

async function recordPurchase(env, {
  hash,
  userId,
  packageId,
  productId,
  tier,
  orderId,
  state,
  expiryAt,
}) {
  const now = nowSec();
  await env.DB.prepare(`INSERT INTO google_play_purchases
    (purchase_token_hash, user_id, package_name, product_id, tier, order_id, subscription_state, expiry_at, last_verified_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(purchase_token_hash) DO UPDATE SET
      user_id = excluded.user_id,
      package_name = excluded.package_name,
      product_id = excluded.product_id,
      tier = excluded.tier,
      order_id = excluded.order_id,
      subscription_state = excluded.subscription_state,
      expiry_at = excluded.expiry_at,
      last_verified_at = excluded.last_verified_at,
      updated_at = excluded.updated_at`)
    .bind(hash, userId, packageId, productId, tier, orderId, state, expiryAt, now, now)
    .run();
}

async function syncLinkedPurchase(env, row, purchaseToken) {
  const purchase = await getSubscription(env, row.package_name, purchaseToken, row.product_id);
  if (!purchase.tier || !purchase.productId) throw new Error('Google Play product is not an AILatest Journal subscription');
  if (purchase.active) {
    await applyPaidSubscription(env, row.user_id, {
      tier: purchase.tier,
      paidUntilSec: purchase.expiryAt,
      productId: `googleplay:${purchase.productId}`,
      eduVerified: false,
    });
    await acknowledgeSubscription(env, row.package_name, purchase.productId, purchaseToken);
  }
  await recordPurchase(env, {
    hash: await tokenHash(purchaseToken),
    userId: row.user_id,
    packageId: row.package_name,
    productId: purchase.productId,
    tier: purchase.tier,
    orderId: purchase.orderId,
    state: purchase.state,
    expiryAt: purchase.expiryAt,
  });
  return purchase;
}

/** POST /play/purchases/verify — authenticated Android client endpoint. */
export async function routeGooglePlayVerify(req, env, getUser) {
  const user = await getUser(req, env).catch(() => null);
  if (!user) return error('login required', 401);
  if (!String(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '').trim()) return error('Google Play verification is not configured', 503);
  const body = await req.json().catch(() => ({}));
  const purchaseToken = String(body.purchase_token || '').trim();
  const productId = String(body.product_id || '').trim();
  const requestedPackage = String(body.package_name || '').trim();
  const packageId = packageName(env);
  if (!purchaseToken || purchaseToken.length > 4096) return error('invalid purchase token', 400);
  if (!productId || !playTier(env, productId)) return error('unknown Google Play product', 400);
  if (requestedPackage && requestedPackage !== packageId) return error('package mismatch', 400);

  try {
    await ensureGooglePlayTables(env);
    const hash = await tokenHash(purchaseToken);
    const linked = await env.DB.prepare(
      'SELECT user_id, package_name, product_id, tier FROM google_play_purchases WHERE purchase_token_hash = ?'
    ).bind(hash).first();
    if (linked && Number(linked.user_id) !== Number(user.id)) return error('purchase already linked to another account', 409);

    const purchase = await getSubscription(env, packageId, purchaseToken, productId);
    if (!purchase.products.includes(productId)) return error('product mismatch', 400);
    if (!purchase.tier) return error('unsupported product', 400);

    await recordPurchase(env, {
      hash,
      userId: user.id,
      packageId,
      productId: purchase.productId,
      tier: purchase.tier,
      orderId: purchase.orderId || String(body.order_id || '').trim() || null,
      state: purchase.state,
      expiryAt: purchase.expiryAt,
    });

    if (purchase.state === 'SUBSCRIPTION_STATE_PENDING') {
      return json({ ok: false, active: false, pending: true, state: purchase.state });
    }
    if (!purchase.active) {
      return json({ ok: false, active: false, state: purchase.state, paid_until: purchase.expiryAt });
    }

    await applyPaidSubscription(env, user.id, {
      tier: purchase.tier,
      paidUntilSec: purchase.expiryAt,
      productId: `googleplay:${purchase.productId}`,
      eduVerified: false,
    });
    let acknowledged = true;
    try {
      await acknowledgeSubscription(env, packageId, purchase.productId, purchaseToken);
    } catch (ackError) {
      acknowledged = false;
      console.error('Google Play acknowledgement failed:', ackError?.message || ackError);
    }
    const entitlements = await getEntitlements(env, user, false);
    return json({
      ok: true,
      active: true,
      acknowledged,
      product_id: purchase.productId,
      plan: productLabel(purchase.tier),
      paid_until: purchase.expiryAt,
      state: purchase.state,
      entitlements,
    });
  } catch (cause) {
    console.error('Google Play verify failed:', cause?.stack || cause?.message || cause);
    const status = Number(cause?.statusCode) === 404 ? 400 : 502;
    return error(cause?.message || 'Google Play verification failed', status);
  }
}

function rtdnAuthorized(req, env) {
  const expected = String(env.GOOGLE_PLAY_RTDN_TOKEN || '').trim();
  if (!expected) return false;
  const bearer = String(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const header = String(req.headers.get('X-Google-Play-Token') || '').trim();
  const query = new URL(req.url).searchParams.get('token') || '';
  return bearer === expected || header === expected || query === expected;
}

function decodeRtdnData(value) {
  let encoded = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  while (encoded.length % 4) encoded += '=';
  const raw = atob(encoded);
  return JSON.parse(raw);
}

/** POST /webhooks/google-play — Pub/Sub push target for RTDN. */
export async function routeGooglePlayRtdn(req, env) {
  if (!rtdnAuthorized(req, env)) return error('forbidden', 403);
  const body = await req.json().catch(() => null);
  const encoded = body?.message?.data;
  if (!encoded) return json({ ok: true, ignored: 'no_message_data' });
  let notification;
  try {
    notification = decodeRtdnData(encoded);
  } catch (_) {
    return error('invalid Pub/Sub message', 400);
  }
  const subscription = notification?.subscriptionNotification;
  const purchaseToken = String(subscription?.purchaseToken || '').trim();
  if (!purchaseToken) return json({ ok: true, ignored: 'not_a_subscription_notification' });

  await ensureGooglePlayTables(env);
  const linked = await env.DB.prepare(
    'SELECT * FROM google_play_purchases WHERE purchase_token_hash = ?'
  ).bind(await tokenHash(purchaseToken)).first();
  if (!linked) return json({ ok: true, ignored: 'purchase_not_linked' });

  try {
    const purchase = await syncLinkedPurchase(env, linked, purchaseToken);
    return json({ ok: true, active: purchase.active, state: purchase.state, paid_until: purchase.expiryAt });
  } catch (cause) {
    console.error('Google Play RTDN sync failed:', cause?.stack || cause?.message || cause);
    // A non-2xx response makes Pub/Sub retry the message.
    return error(cause?.message || 'RTDN sync failed', 502);
  }
}
