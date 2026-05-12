#!/usr/bin/env python3
"""解析浙江大学 2024 / 学校 A 2023 国内期刊分级目录 PDF。

两份版式近乎相同：
  一、国内一级学术期刊  -> tier = '一级'
  二、国内核心期刊      -> tier = '核心'
  三、其他期刊 / …      -> tier = '其他'

每条:  序号  刊名(可跨行)  ISSN(或 CN号)  (备注)

输出: data/zju_tiers.json / data/zju_city_tiers.json
     = {'source':str, 'records':[{'name','issn','cn_code','tier','note'}...]}
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parent.parent

FILES = [
    (ROOT/'list'/'浙江大学国内学术期刊分级目录指南·2024 版.pdf',
     ROOT/'data'/'zju_tiers.json', '浙江大学国内学术期刊分级目录指南 · 2024'),
    (ROOT/'list'/'学校 A期刊目录（2023 年版）.pdf',
     ROOT/'data'/'zju_city_tiers.json', '学校 A期刊目录 · 2023'),
]

RE_ISSN = re.compile(r'\d{4}-\d{3}[\dXx]')
RE_CN   = re.compile(r'CN\d{1,2}-\d{4}(?:/[A-Z\d]+)?', re.IGNORECASE)
RE_IDX  = re.compile(r'^\d{1,4}$')
RE_SEC  = re.compile(r'^[一二三四五六七八九十]+、')

SECTION_TIERS = [
    (re.compile(r'一级'), '一级'),
    (re.compile(r'核心'), '核心'),
    (re.compile(r'其他|补充|补遗'), '其他'),
]


def parse(path, out_path, source):
    doc = pymupdf.open(path)
    records = []
    cur_tier = None
    cur_row = {'idx': None, 'name_parts': [], 'issn': '', 'cn_code': '', 'note_parts': []}

    def flush():
        nonlocal cur_row
        name = ' '.join(cur_row['name_parts']).strip()
        name = re.sub(r'\s+', ' ', name)
        if cur_row['idx'] is not None and (name or cur_row['issn'] or cur_row['cn_code']):
            if cur_tier and name:
                records.append({
                    'name': name,
                    'issn': cur_row['issn'],
                    'cn_code': cur_row['cn_code'],
                    'tier': cur_tier,
                    'note': ' '.join(cur_row['note_parts']).strip(),
                })
        cur_row = {'idx': None, 'name_parts': [], 'issn': '', 'cn_code': '', 'note_parts': []}

    for pi in range(len(doc)):
        text = doc[pi].get_text('text')
        for raw in text.split('\n'):
            line = raw.strip()
            if not line: continue
            if RE_SEC.match(line):
                flush()
                for rx, tier in SECTION_TIERS:
                    if rx.search(line):
                        cur_tier = tier; break
                continue
            if line in ('序号', '刊名', '期刊名称', 'ISSN 号', 'ISSN', '备注'): continue
            if '注：' in line: 
                flush(); continue
            if RE_IDX.match(line):
                # 新条目开始
                flush()
                cur_row['idx'] = int(line); continue
            # issn / cn
            m = RE_ISSN.search(line)
            if m:
                cur_row['issn'] = m.group(0)
                rem = RE_ISSN.sub('', line).strip(' ·/—')
                if rem and RE_CN.search(rem):
                    cn_m = RE_CN.search(rem)
                    if cn_m: cur_row['cn_code'] = cn_m.group(0).upper()
                elif rem:
                    # 残留视为备注
                    cur_row['note_parts'].append(rem)
                continue
            m = RE_CN.search(line)
            if m and not cur_row['issn']:
                cur_row['cn_code'] = m.group(0).upper()
                rem = RE_CN.sub('', line).strip()
                if rem: cur_row['note_parts'].append(rem)
                continue
            # 文本 -> 先填 name，name 有 ISSN 后的文本视为备注
            if cur_row['issn'] or cur_row['cn_code']:
                cur_row['note_parts'].append(line)
            else:
                cur_row['name_parts'].append(line)
    flush()
    doc.close()

    print(f'{path.name}: {len(records)}')
    from collections import Counter
    tc = Counter(r['tier'] for r in records)
    print(f'  tiers: {dict(tc)}')
    print(f'  with ISSN: {sum(1 for r in records if r["issn"])}')

    out_path.write_text(json.dumps({
        'source': source,
        'records': records,
    }, ensure_ascii=False), encoding='utf-8')
    print(f'  wrote {out_path}')


def main():
    for p, o, s in FILES:
        parse(p, o, s)


if __name__ == '__main__':
    sys.exit(main())
