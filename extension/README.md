# AILatest Journal Badges Extension

MV3 browser extension for showing AILatest journal badges on academic pages.

## Load Locally

1. Open Chrome or Edge extension management.
2. Enable developer mode.
3. Click "Load unpacked".
4. Select this `extension/` folder.

## Current Site Adapters

- CNKI: `*.cnki.net`
- Google Scholar: `scholar.google.com` and several common Google Scholar domains

The content script scans journal names or ISSNs, batches lookups through:

```text
https://journal.ailatest.org/api/ext/lookup
```

Results are cached in `chrome.storage.local` for 7 days. Badge display settings are stored in `chrome.storage.sync`.

## Add A Site Adapter

1. Add `src/adapters/<site>.js`.
2. Push an adapter into `AILatestExt.adapters`:

```js
AILatestExt.adapters.push({
  id: 'site-id',
  match: (host) => /example\.com$/.test(host),
  findEntries: () => [{ anchorEl, issn, journalName }],
  insert: (anchorEl, badgeNode) => anchorEl.insertAdjacentElement('afterend', badgeNode)
});
```

3. Add the adapter file and site match pattern to `manifest.json`.

Prefer ISSN when the page exposes it. Fall back to a clean journal name only when the source text is clearly a journal title.
