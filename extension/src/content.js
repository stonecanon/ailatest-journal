(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};
  const adapter = ns.getAdapter && ns.getAdapter(location.hostname);
  const processed = new WeakSet();
  let scanTimer = 0;
  let running = false;
  let pending = false;

  if (!adapter) return;

  if (adapter.ensureTools) adapter.ensureTools();
  if (adapter.updateStatus) adapter.updateStatus({ phase: 'loaded' });

  function mark(anchorEl) {
    if (anchorEl) processed.add(anchorEl);
  }

  function isMarked(anchorEl) {
    return !anchorEl || processed.has(anchorEl);
  }

  function buildItem(entry) {
    return {
      issn: entry.issn || '',
      name: entry.journalName || ''
    };
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
      const seenAnchors = new Set();
      const entries = (adapter.findEntries() || [])
        .filter((entry) => entry && entry.anchorEl && (entry.issn || entry.journalName))
        .filter((entry) => {
          if (isMarked(entry.anchorEl) || seenAnchors.has(entry.anchorEl)) return false;
          seenAnchors.add(entry.anchorEl);
          return true;
        });

      const groups = new Map();
      entries.forEach((entry) => {
        const item = buildItem(entry);
        const key = ns.lookup.queryKey(item);
        if (!key) return;
        if (!groups.has(key)) groups.set(key, { item, entries: [] });
        groups.get(key).entries.push(entry);
      });

      const unique = Array.from(groups.values());
      if (!unique.length) {
        if (adapter.updateStatus) adapter.updateStatus({ phase: 'empty' });
        return;
      }
      if (adapter.updateStatus) adapter.updateStatus({
        phase: 'lookup',
        total: unique.length,
        names: unique.map((group) => group.item.name || group.item.issn).filter(Boolean).slice(0, 5)
      });

      const results = await ns.lookup.batchLookup(unique.map((group) => group.item));
      let hitCount = 0;
      unique.forEach((group, index) => {
        const journal = results[index];
        if (journal) hitCount += 1;
        group.entries.forEach((entry) => {
          if (adapter.afterLookup) adapter.afterLookup(entry, journal || null);
          if (adapter.insertOpenAccessButton) adapter.insertOpenAccessButton(entry, journal || null);
          if (!journal) {
            return;
          }
          mark(entry.anchorEl);
          const badgeNode = ns.badges.renderBadges(journal, settings);
          adapter.insert(entry.anchorEl, badgeNode, entry);
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

  const observer = new MutationObserver(() => scheduleScan(700));
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
})(globalThis);
