# AILatest Journal Skill API

Base URL: `https://journal.ailatest.org`

## Search

`POST /api/skill/search`

Request:

```json
{
  "query": "Nature Reviews Cancer",
  "page": 1,
  "page_size": 5
}
```

Structured filters can be combined with a text query, or used alone:

```json
{
  "subjects": ["Linguistics", "Education & Educational Research"],
  "indexes": ["SSCI"],
  "jcr_quartile": ["Q1", "Q2", "Q3"],
  "cas_zone": [1, 2, 3],
  "exclude_warning": true,
  "sort_by": "if",
  "order": "desc",
  "page": 1,
  "page_size": 50
}
```

Also accepts `q` instead of `query`.

Response fields:

- `ok`: boolean
- `mode`: `search`
- `query`: normalized user query
- `filters`: normalized structured filters applied by the API
- `total`: total matches
- `page`, `page_size`, `total_pages`: pagination metadata
- `items`: journal records in the skill schema
- `quota_policy`: recommended free quota policy

## Recommend

`POST /api/skill/recommend`

Request:

```json
{
  "title": "Cross-Scenario Evaluation of Explainable Machine Learning for Non-Invasive Summer Occupancy Detection Across Five Building Scenarios",
  "abstract": "",
  "keywords": ["building occupancy", "indoor environment"],
  "limit": 10
}
```

Response fields:

- `ok`: boolean
- `mode`: `recommend`
- `query`: source text used for matching
- `terms`: terms extracted for server-side structured-data matching
- `total`: total scored journal candidates
- `items`: ranked journal records in the skill schema
- `notes`: caveats for display
- `quota_policy`: recommended free quota policy

## Journal Record Schema

Each `items[]` record includes:

- `title`, `cn_name`, `issn`, `eissn`, `publisher`, `country`, `url`
- `metrics.if`, `metrics.if_year`, `metrics.if_rank`, `metrics.five_year_if`, `metrics.jci`
- `jcr.quartile`, `jcr.category`, `jcr.year`, `jcr.release_year`
- `cas.zone`, `cas.top`, `cas.major`, `cas.major_zone`, `cas.subcategories`, `cas.emerging`
- `indexes`: SCIE/SSCI/AHCI/ESCI/EI/Scopus/MEDLINE/DOAJ style tags
- `subjects.wos`, `subjects.esi`, `subjects.ei`, `subjects.cnkx`
- `access.free`, `access.doaj`, `access.official_url`, `access.apc`, `access.apc_fee`, `access.apc_usd`, `access.license`
- `review.months`, `review.source`
- `risk.warning`, `risk.citic_warning`, `risk.on_hold`, `risk.under_review`
- `match.score`, `match.matched_terms`, `match.basis` for recommendation results

## Direct GET Support

For simple integrations, both skill endpoints also accept query strings:

```text
/api/skill/search?q=1759-5045&limit=3
/api/skill/recommend?title=urban%20heat%20island%20remote%20sensing&limit=8
```
