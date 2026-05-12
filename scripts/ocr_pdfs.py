#!/usr/bin/env python3
"""Batch OCR scanned PDFs using Apple Vision (ocrmac).

Output: generated/ocr/<name>.txt + <name>.json (per-page blocks with bbox).
"""
from __future__ import annotations
import json
import os
import sys
import time
from pathlib import Path

import pymupdf  # type: ignore
from ocrmac import ocrmac  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "generated" / "ocr"
OUT.mkdir(parents=True, exist_ok=True)

TARGETS = [
    "list/CSSCI(2025-2026)来源期刊目录.pdf",
    "list/CSSCI(2025-2026)扩展版来源期刊目录.pdf",
    "list/北大《中文核心期刊要目总览》（2023年版）.pdf",
]


def ocr_pdf(pdf_path: Path) -> dict:
    doc = pymupdf.open(pdf_path)
    pages: list[dict] = []
    tmp_img = OUT / "__tmp_page.png"
    for i, page in enumerate(doc):
        # Render at ~300dpi for good OCR quality
        pix = page.get_pixmap(matrix=pymupdf.Matrix(3, 3))
        pix.save(tmp_img)
        ann = ocrmac.OCR(
            str(tmp_img),
            language_preference=["zh-Hans", "en-US"],
            recognition_level="accurate",
        ).recognize()
        # ann = [(text, confidence, bbox), ...]
        blocks = [
            {"text": t, "conf": round(c, 3), "bbox": [round(x, 3) for x in b]}
            for (t, c, b) in ann
        ]
        pages.append({"page": i + 1, "blocks": blocks})
        print(f"  page {i+1}/{len(doc)}: {len(blocks)} blocks", flush=True)
    if tmp_img.exists():
        tmp_img.unlink()
    return {"pdf": str(pdf_path.name), "pages": pages}


def main():
    for rel in TARGETS:
        pdf = ROOT / rel
        stem = pdf.stem
        out_json = OUT / f"{stem}.json"
        out_txt = OUT / f"{stem}.txt"
        if out_json.exists() and out_txt.exists():
            print(f"[skip] {stem} already done")
            continue
        print(f"[ocr ] {rel}")
        t0 = time.time()
        data = ocr_pdf(pdf)
        out_json.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        # Plain text: one block per line, page separators
        lines = []
        for page in data["pages"]:
            lines.append(f"=== PAGE {page['page']} ===")
            for blk in page["blocks"]:
                lines.append(blk["text"])
            lines.append("")
        out_txt.write_text("\n".join(lines), encoding="utf-8")
        print(f"[done] {stem} in {time.time()-t0:.1f}s  →  {out_txt.name}, {out_json.name}")


if __name__ == "__main__":
    main()
