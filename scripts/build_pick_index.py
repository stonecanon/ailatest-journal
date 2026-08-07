#!/usr/bin/env python3
"""Build the compact, pre-tokenized index used by the AI journal picker.

The public journal data set is intentionally rich (about 60 MB of JSON).  A
Cloudflare Worker should not parse and normalize that whole payload on every
cold isolate: doing so can exceed the Worker CPU limit before a recommendation
is returned.  This index keeps only the fields needed by /api/pick and stores
the searchable subject/name haystacks after the same light stemming used by
js/pick-match.js.

Run from the repository root after refreshing data/journals.json.gz:

    python3 scripts/build_pick_index.py
"""

from __future__ import annotations

import gzip
import json
import re
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "journals.json.gz"
OUTPUT = ROOT / "data" / "pick-index.json.gz"

SUFFIXES = [
    "izations", "isations", "ization", "isation", "ologies", "ology",
    "ically", "ations", "ation", "ities", "ical", "ies", "ics", "ial",
    "ity", "ing", "ic", "es", "ed", "e", "s", "y", "al",
]


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).lower()
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9一-鿿]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def has_cjk(value: str) -> bool:
    return bool(re.search(r"[一-鿿]", value))


def stem_lite(value: str) -> str:
    word = str(value or "").lower()
    if has_cjk(word):
        return word
    for _ in range(2):
        if len(word) <= 4:
            break
        changed = False
        if word.endswith("ies") and len(word) - 3 >= 3:
            word = word[:-3] + "y"
            changed = True
        else:
            for suffix in SUFFIXES:
                if len(word) - len(suffix) >= 4 and word.endswith(suffix):
                    word = word[: -len(suffix)]
                    changed = True
                    break
        if not changed:
            break
    return word


def haystack(parts: list[object]) -> str:
    normalized = normalize(" | ".join(str(part) for part in parts if part))
    return " ".join(stem_lite(token) for token in normalized.split() if token)


def unique(values: list[object], limit: int = 8) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
        if len(out) >= limit:
            break
    return out


def subject_parts(journal: dict) -> list[object]:
    parts: list[object] = []
    for key in ("wos_categories", "jcr_cats", "ei_subjects"):
        parts.extend(journal.get(key) or [])
    for key in (
        "jcr_cat", "esi_category", "cas_major_cat", "cas_major_cn",
        "ccf_area", "cnki_major",
    ):
        if journal.get(key):
            parts.append(journal[key])
    parts.extend(
        item.get("name")
        for item in journal.get("cas_sub_cats") or []
        if isinstance(item, dict) and item.get("name")
    )
    parts.extend(
        item.get("domain")
        for item in journal.get("cnkx") or []
        if isinstance(item, dict) and item.get("domain")
    )
    scopus = journal.get("scopus") or {}
    parts.extend(scopus.get("asjc_top") or [])
    return [part for part in parts if part]


def compact(journal: dict) -> dict:
    subject = subject_parts(journal)
    topics = unique(
        [*(journal.get("wos_categories") or []), journal.get("esi_category"), journal.get("cas_major_cn")],
        6,
    )
    return {
        "name": journal.get("name") or "",
        "cn_name": journal.get("cn_name") or "",
        "slug": journal.get("slug") or "",
        "issn": journal.get("issn") or "",
        "eissn": journal.get("eissn") or "",
        "publisher": journal.get("publisher") or "",
        "indices": journal.get("indices") or [],
        "subject_hay": haystack(subject),
        "name_hay": haystack([
            journal.get("name"), journal.get("cn_name"), journal.get("abbr20"),
            journal.get("publisher"), journal.get("country"),
        ]),
        "topics": topics,
        "if_2024": journal.get("if_2024"),
        "if_2025": journal.get("if_2025"),
        "if_quartile": journal.get("if_quartile") or "",
        "cas_zone": journal.get("cas_zone") or "",
        "cas_top": bool(journal.get("cas_top")),
        "doaj": journal.get("doaj") if isinstance(journal.get("doaj"), dict) else None,
        "warning": bool(
            journal.get("warning")
            or journal.get("citic_warning")
            or journal.get("on_hold")
            or journal.get("under_review")
        ),
    }


def main() -> None:
    with gzip.open(SOURCE, "rt", encoding="utf-8") as handle:
        journals = json.load(handle)
    records = [compact(journal) for journal in journals]
    payload = json.dumps(records, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=9, mtime=0) as zipped:
            zipped.write(payload)
    print(f"wrote {OUTPUT} ({len(records)} journals, {OUTPUT.stat().st_size / 1024 / 1024:.2f} MiB gzip)")


if __name__ == "__main__":
    main()
