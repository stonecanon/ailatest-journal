/**
 * 定价 / 结账：年付·月付切换、Creem 结账、教育价校验。
 * 首页 #pricing 与 /pricing 订阅页共用。
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

  /** 中文界面（简/繁）用中文文案；其它语言用英文结账文案 */
  function isZh() {
    const raw = currentUiLang();
    if (raw === 'zh' || raw.startsWith('zh-') || raw.startsWith('zh')) return true;
    // 静态订阅页默认 lang=zh-CN，且无明确英文信号时按中文
    const html = normalizeLangCode(document.documentElement.lang);
    if ((html === 'zh' || html.startsWith('zh')) && !(raw === 'en' || raw.startsWith('en-'))) return true;
    return false;
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
    if (cycle === 'month') return L('/ 月', '/ month');
    return L('/ 年', '/ year');
  }

  function billingNote(cycle) {
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
    document.querySelectorAll('[data-plan-price]').forEach((el) => {
      const plan = (el.getAttribute('data-plan-price') || '').toLowerCase();
      const row = PLAN_PRICES[plan];
      if (!row) return;
      const pack = row[cycle] || row.year;
      const amt = el.querySelector('[data-price-amt]');
      const unit = el.querySelector('[data-price-unit]');
      if (amt) amt.textContent = pack.pay;
      if (unit) unit.textContent = unitLabel(cycle);
    });

    document.querySelectorAll('[data-plan-was]').forEach((el) => {
      const plan = (el.getAttribute('data-plan-was') || '').toLowerCase();
      const row = PLAN_PRICES[plan];
      if (!row) return;
      const pack = row[cycle] || row.year;
      el.textContent = L(`原价 ${pack.was}`, `Was ${pack.was}`);
      el.hidden = !pack.was;
    });

    // 含 settings 里的升级按钮：按周期改文案与 data-period
    document.querySelectorAll('[data-creem-checkout]').forEach((el) => {
      const isEdu = el.getAttribute('data-edu') === '1' || el.getAttribute('data-edu') === 'true';
      if (isEdu) return;
      const plan = (el.getAttribute('data-plan') || '').toLowerCase();
      if (plan !== 'pro' && plan !== 'max') return;
      el.setAttribute('data-period', cycle);
      const name = plan === 'max' ? 'Max' : 'Pro';
      const isSettings = el.classList.contains('settings-link-row');
      const text = cycle === 'month'
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
      const on = btn.getAttribute('data-billing-toggle') === cycle;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function syncEduCtaUi() {
    const elig = eduEligibility();
    const cycle = getBillingCycle();

    document.querySelectorAll('[data-creem-checkout][data-edu="1"], [data-creem-checkout][data-edu="true"]').forEach((el) => {
      el.setAttribute('data-period', cycle === 'month' ? 'month' : 'year');
      const plan = (el.getAttribute('data-plan') || 'pro').toLowerCase() === 'max' ? 'max' : 'pro';
      const price = EDU_PRICES[plan][cycle];
      const unitZh = cycle === 'month' ? '月付' : '年付';
      const unitEn = cycle === 'month' ? 'monthly' : 'yearly';

      if (elig.ok) {
        el.classList.remove('edu-locked');
        el.removeAttribute('aria-disabled');
        el.title = L(`机构邮箱已验证：${elig.email}`, `Institutional email verified: ${elig.email}`);
        el.textContent = L(`教育价 ${price} · ${unitZh}`, `Edu ${price} · ${unitEn}`);
      } else {
        el.classList.add('edu-locked');
        el.setAttribute('aria-disabled', 'true');
        if (elig.reason === 'login') {
          el.title = L('请使用机构邮箱登录后购买教育价', 'Sign in with an institutional email for education pricing');
          el.textContent = L(`教育价 ${price} · 登录解锁`, `Edu ${price} · sign in`);
        } else {
          el.title = L(
            `当前邮箱 ${elig.email || '—'} 不是机构域名，无法使用教育价`,
            `Current email ${elig.email || '—'} is not institutional; education checkout is locked`
          );
          el.textContent = L(`教育价 ${price} · 需机构邮箱`, `Edu ${price} · institutional email`);
        }
      }
    });

    document.querySelectorAll('[data-edu-status]').forEach((node) => {
      if (elig.ok) {
        node.hidden = false;
        node.textContent = L(
          `已验证机构邮箱 ${elig.email}，可使用教育价。`,
          `Institutional email verified (${elig.email}). Education pricing is unlocked.`
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

  async function startCheckout(el) {
    const plan = (el.getAttribute('data-plan') || 'pro').toLowerCase();
    const period = (el.getAttribute('data-period') || getBillingCycle() || 'year').toLowerCase();
    const edu = el.getAttribute('data-edu') === '1' || el.getAttribute('data-edu') === 'true';
    const fb = FALLBACK[fallbackKey(plan, period, edu)] || FALLBACK.pro_year;
    const nextPath = location.pathname.includes('pricing') ? '/pricing' : '/#pricing';

    if (edu) {
      const elig = eduEligibility();
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
