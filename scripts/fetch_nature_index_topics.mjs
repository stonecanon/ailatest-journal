import { writeFile } from 'node:fs/promises';

const BASE = 'https://www.nature.com';
const PAGE_URL = `${BASE}/nature-index/topics/institution-tables/global/all/`;
const API_URL = `${BASE}/nature-index/topics-institutions-api`;
const OUT = new URL('../data/nature_index_topic_institutions.json', import.meta.url);
const ROW_LIMIT = 30;
const CONCURRENCY = 2;

const MONTHS = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(text) {
  const match = String(text || '').match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) return '';
  const [, day, month, year] = match;
  const mm = MONTHS[month.toLowerCase()];
  return mm ? `${year}-${mm}-${day.padStart(2, '0')}` : '';
}

async function fetchText(url, attempts = 6) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          accept: 'text/html,application/json,text/plain,*/*',
          'user-agent': 'Mozilla/5.0 AILatestJournalBot/1.0',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      await new Promise(resolve => setTimeout(resolve, 1200 * (i + 1)));
    }
  }
  throw lastError;
}

function parseTimeFrame(html) {
  const match = html.match(/Time frame:\s*([^<\n]+?-\s*[^<\n]+)/i);
  const label = match ? decodeHtml(match[1]) : '1 February 2025 - 31 January 2026';
  const [startText, endText] = label.split(/\s+-\s+/);
  return {
    label,
    start: parseDate(startText) || '2025-02-01',
    end: parseDate(endText) || '2026-01-31',
  };
}

function parseApiDates(html) {
  const startDate = html.match(/startDate:\s*"([^"]+)"/)?.[1] || new Date().toISOString().slice(0, 10);
  const endDate = html.match(/endDate:\s*"([^"]+)"/)?.[1] || startDate;
  return { startDate, endDate };
}

function parseTopics(html) {
  const select = html.match(/<select id="institution-criteria_topic"[\s\S]*?<\/select>/i)?.[0];
  if (!select) throw new Error('Could not find Nature Index topic select');
  const topics = [];
  const groups = [...select.matchAll(/<optgroup[^>]*label="([^"]+)"[^>]*>([\s\S]*?)<\/optgroup>/gi)];
  for (const groupMatch of groups) {
    const group = decodeHtml(groupMatch[1]);
    const optionHtml = groupMatch[2];
    for (const opt of optionHtml.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi)) {
      const slug = decodeHtml(opt[1]);
      const label = decodeHtml(opt[2].replace(/<[^>]+>/g, ''));
      if (slug && label) topics.push({ slug, label, group });
    }
  }
  if (!topics.length) throw new Error('No Nature Index topics found');
  return topics;
}

function dataTablesParams(topic, apiDates) {
  const params = new URLSearchParams({
    draw: '1',
    start: '0',
    length: String(ROW_LIMIT),
    region: 'global',
    topic,
    sector: 'all',
    startDate: apiDates.startDate,
    endDate: apiDates.endDate,
  });
  ['rank', 'name', 'count', 'share'].forEach((column, i) => {
    params.set(`columns[${i}][data]`, column);
    params.set(`columns[${i}][name]`, '');
    params.set(`columns[${i}][searchable]`, 'true');
    params.set(`columns[${i}][orderable]`, 'true');
    params.set(`columns[${i}][search][value]`, '');
    params.set(`columns[${i}][search][regex]`, 'false');
  });
  params.set('order[0][column]', '3');
  params.set('order[0][dir]', 'desc');
  return params;
}

function absoluteUrl(path) {
  if (!path) return '';
  return new URL(path, BASE).toString();
}

async function fetchTopic(topic, apiDates) {
  const text = await fetchText(`${API_URL}?${dataTablesParams(topic.slug, apiDates)}`);
  const json = JSON.parse(text);
  const rows = Array.isArray(json.data) ? json.data.slice(0, ROW_LIMIT).map(row => ({
    rank: Number(row.rank),
    institution: String(row.name || '').trim(),
    country: String(row.country || '').trim(),
    count: Number(row.count),
    share: Number(row.share),
    profile_url: absoluteUrl(row.profile_link),
    articles_url: absoluteUrl(row.article_list_link),
  })) : [];
  for (const row of rows) {
    if (!Number.isFinite(row.rank) || !row.institution || !Number.isFinite(row.count) || !Number.isFinite(row.share)) {
      throw new Error(`Invalid row for ${topic.slug}: ${JSON.stringify(row)}`);
    }
  }
  return {
    ...topic,
    source_url: `${BASE}/nature-index/topics/institution-tables/global/all/${topic.slug}`,
    total_results: Number(json.recordsFiltered || json.recordsTotal || rows.length),
    rows,
  };
}

async function mapLimited(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const html = await fetchText(PAGE_URL);
const timeFrame = parseTimeFrame(html);
const apiDates = parseApiDates(html);
const topics = parseTopics(html);

console.log(`Found ${topics.length} Nature Index topics. Fetching Top ${ROW_LIMIT} rows each...`);
const topicRows = await mapLimited(topics, CONCURRENCY, async (topic, index) => {
  const result = await fetchTopic(topic, apiDates);
  console.log(`${String(index + 1).padStart(2, '0')}/${topics.length} ${topic.slug}: ${result.rows.length}`);
  return result;
});

if (topicRows.length < 80) throw new Error(`Unexpectedly low topic count: ${topicRows.length}`);
for (const topic of topicRows) {
  if (topic.rows.length > ROW_LIMIT) throw new Error(`Too many rows for ${topic.slug}`);
}

const data = {
  schema_version: 1,
  retrieved_at: new Date().toISOString(),
  source: {
    name: 'Nature Index',
    page_url: PAGE_URL,
    api_url: API_URL,
    license: {
      label: 'CC BY-NC-SA 4.0',
      url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      applies_to: 'Numerical information in the Nature Index tables.',
    },
  },
  time_frame: timeFrame,
  api_dates: apiDates,
  region: 'global',
  sector: 'all',
  row_limit: ROW_LIMIT,
  topic_count: topicRows.length,
  topics: topicRows,
};

await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Wrote ${OUT.pathname}`);
