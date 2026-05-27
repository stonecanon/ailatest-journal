#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build data/review_cycles.json from CrossRef (rate-limit-safe, resume).

Queries each journal's works for received→accepted date pairs (2024+).
2 workers, 1s gap between requests. On 429 → wait 5 min, retry up to 10x.
Checkpoints every 500.
"""
import json, urllib.request, urllib.error, ssl, statistics, time
from datetime import date
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "journals.json"
OUT = ROOT / "data" / "review_cycles.json"

UA = "AILatest-Journal/1.0 (mailto:43259074+stonecanon@users.noreply.github.com)"
TODAY = date.today().isoformat()
MIN_PAIRS = 4
ROWS = 50
WORKERS = 2

# Rate-limit state (shared across workers)
_last_req_time = [0.0]


def parse_dp(d):
    try:
        dp = d.get("date-parts", [[]])[0]
        if len(dp) >= 3:
            return date(int(dp[0]), int(dp[1]), int(dp[2]))
    except Exception:
        return None
    return None


def fetch_one(issn):
    global _last_req_time
    ctx = ssl.create_default_context()
    url = f"https://api.crossref.org/journals/{issn}/works?rows={ROWS}&filter=from-pub-date:2024-01-01"

    for attempt in range(10):
        # Rate-limit: at least 1s between requests
        now = time.time()
        gap = 1.0 - (now - _last_req_time[0])
        if gap > 0:
            time.sleep(gap)
        _last_req_time[0] = time.time()

        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
                items = json.loads(r.read())["message"]["items"]
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = min(300 * (attempt + 1), 1800)
                print(f"  429 on {issn}, wait {wait}s (attempt {attempt+1})", flush=True)
                time.sleep(wait)
                # Re-create SSL context (new connection)
                ctx = ssl.create_default_context()
                continue
            return issn, None, 0
        except Exception:
            return issn, None, 0
        break
    else:
        return issn, None, 0  # All retries exhausted

    days = []
    for it in items:
        rd = parse_dp(it.get("received")) if "received" in it else None
        ad = parse_dp(it.get("accepted")) if "accepted" in it else None
        if not (rd and ad):
            for a in it.get("assertion", []) or []:
                n = (a.get("name") or "").lower()
                v = (a.get("value") or "")[:10]
                if n == "received" and not rd:
                    try: rd = date.fromisoformat(v)
                    except: pass
                elif n == "accepted" and not ad:
                    try: ad = date.fromisoformat(v)
                    except: pass
        if rd and ad:
            d = (ad - rd).days
            if 0 < d < 1500:
                days.append(d)
    med = int(statistics.median(days)) if days else None
    return issn, med, len(days)


def main():
    journals = json.loads(SRC.read_text())
    seen = set()
    for j in journals:
        issn = (j.get("issn") or j.get("eissn") or "").strip()
        if issn:
            seen.add(issn)
    targets = sorted(seen)
    print(f"Targets: {len(targets)} journals", flush=True)

    out = {}
    if OUT.exists():
        try:
            out = json.loads(OUT.read_text())
        except Exception:
            pass

    pending = [i for i in targets if i not in out]
    print(f"Pending: {len(pending)} (have: {len(out)} good)", flush=True)
    print(f"Workers: {WORKERS} | Min pairs: {MIN_PAIRS}", flush=True)

    t0 = time.time()
    done = kept = nf = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = {ex.submit(fetch_one, issn): issn for issn in pending}
        for fu in as_completed(futures):
            issn, med, pairs = fu.result()
            done += 1
            if med and pairs >= MIN_PAIRS:
                out[issn] = {
                    "median_days": med, "sample_size": pairs,
                    "source": "CrossRef", "year_window": "2024+", "updated": TODAY,
                }
                kept += 1
            else:
                nf += 1

            if done % 500 == 0:
                el = time.time() - t0
                rate = done / el if el else 0
                eta = (len(pending) - done) / rate if rate else 0
                print(f"[{done}/{len(pending)}] kept={kept} nf={nf} "
                      f"rate={rate:.2f}/s eta={eta:.0f}s", flush=True)
                OUT.write_text(json.dumps(out, ensure_ascii=False, sort_keys=True))

    OUT.write_text(json.dumps(out, ensure_ascii=False, sort_keys=True))
    elapsed = time.time() - t0
    rate = done / elapsed if elapsed else 0
    print(f"\nDONE in {elapsed:.0f}s ({rate:.2f}/s)", flush=True)
    print(f"  Kept: {kept}  No data: {nf}  Total: {len(out)} → {OUT}", flush=True)


if __name__ == "__main__":
    main()
