#!/usr/bin/env python3
"""Build independent regional journal directories from their official sources.

This intentionally does not derive a directory from the global journal dataset.
The global dataset is used only to attach optional cross-database metadata by ISSN.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import gzip
import http.cookiejar
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "regional"
USER_AGENT = "AILatest-Journal-Directory-Builder/1.0"


def request(url: str, *, data: bytes | None = None, opener=None, timeout: int = 60) -> bytes:
    req = urllib.request.Request(
        url,
        data=data,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/html,*/*"},
    )
    open_request = opener.open if opener is not None else urllib.request.urlopen
    with open_request(req, timeout=timeout) as response:
        return response.read()


def normalize_issn(value: object) -> str:
    compact = re.sub(r"[^0-9Xx]", "", str(value or "")).upper()
    return f"{compact[:4]}-{compact[4:]}" if len(compact) == 8 else ""


def load_global_lookup() -> dict[str, dict]:
    path = ROOT / "data" / "journals.json.gz"
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        rows = json.load(handle)
    lookup: dict[str, dict] = {}
    for row in rows:
        for value in (row.get("issn"), row.get("eissn")):
            key = normalize_issn(value)
            if key and key not in lookup:
                lookup[key] = row
    return lookup


def enrich(record: dict, lookup: dict[str, dict]) -> dict:
    hit = None
    for value in (record.get("issn"), record.get("eissn")):
        hit = lookup.get(normalize_issn(value))
        if hit:
            break
    if not hit:
        record["global_match"] = False
        return record
    record.update(
        {
            "global_match": True,
            "global_slug": hit.get("slug", ""),
            "global_name": hit.get("name", ""),
            "global_country": hit.get("country", ""),
            "indices": hit.get("indices", []),
            "if_2025": hit.get("if_2025", hit.get("if_latest", "")),
            "cas_zone": hit.get("cas_zone", ""),
            "scopus": bool(hit.get("scopus")),
            "doaj": bool(hit.get("doaj")),
            "inspec": bool(hit.get("inspec")),
            "fsta_full_text": bool(hit.get("fsta_full_text")),
        }
    )
    return record


def write_source(source: str, payload: dict) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"{source}.json.gz"
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    return path


def build_pbn(lookup: dict[str, dict]) -> dict:
    base = "https://pbn.nauka.gov.pl/journals-api"
    years = json.loads(request(f"{base}/journals/filters").decode("utf-8"))
    year = max(int(value) for value in years)

    def page_url(page: int) -> str:
        query = urllib.parse.urlencode(
            {"page": page, "size": 100, "sortBy": "title", "order": "ASC", "year": year}
        )
        return f"{base}/journals?{query}"

    first = json.loads(request(page_url(0)).decode("utf-8"))
    pages = int(first.get("totalPages") or 1)
    page_rows: dict[int, list] = {0: first.get("content") or []}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {
            pool.submit(lambda url=page_url(page): json.loads(request(url).decode("utf-8"))): page
            for page in range(1, pages)
        }
        for future in concurrent.futures.as_completed(futures):
            page = futures[future]
            page_rows[page] = future.result().get("content") or []
    records = []
    for page in range(pages):
        for row in page_rows.get(page, []):
            record = {
                "name": str(row.get("title") or "").strip(),
                "issn": normalize_issn(row.get("issn")),
                "eissn": normalize_issn(row.get("eissn")),
                "points": row.get("points"),
                "ministry_id": row.get("ministryId"),
                "source_url": urllib.parse.urljoin("https://pbn.nauka.gov.pl", row.get("url") or ""),
            }
            if record["name"]:
                records.append(enrich(record, lookup))
    return {
        "source": "PBN / POL-on",
        "source_url": "https://pbn.nauka.gov.pl/journals/",
        "directory_year": year,
        "records": records,
    }


class HiddenInputParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.values: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() != "input":
            return
        values = dict(attrs)
        name = values.get("name") or values.get("id")
        if name and name.startswith("__"):
            self.values[name] = values.get("value", "")


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self.row: list[str] | None = None
        self.cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag == "tr":
            self.row = []
        elif tag in {"td", "th"} and self.row is not None:
            self.cell = []

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"td", "th"} and self.cell is not None and self.row is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None


def build_isc(lookup: dict[str, dict]) -> dict:
    url = "https://mjl.isc.ac/Default.aspx?lan=en"
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    initial = request(url, opener=opener).decode("utf-8", "replace")
    hidden = HiddenInputParser()
    hidden.feed(initial)
    form = dict(hidden.values)
    form.update({"__EVENTTARGET": "ctl00$M_Allbtn", "__EVENTARGUMENT": ""})
    html = request(url, data=urllib.parse.urlencode(form).encode(), opener=opener, timeout=120).decode(
        "utf-8", "replace"
    )
    parser = TableParser()
    parser.feed(html)
    records = []
    for cells in parser.rows:
        if len(cells) < 4 or not cells[0].isdigit():
            continue
        record = {
            "name": cells[1].strip(),
            "issn": normalize_issn(cells[2]),
            "eissn": normalize_issn(cells[3]),
            "h_index": int(cells[4]) if len(cells) > 4 and cells[4].isdigit() else None,
            "source_url": url,
        }
        if record["name"]:
            records.append(enrich(record, lookup))
    return {"source": "ISC Master Journals List", "source_url": url, "records": records}


class AnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.anchors: list[dict] = []
        self.current: dict | None = None

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() == "a":
            values = dict(attrs)
            self.current = {"href": values.get("href", ""), "text": []}

    def handle_data(self, data: str) -> None:
        if self.current is not None:
            self.current["text"].append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self.current is not None:
            self.current["text"] = " ".join("".join(self.current["text"]).split())
            self.anchors.append(self.current)
            self.current = None


def build_scielo(lookup: dict[str, dict]) -> dict:
    url = "https://www.scielo.org/en/journals/list-by-alphabetical-order/"
    parser = AnchorParser()
    parser.feed(request(url).decode("utf-8", "replace"))
    records = []
    seen = set()
    for anchor in parser.anchors:
        href = anchor.get("href") or ""
        if "script=sci_serial" not in href or "pid=" not in href:
            continue
        params = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
        issn = normalize_issn((params.get("pid") or [""])[0])
        key = (issn, href)
        if key in seen:
            continue
        seen.add(key)
        record = {
            "name": anchor.get("text") or issn,
            "issn": issn,
            "eissn": "",
            "network": urllib.parse.urlparse(href).netloc,
            "source_url": href,
        }
        records.append(enrich(record, lookup))
    return {"source": "SciELO Journals", "source_url": url, "records": records}


BUILDERS = {"pbn": build_pbn, "isc": build_isc, "scielo": build_scielo}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("sources", nargs="*", choices=sorted(BUILDERS))
    args = parser.parse_args()
    lookup = load_global_lookup()
    for source in (args.sources or sorted(BUILDERS)):
        payload = BUILDERS[source](lookup)
        payload["record_count"] = len(payload["records"])
        payload["global_match_count"] = sum(bool(row.get("global_match")) for row in payload["records"])
        path = write_source(source, payload)
        print(f"{source}: {payload['record_count']:,} records, {payload['global_match_count']:,} global matches -> {path}")


if __name__ == "__main__":
    main()
