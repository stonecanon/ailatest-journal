#!/usr/bin/env python3
"""
apply_cnkx_taxonomy.py — 给科协 9998 条记录加 domain_top 大类字段，剔除垃圾碎片。

读：
  data/cnkx_records.json   (9998 条原始)
  data/domain_taxonomy.json (raw domain → top)

写：
  data/cnkx_records.json   (覆盖, 新增 domain_top 字段, 删除 __drop__ 命中)
  data/domestic.json       (patch cnkx.records + cnkx.domain_groups)
  data/journals.json       (patch 每本期刊里的 cnkx[].domain_top)

未匹配到 taxonomy 的 domain 归到 "未分类"。
"""
from __future__ import annotations
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

REC_PATH  = DATA / "cnkx_records.json"
TAX_PATH  = DATA / "domain_taxonomy.json"
DOM_PATH  = DATA / "domestic.json"
JRN_PATH  = DATA / "journals.json"


def build_lookup(tax: dict) -> tuple[dict, set, list]:
    rev = {}
    for top, doms in tax.items():
        if top.startswith("_"):
            continue
        for d in doms:
            rev[d.strip()] = top
    drops = {d.strip() for d in tax.get("__drop__", [])}
    order = [k for k in tax.get("_categories", []) if not k.startswith("_")]
    if "未分类" not in order:
        order.append("未分类")
    return rev, drops, order


def main() -> None:
    recs = json.loads(REC_PATH.read_text(encoding="utf-8"))
    tax  = json.loads(TAX_PATH.read_text(encoding="utf-8"))
    rev, drops, order = build_lookup(tax)

    kept: list[dict] = []
    dropped = 0
    unmapped = Counter()
    for r in recs:
        d = (r.get("domain") or "").strip()
        if d in drops or not d:
            dropped += 1
            continue
        top = rev.get(d)
        if top is None:
            unmapped[d] += 1
            top = "未分类"
        r2 = dict(r)
        r2["domain_top"] = top
        kept.append(r2)

    # group counts under each top
    by_top = defaultdict(list)
    for r in kept:
        by_top[r["domain_top"]].append(r)

    domain_groups = []
    for top in order:
        items = by_top.get(top, [])
        if not items:
            continue
        sub_c = Counter(r.get("domain", "") for r in items)
        domain_groups.append({
            "name": top,
            "count": len(items),
            "subdomains": [
                {"name": s, "count": c}
                for s, c in sub_c.most_common()
                if s
            ],
        })

    # write enriched records
    REC_PATH.write_text(
        json.dumps(kept, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"✓ cnkx_records.json: kept {len(kept)} (dropped junk {dropped})")
    if unmapped:
        print(f"  ⚠ unmapped domains ({sum(unmapped.values())} records, {len(unmapped)} domains):")
        for d, c in unmapped.most_common(20):
            print(f"     {c:5d}  {d!r}")

    # patch domestic.json
    if DOM_PATH.exists():
        dom = json.loads(DOM_PATH.read_text(encoding="utf-8"))
        cnkx = dom.get("cnkx") or {}
        cnkx["records"] = kept
        cnkx["domain_groups"] = domain_groups
        cnkx.setdefault("source", "中国科协 高质量科技期刊分级目录")
        dom["cnkx"] = cnkx
        DOM_PATH.write_text(
            json.dumps(dom, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"✓ domestic.json patched: {len(kept)} records, {len(domain_groups)} top groups")

    # patch journals.json — add domain_top into each cnkx tag entry
    if JRN_PATH.exists():
        # build (issn|name) -> domain_top map
        # multiple records per journal possible; pick first hit per (key, domain)
        rev_dom = {(r.get("domain") or "").strip(): r["domain_top"] for r in kept}
        journals = json.loads(JRN_PATH.read_text(encoding="utf-8"))
        patched = 0
        for j in journals:
            tags = j.get("cnkx")
            if not tags:
                continue
            for t in tags:
                d = (t.get("domain") or "").strip()
                top = rev_dom.get(d)
                if top is None:
                    if d in drops or not d:
                        # mark for removal
                        t["__drop__"] = True
                    else:
                        top = "未分类"
                if top is not None:
                    t["domain_top"] = top
            new_tags = [t for t in tags if not t.get("__drop__")]
            if new_tags != tags:
                patched += 1
            j["cnkx"] = new_tags
        JRN_PATH.write_text(
            json.dumps(journals, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        print(f"✓ journals.json patched: domain_top added; cleaned {patched} journals' tag list")


if __name__ == "__main__":
    main()
