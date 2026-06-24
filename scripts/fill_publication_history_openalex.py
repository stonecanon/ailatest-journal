#!/usr/bin/env python3
"""
Backfill journal publication_history from OpenAlex sources counts_by_year.

This is intentionally separate from fetch_openalex.py because older cache rows
can contain counts_by_year: [] and were therefore skipped by the original
resumable fetch logic. Here we target records that still have no annual output
history and fetch fresh source rows directly from OpenAlex.
"""
from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
JOURNALS_GZ = DATA / "journals.json.gz"
MOBILE_GZ = DATA / "journals_mobile.json.gz"
ANNUAL_GZ = DATA / "annual_outputs.json.gz"
META = DATA / "meta.json"

MAILTO = "ailatest@security-contact.local"
BATCH = 50
SLEEP = 0.12
WOS_INDEXES = {"SCIE", "SSCI", "AHCI", "ESCI"}
SELECT = ",".join(["id", "display_name", "issn_l", "issn", "works_count", "counts_by_year"])


def read_gz(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return json.load(f)


def write_gz(path: Path, data) -> None:
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def norm_issn(value) -> str:
    if not value:
        return ""
    s = str(value).strip().upper()
    if len(s) == 8:
        s = f"{s[:4]}-{s[4:]}"
    return s if len(s) == 9 and "-" in s else ""


def journal_issns(row: dict) -> list[str]:
    out = []
    for field in ("issn", "eissn"):
        value = norm_issn(row.get(field))
        if value and value not in out:
            out.append(value)
    return out


def has_history(row: dict) -> bool:
    return bool(row.get("publication_history"))


def is_priority(row: dict) -> bool:
    if row.get("if_2024") is not None or row.get("if_2025") is not None or row.get("if_latest") is not None:
        return True
    return any(idx in WOS_INDEXES for idx in (row.get("indices") or []))


def annual_to_history(year_counts: dict, years: int = 12) -> list[dict]:
    items = []
    for year, count in (year_counts or {}).items():
        try:
            y = int(year)
            c = int(count)
        except (TypeError, ValueError):
            continue
        items.append({"year": y, "count": c})
    items.sort(key=lambda item: item["year"])
    return items[-years:]


def source_to_annual(source: dict) -> dict:
    annual = {}
    for item in source.get("counts_by_year") or []:
        try:
            year = int(item.get("year"))
            count = int(item.get("works_count"))
        except (TypeError, ValueError):
            continue
        annual[str(year)] = count
    return annual


def fetch_batch(issns: list[str]) -> list[dict]:
    flt = urllib.parse.quote("|".join(issns), safe="|-")
    url = (
        "https://api.openalex.org/sources"
        f"?filter=issn:{flt}"
        "&per_page=50"
        f"&select={SELECT}"
        f"&mailto={urllib.parse.quote(MAILTO)}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": f"ailatest-journal/1.0 ({MAILTO})"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=40) as resp:
                data = json.loads(resp.read())
            return data.get("results", [])
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                time.sleep(4 * (attempt + 1))
                continue
            print(f"HTTP {exc.code} for ISSN batch {issns[:2]}...", file=sys.stderr)
            return []
        except Exception as exc:
            print(f"{exc} for ISSN batch {issns[:2]}... retry {attempt + 1}", file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    return []


def update_rows(rows: list[dict], annual_outputs: dict) -> int:
    touched = 0
    for row in rows:
        if has_history(row):
            continue
        for issn in journal_issns(row):
            history = annual_to_history(annual_outputs.get(issn))
            if history:
                row["publication_history"] = history
                touched += 1
                break
    return touched


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="Backfill all records with ISSN/eISSN, not only WoS/IF journals.")
    args = parser.parse_args()

    journals = read_gz(JOURNALS_GZ)
    mobile = read_gz(MOBILE_GZ)
    annual_outputs = read_gz(ANNUAL_GZ) if ANNUAL_GZ.exists() else {}

    targets = []
    wanted_issns = set()
    for row in journals:
        if has_history(row):
            continue
        if not args.all and not is_priority(row):
            continue
        issns = journal_issns(row)
        if not issns:
            continue
        targets.append(row)
        if not any(annual_outputs.get(issn) for issn in issns):
            wanted_issns.update(issns)

    print(f"Target journals missing publication_history: {len(targets):,}")
    print(f"ISSNs needing fresh OpenAlex fetch: {len(wanted_issns):,}")

    fetched_sources = 0
    fetched_with_annual = 0
    issn_list = sorted(wanted_issns)
    total_batches = (len(issn_list) + BATCH - 1) // BATCH
    for batch_no, start in enumerate(range(0, len(issn_list), BATCH), 1):
        chunk = issn_list[start:start + BATCH]
        results = fetch_batch(chunk)
        fetched_sources += len(results)
        for source in results:
            annual = source_to_annual(source)
            if not annual:
                continue
            fetched_with_annual += 1
            keys = [norm_issn(source.get("issn_l"))]
            keys.extend(norm_issn(value) for value in (source.get("issn") or []))
            for key in keys:
                if key:
                    annual_outputs[key] = annual
        if batch_no % 20 == 0 or batch_no == total_batches:
            print(
                f"  batch {batch_no}/{total_batches}: "
                f"sources {fetched_sources:,}, with annual {fetched_with_annual:,}"
            )
        time.sleep(SLEEP)

    journal_touched = update_rows(journals, annual_outputs)
    mobile_touched = update_rows(mobile, annual_outputs)

    write_gz(ANNUAL_GZ, annual_outputs)
    write_gz(JOURNALS_GZ, journals)
    write_gz(MOBILE_GZ, mobile)

    if META.exists():
        meta = json.loads(META.read_text(encoding="utf-8"))
    else:
        meta = {}
    meta["annual_outputs_source"] = "OpenAlex sources counts_by_year"
    meta["annual_outputs_count"] = len(annual_outputs)
    meta["with_publication_history"] = sum(1 for row in journals if has_history(row))
    META.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    remaining_priority = sum(
        1
        for row in journals
        if not has_history(row) and journal_issns(row) and (args.all or is_priority(row))
    )
    print(f"Annual output ISSN keys: {len(annual_outputs):,}")
    print(f"Backfilled journals: {journal_touched:,}")
    print(f"Backfilled mobile records: {mobile_touched:,}")
    print(f"Remaining target journals without history: {remaining_priority:,}")


if __name__ == "__main__":
    main()
