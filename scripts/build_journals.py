#!/usr/bin/env python3
"""Merge WoS Core (SCIE/SSCI/AHCI/ESCI) + JCR 2025 + ESI into unified journals.json.

Key fields per record:
    name, issn, eissn, publisher, country, languages,
    wos_categories[], esi_category, indices[] (subset of SCIE/SSCI/AHCI/ESCI),
    abbr20 (from JCR)
Match priority: ISSN -> eISSN -> normalized title.
"""
from __future__ import annotations
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover
    openpyxl = None

ROOT = Path(__file__).resolve().parent.parent
LIST_DIR = ROOT / 'list'
DATA_DIR = ROOT / 'data'
DATA_DIR.mkdir(exist_ok=True)

INDEX_FILES = {
    'SCIE': 'Science Citation Index Expanded (SCIE).csv',
    'SSCI': 'Social Sciences Citation Index (SSCI).csv',
    'AHCI': 'Arts & Humanities Citation Index (AHCI).csv',
    'ESCI': 'Emerging Sources Citation Index (ESCI).csv',
}
JCR_FILE = LIST_DIR / 'JCR 2025.csv'
ESI_FILE = LIST_DIR / 'ESI全部期刊列表.xlsx'


def norm_title(s: str) -> str:
    if not s:
        return ''
    s = s.upper()
    s = re.sub(r'[^A-Z0-9]+', '', s)
    return s


def clean_issn(s: str) -> str:
    if not s:
        return ''
    s = s.strip().upper()
    return s if re.match(r'^[0-9]{4}-[0-9]{3}[0-9X]$', s) else ''


def parse_wos_csv(path: Path, index_name: str, store: dict) -> int:
    added = 0
    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = (row.get('Journal title') or '').strip()
            if not title:
                continue
            issn = clean_issn(row.get('ISSN') or '')
            eissn = clean_issn(row.get('eISSN') or '')
            publisher = (row.get('Publisher name') or '').strip()
            addr = (row.get('Publisher address') or '').strip()
            langs = (row.get('Languages') or '').strip()
            cats_raw = (row.get('Web of Science Categories') or '').strip()
            wos_cats = [c.strip() for c in cats_raw.split('|') if c.strip()] if cats_raw else []

            key = issn or eissn or norm_title(title)
            if not key:
                continue

            rec = store.get(key)
            if rec is None:
                rec = {
                    'name': title,
                    'issn': issn,
                    'eissn': eissn,
                    'publisher': publisher,
                    'address': addr,
                    'languages': langs,
                    'wos_categories': wos_cats,
                    'esi_category': '',
                    'abbr20': '',
                    'country': '',
                    'indices': [],
                }
                store[key] = rec
                added += 1
            else:
                # fill missing fields
                if not rec['issn'] and issn: rec['issn'] = issn
                if not rec['eissn'] and eissn: rec['eissn'] = eissn
                if not rec['publisher'] and publisher: rec['publisher'] = publisher
                if not rec['address'] and addr: rec['address'] = addr
                if not rec['languages'] and langs: rec['languages'] = langs
                if not rec['wos_categories'] and wos_cats: rec['wos_categories'] = wos_cats
            if index_name not in rec['indices']:
                rec['indices'].append(index_name)
    return added


def parse_jcr(path: Path, store: dict, lookup_by_issn: dict, lookup_by_title: dict) -> int:
    if not path.exists():
        return 0
    hits = 0
    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = (row.get('Title') or '').strip()
            abbr20 = (row.get('Title20') or '').strip()
            country = (row.get('Country') or '').strip()
            if not title:
                continue
            flags = {k: (row.get(k) or '').strip() for k in ('SCIE', 'SSCI', 'AHCI', 'ESCI')}
            nt = norm_title(title)

            rec = lookup_by_title.get(nt)
            if rec is None:
                # new record (JCR-only — probably discontinued or not in current core)
                rec = {
                    'name': title,
                    'issn': '',
                    'eissn': '',
                    'publisher': '',
                    'address': '',
                    'languages': '',
                    'wos_categories': [],
                    'esi_category': '',
                    'abbr20': abbr20,
                    'country': country,
                    'indices': [],
                }
                store[nt] = rec
                lookup_by_title[nt] = rec
            if abbr20 and not rec['abbr20']:
                rec['abbr20'] = abbr20
            if country and not rec['country']:
                rec['country'] = country
            for idx, mark in flags.items():
                if mark and mark.upper() == 'X' and idx not in rec['indices']:
                    rec['indices'].append(idx)
            hits += 1
    return hits


def parse_esi(path: Path, lookup_by_issn: dict, lookup_by_title: dict) -> int:
    if not openpyxl or not path.exists():
        return 0
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    hits = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not row[0]:
            continue
        full = (row[0] or '').strip()
        cat = (row[3] or '').strip() if len(row) > 3 else ''
        issn = clean_issn(row[4] if len(row) > 4 and row[4] else '')
        eissn = clean_issn(row[5] if len(row) > 5 and row[5] else '')
        nt = norm_title(full)
        rec = lookup_by_issn.get(issn) or lookup_by_issn.get(eissn) or lookup_by_title.get(nt)
        if rec is not None:
            if cat and not rec['esi_category']:
                rec['esi_category'] = cat
            hits += 1
    return hits


def main() -> int:
    store: dict = {}
    print('== Loading WoS Core indices ==')
    for idx, fn in INDEX_FILES.items():
        p = LIST_DIR / fn
        if not p.exists():
            print(f'  skip {idx}: file missing')
            continue
        n = parse_wos_csv(p, idx, store)
        print(f'  {idx}: +{n} (store now {len(store)})')

    # build lookups
    by_issn: dict = {}
    by_title: dict = {}
    for rec in store.values():
        for k in (rec.get('issn'), rec.get('eissn')):
            if k:
                by_issn.setdefault(k, rec)
        by_title.setdefault(norm_title(rec['name']), rec)

    print('== Merging JCR 2025 ==')
    hits = parse_jcr(JCR_FILE, store, by_issn, by_title)
    print(f'  JCR matched/added: {hits} (store now {len(store)})')

    # refresh lookups after JCR may have added titles
    by_issn.clear(); by_title.clear()
    for rec in store.values():
        for k in (rec.get('issn'), rec.get('eissn')):
            if k: by_issn.setdefault(k, rec)
        by_title.setdefault(norm_title(rec['name']), rec)

    print('== Merging ESI categories ==')
    hits = parse_esi(ESI_FILE, by_issn, by_title)
    print(f'  ESI matched: {hits}')

    # finalize list
    journals = list(store.values())
    journals.sort(key=lambda r: r['name'])

    # stats
    idx_count: Counter = Counter()
    for r in journals:
        for i in r['indices']:
            idx_count[i] += 1
    cat_count: Counter = Counter()
    for r in journals:
        for c in r['wos_categories']:
            cat_count[c] += 1
    esi_count: Counter = Counter()
    for r in journals:
        if r['esi_category']:
            esi_count[r['esi_category']] += 1

    print('== Stats ==')
    print(f'  total journals: {len(journals)}')
    print(f'  indices: {dict(idx_count)}')
    print(f'  WoS categories: {len(cat_count)}')
    print(f'  ESI matches: {sum(esi_count.values())}')

    # Write outputs
    with open(DATA_DIR / 'journals.json', 'w', encoding='utf-8') as f:
        json.dump(journals, f, ensure_ascii=False, separators=(',', ':'))
    categories = [{'name': k, 'count': v} for k, v in cat_count.most_common()]
    with open(DATA_DIR / 'wos_categories.json', 'w', encoding='utf-8') as f:
        json.dump(categories, f, ensure_ascii=False, indent=2)
    esi = [{'name': k, 'count': v} for k, v in esi_count.most_common()]
    with open(DATA_DIR / 'esi_categories.json', 'w', encoding='utf-8') as f:
        json.dump(esi, f, ensure_ascii=False, indent=2)
    meta = {
        'source': 'WoS Core Collection (SCIE/SSCI/AHCI/ESCI) + JCR 2025 + ESI',
        'last_updated_source': 'April 20, 2026',
        'total': len(journals),
        'indices': dict(idx_count),
        'wos_categories': len(cat_count),
        'esi_categories': len(esi_count),
    }
    with open(DATA_DIR / 'meta.json', 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    size = (DATA_DIR / 'journals.json').stat().st_size
    print(f'  journals.json: {size/1024/1024:.2f} MB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
