#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每月1号自动更新审稿周期数据
流程:
  1) 生成缺失期刊列表 (CAS zone1 SCIE/SSCI 三大领域)
  2) 运行 build_review_cycles.py (DOAJ→CrossRef)
  3) 合并缺失标记 → review_cycles.json
"""

import subprocess, json, sys, time, os
from pathlib import Path
from collections import Counter
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
BUILD_SCRIPT = ROOT / "scripts" / "build_review_cycles.py"
REVIEW_FILE = ROOT / "data" / "review_cycles.json"
TARGETS_FILE = ROOT / "data" / "target_journals_3fields.json"
JOURNALS_FILE = ROOT / "data" / "journals.json"
CAS_FILE = ROOT / "data" / "cas_xr_2026.json"

FOCUS_FIELDS = ['Environment Science and Ecology', 'Engineering', 'Computer Science']

print("=" * 60)
print("Review Cycle Monthly Update —", date.today().isoformat())
print("=" * 60)

# Step 0: Generate target journals list
print("\n[0/4] Generating target journal list (CAS zone1, 3 fields)...")
try:
    with open(JOURNALS_FILE) as f:
        journals = json.load(f)
    issn_to_j = {}
    for j in journals:
        for issn in (j.get('issn',''), j.get('eissn','')):
            if issn: issn_to_j[issn] = j
    
    with open(CAS_FILE) as f:
        cas = json.load(f)
    
    # Load existing review cycles to skip already-covered
    existing = {}
    if REVIEW_FILE.exists():
        with open(REVIEW_FILE) as f:
            existing = json.load(f)
    
    targets = []
    for c in cas:
        if c.get('major_en','') not in FOCUS_FIELDS: continue
        if c.get('zone') != 1: continue
        issn = c.get('issn','') or c.get('eissn','')
        j = issn_to_j.get(issn)
        if not j: continue
        # Skip if already has non-missing data
        has_review = issn in existing and not existing[issn].get('missing')
        if has_review: continue
        indices = j.get('indices', [])
        if 'SCIE' not in indices and 'SSCI' not in indices: continue
        targets.append({
            'name': j.get('name', c.get('name','')),
            'issn': issn,
            'eissn': c.get('eissn',''),
            'publisher': j.get('publisher', ''),
            'field': c.get('major_en',''),
        })
    
    with open(TARGETS_FILE, 'w') as f:
        json.dump(targets, f, ensure_ascii=False, indent=2)
    
    print(f"  {len(targets)} target journals")
    fields = Counter(t['field'] for t in targets)
    for f, c in fields.most_common():
        print(f"    {f}: {c}")
except Exception as e:
    print(f"  WARNING: Could not generate targets ({e}), using existing file")

# Step 1: Run build script
print("\n[1/4] Running build_review_cycles.py (DOAJ + CrossRef)...")
t0 = time.time()
result = subprocess.run(
    ["python3", str(BUILD_SCRIPT)],
    capture_output=True, text=True, timeout=43200
)
elapsed = time.time() - t0
print(result.stdout[-600:])
if result.returncode != 0:
    print(f"ERROR: build script failed (rc={result.returncode})")
    print(result.stderr[-500:])
    sys.exit(1)
print(f"Build completed in {elapsed:.0f}s")

# Step 2: Load results
print("\n[2/4] Loading results...")
with open(REVIEW_FILE) as f:
    review = json.load(f)
total_data = sum(1 for v in review.values() if not v.get('missing') and 'source' in v)
print(f"  {total_data} with data, {len(review) - total_data} missing")

# Step 3: Mark target journals as missing
print("\n[3/4] Marking known-missing journals...")
if TARGETS_FILE.exists():
    with open(TARGETS_FILE) as f:
        targets = json.load(f)
    
    marked = 0
    for t in targets:
        issn = t['issn']
        eissn = t.get('eissn', '')
        if issn not in review and eissn not in review:
            target_issn = issn if issn else eissn
            review[target_issn] = {
                "missing": True,
                "source": "Elsevier/SD blocked",
                "name": t['name'],
                "field": t.get('field', ''),
                "updated": date.today().isoformat(),
            }
            marked += 1
    
    print(f"  Marked {marked} as missing")
else:
    print(f"  Targets file not found, skipping")

# Save
with open(REVIEW_FILE, 'w') as f:
    json.dump(review, f, ensure_ascii=False, sort_keys=True)

final_data = sum(1 for v in review.values() if not v.get('missing') and 'source' in v)
final_missing = sum(1 for v in review.values() if v.get('missing'))
print(f"\n[4/4] Final: {len(review)} entries")
print(f"  With data (DOAJ+CrossRef): {final_data}")
print(f"  Marked missing:            {final_missing}")
print("DONE")
