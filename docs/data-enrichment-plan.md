# AILatest Journal Data Enrichment Plan

## Done in first pass

- Scopus Source List updated locally from Elsevier official `ext_list_May_2026.xlsx`.
  - Source: https://www.elsevier.com/products/scopus/content
  - Generated fields: `scopus.active`, `scopus.status`, `scopus.coverage`, `scopus.discontinued`, `scopus.added_to_list`, `scopus.asjc`, `scopus.asjc_top`.
  - Note: `list/` is git-ignored, so the raw Excel is local-only; generated JSON files carry the merged data.
- FMS 2025 fetched from the public FMS website.
  - Source: https://www.fms-journal.net/
  - Script: `scripts/fetch_fms.py`
  - Output: `data/fms_journals.json`
  - Verified counts: 1183 international journals and 94 Chinese journals.
- CAS Mega Journal label extracted from `ShowJCR_中科院分区_2025.csv`.
  - Generated field: `cas_mega: true`
  - Verified count: 76 journals.
- SCD 2026 parsed from a public university-hosted PDF.
  - Source: https://kyc.cdisu.edu.cn/media/118070/134182906842124784.pdf
  - Script: `scripts/build_scd_from_pdf.py`
  - Output: `data/scd_journals.json`
  - Verified count: 2385 records; 2313 with ISSN; 602 newly added.
- AMI 2022 old-journal rankings parsed from the CASS preview report PDF.
  - Source: https://journals.xmu.edu.cn/2022nianzhongguorenwenshehuikexueqikanpingjiajieguogongshiban-20230112.pdf
  - Script: `scripts/build_ami_from_pdf.py`
  - Output: `data/ami_journals.json`
  - Verified count: 1924 old journals; tier counts 顶级/权威/核心/扩展/入库 = 22/55/605/779/463.
- VHB Rating 2024 parsed from the 18 public area-rating PDFs.
  - Source: https://www.vhbonline.org/en/services/vhb-rating-2024/area-ratings
  - Script: `scripts/fetch_vhb.py`
  - Output: `data/vhb_journals.json`
  - Verified count: 2262 area ratings; 1045 unique ISSNs.
- CNRS Section 37 2020 parsed from the public GATE/CNRS PDF.
  - Source: https://www.gate.cnrs.fr/wp-content/uploads/2021/12/categorisation37_liste_juin_2020-2.pdf
  - Script: `scripts/build_cnrs_from_pdf.py`
  - Output: `data/cnrs_journals.json`
  - Verified count: 840 records; 839 unique ISSNs.
  - Display note: historical reference, not a current ranking.
- Annual publication volume from OpenAlex `counts_by_year`.
  - Script changes: `scripts/fetch_openalex.py`, `scripts/merge_openalex.py`
  - Output: `data/annual_outputs.json.gz`
  - Current generated coverage: 41604 ISSN keys. The fetch script can continue incrementally for the remaining missing `counts_by_year` cache rows.
- Retraction Watch journal aggregates and rates.
  - Source: https://gitlab.com/crossref/retraction-watch-data
  - Scripts: `scripts/fetch_retraction_watch.py`, `scripts/build_retraction_metrics.py`
  - Outputs: `data/retraction_watch_journals.json`, `data/retraction_metrics.json.gz`
  - Current matched metrics: 5320 local journals.
  - Website main data now embeds compact caution fields for 5228 journals in `journals.json.gz`.

## Next public data sources

- CiteScore
  - Source: Elsevier/Scopus CiteScore metrics export.
  - Fields: `citescore.year`, `citescore.value`, `citescore.percentile`, `citescore.quartile`.
  - Status: needs full metrics table; do not infer from Scopus Source List.
- SJR
  - Source: SCImago public data.
  - Fields: `sjr.year`, `sjr.value`, `sjr.quartile`, `sjr.h_index`.
- VHB 2024
  - Status: done from public area PDFs.
- CNRS
  - Status: done as historical 2020 reference.

## Bibliometric risk and volume metrics

- Annual publication volume
  - Preferred source: OpenAlex source `counts_by_year` plus on-demand `/works` count checks for recent years.
  - Fields: `annual_outputs: [{year, works_count, source}]`.
  - Do not use only cumulative publication counts.
  - Status: implemented as `data/annual_outputs.json.gz`; continue `python scripts/fetch_openalex.py` to improve coverage.
- Retraction rate
  - Preferred source: Crossref Retraction Watch data.
  - Fields: `retractions_by_year`, `retraction_rate_5y`, `retraction_rate_10y`.
  - Rate denominator should use annual publication volume by journal and year.
  - Display as a caution metric, not a ranking badge, because coverage differs by publisher and DOI quality.
  - Status: implemented as `data/retraction_metrics.json.gz`; matching is title-based because the Retraction Watch CSV does not include ISSNs.

## UI badge themes

- Current website badge taxonomy is split into four semantic groups: indexed coverage, ranking/level, access & fees, and caution/risk.
- Badge colors should use semantic tokens instead of hard-coded colors.
- Free/default theme: current restrained palette.
- Pro themes:
  - classic
  - muted
  - high-contrast
  - colorblind-friendly
- Themes should be shared by website and extension so one data source renders consistently.

## Explicitly out of scope

- Ordinary university internal journal lists.
- RCCSE / 武大核心.
- Third-party-only packages without official, association, publisher, or university-hosted verification.
