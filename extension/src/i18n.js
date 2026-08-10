(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};

  const MESSAGES = {
    zh: {
      'detail.link': 'AILatest 详情页',
      'detail.title': '查看期刊详情 - AILatest Journal',
      'sort.title': 'AILatest 排序',
      'sort.if': '按 IF',
      'sort.cites': '按引用量',
      'sort.original': '恢复原顺序',
      'status.loaded': '已加载，正在识别期刊...',
      'status.empty': '已加载，但未识别到期刊来源；请等页面加载完成或刷新',
      'status.lookup': '识别到 {total} 本，正在查询：{names}',
      'status.done': '识别到 {total} 本，命中 {hits} 本{suffix}',
      'status.tried': '；已试：{names}',
      'status.error': '查询失败：{message}',
      'citation.copyReference': '复制参考文献',
      'citation.copyReferenceTitle': '复制纯文字参考文献',
      'citation.copied': '已复制',
      'citation.count': '引用 {count}',
      'source.fulltext': '全文',
      'source.sources': '来源',
      'source.finding': '查找中',
      'source.limitReached': '已达上限',
      'source.openFulltext': '开放全文',
      'source.oaTitle': '仅查找合法开放获取全文；不接入 Sci-Hub。Free 累计 30 篇。',
      'source.noOpenAccess': '没有找到公开 OA 全文链接。插件只使用页面已有 PDF 和 OpenAlex 公开来源。',
    },
    en: {
      'detail.link': 'AILatest details',
      'detail.title': 'View journal details - AILatest Journal',
      'sort.title': 'AILatest sort',
      'sort.if': 'By IF',
      'sort.cites': 'By citations',
      'sort.original': 'Original order',
      'status.loaded': 'Loaded, identifying journals...',
      'status.empty': 'Loaded, but no journal source was detected. Wait for the page to finish loading or refresh.',
      'status.lookup': 'Found {total} sources, looking up: {names}',
      'status.done': 'Found {total} sources, matched {hits}{suffix}',
      'status.tried': '; tried: {names}',
      'status.error': 'Lookup failed: {message}',
      'citation.copyReference': 'Copy reference',
      'citation.copyReferenceTitle': 'Copy the plain-text reference',
      'citation.copied': 'Copied',
      'citation.count': 'Citations {count}',
      'source.fulltext': 'Full text',
      'source.sources': 'Sources',
      'source.finding': 'Finding',
      'source.limitReached': 'Limit hit',
      'source.openFulltext': 'Open full text',
      'source.oaTitle': 'Legal OA sources only; Sci-Hub is not used. Free: 30 total.',
      'source.noOpenAccess': 'No open-access full text link was found. The extension only uses page PDFs and OpenAlex public sources.',
    },
  };

  function browserLang() {
    const raw = String(root.navigator && (navigator.language || (navigator.languages && navigator.languages[0])) || '').toLowerCase();
    return raw.startsWith('zh') ? 'zh' : 'en';
  }

  function normalizeLang(value) {
    const raw = String(value || 'auto').toLowerCase();
    if (raw === 'zh' || raw.startsWith('zh-')) return 'zh';
    if (raw === 'en' || raw.startsWith('en-')) return 'en';
    return browserLang();
  }

  ns.setLang = function setLang(value) {
    ns.lang = normalizeLang(value);
    return ns.lang;
  };

  ns.t = function t(key, vars) {
    const lang = ns.lang || ns.setLang('auto');
    let text = (MESSAGES[lang] && MESSAGES[lang][key]) || MESSAGES.en[key] || key;
    Object.entries(vars || {}).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v == null ? '' : v));
    });
    return text;
  };

  ns.setLang('auto');
})(globalThis);
