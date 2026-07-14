#!/usr/bin/env python3
"""Build Korea KCI journal directory data for the website.

Downloads public CSV files from data.go.kr:
- National Research Foundation of Korea KCI journal information
- National Research Foundation of Korea KCI citation index information

Raw files stay under list/korea, which is intentionally ignored by git.
The published compact data lives at data/korea.json.
"""
from __future__ import annotations

import csv
import json
import re
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "list" / "korea"
DATA_DIR = ROOT / "data"

KCI_JOURNALS_URL = "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003236350&fileDetailSn=1&insertDataPrcus=N"
KCI_CITATIONS_URL = "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003236349&fileDetailSn=1&insertDataPrcus=N"
KCI_JOURNALS_PAGE = "https://www.data.go.kr/data/3049043/fileData.do?recommendDataYn=Y"
KCI_CITATIONS_PAGE = "https://www.data.go.kr/data/3049380/fileData.do?recommendDataYn=Y"
KCI_SOURCE_DATE = "2025-08-25"


def clean(value: object) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return "" if text in {"-", "—", "NA", "N/A", "None", "nan"} else text


def clean_issn(value: object) -> str:
    text = clean(value).upper()
    compact = re.sub(r"[^0-9X]", "", text)
    if len(compact) == 8:
        return f"{compact[:4]}-{compact[4:]}"
    return text


def clean_number(value: object) -> int | float | str:
    text = clean(value).replace(",", "")
    if not text:
        return ""
    try:
        num = float(text)
    except ValueError:
        return clean(value)
    return int(num) if num.is_integer() else num


def clean_languages(value: object) -> str:
    """Keep the source order while removing repeated language labels."""
    values = [clean(item) for item in clean(value).split(",")]
    return ",".join(dict.fromkeys(item for item in values if item))


def norm_title(value: object) -> str:
    text = clean(value).casefold()
    text = re.sub(r"&", " and ", text)
    text = re.sub(r"[^0-9a-z가-힣]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def download_if_needed(url: str, path: Path) -> None:
    if path.exists() and path.stat().st_size > 1024:
        return
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as resp:
        path.write_bytes(resp.read())


def read_csv(path: Path) -> list[dict[str, str]]:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw.decode("utf-8", errors="replace")
    return list(csv.DictReader(text.splitlines()))


def source_key(row: dict[str, str]) -> tuple[str, str]:
    issn = clean_issn(row.get("국제표준연속 간행물 번호") or row.get("국제표준연속 간행물번호(종이식)"))
    title = norm_title(row.get("학술지명(외국어)") or row.get("학술지명(국문)"))
    return issn, title


def load_global_index() -> tuple[dict[str, dict], dict[str, dict]]:
    by_issn: dict[str, dict] = {}
    by_name: dict[str, dict] = {}
    path = DATA_DIR / "journals_deploy.json"
    if not path.exists():
        return by_issn, by_name
    records = json.loads(path.read_text(encoding="utf-8"))
    for row in records:
        for key in (row.get("issn"), row.get("eissn")):
            key = clean_issn(key)
            if key:
                by_issn[key] = row
        title = norm_title(row.get("name"))
        if title:
            by_name[title] = row
    return by_issn, by_name


def global_summary(hit: dict | None) -> dict:
    if not hit:
        return {}
    summary = {}
    for key in (
        "indices",
        "if_2024",
        "if_quartile",
        "if_rank",
        "cas_zone",
        "cas_top",
        "cas_major_cn",
        "cas_major_en",
        "country",
        "publisher",
        "wos_categories",
        "language_cn",
    ):
        value = hit.get(key)
        if value not in (None, "", [], {}):
            summary[key] = value
    if hit.get("scopus"):
        summary["scopus"] = {
            "active": bool(hit["scopus"].get("active")),
            "coverage": hit["scopus"].get("coverage", ""),
        }
    if hit.get("doaj"):
        summary["doaj"] = True
    return summary


def status_label(status: str) -> str:
    return {
        "우수등재": "KCI Excellent",
        "등재": "KCI Indexed",
        "등재후보": "KCI Candidate",
    }.get(status, status or "KCI")


def split_subject(value: str) -> tuple[str, str]:
    parts = [clean(p) for p in (value or "").split(">") if clean(p)]
    if not parts:
        return "", ""
    return parts[0], " > ".join(parts[1:])


def build_records(journal_rows: Iterable[dict[str, str]], citation_rows: Iterable[dict[str, str]]) -> list[dict]:
    citations_by_issn: dict[str, dict[str, str]] = {}
    citations_by_title: dict[str, dict[str, str]] = {}
    for row in citation_rows:
        issn, title = source_key(row)
        if issn:
            citations_by_issn[issn] = row
        if title:
            citations_by_title[title] = row

    global_by_issn, global_by_name = load_global_index()
    records: list[dict] = []
    seen = set()
    for row in journal_rows:
        issn = clean_issn(row.get("국제표준연속 간행물번호(종이식)"))
        eissn = clean_issn(row.get("국제표준연속 간행물번호(전자식)"))
        title_ko = clean(row.get("학술지명(국문)"))
        title_en = clean(row.get("학술지명(외국어)"))
        key = (issn, eissn, norm_title(title_en or title_ko))
        if key in seen:
            continue
        seen.add(key)

        citation = citations_by_issn.get(issn) or citations_by_issn.get(eissn) or citations_by_title.get(norm_title(title_en or title_ko)) or {}
        subject_group, subject_detail = split_subject(clean(row.get("학술지 연구분야")) or " > ".join(filter(None, [citation.get("대분류"), citation.get("중분류")])))
        hit = global_by_issn.get(issn) or global_by_issn.get(eissn) or global_by_name.get(norm_title(title_en))
        status = clean(row.get("등재 구분") or citation.get("등재정보"))
        record = {
            "source": "KCI",
            "name": title_en or title_ko,
            "journal_title": title_en or title_ko,
            "journal_title_ko": title_ko,
            "journal_title_en": title_en,
            "issn": issn,
            "eissn": eissn,
            "publisher": clean(row.get("발행기관명(영문)") or citation.get("발행기관(영문)") or row.get("발행기관명(국문)") or citation.get("발행기관")),
            "publisher_ko": clean(row.get("발행기관명(국문)") or citation.get("발행기관")),
            "status": status,
            "status_label": status_label(status),
            "subject_group": subject_group,
            "subject": subject_detail or subject_group,
            "founded_year": clean(row.get("창간년도")),
            "frequency": clean(row.get("발행간기")),
            "languages": clean_languages(row.get("사용언어")),
            "organization_type": clean(row.get("기관 구분")),
            "affiliated_university": clean(row.get("부설연구소 소속 대학")),
            "kci_wos_if_2y": clean_number(citation.get("한국학술지인용색인의 웹오브사이언스 통합 영향력지수 (2년)")),
            "kci_if_2y": clean_number(citation.get("한국학술지인용색인 영향력지수 (2년)")),
            "kci_if_no_self_2y": clean_number(citation.get("자기인용제외 IF (2년)")),
            "kci_centrality_3y": clean_number(citation.get("중심성 지수(3년)")),
            "kci_immediacy": clean_number(citation.get("즉시성지수")),
            "kci_self_cite_rate_2y": clean_number(citation.get("자기인용 비율(2년)")),
            "kci_articles_2y": clean_number(citation.get("논문수(2년)")),
            "kci_citations_2y": clean_number(citation.get("피인용횟수(2년)")),
            "kci_wos_citations_2y": clean_number(citation.get("웹오브사이언스 피인용횟수(2년)")),
            "global": global_summary(hit),
        }
        records.append({k: v for k, v in record.items() if v not in ("", [], {})})

    status_order = {"우수등재": 0, "등재": 1, "등재후보": 2}
    records.sort(key=lambda r: (
        status_order.get(r.get("status", ""), 9),
        -(float(r.get("kci_if_2y") or 0)),
        norm_title(r.get("journal_title")),
    ))
    return records


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    journal_csv = RAW_DIR / "kci_journals.csv"
    citation_csv = RAW_DIR / "kci_citations.csv"
    download_if_needed(KCI_JOURNALS_URL, journal_csv)
    download_if_needed(KCI_CITATIONS_URL, citation_csv)

    records = build_records(read_csv(journal_csv), read_csv(citation_csv))
    status_counts = Counter(r.get("status", "") for r in records)
    subject_counts = Counter(r.get("subject_group", "") for r in records if r.get("subject_group"))
    global_hits = sum(1 for r in records if r.get("global"))
    payload = {
        "source": "National Research Foundation of Korea KCI public data",
        "country": "KR",
        "source_updated": KCI_SOURCE_DATE,
        "last_updated": datetime.now(timezone.utc).date().isoformat(),
        "source_pages": {
            "kci_journals": KCI_JOURNALS_PAGE,
            "kci_citations": KCI_CITATIONS_PAGE,
        },
        "counts": {
            "records": len(records),
            "global_matches": global_hits,
            "status": dict(status_counts),
            "subjects": dict(subject_counts),
        },
        "subjects": [{"name": name, "count": count} for name, count in sorted(subject_counts.items())],
        "records": records,
    }
    out = DATA_DIR / "korea.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {out}")
    # ASCII escapes keep the command portable on Windows GBK terminals.
    print(json.dumps(payload["counts"], ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
