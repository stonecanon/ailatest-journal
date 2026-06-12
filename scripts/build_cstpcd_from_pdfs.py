#!/usr/bin/env python3
"""Parse 2025 Chinese Science and Technology Core Journals PDFs."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "cstpcd_journals.json"
CORE_URL = "https://www.chinagp.net/attached/file/20260120/20260120113650_728.pdf"
POPULAR_URL = "https://lib.bjut.edu.cn/fj/hexinqikandaohang/2025zgkjhxqk-kepu.pdf"


def extract_lines(path: Path) -> list[str]:
    reader = PdfReader(str(path))
    lines: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        lines.extend(line.strip() for line in text.splitlines() if line.strip())
    return lines


def is_noise(line: str) -> bool:
    return (
        line.startswith("序号 ")
        or "中国科学技术信息研究所" in line
        or "中国科技核心期刊目录" in line
        or line in {"（科普卷）"}
    )


def parse_pdf(path: Path, kind: str, source_url: str) -> list[dict]:
    records: list[dict] = []
    # Codes are letter-heavy source codes such as S929, SC02, T10001, P11006.
    row_re = re.compile(r"^(\d+)\s+([A-Z]{1,3}\d{2,5})\s+(.+?)\s*$")
    for raw in extract_lines(path):
        line = raw.strip()
        if not line or is_noise(line):
            continue
        match = row_re.match(line)
        if match:
            records.append(
                {
                    "order": int(match.group(1)),
                    "code": match.group(2),
                    "name": match.group(3).strip(),
                    "kind": kind,
                    "source_url": source_url,
                }
            )
            continue
        # A few English titles wrap to the next PDF text line. Append the fragment.
        if records and re.search(r"[A-Z]", line) and not re.match(r"^\d+/", line):
            records[-1]["name"] = f"{records[-1]['name']} {line}".strip()
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--core-pdf", type=Path, required=True)
    parser.add_argument("--popular-pdf", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    core_records = parse_pdf(args.core_pdf, "core", CORE_URL)
    popular_records = parse_pdf(args.popular_pdf, "popular_science", POPULAR_URL)
    records = core_records + popular_records

    payload = {
        "source": "中国科技核心期刊目录",
        "publisher": "中国科学技术信息研究所",
        "released_at": "2025-10-30",
        "fetched_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "core_source_url": CORE_URL,
        "popular_science_source_url": POPULAR_URL,
        "count": len(records),
        "counts": {
            "core": len(core_records),
            "popular_science": len(popular_records),
        },
        "records": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} CSTPCD records: core={len(core_records)}, popular_science={len(popular_records)}")


if __name__ == "__main__":
    main()
