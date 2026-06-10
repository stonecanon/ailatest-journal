#!/usr/bin/env python3
"""Fetch journal-update candidates for manual review.

This script intentionally writes only data/journal_updates_candidates.json.
Reviewed items should be copied into data/journal_updates.json by hand.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "journal_updates_candidates.json"


@dataclass(frozen=True)
class Source:
    name: str
    url: str
    category: str
    publisher: str
    selector_hint: str = ""


SOURCES = [
    Source(
        name="Springer Nature press releases",
        url="https://group.springernature.com/gp/group/media/press-releases",
        category="new_journal",
        publisher="Springer Nature",
        selector_hint="nature journal launches",
    ),
    Source(
        name="Nature Portfolio new launches",
        url="https://www.springernature.com/gp/librarians/products/journals/nature-research-journals/nature-portfolio-new-launches",
        category="new_journal",
        publisher="Springer Nature",
        selector_hint="new Nature Portfolio journals",
    ),
    Source(
        name="Clarivate Master Journal List",
        url="https://support.clarivate.com/ScientificandAcademicResearch/s/article/Web-of-Science-Master-Journal-List",
        category="index_change",
        publisher="Clarivate",
        selector_hint="monthly coverage status",
    ),
    Source(
        name="Scopus source list",
        url="https://www.elsevier.com/products/scopus/content",
        category="index_change",
        publisher="Elsevier",
        selector_hint="monthly source title list",
    ),
    Source(
        name="DOAJ RSS guidance",
        url="https://blog.doaj.org/2015/04/22/have-you-used-our-rss-feed/",
        category="new_journal",
        publisher="DOAJ",
        selector_hint="recent open access journal additions",
    ),
]


class PageParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.title_parts: list[str] = []
        self.links: list[dict[str, str]] = []
        self._in_title = False
        self._link_href = ""
        self._link_text: list[str] = []
        self.meta_description = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_d = {k.lower(): v or "" for k, v in attrs}
        if tag.lower() == "title":
            self._in_title = True
        elif tag.lower() == "meta":
            name = (attrs_d.get("name") or attrs_d.get("property") or "").lower()
            if name in {"description", "og:description"} and attrs_d.get("content"):
                self.meta_description = html.unescape(attrs_d["content"]).strip()
        elif tag.lower() == "a" and attrs_d.get("href"):
            self._link_href = urljoin(self.base_url, attrs_d["href"])
            self._link_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False
        elif tag.lower() == "a" and self._link_href:
            text = clean_text(" ".join(self._link_text))
            if text:
                self.links.append({"title": text, "url": self._link_href})
            self._link_href = ""
            self._link_text = []

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
        if self._link_href:
            self._link_text.append(data)

    @property
    def title(self) -> str:
        return clean_text(" ".join(self.title_parts))


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


def slugify(value: str, url: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
    return f"{base[:54].strip('-')}-{digest}" if base else digest


def fetch(url: str, timeout: int) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": "AILatestJournalBot/1.0 (+https://journal.ailatest.org)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def interesting_link(source: Source, link: dict[str, str]) -> bool:
    hay = f"{link.get('title','')} {link.get('url','')}".lower()
    if source.publisher == "Springer Nature":
        return (
            "nature" in hay
            and any(term in hay for term in ("journal", "journals", "launch", "launches", "portfolio"))
        )
    if source.publisher == "Clarivate":
        return any(term in hay for term in ("journal", "master journal", "web of science", "coverage"))
    if source.publisher == "Elsevier":
        return any(term in hay for term in ("source", "scopus", "journal", "discontinued"))
    return True


def candidate_from(source: Source, title: str, url: str, summary: str) -> dict:
    today = datetime.now(timezone.utc).date().isoformat()
    return {
        "id": slugify(title, url),
        "published_at": today,
        "category": source.category,
        "title": title,
        "summary": summary[:240],
        "source_name": source.name,
        "source_url": url,
        "publisher": source.publisher,
        "journals": [],
        "tags": [source.publisher, source.selector_hint],
        "priority": 2,
        "status": "candidate",
    }


def collect_source(source: Source, timeout: int, max_links: int) -> list[dict]:
    try:
        body = fetch(source.url, timeout)
    except Exception as exc:  # noqa: BLE001 - report per-source fetch failures
        print(f"[warn] {source.name}: {exc}", file=sys.stderr)
        return []

    parser = PageParser(source.url)
    parser.feed(body)
    title = parser.title or source.name
    summary = parser.meta_description or source.selector_hint or title
    candidates = [candidate_from(source, title, source.url, summary)]

    seen = {source.url}
    for link in parser.links:
        url = link["url"]
        if url in seen:
            continue
        if urlparse(url).netloc and not interesting_link(source, link):
            continue
        seen.add(url)
        candidates.append(candidate_from(source, link["title"], url, summary))
        if len(candidates) >= max_links:
            break
    return candidates


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--timeout", type=int, default=20)
    ap.add_argument("--max-per-source", type=int, default=8)
    args = ap.parse_args()

    items: list[dict] = []
    for source in SOURCES:
        items.extend(collect_source(source, args.timeout, args.max_per_source))

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "review_note": "Candidates only. Manually verify, rewrite Chinese summaries, and copy approved items into data/journal_updates.json.",
        "items": items,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {args.out} ({len(items)} candidates)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
