const BILLING_API = 'https://api.cloudflare.com/client/v4/accounts';

function accountId(env) {
  return String(env.CF_ACCOUNT_ID || 'e7dbf2ec3ab60aa5557cc2364a7a2f26').trim();
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function rowText(row) {
  return [
    row.ServiceName, row.serviceName, row.ServiceFamilyName, row.serviceFamilyName,
    row.ConsumedUnit, row.consumedUnit, row.PricingUnit, row.pricingUnit,
  ].filter(Boolean).join(' ').toLowerCase();
}

function normalizeRow(row) {
  return {
    service: row.ServiceName || row.serviceName || '',
    family: row.ServiceFamilyName || row.serviceFamilyName || '',
    consumedQuantity: asNumber(row.ConsumedQuantity ?? row.consumedQuantity),
    consumedUnit: row.ConsumedUnit || row.consumedUnit || '',
    pricingQuantity: asNumber(row.PricingQuantity ?? row.pricingQuantity),
    pricingUnit: row.PricingUnit || row.pricingUnit || '',
    contractedCost: asNumber(row.ContractedCost ?? row.contractedCost),
    cumulatedContractedCost: asNumber(row.CumulatedContractedCost ?? row.cumulatedContractedCost),
    currency: row.BillingCurrency || row.billingCurrency || '',
    periodStart: row.PeriodStart || row.periodStart || row.StartDate || row.startDate || '',
    periodEnd: row.PeriodEnd || row.periodEnd || row.EndDate || row.endDate || '',
    raw: row,
  };
}

function currentPeriod() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export async function fetchBillableUsage(env, options = {}) {
  const token = String(env.CF_BILLING_TOKEN || '').trim();
  if (!token) return { ok: false, configured: false, error: 'CF_BILLING_TOKEN is not configured' };
  const period = currentPeriod();
  const from = String(options.from || period.from).slice(0, 10);
  const to = String(options.to || period.to).slice(0, 10);
  const url = `${BILLING_API}/${encodeURIComponent(accountId(env))}/billable-usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const message = payload?.errors?.map((x) => x.message).join('; ') || `Cloudflare API ${response.status}`;
      return { ok: false, configured: true, status: response.status, error: message, from, to };
    }
    const rawRows = Array.isArray(payload.result) ? payload.result : (payload.result?.data || []);
    const rows = rawRows.map(normalizeRow);
    const d1 = rows.filter((row) => /(^|[^a-z])d1([^a-z]|$)|database|row/.test(rowText(row)) && /d1|database/.test(rowText(row)));
    const currency = rows.find((row) => row.currency)?.currency || 'USD';
    const totalCost = rows.reduce((sum, row) => sum + row.contractedCost, 0);
    const d1Cost = d1.reduce((sum, row) => sum + row.contractedCost, 0);
    return {
      ok: true,
      configured: true,
      source: 'Cloudflare Billable Usage API',
      updatedAt: new Date().toISOString(),
      usageUpdatedDaily: true,
      accountId: accountId(env),
      from,
      to,
      currency,
      totalCost,
      d1Cost,
      rows,
      d1,
    };
  } catch (error) {
    return { ok: false, configured: true, error: error?.name === 'AbortError' ? 'Cloudflare API timeout' : String(error?.message || error), from, to };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendBillingUsageWarnings(env) {
  const usage = await fetchBillableUsage(env);
  if (!usage.ok || !usage.d1.length) return usage;
  const kv = env.WRITE_GUARD_KV || env.AILATEST_WRITE_GUARD;
  if (!kv || !env.RESEND_API_KEY) return usage;
  const rows = usage.d1;
  const quantity = rows.reduce((sum, row) => sum + Math.max(row.pricingQuantity, row.consumedQuantity), 0);
  const included = Number(env.D1_INCLUDED_MONTHLY_ROWS || 50000000);
  const ratio = included > 0 ? quantity / included : 0;
  const level = ratio >= 1 ? 100 : ratio >= 0.9 ? 90 : ratio >= 0.7 ? 70 : 0;
  if (!level) return { ...usage, quantity, included, ratio, warningLevel: 0 };
  const day = new Date().toISOString().slice(0, 10);
  const key = `alert:billing:${day}:${level}`;
  if (await kv.get(key).catch(() => null)) return { ...usage, quantity, included, ratio, warningLevel: level };
  await kv.put(key, '1', { expirationTtl: 3 * 86400 }).catch(() => {});
  const paused = level >= 100;
  if (paused) await kv.put('paused:auto', JSON.stringify({ source: 'cloudflare-billable-usage', at: Date.now(), quantity, included, ratio }), { expirationTtl: 86400 }).catch(() => {});
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'noreply@ailatest.org',
      to: [env.D1_GUARD_NOTIFY_EMAIL || 'wengjt@hzcu.edu.cn'],
      subject: `[AILatest] Cloudflare D1 用量达到 ${level}%${paused ? '，已切换只读' : '预警'}`,
      text: `Cloudflare Billable Usage API（每日更新）\nD1 计费量：${quantity}\n月度保护线：${included}\n比例：${(ratio * 100).toFixed(1)}%\n账期：${usage.from} 至 ${usage.to}\n${paused ? '已自动暂停写入，当前仅提供读取功能。' : '请及时检查管理后台。'}`,
    }),
  }).catch(() => {});
  return { ...usage, quantity, included, ratio, warningLevel: level, paused };
}
