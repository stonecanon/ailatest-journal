#!/usr/bin/env python3
"""Build data/ext_lookup.json.gz for the browser extension lookup endpoint.

Merges international journals.json with the domestic ranking sources
(CSSCI / 北大核心 / 科协 cnkx / CSCD / CCF-T / 浙大 / NSFC) into one flat list
of badge objects. The Worker (worker/src/ext-lookup.js) builds ISSN + name
indexes from this file at cold start, so we only emit raw names/issns here and
let the Worker normalize names with the shared pick-match norm().
"""
import gzip
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = DATA / "ext_lookup.json.gz"


def norm(s):
    """Mirror js/pick-match.js norm() closely (NFKD, strip marks, alnum+CJK)."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", str(s)).lower()
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9一-鿿]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def issn_key(v):
    if not v:
        return ""
    return re.sub(r"[^0-9Xx]", "", str(v)).upper()


def load(name):
    p = DATA / name
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def source_generated_at():
    sources = [DATA / "journals.json", DATA / "domestic.json", DATA / "cscd_journals.json"]
    latest = max(p.stat().st_mtime for p in sources if p.exists())
    return datetime.fromtimestamp(latest, timezone.utc).isoformat()


def records(obj):
    if isinstance(obj, list):
        return obj
    if isinstance(obj, dict) and isinstance(obj.get("records"), list):
        return obj["records"]
    return []


def main():
    journals = load("journals.json")
    dom = load("domestic.json")
    cscd = records(load("cscd_journals.json"))

    # ── badge objects, keyed for merging ──
    # canonical key: prefer issn, else normalized name
    by_issn = {}   # issnKey -> badge
    by_name = {}   # normName -> badge
    out = []

    def new_badge(name="", issn="", eissn=""):
        b = {"name": name or "", "issn": issn or "", "eissn": eissn or ""}
        out.append(b)
        if issn_key(issn):
            by_issn.setdefault(issn_key(issn), b)
        if issn_key(eissn):
            by_issn.setdefault(issn_key(eissn), b)
        nk = norm(name)
        if nk:
            by_name.setdefault(nk, b)
        return b

    def find_or_create(name="", issn="", eissn="", cn_code=""):
        for k in (issn_key(issn), issn_key(eissn)):
            if k and k in by_issn:
                return by_issn[k]
        nk = norm(name)
        if nk and nk in by_name:
            return by_name[nk]
        return new_badge(name=name, issn=issn, eissn=eissn)

    # 1) international backbone
    for j in journals:
        b = new_badge(j.get("name", ""), j.get("issn", ""), j.get("eissn", ""))
        if j.get("cn_name"):
            b["cn_name"] = j["cn_name"]
        b["slug"] = j.get("slug", "")
        if j.get("if_2024") not in (None, ""):
            b["if_2024"] = j["if_2024"]
        if j.get("if_quartile"):
            b["if_quartile"] = j["if_quartile"]
        if j.get("cas_zone"):
            b["cas_zone"] = j["cas_zone"]
        if j.get("cas_top"):
            b["cas_top"] = True
        xr = j.get("cas_xr")
        if isinstance(xr, dict) and xr.get("zone"):
            b["cas_xr"] = {"zone": xr.get("zone"), "top": bool(xr.get("top"))}
        if j.get("ccf"):
            b["ccf"] = j["ccf"]
        if j.get("abdc"):
            b["abdc"] = j["abdc"]
        if j.get("abs"):
            b["abs"] = j["abs"]
        if j.get("indices"):
            b["indices"] = j["indices"]
        if j.get("scopus"):
            b["scopus"] = True
        if j.get("free"):
            b["free"] = True
        doaj = j.get("doaj")
        if isinstance(doaj, dict) and doaj.get("apc") not in (None, ""):
            b["doaj_apc"] = str(doaj["apc"])
        if j.get("warning"):
            b["warning"] = True
        if j.get("citic_warning"):
            b["citic_warning"] = True
        if j.get("on_hold"):
            b["on_hold"] = True
        if j.get("under_review"):
            b["under_review"] = True

    # 2) domestic enrichments (match by issn → name, else create)
    for r in records(dom.get("cssci_core")):
        if not r.get("name") or r["name"].startswith("序号"):
            continue
        find_or_create(name=r["name"])["cssci"] = "core"
    for r in records(dom.get("cssci_ext")):
        if not r.get("name") or r["name"].startswith("序号"):
            continue
        b = find_or_create(name=r["name"])
        b.setdefault("cssci", "ext")
    for r in records(dom.get("pku_core")):
        if not r.get("name"):
            continue
        find_or_create(name=r["name"])["pku"] = True
    for r in records(dom.get("zju")):
        nm = (r.get("name") or "").rstrip("*").strip()
        if not nm:
            continue
        b = find_or_create(name=nm, issn=r.get("issn", ""))
        b["zju"] = r.get("tier", "")
    for r in records(dom.get("nsfc_mgmt")):
        if not r.get("name"):
            continue
        find_or_create(name=r["name"])["nsfc_mgmt"] = r.get("tier", "")
    for r in records(dom.get("ccft")):
        nm = r.get("cn_name") or r.get("en_name") or ""
        if not nm:
            continue
        b = find_or_create(name=nm)
        b["ccft"] = r.get("tier", "")
        if r.get("en_name"):
            b.setdefault("name", r["en_name"])
    for r in cscd:
        if not r.get("name"):
            continue
        b = find_or_create(name=r["name"], issn=r.get("issn", ""))
        b["cscd"] = r.get("database_label") or r.get("database") or "CSCD"

    # 科协 cnkx: a journal can span multiple disciplines → list of {tier,domain}
    for r in records(dom.get("cnkx")):
        tier = r.get("tier", "")
        if not r.get("name") or not re.match(r"^T[123]$", tier or ""):
            continue
        b = find_or_create(name=r["name"], issn=r.get("issn", ""), eissn=r.get("eissn", ""))
        arr = b.setdefault("cnkx", [])
        key = (tier, r.get("domain", ""))
        if not any((x.get("tier"), x.get("domain")) == key for x in arr):
            arr.append({"tier": tier, "domain": r.get("domain", "")})

    payload = {
        "generated_at": source_generated_at(),
        "count": len(out),
        "journals": out,
    }
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with open(OUT, "wb") as raw_out:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw_out, mtime=0) as f:
            f.write(raw)
    print(f"wrote {OUT} — {len(out)} journals, {OUT.stat().st_size/1024/1024:.1f} MB gz")
    # quick stats
    def cnt(k):
        return sum(1 for b in out if k in b)
    for k in ("cas_zone", "if_quartile", "cssci", "pku", "cnkx", "cscd", "ccft", "zju", "indices"):
        print(f"  with {k}: {cnt(k)}")


if __name__ == "__main__":
    main()
