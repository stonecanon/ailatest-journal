# 分区速查微信小程序

原生微信小程序，**纯本地数据方案**：零网络、零后端、零 ICP 备案依赖。
数据以 16 个分包（`static-data-0` ~ `static-data-15`）随包下发，全程 `getFileSystemManager` 同步读取 gzip 内嵌数据 + `fflate` 解压。

## 架构

```text
weapp/
├── app.json                 # 主包页面 + 16 个分包声明
├── app.js                   # 分包占位页解锁回调 __localDataSubpackageWaiters
├── project.config.json      # packOptions.ignore（不排除 static-data-N）
├── utils/localData.js       # 加载器：分包按需加载 / 列式还原 / 搜索 / 详情路由
├── vendor/fflate.js         # gunzipSync + strFromU8
├── pages/                   # 主包页面
│   ├── index/               # 首页：查刊、荐刊、筛选
│   ├── detail/              # 详情：IF / 分区 / 概览 / 基本信息
│   ├── rankings/ ranklist/  # 榜单
│   ├── filter/              # 高级筛选
│   ├── favorites/ folder/   # 收藏
│   └── profile/
└── static-data-0 ~ 15/      # 16 个数据分包（每个含占位页）
    └── pages/data-placeholder/   # 分包注入占位页（触发 onLoad 回调）
```

## 数据分包布局

| 分包 | 内容 | 体积 |
|---|---|---|
| `static-data-0` | `manifest.bin` + `detail-index-<bucket>.bin`（28 个 slug→路径索引） | ~0.5 MB |
| `static-data-1~4` | `search-0.bin` ~ `search-3.bin`（列式 `{fields, rows}`，共 61,303 行） | 各 ~1.5 MB |
| `static-data-5~15` | `details/<bucket>-<n>.bin`（详情对象数组，100 字段） | 各 ≤1.8 MB |

**加载策略**：启动只加载 `data0`（清单）+ `data1~4`（搜索分片），约 5.6 MB；
详情分包 `data5~15` 在用户进入详情页时按需 `wx.loadSubpackage` 拉取。

## 数据格式（已逆向）

```text
search-N.bin        { "fields": [50个字段名], "rows": [[值...], ...] }   # 列式
detail-index-X.bin  { "slug": "static-data-N/details/x-M.bin" }         # 扁平映射
details/x-M.bin     [ { 完整详情对象(~100字段) }, ... ]                  # 靠 slug 匹配
manifest.bin        { version, total, searchChunks, detailIndexes, detailBuckets, packages }
```

全部文件为 gzip 压缩（魔数 `1f8b`）。

## 导入项目

1. 打开微信开发者工具，导入 `weapp/` 目录。
2. 确认 `project.config.json` 的 `appid` 为真实 AppID（当前 `wxb509a63a349db5b0`）。
3. 编译预览即可，**无需开通云开发、无需配置合法域名**。

## 分包体积红线

- 单个分包 / 主包 ≤ **2 MB**
- 所有分包合计 ≤ **30 MB**（服务商代开发 ≤ 20 MB）

当前 16 包合计约 **23.5 MB**，单包最大 1.8 MB，均在红线内。
