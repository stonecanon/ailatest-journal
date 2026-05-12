/**
 * AILatest Journal — Cloudflare Worker API
 * Endpoints:
 *   GET  /auth/github?state=...&redirect=...  → redirects to GitHub OAuth
 *   GET  /auth/github/callback?code=...       → exchanges code, issues JWT, redirects to `redirect` with ?token=
 *   GET  /me                                  → current user (Bearer)
 *   GET  /favorites                           → list favorite ids (Bearer)
 *   PUT  /favorites { favs: [...] }           → upsert full favorite set (Bearer)
 *
 * Bindings (wrangler.toml):
 *   [[d1_databases]] binding = "DB"
 *   [vars] GITHUB_CLIENT_ID, SITE_URL
 *   [secrets] GITHUB_CLIENT_SECRET, JWT_SECRET
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

// ───────── JWT (HS256) ─────────
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

async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + 60 * 60 * 24 * 30, ...payload };
  const part1 = b64url(enc.encode(JSON.stringify(header)));
  const part2 = b64url(enc.encode(JSON.stringify(body)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${part1}.${part2}`));
  return `${part1}.${part2}.${b64url(sig)}`;
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

async function getUser(req, env) {
  const h = req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;
  const row = await env.DB.prepare(
    'SELECT id, github_id, login, name, avatar_url FROM users WHERE id = ?'
  ).bind(payload.uid).first();
  return row || null;
}

// ───────── routes ─────────
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

  // exchange code → token
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

  // fetch user
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'User-Agent': 'ailatest-journal',
      'Accept': 'application/vnd.github+json',
    },
  });
  const gh = await userRes.json();
  if (!gh.id) return err('github user fetch failed', 401);

  // upsert user
  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE github_id = ?'
  ).bind(gh.id).first();

  let uid;
  const now = Math.floor(Date.now() / 1000);
  if (existing) {
    uid = existing.id;
    await env.DB.prepare(
      'UPDATE users SET login=?, name=?, avatar_url=?, updated_at=? WHERE id=?'
    ).bind(gh.login, gh.name || gh.login, gh.avatar_url || '', now, uid).run();
  } else {
    const res = await env.DB.prepare(
      'INSERT INTO users (github_id, login, name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(gh.id, gh.login, gh.name || gh.login, gh.avatar_url || '', now, now).run();
    uid = res.meta.last_row_id;
  }

  const jwt = await signJWT({ uid, login: gh.login }, env.JWT_SECRET);
  const r = new URL(redirect);
  r.searchParams.set('token', jwt);
  return Response.redirect(r.toString(), 302);
}

async function routeMe(req, env) {
  const u = await getUser(req, env);
  if (!u) return err('unauthorized', 401);
  return json({
    id: u.id, login: u.login, name: u.name, avatar_url: u.avatar_url,
  });
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

  // replace-all semantics: delete + insert
  const now = Math.floor(Date.now() / 1000);
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

// ───────── dispatcher ─────────
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    const u = new URL(req.url);
    try {
      if (u.pathname === '/') return json({ name: 'ailatest-journal-api', ok: true });
      if (u.pathname === '/auth/github' && req.method === 'GET') return routeAuthStart(req, env);
      if (u.pathname === '/auth/github/callback' && req.method === 'GET') return routeAuthCallback(req, env);
      if (u.pathname === '/me' && req.method === 'GET') return routeMe(req, env);
      if (u.pathname === '/favorites' && req.method === 'GET') return routeGetFavs(req, env);
      if (u.pathname === '/favorites' && req.method === 'PUT') return routePutFavs(req, env);
      return err('not found', 404);
    } catch (e) {
      return err('server error: ' + e.message, 500);
    }
  },
};
