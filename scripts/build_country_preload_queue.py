#!/usr/bin/env python3
"""Build the ranked 2025 affiliation-country preload queue.

The queue deliberately starts with journals that have a strong, explainable
signal in the catalogue: flagship/FT50 labels, CAS/JCR Q1, Web of Science
coverage, and then the 2025 impact factor/JCI.  The Worker consumes this file
in small daily batches, so the file is a manifest rather than the data itself.
"""

from __future__ import annotations

import gzip
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "journals.json.gz"
OUTPUT = ROOT / "data" / "country_preload_top_2025.json"
LIMIT = 50000


def norm_issn(value: object) -> str:
    text = str(value or "").strip().upper().replace("–", "-")
    compact = "".join(ch for ch in text if ch.isdigit() or ch == "X")
    if len(compact) != 8:
        return ""
    return f"{compact[:4]}-{compact[4:]}"


def number(value: object) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return -1.0
    return result if math.isfinite(result) else -1.0


def quartile(value: object) -> str:
    if isinstance(value, (list, tuple)):
        values = value
    else:
        values = [value]
    for item in values:
        text = str(item or "").upper().strip()
        if text in {"Q1", "1", "一区", "1区"}:
            return "Q1"
    return ""


def is_zone_one(row: dict) -> bool:
    for key in ("cas_major_zone", "cas_zone"):
        value = row.get(key)
        if str(value or "").strip() in {"1", "Q1", "一区", "1区"}:
            return True
    return False


def make_record(row: dict) -> dict | None:
    issn = norm_issn(row.get("issn"))
    eissn = norm_issn(row.get("eissn"))
    if not issn and not eissn:
        return None
    if issn == eissn:
        eissn = ""

    name = str(row.get("name") or row.get("journal_title") or "").strip()
    if_q1 = quartile(row.get("if_quartile")) or quartile(row.get("jcr_quartile"))
    zone_one = is_zone_one(row)
    flagship = bool(row.get("flagship"))
    ft50 = bool(row.get("ft50"))
    wos = any(str(item or "").upper() in {"SCIE", "SSCI", "AHCI"} for item in (row.get("indices") or []))

    # Keep a transparent tier as a tie-breaker.  The 2025 IF/JCI still lead
    # the queue so a clear field-leading title (for example CA-A) cannot be
    # pushed behind a prestige-labelled journal with a much lower IF.
    tier = (4 if flagship or ft50 else 0) + (2 if zone_one or if_q1 == "Q1" else 0) + (1 if wos else 0)
    impact = number(row.get("if_2025"))
    jci = number(row.get("jci_2025"))
    return {
        "name": name,
        "issn": issn,
        "eissn": eissn,
        "tier": tier,
        "if_2025": impact if impact >= 0 else None,
        "jci_2025": jci if jci >= 0 else None,
        "if_quartile": if_q1,
        "cas_zone": row.get("cas_zone") or row.get("cas_major_zone") or "",
        "flags": [flag for flag, enabled in (("flagship", flagship), ("ft50", ft50), ("cas_q1", zone_one), ("jcr_q1", if_q1 == "Q1"), ("wos", wos)) if enabled],
    }


def main() -> None:
    with gzip.open(SOURCE, "rt", encoding="utf-8") as handle:
        rows = json.load(handle)

    unique: dict[tuple[str, str], dict] = {}
    for row in rows:
        record = make_record(row)
        if not record:
            continue
        key = (record["issn"], record["eissn"])
        previous = unique.get(key)
        # Keep the richer row when the source catalogue has duplicate ISSN
        # records from different index merges.
        if previous is None or (record["tier"], record["if_2025"] or -1, record["jci_2025"] or -1) > (
            previous["tier"], previous["if_2025"] or -1, previous["jci_2025"] or -1
        ):
            unique[key] = record

    records = sorted(
        unique.values(),
        key=lambda item: (
            -(item["if_2025"] if item["if_2025"] is not None else -1),
            -(item["jci_2025"] if item["jci_2025"] is not None else -1),
            -item["tier"],
            item["name"].casefold(),
        ),
    )[:LIMIT]
    output = []
    for rank, item in enumerate(records, 1):
        output.append({"rank": rank, **item})
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT}: {len(output):,} jobs from {len(unique):,} unique ISSN pairs")
    print("top 10:")
    for item in output[:10]:
        print(f"  {item['rank']:>4}  {item['name']}  {item['issn'] or item['eissn']}  IF={item['if_2025']}")


if __name__ == "__main__":
    main()
