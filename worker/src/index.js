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
 *   GET  /favorites              (Bearer)                  → favorite ids
 *   PUT  /favorites              (Bearer) { favs: [...] }
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (o, status = 200, extra = {}) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });

const err = (msg, status = 400) => json({ error: msg }, status);

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

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');
}

async function getUser(req, env) {
  const h = req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;
  const row = await env.DB.prepare(
    'SELECT id, email, github_id, google_id, login, name, avatar_url, provider FROM users WHERE id = ?'
  ).bind(payload.uid).first();
  return row || null;
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
  return res.meta.last_row_id;
}

async function getUserById(env, id) {
  return env.DB.prepare(
    'SELECT id, email, github_id, google_id, login, name, avatar_url, provider FROM users WHERE id = ?'
  ).bind(id).first();
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    login: u.login,
    name: u.name,
    avatar_url: u.avatar_url,
    provider: u.provider,
  };
}

// ───────── routes: email ─────────
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
  const callback = `${u.origin}/auth/github/callback`;
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
  }

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
  const callback = `${u.origin}/auth/google/callback`;
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
  const configError = googleOAuthConfigError(env);
  if (configError) return err(configError, 503);
  const u = new URL(req.url);
  const code = u.searchParams.get('code');
  const ggState = u.searchParams.get('state');
  if (!code || !ggState) return err('missing code/state');
  let redirect = env.SITE_URL;
  try { redirect = JSON.parse(atob(ggState)).r || redirect; } catch {}
  const callback = `${u.origin}/auth/google/callback`;

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
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return err('google oauth exchange failed', 401);

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
  });
  const gg = await userRes.json();
  if (!gg.sub) return err('google user fetch failed', 401);

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
    await env.DB.prepare(
      `UPDATE users SET google_id=?, email=COALESCE(email, ?), name=?, avatar_url=?, updated_at=? WHERE id=?`
    ).bind(gg.sub, email, gg.name || '', gg.picture || '', now, uid).run();
  } else {
    const res = await env.DB.prepare(
      `INSERT INTO users (google_id, email, login, name, avatar_url, provider, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'google', ?, ?)`
    ).bind(gg.sub, email, email.split('@')[0] || gg.sub, gg.name || '', gg.picture || '', now, now).run();
    uid = res.meta.last_row_id;
  }

  const jwt = await signJWT({ uid, email }, env.JWT_SECRET);
  const r = new URL(redirect);
  r.searchParams.set('token', jwt);
  return Response.redirect(r.toString(), 302);
}

// ───────── routes: me + favorites ─────────
async function routeMe(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  return json(publicUser(u));
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

// ───────── dispatcher ─────────
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    const u = new URL(req.url);
    const p = u.pathname;
    try {
      if (p === '/')                                             return json({ name: 'ailatest-journal-api', ok: true, v: 2 });
      if (p === '/auth/email/request'  && req.method === 'POST') return routeEmailRequest(req, env);
      if (p === '/auth/email/verify'   && req.method === 'POST') return routeEmailVerify(req, env);
      if (p === '/auth/github'         && req.method === 'GET')  return routeAuthStart(req, env);
      if (p === '/auth/github/callback'&& req.method === 'GET')  return routeAuthCallback(req, env);
      if (p === '/auth/google'         && req.method === 'GET')  return routeGoogleStart(req, env);
      if (p === '/auth/google/callback'&& req.method === 'GET')  return routeGoogleCallback(req, env);
      if (p === '/me'                  && req.method === 'GET')  return routeMe(req, env);
      if (p === '/favorites'           && req.method === 'GET')  return routeGetFavs(req, env);
      if (p === '/favorites'           && req.method === 'PUT')  return routePutFavs(req, env);
      if (p === '/lists'               && req.method === 'GET')  return routeGetLists(req, env);
      if (p === '/lists'               && req.method === 'PUT')  return routePutLists(req, env);
      if (p === '/ratings'              && req.method === 'GET')  return routeGetRatings(req, env);
      if (p === '/ratings'              && req.method === 'PUT')  return routePutRating(req, env);
      if (p === '/ratings'              && req.method === 'DELETE') return routeDeleteRating(req, env);
      return err('not found', 404);
    } catch (e) {
      return err('server error: ' + e.message, 500);
    }
  },
};
