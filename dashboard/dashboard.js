const fmt = new Intl.NumberFormat('zh-CN');
const dateFmt = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

function n(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? fmt.format(num) : '0';
}

function fromUnix(sec) {
  return sec ? new Date(sec * 1000).toLocaleDateString('zh-CN') : '暂无';
}

function fromUnixDateTime(sec) {
  return sec ? dateFmt.format(new Date(sec * 1000)) : '暂无';
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

function kpi(label, value, detail, icon = '•') {
  return el('div', { class: 'kpi', 'data-icon': icon }, [
    el('div', { class: 'label', text: label }),
    el('div', { class: 'value', text: value }),
    el('div', { class: 'detail', text: detail || '' }),
  ]);
}

function sumRows(rows, key) {
  return (rows || []).reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function latestTrafficRow(data) {
  const rows = [...(data.series.pageviewsByDay || [])].sort((a, b) => b.day.localeCompare(a.day));
  return rows[0] || {};
}

function renderTrafficKpis(data) {
  const k = data.kpis;
  const latest = latestTrafficRow(data);
  const sessions = sumRows(data.series.pageviewsByDay, 'sessions');
  document.querySelector('#hero-pageviews').textContent = n(k.total_pageviews);
  document.querySelector('.traffic-kpis').append(
    kpi('最近一天页面浏览量', n(latest.pageviews), latest.day ? `${latest.day} 页面被打开的次数` : '暂无访问记录', 'PV'),
    kpi('最近一天独立访客数', n(latest.visitors), '同一浏览器访客去重', 'UV'),
    kpi('最近一天访问人次', n(latest.sessions), '同一浏览器会话去重', 'S'),
    kpi('累计浏览量 / 访客数', `${n(k.total_pageviews)} / ${n(k.total_visitors)}`, `累计访问人次 ${n(sessions)}`, 'Σ'),
    kpi('最后一次浏览上报', fromUnixDateTime(k.latest_pageview_at), '远程 D1 page_events 最新记录', '↻'),
  );
}

function renderSecondaryKpis(data) {
  const k = data.kpis;
  document.querySelector('.secondary-kpis').append(
    kpi('总注册用户', n(k.total_users), `最早 ${fromUnix(k.first_signup_at)} · 最新 ${fromUnix(k.latest_signup_at)}`, 'U'),
    kpi('邮箱用户', n(k.email_users), `有邮箱记录 ${n(k.users_with_email)}`, '@'),
    kpi('GitHub / Google', `${n(k.github_users)} / ${n(k.google_users)}`, 'OAuth 注册来源', 'G'),
    kpi('收藏行为', n(k.favorite_rows), `${n(k.users_with_favorites)} 人使用收藏`, '☆'),
    kpi('评分行为', n(k.rating_rows), `${n(k.rated_journals)} 本期刊被评分`, '★'),
  );
}

function mergeSeries(rows, keys) {
  const days = [...new Set(rows.flatMap(rowset => rowset.map(r => r.day)))].sort();
  return days.map(day => {
    const item = { day };
    keys.forEach((key, index) => {
      const found = rows[index].find(r => r.day === day);
      item[key] = Number(found?.[key] || 0);
    });
    return item;
  });
}

function smoothPath(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  const t = 0.16;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function lineChart(target, rows, series, options = {}) {
  const host = document.querySelector(target);
  if (!rows.length) {
    host.innerHTML = '<div class="empty">暂无数据。部署埋点或产生新行为后这里会自动出现趋势。</div>';
    return;
  }
  const width = 760;
  const height = 280;
  const pad = { l: 44, r: 20, t: 30, b: 38 };
  const uid = `c${Math.abs([...target].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}`;
  const max = Math.max(1, ...rows.flatMap(row => series.map(s => Number(row[s.key] || 0))));
  const x = index => pad.l + (rows.length === 1 ? 0 : index * (width - pad.l - pad.r) / (rows.length - 1));
  const y = value => height - pad.b - (Number(value || 0) / max) * (height - pad.t - pad.b);

  // horizontal gridlines + y labels
  const ticks = 4;
  const grid = Array.from({ length: ticks + 1 }, (_, i) => {
    const gy = pad.t + i * (height - pad.t - pad.b) / ticks;
    const val = Math.round(max * (1 - i / ticks));
    return `<line x1="${pad.l}" y1="${gy.toFixed(1)}" x2="${width - pad.r}" y2="${gy.toFixed(1)}" stroke="#eef2ef"/>`
      + `<text x="${pad.l - 8}" y="${(gy + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="#9aa49f">${val}</text>`;
  }).join('');

  // area fill under the primary (first) series
  const first = series[0];
  const firstPts = rows.map((row, i) => [x(i), y(row[first.key])]);
  const linePath = smoothPath(firstPts);
  const areaPath = `${linePath} L ${x(rows.length - 1).toFixed(1)} ${(height - pad.b).toFixed(1)} L ${x(0).toFixed(1)} ${(height - pad.b).toFixed(1)} Z`;

  const paths = series.map((s, si) => {
    const pts = rows.map((row, i) => [x(i), y(row[s.key])]);
    const dash = si === 0 ? '' : ' stroke-dasharray="2 6"';
    const opacity = si === 0 ? 1 : 0.85;
    return `<path d="${smoothPath(pts)}" fill="none" stroke="${s.color}" stroke-width="${si === 0 ? 3 : 2.2}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
  }).join('');

  const dots = series.map(s => rows.map((row, index) =>
    `<circle cx="${x(index).toFixed(1)}" cy="${y(row[s.key]).toFixed(1)}" r="2.6" fill="#fff" stroke="${s.color}" stroke-width="1.6"><title>${row.day} · ${s.name}: ${row[s.key] || 0}</title></circle>`
  ).join('')).join('');

  const labels = rows.map((row, index) => {
    if (rows.length > 8 && index % Math.ceil(rows.length / 6) !== 0 && index !== rows.length - 1) return '';
    return `<text x="${x(index).toFixed(1)}" y="${height - 12}" text-anchor="middle" font-size="10.5" fill="#9aa49f">${row.day.slice(5)}</text>`;
  }).join('');

  const legend = series.map((s, i) => `<g transform="translate(${pad.l + i * 132}, 10)"><rect x="-2" y="-7" width="11" height="11" rx="3.5" fill="${s.color}"/><text x="15" y="2.5" font-size="11.5" font-weight="600" fill="#5e6b66">${s.name}</text></g>`).join('');

  host.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.label || '趋势图'}">
      <defs>
        <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${first.color}" stop-opacity="0.26"/>
          <stop offset="100%" stop-color="${first.color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${areaPath}" fill="url(#${uid})" stroke="none"/>
      ${paths}${dots}${labels}${legend}
    </svg>
  `;
}

function barList(target, rows, labelKey, valueKey, color = '#256f5a') {
  const host = document.querySelector(target);
  if (!rows.length) {
    host.innerHTML = '<div class="empty">暂无数据。</div>';
    return;
  }
  const max = Math.max(1, ...rows.map(r => Number(r[valueKey] || 0)));
  host.innerHTML = '';
  for (const row of rows) {
    const value = Number(row[valueKey] || 0);
    const label = row[labelKey] || 'unknown';
    const item = el('div', { class: 'bar-row' }, [
      el('div', { class: 'bar-label', title: label }, [
        el('span', { text: label }),
        ...(row.detail ? [el('small', { text: row.detail })] : []),
      ]),
      el('div', { class: 'bar-track' }, [
        el('span', { class: 'bar-fill', style: `width:${Math.max(4, value / max * 100)}%;background:${color}` }),
      ]),
      el('div', { class: 'bar-value', text: n(value) }),
    ]);
    host.append(item);
  }
}

function regionName(code) {
  const map = {
    CN: '中国大陆',
    HK: '中国香港',
    MO: '中国澳门',
    TW: '中国台湾',
    JP: '日本',
    US: '美国',
    SG: '新加坡',
    NL: '荷兰',
    GB: '英国',
    IN: '印度',
    ZA: '南非',
    NG: '尼日利亚',
    DE: '德国',
  };
  return map[code] || code || '未知地区';
}

function shortList(value, limit = 2) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(' / ');
}

function table(target, rows, columns) {
  const host = document.querySelector(target);
  if (!rows.length) {
    host.innerHTML = '<div class="empty">暂无数据。</div>';
    return;
  }
  const html = [
    '<table><thead><tr>',
    ...columns.map(c => `<th>${c.title}</th>`),
    '</tr></thead><tbody>',
    ...rows.map(row => `<tr>${columns.map(c => `<td>${c.render ? c.render(row) : (row[c.key] ?? '')}</td>`).join('')}</tr>`),
    '</tbody></table>',
  ].join('');
  host.innerHTML = html;
}

function clearDynamicContent() {
  [
    '.cf-kpis',
    '.ga-kpis',
    '#cf-chart',
    '#ga-chart',
    '#ga-top-pages',
    '#ga-top-countries',
    '#cf-note',
    '#ga-note',
    '.traffic-kpis',
    '.secondary-kpis',
    '#signup-login-chart',
    '#traffic-chart',
    '#provider-bars',
    '#login-provider-bars',
    '#top-paths',
    '#traffic-countries',
    '#top-favorites',
    '#top-rated',
    '#recent-users',
    '#daily-traffic',
    '#notes',
  ].forEach(selector => {
    const node = document.querySelector(selector);
    if (node) node.innerHTML = '';
  });
}

function humanBytes(bytes) {
  const b = Number(bytes || 0);
  if (b <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return `${(b / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function sourceNote(selector, src) {
  const node = document.querySelector(selector);
  if (!node) return false;
  if (!src || src.status === 'disabled') {
    node.innerHTML = `<div class="empty">${src?.reason || '未配置该数据源。'}</div>`;
    return false;
  }
  if (src.status === 'error') {
    node.innerHTML = `<div class="empty">获取失败：${src.reason || '未知错误'}</div>`;
    return false;
  }
  node.innerHTML = '';
  return true;
}

function renderCloudflare(data) {
  const src = data.cloudflare;
  const ok = sourceNote('#cf-note', src);
  const kpis = document.querySelector('.cf-kpis');
  if (kpis) kpis.innerHTML = '';
  if (!ok) return;
  const today = src.today || {};
  const totals = src.totals || {};
  if (kpis) kpis.append(
    kpi('今日请求数', n(today.requests), `${today.day || ''} 全部 HTTP 请求`, 'CF'),
    kpi('今日页面浏览', n(today.pageviews), '由 Cloudflare 统计（含直接访问）', 'PV'),
    kpi('今日独立访客', n(today.visitors), '按 Cloudflare 去重', 'UV'),
    kpi('今日流量', humanBytes(today.bytes), `加密请求 ${n(today.encrypted_requests)}`, '↯'),
    kpi('近 14 天累计', `${n(totals.requests)} 请求`, `浏览 ${n(totals.pageviews)} · 访客 ${n(totals.visitors)} · 威胁拦截 ${n(totals.threats)}`, 'Σ'),
  );
  lineChart('#cf-chart', src.series || [], [
    { key: 'requests', name: '请求数', color: '#f6821f' },
    { key: 'pageviews', name: '页面浏览', color: '#0b7285' },
    { key: 'visitors', name: '独立访客', color: '#b0443d' },
  ], { label: 'Cloudflare 流量趋势' });
}

function renderGoogleAnalytics(data) {
  const src = data.google_analytics;
  const ok = sourceNote('#ga-note', src);
  const kpis = document.querySelector('.ga-kpis');
  if (kpis) kpis.innerHTML = '';
  if (!ok) return;
  const today = src.today || {};
  const totals = src.totals || {};
  if (kpis) kpis.append(
    kpi('今日会话数', n(today.sessions), `${today.day || ''} GA4 sessions`, 'S'),
    kpi('今日活跃用户', n(today.users), 'GA4 totalUsers', 'U'),
    kpi('今日页面浏览', n(today.pageviews), 'GA4 screenPageViews', 'PV'),
    kpi('近 14 天累计', `${n(totals.pageviews)} 浏览`, `会话 ${n(totals.sessions)} · 用户 ${n(totals.users)}`, 'Σ'),
  );
  lineChart('#ga-chart', src.series || [], [
    { key: 'pageviews', name: '页面浏览', color: '#e8710a' },
    { key: 'sessions', name: '会话', color: '#1a73e8' },
    { key: 'users', name: '用户', color: '#34a853' },
  ], { label: 'Google Analytics 趋势' });
  barList('#ga-top-pages', src.topPages || [], 'path', 'pageviews', '#1a73e8');
  const countries = (src.topCountries || []).map(row => ({
    ...row,
    country_label: `${regionName(row.country)}${row.country ? ` (${row.country})` : ''}`,
    detail: `会话 ${n(row.sessions)}`,
  }));
  barList('#ga-top-countries', countries, 'country_label', 'users', '#34a853');
}

function renderDashboard(data) {
  clearDynamicContent();
  renderCloudflare(data);
  renderGoogleAnalytics(data);
  document.querySelector('#generated-at').textContent = dateFmt.format(new Date(data.generated_at));
  document.querySelector('#latest-pageview-at').textContent = fromUnixDateTime(data.kpis.latest_pageview_at);
  document.querySelector('#source').textContent = data.source;
  renderTrafficKpis(data);
  renderSecondaryKpis(data);

  const registrationRows = data.series.registrationsByDay || [];
  const loginRows = data.series.loginEventsByDay || [];
  const activeRows = data.series.activeProxyByDay || [];
  const signupLogin = mergeSeries([registrationRows, loginRows, activeRows], ['signups', 'login_users', 'active_users_proxy']);
  lineChart('#signup-login-chart', signupLogin, [
    { key: 'signups', name: '注册', color: '#256f5a' },
    { key: 'login_users', name: '登录人数', color: '#345995' },
    { key: 'active_users_proxy', name: '活跃代理', color: '#a46a13' },
  ], { label: '注册与登录趋势' });

  lineChart('#traffic-chart', data.series.pageviewsByDay || [], [
    { key: 'pageviews', name: '页面浏览量', color: '#0b7285' },
    { key: 'visitors', name: '独立访客数', color: '#b0443d' },
    { key: 'sessions', name: '访问人次', color: '#a46a13' },
    { key: 'cn_hint_events', name: '疑似中国访问', color: '#6f4bb2' },
  ], { label: '访问趋势' });

  barList('#provider-bars', data.series.providerMix || [], 'provider', 'users', '#256f5a');
  barList('#login-provider-bars', data.series.loginProviderMix || [], 'provider', 'login_events', '#345995');
  barList('#top-paths', data.tables_data.topPaths || [], 'path', 'pageviews', '#0b7285');
  const trafficCountries = (data.tables_data.trafficCountries || []).map(row => ({
    ...row,
    country_label: `${regionName(row.country)}${row.country ? ` (${row.country})` : ''}`,
    detail: [
      `独立访客 ${n(row.visitors)}`,
      `访问人次 ${n(row.sessions)}`,
      Number(row.cn_hint_events || 0) ? `疑似中国 ${n(row.cn_hint_events)} 次 / ${n(row.cn_hint_visitors)} 人` : '',
      row.colos ? `机房 ${shortList(row.colos, 3)}` : '',
      row.client_timezones ? `时区 ${shortList(row.client_timezones)}` : '',
      row.client_languages ? `语言 ${shortList(row.client_languages)}` : '',
    ].filter(Boolean).join(' · '),
  }));
  barList('#traffic-countries', trafficCountries, 'country_label', 'pageviews', '#a46a13');

  table('#top-favorites', data.tables_data.topFavorites || [], [
    { title: '期刊', render: row => row.label || row.journal_key },
    { title: '收藏数', key: 'favorites' },
  ]);
  table('#top-rated', data.tables_data.topRated || [], [
    { title: '期刊', render: row => row.label || row.journal_key },
    { title: '评分数', key: 'ratings' },
    { title: '均分', key: 'avg_rating' },
  ]);
  table('#recent-users', data.tables_data.recentUsers || [], [
    { title: 'ID', key: 'id' },
    { title: '来源', key: 'provider' },
    { title: '用户', render: row => row.name || row.login || row.email || '-' },
    { title: '注册日', render: row => fromUnix(row.created_at) },
  ]);
  const dailyTraffic = mergeSeries(
    [data.series.pageviewsByDay || [], registrationRows, loginRows],
    ['pageviews', 'signups', 'login_users'],
  ).map(row => {
    const traffic = (data.series.pageviewsByDay || []).find(item => item.day === row.day) || {};
    return {
      ...row,
      visitors: Number(traffic.visitors || 0),
      sessions: Number(traffic.sessions || 0),
      cn_hint_events: Number(traffic.cn_hint_events || 0),
      cn_hint_visitors: Number(traffic.cn_hint_visitors || 0),
      cn_hint_sessions: Number(traffic.cn_hint_sessions || 0),
    };
  }).sort((a, b) => b.day.localeCompare(a.day));
  table('#daily-traffic', dailyTraffic, [
    { title: '日期', key: 'day' },
    { title: '页面浏览量', render: row => n(row.pageviews) },
    { title: '独立访客数', render: row => n(row.visitors) },
    { title: '访问人次', render: row => n(row.sessions) },
    { title: '疑似中国访问', render: row => `${n(row.cn_hint_events)} / ${n(row.cn_hint_visitors)}人` },
    { title: '注册', render: row => n(row.signups) },
    { title: '登录用户', render: row => n(row.login_users) },
  ]);

  const notes = document.querySelector('#notes');
  notes.innerHTML = '';
  for (const note of data.notes || []) notes.append(el('li', { text: note }));
}

// API base: edge Worker. Override with ?api= or window.DASHBOARD_API for local dev.
const API_BASE = (function () {
  const p = new URLSearchParams(location.search).get('api');
  if (p) return p.replace(/\/$/, '');
  if (window.DASHBOARD_API) return String(window.DASHBOARD_API).replace(/\/$/, '');
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'http://localhost:8787';
  return 'https://api.ailatest.org';
})();
const SITE_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'https://journal.ailatest.org' : location.origin;

function ownerToken() {
  try {
    const u = JSON.parse(localStorage.getItem('ailatest.user') || 'null');
    return u && u.token ? u.token : '';
  } catch (_) {
    return '';
  }
}

function renderLoginGate(message) {
  const host = document.querySelector('.workspace') || document.body;
  host.innerHTML = `
    <section class="card panel" style="max-width:520px;margin:40px auto;text-align:center">
      <h2>需要站长登录</h2>
      <p style="color:#657176;margin:12px 0 20px">${message || '此看板仅站长可见。请先用站长账号登录主站，然后回到本页。'}</p>
      <a class="btn-primary" href="${SITE_BASE}/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">去主站登录</a>
      <p style="color:#9aa4a0;font-size:12px;margin-top:16px">登录后回到本页点击“刷新数据”即可。</p>
    </section>`;
}

async function loadDashboardData() {
  const token = ownerToken();
  if (!token) {
    renderLoginGate('未检测到登录凭证。请用站长账号（jiantaoweng@gmail.com）登录主站后再访问本看板。');
    return;
  }
  const resp = await fetch(`${API_BASE}/analytics/dashboard?ts=${Date.now()}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 401 || resp.status === 403) {
    renderLoginGate('当前账号无权访问（看板仅限站长 jiantaoweng@gmail.com）。请用站长账号登录主站后重试。');
    return;
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  renderDashboard(data);
}

async function refreshFromServer(button) {
  if (button) {
    button.disabled = true;
    button.textContent = '刷新中...';
  }
  try {
    await loadDashboardData();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '刷新数据';
    }
  }
}

function setGreeting() {
  const el = document.querySelector('#greeting');
  if (!el) return;
  const h = new Date().getHours();
  const word = h < 6 ? '凌晨好' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  el.textContent = `${word}，运营概览`;
}

async function main() {
  setGreeting();
  await loadDashboardData();
  const button = document.querySelector('#refresh-now');
  button?.addEventListener('click', () => refreshFromServer(button));
  setInterval(loadDashboardData, 60 * 1000);
}

main().catch(err => {
  document.body.innerHTML = `<main class="shell"><h1>Dashboard load failed</h1><p>${err.message}</p></main>`;
});
