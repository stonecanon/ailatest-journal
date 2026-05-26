#!/usr/bin/env python3
"""
Batch-fetch OpenAlex source metadata for all journals in data/journals.json.
Saves to data/openalex_cache.json. Resumable — skips ISSNs already cached.

Fields pulled per source:
  homepage_url, is_oa, is_in_doaj, apc_usd, apc_prices, oa_status(derived),
  type, country_code, host_organization_name, works_count

OpenAlex allows filter ids.issn:A|B|C... up to ~50 per page. We batch 40.
Polite mailto + <10 req/s. Expected ~580 requests, ~8-12 min total.
"""
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import quote
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent.parent
JOURNALS = ROOT / "data" / "journals.json"
CACHE = ROOT / "data" / "openalex_cache.json"
MAILTO = "ailatest@security-contact.local"
BATCH = 40           # ISSNs per request
SLEEP = 0.12         # ~8 req/s
SAVE_EVERY = 20      # flush cache to disk every N batches

SELECT = ",".join([
    "id", "display_name", "issn_l", "issn",
    "homepage_url", "is_oa", "is_in_doaj",
    "apc_usd", "apc_prices", "type", "country_code",
    "host_organization_name", "works_count",
    "topics",
])


def load_cache():
    if CACHE.exists():
        try:
            return json.loads(CACHE.read_text())
        except Exception:
            pass
    return {"by_issn": {}, "fetched_issns": []}


def save_cache(cache):
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def fetch_batch(issns):
    """Fetch up to BATCH ISSNs in one OpenAlex query. Returns list of source dicts."""
    flt = "|".join(issns)
    url = (
        f"https://api.openalex.org/sources"
        f"?filter=issn:{flt}"
        f"&per_page=50"
        f"&select={SELECT}"
        f"&mailto={MAILTO}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": f"ailatest-journal/1.0 ({MAILTO})"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
                return data.get("results", [])
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            print(f"  HTTP {e.code} on batch, skipping", file=sys.stderr)
            return []
        except Exception as e:
            print(f"  err {e}, retry {attempt+1}", file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    return []


def normalize_issn(s):
    if not s:
        return ""
    s = s.strip().upper()
    if len(s) == 8:
        s = s[:4] + "-" + s[4:]
    return s


def main():
    journals = json.loads(JOURNALS.read_text())
    print(f"Loaded {len(journals)} journals")

    # Collect unique ISSNs (both issn and eissn)
    issn_set = set()
    for j in journals:
        for field in ("issn", "eissn"):
            v = normalize_issn(j.get(field, ""))
            if v and len(v) == 9 and "-" in v:
                issn_set.add(v)
    all_issns = sorted(issn_set)
    print(f"Unique ISSNs to query: {len(all_issns)}")

    cache = load_cache()
    fetched = set(cache.get("fetched_issns", []))
    by_issn = cache.setdefault("by_issn", {})

    # Re-fetch records that are missing 'topics' (schema upgrade)
    missing_topics = set()
    for k, v in by_issn.items():
        if "topics" not in v:
            fetched.discard(k)
            missing_topics.add(k)

    todo = [i for i in all_issns if i not in fetched]
    print(f"Already cached: {len(fetched)}; missing topics: {len(missing_topics)}; remaining: {len(todo)}")

    t0 = time.time()
    saved_count = 0
    for batch_idx, start in enumerate(range(0, len(todo), BATCH)):
        chunk = todo[start:start + BATCH]
        results = fetch_batch(chunk)
        for r in results:
            issn_l = r.get("issn_l")
            issns = r.get("issn") or []
            # store under every ISSN this source claims
            apc_prices = r.get("apc_prices") or []
            apc_usd = r.get("apc_usd")
            is_oa = bool(r.get("is_oa"))
            in_doaj = bool(r.get("is_in_doaj"))
            # Derive oa_status: gold if is_oa+doaj; apc-based hybrid if apc>0 and not is_oa;
            # diamond if is_oa+doaj+apc==0; else subscription/unknown
            if is_oa and in_doaj and not apc_usd:
                oa_status = "diamond"
            elif is_oa and in_doaj and apc_usd:
                oa_status = "gold"
            elif is_oa:
                oa_status = "gold"
            elif apc_usd:
                oa_status = "hybrid"
            else:
                oa_status = "subscription"
            record = {
                "oa_id": r.get("id"),
                "display_name": r.get("display_name"),
                "issn_l": issn_l,
                "homepage": r.get("homepage_url"),
                "is_oa": is_oa,
                "in_doaj": in_doaj,
                "apc_usd": apc_usd,
                "apc_prices": apc_prices,
                "oa_status": oa_status,
                "type": r.get("type"),
                "country": r.get("country_code"),
                "host_org": r.get("host_organization_name"),
                "works_count": r.get("works_count"),
                "topics": r.get("topics", []),
            }
            for issn in issns:
                by_issn[issn.upper()] = record
            if issn_l:
                by_issn[issn_l.upper()] = record
        # mark all queried ISSNs as fetched even if not found (avoid re-query)
        for i in chunk:
            fetched.add(i)
        cache["fetched_issns"] = sorted(fetched)

        if (batch_idx + 1) % SAVE_EVERY == 0:
            save_cache(cache)
            saved_count += 1
            elapsed = time.time() - t0
            rate = (batch_idx + 1) * BATCH / elapsed if elapsed > 0 else 0
            remain = (len(todo) - (batch_idx + 1) * BATCH) / max(rate, 1)
            print(f"  batch {batch_idx+1}/{(len(todo)+BATCH-1)//BATCH} "
                  f"| matched {len(by_issn)} records "
                  f"| {rate:.1f} issn/s | ETA {remain:.0f}s")
        time.sleep(SLEEP)

    save_cache(cache)
    print(f"\nDone. {len(by_issn)} ISSN→source records in cache.")
    print(f"Elapsed: {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
