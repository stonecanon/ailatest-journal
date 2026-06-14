(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  const adapter = ns.getAdapter && ns.getAdapter(location.hostname);
  const processed = new WeakMap();
  let scanTimer = 0;
  let running = false;
  let pending = false;

  if (!adapter) return;

  if (adapter.ensureTools) adapter.ensureTools();
  if (adapter.updateStatus) adapter.updateStatus({ phase: 'loaded' });

  function mark(anchorEl, key) {
    if (anchorEl && key) processed.set(anchorEl, key);
  }

  function isMarked(anchorEl, key) {
    return !anchorEl || (key && processed.get(anchorEl) === key);
  }

  function buildItem(entry) {
    return {
      issn: entry.issn || '',
      name: entry.journalName || ''
    };
  }

  async function retryMissesWithResolvedNames(unique, results) {
    if (!adapter.resolveJournalName) return results;
    const retryItems = [];
    const retryPositions = [];
    for (let i = 0; i < unique.length; i += 1) {
      if (results[i]) continue;
      const entry = unique[i].entries && unique[i].entries[0];
      if (!entry) continue;
      let resolved = null;
      try {
        resolved = await adapter.resolveJournalName(entry);
      } catch (_) {
        resolved = null;
      }
      const item = {
        issn: resolved && resolved.issn || '',
        name: resolved && resolved.name || ''
      };
      const key = ns.lookup.queryKey(item);
      if (!key || key === (unique[i].item && ns.lookup.queryKey(unique[i].item))) continue;
      retryItems.push(item);
      retryPositions.push(i);
      unique[i].item = item;
    }
    if (!retryItems.length) return results;
    const retryResults = await ns.lookup.batchLookup(retryItems);
    retryPositions.forEach((pos, index) => {
      if (retryResults[index]) results[pos] = retryResults[index];
    });
    return results;
  }

  async function scan() {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    pending = false;

    try {
      const settings = await ns.lookup.getSettings();
      if (ns.setLang) ns.setLang(settings.lang || 'auto');
      const seenAnchors = new Set();
      const rawEntries = (adapter.findEntries() || [])
        .filter((entry) => entry && entry.anchorEl && (entry.issn || entry.journalName));
      const entries = rawEntries
        .filter((entry) => {
          const item = buildItem(entry);
          const key = ns.lookup.queryKey(item);
          if (!key) return false;
          entry.lookupKey = key;
          if (isMarked(entry.anchorEl, key) || seenAnchors.has(entry.anchorEl)) return false;
          seenAnchors.add(entry.anchorEl);
          return true;
        });

      const groups = new Map();
      entries.forEach((entry) => {
        const item = buildItem(entry);
        const key = entry.lookupKey || ns.lookup.queryKey(item);
        if (!key) return;
        if (!groups.has(key)) groups.set(key, { item, entries: [] });
        groups.get(key).entries.push(entry);
      });

      const unique = Array.from(groups.values());
      if (!unique.length) {
        if (adapter.updateStatus && !rawEntries.length) adapter.updateStatus({ phase: 'empty' });
        return;
      }
      if (adapter.updateStatus) adapter.updateStatus({
        phase: 'lookup',
        total: unique.length,
        names: unique.map((group) => group.item.name || group.item.issn).filter(Boolean).slice(0, 5)
      });

      let results = await ns.lookup.batchLookup(unique.map((group) => group.item));
      results = await retryMissesWithResolvedNames(unique, results);
      let hitCount = 0;
      unique.forEach((group, index) => {
        const journal = results[index];
        if (journal) hitCount += 1;
        group.entries.forEach((entry) => {
          if (adapter.afterLookup) adapter.afterLookup(entry, journal || null);
          if (!journal) {
            if (adapter.insertOpenAccessButton) adapter.insertOpenAccessButton(entry, journal || null);
            mark(entry.anchorEl, group.item && ns.lookup.queryKey(group.item));
            return;
          }
          mark(entry.anchorEl, group.item && ns.lookup.queryKey(group.item));
          const badgeNode = ns.badges.renderBadges(journal, {
            ...settings
          });
          adapter.insert(entry.anchorEl, badgeNode, entry);
          if (adapter.insertOpenAccessButton) adapter.insertOpenAccessButton(entry, journal || null);
        });
      });
      if (adapter.ensureTools) adapter.ensureTools();
      if (adapter.updateStatus) adapter.updateStatus({
        phase: 'done',
        total: unique.length,
        hits: hitCount,
        names: unique.map((group) => group.item.name || group.item.issn).filter(Boolean).slice(0, 5)
      });
    } catch (e) {
      if (adapter.updateStatus) adapter.updateStatus({ phase: 'error', message: e && e.message ? e.message : String(e) });
      console.debug('[AILatest] badge scan skipped:', e && e.message ? e.message : e);
    } finally {
      running = false;
      if (pending) scheduleScan(300);
    }
  }

  function scheduleScan(delay) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, delay == null ? 600 : delay);
  }

  scheduleScan(50);
  [800, 1800, 3500, 7000].forEach((delay) => setTimeout(() => scheduleScan(0), delay));

  function isOwnNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.dataset && node.dataset.ailatestUi === '1') return true;
    if (node.closest && node.closest('[data-ailatest-ui="1"], .ailatest-badge-block, .ailatest-oa-btn')) return true;
    return false;
  }

  const observer = new MutationObserver((mutations) => {
    const onlyOwnChanges = mutations.every((m) => {
      if (isOwnNode(m.target)) return true;
      const added = Array.from(m.addedNodes || []);
      const removed = Array.from(m.removedNodes || []);
      return (added.length || removed.length) && [...added, ...removed].every(isOwnNode);
    });
    if (!onlyOwnChanges) scheduleScan(700);
  });
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
})(globalThis);