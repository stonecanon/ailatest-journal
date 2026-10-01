/*
 * Publication footprint page language layer.
 *
 * The page has a large amount of client-rendered copy, so keeping a second
 * HTML tree in sync would be fragile. This layer records the source text of
 * every page-owned text node/attribute and translates it when the shared
 * static language switch changes. User data (journal names, paper titles,
 * author names) is never translated unless it is one of the explicit UI
 * phrases below.
 */
(() => {
  const TEXT = {
    '我的发表足迹': 'My publication footprint',
    '把你发表过论文的期刊，收集成一面可核验的徽章墙。它和“收藏”分开：收藏是准备投稿，发表足迹是已经走过的投稿记录。': 'Collect the journals where you have published into a verifiable badge wall. It is separate from Saved: Saved is for journals you may submit to, while Footprint records submissions you have already made.',
    '点击奖杯查看发表成就；期刊卡片保留 JCR / 中科院 / 收录徽章和论文年份。': 'Open the trophy to see publication achievements. Journal cards keep JCR, CAS, indexing badges, and publication years.',
    '已识别论文': 'Papers identified',
    '发表期刊': 'Journals published in',
    '覆盖国家/地区': 'Countries/regions',
    '主要研究方向': 'Research fields',
    '查看明细 →': 'View details →',
    '投稿状态': 'Submission status',
    '插件确认后自动跟踪；这里显示已同步结果': 'Tracked after extension confirmation; synced results appear here.',
    '导入确认邮件（无插件时）': 'Import confirmation email (without the extension)',
    '暂无投稿状态': 'No submission status yet',
    '添加投稿记录后，状态会显示在这里。': 'Add a submission record to see its status here.',
    '自动跟踪：': 'Automatic tracking: ',
    '确认邮件导入只保存邮件中的可核对状态，不会开启自动跟踪。': 'Imported confirmation emails only save the status that can be verified from the message; they do not enable automatic tracking.',
    '论文清单导出': 'Paper list export',
    '只保留作者、题目、期刊、DOI 和核心收录信息，按发表年份从新到旧排列。': 'Keep authors, titles, journals, DOIs, and core index information, sorted from newest to oldest publication year.',
    '补全作者': 'Complete authors',
    '打开论文清单': 'Open paper list',
    '打开论文清单后，可在弹窗中复制或导出全部论文条目。': 'Open the paper list to copy or export all entries in a dialog.',
    '期刊徽章墙': 'Journal badge wall',
    '按期刊归并你的论文，避免同一本期刊重复占位。': 'Group your papers by journal so the same journal is not listed twice.',
    '全部年份': 'All years',
    '按发表时间（新到旧）': 'Publication date (newest first)',
    '按 IF（高到低）': 'Impact factor (high to low)',
    '一键去重': 'Deduplicate',
    '账号同步：': 'Account sync: ',
    '怎么导入？': 'How do I import?',
    '先搜索姓名，再选择属于你的作者身份。单位变化时可以多选，系统会合并论文并直接加入足迹。': 'Search your name first, then select the author profiles that are yours. Select more than one profile when your affiliation changed; papers will be merged into your footprint.',
    '搜索作者姓名': 'Search author name',
    '可多选不同单位的作者身份': 'Select profiles from different affiliations',
    '推荐': 'Recommended',
    '导入知网文献': 'Import CNKI records',
    '粘贴 GB/T 7714-2025 中文引用，可一次导入多条': 'Paste GB/T 7714-2025 citations to import several records at once',
    'ORCID / OpenAlex 作者 ID': 'ORCID / OpenAlex author ID',
    '已有唯一作者标识时直接识别': 'Use an existing author identifier',
    'DOI / BibTeX / CSV': 'DOI / BibTeX / CSV',
    '适合一次导入已发表论文清单': 'Import a list of published papers',
    'Google Scholar': 'Google Scholar',
    '可粘贴主页；也可在 Scholar 页面用插件导入': 'Paste a profile URL, or import from Scholar with the extension',
    '核对原则：': 'Verification rule: ',
    '识别结果': 'Recognition results',
    '导入后会直接显示在下方徽章墙；无法匹配期刊的记录才会留在这里。': 'Imported records appear on the badge wall. Only records that cannot be matched to a journal remain here.',
    '发表成就': 'Publication achievements',
    '根据已确认的论文和期刊自动解锁；积分只用于站内成就展示。': 'Unlocked automatically from confirmed papers and journals. Points are for in-site achievements only.',
    '被引': 'Citations',
    '积分': 'Points',
    '新晋研究者': 'Early-career researcher',
    '发表数量': 'Publications',
    '篇已确认': 'confirmed',
    '论文被引量': 'Paper citations',
    '次可核验': 'verifiable',
    '首篇': 'First paper',
    '起步': 'Getting started',
    '进阶': 'Advancing',
    '持续': 'Consistent',
    '高产': 'Prolific',
    '百篇': '100 papers',
    '初见影响': 'First impact',
    '被引起步': 'Citation start',
    '百次被引': '100 citations',
    '持续影响': 'Sustained impact',
    '高影响': 'High impact',
    '广泛传播': 'Widely cited',
    '初次发表': 'First publication',
    '完成第一篇期刊论文': 'Publish your first journal paper',
    '期刊探索者': 'Journal explorer',
    '在 5 本不同期刊发表': 'Publish in 5 different journals',
    'Q1 贡献者': 'Q1 contributor',
    '在 3 本 Q1 期刊发表': 'Publish in 3 Q1 journals',
    '跨单位经历': 'Cross-affiliation experience',
    '论文覆盖 2 个机构阶段': 'Publish across 2 affiliation periods',
    '持续发表': 'Consistent publishing',
    '连续 3 个自然年有论文': 'Publish in three consecutive calendar years',
    '国际足迹': 'International footprint',
    '覆盖 5 个国家/地区': 'Cover five countries/regions',
    '未解锁': 'Locked',
    '还差 1 年': '1 year to go',
    '还差 2 个': '2 more to go',
    '科研档案明细': 'Research record details',
    '当前足迹还没有可核验的明细数据。完成作者身份核对后，这里会自动更新。': 'No verifiable footprint details yet. This panel updates after you confirm an author profile.',
    '暂无明细': 'No details yet',
    '搜索我的作者身份': 'Find my author profile',
    '输入姓名和可选单位，先查看候选作者；单位变化时可以多选。': 'Enter a name and optional affiliation to review author candidates. Select more than one when your affiliation changed.',
    '作者姓名': 'Author name',
    '曾用单位（可选）': 'Previous affiliation (optional)',
    '搜索候选': 'Search candidates',
    '可能是你的作者身份': 'Possible author profiles',
    '已选 0 个': '0 selected',
    '暂无可核验的作者候选': 'No verifiable author candidates',
    '取消': 'Cancel',
    '加入足迹': 'Add to footprint',
    '关闭': 'Close',
    '论文清单': 'Paper list',
    '保存论文清单': 'Save paper list',
    '恢复全部论文': 'Restore all papers',
    '复制全部': 'Copy all',
    '导出纯文本': 'Export text',
    '保存当前论文清单': 'Save current paper list',
    '当前还没有可复制的论文记录。': 'There are no paper records to copy yet.',
    '当前还没有可导出的论文记录。': 'There are no paper records to export yet.',
    '已复制全部论文条目。': 'All paper entries copied.',
    '已导出全部论文条目。': 'All paper entries exported.',
    '编辑': 'Edit',
    '删除': 'Delete',
    '没有识别到可核对的期刊、题目或稿件编号；请粘贴包含这些字段的确认邮件正文。': 'No verifiable journal, title, or manuscript number was found. Paste the body of a confirmation email containing these fields.',
    '作者信息待补全': 'Author details pending',
    '期刊信息未识别': 'Journal not identified',
    '待确认导入': 'Import pending confirmation',
    '已核验': 'Verified',
    '中科院': 'CAS',
    '新锐': 'Xinrui',
    '科协': 'CAST',
    '免费发表': 'Free to publish',
    '付费发表': 'Paid publication',
    '发表年份：': 'Publication years: ',
    '刊期：': 'Frequency: ',
    '查看期刊 →': 'View journal →',
    '影响因子': 'Impact factor',
    '论文题目': 'Paper title',
    '稿件编号': 'Manuscript number',
    '准备投稿': 'Preparing',
    '已提交': 'Submitted',
    '编辑初审': 'Editorial check',
    '外审中': 'Under review',
    '返修': 'Revision',
    '已接收': 'Accepted',
    '已拒稿': 'Rejected',
    '撤稿/终止': 'Withdrawn/closed',
    '状态未识别': 'Status not identified',
    '插件自动跟踪中': 'Tracked by extension',
    '确认邮件记录': 'Confirmation email',
    '手动记录': 'Manual record'
  };

  const PATTERNS = [
    [/^发表年份：/, 'Publication years: '],
    [/^刊期：/, 'Frequency: '],
    [/^稿件编号：/, 'Manuscript number: '],
    [/^题目：/, 'Title: '],
    [/^已选 (\d+) 个$/, 'Selected $1'],
    [/^已解锁 (\d+) \/ 6$/, '$1 / 6 unlocked'],
    [/^还差 (\d+) 本$/, '$1 more journal(s)'],
    [/^还差 (\d+) 本 Q1$/, '$1 more Q1 journal(s)'],
    [/^还差 (\d+) 个机构阶段$/, '$1 more affiliation period(s)'],
    [/^还差 (\d+) 年$/, '$1 more year(s)'],
    [/^还差 (\d+) 个地区$/, '$1 more region(s)'],
    [/^已读取 (\d+) 篇公开论文/, '$1 public paper(s) loaded'],
    [/^被引 (\d+)$/, '$1 citations'],
    [/^共 (\d+) 项；/, '$1 item(s); '],
    [/^共 (\d+) 本期刊、(\d+) 篇论文。/, '$1 journal(s), $2 paper(s). ']
  ];

  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const trackedText = new Set();
  const trackedAttributes = new Set();
  let applying = false;

  function isEnglish() {
    const lang = document.documentElement?.dataset?.staticLang || document.documentElement?.lang || '';
    return !String(lang).toLowerCase().startsWith('zh');
  }

  function translate(value) {
    const source = String(value || '');
    if (!isEnglish() || !source.trim()) return source;
    const core = source.trim();
    if (TEXT[core]) return source.replace(core, TEXT[core]);
    for (const [pattern, replacement] of PATTERNS) {
      if (pattern.test(core)) return source.replace(core, core.replace(pattern, replacement));
    }
    return source;
  }

  function shouldSkip(node) {
    const parent = node.parentElement;
    return !parent || parent.closest('script,style,textarea,[data-static-i18n]');
  }

  function translateTree(root) {
    if (!root || applying) return;
    applying = true;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
      nodes.forEach((textNode) => {
        if (shouldSkip(textNode)) return;
        if (!textSources.has(textNode)) {
          textSources.set(textNode, textNode.nodeValue);
          trackedText.add(textNode);
        }
        const source = textSources.get(textNode);
        const translated = translate(source);
        if (textNode.nodeValue !== translated) textNode.nodeValue = translated;
      });

      const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll('*')] : [...root.querySelectorAll('*')];
      elements.forEach((el) => {
        if (el.matches('script,style,[data-static-i18n]')) return;
        ['title', 'aria-label', 'placeholder'].forEach((attr) => {
          if (!el.hasAttribute(attr)) return;
          if (!attributeSources.has(el)) attributeSources.set(el, {});
          const sourceMap = attributeSources.get(el);
          if (!(attr in sourceMap)) {
            sourceMap[attr] = el.getAttribute(attr);
            trackedAttributes.add({ el, attr });
          }
          const source = sourceMap[attr];
          const translated = translate(source);
          if (el.getAttribute(attr) !== translated) el.setAttribute(attr, translated);
        });
      });
    } finally {
      applying = false;
    }
  }

  function restoreSources() {
    trackedText.forEach((node) => { if (node.isConnected) node.nodeValue = textSources.get(node); });
    trackedAttributes.forEach(({ el, attr }) => { if (el.isConnected) el.setAttribute(attr, attributeSources.get(el)[attr]); });
  }

  function apply() {
    restoreSources();
    translateTree(document.body);
    document.documentElement.dataset.footprintLang = isEnglish() ? 'en' : 'zh-CN';
  }

  window.__footprintT = (value) => translate(value);
  window.addEventListener('ailatest:langchange', apply);
  const observer = new MutationObserver((records) => {
    if (applying || !isEnglish()) return;
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) translateTree(node);
    }));
  });

  function init() {
    apply();
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
