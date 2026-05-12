#!/usr/bin/env python3
"""Convert ESI Excel (全部期刊列表.xlsx) into journals.json + categories.json."""
import json
import re
from collections import Counter
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("/Users/zhizhi/.hermes/cache/documents/doc_4f0ce4c8295c_全部期刊列表.xlsx")
OUT_DATA = ROOT / "data"
OUT_DATA.mkdir(exist_ok=True)


def clean(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s.upper() in ("N/A", "NA", "NONE") else s


def normalize_issn(s):
    s = clean(s).upper().replace(" ", "")
    m = re.match(r"^(\d{4})-?(\d{3}[\dX])$", s)
    return f"{m.group(1)}-{m.group(2)}" if m else s


def slug_from_title(t):
    s = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
    return s[:80] or "journal"


def main():
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [clean(c) for c in next(rows)]
    print("Columns:", header)

    def col(name):
        for i, h in enumerate(header):
            if h.lower().startswith(name.lower()):
                return i
        return -1

    i_full = col("Full Title")
    i_t20 = col("Title20")
    i_t29 = col("Title29")
    i_cat = col("Category")
    i_issn = col("ISSN")
    i_eissn = col("eISSN")

    journals = []
    seen_ids = set()
    cat_counter = Counter()

    for r in rows:
        full = clean(r[i_full]) if i_full >= 0 else ""
        if not full:
            continue
        t20 = clean(r[i_t20]) if i_t20 >= 0 else ""
        t29 = clean(r[i_t29]) if i_t29 >= 0 else ""
        cat = clean(r[i_cat]) if i_cat >= 0 else ""
        issn = normalize_issn(r[i_issn]) if i_issn >= 0 else ""
        eissn = normalize_issn(r[i_eissn]) if i_eissn >= 0 else ""

        # dedupe by ISSN primarily, fallback to slug
        base = issn or eissn or slug_from_title(full)
        jid = base
        n = 1
        while jid in seen_ids:
            n += 1
            jid = f"{base}-{n}"
        seen_ids.add(jid)

        journals.append({
            "id": jid,
            "title": full,
            "t20": t20,
            "t29": t29,
            "cat": cat,
            "issn": issn,
            "eissn": eissn,
        })
        if cat:
            cat_counter[cat] += 1

    journals.sort(key=lambda j: j["title"].lower())

    categories = [
        {"name": name, "count": cnt}
        for name, cnt in sorted(cat_counter.items(), key=lambda x: (-x[1], x[0]))
    ]

    (OUT_DATA / "journals.json").write_text(
        json.dumps(journals, ensure_ascii=False, separators=(",", ":"))
    )
    (OUT_DATA / "categories.json").write_text(
        json.dumps(categories, ensure_ascii=False, indent=2)
    )

    print(f"Wrote {len(journals)} journals in {len(categories)} categories")
    print(f"journals.json: {(OUT_DATA / 'journals.json').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
