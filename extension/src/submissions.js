// AILatest Journal — read-only submission status capture.
// This script deliberately reads visible DOM text only. It never reads form
// passwords, cookies, local publisher storage, or submits anything to a
// publisher. A user must review and confirm the candidates before syncing.
(function () {
  'use strict';
  if (globalThis.__ailatestSubmissionAgent) return;
  globalThis.__ailatestSubmissionAgent = true;

  const API = 'https://api.ailatest.org/submissions/import';
  const host = String(location.hostname || '').toLowerCase();
  const isElsevier = /(?:^|\.)track\.authorhub\.elsevier\.com$/.test(host) || /(?:^|\.)elsevier\.com$/.test(host);
  const isEditorialManager = /(?:^|\.)editorialmanager\.com$/.test(host);
  const isScholarOne = /(?:^|\.)(?:manuscriptcentral|scholarone)\.com$/.test(host);
  if (!isElsevier && !isEditorialManager && !isScholarOne) return;

  const STATUS_RULES = [
    ['withdrawn', /withdrawn|withdraw|撤稿|终止|cancelled|canceled/i, '撤稿/终止'],
    ['rejected', /rejected|reject|declined|拒稿|拒绝|not suitable/i, '已拒稿'],
    ['accepted', /accepted|accept|接收|已接收|in production|待出版/i, '已接收'],
    ['revision', /revision required|revise|revision|返修|修改|major revision|minor revision/i, '返修'],
    ['under_review', /under review|under consideration|with reviewer|peer review|审稿|外审/i, '外审中'],
    ['editorial_check', /with editor|editorial check|technical check|初审|编辑/i, '编辑初审'],
    ['submitted', /submitted|manuscript submitted|complete submission|已提交|已完成提交/i, '已提交'],
    ['draft', /draft|incomplete|未提交|准备投稿/i, '准备投稿'],
  ];

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, (value) => resolve(value || {})));
  }
  function storageSet(value) {
    return new Promise((resolve) => chrome.storage.local.set(value, resolve));
  }
  function clean(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max || 500);
  }
  function systemName() {
    if (isElsevier) return 'elsevier';
    if (isEditorialManager) return 'editorial_manager';
    if (isScholarOne) return 'scholarone';
    return 'unknown';
  }
  function statusFor(text) {
    const value = clean(text, 300);
    for (const [normalized, rule, label] of STATUS_RULES) {
      const match = value.match(rule);
      if (match) return { normalized, raw: clean(match[0], 120), label };
    }
    return null;
  }
  function fieldFromLines(text, labels) {
    const lines = String(text || '').split(/\n+/).map((line) => clean(line, 500)).filter(Boolean);
    for (const line of lines) {
      const pattern = new RegExp(`(?:${labels.join('|')})\\s*[:：-]\\s*(.+)$`, 'i');
      const match = line.match(pattern);
      if (match && match[1]) return clean(match[1], 500);
    }
    return '';
  }
  function manuscriptId(text) {
    const value = String(text || '');
    const match = value.match(/\b(?:manuscript(?:\s*(?:no|id|number))?|submission(?:\s*(?:no|id|number))?|ms|稿件(?:编号|号))\s*[:#：-]?\s*([A-Z0-9][A-Z0-9._/-]{3,80})/i);
    if (match) return clean(match[1], 120);
    const generic = value.match(/\b[A-Z]{2,12}[-_ ]\d{3,8}\b/);
    return generic ? clean(generic[0], 120) : '';
  }
  function journalFrom(text, link) {
    const labeled = fieldFromLines(text, ['journal(?: name)?', 'publication', '期刊']);
    if (labeled && !/status|title|manuscript/i.test(labeled)) return labeled;
    const pageTitle = clean(document.title, 240).replace(/\s*[|—–-]\s*(Editorial Manager|ScholarOne|Elsevier|Author Hub).*$/i, '').trim();
    if (pageTitle && !/editorial manager|scholarone|author hub|elsevier|manuscript|submission/i.test(pageTitle) && pageTitle.length > 2) return pageTitle;
    const heading = [...document.querySelectorAll('h1,h2,[role="heading"]')]
      .map((node) => clean(node.textContent, 240))
      .find((value) => value && !/editorial manager|scholarone|author hub|elsevier|manuscript|submission|dashboard|status/i.test(value));
    if (heading) return heading;
    const hostText = clean(new URL(link || location.href).hostname.replace(/^www\./i, ''), 120);
    if (isElsevier && /track\.authorhub/.test(hostText)) return '';
    return '';
  }
  function titleFrom(text, element) {
    const labeled = fieldFromLines(text, ['manuscript title', 'paper title', 'article title', 'title', '稿件题目']);
    if (labeled && !/status|submitted|editor|review/i.test(labeled)) return labeled;
    const link = element && element.querySelector && element.querySelector('a[href]');
    const linkText = clean(link && link.textContent, 500);
    if (linkText && !/status|details|view|action|manuscript|submission/i.test(linkText)) return linkText;
    return '';
  }
  function candidateFrom(element) {
    const text = clean(element && (element.innerText || element.textContent), 1400);
    if (text.length < 12 || text.length > 1400) return null;
    const status = statusFor(text);
    if (!status) return null;
    const journal = journalFrom(text, location.href);
    const title = titleFrom(text, element);
    const id = manuscriptId(text);
    if (!journal && !title && !id) return null;
    return {
      system: systemName(),
      journal,
      title,
      manuscript_id: id,
      status_raw: status.raw,
      status_normalized: status.normalized,
      status_label: status.label,
      source_url: location.href,
      evidence_text: text.slice(0, 900),
      status_at: Date.now(),
    };
  }
  function dedupe(records) {
    const seen = new Set();
    return records.filter((record) => {
      const key = [record.system, record.journal, record.title, record.manuscript_id, record.status_normalized].map((v) => clean(v, 240).toLowerCase()).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);
  }
  function extractCandidates() {
    const elements = [];
    const selectors = [
      'tr', 'article', 'li',
      '[class*="submission" i]', '[class*="manuscript" i]', '[data-testid*="submission" i]',
      '[data-testid*="manuscript" i]', '[role="row"]',
    ];
    selectors.forEach((selector) => {
      try { document.querySelectorAll(selector).forEach((node) => elements.push(node)); } catch (_) {}
    });
    const records = elements.map(candidateFrom).filter(Boolean);
    if (!records.length) {
      const fallback = candidateFrom(document.body);
      if (fallback) records.push(fallback);
    }
    return dedupe(records);
  }

  const root = document.createElement('div');
  root.dataset.ailatestSubmissionUi = '1';
  const shadow = root.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .launcher { position: fixed; z-index: 2147483646; right: 18px; bottom: 22px; border: 1px solid #f97316; border-radius: 999px; padding: 10px 14px; color: #fff; background: #f97316; box-shadow: 0 8px 24px #7c2d1230; font: 700 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; cursor: pointer; }
      .panel { position: fixed; z-index: 2147483647; right: 18px; bottom: 70px; width: min(430px, calc(100vw - 36px)); max-height: min(70vh, 620px); overflow: auto; padding: 18px; border: 1px solid #eadfd2; border-radius: 18px; color: #3a3028; background: #fffdf9; box-shadow: 0 18px 50px #3a30284a; font: 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      .head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; } h3 { margin:0; font-size:18px; } .close { border:0; background:transparent; color:#82776c; font-size:22px; cursor:pointer; }
      .hint { margin: 6px 0 12px; color:#776b60; font-size:12px; line-height:1.55; } .empty { padding:18px 0; color:#776b60; line-height:1.55; }
      .record { display:grid; grid-template-columns: 22px minmax(0,1fr); gap:8px; padding:12px 0; border-top:1px solid #eee3d6; } .record input { margin-top:3px; accent-color:#f97316; } .record strong { display:block; line-height:1.35; } .record small { display:block; margin-top:4px; color:#776b60; line-height:1.45; }
      .status { display:inline-block; margin-top:6px; padding:3px 8px; border-radius:999px; color:#2b5680; background:#e8f0fb; font-size:11px; font-weight:700; } .actions { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; } button.action { border:1px solid #e5d8c9; border-radius:9px; padding:8px 12px; background:#fff; color:#5b4c3e; font:inherit; cursor:pointer; } button.primary { border-color:#f97316; color:#fff; background:#f97316; } button:disabled { opacity:.5; cursor:default; } .message { margin-top:10px; color:#8b4f14; font-size:12px; line-height:1.45; }
    </style>
    <button class="launcher" type="button">读取投稿状态</button>
    <section class="panel" hidden role="dialog" aria-label="AILatest 投稿状态" aria-modal="false">
      <div class="head"><h3>读取投稿状态</h3><button class="close" type="button" aria-label="关闭">×</button></div>
      <div class="hint">${systemName() === 'elsevier' ? 'Elsevier / Author Hub' : systemName() === 'editorial_manager' ? 'Editorial Manager' : 'ScholarOne'}：只读取当前页面可见信息。请核对后再同步到科研档案。</div>
      <div class="records"></div><div class="message" hidden></div>
      <div class="actions"><button class="action scan" type="button">重新读取</button><button class="action primary sync" type="button" disabled>同步选中记录</button></div>
    </section>`;
  (document.body || document.documentElement).appendChild(root);
  const launcher = shadow.querySelector('.launcher');
  const panel = shadow.querySelector('.panel');
  const recordsEl = shadow.querySelector('.records');
  const messageEl = shadow.querySelector('.message');
  const scanButton = shadow.querySelector('.scan');
  const syncButton = shadow.querySelector('.sync');
  let records = [];

  function setMessage(text, isError) {
    messageEl.hidden = !text; messageEl.textContent = text; messageEl.style.color = isError ? '#9b3b25' : '#8b4f14';
  }
  function render() {
    if (!records.length) recordsEl.innerHTML = '<div class="empty">当前页面没有识别到包含稿件编号、题目或期刊的投稿状态。打开投稿列表或详情页后再读取。</div>';
    else recordsEl.innerHTML = records.map((record, index) => `
      <label class="record"><input type="checkbox" data-index="${index}" checked /><span><strong>${escapeHtml(record.title || record.journal || record.manuscript_id || '未命名投稿')}</strong><small>${escapeHtml([record.journal, record.manuscript_id].filter(Boolean).join(' · ') || '未提供期刊或稿件编号')}</small><span class="status">${escapeHtml(record.status_label || record.status_raw || '状态未识别')}</span></span></label>`).join('');
    updateSyncState();
  }
  function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
  function selected() { return [...recordsEl.querySelectorAll('input[data-index]:checked')].map((input) => records[Number(input.dataset.index)]).filter(Boolean); }
  function updateSyncState() { syncButton.disabled = !selected().length; }
  function scan() { records = extractCandidates(); setMessage('', false); render(); }
  async function sync() {
    const chosen = selected(); if (!chosen.length) return;
    const state = await storageGet(['ajUser', 'ajInstallId']);
    const token = state.ajUser && state.ajUser.token;
    if (!token) { setMessage('请先在 AILatest Journal 登录，再同步到科研档案。', true); window.open('https://journal.ailatest.org/signup?redirect=%2Fpublication-footprint%2F', '_blank', 'noopener'); return; }
    syncButton.disabled = true; syncButton.textContent = '同步中…';
    try {
      const response = await fetch(API, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(state.ajInstallId ? { 'X-AJ-Install': state.ajInstallId } : {}) }, body: JSON.stringify({ source: 'extension', system: systemName(), source_url: location.href, records: chosen }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `同步失败（${response.status}）`);
      await storageSet({ ajSubmissionSync: { records: data.records || chosen, syncedAt: Date.now() }, ajSubmissionSyncAt: Date.now() });
      setMessage(`已同步 ${Number(data.count || chosen.length)} 条投稿记录。打开“发表足迹”即可查看。`, false);
    } catch (error) { setMessage(error && error.message ? error.message : '同步失败，请稍后重试。', true); }
    syncButton.disabled = false; syncButton.textContent = '同步选中记录';
  }
  launcher.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) scan(); });
  shadow.querySelector('.close').addEventListener('click', () => { panel.hidden = true; });
  scanButton.addEventListener('click', scan);
  syncButton.addEventListener('click', sync);
  recordsEl.addEventListener('change', updateSyncState);
  setTimeout(scan, 900);
})();
