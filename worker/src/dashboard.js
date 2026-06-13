/**
 * Dashboard data aggregation — runs entirely on the edge (Cloudflare Worker).
 *
 * Three sources, each isolated so one failing does not break the others:
 *   1. D1  (first-party)  — page_events / users / favorites / ratings (same SQL as the old
 *                           local scripts/build_dashboard_data.mjs)
 *   2. Cloudflare         — GraphQL Analytics API (httpRequests1dGroups) for the zone
 *   3. Google Analytics 4 — Data API runReport via a service-account JWT
 *
 * The route that calls buildDashboardPayload() is owner-gated in index.js.
 */

// ───────── small helpers ─────────
function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function daysAgoUTC(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return ymd(d);
}
function tomorrowUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return ymd(d);
}
function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}
async function q(env, sql, binds = []) {
  const stmt = env.DB.prepare(sql);
  const r = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
  return r.results || [];
}
function scalar(row, key, fallback = 0) {
  const v = row?.[key];
  return v == null ? fallback : v;
}
function siteDefs() {
  return [
    { id: 'journal', label: 'Journal', host: 'journal.ailatest.org' },
    { id: 'grant', label: 'Grant', host: 'grant.ailatest.org' },
    { id: 'ailatest', label: 'AILatest', host: 'ailatest.org' },
  ];
}
function dayKeyFromNow(daysBack) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}
function parseListJson(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}
function mergeRankedJson(rows, jsonKey, idKey) {
  const map = new Map();
  for (const row of rows || []) {
    for (const item of parseListJson(row[jsonKey])) {
      const key = item[idKey] || (idKey === 'country' ? 'unknown' : '/');
      const prev = map.get(key) || { [idKey]: key, pageviews: 0, visitors: 0, sessions: 0 };
      prev.pageviews += num(item.pageviews);
      prev.visitors += num(item.visitors);
      prev.sessions += num(item.sessions);
      map.set(key, prev);
    }
  }
  return [...map.values()].sort((a, b) => b.pageviews - a.pageviews).slice(0, 20);
}
function firstPartyFromRows(site, rows, days) {
  const sum = key => (rows || []).reduce((total, row) => total + num(row[key]), 0);
  const trafficMix = {
    human: sum('human_pv'),
    search_engine_bot: sum('search_engine_pv'),
    ai_agent: sum('ai_agent_pv'),
    scraper: sum('scraper_pv'),
    suspected_bot: sum('suspected_bot_pv'),
    unknown: sum('unknown_pv'),
    all: sum('all_pv'),
  };
  const totals = {
    pageviews: sum('pageviews'),
    visitors: sum('visitors'),
    sessions: sum('sessions'),
    bot_events: sum('bot_events'),
    all_pv: trafficMix.all,
  };
  return {
    ...site,
    status: rows?.length ? 'ok' : 'empty',
    totals,
    series: days === 1 ? [] : (rows || []).map(row => ({
      day: row.day_utc,
      pageviews: num(row.pageviews),
      visitors: num(row.visitors),
      sessions: num(row.sessions),
    })),
    hourly: days === 1 ? (rows || []).map(row => ({
      hour_start_utc: row.hour_start_utc,
      pageviews: num(row.pageviews),
      visitors: num(row.visitors),
      sessions: num(row.sessions),
    })) : [],
    traffic_mix: trafficMix,
    topPaths: mergeRankedJson(rows, 'top_paths_json', 'path'),
    topCountries: mergeRankedJson(rows, 'countries_json', 'country'),
  };
}
function splitExternalByFirstParty(source, firstParty, kind) {
  const sites = siteDefs();
  if (!source || source.status !== 'ok') {
    const sitesOut = {};
    for (const site of sites) {
      sitesOut[site.id] = {
        ...site,
        source: source?.source || (kind === 'ga' ? 'Google Analytics 4' : 'Cloudflare Analytics'),
        status: source?.status || 'disabled',
        reason: source?.reason || '',
        totals: {},
        series: [],
      };
    }
    return {
      source: source?.source || (kind === 'ga' ? 'Google Analytics 4' : 'Cloudflare Analytics'),
      status: source?.status || 'disabled',
      reason: source?.reason || '',
      sites: sitesOut,
    };
  }

  const firstPartyTotal = sites.reduce((sum, site) => sum + num(firstParty?.[site.id]?.totals?.pageviews), 0);
  const scale = (value, share) => Math.round(num(value) * share);
  const numericKeys = new Set();
  for (const row of source.series || []) {
    for (const [key, value] of Object.entries(row)) {
      if (key !== 'day' && Number.isFinite(Number(value))) numericKeys.add(key);
    }
  }
  for (const [key, value] of Object.entries(source.totals || {})) {
    if (Number.isFinite(Number(value))) numericKeys.add(key);
  }

  const sitesOut = {};
  for (const site of sites) {
    const fp = firstParty?.[site.id] || {};
    const share = firstPartyTotal ? num(fp.totals?.pageviews) / firstPartyTotal : 0;
    const totals = {};
    for (const key of numericKeys) totals[key] = scale(source.totals?.[key], share);
    if (kind === 'cf') {
      totals.resource_requests = totals.resource_requests || totals.requests || 0;
      totals.visitors = totals.visitors || scale(source.totals?.users || source.totals?.visitors, share);
    } else {
      totals.users = totals.users || scale(source.totals?.visitors || source.totals?.users, share);
    }
    const series = (source.series || []).map(row => {
      const out = { day: row.day };
      for (const key of numericKeys) out[key] = scale(row[key], share);
      if (kind === 'cf') {
        out.resource_requests = out.resource_requests || out.requests || 0;
        out.visitors = out.visitors || scale(row.users || row.visitors, share);
      } else {
        out.users = out.users || scale(row.visitors || row.users, share);
      }
      return out;
    });
    const topPages = (source.topPages || source.topPaths || []).map(row => {
      const metric = kind === 'cf' ? 'requests' : 'pageviews';
      return { ...row, [metric]: scale(row[metric], share), users: scale(row.users, share), visitors: scale(row.visitors, share) };
    }).filter(row => num(row.requests || row.pageviews)).slice(0, 15);
    sitesOut[site.id] = {
      ...site,
      source: source.source,
      status: 'ok',
      reason: 'Estimated from first-party site share; source API is zone/property level.',
      filter_note: 'Estimated from first-party site share; use as a reference, not exact host-level split.',
      totals,
      series,
      topPages,
      topPaths: kind === 'cf' ? topPages : [],
      topCountries: source.topCountries || [],
    };
  }
  return {
    ...source,
    sites: sitesOut,
  };
}
function attachExternalSiteMonitoring(siteMonitoring, cloudflare, ga) {
  const firstParty = siteMonitoring?.first_party || {};
  const cf = splitExternalByFirstParty(cloudflare, firstParty, 'cf');
  const google = splitExternalByFirstParty(ga, firstParty, 'ga');
  const sourceComparison = {};
  for (const site of siteDefs()) {
    const fp = firstParty[site.id] || firstPartyFromRows(site, [], siteMonitoring?.days || 30);
    const cfSite = cf.sites?.[site.id] || {};
    const gaSite = google.sites?.[site.id] || {};
    sourceComparison[site.id] = {
      first_party: {
        pageviews: fp.totals?.pageviews || 0,
        visitors: fp.totals?.visitors || 0,
        sessions: fp.totals?.sessions || 0,
      },
      cloudflare: {
        status: cfSite.status || cf.status || 'disabled',
        reason: cfSite.reason || cf.reason || '',
        requests: cfSite.totals?.requests || 0,
        pageviews: cfSite.totals?.pageviews || cfSite.totals?.requests || 0,
        visitors: cfSite.totals?.visitors || 0,
      },
      google_analytics: {
        status: gaSite.status || google.status || 'disabled',
        reason: gaSite.reason || google.reason || '',
        pageviews: gaSite.totals?.pageviews || 0,
        users: gaSite.totals?.users || 0,
        sessions: gaSite.totals?.sessions || 0,
      },
    };
  }
  return {
    ...siteMonitoring,
    cloudflare: cf,
    google_analytics: google,
    source_comparison: sourceComparison,
  };
}
async function buildSiteMonitoring(env, options = {}) {
  const days = [1, 7, 30].includes(Number(options.days)) ? Number(options.days) : 30;
  const sites = siteDefs();
  const tableRows = await q(env, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tables = new Set(tableRows.map(row => row.name));
  const hasStats = days === 1 ? tables.has('hourly_stats') : tables.has('daily_stats');
  const firstParty = {};
  const sourceComparison = {};
  if (hasStats) {
    const siteHosts = sites.map(site => site.host);
    const placeholders = siteHosts.map(() => '?').join(',');
    const rows = days === 1
      ? await q(
        env,
        `SELECT * FROM hourly_stats
         WHERE site IN (${placeholders}) AND hour_start_utc >= ?
         ORDER BY site ASC, hour_start_utc ASC`,
        [...siteHosts, new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 13) + ':00:00Z']
      )
      : await q(
        env,
        `SELECT * FROM daily_stats
         WHERE site IN (${placeholders}) AND day_utc >= ?
         ORDER BY site ASC, day_utc ASC`,
        [...siteHosts, dayKeyFromNow(days - 1)]
      );
    for (const site of sites) {
      const siteRows = rows.filter(row => row.site === site.host);
      const fp = firstPartyFromRows(site, siteRows, days);
      firstParty[site.id] = fp;
      sourceComparison[site.id] = {
        first_party: {
          pageviews: fp.totals.pageviews,
          visitors: fp.totals.visitors,
          sessions: fp.totals.sessions,
        },
        cloudflare: { status: 'not_split' },
        google_analytics: { status: 'not_split' },
      };
    }
  } else {
    for (const site of sites) {
      const fp = firstPartyFromRows(site, [], days);
      firstParty[site.id] = fp;
      sourceComparison[site.id] = {
        first_party: { pageviews: 0, visitors: 0, sessions: 0 },
        cloudflare: { status: 'not_split' },
        google_analytics: { status: 'not_split' },
      };
    }
  }
  return {
    days,
    sites,
    first_party: firstParty,
    cloudflare: { source: 'Cloudflare Analytics', status: 'pending', sites: {} },
    google_analytics: { source: 'Google Analytics 4', status: 'pending', sites: {} },
    source_comparison: sourceComparison,
  };
}

function normalizeDays(options = {}) {
  const days = Number(options.days);
  return [1, 7, 30].includes(days) ? days : 30;
}
function startSecForDays(days) {
  return Math.floor(Date.now() / 1000) - (days === 1 ? 24 * 3600 : days * 24 * 3600);
}
function maskEmail(email) {
  return email ? String(email).replace(/^(.{2}).*(@.*)$/, '$1***$2') : '';
}
function withUser(row) {
  const out = { ...row };
  out.user = {
    id: out.user_id,
    email: maskEmail(out.email),
    login: out.login,
    name: out.name,
  };
  delete out.email;
  delete out.login;
  delete out.name;
  return out;
}
function sumRows(rows, key) {
  return (rows || []).reduce((total, row) => total + num(row[key]), 0);
}
function humanTrafficExpr() {
  return "COALESCE(traffic_type, CASE WHEN is_bot=1 THEN 'scraper' ELSE 'human' END) = 'human'";
}
async function buildSiteBusiness(env, options = {}) {
  const days = normalizeDays(options);
  const startSec = startSecForDays(days);
  const tableRows = await q(env, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tables = new Set(tableRows.map(row => row.name));
  const has = name => tables.has(name);
  const run = (name, sql, binds = []) => (has(name) ? q(env, sql, binds) : Promise.resolve([]));
  const jvColumns = has('journal_view_events')
    ? new Set((await q(env, "PRAGMA table_info(journal_view_events)")).map(row => row.name))
    : new Set();
  const jvSelect = name => (jvColumns.has(name) ? name : `NULL AS ${name}`);
  const jvAgg = name => (jvColumns.has(name) ? `MAX(${name})` : 'NULL');
  const aiColumns = has('ai_usage_events')
    ? new Set((await q(env, "PRAGMA table_info(ai_usage_events)")).map(row => row.name))
    : new Set();
  const aiSum = name => (aiColumns.has(name) ? `SUM(${name})` : '0');
  const aiAvg = name => (aiColumns.has(name) ? `AVG(${name})` : '0');
  const aiSelect = name => (aiColumns.has(name) ? name : `NULL AS ${name}`);

  const [
    usersSummary, loginSummary, favoriteSummary, ratingSummary, listSummary,
    recentUsers, topFavorites, topRated, topJournalViews, journalViewPeriodSummary,
    recentJournalViews, periodTopJournalViews, jvSourceSummary, jvHourlySeries,
    interactionSummary, interactionByTab, recentInteractions,
    recentFavorites, recentRatings, topLists, pickUsageByDay,
    aiUsageSummary, aiUsageByDay, aiUsageByFeature, aiUsageByModel, recentAiUsage,
    grantSummary, grantTopSearchQueries, grantZeroResultSearches, grantRecentInteractions,
    grantRecentPageviews, grantInteractionByDay,
    ailatestRecentPageviews,
  ] = await Promise.all([
    run('users', `SELECT COUNT(*) AS total_users FROM users`),
    run('login_events', `SELECT COUNT(*) AS total_login_events FROM login_events`),
    run('favorites', `SELECT COUNT(*) AS favorite_rows FROM favorites`),
    run('ratings', `SELECT COUNT(*) AS rating_rows FROM ratings`),
    run('fav_lists', `SELECT COUNT(*) AS lists FROM fav_lists`),
    run('users', `SELECT id, provider, email, login, name, created_at, updated_at
      FROM users ORDER BY created_at DESC LIMIT 20`),
    run('favorites', `SELECT journal_key, COUNT(*) AS favorites
      FROM favorites GROUP BY journal_key ORDER BY favorites DESC, journal_key ASC LIMIT 40`),
    run('ratings', `SELECT journal_key, COUNT(*) AS ratings, ROUND(AVG(rating),2) AS avg_rating
      FROM ratings GROUP BY journal_key ORDER BY ratings DESC, avg_rating DESC, journal_key ASC LIMIT 40`),
    run('journal_views', `SELECT journal_key, count AS views, updated_at
      FROM journal_views ORDER BY count DESC, updated_at DESC, journal_key ASC LIMIT 40`),
    run('journal_view_events', `SELECT COUNT(*) AS total_journal_views, COUNT(DISTINCT journal_key) AS viewed_journals,
        MAX(COALESCE(NULLIF(event_time,0), viewed_at)) AS latest_journal_view_at
      FROM journal_view_events
      WHERE viewed_at >= ? AND ${humanTrafficExpr()}`, [startSec]),
    run('journal_view_events', `SELECT journal_key, ${jvSelect('journal_name')}, ${jvSelect('journal_issn')}, user_id, visitor_id, session_id,
        path, viewed_at, referrer, user_agent, country, ip_hash, device, browser, event_time,
        view_source, query, tab, traffic_type, bot_reason
      FROM journal_view_events
      WHERE viewed_at >= ?
      ORDER BY COALESCE(NULLIF(event_time,0), viewed_at) DESC LIMIT 120`, [startSec]),
    run('journal_view_events', `SELECT journal_key, ${jvAgg('journal_name')} AS journal_name, ${jvAgg('journal_issn')} AS journal_issn,
        COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors,
        MAX(COALESCE(NULLIF(event_time,0), viewed_at)) AS latest_viewed
      FROM journal_view_events
      WHERE viewed_at >= ? AND ${humanTrafficExpr()}
      GROUP BY journal_key ORDER BY views DESC, latest_viewed DESC LIMIT 40`, [startSec]),
    run('journal_view_events', `SELECT COALESCE(view_source,'unknown') AS view_source, COALESCE(tab,'unknown') AS tab,
        COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
      FROM journal_view_events
      WHERE viewed_at >= ? AND ${humanTrafficExpr()}
      GROUP BY COALESCE(view_source,'unknown'), COALESCE(tab,'unknown')
      ORDER BY views DESC LIMIT 40`, [startSec]),
    run('journal_view_events', `SELECT ${days === 1 ? "strftime('%Y-%m-%dT%H:00:00Z', viewed_at, 'unixepoch')" : "date(viewed_at, 'unixepoch')"} AS hour,
        COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
      FROM journal_view_events
      WHERE viewed_at >= ? AND ${humanTrafficExpr()}
      GROUP BY hour ORDER BY hour ASC`, [startSec]),
    run('interaction_events', `SELECT event_type, COUNT(*) AS events, COUNT(DISTINCT visitor_id) AS visitors,
        COUNT(DISTINCT session_id) AS sessions, ROUND(AVG(result_count),1) AS avg_results
      FROM interaction_events
      WHERE site = 'journal.ailatest.org' AND event_ts >= ?
      GROUP BY event_type ORDER BY events DESC`, [startSec]),
    run('interaction_events', `SELECT event_type, COALESCE(tab,'unknown') AS tab, COUNT(*) AS events,
        ROUND(AVG(result_count),1) AS avg_results
      FROM interaction_events
      WHERE site = 'journal.ailatest.org' AND event_ts >= ?
      GROUP BY event_type, COALESCE(tab,'unknown') ORDER BY events DESC LIMIT 40`, [startSec]),
    run('interaction_events', `SELECT event_type, site, path, tab, query, result_count, visitor_id, session_id,
        event_ts, traffic_type, bot_reason
      FROM interaction_events
      WHERE site = 'journal.ailatest.org' AND event_ts >= ?
      ORDER BY event_ts DESC LIMIT 60`, [startSec]),
    run('favorites', `SELECT f.journal_key, f.created_at, u.id AS user_id, u.email, u.login, u.name
      FROM favorites f LEFT JOIN users u ON u.id = f.user_id
      ORDER BY f.created_at DESC LIMIT 40`),
    run('ratings', `SELECT r.journal_key, r.rating, r.created_at, r.updated_at, u.id AS user_id, u.email, u.login, u.name
      FROM ratings r LEFT JOIN users u ON u.id = r.user_id
      ORDER BY COALESCE(r.updated_at, r.created_at) DESC LIMIT 40`),
    run('fav_lists', `SELECT l.name, json_array_length(l.ids_json) AS items, l.created_at, l.updated_at,
        u.id AS user_id, u.email, u.login, u.name
      FROM fav_lists l LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.updated_at DESC LIMIT 40`),
    run('pick_usage', `SELECT period_key AS day, SUM(used) AS used, COUNT(DISTINCT user_id) AS users
      FROM pick_usage WHERE period = 'day'
      GROUP BY period_key ORDER BY period_key ASC`),
    run('ai_usage_events', `SELECT COUNT(*) AS requests, COUNT(DISTINCT user_id) AS users,
        ${aiSum('prompt_tokens')} AS prompt_tokens,
        ${aiSum('completion_tokens')} AS completion_tokens,
        ${aiSum('total_tokens')} AS total_tokens,
        ${aiSum('cache_hit_tokens')} AS cache_hit_tokens,
        ${aiSum('cache_miss_tokens')} AS cache_miss_tokens,
        ${aiSum('input_cny')} AS input_cny,
        ${aiSum('output_cny')} AS output_cny,
        ${aiSum('total_cny')} AS total_cny,
        SUM(CASE WHEN ${aiColumns.has('success') ? 'success' : '1'} = 0 THEN 1 ELSE 0 END) AS failed_requests,
        ${aiAvg('latency_ms')} AS avg_latency_ms
      FROM ai_usage_events
      WHERE created_at >= ? AND COALESCE(app,'journal') = 'journal'`, [startSec]),
    run('ai_usage_events', `SELECT day, COUNT(*) AS requests, COUNT(DISTINCT user_id) AS users,
        ${aiSum('prompt_tokens')} AS prompt_tokens,
        ${aiSum('completion_tokens')} AS completion_tokens,
        ${aiSum('total_tokens')} AS total_tokens,
        ${aiSum('total_cny')} AS total_cny
      FROM ai_usage_events
      WHERE created_at >= ? AND COALESCE(app,'journal') = 'journal'
      GROUP BY day ORDER BY day ASC`, [startSec]),
    run('ai_usage_events', `SELECT COALESCE(feature,'unknown') AS feature, COUNT(*) AS requests, COUNT(DISTINCT user_id) AS users,
        ${aiSum('prompt_tokens')} AS prompt_tokens,
        ${aiSum('completion_tokens')} AS completion_tokens,
        ${aiSum('total_tokens')} AS total_tokens,
        ${aiSum('total_cny')} AS total_cny,
        ${aiAvg('latency_ms')} AS avg_latency_ms
      FROM ai_usage_events
      WHERE created_at >= ? AND COALESCE(app,'journal') = 'journal'
      GROUP BY COALESCE(feature,'unknown') ORDER BY requests DESC`, [startSec]),
    run('ai_usage_events', `SELECT COALESCE(provider,'unknown') AS provider, COALESCE(model,'unknown') AS model,
        COUNT(*) AS requests, COUNT(DISTINCT user_id) AS users,
        ${aiSum('prompt_tokens')} AS prompt_tokens,
        ${aiSum('completion_tokens')} AS completion_tokens,
        ${aiSum('total_tokens')} AS total_tokens,
        ${aiSum('total_cny')} AS total_cny
      FROM ai_usage_events
      WHERE created_at >= ? AND COALESCE(app,'journal') = 'journal'
      GROUP BY COALESCE(provider,'unknown'), COALESCE(model,'unknown')
      ORDER BY requests DESC`, [startSec]),
    run('ai_usage_events', `SELECT a.created_at, ${aiSelect('user_id')}, u.email, u.login, u.name,
        COALESCE(a.feature,'') AS feature, COALESCE(a.provider,'') AS provider, COALESCE(a.model,'') AS model,
        ${aiSelect('range_label')}, ${aiSelect('query_chars')}, ${aiSelect('prompt_tokens')},
        ${aiSelect('completion_tokens')}, ${aiSelect('total_tokens')},
        ${aiSelect('cache_hit_tokens')}, ${aiSelect('cache_miss_tokens')},
        ${aiSelect('total_cny')}, ${aiSelect('latency_ms')},
        ${aiColumns.has('success') ? 'success' : '1 AS success'},
        ${aiColumns.has('error') ? 'error' : "'' AS error"}
      FROM ai_usage_events a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.created_at >= ? AND COALESCE(a.app,'journal') = 'journal'
      ORDER BY a.created_at DESC LIMIT 80`, [startSec]),
    run('interaction_events', `SELECT COUNT(*) AS search_events, COUNT(DISTINCT visitor_id) AS search_visitors,
        COUNT(DISTINCT session_id) AS search_sessions,
        SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END) AS zero_result_searches
      FROM interaction_events
      WHERE site = 'grant.ailatest.org' AND event_ts >= ?`, [startSec]),
    run('interaction_events', `SELECT query, COUNT(*) AS events, COUNT(DISTINCT visitor_id) AS visitors,
        ROUND(AVG(result_count),1) AS avg_results
      FROM interaction_events
      WHERE site = 'grant.ailatest.org' AND event_ts >= ?
      GROUP BY query ORDER BY events DESC LIMIT 40`, [startSec]),
    run('interaction_events', `SELECT query, COUNT(*) AS events
      FROM interaction_events
      WHERE site = 'grant.ailatest.org' AND event_ts >= ? AND result_count = 0
      GROUP BY query ORDER BY events DESC LIMIT 40`, [startSec]),
    run('interaction_events', `SELECT event_type, site, path, tab, query, result_count, visitor_id, session_id,
        event_ts, traffic_type, bot_reason
      FROM interaction_events
      WHERE site = 'grant.ailatest.org' AND event_ts >= ?
      ORDER BY event_ts DESC LIMIT 60`, [startSec]),
    run('raw_events', `SELECT event_ts, received_at, visitor_id, session_id, path, referrer, country,
        client_language, ip_hash, traffic_type, bot_reason
      FROM raw_events
      WHERE site = 'grant.ailatest.org' AND event_ts >= ?
      ORDER BY event_ts DESC LIMIT 120`, [startSec]),
    run('interaction_events', `SELECT date(event_ts,'unixepoch') AS day, COUNT(*) AS events
      FROM interaction_events
      WHERE site = 'grant.ailatest.org' AND event_ts >= ?
      GROUP BY day ORDER BY day ASC`, [startSec]),
    run('raw_events', `SELECT event_ts, received_at, visitor_id, session_id, path, referrer, country,
        client_language, ip_hash, traffic_type, bot_reason
      FROM raw_events
      WHERE site = 'ailatest.org' AND event_ts >= ?
      ORDER BY event_ts DESC LIMIT 120`, [startSec]),
  ]);

  const interactionEvents = rows => sumRows(rows, 'events');
  const journalPickRows = (interactionSummary || []).filter(row => row.event_type === 'journal_pick');
  const journalSearchRows = (interactionSummary || []).filter(row => row.event_type === 'journal_search');

  return {
    journal: {
      status: has('journal_view_events') || has('interaction_events') ? 'ok' : 'empty',
      kpis: {
        total_users: scalar(usersSummary[0], 'total_users'),
        total_login_events: scalar(loginSummary[0], 'total_login_events'),
        total_journal_views: scalar(journalViewPeriodSummary[0], 'total_journal_views'),
        viewed_journals: scalar(journalViewPeriodSummary[0], 'viewed_journals'),
        latest_journal_view_at: scalar(journalViewPeriodSummary[0], 'latest_journal_view_at', null),
        search_events: interactionEvents(journalSearchRows),
        pick_events: interactionEvents(journalPickRows),
        pick_consumed: sumRows(pickUsageByDay, 'used'),
        ai_requests: scalar(aiUsageSummary[0], 'requests'),
        ai_users: scalar(aiUsageSummary[0], 'users'),
        ai_total_tokens: scalar(aiUsageSummary[0], 'total_tokens'),
        ai_prompt_tokens: scalar(aiUsageSummary[0], 'prompt_tokens'),
        ai_completion_tokens: scalar(aiUsageSummary[0], 'completion_tokens'),
        ai_total_cny: scalar(aiUsageSummary[0], 'total_cny'),
        ai_failed_requests: scalar(aiUsageSummary[0], 'failed_requests'),
        ai_avg_latency_ms: scalar(aiUsageSummary[0], 'avg_latency_ms'),
        favorite_rows: scalar(favoriteSummary[0], 'favorite_rows'),
        lists: scalar(listSummary[0], 'lists'),
        rating_rows: scalar(ratingSummary[0], 'rating_rows'),
      },
      tables: {
        recentUsers: recentUsers.map(user => ({ ...user, email: maskEmail(user.email) })),
        topFavorites,
        topRated,
        topJournalViews,
        recentJournalViews,
        periodTopJournalViews,
        jvSourceSummary,
        jvHourlySeries,
        interactionSummary,
        interactionByTab,
        recentInteractions,
        recentFavorites: recentFavorites.map(withUser),
        recentRatings: recentRatings.map(withUser),
        topLists: topLists.map(withUser),
        pickUsageByDay,
        aiUsageSummary: aiUsageSummary[0] || {},
        aiUsageByDay,
        aiUsageByFeature,
        aiUsageByModel,
        recentAiUsage: recentAiUsage.map(withUser),
      },
    },
    grant: {
      status: has('interaction_events') || has('raw_events') ? 'ok' : 'empty',
      kpis: {
        search_events: scalar(grantSummary[0], 'search_events'),
        search_visitors: scalar(grantSummary[0], 'search_visitors'),
        search_sessions: scalar(grantSummary[0], 'search_sessions'),
        zero_result_searches: scalar(grantSummary[0], 'zero_result_searches'),
      },
      tables: {
        topSearchQueries: grantTopSearchQueries,
        zeroResultSearches: grantZeroResultSearches,
        recentInteractions: grantRecentInteractions,
        recentPageviews: grantRecentPageviews,
        interactionByDay: grantInteractionByDay,
      },
    },
    ailatest: {
      status: has('raw_events') ? 'ok' : 'empty',
      tables: {
        recentPageviews: ailatestRecentPageviews,
      },
    },
  };
}

// ───────── 1. D1 (first-party) ─────────
async function buildD1(env) {
  const tableRows = await q(env, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tables = new Set(tableRows.map(r => r.name));
  const has = name => tables.has(name);
  const maybe = (name, sql) => (has(name) ? q(env, sql) : Promise.resolve([]));

  const [
    userTotals, providerMix, registrationsByDay, activeProxyByDay,
    favoritesSummary, topFavorites, ratingsSummary, topRated, listSummary,
    journalViewsSummary, topJournalViews,
    loginEventsByDay, loginProviderMix, latestPageview, pageviewsByDay,
    topPaths, trafficCountries, recentUsers,
  ] = await Promise.all([
    q(env, `SELECT COUNT(*) AS total_users, COUNT(email) AS users_with_email,
        SUM(CASE WHEN provider='email' THEN 1 ELSE 0 END) AS email_users,
        SUM(CASE WHEN provider='github' THEN 1 ELSE 0 END) AS github_users,
        SUM(CASE WHEN provider='google' THEN 1 ELSE 0 END) AS google_users,
        MIN(created_at) AS first_signup_at, MAX(created_at) AS latest_signup_at
      FROM users`),
    q(env, `SELECT COALESCE(provider,'unknown') AS provider, COUNT(*) AS users
      FROM users GROUP BY COALESCE(provider,'unknown') ORDER BY users DESC`),
    q(env, `SELECT date(created_at,'unixepoch') AS day, COUNT(*) AS signups
      FROM users GROUP BY date(created_at,'unixepoch') ORDER BY day`),
    q(env, `SELECT date(updated_at,'unixepoch') AS day, COUNT(DISTINCT id) AS active_users_proxy
      FROM users GROUP BY date(updated_at,'unixepoch') ORDER BY day`),
    q(env, `SELECT COALESCE(SUM(c),0) AS favorite_rows, COUNT(*) AS users_with_favorites,
        ROUND(AVG(c),2) AS avg_favorites_per_active_user, MAX(c) AS max_favorites_by_user
      FROM (SELECT user_id, COUNT(*) AS c FROM favorites GROUP BY user_id)`),
    q(env, `SELECT journal_key, COUNT(*) AS favorites FROM favorites
      GROUP BY journal_key ORDER BY favorites DESC, journal_key ASC LIMIT 20`),
    q(env, `SELECT COUNT(*) AS rating_rows, COUNT(DISTINCT user_id) AS users_with_ratings,
        COUNT(DISTINCT journal_key) AS rated_journals, ROUND(AVG(rating),2) AS avg_rating
      FROM ratings`),
    q(env, `SELECT journal_key, COUNT(*) AS ratings, ROUND(AVG(rating),2) AS avg_rating
      FROM ratings GROUP BY journal_key ORDER BY ratings DESC, avg_rating DESC, journal_key ASC LIMIT 20`),
    q(env, `SELECT COUNT(*) AS lists, COUNT(DISTINCT user_id) AS users_with_lists,
        ROUND(AVG(json_array_length(ids_json)),2) AS avg_items_per_list,
        MAX(json_array_length(ids_json)) AS max_items_in_list
      FROM fav_lists`),
    maybe('journal_views', `SELECT COUNT(*) AS viewed_journals, COALESCE(SUM(count),0) AS total_journal_views,
        MAX(count) AS max_journal_views, MAX(updated_at) AS latest_journal_view_at
      FROM journal_views`),
    maybe('journal_views', `SELECT journal_key, count AS views, updated_at
      FROM journal_views ORDER BY count DESC, updated_at DESC, journal_key ASC LIMIT 30`),
    maybe('login_events', `SELECT day, COUNT(*) AS login_events, COUNT(DISTINCT user_id) AS login_users
      FROM login_events GROUP BY day ORDER BY day`),
    maybe('login_events', `SELECT COALESCE(provider,'unknown') AS provider, COUNT(*) AS login_events,
        COUNT(DISTINCT user_id) AS login_users
      FROM login_events GROUP BY COALESCE(provider,'unknown') ORDER BY login_events DESC`),
    maybe('page_events', `SELECT MAX(event_at) AS latest_pageview_at FROM page_events`),
    maybe('page_events', `SELECT day, COUNT(*) AS pageviews, COUNT(DISTINCT session_id) AS sessions,
        COUNT(DISTINCT visitor_id) AS visitors,
        SUM(CASE WHEN client_timezone='Asia/Shanghai' OR client_language LIKE 'zh%' THEN 1 ELSE 0 END) AS cn_hint_events,
        COUNT(DISTINCT CASE WHEN client_timezone='Asia/Shanghai' OR client_language LIKE 'zh%' THEN visitor_id END) AS cn_hint_visitors,
        COUNT(DISTINCT CASE WHEN client_timezone='Asia/Shanghai' OR client_language LIKE 'zh%' THEN session_id END) AS cn_hint_sessions
      FROM page_events GROUP BY day ORDER BY day`),
    maybe('page_events', `SELECT COALESCE(path,'/') AS path, COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors
      FROM page_events GROUP BY COALESCE(path,'/') ORDER BY pageviews DESC LIMIT 20`),
    maybe('page_events', `SELECT COALESCE(country,'unknown') AS country, COUNT(*) AS pageviews,
        COUNT(DISTINCT visitor_id) AS visitors, COUNT(DISTINCT session_id) AS sessions,
        SUM(CASE WHEN client_timezone='Asia/Shanghai' OR client_language LIKE 'zh%' THEN 1 ELSE 0 END) AS cn_hint_events,
        COUNT(DISTINCT CASE WHEN client_timezone='Asia/Shanghai' OR client_language LIKE 'zh%' THEN visitor_id END) AS cn_hint_visitors,
        COUNT(DISTINCT CASE WHEN client_timezone='Asia/Shanghai' OR client_language LIKE 'zh%' THEN session_id END) AS cn_hint_sessions,
        GROUP_CONCAT(DISTINCT colo) AS colos, GROUP_CONCAT(DISTINCT client_timezone) AS client_timezones,
        GROUP_CONCAT(DISTINCT client_language) AS client_languages
      FROM page_events GROUP BY COALESCE(country,'unknown') ORDER BY pageviews DESC LIMIT 20`),
    q(env, `SELECT id, provider, email, login, name, created_at, updated_at
      FROM users ORDER BY created_at DESC LIMIT 20`),
  ]);

  const totals = userTotals[0] || {};
  const sumBy = (rows, key) => rows.reduce((s, r) => s + num(r[key]), 0);
  const enrich = rows => rows.map(r => ({ ...r, label: r.journal_key }));

  return {
    tables: [...tables],
    kpis: {
      total_users: scalar(totals, 'total_users'),
      users_with_email: scalar(totals, 'users_with_email'),
      email_users: scalar(totals, 'email_users'),
      github_users: scalar(totals, 'github_users'),
      google_users: scalar(totals, 'google_users'),
      first_signup_at: scalar(totals, 'first_signup_at', null),
      latest_signup_at: scalar(totals, 'latest_signup_at', null),
      favorite_rows: scalar(favoritesSummary[0], 'favorite_rows'),
      users_with_favorites: scalar(favoritesSummary[0], 'users_with_favorites'),
      avg_favorites_per_active_user: scalar(favoritesSummary[0], 'avg_favorites_per_active_user', 0),
      rating_rows: scalar(ratingsSummary[0], 'rating_rows'),
      users_with_ratings: scalar(ratingsSummary[0], 'users_with_ratings'),
      rated_journals: scalar(ratingsSummary[0], 'rated_journals'),
      avg_rating: scalar(ratingsSummary[0], 'avg_rating', 0),
      lists: scalar(listSummary[0], 'lists'),
      users_with_lists: scalar(listSummary[0], 'users_with_lists'),
      viewed_journals: scalar(journalViewsSummary[0], 'viewed_journals'),
      total_journal_views: scalar(journalViewsSummary[0], 'total_journal_views'),
      max_journal_views: scalar(journalViewsSummary[0], 'max_journal_views'),
      latest_journal_view_at: scalar(journalViewsSummary[0], 'latest_journal_view_at', null),
      total_pageviews: sumBy(pageviewsByDay, 'pageviews'),
      total_visitors: sumBy(pageviewsByDay, 'visitors'),
      total_cn_hint_events: sumBy(pageviewsByDay, 'cn_hint_events'),
      total_cn_hint_visitors: sumBy(pageviewsByDay, 'cn_hint_visitors'),
      total_cn_hint_sessions: sumBy(pageviewsByDay, 'cn_hint_sessions'),
      total_login_events: sumBy(loginEventsByDay, 'login_events'),
      latest_pageview_at: scalar(latestPageview[0], 'latest_pageview_at', null),
    },
    series: {
      providerMix, registrationsByDay, activeProxyByDay,
      loginEventsByDay, loginProviderMix, pageviewsByDay,
    },
    tables_data: {
      topFavorites: enrich(topFavorites),
      topRated: enrich(topRated),
      topJournalViews: enrich(topJournalViews),
      topPaths,
      trafficCountries,
      recentUsers: recentUsers.map(user => ({
        ...user,
        email: user.email ? user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') : '',
      })),
    },
  };
}

// ───────── 2. Cloudflare GraphQL Analytics ─────────
async function buildCloudflare(env) {
  const zoneId = env.CF_ZONE_ID;
  const token = env.CF_ANALYTICS_TOKEN;
  if (!zoneId || !token) {
    return { source: 'Cloudflare Analytics', status: 'disabled', reason: '未配置 CF_ANALYTICS_TOKEN / CF_ZONE_ID' };
  }
  const since = daysAgoUTC(13);
  const until = daysAgoUTC(0);
  const untilExclusive = tomorrowUTC();
  const runGraphql = async query => {
    const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const body = await resp.json().catch(() => null);
    if (!resp.ok || body?.errors?.length) {
      const reason = body?.errors?.map(e => e.message).join('; ') || `HTTP ${resp.status}`;
      throw new Error(reason);
    }
    return body;
  };
  // Dates/zoneTag inlined as string literals (zoneId + dates are server-controlled).
  // httpRequests1dGroups date filters expect the Cloudflare `string` scalar, so passing
  // them via typed GraphQL variables is fragile — inlining avoids any type mismatch.
  const dailyQuery = `{
    viewer { zones(filter: { zoneTag: "${zoneId}" }) {
      httpRequests1dGroups(limit: 30, filter: { date_geq: "${since}", date_leq: "${until}" }, orderBy: [date_ASC]) {
        dimensions { date }
        sum { requests pageViews bytes cachedRequests encryptedRequests threats }
        uniq { uniques }
      }
    } }
  }`;
  const adaptiveQuery = `{
    viewer { zones(filter: { zoneTag: "${zoneId}" }) {
      httpRequestsAdaptiveGroups(
        limit: 30,
        filter: {
          datetime_geq: "${since}T00:00:00Z",
          datetime_lt: "${untilExclusive}T00:00:00Z",
          requestSource: "eyeball"
        },
        orderBy: [datetimeDay_ASC]
      ) {
        count
        dimensions { datetimeDay }
        sum { visits edgeResponseBytes }
      }
    } }
  }`;

  let sourceMode = 'httpRequests1dGroups';
  let groups = [];
  let primaryError = '';
  try {
    const body = await runGraphql(dailyQuery);
    groups = body?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
  } catch (e) {
    primaryError = e.message || String(e);
  }

  let series = groups.map(g => ({
    day: g.dimensions.date,
    requests: num(g.sum.requests),
    pageviews: num(g.sum.pageViews),
    visitors: num(g.uniq?.uniques),
    bytes: num(g.sum.bytes),
    cached_requests: num(g.sum.cachedRequests),
    encrypted_requests: num(g.sum.encryptedRequests),
    threats: num(g.sum.threats),
  }));

  if (!series.length || !series.some(row => row.requests || row.pageviews || row.visitors)) {
    try {
      const body = await runGraphql(adaptiveQuery);
      const adaptive = body?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
      if (adaptive.length) {
        sourceMode = 'httpRequestsAdaptiveGroups';
        series = adaptive.map(g => ({
          day: String(g.dimensions.datetimeDay || '').slice(0, 10),
          requests: num(g.count),
          pageviews: num(g.sum?.visits),
          visitors: num(g.sum?.visits),
          bytes: num(g.sum?.edgeResponseBytes),
          cached_requests: 0,
          encrypted_requests: 0,
          threats: 0,
        })).filter(row => row.day);
      }
    } catch (e) {
      if (primaryError) {
        return { source: 'Cloudflare Analytics', status: 'error', reason: `${primaryError}; adaptive fallback: ${e.message || e}` };
      }
      return { source: 'Cloudflare Analytics', status: 'error', reason: e.message || String(e) };
    }
  }

  const sum = key => series.reduce((s, r) => s + num(r[key]), 0);
  return {
    source: 'Cloudflare Analytics',
    status: 'ok',
    reason: primaryError && sourceMode !== 'httpRequests1dGroups' ? `主查询无数据或失败，已使用 Adaptive Groups：${primaryError}` : '',
    mode: sourceMode,
    zone_id: zoneId,
    today: series[series.length - 1] || null,
    totals: {
      requests: sum('requests'), pageviews: sum('pageviews'), visitors: sum('visitors'),
      bytes: sum('bytes'), cached_requests: sum('cached_requests'),
      encrypted_requests: sum('encrypted_requests'), threats: sum('threats'),
    },
    series,
  };
}

// ───────── 3. Google Analytics 4 ─────────
function b64urlStr(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlBytes(buf) {
  let s = '';
  for (const x of new Uint8Array(buf)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToDer(pem) {
  const b = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function getGoogleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64urlBytes(sig)}`;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `token HTTP ${resp.status}`);
  }
  return data.access_token;
}

async function ga4Report(propertyId, accessToken, requestBody) {
  const resp = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    },
  );
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data?.error?.message || `report HTTP ${resp.status}`);
  return data;
}

async function buildGoogleAnalytics(env) {
  const propertyId = env.GA4_PROPERTY_ID;
  const raw = env.GA4_SA_KEY;
  if (!propertyId || !raw) {
    return { source: 'Google Analytics 4', status: 'disabled', reason: '未配置 GA4_SA_KEY / GA4_PROPERTY_ID' };
  }
  let sa;
  try {
    sa = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return { source: 'Google Analytics 4', status: 'error', reason: 'GA4_SA_KEY 不是合法 JSON' };
  }
  const token = await getGoogleAccessToken(sa);
  const range = [{ startDate: '13daysAgo', endDate: 'today' }];

  const [daily, pages, countries] = await Promise.all([
    ga4Report(propertyId, token, {
      dateRanges: range,
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
    ga4Report(propertyId, token, {
      dateRanges: range,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 15,
    }),
    ga4Report(propertyId, token, {
      dateRanges: range,
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 15,
    }),
  ]);

  const dRows = daily.rows || [];
  const fmtDay = s => (s && s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s);
  const series = dRows.map(r => ({
    day: fmtDay(r.dimensionValues[0].value),
    sessions: num(r.metricValues[0].value),
    users: num(r.metricValues[1].value),
    pageviews: num(r.metricValues[2].value),
  })).sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const sum = key => series.reduce((s, r) => s + num(r[key]), 0);

  return {
    source: 'Google Analytics 4',
    status: 'ok',
    reason: '',
    property_id: propertyId,
    today: series[series.length - 1] || null,
    totals: { sessions: sum('sessions'), users: sum('users'), pageviews: sum('pageviews') },
    series,
    topPages: (pages.rows || []).map(r => ({
      path: r.dimensionValues[0].value,
      pageviews: num(r.metricValues[0].value),
      users: num(r.metricValues[1].value),
    })),
    topCountries: (countries.rows || []).map(r => ({
      country: r.dimensionValues[0].value,
      users: num(r.metricValues[0].value),
      sessions: num(r.metricValues[1].value),
    })),
  };
}

// ───────── top-level ─────────
export async function buildDashboardPayload(env, options = {}) {
  const [d1, cloudflare, ga, siteMonitoring, siteBusiness] = await Promise.all([
    buildD1(env),
    buildCloudflare(env).catch(e => ({ source: 'Cloudflare Analytics', status: 'error', reason: e.message })),
    buildGoogleAnalytics(env).catch(e => ({ source: 'Google Analytics 4', status: 'error', reason: e.message })),
    buildSiteMonitoring(env, options).catch(e => ({
      status: 'error',
      reason: e.message || String(e),
      sites: siteDefs(),
      first_party: {},
      source_comparison: {},
    })),
    buildSiteBusiness(env, options).catch(e => ({
      journal: { status: 'error', reason: e.message || String(e) },
      grant: { status: 'error', reason: e.message || String(e) },
      ailatest: { status: 'error', reason: e.message || String(e) },
    })),
  ]);
  const siteMonitoringWithSources = attachExternalSiteMonitoring(siteMonitoring, cloudflare, ga);

  return {
    generated_at: new Date().toISOString(),
    source: 'remote D1 (edge)',
    notes: [
      '本看板由 Cloudflare Worker 实时从边缘出数，不依赖任何本地服务。',
      '三个口径互相独立：第一方埋点（page_events）最窄，只统计成功运行脚本并上报的访问；Cloudflare 含所有请求/静态资源/爬虫；Google Analytics 是 GTM 上报口径。',
      '注册量来自 users.created_at；每日登录人数来自 login_events。',
      '页面浏览量同一人刷新会重复计数；独立访客按浏览器匿名标识去重；访问人次按会话去重。',
      '疑似中国访问按浏览器时区 Asia/Shanghai 或语言 zh-* 粗略判断，用于弥补 VPN/代理导致的 IP 出口偏差。',
    ],
    ...d1,
    cloudflare,
    google_analytics: ga,
    site_monitoring: siteMonitoringWithSources,
    site_business: siteBusiness,
  };
}
