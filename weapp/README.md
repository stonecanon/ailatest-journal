# 分区速查微信小程序

原生微信小程序 MVP，不使用网页嵌入组件。当前风格沿用网站的暖白学术橙：米白纸张背景、浅网格、黑色标题、橙色搜索按钮、期刊指标卡片。

## 页面

```text
weapp/
├── app.json
├── app.wxss
└── pages/
    ├── index/     # 首页：查刊、荐刊、筛选、期刊列表
    ├── detail/    # 详情：索引、分区、IF、期刊概览、基本信息
    ├── rankings/  # 榜单入口
    └── favorites/ # 收藏夹
```

## 云开发接入

当前小程序以微信云开发为主，不走外部 API。页面调用：

```text
wx.cloud.callFunction('searchJournals')
wx.cloud.callFunction('getJournalDetail')
wx.cloud.callFunction('getRanking')
```

云数据库集合：

```text
journal_search_index
journals
rankings
folders
folder_items
```

生成导入数据：

```bash
node scripts/build_weapp_cloudbase_data.js
```

会在 `weapp/cloudbase_import/` 生成 `journal_search_index.jsonl`、`journals.jsonl` 和 `rankings.jsonl`。

## 静态数据兜底

仓库保留了 `weapp/utils/localData.js` 和 `scripts/build_weapp_static_data.js`，只作为云函数不可用时的开发兜底，不作为主方案。

## 导入项目

1. 打开微信开发者工具。
2. 导入 `weapp/` 目录。
3. 将 `project.config.json` 里的 `appid` 替换成真实 AppID。
4. 开通云开发环境。
5. 上传并部署 `cloudfunctions/` 里的 3 个云函数。
6. 导入 `weapp/cloudbase_import/` 里的 3 个集合数据后编译预览。
