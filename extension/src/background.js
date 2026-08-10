// AILatest Journal — automatic submission watcher.
// The first page read is user-confirmed in submissions.js. Afterwards this
// service worker periodically revisits the saved status URL while the browser
// is running, using the publisher session already available to the extension.
// It never asks for or stores publisher passwords.
(function () {
  'use strict';
  const API = 'https://api.ailatest.org/submissions/import';
  const ALARM = 'ailatest-submission-watch';
  const RULES = [
    ['withdrawn', /withdrawn|withdraw|撤稿|终止|cancelled|canceled/i, '撤稿/终止'],
    ['rejected', /rejected|reject|declined|拒稿|拒绝|not suitable/i, '已拒稿'],
    ['accepted', /accepted|accept|接收|已接收|in production|待出版/i, '已接收'],
    ['revision', /revision required|revise|revision|返修|修改|major revision|minor revision/i, '返修'],
    ['under_review', /under review|under consideration|with reviewer|peer review|审稿|外审/i, '外审中'],
    ['editorial_check', /with editor|editorial check|technical check|初审|编辑/i, '编辑初审'],
    ['submitted', /submitted|manuscript submitted|complete submission|已提交|已完成提交/i, '已提交'],
    ['draft', /draft|incomplete|未提交|准备投稿/i, '准备投稿'],
  ];
  function get(keys) { return new Promise((resolve) => chrome.storage.local.get(keys, (value) => resolve(value || {}))); }
  function set(value) { return new Promise((resolve) => chrome.storage.local.set(value, resolve)); }
  function clean(value, max = 500) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
  function statusFor(text) {
    const value = clean(text, 2000);
    for (const [normalized, rule, label] of RULES) {
      const match = value.match(rule);
      if (match) return { normalized, raw: clean(match[0], 120), label };
    }
    return null;
  }
  function field(text, labels, max = 500) {
    const pattern = new RegExp(`(?:${labels.join('|')})\\s*[:：-]\\s*([^\\n|]+)`, 'i');
    const match = String(text || '').match(pattern);
    return match ? clean(match[1], max) : '';
  }
  function htmlText(html) {
    return String(html || '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ');
  }
  function parsePage(html, watch) {
    const fullText = htmlText(html);
    const anchor = clean(watch.manuscript_id || watch.title, 500);
    const anchorIndex = anchor ? fullText.toLowerCase().indexOf(anchor.toLowerCase()) : -1;
    const text = anchorIndex >= 0 ? fullText.slice(Math.max(0, anchorIndex - 900), Math.min(fullText.length, anchorIndex + 1800)) : fullText;
    const status = statusFor(text);
    if (!status) return null;
    const title = field(text, ['manuscript title', 'paper title', 'article title', 'title', '稿件题目']) || clean(watch.title, 500);
    const journal = field(text, ['journal(?: name)?', 'publication', '期刊']) || clean(watch.journal, 240);
    const manuscript = field(text, ['manuscript(?: no| id| number)?', 'submission(?: no| id| number)?', '稿件(?:编号|号)']) || clean(watch.manuscript_id, 120);
    if (!title && !journal && !manuscript) return null;
    return { source: 'extension_watch', system: watch.system || 'unknown', journal, title, manuscript_id: manuscript, status_raw: status.raw, status_normalized: status.normalized, source_url: watch.source_url, evidence_text: clean(text, 2000), watch_enabled: true, notify_enabled: true, last_checked_at: Date.now(), status_at: Date.now(), status_label: status.label };
  }
  function authHeaders(state) {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (state.ajUser && state.ajUser.token) headers.Authorization = `Bearer ${state.ajUser.token}`;
    if (state.ajInstallId) headers['X-AJ-Install'] = state.ajInstallId;
    return headers;
  }
  function changed(watch, candidate) {
    const before = String(watch.last_status_normalized || '');
    return before && before !== String(candidate.status_normalized || '');
  }
  function notify(candidate) {
    if (!chrome.notifications || !chrome.notifications.create) return;
    const name = candidate.journal || candidate.title || candidate.manuscript_id || '投稿记录';
    chrome.notifications.create(`ailatest-submission-${Date.now()}`, { type: 'basic', iconUrl: chrome.runtime.getURL('assets/icon-128.png'), title: 'AILatest 投稿状态更新', message: `${name}：${candidate.status_label || candidate.status_raw || '状态已变化'}` });
  }
  async function pollOne(watch, state) {
    if (!watch || watch.watch_enabled === false || !watch.source_url || !state.ajUser?.token) return { watch };
    try {
      const response = await fetch(watch.source_url, { credentials: 'include', cache: 'no-store', redirect: 'follow', headers: { Accept: 'text/html,application/xhtml+xml' } });
      if (!response.ok) throw new Error(`投稿页 ${response.status}`);
      const candidate = parsePage((await response.text()).slice(0, 3_000_000), watch);
      if (!candidate) return { watch: { ...watch, last_checked_at: Date.now(), last_error: '页面未返回可识别状态' } };
      if (changed(watch, candidate)) {
        const res = await fetch(API, { method: 'POST', headers: authHeaders(state), body: JSON.stringify({ source: 'extension_watch', system: candidate.system, source_url: candidate.source_url, records: [candidate] }) });
        if (!res.ok) throw new Error(`同步失败 ${res.status}`);
        notify(candidate);
      }
      return { watch: { ...watch, ...candidate, last_status_normalized: candidate.status_normalized, last_checked_at: Date.now(), last_error: '' } };
    } catch (error) {
      return { watch: { ...watch, last_checked_at: Date.now(), last_error: clean(error && error.message, 240) } };
    }
  }
  async function poll() {
    const state = await get(['ajUser', 'ajInstallId', 'ajSubmissionWatches']);
    const watches = Array.isArray(state.ajSubmissionWatches) ? state.ajSubmissionWatches.slice(0, 30) : [];
    if (!watches.length || !state.ajUser?.token) return;
    const results = [];
    for (const watch of watches) results.push((await pollOne(watch, state)).watch);
    await set({ ajSubmissionWatches: results });
  }
  function ensureAlarm() {
    if (!chrome.alarms) return;
    chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: 15 });
  }
  if (chrome.runtime && chrome.runtime.onInstalled) chrome.runtime.onInstalled.addListener(ensureAlarm);
  if (chrome.runtime && chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(ensureAlarm);
  if (chrome.alarms && chrome.alarms.onAlarm) chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM) poll(); });
  ensureAlarm();
  poll();
})();
