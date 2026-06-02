#!/usr/bin/env python3
"""Find likely journal cover images from official journal homepages.

The script stores image URLs, not image bytes. That keeps the site lightweight
and avoids copying third-party cover art into the repo. Frontend code should
fall back to generated placeholders when a remote image fails to load.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import gzip
import json
import re
import ssl
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
JOURNALS = ROOT / "data" / "journals.json"
OA = ROOT / "data" / "oa.json"
OUT = ROOT / "data" / "journal_covers.json"
OUT_GZ = ROOT / "data" / "journal_covers.json.gz"

UA = (
    "AILatest-Journal-CoverBot/0.1 "
    "(journal metadata enrichment; contact: https://journal.ailatest.org)"
)
MAX_HTML_BYTES = 2_000_000
GOOD_EXT = re.compile(r"\.(?:jpe?g|png|webp)(?:[?#].*)?$", re.I)
BAD_EXT = re.compile(r"\.(?:svg|gif|ico)(?:[?#].*)?$", re.I)
ISSN_RE = re.compile(r"\b(\d{4})-?(\d{3}[\dX])\b", re.I)

POSITIVE = (
    "cover", "journal-cover", "issue-cover", "frontcover", "front-cover",
    "current-issue", "latest-issue", "toc", "homepageimage", "home-page-image",
    "journal image", "periodical", "publication cover",
)
NEGATIVE = (
    "logo", "icon", "favicon", "sprite", "banner", "hero", "advert", "ads",
    "facebook", "twitter", "linkedin", "youtube", "wechat", "avatar",
    "profile", "placeholder", "transparent", "loader", "flag", "flags/",
    "sitepress-multilingual", "wpml", "language", "locale",
    "doaj_seal", "doaj-seal", "crossref", "cross-ref", "orcid", "issn-logo",
)


def norm_issn(value: Any) -> str:
    if not value:
        return ""
    m = ISSN_RE.search(str(value).upper())
    return f"{m.group(1)}-{m.group(2)}" if m else ""


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_gz(path: Path, data: Any) -> None:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(payload)


def clean_url(url: str, base: str) -> str:
    if not url:
        return ""
    url = url.strip().strip("\"'")
    if not url or url.startswith(("data:", "mailto:", "javascript:")):
        return ""
    if url.startswith("//"):
        scheme = urlparse(base).scheme or "https"
        url = f"{scheme}:{url}"
    return urljoin(base, url)


class CandidateParser(HTMLParser):
    def __init__(self, page_url: str, title: str):
        super().__init__(convert_charrefs=True)
        self.page_url = page_url
        self.title = title
        self.base_url = page_url
        self.candidates: list[dict[str, Any]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        tag = tag.lower()
        if tag == "base" and a.get("href"):
            self.base_url = clean_url(a["href"], self.page_url) or self.page_url
            return
        if tag == "meta":
            key = (a.get("property") or a.get("name") or a.get("itemprop") or "").lower()
            content = a.get("content", "")
            if key in {
                "og:image", "og:image:url", "og:image:secure_url",
                "twitter:image", "twitter:image:src", "image", "thumbnailurl",
            }:
                self.add(content, "meta", key)
            return
        if tag == "link":
            rel = a.get("rel", "").lower()
            href = a.get("href", "")
            if "apple-touch-icon" in rel or "image_src" in rel or "icon" in rel:
                self.add(href, "link", rel)
            return
        if tag == "img":
            src = a.get("src") or a.get("data-src") or a.get("data-original") or a.get("data-lazy-src")
            text = " ".join(
                a.get(k, "") for k in ("alt", "title", "class", "id", "src", "data-src")
            )
            self.add(src or "", "img", text, a)

    def add(self, raw_url: str, source: str, context: str = "", attrs: dict[str, str] | None = None) -> None:
        url = clean_url(raw_url, self.base_url)
        if not url:
            return
        self.candidates.append({
            "url": url,
            "source": source,
            "context": context or "",
            "attrs": attrs or {},
        })


def text_score(text: str) -> int:
    t = text.lower()
    score = 0
    for token in POSITIVE:
        if token in t:
            score += 22
    for token in NEGATIVE:
        if token in t:
            score -= 26
    return score


def score_candidate(c: dict[str, Any], title: str) -> int:
    url = c["url"]
    ctx = f"{c.get('context','')} {url}"
    score = 0
    if c["source"] == "meta":
        score += 56
    elif c["source"] == "img":
        score += 42
    elif c["source"] == "link":
        score += 18
    score += text_score(ctx)
    if GOOD_EXT.search(url):
        score += 10
    if BAD_EXT.search(url):
        score -= 28
    attrs = c.get("attrs") or {}
    for key in ("width", "height"):
        try:
            val = int(float(attrs.get(key, 0)))
        except (TypeError, ValueError):
            val = 0
        if val >= 220:
            score += 8
        elif 0 < val < 80:
            score -= 12
    # A title token in alt/src is useful but weak; many sites use generic art.
    title_words = [w.lower() for w in re.findall(r"[A-Za-z0-9]{4,}", title)[:6]]
    if title_words and any(w in ctx.lower() for w in title_words):
        score += 8
    return score


def fetch_html(url: str, timeout: float) -> tuple[str, str]:
    req = Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"})
    ctx = ssl.create_default_context()
    with urlopen(req, timeout=timeout, context=ctx) as resp:
        content_type = resp.headers.get("content-type", "")
        final_url = resp.geturl() or url
        if "html" not in content_type and "xml" not in content_type and content_type:
            return final_url, ""
        body = resp.read(MAX_HTML_BYTES)
    enc = "utf-8"
    m = re.search(r"charset=([\w.-]+)", content_type, re.I)
    if m:
        enc = m.group(1)
    return final_url, body.decode(enc, errors="replace")


def homepage_for(journal: dict[str, Any], oa: dict[str, Any]) -> str:
    for issn in (norm_issn(journal.get("issn")), norm_issn(journal.get("eissn"))):
        if issn and oa.get(issn, {}).get("hp"):
            return oa[issn]["hp"]
    for key in ("homepage", "url", "detail_url"):
        if journal.get(key):
            return str(journal[key])
    return ""


def find_cover(journal: dict[str, Any], oa: dict[str, Any], timeout: float) -> dict[str, Any] | None:
    title = journal.get("name") or journal.get("title") or journal.get("cn_name") or ""
    homepage = homepage_for(journal, oa)
    if not homepage:
        return None
    try:
        final_url, html = fetch_html(homepage, timeout)
    except (HTTPError, URLError, TimeoutError, ssl.SSLError, OSError):
        return None
    if not html:
        return None
    parser = CandidateParser(final_url, title)
    try:
        parser.feed(html)
    except Exception:
        return None
    seen = set()
    best = None
    for cand in parser.candidates:
        url = cand["url"]
        if url in seen:
            continue
        seen.add(url)
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            continue
        score = score_candidate(cand, title)
        if score < 48:
            continue
        row = {
            "u": url,
            "s": cand["source"],
            "c": min(99, max(1, score)),
            "h": final_url,
        }
        if best is None or row["c"] > best["c"]:
            best = row
    return best


def journal_key(j: dict[str, Any]) -> str:
    return norm_issn(j.get("issn")) or norm_issn(j.get("eissn")) or str(j.get("slug") or j.get("name") or "")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="Process only N journals")
    ap.add_argument("--offset", type=int, default=0, help="Skip N eligible journals before processing")
    ap.add_argument("--workers", type=int, default=8, help="Concurrent homepage fetches")
    ap.add_argument("--timeout", type=float, default=8.0, help="Per-request timeout in seconds")
    ap.add_argument("--min-confidence", type=int, default=60)
    ap.add_argument("--refresh", action="store_true", help="Ignore existing cover cache")
    args = ap.parse_args()

    journals = load_json(JOURNALS)
    oa = load_json(OA)
    existing = {} if args.refresh or not OUT.exists() else load_json(OUT)
    done_keys = set(existing.keys())
    tasks = []
    skipped = 0
    for j in journals:
        key = journal_key(j)
        if not key or key in done_keys:
            continue
        if not homepage_for(j, oa):
            continue
        if skipped < args.offset:
            skipped += 1
            continue
        tasks.append(j)
        if args.limit and len(tasks) >= args.limit:
            break

    checked = datetime.now(timezone.utc).date().isoformat()
    found = 0
    started = time.time()
    with cf.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futs = {pool.submit(find_cover, j, oa, args.timeout): j for j in tasks}
        for idx, fut in enumerate(cf.as_completed(futs), 1):
            j = futs[fut]
            key = journal_key(j)
            try:
                cover = fut.result()
            except Exception:
                cover = None
            if cover and cover.get("c", 0) >= args.min_confidence:
                cover["t"] = checked
                issns = [norm_issn(j.get("issn")), norm_issn(j.get("eissn"))]
                keys = [i for i in issns if i] or [key]
                for k in keys:
                    existing[k] = cover
                found += 1
            if idx % 100 == 0:
                elapsed = time.time() - started
                print(f"checked {idx:,}/{len(tasks):,}; found {found:,}; {elapsed:.0f}s")

    OUT.write_text(json.dumps(existing, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    write_json_gz(OUT_GZ, existing)
    print(f"journal_covers.json: {len(existing):,} keys; new found {found:,}; processed {len(tasks):,}")


if __name__ == "__main__":
    main()
