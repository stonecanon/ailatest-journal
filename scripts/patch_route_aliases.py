#!/usr/bin/env python3
"""给完整记录添加 routeAliases，修复短刊名深链被空壳目录记录抢占的问题。

案例：/journal/governance/ 原本命中 ABS 空壳「Governance」(无 ISSN/SSCI)，
而完整 SSCI 记录 GOVERNANCE-AN INTERNATIONAL JOURNAL... (0952-1895) slug 是长名。
给完整记录加 routeAliases: ['governance'] 后，前端 recordRouteKeys 可匹配到它，
且 findRecByFid 优先信息完整的记录。
"""
from __future__ import annotations

import gzip
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_GZ = ROOT / "data" / "journals.json.gz"
DATA_JSON = ROOT / "data" / "journals.json"
LIGHT_FILES = [
    (ROOT / "data" / "journals_light.json.gz", None),
    (ROOT / "data" / "jm.json.gz", ROOT / "data" / "jm.json"),
    (ROOT / "data" / "journals_mobile.json.gz", ROOT / "data" / "journals_mobile.json"),
]

# (匹配完整记录的 norm ISSN, 要加的 routeAliases)
ALIASES = [
    ("09521895", ["governance"]),   # GOVERNANCE-AN INTERNATIONAL JOURNAL OF POLICY...
    ("17485983", ["regulation-governance", "regulation-and-governance"]),  # REGULATION & GOVERNANCE
]


def norm_issn(v):
    return str(v or "").upper().replace("-", "").strip()


def read_gz(path: Path):
    return json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))


def write_gz(path: Path, data) -> None:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9) as f:
        f.write(raw)
    path.write_bytes(buf.getvalue())


def main() -> int:
    data = read_gz(DATA_GZ)
    journals = data if isinstance(data, list) else data.get("journals", [])
    patched = 0
    for rec in journals:
        for issn, aliases in ALIASES:
            if norm_issn(rec.get("issn")) == issn or norm_issn(rec.get("eissn")) == issn:
                existing = rec.get("routeAliases") or []
                merged = list(dict.fromkeys([*existing, *aliases]))
                rec["routeAliases"] = merged
                patched += 1
    write_gz(DATA_GZ, journals)
    DATA_JSON.write_text(json.dumps(journals, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    # 同步 light index
    for gz, js in LIGHT_FILES:
        if not gz.exists():
            continue
        try:
            light = read_gz(gz)
        except Exception:
            continue
        if isinstance(light, list):
            for rec in light:
                for issn, aliases in ALIASES:
                    if norm_issn(rec.get("issn")) == issn or norm_issn(rec.get("eissn")) == issn:
                        rec["routeAliases"] = list(dict.fromkeys([*(rec.get("routeAliases") or []), *aliases]))
            write_gz(gz, light)
            js.write_text(json.dumps(light, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"patched {patched} records with routeAliases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
