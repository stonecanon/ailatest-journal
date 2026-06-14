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


def load_gzip_optional(name):
    p = DATA / name
    if not p.exists():
        return {}
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.load(f)


def source_generated_at():
    sources = [
        DATA / "journals.json",
        DATA / "domestic.json",
        DATA / "cscd_journals.json",
        DATA / "fms_journals.json",
        DATA / "vhb_journals.json",
        DATA / "cnrs_journals.json",
        DATA / "scd_journals.json",
        DATA / "ami_journals.json",
        DATA / "annual_outputs.json.gz",
        DATA / "retraction_metrics.json.gz",
    ]
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
    retraction_metrics = load_gzip_optional("retraction_metrics.json.gz").get("metrics", {})

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
                b = by_issn[k]
                nk = norm(name)
                if nk:
                    by_name.setdefault(nk, b)
                    if re.search(r"[\u4e00-\u9fff]", str(name)) and not b.get("cn_name"):
                        b["cn_name"] = name
                return b
        nk = norm(name)
        if nk and nk in by_name:
            b = by_name[nk]
            if issn and not b.get("issn"):
                b["issn"] = issn
                by_issn.setdefault(issn_key(issn), b)
            if eissn and not b.get("eissn"):
                b["eissn"] = eissn
                by_issn.setdefault(issn_key(eissn), b)
            return b
        return new_badge(name=name, issn=issn, eissn=eissn)

    def retraction_for(issn="", eissn="", name=""):
        for key in (issn, eissn, norm(name)):
            if key and key in retraction_metrics:
                return retraction_metrics[key]
        return None

    # 1) international backbone
    for j in journals:
        b = new_badge(j.get("name", ""), j.get("issn", ""), j.get("eissn", ""))
        if j.get("cn_name"):
            b["cn_name"] = j["cn_name"]
            nk = norm(j["cn_name"])
            if nk:
                by_name.setdefault(nk, b)
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
            sc = j.get("scopus")
            b["scopus"] = True
            if isinstance(sc, dict):
                b["scopus_active"] = sc.get("active") is not False
                for src, dst in (
                    ("coverage", "scopus_coverage"),
                    ("discontinued", "scopus_discontinued"),
                    ("added_to_list", "scopus_added_to_list"),
                ):
                    if sc.get(src) not in (None, ""):
                        b[dst] = sc.get(src)
        if j.get("free"):
            b["free"] = True
        if j.get("cas_mega"):
            b["cas_mega"] = True
        if j.get("fms"):
            fms = j.get("fms")
            if isinstance(fms, dict) and fms.get("tier"):
                b["fms"] = {"tier": fms.get("tier"), "year": fms.get("year"), "type": fms.get("type")}
        if j.get("vhb"):
            vhb = j.get("vhb")
            if isinstance(vhb, list):
                b["vhb"] = [
                    {
                        "area_code": x.get("area_code"),
                        "rating": x.get("rating"),
                        "year": x.get("year"),
                        "votes": x.get("votes_ge_rating_percent"),
                    }
                    for x in vhb
                    if isinstance(x, dict) and x.get("rating")
                ]
        if j.get("cnrs"):
            cnrs = j.get("cnrs")
            if isinstance(cnrs, list):
                b["cnrs"] = [
                    {
                        "domain": x.get("domain"),
                        "category": x.get("category"),
                        "year": x.get("year"),
                        "historical": True,
                    }
                    for x in cnrs
                    if isinstance(x, dict) and x.get("category")
                ]
        if j.get("scd"):
            scd = j.get("scd")
            if isinstance(scd, dict):
                b["scd"] = {
                    "year": scd.get("year"),
                    "category": scd.get("category"),
                    "newly_added": bool(scd.get("newly_added")),
                }
        if j.get("ami"):
            ami = j.get("ami")
            if isinstance(ami, dict):
                b["ami"] = {"tier": ami.get("tier"), "year": ami.get("year"), "discipline": ami.get("discipline")}
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
        rm = retraction_for(j.get("issn", ""), j.get("eissn", ""), j.get("name", ""))
        if rm:
            compact = {
                "total": rm.get("retractions_total"),
                "r5": rm.get("retractions_5y"),
                "r10": rm.get("retractions_10y"),
                "rate5": rm.get("rate_per_1000_5y"),
                "rate10": rm.get("rate_per_1000_10y"),
            }
            b["retraction"] = {k: v for k, v in compact.items() if v not in (None, "", 0)}

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

    for r in records(dom.get("cstpcd")):
        if not r.get("name"):
            continue
        b = find_or_create(name=r["name"], issn=r.get("issn", ""))
        b["cstpcd"] = True

    for r in records(dom.get("scd")):
        if not r.get("name"):
            continue
        b = find_or_create(name=r["name"], issn=r.get("issn", ""))
        b["scd"] = {
            "year": dom.get("scd", {}).get("year") if isinstance(dom.get("scd"), dict) else 2026,
            "category": r.get("category", ""),
            "newly_added": bool(r.get("newly_added")),
        }

    for r in records(dom.get("ami")):
        if not r.get("name"):
            continue
        b = find_or_create(name=r["name"])
        b["ami"] = {"tier": r.get("tier", ""), "year": r.get("year", ""), "discipline": r.get("discipline", "")}

    for r in records(dom.get("vhb")):
        if not r.get("title"):
            continue
        b = find_or_create(name=r["title"], issn=r.get("issn", ""))
        arr = b.setdefault("vhb", [])
        item = {
            "area_code": r.get("area_code", ""),
            "rating": r.get("rating", ""),
            "year": dom.get("vhb", {}).get("year", 2024) if isinstance(dom.get("vhb"), dict) else 2024,
            "votes": r.get("votes_ge_rating_percent"),
        }
        if item["rating"] and not any((x.get("area_code"), x.get("rating")) == (item["area_code"], item["rating"]) for x in arr):
            arr.append(item)

    for r in records(dom.get("cnrs")):
        if not r.get("title"):
            continue
        b = find_or_create(name=r["title"], issn=r.get("issn", ""))
        arr = b.setdefault("cnrs", [])
        item = {
            "domain": r.get("domain", ""),
            "category": r.get("category", ""),
            "year": r.get("year", 2020),
            "historical": True,
        }
        if item["category"] and not any((x.get("domain"), x.get("category")) == (item["domain"], item["category"]) for x in arr):
            arr.append(item)

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
    for k in ("cas_zone", "cas_mega", "if_quartile", "fms", "vhb", "cnrs", "scd", "ami", "retraction", "cssci", "pku", "cnkx", "cscd", "ccft", "zju", "indices"):
        print(f"  with {k}: {cnt(k)}")


if __name__ == "__main__":
    main()
