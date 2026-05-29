#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将学校电脑跑出的 sd_review_cycles.json 合并到 review_cycles.json

用法：
  python3 merge_sd_data.py [sd_review_cycles.json]

默认读取当前目录下的 sd_review_cycles.json，合并后覆盖 review_cycles.json
"""

import json, sys
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
REVIEW_FILE = ROOT / "data" / "review_cycles.json"

def main():
    # 输入文件
    sd_file = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("sd_review_cycles.json")
    
    if not sd_file.exists():
        print(f"❌ 未找到: {sd_file}")
        print(f"请确认文件路径，或运行: python3 merge_sd_data.py /path/to/sd_review_cycles.json")
        sys.exit(1)
    
    print("=" * 60)
    print("合并 ScienceDirect 审稿周期数据")
    print(f"输入: {sd_file.resolve()}")
    print(f"目标: {REVIEW_FILE}")
    print("=" * 60)
    
    # 加载 SD 数据
    with open(sd_file) as f:
        sd_data = json.load(f)
    
    # 加载现有 review data
    with open(REVIEW_FILE) as f:
        review = json.load(f)
    
    print(f"\n现有 review_cycles.json: {len(review)} 条")
    print(f"SD 爬取数据: {len(sd_data)} 条")
    
    # 合并
    merged = 0
    replaced_missing = 0
    for issn, entry in sd_data.items():
        if entry.get('median_days') or entry.get('n', 0) > 0:
            # 有实际数据，覆盖
            entry['merged_at'] = date.today().isoformat()
            review[issn] = entry
            merged += 1
        elif entry.get('missing') or entry.get('error'):
            # 标记为缺失或无数据，但不覆盖已有数据
            pass
    
    # 保存
    with open(REVIEW_FILE, 'w') as f:
        json.dump(review, f, ensure_ascii=False, sort_keys=True)
    
    with_data = sum(1 for v in review.values() if v.get('median_days'))
    missing = sum(1 for v in review.values() if v.get('missing') or v.get('n', 0) == 0)
    
    print(f"\n✅ 合并完成!")
    print(f"  新合并: {merged} 条")
    print(f"  总条目: {len(review)}")
    print(f"  有数据: {with_data}")
    print(f"  缺失:   {missing}")
    print(f"\n💾 已保存到 {REVIEW_FILE}")


if __name__ == "__main__":
    main()
