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
COVERAGE_PDF_PATH = INDIA_DIR / "ugc-care-list-2025-impactfactorforjournal.pdf"


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
    value = re.sub(r"\bE?-?ISSN\b", "", clean_text(value), flags=re.IGNORECASE).strip().upper()
    if value in {"", "NA", "N/A", "NONE"}:
        return "NA"
    compact = re.sub(r"[^0-9X]", "", value)
    if not compact:
        return "NA"
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


def science_column_profile(sr_no: int) -> dict[str, tuple[float, float]]:
    """Column boundaries used by the 6 source-table layouts in the archive PDF."""
    if sr_no <= 50:
        cuts = (100, 270, 420, 495, 568, 842)
    elif sr_no <= 150:
        cuts = (100, 330, 480, 550, 618, 842)
    elif sr_no <= 200:
        cuts = (100, 295, 475, 550, 625, 842)
    elif sr_no <= 300:
        cuts = (100, 320, 480, 528, 570, 678, 842)
    elif sr_no <= 400:
        cuts = (95, 288, 485, 530, 575, 668, 842)
    else:
        cuts = (100, 273, 480, 525, 570, 666, 842)
    names = ("journal_title", "publisher", "issn", "eissn", "ugc_care_coverage_year", "details")
    return {name: (cuts[i], cuts[i + 1]) for i, name in enumerate(names[: len(cuts) - 1])}


def extract_science_archive(pdf_path: Path) -> list[dict]:
    """Extract the complete 486-row archived Sciences table, including page continuations."""
    doc = fitz.open(pdf_path)
    records: list[dict] = []

    def cells_for(words: list[tuple], sr_no: int) -> dict[str, str]:
        cells: dict[str, list[tuple[float, float, str]]] = {
            key: [] for key in science_column_profile(sr_no)
        }
        for x0, y0, _x1, _y1, text, *_ in words:
            for key, (left, right) in science_column_profile(sr_no).items():
                if left <= x0 < right:
                    cells[key].append((y0, x0, text))
                    break
        result = {}
        for key, values in cells.items():
            values.sort(key=lambda item: (round(item[0], 1), item[1]))
            result[key] = clean_text(" ".join(item[2] for item in values))
        return result

    for page_no, page in enumerate(doc, start=1):
        words = page.get_text("words")
        starts = [
            (int(text), y0)
            for x0, y0, _x1, _y1, text, *_ in words
            if 60 <= x0 <= 100 and re.fullmatch(r"\d{1,3}", text)
        ]
        starts.sort(key=lambda item: item[1])
        if not starts:
            continue

        # A record may continue above the first serial number on the next page.
        first_lower = max(70, starts[0][1] - 20)
        if records and starts[0][1] < 150:
            continuation = [w for w in words if w[1] < first_lower and w[1] > 70]
            extra = cells_for(continuation, int(records[-1]["archive_sr_no"]))
            for key, value in extra.items():
                if value:
                    records[-1][key] = clean_text(f"{records[-1].get(key, '')} {value}")

        for index, (sr_no, y0) in enumerate(starts):
            y_lower = (starts[index - 1][1] + y0) / 2 if index else first_lower
            y_upper = (y0 + starts[index + 1][1]) / 2 if index + 1 < len(starts) else page.rect.height - 24
            row_words = [w for w in words if y_lower <= w[1] < y_upper]
            row = cells_for(row_words, sr_no)
            title = row.get("journal_title", "")
            if not title:
                continue
            coverage = row.get("ugc_care_coverage_year", "")
            details = row.get("details", "")
            combined_status = clean_text(f"{coverage} {details}")
            records.append({
                "archive_sr_no": sr_no,
                "journal_title": title,
                "publisher": row.get("publisher", ""),
                "issn": clean_issn(row.get("issn", "")),
                "eissn": clean_issn(row.get("eissn", "")),
                "subject": "Sciences",
                "category": "Sciences",
                "ugc_care_coverage_year": coverage,
                "details": details,
                "list_status": "current" if "present" in combined_status.casefold() and "discontinued" not in combined_status.casefold() else "historical",
                "source_url": "https://ugccare.unipune.ac.in/Apps1/User/WebA/DesciplinewiseList?DiscpID=2&DiscpName=Sciences",
                "source": "Archived UGC-CARE Sciences table (local PDF snapshot)",
                "source_file": pdf_path.name,
                "page": page_no,
                "crawled_at": datetime.now(timezone.utc).date().isoformat(),
            })

    by_number = {int(record["archive_sr_no"]): record for record in records}
    missing = [number for number in range(1, 487) if number not in by_number]
    if missing:
        raise ValueError(f"Science archive extraction incomplete; missing serial numbers: {missing}")
    ordered = [by_number[number] for number in range(1, 487)]
    for record in ordered:
        record["journal_title"] = clean_text(re.sub(r"\s+Journal Title(?:\s+Publisher)?$", "", record["journal_title"], flags=re.IGNORECASE))
        record["publisher"] = clean_text(re.sub(r"\s+Publisher$", "", record["publisher"], flags=re.IGNORECASE))
        record["issn"] = clean_issn(record["issn"])
        record["eissn"] = clean_issn(record["eissn"])
        record["ugc_care_coverage_year"] = clean_text(re.sub(r"\s+Coverage\s*&\s*Current\s+Status\*?$", "", record["ugc_care_coverage_year"], flags=re.IGNORECASE))
    return ordered


def normalized_title(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").casefold())


def merge_records(current: list[dict], science_archive: list[dict]) -> tuple[list[dict], int]:
    merged = [dict(record, list_status="current") for record in current]
    identifier_index: dict[str, int] = {}
    title_index: dict[str, int] = {}
    for index, record in enumerate(merged):
        for value in (record.get("issn"), record.get("eissn")):
            if value and value != "NA":
                identifier_index[value] = index
        title_index[normalized_title(record.get("journal_title", ""))] = index

    matched = 0
    for archived in science_archive:
        index = None
        for value in (archived.get("issn"), archived.get("eissn")):
            if value and value != "NA" and value in identifier_index:
                index = identifier_index[value]
                break
        if index is None:
            index = title_index.get(normalized_title(archived.get("journal_title", "")))
        if index is not None:
            matched += 1
            target = merged[index]
            target["ugc_care_coverage_year"] = archived.get("ugc_care_coverage_year", "")
            target["details"] = archived.get("details", "")
            target["archive_status"] = archived.get("list_status", "historical")
            target["archive_sr_no"] = archived.get("archive_sr_no")
            target["archive_source_url"] = archived.get("source_url")
            continue

        archived = dict(archived)
        archived["sr_no"] = f"SCI-{int(archived.pop('archive_sr_no')):03d}"
        merged.append(archived)
    return merged, matched


def write_outputs(records: list[dict], counts: dict[str, int]) -> None:
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
        "list_status",
        "archive_status",
        "archive_sr_no",
        "archive_source_url",
        "source_file",
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
        "source": "UGC-CARE Group I current directory + archived Sciences coverage table",
        "country": "IN",
        "last_updated": datetime.now(timezone.utc).date().isoformat(),
        "counts": counts,
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
        f"- Current directory rows: {counts['current_directory']}; complete Sciences archive rows: {counts['science_archive']}; matched/enriched rows: {counts['science_matches']}; merged unique rows: {counts['merged_unique']}.\n"
        "- Archived Sciences entries carry `list_status`; historical/discontinued rows are not presented as currently active entries.\n"
        "- Official UGC-CARE site notice says the centralized list has not been updated since October 2024 and will not be updated further per the UGC Public Notice dated February 11, 2025.\n",
        encoding="utf-8",
    )


def main() -> int:
    if not PDF_PATH.exists():
        raise SystemExit(f"Missing source PDF: {PDF_PATH}")
    if not COVERAGE_PDF_PATH.exists():
        raise SystemExit(f"Missing Sciences archive PDF: {COVERAGE_PDF_PATH}")
    current = extract_pdf_records(PDF_PATH)
    science_archive = extract_science_archive(COVERAGE_PDF_PATH)
    records, matches = merge_records(current, science_archive)
    counts = {
        "current_directory": len(current),
        "science_archive": len(science_archive),
        "science_matches": matches,
        "merged_unique": len(records),
        "historical_only": sum(record.get("list_status") == "historical" for record in records),
    }
    write_outputs(records, counts)
    print(json.dumps(counts, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
