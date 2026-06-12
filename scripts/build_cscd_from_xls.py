#!/usr/bin/env python3
"""Convert the CSCD source journal XLS export to data/cscd_journals.json."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "cscd_journals.json"
SOURCE_URL = "http://sciencechina.cn/select"


def clean_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    return str(value).strip()


def clean_issn(value) -> str:
    text = clean_text(value).upper()
    match = re.search(r"\b(\d{4})-?(\d{3}[\dX])\b", text)
    return f"{match.group(1)}-{match.group(2)}" if match else ""


def parse_export_time(path: Path) -> str:
    match = re.search(r"(\d{14})", path.name)
    if match:
        dt = datetime.strptime(match.group(1), "%Y%m%d%H%M%S")
        return dt.strftime("%Y-%m-%dT%H:%M:%S+08:00")
    return datetime.now().astimezone().isoformat(timespec="seconds")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("xls", type=Path, help="CSCD exported .xls file")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    df = pd.read_excel(args.xls, dtype=str).fillna("")
    required = {"刊名", "ISSN", "CN", "核心库/扩展库"}
    missing = required - set(df.columns)
    if missing:
        raise SystemExit(f"Missing required columns: {', '.join(sorted(missing))}")

    records = []
    seen = set()
    for _, row in df.iterrows():
        name = clean_text(row["刊名"])
        if not name:
            continue
        issn = clean_issn(row["ISSN"])
        cn_code = clean_text(row["CN"])
        database = clean_text(row["核心库/扩展库"]).upper()
        if database not in {"C", "E"}:
            database = ""
        key = (name.casefold(), issn, cn_code, database)
        if key in seen:
            continue
        seen.add(key)
        records.append(
            {
                "name": name,
                "issn": issn,
                "cn_code": cn_code,
                "database": database,
                "database_label": "核心库" if database == "C" else ("扩展库" if database == "E" else ""),
            }
        )

    by_issn = {}
    for rec in records:
        if rec["issn"]:
            by_issn.setdefault(rec["issn"], []).append(rec)

    payload = {
        "source": "中国科学引文数据库 CSCD 来源期刊目录",
        "source_url": SOURCE_URL,
        "fetched_at": parse_export_time(args.xls),
        "count": len(records),
        "records": records,
        "by_issn": by_issn,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} CSCD records to {args.output}")


if __name__ == "__main__":
    main()
