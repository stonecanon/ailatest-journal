/**
 * /pick — semantic journal recommendation via DeepSeek + local journals.json.gz.
 *
 * Step 1: DeepSeek extracts a structured research profile (no heuristic fallback —
 *         if the AI call fails we refund the quota and tell the client to use
 *         local matching instead).
 * Step 2: Ranking runs against the local journal database (stemmed matching via
 *         the shared pick-match module) so results stay auditable and clickable.
 * Step 3: DeepSeek turns the top candidates into a tiered recommendation report
 *         (best-effort: ranking results are returned even if this step fails).
 */

import { CORS, json, deepseekChat, loadJournals } from './deepseek-common.js';
import PickMatch from '../../js/pick-match.js';

const { makeHay, hitHay } = PickMatch;
const DEFAULT_PICK_MODEL = 'deepseek-chat';
const DEFAULT_DEEPSEEK_CNY_PER_M_TOKEN = {
  input_cache_hit: 0.5,
  input_cache_miss: 2,
  output: 8,
};

function cleanText(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function dayFromSec(sec) {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

function metadataJson(value) {
  try {
    return JSON.stringify(value && typeof value === 'object' ? value : {});
  } catch (_) {
    return '{}';
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || min));
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v).trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

function unique(values, max = 24) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const raw = String(value || '').trim();
    const key = PickMatch.norm(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

let aiUsageTableReady = false;
async function ensureAiUsageTable(env) {
  if (aiUsageTableReady || !env?.DB) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ai_usage_events (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at        INTEGER NOT NULL,
      day               TEXT NOT NULL,
      user_id           INTEGER,
      app               TEXT,
      feature           TEXT,
      provider          TEXT,
      model             TEXT,
      range_label       TEXT,
      query_chars       INTEGER DEFAULT 0,
      terms_count       INTEGER DEFAULT 0,
      evidence_count    INTEGER DEFAULT 0,
      prompt_tokens     INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens      INTEGER DEFAULT 0,
      cache_hit_tokens  INTEGER DEFAULT 0,
      cache_miss_tokens INTEGER DEFAULT 0,
      input_cny         REAL DEFAULT 0,
      output_cny        REAL DEFAULT 0,
      total_cny         REAL DEFAULT 0,
      input_usd         REAL DEFAULT 0,
      output_usd        REAL DEFAULT 0,
      total_usd         REAL DEFAULT 0,
      latency_ms        INTEGER DEFAULT 0,
      success           INTEGER DEFAULT 1,
      error             TEXT DEFAULT '',
      metadata_json     TEXT DEFAULT '{}'
    )`
  ).run();
  const columns = [
    ['user_id', 'INTEGER'],
    ['input_cny', 'REAL DEFAULT 0'],
    ['output_cny', 'REAL DEFAULT 0'],
    ['total_cny', 'REAL DEFAULT 0'],
    ['success', 'INTEGER DEFAULT 1'],
    ['error', "TEXT DEFAULT ''"],
  ];
  for (const [name, ddl] of columns) {
    try { await env.DB.prepare(`ALTER TABLE ai_usage_events ADD COLUMN ${name} ${ddl}`).run(); } catch (_) {}
  }
  await env.DB.batch([
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_day ON ai_usage_events(day)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_app_day ON ai_usage_events(app, day)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_feature_day ON ai_usage_events(feature, day)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_day ON ai_usage_events(user_id, day)'),
  ]);
  aiUsageTableReady = true;
}

function deepseekPricing(env) {
  const read = (key, fallback) => {
    const n = Number(env?.[key]);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    input_cache_hit: read('DEEPSEEK_INPUT_CACHE_HIT_CNY_PER_M', DEFAULT_DEEPSEEK_CNY_PER_M_TOKEN.input_cache_hit),
    input_cache_miss: read('DEEPSEEK_INPUT_CACHE_MISS_CNY_PER_M', DEFAULT_DEEPSEEK_CNY_PER_M_TOKEN.input_cache_miss),
    output: read('DEEPSEEK_OUTPUT_CNY_PER_M', DEFAULT_DEEPSEEK_CNY_PER_M_TOKEN.output),
  };
}

function calcDeepseekCostCny(usage, pricing) {
  usage = usage || {};
  const prompt = Number(usage.prompt_tokens || 0);
  const completion = Number(usage.completion_tokens || 0);
  const cacheHit = Number(usage.prompt_cache_hit_tokens || usage.prompt_tokens_details?.cached_tokens || 0);
  const cacheMiss = Number(usage.prompt_cache_miss_tokens || Math.max(0, prompt - cacheHit));
  const inputCny = (cacheHit * pricing.input_cache_hit + cacheMiss * pricing.input_cache_miss) / 1000000;
  const outputCny = completion * pricing.output / 1000000;
  return {
    prompt,
    completion,
    total: Number(usage.total_tokens || (prompt + completion) || 0),
    cacheHit,
    cacheMiss,
    inputCny,
    outputCny,
    totalCny: inputCny + outputCny,
  };
}

async function recordAiUsage(env, data = {}) {
  if (!env?.DB) return;
  try {
    await ensureAiUsageTable(env);
    const now = nowSec();
    const usage = data.usage || {};
    const pricing = data.pricing || deepseekPricing(env);
    const cost = calcDeepseekCostCny(usage, pricing);
    await env.DB.prepare(
      `INSERT INTO ai_usage_events (
        created_at, day, user_id, app, feature, provider, model, range_label,
        query_chars, terms_count, evidence_count,
        prompt_tokens, completion_tokens, total_tokens,
        cache_hit_tokens, cache_miss_tokens,
        input_cny, output_cny, total_cny,
        input_usd, output_usd, total_usd,
        latency_ms, success, error, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      now,
      dayFromSec(now),
      data.userId || null,
      cleanText(data.app || 'journal', 80),
      cleanText(data.feature || 'pick', 80),
      cleanText(data.provider || 'deepseek', 40),
      cleanText(data.model || '', 80),
      cleanText(data.rangeLabel || '', 40),
      Number(data.queryChars || 0),
      Number(data.termsCount || 0),
      Number(data.evidenceCount || 0),
      cost.prompt,
      cost.completion,
      cost.total,
      cost.cacheHit,
      cost.cacheMiss,
      cost.inputCny,
      cost.outputCny,
      cost.totalCny,
      0,
      0,
      0,
      Number(data.latencyMs || 0),
      data.success === false ? 0 : 1,
      cleanText(data.error || '', 240),
      metadataJson({ usage, pricing, step: data.step || '', quota: data.quota || null }),
    ).run();
  } catch (e) {
    console.warn('ai usage record failed:', e?.message || e);
  }
}

async function trackedDeepseekChat(apiKey, messages, opts = {}, context = {}) {
  const started = Date.now();
  try {
    const res = await deepseekChat(apiKey, messages, opts);
    await recordAiUsage(context.env, {
      ...context,
      usage: res?.usage || {},
      model: res?.model || opts.model || context.model || DEFAULT_PICK_MODEL,
      latencyMs: Date.now() - started,
      success: true,
    });
    return res;
  } catch (e) {
    await recordAiUsage(context.env, {
      ...context,
      usage: {},
      model: opts.model || context.model || DEFAULT_PICK_MODEL,
      latencyMs: Date.now() - started,
      success: false,
      error: e?.message || String(e),
    });
    throw e;
  }
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

// Per-isolate haystack cache keyed on the journal object itself.
const HAYS = new WeakMap();
function journalHays(j) {
  let hays = HAYS.get(j);
  if (!hays) {
    hays = {
      subject: makeHay(journalSubjectParts(j)),
      name: makeHay(journalNameParts(j)),
    };
    HAYS.set(j, hays);
  }
  return hays;
}

// ─── Step 1: semantic profile extraction ───

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

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const out = {
    research_fields: unique(asArray(profile.research_fields)),
    wos_categories: unique(asArray(profile.wos_categories)),
    target_indices: unique(asArray(profile.target_indices).map(s => s.toUpperCase()).filter(s => ['SCIE', 'SSCI', 'ESCI', 'AHCI'].includes(s))),
    domain_keywords: unique(asArray(profile.domain_keywords)),
    negative_keywords: unique(asArray(profile.negative_keywords)),
    explanation: cleanText(profile.explanation || '', 300),
  };
  if (!out.research_fields.length && !out.wos_categories.length && !out.domain_keywords.length) return null;
  return out;
}

async function extractProfile(apiKey, query, context) {
  const res = await trackedDeepseekChat(apiKey, [
    {
      role: 'system',
      content: `你是学术期刊荐刊系统的语义解析器。请把论文标题/摘要转成期刊匹配画像，而不是做普通关键词抽取。

关键要求：
- 先识别研究对象和学科语境，再决定关键词。network、system、model、mechanism、structure 等词必须按语境消歧：
  例如经济/区域语境下的 "network" 指经济空间网络，应排除 computer networks、telecommunications 等错误方向（放入 negative_keywords）。
- domain_keywords 要使用能匹配期刊学科分类的词（如 economic geography、regional science、transportation economics），
  不要输出 formation、mechanism、analysis 这类跨学科通用方法词。
- wos_categories 给出最可能的 Web of Science 学科类目。
- 交叉学科论文请覆盖所有相关方向（如同时给出地理、交通、经济类目）。
- 只调用函数，不要输出普通文本。`,
    },
    { role: 'user', content: query },
  ], { tools: [semanticTool()], temperature: 0.05, maxTokens: 900, model: context.model }, { ...context, step: 'profile', feature: 'pick_profile' });
  const msg = res?.choices?.[0]?.message;
  const call = msg?.tool_calls?.[0];
  if (call?.function?.name === 'extract_journal_recommendation_profile') {
    return normalizeProfile(JSON.parse(call.function.arguments || '{}'));
  }
  return null;
}

// ─── Step 2: local ranking against the profile ───

function scoreJournal(j, profile) {
  const hays = journalHays(j);
  let score = 0;
  const matched = [];

  for (const cat of profile.wos_categories || []) {
    if (hitHay(hays.subject, cat)) {
      score += 24;
      matched.push(cat);
    } else if (hitHay(hays.name, cat)) {
      score += 8;
      matched.push(cat);
    }
  }
  for (const field of profile.research_fields || []) {
    if (hitHay(hays.subject, field)) {
      score += 18;
      matched.push(field);
    } else if (hitHay(hays.name, field)) {
      score += 9;
      matched.push(field);
    }
  }
  for (const kw of profile.domain_keywords || []) {
    if (hitHay(hays.subject, kw)) {
      score += 10;
      matched.push(kw);
    } else if (hitHay(hays.name, kw)) {
      score += 5;
      matched.push(kw);
    }
  }

  const negHits = [];
  for (const neg of profile.negative_keywords || []) {
    if (hitHay(hays.subject, neg) || hitHay(hays.name, neg)) {
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

// ─── Step 3: tiered recommendation report ───

function reportLang(value) {
  return /^zh/i.test(String(value || '')) ? 'zh' : 'en';
}

function candidateLine(r, i) {
  const apc = r.doaj
    ? (String(r.doaj.apc || '').toLowerCase() === 'no' ? 'free' : 'APC listed')
    : 'unknown';
  return [
    `${i + 1}. ${r.name}`,
    `IF=${r.if_2024 ?? '-'}`,
    r.if_quartile || '-',
    r.cas_zone ? `CAS tier ${r.cas_zone}${r.cas_top ? ' TOP' : ''}` : '-',
    (r.indices || []).join('/') || '-',
    r.publisher || '-',
    `APC:${apc}`,
    r.warning ? 'warning' : '',
  ].filter(Boolean).join(' | ');
}

function sanitizeReportItems(items, max) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, max).map(it => ({
    name: cleanText(it?.name || '', 160),
    reason: cleanText(it?.reason || '', 160),
  })).filter(it => it.name);
}

function sanitizeReportShape(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tiers = (Array.isArray(raw.tiers) ? raw.tiers : []).map(t => ({
    id: cleanText(t?.id || '', 24) || 'tier',
    label: cleanText(t?.label || '', 40) || '推荐',
    items: sanitizeReportItems(t?.items, 10),
  })).filter(t => t.items.length).slice(0, 4);
  const chinese = sanitizeReportItems(raw.chinese, 8);
  const strategy = (Array.isArray(raw.strategy) ? raw.strategy : [])
    .map(s => cleanText(s, 200)).filter(Boolean).slice(0, 5);
  if (!tiers.length && !chinese.length) return null;
  return {
    intro: cleanText(raw.intro || '', 300),
    tiers,
    chinese,
    strategy,
  };
}

function fallbackReason(row, lang) {
  const matched = unique([...(row.matched || []), ...(row.topics || [])].filter(Boolean), 3).join(lang === 'zh' ? '、' : ', ');
  if (lang === 'zh') {
    return matched ? `与${matched}方向匹配，站内指标可核验。` : '与论文主题匹配，站内指标可核验。';
  }
  return matched ? `Matches ${matched}; site metrics are available.` : 'Matches the topic; site metrics are available.';
}

function fallbackTieredReport(profile, ranked, lang) {
  const labels = lang === 'zh'
    ? [
        ['primary', '优先主投', 0, 6],
        ['backup', '稳妥备选', 6, 14],
        ['fallback', '保底期刊', 14, 20],
      ]
    : [
        ['primary', 'Primary targets', 0, 6],
        ['backup', 'Solid alternatives', 6, 14],
        ['fallback', 'Safer fallbacks', 14, 20],
      ];
  const fields = unique([...(profile?.research_fields || []), ...(profile?.wos_categories || [])], 4);
  const intro = lang === 'zh'
    ? `该论文主要落在${fields.join('、') || '相关交叉学科'}方向，以下推荐按主题匹配度与站内期刊指标分层。`
    : `This paper is positioned around ${fields.join(', ') || 'the identified research field'}; the recommendations are tiered by topic fit and site metrics.`;
  return {
    intro,
    tiers: labels.map(([id, label, start, end]) => ({
      id,
      label,
      items: ranked.slice(start, end).map(row => ({ name: row.name, reason: fallbackReason(row, lang) })),
    })).filter(t => t.items.length),
    chinese: [],
    strategy: lang === 'zh'
      ? ['优先选择主题贴合且分区稳定的期刊。', '保底期刊用于覆盖审稿风险，不建议把预警期刊放入主投。']
      : ['Prioritize journals with strong topic fit and stable rankings.', 'Use fallback journals to manage review risk; avoid warning-list journals as primary targets.'],
  };
}

function ensureReportI18n(raw, profile, ranked) {
  const direct = sanitizeReportShape(raw);
  const fromI18n = raw && typeof raw === 'object' && raw.i18n && typeof raw.i18n === 'object' ? raw.i18n : {};
  const zhFallback = fallbackTieredReport(profile, ranked, 'zh');
  const enFallback = fallbackTieredReport(profile, ranked, 'en');
  const zh = sanitizeReportShape(fromI18n.zh) || sanitizeReportShape(raw?.zh) || direct || zhFallback;
  const en = sanitizeReportShape(fromI18n.en) || sanitizeReportShape(raw?.en) || enFallback;

  if (!zh.tiers.length) zh.tiers = zhFallback.tiers;
  if (!en.tiers.length) en.tiers = enFallback.tiers;
  if (!zh.intro) zh.intro = zhFallback.intro;
  if (!en.intro) en.intro = enFallback.intro;
  if (!zh.strategy.length) zh.strategy = zhFallback.strategy;
  if (!en.strategy.length) en.strategy = enFallback.strategy;

  return { ...zh, i18n: { zh, en } };
}

function localizeReport(report, lang) {
  const selected = report?.i18n?.[lang] || report;
  return { ...selected, i18n: report?.i18n || { [lang]: selected } };
}

async function generateReport(apiKey, query, profile, ranked, context) {
  const lines = ranked.slice(0, 40).map(candidateLine).join('\n');
  const res = await trackedDeepseekChat(apiKey, [
    {
      role: 'system',
      content: `You are a professional academic journal submission advisor. Based on the user's paper and the candidate journal list, output a strict bilingual JSON recommendation report.

Output format (strict JSON):
{
  "i18n": {
    "zh": {
      "intro": "一两句话解读论文的学科定位",
      "tiers": [
        {"id": "primary", "label": "优先主投", "items": [{"name": "期刊名", "reason": "≤40字中文推荐理由"}]},
        {"id": "backup", "label": "稳妥备选", "items": [...]},
        {"id": "fallback", "label": "保底期刊", "items": [...]}
      ],
      "chinese": [{"name": "中文期刊名", "reason": "≤40字中文理由"}],
      "strategy": ["投稿策略建议1", "建议2", "建议3"]
    },
    "en": {
      "intro": "One or two English sentences interpreting the paper's field positioning",
      "tiers": [
        {"id": "primary", "label": "Primary targets", "items": [{"name": "exact journal name", "reason": "≤20 English words"}]},
        {"id": "backup", "label": "Solid alternatives", "items": [...]},
        {"id": "fallback", "label": "Safer fallbacks", "items": [...]}
      ],
      "chinese": [{"name": "中文期刊名", "reason": "≤20 English words"}],
      "strategy": ["English strategy 1", "English strategy 2", "English strategy 3"]
    }
  }
}

Requirements:
- Produce both i18n.zh and i18n.en. English fields must use English prose only; Chinese journal names may remain in Chinese.
- tiers must have three groups: primary 4-6 journals, backup 6-10 journals, fallback 3-5 journals. Choose mainly from candidates and use exact candidate journal names. Do not repeat journals.
- fallback journals should be safer choices with broader scope; do not select warning-list journals for primary.
- If a non-candidate English journal is clearly relevant, add at most 3 and mention it in the reason.
- chinese: recommend 4-8 relevant Chinese core journals if the topic is suitable for Chinese-language submission; otherwise use an empty array.
- Reasons should explain topic fit and positioning. Do not repeat IF/JCR/CAS metrics because site data fills those fields.
- Strategy should include 2-4 practical submission suggestions.
- Return JSON only. No markdown.`,
    },
    {
      role: 'user',
      content: `Paper: ${query}\n\nSemantic profile: ${JSON.stringify({
        research_fields: profile.research_fields,
        wos_categories: profile.wos_categories,
      })}\n\nCandidate journals ranked by match:\n${lines}`,
    },
  ], { temperature: 0.2, maxTokens: 2800, jsonOutput: true, model: context.model }, { ...context, step: 'report', feature: 'pick_report', evidenceCount: ranked.length });
  const content = res?.choices?.[0]?.message?.content || '';
  return ensureReportI18n(JSON.parse(content), profile, ranked);
}

// ─── handler ───

export async function handlePick(req, env, opts = {}) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return json({ ok: false, error: 'AI service not configured' }, 503);
  const model = cleanText(env.DEEPSEEK_PICK_MODEL || env.DEEPSEEK_MODEL || DEFAULT_PICK_MODEL, 80) || DEFAULT_PICK_MODEL;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const query = cleanText(body?.query || body?.title || '', 4000);
  if (!query || query.length < 6) return json({ ok: false, error: 'Query required' }, 400);
  const language = reportLang(body?.language || body?.lang || body?.locale || 'en');

  let journals;
  try {
    journals = await loadJournals(env);
  } catch (e) {
    return json({ ok: false, error: `Data load failed: ${e.message}` }, 500);
  }

  let quota = null;
  let refund = null;
  let quotaUser = null;
  if (typeof opts.consumeQuota === 'function') {
    const q = await opts.consumeQuota();
    if (!q.ok) return q.response;
    quota = q.quota;
    quotaUser = q.user || null;
    refund = typeof q.refund === 'function' ? q.refund : null;
  }

  const usageContext = {
    env,
    userId: quotaUser?.id || null,
    app: 'journal',
    provider: 'deepseek',
    model,
    rangeLabel: 'flash',
    queryChars: query.length,
    quota,
    pricing: deepseekPricing(env),
  };

  let profile = null;
  try {
    profile = await extractProfile(apiKey, query, usageContext);
  } catch (e) {
    console.warn('pick semantic extraction failed:', e?.message || e);
  }
  if (!profile) {
    // AI unavailable → give the credit back and let the client fall back to local matching.
    if (refund) await refund();
    return json({ ok: false, error: 'ai_unavailable', fallback: 'local' }, 502);
  }

  const limit = clamp(body?.limit || 120, 20, 160);
  const filters = body?.filters && typeof body.filters === 'object' ? body.filters : {};
  const results = rankJournals(journals, profile, filters, limit);

  let report = null;
  if (results.length) {
    try {
      report = await generateReport(apiKey, query, profile, results, {
        ...usageContext,
        termsCount: (profile.research_fields || []).length + (profile.wos_categories || []).length + (profile.domain_keywords || []).length,
      });
    } catch (e) {
      console.warn('pick report generation failed:', e?.message || e);
    }
  }
  if (results.length) report = ensureReportI18n(report, profile, results);

  return json({
    ok: true,
    mode: 'ai',
    profile,
    results,
    report: report ? localizeReport(report, language) : null,
    total: results.length,
    shown: results.length,
    quota,
  });
}
