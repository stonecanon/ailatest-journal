/**
 * 定价页 Creem 结账：优先走 API（带 userId metadata），失败则回退公开产品链接。
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

  const API_BASE = (window.AILATEST_API_BASE
    || (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:8787'
      : 'https://api.ailatest.org'));

  function readUser() {
    try {
      return JSON.parse(localStorage.getItem('ailatest.user') || 'null');
    } catch (_) {
      return null;
    }
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

  async function startCheckout(el) {
    const plan = (el.getAttribute('data-plan') || 'pro').toLowerCase();
    const period = (el.getAttribute('data-period') || 'year').toLowerCase();
    const edu = el.getAttribute('data-edu') === '1' || el.getAttribute('data-edu') === 'true';
    const fb = FALLBACK[fallbackKey(plan, period, edu)] || FALLBACK.pro_year;

    const user = readUser();
    const token = user && user.token;

    // 未登录：引导注册，仍可打开收银台（webhook 靠邮箱匹配）
    if (!token) {
      const go = confirm(
        (document.documentElement.lang || '').startsWith('zh')
          ? '建议先登录后再订阅，以便权益自动到账。\n\n确定继续前往收银台？\n（取消将跳转登录页）'
          : 'Please sign in so entitlements can sync to your account.\n\nContinue to checkout?\n(Cancel opens sign-in.)'
      );
      if (!go) {
        location.href = '/signup.html?next=' + encodeURIComponent('/pricing.html');
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
      const url = data.checkout_url || fb;
      openUrl(url);
    } catch (_) {
      openUrl(fb);
    } finally {
      el.removeAttribute('aria-busy');
      if (el.tagName === 'BUTTON') {
        el.disabled = false;
        el.textContent = prev;
      }
    }
  }

  function bind(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-creem-checkout]').forEach((el) => {
      if (el.__creemBound) return;
      el.__creemBound = true;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        startCheckout(el);
      });
    });
  }

  window.__bindCreemCheckout = bind;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bind());
  else bind();
})();
