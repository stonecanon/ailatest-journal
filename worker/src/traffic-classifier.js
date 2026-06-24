const SEARCH_ENGINE_BOTS = [
  'googlebot', 'bingbot', 'baiduspider', 'yandexbot', 'duckduckbot', 'sogou', 'applebot',
];

const AI_AGENT_BOTS = [
  'gptbot', 'claudebot', 'ccbot', 'bytespider', 'perplexitybot', 'anthropic-ai',
  'google-extended', 'facebookbot', 'meta-externalagent',
];

const SCRAPER_BOTS = [
  'headlesschrome', 'playwright', 'puppeteer', 'curl', 'wget', 'python-requests',
  'go-http-client', 'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'nutch',
  'phantom', 'scrapy', 'crawler', 'spider',
];

export const TRAFFIC_TYPES = ['human', 'search_engine_bot', 'ai_agent', 'scraper', 'suspected_bot', 'unknown'];

function cleanReason(reason) {
  return String(reason || '').replace(/[^a-z0-9_,:-]/gi, '').slice(0, 240);
}

export function classifyUserAgent(ua) {
  const raw = String(ua || '').trim();
  if (!raw) return { traffic_type: 'scraper', is_bot: 1, bot_reason: 'empty_ua' };
  const lower = raw.toLowerCase();
  if (SEARCH_ENGINE_BOTS.some(p => lower.includes(p))) {
    return { traffic_type: 'search_engine_bot', is_bot: 1, bot_reason: 'ua:search_engine' };
  }
  if (AI_AGENT_BOTS.some(p => lower.includes(p))) {
    return { traffic_type: 'ai_agent', is_bot: 1, bot_reason: 'ua:ai_agent' };
  }
  if (SCRAPER_BOTS.some(p => lower.includes(p))) {
    return { traffic_type: 'scraper', is_bot: 1, bot_reason: 'ua:scraper' };
  }
  if (/\b(bot|crawl|crawler|spider|slurp)\b/i.test(raw)) {
    return { traffic_type: 'scraper', is_bot: 1, bot_reason: 'ua:generic_bot' };
  }
  return { traffic_type: 'human', is_bot: 0, bot_reason: '' };
}

export function normalizeTrafficType(value) {
  const v = String(value || '').trim();
  return TRAFFIC_TYPES.includes(v) ? v : 'unknown';
}

export function appendReason(existing, reason) {
  const parts = new Set(String(existing || '').split(',').map(s => s.trim()).filter(Boolean));
  if (reason) parts.add(cleanReason(reason));
  return [...parts].join(',').slice(0, 240);
}

async function all(env, sql, binds = []) {
  const res = await env.DB.prepare(sql).bind(...binds).all();
  return res.results || [];
}

async function run(env, sql, binds = []) {
  return env.DB.prepare(sql).bind(...binds).run();
}

async function recordRule(env, ruleCode, trafficType, tableName, idColumn, ids, detail = '') {
  if (!ids?.length) return;
  const now = Math.floor(Date.now() / 1000);
  const statements = ids.slice(0, 500).map(id => env.DB.prepare(`
    INSERT OR IGNORE INTO traffic_classification_events
      (event_ref, event_table, visitor_hash, traffic_type, rule_code, rule_detail, classified_at)
    VALUES (?, ?, '', ?, ?, ?, ?)
  `).bind(String(id), tableName, trafficType, ruleCode, detail, now));
  if (statements.length) await env.DB.batch(statements).catch(() => null);
}

async function updateIds(env, tableName, idColumn, ids, trafficType, reason) {
  if (!ids?.length) return 0;
  let changed = 0;
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const placeholders = chunk.map(() => '?').join(',');
    const res = await run(env, `
      UPDATE ${tableName}
         SET traffic_type = ?,
             is_bot = CASE WHEN ? = 'human' THEN 0 ELSE 1 END,
             bot_reason = CASE
               WHEN COALESCE(bot_reason,'') = '' THEN ?
               WHEN instr(bot_reason, ?) > 0 THEN bot_reason
               ELSE substr(bot_reason || ',' || ?, 1, 240)
             END
       WHERE ${idColumn} IN (${placeholders})
    `, [trafficType, trafficType, reason, reason, reason, ...chunk]).catch(() => null);
    changed += Number(res?.meta?.changes || 0);
  }
  await recordRule(env, reason, trafficType, tableName, idColumn, ids, `${tableName}.${idColumn}`);
  return changed;
}

export async function classifyRequestTraffic(env, req, {
  ua = '',
  ipHash = '',
  visitorHash = '',
  referrer = '',
  viewSource = '',
  country = '',
} = {}) {
  const base = classifyUserAgent(ua);
  const reasons = [];
  if (base.bot_reason) reasons.push(base.bot_reason);
  let trafficType = base.traffic_type;

  const now = Math.floor(Date.now() / 1000);
  if (trafficType === 'human' && ipHash) {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM raw_events WHERE ip_hash = ? AND received_at >= ?`
    ).bind(ipHash, now - 60).first().catch(() => null);
    if (Number(row?.c || 0) >= 30) {
      trafficType = 'scraper';
      reasons.push('ip_minute_gt_30');
    }
  }

  if (trafficType === 'human' && visitorHash && viewSource === 'direct_link' && !referrer) {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM journal_view_events
        WHERE visitor_hash = ? AND COALESCE(view_source,'') = 'direct_link'
          AND COALESCE(referrer,'') = '' AND viewed_at >= ?`
    ).bind(visitorHash, now - 86400).first().catch(() => null);
    if (Number(row?.c || 0) >= 20) {
      trafficType = 'suspected_bot';
      reasons.push('direct_empty_referrer_gt_20');
    }
  }

  if (trafficType === 'human' && country === 'US' && /chrome\/\d+/i.test(String(ua || ''))) {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM raw_events
        WHERE visitor_hash = ? AND country = 'US' AND lower(user_agent) LIKE '%chrome/%'
          AND received_at >= ?`
    ).bind(visitorHash || '', now - 86400).first().catch(() => null);
    if (Number(row?.c || 0) >= 120) {
      trafficType = 'suspected_bot';
      reasons.push('chrome_us_high_frequency');
    }
  }

  return {
    traffic_type: trafficType,
    is_bot: trafficType === 'human' ? 0 : 1,
    bot_reason: appendReason('', reasons.join(',')),
  };
}

export async function applyTrafficClassification(env, {
  days = 90,
  nowSec = Math.floor(Date.now() / 1000),
} = {}) {
  const start = nowSec - Math.max(1, Math.min(120, Number(days || 90))) * 86400;
  const summary = { ok: true, start, raw_updates: 0, journal_updates: 0, interaction_updates: 0, rules: [] };

  const tables = await all(env, `SELECT name FROM sqlite_master WHERE type='table'`);
  const has = name => tables.some(r => r.name === name);
  if (!has('raw_events')) return summary;

  for (const table of ['raw_events', 'journal_view_events', 'interaction_events']) {
    if (!has(table)) continue;
    await run(env, `
      UPDATE ${table}
         SET traffic_type = CASE WHEN COALESCE(traffic_type,'') = '' THEN CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END ELSE traffic_type END,
             visitor_hash = CASE WHEN COALESCE(visitor_hash,'') = '' THEN 'vh_' || substr(COALESCE(ip_hash,''),1,18) || '_' || substr(COALESCE(visitor_id,''),1,18) ELSE visitor_hash END
       WHERE ${table === 'journal_view_events' ? 'viewed_at' : 'event_ts'} >= ?
    `, [start]).catch(() => null);
  }

  const uaRules = [
    ['search_engine_bot', 'ua:search_engine', SEARCH_ENGINE_BOTS],
    ['ai_agent', 'ua:ai_agent', AI_AGENT_BOTS],
    ['scraper', 'ua:scraper', SCRAPER_BOTS],
  ];
  for (const [trafficType, reason, patterns] of uaRules) {
    for (const table of ['raw_events', 'journal_view_events', 'interaction_events']) {
      if (!has(table)) continue;
      const tsCol = table === 'journal_view_events' ? 'viewed_at' : 'event_ts';
      const likeSql = patterns.map(() => 'lower(user_agent) LIKE ?').join(' OR ');
      const binds = [trafficType, trafficType, reason, reason, reason, start, ...patterns.map(p => `%${p.toLowerCase()}%`)];
      const res = await run(env, `
        UPDATE ${table}
           SET traffic_type = ?,
               is_bot = CASE WHEN ? = 'human' THEN 0 ELSE 1 END,
               bot_reason = CASE
                 WHEN COALESCE(bot_reason,'') = '' THEN ?
                 WHEN instr(bot_reason, ?) > 0 THEN bot_reason
                 ELSE substr(bot_reason || ',' || ?, 1, 240)
               END
         WHERE ${tsCol} >= ? AND (${likeSql})
      `, binds).catch(() => null);
      const refCol = table === 'journal_view_events' ? 'id' : 'event_id';
      await run(env, `
        INSERT OR IGNORE INTO traffic_classification_events
          (event_ref, event_table, visitor_hash, traffic_type, rule_code, rule_detail, classified_at)
        SELECT CAST(${refCol} AS TEXT), ?, COALESCE(visitor_hash,''), ?, ?, 'ua pattern', ?
          FROM ${table}
         WHERE ${tsCol} >= ? AND (${likeSql})
      `, [table, trafficType, reason, Math.floor(Date.now() / 1000), start, ...patterns.map(p => `%${p.toLowerCase()}%`)]).catch(() => null);
      const key = table === 'raw_events' ? 'raw_updates' : table === 'journal_view_events' ? 'journal_updates' : 'interaction_updates';
      summary[key] += Number(res?.meta?.changes || 0);
    }
    summary.rules.push(reason);
  }

  if (has('journal_view_events')) {
    const legacyRows = await all(env, `
      SELECT id FROM journal_view_events
      WHERE viewed_at >= ?
        AND (
          COALESCE(view_source,'') = 'historical_unlabeled'
          OR COALESCE(visitor_id,'') = 's_legacy'
          OR COALESCE(session_id,'') = 's_legacy'
        )
    `, [start]);
    summary.journal_updates += await updateIds(
      env,
      'journal_view_events',
      'id',
      legacyRows.map(r => r.id),
      'unknown',
      'historical_legacy_not_realtime',
    );

    const minuteRows = await all(env, `
      SELECT visitor_hash, CAST(viewed_at / 60 AS INTEGER) AS minute_bucket
      FROM journal_view_events
      WHERE viewed_at >= ? AND COALESCE(visitor_hash,'') <> ''
      GROUP BY visitor_hash, minute_bucket
      HAVING COUNT(DISTINCT journal_key) > 10
    `, [start]);
    for (const row of minuteRows.slice(0, 1000)) {
      const ids = await all(env, `
        SELECT id FROM journal_view_events
        WHERE visitor_hash = ? AND CAST(viewed_at / 60 AS INTEGER) = ?
      `, [row.visitor_hash, row.minute_bucket]);
      summary.journal_updates += await updateIds(env, 'journal_view_events', 'id', ids.map(r => r.id), 'scraper', 'visitor_minute_journals_gt_10');
    }

    const dayRows = await all(env, `
      SELECT visitor_hash, date(viewed_at, 'unixepoch') AS day
      FROM journal_view_events
      WHERE viewed_at >= ? AND COALESCE(visitor_hash,'') <> ''
      GROUP BY visitor_hash, day
      HAVING COUNT(DISTINCT journal_key) > 300
    `, [start]);
    for (const row of dayRows.slice(0, 1000)) {
      const ids = await all(env, `
        SELECT id FROM journal_view_events
        WHERE visitor_hash = ? AND date(viewed_at, 'unixepoch') = ?
      `, [row.visitor_hash, row.day]);
      summary.journal_updates += await updateIds(env, 'journal_view_events', 'id', ids.map(r => r.id), 'scraper', 'visitor_day_journals_gt_300');
    }

    const directRows = await all(env, `
      SELECT visitor_hash
      FROM journal_view_events
      WHERE viewed_at >= ? AND COALESCE(visitor_hash,'') <> ''
        AND COALESCE(view_source,'') = 'direct_link' AND COALESCE(referrer,'') = ''
      GROUP BY visitor_hash HAVING COUNT(*) > 20
    `, [start]);
    for (const row of directRows.slice(0, 1000)) {
      const ids = await all(env, `
        SELECT id FROM journal_view_events
        WHERE visitor_hash = ? AND viewed_at >= ?
          AND COALESCE(view_source,'') = 'direct_link' AND COALESCE(referrer,'') = ''
      `, [row.visitor_hash, start]);
      summary.journal_updates += await updateIds(env, 'journal_view_events', 'id', ids.map(r => r.id), 'suspected_bot', 'direct_empty_referrer_gt_20');
    }
  }

  const ipRows = await all(env, `
    SELECT ip_hash, CAST(event_ts / 60 AS INTEGER) AS minute_bucket
    FROM raw_events
    WHERE event_ts >= ? AND COALESCE(ip_hash,'') <> ''
    GROUP BY ip_hash, minute_bucket
    HAVING COUNT(*) > 30
  `, [start]);
  for (const row of ipRows.slice(0, 1000)) {
    const ids = await all(env, `
      SELECT event_id FROM raw_events
      WHERE ip_hash = ? AND CAST(event_ts / 60 AS INTEGER) = ?
    `, [row.ip_hash, row.minute_bucket]);
    summary.raw_updates += await updateIds(env, 'raw_events', 'event_id', ids.map(r => r.event_id), 'scraper', 'ip_minute_gt_30');
  }

  const visitorChangeRows = await all(env, `
    SELECT visitor_hash
    FROM raw_events
    WHERE event_ts >= ? AND COALESCE(visitor_hash,'') <> ''
    GROUP BY visitor_hash
    HAVING COUNT(DISTINCT visitor_id) > 5 AND COUNT(*) > 20
  `, [start]);
  for (const row of visitorChangeRows.slice(0, 1000)) {
    const ids = await all(env, `
      SELECT event_id FROM raw_events WHERE visitor_hash = ? AND event_ts >= ?
    `, [row.visitor_hash, start]);
    summary.raw_updates += await updateIds(env, 'raw_events', 'event_id', ids.map(r => r.event_id), 'suspected_bot', 'visitor_id_churn_same_hash');
  }

  const visitorDayHighRows = await all(env, `
    SELECT visitor_hash, date(event_ts, 'unixepoch') AS day
    FROM raw_events
    WHERE event_ts >= ? AND site = 'journal.ailatest.org' AND COALESCE(visitor_hash,'') <> ''
    GROUP BY visitor_hash, day
    HAVING COUNT(*) > 80 OR (COUNT(*) > 50 AND COUNT(DISTINCT path) > 12)
  `, [start]);
  for (const row of visitorDayHighRows.slice(0, 1000)) {
    const ids = await all(env, `
      SELECT event_id FROM raw_events
      WHERE visitor_hash = ? AND date(event_ts, 'unixepoch') = ?
    `, [row.visitor_hash, row.day]);
    summary.raw_updates += await updateIds(env, 'raw_events', 'event_id', ids.map(r => r.event_id), 'suspected_bot', 'visitor_day_high_frequency');
  }

  const legacyHighRows = await all(env, `
    SELECT visitor_hash
    FROM raw_events
    WHERE event_ts >= ? AND site = 'journal.ailatest.org' AND COALESCE(visitor_hash,'') <> ''
      AND (COALESCE(user_agent,'') = '' OR COALESCE(ip_hash,'') = '')
    GROUP BY visitor_hash
    HAVING COUNT(*) > 80
  `, [start]);
  for (const row of legacyHighRows.slice(0, 1000)) {
    const ids = await all(env, `
      SELECT event_id FROM raw_events
      WHERE visitor_hash = ? AND event_ts >= ?
        AND (COALESCE(user_agent,'') = '' OR COALESCE(ip_hash,'') = '')
    `, [row.visitor_hash, start]);
    summary.raw_updates += await updateIds(env, 'raw_events', 'event_id', ids.map(r => r.event_id), 'suspected_bot', 'legacy_missing_ua_high_frequency');
  }

  const internalLikeRows = await all(env, `
    SELECT visitor_hash
    FROM raw_events
    WHERE event_ts >= ? AND site = 'journal.ailatest.org' AND COALESCE(visitor_hash,'') <> ''
      AND (client_timezone = 'Asia/Shanghai' OR client_language LIKE 'zh%')
      AND country IN ('JP','HK')
    GROUP BY visitor_hash
    HAVING COUNT(*) > 50 AND COUNT(DISTINCT path) > 8
  `, [start]);
  for (const row of internalLikeRows.slice(0, 1000)) {
    const ids = await all(env, `
      SELECT event_id FROM raw_events
      WHERE visitor_hash = ? AND event_ts >= ?
        AND (client_timezone = 'Asia/Shanghai' OR client_language LIKE 'zh%')
        AND country IN ('JP','HK')
    `, [row.visitor_hash, start]);
    summary.raw_updates += await updateIds(env, 'raw_events', 'event_id', ids.map(r => r.event_id), 'suspected_bot', 'internal_like_jp_hk_high_frequency');
  }

  const chromeRows = await all(env, `
    SELECT visitor_hash
    FROM raw_events
    WHERE event_ts >= ? AND country = 'US' AND lower(user_agent) LIKE '%chrome/%'
      AND COALESCE(visitor_hash,'') <> ''
    GROUP BY visitor_hash
    HAVING COUNT(*) > 120
  `, [start]);
  for (const row of chromeRows.slice(0, 1000)) {
    const ids = await all(env, `
      SELECT event_id FROM raw_events
      WHERE visitor_hash = ? AND event_ts >= ? AND country = 'US' AND lower(user_agent) LIKE '%chrome/%'
    `, [row.visitor_hash, start]);
    summary.raw_updates += await updateIds(env, 'raw_events', 'event_id', ids.map(r => r.event_id), 'suspected_bot', 'chrome_us_high_frequency');
  }

  return summary;
}
