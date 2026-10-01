# Android / Google Play 上架与会员同步

## 方案

Android 是 Kotlin + Jetpack Compose 原生客户端，不是整站 WebView。数据走
`https://api.ailatest.org`，因此与网站共用搜索、期刊详情、荐刊、登录、收藏和
`user_entitlements`。

海外 Android 用户在 App 内购买数字会员时使用 Google Play Billing。网页仍可继续
使用 Creem；两边只要登录同一账号，服务端都会把权益写入同一个账号快照。

内部权益映射保持现有实现：

| 用户看到 | Play product | base plan | 服务端 tier |
|---|---|---|---|
| Pro | `ailatest_pro` | `monthly` / `yearly` | `plus` |
| Max | `ailatest_max` | `monthly` / `yearly` | `pro` |

App 使用 Play 返回的本地化价格；不要在 App 内把 Creem 链接作为数字会员购买入口。

## Play Console 配置

1. 创建应用，包名必须是 `org.ailatest.journal`。
2. 创建两个订阅：`ailatest_pro`、`ailatest_max`。
3. 为每个订阅创建 `monthly` 和 `yearly` base plan，价格、税务和地区按 Play Console 配置。
4. 先用 license tester 和 internal testing track 测试购买、恢复、取消、续费、退款、
   grace period 和 pending purchase。
5. 创建 Google Cloud service account，并在 Play Console 的 Users and permissions
   中授予它读取订单/订阅及管理订阅的权限。把完整 JSON 作为 Worker secret：

   ```bash
   wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
   ```

6. 设置 `GOOGLE_PLAY_RTDN_TOKEN`，创建 Pub/Sub push subscription 指向：

   ```text
   https://api.ailatest.org/webhooks/google-play?token=<GOOGLE_PLAY_RTDN_TOKEN>
   ```

   如果你的 Pub/Sub push 配置支持自定义 Authorization/OIDC，也可以携带
   `Authorization: Bearer <GOOGLE_PLAY_RTDN_TOKEN>`（或
   `X-Google-Play-Token`）。RTDN 会通过已保存的 purchase-token hash 找回账号，
   再从 Google 拉取最新状态；token 变更时同步更新 push endpoint 并轮换 Worker secret。

## 服务器流程

```text
Play Billing
    │ purchase token
    ▼
Android → /play/purchases/verify → Google Play Developer API
                                  │ verify + acknowledge
                                  ▼
                           user_entitlements
                                  │
                       website / Android / API
```

`POST /play/purchases/verify` 只接受登录 JWT；服务端校验包名、产品 ID、purchase token
和 Google 返回的订阅状态。只有 `PURCHASED` 对应的有效状态才授予权益，pending 不授予。
renew/cancel/grace/expiry 由 RTDN 刷新；App 每次启动和回到前台也会调用 restore purchases
并重新验单。

## 上架前检查

- [ ] Worker 已配置 service account secret，且 Cloudflare 日志中没有验单错误。
- [ ] Play product/base plan 已激活，应用签名和 package name 与 Play Console 一致。
- [ ] 测试同一邮箱账号在网站 Creem 购买后在 App 登录，或反向购买后网页刷新权益。
- [ ] 测试 Google Play 购买、取消、恢复、续费、退款和 pending purchase。
- [ ] Play Console Data safety、隐私政策、退款/订阅条款和客服邮箱已填写。
- [ ] App 内展示的价格来自 Play Billing；订阅管理跳转到 Google Play。
- [ ] 生产 release 使用 Play App Signing，并上传 AAB 而不是 APK。
