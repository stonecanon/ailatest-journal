# AILatest Journal · Creem 产品（与 Todo 分离）

命名一律带 **Journal**，不与 Todo 产品混用。原价 ≥ $1.99，长期固定折扣后落到网站标价。

## 价格对照

| 套餐 | 原价 | 长期折扣码 | 实付 | 账单周期 |
|---|---:|---|---:|---|
| Pro Monthly | $1.99 | `JNPROM` (−$1.00) | **$0.99** | month |
| Pro Yearly | $11.99 | `JNPROY` (−$4.00) | **$7.99** | year |
| Max Monthly | $2.99 | `JNMAXM` (−$1.50) | **$1.49** | month |
| Max Yearly | $14.99 | `JNMAXY` (−$5.00) | **$9.99** | year |
| Pro EDU Monthly | $1.99 | `JNEPROM` (−$1.30) | **$0.69** | month |
| Pro EDU Yearly | $11.99 | `JNEPROY` (−$7.00) | **$4.99** | year |
| Max EDU Monthly | $2.99 | `JNEMAXM` (−$2.10) | **$0.89** | month |
| Max EDU Yearly | $14.99 | `JNEMAXY` (−$9.00) | **$5.99** | year |
| Pro China 365-day | **$4.99** | — | **$4.99** | one-time / 365 days |
| Max China 365-day | **$5.99** | — | **$5.99** | one-time / 365 days |

折扣 `duration=forever`，仅绑定对应 Journal 产品。

## 教育价门禁

教育 SKU（`*_edu_*`）仅在同时满足时可用：

1. 用户已登录  
2. 账号邮箱域名为机构后缀（与 `entitlements.spec.json` 白名单一致：`.edu.cn` / `.edu` / `.ac.uk` / `.ac.jp` / `.ac.kr` / `.edu.au` / `.edu.sg` / `.edu.hk` / `.edu.mo` / `.edu.tw`）

前端：`pricing-checkout.js` 锁定教育 CTA；普通邮箱点击只提示、不跳收银台。  
API：`POST /checkout/creem` 在 `edu=true` 时返回 `401 login_required` 或 `403 edu_email_required`，不返回公开 EDU 链接。  
Webhook：教育产品若付款邮箱非机构域，**不写权益**（`ignored: edu_email_required`）。

## 产品 ID 与支付链接

成功跳转：`https://journal.ailatest.org/account/?subscription=success`

| Key | Product ID | Checkout（含折扣） |
|---|---|---|
| pro_monthly | `prod_4U7xCv0XuvaQwngA8GzAwk` | https://creem.io/product/prod_4U7xCv0XuvaQwngA8GzAwk?discount_code=JNPROM |
| pro_yearly | `prod_4qPTXwWFki7H97CnEGg0UU` | https://creem.io/product/prod_4qPTXwWFki7H97CnEGg0UU?discount_code=JNPROY |
| max_monthly | `prod_4dQ8oxI13n13UujKijvupS` | https://creem.io/product/prod_4dQ8oxI13n13UujKijvupS?discount_code=JNMAXM |
| max_yearly | `prod_5ndNsgM1cIcItVoNCpQxLK` | https://creem.io/product/prod_5ndNsgM1cIcItVoNCpQxLK?discount_code=JNMAXY |
| pro_edu_monthly | `prod_2UjZDHaflN6qnqyPKsSWzu` | https://creem.io/product/prod_2UjZDHaflN6qnqyPKsSWzu?discount_code=JNEPROM |
| pro_edu_yearly | `prod_2KUfnQxKKFYS2zIRX8bIyD` | https://creem.io/product/prod_2KUfnQxKKFYS2zIRX8bIyD?discount_code=JNEPROY |
| max_edu_monthly | `prod_2Il9sgrjBPMbgCA4eALdCz` | https://creem.io/product/prod_2Il9sgrjBPMbgCA4eALdCz?discount_code=JNEMAXM |
| max_edu_yearly | `prod_1a4d3MaM7X10XbTUP6ixCW` | https://creem.io/product/prod_1a4d3MaM7X10XbTUP6ixCW?discount_code=JNEMAXY |
| pro_cn_365 | `prod_3Mea8BVSYJ5nbVJeYQ3qWN` | https://creem.io/product/prod_3Mea8BVSYJ5nbVJeYQ3qWN |
| max_cn_365 | `prod_2OXrWFSu1RSxeJddAHUxcL` | https://creem.io/product/prod_2OXrWFSu1RSxeJddAHUxcL |

机器可读清单：`docs/creem-journal-products.json`

## 支付方式（支付宝）

Journal 使用 Creem 托管产品链接 / Checkout Session，代码不传固定的支付方式参数。Creem 会按产品类型、买家所在地区、账单地址、金额和设备，在结账页自动展示符合条件的方式；支付宝只在符合 Creem 条件的产品/订单中出现。

中国区已经单独创建一次性 365 天产品（Pro $4.99 / Max $5.99），不与月付/年付 SKU 混用。用户点击普通按钮后进入对应 Creem 产品页，再由 Creem 决定是否显示支付宝；成交仍沿用 product ID + webhook 权益同步流程。

## Worker 环境变量建议

```text
CREEM_PRO_MONTHLY_PRODUCT_ID=prod_4U7xCv0XuvaQwngA8GzAwk
CREEM_PRO_YEARLY_PRODUCT_ID=prod_4qPTXwWFki7H97CnEGg0UU
CREEM_MAX_MONTHLY_PRODUCT_ID=prod_4dQ8oxI13n13UujKijvupS
CREEM_MAX_YEARLY_PRODUCT_ID=prod_5ndNsgM1cIcItVoNCpQxLK
CREEM_PRO_EDU_MONTHLY_PRODUCT_ID=prod_2UjZDHaflN6qnqyPKsSWzu
CREEM_PRO_EDU_YEARLY_PRODUCT_ID=prod_2KUfnQxKKFYS2zIRX8bIyD
CREEM_MAX_EDU_MONTHLY_PRODUCT_ID=prod_2Il9sgrjBPMbgCA4eALdCz
CREEM_MAX_EDU_YEARLY_PRODUCT_ID=prod_1a4d3MaM7X10XbTUP6ixCW
CREEM_PRO_CN_365_PRODUCT_ID=prod_3Mea8BVSYJ5nbVJeYQ3qWN
CREEM_MAX_CN_365_PRODUCT_ID=prod_2OXrWFSu1RSxeJddAHUxcL
CREEM_WEBHOOK_SECRET=<from Creem dashboard>
```

API Key 只放在服务器密钥 / Wrangler secret，**不要写入仓库**。

## Webhook

- URL：`https://api.ailatest.org/webhooks/creem`
- 签名头：`creem-signature`（HMAC-SHA256）
- 建议订阅事件：`checkout.completed`、`subscription.paid`、`subscription.active`、`subscription.trialing`、`subscription.scheduled_cancel`、`subscription.canceled`、`subscription.expired`、`subscription.paused`、`refund.created`、`dispute.created`
- 写权益：Journal 产品 ID → `user_entitlements.tier`（plus=Pro / pro=Max）+ `paid_until` + 当月 credits
- 非 Journal 产品 ID（如 Todo）直接忽略

```bash
cd worker
npx wrangler secret put CREEM_API_KEY
npx wrangler secret put CREEM_WEBHOOK_SECRET
```
---

## Grant 产品

Grant 使用**独立** Creem SKU（`app: grant`），见 Grant 仓库 `docs/CREEM_PRODUCTS.md`。
Worker 通过 `CREEM_GRANT_*_PRODUCT_ID` 识别；Webhook 写入 `product_memberships`（product=`grant`），不写 Journal `user_entitlements`。
