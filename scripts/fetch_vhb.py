#!/usr/bin/env python3
"""Fetch and parse public VHB Rating 2024 area PDFs."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import fitz


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "sources"
DEFAULT_OUTPUT = ROOT / "data" / "vhb_journals.json"
AREA_INDEX = "https://www.vhbonline.org/en/services/vhb-rating-2024/area-ratings"
EXPECTED_AREAS = 18

ISSN_RE = re.compile(r"\b(\d{4})-?(\d{3}[\dXx])\b")
RATING_RE = re.compile(r"^(A\+|A|B|C|D)$")


class LinkParser(HTMLParser):
    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.links: list[tuple[str, str]] = []
        self._href = ""
        self._text: list[str] = []
        self._in_a = False

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._in_a = True
            self._href = dict(attrs).get("href", "")
            self._text = []

    def handle_data(self, data):
        if self._in_a:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._in_a:
            text = re.sub(r"\s+", " ", "".join(self._text)).strip()
            self.links.append((text, urljoin(self.base_url, self._href)))
            self._in_a = False


def fetch_text(url: str) -> str:
    req = Request(url, headers={"User-Agent": "ailatest-journal/1.0"})
    with urlopen(req, timeout=45) as response:
        return response.read().decode("utf-8", "replace")


def discover_area_pages() -> list[dict]:
    html = fetch_text(AREA_INDEX)
    parser = LinkParser(AREA_INDEX)
    parser.feed(html)
    areas = []
    seen = set()
    for text, href in parser.links:
        if not text.startswith("VHB Rating 2024 - "):
            continue
        area = text.replace("VHB Rating 2024 - ", "").strip()
        if href in seen:
            continue
        seen.add(href)
        areas.append({"area": area, "area_page": href})
    if len(areas) != EXPECTED_AREAS:
        raise SystemExit(f"Expected {EXPECTED_AREAS} VHB area pages, found {len(areas)}")
    return areas


def discover_pdf(area_page: str) -> str:
    html = fetch_text(area_page)
    parser = LinkParser(area_page)
    parser.feed(html)
    pdfs = [href for text, href in parser.links if href.lower().endswith(".pdf") and "vhb" in href.lower()]
    if not pdfs:
        raise SystemExit(f"No VHB PDF found on {area_page}")
    return pdfs[0]


def download(url: str, path: Path) -> None:
    if path.exists() and path.stat().st_size > 0:
        return
    req = Request(url, headers={"User-Agent": "ailatest-journal/1.0"})
    with urlopen(req, timeout=90) as response:
        path.write_bytes(response.read())


def clean_issn(value: str) -> str:
    match = ISSN_RE.search(value or "")
    return f"{match.group(1)}-{match.group(2).upper()}" if match else ""


def is_noise(line: str) -> bool:
    return (
        not line
        or line.startswith("VHB Publication Media Rating")
        or line in {"Section", "Type of publication", "Criterion", "Scientific journals", "Scientific quality"}
        or line.startswith("Title ISSN Rating")
        or line.startswith("© Verband")
        or line.startswith("Version:")
        or line.startswith("Page ")
    )


def parse_pdf(path: Path, area: str, area_code: str, source_url: str) -> list[dict]:
    records: list[dict] = []
    pending_title: list[str] = []
    doc = fitz.open(path)
    lines: list[str] = []
    for page in doc:
        for raw in page.get_text("text").splitlines():
            line = re.sub(r"\s+", " ", raw).strip()
            if not is_noise(line):
                lines.append(line)

    i = 0
    while i < len(lines):
        line = lines[i]
        issn = clean_issn(line)
        if not issn:
            pending_title.append(line)
            i += 1
            continue
        title = " ".join(pending_title).strip()
        pending_title = []
        if not title or i + 3 >= len(lines):
            i += 1
            continue
        rating = lines[i + 1].strip()
        votes_text = lines[i + 2].strip()
        if not RATING_RE.match(rating) or not votes_text.isdigit():
            i += 1
            continue
        publisher_parts: list[str] = []
        j = i + 3
        while j < len(lines) and lines[j] != "Link":
            publisher_parts.append(lines[j])
            j += 1
        if j >= len(lines):
            break
        publisher = " ".join(publisher_parts).strip()
        votes = int(votes_text)
        if title:
            records.append(
                {
                    "title": title,
                    "issn": issn,
                    "rating": rating,
                    "votes_ge_rating_percent": votes,
                    "publisher": publisher,
                    "area": area,
                    "area_code": area_code,
                    "source_url": source_url,
                }
            )
        i = j + 1
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    SOURCES.mkdir(parents=True, exist_ok=True)
    areas = discover_area_pages()
    all_records: list[dict] = []
    area_meta = []
    for area in areas:
        pdf_url = discover_pdf(area["area_page"])
        code_match = re.search(r"Area_rating_([A-Z-]+)\.pdf", pdf_url)
        area_code = code_match.group(1) if code_match else re.sub(r"[^A-Z0-9]+", "_", area["area"].upper()).strip("_")
        pdf_path = SOURCES / f"vhb_2024_{area_code}.pdf"
        download(pdf_url, pdf_path)
        records = parse_pdf(pdf_path, area["area"], area_code, pdf_url)
        if not records:
            raise SystemExit(f"No records parsed from {pdf_url}")
        all_records.extend(records)
        area_meta.append({**area, "area_code": area_code, "pdf_url": pdf_url, "count": len(records)})
        print(f"{area_code}: {len(records)} records")

    by_issn: dict[str, list[dict]] = {}
    for record in all_records:
        if record["issn"]:
            by_issn.setdefault(record["issn"], []).append(record)

    payload = {
        "source": "VHB Publication Media Rating 2024",
        "source_url": AREA_INDEX,
        "year": 2024,
        "fetched_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "area_count": len(area_meta),
        "count": len(all_records),
        "unique_issn_count": len(by_issn),
        "areas": area_meta,
        "records": all_records,
        "by_issn": by_issn,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(all_records)} VHB area ratings ({len(by_issn)} unique ISSNs) to {args.output}")


if __name__ == "__main__":
    main()
