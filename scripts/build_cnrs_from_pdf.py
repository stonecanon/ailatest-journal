#!/usr/bin/env python3
"""Parse CNRS Section 37 Economics/Management 2020 journal categorization."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "data" / "sources" / "cnrs_section37_2020.pdf"
DEFAULT_OUTPUT = ROOT / "data" / "cnrs_journals.json"
SOURCE_URL = "https://www.gate.cnrs.fr/wp-content/uploads/2021/12/categorisation37_liste_juin_2020-2.pdf"
ISSN_RE = re.compile(r"^(\d{4})-?(\d{3}[\dXx])\s*$")
CAT_RE = re.compile(r"^[1-4][eg]?$")


def clean_issn(value: str) -> str:
    match = ISSN_RE.match(value or "")
    return f"{match.group(1)}-{match.group(2).upper()}" if match else ""


def is_noise(line: str) -> bool:
    return (
        not line
        or line.startswith("Liste Juin 2020")
        or line in {"Nom", "ISSN", "Domaine", "Cat"}
        or line.startswith("Catégorisation des revues")
        or line.startswith("Version 5.07")
    )


def extract_lines(path: Path) -> list[str]:
    lines: list[str] = []
    doc = fitz.open(path)
    for page in doc:
        for raw in page.get_text("text").splitlines():
            line = re.sub(r"\s+", " ", raw).strip()
            if not is_noise(line):
                lines.append(line)
    return lines


def parse_pdf(path: Path) -> list[dict]:
    lines = extract_lines(path)
    records: list[dict] = []
    seen = set()
    i = 0
    while i < len(lines):
        title_parts: list[str] = []
        while i < len(lines) and not ISSN_RE.match(lines[i]):
            # Skip introductory prose before the alphabetical list starts.
            if len(lines[i]) > 2 and not lines[i].isdigit() and not re.match(r"^[ivxlcdm]+$", lines[i], re.I):
                title_parts.append(lines[i])
            i += 1
        if i >= len(lines):
            break
        issn = clean_issn(lines[i])
        title = " ".join(title_parts).strip()
        i += 1
        if i + 1 >= len(lines):
            break
        domain = lines[i].strip()
        category = lines[i + 1].strip()
        i += 2
        if not title or not CAT_RE.match(category):
            continue
        key = (issn, domain, category)
        if key in seen:
            continue
        seen.add(key)
        records.append(
            {
                "title": title,
                "issn": issn,
                "domain": domain,
                "category": category,
                "year": 2020,
                "historical": True,
                "source_url": SOURCE_URL,
            }
        )
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    records = parse_pdf(args.pdf)
    if len(records) < 700:
        raise SystemExit(f"CNRS parsed too few records: {len(records)}")

    by_issn: dict[str, list[dict]] = {}
    for record in records:
        if record["issn"]:
            by_issn.setdefault(record["issn"], []).append(record)

    payload = {
        "source": "CNRS Section 37 Categorization of Journals in Economics and Management",
        "source_url": SOURCE_URL,
        "year": 2020,
        "historical": True,
        "fetched_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "count": len(records),
        "unique_issn_count": len(by_issn),
        "records": records,
        "by_issn": by_issn,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} CNRS records ({len(by_issn)} unique ISSNs) to {args.output}")


if __name__ == "__main__":
    main()
