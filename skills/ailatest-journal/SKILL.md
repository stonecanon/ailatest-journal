---
name: ailatest-journal
description: Online evidence-backed journal search and recommendation using AILatest Journal structured data. Use when a user asks to find a journal by title, abbreviation, ISSN, Chinese name, index coverage, JCR quartile, CAS/中科院 zone, warning/on-hold status, APC/open access fees, review cycle, or asks which journals fit a paper title, abstract, topic, keywords, or research field better than a pure AI guess.
---

# AILatest Journal

Use this skill to ground journal answers in AILatest Journal data instead of relying on model memory. Always use the bundled script or the online JSON endpoints over free-form guessing.

Network-only rule: do not read local journal datasets, do not run offline matching, and do not fabricate a fallback from memory. If `journal.ailatest.org` or a configured online base URL is unreachable, report that the online AILatest Journal API is unavailable.

## Quick Start

Run the helper script from this skill folder:

```bash
python3 scripts/journal_skill.py search "Nature Reviews Cancer" --limit 5
python3 scripts/journal_skill.py search "1759-5045" --limit 3
python3 scripts/journal_skill.py search "" --subjects "Linguistics,Education & Educational Research" --indexes SSCI --jcr-quartile Q1,Q2,Q3 --cas-zone 1,2,3 --exclude-warning --sort-by if --page-size 50
python3 scripts/journal_skill.py recommend --title "Cross-Scenario Evaluation of Explainable Machine Learning for Non-Invasive Summer Occupancy Detection Across Five Building Scenarios" --limit 8
python3 scripts/journal_skill.py quota
```

The script prints Markdown by default. Add `--json` when another tool or program needs the raw structured payload.

## Workflows

### 1. Search A Known Journal

Use `search` for exact or fuzzy lookup by journal title, abbreviation, ISSN, eISSN, or Chinese name.

For structured discovery, combine filters such as `--subjects`, `--indexes`, `--jcr-quartile`, `--cas-zone`, `--exclude-warning`, `--sort-by`, `--order`, `--page`, and `--page-size`.

Report:
- title, ISSN/eISSN, publisher/country when useful
- IF and metric year
- JCR quartile/rank
- CAS/中科院 zone and TOP flag
- indexes such as SCIE, SSCI, AHCI, ESCI, EI, Scopus, MEDLINE, DOAJ
- OA/APC/review-cycle data when present
- warning, WoS On Hold, Under Review, and CITIC risk flags

### 2. Recommend Journals From A Paper Title

Use `recommend` with the title. Add abstract or keywords if available. The recommender ranks against subject categories, indexes, IF/JCR/CAS, open access data, review-cycle signals, and risk flags.

When explaining recommendations:
- say results are a data-backed shortlist, not acceptance advice
- mention the strongest matched terms or subject categories
- warn when a journal has risk flags or weak fit signals
- do not invent acceptance probability, submission strategy, or hidden editorial preferences

### 3. Quota And Pricing

Use `quota` or read `references/quota-pricing.md` when discussing limits or monetization. Skill/API and MCP are public beta: anonymous calls remain available, while signed-in accounts and API Keys are recognized by the service. Browser-extension quotas, device slots, and paid AI credits are enforced server-side; limits and response fields may change during beta.

## Public Endpoints

The script calls:

- `POST https://journal.ailatest.org/api/skill/search`
- `POST https://journal.ailatest.org/api/skill/recommend`
- `GET https://journal.ailatest.org/api/skill/quota`
- `POST https://journal.ailatest.org/api/mcp` (MCP Streamable HTTP; `initialize`, `tools/list`, `tools/call`)

Read `references/api.md` for request/response shapes if you need to integrate directly.

## Answer Style

Keep answers compact and auditable. Prefer tables or short ranked lists. Include the phrase "Data source: AILatest Journal" when giving recommendations to remind users this is structured-data-backed.
