const fmt = new Intl.NumberFormat('zh-CN');
const dateFmt = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

function n(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? fmt.format(num) : '0';
}

function fromUnix(sec) {
  return sec ? new Date(sec * 1000).toLocaleDateString('zh-CN') : '暂无';
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

function kpi(label, value, detail) {
  return el('div', { class: 'kpi' }, [
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
  document.querySelector('.traffic-kpis').append(
    kpi('最近一天页面浏览量', n(latest.pageviews), latest.day ? `${latest.day} 页面被打开的次数` : '暂无访问记录'),
    kpi('最近一天独立访客数', n(latest.visitors), '同一浏览器访客去重'),
    kpi('最近一天访问人次', n(latest.sessions), '同一浏览器会话去重'),
    kpi('累计浏览量 / 访客数', `${n(k.total_pageviews)} / ${n(k.total_visitors)}`, `累计访问人次 ${n(sessions)}`),
  );
}

function renderSecondaryKpis(data) {
  const k = data.kpis;
  document.querySelector('.secondary-kpis').append(
    kpi('总注册用户', n(k.total_users), `最早 ${fromUnix(k.first_signup_at)} · 最新 ${fromUnix(k.latest_signup_at)}`),
    kpi('邮箱用户', n(k.email_users), `有邮箱记录 ${n(k.users_with_email)}`),
    kpi('GitHub / Google', `${n(k.github_users)} / ${n(k.google_users)}`, 'OAuth 注册来源'),
    kpi('收藏行为', n(k.favorite_rows), `${n(k.users_with_favorites)} 人使用收藏`),
    kpi('评分行为', n(k.rating_rows), `${n(k.rated_journals)} 本期刊被评分`),
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

function lineChart(target, rows, series, options = {}) {
  const host = document.querySelector(target);
  if (!rows.length) {
    host.innerHTML = '<div class="empty">暂无数据。部署埋点或产生新行为后这里会自动出现趋势。</div>';
    return;
  }
  const width = 760;
  const height = 280;
  const pad = { l: 42, r: 18, t: 20, b: 38 };
  const max = Math.max(1, ...rows.flatMap(row => series.map(s => Number(row[s.key] || 0))));
  const x = index => pad.l + (rows.length === 1 ? 0 : index * (width - pad.l - pad.r) / (rows.length - 1));
  const y = value => height - pad.b - (Number(value || 0) / max) * (height - pad.t - pad.b);
  const paths = series.map(s => {
    const d = rows.map((row, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(row[s.key]).toFixed(1)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  const dots = series.map(s => rows.map((row, index) =>
    `<circle cx="${x(index).toFixed(1)}" cy="${y(row[s.key]).toFixed(1)}" r="3.5" fill="${s.color}"><title>${row.day} · ${s.name}: ${row[s.key] || 0}</title></circle>`
  ).join('')).join('');
  const labels = rows.map((row, index) => {
    if (rows.length > 8 && index % Math.ceil(rows.length / 6) !== 0 && index !== rows.length - 1) return '';
    return `<text x="${x(index).toFixed(1)}" y="${height - 12}" text-anchor="middle" font-size="11" fill="#657176">${row.day.slice(5)}</text>`;
  }).join('');
  const legend = series.map((s, i) => `<g transform="translate(${pad.l + i * 130}, 8)"><circle r="5" fill="${s.color}"/><text x="10" y="4" font-size="12" fill="#657176">${s.name}</text></g>`).join('');
  host.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.label || '趋势图'}">
      <line x1="${pad.l}" y1="${height - pad.b}" x2="${width - pad.r}" y2="${height - pad.b}" stroke="#d8dedb"/>
      <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" stroke="#d8dedb"/>
      <text x="8" y="${pad.t + 5}" font-size="11" fill="#657176">${max}</text>
      ${legend}${paths}${dots}${labels}
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

async function main() {
  const data = await fetch('data.json', { cache: 'no-store' }).then(r => r.json());
  document.querySelector('#generated-at').textContent = dateFmt.format(new Date(data.generated_at));
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
    };
  }).sort((a, b) => b.day.localeCompare(a.day));
  table('#daily-traffic', dailyTraffic, [
    { title: '日期', key: 'day' },
    { title: '页面浏览量', render: row => n(row.pageviews) },
    { title: '独立访客数', render: row => n(row.visitors) },
    { title: '访问人次', render: row => n(row.sessions) },
    { title: '注册', render: row => n(row.signups) },
    { title: '登录用户', render: row => n(row.login_users) },
  ]);

  const notes = document.querySelector('#notes');
  notes.innerHTML = '';
  for (const note of data.notes || []) notes.append(el('li', { text: note }));
}

main().catch(err => {
  document.body.innerHTML = `<main class="shell"><h1>Dashboard load failed</h1><p>${err.message}</p></main>`;
});
