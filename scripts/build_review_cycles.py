#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build data/review_cycles.json from CrossRef (assertion dates) + DOAJ (weeks).

Queries CrossRef journal works for received→accepted date pairs via assertion fields.
Also reads DOAJ CSV for 'Average number of weeks between article submission and publication'.
DOAJ data uses that field directly (no CrossRef API call needed).
"""
import csv, json, urllib.request, urllib.error, ssl, statistics, time
from datetime import date, datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "journals.json"
OUT = ROOT / "data" / "review_cycles.json"
DOAJ_CSV = ROOT / "list" / "doaj_journals.csv"

UA = "AILatest-Journal/1.0 (mailto:43259074+stonecanon@users.noreply.github.com)"
TODAY = date.today().isoformat()
MIN_PAIRS = 4
ROWS = 50
WORKERS = 3


def parse_date(val):
    """Parse a date from various formats:
       - {"date-parts": [[2024, 3, 9]]}  (CrossRef standard)
       - "31 October 2023"  (assertion string)
       - "2023-10-31"      (ISO)
    """
    if val is None:
        return None
    if isinstance(val, dict):
        try:
            dp = val.get("date-parts", [[]])[0]
            if len(dp) >= 3:
                return date(int(dp[0]), int(dp[1]), int(dp[2]))
        except Exception:
            pass
        return None
    if isinstance(val, str):
        val = val.strip()
        # Try ISO first (YYYY-MM-DD)
        try:
            return date.fromisoformat(val[:10])
        except: pass
        # Try "31 October 2023"
        for fmt in ("%d %B %Y", "%d %b %Y", "%B %d, %Y", "%b %d, %Y",
                    "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(val, fmt).date()
            except: pass
    return None


def fetch_one(issn):
    url = f"https://api.crossref.org/journals/{issn}/works?rows={ROWS}&filter=from-pub-date:2024-01-01"
    ctx = ssl.create_default_context()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            items = json.loads(r.read())["message"]["items"]
    except Exception:
        return issn, None, 0

    days = []
    for it in items:
        # Top-level received/accepted (rare)
        rd = parse_date(it.get("received"))
        ad = parse_date(it.get("accepted"))
        # Assertion fallback (common: "31 October 2023" style)
        if not (rd and ad):
            for a in it.get("assertion", []) or []:
                n = (a.get("name") or "").lower().replace(" ", "_")
                v = (a.get("value") or "").strip()
                if n in ("received", "date_received") and not rd:
                    rd = parse_date(v)
                elif n in ("accepted", "date_accepted") and not ad:
                    ad = parse_date(v)
                elif n in ("submission_date", "submitted", "date_submitted") and not rd:
                    rd = parse_date(v)
                elif n in ("acceptance_date", "date_accepted") and not ad:
                    ad = parse_date(v)
        if rd and ad:
            d = (ad - rd).days
            if 0 < d < 1500:
                days.append(d)

    # Also try "published-print" date parts from the work itself
    if len(days) < MIN_PAIRS:
        for it in items:
            pp = it.get("published-print") or it.get("published-online") or it.get("published")
            rd2 = parse_date(it.get("received"))
            if pp and rd2:
                ppd = parse_date(pp)
                if ppd and rd2:
                    d = (ppd - rd2).days
                    if 0 < d < 1500:
                        days.append(d)

    med = int(statistics.median(days)) if days else None
    return issn, med, len(days)


def load_doaj():
    """Read DOAJ CSV and return {issn_or_eissn: avg_months}."""
    doaj = {}
    try:
        with open(DOAJ_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                w = row.get('Average number of weeks between article submission and publication', '').strip()
                if not w:
                    continue
                try:
                    weeks = float(w)
                except ValueError:
                    continue
                avg_months = round(weeks / 4.33, 1)  # weeks → months
                # Register under both print ISSN and EISSN if available
                for col in ('Journal ISSN (print version)', 'Journal EISSN (online version)'):
                    issn = row.get(col, '').strip()
                    if issn:
                        doaj[issn] = avg_months
    except FileNotFoundError:
        print(f"WARNING: DOAJ CSV not found at {DOAJ_CSV}", flush=True)
    return doaj


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

    # --- DOAJ phase (no API calls) ---
    doaj_data = load_doaj()
    doaj_hit = 0
    for issn in targets:
        if issn in doaj_data:
            out[issn] = {
                "avg_months": doaj_data[issn],
                "source": "DOAJ",
                "updated": TODAY,
            }
            doaj_hit += 1
    print(f"DOAJ: {doaj_hit}/{len(targets)} journals matched ({doaj_hit/len(targets)*100:.1f}%)", flush=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, sort_keys=True))
    print(f"  → saved to {OUT}", flush=True)

    # --- CrossRef phase (API calls for remaining) ---
    cr_targets = [i for i in targets if i not in out]
    pending = []  # CrossRef disabled — run separately with --crossref flag
    # (CrossRef API code continues below...)
    print(f"CrossRef targets: {len(cr_targets)} (remaining after DOAJ, SKIPPED)", flush=True)

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
                    "source": "CrossRef (assertion)", "year_window": "2024+", "updated": TODAY,
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
    doaj_count = len([v for v in out.values() if v.get('source') == 'DOAJ'])
    cr_count = len(out) - doaj_count
    print(f"\nDONE in {elapsed:.0f}s ({rate:.2f}/s)", flush=True)
    print(f"  DOAJ:      {doaj_count:>6}", flush=True)
    print(f"  CrossRef:  {cr_count:>6}  (kept {kept}, no-data {nf})", flush=True)
    print(f"  Total:     {len(out):>6}  → {OUT}", flush=True)


if __name__ == "__main__":
    main()
