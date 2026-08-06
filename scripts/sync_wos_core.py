#!/usr/bin/env python3
"""Synchronize active Web of Science Core Collection membership.

The four Master Journal List CSV files are authoritative for active SCIE,
SSCI, AHCI and ESCI membership. Older JCR flags are retained only as
historical coverage so discontinued or transferred titles remain searchable.
"""

from __future__ import annotations

import csv
import gzip
import json
import os
import re
import time
import unicodedata
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LIST = ROOT / "list"
WOS_INDEXES = ("SCIE", "SSCI", "AHCI", "ESCI")
SOURCE_UPDATED = "2026-06-15"
SOURCE_URL = "https://mjl.clarivate.com/collection-list-downloads"
SOURCE_FILES = {
    "SCIE": "Science Citation Index Expanded (SCIE).csv",
    "SSCI": "Social Sciences Citation Index (SSCI).csv",
    "AHCI": "Arts & Humanities Citation Index (AHCI).csv",
    "ESCI": "Emerging Sources Citation Index (ESCI).csv",
}

# Public MJL checks that can be reproduced without treating a JCR metric year
# as proof of current coverage. The collection files establish the first list
# in our archive where a title is absent; Clarivate's public search can confirm
# that it remains absent, but does not expose the exact editorial decision date
# or reason.
PUBLIC_STATUS_CHECKS = {
    "0921-7126": {
        "current_verified_on": "2026-07-20",
        "verification_date": "2026-07-23",
        "verification_result": "no_current_mjl_result",
    },
}


def clean_issn(value: object) -> str:
    match = re.search(r"\b(\d{4})-?(\d{3}[\dX])\b", str(value or "").upper())
    return f"{match.group(1)}-{match.group(2)}" if match else ""


def norm_title(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def slugify(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "journal"


def read_json(path: Path):
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            return json.load(handle)
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload) -> None:
    temp = path.with_name(path.name + ".wos-sync.tmp")
    if path.suffix == ".gz":
        with gzip.open(temp, "wt", encoding="utf-8", compresslevel=9) as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    else:
        temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for attempt in range(5):
        try:
            os.replace(temp, path)
            return
        except OSError:
            if attempt == 4:
                raise
            time.sleep(0.25 * (attempt + 1))


def load_sources() -> list[dict]:
    combined: dict[str, dict] = {}
    aliases: dict[str, str] = {}
    for index_name, filename in SOURCE_FILES.items():
        path = LIST / filename
        if not path.exists():
            raise FileNotFoundError(path)
        with path.open(encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                title = str(row.get("Journal title") or "").strip()
                if not title:
                    continue
                issn = clean_issn(row.get("ISSN"))
                eissn = clean_issn(row.get("eISSN"))
                title_key = norm_title(title)
                keys = [key for key in (issn, eissn, title_key) if key]
                # ISSNs take precedence over normalized titles. Distinct titles
                # such as "Science Education" and "Science & Education"
                # intentionally normalize to the same text but are separate journals.
                canonical = next((aliases[key] for key in (issn, eissn) if key and key in aliases), None)
                if canonical is None:
                    canonical = (issn or eissn or aliases.get(title_key) or title_key)
                rec = combined.setdefault(canonical, {
                    "name": title,
                    "issn": issn,
                    "eissn": eissn,
                    "publisher": str(row.get("Publisher name") or "").strip(),
                    "wos_categories": [],
                    "indices": [],
                })
                for key in keys:
                    aliases[key] = canonical
                if index_name not in rec["indices"]:
                    rec["indices"].append(index_name)
                cats = str(row.get("Web of Science Categories") or "").strip()
                for cat in (part.strip() for part in cats.split("|")):
                    if cat and cat not in rec["wos_categories"]:
                        rec["wos_categories"].append(cat)
    return list(combined.values())


def make_lookups(records: list[dict]):
    by_issn: dict[str, dict] = {}
    by_title: dict[str, dict] = {}
    for rec in records:
        for value in (rec.get("issn"), rec.get("eissn")):
            key = clean_issn(value)
            if key:
                by_issn.setdefault(key, rec)
        title_key = norm_title(rec.get("name"))
        if title_key:
            by_title.setdefault(title_key, rec)
    return by_issn, by_title


def unique_slug(base: str, used: set[str]) -> str:
    candidate = base
    counter = 2
    while candidate in used:
        candidate = f"{base}-{counter}"
        counter += 1
    used.add(candidate)
    return candidate


def sync_records(records: list[dict], sources: list[dict]) -> tuple[list[dict], dict]:
    previous_active = Counter()
    previous_by_record: dict[int, set[str]] = {}
    for rec in records:
        old = {idx for idx in (rec.get("indices") or []) if idx in WOS_INDEXES}
        previous_by_record[id(rec)] = old
        previous_active.update(old)
        rec["indices"] = [idx for idx in (rec.get("indices") or []) if idx not in WOS_INDEXES]

    by_issn, by_title = make_lookups(records)
    used_slugs = {str(rec.get("slug") or "") for rec in records if rec.get("slug")}
    matched = added = 0

    for source in sources:
        rec = None
        for value in (source.get("issn"), source.get("eissn")):
            key = clean_issn(value)
            if key and key in by_issn:
                rec = by_issn[key]
                break
        if rec is None:
            rec = by_title.get(norm_title(source.get("name")))
        if rec is None:
            rec = {
                "name": source["name"],
                "issn": source.get("issn") or "",
                "eissn": source.get("eissn") or "",
                "publisher": source.get("publisher") or "",
                "wos_categories": list(source.get("wos_categories") or []),
                "esi_category": "",
                "abbr20": "",
                "country": "",
                "indices": [],
                "slug": unique_slug(slugify(source["name"]), used_slugs),
                "wos_only": True,
            }
            records.append(rec)
            previous_by_record[id(rec)] = set()
            added += 1
            for value in (rec.get("issn"), rec.get("eissn")):
                key = clean_issn(value)
                if key:
                    by_issn.setdefault(key, rec)
            by_title.setdefault(norm_title(rec.get("name")), rec)
        else:
            matched += 1
        for idx in source.get("indices") or []:
            if idx not in rec["indices"]:
                rec["indices"].append(idx)
        if source.get("wos_categories"):
            rec["wos_categories"] = list(source["wos_categories"])
        if not rec.get("publisher") and source.get("publisher"):
            rec["publisher"] = source["publisher"]
        rec["wos_source_updated"] = SOURCE_UPDATED

    historical_records = transitioned_records = 0
    for rec in records:
        active = {idx for idx in (rec.get("indices") or []) if idx in WOS_INDEXES}
        removed = previous_by_record.get(id(rec), set()) - active
        prior = rec.get("wos_historical") or {}
        prior_indices = set(prior.get("indices") or []) if isinstance(prior, dict) else set()
        historical = [idx for idx in WOS_INDEXES if idx in (prior_indices | removed) and idx not in active]
        if historical:
            first_absent = prior.get("first_absent") if isinstance(prior, dict) else ""
            history = {
                "status": "transferred" if active else "not_in_current_index",
                "indices": historical,
                "current_indices": [idx for idx in WOS_INDEXES if idx in active],
                "as_of": SOURCE_UPDATED,
                "first_absent": first_absent or SOURCE_UPDATED,
                "event": "index_transfer" if active else "no_longer_in_current_list",
                "reason": "not_disclosed",
                "source": "Clarivate Master Journal List / prior JCR snapshot",
                "source_url": SOURCE_URL,
            }
            if rec.get("jcr_year"):
                history["last_jcr_year"] = rec["jcr_year"]
            public_check = PUBLIC_STATUS_CHECKS.get(clean_issn(rec.get("issn"))) or PUBLIC_STATUS_CHECKS.get(clean_issn(rec.get("eissn")))
            if public_check:
                history.update(public_check)
            rec["wos_historical"] = history
            historical_records += 1
            if active:
                transitioned_records += 1
        else:
            rec.pop("wos_historical", None)

    current = Counter()
    for rec in records:
        current.update(idx for idx in (rec.get("indices") or []) if idx in WOS_INDEXES)
    return records, {
        "before": dict(previous_active),
        "after": dict(current),
        "source_records": len(sources),
        "matched": matched,
        "added": added,
        "historical_records": historical_records,
        "transitioned_records": transitioned_records,
    }


def update_search_index(records: list[dict]) -> None:
    path = DATA / "journal_index.json"
    index = read_json(path)
    for rec in records:
        slug = str(rec.get("slug") or "")
        if not slug:
            continue
        entry = index.get(slug)
        if not isinstance(entry, dict) or "_r" in entry:
            entry = {}
        entry.update({
            "n": rec.get("name") or "",
            "i": rec.get("issn") or "",
            "is": rec.get("eissn") or "",
            "p": rec.get("publisher") or "",
        })
        other = [idx for idx in (entry.get("ix") or []) if idx not in WOS_INDEXES]
        active = [idx for idx in WOS_INDEXES if idx in (rec.get("indices") or [])]
        if other + active:
            entry["ix"] = other + active
        else:
            entry.pop("ix", None)
        index[slug] = {key: value for key, value in entry.items() if value not in ("", [], None)}
        for value in (rec.get("issn"), rec.get("eissn")):
            compact = re.sub(r"[^0-9X]", "", str(value or "").upper())
            if compact:
                index[compact] = {"_r": slug}
    write_json(path, index)


def main() -> None:
    sources = load_sources()
    results = {}
    full_records = None
    for filename in ("journals.json.gz", "journals_light.json.gz"):
        path = DATA / filename
        records, stats = sync_records(read_json(path), sources)
        write_json(path, records)
        results[filename] = {"records": len(records), **stats}
        if filename == "journals.json.gz":
            full_records = records
    plain = DATA / "journals.json"
    if plain.exists():
        records, stats = sync_records(read_json(plain), sources)
        write_json(plain, records)
        results[plain.name] = {"records": len(records), **stats}

    update_search_index(full_records or [])
    meta_path = DATA / "meta.json"
    meta = read_json(meta_path)
    counts = results["journals.json.gz"]["after"]
    meta["total"] = len(full_records or [])
    for idx in WOS_INDEXES:
        meta.setdefault("indices", {})[idx] = counts.get(idx, 0)
    meta["last_updated_source"] = f"WoS Core {SOURCE_UPDATED}"
    meta["wos_source_updated"] = SOURCE_UPDATED
    meta["wos_source_url"] = SOURCE_URL
    meta["wos_historical_records"] = results["journals.json.gz"]["historical_records"]
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
