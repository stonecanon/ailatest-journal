/*
 * D1 write safety guard.
 * The KV binding is optional so an emergency env switch still works before
 * the KV namespace is attached to the Worker.
 */
const DEFAULT_LIMITS = {
  'analytics.pageview': 5000,
  'analytics.interaction': 10000,
  'journal.view': 5000,
  'analytics.rollup': 100,
};

function truthy(value) {
  return ['1', 'true', 'yes', 'on', 'paused'].includes(String(value || '').toLowerCase());
}

async function config(env) {
  const fallback = {
    paused: truthy(env.D1_WRITES_PAUSED),
    mode: String(env.D1_WRITE_MODE || 'non-core').toLowerCase(),
    globalDaily: Number(env.D1_GLOBAL_DAILY_LIMIT || 50000),
    projectDaily: Number(env.D1_PROJECT_DAILY_LIMIT || 30000),
    featureHourly: { ...DEFAULT_LIMITS },
  };
  const kv = env.WRITE_GUARD_KV || env.AILATEST_WRITE_GUARD;
  if (!kv) return fallback;
  const remote = await kv.get('config', 'json').catch(() => null);
  if (!remote || typeof remote !== 'object') return fallback;
  return {
    ...fallback,
    ...remote,
    featureHourly: { ...fallback.featureHourly, ...(remote.featureHourly || {}) },
  };
}

function bucket(prefix, feature, now = Date.now()) {
  const d = new Date(now);
  const day = d.toISOString().slice(0, 10);
  const hour = d.toISOString().slice(0, 13);
  return { day, hour, featureKey: `${prefix}:feature:${feature}:${hour}`, projectKey: `${prefix}:project:${day}`, globalKey: `${prefix}:global:${day}` };
}

async function increment(kv, key, units, ttl) {
  if (!kv) return 0;
  const current = Number(await kv.get(key).catch(() => '0')) || 0;
  const next = current + Math.max(1, Number(units) || 1);
  await kv.put(key, String(next), { expirationTtl: ttl }).catch(() => {});
  return next;
}

export async function guardWrite(env, feature, units = 1, { core = false } = {}) {
  const c = await config(env);
  if (c.paused || (c.mode === 'all' && core)) return { allowed: false, reason: 'd1_writes_paused', config: c };
  const kv = env.WRITE_GUARD_KV || env.AILATEST_WRITE_GUARD;
  if (!kv) return { allowed: true, config: c };
  const autoTrip = await kv.get('paused:auto').catch(() => null);
  if (autoTrip) return { allowed: false, reason: 'd1_write_quota_exceeded', config: c, autoTrip };

  const b = bucket('ailatest', feature);
  const featureLimit = Number(c.featureHourly?.[feature] || 0);
  const featureCount = await increment(kv, b.featureKey, units, 2 * 3600);
  const projectCount = await increment(kv, b.projectKey, units, 2 * 86400);
  const globalCount = await increment(kv, b.globalKey, units, 2 * 86400);
  const exceeded = (featureLimit > 0 && featureCount > featureLimit)
    || (Number(c.projectDaily) > 0 && projectCount > Number(c.projectDaily))
    || (Number(c.globalDaily) > 0 && globalCount > Number(c.globalDaily));
  if (exceeded) {
    await kv.put('paused:auto', JSON.stringify({ feature, at: Date.now(), featureCount, projectCount, globalCount }), { expirationTtl: 86400 }).catch(() => {});
    return { allowed: false, reason: 'd1_write_quota_exceeded', config: c, featureCount, projectCount, globalCount };
  }
  return { allowed: true, config: c, featureCount, projectCount, globalCount };
}

export async function guardResponse(env, feature, units = 1, options = {}) {
  const result = await guardWrite(env, feature, units, options);
  await notifyOwner(env, result, feature);
  if (result.allowed) return null;
  return new Response(JSON.stringify({ ok: false, paused: true, reason: result.reason, message: '数据写入保护已触发，当前仅提供读取功能。' }), {
    status: 503,
    headers: { 'content-type': 'application/json; charset=utf-8', 'retry-after': '3600', 'access-control-allow-origin': '*' },
  });
}

async function notifyOwner(env, result, feature) {
  const kv = env.WRITE_GUARD_KV || env.AILATEST_WRITE_GUARD;
  if (!env.RESEND_API_KEY || !kv) return;
  const c = result.config || {};
  const values = [
    ['feature', Number(result.featureCount || 0), Number(c.featureHourly?.[feature] || 0)],
    ['project', Number(result.projectCount || 0), Number(c.projectDaily || 0)],
    ['global', Number(result.globalCount || 0), Number(c.globalDaily || 0)],
  ];
  const levels = values.map(([scope, count, limit]) => ({ scope, count, limit, level: limit > 0 ? (count >= limit ? 100 : count >= limit * 0.9 ? 90 : count >= limit * 0.7 ? 70 : 0) : 0 })).filter((x) => x.level > 0);
  if (result.reason !== 'd1_write_quota_exceeded' && !levels.length) return;
  const level = levels.sort((a, b) => b.level - a.level)[0] || { scope: 'global', level: 100, count: 0, limit: 0 };
  const day = new Date().toISOString().slice(0, 10);
  const key = `alert:email:${day}:${level.scope}:${level.level}`;
  if (await kv.get(key).catch(() => null)) return;
  await kv.put(key, '1', { expirationTtl: 7200 }).catch(() => {});
  const to = env.D1_GUARD_NOTIFY_EMAIL || 'wengjt@hzcu.edu.cn';
  const isBlocked = result.reason === 'd1_write_quota_exceeded';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'noreply@ailatest.org',
      to: [to],
      subject: `[AILatest] D1 用量${isBlocked ? '已超额并暂停写入' : `达到 ${level.level}% 预警`}`,
      text: `AILatest 账户级 D1 用量提醒。\n范围：${level.scope}\n功能：${feature}\n当前计数：${level.count}\n预设上限：${level.limit}\n时间：${new Date().toISOString()}\n${isBlocked ? '当前已进入只读/限流状态。' : '当前仍可用，请检查管理 API 并及时处理。'}`,
    }),
  }).catch(() => {});
}

export async function writeGuardStatus(env) {
  const c = await config(env);
  const kv = env.WRITE_GUARD_KV || env.AILATEST_WRITE_GUARD;
  const auto = kv ? await kv.get('paused:auto', 'json').catch(() => null) : null;
  return { ok: true, paused: !!c.paused || !!auto, mode: c.mode, globalDaily: c.globalDaily, projectDaily: c.projectDaily, featureHourly: c.featureHourly, autoTrip: auto, kvConfigured: !!kv };
}

export async function updateWriteGuard(env, patch = {}) {
  const kv = env.WRITE_GUARD_KV || env.AILATEST_WRITE_GUARD;
  if (!kv) throw new Error('AILATEST_WRITE_GUARD is not configured');
  const current = await config(env);
  const next = { ...current, ...patch, featureHourly: { ...current.featureHourly, ...(patch.featureHourly || {}) } };
  await kv.put('config', JSON.stringify(next));
  if (patch.paused === false) await kv.delete('paused:auto').catch(() => {});
  return writeGuardStatus(env);
}
