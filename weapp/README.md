# 分区速查微信小程序

原生微信小程序 MVP，不使用网页嵌入组件。当前风格沿用网站的暖白学术橙：米白纸张背景、浅网格、黑色标题、橙色搜索按钮、期刊指标卡片。

## 页面

```text
weapp/
├── app.json
├── app.wxss
└── pages/
    ├── index/   # 首页：搜索、热门词、快捷筛选、期刊列表
    └── detail/  # 详情：索引、分区、IF、期刊概览、基本信息
```

## 数据接入

页面会优先请求：

```text
GET https://api.ailatest.org/journals/search
GET https://api.ailatest.org/journals/:slug
```

当前 API 未就绪时会自动使用内置示例数据，方便先在微信开发者工具里确认视觉、布局和交互骨架。

## 小程序后台配置

在小程序后台添加 request 合法域名：

```text
https://api.ailatest.org
```

不需要配置业务域名。

## 导入项目

1. 打开微信开发者工具。
2. 导入 `weapp/` 目录。
3. 将 `project.config.json` 里的 `appid` 替换成真实 AppID。
4. 编译预览。
