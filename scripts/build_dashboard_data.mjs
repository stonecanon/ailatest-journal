import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workerDir = join(root, 'worker');
const outDir = join(root, 'dashboard');
const outFile = join(outDir, 'data.json');
const database = process.argv.includes('--local') ? 'ailatest-journal' : 'ailatest-journal';
const remoteArgs = process.argv.includes('--local') ? [] : ['--remote'];

function parseWranglerJson(stdout) {
  const start = stdout.indexOf('[\n');
  if (start < 0) throw new Error(`Wrangler output did not include JSON:\n${stdout}`);
  return JSON.parse(stdout.slice(start));
}

async function query(sql) {
  const { stdout } = await execFileAsync(
    'npx',
    ['wrangler', 'd1', 'execute', database, ...remoteArgs, '--command', sql],
    { cwd: workerDir, maxBuffer: 1024 * 1024 * 10 },
  );
  const parsed = parseWranglerJson(stdout);
  const first = parsed[0] || {};
  if (!first.success) throw new Error(`D1 query failed: ${sql}`);
  return first.results || [];
}

async function maybeQuery(hasTable, tableName, sql) {
  if (!hasTable(tableName)) return [];
  return query(sql);
}

function scalar(row, key, fallback = 0) {
  const value = row?.[key];
  return value == null ? fallback : value;
}

async function loadJournalNameMap() {
  const map = new Map();
  for (const file of ['data/journals.json', 'data/domestic.json']) {
    try {
      const raw = await readFile(join(root, file), 'utf8');
      const data = JSON.parse(raw);
      const rows = Array.isArray(data) ? data : Object.values(data).flat().filter(Boolean);
      for (const item of rows) {
        const title = item.title || item.name || item.journal || item.cn || item.en;
        const keys = [
          item.id,
          item.key,
          item.issn,
          item.eissn,
          item.title,
          item.name,
          item.cn,
          item.en,
        ].filter(Boolean);
        for (const key of keys) map.set(String(key), title || String(key));
      }
    } catch (_) {}
  }
  return map;
}

function enrichKeys(rows, map) {
  return rows.map(row => ({
    ...row,
    label: map.get(String(row.journal_key)) || row.journal_key,
  }));
}

const tableRows = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
const tables = new Set(tableRows.map(r => r.name));
const hasTable = name => tables.has(name);
const journalNameMap = await loadJournalNameMap();

const [
  userTotals,
  providerMix,
  registrationsByDay,
  activeProxyByDay,
  favoritesSummary,
  topFavorites,
  ratingsSummary,
  topRated,
  listSummary,
  loginEventsByDay,
  loginProviderMix,
  pageviewsByDay,
  topPaths,
  trafficCountries,
  recentUsers,
] = await Promise.all([
  query(`
    SELECT
      COUNT(*) AS total_users,
      COUNT(email) AS users_with_email,
      SUM(CASE WHEN provider='email' THEN 1 ELSE 0 END) AS email_users,
      SUM(CASE WHEN provider='github' THEN 1 ELSE 0 END) AS github_users,
      SUM(CASE WHEN provider='google' THEN 1 ELSE 0 END) AS google_users,
      MIN(created_at) AS first_signup_at,
      MAX(created_at) AS latest_signup_at
    FROM users
  `),
  query(`
    SELECT COALESCE(provider, 'unknown') AS provider, COUNT(*) AS users
    FROM users
    GROUP BY COALESCE(provider, 'unknown')
    ORDER BY users DESC
  `),
  query(`
    SELECT date(created_at, 'unixepoch') AS day, COUNT(*) AS signups
    FROM users
    GROUP BY date(created_at, 'unixepoch')
    ORDER BY day
  `),
  query(`
    SELECT date(updated_at, 'unixepoch') AS day, COUNT(DISTINCT id) AS active_users_proxy
    FROM users
    GROUP BY date(updated_at, 'unixepoch')
    ORDER BY day
  `),
  query(`
    SELECT
      COALESCE(SUM(c), 0) AS favorite_rows,
      COUNT(*) AS users_with_favorites,
      ROUND(AVG(c), 2) AS avg_favorites_per_active_user,
      MAX(c) AS max_favorites_by_user
    FROM (
      SELECT user_id, COUNT(*) AS c FROM favorites GROUP BY user_id
    )
  `),
  query(`
    SELECT journal_key, COUNT(*) AS favorites
    FROM favorites
    GROUP BY journal_key
    ORDER BY favorites DESC, journal_key ASC
    LIMIT 20
  `),
  query(`
    SELECT
      COUNT(*) AS rating_rows,
      COUNT(DISTINCT user_id) AS users_with_ratings,
      COUNT(DISTINCT journal_key) AS rated_journals,
      ROUND(AVG(rating), 2) AS avg_rating
    FROM ratings
  `),
  query(`
    SELECT journal_key, COUNT(*) AS ratings, ROUND(AVG(rating), 2) AS avg_rating
    FROM ratings
    GROUP BY journal_key
    ORDER BY ratings DESC, avg_rating DESC, journal_key ASC
    LIMIT 20
  `),
  query(`
    SELECT
      COUNT(*) AS lists,
      COUNT(DISTINCT user_id) AS users_with_lists,
      ROUND(AVG(json_array_length(ids_json)), 2) AS avg_items_per_list,
      MAX(json_array_length(ids_json)) AS max_items_in_list
    FROM fav_lists
  `),
  maybeQuery(hasTable, 'login_events', `
    SELECT day, COUNT(*) AS login_events, COUNT(DISTINCT user_id) AS login_users
    FROM login_events
    GROUP BY day
    ORDER BY day
  `),
  maybeQuery(hasTable, 'login_events', `
    SELECT COALESCE(provider, 'unknown') AS provider, COUNT(*) AS login_events, COUNT(DISTINCT user_id) AS login_users
    FROM login_events
    GROUP BY COALESCE(provider, 'unknown')
    ORDER BY login_events DESC
  `),
  maybeQuery(hasTable, 'page_events', `
    SELECT
      day,
      COUNT(*) AS pageviews,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(DISTINCT visitor_id) AS visitors
    FROM page_events
    GROUP BY day
    ORDER BY day
  `),
  maybeQuery(hasTable, 'page_events', `
    SELECT COALESCE(path, '/') AS path, COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors
    FROM page_events
    GROUP BY COALESCE(path, '/')
    ORDER BY pageviews DESC
    LIMIT 20
  `),
  maybeQuery(hasTable, 'page_events', `
    SELECT COALESCE(country, 'unknown') AS country, COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors
    FROM page_events
    GROUP BY COALESCE(country, 'unknown')
    ORDER BY pageviews DESC
    LIMIT 20
  `),
  query(`
    SELECT id, provider, email, login, name, created_at, updated_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 20
  `),
]);

const totals = userTotals[0] || {};
const payload = {
  generated_at: new Date().toISOString(),
  source: process.argv.includes('--local') ? 'local D1' : 'remote D1',
  notes: [
    '注册量来自 users.created_at，当前是最可靠口径。',
    '每日登录人数来自 login_events；部署 0005 migration 和新版 Worker 后开始累积。',
    '埋点上线前，active_users_proxy 使用 users.updated_at 作为粗略活跃代理，不等同真实登录。',
    'PV 是页面浏览量：同一人刷新或打开多个页面会重复计数。',
    'UV 是独立访客：按浏览器本地 visitor_id 去重，同一人换设备或清缓存会被算作新访客。',
    'Sessions 是访问人次：按浏览器会话 session_id 去重，更接近“来了多少次”。',
    '浏览量来自 page_events；前端埋点上线后开始累积 PV、UV、Sessions、路径和国家/地区。',
  ],
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
    total_pageviews: pageviewsByDay.reduce((sum, row) => sum + Number(row.pageviews || 0), 0),
    total_visitors: pageviewsByDay.reduce((sum, row) => sum + Number(row.visitors || 0), 0),
    total_login_events: loginEventsByDay.reduce((sum, row) => sum + Number(row.login_events || 0), 0),
  },
  series: {
    providerMix,
    registrationsByDay,
    activeProxyByDay,
    loginEventsByDay,
    loginProviderMix,
    pageviewsByDay,
  },
  tables_data: {
    topFavorites: enrichKeys(topFavorites, journalNameMap),
    topRated: enrichKeys(topRated, journalNameMap),
    topPaths,
    trafficCountries,
    recentUsers: recentUsers.map(user => ({
      ...user,
      email: user.email ? user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') : '',
    })),
  },
};

await mkdir(outDir, { recursive: true });
await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Dashboard data written to ${outFile}`);
