#!/usr/bin/env python3
"""Fetch FMS 2025 journal ratings from the public FMS website."""
from __future__ import annotations

import html
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "fms_journals.json"
BASE = "https://www.fms-journal.net"
YEAR = "2025"


def clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value or "")
    return html.unescape(value).replace("\xa0", " ").strip()


def clean_issn(value: str) -> str:
    value = str(value or "").strip().upper()
    m = re.search(r"\b(\d{4})-?(\d{3}[\dX])\b", value)
    return f"{m.group(1)}-{m.group(2)}" if m else ""


def fetch(path: str, params: dict) -> str:
    url = f"{BASE}{path}?{urlencode(params)}"
    req = Request(url, headers={"User-Agent": "AILatest Journal data builder/1.0"})
    with urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8", "replace")


def parse_rows(doc: str) -> list[list[str]]:
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", doc, flags=re.I | re.S):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.I | re.S)
        cells = [clean_text(c) for c in cells]
        if cells and cells[0].isdigit():
            rows.append(cells)
    return rows


def last_page(doc: str) -> int:
    pages = [int(x) for x in re.findall(r"(?:[?&]|&amp;)page=(\d+)", doc)]
    return max(pages) if pages else 0


def fetch_international() -> list[dict]:
    first = fetch("/journals", {"lang": "en_us", "num": 20})
    total_pages = last_page(first)
    out = []
    for page in range(total_pages + 1):
        doc = first if page == 0 else fetch("/journals", {"lang": "en_us", "num": 20, "page": page})
        for cells in parse_rows(doc):
            if len(cells) < 8:
                continue
            out.append({
                "type": "international",
                "year": YEAR,
                "order": int(cells[0]),
                "issn": clean_issn(cells[1]),
                "discipline": cells[2],
                "name": cells[3],
                "tier": cells[4],
                "jcr_rank": cells[5],
                "sjr_rank": cells[6],
                "snip_rank": cells[7],
                "source": "FMS管理科学高质量期刊推荐列表2025",
                "source_url": f"{BASE}/journals?lang=en_us",
            })
        time.sleep(0.15)
    return out


def fetch_chinese() -> list[dict]:
    first = fetch("/journals_cn", {"lang": "zh_cn", "num": 20})
    total_pages = last_page(first)
    out = []
    for page in range(total_pages + 1):
        doc = first if page == 0 else fetch("/journals_cn", {"lang": "zh_cn", "num": 20, "page": page})
        for cells in parse_rows(doc):
            if len(cells) < 5:
                continue
            out.append({
                "type": "chinese",
                "year": YEAR,
                "order": int(cells[0]),
                "issn": clean_issn(cells[1]),
                "name": cells[2],
                "tier": cells[3],
                "sponsor": cells[4],
                "source": "FMS管理科学高质量期刊推荐列表2025",
                "source_url": f"{BASE}/journals_cn?lang=zh_cn",
            })
        time.sleep(0.15)
    return out


def main() -> None:
    intl = fetch_international()
    cn = fetch_chinese()
    payload = {
        "source": "FMS管理科学高质量期刊推荐列表2025",
        "source_url": "https://www.fms-journal.net/",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "year": YEAR,
        "records": intl + cn,
        "stats": {"international": len(intl), "chinese": len(cn)},
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} international={len(intl)} chinese={len(cn)} total={len(payload['records'])}")


if __name__ == "__main__":
    main()
