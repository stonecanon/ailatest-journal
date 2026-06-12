#!/usr/bin/env python3
"""Parse the 2026 SCD catalogue PDF into data/scd_journals.json."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "data" / "sources" / "scd_2026.pdf"
DEFAULT_OUTPUT = ROOT / "data" / "scd_journals.json"
SOURCE_URL = "https://kyc.cdisu.edu.cn/media/118070/134182906842124784.pdf"
EXPECTED_COUNT = 2385

ISSN_RE = re.compile(r"^(\d{4})-([\dXx]{4})$")
CN_RE = re.compile(r"^\d{2}-[0-9A-Za-z./-]+$")
SCD_CATEGORIES = {
    "理学",
    "工学",
    "农学",
    "医学",
    "哲学",
    "法学",
    "教育学",
    "文学",
    "历史学",
    "管理学",
    "经济学",
    "艺术学",
    "综合",
}


def is_newly_added(text: str) -> bool:
    return "新" in text and "入选" in text


def extract_lines(path: Path) -> list[str]:
    lines: list[str] = []
    doc = fitz.open(path)
    for page in doc:
        for line in page.get_text("text").splitlines():
            text = line.strip()
            if text:
                lines.append(text)
    return lines


def parse_pdf(path: Path) -> list[dict]:
    lines = extract_lines(path)
    records: list[dict] = []
    i = 0
    expected = 1
    last_category = ""

    while i < len(lines) and expected <= EXPECTED_COUNT:
        if lines[i] != str(expected):
            i += 1
            continue

        order = expected
        i += 1

        if i >= len(lines):
            break
        if lines[i] in SCD_CATEGORIES:
            category = lines[i]
            last_category = category
            i += 1
        else:
            category = last_category

        name_parts: list[str] = []
        while (
            i < len(lines)
            and lines[i] != str(expected + 1)
            and not ISSN_RE.match(lines[i])
            and not CN_RE.match(lines[i])
            and not is_newly_added(lines[i])
        ):
            name_parts.append(lines[i])
            i += 1

        issn = ""
        cn_code = ""
        if i < len(lines) and ISSN_RE.match(lines[i]):
            issn = lines[i].upper()
            i += 1
        if i < len(lines) and CN_RE.match(lines[i]) and lines[i] != str(expected + 1):
            cn_code = lines[i]
            i += 1

        trailing: list[str] = []
        while i < len(lines) and lines[i] != str(expected + 1):
            text = lines[i]
            if text not in {"序号", "分类", "刊名", "ISSN", "CN", "是否为新入选", "备注"} and not text.startswith(
                "2026年SCD"
            ):
                trailing.append(text)
            i += 1

        records.append(
            {
                "order": order,
                "category": category,
                "name": "".join(name_parts).strip(),
                "issn": issn,
                "cn_code": cn_code,
                "newly_added": any(is_newly_added(text) for text in trailing),
                "remarks": [text for text in trailing if not is_newly_added(text)],
            }
        )
        expected += 1

    if len(records) != EXPECTED_COUNT:
        raise SystemExit(f"Expected {EXPECTED_COUNT} SCD records, parsed {len(records)}")
    empty_names = [r["order"] for r in records if not r["name"]]
    if empty_names:
        raise SystemExit(f"SCD rows with empty names: {empty_names[:10]}")
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    records = parse_pdf(args.pdf)
    by_issn: dict[str, list[dict]] = {}
    for record in records:
        if record["issn"]:
            by_issn.setdefault(record["issn"], []).append(record)

    payload = {
        "source": "SCD目录《科学引文数据库》",
        "source_url": SOURCE_URL,
        "year": 2026,
        "fetched_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "count": len(records),
        "counts": {
            "with_issn": sum(1 for r in records if r["issn"]),
            "without_issn": sum(1 for r in records if not r["issn"]),
            "newly_added": sum(1 for r in records if r["newly_added"]),
        },
        "records": records,
        "by_issn": by_issn,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Wrote {len(records)} SCD records to {args.output} "
        f"(with ISSN={payload['counts']['with_issn']}, newly_added={payload['counts']['newly_added']})"
    )


if __name__ == "__main__":
    main()
