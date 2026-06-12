#!/usr/bin/env python3
"""Download Crossref Retraction Watch CSV and aggregate by journal title."""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "sources"
DEFAULT_CSV = SOURCES / "retraction_watch.csv"
DEFAULT_OUTPUT = ROOT / "data" / "retraction_watch_journals.json"
SOURCE_URL = "https://gitlab.com/crossref/retraction-watch-data"
RAW_URL = "https://gitlab.com/api/v4/projects/crossref%2Fretraction-watch-data/repository/files/retraction_watch.csv/raw?ref=main"


def norm_title(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "").lower()
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_year(value: str) -> str:
    if not value:
        return ""
    match = re.search(r"\b(19|20)\d{2}\b", value)
    return match.group(0) if match else ""


def download(path: Path) -> None:
    SOURCES.mkdir(parents=True, exist_ok=True)
    req = Request(RAW_URL, headers={"User-Agent": "ailatest-journal/1.0"})
    with urlopen(req, timeout=180) as response:
        path.write_bytes(response.read())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--skip-download", action="store_true")
    args = parser.parse_args()

    if not args.skip_download or not args.csv.exists():
        download(args.csv)

    grouped: dict[str, dict] = {}
    with args.csv.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            journal = (row.get("Journal") or "").strip()
            if not journal:
                continue
            key = norm_title(journal)
            if not key:
                continue
            rec = grouped.setdefault(
                key,
                {
                    "journal": journal,
                    "norm": key,
                    "retractions_total": 0,
                    "retractions_by_year": Counter(),
                    "original_papers_by_year": Counter(),
                    "publishers": Counter(),
                    "retraction_nature": Counter(),
                },
            )
            rec["retractions_total"] += 1
            year = parse_year(row.get("RetractionDate") or "")
            if year:
                rec["retractions_by_year"][year] += 1
            original_year = parse_year(row.get("OriginalPaperDate") or "")
            if original_year:
                rec["original_papers_by_year"][original_year] += 1
            publisher = (row.get("Publisher") or "").strip()
            if publisher:
                rec["publishers"][publisher] += 1
            nature = (row.get("RetractionNature") or "").strip()
            if nature:
                rec["retraction_nature"][nature] += 1

    records = []
    for rec in grouped.values():
        records.append(
            {
                "journal": rec["journal"],
                "norm": rec["norm"],
                "retractions_total": rec["retractions_total"],
                "retractions_by_year": dict(sorted(rec["retractions_by_year"].items())),
                "original_papers_by_year": dict(sorted(rec["original_papers_by_year"].items())),
                "top_publishers": rec["publishers"].most_common(5),
                "retraction_nature": dict(rec["retraction_nature"].most_common()),
            }
        )
    records.sort(key=lambda r: (-r["retractions_total"], r["journal"].casefold()))

    payload = {
        "source": "Crossref Retraction Watch data",
        "source_url": SOURCE_URL,
        "raw_url": RAW_URL,
        "fetched_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "count": len(records),
        "records": records,
        "by_norm": {record["norm"]: record for record in records},
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} Retraction Watch journal aggregates to {args.output}")


if __name__ == "__main__":
    main()
