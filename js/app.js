/* AILatest Journal — front-end app (i18n + tabs + favorites + auth) */
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  const I18N = {
    zh: {
      tagline: '<b>ailatest · journal</b> — 面向中文科研人员的一站式期刊查询工具，聚合国际 SCI/SSCI 与国内分级目录，支持收藏、解锁院校自编目录、跨设备同步。',
      indices: '索引', cas_zone: '中科院 2025 分区', filters: '附加筛选',
      esi: 'ESI 学科大类', all: '全部',
      z1: '1 区', z2: '2 区', z3: '3 区', z4: '4 区',
      domestic_sources: '国内分级来源',
      src_cnkx: '中国科协高质量目录',
      src_cssci_core: 'CSSCI 来源期刊',
      src_cssci_ext: 'CSSCI 扩展版',
      src_pku: '北大核心 (2023)',
      src_zju: '浙江大学 2024',
      src_zjucity: '高校自编目录 2023',
      src_ccft: 'CCF 中文 T 分区',
      tab_int: '国际 SCI/SSCI', tab_dom: '国内分级目录', tab_fav: '我的收藏',
      loading: '加载中…',
      hero_title_int: 'SCI / SSCI 国际期刊检索',
      hero_body_int: '数据源：<b>Web of Science Core Collection</b>（SCIE / SSCI / AHCI / ESCI）· 更新至 2026-04-20，并合并 <b>Ei Compendex</b> 期刊目录（2025-10-10）。合并 <b>JCR 2025</b> 归属标记、<b>ESI</b> 22 大学科分类、<b>中科院 2025 大类分区</b>、<b>ShowJCR</b> JCR 2024 影响因子 / 小类分区 / 新锐版 / CCF 2026 推荐、<b>中国科协</b> 高质量科技期刊分级目录（T1/T2/T3）与国际期刊预警名单。共收录 <b id="total">—</b> 本。',
      hero_note: '期刊原名保留英文，括注为中文刊名；徽章从左至右：索引 / CAS 分区 / IF 分位 / CCF / T1-T3 / 预警。',
      hero_title_fav: '我的收藏',
      hero_body_fav: '点击任意期刊右侧的 <b>★</b> 可加入收藏。未登录时保存在本机 localStorage；登录后自动同步到云端，可跨设备访问。',
      results_all: '全部期刊', load_more: '加载更多',
      col_name: '期刊 Title', col_abbr: '缩写 Abbr', col_badges: '索引 / IF / 分区 / 徽章',
      col_cat: 'ESI / 中科院大类',
      hero_title_dom: '国内学术期刊分级目录',
      hero_body_dom: '<b>中国科协科学技术创新部</b> 2025 年 12 月发布的 <em>高质量科技期刊分级目录总汇</em>，覆盖 40+ 学科领域，T1 / T2 / T3 三级；<b>CSSCI 来源期刊 (2025-2026)</b> 正刊与扩展版；<b>北大《中文核心期刊要目总览》(2023 年版)</b>；<b>浙江大学 2024 版</b> 与 <b>高校自编目录 2023</b>（付费解锁）；<b>CCF 推荐中文科技期刊 2025</b> T 分区。',
      hero_note_dom: 'CSSCI / 北大核心为扫描 PDF OCR 提取，可能存在个别错字。',
      search_int: '搜索：期刊全称 / 缩写 / ISSN / 中文刊名',
      search_dom: '搜索：中文刊名 / 英文刊名 / ISSN / CN 号',
      search_fav: '搜索收藏：期刊 / ISSN',
      showing: '显示', of: '条 / 共', total_items: '条',
      empty: '未找到匹配的期刊',
      empty_fav: '还没有收藏。切到「国际 SCI/SSCI」点任意一行右边的 ★ 就能收藏。',
      login: '登录', logout: '登出',
      fav_added: '已收藏', fav_removed: '已移除',
      syncing: '同步中…', synced: '已同步',
    },
    en: {
      tagline: '<b>ailatest · journal</b> — One-stop journal index for Chinese researchers. Aggregates international SCI/SSCI indexes with Chinese tiered directories. Favorites, institution-locked catalogs, cross-device sync.',
      indices: 'Indices', cas_zone: 'CAS 2025 Tier', filters: 'Filters',
      esi: 'ESI Categories', all: 'All',
      z1: 'T1', z2: 'T2', z3: 'T3', z4: 'T4',
      domestic_sources: 'Domestic Sources',
      src_cnkx: 'CAST Tiered Directory',
      src_cssci_core: 'CSSCI Core',
      src_cssci_ext: 'CSSCI Extended',
      src_pku: 'PKU Core (2023)',
      src_zju: 'ZJU 2024',
      src_zjucity: 'School A 2023',
      src_ccft: 'CCF-T (Chinese)',
      tab_int: 'Int’l SCI/SSCI', tab_dom: 'Domestic (CN)', tab_fav: 'My Favorites',
      loading: 'Loading…',
      hero_title_int: 'International SCI / SSCI Search',
      hero_body_int: 'Source: <b>Web of Science Core Collection</b> (SCIE / SSCI / AHCI / ESCI), updated 2026-04-20, merged with <b>Ei Compendex</b> source list (2025-10-10). Enriched with <b>JCR 2025</b> index flags, <b>ESI</b> 22 subject categories, <b>CAS 2025</b> tiers, <b>ShowJCR</b> JCR 2024 Impact Factors / sub-category tiers / emerging edition / CCF 2026, and <b>CAST</b> tiered directory (T1/T2/T3) plus international warning list. Total: <b id="total">—</b> journals.',
      hero_note: 'Titles preserved in original (English); Chinese names in subtitle. Badges left-to-right: index / CAS tier / IF quartile / CCF / T1-T3 / warning.',
      hero_title_fav: 'My Favorites',
      hero_body_fav: 'Click the <b>★</b> on any row to bookmark. Saved locally when signed-out; syncs to the cloud when signed-in.',
      results_all: 'All Journals', load_more: 'Load more',
      col_name: 'Journal Title', col_abbr: 'Abbr', col_badges: 'Index / IF / Tier / Badges',
      col_cat: 'ESI / CAS Major',
      hero_title_dom: 'Domestic Chinese Journal Directories',
      hero_body_dom: '<b>CAST</b> (中国科协) 2025-12 <em>High-Quality Science & Technology Journal Tiered Directory</em>; <b>CSSCI 2025-2026</b> core & extended; <b>PKU Core (2023)</b>; <b>ZJU 2024</b>; <b>School A 2023</b>; <b>CCF Recommended Chinese Journals 2025</b>.',
      hero_note_dom: 'CSSCI / PKU Core extracted via OCR from scanned PDF; minor typos possible.',
      search_int: 'Search: title / abbr / ISSN / Chinese name',
      search_dom: 'Search: Chinese name / English name / ISSN / CN',
      search_fav: 'Search favorites: title / ISSN',
      showing: 'Showing', of: 'of', total_items: '',
      empty: 'No journals match.',
      empty_fav: 'No favorites yet. Switch to Int’l SCI/SSCI and click ★ on any row to bookmark.',
      login: 'Sign in', logout: 'Sign out',
      fav_added: 'Saved', fav_removed: 'Removed',
      syncing: 'Syncing…', synced: 'Synced',
    },
  };

  // ───────── state ─────────
  let lang = localStorage.getItem('ailatest.lang') || 'zh';
  let theme = localStorage.getItem('ailatest.theme') || 'light';
  document.documentElement.dataset.theme = theme;

  let journals = [];
  let domestic = null;
  let esiCats = [];
  let meta = null;
  let oaMap = {};          // compact OpenAlex map: { "ISSN": {hp, l, oa, dj, apc, org, cn, w} }

  function lookupOA(r) {
    if (!oaMap) return null;
    const keys = [r.issn, r.eissn].filter(Boolean).map(s => String(s).toUpperCase());
    for (const k of keys) {
      if (oaMap[k]) return oaMap[k];
    }
    return null;
  }

  let activeTab = 'int';
  let activeCat = '__all';
  let activeIndices = new Set(['SCIE','SSCI','AHCI','ESCI','EI']);
  let activeZones = new Set();
  let activeFeats = new Set();
  let activeQuery = '';
  let activeDom = 'cnkx';
  const PAGE = 100;
  let shown = PAGE;

  // favorites & ratings 数据见下方 "favorites (multi-list + drag sort)" 段
  // unlocked records cache for locked sources: { school_a: [...records], ... }
  const unlockedCache = {};
  try {
    const raw = localStorage.getItem('ailatest.unlocked');
    if (raw) Object.assign(unlockedCache, JSON.parse(raw));
  } catch (_) {}
  const API_BASE = (window.AILATEST_API_BASE
    || (location.hostname === 'localhost' ? 'http://localhost:8787' : `${location.origin}/api`));

  async function readJsonResponse(resp, fallback) {
    let data = null;
    try { data = await resp.json(); } catch (_) {}
    if (!resp.ok) {
      const message = data?.error || `${fallback}（HTTP ${resp.status}）`;
      throw new Error(message);
    }
    return data || {};
  }

  function fetchFailureMessage(err, stage) {
    if (err instanceof TypeError && /fetch/i.test(err.message || '')) {
      return `${stage}：网络请求失败，请检查代理/DNS/CORS 后重试`;
    }
    return err.message || `${stage}失败`;
  }

  function t(k) { return I18N[lang][k] ?? k; }

  function applyI18n() {
    $$('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      if (I18N[lang][k]) el.innerHTML = I18N[lang][k];
    });
    const search = activeTab === 'int' ? 'search_int'
                  : activeTab === 'fav' ? 'search_fav'
                  : 'search_dom';
    $('#q').placeholder = t(search);
    $('#lang-toggle').textContent = lang === 'zh' ? '中文 · EN' : 'EN · 中文';
    $('#auth-btn').textContent = user ? (user.name || user.login || t('logout')) : t('login');
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
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

  function loadFavLists() {
    try {
      const raw = localStorage.getItem('ailatest.favLists');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          favLists = parsed.map(l => ({
            id: String(l.id),
            name: String(l.name || '未命名'),
            ids: Array.isArray(l.ids) ? l.ids.map(String) : [],
          }));
          activeListId = localStorage.getItem('ailatest.activeListId') || favLists[0].id;
          if (!favLists.find(l => l.id === activeListId)) activeListId = favLists[0].id;
          return;
        }
      }
    } catch (_) {}
    // migrate from old flat favs (ailatest.favs)
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem('ailatest.favs') || '[]'); } catch(_) {}
    favLists = [{ id: 'default', name: '默认收藏', ids: [...legacy] }];
    activeListId = 'default';
    persistFavLists(false);
  }

  function persistFavLists(sync = true) {
    localStorage.setItem('ailatest.favLists', JSON.stringify(favLists));
    localStorage.setItem('ailatest.activeListId', activeListId);
    // rebuild flat union for legacy path + backend sync
    const union = new Set();
    favLists.forEach(l => l.ids.forEach(id => union.add(id)));
    favs = union;
    localStorage.setItem('ailatest.favs', JSON.stringify([...union]));
    if (sync) syncFavs();
  }

  function getActiveList() {
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
  try { favsData = JSON.parse(localStorage.getItem('ailatest.favsData') || '{}'); } catch(_){}
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
    localStorage.setItem('ailatest.favsData', JSON.stringify(favsData));
    persistFavLists();
    updateFavCount();
  }

  function updateFavCount() {
    const total = allFavIds().size;
    const el = $('#fav-count');
    if (el) el.textContent = total;
  }

  // list 管理
  function createList(name) {
    const id = 'l_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    favLists.push({ id, name: name || '新清单', ids: [] });
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
      localStorage.setItem('ailatest.favsData', JSON.stringify(favsData));
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
            name: String(l.name || '未命名'),
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
  function renderStarsStatic(value) {
    const v = Math.max(0, Math.min(5, Number(value) || 0));
    let out = '';
    for (let i = 1; i <= 5; i++) {
      if (v >= i)            out += '<span class="star full">★</span>';
      else if (v >= i - 0.5) out += '<span class="star half">★</span>';
      else                   out += '<span class="star empty">☆</span>';
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
      cntEl.textContent = `${n} 人`;
    } else {
      avgEl.textContent = '—';
      starsEl.innerHTML = '';
      starsEl.style.display = 'none';
      cntEl.textContent = '暂无评分';
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
        ? `已评 ${mine.toFixed(1)} 星 · 再次点击修改 · 长按清除`
        : '半星可评 · 点击星左半为 0.5，右半为 1 星';
      // hover preview
      wrap.querySelectorAll('.half-hit').forEach(hit => {
        hit.addEventListener('mouseenter', () => apply(Number(hit.dataset.value)));
        hit.addEventListener('click', async (e) => {
          e.stopPropagation();
          const v = Number(hit.dataset.value);
          apply(v);
          hint.textContent = '提交中…';
          const res = await putRating(key, v);
          if (res) {
            paintRatingDisplay({ avg: res.avg, n: res.n });
            hint.textContent = `已评 ${v.toFixed(1)} 星 · 再次点击修改 · 长按清除`;
          } else {
            hint.textContent = '提交失败，请稍后再试';
          }
        });
      });
      // long-press to clear
      let pressT = null;
      wrap.addEventListener('mousedown', () => {
        pressT = setTimeout(async () => {
          pressT = null;
          hint.textContent = '清除中…';
          const res = await deleteRating(key);
          if (res) {
            apply(0);
            paintRatingDisplay({ avg: res.avg, n: res.n });
            hint.textContent = '已清除评分 · 可重新打分';
          } else {
            hint.textContent = '清除失败';
          }
        }, 700);
      });
      const cancelPress = () => { if (pressT) { clearTimeout(pressT); pressT = null; } };
      wrap.addEventListener('mouseup', cancelPress);
      wrap.addEventListener('mouseleave', () => { cancelPress(); apply(mine || 0); });
    } else {
      hint.innerHTML = '<a href="#" id="rating-login-link">登录</a>后可打分（邮箱验证码 / GitHub / Google）';
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
        <h3 class="section-title">${escape(sourceLabel)} <span class="lock-pill">🔒 付费解锁</span></h3>
        <div class="section-subtitle">此学校自编目录为付费内容，共 ${recordCount} 条记录。输入解锁码后自动保存在本机浏览器，下次免输。</div>
        <form class="unlock-form" data-src="${escape(sourceKey)}">
          <input class="unlock-input" type="text" autocomplete="off" spellcheck="false" placeholder="解锁码（如 school-a-xxxxxxxx）" />
          <button type="submit" class="unlock-btn">解锁</button>
          <div class="unlock-msg" role="status"></div>
        </form>
        <div class="unlock-help">
          <p>未购买？<a href="mailto:support@ailatest.org?subject=解锁码申请（${escape(sourceKey)}）">联系获取解锁码</a></p>
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
          <button class="login-close" aria-label="关闭">×</button>
          <h3 id="login-title">登录 / 注册</h3>
          <p class="login-sub">跨设备同步收藏、投稿经验、打分记录</p>

          <form class="login-email" autocomplete="off">
            <label>邮箱</label>
            <input type="email" name="email" placeholder="you@example.com" required />
            <div class="login-code-row" hidden>
              <label>6 位验证码</label>
              <input type="text" name="code" inputmode="numeric" pattern="\\d{6}" maxlength="6" placeholder="123456" />
            </div>
            <button type="submit" class="login-btn-primary" data-step="request">发送验证码</button>
            <div class="login-msg" role="status"></div>
          </form>

          <div class="login-divider"><span>或使用第三方登录</span></div>

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

          <p class="login-tos">登录即同意 <a href="/terms.html">服务条款</a> 与 <a href="/privacy.html">隐私政策</a></p>
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
            await readJsonResponse(r, '发送验证码失败');
            form.dataset.email = requestedEmail;
            emailEl.value = requestedEmail;
            emailEl.readOnly = true;
            $('.login-code-row', form).hidden = false;
            codeEl.required = true;
            codeEl.focus();
            btn.dataset.step = 'verify';
            btn.textContent = '登录';
            msg.textContent = '验证码已发送，10 分钟内有效';
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
            const d = await readJsonResponse(r, '验证码验证失败');
            if (!d.token) throw new Error('验证码验证失败：未收到登录凭证');
            await finishLogin(d.token, d.user);
            closeLoginModal();
          }
        } catch (err) {
          const stage = step === 'request' ? '发送验证码' : '验证码登录';
          msg.textContent = fetchFailureMessage(err, stage);
          msg.className = 'login-msg err';
          if (step === 'verify' && /请先请求验证码|验证码已过期/.test(err.message || '')) {
            btn.dataset.step = 'request';
            btn.textContent = '发送验证码';
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
      me = await readJsonResponse(r, '用户信息获取失败');
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
  function badgeZone(z, top) {
    if (!z) return '';
    if (top) return `<span class="zone ztop">TOP·${z}区</span>`;
    return `<span class="zone z${z}">${z}区</span>`;
  }
  function badgeIF(v, q) {
    if (v === undefined || v === null) return '';
    const qq = q ? ` iq-${q}` : '';
    const qtext = q ? ` · ${q}` : '';
    return `<span class="if-pill${qq}" title="JCR 影响因子 2024 · JCR 分区${q||'—'}">IF ${(+v).toFixed(1)}${qtext}</span>`;
  }
  function badgeCAS(z, top) {
    if (!z) return '';
    if (top) return `<span class="zone ztop" title="中科院大类分区 Top">中科·TOP ${z}区</span>`;
    return `<span class="zone z${z}" title="中科院大类分区">中科 ${z}区</span>`;
  }
  // 国内来源交叉徽章
  function badgeDomSrc(tag) {
    const map = {
      cssci: 'CSSCI', cssci_ext: 'CSSCI 扩', pku: '北大核心',
      cnkx_T1: '科协 T1', cnkx_T2: '科协 T2', cnkx_T3: '科协 T3',
      ccft_T1: 'CCF-T1', ccft_T2: 'CCF-T2', ccft_T3: 'CCF-T3',
      zju: '浙大目录', school_a: '学校 A',
    };
    const cls = tag.replace(/[^a-z0-9]/gi,'-').toLowerCase();
    return `<span class="domsrc-pill ds-${cls}">${map[tag]||tag}</span>`;
  }
  function badgeCCF(ccf) {
    if (!ccf) return '';
    const t = String(ccf).toUpperCase().replace(/[^ABC]/g,'') || 'X';
    return `<span class="ccf-pill ccf-${t}">CCF ${t}</span>`;
  }
      function badgeTier(tier) {
        if (!tier) return '';
        const raw = String(tier).trim().toUpperCase();
        // 理工 T1/T2/T3
        const tm = raw.match(/^T([123])$/);
        if (tm) return `<span class="tier-pill t${tm[1]}" title="中国科协 T${tm[1]} 级">${raw}</span>`;
        // 管理 A/B/C/D
        const am = raw.match(/^([ABCD])$/);
        if (am) return `<span class="tier-pill ta-${am[1].toLowerCase()}" title="中国科协 ${am[1]} 级（管理类）">${raw}</span>`;
        return `<span class="tier-pill">${raw}</span>`;
      }
      function badgeFlagship(kind) {
        if (!kind) return '';
        const map = {
          nature_main:  ['Nature 正刊', 'flag-nature-main'],
          science_main: ['Science 正刊','flag-science-main'],
          cell_main:    ['Cell 正刊',   'flag-cell-main'],
          nature_sub:   ['Nature 子刊', 'flag-nature-sub'],
          science_sub:  ['Science 子刊','flag-science-sub'],
          cell_sub:     ['Cell 子刊',   'flag-cell-sub'],
        };
        const m = map[kind];
        if (!m) return '';
        return `<span class="flagship-pill ${m[1]}" title="${m[0]}">★ ${m[0]}</span>`;
      }
      function badgeXR(z) {
        if (!z) return '';
        return `<span class="xr-pill xr-${z}" title="中科院 2026 新锐版分区">新锐 ${z}区</span>`;
      }
      function badgeWarn() { return `<span class="warn-pill">⚠ Warning</span>`; }

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
      addDomIndex(r.name, 'name', { source:'cssci_ext', label:'CSSCI 扩', tag:'', discipline:r.discipline });
    });
    (d.pku_core||[]).forEach(r => {
      addDomIndex(r.name, 'name', { source:'pku', label:'北大核心', tag:'', category:r.category });
    });
    ((d.cnkx && d.cnkx.records)||[]).forEach(r => {
      if (!r.tier || !/^T[123]$/.test(r.tier)) return;
      addDomIndex(r.name, 'name', { source:'cnkx', label:'科协 '+r.tier, tag:r.tier, domain:r.domain });
      if (r.issn) addDomIndex(r.issn, 'issn', { source:'cnkx', label:'科协 '+r.tier, tag:r.tier, domain:r.domain });
    });
    (d.ccft||[]).forEach(r => {
      addDomIndex(r.cn_name, 'name', { source:'ccft', label:'CCF-'+r.tier, tag:r.tier, org:r.org });
      if (r.cn_code) addDomIndex(r.cn_code, 'issn', { source:'ccft', label:'CCF-'+r.tier, tag:r.tier });
    });
    ((d.zju && d.zju.records)||[]).forEach(r => {
      addDomIndex(r.name.replace(/\*$/,''), 'name', { source:'zju', label:'浙大 '+r.tier, tag:r.tier });
      if (r.issn) addDomIndex(r.issn, 'issn', { source:'zju', label:'浙大 '+r.tier, tag:r.tier });
    });
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
    const enName = r.en_name ? `<span class="jname-cn">${escape(r.en_name)}</span>` : '';
    const isnCell = r.issn || r.cn_code
      ? `<span class="jissn">${escape(r.issn || r.cn_code)}</span>`
      : '<span class="muted-cell">—</span>';
    const crossBadges = renderDomCrossBadges({ name, issn: r.issn, cn_code: r.cn_code }, src);
    const tierBadge = showTier && tierValue ? badgeTier(tierValue) : '';
    return `<tr class="j-row clickable" data-fid="${escape(fid)}" data-src="${escape(src)}">
      ${showTier ? `<td style="width:60px">${tierBadge}</td>` : ''}
      <td class="jname" style="font-size:13.5px">${escape(name.replace(/\*$/,''))}${enName}</td>
      <td class="col-issn" style="width:130px">${isnCell}</td>
      ${extraCols}
      <td class="col-cross"><div class="badges">${extraBadges}${crossBadges}</div></td>
      <td class="col-fav">${starBtn(r, src)}</td>
    </tr>`;
  }

  function renderRow(r) {
    const fid = favId(r);
    rowRecordsByFid[fid] = { ...r, __src: 'int' };
    const flagshipHtml = r.flagship ? `<span class="flagship-star fs-${r.flagship}" title="${r.flagship.replace('_',' ')}">★</span>` : '';
    const nameHtml = `<div class="jname">${flagshipHtml}${escape(r.name)}${r.cn_name ? `<span class="jname-cn">${escape(r.cn_name)}</span>` : ''}</div>`;
    const abbr = r.abbr20 ? `<span class="jabbr">${escape(r.abbr20)}</span>` : '';
    const issn = r.issn || r.eissn
      ? `<span class="jissn">${r.issn||''}${r.eissn ? ` <span class="eissn">e:${r.eissn}</span>` : ''}</span>`
      : '<span class="muted-cell">—</span>';
    const crossBadges = renderDomCrossBadges(r, 'int');
    // 第一行：索引（SCIE/SSCI/AHCI/ESCI/EI）— 回答"这本被哪些数据库收录"
    const indexBadges = [
      badgeFlagship(r.flagship),
      ...(r.indices || []).map(badgeIndex),
    ].filter(Boolean).join('');
    // 第二行：分区/IF/等级/预警 — 回答"这本的等级和影响力"
    const rankBadges = [
      badgeCAS(r.cas_zone, r.cas_top),
      badgeXR(r.cas_xr && r.cas_xr.zone),
      badgeIF(r.if_2024, r.if_quartile),
      badgeCCF(r.ccf),
      ...(r.cnkx ? r.cnkx.slice(0,2).map(c => badgeTier(c.tier)) : []),
      r.warning ? badgeWarn() : '',
      crossBadges,
    ].filter(Boolean).join('');
    const badgeCell = [
      indexBadges ? `<div class="badges badges-idx">${indexBadges}</div>` : '',
      rankBadges  ? `<div class="badges badges-rank">${rankBadges}</div>`  : '',
    ].filter(Boolean).join('') || '<span class="muted-cell">—</span>';
    const cat = [r.esi_category, r.cas_major_cn]
      .filter(Boolean).map(escape).join(' · ') || '<span class="muted-cell">—</span>';
    return `<tr data-fid="${escape(fid)}" class="j-row clickable ${r.flagship ? 'row-flagship' : ''}" data-src="int">
      <td class="col-fav">${starBtn(r, 'int')}</td>
      <td class="col-name">${nameHtml}</td>
      <td class="col-badge col-badge-split">${badgeCell}</td>
      <td class="col-cat">${cat}</td>
      <td class="col-abbr">${abbr || '<span class="muted-cell">—</span>'}</td>
      <td class="col-issn">${issn}</td>
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
    if (activeFeats.has('xr') && !r.cas_xr) return false;
    if (activeFeats.has('flagship') && !r.flagship) return false;
    if (activeFeats.has('warning') && !r.warning) return false;
    if (activeCat !== '__all' && r.esi_category !== activeCat) return false;
    if (activeQuery) {
      return scoreRecord(r, activeQuery) > 0;
    }
    return true;
  }

  // 搜索排序：精确名 > 旗舰刊 > 前缀 > ISSN 精确 > 缩写精确 > 包含
  function scoreRecord(r, query) {
    const q = (query||'').trim().toLowerCase();
    if (!q) return 1;
    const name = (r.name||'').toLowerCase();
    const abbr = (r.abbr20||'').toLowerCase();
    const cn = (r.cn_name||'').toLowerCase();
    const issn = (r.issn||'').toLowerCase();
    const eissn = (r.eissn||'').toLowerCase();
    const publisher = (r.publisher||'').toLowerCase();
    const country = (r.country||'').toLowerCase();

    // 精确匹配（最高优先级）
    if (name === q) return 1000;
    if (issn === q || eissn === q) return 950;
    if (abbr === q) return 900;
    if (cn === q) return 880;

    // 前缀匹配（"nature"→"Nature Cities"会命中前缀）
    if (name.startsWith(q + ' ') || name.startsWith(q + '-') || name.startsWith(q + ':')) {
      // 旗舰刊子刊更高
      let s = 800;
      if (r.flagship && /(_main|_sub)$/.test(r.flagship)) s += 50;
      // 子刊按字母排（顺序号其实由 sort 决定）
      return s;
    }
    if (cn.startsWith(q)) return 700;
    if (abbr.startsWith(q)) return 680;

    // 词边界匹配（"cell"在"Cell Reports"中出现在词首）
    const wordRe = new RegExp('\\b' + q.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\b', 'i');
    if (wordRe.test(r.name||'')) return 500;
    if (wordRe.test(r.cn_name||'')) return 480;

    // 包含
    if (name.includes(q)) return 200;
    if (cn.includes(q)) return 180;
    if (publisher.includes(q)) return 100;
    if (country.includes(q)) return 50;
    return 0;
  }

  function renderInt() {
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
    $('#results-title').textContent = activeCat === '__all'
      ? t('results_all') : activeCat;
    const visible = filtered.slice(0, shown);
    const tbody = $('#tbody');
    if (!visible.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">${t('empty')}</td></tr>`;
    } else {
      tbody.innerHTML = visible.map(renderRow).join('');
    }
    $('#results-count').textContent = `${t('showing')} ${visible.length} ${t('of')} ${filtered.length.toLocaleString()} ${t('total_items')}`;
    const more = $('#more');
    more.hidden = filtered.length <= shown;
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
      // 官方 59 个学科领域顺序
      const DOMAIN_ORDER = (d.domains && d.domains.length)
        ? d.domains.map(x => x.name)
        : Array.from(new Set(d.records.map(r => r.domain).filter(Boolean)));

      // 只保留带 tier 的正常记录
      const cleanRecs = d.records.filter(r => r.tier && r.tier.match(/^T[123]$/));

      // 按 domain（59 官方领域）分组
      const byDomain = {};
      let filtered = 0;
      for (const r of cleanRecs) {
        if (q) {
          const hay = (r.name + ' ' + (r.issn||'') + ' ' + (r.domain||'') + ' ' + (r.subdomain||'')).toLowerCase();
          if (!hay.includes(q)) { filtered++; continue; }
        }
        const dom = r.domain || '未分类';
        (byDomain[dom] = byDomain[dom] || []).push(r);
      }
      const doms = DOMAIN_ORDER.filter(t => byDomain[t] && byDomain[t].length);
      Object.keys(byDomain).forEach(t => { if (!doms.includes(t)) doms.push(t); });

      const html = [];
      html.push(`<div class="section-block">
        <h3 class="section-title">中国科协高质量科技期刊分级目录 (2025-12)</h3>
        <div class="section-subtitle">T1 / T2 / T3 三级；${DOMAIN_ORDER.length} 个官方学科领域，含 ${cleanRecs.length.toLocaleString()} 条带分级记录${q?`；已过滤 ${filtered} 条不匹配`:''}</div>`);
      for (const dom of doms) {
        const recs = byDomain[dom]; if (!recs || !recs.length) continue;
        const t1 = recs.filter(r => r.tier === 'T1');
        const t2 = recs.filter(r => r.tier === 'T2');
        const t3 = recs.filter(r => r.tier === 'T3');
        // 细分学科（subdomain 字段，可能为空）
        const subC = {};
        for (const r of recs) {
          const k = r.subdomain || '';
          if (k) subC[k] = (subC[k] || 0) + 1;
        }
        const subs = Object.entries(subC).sort((a,b) => b[1]-a[1]);
        html.push(`<details class="section-block" style="margin-top:14px" ${q?'open':''}>
          <summary>
            ${escape(dom)}
            <span class="muted-cell">(${recs.length})</span>
            <span class="tier-mini t1">T1 ${t1.length}</span>
            <span class="tier-mini t2">T2 ${t2.length}</span>
            <span class="tier-mini t3">T3 ${t3.length}</span>
          </summary>
          ${subs.length ? `<div class="muted-cell" style="margin:8px 0 4px;font-size:12px;line-height:1.7">
            ${subs.slice(0, 24).map(([s,c]) => `<span style="display:inline-block;margin-right:10px">${escape(s)} <span style="opacity:.6">(${c})</span></span>`).join('')}
            ${subs.length > 24 ? `<span style="opacity:.6">… 共 ${subs.length} 个细分</span>` : ''}
          </div>` : ''}
          <div class="table-wrap" style="margin-top:10px"><table class="journals"><thead><tr>
            <th style="width:60px">T级</th><th>期刊</th><th style="width:120px">ISSN</th><th style="width:160px">细分</th><th>交叉收录</th><th style="width:40px"></th>
          </tr></thead><tbody>
          ${[t1,t2,t3].flat().slice(0, 300).map(r => renderDomRow(r, {
            src: 'cnkx', showTier: true, tierValue: r.tier,
            extraCols: `<td class="muted-cell" style="width:160px">${escape(r.subdomain || '—')}</td>`,
          })).join('')}
          ${recs.length > 300 ? `<tr><td colspan="6" class="empty">仅显示前 300 条，剩余 ${recs.length - 300} 条请搜索</td></tr>` : ''}
          </tbody></table></div>
        </details>`);
      }
      html.push('</div>');
      box.innerHTML = html.join('');
      return;
    }

    if (activeDom === 'cssci_core' || activeDom === 'cssci_ext') {
      const list = activeDom === 'cssci_core' ? (domestic.cssci_core||[]) : (domestic.cssci_ext||[]);
      const srcKey = activeDom === 'cssci_core' ? 'cssci' : 'cssci_ext';
      const title = activeDom === 'cssci_core' ? 'CSSCI 来源期刊目录 (2025-2026)' : 'CSSCI 扩展版来源期刊目录 (2025-2026)';
      const f = list.filter(r => !q || (r.name + ' ' + (r.discipline||'')).toLowerCase().includes(q));
      const byDisc = {};
      for (const r of f) (byDisc[r.discipline||'未分类'] = byDisc[r.discipline||'未分类'] || []).push(r);
      const discs = Object.keys(byDisc).sort((a,b) => byDisc[b].length - byDisc[a].length);
      box.innerHTML = `<div class="section-block">
        <h3 class="section-title">${title}</h3>
        <div class="section-subtitle">共 ${list.length.toLocaleString()} 条；南京大学中国社会科学研究评价中心；${q ? '已过滤 '+f.length+' 条' : ''}</div>
        ${discs.map(d => `
          <details class="section-block" style="margin-top:14px" ${q?'open':''}>
            <summary>${escape(d)} <span class="muted-cell">(${byDisc[d].length})</span></summary>
            <div class="table-wrap" style="margin-top:10px"><table class="journals"><thead><tr>
              <th>期刊名称</th><th style="width:130px">ISSN</th><th style="width:160px">学科</th><th>交叉收录</th><th style="width:40px"></th>
            </tr></thead><tbody>
              ${byDisc[d].map(r => renderDomRow(r, {
                src: srcKey,
                extraCols: `<td class="muted-cell" style="width:160px">${escape(r.discipline||'')}</td>`,
              })).join('')}
            </tbody></table></div>
          </details>
        `).join('')}
      </div>`;
      return;
    }

    if (activeDom === 'pku_core') {
      const list = domestic.pku_core || [];
      const f = list.filter(r => !q || (r.name + ' ' + (r.category||'')).toLowerCase().includes(q));
      box.innerHTML = `<div class="section-block">
        <h3 class="section-title">北大《中文核心期刊要目总览》(2023 年版)</h3>
        <div class="section-subtitle">共 ${list.length.toLocaleString()} 条；北京大学图书馆；${q ? '已过滤 '+f.length+' 条' : ''}</div>
        <div class="table-wrap" style="margin-top:14px"><table class="journals"><thead><tr>
          <th>期刊名称</th><th style="width:130px">ISSN</th><th style="width:160px">分类</th><th>交叉收录</th><th style="width:40px"></th>
        </tr></thead><tbody>
          ${f.slice(0, 2000).map(r => renderDomRow(r, {
            src: 'pku',
            extraCols: `<td class="muted-cell" style="width:160px">${escape(r.category||'')}</td>`,
          })).join('')}
          ${f.length > 2000 ? `<tr><td colspan="5" class="empty">仅显示前 2000 条，请在搜索框内精确查找</td></tr>` : ''}
        </tbody></table></div>
      </div>`;
      return;
    }

    if (activeDom === 'zju_zju') {
      const src = domestic.zju;
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
        <h3 class="section-title">${escape(src.source || '浙江大学 2024 期刊分级')}</h3>
        <div class="section-subtitle">共 ${list.length.toLocaleString()} 条；带 ★ 为人文社科权威级期刊（一级内）</div>`];
      for (const tier of tierOrder) {
        const recs = byTier[tier]; if (!recs || !recs.length) continue;
        html.push(`<details class="section-block" style="margin-top:14px" ${q?'open':(tier==='一级'?'open':'')}>
          <summary>国内${escape(tier)}学术期刊 <span class="muted-cell">(${recs.length})</span></summary>
          <div class="table-wrap" style="margin-top:10px"><table class="journals"><thead><tr>
            <th style="width:70px">级别</th><th>期刊</th><th style="width:130px">ISSN / CN</th><th style="width:180px">备注</th><th>交叉收录</th><th style="width:40px"></th>
          </tr></thead><tbody>
          ${recs.slice(0, 1500).map(r => {
            const tierBadge = `<span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(r.tier)}</span>${r.name.includes('*') ? ' <span class="warn-pill" style="background:var(--gold);color:#fff">★</span>' : ''}`;
            return renderDomRow(
              { ...r, name: r.name.replace(/\*$/,'') },
              {
                src: 'zju',
                extraCols: `<td class="muted-cell" style="width:180px">${escape(r.note||'')}</td>`,
                extraBadges: '',
              }
            ).replace(
              /<td style="width:60px">[^<]*<\/td>/, ''
            ).replace(
              /<tr class="j-row clickable" (data-fid=[^>]+)>/,
              `<tr class="j-row clickable" $1><td style="width:70px">${tierBadge}</td>`
            );
          }).join('')}
          ${recs.length > 1500 ? `<tr><td colspan="6" class="empty">仅显示前 1500 条，请在搜索框内精确查找</td></tr>` : ''}
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
          <h3 class="section-title">${escape(src.source || '高校自编目录 · 2023 期刊分级')} <span class="unlocked-pill">✓ 已解锁</span>
            <button class="tiny-btn" id="lock-again" style="float:right">锁回</button>
          </h3>
          <div class="section-subtitle">共 ${list.length.toLocaleString()} 条；带 ★ 为人文社科权威级期刊</div>`];
        for (const tier of tierOrder) {
          const recs = byTier[tier]; if (!recs || !recs.length) continue;
          html.push(`<details class="section-block" style="margin-top:14px" ${q?'open':(tier==='一级'?'open':'')}>
            <summary>国内${escape(tier)}学术期刊 <span class="muted-cell">(${recs.length})</span></summary>
            <div class="table-wrap" style="margin-top:10px"><table class="journals"><thead><tr>
              <th style="width:70px">级别</th><th>期刊</th><th style="width:130px">ISSN / CN</th><th style="width:180px">备注</th><th>交叉收录</th><th style="width:40px"></th>
            </tr></thead><tbody>
            ${recs.slice(0, 1500).map(r => {
              const tierBadge = `<span class="tier-pill ${tierClass[r.tier]||'t3'}">${escape(r.tier)}</span>${r.name.includes('*') ? ' <span class="warn-pill" style="background:var(--gold);color:#fff">★</span>' : ''}`;
              return renderDomRow(
                { ...r, name: r.name.replace(/\*$/,'') },
                { src: 'school_a', extraCols: `<td class="muted-cell" style="width:180px">${escape(r.note||'')}</td>` }
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
          if (confirm('锁回后需要再次输入解锁码。确认？')) { forgetUnlock('school_a'); renderDomestic(); }
        });
        return;
      }
      // 未解锁 → 付费着陆页
      box.innerHTML = `
        <div class="locked-landing">
          <div class="locked-hero">
            <div class="locked-badge">🔒 高校自编目录</div>
            <h2>高校自编目录 · 期刊分级目录 (2023 版)</h2>
            <p class="locked-sub">学校人事处 / 科研处自编，用于校内职称评审、科研奖励、毕业考核的权威参考目录。共收录 <b>${src.count || '2,390'}</b> 条国内外期刊，分「一级 / 核心 / 其他」三级，含人文社科权威标注。</p>
            <div class="locked-specs">
              <div class="spec">
                <div class="spec-k">收录条数</div>
                <div class="spec-v">${src.count || '2,390'}</div>
              </div>
              <div class="spec">
                <div class="spec-k">分级层次</div>
                <div class="spec-v">一级 / 核心 / 其他</div>
              </div>
              <div class="spec">
                <div class="spec-k">版本</div>
                <div class="spec-v">2023 最新</div>
              </div>
              <div class="spec">
                <div class="spec-k">解锁方式</div>
                <div class="spec-v">一码终身</div>
              </div>
            </div>
            <div class="locked-actions">
              <button class="big-btn primary" id="open-unlock">我已有解锁码，立即解锁</button>
              <a class="big-btn ghost" href="mailto:support@ailatest.org?subject=申请学校 A 目录解锁码">💬 联系获取解锁码</a>
            </div>
            <div class="locked-note">
              · 解锁码绑定本浏览器，下次自动识别，无需再输<br/>
              · AES-GCM + PBKDF2 加密存储，传输过程不落明文<br/>
              · 同站后续新增高校目录（浙大、同济等）将陆续上线
            </div>
            <div class="unlock-slot" id="unlock-slot" hidden></div>
          </div>
        </div>`;
      $('#open-unlock')?.addEventListener('click', () => {
        const slot = $('#unlock-slot');
        slot.hidden = false;
        slot.innerHTML = lockedPrompt('school_a', src.source || '高校自编目录 · 期刊分级目录 2023', src.count || 0);
        slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    if (activeDom === 'ccft') {
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
          <th style="width:60px">T分区</th><th>期刊</th><th style="width:130px">CN</th><th style="width:180px">主办单位</th><th>交叉收录</th><th style="width:40px"></th>
        </tr></thead><tbody>
        ${f.map(r => renderDomRow(
          { name: r.cn_name, en_name: r.en_name, issn: r.cn_code, cn_code: r.cn_code, org: r.org, ccf_area: r.ccf_area, tier: r.tier },
          {
            src: 'ccft', showTier: true, tierValue: r.tier,
            extraCols: `<td class="muted-cell" style="width:180px">${escape(r.org||'')}</td>`,
          }
        )).join('')}
        </tbody></table></div>
      </div>`;
    }
  }

  // ───────── 详情抽屉 ─────────
  let drawerOpen = false;
  function openDrawer(r) {
    const drawer = $('#j-drawer'), scrim = $('#drawer-scrim'), body = $('#drawer-body');
    if (!drawer || !body) return;
    const src = r.__src || 'int';
    const title = r.name || r.cn_name || '';
    const sub = r.cn_name && r.cn_name !== title ? r.cn_name
              : r.en_name && r.en_name !== title ? r.en_name : '';
    const issn = r.issn || r.cn_code || '';
    const eissn = r.eissn || '';

    // （按用户要求：不再外链到 LetPub / SCImago / Scholar / ISSN Portal，一切自己做）

    // 徽章块
    const intBadges = src === 'int' ? [
      ...(r.indices || []).map(badgeIndex),
      badgeCAS(r.cas_zone, r.cas_top),
      badgeIF(r.if_2024, r.if_quartile),
      badgeCCF(r.ccf),
      r.warning ? badgeWarn() : '',
    ].filter(Boolean).join('') : '';
    const tierBadge = r.tier && /^T[123]$/.test(r.tier) ? badgeTier(r.tier)
                    : r.tier ? `<span class="tier-pill t3">${escape(r.tier)}</span>` : '';
    const crossBadges = renderDomCrossBadges(r, src);

    // 基础元信息（真实字段）
    const meta = [];
    if (r.abbr20 && r.abbr20 !== (r.name||'').replace(/\*$/,'')) meta.push(['期刊缩写', r.abbr20]);
    if (r.publisher) meta.push(['出版商', r.publisher]);
    if (r.org) meta.push(['主办单位', r.org]);
    if (r.address) meta.push(['出版地址', r.address]);
    if (r.country) meta.push(['国家/地区', r.country]);
    if (r.languages || r.language_cn || r.language) meta.push(['语种', r.languages || r.language_cn || r.language]);
    if (r.frequency) meta.push(['出版周期', r.frequency]);
    if (r.discipline) meta.push(['学科', r.discipline]);
    if (r.category) meta.push(['分类', r.category]);
    if (r.domain) meta.push(['科协领域', r.domain + (r.subdomain ? ' · ' + r.subdomain : '')]);
    if (r.ccf_area) meta.push(['CCF 方向', r.ccf_area]);
    if (r.note) meta.push(['备注', r.note]);
    const metaHTML = meta.map(([k,v]) => `<div class="meta-row"><div class="meta-k">${k}</div><div class="meta-v">${escape(v)}</div></div>`).join('');

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
            <span class="locked-src-name">高校自编目录 · 2023</span>
            <span class="tier-pill ${tierCls}">${escape(hit.tier || '收录')}</span>
            ${hit.note ? `<span class="muted-cell">· ${escape(hit.note)}</span>` : ''}
          </div>`);
        }
      }
      return rows.length
        ? `<div class="drawer-section">
             <h4>🔓 已解锁目录收录</h4>
             ${rows.join('')}
             <div class="muted-cell" style="margin-top:6px;font-size:12px">加密目录解锁后仅本设备可见。</div>
           </div>`
        : '';
    })();

    // 核心指标数值（带年份，避免不知道是哪一版数据）
    const stats = [];
    if (r.if_2024 != null) stats.push(['影响因子 (JCR 2024)', r.if_2024]);
    if (r.if_quartile) stats.push(['JCR 分区 (2024)', r.if_quartile]);
    if (r.if_rank) stats.push(['IF 排名 (2024)', r.if_rank]);
    if (r.cas_zone) stats.push(['中科院 2025 大类', r.cas_zone + '区' + (r.cas_top ? ' · Top' : '')]);
    if (r.cas_zone_2023 && r.cas_zone_2023 !== r.cas_zone) stats.push(['中科院 2023 大类', r.cas_zone_2023 + '区']);
    if (r.cas_xr && r.cas_xr.zone) stats.push(['新锐版 2026', r.cas_xr.zone + '区']);
    if (r.cas_oa === true) stats.push(['开放获取', 'OA ✓']);
    const statsHTML = stats.length ? `<div class="stats-grid">${stats.map(([k,v]) =>
      `<div class="stat"><div class="stat-v">${escape(String(v))}</div><div class="stat-k">${k}</div></div>`
    ).join('')}</div>` : '';

    // WoS 学科分类
    const wosHTML = (Array.isArray(r.wos_categories) && r.wos_categories.length)
      ? `<div class="drawer-section">
           <h4>Web of Science 分类</h4>
           <div class="cat-chips">${r.wos_categories.map(c => `<span class="cat-chip">${escape(c)}</span>`).join('')}</div>
           ${r.esi_category ? `<div class="esi-row"><span class="esi-label">ESI 高被引学科</span><span class="esi-val">${escape(r.esi_category)}</span></div>` : ''}
         </div>`
      : '';

    // Ei Compendex 主题分类
    const eiHTML = (Array.isArray(r.ei_subjects) && r.ei_subjects.length)
      ? `<div class="drawer-section">
           <h4>Ei Compendex 主题</h4>
           <div class="cat-chips">${r.ei_subjects.map(c => `<span class="cat-chip">${escape(c)}</span>`).join('')}</div>
         </div>`
      : '';

    // 中科院完整层级（2025 大类分区）
    const casHTML = (() => {
      const blocks = [];
      if (r.cas_major_cn) {
        blocks.push(`<div class="cas-major"><span class="zone-tier">大类</span> ${escape(r.cas_major_cn)} · <b>${r.cas_major_zone || r.cas_zone || '?'}区</b>${r.cas_top ? ' · Top' : ''}</div>`);
      }
      if (Array.isArray(r.cas_sub_cats) && r.cas_sub_cats.length) {
        blocks.push(`<ul class="cas-sub-list">${r.cas_sub_cats.map(s => {
          const nm = typeof s === 'string' ? s : (s.name || '');
          const zn = typeof s === 'object' ? s.zone : null;
          return `<li><span class="zone-tier zone-tier-sub">小类</span> ${escape(nm)}${zn ? ` · <b>${zn}区</b>` : ''}</li>`;
        }).join('')}</ul>`);
      }
      return blocks.length
        ? `<div class="drawer-section"><h4>中科院文献情报中心分区 · 2025 年度</h4>${blocks.join('')}</div>`
        : '';
    })();

    // 中科院新锐版 2026（独立块）
    const xrHTML = (() => {
      const xr = r.cas_xr;
      if (!xr || !xr.zone) return '';
      const blocks = [];
      const majorCn = xr.major_cn || '';
      const majorEn = xr.major_en || '';
      const majorText = [majorCn, majorEn].filter(Boolean).join(' · ');
      blocks.push(`<div class="cas-major"><span class="zone-tier">大类</span> ${escape(majorText || '（未标注大类）')} · <b>新锐 ${xr.zone} 区</b></div>`);
      if (Array.isArray(xr.subs) && xr.subs.length) {
        blocks.push(`<ul class="cas-sub-list">${xr.subs.map(s => {
          const nm = s.cat || s.name || '';
          const zn = s.zone;
          return `<li><span class="zone-tier zone-tier-sub">小类</span> ${escape(nm)}${zn ? ` · <b>新锐 ${zn} 区</b>` : ''}</li>`;
        }).join('')}</ul>`);
      }
      blocks.push(`<div class="muted-cell" style="margin-top:6px;font-size:12px;line-height:1.6">新锐版面向成长期期刊提供独立分区，与主大类分区互为补充。"大类"为学科门类层级（如历史学），"小类"为细分学科。数据源：ShowJCR 新锐版 2026。</div>`);
      return `<div class="drawer-section"><h4>新锐版分区 · 2026 年度</h4>${blocks.join('')}</div>`;
    })();

    // 科协历史分级（科协 2025-12 版，多领域可同时收录）
    const cnkxHTML = (Array.isArray(r.cnkx) && r.cnkx.length)
      ? `<div class="drawer-section">
           <h4>中国科协高质量科技期刊分级目录 · 2025-12 版</h4>
           <ul class="cas-sub-list">${r.cnkx.map(c =>
             `<li><b>${escape(c.tier||'')}</b>${c.domain ? ' · ' + escape(c.domain) : ''}${c.subdomain ? ' <span class="muted-cell">· '+escape(c.subdomain)+'</span>' : ''}</li>`
           ).join('')}</ul>
           <div class="muted-cell" style="margin-top:6px;font-size:12px;line-height:1.6">同一刊在多个学科领域分别评定 T1 / T2 / T3，互不冲突。</div>
         </div>`
      : '';

    // 警示刊
    const warnHTML = r.warning
      ? `<div class="drawer-section warn-block">
           <h4>⚠ 警示期刊提示</h4>
           <p>该刊被中科院纳入 ${escape(r.warning_year || '最新')} 国际期刊预警名单。投稿前请谨慎评估，留意审稿周期、版面费、学术影响等因素。</p>
         </div>`
      : '';

    // OpenAlex enriched block (homepage / OA / APC)
    const oa = r.oa || lookupOA(r);
    const oaHTML = oa ? (() => {
      const labelMap = {
        diamond:                 { text: 'Diamond OA · 读投全免费',   cls: 'oa-diamond',  desc: '由机构/基金全额资助，作者读者都不付费。' },
        gold_apc:                { text: 'Gold OA · 投稿付 APC',       cls: 'oa-gold',     desc: '全刊开放获取，作者支付版面费（APC）。' },
        hybrid:                  { text: 'Hybrid · 可选 OA',           cls: 'oa-hybrid',   desc: '订阅制刊，可选付 APC 开放单篇。' },
        subscription_paid_read:  { text: '订阅制 · 读付费',            cls: 'oa-sub',      desc: '读者需订阅，作者投稿通常免费（个别收 page charge）。' },
        unknown:                 { text: '付费模式未知',               cls: 'oa-unk',      desc: '' },
      };
      // Normalize both compact (hp/l/oa/dj/apc/org/w) and verbose shapes
      const label   = oa.l || oa.label || 'unknown';
      const L       = labelMap[label] || labelMap.unknown;
      const homepage= oa.hp || oa.homepage;
      const apcVal  = oa.apc ?? oa.apc_usd;
      const isoa    = oa.oa ?? oa.is_oa;
      const doaj    = oa.dj ?? oa.in_doaj;
      const org     = oa.org || oa.host_org;
      const works   = oa.w   || oa.works_count;
      const apc = (apcVal && apcVal > 0) ? `USD ${apcVal.toLocaleString()}` : null;
      const doajBadge = doaj ? '<span class="oa-chip oa-doaj">✓ 收录 DOAJ</span>' : '';
      const isoaBadge = isoa ? '<span class="oa-chip oa-isoa">Open Access</span>' : '';
      const rows = [];
      if (homepage) rows.push(['官网', `<a href="${escape(homepage)}" target="_blank" rel="noopener nofollow">${escape(homepage.replace(/^https?:\/\//,'').replace(/\/$/,''))}</a>`]);
      if (apc) rows.push(['版面费 (APC)', apc]);
      if (org) rows.push(['出版方 (OpenAlex)', escape(org)]);
      if (works) rows.push(['已发表论文', works.toLocaleString() + ' 篇']);
      return `<div class="drawer-section oa-section">
        <h4>开放获取 / 版面费</h4>
        <div class="oa-head">
          <span class="oa-pill ${L.cls}">${L.text}</span>
          ${doajBadge}${isoaBadge}
        </div>
        ${L.desc ? `<div class="oa-desc muted">${L.desc}</div>` : ''}
        ${rows.length ? `<div class="oa-rows">${rows.map(([k,v]) =>
          `<div class="meta-row"><div class="meta-k">${k}</div><div class="meta-v">${v}</div></div>`
        ).join('')}</div>` : ''}
        <div class="oa-footnote muted">数据来源：OpenAlex snapshot 2026-05。仅供参考，最终以期刊官网为准。</div>
      </div>`;
    })() : '';

    const on = isFav(r);
    body.innerHTML = `
      <div class="drawer-hero">
        <div class="drawer-title">${escape(title.replace(/\*$/,''))}</div>
        ${sub ? `<div class="drawer-sub">${escape(sub)}</div>` : ''}
        <div class="drawer-issn">${issn ? 'ISSN ' + escape(issn) : ''}${eissn ? ' · eISSN ' + escape(eissn) : ''}</div>
        <div class="badges drawer-badges">${intBadges}${tierBadge}${crossBadges}</div>
        <div class="drawer-actions">
          <button class="big-btn ${on?'ghost':'primary'}" id="drawer-fav-big">${on ? '★ 已收藏（点击取消）' : '☆ 加入收藏'}</button>
          <div class="rating-pill" data-rating-key="${escape(favId(r))}" title="综合推荐评分">
            <span class="rating-avg" id="rating-avg">—</span><span class="rating-avg-suffix">/ 5</span>
            <span class="rating-avg-stars" id="rating-avg-stars"></span>
            <span class="rating-count muted-cell" id="rating-count">暂无评分</span>
          </div>
        </div>
      </div>
      ${statsHTML}
      ${oaHTML}
      ${warnHTML}
      ${metaHTML ? `<div class="meta-block">${metaHTML}</div>` : ''}
      ${casHTML}
      ${xrHTML}
      ${wosHTML}
      ${eiHTML}
      ${cnkxHTML}
      ${lockedSrcHTML}
      <div class="drawer-section rating-section" data-rating-key="${escape(favId(r))}">
        <h4>我的评分</h4>
        <div class="rating-my-wrap">
          <div class="rating-stars-input" id="rating-input" role="radiogroup" aria-label="评分"></div>
          <div class="rating-my-hint muted-cell" id="rating-hint">登录后可打分 · 半星可评 · 可随时修改</div>
        </div>
      </div>
    `;
    // init rating widget
    setTimeout(() => initRatingWidget(favId(r)), 0);
    $('#drawer-fav-big')?.addEventListener('click', () => {
      toggleFav(r, { src });
      openDrawer(r); // 刷新状态
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
      hdrFav.textContent = on ? '★' : '☆';
      hdrFav.classList.toggle('on', on);
      hdrFav.onclick = () => $('#drawer-fav-big')?.click();
    }
    // 渲染抽屉副标题标签
    const kicker = $('#drawer-kicker');
    if (kicker) {
      const SRC = {
        int: 'SCI / SSCI 国际期刊', cssci: 'CSSCI 来源期刊', cssci_ext: 'CSSCI 扩展版',
        pku: '北大核心', cnkx: '中国科协高质量目录', ccft: 'CCF 推荐中文科技期刊',
        zju: '浙江大学 2024', school_a: '高校自编目录 2023',
      };
      kicker.textContent = SRC[src] || '期刊详情';
    }

    drawer.classList.add('open');
    scrim?.classList.add('on');
    scrim && (scrim.hidden = false);
    drawerOpen = true;
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!drawerOpen) return;
    $('#j-drawer')?.classList.remove('open');
    const scrim = $('#drawer-scrim');
    scrim?.classList.remove('on');
    if (scrim) scrim.hidden = true;
    drawerOpen = false;
    document.body.style.overflow = '';
  }

  // ───────── favorites tab ─────────
  function renderFav() {
    const box = $('#fav-content');
    const list = getActiveList();
    if (!list) { box.innerHTML = ''; return; }

    // list 管理栏（全列表切换 + 新建/重命名/删除）
    const bar = favLists.map(l => `
      <button class="fav-list-chip ${l.id === activeListId ? 'active' : ''}" data-list="${escape(l.id)}">
        <span class="lname">${escape(l.name)}</span>
        <span class="lcount">${l.ids.length}</span>
      </button>`).join('');
    const toolbar = `
      <div class="fav-toolbar">
        <div class="fav-list-chips">${bar}</div>
        <div class="fav-list-ops">
          <button class="btn-mini" id="fav-list-new" title="新建清单">＋ 新建</button>
          <button class="btn-mini" id="fav-list-rename" title="重命名当前">✎ 重命名</button>
          <button class="btn-mini btn-danger" id="fav-list-del" title="删除当前" ${favLists.length<=1?'disabled':''}>🗑 删除</button>
        </div>
      </div>`;

    // 取当前 list 的有序记录
    let rows = [];
    for (const id of list.ids) {
      const rec = favsData[id] || journals.find(r => favId(r) === id);
      if (rec) rows.push({ ...rec, __src: rec.__src || 'int' });
    }
    if (activeQuery) {
      const q = activeQuery.toLowerCase();
      rows = rows.filter(r => (
        (r.name||'') + ' ' + (r.cn_name||'') + ' ' + (r.en_name||'') + ' ' +
        (r.issn||'') + ' ' + (r.cn_code||'')
      ).toLowerCase().includes(q));
    }

    if (!rows.length) {
      box.innerHTML = toolbar + `<div class="empty" style="padding:40px 0">${t('empty_fav')}</div>`;
      attachFavBarHandlers();
      return;
    }

    // 单一有序表格 + 拖动
    const tbody = rows.map(r => renderFavRow(r)).join('');
    const hint = activeQuery ? '' : `<div class="fav-drag-hint">按住 <span class="drag-ico">⋮⋮</span> 拖动排序 · 长按手机端同样支持</div>`;
    box.innerHTML = toolbar + hint + `
      <div class="table-wrap" style="margin-top:10px">
        <table class="journals fav-table">
          <thead><tr>
            <th class="col-drag" style="width:28px"></th>
            <th class="col-name">期刊</th>
            <th style="width:160px">ISSN / CN</th>
            <th>徽章 / 交叉收录</th>
            <th class="col-src" style="width:90px">来源</th>
            <th style="width:40px"></th>
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
      const name = prompt('新清单名称：', '新清单');
      if (name && name.trim()) { createList(name.trim()); renderFav(); }
    });
    const renBtn = document.getElementById('fav-list-rename');
    if (renBtn) renBtn.addEventListener('click', () => {
      const cur = getActiveList(); if (!cur) return;
      const name = prompt('重命名清单：', cur.name);
      if (name && name.trim()) { renameList(cur.id, name.trim()); renderFav(); }
    });
    const delBtn = document.getElementById('fav-list-del');
    if (delBtn) delBtn.addEventListener('click', () => {
      const cur = getActiveList(); if (!cur) return;
      if (favLists.length <= 1) { alert('至少保留一个清单'); return; }
      if (confirm(`删除清单「${cur.name}」？\n清单中的期刊若未在其他清单中也会被移除。`)) {
        deleteList(cur.id); renderFav();
        if (activeTab === 'int') renderInt();
      }
    });
  }

  function renderFavRow(r) {
    const fid = favId(r);
    rowRecordsByFid[fid] = r;
    const name = r.name || r.cn_name || '';
    const cnName = r.cn_name && r.cn_name !== name ? `<span class="jname-cn">${escape(r.cn_name)}</span>` : '';
    const enName = r.en_name && r.en_name !== name ? `<span class="jname-cn">${escape(r.en_name)}</span>` : '';
    const isnCell = (r.issn || r.cn_code || r.eissn)
      ? `<span class="jissn">${escape(r.issn || r.cn_code || '')}${r.eissn ? ` <span class="eissn">e:${r.eissn}</span>` : ''}</span>`
      : '<span class="muted-cell">—</span>';
    const intBadges = r.__src === 'int' ? [
      ...(r.indices || []).map(badgeIndex),
      badgeCAS(r.cas_zone, r.cas_top),
      badgeXR(r.cas_xr && r.cas_xr.zone),
      badgeIF(r.if_2024, r.if_quartile),
      badgeCCF(r.ccf),
      r.warning ? badgeWarn() : '',
    ].filter(Boolean).join('') : '';
    const tierBadge = r.tier && /^T[123]$/.test(r.tier) ? badgeTier(r.tier)
                    : r.tier ? `<span class="tier-pill t3">${escape(r.tier)}</span>` : '';
    const crossBadges = renderDomCrossBadges(r, r.__src);
    const SRC_LABEL = {
      int: '国际', cssci: 'CSSCI', cssci_core: 'CSSCI', cssci_ext: 'CSSCI扩展',
      pku: '北大核心', pku_core: '北大核心', cnkx: '科协', ccft: 'CCF-T',
      zju: '浙大', school_a: '高校目录',
    };
    return `<tr class="j-row clickable" data-fid="${escape(fid)}" data-src="${escape(r.__src)}">
      <td class="col-drag"><span class="drag-handle" title="拖动排序">⋮⋮</span></td>
      <td class="col-name"><div class="jname">${escape(name.replace(/\*$/,''))}${cnName}${enName}</div></td>
      <td class="col-issn">${isnCell}</td>
      <td class="col-badge"><div class="badges">${intBadges}${tierBadge}${crossBadges}</div></td>
      <td class="col-src"><span class="src-tag src-${escape(r.__src)}">${SRC_LABEL[r.__src] || r.__src}</span></td>
      <td class="col-fav">${starBtn(r, r.__src)}</td>
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
    $('#feat-toggles').addEventListener('change', () => {
      activeFeats = new Set($$('#feat-toggles input:checked').map(i => i.value));
      shown = PAGE; renderInt();
    });
    $('#q').addEventListener('input', (e) => {
      activeQuery = e.target.value.trim();
      shown = PAGE;
      activeTab === 'int' ? renderInt()
        : activeTab === 'fav' ? renderFav()
        : renderDomestic();
    });
    $('#more').addEventListener('click', () => { shown += PAGE; renderInt(); });

    $$('.tab').forEach(b => b.addEventListener('click', () => {
      $$('.tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      activeTab = b.dataset.tab;
      $$('.tab-panel').forEach(p => p.hidden = p.dataset.panel !== activeTab);
      $$('[data-international]').forEach(el => el.hidden = activeTab !== 'int');
      $('[data-domestic]').hidden = activeTab !== 'dom';
      applyI18n(); // refresh placeholder
      if (activeTab === 'dom') renderDomestic();
      else if (activeTab === 'fav') renderFav();
      else renderInt();
    }));

    $('#fav-tab').addEventListener('click', () => {
      const favTab = $$('.tab').find(t => t.dataset.tab === 'fav');
      if (favTab) favTab.click();
    });

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
      // re-render because categories etc. are dynamic text
      if (activeTab === 'dom') renderDomestic();
      else if (activeTab === 'fav') renderFav();
      else renderInt();
    });
    $('#theme-toggle').addEventListener('click', () => {
      theme = theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('ailatest.theme', theme);
    });

    // favorite star delegation (国际 + 国内全覆盖)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.fav-star'); if (!btn) return;
      e.stopPropagation();
      const fid = btn.dataset.fav;
      const src = btn.dataset.favSrc || 'int';
      // 优先从 rowRecordsByFid 取完整记录；再回退到 journals[] / favsData
      const rec = rowRecordsByFid[fid]
        || journals.find(r => favId(r) === fid)
        || favsData[fid];
      if (!rec) return;
      toggleFav(rec, { src });
      btn.classList.toggle('on');
      btn.textContent = btn.classList.contains('on') ? '★' : '☆';
      if (activeTab === 'fav') renderFav();
    });

    // 行点击 → 详情抽屉
    document.addEventListener('click', (e) => {
      if (e.target.closest('.fav-star')) return;
      if (e.target.closest('.drag-handle')) return;
      const row = e.target.closest('tr.j-row.clickable'); if (!row) return;
      const fid = row.dataset.fid;
      const rec = rowRecordsByFid[fid] || journals.find(r => favId(r) === fid) || favsData[fid];
      if (rec) openDrawer(rec);
    });
    $('#drawer-close')?.addEventListener('click', closeDrawer);
    $('#drawer-scrim')?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    // 移动端侧栏抽屉：☰ 开 / 点 scrim 关 / 点 nav-item 自动关
    const side = document.querySelector('aside.sidebar');
    const sideScrim = $('#sidebar-scrim');
    function openSide() {
      side?.classList.add('open');
      if (sideScrim) { sideScrim.hidden = false; requestAnimationFrame(() => sideScrim.classList.add('on')); }
    }
    function closeSide() {
      side?.classList.remove('open');
      if (sideScrim) {
        sideScrim.classList.remove('on');
        setTimeout(() => { sideScrim.hidden = true; }, 200);
      }
    }
    $('#side-toggle')?.addEventListener('click', openSide);
    sideScrim?.addEventListener('click', closeSide);
    side?.addEventListener('click', (e) => {
      if (window.matchMedia('(max-width: 900px)').matches &&
          e.target.closest('.nav-item, .chip, .nav-sub')) {
        closeSide();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSide();
    });

    // auth
    $('#auth-btn').addEventListener('click', () => {
      if (user) {
        if (confirm(lang === 'zh' ? '退出登录？' : 'Sign out?')) doLogout();
      } else {
        startLogin();
      }
    });
  }

  // ───────── boot ─────────
  async function boot() {
    loadFavLists();
    bind();
    applyI18n();
    updateFavCount();
    await handleAuthCallback();
    try {
      const [j, d, m, esi, oa] = await Promise.all([
        fetch('data/journals.json').then(r => r.json()),
        fetch('data/domestic.json').then(r => r.json()).catch(() => null),
        fetch('data/meta.json').then(r => r.json()).catch(() => null),
        fetch('data/esi_categories.json').then(r => r.json()).catch(() => []),
        fetch('data/oa.json').then(r => r.json()).catch(() => ({})),
      ]);
      journals = j; domestic = d; meta = m; esiCats = esi; oaMap = oa || {};
      buildDomIndex(domestic);
      if (meta?.total && $('#total')) $('#total').textContent = meta.total.toLocaleString();
      $('#hint').textContent = lang === 'zh'
        ? `已加载 ${journals.length.toLocaleString()} 本期刊`
        : `${journals.length.toLocaleString()} journals loaded`;
      renderCatList();
      renderInt();
      if (user) await pullFavs();
    } catch (e) {
      $('#hint').textContent = 'Load failed: ' + e.message;
      console.error(e);
    }
  }

  boot();
})();
