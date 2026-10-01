#!/usr/bin/env python3
"""Apply the 2026-09-21 WoS journal-list changes.

The attached September bulletin is treated as a data source.  The script is
deliberately ISSN-first: title changes are aliases, de-listings remove only
the affected WoS index, and new ESCI titles are added with the fields that
the source actually provides.
"""
from __future__ import annotations

import gzip
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

RENAMES = {
    "0100-2945": "Fruit Crops Science Journal",
    "2040-6223": "Sage Open Chronic Disease",
    "0253-1933": "Scientific and Technical Review-World Organisation for Animal Health",
    "0886-3520": "Journal of the Copyright Society",
    "0104-0146": "Informacao & Sociedade",
    "0957-154X": "History of Psychiatry-Madness Science Culture",
    "1971-8993": "Fracture and Structural Integrity",
}

DELISTED = {
    "1078-3466": "Editorial",
    "0972-0502": "Editorial",
    "0972-0529": "Editorial",
    "0718-8706": "Editorial",
    "1696-7348": "Editorial",
    "2548-0960": "Editorial",
    "1676-5680": "Editorial",
    "1744-6708": "Production",
    "0974-9233": "Cease",
    "1885-3137": "Cease",
    "1646-091X": "Cease",
    "1725-0463": "Cease",
}

# Source table on PDF page 8. Empty ISSN means the source supplied eISSN only.
ADDED = [
    ("Gifted Education International", "0261-4294", "2047-9077"),
    ("Zbornik Pravnog Fakulteta u Zagrebu", "0350-2058", "1849-1154"),
    ("Journal of Eurasian Studies", "1879-3665", "1879-3673"),
    ("Journal of Education in Science Environment and Health", "", "2149-214X"),
    ("Schmalenbach Journal of Business Research", "0341-2687", "2366-6153"),
    ("Journal of Education and Research in Nursing", "", "2757-9204"),
    ("Consumer Behavior in Tourism and Hospitality", "2752-6666", "2752-6674"),
    ("Sustainable Food Proteins", "2771-9693", "2771-9693"),
    ("International Journal of Community and Social Development", "2516-6026", "2516-6034"),
    ("Annals of Surgery Open", "", "2691-3593"),
    ("Genetics in Medicine Open", "", "2949-7744"),
    ("Decisions Marketing", "0779-7389", "2269-8469"),
    ("Chips", "", "2674-0729"),
    ("Journal of Anesthesia and Translational Medicine", "", "2957-3912"),
    ("Food Science of Animal Products", "2958-4124", "2958-3780"),
    ("Synthetic Biology and Engineering", "2958-9045", "2958-9053"),
]

# The supplied On Hold table has 26 entries; the first 24 are marked Under
# Review and the last two are not.
ON_HOLD = [
    ("IEEE TRANSACTIONS ON INTELLIGENT VEHICLES", "2379-8858", "2379-8904", 2024, "SCI/SCIE", 14.3, "计算机科学 2区", True),
    ("INTERNATIONAL JOURNAL OF SURGERY", "1743-9191", "1743-9159", 2026, "SCI/SCIE", 10.3, "医学 2区", True),
    ("BIOMEDICINE & PHARMACOTHERAPY", "0753-3322", "1950-6007", 2024, "SCI/SCIE", 7.5, "医学 2区", True),
    ("OPTICAL AND QUANTUM ELECTRONICS", "0306-8919", "1572-817X", 2024, "SCI/SCIE", 4.0, "工程技术 3区", True),
    ("ENVIRONMENTAL TOXICOLOGY", "1520-4081", "1522-7278", 2024, "SCI/SCIE", 3.2, "医学 3区", True),
    ("SOFT COMPUTING", "1432-7643", "1433-7479", 2024, "SCI/SCIE", 2.5, "计算机科学 4区", True),
    ("FRONTIERS IN ENERGY RESEARCH", "2296-598X", "2296-598X", 2024, "SCI/SCIE", 2.4, "工程技术 4区", True),
    ("JOURNAL OF INTELLIGENT & FUZZY SYSTEMS", "1064-1246", "1875-8967", 2024, "SCI/SCIE", 1.0, "计算机科学 4区", True),
    ("ANNALS OF MEDICINE AND SURGERY", "2049-0801", "2049-0801", 2026, "ESCI", 1.6, "医学4区", True),
    ("INTERNATIONAL JOURNAL OF SURGERY PROTOCOLS", "2468-3574", "2468-3574", 2026, "ESCI", 1.1, "医学4区", True),
    ("INTERNATIONAL JOURNAL OF SURGERY OPEN", "2405-8572", "2405-8572", 2026, "ESCI", 0.8, "医学4区", True),
    ("INTERNATIONAL JOURNAL OF SURGERY CASE REPORTS", "2210-2612", "2210-2612", 2026, "ESCI", 0.7, "医学4区", True),
    ("INTERNATIONAL JOURNAL OF SURGERY ONCOLOGY", "2471-3864", "2471-3864", 2026, "ESCI", 0.1, "医学4区", True),
    ("TWMS JOURNAL OF PURE AND APPLIED MATHEMATICS", "2076-2585", "2219-1259", 2026, "SCI/SCIE", 3.2, "数学 2区", True),
    ("ALEXANDRIA ENGINEERING JOURNAL", "1110-0168", "2090-2670", 2026, "SCI/SCIE", 6.8, "工程技术 2区 Top", True),
    ("APPLIED AND COMPUTATIONAL MATHEMATICS", "1683-3511", "1683-6154", 2026, "SCI/SCIE", 4.3, "数学 1区 Top", True),
    ("REVUE ROUMAINE DES SCIENCES TECHNIQUES-SERIE ELECTROTECHNIQUE ET ENERGETIQUE", "0035-4066", "0035-4066", 2026, "SCI/SCIE", 1.1, "工程技术 4区", True),
    ("NEW MATERIALS COMPOUNDS AND APPLICATIONS", "2521-7194", "2523-4773", 2026, "ESCI", 0.8, "材料科学 4区", True),
    ("JOURNAL OF AGRICULTURAL EXTENSION", "1119-944X", "2408-6851", 2026, "ESCI", 1.2, "农林科学 3区", True),
    ("TWMS JOURNAL OF APPLIED AND ENGINEERING MATHEMATICS", "2146-1147", "2587-1013", 2026, "ESCI", 0.4, "数学 4区", True),
    ("BALNEO AND PRM RESEARCH JOURNAL", "2734-844X", "2734-8458", 2026, "ESCI", 1.1, "医学 4区", True),
    ("BANGLADESH JOURNAL OF MEDICAL SCIENCE", "2223-4721", "2076-0299", 2026, "ESCI", 1.1, "医学 4区", True),
    ("INTERNATIONAL JOURNAL OF E-HEALTH AND MEDICAL COMMUNICATIONS", "1947-315X", "1947-3168", 2026, "ESCI", 1.7, "医学 4区", True),
    ("CIVIL AND ENVIRONMENTAL ENGINEERING", "1336-5835", "2199-6512", 2026, "ESCI", 2.3, "工程技术 4区", True),
    ("European Journal of Prosthodontics and Restorative Dentistry", "0965-7452", "2396-8893", 2026, "ESCI", 1.5, "医学 4区", False),
    ("Advanced Electromagnetics", "2119-0275", "2119-0275", 2026, "ESCI", 1.2, "工程技术 4区", False),
]

def bare(v: str) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", str(v or "")).upper()

def lookup(records):
    out = {}
    for r in records:
        for k in ("issn", "eissn"):
            if r.get(k): out[bare(r[k])] = r
    return out

def apply_records(records):
    by_id = lookup(records)
    changed = {"renamed": 0, "delisted": 0, "added": 0, "esci": 0}
    # Recompute this snapshot instead of retaining a prior On Hold list.
    for r in records:
        r.pop("on_hold", None)
        r.pop("on_hold_order", None)
    for old, new in RENAMES.items():
        r = by_id.get(bare(old))
        if not r: continue
        old_name = r.get("name") or ""
        if old_name != new:
            r["name"] = new
            r["aliases"] = list(dict.fromkeys([*(r.get("aliases") or []), old_name]))
            changed["renamed"] += 1
        r["wos_title_change"] = {"date": "2026-09-21", "from": old_name, "to": new}
    for issn, reason in DELISTED.items():
        r = by_id.get(bare(issn))
        if not r: continue
        if "ESCI" in (r.get("indices") or []):
            r["indices"] = [x for x in r["indices"] if x != "ESCI"]
            changed["delisted"] += 1
        r["wos_status"] = "delisted"
        r["wos_delisted_at"] = "2026-09-21"
        r["wos_delist_reason"] = reason
    for name, issn, eissn in ADDED:
        r = by_id.get(bare(issn)) or by_id.get(bare(eissn))
        if r is None:
            r = {"name": name, "issn": issn, "eissn": eissn, "indices": [], "slug": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")}
            records.append(r)
            by_id.update({bare(issn): r, bare(eissn): r})
            changed["added"] += 1
        if issn and not r.get("issn"): r["issn"] = issn
        if eissn and not r.get("eissn"): r["eissn"] = eissn
        if "ESCI" not in (r.get("indices") or []):
            r["indices"] = [*(r.get("indices") or []), "ESCI"]
            changed["esci"] += 1
        r["wos_added_at"] = "2026-09-21"
        r["wos_source"] = "WoS Core 2026-09-21 bulletin"
    status_ids = {}
    review_ids = set()
    for order, (_, issn, eissn, _year, _db, _iff, _zone, review) in enumerate(ON_HOLD):
        for v in (issn, eissn):
            if v:
                status_ids[bare(v)] = order
                if review: review_ids.add(bare(v))
    for r in records:
        ids = [bare(r.get(k)) for k in ("issn", "eissn") if r.get(k)]
        oh = next((status_ids[x] for x in ids if x in status_ids), None)
        if oh is not None:
            r["on_hold"] = True
            r["on_hold_order"] = oh
        if any(x in review_ids for x in ids):
            r["under_review"] = True
    return changed

def write_json(path: Path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")

def main():
    journals_path = DATA / "journals.json"
    if journals_path.exists():
        records = json.loads(journals_path.read_text())
    else:
        with gzip.open(DATA / "journals.json.gz", "rt", encoding="utf-8") as f: records = json.load(f)
    changed = apply_records(records)
    # Keep the plain build output (ignored locally) and both tracked light/full bundles in sync.
    write_json(journals_path, records)
    for filename in ("journals.json.gz", "journals_light.json.gz", "journals_light_v2.json.gz"):
        path = DATA / filename
        if filename.startswith("journals.json") and path.name == "journals.json.gz": payload = records
        else:
            with gzip.open(path, "rt", encoding="utf-8") as f: payload = json.load(f)
            apply_records(payload)
        with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as f: json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    # ISSN sidecar drives the browser's status overlay without rebuilding the full corpus.
    issns = []
    for _, issn, eissn, *_ in ON_HOLD:
        for v in (issn, eissn):
            if v and bare(v) not in {bare(x) for x in issns}: issns.append(v)
    write_json(DATA / "on_hold_issn.json", issns)
    under = json.loads((DATA / "under_review_issn.json").read_text())
    for _, issn, eissn, *_rest, review in ON_HOLD:
        if review:
            for v in (issn, eissn):
                if v and bare(v) not in {bare(x) for x in under}: under.append(v)
    write_json(DATA / "under_review_issn.json", under)
    # Dynamic source snapshot is intentionally explicit about provenance.
    dyn = {
        "source_url": "user-provided screenshot",
        "crawled_at": "2026-10-01T00:00:00Z",
        "list_name": "期刊On Hold名单（用户提供，26本）",
        "updated_at_text": "用户提供截图（2026-10-01）",
        "count": len(ON_HOLD),
        "items": [dict(no=i + 1, journal_name=n, issn=issn, eissn=eissn, marked_year=year, source_db=db, impact_factor=iff, cas_xr_zone=zone, cas_xr_under_review="Yes" if review else "-", list_name="期刊On Hold名单（用户提供）") for i, (n, issn, eissn, year, db, iff, zone, review) in enumerate(ON_HOLD)],
    }
    write_json(ROOT / "list/topeditsci_on_hold_dynamic.json", dyn)
    meta_path = DATA / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta["total"] = len(records)
    meta.setdefault("indices", {})
    for key in ("ESCI", "SCIE", "SSCI", "AHCI", "EI"):
        meta["indices"][key] = sum(key in (r.get("indices") or []) for r in records)
    meta["with_on_hold"] = sum(bool(r.get("on_hold")) for r in records if r.get("on_hold"))
    meta["wos_core_update"] = {"date": "2026-09-21", "added_esci": 16, "renamed": 7, "delisted": 12, "on_hold_snapshot": 26}
    write_json(meta_path, meta)
    print(json.dumps({"records": len(records), **changed, "on_hold_issns": len(issns), "under_review_issns": len(under)}, ensure_ascii=False))

if __name__ == "__main__": main()
