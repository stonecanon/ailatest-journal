#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin

import requests
from lxml import html
from requests import Response


BASE_URL = "https://www.oaj.com.cn"
SEARCH_URL = f"{BASE_URL}/simplesearch?field=1"
OUT_JSON = Path("list/oaj_journals.json")
OUT_CSV = Path("list/oaj_journals.csv")
OUT_XLSX = Path("list/oaj_journals.xlsx")


FIELDS = [
    "title",
    "url",
    "issn",
    "eissn",
    "publisher",
    "language",
    "country",
    "oa_type",
    "positioning",
    "partition",
    "source",
    "source_url",
    "page",
    "fetched_at",
]


def clean(value: str | None) -> str:
    if value is None:
        return ""
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s*\|\s*$", "", value)
    return "" if value == "/" else value


def text_content(node) -> str:
    return clean(" ".join(node.itertext()))


def following_text(label) -> str:
    parts: list[str] = []
    tail = label.tail
    if tail:
        parts.append(tail)
    for sibling in label.itersiblings():
        if sibling.tag == "label":
            break
        parts.append(text_content(sibling))
        if sibling.tail:
            parts.append(sibling.tail)
    return clean(" ".join(parts).strip(" ：|"))


def extract_labeled_fields(item) -> dict[str, str]:
    values: dict[str, str] = {}
    for label in item.xpath('.//label[contains(@class, "text-label")]'):
        key = clean(text_content(label).replace("：", ""))
        if not key:
            continue
        value = following_text(label)
        if value:
            values[key] = value
    return values


def extract_items(markup: bytes, page: int, fetched_at: str) -> list[dict[str, str]]:
    doc = html.fromstring(markup)
    records: list[dict[str, str]] = []
    for item in doc.xpath('//div[contains(@class, "search-result-item")]'):
        link = item.xpath('.//h5//a')[0]
        labels = extract_labeled_fields(item)
        record = {
            "title": clean(text_content(link)),
            "url": urljoin(BASE_URL, link.get("href")),
            "issn": labels.get("ISSN", ""),
            "eissn": labels.get("EISSN", ""),
            "publisher": labels.get("出版机构", ""),
            "language": labels.get("期刊语种", ""),
            "country": labels.get("出版地", ""),
            "oa_type": labels.get("OA类型", ""),
            "positioning": labels.get("定位", ""),
            "partition": labels.get("期刊分区表分区", ""),
            "source": "OAJ",
            "source_url": SEARCH_URL,
            "page": str(page),
            "fetched_at": fetched_at,
        }
        records.append(record)
    return records


def get_total_pages(markup: bytes) -> int:
    doc = html.fromstring(markup)
    text = text_content(doc)
    match = re.search(r"第\s*\d+\s*/\s*(\d+)\s*页", text)
    if not match:
        raise RuntimeError("Could not detect total pages from OAJ pagination.")
    return int(match.group(1))


def dedupe(records: Iterable[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, str, str]] = set()
    unique: list[dict[str, str]] = []
    for record in records:
        key = (record["title"].casefold(), record["issn"], record["eissn"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(record)
    return unique


def get_with_retries(session: requests.Session, url: str, attempts: int = 4) -> Response:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            response = session.get(url, timeout=45)
            response.raise_for_status()
            return response
        except requests.RequestException as error:
            last_error = error
            if attempt == attempts:
                break
            time.sleep(1.5 * attempt)
    raise RuntimeError(f"Failed to fetch {url}") from last_error


def main() -> None:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "ailatest-journal-data-refresh/1.0 (+https://journal.ailatest.org)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
    )

    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    first = get_with_retries(session, SEARCH_URL)
    total_pages = get_total_pages(first.content)

    records = extract_items(first.content, 1, fetched_at)
    for page in range(2, total_pages + 1):
        url = f"{SEARCH_URL}&pagenum={page}"
        response = get_with_retries(session, url)
        page_records = extract_items(response.content, page, fetched_at)
        if not page_records:
            raise RuntimeError(f"No records parsed on page {page}.")
        records.extend(page_records)
        time.sleep(0.15)

    records = dedupe(records)
    OUT_JSON.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with OUT_CSV.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(records)
    xlsx_written = False
    try:
        import pandas as pd

        pd.DataFrame(records, columns=FIELDS).to_excel(OUT_XLSX, index=False)
        xlsx_written = True
    except ImportError:
        pass

    print(f"OAJ pages: {total_pages}")
    print(f"OAJ journals: {len(records)}")
    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_CSV}")
    if xlsx_written:
        print(f"Wrote {OUT_XLSX}")


if __name__ == "__main__":
    main()
