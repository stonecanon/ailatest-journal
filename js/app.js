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
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    if (url.endsWith('.gz')) {
      const ds = new DecompressionStream('gzip');
      const stream = resp.body.pipeThrough(ds);
      return await new Response(stream).json();
    }
    return await resp.json();
  };

  const I18N = {
    zh: {
      tagline: '<b>AILatest Journal</b> — 面向科研人员的期刊检索与投稿决策工具，聚合 SCI/SSCI、中科院分区、JCR、ESI、CSSCI、北大核心、浙大目录等数据，支持收藏、评分与跨设备同步。',
      indices: '索引', cas_zone: '中科院 2025 分区', filters: '附加筛选',
      esi: 'ESI 学科大类', all: '全部',
      z1: '1 区', z2: '2 区', z3: '3 区', z4: '4 区',
      filter_xinrui: '新锐分区', filter_warning: '预警',
      domestic_sources: '国内分级来源',
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
      pwa_install: '📲 安装到主屏',
      footer_data: '数据来源：Clarivate WoS Core Collection (SCIE/SSCI/AHCI/ESCI) · JCR 2025 · ESI · EI Compendex · Scopus · DOAJ · 中科院文献情报中心分区表 2025 · ShowJCR (GPL-3.0) · CCF 2026 (A/B/C) · CCF-T 2025 · ABDC 2025 · ABS 2024 · 中国科协 2025 · CSSCI · 北大核心 · CNKI · 浙江大学 2024 · 高校自编目录 2023 · CrossRef · OpenAlex。© <a href="https://journal.ailatest.org">AILatest Journal</a>',
      tab_home: '查刊', tab_int: '国际', tab_dom: '中国', tab_fav: '收藏', tab_pick: '荐刊',
      rail_int: '国际期刊', rail_dom: '中国期刊', rail_fav: '我的收藏',
      loading: '加载中…',
      hero_title_int: 'SCI / SSCI 国际期刊检索',
      hero_body_int: '資料來源：<b>Web of Science Core Collection</b>（SCIE / SSCI / AHCI / ESCI）· 更新至 2026-05-18，並合併 <b>EI Compendex</b> 期刊目錄（2025-10-10）。',
      src_cnkx: '中国科协高质量目录',
      src_cnki_major: '中文期刊目录',
      hero_note: '徽章语义：<b>SCIE/SSCI/AHCI/ESCI/EI</b> 索引收录 · <b>中科院</b> 中科院 2025 大类分区（1-4 区，TOP 标志） · <b>JCR Q</b> Quartile（Q1-Q4） · <b>新锐</b> 中科院 2026 新锐版分区 · <b>CCF</b> 中国计算机学会 2026 推荐（A/B/C） · <b>ABDC</b> 澳洲经管期刊分级（A*/A/B/C） · <b>ABS</b> 英国 Chartered ABS Academic Journal Guide 2024（4*/4/3/2/1，仅经管商科） · <b>T1/T2/T3</b> 中国科协 2025 高质量期刊分级 · <b>⚠ Warning</b> 国际期刊预警名单。',
      hero_title_fav: '我的收藏',
      hero_body_fav: '点击任意期刊右侧的 <b>★</b> 可加入收藏。未登录时保存在本机 localStorage；登录后自动同步到云端，可跨设备访问。',
      hero_title_pick: '智能荐刊',
      hero_body_pick: '采用自研大模型算法，深度分析你的研究主题与海量期刊数据的匹配度，智能推荐最合适的目标期刊。每人每天免费使用 5 次。',
      pick_placeholder: '建议输入标题 + 关键词，最多 200 字符',
      pick_search_btn: '开始推荐',
      pick_filter_topics: '匹配研究领域 (Topics)',
      pick_filter_if: '限 IF >',
      pick_filter_zone: '中科院分区',
      pick_filter_sci: 'SCIE',
      pick_filter_ssci: 'SSCI',
      pick_filter_ahci: 'AHCI',
      pick_filter_compre: '排除综合性期刊',
      pick_history: '搜索历史', pick_history_clear: '清空',
      pick_quota: 'OpenAlex 驱动',
      pick_apikey_ph: 'API Key 可选',
      results_all: '全部期刊', load_more: '加载更多',
      col_name: '期刊 Title', col_free: '免费', col_abbr: '缩写 Abbr', col_badges: '索引 / 分区',
      col_cat: 'ESI / 中科院大类',
      hero_title_dom: '国内学术期刊分级目录',
      hero_body_dom: '<b>中国科协 高质量科技期刊分级目录 (2025-12 修订)</b> 共 11,084 条 / 59 学科领域；<b>中文期刊目录</b> 共 7,755 条 / 10 大学科分类，CSSCI / 北大核心 / CCF 中文以徽章形式叠加；<b>浙江大学 2024 版</b> 与 <b>高校自编目录 2023</b>（付费解锁）。',
      hero_note_dom: 'CSSCI / 北大核心为扫描 PDF OCR 提取，可能存在个别错字。',
      search_int: '搜索：期刊全称 / 官方缩写 / 社群缩写 / ISSN / 中文刊名',
      search_dom: '搜索：刊名 / ISSN / CN 号（跨库搜索）',
      search_fav: '搜索收藏：期刊 / 缩写 / ISSN',
      search_home_ph: '搜索期刊名、ISSN…',
      search_submit_hint: '搜索',
      search_button: 'Search',
      home_subtitle: '全球期刊检索与推荐平台',
      showing: '显示', of: '条 / 共', total_items: '条',
      empty: '未找到匹配的期刊',
      empty_fav: '还没有收藏。切到「国际 SCI/SSCI」点任意一行右边的 ★ 就能收藏。',
      login: '登录', logout: '登出',
      fav_added: '已收藏', fav_removed: '已移除',
      syncing: '同步中…', synced: '已同步',
      wos_subjects: 'WoS 细分学科',
      wos_search_ph: '筛选学科（A-Z）…',
      filter_free_only: '只看免费发表', wos_clear_title: '清空选择',
    },
    en: {
      tagline: '<b>AILatest Journal</b> — Journal search & submission decision tool for researchers. Aggregates SCI/SSCI, CAS tiers, JCR, ESI, CSSCI, PKU Core, ZJU directory and more. Favorites, ratings, cross-device sync.',
      indices: 'Indices', cas_zone: 'CAS 2025 Tier', filters: 'Filters',
      esi: 'ESI Categories', all: 'All',
      z1: 'T1', z2: 'T2', z3: 'T3', z4: 'T4',
      filter_xinrui: 'Emerging Tier', filter_warning: 'Warning List',
      domestic_sources: 'Domestic Sources',
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
      pwa_install: '📲 Install to Home',
      footer_data: 'Sources: Clarivate WoS Core Collection (SCIE/SSCI/AHCI/ESCI) · JCR 2025 · ESI · EI Compendex · Scopus · DOAJ · CAS NSL Tiers 2025 · ShowJCR (GPL-3.0) · CCF 2026 (A/B/C) · CCF-T 2025 · ABDC 2025 · ABS 2024 · CAST 2025 · CSSCI · PKU Core · CNKI · ZJU 2024 · School A 2023 · CrossRef · OpenAlex. © <a href="https://journal.ailatest.org">AILatest Journal</a>',
      tab_home: 'Journals', tab_int: 'International', tab_dom: 'China', tab_fav: 'Favorites', tab_pick: 'Recommend',
      rail_int: 'International Journals', rail_dom: 'Chinese Journals', rail_fav: 'Favorites',
      loading: 'Loading…',
      hero_title_int: 'International SCI / SSCI Search',
      hero_body_int: 'Source: <b>Web of Science Core Collection</b> (SCIE / SSCI / AHCI / ESCI), updated 2026-05-18, merged with <b>EI Compendex</b> source list (2025-10-10).',
      hero_note: 'Badge legend: <b>SCIE/SSCI/AHCI/ESCI/EI</b> indices · <b>CAS</b> CAS 2025 major tier (1-4, TOP) · <b>JCR Q</b> Quartile · <b>Emerging</b> CAS 2026 Emerging Edition · <b>CCF</b> CCF 2026 (A/B/C) · <b>ABDC</b> Australian Business Deans’ list (A*/A/B/C) · <b>ABS</b> Chartered ABS Academic Journal Guide 2024 (4*/4/3/2/1, business/management only) · <b>T1/T2/T3</b> CAST 2025 · <b>⚠ Warning</b> Int’l journal warning list.',
      hero_title_fav: 'My Favorites',
      hero_body_fav: 'Click the <b>★</b> on any row to bookmark. Saved locally when signed-out; syncs to the cloud when signed-in.',
      hero_title_pick: 'Pick for me',
      hero_body_pick: 'Powered by proprietary large-model algorithm — intelligently matches your research topic against millions of journal data points to recommend the best target journals. 5 free searches per day per user.',
      pick_placeholder: 'Enter title + keywords, max 200 characters',
      pick_search_btn: 'Start',
      pick_filter_topics: 'Match Topics',
      pick_filter_if: 'IF >',
      pick_filter_zone: 'CAS Zone',
      pick_filter_sci: 'SCIE',
      pick_filter_ssci: 'SSCI',
      pick_filter_ahci: 'AHCI',
      pick_filter_compre: 'Exclude multidisciplinary',
      pick_history: 'Search History', pick_history_clear: 'Clear',
      pick_quota: 'OpenAlex powered',
      pick_apikey_ph: 'API key optional',
      results_all: 'All journals', load_more: 'Load more',
      col_name: 'Journal Title', col_free: 'FREE', col_abbr: 'Abbr', col_badges: 'Index / Tier',
      col_cat: 'ESI / CAS Major',
      hero_title_dom: 'Domestic Chinese Journal Directories',
      hero_body_dom: '<b>China Association for Science and Technology (CAST) High-Quality Sci-Tech Journal Tiered Directory (Dec 2025)</b> — 11,084 journals across 59 disciplines; <b>Chinese Journal Directory</b> — 7,755 journals across 10 subject categories, with CSSCI / PKU Core / CCF Chinese badges; <b>ZJU 2024</b>; <b>School A 2023</b> (paywalled).',
      hero_note_dom: 'CSSCI / PKU Core extracted via OCR from scanned PDF; minor typos possible.',
      search_int: 'Search: title / abbr / acronym / ISSN / Chinese name',
      search_dom: 'Search: title / ISSN / CN (cross-source)',
      search_fav: 'Search favorites: title / acronym / ISSN',
      search_home_ph: 'Search journal name, ISSN…',
      search_submit_hint: 'search',
      search_button: 'Search',
      home_subtitle: 'Journal search & submission decision tool for researchers',
      showing: 'Showing', of: 'of', total_items: '',
      empty: 'No journals match.',
      empty_fav: 'No favorites yet. Switch to Int’l SCI/SSCI and click ★ on any row to bookmark.',
      login: 'Sign in', logout: 'Sign out',
      fav_added: 'Saved', fav_removed: 'Removed',
      syncing: 'Syncing…', synced: 'Synced',
      wos_subjects: 'WoS Subjects',
      wos_search_ph: 'Filter subjects (A-Z)…',
      filter_free_only: 'FREE only', wos_clear_title: 'Clear selection',
    },
  };



  // 8-language UI layer. Journal titles / ISSN / ranking values remain source-language data.
  I18N['zh-CN'] = I18N.zh;
  I18N['zh-TW'] = {
    ...I18N.zh,
    tagline: '<b>AILatest Journal</b> — 面向科研人員的期刊檢索與投稿決策工具，聚合 SCI/SSCI、中科院分區、JCR、ESI、CSSCI、北大核心、浙大目錄等資料，支援收藏、評分與跨裝置同步。',
    indices: '索引', cas_zone: '中科院 2025 分區', filters: '附加篩選', all: '全部',
    filter_xinrui: '新銳分區', filter_warning: '預警', domestic_sources: '中國分級來源',
    src_cnkx: '中國科協高品質目錄', src_cssci_core: 'CSSCI 來源期刊', src_cssci_ext: 'CSSCI 擴展版', src_pku: '北大核心 (2023)', src_zju: '浙江大學 2024', src_ccft: 'CCF 中文 T 分區', nav_sub_inhouse: '院校自編目錄', paid_label: '付費', drawer_kicker: '期刊詳情',
        tab_home: '查刊', tab_int: '國際', tab_dom: '中國', tab_fav: '收藏', tab_pick: '薦刊',
    rail_int: '國際期刊', rail_dom: '中國期刊', rail_fav: '我的收藏',
    loading: '載入中…',
    hero_title_int: 'SCI / SSCI 國際期刊檢索',
    hero_body_int: '資料來源：<b>Web of Science Core Collection</b>（SCIE / SSCI / AHCI / ESCI）· 更新至 2026-05-18，並合併 <b>EI Compendex</b> 期刊目錄（2025-10-10）。',
    hero_note: '徽章語義：<b>SCIE/SSCI/AHCI/ESCI/EI</b> 索引收錄 · <b>中科院</b> 2025 大類分區（1-4 區，TOP 標誌） · <b>JCR Q</b> Quartile（Q1-Q4） · <b>新銳</b> 2026 新銳版分區 · <b>CCF</b> 中國計算機學會 2026 推薦（A/B/C） · <b>ABDC</b> 澳洲經管期刊分級（A*/A/B/C） · <b>ABS</b> 英國 Chartered ABS Academic Journal Guide 2024（4*/4/3/2/1，僅經管商科） · <b>T1/T2/T3</b> 中國科協 2025 高質量期刊分級 · <b>⚠ Warning</b> 國際期刊預警名單。',
    hero_title_dom: '中國學術期刊分級目錄', hero_title_fav: '我的收藏', hero_title_pick: '幫我選刊',
    hero_body_fav: '點擊任一期刊右側的 <b>★</b> 可加入收藏。未登入時保存在本機 localStorage；登入後自動同步到雲端。',
    hero_body_pick: '敬請期待。這裡將根據你的研究主題、影響因子區間、審稿週期、版面費、收錄索引等條件推薦目標期刊。未來更新。',
    pick_coming_title: '敬請期待', pick_coming_desc: '未來更新', results_all: '全部期刊', load_more: '載入更多',
    col_name: '期刊 Title', col_free: '免費', col_abbr: '縮寫 Abbr', col_badges: '索引 / 分區', search_int: '搜尋：期刊全稱 / 官方縮寫 / ISSN / 中文刊名', search_dom: '搜尋：中文刊名 / 英文刊名 / ISSN / CN 號', search_fav: '搜尋收藏：期刊 / 縮寫 / ISSN',
      search_home_ph: '搜尋期刊名、ISSN…',
      home_subtitle: '面向科研人員的期刊檢索與投稿決策工具', showing: '顯示', of: '條 / 共', total_items: '條', empty: '未找到匹配的期刊', login: '登入', logout: '登出', fav_added: '已收藏', fav_removed: '已移除', syncing: '同步中…', synced: '已同步', wos_subjects: 'WoS 細分學科', wos_search_ph: '篩選學科（A-Z）…', wos_clear_title: '清空選擇', filter_free_only: '只看免費發表'
  };
  Object.assign(I18N, {
    ja: {
      ...I18N.en,
      tagline: '<b>AILatest Journal</b> — 研究者向けのジャーナル検索・投稿判断ツール。SCI/SSCI、CAS区分、JCR、ESI、CSSCI、PKU Core、ZJU などを統合。',
      indices: '索引', cas_zone: 'CAS 2025 区分', filters: 'フィルター', all: 'すべて', filter_xinrui: 'Emerging 区分', filter_warning: '警告リスト', domestic_sources: '中国国内ソース',
      tab_home: 'ジャーナル', tab_int: '国際', tab_dom: '中国', tab_fav: 'お気に入り', tab_pick: '投稿先を選ぶ', loading: '読み込み中…',
      hero_title_int: 'SCI / SSCI 国際ジャーナル検索',
      hero_body_int: 'データソース：<b>Web of Science Core Collection</b>（SCIE / SSCI / AHCI / ESCI、2026-05-18更新）に <b>EI Compendex</b>（2025-10-10）を統合。<b>JCR 2025</b> 索引、<b>ESI</b> 22分野、<b>CAS 2025</b> 区分、<b>ShowJCR</b> JCR 2025リリース・2024指標（IF / 区分 / ランク）、Emerging、CCF 2026、警告リストを収録。合計 <b id="total">—</b> 誌。',
      hero_note: 'バッジ凡例：<b>SCIE/SSCI/AHCI/ESCI/EI</b> 索引収録 · <b>CAS</b> CAS 2025 大区分（1-4区、TOP表示） · <b>JCR Q</b> Quartile（Q1-Q4） · <b>Emerging</b> CAS 2026 新興版区分 · <b>CCF</b> CCF 2026 推薦（A/B/C） · <b>ABDC</b> 豪州経営ジャーナルランキング（A*/A/B/C） · <b>ABS</b> Chartered ABS Academic Journal Guide 2024（4*/4/3/2/1、経営・商学のみ） · <b>T1/T2/T3</b> 中国科协 2025 高品質ジャーナル区分 · <b>⚠ Warning</b> 国際ジャーナル警告リスト。',
      hero_title_dom: '中国学術ジャーナル区分', hero_title_fav: 'お気に入り', hero_title_pick: '投稿先を選ぶ', hero_body_fav: '<b>★</b> でお気に入りに追加できます。', hero_body_pick: '近日公開。研究テーマ、IF範囲、査読期間、APC、索引条件から投稿候補を推薦します。', pick_coming_title: '近日公開', pick_coming_desc: '今後更新予定', results_all: 'すべてのジャーナル', load_more: 'さらに読み込む', col_name: 'ジャーナル Title', col_free: '無料', col_abbr: '略称 Abbr', col_badges: '索引 / 区分', search_int: '検索：タイトル / 略称 / ISSN / 中国語名', search_dom: '検索：中国語名 / 英語名 / ISSN / CN', search_fav: 'お気に入りを検索', showing: '表示', of: '/', total_items: '件', empty: '一致するジャーナルがありません', login: 'ログイン', logout: 'ログアウト', wos_subjects: 'WoS 分野', wos_search_ph: '分野を絞り込み（A-Z）…'
    },
    ko: {
      ...I18N.en,
      tagline: '<b>AILatest Journal</b> — 연구자를 위한 저널 검색 및 투고 의사결정 도구입니다.', indices: '색인', cas_zone: 'CAS 2025 등급', filters: '필터', all: '전체', filter_xinrui: '신예 등급', filter_warning: '경고 목록', domestic_sources: '중국 국내 목록', tab_home: '저널', tab_int: '국제', tab_dom: '중국', tab_fav: '즐겨찾기', tab_pick: '저널 추천', loading: '불러오는 중…',
      hero_title_int: 'SCI / SSCI 국제 저널 검색', hero_body_int: '데이터: <b>Web of Science Core Collection</b>(2026-05-18) 및 <b>EI Compendex</b>(2025-10-10). <b>JCR 2025</b> 색인, <b>ESI</b>, <b>CAS 2025</b>, <b>ShowJCR</b> JCR 2025 릴리스 · 2024 지표(IF/분야/순위), CCF 2026, 경고 목록을 통합했습니다. 총 <b id="total">—</b> 종.', hero_note: '배지 범례: <b>SCIE/SSCI/AHCI/ESCI/EI</b> 색인 수록 · <b>CAS</b> CAS 2025 대분류(1-4구, TOP표시) · <b>JCR Q</b> Quartile(Q1-Q4) · <b>Emerging</b> CAS 2026 신흥판 구분 · <b>CCF</b> CCF 2026 추천(A/B/C) · <b>ABDC</b> 호주 경영저널 등급(A*/A/B/C) · <b>ABS</b> Chartered ABS Academic Journal Guide 2024(4*/4/3/2/1, 경영·상학만) · <b>T1/T2/T3</b> 중국과학기협 2025 고품질 학술지 등급 · <b>⚠ Warning</b> 국제 학술지 경고 목록.', hero_title_dom: '중국 학술지 등급 목록', hero_title_fav: '즐겨찾기', hero_title_pick: '저널 추천', hero_body_pick: '곧 제공됩니다. 연구 주제, IF 범위, 심사 기간, APC, 색인 조건으로 추천합니다.', pick_coming_title: '준비 중', pick_coming_desc: '향후 업데이트', results_all: '전체 저널', load_more: '더 보기', col_name: '저널 Title', col_free: '무료', col_abbr: '약어 Abbr', col_badges: '색인 / 등급', search_int: '검색: 제목 / 약어 / ISSN / 중국어명', search_dom: '검색: 중국어명 / 영어명 / ISSN / CN', search_fav: '즐겨찾기 검색', showing: '표시', of: '/', total_items: '개', empty: '일치하는 저널이 없습니다', login: '로그인', logout: '로그아웃', wos_subjects: 'WoS 세부분야', wos_search_ph: '분야 필터(A-Z)…'
    },
    es: {
      ...I18N.en,
      tagline: '<b>AILatest Journal</b> — buscador de revistas y herramienta de decisión para investigadores.', indices: 'Índices', cas_zone: 'CAS 2025', filters: 'Filtros', all: 'Todo', filter_xinrui: 'Emergente', filter_warning: 'Advertencia', domestic_sources: 'Fuentes de China', tab_home: 'Revistas', tab_int: 'Internacional', tab_dom: 'China', tab_fav: 'Favoritos', tab_pick: 'Ayúdame a elegir', loading: 'Cargando…', hero_title_int: 'Búsqueda internacional SCI / SSCI', hero_body_int: 'Fuente: <b>Web of Science Core Collection</b> (actualizado 2026-05-18) con <b>EI Compendex</b> (2025-10-10). Integra <b>JCR 2025</b>, <b>ESI</b>, <b>CAS 2025</b> y <b>ShowJCR</b> versión JCR 2025 · métricas 2024 (IF / cuartiles / rangos), CCF 2026 y listas de advertencia. Total: <b id="total">—</b> revistas.', hero_note: 'Leyenda de insignias: <b>SCIE/SSCI/AHCI/ESCI/EI</b> índices de cobertura · <b>CAS</b> Categorización CAS 2025 por áreas principales (1-4, marca TOP) · <b>JCR Q</b> Cuartil (Q1-Q4) · <b>Emerging</b> Edición Emergente CAS 2026 · <b>CCF</b> Recomendación CCF 2026 (A/B/C) · <b>ABDC</b> Clasificación australiana de revistas de gestión empresarial (A*/A/B/C) · <b>ABS</b> Chartered ABS Academic Journal Guide 2024 (4*/4/3/2/1, solo negocios y gestión) · <b>T1/T2/T3</b> Clasificación CAST 2025 de revistas de alta calidad · <b>⚠ Warning</b> Lista de advertencia de revistas internacionales.', hero_title_dom: 'Directorios de revistas chinas', hero_title_fav: 'Favoritos', hero_title_pick: 'Ayúdame a elegir', hero_body_pick: 'Próximamente. Recomendará revistas según tema, rango de IF, revisión, APC e índices.', pick_coming_title: 'Próximamente', pick_coming_desc: 'Actualización futura', results_all: 'Todas las revistas', load_more: 'Cargar más', col_name: 'Revista Title', col_free: 'GRATIS', col_abbr: 'Abrev. Abbr', col_badges: 'Índice / nivel', search_int: 'Buscar: título / abreviatura / ISSN / nombre chino', search_dom: 'Buscar: nombre chino / inglés / ISSN / CN', search_fav: 'Buscar favoritos', showing: 'Mostrando', of: 'de', total_items: '', empty: 'No hay coincidencias', login: 'Iniciar sesión', logout: 'Salir', wos_subjects: 'Materias WoS', wos_search_ph: 'Filtrar materias (A-Z)…'
    },
    pt: {
      ...I18N.en,
      tagline: '<b>AILatest Journal</b> — ferramenta de busca de periódicos e decisão de submissão para pesquisadores.', indices: 'Índices', cas_zone: 'CAS 2025', filters: 'Filtros', all: 'Tudo', filter_xinrui: 'Emergente', filter_warning: 'Alerta', domestic_sources: 'Fontes chinesas', tab_home: 'Periódicos', tab_int: 'Internacional', tab_dom: 'China', tab_fav: 'Favoritos', tab_pick: 'Escolher periódico', loading: 'Carregando…', hero_title_int: 'Busca internacional SCI / SSCI', hero_body_int: 'Fonte: <b>Web of Science Core Collection</b> (2026-05-18) com <b>EI Compendex</b> (2025-10-10). Integra <b>JCR 2025</b>, <b>ESI</b>, <b>CAS 2025</b> e <b>ShowJCR</b> versão JCR 2025 · métricas 2024 (IF / quartis / rankings), CCF 2026 e listas de alerta. Total: <b id="total">—</b> periódicos.', hero_note: 'Legenda de emblemas: <b>SCIE/SSCI/AHCI/ESCI/EI</b> índices de cobertura · <b>CAS</b> Categorização CAS 2025 por grandes áreas (1-4, marca TOP) · <b>JCR Q</b> Quartil (Q1-Q4) · <b>Emerging</b> Edição Emergente CAS 2026 · <b>CCF</b> Recomendação CCF 2026 (A/B/C) · <b>ABDC</b> Classificação australiana de periódicos de gestão (A*/A/B/C) · <b>ABS</b> Chartered ABS Academic Journal Guide 2024 (4*/4/3/2/1, apenas negócios e gestão) · <b>T1/T2/T3</b> Classificação CAST 2025 de periódicos de alta qualidade · <b>⚠ Warning</b> Lista de alerta de periódicos internacionais.', hero_title_dom: 'Diretórios chineses', hero_title_fav: 'Favoritos', hero_title_pick: 'Escolher periódico', hero_body_pick: 'Em breve. Recomendará periódicos por tema, faixa de IF, revisão, APC e índices.', pick_coming_title: 'Em breve', pick_coming_desc: 'Atualização futura', results_all: 'Todos os periódicos', load_more: 'Carregar mais', col_name: 'Periódico Title', col_free: 'GRÁTIS', col_abbr: 'Abrev. Abbr', col_badges: 'Índice / nível', search_int: 'Buscar: título / abreviação / ISSN / nome chinês', search_dom: 'Buscar: nome chinês / inglês / ISSN / CN', search_fav: 'Buscar favoritos', showing: 'Mostrando', of: 'de', total_items: '', empty: 'Nenhum resultado', login: 'Entrar', logout: 'Sair', wos_subjects: 'Assuntos WoS', wos_search_ph: 'Filtrar assuntos (A-Z)…'
    },
    fr: {
      ...I18N.en,
      tagline: '<b>AILatest Journal</b> — outil de recherche de revues et d’aide au choix de soumission pour les chercheurs.', indices: 'Index', cas_zone: 'CAS 2025', filters: 'Filtres', all: 'Tout', filter_xinrui: 'Émergent', filter_warning: 'Alerte', domestic_sources: 'Sources chinoises', tab_home: 'Revues', tab_int: 'International', tab_dom: 'Chine', tab_fav: 'Favoris', tab_pick: 'M’aider à choisir', loading: 'Chargement…', hero_title_int: 'Recherche internationale SCI / SSCI', hero_body_int: 'Source : <b>Web of Science Core Collection</b> (2026-05-18) avec <b>EI Compendex</b> (2025-10-10). Intègre <b>JCR 2025</b>, <b>ESI</b>, <b>CAS 2025</b> et <b>ShowJCR</b> version JCR 2025 · métriques 2024 (IF / quartiles / rangs), CCF 2026 et listes d’alerte. Total : <b id="total">—</b> revues.', hero_note: 'Légende des badges : <b>SCIE/SSCI/AHCI/ESCI/EI</b> indices de couverture · <b>CAS</b> Catégorisation CAS 2025 par grandes disciplines (1-4, marque TOP) · <b>JCR Q</b> Quartile (Q1-Q4) · <b>Emerging</b> Édition Émergente CAS 2026 · <b>CCF</b> Recommandation CCF 2026 (A/B/C) · <b>ABDC</b> Classement australien des revues de gestion (A*/A/B/C) · <b>ABS</b> Chartered ABS Academic Journal Guide 2024 (4*/4/3/2/1, commerce et gestion uniquement) · <b>T1/T2/T3</b> Classement CAST 2025 des revues de haute qualité · <b>⚠ Warning</b> Liste d’alerte des revues internationales.', hero_title_dom: 'Répertoires chinois', hero_title_fav: 'Favoris', hero_title_pick: 'M’aider à choisir', hero_body_pick: 'Bientôt disponible. Recommandations selon thème, IF, délai de revue, APC et index.', pick_coming_title: 'Bientôt disponible', pick_coming_desc: 'Mise à jour future', results_all: 'Toutes les revues', load_more: 'Charger plus', col_name: 'Revue Title', col_free: 'GRATUIT', col_abbr: 'Abrév. Abbr', col_badges: 'Index / niveau', search_int: 'Chercher : titre / abréviation / ISSN / nom chinois', search_dom: 'Chercher : nom chinois / anglais / ISSN / CN', search_fav: 'Chercher favoris', showing: 'Affichage', of: 'sur', total_items: '', empty: 'Aucun résultat', login: 'Connexion', logout: 'Déconnexion', wos_subjects: 'Sujets WoS', wos_search_ph: 'Filtrer les sujets (A-Z)…'
    }
  });
  const LANG_ORDER = ['zh-CN', 'zh-TW', 'ja', 'ko', 'en', 'es', 'pt', 'fr'];
  const LANG_META = {
    'zh-CN': { label: '中文', html: 'zh-CN' }, 'zh-TW': { label: '繁中', html: 'zh-TW' },
    ja: { label: '日本語', html: 'ja' }, ko: { label: '한국어', html: 'ko' }, en: { label: 'English', html: 'en' },
    es: { label: 'Español', html: 'es' }, pt: { label: 'Português', html: 'pt' }, fr: { label: 'Français', html: 'fr' }
  };
  const normalizeLang = (code) => code === 'zh' ? 'zh-CN' : (I18N[code] ? code : 'zh-CN');

  // ───────── state ─────────
  let lang = normalizeLang(localStorage.getItem('ailatest.lang') || 'zh-CN');
  const T = (zh_, en_) => lang === 'zh-CN' || lang === 'zh-TW' ? zh_ : en_;
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
  let esiCats = [];
  let meta = null;
  let oaMap = {};          // compact OpenAlex map: { "ISSN": {hp, l, oa, dj, apc, org, cn, w} }
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

  function lookupOA(r) {
    if (!oaMap) return null;
    const keys = [r.issn, r.eissn].filter(Boolean).map(s => String(s).toUpperCase());
    for (const k of keys) {
      if (oaMap[k]) return oaMap[k];
    }
    return null;
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
  const TAB_PATHS = { home: '/', int: '/international', dom: '/china', fav: '/favorites', pick: '/pick' };
  const PATH_TABS = { '/': 'home', '/international': 'int', '/journals': 'int', '/china': 'dom', '/favorites': 'fav', '/pick': 'pick' };
  const TAB_SEO = {
    home: {
      title: 'AILatest Journal — 期刊查询 · 荐刊推荐 · SCI期刊检索',
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
    fav: {
      title: '期刊收藏清单 | Journal Favorites - AILatest Journal',
      desc: '保存、同步、排序并分享你的目标期刊清单，支持跨设备收藏和期刊清单分享。'
    },
    pick: {
      title: '荐刊推荐工具 | Journal Finder for Paper Title and Keywords - AILatest Journal',
      desc: '输入论文题目、摘要或关键词，智能匹配研究主题、SCI/SSCI/EI 收录、JCR 分区、中科院分区、Scopus 与影响因子，推荐适合投稿的目标期刊。'
    }
  };
  function tabFromPath(pathname = location.pathname) {
    const clean = pathname.replace(/\/+$/, '') || '/';
    return PATH_TABS[clean] || 'home';
  }
  function updatePageSeo(tab = activeTab) {
    const seo = TAB_SEO[tab] || TAB_SEO.int;
    document.title = seo.title;
    const canonicalPath = (tab === 'home' || (tab === 'int' && (location.pathname === '/' || location.pathname === ''))) ? '/' : (TAB_PATHS[tab] || '/');
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
  let activeCat = '__all';   // ESI subject filter (legacy name)
  let activeCasMajor = '__all'; // CAS 大类 filter
  let activeIdxFilter = '__all'; // 索引快捷筛选
  let activeTierFilter = '__all'; // 分区快捷筛选
  let activeExtraFilter = '__all'; // 附加筛选
  let activeIndices = new Set(['SCIE','SSCI','AHCI','ESCI','EI']);
  let activeZones = new Set();
  let activeJcr = new Set();
  let activeXr = new Set();
  let activeAbdc = new Set();
  let activeAbs = new Set();
  let activeFeats = new Set();
  let activeWos = new Set();
  let wosCats = [];   // [{name,count}] sorted A-Z
  let activeQuery = '';
  let activeDom = 'cnki_major';   // 中文期刊目录
  let activeDomBadges = new Set(); // 默认不勾选 = 显示全部；勾选 = 只看有该徽章的
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
  const API_BASE = (window.AILATEST_API_BASE
    || (location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://api.ailatest.org'));

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

  function getAnalyticsId(key, storage) {
    try {
      let id = storage.getItem(key);
      if (!id) {
        id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        storage.setItem(key, id);
      }
      return id;
    } catch (_) {
      return '';
    }
  }

  function trackPageview() {
    try {
      if (new URLSearchParams(location.search).has('noanalytics')) {
        localStorage.setItem('ailatest.analytics.ignore', '1');
      }
      if (localStorage.getItem('ailatest.analytics.ignore') === '1') return;
    } catch (_) {}
    const trackedUrl = new URL(location.href);
    trackedUrl.searchParams.delete('token');
    trackedUrl.searchParams.delete('state');
    trackedUrl.searchParams.delete('code');
    const payload = {
      path: `${trackedUrl.pathname}${trackedUrl.search ? trackedUrl.search.slice(0, 180) : ''}`,
      referrer: document.referrer || '',
      visitor_id: getAnalyticsId('ailatest.analytics.visitor', localStorage),
      session_id: getAnalyticsId('ailatest.analytics.session', sessionStorage),
      client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      client_language: navigator.language || '',
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

  function t(k) { return (I18N[lang] && I18N[lang][k]) ?? I18N.en[k] ?? I18N['zh-CN'][k] ?? k; }

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
    if (activeTab !== 'pick') {
      const search = activeTab === 'home' ? 'search_home_ph'
                    : activeTab === 'int' ? 'search_int'
                    : activeTab === 'fav' ? 'search_fav'
                    : 'search_dom';
      $('#q').placeholder = t(search);
    }
    updateSearchSubmitLabel();
    $('#lang-toggle').textContent = LANG_META[lang]?.label || '中文';
    $('#auth-btn').textContent = user ? (user.name || user.login || t('logout')) : t('login');
    document.documentElement.lang = LANG_META[lang]?.html || 'zh-CN';
  }

  function updateSearchSubmitLabel() {
    const btn = $('#search-submit');
    const label = $('#search-submit [data-i18n]');
    const meta = $('#pick-search-meta');
    if (!label) return;
    const key = activeTab === 'pick' ? 'pick_search_btn' : 'search_button';
    label.dataset.i18n = key;
    label.textContent = t(key);
    btn?.setAttribute('aria-label', t(key));
    if (meta) meta.hidden = activeTab !== 'pick';
  }

  // ───────── favorites (multi-list + drag sort) ─────────
  function favId(r) {
    return r.issn || r.eissn || r.cn_code || ('t:' + normTitle(r.name || r.cn_name || ''));
  }
  function normTitle(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
  }

  // favLists: [{id, name, ids:[...ordered ids...]}]
  let favLists = [];
  let activeListId = null;
  const DEFAULT_FAV_LIST_NAMES = ['默认收藏', 'My Favorites'];
  function defaultFavListName() { return T('默认收藏', 'My Favorites'); }
  function isDefaultFavListName(name) { return DEFAULT_FAV_LIST_NAMES.includes(String(name || '').trim()); }
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

  // isFav = 在当前 active list 中
  function isFav(r) {
    const id = favId(r);
    const list = getActiveList();
    return !!(list && list.ids.includes(id));
  }

  function toggleFav(r, meta = {}) {
    const id = favId(r);
    const list = getActiveList();
    if (!list) return;
    const idx = list.ids.indexOf(id);
    if (idx >= 0) {
      list.ids.splice(idx, 1);
      // 其他 list 都不含它 → 从 favsData 移除
      if (!favLists.some(l => l.ids.includes(id))) delete favsData[id];
    } else {
      list.ids.push(id);
      favsData[id] = { ...r, __src: meta.src || 'int', __savedAt: Date.now() };
    }
    localStorage.setItem(STORAGE_PREFIX + 'favsData', JSON.stringify(favsData));
    persistFavLists();
    updateFavCount();
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
          location.href = `${API_BASE}/auth/${p}?state=${state}&redirect=${redirect}`;
        });
      });
    }
    modal.classList.add('open');
    setTimeout(() => $('.login-email input[name=email]', modal)?.focus(), 50);
  }

  function closeLoginModal() {
    $('#login-modal')?.classList.remove('open');
  }

  async function finishLogin(token, profile = null) {
    let me = profile;
    if (!me) {
      const r = await fetch(`${API_BASE}/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      me = await readJsonResponse(r, T('用户信息获取失败','Failed to fetch user info'));
    }
    user = { ...me, token };
    localStorage.setItem('ailatest.user', JSON.stringify(user));
    await pullFavs();
    applyI18n();
  }

  function doLogout() {
    user = null;
    localStorage.removeItem('ailatest.user');
    applyI18n();
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
  function badgeMEDLINE(m) {
    if (!m) return '';
    return `<span class="badge b-medline" title="${T('MEDLINE 数据库收录（NLM 精选索引）','Indexed in MEDLINE (NLM curated)')}">MEDLINE</span>`;
  }
  function badgeFree(f) {
    if (!f) return '';
    return `<span class="badge b-free" title="${T('提供 OA 发表选项（含 Diamond/Gold/Hybrid）','Offers OA publishing option (Diamond/Gold/Hybrid)')}">${T('免费发表','FREE')}</span>`;
  }
  // 期刊浏览量缓存（journal_key → count）
  const viewsCache = {};
  function badgeView(key) {
    const n = viewsCache[key] || 0;
    const display = n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
    return `<span class="badge b-view" title="${T('累计浏览次数','Total views')}">👁 ${display}</span>`;
  }
  async function reportJournalView(key) {
    if (!key) return;
    try {
      const r = await fetch(`${API_BASE}/journal-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journal_key: key }),
      });
      const d = await r.json().catch(() => null);
      if (d && typeof d.count === 'number') {
        viewsCache[key] = d.count;
        // 回填抽屉中显示的浏览数
        const el = document.getElementById('drawer-views');
        if (el && el.dataset.fid === key) {
          const n = d.count;
          const txt = n >= 1000 ? (n/1000).toFixed(1) + 'k' : String(n);
          el.textContent = (lang === 'en' ? '👁 ' : '👁 ') + txt + (lang === 'en' ? ' views' : ' 次浏览');
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
    return `<span class="if-pill" title="${T('JCR 影响因子 2024','JCR Impact Factor 2024')}">IF ${(+v).toFixed(1)}</span>`;
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
        return `<span class="warn-pill">⚠ Warning</span>`;
      }

  // 统一标签组合：主页 / 收藏页 / 抽屉 / 分享卡片共用同一批 badge 函数与 CSS 类。
  function renderIndexBadges(r) {
    if (!r) return '';
    return [
      badgeFlagship(r.flagship),
      ...((r.indices) || []).map(badgeIndex),
      badgeScopus(r.scopus),
	      badgeOAJ(r.oaj),
	      badgeDOAJ(r.doaj),
	      badgeMEDLINE(r.medline),
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
        // cnkx tier badges removed — now handled by renderDomCrossBadges via domIndex
      r.warning ? badgeWarn(r.warning, true) : '',
    ].filter(Boolean).join('');
  }
  function renderBadgeCell(indexBadges, rankBadges) {
    return [
      indexBadges ? `<div class="badges badges-idx">${indexBadges}</div>` : '',
      rankBadges  ? `<div class="badges badges-rank">${rankBadges}</div>`  : '',
    ].filter(Boolean).join('') || '<span class="muted-cell">—</span>';
  }

  function starBtn(r, src = 'int') {
    const on = isFav(r);
    return `<button class="fav-star ${on?'on':''}" data-fav="${escape(favId(r))}" data-fav-src="${escape(src)}" aria-label="toggle favorite" title="${on?t('fav_removed'):t('fav_added')}">${on?'★':'☆'}</button>`;
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
    // dedupe by source
    const seen = new Set();
    return hits.filter(h => { const k = h.source + ':' + (h.tag||''); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  function buildDomIndex(d) {
    if (!d) return;
    // CSSCI
    (d.cssci_core||[]).forEach(r => {
      addDomIndex(r.name, 'name', { source:'cssci', label:'CSSCI', tag:'', discipline:r.discipline });
    });
    (d.cssci_ext||[]).forEach(r => {
      addDomIndex(r.name, 'name', { source:'cssci_ext', label:T('CSSCI 扩','CSSCI Ext'), tag:'', discipline:r.discipline });
    });
    (d.pku_core||[]).forEach(r => {
      addDomIndex(r.name, 'name', { source:'pku', label:T('北大核心','PKU Core'), tag:'', category:r.category });
    });
    // 中国科协 高质量科技期刊分级目录 (2025-12 修订, 11084 条)
    ((d.cnkx && d.cnkx.records)||[]).forEach(r => {
      if (!r.tier || !/^T[123]$/.test(r.tier)) return;
      addDomIndex(r.name, 'name', { source:'cnkx', label:T('科协','CAST')+' '+r.tier, tag:r.tier, domain:r.domain });
      if (r.issn) addDomIndex(r.issn, 'issn', { source:'cnkx', label:T('科协','CAST')+' '+r.tier, tag:r.tier, domain:r.domain });
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
  function renderDomCrossBadges(r, excludeSource) {
    const hits = lookupDom(r).filter(h => h.source !== excludeSource);
    if (!hits.length) return '';
    return hits.map(h => `<span class="domsrc-pill ds-${h.source}" title="${escape(h.domain||h.discipline||h.category||h.org||'')}">${escape(h.label)}</span>`).join('');
  }

  // 通用中文期刊行渲染
  function renderDomRow(r, opts = {}) {
    const { src, showTier, tierValue, extraCols = '', extraBadges = '' } = opts;
    const fid = favId(r);
    rowRecordsByFid[fid] = { ...r, __src: src };
    const name = r.name || r.cn_name || '';
    const enName = r.en_name ? `<span class="jname-cn">${escape(titleCase(r.en_name))}</span>` : '';
    const crossBadges = renderDomCrossBadges({ name, issn: r.issn, cn_code: r.cn_code }, src);
    const tierBadge = showTier && tierValue ? badgeTier(tierValue) : '';
    return `<tr class="j-row clickable" data-fid="${escape(fid)}" data-src="${escape(src)}">
      <td class="col-fav" style="width:36px">${starBtn(r, src)}</td>
      ${showTier ? `<td style="width:60px">${tierBadge}</td>` : ''}
      <td class="jname" style="font-size:13.5px">${escape(titleCase(name.replace(/\*$/,'')))}${enName}</td>
      <td class="col-cross"><div class="badges">${extraBadges}${crossBadges}</div></td>
      ${extraCols}
    </tr>`;
  }

  function renderRow(r) {
    const fid = favId(r);
    rowRecordsByFid[fid] = { ...r, __src: 'int' };
    const nameHtml = `<div class="jname ${r.flagship ? 'jname-flagship' : ''}">${escape(titleCase(r.name))}${r.cn_name ? `<span class="jname-cn">${escape(r.cn_name)}</span>` : ''}${aliasHintHtml(r)}</div>`;
    const crossBadges = renderDomCrossBadges(r, 'int');
    // 第一行：索引（SCIE/SSCI/AHCI/ESCI/EI）— 回答"这本被哪些数据库收录"
    const indexBadges = renderIndexBadges(r);
    // 第二行：分区/等级/预警 — 回答"这本的等级和影响力"（IF 已移到独立列）
    const rankBadges = [renderRankBadges(r), crossBadges].filter(Boolean).join('');
    const badgeCell = renderBadgeCell(indexBadges, rankBadges);
    const casVal = (lang === 'zh-CN' || lang === 'zh-TW') ? (r.cas_major_cn || '') : tn(r.cas_major_cn || '', 'domain');
    const esiVal = r.esi_category || '';
    const wosVals = Array.isArray(r.wos_categories) ? r.wos_categories.filter(Boolean) : [];
    const wosShown = wosVals.slice(0, 2).join(' / ');
    const casCell = casVal ? escape(casVal) : '<span class="muted-cell">—</span>';
    const esiCell = esiVal ? escape(esiVal) : '<span class="muted-cell">—</span>';
    const wosCell = wosVals.length
      ? `<span title="${escape(wosVals.join(' / '))}">${escape(wosShown)}${wosVals.length > 2 ? ` <span class="muted-cell">+${wosVals.length - 2}</span>` : ''}</span>`
      : '<span class="muted-cell">—</span>';
    const ifVal = (r.if_2024 != null) ? (+r.if_2024).toFixed(1) : '';
    const ifCell = ifVal ? `<span class="if-cell">${ifVal}</span>` : '<span class="muted-cell">—</span>';
    return `<tr data-fid="${escape(fid)}" class="j-row clickable ${r.flagship ? 'row-flagship' : ''}" data-src="int">
      <td class="col-fav">${starBtn(r, 'int')}</td>
      <td class="col-name">${nameHtml}</td>
      <td class="col-free">${freeBadgeCell(r)}</td>
      <td class="col-badge col-badge-split">${badgeCell}</td>
      <td class="col-if">${ifCell}</td>
      <td class="col-cas">${casCell}</td>
      <td class="col-wos">${wosCell}</td>
      <td class="col-esi">${esiCell}</td>
    </tr>`;
  }

  /* ───────── FREE badge helper ───────── */
  function freeBadgeCell(r) {
    return r.free
      ? `<span class="badge b-free" title="${T('提供 OA 发表选项（含 Diamond/Gold/Hybrid）','Offers OA publishing option (Diamond/Gold/Hybrid)')}">${T('免费发表','FREE')}</span>`
      : '<span class="muted-cell">&mdash;</span>';
  }

  function escape(s) {
    return String(s||'').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ───────── filtering ─────────
  function matches(r) {
    // When index dropdown is active, let all journals pass — renderInt() handles the actual filter
    if (activeIdxFilter !== '__all') return true;
    
    // Index filter: exclude ESI from indices[] check (ESI stored as esi_category)
    // ESI adds another OR condition — journal with esi_category also shows
    const esiActive = activeIndices.has('ESI');
    const idxOnly = new Set([...activeIndices].filter(v => v !== 'ESI'));
    const nonWosIdx = ['scopus','oaj','doaj','medline','free'];
    // If column header idx filter selects a non‑WoS index, bypass sidebar activeIndices
    const bypassIdx = nonWosIdx.includes(activeIdxFilter);
    const matchesAny = bypassIdx || !idxOnly.size || (r.indices || []).some(i => idxOnly.has(i));
    if (!matchesAny && !(esiActive && r.esi_category)) {
      // When OAJ / DOAJ / MEDLINE / PubMed / PMC is checked, those journals bypass the
      // index filter (allows pure directory-journals without WoS/EI indices to show)
      if (!((activeFeats.has('oaj') && r.oaj) || (activeFeats.has('doaj') && r.doaj) ||
            (activeFeats.has('medline') && r.medline) ||
            (activeFeats.has('free') && r.free) ||
            (activeFeats.has('warning') && r.warning))) return false;
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
    if (activeFeats.has('ccf') && !r.ccf) return false;
    if (activeFeats.has('cnkx') && !(Array.isArray(r.cnkx) && r.cnkx.length)) return false;
    if (activeFeats.has('xr') && !r.cas_xr) return false;
    if (activeFeats.has('flagship') && !r.flagship) return false;
    if (activeFeats.has('scopus') && !(r.scopus && r.scopus.active)) return false;
    if (activeFeats.has('oaj') && !r.oaj) return false;
    if (activeFeats.has('doaj') && !r.doaj) return false;
    if (activeFeats.has('medline') && !r.medline) return false;
    if (activeFeats.has('free') && !r.free) return false;
    if (activeFeats.has('warning') && !r.warning) return false;
    if (activeFeats.has('abdc') && !(r.abdc && r.abdc.rating)) return false;
    if (activeFeats.has('abs')  && !(r.abs  && r.abs.rating))  return false;
    if (activeCat !== '__all' && r.esi_category !== activeCat) return false;
    if (activeCasMajor !== '__all' && (r.cas_major_cn || '') !== activeCasMajor) return false;
    if (activeIdxFilter !== '__all') {
      const idxValues = ['SCIE','SSCI','AHCI','ESCI','EI'];
      if (idxValues.includes(activeIdxFilter)) {
        if (!(r.indices || []).includes(activeIdxFilter)) return false;
      } else if (activeIdxFilter === 'scopus' && !(r.scopus && r.scopus.active)) return false;
      else if (activeIdxFilter === 'oaj' && !r.oaj) return false;
      else if (activeIdxFilter === 'doaj' && !r.doaj) return false;
      else if (activeIdxFilter === 'medline' && !r.medline) return false;
    }
    if (activeTierFilter !== '__all') {
      const q = (r.if_quartile || '').toUpperCase();
      const z = r.cas_zone != null ? String(r.cas_zone) : '';
      const isTop = !!r.cas_top;
      let tierMatch = false;
      if (activeTierFilter.startsWith('Q') && q === activeTierFilter) tierMatch = true;
      else if (activeTierFilter === 'top' && isTop) tierMatch = true;
      else if (['1','2','3','4'].includes(activeTierFilter) && z === activeTierFilter) tierMatch = true;
      if (!tierMatch) return false;
    }
    if (activeExtraFilter !== '__all') {
      if (activeExtraFilter === 'warning' && !r.warning) return false;
      if (activeExtraFilter.startsWith('abdc:')) {
        const want = activeExtraFilter.slice(5);
        if (!r.abdc || r.abdc.rating !== want) return false;
      }
      if (activeExtraFilter.startsWith('abs:')) {
        const want = activeExtraFilter.slice(4);
        if (!r.abs || r.abs.rating !== want) return false;
      }
    }
    if (activeWos.size) {
      const wc = r.wos_categories || [];
      let ok = false;
      for (const c of wc) if (activeWos.has(c)) { ok = true; break; }
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
      document.documentElement.style.setProperty('--th-sticky-top', h + 'px');
    }
  }

  function renderInt() {
    updateThStickyTop();
    let filtered = journals.filter(matches);
    // ENSURE: if index dropdown is set, apply it directly as a safety net
    if (activeIdxFilter !== '__all') {
      filtered = filtered.filter(r => {
        if (activeIdxFilter === 'medline') return r.medline;
        if (activeIdxFilter === 'scopus') return r.scopus && r.scopus.active;
        if (activeIdxFilter === 'oaj') return r.oaj;
        if (activeIdxFilter === 'doaj') return r.doaj;
        if (['SCIE','SSCI','AHCI','ESCI','EI'].includes(activeIdxFilter)) return (r.indices||[]).includes(activeIdxFilter);
        return true;
      });
    }
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
    filtered = sortByIF(filtered, intIfSort);
    document.querySelector('th.col-if[data-if-sort="int"]')?.classList.toggle('sort-desc', intIfSort === 'desc');
    document.querySelector('th.col-if[data-if-sort="int"]')?.classList.toggle('sort-asc', intIfSort === 'asc');
    const intArrow = document.querySelector('th.col-if[data-if-sort="int"] .sort-arrow');
    if (intArrow) intArrow.textContent = intIfSort === 'asc' ? '▲' : '▼';
    $('#results-title').textContent = activeCat === '__all'
      ? t('results_all') : activeCat;
    const visible = filtered.slice(0, shown);
    const tbody = $('#tbody');
    if (!visible.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">${t('empty')}</td></tr>`;
    } else {
      tbody.innerHTML = visible.map(renderRow).join('');
    }
    $('#results-count').textContent = `${t('showing')} ${visible.length} ${t('of')} ${filtered.length.toLocaleString()} ${t('total_items')}`;
    const more = $('#more');
    more.hidden = filtered.length <= shown;
  }

  // ───────── category nav (ESI sidebar removed; only "全部" reset button remains) ─────────
  function renderCatList() {
    const total = $('#count-all');
    if (total) total.textContent = journals.length.toLocaleString();
    const allBtn = $('#wos-all-btn');
    if (allBtn && !allBtn.__bound) {
      allBtn.__bound = true;
      allBtn.addEventListener('click', () => {
        activeWos.clear();
        $$('.wos-item').forEach(el => el.classList.remove('on'));
        $$('#wos-list input[type=checkbox]').forEach(cb => cb.checked = false);
        const wosSel = $('#wos-col-filter'); if (wosSel) wosSel.value = '__all';
        const inp = $('#wos-search'); if (inp) inp.value = '';
        renderWosList();
        activeCat = '__all';
        shown = PAGE;
        renderInt();
      });
    }
    // 大类列下拉切换：CAS / ESI（v30 移除：现已拆为独立两列）
    // v31: 表头两个下拉填充 distinct 学科 + 触发筛选
    const casSel = $('#cas-col-filter');
    if (casSel && !casSel.__bound) {
      casSel.__bound = true;
      const casSet = new Set();
      journals.forEach(j => { if (j.cas_major_cn) casSet.add(j.cas_major_cn); });
      const casList = [...casSet].sort((a,b) => a.localeCompare(b, 'zh'));
      casSel.innerHTML = `<option value="__all">${T('中科院大类','CAS Major')}</option>` +
        casList.map(v => `<option value="${escape(v)}">${escape(v)}</option>`).join('');
      casSel.value = activeCasMajor;
      casSel.addEventListener('change', () => {
        activeCasMajor = casSel.value;
        shown = PAGE;
        renderInt();
      });
    }
    const esiSel = $('#esi-col-filter');
    if (esiSel && !esiSel.__bound) {
      esiSel.__bound = true;
      const esiSet = new Set();
      journals.forEach(j => { if (j.esi_category) esiSet.add(j.esi_category); });
      const esiList = [...esiSet].sort();
      esiSel.innerHTML = `<option value="__all">${T('ESI 学科','ESI Subject')}</option>` +
        esiList.map(v => `<option value="${escape(v)}">${escape(v)}</option>`).join('');
      esiSel.value = activeCat;
      esiSel.addEventListener('change', () => {
        activeCat = esiSel.value;
        shown = PAGE;
        renderInt();
      });
    }
    const wosSel = $('#wos-col-filter');
    if (wosSel && !wosSel.__bound) {
      wosSel.__bound = true;
      const wosSet = new Set();
      journals.forEach(j => (j.wos_categories || []).forEach(c => { if (c) wosSet.add(c); }));
      const wosList = [...wosSet].sort((a,b) => a.localeCompare(b, 'en'));
      wosSel.innerHTML = `<option value="__all">${T('WoS 学科','WoS Subject')}</option>` +
        wosList.map(v => `<option value="${escape(v)}">${escape(v)}</option>`).join('');
      wosSel.addEventListener('change', () => {
        activeWos.clear();
        if (wosSel.value !== '__all') activeWos.add(wosSel.value);
        $$('#wos-list input[type=checkbox]').forEach(cb => { cb.checked = activeWos.has(cb.value); });
        $$('.wos-item').forEach(el => {
          const v = el.querySelector('input')?.value;
          el.classList.toggle('on', !!v && activeWos.has(v));
        });
        shown = PAGE;
        renderInt();
      });
    }
    if (wosSel) wosSel.value = activeWos.size === 1 ? [...activeWos][0] : '__all';
    // 题头快捷筛选：索引、分区、附加
    ['idx-col-filter','tier-col-filter','extra-col-filter'].forEach(id => {
      const sel = $(`#${id}`);
      if (!sel || sel.__bound) return;
      sel.__bound = true;
      sel.addEventListener('change', () => {
        if (id === 'idx-col-filter') {
          activeIdxFilter = sel.value;
        }
        else if (id === 'tier-col-filter') activeTierFilter = sel.value;
        else activeExtraFilter = sel.value;
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

  function renderWosList() {
    const box = $('#wos-list');
    if (!box || !wosCats.length) return;
    const raw = ($('#wos-search')?.value || '').trim().toLowerCase();
    const tokens = expandWosQuery(raw);
    const filtered = !tokens.length
      ? wosCats
      : wosCats.filter(c => {
          const name = c.name.toLowerCase();
          return tokens.some(t => name.includes(t));
        });
    box.innerHTML = filtered.map(c =>
      `<label class="wos-item${activeWos.has(c.name) ? ' on' : ''}">
         <input type="checkbox" value="${escape(c.name)}" ${activeWos.has(c.name) ? 'checked' : ''}>
         <span class="wos-name">${escape(c.name)}</span>
         <span class="wos-count">${c.count}</span>
       </label>`
    ).join('');
    // bind change
    box.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) activeWos.add(cb.value); else activeWos.delete(cb.value);
        cb.closest('.wos-item').classList.toggle('on', cb.checked);
        const wosSel = $('#wos-col-filter');
        if (wosSel) wosSel.value = activeWos.size === 1 ? [...activeWos][0] : '__all';
        shown = PAGE;
        renderInt();
      });
    });
  }

  function domSourceTabsHTML() {
    const items = [
      ['cnki_major', T('中文期刊目录','Chinese Journal Directory')],
      ['cnkx', T('中国科协','CAST')],
      ['zju_zju', T('浙江大学 2024','ZJU 2024')],
      ['school_a', T('学校 A · 2023','School A · 2023')],
    ];
    return `<div class="dom-source-tabs" role="tablist" aria-label="${T('国内目录切换','Domestic directory switcher')}">
      ${items.map(([key, label]) => `<button type="button" class="dom-source-tab ${activeDom === key ? 'active' : ''}" data-dom-switch="${key}">${escape(label)}</button>`).join('')}
    </div>`;
  }

  function domSectionHeader(title, subtitle = '') {
    return `<div class="dom-section-head">
      <div class="dom-section-copy">
        <h1 class="section-title">${title}</h3>
        ${subtitle ? `<div class="section-subtitle">${subtitle}</div>` : ''}
      </div>
      ${domSourceTabsHTML()}
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
          html: `<div class="table-wrap"><table class="journals"><thead><tr>
            <th style="width:36px" aria-label="Favorite"></th><th style="width:60px">${T('T级','Tier')}</th><th>${T('期刊','Journal')}</th><th>${T('交叉收录','Also In')}</th><th style="width:100px">ISSN</th><th style="width:110px">${T('学科 / 细分','Domain / Sub')}</th>
          </tr></thead><tbody>
          ${recs.slice(0, 200).map(r => renderDomRow(r, {
            src: 'cnkx', showTier: true, tierValue: r.tier,
            extraCols: `<td class="muted-cell" style="width:110px">${escape(tn(r.domain || '', 'domain'))}${r.subdomain ? ' · '+escape(tn(r.subdomain,'sub')) : ''}</td>`,
          })).join('')}
          ${recs.length > 200 ? `<tr><td colspan="6" class="empty">${T('仅显示前 200 条','First 200 only')}</td></tr>` : ''}
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
          html: `<div class="table-wrap"><table class="journals"><thead><tr>
            <th style="width:36px" aria-label="Favorite"></th><th>${T('期刊名称','Journal')}</th><th>${T('收录索引','Indices')}</th><th style="width:110px">ISSN</th><th style="width:100px">CN</th><th style="width:110px">${T('学科分类','Category')}</th>
          </tr></thead><tbody>
          ${list.slice(0, 200).map(r => {
            const hits = lookupDom(r);
            const badges = [
              ...hits.filter(h => h.source === 'cssci').map(() => `<span class="domsrc-pill ds-cssci">CSSCI</span>`),
              ...hits.filter(h => h.source === 'cssci_ext').map(() => `<span class="domsrc-pill ds-cssci-ext">${T('CSSCI 扩','CSSCI Ext')}</span>`),
              ...hits.filter(h => h.source === 'pku').map(() => `<span class="domsrc-pill ds-pku">${T('北大核心','PKU Core')}</span>`),
              ...hits.filter(h => h.source === 'ccft').map(h => `<span class="domsrc-pill ds-ccft">CCF-${h.tag||'T'}</span>`),
              ...hits.filter(h => h.source === 'zju').map(h => `<span class="domsrc-pill ds-zju">${escape(h.label)}</span>`),
              ...hits.filter(h => h.source === 'school_a').map(h => `<span class="domsrc-pill ds-school-a">${escape(h.label)}</span>`),
              ...hits.filter(h => h.source.startsWith('cnkx')).map(h => `<span class="domsrc-pill ds-cnkx">${escape(h.label)}</span>`),
            ].filter(Boolean).join('');
            return `<tr class="j-row clickable" data-fid="${escape(favId(r))}" data-src="cnki_major">
              <td style="width:36px">${starBtn(r, 'cnki_major')}</td>
              <td class="jname" style="font-size:13.5px">${escape(r.name||'')}</td>
              <td class="col-cross"><div class="badges">${badges || '<span class="muted-cell">—</span>'}</div></td>
              <td class="muted-cell" style="width:110px">${escape(r.issn||'—')}</td>
              <td class="muted-cell" style="width:100px">${escape(r.cn_code||'—')}</td>
              <td class="muted-cell" style="width:110px">${escape(((r.major_categories||[]).length ? r.major_categories : (r.categories||[])).join(' · ') || '—')}</td>
            </tr>`;
          }).join('')}
          ${list.length > 200 ? `<tr><td colspan="6" class="empty">${T('仅显示前 200 条','First 200 only')}</td></tr>` : ''}
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
          html: `<div class="table-wrap"><table class="journals"><thead><tr>
            <th style="width:36px" aria-label="Favorite"></th><th style="width:70px">${T('级别','Tier')}</th><th>${T('期刊','Journal')}</th><th>${T('交叉收录','Also In')}</th><th style="width:110px">ISSN / CN</th><th style="width:150px">${T('备注','Note')}</th>
          </tr></thead><tbody>
          ${list.slice(0, 200).map(r => {
            const tierBadge = `<span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(tn(r.tier, 'tier'))}</span>${(r.name||'').includes('*') ? ' <span class="warn-pill" style="background:var(--gold);color:#fff">★</span>' : ''}`;
            return renderDomRow(
              { ...r, name: (r.name||'').replace(/\*$/,'') },
              { src: 'zju', extraCols: `<td class="muted-cell" style="width:150px">${escape(r.note||'')}</td>` }
            ).replace(
              /(<td class="col-fav"[^>]*>.*?<\/td>)/,
              `$1<td style="width:70px">${tierBadge}</td>`
            );
          }).join('')}
          ${list.length > 200 ? `<tr><td colspan="6" class="empty">${T('仅显示前 200 条','First 200 only')}</td></tr>` : ''}
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
          html: `<div class="table-wrap"><table class="journals"><thead><tr>
            <th style="width:36px" aria-label="Favorite"></th><th style="width:70px">${T('级别','Tier')}</th><th>${T('期刊','Journal')}</th><th>${T('交叉收录','Also In')}</th><th style="width:110px">ISSN / CN</th>
          </tr></thead><tbody>
          ${f.slice(0, 200).map(r => {
            const tierBadge = `<span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(tn(r.tier, 'tier'))}</span>`;
            return renderDomRow(
              { ...r, name: (r.name||'').replace(/\*$/,'') },
              { src: 'school_a', extraCols: '' }
            ).replace(/<tr class="j-row clickable" /, `<tr class="j-row clickable" ><td style="width:70px">${tierBadge}</td>`);
          }).join('')}
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

  // ───────── domestic tab ─────────
  function renderDomestic() {
    updateThStickyTop();
    const box = $('#dom-content');
    if (!domestic) { box.innerHTML = `<div class="empty">${T('无数据','No data')}</div>`; return; }
    const q = activeQuery.toLowerCase();

    // ===== 统一搜索：只要有搜索词就跨库聚合，忽略当前库选择 =====
    if (q) return renderDomesticUnified(box, q);

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

      // 筛选状态
      if (!window.__cnkxDomain) window.__cnkxDomain = '__all';
      if (!window.__cnkxSub) window.__cnkxSub = '__all';
      if (!window.__cnkxShown) window.__cnkxShown = 100;

      // 筛选
      let filtered = all.filter(r => {
        if (q) {
          const hay = (r.name + ' ' + (r.issn||'') + ' ' + (r.domain||'') + ' ' + (r.subdomain||'')).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (window.__cnkxDomain !== '__all' && r.domain !== window.__cnkxDomain) return false;
        if (window.__cnkxSub !== '__all' && r.subdomain !== window.__cnkxSub) return false;
        return true;
      });

      // 保留中国科协原始目录顺序：学科领域 / 细分学科 / T级 / 来源表内顺序。

      // 分页
      const visible = filtered.slice(0, window.__cnkxShown);
      const total = filtered.length;

      // 下拉选项
      const domainOpts = domainList.map(d =>
        `<option value="${escape(d)}"${window.__cnkxDomain === d ? ' selected' : ''}>${escape(tn(d, 'domain'))}</option>`
      ).join('');
      const subOpts = subdomainList.map(s =>
        `<option value="${escape(s)}"${window.__cnkxSub === s ? ' selected' : ''}>${escape(tn(s, 'sub'))}</option>`
      ).join('');

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
          <th style="width:160px;padding:0 4px"><select id="cnkx-domain-select" class="th-select"><option value="__all">${T('学科领域','Domain')}</option>${domainOpts}</select></th>
          <th style="width:160px;padding:0 4px"><select id="cnkx-sub-select" class="th-select"><option value="__all">${T('细分学科','Sub-field')}</option>${subOpts}</select></th>
          <th style="width:110px">ISSN</th>
        </tr></thead><tbody>
          ${rows}
          ${total === 0 ? `<tr><td colspan="7" class="empty">${T('未找到匹配的期刊','No matching journals found')}</td></tr>` : ''}
        </tbody></table></div>
        ${total > window.__cnkxShown ? `<div class="pager"><button id="cnkx-more" class="more-btn" style="margin-top:12px;padding:8px 20px;border:1px solid var(--rule);background:var(--paper);color:var(--ink-soft);border-radius:2px;cursor:pointer">${T('加载更多','Load more')} (${total - window.__cnkxShown} ${T('条剩余','remaining')})</button></div>` : ''}
      </div>`;

      // 绑定筛选下拉
      const domSel = document.getElementById('cnkx-domain-select');
      if (domSel) domSel.addEventListener('change', () => { window.__cnkxDomain = domSel.value; window.__cnkxShown = 100; renderDomestic(); });
      const subSel = document.getElementById('cnkx-sub-select');
      if (subSel) subSel.addEventListener('change', () => { window.__cnkxSub = subSel.value; window.__cnkxShown = 100; renderDomestic(); });
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
          // AND logic: 勾选的徽章，期刊必须全部拥有
          if (activeDomBadges.has('cssci') && !hasCssci) return false;
          if (activeDomBadges.has('cssci_ext') && !hasCssciExt) return false;
          if (activeDomBadges.has('pku') && !hasPku) return false;
          if (activeDomBadges.has('ccft') && !hasCcf) return false;
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
        ['cnkx', T('中国科协','CAST')],
        ['zju', T('浙江大学','ZJU')],
      ].map(([value, label]) => `<option value="${escape(value)}"${window.__cnkiIndex === value ? ' selected' : ''}>${escape(label)}</option>`).join('');

      // 按刊名字母排序
      filtered.sort((a, b) => (a.name||'').localeCompare(b.name||'', 'zh'));

      // 分页
      const visible = filtered.slice(0, window.__cnkiShown || 100);
      const total = filtered.length;

      // 渲染行
      const rows = visible.map(r => {
        const fid = favId(r);
        rowRecordsByFid[fid] = { ...r, __src: 'cnki_major' };
        // 查询交叉收录徽章（CSSCI/北大核心/CCF）
        const hits = lookupDom(r);
        const badges = [
          ...hits.filter(h => h.source === 'cssci').map(() => `<span class="domsrc-pill ds-cssci">CSSCI</span>`),
          ...hits.filter(h => h.source === 'cssci_ext').map(() => `<span class="domsrc-pill ds-cssci-ext">${T('CSSCI 扩','CSSCI Ext')}</span>`),
          ...hits.filter(h => h.source === 'pku').map(() => `<span class="domsrc-pill ds-pku">${T('北大核心','PKU Core')}</span>`),
          ...hits.filter(h => h.source === 'ccft').map(h => `<span class="domsrc-pill ds-ccft" title="${escape(h.org||'')}">CCF-${h.tag||'T'}</span>`),
          ...hits.filter(h => h.source === 'zju').map(h => `<span class="domsrc-pill ds-zju">${escape(h.label)}</span>`),
          ...hits.filter(h => h.source === 'school_a').map(h => `<span class="domsrc-pill ds-school-a">${escape(h.label)}</span>`),
          ...hits.filter(h => h.source.startsWith('cnkx')).map(h => `<span class="domsrc-pill ds-cnkx">${escape(h.label)}</span>`),
        ].filter(Boolean).join('');
        const name = r.name || '';
        const isnCell = r.issn ? `<span class="jissn">${escape(r.issn)}</span>` : (r.cn_code ? `<span class="jissn">${escape(r.cn_code)}</span>` : '<span class="muted-cell">—</span>');
        const displayCats = (r.major_categories || []).length ? r.major_categories : (r.categories || []);
        const catCell = displayCats.length ? displayCats.map(c => `<span class="cat-inline">${escape(c)}</span>`).join('') : '<span class="muted-cell">—</span>';
        return `<tr class="j-row clickable cnki-row" data-fid="${escape(fid)}" data-src="cnki_major">
          <td class="col-fav" style="width:36px">${starBtn(r, 'cnki_major')}</td>
          <td class="jname cnki-name">${escape(name)}</td>
          <td class="col-cross"><div class="badges">${badges || '<span class="muted-cell">—</span>'}</div></td>
          <td class="muted-cell" style="width:110px">${catCell}</td>
          <td style="width:110px">${isnCell}</td>
          <td class="muted-cell" style="width:100px">${escape(r.cn_code||'—')}</td>
        </tr>`;
      }).join('');

      box.innerHTML = `<div class="section-block">
        ${domSectionHeader(
          T('中文期刊目录','Chinese Journal Directory'),
          `${T('共收录','Total ')} ${all.length.toLocaleString()} ${T('种中文期刊',' Chinese journals')}${q ? T(' · 搜索: ',' · Search: ')+escape(q) : ''}`,
        )}
        <div class="table-wrap cnki-table-wrap"><table class="journals cnki-table"><thead><tr>
          <th style="width:36px" aria-label="Favorite"></th>
          <th>${T('期刊名称','Journal')}</th>
          <th style="min-width:180px;padding:0 4px"><select id="cnki-index-select" class="th-select"><option value="__all">${T('收录索引','Indices')}</option>${indexOptions}</select></th>
          <th style="width:160px;padding:0 4px"><select id="cnki-cat-select" class="th-select"><option value="__all">${T('学科分类','Category')}</option>${catOptions}</select></th>
          <th style="width:110px">ISSN</th>
          <th style="width:100px">CN</th>
        </tr></thead><tbody>
          ${rows}
          ${total === 0 ? `<tr><td colspan="6" class="empty">${T('未找到匹配的期刊','No matching journals found')}</td></tr>` : ''}
        </tbody></table></div>
        ${total > (window.__cnkiShown || 100) ? `<div class="pager"><button id="cnki-more" class="more-btn" style="margin-top:12px;padding:8px 20px;border:1px solid var(--rule);background:var(--paper);color:var(--ink-soft);border-radius:2px;cursor:pointer">${T('加载更多','Load more')} (${total - (window.__cnkiShown||100)} ${T('条剩余','remaining')})</button></div>` : ''}
      </div>`;

      // 绑定分类下拉
      const indexSelect = document.getElementById('cnki-index-select');
      if (indexSelect) {
        indexSelect.addEventListener('change', () => {
          window.__cnkiIndex = indexSelect.value;
          window.__cnkiShown = 100;
          renderDomestic();
        });
      }
      const catSelect = document.getElementById('cnki-cat-select');
      if (catSelect) {
        catSelect.addEventListener('change', () => {
          window.__cnkiCat = catSelect.value;
          window.__cnkiShown = 100;
          renderDomestic();
        });
      }

      // 绑定加载更多
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
          <div class="table-wrap" style="margin-top:10px"><table class="journals"><thead><tr>
            <th style="width:70px">${T('级别','Tier')}</th><th>${T('期刊','Journal')}</th><th style="width:110px">ISSN / CN</th><th style="width:150px">${T('备注','Note')}</th><th>${T('交叉收录','Also In')}</th><th style="width:40px"></th>
          </tr></thead><tbody>
          ${recs.slice(0, 1500).map(r => {
            const tierBadge = `<span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(tn(r.tier, "tier"))}</span>${r.name.includes('*') ? ' <span class="warn-pill" style="background:var(--gold);color:#fff">★</span>' : ''}`;
            return renderDomRow(
              { ...r, name: r.name.replace(/\*$/,'') },
              {
                src: 'zju',
                extraCols: `<td class="muted-cell" style="width:150px">${escape(r.note||'')}</td>`,
                extraBadges: '',
              }
            ).replace(
              /<td style="width:60px">[^<]*<\/td>/, ''
            ).replace(
              /<tr class="j-row clickable" (data-fid=[^>]+)>/,
              `<tr class="j-row clickable" $1><td style="width:70px">${tierBadge}</td>`
            );
          }).join('')}
          ${recs.length > 1500 ? `<tr><td colspan="6" class="empty">${T('仅显示前 1500 条，请在搜索框内精确查找','Showing first 1500 — please refine search')}</td></tr>` : ''}
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
            <div class="table-wrap" style="margin-top:10px"><table class="journals"><thead><tr>
              <th style="width:70px">${T('级别','Tier')}</th><th>${T('期刊','Journal')}</th><th style="width:110px">ISSN / CN</th><th style="width:150px">${T('备注','Note')}</th><th>${T('交叉收录','Also In')}</th><th style="width:40px"></th>
            </tr></thead><tbody>
            ${recs.slice(0, 1500).map(r => {
              const tierBadge = `<span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(tn(r.tier, "tier"))}</span>${r.name.includes('*') ? ' <span class="warn-pill" style="background:var(--gold);color:#fff">★</span>' : ''}`;
              return renderDomRow(
                { ...r, name: r.name.replace(/\*$/,'') },
                { src: 'school_a', extraCols: `<td class="muted-cell" style="width:150px">${escape(r.note||'')}</td>` }
              ).replace(
                /<tr class="j-row clickable" (data-fid=[^>]+)>/,
                `<tr class="j-row clickable" $1><td style="width:70px">${tierBadge}</td>`
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
  // 跨源按 favId 检索任意期刊记录（用于 #j/<id> 深链）
  function findRecByFid(id) {
    if (!id) return null;
    const wantedList = journalRouteKeyList(id);
    const findIn = (arr, src) => {
      for (const wantedKey of wantedList) {
        for (const r of arr || []) {
          if (recordRouteKeys(r).has(wantedKey)) {
            const rr = Object.assign({}, r);
            if (src && !rr.__src) rr.__src = src;
            return rr;
          }
        }
      }
      return null;
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
        ['cnkx', (domestic.cnkx && domestic.cnkx.records) || []],
        ['zju', (domestic.zju && domestic.zju.records) || []],
      ];
      for (const [src, arr] of groups) {
        const rr = findIn(arr, src);
        if (rr) return rr;
      }
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
        const pickEl = document.querySelector('[data-tab="pick"]');
        if (pickEl) {
          pickEl.click();
          const searchInput = $('#q');
          if (searchInput) searchInput.value = q;
          setTimeout(() => {
            const btn = $('#pick-search-btn');
            if (btn) btn.click();
          }, 800);
        }
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
    _currentDrawerRec = r;
    const pageMode = !!(opts && opts.pageMode);
    document.body.classList.toggle('journal-route', pageMode);
    const drawer = $('#j-drawer'), scrim = $('#drawer-scrim'), body = $('#drawer-body');
    if (!drawer || !body) return;
    // 懒加载 OpenAlex 数据（首次打开抽屉时加载）
    if (!oaMap) {
      try { oaMap = await fetchJSON('data/oa.json.gz'); }
      catch(e) { oaMap = {}; }
    }
    // 上报浏览（无需登录），结果回填进 cache
    reportJournalView(favId(r));
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
	    const titleFeatureBadges = (ir.free || r.free) ? badgeFree(true) : '';
	    const tierBadge = r.tier && /^T[123]$/.test(r.tier) ? badgeTier(r.tier)
                    : r.tier ? `<span class="tier-pill t3">${escape(tn(r.tier, "tier"))}</span>` : '';
    const crossBadges = renderDomCrossBadges(r, src);

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
      const isDomesticJournal = src !== 'int';
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
      const apcValue = oa?.apc || oa?.apc_usd || r.doaj?.fee || ir.doaj?.fee || r.doaj?.apc_amount || ir.doaj?.apc_amount || '';
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
      const coverUrl = r.cover_url || ir.cover_url || r.official_cover_url || ir.official_cover_url || '';
      const cover = coverUrl
        ? `<img class="journal-cover-img" src="${escape(coverUrl)}" alt="${escape(title)} cover" loading="lazy" />`
        : `<div class="journal-cover-fallback" aria-hidden="true">
             <div class="journal-cover-mark">${escape((title || 'J').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase())}</div>
             <div class="journal-cover-name">${escape(title)}</div>
             ${r.publisher ? `<div class="journal-cover-pub">${escape(r.publisher)}</div>` : ''}
           </div>`;
      return `<div class="journal-overview">
        <div class="journal-overview-copy">
          <h4>${officialText ? T('官方介绍','Official Description') : T('期刊概览','Journal Overview')}</h4>
          <p>${officialText ? escape(officialText) : escape(fallbackText)}</p>
        </div>
        <div class="journal-cover">${cover}</div>
      </div>`;
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
    const ifNote = ir.if_2024 != null ? T('JCR 2025发布 · 2024指标','JCR 2025 rel. · 2024 metric') : '';
    const statsHTML = stats.length ? `<div class="stats-grid stats-count-${Math.min(stats.length, 4)}">${stats.map(([k,v,sub]) =>
      `<div class="stat"><div class="stat-v">${escape(String(v))}</div><div class="stat-k">${k}</div>${sub?`<div class="stat-sub">${sub}</div>`:''}</div>`
    ).join('')}</div>${ifNote ? `<div class="stats-sub">${ifNote}</div>` : ''}` : '';

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
        <h4>${T('JCR 2025 学科分区','JCR 2025 Subject Categories')}</h4>
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
    const eiHTML = (Array.isArray(ir.ei_subjects) && ir.ei_subjects.length)
      ? `<div class="drawer-section">
           <h4>${T('Ei Compendex 主题','Ei Compendex Subjects')}</h4>
           <div class="cat-chips">${ir.ei_subjects.map(c => `<span class="cat-chip">${escape(c)}</span>`).join('')}</div>
         </div>`
      : '';

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

    // OpenAlex enriched block (homepage / OA / APC)
    const oaHTML = oa ? (() => {
      const labelMap = {
        diamond:                 { text: T('Diamond OA · 读投全免费','Diamond OA · free to read & publish'),   cls: 'oa-diamond',  desc: T('由机构/基金全额资助，作者读者都不付费。','Fully funded by institutions / grants. No fees for authors or readers.') },
        gold_apc:                { text: T('Gold OA · 投稿付 APC','Gold OA · APC paid by author'),       cls: 'oa-gold',     desc: T('全刊开放获取，作者支付版面费（APC）。','Fully open-access; author pays the APC.') },
        hybrid:                  { text: T('Hybrid · 可选 OA','Hybrid · optional OA'),           cls: 'oa-hybrid',   desc: T('订阅制刊，可选付 APC 开放单篇。','Subscription journal; optional APC to open individual articles.') },
        subscription_paid_read:  { text: T('订阅制 · 读付费','Subscription · paid read'),            cls: 'oa-sub',      desc: T('读者需订阅，作者投稿通常免费（个别收 page charge）。','Readers subscribe; authors usually free (some charge page fees).') },
        unknown:                 { text: T('付费模式未知','OA model unknown'),               cls: 'oa-unk',      desc: '' },
      };
      // Normalize both compact (hp/l/oa/dj/apc/org/w) and verbose shapes
      const label   = oa.l || oa.label || 'unknown';
      const L       = labelMap[label] || labelMap.unknown;
      const homepage= oa.hp || oa.homepage;
      const isoa    = oa.oa ?? oa.is_oa;
      const doaj    = oa.dj ?? oa.in_doaj;
      const org     = oa.org || oa.host_org;
      const works   = oa.w   || oa.works_count;
      const doajFee = ir.doaj?.fee || ir.doaj?.apc_amount || '';
      const apcText = (ir.doaj?.apc === 'Yes' && doajFee) ? doajFee : (ir.doaj?.apc === 'Yes' ? T('有 APC','Has APC') : '');
      const doajBadge = doaj ? `<span class="oa-chip oa-doaj">&check; ${T('收录 DOAJ','In DOAJ')}</span>` : '';
      const isoaBadge = isoa ? '<span class="oa-chip oa-isoa">Open Access</span>' : '';
      const freeBadge = r.free ? `<span class="oa-chip oa-free" title="${T('提供 OA 发表选项（含 Diamond/Gold/Hybrid）','Offers OA publishing option (Diamond/Gold/Hybrid)')}">${T('✓ 免费发表','✓ FREE')}</span>` : '';
      const rows = [];
      if (homepage) rows.push([T('官网','Website'), `<a href="${escape(homepage)}" target="_blank" rel="noopener nofollow">${escape(homepage.replace(/^https?:\/\//,'').replace(/\/$/,''))}</a>`]);
      if (apcText) rows.push([T('版面费 (APC)','APC'), escape(apcText)]);
      if (org) rows.push([T('出版方 (OpenAlex)','Publisher (OpenAlex)'), escape(org)]);
      if (works) rows.push([T('已发表论文','Published works'), works.toLocaleString() + T(' 篇','')]);
      return `<div class="drawer-section oa-section">
        <h4>${T('开放获取 / 版面费','Open Access / APC')}</h4>
        <div class="oa-head">
          <span class="oa-pill ${L.cls}">${L.text}</span>
          ${doajBadge}${isoaBadge}${freeBadge}
        </div>
        ${L.desc ? `<div class="oa-desc muted">${L.desc}</div>` : ''}
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
      <div class="meta-row"><div class="meta-k">APC</div><div class="meta-v">${escape(ir.doaj.apc || '—')}${(ir.doaj.fee || ir.doaj.apc_amount) ? ` · ${escape(ir.doaj.fee || ir.doaj.apc_amount)}` : ''}</div></div>
      <div class="meta-row"><div class="meta-k">${T('同行评议','Peer review')}</div><div class="meta-v">${escape(ir.doaj.review || ir.doaj.review_process || '—')}</div></div>
      ${ir.doaj.du || ir.doaj.doaj_url ? `<div class="meta-row"><div class="meta-k">DOAJ</div><div class="meta-v"><a href="${escape(ir.doaj.du || ir.doaj.doaj_url)}" target="_blank" rel="noopener">${T('打开目录页','Open directory page')}</a></div></div>` : ''}
      <div class="muted-cell" style="font-size:11px;margin-top:4px">
        ${T('数据来源：DOAJ Journal CSV。免费 CSV 可能较完整数据滞后。','Source: DOAJ Journal CSV. The free CSV may lag the full data dump.')}
      </div>
    </div>` : '';

    // 审稿周期已合并入 stats，此处保留空块以兼容（不输出）
    const cycleHTML = '';

    const on = isFav(r);
    body.innerHTML = `
      <div class="drawer-hero">
        <div class="drawer-titlebar">
          <div class="drawer-title-main">
            <div class="drawer-title-line">
              <div class="drawer-title">${escape(title.replace(/\*$/,''))}</div>
              ${titleFeatureBadges ? `<div class="drawer-title-badges">${titleFeatureBadges}</div>` : ''}
            </div>
            ${sub ? `<div class="drawer-sub">${escape(sub)}</div>` : ''}
          </div>
          <div class="drawer-actions">
            <div class="rating-pill" data-rating-key="${escape(favId(r))}" title="${T('综合推荐评分','Overall rating')}">
              <span class="rating-avg" id="rating-avg">—</span><span class="rating-avg-suffix">/ 5</span>
              <span class="rating-avg-stars" id="rating-avg-stars"></span>
              <span class="rating-count muted-cell" id="rating-count">${T('暂无评分','No ratings yet')}</span>
            </div>
            <button class="big-btn ${on?'ghost':'primary'}" id="drawer-fav-big">${on ? T('★ 已收藏（点击取消）','★ Favorited (click to remove)') : T('☆ 加入收藏','☆ Add to favorites')}</button>
            ${favLists.length > 1 ? `<div class="drawer-fav-select">
              <span class="muted-cell" style="font-size:12px">${T('保存到：','Save to:')}</span>
              <select id="drawer-fav-list-select">${favLists.map(l => `<option value="${escape(l.id)}" ${l.id===activeListId?'selected':''}>${escape(favListDisplayName(l))} (${l.ids.length})</option>`).join('')}</select>
            </div>` : ''}
          </div>
        </div>
	        <div class="drawer-issn">
	          ${issn ? 'ISSN ' + escape(issn) : ''}${eissn ? ' · eISSN ' + escape(eissn) : ''}
	          <span class="drawer-views" id="drawer-views" data-fid="${escape(favId(r))}"></span>
	        </div>
	        ${journalIntroHTML}
	        ${(drawerIndexBadges || drawerRankBadges || tierBadge || crossBadges) ? `<div class="hero-badge-grid">
	          ${drawerIndexBadges ? `<div class="drawer-section badges-section"><h4>${T('索引收录','Index Coverage')}</h4><div class="badges">${drawerIndexBadges}</div></div>` : ''}
	          ${(drawerRankBadges || tierBadge || crossBadges) ? `<div class="drawer-section badges-section"><h4>${T('分区等级','Tier & Ranking')}</h4><div class="badges">${drawerRankBadges}${tierBadge}${crossBadges}</div></div>` : ''}
	        </div>` : ''}
	      </div>
	      ${statsHTML}
	      <div class="journal-detail-masonry">
	        ${jcrHTML}
	        ${casHTML}
	        ${xrHTML}
	        ${wosHTML}
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
		        ${metaHTML ? `<div class="meta-block">${metaHTML}</div>` : ''}
	        ${cnkxHTML}
	        ${lockedSrcHTML}
	        <div class="drawer-section rating-section" data-rating-key="${escape(favId(r))}">
	          <h4>${T('我的评分','My Rating')}</h4>
	          <div class="rating-my-wrap">
	            <div class="rating-stars-input" id="rating-input" role="radiogroup" aria-label="${T('评分','Rating')}"></div>
	            <div class="rating-my-hint muted-cell" id="rating-hint">${T('登录后可打分 · 半星可评 · 可随时修改','Sign in to rate · half-stars supported · editable anytime')}</div>
	          </div>
	        </div>
	      </div>
	      ${renderRelatedHTML(r)}
	    `;
    // init rating widget
    setTimeout(() => initRatingWidget(favId(r)), 0);
    // related journal cards → click to open that journal's drawer
    body.querySelectorAll('.related-card').forEach(card => {
      card.addEventListener('click', () => {
        const fid = card.dataset.fid;
        const rec = journals.find(j => favId(j) === fid) || favsData[fid];
        if (rec) {
          if (_currentDrawerRec) _drawerStack.push(_currentDrawerRec);
          openDrawer(rec, { pageMode: document.body.classList.contains('journal-route') });
        }
      });
    });
    // drawer list selector: switch active list before toggling
    const drawerListSel = document.getElementById('drawer-fav-list-select');
    if (drawerListSel) {
      drawerListSel.addEventListener('change', () => {
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
    // 渲染抽屉副标题标签
    const kicker = $('#drawer-kicker');
    if (kicker) {
      const SRC = {
        int: T('SCI / SSCI 国际期刊','International SCI / SSCI'), cssci: T('CSSCI 来源期刊','CSSCI Source Journals'), cssci_ext: T('CSSCI 扩展版','CSSCI Extended'),
        pku: T('北大核心','PKU Core'), cnkx: T('中国科协高质量目录','CAST Tiered Directory'), ccft: T('CCF 推荐中文科技期刊','CCF Recommended Chinese Journals'),
        zju: T('浙江大学 2024','ZJU 2024'), school_a: T('高校自编目录 2023','In-house School Directory 2023'),
      };
      kicker.textContent = SRC[src] || T('期刊详情','Journal Details');
    }

    drawer.classList.add('open');
    drawer.classList.toggle('journal-page', pageMode);
    if (pageMode) {
      scrim?.classList.remove('on');
      if (scrim) scrim.hidden = true;
    } else {
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
    $('#j-drawer')?.classList.remove('open', 'journal-page');
    const scrim = $('#drawer-scrim');
    scrim?.classList.remove('on');
    if (scrim) scrim.hidden = true;
    drawerOpen = false;
    _currentDrawerRec = null;
    document.body.classList.remove('journal-route');
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

  function renderJournalRoutePage() {
    const slug = journalPathSlug();
    if (!slug) return false;
    const rec = findRecByFid(slug);
    if (!rec) {
      document.body.classList.add('journal-route');
      const drawer = $('#j-drawer'), body = $('#drawer-body'), scrim = $('#drawer-scrim');
      if (drawer && body) {
        drawer.classList.add('open', 'journal-page');
        scrim?.classList.remove('on');
        if (scrim) scrim.hidden = true;
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

  // ───────── favorites tab ─────────
  function renderFav() {
    const box = $('#fav-content');
    const list = getActiveList();
    if (!list) { box.innerHTML = `<div class="empty" style="padding:60px 20px;text-align:center;color:var(--muted)">${T('还没有收藏。切到「国际 SCI/SSCI」点任意一行右边的 ★ 就能收藏。','No favorites yet. Go to "International" and click the ★ on any row.')}</div>`; return; }

    // list 管理栏（全列表切换 + 新建/重命名/删除）
    const bar = favLists.map(l => `
      <button class="fav-list-chip ${l.id === activeListId ? 'active' : ''}" data-list="${escape(l.id)}">
        <span class="lname">${escape(favListDisplayName(l))}</span>
        <span class="lcount">${l.ids.length}</span>
      </button>`).join('');
    const toolbar = `
      <div class="fav-toolbar">
        <div class="fav-list-chips">${bar}</div>
        <div class="fav-list-ops">
          <button class="btn-mini" id="fav-list-new" title="${T('新建清单','New list')}">＋ ${T('新建','New')}</button>
          <button class="btn-mini" id="fav-list-rename" title="${T('重命名当前','Rename current')}">✎ ${T('重命名','Rename')}</button>
          <button class="btn-mini" id="fav-list-share" title="${T('生成分享短链','Generate share link')}">🔗 ${T('分享','Share')}</button>
          <button class="btn-mini btn-danger" id="fav-list-del" title="${T('删除当前','Delete current')}" ${favLists.length<=1?'disabled':''}>🗑 ${T('删除','Delete')}</button>
        </div>
      </div>`;

    // 取当前 list 的有序记录
    let rows = [];
    for (const id of list.ids) {
      // 优先使用实时数据，收藏时保存的旧数据可能过时（如刊名大小写变化）
      let rec = journals.find(r => favId(r) === id);
      if (!rec && domestic) {
        // 搜索国内源
        const src = favsData[id]?.__src || 'cnki_major';
        const domRecs = [
          ...(domestic.cnkx?.records || []).map(r => ({ ...r, __src: 'cnkx' })),
          ...(domestic.cnki_major?.records || []).map(r => ({ ...r, __src: 'cnki_major' })),
        ];
        rec = domRecs.find(r => favId(r) === id);
      }
      if (!rec) rec = favsData[id]; // 最终 fallback
      if (rec) rows.push({ ...rec, __src: rec.__src || 'int' });
    }
    if (activeQuery) {
      const q = activeQuery.toLowerCase();
      rows = rows.filter(r => scoreRecord(r, activeQuery) > 0 || (
        (r.name||'') + ' ' + (r.cn_name||'') + ' ' + (r.en_name||'') + ' ' +
        (r.issn||'') + ' ' + (r.cn_code||'')
      ).toLowerCase().includes(q));
    }
    rows = sortByIF(rows, favIfSort);

    if (!rows.length) {
      box.innerHTML = toolbar + `<div class="empty" style="padding:40px 0">${t('empty_fav')}</div>`;
      attachFavBarHandlers();
      return;
    }

    // 单一有序表格 + 拖动
    const tbody = rows.map(r => renderFavRow(r)).join('');
    const hint = activeQuery ? '' : `<div class="fav-drag-hint">${T('按住','Hold')} <span class="drag-ico">⋮⋮</span> ${T('拖动排序 · 长按手机端同样支持','to drag-reorder · long-press on mobile')}</div>`;
    box.innerHTML = toolbar + hint + `
      <div class="table-wrap" style="margin-top:10px">
        <table class="journals fav-table">
          <thead><tr>
            <th class="col-drag" style="width:28px"></th>
            <th class="col-fav" aria-label="Favorite"></th>
            <th class="col-name">${T('期刊 Title','Journal Title')}</th>
            <th class="col-badge">${T('索引 / 分区','Indices / Tier')}</th>
            <th class="col-if sortable ${favIfSort === 'desc' ? 'sort-desc' : favIfSort === 'asc' ? 'sort-asc' : ''}" data-if-sort="fav">IF <span class="sort-arrow">${favIfSort === 'asc' ? '▲' : '▼'}</span></th>
            <th class="col-cas">${T('中科院大类','CAS Major')}</th>
            <th class="col-esi">ESI Subject</th>
            <th class="col-src" style="width:90px">${T('来源','Source')}</th>
          </tr></thead>
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
  }

  // ───────── share lists ─────────
  async function openShareDialog() {
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
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
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
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('open'));
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
    const url = `${location.origin}${location.pathname}#j/${encodeURIComponent(id)}`;
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
    const ifNote = ir.if_2024 != null ? T('JCR 2025发布 · 2024指标','JCR 2025 · 2024 IF') : '';
    const statsHtml = stats.length ? `<div class="jcard-stats">${stats.map(([k,v,sub]) => `<div class="jcard-stat"><div class="jcard-stat-v">${v}</div><div class="jcard-stat-k">${k}</div>${sub?`<div class="jcard-stat-sub">${sub}</div>`:''}</div>`).join('')}</div>${ifNote ? `<div class="jcard-stats-sub">${ifNote}</div>` : ''}` : '';

    const meta = [];
    if (ir.cas_major_cn) meta.push([T('中科院大类','CAS Major'), ir.cas_major_cn]);
    if (ir.esi_category) meta.push([T('ESI 高被引','ESI Category'), ir.esi_category]);
    if (ir.abdc && ir.abdc.rating) meta.push([T('ABDC 等级','ABDC Rating'), ir.abdc.rating + (ir.abdc.field ? ' · ' + ir.abdc.field : '')]);
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

    // OA / 订阅模式 + APC
    const oaRec = ir.oa || lookupOA(ir.issn || ir.eissn ? ir : r);
    if (oaRec) {
      const labelMapShort = {
        diamond: T('Diamond · 读投全免费','Diamond · free both ways'),
        gold_apc: T('Gold OA · 投稿付 APC','Gold OA · author pays APC'),
        hybrid: T('Hybrid · 可选 OA','Hybrid · optional OA'),
        subscription_paid_read: T('订阅制 · 读付费','Subscription · paid read'),
        unknown: T('未知','Unknown'),
      };
      const lab = oaRec.l || oaRec.label || 'unknown';
      const doaj = oaRec.dj ?? oaRec.in_doaj;
      let oaText = labelMapShort[lab] || labelMapShort.unknown;
      const doajFee = ir.doaj?.fee || ir.doaj?.apc_amount || '';
      if (ir.doaj?.apc === 'Yes' && doajFee) oaText += ` · APC ${doajFee}`;
      else if (ir.doaj?.apc === 'Yes') oaText += T(' · 有 APC',' · has APC');
      if (doaj) oaText += T(' · 收录 DOAJ',' · in DOAJ');
      meta.push([T('开放获取','Open Access'), oaText]);
    }
    const metaHtml = meta.length ? `<div class="jcard-meta">${meta.map(([k,v]) => `<div class="jcard-meta-row"><span class="jcard-meta-k">${k}</span><span class="jcard-meta-v">${escape(v)}</span></div>`).join('')}</div>` : '';

    let modal = document.getElementById('share-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'share-modal'; modal.className = 'share-modal';
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
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

    document.getElementById('share-close-btn').addEventListener('click', () => modal.classList.remove('open'));

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
    rowRecordsByFid[fid] = r;
    const rawName = r.name || r.cn_name || '';
    const nameHtml = `<div class="jname ${r.flagship ? 'jname-flagship' : ''}">${escape(titleCase(rawName.replace(/\*$/,'')))}${r.cn_name && r.cn_name !== rawName ? `<span class="jname-cn">${escape(r.cn_name)}</span>` : ''}${r.en_name && r.en_name !== rawName ? `<span class="jname-cn">${escape(titleCase(r.en_name))}</span>` : ''}${aliasHintHtml(r)}</div>`;
    // 索引行
    const indexBadges = r.__src === 'int' ? renderIndexBadges(r) : '';
    // 分区/等级行（IF 已移到独立列）
    const rankBadges = r.__src === 'int' ? renderRankBadges(r) : '';
    const tierBadge = r.tier && /^T[123]$/.test(r.tier) ? badgeTier(r.tier)
                    : r.tier ? `<span class="tier-pill t3">${escape(tn(r.tier, "tier"))}</span>` : '';
    const crossBadges = renderDomCrossBadges(r, r.__src);
    const otherBadges = [tierBadge, crossBadges].filter(Boolean).join('');
    const badgeCell = renderBadgeCell(indexBadges, [rankBadges, otherBadges].filter(Boolean).join(''));
    const casVal = (lang === 'zh-CN' || lang === 'zh-TW') ? (r.cas_major_cn || '') : tn(r.cas_major_cn || '', 'domain');
    const esiVal = r.esi_category || '';
    const casCell = casVal ? escape(casVal) : '<span class="muted-cell">—</span>';
    const esiCell = esiVal ? escape(esiVal) : '<span class="muted-cell">—</span>';
    const SRC_LABEL = {
      int: T('国际','Int’l'), cssci: 'CSSCI', cssci_core: 'CSSCI', cssci_ext: T('CSSCI扩展','CSSCI Ext'),
      pku: T('北大核心','PKU Core'), pku_core: T('北大核心','PKU Core'), cnkx: T('科协','CAST'), ccft: 'CCF-T',
      zju: T('浙大','ZJU'), school_a: T('高校目录','In-house'),
    };
    const ifVal = (r.if_2024 != null) ? (+r.if_2024).toFixed(1) : '';
    const ifCell = ifVal ? `<span class="if-cell">${ifVal}</span>` : '<span class="muted-cell">—</span>';
    return `<tr class="j-row clickable" data-fid="${escape(fid)}" data-src="${escape(r.__src)}">
      <td class="col-drag"><span class="drag-handle" title="${T('拖动排序','Drag to reorder')}">⋮⋮</span></td>
      <td class="col-fav">${starBtn(r, r.__src)}</td>
      <td class="col-name">${nameHtml}</td>
      <td class="col-badge col-badge-split">${badgeCell}</td>
      <td class="col-if">${ifCell}</td>
      <td class="col-cas">${casCell}</td>
      <td class="col-esi">${esiCell}</td>
      <td class="col-src"><span class="src-tag src-${escape(r.__src)}">${SRC_LABEL[r.__src] || r.__src}</span></td>
    </tr>`;
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
      const freeCol = document.getElementById('free-col-filter');
      if (freeCol) freeCol.checked = checked;
      document.querySelectorAll('.feat-row input[value="free"]').forEach(input => { input.checked = checked; });
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
    $('#wos-search')?.addEventListener('input', () => renderWosList());
    $('#wos-clear')?.addEventListener('click', () => {
      activeWos.clear();
      const inp = $('#wos-search'); if (inp) inp.value = '';
      renderWosList();
      shown = PAGE; renderInt();
    });
    $('#q').addEventListener('input', (e) => {
      activeQuery = e.target.value.trim();
      shown = PAGE;
      if (activeTab === 'pick') return; // pick tab uses Enter
      if (activeTab === 'home') {
        showHomeSearchResults();
      } else {
        activeTab === 'int' ? renderInt()
          : activeTab === 'fav' ? renderFav()
          : activeTab === 'dom' ? renderDomestic()
          : null;
      }
    });
    $('#q').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || activeTab === 'pick') return;
      e.preventDefault();
      activeQuery = e.currentTarget.value.trim();
      shown = PAGE;
      if (!activeQuery) return;
      if (activeTab === 'home') showHomeSearchResults();
      else if (activeTab === 'int') renderInt();
      else if (activeTab === 'fav') renderFav();
      else if (activeTab === 'dom') renderDomestic();
    });
    $('#search-submit')?.addEventListener('click', () => {
      const qEl = $('#q');
      if (!qEl) return;
      activeQuery = qEl.value.trim();
      shown = PAGE;
      if (!activeQuery) {
        qEl.focus();
        return;
      }
      if (activeTab === 'pick') {
        qEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      } else if (activeTab === 'home') {
        showHomeSearchResults();
      } else if (activeTab === 'int') renderInt();
      else if (activeTab === 'fav') renderFav();
      else if (activeTab === 'dom') renderDomestic();
    });
    $('#more').addEventListener('click', () => { shown += PAGE; renderInt(); });

    document.addEventListener('click', (e) => {
      const th = e.target.closest('th.col-if[data-if-sort]');
      if (!th) return;
      const target = th.dataset.ifSort;
      if (target === 'int') {
        intIfSort = intIfSort === 'desc' ? 'asc' : 'desc';
        shown = PAGE;
        renderInt();
      } else if (target === 'fav') {
        favIfSort = favIfSort === 'desc' ? 'asc' : 'desc';
        renderFav();
      }
    });

    /* ───────── Home tab: auto-detect search ───────── */
    const homeResults = $('#home-results');
    const homePanel = $('.tab-panel[data-panel="home"]');

    function showHomeSearchResults() {
      if (!activeQuery) {
        if (homeResults) homeResults.hidden = true;
        if (homePanel) homePanel.classList.remove('home-tab-has-results');
        return;
      }
      if (homePanel) homePanel.classList.add('home-tab-has-results');
      if (homeResults) homeResults.hidden = false;
      renderHomeIntResults();
    }

    function renderHomeIntResults() {
      if (!homeResults) return;
      const q = activeQuery ? activeQuery.toLowerCase() : '';
      if (!q) { homeResults.innerHTML = ''; return; }
      const matchTxt = (...parts) => parts.filter(Boolean).join(' ').toLowerCase().includes(q);

      // Auto-detect: if query has Chinese characters, prioritize domestic
      const hasChinese = /[\u4e00-\u9fff]/.test(q);
      const intLimit = hasChinese ? 15 : 30;
      const domLimit = hasChinese ? 30 : 10;

      let totalCount = 0;
      let sections = [];

      // ── International results ──
      let intFiltered = journals.filter(matches);
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
          label: T('国际期刊','International Journals'),
          html: intFiltered.slice(0, intLimit).map(renderRow).join(''),
          count: intCount
        });
        totalCount += intCount;
      }

      // ── Domestic results ──
      let domCount = 0;
      let domHtml = '';
      if (domestic) {
        const allDomestic = [];
        for (const key of ['cnkx', 'cnki_major', 'zju']) {
          const src = domestic[key];
          if (src && src.records) {
            for (const r of src.records) {
              if (matchTxt(r.name, r.issn, r.cn_code, r.en_name)) {
                allDomestic.push({ ...r, __src: key });
              }
            }
          }
        }
        domCount = allDomestic.length;
        if (domCount) {
          domHtml = allDomestic.slice(0, domLimit).map(r => {
            const fid = favId(r);
            rowRecordsByFid[fid] = { ...r, __src: r.__src };
            const name = r.name || r.cn_name || '';
            const cnName = r.en_name ? `<span class="jname-cn">${escape(titleCase(r.en_name))}</span>` : '';
            const crossBadges = renderDomCrossBadges({ name, issn: r.issn, cn_code: r.cn_code }, r.__src);
            return `<tr data-fid="${escape(fid)}" class="j-row clickable" data-src="${escape(r.__src)}">
              <td class="col-fav">${starBtn(r, r.__src)}</td>
              <td class="jname" style="font-size:13.5px">${escape(titleCase(name.replace(/\*$/,'')))}${cnName}</td>
              <td class="col-cross"><div class="badges">${crossBadges}</div></td>
              <td colspan="2" class="muted-cell">${T('国内来源','Domestic Source')}</td>
            </tr>`;
          }).join('');
        }
      }

      // Order sections: Chinese query → domestic first, English query → int first
      if (hasChinese) {
        if (domCount) {
          sections.unshift({
            label: T('国内期刊','Domestic Journals'),
            html: domHtml,
            count: domCount
          });
          totalCount += domCount;
        }
      } else {
        if (domCount) {
          sections.push({
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
        const limit = hasChinese ? (sec.label.includes('国际') ? 15 : 30) : (sec.label.includes('国际') ? 30 : 10);
        const tabTarget = sec.label.includes('国际') ? 'int' : 'dom';
        const more = sec.count > limit
          ? `<div style="padding:4px 0 10px;display:flex;justify-content:space-between;align-items:center">
              <span class="muted-cell" style="font-size:12px">${T('已显示前','Showing first')} ${limit} ${T('条','')}</span>
              <button class="home-viewall-btn" data-viewall-tab="${tabTarget}" style="font-size:12px;color:var(--accent,#b4531f);background:none;border:none;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:2px">${T('查看全部','View all')} ${sec.count} →</button>
            </div>`
          : '';
        html += `<div class="home-section-label">${sec.label}</div>
          <div class="table-wrap"><table class="journals"><thead><tr>
            <th class="col-fav"></th>
            <th class="col-name">${t('col_name')}</th>
            <th class="col-badge">${t('col_index')}</th>
            <th class="col-if">IF <span class="sort-arrow">▼</span></th>
            <th class="col-cas">${t('col_cas')}</th>
          </tr></thead><tbody>${sec.html}</tbody></table></div>${more}`;
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

    // Also sync topbar search when on home tab
    const origSearchHandler = $('#q')?.addEventListener;
    // (the existing #q listener already handles this for int/dom/fav)

    function activateTab(tab, opts = {}) {
      if (!TAB_PATHS[tab]) tab = 'home';
      if (document.body.classList.contains('journal-route')) {
        _drawerStack = [];
        closeDrawer(true);
      }
      // ── 切换前：把当前搜索框的值存到 activeQuery（仅非选刊tab）──
      const prevTab = activeTab;
      if (prevTab !== 'pick') {
        const qEl = $('#q');
        if (qEl) activeQuery = qEl.value;
      }

      $$('[data-tab]').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
      activeTab = tab;
      updateSearchSubmitLabel();
      $$('.tab-panel').forEach(p => p.hidden = p.dataset.panel !== activeTab);
      $$('[data-international]').forEach(el => el.hidden = activeTab !== 'int');
      $$('[data-domestic]').forEach(el => el.hidden = activeTab !== 'dom');
      // Sidebar: show on int/dom, hide on home/fav/pick
      const sidebar = $('#sidebar');
      if (sidebar) sidebar.style.display = (activeTab === 'int' || activeTab === 'dom') ? '' : 'none';
      // 统一搜索框 #q：更新 placeholder 和内容
      const qEl = $('#q');
      if (qEl) {
        // 选刊tab：清空内容，独立于其他tab
        if (activeTab === 'pick') {
          qEl.value = '';
        } else {
          qEl.value = activeQuery || '';
        }
        qEl.maxLength = 200;
        if (activeTab === 'pick') {
          qEl.placeholder = T('输入你的论文标题和关键词，如：基于深度学习的室内人数预测', 'Enter your paper title and keywords, e.g.: Deep learning for indoor occupancy estimation');
        } else if (activeTab === 'home') {
          qEl.placeholder = t('search_home_ph');
        } else {
          qEl.placeholder = t(activeTab === 'dom' ? 'search_dom' : 'search_int');
        }
      }
      // Reset home UI state when switching away
      if (activeTab !== 'home') {
        const results = $('#home-results');
        const subtabs = $('#home-subtabs');
        const hero = $('.home-hero');
        if (results) results.hidden = true;
        if (subtabs) subtabs.hidden = true;
        if (hero) hero.closest('.tab-panel')?.classList.remove('home-tab-has-results');
      }
      if (!opts.skipPath) {
        const nextPath = TAB_PATHS[activeTab] || '/';
        if (location.pathname !== nextPath) {
          try { history.pushState({ tab: activeTab }, '', nextPath + location.search + location.hash); }
          catch (_) {}
        }
      }
      updatePageSeo(activeTab);
      applyI18n(); // refresh placeholder
      if (activeTab === 'dom') renderDomestic();
      else if (activeTab === 'fav') renderFav();
      else if (activeTab === 'int') renderInt();
      else if (activeTab === 'pick') initPickTool();
      // Home tab: if there's an active query, show results
      else if (activeTab === 'home' && activeQuery) {
        showHomeSearchResults();
      }
    }
    window.__activateJournalTab = activateTab;
    // Home entry pills → switch tab
    document.querySelectorAll('.home-pill[data-tab], .rail-nav-btn[data-tab]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.preventDefault();
        activateTab(b.dataset.tab);
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
      renderDomestic();
    });

    document.querySelectorAll('[data-domestic] .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('[data-domestic] .nav-item').forEach(n => n.classList.remove('active'));
        btn.classList.add('active');
        activeDom = btn.dataset.dom;
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

    // ─── 语言切换下拉菜单 ───
    (function initLangDropdown() {
      const btn = $('#lang-toggle');
      const wrap = btn.closest('.lang-toggle-wrap');
      let dropdown;

      function buildDropdown() {
        dropdown = document.createElement('div');
        dropdown.className = 'lang-dropdown';
        LANG_ORDER.forEach(code => {
          const opt = document.createElement('button');
          opt.dataset.lang = code;
          const meta = LANG_META[code];
          opt.innerHTML = meta.label;
          if (code === lang) opt.classList.add('active');
          opt.addEventListener('click', (e) => {
            e.stopPropagation();
            lang = code;
            localStorage.setItem('ailatest.lang', lang);
            localizeDefaultFavListName();
            persistFavLists(false);
            applyI18n();
            // 重置列头下拉的__bound标记，使其下次用新语言重建
            const casSel2 = $('#cas-col-filter'); if (casSel2) casSel2.__bound = false;
            const esiSel2 = $('#esi-col-filter'); if (esiSel2) esiSel2.__bound = false;
            const wosSel2 = $('#wos-col-filter'); if (wosSel2) wosSel2.__bound = false;
            renderWosList();
            if (activeTab === 'dom') renderDomestic();
            else if (activeTab === 'fav') renderFav();
            else if (activeTab === 'int') renderInt();
            else if (activeTab === 'pick') refreshPickI18n();
            // 重绘打开的抽屉（如果有）
            if (_currentDrawerRec) {
              openDrawer(_currentDrawerRec, { pageMode: document.body.classList.contains('journal-route') });
            }
            closeDropdown();
          });
          dropdown.appendChild(opt);
        });
        wrap.appendChild(dropdown);
      }

      function openDropdown() {
        if (!dropdown) buildDropdown();
        dropdown.classList.add('open');
        // update active state
        dropdown.querySelectorAll('button').forEach(b => {
          b.classList.toggle('active', b.dataset.lang === lang);
        });
      }

      function closeDropdown() {
        if (dropdown) dropdown.classList.remove('open');
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown && dropdown.classList.contains('open')) {
          closeDropdown();
        } else {
          openDropdown();
        }
      });

      document.addEventListener('click', (e) => {
        if (dropdown && dropdown.classList.contains('open') && !wrap.contains(e.target)) {
          closeDropdown();
        }
      });

      // update button text when lang changes
      const origSetText = btn.textContent;
      const origApply = applyI18n;
      applyI18n = function() {
        origApply.call(this);
        const meta = LANG_META[lang];
        btn.textContent = meta ? meta.label : lang;
      };
      // trigger initial label
      const meta = LANG_META[lang];
      if (meta) btn.textContent = meta.label;
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
      const row = e.target.closest('tr.j-row.clickable'); if (!row) return;
      const fid = row.dataset.fid;
      const rec = rowRecordsByFid[fid] || journals.find(r => favId(r) === fid) || favsData[fid];
      if (rec) openDrawer(rec, { pageMode: true });
    });
    $('#drawer-close')?.addEventListener('click', () => {
      if (document.body.classList.contains('journal-route')) {
        try { history.pushState({ tab: 'int' }, '', '/international'); } catch (_) {}
        closeDrawer(true);
        activateTab('int', { skipPath: true });
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
      if (e.key === 'Escape') { closeDrawer(); closeSidebar(); }
    });

    function closeSidebar() {
      $('#sidebar').classList.remove('open');
      $('#sidebar-scrim').classList.remove('on');
    }

    // 侧栏切换
    $('#side-toggle')?.addEventListener('click', () => {
      $('#sidebar').classList.toggle('open');
      $('#sidebar-scrim').classList.toggle('on');
      $('#sidebar-scrim').hidden = false;
    });
    $('#sidebar-scrim')?.addEventListener('click', () => {
      $('#sidebar').classList.remove('open');
      $('#sidebar-scrim').classList.remove('on');
    });
  
    // auth
    $('#auth-btn').addEventListener('click', () => {
      if (user) {
        if (confirm(T('退出登录？','Sign out?'))) doLogout();
      } else {
        startLogin();
      }
    });
  }

  // ───────── pick-for-me (journal recommendation) ─────────
  let _pickInit = false;
  const OPENALEX_WORKS_ENDPOINT = location.hostname === 'localhost'
    ? `${API_BASE}/openalex`
    : `${location.origin}/openalex`;

  function openAlexWorksUrl(params) {
    const qs = params instanceof URLSearchParams ? params.toString() : String(params || '');
    return `${OPENALEX_WORKS_ENDPOINT}?${qs}`;
  }

  function initPickTool() {
    if (_pickInit) return;
    _pickInit = true;

    const btn = $('#pick-search-btn');
    const input = $('#q');
    const results = $('#pick-results');
    const status = $('#pick-status');
    const quotaEl = $('#pick-quota');
    const charCount = $('#pick-char-count');

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

    async function doSearch() {
      const query = input.value.trim();
      if (!query) { status.textContent = T('请输入内容','Please enter a query'); return; }

      status.textContent = T('正在搜索相关论文…','Searching related papers…');
      results.innerHTML = '';

      try {
        // Lazy-load oaMap for topic matching (only if pick tool is first to need it)
        if (!oaMap) {
          try { oaMap = await fetchJSON('data/oa.json.gz'); }
          catch(e) { oaMap = {}; }
        }

        // Step 1: Extract keywords from input, then search OpenAlex
        const lines = query.split('\n').filter(l => l.trim());
        let titleTerms = [];
        let abstractTerms = [];
        let explicitKeywords = [];

        for (const line of lines) {
          const trimmed = line.trim();

          // Detect keywords line (English/Chinese markers)
          if (/^keywords?:/i.test(trimmed) || /^关键词[：:]/.test(trimmed) || /^關鍵詞[：:]/.test(trimmed)) {
            const kwStr = trimmed.replace(/^keywords?:/i, '').replace(/^关键词[：:]/, '').replace(/^關鍵詞[：:]/, '').trim();
            explicitKeywords = kwStr.split(/[,;，；、\/]/).map(s => s.trim()).filter(s => s.length > 2);
            continue;
          }
        }

        // Title = first non-empty line (keep concise)
        const firstLine = lines.find(l => !/^keywords?:/i.test(l) && !/^关键词[：:]/.test(l));
        if (firstLine) {
          titleTerms = [firstLine.replace(/[.。！!?？,，;；]+$/, '').trim().slice(0, 200)];
        }

        // ── Multi-query search with OpenAlex 'search' (relevance) param ──
        // OpenAlex 'search' uses BM25 matching (not strict AND), so 5-8 keywords work fine.
        // We run 2-3 complementary queries, deduplicate papers, then aggregate by journal.

        const bodyText = lines.slice(1).filter(l => !/^keywords?:/i.test(l) && !/^关键词[：:]/.test(l)).join(' ');
        const MAX_URL = 155;

        // Synonym map: expand common academic terms to improve recall
        const SYNONYM_MAP = {
          occupancy: ['occupant','people counting','crowd estimation'],
          sensor: ['sensing','detector','sensor array'],
          indoor: ['indoor environment','built environment','interior'],
          ambient: ['environmental','surrounding','background'],
          prediction: ['forecasting','estimation','predictive'],
          'machine learning': ['deep learning','neural network','supervised learning'],
          'deep learning': ['neural network','machine learning','convolutional neural network'],
          thermal: ['temperature','thermal comfort'],
          comfort: ['satisfaction','well-being'],
          co2: ['carbon dioxide','co₂'],
          ventilation: ['air exchange','airflow','hvac'],
          particulate: ['pm','particle','aerosol'],
          noise: ['sound level','acoustic'],
          illumination: ['lighting','daylight','light intensity'],
          air: ['iaq','air quality'],
          quality: ['condition','comfort','environmental quality'],
        };
        function expandWithSynonyms(words) {
          const result = new Set(words);
          words.forEach(w => {
            if (SYNONYM_MAP[w]) SYNONYM_MAP[w].forEach(syn => result.add(syn));
          });
          return [...result];
        }

        const stopWords = new Set(('this that with from which were have been than into also their about '+
          'study show were used using based results method model data paper these between while where '+
          'after before other there analysis approach process system research above during well such '+
          'each both more most some than very just also although however therefore because without '+
          'within across among through before after below under over upon could should would may might '+
          'shall can will does did has had been being made make made made using used based related '+
          'review reviews nature '+
          'five summer cross scenario scenarios invasive '+
          'cross-scenario non-invasive explainable '+
          'significant different important various multiple including following providing performing '+
          'proposes presents demonstrates investigates examines explores develops describes reports '+
          'shows found test tests testing methods models datasets dataset experiments experimental '+
          'proposed presented demonstrated investigated examined explored developed described reported '+
          'tested showed found approach techniques algorithm algorithms features feature accuracy '+
          'performance evaluation values value results analysis prediction predictions').split(' '));

        // Collect all English words (length > 3) from title + body
        const allText = [(titleTerms[0]||''), bodyText].join(' ').toLowerCase();
        const allWords = allText.replace(/[^a-z0-9\s-]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 3 && !stopWords.has(w) && !/^\d+$/.test(w) && !w.startsWith('http'));
        const uniqueWords = allWords.filter((w, i) => allWords.indexOf(w) === i);

        // Build 2-4 diverse queries from different keyword subsets
        const queries = [];

        // Q1: Explicit keywords (if present) — these are the most reliable signal
        if (explicitKeywords.length) {
          const q = explicitKeywords.slice(0, 4).join(' ');
          if (encodeURIComponent(q).length < MAX_URL) queries.push(q);
        }

        // Q2: Title-derived keywords (core topic of the paper)
        const titleLower = (titleTerms[0]||'').toLowerCase().replace(/[^a-z\s-]/g, '').replace(/-/g, ' ');
        const titleKws = titleLower.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
        if (titleKws.length >= 3) {
          const q = titleKws.slice(0, 10).join(' ');
          if (encodeURIComponent(q).length < MAX_URL && !queries.some(x => x.toLowerCase().includes(q.slice(0,15)))) {
            queries.push(q);
          }
        }

        // Q3: Body-derived technical terms (methods, algorithms, sensors, etc.)
        // Pick words that are ≥5 chars (more specific), not already covered by Q1/Q2
        const covered = queries.join(' ').toLowerCase();
        const bodyKws = uniqueWords.filter(w => w.length >= 4 && !covered.includes(w)).slice(0, 6);
        if (bodyKws.length >= 3) {
          const q = bodyKws.join(' ');
          if (encodeURIComponent(q).length < MAX_URL) queries.push(q);
        }

        // Q4: Synonym-expanded query — broader recall for underrepresented terms
        const synWords = expandWithSynonyms(titleKws.slice(0, 5));
        const synQuery = synWords.slice(0, 12).join(' ');
        if (synQuery.length > 10 && !queries.some(x => synQuery.includes(x.slice(0,10)))) {
          const synQ = synQuery;
          if (encodeURIComponent(synQ).length < MAX_URL) queries.push(synQ);
        }

        // Fallback: if no queries built, just use first 5 unique words
        if (!queries.length) {
          queries.push(uniqueWords.slice(0, 6).join(' '));
        }

        // Collect all search keyword tokens for title matching
        const searchKeywords = new Set();
        [...explicitKeywords, ...titleKws, ...bodyKws, ...uniqueWords].forEach(k => {
          k.toLowerCase().split(/[\s-]+/).filter(w => w.length > 2).forEach(w => searchKeywords.add(w));
        });

        // Run all queries concurrently via Promise.all
        status.textContent = T('正在搜索相关论文…','Searching related papers…');
        const SEARCH_FIELDS = 'id,title,publication_date,primary_location,relevance_score';
        const FIVE_YEARS_AGO = new Date(Date.now() - 5*365*24*60*60*1000).toISOString().slice(0,10);
        let openAlexErrorStatus = null;
        let openAlexErrorBody = null;
        async function fetchOpenAlexResults(params) {
          if (!(params instanceof URLSearchParams)) params = new URLSearchParams(params);
          if (!params.has('mailto')) params.set('mailto', 'jiantaoweng@gmail.com');
          // Pass user's API key if provided
          const apiKey = $('#pick-apikey')?.value?.trim();
          if (apiKey && !params.has('api_key')) params.set('api_key', apiKey);
          const url = openAlexWorksUrl(params);
          try {
            const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!r.ok) {
              openAlexErrorStatus = r.status;
              try { openAlexErrorBody = await r.json(); } catch(e) {}
              return [];
            }
            const d = await r.json();
            return d.results || [];
          } catch (err) {
            openAlexErrorStatus = 'network';
            return [];
          }
        }
        const queryBatches = await Promise.all(queries.slice(0, 4).map(async (q) => {
          const params = new URLSearchParams({
            search: q.slice(0, 120),
            per_page: '60',
            sort: 'relevance_score:desc',
            select: SEARCH_FIELDS,
          });
          params.set('filter', `from_publication_date:${FIVE_YEARS_AGO}`);
          return fetchOpenAlexResults(params);
        }));

        // Deduplicate by work ID
        const seenIds = new Set();
        const allWorks = [];
        for (const batch of queryBatches) {
          for (const w of batch) {
            if (w.id && !seenIds.has(w.id)) {
              seenIds.add(w.id);
              allWorks.push(w);
            }
          }
        }

        // If too few results, try a broader backup query
        if (allWorks.length < 8) {
          const backup = uniqueWords.slice(0, 5).join(' ');
          try {
            const params = new URLSearchParams({
              search: backup,
              per_page: '50',
              sort: 'relevance_score:desc',
              select: SEARCH_FIELDS,
            });
            params.set('filter', `from_publication_date:${FIVE_YEARS_AGO}`);
            const results = await fetchOpenAlexResults(params);
            for (const w of results) {
              if (w.id && !seenIds.has(w.id)) { seenIds.add(w.id); allWorks.push(w); }
            }
          } catch {}
        }

        if (allWorks.length < 3 && titleTerms[0]) {
          const chn = titleTerms[0].replace(/[a-zA-Z0-9\s]/g, '').replace(/[，。、；：！？（）【】《》""''\s]/g, '');
          if (chn) {
            const cnQuery = chn.slice(0, 12);
            try {
              const params = new URLSearchParams({
                search: cnQuery,
                per_page: '20',
                sort: 'relevance_score:desc',
                select: SEARCH_FIELDS,
              });
              params.set('filter', `from_publication_date:${FIVE_YEARS_AGO}`);
              const results = await fetchOpenAlexResults(params);
              for (const w of results) {
                if (w.id && !seenIds.has(w.id)) { seenIds.add(w.id); allWorks.push(w); }
              }
            } catch {}
          }
        }

        const hasCnOnly = [...query].filter(c => c >= '\u4e00' && c <= '\u9fff').length > 0
          && uniqueWords.filter(w => w.length > 4).length < 2 && !explicitKeywords.length;
        if (!allWorks.length) {
          if (openAlexErrorStatus) {
            // Show budget info if OpenAlex returned it
            const budgetMsg = openAlexErrorBody?.dailyRemainingUsd !== undefined
              ? T(
                  `OpenAlex 今日额度已用完，每日 UTC 0 点重置。填 API Key 可增加额度`,
                  `OpenAlex daily budget exhausted, resets at UTC midnight. Add an API key for more credits`
                )
              : T(
                  `OpenAlex 搜索接口暂时不可用（${openAlexErrorStatus}），请稍后重试`,
                  `OpenAlex search is temporarily unavailable (${openAlexErrorStatus}), please try again later`
                );
            status.textContent = budgetMsg;
            return;
          }
          status.textContent = hasCnOnly
            ? T('未找到相关论文。OpenAlex 对中文搜索效果不佳，建议在摘要后添加英文 Keywords: 行（如 Keywords: indoor occupancy, sensor）',
              'No papers found. OpenAlex has limited Chinese support. Try adding an English "Keywords:" line.')
            : T('未找到相关论文，请尝试其他关键词','No papers found, try different keywords');
          return;
        }

        // Step 2: Aggregate by journal ISSN
        const journalMap = new Map();
        const topicSet = new Set();
        for (const w of allWorks) {
          const src = w.primary_location?.source;
          if (!src) continue;
          const issn = (src.issn_l || '').toUpperCase();
          if (!issn) continue;
          if (!journalMap.has(issn)) journalMap.set(issn, { count: 0, papers: [], scores: [], topics: new Set(), srcName: src.display_name || '', kwMatch: 0, recentCount: 0 });
          const j = journalMap.get(issn);
          j.count++;
          const titleLower = (w.title || '').toLowerCase();
          const year = (w.publication_date||'').slice(0,4);
          // Keyword match: does paper title contain any search keyword?
          let hasKw = false;
          for (const kw of searchKeywords) {
            if (titleLower.includes(kw)) { hasKw = true; break; }
          }
          if (hasKw) j.kwMatch++;
          // Recency: papers from last 2 years
          if (year >= String(new Date().getFullYear() - 1)) j.recentCount++;
          j.papers.push({
            title: w.title,
            year: year,
            id: w.id,
            url: w.id // OpenAlex full URL, e.g. https://openalex.org/W12345
          });
          j.scores.push(w.relevance_score || 0);
          if (oaMap && oaMap[issn]) {
            (oaMap[issn].tp || []).forEach(t => { j.topics.add(t); topicSet.add(t); });
          }
        }

        // Step 3: Build ranked results — multi-factor scoring
        const maxCount = Math.max(...[...journalMap.values()].map(j => j.count), 1);

        // Compute topic frequency across journals (for topic match scoring)
        const topicJournalCount = {};
        for (const [, j] of journalMap) {
          for (const t of j.topics) {
            topicJournalCount[t] = (topicJournalCount[t] || 0) + 1;
          }
        }
        const maxTopicFreq = Math.max(...Object.values(topicJournalCount), 1);

        const entries = [...journalMap.entries()].map(([issn, j]) => {
          const countRatio = j.count / maxCount;
          const kwMatchRatio = j.count > 0 ? j.kwMatch / j.count : 0;
          const topicMatch = j.topics.size > 0
            ? [...j.topics].reduce((sum, t) => sum + (topicJournalCount[t] || 0), 0) / (j.topics.size * maxTopicFreq)
            : 0;

          const totalScore = countRatio * 0.60 + kwMatchRatio * 0.30 + topicMatch * 0.10;

          const journalRec = journals.find(r => r.issn === issn || r.eissn === issn);
          const zoneVal = journalRec?.cas_zone;
          const topVal = journalRec?.cas_top;
          const qVal = journalRec?.jcr_q;
          const scopusVal = journalRec?.scopus;
          const eiVal = journalRec?.ei;
          const indices = journalRec?.indices || [];
          const wosCats = journalRec?.wos_categories || [];

          return {
            issn, journalRec, zone: zoneVal, top: topVal,
            jcr_q: qVal, scopus: scopusVal, ei: eiVal,
            indices, wos_categories: wosCats,
            count: j.count, papers: j.papers.slice(0,5),
            topics: [...j.topics].slice(0,6),
            score: totalScore, srcName: j.srcName,
          };
        });

        // Step 4: Filter and sort
        let filtered = entries;
        // Exclude single-paper journals (noise from broad queries)
        filtered = filtered.filter(e => e.count >= 2);
        // Index filter: three core indices (SCIE/SSCI/AHCI)
        const wantSci = document.getElementById('pick-filter-sci')?.checked;
        const wantSsci = document.getElementById('pick-filter-ssci')?.checked;
        const wantAhci = document.getElementById('pick-filter-ahci')?.checked;
        if (wantSci || wantSsci || wantAhci) {
          filtered = filtered.filter(e => {
            const idx = e.journalRec?.indices || [];
            if (!idx.length) return false;
            if (wantSci && idx.includes('SCIE')) return true;
            if (wantSsci && idx.includes('SSCI')) return true;
            if (wantAhci && idx.includes('AHCI')) return true;
            return false;
          });
        }
        // Comprehensive journal filter (use wos_categories)
        if (document.getElementById('pick-filter-comprehensive')?.checked) {
          filtered = filtered.filter(e => {
            const cats = e.wos_categories || [];
            return !cats.some(c => /multidisciplinary/i.test(c));
          });
        }
        // Topic filter (always on — minimum signal filter)
        filtered = filtered.filter(e => e.score > 0.1);
        filtered.sort((a, b) => b.score - a.score);
        filtered = filtered.slice(0, 30);

        // Normalize: top journal = 100%
        const maxScore = filtered.length > 0 ? filtered[0].score : 1;
        filtered.forEach(e => e.score = maxScore > 0 ? e.score / maxScore : 0);

        // Step 5: Render
        if (!filtered.length) {
          results.innerHTML = `<div class="pick-no-results">${T('没有符合筛选条件的期刊推荐','No journals match your filters')}</div>`;
          status.textContent = `${T('已发表','Published')} ${allWorks.length} ${T('篇相关论文','related papers')}，${T('分布在','in')} ${journalMap.size} ${T('个期刊','journals')}`;
          return;
        }

        results.innerHTML = filtered.map(e => {
          const scorePct = Math.round(e.score * 100);
          const ifStr = e.if != null ? `IF ${e.if}` : '';
          const zoneStr = e.zone ? `CAS ${e.zone}区` : '';
          const name = e.journalRec?.name || e.srcName || e.issn;
          const issnStr = e.issn;
          const paperList = e.papers.map(p => `<a class="pick-paper" href="${escape(p.url)}" target="_blank" rel="noopener" title="${escape(p.title)}">${escape((p.title||'').slice(0,55))}${(p.title||'').length>55?'…':''} (${escape(p.year||'')})</a>`).join('');
          const topics = e.topics.map(t => `<span class="pick-topic">${escape(t)}</span>`).join('');

          // Build badges — zone/JCR go in zone-tags above title
          let badgesHtml = '';
          let flagsHtml = '';
          let zoneTagsHtml = '';
          let zoneColor = '';
          if (e.journalRec) {
            const r = e.journalRec;
            // Index badges (SCIE/SSCI/AHCI/ESCI)
            const idxBadges = (e.indices||[]).map(idx => badgeIndex(idx)).join('');
            // Scopus
            const scBadge = badgeScopus(r.scopus);
            // EI
            const eiBdg = r.ei ? `<span class="badge b-ei">EI</span>` : '';
            // IF
            const ifBdg = badgeIF(e.if);
            // CCF
            const ccfTxt = r.ccf_2026_type ? `<span class="badge b-ccf">CCF ${r.ccf_2026_type}</span>` : '';
            badgesHtml = [idxBadges, scBadge, eiBdg, ifBdg, ccfTxt].filter(Boolean).join('');
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
                  flagsHtml += `<span class="badge b-warn">⚠ Warning</span>`;
                }
              }
              // OA publisher badges (MDPI / Frontiers / Hindawi)
              const pub = (r2.publisher || '').toLowerCase();
              if (pub.includes('mdpi')) flagsHtml += `<span class="badge b-mdpi">MDPI</span>`;
              if (pub.includes('frontier')) flagsHtml += `<span class="badge b-frontiers">Frontiers</span>`;
              if (pub.includes('hindawi')) flagsHtml += `<span class="badge b-hindawi">Hindawi</span>`;
            }
            // Prominent zone/JCR tags at top of card
            const zTag = e.zone
              ? `<span class="zone z${e.zone}">${e.top ? 'TOP·' : ''}${e.zone}${T('区','')}</span>`
              : '';
            const jcrTag = e.jcr_q
              ? `<span class="zone jcr-${e.jcr_q.toLowerCase()}">JCR ${e.jcr_q}</span>`
              : '';
            zoneTagsHtml = [zTag, jcrTag].filter(Boolean).join('');
            // Zone strip color
            zoneColor = e.zone === '1' || e.zone === 1 ? '#1f3a5f'
              : e.zone === '2' || e.zone === 2 ? '#4f6f9b'
              : e.zone === '3' || e.zone === 3 ? '#9eb1cb'
              : e.zone === '4' || e.zone === 4 ? '#d3dbe6'
              : e.jcr_q === 'Q1' ? '#7a2030'
              : e.jcr_q === 'Q2' ? '#a04a5a'
              : '';
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
            ${zoneTagsHtml ? `<div class="pick-zone-tags">${zoneTagsHtml}</div>` : ''}
            <h3><a href="#j/${escape(e.journalRec ? favId(e.journalRec) : issnStr)}">${escape(name)}</a></h3>
            <div class="pick-head">
              <span class="pick-count">${e.count}<small> ${T('篇论文','papers')}</small></span>
              <div class="pick-head-right">
                <span class="pick-score-bar"><span class="bar"><span class="bar-fill" style="width:${scorePct}%;background:${barColor}"></span></span></span>
                <span class="pick-score-pct">${scorePct}%</span>
              </div>
            </div>
            ${badgesHtml ? `<div class="pick-badges">${badgesHtml}</div>` : ''}
            ${flagsHtml ? `<div class="pick-flags">${flagsHtml}</div>` : ''}
            ${(function(){
              const r2 = e.journalRec;
              let txt = '📅 ' + T('审稿周期','Review cycle') + ': ';
              const weeks = parseFloat(r2?.doaj?.review_weeks);
              if (weeks > 0) {
                txt += (weeks / 4.33).toFixed(1) + T(' 个月 (投稿→出版,DOAJ)',' months (submission→pub.)');
              } else {
                txt += T('≈4.0 个月 (DOAJ 平均)','≈4.0 months (DOAJ avg)');
              }
              return '<div class="pick-cycle">' + txt + '</div>';
            })()}
            ${paperList ? `<div class="pick-papers">${paperList}</div>` : ''}
          </div>`;
        }).join('');

        // Click to open journal drawer (only if we have our data)
        const pickEl = document.getElementById('pick-results');
        if (pickEl) {
          pickEl.querySelectorAll('.pick-card').forEach(card => {
            card.addEventListener('click', () => {
              const issn = card.dataset.issn;
              const rec = journals.find(r => r.issn === issn || r.eissn === issn);
              if (rec) openDrawer(rec);
            });
          });
        }

        status.textContent = `${T('已发表','Published')} ${allWorks.length} ${T('篇相关论文','related papers')}，${T('分布在','in')} ${journalMap.size} ${T('个期刊','journals')}，${T('推荐','recommended')} ${filtered.length} ${T('个','')}`;
        // ── Save to search history ──
        savePickHistory(query);
      } catch (e) {
        status.textContent = T('检索失败：','Search failed: ') + e.message;
        console.error(e);
      }
    }

    btn?.addEventListener('click', doSearch);
    input.addEventListener('keydown', (e) => { if (activeTab !== 'pick') return; if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

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
            return d.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
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

  // ───────── boot ─────────
  async function boot() {
    // ── Owner unlock: specific URL param sets localStorage bypass ──
    const OWNER_EMAIL = 'jiantaoweng@gmail.com';
    if (window.location.search.includes(OWNER_EMAIL)) {
      try { localStorage.setItem('ailatest_unlocked', '1'); } catch {}
    }
    trackPageview();
    loadFavLists();
    bind();
    applyI18n();
    updateFavCount();
    await handleAuthCallback();
    // 分享着陆页：/s/<id> 直接接管 main，不走主流程
    if (await maybeRenderShareLanding()) return;
    try {
      const [j, d, m, esi, aliases] = await Promise.all([
        fetchJSON('data/journals.json.gz'),
        fetch('/data/domestic.json').then(r => r.json()).catch(() => null),
        fetch('/data/meta.json').then(r => r.json()).catch(() => null),
        fetch('/data/esi_categories.json').then(r => r.json()).catch(() => []),
        fetch('/data/journal_aliases.json').then(r => r.json()).catch(() => DEFAULT_JOURNAL_ALIASES),
      ]);
      setJournalAliases(aliases);
      journals = j; domestic = d; meta = m; esiCats = esi; oaMap = null;
      journals.forEach(journalSearchMeta);
      buildDomIndex(domestic);
      buildIntIndex(journals);
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
                flagship: live.flagship, esi_category: live.esi_category,
                if_quartile: live.if_quartile, publisher: live.publisher, ccf: live.ccf,
                scopus: live.scopus, warning: live.warning,
              };
              dirty = true;
            }
          }
        }
        if (dirty) localStorage.setItem(STORAGE_PREFIX + 'favsData', JSON.stringify(favsData));
      })();
      // 计算 WoS 学科表（按字母 A-Z 排序）
      const _wc = Object.create(null);
      for (const r of journals) for (const c of (r.wos_categories||[])) _wc[c] = (_wc[c]||0)+1;
      wosCats = Object.entries(_wc).map(([name,count])=>({name,count})).sort((a,b)=>a.name.localeCompare(b.name,'en'));
      if (meta?.total && $('#total')) $('#total').textContent = meta.total.toLocaleString();
      $('#hint').textContent = lang === 'zh'
        ? `${T('已加载','Loaded')} ${journals.length.toLocaleString()} ${T('本期刊','journals')}`
        : `${journals.length.toLocaleString()} journals loaded`;
      renderCatList();
      renderWosList();
      if (renderJournalRoutePage()) {
        window.addEventListener('hashchange', applyHashRoute);
        if (user) await pullFavs();
        return;
      }
      if (window.__activateJournalTab) window.__activateJournalTab(tabFromPath(), { skipPath: true });
      else renderInt();
      // 启用 #j/<id> 深链
      window.addEventListener('hashchange', applyHashRoute);
      applyHashRoute();
      if (user) await pullFavs();
      // 设置表头吸顶偏移 = 搜索栏高度
      updateThStickyTop();
      window.addEventListener('resize', updateThStickyTop);
    } catch (e) {
      $('#hint').textContent = 'Load failed: ' + e.message;
      console.error(e);
    }
  }

  function updateThStickyTop() {
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      const h = topbar.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--th-sticky-top', h + 'px');
    }
  }

  function refreshPickI18n() {
    // data-i18n and data-i18n-placeholder are handled by applyI18n()
  }

  boot();
})();
