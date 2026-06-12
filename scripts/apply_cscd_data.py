#!/usr/bin/env python3
"""Apply data/cscd_journals.json to the website data files."""

from __future__ import annotations

import gzip
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CSCD_JSON = DATA / "cscd_journals.json"
DOMESTIC_JSON = DATA / "domestic.json"
JOURNALS_GZ = DATA / "journals.json.gz"
META_JSON = DATA / "meta.json"


def clean_issn(value) -> str:
    text = str(value or "").strip().upper()
    match = re.search(r"\b(\d{4})-?(\d{3}[\dX])\b", text)
    return f"{match.group(1)}-{match.group(2)}" if match else ""


def norm_title(value) -> str:
    return re.sub(r"[^A-Z0-9\u4e00-\u9fff]+", "", str(value or "").upper())


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    cscd = load_json(CSCD_JSON)
    records = cscd.get("records", [])

    domestic = load_json(DOMESTIC_JSON)
    domestic["cscd"] = cscd
    DOMESTIC_JSON.write_text(json.dumps(domestic, ensure_ascii=False), encoding="utf-8")

    journals = json.loads(gzip.decompress(JOURNALS_GZ.read_bytes()).decode("utf-8"))
    by_issn = {}
    by_title = {}
    for rec in journals:
      for key in (clean_issn(rec.get("issn")), clean_issn(rec.get("eissn"))):
          if key:
              by_issn.setdefault(key, rec)
      for title in (rec.get("name"), rec.get("cn_name"), rec.get("en_name")):
          title_key = norm_title(title)
          if title_key:
              by_title.setdefault(title_key, rec)

    matched = 0
    for row in records:
        issn = clean_issn(row.get("issn"))
        title_key = norm_title(row.get("name"))
        rec = (by_issn.get(issn) if issn else None) or by_title.get(title_key)
        if not rec:
            continue
        rec["cscd"] = {
            "database": row.get("database") or "",
            "database_label": row.get("database_label") or "",
            "source": "CSCD",
        }
        matched += 1

    JOURNALS_GZ.write_bytes(gzip.compress(json.dumps(journals, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), compresslevel=9))

    if META_JSON.exists():
        meta = load_json(META_JSON)
        source = meta.get("source") or ""
        if "CSCD" not in source:
            meta["source"] = source + (" + CSCD" if source else "CSCD")
        meta["total"] = len(journals)
        meta["with_cscd"] = sum(1 for r in journals if r.get("cscd"))
        META_JSON.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"CSCD records: {len(records)}; matched journals: {matched}")


if __name__ == "__main__":
    main()
