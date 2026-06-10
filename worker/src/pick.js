/**
 * /pick — semantic journal recommendation via DeepSeek + local journals.json.gz.
 *
 * DeepSeek only extracts a structured research profile. Ranking is computed
 * against the local journal database so results stay auditable and clickable.
 */

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
const DEFAULT_JOURNALS_URL = 'https://journal.ailatest.org/data/journals.json.gz';

let journalsCache = null;
let journalsLoadPromise = null;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function cleanText(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || min));
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v).trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TERM_STOPS = new Set('and of the for in on to with by from studies study science sciences research journal journals'.split(' '));

function termHit(haystack, term) {
  const hay = norm(haystack);
  const t = norm(term);
  if (!hay || !t || t.length < 3) return false;
  if (hay.includes(t)) return true;
  const words = t.split(' ').filter(w => w.length > 2 && !TERM_STOPS.has(w));
  return words.length > 1 && words.every(w => hay.includes(w));
}

function unique(values, max = 24) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const raw = String(value || '').trim();
    const key = norm(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

function journalSubjectParts(j) {
  const parts = [
    ...(j.wos_categories || []),
    ...(j.jcr_cats || []),
    ...(j.ei_subjects || []),
    j.jcr_cat,
    j.esi_category,
    j.cas_major_cat,
    j.cas_major_cn,
    j.ccf_area,
    j.cnki_major,
    ...(j.cas_sub_cats || []).map(x => x && x.name),
    ...(j.cnkx || []).map(x => x && x.domain),
    ...(j.scopus && Array.isArray(j.scopus.asjc_top) ? j.scopus.asjc_top : []),
  ];
  return parts.filter(Boolean);
}

function journalNameParts(j) {
  return [j.name, j.cn_name, j.abbr20, j.publisher, j.country].filter(Boolean);
}

async function loadJournals(env) {
  if (journalsCache) return journalsCache;
  if (!journalsLoadPromise) {
    journalsLoadPromise = (async () => {
      const url = env.JOURNALS_URL || DEFAULT_JOURNALS_URL;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`journal data ${res.status}`);
      const text = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('journal data is not an array');
      journalsCache = data;
      return journalsCache;
    })();
  }
  return journalsLoadPromise;
}

async function deepseekChat(apiKey, messages, tools) {
  const body = {
    model: 'deepseek-chat',
    messages,
    temperature: 0.05,
    max_tokens: 900,
    tools,
    tool_choice: 'auto',
  };
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 240)}`);
  return res.json();
}

function semanticTool() {
  return {
    type: 'function',
    function: {
      name: 'extract_journal_recommendation_profile',
      description: 'Extract a semantic research profile for journal recommendation. Disambiguate broad words by context.',
      parameters: {
        type: 'object',
        properties: {
          research_fields: {
            type: 'array',
            items: { type: 'string' },
            description: '2-6 semantic fields, e.g. economic geography, regional science, transportation economics.',
          },
          wos_categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Likely Web of Science categories, e.g. Geography, Transportation, Regional & Urban Planning.',
          },
          target_indices: {
            type: 'array',
            items: { type: 'string', enum: ['SCIE', 'SSCI', 'ESCI', 'AHCI'] },
            description: 'Likely target indexes for the paper.',
          },
          domain_keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Domain-specific matching keywords. Avoid ambiguous method/process-only words.',
          },
          negative_keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fields/journal topics to penalize because they are false senses of ambiguous words.',
          },
          explanation: {
            type: 'string',
            description: 'One short Chinese explanation of the interpretation.',
          },
        },
        required: ['research_fields', 'wos_categories', 'target_indices', 'domain_keywords', 'negative_keywords'],
      },
    },
  };
}

function heuristicProfile(query) {
  const q = norm(query);
  const fields = [];
  const wos = [];
  const keywords = [];
  const negatives = [];

  if (q.includes('low altitude') || q.includes('低空')) {
    fields.push('economic geography', 'transportation economics', 'regional science', 'urban and regional planning');
    wos.push('Geography', 'Transportation', 'Regional & Urban Planning', 'Economics', 'Urban Studies', 'Planning & Development');
    keywords.push('low-altitude economy', 'regional economy', 'transportation', 'spatial structure', 'regional network');
  }
  if (q.includes('econom') || q.includes('经济')) {
    fields.push('economics', 'regional economics');
    wos.push('Economics', 'Business', 'Management');
    keywords.push('economy', 'economic development');
  }
  if (q.includes('network') && (q.includes('econom') || q.includes('regional') || q.includes('geograph'))) {
    negatives.push('computer network', 'wireless communications', 'telecommunications', 'ad hoc network', 'sensor network');
  }
  if (q.includes('urban') || q.includes('city') || q.includes('城市')) {
    fields.push('urban studies', 'urban planning');
    wos.push('Urban Studies', 'Regional & Urban Planning', 'Geography');
    keywords.push('urban', 'city', 'planning');
  }
  return {
    research_fields: unique(fields.length ? fields : ['interdisciplinary research']),
    wos_categories: unique(wos),
    target_indices: unique(q.includes('social') || q.includes('econom') || q.includes('urban') ? ['SSCI', 'SCIE', 'ESCI'] : ['SCIE', 'SSCI', 'ESCI']),
    domain_keywords: unique(keywords.length ? keywords : q.split(' ').filter(w => w.length > 3).slice(0, 8)),
    negative_keywords: unique(negatives),
    explanation: '已使用启发式语义画像作为 AI 解析兜底。',
  };
}

function normalizeProfile(profile, query) {
  const base = profile && typeof profile === 'object' ? profile : heuristicProfile(query);
  const out = {
    research_fields: unique(asArray(base.research_fields)),
    wos_categories: unique(asArray(base.wos_categories)),
    target_indices: unique(asArray(base.target_indices).map(s => s.toUpperCase()).filter(s => ['SCIE', 'SSCI', 'ESCI', 'AHCI'].includes(s))),
    domain_keywords: unique(asArray(base.domain_keywords)),
    negative_keywords: unique(asArray(base.negative_keywords)),
    explanation: cleanText(base.explanation || '', 300),
  };
  const q = norm(query);
  if (q.includes('network') && (q.includes('econom') || q.includes('regional') || q.includes('geograph'))) {
    out.negative_keywords = unique([
      ...out.negative_keywords,
      'computer network',
      'wireless communications',
      'telecommunications',
      'ad hoc network',
      'sensor network',
    ]);
  }
  if (!out.research_fields.length && !out.wos_categories.length && !out.domain_keywords.length) {
    return heuristicProfile(query);
  }
  return out;
}

async function extractProfile(apiKey, query) {
  try {
    const res = await deepseekChat(apiKey, [
      {
        role: 'system',
        content: `你是学术期刊荐刊系统的语义解析器。请把论文标题/摘要转成期刊匹配画像，而不是做普通关键词抽取。

关键要求：
- 识别研究对象和学科语境，过滤掉 formation、mechanism、structure、network 等通用/歧义词的错误含义。
- domain_keywords 要使用能匹配期刊学科的词，如 economic geography、regional science、transportation economics。
- negative_keywords 用于排除歧义方向。
- 如果标题是 "China's Low-Altitude Economy Network: A Study on Structural Characteristics and Formation Mechanisms"，network 指区域/经济空间网络，不是 computer networks / wireless communications；应推荐 Geography、Transportation、Regional & Urban Planning、Economics、Urban Studies 等方向，并把 computer network、telecommunications、wireless communications 放入 negative_keywords。
- 只调用函数，不要输出普通文本。`,
      },
      { role: 'user', content: query },
    ], [semanticTool()]);
    const msg = res?.choices?.[0]?.message;
    const call = msg?.tool_calls?.[0];
    if (call?.function?.name === 'extract_journal_recommendation_profile') {
      return normalizeProfile(JSON.parse(call.function.arguments || '{}'), query);
    }
  } catch (e) {
    console.warn('pick semantic extraction fallback:', e?.message || e);
  }
  return heuristicProfile(query);
}

function scoreJournal(j, profile) {
  const subjectText = journalSubjectParts(j).join(' | ');
  const nameText = journalNameParts(j).join(' | ');
  let score = 0;
  const matched = [];

  for (const cat of profile.wos_categories || []) {
    if (termHit(subjectText, cat)) {
      score += 24;
      matched.push(cat);
    } else if (termHit(nameText, cat)) {
      score += 8;
      matched.push(cat);
    }
  }
  for (const field of profile.research_fields || []) {
    if (termHit(subjectText, field)) {
      score += 18;
      matched.push(field);
    } else if (termHit(nameText, field)) {
      score += 9;
      matched.push(field);
    }
  }
  for (const kw of profile.domain_keywords || []) {
    if (termHit(subjectText, kw)) {
      score += 10;
      matched.push(kw);
    } else if (termHit(nameText, kw)) {
      score += 5;
      matched.push(kw);
    }
  }

  const negHits = [];
  for (const neg of profile.negative_keywords || []) {
    if (termHit(subjectText, neg) || termHit(nameText, neg)) {
      score -= 32;
      negHits.push(neg);
    }
  }

  const idx = j.indices || [];
  const target = profile.target_indices || [];
  if (target.length && idx.some(i => target.includes(i))) score += 5;
  if (target.length && idx.length && !idx.some(i => target.includes(i))) score -= 4;
  if (j.if_quartile === 'Q1') score += 5;
  else if (j.if_quartile === 'Q2') score += 3;
  if (j.cas_zone === 1) score += 5;
  else if (j.cas_zone === 2) score += 3;
  if (j.cas_top) score += 2;
  if (Number(j.if_2024) > 0) score += Math.min(4, Math.log1p(Number(j.if_2024)));
  if (j.warning || j.citic_warning || j.on_hold || j.under_review) score *= 0.65;
  if (negHits.length) score *= 0.45;

  return { score, matched: unique(matched, 10), negHits };
}

function hasDoajNoApc(j) {
  const doaj = j && typeof j.doaj === 'object' ? j.doaj : null;
  return String(doaj?.apc || '').trim().toLowerCase() === 'no';
}

function passesFilters(j, filters) {
  const idx = j.indices || [];
  const requested = asArray(filters?.indices).map(s => s.toUpperCase());
  if (requested.length && !requested.some(i => idx.includes(i))) return false;
  if (filters?.exclude_multidisciplinary && (j.wos_categories || []).some(c => /multidisciplinary/i.test(c))) return false;
  if (filters?.free && !hasDoajNoApc(j)) return false;
  return true;
}

function rankJournals(journals, profile, filters, limit) {
  const scored = [];
  for (const j of journals) {
    if (!passesFilters(j, filters)) continue;
    const s = scoreJournal(j, profile);
    if (s.score <= 5 || !s.matched.length) continue;
    scored.push({ j, ...s });
  }
  scored.sort((a, b) => b.score - a.score || (b.j.if_2024 || 0) - (a.j.if_2024 || 0));
  const maxScore = scored[0]?.score || 1;
  return scored.slice(0, limit).map(row => {
    const j = row.j;
    return {
      name: j.name || '',
      issn: j.issn || '',
      eissn: j.eissn || '',
      slug: j.slug || '',
      score: Math.max(1, Math.round(row.score / maxScore * 100)),
      matched: row.matched,
      topics: unique([...(j.wos_categories || []), j.esi_category, j.cas_major_cn].filter(Boolean), 6),
      if_2024: j.if_2024 ?? null,
      if_quartile: j.if_quartile || '',
      cas_zone: j.cas_zone || '',
      cas_top: !!j.cas_top,
      indices: j.indices || [],
      publisher: j.publisher || '',
      doaj: j.doaj && typeof j.doaj === 'object' ? j.doaj : null,
      warning: !!(j.warning || j.citic_warning || j.on_hold || j.under_review),
    };
  });
}

export async function handlePick(req, env, opts = {}) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return json({ ok: false, error: 'AI service not configured' }, 503);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const query = cleanText(body?.query || body?.title || '', 4000);
  if (!query || query.length < 6) return json({ ok: false, error: 'Query required' }, 400);

  let journals;
  try {
    journals = await loadJournals(env);
  } catch (e) {
    return json({ ok: false, error: `Data load failed: ${e.message}` }, 500);
  }

  let quota = null;
  if (typeof opts.consumeQuota === 'function') {
    const q = await opts.consumeQuota();
    if (!q.ok) return q.response;
    quota = q.quota;
  }

  const limit = clamp(body?.limit || 120, 20, 160);
  const profile = await extractProfile(apiKey, query);
  const filters = body?.filters && typeof body.filters === 'object' ? body.filters : {};
  const results = rankJournals(journals, profile, filters, limit);

  return json({
    ok: true,
    mode: 'ai',
    profile,
    results,
    total: results.length,
    shown: results.length,
    quota,
  });
}
