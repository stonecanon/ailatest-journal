// journal.ailatest.org — simple client-side search/filter
(function () {
  const PAGE_SIZE = 50;
  const state = {
    journals: [],
    categories: [],
    filtered: [],
    query: "",
    cat: "",
    page: 0,
  };

  // ---------- Theme ----------
  const theme = localStorage.getItem("journal-theme") || "light";
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("journal-theme", next);
  });

  // ---------- Data load ----------
  async function _fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    if (url.endsWith('.gz')) {
      const ds = new DecompressionStream('gzip');
      const stream = resp.body.pipeThrough(ds);
      return await new Response(stream).json();
    }
    return await resp.json();
  }
  Promise.all([
    _fetchJSON("data/journals.json.gz"),
    fetch("data/categories.json").then((r) => r.json()),
  ])
    .then(([journals, cats]) => {
      state.journals = journals;
      state.categories = cats;
      renderCategories();
      applyFilter();
      const total = journals.length.toLocaleString();
      document.getElementById("total").textContent = total;
      document.getElementById("cat-count-all").textContent = total;
      document.getElementById("buildtime").textContent = new Date().toISOString().slice(0, 10);
    })
    .catch((e) => {
      document.getElementById("stats").textContent = "数据加载失败";
      console.error(e);
    });

  // ---------- Categories ----------
  function renderCategories() {
    const nav = document.getElementById("cat-nav");
    state.categories.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "cat-btn";
      btn.dataset.cat = c.name;
      btn.innerHTML = `<span>${titleCase(c.name)}</span><span class="cat-count">${c.count.toLocaleString()}</span>`;
      nav.appendChild(btn);
    });
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".cat-btn");
      if (!btn) return;
      state.cat = btn.dataset.cat;
      state.page = 0;
      nav.querySelectorAll(".cat-btn").forEach((b) => b.classList.toggle("active", b === btn));
      applyFilter();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function titleCase(s) {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ---------- Search / filter ----------
  const qInput = document.getElementById("q");
  let debounce;
  qInput.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.query = qInput.value.trim().toLowerCase();
      state.page = 0;
      applyFilter();
    }, 120);
  });

  function applyFilter() {
    const q = state.query;
    const cat = state.cat;
    const qNorm = q.replace(/\s+/g, " ");
    const isIssn = /^\d{4}-?\d{3}[\dX]$/i.test(q.replace(/\s/g, ""));
    const qIssn = isIssn ? q.replace(/\s/g, "").replace("-", "").toUpperCase() : null;

    state.filtered = state.journals.filter((j) => {
      if (cat && j.cat !== cat) return false;
      if (!q) return true;
      if (qIssn) {
        return (j.issn || "").replace("-", "").toUpperCase() === qIssn ||
               (j.eissn || "").replace("-", "").toUpperCase() === qIssn;
      }
      return j.title.toLowerCase().includes(qNorm) ||
             (j.t20 && j.t20.toLowerCase().includes(qNorm)) ||
             (j.t29 && j.t29.toLowerCase().includes(qNorm));
    });
    renderList();
  }

  // ---------- Render ----------
  function renderList() {
    const list = document.getElementById("list");
    const pager = document.getElementById("pager");
    const stats = document.getElementById("stats");
    const total = state.filtered.length;
    stats.textContent = `${total.toLocaleString()} 条匹配`;

    if (total === 0) {
      list.innerHTML = '<div class="empty">没有找到匹配的期刊。试试换个关键词或清除筛选。</div>';
      pager.hidden = true;
      return;
    }

    const start = state.page * PAGE_SIZE;
    const slice = state.filtered.slice(start, start + PAGE_SIZE);
    list.innerHTML = slice.map(renderItem).join("");

    // pager
    const pages = Math.ceil(total / PAGE_SIZE);
    pager.hidden = pages <= 1;
    document.getElementById("page-info").textContent = `第 ${state.page + 1} / ${pages} 页`;
    document.getElementById("prev").disabled = state.page === 0;
    document.getElementById("next").disabled = state.page >= pages - 1;
  }

  function renderItem(j) {
    const issnHtml = j.issn
      ? `<span class="issn" title="点击复制"><span class="issn-label">ISSN</span>${j.issn}</span>`
      : "";
    const eissnHtml = j.eissn && j.eissn !== j.issn
      ? `<span class="issn" title="点击复制"><span class="issn-label">eISSN</span>${j.eissn}</span>`
      : "";
    const catHtml = j.cat ? `<span class="chip">${titleCase(j.cat)}</span>` : "";
    return `<div class="item">
      <div class="item-title">${escapeHtml(j.title)}</div>
      <div class="item-meta">
        ${catHtml}
        ${issnHtml}
        ${eissnHtml}
      </div>
    </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ---------- Pager buttons ----------
  document.getElementById("prev").addEventListener("click", () => {
    if (state.page > 0) { state.page--; renderList(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });
  document.getElementById("next").addEventListener("click", () => {
    const pages = Math.ceil(state.filtered.length / PAGE_SIZE);
    if (state.page < pages - 1) { state.page++; renderList(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });

  // ---------- ISSN click-to-copy ----------
  document.getElementById("list").addEventListener("click", (e) => {
    const el = e.target.closest(".issn");
    if (!el) return;
    const text = el.textContent.replace(/^(ISSN|eISSN)/, "").trim();
    navigator.clipboard?.writeText(text).then(() => {
      const prev = el.style.background;
      el.style.background = "var(--chip-bg)";
      setTimeout(() => { el.style.background = prev; }, 400);
    });
  });
})();
