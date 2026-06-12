#!/usr/bin/env python3
"""Match Retraction Watch aggregates to local journals and compute rates."""

from __future__ import annotations

import argparse
import gzip
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
JOURNALS = ROOT / "data" / "journals.json"
ANNUAL = ROOT / "data" / "annual_outputs.json"
RETRACTIONS = ROOT / "data" / "retraction_watch_journals.json"
OUT = ROOT / "data" / "retraction_metrics.json"
OUT_GZ = ROOT / "data" / "retraction_metrics.json.gz"


def norm_title(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "").lower()
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def int_by_year(mapping: dict, years: list[int]) -> int:
    return sum(int(mapping.get(str(year), 0) or 0) for year in years)


def annual_for(journal: dict, annual: dict, years: list[int]) -> int:
    values = []
    for field in ("issn", "eissn"):
        issn = journal.get(field)
        if issn and issn in annual:
            values.append(int_by_year(annual[issn], years))
    return max(values) if values else 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--current-year", type=int, default=datetime.now().year)
    args = parser.parse_args()

    if not (JOURNALS.exists() and ANNUAL.exists() and RETRACTIONS.exists()):
        raise SystemExit("journals.json, annual_outputs.json and retraction_watch_journals.json are required")

    journals = json.loads(JOURNALS.read_text(encoding="utf-8"))
    annual = json.loads(ANNUAL.read_text(encoding="utf-8"))
    rw = json.loads(RETRACTIONS.read_text(encoding="utf-8"))
    rw_by_norm = rw.get("by_norm", {})

    years_5 = list(range(args.current_year - 4, args.current_year + 1))
    years_10 = list(range(args.current_year - 9, args.current_year + 1))
    metrics = {}
    matched = 0

    for journal in journals:
        keys = [norm_title(journal.get("name") or ""), norm_title(journal.get("cn_name") or "")]
        record = next((rw_by_norm.get(key) for key in keys if key and rw_by_norm.get(key)), None)
        if not record:
            continue
        matched += 1
        ret_by_year = record.get("retractions_by_year") or {}
        ret_5 = int_by_year(ret_by_year, years_5)
        ret_10 = int_by_year(ret_by_year, years_10)
        works_5 = annual_for(journal, annual, years_5)
        works_10 = annual_for(journal, annual, years_10)
        metric = {
            "journal": journal.get("name") or "",
            "match_title": record.get("journal") or "",
            "retractions_total": record.get("retractions_total") or 0,
            "retractions_by_year": ret_by_year,
            "retractions_5y": ret_5,
            "retractions_10y": ret_10,
            "works_5y": works_5 or None,
            "works_10y": works_10 or None,
            "rate_per_1000_5y": round(ret_5 / works_5 * 1000, 4) if works_5 else None,
            "rate_per_1000_10y": round(ret_10 / works_10 * 1000, 4) if works_10 else None,
        }
        key = journal.get("issn") or journal.get("eissn") or norm_title(journal.get("name") or "")
        metrics[key] = {k: v for k, v in metric.items() if v not in (None, "", {})}

    payload = {
        "source": "Crossref Retraction Watch data + OpenAlex counts_by_year",
        "source_url": rw.get("source_url"),
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "current_year": args.current_year,
        "windows": {"5y": years_5, "10y": years_10},
        "matched_journals": matched,
        "count": len(metrics),
        "metrics": metrics,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    with gzip.open(OUT_GZ, "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(metrics)} retraction metrics to {OUT_GZ}")


if __name__ == "__main__":
    main()
