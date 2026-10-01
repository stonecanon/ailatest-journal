#!/usr/bin/env node
/**
 * 批量创建 Grant 国际价 Creem 商品 + 长期折扣码（2026-08-08）。
 * 套路与国内品一致：Creem 标价 = 划线原价(was)，固定折扣(duration=forever)落到实付价(pay)。
 * 用法：node scripts/create-grant-intl-products.mjs <CREEM_API_KEY> [--dry-run]
 * 成功后将 product_id 填回 worker/src/creem.js GRANT_CREEM_PRODUCTS_INTL 与 wrangler.toml。
 */
const CREEM_API = 'https://api.creem.io';

const SKUS = [
  // key, 名称, 原价(分), 折扣(分), 实付(分), 周期, edu
  ['pro_intl_monthly',     'AILatest Grant Pro International Monthly',     899, 300,  599, 'every-month', false],
  ['pro_intl_yearly',      'AILatest Grant Pro International Yearly',     7199, 2400, 4799, 'every-year',  false],
  ['max_intl_monthly',     'AILatest Grant Max International Monthly',    1499, 500,  999,  'every-month', false],
  ['max_intl_yearly',      'AILatest Grant Max International Yearly',    14399, 4800, 9599, 'every-year',  false],
  ['pro_intl_edu_monthly', 'AILatest Grant Pro International EDU Monthly', 899, 500,  399,  'every-month', true],
  ['pro_intl_edu_yearly',  'AILatest Grant Pro International EDU Yearly', 7199, 4200, 2999, 'every-year',  true],
  ['max_intl_edu_monthly', 'AILatest Grant Max International EDU Monthly',1499, 800,  699,  'every-month', true],
  ['max_intl_edu_yearly',  'AILatest Grant Max International EDU Yearly',14399, 8400, 5999, 'every-year',  true],
];

const DISCOUNT_CODES = {
  pro_intl_monthly: 'GRIPROM', pro_intl_yearly: 'GRIPROY',
  max_intl_monthly: 'GRIMAXM', max_intl_yearly: 'GRIMAXY',
  pro_intl_edu_monthly: 'GRIEPROM', pro_intl_edu_yearly: 'GRIEPROY',
  max_intl_edu_monthly: 'GRIEMAXM', max_intl_edu_yearly: 'GRIEMAXY',
};

const SUCCESS_URL = 'https://grant.ailatest.org/?subscription=success';

async function call(path, apiKey, body) {
  const resp = await fetch(`${CREEM_API}${path}`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`${path} → HTTP ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function main() {
  const apiKey = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!apiKey) {
    console.error('用法: node create-grant-intl-products.mjs <CREEM_API_KEY> [--dry-run]');
    process.exit(1);
  }
  const results = [];
  for (const [key, name, listPrice, discountAmt, payPrice, period, edu] of SKUS) {
    if (dryRun) {
      console.log(`[dry-run] ${key}: 建品 ${name} 标价$${(listPrice / 100).toFixed(2)} + 折扣码 ${DISCOUNT_CODES[key]} (-$${(discountAmt / 100).toFixed(2)}) → 实付 $${(payPrice / 100).toFixed(2)}`);
      continue;
    }
    // 1) 建产品（Creem 标价 = 划线原价）
    const product = await call('/v1/products', apiKey, {
      name,
      description: 'AILatest Grant international plan (recurring)',
      price: listPrice,
      currency: 'USD',
      billing_type: 'recurring',
      billing_period: period,
      tax_mode: 'exclusive',
      tax_category: 'saas',
      default_success_url: SUCCESS_URL,
      abandoned_cart_recovery_enabled: true,
    });
    const productId = product.id;
    // 2) 建固定金额折扣（forever），绑定到该商品
    let discountId = '';
    try {
      const disc = await call('/v1/discounts', apiKey, {
        name: `${DISCOUNT_CODES[key]} (${key})`,
        code: DISCOUNT_CODES[key],
        type: 'fixed',
        amount: discountAmt,
        currency: 'USD',
        duration: 'forever',
        applies_to_products: [productId],
      });
      discountId = disc.id || '';
    } catch (e) {
      console.warn(`  ⚠ ${key} 折扣码创建失败（可能已存在）: ${e.message}`);
    }
    results.push({ key, product_id: productId, discount_id: discountId, name });
    console.log(`✅ ${key}: prod_${productId}  (${name}, 标价$${(listPrice / 100).toFixed(2)}, 实付$${(payPrice / 100).toFixed(2)}, 折扣 ${discountId ? 'OK' : '跳过'})`);
  }
  console.log('\n=== 填回代码的 product_id 映射 ===');
  for (const r of results) {
    console.log(`${r.key}: prod_${r.product_id}`);
  }
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
