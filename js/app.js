/* AILatest Journal — front-end app (i18n + tabs + favorites + auth) */
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  // Early stub: if user clicks ★ before boot(), queue it
  window.__activateJournalTab = function(tab) {
    if (!window.__journalTabQueue) window.__journalTabQueue = [];
    window.__journalTabQueue.push(tab);
  };
  const fetchJSON = async (url) => {
    if (typeof url === 'string' && url.startsWith('data/')) url = '/' + url;
    const urlText = String(url);
    const dataPath = urlText.startsWith('/data/') ? urlText : '';
    const version = window.__BUILD_VER || '';
    if (dataPath && version && !/[?&]v=/.test(dataPath)) {
      url = dataPath + (dataPath.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(version);
    }
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    if (String(url).split('?')[0].endsWith('.gz')) {
      if (typeof DecompressionStream === 'function' && resp.body && resp.body.pipeThrough) {
        const ds = new DecompressionStream('gzip');
        const stream = resp.body.pipeThrough(ds);
        return await new Response(stream).json();
      }
      const plainUrl = String(url).replace(/\.gz(?=($|[?#]))/, '');
      if (plainUrl !== String(url)) {
        const fallbackResp = await fetch(plainUrl);
        if (fallbackResp.ok) return await fallbackResp.json();
      }
      throw new Error('gzip decompression unavailable');
    }
    return await resp.json();
  };

  const I18N = {
    zh: {
      tagline: '<b>AILatest Journal</b> — 面向科研人员的期刊检索与投稿决策工具，聚合 SCI/SSCI、中科院分区、JCR、ESI、CSSCI、北大核心、浙大目录等数据，支持收藏、评分与跨设备同步。',
      brand_title: 'Journal',
      indices: '索引', cas_zone: '中科院 2025 分区', filters: '附加筛选',
      esi: 'ESI 学科大类', all: '全部',
      z1: '1 区', z2: '2 区', z3: '3 区', z4: '4 区',
      filter_cas: '中科院',
      filter_xinrui: '新锐', filter_warning: '预警',
      domestic_sources: '国内分级来源',
      src_nsfc_mgmt: '国自然管理科学部',
      src_cnkx: '中国科协高质量目录',
      src_cssci_core: 'CSSCI 来源期刊',
      src_cssci_ext: 'CSSCI 扩展版',
      src_pku: '北大核心 (2023)',
      src_zju: '浙江大学 2024',
      src_zjucity: '高校自编目录 2023',
      src_ccft: 'CCF 中文 T 分区',
      nav_sub_inhouse: '院校自编目录',
      locked_school_a: '🔒 学校 A · 2023',
      paid_label: '付费',
      drawer_kicker: '期刊详情',
      footer_data: '© <a href="https://journal.ailatest.org">AILatest Journal</a>',
      footer_tag: '期刊检索 · 分区评级 · 投稿决策',
      footer_product: '产品',
      footer_support: '支持',
      footer_legal: '条款',
      footer_matrix: '联系矩阵',
      footer_ailatest: '关于 AILatest',
      footer_privacy_full: '隐私政策',
      footer_terms_full: '使用条款',
      footer_refund_full: '退款政策',
      tab_home: '查刊', tab_int: '国际', tab_dom: '中国', tab_fav: '收藏', tab_pick: '荐刊',
      nav_about: '关于', nav_contact: '联系',
      nav_terms: '条款', nav_privacy: '隐私', nav_refund: '退款',
      nav_index_rank: '索引排行榜', nav_subject_rank: '学科排行榜', nav_warn_rank: '预警名单', nav_extension_beta: '插件内测', nav_subscription: '订阅',
      filter_if_range: '影响因子', if_any: '不限',
      rail_int: '全球', rail_dom: '中国', rail_region: '地区', rail_in: '印度', rail_my: '马来西亚', rail_kr: '韩国', rail_pbn: '波兰', rail_isc: '伊朗', rail_scielo: '拉美', rail_rank: '榜单', rail_fav: '收藏', rail_me: '我的',
      download_center: '下载',
      loading: '加载中…',
      hero_title_int: 'SCI / SSCI 国际期刊检索',
      hero_body_int: '資料來源：<b>Web of Science Core Collection</b>（SCIE / SSCI / AHCI / ESCI）· 更新至 2026-06-15，並合併 <b>EI Compendex</b>（2026-07-09）、<b>Inspec</b>（2026-04）、<b>FSTA</b> 全文清單與 <b>CAB Abstracts</b> serial report（2013-09）。',
      src_cnkx: '中国科协高质量目录',
      src_cnki_major: '中文期刊目录',
      hero_note: '徽章语义：<b>收录</b> 显示 SCIE/SSCI/AHCI/ESCI/EI、Scopus、MEDLINE、Inspec、FSTA、CABI 等数据库覆盖 · <b>等级</b> 显示中科院/JCR/新锐/CCF/ABDC/ABS/FMS/VHB/CNRS/AMI 等评价级别 · <b>开放费用</b> 显示 FREE/OAJ/DOAJ · <b>风险</b> 显示预警、WoS On Hold 与 Retraction Watch 撤稿记录。',
      hero_title_fav: '我的收藏',
      hero_body_fav: '点击任意期刊右侧的 <b>★</b> 可加入收藏。未登录时保存在本机 localStorage；登录后自动同步到云端，可跨设备访问。',
      hero_title_pick: '智能荐刊',
      hero_body_pick: '采用自研大模型算法，深度分析你的研究主题与海量期刊数据的匹配度，智能推荐最合适的目标期刊。Free 登录后共 10 次 AI 荐刊（用完即止）。',
      pick_placeholder: '输入论文标题、摘要或关键词，开始推荐期刊',
      pick_search_btn: '荐刊',
      pick_filter_topics: '匹配研究领域 (Topics)',
      pick_filter_if: '限 IF >',
      pick_filter_zone: '中科院分区',
      pick_filter_sci: 'SCIE',
      pick_filter_ssci: 'SSCI',
      pick_filter_ahci: 'AHCI',
      pick_filter_compre: '排除综合性期刊',
      pick_history: '搜索历史', pick_history_clear: '清空',
      results_all: '全部期刊', load_more: '加载更多',
      col_name: '期刊 Title', col_free: '免费', col_abbr: '缩写 Abbr', col_badges: '索引 / 分区',
      col_if: 'IF', col_cycle: '审稿周期',
      col_index: '索引收录', col_cas: '学科分区',
      filter_idx: '收录', filter_tier: '分区', filter_extra: '其他',
      filter_open: '开放', filter_free_only: '免费发表',
      /* filter_cas / filter_xinrui 见上方短标签 */
      filter_topic: '学科',
      filter_free: '免费发表', filter_nsc: 'Nature/Science/Cell',
      jcr_label: 'JCR 分区', abdc_label: 'ABDC', abs_label: 'ABS',
      zone_top: 'TOP', xinrui_top: 'TOP',
      oa_sf_label: '研究主题', oa_sf_ph: '筛选主题…', oa_sf_clear: '清空选择',
      brand_zhikan: '知刊',
      col_cat: 'ESI / 中科院大类',
      hero_title_dom: '国内学术期刊分级目录',
      hero_body_dom: '<b>中国科协 高质量科技期刊分级目录 (2025-12 修订)</b> 共 11,084 条 / 59 学科领域；<b>中文期刊目录</b> 共 7,755 条 / 10 大学科分类，CSSCI / 北大核心 / CCF 中文以徽章形式叠加；<b>浙江大学 2024 版</b> 与 <b>高校自编目录 2023</b>（付费解锁）。',
      hero_note_dom: 'CSSCI / 北大核心为扫描 PDF OCR 提取，可能存在个别错字。',
      hero_title_in: '印度 UGC-CARE 期刊目录',
      hero_body_in: '印度 UGC-CARE Group I 期刊正表，支持按题名、出版社、ISSN、学科检索。克隆/假冒期刊预警名单暂不展示。',
      india_subject: '学科',
      india_source_note: 'UGC-CARE 中央列表 2024 年 10 月后不再持续更新；本页仅作为历史目录与投稿核验线索。',
      hero_title_my: '马来西亚 MyCite / ERA 期刊目录',
      hero_body_my: '默认显示 MyCite 2025 记录；正式判断马来西亚官方认可资格时，请优先以 MyCite 2025 官方 PDF 为准。ERA 目前使用 2023 Submitted Journal List。',
      malaysia_source_note: 'MyCite 在线库包含 2014-2025 历史记录；MyJurnal 采集时不可连接，暂未接入。',
      search_int: '搜索：期刊全称 / 官方缩写 / 社群缩写 / ISSN / 中文刊名',
      search_dom: '搜索：刊名 / ISSN / CN 号（跨库搜索）',
      search_fav: '搜索收藏：期刊 / 缩写 / ISSN',
      search_home_ph: '搜索期刊名、ISSN…',
      search_submit_hint: '搜索',
      search_button: 'Search',
      home_subtitle: '全球期刊检索与推荐平台',
      home_v4_line1: '投稿之前，先把期刊',
      home_v4_line2: '看清楚',
      home_v4_line3: '',
      home_v4_sub: '检索全球期刊，对比分区、影响因子与开放获取信息 — 一站完成。',
      home_stat_journals: '收录期刊',
      home_stat_views: '累计浏览',
      home_stat_visitors: '服务用户',
      home_stat_jviews: '期刊详情',
      home_hot_title: '热点期刊',
      home_hot_sub: '近 30 天浏览量 Top 5',
      home_hot_views: '次浏览',
      home_hot_empty: '近 30 天暂无足够浏览数据',
      home_hot_loading: '加载热点中…',
      home_hot_ai: 'AI 荐刊 →',
      nav_features: '功能',
      nav_how: '怎么用',
      nav_pricing: '订阅',
      nav_terms: '条款',
      nav_privacy: '隐私',
      nav_refund: '退款',
      download_center: '下载',
      home_feat_kicker: 'Features',
      home_feat_title: '功能介绍',
      home_feat_lead: '检索全球期刊，对比分区、影响因子与开放获取信息 — 一站完成。库、分区、风险信号、荐刊与插件徽章在同一条工作流里。',
      home_feat_1_t: '全球与地区期刊库',
      home_feat_1_d: 'SCIE / SSCI / AHCI / ESCI / EI、Scopus、DOAJ、MEDLINE；中国、印度、韩国、马来西亚等地区站。',
      home_feat_2_t: '分区 · 指标 · 风险',
      home_feat_2_d: 'JCR 影响因子与 Quartile、中科院分区（含 TOP）、CCF / ABDC / ABS；预警与撤稿提示。',
      home_feat_3_t: '收藏与清单',
      home_feat_3_d: '登录后云端收藏、多清单整理；对比时随时回看目标刊。',
      home_feat_4_t: '智能荐刊',
      home_feat_4_d: '输入论文标题 / 摘要 / 关键词，按主题与库覆盖匹配目标期刊（搜索框切到「荐刊」）。',
      home_feat_5_t: '浏览器插件',
      home_feat_5_d: 'Scholar / PubMed / 知网等页面展示分区与收录徽章，少开一个标签页。',
      home_feat_6_t: '开放获取与 APC',
      home_feat_6_d: 'OAJ / DOAJ 信号与是否可免费发表路径（按订阅档位展示深度字段）。',
      home_how_kicker: 'How it works',
      home_how_title: '怎么用',
      home_how_lead: '从打开首页到定稿目标刊，四步走完。',
      home_how_1_t: '搜索或荐刊', home_how_1_d: '刊名 / ISSN 直接查；或切换「荐刊」贴标题摘要。',
      home_how_2_t: '筛选分区与库', home_how_2_d: '按 JCR、中科院、索引、学科收窄候选列表。',
      home_how_3_t: '看详情与风险', home_how_3_d: '影响因子、审稿周期、OA / 预警信息一页看清。',
      home_how_4_t: '收藏或导出', home_how_4_d: '加入清单；插件在阅读页继续对照徽章。',
      home_cta_search: '打开查刊', home_cta_pick: '试用荐刊',
      home_rank_kicker: 'Rankings', home_rank_title: '榜单',
      home_rank_lead: '索引看板 · 学科榜 · 预警 · 热门浏览',
      home_rank_tab_index: '索引', home_rank_tab_subject: '学科',
      home_rank_tab_warn: '预警', home_rank_tab_hot: '热门',
      home_rank_board_index: '索引看板', home_rank_board_risk: '预警 / 风险',
      home_rank_board_subject: '学科榜',
      home_rank_all: '全部 →',
      home_rank_pill_board: 'Board',
      home_rank_risk_cas: '中科院预警', home_rank_risk_citic: '中信所预警',
      home_rank_idx_badge: '索引', home_rank_sub_badge: '学科', home_rank_warn_badge: '风险',
      home_rank_idx_d: 'SCIE / SSCI / AHCI / ESCI / EI / Scopus / MEDLINE 等收录入口。',
      home_rank_sub_d: '按 Web of Science 学科浏览 IF 靠前期刊与主题榜单。',
      home_rank_warn_d: '中科院预警、中信所预警、On Hold / Under Review 等信号。',
      home_rank_enter: '进入 →',
      home_price_kicker: 'Pricing', home_price_title: '订阅方案',
      home_price_lead: '网站查刊 Free 永久可用。Pro / Max 提升插件深度、额度与 AI 荐刊配额。教育邮箱另享教育价（登录后解锁）。',
      home_price_lead_cn: '网站查刊 Free 永久可用。中国区 Pro / Max 为一次性 365 天访问权，不自动续费。',
      home_price_billing: '价格 USD · 年付 · 下方划线为原价（更划算）',
      home_price_toggle_year: '年付',
      home_price_toggle_month: '月付',
      home_price_save: '更划算',
      home_price_billing_group: '计费周期',
      home_price_pro_was: '原价 $11.99',
      home_price_max_was: '原价 $14.99',
      home_price_forever: '/ 永久', home_price_year: '/ 年', home_price_month: '/ 月', home_price_rec: '推荐',
      home_price_more: '查看完整方案对比 →',
      home_price_free_d: '适合日常检索与轻量试用',
      home_price_free_1: '网站完整检索与详情', home_price_free_2: '本站收藏最多 5 本期刊', home_price_free_3: 'AI 荐刊试用次数',
      home_price_free_cta: '继续免费使用',
      home_price_pro_d: '高频刷刊 · 插件进阶',
      home_price_pro_1: '中科院 / TOP / 新锐徽章', home_price_pro_2: '云收藏 50 · 清单 5', home_price_pro_3: 'AI 荐刊 500 credits/月',
      home_price_pro_cta: '订阅 Pro · 年付',
      home_price_max_d: '完整工作流 · 高额度 AI',
      home_price_max_1: '预警 / 撤稿 / 科协风险', home_price_max_2: '导出与高额度荐刊', home_price_max_3: '地区站与设备额度更高',
      home_price_max_cta: '订阅 Max · 年付',
      home_price_note: '教育价仅限 .edu / .edu.cn / .ac.* 等机构邮箱登录后支付',
      home_price_note_cn: '中国区一次性购买：365 天到期后可重新购买；人民币金额按页面加载时公开汇率估算，实际结算以 Creem 收银台为准；功能、额度与退款以条款为准。',
      home_price_payment_note: '支付方式：支付宝 · Apple Pay · Google Pay（以 Creem 收银台实际显示为准）',
      home_price_more: '',
      home_dl_kicker: 'Download', home_dl_title: '下载',
      home_dl_lead: '网页可直接用。需要时再装插件、Skill 或 MCP。',
      home_dl_plat_browser: 'Browser',
      home_dl_plat_browser_cta: '添加插件',
      home_dl_plat_skill_cta: '下载',
      home_dl_plat_mcp_cta: '复制命令',
      home_dl_plat_mcp_meta: '在线公测 · 复制即用',
      home_dl_plat_mobile: 'Mobile',
      home_dl_plat_mobile_cta: '即将推出',
      home_dl_plat_mobile_meta: 'iOS / Android',
      home_dl_ext_badge: '插件', home_dl_ext_t: 'Chrome / Edge 内测版',
      home_dl_ext_d: '在 Google Scholar、PubMed、知网等页面显示分区徽章，并支持文献卡片保存。',
      home_dl_ext_cta: '下载 ZIP',
      home_dl_ext_stat_pre: '累计下载', home_dl_ext_stat_post: '次',
      home_dl_skill_badge: 'Skill', home_dl_skill_t: '写作与荐刊工作流',
      home_dl_skill_d: '给 Codex / AI 助手接入期刊搜索与荐刊接口，适合写作和投稿。',
      home_dl_skill_copy: '复制 Skill 安装文本', home_dl_skill_cta: '下载安装包', home_dl_skill_src: 'Skill 源码',
      home_dl_skill_stat_pre: '下载', home_dl_skill_stat_post: '次',
      home_dl_mcp_badge: 'MCP', home_dl_mcp_t: '在线公测服务',
      home_dl_mcp_d: '无需下载，即可连接 Codex、Claude 等客户端。',
      home_dl_mcp_cta: '复制运行代码', home_dl_mcp_stat: '在线服务 · 复制后运行',
      home_dl_soon_badge: '更多', home_dl_soon_t: '微信 / 安卓 / iOS',
      home_dl_soon_d: '小程序与原生客户端规划中，上线后将在此提供入口。',
      home_dl_soon_cta: '敬请期待',
      home_ct_kicker: 'About & contact', home_ct_title: '关于与联系',
      home_ct_lead: 'AILatest Journal 聚合公开评级与元数据，供学术检索与投稿参考。数据以各评价机构官方发布为准。',
      home_ct_info_t: '产品信息', home_ct_info_d: '数据来源与截止时间、免责声明见关于页。问题与纠错欢迎来信。',
      home_ct_data: '数据说明', home_ct_email: '邮箱：contact@ailatest.org', home_ct_page: '打开联系页 →',
      showing: '显示', of: '条 / 共', total_items: '条',
      empty: '未找到匹配的期刊',
      empty_fav: '还没有收藏。切到「国际 SCI/SSCI」点任意一行右边的 ★ 就能收藏。',
      login: '登录', logout: '登出',
      fav_added: '已收藏', fav_removed: '已移除',
      syncing: '同步中…', synced: '已同步',
      wos_subjects: 'WoS 细分学科',
      wos_search_ph: '筛选学科（A-Z）…',
      cnkx_domain: '学科领域', cnkx_sub: '细分学科',
      filter_free_only: '只看免费发表', wos_clear_title: '清空选择',
    },
    en: {
      tagline: '<b>AILatest Journal</b> — Journal search & submission decision tool for researchers. Aggregates SCI/SSCI, CAS tiers, JCR, ESI, CSSCI, PKU Core, ZJU directory and more. Favorites, ratings, cross-device sync.',
      brand_title: 'Journal',
      indices: 'Indices', cas_zone: 'CAS 2025 Tier', filters: 'Filters',
      esi: 'ESI Categories', all: 'All',
      z1: 'T1', z2: 'T2', z3: 'T3', z4: 'T4',
      filter_cas: 'CAS',
      filter_xinrui: 'Emerging', filter_warning: 'Risk',
      domestic_sources: 'Domestic Sources',
      src_nsfc_mgmt: 'NSFC Management',
      src_cnkx: 'CAST Tiered Directory',
      src_cnki_major: 'Chinese Journal Directory',
      src_cssci_core: 'CSSCI Core',
      src_cssci_ext: 'CSSCI Extended',
      src_pku: 'PKU Core (2023)',
      src_zju: 'ZJU 2024',
      src_zjucity: 'School A 2023',
      src_ccft: 'CCF-T (Chinese)',
      nav_sub_inhouse: 'In-house School Directories',
      locked_school_a: '🔒 School A · 2023',
      paid_label: 'Paid',
      drawer_kicker: 'Journal Details',
      footer_data: '© <a href="https://journal.ailatest.org">AILatest Journal</a>',
      footer_tag: 'Search · rankings · submission decisions',
      footer_product: 'Product',
      footer_support: 'Support',
      footer_legal: 'Legal',
      footer_matrix: 'Contact matrix',
      footer_ailatest: 'About AILatest',
      footer_privacy_full: 'Privacy',
      footer_terms_full: 'Terms',
      footer_refund_full: 'Refund',
      tab_home: 'Journals', tab_int: 'International', tab_dom: 'China', tab_fav: 'Favorites', tab_pick: 'Recommend',
      nav_about: 'About', nav_contact: 'Contact',
      nav_terms: 'Terms', nav_privacy: 'Privacy', nav_refund: 'Refund',
      nav_index_rank: 'Index Rankings', nav_subject_rank: 'Subject Rankings', nav_warn_rank: 'Warning List', nav_extension_beta: 'Extension beta', nav_subscription: 'Subscribe',
      filter_if_range: 'Impact Factor', if_any: 'Any',
      rail_int: 'Global', rail_dom: 'China', rail_region: 'Regions', rail_in: 'India', rail_my: 'Malaysia', rail_kr: 'Korea', rail_pbn: 'Poland', rail_isc: 'Iran', rail_scielo: 'LatAm', rail_rank: 'Rankings', rail_fav: 'Saved', rail_me: 'Me',
      download_center: 'Download',
      loading: 'Loading…',
      hero_title_int: 'International SCI / SSCI Search',
      hero_body_int: 'Source: <b>Web of Science Core Collection</b> (SCIE / SSCI / AHCI / ESCI), updated 2026-06-15, merged with <b>EI Compendex</b> (2026-07-09), <b>Inspec</b> (Apr 2026), the <b>FSTA</b> full-text list, and the <b>CAB Abstracts</b> serial report (Sep 2013).',
      hero_note: 'Badge legend: <b>Indexed</b> covers SCIE/SSCI/AHCI/ESCI/EI, Scopus, MEDLINE, Inspec, FSTA, CABI and related databases · <b>Ranking</b> covers CAS/JCR/Emerging/CCF/ABDC/ABS/FMS/VHB/CNRS/AMI tiers · <b>Access & Fees</b> covers FREE/OAJ/DOAJ · <b>Caution</b> covers warning lists, WoS On Hold and Retraction Watch records.',
      hero_title_fav: 'My Favorites',
      hero_body_fav: 'Click the <b>★</b> on any row to bookmark. Saved locally when signed-out; syncs to the cloud when signed-in.',
      hero_title_pick: 'Pick for me',
      hero_body_pick: 'Powered by proprietary large-model algorithm — intelligently matches your research topic against millions of journal data points to recommend the best target journals. Free: 10 AI picks total after sign-in.',
      pick_placeholder: 'Enter a paper title, abstract, or keywords to recommend journals',
      pick_search_btn: 'Recommend',
      pick_filter_topics: 'Match Topics',
      pick_filter_if: 'IF >',
      pick_filter_zone: 'CAS Zone',
      pick_filter_sci: 'SCIE',
      pick_filter_ssci: 'SSCI',
      pick_filter_ahci: 'AHCI',
      pick_filter_compre: 'Exclude multidisciplinary',
      pick_history: 'Search History', pick_history_clear: 'Clear',
      results_all: 'All journals', load_more: 'Load more',
      col_name: 'Journal Title', col_free: 'FREE TO PUBLISH', col_abbr: 'Abbr', col_badges: 'Indices / Tier',
      col_if: 'IF', col_cycle: 'Review Cycle',
      col_index: 'Indexed', col_cas: 'Categories',
      filter_idx: 'Index', filter_tier: 'Tier', filter_extra: 'More',
      filter_open: 'Access', filter_free_only: 'Free to publish',
      filter_topic: 'Topics',
      filter_free: 'FREE to Publish', filter_nsc: 'Nature/Science/Cell',
      jcr_label: 'JCR Quartile', abdc_label: 'ABDC', abs_label: 'ABS',
      zone_top: 'TOP', xinrui_top: 'TOP',
      oa_sf_label: 'Research Topics', oa_sf_ph: 'Filter topics…', oa_sf_clear: 'Clear selection',
      brand_zhikan: '',
      col_cat: 'ESI / CAS Major',
      hero_title_dom: 'Domestic Chinese Journal Directories',
      hero_body_dom: '<b>China Association for Science and Technology (CAST) High-Quality Sci-Tech Journal Tiered Directory (Dec 2025)</b> — 11,084 journals across 59 disciplines; <b>Chinese Journal Directory</b> — 7,755 journals across 10 subject categories, with CSSCI / PKU Core / CCF Chinese badges; <b>ZJU 2024</b>; <b>School A 2023</b> (paywalled).',
      hero_note_dom: 'CSSCI / PKU Core extracted via OCR from scanned PDF; minor typos possible.',
      hero_title_in: 'India UGC-CARE Journal Directory',
      hero_body_in: 'UGC-CARE Group I positive journal list for India. Search by title, publisher, ISSN, E-ISSN, or subject. Cloned / fake journal warning lists are intentionally not shown.',
      india_subject: 'Subject',
      india_source_note: 'UGC-CARE central list has not been updated after October 2024; use this page as historical directory and verification context.',
      hero_title_my: 'Malaysia MyCite / ERA Journal Directory',
      hero_body_my: 'MyCite 2025 records are shown by default. For formal Malaysia recognition decisions, use the official MyCite 2025 PDF as primary evidence. ERA currently uses the 2023 Submitted Journal List.',
      malaysia_source_note: 'The MyCite online database includes historical records from 2014-2025. MyJurnal was unreachable during collection and is not included.',
      search_int: 'Search: title / abbr / acronym / ISSN / Chinese name',
      search_dom: 'Search: title / ISSN / CN (cross-source)',
      search_fav: 'Search favorites: title / acronym / ISSN',
      search_home_ph: 'Search journal name, ISSN…',
      search_submit_hint: 'search',
      search_button: 'Search',
      home_subtitle: 'Journal search & submission decision tool for researchers',
      home_v4_line1: 'See the journal clearly ',
      home_v4_line2: 'before you submit',
      home_v4_line3: '',
      home_v4_sub: 'Search global journals, compare rankings and open access signals — in\u00a0one\u00a0place.',
      pick_search_btn: 'Recommend',
      home_stat_journals: 'Journals',
      home_stat_views: 'Page views',
      home_stat_visitors: 'Visitors',
      home_stat_jviews: 'Journal views',
      home_hot_title: 'Hot journals',
      home_hot_sub: 'Top 5 by views · last 30 days',
      home_hot_views: 'views',
      home_hot_empty: 'Not enough view data for the last 30 days',
      home_hot_loading: 'Loading hot journals…',
      home_hot_ai: 'AI Recommend →',
      nav_features: 'Features',
      nav_how: 'How it works',
      nav_pricing: 'Pricing',
      nav_terms: 'Terms',
      nav_privacy: 'Privacy',
      nav_refund: 'Refund',
      download_center: 'Download',
      home_feat_kicker: 'Features',
      home_feat_title: 'What you get',
      home_feat_lead: 'Search global journals and compare rankings, impact factors and open-access signals — in one place.',
      home_feat_1_t: 'Global & regional catalogs',
      home_feat_1_d: 'SCIE / SSCI / AHCI / ESCI / EI, Scopus, DOAJ, MEDLINE; China, India, Korea, Malaysia and more.',
      home_feat_2_t: 'Rankings · metrics · risk',
      home_feat_2_d: 'JCR IF & quartiles, CAS zones (incl. TOP), CCF / ABDC / ABS; warning and retraction signals.',
      home_feat_3_t: 'Favorites & lists',
      home_feat_3_d: 'Cloud favorites after sign-in; organize shortlists while comparing targets.',
      home_feat_4_t: 'AI journal picks',
      home_feat_4_d: 'Paste a title / abstract / keywords and switch the search bar to Recommend.',
      home_feat_5_t: 'Browser extension',
      home_feat_5_d: 'Badges on Scholar / PubMed / CNKI pages so you open fewer tabs.',
      home_feat_6_t: 'OA & APC signals',
      home_feat_6_d: 'OAJ / DOAJ and free-to-publish paths (deeper fields by plan).',
      home_how_kicker: 'How it works',
      home_how_title: 'How it works',
      home_how_lead: 'From the homepage to a shortlist — four steps.',
      home_how_1_t: 'Search or recommend', home_how_1_d: 'Search by title / ISSN, or switch to Recommend with your abstract.',
      home_how_2_t: 'Filter rankings', home_how_2_d: 'Narrow by JCR, CAS, index and subject.',
      home_how_3_t: 'Review details', home_how_3_d: 'IF, review cycle, OA and risk signals on one page.',
      home_how_4_t: 'Save or export', home_how_4_d: 'Add to lists; keep badges with you in the extension.',
      home_cta_search: 'Start searching', home_cta_pick: 'Try recommend',
      home_rank_kicker: 'Rankings', home_rank_title: 'Rankings',
      home_rank_lead: 'Index boards · subjects · warnings · hot views',
      home_rank_tab_index: 'Indexes', home_rank_tab_subject: 'Subjects',
      home_rank_tab_warn: 'Warnings', home_rank_tab_hot: 'Hot',
      home_rank_board_index: 'Index boards', home_rank_board_risk: 'Warning / risk',
      home_rank_board_subject: 'Subject boards',
      home_rank_all: 'All →',
      home_rank_pill_board: 'Board',
      home_rank_risk_cas: 'CAS warning list', home_rank_risk_citic: 'CITIC warning list',
      home_rank_idx_badge: 'Index', home_rank_sub_badge: 'Subject', home_rank_warn_badge: 'Risk',
      home_rank_idx_d: 'SCIE / SSCI / AHCI / ESCI / EI / Scopus / MEDLINE and more.',
      home_rank_sub_d: 'Browse top journals by Web of Science subject.',
      home_rank_warn_d: 'CAS / CITIC warnings, On Hold and Under Review signals.',
      home_rank_enter: 'Open →',
      home_price_kicker: 'Pricing', home_price_title: 'Plans',
      home_price_lead: 'Website search stays Free forever. Pro / Max unlock extension depth, quotas and AI picks. Edu emails get edu pricing after sign-in.',
      home_price_lead_cn: 'Website search stays Free forever. China Pro / Max plans are one-time 365-day passes with no auto-renewal.',
      home_price_billing: 'USD · yearly · strikethrough = list price (best value)',
      home_price_toggle_year: 'Yearly',
      home_price_toggle_month: 'Monthly',
      home_price_save: 'Save',
      home_price_billing_group: 'Billing period',
      home_price_pro_was: 'Was $11.99',
      home_price_max_was: 'Was $14.99',
      home_price_forever: '/ forever', home_price_year: '/ year', home_price_month: '/ month', home_price_rec: 'Best',
      home_price_more: 'Full plan comparison →',
      home_price_free_d: 'Everyday search & light trials',
      home_price_free_1: 'Full website search & details', home_price_free_2: 'Save up to 5 journals', home_price_free_3: 'Limited AI pick trial',
      home_price_free_cta: 'Stay on Free',
      home_price_pro_d: 'Power users · extension upgrades',
      home_price_pro_1: 'CAS / TOP / emerging badges', home_price_pro_2: '50 cloud favorites · 5 lists', home_price_pro_3: '500 AI credits / month',
      home_price_pro_cta: 'Subscribe Pro · yearly',
      home_price_max_d: 'Full workflow · high AI quota',
      home_price_max_1: 'Warning / retraction / CAST risk', home_price_max_2: 'Export & high AI quota', home_price_max_3: 'More regions & devices',
      home_price_max_cta: 'Subscribe Max · yearly',
      home_price_note: 'Edu pricing requires institutional email (.edu / .edu.cn / .ac.*) after sign-in',
      home_price_note_cn: 'China one-time passes last 365 days and can be purchased again after expiry; CNY amounts are estimates from the public rate loaded on the page, while final settlement follows the Creem checkout; features, quotas and refunds follow the Terms.',
      home_price_payment_note: 'Payment methods: Alipay · Apple Pay · Google Pay (as shown in Creem checkout)',
      home_price_more: '',
      home_dl_kicker: 'Download', home_dl_title: 'Downloads',
      home_dl_lead: 'Use the web app as-is. Add the extension, Skill, or MCP when you need them.',
      home_dl_plat_browser: 'Browser',
      home_dl_plat_browser_cta: 'Add extension',
      home_dl_plat_skill_cta: 'Download',
      home_dl_plat_mcp_cta: 'Copy command',
      home_dl_plat_mcp_meta: 'Online public beta · paste & run',
      home_dl_plat_mobile: 'Mobile',
      home_dl_plat_mobile_cta: 'Coming soon',
      home_dl_plat_mobile_meta: 'iOS / Android',
      home_dl_ext_badge: 'Extension', home_dl_ext_t: 'Chrome / Edge beta',
      home_dl_ext_d: 'Ranking badges on Google Scholar, PubMed, CNKI and more; save literature cards.',
      home_dl_ext_cta: 'Download ZIP',
      home_dl_ext_stat_pre: 'Downloads', home_dl_ext_stat_post: '',
      home_dl_skill_badge: 'Skill', home_dl_skill_t: 'Writing & recommend workflow',
      home_dl_skill_d: 'Connect Codex / AI assistants to journal search and recommend APIs.',
      home_dl_skill_copy: 'Copy Skill install text', home_dl_skill_cta: 'Download package', home_dl_skill_src: 'Source',
      home_dl_skill_stat_pre: 'Downloads', home_dl_skill_stat_post: '',
      home_dl_mcp_badge: 'MCP', home_dl_mcp_t: 'Online beta service',
      home_dl_mcp_d: 'No download — connect Codex, Claude and other MCP clients.',
      home_dl_mcp_cta: 'Copy command', home_dl_mcp_stat: 'Online · paste and run',
      home_dl_soon_badge: 'More', home_dl_soon_t: 'WeChat / Android / iOS',
      home_dl_soon_d: 'Mini program and native apps are planned — entries will appear here.',
      home_dl_soon_cta: 'Coming soon',
      home_ct_kicker: 'About & contact', home_ct_title: 'About & contact',
      home_ct_lead: 'AILatest Journal aggregates public rankings and metadata for academic search. Always verify with official sources.',
      home_ct_info_t: 'Product info', home_ct_info_d: 'Data sources, cutoffs and disclaimer live on the About page.',
      home_ct_data: 'Data notes', home_ct_email: 'Email: contact@ailatest.org', home_ct_page: 'Contact page →',
      showing: 'Showing', of: 'of', total_items: '',
      empty: 'No journals match.',
      empty_fav: 'No favorites yet. Switch to Int’l SCI/SSCI and click ★ on any row to bookmark.',
      login: 'Sign in', logout: 'Sign out',
      fav_added: 'Saved', fav_removed: 'Removed',
      syncing: 'Syncing…', synced: 'Synced',
      wos_subjects: 'WoS Subjects',
      cnkx_domain: 'Domain', cnkx_sub: 'Sub-field',
      wos_search_ph: 'Filter subjects (A-Z)…',
      filter_free_only: 'FREE only', wos_clear_title: 'Clear selection',
    },
  };



  // Two-language UI layer. Journal titles / ISSN / ranking values remain source-language data.
  I18N['zh-CN'] = I18N.zh;
  I18N['zh-TW'] = {
    ...I18N.zh,
    tagline: '<b>AILatest Journal</b> — 面向科研人員的期刊檢索與投稿決策工具，聚合 SCI/SSCI、中科院分區、JCR、ESI、CSSCI、北大核心、浙大目錄等資料，支援收藏、評分與跨裝置同步。',
 brand_title: 'Journal',
    indices: '索引', cas_zone: '中科院 2025 分區', filters: '附加篩選', all: '全部',
    filter_xinrui: '新銳分區', filter_warning: '預警', domestic_sources: '中國分級來源',
    src_cnkx: '中國科協高品質目錄', src_cssci_core: 'CSSCI 來源期刊', src_cssci_ext: 'CSSCI 擴展版', src_pku: '北大核心 (2023)', src_zju: '浙江大學 2024', src_ccft: 'CCF 中文 T 分區', nav_sub_inhouse: '院校自編目錄', paid_label: '付費', drawer_kicker: '期刊詳情',
        tab_home: '查刊', tab_int: '國際', tab_dom: '中國', tab_fav: '收藏', tab_pick: '薦刊',
    rail_int: '國際期刊', rail_dom: '中國期刊', rail_fav: '收藏', rail_me: '我的',
    download_center: '下載',
    loading: '載入中…',
    hero_title_int: 'SCI / SSCI 國際期刊檢索',
    hero_body_int: '資料來源：<b>Web of Science Core Collection</b>（SCIE / SSCI / AHCI / ESCI）· 更新至 2026-06-15，並合併 <b>EI Compendex</b> 期刊目錄（2026-07-09）。',
    hero_note: '徽章語義：<b>SCIE/SSCI/AHCI/ESCI/EI</b> 索引收錄 · <b>中科院</b> 2025 大類分區（1-4 區，TOP 標誌） · <b>JCR Q</b> Quartile（Q1-Q4） · <b>新銳</b> 2026 新銳版分區 · <b>CCF</b> 中國計算機學會 2026 推薦（A/B/C） · <b>ABDC</b> 澳洲經管期刊分級（A*/A/B/C） · <b>ABS</b> 英國 Chartered ABS Academic Journal Guide 2024（4*/4/3/2/1，僅經管商科） · <b>T1/T2/T3</b> 中國科協 2025 高質量期刊分級 · <b>⚠ Warning</b> 國際期刊預警名單。',
    hero_title_dom: '中國學術期刊分級目錄', hero_title_fav: '我的收藏', hero_title_pick: '幫我選刊',
    hero_body_fav: '點擊任一期刊右側的 <b>★</b> 可加入收藏。未登入時保存在本機 localStorage；登入後自動同步到雲端。',
    hero_body_pick: '敬請期待。這裡將根據你的研究主題、影響因子區間、審稿週期、版面費、收錄索引等條件推薦目標期刊。未來更新。',
    pick_coming_title: '敬請期待', pick_coming_desc: '未來更新', results_all: '全部期刊', load_more: '載入更多',
    col_name: '期刊 Title', col_free: '免費', col_abbr: '縮寫 Abbr', col_badges: '索引 / 分區', search_int: '搜尋：期刊全稱 / 官方縮寫 / ISSN / 中文刊名', search_dom: '搜尋：中文刊名 / 英文刊名 / ISSN / CN 號', search_fav: '搜尋收藏：期刊 / 縮寫 / ISSN',
      search_home_ph: '搜尋期刊名、ISSN…',
      home_subtitle: '面向科研人員的期刊檢索與投稿決策工具', showing: '顯示', of: '條 / 共', total_items: '條', empty: '未找到匹配的期刊', login: '登入', logout: '登出', fav_added: '已收藏', fav_removed: '已移除', syncing: '同步中…', synced: '已同步', wos_subjects: 'WoS 細分學科', wos_search_ph: '篩選學科（A-Z）…', cnkx_domain: '學科領域', cnkx_sub: '細分學科', wos_clear_title: '清空選擇', filter_free_only: '只看免費發表'
  };
  Object.assign(I18N, {
    ja: {
      ...I18N.en,
      tagline: '<b>AILatest Journal</b> — 研究者向けのジャーナル検索・投稿判断ツール。SCI/SSCI、CAS区分、JCR、ESI、CSSCI、PKU Core、ZJU などを統合。',
      brand_title: 'Journal',
      brand_zhikan: '知刊',
      indices: '索引', cas_zone: 'CAS 2025 区分', filters: 'フィルター', all: 'すべて', filter_xinrui: 'Emerging 区分', filter_warning: '警告リスト', domestic_sources: '中国国内ソース',
      tab_home: 'ジャーナル', tab_int: '国際', tab_dom: '中国', tab_fav: 'お気に入り', tab_pick: '投稿先を選ぶ', loading: '読み込み中…',
      hero_title_int: 'SCI / SSCI 国際ジャーナル検索',
      hero_body_int: 'データソース：<b>Web of Science Core Collection</b>（SCIE / SSCI / AHCI / ESCI、2026-06-15更新）に <b>EI Compendex</b>（2026-07-09）を統合。<b>JCR 2025</b> 索引、<b>ESI</b> 22分野、<b>CAS 2025</b> 区分、<b>ShowJCR</b> JCR 2026リリース・2025指標（IF / 区分 / ランク）、Emerging、CCF 2026、警告リストを収録。合計 <b id="total">—</b> 誌。',
      hero_note: 'バッジ凡例：<b>SCIE/SSCI/AHCI/ESCI/EI</b> 索引収録 · <b>CAS</b> CAS 2025 大区分（1-4区、TOP表示） · <b>JCR Q</b> Quartile（Q1-Q4） · <b>Emerging</b> CAS 2026 新興版区分 · <b>CCF</b> CCF 2026 推薦（A/B/C） · <b>ABDC</b> 豪州経営ジャーナルランキング（A*/A/B/C） · <b>ABS</b> Chartered ABS Academic Journal Guide 2024（4*/4/3/2/1、経営・商学のみ） · <b>T1/T2/T3</b> 中国科协 2025 高品質ジャーナル区分 · <b>⚠ Warning</b> 国際ジャーナル警告リスト。',
      hero_title_dom: '中国学術ジャーナル区分', hero_title_fav: 'お気に入り', hero_title_pick: '投稿先を選ぶ', hero_body_fav: '<b>★</b> でお気に入りに追加できます。', hero_body_pick: '近日公開。研究テーマ、IF範囲、査読期間、APC、索引条件から投稿候補を推薦します。', pick_coming_title: '近日公開', pick_coming_desc: '今後更新予定', results_all: 'すべてのジャーナル', load_more: 'さらに読み込む', col_name: 'ジャーナル Title', col_free: '無料', col_abbr: '略称 Abbr', col_badges: '索引 / 区分', search_int: '検索：タイトル / 略称 / ISSN / 中国語名', search_dom: '検索：中国語名 / 英語名 / ISSN / CN', search_fav: 'お気に入りを検索', showing: '表示', of: '/', total_items: '件', empty: '一致するジャーナルがありません', login: 'ログイン', logout: 'ログアウト', wos_subjects: 'WoS 分野', wos_search_ph: '分野を絞り込み（A-Z）…', cnkx_domain: '学問分野', cnkx_sub: '細分分野'
    },
    ko: {
      ...I18N.en,
      tagline: '<b>AILatest Journal</b> — 연구자를 위한 저널 검색 및 투고 의사결정 도구입니다.', brand_title: 'Journal', brand_zhikan: '知刊', indices: '색인', cas_zone: 'CAS 2025 등급', filters: '필터', all: '전체', filter_xinrui: '신예 등급', filter_warning: '경고 목록', domestic_sources: '중국 국내 목록', tab_home: '저널', tab_int: '국제', tab_dom: '중국', tab_fav: '즐겨찾기', tab_pick: '저널 추천', loading: '불러오는 중…',
      hero_title_int: 'SCI / SSCI 국제 저널 검색', hero_body_int: '데이터: <b>Web of Science Core Collection</b>(2026-06-15) 및 <b>EI Compendex</b>(2026-07-09). <b>JCR 2025</b> 색인, <b>ESI</b>, <b>CAS 2025</b>, <b>ShowJCR</b> JCR 2026 릴리스 · 2025 지표(IF/분야/순위), CCF 2026, 경고 목록을 통합했습니다. 총 <b id="total">—</b> 종.', hero_note: '배지 범례: <b>SCIE/SSCI/AHCI/ESCI/EI</b> 색인 수록 · <b>CAS</b> CAS 2025 대분류(1-4구, TOP표시) · <b>JCR Q</b> Quartile(Q1-Q4) · <b>Emerging</b> CAS 2026 신흥판 구분 · <b>CCF</b> CCF 2026 추천(A/B/C) · <b>ABDC</b> 호주 경영저널 등급(A*/A/B/C) · <b>ABS</b> Chartered ABS Academic Journal Guide 2024(4*/4/3/2/1, 경영·상학만) · <b>T1/T2/T3</b> 중국과학기협 2025 고품질 학술지 등급 · <b>⚠ Warning</b> 국제 학술지 경고 목록.', hero_title_dom: '중국 학술지 등급 목록', hero_title_fav: '즐겨찾기', hero_title_pick: '저널 추천', hero_body_pick: '곧 제공됩니다. 연구 주제, IF 범위, 심사 기간, APC, 색인 조건으로 추천합니다.', pick_coming_title: '준비 중', pick_coming_desc: '향후 업데이트', results_all: '전체 저널', load_more: '더 보기', col_name: '저널 Title', col_free: '무료', col_abbr: '약어 Abbr', col_badges: '색인 / 등급', search_int: '검색: 제목 / 약어 / ISSN / 중국어명', search_dom: '검색: 중국어명 / 영어명 / ISSN / CN', search_fav: '즐겨찾기 검색', showing: '표시', of: '/', total_items: '개', empty: '일치하는 저널이 없습니다', login: '로그인', logout: '로그아웃', wos_subjects: 'WoS 세부분야', wos_search_ph: '분야 필터(A-Z)…'
    },
    es: {
      ...I18N.en,
      tagline: '<b>AILatest Journal</b> — buscador de revistas y herramienta de decisión para investigadores.', indices: 'Índices', cas_zone: 'CAS 2025', filters: 'Filtros', all: 'Todo', filter_xinrui: 'Emergente', filter_warning: 'Advertencia', domestic_sources: 'Fuentes de China', tab_home: 'Revistas', tab_int: 'Internacional', tab_dom: 'China', tab_fav: 'Favoritos', tab_pick: 'Ayúdame a elegir', loading: 'Cargando…', hero_title_int: 'Búsqueda internacional SCI / SSCI', hero_body_int: 'Fuente: <b>Web of Science Core Collection</b> (actualizado 2026-06-15) con <b>EI Compendex</b> (2026-07-09). Integra <b>JCR 2025</b>, <b>ESI</b>, <b>CAS 2025</b> y <b>ShowJCR</b> versión JCR 2026 · métricas 2025 (IF / cuartiles / rangos), CCF 2026 y listas de advertencia. Total: <b id="total">—</b> revistas.', hero_note: 'Leyenda de insignias: <b>SCIE/SSCI/AHCI/ESCI/EI</b> índices de cobertura · <b>CAS</b> Categorización CAS 2025 por áreas principales (1-4, marca TOP) · <b>JCR Q</b> Cuartil (Q1-Q4) · <b>Emerging</b> Edición Emergente CAS 2026 · <b>CCF</b> Recomendación CCF 2026 (A/B/C) · <b>ABDC</b> Clasificación australiana de revistas de gestión empresarial (A*/A/B/C) · <b>ABS</b> Chartered ABS Academic Journal Guide 2024 (4*/4/3/2/1, solo negocios y gestión) · <b>T1/T2/T3</b> Clasificación CAST 2025 de revistas de alta calidad · <b>⚠ Warning</b> Lista de advertencia de revistas internacionales.', hero_title_dom: 'Directorios de revistas chinas', hero_title_fav: 'Favoritos', hero_title_pick: 'Ayúdame a elegir', hero_body_pick: 'Próximamente. Recomendará revistas según tema, rango de IF, revisión, APC e índices.', pick_coming_title: 'Próximamente', pick_coming_desc: 'Actualización futura', results_all: 'Todas las revistas', load_more: 'Cargar más', col_name: 'Revista Title', col_free: 'GRATIS', col_abbr: 'Abrev. Abbr', col_badges: 'Índice / nivel', search_int: 'Buscar: título / abreviatura / ISSN / nombre chino', search_dom: 'Buscar: nombre chino / inglés / ISSN / CN', search_fav: 'Buscar favoritos', showing: 'Mostrando', of: 'de', total_items: '', empty: 'No hay coincidencias', login: 'Iniciar sesión', logout: 'Salir', wos_subjects: 'Materias WoS', wos_search_ph: 'Filtrar materias (A-Z)…'
    },
    pt: {
      ...I18N.en,
      tagline: '<b>AILatest Journal</b> — ferramenta de busca de periódicos e decisão de submissão para pesquisadores.', indices: 'Índices', cas_zone: 'CAS 2025', filters: 'Filtros', all: 'Tudo', filter_xinrui: 'Emergente', filter_warning: 'Alerta', domestic_sources: 'Fontes chinesas', tab_home: 'Periódicos', tab_int: 'Internacional', tab_dom: 'China', tab_fav: 'Favoritos', tab_pick: 'Escolher periódico', loading: 'Carregando…', hero_title_int: 'Busca internacional SCI / SSCI', hero_body_int: 'Fonte: <b>Web of Science Core Collection</b> (2026-06-15) com <b>EI Compendex</b> (2026-07-09). Integra <b>JCR 2025</b>, <b>ESI</b>, <b>CAS 2025</b> e <b>ShowJCR</b> versão JCR 2026 · métricas 2025 (IF / quartis / rankings), CCF 2026 e listas de alerta. Total: <b id="total">—</b> periódicos.', hero_note: 'Legenda de emblemas: <b>SCIE/SSCI/AHCI/ESCI/EI</b> índices de cobertura · <b>CAS</b> Categorização CAS 2025 por grandes áreas (1-4, marca TOP) · <b>JCR Q</b> Quartil (Q1-Q4) · <b>Emerging</b> Edição Emergente CAS 2026 · <b>CCF</b> Recomendação CCF 2026 (A/B/C) · <b>ABDC</b> Classificação australiana de periódicos de gestão (A*/A/B/C) · <b>ABS</b> Chartered ABS Academic Journal Guide 2024 (4*/4/3/2/1, apenas negócios e gestão) · <b>T1/T2/T3</b> Classificação CAST 2025 de periódicos de alta qualidade · <b>⚠ Warning</b> Lista de alerta de periódicos internacionais.', hero_title_dom: 'Diretórios chineses', hero_title_fav: 'Favoritos', hero_title_pick: 'Escolher periódico', hero_body_pick: 'Em breve. Recomendará periódicos por tema, faixa de IF, revisão, APC e índices.', pick_coming_title: 'Em breve', pick_coming_desc: 'Atualização futura', results_all: 'Todos os periódicos', load_more: 'Carregar mais', col_name: 'Periódico Title', col_free: 'GRÁTIS', col_abbr: 'Abrev. Abbr', col_badges: 'Índice / nível', search_int: 'Buscar: título / abreviação / ISSN / nome chinês', search_dom: 'Buscar: nome chinês / inglês / ISSN / CN', search_fav: 'Buscar favoritos', showing: 'Mostrando', of: 'de', total_items: '', empty: 'Nenhum resultado', login: 'Entrar', logout: 'Sair', wos_subjects: 'Assuntos WoS', wos_search_ph: 'Filtrar assuntos (A-Z)…'
    },
    fr: {
      ...I18N.en,
      tagline: '<b>AILatest Journal</b> — outil de recherche de revues et d’aide au choix de soumission pour les chercheurs.', indices: 'Index', cas_zone: 'CAS 2025', filters: 'Filtres', all: 'Tout', filter_xinrui: 'Émergent', filter_warning: 'Alerte', domestic_sources: 'Sources chinoises', tab_home: 'Revues', tab_int: 'International', tab_dom: 'Chine', tab_fav: 'Favoris', tab_pick: 'M’aider à choisir', loading: 'Chargement…', hero_title_int: 'Recherche internationale SCI / SSCI', hero_body_int: 'Source : <b>Web of Science Core Collection</b> (2026-06-15) avec <b>EI Compendex</b> (2026-07-09). Intègre <b>JCR 2025</b>, <b>ESI</b>, <b>CAS 2025</b> et <b>ShowJCR</b> version JCR 2026 · métriques 2025 (IF / quartiles / rangs), CCF 2026 et listes d’alerte. Total : <b id="total">—</b> revues.', hero_note: 'Légende des badges : <b>SCIE/SSCI/AHCI/ESCI/EI</b> indices de couverture · <b>CAS</b> Catégorisation CAS 2025 par grandes disciplines (1-4, marque TOP) · <b>JCR Q</b> Quartile (Q1-Q4) · <b>Emerging</b> Édition Émergente CAS 2026 · <b>CCF</b> Recommandation CCF 2026 (A/B/C) · <b>ABDC</b> Classement australien des revues de gestion (A*/A/B/C) · <b>ABS</b> Chartered ABS Academic Journal Guide 2024 (4*/4/3/2/1, commerce et gestion uniquement) · <b>T1/T2/T3</b> Classement CAST 2025 des revues de haute qualité · <b>⚠ Warning</b> Liste d’alerte des revues internationales.', hero_title_dom: 'Répertoires chinois', hero_title_fav: 'Favoris', hero_title_pick: 'M’aider à choisir', hero_body_pick: 'Bientôt disponible. Recommandations selon thème, IF, délai de revue, APC et index.', pick_coming_title: 'Bientôt disponible', pick_coming_desc: 'Mise à jour future', results_all: 'Toutes les revues', load_more: 'Charger plus', col_name: 'Revue Title', col_free: 'GRATUIT', col_abbr: 'Abrév. Abbr', col_badges: 'Index / niveau', search_int: 'Chercher : titre / abréviation / ISSN / nom chinois', search_dom: 'Chercher : nom chinois / anglais / ISSN / CN', search_fav: 'Chercher favoris', showing: 'Affichage', of: 'sur', total_items: '', empty: 'Aucun résultat', login: 'Connexion', logout: 'Déconnexion', wos_subjects: 'Sujets WoS', wos_search_ph: 'Filtrer les sujets (A-Z)…'
    }
  });
  Object.assign(I18N.zh, {
    tab_updates: '动态',
    rail_updates: '动态',
    search_updates_ph: '搜索期刊动态、来源、标签…',
    updates_title: '期刊动态',
    updates_intro: '跟踪新刊/子刊、收录变化、预警、投稿政策和重要出版报告。',
    updates_latest: '最新动态',
    updates_view_all: '查看全部动态',
    updates_source: '来源',
    updates_featured: '重点关注',
    updates_updated_at: '数据更新时间',
    updates_empty: '暂无匹配的期刊动态',
    update_cat_all: '全部',
    update_cat_new_journal: '新刊/子刊',
    update_cat_index_change: '收录变化',
    update_cat_warning: '预警',
    update_cat_policy: '投稿政策',
    update_cat_report: '重要报告',
    pick_ai_toggle: 'AI 推荐',
    pick_ai_hint: '语义增强，默认开启',
    pick_ai_login: 'AI 推荐需要登录（Free 共 10 次额度），本次已自动改用本地匹配。',
    pick_ai_running: '正在用 AI 解析研究语境…',
    pick_ai_unavailable: 'AI 推荐暂不可用，已自动改用本地匹配；该次不扣 AI 额度，可稍后重试。',
    pick_ai_auth_error: 'AI 推荐登录已失效，请重新登录；本次已自动改用本地匹配。',
    pick_ai_deepseek_auth_error: 'DeepSeek 密钥验证失败，请在 Worker 的 Secrets 中重新保存密钥；本次已自动改用本地匹配。',
    pick_ai_quota_error: 'Free AI 荐刊 10 次额度已用完，已自动改用本地匹配。升级 Pro / Max 可继续使用。',
    pick_ai_credits_error: '本月 AI credits 已用完，已自动改用本地匹配；下月额度会重置。',
    pick_ai_locked: '当前账号的 AI 荐刊尚未解锁，已自动改用本地匹配。升级 Pro / Max 可使用每月 credits。',
    pick_ai_config_error: 'AI 推荐接口还没有正确读取 DeepSeek 密钥，请重新部署 Worker 后再试。',
    pick_mode_ai: 'AI 语义匹配',
    pick_mode_local: '本地匹配',
    pick_filter_esci: 'ESCI',
    pick_filter_free_doaj: '免费（DOAJ）'
  });
  Object.assign(I18N['zh-TW'], {
    tab_updates: '動態',
    rail_updates: '動態',
    search_updates_ph: '搜尋期刊動態、來源、標籤…',
    updates_title: '期刊動態',
    updates_intro: '追蹤新刊/子刊、收錄變化、預警、投稿政策和重要出版報告。',
    updates_latest: '最新動態',
    updates_view_all: '查看全部動態',
    updates_source: '來源',
    updates_featured: '重點關注',
    updates_updated_at: '資料更新時間',
    updates_empty: '暫無匹配的期刊動態',
    update_cat_all: '全部',
    update_cat_new_journal: '新刊/子刊',
    update_cat_index_change: '收錄變化',
    update_cat_warning: '預警',
    update_cat_policy: '投稿政策',
    update_cat_report: '重要報告',
    pick_ai_toggle: 'AI 推薦',
    pick_ai_hint: '語義增強，預設開啟',
    pick_ai_login: 'AI 推薦需要登入（Free 共 10 次額度），本次已自動改用本地匹配。',
    pick_ai_running: '正在用 AI 解析研究語境…',
    pick_ai_unavailable: 'AI 推薦暫不可用，已自動改用本地匹配；該次不扣 AI 額度，可稍後重試。',
    pick_ai_auth_error: 'AI 推薦登入已失效，請重新登入；本次已自動改用本地匹配。',
    pick_ai_deepseek_auth_error: 'DeepSeek 密鑰驗證失敗，請在 Worker 的 Secrets 中重新儲存密鑰；本次已自動改用本地匹配。',
    pick_ai_quota_error: 'Free AI 薦刊 10 次額度已用完，已自動改用本地匹配。升級 Pro / Max 可繼續使用。',
    pick_ai_credits_error: '本月 AI credits 已用完，已自動改用本地匹配；下月額度會重置。',
    pick_ai_locked: '目前帳號尚未解鎖 AI 薦刊，已自動改用本地匹配。升級 Pro / Max 可使用每月 credits。',
    pick_ai_config_error: 'AI 推薦接口還沒有正確讀取 DeepSeek 密鑰，請重新部署 Worker 後再試。',
    pick_mode_ai: 'AI 語義匹配',
    pick_mode_local: '本地匹配',
    pick_filter_esci: 'ESCI',
    pick_filter_free_doaj: '免費（DOAJ）'
  });
  Object.assign(I18N.en, {
    tab_updates: 'Updates',
    rail_updates: 'Updates',
    search_updates_ph: 'Search journal updates, sources, tags…',
    updates_title: 'Journal Updates',
    updates_intro: 'Track new journals, indexing changes, alerts, submission policies, and publishing reports.',
    updates_latest: 'Latest Updates',
    updates_view_all: 'View all updates',
    updates_source: 'Source',
    updates_featured: 'Featured',
    updates_updated_at: 'Data updated',
    updates_empty: 'No matching journal updates.',
    update_cat_all: 'All',
    update_cat_new_journal: 'New journals',
    update_cat_index_change: 'Index changes',
    update_cat_warning: 'Alerts',
    update_cat_policy: 'Policies',
    update_cat_report: 'Reports',
    pick_ai_toggle: 'AI Match',
    pick_ai_hint: 'Semantic mode, on by default',
    pick_ai_login: 'AI Match requires sign-in (Free: 10 total picks); switched to local matching for this search.',
    pick_ai_running: 'Analyzing research context with AI…',
    pick_ai_unavailable: 'AI Match is temporarily unavailable; switched to local matching. No AI credit was used — retry later.',
    pick_ai_auth_error: 'Your AI Match sign-in has expired. Sign in again; switched to local matching for this search.',
    pick_ai_deepseek_auth_error: 'The DeepSeek key failed authentication. Re-save it in the Worker Secrets; switched to local matching for this search.',
    pick_ai_quota_error: 'Free AI Match (10 total) is used up; switched to local matching. Upgrade Pro/Max to continue.',
    pick_ai_credits_error: 'This month’s AI credits are used up; switched to local matching. Credits reset next month.',
    pick_ai_locked: 'AI Match is not enabled for this account; switched to local matching. Upgrade Pro/Max for monthly credits.',
    pick_ai_config_error: 'AI Match cannot read the DeepSeek key yet. Redeploy the Worker and try again.',
    pick_mode_ai: 'AI semantic match',
    pick_mode_local: 'Local match',
    pick_filter_esci: 'ESCI',
    pick_filter_free_doaj: 'Free (DOAJ)'
  });
  Object.assign(I18N.ja, {
    tagline: '<b>AILatest Journal</b> — 研究者向けのジャーナル検索・投稿判断ツール。SCI/SSCI、CAS区分、JCR、ESI、CSSCI、北大核心、ZJU などを統合。',
    brand_title: 'Journal',
    brand_zhikan: '知刊',
    indices: '索引',
    cas_zone: 'CAS 2025 区分',
    filters: 'フィルター',
    all: 'すべて',
    z1: '1区',
    z2: '2区',
    z3: '3区',
    z4: '4区',
    filter_xinrui: '新興区分',
    filter_warning: '警告リスト',
    domestic_sources: '中国国内ソース',
    src_nsfc_mgmt: 'NSFC 管理科学部',
    src_cnkx: '中国科協 高品質リスト',
    src_cnki_major: '中国語ジャーナル目録',
    src_cssci_core: 'CSSCI ソース',
    src_cssci_ext: 'CSSCI 拡張',
    src_pku: '北大核心 (2023)',
    src_zju: '浙江大学 2024',
    src_zjucity: '大学独自リスト 2023',
    src_ccft: 'CCF 中国語 T 区分',
    nav_sub_inhouse: '大学独自リスト',
    locked_school_a: '🔒 学校 A · 2023',
    paid_label: '有料',
    drawer_kicker: 'ジャーナル詳細',
    footer_data: '© <a href="https://journal.ailatest.org">AILatest Journal</a>',
    footer_tag: 'ジャーナル検索 · 評価 · 投稿判断',
    footer_product: '製品',
    footer_support: 'サポート',
    footer_legal: '規約',
    footer_matrix: '連絡マトリクス',
    footer_ailatest: 'AILatest について',
    footer_privacy_full: 'プライバシー',
    footer_terms_full: '利用規約',
    footer_refund_full: '返金ポリシー',
    tab_home: 'ジャーナル',
    tab_int: '国際',
    tab_dom: '中国',
    tab_fav: 'お気に入り',
    tab_pick: '投稿先AI',
    tab_updates: '動向',
    nav_about: '概要',
    nav_contact: '連絡',
    nav_terms: '利用規約',
    nav_privacy: 'プライバシー',
    nav_refund: '返金',
    nav_index_rank: '索引ランキング',
    nav_subject_rank: '分野ランキング',
    nav_warn_rank: '警告リスト',
    nav_extension_beta: '拡張機能ベータ',
    nav_subscription: '購読',
    filter_if_range: 'インパクトファクター',
    if_any: '指定なし',
    rail_int: 'グローバル',
    rail_dom: '中国',
    rail_region: '地域',
    rail_in: 'インド',
    rail_my: 'マレーシア',
    rail_kr: '韓国',
    rail_rank: 'ランキング',
    rail_fav: '保存',
    rail_me: 'マイページ',
    rail_updates: '動向',
    download_center: 'ダウンロード',
    loading: '読み込み中…',
    hero_title_int: 'SCI / SSCI 国際ジャーナル検索',
    hero_body_int: 'データソース：<b>Web of Science Core Collection</b>（SCIE / SSCI / AHCI / ESCI、2026-06-15更新）に <b>EI Compendex</b>（2026-07-09）を統合。',
    hero_note: 'バッジ凡例：<b>収録</b> は SCIE/SSCI/AHCI/ESCI/EI、Scopus、MEDLINE、CSCD、SCD などの収録状況を示します。<b>評価</b> は CAS/JCR/新興/CCF/ABDC/ABS/FMS/VHB/CNRS/AMI などの区分を示します。<b>アクセス</b> は FREE/OAJ/DOAJ、<b>注意</b> は警告リスト、WoS On Hold、Retraction Watch を示します。',
    hero_title_dom: '中国学術ジャーナル区分',
    hero_body_dom: '<b>中国科協 高品質科技ジャーナル区分リスト</b>、<b>中国語ジャーナル目録</b>、CSSCI / 北大核心 / CCF 中国語、<b>浙江大学 2024</b> と大学独自リストを統合。',
    hero_note_dom: 'CSSCI / 北大核心は PDF OCR 由来のため、一部表記ゆれがある場合があります。',
    hero_title_in: 'インド UGC-CARE ジャーナル目録',
    hero_body_in: 'インド UGC-CARE Group I 正式リスト。タイトル、出版社、ISSN、分野で検索できます。',
    india_subject: '分野',
    india_source_note: 'UGC-CARE 中央リストは 2024年10月以降継続更新されていません。本ページは履歴目録と投稿確認の手掛かりです。',
    hero_title_my: 'マレーシア MyCite / ERA ジャーナル目録',
    hero_body_my: 'MyCite 2025 の記録を標準表示します。正式な認定判断では MyCite 2025 公式 PDF を優先してください。',
    malaysia_source_note: 'MyCite オンラインデータベースには 2014-2025 の履歴記録が含まれます。MyJurnal は収集時に接続できなかったため未接続です。',
    hero_title_fav: 'お気に入り',
    hero_body_fav: '任意の行の <b>★</b> をクリックするとお気に入りに追加できます。未ログイン時はこの端末に保存され、ログイン後はクラウド同期されます。',
    hero_title_pick: '投稿先AI',
    hero_body_pick: '研究テーマとサイト内のジャーナル指標を照合し、投稿先候補を推薦します。',
    pick_placeholder: '論文タイトル・要旨・キーワードを入力して投稿先を推薦',
    pick_search_btn: '推薦',
    pick_filter_topics: '研究分野に一致',
    pick_filter_if: 'IF >',
    pick_filter_zone: 'CAS 区分',
    pick_filter_sci: 'SCIE',
    pick_filter_ssci: 'SSCI',
    pick_filter_ahci: 'AHCI',
    pick_filter_esci: 'ESCI',
    pick_filter_compre: '総合誌を除外',
    pick_filter_free_doaj: '無料（DOAJ）',
    pick_filter_free: '無料（DOAJ）',
    pick_history: '検索履歴',
    pick_history_clear: 'クリア',
    pick_ai_toggle: 'AI 推薦',
    pick_ai_hint: 'セマンティック補強、標準でオン',
    pick_ai_login: 'AI 推薦にはログインが必要です。今回はローカル照合に切り替えました。',
    pick_ai_running: 'AI で研究文脈を解析中…',
    pick_ai_unavailable: 'AI 推薦は一時的に利用できません。今回はローカル照合に切り替えました。',
    pick_ai_auth_error: 'AI 推薦のログインが失効しました。今回はローカル照合に切り替えました。',
    pick_ai_deepseek_auth_error: 'DeepSeek キーの認証に失敗しました。Worker Secrets に保存し直してください。今回はローカル照合に切り替えました。',
    pick_ai_quota_error: '本日の AI 推薦無料枠を使い切りました。ローカル照合に切り替えます。',
    pick_ai_config_error: 'AI 推薦 API の設定が未完了です。Worker を再デプロイしてください。',
    pick_mode_ai: 'AI セマンティック照合',
    pick_mode_local: 'ローカル照合',
    results_all: 'すべてのジャーナル',
    load_more: 'さらに読み込む',
    col_name: 'ジャーナル',
    col_free: '無料掲載',
    col_abbr: '略称',
    col_badges: '索引 / 区分',
    col_if: 'IF',
    col_cycle: '査読期間',
    col_index: '収録索引',
    col_cas: '分野区分',
    filter_idx: '索引',
    filter_tier: '区分',
    filter_extra: 'その他',
    filter_topic: '分野',
    filter_free: '無料掲載',
    filter_nsc: 'Nature/Science/Cell',
    filter_free_only: '無料掲載のみ',
    jcr_label: 'JCR 区分',
    abdc_label: 'ABDC',
    abs_label: 'ABS',
    zone_top: 'TOP',
    xinrui_top: 'TOP',
    oa_sf_label: '研究テーマ',
    oa_sf_ph: 'テーマを絞り込み…',
    oa_sf_clear: '選択をクリア',
    col_cat: 'ESI / CAS 大分類',
    search_int: '検索：正式名 / 略称 / ISSN / 中国語名',
    search_dom: '検索：誌名 / ISSN / CN（横断検索）',
    search_fav: 'お気に入りを検索：誌名 / 略称 / ISSN',
    search_home_ph: 'ジャーナル名、ISSN を検索…',
    search_updates_ph: 'ジャーナル動向、出典、タグを検索…',
    search_submit_hint: '検索',
    search_button: '検索',
    home_subtitle: 'グローバルジャーナル検索・推薦プラットフォーム',
    showing: '表示',
    of: '件 / 全',
    total_items: '件',
    empty: '一致するジャーナルがありません',
    empty_fav: 'まだお気に入りはありません。「国際 SCI/SSCI」で任意の行の ★ をクリックすると保存できます。',
    login: 'ログイン',
    logout: 'ログアウト',
    fav_added: '保存しました',
    fav_removed: '削除しました',
    syncing: '同期中…',
    synced: '同期済み',
    wos_subjects: 'WoS 細分野',
    wos_search_ph: '分野を絞り込み（A-Z）…',
    cnkx_domain: '学問分野',
    cnkx_sub: '細分野',
    wos_clear_title: '選択をクリア',
    updates_title: 'ジャーナル動向',
    updates_intro: '新刊・子刊、収録変更、警告、投稿方針、重要な出版レポートを追跡します。',
    updates_latest: '最新動向',
    updates_view_all: 'すべて見る',
    updates_source: '出典',
    updates_featured: '注目',
    updates_updated_at: 'データ更新日',
    updates_empty: '一致するジャーナル動向はありません。',
    update_cat_all: 'すべて',
    update_cat_new_journal: '新刊・子刊',
    update_cat_index_change: '収録変更',
    update_cat_warning: '警告',
    update_cat_policy: '投稿方針',
    update_cat_report: 'レポート'
  });
  const LANG_ORDER = ['zh-CN', 'en'];
  const LANG_META = {
    'zh-CN': { label: '中文', html: 'zh-CN' },
    en: { label: 'English', html: 'en' },
  };
  const normalizeLang = (code) => {
    const raw = String(code || '').trim();
    if (!raw) return 'en';
    if (raw === 'zh' || /^zh[-_]?cn/i.test(raw) || /^zh[-_]?hans/i.test(raw)) return 'zh-CN';
    if (/^zh[-_]?tw/i.test(raw) || /^zh[-_]?hk/i.test(raw) || /^zh[-_]?mo/i.test(raw) || /^zh[-_]?hant/i.test(raw)) {
      return 'zh-CN';
    }
    return 'en';
  };

  /** 浏览器首选语言（仅首次 / 未手动设置时用） */
  function detectBrowserLang() {
    const list = [];
    try {
      if (Array.isArray(navigator.languages)) list.push(...navigator.languages);
    } catch (_) {}
    try {
      if (navigator.language) list.push(navigator.language);
    } catch (_) {}
    for (const item of list) {
      const n = normalizeLang(item);
      if (n && I18N[n]) return n;
    }
    return 'en';
  }

  // ───────── state ─────────
  function initialLangFromPath() {
    try {
      const queryLang = new URLSearchParams(location.search).get('lang');
      if (queryLang) return normalizeLang(queryLang);
    } catch (_) {}
    const path = location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/zh' || path.startsWith('/zh/')) return 'zh-CN';
    if (path === '/en' || path.startsWith('/en/')) return 'en';
    // 用户曾手动选过语言 → 永久尊重（setUiLanguage 会写 userSet）
    try {
      const saved = localStorage.getItem('ailatest.lang');
      if (saved && I18N[normalizeLang(saved)]) return normalizeLang(saved);
    } catch (_) {}
    return detectBrowserLang();
  }
  let lang = normalizeLang(initialLangFromPath());
  // 供 pricing-checkout 等外挂脚本读「真实 UI 语言」，避免与 html lang / 旧缓存不一致
  window.__journalUiLang = lang;
  window.__getJournalUiLang = () => lang;
  const UI_LOCALES = {
    'zh-CN': 'zh-CN',
    en: 'en-US',
  };
  function uiLocale() {
    return UI_LOCALES[lang] || 'en-US';
  }
  const INLINE_I18N = {
    ja: {
      '显示趋势': '傾向を表示',
      '选择国家/地区': '国・地域を選択',
      '其他': 'その他',
      '快照': 'スナップショット',
      '国家/地区比例': '国・地域別割合',
      'OpenAlex 作者机构占比': 'OpenAlex 著者所属機関の割合',
      '暂无可用国家/地区发文比例数据。': '利用可能な国・地域別発文割合データはまだありません。',
      '国家/地区发文比例暂时加载失败。': '国・地域別発文割合の読み込みに失敗しました。',
      '默认收藏': 'デフォルトのお気に入り',
      '未命名': '無題',
      '我的': 'マイページ',
      '进入个人信息与积分': '個人情報とクレジットを開く',
      '登录后查看积分': 'ログインするとクレジットを確認できます',
      '免费次数已用完，请登录后继续使用': '無料回数を使い切りました。ログインして続行してください。',
      '本地收藏上限 5 本，请登录后收藏更多': 'ローカル保存は 5 件までです。ログインするとさらに保存できます。',
      '新清单': '新しいリスト',
      '人': '件のレビュー',
      '暂无评分': 'まだ評価はありません',
      '已评': '評価済み',
      ' 星 · 再次点击修改 · 长按清除': ' 星 · もう一度クリックして変更 · 長押しで削除',
      '半星可评 · 点击星左半为 0.5，右半为 1 星': '半星評価に対応 · 左半分で 0.5、右半分で 1 星',
      '提交中…': '送信中…',
      '提交失败，请稍后再试': '送信に失敗しました。後でもう一度お試しください',
      '清除中…': '削除中…',
      '已清除评分 · 可重新打分': '評価を削除しました · 再評価できます',
      '清除失败': '削除に失敗しました',
      '付费解锁': '有料解除',
      '解锁': '解除',
      '关闭': '閉じる',
      '登录 / 注册': 'ログイン / 登録',
      '跨设备同步收藏、投稿经验、打分记录': 'お気に入り、投稿メモ、評価記録を端末間で同期',
      '邮箱': 'メール',
      '6 位验证码': '6桁の認証コード',
      '发送验证码': '認証コードを送信',
      '或使用第三方登录': 'または外部アカウントでログイン',
      '登录即同意': 'ログインすると',
      '服务条款': '利用規約',
      '与': 'および',
      '隐私政策': 'プライバシーポリシー',
      '发送验证码失败': '認証コードの送信に失敗しました',
      '登录': 'ログイン',
      '验证码已发送，10 分钟内有效': '認証コードを送信しました。10分間有効です',
      '验证码验证失败': '認証コードの検証に失敗しました',
      '验证码验证失败：未收到登录凭证': '認証コードの検証に失敗しました：ログイン資格情報を受信できませんでした',
      '验证码登录': '認証コードでログイン',
      '用户信息获取失败': 'ユーザー情報の取得に失敗しました',
      'Scopus 收录 (Source List Mar.2026)': 'Scopus 収録（Source List Mar.2026）',
      'DOAJ 开放获取期刊目录': 'DOAJ オープンアクセスジャーナル目録',
      'Nature Index 追踪出版物': 'Nature Index 追跡出版物',
      '中国科技核心': '中国科技核心',
      '新入选': '新規収録',
      '中文': '中国語',
      '国际': '国際',
      ' 个领域': ' 分野',
      'PubMed 可检索': 'PubMed で検索可能',
      'PubMed Central 全文档案': 'PubMed Central 全文アーカイブ',
      'MEDLINE 数据库收录（NLM 精选索引）': 'MEDLINE 収録（NLM 選定索引）',
      '作者可选择免费发表路径（Diamond / Hybrid / 订阅制等）': '著者無料の掲載経路があります（Diamond / Hybrid / 購読制など）',
      '免费发表': '無料掲載',
      '累计浏览次数': '累計閲覧数',
      '次浏览': '回閲覧',
      ' 次浏览': ' 回閲覧',
      '区': '区',
      '最新 JCR 影响因子': '最新の JCR インパクトファクター',
      'JCR 分区': 'JCR 区分',
      '中科院大类分区 Top': 'CAS 大分類区分 Top',
      '中科院大类分区': 'CAS 大分類区分',
      '中科院': 'CAS',
      'CSSCI 扩展': 'CSSCI 拡張',
      '北大核心': '北大核心',
      '科协 T1': '中国科協 T1',
      '科协 T2': '中国科協 T2',
      '科协 T3': '中国科協 T3',
      '浙大目录': 'ZJU 目録',
      '学校 A': '学校 A',
      '中国科协': '中国科協',
      '新锐': '新興',
      '中科院 2026 新锐版分区': 'CAS 2026 新興版区分',
      '预警': '警告',
      '新锐审查中': '新興区分 審査中',
      '中信所预警': 'ISTIC 警告',
      '管理科学部': '管理科学部',
      '浙大': 'ZJU',
      '科协': '中国科協',
      '个月': 'か月',
      '已加载': '読み込み済み',
      '本期刊': 'ジャーナル',
      '我的设置': '設定',
      '底部导航站点': '下部ナビゲーションの表示サイト',
      '积分记录': 'クレジット記録',
      '积分待同步': 'クレジット同期待ち',
      '账号额度和消耗记录由服务器同步。': 'アカウント残高と使用記録はサーバーから同期されます。',
      '登录后可查看账号积分和同步记录。': 'ログインするとアカウントクレジットと同期記録を確認できます。',
      '当前账号': '現在のアカウント',
      '浏览记录': '閲覧記録',
      '暂无本机浏览记录。打开期刊详情后会记录在这里。': 'この端末の閲覧記録はまだありません。ジャーナル詳細を開くとここに記録されます。',
      '搜索记录': '検索記録',
      '暂无搜索记录。首页查刊或荐刊后会记录在这里。': '検索記録はまだありません。ホーム検索または推薦検索後にここへ表示されます。',
      '首页查刊': 'ホーム検索',
      '荐刊查询': '推薦検索',
      '本机统计': 'ローカル統計',
      '插件 / API 调用': '拡張機能 / API 呼び出し',
      '插件 / API 调用记录': '拡張機能 / API 呼び出し記録',
      '账号只同步了调用次数，暂未返回逐条明细。': 'このアカウントでは呼び出し回数のみ同期され、明細はまだ返されていません。',
      '暂无插件 / API 调用记录。': '拡張機能 / API 呼び出し記録はまだありません。',
      '可用积分': '利用可能クレジット',
      '收藏期刊': '保存したジャーナル',
      '今日浏览': '本日の閲覧',
      '账号信息': 'アカウント情報',
      '登录方式': 'ログイン方式',
      '账号状态': 'アカウント状態',
      '已登录': 'ログイン済み',
      '未登录': '未ログイン',
      '活动记录': 'アクティビティ',
      '近 12 周': '過去12週間',
      '我的收藏': 'お気に入り',
      '退出登录': 'ログアウト',
      '退出登录？': 'ログアウトしますか？',
      '全站浏览量': '全サイト閲覧数',
      '访客': '訪問者',
      '期刊详情浏览': 'ジャーナル詳細閲覧',
      '覆盖期刊': '対象ジャーナル',
      '关于': '概要',
      '联系': '連絡',
      '← 回到主站浏览': '← メインサイトに戻る'
    },
  };
  const T = (zh_, en_) => {
    // 简中：中文
    if (lang === 'zh-CN') return zh_;
    // 繁中：有 INLINE 用 INLINE，否则用简中
    if (lang === 'zh-TW') {
      return INLINE_I18N['zh-TW']?.[zh_] || INLINE_I18N['zh-TW']?.[en_] || zh_;
    }
    // 其它语言：INLINE → 英文；禁止回落到中文
    const pack = INLINE_I18N[lang];
    if (pack) {
      if (pack[zh_] != null && pack[zh_] !== '') return pack[zh_];
      if (en_ && pack[en_] != null && pack[en_] !== '') return pack[en_];
    }
    if (en_ != null && en_ !== '' && !/[\u4e00-\u9fff]/.test(String(en_))) return en_;
    // 误写成 T('中文','中文') 时，非中文界面至少给出可辨识的英文占位
    if (en_ != null && en_ !== '' && en_ === zh_ && /[\u4e00-\u9fff]/.test(String(zh_))) {
      return String(zh_);
    }
    return (en_ != null && en_ !== '') ? en_ : zh_;
  };
  // ── Domestic field-value translations (CAST domains, CSSCI/PKU disciplines, ZJU tiers) ──
  const DOM_I18N = {
    domain: {
        "中医药领域":"Traditional Chinese Medicine",
        "中国优秀科普期刊":"Outstanding Popular Science Journals",
        "临床医学":"Clinical Medicine",
        "临床医学领域":"Clinical Medicine (Fields)",
        "仪器仪表":"Instruments & Instrumentation",
        "仿真科学与技术":"Simulation Science & Technology",
        "体育":"Sports Science",
        "信息通信":"Information & Communication",
        "光学":"Optics",
        "公路运输":"Highway Transportation",
        "兵器科学与技术":"Weaponry Science & Technology",
        "农业工程":"Agricultural Engineering",
        "冶金工程技术与金属材料":"Metallurgical Engineering & Metallic Materials",
        "化工领域":"Chemical Engineering",
        "口腔医学":"Stomatology",
        "图像图形":"Image & Graphics",
        "图学领域":"Graphics Science",
        "土壤学":"Soil Science",
        "地球物理":"Geophysics",
        "地球科学领域":"Earth Sciences",
        "地理资源领域":"Geography & Resources",
        "声学":"Acoustics",
        "安全科学":"Safety Science",
        "岩土力学":"Geotechnical Mechanics",
        "建筑领域":"Architectural Science",
        "技术经济":"Technology Economics",
        "护理领域":"Nursing",
        "指挥与控制":"Command & Control",
        "振动工程":"Vibration Engineering",
        "数学":"Mathematics",
        "无机非金属材料":"Inorganic Non-metallic Materials",
        "有色金属领域":"Non-ferrous Metals",
        "机械领域":"Mechanical Engineering",
        "材料-综合":"Materials Science (General)",
        "材料失效与保护领域":"Materials Failure & Protection",
        "核领域":"Nuclear Science",
        "植物科学领域":"Plant Science",
        "汽车工程":"Automotive Engineering",
        "煤炭领域":"Coal Industry",
        "照明领域":"Illumination",
        "环境科学":"Environmental Science",
        "生态学":"Ecology",
        "生物医学工程":"Biomedical Engineering",
        "电子及信息技术":"Electronics & Information Technology",
        "电气工程":"Electrical Engineering",
        "石油、天然气工业":"Petroleum & Natural Gas Industry",
        "管理学":"Management Science",
        "纺织":"Textiles",
        "细胞生物学领域":"Cell Biology",
        "能源电力领域":"Energy & Power",
        "自动化学科领域":"Automation",
        "航天航空领域":"Aerospace",
        "航海":"Navigation",
        "舰船科学":"Naval Architecture",
        "药学":"Pharmacy",
        "计算领域":"Computing",
        "遥感科学与技术":"Remote Sensing Science & Technology",
        "铁路运输":"Railway Transportation",
        "预防医学与卫生学":"Preventive Medicine & Hygiene",
        "食品科学与工程":"Food Science & Engineering",
        "未分类":"Uncategorized",
        "管理学":"Management",
        "材料科学":"Materials Science",
        "工程技术":"Engineering & Technology",
        "生物学":"Biology",
        "医学":"Medicine",
        "计算机科学":"Computer Science",
        "数学（综合）":"Mathematics (General)",
        "化学":"Chemistry",
        "物理与天体物理":"Physics & Astrophysics",
        "环境科学与生态学":"Environmental Science & Ecology",
        "农林科学":"Agriculture & Forestry",
        "经济学":"Economics",
        "心理学":"Psychology",
        "法学":"Law",
        "教育学":"Education",
        "社会学":"Sociology",
        "新闻传播与图书情报":"Journalism & Library Science",
        "历史学":"History",
        "文学":"Literature",
        "艺术学":"Arts",
        "哲学":"Philosophy",
        "人文科学（综合）":"Humanities (General)",
        "综合性期刊":"Multidisciplinary",
    },
    sub: {
        "临床医学与内科学综合":"Clinical Medicine & Internal Medicine",
        "儿科学":"Pediatrics",
        "内分泌学":"Endocrinology",
        "医学影像学":"Medical Imaging",
        "呼吸病学":"Respiratory Medicine",
        "外科学综合":"Surgery (General)",
        "妇产科学":"Obstetrics & Gynecology",
        "心血管病学":"Cardiovascular Medicine",
        "感染性疾病与传染病学":"Infectious Diseases",
        "整形外科学综合":"Plastic Surgery",
        "检验医学":"Laboratory Medicine",
        "消化病学":"Gastroenterology",
        "烧伤外科学":"Burn Surgery",
        "病理学":"Pathology",
        "皮肤病与性病学":"Dermatology & Venereology",
        "眼科学":"Ophthalmology",
        "神经病学":"Neurology",
        "精神病学":"Psychiatry",
        "耳鼻咽喉科学科":"Otorhinolaryngology",
        "肾脏病学":"Nephrology",
        "肿瘤学":"Oncology",
        "血液病学":"Hematology",
        "风湿病学":"Rheumatology",
        "中医药":"Traditional Chinese Medicine",
        "交叉推荐类期刊":"Interdisciplinary Recommended",
        "交叉领域推荐期刊目录":"Interdisciplinary Recommended",
        "综述类期刊推荐目录":"Review Journals Recommended",
        "农业基础科学":"Agricultural Basic Sciences",
        "农业工程综合":"Agricultural Engineering (General)",
        "农业建筑环境与能源工程":"Agricultural Building, Environment & Energy",
        "农业机械化及其自动化":"Agricultural Mechanization & Automation",
        "农业水利工程":"Agricultural Water Conservancy",
        "农业电气化":"Agricultural Electrification",
        "农业科学综合":"Agricultural Sciences (General)",
        "土地整治工程":"Land Consolidation",
        "智慧农业":"Smart Agriculture",
        "涉农业工程大学学报":"Agricultural Engineering University Journals",
        "生物质科学与工程":"Biomass Science & Engineering",
        "冶金工程技术领域":"Metallurgical Engineering",
        "金属材料（金属学与金属工艺）":"Metallic Materials",
        "信息传感":"Information Sensing",
        "图像信息处理、计算机图像处理":"Image Processing & Computer Vision",
        "图像信息处理、计算机图像处理与图形学、模式识别与机器视觉":"Image/Graphics & Pattern Recognition / Machine Vision",
        "生物医学影像处理":"Biomedical Image Processing",
        "遥感科学与技术":"Remote Sensing Science & Technology",
        "固体地球物理学":"Solid Earth Geophysics",
        "水界物理学":"Hydrosphere Physics",
        "空间物理学":"Space Physics",
        "古生物学":"Paleontology",
        "地球物理学":"Geophysics",
        "地球物理学、地震":"Geophysics & Seismology",
        "地球物理学、岩石、矿物":"Geophysics, Rocks & Minerals",
        "地球物理学、石油天然气工业":"Geophysics & Petroleum/Gas",
        "地质学":"Geology",
        "地质学、古生物学":"Geology & Paleontology",
        "地质学、地球物理学":"Geology & Geophysics",
        "地质学、煤炭、矿物、岩石、矿床学":"Geology, Coal, Minerals, Rocks & Ore Deposits",
        "地质学、石油":"Geology & Petroleum",
        "地质学、矿山工程技术":"Geology & Mining Engineering",
        "地质学、矿山工程技术、地球物理学":"Geology, Mining & Geophysics",
        "地质学、矿物、岩石、矿床学":"Geology, Minerals, Rocks & Ore Deposits",
        "地质学、矿物、岩石、矿床学、地球物理学":"Geology, Minerals, Rocks, Ore Deposits & Geophysics",
        "地震、地球物理学":"Seismology & Geophysics",
        "地震学":"Seismology",
        "地震学、地球物理学":"Seismology & Geophysics",
        "大气科学":"Atmospheric Sciences",
        "天文学":"Astronomy",
        "海洋科学、水文学":"Marine Science & Hydrology",
        "海洋科学、水文学、气象学":"Marine Science, Hydrology & Meteorology",
        "海洋科学、水文学、矿物、岩石、矿床学":"Marine Science, Hydrology, Minerals & Ore Deposits",
        "石油天然气工业":"Petroleum & Natural Gas",
        "石油天然气工业、地球物理学":"Petroleum/Gas & Geophysics",
        "矿山工程技术":"Mining Engineering",
        "矿山工程技术、岩石矿物":"Mining Engineering, Rocks & Minerals",
        "矿山工程技术、矿物、岩石、矿床学":"Mining, Minerals, Rocks & Ore Deposits",
        "矿物、岩石、矿床":"Minerals, Rocks & Ore Deposits",
        "矿物、岩石、矿床学":"Minerals, Rocks & Ore Deposits",
        "矿物、岩石、矿床学、地球物理学":"Minerals, Rocks, Ore Deposits & Geophysics",
        "人文地理学领域":"Human Geography",
        "信息地理学领域":"Geographic Information",
        "地球科学数据出版领域":"Earth Science Data Publishing",
        "自然地理学领域":"Physical Geography",
        "自然资源领域":"Natural Resources",
        "应用数学":"Applied Mathematics",
        "数学类":"Mathematics (General)",
        "概率统计":"Probability & Statistics",
        "概率统计类":"Probability & Statistics",
        "跨学科应用数学":"Interdisciplinary Applied Math",
        "人工晶体类":"Artificial Crystals",
        "低维无机非金属材料类":"Low-dim Inorganic Non-metallic Materials",
        "无机非晶态材料类":"Inorganic Amorphous Materials",
        "无机非金属材料其他学科类":"Inorganic Non-metallic Materials (Other)",
        "无机非金属材料学科综合类期刊":"Inorganic Non-metallic Materials (General)",
        "水泥基材料类":"Cement-based Materials",
        "特种功能无机非金属材料类":"Functional Inorganic Non-metallic Materials",
        "能源材料类":"Energy Materials",
        "陶瓷材料类期刊":"Ceramic Materials",
        "机械制造及其智能化":"Mechanical Manufacturing & Intelligence",
        "机械工程前沿交叉领域":"Mechanical Engineering Frontiers",
        "机械工程综合":"Mechanical Engineering (General)",
        "机械测试与传感":"Mechanical Testing & Sensing",
        "机械系统设计、集成与控制":"Mechanical Systems Design & Control",
        "机械表面与界面":"Mechanical Surfaces & Interfaces",
        "机械运行维护与管理":"Mechanical Operation & Maintenance",
        "机械驱动与传动":"Mechanical Drive & Transmission",
        "材料腐蚀与失效":"Materials Corrosion & Failure",
        "材料表面与界面":"Materials Surfaces & Interfaces",
        "涂料学":"Coatings",
        "电化学":"Electrochemistry",
        "生物医学工程":"Biomedical Engineering",
        "电子技术、通信技术学科":"Electronic & Communication Technology",
        "计算机技术":"Computer Technology",
        "上游":"Upstream",
        "下游":"Downstream",
        "综合":"General",
        "一般管理":"General Management",
        "一般经济":"General Economics",
        "交通运输管理":"Transportation Management",
        "产业经济与发展经济":"Industrial & Development Economics",
        "人力资源管理":"Human Resource Management",
        "会计":"Accounting",
        "信息管理":"Information Management",
        "公共政策与公共管理":"Public Policy & Management",
        "农业经济":"Agricultural Economics",
        "创业与中小企业管理":"Entrepreneurship & SME Management",
        "劳动与人口经济":"Labor & Population Economics",
        "区域研究与区域经济":"Regional Studies & Economics",
        "卫生管理与经济":"Health Management & Economics",
        "国际商务国际事务":"International Business & Affairs",
        "图书情报管理":"Library & Information Management",
        "宏观经济与国际经济":"Macroeconomics & International Economics",
        "工程项目管理":"Engineering Project Management",
        "心理学":"Psychology",
        "战略管理":"Strategic Management",
        "教育管理":"Education Management",
        "旅游管理":"Tourism Management",
        "理论经济与实验经济":"Theoretical & Experimental Economics",
        "科技创新管理":"S&T Innovation Management",
        "组织管理":"Organizational Management",
        "经济史与管理史":"Economic & Management History",
        "营销":"Marketing",
        "计量经济与统计":"Econometrics & Statistics",
        "资源环境管理":"Resource & Environmental Management",
        "运筹与管理":"Operations Research & Management",
        "运营管理":"Operations Management",
        "金融":"Finance",
        "风险与安全管理":"Risk & Safety Management",
        "电力系统及其自动化":"Power Systems & Automation",
        "电工理论与装备":"Electrical Theory & Equipment",
        "能源与发电技术":"Energy & Power Generation",
        "能源与电力综合":"Energy & Power (General)",
        "仿真科学与工程":"Simulation Science & Engineering",
        "企业信息化":"Enterprise Informatization",
        "导航、制导与控制":"Navigation, Guidance & Control",
        "控制理论与控制工程":"Control Theory & Engineering",
        "智能感知与自主控制":"Intelligent Sensing & Autonomous Control",
        "机器人与无人系统":"Robotics & Unmanned Systems",
        "检测技术与自动化装置":"Detection & Automation",
        "模式识别与智能系统":"Pattern Recognition & Intelligent Systems",
        "生物信息学":"Bioinformatics",
        "系统工程":"Systems Engineering",
        "综合交叉":"Interdisciplinary",
        "自动化与控制系统、仿真科学与工程":"Automation & Control, Simulation Science",
    },
    cssci: {
        "体育学":"Sports Science",
        "历史学":"History",
        "哲学":"Philosophy",
        "宗教学":"Religious Studies",
        "心理学":"Psychology",
        "政治学":"Political Science",
        "教育学":"Education",
        "新闻学与传播学":"Journalism & Communication",
        "民族学与文化学":"Ethnology & Culturology",
        "法学":"Law",
        "社会学":"Sociology",
        "管理学":"Management",
        "经济学":"Economics",
        "统计学":"Statistics",
        "考古学":"Archaeology",
        "艺术学":"Arts",
        "语言学":"Linguistics",
        "马克思主义理论":"Marxist Theory",
        "高校学报":"University Journals",
    },
    pku: {
        "世界经济":"World Economy",
        "中国医学":"Chinese Medicine",
        "中国政治":"Chinese Politics",
        "临床医学":"Clinical Medicine",
        "人口学":"Demography",
        "人才学":"Talent Studies",
        "会计":"Accounting",
        "体育":"Sports",
        "儿科":"Pediatrics",
        "公路":"Highways",
        "其他化工":"Other Chemical Engineering",
        "内科学":"Internal Medicine",
        "农业基础科学":"Agricultural Basic Sciences",
        "农业工程":"Agricultural Engineering",
        "农业经济":"Agricultural Economics",
        "冶金工业":"Metallurgical Industry",
        "出版":"Publishing",
        "初等中等教育":"Primary & Secondary Education",
        "制冷工程":"Refrigeration Engineering",
        "力学":"Mechanics",
        "动物学":"Zoology",
        "化学":"Chemistry",
        "化工":"Chemical Engineering",
        "医学理论与教育普及":"Medical Theory & Popularization",
        "博物馆":"Museums",
        "历史":"History",
        "原子能":"Atomic Energy",
        "口腔":"Stomatology",
        "哲学":"Philosophy",
        "国际政治":"International Politics",
        "地球物理":"Geophysics",
        "地理":"Geography",
        "地质":"Geology",
        "基础医学":"Basic Medicine",
        "声学工程":"Acoustic Engineering",
        "外国语言":"Foreign Languages",
        "外科":"Surgery",
        "外语":"Foreign Languages",
        "天文学":"Astronomy",
        "妇科":"Gynecology",
        "学前教育":"Pre-school Education",
        "安全科学":"Safety Science",
        "宗教":"Religion",
        "审计":"Auditing",
        "属切割金属粘接":"Metal Cutting & Bonding",
        "工业经济":"Industrial Economics",
        "工程材料":"Engineering Materials",
        "广播电视":"Broadcasting & Television",
        "建筑":"Architecture",
        "心理学":"Psychology",
        "戏剧":"Drama",
        "政治":"Politics",
        "教师教育":"Teacher Education",
        "数学":"Mathematics",
        "数民族语言":"Minority Languages",
        "文学":"Literature",
        "文学作品":"Literary Works",
        "新闻学":"Journalism",
        "旅游":"Tourism",
        "无机化工工业":"Inorganic Chemical Industry",
        "有机化工":"Organic Chemical Engineering",
        "木材加工家具":"Wood Processing & Furniture",
        "林业":"Forestry",
        "档案学":"Archival Studies",
        "植物保护":"Plant Protection",
        "植物学":"Botany",
        "武器工业":"Weapons Industry",
        "民族学":"Ethnology",
        "气象":"Meteorology",
        "水利":"Water Conservancy",
        "水路":"Waterway Transport",
        "法律":"Law",
        "测绘学":"Surveying & Mapping",
        "济管理":"Economics & Management",
        "海洋学":"Oceanography",
        "烟草":"Tobacco",
        "煤矿":"Coal Mining",
        "物理":"Physics",
        "物理学":"Physics",
        "特种医学":"Special Medicine",
        "环境科学":"Environmental Science",
        "生物":"Biology",
        "生物科学":"Biological Sciences",
        "电化教育":"Educational Technology",
        "电工技术":"Electrical Engineering",
        "畜牧动物医学":"Animal Husbandry & Veterinary",
        "皮肤病学与性病学":"Dermatology & Venereology",
        "皮革":"Leather",
        "真空技术":"Vacuum Technology",
        "眼科":"Ophthalmology",
        "石油天然气":"Petroleum & Gas",
        "矿业工程":"Mining Engineering",
        "社会学":"Sociology",
        "神经病学与精神病学":"Neurology & Psychiatry",
        "科学研究":"Scientific Research",
        "管理学":"Management",
        "纺织染整工业":"Textile & Dyeing Industry",
        "绘画雕塑工艺美术":"Painting, Sculpture & Decorative Arts",
        "统计学":"Statistics",
        "综合农业科学":"General Agriculture",
        "综合医学":"General Medicine",
        "综合性经济科学":"General Economic Sciences",
        "综合理工农医类":"General STEM",
        "网络安全保密":"Cybersecurity",
        "考古":"Archaeology",
        "耳鼻咽喉":"ENT",
        "职业教育":"Vocational Education",
        "肿瘤学":"Oncology",
        "能源与动力工程":"Energy & Power Engineering",
        "自然科学总论":"General Natural Sciences",
        "航空航天":"Aerospace",
        "艺术":"Arts",
        "药学":"Pharmacy",
        "计算机技术与自动化":"Computer Technology & Automation",
        "计量学":"Metrology",
        "语文":"Chinese Language",
        "贸易经济":"Trade Economics",
        "轻工综合":"Light Industry (General)",
        "运输综合":"Transportation (General)",
        "通用技术与设备":"General Technology & Equipment",
        "造纸":"Paper Making",
        "配工艺":"Allocation Technology",
        "铁路":"Railway",
        "音乐":"Music",
        "食品工业":"Food Industry",
        "高等教育":"Higher Education",
    },
    tier: {
        "一级":"Tier 1",
        "核心":"Core",
        "其他":"Other",
    },
  };
  // tn(value, type) — translate a domestic data field value, falling back to original
  const tn = (val, type) => {
    if (lang !== 'en' || !val) return val;
    const m = DOM_I18N[type];
    return (m && m[val]) || val;
  };

  let journals = [];
  let domestic = null;
  let domesticPromise = null;
  let india = null;
  let indiaPromise = null;
  let malaysia = null;
  let malaysiaPromise = null;
  let korea = null;
  let koreaPromise = null;
  const regionalDirectoryCache = Object.create(null);
  const regionalDirectoryPromises = Object.create(null);
  let esiCats = [];
  let meta = null;
  let journalsReady = false;
  let journalsPromise = null;
  let homeJournals = [];
  let oaMap = null;        // compact OpenAlex map, loaded only when a detail/recommendation needs it.
  let oaMapPromise = null;
  let countryOutputMap = null; // preseeded OpenAlex country shares (data/country_output.json.gz)
  let countryOutputMapPromise = null;
  let journalUpdates = { updated_at: '', items: [] };
  // review_cycles now read from embedded doaj.review_weeks in journals.json.gz
  const DEFAULT_JOURNAL_ALIASES = {
    BE: 'BUILDING AND ENVIRONMENT',
    'B&E': 'BUILDING AND ENVIRONMENT',
    JAABE: 'JOURNAL OF ASIAN ARCHITECTURE AND BUILDING ENGINEERING',
    JBE: 'JOURNAL OF BUILDING ENGINEERING',
    JBPS: 'JOURNAL OF BUILDING PERFORMANCE SIMULATION',
    EB: 'ENERGY AND BUILDINGS',
    'E&B': 'ENERGY AND BUILDINGS',
    TVST: 'TRANSLATIONAL VISION SCIENCE & TECHNOLOGY',
  };
  const ACRONYM_STOP_WORDS = new Set([
    'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of',
    'on', 'or', 'the', 'to', 'with',
  ]);
  let searchMetaCache = new WeakMap();
  let aliasTargetsByKey = new Map();
  let aliasDisplayByTitle = new Map();


  // ── Title-case helpers (用户偏好：源数据保留全大写，渲染时 transform) ──
  const TITLECASE_LOWER = new Set(['of','and','the','in','on','for','to','a','an','with','as','at','by','from','but','or','nor','vs','via','per']);
  const TITLECASE_KEEP = new Set([
    'IEEE','ACM','NASA','IUPAC','DNA','RNA','USA','UK','EU','UN','SIAM','AAAS','NATO',
    'PLOS','ACS','JAMA','BMJ','PNAS','MIT','NIH','NIST','SPIE','OSA','RSC','IOP',
    'APA','OECD','ISO','UNESCO','WHO','FDA','EPA','EMBL','EMBO','CERN','LHC',
    'AI','ML','AR','VR','GIS','GPS','IT','HCI','HVAC','LED','OLED','PCB','RFID',
    'PDF','URL','HTML','CSS','API','SDK','SQL','TCP','UDP','HTTP','HTTPS',
    'PV','UV','IR','XRD','MRI','CT','EEG','ECG','PCR','RNA','BMC','PLOS','SAGE',
    '3D','2D','4D'
  ]);
  function titleCase(s) {
    if (!s) return s;
    const str = String(s);
    // 仅当原字符串看起来是「全大写英文」时转换；含小写字母则保留原样
    if (/[a-z]/.test(str)) return str;
    if (!/[A-Z]/.test(str)) return str;
    // tokenize: 保留空格/连字符/标点为 token
    const tokens = str.split(/([^A-Za-z0-9'&]+)/);
    // 找出所有「单词 token」的索引，便于判断首/尾词
    const wordIdx = tokens.map((t, i) => /[A-Za-z]/.test(t) ? i : -1).filter(i => i >= 0);
    const firstWord = wordIdx[0], lastWord = wordIdx[wordIdx.length - 1];
    return tokens.map((tok, i) => {
      if (!/[A-Za-z]/.test(tok)) return tok;
      const upper = tok.toUpperCase();
      // 缩写白名单：保留全大写
      if (TITLECASE_KEEP.has(upper)) return upper;
      // 含数字的词（如 H2O, CO2, 2D, B2B）保留全大写
      if (/\d/.test(tok)) return upper;
      // 罗马数字（II, III, IV, IX 等）保留全大写
      if (/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(upper) && upper.length > 1) return upper;
      const lower = tok.toLowerCase();
      // 首尾词强制大写；中间小词保持小写
      if (i !== firstWord && i !== lastWord && TITLECASE_LOWER.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join('');
  }

  // ── 国际期刊 ISSN/eISSN/标题反向索引（供 CAST 等国内源抽屉查国际信息）──
  const intIndex = { byIssn: Object.create(null), byName: Object.create(null) };
  const indiaIndex = { byIssn: Object.create(null), byName: Object.create(null) };
  function buildIntIndex(arr) {
    for (const r of arr) {
      if (r.issn) intIndex.byIssn[String(r.issn).toUpperCase()] = r;
      if (r.eissn) intIndex.byIssn[String(r.eissn).toUpperCase()] = r;
      const nk = normTitle(r.name || r.en_name || '');
      if (nk) intIndex.byName[nk] = r;
    }
  }
  function lookupInt(r) {
    const issns = [r.issn, r.eissn, r.cn_code].filter(Boolean).map(s => String(s).toUpperCase());
    for (const i of issns) if (intIndex.byIssn[i]) return intIndex.byIssn[i];
    const nk = normTitle(r.en_name || r.name || '');
    if (nk && intIndex.byName[nk]) return intIndex.byName[nk];
    return null;
  }

  function buildIndiaIndex(d) {
    indiaIndex.byIssn = Object.create(null);
    indiaIndex.byName = Object.create(null);
    for (const r of (d && d.records) || []) {
      const rec = { ...r, __src: 'in' };
      for (const key of [r.issn, r.eissn]) {
        if (key && key !== 'NA') indiaIndex.byIssn[String(key).toUpperCase()] = rec;
      }
      const nk = normTitle(r.journal_title || r.name || '');
      if (nk) indiaIndex.byName[nk] = rec;
    }
  }

  function lookupIndia(r) {
    for (const key of [r?.issn, r?.eissn].filter(Boolean)) {
      const hit = indiaIndex.byIssn[String(key).toUpperCase()];
      if (hit) return hit;
    }
    const nk = normTitle(r?.name || r?.journal_title || r?.en_name || '');
    return nk ? indiaIndex.byName[nk] || null : null;
  }

  function loadMalaysiaData() {
    if (malaysia) return Promise.resolve(malaysia);
    if (!malaysiaPromise) {
      malaysiaPromise = fetch('/data/malaysia.json')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          malaysia = d;
          return malaysia;
        })
        .catch(() => null);
    }
    return malaysiaPromise;
  }

  function loadKoreaData() {
    if (korea) return Promise.resolve(korea);
    if (!koreaPromise) {
      koreaPromise = fetch('/data/korea.json')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          korea = data;
          return korea;
        })
        .catch(() => null);
    }
    return koreaPromise;
  }

  function loadRegionalDirectory(source) {
    if (regionalDirectoryCache[source]) return Promise.resolve(regionalDirectoryCache[source]);
    if (!regionalDirectoryPromises[source]) {
      regionalDirectoryPromises[source] = fetchJSON(`/data/regional/${source}.json.gz`)
        .then(data => (regionalDirectoryCache[source] = data))
        .catch(() => null);
    }
    return regionalDirectoryPromises[source];
  }

  function lookupOA(r) {
    if (!oaMap) return null;
    const keys = [r.issn, r.eissn].filter(Boolean).map(s => String(s).toUpperCase());
    for (const k of keys) {
      if (oaMap[k]) return oaMap[k];
    }
    return null;
  }

  function loadOaMap() {
    if (oaMap) return Promise.resolve(oaMap);
    if (!oaMapPromise) {
      oaMapPromise = fetchJSON('data/oa.json.gz')
        .then(data => {
          oaMap = data || {};
          return oaMap;
        })
        .catch(() => {
          oaMap = {};
          return oaMap;
        });
    }
    return oaMapPromise;
  }

  function loadCountryOutputMap() {
    if (countryOutputMap) return Promise.resolve(countryOutputMap);
    if (!countryOutputMapPromise) {
      countryOutputMapPromise = fetchJSON('data/country_output.json.gz')
        .then(data => {
          countryOutputMap = (data && data.m) || data || {};
          return countryOutputMap;
        })
        .catch(() => {
          countryOutputMap = {};
          return countryOutputMap;
        });
    }
    return countryOutputMapPromise;
  }

  function issnKeyForCountryCache(value) {
    const compact = String(value || '').toUpperCase().replace(/[^0-9X]/g, '');
    return compact.length === 8 ? compact : '';
  }

  /** Expand compact preseed row → { years, top } for the chart renderer. */
  function expandCountryOutputPreseed(compact) {
    if (!compact || !Array.isArray(compact.y) || !compact.y.length || !Array.isArray(compact.t) || !compact.t.length) {
      return null;
    }
    const names = compact.t;
    const codes = Array.isArray(compact.c) ? compact.c : [];
    const years = compact.y.map(row => {
      const counts = Array.isArray(row.n) ? row.n : [];
      const groups = names.map((name, i) => ({
        name,
        code: codes[i] || '',
        count: Number(counts[i] || 0),
      })).filter(g => g.count > 0);
      return {
        year: Number(row.y),
        total: Number(row.tot || 0),
        groups,
      };
    }).filter(row => row.total > 0 && row.groups.length);
    if (!years.length) return null;
    return { years, top: names, source: 'preseed' };
  }

  function lookupCountryOutputPreseed(r) {
    if (!countryOutputMap) return null;
    const keys = [r?.issn, r?.eissn].map(issnKeyForCountryCache).filter(Boolean);
    for (const k of keys) {
      const hit = countryOutputMap[k];
      if (!hit) continue;
      if (hit.empty) return null;
      const payload = expandCountryOutputPreseed(hit);
      if (payload) return payload;
    }
    return null;
  }

  function loadDomesticData() {
    if (domestic) return Promise.resolve(domestic);
    if (!domesticPromise) {
      domesticPromise = fetch('/data/domestic.json')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          domestic = data;
          buildDomIndex(domestic);
          return domestic;
        })
        .catch(() => null);
    }
    return domesticPromise;
  }

  function loadIndiaData() {
    if (india) return Promise.resolve(india);
    if (!indiaPromise) {
      indiaPromise = fetch('/data/india.json')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          india = data;
          buildIndiaIndex(india);
          return india;
        })
        .catch(() => null);
    }
    return indiaPromise;
  }

  const countryOutputCache = new Map();
  const countryOutputColors = ['#b64b3f', '#2c6c8f', '#7a5a24', '#3f7d57', '#6c5a92', '#b7a27b'];

  function normalizeIssnForOpenAlex(value) {
    const text = String(value || '').trim().toUpperCase();
    const compact = text.replace(/[^0-9X]/g, '');
    return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : '';
  }

  function countryOutputYears(r, limit = 3) {
    // 默认只查近 3 年，避免 OpenAlex 限流导致长时间卡在「正在加载」
    const points = Array.isArray(r?.publication_history) ? r.publication_history : [];
    const years = points
      .map(p => Number(p.year))
      .filter(y => Number.isFinite(y) && y >= 1900)
      .sort((a, b) => a - b);
    if (years.length) return years.slice(-limit);
    const now = new Date().getFullYear();
    return Array.from({ length: limit }, (_, i) => now - limit + 1 + i);
  }

  function normalizeCountryShareGroup(group) {
    const code = String(group.code || '').toUpperCase();
    const name = String(group.name || '').trim();
    if (['CN', 'TW', 'HK', 'MO'].includes(code) || /^(china|taiwan|hong kong|macao|macau)$/i.test(name)) {
      return { code: 'CN', name: 'China' };
    }
    return { code, name };
  }

  async function fetchCountryOutputData(r, opts = {}) {
    const issns = [normalizeIssnForOpenAlex(r?.issn), normalizeIssnForOpenAlex(r?.eissn)]
      .filter((value, index, arr) => value && arr.indexOf(value) === index);
    if (!issns.length) return null;
    // 1) 静态预置：详情页立刻出图，不再等 OpenAlex
    try {
      await loadCountryOutputMap();
      const preseed = lookupCountryOutputPreseed(r);
      if (preseed) return preseed;
    } catch (_) { /* continue live path */ }
    if (opts.preseedOnly) return null;
    const years = countryOutputYears(r);
    const cacheKey = `${issns.join('|')}|${years.join(',')}`;
    if (countryOutputCache.has(cacheKey)) return countryOutputCache.get(cacheKey);
    const normalizePayload = (payload) => {
      const usable = (Array.isArray(payload?.years) ? payload.years : [])
        .filter(row => Number(row?.total || 0) > 0 && Array.isArray(row?.groups));
      if (!usable.length) return null;
      if (Array.isArray(payload?.top) && payload.top.length) return { years: usable, top: payload.top };
      const countryTotals = new Map();
      usable.forEach(row => row.groups.forEach(g => {
        const key = g.name;
        countryTotals.set(key, (countryTotals.get(key) || 0) + Number(g.count || 0));
      }));
      const ranked = [...countryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
      const top = (ranked.includes('China')
        ? ['China', ...ranked.filter((n) => n !== 'China')]
        : ranked
      ).slice(0, 5);
      return { years: usable, top };
    };
    const fetchFromApi = async () => {
      const params = new URLSearchParams({
        issn: issns.join(','),
        years: years.join(','),
      });
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
      try {
        // 勿 force-cache：空结果（缺 key / 上游失败）会被永久缓存成「无分布」
        const resp = await fetch(`${API_BASE}/openalex/country-output?${params.toString()}`, {
          cache: 'default',
          ...(controller ? { signal: controller.signal } : {}),
        });
        if (!resp.ok) return { handled: false, payload: null };
        const raw = await resp.json();
        const payload = normalizePayload(raw);
        // 有有效年份数据才算成功；否则继续走 OpenAlex 直连回退
        if (payload?.years?.length) return { handled: true, payload };
        return { handled: false, payload: null, reason: raw?.reason || 'empty' };
      } catch (_) {
        return { handled: false, payload: null };
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    const fetchYear = async (sourceIssn, year, attempt = 0) => {
      const params = new URLSearchParams({
        filter: `primary_location.source.issn:${sourceIssn},from_publication_date:${year}-01-01,to_publication_date:${year}-12-31`,
        group_by: 'authorships.institutions.country_code',
        'per-page': '200',
        mailto: 'ailatest@ailatest.org',
      });
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;
      try {
        const resp = await fetch(`https://api.openalex.org/works?${params.toString()}`, controller ? { signal: controller.signal } : undefined);
        if (resp.status === 429 && attempt < 2) {
          await new Promise(r => setTimeout(r, 900 * (attempt + 1)));
          return fetchYear(sourceIssn, year, attempt + 1);
        }
        if (!resp.ok) return { year, total: 0, groups: [], skipped: true };
        const data = await resp.json();
        const groups = (data.group_by || [])
          .map(g => ({
            code: String(g.key || '').split('/').pop()?.replace(/^countries\//i, '') || '',
            name: String(g.key_display_name || '').trim(),
            count: Number(g.count || 0),
          }))
          .filter(g => g.count > 0 && g.name && !/^unknown$/i.test(g.name));
        const merged = new Map();
        groups.forEach(g => {
          const key = normalizeCountryShareGroup(g);
          if (!key.name) return;
          const current = merged.get(key.name) || { ...key, count: 0 };
          current.count += g.count;
          merged.set(key.name, current);
        });
        const mergedGroups = [...merged.values()];
        const total = mergedGroups.reduce((sum, g) => sum + g.count, 0);
        return { year, total, groups: mergedGroups };
      } catch (_) {
        return { year, total: 0, groups: [], skipped: true };
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    const buildFromRows = (usable) => {
      if (!usable?.length) return null;
      const countryTotals = new Map();
      usable.forEach(row => row.groups.forEach(g => {
        const key = g.name;
        countryTotals.set(key, (countryTotals.get(key) || 0) + g.count);
      }));
      const ranked = [...countryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
      const top = (ranked.includes('China')
        ? ['China', ...ranked.filter(n => n !== 'China')]
        : ranked
      ).slice(0, 5);
      if (!top.length) return null;
      return { years: usable, top, source: 'openalex-client' };
    };
    const fetchFromClient = async () => {
      // Worker 常被 OpenAlex 公共池 429；浏览器直连往往仍可用
      const clientYears = years.slice(-3);
      for (const sourceIssn of issns) {
        const rows = [];
        for (const year of clientYears) {
          rows.push(await fetchYear(sourceIssn, year));
          await new Promise(r => setTimeout(r, 180));
        }
        const payload = buildFromRows(rows.filter(row => row.total > 0));
        if (payload) return payload;
      }
      return null;
    };
    const promise = (async () => {
      // API 与浏览器直连并行：谁先有有效 years 用谁，避免卡在「正在拉取…」
      const apiP = fetchFromApi().catch(() => ({ handled: false, payload: null }));
      const clientP = fetchFromClient().catch(() => null);
      const apiResult = await apiP;
      if (apiResult.handled && apiResult.payload?.years?.length) return apiResult.payload;
      const clientResult = await clientP;
      if (clientResult?.years?.length) return clientResult;
      return null;
    })().catch(err => {
      countryOutputCache.delete(cacheKey);
      throw err;
    });
    countryOutputCache.set(cacheKey, promise);
    return promise;
  }

  function renderCountryOutputChartData(payload, selectedCountry = 'China') {
    if (!payload || !payload.years?.length || !payload.top?.length) return '';
    const countryDisplay = (name) => {
      const zh = {
        'China': '中国（含港澳台）',
        'United States of America': '美国',
        'United States': '美国',
        'United Kingdom of Great Britain and Northern Ireland': '英国',
        'United Kingdom': '英国',
        'Australia': '澳大利亚',
        'Canada': '加拿大',
        'Germany': '德国',
        'France': '法国',
        'Japan': '日本',
        'India': '印度',
        'Italy': '意大利',
        'Spain': '西班牙',
        'Netherlands': '荷兰',
        'Brazil': '巴西',
        'Russian Federation': '俄罗斯',
        'Iran (Islamic Republic of)': '伊朗',
        'Korea, Republic of': '韩国',
        'South Korea': '韩国',
      };
      const en = {
        'China': 'China incl. HK/Macao/Taiwan',
        'United States of America': 'United States',
        'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
        'Russian Federation': 'Russia',
        'Iran (Islamic Republic of)': 'Iran',
        'Korea, Republic of': 'South Korea',
      };
      return T(zh[name] || name, en[name] || name);
    };
    const countries = [...payload.top, 'Other'];
    const selected = payload.top.includes(selectedCountry)
      ? selectedCountry
      : (payload.top[0] || 'China');
    const select = `<label class="country-select-wrap"><span>${T('显示趋势','Trend')}</span><select class="country-select" aria-label="${T('选择国家/地区','Select country/region')}">${payload.top.map(name => `<option value="${escape(name)}"${name === selected ? ' selected' : ''}>${escape(countryDisplay(name))}</option>`).join('')}</select></label>`;
    const legend = countries.map((name, i) => (
      `<span class="country-legend-item"><span class="country-swatch" style="background:${countryOutputColors[i % countryOutputColors.length]}"></span>${escape(name === 'Other' ? T('其他','Other') : countryDisplay(name))}</span>`
    )).join('');
    const rowH = 29;
    const w = 320, h = Math.max(rowH, payload.years.length * rowH);
    const barX = 46, barW = 228;
    const xFor = (pct) => barX + Math.max(0, Math.min(100, pct)) / 100 * barW;
    const yFor = (i) => i * rowH + rowH / 2;
    const trendPoints = [];
    const rows = payload.years.map(row => {
      const byName = new Map(row.groups.map(g => [g.name, g.count]));
      const topCounts = payload.top.map(name => ({ name, count: byName.get(name) || 0 }));
      const topTotal = topCounts.reduce((sum, item) => sum + item.count, 0);
      const selectedCount = byName.get(selected) || 0;
      const selectedPct = row.total ? selectedCount / row.total * 100 : 0;
      trendPoints.push({ year: row.year, pct: selectedPct, x: xFor(selectedPct), y: yFor(trendPoints.length) });
      const segments = [...topCounts, { name: 'Other', count: Math.max(0, row.total - topTotal) }]
        .filter(item => item.count > 0)
        .map((item) => {
          const pct = row.total ? (item.count / row.total) * 100 : 0;
          const label = `${item.name === 'Other' ? T('其他','Other') : countryDisplay(item.name)} ${pct.toFixed(pct >= 10 ? 0 : 1)}%`;
          return `<div class="country-segment" style="width:${pct.toFixed(3)}%;background:${countryOutputColors[(item.name === 'Other' ? countries.length - 1 : countries.indexOf(item.name)) % countryOutputColors.length]}" title="${escape(`${row.year} · ${label} · ${item.count}`)}">${pct >= 18 ? `<span>${escape(`${pct.toFixed(0)}%`)}</span>` : ''}</div>`;
        }).join('');
      return `<div class="country-bar-row">
        <div class="country-year">${row.year}${row.year >= 2026 ? `<span>${T('快照','YTD')}</span>` : ''}</div>
        <div class="country-bar" aria-label="${escape(String(row.year))}">${segments}</div>
        <div class="country-total">${Number.isFinite(selectedPct) ? selectedPct.toFixed(selectedPct >= 10 ? 0 : 1) : '-'}%</div>
      </div>`;
    }).join('');
    const trendPath = trendPoints.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const trendDots = trendPoints.map(p => `<circle class="country-line-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.4"><title>${p.year}: ${p.pct.toFixed(p.pct >= 10 ? 0 : 1)}%</title></circle>`).join('');
    return `<div class="country-output-head"><div><div class="trend-title">${T('国家/地区比例','Country/Region Shares')}</div><div class="trend-unit">${T('OpenAlex 作者机构占比','OpenAlex author affiliation share')}</div></div>${select}</div>
      <div class="country-output-chart">
        ${rows}
        <svg class="country-line-svg" viewBox="0 0 ${w} ${h}" aria-label="${escape(countryDisplay(selected))}">
        <path class="country-line-path" d="${trendPath}"></path>
        ${trendDots}
        </svg>
      </div>
      <div class="country-legend">${legend}</div>
      `;
  }

  function bindCountryOutputSelect(box, payload) {
    const select = box.querySelector('.country-select');
    if (!select || !payload) return;
    select.addEventListener('change', () => {
      box.innerHTML = renderCountryOutputChartData(payload, select.value);
      bindCountryOutputSelect(box, payload);
    });
  }

  function renderCountryOutputFallback(r, opts = {}) {
    const country = String(r?.country || '').trim();
    const loadingNote = opts.loading
      ? T('正在拉取作者机构国家/地区占比…', 'Loading author-affiliation country/region shares…')
      : T('出版地信息正常显示；作者机构国家/地区占比暂无数据。', 'Publication region is shown above; author-affiliation country/region shares are not currently available.');
    if (!country) {
      return `<div class="country-output-fallback">
        <div class="trend-title">${T('国家/地区信息','Country/Region')}</div>
        <div class="country-fallback-note">${opts.loading
          ? T('正在拉取作者机构国家/地区占比…', 'Loading author-affiliation country/region shares…')
          : T('作者机构分布数据暂时不可用。','Author-affiliation distribution is temporarily unavailable.')}</div>
      </div>`;
    }
    const countryNames = {
      'ENGLAND': ['英国', 'United Kingdom'], 'UNITED KINGDOM': ['英国', 'United Kingdom'],
      'UNITED STATES': ['美国', 'United States'], 'USA': ['美国', 'United States'],
      'CHINA': ['中国', 'China'], 'TAIWAN': ['中国台湾', 'China Taiwan'],
      'HONG KONG': ['中国香港', 'China Hong Kong'], 'MACAO': ['中国澳门', 'China Macao'],
      'ITALY': ['意大利', 'Italy'], 'GERMANY': ['德国', 'Germany'], 'FRANCE': ['法国', 'France'],
      'JAPAN': ['日本', 'Japan'], 'SOUTH KOREA': ['韩国', 'South Korea'], 'KOREA': ['韩国', 'South Korea'],
      'INDIA': ['印度', 'India'], 'POLAND': ['波兰', 'Poland'], 'IRAN': ['伊朗', 'Iran'],
      'BRAZIL': ['巴西', 'Brazil'], 'SPAIN': ['西班牙', 'Spain'], 'AUSTRALIA': ['澳大利亚', 'Australia'],
      'CANADA': ['加拿大', 'Canada'], 'NETHERLANDS': ['荷兰', 'Netherlands'], 'SWITZERLAND': ['瑞士', 'Switzerland'],
    };
    const labels = countryNames[country.toUpperCase()] || [country, country];
    const display = T(labels[0], labels[1]);
    return `<div class="country-output-fallback">
      <div><div class="trend-title">${T('期刊出版地区','Journal publication region')}</div><div class="trend-unit">${T('来自期刊基础资料','From journal metadata')}</div></div>
      <div class="country-fallback-value"><strong>${escape(display)}</strong>${display.toUpperCase() !== country.toUpperCase() ? `<span>${escape(country)}</span>` : ''}</div>
      <div class="country-fallback-note">${loadingNote}</div>
    </div>`;
  }

  async function hydrateCountryOutputChart(root, r) {
    const box = root.querySelector('.country-output-card');
    if (!box) return;
    const paint = (payload) => {
      const html = renderCountryOutputChartData(payload);
      if (html) {
        box.innerHTML = html;
        bindCountryOutputSelect(box, payload);
        return true;
      }
      return false;
    };
    const withTimeout = (p, ms) => Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('country-output timeout')), ms)),
    ]);
    try {
      // 1) 静态预置优先：命中即出图（空 map 很快返回 null）
      const preseed = await withTimeout(fetchCountryOutputData(r, { preseedOnly: true }), 2500);
      if (paint(preseed)) return;
      // 2) 无预置：先展示出版地，并提示正在补全作者机构分布
      box.innerHTML = renderCountryOutputFallback(r, { loading: true });
      // 3) 实时补全（API∥浏览器 OpenAlex）；超时后保留出版地，避免永远转圈
      withTimeout(fetchCountryOutputData(r), 9000)
        .then((payload) => {
          if (!box.isConnected) return;
          if (!paint(payload)) {
            box.innerHTML = renderCountryOutputFallback(r);
          }
        })
        .catch((err) => {
          console.warn('country distribution live refresh failed:', err?.message || err);
          if (box.isConnected) box.innerHTML = renderCountryOutputFallback(r);
        });
    } catch (err) {
      console.warn('country distribution load failed:', err?.message || err);
      box.innerHTML = renderCountryOutputFallback(r);
    }
  }

  function isFreeToPublish(r) {
    if (!r) return false;
    if (r.free) return true;
    const oa = lookupOA(r);
    const label = String(oa?.l || oa?.label || '').toLowerCase();
    return label === 'diamond' || label === 'hybrid' || label === 'subscription_paid_read';
  }

  /** free | trial | plus(Pro) | pro(Max) — 权益门闸用；试用与 Pro 能力接近但不等于付费 Pro */
  function getProductTier() {
    try {
      if (user && (user.is_owner || user.plan === 'owner' || user.entitlements?.is_owner || user.entitlements?.plan === 'owner')) {
        return 'pro'; // Max
      }
      // product_tier 是产品文案档 free/trial/pro/max
      const product = String(user?.entitlements?.product_tier || '').toLowerCase();
      if (product === 'max') return 'pro';
      if (product === 'pro') return 'plus';
      if (product === 'trial') return 'trial';
      const email = String(user?.email || '').toLowerCase().trim();
      const login = String(user?.login || '').toLowerCase().trim();
      // 站长邮箱兜底（服务端也会判 owner；避免 Mac 上旧会话未合并 is_owner）
      if (email === 'jiantaoweng@gmail.com' || login === 'jiantaoweng@gmail.com' || login === 'jiantaoweng') {
        return 'pro';
      }
      const tier = String(user?.entitlements?.tier || user?.tier || 'free').toLowerCase();
      if (tier === 'pro' || tier === 'max') return 'pro';
      if (tier === 'plus') return 'plus';
      // 试用：权益接近 Pro，但展示必须是「试用」而非 Pro
      if (tier === 'trial') return 'trial';
    } catch (_) {}
    return 'free';
  }

  /** 门闸：是否具备 Pro 级能力（含试用；不含 Free） */
  function hasProLevelAccess() {
    const t = getProductTier();
    return t === 'plus' || t === 'trial' || t === 'pro';
  }

  function isOwnerClient() {
    try {
      if (user?.is_owner || user?.plan === 'owner' || user?.entitlements?.is_owner || user?.entitlements?.plan === 'owner') return true;
      const email = String(user?.email || '').toLowerCase().trim();
      const login = String(user?.login || '').toLowerCase().trim();
      return email === 'jiantaoweng@gmail.com' || login === 'jiantaoweng@gmail.com' || login === 'jiantaoweng';
    } catch (_) {
      return false;
    }
  }

  /** 发表费用信息（是否免费发表 / APC）— Pro / 试用 / Max 可见；Free 不可见 */
  function canSeePublishFeeInfo() {
    if (hasProLevelAccess()) return true;
    try {
      const labels = user?.entitlements?.features?.premium_labels
        || user?.entitlements?.premium_labels;
      if (labels && labels.publish_fee === true) return true;
      if (user?.entitlements?.features?.publish_fee_info === true) return true;
    } catch (_) {}
    return false;
  }

  /**
   * 收藏额度：
   *  Free（含未登录本地）→ 5 本
   *  Pro / 试用 → 50 本
   *  Max / 站长 → 不限
   *  多清单、分享仍走 canUseFavoritesWorkflow（Pro+）
   */
  const FREE_FAV_LIMIT = 5;
  const PRO_FAV_LIMIT = 50;

  function favLimitForUser() {
    try {
      if (isOwnerClient()) return Infinity;
      const t = getProductTier();
      if (t === 'pro') return Infinity; // Max
      if (t === 'plus' || t === 'trial') return PRO_FAV_LIMIT;
    } catch (_) {}
    return FREE_FAV_LIMIT;
  }

  /** 基础收藏（点 ★）：所有用户可用，受 favLimitForUser 限制 */
  function canUseBasicFavorites() {
    return true;
  }

  /** 多清单 / 分享等进阶工作流 — 试用 / Pro / Max */
  function canUseFavoritesWorkflow() {
    return hasProLevelAccess();
  }
  /** 导出 RIS/BibTeX · Zotero / Notion / Obsidian — 仅 Max */
  function canUseExportIntegrations() {
    return getProductTier() === 'pro';
  }

  /** 原文/OA 全文查找：Free 终身 30 · Pro 每月 200 · Max 不限（按文章去重） */
  const FREE_FULLTEXT_LIMIT = 30;
  const PRO_FULLTEXT_LIMIT = 200; // Pro：每月额度
  const FULLTEXT_USAGE_KEY = 'ailatest.fulltextUsage';
  function fulltextMonthKey() {
    return new Date().toISOString().slice(0, 7); // YYYY-MM UTC
  }
  function getFulltextLimit() {
    const tier = getProductTier();
    if (tier === 'pro' || tier === 'trial') return null; // Max / 试用：不限（与服务端 trial 一致）
    if (tier === 'plus') return PRO_FULLTEXT_LIMIT;
    return FREE_FULLTEXT_LIMIT;
  }
  /** Free 用 lifetime；Pro 用 month 桶（换月清空） */
  function getFulltextUsage() {
    try {
      const raw = JSON.parse(localStorage.getItem(FULLTEXT_USAGE_KEY) || '{}');
      const lifetime = Array.isArray(raw.lifetime)
        ? raw.lifetime.map(String)
        : (Array.isArray(raw.keys) && !raw.month ? raw.keys.map(String) : []);
      const month = fulltextMonthKey();
      const monthly = (raw.month === month && Array.isArray(raw.monthly))
        ? raw.monthly.map(String)
        : [];
      return { lifetime, month, monthly };
    } catch (_) {
      return { lifetime: [], month: fulltextMonthKey(), monthly: [] };
    }
  }
  function saveFulltextUsage(u) {
    try {
      localStorage.setItem(FULLTEXT_USAGE_KEY, JSON.stringify({
        lifetime: (u.lifetime || []).slice(0, 500),
        month: u.month || fulltextMonthKey(),
        monthly: (u.monthly || []).slice(0, 800),
      }));
    } catch (_) {}
  }
  function fulltextArticleKey(data) {
    const doi = String(data?.doi || '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim().toLowerCase();
    if (doi) return `doi:${doi}`;
    const url = String(data?.url || data?.pdfUrl || '').split('#')[0].trim().toLowerCase();
    if (url) return `url:${url}`;
    const title = String(data?.title || '').trim().toLowerCase().slice(0, 120);
    return title ? `t:${title}` : '';
  }
  function fulltextKeysForTier(u) {
    return getProductTier() === 'plus' ? (u.monthly || []) : (u.lifetime || []);
  }
  function canUseFulltextOpen(articleKey) {
    const limit = getFulltextLimit();
    if (limit == null) return { ok: true, unlimited: true };
    const u = getFulltextUsage();
    const keys = fulltextKeysForTier(u);
    if (articleKey && keys.includes(articleKey)) {
      return { ok: true, used: keys.length, limit, remaining: Math.max(0, limit - keys.length), monthly: getProductTier() === 'plus' };
    }
    if (keys.length >= limit) {
      return { ok: false, used: keys.length, limit, remaining: 0, monthly: getProductTier() === 'plus' };
    }
    return { ok: true, used: keys.length, limit, remaining: limit - keys.length, monthly: getProductTier() === 'plus' };
  }
  function consumeFulltextOpen(articleKey) {
    const limit = getFulltextLimit();
    if (limit == null) return true;
    const gate = canUseFulltextOpen(articleKey);
    if (!gate.ok) return false;
    if (!articleKey) return true;
    const u = getFulltextUsage();
    const isPro = getProductTier() === 'plus';
    const keys = isPro ? u.monthly : u.lifetime;
    if (!keys.includes(articleKey)) {
      keys.push(articleKey);
      if (isPro) u.monthly = keys;
      else u.lifetime = keys;
      saveFulltextUsage(u);
    }
    return true;
  }

  function journalPathSlug(pathname = location.pathname) {
    const m = pathname.match(/^\/journal\/([^/?#]+)\/?$/);
    if (!m) return '';
    return decodeRoutePart(m[1]);
  }

  function journalPublicPath(r) {
    const slug = r?.slug || favId(r);
    return slug ? `/journal/${encodeURIComponent(slug)}/` : '/';
  }

  let activeTab = 'home';
  const tabScrollPositions = new Map();
  const reusableTabPanels = new Set(['int', 'dom', 'in', 'my', 'kr', 'pbn', 'isc', 'scielo']);
  let homeMode = 'search';
  // 一律带尾斜杠：Cloudflare Pages 对无尾斜杠的 SPA 路径会 308 到「/」首页
  // （/rankings → /，/global → / …）；有尾斜杠则 rewrite 到 index.html 正常。
  const TAB_PATHS = {
    home: '/',
    int: '/global/',
    dom: '/cn/',
    in: '/in/',
    my: '/my/',
    kr: '/kr/',
    pbn: '/pbn/',
    isc: '/isc/',
    scielo: '/scielo/',
    fav: '/favorites/',
    me: '/account/',
    pick: '/pick/',
  };
  const PATH_TABS = {
    '/': 'home', '/en': 'home', '/zh': 'home',
    '/global': 'int', '/international': 'int', '/journals': 'int',
    '/cn': 'dom', '/china': 'dom',
    '/in': 'in', '/india': 'in',
    '/my': 'my', '/malaysia': 'my',
    '/kr': 'kr', '/korea': 'kr',
    '/pbn': 'pbn', '/poland': 'pbn',
    '/isc': 'isc', '/scielo': 'scielo',
    '/favorites': 'fav',
    '/account': 'me', '/me': 'me', '/profile': 'me',
    // 榜单入口已并入首页 #rankings；二级页仍为 /indexes/ · /subjects/
    '/rankings': 'home', '/rankings/': 'home',
    '/pick': 'pick',
  };
  const TAB_SEO = {
    home: {
      title: 'AILatest Journal - Journal Finder, Rankings & Impact Factors',
      desc: 'AILatest Journal helps researchers search 40,000+ academic journals, compare impact factors, JCR quartiles, CAS tiers, indexing databases, review cycles, and AI-powered submission matches.'
    },
    homeZh: {
      title: 'AILatest Journal - 期刊查询 · 荐刊推荐 · SCI期刊检索',
      desc: 'AILatest Journal 是面向科研人员的免费期刊查询与荐刊推荐工具。聚合 SCI/SSCI/AHCI、JCR 影响因子、中科院分区、CCF、CSSCI 等数据，支持期刊搜索、荐刊推荐、收藏同步。'
    },
    int: {
      title: 'International Journal Search | SCI SSCI JCR IF CAS Tiers - AILatest Journal',
      desc: 'Search international journals by SCI, SSCI, AHCI, ESCI, EI, JCR impact factor, CAS tiers, Web of Science subjects, Scopus, DOAJ and warning lists.'
    },
    dom: {
      title: '中国期刊目录查询 | CSSCI 北大核心 中国科协 - AILatest Journal',
      desc: '查询中文期刊目录、中国科协高质量期刊、CSSCI、北大核心、CCF 中文推荐、浙江大学目录等中国期刊分级数据。'
    },
    updates: {
      title: '期刊动态 | 新刊 子刊 收录变化 出版报告 - AILatest Journal',
      desc: '追踪期刊出版动态，包括新刊与子刊、Web of Science 和 Scopus 收录变化、预警名单、投稿政策和重要出版报告。'
    },
    in: {
      title: 'India UGC-CARE Journal Directory | AILatest Journal',
      desc: 'Search India UGC-CARE Group I journals by title, publisher, ISSN, E-ISSN and subject.'
    },
    my: {
      title: 'Malaysia MyCite Journal Directory | ERA 2023 - AILatest Journal',
      desc: 'Search Malaysia MyCite 2025, MyCite online historical indexed journals, and ERA 2023 Submitted Journal List records.'
    },
    kr: {
      title: 'Korea KCI Journal Directory & Impact Factors | AILatest Journal',
      desc: 'Search Korea Research Foundation KCI journals by title, publisher, ISSN, subject, accreditation status and KCI impact factor.'
    },
    pbn: {
      title: 'Poland PBN / POL-on Journal Directory | AILatest Journal',
      desc: 'Search the official 2026 Polish PBN / POL-on journal directory by title, ISSN and ministry points.'
    },
    isc: {
      title: 'ISC Master Journals List | AILatest Journal',
      desc: 'Search the official ISC Master Journals List by journal title, ISSN, E-ISSN and ISC H-index.'
    },
    scielo: {
      title: 'SciELO Journal Directory | AILatest Journal',
      desc: 'Search the official SciELO network journal directory by title, ISSN and regional collection.'
    },
    fav: {
      title: '期刊收藏清单 | Journal Favorites - AILatest Journal',
      desc: '保存、同步、排序并分享你的目标期刊清单，支持跨设备收藏和期刊清单分享。'
    },
    pick: {
      title: '荐刊推荐工具 | Journal Finder for Paper Title and Keywords - AILatest Journal',
      desc: '输入论文题目、摘要或关键词，智能匹配研究主题、SCI/SSCI/EI 收录、JCR 分区、中科院分区、Scopus 与影响因子，推荐适合投稿的目标期刊。'
    }
  };
  function normalizeAppPath(pathname = location.pathname) {
    return String(pathname || '/').replace(/\/+$/, '') || '/';
  }
  function tabFromPath(pathname = location.pathname) {
    return PATH_TABS[normalizeAppPath(pathname)] || 'home';
  }
  function consumePendingTab() {
    try {
      // 1) sessionStorage 过渡（旧链接 / SEO 入口）
      const tab = sessionStorage.getItem('ailatest.pendingTab') || '';
      sessionStorage.removeItem('ailatest.pendingTab');
      if (TAB_PATHS[tab]) return tab;
    } catch (_) { /* ignore */ }
    // 2) ?tab=rank 查询参数
    try {
      const qTab = new URLSearchParams(location.search).get('tab') || '';
      if (TAB_PATHS[qTab]) return qTab;
    } catch (_) { /* ignore */ }
    return '';
  }
  function updatePageSeo(tab = activeTab) {
    const isZhHome = tab === 'home' && (location.pathname.replace(/\/+$/, '') === '/zh' || lang === 'zh-CN' || lang === 'zh-TW');
    const seo = isZhHome ? TAB_SEO.homeZh : (TAB_SEO[tab] || TAB_SEO.int);
    document.title = seo.title;
    const currentPath = location.pathname.replace(/\/+$/, '') || '/';
    const canonicalPath = tab === 'home'
      ? (currentPath === '/zh' ? '/zh' : currentPath === '/en' ? '/en' : '/')
      : ((tab === 'int' && (location.pathname === '/' || location.pathname === '')) ? '/' : (TAB_PATHS[tab] || '/'));
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', seo.desc);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://journal.ailatest.org' + canonicalPath);
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://journal.ailatest.org' + canonicalPath);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', seo.title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', seo.desc);
  }
  let activeTopics = new Set();
  let activeCat = '__all';   // ESI subject filter (legacy name)
  let activeCasMajor = '__all'; // CAS 大类 filter
  /* column header checkbox groups replaced the old single-value filters */
  let activeIndices = new Set(); // 默认全不勾选
  let activeZones = new Set();
  let activeJcr = new Set();
  let activeXr = new Set();
  let activeAbdc = new Set();
  let activeAbs = new Set();
  let activeFeats = new Set();
  let topicList = []; // [{name,count}] sorted A-Z, merged WoS + OA
  let activeQuery = '';
  let activeUpdateQuery = '';
  let activeWarnList = false; // 预警名单：合并 中科院/中信所预警 + 新锐 under review / WoS on hold
  let activeIfMin = 0; // 影响因子滑块：只看 IF ≥ 此值
  let activeDom = 'cnki_major';   // 中文期刊目录
  let activeIndiaSubject = '__all';
  let activeMalaysiaSource = 'mycite_2025';
  let activeKoreaSubject = '__all';
  let activeKoreaStatus = '__all';
  let activeDomBadges = new Set(); // 默认不勾选 = 显示全部；勾选 = 只看有该徽章的
  let activeUpdateCategory = 'all';
  const PAGE = 100;
  let shown = PAGE;
  let intIfSort = null; // null | 'desc' | 'asc'
  let favIfSort = null; // null | 'desc' | 'asc'

  // favorites & ratings 数据见下方 "favorites (multi-list + drag sort)" 段
  // unlocked records cache for locked sources: { school_a: [...records], ... }
  const unlockedCache = {};
  try {
    const raw = localStorage.getItem('ailatest.unlocked');
    if (raw) Object.assign(unlockedCache, JSON.parse(raw));
  } catch (_) {}
  // OAuth 跳转必须用 api 域名（第三方回调地址注册在 api.ailatest.org）。
  const AUTH_BASE = (window.AILATEST_API_BASE
    || (location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://api.ailatest.org'));
  // 数据请求优先走同域 /api（Worker 路由 journal.ailatest.org/api/*）：
  // 与加载网页同一链路，免疫代理/DNS 对 api.* 子域的拦截，也无需 CORS 预检。
  const API_BASE = (window.AILATEST_API_BASE
    || (location.hostname === 'localhost' ? 'http://localhost:8787'
      : /(^|\.)ailatest\.org$/.test(location.hostname) ? '/api'
      : 'https://api.ailatest.org'));

  async function readJsonResponse(resp, fallback) {
    let data = null;
    try { data = await resp.json(); } catch (_) {}
    if (!resp.ok) {
      const message = data?.error || `${fallback}${T('（HTTP ',' (HTTP ')}${resp.status}${T('）',')')}`;
      throw new Error(message);
    }
    return data || {};
  }

  function fetchFailureMessage(err, stage) {
    if (err instanceof TypeError && /fetch/i.test(err.message || '')) {
      return `${stage}${T('：网络请求失败，请检查代理/DNS/CORS 后重试',': Network request failed, check proxy/DNS/CORS and retry')}`;
    }
    return err.message || `${stage}${T('失败',' failed')}`;
  }

  function getAnalyticsId(key, storage, timeoutMs) {
    try {
      const canonicalKey = key.includes('visitor') ? 'visitor_id' : (key.includes('session') ? 'session_id' : key);
      let id = storage.getItem(canonicalKey) || storage.getItem(key);
      let ts = 0;
      if (timeoutMs) {
        ts = parseInt(storage.getItem(canonicalKey + '_ts') || storage.getItem(key + '_ts') || '0', 10);
        const now = Date.now();
        if (id && (now - ts) > timeoutMs) {
          id = null;
        }
      }
      if (!id) {
        id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        storage.setItem(canonicalKey, id);
        storage.setItem(key, id);
      }
      if (timeoutMs) {
        storage.setItem(canonicalKey + '_ts', String(Date.now()));
        storage.setItem(key + '_ts', String(Date.now()));
      }
      return id;
    } catch (_) {
      return '';
    }
  }

  let lastTrackedPageview = '';
  let routeAnalyticsTimer = 0;

  function analyticsPath() {
    const trackedUrl = new URL(location.href);
    trackedUrl.searchParams.delete('token');
    trackedUrl.searchParams.delete('state');
    trackedUrl.searchParams.delete('code');
    return `${trackedUrl.pathname}${trackedUrl.search ? trackedUrl.search.slice(0, 180) : ''}${trackedUrl.hash ? trackedUrl.hash.slice(0, 80) : ''}`;
  }

  function trackPageview() {
    try {
      if (new URLSearchParams(location.search).has('noanalytics')) {
        localStorage.setItem('ailatest.analytics.ignore', '1');
      }
      if (localStorage.getItem('ailatest.analytics.ignore') === '1') return;
    } catch (_) {}
    const path = analyticsPath();
    if (path === lastTrackedPageview) return;
    lastTrackedPageview = path;
    const payload = {
      event_id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      event_ts: Math.floor(Date.now() / 1000),
      site: location.hostname,
      path,
      referrer: document.referrer || '',
      visitor_id: getAnalyticsId('ailatest.analytics.visitor', localStorage),
      session_id: getAnalyticsId('ailatest.analytics.session', sessionStorage, 30 * 60 * 1000),
      client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      client_language: navigator.language || '',
      user_agent: navigator.userAgent || '',
      is_bot: !navigator.userAgent || !!navigator.userAgent.match(/(Googlebot|Bingbot|Bytespider|GPTBot|ClaudeBot|CCBot|curl|wget|HeadlessChrome|bot|spider|crawler)/i) ? 1 : 0,
      screen_resolution: screen.width + 'x' + screen.height,
    };
    const body = JSON.stringify(payload);
    const url = `${API_BASE}/analytics/pageview`;
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch (_) {}
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function scheduleRoutePageview() {
    clearTimeout(routeAnalyticsTimer);
    routeAnalyticsTimer = setTimeout(trackPageview, 80);
  }

  function trackInteraction(eventType, detail = {}) {
    try {
      if (localStorage.getItem('ailatest.analytics.ignore') === '1') return;
    } catch (_) {}
    const payload = {
      event_id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      event_type: eventType,
      event_ts: Math.floor(Date.now() / 1000),
      site: location.hostname,
      path: analyticsPath(),
      tab: detail.tab || activeTab || '',
      query: detail.query || '',
      result_count: Number.isFinite(Number(detail.result_count)) ? Number(detail.result_count) : null,
      visitor_id: getAnalyticsId('ailatest.analytics.visitor', localStorage),
      session_id: getAnalyticsId('ailatest.analytics.session', sessionStorage, 30 * 60 * 1000),
      client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      client_language: navigator.language || '',
      user_agent: navigator.userAgent || '',
      is_bot: !navigator.userAgent || !!navigator.userAgent.match(/(Googlebot|Bingbot|Bytespider|GPTBot|ClaudeBot|CCBot|curl|wget|HeadlessChrome|bot|spider|crawler)/i) ? 1 : 0,
      metadata: detail.metadata || {},
    };
    const body = JSON.stringify(payload);
    const url = `${API_BASE}/analytics/interaction`;
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch (_) {}
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function installRouteAnalytics() {
    if (window.__ailatestRouteAnalyticsInstalled) return;
    window.__ailatestRouteAnalyticsInstalled = true;
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function(...args) {
        const result = original.apply(this, args);
        scheduleRoutePageview();
        return result;
      };
    }
    window.addEventListener('popstate', scheduleRoutePageview);
    window.addEventListener('hashchange', scheduleRoutePageview);
  }

  function t(k) {
    // 非中文界面：禁止最终回落到中文包（缺 key 时用英文或 key 本身）
    const pack = I18N[lang];
    if (pack && pack[k] != null && pack[k] !== '') return pack[k];
    if (lang === 'zh-CN' || lang === 'zh-TW') {
      return (I18N['zh-CN'] && I18N['zh-CN'][k]) ?? (I18N.zh && I18N.zh[k]) ?? k;
    }
    if (I18N.en && I18N.en[k] != null && I18N.en[k] !== '') return I18N.en[k];
    return k;
  }

  function canonicalTitle(s) {
    return String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function decodeRoutePart(s) {
    let out = String(s || '').trim();
    for (let i = 0; i < 2; i++) {
      try {
        const next = decodeURIComponent(out);
        if (next === out) break;
        out = next;
      } catch (_) {
        break;
      }
    }
    return out;
  }

  function normalizeJournalSlug(s, stripAccents = true) {
    let out = decodeRoutePart(s).toLowerCase();
    if (stripAccents) out = out.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    return out
      .replace(/^\/?journal\//, '')
      .replace(/\/+$/, '')
      .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function compactIssnKey(s) {
    const out = String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();
    return out.length >= 7 ? out : '';
  }

  function journalRouteKeyList(value) {
    const raw = decodeRoutePart(value).replace(/^\/?journal\//, '').replace(/\/+$/, '');
    return Array.from(new Set([
      raw,
      raw.toLowerCase(),
      normalizeJournalSlug(raw, false),
      normalizeJournalSlug(raw),
      compactIssnKey(raw),
    ].filter(Boolean)));
  }

  function journalRouteKeys(value) {
    return new Set(journalRouteKeyList(value));
  }

  function recordRouteKeys(r) {
    const keys = new Set();
    [r?.slug, favId(r), r?.issn, r?.eissn, r?.cn_code].filter(Boolean).forEach(v => {
      journalRouteKeys(v).forEach(k => keys.add(k));
      const compact = compactIssnKey(v);
      if (compact) keys.add(compact);
    });
    // 记录可声明额外路由别名（如短刊名），供深链 /journal/<slug>/ 匹配
    (Array.isArray(r?.routeAliases) ? r.routeAliases : []).forEach(a => {
      journalRouteKeys(a).forEach(k => keys.add(k));
    });
    return keys;
  }

  function normalizeAliasKey(s) {
    return String(s || '').trim().toUpperCase().replace(/＆/g, '&').replace(/\s+/g, '');
  }

  function normalizeAcronymQuery(s) {
    return normalizeAliasKey(s).replace(/[._-]+/g, '');
  }

  function setJournalAliases(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const merged = { ...DEFAULT_JOURNAL_ALIASES, ...source };
    const byKey = new Map();
    const byTitle = new Map();
    Object.entries(merged).forEach(([alias, title]) => {
      const key = normalizeAliasKey(alias);
      const target = canonicalTitle(title);
      if (!key || !target) return;
      byKey.set(key, target);
      if (!byTitle.has(target)) byTitle.set(target, []);
      const display = key;
      if (!byTitle.get(target).includes(display)) byTitle.get(target).push(display);
    });
    aliasTargetsByKey = byKey;
    aliasDisplayByTitle = byTitle;
    searchMetaCache = new WeakMap();
  }

  function makeJournalAcronym(r) {
    const source = r?.name || r?.en_name || '';
    const words = String(source)
      .normalize('NFKD')
      .replace(/&/g, ' and ')
      .replace(/[’']/g, '')
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w && !ACRONYM_STOP_WORDS.has(w.toLowerCase()));
    const acronym = words.map(w => w[0]).join('').toUpperCase();
    return acronym.length >= 2 ? acronym : '';
  }

  function journalSearchMeta(r) {
    if (!r || typeof r !== 'object') return { acronym: '', aliases: [], aliasKeys: new Set() };
    const cached = searchMetaCache.get(r);
    if (cached) return cached;
    const title = canonicalTitle(r.name || r.en_name || r.cn_name || '');
    const acronym = makeJournalAcronym(r);
    const aliases = [];
    if (acronym && acronym.length <= 6) aliases.push(acronym);
    (aliasDisplayByTitle.get(title) || []).forEach(a => {
      if (!aliases.includes(a)) aliases.push(a);
    });
    const aliasKeys = new Set(aliases.map(normalizeAliasKey));
    const meta = { acronym, aliases, aliasKeys };
    searchMetaCache.set(r, meta);
    return meta;
  }

  function aliasHintHtml(r) {
    if (!activeQuery) return '';
    const aliases = journalSearchMeta(r).aliases.slice(0, 5);
    if (!aliases.length) return '';
    const title = (lang === 'zh-CN' || lang === 'zh-TW') ? '可直接搜索这些缩写' : 'Searchable aliases';
    return `<span class="jname-aka" title="${title}">aka: ${aliases.map(escape).join(' / ')}</span>`;
  }

  function aliasTargetForQuery(query) {
    return aliasTargetsByKey.get(normalizeAliasKey(query));
  }

  function escapeRegExp(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  setJournalAliases(DEFAULT_JOURNAL_ALIASES);

  function isPickSearchContext() {
    return activeTab === 'pick' || (activeTab === 'home' && homeMode === 'pick');
  }

  function currentSearchPlaceholderKey() {
    if (isPickSearchContext()) return 'pick_placeholder';
    if (activeTab === 'home') return 'search_home_ph';
    if (activeTab === 'int') return 'search_int';
    if (activeTab === 'fav') return 'search_fav';
    if (activeTab === 'updates') return 'search_updates_ph';
    return 'search_dom';
  }

  function applyI18n() {
    $$('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      const v = t(k); if (v) el.innerHTML = v;
    });
    $$('[data-i18n-placeholder]').forEach(el => {
      const k = el.dataset.i18nPlaceholder;
      const v = t(k); if (v) el.placeholder = v;
    });
    $$('[data-i18n-title]').forEach(el => {
      const k = el.dataset.i18nTitle;
      const v = t(k); if (v) el.title = v;
    });
    $$('[data-i18n-aria]').forEach(el => {
      const k = el.dataset.i18nAria;
      const v = t(k); if (v) el.setAttribute('aria-label', v);
    });
    const qEl = $('#q');
    if (qEl) {
      if (activeTab === 'kr') qEl.placeholder = T('搜索：韩国期刊名 / 韩文刊名 / 出版社 / ISSN', 'Search: Korea journal / Korean title / publisher / ISSN');
      else if (activeTab === 'in') qEl.placeholder = T('搜索：印度期刊名 / 出版社 / ISSN / 学科', 'Search: India journal / publisher / ISSN / subject');
      else if (activeTab === 'my') qEl.placeholder = T('搜索：马来西亚期刊名 / 出版社 / ISSN', 'Search: Malaysia journal / publisher / ISSN');
      else if (REGIONAL_DIRECTORY_CONFIG[activeTab]) qEl.placeholder = T('搜索：期刊名 / ISSN / 目录指标', 'Search: journal title / ISSN / directory metric');
      else qEl.placeholder = t(currentSearchPlaceholderKey());
    }
    updateSearchSubmitLabel();
    const langToggle = $('#lang-toggle');
    const nextLangLabel = lang === 'zh-CN' ? 'English' : '中文';
    if (langToggle) {
      langToggle.textContent = nextLangLabel;
      langToggle.setAttribute('aria-label', lang === 'zh-CN' ? 'Switch to English' : '切换到中文');
    }
    const topbarLang = $('#topbar-lang-proxy');
    if (topbarLang) {
      topbarLang.textContent = nextLangLabel;
      topbarLang.setAttribute('aria-label', lang === 'zh-CN' ? 'Switch to English' : '切换到中文');
    }
    $$('[data-lang-choice]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.langChoice === lang);
    });
    const authBtn = $('#auth-btn');
    if (authBtn) authBtn.textContent = user ? (user.name || user.login || t('logout')) : t('login');
    updateAccountCreditBadge();
    document.documentElement.lang = LANG_META[lang]?.html || 'zh-CN';
    document.documentElement.setAttribute('data-ui-lang', lang);
    window.__journalUiLang = lang;
    // 首页定价与教育价提示 / 按钮：必须跟当前 lang，不能用过期 localStorage 判断
    try {
      if (typeof window.__syncPricingUi === 'function') window.__syncPricingUi();
      else if (typeof window.__syncEduCheckoutUi === 'function') window.__syncEduCheckoutUi();
    } catch (_) {}
  }

  function updateSearchSubmitLabel() {
    const btn = $('#search-submit');
    const label = $('#search-submit [data-i18n]');
    if (label) {
      const key = isPickSearchContext() ? 'pick_search_btn' : 'search_button';
      label.dataset.i18n = key;
      label.textContent = t(key);
      btn?.setAttribute('aria-label', t(key));
    }
    // 首页切换钮文案随语言刷新（查刊 / 推荐期刊）
    document.querySelectorAll('.search-mode-btn [data-i18n]').forEach((el) => {
      const k = el.dataset.i18n;
      const v = t(k);
      if (v) el.textContent = v;
    });
  }

  function syncHomeModeTabs() {
    document.querySelectorAll('[data-home-mode]').forEach(btn => {
      const mode = btn.dataset.homeMode;
      const active = mode === homeMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.body.classList.toggle('home-mode-pick', homeMode === 'pick');
    document.body.classList.toggle('home-mode-search', homeMode !== 'pick');
  }

  function setHomeMode(mode, { fromClick = false } = {}) {
    const next = mode === 'pick' ? 'pick' : 'search';
    const same = homeMode === next;
    homeMode = next;
    syncHomeModeTabs();
    const qEl = $('#q');
    if (qEl) qEl.placeholder = t(currentSearchPlaceholderKey());
    updateSearchSubmitLabel();
    if (!fromClick) return;
    const q = String(qEl?.value || '').trim();
    // 再点当前模式 → 提交；切换模式且已有内容 → 直接按新模式提交
    if (same || q) $('#search-submit')?.click();
  }

  // ───────── favorites (multi-list + drag sort) ─────────
  function favId(r) {
    const issn = r.issn && String(r.issn).toUpperCase() !== 'NA' ? r.issn : '';
    const eissn = r.eissn && String(r.eissn).toUpperCase() !== 'NA' ? r.eissn : '';
    return issn || eissn || r.cn_code || ('t:' + normTitle(r.name || r.cn_name || r.journal_title || ''));
  }
  function normTitle(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
  }

  // favLists: [{id, name, ids:[...ordered ids...]}]
  let favLists = [];
  let activeListId = null;
  const DEFAULT_FAV_LIST_NAMES = ['默认收藏', 'My Favorites'];
  function defaultFavListName() { return T('默认收藏', 'My Favorites'); }
  /** 收集所有语言包中「默认收藏」的翻译，用于识别跨语言残留的默认清单名 */
  function allDefaultFavListNames() {
    const names = new Set(DEFAULT_FAV_LIST_NAMES);
    try {
      for (const pack of Object.values(INLINE_I18N)) {
        const v = pack && pack['默认收藏'];
        if (v) names.add(String(v).trim());
      }
    } catch (_) {}
    return names;
  }
  function isDefaultFavListName(name) {
    return allDefaultFavListNames().has(String(name || '').trim());
  }
  function favListDisplayName(list) {
    if (list && list.id === 'default' && isDefaultFavListName(list.name)) return defaultFavListName();
    return String((list && list.name) || T('未命名','Untitled'));
  }
  function localizeDefaultFavListName() {
    const l = favLists.find(x => x.id === 'default');
    if (l && isDefaultFavListName(l.name)) l.name = defaultFavListName();
  }

  const STORAGE_PREFIX = 'ailatest.';
  function loadFavLists() {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + 'favLists');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          favLists = parsed.map(l => ({
            id: String(l.id),
            name: String(l.name || T('未命名','Untitled')),
            ids: Array.isArray(l.ids) ? l.ids.map(String) : [],
          }));
          activeListId = localStorage.getItem(STORAGE_PREFIX + 'activeListId') || favLists[0].id;
          if (!favLists.find(l => l.id === activeListId)) activeListId = favLists[0].id;
          return;
        }
      }
    } catch (_) {}
    // migrate from old flat favs (ailatest.favs)
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem('ailatest.favs') || '[]'); } catch(_) {}
    favLists = [{ id: 'default', name: defaultFavListName(), ids: [...legacy] }];
    activeListId = 'default';
    persistFavLists(false);
  }

  function persistFavLists(sync = true) {
    localizeDefaultFavListName();
    localStorage.setItem(STORAGE_PREFIX + 'favLists', JSON.stringify(favLists));
    localStorage.setItem(STORAGE_PREFIX + 'activeListId', activeListId);
    // rebuild flat union for legacy path + backend sync
    const union = new Set();
    favLists.forEach(l => l.ids.forEach(id => union.add(id)));
    favs = union;
    localStorage.setItem(STORAGE_PREFIX + 'favs', JSON.stringify([...union]));
    if (sync) syncFavs();
  }

  function getActiveList() {
    if (!favLists.length) return null;
    return favLists.find(l => l.id === activeListId) || favLists[0];
  }
  function allFavIds() {
    const s = new Set();
    favLists.forEach(l => l.ids.forEach(id => s.add(id)));
    return s;
  }

  // favs kept as Set (union) for compatibility with star rendering
  let favs = new Set();
  // favsData: 完整记录池（key = fav id）
  let favsData = {};
  try { favsData = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'favsData') || '{}'); } catch(_){}
  let user = JSON.parse(localStorage.getItem('ailatest.user') || 'null');

  function formatCreditValue(value) {
    if (value === Infinity || value === '∞') return '∞';
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`;
    return String(Math.max(0, Math.floor(n)));
  }

  function accountCreditValue() {
    if (!user) return 0;
    const ents = user.entitlements;
    if (ents && ents.credits) {
      if (ents.credits.unlimited) return Infinity;
      if (ents.credits.total != null && ents.credits.total !== '') return Number(ents.credits.total) || 0;
    }
    const candidates = [
      user.credits,
      user.credit_balance,
      user.creditBalance,
      user.points,
      user.balance,
      user.api_credits,
      user.apiCredits,
      user.quota && user.quota.credits,
      user.quota && user.quota.remaining,
      user.entitlements && user.entitlements.credits && user.entitlements.credits.total,
    ];
    const hit = candidates.find(v => v !== undefined && v !== null && v !== '');
    if (hit === undefined) return 0; // 已登录未下发 credits → 显示 0，不再「待同步」
    return hit;
  }

  function membershipTierLabel() {
    // 展示以服务端 raw tier 为准，避免试用被误标成 Pro
    try {
      if (isOwnerClient()) return { id: 'max', label: 'Max', cls: 'tier-max' };
      const raw = String(user?.entitlements?.tier || user?.tier || '').toLowerCase();
      const product = String(user?.entitlements?.product_tier || '').toLowerCase();
      if (product === 'max' || raw === 'pro' || raw === 'max') {
        return { id: 'max', label: 'Max', cls: 'tier-max' };
      }
      if (product === 'pro' || raw === 'plus') {
        return { id: 'pro', label: 'Pro', cls: 'tier-pro' };
      }
      if (product === 'trial' || raw === 'trial') {
        return { id: 'trial', label: T('试用', 'Trial'), cls: 'tier-trial' };
      }
    } catch (_) {}
    const tier = getProductTier();
    if (tier === 'pro') return { id: 'max', label: 'Max', cls: 'tier-max' };
    if (tier === 'plus') return { id: 'pro', label: 'Pro', cls: 'tier-pro' };
    if (tier === 'trial') return { id: 'trial', label: T('试用', 'Trial'), cls: 'tier-trial' };
    return { id: 'free', label: 'Free', cls: 'tier-free' };
  }

  /** 解析权益到期时间（unix 秒或 ms / ISO）→ Date 或 null */
  function parseEntitlementExpiryTs(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const ms = raw < 1e12 ? raw * 1000 : raw;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      const ms = n < 1e12 ? n * 1000 : n;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatMembershipDate(d) {
    if (!d) return '';
    try {
      return d.toLocaleDateString(uiLocale(), { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (_) {
      return d.toISOString().slice(0, 10);
    }
  }

  /**
   * 会员有效期文案：试用 → trial_expires_at；付费 → paid_until；站长 / 无期限 → 永久
   * @returns {{ short: string, long: string, until: Date|null, kind: string }}
   */
  function membershipExpiryInfo() {
    const empty = { short: '', long: '', until: null, kind: 'none' };
    if (!user) return empty;
    const m = membershipTierLabel();
    const ents = user.entitlements || {};
    if (isOwnerClient() || ents.plan === 'owner' || ents.is_owner) {
      return {
        short: T('永久', 'Lifetime'),
        long: T('站长权益 · 永久有效', 'Owner access · lifetime'),
        until: null,
        kind: 'lifetime',
      };
    }
    if (m.id === 'free') {
      return {
        short: '',
        long: T('Free 基础版 · 无订阅到期日', 'Free plan · no subscription end date'),
        until: null,
        kind: 'free',
      };
    }
    let until = null;
    let kind = 'paid';
    if (m.id === 'trial') {
      until = parseEntitlementExpiryTs(ents.trial_expires_at);
      kind = 'trial';
    } else {
      until = parseEntitlementExpiryTs(ents.paid_until);
      kind = 'paid';
    }
    if (!until) {
      // 付费档但无 paid_until：视为长期有效（手工开通 / 终身）
      if (m.id === 'pro' || m.id === 'max') {
        return {
          short: T('长期有效', 'Long-term'),
          long: T('当前订阅无固定到期日（长期有效）', 'No fixed end date on this subscription'),
          until: null,
          kind: 'open',
        };
      }
      return empty;
    }
    const dateStr = formatMembershipDate(until);
    const now = Date.now();
    const daysLeft = Math.ceil((until.getTime() - now) / 86400000);
    let remain = '';
    if (daysLeft < 0) {
      remain = T('已过期', 'Expired');
    } else if (daysLeft === 0) {
      remain = T('今天到期', 'Ends today');
    } else if (daysLeft <= 30) {
      remain = T(`剩余 ${daysLeft} 天`, `${daysLeft}d left`);
    }
    const short = remain
      ? T(`至 ${dateStr} · ${remain}`, `Until ${dateStr} · ${remain}`)
      : T(`至 ${dateStr}`, `Until ${dateStr}`);
    const long = m.id === 'trial'
      ? T(`试用有效期至 ${dateStr}${remain ? `（${remain}）` : ''}`, `Trial ends ${dateStr}${remain ? ` (${remain})` : ''}`)
      : T(`订阅有效期至 ${dateStr}${remain ? `（${remain}）` : ''}`, `Subscription ends ${dateStr}${remain ? ` (${remain})` : ''}`);
    return { short, long, until, kind };
  }

  function membershipBadgeHtml(opts = {}) {
    if (!user && !opts.force) return '';
    const m = membershipTierLabel();
    const exp = membershipExpiryInfo();
    const baseTitle = opts.title
      || (m.id === 'max' ? T('Max 会员', 'Max plan')
        : m.id === 'pro' ? T('Pro 会员', 'Pro plan')
          : m.id === 'trial' ? T('试用中（非付费 Pro）', 'Trial (not paid Pro)')
            : T('Free 基础版', 'Free plan'));
    const title = exp.long ? `${baseTitle} · ${exp.long}` : baseTitle;
    const expiryHtml = exp.short
      ? `<span class="me-tier-expiry" title="${escape(exp.long || exp.short)}">${escape(exp.short)}</span>`
      : '';
    return `<span class="me-tier-wrap">
      <span class="me-tier-badge ${m.cls}" title="${escape(title)}" aria-label="${escape(title)}">${escape(m.label)}</span>
      ${expiryHtml}
    </span>`;
  }

  async function fetchAndMergeEntitlements() {
    if (!user || !user.token) return null;
    try {
      const r = await fetch(`${API_BASE}/me/entitlements`, {
        headers: { 'Authorization': `Bearer ${user.token}` },
      });
      if (!r.ok) return null;
      const ents = await r.json();
      if (!ents || ents.error) return null;
      user = {
        ...user,
        entitlements: ents,
        tier: ents.tier,
        plan: ents.plan || user.plan,
        is_owner: !!(ents.is_owner || ents.plan === 'owner' || user.is_owner),
        credits: ents.credits?.total ?? user.credits,
      };
      if (ents.credits && ents.credits.unlimited) user.credits = null; // display as ∞
      else if (ents.credits && ents.credits.total != null) user.credits = ents.credits.total;
      localStorage.setItem('ailatest.user', JSON.stringify(user));
      updateAccountCreditBadge();
      return ents;
    } catch (_) {
      return null;
    }
  }

  function updateAccountCreditBadge() {
    const badge = $('#account-credit-badge');
    if (!badge) return;
    badge.hidden = false;
    // 侧栏「我的」下方展示 Free / 试用 / Pro / Max 徽章，不展示 Credits
    const m = membershipTierLabel();
    const exp = membershipExpiryInfo();
    const tierLabel = m.label; // Free | 试用 | Pro | Max
    const planTitle = m.id === 'max' ? T('Max 会员', 'Max plan')
      : m.id === 'pro' ? T('Pro 会员', 'Pro plan')
        : m.id === 'trial' ? T('试用中（非付费 Pro）', 'Trial (not paid Pro)')
          : T('Free 基础版', 'Free plan');
    const fullTitle = exp.long ? `${planTitle} · ${exp.long}` : planTitle;
    badge.innerHTML = `<span class="rail-me-label">${T('设置','Settings')}</span><span class="rail-tier-chip ${m.cls}" aria-hidden="true">${escape(tierLabel)}</span>`;
    badge.title = user
      ? `${T('设置与账号','Settings & account')} · ${fullTitle}`
      : T('登录后查看会员与设置', 'Sign in for membership & settings');
    badge.setAttribute('aria-label', user
      ? `${T('设置','Settings')}，${fullTitle}`
      : T('设置，登录或注册', 'Settings, sign in or sign up'));
  }


  // ── 未登录每日限额（登录后不限制详情查看）──
  /** 未登录每日可打开期刊详情页数（按期刊去重） */
  const DAILY_VIEW_LIMIT = 10;
  const DAILY_SEARCH_LIMIT = 2;
  /** @deprecated 使用 FREE_FAV_LIMIT / favLimitForUser() */
  const LOCAL_FAV_LIMIT = FREE_FAV_LIMIT;
  const USAGE_KEY = 'ailatest.daily_usage';

  function getDailyUsage() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const raw = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
      if (raw.date !== today) return { date: today, views: 0, searches: 0, viewKeys: [] };
      return {
        date: today,
        views: Number(raw.views) || 0,
        searches: Number(raw.searches) || 0,
        viewKeys: Array.isArray(raw.viewKeys) ? raw.viewKeys.map(String) : [],
      };
    } catch (e) { return { date: today, views: 0, searches: 0, viewKeys: [] }; }
  }
  function saveDailyUsage(u) {
    try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch (e) {}
  }
  function isOverLimit(type, limit) {
    if (user) return false;
    return getDailyUsage()[type] >= limit;
  }
  function incrementUsage(type) {
    const usage = getDailyUsage();
    usage[type] = (usage[type] || 0) + 1;
    saveDailyUsage(usage);
  }
  /** 未登录：今日是否还能打开该期刊详情（已看过的不重复计） */
  function canViewJournalDetail(fid) {
    if (user) return true;
    const u = getDailyUsage();
    const key = String(fid || '');
    if (key && u.viewKeys.includes(key)) return true;
    return u.viewKeys.length < DAILY_VIEW_LIMIT;
  }
  /** 记录一次详情查看；超限返回 false */
  function consumeJournalDetailView(fid) {
    if (user) {
      incrementUsage('views');
      return true;
    }
    const u = getDailyUsage();
    const key = String(fid || '');
    if (key && u.viewKeys.includes(key)) return true;
    if (u.viewKeys.length >= DAILY_VIEW_LIMIT) return false;
    if (key) u.viewKeys.push(key);
    u.views = u.viewKeys.length;
    // 控制体积
    if (u.viewKeys.length > 200) u.viewKeys = u.viewKeys.slice(-200);
    saveDailyUsage(u);
    return true;
  }
  function requireLogin(msg) {
    if (user) return true;
    openLoginModal();
    const card = document.querySelector('.login-card');
    if (card) {
      let el = document.getElementById('login-limit-msg');
      if (!el) {
        el = document.createElement('p');
        el.id = 'login-limit-msg';
        el.className = 'login-limit-msg';
        card.prepend(el);
      }
      el.textContent = msg || T('免费次数已用完，请登录后继续使用','Free daily limit reached. Please sign in to continue.');
    }
    return false;
  }



  // isFav = 在当前 active list 中
  function isFav(r) {
    const id = favId(r);
    const list = getActiveList();
    return !!(list && list.ids.includes(id));
  }

  function toggleFav(r, meta = {}) {
    // Free 也可收藏；多清单 / 导出等仍需 Pro
    if (!canUseBasicFavorites()) {
      showRegionPaywallModal('workflow');
      return;
    }
    const id = favId(r);
    const list = getActiveList();
    if (!list) return;
    const idx = list.ids.indexOf(id);
    if (idx >= 0) {
      list.ids.splice(idx, 1);
      // 其他 list 都不含它 → 从 favsData 移除
      if (!favLists.some(l => l.ids.includes(id))) delete favsData[id];
      localStorage.setItem(STORAGE_PREFIX + 'favsData', JSON.stringify(favsData));
      persistFavLists();
      updateFavCount();
      try { showFavToast(T('已取消收藏', 'Removed from favorites')); } catch (_) {}
      return;
    }

    // 新增收藏：检查额度
    const limit = favLimitForUser();
    const total = allFavIds().size;
    if (Number.isFinite(limit) && total >= limit) {
      const isFreeTier = !hasProLevelAccess();
      if (isFreeTier) {
        try {
          showFavToast(T(
            `Free 可收藏 ${FREE_FAV_LIMIT} 本期刊，已达上限。升级 Pro 可收藏更多并管理清单。`,
            `Free plan allows ${FREE_FAV_LIMIT} favorites. Upgrade to Pro for more and lists.`
          ));
        } catch (_) {}
        // 轻提示即可；需要升级时再点收藏页/方案
        showRegionPaywallModal('fav_limit');
      } else {
        try {
          showFavToast(T(`收藏已达上限（${limit} 本）`, `Favorite limit reached (${limit})`));
        } catch (_) {}
      }
      return;
    }

    list.ids.push(id);
    favsData[id] = { ...r, __src: meta.src || 'int', __savedAt: Date.now() };
    localStorage.setItem(STORAGE_PREFIX + 'favsData', JSON.stringify(favsData));
    persistFavLists();
    updateFavCount();
    try {
      const left = Number.isFinite(limit) ? Math.max(0, limit - allFavIds().size) : null;
      showFavToast(
        left != null && !hasProLevelAccess()
          ? T(`已收藏（还可 ${left} 本）`, `Saved (${left} left on Free)`)
          : T('已收藏', 'Saved')
      );
    } catch (_) {}
  }

  function updateFavCount() {
    const total = allFavIds().size;
    const badge = $('#fav-count-badge');
    if (badge) {
      if (total > 0) {
        badge.textContent = total > 99 ? '99+' : String(total);
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  function showFavToast(msg) {
    const old = document.querySelector('.fav-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'fav-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
  }

  // list 管理
  function createList(name) {
    if (!canUseFavoritesWorkflow()) {
      showRegionPaywallModal('workflow');
      return null;
    }
    const id = 'l_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    favLists.push({ id, name: name || T('新清单','New list'), ids: [] });
    activeListId = id;
    persistFavLists();
    return id;
  }
  function renameList(id, newName) {
    const l = favLists.find(x => x.id === id);
    if (l && newName && newName.trim()) { l.name = newName.trim(); persistFavLists(); }
  }
  function deleteList(id) {
    if (favLists.length <= 1) return false; // 不允许删到 0
    const removed = favLists.find(x => x.id === id);
    favLists = favLists.filter(x => x.id !== id);
    if (activeListId === id) activeListId = favLists[0].id;
    // 清理孤儿 favsData
    if (removed) {
      removed.ids.forEach(fid => {
        if (!favLists.some(l => l.ids.includes(fid))) delete favsData[fid];
      });
      localStorage.setItem(STORAGE_PREFIX + 'favsData', JSON.stringify(favsData));
    }
    persistFavLists();
    return true;
  }
  function switchList(id) {
    if (favLists.find(l => l.id === id)) {
      activeListId = id;
      localStorage.setItem('ailatest.activeListId', activeListId);
      // 重绘：主表星号状态依赖 active list
      if (activeTab === 'fav') renderFav();
      else if (activeTab === 'int') renderInt();
      else if (activeTab === 'dom') renderDomestic();
    }
  }
  function reorderActiveList(newOrder) {
    const list = getActiveList();
    if (!list) return;
    // newOrder = array of ids
    const valid = newOrder.filter(id => list.ids.includes(id));
    // append any missing (defensive)
    list.ids.forEach(id => { if (!valid.includes(id)) valid.push(id); });
    list.ids = valid;
    persistFavLists();
  }

  async function syncFavs() {
    if (!user || !user.token) return;
    try {
      // 主同步：整组 lists 上云
      await fetch(`${API_BASE}/lists`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          lists: favLists.map(l => ({ id: l.id, name: l.name, ids: l.ids })),
        }),
      });
      // 兼容旧端点：扁平 union 推一份，老设备/老前端仍能读
      await fetch(`${API_BASE}/favorites`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ favs: [...favs] }),
      }).catch(() => {});
    } catch (e) { console.warn('fav sync failed', e); }
  }

  async function pullFavs() {
    if (!user || !user.token) return;
    try {
      // 优先从 /lists 拉云端清单
      const r = await fetch(`${API_BASE}/lists`, {
        headers: { 'Authorization': `Bearer ${user.token}` },
      });
      if (r.ok) {
        const d = await r.json();
        const cloud = Array.isArray(d.lists) ? d.lists : [];
        if (cloud.length) {
          // 合并：以 list.id 为键。云端有的覆盖本地（云为权威），本地独有的保留追加。
          const cloudMap = new Map(cloud.map(l => [String(l.id), {
            id: String(l.id),
            name: String(l.name || T('未命名','Untitled')),
            ids: Array.isArray(l.ids) ? l.ids.map(String) : [],
          }]));
          const merged = [];
          // 先按云端顺序
          cloud.forEach(c => merged.push(cloudMap.get(String(c.id))));
          // 本地独有的清单追加到末尾
          favLists.forEach(local => {
            if (!cloudMap.has(local.id)) merged.push(local);
          });
          favLists = merged;
          if (!favLists.find(l => l.id === activeListId)) {
            activeListId = favLists[0] ? favLists[0].id : 'default';
          }
          persistFavLists(true); // 把合并结果再推一次，保证云端齐全
          updateFavCount();
          return;
        }
        // 云端为空：把本地推上去
        if (favLists.length && favLists.some(l => l.ids.length)) {
          persistFavLists(true);
        }
        return;
      }
      // 兜底：/lists 不可用时退回老接口
      const r2 = await fetch(`${API_BASE}/favorites`, {
        headers: { 'Authorization': `Bearer ${user.token}` },
      });
      if (!r2.ok) return;
      const d2 = await r2.json();
      if (Array.isArray(d2.favs)) {
        const list = getActiveList();
        if (list) d2.favs.forEach(x => { if (!list.ids.includes(x)) list.ids.push(x); });
        persistFavLists();
        updateFavCount();
      }
    } catch (e) { console.warn('fav pull failed', e); }
  }

  // ───────── ratings ─────────
  async function fetchRating(key) {
    try {
      const headers = {};
      if (user && user.token) headers['Authorization'] = `Bearer ${user.token}`;
      const r = await fetch(`${API_BASE}/ratings?keys=${encodeURIComponent(key)}`, { headers });
      if (!r.ok) return null;
      const d = await r.json();
      return (d.ratings && d.ratings[key]) || null;
    } catch (e) { return null; }
  }
  async function putRating(key, rating) {
    if (!user || !user.token) return null;
    try {
      const r = await fetch(`${API_BASE}/ratings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ journal_key: key, rating }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }
  async function deleteRating(key) {
    if (!user || !user.token) return null;
    try {
      const r = await fetch(`${API_BASE}/ratings`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ journal_key: key }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }
  // half-star renderer: value 0..5 (0.5 step) → ★ ★ ★ ☆ ☆ etc
  // half-star renderer: value 0..5 (0.5 step)
  // 用 SVG 取代 unicode ★，规避不同浏览器把 ★ 渲染成 emoji 字体导致宽度不一致的问题
  function renderStarsStatic(value) {
    const v = Math.max(0, Math.min(5, Number(value) || 0));
    const path = 'M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.6 7.7l5.8-.8L10 1.6z';
    let out = '';
    for (let i = 1; i <= 5; i++) {
      let cls;
      if (v >= i)            cls = 'full';
      else if (v >= i - 0.5) cls = 'half';
      else                   cls = 'empty';
      if (cls === 'half') {
        // 用 linearGradient 的 id 唯一化避免冲突
        const gid = 'half-grad-' + i + '-' + Math.random().toString(36).slice(2, 7);
        out += '<svg class="star ' + cls + '" viewBox="0 0 20 20" aria-hidden="true">'
             + '<defs><linearGradient id="' + gid + '" x1="0" x2="1" y1="0" y2="0">'
             + '<stop offset="50%" class="half-fill"/>'
             + '<stop offset="50%" class="half-empty"/>'
             + '</linearGradient></defs>'
             + '<path d="' + path + '" fill="url(#' + gid + ')"/>'
             + '</svg>';
      } else {
        out += '<svg class="star ' + cls + '" viewBox="0 0 20 20" aria-hidden="true">'
             + '<path d="' + path + '"/>'
             + '</svg>';
      }
    }
    return out;
  }
  function paintRatingDisplay(data) {
    const avgEl   = document.getElementById('rating-avg');
    const starsEl = document.getElementById('rating-avg-stars');
    const cntEl   = document.getElementById('rating-count');
    if (!avgEl) return;
    const avg = (data && data.avg != null) ? data.avg : null;
    const n   = (data && data.n)   ? data.n   : 0;
    if (avg != null) {
      avgEl.textContent = avg.toFixed(1);
      starsEl.innerHTML = renderStarsStatic(avg);
      starsEl.style.display = '';
      cntEl.textContent = `${n} ${T('人','reviews')}`;
    } else {
      avgEl.textContent = '—';
      starsEl.innerHTML = '';
      starsEl.style.display = 'none';
      cntEl.textContent = T('暂无评分','No ratings yet');
    }
  }
  function paintRatingInput(key, mine) {
    const wrap = document.getElementById('rating-input');
    const hint = document.getElementById('rating-hint');
    if (!wrap) return;
    const loggedIn = !!(user && user.token);
    wrap.classList.toggle('disabled', !loggedIn);
    wrap.innerHTML = '';
    // Build 5 star blocks; each has two halves (left=N-0.5, right=N)
    for (let i = 1; i <= 5; i++) {
      const block = document.createElement('span');
      block.className = 'star-input';
      const left  = document.createElement('span');
      left.className = 'half-hit left';
      left.dataset.value = String(i - 0.5);
      const right = document.createElement('span');
      right.className = 'half-hit right';
      right.dataset.value = String(i);
      const visual = document.createElement('span');
      visual.className = 'star-visual';
      visual.textContent = '★';
      block.appendChild(visual);
      block.appendChild(left);
      block.appendChild(right);
      wrap.appendChild(block);
    }
    const apply = (v) => {
      [...wrap.querySelectorAll('.star-input')].forEach((b, idx) => {
        const i = idx + 1;
        b.classList.remove('full', 'half');
        if (v >= i)            b.classList.add('full');
        else if (v >= i - 0.5) b.classList.add('half');
      });
    };
    apply(mine || 0);
    if (loggedIn) {
      hint.textContent = mine
        ? `${T('已评','Rated')} ${mine.toFixed(1)}${T(' 星 · 再次点击修改 · 长按清除',' stars · click again to change · long-press to clear')}`
        : T('半星可评 · 点击星左半为 0.5，右半为 1 星','Half-stars supported · left half = 0.5, right half = 1 star');
      // hover preview
      wrap.querySelectorAll('.half-hit').forEach(hit => {
        hit.addEventListener('mouseenter', () => apply(Number(hit.dataset.value)));
        hit.addEventListener('click', async (e) => {
          e.stopPropagation();
          const v = Number(hit.dataset.value);
          apply(v);
          hint.textContent = T('提交中…','Submitting…');
          const res = await putRating(key, v);
          if (res) {
            paintRatingDisplay({ avg: res.avg, n: res.n });
            hint.textContent = `${T('已评','Rated')} ${v.toFixed(1)}${T(' 星 · 再次点击修改 · 长按清除',' stars · click again to change · long-press to clear')}`;
          } else {
            hint.textContent = T('提交失败，请稍后再试','Submission failed, please retry');
          }
        });
      });
      // long-press to clear
      let pressT = null;
      wrap.addEventListener('mousedown', () => {
        pressT = setTimeout(async () => {
          pressT = null;
          hint.textContent = T('清除中…','Clearing…');
          const res = await deleteRating(key);
          if (res) {
            apply(0);
            paintRatingDisplay({ avg: res.avg, n: res.n });
            hint.textContent = T('已清除评分 · 可重新打分','Rating cleared · you can rate again');
          } else {
            hint.textContent = T('清除失败','Clear failed');
          }
        }, 700);
      });
      const cancelPress = () => { if (pressT) { clearTimeout(pressT); pressT = null; } };
      wrap.addEventListener('mouseup', cancelPress);
      wrap.addEventListener('mouseleave', () => { cancelPress(); apply(mine || 0); });
    } else {
      hint.innerHTML = T('<a href="#" id="rating-login-link">登录</a>后可打分（邮箱验证码 / GitHub / Google）','<a href="#" id="rating-login-link">Sign in</a> to rate (email code / GitHub / Google)');
      const a = document.getElementById('rating-login-link');
      if (a) a.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('login-btn')?.click(); });
    }
  }
  async function initRatingWidget(key) {
    paintRatingDisplay(null);
    paintRatingInput(key, 0);
    const data = await fetchRating(key);
    if (!data) return;
    paintRatingDisplay({ avg: data.avg, n: data.n });
    paintRatingInput(key, data.mine || 0);
  }
  // expose for renderJournal
  window.__initRatingWidget = initRatingWidget;

  // ───────── locked sources (paid unlock) ─────────
  // 分片加密的学校自编目录 → 用户输码 → Web Crypto 解密 → 记状态免复输
  const LOCK_CONFIG = {
    pbkdf2Iterations: 100000,
    saltBytes: 16,
    ivBytes: 12,
  };

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKey(code, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(code), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: LOCK_CONFIG.pbkdf2Iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  async function attemptDecrypt(sourceKey, code) {
    const res = await fetch(`data/locked/${sourceKey}.enc.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error('blob not found');
    const blob = await res.json();
    const salt = b64ToBytes(blob.salt);
    const iv = b64ToBytes(blob.iv);
    const ct = b64ToBytes(blob.ciphertext);
    const key = await deriveKey(code, salt);
    let plaintext;
    try {
      plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    } catch (e) {
      throw new Error('wrong_code');
    }
    const text = new TextDecoder().decode(plaintext);
    return JSON.parse(text);
  }

  function persistUnlocked(sourceKey, records) {
    unlockedCache[sourceKey] = records;
    try {
      localStorage.setItem('ailatest.unlocked', JSON.stringify(unlockedCache));
    } catch (e) { /* quota */ }
  }

  function isUnlocked(sourceKey) {
    return Array.isArray(unlockedCache[sourceKey]) && unlockedCache[sourceKey].length > 0;
  }

  function forgetUnlock(sourceKey) {
    delete unlockedCache[sourceKey];
    try {
      localStorage.setItem('ailatest.unlocked', JSON.stringify(unlockedCache));
    } catch (e) {}
  }

  function lockedPrompt(sourceKey, sourceLabel, recordCount) {
    return `
      <div class="section-block locked-block">
        <h1 class="section-title">${escape(sourceLabel)} <span class="lock-pill">🔒 ${T('付费解锁','Paid unlock')}</span></h3>
        <div class="section-subtitle">${T('此学校自编目录为付费内容，共','This in-house directory is paid content,')} ${recordCount} ${T('条记录。输入解锁码后自动保存在本机浏览器，下次免输。','records. Enter your unlock code; it will be saved on this device for next time.')}</div>
        <form class="unlock-form" data-src="${escape(sourceKey)}">
          <input class="unlock-input" type="text" autocomplete="off" spellcheck="false" placeholder="${T('解锁码（如 school-a-xxxxxxxx）','Unlock code (e.g. school-a-xxxxxxxx)')}" />
          <button type="submit" class="unlock-btn">${T('解锁','Unlock')}</button>
          <div class="unlock-msg" role="status"></div>
        </form>
        <div class="unlock-help">
          <p>${T('未购买？','Don’t have a code yet?')}<a href="mailto:support@ailatest.org?subject=Unlock code request (${escape(sourceKey)})">${T('联系获取解锁码','Contact us to get a code')}</a></p>
        </div>
      </div>
    `;
  }


  // ───────── auth (email code + GitHub / Google OAuth via Worker) ─────────
  function startLogin() {
    openLoginModal();
  }

  function openLoginModal() {
    let modal = $('#login-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'login-modal';
      modal.className = 'login-modal';
      modal.innerHTML = `
        <div class="login-card" role="dialog" aria-labelledby="login-title">
          <button class="login-close" aria-label="${T('关闭','Close')}">×</button>
          <h3 id="login-title">${T('登录 / 注册','Sign in / Sign up')}</h3>
          <p class="login-sub">${T('跨设备同步收藏、投稿经验、打分记录','Sync favorites, submission notes and ratings across devices')}</p>

          <form class="login-email" autocomplete="off">
            <label>${T('邮箱','Email')}</label>
            <input type="email" name="email" placeholder="you@example.com" required />
            <div class="login-code-row" hidden>
              <label>${T('6 位验证码','6-digit code')}</label>
              <input type="text" name="code" inputmode="numeric" pattern="\\d{6}" maxlength="6" placeholder="123456" />
            </div>
            <button type="submit" class="login-btn-primary" data-step="request">${T('发送验证码','Send code')}</button>
            <div class="login-msg" role="status"></div>
          </form>

          <div class="login-divider"><span>${T('或使用第三方登录','Or sign in with')}</span></div>

          <div class="login-oauth">
            <button class="login-btn-oauth gh" data-provider="github">
              <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              GitHub
            </button>
            <button class="login-btn-oauth gg" data-provider="google">
              <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 010-24c3 0 5.8 1.1 7.9 3L37.6 9.3A20 20 0 004 24a20 20 0 0040 0c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.1l6.6 4.8A12 12 0 0124 16c3 0 5.8 1.1 7.9 3L37.6 9.3A20 20 0 006.3 14.1z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0124 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5A20 20 0 0024 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.6-.4-3.9z"/></svg>
              Google
            </button>
          </div>

          <p class="login-tos">${T('登录即同意','By signing in you agree to the')} <a href="/terms.html">${T('服务条款','Terms')}</a> ${T('与','and')} <a href="/privacy.html">${T('隐私政策','Privacy Policy')}</a></p>
        </div>
      `;
      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLoginModal();
      });
      $('.login-close', modal).addEventListener('click', closeLoginModal);

      // email code flow
      const form = $('.login-email', modal);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('.login-btn-primary', form);
        const msg = $('.login-msg', form);
        const emailEl = form.email;
        const codeEl  = form.code;
        const step = btn.dataset.step;
        msg.textContent = '';
        btn.disabled = true;
        try {
          if (step === 'request') {
            const requestedEmail = emailEl.value.trim().toLowerCase();
            const r = await fetch(`${API_BASE}/auth/email/request`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: requestedEmail }),
            });
            await readJsonResponse(r, T('发送验证码失败','Send code failed'));
            form.dataset.email = requestedEmail;
            emailEl.value = requestedEmail;
            emailEl.readOnly = true;
            $('.login-code-row', form).hidden = false;
            codeEl.required = true;
            codeEl.focus();
            btn.dataset.step = 'verify';
            btn.textContent = T('登录','Sign in');
            msg.textContent = T('验证码已发送，10 分钟内有效','Code sent · valid for 10 minutes');
            msg.className = 'login-msg ok';
          } else {
            const requestedEmail = form.dataset.email || emailEl.value.trim().toLowerCase();
            const r = await fetch(`${API_BASE}/auth/email/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: requestedEmail,
                code:  codeEl.value.trim(),
              }),
            });
            const d = await readJsonResponse(r, T('验证码验证失败','Code verification failed'));
            if (!d.token) throw new Error(T('验证码验证失败：未收到登录凭证','Code verification failed: no token returned'));
            await finishLogin(d.token, d.user);
            closeLoginModal();
          }
        } catch (err) {
          const stage = step === 'request' ? T('发送验证码','Send code') : T('验证码登录','Code sign-in');
          msg.textContent = fetchFailureMessage(err, stage);
          msg.className = 'login-msg err';
          if (step === 'verify' && /请先请求验证码|验证码已过期/.test(err.message || '')) {
            btn.dataset.step = 'request';
            btn.textContent = T('发送验证码','Send code');
            codeEl.required = false;
            codeEl.value = '';
            $('.login-code-row', form).hidden = true;
            emailEl.readOnly = false;
            delete form.dataset.email;
          }
        } finally {
          btn.disabled = false;
        }
      });

      // oauth buttons
      $$('.login-btn-oauth', modal).forEach(btn => {
        btn.addEventListener('click', () => {
          const p = btn.dataset.provider;
          const state = Math.random().toString(36).slice(2);
          sessionStorage.setItem('ailatest.oauth_state', state);
          const redirect = encodeURIComponent(location.origin + location.pathname);
          location.href = `${AUTH_BASE}/auth/${p}?state=${state}&redirect=${redirect}`;
        });
      });
    }
    // 勿隐藏 .topbar：搜索框在 topbar 内，隐藏后关闭弹窗常不恢复 → 首页搜索消失
    modal.classList.add('open');
    setTimeout(() => $('.login-email input[name=email]', modal)?.focus(), 50);
  }

  function closeLoginModal() {
    $('#login-modal')?.classList.remove('open');
    restoreTopbarSearch();
  }

  /** 恢复被历史逻辑误藏的搜索顶栏（登录/分享弹窗曾用 style.display=none） */
  function restoreTopbarSearch() {
    $$('.topbar').forEach((el) => {
      if (el.style.display === 'none') el.style.display = '';
    });
  }

  async function finishLogin(token, profile = null) {
    restoreTopbarSearch();
    let me = profile;
    if (!me) {
      const r = await fetch(`${API_BASE}/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      me = await readJsonResponse(r, T('用户信息获取失败','Failed to fetch user info'));
    }
    user = { ...me, token };
    localStorage.setItem('ailatest.user', JSON.stringify(user));
    await fetchAndMergeEntitlements();
    await pullFavs();
    applyI18n();
    updateAccountCreditBadge();
    try {
      if (typeof window.__syncEduCheckoutUi === 'function') window.__syncEduCheckoutUi();
    } catch (_) {}
  }

  async function refreshCurrentUserProfile() {
    if (!user || !user.token) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const r = await fetch(`${API_BASE}/me`, {
        headers: { 'Authorization': `Bearer ${user.token}` },
        signal: controller.signal,
      });
      const me = await readJsonResponse(r, T('用户信息获取失败','Failed to fetch user info'));
      user = { ...user, ...me, token: user.token };
      localStorage.setItem('ailatest.user', JSON.stringify(user));
      await fetchAndMergeEntitlements();
      updateAccountCreditBadge();
      if (activeTab === 'me') renderMe();
    } catch (_) {
    } finally {
      clearTimeout(timer);
    }
  }

  function doLogout() {
    user = null;
    localStorage.removeItem('ailatest.user');
    applyI18n();
    updateAccountCreditBadge();
    try {
      if (typeof window.__syncEduCheckoutUi === 'function') window.__syncEduCheckoutUi();
    } catch (_) {}
  }

  async function handleAuthCallback() {
    const q = new URLSearchParams(location.search);
    const token = q.get('token');
    if (!token) return;
    try {
      await finishLogin(token);
    } catch (e) { console.warn('auth callback failed', e); }
    const u = new URL(location.href);
    u.searchParams.delete('token');
    u.searchParams.delete('state');
    history.replaceState({}, '', u.toString());
  }

  // ───────── render helpers ─────────
  function badgeIndex(idx) {
    return `<span class="badge b-${idx.toLowerCase()}">${idx}</span>`;
  }
  function badgeScopus(sc) {
    if (!sc || sc.active === false) return '';
    return `<span class="badge b-scopus" title="${T('Scopus 收录 (Source List Mar.2026)','Indexed by Scopus (Source List Mar.2026)')}">Scopus</span>`;
  }
  function badgeInspec(inspec) {
    if (!inspec) return '';
    return `<span class="badge b-inspec" title="${T('Inspec 收录（IET 官方 Active Source List · 2026-04）','Indexed by Inspec (official IET Active Source List · Apr 2026)')}">Inspec</span>`;
  }
  function badgeFSTAFullText(value) {
    if (!value) return '';
    return `<span class="badge b-fsta" title="${T('EBSCO FSTA with Full Text 收录；公开清单是 FSTA 全库的全文子集','Indexed by EBSCO FSTA with Full Text; the public list is the full-text subset of FSTA')}">FSTA</span>`;
  }
  function badgeCABI(value) {
    if (!value) return '';
    return `<span class="badge b-cabi" style="background:#446b53" title="${T('CAB Abstracts 收录（CABI Serial Cited Report · 2013-09）','Indexed by CAB Abstracts (CABI Serial Cited Report · Sep 2013)')}">CABI</span>`;
  }
  function badgeOAJ(oaj) {
    if (!oaj) return '';
    const tip = oaj.partition ? `OAJ ${oaj.partition}` : 'OAJ 收录';
    return `<span class="badge b-oaj" title="${T('OAJ 全球开放获取期刊索引','Open Access Journal Index')}${oaj.partition ? ' · ' + oaj.partition : ''}${oaj.position ? ' · ' + escape(oaj.position) : ''}">OAJ</span>`;
  }
  function badgeDOAJ(doaj) {
    if (!doaj) return '';
    const license = doaj.lic || doaj.license || '';
    return `<span class="badge b-doaj" title="${T('DOAJ 开放获取期刊目录','Directory of Open Access Journals')}${license ? ' · ' + escape(license) : ''}">DOAJ</span>`;
  }
  function badgeNatureIndex() {
    return `<span class="badge b-nature-index" title="${T('Nature Index 追踪出版物','Tracked by Nature Index')}">Nature Index</span>`;
  }
  function badgeCSCD(cscd) {
    if (!cscd) return '';
    const code = String(cscd.database || '').toUpperCase();
    const label = code === 'C' ? 'CSCD-C' : (code === 'E' ? 'CSCD-E' : 'CSCD');
    const tip = code === 'C' ? T('CSCD 核心库','CSCD Core') : (code === 'E' ? T('CSCD 扩展库','CSCD Extended') : 'CSCD');
    return `<span class="badge b-cscd" title="${escape(tip)}">${label}</span>`;
  }
  function badgeCSTPCD(cstpcd) {
    if (!cstpcd) return '';
    const isPopular = cstpcd.kind === 'popular_science';
    const label = isPopular ? T('中国科技核心·科普','CSTPCD Popular') : T('中国科技核心','CSTPCD');
    const tip = isPopular ? T('中国科技核心期刊目录（科普卷）','Chinese Science and Technology Core Journals (Popular Science)') : T('中国科技核心期刊目录','Chinese Science and Technology Core Journals');
    return `<span class="badge b-cstpcd" title="${escape(tip)}">${label}</span>`;
  }
  function badgeSCD(scd) {
    if (!scd) return '';
    const year = scd.year || 2026;
    const cat = scd.category ? ` · ${escape(scd.category)}` : '';
    const added = scd.newly_added ? ` · ${T('新入选','newly added')}` : '';
    return `<span class="badge b-scd" title="SCD ${year}${cat}${added}">SCD</span>`;
  }
  function badgeAMI(ami) {
    if (!ami) return '';
    const tier = ami.tier || '';
    const disc = ami.discipline ? ` · ${escape(ami.discipline)}` : '';
    return `<span class="zone ami-tier" title="${T('AMI 综合评价','AMI Journal Evaluation')} ${ami.year || 2022}${disc}">AMI${tier ? ' ' + escape(tier) : ''}</span>`;
  }
  function badgeFMS(fms) {
    if (!fms || !fms.tier) return '';
    const type = fms.type === 'chinese' ? T('中文','Chinese') : T('国际','International');
    return `<span class="zone fms-tier" title="${T('FMS 管理科学高质量期刊','FMS High-quality Management Journals')} ${fms.year || 2025} · ${type}">FMS ${escape(fms.tier)}</span>`;
  }
  function bestVhbRating(vhb) {
    const arr = Array.isArray(vhb) ? vhb : [];
    const order = {'A+': 5, A: 4, B: 3, C: 2, D: 1};
    return arr.reduce((best, x) => (!best || (order[x.rating] || 0) > (order[best.rating] || 0)) ? x : best, null);
  }
  function badgeVHB(vhb) {
    const best = bestVhbRating(vhb);
    if (!best) return '';
    const rows = Array.isArray(vhb) ? vhb.filter(Boolean) : [best];
    const count = rows.length;
    const area = best.area_code || best.area || '';
    const title = `${T('VHB Rating 2024，按领域评级','VHB Rating 2024, area rating')}${area ? ' · ' + escape(area) : ''}${count > 1 ? ` · ${count}${T(' 个领域',' areas')}` : ''}`;
    const label = `VHB ${escape(best.rating)}${count > 1 ? ` x${count}` : ''}`;
    if (count <= 1) {
      return `<span class="zone vhb-tier" title="${title}">${label}</span>`;
    }
    const detailRows = rows.map(x => {
      const areaText = [x.area_code, x.area].filter(Boolean).join(' · ') || 'Unspecified area';
      const vote = x.votes_ge_rating_percent != null && x.votes_ge_rating_percent !== ''
        ? `<span class="vhb-detail-vote">Votes &gt;= rating: ${escape(x.votes_ge_rating_percent)}%</span>`
        : '';
      return `<div class="vhb-detail-row">
        <span class="vhb-detail-area">${escape(areaText)}</span>
        <span class="vhb-detail-rating">${escape(x.rating || '')}</span>
        ${vote}
      </div>`;
    }).join('');
    return `<details class="vhb-details">
      <summary class="zone vhb-tier" title="${title}">${label}</summary>
      <div class="vhb-detail-popover" role="list">
        <div class="vhb-detail-title">VHB Publication Media Rating ${escape(best.year || 2024)}</div>
        ${detailRows}
      </div>
    </details>`;
  }
  function badgeCNRS(cnrs) {
    const arr = Array.isArray(cnrs) ? cnrs : [];
    const first = arr[0];
    if (!first) return '';
    return `<span class="zone cnrs-tier" title="${T('CNRS Section 37 2020 历史参考','CNRS Section 37 2020 historical reference')}${first.domain ? ' · ' + escape(first.domain) : ''}">CNRS ${escape(first.category || '')}</span>`;
  }
  function badgeRetraction(ret) {
    if (!ret || !ret.retractions_total) return '';
    const rate = ret.rate_per_1000_10y != null ? `${ret.rate_per_1000_10y}/1000` : '';
    return `<span class="warn-pill retraction-pill" title="${T('Retraction Watch 撤稿记录；用于风险提示，不作排名','Retraction Watch records; caution metric, not ranking')}${rate ? ' · 10y ' + rate : ''}">RW ${escape(ret.retractions_total)}</span>`;
  }
  function badgePubMed(pubmed) {
    return pubmed ? `<span class="badge b-pubmed" title="${T('PubMed 可检索','Searchable in PubMed')}">PubMed</span>` : '';
  }
  function badgePMC(pmc) {
    return pmc ? `<span class="badge b-pmc" title="${T('PubMed Central 全文档案','Full text archived in PubMed Central')}">PMC</span>` : '';
  }
  function badgeMEDLINE(m) {
    if (!m) return '';
    return `<span class="badge b-medline" title="${T('MEDLINE 数据库收录（NLM 精选索引）','Indexed in MEDLINE (NLM curated)')}">MEDLINE</span>`;
  }
  function badgeFree(f) {
    if (!f || !canSeePublishFeeInfo()) return '';
    return `<span class="badge b-free" title="${T('作者可选择免费发表路径（Diamond / Hybrid / 订阅制等）','Author-free publishing path available (Diamond / Hybrid / subscription, etc.)')}">${T('免费发表','FREE TO PUBLISH')}</span>`;
  }
  // 期刊浏览量缓存（journal_key → count）
  const viewsCache = {};
  function badgeView(key) {
    const n = viewsCache[key] || 0;
    const display = n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
    return `<span class="badge b-view" title="${T('累计浏览次数','Total views')}">👁 ${display}</span>`;
  }
  function journalOpenSource(opts = {}) {
    if (opts.source) return opts.source;
    if (opts.fromPath || opts.fromHash) return 'direct_link';
    if (activeTab === 'pick') return 'recommendation';
    if (activeTab === 'fav') return activeQuery ? 'favorites_search_results' : 'favorites';
    if (activeQuery) return 'search_results';
    if (activeTab === 'home') return 'home';
    if (activeTab === 'dom') return 'domestic_list';
    if (activeTab === 'in') return 'india_list';
    return 'default_list';
  }

  async function reportJournalView(recOrKey, opts = {}) {
    const key = typeof recOrKey === 'string' ? recOrKey : favId(recOrKey);
    if (!key) return;
    const detailPath = typeof recOrKey === 'string' ? analyticsPath() : journalPublicPath(recOrKey);
    const source = journalOpenSource(opts);
    try {
      const r = await fetch(`${API_BASE}/journal-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user && user.token ? { 'Authorization': `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify({
          event_id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          event_time: Math.floor(Date.now() / 1000),
          journal_key: key,
          journal_name: typeof recOrKey === 'string' ? '' : (recOrKey.name || recOrKey.cn_name || recOrKey.title || ''),
          view_source: source,
          tab: activeTab || '',
          query: activeQuery || '',
          visitor_id: getAnalyticsId('ailatest.analytics.visitor', localStorage),
          session_id: getAnalyticsId('ailatest.analytics.session', sessionStorage, 30 * 60 * 1000),
          path: detailPath,
          referrer: document.referrer || '',
          user_agent: navigator.userAgent || '',
          device: /iPad|iPhone|Android/.test(navigator.userAgent) ? 'mobile' : 'desktop',
          browser: (navigator.userAgent.match(/(Chrome|Safari|Firefox|Edge|Opera)/i) || ['unknown'])[0],
        }),
      });
      const d = await r.json().catch(() => null);
      if (d && typeof d.count === 'number') {
        viewsCache[key] = d.count;
        // 回填抽屉中显示的浏览数
        const el = document.getElementById('drawer-views');
        if (el && el.dataset.fid === key) {
          const n = d.count;
          const txt = n >= 1000 ? (n/1000).toFixed(1) + 'k' : String(n);
          el.textContent = `👁 ${txt} ${T('次浏览','views')}`;
        }
      }
    } catch (_) {}
  }
  async function fetchJournalViews(keys) {
    const want = [...new Set(keys.filter(k => k && !(k in viewsCache)))].slice(0, 500);
    if (!want.length) return;
    try {
      const r = await fetch(`${API_BASE}/journal-views?keys=${encodeURIComponent(want.join(','))}`);
      const d = await r.json().catch(() => null);
      if (d && d.views) for (const k in d.views) viewsCache[k] = d.views[k];
    } catch (_) {}
  }
  const ASJC_TOP_CN = {
    'Life Sciences': '生命科学',
    'Health Sciences': '健康科学',
    'Physical Sciences': '物理科学',
    'Social Sciences': '社会科学',
    'Multidisciplinary': '多学科',
  };
  function asjcTopChip(name) {
    const cls = name.split(' ')[0].toLowerCase();
    return `<span class="cat-chip asjc-${cls}">${T(ASJC_TOP_CN[name]||name, name)}</span>`;
  }
  function badgeZone(z, top) {
    if (!z) return '';
    if (top) return `<span class="zone ztop">TOP·${z}${T('区','')}</span>`;
    return `<span class="zone z${z}">${z}${T('区','')}</span>`;
  }
  function badgeIF(v) {
    if (v === undefined || v === null) return '';
    return `<span class="if-pill" title="${T('最新 JCR 影响因子','Latest JCR Impact Factor')}">IF ${(+v).toFixed(1)}</span>`;
  }
  function badgeJCR(q) {
    if (!q) return '';
    const m = String(q).toUpperCase().match(/^Q([1-4])$/);
    if (!m) return '';
    return `<span class="zone jcr-q${m[1]}" title="${T('JCR 分区','JCR Quartile')}">JCR Q${m[1]}</span>`;
  }
  function badgeCAS(z, top) {
    if (!z) return '';
    if (top) return `<span class="zone ztop" title="${T('中科院大类分区 Top','CAS Major Tier · Top')}">${T('中科院','CAS')} ${z}${T('区','')}·TOP</span>`;
    return `<span class="zone z${z}" title="${T('中科院大类分区','CAS Major Tier')}">${T('中科院','CAS')} ${z}${T('区','')}</span>`;
  }
  // 国内来源交叉徽章
  function badgeDomSrc(tag) {
    const map = {
      cssci: 'CSSCI', cssci_ext: T('CSSCI 扩展','CSSCI Ext'), pku: T('北大核心','PKU Core'),
      cnkx_T1: T('科协 T1','CAST T1'), cnkx_T2: T('科协 T2','CAST T2'), cnkx_T3: T('科协 T3','CAST T3'),
      ccft_T1: 'CCF-T1', ccft_T2: 'CCF-T2', ccft_T3: 'CCF-T3',
      zju: T('浙大目录','ZJU'), school_a: T('学校 A','School A'),
    };
    const cls = tag.replace(/[^a-z0-9]/gi,'-').toLowerCase();
    return `<span class="domsrc-pill ds-${cls}">${map[tag]||tag}</span>`;
  }
  function badgeCCF(ccf) {
    if (!ccf) return '';
    const t = String(ccf).toUpperCase().replace(/[^ABC]/g,'') || 'X';
    return `<span class="ccf-pill ccf-${t}">CCF ${t}</span>`;
  }
  function badgeABDC(abdc) {
    const rating = typeof abdc === 'string' ? abdc : (abdc && abdc.rating);
    if (!rating) return '';
    const label = String(rating).trim().toUpperCase().replace('A STAR', 'A*').replace('A-STAR', 'A*');
    const cls = label === 'A*' ? 'a-star' : label.toLowerCase().replace(/[^a-c]/g, '');
    const source = (abdc && abdc.source) || 'ABDC Journal Quality List';
    return `<span class="abdc-pill abdc-${cls}" title="${escape(source)}">ABDC ${escape(label)}</span>`;
  }
  function badgeABS(abs) {
    const rating = typeof abs === 'string' ? abs : (abs && abs.rating);
    if (!rating) return '';
    const label = String(rating).trim().replace('★', '*');
    const valid = ['4*', '4', '3', '2', '1'];
    if (!valid.includes(label)) return '';
    const cls = label === '4*' ? 'abs-g4s' : 'abs-g' + label;
    const source = (abs && abs.source) || 'Chartered ABS AJG 2024';
    return `<span class="zone ${cls}" title="${escape(source)}">ABS ${escape(label)}</span>`;
  }
  function badgeFT50(ft50) {
    if (!ft50) return '';
    const source = (ft50 && ft50.source) || 'Financial Times Top 50 Journals';
    const order = ft50 && ft50.order ? ` #${ft50.order}` : '';
    return `<span class="zone ft50" title="${escape(source)}">FT50${escape(order)}</span>`;
  }
  function badgeUTD24(utd24) {
    if (!utd24) return '';
    const source = (utd24 && utd24.source) || 'UT Dallas Top 24 Business Journals';
    const order = utd24 && utd24.order ? ` #${utd24.order}` : '';
    return `<span class="zone utd24" title="${escape(source)}">UTD24${escape(order)}</span>`;
  }
      function badgeTier(tier) {
        if (!tier) return '';
        const raw = String(tier).trim().toUpperCase();
        // 理工 T1/T2/T3
        const tm = raw.match(/^T([123])$/);
        if (tm) return `<span class="tier-pill t${tm[1]}" title="${T('中国科协 T','CAST T')}${tm[1]}${T(' 级',' tier')}">${raw}</span>`;
        // 管理 A/B/C/D
        const am = raw.match(/^([ABCD])$/);
        if (am) return `<span class="tier-pill ta-${am[1].toLowerCase()}" title="${T('中国科协','CAST')} ${am[1]}${T(' 级（管理类）',' (Management)')}">${raw}</span>`;
        return `<span class="tier-pill">${raw}</span>`;
      }
      function badgeFlagship(kind) {
        if (!kind) return '';
        const map = {
          nature_main:  [T('Nature 正刊','Nature'),     'flag-nature-main'],
          science_main: [T('Science 正刊','Science'),    'flag-science-main'],
          cell_main:    [T('Cell 正刊','Cell'),          'flag-cell-main'],
          nature_sub:   [T('Nature 子刊','Nature sub'),  'flag-nature-sub'],
          science_sub:  [T('Science 子刊','Science sub'),'flag-science-sub'],
          cell_sub:     [T('Cell 子刊','Cell sub'),      'flag-cell-sub'],
        };
        const m = map[kind];
        if (!m) return '';
        return `<span class="flagship-pill ${m[1]}" title="${m[0]}">${m[0]}</span>`;
      }
      function badgeXR(xr) {
        if (!xr) return '';
        const z = typeof xr === 'object' ? xr.zone : xr;
        const top = typeof xr === 'object' && xr.top;
        if (!z) return '';
        const cls = top ? 'xr-top' : `xr-${z}`;
        const label = `${T('新锐','Emerging')} ${z}${T('区','')}${top ? '·TOP' : ''}`;
        return `<span class="xr-pill ${cls}" title="${T('中科院 2026 新锐版分区','CAS Emerging Edition 2026')}">${label}</span>`;
      }
      function badgeWarn(w, isCard) {
        if (!w) return '';
        // Rich warning object with year/level
        if (typeof w === 'object') {
          const arr = Array.isArray(w) ? w : [w];
          const latest = arr.reduce((a,b) => (!a || (b.year && b.year > (a.year||0))) ? b : a, null);
          const yearStr = latest && latest.year ? `${latest.year}` : '';
          const levelStr = latest && latest.level ? latest.level : '';
          const label = yearStr ? `${yearStr}${levelStr ? '/'+levelStr : ''}` : (levelStr || '');
          if (isCard && label) {
            return `<span class="warn-pill">⚠ ${escape(label)}</span>`;
          }
        }
        return `<span class="warn-pill">⚠ ${T('预警','Warning')}</span>`;
      }
      function badgeUnderReview() {
        return `<span class="under-review-pill">${T('新锐审查中','Emerging Under Review')}</span>`;
      }
      function badgeOnHold() {
        return `<span class="on-hold-pill">WoS On Hold</span>`;
      }
      function badgeEiHistorical(value) {
        if (!value) return '';
        const year = value.final_year || '';
        const tip = year
          ? T(`EI Compendex 收录截至 ${year}，目前已停止收录`, `Indexed by EI Compendex through ${year}; no longer indexed`)
          : T('EI Compendex 历史收录，目前已停止收录', 'Historically indexed by EI Compendex; no longer indexed');
        return `<span class="warn-pill ei-discontinued-pill" title="${escape(tip)}">${T('EI 已停止','EI discontinued')}</span>`;
      }
      function badgeWosHistorical(value) {
        if (!value) return '';
        const indexes = Array.isArray(value.indices) ? value.indices.join(' / ') : 'WoS';
        const active = Array.isArray(value.current_indices) ? value.current_indices.filter(Boolean) : [];
        const firstAbsent = value.first_absent || value.as_of || '';
        const tip = active.length
          ? T(`曾由 ${indexes} 收录，现已转入 ${active.join(' / ')}`, `Previously indexed in ${indexes}; now indexed in ${active.join(' / ')}`)
          : T(`${indexes} 当前未收录${firstAbsent ? `；最迟自 ${firstAbsent} 名单起已缺席` : ''}；具体剔除日及原因未公开`, `${indexes} is not currently indexed${firstAbsent ? `; absent no later than the ${firstAbsent} list` : ''}; exact removal date and reason are not public`);
        const label = active.length
          ? `${indexes} → ${active.join(' / ')}`
          : T(`${indexes} 当前未收录`, `${indexes} not current`);
        return `<span class="warn-pill wos-history-pill" title="${escape(tip)}">${escape(label)}</span>`;
      }
      function badgeCiticWarning() {
        return `<span class="citic-warning-pill">${T('中信所预警','CITIC Warning')}</span>`;
      }

  // 统一标签组合：主页 / 收藏页 / 抽屉 / 分享卡片共用同一批 badge 函数与 CSS 类。
  function renderIndexBadges(r) {
    if (!r) return '';
    return [
      badgeFlagship(r.flagship),
      r.nature_index ? badgeNatureIndex() : '',
      ...((r.indices) || []).map(badgeIndex),
      badgeScopus(r.scopus),
      badgeInspec(r.inspec),
      badgeFSTAFullText(r.fsta || r.fsta_full_text),
      badgeCABI(r.cabi),
      badgeOAJ(r.oaj),
      badgeDOAJ(r.doaj),
      badgeMEDLINE(r.medline),
      r.cscd ? badgeCSCD(r.cscd) : '',
      r.cstpcd ? badgeCSTPCD(r.cstpcd) : '',
    ].filter(Boolean).join('');
  }
  function renderRankBadges(r) {
    if (!r) return '';
    return [
      badgeJCR(r.if_quartile),
      badgeCAS(r.cas_zone, r.cas_top),
      badgeXR(r.cas_xr),
      badgeCCF(r.ccf),
      badgeABDC(r.abdc),
      badgeABS(r.abs),
      badgeFT50(r.ft50),
      badgeUTD24(r.utd24),
        // cnkx tier badges removed — now handled by renderDomCrossBadges via domIndex
      r.warning ? badgeWarn(r.warning, true) : '',
      r.under_review ? badgeUnderReview() : '',
      r.on_hold ? badgeOnHold() : '',
      r.citic_warning ? badgeCiticWarning() : '',
    ].filter(Boolean).join('');
  }
  function renderBadgeCell(indexBadges, rankBadges) {
    return [
      indexBadges ? `<div class="badges badges-idx">${indexBadges}</div>` : '',
      rankBadges  ? `<div class="badges badges-rank">${rankBadges}</div>`  : '',
    ].filter(Boolean).join('') || '<span class="muted-cell">—</span>';
  }

  function renderCoverageBadges(r) {
    if (!r) return '';
    return [
      badgeFlagship(r.flagship),
      r.nature_index ? badgeNatureIndex() : '',
      ...((r.indices) || []).map(badgeIndex),
      badgeScopus(r.scopus),
      badgeInspec(r.inspec),
      badgeFSTAFullText(r.fsta || r.fsta_full_text),
      badgeCABI(r.cabi),
      badgeMEDLINE(r.medline),
      badgePubMed(r.pubmed),
      badgePMC(r.pmc),
      r.cscd ? badgeCSCD(r.cscd) : '',
      r.cstpcd ? badgeCSTPCD(r.cstpcd) : '',
      r.scd ? badgeSCD(r.scd) : '',
    ].filter(Boolean).join('');
  }
  function renderAccessBadges(r, { includeFree = true } = {}) {
    if (!r) return '';
    return [
      includeFree && canSeePublishFeeInfo() ? badgeFree(isFreeToPublish(r)) : '',
      badgeOAJ(r.oaj),
      badgeDOAJ(r.doaj),
    ].filter(Boolean).join('');
  }
  function renderRiskBadges(r) {
    if (!r) return '';
    return [
      r.warning ? badgeWarn(r.warning, true) : '',
      r.under_review ? badgeUnderReview() : '',
      r.on_hold ? badgeOnHold() : '',
      r.wos_historical ? badgeWosHistorical(r.wos_historical) : '',
      r.ei_historical ? badgeEiHistorical(r.ei_historical) : '',
      r.citic_warning ? badgeCiticWarning() : '',
      badgeRetraction(r.retraction),
    ].filter(Boolean).join('');
  }
  function renderLevelBadges(r) {
    if (!r) return '';
    return [
      badgeJCR(r.if_quartile),
      badgeCAS(r.cas_zone, r.cas_top),
      badgeXR(r.cas_xr),
      badgeCCF(r.ccf),
      badgeABDC(r.abdc),
      badgeABS(r.abs),
      badgeFT50(r.ft50),
      badgeUTD24(r.utd24),
      badgeFMS(r.fms),
      badgeVHB(r.vhb),
      badgeCNRS(r.cnrs),
      badgeAMI(r.ami),
    ].filter(Boolean).join('');
  }
  function renderIndexBadges(r) {
    return renderCoverageBadges(r);
  }
  function renderRankBadges(r) {
    return [renderLevelBadges(r), renderRiskBadges(r)].filter(Boolean).join('');
  }
  function renderBadgeCell(indexBadges, rankBadges, accessBadges, riskBadges) {
    // 收录 / 分区各占一行；开放 + 风险并排（中间细竖线），避免卡片被两行撑高
    let oaRiskHtml = '';
    if (accessBadges && riskBadges) {
      oaRiskHtml = `<div class="badges-oa-risk" data-badge-row="oa-risk">
        <div class="badges badges-access" data-badge-row="access" data-label="${T('开放','OA')}">${accessBadges}</div>
        <span class="badge-vsep" aria-hidden="true"></span>
        <div class="badges badges-risk" data-badge-row="risk" data-label="${T('风险','Risk')}">${riskBadges}</div>
      </div>`;
    } else if (accessBadges) {
      oaRiskHtml = `<div class="badges badges-access" data-badge-row="access" data-label="${T('开放','OA')}">${accessBadges}</div>`;
    } else if (riskBadges) {
      oaRiskHtml = `<div class="badges badges-risk" data-badge-row="risk" data-label="${T('风险','Risk')}">${riskBadges}</div>`;
    }
    return [
      indexBadges ? `<div class="badges badges-idx" data-badge-row="index" data-label="${T('收录','Idx')}">${indexBadges}</div>` : '',
      rankBadges  ? `<div class="badges badges-rank" data-badge-row="rank" data-label="${T('分区','Rank')}">${rankBadges}</div>`  : '',
      oaRiskHtml,
    ].filter(Boolean).join('') || '';
  }

  function starBtn(r, src = 'int') {
    const on = isFav(r);
    const limit = favLimitForUser();
    const atLimit = !on && Number.isFinite(limit) && allFavIds().size >= limit;
    const title = on
      ? t('fav_removed')
      : (atLimit
        ? T(`Free 收藏上限 ${FREE_FAV_LIMIT} 本`, `Free limit: ${FREE_FAV_LIMIT} favorites`)
        : t('fav_added'));
    // Free 可收藏，不再整站锁定星标
    return `<button class="fav-star ${on?'on':''}${atLimit?' is-at-limit':''}" data-fav="${escape(favId(r))}" data-fav-src="${escape(src)}" aria-label="toggle favorite" title="${title}">${on?'★':'☆'}</button>`;
  }

  // row-record 映射，供 star click / 详情抽屉查找完整记录
  const rowRecordsByFid = Object.create(null);

  // ───────── 国内来源交叉索引（norm name / issn → 各源命中）─────────
  const domIndex = { byName: Object.create(null), byIssn: Object.create(null) };
  function domKeyName(s) { return normTitle(s); }
  function addDomIndex(key, source, payload) {
    if (!key) return;
    const map = source === 'issn' ? domIndex.byIssn : domIndex.byName;
    const k = source === 'issn' ? key.toUpperCase() : domKeyName(key);
    if (!k) return;
    (map[k] = map[k] || []).push(payload);
  }
  function lookupDom(r) {
    const hits = [];
    const nk = domKeyName(r.name || r.cn_name || '');
    if (nk && domIndex.byName[nk]) hits.push(...domIndex.byName[nk]);
    const ik = (r.issn || r.cn_code || '').toUpperCase();
    if (ik && domIndex.byIssn[ik]) hits.push(...domIndex.byIssn[ik]);
    // dedupe by source + discipline (CAST journals span multiple disciplines;
    // keep each distinct discipline so badges read e.g. 科协建筑 / 科协机械).
    const seen = new Set();
    return hits.filter(h => { const k = h.source + ':' + (h.domain || h.tag || ''); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  function buildDomIndex(d) {
    if (!d) return;
    domIndex.byName = Object.create(null);
    domIndex.byIssn = Object.create(null);
    ((d.scd && d.scd.records)||[]).forEach(r => {
      const label = r.newly_added ? 'SCD+' : 'SCD';
      const payload = { source:'scd', label, tag:r.newly_added ? 'new' : 'core', domain:r.category || '' };
      addDomIndex(r.name, 'name', payload);
      if (r.issn) addDomIndex(r.issn, 'issn', payload);
      if (r.cn_code) addDomIndex(r.cn_code, 'issn', payload);
    });
    ((d.ami && d.ami.records)||[]).forEach(r => {
      const tier = r.tier || '';
      const payload = { source:'ami', label:`AMI${tier ? ' ' + tier : ''}`, tag:tier, domain:r.discipline || '' };
      addDomIndex(r.name, 'name', payload);
      if (r.issn) addDomIndex(r.issn, 'issn', payload);
      if (r.cn_code) addDomIndex(r.cn_code, 'issn', payload);
    });
    ((d.vhb && d.vhb.records)||[]).forEach(r => {
      const rating = r.rating || '';
      const payload = { source:'vhb', label:`VHB ${rating}`.trim(), tag:rating, domain:r.area_code || r.area || '' };
      addDomIndex(r.title, 'name', payload);
      if (r.issn) addDomIndex(r.issn, 'issn', payload);
    });
    ((d.cnrs && d.cnrs.records)||[]).forEach(r => {
      const category = r.category || '';
      const payload = { source:'cnrs', label:`CNRS ${category}`.trim(), tag:category, domain:r.domain || '' };
      addDomIndex(r.title, 'name', payload);
      if (r.issn) addDomIndex(r.issn, 'issn', payload);
    });
    // CSSCI
    (d.cssci_core||[]).forEach(r => {
      addDomIndex(r.name, 'name', { source:'cssci', label:'CSSCI', tag:'', discipline:r.discipline });
    });
    (d.cssci_ext||[]).forEach(r => {
      addDomIndex(r.name, 'name', { source:'cssci_ext', label:T('CSSCI 扩展','CSSCI Ext'), tag:'', discipline:r.discipline });
    });
    (d.pku_core||[]).forEach(r => {
      addDomIndex(r.name, 'name', { source:'pku', label:T('北大核心','PKU Core'), tag:'', category:r.category });
    });
    // 中国科协 高质量科技期刊分级目录 (2025-12 修订, 11084 条)
    ((d.cnkx && d.cnkx.records)||[]).forEach(r => {
      if (!r.tier || !/^T[123]$/.test(r.tier)) return;
      const cnkxLabel = castLabel(r.domain, r.tier);
      addDomIndex(r.name, 'name', { source:'cnkx', label:cnkxLabel, tag:r.tier, domain:r.domain });
      if (r.issn) addDomIndex(r.issn, 'issn', { source:'cnkx', label:cnkxLabel, tag:r.tier, domain:r.domain });
    });
    ((d.cscd && d.cscd.records)||[]).forEach(r => {
      const code = String(r.database || '').toUpperCase();
      const label = code === 'C' ? 'CSCD-C' : (code === 'E' ? 'CSCD-E' : 'CSCD');
      const payload = { source:'cscd', label, tag:code, domain:r.database_label || '' };
      addDomIndex(r.name, 'name', payload);
      if (r.issn) addDomIndex(r.issn, 'issn', payload);
      if (r.cn_code) addDomIndex(r.cn_code, 'issn', payload);
    });
    ((d.cstpcd && d.cstpcd.records)||[]).forEach(r => {
      const isPopular = r.kind === 'popular_science';
      const label = isPopular ? T('中国科技核心·科普','CSTPCD Popular') : T('中国科技核心','CSTPCD');
      addDomIndex(r.name, 'name', { source:'cstpcd', label, tag:r.kind || 'core', domain:r.code || '' });
    });
    ((d.nsfc_mgmt && d.nsfc_mgmt.records)||[]).forEach(r => {
      addDomIndex(r.name, 'name', { source:'nsfc_mgmt', label:'NSFC '+r.tier, tag:r.tier, domain:T('管理科学部','Management Science') });
      if (r.issn) addDomIndex(r.issn, 'issn', { source:'nsfc_mgmt', label:'NSFC '+r.tier, tag:r.tier, domain:T('管理科学部','Management Science') });
    });
    (d.ccft||[]).forEach(r => {
      addDomIndex(r.cn_name, 'name', { source:'ccft', label:'CCF-'+r.tier, tag:r.tier, org:r.org });
      if (r.cn_code) addDomIndex(r.cn_code, 'issn', { source:'ccft', label:'CCF-'+r.tier, tag:r.tier });
    });
    ((d.zju && d.zju.records)||[]).forEach(r => {
      addDomIndex(r.name.replace(/\*$/,''), 'name', { source:'zju', label:T('浙大','ZJU')+' '+r.tier, tag:r.tier });
      if (r.issn) addDomIndex(r.issn, 'issn', { source:'zju', label:T('浙大','ZJU')+' '+r.tier, tag:r.tier });
    });
    // Note: cnki_major（中文期刊目录）是基础库，不参与交叉收录徽章
  }
  // CAST discipline shown on the badge, e.g. 建筑领域 → 建筑, 临床医学 → 临床医学.
  function castDiscipline(domain) {
    const d = tn(domain, 'domain') || '';
    return d.replace(/领域$/, '').replace(/\s*(field|area)$/i, '').trim();
  }
  // Badge label: 科协·学科 T2（有学科必显示；无学科时退化为 科协 T2，禁止只显示裸 T2）
  function castLabel(domain, tier) {
    const disc = castDiscipline(domain);
    const needsSpace = !(lang === 'zh-CN' || lang === 'zh-TW' || lang === 'ja' || lang === 'ko');
    const tierText = tier ? String(tier).trim().toUpperCase() : '';
    if (disc && tierText) return `${T('科协','CAST')}${needsSpace ? ' ' : '·'}${disc} ${tierText}`;
    if (disc) return `${T('科协','CAST')}${needsSpace ? ' ' : '·'}${disc}`;
    if (tierText) return `${T('科协','CAST')} ${tierText}`;
    return T('科协','CAST');
  }
  /** 卡片用科协徽章：优先索引里的 domain，否则用记录自身 domain+tier */
  function castBadgeHtml(r) {
    const hits = lookupDom(r).filter(h => h.source === 'cnkx');
    const seen = new Set();
    const pills = [];
    const push = (domain, tier, labelHint) => {
      const tierText = tier ? String(tier).trim().toUpperCase() : '';
      const disc = castDiscipline(domain) || (domain ? (tn(domain, 'domain') || String(domain)) : '');
      const label = labelHint || castLabel(domain, tier);
      if (!label || seen.has(label)) return;
      seen.add(label);
      const title = `${T('中国科协','CAST')}${tierText ? ' ' + tierText : ''}${disc ? ' · ' + disc : ''}${T(' 级',' tier')}`;
      pills.push(`<span class="domsrc-pill ds-cnkx" title="${escape(title)}">${escape(label)}</span>`);
    };
    hits.forEach(h => push(h.domain, h.tag || h.tier, h.label));
    // 当前记录本身是科协条目，或有 T 级但索引未命中
    if (!pills.length && (r.__src === 'cnkx' || (r.tier && /^T[123]$/i.test(String(r.tier))))) {
      push(r.domain, r.tier, null);
    }
    return pills.join('');
  }
  function renderDomCrossBadges(r, excludeSource) {
    const rankSources = new Set(['vhb', 'cnrs', 'fms', 'abdc', 'abs', 'ft50', 'utd24']);
    // 全球站收录行已画 CSCD / 科技核心（renderCoverageBadges），交叉徽章勿再重复
    const coveredOnRecord = new Set();
    if (r?.cscd) coveredOnRecord.add('cscd');
    if (r?.cstpcd) coveredOnRecord.add('cstpcd');
    if (excludeSource) coveredOnRecord.add(excludeSource);
    const hits = lookupDom(r).filter(h => h.source && !coveredOnRecord.has(h.source) && !rankSources.has(h.source));
    if (!hits.length) return '';
    const out = [];
    const castHits = [];
    const vhbHits = [];
    const hasEmbeddedVhb = Array.isArray(r.vhb) && r.vhb.length;
    const seenSourceLabel = new Set();
    for (const h of hits) {
      if (h.source === 'cnkx') { castHits.push(h); continue; }
      if (h.source === 'vhb') {
        if (!hasEmbeddedVhb) vhbHits.push(h);
        continue;
      }
      const dedupeKey = `${h.source}|${h.label || ''}`;
      if (seenSourceLabel.has(dedupeKey)) continue;
      seenSourceLabel.add(dedupeKey);
      out.push(`<span class="domsrc-pill ds-${h.source}" title="${escape(h.domain||h.discipline||h.category||h.org||'')}">${escape(h.label)}</span>`);
    }
    if (vhbHits.length) {
      const seenVhb = new Set();
      const rows = [];
      for (const h of vhbHits) {
        const key = `${h.tag || ''}|${h.domain || ''}`;
        if (seenVhb.has(key)) continue;
        seenVhb.add(key);
        rows.push({ year: 2024, rating: h.tag || String(h.label || '').replace(/^VHB\s*/i, ''), area: h.domain || '', area_code: '' });
      }
      const vhbBadge = badgeVHB(rows);
      if (vhbBadge) out.push(vhbBadge);
    }
    // CAST: label by discipline (科协建筑) instead of bare tier (科协 T1).
    const castSeen = new Set();
    const castShown = [];
    for (const h of castHits) {
      const label = h.label || castLabel(h.domain, h.tag);
      if (castSeen.has(label)) continue;
      castSeen.add(label);
      castShown.push({ label, tier: h.tag || '', domain: tn(h.domain, 'domain') || '' });
    }
    castShown.forEach((c, index) => {
      const title = `${T('中国科协','CAST')}${c.tier ? ' ' + c.tier : ''}${c.domain ? ' · ' + c.domain : ''}`;
      if (index) out.push('<span class="domsrc-dot" aria-hidden="true">·</span>');
      out.push(`<span class="domsrc-pill ds-cnkx" title="${escape(title)}">${escape(c.label)}</span>`);
    });
    return out.join('');
  }

  /** 刊名兜底：兼容 name/n/journal_title 等字段，避免收藏卡标题空白 */
  function journalDisplayName(r) {
    if (!r) return '';
    return String(
      r.name || r.n || r.cn_name || r.journal_title || r.global_name || r.en_name || r.title || ''
    ).trim();
  }

  /**
   * 统一期刊卡片：上块（拖动手柄 | 刊名/副信息 | IF+收藏）+ 下块（徽章）
   * 拖动手柄放在上块最左侧，不再单独占一整行。
   */
  function journalCardRow({
    fid,
    src,
    flagship = false,
    extraClass = '',
    favHtml,
    nameHtml,
    metaHtml = '',
    bodyHtml = '',
    ifHtml = '',
    freeHtml = '',
    dragHtml = '',
  }) {
    const bodyInner = (bodyHtml && String(bodyHtml).replace(/\s+/g, ''))
      ? bodyHtml
      : `<div class="j-card-badges j-card-body-placeholder" aria-hidden="true"></div>`;
    const hasDrag = !!(dragHtml && String(dragHtml).trim());
    // ifHtml 形如 { num, label } 或旧 HTML；兼容 jMetaIf 返回对象
    let ifNum = '';
    let ifLabel = '';
    if (ifHtml && typeof ifHtml === 'object') {
      ifNum = ifHtml.num || '';
      ifLabel = ifHtml.label || '';
    } else if (ifHtml) {
      ifNum = ifHtml;
    }
    // 免费发表 / Pro 锁：贴在 IF 正下方（不展示 muted 破折号）
    const freeUnderIf = freeHtml && !/muted-cell/.test(String(freeHtml))
      ? `<div class="j-card-if-free">${freeHtml}</div>`
      : '';
    return `<tr class="j-row j-card clickable${extraClass ? ` ${extraClass}` : ''}${flagship ? ' row-flagship' : ''}${hasDrag ? ' has-drag' : ''}" data-fid="${escape(fid)}" data-src="${escape(src)}">
      <td class="j-card-main col-name">
        <div class="j-card-head">
          ${hasDrag ? `<div class="j-card-drag col-drag">${dragHtml}</div>` : ''}
          <div class="j-card-head-main">
            <div class="j-card-title-block">${nameHtml}</div>
            ${metaHtml ? `<div class="j-card-meta-row">${metaHtml}</div>` : ''}
          </div>
          <div class="j-card-head-side">
            <div class="j-if-fav-row">
              ${ifLabel}
              ${ifNum}
              <div class="j-card-fav col-fav">${favHtml || ''}</div>
            </div>
            ${freeUnderIf}
          </div>
        </div>
        <div class="j-card-body">${bodyInner}</div>
      </td>
    </tr>`;
  }

  function jMetaIf(label, value) {
    if (value == null || value === '' || value === '—') return null;
    return {
      num: `<strong class="j-card-if-num" title="${escape(label)} ${escape(String(value))}">${escape(String(value))}</strong>`,
      label: `<span class="j-card-if-label">${escape(label)}</span>`,
    };
  }
  function jMetaText(label, value, cls = '') {
    if (value == null || value === '' || value === '—') return '';
    // value 可为已 escape 的字符串
    return `<span class="j-meta ${cls}" title="${escape(String(value).replace(/<[^>]+>/g, ''))}"><em>${escape(label)}</em><span>${value}</span></span>`;
  }
  /** 无标签短文案（出版商、ISSN 等） */
  function jMetaChip(text, cls = '') {
    if (text == null || text === '' || text === '—') return '';
    const raw = String(text);
    return `<span class="j-meta ${cls}" title="${escape(raw)}"><span>${escape(raw)}</span></span>`;
  }
  function jMetaPlain(html, cls = '') {
    if (!html) return '';
    return `<span class="j-meta ${cls}">${html}</span>`;
  }
  /** 卡片下部徽章：限制数量，避免一堆标签把卡撑乱 */
  function limitBadgeHtml(html, max = 8) {
    if (!html) return '';
    // 按标签切分（span/button/details）
    const parts = String(html).match(/<(?:span|button|a|details)\b[\s\S]*?<\/(?:span|button|a|details)>/gi) || [];
    if (parts.length <= max) return html;
    return parts.slice(0, max).join('') + `<span class="domsrc-pill" style="opacity:.65">+${parts.length - max}</span>`;
  }

  // 通用中文期刊行渲染
  function renderDomRow(r, opts = {}) {
    const { src, showTier, tierValue, extraCols = '', extraBadges = '', metaHtml: extraMeta = '' } = opts;
    const fid = favId(r);
    rowRecordsByFid[fid] = { ...r, __src: src };
    const name = r.name || r.cn_name || '';
    const enName = r.en_name ? `<span class="jname-cn">${escape(titleCase(r.en_name))}</span>` : '';
    const crossBadges = renderDomCrossBadges({ name, issn: r.issn, cn_code: r.cn_code }, src);
    // 科协目录：徽章带学科+T 级，不用裸 T2
    const castBadge = (src === 'cnkx' || showTier)
      ? castBadgeHtml({ ...r, __src: src, tier: tierValue || r.tier })
      : '';
    const tierBadge = (!castBadge && showTier && tierValue && !/^T[123]$/i.test(String(tierValue)))
      ? badgeTier(tierValue)
      : '';
    const nameHtml = `<div class="jname">${escape(titleCase(name.replace(/\*$/,'')))}${enName}</div>`;
    const metaHtml = [
      r.issn ? jMetaChip(`ISSN ${r.issn}`, 'j-meta-id') : '',
      (src === 'cnkx' && r.domain) ? jMetaChip(tn(r.domain, 'domain') || r.domain, 'j-meta-topic-show') : '',
      extraMeta,
    ].filter(Boolean).join('');
    // extraCols 可能是旧 <td>…，卡片体里只放徽章
    const bodyHtml = `<div class="j-card-badges badges">${limitBadgeHtml([castBadge, tierBadge, extraBadges, crossBadges].filter(Boolean).join(''), 8)}</div>`;
    return journalCardRow({
      fid, src,
      favHtml: starBtn(r, src),
      nameHtml,
      metaHtml,
      bodyHtml,
    });
  }

  function renderRow(r) {
    const fid = favId(r);
    rowRecordsByFid[fid] = { ...r, __src: 'int' };
    const nameHtml = `<div class="jname ${r.flagship ? 'jname-flagship' : ''}">${escape(titleCase(r.name))}${r.cn_name ? `<span class="jname-cn">${escape(r.cn_name)}</span>` : ''}${aliasHintHtml(r)}</div>`;
    const crossBadges = renderDomCrossBadges(r, 'int');
    // 免费发表不进徽章堆，改到刊名下 meta 行
    const indexBadges = limitBadgeHtml(renderCoverageBadges(r), 8);
    const rankBadges = limitBadgeHtml([renderLevelBadges(r), crossBadges].filter(Boolean).join(''), 6);
    const accessBadges = limitBadgeHtml(renderAccessBadges(r, { includeFree: false }), 3);
    const riskBadges = limitBadgeHtml(renderRiskBadges(r), 2);
    const badgeCell = renderBadgeCell(indexBadges, rankBadges, accessBadges, riskBadges);
    const ifVal = (r.if_2024 != null) ? (+r.if_2024).toFixed(1) : '';
    const cr = r.crossref;
    const doaj = r.doaj;
    let cycleDays = null;
    if (cr && cr.median_days) {
      cycleDays = +cr.median_days;
    } else if (doaj && typeof doaj === 'object' && doaj.review_weeks) {
      cycleDays = +doaj.review_weeks * 7;
    }
    const cycleLabel = cycleDays
      ? `${Math.round(cycleDays / 30.4)}${T('个月','mo')}`
      : '';
    // 免费发表贴 IF 下方，不再塞进刊名 meta 行
    const freeHtml = freeBadgeCell(r, { compact: true });
    const subject = (r.wos_categories && r.wos_categories[0])
      || r.jcr_cat || r.cas_major_cn || r.esi_category || '';
    const publisher = r.publisher || '';
    const metaHtml = [
      cycleLabel ? jMetaText(T('审稿','Review'), escape(cycleLabel), 'j-meta-cycle') : '',
      subject ? jMetaChip(subject, 'j-meta-topic-show') : '',
      publisher ? jMetaChip(publisher, 'j-meta-pub') : '',
    ].filter(Boolean).join('');
    const bodyHtml = `<div class="j-card-badges">${badgeCell}</div>`;
    return journalCardRow({
      fid, src: 'int', flagship: !!r.flagship,
      favHtml: starBtn(r, 'int'),
      nameHtml,
      ifHtml: ifVal ? jMetaIf('IF', ifVal) : null,
      freeHtml,
      metaHtml,
      bodyHtml,
    });
  }

  /* ───────── FREE badge helper（Pro+ 可见是否付费发表） ───────── */
  function freeBadgeCell(r, opts = {}) {
    const compact = !!opts.compact;
    if (!canSeePublishFeeInfo()) {
      return `<button type="button" class="badge b-free-lock" data-publish-fee-lock title="${T('升级 Pro 后可查看是否付费发表','Upgrade to Pro to see publish-fee info')}">${T('Pro','Pro')}</button>`;
    }
    if (!isFreeToPublish(r)) return '<span class="muted-cell">&mdash;</span>';
    // IF 下方空间紧：中文「免费」、英文 FREE；完整语义放 title
    const label = compact
      ? T('免费', 'FREE')
      : T('免费发表', 'FREE TO PUBLISH');
    return `<span class="badge b-free" title="${T('作者可选择免费发表路径（Diamond / Hybrid / 订阅制等）','Author-free publishing path available (Diamond / Hybrid / subscription, etc.)')}">${label}</span>`;
  }

  function escape(s) {
    return String(s||'').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ───────── filtering ─────────
  function matches(r) {
    // 预警名单：合并所有预警信号（任意命中即可，OR 语义）
    if (activeWarnList && !(r.warning || r.citic_warning || r.under_review || r.on_hold)) return false;
    // Index filter: exclude ESI from indices[] check (ESI stored as esi_category)
    // ESI adds another OR condition — journal with esi_category also shows
    const esiActive = activeIndices.has('ESI');
    const idxOnly = new Set([...activeIndices].filter(v => v !== 'ESI'));
    const matchesAny = !idxOnly.size || (r.indices || []).some(i => idxOnly.has(i));
    if (!matchesAny && !(esiActive && r.esi_category)) {
      // When OAJ / DOAJ / MEDLINE / PubMed / PMC is checked, those journals bypass the
      // index filter (allows pure directory-journals without WoS/EI indices to show)
      if (!((activeFeats.has('oaj') && r.oaj) || (activeFeats.has('doaj') && r.doaj) ||
            (activeFeats.has('medline') && r.medline) ||
            (activeFeats.has('cscd') && r.cscd) ||
            (activeFeats.has('cstpcd') && r.cstpcd) ||
            (activeFeats.has('free') && canSeePublishFeeInfo() && isFreeToPublish(r)) ||
            (activeFeats.has('warning') && r.warning) ||
            (activeFeats.has('citic_warning') && r.citic_warning) ||
            (activeFeats.has('under_review') && r.under_review) ||
            (activeFeats.has('on_hold') && r.on_hold))) return false;
    }
    if (activeZones.size) {
      const zones = new Set();
      if (r.cas_zone) zones.add(String(r.cas_zone));
      if (r.cas_top) zones.add('top');
      let ok = false;
      for (const z of activeZones) if (zones.has(z)) { ok = true; break; }
      if (!ok) return false;
    }
    if (activeJcr.size) {
      const jcr = (r.if_quartile || '').toUpperCase();
      if (!jcr || !activeJcr.has(jcr)) return false;
    }
    if (activeXr.size) {
      const xrZones = new Set();
      if (r.cas_xr && r.cas_xr.zone) xrZones.add(String(r.cas_xr.zone));
      if (r.cas_xr && r.cas_xr.top) xrZones.add('xr-top');
      let ok = false;
      for (const z of activeXr) if (xrZones.has(z)) { ok = true; break; }
      if (!ok) return false;
    }
    if (activeAbdc.size) {
      const abdc = r.abdc && r.abdc.rating ? r.abdc.rating : '';
      if (!abdc || !activeAbdc.has(abdc)) return false;
    }
    if (activeAbs.size) {
      const abs = r.abs && r.abs.rating ? r.abs.rating : '';
      if (!abs || !activeAbs.has(abs)) return false;
    }
    if (activeFeats.has('if') && r.if_2024 == null) return false;
    if (activeIfMin > 0 && (r.if_2024 == null || +r.if_2024 < activeIfMin)) return false;
    if (activeFeats.has('ccf') && !r.ccf) return false;
    if (activeFeats.has('cnkx') && !(Array.isArray(r.cnkx) && r.cnkx.length)) return false;
    if (activeFeats.has('xr') && !r.cas_xr) return false;
    if (activeFeats.has('flagship') && !r.flagship) return false;
    if (activeFeats.has('scopus') && !(r.scopus && r.scopus.active)) return false;
    if (activeFeats.has('oaj') && !r.oaj) return false;
    if (activeFeats.has('doaj') && !r.doaj) return false;
    if (activeFeats.has('medline') && !r.medline) return false;
    if (activeFeats.has('cscd') && !r.cscd) return false;
    if (activeFeats.has('cstpcd') && !r.cstpcd) return false;
    if (activeFeats.has('free') && (!canSeePublishFeeInfo() || !isFreeToPublish(r))) return false;
    if (activeFeats.has('warning') && !r.warning) return false;
    if (activeFeats.has('citic_warning') && !r.citic_warning) return false;
    if (activeFeats.has('under_review') && !r.under_review) return false;
    if (activeFeats.has('on_hold') && !r.on_hold) return false;
    if (activeFeats.has('abdc') && !(r.abdc && r.abdc.rating)) return false;
    if (activeFeats.has('abs')  && !(r.abs  && r.abs.rating))  return false;
    if (activeCat !== '__all' && r.esi_category !== activeCat) return false;
    if (activeTopics.size) {
      const wc = r.wos_categories || [];
      let ok = false;
      for (const c of wc) if (activeTopics.has(c)) { ok = true; break; }
      if (!ok) {
        // Also check OpenAlex subfields
        const issn = (r.issn || r.eissn || '').toUpperCase();
        const rec = oaMap && oaMap[issn];
        const sf = (rec && Array.isArray(rec.sf)) ? rec.sf : [];
        for (const s of sf) if (activeTopics.has(s)) { ok = true; break; }
      }
      if (!ok) return false;
    }
    if (activeQuery) {
      return scoreRecord(r, activeQuery) > 0;
    }
    return true;
  }

  // 搜索排序：精确名 > ISSN > 手动 alias > 自动 acronym > 官方缩写 > 前缀 > 包含
  function scoreRecord(r, query) {
    const raw = (query||'').trim();
    const q = raw.toLowerCase();
    if (!q) return 1;
    const name = (r.name||'').toLowerCase();
    const abbr = (r.abbr20||'').toLowerCase();
    const cn = (r.cn_name||'').toLowerCase();
    const en = (r.en_name||'').toLowerCase();
    const issn = (r.issn||'').toLowerCase();
    const eissn = (r.eissn||'').toLowerCase();
    const publisher = (r.publisher||'').toLowerCase();
    const country = (r.country||'').toLowerCase();
    const meta = journalSearchMeta(r);
    const title = canonicalTitle(r.name || r.en_name || r.cn_name || '');
    const aliasTarget = aliasTargetForQuery(raw);
    const acronymQuery = normalizeAcronymQuery(raw);
    const compactIssn = raw.replace(/[^0-9x]/gi, '').toLowerCase();
    const issnCompact = issn.replace(/[^0-9x]/g, '');
    const eissnCompact = eissn.replace(/[^0-9x]/g, '');

    // 精确匹配（最高优先级）
    if (name === q) return 1000;
    if (issn === q || eissn === q || (compactIssn && (issnCompact === compactIssn || eissnCompact === compactIssn))) return 950;
    if (aliasTarget && aliasTarget === title) return 940;
    if (acronymQuery && acronymQuery.length <= 6 && meta.acronym === acronymQuery) return 930;
    if (abbr === q) return 900;
    if (cn === q) return 880;
    if (en === q) return 860;

    // 前缀匹配（"nature"→"Nature Cities"会命中前缀）
    if (name.startsWith(q + ' ') || name.startsWith(q + '-') || name.startsWith(q + ':')) {
      // 旗舰刊子刊更高
      let s = 800;
      if (r.flagship && /(_main|_sub)$/.test(r.flagship)) s += 50;
      // 子刊按字母排（顺序号其实由 sort 决定）
      return s;
    }
    if (cn.startsWith(q)) return 700;
    if (en.startsWith(q)) return 690;
    if (abbr.startsWith(q)) return 680;
    if (acronymQuery && acronymQuery.length >= 2 && acronymQuery.length <= 6 && meta.acronym.startsWith(acronymQuery)) return 660;

    // 词边界匹配（"cell"在"Cell Reports"中出现在词首）
    const wordRe = new RegExp('\\b' + escapeRegExp(q) + '\\b', 'i');
    if (wordRe.test(r.name||'')) return 500;
    if (wordRe.test(r.cn_name||'')) return 480;
    if (wordRe.test(r.en_name||'')) return 460;

    // 包含
    if (name.includes(q)) return 200;
    if (cn.includes(q)) return 180;
    if (en.includes(q)) return 160;
    if (acronymQuery && meta.aliasKeys.has(normalizeAliasKey(raw))) return 140;
    if (publisher.includes(q)) return 100;
    if (country.includes(q)) return 50;
    return 0;
  }

  function sortByIF(rows, dir) {
    if (!dir) return rows;
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const hasA = Number.isFinite(+a.if_2024);
      const hasB = Number.isFinite(+b.if_2024);
      // 缺失 IF 永远放末尾；升序时从最低 IF 开始，不让“—”顶到前面。
      if (hasA !== hasB) return hasA ? -1 : 1;
      const av = hasA ? +a.if_2024 : 0;
      const bv = hasB ? +b.if_2024 : 0;
      if (av !== bv) return sign * (av - bv);
      return (a.name || a.en_name || '').localeCompare(b.name || b.en_name || '');
    });
  }

  /* ───────── Update thead sticky top to clear the search bar ───────── */
  function updateThStickyTop() {
    const topbar = $('.topbar');
    if (topbar) {
      const h = topbar.getBoundingClientRect().height;
      const top = parseFloat(getComputedStyle(topbar).top) || 0;
      document.documentElement.style.setProperty('--th-sticky-top', Math.ceil(top + h) + 'px');
    }
  }

  function updateStickySearchState() {
    // 统一顶栏搜索：以全球站紧凑条（topbar-compact）为唯一标准
    // — 全球 / 中国 / 地区站 / 收藏 / 荐刊：始终同一位置与尺寸
    // — 首页落地（无搜索结果）：只保留首屏大搜索，滚动不吸顶、不往下挂搜索条
    // — 首页有搜索结果：收成紧凑顶栏
    // — 动态 / 详情：无顶栏搜索
    if (document.body.classList.contains('journal-route')) {
      document.body.classList.remove('topbar-compact');
      updateThStickyTop();
      placeLangToggle();
      return;
    }
    if (document.body.classList.contains('update-reading-mode') || activeTab === 'updates') {
      document.body.classList.remove('topbar-compact');
      updateThStickyTop();
      placeLangToggle();
      return;
    }
    const stationTab = ['int', 'dom', 'in', 'my', 'kr', 'pbn', 'isc', 'scielo'].includes(activeTab);
    const alwaysCompactTab = stationTab
      || activeTab === 'fav'
      || activeTab === 'pick';
    const homeLanding = activeTab === 'home'
      && !document.body.classList.contains('home-tab-has-results');
    // 首页落地：永不 compact（避免滚到 About 时搜索条被 order 挤到页面底部）
    // 其它业务页（含收藏、有结果的首页）始终紧凑 = 全球站标准
    let shouldCompact = false;
    if (alwaysCompactTab) {
      shouldCompact = true;
    } else if (activeTab === 'home') {
      shouldCompact = !homeLanding;
    }
    const changed = document.body.classList.toggle('topbar-compact', shouldCompact);
    if (changed) requestAnimationFrame(updateThStickyTop);
    else updateThStickyTop();
    placeLangToggle();
  }

  /** 首页落地：语言切嵌入 .home-top-nav 最右；其它页固定右上角 */
  function placeLangToggle() {
    const wrap = document.getElementById('lang-toggle-host')
      || document.querySelector('.lang-toggle-wrap');
    if (!wrap) return;
    const nav = document.querySelector('.home-top-nav');
    const inHomeLanding = document.body.classList.contains('home-route')
      && !document.body.classList.contains('home-tab-has-results')
      && !document.body.classList.contains('topbar-compact')
      && nav
      && getComputedStyle(nav).display !== 'none';
    if (inHomeLanding) {
      if (wrap.parentElement !== nav) nav.appendChild(wrap);
    } else {
      const host = document.querySelector('main.main') || document.body;
      if (wrap.parentElement !== host) host.appendChild(wrap);
    }
  }

  // 统计每个筛选项对应的期刊数量，注入到左侧筛选栏的 chip 里（参考图那样）
  function updateFilterCounts() {
    if (!journals || !journals.length) return;
    const counts = Object.create(null);
    const inc = (f, v) => { const k = f + ':' + v; counts[k] = (counts[k] || 0) + 1; };
    for (const r of journals) {
      (r.indices || []).forEach(i => inc('index', i));
      if (r.scopus && r.scopus.active) inc('feat', 'scopus');
      if (r.oaj) inc('feat', 'oaj');
      if (r.doaj) inc('feat', 'doaj');
      if (r.medline) inc('feat', 'medline');
      if (r.cscd) inc('feat', 'cscd');
      if (r.cstpcd) inc('feat', 'cstpcd');
      if (isFreeToPublish(r)) inc('feat', 'free');
      if (r.warning) inc('feat', 'warning');
      if (r.citic_warning) inc('feat', 'citic_warning');
      if (r.under_review) inc('feat', 'under_review');
      if (r.on_hold) inc('feat', 'on_hold');
      const jq = String(r.if_quartile || '').toUpperCase();
      if (/^Q[1-4]$/.test(jq)) inc('jcr', jq);
      if (r.cas_zone) inc('zone', String(r.cas_zone));
      if (r.cas_top) inc('zone', 'top');
      if (r.cas_xr && r.cas_xr.zone) inc('xr', String(r.cas_xr.zone));
      if (r.cas_xr && r.cas_xr.top) inc('xr', 'xr-top');
      const abdc = String((r.abdc && r.abdc.rating) || '').toUpperCase().replace(/A[ -]STAR/, 'A*');
      if (abdc) inc('abdc', abdc);
      const abs = String((r.abs && r.abs.rating) || '').toUpperCase();
      if (abs) inc('abs', abs);
    }
    document.querySelectorAll('.th-dropdown .th-chk[data-filter][data-value]').forEach(label => {
      const n = counts[label.dataset.filter + ':' + label.dataset.value] || 0;
      let badge = label.querySelector('.dd-count');
      if (!badge) { badge = document.createElement('span'); badge.className = 'dd-count'; label.appendChild(badge); }
      // 数量写入 data 与 title，默认隐藏，悬停再显示（避免按钮太乱）
      badge.textContent = n ? n.toLocaleString() : '';
      badge.hidden = !n;
      if (n) {
        label.title = `${label.querySelector('span:not(.dd-count)')?.textContent || label.dataset.value || ''} · ${n.toLocaleString()}`;
        badge.setAttribute('data-count', String(n));
      } else {
        label.removeAttribute('title');
        badge.removeAttribute('data-count');
      }
    });
  }

  function markJournalStatusFlags(rows, underReviewIssns = [], onHoldIssns = []) {
    const cleanSet = (arr) => new Set((arr || []).filter(Boolean).map(s => String(s).replace(/[^0-9xX]/gi, '').toLowerCase()));
    const underReviewSet = cleanSet(underReviewIssns);
    const onHoldSet = cleanSet(onHoldIssns);
    (rows || []).forEach(r => {
      const issnClean = (r.issn || '').replace(/[^0-9xX]/gi, '').toLowerCase();
      const eissnClean = (r.eissn || '').replace(/[^0-9xX]/gi, '').toLowerCase();
      if (underReviewSet.has(issnClean) || underReviewSet.has(eissnClean)) r.under_review = true;
      if (onHoldSet.has(issnClean) || onHoldSet.has(eissnClean)) r.on_hold = true;
    });
  }

  function refreshFavsDataFromJournals() {
    let dirty = false;
    for (const id of Object.keys(favsData)) {
      const live = journals.find(r => favId(r) === id);
      if (live && favsData[id]) {
        const oldName = favsData[id].name || '';
        const newName = live.name || '';
        if (oldName !== newName) {
          favsData[id] = { ...favsData[id], name: newName, cn_name: live.cn_name,
            en_name: live.en_name, abbr20: live.abbr20, if_2024: live.if_2024,
            cas_zone: live.cas_zone, cas_top: live.cas_top, indices: live.indices,
            flagship: live.flagship, nature_index: live.nature_index, esi_category: live.esi_category,
            if_quartile: live.if_quartile, publisher: live.publisher, ccf: live.ccf,
            scopus: live.scopus, warning: live.warning, under_review: live.under_review, on_hold: live.on_hold, citic_warning: live.citic_warning,
          };
          dirty = true;
        }
      }
    }
    if (dirty) localStorage.setItem(STORAGE_PREFIX + 'favsData', JSON.stringify(favsData));
  }

  function finalizeJournalDataset(rows, { full = false, underReviewIssns = [], onHoldIssns = [] } = {}) {
    journals = Array.isArray(rows) ? rows : [];
    markJournalStatusFlags(journals, underReviewIssns, onHoldIssns);
    journals.forEach(journalSearchMeta);
    buildIntIndex(journals);
    if (full) journalsReady = true;
    updateFilterCounts();
    refreshFavsDataFromJournals();
    const wc = Object.create(null);
    for (const r of journals) for (const c of (r.wos_categories || [])) wc[c] = (wc[c] || 0) + 1;
    topicList = Object.entries(wc).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    if (meta?.total && $('#total')) $('#total').textContent = meta.total.toLocaleString();
    const hint = $('#hint');
    if (hint) {
      const shownTotal = full && journals.length ? journals.length : (meta?.total || journals.length);
      hint.textContent = `${T('已加载','Loaded')} ${shownTotal.toLocaleString()} ${T('本期刊','journals')}`;
    }
    if (full) {
      renderCatList();
      renderTopicList();
      updatePublicPulse();
    }
  }

  function ensureJournalsLoaded() {
    if (journalsReady && journals.length) return Promise.resolve(journals);
    if (!journalsPromise) {
      journalsPromise = fetchJSON('data/journals.json.gz')
        .then(rows => {
          finalizeJournalDataset(rows, {
            full: true,
            underReviewIssns: window.__underReviewIssns || [],
            onHoldIssns: window.__onHoldIssns || [],
          });
          return journals;
        })
        .catch(err => {
          journalsPromise = null;
          throw err;
        });
    }
    return journalsPromise;
  }

  function renderAfterFullJournalLoad(tab = activeTab) {
    if (tab === 'int') renderInt();
    else if (tab === 'fav') renderFav();
    else if (tab === 'pick') initPickTool();
    updateStickySearchState();
  }

  function scheduleFullJournalWarmup() {
    if (journalsReady || journalsPromise) return;
    const warm = () => {
      if (activeTab !== 'home') return;
      if (typeof DecompressionStream !== 'function') return;
      ensureJournalsLoaded().catch(err => console.warn('Full journal warmup skipped:', err));
    };
    setTimeout(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 12000 });
      else warm();
    }, 10000);
  }

  function renderInt() {
    updateThStickyTop();
    if (activeQuery) activeWarnList = false; // 搜索即退出预警名单
    let filtered = journals.filter(matches);
    if (activeQuery) {
      // 按相关性排序
      const q = activeQuery;
      filtered = filtered
        .map(r => ({ r, s: scoreRecord(r, q) }))
        .sort((a, b) => {
          if (b.s !== a.s) return b.s - a.s;
          // 同分时：旗舰刊在前，再按 IF 倒序，最后按字母
          const fa = a.r.flagship ? 1 : 0;
          const fb = b.r.flagship ? 1 : 0;
          if (fa !== fb) return fb - fa;
          const ifa = a.r.if_2024 ?? -1;
          const ifb = b.r.if_2024 ?? -1;
          if (ifa !== ifb) return ifb - ifa;
          return (a.r.name||'').localeCompare(b.r.name||'');
        })
        .map(x => x.r);
    }
    if (activeQuery) {
      intIfSort = '';
    }
    // 不搜索时默认按影响因子倒序（=推荐期刊），而不是字母顺序
    const effIntSort = intIfSort || (activeQuery ? '' : 'desc');
    filtered = sortByIF(filtered, effIntSort);
    // 按浏览历史推荐：纯默认视图下，把用户近期看过的学科领域的期刊上浮（组内仍按 IF）
    if (!activeQuery && !intIfSort && !activeWarnList) {
      const pref = getPreferredCats();
      if (pref) {
        const inPref = [], rest = [];
        for (const r of filtered) {
          const cats = Array.isArray(r.wos_categories) ? r.wos_categories : [];
          (cats.some(c => pref.has(c)) ? inPref : rest).push(r);
        }
        if (inPref.length && rest.length) filtered = inPref.concat(rest);
      }
    }
    document.querySelector('th.col-if[data-if-sort="int"]')?.classList.toggle('sort-desc', intIfSort === 'desc');
    document.querySelector('th.col-if[data-if-sort="int"]')?.classList.toggle('sort-asc', intIfSort === 'asc');
    const intArrow = document.querySelector('th.col-if[data-if-sort="int"] .sort-arrow');
    if (intArrow) intArrow.textContent = intIfSort === 'asc' ? '▲' : '▼';
    $('#results-title').textContent = activeCat === '__all'
      ? t('results_all') : activeCat;
    const visible = filtered.slice(0, shown);
    const tbody = $('#tbody');
    if (!visible.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">${t('empty')}</td></tr>`;
    } else {
      tbody.innerHTML = visible.map(renderRow).join('');
    }
    $('#results-count').textContent = `${t('showing')} ${visible.length} ${t('of')} ${filtered.length.toLocaleString()} ${t('total_items')}`;
    const more = $('#more');
    more.hidden = filtered.length <= shown;
    syncThChkState();
  }

  // 同步题头复选框状态 + 更新按钮标签
  function syncThChkState() {
    document.querySelectorAll('.th-dropdown-panel .th-chk').forEach(label => {
      const cb = label.querySelector('input[type=checkbox]');
      if (!cb) return;
      const filter = label.dataset.filter;
      const val = label.dataset.value;
      let checked = false;
      if (filter === 'index') checked = activeIndices.has(val);
      else if (filter === 'feat') checked = activeFeats.has(val);
      else if (filter === 'jcr') checked = activeJcr.has(val);
      else if (filter === 'zone') checked = activeZones.has(val);
      else if (filter === 'xr') checked = activeXr.has(val);
      else if (filter === 'abdc') checked = activeAbdc.has(val);
      else if (filter === 'abs') checked = activeAbs.has(val);
      cb.checked = checked;
    });
    // 更新按钮标签（显示选中数量）
    document.querySelectorAll('.th-dropdown').forEach(dd => {
      const btn = dd.querySelector('.th-dropdown-btn');
      const panel = dd.querySelector('.th-dropdown-panel');
      if (!btn || !panel) return;
      const checkedCount = panel.querySelectorAll('.th-chk input[type=checkbox]:checked').length;
      const totalCount = panel.querySelectorAll('.th-chk input[type=checkbox]').length;
      const labelEl = btn.querySelector('.dd-label');
      if (!labelEl) return;
      const baseLabel = labelEl.textContent.replace(/\s*\(\d+\)\s*$/, '');
      if (checkedCount > 0 && checkedCount < totalCount) {
        labelEl.textContent = baseLabel + ' (' + checkedCount + ')';
        btn.classList.add('active');
      } else if (checkedCount === totalCount) {
        labelEl.textContent = baseLabel;
        btn.classList.remove('active');
      } else {
        labelEl.textContent = baseLabel;
        btn.classList.remove('active');
      }
    });
  }

  // 初始化题头下拉菜单（打开/关闭 + 点击外部关闭）
  function initThDropdowns() {
    // 按钮点击切换面板
    document.querySelectorAll('.th-dropdown-btn').forEach(btn => {
      if (btn.__ddBound) return;
      btn.__ddBound = true;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const panel = btn.parentElement.querySelector('.th-dropdown-panel');
        if (!panel) return;
        const wasOpen = panel.classList.contains('open');
        // 关闭所有其他面板
        document.querySelectorAll('.th-dropdown-panel.open').forEach(p => p.classList.remove('open'));
        if (!wasOpen) panel.classList.add('open');
      });
    });
    // 点击外部关闭所有面板
    document.addEventListener('click', () => {
      document.querySelectorAll('.th-dropdown-panel.open').forEach(p => p.classList.remove('open'));
    });
    // 点击面板内部不冒泡（防止点击复选框时关闭面板）
    document.querySelectorAll('.th-dropdown-panel').forEach(p => {
      p.addEventListener('click', e => e.stopPropagation());
    });
  }

  // ───────── category nav ─────────
  function renderCatList() {
    initThDropdowns();
    const total = $('#count-topic');
    if (total) total.textContent = topicList.length.toLocaleString();
    const allBtn = $('#topic-all-btn');
    if (allBtn && !allBtn.__bound) {
      allBtn.__bound = true;
      allBtn.addEventListener('click', () => {
        activeTopics.clear();
        $$('.wos-item').forEach(el => el.classList.remove('on'));
        $$('#topic-list input[type=checkbox]').forEach(cb => cb.checked = false);
        const inp = $('#topic-search'); if (inp) inp.value = '';
        renderTopicList();
        activeCat = '__all';
        shown = PAGE;
        renderInt();
      });
    }
    const clearBtn = $('#topic-clear');
    if (clearBtn && !clearBtn.__bound) {
      clearBtn.__bound = true;
      clearBtn.addEventListener('click', () => {
        activeTopics.clear();
        renderTopicList();
        shown = PAGE;
        renderInt();
      });
    }
    // 表头学科复选面板：渲染 topicList 复选列表（支持中英文搜索）
    const topicPanel = $('#topic-dd-list');
    if (topicPanel) {
      const raw = ($('#topic-dd-search')?.value || '').trim().toLowerCase();
      const tokens = expandWosQuery(raw);
      const filtered = !tokens.length
        ? topicList
        : topicList.filter(t => tokens.some(tok => t.name.toLowerCase().includes(tok)));
      topicPanel.innerHTML = filtered.map(t =>
        `<label class="th-chk" data-filter="topic" data-value="${escape(t.name)}">
           <input type="checkbox" ${activeTopics.has(t.name) ? 'checked' : ''}>
           <span>${escape(t.name)}</span>
           <span class="count">${t.count.toLocaleString()}</span>
         </label>`
      ).join('');
    }
    // 同步题头复选框状态与 Sets 一致
    syncThChkState();
    // 题头下拉复选框筛选：事件委托（支持动态渲染的 checkbox）
    ['idx-panel','jcr-panel','cas-panel','xr-panel','abdc-panel','abs-panel','warn-panel','topic-panel'].forEach(panelId => {
      const pnl = $(`#${panelId}`);
      if (!pnl || pnl.__bound) return;
      pnl.__bound = true;
      pnl.addEventListener('change', (e) => {
        const cb = e.target;
        if (cb.tagName !== 'INPUT' || cb.type !== 'checkbox') return;
        const label = cb.closest('label.th-chk');
        if (!label) return;
        const filter = label.dataset.filter;
        const val = label.dataset.value;
        if (filter === 'index') {
          if (cb.checked) activeIndices.add(val);
          else activeIndices.delete(val);
        } else if (filter === 'feat') {
          if (cb.checked) activeFeats.add(val);
          else activeFeats.delete(val);
        } else if (filter === 'jcr') {
          if (cb.checked) activeJcr.add(val);
          else activeJcr.delete(val);
        } else if (filter === 'zone') {
          if (cb.checked) activeZones.add(val);
          else activeZones.delete(val);
        } else if (filter === 'xr') {
          if (cb.checked) activeXr.add(val);
          else activeXr.delete(val);
        } else if (filter === 'abdc') {
          if (cb.checked) activeAbdc.add(val);
          else activeAbdc.delete(val);
        } else if (filter === 'abs') {
          if (cb.checked) activeAbs.add(val);
          else activeAbs.delete(val);
        } else if (filter === 'topic') {
          if (cb.checked) activeTopics.add(val);
          else activeTopics.delete(val);
        }
        activeWarnList = false; // 手动调筛选即退出预警名单
        shown = PAGE;
        renderInt();
      });
    });
  }


  // WoS 细分学科常用中文别名 → 英文关键词（供搜索时跨语言匹配）
  const WOS_ZH_ALIAS = {
    '建筑': 'architecture',
    '城市': 'urban',
    '规划': 'planning',
    '土木': 'civil',
    '结构': 'construction',
    '环境': 'environment',
    '生态': 'ecology',
    '能源': 'energy',
    '可持续': 'green sustain',
    '交通': 'transportation',
    '水': 'water',
    '地理': 'geography',
    '地质': 'geology',
    '地球': 'earth',
    '海洋': 'oceanography marine',
    '气象': 'meteorology',
    '气候': 'climate',
    '材料': 'materials',
    '化学': 'chemistry',
    '物理': 'physics',
    '数学': 'mathematics',
    '统计': 'statistics',
    '计算机': 'computer',
    '人工智能': 'artificial intelligence',
    '信息': 'information',
    '软件': 'software',
    '电子': 'electronic',
    '电气': 'electrical',
    '通信': 'telecommunications',
    '自动化': 'automation control',
    '机械': 'mechanical engineering',
    '工程': 'engineering',
    '工业': 'industrial',
    '制造': 'manufacturing',
    '航空': 'aerospace',
    '生物': 'biology biological',
    '生化': 'biochemistry',
    '生态学': 'ecology',
    '医学': 'medicine medical',
    '临床': 'clinical',
    '外科': 'surgery',
    '内科': 'medicine general internal',
    '神经': 'neuro neurology',
    '心血管': 'cardiac cardiovascular',
    '肿瘤': 'oncology',
    '免疫': 'immunology',
    '药理': 'pharmacology',
    '药学': 'pharmacy',
    '护理': 'nursing',
    '公共卫生': 'public health',
    '心理': 'psychology psychiatry',
    '社会': 'social sociology',
    '经济': 'economics',
    '管理': 'management',
    '商业': 'business',
    '金融': 'finance',
    '教育': 'education',
    '法学': 'law',
    '法律': 'law',
    '历史': 'history',
    '哲学': 'philosophy',
    '语言': 'linguistics language',
    '文学': 'literature',
    '艺术': 'art',
    '考古': 'archaeology',
    '人类学': 'anthropology',
    '政治': 'political',
    '传播': 'communication',
    '体育': 'sport',
    '食品': 'food',
    '农业': 'agricultur',
    '园艺': 'horticulture',
    '林业': 'forestry',
    '动物': 'animal zoology',
    '植物': 'plant botany',
    '微生物': 'microbiology',
  };

  function expandWosQuery(raw) {
    const q = (raw || '').trim().toLowerCase();
    if (!q) return [];
    // 英文直接走原样；中文走映射；混合就两路都收
    const expanded = new Set();
    expanded.add(q);
    Object.keys(WOS_ZH_ALIAS).forEach(zh => {
      if (q.includes(zh)) {
        WOS_ZH_ALIAS[zh].split(/\s+/).forEach(en => en && expanded.add(en));
      }
    });
    return [...expanded];
  }

  function renderTopicList() {
    const box = $('#topic-list');
    if (!box || !topicList.length) return;
    const raw = ($('#topic-search')?.value || '').trim().toLowerCase();
    const tokens = expandWosQuery(raw);
    const filtered = !tokens.length
      ? topicList
      : topicList.filter(c => {
          const name = c.name.toLowerCase();
          return tokens.some(t => name.includes(t));
        });
    const total = topicList.length;
    const totalEl = $('#count-topic');
    if (totalEl) totalEl.textContent = total.toLocaleString();
    box.innerHTML = filtered.map(c =>
      `<label class="wos-item${activeTopics.has(c.name) ? ' on' : ''}">
         <input type="checkbox" value="${escape(c.name)}" ${activeTopics.has(c.name) ? 'checked' : ''}>
         <span class="wos-name">${escape(c.name)}</span>
         <span class="wos-count">${c.count}</span>
       </label>`
    ).join('');
    // bind change
    box.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) activeTopics.add(cb.value); else activeTopics.delete(cb.value);
        cb.closest('.wos-item').classList.toggle('on', cb.checked);
        shown = PAGE;
        renderInt();
      });
    });
  }

  /** 中国站目录列表（仅左侧筛选，不再放顶栏横排按钮） */
  function domCatalogItems() {
    return [
      ['cnki_major', T('中文期刊目录','Chinese Journal Directory')],
      ['nsfc_mgmt', T('国自然管理','NSFC Mgmt')],
      ['cscd', 'CSCD'],
      ['cstpcd', T('中国科技核心','CSTPCD')],
      ['cnkx', T('中国科协','CAST')],
      ['zju_zju', T('浙江大学','ZJU')],
      ['school_a', T('学校目录','School')],
    ];
  }

  function domCatalogRailGroupHTML() {
    if (activeTab !== 'dom') return '';
    const chips = domCatalogItems().map(([key, label]) =>
      `<button type="button" class="dom-filter-chip${activeDom === key ? ' on' : ''}" data-dom-switch="${key}">${escape(label)}</button>`
    ).join('');
    return `<div class="dom-filter-group">
      <div class="dom-filter-label">${T('目录','Catalog')}</div>
      <div class="dom-filter-chips">${chips}</div>
    </div>`;
  }

  function domSectionHeader(title, subtitle = '') {
    // 顶栏只保留标题/副标题，目录切换统一在左侧筛选轨
    return `<div class="dom-section-head">
      <div class="dom-section-copy">
        <h1 class="section-title">${title}</h1>
        ${subtitle ? `<div class="section-subtitle">${subtitle}</div>` : ''}
      </div>
    </div>`;
  }

  /** 把国内子目录主体包进「左侧目录 + 右侧内容」布局 */
  function wrapDomBrowse(mainHtml) {
    return `<div class="dom-browse">
      <aside class="dom-filter-rail" aria-label="${T('筛选','Filters')}">
        ${domCatalogRailGroupHTML()}
      </aside>
      <div class="dom-filter-main">${mainHtml}</div>
    </div>`;
  }

  function countrySectionHeader(title, subtitle = '') {
    return `<div class="dom-section-head">
      <div class="dom-section-copy">
        <h1 class="section-title">${title}</h1>
        ${subtitle ? `<div class="section-subtitle">${subtitle}</div>` : ''}
      </div>
    </div>`;
  }

  // ───────── domestic unified search (query 时聚合所有库) ─────────
  function renderDomesticUnified(box, q) {
    const sections = [];
    const matchTxt = (...parts) => parts.filter(Boolean).join(' ').toLowerCase().includes(q);

    // 1) 中国科协 (CAST)
    if (domestic.cnkx && domestic.cnkx.records) {
      const recs = domestic.cnkx.records.filter(r =>
        r.tier && /^T[123]$/.test(r.tier) &&
        matchTxt(r.name, r.issn, r.domain, r.subdomain)
      );
      if (recs.length) {
        sections.push({
          title: T('中国科协高质量目录','CAST Tiered Directory'),
          count: recs.length,
          html: `<div class="table-wrap"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>
          ${recs.slice(0, 200).map(r => renderDomRow(r, {
            src: 'cnkx', showTier: true, tierValue: r.tier,
            metaHtml: (r.subdomain ? jMetaChip(tn(r.subdomain, 'sub') || r.subdomain, 'j-meta-topic-show') : ''),
          })).join('')}
          ${recs.length > 200 ? `<tr><td class="empty">${T('仅显示前 200 条','First 200 only')}</td></tr>` : ''}
          </tbody></table></div>`
        });
      }
    }

    // 1b) 国家自然科学基金委管理科学部 A/B 类
    if (domestic.nsfc_mgmt && domestic.nsfc_mgmt.records) {
      const recs = domestic.nsfc_mgmt.records.filter(r => matchTxt(r.name, r.tier, r.frequency));
      if (recs.length) {
        sections.push({
          title: T('国自然管理科学部期刊目录','NSFC Management Science Journal List'),
          count: recs.length,
          html: `<div class="table-wrap"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>
          ${recs.slice(0, 200).map(r => renderDomRow(r, {
            src: 'nsfc_mgmt', showTier: true, tierValue: r.tier,
            metaHtml: (r.frequency ? jMetaChip(r.frequency, 'j-meta-freq') : ''),
          })).join('')}
          ${recs.length > 200 ? `<tr><td class="empty">${T('仅显示前 200 条','First 200 only')}</td></tr>` : ''}
          </tbody></table></div>`
        });
      }
    }

    // 1c) CSCD 来源期刊
    if (domestic.cscd && domestic.cscd.records) {
      const recs = domestic.cscd.records.filter(r =>
        matchTxt(r.name, r.issn, r.cn_code, r.database, r.database_label)
      );
      if (recs.length) {
        sections.push({
          title: 'CSCD 来源期刊目录',
          count: recs.length,
          html: `<div class="table-wrap"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>
          ${recs.slice(0, 200).map(r => {
            const fid = favId(r);
            rowRecordsByFid[fid] = { ...r, __src: 'cscd' };
            const code = String(r.database || '').toUpperCase();
            const label = code === 'C' ? 'CSCD-C' : (code === 'E' ? 'CSCD-E' : 'CSCD');
            const crossBadges = renderDomCrossBadges(r, 'cscd');
            return journalCardRow({
              fid, src: 'cscd',
              favHtml: starBtn(r, 'cscd'),
              nameHtml: `<div class="jname">${escape(r.name||'')}</div>`,
              metaHtml: [
                r.issn ? jMetaChip(`ISSN ${r.issn}`, 'j-meta-id') : '',
                r.cn_code ? jMetaChip(`CN ${r.cn_code}`, 'j-meta-id') : '',
              ].filter(Boolean).join(''),
              bodyHtml: `<div class="j-card-badges badges"><span class="domsrc-pill ds-cscd">${label}</span>${limitBadgeHtml(crossBadges, 5)}</div>`,
            });
          }).join('')}
          ${recs.length > 200 ? `<tr><td class="empty">${T('仅显示前 200 条','First 200 only')}</td></tr>` : ''}
          </tbody></table></div>`
        });
      }
    }

    // 1d) 中国科技核心期刊
    if (domestic.cstpcd && domestic.cstpcd.records) {
      const recs = domestic.cstpcd.records.filter(r =>
        matchTxt(r.name, r.code, r.kind)
      );
      if (recs.length) {
        sections.push({
          title: T('中国科技核心期刊目录','Chinese Science and Technology Core Journals'),
          count: recs.length,
          html: `<div class="table-wrap"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>
          ${recs.slice(0, 200).map(r => {
            const fid = favId(r);
            rowRecordsByFid[fid] = { ...r, __src: 'cstpcd' };
            const label = r.kind === 'popular_science' ? T('中国科技核心·科普','CSTPCD Popular') : T('中国科技核心','CSTPCD');
            const crossBadges = renderDomCrossBadges(r, 'cstpcd');
            return journalCardRow({
              fid, src: 'cstpcd',
              favHtml: starBtn(r, 'cstpcd'),
              nameHtml: `<div class="jname">${escape(r.name||'')}</div>`,
              metaHtml: r.code ? jMetaChip(r.code, 'j-meta-id') : '',
              bodyHtml: `<div class="j-card-badges badges"><span class="domsrc-pill ds-cstpcd">${label}</span>${limitBadgeHtml(crossBadges, 5)}</div>`,
            });
          }).join('')}
          ${recs.length > 200 ? `<tr><td class="empty">${T('仅显示前 200 条','First 200 only')}</td></tr>` : ''}
          </tbody></table></div>`
        });
      }
    }

    // 2) 中文期刊目录 (CNKI Major)
    if (domestic.cnki_major && domestic.cnki_major.records) {
      const list = domestic.cnki_major.records.filter(r =>
        matchTxt(r.name, r.issn, r.cn_code, r.sponsor, r.category, r.category_code, ...(r.major_categories||[]), ...(r.categories||[]))
      );
      if (list.length) {
        sections.push({
          title: T('中文期刊目录','Chinese Journal Directory'),
          count: list.length,
          html: `<div class="table-wrap"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>
          ${list.slice(0, 200).map(r => {
            const cnkiBadge = `<span class="domsrc-pill ds-cnki_major" title="${T('中国知网中文期刊目录收录','Listed in CNKI Chinese journal directory')}">${T('知网','CNKI')}</span>`;
            const crossBadges = renderDomCrossBadges(r, 'cnki_major');
            const displayCats = (r.major_categories || []).length ? r.major_categories : (r.categories || []);
            const catLine = displayCats.slice(0, 2).join(' · ');
            return journalCardRow({
              fid: favId(r), src: 'cnki_major',
              favHtml: starBtn(r, 'cnki_major'),
              nameHtml: `<div class="jname">${escape(r.name||'')}</div>`,
              metaHtml: [
                catLine ? jMetaChip(catLine, 'j-meta-topic-show') : '',
                r.issn ? jMetaChip(`ISSN ${r.issn}`, 'j-meta-id') : '',
                r.cn_code ? jMetaChip(`CN ${r.cn_code}`, 'j-meta-id') : '',
              ].filter(Boolean).join(''),
              bodyHtml: `<div class="j-card-badges badges">${cnkiBadge}${limitBadgeHtml(crossBadges, 6)}</div>`,
            });
          }).join('')}
          ${list.length > 200 ? `<tr><td class="empty">${T('仅显示前 200 条','First 200 only')}</td></tr>` : ''}
          </tbody></table></div>`
        });
      }
    }

    // 3) 浙大目录
    if (domestic.zju && domestic.zju.records) {
      const list = domestic.zju.records.filter(r => matchTxt(r.name, r.issn, r.cn_code));
      if (list.length) {
        const tierClass = {'一级':'t1','核心':'t2','其他':'t3'};
        sections.push({
          title: T('浙江大学 2024 期刊分级','ZJU 2024 Journal Tiers'),
          count: list.length,
          html: `<div class="table-wrap"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>
          ${list.slice(0, 200).map(r => {
            const tierBadge = `<span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(tn(r.tier, 'tier'))}</span>${(r.name||'').includes('*') ? ' <span class="warn-pill" style="background:var(--gold);color:#fff">★</span>' : ''}`;
            return renderDomRow(
              { ...r, name: (r.name||'').replace(/\*$/,'') },
              {
                src: 'zju',
                extraBadges: tierBadge,
                metaHtml: r.note ? jMetaChip(r.note, 'j-meta-note') : '',
              }
            );
          }).join('')}
          ${list.length > 200 ? `<tr><td class="empty">${T('仅显示前 200 条','First 200 only')}</td></tr>` : ''}
          </tbody></table></div>`
        });
      }
    }

    // 4) 学校A（已解锁）
    if (domestic.school_a && isUnlocked('school_a')) {
      const list = unlockedCache.school_a || [];
      const f = list.filter(r => matchTxt(r.name, r.issn, r.cn_code));
      if (f.length) {
        const tierClass = {'一级':'t1','核心':'t2','其他':'t3'};
        sections.push({
          title: T('高校自编目录 · 2023','School A · 2023'),
          count: f.length,
          html: `<div class="table-wrap"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>
          ${f.slice(0, 200).map(r => {
            const tierBadge = `<span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(tn(r.tier, 'tier'))}</span>`;
            return renderDomRow(
              { ...r, name: (r.name||'').replace(/\*$/,'') },
              { src: 'school_a', extraBadges: tierBadge }
            );
          }).join('')}
          ${f.length > 200 ? `<tr><td class="empty">${T('仅显示前 200 条','First 200 only')}</td></tr>` : ''}
          </tbody></table></div>`
        });
      }
    }

    const total = sections.reduce((s, x) => s + x.count, 0);
    if (!sections.length) {
      box.innerHTML = `<div class="section-block"><div class="empty">${T('未找到与"','No matches for "')}${escape(activeQuery)}${T('"匹配的中文期刊。','".')}</div></div>`;
      return;
    }
    box.innerHTML = `<div class="section-block">
      ${domSectionHeader(
        `${T('中文期刊统一搜索','Chinese Journals · Unified Search')} <span class="muted-cell">(${total})</span>`,
        T('已跨库聚合：科协 / 中文期刊目录 / 浙大 / 学校 A。CSSCI、北大核心、CCF 中文以徽章形式展示。清空搜索框可返回单库浏览。','Aggregated across CAST / Chinese Journal Directory / ZJU / School A. CSSCI, PKU Core, CCF Chinese shown as badges. Clear the search box to return to per-source view.'),
      )}
      ${sections.map(s => `<details class="section-block" style="margin-top:14px" open>
        <summary>${escape(s.title)} <span class="muted-cell">(${s.count})</span></summary>
        <div style="margin-top:10px">${s.html}</div>
      </details>`).join('')}
    </div>`;
  }

  // ───────── India tab ─────────
  function renderIndia() {
    updateThStickyTop();
    const box = $('#india-content');
    if (!box) return;
    if (!india || !Array.isArray(india.records)) {
      box.innerHTML = `<div class="empty">${T('正在加载印度期刊数据…','Loading India journal data…')}</div>`;
      loadIndiaData().then((data) => {
        if (!data || !Array.isArray(data.records)) {
          box.innerHTML = `<div class="empty">${T('印度期刊数据缺失','India journal data missing')}</div>`;
          return;
        }
        if (activeTab === 'in') renderIndia();
      });
      return;
    }
    if (!window.__indiaShown) window.__indiaShown = 100;
    const q = activeQuery.toLowerCase();
    const subjects = (india.subjects || []).map(s => s.name).filter(Boolean);
    const subjectOptions = subjects.map(s => `<option value="${escape(s)}"${activeIndiaSubject === s ? ' selected' : ''}>${escape(s)}</option>`).join('');
    let filtered = india.records.filter(r => {
      if (activeIndiaSubject !== '__all' && r.subject !== activeIndiaSubject) return false;
      if (!q) return true;
      const hay = [r.journal_title, r.publisher, r.issn, r.eissn, r.subject, r.ugc_care_coverage_year, r.details].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    filtered.sort((a, b) => (a.journal_title || '').localeCompare(b.journal_title || '', 'en'));
    const visible = filtered.slice(0, window.__indiaShown);
    const total = filtered.length;
    const rows = visible.map(r => {
      const rec = { ...r, name: r.journal_title, __src: 'in' };
      const fid = favId(rec);
      rowRecordsByFid[fid] = rec;
      const historical = r.list_status === 'historical';
      const sourceLabel = historical ? T('UGC-CARE · 历史', 'UGC-CARE · Historical') : 'UGC-CARE';
      const sourceDetail = [r.ugc_care_coverage_year, r.details].filter(Boolean).join(' · ');
      const nameHtml = `<div class="jname">${escape(titleCase(r.journal_title || ''))}</div>`;
      const metaHtml = [
        jMetaChip(r.publisher || '', 'j-meta-pub'),
        r.issn && r.issn !== 'NA' ? jMetaChip(`ISSN ${r.issn}`, 'j-meta-id') : '',
      ].filter(Boolean).join('');
      const bodyHtml = `
        <div class="j-card-badges badges"><span class="domsrc-pill ds-india"${sourceDetail ? ` title="${escape(sourceDetail)}"` : ''}>${sourceLabel}</span></div>
        ${r.subject ? `<div class="j-card-subline">${escape(r.subject)}</div>` : ''}`;
      return journalCardRow({
        fid, src: 'in', extraClass: 'india-row',
        favHtml: starBtn(rec, 'in'),
        nameHtml, metaHtml, bodyHtml,
      });
    }).join('');
    const subjectChips = [
      ['__all', T('全部学科','All subjects')],
      ...(subjects || []).slice(0, 40).map(s => [s, s]),
    ].map(([value, label]) => {
      const on = activeIndiaSubject === value;
      return `<button type="button" class="dom-filter-chip${on ? ' on' : ''}" data-india-subject="${escape(value)}">${escape(label)}</button>`;
    }).join('');
    box.innerHTML = `<div class="section-block india-section">
      ${countrySectionHeader(
        `${T('印度 UGC-CARE 期刊目录','India UGC-CARE Journal Directory')} <span class="muted-cell">(${india.records.length.toLocaleString()})</span>`,
        T(`现行目录 ${Number(india.counts?.current_directory || 0).toLocaleString()} 条；Sciences 历史表 ${Number(india.counts?.science_archive || 0).toLocaleString()} 条已补齐并去重。`, `Current directory: ${Number(india.counts?.current_directory || 0).toLocaleString()}; the complete ${Number(india.counts?.science_archive || 0).toLocaleString()}-row Sciences archive is merged and deduplicated.`)
          + ` · ${T('显示','Showing')} ${visible.length.toLocaleString()} / ${total.toLocaleString()}`,
      )}
      <div class="dom-browse">
        <aside class="dom-filter-rail" aria-label="${T('筛选','Filters')}">
          <div class="dom-filter-group">
            <div class="dom-filter-label">${T('学科','Subject')}</div>
            <div class="dom-filter-chips is-wrap">${subjectChips}</div>
          </div>
        </aside>
        <div class="dom-filter-main">
          <div class="table-wrap"><table class="journals india-table country-journal-table" aria-label="${T('印度 UGC-CARE 期刊','India UGC-CARE journals')}"><thead hidden><tr><th></th></tr></thead><tbody>
            ${rows}
            ${total === 0 ? `<tr><td colspan="3" class="empty">${T('未找到匹配的印度期刊','No matching India journals found')}</td></tr>` : ''}
          </tbody></table></div>
          ${total > window.__indiaShown ? `<div class="pager"><button id="india-more" class="more-btn">${T('加载更多','Load more')} (${total - window.__indiaShown} ${T('条剩余','remaining')})</button></div>` : ''}
          <div class="source-note">${t('india_source_note')}</div>
        </div>
      </div>
    </div>`;
    box.querySelectorAll('[data-india-subject]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeIndiaSubject = btn.getAttribute('data-india-subject') || '__all';
        window.__indiaShown = 100;
        renderIndia();
      });
    });
    $('#india-more')?.addEventListener('click', () => {
      window.__indiaShown += 100;
      renderIndia();
    });
  }

  // ───────── Malaysia tab ─────────
  function malaysiaSourceLabel(key) {
    return ({
      mycite_2025: 'MyCite 2025',
      mycite_online: 'MyCite Online 2014-2025',
      era_2023: 'ERA 2023',
    })[key] || key;
  }

  function renderMalaysia() {
    updateThStickyTop();
    const box = $('#malaysia-content');
    if (!box) return;
    if (!malaysia || !malaysia.records) {
      box.innerHTML = `<div class="empty">${t('loading')}</div>`;
      loadMalaysiaData().then(d => {
        if (activeTab !== 'my') return;
        if (d && d.records) renderMalaysia();
        else box.innerHTML = `<div class="empty">${T('马来西亚期刊数据缺失','Malaysia journal data missing')}</div>`;
      });
      return;
    }
    if (!window.__malaysiaShown) window.__malaysiaShown = 100;
    const sourceKey = malaysia.records[activeMalaysiaSource] ? activeMalaysiaSource : 'mycite_2025';
    const sourceRecords = malaysia.records[sourceKey] || [];
    const q = activeQuery.toLowerCase();
    let filtered = sourceRecords.filter(r => {
      if (!q) return true;
      const hay = [
        r.journal_title, r.foreign_title, r.publisher, r.issn, r.eissn,
        r.indexed_year, r.for_subjects, r.era_year, r.journal_id,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    filtered.sort((a, b) => (a.journal_title || '').localeCompare(b.journal_title || '', 'en'));
    const visible = filtered.slice(0, window.__malaysiaShown);
    const total = filtered.length;
    const sourceChips = ['mycite_2025', 'mycite_online', 'era_2023'].map(key => {
      const count = malaysia.counts?.[key] || (malaysia.records[key] || []).length;
      const on = sourceKey === key;
      return `<button type="button" class="dom-filter-chip${on ? ' on' : ''}" data-malaysia-source="${key}">${escape(malaysiaSourceLabel(key))} · ${Number(count).toLocaleString()}</button>`;
    }).join('');
    const rows = visible.map(r => {
      const rec = { ...r, name: r.journal_title, __src: 'my' };
      const fid = favId(rec);
      rowRecordsByFid[fid] = rec;
      const pubOrSubject = sourceKey === 'era_2023'
        ? (r.for_subjects || r.foreign_title || '')
        : (r.publisher || '');
      const yearCell = sourceKey === 'era_2023'
        ? (r.era_year || '2023')
        : (r.indexed_year || '');
      const nameHtml = `<div class="jname">${escape(titleCase(r.journal_title || ''))}</div>`;
      const metaHtml = [
        jMetaChip(pubOrSubject, 'j-meta-pub'),
        yearCell ? jMetaChip(String(yearCell), 'j-meta-year') : '',
        r.issn ? jMetaChip(`ISSN ${r.issn}`, 'j-meta-id') : '',
      ].filter(Boolean).join('');
      const bodyHtml = `<div class="j-card-badges badges"><span class="domsrc-pill ds-malaysia">${escape(malaysiaSourceLabel(sourceKey))}</span></div>`;
      return journalCardRow({
        fid, src: 'my', extraClass: 'malaysia-row',
        favHtml: starBtn(rec, 'my'),
        nameHtml, metaHtml, bodyHtml,
      });
    }).join('');
    const yearCounts = malaysia.counts?.mycite_online_years || {};
    const years = Object.keys(yearCounts).length
      ? `<div class="source-note">${T('MyCite 在线库年份分布：','MyCite online year distribution: ')}${Object.entries(yearCounts).map(([y, c]) => `${escape(y)}: ${Number(c).toLocaleString()}`).join(' · ')}</div>`
      : '';
    box.innerHTML = `<div class="section-block malaysia-section">
      ${countrySectionHeader(
        `${t('hero_title_my')} <span class="muted-cell">(${Number(malaysia.counts?.mycite_2025 || 0).toLocaleString()} / ${Number(malaysia.counts?.era_2023 || 0).toLocaleString()})</span>`,
        t('hero_body_my') + ` · ${T('显示','Showing')} ${visible.length.toLocaleString()} / ${total.toLocaleString()}`,
      )}
      <div class="dom-browse">
        <aside class="dom-filter-rail" aria-label="${T('筛选','Filters')}">
          <div class="dom-filter-group">
            <div class="dom-filter-label">${T('来源','Source')}</div>
            <div class="dom-filter-chips is-wrap">${sourceChips}</div>
          </div>
          ${malaysia.official_pdf?.url ? `<div class="dom-filter-group"><a class="source-link" href="${escape(malaysia.official_pdf.url)}" target="_blank" rel="noopener nofollow">MyCite 2025 PDF</a></div>` : ''}
        </aside>
        <div class="dom-filter-main">
          <div class="table-wrap"><table class="journals malaysia-table country-journal-table" aria-label="${T('马来西亚期刊','Malaysia journals')}"><thead hidden><tr><th></th></tr></thead><tbody>
            ${rows}
            ${total === 0 ? `<tr><td class="empty">${T('未找到匹配的马来西亚/ERA 期刊','No matching Malaysia / ERA journals found')}</td></tr>` : ''}
          </tbody></table></div>
          ${total > window.__malaysiaShown ? `<div class="pager"><button id="malaysia-more" class="more-btn">${T('加载更多','Load more')} (${total - window.__malaysiaShown} ${T('条剩余','remaining')})</button></div>` : ''}
          <div class="source-note">${t('malaysia_source_note')}</div>
          ${years}
        </div>
      </div>
    </div>`;
    box.querySelectorAll('[data-malaysia-source]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeMalaysiaSource = btn.dataset.malaysiaSource || 'mycite_2025';
        window.__malaysiaShown = 100;
        renderMalaysia();
      });
    });
    $('#malaysia-more')?.addEventListener('click', () => {
      window.__malaysiaShown += 100;
      renderMalaysia();
    });
  }

  function koreaStatusLabel(status) {
    return ({
      '우수등재': T('KCI 优秀期刊','KCI Excellent'),
      '등재': T('KCI 收录','KCI Indexed'),
      '등재후보': T('KCI 候选','KCI Candidate'),
    })[status] || status || 'KCI';
  }

  function koreaSubjectLabel(subject) {
    return ({
      '인문학': T('人文学','Humanities'),
      '사회과학': T('社会科学','Social sciences'),
      '자연과학': T('自然科学','Natural sciences'),
      '공학': T('工学','Engineering'),
      '의약학': T('医药学','Medicine'),
      '농수해양학': T('农林水产海洋','Agriculture & marine'),
      '예술체육학': T('艺术体育','Arts & sports'),
      '복합학': T('交叉学科','Interdisciplinary'),
    })[subject] || subject || '—';
  }

  function renderKorea() {
    updateThStickyTop();
    const box = $('#korea-content');
    if (!box) return;
    if (!korea || !Array.isArray(korea.records)) {
      box.innerHTML = `<div class="empty">${T('正在加载韩国 KCI 期刊数据…','Loading Korea KCI journal data…')}</div>`;
      loadKoreaData().then(data => {
        if (activeTab !== 'kr') return;
        if (data && Array.isArray(data.records)) renderKorea();
        else box.innerHTML = `<div class="empty">${T('韩国 KCI 期刊数据缺失','Korea KCI journal data missing')}</div>`;
      });
      return;
    }
    if (!window.__koreaShown) window.__koreaShown = 100;
    const q = activeQuery.trim().toLowerCase();
    const subjects = (korea.subjects || []).map(item => item.name).filter(Boolean);
    const statuses = ['우수등재', '등재', '등재후보'].filter(status => korea.counts?.status?.[status]);
    const filtered = korea.records.filter(r => {
      if (activeKoreaSubject !== '__all' && r.subject_group !== activeKoreaSubject) return false;
      if (activeKoreaStatus !== '__all' && r.status !== activeKoreaStatus) return false;
      if (!q) return true;
      const hay = [
        r.journal_title, r.journal_title_ko, r.journal_title_en,
        r.publisher, r.publisher_ko, r.issn, r.eissn,
        r.subject_group, r.subject, r.affiliated_university,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    const visible = filtered.slice(0, window.__koreaShown);
    const rows = visible.map(r => {
      const rec = {
        ...(r.global || {}),
        ...r,
        name: r.journal_title || r.journal_title_en || r.journal_title_ko,
        en_name: r.journal_title_ko || '',
        discipline: r.subject || r.subject_group || '',
        country: 'South Korea',
        __src: 'kr',
      };
      const fid = favId(rec);
      rowRecordsByFid[fid] = rec;
      const globalBadges = [renderCoverageBadges(rec), renderLevelBadges(rec)].filter(Boolean).join('');
      const ifValue = r.kci_if_2y !== undefined && r.kci_if_2y !== ''
        ? Number(r.kci_if_2y).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
        : '';
      const nameHtml = `<div class="jname">${escape(titleCase(rec.name || ''))}${r.journal_title_ko && r.journal_title_ko !== rec.name ? `<span class="jname-cn">${escape(r.journal_title_ko)}</span>` : ''}</div>`;
      const pub = r.publisher || r.publisher_ko || '';
      const metaHtml = [jMetaChip(pub, 'j-meta-pub')].filter(Boolean).join('');
      const subjectLine = [
        koreaSubjectLabel(r.subject_group),
        r.subject && r.subject !== r.subject_group ? r.subject : '',
      ].filter(Boolean).join(' · ');
      const bodyHtml = `
        <div class="j-card-badges">
          <div class="badges badges-idx"><span class="domsrc-pill ds-korea">${escape(koreaStatusLabel(r.status))}</span>${limitBadgeHtml(renderCoverageBadges(rec), 5)}</div>
          <div class="badges badges-rank">${limitBadgeHtml(renderLevelBadges(rec), 4)}</div>
          ${subjectLine ? `<div class="j-card-subline">${escape(subjectLine)}</div>` : ''}
        </div>`;
      return journalCardRow({
        fid, src: 'kr', extraClass: 'korea-row',
        favHtml: starBtn(rec, 'kr'),
        nameHtml,
        ifHtml: ifValue ? jMetaIf('KCI IF', ifValue) : '',
        metaHtml, bodyHtml,
      });
    }).join('');
    const sourceDate = korea.source_updated || '2025-08-25';
    const subjectChips = [
      ['__all', T('全部学科','All subjects')],
      ...subjects.slice(0, 36).map(s => [s, `${koreaSubjectLabel(s)}`]),
    ].map(([value, label]) => {
      const on = activeKoreaSubject === value;
      return `<button type="button" class="dom-filter-chip${on ? ' on' : ''}" data-korea-subject="${escape(value)}">${escape(label)}</button>`;
    }).join('');
    const statusChips = [
      ['__all', T('全部等级','All statuses')],
      ...statuses.map(s => [s, koreaStatusLabel(s)]),
    ].map(([value, label]) => {
      const on = activeKoreaStatus === value;
      return `<button type="button" class="dom-filter-chip${on ? ' on' : ''}" data-korea-status="${escape(value)}">${escape(label)}</button>`;
    }).join('');
    box.innerHTML = `<div class="section-block korea-section">
      ${countrySectionHeader(
        `${T('韩国 KCI 期刊目录','Korea KCI Journal Directory')} <span class="muted-cell">(${Number(korea.counts?.records || korea.records.length).toLocaleString()})</span>`,
        T('韩国研究财团 KCI 官方期刊与引文指标数据。','Official KCI journal and citation indicators from the National Research Foundation of Korea.')
          + ` · ${T('显示','Showing')} ${visible.length.toLocaleString()} / ${filtered.length.toLocaleString()}`,
      )}
      <div class="dom-browse">
        <aside class="dom-filter-rail" aria-label="${T('筛选','Filters')}">
          <div class="dom-filter-group">
            <div class="dom-filter-label">${T('KCI 等级','KCI status')}</div>
            <div class="dom-filter-chips">${statusChips}</div>
          </div>
          <div class="dom-filter-group is-subject">
            <div class="dom-filter-label">${T('学科','Subject')}</div>
            <div class="dom-filter-chips is-wrap">${subjectChips}</div>
          </div>
          <div class="dom-filter-group">
            <a class="source-link" href="${escape(korea.source_pages?.kci_journals || 'https://www.data.go.kr/data/3049043/fileData.do')}" target="_blank" rel="noopener nofollow">${T('官方数据','Official data')}</a>
          </div>
        </aside>
        <div class="dom-filter-main">
          <div class="table-wrap"><table class="journals korea-table country-journal-table" aria-label="${T('韩国 KCI 期刊','Korea KCI journals')}"><thead hidden><tr><th></th></tr></thead><tbody>
            ${rows}
            ${filtered.length === 0 ? `<tr><td class="empty">${T('未找到匹配的韩国期刊','No matching Korea journals found')}</td></tr>` : ''}
          </tbody></table></div>
          ${filtered.length > window.__koreaShown ? `<div class="pager"><button id="korea-more" class="more-btn">${T('加载更多','Load more')} (${filtered.length - window.__koreaShown} ${T('条剩余','remaining')})</button></div>` : ''}
          <div class="source-note">${T('来源：韩国研究财团 KCI 官方公开数据；数据日期','Source: official public KCI data from the National Research Foundation of Korea; source date')} ${escape(sourceDate)} · ${T('KCI IF 为 2 年影响力指数，不等同于 JCR Impact Factor。','KCI IF is the two-year KCI impact metric and is not the JCR Impact Factor.')}</div>
        </div>
      </div>
    </div>`;
    box.querySelectorAll('[data-korea-subject]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeKoreaSubject = btn.getAttribute('data-korea-subject') || '__all';
        window.__koreaShown = 100;
        renderKorea();
      });
    });
    box.querySelectorAll('[data-korea-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeKoreaStatus = btn.getAttribute('data-korea-status') || '__all';
        window.__koreaShown = 100;
        renderKorea();
      });
    });
    $('#korea-more')?.addEventListener('click', () => {
      window.__koreaShown += 100;
      renderKorea();
    });
  }

  const REGIONAL_DIRECTORY_CONFIG = {
    pbn: {
      title: ['波兰 PBN / POL-on 期刊目录', 'Poland PBN / POL-on Journal Directory'],
      intro: ['波兰科学与高等教育部 PBN 官方年度期刊清单；本页直接使用 2026 年目录。', 'The official 2026 annual journal list published through Poland\'s PBN system.'],
      badge: 'PBN / POL-on',
      metric: row => row.points == null ? '' : `${T('部委分值', 'Ministry points')} ${row.points}`,
    },
    isc: {
      title: ['ISC 期刊目录', 'ISC Master Journals List'],
      intro: ['伊斯兰世界科学引文中心（ISC）官方 Master Journals List。', 'The official Master Journals List from the Islamic World Science Citation Center.'],
      badge: 'ISC',
      metric: row => row.h_index == null ? '' : `ISC H-index ${row.h_index}`,
    },
    scielo: {
      title: ['SciELO 期刊目录', 'SciELO Journal Directory'],
      intro: ['SciELO 官方网络期刊清单，按各国家节点收录展示，不按全球库出版国家反推。', 'The official SciELO network list, shown by country nodes rather than inferring membership from the global database.'],
      badge: 'SciELO',
      metric: row => row.network ? row.network.replace(/^www\./, '') : '',
    },
  };

  function renderRegionalDirectory(source) {
    updateThStickyTop();
    const config = REGIONAL_DIRECTORY_CONFIG[source];
    const box = $(`#${source}-content`);
    if (!config || !box) return;
    const data = regionalDirectoryCache[source];
    if (!data || !Array.isArray(data.records)) {
      box.innerHTML = `<div class="empty">${T('正在加载官方目录…', 'Loading official directory…')}</div>`;
      loadRegionalDirectory(source).then(result => {
        if (activeTab !== source) return;
        if (result && Array.isArray(result.records)) renderRegionalDirectory(source);
        else box.innerHTML = `<div class="empty">${T('官方目录数据加载失败', 'Official directory data could not be loaded')}</div>`;
      });
      return;
    }
    window.__regionalShown ||= Object.create(null);
    window.__regionalShown[source] ||= 100;
    window.__regionalFilter ||= Object.create(null);
    window.__regionalFilter[source] ||= { points: '__all', match: '__all', network: '__all', hMin: 0 };
    const filt = window.__regionalFilter[source];
    if (filt.hMin == null || Number.isNaN(+filt.hMin)) filt.hMin = 0;
    // 兼容旧区间字段
    if (filt.hband && filt.hband !== '__all' && !(+filt.hMin > 0)) {
      const bandMap = { '0': 0, '20': 20, '50': 50, '100': 100 };
      if (bandMap[filt.hband] != null) filt.hMin = bandMap[filt.hband];
      delete filt.hband;
    }
    const q = activeQuery.trim().toLowerCase();
    const filtered = data.records.filter(row => {
      if (source === 'pbn' && filt.points !== '__all' && String(row.points) !== String(filt.points)) return false;
      if (source === 'scielo' && filt.network !== '__all' && String(row.network || '') !== String(filt.network)) return false;
      if (source === 'isc' && +filt.hMin > 0) {
        const h = Number(row.h_index);
        if (!Number.isFinite(h) || h < +filt.hMin) return false;
      }
      if (filt.match === 'yes' && !row.global_match) return false;
      if (filt.match === 'no' && row.global_match) return false;
      if (!q) return true;
      return [row.name, row.issn, row.eissn, row.network, row.points, row.h_index]
        .filter(value => value !== undefined && value !== null)
        .join(' ').toLowerCase().includes(q);
    });
    const shown = window.__regionalShown[source];
    const visible = filtered.slice(0, shown);
    const rows = visible.map(row => {
      try {
        const rec = { ...row, name: row.name || row.global_name || '', __src: source };
        // 把 indices 规范成数组，避免交叉徽章渲染异常
        if (rec.indices && !Array.isArray(rec.indices)) {
          rec.indices = String(rec.indices).split(/[,;|/]/).map(s => s.trim()).filter(Boolean);
        }
        const fid = favId(rec);
        rowRecordsByFid[fid] = rec;
        let cov = '', lvl = '';
        try {
          if (row.global_match) {
            cov = renderCoverageBadges(rec) || '';
            lvl = renderLevelBadges(rec) || '';
          }
        } catch (_) { cov = ''; lvl = ''; }
        const nameHtml = `<div class="jname">${escape(rec.name)}</div>`;
        const metaHtml = [
          row.issn ? jMetaChip(`ISSN ${row.issn}`, 'j-meta-id') : '',
          source === 'scielo' && row.network ? jMetaChip(String(row.network).replace(/^www\./, ''), 'j-meta-pub') : '',
        ].filter(Boolean).join('');
        const bodyHtml = `<div class="j-card-badges">
          <div class="badges badges-idx"><span class="domsrc-pill regional-source-pill">${escape(config.badge)}</span>${limitBadgeHtml(cov, 6)}</div>
          ${lvl ? `<div class="badges badges-rank">${limitBadgeHtml(lvl, 5)}</div>` : ''}
        </div>`;
        let ifHtmlClean = '';
        if (source === 'pbn' && row.points != null && row.points !== '') ifHtmlClean = jMetaIf(T('分值', 'Pts'), row.points);
        else if (source === 'isc' && row.h_index != null && row.h_index !== '') ifHtmlClean = jMetaIf('H', row.h_index);
        else {
          const metric = config.metric(row);
          if (metric) ifHtmlClean = jMetaIf(T('指标', 'Metric'), metric);
        }
        return journalCardRow({
          fid, src: source, extraClass: 'regional-directory-row',
          favHtml: starBtn(rec, source),
          nameHtml,
          ifHtml: ifHtmlClean,
          metaHtml, bodyHtml,
        });
      } catch (_) {
        return '';
      }
    }).join('');

    // 左侧筛选轨：波兰 / 伊朗 / 拉美统一结构（主筛 + 全球匹配 + 官方链接）
    const chip = (key, value, label) =>
      `<button type="button" class="dom-filter-chip${filt[key] === value ? ' on' : ''}" data-reg-filter="${escape(key)}" data-value="${escape(value)}">${escape(label)}</button>`;
    const filterGroups = [];
    if (source === 'pbn') {
      const pointOpts = [
        ['__all', T('全部分值', 'All points')],
        ['200', '200'], ['140', '140'], ['100', '100'], ['70', '70'], ['40', '40'], ['20', '20'],
      ];
      filterGroups.push(`
        <div class="dom-filter-group">
          <div class="dom-filter-label">${T('部委分值','Ministry points')}</div>
          <div class="dom-filter-chips">${pointOpts.map(([v, lab]) => chip('points', v, lab)).join('')}</div>
        </div>`);
    } else if (source === 'isc') {
      // 与全球站 IF 一致：最低 H 滑块（自定义，非固定区间）
      const hMax = 60;
      const hMin = Math.min(hMax, Math.max(0, Math.round(+filt.hMin || 0)));
      const hPct = (hMin / hMax * 100).toFixed(1);
      const hLabel = hMin > 0
        ? `H ≥ ${hMin}${hMin >= hMax ? '+' : ''}`
        : T('不限', 'Any');
      filterGroups.push(`
        <div class="dom-filter-group isc-h-filter">
          <div class="dom-filter-label">${T('H 指数','H-index')}</div>
          <div class="reg-slider-wrap">
            <div class="if-slider-row"><span class="if-slider-val" id="isc-h-slider-val">${escape(hLabel)}</span></div>
            <input type="range" id="isc-h-slider" class="reg-metric-slider" min="0" max="${hMax}" step="1" value="${hMin}"
              style="--pct:${hPct}%" aria-label="${T('最低 H 指数','Minimum H-index')}" />
            <div class="if-slider-ticks"><span>0</span><span>15</span><span>30</span><span>45</span><span>60+</span></div>
          </div>
        </div>`);
    } else if (source === 'scielo') {
      const netCounts = Object.create(null);
      data.records.forEach(r => {
        const n = r.network || '';
        if (n) netCounts[n] = (netCounts[n] || 0) + 1;
      });
      const nets = Object.entries(netCounts).sort((a, b) => b[1] - a[1]).slice(0, 16);
      const shortNet = (n) => String(n).replace(/^www\./, '').replace(/^scielo\./, '').replace(/\/$/, '');
      filterGroups.push(`
        <div class="dom-filter-group is-subject">
          <div class="dom-filter-label">${T('收录站点','Country nodes')}</div>
          <div class="dom-filter-chips is-wrap">
            ${chip('network', '__all', T('全部','All'))}
            ${nets.map(([n]) => chip('network', n, shortNet(n))).join('')}
          </div>
        </div>`);
    }
    // 三站通用：全球库匹配
    filterGroups.push(`
      <div class="dom-filter-group">
        <div class="dom-filter-label">${T('全球库匹配','Global match')}</div>
        <div class="dom-filter-chips">
          ${chip('match', '__all', T('全部','All'))}
          ${chip('match', 'yes', T('有匹配','Matched'))}
          ${chip('match', 'no', T('无匹配','Unmatched'))}
        </div>
      </div>`);
    if (data.source_url) {
      filterGroups.push(`
        <div class="dom-filter-group">
          <a class="source-link" href="${escape(data.source_url)}" target="_blank" rel="noopener nofollow">${T('官方目录', 'Official directory')}</a>
        </div>`);
    }

    const sourceYear = data.directory_year ? ` · ${T('目录年份', 'Directory year')} ${escape(data.directory_year)}` : '';
    box.innerHTML = `<div class="section-block regional-directory-section">
      ${countrySectionHeader(
        `${T(...config.title)} <span class="muted-cell">(${Number(data.record_count || data.records.length).toLocaleString()})</span>`,
        T(...config.intro) + ` · ${T('显示', 'Showing')} ${visible.length.toLocaleString()} / ${filtered.length.toLocaleString()}`,
      )}
      <div class="dom-browse">
        <aside class="dom-filter-rail" aria-label="${T('筛选','Filters')}">
          ${filterGroups.join('')}
        </aside>
        <div class="dom-filter-main">
          <div class="table-wrap"><table class="journals country-journal-table regional-directory-table" aria-label="${escape(T(...config.title))}"><thead hidden><tr><th></th></tr></thead><tbody>
            ${rows || `<tr><td class="empty">${T('未找到匹配期刊', 'No matching journals found')}</td></tr>`}
          </tbody></table></div>
          ${filtered.length > shown ? `<div class="pager"><button id="${source}-more" class="more-btn">${T('加载更多', 'Load more')} (${(filtered.length - shown).toLocaleString()} ${T('条剩余', 'remaining')})</button></div>` : ''}
          <div class="source-note">${T('名单成员完全以该机构官方目录为准；全球库仅用于补充交叉收录徽章。', 'Membership follows this institution\'s official directory only; the global database is used solely for optional cross-index badges.')} ${sourceYear}</div>
        </div>
      </div>
    </div>`;
    box.querySelectorAll('[data-reg-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-reg-filter');
        const value = btn.getAttribute('data-value') || '__all';
        if (!key) return;
        window.__regionalFilter[source][key] = value;
        window.__regionalShown[source] = 100;
        renderRegionalDirectory(source);
      });
    });
    // 伊朗 H 指数滑块（最低值，自定义）
    if (source === 'isc') {
      const slider = box.querySelector('#isc-h-slider');
      const valEl = box.querySelector('#isc-h-slider-val');
      if (slider) {
        const max = +slider.max || 60;
        let debounceTimer = null;
        const paint = () => {
          const v = +slider.value || 0;
          window.__regionalFilter.isc.hMin = v;
          if (valEl) {
            valEl.textContent = v > 0
              ? `H ≥ ${v}${v >= max ? '+' : ''}`
              : T('不限', 'Any');
          }
          slider.style.setProperty('--pct', (v / max * 100) + '%');
        };
        const apply = () => {
          window.__regionalShown.isc = 100;
          renderRegionalDirectory('isc');
        };
        slider.addEventListener('input', () => {
          paint();
          // 拖动中只更新文案；松手/停顿后再筛选，避免卡顿
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(apply, 120);
        });
        slider.addEventListener('change', apply);
        paint();
      }
    }
    $(`#${source}-more`)?.addEventListener('click', () => {
      window.__regionalShown[source] += 100;
      renderRegionalDirectory(source);
    });
  }

  // ───────── domestic tab ─────────
  function renderDomestic() {
    updateThStickyTop();
    const box = $('#dom-content');
    if (!domestic) {
      box.innerHTML = `<div class="empty">${T('正在加载中文期刊数据…','Loading Chinese journal data…')}</div>`;
      loadDomesticData().then((data) => {
        if (!data) {
          box.innerHTML = `<div class="empty">${T('无数据','No data')}</div>`;
          return;
        }
        updateFilterCounts();
        if (activeTab === 'dom') renderDomestic();
      });
      return;
    }
    const q = activeQuery.toLowerCase();

    // ===== 统一搜索：只要有搜索词就跨库聚合，忽略当前库选择 =====
    if (q) return renderDomesticUnified(box, q);

    if (activeDom === 'nsfc_mgmt') {
      const d = domestic.nsfc_mgmt;
      if (!d) { box.innerHTML = `<div class="empty">${T('国自然管理目录缺失','NSFC Management data missing')}</div>`; return; }
      const all = (d.records || []).slice().sort((a, b) => {
        const ta = a.tier === 'A' ? 0 : 1;
        const tb = b.tier === 'A' ? 0 : 1;
        return ta - tb || (a.order || 0) - (b.order || 0);
      });
      const rows = all.map(r => renderDomRow(r, {
        src: 'nsfc_mgmt',
        showTier: true,
        tierValue: r.tier,
        extraCols: `<td class="muted-cell" style="width:110px">${escape(r.frequency||'—')}</td>`,
      })).join('');
      box.innerHTML = `<div class="section-block">
        ${domSectionHeader(
          T('国家自然科学基金委管理科学部期刊目录','NSFC Management Science Journal List'),
          `${all.length.toLocaleString()} ${T('种期刊；A 类 / B 类按原目录顺序展示。','journals; A/B tiers shown in source order.')}`,
        )}
        ${wrapDomBrowse(`<div class="table-wrap"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>${rows}</tbody></table></div>`)}
      </div>`;
      return;
    }

    if (activeDom === 'cscd') {
      const d = domestic.cscd;
      if (!d) { box.innerHTML = `<div class="empty">${T('CSCD 数据缺失','CSCD data missing')}</div>`; return; }
      if (!window.__cscdShown) window.__cscdShown = 100;
      const all = d.records || [];
      const visible = all.slice(0, window.__cscdShown);
      const rows = visible.map(r => {
        const fid = favId(r);
        rowRecordsByFid[fid] = { ...r, __src: 'cscd' };
        const code = String(r.database || '').toUpperCase();
        const label = code === 'C' ? 'CSCD-C' : (code === 'E' ? 'CSCD-E' : 'CSCD');
        const crossBadges = renderDomCrossBadges(r, 'cscd');
        return journalCardRow({
          fid, src: 'cscd',
          favHtml: starBtn(r, 'cscd'),
          nameHtml: `<div class="jname">${escape(r.name||'')}</div>`,
          metaHtml: [
            r.issn ? jMetaChip(`ISSN ${r.issn}`, 'j-meta-id') : '',
            r.cn_code ? jMetaChip(`CN ${r.cn_code}`, 'j-meta-id') : '',
          ].filter(Boolean).join(''),
          bodyHtml: `<div class="j-card-badges badges"><span class="domsrc-pill ds-cscd">${label}</span>${limitBadgeHtml(crossBadges, 5)}</div>`,
        });
      }).join('');
      box.innerHTML = `<div class="section-block">
        ${domSectionHeader(
          'CSCD 来源期刊目录',
          `${(d.count || all.length).toLocaleString()} ${T('种期刊；C 为核心库，E 为扩展库。','journals; C is Core, E is Extended.')} ${d.source_url ? `<a class="source-link" href="${escape(d.source_url)}" target="_blank" rel="noopener nofollow">sciencechina.cn/select</a>` : ''}`,
        )}
        ${wrapDomBrowse(`
          <div class="table-wrap"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>${rows}</tbody></table></div>
          ${all.length > window.__cscdShown ? `<div class="pager"><button id="cscd-more" class="more-btn">${T('加载更多','Load more')} (${all.length - window.__cscdShown} ${T('条剩余','remaining')})</button></div>` : ''}
        `)}
      </div>`;
      document.getElementById('cscd-more')?.addEventListener('click', () => {
        window.__cscdShown += 100;
        renderDomestic();
      });
      return;
    }

    if (activeDom === 'cstpcd') {
      const d = domestic.cstpcd;
      if (!d) { box.innerHTML = `<div class="empty">${T('科技核心数据缺失','CSTPCD data missing')}</div>`; return; }
      if (!window.__cstpcdShown) window.__cstpcdShown = 100;
      const all = d.records || [];
      const visible = all.slice(0, window.__cstpcdShown);
      const rows = visible.map(r => {
        const fid = favId(r);
        rowRecordsByFid[fid] = { ...r, __src: 'cstpcd' };
        const label = r.kind === 'popular_science' ? T('中国科技核心·科普','CSTPCD Popular') : T('中国科技核心','CSTPCD');
        const crossBadges = renderDomCrossBadges(r, 'cstpcd');
        return journalCardRow({
          fid, src: 'cstpcd',
          favHtml: starBtn(r, 'cstpcd'),
          nameHtml: `<div class="jname">${escape(r.name||'')}</div>`,
          metaHtml: r.code ? jMetaChip(r.code, 'j-meta-id') : '',
          bodyHtml: `<div class="j-card-badges badges"><span class="domsrc-pill ds-cstpcd">${label}</span>${limitBadgeHtml(crossBadges, 5)}</div>`,
        });
      }).join('');
      box.innerHTML = `<div class="section-block">
        ${domSectionHeader(
          T('中国科技核心期刊目录','Chinese Science and Technology Core Journals'),
          `${(d.count || all.length).toLocaleString()} ${T('种期刊；含核心卷与科普卷。','journals; includes core and popular-science volumes.')} ${d.core_source_url ? `<a class="source-link" href="${escape(d.core_source_url)}" target="_blank" rel="noopener nofollow">${T('核心 PDF','Core PDF')}</a>` : ''} ${d.popular_science_source_url ? `<a class="source-link" href="${escape(d.popular_science_source_url)}" target="_blank" rel="noopener nofollow">${T('科普 PDF','Popular PDF')}</a>` : ''}`,
        )}
        ${wrapDomBrowse(`
          <div class="table-wrap"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>${rows}</tbody></table></div>
          ${all.length > window.__cstpcdShown ? `<div class="pager"><button id="cstpcd-more" class="more-btn">${T('加载更多','Load more')} (${all.length - window.__cstpcdShown} ${T('条剩余','remaining')})</button></div>` : ''}
        `)}
      </div>`;
      document.getElementById('cstpcd-more')?.addEventListener('click', () => {
        window.__cstpcdShown += 100;
        renderDomestic();
      });
      return;
    }

    if (activeDom === 'cnkx') {
      const d = domestic.cnkx;
      if (!d) { box.innerHTML = `<div class="empty">${T('中国科协数据缺失','CAST data missing')}</div>`; return; }
      const all = (d.records || []).filter(r => r.tier && /^T[123]$/.test(r.tier));
      // 官方学科领域
      const domainList = (d.domains && d.domains.length)
        ? d.domains.map(x => x.name)
        : [...new Set(all.map(r => r.domain).filter(Boolean))];

      // 细分学科列表
      const subdomainSet = new Set();
      all.forEach(r => { if (r.subdomain) subdomainSet.add(r.subdomain); });
      const subdomainList = [...subdomainSet];

      // 筛选状态 — 改用 Sets（多选）
      if (!window.__cnkxDomains) window.__cnkxDomains = new Set();
      if (!window.__cnkxSubs) window.__cnkxSubs = new Set();
      if (!window.__cnkxShown) window.__cnkxShown = 100;

      // 筛选
      let filtered = all.filter(r => {
        if (q) {
          const hay = (r.name + ' ' + (r.issn||'') + ' ' + (r.domain||'') + ' ' + (r.subdomain||'')).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (window.__cnkxDomains.size && !window.__cnkxDomains.has(r.domain)) return false;
        if (window.__cnkxSubs.size && !window.__cnkxSubs.has(r.subdomain)) return false;
        return true;
      });

      // 保留中国科协原始目录顺序：学科领域 / 细分学科 / T级 / 来源表内顺序。

      // 分页
      const visible = filtered.slice(0, window.__cnkxShown);
      const total = filtered.length;

      // 复选面板辅助：渲染 checkbox panel 内容
      function renderCnkxPanel(panelId, items, activeSet, searchId, i18nType) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        const raw = (document.getElementById(searchId)?.value || '').trim().toLowerCase();
        const tokens = expandWosQuery(raw);
        const filtered = !tokens.length ? items : items.filter(it => {
          const display = (tn(it, i18nType) || it).toLowerCase();
          return tokens.some(tok => display.includes(tok) || it.toLowerCase().includes(tok));
        });
        panel.innerHTML = filtered.map(it =>
          `<label class="th-chk" data-filter="cnkx" data-value="${escape(it)}">
             <input type="checkbox" ${activeSet.has(it) ? 'checked' : ''}>
             <span>${escape(tn(it, i18nType))}</span>
           </label>`
        ).join('');
      }

      // 行渲染
      const rows = visible.map(r => {
        const fid = favId(r);
        rowRecordsByFid[fid] = { ...r, __src: 'cnkx' };
        const hits = lookupDom(r);
        const badges = [
          ...hits.filter(h => h.source.startsWith('cnkx')).map(h => `<span class="domsrc-pill ds-cnkx">${escape(h.label)}</span>`),
          ...hits.filter(h => h.source === 'cssci').map(() => `<span class="domsrc-pill ds-cssci">CSSCI</span>`),
          ...hits.filter(h => h.source === 'pku').map(() => `<span class="domsrc-pill ds-pku">${T('北大核心','PKU Core')}</span>`),
          ...hits.filter(h => h.source === 'ccft').map(h => `<span class="domsrc-pill ds-ccft">CCF-${h.tag||'T'}</span>`),
          ...hits.filter(h => h.source === 'nsfc_mgmt').map(h => `<span class="domsrc-pill ds-nsfc_mgmt">${escape(h.label)}</span>`),
          ...hits.filter(h => h.source === 'cscd').map(h => `<span class="domsrc-pill ds-cscd">${escape(h.label)}</span>`),
          ...hits.filter(h => h.source === 'cstpcd').map(h => `<span class="domsrc-pill ds-cstpcd">${escape(h.label)}</span>`),
        ].filter(Boolean).join('');
        const subVal = r.subdomain ? tn(r.subdomain, 'sub') : '—';
        return `<tr class="j-row clickable" data-fid="${escape(fid)}" data-src="cnkx">
          <td class="col-fav" style="width:36px">${starBtn(r, 'cnkx')}</td>
          <td style="width:60px">${badgeTier(r.tier)}</td>
          <td class="jname" style="font-size:13.5px">${escape(r.name||'')}</td>
          <td class="col-cross"><div class="badges">${badges || '<span class="muted-cell">—</span>'}</div></td>
          <td class="muted-cell" style="width:110px">${escape(tn(r.domain||'', 'domain'))}</td>
          <td class="muted-cell" style="width:110px">${escape(subVal)}</td>
          <td style="width:110px"><span class="jissn">${escape(r.issn||'—')}</span></td>
        </tr>`;
      }).join('');

      box.innerHTML = `<div class="section-block">
        ${domSectionHeader(
          T('中国科协高质量科技期刊分级目录 (2025-12)','CAST High-Quality Sci-Tech Journal Tiered Directory (Dec 2025)'),
          `${T('T1 / T2 / T3 三级；','T1 / T2 / T3 tiers · ')}${domainList.length} ${T('个官方学科领域','official disciplines')} · ${all.length.toLocaleString()} ${T('条带分级记录','tiered records')}${q ? T(' · 搜索: ',' · Search: ')+escape(q) : ''}`,
        )}
        <div class="table-wrap"><table class="journals"><thead><tr>
          <th style="width:36px" aria-label="Favorite"></th>
          <th style="width:60px">${T('T级','Tier')}</th>
          <th>${T('期刊全称','Journal')}</th>
          <th>${T('交叉收录','Also In')}</th>
          <th style="width:160px;padding:0 4px">
            <div class="th-dropdown">
              <button class="th-dropdown-btn" onclick="event.stopPropagation();toggleCnkxDropdown('cnkx-domain-panel')">
                <span data-i18n="cnkx_domain" class="dd-label">${T('学科领域','Domain')}</span><span class="dd-arrow">▼</span>
              </button>
              <div class="th-dropdown-panel th-dropdown-panel-search" id="cnkx-domain-panel">
                <div class="dd-search-wrap"><input type="search" id="cnkx-domain-search" class="dd-search" placeholder="${T('搜索…','Search…')}" autocomplete="off" spellcheck="false"></div>
                <div class="dd-check-list" id="cnkx-domain-list"></div>
              </div>
            </div>
          </th>
          <th style="width:160px;padding:0 4px">
            <div class="th-dropdown">
              <button class="th-dropdown-btn" onclick="event.stopPropagation();toggleCnkxDropdown('cnkx-sub-panel')">
                <span data-i18n="cnkx_sub" class="dd-label">${T('细分学科','Sub-field')}</span><span class="dd-arrow">▼</span>
              </button>
              <div class="th-dropdown-panel th-dropdown-panel-search" id="cnkx-sub-panel">
                <div class="dd-search-wrap"><input type="search" id="cnkx-sub-search" class="dd-search" placeholder="${T('搜索…','Search…')}" autocomplete="off" spellcheck="false"></div>
                <div class="dd-check-list" id="cnkx-sub-list"></div>
              </div>
            </div>
          </th>
          <th style="width:110px">ISSN</th>
        </tr></thead><tbody>
          ${rows}
          ${total === 0 ? `<tr><td colspan="7" class="empty">${T('未找到匹配的期刊','No matching journals found')}</td></tr>` : ''}
        </tbody></table></div>
        ${total > window.__cnkxShown ? `<div class="pager"><button id="cnkx-more" class="more-btn" style="margin-top:12px;padding:8px 20px;border:1px solid var(--rule);background:var(--paper);color:var(--ink-soft);border-radius:2px;cursor:pointer">${T('加载更多','Load more')} (${total - window.__cnkxShown} ${T('条剩余','remaining')})</button></div>` : ''}
      </div>`;

      // 渲染复选面板并绑定搜索
      renderCnkxPanel('cnkx-domain-list', domainList, window.__cnkxDomains, 'cnkx-domain-search', 'domain');
      renderCnkxPanel('cnkx-sub-list', subdomainList, window.__cnkxSubs, 'cnkx-sub-search', 'sub');
      // 绑定搜索输入
      ['cnkx-domain-search','cnkx-sub-search'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp && !inp.__cnkxBound) {
          inp.__cnkxBound = true;
          inp.addEventListener('input', () => {
            if (id === 'cnkx-domain-search') renderCnkxPanel('cnkx-domain-list', domainList, window.__cnkxDomains, 'cnkx-domain-search', 'domain');
            else renderCnkxPanel('cnkx-sub-list', subdomainList, window.__cnkxSubs, 'cnkx-sub-search', 'sub');
          });
        }
      });
      // 绑定复选框
      document.querySelectorAll('#cnkx-domain-panel label.th-chk, #cnkx-sub-panel label.th-chk').forEach(label => {
        if (label.__cnkxBound) return;
        label.__cnkxBound = true;
        const cb = label.querySelector('input[type=checkbox]');
        if (!cb) return;
        cb.addEventListener('change', () => {
          const val = label.dataset.value;
          const isDomain = label.closest('#cnkx-domain-panel');
          const set = isDomain ? window.__cnkxDomains : window.__cnkxSubs;
          if (cb.checked) set.add(val); else set.delete(val);
          window.__cnkxShown = 100;
          renderDomestic();
        });
      });
      const moreBtn = document.getElementById('cnkx-more');
      if (moreBtn) moreBtn.addEventListener('click', () => { window.__cnkxShown += 100; renderDomestic(); });
      return;
    }

    if (activeDom === 'cnki_major') {
      const d = domestic.cnki_major;
      if (!d) { box.innerHTML = `<div class="empty">${T('目录数据缺失','Data missing')}</div>`; return; }
      const all = d.records || [];
      // 10 大学科分类
      const CAT_ORDER = ['基础科学','工程科技I','工程科技II','信息科技','农业科技','医药卫生科技','哲学与人文科学','社会科学I','社会科学II','经济与管理科学'];
      let activeCat = '__all';
      // 从URL hash或存储取当前选中分类（默认全部）
      // 使用内存变量跟踪
      if (!window.__cnkiCat) window.__cnkiCat = '__all';
      if (!window.__cnkiIndex) window.__cnkiIndex = '__all';
      activeCat = window.__cnkiCat;

      // 筛选逻辑
      let filtered = all.filter(r => {
        const hits = lookupDom(r);
        // 搜索过滤
        if (q) {
          const hay = (r.name + ' ' + (r.issn||'') + ' ' + (r.cn_code||'') + ' ' + (r.sponsor||'') + ' ' + (r.category||'') + ' ' + (r.category_code||'') + ' ' + (r.major_categories||[]).join(' ') + ' ' + (r.categories||[]).join(' ')).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        // 学科分类过滤
        if (activeCat !== '__all') {
          const cats = r.major_categories || [];
          if (!cats.includes(activeCat)) return false;
        }
        if (window.__cnkiIndex !== '__all') {
          const hasIndex = hits.some(h => {
            if (window.__cnkiIndex === 'cnkx') return h.source && h.source.startsWith('cnkx');
            if (window.__cnkiIndex === 'zju') return h.source === 'zju';
            return h.source === window.__cnkiIndex;
          });
          if (!hasIndex) return false;
        }
        // 徽章过滤（CSSCI/北大核心/CCF）— include mode: 勾选 = 只看有该徽章的
        if (activeDomBadges.size > 0) { // 有任意徽章被勾选时
          const hasCssci = hits.some(h => h.source === 'cssci');
          const hasCssciExt = hits.some(h => h.source === 'cssci_ext');
          const hasPku = hits.some(h => h.source === 'pku');
          const hasCcf = hits.some(h => h.source === 'ccft');
          const hasCscd = hits.some(h => h.source === 'cscd');
          const hasCstpcd = hits.some(h => h.source === 'cstpcd');
          // AND logic: 勾选的徽章，期刊必须全部拥有
          if (activeDomBadges.has('cssci') && !hasCssci) return false;
          if (activeDomBadges.has('cssci_ext') && !hasCssciExt) return false;
          if (activeDomBadges.has('pku') && !hasPku) return false;
          if (activeDomBadges.has('ccft') && !hasCcf) return false;
          if (activeDomBadges.has('cscd') && !hasCscd) return false;
          if (activeDomBadges.has('cstpcd') && !hasCstpcd) return false;
        }
        return true;
      });

      // 生成学科分类下拉选项
      const catOptions = CAT_ORDER.map(c => {
        const count = all.filter(r => (r.major_categories||[]).includes(c)).length;
        return `<option value="${escape(c)}"${activeCat === c ? ' selected' : ''}>${escape(c)}</option>`;
      }).join('');
      const indexOptions = [
        ['cssci', 'CSSCI'],
        ['cssci_ext', T('CSSCI 扩展','CSSCI Ext')],
        ['pku', T('北大核心','PKU Core')],
        ['ccft', T('CCF 中文','CCF Chinese')],
        ['cscd', 'CSCD'],
        ['cstpcd', T('中国科技核心','CSTPCD')],
        ['cnkx', T('中国科协','CAST')],
        ['zju', T('浙江大学','ZJU')],
      ].map(([value, label]) => `<option value="${escape(value)}"${window.__cnkiIndex === value ? ' selected' : ''}>${escape(label)}</option>`).join('');

      // 按刊名字母排序
      filtered.sort((a, b) => (a.name||'').localeCompare(b.name||'', 'zh'));

      // 分页
      const visible = filtered.slice(0, window.__cnkiShown || 100);
      const total = filtered.length;

      // 渲染行：上刊名/学科 · 下收录（中文目录一律标知网 + 交叉徽章）
      const rows = visible.map(r => {
        const fid = favId(r);
        rowRecordsByFid[fid] = { ...r, __src: 'cnki_major' };
        const hits = lookupDom(r);
        // 本目录条目均来自知网中文期刊库
        const cnkiBadge = `<span class="domsrc-pill ds-cnki_major" title="${T('中国知网中文期刊目录收录','Listed in CNKI Chinese journal directory')}">${T('知网','CNKI')}</span>`;
        const badges = limitBadgeHtml([
          cnkiBadge,
          ...hits.filter(h => h.source === 'cssci').map(() => `<span class="domsrc-pill ds-cssci">CSSCI</span>`),
          ...hits.filter(h => h.source === 'cssci_ext').map(() => `<span class="domsrc-pill ds-cssci-ext">${T('CSSCI 扩展','CSSCI Ext')}</span>`),
          ...hits.filter(h => h.source === 'pku').map(() => `<span class="domsrc-pill ds-pku">${T('北大核心','PKU Core')}</span>`),
          ...hits.filter(h => h.source === 'ccft').map(h => `<span class="domsrc-pill ds-ccft" title="${escape(h.org||'')}">CCF-${h.tag||'T'}</span>`),
          ...hits.filter(h => h.source === 'zju').map(h => `<span class="domsrc-pill ds-zju">${escape(h.label)}</span>`),
          ...hits.filter(h => h.source === 'school_a').map(h => `<span class="domsrc-pill ds-school-a">${escape(h.label)}</span>`),
          ...hits.filter(h => h.source === 'nsfc_mgmt').map(h => `<span class="domsrc-pill ds-nsfc_mgmt">${escape(h.label)}</span>`),
          ...hits.filter(h => h.source === 'cscd').map(h => `<span class="domsrc-pill ds-cscd">${escape(h.label)}</span>`),
          ...hits.filter(h => h.source === 'cstpcd').map(h => `<span class="domsrc-pill ds-cstpcd">${escape(h.label)}</span>`),
          ...hits.filter(h => h.source.startsWith('cnkx')).map(h => `<span class="domsrc-pill ds-cnkx">${escape(h.label)}</span>`),
        ].filter(Boolean).join(''), 8);
        const name = r.name || '';
        const displayCats = (r.major_categories || []).length ? r.major_categories : (r.categories || []);
        const catLine = displayCats.slice(0, 2).join(' · ');
        const nameHtml = `<div class="jname cnki-name">${escape(name)}</div>`;
        const metaHtml = [
          catLine ? jMetaChip(catLine, 'j-meta-topic-show') : '',
          r.issn ? jMetaChip(`ISSN ${r.issn}`, 'j-meta-id') : '',
          r.cn_code ? jMetaChip(`CN ${r.cn_code}`, 'j-meta-id') : '',
        ].filter(Boolean).join('');
        const bodyHtml = `<div class="j-card-badges badges">${badges}</div>`;
        return journalCardRow({
          fid, src: 'cnki_major', extraClass: 'cnki-row',
          favHtml: starBtn(r, 'cnki_major'),
          nameHtml, metaHtml, bodyHtml,
        });
      }).join('');

      // 左侧筛选（对齐全球站）：收录索引 chip + 学科分类
      const indexChips = [
        ['__all', T('全部','All')],
        ['cssci', 'CSSCI'],
        ['cssci_ext', T('CSSCI 扩展','CSSCI Ext')],
        ['pku', T('北大核心','PKU Core')],
        ['ccft', T('CCF 中文','CCF Chinese')],
        ['cscd', 'CSCD'],
        ['cstpcd', T('中国科技核心','CSTPCD')],
        ['cnkx', T('中国科协','CAST')],
        ['zju', T('浙江大学','ZJU')],
      ].map(([value, label]) => {
        const on = (window.__cnkiIndex || '__all') === value;
        return `<button type="button" class="dom-filter-chip${on ? ' on' : ''}" data-cnki-index="${escape(value)}">${escape(label)}</button>`;
      }).join('');
      const catChips = [
        ['__all', T('全部学科','All subjects')],
        ...CAT_ORDER.map(c => [c, c]),
      ].map(([value, label]) => {
        const on = (window.__cnkiCat || '__all') === value;
        return `<button type="button" class="dom-filter-chip${on ? ' on' : ''}" data-cnki-cat="${escape(value)}">${escape(label)}</button>`;
      }).join('');

      box.innerHTML = `<div class="section-block dom-layout">
        ${domSectionHeader(
          T('中文期刊目录','Chinese Journal Directory'),
          `${T('共收录','Total ')} ${all.length.toLocaleString()} ${T('种中文期刊',' Chinese journals')}${q ? T(' · 搜索: ',' · Search: ')+escape(q) : ''} · ${T('显示','Showing')} ${visible.length.toLocaleString()} / ${total.toLocaleString()}`,
        )}
        <div class="dom-browse">
          <aside class="dom-filter-rail" aria-label="${T('筛选','Filters')}">
            ${domCatalogRailGroupHTML()}
            <div class="dom-filter-group">
              <div class="dom-filter-label">${T('收录索引','Indices')}</div>
              <div class="dom-filter-chips" id="cnki-index-chips">${indexChips}</div>
            </div>
            <div class="dom-filter-group">
              <div class="dom-filter-label">${T('学科分类','Category')}</div>
              <div class="dom-filter-chips" id="cnki-cat-chips">${catChips}</div>
            </div>
          </aside>
          <div class="dom-filter-main">
            <div class="table-wrap cnki-table-wrap"><table class="journals cnki-table"><thead hidden><tr><th></th></tr></thead><tbody>
              ${rows}
              ${total === 0 ? `<tr><td colspan="3" class="empty">${T('未找到匹配的期刊','No matching journals found')}</td></tr>` : ''}
            </tbody></table></div>
            ${total > (window.__cnkiShown || 100) ? `<div class="pager"><button id="cnki-more" class="more-btn" style="margin-top:12px;padding:8px 20px;border:1px solid var(--rule);background:var(--paper);color:var(--ink-soft);border-radius:2px;cursor:pointer">${T('加载更多','Load more')} (${total - (window.__cnkiShown||100)} ${T('条剩余','remaining')})</button></div>` : ''}
          </div>
        </div>
      </div>`;

      box.querySelectorAll('[data-cnki-index]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.__cnkiIndex = btn.getAttribute('data-cnki-index') || '__all';
          window.__cnkiShown = 100;
          renderDomestic();
        });
      });
      box.querySelectorAll('[data-cnki-cat]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.__cnkiCat = btn.getAttribute('data-cnki-cat') || '__all';
          window.__cnkiShown = 100;
          renderDomestic();
        });
      });

      const moreBtn = $('#cnki-more');
      if (moreBtn) {
        moreBtn.addEventListener('click', () => {
          window.__cnkiShown = (window.__cnkiShown || 100) + 100;
          renderDomestic();
        });
      }
      return;
    }

    if (activeDom === 'zju_zju') {
      const src = domestic.zju;
      if (!src || !src.records) { box.innerHTML = `<div class="empty">${T('数据缺失','Data missing')}</div>`; return; }
      const list = src.records;
      const f = list.filter(r => {
        if (!q) return true;
        const hay = (r.name + ' ' + (r.issn||'') + ' ' + (r.cn_code||'')).toLowerCase();
        return hay.includes(q);
      });
      const byTier = {};
      for (const r of f) (byTier[r.tier] = byTier[r.tier] || []).push(r);
      const tierOrder = ['一级', '核心', '其他'];
      const tierClass = {'一级':'t1','核心':'t2','其他':'t3'};
      const html = [`<div class="section-block">
        ${domSectionHeader(
          escape(lang==='en' ? T('浙江大学 2024 期刊分级','ZJU 2024 Journal Tiers') : (src.source || '浙江大学 2024 期刊分级')),
          `${T('共','Total ')} ${list.length.toLocaleString()} ${T('条；带 ★ 为人文社科权威级期刊（一级内）',' · ★ marks authoritative humanities & social sciences journals (within Tier 1)')}`,
        )}`];
      for (const tier of tierOrder) {
        const recs = byTier[tier]; if (!recs || !recs.length) continue;
        html.push(`<details class="section-block" style="margin-top:14px" ${q?'open':(tier==='一级'?'open':'')}>
          <summary>${T('国内','Domestic ')}${escape(tn(tier, "tier"))}${T('学术期刊',' Journals')} <span class="muted-cell">(${recs.length})</span></summary>
          <div class="table-wrap" style="margin-top:10px"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>
          ${recs.slice(0, 1500).map(r => {
            const tierBadge = `<span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(tn(r.tier, "tier"))}</span>${r.name.includes('*') ? ' <span class="warn-pill" style="background:var(--gold);color:#fff">★</span>' : ''}`;
            return renderDomRow(
              { ...r, name: r.name.replace(/\*$/,'') },
              {
                src: 'zju',
                extraBadges: tierBadge,
                metaHtml: r.note ? jMetaChip(r.note, 'j-meta-note') : '',
              }
            );
          }).join('')}
          ${recs.length > 1500 ? `<tr><td class="empty">${T('仅显示前 1500 条，请在搜索框内精确查找','Showing first 1500 — please refine search')}</td></tr>` : ''}
          </tbody></table></div>
        </details>`);
      }
      html.push('</div>');
      box.innerHTML = html.join('');
      return;
    }

    if (activeDom === 'school_a') {
      // 高校自编目录着陆页（不展示数据，点击才输码解锁）
      const src = domestic.school_a || {};
      const unlocked = isUnlocked('school_a');
      if (unlocked) {
        // 已解锁 → 展示数据（保留原逻辑）
        const list = unlockedCache.school_a;
        const f = list.filter(r => {
          if (!q) return true;
          const hay = (r.name + ' ' + (r.issn||'') + ' ' + (r.cn_code||'')).toLowerCase();
          return hay.includes(q);
        });
        const byTier = {};
        for (const r of f) (byTier[r.tier] = byTier[r.tier] || []).push(r);
        const tierOrder = ['一级', '核心', '其他'];
        const tierClass = {'一级':'t1','核心':'t2','其他':'t3'};
        const html = [`<div class="section-block">
          ${domSectionHeader(
            `${escape(lang==='en' ? T('高校自编目录 · 2023 期刊分级','In-house School Directory · 2023 Journal Tiers') : (src.source || '高校自编目录 · 2023 期刊分级'))} <span class="unlocked-pill">✓ ${T('已解锁','Unlocked')}</span> <button class="tiny-btn" id="lock-again">${T('锁回','Lock again')}</button>`,
            `${T('共','Total ')} ${list.length.toLocaleString()} ${T('条；带 ★ 为人文社科权威级期刊',' · ★ marks authoritative humanities & social sciences journals')}`,
          )}`];
        for (const tier of tierOrder) {
          const recs = byTier[tier]; if (!recs || !recs.length) continue;
          html.push(`<details class="section-block" style="margin-top:14px" ${q?'open':(tier==='一级'?'open':'')}>
            <summary>${T('国内','Domestic ')}${escape(tn(tier, "tier"))}${T('学术期刊',' Journals')} <span class="muted-cell">(${recs.length})</span></summary>
            <div class="table-wrap" style="margin-top:10px"><table class="journals"><thead hidden><tr><th></th></tr></thead><tbody>
            ${recs.slice(0, 1500).map(r => {
              const tierBadge = `<span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(tn(r.tier, "tier"))}</span>${r.name.includes('*') ? ' <span class="warn-pill" style="background:var(--gold);color:#fff">★</span>' : ''}`;
              return renderDomRow(
                { ...r, name: r.name.replace(/\*$/,'') },
                { src: 'school_a', extraBadges: tierBadge }
              );
            }).join('')}
            </tbody></table></div>
          </details>`);
        }
        html.push('</div>');
        box.innerHTML = html.join('');
        $('#lock-again')?.addEventListener('click', () => {
          if (confirm(T('锁回后需要再次输入解锁码。确认？','Locking again will require re-entering the unlock code. Continue?'))) { forgetUnlock('school_a'); renderDomestic(); }
        });
        return;
      }
      // 未解锁 → 付费着陆页
      box.innerHTML = `
        ${domSectionHeader(T('高校自编目录','In-house School Directory'), T('需要解锁后查看完整条目','Unlock required to view full records'))}
        <div class="locked-landing">
          <div class="locked-hero">
            <div class="locked-badge">🔒 ${T('高校自编目录','In-house School Directory')}</div>
            <h2>${T('高校自编目录 · 期刊分级目录 (2023 版)','In-house School Directory · Journal Tiers (2023 ed.)')}</h2>
            <p class="locked-sub">${T('学校人事处 / 科研处自编，用于校内职称评审、科研奖励、毕业考核的权威参考目录。共收录','Compiled by the university HR / Research Office for promotion review, research awards, and graduation assessment. Contains')} <b>${src.count || '2,390'}</b> ${T('条国内外期刊，分「一级 / 核心 / 其他」三级，含人文社科权威标注。','domestic and international journals, tiered as Tier 1 / Core / Other, with humanities & social sciences flags.')}</p>
            <div class="locked-specs">
              <div class="spec">
                <div class="spec-k">${T('收录条数','Records')}</div>
                <div class="spec-v">${src.count || '2,390'}</div>
              </div>
              <div class="spec">
                <div class="spec-k">${T('分级层次','Tier Levels')}</div>
                <div class="spec-v">${T('一级 / 核心 / 其他','Tier 1 / Core / Other')}</div>
              </div>
              <div class="spec">
                <div class="spec-k">${T('版本','Edition')}</div>
                <div class="spec-v">${T('2023 最新','2023 latest')}</div>
              </div>
              <div class="spec">
                <div class="spec-k">${T('解锁方式','Unlock')}</div>
                <div class="spec-v">${T('一码终身','One-time code')}</div>
              </div>
            </div>
            <div class="locked-actions">
              <button class="big-btn primary" id="open-unlock">${T('我已有解锁码，立即解锁','I have an unlock code')}</button>
              <a class="big-btn ghost" href="mailto:support@ailatest.org?subject=Unlock code request - School A">💬 ${T('联系获取解锁码','Contact us to get a code')}</a>
            </div>
            <div class="locked-note">
              · ${T('解锁码绑定本浏览器，下次自动识别，无需再输','Code is bound to this browser; auto-recognized next time')}<br/>
              · ${T('AES-GCM + PBKDF2 加密存储，传输过程不落明文','AES-GCM + PBKDF2 encrypted storage; no plaintext in transit')}<br/>
              · ${T('同站后续新增高校目录（浙大、同济等）将陆续上线','More school directories (ZJU, Tongji, etc.) coming soon')}
            </div>
            <div class="unlock-slot" id="unlock-slot" hidden></div>
          </div>
        </div>`;
      $('#open-unlock')?.addEventListener('click', () => {
        const slot = $('#unlock-slot');
        slot.hidden = false;
        slot.innerHTML = lockedPrompt('school_a', src.source || T('高校自编目录 · 期刊分级目录 2023','In-house School Directory · Journal Tiers 2023'), src.count || 0);
        slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
  }


  // ───────── 相关期刊推荐 (Top 3) ─────────
  function getRelatedJournals(r, limit = 3) {
    if (!journals.length) return [];
    const selfId = favId(r);
    const selfIF = parseFloat(r.if_2024) || 0;
    const selfCats = Array.isArray(r.wos_categories) ? r.wos_categories : [];
    const selfCAS = r.cas_zone || '';
    const selfJCR = r.if_quartile || '';
    const selfPub = (r.publisher || '').toLowerCase();
    const selfESI = r.esi_category || '';

    const scored = [];
    for (const j of journals) {
      const jid = favId(j);
      if (jid === selfId) continue;
      const jCats = Array.isArray(j.wos_categories) ? j.wos_categories : [];
      // Jaccard similarity on WoS categories (weight 0.5)
      let catScore = 0;
      if (selfCats.length && jCats.length) {
        const inter = selfCats.filter(c => jCats.includes(c)).length;
        const union = new Set([...selfCats, ...jCats]).size;
        catScore = union > 0 ? inter / union : 0;
      }
      // IF proximity (weight 0.25)
      const jIF = parseFloat(j.if_2024) || 0;
      let ifScore = 0;
      if (selfIF > 0 && jIF > 0) {
        ifScore = 1 / (1 + Math.abs(Math.log(selfIF) - Math.log(jIF)));
      }
      // CAS zone match (weight 0.15)
      let zoneScore = 0;
      if (selfCAS && j.cas_zone === selfCAS) zoneScore += 0.5;
      if (selfJCR && j.if_quartile === selfJCR) zoneScore += 0.5;
      // Same publisher (weight 0.1)
      const pubScore = (selfPub && (j.publisher || '').toLowerCase() === selfPub) ? 1 : 0;
      // ESI bonus
      const esiBonus = (selfESI && j.esi_category === selfESI) ? 0.1 : 0;

      const total = catScore * 0.5 + ifScore * 0.25 + zoneScore * 0.15 + pubScore * 0.1 + esiBonus;
      if (total > 0.05) scored.push({ j, score: total });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.j);
  }

  function renderRelatedHTML(r) {
    const related = getRelatedJournals(r, 3);
    if (!related.length) return '';
    const cards = related.map(j => {
      const name = titleCase(j.name || j.cn_name || '');
      const ifVal = j.if_2024 != null ? `IF ${j.if_2024}` : '';
      const cas = j.cas_zone ? `${T('中科院','CAS')} ${j.cas_zone}${T('区','')}` : '';
      const badges = [ifVal, cas].filter(Boolean).join(' · ');
      return `<div class="related-card" data-fid="${escape(favId(j))}" style="cursor:pointer">
        <div class="related-name">${escape(name)}</div>
        <div class="related-meta muted-cell">${badges}</div>
      </div>`;
    }).join('');
    return `<div class="drawer-section related-section">
      <h4>${T('相关期刊推荐','Related Journals')}</h4>
      <div class="related-grid">${cards}</div>
    </div>`;
  }

  // ───────── 详情抽屉 ─────────
  let drawerOpen = false;
  let _currentDrawerRec = null;
  let _drawerStack = []; // for back-navigation through related journals
  let _drawerSourceTab = 'int'; // tab active when drawer opened in pageMode
  // 跨源按 favId 检索任意期刊记录（用于 #j/<id> 深链）
  function findRecByFid(id) {
    if (!id) return null;
    const wantedList = journalRouteKeyList(id);
    const completeness = (r) => {
      // 信息完整度评分：有 ISSN / 索引 / IF 的记录优先于空壳（仅目录来源）
      let score = 0;
      if (r?.issn || r?.eissn) score += 4;
      if (Array.isArray(r?.indices) && r.indices.length) score += 3;
      if (r?.if_2024 != null) score += 2;
      if (r?.scopus?.active || r?.doaj) score += 1;
      if (r?.abs_only || r?.abdc_only || r?.specialty_only) score -= 2; // 空壳目录条目降权
      return score;
    };
    const findIn = (arr, src) => {
      let best = null, bestScore = -Infinity;
      for (const wantedKey of wantedList) {
        for (const r of arr || []) {
          if (recordRouteKeys(r).has(wantedKey)) {
            const s = completeness(r);
            if (s > bestScore) { best = r; bestScore = s; }
          }
        }
        if (best && bestScore >= 4) break; // 已找到足够完整的记录，不必继续搜其他 key
      }
      if (!best) return null;
      const rr = Object.assign({}, best);
      if (src && !rr.__src) rr.__src = src;
      return rr;
    };
    if (Array.isArray(journals)) {
      const rr = findIn(journals, 'int');
      if (rr) return rr;
    }
    if (domestic) {
      const groups = [
        ['cssci', domestic.cssci_core || []],
        ['cssci_ext', domestic.cssci_ext || []],
        ['pku', domestic.pku_core || []],
        ['cscd', (domestic.cscd && domestic.cscd.records) || []],
        ['cstpcd', (domestic.cstpcd && domestic.cstpcd.records) || []],
        ['cnkx', (domestic.cnkx && domestic.cnkx.records) || []],
        ['nsfc_mgmt', (domestic.nsfc_mgmt && domestic.nsfc_mgmt.records) || []],
        ['zju', (domestic.zju && domestic.zju.records) || []],
      ];
      for (const [src, arr] of groups) {
        const rr = findIn(arr, src);
        if (rr) return rr;
      }
    }
    if (india && Array.isArray(india.records)) {
      const rr = findIn(india.records.map(r => ({ ...r, name: r.journal_title })), 'in');
      if (rr) return rr;
    }
    return null;
  }
  function applyHashRoute() {
    if (journalPathSlug()) return;
    const hash = location.hash || '';
    // #fav → 收藏 tab
    if (hash === '#fav' || hash === '#favorites') {
      activateTab('fav');
      return;
    }
    // #search?q=<query> → switch to pick tab and fill search
    const searchMatch = hash.match(/^#search\?q=(.+)$/);
    if (searchMatch) {
      try {
        const q = decodeURIComponent(searchMatch[1]);
        activateTab('pick');
        const searchInput = $('#q');
        if (searchInput) searchInput.value = q;
        setTimeout(() => {
          const btn = $('#search-submit');
          if (btn) btn.click();
        }, 800);
      } catch (_) {}
      return;
    }
    const m = hash.match(/^#j\/(.+)$/);
    if (!m) { if (drawerOpen) closeDrawer(true); return; }
    let id;
    try { id = decodeURIComponent(m[1]); } catch (_) { id = m[1]; }
    if (_currentDrawerRec && favId(_currentDrawerRec) === id) return;
    const r = findRecByFid(id);
    if (r) openDrawer(r, { fromHash: true, pageMode: true });
  }
  async function openDrawer(r, opts) {
    // 未登录：每日 10 个期刊详情（去重）；登录后不限
    const fid = favId(r);
    // soft 刷新：full 库升级 / OA 补绘，不再二次计次、打点
    const softRefresh = !!(opts && (opts.source === 'full_upgrade' || opts.source === 'oa_hydrate'));
    if (!softRefresh) {
      if (!user) {
        if (!canViewJournalDetail(fid)) {
          requireLogin(T(
            `今日免费可查看 ${DAILY_VIEW_LIMIT} 个期刊详情，登录后不限次数。`,
            `Free: ${DAILY_VIEW_LIMIT} journal pages per day. Sign in for unlimited viewing.`
          ));
          return;
        }
        if (!consumeJournalDetailView(fid)) {
          requireLogin(T(
            `今日免费可查看 ${DAILY_VIEW_LIMIT} 个期刊详情，登录后不限次数。`,
            `Free: ${DAILY_VIEW_LIMIT} journal pages per day. Sign in for unlimited viewing.`
          ));
          return;
        }
      } else {
        incrementUsage('views');
      }
    }

    _currentDrawerRec = r;
    if (!softRefresh) recordView(r); // 记录浏览历史，用于学科推荐
    const pageMode = !!(opts && opts.pageMode);
    document.body.classList.toggle('journal-route', pageMode);
    document.documentElement.classList.toggle('journal-route', pageMode);
    if (pageMode) document.documentElement.classList.remove('journal-route-pending');
    // 记录抽屉打开时的 tab，关闭时回到原 tab
    if (pageMode) _drawerSourceTab = activeTab;
    const drawer = $('#j-drawer'), scrim = $('#drawer-scrim'), body = $('#drawer-body');
    if (!drawer || !body) return;
    // OA map ~10MB：等首屏 DOM 后再空闲加载，避免与详情首绘抢带宽
    // 国家分布图由 hydrateCountryOutputChart 按需拉取（预置极小）
    if (!softRefresh) {
      // 上报浏览（无需登录），结果回填进 cache
      reportJournalView(r, opts || {});
      // GA4 虚拟浏览 — 期刊详情抽屉打开时通知 GA4（无需 GTM 配置）
      try {
        if (typeof gtag === 'function') {
          var jvPath = '/journal/' + (favId(r) || '');
          gtag('event', 'page_view', {
            'page_title': (r.name || r.cn_name || '期刊详情').slice(0, 200),
            'page_location': window.location.origin + jvPath,
            'page_path': jvPath,
          });
        }
      } catch(_) {}
    }
    const src = r.__src || 'int';
    const titleRaw = r.name || r.cn_name || '';
    const title = titleCase(titleRaw);
    const sub = r.cn_name && r.cn_name !== title ? r.cn_name
              : r.en_name && r.en_name !== title ? r.en_name : '';
    const issn = r.issn || r.cn_code || '';
    const eissn = r.eissn || '';

    // （按用户要求：不再外链到 LetPub / SCImago / Scholar / ISSN Portal，一切自己做）

    // 国际信息 join（非 int 源时按 ISSN/eISSN/标题查 WoS 国际表）
    const intRec = src === 'int' ? r : lookupInt(r);
    const ir = intRec || {};
    // 徽章块 — 分两行：索引收录 / 分区等级
	    const drawerIndexBadges = (src === 'int' || intRec) ? renderIndexBadges(ir) : '';
	    const drawerRankBadges = (src === 'int' || intRec) ? renderRankBadges(ir) : '';
	    const titleFeatureBadges = canSeePublishFeeInfo() && (isFreeToPublish(ir) || isFreeToPublish(r)) ? badgeFree(true) : '';
	    const tierBadge = r.tier && /^T[123]$/.test(r.tier) ? badgeTier(r.tier)
                    : r.tier ? `<span class="tier-pill t3">${escape(tn(r.tier, "tier"))}</span>` : '';
    const crossBadges = renderDomCrossBadges(r, src);
    const drawerCoverageBadges = (src === 'int' || intRec) ? renderCoverageBadges(ir) : '';
    const drawerLevelBadges = (src === 'int' || intRec) ? renderLevelBadges(ir) : '';
    const drawerAccessBadges = (src === 'int' || intRec)
      ? renderAccessBadges(ir)
      : (canSeePublishFeeInfo() && isFreeToPublish(r) ? badgeFree(true) : '');
    const drawerRiskBadges = (src === 'int' || intRec) ? renderRiskBadges(ir) : '';

    // 基础元信息（真实字段）
    const meta = [];
    if (r.abbr20 && r.abbr20 !== (r.name||'').replace(/\*$/,'')) meta.push([T('期刊缩写','Abbreviation'), r.abbr20]);
    if (r.publisher) meta.push([T('出版商','Publisher'), r.publisher]);
    if (r.org || r.sponsor) meta.push([T('主办单位','Sponsor'), r.org || r.sponsor]);
    if (r.address) meta.push([T('出版地址','Address'), r.address]);
    if (r.country) meta.push([T('国家/地区','Country/Region'), r.country]);
    if (r.languages || r.language_cn || r.language) meta.push([T('语种','Language'), r.languages || r.language_cn || r.language]);
    if (r.frequency) meta.push([T('出版周期','Frequency'), r.frequency]);
    if (r.discipline) meta.push([T('学科','Discipline'), tn(r.discipline, 'cssci')]);
    if (r.category) meta.push([T('分类','Category'), tn(r.category, 'pku')]);
    if (Array.isArray(r.categories) && r.categories.length) meta.push([T('CNKI 分类','CNKI Categories'), r.categories.join(' · ')]);
    if (r.domain) meta.push([T('科协领域','CAST Domain'), tn(r.domain, 'domain') + (r.subdomain ? ' · ' + tn(r.subdomain, 'sub') : '')]);
    if (r.ccf_area) meta.push([T('CCF 方向','CCF Area'), r.ccf_area]);
    if (ir.abdc && ir.abdc.rating) meta.push([T('ABDC 等级','ABDC Rating'), ir.abdc.rating + (ir.abdc.field ? ' · ' + ir.abdc.field : '')]);
    if (ir.ft50) meta.push(['FT50', (ir.ft50.order ? `#${ir.ft50.order}` : '') + (ir.ft50.source ? ` · ${ir.ft50.source}` : '')]);
    if (ir.utd24) meta.push(['UTD24', (ir.utd24.order ? `#${ir.utd24.order}` : '') + (ir.utd24.subject ? ` · ${ir.utd24.subject}` : '')]);
    if (src === 'nsfc_mgmt' || r.source === 'NSFC Management Science Department Journal List') meta.push([T('来源','Source'), T('国家自然科学基金委管理科学部期刊目录','NSFC Management Science Journal List')]);
    if (src === 'kr') {
      if (r.status) meta.push([T('KCI 等级','KCI Status'), koreaStatusLabel(r.status)]);
      if (r.subject_group || r.subject) meta.push([T('KCI 学科','KCI Subject'), [koreaSubjectLabel(r.subject_group), r.subject].filter(Boolean).join(' · ')]);
      if (r.kci_if_2y !== undefined && r.kci_if_2y !== '') meta.push(['KCI IF (2y)', String(r.kci_if_2y)]);
      if (r.kci_if_no_self_2y !== undefined && r.kci_if_no_self_2y !== '') meta.push([T('去自引 KCI IF','KCI IF without self-cites'), String(r.kci_if_no_self_2y)]);
      if (r.kci_self_cite_rate_2y !== undefined && r.kci_self_cite_rate_2y !== '') meta.push([T('2 年自引率','2-year self-citation rate'), `${r.kci_self_cite_rate_2y}%`]);
      if (r.kci_articles_2y !== undefined && r.kci_articles_2y !== '') meta.push([T('2 年论文数','Articles (2y)'), String(r.kci_articles_2y)]);
      if (r.kci_citations_2y !== undefined && r.kci_citations_2y !== '') meta.push([T('2 年被引次数','Citations (2y)'), String(r.kci_citations_2y)]);
      if (r.founded_year) meta.push([T('创刊年份','Founded'), String(r.founded_year)]);
      if (r.affiliated_university) meta.push([T('所属大学','Affiliated university'), r.affiliated_university]);
      meta.push([T('来源','Source'), 'National Research Foundation of Korea · KCI']);
    }
    if (r.note) meta.push([T('备注','Note'), r.note]);
    const metaHTML = meta.map(([k,v]) => `<div class="meta-row"><div class="meta-k">${k}</div><div class="meta-v">${escape(v)}</div></div>`).join('');
    const oa = ir.oa || lookupOA(ir.issn || ir.eissn ? ir : r);

    const journalIntroHTML = (() => {
      const officialText = r.official_desc || ir.official_desc || r.description || ir.description || '';
      const cats = Array.isArray(ir.wos_categories) ? ir.wos_categories.slice(0, 3) : [];
      const indexText = Array.isArray(ir.indices) && ir.indices.length ? ir.indices.join('/') : '';
      const plainName = title;
      const plainCats = cats.join(lang.startsWith('zh') ? '、' : ', ');
      const major = ir.cas_major_cn || ir.jcr_cat || cats[0] || ir.esi_category || '';
      // 判断是否为真正的中文学术期刊：必须有 CN 号或中文刊名（不止一个短横），且来自国内源
      const hasCnCode = !!r.cn_code;
      const hasRealCnName = !!r.cn_name && r.cn_name !== '-' && r.cn_name !== title;
      const isDomesticJournal = src !== 'int' && (hasCnCode || hasRealCnName);
      const domesticFields = [
        r.discipline ? tn(r.discipline, 'cssci') : '',
        r.category ? tn(r.category, 'pku') : '',
        r.domain ? tn(r.domain, 'domain') : '',
        r.subdomain ? tn(r.subdomain, 'sub') : '',
        r.ccf_area || '',
      ].filter(Boolean);
      const domesticFieldText = [...new Set(domesticFields)].slice(0, 3).join('、');
      const cnName = r.cn_name || ir.cn_name || '';
      const abbr = r.abbr20 || ir.abbr20 || '';
      const doajWeeks = parseFloat(r.doaj?.review_weeks || ir.doaj?.review_weeks);
      const showFee = canSeePublishFeeInfo();
      const apcValue = showFee
        ? (oa?.apc || oa?.apc_usd || r.doaj?.fee || ir.doaj?.fee || r.doaj?.apc_amount || ir.doaj?.apc_amount || '')
        : '';
      const apcText = apcValue
        ? (typeof apcValue === 'number'
            ? (lang.startsWith('zh') ? `版面费 APC 约 ${apcValue.toLocaleString()} USD` : `APC is approximately ${apcValue.toLocaleString()} USD`)
            : (lang.startsWith('zh') ? `版面费 APC：${apcValue}` : `APC: ${apcValue}`))
        : '';
      const reviewText = doajWeeks > 0
        ? (lang.startsWith('zh')
            ? `公开数据记录的投稿至出版周期约 ${(doajWeeks / 4.33).toFixed(1)} 个月（约 ${doajWeeks.toFixed(1)} 周）`
            : `public data records an estimated submission-to-publication cycle of ${(doajWeeks / 4.33).toFixed(1)} months (${doajWeeks.toFixed(1)} weeks)`)
        : '';
      const oaText = (() => {
        const label = oa?.l || oa?.label || '';
        const isOa = ir.cas_oa || r.cas_oa || r.doaj || ir.doaj || label === 'gold_apc' || label === 'diamond';
        // Free 用户不暴露 Hybrid/付费路径等「是否付费发表」细节
        if (!canSeePublishFeeInfo()) {
          if (lang.startsWith('zh')) return isOa ? '本刊是一本 OA 开放访问期刊' : '';
          return isOa ? 'This is an open-access journal' : '';
        }
        if (lang.startsWith('zh')) {
          if (label === 'hybrid') return '本刊为 Hybrid 期刊，可选择开放获取发表';
          if (isOa) return '本刊是一本 OA 开放访问期刊';
          return '';
        }
        if (label === 'hybrid') return 'This is a hybrid journal with optional open access publishing';
        return isOa ? 'This is an open access journal' : 'This journal is not currently marked as fully open access';
      })();
      const cnkxTiers = Array.isArray(ir.cnkx || r.cnkx)
        ? (ir.cnkx || r.cnkx).map(x => x.tier).filter(Boolean)
        : [];
      const tierText = cnkxTiers.length ? `，并入选中国科协高质量科技期刊分级目录（${[...new Set(cnkxTiers)].join(' / ')}）` : '';
      const topicList = (oa && Array.isArray(oa.tp) && oa.tp.length)
        ? oa.tp.slice(0, 4)
        : cats;
      const zhSentence = (s) => {
        const text = String(s || '').replace(/\s+/g, ' ').replace(/[，、；：:,.。\s]+$/, '');
        return text ? `${text}。` : '';
      };
      const fallbackText = lang.startsWith('zh')
        ? (isDomesticJournal
          ? [
              zhSentence(`${plainName} 是一份中文学术期刊${domesticFieldText ? `，主要关注${domesticFieldText}等方向` : ''}${r.org || r.sponsor ? `，由${r.org || r.sponsor}主办` : r.publisher ? `，出版单位为${r.publisher}` : ''}`),
              zhSentence(`${r.cn_code ? `国内统一连续出版物号：${r.cn_code}` : ''}${issn ? `${r.cn_code ? '，' : ''}ISSN：${issn}` : ''}${r.frequency ? `${(r.cn_code || issn) ? '，' : ''}出版周期：${r.frequency}` : ''}`),
              zhSentence(`${crossBadges ? '该刊已收录于本站标注的相关中文核心/评价目录' : ''}${r.tier ? `${crossBadges ? '，' : ''}科协分级：${tn(r.tier, 'tier')}` : ''}`),
              zhSentence(`${oaText}${apcText ? `${oaText ? '，' : ''}${apcText}` : ''}${reviewText ? `${(oaText || apcText) ? '，' : ''}${reviewText}` : ''}`),
            ].filter(Boolean).join(' ')
          : [
              zhSentence(`${plainName} 是一份国际学术期刊${major || plainCats ? `，主要面向${major || plainCats}等研究方向` : ''}，为相关研究成果提供发表平台`),
              zhSentence(`${cnName ? `该期刊中文名称：${cnName}` : ''}${abbr ? `${cnName ? '，' : ''}国际简称：${abbr}` : ''}${ir.cas_zone ? `${(cnName || abbr) ? '，' : ''}在中科院分区表 2025 年版中大类学科位于 ${ir.cas_zone} 区${ir.cas_top ? '，为 Top 期刊' : ''}` : ''}${ir.if_quartile ? `，JCR 分区为 ${String(ir.if_quartile).toUpperCase()}` : ''}${ir.if_2024 != null ? `，影响因子 IF ${ir.if_2024}` : ''}${ir.if_rank ? `，IF 排名 ${ir.if_rank}` : ''}${tierText}`),
              zhSentence(`${oaText}${apcText ? `${oaText ? '，' : ''}${apcText}` : ''}${reviewText ? `${(oaText || apcText) ? '，' : ''}${reviewText}` : ''}`),
              zhSentence(`${topicList.length ? `期刊聚焦 ${topicList.join('、')} 等方向` : ''}${indexText ? `${topicList.length ? '，' : ''}目前收录于 ${indexText}` : ''}`),
            ].filter(Boolean).join(' '))
        : [
            `${plainName} is an international scholarly journal for researchers in ${major || plainCats || 'related fields'}, providing a venue for new research and academic exchange.`,
            `${abbr ? `Abbreviation: ${abbr}. ` : ''}${ir.cas_zone ? `CAS 2025 major tier: ${ir.cas_zone}${ir.cas_top ? ' · Top' : ''}. ` : ''}${ir.if_quartile ? `JCR ${String(ir.if_quartile).toUpperCase()}. ` : ''}${ir.if_2024 != null ? `IF ${ir.if_2024}. ` : ''}${ir.if_rank ? `IF rank ${ir.if_rank}.` : ''}`,
            `${oaText}${apcText ? `; ${apcText}` : ''}${reviewText ? `; ${reviewText}` : ''}.`,
            `${topicList.length ? `Focus areas include ${topicList.join(', ')}. ` : ''}${indexText ? `Indexed in ${indexText}.` : ''}`,
          ].filter(Boolean).join(' ');
      const overviewTitle = officialText ? T('官方介绍','Official Description') : T('期刊概览','Journal Overview');
      const overviewBody = officialText ? escape(officialText) : escape(fallbackText);
      // 与收录/分区同级 info-grid 色块
      return {
        title: overviewTitle,
        html: `<div class="block span2 d-overview-block">
          <h3>${overviewTitle}</h3>
          <p class="d-overview-text">${overviewBody}</p>
        </div>`,
      };
    })();

    const cnkiHTML = (() => {
      if (src !== 'cnki_major' && !(r.source || '').includes('CNKI')) return '';
      const categories = Array.isArray(r.categories) && r.categories.length
        ? r.categories
        : (r.category ? [r.category] : []);
      const majors = Array.isArray(r.major_categories) ? r.major_categories.filter(Boolean) : [];
      const tags = Array.isArray(r.tags)
        ? r.tags
        : (typeof r.tags === 'string' ? r.tags.split(/[|;；,，]/).map(s => s.trim()).filter(Boolean) : []);
      const rows = [
        r.sponsor ? [T('主办单位','Sponsor'), r.sponsor] : null,
        r.cn_code ? ['CN', r.cn_code] : null,
        r.issn ? ['ISSN', r.issn] : null,
        r.compound_if ? [T('复合影响因子','Compound IF'), r.compound_if] : null,
        r.comprehensive_if ? [T('综合影响因子','Comprehensive IF'), r.comprehensive_if] : null,
        r.category_code ? [T('CNKI 分类号','CNKI Category Code'), r.category_code] : null,
      ].filter(Boolean);
      if (!rows.length && !categories.length && !majors.length && !tags.length && !r.detail_url) return '';
      return `<div class="drawer-section cnki-section">
        <h4>${T('CNKI 中文期刊信息','CNKI Journal Information')}</h4>
        ${rows.map(([k,v]) => `<div class="meta-row"><div class="meta-k">${escape(k)}</div><div class="meta-v">${escape(v)}</div></div>`).join('')}
        ${categories.length ? `<div class="cat-sub-label">${T('细分学科','Subject Categories')}</div><div class="cat-chips">${categories.map(c => `<span class="cat-chip">${escape(c)}</span>`).join('')}</div>` : ''}
        ${majors.length ? `<div class="cat-sub-label">${T('大类','Major Categories')}</div><div class="cat-chips">${majors.map(c => `<span class="cat-chip">${escape(c)}</span>`).join('')}</div>` : ''}
        ${tags.length ? `<div class="cat-sub-label">${T('标签','Tags')}</div><div class="cat-chips">${tags.map(c => `<span class="cat-chip">${escape(c)}</span>`).join('')}</div>` : ''}
        ${r.detail_url ? `<div class="meta-row"><div class="meta-k">CNKI</div><div class="meta-v"><a href="${escape(r.detail_url)}" target="_blank" rel="noopener">${T('打开 CNKI 详情页','Open CNKI detail page')}</a></div></div>` : ''}
      </div>`;
    })();

    // 解锁源收录状态（高校自编目录 2023，已解锁才显示）
    const lockedSrcHTML = (() => {
      const rows = [];
      const sa = unlockedCache.school_a;
      if (Array.isArray(sa) && sa.length) {
        const key = (r.issn || r.eissn || '').toUpperCase();
        const cn  = (r.cn_code || '').toUpperCase();
        const nm  = normTitle(r.name || r.cn_name || '');
        const hit = sa.find(x => {
          const xi = (x.issn || '').toUpperCase();
          const xc = (x.cn_code || '').toUpperCase();
          const xn = normTitle(x.name || '');
          return (key && xi && xi === key) || (cn && xc && xc === cn) || (nm && xn && xn === nm);
        });
        if (hit) {
          const tierCls = {'一级':'t1','核心':'t2','其他':'t3'}[hit.tier] || 't3';
          rows.push(`<div class="locked-src-row">
            <span class="locked-src-name">${T('高校自编目录 · 2023','In-house School Directory · 2023')}</span>
            <span class="tier-pill ${tierCls}">${escape(hit.tier || T('收录','Listed'))}</span>
            ${hit.note ? `<span class="muted-cell">· ${escape(hit.note)}</span>` : ''}
          </div>`);
        }
      }
      return rows.length
        ? `<div class="drawer-section">
             <h4>🔓 ${T('已解锁目录收录','Unlocked Directory Listings')}</h4>
             ${rows.join('')}
             <div class="muted-cell" style="margin-top:6px;font-size:12px">${T('加密目录解锁后仅本设备可见。','Unlocked encrypted directories are visible only on this device.')}</div>
           </div>`
        : '';
    })();

    // 核心指标数值 — 只放真正的"数值"，分区/Q 用徽章呈现，避免重复
    // 重复信息已删：JCR Q（→ badges）、CAS 大类区（→ casHTML）、Emerging 2026 区（→ xrHTML）
    const stats = [];
    if (ir.if_2024 != null) stats.push([T('影响因子 / IF','Impact Factor'), ir.if_2024]);
    if (ir.if_rank) stats.push([T('IF 排名','IF Rank'), ir.if_rank]);
    // 审稿周期 — 从嵌入的 DOAJ review_weeks 读取
    {
      const weeks = parseFloat(r.doaj?.review_weeks || ir.doaj?.review_weeks);
      if (weeks > 0) {
        const m = (weeks / 4.33).toFixed(1);
        stats.push([T('审稿周期','Review Cycle'), m + T(' 个月',' months'), T('投稿→出版 (DOAJ)','Submission→pub. (DOAJ)')]);
      }
    }
    // 已发表论文数量（来自 OpenAlex）
    {
      const oaWorks = oa?.w || oa?.works_count;
      if (oaWorks) {
        stats.push([T('已发表论文','Published Works'), oaWorks.toLocaleString()]);
      }
    }
    const latestIfYear = Number(ir.if_latest_year || ir.jcr_year || 2025);
    const latestReleaseYear = Number(ir.jcr_release_year || (latestIfYear + 1));
    const ifNote = ir.if_2024 != null
      ? T(`JCR ${latestReleaseYear}发布 · ${latestIfYear}指标`, `JCR ${latestReleaseYear} rel. · ${latestIfYear} metric`)
      : '';
    const statsHTML = stats.length ? `<div class="stats-grid stats-count-${Math.min(stats.length, 4)}">${stats.map(([k,v,sub]) =>
      `<div class="stat"><div class="stat-v">${escape(String(v))}</div><div class="stat-k">${k}</div>${sub?`<div class="stat-sub">${sub}</div>`:''}</div>`
    ).join('')}</div>${ifNote ? `<div class="stats-sub">${ifNote}</div>` : ''}` : '';

    const trendsHTML = (() => {
      const toPointList = (input, valueKey) => {
        if (!input) return [];
        if (Array.isArray(input)) {
          return input.map(x => ({
            year: Number(x.year),
            value: Number(x[valueKey] ?? x.value ?? x.count),
          })).filter(x => Number.isFinite(x.year) && Number.isFinite(x.value));
        }
        if (typeof input === 'object') {
          return Object.entries(input).map(([year, value]) => ({
            year: Number(year),
            value: Number(value),
          })).filter(x => Number.isFinite(x.year) && Number.isFinite(x.value));
        }
        return [];
      };
      const chart = (points, titleText, unitText, cls, options = {}) => {
        const partialYear = Number(options.partialYear || 0);
        const limit = Number(options.limit || 0);
        const sorted = points.slice().sort((a, b) => a.year - b.year);
        const limited = limit > 0 ? sorted.slice(-limit) : sorted;
        const data = limited.map(p => ({
          ...p,
          partial: partialYear && Number(p.year) >= partialYear,
        }));
        if (!data.length) return '';
        const solidData = data.filter(p => !p.partial);
        const drawable = solidData.length ? solidData : data;
        const partialDots = data.filter(p => p.partial);
        const partialPathData = partialDots.length
          ? [solidData[solidData.length - 1], ...partialDots].filter(Boolean)
          : [];
        const w = 360, h = 164, padL = 30, padR = 10, padT = 20, padB = 28;
        const xs = data.map(x => x.year);
        const ys = data.map(x => x.value);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = 0;
        let maxY = Math.max(...ys, 1);
        const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxY)) - 1));
        maxY = Math.ceil(maxY / magnitude) * magnitude;
        const xScale = (year) => padL + ((year - minX) / Math.max(1, maxX - minX)) * (w - padL - padR);
        const yScale = (value) => padT + (1 - ((value - minY) / Math.max(1, maxY - minY))) * (h - padT - padB);
        const pathFor = arr => arr.map((p, i) => `${i ? 'L' : 'M'}${xScale(p.year).toFixed(1)} ${yScale(p.value).toFixed(1)}`).join(' ');
        const solidPath = pathFor(drawable);
        const partialPath = partialPathData.length > 1 ? pathFor(partialPathData) : '';
        const first = drawable[0];
        const last = drawable[drawable.length - 1];
        const deltaSeries = data.filter(p => Number.isFinite(p.value));
        const deltaLast = deltaSeries[deltaSeries.length - 1];
        const deltaPrev = deltaSeries[deltaSeries.length - 2];
        const dots = data.map(p => `<circle class="trend-point ${p.partial ? 'trend-dot-partial' : 'trend-dot'}" cx="${xScale(p.year).toFixed(1)}" cy="${yScale(p.value).toFixed(1)}" r="${p.partial ? 2.8 : 2.4}" tabindex="0" role="button" data-year="${p.year}" data-value="${escape(String(p.value))}" data-partial="${p.partial ? '1' : ''}"><title>${p.year}: ${p.value}${p.partial ? ' (YTD)' : ''}</title></circle>`).join('');
        const labels = data.map((p, i) => {
          const y = yScale(p.value);
          const dense = data.length >= 8;
          const offset = dense
            ? (p.partial ? 16 : (i % 2 === 0 ? -7 : 12))
            : (y < padT + 12 ? 15 : -8);
          const labelY = Math.max(padT + 8, Math.min(h - padB - 4, y + offset));
          return `<text class="trend-value ${p.partial ? 'trend-value-partial' : ''}" x="${xScale(p.year).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle">${escape(String(p.value))}</text>`;
        }).join('');
        const delta = deltaLast && deltaPrev ? deltaLast.value - deltaPrev.value : null;
        const deltaText = delta == null
          ? ''
          : `${delta >= 0 ? '+' : ''}${Math.abs(delta) >= 10 ? delta.toFixed(0) : delta.toFixed(1)}`;
        const endTick = partialDots.length ? partialDots[partialDots.length - 1] : last;
        const ticks = [first, endTick].filter((p, i, arr) => i === 0 || p.year !== arr[0].year);
        const gridVals = [0, maxY * 0.5, maxY];
        const horizontalGrid = gridVals.map(v => `<line class="trend-gridline" x1="${padL}" y1="${yScale(v).toFixed(1)}" x2="${w - padR}" y2="${yScale(v).toFixed(1)}"></line>`).join('');
        const verticalGrid = data.map(p => `<line class="trend-gridline trend-gridline-vertical" x1="${xScale(p.year).toFixed(1)}" y1="${padT}" x2="${xScale(p.year).toFixed(1)}" y2="${h - padB}"></line>`).join('');
        const grid = horizontalGrid + verticalGrid;
        const fill = drawable.length > 1
          ? `<path class="trend-fill" d="${solidPath} L${xScale(last.year).toFixed(1)} ${h - padB} L${xScale(first.year).toFixed(1)} ${h - padB} Z"></path>`
          : '';
        const partialGuides = partialDots.map(p => `<line class="trend-partial-guide" x1="${xScale(p.year).toFixed(1)}" y1="${padT}" x2="${xScale(p.year).toFixed(1)}" y2="${h - padB}"></line>`).join('');
        const defaultPoint = data[data.length - 1];
        const defaultReadout = `${defaultPoint.year}: ${escape(String(defaultPoint.value))}`;
        const defaultX = Math.min(w - 72, Math.max(padL + 4, xScale(defaultPoint.year) + 8));
        const defaultY = Math.max(padT + 2, yScale(defaultPoint.value) - 28);
        return `<div class="trend-card ${cls}">
          <div class="trend-head">
            <div><div class="trend-title">${escape(titleText)}</div><div class="trend-unit">${escape(unitText)}</div></div>
            ${deltaText ? `<div class="trend-delta ${delta >= 0 ? 'up' : 'down'}">${escape(deltaText)}</div>` : ''}
          </div>
          <svg class="trend-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(titleText)}">
            ${grid}
            ${partialGuides}
            <line class="trend-axis" x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}"></line>
            <line class="trend-axis" x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}"></line>
            ${fill}
            ${drawable.length > 1 ? `<path class="trend-line" d="${solidPath}"></path>` : ''}
            ${partialPath ? `<path class="trend-line trend-line-partial" d="${partialPath}"></path>` : ''}
            ${dots}
            ${labels}
            <g class="trend-readout" transform="translate(${defaultX.toFixed(1)} ${defaultY.toFixed(1)})" data-default="${defaultReadout}">
              <rect width="64" height="24" rx="12"></rect>
              <text x="32" y="16" text-anchor="middle">${defaultReadout}</text>
            </g>
            ${data.map(p => `<text class="trend-year" x="${xScale(p.year).toFixed(1)}" y="${h - 8}" text-anchor="middle">${p.year}</text>`).join('')}
            <text class="trend-y max" x="4" y="${padT + 4}">${escape(String(maxY))}</text>
            <text class="trend-y min" x="4" y="${h - padB + 4}">0</text>
          </svg>
        </div>`;
      };
      const ifPoints = toPointList(ir.if_history, 'value');
      const pubPoints = toPointList(r.publication_history || ir.publication_history, 'count');
      const selfCitationPoints = toPointList(ir.self_citation_rate_history, 'value')
        .map(p => ({ ...p, value: Math.round(p.value * 10) / 10 }));
      const selfCitationCard = (() => {
        if (!selfCitationPoints.length) return '';
        return chart(selfCitationPoints, T('自引用率变化','Self-Citation Rate Trend'), T('JIF 自引贡献占比 (%)','JIF self-citation contribution (%)'), 'selfcite-trend', { limit: 5 });
      })();
      const countryCard = (normalizeIssnForOpenAlex(ir.issn) || normalizeIssnForOpenAlex(ir.eissn))
        ? `<div class="trend-card country-output-card">
            <div class="muted-cell country-empty">${T('正在拉取作者机构国家/地区占比…','Loading author-affiliation country/region shares…')}</div>
          </div>`
        : '';
      const pendingCard = (titleText, unitText) => `<div class="trend-card">
          <div class="trend-head"><div><div class="trend-title">${escape(titleText)}</div><div class="trend-unit">${escape(unitText)}</div></div></div>
          <div class="muted-cell country-empty">${T('正在加载完整指标…','Loading full metrics…')}</div>
        </div>`;
      const ifCard = chart(ifPoints, T('近 5 年影响因子','5-Year Impact Factor Trend'), T('JIF by metric year','JIF by metric year'), 'if-trend', { limit: 5 })
        || pendingCard(T('近 5 年影响因子','5-Year Impact Factor Trend'), T('JIF by metric year','JIF by metric year'));
      const pubCard = chart(pubPoints, T('近 10 年逐年发文量','10-Year Annual Publication Output'), T('源自 OpenAlex','From OpenAlex'), 'pub-trend', { partialYear: 2026, limit: 10 })
        || pendingCard(T('近 10 年逐年发文量','10-Year Annual Publication Output'), T('源自 OpenAlex','From OpenAlex'));
      const selfCard = selfCitationCard
        || pendingCard(T('自引用率变化','Self-Citation Rate Trend'), T('JIF 自引贡献占比 (%)','JIF self-citation contribution (%)'));
      const cards = [
        ifCard,
        pubCard,
        selfCard,
        countryCard,
      ].filter(Boolean);
      if (!cards.length) return '';
      return `<div class="drawer-section trends-section">
        <h4>${T('指标趋势','Metric Trends')}</h4>
        <div class="trend-grid">${cards.join('')}</div>
      </div>`;
    })();

    const countryOutputHTML = '';

    const jcrHTML = (() => {
      const q = ir.if_quartile ? String(ir.if_quartile).toUpperCase() : '';
      const mainCat = ir.jcr_cat || (Array.isArray(ir.jcr_cats) ? ir.jcr_cats[0] : '');
      const cats = Array.isArray(ir.jcr_cats) && ir.jcr_cats.length
        ? ir.jcr_cats
        : (mainCat ? [mainCat] : []);
      if (!mainCat && !cats.length && !q && !ir.if_rank) return '';
      const majorLine = `<div class="cat-major-line">
        <span class="cat-major-name">${T('JCR 主类','JCR Primary Category')}</span>
        ${mainCat ? `<span class="cat-major-zone">${escape(mainCat)}</span>` : ''}
        ${q ? `<span class="cat-major-zone jcr-${q.toLowerCase()}">${q}</span>` : ''}
        ${ir.if_rank ? `<span class="cat-major-rank">${T('IF 排名','IF Rank')} ${escape(ir.if_rank)}</span>` : ''}
      </div>`;
      const items = cats.map(c => `<li>${escape(c)}${q ? ` · <b>${q}</b>` : ''}</li>`).join('');
      return `<div class="drawer-section jcr-section">
        <h4>${T(`JCR ${latestReleaseYear} 学科分区`, `JCR ${latestReleaseYear} Subject Categories`)}</h4>
        ${majorLine}
        ${items ? `<div class="cat-sub-label">${T('小类 / 学科分类','Subject Categories')}</div><ul class="cas-sub-list">${items}</ul>` : ''}
      </div>`;
    })();

    // WoS 学科分类
    const wosHTML = (Array.isArray(ir.wos_categories) && ir.wos_categories.length)
      ? `<div class="drawer-section">
           <h4>${T('Web of Science 分类','Web of Science Categories')}</h4>
           <div class="cat-chips">${ir.wos_categories.map(c => `<span class="cat-chip">${escape(c)}</span>`).join('')}</div>
           ${ir.esi_category ? `<div class="esi-row"><span class="esi-label">${T('ESI 高被引学科','ESI Highly-Cited Field')}</span><span class="esi-val">${escape(ir.esi_category)}</span></div>` : ''}
         </div>`
      : '';

    // Scopus ASJC 顶层学科（来自 Scopus Source List Mar.2026）
    const wosHistoryHTML = (() => {
      const historical = ir.wos_historical;
      if (!historical) return '';
      const oldIndexes = Array.isArray(historical.indices) ? historical.indices.filter(Boolean) : [];
      const currentIndexes = Array.isArray(historical.current_indices) ? historical.current_indices.filter(Boolean) : [];
      if (!oldIndexes.length) return '';
      const firstAbsent = historical.first_absent || historical.as_of || '';
      const verifiedOn = historical.current_verified_on || '';
      const currentStatus = currentIndexes.length
        ? `${T('已转入','Transferred to')} ${escape(currentIndexes.join(' / '))}`
        : T('当前不在 Web of Science Core Collection','Not currently in the Web of Science Core Collection');
      return `<div class="drawer-section">
        <h4>${T('Web of Science 收录变更','Web of Science Coverage Change')}</h4>
        <div class="meta-row"><div class="meta-k">${T('原收录索引','Previous indexes')}</div><div class="meta-v"><strong>${escape(oldIndexes.join(' / '))}</strong></div></div>
        <div class="meta-row"><div class="meta-k">${T('当前状态','Current status')}</div><div class="meta-v"><strong>${currentStatus}</strong></div></div>
        ${firstAbsent ? `<div class="meta-row"><div class="meta-k">${T('首次确认缺席','First confirmed absent')}</div><div class="meta-v">${escape(firstAbsent)} ${T('版名单','list')}</div></div>` : ''}
        ${verifiedOn ? `<div class="meta-row"><div class="meta-k">${T('最近再次核对','Latest recheck')}</div><div class="meta-v">${escape(verifiedOn)} ${T('版 MJL 仍无现行记录','MJL still has no current record')}</div></div>` : ''}
        ${historical.last_jcr_year ? `<div class="meta-row"><div class="meta-k">${T('最近 JCR 指标年度','Latest JCR metric year')}</div><div class="meta-v">${escape(historical.last_jcr_year)} <span class="muted-cell">${T('不代表当前仍收录','does not imply current coverage')}</span></div></div>` : ''}
        <div class="meta-row"><div class="meta-k">${T('剔除日期 / 原因','Removal date / reason')}</div><div class="meta-v">${T('Clarivate 公开名单未披露','Not disclosed in Clarivate’s public list')}</div></div>
        <div class="muted-cell" style="margin-top:8px">${T('说明：这里的日期是本站首次确认其不在现行名单中的日期，不等同于 Clarivate 的内部决定日期。','Note: this is the first list where we confirmed the title absent, not Clarivate’s internal decision date.')}</div>
      </div>`;
    })();

    const scopusTopList = (() => {
      const sc = ir.scopus;
      if (!sc) return [];
      const tops = Array.isArray(sc.asjc_top) ? [...sc.asjc_top] : [];
      // ASJC 1000 = Multidisciplinary 是独立顶级，源表里 asjc_top 为空，前端兜底
      if (!tops.length && Array.isArray(sc.asjc) && sc.asjc.includes('1000')) {
        tops.push('Multidisciplinary');
      }
      return tops;
    })();
    const scopusHTML = (ir.scopus && (scopusTopList.length || ir.scopus.id))
      ? `<div class="drawer-section">
           <h4>${T('Scopus 学科分类','Scopus Subject Area')}</h4>
           ${scopusTopList.length ? `<div class="cat-chips">${scopusTopList.map(asjcTopChip).join('')}</div>` : ''}
           ${ir.scopus.id ? `<div class="muted-cell" style="margin-top:6px;font-size:12px">Scopus ID: ${escape(ir.scopus.id)}${ir.scopus.active === false ? ` · ${T('已停止收录','no longer indexed')}` : ''}</div>` : ''}
         </div>`
      : '';

    // Ei Compendex 主题分类
    const eiHTML = (() => {
      const subjects = Array.isArray(ir.ei_subjects) ? ir.ei_subjects : [];
      const historical = ir.ei_historical || null;
      if (!subjects.length && !historical) return '';
      const year = historical && historical.final_year ? historical.final_year : '';
      const finalIssue = historical
        ? [historical.final_volume ? `${T('卷','Vol.')} ${historical.final_volume}` : '', historical.final_issue ? `${T('期','Issue')} ${historical.final_issue}` : ''].filter(Boolean).join(' · ')
        : '';
      const statusHTML = historical
        ? `<div class="meta-row"><div class="meta-k">${T('收录状态','Indexing status')}</div><div class="meta-v"><strong>${T('已停止收录','Discontinued')}</strong>${year ? ` · ${T('收录截至','Covered through')} ${escape(year)}` : ''}${finalIssue ? ` · ${escape(finalIssue)}` : ''}</div></div>
           <div class="muted-cell" style="margin-top:8px">${T('本刊仅保留 EI 历史收录记录，不属于当前活跃 EI 期刊。','This title is retained as a historical EI record and is not currently indexed by EI.')}</div>`
        : '';
      return `<div class="drawer-section">
        <h4>${T('EI Compendex 收录信息','EI Compendex Coverage')}</h4>
        ${statusHTML}
        ${subjects.length ? `<div class="cat-chips">${subjects.map(c => `<span class="cat-chip">${escape(c)}</span>`).join('')}</div>` : ''}
      </div>`;
    })();

    // 中科院完整层级（2025 大类分区）— 大类 + 小类列表
    const casHTML = (() => {
      const hasMajor = ir.cas_major_cn || ir.cas_zone;
      const hasSub = Array.isArray(ir.cas_sub_cats) && ir.cas_sub_cats.length;
      if (!hasMajor && !hasSub) return '';
      const majorLine = hasMajor ? `<div class="cat-major-line">
        ${ir.cas_major_cn ? `<span class="cat-major-name">${escape(ir.cas_major_cn)}</span>` : ''}
        ${ir.cas_zone ? `<span class="cat-major-zone">${ir.cas_zone}${T('区','')}${ir.cas_top ? ' · Top' : ''}</span>` : ''}
      </div>` : '';
      const items = hasSub ? ir.cas_sub_cats.map(s => {
        const nm = typeof s === 'string' ? s : (s.name || '');
        const zn = typeof s === 'object' ? s.zone : null;
        return `<li>${escape(nm)}${zn ? ` · <b>${zn}${T('区','')}</b>` : ''}</li>`;
      }).join('') : '';
      return `<div class="drawer-section">
        <h4>${T('中科院 2025 大类分区','CAS 2025 · Major Tier')}</h4>
        ${majorLine}
        ${hasSub ? `<div class="cat-sub-label">${T('小类','Sub-fields')}</div><ul class="cas-sub-list">${items}</ul>` : ''}
      </div>`;
    })();

    // 中科院新锐版 2026 — 大类 + 小类列表
    const xrHTML = (() => {
      const xr = ir.cas_xr;
      if (!xr) return '';
      const hasMajor = xr.major_cn || xr.zone;
      const hasSub = Array.isArray(xr.sub) && xr.sub.length;
      if (!hasMajor && !hasSub) return '';
      const majorLine = hasMajor ? `<div class="cat-major-line">
        ${xr.major_cn ? `<span class="cat-major-name">${escape(xr.major_cn)}</span>` : ''}
        ${xr.zone ? `<span class="cat-major-zone">${xr.zone}${T('区','')}</span>` : ''}
      </div>` : '';
      const items = hasSub ? xr.sub.map(s => {
        const nm = s.cat || s.name || '';
        const zn = s.zone;
        return `<li>${escape(nm)}${zn ? ` · <b>${zn}${T('区','')}</b>` : ''}</li>`;
      }).join('') : '';
      return `<div class="drawer-section">
        <h4>${T('新锐版 2026','Emerging 2026')}</h4>
        ${majorLine}
        ${hasSub ? `<div class="cat-sub-label">${T('小类','Sub-fields')}</div><ul class="cas-sub-list">${items}</ul>` : ''}
      </div>`;
    })();

    // 中国科协高质量科技期刊分级目录 (2025-12 修订)
    const cnkxHTML = (Array.isArray(r.cnkx) && r.cnkx.length)
      ? `<div class="drawer-section">
           <h4>${T('中国科协高质量科技期刊分级目录 · 2025-12 版','CAST High-Quality Sci-Tech Journal Tiered Directory · Dec 2025')}</h4>
           <ul class="cas-sub-list">${r.cnkx.map(c =>
             `<li><b>${escape(c.tier||'')}</b>${c.domain ? ' · ' + escape(c.domain) : ''}${c.subdomain ? ' <span class="muted-cell">· '+escape(c.subdomain)+'</span>' : ''}</li>`
           ).join('')}</ul>
           <div class="muted-cell" style="margin-top:6px;font-size:12px;line-height:1.6">${T('同一刊在多个学科领域分别评定 T1 / T2 / T3，互不冲突。','A journal can be tiered T1/T2/T3 separately in multiple disciplines without conflict.')}</div>
         </div>`
      : '';

    const indiaHit = src === 'in' ? { ...r, journal_title: r.journal_title || r.name } : lookupIndia(ir.issn || ir.eissn ? ir : r);
    const indiaHTML = indiaHit ? `<div class="drawer-section india-detail-section">
      <h4>${T('印度 UGC-CARE 收录','India UGC-CARE Listing')}</h4>
      <div class="meta-row"><div class="meta-k">${T('状态','Status')}</div><div class="meta-v"><span class="domsrc-pill ds-india">UGC-CARE listed</span></div></div>
      ${indiaHit.subject ? `<div class="meta-row"><div class="meta-k">${T('学科','Subject')}</div><div class="meta-v">${escape(indiaHit.subject)}</div></div>` : ''}
      ${indiaHit.publisher ? `<div class="meta-row"><div class="meta-k">${T('出版社','Publisher')}</div><div class="meta-v">${escape(indiaHit.publisher)}</div></div>` : ''}
      ${indiaHit.source_url ? `<div class="meta-row"><div class="meta-k">${T('来源','Source')}</div><div class="meta-v"><a href="${escape(indiaHit.source_url)}" target="_blank" rel="noopener nofollow">UGC-CARE PDF source</a></div></div>` : ''}
      <div class="muted-cell" style="margin-top:6px;font-size:12px;line-height:1.6">${t('india_source_note')}</div>
    </div>` : '';

    const malaysiaHTML = src === 'my' ? `<div class="drawer-section malaysia-detail-section">
      <h4>${T('马来西亚 / ERA 来源','Malaysia / ERA Source')}</h4>
      <div class="meta-row"><div class="meta-k">${T('来源','Source')}</div><div class="meta-v"><span class="domsrc-pill ds-malaysia">${escape(r.source || 'MyCite / ERA')}</span></div></div>
      ${r.publisher ? `<div class="meta-row"><div class="meta-k">${T('出版社','Publisher')}</div><div class="meta-v">${escape(r.publisher)}</div></div>` : ''}
      ${r.indexed_year ? `<div class="meta-row"><div class="meta-k">${T('MyCite 年份','MyCite Year')}</div><div class="meta-v">${escape(r.indexed_year)}</div></div>` : ''}
      ${r.era_year ? `<div class="meta-row"><div class="meta-k">ERA</div><div class="meta-v">${escape(r.era_year)}</div></div>` : ''}
      ${r.for_subjects ? `<div class="meta-row"><div class="meta-k">${T('FoR 学科','FoR Subjects')}</div><div class="meta-v">${escape(r.for_subjects)}</div></div>` : ''}
      ${malaysia?.official_pdf?.url ? `<div class="meta-row"><div class="meta-k">MyCite PDF</div><div class="meta-v"><a href="${escape(malaysia.official_pdf.url)}" target="_blank" rel="noopener nofollow">MyCite 2025 RASMI</a></div></div>` : ''}
      <div class="muted-cell" style="margin-top:6px;font-size:12px;line-height:1.6">${t('malaysia_source_note')}</div>
    </div>` : '';

    // 警示刊
    const warnHTML = (() => {
      const w = ir.warning;
      if (!w) return '';
      // 兼容旧值（true / 字符串）
      if (typeof w !== 'object') {
        return `<div class="drawer-section warn-block">
           <h4>⚠ ${T('警示期刊提示','Warning Journal Notice')}</h4>
           <p>${T('该刊被中科院纳入国际期刊预警名单。投稿前请谨慎评估，留意审稿周期、版面费、学术影响等因素。','This journal is included in the CAS International Journal Warning List. Evaluate carefully before submission — review cycle, APC, and academic impact.')}</p>
         </div>`;
      }
      const rows = [];
      if (w.year)    rows.push([T('发布年份','Year'),   escape(String(w.year))]);
      if (w.level)   rows.push([T('预警级别','Level'),  escape(w.level)]);
      if (w.reason)  rows.push([T('预警原因','Reason'), escape(w.reason)]);
      if (w.subject) rows.push([T('学科','Subject'),    escape(w.subject)]);
      const meta = rows.length
        ? `<div class="oa-rows">${rows.map(([k,v]) =>
            `<div class="meta-row"><div class="meta-k">${k}</div><div class="meta-v">${v}</div></div>`
          ).join('')}</div>`
        : '';
      const src = w.source ? `<div class="muted-cell" style="margin-top:8px;font-size:12px;line-height:1.6">${T('数据来源：','Source: ')}${escape(w.source)}</div>` : '';
      return `<div class="drawer-section warn-block">
           <h4>⚠ ${T('警示期刊提示','Warning Journal Notice')}</h4>
           <p>${T('该刊被中科院纳入','This journal is included in the CAS')} ${escape(String(w.year || T('最新','latest')))} ${T('年国际期刊预警名单。投稿前请谨慎评估。','International Journal Warning List. Evaluate carefully before submission.')}</p>
           ${meta}
           ${src}
         </div>`;
    })();

    // OpenAlex enriched block (homepage / OA / APC — 版面费细节 Pro+)
    const oaHTML = oa ? (() => {
      const showFee = canSeePublishFeeInfo();
      const labelMap = {
        diamond:                 { text: T('Diamond OA · 读投全免费','Diamond OA · free to read & publish'),   cls: 'oa-diamond',  desc: T('由机构/基金全额资助，作者读者都不付费。','Fully funded by institutions / grants. No fees for authors or readers.') },
        gold_apc:                { text: T('Gold OA · 投稿付 APC','Gold OA · APC paid by author'),       cls: 'oa-gold',     desc: T('全刊开放获取，作者支付版面费（APC）。','Fully open-access; author pays the APC.') },
        hybrid:                  { text: T('Hybrid · 可选 OA','Hybrid · optional OA'),           cls: 'oa-hybrid',   desc: T('订阅制刊，可选付 APC 开放单篇。','Subscription journal; optional APC to open individual articles.') },
        subscription_paid_read:  { text: T('订阅制 · 读付费','Subscription · paid read'),            cls: 'oa-sub',      desc: T('读者需订阅，作者投稿通常免费（个别收 page charge）。','Readers subscribe; authors usually free (some charge page fees).') },
        unknown:                 { text: T('付费模式未知','OA model unknown'),               cls: 'oa-unk',      desc: '' },
      };
      // Normalize both compact (hp/l/oa/dj/apc/org/w) and verbose shapes
      const label   = oa.l || oa.label || 'unknown';
      const L       = showFee ? (labelMap[label] || labelMap.unknown) : null;
      const homepage= oa.hp || oa.homepage;
      const isoa    = oa.oa ?? oa.is_oa;
      const doaj    = oa.dj ?? oa.in_doaj;
      const org     = oa.org || oa.host_org;
      const works   = oa.w   || oa.works_count;
      const doajFee = ir.doaj?.fee || ir.doaj?.apc_amount || '';
      const apcText = showFee
        ? ((ir.doaj?.apc === 'Yes' && doajFee) ? doajFee : (ir.doaj?.apc === 'Yes' ? T('有 APC','Has APC') : ''))
        : '';
      const doajBadge = doaj ? `<span class="oa-chip oa-doaj">&check; ${T('收录 DOAJ','In DOAJ')}</span>` : '';
      const isoaBadge = isoa ? '<span class="oa-chip oa-isoa">Open Access</span>' : '';
      const freeBadge = showFee && (isFreeToPublish(ir) || isFreeToPublish(r))
        ? `<span class="oa-chip oa-free" title="${T('作者可选择免费发表路径（Diamond / Hybrid / 订阅制等）','Author-free publishing path available (Diamond / Hybrid / subscription, etc.)')}">${T('✓ 免费发表','✓ FREE TO PUBLISH')}</span>`
        : '';
      const lockBadge = !showFee
        ? `<button type="button" class="oa-chip oa-lock" data-publish-fee-lock>${T('发表费用 · Pro 可见','Publish fees · Pro')}</button>`
        : '';
      const rows = [];
      if (homepage) rows.push([T('官网','Website'), `<a href="${escape(homepage)}" target="_blank" rel="noopener nofollow">${escape(homepage.replace(/^https?:\/\//,'').replace(/\/$/,''))}</a>`]);
      if (apcText) rows.push([T('版面费 (APC)','APC'), escape(apcText)]);
      if (org) rows.push([T('出版方 (OpenAlex)','Publisher (OpenAlex)'), escape(org)]);
      if (works) rows.push([T('已发表论文','Published works'), works.toLocaleString() + T(' 篇','')]);
      return `<div class="drawer-section oa-section">
        <h4>${showFee ? T('开放获取 / 版面费','Open Access / APC') : T('开放获取','Open Access')}</h4>
        <div class="oa-head">
          ${L ? `<span class="oa-pill ${L.cls}">${L.text}</span>` : ''}
          ${doajBadge}${isoaBadge}${freeBadge}${lockBadge}
        </div>
        ${L && L.desc ? `<div class="oa-desc muted">${L.desc}</div>` : ''}
        ${!showFee ? `<div class="oa-desc muted">${T('是否免费发表、APC 金额等费用信息对 Free 隐藏，升级 Pro 后可见。','Whether authors pay to publish and APC details are hidden on Free. Upgrade to Pro to view.')}</div>` : ''}
        ${rows.length ? `<div class="oa-rows">${rows.map(([k,v]) =>
          `<div class="meta-row"><div class="meta-k">${k}</div><div class="meta-v">${v}</div></div>`
        ).join('')}</div>` : ''}
      </div>`;
    })() : '';

    // OpenAlex 主要研究领域 (topics)
    const topicsHTML = (oa && Array.isArray(oa.tp) && oa.tp.length)
      ? `<div class="drawer-section">
           <h4>${T('主要研究领域','Research Topics')}</h4>
           <div class="cat-chips">${oa.tp.map(t => `<span class="cat-chip">${escape(t)}</span>`).join('')}</div>
           <div class="muted-cell" style="margin-top:6px;font-size:12px">${T('数据来源：OpenAlex snapshot 2026-05','Source: OpenAlex snapshot 2026-05')}</div>
         </div>`
      : '';

    // OAJ 全球开放获取期刊索引
    const oajHTML = ir.oaj ? `<div class="drawer-section">
      <h4>${T('OAJ 全球开放获取期刊索引','OAJ — Open Access Journal Index')}</h4>
      <div class="muted-cell" style="font-size:12px">
        ${ir.oaj.partition ? `${T('OAJ 分区','OAJ Tier')}: ${escape(ir.oaj.partition)}` : ''}
        ${ir.oaj.partition && ir.oaj.position ? ' · ' : ''}
        ${ir.oaj.position ? escape(ir.oaj.position) : ''}
      </div>
      <div class="muted-cell" style="font-size:11px;margin-top:4px">
        ${T('由中国科学院文献情报中心与中国教育图书进出口有限公司共建，数据更新周期3个月。','Developed by CAS. Updated quarterly.')}
      </div>
    </div>` : '';

    // PubMed 数据库收录
    const pubmedHTML = r.pubmed ? `<div class="drawer-section">
      <h4>${T('PubMed 数据库收录','Included in PubMed')}</h4>
      <div class="muted-cell" style="font-size:12px">
        ${T('期刊被 PubMed 数据库收录，包含 NLM 精选索引的引文数据。','Journal is included in PubMed, the NLM citation database.')}
      </div>
    </div>` : '';

    // PMC 全文存档
    const pmcHTML = r.pmc ? `<div class="drawer-section">
      <h4>${T('PMC 全文存档','Archived in PubMed Central')}</h4>
      <div class="muted-cell" style="font-size:12px">
        ${T('期刊全文存储在 PubMed Central（PMC），NLM 的免费数字档案库。','Full text stored in PubMed Central (PMC), NLM\'s free digital archive.')}
      </div>
    </div>` : '';

    const doajHTML = ir.doaj ? `<div class="drawer-section">
      <h4>${T('DOAJ 开放获取期刊目录','DOAJ — Directory of Open Access Journals')}</h4>
      <div class="meta-row"><div class="meta-k">${T('许可证','License')}</div><div class="meta-v">${escape(ir.doaj.lic || ir.doaj.license || '—')}</div></div>
      ${canSeePublishFeeInfo()
        ? `<div class="meta-row"><div class="meta-k">APC</div><div class="meta-v">${escape(ir.doaj.apc || '—')}${(ir.doaj.fee || ir.doaj.apc_amount) ? ` · ${escape(ir.doaj.fee || ir.doaj.apc_amount)}` : ''}</div></div>`
        : `<div class="meta-row"><div class="meta-k">APC</div><div class="meta-v"><button type="button" class="linkish" data-publish-fee-lock>${T('Pro 可见','Pro only')}</button></div></div>`}
      <div class="meta-row"><div class="meta-k">${T('同行评议','Peer review')}</div><div class="meta-v">${escape(ir.doaj.review || ir.doaj.review_process || '—')}</div></div>
      ${ir.doaj.du || ir.doaj.doaj_url ? `<div class="meta-row"><div class="meta-k">DOAJ</div><div class="meta-v"><a href="${escape(ir.doaj.du || ir.doaj.doaj_url)}" target="_blank" rel="noopener">${T('打开目录页','Open directory page')}</a></div></div>` : ''}
      <div class="muted-cell" style="font-size:11px;margin-top:4px">
        ${T('数据来源：DOAJ Journal CSV。免费 CSV 可能较完整数据滞后。','Source: DOAJ Journal CSV. The free CSV may lag the full data dump.')}
      </div>
    </div>` : '';

    // 审稿周期已合并入 stats，此处保留空块以兼容（不输出）
    const cycleHTML = '';

    const on = isFav(r);
    // ── V9 详情：主列（头+双栏信息+图表）| 右侧快捷栏 ──
    const jcrQ = ir.if_quartile ? String(ir.if_quartile).toUpperCase() : '';
    const casZoneLabel = ir.cas_zone != null && ir.cas_zone !== ''
      ? `${ir.cas_zone}${T('区','')}${ir.cas_top ? ' TOP' : ''}`
      : '';
    let cycleShort = '';
    {
      const weeks = parseFloat(r.doaj?.review_weeks || ir.doaj?.review_weeks);
      if (weeks > 0) cycleShort = `~${Math.round(weeks * 7)}d`;
      else if (r.crossref?.median_days) cycleShort = `~${Math.round(+r.crossref.median_days)}d`;
    }
    const isOaMark = !!(ir.cas_oa || r.cas_oa || r.doaj || ir.doaj || r.oaj || ir.oaj || (ir.oa && ir.oa.l));
    const ifNum = ir.if_2024 != null ? (+ir.if_2024).toFixed(1) : '';
    const ifYearLabel = ir.if_2024 != null
      ? `IF ${Number(ir.if_latest_year || ir.jcr_year || 2025)}`
      : 'IF';
    const subjectLine = (Array.isArray(ir.wos_categories) && ir.wos_categories[0])
      || ir.jcr_cat || ir.cas_major_cn || ir.esi_category || r.discipline || '';
    const publisherLine = r.publisher || ir.publisher || '';
    const siteUrl = r.homepage || ir.homepage || r.url || ir.url || r.website || '';
    const submitUrl = r.submit_url || ir.submit_url || siteUrl || '';
    const heroMetrics = [
      jcrQ ? `<div class="d-m"><div class="n">${escape(jcrQ)}</div><div class="l">JCR</div></div>` : '',
      casZoneLabel ? `<div class="d-m"><div class="n">${escape(casZoneLabel)}</div><div class="l">${T('中科院','CAS')}</div></div>` : '',
      cycleShort ? `<div class="d-m"><div class="n">${escape(cycleShort)}</div><div class="l">${T('审稿','Review')}</div></div>` : '',
      isOaMark ? `<div class="d-m"><div class="n">OA</div><div class="l">${T('开放','Open')}</div></div>` : '',
    ].filter(Boolean).join('');
    const kvExtras = [
      issn ? [T('ISSN','ISSN'), issn] : null,
      eissn ? [T('eISSN','eISSN'), eissn] : null,
      siteUrl ? [T('官网','Website'), siteUrl] : null,
      subjectLine ? [T('学科','Subject'), subjectLine] : null,
    ].filter(Boolean);
    const seenKeys = new Set(meta.map(([k]) => k));
    const kvAll = [
      ...kvExtras.filter(([k]) => !seenKeys.has(k)),
      ...meta,
    ].map(([k, v]) =>
      `<div class="kv-item"><div class="k">${k}</div><div class="v">${
        (k === T('官网','Website') || String(v).startsWith('http'))
          ? `<a href="${escape(String(v))}" target="_blank" rel="noopener">${escape(String(v).replace(/^https?:\/\//, '').slice(0, 48))}</a>`
          : escape(String(v))
      }</div></div>`
    ).join('');
    const relatedSide = (() => {
      const related = getRelatedJournals(r, 4);
      if (!related.length) return '';
      return related.map(j => {
        const name = titleCase(j.name || j.cn_name || '');
        const ifv = j.if_2024 != null ? (+j.if_2024).toFixed(1) : '—';
        return `<div class="side-link related-card" data-fid="${escape(favId(j))}" role="button" tabindex="0"><span class="side-link-name">${escape(name)}</span><span class="side-link-if">${escape(ifv)}</span></div>`;
      }).join('');
    })();
    const riskEmpty = !drawerRiskBadges
      ? `<div class="d-none">${T('暂无预警 / On-hold','No warning / On-hold')}</div>`
      : `<div class="pills badges">${drawerRiskBadges}</div>`;
    const accessEmpty = !drawerAccessBadges
      ? `<div class="d-none">—</div>`
      : `<div class="pills badges">${drawerAccessBadges}</div>`;

    body.innerHTML = `
      <div class="detail-layout${pageMode ? ' is-page' : ' is-drawer'}">
        <div class="detail-main-col">
          <div class="d-hero">
            <div class="d-hero-row">
              <div class="d-hero-text">
                <h1 class="drawer-title">${escape(title.replace(/\*$/,''))}</h1>
                ${sub ? `<div class="d-cn drawer-sub">${escape(sub)}</div>` : ''}
                ${(subjectLine || publisherLine) ? `<div class="d-subj">${subjectLine ? `<b>${escape(subjectLine)}</b>` : ''}${subjectLine && publisherLine ? ' · ' : ''}${publisherLine ? escape(publisherLine) : ''}</div>` : ''}
                ${titleFeatureBadges ? `<div class="d-hero-free">${titleFeatureBadges}</div>` : ''}
                <div class="drawer-issn d-issn">
                  ${issn ? 'ISSN ' + escape(issn) : ''}${eissn ? (issn ? ' · ' : '') + 'eISSN ' + escape(eissn) : ''}
                  <span class="drawer-views" id="drawer-views" data-fid="${escape(favId(r))}"></span>
                </div>
              </div>
              <div class="d-actions">
                ${ifNum ? `<div class="d-if"><strong>${escape(ifNum)}</strong><span>${escape(ifYearLabel)}</span></div>` : ''}
                <div class="d-btns">
                  <button type="button" class="d-btn star ${on ? 'on' : ''}" id="drawer-fav-big" aria-label="${on ? T('已收藏','Favorited') : T('收藏','Favorite')}">${on ? '★' : '☆'}</button>
                  ${siteUrl ? `<a class="d-btn ghost" href="${escape(siteUrl)}" target="_blank" rel="noopener">${T('官网','Site')}</a>` : ''}
                  ${submitUrl ? `<a class="d-btn primary" href="${escape(submitUrl)}" target="_blank" rel="noopener">${T('投稿','Submit')}</a>` : ''}
                </div>
                ${favLists.length > 1 ? `<div class="drawer-fav-select">
                  <select id="drawer-fav-list-select" aria-label="${T('保存到清单','Save to list')}">${favLists.map(l => `<option value="${escape(l.id)}" ${l.id===activeListId?'selected':''}>${escape(favListDisplayName(l))} (${l.ids.length})</option>`).join('')}</select>
                </div>` : ''}
              </div>
            </div>
            ${heroMetrics ? `<div class="d-metrics">${heroMetrics}</div>` : ''}
          </div>

          <div class="info-grid">
            ${drawerCoverageBadges ? `<div class="block"><h3>${T('收录','Indexed')}</h3><div class="pills badges">${drawerCoverageBadges}</div></div>` : ''}
            ${(drawerLevelBadges || tierBadge || crossBadges) ? `<div class="block"><h3>${T('分区','Ranking')}</h3><div class="pills badges">${drawerLevelBadges || ''}${tierBadge || ''}${crossBadges || ''}</div></div>` : ''}
            <div class="block"><h3>${T('风险','Risk')}</h3>${riskEmpty}</div>
            <div class="block"><h3>${T('开放与费用','Access & fees')}</h3>${accessEmpty}</div>
            ${kvAll ? `<div class="block span2"><h3>${T('基本信息','Basics')}</h3><div class="kv2">${kvAll}</div></div>` : ''}
            ${journalIntroHTML && journalIntroHTML.html ? journalIntroHTML.html : ''}
          </div>

          ${trendsHTML || countryOutputHTML ? `<div class="section-title">${T('数据图表','Charts')}</div>
          <div class="detail-charts">${trendsHTML}${countryOutputHTML}</div>` : ''}

          <div class="detail-more journal-detail-masonry">
            ${jcrHTML}
            ${casHTML}
            ${xrHTML}
            ${wosHTML}
            ${wosHistoryHTML}
            ${scopusHTML}
            ${eiHTML}
            ${oajHTML}
            ${doajHTML}
            ${pubmedHTML}
            ${pmcHTML}
            ${cycleHTML}
            ${oaHTML}
            ${topicsHTML}
            ${warnHTML}
            ${cnkiHTML}
            ${cnkxHTML}
            ${indiaHTML}
            ${malaysiaHTML}
            ${lockedSrcHTML}
            ${!pageMode ? renderRelatedHTML(r) : ''}
          </div>
        </div>

        <aside class="detail-side-col" aria-label="${T('快捷','Shortcuts')}">
          <div class="side-h">${T('快捷','Shortcuts')}</div>
          <div class="side-card">
            <button type="button" class="side-link" id="side-fav-proxy">${on ? T('已收藏','Favorited') : T('收藏','Favorite')} <span>${on ? '★' : '☆'}</span></button>
            <button type="button" class="side-link" id="side-share-proxy">${T('分享','Share')} <span>↗</span></button>
            ${siteUrl ? `<a class="side-link" href="${escape(siteUrl)}" target="_blank" rel="noopener">${T('官网','Website')} <span>→</span></a>` : ''}
            ${submitUrl ? `<a class="side-link" href="${escape(submitUrl)}" target="_blank" rel="noopener">${T('投稿','Submit')} <span>→</span></a>` : ''}
          </div>
          <div class="side-h">${T('我的评分','My Rating')}</div>
          <div class="side-card side-rating-card rating-section" data-rating-key="${escape(favId(r))}">
            <div class="rating-my-wrap">
              <div class="rating-stars-input" id="rating-input" role="radiogroup" aria-label="${T('评分','Rating')}"></div>
              <div class="rating-my-hint muted-cell" id="rating-hint">${T('登录后可打分 · 半星可评 · 可随时修改','Sign in to rate · half-stars supported · editable anytime')}</div>
            </div>
            <div class="rating-pill" data-rating-key="${escape(favId(r))}" title="${T('综合推荐评分','Overall rating')}">
              <span class="rating-avg" id="rating-avg">—</span><span class="rating-avg-suffix">/ 5</span>
              <span class="rating-avg-stars" id="rating-avg-stars"></span>
              <span class="rating-count muted-cell" id="rating-count">${T('暂无评分','No ratings yet')}</span>
            </div>
          </div>
          ${relatedSide ? `<div class="side-h">${T('相关','Related')}</div><div class="side-card side-related">${relatedSide}</div>` : ''}
        </aside>
      </div>
    `;
    // 侧栏收藏/分享代理到头部按钮
    body.querySelector('#side-fav-proxy')?.addEventListener('click', () => $('#drawer-fav-big')?.click());
    body.querySelector('#side-share-proxy')?.addEventListener('click', () => $('#drawer-share')?.click());
    // init rating widget
    setTimeout(() => initRatingWidget(favId(r)), 0);
    hydrateCountryOutputChart(body, ir);
    // light 库无 if_history / publication_history / 自引史 → 趋势图空白。
    // 打开详情后立刻补 full，再 soft 重绘四张图（full_upgrade 不计次）。
    if (!softRefresh && (src === 'int' || intRec)) {
      const needFullCharts = !Array.isArray(ir.if_history) || !ir.if_history.length
        || !Array.isArray(ir.publication_history || r.publication_history)
        || !(ir.publication_history || r.publication_history || []).length;
      if (needFullCharts || !journalsReady) {
        const openFid = favId(r);
        const pageModeNow = pageMode;
        ensureJournalsLoaded()
          .then(() => {
            if (!_currentDrawerRec || favId(_currentDrawerRec) !== openFid) return;
            const live = journals.find((row) => favId(row) === openFid);
            if (!live) return;
            const liveHasCharts = Array.isArray(live.if_history) && live.if_history.length;
            if (liveHasCharts || live !== r) {
              openDrawer(live, {
                pageMode: pageModeNow || document.body.classList.contains('journal-route'),
                source: 'full_upgrade',
              });
            }
          })
          .catch((err) => console.warn('detail full upgrade skipped:', err));
      }
    }
    // 首屏后再预热 OA map（~10MB），不打断当前详情；下次打开/相关刊可即时用
    if (!oaMap && !oaMapPromise) {
      const warmOa = () => loadOaMap().catch(() => null);
      if ('requestIdleCallback' in window) requestIdleCallback(warmOa, { timeout: 4000 });
      else setTimeout(warmOa, 800);
    }
    body.querySelectorAll('.trend-point').forEach(point => {
      const activate = () => {
        const card = point.closest('.trend-card');
        const readout = card?.querySelector('.trend-readout');
        if (!readout) return;
        card.querySelectorAll('.trend-point.is-active').forEach(p => p.classList.remove('is-active'));
        point.classList.add('is-active');
        readout.classList.add('is-visible');
        const suffix = point.dataset.partial ? T('（当前快照）',' (snapshot)') : '';
        const label = `${point.dataset.year}${suffix}: ${point.dataset.value}`;
        const svg = point.closest('svg');
        const vb = svg?.viewBox?.baseVal;
        const cx = Number(point.getAttribute('cx') || 0);
        const cy = Number(point.getAttribute('cy') || 0);
        const boxWidth = Math.max(64, Math.min(124, 26 + label.length * 6.2));
        const x = Math.min((vb?.width || 320) - boxWidth - 4, Math.max(4, cx + 8));
        const y = Math.max(4, cy - 30);
        const rect = readout.querySelector('rect');
        const text = readout.querySelector('text');
        readout.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        if (rect) rect.setAttribute('width', boxWidth.toFixed(1));
        if (text) {
          text.setAttribute('x', (boxWidth / 2).toFixed(1));
          text.textContent = label;
        }
      };
      point.addEventListener('click', activate);
      point.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          activate();
        }
      });
    });
    // related journal cards → click to open that journal's drawer
    body.querySelectorAll('.related-card').forEach(card => {
      card.addEventListener('click', () => {
        const fid = card.dataset.fid;
        const rec = journals.find(j => favId(j) === fid) || favsData[fid];
        if (rec) {
          if (_currentDrawerRec) _drawerStack.push(_currentDrawerRec);
          openDrawer(rec, { pageMode: document.body.classList.contains('journal-route'), source: 'related' });
        }
      });
    });
    // drawer list selector: switch active list before toggling
    const drawerListSel = document.getElementById('drawer-fav-list-select');
    if (drawerListSel) {
      drawerListSel.addEventListener('change', () => {
        if (!canUseFavoritesWorkflow()) {
          showRegionPaywallModal('workflow');
          drawerListSel.value = activeListId || '';
          return;
        }
        const targetId = drawerListSel.value;
        const target = favLists.find(l => l.id === targetId);
        if (!target) return;
        const fid = favId(r);
        // 切到目标清单作为当前 active
        switchList(targetId);
        // 不在目标清单则自动加入（"换/保存到"语义）
        if (!target.ids.includes(fid)) {
          target.ids.push(fid);
          favsData[fid] = { ...r, __src: src || 'int', __savedAt: Date.now() };
          localStorage.setItem(STORAGE_PREFIX + 'favsData', JSON.stringify(favsData));
          persistFavLists();
          updateFavCount();
          if (typeof syncFavs === 'function') syncFavs();
        }
        openDrawer(r, { pageMode: document.body.classList.contains('journal-route') }); // refresh state
        // 同步主表星号
        document.querySelectorAll(`.fav-star[data-fav="${fid}"]`).forEach(btn => {
          const now = isFav(r);
          btn.classList.toggle('on', now);
          btn.textContent = now ? '★' : '☆';
        });
        if (activeTab === 'fav') renderFav();
      });
    }
    $('#drawer-fav-big')?.addEventListener('click', () => {
      // If user selected a different list in dropdown, switch first
      if (drawerListSel && drawerListSel.value !== activeListId) switchList(drawerListSel.value);
      toggleFav(r, { src });
      openDrawer(r, { pageMode: document.body.classList.contains('journal-route') }); // 刷新状态
      document.querySelectorAll(`.fav-star[data-fav="${favId(r)}"]`).forEach(btn => {
        const now = isFav(r);
        btn.classList.toggle('on', now);
        btn.textContent = now ? '★' : '☆';
      });
      if (activeTab === 'fav') renderFav();
    });
    // 渲染头部收藏按钮状态
    const hdrFav = $('#drawer-fav');
    if (hdrFav) {
      hdrFav.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.7l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3.7z"/></svg>';
      hdrFav.classList.toggle('on', on);
      hdrFav.onclick = () => $('#drawer-fav-big')?.click();
    }
    // 渲染抽屉副标题标签（与左侧品牌分栏，避免重叠）
    const kicker = $('#drawer-kicker');
    if (kicker) {
      const SRC = {
        int: T('SCI / SSCI · 国际期刊','SCI / SSCI · International'), cssci: T('CSSCI 来源期刊','CSSCI Source Journals'), cssci_ext: T('CSSCI 扩展版','CSSCI Extended'),
        pku: T('北大核心','PKU Core'), cnkx: T('中国科协高质量目录','CAST Tiered Directory'), ccft: T('CCF 推荐中文科技期刊','CCF Recommended Chinese Journals'),
        zju: T('浙江大学 2024','ZJU 2024'), school_a: T('高校自编目录 2023','In-house School Directory 2023'), nsfc_mgmt: T('国自然管理科学部','NSFC Management'), in: 'India UGC-CARE',
      };
      kicker.textContent = SRC[src] || T('期刊详情','Journal Details');
    }
    // 详情页顶栏品牌：仅 pageMode 显示，与 kicker 并排
    let brand = document.getElementById('drawer-brand');
    if (!brand) {
      brand = document.createElement('a');
      brand.id = 'drawer-brand';
      brand.className = 'drawer-brand';
      brand.href = '/';
      brand.innerHTML = 'AILatest <em>Journal</em>';
      const head = document.querySelector('#j-drawer .drawer-head');
      if (head) head.insertBefore(brand, head.firstChild);
    }
    brand.hidden = !pageMode;

    drawer.classList.add('open');
    drawer.classList.toggle('journal-page', pageMode);
    // 页模式：内联 + 独立 CSS 双重强制全宽（解决「布局没变」）
    if (pageMode) {
      document.body.classList.add('journal-route');
      document.documentElement.classList.add('journal-route');
      applyJournalPageShellStyles(drawer, body);
      requestAnimationFrame(() => {
        const layout = body?.querySelector?.('.detail-layout');
        if (layout) {
          layout.classList.add('is-page');
          layout.style.cssText = [
            'display:grid',
            'grid-template-columns:minmax(0,1fr) minmax(260px,320px)',
            'column-gap:clamp(20px,2.5vw,40px)',
            'align-items:start',
            'width:100%',
            'max-width:none',
            'margin:0',
            'padding:0',
            'box-sizing:border-box',
          ].join(';');
          const mainCol = layout.querySelector('.detail-main-col');
          const sideCol = layout.querySelector('.detail-side-col');
          if (mainCol) mainCol.style.cssText = 'min-width:0;width:auto;max-width:none';
          if (sideCol) {
            sideCol.style.cssText = 'width:min(320px,28vw);max-width:320px;min-width:240px;position:sticky;top:72px;align-self:start';
          }
        }
      });
      scrim?.classList.remove('on');
      if (scrim) scrim.hidden = true;
    } else {
      drawer.style.cssText = '';
      if (body) body.style.cssText = '';
      scrim?.classList.add('on');
      scrim && (scrim.hidden = false);
    }
    drawerOpen = true;
    if (pageMode) {
      const nextPath = journalPublicPath(r);
      if (location.pathname !== nextPath) {
        try { history.pushState({ journal: favId(r) }, '', nextPath); } catch (_) {}
      }
      updateJournalSeo(r);
    } else if (!opts || !opts.fromHash) {
      const id = favId(r);
      const newHash = '#j/' + encodeURIComponent(id);
      if (location.hash !== newHash) {
        try { history.replaceState(null, '', newHash); } catch (_) { location.hash = newHash; }
      }
    }
    document.body.style.overflow = pageMode ? '' : 'hidden';
  }
  function closeDrawer(skipHashClear) {
    if (!drawerOpen) return;
    const drawerEl = $('#j-drawer');
    const bodyEl = $('#drawer-body');
    drawerEl?.classList.remove('open', 'journal-page');
    if (drawerEl) drawerEl.style.cssText = '';
    if (bodyEl) bodyEl.style.cssText = '';
    const scrim = $('#drawer-scrim');
    scrim?.classList.remove('on');
    if (scrim) scrim.hidden = true;
    drawerOpen = false;
    _currentDrawerRec = null;
    document.body.classList.remove('journal-route');
    document.documentElement.classList.remove('journal-route');
    document.body.style.overflow = '';
    // 清掉 #j/<id> hash（避免回到列表后浏览器仍显示旧 hash）
    if (!skipHashClear && /^#j\//.test(location.hash || '')) {
      try { history.replaceState(null, '', location.pathname + location.search); }
      catch (_) { location.hash = ''; }
    }
  }

  function updateJournalSeo(r) {
    const name = titleCase((r.name || r.cn_name || 'Journal').replace(/\*$/, ''));
    const bits = [name];
    if (r.if_2024 != null) bits.push(`IF ${r.if_2024}`);
    if (r.cas_zone) bits.push(`CAS ${r.cas_zone}${T('区','')}`);
    if (r.if_quartile) bits.push(`JCR ${String(r.if_quartile).toUpperCase()}`);
    bits.push('AILatest Journal');
    const title = bits.join(' | ');
    document.title = title;
    const descParts = [name];
    if (r.publisher) descParts.push(r.publisher);
    if (r.issn) descParts.push(`ISSN ${r.issn}`);
    if (Array.isArray(r.indices) && r.indices.length) descParts.push(r.indices.join('/'));
    const descText = `${descParts.join(' · ')}. 查看影响因子、中科院分区、JCR 分区、索引收录、开放获取、版面费与相关期刊推荐。`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', descText);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://journal.ailatest.org' + journalPublicPath(r));
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', descText);
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://journal.ailatest.org' + journalPublicPath(r));
  }

  function applyJournalPageShellStyles(drawer, body) {
    if (!drawer) return;
    drawer.classList.add('open', 'journal-page');
    drawer.style.cssText = [
      'position:relative', 'inset:auto', 'top:auto', 'right:auto', 'bottom:auto', 'left:auto',
      'width:100%', 'max-width:none', 'min-width:0', 'height:auto', 'min-height:100vh',
      'margin:0', 'padding:0 16px 32px', 'border:0', 'box-shadow:none', 'background:transparent',
      'transform:none', 'overflow:visible', 'z-index:1', 'display:flex', 'flex-direction:column',
      'box-sizing:border-box',
    ].join(';');
    if (body) {
      body.style.cssText = [
        'display:block', 'width:100%', 'max-width:none', 'min-width:0', 'margin:0',
        'padding:4px 0 48px', 'overflow:visible', 'background:transparent',
        'box-sizing:border-box', 'flex:1 1 auto',
      ].join(';');
    }
  }

  function renderJournalRoutePage() {
    const slug = journalPathSlug();
    if (!slug) return false;
    // 立刻进入详情壳，避免先闪首页再跳转
    document.body.classList.add('journal-route');
    document.documentElement.classList.add('journal-route');
    const drawer = $('#j-drawer'), body = $('#drawer-body'), scrim = $('#drawer-scrim');
    if (drawer) {
      applyJournalPageShellStyles(drawer, body);
      scrim?.classList.remove('on');
      if (scrim) scrim.hidden = true;
    }
    const rec = findRecByFid(slug);
    if (!rec) {
      if (body) {
        body.innerHTML = `<div class="journal-not-found">
          <div class="drawer-kicker">${T('期刊详情','Journal Details')}</div>
          <h1>${T('没有找到这个期刊','Journal not found')}</h1>
          <p>${T('这个链接可能已过期，或者该期刊不在当前数据库中。','This link may be stale, or the journal is not in the current database.')}</p>
          <a class="big-btn primary" href="/">${T('返回首页','Back to home')}</a>
        </div>`;
      }
      return true;
    }
    openDrawer(rec, { pageMode: true, fromPath: true });
    return true;
  }

  async function updatePublicPulse() {
    const box = document.getElementById('public-pulse');
    if (!box) return;
    try {
      const visitorId = getAnalyticsId('ailatest.analytics.visitor', localStorage);
      const url = `${API_BASE}/analytics/public-summary?site=${encodeURIComponent(location.hostname)}&visitor_id=${encodeURIComponent(visitorId)}`;
      const data = await fetch(url).then(r => r.json()).catch(() => null);
      if (!data || !data.ok) return;
      const rankEl = document.getElementById('visitor-rank-line');
      const topEl = document.getElementById('top-journal-line');
      if (rankEl && data.visitor_rank) {
        rankEl.textContent = T(`自建统计第 ${Number(data.visitor_rank).toLocaleString()} 位访客`, `First-party visitor #${Number(data.visitor_rank).toLocaleString()}`);
      }
      const top = (data.top_journals || []).slice(0, 3).map(item => {
        const rec = findRecByFid(item.journal_key) || journals.find(r => favId(r) === item.journal_key);
        const name = rec ? (rec.name || rec.cn_name || rec.journal_title || item.journal_key) : item.journal_key;
        const href = rec ? journalPublicPath(rec) : `/journal/${encodeURIComponent(item.journal_key)}/`;
        const fid = rec ? favId(rec) : item.journal_key;
        return `<a href="${escape(href)}" data-pulse-fid="${escape(fid)}">${escape(titleCase(name))}</a>`;
      }).filter(Boolean);
      if (topEl) {
        topEl.innerHTML = top.length
          ? `${T('最热期刊', 'Hottest journals')}: ${top.join(' / ')}`
          : '';
      }
      box.hidden = !top.length;
      box.querySelectorAll('[data-pulse-fid]').forEach(link => {
        link.addEventListener('click', (e) => {
          const fid = link.getAttribute('data-pulse-fid') || '';
          const rec = findRecByFid(fid) || journals.find(r => favId(r) === fid);
          if (!rec) return;
          e.preventDefault();
          openDrawer(rec, { pageMode: true, source: 'home_top_journal' });
        });
      });
    } catch (_) {}
  }

  // ───────── favorites tab ─────────
  // ───────── customizable stations (bottom nav) ─────────
  const STATIONS = [
    { id: 'int', i18n: 'rail_int', zh: '全球', en: 'Global' },
    { id: 'dom', i18n: 'rail_dom', zh: '中国', en: 'China' },
    { id: 'in',  i18n: 'rail_in',  zh: '印度', en: 'India' },
    { id: 'my',  i18n: 'rail_my',  zh: '马来西亚', en: 'Malaysia' },
    { id: 'kr',  i18n: 'rail_kr',  zh: '韩国', en: 'Korea' },
    { id: 'pbn', i18n: 'rail_pbn', zh: '波兰', en: 'Poland' },
    { id: 'isc', i18n: 'rail_isc', zh: '伊朗', en: 'Iran' },
    { id: 'scielo', i18n: 'rail_scielo', zh: '拉美', en: 'LatAm' },
  ];
  const REGION_STATION_IDS = ['dom', 'in', 'my', 'kr', 'pbn', 'isc', 'scielo'];
  const FREE_BASE_REGION_IDS = ['dom']; // 中国站始终可用
  const DEFAULT_PINNED_REGION_IDS = ['dom'];
  const PINNED_REGION_KEY = 'ailatest.pinnedRegionStations';
  const PINNED_REGION_MIGRATION_KEY = `${PINNED_REGION_KEY}.v2`;
  /** 旧版 Max unlockAll 曾把全部地区写进侧栏；一次性收回到默认，之后用户可自行固定 */
  const PINNED_REGION_COLLAPSE_KEY = `${PINNED_REGION_KEY}.v3-collapse-all`;
  const REGION_VIEW_KEY = 'ailatest.regionViewDaily';
  const FREE_REGION_DAILY_VIEWS = 3;

  /** free | plus(Pro) | pro(Max) — 与 entitlements 对齐；支付未开时默认 free */
  function getRegionPlanTier() {
    try {
      if (user && (user.is_owner || user.plan === 'owner')) return 'pro';
      const tier = String(user?.entitlements?.tier || user?.tier || 'free').toLowerCase();
      if (tier === 'pro' || tier === 'max') return 'pro';
      if (tier === 'plus' || tier === 'trial') return 'plus';
      return 'free';
    } catch (_) {
      return 'free';
    }
  }
  function regionEntitlements() {
    const tier = getRegionPlanTier();
    if (tier === 'pro') {
      return { maxCustomPins: null, dailyViews: null, unlockAll: true };
    }
    if (tier === 'plus') {
      return { maxCustomPins: 2, dailyViews: null, unlockAll: false };
    }
    return { maxCustomPins: 0, dailyViews: FREE_REGION_DAILY_VIEWS, unlockAll: false };
  }
  function getRegionViewUsage() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const raw = JSON.parse(localStorage.getItem(REGION_VIEW_KEY) || '{}');
      if (raw.date !== today) return { date: today, count: 0, seen: [] };
      return {
        date: today,
        count: Number(raw.count) || 0,
        seen: Array.isArray(raw.seen) ? raw.seen : [],
      };
    } catch (_) {
      return { date: today, count: 0, seen: [] };
    }
  }
  function saveRegionViewUsage(u) {
    try { localStorage.setItem(REGION_VIEW_KEY, JSON.stringify(u)); } catch (_) {}
  }
  function showRegionUpgradeToast(msg) {
    try {
      const el = document.createElement('div');
      el.className = 'import-toast';
      el.textContent = msg;
      el.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:3000;background:#1f2c4c;color:#fff;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.28);max-width:88vw;text-align:center';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4200);
    } catch (_) {}
  }

  /**
   * 付费引导弹窗（可关闭）
   * reason: 'daily' | 'pin_free' | 'pin_pro' | 'publish_fee'
   */
  function showRegionPaywallModal(reason = 'daily') {
    let modal = document.getElementById('region-paywall-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'region-paywall-modal';
      modal.className = 'region-paywall-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="region-paywall-card" role="document">
          <button type="button" class="region-paywall-close" id="region-paywall-close" aria-label="Close">×</button>
          <div class="region-paywall-eyebrow" id="region-paywall-eyebrow"></div>
          <h3 class="region-paywall-title" id="region-paywall-title"></h3>
          <p class="region-paywall-desc" id="region-paywall-desc"></p>
          <ul class="region-paywall-perks" id="region-paywall-perks"></ul>
          <div class="region-paywall-actions">
            <a class="region-paywall-btn primary" id="region-paywall-cta" href="/pricing">${T('查看订阅方案','View plans')}</a>
            <button type="button" class="region-paywall-btn ghost" id="region-paywall-later">${T('暂不升级','Not now')}</button>
          </div>
          <p class="region-paywall-note" id="region-paywall-note"></p>
        </div>`;
      document.body.appendChild(modal);
      const close = () => {
        modal.classList.remove('open');
        document.removeEventListener('keydown', onEsc);
      };
      const onEsc = (e) => { if (e.key === 'Escape') close(); };
      modal.__close = close;
      modal.__onEsc = onEsc;
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
      modal.querySelector('#region-paywall-close')?.addEventListener('click', close);
      modal.querySelector('#region-paywall-later')?.addEventListener('click', close);
    }

    const titleEl = modal.querySelector('#region-paywall-title');
    const descEl = modal.querySelector('#region-paywall-desc');
    const eyebrowEl = modal.querySelector('#region-paywall-eyebrow');
    const perksEl = modal.querySelector('#region-paywall-perks');
    const noteEl = modal.querySelector('#region-paywall-note');
    const ctaEl = modal.querySelector('#region-paywall-cta');
    const laterEl = modal.querySelector('#region-paywall-later');

    if (ctaEl) ctaEl.textContent = T('查看订阅方案', 'View plans');
    if (laterEl) laterEl.textContent = T('暂不升级', 'Not now');

    if (reason === 'fav_limit') {
      if (eyebrowEl) eyebrowEl.textContent = T('收藏额度', 'Favorite limit');
      if (titleEl) titleEl.textContent = T(`Free 可收藏 ${FREE_FAV_LIMIT} 本期刊`, `Free plan: ${FREE_FAV_LIMIT} favorites`);
      if (descEl) descEl.textContent = T(
        `本站 Free 账户最多收藏 ${FREE_FAV_LIMIT} 本期刊。升级 Pro 可收藏更多并管理多清单；导出联动为 Max 权益。`,
        `Free accounts can save up to ${FREE_FAV_LIMIT} journals here. Upgrade to Pro for more favorites and lists; export is Max.`
      );
      if (perksEl) {
        perksEl.innerHTML = [
          T(`<b>Free</b> · 收藏最多 ${FREE_FAV_LIMIT} 本`, `<b>Free</b> · Up to ${FREE_FAV_LIMIT} favorites`),
          T('<b>Pro</b> · 云收藏 50 · 清单 5', '<b>Pro</b> · 50 cloud favorites · 5 lists'),
          T('<b>Max</b> · 收藏不限 · 导出联动', '<b>Max</b> · Unlimited favorites · Export'),
        ].map((html) => `<li>${html}</li>`).join('');
      }
    } else if (reason === 'workflow') {
      if (eyebrowEl) eyebrowEl.textContent = T('工作流 · 升级解锁', 'Workflow · Upgrade');
      if (titleEl) titleEl.textContent = T('多清单与分享 · Pro 起', 'Lists & sharing · from Pro');
      if (descEl) descEl.textContent = T(
        `Free 可收藏最多 ${FREE_FAV_LIMIT} 本期刊。升级 Pro 后可建多清单、云同步与分享；导出与 Zotero / Notion / Obsidian 为 Max 权益。`,
        `Free can save up to ${FREE_FAV_LIMIT} journals. Upgrade to Pro for multiple lists, cloud sync and sharing; export is Max.`
      );
      if (perksEl) {
        perksEl.innerHTML = [
          T(`<b>Free</b> · 收藏最多 ${FREE_FAV_LIMIT} 本`, `<b>Free</b> · Up to ${FREE_FAV_LIMIT} favorites`),
          T('<b>Pro</b> · 云收藏与清单 · 插件中科院徽章', '<b>Pro</b> · Cloud favorites & lists · Extension CAS badges'),
          T('<b>Max</b> · 导出联动 · 高额度 AI', '<b>Max</b> · Export · High AI quota'),
        ].map((html) => `<li>${html}</li>`).join('');
      }
    } else if (reason === 'export') {
      if (eyebrowEl) eyebrowEl.textContent = T('导出联动 · Max', 'Export · Max');
      if (titleEl) titleEl.textContent = T('导出与文献管理联动 · Max 专属', 'Export & reference managers · Max only');
      if (descEl) descEl.textContent = T(
        'RIS / BibTeX 导出与 Zotero / Notion / Obsidian 联动为 Max 权益。Pro 可收藏与管理清单，升级 Max 即可一键导出。',
        'RIS / BibTeX export and Zotero / Notion / Obsidian are Max features. Pro can save favorites; upgrade to Max to export.'
      );
      if (perksEl) {
        perksEl.innerHTML = [
          T('<b>Max</b> · RIS / BibTeX · CSV / Markdown', '<b>Max</b> · RIS / BibTeX · CSV / Markdown'),
          T('<b>Max</b> · Zotero / Notion / Obsidian / EndNote', '<b>Max</b> · Zotero / Notion / Obsidian / EndNote'),
          T('<b>Pro</b> 已含收藏与清单，可随时升级 Max', '<b>Pro</b> already includes favorites — upgrade anytime'),
        ].map((html) => `<li>${html}</li>`).join('');
      }
    } else if (reason === 'fulltext') {
      if (eyebrowEl) eyebrowEl.textContent = T('原文查找 · 升级解锁', 'Full text · Upgrade');
      const ftLimit = getFulltextLimit();
      const isProCap = getProductTier() === 'plus';
      if (titleEl) titleEl.textContent = isProCap
        ? T('Pro 原文查找已达上限', 'Pro full-text lookup limit reached')
        : T('Free 原文查找已达上限', 'Free full-text lookup limit reached');
      if (descEl) descEl.textContent = isProCap
        ? T(
          `Pro 每月可查找开放全文 ${PRO_FULLTEXT_LIMIT} 篇（按文章去重，按月重置）。升级 Max 后不限篇数。`,
          `Pro includes ${PRO_FULLTEXT_LIMIT} open full-text lookups per month (unique articles, resets monthly). Upgrade to Max for unlimited lookups.`
        )
        : T(
          `Free 累计可查找开放全文 ${FREE_FULLTEXT_LIMIT} 篇（按文章去重）。Pro 为每月 ${PRO_FULLTEXT_LIMIT} 篇；Max 不限量。`,
          `Free includes ${FREE_FULLTEXT_LIMIT} open full-text lookups total. Pro is ${PRO_FULLTEXT_LIMIT}/month; Max is unlimited.`
        );
      if (perksEl) {
        perksEl.innerHTML = [
          T(`<b>Pro</b> · 原文查找每月 ${PRO_FULLTEXT_LIMIT} 篇`, `<b>Pro</b> · ${PRO_FULLTEXT_LIMIT} full-text lookups / month`),
          T('<b>Max</b> · 原文查找不限量 · 导出与文献管理联动', '<b>Max</b> · Unlimited full-text · Export & reference managers'),
          T('不升级仍可继续查刊与查看期刊指标', 'You can keep searching journals without upgrading'),
        ].map((html) => `<li>${html}</li>`).join('');
      }
    } else if (reason === 'publish_fee') {
      if (eyebrowEl) eyebrowEl.textContent = T('发表费用 · 升级解锁', 'Publish fees · Upgrade');
      if (titleEl) titleEl.textContent = T('是否付费发表 · Pro 可见', 'Publish-fee info · Pro');
      if (descEl) descEl.textContent = T(
        'Free 不展示是否免费发表、APC 版面费等费用信息。升级 Pro 后可在列表、详情与插件中查看。',
        'Free hides free-to-publish flags and APC fees. Upgrade to Pro to see them in lists, details, and the extension.'
      );
      if (perksEl) {
        perksEl.innerHTML = [
          T('<b>Pro</b> · 是否免费发表 / APC · 插件中科院徽章', '<b>Pro</b> · Free-to-publish / APC · Extension CAS badges'),
          T('<b>Max</b> · 插件预警 · 撤稿 · 科协 · 高额度 AI', '<b>Max</b> · Warning · retraction · CAST · High AI quota'),
          T('不升级也可继续查 IF、分区与收录信息', 'Without upgrading you can still browse IF, tiers, and indexing'),
        ].map((html) => `<li>${html}</li>`).join('');
      }
    } else if (reason === 'pin_pro') {
      if (eyebrowEl) eyebrowEl.textContent = T('地区站 · 升级解锁', 'Regional stations · Upgrade');
      if (titleEl) titleEl.textContent = T('自定义地区已达上限', 'Custom region pin limit reached');
      if (descEl) descEl.textContent = T(
        'Pro 侧栏最多固定 2 个自定义地区。升级 Max 可打开全部地区，并自由固定/取消到侧栏。',
        'Pro can pin up to 2 custom regions on the rail. Max can open any region and pin/unpin freely.'
      );
      if (perksEl) {
        perksEl.innerHTML = [
          T('<b>Pro</b> · 侧栏可固定 2 个自定义地区', '<b>Pro</b> · Pin up to 2 custom regions on the rail'),
          T('<b>Max</b> · 全部地区可打开 · 侧栏自选固定/取消', '<b>Max</b> · Open any region · pin/unpin freely'),
          T('中国站始终可用', 'China station stays available'),
        ].map((html) => `<li>${html}</li>`).join('');
      }
    } else if (reason === 'pin_free') {
      if (eyebrowEl) eyebrowEl.textContent = T('地区站 · 升级解锁', 'Regional stations · Upgrade');
      if (titleEl) titleEl.textContent = T('固定地区站需升级', 'Upgrade to pin regional stations');
      if (descEl) descEl.textContent = T(
        'Free 可每日临时查看其他地区站 3 次。升级后可将常用地区固定到侧栏，也可随时取消。',
        'Free includes 3 temporary regional views per day. Upgrade to pin favorites on the rail (and unpin anytime).'
      );
      if (perksEl) {
        perksEl.innerHTML = [
          T('<b>Pro</b> · 侧栏可固定 2 个自定义地区', '<b>Pro</b> · Pin up to 2 custom regions on the rail'),
          T('<b>Max</b> · 全部地区可打开 · 侧栏自选固定/取消', '<b>Max</b> · Open any region · pin/unpin freely'),
          T('中国站始终可用', 'China station stays available'),
        ].map((html) => `<li>${html}</li>`).join('');
      }
    } else {
      if (eyebrowEl) eyebrowEl.textContent = T('地区站 · 升级解锁', 'Regional stations · Upgrade');
      if (titleEl) titleEl.textContent = T('今日免费查看次数已用完', 'Daily free regional views used up');
      if (descEl) descEl.textContent = T(
        'Free 每天可临时查看其他地区站 3 次（今日已用尽）。升级后可固定常用地区到侧栏；Max 可打开全部地区。',
        'Free includes 3 temporary views per day (used up today). Upgrade to pin favorites; Max can open all regions.'
      );
      if (perksEl) {
        perksEl.innerHTML = [
          T('<b>Pro</b> · 侧栏可固定 2 个自定义地区', '<b>Pro</b> · Pin up to 2 custom regions on the rail'),
          T('<b>Max</b> · 全部地区可打开 · 侧栏自选固定/取消', '<b>Max</b> · Open any region · pin/unpin freely'),
          T('中国站始终可用', 'China station stays available'),
        ].map((html) => `<li>${html}</li>`).join('');
      }
    }
    if (noteEl) {
      noteEl.textContent = T(
        '可先了解各档权益；关闭弹窗后仍可继续使用 Free 能力。',
        'You can review plan benefits first; close this dialog to keep using Free.'
      );
    }

    modal.classList.add('open');
    if (modal.__onEsc) {
      document.removeEventListener('keydown', modal.__onEsc);
      document.addEventListener('keydown', modal.__onEsc);
    }
    try { modal.querySelector('#region-paywall-later')?.focus(); } catch (_) {}
  }

  function getPinnedRegions() {
    try {
      const raw = localStorage.getItem(PINNED_REGION_KEY);
      if (!raw) return DEFAULT_PINNED_REGION_IDS.slice();
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved)) return DEFAULT_PINNED_REGION_IDS.slice();
      let valid = saved.filter(id => REGION_STATION_IDS.includes(id));
      if (!localStorage.getItem(PINNED_REGION_MIGRATION_KEY) && !valid.includes('dom')) {
        valid = ['dom', ...valid];
        localStorage.setItem(PINNED_REGION_KEY, JSON.stringify(valid));
        localStorage.setItem(PINNED_REGION_MIGRATION_KEY, '1');
      }
      // 旧 Max「全解锁=全钉侧栏」：侧栏一次挂满全部地区 → 收回默认，仅保留中国
      if (!localStorage.getItem(PINNED_REGION_COLLAPSE_KEY)) {
        if (valid.length >= REGION_STATION_IDS.length) {
          valid = DEFAULT_PINNED_REGION_IDS.slice();
          localStorage.setItem(PINNED_REGION_KEY, JSON.stringify(valid));
        }
        localStorage.setItem(PINNED_REGION_COLLAPSE_KEY, '1');
      }
      // 权益降级时裁剪多余钉选（Max unlockAll 不裁剪，由用户自由固定/取消）
      const ent = regionEntitlements();
      if (!ent.unlockAll && ent.maxCustomPins != null) {
        const base = FREE_BASE_REGION_IDS.filter(id => valid.includes(id));
        const custom = valid.filter(id => !FREE_BASE_REGION_IDS.includes(id)).slice(0, ent.maxCustomPins);
        valid = [...new Set([...base, ...custom])];
        if (!valid.includes('dom')) valid = ['dom', ...valid];
      }
      return valid;
    } catch (_) {
      return DEFAULT_PINNED_REGION_IDS.slice();
    }
  }
  function setPinnedRegions(ids) {
    const unique = [...new Set((ids || []).filter(id => REGION_STATION_IDS.includes(id)))];
    // 至少保留一个地区入口（默认中国）
    if (!unique.length) unique.push('dom');
    try { localStorage.setItem(PINNED_REGION_KEY, JSON.stringify(unique)); } catch (_) {}
    try { localStorage.setItem(PINNED_REGION_MIGRATION_KEY, '1'); } catch (_) {}
    try { localStorage.setItem(PINNED_REGION_COLLAPSE_KEY, '1'); } catch (_) {}
    applyStations();
  }
  function togglePinnedRegion(id) {
    if (!REGION_STATION_IDS.includes(id)) return false;
    const ent = regionEntitlements();
    const pinned = getPinnedRegions();
    if (pinned.includes(id)) {
      // 中国站建议保留；允许取消但至少留一个
      if (id === 'dom' && pinned.length === 1) {
        showRegionUpgradeToast(T('中国地区站为默认站点，请至少保留一个地区。','China is the default region station. Keep at least one region.'));
        return false;
      }
      const next = pinned.filter(x => x !== id);
      setPinnedRegions(next);
      // 取消固定后若仍停在该站，退回全球
      if (typeof activeTab !== 'undefined' && activeTab === id) {
        try { activateTab('int', { skipRegionGate: true }); } catch (_) {}
      }
      return true;
    }
    // Max / Pro / Free：仅把选中项钉到侧栏，绝不因 unlockAll 一次钉满
    if (!ent.unlockAll) {
      const customPinned = pinned.filter(x => !FREE_BASE_REGION_IDS.includes(x));
      const isCustom = !FREE_BASE_REGION_IDS.includes(id);
      if (isCustom && ent.maxCustomPins != null && customPinned.length >= ent.maxCustomPins) {
        showRegionPaywallModal(ent.maxCustomPins === 0 ? 'pin_free' : 'pin_pro');
        return false;
      }
    }
    setPinnedRegions([...pinned, id]);
    return true;
  }
  function canAccessRegionStation(id) {
    if (!REGION_STATION_IDS.includes(id)) return true;
    const ent = regionEntitlements();
    if (ent.unlockAll) return true;
    if (FREE_BASE_REGION_IDS.includes(id)) return true;
    if (getPinnedRegions().includes(id)) return true;
    // Free：每日临时查看
    if (ent.dailyViews != null) {
      const u = getRegionViewUsage();
      if (u.seen.includes(id) || u.count < ent.dailyViews) return true;
    }
    return false;
  }
  function consumeRegionViewIfNeeded(id) {
    if (!REGION_STATION_IDS.includes(id)) return true;
    const ent = regionEntitlements();
    if (ent.unlockAll) return true;
    if (FREE_BASE_REGION_IDS.includes(id)) return true;
    if (getPinnedRegions().includes(id)) return true;
    if (ent.dailyViews == null) return true;
    const u = getRegionViewUsage();
    if (u.seen.includes(id)) return true;
    if (u.count >= ent.dailyViews) {
      showRegionPaywallModal('daily');
      return false;
    }
    u.count += 1;
    u.seen.push(id);
    saveRegionViewUsage(u);
    return true;
  }
  function applyRegionPinState() {
    const pinned = getPinnedRegions();
    const ent = regionEntitlements();
    document.querySelectorAll('[data-region-pin]').forEach(btn => {
      const id = btn.dataset.regionPin;
      const on = pinned.includes(id);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.disabled = false;
      // 钉选 = 侧栏常驻（菜单 ✓）；Max 能打开全部地区，侧栏仍只挂已钉选
      if (on) {
        btn.title = T('点击取消侧栏固定', 'Click to unpin from rail');
      } else if (ent.unlockAll) {
        btn.title = T('点击固定到侧栏并打开', 'Click to pin on rail and open');
      } else if (ent.maxCustomPins === 0 && !FREE_BASE_REGION_IDS.includes(id)) {
        btn.title = T('点击临时查看；升级后可固定到侧栏', 'Open temporarily; upgrade to pin on rail');
      } else {
        btn.title = T('点击固定到侧栏并打开', 'Click to pin on rail and open');
      }
    });
  }
  function applyStations() {
    const pinned = getPinnedRegions();
    STATIONS.forEach((s) => {
      // data-tab 与 data-region-station 双查，避免静态页/SPA 结构差异
      const btn = document.querySelector(`.rail-nav-btn[data-tab="${s.id}"]`)
        || document.querySelector(`.rail-nav-btn[data-region-station="${s.id}"]`);
      if (!btn) return;
      const region = REGION_STATION_IDS.includes(s.id);
      // 侧栏只显示已钉选地区（Max 可访问全部，但侧栏不常驻全部）
      const show = !region || pinned.includes(s.id);
      btn.hidden = !show;
      if (show) {
        btn.removeAttribute('data-station-hidden');
        btn.removeAttribute('aria-hidden');
      } else {
        btn.setAttribute('data-station-hidden', '1');
        btn.setAttribute('aria-hidden', 'true');
      }
      if (s.id === 'int') btn.style.order = '0';
      else if (region) btn.style.order = String(1 + REGION_STATION_IDS.indexOf(s.id));
      else btn.style.order = '';
    });
    // 地区增减已迁入设置页：始终隐藏侧栏 ··· 入口
    const regionPicker = document.querySelector('.rail-region-picker');
    if (regionPicker) {
      regionPicker.hidden = true;
      regionPicker.setAttribute('aria-hidden', 'true');
      regionPicker.style.display = 'none';
    }
    const favBtn = document.querySelector('.rail-nav-btn[data-tab="fav"]');
    if (favBtn) favBtn.style.order = '8';
    const creditBadge = document.querySelector('#account-credit-badge');
    if (creditBadge) creditBadge.style.order = '9';
    applyRegionPinState();
  }
  /** 非中文语言包：用英文补齐缺失 key（ja/ko 等是 en 的薄覆盖，创建后 en 新增的 key 不会自动带上） */
  function hydrateLangPack(code) {
    if (!code || code === 'zh-CN' || code === 'zh-TW') return;
    const en = I18N.en || {};
    if (!I18N[code]) {
      I18N[code] = { ...en };
      return;
    }
    const pack = I18N[code];
    for (const k of Object.keys(en)) {
      if (pack[k] == null) pack[k] = en[k];
    }
  }

  // 首页搜索结果渲染在 bind() 内定义，经此钩子在语言切换时重刷
  let refreshHomeForLang = null;

  function refreshActiveTabContent() {
    try {
      // 清掉可复用标记，强制按新语言重绘
      try {
        const p = document.querySelector(`.tab-panel[data-panel="${activeTab}"]`);
        if (p) delete p.dataset.renderKey;
      } catch (_) {}
      if (activeTab === 'dom') renderDomestic();
      else if (activeTab === 'fav') renderFav();
      else if (activeTab === 'int') renderInt();
      else if (activeTab === 'pick') refreshPickI18n();
      else if (activeTab === 'in') renderIndia();
      else if (activeTab === 'my') renderMalaysia();
      else if (activeTab === 'kr') renderKorea();
      else if (REGIONAL_DIRECTORY_CONFIG[activeTab]) renderRegionalDirectory(activeTab);
      else if (activeTab === 'updates') renderJournalUpdates();
      else if (activeTab === 'home' && typeof refreshHomeForLang === 'function') {
        refreshHomeForLang();
      }
    } catch (err) {
      console.error('[setUiLanguage] refresh tab failed', err);
    }
  }

  function setUiLanguage(code) {
    const next = normalizeLang(code);
    if (!LANG_META[next]) return;
    // 即使点同一语言，也允许强制刷新（修复「点了没变」的卡死态）
    const changed = next !== lang;
    lang = next;
    hydrateLangPack(lang);
    try {
      localStorage.setItem('ailatest.lang', lang);
      // 标记为用户主动选择，后续不再被浏览器语言覆盖
      localStorage.setItem('ailatest.lang.userSet', '1');
    } catch (_) {}
    window.__journalUiLang = lang;
    try {
      document.documentElement.lang = LANG_META[lang]?.html || lang;
      document.documentElement.setAttribute('data-ui-lang', lang);
    } catch (_) {}
    try { localizeDefaultFavListName(); } catch (_) {}
    try { persistFavLists(false); } catch (_) {}
    try { applyI18n(); } catch (err) { console.error(err); }
    // 定价 / 教育价 / 结账 CTA 不在 data-i18n 里，需显式按当前语言重刷
    try {
      if (typeof window.__syncPricingUi === 'function') window.__syncPricingUi();
      else if (typeof window.__syncEduCheckoutUi === 'function') window.__syncEduCheckoutUi();
    } catch (_) {}
    try {
      if (domestic) buildDomIndex(domestic);
    } catch (_) {}
    const wosSel2 = $('#wos-col-filter');
    if (wosSel2) wosSel2.__bound = false;
    try { renderCatList(); } catch (_) {}

    // 关键：无论设置浮层是否打开，都要刷新当前业务页（列表卡 T() 文案）
    // 旧逻辑在 settings-open 时 early-branch，导致收藏/全球列表仍残留中文
    if (activeTab !== 'me') refreshActiveTabContent();

    // 设置页语言切换：强制停在语言分区并重绘
    if (activeTab === 'me' || document.body.classList.contains('settings-open')) {
      _settingsSection = 'language';
      window.__settingsOpenAsRoot = false;
      try {
        renderMe();
        showSettingsSection('language', {
          subpage: window.matchMedia('(max-width: 900px)').matches,
        });
      } catch (err) {
        console.error('[setUiLanguage] settings refresh failed', err);
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('ailatest:langchange', { detail: { lang, changed } }));
    } catch (_) {}
    try { loadJournalViewTotalFootnote(); } catch (_) {}
    if (_currentDrawerRec) {
      try {
        openDrawer(_currentDrawerRec, { pageMode: document.body.classList.contains('journal-route') });
      } catch (_) {}
    }
  }
  window.__setJournalLanguage = setUiLanguage;
  function userDisplayName() {
    if (!user) return T('未登录用户', 'Guest');
    return user.name || user.login || user.email || T('我的账号', 'My account');
  }

  function userEmailText() {
    if (!user) return T('未登录', 'Not signed in');
    return user.email || user.login || T('未提供邮箱', 'No email on file');
  }

  function userProviderText() {
    if (!user) return '—';
    const raw = user.provider || user.auth_provider || user.login_provider || user.oauth_provider || '';
    const provider = String(raw || '').toLowerCase();
    if (provider.includes('google')) return 'Google';
    if (provider.includes('github')) return 'GitHub';
    if (provider.includes('email')) return T('邮箱验证码', 'Email code');
    if (provider) return raw;
    return user.email ? T('邮箱验证码', 'Email code') : T('账号登录', 'Account');
  }

  function safeAvatarUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, location.origin);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function userAvatarUrl() {
    if (!user) return '';
    return safeAvatarUrl(
      user.avatar_url || user.avatarUrl || user.picture || user.photo ||
      user.image || user.image_url || user.profile_image_url
    );
  }

  function userInitial() {
    return escape((userDisplayName().match(/[A-Za-z0-9\u4e00-\u9fff]/)?.[0] || 'A').toUpperCase());
  }

  function userAvatarHtml() {
    const avatarUrl = userAvatarUrl();
    const label = escape(userDisplayName());
    return `<div class="me-avatar${avatarUrl ? ' has-photo' : ''}">
      ${avatarUrl ? `<img src="${escape(avatarUrl)}" alt="${label}" referrerpolicy="no-referrer" loading="lazy">` : ''}
      <span>${userInitial()}</span>
    </div>`;
  }

  function localSearchCount() {
    let historyCount = 0;
    try {
      const pickHistory = JSON.parse(localStorage.getItem('ailatest.pick.history') || '[]');
      if (Array.isArray(pickHistory)) historyCount += pickHistory.length;
    } catch (_) {}
    try {
      const homeHistory = JSON.parse(localStorage.getItem('ailatest.home.search.history') || '[]');
      if (Array.isArray(homeHistory)) historyCount += homeHistory.length;
    } catch (_) {}
    const usage = getDailyUsage();
    return Math.max(historyCount, Number(usage.searches || 0));
  }

  function localPluginCallCount() {
    if (!user) return 0;
    const fields = [
      user.plugin_calls,
      user.pluginCalls,
      user.extension_calls,
      user.extensionCalls,
      user.api_calls,
      user.apiCalls,
      user.usage && user.usage.plugin_calls,
      user.usage && user.usage.api_calls,
    ];
    const hit = fields.find(v => v !== undefined && v !== null && v !== '');
    const n = Number(hit);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMeRecordTime(ts) {
    if (!ts) return T('时间未知', 'Unknown time');
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return T('时间未知', 'Unknown time');
    try {
      return d.toLocaleString(uiLocale(), {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch (_) {
      return d.toLocaleString();
    }
  }

  function readJsonArray(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  function recordTimeMs(item) {
    if (!item || typeof item !== 'object') return 0;
    const raw = item.t ?? item.ts ?? item.time ?? item.created_at ?? item.createdAt ?? item.date;
    if (raw === undefined || raw === null || raw === '') return 0;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      return numeric > 1e12 ? numeric : numeric * 1000;
    }
    const parsed = Date.parse(String(raw));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function localViewRecords(limit = 40, { todayOnly = false } = {}) {
    const today = new Date().toISOString().slice(0, 10);
    let list = readJsonArray('ailatest.viewhist');
    if (todayOnly) {
      list = list.filter(item => {
        const ts = recordTimeMs(item);
        return Number.isFinite(ts) && new Date(ts).toISOString().slice(0, 10) === today;
      });
    }
    return list.slice(0, limit).map(item => {
      const title = item.n || item.name || item.title || item.k || T('期刊详情', 'Journal detail');
      const meta = Array.isArray(item.c) ? item.c.filter(Boolean).join(' · ') : (item.issn || '');
      return {
        action: 'journal',
        fid: item.k || item.fid || '',
        issn: item.issn || '',
        title,
        meta: meta || T('点击打开期刊详情', 'Click to open journal'),
        time: recordTimeMs(item),
        href: item.p || item.path || '',
      };
    });
  }

  function todayViewCount() {
    const usage = getDailyUsage();
    const today = new Date().toISOString().slice(0, 10);
    const localToday = readJsonArray('ailatest.viewhist').filter(item => {
      const ts = recordTimeMs(item);
      if (!Number.isFinite(ts)) return false;
      return new Date(ts).toISOString().slice(0, 10) === today;
    }).length;
    const fromKeys = Array.isArray(usage.viewKeys) ? usage.viewKeys.length : 0;
    return Math.max(Number(usage.views || 0), localToday, usage.date === today ? fromKeys : 0);
  }

  function localSearchRecords(limit = 24) {
    const home = readJsonArray('ailatest.home.search.history')
      .filter(Boolean)
      .map((query, idx) => ({
        action: 'search',
        query: String(query),
        title: String(query),
        meta: T('首页查刊 · 点击重新搜索', 'Journal search · click to run again'),
        time: Date.now() - idx * 1000,
      }));
    const pick = readJsonArray('ailatest.pick.history')
      .filter(item => item && item.query)
      .map(item => ({
        action: 'pick',
        query: item.query,
        title: item.query,
        meta: T('荐刊查询 · 点击重新推荐', 'Recommendation · click to run again'),
        time: item.time,
      }));
    const records = [...pick, ...home]
      .sort((a, b) => Number(b.time || 0) - Number(a.time || 0))
      .slice(0, limit);
    const usage = getDailyUsage();
    if (!records.length && Number(usage.searches || 0) > 0) {
      return [{
        title: T(`今日搜索 ${Number(usage.searches || 0)} 次`, `${Number(usage.searches || 0)} searches today`),
        meta: T('本机统计', 'Local usage'),
        time: Date.now(),
      }];
    }
    return records;
  }

  function localPluginCallRecords(limit = 20) {
    if (!user) return [];
    const candidates = [
      user.plugin_call_records,
      user.pluginCallRecords,
      user.pluginCallsLog,
      user.api_call_records,
      user.apiCallRecords,
      user.apiCallsLog,
      user.recent_api_calls,
      user.recentApiCalls,
      user.usage && user.usage.recent_calls,
      user.usage && user.usage.calls,
    ];
    const raw = candidates.find(Array.isArray) || [];
    return raw.slice(0, limit).map(item => ({
      title: item.title || item.name || item.endpoint || item.path || item.tool || T('插件 / API 调用', 'Plugin / API call'),
      meta: [item.method, item.status, item.platform, item.source].filter(Boolean).join(' · '),
      time: item.time || item.created_at || item.createdAt || item.ts,
    }));
  }

  async function authedJson(path, options = {}) {
    if (!user?.token) throw new Error(T('请先登录。','Please sign in first.'));
    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${user.token}`,
    };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const resp = await fetch(`${API_BASE}${path}`, { ...options, headers });
    return readJsonResponse(resp, T('请求失败','Request failed'));
  }

  function apiKeyDisplay(row) {
    const prefix = row?.key_prefix || row?.prefix || 'aj_live_';
    const tail = row?.key_tail || row?.tail || '';
    return tail ? `${prefix}••••${tail}` : prefix;
  }

  function apiKeyRows(keys) {
    if (!keys?.length) {
      return `<div class="me-record-empty">${T('还没有 API Key。点击右侧按钮新建一个。','No API keys yet. Create one with the button on the right.')}</div>`;
    }
    return `<div class="me-record-list">${keys.map(row => `
      <div class="me-record-row api-key-row">
        <div class="me-record-main">
          <strong>${escape(row.name || T('我的 API','My API'))}</strong>
          <code>${escape(apiKeyDisplay(row))}</code>
          <span>${T('创建于','Created')} ${escape(formatMeRecordTime((row.created_at || 0) * 1000 || row.createdAt))}${row.last_used_at ? ` · ${T('最近调用','Last used')} ${escape(formatMeRecordTime(row.last_used_at * 1000))}` : ''}</span>
        </div>
        <time>${Number(row.call_count || 0)} ${T('次调用','calls')}</time>
      </div>`).join('')}</div>`;
  }

  async function hydrateApiKeyPanel(panel, created = null) {
    const target = panel.querySelector('[data-api-key-body]');
    if (!target) return;
    if (!user?.token) {
      target.innerHTML = `<div class="me-record-empty">${T('登录后可以创建和管理 API Key。','Sign in to create and manage API keys.')}</div>`;
      return;
    }
    try {
      const data = await authedJson('/api-keys');
      const secretHtml = created?.secret ? `<div class="api-key-secret">
        <strong>${T('请立即复制，密钥只显示一次','Copy now. The secret is shown only once.')}</strong>
        <code>${escape(created.secret)}</code>
        <button type="button" class="btn-mini" data-copy-api-secret="${escape(created.secret)}">${T('复制密钥','Copy key')}</button>
      </div>` : '';
      target.innerHTML = `${secretHtml}${apiKeyRows(data.keys || [])}`;
    } catch (err) {
      target.innerHTML = `<div class="me-record-empty">${escape(fetchFailureMessage(err, T('读取 API Key','Load API keys')))}</div>`;
    }
  }

  function bindApiKeyPanel(panel) {
    panel.querySelector('[data-create-api-key]')?.addEventListener('click', async () => {
      if (!user?.token) {
        startLogin();
        return;
      }
      const name = prompt(T('API Key 名称：','API key name:'), T('我的 API','My API'));
      if (name === null) return;
      const btn = panel.querySelector('[data-create-api-key]');
      btn.disabled = true;
      btn.textContent = T('创建中…','Creating…');
      try {
        const created = await authedJson('/api-keys', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim() || T('我的 API','My API') }),
        });
        await hydrateApiKeyPanel(panel, created);
      } catch (err) {
        const target = panel.querySelector('[data-api-key-body]');
        if (target) target.innerHTML = `<div class="me-record-empty">${escape(fetchFailureMessage(err, T('创建 API Key','Create API key')))}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = T('新建 API Key','New API key');
      }
    });
    panel.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-copy-api-secret]');
      if (!btn) return;
      const text = btn.dataset.copyApiSecret || '';
      try {
        await navigator.clipboard.writeText(text);
        const old = btn.textContent;
        btn.textContent = T('已复制','Copied');
        setTimeout(() => { btn.textContent = old; }, 1200);
      } catch (_) {}
    });
  }

  function meRecordRows(records, emptyText) {
    if (!records.length) {
      return `<div class="me-record-empty">${escape(emptyText)}</div>`;
    }
    return `<div class="me-record-list">${records.map(item => {
      const clickable = item.action === 'journal' || item.action === 'search' || item.action === 'pick';
      const tag = clickable ? 'button' : 'div';
      const typeAttr = clickable ? ' type="button"' : '';
      return `<${tag} class="me-record-row${clickable ? ' is-clickable' : ''}"${typeAttr}
        data-me-action="${escape(item.action || '')}"
        data-me-fid="${escape(item.fid || '')}"
        data-me-issn="${escape(item.issn || '')}"
        data-me-query="${escape(item.query || '')}"
        data-me-href="${escape(item.href || '')}"
        data-me-title="${escape(item.title || '')}">
        <div class="me-record-main">
          <strong>${escape(item.title)}</strong>
          ${item.meta ? `<span>${escape(item.meta)}</span>` : ''}
        </div>
        <time>${escape(formatMeRecordTime(item.time))}</time>
      </${tag}>`;
    }).join('')}</div>`;
  }

  function openJournalFromMeHistory({ fid, issn, href, title }) {
    let rec = null;
    if (fid) rec = findRecByFid(fid) || (favsData && favsData[fid]) || null;
    if (!rec && issn) {
      const key = String(issn).toUpperCase();
      rec = (journals || []).find(j => String(j.issn || '').toUpperCase() === key || String(j.eissn || '').toUpperCase() === key);
    }
    if (!rec && title) {
      const t0 = String(title).toLowerCase().trim();
      rec = (journals || []).find(j => String(j.name || '').toLowerCase() === t0);
    }
    if (!rec && href) {
      const m = String(href).match(/\/journal\/([^/?#]+)/);
      if (m) {
        let slug = m[1];
        try { slug = decodeURIComponent(slug); } catch (_) {}
        rec = (journals || []).find(j => j.slug === slug || favId(j) === slug);
      }
    }
    if (rec) {
      openDrawer(rec, { pageMode: true, source: 'me_history' });
      return true;
    }
    if (href && /^https?:\/\//i.test(href)) {
      window.open(href, '_blank', 'noopener');
      return true;
    }
    showFavToast(T('未找到该期刊，请稍后数据加载完成再试', 'Journal not found. Wait for data to load and try again.'));
    return false;
  }

  function runSearchFromMeHistory(query, mode) {
    const q = String(query || '').trim();
    if (!q) return;
    if (mode === 'pick') {
      activateTab('pick');
      const ta = document.getElementById('pick-input') || document.querySelector('#pick-query, textarea.pick-input, #pick-text');
      if (ta) {
        ta.value = q;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btn = document.getElementById('pick-run') || document.querySelector('[data-pick-run], #pick-submit, .pick-run-btn');
      if (btn) btn.click();
      else showFavToast(T('已填入荐刊关键词，请点击开始推荐', 'Query filled. Click run to recommend.'));
      return;
    }
    activateTab('home');
    activeQuery = q;
    const qEl = $('#q');
    if (qEl) {
      qEl.value = q;
      qEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const submit = $('#search-submit');
    if (submit) submit.click();
  }

  function bindMeRecordClicks(panel) {
    if (!panel || panel.__meRecordBound) return;
    panel.__meRecordBound = true;
    panel.addEventListener('click', (e) => {
      const row = e.target.closest('[data-me-action]');
      if (!row || !panel.contains(row)) return;
      const action = row.dataset.meAction;
      if (action === 'journal') {
        e.preventDefault();
        openJournalFromMeHistory({
          fid: row.dataset.meFid,
          issn: row.dataset.meIssn,
          href: row.dataset.meHref,
          title: row.dataset.meTitle,
        });
      } else if (action === 'search') {
        e.preventDefault();
        runSearchFromMeHistory(row.dataset.meQuery || row.dataset.meTitle, 'search');
      } else if (action === 'pick') {
        e.preventDefault();
        runSearchFromMeHistory(row.dataset.meQuery || row.dataset.meTitle, 'pick');
      }
    });
  }

  function renderMeRecordPanel(scope, type) {
    const panel = scope.querySelector('[data-me-record-panel]');
    if (!panel) return;
    scope.querySelectorAll('[data-me-stat]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.meStat === type);
    });
    panel.hidden = false;
    bindMeRecordClicks(panel);
    if (type === 'credits') {
      const credits = accountCreditValue();
      const m = membershipTierLabel();
      const ents = user && user.entitlements;
      const creditLine = !user
        ? '0'
        : (ents && ents.credits && ents.credits.unlimited)
          ? '∞'
          : formatCreditValue(credits);
      // 会员档位已在顶部展示，此处只补 Credits 说明与订阅入口
      panel.innerHTML = `<h2>${T('积分说明','Credits')}</h2>
        <div class="me-record-list">
          <div class="me-record-row">
            <div class="me-record-main">
              <strong>${escape(creditLine)} Credits</strong>
              <span>${signedCreditHint()}</span>
            </div>
          </div>
          ${user ? `<div class="me-record-row is-clickable" data-me-open-pricing type="button" role="button">
            <div class="me-record-main">
              <strong>${T('查看订阅方案','View plans')}</strong>
              <span>${T('升级 Pro / Max 解锁更多能力','Upgrade to Pro / Max for more features')}</span>
            </div>
            <time>→</time>
          </div>` : ''}
        </div>`;
      panel.querySelector('[data-me-open-pricing]')?.addEventListener('click', () => {
        location.href = '/#pricing';
      });
      return;
    }
    if (type === 'views') {
      const todayRows = localViewRecords(40, { todayOnly: true });
      const allRows = localViewRecords(40, { todayOnly: false });
      panel.innerHTML = `<h2>${T('今日浏览','Views today')}</h2>
        ${meRecordRows(
          todayRows.length ? todayRows : allRows,
          T('暂无本机浏览记录。打开期刊详情后会记录在这里，点击可再次打开。','No view records yet. Open journal details to record them; click a row to reopen.')
        )}
        ${todayRows.length && allRows.length > todayRows.length
          ? `<h2 style="margin-top:16px">${T('更早浏览','Earlier views')}</h2>${meRecordRows(allRows.filter(r => !todayRows.some(t => t.fid === r.fid && t.time === r.time)), '')}`
          : ''}`;
      return;
    }
    if (type === 'searches') {
      panel.innerHTML = `<h2>${T('搜索记录','Search records')}</h2>${meRecordRows(
        localSearchRecords(),
        T('暂无搜索记录。首页查刊或荐刊后会记录在这里，点击可重新搜索。','No search records yet. Searches appear here; click a row to run again.')
      )}`;
      return;
    }
    if (type === 'api') {
      const records = localPluginCallRecords();
      const fallback = localPluginCallCount()
        ? T('账号只同步了调用次数，暂未返回逐条明细。','Only aggregate call count is synced for this account; itemized records are not available yet.')
        : T('暂无插件 / API 调用记录。','No plugin / API call records yet.');
      panel.innerHTML = `<div class="me-record-head">
        <h2>${T('插件 / API 调用记录','Plugin / API call records')}</h2>
        <button type="button" class="btn-mini" data-create-api-key>${T('新建 API Key','New API key')}</button>
      </div>
      <div data-api-key-body>${T('加载中…','Loading…')}</div>
      <div class="me-record-api-usage">${meRecordRows(records, fallback)}</div>`;
      bindApiKeyPanel(panel);
      hydrateApiKeyPanel(panel);
    }
  }

  function signedCreditHint() {
    if (!user) return T('登录后可查看会员档位与积分。','Sign in to view membership and credits.');
    const m = membershipTierLabel();
    if (m.id === 'max') return T('Max 月度 AI credits，由服务器同步。','Max monthly AI credits, synced from server.');
    if (m.id === 'pro') return T('Pro 含插件徽章与收藏；原文每月 200 篇 · AI 500 credits/月。','Pro: extension badges & favorites; 200 full-text lookups/month · 500 AI credits/month.');
    return T('Free 账号 · AI 荐刊终身共 10 次 · 升级可解锁更多。','Free plan · 10 lifetime AI picks · upgrade for more.');
  }

  /** 本地日历日 YYYY-MM-DD（避免 toISOString UTC 错日） */
  function localDateKey(d) {
    const x = d instanceof Date ? d : new Date(d);
    if (!Number.isFinite(x.getTime())) return '';
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** 按日汇总本机活动次数（浏览 + 当日用量）→ 热力图色阶 */
  function activityCountsByDay() {
    const map = Object.create(null);
    const bump = (ts, n = 1) => {
      const t = Number(ts);
      if (!Number.isFinite(t) || t <= 0) return;
      const key = localDateKey(new Date(t));
      if (!key) return;
      map[key] = (map[key] || 0) + n;
    };
    try {
      const views = JSON.parse(localStorage.getItem(VIEWHIST_KEY || 'ailatest.viewhist') || '[]');
      if (Array.isArray(views)) {
        views.forEach((e) => {
          if (!e) return;
          bump(e.t || e.time || recordTimeMs(e), 1);
        });
      }
    } catch (_) {}
    try {
      // 首页搜索历史无时间戳时不计入历史格，仅用今日 usage
      const usage = getDailyUsage();
      if (usage?.date) {
        const n = Number(usage.views || 0) + Number(usage.searches || 0);
        if (n > 0) map[usage.date] = Math.max(map[usage.date] || 0, n);
      }
    } catch (_) {}
    const todayKey = localDateKey(new Date());
    if (todayKey) {
      map[todayKey] = Math.max(map[todayKey] || 0, todayViewCount() + Number(getDailyUsage().searches || 0));
    }
    return map;
  }

  function activityLevelFromCount(c) {
    const n = Number(c) || 0;
    if (n <= 0) return 0;
    if (n === 1) return 1;
    if (n <= 3) return 2;
    if (n <= 6) return 3;
    return 4;
  }

  /** 个人使用汇总：连续天数、峰值、常看刊 / 学科等（本机记录） */
  function computeUsageSummary() {
    const counts = activityCountsByDay();
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayKey = localDateKey(today);

    let totalActivity = 0;
    let peakCount = 0;
    let peakDate = '';
    let activeDays = 0;
    Object.keys(counts).forEach((k) => {
      const n = Number(counts[k]) || 0;
      if (n <= 0) return;
      totalActivity += n;
      activeDays += 1;
      if (n > peakCount) {
        peakCount = n;
        peakDate = k;
      }
    });

    // 从今天往前算当前连续；全量扫描最长连续
    let currentStreak = 0;
    for (let i = 0; i < 400; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = localDateKey(d);
      if ((counts[key] || 0) > 0) currentStreak += 1;
      else break;
    }
    let longestStreak = 0;
    let run = 0;
    for (let i = 400; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = localDateKey(d);
      if ((counts[key] || 0) > 0) {
        run += 1;
        if (run > longestStreak) longestStreak = run;
      } else {
        run = 0;
      }
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    let viewHist = [];
    try {
      viewHist = JSON.parse(localStorage.getItem(VIEWHIST_KEY || 'ailatest.viewhist') || '[]');
      if (!Array.isArray(viewHist)) viewHist = [];
    } catch (_) { viewHist = []; }

    const uniqueJournals = viewHist.filter((e) => e && (e.k || e.n)).length;
    const topJournals = viewHist.slice(0, 8).map((e) => ({
      name: e.n || e.name || e.k || '—',
      fid: e.k || '',
      path: e.p || '',
      cats: Array.isArray(e.c) ? e.c : [],
    }));

    const subjectScore = Object.create(null);
    viewHist.forEach((e, i) => {
      const w = 1 / (1 + i * 0.08);
      (e && e.c || []).forEach((c) => {
        if (!c) return;
        subjectScore[c] = (subjectScore[c] || 0) + w;
      });
    });
    const topSubjects = Object.entries(subjectScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, score]) => ({ name, score }));

    let pickCount = 0;
    try {
      const ph = JSON.parse(localStorage.getItem('ailatest.pick.history') || '[]');
      if (Array.isArray(ph)) pickCount = ph.length;
    } catch (_) {}

    return {
      totalActivity,
      peakCount,
      peakDate,
      activeDays,
      currentStreak,
      longestStreak,
      uniqueJournals,
      favCount: allFavIds().size,
      searchCount: localSearchCount(),
      pickCount,
      pluginCalls: localPluginCallCount(),
      todayViews: todayViewCount(),
      todayKey,
      topJournals,
      topSubjects,
    };
  }

  function renderUsageSummaryHtml() {
    const s = computeUsageSummary();
    const daysUnit = T('天', 'd');
    const peakLabel = s.peakDate
      ? `${s.peakCount} · ${s.peakDate.slice(5).replace('-', '/')}`
      : String(s.peakCount || 0);

    const insightRows = [
      [T('今日浏览', 'Views today'), String(s.todayViews)],
      [T('累计浏览期刊', 'Journals viewed'), String(s.uniqueJournals)],
      [T('搜索记录', 'Searches'), String(s.searchCount)],
      [T('AI 荐刊记录', 'AI picks'), String(s.pickCount)],
      [T('活跃天数', 'Active days'), String(s.activeDays)],
      [T('插件 / API', 'Plugin / API'), String(s.pluginCalls)],
    ];

    const topSubjectRows = s.topSubjects.length
      ? s.topSubjects.map((x, i) => {
          const pct = Math.round((x.score / (s.topSubjects[0].score || 1)) * 100);
          return `<div class="me-insight-row">
            <span class="me-insight-k">${escape(x.name)}</span>
            <span class="me-insight-v">${pct}%</span>
          </div>`;
        }).join('')
      : `<div class="me-insight-empty">${T('浏览期刊后，这里会显示常看学科', 'Subjects appear after you open journals')}</div>`;

    const topJournalRows = s.topJournals.length
      ? s.topJournals.slice(0, 5).map((j) => {
          const href = j.path || (j.fid ? `#j/${encodeURIComponent(j.fid)}` : '');
          const inner = `<span class="me-insight-k" title="${escape(j.name)}">${escape(titleCase(j.name))}</span>`;
          return `<div class="me-insight-row me-insight-journal">
            ${href ? `<a href="${escape(href)}" data-me-open-fid="${escape(j.fid || '')}">${inner}</a>` : inner}
          </div>`;
        }).join('')
      : `<div class="me-insight-empty">${T('打开期刊详情后会出现在这里', 'Recently opened journals show up here')}</div>`;

    return `
      <div class="me-summary-strip" role="group" aria-label="${escape(T('使用摘要', 'Usage summary'))}">
        <div class="me-summary-item">
          <strong>${s.totalActivity.toLocaleString()}</strong>
          <span>${T('累计活动', 'Total activity')}</span>
        </div>
        <div class="me-summary-item">
          <strong>${escape(peakLabel)}</strong>
          <span>${T('峰值日活动', 'Peak day')}</span>
        </div>
        <div class="me-summary-item">
          <strong>${s.favCount.toLocaleString()}</strong>
          <span>${T('收藏期刊', 'Saved')}</span>
        </div>
        <div class="me-summary-item">
          <strong>${s.currentStreak}${daysUnit}</strong>
          <span>${T('当前连续', 'Current streak')}</span>
        </div>
        <div class="me-summary-item">
          <strong>${s.longestStreak}${daysUnit}</strong>
          <span>${T('最长连续', 'Longest streak')}</span>
        </div>
      </div>
      <div class="me-insight-grid">
        <section class="me-insight-card">
          <h4 class="me-insight-title">${T('活动洞察', 'Activity insights')}</h4>
          ${insightRows.map(([k, v]) => `<div class="me-insight-row"><span class="me-insight-k">${escape(k)}</span><span class="me-insight-v">${escape(v)}</span></div>`).join('')}
        </section>
        <section class="me-insight-card">
          <h4 class="me-insight-title">${T('常看学科', 'Top subjects')}</h4>
          ${topSubjectRows}
        </section>
        <section class="me-insight-card me-insight-card-wide">
          <h4 class="me-insight-title">${T('最近打开', 'Recently opened')}</h4>
          ${topJournalRows}
        </section>
      </div>`;
  }

  /**
   * GitHub 风格热力图：列=周、行=星期（日→六），每天一格。
   * 近 52 周（约 1 年），含本周；CSS 按容器宽度铺满。
   */
  function renderActivityDots() {
    const weeks = 52;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    // 周起始：周日（与常见贡献图一致）
    const endSundayOffset = today.getDay(); // 0=Sun … 6=Sat
    const start = new Date(today);
    start.setDate(today.getDate() - endSundayOffset - (weeks - 1) * 7);
    start.setHours(12, 0, 0, 0);

    const counts = activityCountsByDay();
    const cells = [];
    const monthMarks = []; // { col, label }
    let prevMonth = -1;

    for (let w = 0; w < weeks; w++) {
      for (let dow = 0; dow < 7; dow++) {
        const d = new Date(start);
        d.setDate(start.getDate() + w * 7 + dow);
        d.setHours(12, 0, 0, 0);
        const key = localDateKey(d);
        const isFuture = d.getTime() > today.getTime() + 12 * 3600 * 1000;
        const count = isFuture ? 0 : (counts[key] || 0);
        const level = isFuture ? 0 : activityLevelFromCount(count);
        const label = d.toLocaleDateString(uiLocale(), {
          year: 'numeric', month: 'short', day: 'numeric', weekday: 'short',
        });
        const tip = count
          ? `${label} · ${count} ${T('次活动', 'activities')}`
          : (isFuture ? label : `${label} · ${T('无记录', 'No activity')}`);
        cells.push(
          `<span class="me-activity-dot level-${level}${isFuture ? ' is-future' : ''}" title="${escape(tip)}" data-date="${escape(key)}" data-count="${count}"></span>`
        );
      }
      // 月初或首列标注月份
      const colDay = new Date(start);
      colDay.setDate(start.getDate() + w * 7);
      const m = colDay.getMonth();
      if (w === 0 || m !== prevMonth) {
        // 中文用「M月」，避免 short 被窄列裁成「7 」
        const label = uiLocale().startsWith('zh')
          ? `${m + 1}${T('月', '月')}`
          : colDay.toLocaleDateString(uiLocale(), { month: 'short' });
        monthMarks.push({ col: w, label });
        prevMonth = m;
      }
    }

    // 每月占多列（到下一月前），避免 52 周一列宽把「7月」裁掉
    const monthRow = monthMarks.map((mark, i) => {
      const nextCol = i + 1 < monthMarks.length ? monthMarks[i + 1].col : weeks;
      const span = Math.max(1, nextCol - mark.col);
      const startCol = mark.col + 1; // CSS grid 1-based
      return `<span class="me-activity-month-cell" style="grid-column:${startCol} / span ${span}">${escape(mark.label)}</span>`;
    }).join('');

    return `<div class="me-activity-heat" style="--activity-weeks:${weeks}">
      <div class="me-activity-grid settings-activity-grid" role="img" aria-label="${escape(T('近 1 年每日活动', 'Daily activity · last 12 months'))}">${cells.join('')}</div>
      <div class="me-activity-month-row" aria-hidden="true">${monthRow}</div>
    </div>`;
  }

  let _settingsSection = 'account';

  function openSettingsShell(section) {
    // 活动已并入账号，旧 hash/状态兼容
    if (section === 'activity') section = 'account';
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    // 手机：默认进一级全屏菜单；若显式指定 section 则进二级全屏
    if (mobile && !section) {
      _settingsSection = 'account';
      window.__settingsOpenAsRoot = true;
    } else {
      if (section) _settingsSection = section;
      window.__settingsOpenAsRoot = false;
    }
    document.body.classList.add('settings-open');
    document.documentElement.classList.add('settings-open');
    const panel = document.querySelector('.tab-panel[data-panel="me"]');
    if (panel) {
      panel.hidden = false;
      panel.removeAttribute('hidden');
      panel.style.display = 'flex';
      panel.style.visibility = 'visible';
      panel.style.pointerEvents = 'auto';
    }
    activeTab = 'me';
    renderMe();
  }

  function closeSettingsShell(opts = {}) {
    document.body.classList.remove('settings-open');
    document.documentElement.classList.remove('settings-open');
    const panel = document.querySelector('.tab-panel[data-panel="me"]');
    if (panel) {
      panel.hidden = true;
      panel.style.display = '';
      panel.style.visibility = '';
      panel.style.pointerEvents = '';
    }
    // 关闭后回到打开设置前的页面
    if (!opts.keepTab && activeTab === 'me') {
      let back = window.__settingsReturnTab || 'int';
      if (back === 'me') back = 'int';
      if (typeof window.__activateJournalTab === 'function') {
        window.__activateJournalTab(back, { push: true });
      } else if (typeof activateTab === 'function') {
        activateTab(back, { push: true });
      } else {
        activeTab = back;
      }
    }
  }

  function showSettingsSection(id, opts = {}) {
    if (id === 'activity') id = 'account';
    _settingsSection = id || 'account';
    const root = $('#me-content');
    if (!root) return;
    root.querySelectorAll('[data-settings-section]').forEach((el) => {
      el.hidden = el.getAttribute('data-settings-section') !== _settingsSection;
    });
    root.querySelectorAll('[data-settings-nav]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-settings-nav') === _settingsSection);
    });
    // 移动端两级：进入具体分区 = 二级页
    const layout = root.querySelector('.settings-layout');
    if (layout) {
      const goSub = opts.subpage !== false && (opts.subpage === true || window.matchMedia('(max-width: 900px)').matches);
      layout.classList.toggle('settings-subpage', !!goSub && !!id);
    }
    const body = root.querySelector('.settings-body');
    if (body) body.scrollTop = 0;
  }

  function exitSettingsSubpage() {
    const root = $('#me-content');
    const layout = root && root.querySelector('.settings-layout');
    if (layout) layout.classList.remove('settings-subpage');
  }

  function renderMe() {
    const box = $('#me-content');
    if (!box) return;
    document.body.classList.add('settings-open');
    const favCount = allFavIds().size;
    const credits = accountCreditValue();
    const creditText = formatCreditValue(user ? credits : 0);
    const signed = !!user;
    const langLabel = (typeof uiLocale === 'function' && uiLocale() === 'en') ? 'English' : '中文';
    box.innerHTML = `
      <div class="settings-scrim" data-settings-close tabindex="-1" aria-hidden="true"></div>
      <div class="settings-panel" role="dialog" aria-modal="true" aria-label="${T('设置','Settings')}">
        <div class="settings-handle" aria-hidden="true"></div>
        <button type="button" class="settings-close" data-settings-close aria-label="${T('关闭','Close')}">×</button>
        <div class="settings-layout me-page settings-me">
          <nav class="settings-nav" aria-label="${T('设置导航','Settings')}">
            <div class="settings-nav-title">${T('设置','Settings')}</div>
            <button type="button" data-settings-nav="account" class="${_settingsSection === 'account' ? 'active' : ''}">${T('账号','Account')}</button>
            <button type="button" data-settings-nav="billing" class="${_settingsSection === 'billing' ? 'active' : ''}">${T('订阅','Billing')}</button>
            <button type="button" data-settings-nav="gift" class="${_settingsSection === 'gift' ? 'active' : ''}">${T('礼品码','Gift codes')}</button>
            <button type="button" data-settings-nav="downloads" class="${_settingsSection === 'downloads' ? 'active' : ''}">${T('下载','Downloads')}</button>
            <button type="button" data-settings-nav="rankings" class="${_settingsSection === 'rankings' ? 'active' : ''}">${T('榜单','Rankings')}</button>
            <button type="button" data-settings-nav="regions" class="${_settingsSection === 'regions' ? 'active' : ''}">${T('地区站','Regions')}</button>
            <button type="button" data-settings-nav="language" class="${_settingsSection === 'language' ? 'active' : ''}">${T('语言','Language')}</button>
            <button type="button" data-settings-nav="version" class="${_settingsSection === 'version' ? 'active' : ''}">${T('版本信息','Version')}</button>
          </nav>
          <div class="settings-body">
            <button type="button" class="settings-back" data-settings-back>← ${T('设置','Settings')}</button>
            <section class="settings-section" data-settings-section="account" ${_settingsSection === 'account' ? '' : 'hidden'}>
              <h2 class="settings-section-title">${T('账号与活动','Account & activity')}</h2>
              <header class="me-hero settings-account-hero">
                ${userAvatarHtml()}
                <div class="me-title-block">
                  <h1><span class="me-display-name">${escape(userDisplayName())}</span> ${membershipBadgeHtml()}</h1>
                  <p class="me-account-meta" title="${escape(userEmailText())}">${escape(userEmailText())}<span class="me-meta-sep">·</span>${escape(userProviderText())}</p>
                </div>
                <div class="me-actions">
                  ${signed
                    ? `<button class="btn-mini" data-me-logout>${T('退出登录','Sign out')}</button>`
                    : `<button class="btn-mini primary" data-me-login>${T('登录 / 注册','Sign in / Sign up')}</button>`}
                </div>
              </header>
              <div class="me-stat-strip settings-stat-strip">
                <button type="button" class="me-stat-item" data-me-stat="credits"><strong>${escape(creditText)}</strong><span>${T('Credits','Credits')}</span></button>
                <a class="me-stat-item" data-me-stat="favorites" href="/favorites"><strong>${favCount}</strong><span>${T('收藏','Saved')}</span></a>
                <button type="button" class="me-stat-item" data-me-stat="views"><strong>${todayViewCount()}</strong><span>${T('今日浏览','Views')}</span></button>
                <button type="button" class="me-stat-item" data-me-stat="searches"><strong>${localSearchCount()}</strong><span>${T('搜索','Searches')}</span></button>
                <button type="button" class="me-stat-item" data-me-stat="api"><strong>${localPluginCallCount()}</strong><span>${T('API','API')}</span></button>
              </div>
              <section class="me-card me-record-panel" data-me-record-panel hidden></section>
              ${renderUsageSummaryHtml()}
              <section class="me-card me-activity-card settings-activity-card">
                <h3 class="settings-subhead">${T('活动记录','Activity')}</h3>
                <div class="me-activity-months"><span>${T('近 1 年 · 每天一格','Last 12 months · one cell per day')}</span><span>${new Date().toLocaleDateString(uiLocale(), { month: 'short', day: 'numeric' })}</span></div>
                ${renderActivityDots()}
              </section>
            </section>

            <section class="settings-section" data-settings-section="regions" ${_settingsSection === 'regions' ? '' : 'hidden'}>
              <h2 class="settings-section-title">${T('地区站','Region stations')}</h2>
              <p class="settings-hint">${T(
                '固定后会出现在左侧导航。取消固定则从侧栏移除（仍可在此重新添加）。',
                'Pinned regions appear on the left rail. Unpin removes them from the rail (you can pin again here).'
              )}</p>
              <p class="settings-hint settings-hint-soft">${(() => {
                const ent = regionEntitlements();
                if (ent.unlockAll) return T('当前为 Max：可自由固定 / 取消任意地区。', 'Max plan: pin or unpin any region freely.');
                if (ent.maxCustomPins > 0) return T(`当前为 Pro：除中国外最多再固定 ${ent.maxCustomPins} 个地区。`, `Pro plan: pin up to ${ent.maxCustomPins} extra regions beyond China.`);
                return T('当前为 Free：中国站默认保留；其他地区可临时查看，升级后可固定到侧栏。', 'Free plan: China stays on the rail; other regions open temporarily. Upgrade to pin them.');
              })()}</p>
              <div class="settings-region-list" data-settings-region-list>
                ${REGION_STATION_IDS.map((id) => {
                  const st = STATIONS.find(s => s.id === id) || { zh: id, en: id };
                  const label = lang === 'en' ? (st.en || st.zh) : (st.zh || st.en);
                  const code = ({ dom: 'CN', in: 'IN', my: 'MY', kr: 'KR', pbn: 'PL', isc: 'IR', scielo: 'LA' })[id] || id.toUpperCase();
                  const pinned = getPinnedRegions().includes(id);
                  return `<div class="settings-region-row${pinned ? ' is-pinned' : ''}" data-region-id="${escape(id)}">
                    <div class="settings-region-meta">
                      <span class="settings-region-flag" aria-hidden="true">${escape(code)}</span>
                      <strong>${escape(label)}</strong>
                    </div>
                    <button type="button" class="settings-region-toggle" data-settings-region-toggle="${escape(id)}" aria-pressed="${pinned ? 'true' : 'false'}">
                      ${pinned ? T('已固定 · 点击取消', 'Pinned · tap to unpin') : T('固定到侧栏', 'Pin to rail')}
                    </button>
                  </div>`;
                }).join('')}
              </div>
            </section>

            <section class="settings-section" data-settings-section="billing" ${_settingsSection === 'billing' ? '' : 'hidden'}>
              <h2 class="settings-section-title">${T('订阅','Billing')}</h2>
              <p class="settings-hint">${T('当前档位','Current plan')}：<strong>${escape(membershipTierLabel().label || '—')}</strong>${(() => {
                const exp = membershipExpiryInfo();
                if (!exp.short && !exp.long) return '';
                return ` · <span class="settings-plan-expiry" title="${escape(exp.long || exp.short)}">${escape(exp.short || exp.long)}</span>`;
              })()}</p>
              <div class="billing-toggle-wrap settings-billing-toggle" data-market-intl-only>
                <div class="billing-toggle" role="group" aria-label="${T('计费周期','Billing period')}">
                  <button type="button" class="billing-toggle-btn is-on" data-billing-toggle="year" aria-pressed="true">
                    <span>${T('年付','Yearly')}</span>
                    <em class="billing-save-tag">${T('更划算','Save')}</em>
                  </button>
                  <button type="button" class="billing-toggle-btn" data-billing-toggle="month" aria-pressed="false">
                    <span>${T('月付','Monthly')}</span>
                  </button>
                </div>
              </div>
              <p class="settings-hint settings-billing-note" data-billing-note>${T('价格 USD · 年付 · 下方划线为原价（更划算）','USD · yearly · strikethrough = list price (best value)')}</p>
              <div class="settings-plan-prices" style="display:grid;gap:8px;margin:0 0 12px">
                <div class="s-row-like" style="cursor:default">
                  <span>Pro</span>
                  <strong data-plan-price="pro"><span data-price-amt>$7.99</span> <span data-price-unit>/ ${T('年','year')}</span></strong>
                </div>
                <p class="settings-hint" style="margin:-4px 0 0" data-plan-was="pro">${T('原价 $11.99','Was $11.99')}</p>
                <div class="s-row-like" style="cursor:default">
                  <span>Max</span>
                  <strong data-plan-price="max"><span data-price-amt>$9.99</span> <span data-price-unit>/ ${T('年','year')}</span></strong>
                </div>
                <p class="settings-hint" style="margin:-4px 0 0" data-plan-was="max">${T('原价 $14.99','Was $14.99')}</p>
              </div>
              <p class="settings-hint" data-edu-status hidden style="margin:0 0 10px"></p>
              <button type="button" class="settings-link-row" data-creem-checkout data-plan="pro" data-period="year" style="width:100%">${T('升级 Pro · 年付','Upgrade Pro · yearly')}<span>→</span></button>
              <button type="button" class="settings-link-row settings-edu-cta" data-creem-checkout data-plan="pro" data-period="year" data-edu="1" style="width:100%">${T('教育价升级 Pro','Edu upgrade Pro')}<span>→</span></button>
              <button type="button" class="settings-link-row" data-creem-checkout data-plan="max" data-period="year" style="width:100%">${T('升级 Max · 年付','Upgrade Max · yearly')}<span>→</span></button>
              <button type="button" class="settings-link-row settings-edu-cta" data-creem-checkout data-plan="max" data-period="year" data-edu="1" style="width:100%">${T('教育价升级 Max','Edu upgrade Max')}<span>→</span></button>
              <a class="settings-link-row" href="/pricing">${T('查看完整方案对比','Full plan comparison')}<span>↗</span></a>
            </section>

            <section class="settings-section" data-settings-section="downloads" ${_settingsSection === 'downloads' ? '' : 'hidden'}>
              <h2 class="settings-section-title">${T('下载','Downloads')}</h2>
              <a class="settings-link-row" href="/#download">${T('插件与下载','Extension & downloads')}<span>↗</span></a>
            </section>

            <section class="settings-section" data-settings-section="rankings" ${_settingsSection === 'rankings' ? '' : 'hidden'}>
              <h2 class="settings-section-title">${T('榜单','Rankings')}</h2>
              <p class="settings-hint">${T('榜单入口在首页；点卡片进入索引 / 学科 / 预警二级页。','Rankings live on the home page; open a card for indexes, subjects or warnings.')}</p>
              <a class="settings-link-row" href="/#rankings">${T('打开首页榜单','Open home rankings')}<span>↗</span></a>
              <a class="settings-link-row" href="/indexes/">${T('索引排行榜','Index rankings')}<span>→</span></a>
              <a class="settings-link-row" href="/subjects/">${T('学科排行榜','Subject rankings')}<span>→</span></a>
              <a class="settings-link-row" href="/indexes/warning/">${T('预警名单','Warning lists')}<span>→</span></a>
            </section>

            <section class="settings-section" data-settings-section="gift" ${_settingsSection === 'gift' ? '' : 'hidden'}>
              <h2 class="settings-section-title">${T('礼品码','Gift codes')}</h2>
              <section class="me-card me-gift-card" style="margin:0">
                <form class="gift-redeem" data-gift-redeem>
                  <div>
                    <strong>${T('兑换礼品码','Redeem a gift code')}</strong>
                    <p>${T('输入礼品码，立即激活对应会员。','Enter a code to activate the included plan.')}</p>
                  </div>
                  <div class="gift-redeem-row">
                    <input name="code" type="text" autocomplete="off" spellcheck="false"
                      placeholder="JOURNAL-MAX-XXXX-XXXX-XXXX-XXXX"
                      ${signed ? '' : 'disabled'} />
                    <button type="submit" ${signed ? '' : 'disabled'}>${T('兑换','Redeem')}</button>
                  </div>
                  ${signed ? '' : `<small>${T('登录后可兑换礼品码','Sign in to redeem a code')}</small>`}
                </form>
                ${isOwnerClient() ? `
                <form class="gift-admin" data-gift-admin>
                  <header>
                    <div>
                      <strong>${T('站长礼品卡','Owner gift cards')}</strong>
                      <p>${T('生成后只显示一次；服务端验证，每个码仅可成功兑换一次。右上角 × 可作废未使用的码。','Shown once; server-verified, redeemable once. Use × to void unused codes.')}</p>
                    </div>
                    <span>OWNER · MAX</span>
                  </header>
                  <div class="gift-admin-controls">
                    <select name="plan" aria-label="plan">
                      <option value="pro">Pro</option>
                      <option value="max" selected>Max</option>
                    </select>
                    <select name="duration" aria-label="duration">
                      <option value="30">${T('30 天','30 days')}</option>
                      <option value="365" selected>${T('1 年','1 year')}</option>
                      <option value="permanent">${T('永久','Permanent')}</option>
                    </select>
                    <input name="quantity" type="number" min="1" max="20" value="1" aria-label="${T('数量','Quantity')}" />
                    <button type="submit">${T('生成礼品码','Generate')}</button>
                  </div>
                  <div class="gift-code-results" data-gift-results hidden></div>
                </form>` : ''}
                <p class="gift-message" data-gift-message role="status" hidden></p>
              </section>
            </section>

            <section class="settings-section" data-settings-section="language" ${_settingsSection === 'language' ? '' : 'hidden'}>
              <h2 class="settings-section-title">${T('语言','Language')}</h2>
              <p class="settings-hint">${T('当前','Current')}：<strong>${escape(LANG_META[lang]?.label || langLabel)}</strong></p>
              <div class="settings-lang-grid" role="listbox" aria-label="${T('界面语言','Interface language')}">
                ${LANG_ORDER.map((code) => {
                  const meta = LANG_META[code] || { label: code };
                  const on = code === lang;
                  return `<button type="button" class="settings-lang-chip${on ? ' active' : ''}" data-set-lang="${escape(code)}" aria-selected="${on ? 'true' : 'false'}">${escape(meta.label)}</button>`;
                }).join('')}
              </div>
            </section>

            <section class="settings-section" data-settings-section="version" ${_settingsSection === 'version' ? '' : 'hidden'}>
              <h2 class="settings-section-title">${T('版本信息','Version')}</h2>
              <div class="s-row-like settings-link-row" style="cursor:default">
                <span>${T('客户端构建','Client build')}</span>
                <span style="color:#a8a29e;font-size:13px">${escape(window.__BUILD_VER || '—')}</span>
              </div>
              <a class="settings-link-row" href="/about">${T('关于我们','About')}<span>↗</span></a>
              <a class="settings-link-row" href="/contact">${T('联系','Contact')}<span>↗</span></a>
            </section>
          </div>
        </div>
      </div>`;

    box.querySelectorAll('[data-settings-close]').forEach((el) => {
      el.addEventListener('click', () => closeSettingsShell());
    });
    box.querySelector('[data-settings-back]')?.addEventListener('click', () => {
      exitSettingsSubpage();
    });
    // 设置内 Creem 结账（与 pricing 页同一脚本逻辑）
    if (typeof window.__bindCreemCheckout === 'function') {
      window.__bindCreemCheckout(box);
    } else {
      box.querySelectorAll('[data-creem-checkout]').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          location.href = '/#pricing';
        });
      });
    }
    box.querySelectorAll('[data-settings-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-settings-nav');
        // 手机：进入二级；桌面：同屏切换
        showSettingsSection(id, { subpage: window.matchMedia('(max-width: 900px)').matches });
      });
    });
    // 桌面：侧栏+内容同屏；手机：一级全屏列表 / 二级全屏详情
    if (window.matchMedia('(max-width: 900px)').matches) {
      // 从侧栏/账号入口进入：始终先一级列表（须配合 CSS 给 #me-content 实高，否则 absolute 导航高度为 0 全白）
      if (window.__settingsOpenAsRoot !== false) {
        exitSettingsSubpage();
        window.__settingsOpenAsRoot = false;
      } else {
        showSettingsSection(_settingsSection || 'account', { subpage: true });
      }
    } else {
      showSettingsSection(_settingsSection, { subpage: false });
    }
    box.querySelectorAll('a[href="/#rankings"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        closeSettingsShell({ keepTab: true });
        if (typeof window.__activateJournalTab === 'function') window.__activateJournalTab('home', { push: true });
        else activateTab('home', { push: true });
        requestAnimationFrame(() => {
          document.getElementById('rankings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    });
    // 语言芯片：点击即切换（允许重复点当前语言以强制刷新）
    box.querySelectorAll('[data-set-lang]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const code = btn.getAttribute('data-set-lang');
        if (!code) return;
        _settingsSection = 'language';
        setUiLanguage(code);
      });
    });
    // 地区站固定 / 取消（只改侧栏钉选，不强制跳转）
    box.querySelectorAll('[data-settings-region-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-settings-region-toggle');
        if (!id) return;
        const wasPinned = getPinnedRegions().includes(id);
        const ent = regionEntitlements();
        // Free 不能固定自定义地区：点击给出升级提示，不打开页面
        if (!wasPinned && !ent.unlockAll && ent.maxCustomPins === 0 && !FREE_BASE_REGION_IDS.includes(id)) {
          showRegionPaywallModal('pin_free');
          return;
        }
        const ok = togglePinnedRegion(id);
        if (!ok && !wasPinned) {
          // 已弹 paywall 或失败
          return;
        }
        applyStations();
        // 轻量刷新本行状态，避免整页闪烁
        const pinnedNow = getPinnedRegions().includes(id);
        const row = btn.closest('.settings-region-row');
        row?.classList.toggle('is-pinned', pinnedNow);
        btn.setAttribute('aria-pressed', pinnedNow ? 'true' : 'false');
        btn.textContent = pinnedNow
          ? T('已固定 · 点击取消', 'Pinned · tap to unpin')
          : T('固定到侧栏', 'Pin to rail');
      });
    });
    box.querySelector('[data-me-login]')?.addEventListener('click', startLogin);
    box.querySelector('.me-avatar img')?.addEventListener('error', (e) => {
      const wrap = e.currentTarget.closest('.me-avatar');
      e.currentTarget.remove();
      wrap?.classList.remove('has-photo');
    });
    box.querySelector('[data-me-logout]')?.addEventListener('click', () => {
      if (confirm(T('退出登录？','Sign out?'))) {
        doLogout();
        renderMe();
      }
    });
    box.querySelectorAll('[data-me-stat]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = btn.dataset.meStat;
        if (type === 'favorites') {
          e.preventDefault();
          closeSettingsShell({ keepTab: true });
          activateTab('fav');
          return;
        }
        renderMeRecordPanel(box, type);
      });
    });
    // 使用摘要：最近打开期刊
    box.querySelectorAll('[data-me-open-fid]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const fid = a.getAttribute('data-me-open-fid') || '';
        const href = a.getAttribute('href') || '';
        if (!fid && !href) return;
        e.preventDefault();
        openJournalFromMeHistory({ fid, href, title: a.textContent || '' });
      });
    });
    // 礼品码兑换 / 站长生成
    const giftMsg = box.querySelector('[data-gift-message]');
    const setGiftMsg = (text, isErr = false) => {
      if (!giftMsg) return;
      giftMsg.hidden = !text;
      giftMsg.textContent = text || '';
      giftMsg.classList.toggle('is-error', !!isErr);
    };
    box.querySelector('[data-gift-redeem]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!user?.token) { startLogin(); return; }
      const form = e.currentTarget;
      const code = String(new FormData(form).get('code') || '').trim();
      if (!code) return;
      const btn = form.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      setGiftMsg(T('兑换中…','Redeeming…'));
      try {
        const r = await fetch(`${API_BASE}/gift-codes/redeem`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          const map = {
            invalid_gift_code: T('礼品码无效','Invalid gift code'),
            gift_code_used: T('该礼品码已被使用','This gift code has been used'),
            gift_code_expired: T('该礼品码已过期','This gift code has expired'),
            gift_code_voided: T('该礼品码已作废','This gift code has been voided'),
            too_many_gift_attempts: T('尝试次数过多，请 15 分钟后再试','Too many attempts — try again in 15 minutes'),
            unauthorized: T('请先登录','Sign in first'),
            forbidden: T('无权限','Not allowed'),
            not_found: T('服务未就绪，请稍后重试','Service not ready, try again shortly'),
          };
          throw new Error(map[d.error] || d.error || `HTTP ${r.status}`);
        }
        form.reset();
        setGiftMsg(T(`兑换成功，已激活 ${(d.plan || '').toUpperCase() || '会员'}`, `Activated ${(d.plan || 'plan').toUpperCase()}`));
        await fetchAndMergeEntitlements();
        if (activeTab === 'me') renderMe();
      } catch (err) {
        setGiftMsg(err.message || String(err), true);
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    const bindGiftResultActions = (results) => {
      if (!results) return;
      results.querySelectorAll('[data-copy-code]').forEach((b) => {
        b.addEventListener('click', async () => {
          if (b.closest('.gift-code-item')?.classList.contains('is-voided')) return;
          try {
            await navigator.clipboard.writeText(b.dataset.copyCode || b.textContent || '');
            setGiftMsg(T('已复制','Copied'));
          } catch (_) {
            setGiftMsg(T('复制失败，请手动选择','Copy failed'), true);
          }
        });
      });
      results.querySelectorAll('[data-void-code]').forEach((b) => {
        b.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!user?.token || !isOwnerClient()) return;
          const code = b.dataset.voidCode || '';
          if (!code) return;
          if (!confirm(T('作废此礼品码？作废后无法兑换。','Void this gift code? It can no longer be redeemed.'))) return;
          b.disabled = true;
          setGiftMsg(T('作废中…','Voiding…'));
          try {
            const r = await fetch(`${API_BASE}/admin/gift-codes/void`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ code }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
              const map = {
                invalid_gift_code: T('礼品码无效','Invalid gift code'),
                gift_code_already_redeemed: T('已兑换，无法作废','Already redeemed — cannot void'),
                unauthorized: T('登录已失效，请重新登录','Session expired — sign in again'),
                forbidden: T('无权限','Not allowed'),
              };
              throw new Error(map[d.error] || d.error || `HTTP ${r.status}`);
            }
            const item = b.closest('.gift-code-item');
            if (item) item.classList.add('is-voided');
            setGiftMsg(T('已作废','Voided'));
          } catch (err) {
            setGiftMsg(err.message || String(err), true);
            b.disabled = false;
          }
        });
      });
    };
    box.querySelector('[data-gift-admin]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!user?.token) {
        setGiftMsg(T('请先登录','Sign in first'), true);
        startLogin();
        return;
      }
      if (!isOwnerClient()) {
        setGiftMsg(T('仅站长可生成礼品码','Only the owner can generate gift codes'), true);
        return;
      }
      const form = e.currentTarget;
      const fd = new FormData(form);
      const plan = String(fd.get('plan') || 'max');
      const duration = String(fd.get('duration') || '365');
      const quantity = Math.min(20, Math.max(1, Number(fd.get('quantity') || 1)));
      const durationDays = duration === 'permanent' ? null : Number(duration);
      const btn = form.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      setGiftMsg(T('生成中…','Generating…'));
      try {
        const r = await fetch(`${API_BASE}/admin/gift-codes`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, durationDays, quantity }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          const map = {
            unauthorized: T('登录已失效，请重新登录','Session expired — sign in again'),
            forbidden: T('服务端未识别站长账号，请用站长邮箱重新登录','Owner not recognized — re-sign in with owner email'),
            invalid_gift_options: T('礼品选项无效','Invalid gift options'),
            not_found: T('礼品服务未部署，请稍后再试','Gift API not deployed yet'),
          };
          throw new Error(map[d.error] || d.error || `HTTP ${r.status}`);
        }
        const codes = Array.isArray(d.codes) ? d.codes : [];
        const results = form.querySelector('[data-gift-results]');
        if (results) {
          results.hidden = !codes.length;
          results.innerHTML = codes.map(c =>
            `<div class="gift-code-item" data-code-item="${escape(c)}">
              <button type="button" class="gift-code-chip" data-copy-code="${escape(c)}" title="${T('点击复制','Click to copy')}">${escape(c)}</button>
              <button type="button" class="gift-code-void" data-void-code="${escape(c)}" title="${T('作废','Void')}" aria-label="${T('作废礼品码','Void gift code')}">×</button>
            </div>`
          ).join('');
          bindGiftResultActions(results);
        }
        setGiftMsg(T(`已生成 ${codes.length} 个单次礼品码（请立即复制；右上角 × 可作废）`, `${codes.length} single-use codes created — copy now; × voids a code`));
      } catch (err) {
        setGiftMsg(err.message || String(err), true);
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    // 登录用户后台拉权益 / 积分
    if (signed) {
      fetchAndMergeEntitlements().then(() => {
        if (activeTab === 'me') {
          // 若站长判定在拉权益后才成立，重绘以显示礼品卡管理
          if (isOwnerClient() && !box.querySelector('[data-gift-admin]')) {
            renderMe();
            return;
          }
          const strip = box.querySelector('[data-me-stat="credits"] strong');
          if (strip) strip.textContent = formatCreditValue(accountCreditValue());
          // 权益拉取后刷新档位徽章 + 有效期
          box.querySelectorAll('.me-tier-wrap').forEach((wrap) => {
            wrap.outerHTML = membershipBadgeHtml();
          });
          // 兼容旧节点（仅 badge、无 wrap）
          box.querySelectorAll('h1 > .me-tier-badge').forEach((badge) => {
            badge.outerHTML = membershipBadgeHtml();
          });
          const billHint = box.querySelector('[data-settings-section="billing"] .settings-hint');
          if (billHint && billHint.textContent && /当前档位|Current plan/i.test(billHint.textContent)) {
            const m = membershipTierLabel();
            const exp = membershipExpiryInfo();
            billHint.innerHTML = `${T('当前档位','Current plan')}：<strong>${escape(m.label || '—')}</strong>${
              exp.short || exp.long
                ? ` · <span class="settings-plan-expiry" title="${escape(exp.long || exp.short)}">${escape(exp.short || exp.long)}</span>`
                : ''
            }`;
          }
        }
        updateAccountCreditBadge();
      });
    }
  }

  // ───────── viewed-journal history → subject-aware default ranking ─────────
  const VIEWHIST_KEY = 'ailatest.viewhist';
  function recordView(r) {
    if (!r) return;
    const cats = Array.isArray(r.wos_categories) ? r.wos_categories.filter(Boolean) : [];
    try {
      let h = JSON.parse(localStorage.getItem(VIEWHIST_KEY) || '[]');
      if (!Array.isArray(h)) h = [];
      const key = favId(r) || r.issn || r.name || '';
      if (!key) return;
      h = h.filter(e => e && e.k !== key);
      h.unshift({
        k: key,
        n: r.name || r.en_name || r.cn_name || key,
        p: journalPublicPath(r),
        issn: r.issn || r.eissn || '',
        c: cats.slice(0, 3),
        t: Date.now(),
      });
      if (h.length > 80) h = h.slice(0, 80);
      localStorage.setItem(VIEWHIST_KEY, JSON.stringify(h));
    } catch (e) {}
  }
  function getPreferredCats(maxCats = 6) {
    try {
      const h = JSON.parse(localStorage.getItem(VIEWHIST_KEY) || '[]');
      if (!Array.isArray(h) || !h.length) return null;
      const score = {};
      h.slice(0, 25).forEach((e, i) => {
        const w = 1 / (1 + i * 0.15); // recency-weighted
        (e && e.c || []).forEach(c => { score[c] = (score[c] || 0) + w; });
      });
      const ranked = Object.keys(score).sort((a, b) => score[b] - score[a]).slice(0, maxCats);
      return ranked.length ? new Set(ranked) : null;
    } catch (e) { return null; }
  }

  function renderFav() {
    const box = $('#fav-content');
    // Free 可看/可管基础收藏；多清单与导出仍限 Pro/Max
    const proWorkflow = canUseFavoritesWorkflow();
    const list = getActiveList();
    if (!list) { box.innerHTML = `<div class="empty" style="padding:60px 20px;text-align:center;color:var(--muted)">${T('还没有收藏。切到「国际 SCI/SSCI」点任意一行右边的 ★ 就能收藏。','No favorites yet. Go to "International" and click the ★ on any row.')}</div>`; return; }

    const lim = favLimitForUser();
    const total = allFavIds().size;
    const freeHint = !proWorkflow
      ? `<p class="fav-free-hint" style="margin:0 0 12px;font-size:13px;color:var(--muted);line-height:1.5">${T(
          `Free 可收藏最多 ${FREE_FAV_LIMIT} 本（当前 ${total}/${FREE_FAV_LIMIT}）。升级 Pro 可建多清单、云同步更多收藏。`,
          `Free: up to ${FREE_FAV_LIMIT} favorites (now ${total}/${FREE_FAV_LIMIT}). Upgrade to Pro for lists and higher limits.`
        )} <button type="button" class="btn-mini" data-fav-upgrade style="margin-left:6px">${T('查看方案','Plans')}</button></p>`
      : '';

    // list 管理栏（全列表切换 + 新建/重命名/删除）
    const bar = favLists.map(l => `
      <button class="fav-list-chip ${l.id === activeListId ? 'active' : ''}" data-list="${escape(l.id)}">
        <span class="lname">${escape(favListDisplayName(l))}</span>
        <span class="lcount">${l.ids.length}</span>
      </button>`).join('');
    const listOps = proWorkflow
      ? `<button class="btn-mini" id="fav-list-new" title="${T('新建清单','New list')}">＋ ${T('新建','New')}</button>
          <button class="btn-mini" id="fav-list-rename" title="${T('重命名当前','Rename current')}">✎ ${T('重命名','Rename')}</button>
          <div class="fav-export-wrap">
            <button class="btn-mini" id="fav-list-export" title="${T('导出到 Zotero / Notion / Obsidian 等','Export for Zotero / Notion / Obsidian')}">⬇ ${T('导出','Export')}</button>
            <div class="fav-export-menu" id="fav-export-menu" hidden>
              <button type="button" data-fav-export="ris">RIS · Zotero / EndNote</button>
              <button type="button" data-fav-export="bib">BibTeX</button>
              <button type="button" data-fav-export="csv">CSV · Notion</button>
              <button type="button" data-fav-export="md">Markdown · Obsidian</button>
              <button type="button" data-fav-export="notion">📋 ${T('复制 Notion 表格','Copy Notion table')}</button>
              <button type="button" data-fav-export="obsidian">↗ ${T('打开 Obsidian 笔记','Open in Obsidian')}</button>
            </div>
          </div>
          <button class="btn-mini" id="fav-list-share" title="${T('生成分享短链','Generate share link')}">🔗 ${T('分享','Share')}</button>
          <button class="btn-mini btn-danger" id="fav-list-del" title="${T('删除当前','Delete current')}" ${favLists.length<=1?'disabled':''}>🗑 ${T('删除','Delete')}</button>`
      : `<button class="btn-mini" id="fav-list-new-locked" title="${T('多清单 · Pro','Lists · Pro')}">＋ ${T('多清单 · Pro','Lists · Pro')}</button>`;
    const toolbar = `
      <div class="fav-toolbar">
        <div class="fav-list-chips">${bar}</div>
        <div class="fav-list-ops">
          ${listOps}
        </div>
      </div>
      ${freeHint}`;

    // 取当前 list 的有序记录（实时库 + favsData 合并，刊名永不丢）
    let rows = [];
    for (const id of list.ids) {
      let rec = journals.find(r => favId(r) === id);
      if (!rec && domestic) {
        const domRecs = [
          ...(domestic.cnkx?.records || []).map(r => ({ ...r, __src: 'cnkx' })),
          ...(domestic.cscd?.records || []).map(r => ({ ...r, __src: 'cscd' })),
          ...(domestic.cstpcd?.records || []).map(r => ({ ...r, __src: 'cstpcd' })),
          ...(domestic.nsfc_mgmt?.records || []).map(r => ({ ...r, __src: 'nsfc_mgmt' })),
          ...(domestic.cnki_major?.records || []).map(r => ({ ...r, __src: 'cnki_major' })),
        ];
        rec = domRecs.find(r => favId(r) === id);
      }
      const saved = favsData[id];
      if (!rec) rec = saved;
      if (!rec) continue;
      const merged = {
        ...(saved || {}),
        ...rec,
        name: journalDisplayName(rec) || journalDisplayName(saved) || (saved && saved.name) || '',
        __src: rec.__src || saved?.__src || 'int',
      };
      // 若合并后仍无刊名，至少用 id 占位，避免空白卡
      if (!journalDisplayName(merged)) merged.name = String(id || '');
      rows.push(merged);
    }
    if (activeQuery) {
      const q = activeQuery.toLowerCase();
      rows = rows.filter(r => scoreRecord(r, activeQuery) > 0 || (
        (r.name||'') + ' ' + (r.cn_name||'') + ' ' + (r.en_name||'') + ' ' +
        (r.issn||'') + ' ' + (r.cn_code||'') + ' ' +
        (r.publisher||'') + ' ' + (r.org||'') + ' ' + (r.sponsor||'')
      ).toLowerCase().includes(q));
    }
    rows = sortByIF(rows, favIfSort);

    if (!rows.length) {
      box.innerHTML = toolbar + `<div class="empty" style="padding:40px 0">${t('empty_fav')}</div>`;
      attachFavBarHandlers();
      return;
    }

    // 卡片网格：不再渲染表头（INDICES/IF/SOURCE 在卡片布局下不可用）
    const tbody = rows.map(r => renderFavRow(r)).join('');
    const ifSortLabel = favIfSort === 'asc' ? 'IF ▲' : favIfSort === 'desc' ? 'IF ▼' : `IF ${T('排序','sort')}`;
    const hint = activeQuery
      ? ''
      : `<div class="fav-drag-hint">
          <span>${T('左侧色条可拖动排序 · 手机长按同样支持','Drag the left bar to reorder · long-press on mobile')}</span>
          <button type="button" class="btn-mini fav-if-sort ${favIfSort ? 'is-on' : ''}" data-if-sort="fav" title="${T('按影响因子排序','Sort by Impact Factor')}">${ifSortLabel}</button>
        </div>`;
    box.innerHTML = toolbar + hint + `
      <div class="table-wrap fav-card-wrap" style="margin-top:10px">
        <table class="journals fav-table">
          <tbody id="fav-tbody">${tbody}</tbody>
        </table>
      </div>
      <div class="results-count" style="margin-top:18px">${t('showing')} ${rows.length} ${t('total_items')}</div>`;

    attachFavBarHandlers();
    // 拖动排序（只在无搜索时启用，搜索时顺序与真实顺序不一致）
    if (!activeQuery && window.Sortable) {
      const tb = document.getElementById('fav-tbody');
      if (tb) {
        Sortable.create(tb, {
          handle: '.drag-handle',
          animation: 150,
          delay: 200,          // 手机端长按触发
          delayOnTouchOnly: true,
          touchStartThreshold: 5,
          ghostClass: 'fav-ghost',
          chosenClass: 'fav-chosen',
          onEnd: () => {
            const ids = [...tb.querySelectorAll('tr.j-row')].map(tr => tr.dataset.fid);
            reorderActiveList(ids);
          },
        });
      }
    }
  }

  function attachFavBarHandlers() {
    const bar = document.querySelector('.fav-list-chips');
    if (bar) {
      bar.querySelectorAll('.fav-list-chip').forEach(btn => {
        btn.addEventListener('click', () => switchList(btn.dataset.list));
      });
    }
    // Free 升级入口
    document.querySelectorAll('[data-fav-upgrade], #fav-list-new-locked').forEach((btn) => {
      btn.addEventListener('click', () => {
        showRegionPaywallModal(btn.id === 'fav-list-new-locked' ? 'workflow' : 'fav_limit');
      });
    });
    const newBtn = document.getElementById('fav-list-new');
    if (newBtn) newBtn.addEventListener('click', () => {
      const name = prompt(T('新清单名称：','New list name:'), T('新清单','New list'));
      if (name && name.trim()) { createList(name.trim()); renderFav(); }
    });
    const renBtn = document.getElementById('fav-list-rename');
    if (renBtn) renBtn.addEventListener('click', () => {
      const cur = getActiveList(); if (!cur) return;
      const name = prompt(T('重命名清单：','Rename list:'), favListDisplayName(cur));
      if (name && name.trim()) { renameList(cur.id, name.trim()); renderFav(); }
    });
    const delBtn = document.getElementById('fav-list-del');
    if (delBtn) delBtn.addEventListener('click', () => {
      const cur = getActiveList(); if (!cur) return;
      if (favLists.length <= 1) { alert(T('至少保留一个清单','Keep at least one list')); return; }
      if (confirm(T(`删除清单「${favListDisplayName(cur)}」？\n清单中的期刊若未在其他清单中也会被移除。`,`Delete list "${favListDisplayName(cur)}"?\nJournals not in other lists will also be removed.`))) {
        deleteList(cur.id); renderFav();
        if (activeTab === 'int') renderInt();
      }
    });
    const shareBtn = document.getElementById('fav-list-share');
    if (shareBtn) shareBtn.addEventListener('click', () => openShareDialog());
    const exportBtn = document.getElementById('fav-list-export');
    const exportMenu = document.getElementById('fav-export-menu');
    if (exportBtn && exportMenu) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!canUseExportIntegrations()) {
          showRegionPaywallModal('export');
          return;
        }
        const open = exportMenu.hasAttribute('hidden');
        if (open) exportMenu.removeAttribute('hidden');
        else exportMenu.setAttribute('hidden', '');
      });
      exportMenu.querySelectorAll('[data-fav-export]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!canUseExportIntegrations()) {
            showRegionPaywallModal('export');
            return;
          }
          exportMenu.setAttribute('hidden', '');
          await runFavExport(btn.getAttribute('data-fav-export'));
        });
      });
      if (!window.__favExportDocClose) {
        window.__favExportDocClose = true;
        document.addEventListener('click', () => {
          const m = document.getElementById('fav-export-menu');
          if (m) m.setAttribute('hidden', '');
        });
      }
    }
  }

  // ───────── favorites export → Zotero / Notion / Obsidian ─────────
  function collectActiveFavRows() {
    const list = getActiveList();
    if (!list) return [];
    const rows = [];
    for (const id of list.ids) {
      let rec = journals.find(r => favId(r) === id);
      if (!rec && domestic) {
        const src = favsData[id]?.__src || 'cnki_major';
        const domRecs = [
          ...(domestic.cnkx?.records || []).map(r => ({ ...r, __src: 'cnkx' })),
          ...(domestic.cscd?.records || []).map(r => ({ ...r, __src: 'cscd' })),
          ...(domestic.cstpcd?.records || []).map(r => ({ ...r, __src: 'cstpcd' })),
          ...(domestic.nsfc_mgmt?.records || []).map(r => ({ ...r, __src: 'nsfc_mgmt' })),
          ...(domestic.cnki_major?.records || []).map(r => ({ ...r, __src: 'cnki_major' })),
        ];
        rec = domRecs.find(r => favId(r) === id);
      }
      if (!rec) rec = favsData[id];
      if (rec) rows.push({ ...rec, __src: rec.__src || 'int' });
    }
    return rows;
  }

  function favJournalTitle(r) {
    return String(r.name || r.cn_name || r.en_name || r.journal_title || 'Untitled').trim();
  }

  function favJournalKey(r) {
    const base = (r.issn || r.eissn || favJournalTitle(r)).replace(/[^a-zA-Z0-9]+/g, '').slice(0, 24) || 'journal';
    return base;
  }

  function favCasLabel(r) {
    const zh = String(lang || '').startsWith('zh');
    if (r.cz != null && r.cz !== '' && r.cz !== 0) return String(r.cz) + (zh ? '区' : '');
    if (r.xr && r.xr.z) return String(r.xr.z) + (zh ? '区' : '');
    return '';
  }

  function favIfLabel(r) {
    const v = r.if != null ? r.if : (r.jif != null ? r.jif : '');
    return v === '' || v == null ? '' : String(v);
  }

  function favIndexLabels(r) {
    const xs = Array.isArray(r.x) ? r.x : (Array.isArray(r.indexes) ? r.indexes : []);
    return xs.filter(Boolean).join('; ');
  }

  function escCsv(v) {
    const s = String(v == null ? '' : v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function escBibField(v) {
    return String(v || '')
      .replace(/\\/g, '\\\\')
      .replace(/[{}]/g, '\\$&');
  }

  function journalToRis(r) {
    const title = favJournalTitle(r);
    const lines = ['TY  - JFULL'];
    lines.push(`TI  - ${title}`);
    lines.push(`T2  - ${title}`);
    if (r.issn) lines.push(`SN  - ${r.issn}`);
    if (r.eissn && r.eissn !== r.issn) lines.push(`SN  - ${r.eissn}`);
    if (r.p || r.publisher) lines.push(`PB  - ${r.p || r.publisher}`);
    if (r.c || r.country) lines.push(`CY  - ${r.c || r.country}`);
    const notes = [
      favIfLabel(r) ? `IF ${favIfLabel(r)}` : '',
      r.jq ? `JCR ${r.jq}` : '',
      favCasLabel(r) ? `CAS ${favCasLabel(r)}` : '',
      favIndexLabels(r) ? `Index ${favIndexLabels(r)}` : '',
      'AILatest Journal',
    ].filter(Boolean).join(' | ');
    if (notes) lines.push(`N1  - ${notes}`);
    if (r.s) lines.push(`UR  - https://journal.ailatest.org/journal/${encodeURIComponent(r.s)}/`);
    else if (r.issn) lines.push(`UR  - https://journal.ailatest.org/?q=${encodeURIComponent(r.issn)}`);
    lines.push('ER  - ');
    return lines.join('\r\n') + '\r\n';
  }

  function journalToBibtex(r) {
    const title = favJournalTitle(r);
    const fields = [
      ['title', title],
      ['issn', r.issn || ''],
      ['publisher', r.p || r.publisher || ''],
      ['note', [
        favIfLabel(r) ? `IF=${favIfLabel(r)}` : '',
        r.jq ? `JCR=${r.jq}` : '',
        favCasLabel(r) ? `CAS=${favCasLabel(r)}` : '',
      ].filter(Boolean).join('; ')],
      ['url', r.s ? `https://journal.ailatest.org/journal/${r.s}/` : ''],
    ].filter(([, v]) => v);
    return `@periodical{${favJournalKey(r)},\n${fields.map(([k, v]) => `  ${k} = {${escBibField(v)}}`).join(',\n')}\n}\n`;
  }

  function journalsToCsv(rows) {
    const headers = ['Title', 'ISSN', 'eISSN', 'IF', 'JCR', 'CAS', 'Indexes', 'Publisher', 'Country', 'URL'];
    const lines = [headers.join(',')];
    rows.forEach((r) => {
      const url = r.s
        ? `https://journal.ailatest.org/journal/${r.s}/`
        : (r.issn ? `https://journal.ailatest.org/?q=${encodeURIComponent(r.issn)}` : '');
      lines.push([
        favJournalTitle(r),
        r.issn || '',
        r.eissn || '',
        favIfLabel(r),
        r.jq || '',
        favCasLabel(r),
        favIndexLabels(r),
        r.p || r.publisher || '',
        r.c || r.country || '',
        url,
      ].map(escCsv).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  function journalsToMarkdown(rows, listName) {
    const title = listName || T('收藏清单', 'Favorites');
    const header = [
      '---',
      `title: "${String(title).replace(/"/g, '\\"')}"`,
      `exported_at: "${new Date().toISOString()}"`,
      'source: "AILatest Journal"',
      '---',
      '',
      `# ${title}`,
      '',
      `| ${T('刊名','Title')} | ISSN | IF | JCR | ${T('中科院','CAS')} | ${T('索引','Indexes')} |`,
      '| --- | --- | --- | --- | --- | --- |',
    ];
    const body = rows.map((r) => {
      const name = favJournalTitle(r).replace(/\|/g, '\\|');
      return `| ${name} | ${r.issn || r.eissn || '—'} | ${favIfLabel(r) || '—'} | ${r.jq || '—'} | ${favCasLabel(r) || '—'} | ${(favIndexLabels(r) || '—').replace(/\|/g, '/')} |`;
    });
    return header.concat(body).join('\n') + '\n';
  }

  function journalsToNotionTsv(rows) {
    // Notion 粘贴：制表符分隔会变成表格
    const lines = [
      [T('刊名','Title'), 'ISSN', 'IF', 'JCR', T('中科院','CAS'), T('索引','Indexes'), T('出版商','Publisher')].join('\t'),
    ];
    rows.forEach((r) => {
      lines.push([
        favJournalTitle(r),
        r.issn || r.eissn || '',
        favIfLabel(r),
        r.jq || '',
        favCasLabel(r),
        favIndexLabels(r),
        r.p || r.publisher || '',
      ].join('\t'));
    });
    return lines.join('\n');
  }

  function downloadTextFile(filename, text, mime) {
    const blob = new Blob(['\uFEFF' + text], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  async function runFavExport(kind) {
    if (!canUseExportIntegrations()) {
      showRegionPaywallModal('export');
      return;
    }
    const list = getActiveList();
    const rows = collectActiveFavRows();
    if (!list || !rows.length) {
      alert(T('当前清单为空，先收藏几本期刊再导出。', 'This list is empty. Favorite some journals first.'));
      return;
    }
    const base = (favListDisplayName(list) || 'favorites').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 48);
    if (kind === 'ris') {
      downloadTextFile(`${base}.ris`, rows.map(journalToRis).join('\r\n'), 'application/x-research-info-systems');
      return;
    }
    if (kind === 'bib') {
      downloadTextFile(`${base}.bib`, rows.map(journalToBibtex).join('\n'), 'application/x-bibtex');
      return;
    }
    if (kind === 'csv') {
      downloadTextFile(`${base}.csv`, journalsToCsv(rows), 'text/csv;charset=utf-8');
      return;
    }
    if (kind === 'md') {
      downloadTextFile(`${base}.md`, journalsToMarkdown(rows, favListDisplayName(list)), 'text/markdown;charset=utf-8');
      return;
    }
    if (kind === 'notion') {
      const ok = await copyText(journalsToNotionTsv(rows));
      if (ok) alert(T('已复制表格。打开 Notion 新建页面后粘贴即可成表。', 'Table copied. Paste into a Notion page to create a table.'));
      else alert(T('复制失败，请改用 CSV 导出。', 'Copy failed. Try CSV export instead.'));
      return;
    }
    if (kind === 'obsidian') {
      const md = journalsToMarkdown(rows, favListDisplayName(list));
      const file = `AILatest/${base}`.replace(/\s+/g, ' ');
      // 内置 URI：写入新笔记；过长则回退下载
      if (md.length < 12000) {
        const uri = `obsidian://new?file=${encodeURIComponent(file)}&content=${encodeURIComponent(md)}`;
        window.location.href = uri;
        setTimeout(() => {
          // 若未安装 Obsidian，用户仍可手动打开下载的 md
        }, 400);
      }
      downloadTextFile(`${base}.md`, md, 'text/markdown;charset=utf-8');
      return;
    }
  }

  // ───────── share lists ─────────
  async function openShareDialog() {
    if (!canUseFavoritesWorkflow()) {
      showRegionPaywallModal('workflow');
      return;
    }
    if (!user || !user.token) {
      alert(T('请先登录后分享清单','Please sign in to share a list'));
      return;
    }
    const cur = getActiveList();
    if (!cur || !cur.ids.length) {
      alert(T('当前清单为空，加几本期刊再分享～','Add some journals first, then share'));
      return;
    }
    // 把 ids 反查为 ISSN（导入端按 ISSN 查找；用 cn_code 兜底中文期刊）
    const items = [];
    for (const id of cur.ids) {
      const rec = favsData[id] || journals.find(r => favId(r) === id);
      if (!rec) continue;
      items.push({
        issn: rec.issn || rec.eissn || '',
        cn_code: rec.cn_code || '',
        name: rec.name || rec.cn_name || '',
      });
    }
    showShareModal({ loading: true });
    try {
      const r = await fetch(`${API_BASE}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ name: favListDisplayName(cur), items, ttl_days: 90 }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const shareUrl = `${location.origin}/s/${d.id}`;
      // 用本地 favsData 富化每行（索引/JCR），不必再请求 journals.json
      const richItems = cur.ids.map(id => {
        const rec = favsData[id] || journals.find(r => favId(r) === id) || {};
        return {
          name: rec.name || rec.cn_name || '—',
          cn_name: rec.cn_name && rec.cn_name !== rec.name ? rec.cn_name : '',
          badge_html: [renderIndexBadges(rec), renderRankBadges(rec), renderDomCrossBadges(rec)].filter(Boolean).join(''),
        };
      });
      showShareModal({ url: shareUrl, expiresAt: d.expires_at, listName: favListDisplayName(cur), count: items.length, items: richItems });
    } catch (e) {
      showShareModal({ error: String(e.message || e) });
    }
  }

  function showShareModal(opts) {
    let modal = document.getElementById('share-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'share-modal';
      modal.className = 'share-modal';
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) { modal.classList.remove('open'); restoreTopbarSearch(); }
      });
    }
    let body;
    if (opts.loading) {
      body = `<div class="share-modal-body" style="padding:32px 0;text-align:center;color:#666">${T('生成中…','Generating…')}</div>`;
    } else if (opts.error) {
      body = `<div class="share-modal-body"><div style="color:#a23b3b;padding:16px 0">${T('生成失败：','Failed: ')}${escape(opts.error)}</div><div class="share-actions"><button id="share-close-btn" class="share-btn">${T('关闭','Close')}</button></div></div>`;
    } else {
      const exp = opts.expiresAt ? new Date(opts.expiresAt * 1000).toLocaleDateString() : '';
      const inviteText = T(
        `我整理了一份期刊清单「${opts.listName}」，共 ${opts.count} 本，点开一键查分区/影响因子/收稿周期：\n${opts.url}`,
        `I curated a journal list "${opts.listName}" (${opts.count} journals) — quartile, IF, review cycles, all in one click:\n${opts.url}`
      );
      // 期刊预览列表（最多 30 本）
      const items = opts.items || [];
      const previewMax = 30;
      const shown = items.slice(0, previewMax);
      const renderRow = (it) => {
        const badgeHtml = it.badge_html || '';
        const cn = it.cn_name ? `<span class="share-row-cn">${escape(it.cn_name)}</span>` : '';
        return `<li class="share-row"><span class="share-row-name">${escape(it.name || '—')}</span>${cn}<span class="share-row-tags badges">${badgeHtml}</span></li>`;
      };
      const listHtml = shown.length
        ? `<ul class="share-modal-list">${shown.map(renderRow).join('')}</ul>${items.length > previewMax ? `<div class="share-modal-more">${T(`还有 ${items.length - previewMax} 本，打开链接查看完整清单`, `+${items.length - previewMax} more — open the link to see all`)}</div>` : ''}`
        : '';
      body = `
        <div class="share-modal-body">
          <div class="share-modal-head">
            <div class="share-modal-eyebrow">AILATEST · ${T('期刊清单分享','Journal list share')}</div>
            <h3 class="share-modal-title">「${escape(opts.listName)}」</h3>
            <div class="share-modal-meta">${T('共','')} <strong>${opts.count}</strong> ${T('本期刊','journals')}${exp ? ' · ' + T('有效期至 ', 'expires ') + exp : ''}</div>
          </div>
          ${listHtml}
          <div class="share-modal-url">
            <input id="share-url-input" type="text" readonly value="${escape(opts.url)}">
          </div>
          <div class="share-actions">
            <button id="share-copy-btn" class="share-btn primary">🔗 ${T('复制链接','Copy link')}</button>
            <button id="share-copy-invite-btn" class="share-btn">📝 ${T('复制邀请文案','Copy invite')}</button>
            <button id="share-open-btn" class="share-btn ghost">↗ ${T('打开预览','Open preview')}</button>
          </div>
          <textarea id="share-invite-text" style="position:absolute;left:-9999px;top:-9999px" readonly>${escape(inviteText)}</textarea>
          <div class="share-modal-foot"><button id="share-close-btn" class="share-foot-link">${T('关闭','Close')}</button></div>
        </div>`;
    }
    modal.innerHTML = `<div class="share-card share-modal-card">${body}</div>`;
    modal.classList.add('open');
    const closeBtn = document.getElementById('share-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => { modal.classList.remove('open'); restoreTopbarSearch(); });
    const copyBtn = document.getElementById('share-copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      const inp = document.getElementById('share-url-input');
      const ok = await copyToClipboard(inp.value);
      flashBtn(copyBtn, ok ? T('已复制 ✓','Copied ✓') : T('请手动复制','Copy manually'));
    });
    const inviteBtn = document.getElementById('share-copy-invite-btn');
    if (inviteBtn) inviteBtn.addEventListener('click', async () => {
      const ta = document.getElementById('share-invite-text');
      const ok = await copyToClipboard(ta.value);
      flashBtn(inviteBtn, ok ? T('已复制 ✓','Copied ✓') : T('请手动复制','Copy manually'));
    });
    const openBtn = document.getElementById('share-open-btn');
    if (openBtn && opts.url) openBtn.addEventListener('click', () => window.open(opts.url, '_blank'));
  }

  // ───────── 单本期刊分享弹窗（含卡片预览 + 下载图片 + 复制链接） ─────────
  function showJournalShareModal(r) {
    const id = favId(r);
    // 分享直链到期刊详情页（/journal/<slug>/），打开即是信息页，不再先进首页
    const url = `${location.origin}${journalPublicPath(r)}`;
    const ir = r.__src === 'int' ? r : (lookupInt(r) || r);
    const title = titleCase((r.name || r.cn_name || '').replace(/\*$/,''));
    const cn = r.cn_name && r.cn_name !== title ? r.cn_name : '';
    const issn = r.issn || r.cn_code || '';
    const eissn = r.eissn || '';

    // 收录索引
    const idxList = (ir.indices || []).slice();
    const idxRank = { SCIE:1, SSCI:2, AHCI:3, ESCI:4, EI:5 };
    idxList.sort((a,b) => (idxRank[a]||9) - (idxRank[b]||9));
    const idxHtml = renderIndexBadges(ir);

    const zonesHtml = [renderRankBadges(ir), renderDomCrossBadges(ir)].filter(Boolean).join('');

    // 关键指标 + 元信息
    const stats = [];
    if (ir.if_2024 != null) stats.push([T('影响因子','Impact Factor'), ir.if_2024]);
    if (ir.if_rank) stats.push([T('IF 排名','IF Rank'), ir.if_rank]);
    const shareIfYear = Number(ir.if_latest_year || ir.jcr_year || 2025);
    const shareReleaseYear = Number(ir.jcr_release_year || (shareIfYear + 1));
    const ifNote = ir.if_2024 != null
      ? T(`JCR ${shareReleaseYear}发布 · ${shareIfYear}指标`, `JCR ${shareReleaseYear} · ${shareIfYear} IF`)
      : '';
    const statsHtml = stats.length ? `<div class="jcard-stats">${stats.map(([k,v,sub]) => `<div class="jcard-stat"><div class="jcard-stat-v">${v}</div><div class="jcard-stat-k">${k}</div>${sub?`<div class="jcard-stat-sub">${sub}</div>`:''}</div>`).join('')}</div>${ifNote ? `<div class="jcard-stats-sub">${ifNote}</div>` : ''}` : '';

    const meta = [];
    if (ir.cas_major_cn) meta.push([T('中科院大类','CAS Major'), ir.cas_major_cn]);
    if (ir.esi_category) meta.push([T('ESI 高被引','ESI Category'), ir.esi_category]);
    if (ir.abdc && ir.abdc.rating) meta.push([T('ABDC 等级','ABDC Rating'), ir.abdc.rating + (ir.abdc.field ? ' · ' + ir.abdc.field : '')]);
    if (ir.ft50) meta.push(['FT50', ir.ft50.order ? `#${ir.ft50.order}` : 'Listed']);
    if (ir.utd24) meta.push(['UTD24', ir.utd24.order ? `#${ir.utd24.order}` : 'Listed']);
    if (r.publisher) meta.push([T('出版商','Publisher'), r.publisher]);
    if (r.country) meta.push([T('国家/地区','Country'), r.country]);
    if (r.frequency) meta.push([T('刊期','Frequency'), r.frequency]);
    if (ir.cas_xr && ir.cas_xr.major_cn) meta.push([T('新锐版大类','Emerging Major'), ir.cas_xr.major_cn]);

    // 审稿周期 — 从嵌入的 DOAJ review_weeks 读取
    let cycTxt = '';
    const weeks = parseFloat(r.doaj?.review_weeks || ir.doaj?.review_weeks);
    if (weeks > 0) {
      cycTxt = `${(weeks / 4.33).toFixed(1)}${T(' 个月 (投稿→出版，DOAJ)',' months (submission→pub.)')}`;
    }
    if (cycTxt) {
      meta.push([T('审稿周期','Review Cycle'), cycTxt]);
    }

    // OA / 订阅模式 + APC（费用细节 Pro+）
    const oaRec = ir.oa || lookupOA(ir.issn || ir.eissn ? ir : r);
    if (oaRec) {
      const doaj = oaRec.dj ?? oaRec.in_doaj;
      if (canSeePublishFeeInfo()) {
        const labelMapShort = {
          diamond: T('Diamond · 读投全免费','Diamond · free both ways'),
          gold_apc: T('Gold OA · 投稿付 APC','Gold OA · author pays APC'),
          hybrid: T('Hybrid · 可选 OA','Hybrid · optional OA'),
          subscription_paid_read: T('订阅制 · 读付费','Subscription · paid read'),
          unknown: T('未知','Unknown'),
        };
        const lab = oaRec.l || oaRec.label || 'unknown';
        let oaText = labelMapShort[lab] || labelMapShort.unknown;
        const doajFee = ir.doaj?.fee || ir.doaj?.apc_amount || '';
        if (ir.doaj?.apc === 'Yes' && doajFee) oaText += ` · APC ${doajFee}`;
        else if (ir.doaj?.apc === 'Yes') oaText += T(' · 有 APC',' · has APC');
        if (doaj) oaText += T(' · 收录 DOAJ',' · in DOAJ');
        meta.push([T('开放获取','Open Access'), oaText]);
      } else {
        let oaText = (oaRec.oa ?? oaRec.is_oa) ? 'Open Access' : T('开放获取信息','Open access');
        if (doaj) oaText += T(' · 收录 DOAJ',' · in DOAJ');
        meta.push([T('开放获取','Open Access'), oaText]);
      }
    }
    const metaHtml = meta.length ? `<div class="jcard-meta">${meta.map(([k,v]) => `<div class="jcard-meta-row"><span class="jcard-meta-k">${k}</span><span class="jcard-meta-v">${escape(v)}</span></div>`).join('')}</div>` : '';

    let modal = document.getElementById('share-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'share-modal'; modal.className = 'share-modal';
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) { modal.classList.remove('open'); restoreTopbarSearch(); }
      });
    }

    modal.innerHTML = `
      <div class="share-card share-modal-card jcard-modal">
        <div class="share-modal-body">
          <div class="jcard-export" id="jcard-canvas">
            <div class="jcard-header">
              <div class="jcard-eyebrow">${T('期刊名片','Journal Card')}</div>
              <div class="jcard-brand"><em>journal</em>.ailatest</div>
            </div>
            <div class="jcard">
              <div class="jcard-title">${escape(title)}</div>
              ${cn ? `<div class="jcard-sub">${escape(cn)}</div>` : ''}
              <div class="jcard-issn">${issn ? 'ISSN ' + escape(issn) : ''}${eissn ? ' · eISSN ' + escape(eissn) : ''}</div>
              ${idxHtml ? `<div class="jcard-row">${idxHtml}</div>` : ''}
              ${zonesHtml ? `<div class="jcard-row">${zonesHtml}</div>` : ''}
              ${statsHtml}
              ${metaHtml}
              <div class="jcard-foot">
                <div class="jcard-foot-text">${T('扫码或访问 ','Scan or visit ')}<b>${escape(location.host)}</b>${T(' 查看完整信息','for full details')}</div>
              </div>
            </div>
          </div>
          <div class="share-modal-url">
            <input id="jcard-url-input" type="text" readonly value="${escape(url)}">
          </div>
          <div class="share-actions">
            <button id="jcard-copy-btn" class="share-btn primary">🔗 ${T('复制链接','Copy link')}</button>
            <button id="jcard-img-btn" class="share-btn">🖼 ${T('保存为图片','Save as image')}</button>
          </div>
          <div class="share-modal-foot"><button id="share-close-btn" class="share-foot-link">${T('关闭','Close')}</button></div>
        </div>
      </div>`;
    modal.classList.add('open');

    document.getElementById('share-close-btn').addEventListener('click', () => {
      modal.classList.remove('open');
      restoreTopbarSearch();
    });

    document.getElementById('jcard-copy-btn').addEventListener('click', async () => {
      const ok = await copyToClipboard(url);
      flashBtn(document.getElementById('jcard-copy-btn'), ok ? T('已复制 ✓','Copied ✓') : T('请手动复制','Copy manually'));
    });

    document.getElementById('jcard-img-btn').addEventListener('click', async () => {
      const btn = document.getElementById('jcard-img-btn');
      const old = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${T('生成中…','Rendering…')}`;
      try {
        if (!window.html2canvas) {
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            s.onload = res; s.onerror = () => rej(new Error('html2canvas load failed'));
            document.head.appendChild(s);
          });
        }
        const node = document.getElementById('jcard-canvas');
        const canvas = await window.html2canvas(node, { backgroundColor: '#fffdf6', scale: 3, useCORS: true, logging: false });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `journal-${id}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        btn.innerHTML = old; btn.disabled = false;
        flashBtn(btn, T('已保存 ✓','Saved ✓'));
      } catch (e) {
        btn.innerHTML = old; btn.disabled = false;
        alert(T('生成图片失败：','Image render failed: ') + (e.message || e));
      }
    });
  }

  // ───────── share landing (/s/<id>) ─────────
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (_) { return false; }
  }
  function flashBtn(id, label) {
    const btn = (typeof id === 'string') ? document.getElementById(id) : id;
    if (!btn) return;
    const old = btn.innerHTML;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${label}`;
    btn.classList.add('btn-ok');
    setTimeout(() => { btn.innerHTML = old; btn.classList.remove('btn-ok'); }, 1400);
  }

  async function maybeRenderShareLanding() {
    const m = location.pathname.match(/^\/s\/([A-Za-z0-9_-]{4,32})\/?$/);
    if (!m) return false;
    const shareId = m[1];
    // 进入 share 模式：单列布局、隐藏侧边栏，避免半空侧栏的渲染感
    document.body.classList.add('share-mode');
    const main = document.querySelector('main') || document.body;
    const brandHead = `
      <div class="share-brand">
        <a href="/" class="share-brand-link">
          <span class="share-brand-title">AILatest <em>Journal</em></span>
          <span class="share-brand-sub">期刊检索 · 收藏分享</span>
        </a>
      </div>`;
    main.innerHTML = `${brandHead}<div class="share-landing"><div class="empty">${T('加载分享中…','Loading shared list…')}</div></div>`;
    try {
      const r = await fetch(`${API_BASE}/share/${shareId}`);
      if (!r.ok) {
        main.innerHTML = `${brandHead}<div class="share-landing"><h2>${T('分享不存在或已过期','Share not found or expired')}</h2><p><a href="/">${T('返回首页','Back home')}</a></p></div>`;
        return true;
      }
      const d = await r.json();
      // 加载期刊主库以反查索引/JCR
      let lookup = {};
      try {
        const arr = await fetchJSON('/data/journals.json.gz').catch(() => []);
        for (const j of arr) {
          const k1 = (j.issn||'').replace(/-/g,'').toUpperCase();
          const k2 = (j.eissn||'').replace(/-/g,'').toUpperCase();
          if (k1) lookup[k1] = j;
          if (k2 && !lookup[k2]) lookup[k2] = j;
        }
      } catch(_) {}
      const norm = s => (s||'').replace(/-/g,'').toUpperCase();
      const idxColor = { SCIE:'scie', SSCI:'ssci', AHCI:'ahci', ESCI:'esci', EI:'ei' };
      const items = (d.items || []).map((it, i) => {
        const title = escape(it.name || it.cn_name || it.issn || it.cn_code || '—');
        const sub = it.cn_name && it.cn_name !== (it.name || '') ? `<span class="share-row-cn">${escape(it.cn_name)}</span>` : '';
        // 反查丰富数据
        const j = lookup[norm(it.issn)] || lookup[norm(it.eissn)] || {};
        const indexBadges = renderIndexBadges(j);
        const rankBadges = [renderRankBadges(j), renderDomCrossBadges(j, 'int')].filter(Boolean).join('');
        const meta = (indexBadges || rankBadges)
          ? `<div class="share-row-badges">
              ${indexBadges ? `<div class="share-row-badge-line"><span class="share-row-badge-label">${T('收录','Indexed')}</span><span class="share-row-tags badges">${indexBadges}</span></div>` : ''}
              ${rankBadges ? `<div class="share-row-badge-line"><span class="share-row-badge-label">${T('分区','Rank')}</span><span class="share-row-tags badges">${rankBadges}</span></div>` : ''}
            </div>`
          : '';
        return `<div class="share-list-row"><span class="share-row-idx">${String(i+1).padStart(2,'0')}</span><div class="share-row-main"><div class="share-row-name">${title}${sub}</div>${meta}</div></div>`;
      }).join('') || `<div class="empty">${T('（空清单）','(empty list)')}</div>`;
      const exp = d.expires_at ? new Date(d.expires_at * 1000).toLocaleDateString() : '';
      const cnt = (d.items||[]).length;
      const inviteDefault = T(
        `我整理了一份期刊清单「${d.name||'我的期刊'}」，共 ${cnt} 本，推荐给你看看 👇`,
        `I curated a journal list "${d.name||'My journals'}" with ${cnt} entries — take a look 👇`
      );
      main.innerHTML = `
        ${brandHead}
        <div class="share-landing" id="share-card">
          <div class="share-ribbon">📚 ${T('期刊清单分享','Journal list')}</div>
          <h2 class="share-title">${escape(d.name || T('期刊清单','Journal list'))}</h2>
          <div class="share-meta">
            <span class="share-meta-item"><strong>${cnt}</strong> ${T('本期刊','journals')}</span>
            ${exp ? `<span class="share-meta-item">${T('有效期至','expires')} ${exp}</span>` : ''}
            <span class="share-meta-item">${d.view_count||0} ${T('次查看','views')}</span>
          </div>
          <div class="share-list">${items}</div>
          <div class="share-foot">
            <span class="share-foot-brand">AILatest <em>Journal</em></span>
            <span class="share-foot-url">journal.ailatest.org</span>
          </div>
        </div>

        <div class="share-invite">
          <label class="share-invite-label">${T('邀请文案（可编辑后复制）','Invite message (edit & copy)')}</label>
          <textarea id="share-invite-text" rows="3">${escape(inviteDefault)}\n\n${location.href}</textarea>
        </div>

        <div class="share-actions">
          <button id="share-copy-link" class="btn-primary">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
            ${T('复制链接','Copy link')}
          </button>
          <button id="share-copy-text" class="btn-soft">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${T('复制邀请','Copy invite')}
          </button>
          <button id="share-download-img" class="btn-soft">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ${T('保存为图片','Save as image')}
          </button>
          <button id="share-import-btn" class="btn-soft">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            ${T('导入到收藏','Import')}
          </button>
        </div>
        <div class="share-foot-link"><a href="/" class="share-back">${T('← 回到主站浏览','← back to main site')}</a></div>`;
      // 复制链接
      document.getElementById('share-copy-link').addEventListener('click', async () => {
        await copyToClipboard(location.href);
        flashBtn('share-copy-link', T('已复制','Copied'));
      });
      // 复制邀请文案
      document.getElementById('share-copy-text').addEventListener('click', async () => {
        const t = document.getElementById('share-invite-text').value;
        await copyToClipboard(t);
        flashBtn('share-copy-text', T('已复制','Copied'));
      });
      // 保存为图片
      document.getElementById('share-download-img').addEventListener('click', async () => {
        const btn = document.getElementById('share-download-img');
        const old = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> ${T('生成中…','Rendering…')}`;
        try {
          if (!window.html2canvas) {
            await new Promise((res, rej) => {
              const s = document.createElement('script');
              s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
              s.onload = res; s.onerror = () => rej(new Error('html2canvas load failed'));
              document.head.appendChild(s);
            });
          }
          const card = document.getElementById('share-card');
          const canvas = await window.html2canvas(card, {
            backgroundColor: '#fffdf6', scale: 2, useCORS: true, logging: false,
          });
          const url = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = url;
          a.download = `journal-list-${shareId}.png`;
          document.body.appendChild(a); a.click(); a.remove();
          btn.innerHTML = old; btn.disabled = false;
          flashBtn('share-download-img', T('已保存','Saved'));
        } catch (e) {
          btn.innerHTML = old; btn.disabled = false;
          alert(T('生成图片失败：','Image render failed: ') + (e.message || e));
        }
      });
      // 导入
      document.getElementById('share-import-btn').addEventListener('click', async () => {
        if (!user || !user.token) {
          alert(T('请先登录后导入清单','Sign in first, then import'));
          location.href = '/?login=1&redirect=' + encodeURIComponent(location.pathname);
          return;
        }
        const btn = document.getElementById('share-import-btn');
        const old = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${T('导入中…','Importing…')}`;
        try {
          const rr = await fetch(`${API_BASE}/share/${shareId}/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${user.token}` },
          });
          if (!rr.ok) throw new Error(`HTTP ${rr.status}`);
          const dd = await rr.json();
          alert(T(`已导入 ${dd.imported || 0} 本期刊到清单「${dd.list_name || ''}」`, `Imported ${dd.imported || 0} journals into "${dd.list_name || ''}"`));
          location.href = '/#fav';
        } catch (e) {
          btn.disabled = false; btn.innerHTML = old;
          alert(T('导入失败：','Import failed: ') + (e.message || e));
        }
      });
      return true;
    } catch (e) {
      main.innerHTML = `<div class="share-landing"><h2>${T('加载失败','Load failed')}</h2><p>${escape(String(e.message||e))}</p></div>`;
      return true;
    }
  }

  function renderFavRow(r) {
    const fid = favId(r);
    // 合并 favsData 兜底，防止点击后重绘丢刊名
    const saved = (favsData && favsData[fid]) || {};
    r = {
      ...saved,
      ...r,
      name: journalDisplayName(r) || journalDisplayName(saved) || r.name || saved.name || '',
      __src: r.__src || saved.__src || 'int',
    };
    rowRecordsByFid[fid] = r;
    const rawName = journalDisplayName(r) || String(fid || '');
    const displayTitle = rawName.startsWith('t:') ? rawName.slice(2) : rawName.replace(/\*$/, '');
    const pretty = /[\u4e00-\u9fff]/.test(displayTitle) ? displayTitle : titleCase(displayTitle);
    const nameHtml = `<div class="jname ${r.flagship ? 'jname-flagship' : ''}">${escape(pretty || T('（未命名期刊）','(Untitled journal)'))}${r.cn_name && r.cn_name !== rawName ? `<span class="jname-cn">${escape(r.cn_name)}</span>` : ''}${r.en_name && r.en_name !== rawName ? `<span class="jname-cn">${escape(titleCase(r.en_name))}</span>` : ''}${aliasHintHtml(r)}</div>`;
    const indexBadges = r.__src === 'int' ? renderIndexBadges(r) : '';
    const rankBadges = r.__src === 'int' ? renderRankBadges(r) : '';
    // 科协：显示「科协·学科 T2」，禁止裸 T2；从交叉索引排除 cnkx 后由 castBadgeHtml 统一输出
    const castBadge = castBadgeHtml(r);
    const nonCastTier = r.tier && !/^T[123]$/i.test(String(r.tier))
      ? `<span class="tier-pill t3">${escape(tn(r.tier, 'tier'))}</span>`
      : '';
    const crossBadges = renderDomCrossBadges(r, r.__src === 'cnkx' ? 'cnkx' : r.__src);
    // 若 cross 已含科协（国际刊交叉命中），castBadgeHtml 与 cross 可能重复 — castBadge 优先、cross 再滤一次
    let crossClean = crossBadges;
    if (castBadge && crossClean) {
      crossClean = crossClean.replace(/<span class="domsrc-pill ds-cnkx"[^>]*>[\s\S]*?<\/span>/g, '').replace(/(<span class="domsrc-dot"[^>]*>·<\/span>\s*)+/g, '');
    }
    const otherBadges = [castBadge, nonCastTier, crossClean].filter(Boolean).join('');
    const badgeCell = renderBadgeCell(indexBadges, [rankBadges, otherBadges].filter(Boolean).join(''));
    const SRC_LABEL = {
      int: T('国际','Int’l'), cssci: 'CSSCI', cssci_core: 'CSSCI', cssci_ext: T('CSSCI 扩展','CSSCI Ext'),
      pku: T('北大核心','PKU Core'), pku_core: T('北大核心','PKU Core'), cscd: 'CSCD', cstpcd: T('中国科技核心','CSTPCD'), cnkx: T('科协','CAST'), ccft: 'CCF-T',
      zju: T('浙大','ZJU'), school_a: T('高校目录','In-house'), nsfc_mgmt: T('国自然','NSFC'), in: 'UGC-CARE', my: 'MyCite / ERA',
      kr: 'KCI', pbn: 'PBN', isc: 'ISC', scielo: 'SciELO',
    };
    const ifVal = (r.if_2024 != null) ? (+r.if_2024).toFixed(1) : '';
    const cr = r.crossref;
    const doaj = r.doaj;
    let cycleDays = null;
    if (cr && cr.median_days) {
      cycleDays = +cr.median_days;
    } else if (doaj && typeof doaj === 'object' && doaj.review_weeks) {
      cycleDays = +doaj.review_weeks * 7;
    }
    const cycleLabel = cycleDays ? `${Math.round(cycleDays / 30.4)}${T('个月','mo')}` : '';
    const freeHtml = freeBadgeCell(r, { compact: true });
    const publisher = r.publisher || r.org || r.sponsor || '';
    const metaHtml = [
      jMetaPlain(`<span class="src-tag src-${escape(r.__src)}">${SRC_LABEL[r.__src] || r.__src}</span>`, 'j-meta-src'),
      cycleLabel ? jMetaText(T('审稿','Review'), escape(cycleLabel), 'j-meta-cycle') : '',
      publisher ? jMetaChip(publisher, 'j-meta-pub') : '',
    ].filter(Boolean).join('');
    const bodyHtml = `<div class="j-card-badges">${badgeCell}</div>`;
    return journalCardRow({
      fid, src: r.__src,
      favHtml: starBtn(r, r.__src),
      dragHtml: `<span class="drag-handle" title="${T('长按或拖动排序','Long-press or drag to reorder')}" aria-label="${T('拖动排序','Drag to reorder')}"></span>`,
      nameHtml,
      ifHtml: ifVal ? jMetaIf('IF', ifVal) : null,
      freeHtml,
      metaHtml,
      bodyHtml,
    });
  }

  const UPDATE_CATEGORY_KEYS = ['all', 'new_journal', 'index_change', 'warning', 'policy', 'report'];
  const UPDATE_EN = {
    'wos-on-hold-four-journals-2026-06-10': {
      title: 'Four journals newly marked as WoS On Hold',
      summary: 'LetPub summarized the latest On Hold risk signals and listed four newly marked journals. AILatest has added them to the On Hold watch list.',
      dek: 'A submission-risk reminder. On Hold means a journal is under further review or observation, not necessarily removed, but authors should verify status before submission.'
    },
    'journal-of-research-on-research-launch-2026': {
      title: 'Journal of Research on Research launches',
      summary: 'Taylor & Francis has launched Journal of Research on Research for meta-research, research evaluation, governance, and open science. The journal is open for submissions with no APC in the first two years.',
      dek: 'A new-journal launch for authors working on research evaluation, meta-research, research governance, and open science.'
    },
    'clarivate-2026-jcr-edition-webinar': {
      title: 'Clarivate previews 2026 Journal Citation Reports updates',
      summary: 'Clarivate announced a webinar for the 2026 Journal Citation Reports, covering metric updates, journal coverage, publishing and citation patterns, and responsible JIF use.',
      dek: 'This is not the formal JCR data release; it is Clarivate’s public preview and training notice for the 2026 edition.'
    },
    'nature-index-2026-research-leaders': {
      title: 'Nature Index expands coverage and releases 2026 Research Leaders',
      summary: 'Springer Nature expanded Nature Index coverage, updated article-level subject classification, and released the 2026 Research Leaders list based on 2025 data.',
      dek: 'Nature Index expanded its journal coverage and methodology while releasing the 2026 Research Leaders list.'
    },
    'elsevier-advanced-biosensors-launch-2026': {
      title: 'Elsevier launches Advanced Biosensors',
      summary: 'Elsevier launched the open-access journal Advanced Biosensors, covering biosensor research, design, development, and applications. Accepted submissions are APC-free until the end of 2027.',
      dek: 'A new open-access journal launch relevant to biosensing, materials, analytical chemistry, and biomedical engineering.'
    },
    'doaj-new-journals-2026-06-10': {
      title: 'DOAJ adds new open-access journal records',
      summary: 'DOAJ added new OA journal records across medicine, humanities and social sciences, public administration, economics, and finance. AILatest has synced the public DOAJ fields.',
      dek: 'An indexing-change roundup based on DOAJ public records, including license, APC, peer review, and review-week fields.'
    },
    'global-oa-publishing-ten-questions-2026': {
      title: 'Global OA Publishing: Ten Questions report is available',
      summary: 'The report discusses global OA publishing trends, quality governance, Mega Journals, LLM impact, and future governance paths.',
      dek: 'A report-style update on the open-access publishing ecosystem, useful for tracking OA governance and publishing strategy.'
    },
    'doaj-ambassador-programme-10-years-2026': {
      title: 'DOAJ reviews ten years of the Ambassador Programme',
      summary: 'DOAJ highlighted open-access journal quality standards, regional outreach, and author education in its ten-year programme review.',
      dek: 'A DOAJ programme update focused on OA quality standards, regional outreach, and author education.'
    },
    'scholarly-kitchen-scholar-ready-ai-2026': {
      title: 'The Scholarly Kitchen discusses AI-ready publishing infrastructure',
      summary: 'The interview covers AI search, source trust, and publishing infrastructure, with a focus on how authoritative content enters AI-driven research workflows.',
      dek: 'An industry observation on AI and scholarly publishing infrastructure.'
    },
    'springer-nature-society-partner-newsletter-epic-2026': {
      title: 'Springer Nature society-partner newsletter wins 2026 Gold EPIC Award',
      summary: 'Springer Nature says the newsletter connects more than 900 society partners in 48 countries and covers publishing innovation, research policy, and open access.',
      dek: 'A publishing-service update reflecting communication and support for society journals.'
    },
    'nature-registered-reports-all-disciplines-2026': {
      title: 'Nature expands Registered Reports to all disciplines',
      summary: 'Nature expanded the Registered Reports format across natural sciences, social sciences, clinical sciences, engineering, and public health.',
      dek: 'A submission-policy update for papers emphasizing study design, preregistration, and reproducibility.'
    },
    'wiley-acquires-emerald-2026': {
      title: 'Wiley acquires Emerald and expands its social-science portfolio',
      summary: 'Wiley announced the acquisition of Emerald Publishing, expanding its portfolio to roughly 2,500 journals and strengthening business, finance, economics, and social science coverage.',
      dek: 'A publishing-industry update that may affect social science, management, business, and finance journal portfolios.'
    }
  };

  function normalizeJournalUpdates(payload) {
    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    const items = rawItems
      .map(item => {
        const src = item || {};
        return {
          id: String(src.id || src.source_url || src.title || '').trim(),
          published_at: String(src.published_at || '').trim(),
          category: UPDATE_CATEGORY_KEYS.includes(src.category) ? src.category : 'report',
          title: String(src.title || '').trim(),
          summary: String(src.summary || '').trim(),
          source_name: String(src.source_name || src.publisher || '').trim(),
          source_name_en: String(src.source_name_en || src.en?.source_name || src.translations?.en?.source_name || '').trim(),
          source_url: String(src.source_url || '').trim(),
          publisher: String(src.publisher || '').trim(),
          publisher_en: String(src.publisher_en || src.en?.publisher || src.translations?.en?.publisher || '').trim(),
          journals: Array.isArray(src.journals) ? src.journals.filter(Boolean).map(String) : [],
          tags: Array.isArray(src.tags) ? src.tags.filter(Boolean).map(String) : [],
          priority: Number.isFinite(Number(src.priority)) ? Number(src.priority) : 0,
          image_url: String(src.image_url || src.image || src.cover_image || '').trim(),
          detail_path: String(src.detail_path || '').trim(),
          title_en: String(src.title_en || src.en?.title || src.translations?.en?.title || '').trim(),
          summary_en: String(src.summary_en || src.en?.summary || src.translations?.en?.summary || '').trim(),
          detail: src.detail && typeof src.detail === 'object' ? src.detail : null,
          detail_en: src.detail_en && typeof src.detail_en === 'object' ? src.detail_en : null,
          en: src.en && typeof src.en === 'object' ? src.en : null,
          translations: src.translations && typeof src.translations === 'object' ? src.translations : null
        };
      })
      .filter(item => item.id && item.title)
      .sort((a, b) => {
        const da = Date.parse(a.published_at) || 0;
        const db = Date.parse(b.published_at) || 0;
        if (db !== da) return db - da;
        return (b.priority || 0) - (a.priority || 0);
      });
    return {
      updated_at: String(payload?.updated_at || '').trim(),
      items
    };
  }

  // ───────── bindings ─────────
  function bind() {
    $('#index-toggles').addEventListener('change', () => {
      activeIndices = new Set($$('#index-toggles input:checked').map(i => i.value));
      shown = PAGE; renderInt();
    });
    $('#zone-toggles').addEventListener('change', () => {
      activeZones = new Set($$('#zone-toggles input:checked').map(i => i.value));
      shown = PAGE; renderInt();
    });
    $('#jcr-toggles').addEventListener('change', () => {
      activeJcr = new Set($$('#jcr-toggles input:checked').map(i => i.value));
      shown = PAGE; renderInt();
    });
    $('#xr-toggles').addEventListener('change', () => {
      activeXr = new Set($$('#xr-toggles input:checked').map(i => i.value));
      shown = PAGE; renderInt();
    });
    $('#abdc-toggles').addEventListener('change', () => {
      activeAbdc = new Set($$('#abdc-toggles input:checked').map(i => i.value));
      shown = PAGE; renderInt();
    });
    $('#abs-toggles').addEventListener('change', () => {
      activeAbs = new Set($$('#abs-toggles input:checked').map(i => i.value));
      shown = PAGE; renderInt();
    });
    document.querySelectorAll('.feat-row').forEach(row => {
      row.addEventListener('change', () => {
        activeFeats = new Set([...document.querySelectorAll('.feat-row input:checked')].map(i => i.value));
        const freeCol = document.getElementById('free-col-filter');
        if (freeCol) freeCol.checked = activeFeats.has('free');
        shown = PAGE; renderInt();
      });
    });
    const setFreeFilter = (checked) => {
      if (checked && !canSeePublishFeeInfo()) {
        showRegionPaywallModal('publish_fee');
        const freeCol = document.getElementById('free-col-filter');
        if (freeCol) freeCol.checked = false;
        document.querySelectorAll('.feat-row input[value="free"], #free-chip-proxy, .th-chk-free input').forEach(input => { input.checked = false; });
        activeFeats.delete('free');
        return;
      }
      const freeCol = document.getElementById('free-col-filter');
      if (freeCol) freeCol.checked = checked;
      document.querySelectorAll('.feat-row input[value="free"], #free-chip-proxy, .th-chk-free input').forEach(input => { input.checked = checked; });
      if (checked) activeFeats.add('free');
      else activeFeats.delete('free');
      shown = PAGE;
      renderInt();
    };
    document.getElementById('free-col-filter')?.addEventListener('change', (e) => {
      setFreeFilter(e.target.checked);
    });
    document.getElementById('free-col-filter-label')?.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'free-col-filter') return;
      e.preventDefault();
      setFreeFilter(!activeFeats.has('free'));
    });
    // V10「开放」行里的免费发表 chip
    document.querySelectorAll('#free-chip-proxy, .th-chk-free input').forEach((input) => {
      input.addEventListener('change', (e) => setFreeFilter(!!e.target.checked));
    });
    // IF 快捷芯片（独立一行：≥1/2/3/5/10/15/20/30，与 activeIfMin 共用）
    const syncIfChips = () => {
      document.querySelectorAll('.th-if-chip[data-if-min]').forEach((btn) => {
        const v = Number(btn.getAttribute('data-if-min') || 0);
        btn.classList.toggle('active', activeIfMin > 0 && activeIfMin === v);
        btn.setAttribute('aria-pressed', activeIfMin === v ? 'true' : 'false');
      });
      const slider = document.getElementById('if-slider');
      const label = document.getElementById('if-slider-val');
      if (slider) {
        slider.value = String(activeIfMin || 0);
        const pct = Math.min(100, Math.max(0, ((activeIfMin || 0) / 50) * 100));
        slider.style.setProperty('--pct', pct + '%');
      }
      if (label) {
        label.textContent = activeIfMin > 0
          ? `≥ ${activeIfMin}`
          : (typeof t === 'function' ? t('if_any') : '不限');
      }
    };
    document.querySelectorAll('.th-if-chip[data-if-min]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const v = Number(btn.getAttribute('data-if-min') || 0);
        activeIfMin = activeIfMin === v ? 0 : v;
        syncIfChips();
        shown = PAGE;
        renderInt();
      });
    });
    syncIfChips();
    // 侧栏「免费发表」筛选
    document.querySelectorAll('.feat-row input[value="free"]').forEach((input) => {
      input.addEventListener('change', (e) => {
        if (!canSeePublishFeeInfo() && e.target.checked) {
          e.target.checked = false;
          activeFeats.delete('free');
          showRegionPaywallModal('publish_fee');
        }
      });
    });
    document.getElementById('pick-filter-free')?.addEventListener('change', (e) => {
      if (!canSeePublishFeeInfo() && e.target.checked) {
        e.target.checked = false;
        showRegionPaywallModal('publish_fee');
      }
    });
    // 列表 / 详情中的 Pro 锁
    document.addEventListener('click', (e) => {
      const lock = e.target && e.target.closest && e.target.closest('[data-publish-fee-lock]');
      if (!lock) return;
      e.preventDefault();
      e.stopPropagation();
      showRegionPaywallModal('publish_fee');
    });
    $('#topic-dd-search')?.addEventListener('input', () => {
      const raw = ($('#topic-dd-search')?.value || '').trim().toLowerCase();
      const panel = $('#topic-dd-list');
      if (!panel) return;
      const filtered = !raw ? topicList : topicList.filter(t => t.name.toLowerCase().includes(raw));
      panel.innerHTML = filtered.map(t =>
        `<label class="th-chk" data-filter="topic" data-value="${escape(t.name)}">
           <input type="checkbox" ${activeTopics.has(t.name) ? 'checked' : ''}>
           <span>${escape(t.name)}</span>
           <span class="count">${t.count.toLocaleString()}</span>
         </label>`
      ).join('');
      // Re-bind change events for new checkboxes
      // (the generic handler in renderCatList uses __bound which only binds once,
      //  but these checkboxes are new DOM nodes so the events need re-binding)
      panel.querySelectorAll('label.th-chk').forEach(label => {
        const cb = label.querySelector('input[type=checkbox]');
        if (!cb || cb.__topicBound) return;
        cb.__topicBound = true;
        cb.addEventListener('change', () => {
          const val = label.dataset.value;
          if (cb.checked) activeTopics.add(val);
          else activeTopics.delete(val);
          shown = PAGE;
          renderInt();
        });
      });
    });
    $('#topic-clear')?.addEventListener('click', () => {
      activeTopics.clear();
      const inp = $('#topic-search'); if (inp) inp.value = '';
      renderTopicList();
      shown = PAGE; renderInt();
    });
    $('#topic-all-btn')?.addEventListener('click', () => {
      activeTopics.clear();
      const inp = $('#topic-search'); if (inp) inp.value = '';
      renderTopicList();
      shown = PAGE; renderInt();
    });
    let homeSearchDebounce = null;
    const queryInput = $('#q');
    // IME confirmation Enter is not a search submission.  On macOS/Chrome
    // the event may arrive with isComposing=false, so keep a short guard after
    // compositionend as well as checking the traditional keyCode 229 signal.
    const isImeEnterEvent = (event, field = queryInput) => Boolean(
      event?.isComposing
      || event?.keyCode === 229
      || event?.which === 229
      || field?.__pickCompositionActive
      || performance.now() < Number(field?.__pickIgnoreEnterUntil || 0)
    );
    queryInput?.addEventListener('compositionstart', () => {
      queryInput.__pickCompositionActive = true;
      queryInput.__pickIgnoreEnterUntil = 0;
    });
    queryInput?.addEventListener('compositionend', () => {
      queryInput.__pickCompositionActive = false;
      queryInput.__pickIgnoreEnterUntil = performance.now() + 220;
    });
    queryInput.addEventListener('input', (e) => {
      if (activeTab === 'updates') activeUpdateQuery = e.target.value.trim();
      else activeQuery = e.target.value.trim();
      shown = PAGE;
      if (isPickSearchContext()) return; // pick mode uses Enter / submit
      if (activeTab === 'home') {
        clearTimeout(homeSearchDebounce);
        homeSearchDebounce = setTimeout(showHomeSearchResults, 90);
      } else {
        activeTab === 'int' ? renderInt()
          : activeTab === 'fav' ? renderFav()
          : activeTab === 'dom' ? renderDomestic()
          : activeTab === 'in' ? renderIndia()
          : activeTab === 'my' ? renderMalaysia()
          : activeTab === 'kr' ? renderKorea()
          : REGIONAL_DIRECTORY_CONFIG[activeTab] ? renderRegionalDirectory(activeTab)
          : activeTab === 'updates' ? renderJournalUpdates()
          : null;
      }
    });
    queryInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (isImeEnterEvent(e, e.currentTarget)) return;
      e.preventDefault();
      if (isPickSearchContext()) {
        submitPickSearchFromTopbar(e.currentTarget.value.trim());
        return;
      }
      if (activeTab === 'updates') activeUpdateQuery = e.currentTarget.value.trim();
      else activeQuery = e.currentTarget.value.trim();
      shown = PAGE;
      const currentQuery = activeTab === 'updates' ? activeUpdateQuery : activeQuery;
      if (!currentQuery) return;
      if (activeTab === 'home') saveHomeSearchHistory(currentQuery);
      trackInteraction('journal_search', { tab: activeTab, query: currentQuery });
      if (activeTab === 'home') showHomeSearchResults();
      else if (activeTab === 'int') renderInt();
      else if (activeTab === 'fav') renderFav();
      else if (activeTab === 'dom') renderDomestic();
      else if (REGIONAL_DIRECTORY_CONFIG[activeTab]) renderRegionalDirectory(activeTab);
      else if (activeTab === 'updates') renderJournalUpdates();
    });
    $('#search-submit')?.addEventListener('click', async () => {
      const qEl = $('#q');
      if (!qEl) return;
      const query = qEl.value.trim();
      if (isPickSearchContext()) {
        if (!query) {
          qEl.focus();
          return;
        }
        await submitPickSearchFromTopbar(query);
        return;
      }
      if (activeTab === 'updates') activeUpdateQuery = qEl.value.trim();
      else activeQuery = qEl.value.trim();
      shown = PAGE;
      const currentQuery = activeTab === 'updates' ? activeUpdateQuery : activeQuery;
      if (!currentQuery) {
        qEl.focus();
        return;
      }
      if (activeTab === 'pick') {
        qEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      } else if (activeTab === 'home') {
        saveHomeSearchHistory(activeQuery);
        trackInteraction('journal_search', { tab: activeTab, query: activeQuery });
        showHomeSearchResults();
      } else if (activeTab === 'int') { trackInteraction('journal_search', { tab: activeTab, query: activeQuery }); renderInt(); }
      else if (activeTab === 'fav') { trackInteraction('journal_search', { tab: activeTab, query: activeQuery }); renderFav(); }
      else if (activeTab === 'dom') { trackInteraction('journal_search', { tab: activeTab, query: activeQuery }); renderDomestic(); }
      else if (REGIONAL_DIRECTORY_CONFIG[activeTab]) { trackInteraction('journal_search', { tab: activeTab, query: activeQuery }); renderRegionalDirectory(activeTab); }
      else if (activeTab === 'updates') { trackInteraction('journal_search', { tab: activeTab, query: activeUpdateQuery }); renderJournalUpdates(); }
    });
    $('#more').addEventListener('click', () => { shown += PAGE; renderInt(); });

    document.addEventListener('click', (e) => {
      const sortEl = e.target.closest('[data-if-sort]');
      if (!sortEl) return;
      const target = sortEl.getAttribute('data-if-sort');
      if (target === 'int') {
        intIfSort = intIfSort === 'desc' ? 'asc' : 'desc';
        shown = PAGE;
        renderInt();
      } else if (target === 'fav') {
        e.preventDefault();
        // null → desc → asc → desc …
        favIfSort = favIfSort === 'desc' ? 'asc' : 'desc';
        renderFav();
      }
    });

    /* ───────── Home tab: auto-detect search ───────── */
    const homeResults = $('#home-results');
    const homePanel = $('.tab-panel[data-panel="home"]');
    const homeUpdatesPreview = $('#home-updates-preview');
    const HOME_SEARCH_HISTORY_KEY = 'ailatest.home.search.history';
    const HOME_SEARCH_FALLBACK_SUGGESTIONS = [
      'CA-A Cancer Journal for Clinicians',
      'Nature Reviews Molecular Cell Biology',
      'The Lancet',
      'New England Journal of Medicine',
      'JAMA',
      'Nature',
      'Science',
      'Cell',
    ];

    function latestHighImpactSuggestions() {
      if (!Array.isArray(journals) || !journals.length) return HOME_SEARCH_FALLBACK_SUGGESTIONS;
      return journals
        .filter(r => Number.isFinite(Number(r.if_latest ?? r.if_2025 ?? r.if_2024)) && r.name)
        .sort((a, b) => Number(b.if_latest ?? b.if_2025 ?? b.if_2024) - Number(a.if_latest ?? a.if_2025 ?? a.if_2024))
        .slice(0, 3)
        .map(r => r.name);
    }

    function getHomeSearchHistory() {
      try {
        const raw = JSON.parse(localStorage.getItem(HOME_SEARCH_HISTORY_KEY) || '[]');
        return Array.isArray(raw) ? raw.filter(Boolean).map(String).slice(0, 6) : [];
      } catch (_) {
        return [];
      }
    }

    function saveHomeSearchHistory(term) {
      const clean = String(term || '').trim();
      if (!clean) return;
      const seen = new Set();
      const next = [clean, ...getHomeSearchHistory()]
        .filter(x => {
          const key = x.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 8);
      try { localStorage.setItem(HOME_SEARCH_HISTORY_KEY, JSON.stringify(next)); } catch (_) {}
      renderHomeSearchChips();
    }

    function renderHomeSearchChips() {
      // 搜索记录/建议芯片已下线：始终隐藏
      const box = $('#home-search-chips');
      if (box) {
        box.hidden = true;
        box.innerHTML = '';
      }
    }

    function showHomeSearchResults() {
      if (!activeQuery) {
        if (homeResults) homeResults.hidden = true;
        if (homePanel) homePanel.classList.remove('home-tab-has-results');
        document.body.classList.remove('home-tab-has-results');
        renderHomeSearchChips();
        placeLangToggle();
        return;
      }
      if (homeUpdatesPreview) homeUpdatesPreview.hidden = true;
      if (homePanel) homePanel.classList.add('home-tab-has-results');
      document.body.classList.add('home-tab-has-results');
      if (homeResults) homeResults.hidden = false;
      renderHomeSearchChips();
      renderHomeIntResults();
      placeLangToggle();
    }
    // 供 setUiLanguage 在语言切换后重刷首页动态结果
    refreshHomeForLang = () => {
      try { showHomeSearchResults(); } catch (_) {}
    };

    /** 首页搜索：与全球站 / 中国站同一套 j-card（renderRow / renderDomRow） */
    function renderHomeJournalCard(r) {
      return renderRow(r);
    }

    function renderHomeDomesticCard(r) {
      return renderDomRow(r, {
        src: r.__src || 'cnki_major',
        showTier: !!(r.tier || r.__src === 'cnkx'),
        tierValue: r.tier,
      });
    }

    function renderHomeIntResults() {
      if (!homeResults) return;
      const q = activeQuery ? activeQuery.toLowerCase() : '';
      if (!q) { homeResults.innerHTML = ''; return; }
      const matchTxt = (...parts) => parts.filter(Boolean).join(' ').toLowerCase().includes(q);

      // Auto-detect: if query has Chinese characters, prioritize domestic
      const hasChinese = /[\u4e00-\u9fff]/.test(q);
      const intLimit = hasChinese ? 15 : 30;
      const looksLikeId = /\b\d{4}-?\d{3}[\dXx]\b|CN\s*\d{2}-\d+/i.test(activeQuery);
      const domLimit = hasChinese || looksLikeId ? 30 : 0;

      let totalCount = 0;
      let sections = [];

      // ── International results ──
      const homeSource = journalsReady && journals.length ? journals : (homeJournals.length ? homeJournals : journals);
      if (!homeSource.length) {
        homeResults.innerHTML = `<div class="empty-state">${T('正在准备期刊索引…','Preparing journal index…')}</div>`;
        return;
      }
      let intFiltered = homeSource.filter(r => scoreRecord(r, q) > 0);
      intFiltered = intFiltered
        .map(r => ({ r, s: scoreRecord(r, q) }))
        .sort((a, b) => {
          if (b.s !== a.s) return b.s - a.s;
          const fa = a.r.flagship ? 1 : 0;
          const fb = b.r.flagship ? 1 : 0;
          if (fa !== fb) return fb - fa;
          const ifa = a.r.if_2024 ?? -1;
          const ifb = b.r.if_2024 ?? -1;
          if (ifa !== ifb) return ifb - ifa;
          return (a.r.name||'').localeCompare(b.r.name||'');
        })
        .map(x => x.r);
      intFiltered = sortByIF(intFiltered, intIfSort);
      const intCount = intFiltered.length;

      if (intCount) {
        sections.push({
          kind: 'int',
          label: T('国际期刊','International Journals'),
          html: intFiltered.slice(0, intLimit).map(renderHomeJournalCard).join(''),
          count: intCount
        });
        totalCount += intCount;
      }

      // ── Domestic results ──
      let domCount = 0;
      let domHtml = '';
      if (domestic && domLimit > 0) {
        const allDomestic = [];
        for (const key of ['cnki_major', 'cnkx', 'nsfc_mgmt', 'zju', 'cscd', 'cstpcd', 'cssci_core', 'cssci_ext', 'pku_core']) {
          const src = domestic[key];
          const rows = Array.isArray(src) ? src : ((src && src.records) || []);
          if (rows.length) {
            for (const r of rows) {
              if (matchTxt(
                r.name, r.cn_name, r.title, r.issn, r.cn_code, r.en_name,
                r.sponsor, r.publisher, r.category, r.category_code, r.domain, r.subdomain,
                r.database, r.database_label, r.tier, r.frequency, r.code, r.kind,
                ...(r.major_categories || []), ...(r.categories || [])
              )) {
                allDomestic.push({ ...r, __src: key });
              }
            }
          }
        }
        const sourceRank = { cnki_major: 9, cnkx: 8, nsfc_mgmt: 7, zju: 6, cscd: 5, cstpcd: 4, cssci_core: 3, pku_core: 2, cssci_ext: 1 };
        const dedupedDomestic = [];
        const byDomesticKey = new Map();
        allDomestic.forEach((r) => {
          const key = (r.issn || r.cn_code || pickCleanDomesticName(r.name || r.cn_name || '')).toUpperCase();
          if (!key) return;
          const prev = byDomesticKey.get(key);
          if (!prev || (sourceRank[r.__src] || 0) > (sourceRank[prev.__src] || 0)) {
            byDomesticKey.set(key, r);
          }
        });
        byDomesticKey.forEach((r) => dedupedDomestic.push(r));
        domCount = dedupedDomestic.length;
        if (domCount) {
          domHtml = dedupedDomestic.slice(0, domLimit).map(renderHomeDomesticCard).join('');
        }
      }

      // Order sections: Chinese query → domestic first, English query → int first
      if (hasChinese) {
        if (domCount) {
          sections.unshift({
            kind: 'dom',
            label: T('国内期刊','Domestic Journals'),
            html: domHtml,
            count: domCount
          });
          totalCount += domCount;
        }
      } else {
        if (domCount) {
          sections.push({
            kind: 'dom',
            label: T('国内期刊','Domestic Journals'),
            html: domHtml,
            count: domCount
          });
          totalCount += domCount;
        }
      }

      if (!sections.length) {
        homeResults.innerHTML = `<div class="empty-state">${t('empty')}</div>`;
        return;
      }

      let html = `<div class="results-head" style="margin-bottom:8px">
        <span class="results-count">${T('找到','Found')} ${totalCount.toLocaleString()} ${T('个结果','results')}</span>
      </div>`;
      for (const sec of sections) {
        const limit = sec.kind === 'int' ? intLimit : domLimit;
        const tabTarget = sec.kind === 'int' ? 'int' : 'dom';
        const more = sec.count > limit
          ? `<div style="padding:4px 0 10px;display:flex;justify-content:space-between;align-items:center">
              <span class="muted-cell" style="font-size:12px">${T('已显示前','Showing first')} ${limit} ${T('条','')}</span>
              <button class="home-viewall-btn" data-viewall-tab="${tabTarget}" style="font-size:12px;color:var(--accent,#b4531f);background:none;border:none;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:2px">${T('查看全部','View all')} ${sec.count} →</button>
            </div>`
          : '';
        html += `<div class="home-section-label">${sec.label}</div>
          <div class="home-results-wrap">
            <table class="journals home-journals" data-home-kind="${sec.kind}">
              <thead hidden aria-hidden="true"><tr><th></th></tr></thead>
              <tbody>${sec.html}</tbody>
            </table>
          </div>${more}`;
      }
      if (totalCount > intLimit + domLimit) {
        html += `<div class="pager"><button class="big-btn primary" id="home-more-btn" data-i18n="load_more">${t('load_more')}</button></div>`;
      }
      homeResults.innerHTML = html;

      const moreBtn = $('#home-more-btn');
      if (moreBtn) {
        moreBtn.addEventListener('click', () => {
          shown += 30;
          renderHomeIntResults();
        });
      }
      // "查看全部" buttons → switch to full list tab
      homeResults.querySelectorAll('.home-viewall-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.dataset.viewallTab;
          // Sync query to topbar search so the target tab picks it up
          const topQ = $('#q');
          if (topQ) topQ.value = activeQuery;
          activateTab(tab);
        });
      });
    }

    function updateCategoryLabel(category) {
      if (category === 'all') return t('update_cat_all');
      return t(`update_cat_${category}`) || category;
    }
    function updateIsZh() {
      return lang === 'zh-CN' || lang === 'zh-TW';
    }
    function updatePlainObject(value) {
      return value && typeof value === 'object' && !Array.isArray(value);
    }
    function updateFirstText(...values) {
      for (const value of values) {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        if (text) return text;
      }
      return '';
    }
    function updateHasCjk(value) {
      if (typeof value === 'string') return /[\u3400-\u9fff\uf900-\ufaff]/.test(value);
      if (Array.isArray(value)) return value.some(updateHasCjk);
      if (updatePlainObject(value)) return Object.values(value).some(updateHasCjk);
      return false;
    }
    function updateEnglishText(value) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (!text || updateHasCjk(text) || !/[A-Za-z0-9]/.test(text)) return '';
      return text;
    }
    function updateEnglishPayload(item) {
      const direct = updatePlainObject(item.en) ? item.en : {};
      const translated = updatePlainObject(item.translations?.en) ? item.translations.en : {};
      const legacy = UPDATE_EN[item.id] || {};
      const detail =
        updatePlainObject(item.detail_en) ? item.detail_en :
        updatePlainObject(direct.detail) ? direct.detail :
        updatePlainObject(translated.detail) ? translated.detail :
        legacy.dek ? { dek: legacy.dek } : {};
      return {
        title: updateFirstText(item.title_en, direct.title, translated.title, legacy.title),
        summary: updateFirstText(item.summary_en, direct.summary, translated.summary, legacy.summary),
        source_name: updateFirstText(item.source_name_en, direct.source_name, translated.source_name),
        publisher: updateFirstText(item.publisher_en, direct.publisher, translated.publisher),
        detail
      };
    }
    function updateCategoryLabelEn(category) {
      return {
        new_journal: 'New journal',
        index_change: 'Indexing change',
        warning: 'Risk alert',
        policy: 'Publishing policy',
        report: 'Report'
      }[category] || 'Journal update';
    }
    function updateEnglishSubject(item) {
      const values = [
        ...(item.journals || []),
        item.publisher_en,
        item.source_name_en,
        item.publisher,
        item.source_name,
        ...(item.tags || [])
      ].map(updateEnglishText).filter(Boolean);
      return values[0] || '';
    }
    function autoEnglishUpdateTitle(item) {
      if (!updateHasCjk(item.title)) return item.title || updateCategoryLabelEn(item.category);
      const subject = updateEnglishSubject(item);
      return subject ? `${updateCategoryLabelEn(item.category)}: ${subject}` : `${updateCategoryLabelEn(item.category)} update`;
    }
    function autoEnglishUpdateSummary(item) {
      if (item.summary && !updateHasCjk(item.summary)) return item.summary;
      const category = updateCategoryLabelEn(item.category).toLowerCase();
      const subject = updateEnglishSubject(item) || 'a scholarly-publishing development';
      const source = updateEnglishText(item.publisher_en) || updateEnglishText(item.publisher) || updateEnglishText(item.source_name_en) || updateEnglishText(item.source_name) || 'the original source';
      const journals = (item.journals || []).map(updateEnglishText).filter(Boolean).slice(0, 4).join(', ');
      const tags = (item.tags || []).map(updateEnglishText).filter(Boolean).slice(0, 4).join(', ');
      const parts = [`This ${category} update tracks ${subject} from ${source}.`];
      if (journals) parts.push(`Related journal(s): ${journals}.`);
      if (tags) parts.push(`Key tags: ${tags}.`);
      parts.push('The original source link remains the verification basis.');
      return parts.join(' ');
    }
    function autoEnglishUpdateArticle(item) {
      const source = updateSourceName(item);
      const journals = (item.journals || []).map(updateEnglishText).filter(Boolean).slice(0, 6);
      const tags = (item.tags || []).map(updateEnglishText).filter(Boolean).slice(0, 6);
      const context = [
        `Type: ${updateCategoryLabelEn(item.category)}.`,
        source ? `Source: ${source}.` : '',
        item.published_at ? `Published or logged: ${formatUpdateDate(item.published_at)}.` : '',
        journals.length ? `Related journal(s): ${journals.join(', ')}.` : '',
        tags.length ? `Key tags: ${tags.join(', ')}.` : ''
      ].filter(Boolean);
      return {
        intro: [updateSummary(item)],
        sections: [
          {
            heading: 'Structured context',
            bullets: context
          },
          {
            heading: 'Verification',
            bullets: ['Original-source details should be checked before using this item for submission, indexing, or ranking decisions.']
          }
        ]
      };
    }
    function updateLocalizedDetail(item) {
      const detail = item.detail || {};
      if (updateIsZh()) return detail;
      const enDetail = updateEnglishPayload(item).detail || {};
      const article = updatePlainObject(enDetail.article)
        ? enDetail.article
        : updatePlainObject(detail.article) && !updateHasCjk(detail.article)
          ? detail.article
          : autoEnglishUpdateArticle(item);
      return { ...detail, ...enDetail, article };
    }
    function updateSourceName(item) {
      const raw = item.source_name || item.publisher || t('updates_source');
      if (updateIsZh()) return raw;
      const en = updateEnglishPayload(item);
      const explicit = updateFirstText(en.source_name, en.publisher);
      if (explicit) return explicit;
      if (/微信/.test(raw)) return 'WeChat Official Account';
      if (updateHasCjk(raw)) return updateEnglishText(item.publisher) || t('updates_source');
      return raw;
    }
    function updateTitle(item) {
      if (updateIsZh()) return item.title;
      return updateEnglishPayload(item).title || autoEnglishUpdateTitle(item);
    }
    function updateSummary(item) {
      if (updateIsZh()) return item.summary;
      return updateEnglishPayload(item).summary || autoEnglishUpdateSummary(item);
    }
    function updateDek(item) {
      const detail = item.detail || {};
      if (!updateIsZh()) {
        const enDetail = updateEnglishPayload(item).detail || {};
        return updateFirstText(enDetail.dek, enDetail.lead, updateSummary(item));
      }
      return detail.dek || detail.lead || item.summary || '';
    }

    function formatUpdateDate(value) {
      if (!value) return '';
      const text = String(value);
      const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        return lang === 'en' ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}.${m[2]}.${m[3]}`;
      }
      const d = new Date(text);
      if (Number.isNaN(d.getTime())) return text;
      return d.toLocaleDateString(uiLocale(), { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function journalUpdateMatches(item, query = activeUpdateQuery, category = activeUpdateCategory) {
      if (category && category !== 'all' && item.category !== category) return false;
      const q = String(query || '').trim().toLowerCase();
      if (!q) return true;
      return [
        updateTitle(item),
        updateSummary(item),
        item.source_name,
        item.publisher,
        updateCategoryLabel(item.category),
        ...(item.journals || []),
        ...(item.tags || [])
      ].join(' ').toLowerCase().includes(q);
    }

    function updatePathIsUpdates(pathname = location.pathname) {
      return false;
    }

    function updateDetailSlugFromPath(pathname = location.pathname) {
      return '';
    }

    function updateDetailPath(item) {
      return '';
    }

    function updateDetailItemFromPath() {
      return null;
    }

    function formatFileSize(bytes) {
      const n = Number(bytes || 0);
      if (!n) return '';
      if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
      if (n >= 1024) return `${Math.round(n / 1024)} KB`;
      return `${n} B`;
    }

    function updateTextList(value) {
      if (Array.isArray(value)) {
        return value.map(v => String(v || '').trim()).filter(Boolean);
      }
      const text = String(value || '').trim();
      return text ? [text] : [];
    }

    function updateLinkList(value) {
      if (!Array.isArray(value)) return [];
      return value
        .map(link => {
          if (!link || typeof link !== 'object') return null;
          const label = String(link.label || link.title || link.name || '').trim();
          const url = String(link.url || link.href || '').trim();
          if (!label || !url) return null;
          return {
            label,
            url,
            note: String(link.note || '').trim(),
            external: /^https?:\/\//i.test(url)
          };
        })
        .filter(Boolean);
    }

    function renderUpdateLinks(links, cls = 'update-link-list') {
      if (!links.length) return '';
      return `<div class="${cls}">
        ${links.map(link => `<a href="${escape(link.url)}"${link.external ? ' target="_blank" rel="noopener"' : ''}>
          <span>${escape(link.label)}</span>${link.note ? `<em>${escape(link.note)}</em>` : ''}
        </a>`).join('')}
      </div>`;
    }

    function renderUpdateArticle(article) {
      if (!article || typeof article !== 'object') return '';
      const intro = updateTextList(article.intro);
      const stats = Array.isArray(article.stats) ? article.stats : [];
      const sections = Array.isArray(article.sections) ? article.sections : [];
      const questions = Array.isArray(article.questions) ? article.questions : [];
      const takeaways = updateTextList(article.takeaways);
      const links = updateLinkList(article.links);
      const note = String(article.note || '').trim();

      const statsHtml = stats
        .map(stat => {
          if (!stat || typeof stat !== 'object') return '';
          const label = String(stat.label || '').trim();
          const value = String(stat.value || '').trim();
          const noteText = String(stat.note || '').trim();
          if (!label && !value && !noteText) return '';
          return `<div class="update-stat">
            ${value ? `<strong>${escape(value)}</strong>` : ''}
            ${label ? `<span>${escape(label)}</span>` : ''}
            ${noteText ? `<p>${escape(noteText)}</p>` : ''}
          </div>`;
        })
        .filter(Boolean)
        .join('');

      const sectionsHtml = sections
        .map(section => {
          if (!section || typeof section !== 'object') return '';
          const heading = String(section.heading || '').trim();
          const body = updateTextList(section.body);
          const bullets = updateTextList(section.bullets);
          if (!heading && !body.length && !bullets.length) return '';
          return `<section class="update-article-section">
            ${heading ? `<h2>${escape(heading)}</h2>` : ''}
            ${body.map(p => `<p>${escape(p)}</p>`).join('')}
            ${bullets.length ? `<ul>${bullets.map(p => `<li>${escape(p)}</li>`).join('')}</ul>` : ''}
          </section>`;
        })
        .filter(Boolean)
        .join('');

      const questionsHtml = questions
        .map(q => {
          if (!q || typeof q !== 'object') return '';
          const question = String(q.question || '').trim();
          const answer = updateTextList(q.answer);
          if (!question && !answer.length) return '';
          return `<article class="update-question">
            ${question ? `<h3>${escape(question)}</h3>` : ''}
            ${answer.map(p => `<p>${escape(p)}</p>`).join('')}
          </article>`;
        })
        .filter(Boolean)
        .join('');

      if (!intro.length && !statsHtml && !sectionsHtml && !questionsHtml && !takeaways.length && !links.length) return '';
      return `<div class="update-article">
        ${note ? `<p class="update-article-note">${escape(note)}</p>` : ''}
        ${intro.length ? `<section class="update-article-lead">${intro.map(p => `<p>${escape(p)}</p>`).join('')}</section>` : ''}
        ${statsHtml ? `<section class="update-stats" aria-label="${escape(T('报告关键数据','Report key data'))}">${statsHtml}</section>` : ''}
        ${sectionsHtml}
        ${questionsHtml ? `<section class="update-article-section update-question-section">
          <h2>${escape(article.questions_heading || T('十问导览','Question guide'))}</h2>
          <div class="update-question-list">${questionsHtml}</div>
        </section>` : ''}
        ${takeaways.length ? `<section class="update-article-section update-takeaways">
          <h2>${T('给选刊用户的启发','Implications for journal selection')}</h2>
          <ul>${takeaways.map(p => `<li>${escape(p)}</li>`).join('')}</ul>
        </section>` : ''}
        ${links.length ? `<section class="update-article-section"><h2>${T('相关链接','Related links')}</h2>${renderUpdateLinks(links)}</section>` : ''}
      </div>`;
    }

    const updateDatasetCache = new Map();

    function uniqueUpdateLinks(links) {
      const seen = new Set();
      return links.filter(link => {
        const cleanUrl = String(link.url || '').replace(/\/+$/, '');
        const key = cleanUrl || String(link.label || '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function renderNatureIndexRankingsShell(detail) {
      const dataset = String(detail.rankings_dataset || '').trim();
      if (!dataset) return '';
      const defaultTopic = String(detail.rankings_default_topic || 'microbiology').trim();
      return `<section class="update-topic-rankings" data-nature-index-rankings data-dataset="${escape(dataset)}" data-default-topic="${escape(defaultTopic)}">
        <div class="nature-rankings-loading">${T('正在加载 Nature Index 学科排行…','Loading Nature Index topic rankings...')}</div>
      </section>`;
    }

    async function loadUpdateDataset(url) {
      if (!updateDatasetCache.has(url)) {
        updateDatasetCache.set(url, fetchJSON(url));
      }
      return updateDatasetCache.get(url);
    }

    function natureTopicOptions(topics, activeSlug) {
      const groups = new Map();
      topics.forEach(topic => {
        const group = topic.group || 'Topics';
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(topic);
      });
      return [...groups.entries()].map(([group, rows]) => `<optgroup label="${escape(group)}">
        ${rows.map(topic => `<option value="${escape(topic.slug)}"${topic.slug === activeSlug ? ' selected' : ''}>${escape(topic.label)}</option>`).join('')}
      </optgroup>`).join('');
    }

    function natureShare(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(2) : '';
    }

    function renderNatureRankingsTable(topic) {
      if (!topic) {
        return `<div class="nature-rankings-empty">${T('没有匹配的学科。','No matching topic.')}</div>`;
      }
      const rows = Array.isArray(topic.rows) ? topic.rows : [];
      return `<div class="nature-topic-table-head">
        <div>
          <p class="updates-kicker">Nature Index Topic</p>
          <h2>${escape(topic.label)}</h2>
        </div>
        <span>Top ${rows.length}</span>
      </div>
      <div class="nature-topic-table-wrap">
        <table class="nature-topic-table">
          <thead>
            <tr>
              <th>${T('排名','Rank')}</th>
              <th>${T('机构','Institution')}</th>
              <th>${T('国家/地区','Country/region')}</th>
              <th>Count</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `<tr>
              <td>${escape(row.rank)}</td>
              <td>${escape(row.institution)}</td>
              <td>${escape(row.country)}</td>
              <td>${escape(row.count)}</td>
              <td>${escape(natureShare(row.share))}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }

    async function hydrateNatureIndexRankings(root, detail) {
      const box = root.querySelector('[data-nature-index-rankings]');
      if (!box) return;
      const datasetUrl = box.dataset.dataset || detail.rankings_dataset || '';
      const defaultTopic = box.dataset.defaultTopic || detail.rankings_default_topic || 'microbiology';
      try {
        const data = await loadUpdateDataset(datasetUrl);
        const topics = Array.isArray(data.topics) ? data.topics : [];
        if (!topics.length) throw new Error('No Nature Index topics in dataset');
        let activeSlug = topics.some(topic => topic.slug === defaultTopic) ? defaultTopic : topics[0].slug;
        const sourceUrl = data.source && data.source.page_url ? data.source.page_url : 'https://www.nature.com/nature-index/topics/institution-tables/global/all/';
        const license = data.source && data.source.license ? data.source.license : {};

        box.innerHTML = `<div class="nature-rankings-head">
          <div>
            <p class="updates-kicker">Topic Rankings</p>
            <h2>${T('Nature Index 学科机构 Top 30','Nature Index topic institution Top 30')}</h2>
            <p>${escape(data.topic_count || topics.length)} ${T('个学科','topics')} · Global / All sectors · ${escape(data.time_frame?.label || '')}</p>
          </div>
          <a href="${escape(sourceUrl)}" target="_blank" rel="noopener">${T('Nature Index 来源','Nature Index source')}</a>
        </div>
        <div class="nature-rankings-controls">
          <label>
            <span>${T('搜索学科','Search topic')}</span>
            <input type="search" data-nature-topic-search placeholder="${T('输入 topic，例如 Microbiology / Machine Learning','Enter a topic, e.g. Microbiology / Machine Learning')}">
          </label>
          <label>
            <span>${T('选择学科','Select topic')}</span>
            <select data-nature-topic-select></select>
          </label>
        </div>
        <div data-nature-topic-table></div>
        <p class="nature-rankings-license">${T('数值表格来源于 Nature Index；表格数值按','Numerical tables are sourced from Nature Index and attributed under')} <a href="${escape(license.url || 'https://creativecommons.org/licenses/by-nc-sa/4.0/')}" target="_blank" rel="noopener">${escape(license.label || 'CC BY-NC-SA 4.0')}</a>${T(' 标注。','.')}</p>`;

        const search = box.querySelector('[data-nature-topic-search]');
        const select = box.querySelector('[data-nature-topic-select]');
        const table = box.querySelector('[data-nature-topic-table]');

        const renderTable = () => {
          const topic = topics.find(x => x.slug === activeSlug) || topics[0];
          table.innerHTML = renderNatureRankingsTable(topic);
        };
        const applyOptions = (list) => {
          select.innerHTML = natureTopicOptions(list, activeSlug);
        };

        applyOptions(topics);
        renderTable();

        search.addEventListener('input', () => {
          const q = search.value.trim().toLowerCase();
          const filtered = q
            ? topics.filter(topic => `${topic.label} ${topic.group} ${topic.slug}`.toLowerCase().includes(q))
            : topics;
          if (!filtered.length) {
            applyOptions([]);
            table.innerHTML = renderNatureRankingsTable(null);
            return;
          }
          if (!filtered.some(topic => topic.slug === activeSlug)) {
            activeSlug = filtered[0].slug;
          }
          applyOptions(filtered);
          renderTable();
        });

        select.addEventListener('change', () => {
          activeSlug = select.value || activeSlug;
          renderTable();
        });
      } catch (err) {
        box.innerHTML = `<div class="nature-rankings-empty">${T('Nature Index 排行数据加载失败，请刷新页面重试。','Nature Index ranking data failed to load. Refresh the page and try again.')}</div>`;
        console.error(err);
      }
    }

    function renderJournalUpdateDetail(item) {
      const box = $('#journal-updates');
      if (!box) return;
      const detail = updateLocalizedDetail(item);
      const report = detail.report || {};
      const sourceName = updateSourceName(item);
      const points = Array.isArray(detail.key_points) ? detail.key_points : [];
      const sections = Array.isArray(detail.sections) ? detail.sections : [];
      const articleHtml = renderUpdateArticle(detail.article);
      const sourceLinks = uniqueUpdateLinks(updateLinkList([
        item.source_url ? { label: T('原始来源','Original source'), url: item.source_url, note: sourceName } : null,
        ...(Array.isArray(detail.source_links) ? detail.source_links : []),
      ].filter(Boolean)));
      const journalLinks = updateLinkList(detail.journal_links || []);
      const reportUrl = report.file_detail_url || report.view_url || report.pdf_url || '';
      const pdfUrl = report.pdf_url || report.download_url || report.view_url || '';
      const detailTitle = updateTitle(item);
      const detailDek = updateDek(item);
      box.innerHTML = `
        <article class="update-detail">
          <a class="updates-back" href="/" data-updates-back>← ${escape(T('返回首页', 'Back home'))}</a>
          <header class="update-detail-head">
            <div class="update-card-top">
              <span class="update-category">${escape(updateCategoryLabel(item.category))}</span>
              ${item.published_at ? `<time datetime="${escape(item.published_at)}">${escape(formatUpdateDate(item.published_at))}</time>` : ''}
            </div>
            <h1>${escape(detailTitle)}</h1>
            <p class="update-detail-dek">${escape(detailDek)}</p>
            <div class="update-detail-meta">
              <span>${escape(t('updates_source'))}: ${escape(sourceName)}</span>
              ${item.publisher ? `<span>${escape(updateIsZh() ? item.publisher : (updateFirstText(item.publisher_en, updateEnglishText(item.publisher), item.publisher)))}</span>` : ''}
            </div>
            ${sourceLinks.length ? renderUpdateLinks(sourceLinks, 'update-source-actions') : ''}
          </header>
          ${articleHtml || `
            ${(detail.lead || item.summary) ? `<section class="update-detail-section"><p>${escape(updateIsZh() ? (detail.lead || item.summary) : updateSummary(item))}</p></section>` : ''}
            ${points.length ? `<section class="update-detail-section"><h2>${T('要点','Key points')}</h2><ul>${points.map(p => `<li>${escape(p)}</li>`).join('')}</ul></section>` : ''}
            ${sections.map(section => `
              <section class="update-detail-section">
                <h2>${escape(section.heading || '')}</h2>
                <p>${escape(section.body || '')}</p>
              </section>`).join('')}
          `}
          ${renderNatureIndexRankingsShell(detail)}
          ${reportUrl ? `
            <section class="update-report">
              <div class="update-report-info">
                <div>
                  <p class="updates-kicker">${T('报告来源','Report source')}</p>
                  <h2>${escape(report.title || detailTitle)}</h2>
                  <p>${[
                    report.pages ? `${report.pages} ${T('页','pages')}` : '',
                    formatFileSize(report.size_bytes),
                    report.file_id ? `File ID ${report.file_id}` : ''
                  ].filter(Boolean).map(escape).join(' · ')}</p>
                  ${report.source_note ? `<p class="muted-note">${escape(report.source_note)}</p>` : ''}
                  <div class="update-report-actions">
                    ${pdfUrl ? `<a href="${escape(pdfUrl)}" target="_blank" rel="noopener">${T('查看原 PDF','View PDF')}</a>` : ''}
                    ${report.download_url ? `<a href="${escape(report.download_url)}" target="_blank" rel="noopener">${T('下载 PDF','Download PDF')}</a>` : ''}
                    ${report.file_detail_url ? `<a href="${escape(report.file_detail_url)}" target="_blank" rel="noopener">${T('官方文件页','Official file page')}</a>` : ''}
                  </div>
                </div>
              </div>
            </section>` : ''}
          ${journalLinks.length ? `<section class="update-detail-section update-related-section"><h2>${T('相关期刊','Related journals')}</h2>${renderUpdateLinks(journalLinks)}</section>` : ''}
        </article>`;
      box.querySelector('[data-updates-back]')?.addEventListener('click', (e) => {
        e.preventDefault();
        activateTab('home');
      });
      hydrateNatureIndexRankings(box, detail);
    }

    // Monogram for the no-image banner: leading letters of an ASCII source, else first CJK chars.
    function updateBannerMark(item) {
      const name = String(updateSourceName(item) || item.category || '').trim();
      const ascii = name.match(/[A-Za-z0-9]+/);
      if (ascii) return ascii[0][0].toUpperCase();
      return name ? name.replace(/\s+/g, '')[0] : '•';
    }

    function shortUpdateText(value, max = 72) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      return text.length > max ? `${text.slice(0, max).replace(/[，。,.;；、\s]+$/g, '')}…` : text;
    }

    function updateCardBanner(item, sourceName) {
      const cat = item.category ? ` data-cat="${escape(item.category)}"` : '';
      const mark = updateBannerMark(item);
      return `<div class="update-card-image update-card-generated"${cat}>
        <div class="update-cover-main"><span class="update-card-ph-mark">${escape(mark)}</span><b>${escape(updateTitle(item))}</b></div>
      </div>`;
    }

    function renderUpdateCard(item, options = {}) {
      const isHome = !!options.home;
      const isBrief = !!options.brief;
      const dateHtml = item.published_at ? `<time datetime="${escape(item.published_at)}">${escape(formatUpdateDate(item.published_at))}</time>` : '';
      const sourceName = updateSourceName(item);
      const summary = updateSummary(item);
      const body = `
        ${updateCardBanner(item, sourceName)}
        ${!isBrief ? `<p class="update-card-summary">${escape(summary)}</p>` : ''}
        ${!isBrief ? `<div class="update-card-simple-meta">${dateHtml}<span>${escape(updateCategoryLabel(item.category))}</span></div>` : ''}`;
      const cls = `update-card${options.featured ? ' featured' : ''}${options.compact ? ' compact' : ''}${isHome ? ' home-compact' : ''}${isBrief ? ' brief' : ''}`;
      const detailPath = updateDetailPath(item);
      if (detailPath) {
        return `<a class="${cls}" href="${escape(detailPath)}" data-update-detail="${escape(item.id)}">${body}</a>`;
      }
      if (item.source_url) {
        return `<a class="${cls}" href="${escape(item.source_url)}" target="_blank" rel="noopener">${body}</a>`;
      }
      return `<article class="${cls}">${body}</article>`;
    }

    function attachUpdatesViewAll(root) {
      root?.querySelector('[data-updates-view-all]')?.remove();
    }

    function renderJournalUpdatesPreview() {
      if (!homeUpdatesPreview) return;
      homeUpdatesPreview.hidden = true;
      homeUpdatesPreview.innerHTML = '';
    }

    function renderJournalUpdates() {
      const box = $('#journal-updates');
      if (!box) return;
      document.body.classList.add('update-reading-mode');
      const detailItem = updateDetailItemFromPath();
      if (detailItem) {
        renderJournalUpdateDetail(detailItem);
        return;
      }
      const allItems = journalUpdates.items || [];
      const filtered = allItems.filter(item => journalUpdateMatches(item));
      const chipHtml = UPDATE_CATEGORY_KEYS.map(key => {
        const count = key === 'all' ? allItems.length : allItems.filter(item => item.category === key).length;
        return `<button class="update-chip ${activeUpdateCategory === key ? 'active' : ''}" type="button" data-update-category="${escape(key)}">
          <span>${escape(updateCategoryLabel(key))}</span><em>${count}</em>
        </button>`;
      }).join('');
      const updatedAt = journalUpdates.updated_at
        ? `<span>${escape(t('updates_updated_at'))}: ${escape(formatUpdateDate(journalUpdates.updated_at))}</span>`
        : '';
      box.innerHTML = `
        <div class="updates-page-head">
          <div>
            <h1>${escape(t('updates_title'))}</h1>
            <p>${escape(t('updates_intro'))}</p>
          </div>
          <div class="updates-page-meta">${updatedAt}</div>
        </div>
        <div class="update-chips" aria-label="${escape(t('updates_title'))}">
          ${chipHtml}
        </div>
        ${filtered.length ? `
          <section class="updates-list" aria-label="${escape(t('updates_latest'))}">
            ${filtered.map(item => renderUpdateCard(item, { compact: true })).join('')}
          </section>
        ` : `<div class="updates-empty">${escape(t('updates_empty'))}</div>`}`;
      box.querySelectorAll('[data-update-category]').forEach(btn => {
        btn.addEventListener('click', () => {
          activeUpdateCategory = btn.dataset.updateCategory || 'all';
          renderJournalUpdates();
        });
      });
      box.querySelectorAll('[data-update-detail]').forEach(link => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');
          if (!href || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          history.pushState({ tab: 'updates' }, '', href);
          renderJournalUpdates();
          updatePageSeo('updates');
        });
      });
    }

    window.addEventListener('ailatest:langchange', () => {
      if (activeTab === 'home') {
        if (activeQuery) renderHomeIntResults();
      }
    });

    // Also sync topbar search when on home tab
    const origSearchHandler = $('#q')?.addEventListener;
    // (the existing #q listener already handles this for int/dom/fav)

    function activateTab(tab, opts = {}) {
      if (!TAB_PATHS[tab]) tab = 'home';
      // 地区站权益：Free 每日 3 次临时查看；Pro 固定 2 个自定义；Max 全部
      if (REGION_STATION_IDS.includes(tab) && !opts.skipRegionGate) {
        if (!canAccessRegionStation(tab)) {
          showRegionPaywallModal('daily');
          return;
        }
        if (!consumeRegionViewIfNeeded(tab)) return;
      }
      const previousTab = activeTab;
      const changingTab = previousTab !== tab;
      if (changingTab) tabScrollPositions.set(previousTab, window.scrollY);
      if (!opts.keepWarnList) activeWarnList = false; // 切换标签默认退出预警名单
      // ── 切换前：把当前搜索框的值存到 activeQuery（仅非选刊tab）──
      const prevTab = activeTab;
      if (prevTab !== 'pick') {
        const qEl = $('#q');
        if (qEl) {
          if (prevTab === 'updates') activeUpdateQuery = qEl.value.trim();
          else activeQuery = qEl.value.trim();
        }
      }

      // 设置页：磨砂浮层（桌面）/ 全屏两级（手机），底层页面保持可见
      if (tab === 'me') {
        if (previousTab && previousTab !== 'me') window.__settingsReturnTab = previousTab;
        $$('[data-tab]').forEach(x => x.classList.toggle('active', x.dataset.tab === 'me'));
        activeTab = 'me';
        if (document.body.dataset.bootTab) delete document.body.dataset.bootTab;
        document.body.classList.add('settings-open');
        document.documentElement.classList.add('settings-open');
        document.body.classList.remove('simple-top-route', 'fav-route', 'topbar-compact');
        // 手机：默认进一级全屏设置列表（勿直接 subpage，否则像「打不开」）
        if (window.matchMedia('(max-width: 900px)').matches && !opts.settingsSection) {
          window.__settingsOpenAsRoot = true;
          _settingsSection = 'account';
        } else if (opts.settingsSection) {
          _settingsSection = opts.settingsSection;
          window.__settingsOpenAsRoot = false;
        }
        const mePanel = document.querySelector('.tab-panel[data-panel="me"]');
        if (mePanel) {
          mePanel.hidden = false;
          mePanel.removeAttribute('hidden');
          mePanel.style.display = 'flex';
          mePanel.style.visibility = 'visible';
          mePanel.style.pointerEvents = 'auto';
        }
        if (!opts.skipPath) {
          const nextPath = TAB_PATHS.me || '/account';
          if (normalizeAppPath(location.pathname) !== normalizeAppPath(nextPath)) {
            try { history.pushState({ tab: 'me' }, '', nextPath + location.search + location.hash); }
            catch (_) {}
          }
        }
        updatePageSeo('me');
        applyI18n();
        updateAccountCreditBadge();
        renderMe();
        $('.app-rail')?.classList.remove('mobile-open');
        $('#sidebar-scrim')?.classList.remove('on');
        return;
      }

      // 离开设置时关掉浮层
      document.body.classList.remove('settings-open');
      document.documentElement.classList.remove('settings-open');

      // 先切面板 / 路由壳，再关详情页，避免 journal-route 卸掉后短暂露出首页
      $$('[data-tab]').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
      activeTab = tab;
      // 首屏 boot-tab 防闪用完即清，之后交给 .hidden 控制
      if (document.body.dataset.bootTab) delete document.body.dataset.bootTab;
      document.body.classList.toggle('update-reading-mode', activeTab === 'updates');
      document.body.classList.toggle('home-route', activeTab === 'home');
      // 仅「动态」用无搜索简洁顶栏；收藏与各站统一全球站紧凑搜索顶栏
      document.body.classList.toggle('simple-top-route', activeTab === 'updates');
      document.body.classList.toggle('fav-route', activeTab === 'fav');
      updateStickySearchState();
      placeLangToggle();
      updateSearchSubmitLabel();
      $$('.tab-panel').forEach(p => {
        const on = p.dataset.panel === activeTab;
        p.hidden = !on;
        // 清掉 boot-tab 的 display:block/none，避免与 hidden 打架
        p.style.display = '';
      });
      if (document.body.classList.contains('journal-route')) {
        _drawerStack = [];
        closeDrawer(true);
      }
      if (changingTab) window.scrollTo(0, tabScrollPositions.get(activeTab) || 0);
      $$('[data-international]').forEach(el => el.hidden = activeTab !== 'int');
      $$('[data-domestic]').forEach(el => el.hidden = activeTab !== 'dom');
      // Sidebar 筛选：全球 + 各地区站统一显示；首页/收藏/荐刊/榜单/账户隐藏
      const sidebar = $('#sidebar');
      if (sidebar) {
        const showSidebar = activeTab === 'int'
          || activeTab === 'dom'
          || activeTab === 'in'
          || activeTab === 'my'
          || activeTab === 'kr'
          || Boolean(REGIONAL_DIRECTORY_CONFIG[activeTab]);
        sidebar.style.display = showSidebar ? '' : 'none';
      }
      // 统一搜索框 #q：更新 placeholder 和内容
      const qEl = $('#q');
      if (qEl) {
        // 选刊tab：清空内容，独立于其他tab
        if (activeTab === 'pick') {
          qEl.value = '';
        } else if (activeTab === 'updates') {
          qEl.value = activeUpdateQuery || '';
        } else {
          qEl.value = activeQuery || '';
        }
        qEl.maxLength = 200;
        if (activeTab === 'pick') {
          qEl.placeholder = t('pick_placeholder');
        } else if (activeTab === 'home') {
          qEl.placeholder = t('search_home_ph');
        } else if (activeTab === 'fav') {
          qEl.placeholder = t('search_fav');
        } else if (activeTab === 'updates') {
          qEl.placeholder = t('search_updates_ph');
        } else if (activeTab === 'in') {
          qEl.placeholder = T('搜索：印度期刊名 / 出版社 / ISSN / 学科', 'Search: India journal title / publisher / ISSN / subject');
        } else if (activeTab === 'kr') {
          qEl.placeholder = T('搜索韩国期刊', 'Search Korea journals');
        } else if (REGIONAL_DIRECTORY_CONFIG[activeTab]) {
          qEl.placeholder = T('搜索：期刊名 / ISSN / 目录指标', 'Search: journal title / ISSN / directory metric');
        } else {
          qEl.placeholder = t(activeTab === 'dom' ? 'search_dom' : 'search_int');
        }
      }
      // Reset home UI state when switching away
      if (activeTab !== 'home') {
        const results = $('#home-results');
        const subtabs = $('#home-subtabs');
        const hero = $('.home-hero');
        const preview = $('#home-updates-preview');
        const chips = $('#home-search-chips');
        if (results) results.hidden = true;
        if (subtabs) subtabs.hidden = true;
        if (preview) preview.hidden = true;
        if (chips) chips.hidden = true;
        if (hero) hero.closest('.tab-panel')?.classList.remove('home-tab-has-results');
      }
      if (!opts.skipPath) {
        const nextPath = TAB_PATHS[activeTab] || '/';
        if (normalizeAppPath(location.pathname) !== normalizeAppPath(nextPath)) {
          try { history.pushState({ tab: activeTab }, '', nextPath + location.search + location.hash); }
          catch (_) {}
        }
      }
      updatePageSeo(activeTab);
      applyI18n(); // refresh placeholder
      updateFavCount();
      updateAccountCreditBadge();
      syncHomeModeTabs();
      if (['int', 'fav', 'pick'].includes(activeTab) && !journalsReady) {
        const hint = $('#hint');
        // 全球列表：light 库（~3MB）字段已够表格首屏；勿卡在 full（~9MB）下载上，否则慢网表现为「列表一直不出来」
        if (activeTab === 'int' && journals.length) {
          try { renderInt(); } catch (err) { console.error(err); }
          if (hint) {
            hint.textContent = `${T('已加载','Loaded')} ${(meta?.total || journals.length).toLocaleString()} ${T('本期刊','journals')} · ${T('完整库后台加载中…','Full database loading…')}`;
          }
          ensureJournalsLoaded()
            .then(() => renderAfterFullJournalLoad(activeTab))
            .catch(err => {
              if (hint) hint.textContent = `${T('已加载','Loaded')} ${journals.length.toLocaleString()} ${T('本期刊','journals')} · full: ${err.message}`;
              console.error(err);
            });
          return;
        }
        if (hint) hint.textContent = T('正在加载完整期刊库…', 'Loading full journal database…');
        ensureJournalsLoaded()
          .then(() => renderAfterFullJournalLoad(activeTab))
          .catch(err => {
            if (hint) hint.textContent = 'Load failed: ' + err.message;
            console.error(err);
          });
        return;
      }
      const activePanel = document.querySelector(`.tab-panel[data-panel="${activeTab}"]`);
      const renderKey = `${lang}\n${activeQuery}`;
      const reusePanel = !opts.forceRender
        && reusableTabPanels.has(activeTab)
        && activePanel?.dataset.renderKey === renderKey;
      if (!reusePanel) {
        if (activeTab === 'dom') renderDomestic();
        else if (activeTab === 'fav') renderFav();
        else if (activeTab === 'me') renderMe();
        else if (activeTab === 'int') renderInt();
        else if (activeTab === 'in') renderIndia();
        else if (activeTab === 'my') renderMalaysia();
        else if (activeTab === 'kr') renderKorea();
        else if (REGIONAL_DIRECTORY_CONFIG[activeTab]) renderRegionalDirectory(activeTab);
        else if (activeTab === 'updates') renderJournalUpdates();
        else if (activeTab === 'pick') initPickTool();
        // Home tab: if there's an active query, show results
        else if (activeTab === 'home' && activeQuery) {
          showHomeSearchResults();
        } else if (activeTab === 'home') {
          showHomeSearchResults();
        }
        if (reusableTabPanels.has(activeTab) && activePanel) {
          activePanel.dataset.renderKey = renderKey;
        }
      }
      renderHomeSearchChips();
      updateStickySearchState();
    }
    window.__activateJournalTab = activateTab;
    function showWarningRankList() {
      [activeIndices, activeJcr, activeZones, activeXr, activeAbdc, activeAbs, activeTopics, activeFeats].forEach(s => s.clear());
      activeWarnList = true;
      activeCat = '__all';
      activeQuery = '';
      const qEl = document.getElementById('q');
      if (qEl) qEl.value = '';
      shown = PAGE;
      activateTab('int', { keepWarnList: true });
      renderInt();
      syncThChkState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 榜单：回首页并滚到 #rankings（二级页 /indexes · /subjects 仍整页打开）
    function openHomeRankings(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (typeof window.__activateJournalTab === 'function') window.__activateJournalTab('home', { push: true });
      else activateTab('home', { push: true });
      requestAnimationFrame(() => {
        document.getElementById('rankings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
          if (normalizeAppPath(location.pathname) === '/' || normalizeAppPath(location.pathname) === '/rankings') {
            history.replaceState(history.state || {}, '', '/#rankings');
          }
        } catch (_) {}
      });
    }
    document.getElementById('rankings-btn')?.addEventListener('click', openHomeRankings);
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('a#rankings-btn, a.rail-nav-btn[href="/rankings/"], a.rail-nav-btn[href="/rankings"], a[href="/rankings"], a[href="/rankings/"]');
      if (!a) return;
      if (!document.querySelector('.tab-panel[data-panel="home"]')) return;
      openHomeRankings(e);
    }, true);
    document.querySelector('[data-topbar-home]')?.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab('home');
    });
    $('#topbar-lang-proxy')?.addEventListener('click', () => $('#lang-toggle')?.click());
    (function initRegionPicker() {
      const picker = document.querySelector('.rail-region-picker');
      const toggle = document.getElementById('region-toggle');
      if (!picker || !toggle) return;
      const menu = picker.querySelector('.rail-region-menu');
      const close = () => {
        if (menu?.parentElement === document.body) picker.appendChild(menu);
        menu?.classList.remove('portal-open');
        picker.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      };
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = !picker.classList.contains('open');
        picker.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && menu && window.matchMedia('(max-width: 900px)').matches) {
          menu.classList.add('portal-open');
          document.body.appendChild(menu);
        } else if (!open) {
          close();
        }
      });
      menu?.querySelectorAll('[data-region-pin]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = btn.dataset.regionPin;
          if (!id) return;
          const ent = regionEntitlements();
          const wasPinned = getPinnedRegions().includes(id);

          // Free：不能固定自定义地区 → 临时打开（计每日次数），不进侧栏
          if (!ent.unlockAll && ent.maxCustomPins === 0 && !FREE_BASE_REGION_IDS.includes(id)) {
            activateTab(id);
            close();
            return;
          }

          // 已固定 → 再次点击取消侧栏常驻（收进 ···）
          if (wasPinned) {
            togglePinnedRegion(id);
            applyStations();
            close();
            return;
          }

          // 未固定 → 固定到侧栏并打开（Max 也只钉这一项，不全挂）
          const ok = togglePinnedRegion(id);
          if (ok && getPinnedRegions().includes(id)) {
            activateTab(id, { skipRegionGate: true });
          }
          applyStations();
          close();
        });
      });
      document.addEventListener('click', (e) => {
        if (!picker.contains(e.target) && !menu?.contains(e.target)) close();
      });
      window.addEventListener('resize', close);
    })();

    // Home entry pills → switch tab（设置入口单独处理，避免与登录门禁双绑）
    document.querySelectorAll('.home-pill[data-tab], .rail-nav-btn[data-tab], .page-brand[data-tab], .rail-brand-mobile[data-tab]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.preventDefault();
        // 账号/设置按钮：交给 #account-credit-badge 专用逻辑
        if (b.id === 'account-credit-badge' || b.dataset.tab === 'me') {
          e.stopPropagation();
          openSettingsFromRail();
          return;
        }
        activateTab(b.dataset.tab);
        if (window.matchMedia('(max-width: 900px)').matches) closeSidebar();
      });
    });
    // Process any clicks that happened before boot() finished
    if (window.__journalTabQueue) {
      window.__journalTabQueue.forEach(t => activateTab(t));
      window.__journalTabQueue = null;
    }
    $$('.tab[data-tab]').forEach(b => b.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab(b.dataset.tab);
    }));
    $$('[data-home-mode]').forEach(b => b.addEventListener('click', (e) => {
      e.preventDefault();
      // 点当前模式 → 提交；点另一侧 → 切换（有输入则直接按新模式提交）
      setHomeMode(b.dataset.homeMode, { fromClick: true });
    }));
    window.addEventListener('popstate', () => {
      if (renderJournalRoutePage()) return;
      activateTab(tabFromPath(), { skipPath: true });
    });

    // Favorites header link → <a href="#fav"> works natively, hashchange handled below

    // ─── 国内导航 ───
    $('#dom-content')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dom-switch]');
      if (!btn) return;
      activeDom = btn.dataset.domSwitch;
      window.__cnkiShown = 100;
      window.__cnkxShown = 100;
      window.__cscdShown = 100;
      window.__cstpcdShown = 100;
      renderDomestic();
    });

    document.querySelectorAll('[data-domestic] .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('[data-domestic] .nav-item').forEach(n => n.classList.remove('active'));
        btn.classList.add('active');
        activeDom = btn.dataset.dom;
        window.__cscdShown = 100;
        window.__cstpcdShown = 100;
        renderDomestic();
      });
    });

    // ─── 国内徽章筛选（CSSCI/北大核心/CCF）───
    $('#domestic-badge-toggles')?.addEventListener('change', (e) => {
      const cb = e.target.closest('input[type=checkbox]');
      if (!cb) return;
      const val = cb.value;
      if (cb.checked) activeDomBadges.add(val);
      else activeDomBadges.delete(val);
      renderDomestic();
    });

    // 设置页语言芯片：全局委托（避免 renderMe 重绑时机问题）
    if (!document.__langChipDelegateBound) {
      document.__langChipDelegateBound = true;
      document.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-set-lang]');
        if (!chip) return;
        // 仅处理设置面板内的芯片，避免误触
        if (!chip.closest('#me-content') && !chip.closest('.settings-panel')) return;
        e.preventDefault();
        e.stopPropagation();
        const code = chip.getAttribute('data-set-lang');
        if (!code) return;
        _settingsSection = 'language';
        setUiLanguage(code);
      }, true);
    }

    // ─── 语言切换：只保留中文 / English，一次点击直接切换 ───
    (function initLangToggle() {
      const btn = $('#lang-toggle');
      if (!btn || btn.__langToggleBound) return;
      btn.__langToggleBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setUiLanguage(lang === 'zh-CN' ? 'en' : 'zh-CN');
      });
    })();
  // ──── favorite star delegation (国际 + 国内全覆盖) ────
    let activePicker = null;
    function closeFavPicker() {
      if (activePicker) { activePicker.remove(); activePicker = null; }
    }
    document.addEventListener('click', (e) => {
      // Close picker if clicking outside
      if (activePicker && !e.target.closest('.fav-picker') && !e.target.closest('.fav-star')) {
        closeFavPicker();
      }
      const btn = e.target.closest('.fav-star'); if (!btn) return;
      e.stopPropagation();
      const fid = btn.dataset.fav;
      const src = btn.dataset.favSrc || 'int';
      const rec = rowRecordsByFid[fid]
        || journals.find(r => favId(r) === fid)
        || favsData[fid];
      if (!rec) return;

      // Only 1 list → direct toggle (old behavior)
      if (favLists.length <= 1) {
        toggleFav(rec, { src });
        btn.classList.toggle('on');
        btn.textContent = btn.classList.contains('on') ? '★' : '☆';
        if (activeTab === 'fav') renderFav();
        return;
      }
      // Multiple lists → show picker popover (toggle per list, stays open)
      closeFavPicker();
      const picker = document.createElement('div');
      picker.className = 'fav-picker';
      function renderPickerItems() {
        return favLists.map(l => {
          const has = l.ids.includes(fid);
          return `<div class="fav-picker-item ${has?'active':''}" data-list-id="${escape(l.id)}">
            <span class="check">${has ? '✓' : ''}</span>
            <span>${escape(favListDisplayName(l))} (${l.ids.length})</span>
          </div>`;
        }).join('');
      }
      picker.innerHTML = renderPickerItems() + `<div class="fav-picker-new">＋ ${T('新建清单','New list')}</div>`;
      // Position near the button
      const rect = btn.getBoundingClientRect();
      picker.style.position = 'fixed';
      picker.style.top = (rect.bottom + 4) + 'px';
      picker.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
      document.body.appendChild(picker);
      activePicker = picker;
      // Picker item click → toggle that specific list
      picker.querySelectorAll('.fav-picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const listId = item.dataset.listId;
          const list = favLists.find(l => l.id === listId);
          if (!list) return;
          const idx = list.ids.indexOf(fid);
          if (idx >= 0) {
            list.ids.splice(idx, 1);
            if (!favLists.some(l => l.ids.includes(fid))) delete favsData[fid];
          } else {
            list.ids.push(fid);
            favsData[fid] = { ...rec, __src: src, __savedAt: Date.now() };
          }
          localStorage.setItem(STORAGE_PREFIX + 'favsData', JSON.stringify(favsData));
          // rebuild flat union for star
          const union = new Set();
          favLists.forEach(l => l.ids.forEach(id => union.add(id)));
          favs = union;
          localStorage.setItem(STORAGE_PREFIX + 'favs', JSON.stringify([...union]));
          // update visual
          const nowInList = list.ids.includes(fid);
          item.classList.toggle('active', nowInList);
          const checkSpan = item.querySelector('.check');
          if (checkSpan) checkSpan.textContent = nowInList ? '✓' : '';
          // update counts in all items
          picker.querySelectorAll('.fav-picker-item').forEach(pi => {
            const li = favLists.find(l => l.id === pi.dataset.listId);
            if (li) {
              const nameSpan = pi.querySelector('span:last-child');
              if (nameSpan) nameSpan.textContent = `${favListDisplayName(li)} (${li.ids.length})`;
            }
          });
          // update star on page
          const inAnyList = allFavIds().has(fid);
          btn.classList.toggle('on', inAnyList);
          btn.textContent = inAnyList ? '★' : '☆';
          // persist + sync
          persistFavLists();
          updateFavCount();
          if (activeTab === 'fav') renderFav();
          // keep picker open — user can keep toggling
        });
      });
      picker.querySelector('.fav-picker-new')?.addEventListener('click', () => {
        closeFavPicker();
        const name = prompt(T('新清单名称：','New list name:'), T('新清单','New list'));
        if (name && name.trim()) {
          const newId = createList(name.trim());
          const list = favLists.find(l => l.id === newId);
          if (list) {
            list.ids.push(fid);
            favsData[fid] = { ...rec, __src: src, __savedAt: Date.now() };
            localStorage.setItem(STORAGE_PREFIX + 'favsData', JSON.stringify(favsData));
            persistFavLists();
            updateFavCount();
          }
          btn.classList.add('on');
          btn.textContent = '★';
          if (activeTab === 'fav') renderFav();
        }
      });
    });

    // 行点击 → 详情抽屉
    document.addEventListener('click', (e) => {
      if (e.target.closest('.fav-star')) return;
      if (e.target.closest('.drag-handle')) return;
      if (e.target.closest('.vhb-details')) return;
      const row = e.target.closest('.j-row.clickable'); if (!row) return;
      const fid = row.dataset.fid;
      if (row.dataset.src === 'int' && !journalsReady) {
        ensureJournalsLoaded()
          .then(() => {
            const live = journals.find(r => favId(r) === fid) || rowRecordsByFid[fid] || favsData[fid];
            if (live) openDrawer(live, { pageMode: true, source: journalOpenSource() });
          })
          .catch(err => console.error(err));
        return;
      }
      const rec = rowRecordsByFid[fid] || journals.find(r => favId(r) === fid) || favsData[fid];
      if (rec) openDrawer(rec, { pageMode: true, source: journalOpenSource() });
    });
    $('#drawer-close')?.addEventListener('click', () => {
      if (document.body.classList.contains('journal-route')) {
        const backTab = _drawerSourceTab || 'int';
        const backPath = TAB_PATHS[backTab] || '/global';
        try { history.pushState({ tab: backTab }, '', backPath); } catch (_) {}
        closeDrawer(true);
        activateTab(backTab, { skipPath: true });
        return;
      }
      closeDrawer();
    });
    $('#drawer-back')?.addEventListener('click', () => {
      const prev = _drawerStack.pop();
      if (prev) openDrawer(prev, { pageMode: document.body.classList.contains('journal-route') });
    });
    $('#drawer-scrim')?.addEventListener('click', () => closeDrawer());
    // 复制当前期刊的分享链接 + 生成卡片图片
    $('#drawer-share')?.addEventListener('click', () => {
      if (!_currentDrawerRec) return;
      showJournalShareModal(_currentDrawerRec);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.body.classList.contains('settings-open')) closeSettingsShell();
        else { closeDrawer(); closeSidebar(); }
      }
    });

    function closeSidebar() {
      $('#sidebar').classList.remove('open');
      $('.app-rail')?.classList.remove('mobile-open');
      $('#sidebar-scrim').classList.remove('on');
    }

    // 侧栏切换
    $('#side-toggle')?.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 900px)').matches) {
        $('.app-rail')?.classList.toggle('mobile-open');
      } else {
        $('#sidebar').classList.toggle('open');
      }
      $('#sidebar-scrim').classList.toggle('on');
      $('#sidebar-scrim').hidden = false;
    });
    $('#rail-close-mobile')?.addEventListener('click', closeSidebar);
    $('#sidebar-scrim')?.addEventListener('click', () => {
      $('#sidebar').classList.remove('open');
      $('.app-rail')?.classList.remove('mobile-open');
      $('#sidebar-scrim').classList.remove('on');
    });
  
    // auth
    $('#auth-btn')?.addEventListener('click', () => {
      if (user) {
        if (confirm(T('退出登录？','Sign out?'))) doLogout();
      } else {
        startLogin();
      }
    });
    function openSettingsFromRail() {
      // 访客也可进设置（语言 / 版本等）；登录只在账号操作时需要
      try {
        if (window.matchMedia('(max-width: 900px)').matches) {
          window.__settingsOpenAsRoot = true;
        }
        activateTab('me', { push: true });
      } catch (err) {
        console.error('[settings] open failed', err);
        // 兜底：直接开壳
        try { openSettingsShell(); } catch (_) {}
      }
      if (window.matchMedia('(max-width: 900px)').matches) {
        try { closeSidebar(); } catch (_) {}
      }
    }
    $('#account-credit-badge')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSettingsFromRail();
    });
    $('#account-credit-badge')?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openSettingsFromRail();
    });

    // 边缘滑动返回：左缘 → 右滑 / 右缘 → 左滑
    (function installEdgeBackGestures() {
      let tracking = false;
      let edge = '';
      let startX = 0;
      let startY = 0;
      const EDGE = 28;
      const THRESH = 72;
      function goBackLayer() {
        if (document.body.classList.contains('settings-open')) {
          closeSettingsShell();
          return;
        }
        if (drawerOpen && !document.body.classList.contains('journal-route')) {
          closeDrawer();
          return;
        }
        if ($('.app-rail')?.classList.contains('mobile-open')) {
          closeSidebar();
          return;
        }
        if (document.body.classList.contains('journal-route')) {
          $('#drawer-back')?.click();
        }
      }
      document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        if (x <= EDGE) { tracking = true; edge = 'left'; startX = x; startY = y; }
        else if (x >= window.innerWidth - EDGE) { tracking = true; edge = 'right'; startX = x; startY = y; }
        else tracking = false;
      }, { passive: true });
      document.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = Math.abs(t.clientY - startY);
        if (dy > 90) return;
        if (edge === 'left' && dx > THRESH) goBackLayer();
        if (edge === 'right' && dx < -THRESH) goBackLayer();
      }, { passive: true });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('settings-open')) {
          e.preventDefault();
          closeSettingsShell();
        }
      });
    })();
  }

  // ───────── pick-for-me (journal recommendation) ─────────
  let _pickInit = false;
  let _runPickSearch = null;

  async function submitPickSearchFromTopbar(query) {
    const value = String(query || '').trim();
    const input = $('#q');
    if (!value) {
      input?.focus();
      return;
    }
    if (activeTab !== 'pick') {
      const activate = window.__activateJournalTab;
      if (typeof activate === 'function') activate('pick');
    }
    const qEl = $('#q');
    if (qEl) qEl.value = value;
    try {
      if (!journalsReady) {
        const hint = $('#hint');
        if (hint) hint.textContent = T('正在加载完整期刊库…', 'Loading full journal database…');
        await ensureJournalsLoaded();
        renderAfterFullJournalLoad('pick');
      } else {
        initPickTool();
      }
      const qElAfterLoad = $('#q');
      if (qElAfterLoad) qElAfterLoad.value = value;
      if (_runPickSearch) await _runPickSearch();
    } catch (err) {
      const results = $('#pick-results');
      if (results) {
        results.innerHTML = `<div class="pick-no-results">${escape(T('荐刊功能暂时不可用，请稍后重试。', 'Journal recommendation is temporarily unavailable. Please try again later.'))}</div>`;
      }
      const status = $('#pick-status');
      if (status) status.textContent = err?.message || String(err || '');
      console.error(err);
    }
  }

  function initPickTool() {
    if (_pickInit) return;
    _pickInit = true;

    const input = $('#q');
    const results = $('#pick-results');
    const status = $('#pick-status');
    const progress = $('#pick-progress');
    const progressBar = $('#pick-progress-bar');
    const progressPct = $('#pick-progress-pct');
    const charCount = $('#pick-char-count');
    const aiLogin = $('#pick-ai-login');

    function syncPickAiLogin(visible) {
      if (!aiLogin) return;
      aiLogin.hidden = !visible;
      aiLogin.textContent = T('登录后启用 AI', 'Sign in to enable AI');
    }

    aiLogin?.addEventListener('click', () => startLogin());
    syncPickAiLogin(false);

    function setPickProgress(text, pct = 0, visible = true) {
      if (progress) progress.hidden = !visible;
      if (status) status.textContent = text || '';
      const n = Math.max(0, Math.min(100, Math.round(pct || 0)));
      if (progressBar) progressBar.style.width = `${n}%`;
      if (progressPct) progressPct.textContent = `${n}%`;
    }

    function updatePickCharCount() {
      if (!input || !charCount) return;
      const max = parseInt(input.getAttribute('maxlength') || '200', 10);
      const len = input.value.length;
      charCount.textContent = `${len} / ${max}`;
      charCount.classList.toggle('near', len >= Math.floor(max * 0.85) && len < max);
      charCount.classList.toggle('limit', len >= max);
    }
    input?.addEventListener('input', updatePickCharCount);
    updatePickCharCount();
    let pickLastQuery = '';
    let pickJournalLookup = null;
    let pickLastReportState = null;

    // Report rows use the same journal IDs as the normal cards, but a direct
    // click handler keeps them reliable even when the hash route is changing
    // while the full journal bundle is still hydrating.
    function bindPickReportLinks(root = results) {
      if (!root) return;
      root.querySelectorAll('a[data-pick-report-fid]').forEach((link) => {
        if (link.dataset.pickReportBound === '1') return;
        link.dataset.pickReportBound = '1';
        link.addEventListener('click', (ev) => {
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1) return;
          const fid = link.dataset.pickReportFid || '';
          const rec = rowRecordsByFid[fid] || findRecByFid(fid);
          if (!rec) return; // preserve the hash fallback for unresolved names
          ev.preventDefault();
          openDrawer(rec, { pageMode: true, source: 'recommendation' });
        });
      });
    }

    function refreshRenderedPickReport() {
      if (!results || !pickLastReportState) return;
      const html = renderPickAiReport(
        pickLastReportState.report,
        pickLastReportState.profile,
        pickLastReportState.fallbackEntries
      );
      const current = results.querySelector('.pick-report');
      if (current && html) current.outerHTML = html;
      else if (current) current.remove();
      else if (html) results.insertAdjacentHTML('afterbegin', html);
      bindPickReportLinks();
    }
    window.__refreshPickReportI18n = refreshRenderedPickReport;

    function pickFiltersPayload() {
      const indices = [];
      if (document.getElementById('pick-filter-sci')?.checked) indices.push('SCIE');
      if (document.getElementById('pick-filter-ssci')?.checked) indices.push('SSCI');
      if (document.getElementById('pick-filter-ahci')?.checked) indices.push('AHCI');
      if (document.getElementById('pick-filter-esci')?.checked) indices.push('ESCI');
      return {
        indices,
        exclude_multidisciplinary: !!document.getElementById('pick-filter-comprehensive')?.checked,
        free: !!(canSeePublishFeeInfo() && document.getElementById('pick-filter-free')?.checked),
      };
    }

    function ensurePickJournalLookup() {
      if (pickJournalLookup) return pickJournalLookup;
      const map = new Map();
      for (const r of journals || []) {
        [r.issn, r.eissn, r.slug, favId(r), r.name].filter(Boolean).forEach(v => {
          map.set(String(v).toLowerCase(), r);
          const compact = compactIssnKey(v);
          if (compact) map.set(compact.toLowerCase(), r);
        });
      }
      pickJournalLookup = map;
      return map;
    }

    function resolvePickJournal(item) {
      const map = ensurePickJournalLookup();
      const keys = [item.issn, item.eissn, item.slug, item.name].filter(Boolean);
      for (const key of keys) {
        const direct = map.get(String(key).toLowerCase());
        if (direct) return direct;
        const compact = compactIssnKey(key);
        if (compact && map.get(compact.toLowerCase())) return map.get(compact.toLowerCase());
      }
      return null;
    }

    async function fetchAiPick(query) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      // 单次 DeepSeek + 本地排序，通常 3–8s；15s 超时避免长时间卡住
      const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
      const request = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user && user.token ? { 'Authorization': `Bearer ${user.token}` } : {}),
        },
        ...(controller ? { signal: controller.signal } : {}),
        body: JSON.stringify({
          query,
          filters: pickFiltersPayload(),
          limit: 80,
          language: pickReportLang(),
          locale: lang,
          ai_report: false, // 默认跳过第二次大模型润色，换速度
        }),
      };
      let res;
      try {
        res = await fetch(`${API_BASE}/pick`, request);
      } catch (err) {
        const fallbackBase = 'https://api.ailatest.org';
        if (API_BASE === fallbackBase) throw err;
        res = await fetch(`${fallbackBase}/pick`, request);
      } finally {
        if (timer) clearTimeout(timer);
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok === false) {
        const msg = data?.error || data?.message || `HTTP ${res.status}`;
        const error = new Error(msg);
        error.status = res.status;
        error.data = data;
        throw error;
      }
      return data;
    }

    function aiEntriesFromResults(data) {
      const profile = data?.profile || {};
      return (data?.results || []).map(item => {
        const r = resolvePickJournal(item);
        const rec = r || {
          name: item.name,
          issn: item.issn,
          eissn: item.eissn,
          slug: item.slug,
          if_2024: item.if_2024,
          if_quartile: item.if_quartile,
          cas_zone: item.cas_zone,
          cas_top: item.cas_top,
          indices: item.indices || [],
          publisher: item.publisher || '',
          wos_categories: item.topics || [],
          doaj: item.doaj || null,
        };
        const issn = rec.issn || rec.eissn || item.issn || item.eissn || item.slug || item.name;
        return {
          journalRec: rec,
          issn,
          zone: rec.cas_zone || item.cas_zone,
          top: !!(rec.cas_top || item.cas_top),
          jcr_q: rec.if_quartile || item.if_quartile,
          indices: rec.indices || item.indices || [],
          wos_categories: rec.wos_categories || item.topics || [],
          topics: item.topics || profile.wos_categories || [],
          matched: item.matched || profile.domain_keywords || [],
          count: Math.max(1, (item.matched || []).length || (profile.domain_keywords || []).length || 1),
          score: Math.max(0.01, Number(item.score || 1) / 100),
          srcName: rec.name || item.name,
          semanticProfile: profile,
        };
      });
    }

    function pickAiErrorMessage(error) {
      const msg = String(error?.message || error?.data?.error || '');
      const detail = String(error?.data?.detail || '');
      const code = String(error?.data?.code || error?.data?.error || '').toLowerCase();
      if (code === 'ai_key_missing' || /ai service not configured|deepseek_api_key missing/i.test(msg + detail)) {
        return t('pick_ai_config_error');
      }
      if (code === 'deepseek_auth_failed' || /deepseek\s+(401|403)|invalid.*key|authentication|unauthorized/i.test(msg + detail)) {
        return t('pick_ai_deepseek_auth_error');
      }
      if (code === 'ai_unavailable') return t('pick_ai_unavailable');
      if (error?.status === 401 || error?.status === 403) {
        doLogout();
        return t('pick_ai_auth_error');
      }
      if (error?.data?.code === 'ai_locked') return t('pick_ai_locked');
      if (error?.data?.code === 'insufficient_credits') return t('pick_ai_credits_error');
      if (error?.status === 429) return t('pick_ai_quota_error');
      if (error?.name === 'AbortError') {
        return T('AI 分析超时，已改用本地匹配。','AI analysis timed out; switched to local matching.');
      }
      if (error?.status === 503) return t('pick_ai_unavailable');
      if (error instanceof TypeError && /fetch|network/i.test(msg)) {
        return T('AI 推荐网络请求失败（请检查网络或代理），已自动改用本地匹配。','AI request failed at network level (check connection/proxy); switched to local matching.');
      }
      return t('pick_ai_unavailable');
    }

    function pickNormText(value) {
      return String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function pickUnique(values, max = 16) {
      const out = [];
      const seen = new Set();
      for (const value of values || []) {
        const raw = String(value || '').trim();
        const key = pickNormText(raw);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(raw);
        if (out.length >= max) break;
      }
      return out;
    }

    function pickIsZhLang() {
      return lang === 'zh-CN' || lang === 'zh-TW';
    }

    function pickReportLang() {
      return pickIsZhLang() ? 'zh' : 'en';
    }

    function pickHasCjk(value) {
      return /[\u3400-\u9fff\uf900-\ufaff]/.test(String(value || ''));
    }

    function pickReadableField(value) {
      const raw = String(value || '').replace(/\s+/g, ' ').trim();
      if (!raw || pickIsZhLang() || pickHasCjk(raw)) return raw;
      return raw.replace(/\b([a-z])/g, m => m.toUpperCase());
    }

    function pickMetricIf(r) {
      return r && r.if_2024 != null && r.if_2024 !== '' ? (+r.if_2024).toFixed(1) : '';
    }

    function pickMetricCas(r) {
      if (!r || !r.cas_zone) return '';
      return `${r.cas_zone}${T('区','')}${r.cas_top ? ' TOP' : ''}`;
    }

    function pickDoajApcText(r) {
      const doaj = r && typeof r.doaj === 'object' ? r.doaj : null;
      if (!doaj) return '';
      const apc = String(doaj.apc || '').trim();
      const fee = String(doaj.fee || '').trim();
      if (!apc && !fee) return '';
      if (/^no$/i.test(apc)) return T('免费（DOAJ）','Free (DOAJ)');
      if (fee) return fee;
      if (/^yes$/i.test(apc)) return T('有 APC（DOAJ）','APC listed (DOAJ)');
      return apc;
    }

    function pickDoajApcBadge(r) {
      const text = pickDoajApcText(r);
      if (!text) return '';
      const noApc = /^no$/i.test(String(r?.doaj?.apc || '').trim());
      return `<span class="pick-apc ${noApc ? 'pick-apc-free' : 'pick-apc-paid'}" title="${T('DOAJ 公开 APC 数据','Public APC data from DOAJ')}">${escape(text)}</span>`;
    }

    function pickIsDoajNoApc(r) {
      return /^no$/i.test(String(r?.doaj?.apc || '').trim());
    }

    // Fee info combined: site "free to publish" flag first, then public DOAJ APC data.
    function pickFeeBadge(r) {
      if (r?.free) {
        return `<span class="pick-apc pick-apc-free" title="${T('提供 OA 发表选项（含 Diamond/Gold/Hybrid）','Offers OA publishing option (Diamond/Gold/Hybrid)')}">${T('免费发表','Free to publish')}</span>`;
      }
      return pickDoajApcBadge(r);
    }

    function pickRiskBadge(r) {
      if (!r || !(r.warning || r.citic_warning || r.on_hold || r.under_review)) return `<span class="pick-risk pick-risk-ok">${T('无预警','No warning')}</span>`;
      const labels = [
        r.warning ? T('预警','Warning') : '',
        r.citic_warning ? T('中信预警','CITIC warning') : '',
        r.on_hold ? 'WoS On Hold' : '',
        r.under_review ? 'WoS Under Review' : '',
      ].filter(Boolean).join(' / ');
      return `<span class="pick-risk pick-risk-warn">${escape(labels)}</span>`;
    }

    function pickDomesticSources() {
      if (!domestic) return [];
      const out = [];
      const add = (source, records) => {
        (records || []).forEach(record => {
          if (record && (record.name || record.cn_name || record.title)) out.push({ source, record });
        });
      };
      add('cnki_major', domestic.cnki_major?.records);
      add('zju', domestic.zju?.records);
      add('nsfc_mgmt', domestic.nsfc_mgmt?.records);
      add('cscd', domestic.cscd?.records);
      add('cstpcd', domestic.cstpcd?.records);
      add('cnkx', domestic.cnkx?.records);
      add('cssci_core', domestic.cssci_core);
      add('cssci_ext', domestic.cssci_ext);
      add('pku_core', domestic.pku_core);
      return out;
    }

    function pickCleanDomesticName(value) {
      return String(value || '').replace(/[＊*☆★]/g, '').replace(/\s+/g, '').trim();
    }

    // Resolve an AI-suggested Chinese journal name against the domestic catalogs.
    function resolveDomesticByName(name) {
      const clean = pickCleanDomesticName(name);
      if (!clean) return null;
      const sourceRows = pickDomesticSources();
      if (!sourceRows.length) return null;
      const exact = sourceRows.filter(({ record }) => pickCleanDomesticName(record.name || record.cn_name || record.title) === clean);
      const loose = exact.length ? [] : sourceRows.filter(({ record }) => pickCleanDomesticName(record.name || record.cn_name || record.title).includes(clean));
      const hits = exact.length ? exact : loose;
      if (!hits.length) return null;
      const sourceWeight = { cnki_major:80, zju:70, nsfc_mgmt:65, cstpcd:63, cscd:62, cnkx:60, cssci_core:55, pku_core:50, cssci_ext:45 };
      hits.sort((a, b) => {
        const ar = a.record, br = b.record;
        const as = (sourceWeight[a.source] || 0) + (ar.issn ? 12 : 0) + (ar.cn_code ? 8 : 0);
        const bs = (sourceWeight[b.source] || 0) + (br.issn ? 12 : 0) + (br.cn_code ? 8 : 0);
        return bs - as;
      });
      const best = hits[0];
      return {
        record: { ...best.record, name: clean, __src: best.source },
        source: best.source,
        cnki: hits.find(h => h.source === 'cnki_major')?.record || null,
      };
    }

    function pickReportFallbackReason(source) {
      const rec = source?.journalRec || source || {};
      const parts = pickUnique([
        ...(source?.matched || []),
        ...(source?.topics || []),
        ...(source?.wos_categories || []),
        ...(rec.wos_categories || []),
        rec.esi_category,
        rec.cas_major_cn,
        rec.cas_major_cat,
      ].filter(Boolean), 3).map(pickReadableField).filter(Boolean);
      if (pickIsZhLang()) {
        return parts.length ? `与${parts.join('、')}方向匹配，站内指标可核验。` : '与论文主题匹配，站内指标可核验。';
      }
      return parts.length ? `Matches ${parts.join(', ')}; site metrics are available.` : 'Matches the topic; site metrics are available.';
    }

    function pickReportReason(value, source) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text && (pickIsZhLang() ? pickHasCjk(text) : !pickHasCjk(text))) return text;
      return pickReportFallbackReason(source);
    }

    function pickQuartileBand(value) {
      const q = String(value || '').trim().toUpperCase();
      if (q === 'Q1' || q === 'Q2') return 'primary';
      if (q === 'Q3' || q === 'Q4') return 'backup';
      return '';
    }

    function pickQuartileRank(value) {
      const band = pickQuartileBand(value);
      return band === 'primary' ? 0 : band === 'backup' ? 1 : 2;
    }

    function pickDifficultyStars(source) {
      const r = source?.journalRec || source || {};
      const q = String(r.if_quartile || source?.jcr_q || '').trim().toUpperCase();
      let stars = q === 'Q1' ? 4 : q === 'Q2' ? 3 : q === 'Q3' ? 2 : q === 'Q4' ? 1 : 2;
      if (Number(r.cas_zone) === 1) stars += 1;
      if (r.cas_top) stars += 1;
      const impact = Number(r.if_2025 != null ? r.if_2025 : r.if_2024);
      if (impact >= 10) stars += 1;
      return Math.max(1, Math.min(5, Math.round(stars)));
    }

    function pickDifficultyHtml(source) {
      const stars = pickDifficultyStars(source);
      const label = pickIsZhLang() ? `投稿难度参考 ${stars}/5（基于 JCR、CAS 与 IF，不代表录用概率）` : `Submission difficulty reference ${stars}/5 (based on JCR, CAS and IF; not an acceptance probability)`;
      return `<span class="pick-difficulty" title="${escape(label)}" aria-label="${escape(label)}">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span>`;
    }

    function pickFallbackReport(profile, entries = []) {
      // Keep the ranked order but expose a real shortlist.  The previous
      // 6 + 8 caps made the report look incomplete for broad topics.
      const primary = entries.filter(e => pickQuartileBand(e.jcr_q || e.journalRec?.if_quartile) === 'primary').slice(0, 8);
      const backup = entries.filter(e => pickQuartileBand(e.jcr_q || e.journalRec?.if_quartile) === 'backup').slice(0, 12);
      const defs = pickIsZhLang()
        ? [['primary', '优选推荐（Q1/Q2）', primary], ['backup', '备选（Q3/Q4）', backup]]
        : [['primary', 'Primary (Q1/Q2)', primary], ['backup', 'Backup (Q3/Q4)', backup]];
      const fields = pickUnique([...(profile?.research_fields || []), ...(profile?.wos_categories || [])], 4)
        .map(pickReadableField).filter(Boolean);
      return {
        intro: pickIsZhLang()
          ? `按 JCR 分区分为两档：Q1/Q2 优选推荐，Q3/Q4 备选。论文方向：${fields.join('、') || '相关交叉学科'}。`
          : `Two tiers by JCR quartile: Q1/Q2 primary and Q3/Q4 backup. Field: ${fields.join(', ') || 'the identified research field'}.`,
        tiers: defs.map(([id, label, source]) => ({
          id,
          label,
          items: source.map(e => ({
            name: e.journalRec?.name || e.srcName || e.issn || '',
            reason: pickReportFallbackReason(e),
          })).filter(x => x.name),
        })).filter(t => t.items.length),
        chinese: [],
        strategy: pickIsZhLang()
          ? ['先从 Q1/Q2 里选主题最贴合的期刊。', '不合适时再从 Q3/Q4 备选中选择。']
          : ['Choose the best-fitting Q1/Q2 journal first.', 'If needed, move to the Q3/Q4 backup list.'],
      };
    }

    function pickLocalizedReport(report) {
      if (!report || typeof report !== 'object') return null;
      const key = pickReportLang();
      const i18n = report.i18n && typeof report.i18n === 'object' ? report.i18n : null;
      const localized = i18n?.[key] && typeof i18n[key] === 'object' ? i18n[key] : report;
      return {
        intro: localized.intro || '',
        tiers: Array.isArray(localized.tiers) ? localized.tiers : [],
        chinese: Array.isArray(localized.chinese) ? localized.chinese : [],
        strategy: Array.isArray(localized.strategy) ? localized.strategy : [],
      };
    }

    function pickEnsureReport(report, profile, fallbackEntries) {
      const localized = pickLocalizedReport(report);
      const fallback = pickFallbackReport(profile, fallbackEntries);
      const out = localized ? { ...fallback, ...localized } : fallback;
      if (!Array.isArray(out.tiers) || !out.tiers.length) out.tiers = fallback.tiers;
      // AI report text is optional; always backfill sparse tiers from the
      // deterministic ranked list while keeping the same two-band order.
      out.tiers = (fallback.tiers || []).map(baseTier => {
        const current = (out.tiers || []).find(t => String(t?.id || '').toLowerCase() === baseTier.id) || {};
        const seen = new Set();
        const items = [];
        const tierLimit = baseTier.id === 'primary' ? 8 : baseTier.id === 'backup' ? 12 : (baseTier.items || []).length;
        for (const item of [...(Array.isArray(current.items) ? current.items : []), ...(baseTier.items || [])]) {
          const key = pickNormText(item?.name || '');
          if (!key || seen.has(key) || items.length >= tierLimit) continue;
          seen.add(key);
          items.push(item);
        }
        return { ...baseTier, ...current, items };
      }).filter(tier => tier.items.length);
      if (!Array.isArray(out.chinese)) out.chinese = [];
      const intro = String(out.intro || '').trim();
      if (!intro || (pickIsZhLang() ? !pickHasCjk(intro) : pickHasCjk(intro))) out.intro = fallback.intro;
      const strategy = (out.strategy || []).map(s => String(s || '').replace(/\s+/g, ' ').trim())
        .filter(s => s && (pickIsZhLang() ? pickHasCjk(s) : !pickHasCjk(s)));
      out.strategy = strategy.length ? strategy : fallback.strategy;
      return out;
    }

    function pickTierLabel(tier) {
      const id = String(tier?.id || '').toLowerCase();
      const zh = { primary:'重点推荐', backup:'稳妥备选', fallback:'补充候选', tier:'推荐期刊' };
      const en = { primary:'Primary targets', backup:'Solid alternatives', fallback:'Safer fallbacks', tier:'Recommended journals' };
      const map = pickIsZhLang() ? zh : en;
      const label = String(tier?.label || '').trim();
      if (!label || (pickIsZhLang() ? !pickHasCjk(label) : pickHasCjk(label))) return map[id] || map.tier;
      if (pickIsZhLang() && /保底|兜底/.test(label)) return map.fallback;
      return label;
    }

    // One international-journal row in the AI report: AI gives name+reason,
    // all metrics are resolved from site data; unresolved names are flagged.
    function renderPickReportEnRow(item, i) {
      const rec = resolvePickJournal({ name: item.name });
      const reason = pickReportReason(item.reason, rec || item);
      if (!rec) {
        return `<tr>
          <td class="pick-report-num">${i + 1}</td>
          <td>${escape(titleCase(item.name))} <span class="pick-report-missing">${T('站内未收录','not in site data')}</span></td>
          <td colspan="2"><span class="muted-cell">&mdash;</span></td>
          <td class="pick-report-reason">${escape(reason)}</td>
        </tr>`;
      }
      const fid = favId(rec);
      if (fid) rowRecordsByFid[fid] = { ...rec, __src: 'int' };
      const idxText = (rec.indices || []).join(' / ');
      const feeHtml = pickFeeBadge(rec);
      const riskHtml = pickRiskBadge(rec);
      const difficultyHtml = pickDifficultyHtml(rec);
      const journalMeta = [
        idxText ? `<span class="pick-report-journal-meta-item">${escape(idxText)}</span>` : '',
        rec.if_quartile ? `<span class="pick-report-journal-meta-item">JCR ${escape(rec.if_quartile)}</span>` : '',
        pickMetricCas(rec) ? `<span class="pick-report-journal-meta-item">${escape(T('中科院','CAS'))} ${escape(pickMetricCas(rec))}</span>` : '',
        feeHtml ? `<span class="pick-report-journal-meta-item pick-report-journal-fee">${feeHtml}</span>` : '',
      ].filter(Boolean).join('');
      return `<tr>
        <td class="pick-report-num">${i + 1}</td>
        <td>
          <a href="#j/${escape(fid)}" data-pick-report-fid="${escape(fid)}">${escape(titleCase(rec.name || item.name))}</a>
          ${riskHtml}
          ${journalMeta ? `<div class="pick-report-journal-meta">${journalMeta}</div>` : ''}
        </td>
        <td>${pickMetricIf(rec) || '<span class="muted-cell">&mdash;</span>'}</td>
        <td>${difficultyHtml}</td>
        <td class="pick-report-reason">${escape(reason)}</td>
      </tr>`;
    }

    function renderPickReportCnRow(item, i) {
      const hit = resolveDomesticByName(item.name);
      const unresolvedReason = pickReportReason(item.reason, item);
      if (!hit) {
        return `<tr>
          <td class="pick-report-num">${i + 1}</td>
          <td>${escape(item.name)} <span class="pick-report-missing">${T('站内未收录','not in site data')}</span></td>
          <td><span class="muted-cell">&mdash;</span></td>
          <td class="pick-report-reason">${escape(unresolvedReason)}</td>
        </tr>`;
      }
      const r = hit.record;
      const fid = favId(r);
      if (fid) rowRecordsByFid[fid] = { ...r, __src: r.__src || hit.source };
      const crossBadges = renderDomCrossBadges({ name: r.name, issn: r.issn, cn_code: r.cn_code });
      const metrics = [
        hit.cnki?.compound_if ? `<span class="domsrc-pill">CNKI ${T('复合IF','compound IF')} ${escape(hit.cnki.compound_if)}</span>` : '',
        hit.cnki?.comprehensive_if ? `<span class="domsrc-pill">CNKI ${T('综合IF','comprehensive IF')} ${escape(hit.cnki.comprehensive_if)}</span>` : '',
      ].filter(Boolean).join('');
      const dataHtml = `${crossBadges ? `<div class="pick-report-badges pick-report-dom-badges">${crossBadges}</div>` : '<span class="muted-cell">&mdash;</span>'}${metrics ? `<div class="pick-report-dom-metrics">${metrics}</div>` : ''}`;
      const reason = pickReportReason(item.reason, r);
      return `<tr>
        <td class="pick-report-num">${i + 1}</td>
        <td><a href="#j/${escape(fid)}" data-pick-report-fid="${escape(fid)}">${escape(r.name)}</a></td>
        <td>${dataHtml}</td>
        <td class="pick-report-reason">${escape(reason)}</td>
      </tr>`;
    }

    // AI recommendation report: the AI picks tiers/reasons/strategy, every
    // metric shown comes from site data (clickable into the journal page).
    function renderPickAiReport(report, profile, fallbackEntries = []) {
      if (!report && !fallbackEntries.length) return '';
      const activeReport = pickEnsureReport(report, profile, fallbackEntries);
      if (!activeReport || (!(activeReport.tiers || []).length && !(activeReport.chinese || []).length)) return '';
      const fields = pickUnique([
        ...(profile?.research_fields || []),
        ...(profile?.wos_categories || []),
      ], 10).map(pickReadableField).filter(Boolean);
      const fieldsText = fields.join(' · ');
      const intro = activeReport.intro || '';
      const tiersHtml = (activeReport.tiers || []).map(tier => {
        const items = Array.isArray(tier.items) ? tier.items : [];
        if (!items.length) return '';
        return `<section class="pick-report-section pick-tier-${escape(tier.id || 'tier')}">
        <div class="pick-report-section-head">
          <h3><span class="pick-tier-dot" aria-hidden="true"></span>${escape(pickTierLabel(tier))}<span class="pick-tier-count">${items.length} ${T('本','journals')}</span></h3>
        </div>
        <div class="pick-report-table-wrap">
          <table class="pick-report-table pick-report-tier-table">
            <thead><tr><th>#</th><th>${T('期刊','Journal')}</th><th>IF</th><th>${T('投稿难度','Difficulty')}</th><th>${T('推荐理由','Why')}</th></tr></thead>
            <tbody>${items.map((item, i) => renderPickReportEnRow(item, i)).join('')}</tbody>
          </table>
        </div>
      </section>`;
      }).join('');
      const chineseItems = activeReport.chinese || [];
      const chineseNote = T(
        '期刊由 AI 按论文主题推荐，收录与分级信息来自站内 CSSCI、北大核心、中国科协、CNKI 等目录。',
        'Chinese-language options suggested by AI; catalog and tier data come from site CSSCI, PKU Core, CAST and CNKI records.'
      );
      const chineseHead = chineseItems.length ? `<div class="pick-report-section-head">
          <h3><span class="pick-tier-dot" aria-hidden="true"></span>${T('中文期刊推荐','Chinese journal appendix')}<span class="pick-tier-count">${chineseItems.length} ${T('本','journals')}</span></h3>
          <p>${chineseNote}</p>
        </div>` : '';
      const chineseBody = chineseItems.length ? `<div class="pick-report-table-wrap">
          <table class="pick-report-table pick-report-dom-table">
            <thead><tr><th>#</th><th>${T('期刊','Journal')}</th><th>${T('站内数据','Site data')}</th><th>${T('推荐理由','Why')}</th></tr></thead>
            <tbody>${chineseItems.map((item, i) => renderPickReportCnRow(item, i)).join('')}</tbody>
          </table>
        </div>` : '';
      const chineseHtml = chineseItems.length
        ? pickIsZhLang()
          ? `<section class="pick-report-section pick-tier-chinese">${chineseHead}${chineseBody}</section>`
          : `<details class="pick-report-section pick-tier-chinese pick-report-appendix">
              <summary><span class="pick-tier-dot" aria-hidden="true"></span>${T('中文期刊推荐','Chinese journal appendix')}<span class="pick-tier-count">${chineseItems.length} ${T('本','journals')}</span></summary>
              <p class="pick-report-appendix-note">${chineseNote}</p>
              ${chineseBody}
            </details>`
        : '';
      const strategyTips = (activeReport.strategy || []).concat([
        T('费用仅作补充参考；投稿判断优先看主题匹配、IF、JCR、中科院分区、索引与预警状态。','Fees are supplementary; prioritize topic fit, IF, JCR, CAS tier, indexes and warning status.'),
      ]);
      const strategyHtml = `<section class="pick-report-section">
        <div class="pick-report-section-head">
          <h3>${T('投稿策略建议','Submission strategy')}</h3>
        </div>
        <ul class="pick-report-strategy">${strategyTips.map(tip => `<li>${escape(tip)}</li>`).join('')}</ul>
      </section>`;
      return `<div class="pick-report">
        <div class="pick-report-head">
          <div>
            <div class="pick-report-kicker">${T('推荐报告','Recommendation report')}</div>
            <h2>${T('期刊推荐报告','Journal recommendation report')}</h2>
          </div>
          <span class="pick-report-source">${T('指标数据来自站内：IF / JCR / 中科院 / 索引 / 预警；费用仅作补充。','Metrics come from site data: IF / JCR / CAS / indexes / warning; fees are supplementary.')}</span>
        </div>
        ${intro ? `<p class="pick-report-intro">${escape(intro)}</p>` : ''}
        ${fieldsText ? `<div class="pick-report-fields"><span class="pick-report-fields-label">${T('匹配方向','Matched fields')}</span><b class="pick-report-fields-text">${escape(fieldsText)}</b></div>` : ''}
        ${tiersHtml}
        ${chineseHtml}
        ${strategyHtml}
      </div>`;
    }

    async function doSearch() {
      // 未登录用户可用本地匹配（每日限次）；登录后不限本地次数，AI 推荐另有服务端额度。
      if (isOverLimit('searches', 10) && !requireLogin(T('今日免费荐刊搜索已达上限，请登录后继续使用','Daily free search limit reached. Sign in to continue.'))) return;
      incrementUsage('searches');

      const query = input.value.trim();
      if (!query) { setPickProgress(T('请输入内容','Please enter a query'), 0); return; }

      setPickProgress(T('准备研究主题与筛选条件…','Preparing topic and filters…'), 8);
      results.innerHTML = '';

      try {
        let entries = null;
        let pickMode = 'local';
        let quotaInfo = null;
        let statusNotice = '';
        let aiReport = null;
        let aiProfile = null;
        const useAi = !!document.getElementById('pick-ai-toggle')?.checked;
        syncPickAiLogin(false);
        if (useAi && !(user && user.token)) {
          // AI 需要登录：提示后自动改用本地匹配，并给出登录入口。
          syncPickAiLogin(true);
          statusNotice = t('pick_ai_login') || T(
            'AI 荐刊需登录（Free 有次数额度）。正在用本地匹配… 登录后可开 AI。',
            'AI recommend needs sign-in. Using local match… Sign in for AI.'
          );
          setPickProgress(statusNotice, 20);
        } else if (useAi) {
          try {
            setPickProgress(T('AI 正在分析研究语义并匹配期刊…','AI is analyzing the topic and matching journals…'), 30);
            // 确保完整期刊库已加载（AI 解析在服务端，本地只做结果解析）
            if (!journalsReady) await ensureJournalsLoaded();
            const aiData = await fetchAiPick(query);
            setPickProgress(T('整理推荐梯队…','Organizing recommendation tiers…'), 78);
            entries = aiEntriesFromResults(aiData);
            pickMode = 'ai';
            quotaInfo = aiData.quota || null;
            aiReport = aiData.report || null;
            aiProfile = aiData.profile || null;
          } catch (e) {
            // AI 失败（网络/额度/配置）→ 自动回退本地匹配，并在状态栏说明原因。
            statusNotice = pickAiErrorMessage(e);
            if (!user || !user.token) syncPickAiLogin(true);
            setPickProgress(statusNotice, 42);
          }
        }

        if (!entries) {
          setPickProgress(T('匹配本地候选期刊…','Matching local candidate journals…'), 48);
          if (!journalsReady) await ensureJournalsLoaded();
          // 本地匹配时再加载 OA 画像（AI 成功则不必等这个大文件）
          if (!oaMap) {
            setPickProgress(T('加载期刊主题画像…','Loading topic profiles…'), 55);
            await loadOaMap().catch(() => null);
          }
          // 本地匹配：词干化 + 中文 n-gram + 歧义词消歧 + 领域锚点
          const PM = window.PickMatch;
          if (!PM) {
            setPickProgress(T('本地匹配模块加载失败，请刷新页面重试','Local matching module failed to load. Please refresh.'), 0);
            return;
          }
          const localProfile = PM.buildLocalProfile(query);
          if (!localProfile.terms.length) {
            setPickProgress(T('请输入更具体的研究对象关键词（避免只填“分析/机制/演化”等方法词）','Enter more specific research-topic keywords (not just method words like analysis/mechanism)'), 0);
            return;
          }

          function localTopicProfile(r) {
            const issns = [r.issn, r.eissn].filter(Boolean).map(x => String(x).toUpperCase());
            const topics = [];
            for (const k of issns) {
              const rec = oaMap && oaMap[k];
              if (!rec) continue;
              (rec.tp || []).forEach(t => topics.push(t));
            }
            return [...new Set(topics)];
          }

          entries = [];
          const pool = journals || [];
          const n = pool.length;
          for (let i = 0; i < n; i++) {
            const r = pool[i];
            // 优先有学科/索引信息的刊，减少无关刊噪声
            const idx = r.indices || [];
            if (!idx.length && !(r.wos_categories || []).length && !r.cas_major_cn) continue;
            const topics = localTopicProfile(r);
            const res = PM.scoreLocal(r, localProfile, topics);
            if (!PM.passesLocalThreshold(res, localProfile)) continue;
            let score = res.score;
            if (idx.includes('SCIE') || idx.includes('SSCI') || idx.includes('AHCI') || idx.includes('ESCI')) score *= 1.12;
            if (r.cas_zone === 1 || r.if_quartile === 'Q1') score *= 1.08;
            if (r.warning || r.citic_warning || r.on_hold || r.under_review) score *= 0.65;
            // 只要命中强，且匹配词过少则降权
            if (res.matched.length < 2) score *= 0.7;
            entries.push({
              journalRec: r,
              issn: r.issn || r.eissn || favId(r),
              zone: r.cas_zone,
              top: r.cas_top,
              jcr_q: r.if_quartile,
              indices: idx,
              wos_categories: r.wos_categories || [],
              topics: topics.slice(0, 6),
              matched: [...new Set(res.matched)].slice(0, 8),
              count: res.matched.length,
              score,
              srcName: r.name,
            });
            // 进度条：避免主线程长时间无反馈
            if (i > 0 && i % 4000 === 0) {
              setPickProgress(
                T(`本地匹配中… ${Math.min(99, Math.round(i / n * 100))}%`, `Local matching… ${Math.min(99, Math.round(i / n * 100))}%`),
                55 + Math.round((i / n) * 25),
              );
              await new Promise(r => setTimeout(r, 0));
            }
          }
          // 只保留分数较高的前 200，避免「几千候选」稀释观感
          entries.sort((a, b) => b.score - a.score);
          if (entries.length > 200) entries = entries.slice(0, 200);
        }

        setPickProgress(T('应用索引与费用筛选…','Applying index and fee filters…'), 82);
        let filtered = entries;
        const wantSci = document.getElementById('pick-filter-sci')?.checked;
        const wantSsci = document.getElementById('pick-filter-ssci')?.checked;
        const wantAhci = document.getElementById('pick-filter-ahci')?.checked;
        const wantEsci = document.getElementById('pick-filter-esci')?.checked;
        if (wantSci || wantSsci || wantAhci || wantEsci) {
          filtered = filtered.filter(e => {
            const idx = e.journalRec?.indices || [];
            if (!idx.length) return false;
            if (wantSci && idx.includes('SCIE')) return true;
            if (wantSsci && idx.includes('SSCI')) return true;
            if (wantAhci && idx.includes('AHCI')) return true;
            if (wantEsci && idx.includes('ESCI')) return true;
            return false;
          });
        }
        if (document.getElementById('pick-filter-comprehensive')?.checked) {
          filtered = filtered.filter(e => {
            const cats = e.wos_categories || [];
            return !cats.some(c => /multidisciplinary/i.test(c));
          });
        }
        if (document.getElementById('pick-filter-free')?.checked && canSeePublishFeeInfo()) {
          filtered = filtered.filter(e => pickIsDoajNoApc(e.journalRec));
        }
        filtered.sort((a, b) => pickQuartileRank(a.jcr_q || a.journalRec?.if_quartile)
          - pickQuartileRank(b.jcr_q || b.journalRec?.if_quartile)
          || b.score - a.score
          || (b.journalRec.if_2024 || 0) - (a.journalRec.if_2024 || 0));
        if (query !== pickLastQuery) {
          pickLastQuery = query;
          window.__pickShown = 30;
        }
        const allFiltered = filtered;
        const maxScore = allFiltered.reduce((max, entry) => Math.max(max, Number(entry.score) || 0), 1);
        allFiltered.forEach(e => e.score = maxScore > 0 ? e.score / maxScore : 0);
        const shownLimit = Math.max(30, window.__pickShown || 30);
        filtered = allFiltered.slice(0, shownLimit);

        if (!filtered.length) {
          results.innerHTML = `<div class="pick-no-results">${T('没有符合筛选条件的期刊推荐','No journals match your filters')}</div>`;
          setPickProgress(entries.length
            ? T('已匹配到候选期刊，但当前索引/综合刊/费用筛选把结果过滤完了，请放宽筛选条件。',
                'Local candidates were found, but the current index / multidisciplinary / fee filters removed them all. Try relaxing filters.')
            : pickMode === 'ai'
            ? T('AI 语义匹配没有符合当前筛选条件的期刊，请放宽索引或综合刊筛选','AI semantic matching found no journals under the current filters. Try relaxing index or multidisciplinary filters.')
            : T('没有匹配到本地期刊画像。中文题目建议补充 2-5 个研究对象或学科关键词；英文题目建议补充具体领域词。',
                'No local journal profiles matched. Add 2-5 concrete research objects or field keywords.'), 100);
          return;
        }

        setPickProgress(T('渲染推荐结果…','Rendering recommendations…'), 92);
        pickLastReportState = pickMode === 'ai'
          ? { report: aiReport, profile: aiProfile || entries[0]?.semanticProfile || {}, fallbackEntries: allFiltered }
          : null;
        const reportHtml = pickLastReportState
          ? renderPickAiReport(pickLastReportState.report, pickLastReportState.profile, pickLastReportState.fallbackEntries)
          : '';
        results.innerHTML = reportHtml + filtered.map(e => {
          const scorePct = Math.round(e.score * 100);
          const name = e.journalRec?.name || e.srcName || e.issn;
          const issnStr = e.issn;
          const signalList = [
            ...e.matched.map(t => `<span class="pick-topic">${escape(t)}</span>`),
            ...e.topics.slice(0, 3).map(t => `<span class="pick-topic">${escape(t)}</span>`),
          ].join('');

          let topInfoHtml = '';
          let flagsHtml = '';
          let zoneTagsHtml = '';
          let zoneColor = '';
          if (e.journalRec) {
            const r = e.journalRec;
            const ifMetricYear = Number(r.if_latest_year || r.jcr_year || (r.if_2025 != null ? 2025 : 2024));
            const idxBadges = [...new Set(e.indices||[])].map(idx => badgeIndex(idx)).join('');
            const scBadge = badgeScopus(r.scopus);
            const ifTxt = r.if_2024 != null && r.if_2024 !== ''
              ? `<span class="if-pill" title="JCR ${ifMetricYear} ${T('影响因子','Impact Factor')}">IF ${(+r.if_2024).toFixed(1)}</span>`
              : '';
            topInfoHtml = [idxBadges, scBadge].filter(Boolean).join('');
            // Warning & publisher flags
            const r2 = e.journalRec;
            if (r2) {
              // Warning list
              if (r2.warning) {
                const w = r2.warning;
                if (typeof w === 'object') {
                  const arr = Array.isArray(w) ? w : [w];
                  const latest = arr.reduce((a,b) => (!a || (b.year && b.year > (a.year||0))) ? b : a, null);
                  const yearStr = latest && latest.year ? latest.year : '';
                  const levelStr = latest && latest.level ? latest.level : '';
                  const label = yearStr ? `${yearStr}${levelStr ? '/'+levelStr : ''}` : (levelStr || '⚠');
                  flagsHtml += `<span class="badge b-warn">⚠ ${escape(label)}</span>`;
                } else {
                  flagsHtml += `<span class="badge b-warn">⚠ ${T('预警','Warning')}</span>`;
                }
              }
              // OA publisher badges (MDPI / Frontiers / Hindawi)
              const pub = (r2.publisher || '').toLowerCase();
              if (pub.includes('mdpi')) flagsHtml += `<span class="badge b-mdpi">MDPI</span>`;
              if (pub.includes('frontier')) flagsHtml += `<span class="badge b-frontiers">Frontiers</span>`;
              if (pub.includes('hindawi')) flagsHtml += `<span class="badge b-hindawi">Hindawi</span>`;
            }
            const jcrQ = String(e.jcr_q || '').toUpperCase();
            const xrZone = r.cas_xr && r.cas_xr.zone ? String(r.cas_xr.zone) : '';
            const zTag = e.zone
              ? `<span class="zone z${e.zone}" title="${T('中科院 2025 大类分区','CAS 2025 major category tier')}">${T('中科院2025','CAS 2025')} ${e.zone}${T('区','')}${e.top ? ' TOP' : ''}</span>`
              : '';
            const jcrTag = /^Q[1-4]$/.test(jcrQ)
              ? `<span class="zone jcr-${jcrQ.toLowerCase()}" title="JCR ${ifMetricYear} ${T('分区','quartile')}">JCR ${ifMetricYear} ${jcrQ}</span>`
              : '';
            const xrTag = /^[1-4]$/.test(xrZone)
              ? `<span class="zone z${xrZone}" title="${T('中科院新锐 2026 分区','CAS Emerging 2026 tier')}">${T('新锐2026','Emerging 2026')} ${xrZone}${T('区','')}${r.cas_xr.top ? ' TOP' : ''}</span>`
              : '';
            const ccfTxt = r.ccf ? `<span class="badge b-ccf" title="${T('中国计算机学会推荐等级','CCF recommended ranking')}">CCF ${escape(r.ccf)}</span>` : '';
            // 卡片只保留最核心的三档（IF / JCR / 中科院），新锐·CCF 收进详情页，减少徽章堆叠
            zoneTagsHtml = [ifTxt, jcrTag, zTag].filter(Boolean).join('');
            // Zone strip color（无分区数据时用中性色兜底，保证每张卡片都有左色条、不忽有忽无）
            zoneColor = e.zone === '1' || e.zone === 1 ? '#1f3a5f'
              : e.zone === '2' || e.zone === 2 ? '#4f6f9b'
              : e.zone === '3' || e.zone === 3 ? '#9eb1cb'
              : e.zone === '4' || e.zone === 4 ? '#d3dbe6'
              : jcrQ === 'Q1' ? '#7a2030'
              : jcrQ === 'Q2' ? '#a04a5a'
              : '#cbbfa8';
          }

          // Compute score color for the score bar
          const barColor = scorePct >= 80 ? '#1a8b3c'
            : scorePct >= 60 ? '#2d9d5e'
            : scorePct >= 40 ? '#d4a017'
            : scorePct >= 20 ? '#5a8fc9'
            : '#8e9aaf';

          const cardZoneClass = e.zone ? ` zone-${e.zone}` : '';
          const zoneStripStyle = zoneColor ? `style="background:${zoneColor}"` : '';
          return `<div class="pick-card${cardZoneClass}" data-issn="${escape(issnStr)}">
            ${zoneColor ? `<div class="pick-zone-strip" ${zoneStripStyle}></div>` : ''}
            <div class="pick-card-main">
              ${topInfoHtml ? `<div class="pick-index-line">${topInfoHtml}</div>` : ''}
              <h3><a href="#j/${escape(e.journalRec ? favId(e.journalRec) : issnStr)}">${escape(name)}</a></h3>
              ${zoneTagsHtml ? `<div class="pick-zone-tags">${zoneTagsHtml}</div>` : ''}
              <div class="pick-head">
                <span class="pick-count">${e.count}<small> ${T('个匹配信号','signals')}</small></span>
                <div class="pick-head-right">
                  <span class="pick-score-bar"><span class="bar"><span class="bar-fill" style="width:${scorePct}%;background:${barColor}"></span></span></span>
                  <span class="pick-score-pct">${scorePct}%</span>
                </div>
              </div>
              ${flagsHtml ? `<div class="pick-flags">${flagsHtml}</div>` : ''}
              ${(function(){
                const r2 = e.journalRec;
                const apcState = pickFeeBadge(r2);
                const weeks = parseFloat(r2?.doaj?.review_weeks);
                // 仅在有实际审稿周期数据时显示；无数据则不展示（不再用 DOAJ 平均值兜底）
                const cycleHtml = weeks > 0
                  ? `<span class="pick-cycle-label">${T('审稿周期','Review cycle')}:</span><strong>${(weeks / 4.33).toFixed(1)}${T(' 个月',' months')}</strong><span class="pick-cycle-sub">${T('投稿到发表, DOAJ','submission to publication, DOAJ')}</span>`
                  : '';
                return (apcState || cycleHtml) ? `<div class="pick-cycle">${apcState}${cycleHtml}</div>` : '';
              })()}
              ${signalList ? `<div class="pick-papers">${signalList}</div>` : ''}
            </div>
          </div>`;
        }).join('');
        bindPickReportLinks();
        if (allFiltered.length > filtered.length) {
          results.innerHTML += `<button id="pick-more" class="pick-more" type="button">${T('再显示 30 本','Show 30 more')} <span>${allFiltered.length - filtered.length} ${T('本剩余','left')}</span></button>`;
        }
        document.getElementById('pick-more')?.addEventListener('click', () => {
          window.__pickShown = Math.max(30, window.__pickShown || 30) + 30;
          doSearch();
        });

        // Click to open the normal journal details page.
        const pickEl = document.getElementById('pick-results');
        if (pickEl) {
          pickEl.querySelectorAll('.pick-card').forEach(card => {
            card.addEventListener('click', (ev) => {
              if (ev.target.closest('a') && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1)) return;
              ev.preventDefault();
              const issn = card.dataset.issn;
              const rec = journals.find(r => r.issn === issn || r.eissn === issn) || resolvePickJournal({ issn, slug: issn, name: issn });
              if (rec) openDrawer(rec, { pageMode: true, source: 'recommendation' });
            });
          });
        }

        const quotaText = pickMode === 'ai' && quotaInfo && quotaInfo.remaining != null
          ? (quotaInfo.lifetime || quotaInfo.period === 'lifetime'
            ? ` · ${T('剩余','left')} ${quotaInfo.remaining}/${quotaInfo.limit}`
            : quotaInfo.period === 'month'
              ? ` · ${T('本月剩余','left this month')} ${quotaInfo.remaining}/${quotaInfo.limit}`
              : ` · ${T('今日剩余','remaining today')} ${quotaInfo.remaining}/${quotaInfo.limit}`)
          : '';
        const modeText = pickMode === 'ai' ? t('pick_mode_ai') : t('pick_mode_local');
        setPickProgress(`${statusNotice ? statusNotice + ' · ' : ''}${modeText} ${entries.length} ${T('个候选期刊','candidate journals')}, ${T('显示','showing')} ${filtered.length}/${allFiltered.length}${quotaText}`, 100);
        trackInteraction('journal_pick', {
          tab: 'pick',
          query,
          result_count: allFiltered.length,
          metadata: {
            mode: pickMode,
            shown: filtered.length,
            candidate_count: entries.length,
            quota_remaining: quotaInfo?.remaining ?? null,
            sci: !!document.getElementById('pick-filter-sci')?.checked,
            ssci: !!document.getElementById('pick-filter-ssci')?.checked,
            ahci: !!document.getElementById('pick-filter-ahci')?.checked,
            esci: !!document.getElementById('pick-filter-esci')?.checked,
            exclude_comprehensive: !!document.getElementById('pick-filter-comprehensive')?.checked,
          },
        });
        // ── Save to search history ──
        savePickHistory(query);
      } catch (e) {
        setPickProgress(T('检索失败：','Search failed: ') + e.message, 100);
        console.error(e);
      }
    }

    _runPickSearch = doSearch;

    input.addEventListener('keydown', (e) => {
      if (!isPickSearchContext() || e.key !== 'Enter') return;
      if (e.isComposing || e.keyCode === 229 || e.which === 229
        || input.__pickCompositionActive
        || performance.now() < Number(input.__pickIgnoreEnterUntil || 0)) return;
      e.preventDefault();
      doSearch();
    });
    document.querySelectorAll('.pick-filter-bar input').forEach(el => {
      el.addEventListener('change', () => {
        if (!input.value.trim()) return;
        window.__pickShown = 30;
        doSearch();
      });
    });

    // ── Search history ──
    const HISTORY_KEY = 'ailatest.pick.history';
    const MAX_HISTORY = 20;

    function getPickHistory() {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    }

    function savePickHistory(query) {
      let history = getPickHistory();
      history = history.filter(h => h.query !== query);
      history.unshift({ query, time: Date.now() });
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      renderPickHistory();
    }

    function renderPickHistory() {
      const history = getPickHistory();
      const container = document.getElementById('pick-history');
      const list = document.getElementById('pick-history-list');
      if (!container || !list) return;
      if (!history.length) {
        container.style.display = 'none';
        return;
      }
      container.style.display = '';
      list.innerHTML = history.map(h => {
        const q = escape(h.query);
        const preview = h.query.length > 40 ? h.query.slice(0, 40) + '…' : h.query;
        const timeStr = h.time ? (() => {
          const d = new Date(h.time);
          try {
            return d.toLocaleString(uiLocale(), {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
              hour12: false,
            });
          } catch { return ''; }
        })() : '';
        return `<div class="pick-history-item" data-query="${q}">
          <span class="pick-history-text">${escape(preview)}</span>
          <span class="pick-history-time">${timeStr}</span>
        </div>`;
      }).join('');

      list.querySelectorAll('.pick-history-item').forEach(item => {
        item.addEventListener('click', () => {
          input.value = item.dataset.query;
          doSearch();
        });
      });
    }

    document.getElementById('pick-history-clear')?.addEventListener('click', () => {
      localStorage.removeItem(HISTORY_KEY);
      renderPickHistory();
    });

    renderPickHistory();
  }

  // ───────── Home V4 landing: stats + hot journals ─────────
  /** 首页指标展示：始终带完整千分位，避免 48722 →「48+」 */
  function formatHomeStat(n) {
    const raw = typeof n === 'string' ? n.replace(/[^\d.]/g, '') : n;
    const num = Math.floor(Number(raw) || 0);
    if (num <= 0) return '—';
    if (num >= 1_000_000) {
      const m = Math.floor(num / 100_000) / 10;
      return `${m}M+`;
    }
    // ≥1万：向下整千 → 48,000+ / 23,000+
    // 1千–1万：向下整百 → 7,400+ / 1,000+
    let rounded;
    if (num >= 10000) rounded = Math.floor(num / 1000) * 1000;
    else if (num >= 1000) rounded = Math.floor(num / 100) * 100;
    else rounded = num;
    // 手动千分位，不依赖运行环境 locale
    const s = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${s}+`;
  }

  // 仅「期刊详情」有展示下限（真实 total_journal_views ≈ 23k）；服务用户用实时访客数，勿抬高
  const HOME_STAT_FLOOR = { journal_views: 23000 };

  function setHomeStat(key, value) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (!el) return;
    let n = Number(value);
    if (!Number.isFinite(n)) n = 0;
    const floor = HOME_STAT_FLOOR[key];
    if (floor != null) n = Math.max(n, floor);
    const text = formatHomeStat(n);
    el.textContent = text;
    el.setAttribute('data-raw', String(n));
  }

  async function loadHomeStats() {
    try {
      const [pub, m] = await Promise.all([
        fetch(`${API_BASE}/analytics/public-total`).then(r => r.ok ? r.json() : null).catch(() => null),
        meta || fetch('/data/meta.json').then(r => r.json()).catch(() => null),
      ]);
      // 期刊数优先 meta.total，否则用已加载库长度
      const jTotal = (m && m.total) || (meta && meta.total) || (journals && journals.length) || 0;
      if (jTotal) setHomeStat('journals', jTotal);
      if (pub && pub.ok !== false) {
        if (pub.total_pageviews != null) setHomeStat('views', pub.total_pageviews);
        // 服务用户 = 访客 total_visitors（约 1k+），不是期刊详情 23k
        if (pub.total_visitors != null) setHomeStat('visitors', pub.total_visitors);
        // 期刊详情浏览：优先 total_journal_views
        const jv = pub.total_journal_views != null ? pub.total_journal_views : pub.viewed_journals;
        if (jv != null) setHomeStat('journal_views', jv);
        else setHomeStat('journal_views', HOME_STAT_FLOOR.journal_views);
      } else if (HOME_STAT_FLOOR.journal_views) {
        setHomeStat('journal_views', HOME_STAT_FLOOR.journal_views);
      }
    } catch (_) {
      /* keep HTML placeholders */
    }
  }

  let _homeHotItems = null; // 缓存近 30 天 API 榜单

  function formatHotViews(n) {
    const v = Math.max(0, Math.floor(Number(n) || 0));
    if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
    return String(v);
  }

  function resolveHotJournal(item, pool) {
    const key = String(item?.journal_key || '').trim();
    const issnRaw = String(item?.journal_issn || '').toUpperCase().replace(/[^0-9X]/g, '');
    const name = String(item?.journal_name || '').trim();
    if (key) {
      const byKey = pool.find((j) => favId(j) === key || j.slug === key);
      if (byKey) return byKey;
    }
    if (issnRaw) {
      const byIssn = pool.find((j) => {
        const a = String(j.issn || '').toUpperCase().replace(/[^0-9X]/g, '');
        const b = String(j.eissn || '').toUpperCase().replace(/[^0-9X]/g, '');
        return a === issnRaw || b === issnRaw;
      });
      if (byIssn) return byIssn;
    }
    if (name) {
      const nn = normTitle(name);
      const byName = pool.find((j) => normTitle(j.name || j.n || j.cn_name || '') === nn);
      if (byName) return byName;
    }
    return null;
  }

  function bindHotFidClicks(root) {
    if (!root) return;
    root.querySelectorAll('[data-hot-fid]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const fid = a.getAttribute('data-hot-fid');
        if (!fid) return;
        const rec = (journals || []).find((j) => favId(j) === fid)
          || (homeJournals || []).find((j) => favId(j) === fid);
        if (!rec) return;
        e.preventDefault();
        openDrawer(rec, { pageMode: true, source: 'home_hot' });
      });
    });
  }

  function renderHomeHotList(items) {
    const pool = (journalsReady && journals.length ? journals : (homeJournals || journals || []));
    const list = Array.isArray(items) ? items.slice(0, 5) : [];
    const emptyHtml = `<div class="home-hot-row home-hot-empty rank-hot-empty">${escape(t('home_hot_empty'))}</div>`;
    const loadingHtml = `<div class="home-hot-row home-hot-empty rank-hot-empty">${escape(t('home_hot_loading'))}</div>`;

    const homeRows = !list.length ? emptyHtml : list.map((item, i) => {
      const rec = resolveHotJournal(item, pool);
      const name = titleCase(rec?.name || rec?.n || item.journal_name || item.journal_key || '—');
      const ifRaw = rec?.if_2024 != null ? Number(rec.if_2024) : NaN;
      const ifv = Number.isFinite(ifRaw) ? ifRaw.toFixed(1) : '—';
      const slug = rec?.slug || '';
      const fid = rec ? favId(rec) : (item.journal_key || '');
      const href = slug
        ? `/journal/${encodeURIComponent(slug)}/`
        : (fid ? `#j/${encodeURIComponent(fid)}` : '#');
      return `<a class="home-hot-row" role="listitem" href="${href}" data-hot-fid="${escape(fid)}" data-hot-views="${escape(String(item.views || 0))}">
        <span class="home-hot-n">${i + 1}</span>
        <span class="home-hot-name" title="${escape(name)}">${escape(name)}</span>
        <span class="home-hot-if" title="Impact Factor"><span class="home-hot-if-k">IF</span><em>${escape(ifv)}</em></span>
      </a>`;
    }).join('');

    const rankRows = !list.length ? emptyHtml : list.map((item, i) => {
      const rec = resolveHotJournal(item, pool);
      const name = titleCase(rec?.name || rec?.n || item.journal_name || item.journal_key || '—');
      const ifRaw = rec?.if_2024 != null ? Number(rec.if_2024) : NaN;
      const ifv = Number.isFinite(ifRaw) ? ifRaw.toFixed(1) : '—';
      const slug = rec?.slug || '';
      const fid = rec ? favId(rec) : (item.journal_key || '');
      const href = slug
        ? `/journal/${encodeURIComponent(slug)}/`
        : (fid ? `#j/${encodeURIComponent(fid)}` : '#');
      const views = item.views != null ? Number(item.views).toLocaleString() : '';
      return `<a class="rank-row" href="${href}" data-hot-fid="${escape(fid)}">
        <span class="rank-n">${i + 1}</span>
        <strong title="${escape(name)}">${escape(name)}</strong>
        <span class="rank-if">${views ? `${views}` : `IF ${escape(ifv)}`}</span>
      </a>`;
    }).join('');

    const homeBox = $('#home-hot-list');
    if (homeBox) {
      homeBox.innerHTML = homeRows;
      bindHotFidClicks(homeBox);
    }
    const rankBox = $('#rank-hot-list');
    if (rankBox) {
      rankBox.innerHTML = rankRows;
      bindHotFidClicks(rankBox);
    }
  }

  async function loadHomeHotList() {
    const homeBox = $('#home-hot-list');
    const rankBox = $('#rank-hot-list');
    if (!homeBox && !rankBox) return;
    if (!_homeHotItems) {
      if (homeBox) homeBox.innerHTML = `<div class="home-hot-row home-hot-empty">${escape(t('home_hot_loading'))}</div>`;
      if (rankBox) rankBox.innerHTML = `<div class="rank-hot-empty">${escape(t('home_hot_loading'))}</div>`;
      try {
        const data = await fetch(
          `${API_BASE}/analytics/hot-journals?days=30&limit=5`
        ).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        _homeHotItems = Array.isArray(data?.items) ? data.items : [];
      } catch (_) {
        _homeHotItems = [];
      }
    }
    renderHomeHotList(_homeHotItems);
  }

  function initRankBoards() {
    const root = document.getElementById('rankings');
    if (!root || root.__rankBound) return;
    root.__rankBound = true;
    root.querySelectorAll('[data-rank-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-rank-tab') || 'index';
        root.querySelectorAll('[data-rank-tab]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        root.querySelectorAll('[data-rank-panel]').forEach((p) => {
          const on = p.getAttribute('data-rank-panel') === key;
          p.classList.toggle('is-on', on);
          p.hidden = !on;
        });
        if (key === 'hot') loadHomeHotList();
      });
    });
  }

  function initHomeLanding() {
    loadHomeStats();
    loadHomeHotList();
    initRankBoards();
    // 热点榜只依赖 light 池（boot 完成后 loadHomeHotList 会再解析一次）
    // 切勿在此 ensureJournalsLoaded：会立刻抢 8MB+ full 库，拖垮首页与热点
    // 首页介绍区 CTA：聚焦搜索 / 切到荐刊
    document.querySelectorAll('[data-home-focus-search]').forEach((el) => {
      if (el.__homeBound) return;
      el.__homeBound = true;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        setHomeMode('search');
        const qEl = $('#q');
        qEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        qEl?.focus();
      });
    });
    document.querySelectorAll('[data-home-mode-pick]').forEach((el) => {
      if (el.__homeBound) return;
      el.__homeBound = true;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        setHomeMode('pick');
        const qEl = $('#q');
        qEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        qEl?.focus();
      });
    });
    document.querySelectorAll('.home-top-nav a[href^="#"]').forEach((a) => {
      if (a.__homeBound) return;
      a.__homeBound = true;
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href')?.slice(1);
        const target = id && document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ───────── boot ─────────
  async function boot() {
    // ── Owner unlock: specific URL param sets localStorage bypass ──
    const OWNER_EMAIL = 'jiantaoweng@gmail.com';
    if (window.location.search.includes(OWNER_EMAIL)) {
      try { localStorage.setItem('ailatest_unlocked', '1'); } catch {}
    }
    // 立刻恢复被登录/分享弹窗误藏的搜索框（同一会话未刷新时）
    restoreTopbarSearch();
    installRouteAnalytics();
    trackPageview();
    loadFavLists();
    bind();
    applyI18n();
    applyStations();
    updateFavCount();
    initHomeLanding();
    placeLangToggle();
    // /rankings 旧入口 → 首页榜单区
    if (normalizeAppPath(location.pathname) === '/rankings') {
      try { history.replaceState(history.state || {}, '', '/#rankings'); } catch (_) {}
      requestAnimationFrame(() => {
        document.getElementById('rankings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else if (location.hash === '#rankings') {
      requestAnimationFrame(() => {
        document.getElementById('rankings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    await handleAuthCallback();
    refreshCurrentUserProfile();
    // 分享着陆页：/s/<id> 直接接管 main，不走主流程
    if (await maybeRenderShareLanding()) return;
    try {
      const pendingInitialTab = consumePendingTab();
      const initialTab = pendingInitialTab || tabFromPath();
      const initialPath = location.pathname.replace(/\/+$/, '') || '/';
      const isJournalPath = !!journalPathSlug();
      // int/fav/pick/import 最终需要 full；首页与详情深链先用 light 首屏（~3MB vs ~9MB）
      const needsFullForTab = initialPath === '/import'
        || ['int', 'fav', 'pick'].includes(initialTab);
      const [j, m, esi, aliases, underReviewIssns, onHoldIssns] = await Promise.all([
        fetchJSON('data/journals_light_v2.json.gz'),
        fetch('/data/meta.json').then(r => r.json()).catch(() => null),
        fetch('/data/esi_categories.json').then(r => r.json()).catch(() => []),
        fetch('/data/journal_aliases.json').then(r => r.json()).catch(() => DEFAULT_JOURNAL_ALIASES),
        fetch('/data/under_review_issn.json').then(r => r.json()).catch(() => []),
        fetch('/data/on_hold_issn.json').then(r => r.json()).catch(() => []),
      ]);
      setJournalAliases(aliases);
      window.__underReviewIssns = underReviewIssns || [];
      window.__onHoldIssns = onHoldIssns || [];
      meta = m; esiCats = esi;
      homeJournals = Array.isArray(j) ? j : [];
      // finalize 已含 mark / searchMeta / index / filterCounts / topicList（light 路径不标 journalsReady）
      finalizeJournalDataset(j, { full: false, underReviewIssns, onHoldIssns });
      journalUpdates = { updated_at: '', items: [] };
      loadHomeHotList();
      if (meta && meta.total) setHomeStat('journals', meta.total);
      // Refresh stale favsData with live international journal data
      (function refreshFavsData() {
        let dirty = false;
        for (const id of Object.keys(favsData)) {
          const live = journals.find(r => favId(r) === id);
          if (live && favsData[id]) {
            const oldName = favsData[id].name || '';
            const newName = live.name || '';
            if (oldName !== newName) {
              favsData[id] = { ...favsData[id], name: newName, cn_name: live.cn_name,
                en_name: live.en_name, abbr20: live.abbr20, if_2024: live.if_2024,
                cas_zone: live.cas_zone, cas_top: live.cas_top, indices: live.indices,
                flagship: live.flagship, nature_index: live.nature_index, esi_category: live.esi_category,
                if_quartile: live.if_quartile, publisher: live.publisher, ccf: live.ccf,
                scopus: live.scopus, warning: live.warning, under_review: live.under_review, on_hold: live.on_hold, citic_warning: live.citic_warning,
              };
              dirty = true;
            }
          }
        }
        if (dirty) localStorage.setItem(STORAGE_PREFIX + 'favsData', JSON.stringify(favsData));
      })();
      if (meta?.total && $('#total')) $('#total').textContent = meta.total.toLocaleString();
      const hintEl = $('#hint');
      if (hintEl) hintEl.textContent = `${T('已加载','Loaded')} ${(meta?.total || journals.length).toLocaleString()} ${T('本期刊','journals')}`;
      // 侧栏筛选列表：轻量路径 finalize 不画，这里补一次（量小）
      renderCatList();
      renderTopicList();
      updatePublicPulse();
      loadDomesticData().then(() => {
        updateFilterCounts();
        if (activeTab === 'dom') renderDomestic();
      });
      loadIndiaData().then(() => {
        if (activeTab === 'in') renderIndia();
      });
      // ── 小程序收藏导入（方案A：/import?d=ISSN1,ISSN2…，无后端）──
      (function importFromMiniProgram() {
        if (location.pathname.replace(/\/+$/, '') !== '/import') return;
        let raw = new URLSearchParams(location.search).get('d') || '';
        if (!raw && location.hash) {
          const m = location.hash.match(/[#&?]d=([^&]+)/);
          if (m) raw = decodeURIComponent(m[1]);
        }
        const issns = (raw || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        let added = 0, missing = 0;
        for (const issn of issns) {
          const r = journals.find(j => (j.issn || '').toUpperCase() === issn || (j.eissn || '').toUpperCase() === issn);
          if (!r) { missing++; continue; }
          if (!isFav(r)) { toggleFav(r, {}); added++; }
        }
        try { history.replaceState(null, '', '/favorites'); } catch (_) {}
        const msg = issns.length
          ? `${T('已导入', 'Imported')} ${added} ${T('本期刊到收藏', 'journals to favorites')}` + (missing ? `（${missing} ${T('本未匹配', 'unmatched')}）` : '')
          : T('链接里没有可导入的期刊', 'No journals found in the link');
        setTimeout(() => {
          try {
            const el = document.createElement('div');
            el.className = 'import-toast';
            el.textContent = msg;
            el.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:3000;background:#1f2c4c;color:#fff;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.28);max-width:88vw;text-align:center';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 4500);
          } catch (_) {}
        }, 200);
      })();
      // 影响因子滑块
      (function initIfSlider() {
        const slider = document.getElementById('if-slider');
        const valEl = document.getElementById('if-slider-val');
        if (!slider) return;
        const max = +slider.max || 50;
        const sync = () => {
          activeIfMin = +slider.value;
          if (valEl) valEl.textContent = activeIfMin > 0
            ? `IF ≥ ${activeIfMin}${activeIfMin >= max ? '+' : ''}`
            : T('不限', 'Any');
          slider.style.setProperty('--pct', (activeIfMin / max * 100) + '%');
        };
        slider.addEventListener('input', () => { sync(); shown = PAGE; renderInt(); });
        sync();
      })();
      // 详情深链：light 即可首屏；后台再补 full 以填充趋势图等重字段
      if (renderJournalRoutePage()) {
        window.addEventListener('hashchange', applyHashRoute);
        const openFid = _currentDrawerRec ? favId(_currentDrawerRec) : '';
        ensureJournalsLoaded()
          .then(() => {
            if (!openFid || !_currentDrawerRec || favId(_currentDrawerRec) !== openFid) return;
            const live = journals.find((row) => favId(row) === openFid);
            if (live) openDrawer(live, { pageMode: true, fromPath: true, source: 'full_upgrade' });
          })
          .catch(() => {});
        if (user) await pullFavs();
        return;
      }
      // 列表类入口：全球站用 light 立刻出表，full 后台升级；收藏/荐刊仍等 full
      if (needsFullForTab) {
        if (window.__activateJournalTab) window.__activateJournalTab(initialTab, { skipPath: !pendingInitialTab });
        else if (initialTab === 'int' && journals.length) renderInt();
        if (initialTab === 'int' && journals.length) {
          // light 已在 activateTab 内 renderInt；full 不阻塞首屏
          ensureJournalsLoaded()
            .then(() => renderAfterFullJournalLoad(initialTab))
            .catch(err => console.error(err));
        } else {
          try {
            await ensureJournalsLoaded();
            renderAfterFullJournalLoad(initialTab);
          } catch (err) {
            console.error(err);
          }
        }
      } else {
        if (window.__activateJournalTab) window.__activateJournalTab(initialTab, { skipPath: !pendingInitialTab });
        else if (initialTab === 'int') renderInt();
        scheduleFullJournalWarmup();
      }
      // 启用 #j/<id> 深链
      window.addEventListener('hashchange', applyHashRoute);
      applyHashRoute();
      if (user) await pullFavs();
      // 设置表头吸顶偏移 = 搜索栏高度
      updateStickySearchState();
      window.addEventListener('resize', updateStickySearchState);
      window.addEventListener('scroll', updateStickySearchState, { passive: true });
    } catch (e) {
      $('#hint').textContent = 'Load failed: ' + e.message;
      console.error(e);
    }
  }

  function updateThStickyTop() {
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      const h = topbar.getBoundingClientRect().height;
      const top = parseFloat(getComputedStyle(topbar).top) || 0;
      document.documentElement.style.setProperty('--th-sticky-top', Math.ceil(top + h) + 'px');
    }
  }

  function refreshPickI18n() {
    // data-i18n and data-i18n-placeholder are handled by applyI18n()
    if (typeof window.__refreshPickReportI18n === 'function') window.__refreshPickReportI18n();
  }

  async function loadJournalViewTotalFootnote() {
    const el = document.getElementById('journal-view-total');
    if (!el) return;
    try {
      const resp = await fetch(`${API_BASE}/analytics/public-total?site=${encodeURIComponent(location.hostname)}`, { cache: 'no-store' });
      const data = await readJsonResponse(resp, 'Public traffic total failed');
      const pageviews = Number(data.total_pageviews || 0);
      const visitors = Number(data.total_visitors || 0);
      const total = Number(data.total_journal_views || 0);
      const journals = Number(data.viewed_journals || 0);
      if (!pageviews && !total) return;
      el.innerHTML = `${T('全站浏览量','Total site views')}：<strong>${pageviews.toLocaleString()}</strong>${visitors ? ` · ${T('访客','Visitors')} ${visitors.toLocaleString()}` : ''}${total ? ` · ${T('期刊详情浏览','Journal detail views')} ${total.toLocaleString()}` : ''}${journals ? ` · ${T('覆盖期刊','Journals viewed')} ${journals.toLocaleString()}` : ''}`;
      el.hidden = false;
    } catch (_) {}
  }

  // CNKX 复选面板切换（动态生成，不经过 initThDropdowns）
  window.toggleCnkxDropdown = function(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const wasOpen = panel.classList.contains('open');
    document.querySelectorAll('.th-dropdown-panel.open').forEach(p => p.classList.remove('open'));
    if (!wasOpen) panel.classList.add('open');
  };

  const canonicalWordmark = document.querySelector('.topbar-brand');
  if (canonicalWordmark && canonicalWordmark.parentElement !== document.body) {
    document.body.appendChild(canonicalWordmark);
  }

  loadJournalViewTotalFootnote();
  boot();
})();
