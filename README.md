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

## 版权说明

- 期刊元数据来自 Clarivate 公开发布列表，供学术检索参考。
- **IF（影响因子）与中科院分区因属商业授权数据，当前站点不展示。**
- 如有收录争议或下架请求，请提 issue。

## 技术栈

- 纯静态 HTML / CSS / 原生 JS，无构建依赖
- 搜索在前端本地完成（单次 fetch 全量 JSON，之后全内存过滤）
- 部署：Cloudflare Pages，CNAME → `journal.ailatest.org`
