# AILatest Journal 微信小程序

基于 WebView 包装的微信小程序，直接加载 [journal.ailatest.org](https://journal.ailatest.org/)。

## 开发准备

### 1. 注册小程序账号
- 前往 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册个人开发者账号
- 年费 **30 元/年**
- 获取 **AppID**（在开发 → 开发设置中查看）

### 2. 安装微信开发者工具
- 下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
- macOS 选稳定版（Stable Build）

### 3. 配置域名白名单
在微信公众平台 → 开发 → 开发管理 → 服务器域名：
- `request` 白名单添加：`https://journal.ailatest.org`
- `web-view` 业务域名添加：`https://journal.ailatest.org`

> ⚠️ 如果使用 web-view 组件，必须在「业务域名」中添加 journal.ailatest.org

### 4. 导入项目
1. 打开微信开发者工具
2. 项目 → 导入项目
3. 目录选择 `weapp/` 文件夹
4. 填入 AppID（project.config.json 中也要改）
5. 点击导入

### 5. 本地预览
- 编译后即可在模拟器/真机预览
- web-view 需要真机调试才能完整显示

## 项目结构

```
weapp/
├── project.config.json    # 项目配置（需填入 AppID）
├── app.json               # 全局配置
├── app.js                 # 生命周期
├── app.wxss               # 全局样式
├── sitemap.json           # 搜索索引
└── pages/
    └── index/
        ├── index.wxml     # 主页面（web-view）
        ├── index.js       # 页面逻辑（加载/错误处理/分享）
        ├── index.wxss     # 页面样式
        └── index.json     # 页面配置
```

## 重要注意事项

### 分享
- 当前支持分享给 **好友/群**
- **不支持分享到朋友圈**（原生 Page 分享才支持朋友圈，web-view 页面无法实现）
- 如果需要朋友圈分享，需要额外做一个原生落地页

### 小程序审核提醒
- 类目选「工具 > 信息查询」或「教育 > 教育信息服务」
- 数据来源在网站底部已有标注（Web of Science / Scopus / CAS / 中科院等），审核时如果有疑问可以提供
- 名称避免「刊」字可能更安全

### 更新
- 网站更新后，小程序自动加载最新内容（无需发版）
- 如果修改了小程序代码（如配置文件），需要重新提交审核
