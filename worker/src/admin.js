import { siteDefs } from './dashboard.js';
import {
  ensureEntitlementsTables,
  applyPaidSubscription,
  revokePaidSubscription,
  getEntitlements,
} from './entitlements.js';
import { ensureCreemTables } from './creem.js';

/*
 * AILatest owner console.
 *
 * The public sites are intentionally static.  This module provides the
 * missing operational surface in the Worker/D1 layer: one owner-only console
 * for every AILatest product, with auditable writes and soft deletes.
 */

const ADMIN_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Cache-Control': 'no-store',
};

const json = (value, status = 200, extra = {}) => new Response(
  JSON.stringify(value),
  { status, headers: { 'Content-Type': 'application/json', ...ADMIN_CORS, ...extra } },
);
const err = (message, status = 400, extra = {}) => json({ error: message }, status, extra);
const nowSec = () => Math.floor(Date.now() / 1000);
const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';

let schemaReady = false;

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
      redeemed_at INTEGER NOT NULL
    )`),
  ]);
  try { await env.DB.prepare('ALTER TABLE gift_codes ADD COLUMN revoked_at INTEGER').run(); } catch (_) {}
}

async function ensureApiKeyTables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'My API',
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    key_tail TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    revoked_at INTEGER,
    last_used_at INTEGER,
    call_count INTEGER NOT NULL DEFAULT 0
  )`).run();
  const info = await env.DB.prepare('PRAGMA table_info(api_keys)').all();
  const cols = new Map((info.results || []).map((r) => [String(r.name), r]));
  const idType = String(cols.get('id')?.type || '').toUpperCase();
  if (cols.has('id') && idType.includes('INT')) {
    const countExpr = cols.has('call_count')
      ? 'COALESCE(call_count, 0)'
      : cols.has('request_count') ? 'COALESCE(request_count, 0)' : '0';
    const tailExpr = cols.has('key_tail') ? "COALESCE(key_tail, '')" : "''";
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_keys_admin_v2 (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL DEFAULT 'My API',
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        key_tail TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        revoked_at INTEGER,
        last_used_at INTEGER,
        call_count INTEGER NOT NULL DEFAULT 0
      )`),
      env.DB.prepare(
        `INSERT OR IGNORE INTO api_keys_admin_v2
           (id, user_id, name, key_hash, key_prefix, key_tail, created_at, revoked_at, last_used_at, call_count)
         SELECT printf('legacy-%d', id), user_id, COALESCE(name, 'My API'), key_hash, key_prefix,
                ${tailExpr}, created_at, revoked_at, last_used_at, ${countExpr} FROM api_keys`
      ),
      env.DB.prepare('DROP TABLE api_keys'),
      env.DB.prepare('ALTER TABLE api_keys_admin_v2 RENAME TO api_keys'),
    ]);
  } else {
    try { await env.DB.prepare("ALTER TABLE api_keys ADD COLUMN key_tail TEXT NOT NULL DEFAULT ''").run(); } catch (_) {}
    try { await env.DB.prepare('ALTER TABLE api_keys ADD COLUMN call_count INTEGER NOT NULL DEFAULT 0').run(); } catch (_) {}
  }
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_admin_api_keys_user ON api_keys(user_id, created_at DESC)').run().catch(() => {});
}

async function ensureProductMembershipTables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS product_memberships (
    user_id INTEGER NOT NULL,
    product TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'inactive',
    paid_until INTEGER,
    external_user_key TEXT,
    source TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, product)
  )`).run();
}

async function ensureAdminSchema(env) {
  if (schemaReady) return;
  await ensureEntitlementsTables(env);
  await ensureCreemTables(env);
  await ensureGiftTables(env);
  await ensureApiKeyTables(env);
  await ensureProductMembershipTables(env);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_email TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      before_json TEXT,
      after_json TEXT,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS project_registry (
      project_id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      host TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'product',
      status TEXT NOT NULL DEFAULT 'active',
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_project_registry_status ON project_registry(status, updated_at DESC)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS content_overrides (
      project_id TEXT NOT NULL,
      record_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      payload_json TEXT NOT NULL DEFAULT '{}',
      note TEXT NOT NULL DEFAULT '',
      updated_by INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (project_id, record_key)
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_content_overrides_project ON content_overrides(project_id, updated_at DESC)'),
  ]);
  // These two fields are intentionally runtime-idempotent because older
  // production users tables predate the admin console migration.
  try { await env.DB.prepare("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'").run(); } catch (_) {}
  try { await env.DB.prepare("ALTER TABLE users ADD COLUMN admin_note TEXT NOT NULL DEFAULT ''").run(); } catch (_) {}

  const now = nowSec();
  const seeds = siteDefs().map((site) => env.DB.prepare(
    `INSERT OR IGNORE INTO project_registry
       (project_id, label, host, kind, status, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', '', ?, ?)`
  ).bind(site.id, site.label, site.host, site.kind || 'product', now, now));
  if (seeds.length) await env.DB.batch(seeds);
  schemaReady = true;
}

async function requireOwner(req, env, ctx) {
  const user = await ctx.getUser(req, env).catch(() => null);
  if (!user) return { response: err('login required', 401) };
  if (!ctx.isOwnerUser(user, env)) return { response: err('forbidden', 403) };
  return { user };
}

function parseJson(value, fallback = {}) {
  try {
    const parsed = JSON.parse(String(value || ''));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function jsonText(value, max = 20000) {
  try {
    return JSON.stringify(value && typeof value === 'object' ? value : {} ).slice(0, max);
  } catch (_) {
    return '{}';
  }
}

async function audit(env, actor, action, resourceType, resourceId, before, after) {
  await env.DB.prepare(
    `INSERT INTO admin_audit_log
       (actor_user_id, actor_email, action, resource_type, resource_id, before_json, after_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    actor?.id || null,
    clean(actor?.email || actor?.login || '', 200),
    action,
    resourceType,
    resourceId == null ? null : String(resourceId),
    before == null ? null : jsonText(before),
    after == null ? null : jsonText(after),
    nowSec(),
  ).run().catch((e) => console.warn('admin audit write failed:', e?.message || e));
}

function parsePositiveId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseTime(value, { allowNull = true } = {}) {
  if (value === null || value === '' || value === undefined) return allowNull ? null : 0;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

async function routeSummary(env) {
  const [users, activeUsers, entitlements, memberships, keys, overrides, audits] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM users').first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE COALESCE(status, 'active') = 'active'").first(),
    env.DB.prepare('SELECT tier, COUNT(*) AS n FROM user_entitlements GROUP BY tier').all(),
    env.DB.prepare('SELECT product, status, COUNT(*) AS n FROM product_memberships GROUP BY product, status').all(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM api_keys WHERE revoked_at IS NULL').first(),
    env.DB.prepare('SELECT project_id, COUNT(*) AS n FROM content_overrides GROUP BY project_id').all(),
    env.DB.prepare('SELECT id, action, resource_type, resource_id, actor_email, created_at FROM admin_audit_log ORDER BY id DESC LIMIT 10').all(),
  ]);
  const projects = await env.DB.prepare('SELECT * FROM project_registry ORDER BY status ASC, project_id ASC').all();
  return json({
    ok: true,
    generated_at: new Date().toISOString(),
    projects: projects.results || [],
    counts: {
      users: Number(users?.n || 0),
      active_users: Number(activeUsers?.n || 0),
      api_keys: Number(keys?.n || 0),
      overrides: overrides.results || [],
      entitlements: entitlements.results || [],
      memberships: memberships.results || [],
    },
    recent_audit: audits.results || [],
  });
}

async function routeProjects(req, env, actor, match) {
  if (req.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM project_registry ORDER BY status ASC, project_id ASC').all();
    return json({ ok: true, projects: rows.results || [] });
  }
  const id = match?.[1] || '';
  const body = await req.json().catch(() => ({}));
  if (req.method === 'POST') {
    const projectId = clean(body?.project_id || body?.id || '', 40).toLowerCase();
    const label = clean(body?.label || projectId, 100);
    const host = clean(body?.host || '', 160).toLowerCase();
    const kind = clean(body?.kind || 'product', 30) || 'product';
    if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(projectId) || !label || !/^[a-z0-9.-]+$/.test(host)) {
      return err('invalid project');
    }
    const now = nowSec();
    try {
      await env.DB.prepare(
        `INSERT INTO project_registry (project_id, label, host, kind, status, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
      ).bind(projectId, label, host, kind, clean(body?.note || '', 500), now, now).run();
    } catch (_) {
      return err('project already exists', 409);
    }
    const after = await env.DB.prepare('SELECT * FROM project_registry WHERE project_id = ?').bind(projectId).first();
    await audit(env, actor, 'create', 'project', projectId, null, after);
    return json({ ok: true, project: after }, 201);
  }
  if (!id) return err('project id required', 400);
  const before = await env.DB.prepare('SELECT * FROM project_registry WHERE project_id = ?').bind(id).first();
  if (!before) return err('project not found', 404);
  if (req.method === 'PATCH') {
    const patch = {
      label: body?.label == null ? before.label : clean(body.label, 100),
      host: body?.host == null ? before.host : clean(body.host, 160).toLowerCase(),
      kind: body?.kind == null ? before.kind : clean(body.kind, 30),
      status: body?.status == null ? before.status : clean(body.status, 20),
      note: body?.note == null ? before.note : clean(body.note, 500),
    };
    if (!patch.label || !/^[a-z0-9.-]+$/.test(patch.host) || !['active', 'archived', 'paused'].includes(patch.status)) {
      return err('invalid project fields');
    }
    await env.DB.prepare(
      `UPDATE project_registry SET label=?, host=?, kind=?, status=?, note=?, updated_at=? WHERE project_id=?`
    ).bind(patch.label, patch.host, patch.kind || 'product', patch.status, patch.note, nowSec(), id).run();
    const after = await env.DB.prepare('SELECT * FROM project_registry WHERE project_id = ?').bind(id).first();
    await audit(env, actor, 'update', 'project', id, before, after);
    return json({ ok: true, project: after });
  }
  if (req.method === 'DELETE') {
    await env.DB.prepare("UPDATE project_registry SET status='archived', updated_at=? WHERE project_id=?").bind(nowSec(), id).run();
    const after = await env.DB.prepare('SELECT * FROM project_registry WHERE project_id = ?').bind(id).first();
    await audit(env, actor, 'archive', 'project', id, before, after);
    return json({ ok: true, project: after, soft_deleted: true });
  }
  return err('method not allowed', 405);
}

async function routeUsers(req, env, actor, match) {
  const id = match?.[1] || '';
  if (req.method === 'GET' && !id) {
    const url = new URL(req.url);
    const query = clean(url.searchParams.get('q') || url.searchParams.get('search') || '', 120);
    const page = Math.min(1000, Math.max(1, Number(url.searchParams.get('page') || 1)));
    const limit = Math.min(100, Math.max(10, Number(url.searchParams.get('limit') || 50)));
    const offset = (page - 1) * limit;
    const like = `%${query.replace(/[%_]/g, '')}%`;
    const where = query ? 'WHERE (u.email LIKE ? OR u.login LIKE ? OR u.name LIKE ?)' : '';
    const binds = query ? [like, like, like, limit, offset] : [limit, offset];
    const rows = await env.DB.prepare(
      `SELECT u.id, u.email, u.login, u.name, u.provider, u.status, u.admin_note, u.created_at, u.updated_at,
              e.tier, e.paid_until, e.edu_verified,
              (SELECT COUNT(*) FROM favorites f WHERE f.user_id=u.id) AS favorites_count,
              (SELECT COUNT(*) FROM api_keys k WHERE k.user_id=u.id AND k.revoked_at IS NULL) AS api_keys_count
         FROM users u LEFT JOIN user_entitlements e ON e.user_id=u.id
         ${where}
        ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds).all();
    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users u ${where}`).bind(...(query ? [like, like, like] : [])).first();
    return json({ ok: true, page, limit, total: Number(total?.n || 0), users: rows.results || [] });
  }
  const userId = parsePositiveId(id);
  if (!userId) return err('invalid user id', 400);
  const before = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first();
  if (!before) return err('user not found', 404);
  if (req.method === 'GET') {
    const [ent, credits, memberships, keys, favs] = await Promise.all([
      env.DB.prepare('SELECT * FROM user_entitlements WHERE user_id=?').bind(userId).first(),
      env.DB.prepare('SELECT * FROM user_credits WHERE user_id=?').bind(userId).first(),
      env.DB.prepare('SELECT * FROM product_memberships WHERE user_id=? ORDER BY product').bind(userId).all(),
      env.DB.prepare('SELECT id, name, key_prefix, key_tail, created_at, revoked_at, last_used_at, call_count FROM api_keys WHERE user_id=? ORDER BY created_at DESC').bind(userId).all(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM favorites WHERE user_id=?').bind(userId).first(),
    ]);
    return json({ ok: true, user: before, entitlements: ent || null, credits: credits || null, memberships: memberships.results || [], api_keys: keys.results || [], favorites_count: Number(favs?.n || 0) });
  }
  const body = await req.json().catch(() => ({}));
  if (req.method === 'PATCH') {
    const patch = {
      email: body?.email == null ? before.email : clean(body.email, 240).toLowerCase(),
      login: body?.login == null ? before.login : clean(body.login, 100),
      name: body?.name == null ? before.name : clean(body.name, 160),
      status: body?.status == null ? (before.status || 'active') : clean(body.status, 20),
      admin_note: body?.admin_note == null ? (before.admin_note || '') : clean(body.admin_note, 1000),
    };
    if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) return err('invalid email');
    if (!['active', 'disabled'].includes(patch.status)) return err('invalid user status');
    if (Number(actor.id) === userId && patch.status !== 'active') return err('cannot disable current owner', 409);
    try {
      await env.DB.prepare(
        `UPDATE users SET email=?, login=?, name=?, status=?, admin_note=?, updated_at=? WHERE id=?`
      ).bind(patch.email || null, patch.login || null, patch.name || '', patch.status, patch.admin_note, nowSec(), userId).run();
    } catch (e) {
      if (/unique|constraint/i.test(String(e?.message || ''))) return err('email or login already exists', 409);
      throw e;
    }
    if (patch.status === 'disabled') {
      await env.DB.prepare('UPDATE api_keys SET revoked_at=COALESCE(revoked_at, ?) WHERE user_id=?').bind(nowSec(), userId).run().catch(() => {});
    }
    const after = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first();
    await audit(env, actor, 'update', 'user', userId, before, after);
    return json({ ok: true, user: after });
  }
  if (req.method === 'DELETE') {
    if (Number(actor.id) === userId) return err('cannot disable current owner', 409);
    await env.DB.prepare("UPDATE users SET status='disabled', updated_at=? WHERE id=?").bind(nowSec(), userId).run();
    await env.DB.prepare('UPDATE api_keys SET revoked_at=COALESCE(revoked_at, ?) WHERE user_id=?').bind(nowSec(), userId).run().catch(() => {});
    const after = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first();
    await audit(env, actor, 'disable', 'user', userId, before, after);
    return json({ ok: true, user: after, soft_deleted: true });
  }
  return err('method not allowed', 405);
}

async function routeCreateUser(req, env, actor) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email || '', 240).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('valid email required');
  const now = nowSec();
  const login = clean(body?.login || email.split('@')[0], 100);
  try {
    const result = await env.DB.prepare(
      `INSERT INTO users (email, login, name, provider, status, admin_note, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', 'active', ?, ?, ?)`
    ).bind(email, login, clean(body?.name || login, 160), clean(body?.admin_note || '', 1000), now, now).run();
    const user = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(result.meta.last_row_id).first();
    await audit(env, actor, 'create', 'user', user.id, null, user);
    return json({ ok: true, user }, 201);
  } catch (e) {
    if (/unique|constraint/i.test(String(e?.message || ''))) return err('user already exists', 409);
    throw e;
  }
}

async function routeEntitlements(req, env, actor, match) {
  const userId = parsePositiveId(match?.[1]);
  if (!userId) return err('invalid user id', 400);
  const user = await env.DB.prepare('SELECT id, email, login, name FROM users WHERE id=?').bind(userId).first();
  if (!user) return err('user not found', 404);
  // Ensure a row exists before a manual Free downgrade; otherwise a freshly
  // created account would have nothing to update.
  await ensureEntitlementsTables(env);
  await getEntitlements(env, user, false).catch(() => null);
  const before = await env.DB.prepare('SELECT * FROM user_entitlements WHERE user_id=?').bind(userId).first();
  if (req.method === 'GET') {
    const ent = await getEntitlements(env, user, false);
    const credits = await env.DB.prepare('SELECT * FROM user_credits WHERE user_id=?').bind(userId).first();
    return json({ ok: true, user, entitlements: ent, raw: before, credits });
  }
  if (req.method !== 'PATCH') return err('method not allowed', 405);
  const body = await req.json().catch(() => ({}));
  const tier = clean(body?.tier || '', 20).toLowerCase();
  if (!['free', 'trial', 'plus', 'pro'].includes(tier)) return err('tier must be free, trial, plus or pro');
  const paidUntil = parseTime(body?.paid_until, { allowNull: true });
  const productId = body?.product_id == null ? (before?.product_id || null) : clean(body.product_id, 160) || null;
  const eduProvided = Object.prototype.hasOwnProperty.call(body || {}, 'edu_verified');
  const eduVerified = eduProvided ? (body.edu_verified ? 1 : 0) : Number(before?.edu_verified || 0);
  if (tier === 'free') {
    await revokePaidSubscription(env, userId);
    await env.DB.prepare('UPDATE user_entitlements SET edu_verified=?, product_id=?, updated_at=? WHERE user_id=?')
      .bind(eduVerified, productId, nowSec(), userId).run();
  } else if (tier === 'plus' || tier === 'pro') {
    await applyPaidSubscription(env, userId, { tier, paidUntilSec: paidUntil, productId, eduVerified: !!eduVerified });
    if (eduProvided && !eduVerified) {
      await env.DB.prepare('UPDATE user_entitlements SET edu_verified=0, updated_at=? WHERE user_id=?').bind(nowSec(), userId).run();
    }
  } else {
    await ensureEntitlementsTables(env);
    const now = nowSec();
    await env.DB.prepare(
      `INSERT INTO user_entitlements (user_id, tier, trial_started_at, trial_expires_at, trial_used, edu_verified, paid_until, product_id, updated_at)
       VALUES (?, 'trial', ?, ?, 1, ?, NULL, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET tier='trial', trial_started_at=excluded.trial_started_at,
         trial_expires_at=excluded.trial_expires_at, trial_used=1, edu_verified=excluded.edu_verified,
         paid_until=NULL, product_id=excluded.product_id, updated_at=excluded.updated_at`
    ).bind(userId, now, paidUntil || now + 7 * 86400, eduVerified, productId, now).run();
  }
  const after = await env.DB.prepare('SELECT * FROM user_entitlements WHERE user_id=?').bind(userId).first();
  await audit(env, actor, 'update', 'entitlement', userId, before, after);
  return json({ ok: true, user_id: userId, entitlements: after });
}

async function routeCredits(req, env, actor, match) {
  const userId = parsePositiveId(match?.[1]);
  if (!userId) return err('invalid user id', 400);
  const user = await env.DB.prepare('SELECT id, email FROM users WHERE id=?').bind(userId).first();
  if (!user) return err('user not found', 404);
  if (req.method !== 'POST') return err('method not allowed', 405);
  const body = await req.json().catch(() => ({}));
  const amount = Math.floor(Number(body?.amount));
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000000) return err('amount must be a non-zero integer up to 1,000,000');
  await ensureEntitlementsTables(env);
  const now = nowSec();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_credits (user_id, monthly_credits, monthly_period, pack_credits, updated_at)
     VALUES (?, 0, '', 0, ?)`
  ).bind(userId, now).run();
  const before = await env.DB.prepare('SELECT * FROM user_credits WHERE user_id=?').bind(userId).first();
  const next = Math.max(0, Number(before?.pack_credits || 0) + amount);
  await env.DB.prepare('UPDATE user_credits SET pack_credits=?, updated_at=? WHERE user_id=?').bind(next, now, userId).run();
  await env.DB.prepare(
    'INSERT INTO credit_ledger (user_id, delta, balance_after, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, amount, Number(before?.monthly_credits || 0) + next, clean(body?.reason || 'admin_adjustment', 80), clean(body?.ref || '', 160) || null, now).run();
  const after = await env.DB.prepare('SELECT * FROM user_credits WHERE user_id=?').bind(userId).first();
  await audit(env, actor, 'adjust', 'credits', userId, before, after);
  return json({ ok: true, user_id: userId, credits: after });
}

async function routeMemberships(req, env, actor, match) {
  const userId = match?.[1] ? parsePositiveId(match[1]) : null;
  const product = match?.[2] ? decodeURIComponent(match[2]) : '';
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const filterProduct = clean(url.searchParams.get('product') || product || '', 40);
    const rows = filterProduct
      ? await env.DB.prepare(
        `SELECT m.*, u.email, u.login, u.name FROM product_memberships m LEFT JOIN users u ON u.id=m.user_id
         WHERE m.product=? ORDER BY m.updated_at DESC LIMIT 500`
      ).bind(filterProduct).all()
      : await env.DB.prepare(
        `SELECT m.*, u.email, u.login, u.name FROM product_memberships m LEFT JOIN users u ON u.id=m.user_id
         ORDER BY m.updated_at DESC LIMIT 500`
      ).all();
    return json({ ok: true, memberships: rows.results || [] });
  }
  const body = await req.json().catch(() => ({}));
  if (req.method === 'POST') {
    const uid = parsePositiveId(body?.user_id);
    const prod = clean(body?.product || '', 40).toLowerCase();
    if (!uid || !prod) return err('user_id and product required');
    const user = await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(uid).first();
    if (!user) return err('user not found', 404);
    const now = nowSec();
    await env.DB.prepare(
      `INSERT INTO product_memberships (user_id, product, plan, status, paid_until, external_user_key, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, product) DO UPDATE SET plan=excluded.plan, status=excluded.status,
         paid_until=excluded.paid_until, external_user_key=excluded.external_user_key,
         source=excluded.source, updated_at=excluded.updated_at`
    ).bind(uid, prod, clean(body?.plan || 'free', 40), clean(body?.status || 'inactive', 40), parseTime(body?.paid_until), clean(body?.external_user_key || '', 200) || null, clean(body?.source || 'admin', 80), now).run();
    const after = await env.DB.prepare('SELECT * FROM product_memberships WHERE user_id=? AND product=?').bind(uid, prod).first();
    await audit(env, actor, 'upsert', 'membership', `${uid}:${prod}`, null, after);
    return json({ ok: true, membership: after }, 201);
  }
  if (!userId || !product) return err('user_id and product required', 400);
  const before = await env.DB.prepare('SELECT * FROM product_memberships WHERE user_id=? AND product=?').bind(userId, product).first();
  if (!before) return err('membership not found', 404);
  if (req.method === 'PATCH') {
    const patch = {
      plan: body?.plan == null ? before.plan : clean(body.plan, 40),
      status: body?.status == null ? before.status : clean(body.status, 40),
      paid_until: body?.paid_until === undefined ? before.paid_until : parseTime(body.paid_until),
      external_user_key: body?.external_user_key === undefined ? before.external_user_key : clean(body.external_user_key, 200) || null,
      source: body?.source == null ? before.source : clean(body.source, 80),
    };
    await env.DB.prepare(
      `UPDATE product_memberships SET plan=?, status=?, paid_until=?, external_user_key=?, source=?, updated_at=?
       WHERE user_id=? AND product=?`
    ).bind(patch.plan, patch.status, patch.paid_until, patch.external_user_key, patch.source, nowSec(), userId, product).run();
    const after = await env.DB.prepare('SELECT * FROM product_memberships WHERE user_id=? AND product=?').bind(userId, product).first();
    await audit(env, actor, 'update', 'membership', `${userId}:${product}`, before, after);
    return json({ ok: true, membership: after });
  }
  if (req.method === 'DELETE') {
    await env.DB.prepare("UPDATE product_memberships SET status='inactive', updated_at=? WHERE user_id=? AND product=?").bind(nowSec(), userId, product).run();
    const after = await env.DB.prepare('SELECT * FROM product_memberships WHERE user_id=? AND product=?').bind(userId, product).first();
    await audit(env, actor, 'disable', 'membership', `${userId}:${product}`, before, after);
    return json({ ok: true, membership: after, soft_deleted: true });
  }
  return err('method not allowed', 405);
}

function normalizeGiftCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function createGiftCodeText(plan) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const token = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  const tag = plan === 'max' ? 'MAX' : 'PRO';
  return `JOURNAL-${tag}-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}-${token.slice(12)}`;
}

async function routeGiftCodes(req, env, actor) {
  await ensureGiftTables(env);
  if (req.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT g.code_hint, g.plan, g.duration_days, g.expires_at, g.created_by, g.created_at, g.revoked_at,
              r.user_id AS redeemed_by, r.redeemed_at
         FROM gift_codes g LEFT JOIN gift_redemptions r ON r.code_hash=g.code_hash
        ORDER BY g.created_at DESC LIMIT 500`
    ).all();
    return json({ ok: true, gift_codes: (rows.results || []).map((row) => ({
      ...row,
      status: row.revoked_at ? 'revoked' : row.redeemed_at ? 'redeemed' : 'active',
    })) });
  }
  const body = await req.json().catch(() => ({}));
  if (req.method === 'POST') {
    const plan = body?.plan === 'max' ? 'max' : body?.plan === 'pro' ? 'pro' : '';
    const duration = body?.duration_days === null || body?.duration_days === 'permanent' ? null : Math.floor(Number(body?.duration_days || 365));
    const quantity = Math.min(20, Math.max(1, Math.floor(Number(body?.quantity || 1))));
    if (!plan || (duration !== null && (!Number.isFinite(duration) || duration < 1 || duration > 3650))) return err('invalid gift options');
    const created = [];
    const stmts = [];
    const now = nowSec();
    for (let i = 0; i < quantity; i += 1) {
      const code = createGiftCodeText(plan);
      created.push(code);
      stmts.push(env.DB.prepare(
        `INSERT INTO gift_codes (code_hash, code_hint, plan, duration_days, expires_at, created_by, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`
      ).bind(await sha256Hex(normalizeGiftCode(code)), code.slice(-4), plan, duration, clean(actor.email || actor.login || actor.id, 200), now));
    }
    await env.DB.batch(stmts);
    await audit(env, actor, 'create', 'gift_code', `${plan}:${now}`, null, { plan, duration_days: duration, quantity });
    return json({ ok: true, codes: created, plan, duration_days: duration, created_at: now }, 201);
  }
  if (req.method === 'PATCH' || req.method === 'DELETE') {
    const code = normalizeGiftCode(body?.code || '');
    if (code.length < 12 || code.length > 80) return err('valid full gift code required');
    const hash = await sha256Hex(code);
    const before = await env.DB.prepare('SELECT code_hash, plan, revoked_at FROM gift_codes WHERE code_hash=?').bind(hash).first();
    if (!before) return err('gift code not found', 404);
    const redeemed = await env.DB.prepare('SELECT user_id, redeemed_at FROM gift_redemptions WHERE code_hash=?').bind(hash).first();
    if (redeemed) return err('redeemed gift code cannot be voided', 409);
    await env.DB.prepare('UPDATE gift_codes SET revoked_at=? WHERE code_hash=?').bind(nowSec(), hash).run();
    const after = await env.DB.prepare('SELECT code_hash, plan, revoked_at FROM gift_codes WHERE code_hash=?').bind(hash).first();
    await audit(env, actor, 'void', 'gift_code', before.code_hash.slice(0, 12), before, after);
    return json({ ok: true, voided: true, plan: before.plan });
  }
  return err('method not allowed', 405);
}

function apiKeySecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `aj_live_${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

async function routeApiKeys(req, env, actor, match) {
  await ensureApiKeyTables(env);
  const id = match?.[1] || '';
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const q = clean(url.searchParams.get('q') || '', 120);
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const rows = await env.DB.prepare(
      `SELECT k.id, k.user_id, u.email, u.login, k.name, k.key_prefix, k.key_tail, k.created_at,
              k.revoked_at, k.last_used_at, COALESCE(k.call_count, 0) AS call_count
         FROM api_keys k LEFT JOIN users u ON u.id=k.user_id
        WHERE (? = '' OR u.email LIKE ? OR u.login LIKE ? OR k.name LIKE ?)
        ORDER BY k.created_at DESC LIMIT 500`
    ).bind(q, like, like, like).all();
    return json({ ok: true, api_keys: rows.results || [] });
  }
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const userId = parsePositiveId(body?.user_id);
    if (!userId) return err('user_id required');
    const user = await env.DB.prepare('SELECT id, email FROM users WHERE id=?').bind(userId).first();
    if (!user) return err('user not found', 404);
    const secret = apiKeySecret();
    const idNew = crypto.randomUUID();
    const now = nowSec();
    const prefix = secret.slice(0, 8);
    const tail = secret.slice(-6);
    const hash = await sha256Hex(`${secret}|${env.API_KEY_PEPPER || env.JWT_SECRET || ''}`);
    await env.DB.prepare(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, key_tail, created_at, call_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(idNew, userId, clean(body?.name || 'Admin API', 80) || 'Admin API', hash, prefix, tail, now).run();
    const row = await env.DB.prepare('SELECT id, user_id, name, key_prefix, key_tail, created_at, revoked_at, last_used_at, call_count FROM api_keys WHERE id=?').bind(idNew).first();
    await audit(env, actor, 'create', 'api_key', idNew, null, row);
    return json({ ok: true, secret, api_key: row, warning: 'secret is shown once; store it securely' }, 201);
  }
  if (!id) return err('api key id required', 400);
  const before = await env.DB.prepare('SELECT id, user_id, name, key_prefix, key_tail, created_at, revoked_at, last_used_at, call_count FROM api_keys WHERE id=?').bind(id).first();
  if (!before) return err('api key not found', 404);
  if (req.method === 'PATCH' || req.method === 'DELETE') {
    if (req.method === 'PATCH') {
      const body = await req.json().catch(() => ({}));
      if (body?.name != null) await env.DB.prepare('UPDATE api_keys SET name=? WHERE id=?').bind(clean(body.name, 80) || 'My API', id).run();
    }
    await env.DB.prepare('UPDATE api_keys SET revoked_at=COALESCE(revoked_at, ?) WHERE id=?').bind(nowSec(), id).run();
    const after = await env.DB.prepare('SELECT id, user_id, name, key_prefix, key_tail, created_at, revoked_at, last_used_at, call_count FROM api_keys WHERE id=?').bind(id).first();
    await audit(env, actor, 'revoke', 'api_key', id, before, after);
    return json({ ok: true, api_key: after, soft_deleted: true });
  }
  return err('method not allowed', 405);
}

async function routePayments(req, env) {
  if (req.method !== 'GET') return err('payments are read-only; use Creem for refunds', 405);
  await ensureCreemTables(env);
  const [subscriptions, events] = await Promise.all([
    env.DB.prepare(
      `SELECT s.user_id, u.email, u.login, u.name, s.tier, s.status, s.product_id,
              s.creem_subscription_id, s.customer_id, s.customer_email, s.current_period_end, s.updated_at
         FROM creem_subscriptions s LEFT JOIN users u ON u.id=s.user_id
        ORDER BY s.updated_at DESC LIMIT 500`
    ).all(),
    env.DB.prepare('SELECT event_id, event_type, processed_at FROM creem_webhook_events ORDER BY processed_at DESC LIMIT 200').all(),
  ]);
  return json({ ok: true, read_only: true, subscriptions: subscriptions.results || [], webhook_events: events.results || [] });
}

async function routeOverrides(req, env, actor, match) {
  const projectId = clean(match?.[1] || '', 40);
  const recordKey = match?.[2] ? decodeURIComponent(match[2]) : '';
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const p = clean(url.searchParams.get('project') || projectId, 40);
    const q = clean(url.searchParams.get('q') || '', 160);
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const rows = await env.DB.prepare(
      `SELECT * FROM content_overrides
        WHERE (? = '' OR project_id=?) AND (? = '' OR record_key LIKE ?)
        ORDER BY updated_at DESC LIMIT 500`
    ).bind(p, p, q, like).all();
    return json({ ok: true, overrides: (rows.results || []).map((row) => ({ ...row, payload: parseJson(row.payload_json, {}) })) });
  }
  const body = await req.json().catch(() => ({}));
  if (req.method === 'POST') {
    const p = clean(body?.project_id || '', 40);
    const key = clean(body?.record_key || '', 240);
    if (!p || !key) return err('project_id and record_key required');
    const now = nowSec();
    const before = await env.DB.prepare('SELECT * FROM content_overrides WHERE project_id=? AND record_key=?').bind(p, key).first();
    await env.DB.prepare(
      `INSERT INTO content_overrides (project_id, record_key, status, payload_json, note, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, record_key) DO UPDATE SET status=excluded.status, payload_json=excluded.payload_json,
         note=excluded.note, updated_by=excluded.updated_by, updated_at=excluded.updated_at`
    ).bind(p, key, ['active', 'hidden', 'archived'].includes(body?.status) ? body.status : 'active', jsonText(body?.payload || {}), clean(body?.note || '', 1000), actor.id, now).run();
    const after = await env.DB.prepare('SELECT * FROM content_overrides WHERE project_id=? AND record_key=?').bind(p, key).first();
    await audit(env, actor, before ? 'update' : 'create', 'content_override', `${p}:${key}`, before, after);
    return json({ ok: true, override: { ...after, payload: parseJson(after.payload_json, {}) } }, before ? 200 : 201);
  }
  if (!projectId || !recordKey) return err('project_id and record_key required', 400);
  const before = await env.DB.prepare('SELECT * FROM content_overrides WHERE project_id=? AND record_key=?').bind(projectId, recordKey).first();
  if (!before) return err('override not found', 404);
  if (req.method === 'PATCH') {
    const status = body?.status == null ? before.status : clean(body.status, 20);
    const payload = body?.payload == null ? parseJson(before.payload_json, {}) : body.payload;
    const note = body?.note == null ? before.note : clean(body.note, 1000);
    if (!['active', 'hidden', 'archived'].includes(status)) return err('invalid override status');
    await env.DB.prepare('UPDATE content_overrides SET status=?, payload_json=?, note=?, updated_by=?, updated_at=? WHERE project_id=? AND record_key=?')
      .bind(status, jsonText(payload), note, actor.id, nowSec(), projectId, recordKey).run();
    const after = await env.DB.prepare('SELECT * FROM content_overrides WHERE project_id=? AND record_key=?').bind(projectId, recordKey).first();
    await audit(env, actor, 'update', 'content_override', `${projectId}:${recordKey}`, before, after);
    return json({ ok: true, override: { ...after, payload: parseJson(after.payload_json, {}) } });
  }
  if (req.method === 'DELETE') {
    await env.DB.prepare("UPDATE content_overrides SET status='archived', updated_by=?, updated_at=? WHERE project_id=? AND record_key=?")
      .bind(actor.id, nowSec(), projectId, recordKey).run();
    const after = await env.DB.prepare('SELECT * FROM content_overrides WHERE project_id=? AND record_key=?').bind(projectId, recordKey).first();
    await audit(env, actor, 'archive', 'content_override', `${projectId}:${recordKey}`, before, after);
    return json({ ok: true, override: after, soft_deleted: true });
  }
  return err('method not allowed', 405);
}

async function routeAudit(req, env) {
  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(20, Number(url.searchParams.get('limit') || 100)));
  const rows = await env.DB.prepare(
    'SELECT id, actor_user_id, actor_email, action, resource_type, resource_id, before_json, after_json, created_at FROM admin_audit_log ORDER BY id DESC LIMIT ?'
  ).bind(limit).all();
  return json({ ok: true, audit: rows.results || [] });
}

/** Route for /admin/api/*; every method is owner-gated before dispatch. */
export async function routeAdminApi(req, env, ctx) {
  const auth = await requireOwner(req, env, ctx);
  if (auth.response) return auth.response;
  await ensureAdminSchema(env);
  const actor = auth.user;
  const path = new URL(req.url).pathname.replace(/^\/api\//, '/').replace(/^\/admin\/api\/?/, '/');
  try {
    if (path === '/summary' && req.method === 'GET') return await routeSummary(env);
    if (path === '/projects' || /^\/projects\/[^/]+$/.test(path)) return await routeProjects(req, env, actor, path.match(/^\/projects\/([^/]+)$/));
    if (path === '/users' && req.method === 'POST') return await routeCreateUser(req, env, actor);
    if (path === '/users' || /^\/users\/\d+$/.test(path)) return await routeUsers(req, env, actor, path.match(/^\/users\/(\d+)$/));
    if (/^\/users\/\d+\/entitlements$/.test(path)) return await routeEntitlements(req, env, actor, path.match(/^\/users\/(\d+)\/entitlements$/));
    if (/^\/users\/\d+\/credits$/.test(path)) return await routeCredits(req, env, actor, path.match(/^\/users\/(\d+)\/credits$/));
    if (path === '/memberships' || /^\/memberships\/\d+\/[^/]+$/.test(path)) return await routeMemberships(req, env, actor, path.match(/^\/memberships\/(\d+)\/([^/]+)$/));
    if (path === '/gift-codes') return await routeGiftCodes(req, env, actor);
    if (path === '/api-keys' || /^\/api-keys\/[^/]+$/.test(path)) return await routeApiKeys(req, env, actor, path.match(/^\/api-keys\/([^/]+)$/));
    if (path === '/payments') return await routePayments(req, env);
    if (path === '/overrides' || /^\/overrides\/[^/]+\/[^/]+$/.test(path)) return await routeOverrides(req, env, actor, path.match(/^\/overrides\/([^/]+)\/([^/]+)$/));
    if (path === '/audit') return await routeAudit(req, env);
    return err('admin endpoint not found', 404);
  } catch (e) {
    console.error('admin api error:', e?.stack || e?.message || e);
    return err('admin operation failed: ' + (e?.message || 'unknown error'), 500);
  }
}

const ADMIN_HTML = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AILatest Admin</title>
<style>
:root{--bg:#f6f8fb;--card:#fff;--ink:#172033;--muted:#697586;--line:#e5e9f0;--accent:#f26722;--accent2:#ff9b54;--danger:#b42318;--nav:#172033;--nav2:#26334b;--shadow:0 12px 34px rgba(23,32,51,.08)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer;border:0;border-radius:9px;padding:9px 13px;background:var(--accent);color:#fff;font-weight:650}button.ghost{background:#eef2f7;color:var(--ink)}button.danger{background:#fff0ee;color:var(--danger);border:1px solid #ffd2cb}button.small{font-size:12px;padding:6px 9px}.app{display:flex;min-height:100vh}.side{width:232px;background:var(--nav);color:#dbe5f4;padding:22px 14px;position:sticky;top:0;height:100vh}.brand{font-size:20px;font-weight:800;padding:0 10px 22px;color:#fff}.brand small{display:block;color:#9aa9c1;font-size:11px;font-weight:500;margin-top:3px}.nav{display:grid;gap:4px}.nav button{background:transparent;color:#b9c6d9;text-align:left;font-weight:600;width:100%;border-radius:8px}.nav button:hover,.nav button.on{background:var(--nav2);color:#fff}.side-foot{position:absolute;bottom:20px;left:24px;right:24px;color:#93a2b9;font-size:12px}.main{flex:1;min-width:0;padding:26px 30px 50px}.top{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:22px}.top h1{margin:0;font-size:26px}.top p{margin:3px 0 0;color:var(--muted)}.top-actions{display:flex;gap:8px;align-items:center}.view{display:none}.view.active{display:block}.card{background:var(--card);border:1px solid var(--line);border-radius:15px;box-shadow:var(--shadow);padding:18px;margin-bottom:18px}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.metric{font-size:28px;font-weight:800;margin-top:7px}.label{color:var(--muted);font-size:12px}.toolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-bottom:13px}.toolbar input,.toolbar select,.form input,.form select,.form textarea{border:1px solid var(--line);border-radius:8px;padding:9px 10px;background:#fff;color:var(--ink)}.toolbar input{min-width:230px}.table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse;min-width:720px}.table th,.table td{padding:10px 9px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.table th{font-size:12px;color:var(--muted);font-weight:700;white-space:nowrap}.table td small{color:var(--muted)}.badge{display:inline-flex;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:700;background:#eef2f7;color:#536174}.badge.good{background:#e7f8ee;color:#176b3b}.badge.warn{background:#fff5dc;color:#8a5b00}.badge.bad{background:#fff0ee;color:#a42c20}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.form{display:grid;gap:10px}.form label{display:grid;gap:5px;color:var(--muted);font-size:12px;font-weight:650}.form textarea{min-height:110px;resize:vertical}.form-actions{display:flex;gap:8px;justify-content:flex-end}.muted{color:var(--muted)}.notice{padding:12px 14px;border-radius:10px;background:#fff8e7;color:#795e1d;border:1px solid #f8e5ad;margin-bottom:15px}.empty{padding:30px;text-align:center;color:var(--muted)}.login{max-width:560px;margin:80px auto;text-align:center}.login h2{margin-top:0}.login a{display:inline-block;text-decoration:none;margin-top:12px}.json{font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;background:#f4f6f9;border-radius:8px;padding:10px;max-height:250px;overflow:auto}.toast{position:fixed;right:22px;bottom:22px;background:#172033;color:#fff;padding:11px 15px;border-radius:10px;box-shadow:var(--shadow);display:none;z-index:20}.toast.show{display:block}.modal-back{position:fixed;inset:0;background:rgba(18,27,44,.36);display:none;align-items:center;justify-content:center;padding:20px;z-index:10}.modal-back.show{display:flex}.modal{background:#fff;border-radius:15px;max-width:720px;width:100%;max-height:90vh;overflow:auto;padding:22px;box-shadow:0 20px 70px rgba(0,0,0,.2)}.modal h3{margin:0 0 14px}@media(max-width:900px){.side{width:190px}.main{padding:20px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.app{display:block}.side{position:static;height:auto;width:auto;padding:14px}.brand{padding-bottom:12px}.nav{display:flex;overflow:auto}.nav button{white-space:nowrap;width:auto}.side-foot{display:none}.main{padding:15px}.cards{grid-template-columns:1fr 1fr}.top{align-items:flex-start;flex-direction:column}.grid2{grid-template-columns:1fr}}
</style>
</head>
<body>
<div id="root"><div class="card login"><h2>AILatest Admin</h2><p class="muted">统一管理 Journal、Grant、Path、Major、Todo 与 Studio。此页面仅限站长账号。</p><a id="loginLink" class="button" href="#"><button>使用 Google 站长账号登录</button></a></div></div>
<div id="toast" class="toast"></div><div id="modalBack" class="modal-back"><div id="modal" class="modal"></div></div>
<script>
(function(){
  var API=location.origin, TOKEN_KEY='ailatest.dashboard.token', token=new URLSearchParams(location.search).get('token')||localStorage.getItem(TOKEN_KEY)||'';
  if(token){localStorage.setItem(TOKEN_KEY,token);history.replaceState({},'',location.pathname);}
  var current='overview', cache={};
  var root=document.getElementById('root'), toast=document.getElementById('toast'), modalBack=document.getElementById('modalBack'), modal=document.getElementById('modal');
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function fmtTime(v){if(!v)return '-';var n=Number(v);if(Number.isFinite(n)&&n<100000000000)n*=1000;var d=new Date(n);return Number.isNaN(d.getTime())?esc(v):d.toLocaleString();}
  function badge(v){var s=String(v==null?'':v), cls=s==='active'||s==='ok'||s==='plus'||s==='pro'?'good':s==='disabled'||s==='archived'||s==='revoked'||s==='inactive'?'bad':'warn';return '<span class="badge '+cls+'">'+esc(s||'-')+'</span>';}
  function notify(msg){toast.textContent=msg;toast.classList.add('show');setTimeout(function(){toast.classList.remove('show');},2600);}
  function showModal(title,body){modal.innerHTML='<h3>'+esc(title)+'</h3>'+body;modalBack.classList.add('show');}
  function closeModal(){modalBack.classList.remove('show');}
  modalBack.addEventListener('click',function(e){if(e.target===modalBack)closeModal();});
  function loginLink(){return API+'/auth/google?analytics=1&redirect='+encodeURIComponent(location.href.split('?')[0]);}
  document.getElementById('loginLink').href=loginLink();
  async function api(path,opt){opt=opt||{};var h=opt.headers||{};h['Content-Type']='application/json';if(token)h.Authorization='Bearer '+token;var res=await fetch(API+'/admin/api'+path,{...opt,headers:h});var data=await res.json().catch(function(){return{};});if(res.status===401||res.status===403){throw new Error(data.error||'请先用站长账号登录');}if(!res.ok)throw new Error(data.error||('HTTP '+res.status));return data;}
  function shell(){root.innerHTML='<div class="app"><aside class="side"><div class="brand">AILatest Admin<small>Owner console · all projects</small></div><nav class="nav">'+[['overview','总览'],['projects','项目'],['users','用户'],['entitlements','权益'],['memberships','会员'],['gift-codes','礼品码'],['api-keys','API Keys'],['payments','支付'],['overrides','覆盖配置'],['audit','审计']].map(function(x){return '<button data-view="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</nav><div class="side-foot">所有写操作进入审计日志<br>删除均为停用/归档</div></aside><main class="main"><div class="top"><div><h1 id="title">总览</h1><p id="subtitle">AILatest 统一后台</p></div><div class="top-actions"><button class="ghost small" id="refresh">刷新</button><button class="ghost small" id="logout">退出</button></div></div><section id="overview" class="view"></section><section id="projects" class="view"></section><section id="users" class="view"></section><section id="entitlements" class="view"></section><section id="memberships" class="view"></section><section id="gift-codes" class="view"></section><section id="api-keys" class="view"></section><section id="payments" class="view"></section><section id="overrides" class="view"></section><section id="audit" class="view"></section></main></div>';
    document.querySelectorAll('.nav button').forEach(function(b){b.onclick=function(){go(b.dataset.view);};});document.getElementById('refresh').onclick=function(){load(current);};document.getElementById('logout').onclick=function(){localStorage.removeItem(TOKEN_KEY);location.reload();};
  }
  function go(view){current=view;document.querySelectorAll('.nav button').forEach(function(b){b.classList.toggle('on',b.dataset.view===view);});document.querySelectorAll('.view').forEach(function(v){v.classList.toggle('active',v.id===view);});var names={'overview':'总览','projects':'项目','users':'用户','entitlements':'权益','memberships':'会员','gift-codes':'礼品码','api-keys':'API Keys','payments':'支付','overrides':'覆盖配置','audit':'审计'};document.getElementById('title').textContent=names[view]||view;load(view);}
  function set(id,html){document.getElementById(id).innerHTML=html;}
  function openUserForm(user){showModal(user?'编辑用户':'新建用户','<form id="userForm" class="form"><label>邮箱<input name="email" type="email" value="'+esc(user&&user.email||'')+'" required></label><label>登录名<input name="login" value="'+esc(user&&user.login||'')+'"></label><label>姓名<input name="name" value="'+esc(user&&user.name||'')+'"></label><label>状态<select name="status"><option value="active" '+((!user||user.status==='active')?'selected':'')+'>active</option><option value="disabled" '+(user&&user.status==='disabled'?'selected':'')+'>disabled</option></select></label><label>后台备注<textarea name="admin_note">'+esc(user&&user.admin_note||'')+'</textarea></label><div class="form-actions"><button type="button" class="ghost" id="cancel">取消</button><button>保存</button></div></form>');document.getElementById('cancel').onclick=closeModal;document.getElementById('userForm').onsubmit=async function(e){e.preventDefault();var o=Object.fromEntries(new FormData(e.target));try{await api(user?'/users/'+user.id:'/users',{method:user?'PATCH':'POST',body:JSON.stringify(o)});closeModal();notify('已保存');load('users');}catch(err){notify(err.message);}};}
  async function load(view){try{if(view==='overview')return renderOverview(await api('/summary'));if(view==='projects')return renderProjects(await api('/projects'));if(view==='users')return renderUsers(await api('/users'+(cache.userQ?'?q='+encodeURIComponent(cache.userQ):'')));if(view==='entitlements')return renderEntitlements(await api('/users?limit=100'));if(view==='memberships')return renderMemberships(await api('/memberships'));if(view==='gift-codes')return renderGiftCodes(await api('/gift-codes'));if(view==='api-keys')return renderApiKeys(await api('/api-keys'));if(view==='payments')return renderPayments(await api('/payments'));if(view==='overrides')return renderOverrides(await api('/overrides'));if(view==='audit')return renderAudit(await api('/audit'));}catch(e){if(!token){root.innerHTML='<div class="card login"><h2>需要站长登录</h2><p class="muted">'+esc(e.message)+'</p><a href="'+esc(loginLink())+'"><button>使用 Google 登录</button></a></div>';return;}notify(e.message);}}
  function renderOverview(d){var c=d.counts||{};set('overview','<div class="cards"><div class="card"><div class="label">用户</div><div class="metric">'+(c.users||0)+'</div><div class="muted">活跃 '+(c.active_users||0)+'</div></div><div class="card"><div class="label">API Keys</div><div class="metric">'+(c.api_keys||0)+'</div><div class="muted">未撤销</div></div><div class="card"><div class="label">项目</div><div class="metric">'+(d.projects||[]).length+'</div><div class="muted">统一注册表</div></div><div class="card"><div class="label">覆盖配置</div><div class="metric">'+(c.overrides||[]).reduce(function(a,x){return a+Number(x.n||0);},0)+'</div><div class="muted">D1 可追踪</div></div></div><div class="card"><h3>项目状态</h3>'+projectTable(d.projects||[])+'</div><div class="card"><h3>最近操作</h3>'+auditTable(d.recent_audit||[])+'</div>');}
  function projectTable(rows){if(!rows.length)return '<div class="empty">暂无项目</div>';return '<div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>名称</th><th>域名</th><th>类型</th><th>状态</th><th>更新时间</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.project_id)+'</td><td>'+esc(r.label)+'</td><td>'+esc(r.host)+'</td><td>'+esc(r.kind)+'</td><td>'+badge(r.status)+'</td><td>'+fmtTime(r.updated_at)+'</td></tr>';}).join('')+'</tbody></table></div>';}
  function renderProjects(d){var rows=d.projects||[];set('projects','<div class="toolbar"><button id="newProject">+ 新项目</button><button class="ghost" id="analytics">打开数据看板</button></div><div class="card">'+projectTable(rows).replace(/<tbody>/,'<tbody>')+'</div><div class="card"><div class="notice">项目注册表管理所有 AILatest 站点的标签、域名和启停状态；归档不会删除统计或用户数据。</div><div class="table-wrap"><table class="table"><thead><tr><th>项目</th><th>备注</th><th>操作</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.project_id)+' · '+esc(r.label)+'</td><td>'+esc(r.note||'')+'</td><td><button class="small ghost edit-project" data-id="'+esc(r.project_id)+'">编辑</button> <button class="small danger archive-project" data-id="'+esc(r.project_id)+'">归档</button></td></tr>';}).join('')+'</tbody></table></div></div>');document.getElementById('analytics').onclick=function(){window.open(API+'/analytics/sites','_blank');};document.getElementById('newProject').onclick=function(){projectForm(null);};document.querySelectorAll('.edit-project').forEach(function(b){b.onclick=function(){projectForm(rows.find(function(x){return x.project_id===b.dataset.id;}));};});document.querySelectorAll('.archive-project').forEach(function(b){b.onclick=async function(){if(!confirm('归档该项目？'))return;try{await api('/projects/'+encodeURIComponent(b.dataset.id),{method:'DELETE'});notify('已归档');load('projects');}catch(e){notify(e.message);}};});}
  function projectForm(p){showModal(p?'编辑项目':'新项目','<form id="projectForm" class="form"><label>ID<input name="project_id" value="'+esc(p&&p.project_id||'')+'" '+(p?'readonly':'')+' required></label><label>名称<input name="label" value="'+esc(p&&p.label||'')+'" required></label><label>域名<input name="host" value="'+esc(p&&p.host||'')+'" required></label><label>类型<input name="kind" value="'+esc(p&&p.kind||'product')+'"></label><label>状态<select name="status"><option '+(!p||p.status==='active'?'selected':'')+'>active</option><option '+(p&&p.status==='paused'?'selected':'')+'>paused</option><option '+(p&&p.status==='archived'?'selected':'')+'>archived</option></select></label><label>备注<textarea name="note">'+esc(p&&p.note||'')+'</textarea></label><div class="form-actions"><button type="button" class="ghost" id="cancel">取消</button><button>保存</button></div></form>');document.getElementById('cancel').onclick=closeModal;document.getElementById('projectForm').onsubmit=async function(e){e.preventDefault();var o=Object.fromEntries(new FormData(e.target));try{await api(p?'/projects/'+encodeURIComponent(p.project_id):'/projects',{method:p?'PATCH':'POST',body:JSON.stringify(o)});closeModal();notify('已保存');load('projects');}catch(err){notify(err.message);}};}
  function renderUsers(d){var rows=d.users||[];set('users','<div class="toolbar"><input id="userSearch" placeholder="搜索邮箱 / 登录名 / 姓名" value="'+esc(cache.userQ||'')+'"><button id="searchUsers">搜索</button><button id="newUser">+ 新用户</button></div><div class="card"><div class="muted">共 '+(d.total||0)+' 个用户</div><div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>用户</th><th>权益</th><th>收藏</th><th>API Keys</th><th>状态</th><th>操作</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+r.id+'</td><td><b>'+esc(r.name||r.login||'-')+'</b><br><small>'+esc(r.email||'')+' · '+esc(r.provider||'')+'</small></td><td>'+badge(r.tier||'free')+(r.paid_until?'<br><small>至 '+fmtTime(r.paid_until)+'</small>':'')+'</td><td>'+Number(r.favorites_count||0)+'</td><td>'+Number(r.api_keys_count||0)+'</td><td>'+badge(r.status||'active')+'</td><td><button class="small ghost user-detail" data-id="'+r.id+'">详情</button> <button class="small ghost user-edit" data-id="'+r.id+'">编辑</button> <button class="small danger user-disable" data-id="'+r.id+'">停用</button></td></tr>';}).join('')+'</tbody></table></div></div>');document.getElementById('searchUsers').onclick=function(){cache.userQ=document.getElementById('userSearch').value.trim();load('users');};document.getElementById('userSearch').onkeydown=function(e){if(e.key==='Enter')document.getElementById('searchUsers').click();};document.getElementById('newUser').onclick=function(){openUserForm(null);};document.querySelectorAll('.user-detail').forEach(function(b){b.onclick=function(){userDetail(b.dataset.id);};});document.querySelectorAll('.user-edit').forEach(function(b){b.onclick=async function(){try{openUserForm((await api('/users/'+b.dataset.id)).user);}catch(e){notify(e.message);}};});document.querySelectorAll('.user-disable').forEach(function(b){b.onclick=async function(){if(!confirm('停用该用户？'))return;try{await api('/users/'+b.dataset.id,{method:'DELETE'});notify('已停用');load('users');}catch(e){notify(e.message);}};});}
  async function userDetail(id){try{var d=await api('/users/'+id);var u=d.user||{};showModal('用户 #'+id,'<div class="card"><b>'+esc(u.name||u.login||'-')+'</b><br>'+esc(u.email||'')+' · '+badge(u.status||'active')+'</div><div class="grid2"><div><h4>权益</h4><div class="json">'+esc(JSON.stringify(d.entitlements||{},null,2))+'</div></div><div><h4>Credits</h4><div class="json">'+esc(JSON.stringify(d.credits||{},null,2))+'</div></div></div><h4>会员</h4>'+projectTable((d.memberships||[]).map(function(x){return {project_id:x.product,label:x.plan,host:x.external_user_key||'',kind:x.source||'',status:x.status,updated_at:x.updated_at};}))+'<div class="form-actions"><button class="ghost" id="editFromDetail">编辑用户</button><button class="ghost" id="closeDetail">关闭</button></div>');document.getElementById('closeDetail').onclick=closeModal;document.getElementById('editFromDetail').onclick=function(){closeModal();openUserForm(u);};}catch(e){notify(e.message);}}
  function renderEntitlements(d){var rows=d.users||[];set('entitlements','<div class="toolbar"><button id="grantEnt">+ 调整用户权益</button></div><div class="card"><div class="notice">Pro = plus，Max = pro。到期时间可填 ISO 日期或 Unix 秒；Free/停用会撤销付费权益。</div><div class="table-wrap"><table class="table"><thead><tr><th>用户</th><th>当前档位</th><th>到期</th><th>教育验证</th><th>操作</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>#'+r.id+' '+esc(r.email||r.login||'')+'</td><td>'+badge(r.tier||'free')+'</td><td>'+fmtTime(r.paid_until)+'</td><td>'+badge(Number(r.edu_verified)?'verified':'no')+'</td><td><button class="small ghost ent-edit" data-id="'+r.id+'">编辑</button></td></tr>';}).join('')+'</tbody></table></div></div>');document.getElementById('grantEnt').onclick=function(){entForm(null);};document.querySelectorAll('.ent-edit').forEach(function(b){b.onclick=function(){entForm(rows.find(function(x){return String(x.id)===String(b.dataset.id);})||{id:b.dataset.id});};});}
  function entForm(row){var tier=(row&&row.tier)||'free';showModal('调整权益','<form id="entForm" class="form"><label>用户 ID<input name="user_id" value="'+esc(row&&row.id||'')+'" required></label><label>档位<select name="tier"><option value="free" '+(tier==='free'?'selected':'')+'>Free</option><option value="trial" '+(tier==='trial'?'selected':'')+'>Trial</option><option value="plus" '+(tier==='plus'?'selected':'')+'>Pro（plus）</option><option value="pro" '+(tier==='pro'?'selected':'')+'>Max（pro）</option></select></label><label>到期时间（ISO / Unix，可空）<input name="paid_until" value="'+esc(row&&row.paid_until||'')+'" placeholder="2027-08-06 或 1817596800"></label><label>教育验证<select name="edu_verified"><option value="0" '+(!Number(row&&row.edu_verified)?'selected':'')+'>否</option><option value="1" '+(Number(row&&row.edu_verified)?'selected':'')+'>是</option></select></label><label>产品 ID<input name="product_id" value="'+esc(row&&row.product_id||'')+'" placeholder="Creem product id"></label><div class="form-actions"><button type="button" class="ghost" id="cancel">取消</button><button>保存</button></div></form>');document.getElementById('cancel').onclick=closeModal;document.getElementById('entForm').onsubmit=async function(e){e.preventDefault();var o=Object.fromEntries(new FormData(e.target));o.edu_verified=o.edu_verified==='1';try{await api('/users/'+o.user_id+'/entitlements',{method:'PATCH',body:JSON.stringify(o)});closeModal();notify('权益已更新');load('entitlements');}catch(err){notify(err.message);}};}
  function renderMemberships(d){var rows=d.memberships||[];set('memberships','<div class="toolbar"><button id="newMem">+ 新会员记录</button></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>用户</th><th>产品</th><th>计划</th><th>状态</th><th>到期</th><th>来源</th><th>操作</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>#'+r.user_id+'<br><small>'+esc(r.email||r.login||'')+'</small></td><td>'+esc(r.product)+'</td><td>'+esc(r.plan)+'</td><td>'+badge(r.status)+'</td><td>'+fmtTime(r.paid_until)+'</td><td>'+esc(r.source||'')+'</td><td><button class="small danger mem-disable" data-id="'+r.user_id+'" data-product="'+esc(r.product)+'">停用</button></td></tr>';}).join('')+'</tbody></table></div></div>');document.getElementById('newMem').onclick=function(){membershipForm(null);};document.querySelectorAll('.mem-disable').forEach(function(b){b.onclick=async function(){if(!confirm('停用会员记录？'))return;try{await api('/memberships/'+b.dataset.id+'/'+encodeURIComponent(b.dataset.product),{method:'DELETE'});notify('已停用');load('memberships');}catch(e){notify(e.message);}};});}
  function membershipForm(){showModal('新会员记录','<form id="memForm" class="form"><label>用户 ID<input name="user_id" required></label><label>项目 product<input name="product" placeholder="grant / todo / path" required></label><label>计划<input name="plan" value="pro"></label><label>状态<select name="status"><option>active</option><option>inactive</option></select></label><label>到期时间<input name="paid_until" placeholder="2027-08-06"></label><label>外部用户标识<input name="external_user_key"></label><div class="form-actions"><button type="button" class="ghost" id="cancel">取消</button><button>保存</button></div></form>');document.getElementById('cancel').onclick=closeModal;document.getElementById('memForm').onsubmit=async function(e){e.preventDefault();var o=Object.fromEntries(new FormData(e.target));try{await api('/memberships',{method:'POST',body:JSON.stringify(o)});closeModal();notify('已保存');load('memberships');}catch(err){notify(err.message);}};}
  function renderGiftCodes(d){var rows=d.gift_codes||[];set('gift-codes','<div class="toolbar"><button id="newGift">+ 生成礼品码</button></div><div class="card"><div class="notice">完整码只在生成时显示一次；后台只保留末 4 位提示。已兑换码不可作废。</div><div class="table-wrap"><table class="table"><thead><tr><th>提示</th><th>计划</th><th>时长</th><th>状态</th><th>创建者</th><th>创建时间</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>••••'+esc(r.code_hint)+'</td><td>'+esc(r.plan)+'</td><td>'+esc(r.duration_days||'永久')+'</td><td>'+badge(r.status)+'</td><td>'+esc(r.created_by)+'</td><td>'+fmtTime(r.created_at)+'</td></tr>';}).join('')+'</tbody></table></div></div>');document.getElementById('newGift').onclick=function(){giftForm();};}
  function giftForm(){showModal('生成礼品码','<form id="giftForm" class="form"><label>计划<select name="plan"><option value="pro">Pro</option><option value="max">Max</option></select></label><label>时长（天）<input name="duration_days" value="365"></label><label>数量（1-20）<input name="quantity" value="1"></label><div class="form-actions"><button type="button" class="ghost" id="cancel">取消</button><button>生成</button></div></form>');document.getElementById('cancel').onclick=closeModal;document.getElementById('giftForm').onsubmit=async function(e){e.preventDefault();var o=Object.fromEntries(new FormData(e.target));o.duration_days=Number(o.duration_days);o.quantity=Number(o.quantity);try{var d=await api('/gift-codes',{method:'POST',body:JSON.stringify(o)});showModal('请立即保存礼品码','<div class="notice">完整码不会再次显示。</div><div class="json">'+esc((d.codes||[]).join('\n'))+'</div><div class="form-actions"><button id="done">完成</button></div>');document.getElementById('done').onclick=function(){closeModal();load('gift-codes');};}catch(err){notify(err.message);}};}
  function renderApiKeys(d){var rows=d.api_keys||[];set('api-keys','<div class="toolbar"><button id="newKey">+ 创建 API Key</button></div><div class="card"><div class="notice">只显示前缀和末 6 位；创建时返回完整 secret 一次。撤销后不可恢复。</div><div class="table-wrap"><table class="table"><thead><tr><th>用户</th><th>名称</th><th>Key</th><th>调用</th><th>最后使用</th><th>状态</th><th>操作</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>#'+r.user_id+'<br><small>'+esc(r.email||r.login||'')+'</small></td><td>'+esc(r.name)+'</td><td>'+esc(r.key_prefix)+'••••'+esc(r.key_tail)+'</td><td>'+Number(r.call_count||0)+'</td><td>'+fmtTime(r.last_used_at)+'</td><td>'+badge(r.revoked_at?'revoked':'active')+'</td><td><button class="small danger key-revoke" data-id="'+esc(r.id)+'">撤销</button></td></tr>';}).join('')+'</tbody></table></div></div>');document.getElementById('newKey').onclick=function(){keyForm();};document.querySelectorAll('.key-revoke').forEach(function(b){b.onclick=async function(){if(!confirm('撤销 API Key？'))return;try{await api('/api-keys/'+encodeURIComponent(b.dataset.id),{method:'DELETE'});notify('已撤销');load('api-keys');}catch(e){notify(e.message);}};});}
  function keyForm(){showModal('创建 API Key','<form id="keyForm" class="form"><label>用户 ID<input name="user_id" required></label><label>名称<input name="name" value="Admin API"></label><div class="form-actions"><button type="button" class="ghost" id="cancel">取消</button><button>创建</button></div></form>');document.getElementById('cancel').onclick=closeModal;document.getElementById('keyForm').onsubmit=async function(e){e.preventDefault();var o=Object.fromEntries(new FormData(e.target));try{var d=await api('/api-keys',{method:'POST',body:JSON.stringify(o)});showModal('请立即保存 Secret','<div class="notice">完整 secret 只显示一次：'+esc(d.secret||'')+'</div><div class="form-actions"><button id="done">完成</button></div>');document.getElementById('done').onclick=function(){closeModal();load('api-keys');};}catch(err){notify(err.message);}};}
  function renderPayments(d){set('payments','<div class="notice">支付状态来自 Creem webhook / confirm 记录，此页只读。退款、退款原因和订单级操作请在 Creem 完成。</div><div class="card"><h3>会员与订阅</h3>'+projectTable((d.subscriptions||[]).map(function(r){return {project_id:'#'+r.user_id,label:r.email||r.customer_email||'-',host:r.product_id||'',kind:r.tier,status:r.status,updated_at:r.updated_at};}))+'</div><div class="card"><h3>Webhook 事件</h3>'+auditTable(d.webhook_events||[])+'</div>');}
  function renderOverrides(d){var rows=d.overrides||[];set('overrides','<div class="toolbar"><button id="newOverride">+ 新覆盖配置</button></div><div class="card"><div class="notice">这里保存 D1 覆盖配置，不直接改动 Pages 中的大型静态期刊数据；适合隐藏、标记风险、补充字段。发布到前端的合并逻辑可按项目逐步接入。</div><div class="table-wrap"><table class="table"><thead><tr><th>项目</th><th>记录</th><th>状态</th><th>备注</th><th>更新时间</th><th>操作</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+esc(r.project_id)+'</td><td>'+esc(r.record_key)+'</td><td>'+badge(r.status)+'</td><td>'+esc(r.note||'')+'</td><td>'+fmtTime(r.updated_at)+'</td><td><button class="small ghost override-edit" data-project="'+esc(r.project_id)+'" data-key="'+esc(r.record_key)+'">编辑</button> <button class="small danger override-del" data-project="'+esc(r.project_id)+'" data-key="'+esc(r.record_key)+'">归档</button></td></tr>';}).join('')+'</tbody></table></div></div>');document.getElementById('newOverride').onclick=function(){overrideForm(null);};document.querySelectorAll('.override-edit').forEach(function(b){b.onclick=function(){overrideForm(rows.find(function(x){return x.project_id===b.dataset.project&&x.record_key===b.dataset.key;}));};});document.querySelectorAll('.override-del').forEach(function(b){b.onclick=async function(){if(!confirm('归档覆盖配置？'))return;try{await api('/overrides/'+encodeURIComponent(b.dataset.project)+'/'+encodeURIComponent(b.dataset.key),{method:'DELETE'});notify('已归档');load('overrides');}catch(e){notify(e.message);}};});}
  function overrideForm(r){showModal(r?'编辑覆盖配置':'新覆盖配置','<form id="overrideForm" class="form"><label>项目 ID<input name="project_id" value="'+esc(r&&r.project_id||'journal')+'" required '+(r?'readonly':'')+'></label><label>记录 Key<input name="record_key" value="'+esc(r&&r.record_key||'')+'" required '+(r?'readonly':'')+'></label><label>状态<select name="status"><option>active</option><option>hidden</option><option>archived</option></select></label><label>Payload JSON<textarea name="payload">'+esc(JSON.stringify(r&&r.payload||{},null,2))+'</textarea></label><label>备注<textarea name="note">'+esc(r&&r.note||'')+'</textarea></label><div class="form-actions"><button type="button" class="ghost" id="cancel">取消</button><button>保存</button></div></form>');document.getElementById('cancel').onclick=closeModal;document.getElementById('overrideForm').onsubmit=async function(e){e.preventDefault();var o=Object.fromEntries(new FormData(e.target));try{o.payload=JSON.parse(o.payload||'{}');await api('/overrides',{method:'POST',body:JSON.stringify(o)});closeModal();notify('已保存');load('overrides');}catch(err){notify('JSON 或保存失败：'+err.message);}};}
  function auditTable(rows){if(!rows.length)return '<div class="empty">暂无记录</div>';return '<div class="table-wrap"><table class="table"><thead><tr><th>时间</th><th>动作</th><th>资源</th><th>操作者</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+fmtTime(r.created_at||r.processed_at)+'</td><td>'+esc(r.action||r.event_type||'-')+'</td><td>'+esc((r.resource_type||'')+' '+(r.resource_id||r.event_id||''))+'</td><td>'+esc(r.actor_email||'')+'</td></tr>';}).join('')+'</tbody></table></div>';}
  function renderAudit(d){set('audit','<div class="card"><h3>审计日志</h3>'+auditTable(d.audit||[])+'</div>');}
  if(token){shell();go('overview');}
})();
</script>
</body></html>`;

export function renderAdmin() {
  return new Response(ADMIN_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
