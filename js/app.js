/* AILatest Journal — front-end app (i18n + dual tabs) */
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  const I18N = {
    zh: {
      tagline: '学术期刊检索 · 牛皮纸版',
      indices: '索引', cas_zone: '中科院 2025 分区', filters: '附加筛选',
      esi: 'ESI 学科大类', all: '全部',
      z1: '1 区', z2: '2 区', z3: '3 区', z4: '4 区',
      domestic_sources: '国内分级来源',
      src_cnkx: '中国科协高质量目录', src_zju: '浙江大学 2024',
      src_zjucity: '学校 A 2023', src_ccft: 'CCF 中文 T 分区',
      tab_int: '国际 SCI/SSCI', tab_dom: '国内分级目录',
      loading: '加载中…',
      hero_title_int: 'SCI / SSCI 国际期刊检索',
      hero_body_int: '数据源：<b>Web of Science Core Collection</b>（SCIE / SSCI / AHCI / ESCI）· 更新至 2026-04-20。合并 <b>JCR 2025</b> 归属标记、<b>ESI</b> 22 大学科分类、<b>中科院 2025 大类分区</b>、<b>ShowJCR</b> JCR 2024 影响因子 / 小类分区 / 新锐版 / CCF 2026 推荐、<b>中国科协</b> 高质量科技期刊分级目录（T1/T2/T3）与国际期刊预警名单。共收录 <b id="total">—</b> 本。',
      hero_note: '期刊原名保留英文，括注为中文刊名；徽章从左至右：索引 / CAS 分区 / IF 分位 / CCF / T1-T3 / 预警。',
      results_all: '全部期刊', load_more: '加载更多',
      col_name: '期刊 Title', col_abbr: '缩写 Abbr', col_badges: '索引 / IF / 分区 / 徽章',
      col_cat: 'ESI / 中科院大类',
      hero_title_dom: '国内学术期刊分级目录',
      hero_body_dom: '<b>中国科协科学技术创新部</b> 2025 年 12 月发布的 <em>高质量科技期刊分级目录总汇</em>，覆盖 40+ 学科领域，T1 / T2 / T3 三级；<b>浙江大学 2024 版</b> 与 <b>学校 A 2023 版</b> 的国内期刊分级；<b>CCF 推荐中文科技期刊 2025</b> T 分区。',
      hero_note_dom: 'CSSCI / 北大核心目录为扫描件 PDF，OCR 版稍后补入。',
      search_int: '搜索：期刊全称 / 缩写 / ISSN / 中文刊名',
      search_dom: '搜索：中文刊名 / 英文刊名 / ISSN / CN 号',
      showing: '显示', of: '条 / 共', total_items: '条',
      empty: '未找到匹配的期刊',
    },
    en: {
      tagline: 'Scholarly Journal Index · Kraft Edition',
      indices: 'Indices', cas_zone: 'CAS 2025 Tier', filters: 'Filters',
      esi: 'ESI Categories', all: 'All',
      z1: 'T1', z2: 'T2', z3: 'T3', z4: 'T4',
      domestic_sources: 'Domestic Sources',
      src_cnkx: 'CAST Tiered Directory', src_zju: 'ZJU 2024',
      src_zjucity: 'ZJU City 2023', src_ccft: 'CCF-T (Chinese)',
      tab_int: 'Int’l SCI/SSCI', tab_dom: 'Domestic (CN)',
      loading: 'Loading…',
      hero_title_int: 'International SCI / SSCI Search',
      hero_body_int: 'Source: <b>Web of Science Core Collection</b> (SCIE / SSCI / AHCI / ESCI), updated 2026-04-20. Enriched with <b>JCR 2025</b> index flags, <b>ESI</b> 22 subject categories, <b>CAS 2025</b> tiers, <b>ShowJCR</b> JCR 2024 Impact Factors / sub-category tiers / emerging edition / CCF 2026, and <b>CAST</b> tiered directory (T1/T2/T3) plus international warning list. Total: <b id="total">—</b> journals.',
      hero_note: 'Titles preserved in original (English); Chinese names in subtitle. Badges left-to-right: index / CAS tier / IF quartile / CCF / T1-T3 / warning.',
      results_all: 'All Journals', load_more: 'Load more',
      col_name: 'Journal Title', col_abbr: 'Abbr', col_badges: 'Index / IF / Tier / Badges',
      col_cat: 'ESI / CAS Major',
      hero_title_dom: 'Domestic Chinese Journal Directories',
      hero_body_dom: '<b>CAST</b> (中国科协) 2025-12 <em>High-Quality Science & Technology Journal Tiered Directory</em>, 40+ domains, T1/T2/T3. <b>ZJU 2024</b> and <b>ZJU City 2023</b> domestic tier lists. <b>CCF Recommended Chinese Journals 2025</b> (T-tier).',
      hero_note_dom: 'CSSCI / PKU Core PDFs are scanned images; OCR version to follow.',
      search_int: 'Search: title / abbr / ISSN / Chinese name',
      search_dom: 'Search: Chinese name / English name / ISSN / CN',
      showing: 'Showing', of: 'of', total_items: '',
      empty: 'No journals match.',
    },
  };

  let lang = localStorage.getItem('ailatest.lang') || 'zh';
  let theme = localStorage.getItem('ailatest.theme') || 'light';
  document.documentElement.dataset.theme = theme;

  let journals = [];
  let domestic = null;
  let wosCats = [];
  let esiCats = [];
  let meta = null;

  let activeTab = 'int';
  let activeCat = '__all';
  let activeIndices = new Set(['SCIE','SSCI','AHCI','ESCI']);
  let activeZones = new Set();
  let activeFeats = new Set();
  let activeQuery = '';
  let activeDom = 'cnkx';
  const PAGE = 100;
  let shown = PAGE;

  function t(k) { return I18N[lang][k] ?? k; }

  function applyI18n() {
    $$('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      if (I18N[lang][k]) el.innerHTML = I18N[lang][k];
    });
    $('#q').placeholder = activeTab === 'int' ? t('search_int') : t('search_dom');
    $('#lang-toggle').textContent = lang === 'zh' ? '中文 · EN' : 'EN · 中文';
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }

  // ───────── render helpers ─────────
  function badgeIndex(idx) {
    return `<span class="badge b-${idx.toLowerCase()}">${idx}</span>`;
  }
  function badgeZone(z, top) {
    if (!z) return '';
    if (top) return `<span class="zone ztop">TOP·${z}区</span>`;
    return `<span class="zone z${z}">${z}区</span>`;
  }
  function badgeIF(v, q) {
    if (v === undefined || v === null) return '';
    const qq = q ? ` iq-${q}` : '';
    return `<span class="if-pill${qq}">IF ${(+v).toFixed(1)}</span>`;
  }
  function badgeCCF(ccf) {
    if (!ccf) return '';
    const t = String(ccf).toUpperCase().replace(/[^ABC]/g,'') || 'X';
    return `<span class="ccf-pill ccf-${t}">CCF ${t}</span>`;
  }
  function badgeTier(tier) {
    if (!tier) return '';
    const t = tier.toLowerCase().replace(/[^t123]/g,'');
    return `<span class="tier-pill ${t}">${tier.toUpperCase()}</span>`;
  }
  function badgeWarn() {
    return `<span class="warn-pill">⚠ Warning</span>`;
  }

  function renderRow(r) {
    const nameHtml = `<div class="jname">${escape(r.name)}${r.cn_name ? `<span class="jname-cn">${escape(r.cn_name)}</span>` : ''}</div>`;
    const abbr = r.abbr20 ? `<span class="jabbr">${escape(r.abbr20)}</span>` : '';
    const issn = r.issn || r.eissn
      ? `<span class="jissn">${r.issn||''}${r.eissn ? ` <span class="eissn">e:${r.eissn}</span>` : ''}</span>`
      : '<span class="muted-cell">—</span>';
    const badges = [
      ...(r.indices || []).map(badgeIndex),
      badgeZone(r.cas_zone, r.cas_top),
      badgeIF(r.if_2024, r.if_quartile),
      badgeCCF(r.ccf),
      ...(r.cnkx ? r.cnkx.slice(0,2).map(c => badgeTier(c.tier)) : []),
      r.warning ? badgeWarn() : '',
    ].filter(Boolean).join('');
    const cat = [r.esi_category, r.cas_major_cn]
      .filter(Boolean).map(escape).join(' · ') || '<span class="muted-cell">—</span>';
    return `<tr>
      <td class="col-name">${nameHtml}</td>
      <td class="col-abbr">${abbr || '<span class="muted-cell">—</span>'}</td>
      <td class="col-issn">${issn}</td>
      <td class="col-badge"><div class="badges">${badges}</div></td>
      <td class="col-cat">${cat}</td>
    </tr>`;
  }

  function escape(s) {
    return String(s||'').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ───────── filtering ─────────
  function matches(r) {
    if (activeIndices.size && !(r.indices || []).some(i => activeIndices.has(i))) return false;
    if (activeZones.size) {
      const zones = new Set();
      if (r.cas_zone) zones.add(String(r.cas_zone));
      if (r.cas_top) zones.add('top');
      let ok = false;
      for (const z of activeZones) if (zones.has(z)) { ok = true; break; }
      if (!ok) return false;
    }
    if (activeFeats.has('if') && r.if_2024 == null) return false;
    if (activeFeats.has('ccf') && !r.ccf) return false;
    if (activeFeats.has('cnkx') && !(r.cnkx && r.cnkx.length)) return false;
    if (activeFeats.has('warning') && !r.warning) return false;
    if (activeCat !== '__all' && r.esi_category !== activeCat) return false;
    if (activeQuery) {
      const q = activeQuery.toLowerCase();
      const hay = [
        r.name, r.abbr20, r.issn, r.eissn, r.cn_name, r.cn_code,
        r.publisher, r.country
      ].map(x => (x||'').toString().toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function renderInt() {
    const filtered = journals.filter(matches);
    $('#results-title').textContent = activeCat === '__all'
      ? t('results_all') : activeCat;
    const visible = filtered.slice(0, shown);
    const tbody = $('#tbody');
    if (!visible.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty">${t('empty')}</td></tr>`;
    } else {
      tbody.innerHTML = visible.map(renderRow).join('');
    }
    $('#results-count').textContent = `${t('showing')} ${visible.length} ${t('of')} ${filtered.length.toLocaleString()} ${t('total_items')}`;
    const more = $('#more');
    if (filtered.length > shown) { more.hidden = false; }
    else { more.hidden = true; }
  }

  // ───────── category nav ─────────
  function renderCatList() {
    const box = $('#cat-list');
    if (!esiCats.length) { box.innerHTML = ''; return; }
    box.innerHTML = esiCats.map(c =>
      `<button class="nav-item" data-cat="${escape(c.name)}">
        <span>${escape(c.name)}</span>
        <span class="count">${c.count}</span>
      </button>`
    ).join('');
    $('#count-all').textContent = journals.length.toLocaleString();
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.nav-item'); if (!b) return;
      $$('.nav-item', $('.sidebar')).forEach(n => n.classList.remove('active'));
      b.classList.add('active');
      activeCat = b.dataset.cat;
      shown = PAGE;
      renderInt();
    });
    $$('.nav > .nav-item[data-cat="__all"]').forEach(b => {
      b.addEventListener('click', () => {
        $$('.nav-item', $('.sidebar')).forEach(n => n.classList.remove('active'));
        b.classList.add('active');
        activeCat = '__all';
        shown = PAGE;
        renderInt();
      });
    });
  }

  // ───────── domestic tab ─────────
  function renderDomestic() {
    const box = $('#dom-content');
    if (!domestic) { box.innerHTML = '<div class="empty">无数据</div>'; return; }
    const q = activeQuery.toLowerCase();
    if (activeDom === 'cnkx') {
      const d = domestic.cnkx;
      if (!d) { box.innerHTML = '<div class="empty">中国科协数据缺失</div>'; return; }
      // 按 domain 分组
      const byDom = {};
      for (const r of d.records) {
        if (q) {
          const hay = (r.name + ' ' + (r.issn||'') + ' ' + (r.domain||'') + ' ' + (r.subdomain||'')).toLowerCase();
          if (!hay.includes(q)) continue;
        }
        (byDom[r.domain] = byDom[r.domain] || []).push(r);
      }
      const html = [];
      html.push(`<div class="section-block">
        <h3 class="section-title">中国科协高质量科技期刊分级目录 (2025-12)</h3>
        <div class="section-subtitle">T1 / T2 / T3 三级；${d.domains.length} 个学科领域；共 ${d.records.length.toLocaleString()} 条记录</div>`);
      for (const dom of d.domains) {
        const recs = byDom[dom]; if (!recs) continue;
        const t1 = recs.filter(r => r.tier === 'T1');
        const t2 = recs.filter(r => r.tier === 'T2');
        const t3 = recs.filter(r => r.tier === 'T3');
        const oth = recs.filter(r => !r.tier);
        html.push(`<details class="section-block" style="margin-top:18px" ${q?'open':''}>
          <summary style="cursor:pointer;font-family:var(--serif);font-size:15px;font-weight:600;padding:6px 0;border-bottom:1px solid var(--rule)">
            ${escape(dom)} <span class="muted-cell">(${recs.length})</span>
          </summary>
          <div class="table-wrap" style="margin-top:10px"><table class="journals"><thead><tr>
            <th>T级</th><th>期刊</th><th>ISSN</th><th>子领域</th>
          </tr></thead><tbody>
          ${[t1,t2,t3,oth].flat().slice(0, 200).map(r => `<tr>
            <td>${r.tier ? badgeTier(r.tier) : '<span class="muted-cell">—</span>'}</td>
            <td class="jname" style="font-size:13.5px">${escape(r.name)}</td>
            <td class="jissn">${r.issn || '<span class="muted-cell">—</span>'}</td>
            <td class="muted-cell">${escape(r.subdomain || '')}</td>
          </tr>`).join('')}
          ${recs.length > 200 ? `<tr><td colspan="4" class="empty">仅显示前 200 条，剩余 ${recs.length - 200} 条请搜索</td></tr>` : ''}
          </tbody></table></div>
        </details>`);
      }
      html.push('</div>');
      box.innerHTML = html.join('');
    } else if (activeDom === 'zju_zju' || activeDom === 'zju_city') {
      const src = activeDom === 'zju_zju' ? domestic.zju : domestic.zju_city;
      if (!src || !src.records) { box.innerHTML = '<div class="empty">数据缺失</div>'; return; }
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
        <h3 class="section-title">${escape(src.source || '国内学术期刊分级目录')}</h3>
        <div class="section-subtitle">共 ${list.length.toLocaleString()} 条；带 * 为人文社科权威级期刊（一级内）</div>`];
      for (const tier of tierOrder) {
        const recs = byTier[tier]; if (!recs || !recs.length) continue;
        html.push(`<details class="section-block" style="margin-top:14px" ${q?'open':(tier==='一级'?'open':'')}>
          <summary style="cursor:pointer;font-family:var(--serif);font-size:15px;font-weight:600;padding:6px 0;border-bottom:1px solid var(--rule)">
            国内${escape(tier)}学术期刊 <span class="muted-cell">(${recs.length})</span>
          </summary>
          <div class="table-wrap" style="margin-top:10px"><table class="journals"><thead><tr>
            <th>级别</th><th>期刊</th><th>ISSN / CN</th><th>备注</th>
          </tr></thead><tbody>
          ${recs.slice(0, 1500).map(r => `<tr>
            <td><span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(r.tier)}</span>${r.name.includes('*') ? ' <span class="warn-pill" style="background:var(--gold);color:#fff">★</span>' : ''}</td>
            <td class="jname" style="font-size:13.5px">${escape(r.name.replace(/\*$/,''))}</td>
            <td class="jissn">${r.issn || r.cn_code || '<span class="muted-cell">—</span>'}</td>
            <td class="muted-cell">${escape(r.note||'')}</td>
          </tr>`).join('')}
          ${recs.length > 1500 ? `<tr><td colspan="4" class="empty">仅显示前 1500 条，请在搜索框内精确查找</td></tr>` : ''}
          </tbody></table></div>
        </details>`);
      }
      html.push('</div>');
      box.innerHTML = html.join('');
    } else if (activeDom === 'ccft') {
      const list = domestic.ccft || [];
      const f = list.filter(r => {
        if (!q) return true;
        const hay = (r.cn_name + ' ' + (r.en_name||'') + ' ' + (r.cn_code||'') + ' ' + (r.org||'')).toLowerCase();
        return hay.includes(q);
      });
      box.innerHTML = `<div class="section-block">
        <h3 class="section-title">CCF 推荐中文科技期刊 2025</h3>
        <div class="section-subtitle">共 ${list.length} 条；T1/T2/T3 三级</div>
        <div class="table-wrap" style="margin-top:14px"><table class="journals"><thead><tr>
          <th>T分区</th><th>期刊</th><th>CN</th><th>主办单位</th><th>领域</th>
        </tr></thead><tbody>
        ${f.map(r => `<tr>
          <td>${r.tier ? badgeTier(r.tier) : '<span class="muted-cell">—</span>'}</td>
          <td class="jname" style="font-size:13.5px">${escape(r.cn_name)}
            ${r.en_name ? `<span class="jname-cn">${escape(r.en_name)}</span>` : ''}</td>
          <td class="jissn">${r.cn_code || '<span class="muted-cell">—</span>'}</td>
          <td class="muted-cell">${escape(r.org||'')}</td>
          <td class="muted-cell">${escape(r.ccf_area||'')}</td>
        </tr>`).join('')}
        </tbody></table></div>
      </div>`;
    }
  }

  // ───────── bindings ─────────
  function bind() {
    $('#index-toggles').addEventListener('change', (e) => {
      activeIndices = new Set($$('#index-toggles input:checked').map(i => i.value));
      shown = PAGE; renderInt();
    });
    $('#zone-toggles').addEventListener('change', () => {
      activeZones = new Set($$('#zone-toggles input:checked').map(i => i.value));
      shown = PAGE; renderInt();
    });
    $('#feat-toggles').addEventListener('change', () => {
      activeFeats = new Set($$('#feat-toggles input:checked').map(i => i.value));
      shown = PAGE; renderInt();
    });
    $('#q').addEventListener('input', (e) => {
      activeQuery = e.target.value.trim();
      shown = PAGE;
      activeTab === 'int' ? renderInt() : renderDomestic();
    });
    $('#more').addEventListener('click', () => { shown += PAGE; renderInt(); });

    $$('.tab').forEach(b => b.addEventListener('click', () => {
      $$('.tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      activeTab = b.dataset.tab;
      $$('.tab-panel').forEach(p => p.hidden = p.dataset.panel !== activeTab);
      $$('[data-international]').forEach(el => el.hidden = activeTab !== 'int');
      $('[data-domestic]').hidden = activeTab !== 'dom';
      $('#q').placeholder = activeTab === 'int' ? t('search_int') : t('search_dom');
      if (activeTab === 'dom') renderDomestic();
      else renderInt();
    }));

    $('#domestic-nav').addEventListener('click', (e) => {
      const b = e.target.closest('.nav-item'); if (!b) return;
      $$('#domestic-nav .nav-item').forEach(n => n.classList.remove('active'));
      b.classList.add('active');
      activeDom = b.dataset.dom;
      renderDomestic();
    });

    $('#lang-toggle').addEventListener('click', () => {
      lang = lang === 'zh' ? 'en' : 'zh';
      localStorage.setItem('ailatest.lang', lang);
      applyI18n();
    });
    $('#theme-toggle').addEventListener('click', () => {
      theme = theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('ailatest.theme', theme);
    });
  }

  // ───────── boot ─────────
  async function boot() {
    bind();
    applyI18n();
    try {
      const [j, d, m, esi] = await Promise.all([
        fetch('data/journals.json').then(r => r.json()),
        fetch('data/domestic.json').then(r => r.json()).catch(() => null),
        fetch('data/meta.json').then(r => r.json()).catch(() => null),
        fetch('data/esi_categories.json').then(r => r.json()).catch(() => []),
      ]);
      journals = j; domestic = d; meta = m; esiCats = esi;
      if (meta?.total && $('#total')) $('#total').textContent = meta.total.toLocaleString();
      $('#hint').textContent = lang === 'zh'
        ? `已加载 ${journals.length.toLocaleString()} 本期刊`
        : `${journals.length.toLocaleString()} journals loaded`;
      renderCatList();
      renderInt();
    } catch (e) {
      $('#hint').textContent = 'Load failed: ' + e.message;
      console.error(e);
    }
  }

  boot();
})();
