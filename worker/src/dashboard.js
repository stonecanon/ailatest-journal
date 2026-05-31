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
function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}
async function q(env, sql) {
  const r = await env.DB.prepare(sql).all();
  return r.results || [];
}
function scalar(row, key, fallback = 0) {
  const v = row?.[key];
  return v == null ? fallback : v;
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
  // Dates/zoneTag inlined as string literals (zoneId + dates are server-controlled).
  // httpRequests1dGroups date filters expect the Cloudflare `string` scalar, so passing
  // them via typed GraphQL variables is fragile — inlining avoids any type mismatch.
  const query = `{
    viewer { zones(filter: { zoneTag: "${zoneId}" }) {
      httpRequests1dGroups(limit: 30, filter: { date_geq: "${since}", date_leq: "${until}" }, orderBy: [date_ASC]) {
        dimensions { date }
        sum { requests pageViews bytes cachedRequests encryptedRequests threats }
        uniq { uniques }
      }
    } }
  }`;
  const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok || body?.errors?.length) {
    const reason = body?.errors?.map(e => e.message).join('; ') || `HTTP ${resp.status}`;
    return { source: 'Cloudflare Analytics', status: 'error', reason };
  }
  const groups = body?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
  const series = groups.map(g => ({
    day: g.dimensions.date,
    requests: num(g.sum.requests),
    pageviews: num(g.sum.pageViews),
    visitors: num(g.uniq?.uniques),
    bytes: num(g.sum.bytes),
    cached_requests: num(g.sum.cachedRequests),
    encrypted_requests: num(g.sum.encryptedRequests),
    threats: num(g.sum.threats),
  }));
  const sum = key => series.reduce((s, r) => s + num(r[key]), 0);
  return {
    source: 'Cloudflare Analytics',
    status: 'ok',
    reason: '',
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
export async function buildDashboardPayload(env) {
  const [d1, cloudflare, ga] = await Promise.all([
    buildD1(env),
    buildCloudflare(env).catch(e => ({ source: 'Cloudflare Analytics', status: 'error', reason: e.message })),
    buildGoogleAnalytics(env).catch(e => ({ source: 'Google Analytics 4', status: 'error', reason: e.message })),
  ]);

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
  };
}
