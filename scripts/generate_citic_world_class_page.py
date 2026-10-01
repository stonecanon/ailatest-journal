#!/usr/bin/env python3
"""Generate the static landing page for the partial CITIC World-Class sample."""
from __future__ import annotations

import gzip
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "indexes" / "world-class" / "index.html"


def esc(value) -> str:
    return html.escape(str(value or ""), quote=True)


def main() -> int:
    with gzip.open(ROOT / "data" / "journals.json.gz", "rt", encoding="utf-8") as handle:
        journals = json.load(handle)
    rows = [j for j in journals if j.get("citic_world_class")]
    rows.sort(key=lambda j: (j["citic_world_class"].get("language") != "en", str(j.get("name") or "").casefold()))
    source_rows = []
    for j in rows:
        citic = j["citic_world_class"]
        source_issns = " / ".join(citic.get("source_issns") or [])
        subjects = "；".join(citic.get("subjects") or []) or "—"
        publisher = citic.get("publisher") or "中信所查询样本"
        evidence = citic.get("publisher") or "中信所查询样本"
        issn_note = source_issns or "—"
        source_rows.append(
            f'<tr><td class="row-num">{len(source_rows) + 1}</td>'
            f'<td><a href="/journal/{esc(j.get("slug"))}/">{esc(j.get("name"))}</a></td>'
            f'<td>{esc(j.get("cn_name") or "—")}</td>'
            f'<td>{esc(j.get("issn") or j.get("eissn") or "—")}</td>'
            f'<td>{esc(issn_note)}</td>'
            f'<td>{esc(subjects)}</td><td>{esc(publisher)}</td><td>{esc(evidence)}</td></tr>'
        )
    items = [
        {"@type": "ListItem", "position": idx, "item": {"@type": "Periodical", "name": j.get("name"), "url": f"https://journal.ailatest.org/journal/{j.get('slug')}/"}}
        for idx, j in enumerate(rows, 1)
    ]
    description = "中国科学技术信息研究所（中信所）2025年度世界一流科技期刊目录的公开可确认部分名单；官方未公布按学科分类的完整名单。"
    schema = json.dumps({"@context": "https://schema.org", "@type": "ItemList", "name": "中信所世界一流科技期刊目录（2025年度，部分名单）", "description": description, "url": "https://journal.ailatest.org/indexes/world-class/", "itemListElement": items}, ensure_ascii=False)
    html_text = f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>中信所世界一流科技期刊目录（部分名单） | AILatest Journal</title>
<meta name="description" content="{esc(description)}" />
<link rel="canonical" href="https://journal.ailatest.org/indexes/world-class/" />
<meta name="robots" content="index,follow" />
<meta name="theme-color" content="#f97316" />
<script type="application/ld+json">{schema}</script>
<link rel="stylesheet" href="/css/listing.css?v=20261001-citic-world-class" />
</head>
<body>
<header class="listing-topbar"><a href="/" class="listing-brand">AILatest <em>Journal</em></a><span class="listing-section-title">期刊榜单</span><nav><a href="/">首页</a><a href="/#rankings">榜单</a><a href="/about">关于</a><a href="/contact">联系</a></nav></header>
<div class="wrap">
  <h1>中信所世界一流科技期刊目录（部分名单）</h1>
  <p class="breadcrumb"><a href="/">首页</a> · <a href="/#rankings">榜单</a> · <a href="/indexes/">索引排行榜</a></p>
  <p class="sub">中国科学技术信息研究所（中信所）2025年度《世界一流科技期刊目录》公开可确认的部分样本。</p>
  <p class="count">当前整理 <b>{len(rows)}</b> 种。官方目录共公布 6,132 种，但未提供按学科分类的完整公开名单，本页不代表完整目录。</p>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th>#</th><th>期刊</th><th>中文名</th><th>主库 ISSN</th><th>目录原始 ISSN</th><th>平台学科标引</th><th>来源出版方</th><th>证据</th></tr></thead>
    <tbody>{''.join(source_rows)}</tbody>
  </table></div></div>
  <p class="back-wrap"><a class="back" href="/indexes/">← 返回索引排行榜</a></p>
</div>
<footer class="footer">© 2026 <a href="/">AILatest Journal</a> · <a href="/about">关于</a> · <a href="/contact">联系</a></footer>
<script src="/js/site-rail.js?v=20261001-citic-world-class" defer></script>
</body>
</html>
'''
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html_text, encoding="utf-8")
    print(json.dumps({"path": str(OUT), "rows": len(rows)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
