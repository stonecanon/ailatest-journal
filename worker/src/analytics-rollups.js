import { applyTrafficClassification } from './traffic-classifier.js';

function ymdFromSec(sec) {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

function hourFromSec(sec) {
  return new Date(Math.floor(sec / 3600) * 3600 * 1000).toISOString().slice(0, 13) + ':00:00Z';
}

function secFromHour(hour) {
  return Math.floor(new Date(hour).getTime() / 1000);
}
function secFromDay(day) {
  return Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 1000);
}

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function groupTop(rows, key, limit = 20) {
  const bySite = new Map();
  for (const row of rows || []) {
    const site = row.site || 'unknown';
    if (!bySite.has(site)) bySite.set(site, []);
    bySite.get(site).push(row);
  }
  const out = {};
  for (const [site, values] of bySite.entries()) {
    out[site] = values
      .sort((a, b) => num(b.pageviews) - num(a.pageviews))
      .slice(0, limit)
      .map(row => ({
        [key]: row[key] || (key === 'country' ? 'unknown' : '/'),
        pageviews: num(row.pageviews),
        visitors: num(row.visitors),
        sessions: num(row.sessions),
      }));
  }
  return out;
}

async function all(env, sql, binds = []) {
  const res = await env.DB.prepare(sql).bind(...binds).all();
  return res.results || [];
}

async function aggregateWindow(env, { startSec, endSec, bucket, key, calibrated = 0 }) {
  const now = Math.floor(Date.now() / 1000);
  const targetKey = key || (bucket === 'hour' ? hourFromSec(startSec) : ymdFromSec(startSec));

  const [stats, bots, trafficCounts, paths, countries] = await Promise.all([
    all(env, `
      SELECT
        site,
        COUNT(*) AS pageviews,
        COUNT(DISTINCT visitor_id) AS visitors,
        COUNT(DISTINCT session_id) AS sessions,
        COUNT(DISTINCT ip_hash) AS unique_ips,
        SUM(CASE WHEN client_timezone='Asia/Shanghai' OR client_language LIKE 'zh%' THEN 1 ELSE 0 END) AS cn_hint_events,
        COUNT(DISTINCT CASE WHEN client_timezone='Asia/Shanghai' OR client_language LIKE 'zh%' THEN visitor_id END) AS cn_hint_visitors,
        COUNT(DISTINCT CASE WHEN client_timezone='Asia/Shanghai' OR client_language LIKE 'zh%' THEN session_id END) AS cn_hint_sessions
      FROM raw_events
      WHERE event_ts >= ? AND event_ts < ?
        AND COALESCE(traffic_type, CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END) = 'human'
        AND event_type IN ('pageview', 'page_view')
      GROUP BY site
    `, [startSec, endSec]),
    all(env, `
      SELECT site, COUNT(*) AS bot_events
      FROM raw_events
      WHERE event_ts >= ? AND event_ts < ?
        AND event_type IN ('pageview', 'page_view')
        AND COALESCE(traffic_type, CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END) <> 'human'
      GROUP BY site
    `, [startSec, endSec]),
    all(env, `
      SELECT site,
        COALESCE(traffic_type, CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END) AS traffic_type,
        COUNT(*) AS pageviews
      FROM raw_events
      WHERE event_ts >= ? AND event_ts < ?
        AND event_type IN ('pageview', 'page_view')
      GROUP BY site, COALESCE(traffic_type, CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END)
    `, [startSec, endSec]),
    all(env, `
      SELECT site, COALESCE(path, '/') AS path, COUNT(*) AS pageviews,
        COUNT(DISTINCT visitor_id) AS visitors, COUNT(DISTINCT session_id) AS sessions
      FROM raw_events
      WHERE event_ts >= ? AND event_ts < ?
        AND COALESCE(traffic_type, CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END) = 'human'
        AND event_type IN ('pageview', 'page_view')
      GROUP BY site, COALESCE(path, '/')
      ORDER BY site ASC, pageviews DESC
    `, [startSec, endSec]),
    all(env, `
      SELECT site, COALESCE(country, 'unknown') AS country, COUNT(*) AS pageviews,
        COUNT(DISTINCT visitor_id) AS visitors, COUNT(DISTINCT session_id) AS sessions
      FROM raw_events
      WHERE event_ts >= ? AND event_ts < ?
        AND COALESCE(traffic_type, CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END) = 'human'
        AND event_type IN ('pageview', 'page_view')
      GROUP BY site, COALESCE(country, 'unknown')
      ORDER BY site ASC, pageviews DESC
    `, [startSec, endSec]),
  ]);

  const topPaths = groupTop(paths, 'path', 20);
  const topCountries = groupTop(countries, 'country', 20);
  const botBySite = new Map((bots || []).map(row => [row.site || 'unknown', num(row.bot_events)]));
  const trafficBySite = new Map();
  for (const row of trafficCounts || []) {
    const site = row.site || 'unknown';
    if (!trafficBySite.has(site)) {
      trafficBySite.set(site, {
        human_pv: 0, search_engine_pv: 0, ai_agent_pv: 0, scraper_pv: 0,
        suspected_bot_pv: 0, unknown_pv: 0, all_pv: 0,
      });
    }
    const item = trafficBySite.get(site);
    const count = num(row.pageviews);
    const type = row.traffic_type || 'unknown';
    if (type === 'human') item.human_pv += count;
    else if (type === 'search_engine_bot') item.search_engine_pv += count;
    else if (type === 'ai_agent') item.ai_agent_pv += count;
    else if (type === 'scraper') item.scraper_pv += count;
    else if (type === 'suspected_bot') item.suspected_bot_pv += count;
    else item.unknown_pv += count;
    item.all_pv += count;
  }
  const sites = new Set([
    ...stats.map(row => row.site || 'unknown'),
    ...bots.map(row => row.site || 'unknown'),
    ...trafficCounts.map(row => row.site || 'unknown'),
  ]);

  const statements = [];
  for (const site of sites) {
    const row = stats.find(item => (item.site || 'unknown') === site) || {};
    const traffic = trafficBySite.get(site) || {
      human_pv: num(row.pageviews), search_engine_pv: 0, ai_agent_pv: 0, scraper_pv: 0,
      suspected_bot_pv: 0, unknown_pv: 0, all_pv: num(row.pageviews) + (botBySite.get(site) || 0),
    };
    if (bucket === 'hour') {
      statements.push(env.DB.prepare(`
        INSERT INTO hourly_stats (
          site, hour_start_utc, pageviews, visitors, sessions, cn_hint_events,
          cn_hint_visitors, cn_hint_sessions, bot_events, unique_ips,
          human_pv, search_engine_pv, ai_agent_pv, scraper_pv, suspected_bot_pv, unknown_pv, all_pv,
          top_paths_json, countries_json, aggregated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(site, hour_start_utc) DO UPDATE SET
          pageviews=excluded.pageviews, visitors=excluded.visitors, sessions=excluded.sessions,
          cn_hint_events=excluded.cn_hint_events, cn_hint_visitors=excluded.cn_hint_visitors,
          cn_hint_sessions=excluded.cn_hint_sessions, bot_events=excluded.bot_events,
          unique_ips=excluded.unique_ips, human_pv=excluded.human_pv,
          search_engine_pv=excluded.search_engine_pv, ai_agent_pv=excluded.ai_agent_pv,
          scraper_pv=excluded.scraper_pv, suspected_bot_pv=excluded.suspected_bot_pv,
          unknown_pv=excluded.unknown_pv, all_pv=excluded.all_pv,
          top_paths_json=excluded.top_paths_json,
          countries_json=excluded.countries_json, aggregated_at=excluded.aggregated_at
      `).bind(
        site, targetKey, num(row.pageviews), num(row.visitors), num(row.sessions),
        num(row.cn_hint_events), num(row.cn_hint_visitors), num(row.cn_hint_sessions),
        botBySite.get(site) || 0, num(row.unique_ips),
        num(traffic.human_pv), num(traffic.search_engine_pv), num(traffic.ai_agent_pv),
        num(traffic.scraper_pv), num(traffic.suspected_bot_pv), num(traffic.unknown_pv),
        num(traffic.all_pv),
        JSON.stringify(topPaths[site] || []), JSON.stringify(topCountries[site] || []), now,
      ));
    } else {
      statements.push(env.DB.prepare(`
        INSERT INTO daily_stats (
          site, day_utc, pageviews, visitors, sessions, cn_hint_events,
          cn_hint_visitors, cn_hint_sessions, bot_events, unique_ips,
          human_pv, search_engine_pv, ai_agent_pv, scraper_pv, suspected_bot_pv, unknown_pv, all_pv,
          top_paths_json, countries_json, aggregated_at, calibrated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(site, day_utc) DO UPDATE SET
          pageviews=excluded.pageviews, visitors=excluded.visitors, sessions=excluded.sessions,
          cn_hint_events=excluded.cn_hint_events, cn_hint_visitors=excluded.cn_hint_visitors,
          cn_hint_sessions=excluded.cn_hint_sessions, bot_events=excluded.bot_events,
          unique_ips=excluded.unique_ips, human_pv=excluded.human_pv,
          search_engine_pv=excluded.search_engine_pv, ai_agent_pv=excluded.ai_agent_pv,
          scraper_pv=excluded.scraper_pv, suspected_bot_pv=excluded.suspected_bot_pv,
          unknown_pv=excluded.unknown_pv, all_pv=excluded.all_pv,
          top_paths_json=excluded.top_paths_json,
          countries_json=excluded.countries_json, aggregated_at=excluded.aggregated_at,
          calibrated=CASE WHEN excluded.calibrated=1 THEN 1 ELSE daily_stats.calibrated END
      `).bind(
        site, targetKey, num(row.pageviews), num(row.visitors), num(row.sessions),
        num(row.cn_hint_events), num(row.cn_hint_visitors), num(row.cn_hint_sessions),
        botBySite.get(site) || 0, num(row.unique_ips),
        num(traffic.human_pv), num(traffic.search_engine_pv), num(traffic.ai_agent_pv),
        num(traffic.scraper_pv), num(traffic.suspected_bot_pv), num(traffic.unknown_pv),
        num(traffic.all_pv),
        JSON.stringify(topPaths[site] || []), JSON.stringify(topCountries[site] || []), now, calibrated ? 1 : 0,
      ));
    }
  }
  if (statements.length) await env.DB.batch(statements);
  return { bucket, key: targetKey, sites: sites.size };
}

export async function aggregateRecentStats(env, nowSec = Math.floor(Date.now() / 1000)) {
  const classification = await applyTrafficClassification(env, { days: 90, nowSec }).catch(e => ({ ok: false, error: e.message || String(e) }));
  const currentHourStart = Math.floor(nowSec / 3600) * 3600;
  const results = [];
  for (let i = 0; i < 24; i += 1) {
    const start = currentHourStart - i * 3600;
    results.push(await aggregateWindow(env, {
      startSec: start,
      endSec: start + 3600,
      bucket: 'hour',
      key: hourFromSec(start),
    }));
  }
  const todayStart = secFromDay(ymdFromSec(nowSec));
  for (let i = 0; i < 30; i += 1) {
    const start = todayStart - i * 86400;
    results.push(await aggregateWindow(env, {
      startSec: start,
      endSec: start + 86400,
      bucket: 'day',
      key: ymdFromSec(start),
    }));
  }
  return { ok: true, mode: 'recent', classification, results };
}

export async function recalibrateYesterday(env, nowSec = Math.floor(Date.now() / 1000)) {
  const classification = await applyTrafficClassification(env, { days: 90, nowSec }).catch(e => ({ ok: false, error: e.message || String(e) }));
  const todayStart = secFromDay(ymdFromSec(nowSec));
  const yesterdayStart = todayStart - 86400;
  const result = await aggregateWindow(env, {
    startSec: yesterdayStart,
    endSec: todayStart,
    bucket: 'day',
    key: ymdFromSec(yesterdayStart),
    calibrated: 1,
  });
  return { ok: true, mode: 'yesterday-final', classification, result };
}

export function rollupUtcParts(sec) {
  return { day: ymdFromSec(sec), hour: hourFromSec(sec) };
}
