# Cloudflare D1 费用豁免申请（含完整审计数据）

> **随附审计附件**：`d1-write-audit.html`（折线图 + 每日写入明细表，共 69 天数据）。提交工单时请一并上传该附件，或打开后截图/转 PDF。
>
> 参考 littlebearapps 的 D1 账单灾难经验：**豁免成功的第一要素是附上完整审计文档**（每日写入数据 + 根因 + 已部署修复），而不是简单说"请免除"。
>
> 提交渠道：Cloudflare Dashboard → Support 提交工单（Billing/D1）；若无响应，社区论坛找 MVP → 直接邮件账单主管升级。

---

## 一、审计摘要（一页看懂）

- **账户**：`e7dbf2ec3ab60aa5557cc2364a7a2f26`（Workers Paid，$5/月）
- **数据库**：`ailatest-journal`（uuid `861dd053-c23a-4363-b62b-2559c06ec3fd`）
- **涉及费用**：D1 "Rows Written" 约 **$110（预估）**——已出账 $96（8-13 ~ 8-19）+ 今天 8-20 预估 ~$14（修复于当天 16:32 生效，此前仍在写入，当日账单尚未结算）
- **性质**：代码缺陷导致的**非预期持续写入**，非业务流量、非恶意滥用
- **状态**：已于 2026-08-20 发现当天**全部修复并部署**，写入已归零
- **关键背景**：2026-08-10 才升级到 Workers Paid（发票 IN-74672161）。此前为 Free 计划，D1 超限写入会被直接拒绝、**不产生费用**——所以该缺陷虽自 6 月就已存在，却从未在账单上显现；升级 Paid 后 D1 计费生效，费用才开始累积（8-13 起）。

## 二、根因（三层叠加的代码缺陷）

1. **定时任务频率过高**：Worker 的 cron 配了 `*/15 * * * *`（每 15 分钟跑一次）。
2. **回扫窗口过大**：每次执行都会扫描**最近 90 天**的全部事件数据做"流量分类"。
3. **UPDATE 无去重过滤**：分类的 `UPDATE` 语句只有时间范围条件、没有"只处理未分类行"的过滤，导致已分类的历史行也被反复写回。而 D1 的计费规则是"执行了 UPDATE 就按行计费，即使值未变化"。

三者叠加 → 每天约 1400 万行写入。

## 三、每日写入审计数据（GraphQL 查询确凿）

| 时间段 | 每天写入量 | 说明 |
|---|---|---|
| 06-13 | 245 万 | 流量分类代码上线当天 |
| 06-14~15 | 150~165 万 | |
| 06-16~20 | 几千~1.5 万 | 低谷 |
| 06-21 起 | 485 万 → 870 万 | 持续增长 |
| 07 月 | 800~990 万/天 | 稳定 |
| 08 月 | 1000~2200 万/天 | 90 天回扫基数增大 |

## 四、已部署的修复清单（2026-08-20 当天全部完成）

1. ✅ 停用高频 cron `*/15 * * * *`，仅保留每天一次的 `12 16 * * *`
2. ✅ 回扫窗口从 `days: 90` 改为 `days: 1`
3. ✅ 兜底 UPDATE 增加 `AND (COALESCE(traffic_type,'')='' OR COALESCE(visitor_hash,'')='')` 过滤，只更新未处理行

**修复后**：写入从每天 ~1400 万行 → 接近 0。

---

## 五、英文正文（直接提交）

**Subject:** One-time courtesy credit request — D1 "Rows Written" overage caused by a code defect (root-caused & fixed same day)

Hi Cloudflare Support,

Our account (`e7dbf2ec3ab60aa5557cc2364a7a2f26`, Workers Paid) received an unexpected ~$110 charge (estimated) for D1 "Rows Written" in the current billing cycle (starting 2026-08-10): ~$96 already billed, plus ~$14 projected for today (2026-08-20, the day we applied the fix) which has not settled yet — on the database `ailatest-journal`.

**Root cause:** a scheduled Worker job ran every 15 minutes and re-scanned / re-wrote the `traffic_type` field of **all** event rows from the previous 90 days. Because D1 counts an `UPDATE` as a row written even when the value is unchanged, this produced ~14 million rows written per day. This was a coding defect in our traffic-classification logic — not legitimate traffic and not abuse.

**Evidence:** full daily write counts are attached (via GraphQL `d1AnalyticsAdaptiveGroups`), showing the pattern from 2026-06-13 through 2026-08-20.

**Already fixed on 2026-08-20 (same day we found it):**
1. Removed the high-frequency cron trigger (`*/15 * * * *`), keeping only a once-daily `12 16 * * *`.
2. Narrowed the classification window from 90 days to 1 day.
3. Added a filter so the UPDATE only touches unclassified rows.

Writes have dropped from ~14M/day to near zero.

**Why this only surfaced now:** we upgraded to Workers Paid on 2026-08-10 (invoice IN-74672161). Before that, on the Free plan, D1 writes over the daily limit were simply rejected and never billed — so this defect, though present since June, never showed up on a bill. The moment we upgraded, D1 metering kicked in and the charges started accumulating. We caught and fixed it within 10 days of the upgrade.

Given this was an unintended, one-time code defect (not an intentional usage pattern), could you please issue a one-time courtesy credit or waive this ~$110 charge? We would really appreciate it.

Thank you,
AILatest Team

---

## 六、如果工单几天无响应，按作者的经验升级

1. **Cloudflare 社区论坛**发帖求助，找 MVP（作者是靠社区 MVP 拿到账单主管直接邮箱的）。
2. **直接邮件账单负责人**（作者案例中是 Dmitry Alexeenko, Head of Billing）。
3. 必要时 **Reddit r/CloudFlare** 公开说明"工单被搁置但账单系统还在催缴"（作者靠这一步最终让客户支持总监 Akash Das 接手）。

> 关键心态（作者原话）："如果你要请求一家公司免除费用，你应该做好准备。"——我们已经把数据、根因、修复清单都备齐了，这是最强的一步。
