const fs = require('fs');
const path = require('path');
const WebSocket = require(process.env.WS_MODULE || 'C:/Users/dell/AppData/Local/Temp/codex-cdp-ws/node_modules/ws');

const OUT_DIR = path.resolve(__dirname, 'cnki_major_dom_parts');
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

  ws.on('message', (data) => {
    const msg = JSON.parse(String(data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
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

  return { ws, opened, send };
}

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return res.result.value;
}

async function extractPage(cdp, category, page) {
  return evaluate(
    cdp,
    `(() => {
      const clean = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
      return [...document.querySelectorAll('.list_tup > li')].map((li) => {
        const a = li.querySelector('a[title]');
        const text = clean(li.innerText);
        return {
          source: 'CNKI knavi',
          major_category: ${JSON.stringify(category.title)},
          major_code: ${JSON.stringify(category.code)},
          page: ${page},
          title: a ? clean(a.getAttribute('title')) : '',
          detail_url: a ? a.href : '',
          compound_if: (text.match(/复合影响因子：\\s*([0-9.]+)/) || [])[1] || '',
          comprehensive_if: (text.match(/综合影响因子：\\s*([0-9.]+)/) || [])[1] || '',
          issn: (text.match(/ISSN：\\s*([0-9Xx-]+)/) || [])[1] || '',
          cn: (text.match(/CN：\\s*([^ ]+)/) || [])[1] || '',
          sponsor: (text.match(/主办单位：\\s*(.*)$/) || [])[1] || '',
          tags: [...li.querySelectorAll('.detials span')].map((s) => clean(s.innerText)).filter(Boolean),
        };
      }).filter((r) => r.title);
    })()`
  );
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

  const records = [];
  const pages = [];

  await evaluate(
    cdp,
    `Submit.naviSearch("JSTMWT6S","CCL","${category.code}",${JSON.stringify(category.title)},document.querySelector('#leftnavi a[value="${category.code}"]')); true`
  );
  await sleep(2600);

  let pageCount = await evaluate(cdp, `Number(document.querySelector('#lblPageCount')?.innerText || Math.ceil(${category.count}/21))`);
  if (!pageCount || pageCount < 1) pageCount = Math.ceil(category.count / 21);

  for (let page = 1; page <= pageCount; page++) {
    if (page > 1) {
      await evaluate(cdp, `Submit.pageTurn(${page}); true`);
      await sleep(900);
    }
    const rows = await extractPage(cdp, category, page);
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
