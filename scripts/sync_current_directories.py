#!/usr/bin/env python3
"""Incrementally sync DOAJ, OAJ and current MEDLINE membership.

Unlike the historical full builder, this updater starts from the enriched
production bundle. It therefore preserves rankings and one-off enrichments
whose original source files are not available in every checkout.
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LIST = ROOT / "list"
FULL_GZ = DATA / "journals.json.gz"
FULL_JSON = DATA / "journals.json"
LIGHT_FILES = (DATA / "journals_light.json.gz", DATA / "journals_light_v2.json.gz")


def read_json(path: Path):
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            return json.load(handle)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    temp = path.with_name(path.name + ".sync.tmp")
    if path.suffix == ".gz":
        buffer = io.BytesIO()
        with gzip.GzipFile(fileobj=buffer, mode="wb", compresslevel=9, mtime=0) as handle:
            handle.write(raw)
        temp.write_bytes(buffer.getvalue())
    else:
        temp.write_bytes(raw)
    os.replace(temp, path)


def clean_issn(value: object) -> str:
    match = re.search(r"\b(\d{4})-?(\d{3}[\dX])\b", str(value or "").upper())
    return f"{match.group(1)}-{match.group(2)}" if match else ""


def norm_title(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def make_slug(value: object, issn: object, used: set[str]) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60].rstrip("-")
    base = base or re.sub(r"[^0-9X]", "", str(issn or "").upper()) or "journal"
    candidate = base
    compact = re.sub(r"[^0-9X]", "", str(issn or "").upper())
    if candidate in used and compact:
        candidate = f"{base[:48].rstrip('-')}-{compact}"
    serial = 2
    root = candidate
    while candidate in used:
        candidate = f"{root}-{serial}"
        serial += 1
    used.add(candidate)
    return candidate


def build_lookups(records: list[dict]):
    by_issn: dict[str, dict] = {}
    by_title: dict[str, dict] = {}
    for rec in records:
        for value in (rec.get("issn"), rec.get("eissn")):
            key = clean_issn(value)
            if key:
                by_issn.setdefault(key, rec)
        for value in (rec.get("name"), rec.get("cn_name"), rec.get("en_name")):
            key = norm_title(value)
            if key:
                by_title.setdefault(key, rec)
    return by_issn, by_title


def register_record(rec: dict, by_issn: dict[str, dict], by_title: dict[str, dict]) -> None:
    for value in (rec.get("issn"), rec.get("eissn")):
        key = clean_issn(value)
        if key:
            by_issn.setdefault(key, rec)
    for value in (rec.get("name"), rec.get("cn_name"), rec.get("en_name")):
        key = norm_title(value)
        if key:
            by_title.setdefault(key, rec)


def find_record(item: dict, by_issn: dict[str, dict], by_title: dict[str, dict]):
    for key in (clean_issn(item.get("issn")), clean_issn(item.get("eissn"))):
        if key and key in by_issn:
            return by_issn[key]
    return by_title.get(norm_title(item.get("title")))


def add_record(item: dict, kind: str, records: list[dict], used: set[str]):
    issn = clean_issn(item.get("issn"))
    eissn = clean_issn(item.get("eissn"))
    rec = {
        "name": str(item.get("title") or "").strip(),
        "issn": issn,
        "eissn": eissn,
        "publisher": str(item.get("publisher") or "").strip(),
        "country": str(item.get("country") or "").strip(),
        "abbr20": "",
        "indices": [],
        "wos_categories": [],
        "esi_category": "",
        f"{kind}_only": True,
    }
    rec["slug"] = make_slug(rec["name"], issn or eissn, used)
    records.append(rec)
    return rec


def has_independent_coverage(rec: dict) -> bool:
    if rec.get("indices") or rec.get("scopus"):
        return True
    return any(rec.get(key) for key in (
        "abdc", "abs", "fms", "vhb", "cnrs", "scd", "cscd", "cstpcd", "cnkx", "ami",
        "cas_zone", "cas_xr", "if_2024", "if_2025", "ei_historical", "wos_historical",
    ))


def sync_oaj(records: list[dict], used: set[str]):
    source = read_json(LIST / "oaj_journals.json")
    by_issn, by_title = build_lookups(records)
    matched = added = 0
    for item in source:
        rec = find_record(item, by_issn, by_title)
        if rec is None:
            rec = add_record(item, "oaj", records, used)
            register_record(rec, by_issn, by_title)
            added += 1
        else:
            matched += 1
            was_directory_only = rec.pop("_old_directory_only", False)
            if was_directory_only and not has_independent_coverage(rec):
                rec["oaj_only"] = True
        rec["oaj"] = {
            "partition": item.get("partition") or "",
            "position": item.get("positioning") or "",
            "oa_type": item.get("oa_type") or "",
        }
    updated = max((str(row.get("fetched_at") or "")[:10] for row in source), default="")
    return {"source_rows": len(source), "matched": matched, "added": added, "updated": updated}


def sync_doaj(records: list[dict], used: set[str]):
    by_issn, by_title = build_lookups(records)
    matched = added = source_rows = 0
    with (LIST / "doaj_journals.csv").open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            title = str(row.get("Journal title") or "").strip()
            if not title:
                continue
            source_rows += 1
            item = {
                "title": title,
                "issn": row.get("Journal ISSN (print version)"),
                "eissn": row.get("Journal EISSN (online version)"),
                "publisher": row.get("Publisher"),
                "country": row.get("Country of publisher"),
            }
            rec = find_record(item, by_issn, by_title)
            if rec is None:
                rec = add_record(item, "doaj", records, used)
                register_record(rec, by_issn, by_title)
                added += 1
            else:
                matched += 1
                was_directory_only = rec.pop("_old_directory_only", False)
                if was_directory_only and not has_independent_coverage(rec):
                    rec["doaj_only"] = True
            rec["doaj"] = {
                "u": str(row.get("Journal URL") or "").strip(),
                "du": str(row.get("URL in DOAJ") or "").strip(),
                "lic": str(row.get("Journal license") or "").strip(),
                "apc": str(row.get("APC") or "").strip(),
                "fee": str(row.get("APC amount") or "").strip(),
                "review": str(row.get("Review process") or "").strip(),
                "review_weeks": str(row.get("Average number of weeks between article submission and publication") or "").strip(),
                "frequency": next((str(row.get(key) or "").strip() for key in (
                    "Journal publication frequency", "Publication frequency", "Frequency"
                ) if str(row.get(key) or "").strip()), ""),
            }
            if not rec.get("publisher") and item.get("publisher"):
                rec["publisher"] = str(item["publisher"]).strip()
            if not rec.get("country") and item.get("country"):
                rec["country"] = str(item["country"]).strip()
    return {"source_rows": source_rows, "matched": matched, "added": added}


def load_issn_set(path: Path) -> set[str]:
    return {clean_issn(value) for value in read_json(path) if clean_issn(value)}


def sync_medline(records: list[dict]):
    medline = load_issn_set(LIST / "pubmed_issns.json")
    pubmed_only_path = LIST / "pubmed_only_issns.json"
    # This legacy source is intentionally ignored by git in some checkouts.
    # If it is unavailable, preserve the existing PubMed flags instead of
    # accidentally deleting all PubMed-only memberships.
    pubmed_only = load_issn_set(pubmed_only_path) if pubmed_only_path.exists() else None
    medline_count = pubmed_count = 0
    for rec in records:
        keys = {clean_issn(rec.get("issn")), clean_issn(rec.get("eissn"))} - {""}
        is_medline = bool(keys & medline)
        is_pubmed = is_medline or (bool(keys & pubmed_only) if pubmed_only is not None else bool(rec.get("pubmed")))
        if is_medline:
            rec["medline"] = True
            medline_count += 1
        else:
            rec.pop("medline", None)
        if is_pubmed:
            rec["pubmed"] = True
            pubmed_count += 1
        else:
            rec.pop("pubmed", None)
    return {"source_issns": len(medline), "matched": medline_count, "pubmed": pubmed_count}


def sync_free_flags(records: list[dict]) -> int:
    path = DATA / "oa.json.gz"
    if not path.exists():
        return sum(bool(rec.get("free")) for rec in records)
    oa = read_json(path)
    author_free = {"diamond", "hybrid", "subscription_paid_read"}
    count = 0
    for rec in records:
        rec.pop("free", None)
        keys = (clean_issn(rec.get("issn")), clean_issn(rec.get("eissn")))
        if any(key and str(oa.get(key, {}).get("l") or "").lower() in author_free for key in keys):
            rec["free"] = True
            count += 1
    return count


def compact_dict(value, keys: tuple[str, ...]):
    if not isinstance(value, dict):
        return value
    return {key: value[key] for key in keys if value.get(key) not in (None, "", [], {})}


def compact_new_record(rec: dict) -> dict:
    keys = (
        "name", "cn_name", "en_name", "abbr20", "slug", "issn", "eissn", "publisher", "country",
        "indices", "wos_categories", "esi_category", "if_2024", "if_2025", "if_latest", "if_latest_year",
        "if_quartile", "jif_without_self_cites_2025", "self_citation_rate_2025",
        "jcr_year", "jcr_release_year", "cas_zone", "cas_top", "cas_major_cn", "flagship",
        "nature_index", "free", "pubmed", "pmc", "medline", "under_review", "on_hold", "citic_warning",
        "ccf", "ft50", "utd24", "routeAliases",
    )
    out = {key: rec[key] for key in keys if rec.get(key) not in (None, "", [], {})}
    if rec.get("doaj"):
        out["doaj"] = compact_dict(rec["doaj"], ("lic", "review_weeks", "frequency")) or True
    if rec.get("oaj"):
        out["oaj"] = compact_dict(rec["oaj"], ("partition", "position")) or True
    return out


def sync_light(records: list[dict]) -> int:
    baseline = read_json(DATA / "journals_light.json.gz")
    by_slug = {str(row.get("slug") or ""): row for row in baseline}
    light = []
    for rec in records:
        slug = str(rec.get("slug") or "")
        row = dict(by_slug.get(slug) or compact_new_record(rec))
        for key in ("medline", "pubmed", "free"):
            if rec.get(key):
                row[key] = True
            else:
                row.pop(key, None)
        if rec.get("doaj"):
            row["doaj"] = compact_dict(rec["doaj"], ("lic", "review_weeks", "frequency")) or True
        else:
            row.pop("doaj", None)
        if rec.get("oaj"):
            row["oaj"] = compact_dict(rec["oaj"], ("partition", "position")) or True
        else:
            row.pop("oaj", None)
        light.append(row)
    for path in LIGHT_FILES:
        write_json(path, light)
    return len(light)


def main() -> int:
    records = read_json(FULL_GZ)
    before = len(records)
    # Current directory membership replaces the old snapshot. Standalone rows
    # from those snapshots are rebuilt, while every enriched shared record stays.
    for rec in records:
        if rec.get("doaj_only") or rec.get("oaj_only"):
            rec["_old_directory_only"] = True
        for key in ("doaj", "oaj", "doaj_only", "oaj_only"):
            rec.pop(key, None)
    used = {str(rec.get("slug") or "") for rec in records if rec.get("slug")}
    oaj_stats = sync_oaj(records, used)
    doaj_stats = sync_doaj(records, used)
    records = [rec for rec in records if not rec.get("_old_directory_only") or has_independent_coverage(rec)]
    for rec in records:
        rec.pop("_old_directory_only", None)
    medline_stats = sync_medline(records)
    free_count = sync_free_flags(records)
    records.sort(key=lambda rec: str(rec.get("name") or "").casefold())

    write_json(FULL_JSON, records)
    write_json(FULL_GZ, records)
    light_count = sync_light(records)

    meta_path = DATA / "meta.json"
    meta = read_json(meta_path)
    doaj_meta = read_json(LIST / "doaj_meta.json") if (LIST / "doaj_meta.json").exists() else {}
    medline_meta = read_json(LIST / "medline_meta.json") if (LIST / "medline_meta.json").exists() else {}
    doaj_source_date = doaj_meta.get("source_updated") or "current"
    meta.update({
        "source": f"WoS Core 2026-06-15 + JCR 2025 + ESI + 中科院 2025 + Scopus 2026-05 + EI Compendex 2026-07-09 + DOAJ {doaj_source_date} + OAJ current + NCBI MEDLINE current + regional and specialty indexes",
        "total": len(records),
        "with_oaj": sum(bool(rec.get("oaj")) for rec in records),
        "with_doaj": sum(bool(rec.get("doaj")) for rec in records),
        "with_medline": medline_stats["matched"],
        "with_pubmed": medline_stats["pubmed"],
        "with_pmc": sum(bool(rec.get("pmc")) for rec in records),
        "with_free_to_publish": free_count,
        "with_if_2024": sum(rec.get("if_2024") not in (None, "") for rec in records),
        "with_if_2025": sum(rec.get("if_2025") not in (None, "") for rec in records),
        "with_jcr_quartile": sum(bool(rec.get("if_quartile")) for rec in records),
        "with_cas_major": sum(bool(rec.get("cas_major_cn")) for rec in records),
        "with_review_cycle": sum(bool(rec.get("crossref")) for rec in records),
        "with_on_hold": sum(bool(rec.get("on_hold")) for rec in records),
        "with_under_review": sum(bool(rec.get("under_review")) for rec in records),
        "with_citic_warning": sum(bool(rec.get("citic_warning")) for rec in records),
        "doaj_source_updated": doaj_meta.get("source_updated") or "",
        "doaj_source_url": doaj_meta.get("source_url") or "https://doaj.org/csv",
        "oaj_source_updated": oaj_stats["updated"],
        "medline_source_updated": str(medline_meta.get("fetched_at") or "")[:10],
        "medline_source_url": medline_meta.get("source_url") or "https://www.ncbi.nlm.nih.gov/nlmcatalog/journals/",
        "data_bundle_updated": datetime.now(timezone.utc).date().isoformat(),
    })
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "before": before,
        "after": len(records),
        "light": light_count,
        "oaj": oaj_stats,
        "doaj": doaj_stats,
        "medline": medline_stats,
        "free_to_publish": free_count,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
