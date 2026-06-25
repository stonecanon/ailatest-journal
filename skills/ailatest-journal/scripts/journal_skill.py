#!/usr/bin/env python3
"""Query online AILatest Journal skill endpoints and render concise evidence-backed output."""

from __future__ import annotations

import argparse
import json
import shutil
import socket
import subprocess
import sys
import textwrap
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_BASE = "https://journal.ailatest.org"


def request_json(base: str, path: str, payload: dict | None = None) -> dict:
    url = base.rstrip("/") + path
    data = None
    headers = {"Accept": "application/json", "User-Agent": "AILatest-Journal-Skill/1.0"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if shutil.which("curl"):
        args = [
            "curl", "-fsS", "--connect-timeout", "15", "--max-time", "120",
            "-H", "Accept: application/json",
            "-H", "User-Agent: AILatest-Journal-Skill/1.0",
        ]
        if payload is not None:
            args.extend(["-X", "POST", "-H", "Content-Type: application/json", "--data-binary", data.decode("utf-8")])
        args.append(url)
        try:
            done = subprocess.run(args, check=True, capture_output=True, text=True)
            return json.loads(done.stdout)
        except subprocess.CalledProcessError as exc:
            body = (exc.stderr or exc.stdout or "").strip()
            raise SystemExit(f"AILatest Journal API error via curl: {body[:500] or exc}") from exc
        except json.JSONDecodeError as exc:
            raise SystemExit(f"AILatest Journal API returned invalid JSON: {exc}") from exc
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload else "GET")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"AILatest Journal API error {exc.code}: {body[:500]}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Could not reach the online AILatest Journal API: {exc.reason}") from exc
    except (TimeoutError, socket.timeout) as exc:
        raise SystemExit("AILatest Journal API timed out while loading the online journal index. Please retry.") from exc


def split_csv(value: str) -> list[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def add_filter_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--subjects", default="", help="comma-separated WoS/ESI/CAS subjects")
    parser.add_argument("--indexes", default="", help="comma-separated indexes, e.g. SSCI,SCIE,Scopus")
    parser.add_argument("--jcr-quartile", default="", help="comma-separated JCR quartiles, e.g. Q1,Q2,Q3")
    parser.add_argument("--cas-zone", default="", help="comma-separated CAS zones, e.g. 1,2,3")
    parser.add_argument("--exclude-warning", action="store_true", help="exclude warning/on-hold/under-review journals")
    parser.add_argument("--sort-by", default="", choices=["", "relevance", "if", "name", "jcr", "cas", "review"], help="sort field")
    parser.add_argument("--order", default="desc", choices=["asc", "desc"], help="sort order")
    parser.add_argument("--page", type=int, default=1, help="page number")
    parser.add_argument("--page-size", type=int, default=0, help="page size; overrides --limit when set")


def filter_payload(args: argparse.Namespace) -> dict:
    payload: dict = {
        "page": max(1, args.page),
        "page_size": args.page_size if args.page_size else args.limit,
        "order": args.order,
    }
    if args.subjects:
        payload["subjects"] = split_csv(args.subjects)
    if args.indexes:
        payload["indexes"] = split_csv(args.indexes)
    if args.jcr_quartile:
        payload["jcr_quartile"] = split_csv(args.jcr_quartile)
    if args.cas_zone:
        payload["cas_zone"] = [int(v) for v in split_csv(args.cas_zone) if v.isdigit()]
    if args.exclude_warning:
        payload["exclude_warning"] = True
    if args.sort_by:
        payload["sort_by"] = args.sort_by
    return payload


def text_value(value, fallback="-") -> str:
    if value is None or value == "":
        return fallback
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return str(value)


def badge_line(item: dict) -> str:
    parts = []
    indexes = item.get("indexes") or []
    if indexes:
        parts.append("Indexes: " + ", ".join(indexes))
    jcr = item.get("jcr") or {}
    if jcr.get("quartile"):
        parts.append(f"JCR {jcr.get('quartile')}")
    cas = item.get("cas") or {}
    if cas.get("zone"):
        parts.append(f"CAS {cas.get('zone')}区" + (" TOP" if cas.get("top") else ""))
    risk = item.get("risk") or {}
    flags = []
    if risk.get("warning"):
        flags.append("CAS warning")
    if risk.get("citic_warning"):
        flags.append("CITIC warning")
    if risk.get("on_hold"):
        flags.append("WoS On Hold")
    if risk.get("under_review"):
        flags.append("Under Review")
    if flags:
        parts.append("Risk: " + ", ".join(flags))
    return " | ".join(parts)


def render_item(item: dict, rank: int) -> str:
    metrics = item.get("metrics") or {}
    access = item.get("access") or {}
    review = item.get("review") or {}
    subjects = item.get("subjects") or {}
    match = item.get("match") or {}
    lines = [
        f"{rank}. {item.get('title') or 'Unknown Journal'}",
        f"   ISSN: {text_value(item.get('issn'))} / eISSN: {text_value(item.get('eissn'))}",
        f"   IF: {text_value(metrics.get('if'))} ({text_value(metrics.get('if_year'))}); Rank: {text_value(metrics.get('if_rank'))}",
    ]
    badges = badge_line(item)
    if badges:
        lines.append(f"   {badges}")
    if subjects.get("wos") or subjects.get("esi"):
        wos = "; ".join((subjects.get("wos") or [])[:3])
        esi = subjects.get("esi") or ""
        lines.append(f"   Subjects: {wos}{' | ESI: ' + esi if esi else ''}")
    fee = access.get("apc_usd")
    if fee is not None:
        lines.append(f"   APC: about {fee} USD")
    elif access.get("apc_fee"):
        lines.append(f"   APC: {access.get('apc_fee')}")
    elif access.get("free"):
        lines.append("   APC: free/no APC signal")
    if review.get("months"):
        lines.append(f"   Review cycle: about {review.get('months')} months")
    if match.get("matched_terms"):
        lines.append("   Matched terms: " + ", ".join(match["matched_terms"][:8]))
    if item.get("url"):
        lines.append(f"   URL: {item['url']}")
    return "\n".join(lines)


def render_response(data: dict, title: str) -> str:
    if not data.get("ok", True):
        return f"{title}\n\nError: {data.get('message') or data.get('error')}"
    items = data.get("items") or []
    header = [
        title,
        "",
        f"Mode: {data.get('mode', '-')}; Total matches: {data.get('total', len(items))}",
    ]
    if data.get("query"):
        header.append("Query: " + textwrap.shorten(str(data["query"]), width=220, placeholder="..."))
    if data.get("terms"):
        header.append("Key terms: " + ", ".join(data["terms"][:12]))
    if not items:
        return "\n".join(header + ["", "No matching journals found."])
    body = [render_item(item, idx + 1) for idx, item in enumerate(items)]
    notes = data.get("notes") or []
    footer = ["", "Notes:"] + [f"- {note}" for note in notes] if notes else []
    return "\n\n".join(["\n".join(header)] + body + ["\n".join(footer)]).strip()


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Network-only AILatest Journal search and recommendation helper")
    parser.add_argument("--base", default=DEFAULT_BASE, help="online AILatest Journal site base URL")
    parser.add_argument("--json", action="store_true", help="print raw JSON")
    sub = parser.add_subparsers(dest="command", required=True)

    search = sub.add_parser("search", help="search a journal by title, abbreviation, ISSN, or Chinese name")
    search.add_argument("query", help="journal title, abbreviation, ISSN, or keyword")
    search.add_argument("--limit", type=int, default=8)
    add_filter_args(search)

    rec = sub.add_parser("recommend", help="recommend journals from a paper title/abstract/keywords")
    rec.add_argument("--title", required=True, help="paper title or research topic")
    rec.add_argument("--abstract", default="", help="optional abstract")
    rec.add_argument("--keywords", default="", help="optional comma-separated keywords")
    rec.add_argument("--limit", type=int, default=10)
    add_filter_args(rec)

    quota = sub.add_parser("quota", help="show suggested free quota and paid plan policy")

    args = parser.parse_args(argv)
    if args.command == "search":
        payload = {"query": args.query, **filter_payload(args)}
        data = request_json(args.base, "/api/skill/search", payload)
        title = "AILatest Journal Search"
    elif args.command == "recommend":
        payload = {
            "title": args.title,
            "abstract": args.abstract,
            "keywords": split_csv(args.keywords),
            **filter_payload(args),
        }
        data = request_json(args.base, "/api/skill/recommend", payload)
        title = "AILatest Journal Recommendation"
    else:
        data = request_json(args.base, "/api/skill/quota")
        title = "AILatest Journal Quota Policy"

    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        if args.command == "quota":
            print(json.dumps(data, ensure_ascii=False, indent=2))
        else:
            print(render_response(data, title))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
