#!/usr/bin/env python3
"""Apply the user-provided 2026-10-01 Xinrui Under Review workbook snapshot."""
from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

# (title, ISSN, EISSN, Chinese subject, English subject)
ROWS = [
    ("ACTA VIROLOGICA", "0001-723X", "1336-2305", "医学", "Medicine"),
    ("Action Learning", "1476-7333", "1476-7341", "教育学", "Education Science"),
    ("Advanced Electromagnetics", "2119-0275", "2119-0275", "工程技术", "Engineering"),
    ("Advances and Applications in Discrete Mathematics", "0974-1658", "0974-1658", "数学", "Mathematics"),
    ("Aestimum", "1592-6117", "1724-2118", "经济学", "Economics"),
    ("Aging Medicine and Healthcare", "", "2663-8851", "医学", "Medicine"),
    ("Alexandria Engineering Journal", "1110-0168", "2090-2670", "工程技术", "Engineering"),
    ("Annals in Social Responsibility", "2056-3515", "2056-3523", "管理学", "Management"),
    ("Annals of Medicine and Surgery", "2049-0801", "2049-0801", "医学", "Medicine"),
    ("Aposta-Revista de Ciencias Sociales", "1696-7348", "1696-7348", "社会学", "Sociology"),
    ("Applied and Computational Mathematics", "1683-3511", "1683-6154", "数学", "Mathematics"),
    ("APPLIED ORGANOMETALLIC CHEMISTRY", "0268-2605", "1099-0739", "化学", "Chemistry"),
    ("Archaologisches Korrespondenzblatt", "0342-734X", "2364-4729", "历史学", "History"),
    ("Archives of Budo Science of Martial Arts and Extreme Sports", "2300-8822", "2300-8822", "医学", "Medicine"),
    ("Asian Journal of Agriculture and Biology", "2307-8553", "2307-8553", "农林科学", "Agricultural Sciences"),
    ("Avances en Ciencias e Ingenieria", "0718-8706", "0718-8706", "工程技术", "Engineering"),
    ("Balneo and PRM Research Journal", "2734-844X", "2734-8458", "医学", "Medicine"),
    ("Bangladesh Journal of Medical Science", "2223-4721", "2076-0299", "医学", "Medicine"),
    ("BIOMEDICINE & PHARMACOTHERAPY", "0753-3322", "1950-6007", "医学", "Medicine"),
    ("Chemical Methodologies", "2645-7776", "2588-4344", "化学", "Chemistry"),
    ("Civil and Environmental Engineering", "1336-5835", "2199-6512", "工程技术", "Engineering"),
    ("CLINICAL HEMORHEOLOGY AND MICROCIRCULATION", "1386-0291", "1875-8622", "医学", "Medicine"),
    ("E-Water", "1994-8549", "1994-8549", "环境科学与生态学", "Environmental Sciences & Ecology"),
    ("Engineering Letters", "1816-093X", "1816-0948", "工程技术", "Engineering"),
    ("ENVIRONMENTAL TOXICOLOGY", "1520-4081", "1522-7278", "医学", "Medicine"),
    ("European Journal of Prosthodontics and Restorative Dentistry", "0965-7452", "2396-8893", "医学", "Medicine"),
    ("European Journal of Pure and Applied Mathematics", "1307-5543", "1307-5543", "数学", "Mathematics"),
    ("Frontiers in Energy Research", "2296-598X", "2296-598X", "工程技术", "Engineering"),
    ("GENETIC RESOURCES AND CROP EVOLUTION", "0925-9864", "1573-5109", "农林科学", "Agricultural Sciences"),
    ("GENETICS AND MOLECULAR RESEARCH", "", "1676-5680", "生物学", "Biology"),
    ("IEEE Transactions on Intelligent Vehicles", "2379-8858", "2379-8904", "计算机科学", "Computer Science"),
    ("INDIAN JOURNAL OF BIOCHEMISTRY & BIOPHYSICS", "0301-1208", "0975-0959", "生物学", "Biology"),
    ("International Journal of E-Health and Medical Communications", "1947-315X", "1947-3168", "医学", "Medicine"),
    ("International Journal of Engineering and Geosciences", "2548-0960", "2548-0960", "工程技术", "Engineering"),
    ("International Journal of Intelligent Engineering Informatics", "1758-8715", "1758-8723", "计算机科学", "Computer Science"),
    ("International Journal of Power and Energy Systems", "1078-3466", "1710-2243", "工程技术", "Engineering"),
    ("International Journal of Special Education", "0827-3383", "0827-3383", "教育学", "Education Science"),
    ("International Journal of Surgery", "1743-9191", "1743-9159", "医学", "Medicine"),
    ("International Journal of Surgery Case Reports", "2210-2612", "2210-2612", "医学", "Medicine"),
    ("International Journal of Surgery Open", "2405-8572", "2405-8572", "医学", "Medicine"),
    ("International Journal of Surgery Protocols", "2468-3574", "2468-3574", "医学", "Medicine"),
    ("International Journal of Surgery-Oncology", "2471-3864", "2471-3864", "医学", "Medicine"),
    ("Jordan Journal of Mechanical and Industrial Engineering", "1995-6665", "1995-6665", "工程技术", "Engineering"),
    ("Journal of Agricultural & Food Information", "1049-6505", "1540-4722", "农林科学", "Agricultural Sciences"),
    ("Journal of Agricultural Extension", "1119-944X", "2408-6851", "农林科学", "Agricultural Sciences"),
    ("Journal of Computational Methods in Sciences and Engineering", "1472-7978", "1875-8983", "工程技术", "Engineering"),
    ("JOURNAL OF DISCRETE MATHEMATICAL SCIENCES & CRYPTOGRAPHY", "0972-0529", "2169-0065", "数学", "Mathematics"),
    ("Journal of Earthquake and Tsunami", "1793-4311", "1793-7116", "工程技术", "Engineering"),
    ("JOURNAL OF GEOLOGY", "0022-1376", "1537-5269", "地球科学", "Earth Sciences"),
    ("JOURNAL OF INTELLIGENT & FUZZY SYSTEMS", "1064-1246", "1875-8967", "计算机科学", "Computer Science"),
    ("Journal of Inter-Organizational Relationships", "2694-3980", "2694-3999", "管理学", "Management"),
    ("JOURNAL OF INTERDISCIPLINARY MATHEMATICS", "0972-0502", "2169-012X", "数学", "Mathematics"),
    ("Journal of Qualitative Research in Education-Egitimde Nitel Arastirmalar Dergisi", "2148-2624", "2148-2624", "教育学", "Education Science"),
    ("Journal of Structured Finance", "1551-9783", "2374-1325", "经济学", "Economics"),
    ("Journal of the Pancreas", "1590-8577", "1590-8577", "医学", "Medicine"),
    ("Journal of the Royal College of Physicians of Edinburgh", "1478-2715", "2042-8189", "医学", "Medicine"),
    ("LCGC EUROPE", "1471-6577", "1471-6577", "化学", "Chemistry"),
    ("Lobachevskii Journal of Mathematics", "1995-0802", "1818-9962", "数学", "Mathematics"),
    ("MECHANICS OF ADVANCED MATERIALS AND STRUCTURES", "1537-6494", "1537-6532", "材料科学", "Materials Science"),
    ("Media Education-Mediaobrazovanie", "1994-4160", "1994-4195", "文学", "Literature"),
    ("Middle East African Journal of Ophthalmology", "0974-9233", "0975-1599", "医学", "Medicine"),
    ("New Materials Compounds and Applications", "2521-7194", "2523-4773", "材料科学", "Materials Science"),
    ("OPTICAL AND QUANTUM ELECTRONICS", "0306-8919", "1572-817X", "工程技术", "Engineering"),
    ("Psychomusicology", "0275-3987", "2162-1535", "心理学", "Psychology"),
    ("Punjab University Journal of Mathematics", "", "1016-2526", "数学", "Mathematics"),
    ("Revista Uruguaya de Historia Economica", "1688-8561", "1688-8561", "经济学", "Economics"),
    ("Revue de Geographie Alpine-Journal of Alpine Research", "0035-1121", "1760-7426", "社会学", "Sociology"),
    ("Revue Roumaine des Sciences Techniques-Serie Electrotechnique et Energetique", "0035-4066", "", "工程技术", "Engineering"),
    ("RUSSIAN CHEMICAL BULLETIN", "1066-5285", "1573-9171", "化学", "Chemistry"),
    ("Russian Journal of Physical Chemistry B", "1990-7931", "1990-7923", "化学", "Chemistry"),
    ("SOFT COMPUTING", "1432-7643", "1433-7479", "计算机科学", "Computer Science"),
    ("Studia Historiae Oeconomicae", "", "0081-6485", "历史学", "History"),
    ("TeMA-Journal of Land Use Mobility and Environment", "1970-9889", "1970-9870", "经济学", "Economics"),
    ("Transactions of FAMENA", "1333-1124", "1333-1124", "工程技术", "Engineering"),
    ("TWMS Journal of Applied and Engineering Mathematics", "2146-1147", "2146-1147", "数学", "Mathematics"),
    ("TWMS Journal of Pure and Applied Mathematics", "2076-2585", "2219-1259", "数学", "Mathematics"),
    ("Veredas do Direito", "1806-3845", "2179-8699", "社会学", "Sociology"),
    ("Vestnik St Petersburg University-Mathematics", "1063-4541", "1934-7855", "数学", "Mathematics"),
    ("Vulcan", "2213-459X", "2213-4603", "历史学", "History"),
    ("Westminster Papers in Communication & Culture", "1744-6708", "1744-6716", "社会学", "Sociology"),
]

def bare(value):
    return re.sub(r"[^0-9A-Za-z]", "", str(value or "")).upper()

def name_key(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())

def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

def apply(records):
    by_id = {}
    by_name = {}
    for r in records:
        for field in ("issn", "eissn"):
            if r.get(field): by_id[bare(r[field])] = r
        if r.get("name"): by_name[name_key(r["name"])] = r
    for r in records:
        r.pop("under_review", None)
        r.pop("under_review_order", None)
        r.pop("under_review_subject_cn", None)
        r.pop("under_review_subject_en", None)
    unmatched = []
    for order, (title, issn, eissn, subject_cn, subject_en) in enumerate(ROWS):
        r = by_id.get(bare(issn)) or by_id.get(bare(eissn)) or by_name.get(name_key(title))
        if r is None:
            r = {"name": title, "issn": issn, "eissn": eissn, "indices": [], "slug": re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")}
            records.append(r)
            by_name[name_key(title)] = r
            for v in (issn, eissn):
                if v: by_id[bare(v)] = r
        if issn and not r.get("issn"): r["issn"] = issn
        if eissn and not r.get("eissn"): r["eissn"] = eissn
        r["under_review"] = True
        r["under_review_order"] = order
        r["under_review_subject_cn"] = subject_cn
        r["under_review_subject_en"] = subject_en
        r["under_review_source_updated"] = "2026-10-01"
    return records, unmatched

def main():
    with gzip.open(DATA / "journals.json.gz", "rt", encoding="utf-8") as f:
        records = json.load(f)
    records, _ = apply(records)
    for filename in ("journals.json.gz", "journals_light.json.gz", "journals_light_v2.json.gz"):
        path = DATA / filename
        if filename == "journals.json.gz": payload = records
        else:
            with gzip.open(path, "rt", encoding="utf-8") as f: payload = json.load(f)
            payload, _ = apply(payload)
        with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    issns = []
    for _, issn, eissn, *_ in ROWS:
        for value in (issn, eissn):
            if value and bare(value) not in {bare(x) for x in issns}: issns.append(value)
    write_json(DATA / "under_review_issn.json", issns)
    source = {
        "source": "user-provided workbook",
        "source_file": "新锐分区-Under Review-20261001.xlsx",
        "source_updated": "2026-10-01",
        "count": len(ROWS),
        "items": [dict(no=i + 1, journal_name=n, issn=issn, eissn=eissn, subject_cn=cn, subject_en=en) for i, (n, issn, eissn, cn, en) in enumerate(ROWS)],
    }
    write_json(ROOT / "list/topeditsci_xinrui_under_review.json", source)
    meta_path = DATA / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta["total"] = len(records)
    meta["with_under_review"] = sum(bool(r.get("under_review")) for r in records)
    meta["under_review_source_updated"] = "2026-10-01"
    meta["under_review_source"] = "user-provided workbook: 新锐分区-Under Review-20261001.xlsx"
    meta["under_review_update"] = {"date": "2026-10-01", "count": len(ROWS)}
    write_json(meta_path, meta)
    print(json.dumps({"records": len(records), "under_review": meta["with_under_review"], "issn_keys": len(issns)}, ensure_ascii=False))

if __name__ == "__main__": main()
