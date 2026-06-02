#!/usr/bin/env python3
"""Extract management journal lists from local PDFs into small JSON sources."""
from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader

try:
    import openpyxl
except ImportError:  # pragma: no cover
    openpyxl = None


ROOT = Path(__file__).resolve().parent.parent
LIST_DIR = ROOT / "list"
DATA_DIR = ROOT / "data"


def norm_title(s: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "", (s or "").upper())


def pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def find_pdf(name: str) -> Path:
    p = LIST_DIR / name
    if not p.exists():
        raise FileNotFoundError(p)
    return p


def parse_numbered_lines(path: Path, source: str, source_url: str = "") -> list[dict]:
    records = []
    for line in pdf_text(path).splitlines():
        m = re.match(r"^\s*(\d+)\.\s*(.+?)\s*$", line)
        if not m:
            continue
        order = int(m.group(1))
        title = m.group(2).strip()
        title = re.sub(r"\s*\*\s*$", "", title).strip()
        subject = ""
        sm = re.search(r"\(([^()]*)\)\s*$", title)
        if sm:
            subject = sm.group(1).strip()
            title = title[: sm.start()].strip()
        records.append({
            "order": order,
            "name": title,
            "subject": subject,
            "source": source,
            "source_file": path.name,
            "source_url": source_url,
        })
    return records


def parse_ft50() -> dict:
    path = find_pdf("FT50.pdf")
    records = parse_numbered_lines(
        path,
        "Financial Times Top 50 Journals",
        "https://www.ft.com/content/3405a512-5cbb-11e1-8f1f-00144feabdc0",
    )
    return {"source": "Financial Times Top 50 Journals", "count": len(records), "records": records}


def parse_utd24() -> dict:
    path = find_pdf("UTD24.pdf")
    lines = pdf_text(path).splitlines()
    records = []
    pending = ""
    for line in lines:
        if pending:
            line = pending + " " + line.strip()
            pending = ""
        if re.match(r"^\s*17\.", line) and not line.rstrip().endswith(")"):
            pending = line.strip()
            continue
        m = re.match(r"^\s*(\d+)\.\s*(.+?)\s*$", line)
        if not m:
            continue
        order = int(m.group(1))
        title = re.sub(r"\s*\*\s*", " ", m.group(2)).strip()
        subject = ""
        sm = re.search(r"\(([^()]*)\)\s*$", title)
        if sm:
            subject = sm.group(1).strip()
            title = title[: sm.start()].strip()
        records.append({
            "order": order,
            "name": title,
            "subject": subject,
            "source": "UT Dallas Top 24 Business Journals",
            "source_file": path.name,
            "source_url": "https://jsom.utdallas.edu/the-utd-top-100-business-school-research-rankings/",
        })
    return {"source": "UT Dallas Top 24 Business Journals", "count": len(records), "records": records}


def parse_nsfc_file(path: Path, tier: str) -> list[dict]:
    text = pdf_text(path).replace("\n", " ")
    records = []
    for m in re.finditer(r"(\d+)\.\s*([^（(]+?)(?:[（(]([^）)]*)[）)])?(?=\s*\d+\.|$)", text):
        name = m.group(2).strip()
        if not name:
            continue
        records.append({
            "order": int(m.group(1)),
            "name": name,
            "tier": tier,
            "frequency": (m.group(3) or "").strip(),
            "source": "NSFC Management Science Department Journal List",
            "source_file": path.name,
        })
    return records


def parse_nsfc_management() -> dict:
    a_path = find_pdf("国家自然科学基金委管理科学部A类期刊目录.pdf")
    b_path = find_pdf("国家自然科学基金委管理科学部B类期刊目录.pdf")
    records = parse_nsfc_file(a_path, "A") + parse_nsfc_file(b_path, "B")
    return {
        "source": "国家自然科学基金委管理科学部期刊目录",
        "count": len(records),
        "records": records,
    }


def parse_abs_pdf() -> dict[str, str]:
    path = find_pdf("ABS2024.pdf")
    out = {}
    valid = {"4*", "4", "3", "2", "1"}
    for line in pdf_text(path).splitlines():
        m = re.match(r"^\s*(.+?)\s+(4\*|[1-4])\s*$", line)
        if not m:
            continue
        title = m.group(1).strip()
        rating = m.group(2).strip()
        if title and rating in valid:
            out[norm_title(title)] = rating
    return out


def parse_abs_xlsx() -> dict[str, str]:
    if openpyxl is None:
        return {}
    candidates = sorted(LIST_DIR.glob("Academic Journal Guide 2024*.xlsx")) + sorted(LIST_DIR.glob("AJG*2024*.xlsx"))
    if not candidates:
        return {}
    wb = openpyxl.load_workbook(candidates[0], read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    headers = []
    for raw in rows:
        vals = [str(v).strip() if v is not None else "" for v in raw]
        joined = " ".join(vals).lower()
        if ("title" in joined or "ttitle" in joined) and ("ajg" in joined or "rating" in joined):
            headers = vals
            break
    if not headers:
        return {}

    def find_idx(*names: str) -> int:
        wanted = {n.lower() for n in names}
        for i, h in enumerate(headers):
            if h.strip().lower() in wanted:
                return i
        return -1

    i_title = find_idx("title", "ttitle", "journal title", "journal")
    i_rate = find_idx("ajg_2024", "ajg 2024", "ajg2024", "rating", "rank", "2024 rating")
    if i_title < 0 or i_rate < 0:
        return {}
    out = {}
    for raw in rows:
        title = "" if i_title >= len(raw) or raw[i_title] is None else str(raw[i_title]).strip()
        rating = "" if i_rate >= len(raw) or raw[i_rate] is None else str(raw[i_rate]).strip()
        rating = rating.replace("★", "*")
        if title and rating:
            try:
                f = float(rating)
                if f.is_integer():
                    rating = str(int(f))
            except Exception:
                pass
            out[norm_title(title)] = rating
    return out


def build_abs_check() -> dict:
    pdf = parse_abs_pdf()
    xlsx = parse_abs_xlsx()
    missing_in_xlsx = sorted(set(pdf) - set(xlsx))
    missing_in_pdf = sorted(set(xlsx) - set(pdf))
    rating_mismatch = sorted(
        {"title_key": k, "pdf": pdf[k], "xlsx": xlsx[k]}
        for k in set(pdf) & set(xlsx)
        if pdf[k] != xlsx[k]
    )
    return {
        "source": "ABS2024.pdf vs Academic Journal Guide 2024 Excel",
        "pdf_count": len(pdf),
        "xlsx_count": len(xlsx),
        "matched_count": len(set(pdf) & set(xlsx)),
        "missing_in_xlsx_count": len(missing_in_xlsx),
        "missing_in_pdf_count": len(missing_in_pdf),
        "rating_mismatch_count": len(rating_mismatch),
        "missing_in_xlsx": missing_in_xlsx[:200],
        "missing_in_pdf": missing_in_pdf[:200],
        "rating_mismatch": rating_mismatch[:200],
    }


def main() -> None:
    outputs = {
        DATA_DIR / "ft50.json": parse_ft50(),
        DATA_DIR / "utd24.json": parse_utd24(),
        DATA_DIR / "nsfc_management.json": parse_nsfc_management(),
        DATA_DIR / "abs2024_check.json": build_abs_check(),
    }
    for path, data in outputs.items():
        write_json(path, data)
        print(f"{path.relative_to(ROOT)}: {data.get('count', data.get('pdf_count', 0))}")


if __name__ == "__main__":
    main()
