#!/usr/bin/env python3
"""Merge the supplied partial 2025 CITIC World-Class journal list.

The official query service does not publish a complete subject-level export.
This updater therefore keeps the supplied rows as a clearly marked partial
sample, preserves source ISSNs separately, and matches journals to the main
bundle by title before falling back to ISSN.
"""
from __future__ import annotations

import gzip
import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LIST = ROOT / "list"
INPUT = DATA / "citic_world_class_2025_input.txt"
MANUAL = DATA / "citic_world_class_manual_2025.json"
OUT_SOURCE = DATA / "citic_world_class_2025.json"
FULL_GZ = DATA / "journals.json.gz"
LIGHT_FILES = (DATA / "journals_light.json.gz", DATA / "journals_light_v2.json.gz")
ISSN_RE = re.compile(r"(?<![0-9])\d{4}-\d{3}[\dX](?![0-9])", re.I)


def clean_issn(value: object) -> str:
    match = re.search(r"\b(\d{4})-?(\d{3}[\dX])\b", str(value or "").upper())
    return f"{match.group(1)}-{match.group(2)}" if match else ""


def norm_title(value: object) -> str:
    text = str(value or "").upper()
    return re.sub(r"[^A-Z0-9\u4e00-\u9fff]+", "", text)


def read_json(path: Path):
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            return json.load(handle)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    temp = path.with_name(path.name + ".citic.tmp")
    if path.suffix == ".gz":
        buffer = io.BytesIO()
        with gzip.GzipFile(fileobj=buffer, mode="wb", compresslevel=9, mtime=0) as handle:
            handle.write(raw)
        temp.write_bytes(buffer.getvalue())
    else:
        temp.write_bytes(raw)
    os.replace(temp, path)


def title_candidates(raw: str) -> list[str]:
    raw = re.sub(r"\s+", " ", str(raw or "").strip())
    if not raw:
        return []
    candidates = [raw]
    # The supplied MDPI screenshot shortens the journal names by omitting
    # the publisher suffix used in the main bundle (for example
    # ``Agriculture`` -> ``AGRICULTURE-BASEL``). Keep these as title aliases
    # rather than inventing an ISSN that is not visible in the screenshot.
    candidates.append(f"{raw}-BASEL")
    if norm_title(raw) == "FIRE":
        candidates.append("FIRE-SWITZERLAND")
    # The pasted text retains one-letter alphabet section headings immediately
    # before the title: e.g. ``BBig Data...`` or ``F分析化学``.
    if len(raw) > 1 and re.match(r"^[A-Z]", raw):
        candidates.append(raw[1:].strip())
    return list(dict.fromkeys(candidates))


def parse_primary() -> list[dict]:
    text = INPUT.read_text(encoding="utf-8")
    zh_marker = text.find("中文期刊33种刊名ISSN")
    if zh_marker < 0:
        raise RuntimeError("CITIC input is missing the Chinese-journal section marker")
    en_start = text.find("英文期刊284种刊名ISSN")
    if en_start < 0:
        raise RuntimeError("CITIC input is missing the English-journal section marker")
    en_start += len("英文期刊284种刊名ISSN")
    matches = list(ISSN_RE.finditer(text))
    rows = []
    for idx, match in enumerate(matches):
        start = matches[idx - 1].end() if idx else en_start
        raw_title = text[start:match.start()]
        if not raw_title.strip():
            continue
        rows.append({
            "raw_name": raw_title.strip(),
            "issn": clean_issn(match.group()),
            "language": "zh" if match.start() >= zh_marker else "en",
            "subjects": [],
        })
    return rows


def build_lookup(records: list[dict]):
    by_issn: dict[str, dict] = {}
    by_title: dict[str, dict] = {}
    for rec in records:
        for value in (rec.get("issn"), rec.get("eissn")):
            key = clean_issn(value)
            if key:
                by_issn.setdefault(key, rec)
        for value in (rec.get("name"), rec.get("cn_name"), rec.get("en_name")):
            key = norm_title(value)
            if key:
                by_title.setdefault(key, rec)
    return by_issn, by_title


def find_record(raw_name: str, source_issn: str, by_issn, by_title):
    for candidate in title_candidates(raw_name):
        hit = by_title.get(norm_title(candidate))
        if hit is not None:
            return hit
    return by_issn.get(source_issn)


def make_slug(name: str, issn: str, used: set[str]) -> str:
    ascii_name = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60].rstrip("-")
    base = ascii_name or re.sub(r"[^0-9X]", "", issn.upper()) or "journal"
    candidate = base
    serial = 2
    while candidate in used:
        candidate = f"{base}-{serial}"
        serial += 1
    used.add(candidate)
    return candidate


def compact(value: dict) -> dict:
    return {key: value[key] for key in ("year", "source_issns", "language", "subjects", "publisher", "evidence", "partial") if value.get(key) not in (None, "", [], {})}


def main() -> int:
    records = read_json(FULL_GZ)
    by_issn, by_title = build_lookup(records)
    used = {str(rec.get("slug") or "") for rec in records if rec.get("slug")}
    source_entries: dict[str, dict] = {}
    unmatched = []

    primary = parse_primary()
    manual_doc = json.loads(MANUAL.read_text(encoding="utf-8"))
    manual = []
    for item in manual_doc.get("records", []):
        manual_name = str(item.get("name") or "")
        manual.append({
            "raw_name": manual_name,
            "issn": clean_issn(item.get("issn")),
            "language": "zh" if any("\u4e00" <= ch <= "\u9fff" for ch in manual_name) and not re.search(r"[A-Za-z]", manual_name) else "en",
            "subjects": list(item.get("subjects") or []),
            "cn_name": item.get("cn_name") or "",
            "publisher": item.get("publisher") or "",
            "evidence": item.get("evidence") or "",
        })

    for item in primary + manual:
        source_issn = clean_issn(item.get("issn"))
        rec = find_record(item.get("raw_name") or "", source_issn, by_issn, by_title)
        if rec is None:
            name = title_candidates(item.get("raw_name") or "")[0]
            rec = {
                "name": name,
                "issn": source_issn,
                "eissn": "",
                "publisher": "",
                "country": "China" if item.get("language") == "zh" else "",
                "indices": [],
                "wos_categories": [],
                "esi_category": "",
                "citic_world_class_only": True,
                "slug": make_slug(name, source_issn, used),
            }
            records.append(rec)
            by_issn[source_issn] = rec
            by_title[norm_title(name)] = rec
            unmatched.append({"name": name, "issn": source_issn})
        if item.get("cn_name") and not rec.get("cn_name"):
            rec["cn_name"] = item["cn_name"]
        key = str(rec.get("slug") or source_issn or norm_title(rec.get("name")))
        entry = source_entries.setdefault(key, {
            "name": rec.get("name") or title_candidates(item.get("raw_name") or "")[0],
            "issn": clean_issn(rec.get("issn")) or source_issn,
            "source_issns": [],
            "language": item.get("language") or "en",
            "subjects": [],
        })
        if item.get("publisher"):
            entry["publisher"] = item["publisher"]
        if item.get("evidence"):
            entry["evidence"] = item["evidence"]
        if source_issn and source_issn not in entry["source_issns"]:
            entry["source_issns"].append(source_issn)
        entry["subjects"] = sorted(set(entry["subjects"]) | set(item.get("subjects") or []))
        if item.get("language") == "zh":
            entry["language"] = "zh"
        rec["citic_world_class"] = {
            "year": 2025,
            "source": "中信所世界一流科技期刊目录",
            "source_issns": entry["source_issns"],
            "language": entry["language"],
            "subjects": entry["subjects"],
            "partial": True,
        }
        for optional_key in ("publisher", "evidence"):
            if entry.get(optional_key):
                rec["citic_world_class"][optional_key] = entry[optional_key]

    source_records = sorted(source_entries.values(), key=lambda x: (x["language"], norm_title(x["name"])))
    source_doc = {
        "source": "中信所世界一流科技期刊目录（2025年度）",
        "source_url": "https://wcj.istic.ac.cn/qikan/search",
        "source_image_url": manual_doc.get("source_image_url", ""),
        "source_year": 2025,
        "source_published": "2026-09-12",
        "partial": True,
        "note": "官方未公布按学科分类的完整名单；本文件为公开渠道可确认的部分名单（含用户提供的 MDPI、MAP、IEEE、南开大学、Frontiers 等用户补充条目），不代表完整 6,132 种目录。",
        "records": source_records,
        "unmatched_added": unmatched,
    }
    write_json(OUT_SOURCE, source_doc)

    records.sort(key=lambda rec: str(rec.get("name") or "").casefold())
    write_json(DATA / "journals.json", records)
    write_json(FULL_GZ, records)

    baseline = read_json(DATA / "journals_light.json.gz")
    by_slug = {str(row.get("slug") or ""): row for row in baseline}
    light = []
    for rec in records:
        slug = str(rec.get("slug") or "")
        row = dict(by_slug.get(slug) or {"name": rec.get("name"), "slug": slug})
        if rec.get("citic_world_class"):
            row["citic_world_class"] = compact(rec["citic_world_class"])
        else:
            row.pop("citic_world_class", None)
        light.append(row)
    for path in LIGHT_FILES:
        write_json(path, light)

    meta_path = DATA / "meta.json"
    meta = read_json(meta_path)
    source_parts = [part.strip() for part in str(meta.get("source") or "").split("+") if part.strip()]
    source_parts = [part for part in source_parts if not part.upper().startswith("CITIC WORLD-CLASS")]
    source_parts.append(f"CITIC World-Class 2025 (partial sample {len(source_records)})")
    meta.update({
        "source": " + ".join(source_parts),
        "total": len(records),
        "with_citic_world_class": len(source_records),
        "citic_world_class_source_updated": "2026-09-12",
        "citic_world_class_source_url": "https://wcj.istic.ac.cn/qikan/search",
        "citic_world_class_partial": True,
        "citic_world_class_sample_count": len(source_records),
        "citic_world_class_official_total": 6132,
        "data_bundle_updated": datetime.now(timezone.utc).date().isoformat(),
    })
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "primary_rows": len(primary),
        "manual_rows": len(manual),
        "unique_source_records": len(source_records),
        "total_records": len(records),
        "unmatched_added": unmatched,
        "with_citic_world_class": meta["with_citic_world_class"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
