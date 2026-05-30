#!/usr/bin/env python3
"""
Fetch currently indexed MEDLINE journal ISSNs from NCBI NLM Catalog API.

The J_Medline.txt file on the NLM FTP includes ALL journals that have EVER been
indexed in MEDLINE (~35,500), including ceased/historical titles. Only ~5,300
are currently active.

This script uses the NCBI E-utilities to query the NLM Catalog for journals
with "currently indexed" status, which gives the authoritative ~5,300 list.

Output:
  list/pubmed_issns.json     → currently indexed MEDLINE ISSNs (was: 41,352; will be ~5,300)
  list/pubmed_only_issns.json → PubMed-only ISSNs (non-MEDLINE) — unchanged

Usage:
  python3 scripts/fetch_current_medline.py
"""

import json, time, os, sys
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
LIST_DIR = ROOT / 'list'
LIST_DIR.mkdir(parents=True, exist_ok=True)

# NCBI expects email + tool name for fair use
EMAIL = 'jiantaoweng@gmail.com'
TOOL = 'ailatest-journal'

BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

def esearch(term, retmax=99999, retstart=0):
    """Search NLM Catalog and return list of UIDs (NlmId)."""
    url = f'{BASE}/esearch.fcgi?db=nlmcatalog&term={quote(term)}&retmax={retmax}&retstart={retstart}&retmode=json&email={EMAIL}&tool={TOOL}'
    with urlopen(url, timeout=60) as r:
        data = json.load(r)
    ids = data.get('esearchresult', {}).get('idlist', [])
    total = int(data.get('esearchresult', {}).get('count', 0))
    return ids, total

def efetch_nlm_details(ids):
    """Fetch NLM Catalog records for given NlmIds and extract ISSNs."""
    if not ids:
        return []
    batch_size = 200  # NCBI max batch
    all_issns = []
    for i in range(0, len(ids), batch_size):
        batch = ids[i:i+batch_size]
        url = f'{BASE}/efetch.fcgi?db=nlmcatalog&id={",".join(batch)}&retmode=xml&email={EMAIL}&tool={TOOL}'
        with urlopen(url, timeout=120) as r:
            xml = r.read().decode('utf-8')
        # Parse ISSNs from XML
        issns = parse_issns_from_nlm_xml(xml)
        all_issns.extend(issns)
        print(f'  batch {i//batch_size + 1}/{(len(ids)-1)//batch_size + 1}: +{len(issns)} ISSNs', flush=True)
        time.sleep(0.35)  # NCBI rate limit
    return all_issns

def parse_issns_from_nlm_xml(xml):
    """Extract ISSN (Print) and ISSN (Online) from NLM Catalog XML."""
    import re
    issns = set()
    # Pattern: <ISSN type="Print">xxxx-xxxx</ISSN> or <ISSN>xxxx-xxxx</ISSN>
    for m in re.finditer(r'<ISSN[^>]*>(\\d{4}-\\d{3}[\\dxX])</ISSN>', xml):
        issn = m.group(1).replace('-', '')
        if len(issn) == 8:
            issns.add(issn)
    return list(issns)

def save_list(issns, filename):
    """Save sorted unique ISSN list to JSON."""
    issns = sorted(set(issns))
    path = LIST_DIR / filename
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(issns, f, ensure_ascii=False)
    print(f'  {path.name}: {len(issns)} ISSNs ({path.stat().st_size:,} bytes)')
    return issns

def main():
    print('=== Step 1: Search NLM Catalog for currently indexed MEDLINE journals ===')
    ids, total = esearch('"currently indexed in medline"[All]')
    print(f'  Found {total} currently indexed journals')
    print(f'  Retrieved {len(ids)} IDs')
    
    if total == 0:
        print('  WARNING: No results! Try alternative query...')
        # Fallback: search by MEDLINE subset in citations
        ids, total = esearch('medline[sb]')
        print(f'  Alternative query gave: {total}')
        # This gives ~5,200-5,300
        if total == 0:
            print('  ERROR: NCBI API not reachable. Exiting.')
            sys.exit(1)
    
    if not ids or len(ids) < total:
        print(f'  Incomplete results ({len(ids)}/{total}). Need pagination.')
        # If NCBI returns paginated results, fetch more pages
        all_ids = list(ids)
        retstart = len(ids)
        while retstart < total:
            more_ids, _ = esearch('"currently indexed in medline"[All]', retmax=99999, retstart=retstart)
            if not more_ids:
                break
            all_ids.extend(more_ids)
            retstart += len(more_ids)
            print(f'  ... collected {len(all_ids)}/{total}')
            time.sleep(0.35)
        ids = all_ids
    
    # If we still have < total, or total was 0, try the journal count approach
    # The NLM catalog for "currently indexed" should return ~5,300
    if len(ids) < 1000:
        print('  WARNING: Too few results. Trying different query...')
        ids, total = esearch('"currently indexed"[All]')
        print(f'  Alternative: {total} journals')
    
    print(f'\n=== Step 2: Fetch ISSNs for {len(ids)} journals ===')
    medline_issns = efetch_nlm_details(ids)
    
    print(f'\n=== Step 3: Save results ===')
    save_list(medline_issns, 'pubmed_issns.json')
    
    # Also show the old file for reference
    old_file = LIST_DIR / 'pubmed_issns.json'
    if old_file.exists():
        old_data = json.load(open(old_file))
        print(f'\n  OLD file had {len(old_data)} ISSNs (was: J_Medline.txt full list)')
    
    print(f'\nDone! Run rebuild to update journal badges:\n  python3 scripts/build_journals.py')

if __name__ == '__main__':
    main()
