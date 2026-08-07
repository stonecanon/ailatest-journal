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

const PROFILE_SYSTEM = `你是学术期刊荐刊系统的语义解析器。把论文标题/摘要转成期刊匹配画像（不是普通关键词抽取）。

硬性要求：
- 先识别研究对象与学科语境，再决定关键词。network/system/model/mechanism 等词必须消歧：
  经济/区域语境的 network → economic/regional networks，negative_keywords 写入 computer networks、telecommunications 等错误方向。
- domain_keywords 用能对上期刊学科分类的英文短语（如 economic geography, urban studies），禁止 analysis/mechanism/formation 等泛方法词。
- wos_categories 填最可能的 Web of Science 类目英文名。
- 交叉学科请同时给出多个相关类目。
- research_fields 2-6 个；domain_keywords 4-12 个；negative_keywords 2-8 个。`;

async function extractProfile(apiKey, query, context) {
  // 1) 优先 tool calling（结构化）
  try {
    const res = await trackedDeepseekChat(apiKey, [
      { role: 'system', content: PROFILE_SYSTEM + '\n只调用函数 extract_journal_recommendation_profile，不要输出普通文本。' },
      { role: 'user', content: query },
    ], {
      tools: [semanticTool()],
      temperature: 0.05,
      maxTokens: 700,
      model: context.model,
    }, { ...context, step: 'profile_tool', feature: 'pick_profile' });
    const call = res?.choices?.[0]?.message?.tool_calls?.[0];
    if (call?.function?.name === 'extract_journal_recommendation_profile') {
      const profile = normalizeProfile(JSON.parse(call.function.arguments || '{}'));
      if (profile) return profile;
    }
  } catch (e) {
    console.warn('pick profile tool failed:', e?.message || e);
  }

  // 2) JSON 模式回退（DeepSeek tool 偶发失败时仍可用）
  try {
    const res = await trackedDeepseekChat(apiKey, [
      {
        role: 'system',
        content: `${PROFILE_SYSTEM}

只输出一个 JSON 对象，键为：
research_fields, wos_categories, target_indices, domain_keywords, negative_keywords, explanation
不要 markdown。target_indices 只能是 SCIE/SSCI/ESCI/AHCI 的子集。`,
      },
      { role: 'user', content: query },
    ], {
      temperature: 0.05,
      maxTokens: 700,
      jsonOutput: true,
      model: context.model,
    }, { ...context, step: 'profile_json', feature: 'pick_profile' });
    const content = res?.choices?.[0]?.message?.content || '';
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return normalizeProfile(JSON.parse(content.slice(start, end + 1)));
    }
  } catch (e) {
    console.warn('pick profile json failed:', e?.message || e);
  }
  return null;
}

/** 无第二次大模型调用：用排序结果快速生成三档报告，显著降低时延 */
function buildFastReport(profile, ranked, lang = 'zh') {
  const zh = lang !== 'en';
  const reasonOf = (r) => {
    const m = (r.matched || []).slice(0, 3).join(zh ? '、' : ', ');
    return m || (zh ? '学科方向匹配' : 'Field match');
  };
  const items = (slice) => slice.map(r => ({ name: r.name, reason: reasonOf(r) }));
  const clean = ranked.filter(r => !r.warning);
  const pool = clean.length >= 8 ? clean : ranked;
  return {
    intro: profile.explanation
      || (zh
        ? `根据语义画像（${(profile.research_fields || []).slice(0, 3).join('、') || '研究主题'}）匹配的目标期刊梯度。`
        : `Tiered targets matched to the semantic profile (${(profile.research_fields || []).slice(0, 3).join(', ') || 'topic'}).`),
    tiers: [
      { id: 'primary', label: zh ? '优先主投' : 'Primary targets', items: items(pool.slice(0, 6)) },
      { id: 'backup', label: zh ? '稳妥备选' : 'Solid backups', items: items(pool.slice(6, 14)) },
      { id: 'fallback', label: zh ? '保底期刊' : 'Safer fallbacks', items: items(pool.slice(14, 20)) },
    ].filter(t => t.items.length),
    chinese: [],
    strategy: zh
      ? [
          '按「主投 → 备选 → 保底」梯度投稿，主投优先选学科最贴合且分区合理的刊。',
          '若审稿周期或 APC 敏感，在备选中优先看 FREE/低 APC 与非预警刊。',
          '交叉学科可主投交叉类目期刊，备选覆盖各单学科顶刊/二区。',
        ]
      : [
          'Submit in tiers: primary → backup → fallback; prioritize best field fit.',
          'If APC or review time matters, prefer FREE/low-APC non-warning titles in backups.',
          'For interdisciplinary work, keep primary at the intersection and backups in each parent field.',
        ],
  };
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
  const ifVal = Number(j.if_2025 != null ? j.if_2025 : j.if_2024);
  if (ifVal > 0) score += Math.min(4, Math.log1p(ifVal));
  // 无任何学科类目的刊降权，减少“名气刊/综合刊”刷榜
  if (!(j.wos_categories || []).length && !j.esi_category && !j.jcr_cat) score *= 0.75;
  if (j.warning || j.citic_warning || j.on_hold || j.under_review) score *= 0.55;
  if (negHits.length) score *= 0.4;

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

function candidateLine(r, i) {
  const apc = r.doaj
    ? (String(r.doaj.apc || '').toLowerCase() === 'no' ? '免费' : '有APC')
    : '未知';
  return [
    `${i + 1}. ${r.name}`,
    `IF=${r.if_2024 ?? '-'}`,
    r.if_quartile || '-',
    r.cas_zone ? `中科院${r.cas_zone}区${r.cas_top ? 'TOP' : ''}` : '-',
    (r.indices || []).join('/') || '-',
    r.publisher || '-',
    `APC:${apc}`,
    r.warning ? '⚠预警' : '',
  ].filter(Boolean).join(' | ');
}

function sanitizeReportItems(items, max) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, max).map(it => ({
    name: cleanText(it?.name || '', 160),
    reason: cleanText(it?.reason || '', 160),
  })).filter(it => it.name);
}

function sanitizeReport(raw) {
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

async function generateReport(apiKey, query, profile, ranked, context) {
  const lines = ranked.slice(0, 40).map(candidateLine).join('\n');
  const res = await trackedDeepseekChat(apiKey, [
    {
      role: 'system',
      content: `你是专业的学术期刊投稿顾问。根据用户论文与候选期刊列表，输出 JSON 推荐报告。

输出格式（严格 JSON）：
{
  "intro": "一两句话解读论文的学科定位",
  "tiers": [
    {"id": "primary", "label": "优先主投", "items": [{"name": "期刊名", "reason": "≤40字推荐理由"}]},
    {"id": "backup", "label": "稳妥备选", "items": [...]},
    {"id": "fallback", "label": "保底期刊", "items": [...]}
  ],
  "chinese": [{"name": "中文期刊名", "reason": "≤40字理由"}],
  "strategy": ["投稿策略建议1", "建议2", "建议3"]
}

要求：
- tiers 共三档：primary 4-6 本、backup 6-10 本、fallback 3-5 本，主要从候选列表中选择（用候选列表中的精确期刊名）。推荐量比保守模式多约 30%，但不要重复。
- fallback 是更稳妥的保底期刊：匹配度可以略低，但接收范围更宽、定位更稳，不要选预警期刊。
- 如果你确信某本不在候选列表的英文期刊高度对口，最多可补充 3 本，理由中注明"候选外补充"。
- chinese：如论文主题适合中文发表，推荐 4-8 本对口的中文核心期刊（如 CSSCI/北大核心），否则给空数组。
- reason 简洁说明为什么对口（学科方向、定位），不要复述 IF/分区等指标——指标由系统数据补全。
- strategy 给 2-4 条具体投稿策略（梯度、叙事侧重、风险提示）。
- 候选列表中标 ⚠预警 的期刊不要放进 primary。
- 全部用中文。只输出 JSON。`,
    },
    {
      role: 'user',
      content: `论文: ${query}\n\n学科画像: ${JSON.stringify({
        research_fields: profile.research_fields,
        wos_categories: profile.wos_categories,
      })}\n\n候选期刊(按匹配度排序):\n${lines}`,
    },
  ], { temperature: 0.2, maxTokens: 1800, jsonOutput: true, model: context.model }, { ...context, step: 'report', feature: 'pick_report', evidenceCount: ranked.length });
  const content = res?.choices?.[0]?.message?.content || '';
  return sanitizeReport(JSON.parse(content));
}

// ─── handler ───

function resolveDeepseekKey(env) {
  const raw = env?.DEEPSEEK_API_KEY || env?.DEEPSEEK_KEY || env?.DEEPSEEK_TOKEN || '';
  return String(raw).trim();
}

export async function handlePick(req, env, opts = {}) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const apiKey = resolveDeepseekKey(env);
  if (!apiKey || apiKey.length < 12) {
    return json({
      ok: false,
      error: 'ai_key_missing',
      code: 'ai_key_missing',
      message: 'AI 推荐接口还没有正确读取 DeepSeek 密钥，请重新部署 Worker 后再试。',
      detail: 'DEEPSEEK_API_KEY missing or empty on Worker',
    }, 503);
  }
  const model = cleanText(env.DEEPSEEK_PICK_MODEL || env.DEEPSEEK_MODEL || DEFAULT_PICK_MODEL, 80) || DEFAULT_PICK_MODEL;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const query = cleanText(body?.query || body?.title || '', 4000);
  if (!query || query.length < 6) return json({ ok: false, error: 'Query required' }, 400);
  const wantAiReport = body?.ai_report === true; // 默认关闭第二次大模型，显著降时延
  const lang = cleanText(body?.language || body?.locale || 'zh', 8).startsWith('en') ? 'en' : 'zh';

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

  // 并行：拉期刊库 + 语义画像（最大时延约等于 max(库加载, 一次 DeepSeek)）
  let journals;
  let profile = null;
  let profileError = '';
  try {
    const pair = await Promise.all([
      loadJournals(env),
      extractProfile(apiKey, query, usageContext).catch((e) => {
        profileError = e?.message || String(e);
        console.warn('pick semantic extraction failed:', profileError);
        return null;
      }),
    ]);
    journals = pair[0];
    profile = pair[1];
  } catch (e) {
    if (refund) await refund();
    return json({ ok: false, error: `Data load failed: ${e.message}` }, 500);
  }

  if (!profile) {
    if (refund) await refund();
    const authFail = /401|403|invalid.*key|authentication|unauthorized/i.test(profileError);
    const errorCode = authFail ? 'deepseek_auth_failed' : 'ai_unavailable';
    return json({
      ok: false,
      error: errorCode,
      code: errorCode,
      detail: profileError.slice(0, 240) || 'DeepSeek did not return a valid recommendation profile',
      fallback: 'local',
    }, authFail ? 503 : 502);
  }

  const limit = clamp(body?.limit || 80, 20, 120);
  const filters = body?.filters && typeof body.filters === 'object' ? body.filters : {};
  const results = rankJournals(journals, profile, filters, limit);

  let report = buildFastReport(profile, results, lang);
  // 可选：第二次大模型润色报告（默认关，避免 10s+ 等待）
  if (wantAiReport && results.length) {
    try {
      const polished = await generateReport(apiKey, query, profile, results, {
        ...usageContext,
        termsCount: (profile.research_fields || []).length
          + (profile.wos_categories || []).length
          + (profile.domain_keywords || []).length,
      });
      if (polished) report = polished;
    } catch (e) {
      console.warn('pick report generation failed:', e?.message || e);
    }
  }

  return json({
    ok: true,
    mode: 'ai',
    profile,
    results,
    report,
    total: results.length,
    shown: results.length,
    quota,
    timing: { report: wantAiReport ? 'ai' : 'fast' },
  });
}
