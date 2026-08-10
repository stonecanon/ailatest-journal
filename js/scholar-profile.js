// Public Google Scholar profile reader used by the site API routes.
// Results are candidates only; callers must keep them in a review queue.

function decodeHtml(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function htmlText(fragment) {
  return decodeHtml(String(fragment || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseScholarProfileUrl(raw) {
  let value = String(raw || '').trim();
  // Chat apps commonly leave a Chinese/ASCII comma after the pasted URL.
  value = value.replace(/[，。；;,\.]+$/u, '');
  if (!value) throw new Error('请粘贴 Google Scholar 个人主页链接');
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    throw new Error('Google Scholar 链接格式不正确');
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== 'scholar.google.com' && !host.endsWith('.scholar.google.com')) {
    throw new Error('只支持 scholar.google.com 的个人主页链接');
  }
  if (!/^\/citations\/?$/i.test(parsed.pathname)) {
    throw new Error('请粘贴 Google Scholar 个人主页，而不是普通检索链接');
  }
  const user = parsed.searchParams.get('user') || '';
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(user)) {
    throw new Error('链接中没有有效的 Scholar user ID');
  }
  return { user, url: parsed };
}

export function parseScholarPapers(html) {
  const rows = [...String(html || '').matchAll(/<tr[^>]+class=["']gsc_a_tr["'][^>]*>([\s\S]*?)<\/tr>/gi)];
  return rows.map((match) => {
    const row = match[1] || '';
    const titleMatch = row.match(/<a[^>]+class=["']gsc_a_at["'][^>]*>([\s\S]*?)<\/a>/i);
    const gray = [...row.matchAll(/<div[^>]+class=["']gs_gray["'][^>]*>([\s\S]*?)<\/div>/gi)]
      .map((m) => htmlText(m[1]));
    const citationMatch = row.match(/class=["']gsc_a_c["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const yearMatch = row.match(/class=["']gsc_a_y["'][\s\S]*?>(\d{4})<\//i);
    const title = htmlText(titleMatch?.[1]);
    if (!title) return null;
    return {
      title,
      authors: gray[0] || '',
      venue: gray[1] || '',
      year: yearMatch ? Number(yearMatch[1]) : null,
      citations: Number.parseInt(htmlText(citationMatch?.[1]) || '0', 10) || 0,
    };
  }).filter(Boolean).slice(0, 100);
}

export async function fetchScholarProfile(rawUrl, fetchImpl = globalThis.fetch) {
  const parsed = parseScholarProfileUrl(rawUrl);
  const hosts = [
    'scholar.google.co.uk',
    'scholar.google.ca',
    'scholar.google.com.au',
    'scholar.google.de',
    'scholar.google.com',
  ];
  const requestHeaders = {
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (compatible; AILatest-Journal/1.0; +https://journal.ailatest.org)',
  };
  let html = '';
  let lastStatus = 0;
  let lastError = null;
  for (const host of hosts) {
    const target = new URL('https://' + host + '/citations');
    target.searchParams.set('view_op', 'list_works');
    target.searchParams.set('hl', 'en');
    target.searchParams.set('user', parsed.user);
    target.searchParams.set('cstart', '0');
    target.searchParams.set('pagesize', '100');
    try {
      const response = await fetchImpl(target.toString(), { headers: requestHeaders });
      lastStatus = response.status;
      const candidate = await response.text();
      if (response.ok && /gsc_a_tr/.test(candidate) && !/not a robot|unusual traffic|captcha|robot check/i.test(candidate)) {
        html = candidate;
        break;
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (!html) {
    if (lastError && !lastStatus) throw new Error('Google Scholar 暂时无法访问，请稍后重试');
    throw new Error(`Google Scholar 暂时无法读取（${lastStatus || 403}），请稍后重试，或改用 ORCID / OpenAlex 作者 ID`);
  }

  const nameMatch = html.match(/<div[^>]+id=["']gsc_prf_in["'][^>]*>([\s\S]*?)<\/div>/i);
  const affiliationMatch = html.match(/<div[^>]+class=["']gsc_prf_il["'][^>]*>([\s\S]*?)<\/div>/i);
  const papers = parseScholarPapers(html);
  return {
    source: 'google-scholar',
    profile_id: parsed.user,
    profile_url: `https://scholar.google.com/citations?user=${encodeURIComponent(parsed.user)}`,
    name: htmlText(nameMatch?.[1]),
    affiliation: htmlText(affiliationMatch?.[1]),
    papers,
    paper_count: papers.length,
    note: 'Scholar 结果仅作为候选；确认作者、论文题目和期刊后，才可加入发表足迹。',
  };
}
