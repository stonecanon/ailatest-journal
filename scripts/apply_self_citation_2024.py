#!/usr/bin/env python3
"""把 jif_without_self_cites_2024.csv 合并进 journals.json.gz 的
self_citation_rate_history（2024 点）。先读再写，幂等。

自引贡献率 = (JIF - JIF_without_self) / JIF * 100
"""
from __future__ import annotations

import csv
import gzip
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_GZ = ROOT / "data" / "journals.json.gz"
DATA_JSON = ROOT / "data" / "journals.json"
LIGHT_GZ = ROOT / "data" / "journals_mobile.json.gz"
LIGHT_JSON = ROOT / "data" / "journals_mobile.json"
CSV_PATH = ROOT / "list" / "jif_without_self_cites_2024.csv"
META_PATH = ROOT / "data" / "meta.json"


def read_gz(path: Path):
    return json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))


def write_gz(path: Path, data) -> None:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    import io
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9) as f:
        f.write(raw)
    path.write_bytes(buf.getvalue())


def norm_issn(value: str) -> str:
    return str(value or "").upper().replace("-", "").strip()


def main() -> int:
    rows = list(csv.DictReader(open(CSV_PATH, encoding="utf-8")))
    by_issn: dict[str, dict] = {}
    by_eissn: dict[str, dict] = {}
    for r in rows:
        i = norm_issn(r.get("issn"))
        e = norm_issn(r.get("eissn"))
        if i:
            by_issn.setdefault(i, r)
        if e:
            by_eissn.setdefault(e, r)

    data = read_gz(DATA_GZ)
    journals = data if isinstance(data, list) else data.get("journals", [])
    matched = 0
    for rec in journals:
        issn = norm_issn(rec.get("issn"))
        eissn = norm_issn(rec.get("eissn"))
        row = by_issn.get(issn) or by_eissn.get(eissn)
        if not row:
            continue
        jif = float(row.get("jif") or 0) or None
        jif_no_self = float(row.get("jif_without_self_cites") or 0) or None
        if not jif or jif_no_self is None:
            continue
        rate = max(0.0, (jif - jif_no_self) / jif * 100)
        hist = rec.setdefault("self_citation_rate_history", {})
        hist["2024"] = round(rate, 2)
        rec["self_citation_rate_2024"] = round(rate, 2)
        rec["jif_without_self_cites_2024"] = jif_no_self
        matched += 1

    write_gz(DATA_GZ, journals)
    DATA_JSON.write_text(json.dumps(journals, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    # 更新 light index 中的自引字段（如果有）
    for LIGHT_GZ, LIGHT_JSON in ((ROOT / "data" / "jm.json.gz", ROOT / "data" / "jm.json"),
                                 (ROOT / "data" / "journals_mobile.json.gz", ROOT / "data" / "journals_mobile.json")):
        if not LIGHT_GZ.exists():
            continue
        try:
            light = read_gz(LIGHT_GZ)
        except Exception:
            continue
        if isinstance(light, list):
            light_by_issn = {norm_issn(r.get("issn")): r for r in light if r.get("issn")}
            for rec in journals:
                r = light_by_issn.get(norm_issn(rec.get("issn")))
                if r is not None and rec.get("self_citation_rate_history"):
                    r["self_citation_rate_history"] = rec["self_citation_rate_history"]
                    if rec.get("self_citation_rate_2024") is not None:
                        r["self_citation_rate_2024"] = rec["self_citation_rate_2024"]
            write_gz(LIGHT_GZ, light)
            LIGHT_JSON.write_text(json.dumps(light, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"light index synced: {LIGHT_GZ.name}")

    if META_PATH.exists():
        meta = json.loads(META_PATH.read_text(encoding="utf-8"))
        meta["with_self_citation_2024"] = matched
        META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"matched journals with 2024 self-cite: {matched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
