#!/usr/bin/env python3
"""Apply data/cstpcd_journals.json to the website data files."""

from __future__ import annotations

import gzip
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CSTPCD_JSON = DATA / "cstpcd_journals.json"
DOMESTIC_JSON = DATA / "domestic.json"
JOURNALS_GZ = DATA / "journals.json.gz"
META_JSON = DATA / "meta.json"


def norm_title(value) -> str:
    return re.sub(r"[^A-Z0-9\u4e00-\u9fff]+", "", str(value or "").upper())


def label_for(kind: str) -> str:
    return "科技核心·科普" if kind == "popular_science" else "科技核心"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    cstpcd = load_json(CSTPCD_JSON)
    records = cstpcd.get("records", [])

    domestic = load_json(DOMESTIC_JSON)
    domestic["cstpcd"] = cstpcd
    DOMESTIC_JSON.write_text(json.dumps(domestic, ensure_ascii=False), encoding="utf-8")

    journals = json.loads(gzip.decompress(JOURNALS_GZ.read_bytes()).decode("utf-8"))
    by_title = {}
    for rec in journals:
        for title in (rec.get("name"), rec.get("cn_name"), rec.get("en_name")):
            key = norm_title(title)
            if key:
                by_title.setdefault(key, rec)

    matched = 0
    for row in records:
        rec = by_title.get(norm_title(row.get("name")))
        if not rec:
            continue
        kind = row.get("kind") or "core"
        rec["cstpcd"] = {
            "kind": kind,
            "code": row.get("code") or "",
            "label": label_for(kind),
            "source": "CSTPCD",
        }
        matched += 1

    JOURNALS_GZ.write_bytes(gzip.compress(json.dumps(journals, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), compresslevel=9))

    if META_JSON.exists():
        meta = load_json(META_JSON)
        source = meta.get("source") or ""
        if "中国科技核心" not in source:
            meta["source"] = source + (" + 中国科技核心" if source else "中国科技核心")
        meta["total"] = len(journals)
        meta["with_cstpcd"] = sum(1 for r in journals if r.get("cstpcd"))
        meta["with_cstpcd_popular"] = sum(1 for r in journals if r.get("cstpcd", {}).get("kind") == "popular_science")
        META_JSON.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"CSTPCD records: {len(records)}; matched journals: {matched}")


if __name__ == "__main__":
    main()
