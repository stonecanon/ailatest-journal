#!/usr/bin/env python3
"""Strip large fields from journals.json and deploy via wrangler."""
import json
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "data" / "journals.json"
TMP = ROOT / "data" / "journals_deploy.json"
BAK = ROOT / "data" / "journals.json.bak"

# Fields to strip for deploy (used only in detail drawer, safe to remove)
STRIP_FIELDS = {"address"}  # ~1.8 MB

data = json.loads(SRC.read_text(encoding="utf-8"))
orig_size = SRC.stat().st_size

for j in data:
    for f in STRIP_FIELDS:
        j.pop(f, None)

# Write trimmed version
with open(TMP, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

new_size = TMP.stat().st_size
print(f"Stripped {STRIP_FIELDS}")
print(f"  Before: {orig_size:,} bytes ({orig_size/1024/1024:.1f} MB, {orig_size/1024/1024/1.048576:.1f} MiB)")
print(f"  After:  {new_size:,} bytes ({new_size/1024/1024:.1f} MB, {new_size/1024/1024/1.048576:.1f} MiB)")
print(f"  Saved:  {orig_size - new_size:,} bytes ({(orig_size-new_size)/1024/1024:.1f} MB)")
