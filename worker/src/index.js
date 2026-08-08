/**
 * AILatest Journal — Cloudflare Worker API (v2)
 *
 * Auth providers:
 *   email          : one-time 6-digit code via Resend
 *   github         : OAuth (existing)
 *   google         : OAuth (new)
 *
 * Endpoints:
 *   POST /auth/email/request     { email }                → sends code via Resend
 *   POST /auth/email/verify      { email, code }          → { token, user }
 *   GET  /auth/github            ?state=&redirect=         → 302 to GitHub
 *   GET  /auth/github/callback   ?code=&state=             → 302 back with ?token=
 *   GET  /auth/google            ?state=&redirect=         → 302 to Google
 *   GET  /auth/google/callback   ?code=&state=             → 302 back with ?token=
 *   GET  /me                     (Bearer)                  → user profile
 *   GET  /me/entitlements        (Bearer)                  → tier/试用/限额快照（≤24h，见 entitlements.js）
 *   GET  /favorites              (Bearer)                  → favorite ids
 *   PUT  /favorites              (Bearer) { favs: [...] }   （tier 限额校验）
 *   POST /analytics/pageview      { path, referrer, session_id, visitor_id, client_timezone, client_language }
 *   POST /events/collect          { site_key, events: [...] }       → batch analytics ingest
 *
 * Required secrets:
 *   JWT_SECRET              long random
 *   GITHUB_CLIENT_SECRET
 *   GOOGLE_CLIENT_SECRET
 *   RESEND_API_KEY          (https://resend.com)
 *   CODE_PEPPER             long random (used when hashing email codes)
 * Required vars:
 *   GITHUB_CLIENT_ID
 *   GOOGLE_CLIENT_ID
 *   SITE_URL                https://journal.ailatest.org
 *   MAIL_FROM               noreply@ailatest.org (must be a verified Resend sender)
 */

import { buildDashboardPayload } from './dashboard.js';
import { aggregateRecentStats, recalibrateYesterday } from './analytics-rollups.js';
import { handleChat } from './chat.js';
import { handlePick } from './pick.js';
import { handleExtLookup } from './ext-lookup.js';
import { renderSitesDashboard } from './sites-dashboard.js';
import { renderAdmin, routeAdminApi } from './admin.js';
import { classifyRequestTraffic } from './traffic-classifier.js';
import {
  buildPublicSearchResponse,
  buildSkillSearchResponse,
  buildSkillRecommendResponse,
  buildSkillQuotaResponse,
} from './journal-search.js';
import {
  getEntitlements,
  activateTrialForNewUser,
  applyPaidSubscription,
  spendCredits,
  refundCredits,
  enforceFavoritesWrite,
  enforceListsWrite,
} from './entitlements.js';
import {
  routeCreemCheckout,
  routeCreemCatalog,
  routeCreemConfirm,
  routeCreemWebhook,
} from './creem.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-AJ-Install, X-API-Key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (o, status = 200, extra = {}) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });

const err = (msg, status = 400, extra = {}) => json({ error: msg }, status, extra);

// ───────── utils ─────────
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(buf) {
  const b = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + 60 * 60 * 24 * 30, ...payload };
  const p1 = b64url(enc.encode(JSON.stringify(header)));
  const p2 = b64url(enc.encode(JSON.stringify(body)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${p1}.${p2}`));
  return `${p1}.${p2}.${b64url(sig)}`;
}
async function verifyJWT(token, secret) {
  if (!token) return null;
  const [p1, p2, p3] = token.split('.');
  if (!p1 || !p2 || !p3) return null;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    'HMAC', key, b64urlDecode(p3), enc.encode(`${p1}.${p2}`)
  );
  if (!ok) return null;
  const payload = JSON.parse(dec.decode(b64urlDecode(p2)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function nowSec() { return Math.floor(Date.now() / 1000); }

function dayFromSec(sec) {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

function authCallbackUrl(req, provider) {
  const u = new URL(req.url);
  const prefix = u.pathname.startsWith('/api/') ? '/api' : '';
  return `${u.origin}${prefix}/auth/${provider}/callback`;
}

function cleanText(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function clampEventTs(value, fallback = nowSec()) {
  const n = Number(value || 0);
  const now = nowSec();
  if (!Number.isFinite(n) || n <= 0) return fallback;
  if (n > now + 300) return now;
  if (n < now - 120 * 86400) return fallback;
  return Math.floor(n);
}

function eventHourUtc(sec) {
  return new Date(Math.floor(sec / 3600) * 3600 * 1000).toISOString().slice(0, 13) + ':00:00Z';
}

function visitorHash(ipHash, visitorId) {
  return `vh_${String(ipHash || '').slice(0, 18)}_${String(visitorId || '').slice(0, 18)}`.slice(0, 80);
}

const INTERNAL_ANALYTICS_VISITOR_MARKERS = ['000cad16'];

function isInternalAnalyticsVisitor(visitorId) {
  const id = String(visitorId || '').trim().toLowerCase();
  return !!id && INTERNAL_ANALYTICS_VISITOR_MARKERS.some(marker => id === marker || id.includes(marker));
}

function metadataJson(value) {
  try {
    return JSON.stringify(value && typeof value === 'object' ? value : {});
  } catch (_) {
    return '{}';
  }
}

function canonicalAnalyticsSite(value) {
  let site = cleanText(value || '', 120).toLowerCase();
  site = site.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  const aliases = {
    grant: 'grant.ailatest.org',
    grants: 'grant.ailatest.org',
    'grant.ailatest.org': 'grant.ailatest.org',
    journal: 'journal.ailatest.org',
    'journal.ailatest.org': 'journal.ailatest.org',
    path: 'path.ailatest.org',
    'path.ailatest.org': 'path.ailatest.org',
    major: 'major.ailatest.org',
    'major.ailatest.org': 'major.ailatest.org',
    zhitou: 'major.ailatest.org',
    todo: 'todo.ailatest.org',
    'todo.ailatest.org': 'todo.ailatest.org',
    studio: 'ailatest.org',
    hub: 'ailatest.org',
    ailatest: 'ailatest.org',
    main: 'ailatest.org',
    'ailatest.org': 'ailatest.org',
    'www.ailatest.org': 'ailatest.org',
  };
  return aliases[site] || site;
}

function analyticsSiteFromBody(body, req) {
  const hostname = canonicalAnalyticsSite(body?.hostname);
  if (hostname && hostname !== 'api.ailatest.org') return hostname;
  const site = canonicalAnalyticsSite(body?.site);
  if (site && site !== 'api.ailatest.org') return site;
  const siteKey = canonicalAnalyticsSite(body?.site_key);
  if (siteKey && siteKey !== 'api.ailatest.org') return siteKey;
  return canonicalAnalyticsSite(new URL(req.url).hostname) || 'journal.ailatest.org';
}

async function requestIpHash(req, env) {
  const ip = req.headers.get('CF-Connecting-IP') || req.headers.get('x-forwarded-for') || '';
  if (!ip) return '';
  return sha256Hex(`${ip}|${env.CODE_PEPPER || env.JWT_SECRET || ''}`);
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');
}

async function getUser(req, env) {
  const h = req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || payload.uid == null) return null;
  let row;
  try {
    row = await env.DB.prepare(
      'SELECT id, email, github_id, google_id, login, name, avatar_url, provider, status FROM users WHERE id = ?'
    ).bind(payload.uid).first();
  } catch (_) {
    // The status column is added lazily by the owner console for older D1s.
    row = await env.DB.prepare(
      'SELECT id, email, github_id, google_id, login, name, avatar_url, provider FROM users WHERE id = ?'
    ).bind(payload.uid).first();
  }
  if (!row) return null;
  // Admin soft-deletes users instead of removing rows.  A disabled account
  // must not be able to keep using a previously issued JWT.
  if (String(row.status || 'active').toLowerCase() !== 'active') return null;
  // JWT 可能带 email（Google/邮箱登录）；DB 为空时回填，避免站长判定失败
  const jwtEmail = String(payload.email || '').toLowerCase().trim();
  if (jwtEmail && isEmail(jwtEmail) && !String(row.email || '').trim()) {
    row.email = jwtEmail;
    try {
      await env.DB.prepare(
        `UPDATE users SET email = ?, updated_at = ? WHERE id = ? AND (email IS NULL OR email = '')`
      ).bind(jwtEmail, nowSec(), row.id).run();
    } catch (_) { /* ignore */ }
  }
  if (!String(row.login || '').trim() && payload.login) {
    row.login = String(payload.login);
  }
  return row;
}

function genCode() {
  // 6 digits, leading zero preserved
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, '0');
}

async function hashCode(code, email, pepper) {
  return sha256Hex(`${code}|${email}|${pepper || ''}`);
}

// ───────── email (Resend) ─────────
async function sendEmailCode(env, email, code) {
  const subject = 'AILatest Journal 登录验证码';
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:40px auto;padding:32px;background:#f9f6ed;border:1px solid #d4c9a8;border-radius:8px">
      <h2 style="margin:0 0 16px;color:#3a2e1f;font-size:18px">AILatest Journal 登录验证码</h2>
      <p style="color:#5a4a36;line-height:1.6;margin:0 0 20px">你正在登录 <a href="https://journal.ailatest.org" style="color:#8b6914">journal.ailatest.org</a>。请在 10 分钟内输入以下验证码：</p>
      <div style="font-family:'SF Mono',Menlo,monospace;font-size:32px;letter-spacing:8px;text-align:center;padding:20px;background:#fff;border:1px dashed #b8a680;border-radius:6px;color:#3a2e1f;font-weight:700">${code}</div>
      <p style="color:#8a7456;font-size:12px;line-height:1.5;margin:24px 0 0">如果这不是你的操作，请忽略本邮件。</p>
    </div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'noreply@ailatest.org',
      to: [email],
      subject,
      html,
      text: `你的 AILatest Journal 登录验证码是：${code}\n\n请在 10 分钟内完成登录。如果这不是你的操作，请忽略本邮件。`,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`resend: ${res.status} ${t.slice(0, 200)}`);
  }
}

async function upsertEmailUser(env, email) {
  const now = nowSec();
  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();
  if (existing) {
    await env.DB.prepare('UPDATE users SET updated_at=? WHERE id=?')
      .bind(now, existing.id).run();
    return existing.id;
  }
  const res = await env.DB.prepare(
    `INSERT INTO users (email, login, name, provider, created_at, updated_at)
     VALUES (?, ?, ?, 'email', ?, ?)`
  ).bind(email, email.split('@')[0], email.split('@')[0], now, now).run();
  const uid = res.meta.last_row_id;
  // 新注册自动激活一次性 7 天 trial（spec: tiers.trial；注册不送 credits）
  await activateTrialForNewUser(env, uid).catch((e) => console.warn('trial activation skipped:', e?.message || e));
  return uid;
}

async function recordLoginEvent(env, userId, provider) {
  const now = nowSec();
  await env.DB.prepare(
    'INSERT INTO login_events (user_id, provider, day, event_at) VALUES (?, ?, ?, ?)'
  ).bind(userId, provider || '', dayFromSec(now), now).run();
}

async function safeRecordLoginEvent(env, userId, provider) {
  try {
    await recordLoginEvent(env, userId, provider);
  } catch (e) {
    console.warn('login event skipped:', e?.message || e);
  }
}

async function routePageview(req, env) {
  const body = await req.json().catch(() => null);
  const now = nowSec();
  const eventTs = clampEventTs(body?.event_ts, now);
  const path = cleanText(body?.path || '/', 240) || '/';
  const referrer = cleanText(body?.referrer || '', 300);
  const sessionId = cleanText(body?.session_id || '', 80);
  const visitorId = cleanText(body?.visitor_id || '', 80);
  if (isInternalAnalyticsVisitor(visitorId)) {
    return json({ ok: true, ignored: true, reason: 'internal_visitor' });
  }
  const clientTimezone = cleanText(body?.client_timezone || '', 80);
  const clientLanguage = cleanText(body?.client_language || '', 80);
  const site = analyticsSiteFromBody(body || {}, req);
  const userAgent = cleanText(body?.user_agent || req.headers.get('user-agent') || '', 500);
  const screenResolution = cleanText(body?.screen_resolution || '', 40);
  const cf = req.cf || {};
  const country = cleanText(cf.country || '', 16);
  const colo = cleanText(cf.colo || '', 16);
  const ipHash = await requestIpHash(req, env);
  const vHash = visitorHash(ipHash, visitorId);
  const traffic = await classifyRequestTraffic(env, req, {
    ua: userAgent,
    ipHash,
    visitorHash: vHash,
    referrer,
    country,
  }).catch(() => ({
    traffic_type: body?.is_bot ? 'scraper' : 'human',
    is_bot: body?.is_bot ? 1 : 0,
    bot_reason: body?.is_bot ? 'client_bot_hint' : '',
  }));

  await env.DB.prepare(
    `INSERT INTO page_events
       (day, event_at, path, referrer, session_id, visitor_id, country, colo, client_timezone, client_language)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    dayFromSec(eventTs),
    eventTs,
    path,
    referrer,
    sessionId,
    visitorId,
    country,
    colo,
    clientTimezone,
    clientLanguage,
  ).run();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO raw_events (
      event_id, event_type, site, path, referrer, visitor_id, session_id,
      event_ts, received_at, event_hour_utc, event_day_utc,
      client_timezone, client_language, user_agent, ip_hash, country, colo,
      is_bot, bot_reason, metadata_json, traffic_type, visitor_hash, screen_resolution
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    cleanText(body?.event_id || crypto.randomUUID(), 80),
    cleanText(body?.event_type || 'page_view', 60) || 'page_view',
    site,
    path,
    referrer,
    visitorId,
    sessionId,
    eventTs,
    now,
    eventHourUtc(eventTs),
    dayFromSec(eventTs),
    clientTimezone,
    clientLanguage,
    userAgent,
    ipHash,
    country,
    colo,
    Number(traffic.is_bot || 0),
    cleanText(traffic.bot_reason || '', 240),
    metadataJson(body?.metadata),
    cleanText(traffic.traffic_type || 'human', 40),
    vHash,
    screenResolution,
  ).run();

  return json({ ok: true });
}


let extensionDownloadsReady = false;
async function ensureExtensionDownloadsTables(env) {
  if (extensionDownloadsReady || !env?.DB) return;
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS extension_download_events (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        asset           TEXT NOT NULL,
        event_at        INTEGER NOT NULL,
        day             TEXT NOT NULL,
        visitor_id      TEXT DEFAULT '',
        session_id      TEXT DEFAULT '',
        referrer        TEXT DEFAULT '',
        user_agent      TEXT DEFAULT '',
        ip_hash         TEXT DEFAULT '',
        country         TEXT DEFAULT '',
        client_language TEXT DEFAULT '',
        source_path     TEXT DEFAULT ''
      )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS extension_download_stats (
        asset     TEXT PRIMARY KEY,
        total     INTEGER NOT NULL DEFAULT 0,
        latest_at INTEGER
      )`
    ),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_extension_download_events_asset_time ON extension_download_events(asset, event_at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_extension_download_events_day ON extension_download_events(day)'),
  ]);
  extensionDownloadsReady = true;
}

function extensionAssetFromUrl(req) {
  const url = new URL(req.url);
  const raw = cleanText(url.searchParams.get('asset') || 'latest', 120).toLowerCase();
  if (!raw || raw === 'latest' || raw === 'ailatest-journal-extension-latest.zip') {
    return {
      key: 'ailatest-journal-extension-latest.zip',
      path: '/downloads/ailatest-journal-extension-latest.zip',
    };
  }
  if (raw === 'skill' || raw === 'ailatest-journal-skill-latest.zip') {
    return {
      key: 'ailatest-journal-skill-latest.zip',
      path: '/downloads/ailatest-journal-skill-latest.zip',
    };
  }
  return null;
}

async function routeExtensionDownloadStats(req, env) {
  const asset = extensionAssetFromUrl(req);
  if (!asset) return err('unknown asset', 400);
  await ensureExtensionDownloadsTables(env);
  const row = await env.DB.prepare(
    'SELECT total, latest_at FROM extension_download_stats WHERE asset = ?'
  ).bind(asset.key).first();
  let total = Number(row?.total || 0);
  let latestAt = row?.latest_at || null;
  if (!row) {
    const fallback = await env.DB.prepare(
      'SELECT COUNT(*) AS total, MAX(event_at) AS latest_at FROM extension_download_events WHERE asset = ?'
    ).bind(asset.key).first().catch(() => null);
    total = Number(fallback?.total || 0);
    latestAt = fallback?.latest_at || null;
  }
  return json(
    { ok: true, asset: asset.key, total, latest_at: latestAt },
    200,
    { 'Cache-Control': 'no-store' },
  );
}

async function routeExtensionDownload(req, env) {
  const asset = extensionAssetFromUrl(req);
  if (!asset) return err('unknown asset', 400);
  await ensureExtensionDownloadsTables(env);
  const url = new URL(req.url);
  const now = nowSec();
  const visitorId = cleanText(url.searchParams.get('visitor_id') || '', 80);
  const sessionId = cleanText(url.searchParams.get('session_id') || '', 80);
  const ua = cleanText(req.headers.get('user-agent') || '', 500);
  const cf = req.cf || {};
  const ipHash = await requestIpHash(req, env);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO extension_download_events (
        asset, event_at, day, visitor_id, session_id, referrer, user_agent,
        ip_hash, country, client_language, source_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      asset.key,
      now,
      dayFromSec(now),
      visitorId,
      sessionId,
      cleanText(req.headers.get('referer') || '', 300),
      ua,
      ipHash,
      cleanText(cf.country || '', 16),
      cleanText(req.headers.get('accept-language') || '', 120),
      cleanText(url.searchParams.get('source') || '/extension.html', 240),
    ),
    env.DB.prepare(
      `INSERT INTO extension_download_stats (asset, total, latest_at)
       VALUES (?, 1, ?)
       ON CONFLICT(asset) DO UPDATE SET
         total = total + 1,
         latest_at = excluded.latest_at`
    ).bind(asset.key, now),
  ]);
  const target = new URL(asset.path, env.SITE_URL || 'https://journal.ailatest.org');
  // The ZIP path is intentionally immutable at the edge. Bump this query
  // when the packaged extension changes so the redirect cannot serve an old
  // cached archive after a Pages deployment.
  target.searchParams.set('v', '20260806-ext-v2');
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      'Cache-Control': 'no-store',
      ...CORS,
    },
  });
}

let apiKeysReady = false;
/**
 * api_keys 线上曾有旧 schema（INTEGER id、无 key_tail、request_count）。
 * 启动时探测并迁移到统一结构，避免 INSERT 因缺列 / 类型不匹配 → HTTP 500。
 */
async function ensureApiKeyTables(env) {
  if (apiKeysReady || !env?.DB) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS api_keys (
      id           TEXT PRIMARY KEY,
      user_id      INTEGER NOT NULL,
      name         TEXT NOT NULL DEFAULT 'My API',
      key_hash     TEXT NOT NULL UNIQUE,
      key_prefix   TEXT NOT NULL,
      key_tail     TEXT NOT NULL DEFAULT '',
      created_at   INTEGER NOT NULL,
      revoked_at   INTEGER,
      last_used_at INTEGER,
      call_count   INTEGER NOT NULL DEFAULT 0
    )`
  ).run();

  const info = await env.DB.prepare('PRAGMA table_info(api_keys)').all();
  const cols = new Map((info.results || []).map((r) => [String(r.name), r]));
  const has = (name) => cols.has(name);
  const idType = String(cols.get('id')?.type || '').toUpperCase();

  // 旧表：INTEGER AUTOINCREMENT id → 重建为 TEXT id（保留数据）
  if (has('id') && idType.includes('INT')) {
    const countExpr = has('call_count')
      ? 'COALESCE(call_count, 0)'
      : has('request_count')
        ? 'COALESCE(request_count, 0)'
        : '0';
    const tailExpr = has('key_tail') ? "COALESCE(key_tail, '')" : "''";
    await env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS api_keys_v2 (
          id           TEXT PRIMARY KEY,
          user_id      INTEGER NOT NULL,
          name         TEXT NOT NULL DEFAULT 'My API',
          key_hash     TEXT NOT NULL UNIQUE,
          key_prefix   TEXT NOT NULL,
          key_tail     TEXT NOT NULL DEFAULT '',
          created_at   INTEGER NOT NULL,
          revoked_at   INTEGER,
          last_used_at INTEGER,
          call_count   INTEGER NOT NULL DEFAULT 0
        )`
      ),
      env.DB.prepare(
        `INSERT OR IGNORE INTO api_keys_v2
           (id, user_id, name, key_hash, key_prefix, key_tail, created_at, revoked_at, last_used_at, call_count)
         SELECT
           printf('legacy-%d', id),
           user_id,
           COALESCE(name, 'My API'),
           key_hash,
           key_prefix,
           ${tailExpr},
           created_at,
           revoked_at,
           last_used_at,
           ${countExpr}
         FROM api_keys`
      ),
      env.DB.prepare('DROP TABLE api_keys'),
      env.DB.prepare('ALTER TABLE api_keys_v2 RENAME TO api_keys'),
    ]);
  } else {
    // 补列（CREATE IF NOT EXISTS 不会改旧表）
    if (!has('key_tail')) {
      await env.DB.prepare(`ALTER TABLE api_keys ADD COLUMN key_tail TEXT NOT NULL DEFAULT ''`).run();
    }
    if (!has('call_count')) {
      await env.DB.prepare(`ALTER TABLE api_keys ADD COLUMN call_count INTEGER NOT NULL DEFAULT 0`).run();
      if (has('request_count')) {
        await env.DB.prepare(
          `UPDATE api_keys SET call_count = COALESCE(request_count, 0) WHERE call_count = 0 OR call_count IS NULL`
        ).run().catch(() => {});
      }
    }
  }

  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id, created_at)'
  ).run().catch(() => {});
  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)'
  ).run().catch(() => {});
  apiKeysReady = true;
}

function apiKeySecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // 避免 String.fromCharCode(...arr) 在部分 runtime 上的展开问题
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `aj_live_${b64}`;
}

async function apiKeyHash(secret, env) {
  return sha256Hex(`${secret}|${env.API_KEY_PEPPER || env.JWT_SECRET || ''}`);
}

function publicApiKey(row) {
  return {
    id: String(row.id),
    name: row.name,
    key_prefix: row.key_prefix,
    key_tail: row.key_tail || '',
    created_at: row.created_at,
    revoked_at: row.revoked_at,
    last_used_at: row.last_used_at,
    call_count: Number(row.call_count ?? row.request_count ?? 0) || 0,
  };
}

/**
 * API Key 统一入口：支持 X-API-Key、Authorization: ApiKey <key>，以及
 * Authorization: Bearer aj_live_<...>。JWT Bearer 仍由 getUser 处理。
 */
function requestApiKey(req) {
  const explicit = cleanText(req.headers.get('X-API-Key') || '', 300);
  if (explicit) return explicit;
  const auth = String(req.headers.get('Authorization') || '').trim();
  if (/^ApiKey\s+/i.test(auth)) return cleanText(auth.replace(/^ApiKey\s+/i, ''), 300);
  if (/^Bearer\s+aj_live_/i.test(auth)) return cleanText(auth.replace(/^Bearer\s+/i, ''), 300);
  return '';
}

/**
 * 解析 API Key 或登录 JWT。无凭证时返回匿名上下文（Skill/API 处于公测，
 * 允许公开调用）；明确携带了错误 API Key 时必须拒绝，避免把 typo 当匿名请求。
 */
async function resolveRequestPrincipal(req, env, { allowJwt = true } = {}) {
  const secret = requestApiKey(req);
  if (secret) {
    try {
      await ensureApiKeyTables(env);
      const hash = await apiKeyHash(secret, env);
      const row = await env.DB.prepare(
        `SELECT k.id, k.user_id, k.name, k.key_prefix, k.key_tail,
                u.email, u.github_id, u.google_id, u.login, u.name AS user_name, u.avatar_url, u.provider
           FROM api_keys k
           JOIN users u ON u.id = k.user_id
          WHERE k.key_hash = ? AND k.revoked_at IS NULL
          LIMIT 1`
      ).bind(hash).first();
      if (!row) return { error: err('invalid api key', 401), provided: true };
      const user = {
        id: row.user_id,
        email: row.email,
        github_id: row.github_id,
        google_id: row.google_id,
        login: row.login,
        name: row.user_name,
        avatar_url: row.avatar_url,
        provider: row.provider,
      };
      const owner = isOwnerUser(user, env);
      const entitlements = await getEntitlements(env, user, owner);
      await env.DB.prepare(
        'UPDATE api_keys SET last_used_at = ?, call_count = COALESCE(call_count, 0) + 1 WHERE id = ? AND revoked_at IS NULL'
      ).bind(nowSec(), row.id).run().catch(() => {});
      return {
        user,
        isOwner: owner,
        entitlements,
        apiKey: { id: String(row.id), name: row.name || 'My API', prefix: row.key_prefix || '', tail: row.key_tail || '' },
        auth: 'api_key',
      };
    } catch (e) {
      console.error('resolve api key failed', e?.message || e);
      return { error: err('api key unavailable', 503), provided: true };
    }
  }

  if (allowJwt) {
    const user = await getUser(req, env).catch(() => null);
    if (user) {
      const owner = isOwnerUser(user, env);
      const entitlements = await getEntitlements(env, user, owner).catch(() => null);
      return { user, isOwner: owner, entitlements, apiKey: null, auth: 'jwt' };
    }
  }
  return { user: null, isOwner: false, entitlements: null, apiKey: null, auth: 'public' };
}

async function routeInteraction(req, env) {
  const body = await req.json().catch(() => null);
  if (!body) return err('invalid json');
  const now = nowSec();
  const eventTs = clampEventTs(body.event_ts, now);
  const site = analyticsSiteFromBody(body || {}, req);
  const eventType = cleanText(body.event_type || 'interaction', 80) || 'interaction';
  const path = cleanText(body.path || '/', 240) || '/';
  const referrer = cleanText(body.referrer || '', 300);
  const visitorId = cleanText(body.visitor_id || '', 80);
  if (isInternalAnalyticsVisitor(visitorId)) {
    return json({ ok: true, ignored: true, reason: 'internal_visitor' });
  }
  const sessionId = cleanText(body.session_id || '', 80);
  const userAgent = cleanText(body.user_agent || req.headers.get('user-agent') || '', 500);
  const cf = req.cf || {};
  const country = cleanText(cf.country || '', 16);
  const ipHash = await requestIpHash(req, env);
  const vHash = visitorHash(ipHash, visitorId);
  const traffic = await classifyRequestTraffic(env, req, {
    ua: userAgent,
    ipHash,
    visitorHash: vHash,
    referrer,
    viewSource: cleanText(body.view_source || '', 80),
    country,
  }).catch(() => ({
    traffic_type: body?.is_bot ? 'scraper' : 'human',
    is_bot: body?.is_bot ? 1 : 0,
    bot_reason: body?.is_bot ? 'client_bot_hint' : '',
  }));
  const u = await getUser(req, env).catch(() => null);

  await env.DB.prepare(
    `INSERT OR IGNORE INTO interaction_events (
      event_id, event_type, site, path, tab, query, result_count, visitor_id,
      session_id, user_id, event_ts, received_at, event_day_utc,
      client_timezone, client_language, metadata_json, user_agent, is_bot,
      journal_key, journal_name, journal_issn, traffic_type, bot_reason, visitor_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    cleanText(body.event_id || crypto.randomUUID(), 80),
    eventType,
    site,
    path,
    cleanText(body.tab || '', 80),
    cleanText(body.query || '', 240),
    Number.isFinite(Number(body.result_count)) ? Number(body.result_count) : null,
    visitorId,
    sessionId,
    u?.id || null,
    eventTs,
    now,
    dayFromSec(eventTs),
    cleanText(body.client_timezone || '', 80),
    cleanText(body.client_language || '', 80),
    metadataJson(body.metadata),
    userAgent,
    Number(traffic.is_bot || 0),
    cleanText(body.journal_key || '', 200),
    cleanText(body.journal_name || '', 300),
    cleanText(body.journal_issn || '', 80),
    cleanText(traffic.traffic_type || 'human', 40),
    cleanText(traffic.bot_reason || '', 240),
    vHash,
  ).run();

  if (eventType === 'journal_view' && body.journal_key) {
    await recordJournalViewEvent(req, env, body, { now, eventTs, user: u, traffic, ipHash, visitorHash: vHash, country });
  }

  return json({ ok: true });
}

async function routeEventsCollect(req, env) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.events)) return err('invalid events');
  const events = body.events.slice(0, 40);
  let accepted = 0;
  let pageviews = 0;
  let interactions = 0;
  let ignored = 0;
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const payload = {
      ...event,
      site_key: event.site_key || body.site_key || body.site || '',
    };
    payload.site = analyticsSiteFromBody(payload, req);
    const eventType = cleanText(payload.event_type || '', 80).toLowerCase();
    const target = eventType === 'page_view' || eventType === 'pageview'
      ? '/analytics/pageview'
      : '/analytics/interaction';
    const headers = new Headers(req.headers);
    headers.set('Content-Type', 'application/json');
    headers.delete('Content-Length');
    const eventReq = new Request(new URL(target, req.url), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const res = target.endsWith('/pageview')
      ? await routePageview(eventReq, env)
      : await routeInteraction(eventReq, env);
    if (!res.ok) continue;
    const result = await res.json().catch(() => ({}));
    if (result.ignored) ignored += 1;
    else {
      accepted += 1;
      if (target.endsWith('/pageview')) pageviews += 1;
      else interactions += 1;
    }
  }
  return json({ ok: true, accepted, pageviews, interactions, ignored });
}

async function routeAiUsageIngest(req, env) {
  const expected = env.AI_USAGE_INGEST_TOKEN || '';
  if (expected) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (token !== expected) return err('unauthorized', 401);
  }
  const body = await req.json().catch(() => null);
  if (!body) return err('invalid json');
  const now = nowSec();
  const usage = body.usage || {};
  const cost = body.cost || {};

  await env.DB.prepare(
    `INSERT INTO ai_usage_events (
      created_at, day, app, feature, provider, model, range_label,
      query_chars, terms_count, evidence_count,
      prompt_tokens, completion_tokens, total_tokens,
      cache_hit_tokens, cache_miss_tokens,
      input_usd, output_usd, total_usd, latency_ms, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    now,
    dayFromSec(now),
    cleanText(body.app || '', 120),
    cleanText(body.feature || '', 80),
    cleanText(body.provider || '', 40),
    cleanText(body.model || '', 80),
    cleanText(body.rangeLabel || '', 40),
    Number(body.queryChars || 0),
    Number(body.termsCount || 0),
    Number(body.evidenceCount || 0),
    Number(usage.prompt_tokens || 0),
    Number(usage.completion_tokens || 0),
    Number(usage.total_tokens || 0),
    Number(usage.prompt_cache_hit_tokens || usage.prompt_tokens_details?.cached_tokens || 0),
    Number(usage.prompt_cache_miss_tokens || 0),
    Number(cost.inputUsd || 0),
    Number(cost.outputUsd || 0),
    Number(cost.totalUsd || 0),
    Number(body.latencyMs || 0),
    metadataJson({
      usage,
      cost,
      pricing: cost.pricing || null,
    }),
  ).run();

  return json({ ok: true });
}

async function routeAiUsageSummary(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('login required', 401);
  if (!isOwnerUser(u)) return err('forbidden', 403);
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || 30)));
  const since = dayFromSec(nowSec() - (days - 1) * 86400);
  const rows = await env.DB.prepare(
    `SELECT day, app, feature, provider, model,
            COUNT(*) AS requests,
            SUM(prompt_tokens) AS prompt_tokens,
            SUM(completion_tokens) AS completion_tokens,
            SUM(total_tokens) AS total_tokens,
            SUM(total_usd) AS total_usd,
            AVG(latency_ms) AS avg_latency_ms
       FROM ai_usage_events
      WHERE day >= ?
      GROUP BY day, app, feature, provider, model
      ORDER BY day DESC, requests DESC`
  ).bind(since).all();
  const totals = await env.DB.prepare(
    `SELECT COUNT(*) AS requests,
            SUM(prompt_tokens) AS prompt_tokens,
            SUM(completion_tokens) AS completion_tokens,
            SUM(total_tokens) AS total_tokens,
            SUM(total_usd) AS total_usd
       FROM ai_usage_events
      WHERE day >= ?`
  ).bind(since).first();
  return json({
    ok: true,
    days,
    since,
    totals: totals || {},
    rows: rows.results || [],
  });
}

async function getUserById(env, id) {
  try {
    return await env.DB.prepare(
      'SELECT id, email, github_id, google_id, login, name, avatar_url, provider, status FROM users WHERE id = ?'
    ).bind(id).first();
  } catch (_) {
    return env.DB.prepare(
      'SELECT id, email, github_id, google_id, login, name, avatar_url, provider FROM users WHERE id = ?'
    ).bind(id).first();
  }
}

function publicUser(u) {
  const owner = isOwnerUser(u);
  return {
    id: u.id,
    email: u.email,
    login: u.login,
    name: u.name,
    avatar_url: u.avatar_url,
    provider: u.provider,
    is_owner: owner,
    plan: owner ? 'owner' : undefined,
  };
}

// ───────── routes: email ─────────
function monthFromSec(sec) {
  return new Date(sec * 1000).toISOString().slice(0, 7);
}

function nextUtcDayStart(sec) {
  const d = new Date(sec * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) / 1000);
}

function nextUtcMonthStart(sec) {
  const d = new Date(sec * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000);
}

/** 与 Todo 一致：站长邮箱白名单（生成礼品码等管理接口） */
const OWNER_EMAIL = 'jiantaoweng@gmail.com';
const OWNER_EMAILS = new Set([OWNER_EMAIL]);

function isOwnerUser(u, env) {
  const email = String(u?.email || '').toLowerCase().trim();
  const login = String(u?.login || '').toLowerCase().trim();
  const envOwner = String(env?.OWNER_EMAIL || '').toLowerCase().trim();
  if (envOwner && email === envOwner) return true;
  if (email === OWNER_EMAIL || OWNER_EMAILS.has(email)) return true;
  if (login === OWNER_EMAIL || OWNER_EMAILS.has(login)) return true;
  // Google 登录 login 常为邮箱本地部分
  const local = email.includes('@') ? email.split('@')[0] : login;
  if (local === 'jiantaoweng' && (!email || email.endsWith('@gmail.com'))) return true;
  return false;
}

/** Free：终身 10 次；Pro：500 credits/月；Max：1000 credits/月。每次完整荐刊消耗 10 credits。 */
const FREE_PICK_LIFETIME_LIMIT = 10;
const AI_PICK_COST = 10;

async function ensurePickQuotaTables(env) {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS user_quotas (
        user_id       INTEGER PRIMARY KEY,
        plan          TEXT    NOT NULL DEFAULT 'free',
        daily_limit   INTEGER NOT NULL DEFAULT 10,
        monthly_limit INTEGER,
        paid_until    INTEGER,
        updated_at    INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS pick_usage (
        user_id     INTEGER NOT NULL,
        period      TEXT    NOT NULL,
        period_key  TEXT    NOT NULL,
        used        INTEGER NOT NULL DEFAULT 0,
        updated_at  INTEGER NOT NULL,
        PRIMARY KEY (user_id, period, period_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_pick_usage_user_period ON pick_usage(user_id, period, period_key)'),
  ]);
}

async function consumePickQuotaForUser(env, u) {
  const now = nowSec();
  if (isOwnerUser(u)) {
    return { ok: true, allowed: true, plan: 'owner', unlimited: true, unit: 'credits', cost: 0, used: 0, limit: null, remaining: null, period: 'none', period_key: '', reset_at: null };
  }

  // 付费档统一走 user_credits；不再读取旧 user_quotas，避免「权益显示 500/1000
  // credits、实际却只有 10 次」的分裂状态。
  const ents = await getEntitlements(env, u, false);
  const tier = String(ents?.tier || 'free').toLowerCase();
  if (tier === 'plus' || tier === 'pro') {
    const allowance = Number(ents?.features?.ai?.monthly_credits || 0);
    const resetAt = nextUtcMonthStart(now);
    const spent = await spendCredits(env, u, false, AI_PICK_COST, 'ai_pick', `pick:${u.id}:${now}`);
    if (!spent.ok) {
      const current = Number(ents?.credits?.total || 0);
      return {
        ok: false,
        allowed: false,
        plan: tier,
        unit: 'credits',
        cost: AI_PICK_COST,
        used: Math.max(0, allowance - current),
        limit: allowance,
        remaining: current,
        period: 'month',
        period_key: monthFromSec(now),
        reset_at: resetAt,
        lifetime: false,
        error: 'AI credits exhausted',
        code: 'insufficient_credits',
      };
    }
    const total = Number(spent.total || 0);
    return {
      ok: true,
      allowed: true,
      plan: tier,
      unit: 'credits',
      cost: AI_PICK_COST,
      used: Math.max(0, allowance - total),
      limit: allowance,
      remaining: total,
      period: 'month',
      period_key: monthFromSec(now),
      reset_at: resetAt,
      lifetime: false,
      credits: spent,
    };
  }

  // Trial 明确是「权益预览」而不是付费 AI 额度；Free 的 10 次是独立试用。
  if (tier === 'trial') {
    return {
      ok: false,
      allowed: false,
      plan: 'trial',
      unit: 'credits',
      cost: AI_PICK_COST,
      used: 0,
      limit: 0,
      remaining: 0,
      period: 'none',
      period_key: '',
      reset_at: null,
      lifetime: false,
      error: 'AI trial is not enabled for this account',
      code: 'ai_locked',
    };
  }

  await ensurePickQuotaTables(env);
  const period = 'lifetime';
  const periodKey = 'total';
  const limit = FREE_PICK_LIFETIME_LIMIT;
  const resetAt = null;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO pick_usage (user_id, period, period_key, used, updated_at)
     VALUES (?, ?, ?, 0, ?)`
  ).bind(u.id, period, periodKey, now).run();

  const usage = await env.DB.prepare(
    'SELECT used FROM pick_usage WHERE user_id = ? AND period = ? AND period_key = ?'
  ).bind(u.id, period, periodKey).first();
  const used = Number(usage?.used || 0);
  if (used >= limit) {
    return {
      ok: false,
      allowed: false,
      plan: 'free',
      unit: 'picks',
      cost: 1,
      used,
      limit,
      remaining: 0,
      period,
      period_key: periodKey,
      reset_at: resetAt,
      lifetime: period === 'lifetime',
      error: period === 'lifetime' ? 'lifetime quota exhausted' : 'quota exceeded',
    };
  }

  await env.DB.prepare(
    `UPDATE pick_usage SET used = used + 1, updated_at = ?
     WHERE user_id = ? AND period = ? AND period_key = ?`
  ).bind(now, u.id, period, periodKey).run();

  const nextUsed = used + 1;
  return {
    ok: true,
    allowed: true,
    plan: 'free',
    unit: 'picks',
    cost: 1,
    used: nextUsed,
    limit,
    remaining: Math.max(0, limit - nextUsed),
    period,
    period_key: periodKey,
    reset_at: resetAt,
    lifetime: period === 'lifetime',
  };
}

async function routeConsumePickQuota(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('login required', 401);
  const quota = await consumePickQuotaForUser(env, u);
  return json(quota, quota.allowed ? 200 : 429);
}

async function consumePickQuotaForRequest(req, env) {
  const u = await getUser(req, env);
  if (!u) return { ok: false, response: err('login required', 401) };
  const quota = await consumePickQuotaForUser(env, u);
  if (!quota.allowed) return { ok: false, response: json(quota, 429) };
  return { ok: true, quota, user: u, refund: () => refundPickQuota(env, { ...quota, user_id: u.id }) };
}

// Give back one pick credit (used when the AI call fails after the quota was consumed).
async function refundPickQuota(env, quota) {
  if (!quota || quota.unlimited) return;
  if (quota.unit === 'credits') {
    if (!quota.user_id || !quota.cost) return;
    try {
      await refundCredits(env, quota.user_id, quota.cost, `pick_refund:${quota.period_key || nowSec()}`);
    } catch (e) {
      console.warn('pick credit refund failed:', e?.message || e);
    }
    return;
  }
  if (!quota.period_key) return;
  try {
    await env.DB.prepare(
      `UPDATE pick_usage SET used = MAX(used - 1, 0), updated_at = ?
       WHERE user_id = ? AND period = ? AND period_key = ?`
    ).bind(nowSec(), quota.user_id, quota.period, quota.period_key).run();
  } catch (e) {
    console.warn('pick quota refund failed:', e?.message || e);
  }
}

async function routeEmailRequest(req, env) {
  const body = await req.json().catch(() => null);
  const email = (body?.email || '').trim().toLowerCase();
  if (!isEmail(email)) return err('invalid email');

  // simple rate limit: 1 code per 60s per email
  const row = await env.DB.prepare(
    'SELECT created_at FROM email_codes WHERE email = ?'
  ).bind(email).first();
  if (row && (nowSec() - row.created_at) < 60) {
    return err('请稍候再试（60 秒内只能请求一次）', 429);
  }

  const code = genCode();
  const codeHash = await hashCode(code, email, env.CODE_PEPPER);
  const now = nowSec();
  const expires = now + 10 * 60;  // 10 min

  await env.DB.prepare(
    `INSERT INTO email_codes (email, code_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(email) DO UPDATE SET
       code_hash=excluded.code_hash,
       expires_at=excluded.expires_at,
       attempts=0,
       created_at=excluded.created_at`
  ).bind(email, codeHash, expires, now).run();

  try {
    await sendEmailCode(env, email, code);
  } catch (e) {
    return err('发送邮件失败：' + e.message, 500);
  }
  return json({ ok: true, expires_in: 600 });
}

async function routeEmailVerify(req, env) {
  const body = await req.json().catch(() => null);
  const email = (body?.email || '').trim().toLowerCase();
  const code  = (body?.code  || '').trim();
  if (!isEmail(email) || !/^\d{6}$/.test(code)) return err('参数错误');

  const row = await env.DB.prepare(
    'SELECT code_hash, expires_at, attempts FROM email_codes WHERE email = ?'
  ).bind(email).first();
  if (!row) return err('请先请求验证码', 400);
  if (nowSec() > row.expires_at) return err('验证码已过期', 400);
  if (row.attempts >= 5) return err('尝试次数过多，请重新请求验证码', 429);

  const expect = await hashCode(code, email, env.CODE_PEPPER);
  if (expect !== row.code_hash) {
    await env.DB.prepare(
      'UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?'
    ).bind(email).run();
    return err('验证码错误', 400);
  }

  // consume
  await env.DB.prepare('DELETE FROM email_codes WHERE email = ?').bind(email).run();

  const uid = await upsertEmailUser(env, email);
  await safeRecordLoginEvent(env, uid, 'email');
  const jwt = await signJWT({ uid, email }, env.JWT_SECRET);
  const u = await getUserById(env, uid);
  if (!u) return err('用户创建失败', 500);
  return json({ token: jwt, user: publicUser(u) });
}

// ───────── routes: github (existing) ─────────
async function routeAuthStart(req, env) {
  const u = new URL(req.url);
  const state = u.searchParams.get('state') || '';
  const redirect = u.searchParams.get('redirect') || env.SITE_URL;
  const callback = authCallbackUrl(req, 'github');
  const ghState = btoa(JSON.stringify({ s: state, r: redirect }));
  const gh = new URL('https://github.com/login/oauth/authorize');
  gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  gh.searchParams.set('redirect_uri', callback);
  gh.searchParams.set('scope', 'read:user user:email');
  gh.searchParams.set('state', ghState);
  return Response.redirect(gh.toString(), 302);
}

async function routeAuthCallback(req, env) {
  const u = new URL(req.url);
  const code = u.searchParams.get('code');
  const ghState = u.searchParams.get('state');
  if (!code || !ghState) return err('missing code/state');
  let redirect = env.SITE_URL;
  try { redirect = JSON.parse(atob(ghState)).r || redirect; } catch {}

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return err('oauth exchange failed', 401);

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'User-Agent': 'ailatest-journal',
      'Accept': 'application/vnd.github+json',
    },
  });
  const gh = await userRes.json();
  if (!gh.id) return err('github user fetch failed', 401);

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE github_id = ?'
  ).bind(gh.id).first();

  let uid;
  const now = nowSec();
  if (existing) {
    uid = existing.id;
    await env.DB.prepare(
      'UPDATE users SET login=?, name=?, avatar_url=?, updated_at=? WHERE id=?'
    ).bind(gh.login, gh.name || gh.login, gh.avatar_url || '', now, uid).run();
  } else {
    const res = await env.DB.prepare(
      `INSERT INTO users (github_id, login, name, avatar_url, provider, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'github', ?, ?)`
    ).bind(gh.id, gh.login, gh.name || gh.login, gh.avatar_url || '', now, now).run();
    uid = res.meta.last_row_id;
    await activateTrialForNewUser(env, uid).catch((e) => console.warn('trial activation skipped:', e?.message || e));
  }

  await safeRecordLoginEvent(env, uid, 'github');
  const jwt = await signJWT({ uid, login: gh.login }, env.JWT_SECRET);
  const r = new URL(redirect);
  r.searchParams.set('token', jwt);
  return Response.redirect(r.toString(), 302);
}

// ───────── routes: google ─────────
function googleOAuthConfigError(env) {
  const missing = [];
  if (!env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
  if (!env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  return missing.length ? `google oauth not configured: missing ${missing.join(', ')}` : '';
}

async function routeGoogleStart(req, env) {
  const configError = googleOAuthConfigError(env);
  if (configError) return err(configError, 503);
  const u = new URL(req.url);
  const state = u.searchParams.get('state') || '';
  const redirect = u.searchParams.get('redirect') || env.SITE_URL;
  const callback = authCallbackUrl(req, 'google');
  const ggState = btoa(JSON.stringify({ s: state, r: redirect }));
  const gg = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  gg.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  gg.searchParams.set('redirect_uri', callback);
  gg.searchParams.set('response_type', 'code');
  gg.searchParams.set('scope', 'openid email profile');
  gg.searchParams.set('state', ggState);
  gg.searchParams.set('access_type', 'online');
  gg.searchParams.set('prompt', 'select_account');
  return Response.redirect(gg.toString(), 302);
}

async function routeGoogleCallback(req, env) {
  try {
    const configError = googleOAuthConfigError(env);
    if (configError) return err(configError, 503);
    const u = new URL(req.url);
    const code = u.searchParams.get('code');
    const ggState = u.searchParams.get('state');
    if (!code || !ggState) return err('missing code/state');
    let redirect = env.SITE_URL;
    try { redirect = JSON.parse(atob(ggState)).r || redirect; } catch {}
    const callback = authCallbackUrl(req, 'google');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callback,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      console.warn('google token exchange failed:', tokenRes.status, tokenData.error || '');
      return err('google oauth exchange failed', 401);
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });
    const gg = await userRes.json().catch(() => ({}));
    if (!userRes.ok || !gg.sub) {
      console.warn('google user fetch failed:', userRes.status);
      return err('google user fetch failed', 401);
    }

    const email = (gg.email || '').toLowerCase();
    const now = nowSec();

    // match by google_id → then by email
    let existing = await env.DB.prepare(
      'SELECT id FROM users WHERE google_id = ?'
    ).bind(gg.sub).first();
    if (!existing && email) {
      existing = await env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(email).first();
    }

    let uid;
    if (existing) {
      uid = existing.id;
      // 始终用 Google 返回的邮箱覆盖（避免旧账号 email 为空/错误导致站长判定失败）
      await env.DB.prepare(
        `UPDATE users
            SET google_id=?,
                email=CASE WHEN ? != '' THEN ? ELSE email END,
                login=CASE WHEN ? != '' THEN ? ELSE COALESCE(login, ?) END,
                name=COALESCE(NULLIF(?, ''), name),
                avatar_url=COALESCE(NULLIF(?, ''), avatar_url),
                provider=COALESCE(provider, 'google'),
                updated_at=?
          WHERE id=?`
      ).bind(
        gg.sub,
        email || '',
        email || null,
        email || '',
        email ? email.split('@')[0] : '',
        email ? email.split('@')[0] : gg.sub,
        gg.name || '',
        gg.picture || '',
        now,
        uid,
      ).run();
    } else {
      const res = await env.DB.prepare(
        `INSERT INTO users (google_id, email, login, name, avatar_url, provider, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'google', ?, ?)`
      ).bind(gg.sub, email || null, email ? email.split('@')[0] : gg.sub, gg.name || '', gg.picture || '', now, now).run();
      uid = res.meta.last_row_id;
      await activateTrialForNewUser(env, uid).catch((e) => console.warn('trial activation skipped:', e?.message || e));
    }

    await safeRecordLoginEvent(env, uid, 'google');
    const jwt = await signJWT({ uid, email }, env.JWT_SECRET);
    const r = new URL(redirect);
    r.searchParams.set('token', jwt);
    return Response.redirect(r.toString(), 302);
  } catch (e) {
    console.error('google callback error:', e?.stack || e?.message || e);
    return err('google callback failed', 500);
  }
}

// ───────── routes: me + favorites ─────────
async function routeMe(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  return json(publicUser(u));
}

// GET /me/entitlements — 客户端 UI 渲染用快照（≤24h），写入仍由服务端逐次校验
async function routeMeEntitlements(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  return json(await getEntitlements(env, u, isOwnerUser(u, env)));
}

// ───────── 跨产品会员快照（Todo 等订阅写入统一账号库） ─────────
async function ensureProductMembershipTables(env) {
  await env.DB.batch([
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
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_product_memberships_product
      ON product_memberships(product, status, updated_at)`),
  ]);
}

function internalSecretOk(req, env) {
  const secret = String(env.ACCOUNT_SYNC_SECRET || env.TODO_INTERNAL_SECRET || '').trim();
  if (!secret) return false;
  const got = String(req.headers.get('X-Internal-Secret') || req.headers.get('X-AILATEST-INTERNAL') || '').trim();
  return got && got === secret;
}

/** POST /internal/product-membership — Todo/其它产品回写订阅到统一账号表 */
async function routeInternalProductMembership(req, env) {
  if (!internalSecretOk(req, env)) return err('forbidden', 403);
  const body = await req.json().catch(() => ({}));
  const product = String(body?.product || '').toLowerCase().trim();
  const email = String(body?.email || '').toLowerCase().trim();
  const plan = String(body?.plan || 'free').toLowerCase().trim();
  const status = String(body?.status || 'inactive').toLowerCase().trim();
  const externalKey = String(body?.user_key || body?.external_user_key || '').trim();
  if (!product || product.length > 32) return err('invalid_product', 400);
  if (!email || !isEmail(email)) return err('invalid_email', 400);

  await ensureProductMembershipTables(env);
  // 确保 users 有此邮箱
  let row = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  let uid = row?.id;
  if (!uid) {
    const now = nowSec();
    const login = email.split('@')[0] || email;
    const ins = await env.DB.prepare(
      `INSERT INTO users (email, login, name, provider, created_at, updated_at)
       VALUES (?, ?, ?, 'sync', ?, ?)`
    ).bind(email, login, login, now, now).run();
    uid = ins.meta.last_row_id;
  }
  let paidUntil = null;
  if (body?.current_period_end) {
    const t = Date.parse(body.current_period_end);
    if (Number.isFinite(t)) paidUntil = Math.floor(t / 1000);
  } else if (body?.paid_until != null) {
    paidUntil = Math.floor(Number(body.paid_until)) || null;
  }
  const now = nowSec();
  await env.DB.prepare(
    `INSERT INTO product_memberships (user_id, product, plan, status, paid_until, external_user_key, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, product) DO UPDATE SET
       plan = excluded.plan,
       status = excluded.status,
       paid_until = excluded.paid_until,
       external_user_key = COALESCE(excluded.external_user_key, product_memberships.external_user_key),
       source = excluded.source,
       updated_at = excluded.updated_at`
  ).bind(uid, product, plan, status, paidUntil, externalKey || null, String(body?.source || 'sync'), now).run();

  return json({ ok: true, user_id: uid, product, plan, status, paid_until: paidUntil });
}

/** GET /admin/product-memberships?product=todo — 站长看跨产品会员 */
async function routeAdminProductMemberships(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  if (!isOwnerUser(u, env)) return err('forbidden', 403);
  await ensureProductMembershipTables(env);
  const url = new URL(req.url);
  const product = String(url.searchParams.get('product') || '').trim();
  let rows;
  if (product) {
    rows = await env.DB.prepare(
      `SELECT m.user_id, m.product, m.plan, m.status, m.paid_until, m.external_user_key, m.source, m.updated_at,
              u.email, u.login, u.provider
         FROM product_memberships m
         LEFT JOIN users u ON u.id = m.user_id
        WHERE m.product = ?
        ORDER BY m.updated_at DESC LIMIT 200`
    ).bind(product).all();
  } else {
    rows = await env.DB.prepare(
      `SELECT m.user_id, m.product, m.plan, m.status, m.paid_until, m.external_user_key, m.source, m.updated_at,
              u.email, u.login, u.provider
         FROM product_memberships m
         LEFT JOIN users u ON u.id = m.user_id
        ORDER BY m.updated_at DESC LIMIT 200`
    ).all();
  }
  const summary = await env.DB.prepare(
    `SELECT product, plan, status, COUNT(*) AS n
       FROM product_memberships
      GROUP BY product, plan, status`
  ).all();
  return json({
    ok: true,
    summary: summary.results || [],
    rows: (rows.results || []).map(r => ({
      ...r,
      email: r.email ? String(r.email).replace(/^(.{2}).*(@.*)$/, '$1***$2') : '',
    })),
  });
}

// ───────── gift codes（对齐 Todo 安全模型） ─────────
// - 生成 N 张 → 仅 N 条有效记录，最多成功兑换 N 次
// - 每码仅可兑换一次（gift_redemptions 主键；并发也进 409）
// - 只存 SHA-256，不存明文；码中 MAX/PRO 文案可改无效，套餐以库记录为准
// - 80 bit 随机强度；必须登录兑换；同账号+IP 15 分钟最多 12 次尝试（429）
// - 生成：前端隐藏 + 后端站长邮箱校验（非站长 403）
async function ensureGiftTables(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gift_codes (
      code_hash TEXT PRIMARY KEY,
      code_hint TEXT NOT NULL,
      plan TEXT NOT NULL,
      duration_days INTEGER,
      expires_at INTEGER,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gift_redemptions (
      code_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      redeemed_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gift_redeem_limits (
      limiter_key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    )`),
  ]);
  // 已有表补列（幂等）
  try {
    await env.DB.prepare('ALTER TABLE gift_codes ADD COLUMN revoked_at INTEGER').run();
  } catch (_) { /* column may already exist */ }
}

function normalizeGiftCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function createGiftCodeText(plan) {
  // plan: pro | max。32 字符字母表 ≈ 5 bit/字；16 字 = 80 bit 随机强度
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const token = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  const tag = plan === 'max' ? 'MAX' : 'PRO';
  return `JOURNAL-${tag}-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}-${token.slice(12)}`;
}

async function allowGiftRedeemAttempt(userId, request, env) {
  const ip = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
  const limiterKey = await sha256Hex(`gift:${userId}:${ip}`);
  const now = nowSec();
  const cutoff = now - 15 * 60;
  await env.DB.prepare(
    `INSERT INTO gift_redeem_limits (limiter_key, window_start, attempts)
     VALUES (?, ?, 1)
     ON CONFLICT(limiter_key) DO UPDATE SET
       attempts = CASE WHEN gift_redeem_limits.window_start < ? THEN 1 ELSE gift_redeem_limits.attempts + 1 END,
       window_start = CASE WHEN gift_redeem_limits.window_start < ? THEN excluded.window_start ELSE gift_redeem_limits.window_start END`
  ).bind(limiterKey, now, cutoff, cutoff).run();
  const row = await env.DB.prepare(
    'SELECT attempts FROM gift_redeem_limits WHERE limiter_key = ?'
  ).bind(limiterKey).first();
  return Number(row?.attempts ?? 0) <= 12;
}

/** POST /admin/gift-codes  { plan:'pro'|'max', durationDays:number|null, quantity:1-20 } */
async function routeAdminGiftCodes(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  if (!isOwnerUser(u, env)) return err('forbidden', 403);
  const body = await req.json().catch(() => ({}));
  const productPlan = body?.plan === 'pro' ? 'pro' : body?.plan === 'max' ? 'max' : null;
  const durationRaw = body?.durationDays;
  const durationDays = durationRaw === null || durationRaw === 'permanent'
    ? null
    : Math.floor(Number(durationRaw));
  const quantity = Math.min(20, Math.max(1, Math.floor(Number(body?.quantity ?? 1))));
  if (!productPlan || (durationDays !== null && (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 3650))) {
    return err('invalid_gift_options', 400);
  }
  await ensureGiftTables(env);
  const now = nowSec();
  const codes = [];
  const stmts = [];
  for (let i = 0; i < quantity; i += 1) {
    const code = createGiftCodeText(productPlan);
    const canonical = normalizeGiftCode(code);
    codes.push(code);
    stmts.push(
      env.DB.prepare(
        `INSERT INTO gift_codes (code_hash, code_hint, plan, duration_days, expires_at, created_by, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`
      ).bind(
        await sha256Hex(canonical),
        code.slice(-4),
        productPlan,
        durationDays,
        String(u.email || u.login || u.id),
        now,
      )
    );
  }
  await env.DB.batch(stmts);
  return json({
    codes,
    plan: productPlan,
    durationDays,
    createdAt: now,
    note: 'single_use_server_verified',
  });
}

/**
 * POST /admin/gift-codes/void  { code }
 * 站长作废：未兑换的码立即失效；已兑换不可作废。
 */
async function routeAdminVoidGiftCode(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  if (!isOwnerUser(u, env)) return err('forbidden', 403);
  const body = await req.json().catch(() => ({}));
  const canonical = normalizeGiftCode(body?.code || '');
  if (canonical.length < 12 || canonical.length > 64) return err('invalid_gift_code', 400);
  await ensureGiftTables(env);
  const codeHash = await sha256Hex(canonical);
  const gift = await env.DB.prepare(
    'SELECT code_hash, plan, revoked_at FROM gift_codes WHERE code_hash = ?'
  ).bind(codeHash).first();
  if (!gift) return err('invalid_gift_code', 404);
  if (gift.revoked_at && Number(gift.revoked_at) > 0) {
    return json({ ok: true, voided: true, already: true });
  }
  const redeemed = await env.DB.prepare(
    'SELECT user_id FROM gift_redemptions WHERE code_hash = ?'
  ).bind(codeHash).first();
  if (redeemed) return err('gift_code_already_redeemed', 409);
  const now = nowSec();
  await env.DB.prepare(
    'UPDATE gift_codes SET revoked_at = ? WHERE code_hash = ?'
  ).bind(now, codeHash).run();
  return json({ ok: true, voided: true, plan: gift.plan, voidedAt: now });
}

/** POST /gift-codes/redeem  { code } — 须登录；套餐/时长以库中记录为准 */
async function routeRedeemGiftCode(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const body = await req.json().catch(() => ({}));
  const canonical = normalizeGiftCode(body?.code || '');
  if (canonical.length < 12 || canonical.length > 64) return err('invalid_gift_code', 400);
  await ensureGiftTables(env);
  if (!(await allowGiftRedeemAttempt(u.id, req, env))) {
    return err('too_many_gift_attempts', 429, { 'Retry-After': '900' });
  }
  const codeHash = await sha256Hex(canonical);
  const gift = await env.DB.prepare(
    'SELECT plan, duration_days, expires_at, code_hint, revoked_at FROM gift_codes WHERE code_hash = ?'
  ).bind(codeHash).first();
  // 套餐以库记录为准；改码里的 MAX/PRO 文字无效（哈希对不上）
  if (!gift || (gift.plan !== 'pro' && gift.plan !== 'max')) {
    return err('invalid_gift_code', 404);
  }
  if (gift.revoked_at && Number(gift.revoked_at) > 0) {
    return err('gift_code_voided', 410);
  }
  if (gift.expires_at && Number(gift.expires_at) > 0 && nowSec() > Number(gift.expires_at)) {
    return err('gift_code_expired', 410);
  }
  const redeemed = await env.DB.prepare(
    'SELECT user_id FROM gift_redemptions WHERE code_hash = ?'
  ).bind(codeHash).first();
  if (redeemed) return err('gift_code_used', 409);

  // 产品 max → 内部 pro；产品 pro → 内部 plus
  const internalTier = gift.plan === 'max' ? 'pro' : 'plus';
  const now = nowSec();
  let paidUntil = null;
  if (gift.duration_days != null && Number(gift.duration_days) > 0) {
    let base = now;
    try {
      const row = await env.DB.prepare(
        'SELECT tier, paid_until FROM user_entitlements WHERE user_id = ?'
      ).bind(u.id).first();
      if (row?.paid_until && Number(row.paid_until) > now) base = Number(row.paid_until);
    } catch (_) {}
    paidUntil = base + Number(gift.duration_days) * 86400;
  }
  try {
    await env.DB.prepare(
      'INSERT INTO gift_redemptions (code_hash, user_id, redeemed_at) VALUES (?, ?, ?)'
    ).bind(codeHash, u.id, now).run();
  } catch (_) {
    return err('gift_code_used', 409);
  }
  // 已是 Max 不降级
  let applyTier = internalTier;
  try {
    const cur = await env.DB.prepare(
      'SELECT tier FROM user_entitlements WHERE user_id = ?'
    ).bind(u.id).first();
    if (cur?.tier === 'pro') applyTier = 'pro';
  } catch (_) {}
  await applyPaidSubscription(env, u.id, {
    tier: applyTier,
    paidUntilSec: paidUntil,
    productId: `gift:${gift.plan}:${gift.code_hint || ''}`,
  });
  const productLabel = applyTier === 'pro' ? 'max' : 'pro';
  return json({
    ok: true,
    plan: productLabel,
    tier: applyTier,
    paid_until: paidUntil,
    status: 'gift_active',
  });
}

async function routeApiKeys(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  try {
    await ensureApiKeyTables(env);
    const rows = await env.DB.prepare(
      `SELECT id, name, key_prefix, key_tail, created_at, revoked_at, last_used_at, call_count
         FROM api_keys
        WHERE user_id = ? AND revoked_at IS NULL
        ORDER BY created_at DESC
        LIMIT 50`
    ).bind(u.id).all();
    return json({ ok: true, keys: (rows.results || []).map(publicApiKey) });
  } catch (e) {
    console.error('routeApiKeys', e?.message || e);
    return err('api keys unavailable: ' + (e?.message || 'error'), 500);
  }
}

async function routeCreateApiKey(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  try {
    await ensureApiKeyTables(env);
    const body = await req.json().catch(() => ({}));
    const name = cleanText(body?.name || 'My API', 80) || 'My API';
    const existing = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ? AND revoked_at IS NULL'
    ).bind(u.id).first();
    if (Number(existing?.n || 0) >= 10) return err('api key limit reached', 429);
    const secret = apiKeySecret();
    const now = nowSec();
    const id = crypto.randomUUID();
    const keyPrefix = secret.slice(0, 8);
    const keyTail = secret.slice(-6);
    const hash = await apiKeyHash(secret, env);
    const row = {
      id,
      name,
      key_prefix: keyPrefix,
      key_tail: keyTail,
      created_at: now,
      revoked_at: null,
      last_used_at: null,
      call_count: 0,
    };
    await env.DB.prepare(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, key_tail, created_at, call_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(id, u.id, name, hash, keyPrefix, keyTail, now).run();
    return json({ ok: true, secret, key: publicApiKey(row) }, 201);
  } catch (e) {
    console.error('routeCreateApiKey', e?.message || e);
    return err('create api key failed: ' + (e?.message || 'error'), 500);
  }
}

async function routeRevokeApiKey(req, env, id) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  await ensureApiKeyTables(env);
  const keyId = cleanText(id || '', 80);
  if (!keyId) return err('invalid id', 400);
  await env.DB.prepare(
    'UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL'
  ).bind(nowSec(), keyId, u.id).run();
  return json({ ok: true });
}

async function routeGetFavs(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const rows = await env.DB.prepare(
    'SELECT journal_key FROM favorites WHERE user_id = ?'
  ).bind(u.id).all();
  return json({ favs: (rows.results || []).map(r => r.journal_key) });
}

async function routePutFavs(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.favs)) return err('invalid body');
  const favs = body.favs.filter(x => typeof x === 'string' && x.length <= 200).slice(0, 5000);

  // tier 限额：free 5 本；超限后冻结（可删可排序，不可新增）。spec enforcement 规则 1。
  const gate = await enforceFavoritesWrite(env, u, isOwnerUser(u), favs);
  if (!gate.ok) return json(gate.body, gate.status);

  const now = nowSec();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM favorites WHERE user_id = ?').bind(u.id),
    ...favs.map(k =>
      env.DB.prepare(
        'INSERT INTO favorites (user_id, journal_key, created_at) VALUES (?, ?, ?)'
      ).bind(u.id, k, now)
    ),
  ]);
  return json({ ok: true, count: favs.length });
}

// ───────── routes: fav_lists (multi-list cloud sync) ─────────

// GET /lists  → { lists: [{id, name, ids:[]}] }
async function routeGetLists(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const rows = await env.DB.prepare(
    'SELECT list_id, name, ids_json FROM fav_lists WHERE user_id = ? ORDER BY sort_index ASC, list_id ASC'
  ).bind(u.id).all();
  const lists = (rows.results || []).map(r => {
    let ids = [];
    try { const a = JSON.parse(r.ids_json); if (Array.isArray(a)) ids = a.filter(x => typeof x === 'string'); } catch (_) {}
    return { id: r.list_id, name: r.name, ids };
  });
  return json({ lists });
}

// PUT /lists  body { lists: [{id, name, ids:[]}] }  → 整组替换
async function routePutLists(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.lists)) return err('invalid body');

  const clean = [];
  for (const l of body.lists.slice(0, 50)) {
    if (!l || typeof l !== 'object') continue;
    const id = typeof l.id === 'string' ? l.id.trim().slice(0, 64) : '';
    const name = typeof l.name === 'string' ? l.name.trim().slice(0, 80) : '';
    if (!id || !name) continue;
    const ids = Array.isArray(l.ids)
      ? l.ids.filter(x => typeof x === 'string' && x.length <= 200).slice(0, 5000)
      : [];
    clean.push({ id, name, ids });
  }

  // tier 限额：free 2 个清单 / 收藏并集 5 本；超限清单只读（可整单删除）。spec enforcement 规则 1。
  const gate = await enforceListsWrite(env, u, isOwnerUser(u), clean);
  if (!gate.ok) return json(gate.body, gate.status);

  const now = nowSec();
  const stmts = [
    env.DB.prepare('DELETE FROM fav_lists WHERE user_id = ?').bind(u.id),
    ...clean.map((l, i) =>
      env.DB.prepare(
        `INSERT INTO fav_lists (user_id, list_id, name, sort_index, ids_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(u.id, l.id, l.name, i, JSON.stringify(l.ids), now, now)
    ),
  ];
  await env.DB.batch(stmts);
  return json({ ok: true, count: clean.length });
}

// ───────── routes: ratings ─────────

// Normalize journal_key: strip whitespace, limit length
function normalizeJournalKey(k) {
  if (typeof k !== 'string') return null;
  const s = k.trim();
  if (!s || s.length > 200) return null;
  return s;
}

// Read-only endpoint — no auth required. GET /ratings?keys=a,b,c (max 200)
async function routeGetRatings(req, env) {
  const u = new URL(req.url);
  const raw = (u.searchParams.get('keys') || '').trim();
  if (!raw) return json({ ratings: {} });
  const keys = raw.split(',').map(normalizeJournalKey).filter(Boolean).slice(0, 200);
  if (!keys.length) return json({ ratings: {} });
  const placeholders = keys.map(() => '?').join(',');
  const rows = await env.DB.prepare(
    `SELECT journal_key, AVG(rating) AS avg_r, COUNT(*) AS n
       FROM ratings WHERE journal_key IN (${placeholders})
      GROUP BY journal_key`
  ).bind(...keys).all();

  // Optional: if Bearer token, also return this user's own ratings for those keys
  let mine = {};
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (tok) {
    const user = await getUser(req, env).catch(() => null);
    if (user) {
      const myRows = await env.DB.prepare(
        `SELECT journal_key, rating FROM ratings
          WHERE user_id = ? AND journal_key IN (${placeholders})`
      ).bind(user.id, ...keys).all();
      for (const r of (myRows.results || [])) mine[r.journal_key] = r.rating;
    }
  }

  const out = {};
  for (const r of (rows.results || [])) {
    out[r.journal_key] = {
      avg: Math.round(r.avg_r * 10) / 10,
      n: r.n,
      mine: mine[r.journal_key] ?? null,
    };
  }
  // Ensure keys with no ratings return a stub (so frontend knows)
  for (const k of keys) {
    if (!(k in out)) out[k] = { avg: null, n: 0, mine: mine[k] ?? null };
  }
  return json({ ratings: out });
}

// PUT /ratings { journal_key, rating }   (0.5-5.0, step 0.5)
async function routePutRating(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const body = await req.json().catch(() => null);
  if (!body) return err('invalid body');
  const key = normalizeJournalKey(body.journal_key);
  if (!key) return err('invalid journal_key');
  const n = Number(body.rating);
  if (!Number.isFinite(n) || n < 0.5 || n > 5 || (n * 2) % 1 !== 0) {
    return err('rating must be 0.5 / 1.0 / ... / 5.0');
  }
  const now = nowSec();
  await env.DB.prepare(
    `INSERT INTO ratings (user_id, journal_key, rating, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, journal_key) DO UPDATE SET rating = excluded.rating, updated_at = excluded.updated_at`
  ).bind(u.id, key, n, now, now).run();

  // return new aggregate
  const row = await env.DB.prepare(
    'SELECT AVG(rating) AS avg_r, COUNT(*) AS n FROM ratings WHERE journal_key = ?'
  ).bind(key).first();
  return json({
    ok: true,
    journal_key: key,
    mine: n,
    avg: row && row.avg_r != null ? Math.round(row.avg_r * 10) / 10 : null,
    n: row ? row.n : 0,
  });
}

// DELETE /ratings { journal_key }
async function routeDeleteRating(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const body = await req.json().catch(() => null);
  if (!body) return err('invalid body');
  const key = normalizeJournalKey(body.journal_key);
  if (!key) return err('invalid journal_key');
  await env.DB.prepare(
    'DELETE FROM ratings WHERE user_id = ? AND journal_key = ?'
  ).bind(u.id, key).run();
  const row = await env.DB.prepare(
    'SELECT AVG(rating) AS avg_r, COUNT(*) AS n FROM ratings WHERE journal_key = ?'
  ).bind(key).first();
  return json({
    ok: true,
    journal_key: key,
    mine: null,
    avg: row && row.avg_r != null ? Math.round(row.avg_r * 10) / 10 : null,
    n: row ? row.n : 0,
  });
}

// ───────── routes: shares (一键分享收藏夹) ─────────

const SHARE_ID_ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function genShareId() {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let out = '';
  for (const b of buf) out += SHARE_ID_ALPHA[b % 62];
  return out;
}

function ownerDisplayName(u) {
  return cleanText(u.name || u.login || (u.email ? u.email.split('@')[0] : 'user'), 60) || 'user';
}

// POST /share  body { name, items:[{issn?,cn_code?,name?}], expires_days? | ttl_days? }  → { id, url }
async function routeCreateShare(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const body = await req.json().catch(() => null);
  if (!body) return err('invalid body');
  const name = cleanText(body.name || '', 80);
  if (!name) return err('name required');

  // 兼容两种格式：items: [{issn, cn_code, name}] (新) | ids: [string] (旧)
  let items = [];
  if (Array.isArray(body.items)) {
    items = body.items
      .map(it => ({
        issn: cleanText(it?.issn || '', 32),
        cn_code: cleanText(it?.cn_code || '', 32),
        name: cleanText(it?.name || '', 200),
      }))
      .filter(it => it.issn || it.cn_code || it.name)
      .slice(0, 5000);
  } else if (Array.isArray(body.ids)) {
    items = body.ids
      .filter(x => typeof x === 'string' && x.length > 0 && x.length <= 200)
      .slice(0, 5000)
      .map(s => ({ issn: '', cn_code: '', name: s }));
  }
  if (!items.length) return err('items empty');

  const days = Number(body.expires_days ?? body.ttl_days);
  const now = nowSec();
  let expiresAt = null;
  if (Number.isFinite(days) && days > 0 && days <= 3650) {
    expiresAt = now + Math.floor(days) * 86400;
  } else if (body.expires_days === null || body.expires_days === 0) {
    expiresAt = null;  // 永久
  } else {
    expiresAt = now + 90 * 86400;  // 默认 90 天
  }

  // 重试 5 次防主键冲突
  for (let i = 0; i < 5; i++) {
    const id = genShareId();
    try {
      await env.DB.prepare(
        `INSERT INTO shares (id, owner_uid, owner_name, name, items_json, view_count, import_count, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`
      ).bind(id, u.id, ownerDisplayName(u), name, JSON.stringify(items), now, expiresAt).run();
      return json({
        ok: true,
        id,
        url: `${env.SITE_URL || 'https://journal.ailatest.org'}/s/${id}`,
        expires_at: expiresAt,
        count: items.length,
      });
    } catch (e) {
      if (i === 4) return err('share id collision', 500);
    }
  }
}

// GET /share/:id  → { name, owner_name, items:[], view_count, expires_at, expired }
async function routeGetShare(req, env, id) {
  const row = await env.DB.prepare(
    'SELECT owner_uid, owner_name, name, items_json, view_count, expires_at, created_at FROM shares WHERE id = ?'
  ).bind(id).first();

  if (!row) return err('not found', 404);

  const expired = row.expires_at && row.expires_at < nowSec();
  // 兼容旧格式（字符串 ids 数组）和新格式（{issn, cn_code, name} 对象数组）
  let items = [];
  try {
    const a = JSON.parse(row.items_json);
    if (Array.isArray(a)) {
      items = a.map(x => {
        if (typeof x === 'string') return { issn: '', cn_code: '', name: x };
        return {
          issn: x?.issn || '',
          cn_code: x?.cn_code || '',
          name: x?.name || '',
        };
      });
    }
  } catch (_) {}

  // 浏览数 +1（不阻塞响应）
  if (!expired) {
    await env.DB.prepare('UPDATE shares SET view_count = view_count + 1 WHERE id = ?')
      .bind(id).run().catch(() => {});
  }

  return json({
    id,
    name: row.name,
    owner_name: row.owner_name || 'user',
    items,
    count: items.length,
    view_count: (row.view_count || 0) + (expired ? 0 : 1),
    created_at: row.created_at,
    expires_at: row.expires_at,
    expired: !!expired,
  });
}

// POST /share/:id/import  (auth) → 把分享的 ids 导入为新的收藏夹
async function routeImportShare(req, env, id) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const row = await env.DB.prepare(
    'SELECT owner_name, name, items_json, expires_at FROM shares WHERE id = ?'
  ).bind(id).first();

  if (!row) return err('not found', 404);
  if (row.expires_at && row.expires_at < nowSec()) return err('expired', 410);

  // 兼容旧 ids 数组 / 新 items 对象数组；统一抽出 favId 字符串
  let ids = [];
  try {
    const a = JSON.parse(row.items_json);
    if (Array.isArray(a)) {
      ids = a.map(x => {
        if (typeof x === 'string') return x;
        // 富对象按 favId 优先级：issn → cn_code → t:normTitle(name)
        if (x?.issn) return String(x.issn);
        if (x?.cn_code) return String(x.cn_code);
        if (x?.name) {
          const norm = String(x.name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
          return norm ? 't:' + norm : '';
        }
        return '';
      }).filter(s => typeof s === 'string' && s.length > 0);
    }
  } catch (_) {}
  if (!ids.length) return err('share empty', 400);

  const now = nowSec();
  const newListId = `s_${id}_${now.toString(36)}`;
  const newName = `@${row.owner_name || 'user'} 分享的 ${row.name}`.slice(0, 80);

  // 取当前最大 sort_index
  const maxRow = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_index), -1) AS m FROM fav_lists WHERE user_id = ?'
  ).bind(u.id).first();
  const sortIndex = (maxRow?.m ?? -1) + 1;

  await env.DB.prepare(
    `INSERT INTO fav_lists (user_id, list_id, name, sort_index, ids_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(u.id, newListId, newName, sortIndex, JSON.stringify(ids), now, now).run();

  await env.DB.prepare('UPDATE shares SET import_count = import_count + 1 WHERE id = ?')
    .bind(id).run().catch(() => {});

  return json({ ok: true, list_id: newListId, name: newName, count: ids.length });
}

// GET /shares/mine  → 当前用户创建的分享列表
async function routeMyShares(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const rows = await env.DB.prepare(
    `SELECT id, name, view_count, import_count, created_at, expires_at,
            (SELECT json_array_length(items_json)) AS n
       FROM shares WHERE owner_uid = ? ORDER BY created_at DESC LIMIT 100`
  ).bind(u.id).all();
  return json({ shares: rows.results || [] });
}

// DELETE /share/:id  (auth, owner only)
async function routeDeleteShare(req, env, id) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  const row = await env.DB.prepare('SELECT owner_uid FROM shares WHERE id = ?').bind(id).first();

  if (!row) return err('not found', 404);
  if (row.owner_uid !== u.id) return err('forbidden', 403);
  await env.DB.prepare('DELETE FROM shares WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ───────── routes: journal_views (期刊浏览计数) ─────────
async function recordJournalViewEvent(req, env, body, context = {}) {
  const now = context.now || nowSec();
  const eventTs = context.eventTs || clampEventTs(body?.event_time || body?.event_ts, now);
  const visitorId = cleanText(body?.visitor_id || '', 80);
  const sessionId = cleanText(body?.session_id || '', 80);
  const referrer = cleanText(body?.referrer || '', 300);
  const userAgent = cleanText(body?.user_agent || req.headers.get('user-agent') || '', 500);
  const cf = req.cf || {};
  const country = cleanText(context.country || cf.country || '', 16);
  const ipHash = context.ipHash ?? await requestIpHash(req, env);
  const vHash = context.visitorHash || visitorHash(ipHash, visitorId);
  const traffic = context.traffic || await classifyRequestTraffic(env, req, {
    ua: userAgent,
    ipHash,
    visitorHash: vHash,
    referrer,
    viewSource: cleanText(body?.view_source || '', 80),
    country,
  }).catch(() => ({
    traffic_type: body?.is_bot ? 'scraper' : 'human',
    is_bot: body?.is_bot ? 1 : 0,
    bot_reason: body?.is_bot ? 'client_bot_hint' : '',
  }));
  const u = context.user || await getUser(req, env).catch(() => null);

  await env.DB.prepare(
    `INSERT INTO journal_view_events (
      journal_key, user_id, visitor_id, session_id, path, viewed_at,
      referrer, user_agent, is_bot, country, ip_hash, device, browser, event_time,
      traffic_type, bot_reason, visitor_hash, journal_name, journal_issn,
      view_source, query, tab
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    normalizeJournalKey(body?.journal_key),
    u?.id || null,
    visitorId,
    sessionId,
    cleanText(body?.path || '/', 240) || '/',
    eventTs,
    referrer,
    userAgent,
    Number(traffic.is_bot || 0),
    country,
    ipHash,
    cleanText(body?.device || '', 40),
    cleanText(body?.browser || '', 60),
    eventTs,
    cleanText(traffic.traffic_type || 'human', 40),
    cleanText(traffic.bot_reason || '', 240),
    vHash,
    cleanText(body?.journal_name || '', 300),
    cleanText(body?.journal_issn || '', 80),
    cleanText(body?.view_source || '', 80),
    cleanText(body?.query || '', 240),
    cleanText(body?.tab || '', 80),
  ).run();
}

// POST /journal-view  body { journal_key }   (无需登录)
async function routeJournalView(req, env) {
  const body = await req.json().catch(() => null);
  const key = normalizeJournalKey(body?.journal_key);
  if (!key) return err('invalid journal_key');
  const now = nowSec();
  const eventTs = clampEventTs(body?.event_time || body?.event_ts, now);
  if (isInternalAnalyticsVisitor(body?.visitor_id)) {
    const row = await env.DB.prepare(
      'SELECT count FROM journal_views WHERE journal_key = ?'
    ).bind(key).first().catch(() => null);
    return json({ ok: true, ignored: true, reason: 'internal_visitor', journal_key: key, count: row ? row.count : 0 });
  }
  await env.DB.prepare(
    `INSERT INTO journal_views (journal_key, count, updated_at)
     VALUES (?, 1, ?)
     ON CONFLICT(journal_key) DO UPDATE SET
       count = count + 1,
       updated_at = excluded.updated_at`
  ).bind(key, eventTs).run();
  await recordJournalViewEvent(req, env, { ...body, journal_key: key }, { now, eventTs });
  const row = await env.DB.prepare(
    'SELECT count FROM journal_views WHERE journal_key = ?'
  ).bind(key).first();
  return json({ ok: true, journal_key: key, count: row ? row.count : 1 });
}

// GET /journal-views?keys=k1,k2,...   (批量，最多 500)
async function routeGetJournalViews(req, env) {
  const u = new URL(req.url);
  const raw = (u.searchParams.get('keys') || '').trim();
  if (!raw) return json({ views: {} });
  const keys = raw.split(',').map(normalizeJournalKey).filter(Boolean).slice(0, 500);
  if (!keys.length) return json({ views: {} });
  const placeholders = keys.map(() => '?').join(',');
  const rows = await env.DB.prepare(
    `SELECT journal_key, count FROM journal_views WHERE journal_key IN (${placeholders})`
  ).bind(...keys).all();
  const out = {};
  for (const r of (rows.results || [])) out[r.journal_key] = r.count;
  for (const k of keys) if (!(k in out)) out[k] = 0;
  return json({ views: out });
}

// GET /journal-view-total  (公开总量，不含用户明细)
async function routeGetJournalViewTotal(req, env) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS viewed_journals,
      COALESCE(SUM(count),0) AS total_journal_views,
      MAX(updated_at) AS latest_journal_view_at
     FROM journal_views`
  ).first();
  return json({
    ok: true,
    viewed_journals: Number(row?.viewed_journals || 0),
    total_journal_views: Number(row?.total_journal_views || 0),
    latest_journal_view_at: row?.latest_journal_view_at || null,
  });
}

function normalizeOpenAlexIssn(value) {
  const compact = cleanText(value || '', 32).toUpperCase().replace(/[^0-9X]/g, '');
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : '';
}

function normalizeOpenAlexCountry(group) {
  const code = cleanText(group?.code || '', 12).toUpperCase();
  const name = cleanText(group?.name || '', 120);
  if (['CN', 'TW', 'HK', 'MO'].includes(code) || /^(china|taiwan|hong kong|macao|macau)$/i.test(name)) {
    return { code: 'CN', name: 'China' };
  }
  return { code, name };
}

// Crossref affiliations are free-text, so keep a conservative alias table and
// only accept a country when it appears as the final comma/semicolon-delimited
// part of an affiliation. This avoids mistaking university or department names
// for countries while still covering the common forms used by Crossref deposits.
const CROSSREF_COUNTRY_ALIASES = [
  ['united states of america', 'United States'], ['united states', 'United States'], ['usa', 'United States'], ['us', 'United States'],
  ['united kingdom', 'United Kingdom'], ['great britain', 'United Kingdom'], ['england', 'United Kingdom'], ['scotland', 'United Kingdom'], ['wales', 'United Kingdom'], ['northern ireland', 'United Kingdom'], ['uk', 'United Kingdom'],
  ['people\'s republic of china', 'China'], ['people’s republic of china', 'China'], ['pr china', 'China'], ['china', 'China'], ['taiwan', 'China'], ['hong kong', 'China'], ['macao', 'China'], ['macau', 'China'],
  ['south korea', 'South Korea'], ['republic of korea', 'South Korea'], ['korea, republic of', 'South Korea'], ['korea', 'South Korea'],
  ['the netherlands', 'Netherlands'], ['netherlands', 'Netherlands'], ['russian federation', 'Russia'], ['russia', 'Russia'], ['iran, islamic republic of', 'Iran'], ['islamic republic of iran', 'Iran'], ['iran', 'Iran'],
  ['czech republic', 'Czechia'], ['czechia', 'Czechia'], ['turkey', 'Türkiye'], ['türkiye', 'Türkiye'], ['uae', 'United Arab Emirates'], ['united arab emirates', 'United Arab Emirates'],
  ['australia', 'Australia'], ['new zealand', 'New Zealand'], ['canada', 'Canada'], ['germany', 'Germany'], ['france', 'France'], ['italy', 'Italy'], ['spain', 'Spain'], ['portugal', 'Portugal'],
  ['belgium', 'Belgium'], ['switzerland', 'Switzerland'], ['austria', 'Austria'], ['poland', 'Poland'], ['slovakia', 'Slovakia'], ['hungary', 'Hungary'], ['romania', 'Romania'], ['bulgaria', 'Bulgaria'],
  ['greece', 'Greece'], ['sweden', 'Sweden'], ['norway', 'Norway'], ['denmark', 'Denmark'], ['finland', 'Finland'], ['iceland', 'Iceland'], ['ireland', 'Ireland'], ['ukraine', 'Ukraine'],
  ['israel', 'Israel'], ['iraq', 'Iraq'], ['saudi arabia', 'Saudi Arabia'], ['qatar', 'Qatar'], ['jordan', 'Jordan'], ['egypt', 'Egypt'], ['lebanon', 'Lebanon'], ['syria', 'Syria'], ['yemen', 'Yemen'],
  ['south africa', 'South Africa'], ['nigeria', 'Nigeria'], ['kenya', 'Kenya'], ['ethiopia', 'Ethiopia'], ['ghana', 'Ghana'], ['morocco', 'Morocco'], ['tunisia', 'Tunisia'], ['algeria', 'Algeria'],
  ['india', 'India'], ['pakistan', 'Pakistan'], ['bangladesh', 'Bangladesh'], ['sri lanka', 'Sri Lanka'], ['nepal', 'Nepal'], ['japan', 'Japan'], ['vietnam', 'Vietnam'], ['thailand', 'Thailand'],
  ['malaysia', 'Malaysia'], ['singapore', 'Singapore'], ['indonesia', 'Indonesia'], ['philippines', 'Philippines'], ['myanmar', 'Myanmar'], ['cambodia', 'Cambodia'], ['brunei', 'Brunei'], ['mongolia', 'Mongolia'],
  ['kazakhstan', 'Kazakhstan'], ['uzbekistan', 'Uzbekistan'], ['colombia', 'Colombia'], ['brazil', 'Brazil'], ['argentina', 'Argentina'], ['chile', 'Chile'], ['peru', 'Peru'], ['mexico', 'Mexico'],
  ['ecuador', 'Ecuador'], ['costa rica', 'Costa Rica'], ['panama', 'Panama'], ['cuba', 'Cuba'], ['jamaica', 'Jamaica'], ['uruguay', 'Uruguay'], ['venezuela', 'Venezuela'], ['bolivia', 'Bolivia'],
  ['paraguay', 'Paraguay'], ['dominican republic', 'Dominican Republic'], ['albania', 'Albania'], ['armenia', 'Armenia'], ['azerbaijan', 'Azerbaijan'], ['georgia', 'Georgia'], ['serbia', 'Serbia'],
  ['croatia', 'Croatia'], ['slovenia', 'Slovenia'], ['bosnia and herzegovina', 'Bosnia and Herzegovina'], ['north macedonia', 'North Macedonia'], ['montenegro', 'Montenegro'], ['moldova', 'Moldova'],
  ['belarus', 'Belarus'], ['lithuania', 'Lithuania'], ['latvia', 'Latvia'], ['estonia', 'Estonia'], ['cyprus', 'Cyprus'], ['malta', 'Malta'], ['luxembourg', 'Luxembourg'], ['liechtenstein', 'Liechtenstein'],
  ['palestine', 'Palestine'], ['bahrain', 'Bahrain'], ['kuwait', 'Kuwait'], ['oman', 'Oman'], ['sudan', 'Sudan'], ['tanzania', 'Tanzania'], ['uganda', 'Uganda'], ['zimbabwe', 'Zimbabwe'],
  ['zambia', 'Zambia'], ['botswana', 'Botswana'], ['namibia', 'Namibia'], ['mauritius', 'Mauritius'], ['rwanda', 'Rwanda'], ['senegal', 'Senegal'], ['cameroon', 'Cameroon'], ['malawi', 'Malawi'],
  ['mozambique', 'Mozambique'], ['madagascar', 'Madagascar'], ['eswatini', 'Eswatini'], ['lesotho', 'Lesotho'], ['fiji', 'Fiji'], ['papua new guinea', 'Papua New Guinea'], ['samoa', 'Samoa'],
].sort((a, b) => b[0].length - a[0].length);

function normalizeCrossrefCountry(affiliation) {
  const text = String(affiliation || '')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:)\]]+$/g, '');
  if (!text) return null;
  const parts = text.split(/[,;|\n]+/).map((part) => part.trim().replace(/^[\[({]+|[\]})]+$/g, '')).filter(Boolean);
  const candidates = parts.slice(Math.max(0, parts.length - 3));
  for (const candidate of candidates.reverse()) {
    const key = candidate.toLowerCase().replace(/[.]+$/g, '').trim();
    const match = CROSSREF_COUNTRY_ALIASES.find(([alias]) => alias === key);
    if (match) return normalizeOpenAlexCountry({ name: match[1] });
  }
  const lower = text.toLowerCase();
  for (const [alias, name] of CROSSREF_COUNTRY_ALIASES) {
    if (lower.endsWith(` ${alias}`) || lower.endsWith(`,${alias}`)) {
      return normalizeOpenAlexCountry({ name });
    }
  }
  return null;
}

async function fetchCrossrefCountryYear(sourceIssn, year, attempt = 0) {
  const params = new URLSearchParams({
    filter: `from-pub-date:${year}-01-01,until-pub-date:${year}-12-31`,
    rows: '1000',
    select: 'DOI,title,author,issued',
    mailto: 'ailatest@ailatest.org',
  });
  let resp;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    resp = await fetch(`https://api.crossref.org/journals/${encodeURIComponent(sourceIssn)}/works?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AILatest Journal Crossref country-output fallback (mailto:ailatest@ailatest.org)',
      },
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (_) {
    return { year, total: 0, groups: [], skipped: true, status: 0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (resp.status === 429 && attempt < 2) {
    const raSec = Number(resp.headers.get('Retry-After') || 0);
    const wait = Math.min(raSec > 0 ? raSec * 1000 : 800 * (attempt + 1), 5000);
    await new Promise((resolve) => setTimeout(resolve, wait));
    return fetchCrossrefCountryYear(sourceIssn, year, attempt + 1);
  }
  if (!resp.ok) return { year, total: 0, groups: [], skipped: true, status: resp.status };
  const data = await resp.json().catch(() => ({}));
  const items = Array.isArray(data?.message?.items) ? data.message.items : [];
  const groups = new Map();
  for (const item of items) {
    const countries = new Map();
    for (const author of (Array.isArray(item?.author) ? item.author : [])) {
      const affiliations = Array.isArray(author?.affiliation) ? author.affiliation : [];
      for (const affiliation of affiliations) {
        const raw = typeof affiliation === 'string' ? affiliation : affiliation?.name;
        const country = normalizeCrossrefCountry(raw);
        if (country?.name) countries.set(country.name, country);
      }
    }
    for (const country of countries.values()) {
      const current = groups.get(country.name) || { ...country, count: 0 };
      current.count += 1;
      groups.set(country.name, current);
    }
  }
  return {
    year,
    // Keep all Crossref works in the denominator; missing/unparseable
    // affiliations remain visible as the chart's “Other” segment.
    total: items.length,
    groups: [...groups.values()],
    skipped: false,
    status: resp.status,
  };
}

async function fetchOpenAlexCountryYear(sourceIssn, year, apiKey = '', attempt = 0, maxRetries = 3) {
  const params = new URLSearchParams({
    filter: `primary_location.source.issn:${sourceIssn},from_publication_date:${year}-01-01,to_publication_date:${year}-12-31`,
    group_by: 'authorships.institutions.country_code',
    'per-page': '200',
    mailto: 'ailatest@ailatest.org',
  });
  if (apiKey) params.set('api_key', apiKey);
  let resp;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
  try {
    resp = await fetch(`https://api.openalex.org/works?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'AILatest Journal country-output cache (mailto:ailatest@ailatest.org)' },
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (_) {
    return { year, total: 0, groups: [], skipped: true, status: 0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
  // 礼貌池限流：短暂退避后重试
  if (resp.status === 429 && attempt < maxRetries) {
    const raSec = Number(resp.headers.get('Retry-After') || 0);
    // 封顶 5s：详情页不能等数小时的 Retry-After
    const wait = Math.min(raSec > 0 ? raSec * 1000 : 800 * (attempt + 1), 5000);
    await new Promise(r => setTimeout(r, wait));
    return fetchOpenAlexCountryYear(sourceIssn, year, apiKey, attempt + 1, maxRetries);
  }
  if (!resp.ok) return { year, total: 0, groups: [], skipped: true, status: resp.status };
  const data = await resp.json();
  const groups = (data.group_by || [])
    .map(g => ({
      code: String(g.key || '').split('/').pop()?.replace(/^countries\//i, '') || '',
      name: String(g.key_display_name || '').trim(),
      count: Number(g.count || 0),
    }))
    .filter(g => g.count > 0 && g.name && !/^unknown$/i.test(g.name));
  const merged = new Map();
  for (const group of groups) {
    const key = normalizeOpenAlexCountry(group);
    if (!key.name) continue;
    const current = merged.get(key.name) || { ...key, count: 0 };
    current.count += group.count;
    merged.set(key.name, current);
  }
  const mergedGroups = [...merged.values()];
  const total = mergedGroups.reduce((sum, group) => sum + group.count, 0);
  return { year, total, groups: mergedGroups, status: resp.status };
}

function buildCountryOutputPayload(rows, source = 'openalex') {
  const usable = rows
    .filter(row => row.total > 0 && Array.isArray(row.groups) && row.groups.length)
    .sort((a, b) => a.year - b.year);
  if (!usable.length) return null;
  const countryTotals = new Map();
  usable.forEach(row => row.groups.forEach(group => {
    countryTotals.set(group.name, (countryTotals.get(group.name) || 0) + group.count);
  }));
  const ranked = [...countryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  // 有中国数据时置顶；否则用真实 Top，避免空 China 占位导致图空白
  const top = (ranked.includes('China')
    ? ['China', ...ranked.filter((n) => n !== 'China')]
    : ranked
  ).slice(0, 5);
  if (!top.length) return null;
  return { ok: true, years: usable, top, source };
}

async function fetchCrossrefCountryOutput(issns, years, attempts = []) {
  for (const sourceIssn of issns) {
    const rows = await Promise.all(years.map((year) => fetchCrossrefCountryYear(sourceIssn, year)));
    for (const row of rows) {
      if (row.skipped) {
        attempts.push({ source: 'crossref', issn: sourceIssn, year: row.year, total: row.total, status: row.status || 200, skipped: true });
      }
    }
    const payload = buildCountryOutputPayload(rows, 'crossref');
    if (payload) {
      payload.issn = sourceIssn;
      return payload;
    }
  }
  return null;
}

// The edge Cache API is useful for hot traffic, but it is not a durable
// journal-level cache: a cold POP can still re-query the upstream provider.
// Keep the successful result in D1 as well, so a temporary OpenAlex/Crossref
// outage does not turn every new detail-page request into another upstream
// request.  The table is added by migration 0024; all helpers are deliberately
// best-effort so an older database can continue serving live fallbacks.
const COUNTRY_OUTPUT_D1_TTL = 7 * 86400;

function countryOutputD1Key(issns, years) {
  return `${issns.join(',')}|${years.join(',')}`;
}

async function readCountryOutputD1(env, cacheKey) {
  if (!env?.DB) return null;
  try {
    const row = await env.DB.prepare(
      'SELECT payload_json, expires_at FROM country_output_cache WHERE cache_key = ?1'
    ).bind(cacheKey).first();
    if (!row || Number(row.expires_at || 0) <= nowSec()) return null;
    const payload = JSON.parse(String(row.payload_json || ''));
    return payload?.years?.length ? payload : null;
  } catch (_) {
    // Migration may not have reached an older environment yet.
    return null;
  }
}

async function writeCountryOutputD1(env, cacheKey, issns, years, payload, ttlSeconds = COUNTRY_OUTPUT_D1_TTL) {
  if (!env?.DB || !payload?.years?.length) return;
  const now = nowSec();
  try {
    await env.DB.prepare(
      `INSERT INTO country_output_cache
        (cache_key, issns, years, payload_json, source, fetched_at, expires_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?6)
       ON CONFLICT(cache_key) DO UPDATE SET
        issns = excluded.issns,
        years = excluded.years,
        payload_json = excluded.payload_json,
        source = excluded.source,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at`
    ).bind(
      cacheKey,
      issns.join(','),
      years.join(','),
      JSON.stringify(payload),
      cleanText(payload.source || '', 32),
      now,
      now + Math.max(3600, Number(ttlSeconds || COUNTRY_OUTPUT_D1_TTL)),
    ).run();
  } catch (_) {
    // A cache write must never make the public data endpoint fail.
  }
}

// The preloader stores one target year at a time.  A detail page may ask for
// a different three-year window, so merge any still-valid rows for the same
// ISSN pair before going back to an upstream provider.
async function readCountryOutputD1Partial(env, issns, years) {
  if (!env?.DB || !issns.length || !years.length) return null;
  try {
    const variants = [...new Set([issns.join(','), ...issns])];
    const placeholders = variants.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT payload_json, expires_at, source
         FROM country_output_cache
        WHERE issns IN (${placeholders}) AND expires_at > ?`
    ).bind(...variants, nowSec()).all();
    const wanted = new Set(years.map(Number));
    const merged = new Map();
    let hasOpenAlex = false;
    for (const row of (rows.results || [])) {
      let payload;
      try { payload = JSON.parse(String(row.payload_json || '')); } catch (_) { payload = null; }
      if (!payload?.years?.length) continue;
      if (String(row.source || payload.source || '').toLowerCase() === 'openalex') hasOpenAlex = true;
      for (const point of payload.years) {
        const year = Number(point?.year);
        if (!wanted.has(year) || !Number(point?.total || 0) || !Array.isArray(point?.groups)) continue;
        merged.set(year, point);
      }
    }
    if (!merged.size) return null;
    const payload = buildCountryOutputPayload([...merged.values()], hasOpenAlex ? 'openalex' : 'crossref');
    if (!payload) return null;
    payload.issn = issns[0];
    return payload;
  } catch (_) {
    return null;
  }
}

const COUNTRY_PRELOAD_YEAR = 2025;
const COUNTRY_PRELOAD_DAILY_JOB_LIMIT = 8000;
// Four 15-minute invocations per hour can process about 1,000 jobs/hour.
// This uses the daily allowance within roughly eight hours while leaving the
// explicit 8,000-attempt guard in place for quota safety.
const COUNTRY_PRELOAD_BATCH_LIMIT = 250;
const COUNTRY_PRELOAD_SEED_PER_RUN = 5000;
const COUNTRY_PRELOAD_CONCURRENCY = 8;
const COUNTRY_PRELOAD_LOCK_SECONDS = 20 * 60;
const COUNTRY_PRELOAD_CACHE_TTL = 45 * 86400;
const COUNTRY_PRELOAD_MANIFEST_PATH = '/data/country_preload_top_2025.json';
const COUNTRY_PRELOAD_MANIFEST_COUNT = 49836;

function countryPreloadUsageDay(sec) {
  // The cron is scheduled at 00:12 Asia/Shanghai; use the same business day
  // for the quota guard instead of UTC so a manual run before midnight does
  // not suppress the next calendar day's batch.
  return new Date((sec + 8 * 3600) * 1000).toISOString().slice(0, 10);
}

function getOpenAlexApiKeys(env) {
  return [...new Set([
    cleanText(env?.OPENALEX_API_KEY || '', 256),
    cleanText(env?.OPENALEX_API_KEY_2 || '', 256),
    cleanText(env?.OPENALEX_API_KEY_3 || '', 256),
    cleanText(env?.OPENALEX_API_KEY_4 || '', 256),
  ].filter(Boolean))];
}

async function loadCountryPreloadManifest(env) {
  const base = (cleanText(env?.SITE_URL || 'https://journal.ailatest.org', 200) || 'https://journal.ailatest.org').replace(/\/+$/, '');
  const resp = await fetch(`${base}${COUNTRY_PRELOAD_MANIFEST_PATH}?v=${COUNTRY_PRELOAD_MANIFEST_COUNT}`, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!resp.ok) throw new Error(`country preload manifest ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

function preloadJobKey(item) {
  const issn = normalizeOpenAlexIssn(item?.issn) || normalizeOpenAlexIssn(item?.eissn);
  const eissn = normalizeOpenAlexIssn(item?.eissn);
  return issn ? `${COUNTRY_PRELOAD_YEAR}:${issn}|${eissn && eissn !== issn ? eissn : ''}` : '';
}

async function seedCountryPreloadJobs(env, manifest, state, now) {
  const cursor = Math.max(0, Number(state?.seed_cursor || 0));
  if (cursor >= manifest.length) return { seeded: 0, cursor };
  const slice = manifest.slice(cursor, cursor + COUNTRY_PRELOAD_SEED_PER_RUN);
  const statements = [];
  for (const item of slice) {
    const jobKey = preloadJobKey(item);
    const issn = normalizeOpenAlexIssn(item?.issn) || normalizeOpenAlexIssn(item?.eissn);
    const eissn = normalizeOpenAlexIssn(item?.eissn);
    if (!jobKey || !issn) continue;
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO country_output_preload_jobs
        (job_key, issn, eissn, year, rank, journal_name, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(
      jobKey,
      issn,
      eissn && eissn !== issn ? eissn : '',
      COUNTRY_PRELOAD_YEAR,
      Number(item?.rank || cursor + statements.length + 1),
      cleanText(item?.name || '', 240),
      now,
    ));
  }
  for (let i = 0; i < statements.length; i += 100) {
    await env.DB.batch(statements.slice(i, i + 100));
  }
  const nextCursor = cursor + slice.length;
  await env.DB.prepare(
    'UPDATE country_output_preload_state SET seed_cursor = ?1, updated_at = ?2 WHERE state_key = ?3'
  ).bind(nextCursor, now, 'global').run();
  return { seeded: statements.length, cursor: nextCursor };
}

function preloadTransientStatus(status) {
  const code = Number(status || 0);
  return code === 0 || code === 408 || code === 425 || code === 429 || code >= 500;
}

async function reserveCountryPreloadJobs(env, now) {
  const usageDay = countryPreloadUsageDay(now);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO country_output_preload_usage (usage_day, reserved_jobs, updated_at)
     VALUES (?1, 0, ?2)`
  ).bind(usageDay, now).run();
  const usage = await env.DB.prepare(
    'SELECT reserved_jobs FROM country_output_preload_usage WHERE usage_day = ?1'
  ).bind(usageDay).first();
  const remaining = Math.min(
    COUNTRY_PRELOAD_BATCH_LIMIT,
    Math.max(0, COUNTRY_PRELOAD_DAILY_JOB_LIMIT - Number(usage?.reserved_jobs || 0)),
  );
  if (!remaining) return [];
  const candidates = await env.DB.prepare(
    `SELECT job_key, issn, eissn, year, rank, journal_name, attempts
       FROM country_output_preload_jobs
      WHERE year = ?1 AND status = 'pending' AND next_attempt_at <= ?2
      ORDER BY rank ASC
      LIMIT ?3`
  ).bind(COUNTRY_PRELOAD_YEAR, now, remaining).all();
  const jobs = candidates.results || [];
  if (!jobs.length) return [];
  const count = jobs.length;
  const reserve = await env.DB.prepare(
    `UPDATE country_output_preload_usage
        SET reserved_jobs = reserved_jobs + ?1, updated_at = ?2
      WHERE usage_day = ?3
        AND reserved_jobs + ?1 <= ?4`
  ).bind(count, now, usageDay, COUNTRY_PRELOAD_DAILY_JOB_LIMIT).run();
  if (!Number(reserve?.meta?.changes || 0)) return [];
  const claims = jobs.map((job) => env.DB.prepare(
    `UPDATE country_output_preload_jobs
        SET status = 'running', attempts = attempts + 1, claimed_at = ?1, updated_at = ?1
      WHERE job_key = ?2 AND status = 'pending'`
  ).bind(now, job.job_key));
  await env.DB.batch(claims);
  return jobs;
}

async function updateCountryPreloadJob(env, job, result, now) {
  const status = result.status || 'pending';
  const retry = status === 'pending';
  const nextAttempt = retry ? now + Math.min(6 * 3600, 300 * Math.max(1, Number(job.attempts || 1))) : 0;
  await env.DB.prepare(
    `UPDATE country_output_preload_jobs
        SET status = ?1,
            last_status = ?2,
            last_error = ?3,
            next_attempt_at = ?4,
            completed_at = ?5,
            source = ?6,
            updated_at = ?7
      WHERE job_key = ?8`
  ).bind(
    status,
    Number(result.httpStatus || 0) || null,
    cleanText(result.error || '', 240),
    nextAttempt,
    status === 'completed' || status === 'no_data' ? now : null,
    cleanText(result.source || '', 32),
    now,
    job.job_key,
  ).run();
}

async function processCountryPreloadJob(env, job, apiKeys, now) {
  // One reserved job equals one OpenAlex request.  This keeps the daily
  // budget predictable; the public detail endpoint can still try eISSN as a
  // live fallback when a preload has no result.
  const sourceIssns = [normalizeOpenAlexIssn(job.issn)].filter(Boolean);
  const cached = await readCountryOutputD1(env, countryOutputD1Key(sourceIssns, [COUNTRY_PRELOAD_YEAR]))
    || await readCountryOutputD1Partial(env, sourceIssns, [COUNTRY_PRELOAD_YEAR]);
  if (cached?.years?.length) {
    return { status: 'completed', httpStatus: 200, source: cached.source || 'openalex' };
  }
  let transient = false;
  let lastStatus = 0;
  const keys = Array.isArray(apiKeys) ? apiKeys.filter(Boolean) : [cleanText(apiKeys || '', 256)].filter(Boolean);
  const rotationOffset = Math.max(0, Number(job.rank || 1) - 1) + Math.max(0, Number(job.attempts || 0));
  const apiKey = keys.length ? keys[rotationOffset % keys.length] : '';
  for (const sourceIssn of sourceIssns) {
    const row = await fetchOpenAlexCountryYear(sourceIssn, COUNTRY_PRELOAD_YEAR, apiKey, 0, 0);
    lastStatus = Number(row.status || 200);
    if (!row.skipped && row.total > 0 && row.groups?.length) {
      const payload = buildCountryOutputPayload([row], 'openalex');
      if (payload) {
        payload.issn = sourceIssn;
        const cacheIssns = sourceIssns;
        const cacheKey = countryOutputD1Key(cacheIssns, [COUNTRY_PRELOAD_YEAR]);
        await writeCountryOutputD1(env, cacheKey, cacheIssns, [COUNTRY_PRELOAD_YEAR], payload, COUNTRY_PRELOAD_CACHE_TTL);
        return { status: 'completed', httpStatus: lastStatus, source: 'openalex' };
      }
    }
    if (preloadTransientStatus(row.status)) transient = true;
  }
  if (transient && Number(job.attempts || 0) < 3) {
    return { status: 'pending', httpStatus: lastStatus, error: `openalex_retry_${lastStatus}` };
  }
  return { status: 'no_data', httpStatus: lastStatus, error: 'openalex_no_affiliation_data', source: 'openalex' };
}

async function runCountryOutputPreload(env, now) {
  const apiKeys = getOpenAlexApiKeys(env);
  if (!apiKeys.length || !env?.DB) return { skipped: true, reason: apiKeys.length ? 'no_db' : 'missing_openalex_key' };
  let locked = false;
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO country_output_preload_state
        (state_key, seed_cursor, lock_until, last_run_at, updated_at)
       VALUES ('global', 0, 0, 0, ?1)`
    ).bind(now).run();
    const lock = await env.DB.prepare(
      `UPDATE country_output_preload_state
          SET lock_until = ?1, updated_at = ?2
        WHERE state_key = 'global' AND lock_until <= ?2`
    ).bind(now + COUNTRY_PRELOAD_LOCK_SECONDS, now).run();
    if (!Number(lock?.meta?.changes || 0)) return { skipped: true, reason: 'locked' };
    locked = true;

    const state = await env.DB.prepare(
      'SELECT seed_cursor, lock_until, last_run_at FROM country_output_preload_state WHERE state_key = \'global\''
    ).first();
    const needsSeed = Number(state?.seed_cursor || 0) < COUNTRY_PRELOAD_MANIFEST_COUNT;
    const manifest = needsSeed ? await loadCountryPreloadManifest(env) : [];
    const seed = needsSeed
      ? await seedCountryPreloadJobs(env, manifest, state, now)
      : { seeded: 0, cursor: Number(state?.seed_cursor || 0) };
    await env.DB.prepare(
      `UPDATE country_output_preload_jobs
          SET status = 'pending', claimed_at = 0, next_attempt_at = ?1, updated_at = ?1
        WHERE status = 'running' AND claimed_at < ?2`
    ).bind(now, now - COUNTRY_PRELOAD_LOCK_SECONDS).run();
    const jobs = await reserveCountryPreloadJobs(env, now);
    let completed = 0;
    let noData = 0;
    let retried = 0;
    for (let i = 0; i < jobs.length; i += COUNTRY_PRELOAD_CONCURRENCY) {
      const group = jobs.slice(i, i + COUNTRY_PRELOAD_CONCURRENCY);
      const results = await Promise.all(group.map(async (job) => {
        try {
          return await processCountryPreloadJob(env, job, apiKeys, now);
        } catch (error) {
          return { status: Number(job.attempts || 0) < 3 ? 'pending' : 'no_data', error: cleanText(error?.message || 'preload_error', 240) };
        }
      }));
      await Promise.all(group.map((job, index) => updateCountryPreloadJob(env, job, results[index], now)));
      for (const result of results) {
        if (result.status === 'completed') completed += 1;
        else if (result.status === 'pending') retried += 1;
        else noData += 1;
      }
    }
    await env.DB.prepare(
      `UPDATE country_output_preload_state SET last_run_at = ?1, updated_at = ?1 WHERE state_key = 'global'`
    ).bind(now).run();
    return {
      year: COUNTRY_PRELOAD_YEAR,
      daily_job_limit: COUNTRY_PRELOAD_DAILY_JOB_LIMIT,
      seeded: seed.seeded,
      seed_cursor: seed.cursor,
      reserved: jobs.length,
      completed,
      no_data: noData,
      retried,
      manifest: needsSeed ? manifest.length : COUNTRY_PRELOAD_MANIFEST_COUNT,
    };
  } catch (error) {
    console.error('country output preload failed:', error?.stack || error?.message || error);
    return { skipped: true, reason: 'preload_error' };
  } finally {
    if (locked) {
      try {
        await env.DB.prepare(
          `UPDATE country_output_preload_state SET lock_until = 0, updated_at = ?1 WHERE state_key = 'global'`
        ).bind(now).run();
      } catch (_) { /* best effort */ }
    }
  }
}

// GET /openalex/country-output?issn=1474-760X[,1474-760X]&years=2022,2023,2024,2025,2026
// OpenAlex is an optional enrichment source; Crossref is the no-key fallback.
async function routeOpenAlexCountryOutput(req, env, ctx) {
  const url = new URL(req.url);
  const debug = url.searchParams.get('debug') === '1';
  const issns = cleanText(url.searchParams.get('issn') || '', 120)
    .split(',')
    .map(normalizeOpenAlexIssn)
    .filter((value, index, arr) => value && arr.indexOf(value) === index)
    .slice(0, 2);
  const years = cleanText(url.searchParams.get('years') || '', 80)
    .split(',')
    .map(year => Number(year))
    .filter(year => Number.isFinite(year) && year >= 1900 && year <= 2100)
    .slice(-8);
  if (!issns.length || !years.length) return err('missing issn or years', 400);

  // api_key 可选：没有 key 时不再反复撞 OpenAlex 公共池，优先使用
  // Crossref + D1 缓存；如需调试公共池，可显式加 public_openalex=1。
  const apiKeys = getOpenAlexApiKeys(env);
  const apiKey = apiKeys[0] || '';

  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/openalex-country-output/v4?issn=${encodeURIComponent(issns.join(','))}&years=${encodeURIComponent(years.join(','))}&k=${apiKey ? '1' : '0'}`);
  const hit = debug ? null : await cache.match(cacheKey);
  if (hit) return new Response(hit.body, { status: 200, headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'public, max-age=86400' } });

  // 无 API key 时少查几年；有 key 时并行拉年，显著缩短详情页等待
  const queryYears = apiKey ? years : years.slice(-3);
  const durableKey = countryOutputD1Key(issns, queryYears);
  const bypassDurableCache = debug || url.searchParams.get('fresh') === '1';
  const durableHit = bypassDurableCache ? null : await readCountryOutputD1(env, durableKey);
  if (durableHit) {
    const bodyText = JSON.stringify({ ...durableHit, cache: 'd1' });
    return new Response(bodyText, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'public, max-age=86400' },
    });
  }
  const partialDurableHit = bypassDurableCache ? null : await readCountryOutputD1Partial(env, issns, queryYears);
  if (partialDurableHit) {
    const bodyText = JSON.stringify({ ...partialDurableHit, cache: 'd1-partial' });
    return new Response(bodyText, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': 'public, max-age=86400' },
    });
  }

  let payload = null;
  const attempts = [];
  // OpenAlex now requires a funded API budget for many requests. Crossref
  // deposits carry author affiliations for a large share of journals and are a
  // useful server-side fallback when OPENALEX_API_KEY is absent or exhausted.
  if (!apiKey) payload = await fetchCrossrefCountryOutput(issns, queryYears, attempts);
  const allowPublicOpenAlex = url.searchParams.get('public_openalex') === '1';
  for (const sourceIssn of issns) {
    if (payload) break;
    if (!apiKey && !allowPublicOpenAlex) break;
    let rows;
    if (apiKey) {
      rows = await Promise.all(queryYears.map((year, index) => (
        fetchOpenAlexCountryYear(sourceIssn, year, apiKeys[index % apiKeys.length])
      )));
    } else {
      rows = [];
      for (const year of queryYears) {
        const row = await fetchOpenAlexCountryYear(sourceIssn, year, apiKey);
        rows.push(row);
        // 礼貌池串行 + 间隔，降低 429
        await new Promise((r) => setTimeout(r, 450));
      }
    }
    for (const row of rows) {
      if (debug || row.skipped) {
        attempts.push({
          issn: sourceIssn,
          year: row.year,
          total: row.total,
          status: row.status || 200,
          skipped: !!row.skipped,
        });
      }
    }
    payload = buildCountryOutputPayload(rows, 'openalex');
    if (payload) {
      payload.issn = sourceIssn;
      break;
    }
  }
  if (!payload && apiKey) payload = await fetchCrossrefCountryOutput(issns, queryYears, attempts);
  if (!payload) {
    payload = {
      ok: true,
      years: [],
      top: [],
      source: 'openalex',
      reason: apiKey ? 'no_data' : 'sources_exhausted',
    };
  }
  if (debug) payload.attempts = attempts;

  if (payload.years.length) {
    const persist = writeCountryOutputD1(env, durableKey, issns, queryYears, payload);
    if (ctx?.waitUntil) ctx.waitUntil(persist);
    else await persist;
  }

  const bodyText = JSON.stringify(payload);
  const ttl = payload.years.length ? 86400 : 60;
  const headers = { 'Content-Type': 'application/json', ...CORS, 'Cache-Control': `public, max-age=${ttl}` };
  if (payload.years.length && !debug) await cache.put(cacheKey, new Response(bodyText, { status: 200, headers }));
  return new Response(bodyText, { status: 200, headers });
}

// GET /analytics/hot-journals?days=30&limit=5
// 公开：最近 N 天人类真实浏览量最高的期刊（首页「热点期刊」）
async function routeHotJournals(req, env) {
  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get('days') || 30);
  const days = Number.isFinite(daysRaw) ? Math.min(90, Math.max(1, Math.floor(daysRaw))) : 30;
  const limitRaw = Number(url.searchParams.get('limit') || 5);
  const limit = Number.isFinite(limitRaw) ? Math.min(20, Math.max(1, Math.floor(limitRaw))) : 5;
  const startSec = Math.floor(Date.now() / 1000) - days * 86400;
  const humanTrafficSql = "COALESCE(traffic_type, CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END) = 'human'";

  try {
    const rows = await env.DB.prepare(
      `SELECT journal_key,
        MAX(CASE WHEN journal_name IS NOT NULL AND journal_name != '' THEN journal_name END) AS journal_name,
        MAX(CASE WHEN journal_issn IS NOT NULL AND journal_issn != '' THEN journal_issn END) AS journal_issn,
        COUNT(*) AS views,
        MAX(COALESCE(NULLIF(event_time,0), viewed_at)) AS latest_viewed
       FROM journal_view_events
       WHERE viewed_at >= ?
         AND journal_key IS NOT NULL AND TRIM(journal_key) != ''
         AND ${humanTrafficSql}
       GROUP BY journal_key
       ORDER BY views DESC, latest_viewed DESC, journal_key ASC
       LIMIT ?`
    ).bind(startSec, limit).all();

    const items = (rows.results || []).map((r, i) => ({
      rank: i + 1,
      journal_key: r.journal_key,
      journal_name: r.journal_name || '',
      journal_issn: r.journal_issn || '',
      views: Number(r.views || 0),
      latest_viewed: r.latest_viewed || null,
    }));

    return json({
      ok: true,
      days,
      limit,
      start_sec: startSec,
      items,
    }, 200, { 'Cache-Control': 'public, max-age=300' });
  } catch (e) {
    console.error('hot-journals query failed', e?.message || e);
    return json({
      ok: false,
      days,
      limit,
      items: [],
      error: 'query_failed',
    }, 200, { 'Cache-Control': 'public, max-age=60' });
  }
}

// GET /analytics/public-total  (public aggregate, no user-level detail)
async function routePublicTrafficTotal(req, env) {
  const url = new URL(req.url);
  const requestedSite = url.searchParams.has('site')
    ? canonicalAnalyticsSite(url.searchParams.get('site') || 'journal.ailatest.org')
    : '';
  if (requestedSite) {
    const raw = await env.DB.prepare(
      `SELECT COUNT(*) AS raw_pageviews,
        COUNT(DISTINCT visitor_id) AS raw_visitors,
        COUNT(DISTINCT session_id) AS raw_sessions,
        MIN(event_ts) AS first_pageview_at,
        MAX(event_ts) AS latest_pageview_at,
        SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS raw_bot_pageviews
       FROM raw_events
       WHERE site = ? AND event_type IN ('pageview','page_view')`
    ).bind(requestedSite).first();

    return json({
      ok: true,
      site: requestedSite,
      total_pageviews: Number(raw?.raw_pageviews || 0),
      total_visitors: Number(raw?.raw_visitors || 0),
      total_sessions: Number(raw?.raw_sessions || 0),
      first_pageview_at: raw?.first_pageview_at || null,
      latest_pageview_at: raw?.latest_pageview_at || null,
      viewed_journals: 0,
      total_journal_views: 0,
      latest_journal_view_at: null,
      raw_pageviews: Number(raw?.raw_pageviews || 0),
      raw_bot_pageviews: Number(raw?.raw_bot_pageviews || 0),
    }, 200, { 'Cache-Control': 'public, max-age=60' });
  }

  const page = await env.DB.prepare(
    `SELECT COUNT(*) AS total_pageviews,
      COUNT(DISTINCT visitor_id) AS total_visitors,
      COUNT(DISTINCT session_id) AS total_sessions,
      MIN(event_at) AS first_pageview_at,
      MAX(event_at) AS latest_pageview_at
     FROM page_events`
  ).first();
  const journal = await env.DB.prepare(
    `SELECT COUNT(*) AS viewed_journals,
      COALESCE(SUM(count),0) AS total_journal_views,
      MAX(updated_at) AS latest_journal_view_at
     FROM journal_views`
  ).first();

  let raw = null;
  try {
    const site = 'journal.ailatest.org';
    raw = await env.DB.prepare(
      `SELECT COUNT(*) AS raw_pageviews,
        COUNT(DISTINCT visitor_id) AS raw_visitors,
        COUNT(DISTINCT session_id) AS raw_sessions,
        SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS raw_bot_pageviews
       FROM raw_events
       WHERE site = ? AND event_type IN ('pageview','page_view')`
    ).bind(site).first();
  } catch (e) {
    raw = null;
  }

  return json({
    ok: true,
    total_pageviews: Number(page?.total_pageviews || raw?.raw_pageviews || 0),
    total_visitors: Number(page?.total_visitors || raw?.raw_visitors || 0),
    total_sessions: Number(page?.total_sessions || raw?.raw_sessions || 0),
    first_pageview_at: page?.first_pageview_at || null,
    latest_pageview_at: page?.latest_pageview_at || null,
    viewed_journals: Number(journal?.viewed_journals || 0),
    total_journal_views: Number(journal?.total_journal_views || 0),
    latest_journal_view_at: journal?.latest_journal_view_at || null,
    raw_pageviews: raw ? Number(raw.raw_pageviews || 0) : null,
    raw_bot_pageviews: raw ? Number(raw.raw_bot_pageviews || 0) : null,
  }, 200, { 'Cache-Control': 'public, max-age=300' });
}

// GET /analytics/journal-view-trend  (owner only) → lightweight chart payload
async function routeJournalViewTrend(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('login required', 401);
  if (!isOwnerUser(u)) return err('forbidden', 403);

  const url = new URL(req.url);
  const rawDays = Number(url.searchParams.get('days') || '7');
  const days = [1, 7, 30].includes(rawDays) ? rawDays : 7;
  const now = Math.floor(Date.now() / 1000);
  const startSec = now - (days > 1 ? days * 86400 : 86400);
  const bucketExpr = days > 1
    ? "date(viewed_at, 'unixepoch')"
    : "strftime('%Y-%m-%dT%H:00:00Z', viewed_at, 'unixepoch')";
  const humanTrafficSql = "COALESCE(traffic_type, CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END) = 'human'";

  const ownerRows = await env.DB.prepare(
    `SELECT id FROM users
     WHERE lower(email) = 'jiantaoweng@gmail.com'
        OR lower(login) = 'jiantaoweng@gmail.com'
        OR login IN ('arc_wjt','stonecanon')
        OR name IN ('arc_wjt','stonecanon','H&S一心菌 (石头小石头)')`
  ).all().then(r => r.results || []).catch(() => []);
  const ownerIds = ownerRows.map(r => Number(r.id)).filter(Number.isFinite);
  const ownerExcludeSql = ownerIds.length ? ` AND (user_id IS NULL OR user_id NOT IN (${ownerIds.join(',')}))` : '';

  const [summary, cumulative, series] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total_journal_views,
        COUNT(DISTINCT journal_key) AS viewed_journals,
        MAX(viewed_at) AS latest_journal_view_at
       FROM journal_view_events
       WHERE viewed_at >= ?${ownerExcludeSql} AND ${humanTrafficSql}`
    ).bind(startSec).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(count),0) AS cumulative_journal_views FROM journal_views`).first(),
    env.DB.prepare(
      `SELECT ${bucketExpr} AS hour,
        COUNT(*) AS views,
        COUNT(DISTINCT visitor_id) AS visitors
       FROM journal_view_events
       WHERE viewed_at >= ?${ownerExcludeSql} AND ${humanTrafficSql}
       GROUP BY hour ORDER BY hour ASC`
    ).bind(startSec).all(),
  ]);

  return json({
    ok: true,
    days,
    kpis: {
      total_journal_views: Number(summary?.total_journal_views || 0),
      viewed_journals: Number(summary?.viewed_journals || 0),
      latest_journal_view_at: summary?.latest_journal_view_at || null,
      cumulative_journal_views: Number(cumulative?.cumulative_journal_views || 0),
    },
    series: (series.results || []).map(r => ({
      hour: r.hour,
      views: Number(r.views || 0),
      visitors: Number(r.visitors || 0),
    })),
  });
}

// GET /analytics/site-traffic-trend  (owner only) → lightweight first-party traffic card
async function routeSiteTrafficTrend(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('login required', 401);
  if (!isOwnerUser(u)) return err('forbidden', 403);

  const sites = {
    journal: { id: 'journal', label: 'Journal', host: 'journal.ailatest.org' },
    grant: { id: 'grant', label: 'Grant', host: 'grant.ailatest.org' },
    path: { id: 'path', label: 'Path', host: 'path.ailatest.org' },
    major: { id: 'major', label: 'Major', host: 'major.ailatest.org' },
    todo: { id: 'todo', label: 'Todo', host: 'todo.ailatest.org' },
    ailatest: { id: 'ailatest', label: 'Studio', host: 'ailatest.org' },
  };
  const url = new URL(req.url);
  const siteId = url.searchParams.get('site') || 'journal';
  const site = sites[siteId];
  if (!site) return err('unknown site', 400);
  const rawDays = Number(url.searchParams.get('days') || '7');
  const days = [1, 7, 30].includes(rawDays) ? rawDays : 7;

  const dayKey = (n) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const rows = days === 1
    ? await env.DB.prepare(
      `SELECT * FROM hourly_stats WHERE site = ? AND hour_start_utc >= ? ORDER BY hour_start_utc ASC`
    ).bind(site.host, new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 13) + ':00:00Z').all().then(r => r.results || [])
    : await env.DB.prepare(
      `SELECT * FROM daily_stats WHERE site = ? AND day_utc >= ? ORDER BY day_utc ASC`
    ).bind(site.host, dayKey(days - 1)).all().then(r => r.results || []);

  const sumBy = (key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const mergeRanked = (jsonKey, idKey) => {
    const map = new Map();
    for (const row of rows) {
      let items = [];
      try { items = JSON.parse(row[jsonKey] || '[]'); } catch (_) { items = []; }
      for (const item of Array.isArray(items) ? items : []) {
        const key = item[idKey] || (idKey === 'country' ? 'unknown' : '/');
        const prev = map.get(key) || { [idKey]: key, pageviews: 0, visitors: 0, sessions: 0 };
        prev.pageviews += Number(item.pageviews || 0);
        prev.visitors += Number(item.visitors || 0);
        prev.sessions += Number(item.sessions || 0);
        map.set(key, prev);
      }
    }
    return [...map.values()].sort((a, b) => b.pageviews - a.pageviews).slice(0, 15);
  };
  const trafficMix = {
    human: sumBy('human_pv'),
    search_engine_bot: sumBy('search_engine_pv'),
    ai_agent: sumBy('ai_agent_pv'),
    scraper: sumBy('scraper_pv'),
    suspected_bot: sumBy('suspected_bot_pv'),
    unknown: sumBy('unknown_pv'),
    all: sumBy('all_pv'),
  };

  return json({
    ok: true,
    days,
    site: siteId,
    first_party: {
      ...site,
      status: rows.length ? 'ok' : 'empty',
      totals: {
        pageviews: sumBy('pageviews'),
        visitors: sumBy('visitors'),
        sessions: sumBy('sessions'),
        bot_events: sumBy('bot_events'),
        all_pv: trafficMix.all,
      },
      series: days === 1 ? [] : rows.map(r => ({
        day: r.day_utc,
        pageviews: Number(r.pageviews || 0),
        visitors: Number(r.visitors || 0),
        sessions: Number(r.sessions || 0),
      })),
      hourly: days === 1 ? rows.map(r => ({
        hour_start_utc: r.hour_start_utc,
        pageviews: Number(r.pageviews || 0),
        visitors: Number(r.visitors || 0),
        sessions: Number(r.sessions || 0),
      })) : [],
      traffic_mix: trafficMix,
      topPaths: mergeRanked('top_paths_json', 'path'),
      topCountries: mergeRanked('countries_json', 'country'),
    },
  });
}

// ───────── dispatcher ─────────
// GET /analytics/dashboard  (owner only) → full dashboard payload, edge-cached ~5min
async function routeDashboard(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('login required', 401);
  if (!isOwnerUser(u)) return err('forbidden', 403);

  const url = new URL(req.url);
  const rawDays = Number(url.searchParams.get('days') || '30');
  const days = [1, 7, 30].includes(rawDays) ? rawDays : 30;
  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/analytics/dashboard-v4?days=${days}`, { method: 'GET' });
  const nocache = url.searchParams.get('nocache') === '1';
  if (!nocache) {
    const hit = await cache.match(cacheKey);
    if (hit) return new Response(hit.body, { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const payload = await buildDashboardPayload(env, { days });
  const bodyText = JSON.stringify(payload);
  // Store under a stable, auth-free key so the cache is reusable; never served without auth
  // because this is the only place that writes it and the route itself is owner-gated.
  await cache.put(cacheKey, new Response(bodyText, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' },
  }));
  return new Response(bodyText, { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}

function routeSitesDashboard(site = 'overview') {
  return new Response(renderSitesDashboard({ initialSite: site || 'overview' }), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function routeApiLlmsTxt() {
  const body = `# AILatest API

> Unified accounts, entitlements, gift codes, checkout hooks, and first-party analytics for the AILatest product suite.

- API origin: https://api.ailatest.org/
- Owner product dashboard: https://api.ailatest.org/analytics/sites
- Studio hub: https://ailatest.org/
- Suite AI index: https://ailatest.org/llms.txt
- Suite full context: https://ailatest.org/llms-full.txt

## Journal public-beta interfaces

- Skill search: POST https://journal.ailatest.org/api/skill/search
- Skill recommend: POST https://journal.ailatest.org/api/skill/recommend
- Quota policy: GET https://journal.ailatest.org/api/skill/quota
- MCP Streamable HTTP: POST https://journal.ailatest.org/api/mcp
- Optional account/API-key headers: \`X-API-Key: aj_live_...\` or \`Authorization: ApiKey aj_live_...\`

## Products using this API

- Journal: https://journal.ailatest.org/
- Grant: https://grant.ailatest.org/
- Path: https://path.ailatest.org/
- Major (知途): https://major.ailatest.org/
- Todo: https://todo.ailatest.org/

## For AI assistants

- Prefer product \`llms.txt\` files for user-facing product facts.
- This host is primarily an API; do not invent private endpoints.
- Public product documentation lives on each product domain.
- Skill/API and MCP are public beta; limits and fields may change.
`;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      ...CORS,
    },
  });
}

function routeApiRobotsTxt() {
  const body = `User-agent: *
Allow: /
Allow: /llms.txt
Disallow: /admin/
Disallow: /me
Disallow: /me/
Disallow: /internal/

User-agent: GPTBot
Allow: /llms.txt
User-agent: ClaudeBot
Allow: /llms.txt
User-agent: PerplexityBot
Allow: /llms.txt
User-agent: Google-Extended
Allow: /llms.txt

Sitemap: https://ailatest.org/sitemap.xml
`;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      ...CORS,
    },
  });
}

/** 浏览器访问 api.ailatest.org 时的简洁门户（站长看板入口） */
function routeApiPortal() {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AILatest API</title>
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt" />
<style>
  :root { color-scheme: light; --ink:#1c1917; --muted:#78716c; --line:#e7e5e4; --bg:#fafaf9; --card:#fff; --accent:#0f766e; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: var(--bg); color: var(--ink); line-height: 1.55; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 20px 72px; }
  h1 { margin: 0 0 8px; font-size: 1.6rem; letter-spacing: -.02em; font-weight: 750; }
  p { margin: 0 0 18px; color: var(--muted); font-size: 0.95rem; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin: 0 0 12px; }
  .card h2 { margin: 0 0 6px; font-size: 1rem; }
  .card p { margin: 0; font-size: 0.88rem; }
  a.btn { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; padding: 9px 14px; border-radius: 9px; background: var(--accent); color: #fff; text-decoration: none; font-weight: 650; font-size: 0.9rem; }
  a.btn:hover { filter: brightness(1.05); }
  ul { margin: 8px 0 0; padding-left: 1.15rem; color: var(--muted); font-size: 0.88rem; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.84em; background: #f5f5f4; padding: 1px 5px; border-radius: 4px; }
  .muted { color: var(--muted); font-size: 0.82rem; margin-top: 20px; }
</style>
</head>
<body>
<main>
  <h1>AILatest API</h1>
  <p>统一账号、支付与第一方分析。产品数据看板请从下方进入（需站长登录）。</p>
  <div class="card">
    <h2>产品数据看板</h2>
    <p>Journal · Grant · Path · Major · Todo · Studio 流量与基础用户数据。</p>
    <a class="btn" href="/analytics/sites">打开看板 →</a>
  </div>
  <div class="card">
    <h2>统一后台管理</h2>
    <p>站长专用：项目、用户、权益、会员、礼品码、API Key、支付记录、覆盖配置与审计日志。</p>
    <a class="btn" href="/admin">打开后台 →</a>
  </div>
  <div class="card">
    <h2>已接入站点</h2>
    <ul>
      <li><code>journal.ailatest.org</code></li>
      <li><code>grant.ailatest.org</code></li>
      <li><code>path.ailatest.org</code></li>
      <li><code>major.ailatest.org</code></li>
      <li><code>todo.ailatest.org</code></li>
      <li><code>ailatest.org</code>（门户）</li>
    </ul>
  </div>
  <div class="card">
    <h2>机器可读 / AI 发现</h2>
    <p><a href="/llms.txt"><code>/llms.txt</code></a> · 全站索引 <a href="https://ailatest.org/llms.txt">ailatest.org/llms.txt</a></p>
    <p>JSON：请求本页并设置 <code>Accept: application/json</code>。</p>
  </div>
  <p class="muted">© AILatest · api.ailatest.org</p>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...CORS,
    },
  });
}

function mcpResponse(id, result) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function mcpError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id: id ?? null, error };
}

const MCP_TOOLS = [
  {
    name: 'search_journals',
    description: 'Search AILatest journal records by title, ISSN, subject, index, JCR or CAS filters.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Journal title, ISSN, or keyword.' },
        subjects: { type: ['string', 'array'], items: { type: 'string' } },
        indexes: { type: ['string', 'array'], items: { type: 'string' } },
        jcr_quartile: { type: ['string', 'array'], items: { type: 'string' } },
        cas_zone: { type: ['string', 'array'], items: { type: 'string' } },
        exclude_warning: { type: 'boolean' },
        page: { type: 'integer', minimum: 1 },
        page_size: { type: 'integer', minimum: 1, maximum: 100 },
      },
      additionalProperties: true,
    },
  },
  {
    name: 'recommend_journals',
    description: 'Recommend journals from a title, abstract, keywords, and optional structured filters.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        abstract: { type: 'string' },
        keywords: { type: ['string', 'array'], items: { type: 'string' } },
        exclude_warning: { type: 'boolean' },
        page: { type: 'integer', minimum: 1 },
        page_size: { type: 'integer', minimum: 1, maximum: 100 },
      },
      additionalProperties: true,
    },
  },
  {
    name: 'quota',
    description: 'Show the current public-beta Skill/API quota policy and authentication mode.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function mcpTextResult(value, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

async function mcpCallTool(name, args, req, env, principal) {
  const input = args && typeof args === 'object' ? args : {};
  if (name === 'quota') return mcpTextResult(buildSkillQuotaResponse(principal));
  const request = new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (name === 'search_journals') {
    return mcpTextResult(await buildSkillSearchResponse(request, env, principal));
  }
  if (name === 'recommend_journals') {
    return mcpTextResult(await buildSkillRecommendResponse(request, env, principal));
  }
  return mcpTextResult({ ok: false, error: `unknown MCP tool: ${name}` }, true);
}

async function handleMcpRpc(message, req, env, principal) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return mcpError(null, -32600, 'Invalid Request');
  }
  const id = Object.prototype.hasOwnProperty.call(message, 'id') ? message.id : null;
  const method = String(message.method || '');
  if (!method) return mcpError(id, -32600, 'Invalid Request');
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return null;
  if (method === 'ping') return mcpResponse(id, {});
  if (method === 'initialize') {
    const requested = String(message.params?.protocolVersion || '').trim();
    return mcpResponse(id, {
      protocolVersion: requested || '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'ailatest-journal', version: '0.2.17' },
      instructions: 'AILatest Journal public-beta MCP. Use search_journals or recommend_journals and verify final scope on the journal website.',
    });
  }
  if (method === 'tools/list') return mcpResponse(id, { tools: MCP_TOOLS });
  if (method === 'tools/call') {
    const name = String(message.params?.name || '').trim();
    if (!MCP_TOOLS.some((tool) => tool.name === name)) return mcpError(id, -32602, 'Unknown tool', { name });
    try {
      return mcpResponse(id, await mcpCallTool(name, message.params?.arguments, req, env, principal));
    } catch (e) {
      return mcpResponse(id, mcpTextResult({ ok: false, error: e?.message || 'tool failed' }, true));
    }
  }
  if (id == null) return null;
  return mcpError(id, -32601, `Method not found: ${method}`);
}

async function routeMcp(req, env) {
  const principal = await resolveRequestPrincipal(req, env);
  if (principal.error) return principal.error;
  if (req.method === 'GET') {
    return json({
      ok: true,
      name: 'ailatest-journal',
      protocol: 'MCP Streamable HTTP',
      status: 'public_beta',
      tools: MCP_TOOLS.map((tool) => tool.name),
      authentication: 'Optional X-API-Key / Authorization: ApiKey for account-scoped beta access.',
    }, 200, { 'Cache-Control': 'no-store' });
  }
  if (req.method !== 'POST') return err('MCP requires POST', 405);
  const body = await req.json().catch(() => null);
  if (!body) return err('invalid json', 400);
  if (Array.isArray(body)) {
    const replies = [];
    for (const message of body) {
      const reply = await handleMcpRpc(message, req, env, principal);
      if (reply) replies.push(reply);
    }
    if (!replies.length) return new Response(null, { status: 202, headers: CORS });
    return json(replies, 200, { 'Cache-Control': 'no-store' });
  }
  const reply = await handleMcpRpc(body, req, env, principal);
  if (!reply) return new Response(null, { status: 202, headers: CORS });
  return json(reply, 200, { 'Cache-Control': 'no-store' });
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    const u = new URL(req.url);
    let p = u.pathname;
    // Same-origin entry: journal.ailatest.org/api/* routes here too — strip the prefix.
    if (p === '/api' || p === '/api/') p = '/';
    else if (p.startsWith('/api/')) p = p.slice(4);
    try {
      if (p === '/llms.txt' && req.method === 'GET') return routeApiLlmsTxt();
      if (p === '/robots.txt' && req.method === 'GET') return routeApiRobotsTxt();
      if (p === '/mcp') return routeMcp(req, env);
      if (p === '/stats' && req.method === 'GET') {
        const siteUrl = String(env.SITE_URL || 'https://journal.ailatest.org').replace(/\/$/, '');
        const metaResponse = await fetch(`${siteUrl}/data/meta.json`);
        if (!metaResponse.ok) return err(`metadata unavailable: ${metaResponse.status}`, 503);
        const meta = await metaResponse.json();
        return json({
          journals: Number(meta.total || 0),
          last_updated: meta.last_updated_source || '',
          indices: meta.indices || {},
          with_if: Number(meta.with_if_2025 || meta.with_if_2024 || 0),
        }, 200, { 'Cache-Control': 'public, max-age=300' });
      }
      if (p === '/' || p === '') {
        const accept = String(req.headers.get('Accept') || '');
        if (accept.includes('text/html')) return routeApiPortal();
        return json({
          name: 'ailatest-api',
          ok: true,
          v: 3,
          dashboard: '/analytics/sites',
          llms: '/llms.txt',
          suite_llms: 'https://ailatest.org/llms.txt',
          sites: [
            'journal.ailatest.org',
            'grant.ailatest.org',
            'path.ailatest.org',
            'major.ailatest.org',
            'todo.ailatest.org',
            'ailatest.org',
          ],
        });
      }
      if (p === '/auth/email/request'  && req.method === 'POST') return routeEmailRequest(req, env);
      if (p === '/auth/email/verify'   && req.method === 'POST') return routeEmailVerify(req, env);
      if (p === '/auth/github'         && req.method === 'GET')  return routeAuthStart(req, env);
      if (p === '/auth/github/callback'&& req.method === 'GET')  return routeAuthCallback(req, env);
      if (p === '/auth/google'         && req.method === 'GET')  return routeGoogleStart(req, env);
      if (p === '/auth/google/callback'&& req.method === 'GET')  return routeGoogleCallback(req, env);
      if (p === '/analytics/pageview' && req.method === 'POST')  return routePageview(req, env);
      if (p === '/analytics/interaction' && req.method === 'POST') return routeInteraction(req, env);
      if (p === '/events/collect' && req.method === 'POST') return routeEventsCollect(req, env);
      if (p === '/grant/deepseek-usage' && req.method === 'POST') return routeAiUsageIngest(req, env);
      if (p === '/grant/deepseek-usage' && req.method === 'GET') return routeAiUsageSummary(req, env);
      if (p === '/analytics/dashboard' && req.method === 'GET')  return routeDashboard(req, env);
      if ((p === '/analytics/sites' || p === '/analytics/sites/') && req.method === 'GET') return routeSitesDashboard('overview');
      const mAnalyticsSite = p.match(/^\/analytics\/sites\/([a-z0-9_-]+)\/?$/i);
      if (mAnalyticsSite && req.method === 'GET') return routeSitesDashboard(mAnalyticsSite[1]);
      // Unified owner console.  The HTML shell is intentionally lightweight;
      // every data read/write below is gated again by routeAdminApi.
      if ((p === '/admin' || p === '/admin/') && req.method === 'GET') return renderAdmin();
      if (p.startsWith('/admin/api/')) return routeAdminApi(req, env, { getUser, isOwnerUser });
      if (p === '/analytics/journal-view-trend' && req.method === 'GET') return routeJournalViewTrend(req, env);
      if (p === '/analytics/site-traffic-trend' && req.method === 'GET') return routeSiteTrafficTrend(req, env);
      if (p === '/analytics/public-total' && req.method === 'GET') return routePublicTrafficTotal(req, env);
      if ((p === '/analytics/hot-journals' || p === '/analytics/hot-journals/') && req.method === 'GET') {
        return routeHotJournals(req, env);
      }
      if (p === '/openalex/country-output' && req.method === 'GET') return routeOpenAlexCountryOutput(req, env, ctx);
      if (p === '/extension/download-stats' && req.method === 'GET') return routeExtensionDownloadStats(req, env);
      if (p === '/extension/download'       && req.method === 'GET') return routeExtensionDownload(req, env);
      if (p === '/me'                  && req.method === 'GET')  return routeMe(req, env);
      if (p === '/me/entitlements'     && req.method === 'GET')  return routeMeEntitlements(req, env);
      if (p === '/admin/gift-codes'    && req.method === 'POST') return routeAdminGiftCodes(req, env);
      if (p === '/admin/gift-codes/void' && req.method === 'POST') return routeAdminVoidGiftCode(req, env);
      if (p === '/admin/product-memberships' && req.method === 'GET') return routeAdminProductMemberships(req, env);
      if (p === '/internal/product-membership' && req.method === 'POST') return routeInternalProductMembership(req, env);
      if (p === '/gift-codes/redeem'   && req.method === 'POST') return routeRedeemGiftCode(req, env);
      if (p === '/checkout/creem'      && req.method === 'POST') {
        const out = await routeCreemCheckout(req, env, getUser);
        return json(out.body, out.status);
      }
      if ((p === '/checkout/creem/confirm' || p === '/checkout/creem/confirm/')
        && (req.method === 'POST' || req.method === 'GET')) {
        const out = await routeCreemConfirm(req, env, getUser);
        return json(out.body, out.status);
      }
      if (p === '/checkout/catalog'    && req.method === 'GET') {
        const out = await routeCreemCatalog(req, env);
        return json(out.body, out.status);
      }
      if ((p === '/webhooks/creem' || p === '/webhooks/creem/') && req.method === 'POST') {
        const out = await routeCreemWebhook(req, env);
        return json(out.body, out.status);
      }
      if (p === '/api-keys'            && req.method === 'GET')  return routeApiKeys(req, env);
      if (p === '/api-keys'            && req.method === 'POST') return routeCreateApiKey(req, env);
      const mApiKey = p.match(/^\/api-keys\/([0-9a-f-]+)$/i);
      if (mApiKey && req.method === 'DELETE') return routeRevokeApiKey(req, env, mApiKey[1]);
      if (p === '/search' && (req.method === 'GET' || req.method === 'POST')) return json(await buildPublicSearchResponse(req, env));
      if (p === '/skill/search' && (req.method === 'GET' || req.method === 'POST')) {
        const principal = await resolveRequestPrincipal(req, env);
        if (principal.error) return principal.error;
        return json(await buildSkillSearchResponse(req, env, principal), 200, { 'Cache-Control': 'no-store' });
      }
      if (p === '/skill/recommend' && (req.method === 'GET' || req.method === 'POST')) {
        const principal = await resolveRequestPrincipal(req, env);
        if (principal.error) return principal.error;
        return json(await buildSkillRecommendResponse(req, env, principal), 200, { 'Cache-Control': 'no-store' });
      }
      if (p === '/skill/quota' && req.method === 'GET') {
        const principal = await resolveRequestPrincipal(req, env);
        if (principal.error) return principal.error;
        return json(buildSkillQuotaResponse(principal), 200, { 'Cache-Control': 'no-store' });
      }
      if (p === '/pick'                && req.method === 'POST') return handlePick(req, env, { consumeQuota: () => consumePickQuotaForRequest(req, env) });
      if (p === '/pick/quota/consume'  && req.method === 'POST') return routeConsumePickQuota(req, env);
      if (p === '/ext/lookup') {
        const principal = await resolveRequestPrincipal(req, env);
        if (principal.error) return principal.error;
        const installId = cleanText(req.headers.get('X-AJ-Install') || '', 160);
        const ipHash = await requestIpHash(req, env);
        return handleExtLookup(req, env, { ...principal, installId, ipHash });
      }
      if (p === '/favorites'           && req.method === 'GET')  return routeGetFavs(req, env);
      if (p === '/favorites'           && req.method === 'PUT')  return routePutFavs(req, env);
      if (p === '/lists'               && req.method === 'GET')  return routeGetLists(req, env);
      if (p === '/lists'               && req.method === 'PUT')  return routePutLists(req, env);
      if (p === '/ratings'              && req.method === 'GET')  return routeGetRatings(req, env);
      if (p === '/ratings'              && req.method === 'PUT')  return routePutRating(req, env);
      if (p === '/ratings'              && req.method === 'DELETE') return routeDeleteRating(req, env);

      // shares (一键分享收藏夹)
      if (p === '/share'                 && req.method === 'POST')   return routeCreateShare(req, env);
      if (p === '/shares/mine'           && req.method === 'GET')    return routeMyShares(req, env);
      const mShare = p.match(/^\/share\/([0-9a-zA-Z]{8})$/);
      if (mShare && req.method === 'GET')                            return routeGetShare(req, env, mShare[1]);
      if (mShare && req.method === 'DELETE')                         return routeDeleteShare(req, env, mShare[1]);
      const mImport = p.match(/^\/share\/([0-9a-zA-Z]{8})\/import$/);
      if (mImport && req.method === 'POST')                          return routeImportShare(req, env, mImport[1]);

      // journal views (浏览计数)
      if (p === '/journal-view'          && req.method === 'POST')   return routeJournalView(req, env);
      if (p === '/journal-views'         && req.method === 'GET')    return routeGetJournalViews(req, env);
      if (p === '/journal-view-total'    && req.method === 'GET')    return routeGetJournalViewTotal(req, env);

      if (p === '/chat'                     && req.method === 'POST')  return handleChat(req, env);

      return err('not found', 404);
    } catch (e) {
      return err('server error: ' + e.message, 500);
    }
  },
  async scheduled(event, env, ctx) {
    const run = async () => {
      const now = nowSec();
      const shouldPreloadCountry = event.cron === '*/15 * * * *' || event.cron === '12 16 * * *';
      const countryPreload = shouldPreloadCountry ? await runCountryOutputPreload(env, now) : null;
      // Run the bounded journal preload first. The analytics rollup scans
      // many historical windows and must not delay the quota-controlled
      // OpenAlex work at the start of a scheduled invocation.
      const result = await aggregateRecentStats(env, now);
      if (event.cron === '12 16 * * *') {
        const finalized = await recalibrateYesterday(env, now);
        return { ...result, finalized, countryPreload };
      }
      return { ...result, countryPreload };
    };
    const task = run().catch(e => console.error('analytics rollup failed:', e?.stack || e?.message || e));
    // Keep the promise in waitUntil for production and also await it so local
    // cron tests cannot exit before the preload batch has committed to D1.
    ctx.waitUntil(task);
    await task;
  },
};
