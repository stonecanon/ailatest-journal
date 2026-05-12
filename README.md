# AILatest Journal

SCI / SSCI / AHCI / ESCI 期刊查询静态站，数据来自 Clarivate Web of Science Core Collection（更新至 2026-04-20）+ JCR 2025 + ESI。

> Live: [journal.ailatest.org](https://journal.ailatest.org) · 隶属 [ailatest.org](https://ailatest.org)

## 数据规模

| 指标 | 数量 |
|---|---|
| 总期刊数 | 23,185 |
| SCIE | 9,527 |
| SSCI | 3,557 |
| AHCI | 1,819 |
| ESCI | 9,449 |
| ESI 22 大类匹配 | 12,272 |

## 数据源

- `list/Science Citation Index Expanded (SCIE).csv`
- `list/Social Sciences Citation Index (SSCI).csv`
- `list/Arts & Humanities Citation Index (AHCI).csv`
- `list/Emerging Sources Citation Index (ESCI).csv`
- `list/JCR 2025.csv` — 提供 Title20 缩写 + 四索引旗标
- `list/ESI全部期刊列表.xlsx` — 12,278 本带 22 大学科大类

## 构建

```bash
python3 scripts/build_journals.py
```

产出：

- `data/journals.json` (~7.9 MB, gzip 后约 1.5 MB)
- `data/esi_categories.json` / `data/wos_categories.json`
- `data/meta.json`

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 数据来源与版权

- WoS 四大索引（SCIE/SSCI/AHCI/ESCI）来自 Clarivate 公开发布列表，更新至 2026-04-20。
- IF（影响因子）/ JCR 分区 / 中科院大类分区 / 中文刊名 / 预警名单：来自 [ShowJCR](https://github.com/hitfyd/ShowJCR)（GPL-v3 公开仓库）。
- ESI 22 学科分类来自学校 A图书馆公开发布目录。
- CCF 推荐目录来自中国计算机学会公开发布。
- 中国科协高质量科技期刊分级目录来自中国科协公开发布（46 学科全量）。
- 所有数据仅供学术检索参考；如有收录争议或下架请求，请提 issue。

## 技术栈

- 纯静态 HTML / CSS / 原生 JS，无构建依赖
- 搜索在前端本地完成（单次 fetch 全量 JSON，之后全内存过滤）
- 部署：Cloudflare Pages，CNAME → `journal.ailatest.org`
