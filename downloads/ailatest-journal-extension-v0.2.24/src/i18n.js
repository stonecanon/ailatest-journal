(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};

  const MESSAGES = {
    zh: {
      'popup.subtitle': '期刊评级徽章',
      'popup.account': '账号',
      'popup.loggedIn': '已登录：',
      'popup.logout': '退出',
      'popup.trial': '未登录也可用：每日 40 次查询；登录后同步账号权益',
      'popup.email': '邮箱（新邮箱即注册）',
      'popup.code': '6 位验证码',
      'popup.login': '注册 / 登录',
      'popup.oauth': '用 GitHub / Google 登录',
      'popup.settings': '徽章设置',
      'popup.displayTheme': '显示主题',
      'popup.language': '语言',
      'popup.langAuto': '自动（跟随浏览器）',
      'popup.themeSite': '网站默认',
      'popup.themeLight': '淡雅',
      'popup.themeDark': '深色',
      'popup.whichBadges': '显示哪些徽章',
      'popup.categoryIndex': '收录',
      'popup.indexIntl': '国际索引（SCIE / SSCI / EI / Scopus…）',
      'popup.indexCn': '国内目录（北大核心 / CSSCI / CSCD）',
      'popup.categoryRating': '分级',
      'popup.cas': '中科院分区 / 新锐',
      'popup.jcr': 'JCR 分区',
      'popup.if': '影响因子 IF',
      'popup.ccf': 'CCF 推荐',
      'popup.business': '商科分级（ABDC / ABS / FMS / VHB / CNRS）',
      'popup.cnTier': '国内分级（科协 / CCF-T / SCD / AMI / 浙大 / NSFC）',
      'popup.categoryOpen': '免费开放',
      'popup.free': '免费发表 / DOAJ 免 APC',
      'popup.categoryWarning': '预警',
      'popup.warnings': '预警 / 撤稿 / 停收',
      'popup.customColors': '自定义颜色',
      'popup.colorsHint': '（留默认则跟随主题）',
      'popup.colorZone': '分区',
      'popup.colorIndex': '索引',
      'popup.reset': '恢复默认（主题 + 颜色）',
      'popup.openSite': '打开 AILatest Journal',
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
      'popup.subtitle': 'Journal rating badges',
      'popup.account': 'Account',
      'popup.loggedIn': 'Signed in:',
      'popup.logout': 'Sign out',
      'popup.trial': 'Use without signing in: 40 lookups per day; sign in to sync your plan',
      'popup.email': 'Email (new emails create an account)',
      'popup.code': '6-digit verification code',
      'popup.login': 'Sign up / Sign in',
      'popup.oauth': 'Sign in with GitHub / Google',
      'popup.settings': 'Badge settings',
      'popup.displayTheme': 'Display theme',
      'popup.language': 'Language',
      'popup.langAuto': 'Auto (browser language)',
      'popup.themeSite': 'Website default',
      'popup.themeLight': 'Light',
      'popup.themeDark': 'Dark',
      'popup.whichBadges': 'Badges to display',
      'popup.categoryIndex': 'Indexes',
      'popup.indexIntl': 'International indexes (SCIE / SSCI / EI / Scopus…)',
      'popup.indexCn': 'Chinese indexes (PKU Core / CSSCI / CSCD)',
      'popup.categoryRating': 'Ratings',
      'popup.cas': 'CAS ranking / Emerging',
      'popup.jcr': 'JCR quartile',
      'popup.if': 'Impact Factor',
      'popup.ccf': 'CCF recommendation',
      'popup.business': 'Business rankings (ABDC / ABS / FMS / VHB / CNRS)',
      'popup.cnTier': 'Chinese rankings (CAST / CCF-T / SCD / AMI / ZJU / NSFC)',
      'popup.categoryOpen': 'Open publishing',
      'popup.free': 'Free publishing / DOAJ no APC',
      'popup.categoryWarning': 'Warnings',
      'popup.warnings': 'Warnings / retractions / on hold',
      'popup.customColors': 'Custom colors',
      'popup.colorsHint': '(defaults follow the theme)',
      'popup.colorZone': 'Ranking',
      'popup.colorIndex': 'Index',
      'popup.reset': 'Restore defaults (theme + colors)',
      'popup.openSite': 'Open AILatest Journal',
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
