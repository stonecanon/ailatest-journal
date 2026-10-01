Cloudflare 工单粘贴文本（纯文本，直接复制）
================================================

【工单标题】
Request for courtesy credit on unexpected D1 "Rows Written" charge

【Describe your issue or request 正文】

We received an unexpected ~$110 charge (estimated) for D1 "Rows Written" in the current billing cycle (starting 2026-08-10): about $96 already billed, plus about $14 projected for today (2026-08-20, the day we applied the fix) which has not settled yet, on the database ailatest-journal.

Root cause: one of our Workers' scheduled tasks ran every 15 minutes and re-scanned and re-wrote the traffic_type field of all event rows from the previous 90 days. Because D1 counts an UPDATE as a row written even when the value is unchanged, this produced about 14 million rows written per day. This is a coding defect in our traffic-classification logic, not legitimate traffic and not abuse.

Frequency: every 15 minutes, from about 2026-06-13 through 2026-08-20.

Why this only surfaced now: we upgraded to Workers Paid on 2026-08-10 (invoice IN-74672161). Before that, on the Free plan, D1 writes over the daily limit were simply rejected and never billed, so this defect, though present since June, never appeared on a bill. The moment we upgraded, D1 metering kicked in and the charges started accumulating.

Already fixed on 2026-08-20 (same day we found it):
1. Removed the high-frequency cron trigger, keeping only a once-daily schedule.
2. Narrowed the classification window from 90 days to 1 day.
3. Added a filter so the UPDATE only touches unclassified rows.

Writes have dropped from about 14M per day to near zero. A full daily write-count audit (69 days) is attached as a PDF.

Given this was an unintended, one-time code defect and not an intentional usage pattern, could you please issue a one-time courtesy credit or waive this ~$110 charge? We would really appreciate it.

【How is this impacting your business】

We are a small indie team on the $5/month Workers Paid plan. This ~$110 charge is roughly 20x our monthly plan cost and was caused entirely by an unintentional code defect rather than real business usage. We found and fixed it the same day we noticed it, and it will not recur.

【提交备忘】
- 附件：上传 d1-write-audit-en.pdf
- Zone：选 journal.ailatest.org（或留空）
- 其余字段可留空
