#!/usr/bin/env python3
"""快速测试一本期刊的审稿周期官网爬取"""
import json, sys, os, time, re
import requests
from datetime import date
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(__file__))
from fetch_review_cycles_website import *

# 测试 Building and Environment
issn = "0360-1323"
name = "BUILDING AND ENVIRONMENT"

print(f"测试: {name} (ISSN: {issn})\n")

# Step 1: CrossRef取DOI
dois = crossref_search(issn, rows=200, years=3)
print(f"\n共获取 {len(dois)} 篇论文DOI\n")

# Step 2: 爬文章页
days_list = []
for i, doi in enumerate(dois[:30]):  # 先测30篇
    url = f"https://doi.org/{doi}"
    html = fetch_page(url)
    if not html:
        print(f"  [{i+1}/30] ❌ 无法获取页面: {doi[:50]}")
        continue
    
    publisher = determine_publisher(html, doi)
    received, accepted = extract_dates_elsevier(html, doi)
    
    if received and accepted:
        days = compute_days(received, accepted)
        if days and 1 <= days <= 730:
            days_list.append(days)
            print(f"  [{i+1}/30] ✅ {days}d  received={received} accepted={accepted}  [{publisher}]")
        else:
            print(f"  [{i+1}/30] ⚠️ 天数异常: {days}d  rec={received} acc={accepted}  [{publisher}]")
    else:
        print(f"  [{i+1}/30] ❌ 无日期  received={received} accepted={accepted}  [{publisher}]")
    
    time.sleep(0.3)

if days_list:
    print(f"\n{'='*50}")
    print(f"结果: {len(days_list)}/{30} 篇有数据")
    print(f"平均: {sum(days_list)/len(days_list):.0f} 天")
    print(f"中位: {sorted(days_list)[len(days_list)//2]:.0f} 天")
    print(f"范围: {min(days_list)} - {max(days_list)} 天")
else:
    print(f"\n❌ 未获取到任何审稿周期数据")
