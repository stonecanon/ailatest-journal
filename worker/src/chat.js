/**
 * /api/chat — AI journal search via DeepSeek function calling
 * 
 * Flow:
 *  1. User query → DeepSeek with function defs → extract search params
 *  2. Filter journals in-memory using extracted params
 *  3. Results → DeepSeek → natural language response
 */

// DeepSeek API key — set via wrangler secret put DEEPSEEK_API_KEY
import { json, deepseekChat as dsChat, loadJournals } from './deepseek-common.js';

// Journal data — loaded at cold start
let journals = null;         // full array
let journalTextIndex = null; // one-line summaries for full-text search

const FIELD_DESCRIPTIONS = {
  name:             '期刊名称',
  if_2024:          '2024年影响因子',
  if_quartile:      'JCR分区(Q1/Q2/Q3/Q4)',
  publisher:        '出版商',
  country:          '国家',
  wos_categories:   'WoS学科分类(数组)',
  esi_category:     'ESI学科',
  indices:          '收录索引(SCIE/SSCI/ESCI/AHCI)',
  cas_zone:         '中科院分区(1区/2区/3区/4区)',
  cas_major_cat:    '中科院大类',
  cas_major_cn:     '中科院大类中文名',
  cas_top:          '是否Top期刊',
  ccf:              'CCF等级(A/B/C)',
  ccf_area:         'CCF领域',
  abdc:             'ABDC等级(A*/A/B/C)',
  abs:              'ABS等级(4*/4/3/2/1)',
  scopus:           'Scopus收录(true/false)',
  doaj_only:        '纯DOAJ期刊',
  free:             '免费发表',
  on_hold:          '被On Hold',
  under_review:     '被Under Review',
  citic_warning:    '中信所预警',
  warning:          '预警标记',
  crossref:         '审稿周期信息{avg_months, source}',
  oa:               'OA相关',
  ft50:             'FT50期刊',
  utd24:            'UTD24期刊',
  cn_name:          '中文刊名',
  cn_code:          'CN号',
  language_cn:      '中文期刊',
  ei_status:        'EI收录状态',
  medline:          'MEDLINE收录',
  pmc:              'PMC收录',
  cnki_major:       'CNKI大类',
  flagships:        '旗舰期刊',
};

// Build searchable text for each journal
function buildJournalText(j) {
  const parts = [];
  parts.push(`期刊: ${j.name || ''}`);
  if (j.cn_name) parts.push(`中文名: ${j.cn_name}`);
  if (j.issn) parts.push(`ISSN: ${j.issn}`);
  if (j.eissn) parts.push(`EISSN: ${j.eissn}`);
  if (j.publisher) parts.push(`出版商: ${j.publisher}`);
  if (j.country) parts.push(`国家: ${j.country}`);
  if (j.if_2024 != null) parts.push(`IF: ${j.if_2024}`);
  if (j.if_quartile) parts.push(`JCR分区: ${j.if_quartile}`);
  if (j.cas_zone) parts.push(`中科院: ${j.cas_zone}`);
  if (j.indices && j.indices.length) parts.push(`索引: ${j.indices.join(', ')}`);
  if (j.wos_categories && j.wos_categories.length) parts.push(`学科: ${j.wos_categories.join(', ')}`);
  if (j.ccf) parts.push(`CCF: ${j.ccf}`);
  if (j.abdc) parts.push(`ABDC: ${j.abdc}`);
  if (j.crossref && j.crossref.avg_months) parts.push(`审稿: ${j.crossref.avg_months}月`);
  if (j.free) parts.push('免费发表');
  if (j.on_hold) parts.push('⚠On Hold');
  if (j.under_review) parts.push('⚠Under Review');
  if (j.citic_warning) parts.push('⚠中信所预警');
  if (j.cn_code) parts.push(`CN: ${j.cn_code}`);
  return parts.join(' | ');
}

// Keyword-based search (no embedding needed)
function keywordSearch(query, limit = 20) {
  if (!journalTextIndex) return [];
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 1);
  const scored = [];
  for (let i = 0; i < journalTextIndex.length; i++) {
    const text = journalTextIndex[i].toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      const idx = text.indexOf(kw);
      if (idx >= 0) score += 1 + (1 / (idx + 1)); // earlier match = higher score
    }
    if (score > 0) scored.push({ idx: i, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => journals[s.idx]);
}

// Apply structured filters
function applyFilters(journals, filters) {
  let results = journals;
  
  if (filters.if_min != null) results = results.filter(j => (j.if_2024 || 0) >= filters.if_min);
  if (filters.if_max != null) results = results.filter(j => (j.if_2024 || 0) <= filters.if_max);
  if (filters.indices && filters.indices.length) {
    results = results.filter(j => filters.indices.some(idx => (j.indices || []).includes(idx)));
  }
  if (filters.cas_zone) results = results.filter(j => j.cas_zone === filters.cas_zone);
  if (filters.cas_top) results = results.filter(j => j.cas_top);
  if (filters.ccf) results = results.filter(j => j.ccf === filters.ccf);
  if (filters.country) results = results.filter(j => j.country === filters.country);
  if (filters.publisher) {
    const pub = filters.publisher.toLowerCase();
    results = results.filter(j => (j.publisher || '').toLowerCase().includes(pub));
  }
  if (filters.free) results = results.filter(j => j.free);
  if (filters.is_chinese) results = results.filter(j => j.country === 'China' || j.cn_code);
  if (filters.on_hold) results = results.filter(j => j.on_hold);
  if (filters.under_review) results = results.filter(j => j.under_review);
  if (filters.citic_warning) results = results.filter(j => j.citic_warning);
  if (filters.subject) {
    const subj = filters.subject.toLowerCase();
    results = results.filter(j => 
      (j.wos_categories || []).some(c => c.toLowerCase().includes(subj)) ||
      (j.cas_major_cat || '').toLowerCase().includes(subj) ||
      (j.cas_major_cn || '').toLowerCase().includes(subj) ||
      (j.esi_category || '').toLowerCase().includes(subj) ||
      (j.cnki_major || '').toLowerCase().includes(subj)
    );
  }
  if (filters.name_contains) {
    const n = filters.name_contains.toLowerCase();
    results = results.filter(j => (j.name || '').toLowerCase().includes(n));
  }
  if (filters.review_max != null) {
    results = results.filter(j => {
      const cr = j.crossref;
      return cr && cr.avg_months != null && cr.avg_months <= filters.review_max;
    });
  }
  
  return results;
}

// Call DeepSeek API (shared client, keeps the old (apiKey, messages, tools) shape)
function deepseekChat(apiKey, messages, tools = null) {
  return dsChat(apiKey, messages, tools ? { tools } : {});
}

// ─── Main chat handler ───

export async function handleChat(req, env) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405);
  }

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return json({ error: 'AI service not configured' }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const query = (body.query || '').trim();
  if (!query || query.length > 1000) {
    return json({ error: 'Query required (max 1000 chars)' }, 400);
  }

  // ─── Load journals on first request ───
  if (!journals) {
    try {
      journals = await loadJournals(env);
      journalTextIndex = journals.map(buildJournalText);
      console.log(`Loaded ${journals.length} journals`);
    } catch (e) {
      return json({ error: `Data load failed: ${e.message}` }, 500);
    }
  }

  // ─── Step 1: Extract search params via DeepSeek ───
  const searchTool = {
    type: 'function',
    function: {
      name: 'search_journals',
      description: '搜索期刊数据库。根据自然语言描述提取搜索条件。只需要提供用户明确提到的条件，未提及的字段不要填写。',
      parameters: {
        type: 'object',
        properties: {
          if_min:        { type: 'number', description: '最低影响因子' },
          if_max:        { type: 'number', description: '最高影响因子' },
          indices:       { type: 'array', items: { type: 'string', enum: ['SCIE','SSCI','ESCI','AHCI'] }, description: '收录索引' },
          cas_zone:      { type: 'string', enum: ['1区','2区','3区','4区'], description: '中科院分区' },
          cas_top:       { type: 'boolean', description: '是否中科院Top期刊' },
          ccf:           { type: 'string', enum: ['A','B','C'], description: 'CCF等级' },
          country:       { type: 'string', description: '国家' },
          publisher:     { type: 'string', description: '出版商(模糊匹配)' },
          free:          { type: 'boolean', description: '是否免费发表' },
          is_chinese:    { type: 'boolean', description: '是否中国期刊' },
          on_hold:       { type: 'boolean', description: '是否On Hold' },
          under_review:  { type: 'boolean', description: '是否Under Review' },
          citic_warning: { type: 'boolean', description: '是否中信所预警' },
          subject:       { type: 'string', description: '学科领域(模糊匹配WoS学科或中科院大类)' },
          name_contains: { type: 'string', description: '期刊名包含的文字' },
          review_max:    { type: 'number', description: '最高审稿周期(月)' },
          keyword:       { type: 'string', description: '通用关键词搜索(全文匹配)' },
          limit:         { type: 'number', description: '返回条数上限,默认20', default: 20 },
          sort_by:       { type: 'string', enum: ['if_desc', 'name_asc', 'review_asc', 'relevance'], description: '排序方式,默认if_desc', default: 'if_desc' },
        },
      },
    },
  };

  let searchParams = {};
  try {
    const res1 = await deepseekChat(apiKey, [
      {
        role: 'system',
        content: `你是一个期刊搜索助手。用户会用自然语言描述想找的期刊，你需要从中提取搜索条件。
重要规则：
- 只提取用户明确提到的条件，不要臆测
- "好的期刊"、"顶级期刊" → 设置 if_min=10 或 cas_zone='1区'
- "计算机"、"环境"、"医学" → 设置 subject 字段
- "核心期刊"在中国语境下通常指被SCIE/SSCI/CSSCI收录 → 设置 indices=['SCIE','SSCI']
- "容易发的"、"审稿快的" → 设置 review_max=3
- "免费的"、"不要版面费" → 设置 free=true
- "国内的"、"中国的" → 设置 is_chinese=true
- 如果用户只是随便聊天(问候、感谢等)而非搜索，返回空的 search_journals 调用(不填任何参数)`,
      },
      { role: 'user', content: query },
    ], [searchTool]);

    const msg = res1.choices[0].message;
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const call = msg.tool_calls[0];
      if (call.function.name === 'search_journals') {
        searchParams = JSON.parse(call.function.arguments);
      }
    }
    // If it's a casual chat (no tool call), respond directly
    if (!msg.tool_calls && msg.content) {
      return json({ reply: msg.content, results: [], total: 0 });
    }
  } catch (e) {
    // Fallback: keyword search
    console.log(`DeepSeek extraction failed: ${e.message}, falling back to keyword`);
    searchParams = { keyword: query, limit: 20 };
  }

  // ─── Step 2: Apply filters and search ───
  let results;
  const limit = searchParams.limit || 20;

  if (searchParams.keyword) {
    results = keywordSearch(searchParams.keyword, limit);
  } else {
    results = applyFilters(journals, searchParams);
  }

  // Sort
  const sortBy = searchParams.sort_by || 'if_desc';
  if (sortBy === 'if_desc') {
    results.sort((a, b) => (b.if_2024 || 0) - (a.if_2024 || 0));
  } else if (sortBy === 'name_asc') {
    results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortBy === 'review_asc') {
    results.sort((a, b) => {
      const ra = a.crossref?.avg_months || 999;
      const rb = b.crossref?.avg_months || 999;
      return ra - rb;
    });
  }

  const total = results.length;
  const topResults = results.slice(0, limit);

  // ─── Step 3: Generate natural language response ───
  if (topResults.length === 0) {
    return json({
      reply: `没有找到符合条件的期刊。请尝试放宽搜索条件。`,
      results: [],
      total: 0,
    });
  }

  // Format results for the LLM
  const resultText = topResults.map((j, i) => {
    const parts = [`${i + 1}. ${j.name}`];
    if (j.if_2024) parts.push(`IF=${j.if_2024}`);
    if (j.cas_zone) parts.push(`中科院${j.cas_zone}`);
    if (j.indices?.length) parts.push(j.indices.join('/'));
    if (j.publisher) parts.push(j.publisher);
    if (j.country) parts.push(j.country);
    if (j.free) parts.push('免费');
    if (j.crossref?.avg_months) parts.push(`审稿${j.crossref.avg_months}月`);
    if (j.on_hold) parts.push('⚠On Hold');
    if (j.citic_warning) parts.push('⚠预警');
    return parts.join(' | ');
  }).join('\n');

  try {
    const res2 = await deepseekChat(apiKey, [
      {
        role: 'system',
        content: `你是一个专业的学术期刊顾问。根据搜索结果回答用户的问题。
- 用中文回答
- 简洁专业，重点突出
- 如果结果很多(>10条)，总结关键发现，列出前几本最好的
- 如果有特别值得注意的信息(预警、On Hold、审稿快慢)，主动提示
- 在回答末尾可以问用户是否需要进一步筛选`,
      },
      { role: 'user', content: `用户查询: ${query}\n\n搜索结果(${total}条匹配，展示前${topResults.length}条):\n${resultText}` },
    ]);

    const reply = res2.choices[0].message.content;

    // Return structured data + natural language reply
    const simplifiedResults = topResults.map(j => ({
      name: j.name,
      issn: j.issn || j.eissn || '',
      if_2024: j.if_2024,
      cas_zone: j.cas_zone,
      indices: j.indices,
      publisher: j.publisher,
      country: j.country,
      free: j.free || false,
      on_hold: j.on_hold || false,
      review_months: j.crossref?.avg_months || null,
      slug: j.slug || '',
    }));

    return json({
      reply,
      results: simplifiedResults,
      total,
      shown: simplifiedResults.length,
    });

  } catch (e) {
    // Fallback: return raw results without LLM formatting
    return json({
      reply: `找到 ${total} 本期刊，以下是前 ${topResults.length} 本：\n\n${resultText}`,
      results: topResults.slice(0, limit).map(j => ({
        name: j.name,
        issn: j.issn || j.eissn || '',
        if_2024: j.if_2024,
        cas_zone: j.cas_zone,
        indices: j.indices,
        slug: j.slug || '',
      })),
      total,
      shown: Math.min(topResults.length, limit),
    });
  }
}
