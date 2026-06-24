#!/usr/bin/env python3
"""Generate sitemap.xml and the compact journal index used by Pages Functions.

Default mode writes:
  - sitemap.xml
  - data/journal_index.json

The old static journal HTML output is intentionally not the default anymore:
/journal/<slug>/ is rendered by functions/[[path]].js as a visible SEO landing
page that does not load the SPA drawer.
"""

from __future__ import annotations

import gzip
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
JOURNALS_GZ = DATA_DIR / "journals.json.gz"
OA_GZ = DATA_DIR / "oa.json.gz"
ANNUAL_GZ = DATA_DIR / "annual_outputs.json.gz"
SITEMAP = ROOT / "sitemap.xml"
INDEX_FILE = DATA_DIR / "journal_index.json"
SITE_URL = "https://journal.ailatest.org"


def load_gzip_json(path: Path, default):
    if not path.exists():
        return default
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return json.load(f)


def load_journals():
    return load_gzip_json(JOURNALS_GZ, [])


def compact_issn(value) -> str:
    return re.sub(r"[^0-9X]", "", str(value or "").upper())


def norm_issn(value) -> str:
    raw = compact_issn(value)
    return f"{raw[:4]}-{raw[4:]}" if len(raw) == 8 else ""


def make_slug(r: dict) -> str:
    slug = str(r.get("slug") or "").strip()
    if slug:
        return slug
    name = r.get("name") or r.get("en_name") or r.get("cn_name") or ""
    slug = re.sub(r"[^a-z0-9]+", "-", str(name).lower()).strip("-")
    if slug:
        return slug
    return compact_issn(r.get("issn") or r.get("eissn"))


def first_oa(oa: dict, r: dict) -> dict:
    for key in (norm_issn(r.get("issn")), norm_issn(r.get("eissn")), compact_issn(r.get("issn")), compact_issn(r.get("eissn"))):
        if key and key in oa:
            return oa[key] or {}
    return {}


def first_annual(annual: dict, r: dict) -> dict:
    for key in (norm_issn(r.get("issn")), norm_issn(r.get("eissn")), compact_issn(r.get("issn")), compact_issn(r.get("eissn"))):
        if key and key in annual:
            return annual[key] or {}
    return {}


def compact_annual(year_counts: dict) -> list[dict]:
    out = []
    for year in sorted((str(y) for y in year_counts.keys()), reverse=True):
        try:
            yi = int(year)
            count = int(year_counts[year])
        except Exception:
            continue
        out.append({"y": yi, "c": count})
        if len(out) >= 3:
            break
    return out


def tier_label(r: dict) -> str:
    parts = []
    if r.get("if_quartile"):
        parts.append(str(r["if_quartile"]).upper())
    if r.get("cas_zone") is not None:
        parts.append(f"CAS {r['cas_zone']}")
    if r.get("fms", {}).get("tier"):
        parts.append(f"FMS {r['fms']['tier']}")
    if r.get("abdc", {}).get("rating"):
        parts.append(f"ABDC {r['abdc']['rating']}")
    if r.get("abs", {}).get("rating"):
        parts.append(f"ABS {r['abs']['rating']}")
    return " / ".join(parts[:5])


def entry_for(r: dict, oa_rec: dict, annual_rec: dict) -> dict:
    ret = r.get("retraction") or {}
    ann = compact_annual(annual_rec)
    oa_label = oa_rec.get("l") or ""
    entry = {
        "n": r.get("name") or r.get("cn_name") or r.get("en_name") or "",
        "c": r.get("cn_name") or "",
        "e": r.get("en_name") or "",
        "i": r.get("issn") or "",
        "is": r.get("eissn") or "",
        "f": r.get("if_2024"),
        "q": r.get("if_quartile") or "",
        "z": r.get("cas_zone"),
        "zt": bool(r.get("cas_top")),
        "ix": (r.get("indices") or [])[:4],
        "p": r.get("publisher") or "",
        "es": r.get("esi_category") or "",
        "wos": (r.get("wos_categories") or [])[:3],
        "sc": bool(r.get("scopus", {}).get("active")),
        "med": bool(r.get("medline")),
        "pm": bool(r.get("pubmed")),
        "pmc": bool(r.get("pmc")),
        "oa": oa_label,
        "doaj": bool(r.get("doaj") or oa_rec.get("dj")),
        "hp": oa_rec.get("hp") or oa_rec.get("homepage") or "",
        "apc": oa_rec.get("apc") or oa_rec.get("apc_usd"),
        "tier": tier_label(r),
        "ann": ann,
        "rt": {
            "total": ret.get("retractions_total") or 0,
            "r5": ret.get("r5") or ret.get("retractions_5y") or 0,
            "r10": ret.get("r10") or ret.get("retractions_10y") or 0,
            "rate10": ret.get("rate_per_1000_10y"),
        } if ret else None,
    }
    return {k: v for k, v in entry.items() if v not in ("", None, [], {}, False)}


def related_score(a: dict, b: dict) -> float:
    score = 0.0
    aw = set(a.get("wos") or [])
    bw = set(b.get("wos") or [])
    ae = a.get("es")
    be = b.get("es")
    if aw and bw:
        score += 8.0 * len(aw & bw)
    if ae and ae == be:
        score += 5.0
    if a.get("p") and a.get("p") == b.get("p"):
        score += 2.0
    ai = set(a.get("ix") or [])
    bi = set(b.get("ix") or [])
    if ai and bi:
        score += 1.5 * len(ai & bi)
    af = a.get("f")
    bf = b.get("f")
    if isinstance(af, (int, float)) and isinstance(bf, (int, float)):
        score += max(0.0, 4.0 - min(abs(float(af) - float(bf)), 8.0) / 2.0)
    return score


def build_related(entries: dict):
    by_subject = defaultdict(list)
    by_esi = defaultdict(list)
    by_pub = defaultdict(list)
    primary = [(slug, e) for slug, e in entries.items() if "_r" not in e]
    for slug, e in primary:
        for w in e.get("wos") or []:
            by_subject[w].append(slug)
        if e.get("es"):
            by_esi[e["es"]].append(slug)
        if e.get("p"):
            by_pub[e["p"]].append(slug)

    for slug, e in primary:
        candidates = set()
        for w in e.get("wos") or []:
            candidates.update(by_subject.get(w, [])[:350])
        if e.get("es"):
            candidates.update(by_esi.get(e["es"], [])[:500])
        if e.get("p"):
            candidates.update(by_pub.get(e["p"], [])[:250])
        candidates.discard(slug)
        ranked = sorted(
            ((related_score(e, entries[c]), c) for c in candidates if c in entries and "_r" not in entries[c]),
            reverse=True,
        )
        e["rel"] = [c for score, c in ranked if score > 0][:8]


def generate_all():
    journals = load_journals()
    oa = load_gzip_json(OA_GZ, {})
    annual = load_gzip_json(ANNUAL_GZ, {})
    print(f"Loaded {len(journals)} journals")

    index = {}
    sitemap_urls = [(SITE_URL + "/", "1.0")]
    skipped = 0

    for r in journals:
        slug = make_slug(r)
        if not slug:
            skipped += 1
            continue
        entry = entry_for(r, first_oa(oa, r), first_annual(annual, r))
        index[slug] = entry
        v = compact_issn(entry.get("i"))
        if v and v not in index:
            index[v] = {"_r": slug}
        sitemap_urls.append((f"{SITE_URL}/journal/{slug}/", "0.8"))

    print("Building related journal links...")
    build_related(index)

    print(f"Writing {SITEMAP} with {len(sitemap_urls)} URLs")
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    xml_parts.extend(f"  <url><loc>{url}</loc><priority>{priority}</priority></url>" for url, priority in sitemap_urls)
    xml_parts.append("</urlset>")
    SITEMAP.write_text("\n".join(xml_parts) + "\n", encoding="utf-8")

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    primary_count = sum(1 for v in index.values() if "_r" not in v)
    print(f"Journal index: {INDEX_FILE.stat().st_size / 1024 / 1024:.1f} MB, {len(index)} keys, {primary_count} primary")
    print(f"Done: {primary_count} sitemap journal URLs, {skipped} skipped")


if __name__ == "__main__":
    generate_all()
