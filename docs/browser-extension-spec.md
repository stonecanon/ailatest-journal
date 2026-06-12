# 任务：为 AILatest Journal 开发浏览器插件（MV3）

> 交付给 Codex 的实现说明书。自包含——无需额外对话上下文即可执行。

> **⚠️ 状态：阶段 P0（后端 lookup）已实现并部署，Codex 只需做 P1+（扩展前端）。**
> 已落地：`scripts/build_ext_lookup.py`、`data/ext_lookup.json.gz`（48070 条）、`worker/src/ext-lookup.js`、`worker/src/index.js` 路由。
> 线上接口可直接调用，契约见文末「附录 A」。Codex 从 **阶段 P1** 开始即可。

## 0. 背景与目标

`ailatest-journal` 是一个期刊查询/荐刊网站。现要做一个浏览器扩展（对标 easyScholar）：在学术网站（知网、谷歌学术、Web of Science、ScienceDirect、PubMed 等）的检索结果/详情页，**在每个期刊标题旁注入分级徽章**（中科院分区、JCR、IF、CSSCI、北大核心、科协、CSCD、CCF、ABS、预警、是否免费发表等）。

**核心原则**：插件是“薄客户端”。所有数据和判分逻辑复用现有后端，扩展只负责“在别人网页上抓刊名/ISSN → 查后端 → 注入徽章”。

## 1. 现有可复用资产（务必复用，不要重造）

- **Worker API**：`worker/src/index.js`，已部署在 `api.ailatest.org`，且同源路由 `journal.ailatest.org/api/*`（dispatcher 里会 strip 掉 `/api` 前缀）。CORS 已全开（`Access-Control-Allow-Origin: *`）。
- **数据加载器**：`worker/src/deepseek-common.js` 的 `loadJournals(env)`（解压 `journals.json.gz`，进程级缓存）和 `json()`、`CORS` helper。
- **国际刊数据**：`data/journals.json.gz`（约 4.5 万条），字段含 `name, issn, eissn, indices[], if_2024, if_quartile, cas_zone, cas_top, cas_xr, ccf, abdc, abs, scopus, doaj{apc}, free, warning, citic_warning, on_hold, under_review, wos_categories[]`。
- **国内刊数据**：`data/domestic.json`（CSSCI/北大核心/科协 cnkx/浙大/CCF-T/NSFC）+ `data/cscd_journals.json`（CSCD 1501 条）。⚠️ **这些不在 journals.json 里**，知网等中文站点的徽章需要它们。
- **徽章样式**：`css/app.css` 里已有 `.tier-pill / .domsrc-pill / .zone / .if-pill / .on-hold-pill / .citic-warning-pill / .flagship-pill` 等，配色可直接照搬到插件。
- **归一化逻辑**：`js/pick-match.js` 的 `norm()`（刊名归一化，匹配用）。
- **登录/额度**：D1 里有 JWT 鉴权（`getUser`）和 `pick_usage` 额度表，后续收费可挂这套，v1 先不强制登录。

## 2. 阶段拆分（按顺序交付）

### 阶段 P0 —— 后端：统一查询数据 + lookup 接口

**任务 0.1：生成扩展专用的精简查询库**

新建 `scripts/build_ext_lookup.py`，合并 `journals.json` + `domestic.json` + `cscd_journals.json`，输出 `data/ext_lookup.json.gz`：

- 结构：`{ "byIssn": { "<issn无连字符>": <badgeObj> }, "byName": { "<norm刊名>": <badgeObj> } }`
- `badgeObj` 只保留徽章所需字段：`name, issn, eissn, if_2024, if_quartile, cas_zone, cas_top, cas_xr, ccf, abdc, abs, indices, scopus, free, doaj_apc, warning, citic_warning, on_hold, under_review, cssci(core/ext), pku_core, cnkx[{tier,domain}], cscd(库类型), ccft, zju, slug`
- ISSN 同时索引 issn 和 eissn；刊名用与 `pick-match.js` 一致的 `norm()`。

**任务 0.2：lookup 接口**

在 `worker/src/index.js` dispatcher 加路由（注意 `/api` 前缀已被 strip）：

- `GET /ext/lookup?issn=XXXX-XXXX` 和 `GET /ext/lookup?name=<刊名>` → 返回单条 `badgeObj` 或 `{found:false}`。
- `POST /ext/lookup`，body `{ items:[{issn?,name?}, ...] }`（≤100）→ 返回 `{ results:[badgeObj|null, ...] }`（批量，给一页多条结果用）。
- 实现：新建 `worker/src/ext-lookup.js`，冷启动 `fetch ext_lookup.json.gz` 解压建索引（进程级缓存，仿 `loadJournals`）。ISSN 优先，未命中再 norm 刊名匹配。
- CORS 复用现有 `CORS`。响应加 `Cache-Control: public, max-age=86400`。

**验收**：`curl 'https://journal.ailatest.org/api/ext/lookup?issn=0140-6736'` 返回 The Lancet 的徽章数据；`?name=the%20lancet` 同样命中。

### 阶段 P1 —— 扩展骨架 + 2 个站点 PoC（知网 + 谷歌学术）

**任务 1.1：MV3 骨架**，新建目录 `extension/`：

```
extension/
  manifest.json          # MV3
  src/
    content.js           # 编排：选适配器→扫描→批量lookup→注入→MutationObserver
    lookup.js            # API 客户端 + chrome.storage.local 缓存(TTL 7天)
    badges.js            # 用 Shadow DOM 渲染徽章组件(避免与宿主页样式冲突)
    norm.js              # 从 pick-match.js 抽出的 norm()（刊名归一化）
    adapters/
      index.js           # hostname → adapter 映射
      cnki.js            # 知网适配器
      googleScholar.js   # 谷歌学术适配器
  popup/
    popup.html / popup.js / popup.css   # 设置：勾选显示哪些分级 + 关于
  assets/icon-{16,48,128}.png
```

**任务 1.2：适配器接口规范**（每个站点实现这个接口）：

```js
export default {
  match: (host) => /scholar\.google\./.test(host),
  // 返回页面上所有"待标注条目"
  findEntries: () => [{ anchorEl, issn /* 可选 */, journalName /* 可选 */ }],
  // 把徽章节点插到条目旁
  insert: (anchorEl, badgeNode) => { /* ... */ },
};
```

- **知网**：从检索结果/详情页抓「来源(刊名)」，多数无 ISSN → 用刊名匹配。
- **谷歌学术**：从每条结果的出版信息里抓刊名（无 ISSN，刊名常含卷期，要清洗）。

**任务 1.3：content.js 编排**

- 按 `location.host` 选适配器；`findEntries()` 收集 → 去重 → `POST /ext/lookup` 批量查 → 命中的用 `badges.js` 渲染 → `adapter.insert()`。
- 用 `MutationObserver` 处理翻页/异步加载；已注入的打标记防重复。

**任务 1.4：badges.js（Shadow DOM）**

- 在徽章容器挂 `attachShadow`，内联一份精简 CSS（从 `css/app.css` 摘相关 pill 样式），避免被宿主页 CSS 污染。
- 徽章顺序建议：中科院分区(带TOP) → JCR Q → IF → CCF → ABS/ABDC → CSSCI/北大核心/科协(学科)/CSCD → ⚠预警/免费发表。
- 科协徽章按“科协+学科”显示、最多 3 个 +N（逻辑同站内 `renderDomCrossBadges`）。

**验收**：在知网搜任意中文期刊、谷歌学术搜任意英文论文，标题旁出现徽章；翻页后新结果也能标注；控制台无报错；徽章样式不被宿主页破坏。

### 阶段 P2 —— 扩站点

依次加适配器：**Web of Science、ScienceDirect、PubMed、Scopus、Springer、IEEE Xplore、百度学术、万方**。每站一个 `adapters/<site>.js`，复用 content.js 编排，不改核心。

### 阶段 P3 —— 设置 / 账号 / 缓存打磨

- popup 设置：勾选显示哪些分级体系（存 `chrome.storage.sync`），content.js 按设置过滤徽章。
- 缓存：`chrome.storage.local` 存 lookup 结果（key=issn/normName，TTL 7 天），减少请求。
- （可选）登录：用现有 JWT，popup 里登录后带 `Authorization` 头。

### 阶段 P4 —— 收费（最后做，先留接口）

- 免费：基础分区/IF/核心；付费：高校目录全集 / AI 荐刊次数。挂现有 `pick_usage` D1 额度表，lookup 接口按用户 plan 决定返回哪些字段。

## 3. manifest.json 要点

- `manifest_version: 3`
- `host_permissions`：`https://journal.ailatest.org/*`、`https://api.ailatest.org/*` + 各目标站点域名。
- `content_scripts`：按站点 `matches` 注入 `content.js`（`run_at: document_idle`）。
- `permissions`：`storage`。
- `action`：popup。最小权限原则（商店审核）。

## 4. 注意事项（务必遵守）

1. **匹配优先级**：ISSN > 归一化刊名。刊名匹配要先清洗（去卷期号、年份、出版商后缀）。宁可不标，不要标错。
2. **每站点适配器独立**：站点改版只修对应适配器，不影响其它站。
3. **Shadow DOM 隔离样式**，否则会被知网/WoS 的全局 CSS 搞乱。
4. **批量、限频、缓存**：一页可能几十条，必须批量 + 缓存，别一条一个请求。
5. **不要抓取/存储宿主页的用户数据**；插件只读刊名/ISSN。
6. **数据版权**：徽章数据来自本站后端即可，不要在插件里内嵌第三方目录文件。
7. 不改动现有网站前端（`js/app.js` 等）；后端只新增 `ext-lookup.js` 和一条路由，不动现有路由。

## 5. 交付物

- `extension/`（可 `Load unpacked` 直接装的 MV3 扩展，含知网+谷歌学术）。
- `worker/src/ext-lookup.js` + dispatcher 新增路由。
- `scripts/build_ext_lookup.py` + 生成的 `data/ext_lookup.json.gz`。
- `extension/README.md`：如何 build 数据、本地加载扩展、加新站点适配器的步骤。

## 6. 建议的执行顺序

1. 先做 **P0**（后端 lookup 接口 + 数据），用 `curl` 验收通过。
2. 再做 **P1**（扩展骨架 + 知网 + 谷歌学术），`Load unpacked` 在真实页面验收。
3. P1 跑通后再按 **P2** 逐站点扩展。
4. P3/P4 最后做。

每个阶段独立可验收，不要跳阶段。

---

## 附录 A：lookup 接口契约（P0 已上线，直接用）

Base URL（同源，免 CORS 预检）：`https://journal.ailatest.org/api/ext/lookup`
（等价 `https://api.ailatest.org/ext/lookup`）

**单条查询**
```
GET /api/ext/lookup?issn=0140-6736
GET /api/ext/lookup?name=The%20Lancet
```
返回：
```json
{ "ok": true, "found": true, "journal": { ...badgeObj } }
// 或 { "ok": true, "found": false }
```

**批量查询（一页多条时用这个）**
```
POST /api/ext/lookup
Content-Type: application/json
{ "items": [ { "issn": "0028-0836" }, { "name": "cell" }, { "name": "经济地理" } ] }
```
返回（顺序与 items 对齐，未命中为 null）：
```json
{ "ok": true, "results": [ {badgeObj}, {badgeObj}, {badgeObj}|null ] }
```

**badgeObj 字段**（只含命中的字段，缺省即“无该数据”）：
```jsonc
{
  "name": "LANCET", "cn_name": "系统仿真学报", "issn": "0140-6736", "eissn": "1474-547X",
  "slug": "lancet",                 // 站内详情页: https://journal.ailatest.org/#j/<slug或issn>
  "if_2024": 88.5, "if_quartile": "Q1",
  "cas_zone": 1, "cas_top": true,   // 中科院大类分区 + 是否TOP
  "cas_xr": { "zone": "1", "top": true },   // 中科院新锐2026
  "ccf": "A", "abdc": "A*", "abs": "4*",
  "indices": ["SCIE","SSCI"],       // 收录索引
  "scopus": true, "free": true,     // free=提供免费发表(OA)通道
  "doaj_apc": "no",                 // DOAJ 公开 APC: "no"=免费, 或金额/状态
  "warning": true, "citic_warning": true, "on_hold": true, "under_review": true,
  "cssci": "core",                  // "core" | "ext"
  "pku": true,                      // 北大核心
  "cnkx": [ { "tier": "T1", "domain": "临床医学" } ],   // 中国科协(可多学科)
  "cscd": "核心库",                  // CSCD: "核心库" | "扩展库"
  "ccft": "T1",                     // CCF 中文 T 分区
  "zju": "一级",                    // 浙大目录
  "nsfc_mgmt": "A"                  // NSFC 管理科学部
}
```

**匹配规则**：ISSN 优先（忽略连字符/大小写）；刊名用站内同款 `norm()` + 自动去前导冠词（"The Lancet"=="Lancet"）。命中中文刊（如「经济地理」「系统仿真学报」）会返回其 CSSCI/北大核心/科协/CSCD/浙大 等国内分级。

**徽章渲染参考**：颜色/样式照搬 `css/app.css` 里的 `.zone`(中科院)、`.if-pill`、`.tier-pill`/`.domsrc-pill`(国内)、`.on-hold-pill`(橘红)、`.citic-warning-pill`(灰蓝)、`flagship-pill`。科协徽章显示「科协+学科」最多 3 个 +N（站内 `renderDomCrossBadges` 的逻辑）。

---

## 附录 B：站点 DOM 选择器线索（抓刊名/ISSN 的起点）

> 站点会改版，下面是「从哪找、怎么取」的方向，不是保证不变的死选择器。每个适配器都要做：取到候选元素 → 清洗出干净刊名/ISSN → 定位插入点。实现时务必在真实页面用 DevTools 复核当前结构。

### 知网 CNKI（`*.cnki.net`）
- **检索结果列表**：结果表格每行的「来源」列就是刊名（中文）。一行一个期刊，多无 ISSN → **用刊名匹配**。
- **文献详情页**：标题下方的期刊名链接（点进去是「期刊主页」）即刊名；页面别处常有 ISSN/CN 号。
- **插入点**：刊名链接元素之后。
- **注意**：知网大量异步加载/iframe，必须 `MutationObserver`；刊名可能带书名号《》要去掉再 norm。

### 谷歌学术 Google Scholar（`scholar.google.*` 及镜像）
- **每条结果**：`.gs_ri`；出版信息在 `.gs_a`（形如「作者 - 期刊名, 年份 - 出版商」）。**刊名要从 `.gs_a` 里清洗**：按 ` - ` 分段取中间段，再去掉末尾「, 年份」「卷(期)」等。
- 无 ISSN → 刊名匹配。清洗不干净宁可不标。
- **插入点**：标题 `.gs_rt` 之后，或 `.gs_a` 之后另起一行。

### Web of Science（`*.webofscience.com`）
- **结果列表**：每条记录有「Source / 出版物名称」字段；详情页有明确的 **ISSN/eISSN** → 优先 ISSN。
- 高度 SPA + 动态加载，靠 MutationObserver。

### ScienceDirect（`*.sciencedirect.com`）
- **文章页**：期刊名在页头 publication title；ISSN 在页面元数据/`<meta>`。优先 ISSN。
- **检索结果**：每条结果的期刊名行。

### PubMed（`pubmed.ncbi.nlm.nih.gov`）
- **结果列表**：每条 `.docsum-journal-citation` 里含期刊缩写 + 年份卷期。**注意是缩写刊名**（如「N Engl J Med」），匹配率低 → 优先从详情页拿 **ISSN**；列表页可考虑只在 hover/展开时查。
- **详情页**：有完整期刊名和 ISSN。

### Scopus（`*.scopus.com`）
- 结果/详情页有 Source title 和 ISSN，优先 ISSN。SPA 动态加载。

### 通用建议
- 每个适配器实现 `findEntries()` 时，**ISSN 能拿就拿**（命中率和准确率都最高）；拿不到再退刊名。
- 清洗刊名：去《》、去前后空白、去结尾「, 2024」「Vol. / 卷(期)」、去 ALL CAPS 不用管（后端 norm 会处理大小写和冠词）。
- 一页批量收集后**一次 `POST /ext/lookup`**，别逐条 GET。
