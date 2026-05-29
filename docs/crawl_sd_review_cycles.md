# ScienceDirect 审稿周期爬虫 — 使用说明

## 目标

对 **CAS zone 1 但缺失审稿周期数据**的 141 本高影响因子期刊（环境科学、工程、计算机），从 **ScienceDirect 文章页**提取每篇论文的 **Received → Accepted 日期**，计算中位审稿周期。

## 为什么 VPS/部分网络爬不了

审稿历史（Received / Accepted）通常是公开元数据，不一定需要机构订阅。

真正的问题是 ScienceDirect 的 Cloudflare / bot protection：某些服务器 IP、机房 IP 或自动化浏览器会直接返回 403。此时即使文章元数据公开，也拿不到页面里的 `citation_received` / `citation_accepted`。

脚本现在采用两级策略：

1. 先用 CrossRef 获取 DOI、PII 和 Elsevier TDM/API 链接。
2. 如果配置了 `ELSEVIER_API_KEY`，优先走 Elsevier Article Retrieval API full view。
3. API 拿不到文章历史时，再回退到真实浏览器访问 ScienceDirect 文章页。

## 流程概览

```
本机/VPS  → CrossRef API 获取 DOI + PII + Elsevier API 链接
         → 可选：Elsevier Article Retrieval API full view
         → 可选：Chrome 浏览器(真实窗口) 访问 ScienceDirect 文章页
         → 提取收稿日期 + 录用日期
         → 计算每刊中位审稿天数
         → 输出 sd_review_cycles.json
                 ↓ (文件带回 VPS)
VPS       → merge_sd_data.py 合并到 review_cycles.json
```

---

## 第一步：安装依赖

```bash
pip3 install playwright
playwright install chromium
```

如果只走 Elsevier API，可以不启用浏览器：

```bash
SD_USE_BROWSER=0 python3 scripts/crawl_sd_review_cycles.py
```

如果你有 Elsevier API key：

```bash
ELSEVIER_API_KEY=你的key python3 scripts/crawl_sd_review_cycles.py
```

## 第二步：准备文件

把项目中的以下 3 个文件复制到运行机器的任意目录：

| 文件 | 用途 |
|------|------|
| `scripts/crawl_sd_review_cycles.py` | 主爬虫脚本 |
| `data/target_journals_3fields.json` | 目标期刊列表（141 本） |
| `scripts/merge_sd_data.py` | 合并脚本（带回 VPS 后用） |

或者直接下载：

```bash
# 从 VPS 项目拉取
cp scripts/crawl_sd_review_cycles.py ~/Desktop/
cp data/target_journals_3fields.json ~/Desktop/
cp scripts/merge_sd_data.py ~/Desktop/
```

## 第三步：运行爬虫

```bash
cd ~/Desktop
python3 crawl_sd_review_cycles.py
```

在项目根目录也可以直接运行：

```bash
python3 scripts/crawl_sd_review_cycles.py
```

### 运行后会怎样？

1. 逐刊通过 CrossRef 获取近 3 年的 100 篇论文 DOI、PII 和 Elsevier TDM 链接
2. 优先尝试 Elsevier Article Retrieval API 提取文章历史
3. 如果 API 无日期，再启动 Chrome 窗口访问 ScienceDirect 文章页
4. 对每篇论文：
   - 提取 `<meta name="citation_received">` / `<meta name="citation_accepted">`
   - 或从 API XML / 页面文本中的 Article History 提取 Received / Accepted
   - 计算天数差
5. 每爬完 10 刊自动保存一次（防中断丢数据）
6. 全部跑完输出 `sd_review_cycles.json`

### ⏱ 预估时间

- 每篇文章间隔 **3 秒**（防检测）
- 每刊 100 篇 → ~5 分钟
- 141 刊 → **约 12 小时**
- **建议晚上挂机跑**

### 中途可中断吗？

**可以。** Ctrl+C 随时停，已保存的数据不会丢失。下次重跑会自动跳过已有数据的期刊。

## 第四步：合并回 VPS

在学校电脑跑完后，把 `sd_review_cycles.json` 文件拿回 VPS（U盘/网盘/scp），放到项目根目录：

```bash
# 在 VPS 上（项目根目录下）
python3 scripts/merge_sd_data.py sd_review_cycles.json
```

自动合并到 `data/review_cycles.json`，覆盖掉原来标记为 `missing` 的记录。

## 脚本逻辑详解

### `crawl_sd_review_cycles.py`

```
main()
  ├─ load_targets()           # 读取 target_journals_3fields.json
  ├─ 启动 Playwright Chrome    # headless=False，打开真实窗口
  ├─ 测试 ScienceDirect 连通性 # 被拦截则退出
  └─ 循环每个期刊:
       ├─ get_dois_from_crossref(issn)
       │     → CrossRef API: /journals/{issn}/works
       │     → 返回最近 3 年的 DOI 列表（最多 100 篇）
       ├─ 对每个 DOI:
       │     ├─ page.goto(sd_url)         # 浏览器打开文章页
       │     ├─ extract_dates(page)       # 提取 Received/Accepted
       │     ├─ parse_date_to_days()      # 计算天数差
       │     └─ 存入 days_list
       ├─ 计算统计值
       │     ├─ median_days, mean_days
       │     ├─ min_days, max_days
       │     └─ n (样本量)
       └─ 每 BATCH_SAVE_INTERVAL 保存一次
  └─ 最终输出 sd_review_cycles.json
```

**关键配置参数（文件顶部可改）：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MAX_ARTICLES_PER_JOURNAL` | 100 | 每刊最多爬多少篇 |
| `YEARS_BACK` | 3 | 只爬近 N 年的文章 |
| `BATCH_SAVE_INTERVAL` | 10 | 每爬 N 刊保存一次 |
| `REQUEST_DELAY` | 3.0 | 每篇文章间隔（秒） |

### `merge_sd_data.py`

```
读取 sd_review_cycles.json
读取 data/review_cycles.json
遍历 sd_data:
  如果该刊有 median_days → 覆盖写入 review
  如果该刊无数据 → 跳过（保留原来的 missing 标记）
保存 review_cycles.json
```

### 数据格式

**sd_review_cycles.json 中的一条记录：**

```json
{
  "0360-1323": {
    "name": "BUILDING AND ENVIRONMENT",
    "issn": "0360-1323",
    "source": "Elsevier/ScienceDirect (browser)",
    "n": 85,
    "median_days": 98,
    "mean_days": 112.5,
    "min_days": 21,
    "max_days": 365,
    "updated": "2026-06-01"
  }
}
```

## 注意事项

1. 不一定需要机构订阅，但必须能访问 ScienceDirect 页面，或配置 `ELSEVIER_API_KEY`
2. 首次运行可能会弹出 Chrome 窗口，不要关，不要操作
3. 如果 ScienceDirect 被拦截，脚本不会立刻退出，会继续尝试 API 路径；但无 API key 时命中率会很低
4. 脚本内置 3 秒延迟，降低触发反爬的概率
5. 建议关掉电脑休眠，或者用 `caffeinate`（macOS）防止睡眠：
   ```bash
   caffeinate -i python3 crawl_sd_review_cycles.py
   ```
6. 如果只跑了一部分期刊就停了，下次重跑会跳过已有数据的期刊自动继续
