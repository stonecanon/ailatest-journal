const fs = require('fs');
const path = require('path');
const WebSocket = require(process.env.WS_MODULE || 'C:/Users/dell/AppData/Local/Temp/codex-cdp-ws/node_modules/ws');

const OUT_DIR = path.resolve(__dirname, 'cnki_major_parts');
const FINAL_JSON = path.resolve(__dirname, 'cnki_major_journals.json');
const FINAL_CSV = path.resolve(__dirname, 'cnki_major_journals.csv');

const MAJORS = [
  { code: 'A', title: '基础科学', count: 877 },
  { code: 'B', title: '工程科技I', count: 1087 },
  { code: 'C', title: '工程科技II', count: 1311 },
  { code: 'D', title: '农业科技', count: 622 },
  { code: 'E', title: '医药卫生科技', count: 1370 },
  { code: 'F', title: '哲学与人文科学', count: 1540 },
  { code: 'G', title: '社会科学I', count: 1283 },
  { code: 'H', title: '社会科学II', count: 2206 },
  { code: 'I', title: '信息科技', count: 733 },
  { code: 'J', title: '经济与管理科学', count: 1401 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(s = '') {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function strip(s = '') {
  return decodeHtml(
    s
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePage(html, category, page) {
  const records = [];
  const listMatch = html.match(/<ul class="list_tup">([\s\S]*?)<\/ul>/);
  if (!listMatch) return records;

  const liRe = /<li>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = liRe.exec(listMatch[1]))) {
    const block = m[1];
    const a = block.match(/<a[^>]+href="([^"]+)"[^>]+title="([^"]*)"/);
    const text = strip(block);
    const record = {
      source: 'CNKI knavi',
      major_category: category.title,
      major_code: category.code,
      page,
      title: a ? decodeHtml(a[2]).trim() : '',
      detail_url: a ? decodeHtml(a[1]).trim() : '',
      compound_if: (text.match(/复合影响因子：\s*([0-9.]+)/) || [])[1] || '',
      comprehensive_if: (text.match(/综合影响因子：\s*([0-9.]+)/) || [])[1] || '',
      issn: (text.match(/ISSN：\s*([0-9Xx-]+)/) || [])[1] || '',
      cn: (text.match(/CN：\s*([^ ]+)/) || [])[1] || '',
      sponsor: (text.match(/主办单位：\s*(.*)$/) || [])[1] || '',
      tags: [...block.matchAll(/<span>([\s\S]*?)<\/span>/g)].map((x) => strip(x[1])).filter(Boolean),
    };
    if (record.title) records.push(record);
  }
  return records;
}

async function getChromeTab() {
  const tabs = await fetch('http://127.0.0.1:9223/json').then((r) => r.json());
  const tab = tabs.find((t) => t.type === 'page' && t.title.includes('出版来源导航'));
  if (!tab) throw new Error('CNKI Chrome tab not found. Keep the verified CNKI tab open.');
  return tab;
}

function connect(wsUrl) {
  let seq = 0;
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const searchIds = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(String(data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      return;
    }
    if (msg.method === 'Network.responseReceived' && msg.params.response.url.includes('/knavi/journals/searchbaseinfo')) {
      searchIds.push(msg.params.requestId);
    }
  });

  const opened = new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  async function send(method, params = {}) {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function latestBody() {
    const id = searchIds[searchIds.length - 1];
    if (!id) return '';
    try {
      return (await send('Network.getResponseBody', { requestId: id })).body;
    } catch {
      return '';
    }
  }

  function resetSearchIds() {
    searchIds.length = 0;
  }

  return { ws, opened, send, latestBody, resetSearchIds };
}

async function scrapeCategory(category) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${category.code}.json`);
  if (fs.existsSync(outPath)) {
    const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    return { category, skipped: true, records: existing.records.length };
  }

  const tab = await getChromeTab();
  const cdp = connect(tab.webSocketDebuggerUrl);
  await cdp.opened;
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  const records = [];
  const pages = [];

  cdp.resetSearchIds();
  await cdp.send('Runtime.evaluate', {
    expression: `Submit.naviSearch("JSTMWT6S","CCL","${category.code}",${JSON.stringify(category.title)},document.querySelector('#leftnavi a[value="${category.code}"]')); true`,
    returnByValue: true,
  });
  await sleep(2400);
  let body = await cdp.latestBody();
  let rows = parsePage(body, category, 1);
  records.push(...rows);
  const pageCount = Number((body.match(/id="lblPageCount">\s*(\d+)/) || [])[1] || Math.ceil(category.count / 21));
  pages.push({ page: 1, rows: rows.length, pageCount });

  for (let page = 2; page <= pageCount; page++) {
    cdp.resetSearchIds();
    await cdp.send('Runtime.evaluate', { expression: `Submit.pageTurn(${page}); true`, returnByValue: true });
    await sleep(950);
    body = await cdp.latestBody();
    rows = parsePage(body, category, page);
    records.push(...rows);
    pages.push({ page, rows: rows.length, pageCount });
  }

  cdp.ws.close();
  fs.writeFileSync(outPath, JSON.stringify({ category, pages, records }, null, 2), 'utf8');
  return { category, skipped: false, pages: pages.length, records: records.length };
}

function mergeParts() {
  const all = [];
  for (const category of MAJORS) {
    const partPath = path.join(OUT_DIR, `${category.code}.json`);
    if (!fs.existsSync(partPath)) continue;
    all.push(...JSON.parse(fs.readFileSync(partPath, 'utf8')).records);
  }

  const byKey = new Map();
  for (const r of all) {
    const key = `${r.issn || ''}|${r.title}`;
    const prev = byKey.get(key);
    if (prev) {
      const cats = new Set([...(prev.major_categories || [prev.major_category]), r.major_category]);
      prev.major_categories = [...cats];
      if (!prev.cn && r.cn) prev.cn = r.cn;
      if (!prev.sponsor && r.sponsor) prev.sponsor = r.sponsor;
    } else {
      byKey.set(key, { ...r, major_categories: [r.major_category] });
    }
  }

  const dedup = [...byKey.values()].sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh-Hans-CN'));
  fs.writeFileSync(FINAL_JSON, JSON.stringify(dedup, null, 2), 'utf8');
  const csv = ['title,issn,cn,sponsor,compound_if,comprehensive_if,tags,major_categories,detail_url']
    .concat(
      dedup.map((r) =>
        [r.title, r.issn, r.cn, r.sponsor, r.compound_if, r.comprehensive_if, r.tags.join('|'), r.major_categories.join('|'), r.detail_url]
          .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
          .join(',')
      )
    )
    .join('\n');
  fs.writeFileSync(FINAL_CSV, `\ufeff${csv}`, 'utf8');
  return { raw: all.length, dedup: dedup.length };
}

(async () => {
  const wanted = process.argv[2] ? MAJORS.filter((x) => x.code === process.argv[2].toUpperCase()) : MAJORS;
  for (const category of wanted) {
    const result = await scrapeCategory(category);
    console.log(JSON.stringify(result));
  }
  console.log(JSON.stringify({ merged: mergeParts() }));
})().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
