# AILatest Journal Badges Extension (v0.2.23)

MV3 browser extension for showing AILatest journal badges on academic pages.

## Load Locally

1. Open Chrome or Edge extension management.
2. Enable developer mode.
3. Click "Load unpacked".
4. Select this `extension/` folder.

## Current Site Adapters

- CNKI: `*.cnki.net`
- Google Scholar: `scholar.google.com` and several common Google Scholar domains
- PubMed: `pubmed.ncbi.nlm.nih.gov`
- Taylor & Francis: `*.tandfonline.com`
- Article metadata pages: Springer, IEEE Xplore, ScienceDirect, MDPI, Wiley, Web of Science, Scopus, Europe PMC, Semantic Scholar, arXiv, and other listed hosts in `manifest.json`

The extension only injects on the hosts listed in `manifest.json`. It does not attempt to alter arbitrary publisher homepages, so an unsupported page will remain unchanged instead of receiving a misleading badge.

The content script scans journal names or ISSNs, batches lookups through:

```text
https://journal.ailatest.org/api/ext/lookup
```

Results are cached in `chrome.storage.local` for 7 days. Badge display settings are stored in `chrome.storage.sync`.
Article pages expose one lightweight citation action: **Copy reference**. It copies a plain-text APA-style reference (GB/T 7714 fallback) and does not create PDF/Markdown downloads.

## Submission status capture

On visible Elsevier / Author Hub, Editorial Manager and ScholarOne pages, the
extension adds **读取投稿状态**. It extracts only the visible manuscript title,
journal, manuscript number and status. Review the candidates and click
**同步选中记录** to save them to the signed-in account's `/submissions/import`
archive, which is also shown on the AILatest Journal publication-footprint page.

After the first confirmation, selected records enter an automatic watch list.
While the browser is running, the extension service worker checks saved status
pages about every 15 minutes and sends a browser notification and account email
when the normalized status changes. If a publisher requires client-side
rendering or blocks background reads, opening the same signed-in page lets the
content script refresh the visible status; the confirmation-email import remains
the fallback.

The extension never reads or uploads publisher passwords, cookies or session
tokens. If a publisher page is not supported or an account cannot be read,
paste the confirmation email or upload an `.eml` file in the publication
footprint page instead. Official publisher APIs remain opt-in connectors and
are not faked by the extension.

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
