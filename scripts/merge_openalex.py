#!/usr/bin/env python3
"""
Build data/oa.json: a compact { "ISSN": {homepage, label, apc_usd, ...} } map.
Keyed by every ISSN (both print + eISSN) found in journals.json.
Keeps main journals.json small; frontend fetches oa.json in parallel.

Label derivation (5-class subscription/OA model):
  diamond                  — is_oa && in_doaj && !apc_usd
  gold_apc                 — is_oa (paid OA)
  hybrid                   — !is_oa && apc_usd (hybrid OA)
  subscription_paid_read   — default subscription
  unknown                  — fallback
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JOURNALS = ROOT / "data" / "journals.json"
CACHE = ROOT / "data" / "openalex_cache.json"
OUT = ROOT / "data" / "oa.json"
ANNUAL_OUT = ROOT / "data" / "annual_outputs.json"
ANNUAL_GZ = ROOT / "data" / "annual_outputs.json.gz"
META = ROOT / "data" / "meta.json"


def norm_issn(s):
    if not s:
        return ""
    s = str(s).strip().upper()
    if len(s) == 8:
        s = s[:4] + "-" + s[4:]
    return s


def derive_label(rec):
    is_oa = bool(rec.get("is_oa"))
    in_doaj = bool(rec.get("in_doaj"))
    apc = rec.get("apc_usd")
    if is_oa and in_doaj and not apc:
        return "diamond"
    if is_oa:
        return "gold_apc"
    if apc:
        return "hybrid"
    return "subscription_paid_read"


def main():
    with open(JOURNALS, encoding="utf-8") as f:
        journals = json.load(f)
    with open(CACHE, encoding="utf-8") as f:
        cache = json.load(f)
    by_issn_cache = cache["by_issn"]

    # Build a compact map only for ISSNs that appear in our catalogue.
    wanted = set()
    for j in journals:
        for f in ("issn", "eissn"):
            v = norm_issn(j.get(f))
            if v:
                wanted.add(v)

    out_map = {}
    annual_map = {}
    stats = {
        "matched_issns": 0, "has_homepage": 0, "has_apc": 0,
        "labels": {}, "is_oa": 0, "in_doaj": 0, "annual_outputs": 0,
    }
    for issn in wanted:
        rec = by_issn_cache.get(issn)
        if not rec:
            continue
        label = derive_label(rec)
        row = {
            "hp": rec.get("homepage") or None,
            "l":  label,
            "oa": 1 if rec.get("is_oa") else 0,
            "dj": 1 if rec.get("in_doaj") else 0,
            "apc": rec.get("apc_usd") or None,
            "org": rec.get("host_org") or None,
            "cn": rec.get("country") or None,
            "w": rec.get("works_count") or None,
            "t": rec.get("type") or None,
        }
        # Extract top topic names (granular, top 8 by count)
        topics = rec.get("topics") or []
        if topics:
            sorted_topics = sorted(topics, key=lambda x: x.get("count", 0), reverse=True)
            names = [st.get("display_name", "") for st in sorted_topics[:8] if st.get("display_name")]
            if names:
                row["tp"] = names
        # Extract subfield-level topics (deduplicated, all)
        if topics:
            subfields = set()
            for t in topics:
                sf = t.get("subfield", {})
                sfn = sf.get("display_name") if isinstance(sf, dict) else None
                if sfn:
                    subfields.add(sfn)
            if subfields:
                row["sf"] = sorted(subfields)
        # drop empty values to shrink file
        row = {k: v for k, v in row.items() if v not in (None, 0)}
        # but re-attach label always
        row["l"] = label
        out_map[issn] = row
        counts_by_year = rec.get("counts_by_year") or []
        annual = {}
        for item in counts_by_year:
            year = item.get("year")
            count = item.get("works_count")
            if year and count is not None:
                annual[str(year)] = count
        if annual:
            annual_map[issn] = annual
            stats["annual_outputs"] += 1
        stats["matched_issns"] += 1
        if row.get("hp"): stats["has_homepage"] += 1
        if row.get("apc"): stats["has_apc"] += 1
        if row.get("oa"): stats["is_oa"] += 1
        if row.get("dj"): stats["in_doaj"] += 1
        stats["labels"][label] = stats["labels"].get(label, 0) + 1

    # dedup: many journals share ISSN across print+eISSN, OpenAlex returns the
    # same record under both — so sharing the dict saves a lot of bytes on disk.
    # But JSON can't represent refs, so leave as-is; gzip will collapse them.

    OUT.write_text(json.dumps(out_map, ensure_ascii=False, separators=(',', ':')), encoding="utf-8")
    ANNUAL_OUT.write_text(json.dumps(annual_map, ensure_ascii=False, separators=(',', ':')), encoding="utf-8")
    import gzip
    with gzip.open(ANNUAL_GZ, "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(annual_map, f, ensure_ascii=False, separators=(',', ':'))
    size_kb = OUT.stat().st_size / 1024
    annual_size_kb = ANNUAL_OUT.stat().st_size / 1024
    print(f"oa.json written: {len(out_map):,} ISSN keys, {size_kb:.0f} KB")
    print(f"annual_outputs.json written: {len(annual_map):,} ISSN keys, {annual_size_kb:.0f} KB")
    print(f"  homepage: {stats['has_homepage']:,}")
    print(f"  apc_usd:  {stats['has_apc']:,}")
    print(f"  is_oa:    {stats['is_oa']:,}")
    print(f"  in_doaj:  {stats['in_doaj']:,}")
    print(f"  labels:   {stats['labels']}")

    # meta update
    m = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
    m["oa_enriched"] = True
    m["oa_source"] = "OpenAlex snapshot 2026-05"
    m["oa_stats"] = stats
    m["annual_outputs_source"] = "OpenAlex sources counts_by_year"
    m["annual_outputs_count"] = len(annual_map)
    META.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
