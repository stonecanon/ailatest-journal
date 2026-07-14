#!/usr/bin/env python3
"""Merge public specialty-index title lists into deployed journal datasets.

Supported inputs:
- EBSCO FSTA with Full Text coverage HTML (public title list)
- IET Inspec active source list XLSX (public source list)

The FSTA list is intentionally stored as ``fsta_full_text``.  It is a subset
of FSTA, not the complete FSTA abstracting and indexing database.
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover
    openpyxl = None


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
FSTA_URL = "https://about.ebsco.com/m/ee/Marketing/titleLists/fwt-coverage.htm"


def clean_issn(value) -> str:
    raw = re.sub(r"[^0-9X]", "", str(value or "").upper())
    return f"{raw[:4]}-{raw[4:]}" if len(raw) == 8 else ""


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = self.in_cell = False
        self.rows: list[list[str]] = []
        self.row: list[str] | None = None
        self.cell: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table" and attrs.get("id") == "dataTable":
            self.in_table = True
        elif self.in_table and tag == "tr":
            self.row = []
        elif self.in_table and tag in {"td", "th"} and self.row is not None:
            self.in_cell = True
            self.cell = []

    def handle_data(self, data):
        if self.in_cell:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if self.in_table and tag in {"td", "th"} and self.in_cell:
            self.row.append(" ".join("".join(self.cell).split()))
            self.in_cell = False
        elif self.in_table and tag == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None
        elif tag == "table" and self.in_table:
            self.in_table = False


def load_fsta(source: str) -> list[dict]:
    if re.match(r"^https?://", source):
        req = urllib.request.Request(source, headers={"User-Agent": "AILatest-Journal/1.0"})
        html = urllib.request.urlopen(req, timeout=45).read().decode("utf-8", "replace")
    else:
        html = Path(source).read_text(encoding="utf-8", errors="replace")
    parser = TableParser()
    parser.feed(html)
    if not parser.rows:
        raise RuntimeError("FSTA coverage table not found")
    header, *rows = parser.rows
    out = []
    for row in rows:
        row += [""] * (len(header) - len(row))
        rec = dict(zip(header, row))
        issn = clean_issn(rec.get("ISSN"))
        if not issn:
            continue
        out.append({
            "issn": issn,
            "title": rec.get("Publication Name", ""),
            "publisher": rec.get("Publisher", ""),
            "country": rec.get("Country", ""),
            "source_type": rec.get("Source Type", ""),
            "peer_reviewed": rec.get("Peer-Reviewed") == "Y",
            "full_text_start": rec.get("Full Text Start", ""),
            "full_text_stop": rec.get("Full Text Stop", ""),
            "availability": rec.get("Availability*", ""),
        })
    return out


def find_header_row(sheet):
    for idx, row in enumerate(sheet.iter_rows(min_row=1, max_row=30, values_only=True), 1):
        vals = [str(v or "").strip() for v in row]
        joined = "|".join(vals).lower()
        if "journal title" in joined and ("pissn" in joined or "issn" in joined):
            return idx, vals
    raise RuntimeError("Inspec header row not found")


def load_inspec(path: str) -> list[dict]:
    if not openpyxl:
        raise RuntimeError("openpyxl is required for the Inspec XLSX")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = wb[wb.sheetnames[0]]
    header_row, header = find_header_row(sheet)
    keys = {re.sub(r"\s+", " ", h.lower()).strip(): i for i, h in enumerate(header)}

    def value(row, *names):
        for name in names:
            idx = keys.get(name)
            if idx is not None and idx < len(row):
                return str(row[idx] or "").strip()
        return ""

    out, seen = [], set()
    for row in sheet.iter_rows(min_row=header_row + 1, values_only=True):
        title = value(row, "journal title", "source title")
        pissn = clean_issn(value(row, "pissn", "print issn", "issn"))
        eissn = clean_issn(value(row, "eissn", "electronic issn"))
        if not title or not (pissn or eissn):
            continue
        key = (pissn, eissn, title.casefold())
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "title": title,
            "issn": pissn,
            "eissn": eissn,
            "publisher": value(row, "publisher"),
            "country": value(row, "publisher country", "country"),
            "inspec_id": value(row, "inspec id"),
        })
    return out


def issn_keys(rec: dict) -> set[str]:
    return {x for x in (clean_issn(rec.get("issn")), clean_issn(rec.get("eissn"))) if x}


def patch_list(records: list[dict], fsta: set[str], inspec: set[str]) -> tuple[int, int]:
    f_hits = i_hits = 0
    for rec in records:
        keys = issn_keys(rec)
        if keys & fsta:
            rec["fsta_full_text"] = True
            f_hits += 1
        else:
            rec.pop("fsta_full_text", None)
        if keys & inspec:
            rec["inspec"] = True
            i_hits += 1
        elif inspec:
            rec.pop("inspec", None)
    return f_hits, i_hits


def read_json(path: Path):
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as f:
            return json.load(f)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data):
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if path.suffix == ".gz":
        with gzip.open(path, "wb", compresslevel=9) as f:
            f.write(raw)
    else:
        path.write_bytes(raw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fsta", default=FSTA_URL, help="FSTA coverage HTML URL or file")
    ap.add_argument("--inspec", help="IET Inspec active source list XLSX")
    args = ap.parse_args()

    fsta_rows = load_fsta(args.fsta)
    inspec_rows = load_inspec(args.inspec) if args.inspec else []
    active_fsta = [r for r in fsta_rows if not r.get("full_text_stop")]
    fsta_issns = {r["issn"] for r in active_fsta}
    inspec_issns = {x for r in inspec_rows for x in issn_keys(r)}

    stats = {}
    for name in ("journals.json.gz", "journals_deploy.json", "journals_light.json.gz"):
        path = DATA / name
        if not path.exists():
            continue
        records = read_json(path)
        hits = patch_list(records, fsta_issns, inspec_issns)
        write_json(path, records)
        stats[name] = {"fsta_full_text": hits[0], "inspec": hits[1]}

    payload = {
        "updated": "2026-07-14",
        "sources": {
            "fsta_full_text": {
                "label": "FSTA with Full Text",
                "scope": "full_text_subset",
                "url": FSTA_URL,
                "records": len(fsta_rows),
                "active_records": len(active_fsta),
                "active_issns": len(fsta_issns),
            },
            "inspec": {
                "label": "Inspec",
                "scope": "active_source_list",
                "url": "https://www.theiet.org/publishing/solutions-for-your-institution-or-organisation/inspec/inspec-content-and-coverage",
                "records": len(inspec_rows),
                "issns": len(inspec_issns),
            },
        },
        "matches": stats,
    }
    write_json(DATA / "specialty_indexes.json", payload)
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
