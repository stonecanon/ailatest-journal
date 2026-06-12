#!/usr/bin/env python3
"""Parse AMI 2022 old-journal rankings from the CASS preview PDF."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "data" / "sources" / "ami_2022_preview.pdf"
DEFAULT_OUTPUT = ROOT / "data" / "ami_journals.json"
SOURCE_URL = "https://journals.xmu.edu.cn/2022nianzhongguorenwenshehuikexueqikanpingjiajieguogongshiban-20230112.pdf"
YEAR = 2022
OLD_JOURNAL_START_PAGE = 22  # zero-based PDF page index; report page 18.
OLD_JOURNAL_END_PAGE = 84
EXPECTED_COUNTS = {"顶级": 22, "权威": 55, "核心": 605, "扩展": 779, "入库": 463}
LEVELS = tuple(EXPECTED_COUNTS)
SECTION_RE = re.compile(r"^（[\u4e00-\u9fa5]+）(.+)$")
TITLE_RIGHT = 240.0
TITLE_FIXES = {
    "外国语文研究华（六）文学.中国文学": "外国语文研究",
    "外国语文研究华": "外国语文研究",
    "外国语（上海外国语大学报）": "外国语（上海外国语大学学报）",
}


def level_of_span(span: dict) -> str:
    text = span.get("text", "").strip()
    if text in LEVELS and span["bbox"][0] > 430:
        return text
    for level in LEVELS:
        if text.endswith(level) and span["bbox"][2] > 300 and len(text) > len(level):
            return level
    return ""


def title_fragment(span: dict) -> str:
    text = span.get("text", "")
    x0, _y0, x1, _y1 = span["bbox"]
    raw = text.strip()
    if not raw or raw in LEVELS or raw in {"序号刊名", "主办单位", "等级"} or raw.isdigit():
        return ""
    raw = re.sub(r"^\d+\s*", "", raw)
    if not raw or x0 < 80 or x0 > TITLE_RIGHT:
        return ""
    if x1 <= TITLE_RIGHT:
        return raw

    width = (x1 - x0) / max(len(text), 1)
    end = max(0, min(len(text), int((TITLE_RIGHT - x0 + width - 0.001) // width)))
    return re.sub(r"^\d+\s*", "", text[:end]).strip()


def title_in_band(lines: list[dict], y0: float, y1: float) -> str:
    pieces: list[tuple[float, str]] = []
    for line in lines:
        ly = (line["bbox"][1] + line["bbox"][3]) / 2
        if not (y0 <= ly < y1):
            continue
        line_text = "".join(span.get("text", "") for span in line.get("spans", [])).strip()
        if SECTION_RE.match(line_text):
            continue
        line_parts: list[tuple[float, str]] = []
        for span in line.get("spans", []):
            if span["bbox"][0] <= TITLE_RIGHT and span["bbox"][2] >= 95:
                fragment = title_fragment(span)
                if fragment:
                    line_parts.append((span["bbox"][0], fragment))
        if line_parts:
            pieces.append((ly, "".join(fragment for _x, fragment in sorted(line_parts))))
    name = re.sub(r"\s+", "", "".join(text for _y, text in sorted(pieces)))
    return TITLE_FIXES.get(name, name)


def parse_pdf(path: Path) -> list[dict]:
    doc = fitz.open(path)
    current_discipline = ""
    records: list[dict] = []

    for page_index in range(OLD_JOURNAL_START_PAGE, OLD_JOURNAL_END_PAGE + 1):
        page = doc.load_page(page_index)
        page_dict = page.get_text("dict")
        lines: list[dict] = []
        headings: list[tuple[float, str]] = []
        levels: list[tuple[float, str]] = []

        for block in page_dict["blocks"]:
            for line in block.get("lines", []):
                lines.append(line)
                line_text = "".join(span.get("text", "") for span in line.get("spans", [])).strip()
                match = SECTION_RE.match(line_text)
                if match:
                    discipline = match.group(1).strip()
                    if not any(skip in discipline for skip in ("指标", "说明", "名单", "数据", "采集")):
                        headings.append(((line["bbox"][1] + line["bbox"][3]) / 2, discipline))
                for span in line.get("spans", []):
                    level = level_of_span(span)
                    if level:
                        levels.append(((span["bbox"][1] + span["bbox"][3]) / 2, level))

        headings.sort()
        levels = sorted(set(levels))
        for idx, (y, tier) in enumerate(levels):
            for heading_y, discipline in headings:
                if heading_y < y:
                    current_discipline = discipline
            prev_y = levels[idx - 1][0] if idx else y - 18
            next_y = levels[idx + 1][0] if idx + 1 < len(levels) else y + 18
            name = title_in_band(lines, (prev_y + y) / 2, (y + next_y) / 2)
            if not name:
                continue
            records.append(
                {
                    "name": name,
                    "discipline": current_discipline,
                    "tier": tier,
                    "year": YEAR,
                    "page": page_index + 1,
                }
            )

    counts = Counter(record["tier"] for record in records)
    if dict(counts) != EXPECTED_COUNTS:
        raise SystemExit(f"AMI tier count mismatch: parsed {dict(counts)}, expected {EXPECTED_COUNTS}")
    if any(not record["discipline"] for record in records):
        raise SystemExit("AMI rows with empty discipline")
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    records = parse_pdf(args.pdf)
    counts = Counter(record["tier"] for record in records)
    payload = {
        "source": "中国人文社会科学期刊AMI综合评价报告（2022年）预公布版",
        "source_url": SOURCE_URL,
        "publisher": "中国社会科学评价研究院",
        "year": YEAR,
        "scope": "old_journals",
        "fetched_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "count": len(records),
        "counts": dict(counts),
        "records": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} AMI records to {args.output}: {dict(counts)}")


if __name__ == "__main__":
    main()
