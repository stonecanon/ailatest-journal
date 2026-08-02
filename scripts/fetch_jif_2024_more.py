#!/usr/bin/env python3
"""补充 2024 年 JIF without self cites 数据（journalsimpactfactors.com）。

现有 list/jif_without_self_cites_2024.csv 只有 473 条（IF>=11 的高 IF 期刊）。
本脚本按 id 继续抓取中段期刊，扩充 2024 自引覆盖率，供 self_citation_rate_history 使用。
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_CSV = ROOT / "list" / "jif_without_self_cites_2024.csv"
BASE = "https://journalsimpactfactors.com/journal.php?id={}"

EXISTING = {}


def load_existing():
    if not OUT_CSV.exists():
        return
    with open(OUT_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            issn = (row.get("issn") or "").replace("-", "").strip()
            if issn:
                EXISTING[issn] = row


def fetch_row(page_id: int) -> dict | None:
    url = BASE.format(page_id)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; AILatest Journal)"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", "replace")
    except Exception:
        return None
    # 提取标题
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.S)
    page_title = re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""
    # 方式 A：th/td 成对结构（中段 id 用）
    pairs = {}
    for th, td in re.findall(r"<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>", html, re.S):
        k = re.sub(r"<[^>]+>", "", th).strip().lower()
        v = re.sub(r"<[^>]+>", "", td).strip()
        if k and v:
            pairs[k] = v
    if pairs.get("issn") and pairs.get("jif without self-cites") is not None:
        return {
            "title": pairs.get("journal") or pairs.get("abbreviated journal") or page_title,
            "issn": pairs.get("issn", ""),
            "eissn": pairs.get("eissn", ""),
            "year": pairs.get("year") or "2024",
            "jif": pairs.get("impact factor") or pairs.get("jif", ""),
            "jif_without_self_cites": pairs.get("jif without self-cites", ""),
            "source_url": url,
        }
    # 方式 B：多列 tr 结构（前段 id 用）
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S)
    cells = []
    for r in rows:
        cs = [re.sub(r"<[^>]+>", "", c).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)]
        if cs:
            cells.append(cs)
    if not cells:
        return None
    first = cells[0]
    if len(first) < 11:
        return None
    title = first[1] if len(first) > 1 else ""
    issn = first[4] if len(first) > 4 else ""
    eissn = first[5] if len(first) > 5 else ""
    jif = first[8] if len(first) > 8 else ""
    jif_no_self = first[10] if len(first) > 10 else ""
    if not issn or not jif_no_self:
        return None
    return {
        "title": title,
        "issn": issn,
        "eissn": eissn,
        "year": "2024",
        "jif": jif,
        "jif_without_self_cites": jif_no_self,
        "source_url": url,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=474, help="First id to fetch")
    ap.add_argument("--end", type=int, default=3000, help="Last id to fetch (exclusive)")
    ap.add_argument("--sleep", type=float, default=0.15)
    args = ap.parse_args()

    load_existing()
    print(f"existing rows: {len(EXISTING):,}")
    new_rows = []
    ok = empty = 0
    for pid in range(args.start, args.end):
        row = fetch_row(pid)
        if not row:
            empty += 1
            continue
        issn = row["issn"].replace("-", "")
        if issn in EXISTING:
            continue
        EXISTING[issn] = row
        new_rows.append(row)
        ok += 1
        if ok % 50 == 0:
            print(f"  id={pid} ok={ok} empty={empty}", flush=True)
        time.sleep(args.sleep)

    if new_rows:
        fieldnames = ["title", "issn", "eissn", "year", "jif", "jif_without_self_cites", "source_url"]
        # 重写文件：已有 + 新增（按 id 顺序追加即可）
        all_rows = list(EXISTING.values())
        with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for r in all_rows:
                w.writerow({k: r.get(k, "") for k in fieldnames})
        print(f"done: +{len(new_rows)} new, total={len(all_rows):,} → {OUT_CSV.name}")
    else:
        print("no new rows")


if __name__ == "__main__":
    main()
