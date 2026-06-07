#!/usr/bin/env python3
"""Build Malaysia / ERA journal directory data for the website.

Raw files stay under list/malaysia, which is intentionally ignored by git.
This script publishes a compact searchable JSON to data/malaysia.json.
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "list" / "malaysia" / "outputs"
DATA = ROOT / "data"


def clean(value: str | None) -> str:
    value = (value or "").strip()
    return "" if value in {"-", "—", "NA", "N/A"} else value


def read_csv(name: str) -> list[dict[str, str]]:
    path = SRC / name
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def mycite_record(row: dict[str, str], source: str) -> dict[str, str]:
    return {
        "source": source,
        "journal_title": clean(row.get("Journal Title")),
        "publisher": clean(row.get("Publisher")),
        "issn": clean(row.get("ISSN")),
        "eissn": clean(row.get("e-ISSN")),
        "indexed_year": clean(row.get("Indexed Year")),
    }


def era_record(row: dict[str, str]) -> dict[str, str]:
    return {
        "source": "ERA 2023",
        "journal_id": clean(row.get("Journal ID")),
        "journal_title": clean(row.get("Journal Title")),
        "foreign_title": clean(row.get("Foreign Title")),
        "issn": clean(row.get("ISSN")),
        "for_subjects": clean(row.get("FoR Subjects")),
        "era_year": clean(row.get("ERA Year")),
    }


def main() -> None:
    mycite_online = [
        mycite_record(row, "MyCite Online")
        for row in read_csv("mycite_indexed_journal_list_online.csv")
    ]
    mycite_2025 = [
        mycite_record(row, "MyCite 2025")
        for row in read_csv("mycite_indexed_journal_list_online_2025_only.csv")
    ]
    era_2023 = [
        era_record(row)
        for row in read_csv("era_2023_submitted_journal_list.csv")
    ]

    year_counts = Counter(r.get("indexed_year") for r in mycite_online if r.get("indexed_year"))
    payload = {
        "source": "MyCite 2025 official PDF + MyCite online index + ERA 2023 Submitted Journal List",
        "country": "Malaysia",
        "last_updated": date.today().isoformat(),
        "official_pdf": {
            "title": "MyCite 2025 RASMI",
            "url": "https://jpt.mohe.gov.my/portal/images/MyCite_2025_RASMI.pdf",
            "note": "Use the official 2025 PDF as the primary evidence for formal Malaysia MyCite recognition decisions.",
        },
        "source_notes": {
            "mycite_2025": "MyCite 2025 online-filtered records. The official PDF remains the primary formal reference.",
            "mycite_online": "MyCite Indexed Journal List online database, covering historical indexed years 2014-2025.",
            "era_2023": "ERA 2023 Submitted Journal List. This is the latest visible ERA submitted list in the collected sources.",
            "myjurnal": "MyJurnal was not reachable from this machine during collection and is not included.",
        },
        "counts": {
            "mycite_2025": len(mycite_2025),
            "mycite_online": len(mycite_online),
            "era_2023": len(era_2023),
            "mycite_online_years": dict(sorted(year_counts.items())),
        },
        "records": {
            "mycite_2025": mycite_2025,
            "mycite_online": mycite_online,
            "era_2023": era_2023,
        },
    }

    DATA.mkdir(exist_ok=True)
    out = DATA / "malaysia.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {out}")
    print(json.dumps(payload["counts"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
