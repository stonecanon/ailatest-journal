#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build data/review_cycles.json from CrossRef (parallel version)."""
import json, urllib.request, ssl, statistics, time, sys
from datetime import date
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "journals.json"
OUT = ROOT / "data" / "review_cycles.json"

ctx = ssl.create_default_context()
UA = "AILatest-Journal/1.0 (mailto:43259074+stonecanon@users.noreply.github.com)"
TODAY = date.today().isoformat()

RELIABLE_PATTERNS = ("WILEY", "ROUTLEDGE", "TAYLOR & FRANCIS", "SPRINGER", "LIPPINCOTT")
EXCLUDE = ("SPRINGERNATURE",)
MIN_PAIRS = 8
ROWS = 50
WORKERS = 12


def is_reliable(pub: str) -> bool:
    p = pub.upper()
    if any(e in p for e in EXCLUDE):
        return False
    return any(t in p for t in RELIABLE_PATTERNS)


def parse_dp(d):
    try:
        dp = d.get("date-parts", [[]])[0]
        if len(dp) >= 3:
            return date(int(dp[0]), int(dp[1]), int(dp[2]))
    except Exception:
        return None
    return None


def fetch_one(issn):
    url = f"https://api.crossref.org/journals/{issn}/works?rows={ROWS}&filter=from-pub-date:2024-01-01"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=25, context=ctx) as r:
            items = json.loads(r.read())["message"]["items"]
    except Exception as e:
        return issn, None, 0, str(e)[:80]

    days = []
    for it in items:
        rd = parse_dp(it["received"]) if "received" in it else None
        ad = parse_dp(it["accepted"]) if "accepted" in it else None
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
    return issn, med, len(days), None


def main():
    journals = json.loads(SRC.read_text())
    targets, seen = [], set()
    for j in journals:
        if not is_reliable(j.get("publisher", "")):
            continue
        for f in ("issn", "eissn"):
            issn = (j.get(f) or "").strip()
            if issn and issn not in seen:
                seen.add(issn); targets.append(issn); break
    print(f"Targets: {len(targets)} journals", flush=True)

    out = {}
    if OUT.exists():
        try: out = json.loads(OUT.read_text())
        except: pass

    pending = [i for i in targets if i not in out]
    print(f"Pending: {len(pending)} (have: {len(out)})", flush=True)

    t0 = time.time()
    done = 0
    kept = 0
    errs = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = {ex.submit(fetch_one, issn): issn for issn in pending}
        for fu in as_completed(futures):
            issn, med, pairs, err = fu.result()
            done += 1
            if err:
                errs += 1
            elif med and pairs >= MIN_PAIRS:
                out[issn] = {
                    "median_days": med, "sample_size": pairs,
                    "source": "CrossRef", "year_window": "2024+", "updated": TODAY,
                }
                kept += 1
            if done % 100 == 0:
                el = time.time() - t0
                rate = done / el
                eta = (len(pending) - done) / rate if rate else 0
                print(f"[{done}/{len(pending)}] kept={kept} err={errs} "
                      f"rate={rate:.1f}/s eta={eta:.0f}s", flush=True)
                OUT.write_text(json.dumps(out, ensure_ascii=False, sort_keys=True))

    OUT.write_text(json.dumps(out, ensure_ascii=False, sort_keys=True))
    print(f"\nDONE. Kept {kept}/{len(pending)} → {OUT}", flush=True)


if __name__ == "__main__":
    main()
