const fs = require('fs');
const path = require('path');
const WebSocket = require(process.env.WS_MODULE || 'C:/Users/dell/AppData/Local/Temp/codex-cdp-ws/node_modules/ws');

const OUT_DIR = path.resolve(__dirname, 'cnki_leaf_parts');
const FINAL_JSON = path.resolve(__dirname, 'cnki_leaf_journals.json');
const FINAL_CSV = path.resolve(__dirname, 'cnki_leaf_journals.csv');

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
      major_category: category.major_title,
      major_code: category.major_code,
      category: category.title,
      category_code: category.code,
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
  function resetSearchIds() {
    searchIds.length = 0;
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
  return { ws, opened, send, resetSearchIds, latestBody };
}

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return res.result.value;
}

async function getLeafCategories(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const clean = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
      const majorByGuide = new Map();
      [...document.querySelectorAll('#leftnavi div.guide')].forEach((guide) => {
        const major = guide.querySelector(':scope > div.item a.click[title][value]');
        const majorTitle = major ? clean(major.getAttribute('title')) : '';
        const majorCode = major ? clean(major.getAttribute('value')) : '';
        [...guide.querySelectorAll('ul.contentbox a[title][value]')].forEach((a) => {
          const code = clean(a.getAttribute('value'));
          const title = clean(a.getAttribute('title'));
          const count = Number(a.querySelector('input[type="hidden"]')?.value || (a.innerText.match(/\\((\\d+)\\)/) || [])[1] || 0);
          if (code && title && !/^[A-J]$/.test(code)) majorByGuide.set(code, { code, title, count, major_code: majorCode, major_title: majorTitle });
        });
      });
      return [...majorByGuide.values()];
    })()`
  );
}

async function scrapeLeaf(category) {
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
  await evaluate(
    cdp,
    `Submit.naviSearch("JSTMWT6S","CCL","${category.code}",${JSON.stringify(category.title)},document.querySelector('#leftnavi a[value="${category.code}"]')); true`
  );
  await sleep(1800);
  let body = await cdp.latestBody();
  let rows = parsePage(body, category, 1);
  records.push(...rows);
  const pageCount = Number((body.match(/id="lblPageCount">\s*(\d+)/) || [])[1] || Math.ceil((category.count || rows.length) / 21) || 1);
  pages.push({ page: 1, rows: rows.length, pageCount });
  for (let page = 2; page <= pageCount; page++) {
    cdp.resetSearchIds();
    await evaluate(cdp, `Submit.pageTurn(${page}); true`);
    await sleep(700);
    body = await cdp.latestBody();
    rows = parsePage(body, category, page);
    records.push(...rows);
    pages.push({ page, rows: rows.length, pageCount });
  }
  cdp.ws.close();
  fs.writeFileSync(outPath, JSON.stringify({ category, pages, records }, null, 2), 'utf8');
  return { category, skipped: false, pages: pages.length, records: records.length };
}

function mergeParts(categories) {
  const all = [];
  for (const category of categories) {
    const partPath = path.join(OUT_DIR, `${category.code}.json`);
    if (!fs.existsSync(partPath)) continue;
    all.push(...JSON.parse(fs.readFileSync(partPath, 'utf8')).records);
  }
  const byKey = new Map();
  for (const r of all) {
    const key = `${r.issn || ''}|${r.title}`;
    const prev = byKey.get(key);
    if (prev) {
      prev.categories = [...new Set([...(prev.categories || [prev.category]), r.category])];
      prev.major_categories = [...new Set([...(prev.major_categories || [prev.major_category]), r.major_category])];
      if (!prev.issn && r.issn) prev.issn = r.issn;
      if (!prev.cn && r.cn) prev.cn = r.cn;
      if (!prev.sponsor && r.sponsor) prev.sponsor = r.sponsor;
    } else {
      byKey.set(key, { ...r, categories: [r.category], major_categories: [r.major_category] });
    }
  }
  const dedup = [...byKey.values()].sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh-Hans-CN'));
  fs.writeFileSync(FINAL_JSON, JSON.stringify(dedup, null, 2), 'utf8');
  const csv = ['title,issn,cn,sponsor,compound_if,comprehensive_if,tags,categories,major_categories,detail_url']
    .concat(dedup.map((r) => [r.title, r.issn, r.cn, r.sponsor, r.compound_if, r.comprehensive_if, r.tags.join('|'), r.categories.join('|'), r.major_categories.join('|'), r.detail_url].map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')))
    .join('\n');
  fs.writeFileSync(FINAL_CSV, `\ufeff${csv}`, 'utf8');
  return { raw: all.length, dedup: dedup.length };
}

(async () => {
  const tab = await getChromeTab();
  const cdp = connect(tab.webSocketDebuggerUrl);
  await cdp.opened;
  await cdp.send('Runtime.enable');
  const categories = await getLeafCategories(cdp);
  cdp.ws.close();
  fs.writeFileSync(path.resolve(__dirname, 'cnki_leaf_categories.json'), JSON.stringify(categories, null, 2), 'utf8');
  const wantedCode = process.argv[2] ? process.argv[2].toUpperCase() : '';
  const wanted = wantedCode ? categories.filter((x) => x.code === wantedCode) : categories;
  for (const category of wanted) {
    const result = await scrapeLeaf(category);
    console.log(JSON.stringify(result));
  }
  console.log(JSON.stringify({ categories: categories.length, merged: mergeParts(categories) }));
})().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
