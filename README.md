<div align="center">
  <h1>
    <img src="https://journal.ailatest.org/icons/icon-192.png" width="32" height="32" style="vertical-align: middle; margin-right: 6px;">
    AILatest Journal · 知刊
  </h1>
  <p>
    <strong>全球学术期刊检索与推荐平台</strong><br>
    <em>The most comprehensive free journal finder &amp; recommendation platform for academic researchers</em>
  </p>
  <p>
    <a href="https://journal.ailatest.org">🌐 journal.ailatest.org</a> ·
    <a href="https://ailatest.org">📰 ailatest.org</a>
  </p>
  <p>
    <a href="https://journal.ailatest.org">
      <img src="screenshots/preview.png" alt="AILatest Journal current home page" width="800">
    </a>
  </p>
  <p>
    <a href="https://github.com/stonecanon/ailatest-journal/actions"><img src="https://img.shields.io/github/last-commit/stonecanon/ailatest-journal" alt="Last commit"></a>
    <a href="https://journal.ailatest.org"><img src="https://img.shields.io/badge/dynamic/json?color=blue&label=journals&query=total&url=https://journal.ailatest.org/data/meta.json" alt="Journals"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"></a>
  </p>
</div>

---

**AILatest Journal（知刊）** 是一个面向科研人员的学术期刊检索、投稿选刊与数据分析平台，覆盖 **5 万+** 国际期刊及 **SCIE / SSCI / AHCI / ESCI / EI / Scopus / DOAJ / MEDLINE** 等主流索引，集中展示影响因子、JCR/中科院分区、审稿周期、开放获取、APC 与预警风险等投稿参考信息。

基础检索在浏览器端完成，配合 Cloudflare Pages、Workers 与 D1 提供搜索 API、账户同步、动态期刊数据和地区统计。项目支持中文与英文界面，并持续更新数据和功能。

---

## ✨ 核心功能

| 功能 | Feature | 说明 |
|------|---------|------|
| 🔍 **期刊检索** | Search | 全称/缩写/ISSN 实时搜索，多维度筛选（索引、分区、学科、状态），毫秒级响应 |
| 🎯 **智能荐刊** | Pick for Me | 输入论文标题/摘要/关键词，生成候选期刊清单；本地匹配可直接试用，AI 语义增强按权限开放 |
| ⭐ **收藏同步** | Favorites | 登录后跨设备收藏同步，管理投稿清单 |
| 🏛️ **期刊详情** | Details | 影响因子、中科院/JCR 分区、审稿周期、OA/APC、出版地区与风险提示 |
| 🌐 **双语界面** | i18n | 中文 / English |
| 📱 **PWA 支持** | PWA | 可安装到手机主屏，离线基本可用 |
| ⚠️ **预警监控** | Warnings | 中科院预警、中信所预警、WoS On Hold、Under Review 与撤稿风险标记 |

---

## 📊 数据统计

以下为仓库当前数据包的统计快照，数据包更新时间为 **2026-08-06**；各指标的发布日期和更新周期不同，页面会标注对应来源与年份。

### 覆盖范围

| 指标 | Metric | 数量 |
|------|--------|-----:|
| **总期刊数** | **Total journals** | **50,350** |
| 🟢 **SCIE** | Science Citation Index Expanded | **9,433** |
| 🟡 **SSCI** | Social Sciences Citation Index | **3,538** |
| 🔵 **AHCI** | Arts & Humanities Citation Index | **1,799** |
| 🟣 **ESCI** | Emerging Sources Citation Index | **9,356** |
| 🟠 **EI** | Engineering Index (Compendex) | **4,887** |
| 📘 **Scopus** | Scopus | **29,887** |
| 📗 **DOAJ** | Directory of Open Access Journals | **22,975** |
| 📕 **MEDLINE** | NLM Current Journals | **5,368** |

### 期刊指标

| 指标 | Metric | 数量 |
|------|--------|-----:|
| 有 JCR IF 2025 | With Impact Factor | **21,975** |
| JCR 分区 | JCR Quartile | **22,834** |
| 中科院分区 | CAS Zone | **21,695** |
| 中科院大类 | CAS Major Category | **22,592** |
| ESI 学科 | ESI 22 Categories | **12,272** |
| WoS 学科 | WoS Subject Categories | **22,929** |
| 审稿周期 | Review Cycle Data | **26,070** |
| ABDC (澳大利亚) | ABDC 2025 | **2,651** |
| ABS (英国) | ABS 2024 | **1,822** |
| CCF 推荐 | CCF 2026 | **279** |
| CNKI 核心 | CNKI Major Chinese Journals | **6,038** |

### 预警与异常状态

| 状态 | Status | 数量 |
|------|--------|-----:|
| 🟠 中科院预警 | CAS Warning List 2025 | **105** |
| 🔴 中信所预警 | CITIC Warning List | **39** |
| 🟡 On Hold (WoS) | WoS On Hold | **19** |
| ⏸️ Under Review | Under Review (topeditsci) | **44** |

---

## 🎯 智能荐刊 — Pick for Me

<div align="center">
  <table>
    <tr>
      <td><a href="https://journal.ailatest.org/pick"><img src="screenshots/pick-tool.png" alt="AI journal recommendation form" width="390"></a></td>
      <td><a href="https://journal.ailatest.org/pick"><img src="screenshots/pick-results.png" alt="AI journal recommendation results" width="390"></a></td>
    </tr>
  </table>
</div>

输入论文标题、摘要或关键词后，系统会：

1. 提取研究主题和关键词，匹配本地期刊目录与相关论文信号；
2. 按索引、分区、学科、开放获取和综合性期刊等条件筛选；
3. 生成优选推荐与备选期刊清单，并展示匹配方向、分区、影响因子和投稿参考信息；
4. 在用户启用 AI 语义增强时进一步优化匹配结果。

荐刊结果用于缩小检索范围，不能替代作者对期刊 scope、最新目录和投稿要求的人工核验。

---

## 🏛️ 期刊详情页

<div align="center">
  <a href="https://journal.ailatest.org"><img src="screenshots/drawer.png" alt="Current journal detail page" width="800"></a>
</div>

每个期刊的详情页包含：
- **索引标识**: SCIE / SSCI / AHCI / ESCI / EI / Scopus / MEDLINE / DOAJ
- **分区信息**: 中科院 2025 大类分区 + TOP 标志、JCR Quartile
- **指标**: JCR 2025 最新影响因子 (IF)；去自引 JIF 与自引贡献率直接列出
- **学科分类**: ESI 22 大类、WoS 细分学科
- **核心信息**: ISSN、EISSN、出版商、语种、出版周期
- **OA 信息**: 开放获取状态、APC 费用、DOAJ 认证
- **预警标记**: 中科院预警、中信所预警、WoS On Hold、Under Review
- **学术评价**: CCF、ABDC、ABS 分级
- **审稿周期**: CrossRef 数据推导的平均审稿周期
- **出版与地区信息**: 出版商、出版国家/地区、作者机构国家/地区趋势（有数据时展示）
- **自引趋势**: JCR 口径的年度自引贡献率（有数据时展示）
- **OpenAlex Topics**: 主要研究领域标签与相关论文信号

---

## 📋 数据来源

| 数据 | Data Source | 说明 |
|------|-------------|------|
| WoS 核心索引 | Clarivate 公开列表 | SCIE/SSCI/AHCI/ESCI，更新至 2026-06-15 |
| JCR 指标 | [ShowJCR](https://github.com/hitfyd/ShowJCR) (GPL-3.0) | IF 2025、JCR Quartile、Eigenfactor |
| JCR 自引口径 | Clarivate JCR 2025 工作表 | 2025 去自引 JIF与自引贡献率，仅展示最新年度 |
| 中科院分区 | ShowJCR | 2025 大类分区 (1-4 区, TOP 标志) |
| EI Compendex | Elsevier 公开列表 | 更新至 2026-07-09 |
| Scopus | Elsevier 公开列表 | 2026-05 来源快照 |
| ESI 22 学科 | 高校图书馆公开发布 | 12,272 本期刊匹配 |
| DOAJ | Directory of Open Access Journals | 2026-07-06 公共 CSV，匹配 22,975 本 |
| MEDLINE | NLM Catalog | 2026-08-06 当前收录查询，匹配 5,368 本 |
| 审稿周期 | CrossRef + 自收集 | 26,070 个期刊实测数据 |
| 作者机构国家/地区 | [OpenAlex](https://openalex.org/) API + Crossref 兜底 | 按期刊和年份缓存到 Cloudflare D1，逐步补齐 |
| CCF 推荐 | 中国计算机学会 | 2026 版 A/B/C |
| ABDC | Australian Business Deans' Council | 2025 版 A*/A/B/C |
| ABS | Chartered ABS | Academic Journal Guide 2024 |
| 预警名单 | 中科院文献情报中心 | 2025 版 105 条 |
| 中信所预警 | 中信所 | 39 条预警期刊 |
| Under Review | [topeditsci](https://topeditsci.com) | 44 本考察期期刊 |
| On Hold | Clarivate / 自跟踪 | 19 本期刊 |
| OpenAlex | OpenAlex API / snapshot | Topics、OA、APC 元数据，以及作者机构国家/地区统计 |
| CNKI 中文期刊 | 知网 | 6,038 种中文核心期刊 |

---

## 🛠️ 技术栈

| 技术 | Tech | 用途 |
|------|------|------|
| **HTML/CSS/JS** | Vanilla SPA | 零框架，纯原生实现 |
| **Python** | Pandas, openpyxl | 数据清洗、合并、构建 |
| **Cloudflare Pages** | Edge CDN | 静态前端全球部署 |
| **Cloudflare Workers + D1** | Edge API / Database | 搜索、账户、支付回调、动态地区数据与定时预加载 |
| **GitHub → Cloudflare** | Auto Deploy | 网站与 Worker 的持续发布 |
| **OpenAlex / Crossref** | Scholarly APIs | 期刊元数据、主题和作者机构地区统计 |
| **PWA** | Service Worker | 离线缓存、主屏安装 |

---

## 🚀 本地开发

```bash
# 1. 克隆
git clone https://github.com/stonecanon/ailatest-journal.git
cd ailatest-journal

# 2. 更新公开目录数据（需 Python 3）
python3 scripts/refresh_doaj.py
python3 scripts/fetch_oaj_journals.py
python3 scripts/fetch_current_medline.py
python3 scripts/sync_current_directories.py

# build_journals.py 仅用于所有历史源文件齐备时的完整重建；
# 日常更新请使用上面的增量流程，以保留一次性榜单和地区索引字段。

# 3. 本地预览
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080

# 4. （可选）本地运行 Worker API
cd worker
npm install
npx wrangler dev
```

---

## 📁 项目结构

根目录保留的 HTML、`_headers`、`_redirects`、`robots.txt`、`sitemap.xml`、`manifest.json` 和 `sw.js` 都是 Cloudflare Pages 的公开入口或部署配置，直接对应网站 URL；数据、样式、脚本和生成器分别放在 `data/`、`css/`、`js/` 和 `scripts/` 中。

```
├── index.html              # SPA 主入口
├── css/app.css             # 样式（~5,400 行）
├── js/app.js               # 逻辑（IIFE, ~5,000 行）
├── scripts/
│   ├── build_journals.py   # 数据构建流水线
│   ├── fetch_openalex.py   # OpenAlex 数据抓取
│   └── merge_openalex.py   # OpenAlex 合并
├── data/                   # 构建产物（JSON/GZ）
├── screenshots/            # README 截图
├── icons/                  # PWA 图标 + OG 图
├── functions/api/          # Cloudflare Pages Functions（搜索 API）
├── functions/journal/      # 期刊详情 SSR / SEO canonical 页面
├── worker/                 # Cloudflare Worker、D1 migrations 与定时任务
├── weapp/                  # 微信小程序（预留）
├── robots.txt              # SEO
└── sitemap.xml             # SEO sitemap index（期刊 URL 分片在 sitemap-journals-*.xml）
```

---

## 📄 协议与声明

- WoS 数据来自 Clarivate 公开发布列表
- JCR/中科院/预警数据来自 [ShowJCR](https://github.com/hitfyd/ShowJCR)（GPL-3.0）
- 代码采用 **MIT License**，欢迎自由使用和贡献
- 如有收录争议或下架请求，请提 [GitHub Issue](https://github.com/stonecanon/ailatest-journal/issues)

---

<div align="center">
  <p>
    <a href="https://journal.ailatest.org">🔍 开始查询 → journal.ailatest.org</a>
  </p>
  <p>
    <sub>
      Built by <a href="https://github.com/stonecanon">stonecanon</a> ·
      <a href="https://ailatest.org">ailatest.org</a>
    </sub>
  </p>
</div>
