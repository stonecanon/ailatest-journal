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
from http.client import IncompleteRead
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
LIST_DIR = ROOT / 'list'
LIST_DIR.mkdir(parents=True, exist_ok=True)
META_FILE = LIST_DIR / 'medline_meta.json'

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
    # Keep batches below the NCBI maximum. Smaller responses are more reliable
    # through the public gateway, which occasionally closes large chunked XML
    # responses before the full body arrives.
    batch_size = 100
    all_issns = []
    for i in range(0, len(ids), batch_size):
        batch = ids[i:i+batch_size]
        url = f'{BASE}/efetch.fcgi?db=nlmcatalog&id={",".join(batch)}&retmode=xml&email={EMAIL}&tool={TOOL}'
        xml = None
        last_error = None
        for attempt in range(1, 4):
            try:
                with urlopen(url, timeout=120) as r:
                    xml = r.read().decode('utf-8')
                break
            except (IncompleteRead, TimeoutError, OSError) as exc:
                last_error = exc
                if attempt == 3:
                    raise
                print(f'  retry batch {i//batch_size + 1}: {type(exc).__name__}', flush=True)
                time.sleep(attempt * 1.5)
        if xml is None:
            raise RuntimeError(f'No XML returned for batch {i//batch_size + 1}') from last_error
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
    for m in re.finditer(r'<ISSN[^>]*>(\d{4}-\d{3}[\dxX])</ISSN>', xml):
        issn = m.group(1).replace('-', '')
        if len(issn) == 8:
            issns.add(issn)
    return list(issns)

def save_list(issns, filename):
    """Save sorted unique ISSN list to JSON."""
    issns = sorted(set(issns))
    path = LIST_DIR / filename
    temp = path.with_suffix(path.suffix + '.tmp')
    with open(temp, 'w', encoding='utf-8') as f:
        json.dump(issns, f, ensure_ascii=False)
    os.replace(temp, path)
    print(f'  {path.name}: {len(issns)} ISSNs ({path.stat().st_size:,} bytes)')
    return issns

def main():
    old_file = LIST_DIR / 'pubmed_issns.json'
    old_count = 0
    if old_file.exists():
        try:
            old_count = len(json.loads(old_file.read_text(encoding='utf-8')))
        except Exception:
            pass

    print('=== Step 1: Search NLM Catalog for currently indexed MEDLINE journals ===')
    # NLM Catalog documents this filter as the literal term
    # `currentlyindexed`. The older phrase query now returns zero results.
    query = 'currentlyindexed'
    ids, total = esearch(query)
    print(f'  Found {total} currently indexed journals')
    print(f'  Retrieved {len(ids)} IDs')
    
    if total < 4000:
        print(f'  ERROR: Implausible NLM result count ({total}). Refusing to overwrite the source list.')
        sys.exit(1)
    
    if not ids or len(ids) < total:
        print(f'  Incomplete results ({len(ids)}/{total}). Need pagination.')
        # If NCBI returns paginated results, fetch more pages
        all_ids = list(ids)
        retstart = len(ids)
        while retstart < total:
            more_ids, _ = esearch(query, retmax=99999, retstart=retstart)
            if not more_ids:
                break
            all_ids.extend(more_ids)
            retstart += len(more_ids)
            print(f'  ... collected {len(all_ids)}/{total}')
            time.sleep(0.35)
        ids = all_ids
    
    if len(ids) < total:
        print(f'  ERROR: Incomplete NLM result set ({len(ids)}/{total}). Refusing to overwrite.')
        sys.exit(1)
    
    print(f'\n=== Step 2: Fetch ISSNs for {len(ids)} journals ===')
    medline_issns = efetch_nlm_details(ids)
    if len(set(medline_issns)) < 5000:
        print(f'  ERROR: Implausible ISSN count ({len(set(medline_issns))}). Refusing to overwrite.')
        sys.exit(1)
    
    print(f'\n=== Step 3: Save results ===')
    save_list(medline_issns, 'pubmed_issns.json')
    
    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    meta = {
        'source': 'NCBI NLM Catalog',
        'source_url': 'https://www.ncbi.nlm.nih.gov/nlmcatalog/journals/',
        'query': query,
        'fetched_at': fetched_at,
        'journal_count': total,
        'issn_count': len(set(medline_issns)),
    }
    temp_meta = META_FILE.with_suffix('.json.tmp')
    temp_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temp_meta, META_FILE)
    print(f'  Previous source list: {old_count} ISSNs')
    print(f'  Wrote {META_FILE}')
    
    print(f'\nDone! Sync the current directories into the production bundle:\n  python3 scripts/sync_current_directories.py')

if __name__ == '__main__':
    main()
