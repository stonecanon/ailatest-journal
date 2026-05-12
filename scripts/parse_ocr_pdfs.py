#!/usr/bin/env python3
"""Parse OCR JSON from CSSCI and PKU Core into structured records.

Inputs (generated/ocr/):
  CSSCI(2025-2026)来源期刊目录.json        → 3-col (序号/期刊/学科)
  CSSCI(2025-2026)扩展版来源期刊目录.json  → 3-col
  北大《中文核心期刊要目总览》（2023年版）.json → 4-col (总序号/分类/刊名/分类内序号)

Outputs (generated/):
  cssci_core.json       [{name, discipline}]
  cssci_ext.json        [{name, discipline}]
  pku_core.json         [{name, category}]
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
OCR = ROOT / "generated" / "ocr"
OUT = ROOT / "generated"


def cluster_rows(blocks, y_tol=0.008):
    """Cluster blocks by y, return rows sorted top→bottom; each row sorted L→R."""
    blocks = sorted(blocks, key=lambda b: -b["bbox"][1])
    rows: list[list[dict]] = []
    for b in blocks:
        y = b["bbox"][1]
        placed = False
        for row in rows:
            if abs(row[0]["bbox"][1] - y) < y_tol:
                row.append(b)
                placed = True
                break
        if not placed:
            rows.append([b])
    for row in rows:
        row.sort(key=lambda b: b["bbox"][0])
    return rows


JUNK_CSSCI = {"序号", "期刊名称", "学科名称", "EMSCI", "SSSC", "S", "CSSCI", "刊名"}
JUNK_PREFIX = ("南京大学", "中国社会科学", "中文社会科学", "评价中心", "寄送地址",
               "编辑部", "邮件标题", "skpi@", "本目录仅供", "申领电子", "来源期刊目录",
               "扩展版目录", "官方电子版", "以官方图书", "完整名录", "因《中文核心",
               "有出入", "内部资料")


def is_junk(t: str) -> bool:
    t = t.strip()
    if not t:
        return True
    if t in JUNK_CSSCI:
        return True
    for p in JUNK_PREFIX:
        if t.startswith(p):
            return True
    if re.fullmatch(r"\d+(/\d+)?", t):
        return True
    # footer/notice lines: "1. xxx", "2. xxx", contain email, URL, long sentence fragments
    if re.match(r"^\d+[.、]\s*.{6,}", t):
        return True
    if "@" in t or "http" in t.lower():
        return True
    # boilerplate sentence tail punctuation
    if t.endswith(("，", "。", "：", "；")):
        return True
    return False


# CSSCI 学科表（2025-2026 覆盖，见官方目录 28 类）
CSSCI_DISCIPLINES = {
    "高校学报", "综合类", "历史学", "经济学", "法学", "政治学", "管理学",
    "教育学", "艺术学", "体育学", "马克思主义理论", "哲学", "心理学",
    "语言学", "文学", "宗教学", "社会学", "民族学与文化学", "民族学",
    "新闻学与传播学", "图书馆、情报与文献学", "考古学", "人文、经济地理",
    "统计学", "环境科学", "人文地理", "经济地理", "军事学", "综合社科",
    "交叉学科", "外国语言学", "建筑学", "旅游学",
}


def is_discipline(t: str) -> bool:
    return t in CSSCI_DISCIPLINES


def parse_cssci(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: list[dict] = []
    seen_names: set[str] = set()
    for page in data["pages"]:
        rows = cluster_rows(page["blocks"])
        for row in rows:
            texts = [b["text"].strip() for b in row if not is_junk(b["text"])]
            if not texts:
                continue
            names = [t for t in texts if not re.fullmatch(r"\d+", t) and not is_discipline(t)]
            discs = [t for t in texts if is_discipline(t)]
            if not names:
                continue
            # Take longest as journal
            name = max(names, key=len)
            # Skip clearly non-journal lines
            if len(name) < 2:
                continue
            if name in seen_names:
                continue
            seen_names.add(name)
            out.append({
                "name": name,
                "discipline": discs[0] if discs else None,
            })
    return out


def parse_pku(path: Path) -> list[dict]:
    """PKU core columns (observed via bbox analysis):
      x ≈ 0.10-0.14  总序号
      x ≈ 0.15-0.25  分类 (sparse, only at group start)
      x ≈ 0.37-0.72  刊名
      x ≈ 0.83       分类内序号
    分类 column spans multiple rows - track current category.
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    out: list[dict] = []
    seen: set[str] = set()
    current_cat: str | None = None
    for page in data["pages"]:
        rows = cluster_rows(page["blocks"])
        for row in rows:
            # Category column: 0.14-0.30, short Chinese text, not a number
            cat_blocks = [b for b in row
                          if 0.14 < b["bbox"][0] < 0.30
                          and not re.fullmatch(r"\d+", b["text"].strip())
                          and not is_junk(b["text"])]
            # Name column: 0.33-0.78
            name_blocks = [b for b in row
                           if 0.33 < b["bbox"][0] < 0.78
                           and not re.fullmatch(r"\d+", b["text"].strip())
                           and not is_junk(b["text"])]
            if cat_blocks:
                cat_text = cat_blocks[0]["text"].strip()
                # real categories are 2-8 chars, no punctuation
                if (2 <= len(cat_text) <= 12
                        and cat_text not in {"分类", "刊名", "分类内序号", "总序号"}
                        and not re.search(r"[。，、；：（）()]", cat_text)):
                    current_cat = cat_text
            for nb in name_blocks:
                nm = nb["text"].strip().lstrip("•·.").strip()
                if len(nm) < 2:
                    continue
                if nm in {"分类", "刊名", "分类内序号", "总序号"}:
                    continue
                if nm in seen:
                    continue
                seen.add(nm)
                out.append({"name": nm, "category": current_cat})
    return out


def main():
    cssci_core = parse_cssci(OCR / "CSSCI(2025-2026)来源期刊目录.json")
    cssci_ext = parse_cssci(OCR / "CSSCI(2025-2026)扩展版来源期刊目录.json")
    pku = parse_pku(OCR / "北大《中文核心期刊要目总览》（2023年版）.json")

    (OUT / "cssci_core.json").write_text(
        json.dumps(cssci_core, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "cssci_ext.json").write_text(
        json.dumps(cssci_ext, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "pku_core.json").write_text(
        json.dumps(pku, ensure_ascii=False, indent=1), encoding="utf-8")

    # Stats
    print(f"CSSCI 正刊: {len(cssci_core)} 条")
    print(f"  disciplines: {sorted(set(r['discipline'] for r in cssci_core if r['discipline']))}")
    print(f"CSSCI 扩展: {len(cssci_ext)} 条")
    print(f"北大核心: {len(pku)} 条")
    cats = defaultdict(int)
    for r in pku:
        cats[r["category"] or "未分类"] += 1
    print(f"  top categories: {sorted(cats.items(), key=lambda x:-x[1])[:10]}")


if __name__ == "__main__":
    main()
