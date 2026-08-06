#!/usr/bin/env python3
"""Refresh the official public DOAJ Journal CSV with validation.

The public export is refreshed monthly and redirects to a dated object. This
updater validates the schema and row count before atomically replacing the
local build source, so a transient error page can never become journal data.
"""
from __future__ import annotations

import csv
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
LIST = ROOT / "list"
OUT = LIST / "doaj_journals.csv"
META = LIST / "doaj_meta.json"
SOURCE_URL = "https://doaj.org/csv"
REQUIRED_COLUMNS = {
    "Journal title",
    "Journal ISSN (print version)",
    "Journal EISSN (online version)",
    "URL in DOAJ",
}


def main() -> int:
    LIST.mkdir(parents=True, exist_ok=True)
    request = Request(
        SOURCE_URL,
        headers={"User-Agent": "ailatest-journal-data-refresh/1.0 (+https://journal.ailatest.org)"},
    )
    temp_path: Path | None = None
    try:
        with urlopen(request, timeout=180) as response:
            final_url = response.geturl()
            with tempfile.NamedTemporaryFile(prefix="doaj-", suffix=".csv", dir=LIST, delete=False) as temp:
                temp_path = Path(temp.name)
                while chunk := response.read(1024 * 1024):
                    temp.write(chunk)

        with temp_path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            columns = set(reader.fieldnames or [])
            missing = REQUIRED_COLUMNS - columns
            if missing:
                raise RuntimeError(f"DOAJ export is missing required columns: {sorted(missing)}")
            rows = sum(1 for row in reader if str(row.get("Journal title") or "").strip())
        if rows < 20_000:
            raise RuntimeError(f"Implausible DOAJ row count: {rows}")

        dated = re.search(r"doaj_journalcsv_(\d{8})_", final_url)
        source_updated = ""
        if dated:
            raw = dated.group(1)
            source_updated = f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
        os.replace(temp_path, OUT)
        temp_path = None

        meta = {
            "source": "DOAJ public Journal CSV",
            "source_url": SOURCE_URL,
            "resolved_url": final_url.split("?", 1)[0],
            "source_updated": source_updated,
            "fetched_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "row_count": rows,
        }
        meta_temp = META.with_suffix(".json.tmp")
        meta_temp.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(meta_temp, META)
        print(json.dumps(meta, ensure_ascii=False, indent=2))
        return 0
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
