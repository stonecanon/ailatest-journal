#!/usr/bin/env python3
"""Parse 中国科协 2025-12 高质量科技期刊分级目录总汇 PDF.

表格布局差异极大（每个领域一套），做表头识别 + 单元格正则兜底。

识别的列语义：tier, seq, name, issn, cn, domain
表头关键字匹配：
  - 分级 / 级别      → tier
  - 序号             → seq
  - 期刊名称 / 刊名  → name
  - ISSN / EISSN     → issn
  - CN               → cn
  - 学科领域         → domain
"""
import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT / "list" / "中国科协科学技术创新部高质量科技期刊分级目录总汇.pdf"
OUT_PATH = Path("data/cnkx_records.json")

# --- 正则 ---
ISSN_RE = re.compile(r"\b\d{4}-\d{3}[\dXx]\b")
CN_RE = re.compile(r"\b\d{2}-\d{4}(?:/[A-Z0-9]+)?\b")
PURE_TIER_RE = re.compile(r"^\s*(☆?\s*T[123]|[ABCD]\+?|一类|二类|三类|特类)\s*$")
TIER_IN_HEADER_RE = re.compile(r"(T[123])\s*期刊")  # e.g. "应用数学类T2期刊"
SECTION_TITLE_RE = re.compile(r"《([^》]{2,60}?)》")
# 页首 H1：例如 "自动化学科领域高质量科技期刊分级目录"
PAGE_H1_RE = re.compile(r"^([\u4e00-\u9fa5A-Za-z0-9·、，\s]{2,30}?)(?:学科)?(?:领域)?(?:高质量)?(?:科技)?期刊分级目录$", re.M)

VALID_TIERS = {"T1", "T2", "T3", "A+", "A", "B", "C", "D", "一类", "二类", "三类", "特类"}
SAW_TIER_STAR = {"☆T1", "☆T2", "☆T3"}

# 关键词黑名单（整个单元格完全匹配或作子串时丢弃）
GARBAGE_NAME_PAT = re.compile(
    r"^(级别|序号|期刊名称|刊名|ISSN(?:/EISSN)?|CN|学科领域|分级|类|级|"
    r"（共\s*\d+\s*种）|编制单位|修订时间|一、|二、|三、|四、|五、|"
    r"一类|二类|三类|T[123]级?|A\+类|A类|B类|C类|D类|外文期刊|中文期刊|"
    r"英文期刊.*?|按字母排序.*?|排名不分.*?)$"
)


def norm(s):
    if s is None:
        return ""
    s = str(s).replace("\u3000", " ")
    s = re.sub(r"\s*\n\s*", " ", s).strip()
    s = re.sub(r"\s{2,}", " ", s)
    return s


def clean_name(s):
    s = norm(s)
    # 常见污染：结尾挂了 "T1"/"T2" tier
    s = re.sub(r"\s+T[123]\s*$", "", s)
    # 去掉开头的序号 "12 " / "12. "
    s = re.sub(r"^\d{1,4}[\.、]\s*", "", s)
    return s.strip()


def normalize_tier(s):
    if not s:
        return ""
    s = norm(s).replace(" ", "")
    if s in SAW_TIER_STAR:
        return s
    if s in VALID_TIERS:
        return s
    # "T2级" → T2
    m = re.match(r"^(T[123])级?$", s)
    if m:
        return m.group(1)
    m = re.match(r"^([ABCD]\+?)类?$", s)
    if m:
        return m.group(1)
    return ""


def is_garbage_name(s):
    if not s:
        return True
    if len(s) < 2:
        return True
    if GARBAGE_NAME_PAT.match(s):
        return True
    # 纯数字 / 纯标点
    if re.fullmatch(r"[\d\.\-\s、]+", s):
        return True
    # 目录项："1. 临床医学领域...（共 1160种）... 1"
    if re.search(r"\.{3,}\s*\d+\s*$", s):
        return True
    # 含 "共 xxx 种"
    if re.search(r"共\s*\d+\s*种", s):
        return True
    return False


def classify_header(header):
    """返回 col_index 的 role list: ['tier','seq','name','issn','cn','domain', None]."""
    roles = []
    for cell in header:
        # 表头常被拆行成 "分\n级" / "序\n号"，norm 后变 "分 级"，此处再去空白
        c = re.sub(r"\s+", "", norm(cell or ""))
        if re.search(r"(分级|级别)", c) and "学科" not in c:
            roles.append("tier")
        elif re.search(r"序号", c):
            roles.append("seq")
        elif re.search(r"(期刊名称|刊名)", c) or TIER_IN_HEADER_RE.search(c):
            roles.append("name")
        elif re.search(r"ISSN", c, re.I):
            roles.append("issn")
        elif re.fullmatch(r"CN", c, re.I) or c == "CN":
            roles.append("cn")
        elif re.search(r"学科领域", c):
            roles.append("domain")
        else:
            roles.append(None)
    return roles


def fallback_parse_row(cells):
    """没有表头时，按 cell 内容推测列。"""
    tier = ""
    seq = ""
    name_parts = []
    issn = ""
    cn = ""
    domain = ""
    for c in cells:
        c = norm(c)
        if not c:
            continue
        if not tier:
            t = normalize_tier(c)
            if t:
                tier = t
                continue
        if not seq and re.fullmatch(r"\d{1,4}", c):
            seq = c
            continue
        if not issn:
            m = ISSN_RE.search(c)
            if m and len(c) < 30:
                issn = m.group(0)
                continue
        if not cn:
            m = CN_RE.search(c)
            if m and len(c) < 20:
                cn = m.group(0)
                continue
        # 其余当 name / domain
        name_parts.append(c)
    # 最后一个短串（<=12 字符 & 全中文）可能是学科领域
    if len(name_parts) >= 2:
        tail = name_parts[-1]
        if 2 <= len(tail) <= 14 and re.fullmatch(r"[\u4e00-\u9fa5、，·\s]+", tail):
            domain = tail
            name_parts = name_parts[:-1]
    name = " ".join(name_parts).strip()
    return dict(tier=tier, seq=seq, name=name, issn=issn, cn=cn, domain=domain)


def parse_row_by_roles(row, roles):
    out = {"tier": "", "seq": "", "name": [], "issn": "", "cn": "", "domain": ""}
    for cell, role in zip(row, roles):
        c = norm(cell)
        if not c:
            continue
        if role == "tier":
            t = normalize_tier(c)
            if t:
                out["tier"] = t
        elif role == "seq":
            out["seq"] = c
        elif role == "name":
            out["name"].append(c)  # 允许多个 name 列（双栏）
        elif role == "issn":
            m = ISSN_RE.search(c)
            if m:
                out["issn"] = m.group(0)
        elif role == "cn":
            m = CN_RE.search(c)
            if m:
                out["cn"] = m.group(0)
        elif role == "domain":
            out["domain"] = c
        else:
            # 未知列 → 正则兜底
            if not out["issn"]:
                m = ISSN_RE.search(c)
                if m:
                    out["issn"] = m.group(0)
                    continue
            if not out["cn"]:
                m = CN_RE.search(c)
                if m:
                    out["cn"] = m.group(0)
                    continue
    return out


def parse_pdf():
    records = []
    current_section = "未分类"   # 来自 《...》 或页面 H1，顶层（约 30 个）
    last_tier = ""
    total_tables = 0
    empty_tables = 0

    with pdfplumber.open(PDF_PATH) as pdf:
        for pi, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            # 更新 section：优先页面顶部 H1（更稳），再 《》
            m2 = PAGE_H1_RE.search(text[:200])  # 仅在页头 200 字内找
            if m2:
                new_sec = m2.group(1).strip()
                if new_sec and new_sec != current_section:
                    current_section = new_sec
                    # 不重置 last_tier — 表格跨页时需要继承
            else:
                m = SECTION_TITLE_RE.search(text)
                if m and "分级目录" in m.group(0):
                    raw = m.group(1)
                    raw = re.sub(r"(学科|领域)?(高质量)?(科技)?期刊分级目录$", "", raw).strip()
                    if raw and raw != current_section:
                        current_section = raw

            tables = page.extract_tables()
            if not tables:
                empty_tables += 1

            for tbl in tables:
                total_tables += 1
                if len(tbl) < 2:
                    continue
                header = tbl[0] or []
                roles = classify_header(header)
                has_structured_header = any(r for r in roles)

                # 如果表头带 TIER_IN_HEADER（如 "应用数学类T2期刊"），从标题抓一个默认 tier
                default_tier = ""
                hjoin = " ".join(norm(c or "") for c in header)
                m3 = TIER_IN_HEADER_RE.search(hjoin)
                if m3:
                    default_tier = m3.group(1)

                # 如果表头本身就不含"期刊名称"等关键字，则 header 可能是首行数据
                start = 1 if has_structured_header else 0

                for row in tbl[start:]:
                    if not row:
                        continue
                    cells = [norm(c) for c in row]
                    if all(not c for c in cells):
                        continue
                    # 跳过重复表头
                    joined = "".join(cells)
                    if re.search(r"(级别|分级).*期刊名称", joined) or \
                       re.search(r"序号.*期刊名称", joined):
                        continue

                    if has_structured_header:
                        r = parse_row_by_roles(row, roles)
                        names = r["name"] if isinstance(r["name"], list) else [r["name"]]
                    else:
                        parsed = fallback_parse_row(row)
                        r = parsed
                        names = [parsed["name"]]

                    tier = r["tier"] or default_tier
                    if tier:
                        last_tier = tier
                    else:
                        tier = last_tier

                    issn = r.get("issn", "")
                    cn = r.get("cn", "")
                    domain = r.get("domain") or current_section

                    for nm in names:
                        nm = clean_name(nm)
                        if is_garbage_name(nm):
                            continue
                        # 从 name 中抠 ISSN/CN（常见破碎合并）
                        if not issn:
                            mi = ISSN_RE.search(nm)
                            if mi:
                                issn = mi.group(0)
                                nm = ISSN_RE.sub("", nm).strip()
                        if not cn:
                            mc = CN_RE.search(nm)
                            if mc:
                                cn = mc.group(0)
                                nm = CN_RE.sub("", nm).strip()
                        nm = clean_name(nm)
                        if is_garbage_name(nm):
                            continue
                        records.append({
                            "name": nm,
                            "issn": issn,
                            "cn_code": cn,
                            "tier": tier or None,
                            "domain": domain,
                        })

    return records, total_tables, empty_tables


def main():
    records, ntab, nempty = parse_pdf()

    # 去重：(lower name, domain, tier)
    seen = set()
    dedup = []
    for r in records:
        key = (r["name"].lower(), r["domain"], r["tier"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(r)

    with_tier = sum(1 for r in dedup if r["tier"])
    with_issn = sum(1 for r in dedup if r["issn"])
    tiers = {}
    for r in dedup:
        tiers[r["tier"] or "null"] = tiers.get(r["tier"] or "null", 0) + 1
    domains = {}
    for r in dedup:
        domains[r["domain"]] = domains.get(r["domain"], 0) + 1

    print(f"tables scanned    : {ntab}")
    print(f"pages w/o table   : {nempty}")
    print(f"raw records       : {len(records)}")
    print(f"dedup records     : {len(dedup)}")
    print(f"with tier         : {with_tier}  ({with_tier*100//max(len(dedup),1)}%)")
    print(f"with issn         : {with_issn}  ({with_issn*100//max(len(dedup),1)}%)")
    print(f"tier distribution : {tiers}")
    print(f"domain count      : {len(domains)}")
    for d, c in sorted(domains.items(), key=lambda x: -x[1])[:30]:
        print(f"   {c:5d}  {d}")

    OUT_PATH.write_text(json.dumps(dedup, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote -> {OUT_PATH}")


if __name__ == "__main__":
    main()
