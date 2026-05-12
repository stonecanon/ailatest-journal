# journal.ailatest.org

SCI 期刊查询与投稿推荐站点（ailatest 子站）。

## 现状（MVP）

- 纯静态页，部署 Cloudflare Pages
- 数据：ESI 期刊清单 12,278 条 · 22 大类
- 功能：按刊名 / ISSN / eISSN 搜索 + 按 ESI 分类筛选
- IF / 中科院分区暂未接入（版权归 Clarivate / 中科院文献情报中心）

## 结构

```
data/journals.json     # ESI 期刊主表
data/categories.json   # 22 大类 + 计数
scripts/build_journals.py  # Excel → JSON
css/journal.css  js/journal.js  index.html
```

## 重建数据

```bash
source ~/.hermes/hermes-agent/venv/bin/activate
python scripts/build_journals.py
```

源文件路径写死在脚本内（`~/.hermes/cache/documents/doc_4f0ce4c8295c_全部期刊列表.xlsx`）。

## 部署

GitHub: `stonecanon/ailatest-journal` → Cloudflare Pages 自动部署 → CNAME `journal.ailatest.org`。

## 路线图

- Phase 1 (当前) 静态 ESI 检索
- Phase 2 投稿推荐（摘要 embedding → 相似期刊）
- Phase 3 社区评论（Cloudflare D1）
