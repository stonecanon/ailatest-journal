# AILatest Journal Skill API

Base URL: `https://journal.ailatest.org`

## Public beta and authentication

Skill/API and MCP are currently public beta. Anonymous search and recommendation
remain available. Signed-in calls may use the normal JWT; account/API-key calls
may send one of:

```text
X-API-Key: aj_live_...
Authorization: ApiKey aj_live_...
Authorization: Bearer aj_live_...
```

Create and revoke keys from the signed-in account page (`/api-keys`). Do not
publish a secret key in client-side code. Every response includes a
`quota_policy` object describing the current beta policy.

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

`quota_policy.status` is `public_beta`; `access` is `public`, `account`, or
`api_key` depending on the request.

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

## MCP

Use the same service from an MCP client:

```text
https://journal.ailatest.org/api/mcp
```

The Streamable HTTP endpoint exposes `search_journals`, `recommend_journals`,
and `quota`. It accepts the API-key headers above, but remains callable without
one during the public beta.
