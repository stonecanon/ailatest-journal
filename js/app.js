// AILatest Journal — client-side search & filter
// Data: data/journals.json (~8 MB, gzipped ~1.5 MB on Cloudflare)

const PAGE_SIZE = 100;

const state = {
  all: [],
  filtered: [],
  query: '',
  cat: '__all',
  indices: new Set(['SCIE', 'SSCI', 'AHCI', 'ESCI']),
  shown: 0,
  normIndex: [], // pre-computed lowercase "name|abbr|issn|eissn" for search
};

const el = (id) => document.getElementById(id);

function norm(s) { return (s || '').toLowerCase(); }

async function loadData() {
  const [journals, esi, meta] = await Promise.all([
    fetch('data/journals.json').then(r => r.json()),
    fetch('data/esi_categories.json').then(r => r.json()),
    fetch('data/meta.json').then(r => r.json()).catch(() => ({})),
  ]);
  state.all = journals;
  state.normIndex = journals.map(j => {
    return [
      norm(j.name),
      norm(j.abbr20),
      norm(j.issn),
      norm(j.eissn),
    ].join('|');
  });
  el('total').textContent = journals.length.toLocaleString();
  el('count-all').textContent = journals.length.toLocaleString();
  el('hint').textContent = `已加载 ${journals.length.toLocaleString()} 本`;
  renderCategories(esi);
}

function renderCategories(esi) {
  const list = el('cat-list');
  list.innerHTML = '';
  esi.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.cat = c.name;
    btn.innerHTML = `<span class="cat-name">${c.name}</span><span class="count">${c.count.toLocaleString()}</span>`;
    btn.addEventListener('click', () => setCategory(c.name));
    list.appendChild(btn);
  });
  el('count-all').textContent = state.all.length.toLocaleString();
  document.querySelector('[data-cat="__all"]').addEventListener('click', () => setCategory('__all'));
}

function setCategory(cat) {
  state.cat = cat;
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.cat === cat);
  });
  applyFilter();
}

function applyFilter() {
  const q = state.query.trim().toLowerCase();
  const cat = state.cat;
  const indices = state.indices;
  const out = [];
  const n = state.all.length;
  for (let i = 0; i < n; i++) {
    const j = state.all[i];
    if (cat !== '__all' && j.esi_category !== cat) continue;
    if (indices.size < 4) {
      let ok = false;
      for (const idx of j.indices) { if (indices.has(idx)) { ok = true; break; } }
      if (!ok) continue;
    }
    if (q && state.normIndex[i].indexOf(q) === -1) continue;
    out.push(j);
  }
  state.filtered = out;
  state.shown = 0;
  renderTable(true);
  el('results-title').textContent = cat === '__all' ? '全部期刊' : cat;
  el('results-count').textContent = `${out.length.toLocaleString()} 本`;
}

function indexTags(indices) {
  return indices.map(i => `<span class="tag tag-${i.toLowerCase()}">${i}</span>`).join(' ');
}

function renderTable(reset) {
  const tbody = el('tbody');
  if (reset) tbody.innerHTML = '';
  const end = Math.min(state.shown + PAGE_SIZE, state.filtered.length);
  if (state.filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">没有匹配的期刊</td></tr>';
    el('more').hidden = true;
    return;
  }
  const frag = document.createDocumentFragment();
  for (let i = state.shown; i < end; i++) {
    const j = state.filtered[i];
    const tr = document.createElement('tr');
    const issns = [];
    if (j.issn) issns.push(`<div>${j.issn}</div>`);
    if (j.eissn && j.eissn !== j.issn) issns.push(`<div class="muted">e: ${j.eissn}</div>`);
    tr.innerHTML = `
      <td>
        <div class="j-title">${j.name}</div>
        ${j.publisher ? `<div class="j-pub">${j.publisher}${j.country ? ' · ' + j.country : ''}</div>` : ''}
      </td>
      <td><span class="j-abbr">${j.abbr20 || ''}</span></td>
      <td><div class="j-issn">${issns.join('') || '<span class="muted">—</span>'}</div></td>
      <td><div class="idx-tags">${indexTags(j.indices)}</div></td>
      <td><div class="j-cat">${j.esi_category || '<span class="muted">—</span>'}</div></td>
    `;
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
  state.shown = end;
  el('more').hidden = state.shown >= state.filtered.length;
}

function bindUI() {
  el('q').addEventListener('input', (e) => {
    state.query = e.target.value;
    clearTimeout(bindUI._t);
    bindUI._t = setTimeout(applyFilter, 120);
  });
  el('more').addEventListener('click', () => renderTable(false));
  document.querySelectorAll('#index-toggles input').forEach(cb => {
    cb.addEventListener('change', () => {
      state.indices = new Set(
        [...document.querySelectorAll('#index-toggles input:checked')].map(c => c.value)
      );
      applyFilter();
    });
  });
  // Theme toggle
  const saved = localStorage.getItem('ail-journal-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  el('theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = cur;
    localStorage.setItem('ail-journal-theme', cur);
  });
}

(async () => {
  bindUI();
  try {
    await loadData();
    applyFilter();
  } catch (e) {
    console.error(e);
    el('hint').textContent = '加载失败';
  }
})();
