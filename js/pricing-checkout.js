/**
 * 定价 / 结账：英文界面保留月付·年付；中文界面使用一次性 365 天方案。
 * 首页 #pricing 与 /pricing 订阅页共用，支付模式跟随当前 UI 语言。
 */
(() => {
  const FALLBACK = {
    pro_year: 'https://creem.io/product/prod_4qPTXwWFki7H97CnEGg0UU?discount_code=JNPROY',
    pro_month: 'https://creem.io/product/prod_4U7xCv0XuvaQwngA8GzAwk?discount_code=JNPROM',
    pro_year_edu: 'https://creem.io/product/prod_2KUfnQxKKFYS2zIRX8bIyD?discount_code=JNEPROY',
    pro_month_edu: 'https://creem.io/product/prod_2UjZDHaflN6qnqyPKsSWzu?discount_code=JNEPROM',
    max_year: 'https://creem.io/product/prod_5ndNsgM1cIcItVoNCpQxLK?discount_code=JNMAXY',
    max_month: 'https://creem.io/product/prod_4dQ8oxI13n13UujKijvupS?discount_code=JNMAXM',
    max_year_edu: 'https://creem.io/product/prod_1a4d3MaM7X10XbTUP6ixCW?discount_code=JNEMAXY',
    max_month_edu: 'https://creem.io/product/prod_2Il9sgrjBPMbgCA4eALdCz?discount_code=JNEMAXM',
  };
  // 中国区一次性 365 天产品的直达链接；登录用户优先走 Worker Checkout
  // Session，未登录/本地预览时使用此产品页。
  const CN_FALLBACK = {
    pro: 'https://creem.io/product/prod_3Mea8BVSYJ5nbVJeYQ3qWN',
    max: 'https://creem.io/product/prod_2OXrWFSu1RSxeJddAHUxcL',
  };

  const EDU_DOMAIN_SUFFIXES = [
    '.edu.cn', '.edu', '.ac.uk', '.ac.jp', '.ac.kr',
    '.edu.au', '.edu.sg', '.edu.hk', '.edu.mo', '.edu.tw',
  ];

  /** 售价 / 原价（划线） */
  const PLAN_PRICES = {
    pro: {
      year: { pay: '$7.99', was: '$11.99' },
      month: { pay: '$0.99', was: '$1.99' },
    },
    max: {
      year: { pay: '$9.99', was: '$14.99' },
      month: { pay: '$1.49', was: '$2.99' },
    },
  };
  const CN_PRICES = {
    pro: { pay: '$4.99' },
    max: { pay: '$5.99' },
  };
  const EDU_PRICES = {
    pro: { year: '$4.99', month: '$0.69' },
    max: { year: '$5.99', month: '$0.89' },
  };

  const BILLING_KEY = 'ailatest.billing.cycle';
  const API_BASE = (window.AILATEST_API_BASE
    || (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:8787'
      : 'https://api.ailatest.org'));

  function normalizeLangCode(code) {
    return String(code || '').trim().toLowerCase().replace(/_/g, '-');
  }

  function currentUiLang() {
    // 优先：SPA 实时语言 → 页面 data 属性 → localStorage → html lang
    const candidates = [];
    try {
      if (typeof window.__getJournalUiLang === 'function') {
        const live = window.__getJournalUiLang();
        if (live) candidates.push(live);
      }
    } catch (_) {}
    try {
      if (window.__journalUiLang) candidates.push(window.__journalUiLang);
    } catch (_) {}
    candidates.push(
      document.documentElement.getAttribute('data-ui-lang'),
      document.documentElement.getAttribute('data-static-lang'),
      document.documentElement.lang
    );
    try {
      const stored = localStorage.getItem('ailatest.lang');
      if (stored) candidates.push(stored);
    } catch (_) {}
    for (const c of candidates) {
      const n = normalizeLangCode(c);
      if (n) return n;
    }
    return '';
  }

  /** 中文界面用中文文案并进入中国区；其它语言统一使用英文国际方案 */
  function isZh() {
    const raw = currentUiLang();
    if (raw === 'zh' || raw.startsWith('zh-') || raw.startsWith('zh')) return true;
    // 静态订阅页默认 lang=zh-CN，且无明确英文信号时按中文
    const html = normalizeLangCode(document.documentElement.lang);
    if ((html === 'zh' || html.startsWith('zh')) && !(raw === 'en' || raw.startsWith('en-'))) return true;
    return false;
  }

  function normalizeMarket(value) {
    return String(value || '').trim().toLowerCase() === 'cn' ? 'cn' : 'intl';
  }

  function getMarket() {
    return isZh() ? 'cn' : 'intl';
  }

  function syncMarketUi() {
    const market = getMarket();
    document.body?.setAttribute('data-market', market);
    if (market === 'cn') document.body?.setAttribute('data-billing', 'year');

    document.querySelectorAll('[data-market-panel]').forEach((el) => {
      const panelMarket = normalizeMarket(el.getAttribute('data-market-panel'));
      el.hidden = panelMarket !== market;
    });
    document.querySelectorAll('[data-market-intl-only]').forEach((el) => {
      el.hidden = market !== 'intl';
    });
    document.querySelectorAll('[data-creem-checkout][data-edu="1"], [data-creem-checkout][data-edu="true"]').forEach((el) => {
      el.hidden = market === 'cn';
    });
  }

  function L(zh, en) {
    return isZh() ? zh : en;
  }

  function readUser() {
    try {
      return JSON.parse(localStorage.getItem('ailatest.user') || 'null');
    } catch (_) {
      return null;
    }
  }

  function isEduEmail(email) {
    const m = String(email || '').trim().toLowerCase().match(/^[^@\s]+@([^@\s]+)$/);
    if (!m) return false;
    const domain = m[1];
    return EDU_DOMAIN_SUFFIXES.some((suf) => domain === suf.slice(1) || domain.endsWith(suf));
  }

  function eduEligibility() {
    const user = readUser();
    const token = user && user.token;
    if (!token) {
      return { ok: false, reason: 'login', user: null, email: '' };
    }
    const email = String(user.email || user.user?.email || '').trim();
    if (!isEduEmail(email)) {
      return { ok: false, reason: 'not_edu', user, email };
    }
    return { ok: true, reason: 'ok', user, email };
  }

  function fallbackKey(plan, period, edu) {
    const p = plan === 'max' ? 'max' : 'pro';
    const y = period === 'month' || period === 'monthly' ? 'month' : 'year';
    return edu ? `${p}_${y}_edu` : `${p}_${y}`;
  }

  function openUrl(url) {
    if (!url) return;
    location.href = url;
  }

  function getBillingCycle() {
    const body = document.body?.getAttribute('data-billing');
    if (body === 'month' || body === 'year') return body;
    try {
      const s = localStorage.getItem(BILLING_KEY);
      if (s === 'month' || s === 'year') return s;
    } catch (_) {}
    return 'year';
  }

  function setBillingCycle(cycle) {
    const c = cycle === 'month' ? 'month' : 'year';
    document.body?.setAttribute('data-billing', c);
    try { localStorage.setItem(BILLING_KEY, c); } catch (_) {}
    document.querySelectorAll('[data-billing-toggle]').forEach((btn) => {
      const on = btn.getAttribute('data-billing-toggle') === c;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    syncAllPricingUi();
  }

  function unitLabel(cycle) {
    if (getMarket() === 'cn') return L('/ 365 天', '/ 365 days');
    if (cycle === 'month') return L('/ 月', '/ month');
    return L('/ 年', '/ year');
  }

  function billingNote(cycle) {
    if (getMarket() === 'cn') {
      return L(
        '价格 USD · 一次性 365 天 · 不自动续费',
        'USD · one-time 365-day pass · no auto-renewal'
      );
    }
    if (cycle === 'month') {
      return L(
        '价格 USD · 月付 · 下方划线为原价',
        'USD · monthly · strikethrough = list price'
      );
    }
    return L(
      '价格 USD · 年付 · 下方划线为原价（更划算）',
      'USD · yearly · strikethrough = list price (best value)'
    );
  }

  function eduBlockMessage(reason) {
    if (reason === 'login') {
      return L(
        '教育价需使用机构邮箱登录后购买（如 .edu.cn / .edu / .ac.uk）。\n\n前往登录？',
        'Education pricing requires sign-in with an institutional email (.edu / .edu.cn / .ac.uk, etc.).\n\nGo to sign-in?'
      );
    }
    return L(
      '当前登录邮箱不是教育/机构域名，无法使用教育价。\n请改用 .edu.cn、.edu、.ac.uk 等机构邮箱重新登录后再试。',
      'Your signed-in email is not an institutional domain, so education pricing is locked.\nPlease sign in with .edu / .edu.cn / .ac.uk (etc.) and try again.'
    );
  }

  /** 普通价卡片金额、CTA、周期文案 */
  function syncPlanPrices(cycle) {
    const market = getMarket();
    const effectiveCycle = market === 'cn' ? 'year' : cycle;
    document.querySelectorAll('[data-plan-price]').forEach((el) => {
      const plan = (el.getAttribute('data-plan-price') || '').toLowerCase();
      const row = market === 'cn' ? CN_PRICES[plan] : PLAN_PRICES[plan];
      if (!row) return;
      const pack = market === 'cn' ? row : (row[effectiveCycle] || row.year);
      const amt = el.querySelector('[data-price-amt]');
      const unit = el.querySelector('[data-price-unit]');
      if (amt) amt.textContent = pack.pay;
      if (unit) unit.textContent = unitLabel(effectiveCycle);
    });

    document.querySelectorAll('[data-plan-was]').forEach((el) => {
      const plan = (el.getAttribute('data-plan-was') || '').toLowerCase();
      const row = PLAN_PRICES[plan];
      if (!row) return;
      if (market === 'cn') {
        el.hidden = true;
        return;
      }
      const pack = row[effectiveCycle] || row.year;
      el.textContent = L(`原价 ${pack.was}`, `Was ${pack.was}`);
      el.hidden = !pack.was;
    });

    // 含 settings 里的升级按钮：按周期改文案与 data-period
    document.querySelectorAll('[data-creem-checkout]').forEach((el) => {
      const isEdu = el.getAttribute('data-edu') === '1' || el.getAttribute('data-edu') === 'true';
      if (isEdu) return;
      if (normalizeMarket(el.getAttribute('data-market')) === 'cn') return;
      const plan = (el.getAttribute('data-plan') || '').toLowerCase();
      if (plan !== 'pro' && plan !== 'max') return;
      el.setAttribute('data-period', market === 'cn' ? 'one_time' : effectiveCycle);
      const name = plan === 'max' ? 'Max' : 'Pro';
      const isSettings = el.classList.contains('settings-link-row');
      const text = market === 'cn'
        ? (isSettings
          ? L(`升级 ${name} · 365 天`, `Upgrade ${name} · 365 days`)
          : L(`购买 ${name} · 365 天`, `Buy ${name} · 365 days`))
        : effectiveCycle === 'month'
          ? (isSettings
            ? L(`升级 ${name} · 月付`, `Upgrade ${name} · monthly`)
            : L(`订阅 ${name} · 月付`, `Subscribe ${name} · monthly`))
          : (isSettings
            ? L(`升级 ${name} · 年付`, `Upgrade ${name} · yearly`)
            : L(`订阅 ${name} · 年付`, `Subscribe ${name} · yearly`));
      if (isSettings) el.innerHTML = `${text}<span>→</span>`;
      else el.textContent = text;
    });

    document.querySelectorAll('[data-billing-note]').forEach((node) => {
      node.textContent = billingNote(cycle);
    });

    // 同步所有切换按钮选中态
    document.querySelectorAll('[data-billing-toggle]').forEach((btn) => {
      const on = btn.getAttribute('data-billing-toggle') === effectiveCycle;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function isEduCheckoutEl(el) {
    return el.getAttribute('data-edu') === '1' || el.getAttribute('data-edu') === 'true';
  }

  /** 普通价按钮：机构邮箱用户禁用，避免误付标准价 */
  function syncStandardCtaUi(elig, cycle) {
    document.querySelectorAll('[data-creem-checkout]').forEach((el) => {
      if (isEduCheckoutEl(el)) return;
      if (normalizeMarket(el.getAttribute('data-market')) === 'cn') return;
      const plan = (el.getAttribute('data-plan') || '').toLowerCase();
      if (plan !== 'pro' && plan !== 'max') return;
      const name = plan === 'max' ? 'Max' : 'Pro';
      const isSettings = el.classList.contains('settings-link-row');

      if (getMarket() === 'cn') {
        el.classList.remove('std-price-locked', 'home-btn-ghost', 'plan-btn-ghost');
        el.removeAttribute('aria-disabled');
        el.removeAttribute('data-std-locked');
        if (el.tagName === 'BUTTON') el.disabled = false;
        el.title = L('中国区一次性 365 天产品 · 不自动续费', 'China one-time 365-day pass · no auto-renewal');
        const text = isSettings
          ? L(`升级 ${name} · 365 天`, `Upgrade ${name} · 365 days`)
          : L(`购买 ${name} · 365 天`, `Buy ${name} · 365 days`);
        if (isSettings) el.innerHTML = `${text}<span>→</span>`;
        else el.textContent = text;
        return;
      }

      if (elig.ok) {
        el.classList.add('std-price-locked');
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('data-std-locked', '1');
        if (el.tagName === 'BUTTON') el.disabled = true;
        el.title = L(
          `您已登录机构邮箱 ${elig.email}，请使用下方教育价，避免按标准价付款`,
          `Signed in with institutional email ${elig.email}. Use education pricing below to avoid full-price checkout`
        );
        const lockedText = L(
          `标准价不可用 · 请用教育价`,
          `Standard price locked · use edu price`
        );
        if (isSettings) el.innerHTML = `${lockedText}<span>—</span>`;
        else el.textContent = lockedText;
        // 视觉降级：去掉主 CTA 强调
        el.classList.remove('home-btn-primary', 'plan-btn-primary');
        el.classList.add('home-btn-ghost', 'plan-btn-ghost');
      } else {
        el.classList.remove('std-price-locked');
        el.removeAttribute('aria-disabled');
        el.removeAttribute('data-std-locked');
        if (el.tagName === 'BUTTON') el.disabled = false;
        el.removeAttribute('title');
        // 恢复主 CTA（非 settings）
        if (!isSettings) {
          el.classList.add('home-btn-primary', 'plan-btn-primary');
          el.classList.remove('home-btn-ghost');
          // plan 页 ghost 不用于标准主按钮
          if (el.classList.contains('plan-btn')) el.classList.remove('plan-btn-ghost');
        }
        // 文案由 syncPlanPrices 已写好；若刚从锁定恢复再写一遍
        const text = cycle === 'month'
          ? (isSettings
            ? L(`升级 ${name} · 月付`, `Upgrade ${name} · monthly`)
            : L(`订阅 ${name} · 月付`, `Subscribe ${name} · monthly`))
          : (isSettings
            ? L(`升级 ${name} · 年付`, `Upgrade ${name} · yearly`)
            : L(`订阅 ${name} · 年付`, `Subscribe ${name} · yearly`));
        if (isSettings) el.innerHTML = `${text}<span>→</span>`;
        else el.textContent = text;
      }
    });
  }

  function syncEduCtaUi() {
    const elig = eduEligibility();
    const cycle = getBillingCycle();

    if (getMarket() === 'cn') {
      document.querySelectorAll('[data-creem-checkout][data-edu="1"], [data-creem-checkout][data-edu="true"]').forEach((el) => { el.hidden = true; });
      document.querySelectorAll('[data-edu-status]').forEach((node) => { node.hidden = true; });
      return;
    }

    document.body?.classList.toggle('edu-eligible', !!elig.ok);
    document.body?.classList.toggle('edu-not-eligible', !elig.ok && elig.reason === 'not_edu');

    document.querySelectorAll('[data-creem-checkout][data-edu="1"], [data-creem-checkout][data-edu="true"]').forEach((el) => {
      el.hidden = false;
      el.setAttribute('data-period', cycle === 'month' ? 'month' : 'year');
      const plan = (el.getAttribute('data-plan') || 'pro').toLowerCase() === 'max' ? 'max' : 'pro';
      const price = EDU_PRICES[plan][cycle];
      const unitZh = cycle === 'month' ? '月付' : '年付';
      const unitEn = cycle === 'month' ? 'monthly' : 'yearly';
      const name = plan === 'max' ? 'Max' : 'Pro';
      const isSettings = el.classList.contains('settings-link-row');

      if (elig.ok) {
        el.classList.remove('edu-locked');
        el.classList.add('edu-ready');
        el.removeAttribute('aria-disabled');
        if (el.tagName === 'BUTTON') el.disabled = false;
        el.title = L(`机构邮箱已验证：${elig.email} · 教育价结账`, `Institutional email verified: ${elig.email} · edu checkout`);
        const readyText = L(`教育价 ${price} · ${unitZh}`, `Edu ${price} · ${unitEn}`);
        if (isSettings) el.innerHTML = `${L(`教育价升级 ${name} · ${price}`, `Edu upgrade ${name} · ${price}`)}<span>→</span>`;
        else el.textContent = readyText;
        // 突出：升级为主按钮样式
        el.classList.add('home-btn-primary', 'plan-btn-primary');
        el.classList.remove('home-btn-ghost', 'plan-btn-ghost');
      } else {
        el.classList.add('edu-locked');
        el.classList.remove('edu-ready', 'home-btn-primary', 'plan-btn-primary');
        el.setAttribute('aria-disabled', 'true');
        // 教育价按钮保持可点以弹出登录/提示；不 disabled
        if (elig.reason === 'login') {
          el.title = L('请使用机构邮箱登录后购买教育价', 'Sign in with an institutional email for education pricing');
          const t = L(`教育价 ${price} · 登录解锁`, `Edu ${price} · sign in`);
          if (isSettings) el.innerHTML = `${t}<span>→</span>`;
          else el.textContent = t;
        } else {
          el.title = L(
            `当前邮箱 ${elig.email || '—'} 不是机构域名，无法使用教育价`,
            `Current email ${elig.email || '—'} is not institutional; education checkout is locked`
          );
          const t = L(`教育价 ${price} · 需机构邮箱`, `Edu ${price} · institutional email`);
          if (isSettings) el.innerHTML = `${t}<span>—</span>`;
          else el.textContent = t;
        }
      }
    });

    syncStandardCtaUi(elig, cycle);

    document.querySelectorAll('[data-edu-status]').forEach((node) => {
      if (elig.ok) {
        node.hidden = false;
        node.textContent = L(
          `已验证机构邮箱 ${elig.email}：请使用教育价按钮订阅，标准价已锁定以防误付。`,
          `Institutional email verified (${elig.email}): use education pricing. Standard price is locked to prevent full-price checkout.`
        );
        node.dataset.state = 'ok';
      } else if (elig.reason === 'not_edu') {
        node.hidden = false;
        const mail = elig.email || '—';
        node.textContent = L(
          `当前登录：${mail}。这不是机构邮箱，教育价暂不可用。请改用 .edu / .edu.cn / .ac.* 等邮箱登录后再试。`,
          `Signed in as ${mail}. This is not an institutional email, so education pricing is locked. Please sign in with .edu / .edu.cn / .ac.* and try again.`
        );
        node.dataset.state = 'blocked';
      } else {
        node.hidden = false;
        node.textContent = L(
          '教育价需使用机构邮箱（.edu / .edu.cn / .ac.uk 等）登录后购买；普通个人邮箱无法支付教育价。',
          'Education pricing requires sign-in with an institutional email (.edu / .edu.cn / .ac.uk, etc.). Personal emails cannot use edu checkout.'
        );
        node.dataset.state = 'login';
      }
    });
  }

  function syncAllPricingUi() {
    syncMarketUi();
    const cycle = getBillingCycle();
    document.body?.setAttribute('data-billing', cycle);
    document.querySelectorAll('[data-billing-toggle]').forEach((btn) => {
      const on = btn.getAttribute('data-billing-toggle') === cycle;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    syncPlanPrices(cycle);
    syncEduCtaUi();
  }

  function bindBillingToggles(scope) {
    (scope || document).querySelectorAll('[data-billing-toggle]').forEach((btn) => {
      if (btn.__billingBound) return;
      btn.__billingBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const c = btn.getAttribute('data-billing-toggle') === 'month' ? 'month' : 'year';
        setBillingCycle(c);
      });
    });
  }

  function cnCheckoutUrl(plan, el) {
    const attrUrl = String(el?.getAttribute('data-cn-checkout-url') || '').trim();
    if (attrUrl) return attrUrl;
    try {
      const configured = window.AILATEST_CN_CHECKOUT || {};
      if (configured[plan]) return String(configured[plan]).trim();
    } catch (_) {}
    return CN_FALLBACK[plan] || '';
  }

  async function startChinaCheckout(el) {
    const plan = (el.getAttribute('data-plan') || 'pro').toLowerCase() === 'max' ? 'max' : 'pro';
    const fallback = cnCheckoutUrl(plan, el);
    const user = readUser();
    const token = user && user.token;
    const prev = el.textContent;
    if (el.tagName === 'BUTTON') el.disabled = true;
    el.setAttribute('aria-busy', 'true');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch(`${API_BASE}/checkout/creem`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan, period: 'one_time', market: 'cn', edu: false }),
      });
      const data = await resp.json().catch(() => ({}));
      if (data.checkout_url) {
        openUrl(data.checkout_url);
        return;
      }
      if (data.error === 'product_not_configured') {
        alert(L(
          '中国区一次性产品尚未在后台配置。请先在 Creem 创建 Pro / Max 的一次性 365 天产品并填入对应 SKU；不能复用月付产品。',
          'The China one-time product is not configured yet. Create the Pro/Max one-time 365-day SKU in Creem and set its product ID; recurring SKUs cannot be reused.'
        ));
        return;
      }
      if (fallback) {
        openUrl(fallback);
        return;
      }
      throw new Error(data.message || `HTTP ${resp.status}`);
    } catch (_) {
      if (fallback) {
        openUrl(fallback);
        return;
      }
      alert(L(
        '暂时无法连接中国区收银台，请稍后重试。支付方式会在 Creem 收银台内按条件显示。',
        'The China checkout is temporarily unavailable. Please retry later; Creem shows the available payment methods on its checkout page.'
      ));
    } finally {
      el.removeAttribute('aria-busy');
      if (el.tagName === 'BUTTON') {
        el.disabled = false;
        el.textContent = prev;
      }
      syncAllPricingUi();
    }
  }

  async function startCheckout(el) {
    const plan = (el.getAttribute('data-plan') || 'pro').toLowerCase();
    const period = (el.getAttribute('data-period') || getBillingCycle() || 'year').toLowerCase();
    const market = normalizeMarket(el.getAttribute('data-market') || getMarket());
    const edu = isEduCheckoutEl(el);

    if (market === 'cn') {
      await startChinaCheckout(el);
      return;
    }

    const fb = FALLBACK[fallbackKey(plan, period, edu)] || FALLBACK.pro_year;
    const nextPath = location.pathname.includes('pricing') ? '/pricing' : '/#pricing';
    const elig = eduEligibility();

    // 机构邮箱用户：禁止走标准价，避免误付
    if (!edu && elig.ok) {
      alert(L(
        `您已使用机构邮箱 ${elig.email} 登录，请点击「教育价」按钮订阅，标准价已锁定。`,
        `You are signed in with institutional email ${elig.email}. Please use the education pricing button; standard checkout is locked.`
      ));
      return;
    }

    if (el.getAttribute('data-std-locked') === '1' || el.classList.contains('std-price-locked')) {
      return;
    }

    if (edu) {
      if (!elig.ok) {
        if (elig.reason === 'login') {
          const go = confirm(eduBlockMessage('login'));
          if (go) {
            location.href = '/signup.html?next=' + encodeURIComponent(nextPath);
          }
        } else {
          alert(eduBlockMessage('not_edu'));
        }
        return;
      }
    }

    const user = readUser();
    const token = user && user.token;

    if (!token) {
      const go = confirm(L(
        '建议先登录后再订阅，以便权益自动到账。\n\n确定继续前往收银台？\n（取消将跳转登录页）',
        'Please sign in so entitlements can sync to your account.\n\nContinue to checkout?\n(Cancel opens sign-in.)'
      ));
      if (!go) {
        location.href = '/signup.html?next=' + encodeURIComponent(nextPath);
        return;
      }
      openUrl(fb);
      return;
    }

    const prev = el.textContent;
    el.setAttribute('aria-busy', 'true');
    if (el.tagName === 'BUTTON') el.disabled = true;
    try {
      const resp = await fetch(`${API_BASE}/checkout/creem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, period, edu }),
      });
      const data = await resp.json().catch(() => ({}));

      if (edu && (resp.status === 401 || resp.status === 403 || data.error === 'edu_email_required' || data.error === 'login_required')) {
        alert(
          data.message
          || (data.error === 'login_required'
            ? eduBlockMessage('login')
            : eduBlockMessage('not_edu'))
        );
        if (data.error === 'login_required') {
          location.href = '/signup.html?next=' + encodeURIComponent(nextPath);
        }
        return;
      }

      if (edu && !data.checkout_url) {
        alert(L(
          '无法创建教育价订单，请确认已用机构邮箱登录后重试。',
          'Could not start edu checkout. Sign in with an institutional email and try again.'
        ));
        return;
      }

      const url = data.checkout_url || (edu ? null : fb);
      if (!url) return;
      openUrl(url);
    } catch (_) {
      if (edu) {
        alert(L(
          '网络异常，教育价结账失败。请稍后重试（需机构邮箱登录）。',
          'Network error starting edu checkout. Please retry while signed in with an institutional email.'
        ));
        return;
      }
      openUrl(fb);
    } finally {
      el.removeAttribute('aria-busy');
      if (el.tagName === 'BUTTON') {
        el.disabled = false;
        el.textContent = prev;
      }
      syncAllPricingUi();
    }
  }

  function bind(root) {
    const scope = root && root.querySelectorAll ? root : document;
    bindBillingToggles(scope);
    scope.querySelectorAll('[data-creem-checkout]').forEach((el) => {
      if (el.__creemBound) return;
      el.__creemBound = true;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        // 机构的标准价不可点（再拦一层；disabled 按钮多数浏览器不会触发 click）
        if (
          el.classList.contains('std-price-locked')
          || el.getAttribute('data-std-locked') === '1'
          || (el.disabled && !isEduCheckoutEl(el))
        ) {
          const elig = eduEligibility();
          if (elig.ok) {
            alert(L(
              `您已使用机构邮箱 ${elig.email} 登录，请使用教育价按钮。`,
              `Signed in with ${elig.email}. Please use the education pricing button.`
            ));
          }
          return;
        }
        startCheckout(el);
      });
    });
    syncAllPricingUi();
  }

  window.__bindCreemCheckout = bind;
  window.__syncEduCheckoutUi = syncAllPricingUi;
  window.__syncPricingUi = syncAllPricingUi;
  window.__setBillingCycle = setBillingCycle;
  window.__getBillingCycle = getBillingCycle;
  window.__getPricingMarket = getMarket;
  window.__isEduEmail = isEduEmail;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bind());
  else bind();

  window.addEventListener('storage', (ev) => {
    if (!ev.key || ev.key === 'ailatest.user' || ev.key === 'ailatest.lang' || ev.key === BILLING_KEY) {
      syncAllPricingUi();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncAllPricingUi();
  });
  window.addEventListener('ailatest:langchange', () => syncAllPricingUi());
  setTimeout(() => syncAllPricingUi(), 0);
  setTimeout(() => syncAllPricingUi(), 200);
  setTimeout(() => syncAllPricingUi(), 800);
})();
