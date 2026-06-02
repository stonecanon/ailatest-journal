"""Build India UGC-CARE data from the public PDF mirror in list/india.

The source PDF is table-based, so PyMuPDF word coordinates are more reliable
than plain text extraction for multi-line titles and publishers.
"""
from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
INDIA_DIR = ROOT / "list" / "india"
DATA_DIR = ROOT / "data"
PDF_PATH = INDIA_DIR / "UGC-Care-list-Journals-2025-ilovephd.pdf"


COLS = {
    "sr_no": (45, 86),
    "journal_title": (86, 300),
    "publisher": (300, 474),
    "issn": (474, 532),
    "eissn": (532, 589),
    "subject": (589, 740),
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def clean_issn(value: str) -> str:
    value = clean_text(value).upper()
    if value in {"", "NA", "N/A", "NONE"}:
        return "NA"
    compact = re.sub(r"[^0-9X]", "", value)
    if len(compact) == 8:
        return f"{compact[:4]}-{compact[4:]}"
    return value


def extract_pdf_records(pdf_path: Path) -> list[dict]:
    doc = fitz.open(pdf_path)
    records: list[dict] = []

    for page_no, page in enumerate(doc, start=1):
        words = page.get_text("words")
        row_starts: list[tuple[int, float, float]] = []
        for x0, y0, x1, y1, text, *_ in words:
            if 45 <= x0 <= 86 and re.fullmatch(r"\d{1,4}", text):
                row_starts.append((int(text), y0, y1))
        row_starts.sort(key=lambda item: item[1])

        for idx, (sr_no, y0, _y1) in enumerate(row_starts):
            y_next = row_starts[idx + 1][1] if idx + 1 < len(row_starts) else page.rect.height - 28
            cell_words: dict[str, list[tuple[float, float, str]]] = {k: [] for k in COLS}
            for wx0, wy0, wx1, wy1, text, *_ in words:
                if wy0 < y0 - 1 or wy0 >= y_next - 1:
                    continue
                for col, (left, right) in COLS.items():
                    if left <= wx0 < right:
                        cell_words[col].append((wy0, wx0, text))
                        break

            row = {}
            for col, values in cell_words.items():
                values.sort(key=lambda item: (round(item[0], 1), item[1]))
                row[col] = clean_text(" ".join(v[2] for v in values))

            title = row.get("journal_title", "")
            if not title or title.lower() == "title":
                continue
            rec = {
                "sr_no": sr_no,
                "journal_title": title,
                "publisher": row.get("publisher", ""),
                "issn": clean_issn(row.get("issn", "")),
                "eissn": clean_issn(row.get("eissn", "")),
                "subject": row.get("subject", ""),
                "category": row.get("subject", ""),
                "ugc_care_coverage_year": "",
                "details": "",
                "source_url": "https://www.ilovephd.com/wp-content/uploads/2024/12/UGC-Care-list-Journals-2025.pdf",
                "source": "UGC-CARE List PDF mirror (2025), based on UGC-CARE Group I journal table",
                "page": page_no,
                "crawled_at": datetime.now(timezone.utc).date().isoformat(),
            }
            records.append(rec)

    # Keep the PDF order, but drop accidental duplicate serial/title pairs.
    seen = set()
    deduped = []
    for rec in records:
        key = (rec["sr_no"], rec["journal_title"].casefold(), rec["issn"], rec["eissn"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(rec)
    return deduped


def write_outputs(records: list[dict]) -> None:
    INDIA_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    raw_path = INDIA_DIR / "ugc-care-journals.raw.json"
    raw_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    fields = [
        "sr_no",
        "journal_title",
        "publisher",
        "issn",
        "eissn",
        "subject",
        "category",
        "ugc_care_coverage_year",
        "details",
        "source_url",
        "page",
        "crawled_at",
        "source",
    ]
    with (INDIA_DIR / "ugc-care-journals.csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)

    subjects = {}
    for rec in records:
        subject = rec.get("subject") or "Unclassified"
        subjects[subject] = subjects.get(subject, 0) + 1

    compact = {
        "source": "UGC-CARE List",
        "country": "IN",
        "last_updated": datetime.now(timezone.utc).date().isoformat(),
        "records": records,
        "subjects": [{"name": k, "count": v} for k, v in sorted(subjects.items())],
    }
    (DATA_DIR / "india.json").write_text(json.dumps(compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    (INDIA_DIR / "source-notes.md").write_text(
        "# India UGC-CARE journal sources\n\n"
        f"Generated: {datetime.now(timezone.utc).isoformat()}\n\n"
        "- Main data file: `ugc-care-journals.raw.json`\n"
        "- Site data file: `../../data/india.json`\n"
        "- Fields captured: journal title, publisher, ISSN, E-ISSN, subject/category, source URL, PDF page, crawl date.\n"
        "- Positive UGC-CARE journal list only. Cloned / fake journal warning lists are intentionally excluded from the website UI.\n"
        "- Official UGC-CARE site notice says the centralized list has not been updated since October 2024 and will not be updated further per the UGC Public Notice dated February 11, 2025.\n",
        encoding="utf-8",
    )


def main() -> int:
    if not PDF_PATH.exists():
        raise SystemExit(f"Missing source PDF: {PDF_PATH}")
    records = extract_pdf_records(PDF_PATH)
    write_outputs(records)
    print(f"India UGC-CARE records: {len(records)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
