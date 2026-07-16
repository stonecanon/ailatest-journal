/**
 * 定价页 Creem 结账：优先走 API（带 userId metadata），失败则回退公开产品链接。
 * 教育价：必须登录且账号为机构邮箱（.edu / .edu.cn / .ac.* 等）才可支付。
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

  /** 与 docs/entitlements.spec.json → billing.edu_verification.domain_whitelist 一致 */
  const EDU_DOMAIN_SUFFIXES = [
    '.edu.cn', '.edu', '.ac.uk', '.ac.jp', '.ac.kr',
    '.edu.au', '.edu.sg', '.edu.hk', '.edu.mo', '.edu.tw',
  ];

  const EDU_PRICES = {
    pro: { year: '$4.99', month: '$0.69' },
    max: { year: '$5.99', month: '$0.89' },
  };

  const API_BASE = (window.AILATEST_API_BASE
    || (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:8787'
      : 'https://api.ailatest.org'));

  function isZh() {
    const lang = (document.documentElement.getAttribute('data-static-lang')
      || document.documentElement.lang
      || '').toLowerCase();
    return lang.startsWith('zh');
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
    // 长后缀优先；.edu 匹配 mit.edu，不匹配 foo.education
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

  function eduBlockMessage(reason) {
    if (reason === 'login') {
      return isZh()
        ? '教育价需使用机构邮箱登录后购买（如 .edu.cn / .edu / .ac.uk）。\n\n前往登录？'
        : 'Education pricing requires sign-in with an institutional email (.edu / .edu.cn / .ac.uk, etc.).\n\nGo to sign-in?';
    }
    return isZh()
      ? '当前登录邮箱不是教育/机构域名，无法使用教育价。\n请改用 .edu.cn、.edu、.ac.uk 等机构邮箱重新登录后再试。'
      : 'Your signed-in email is not an institutional domain, so education pricing is locked.\nPlease sign in with .edu / .edu.cn / .ac.uk (etc.) and try again.';
  }

  function syncEduCtaUi() {
    const elig = eduEligibility();
    const cycle = document.body.getAttribute('data-billing') === 'month' ? 'month' : 'year';

    document.querySelectorAll('[data-creem-checkout][data-edu="1"], [data-creem-checkout][data-edu="true"]').forEach((el) => {
      el.setAttribute('data-period', cycle === 'month' ? 'month' : 'year');
      const plan = (el.getAttribute('data-plan') || 'pro').toLowerCase() === 'max' ? 'max' : 'pro';
      const price = EDU_PRICES[plan][cycle];
      const unitZh = cycle === 'month' ? '月付' : '年付';
      const unitEn = cycle === 'month' ? 'monthly' : 'yearly';

      if (elig.ok) {
        el.classList.remove('edu-locked');
        el.removeAttribute('aria-disabled');
        el.title = isZh()
          ? `教育邮箱已验证：${elig.email}`
          : `Edu email verified: ${elig.email}`;
        el.textContent = isZh()
          ? `教育${unitZh} ${price}`
          : `Edu ${unitEn} ${price}`;
      } else {
        el.classList.add('edu-locked');
        el.setAttribute('aria-disabled', 'true');
        if (elig.reason === 'login') {
          el.title = isZh()
            ? '请使用机构邮箱登录后购买教育价'
            : 'Sign in with an institutional email for edu pricing';
          el.textContent = isZh()
            ? `教育价 ${price} · 登录解锁`
            : `Edu ${price} · sign in`;
        } else {
          el.title = isZh()
            ? `当前邮箱 ${elig.email || '—'} 非教育域名，不可支付教育价`
            : `Current email ${elig.email || '—'} is not institutional; edu checkout locked`;
          el.textContent = isZh()
            ? `教育价 ${price} · 需机构邮箱`
            : `Edu ${price} · need .edu email`;
        }
      }
    });

    document.querySelectorAll('[data-edu-status]').forEach((node) => {
      if (elig.ok) {
        node.hidden = false;
        node.textContent = isZh()
          ? `已验证教育邮箱 ${elig.email}，可购买教育价。`
          : `Institutional email verified (${elig.email}). Edu checkout unlocked.`;
        node.dataset.state = 'ok';
      } else if (elig.reason === 'not_edu') {
        node.hidden = false;
        node.textContent = isZh()
          ? `当前账号 ${elig.email || ''} 非机构邮箱，教育价按钮已锁定。请改用 .edu / .edu.cn 等邮箱登录。`
          : `Signed in as ${elig.email || 'non-edu'}; education checkout is locked. Use an institutional email.`;
        node.dataset.state = 'blocked';
      } else {
        node.hidden = false;
        node.textContent = isZh()
          ? '教育价仅限机构邮箱（.edu.cn / .edu / .ac.uk 等）登录后购买；普通邮箱无法支付。'
          : 'Education pricing is only for institutional emails (.edu / .edu.cn / .ac.uk, etc.) after sign-in.';
        node.dataset.state = 'login';
      }
    });
  }

  async function startCheckout(el) {
    const plan = (el.getAttribute('data-plan') || 'pro').toLowerCase();
    const period = (el.getAttribute('data-period') || 'year').toLowerCase();
    const edu = el.getAttribute('data-edu') === '1' || el.getAttribute('data-edu') === 'true';
    const fb = FALLBACK[fallbackKey(plan, period, edu)] || FALLBACK.pro_year;

    if (edu) {
      const elig = eduEligibility();
      if (!elig.ok) {
        if (elig.reason === 'login') {
          const go = confirm(eduBlockMessage('login'));
          if (go) {
            location.href = '/signup.html?next=' + encodeURIComponent('/pricing.html');
          }
        } else {
          alert(eduBlockMessage('not_edu'));
        }
        return;
      }
    }

    const user = readUser();
    const token = user && user.token;

    // 普通价：未登录可继续公开链接（webhook 靠邮箱匹配）；教育价绝不通此路径
    if (!token) {
      const go = confirm(
        isZh()
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

      if (edu && (resp.status === 401 || resp.status === 403 || data.error === 'edu_email_required' || data.error === 'login_required')) {
        alert(
          data.message
          || (data.error === 'login_required'
            ? eduBlockMessage('login')
            : eduBlockMessage('not_edu'))
        );
        if (data.error === 'login_required') {
          location.href = '/signup.html?next=' + encodeURIComponent('/pricing.html');
        }
        return;
      }

      // 教育价：服务端未放行时绝不回退公开 EDU 链接
      if (edu && !data.checkout_url) {
        alert(isZh()
          ? '无法创建教育价订单，请确认已用机构邮箱登录后重试。'
          : 'Could not start edu checkout. Sign in with an institutional email and try again.');
        return;
      }

      const url = data.checkout_url || (edu ? null : fb);
      if (!url) return;
      openUrl(url);
    } catch (_) {
      if (edu) {
        alert(isZh()
          ? '网络异常，教育价结账失败。请稍后重试（需机构邮箱登录）。'
          : 'Network error starting edu checkout. Please retry while signed in with an institutional email.');
        return;
      }
      openUrl(fb);
    } finally {
      el.removeAttribute('aria-busy');
      if (el.tagName === 'BUTTON') {
        el.disabled = false;
        el.textContent = prev;
      }
      syncEduCtaUi();
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
    syncEduCtaUi();
  }

  window.__bindCreemCheckout = bind;
  window.__syncEduCheckoutUi = syncEduCtaUi;
  window.__isEduEmail = isEduEmail;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bind());
  else bind();

  // 登录态可能异步写入 localStorage
  window.addEventListener('storage', (ev) => {
    if (!ev.key || ev.key === 'ailatest.user') syncEduCtaUi();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncEduCtaUi();
  });
})();
