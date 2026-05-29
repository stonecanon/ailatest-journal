#!/usr/bin/env node
/**
 * Slow ScienceDirect review-cycle crawler using an already-open Chrome instance.
 *
 * It connects to Chrome DevTools Protocol on http://127.0.0.1:9223, visits
 * ScienceDirect article pages, extracts Received/Accepted dates, and saves
 * after every article attempt. Designed to be deliberately slow and to stop
 * immediately when a captcha/robot page appears.
 */
const fs = require('fs');
const path = require('path');
const WebSocket = require(process.env.WS_MODULE || 'C:/Users/dell/AppData/Local/Temp/codex-cdp-ws/node_modules/ws');

const ROOT = path.resolve(__dirname, '..');
const TARGET_FILE = path.join(ROOT, 'data', 'target_journals_3fields.json');
const OUTPUT_FILE = path.join(ROOT, 'data', 'sd_review_cycles_sciencedirect.json');
const PROGRESS_FILE = path.join(ROOT, 'data', 'sd_review_cycles_progress.json');
const LOG_FILE = path.join(ROOT, 'logs', 'sd_review_cycles_cdp.log');

const MAX_ARTICLES_PER_JOURNAL = Number(process.env.SD_MAX_ARTICLES || 30);
const YEARS_BACK = Number(process.env.SD_YEARS_BACK || 3);
const MIN_DELAY_MS = Number(process.env.SD_MIN_DELAY_MS || 60_000);
const MAX_DELAY_MS = Number(process.env.SD_MAX_DELAY_MS || 120_000);
const JOURNAL_DELAY_MS = Number(process.env.SD_JOURNAL_DELAY_MS || 180_000);
const NAV_TIMEOUT_MS = Number(process.env.SD_NAV_TIMEOUT_MS || 45_000);
const CROSSREF_USER_AGENT = 'AILatest-Journal/1.0 (mailto:43259074+stonecanon@users.noreply.github.com)';

const SCIENCEDIRECT_PUBLISHER_RE = /(elsevier|pergamon|keai|cell press|academic press)/i;

function ensureDirs() {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`, 'utf8');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(min = MIN_DELAY_MS, max = MAX_DELAY_MS) {
  return min + Math.floor(Math.random() * Math.max(1, max - min));
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function isScienceDirectTarget(journal) {
  return SCIENCEDIRECT_PUBLISHER_RE.test(journal.publisher || '');
}

async function getChromeTab() {
  const tabs = await fetch('http://127.0.0.1:9223/json').then((r) => r.json());
  let tab = tabs.find((t) => t.type === 'page' && /sciencedirect\.com/.test(t.url));
  tab ||= tabs.find((t) => t.type === 'page' && !String(t.url || '').startsWith('chrome-extension:'));
  if (!tab) throw new Error('No controllable Chrome tab found on port 9223.');
  return tab;
}

function connect(wsUrl) {
  let seq = 0;
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const lifecycle = new Set();

  ws.on('message', (data) => {
    const msg = JSON.parse(String(data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      return;
    }
    if (msg.method === 'Page.lifecycleEvent') lifecycle.add(msg.params.name);
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

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result.value;
  }

  async function navigate(url) {
    lifecycle.clear();
    await send('Page.navigate', { url });
    const started = Date.now();
    while (Date.now() - started < NAV_TIMEOUT_MS) {
      if (lifecycle.has('DOMContentLoaded') || lifecycle.has('networkAlmostIdle')) return;
      await sleep(500);
    }
  }

  return { ws, opened, send, evaluate, navigate };
}

async function getDoisFromCrossref(issn, rows = MAX_ARTICLES_PER_JOURNAL) {
  const thisYear = new Date().getFullYear();
  const fromDate = `${thisYear - YEARS_BACK}-01-01`;
  const url = `https://api.crossref.org/journals/${encodeURIComponent(issn)}/works?rows=${rows}&filter=from-pub-date:${fromDate}&sort=published&order=desc`;
  const res = await fetch(url, { headers: { 'User-Agent': CROSSREF_USER_AGENT } });
  if (!res.ok) throw new Error(`CrossRef ${res.status}`);
  const data = await res.json();
  return (data.message?.items || []).map((item) => item.DOI).filter(Boolean).slice(0, rows);
}

function parseDateToDays(received, accepted) {
  if (!received || !accepted) return null;
  const rec = Date.parse(received);
  const acc = Date.parse(accepted);
  if (!Number.isFinite(rec) || !Number.isFinite(acc) || acc <= rec) return null;
  const days = Math.round((acc - rec) / 86_400_000);
  return days > 0 && days < 1500 ? days : null;
}

function articleTimeline(article) {
  return {
    received: article.received || '',
    revised: article.revised || '',
    accepted: article.accepted || '',
    available_online: article.available_online || '',
    version_of_record: article.version_of_record || '',
    published: article.published || article.version_of_record || article.available_online || '',
  };
}

function summarizeDays(journal, daysList, attempts, notes = {}) {
  if (!daysList.length) {
    return {
      name: journal.name,
      issn: journal.issn,
      eissn: journal.eissn || '',
      source: 'Elsevier/ScienceDirect (Chrome CDP)',
      n: 0,
      attempts,
      error: notes.error || 'no_dates_found',
      updated: new Date().toISOString().slice(0, 10),
    };
  }
  const sorted = [...daysList].sort((a, b) => a - b);
  const n = sorted.length;
  const median = n % 2 ? sorted[(n - 1) / 2] : Math.round((sorted[n / 2 - 1] + sorted[n / 2]) / 2);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  return {
    name: journal.name,
    issn: journal.issn,
    eissn: journal.eissn || '',
    source: 'Elsevier/ScienceDirect (Chrome CDP)',
    n,
    attempts,
    median_days: median,
    mean_days: Math.round(mean * 10) / 10,
    min_days: sorted[0],
    max_days: sorted[sorted.length - 1],
    updated: new Date().toISOString().slice(0, 10),
  };
}

async function extractArticle(cdp) {
  return cdp.evaluate(`(() => {
    const text = document.body?.innerText || '';
    const lower = text.toLowerCase();
    const robot = /are you a robot|captcha|please confirm you are a human|reference number/.test(lower);
    const problem = /problem providing|access denied|temporarily unavailable/.test(lower);
    const metas = [...document.querySelectorAll('meta')].map((m) => ({
      name: String(m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase(),
      content: String(m.getAttribute('content') || '').trim(),
    }));
    const findMeta = (keys) => {
      const m = metas.find((x) => keys.some((k) => x.name.includes(k)));
      return m ? m.content : '';
    };
    let received = findMeta(['citation_received', 'citation_date_received']);
    let revised = findMeta(['citation_revised', 'citation_date_revised']);
    let accepted = findMeta(['citation_accepted', 'citation_date_accepted']);
    let available_online = findMeta(['citation_online_date', 'citation_available_online']);
    let version_of_record = findMeta(['citation_publication_date', 'citation_cover_date']);
    let published = findMeta(['citation_publication_date', 'citation_online_date']);
    if (!received) {
      const m = text.match(/Received\\s+([0-9]{1,2}\\s+[A-Za-z]+\\s+[0-9]{4})/i);
      if (m) received = m[1];
    }
    if (!revised) {
      const m = text.match(/Revised\\s+([0-9]{1,2}\\s+[A-Za-z]+\\s+[0-9]{4})/i);
      if (m) revised = m[1];
    }
    if (!accepted) {
      const m = text.match(/Accepted\\s+([0-9]{1,2}\\s+[A-Za-z]+\\s+[0-9]{4})/i);
      if (m) accepted = m[1];
    }
    if (!available_online) {
      const m = text.match(/Available online\\s+([0-9]{1,2}\\s+[A-Za-z]+\\s+[0-9]{4})/i);
      if (m) available_online = m[1];
    }
    if (!version_of_record) {
      const m = text.match(/Version of Record\\s+([0-9]{1,2}\\s+[A-Za-z]+\\s+[0-9]{4})/i);
      if (m) version_of_record = m[1];
    }
    if (!published) published = version_of_record || available_online;
    return {
      title: document.title,
      url: location.href,
      robot,
      problem,
      received,
      revised,
      accepted,
      available_online,
      version_of_record,
      published,
      snippet: text.slice(0, 240),
    };
  })()`);
}

function shouldSkip(output, journal) {
  const rec = output[journal.issn] || (journal.eissn ? output[journal.eissn] : null);
  return rec && (rec.median_days || rec.error === 'no_dois' || rec.error === 'not_sciencedirect_target');
}

async function crawl() {
  ensureDirs();
  const targets = readJson(TARGET_FILE, []);
  const output = readJson(OUTPUT_FILE, {});
  const progress = readJson(PROGRESS_FILE, {
    started: new Date().toISOString(),
    last_update: null,
    completed: [],
    stopped: false,
  });

  const sdTargets = targets.filter(isScienceDirectTarget);
  log(`Targets: ${targets.length}; ScienceDirect-like: ${sdTargets.length}; output: ${OUTPUT_FILE}`);
  log(`Delay per article: ${Math.round(MIN_DELAY_MS / 1000)}-${Math.round(MAX_DELAY_MS / 1000)}s; max articles/journal: ${MAX_ARTICLES_PER_JOURNAL}`);

  const tab = await getChromeTab();
  const cdp = connect(tab.webSocketDebuggerUrl);
  await cdp.opened;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.setLifecycleEventsEnabled', { enabled: true });

  try {
    for (let ji = 0; ji < sdTargets.length; ji++) {
      const journal = sdTargets[ji];
      if (shouldSkip(output, journal)) {
        log(`[${ji + 1}/${sdTargets.length}] skip existing ${journal.name}`);
        continue;
      }

      log(`[${ji + 1}/${sdTargets.length}] journal ${journal.name} (${journal.issn})`);
      let dois = [];
      let crossrefFailed = false;
      try {
        dois = await getDoisFromCrossref(journal.issn);
      } catch (err) {
        crossrefFailed = true;
        log(`  CrossRef failed: ${err.message}`);
      }
      if (!dois.length && journal.eissn) {
        try {
          crossrefFailed = false;
          dois = await getDoisFromCrossref(journal.eissn);
        } catch (err) {
          crossrefFailed = true;
          log(`  CrossRef eISSN failed: ${err.message}`);
        }
      }

      if (!dois.length) {
        output[journal.issn] = summarizeDays(journal, [], 0, { error: crossrefFailed ? 'crossref_failed' : 'no_dois' });
        writeJson(OUTPUT_FILE, output);
        progress.last_update = new Date().toISOString();
        progress.current_journal = journal;
        progress.completed = Object.keys(output);
        writeJson(PROGRESS_FILE, progress);
        if (crossrefFailed) {
          log(`  CrossRef unavailable; pausing ${Math.round(JOURNAL_DELAY_MS / 1000)}s before next journal`);
          await sleep(JOURNAL_DELAY_MS);
        }
        continue;
      }

      const daysList = [];
      const articleLogs = [];
      for (let i = 0; i < dois.length; i++) {
        const doi = dois[i];
        const url = `https://doi.org/${encodeURIComponent(doi)}`;
        log(`  [${i + 1}/${dois.length}] ${doi}`);
        let article;
        try {
          await cdp.navigate(url);
          await sleep(6_000);
          article = await extractArticle(cdp);
        } catch (err) {
          article = { error: err.message, url };
        }

        if (article.robot) {
          log('  STOP: ScienceDirect showed captcha/robot page. Saving and exiting.');
          progress.stopped = true;
          progress.stop_reason = 'captcha';
          progress.last_update = new Date().toISOString();
          progress.current_journal = journal;
          progress.current_doi = doi;
          writeJson(PROGRESS_FILE, progress);
          writeJson(OUTPUT_FILE, output);
          return;
        }

        const days = parseDateToDays(article.received, article.accepted);
        if (days) daysList.push(days);
        articleLogs.push({
          doi,
          title: article.title || '',
          url: article.url || url,
          ...articleTimeline(article),
          days,
          error: article.error || '',
        });

        output[journal.issn] = {
          ...summarizeDays(journal, daysList, i + 1),
          articles: articleLogs,
        };
        progress.last_update = new Date().toISOString();
        progress.current_journal = journal;
        progress.current_article_index = i + 1;
        progress.completed = Object.keys(output);
        writeJson(OUTPUT_FILE, output);
        writeJson(PROGRESS_FILE, progress);

        log(`    result: ${days ? `${days} days` : 'no date'}; saved ${daysList.length}/${i + 1}`);
        if (i < dois.length - 1) {
          const delay = jitter();
          log(`    sleeping ${Math.round(delay / 1000)}s`);
          await sleep(delay);
        }
      }

      output[journal.issn] = {
        ...summarizeDays(journal, daysList, dois.length),
        articles: articleLogs,
      };
      writeJson(OUTPUT_FILE, output);
      progress.completed = Object.keys(output);
      progress.last_update = new Date().toISOString();
      delete progress.current_journal;
      delete progress.current_article_index;
      writeJson(PROGRESS_FILE, progress);

      log(`  done ${journal.name}: n=${daysList.length}`);
      if (ji < sdTargets.length - 1) {
        log(`  journal pause ${Math.round(JOURNAL_DELAY_MS / 1000)}s`);
        await sleep(JOURNAL_DELAY_MS);
      }
    }
  } finally {
    cdp.ws.close();
  }
}

crawl().catch((err) => {
  ensureDirs();
  log(`FATAL: ${err.stack || err.message}`);
  process.exit(1);
});
