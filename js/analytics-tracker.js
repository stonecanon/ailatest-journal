/**
 * AILatest Analytics Tracker v2 — 前端埋点增强
 * 独立于 app.js，在 app.js 加载后执行
 * 用法：在 index.html 中 <script src="/js/analytics-tracker.js" defer></script>
 */

(function() {
  'use strict';

  /* ========================== 工具函数 ========================== */
  function uuidV4() {
    return (crypto?.randomUUID?.()) ||
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
  }

  function getAnalyticsId(key, storage) {
    try {
      let id = storage.getItem(key);
      if (!id) {
        id = uuidV4();
        storage.setItem(key, id);
      }
      return id;
    } catch (_) {
      return uuidV4();
    }
  }

  /* ========================== Bot检测 ========================== */
  const BOT_PATTERNS = [
    'Googlebot','Bingbot','Bytespider','AhrefsBot','SemrushBot',
    'MJ12bot','facebookexternalhit','Slackbot','Discordbot',
    'GPTBot','ClaudeBot','CCBot','curl','wget','HeadlessChrome',
    'Playwright','Puppeteer','python-requests','Go-http-client',
    'Google-Read-Aloud','YandexBot','Baiduspider','Sogou',
    'AdsBot','GoogleOther','meta-externalagent','PetalBot',
    'DuckDuckBot','DotBot','Applebot','Nutch',
  ];

  function isBot(ua) {
    if (!ua || ua.trim() === '') return true;
    const lower = ua.toLowerCase();
    for (const p of BOT_PATTERNS) {
      if (lower.includes(p.toLowerCase())) return true;
    }
    return false;
  }

  /* ========================== Visitor/Session管理 ========================== */

  function getVisitorId() {
    return getAnalyticsId('ailatest.analytics.visitor', localStorage);
  }

  function getSessionId() {
    const SESSION_KEY = 'ailatest.analytics.session';
    const SESSION_TIME_KEY = 'ailatest.analytics.session_ts';
    const TIMEOUT_MS = 30 * 60 * 1000;
    try {
      let sid = sessionStorage.getItem(SESSION_KEY);
      let ts = parseInt(sessionStorage.getItem(SESSION_TIME_KEY) || '0', 10);
      const now = Date.now();
      if (!sid || (now - ts) > TIMEOUT_MS) {
        sid = uuidV4();
        sessionStorage.setItem(SESSION_KEY, sid);
      }
      sessionStorage.setItem(SESSION_TIME_KEY, String(now));
      return sid;
    } catch (_) {
      return uuidV4();
    }
  }

  function touchSession() {
    try {
      sessionStorage.setItem('ailatest.analytics.session_ts', String(Date.now()));
    } catch (_) {}
  }

  /* ========================== API BASE ========================== */
  const API_BASE = window.AILATEST_API_BASE
    || (location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://api.ailatest.org');

  /* ========================== 发送核心 ========================== */
  function sendAnalytics(endpoint, payload) {
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(API_BASE + endpoint, blob)) return;
      }
    } catch (_) {}
    fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  /* ========================== 基础Payload ========================== */
  function basePayload(eventType) {
    return {
      event_id: uuidV4(),
      event_type: eventType || 'page_view',
      event_ts: Math.floor(Date.now() / 1000),
      site: location.hostname,
      path: analyticsPath(),
      referrer: document.referrer || '',
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      user_agent: navigator.userAgent || '',
      screen_resolution: screen.width + 'x' + screen.height,
      client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      client_language: navigator.language || '',
      is_bot: isBot(navigator.userAgent),
    };
  }

  function analyticsPath() {
    try {
      const url = new URL(location.href);
      url.searchParams.delete('token');
      url.searchParams.delete('state');
      url.searchParams.delete('code');
      return url.pathname + (url.search ? url.search.slice(0, 180) : '') + (url.hash ? url.hash.slice(0, 80) : '');
    } catch (_) {
      return location.pathname;
    }
  }

  /* ========================== 已存在函数覆盖（Hook app.js）========================== */
  // 以最小侵入方式增强已有函数

  // 1. Hook 现有的 trackPageview 来增加字段
  // app.js 中已有的 trackPageview 会在页面加载时自动调用，我们只需增强其 payload

  // 2. 增强已有的 trackInteraction — 提供更多事件类型支持
  const _origSetup = window.addEventListener;
  let trackerReady = false;

  function setupTracker() {
    if (trackerReady) return;
    trackerReady = true;

    // Hook search/pick interactions to include more data
    document.addEventListener('click', function(e) {
      const target = e.target;
      // Journal detail view tracked via custom elements
    }, true);
  }

  /* ========================== 公共API ========================== */
  const ANALYTICS = {
    getVisitorId,
    getSessionId,
    isBot: isBot(navigator.userAgent),

    /** 发送 page_view */
    trackPageview(path) {
      const payload = {
        ...basePayload('page_view'),
      };
      if (path) payload.path = path;
      sendAnalytics('/analytics/pageview', payload);
    },

    /** 发送交互事件 — 支持所有事件类型 */
    trackInteraction(eventType, detail = {}) {
      const payload = {
        ...basePayload(eventType),
        tab: detail.tab || (window.activeTab || ''),
        query: detail.query || '',
        result_count: Number.isFinite(Number(detail.result_count)) ? Number(detail.result_count) : null,
        journal_key: detail.journal_key || '',
        journal_name: detail.journal_name || '',
        journal_issn: detail.journal_issn || '',
        metadata: detail.metadata || {},
      };
      sendAnalytics('/analytics/interaction', payload);
    },

    /** 期刊详情查看 */
    trackJournalView(journalKey, journalData = {}) {
      this.trackInteraction('journal_view', {
        journal_key: journalKey,
        journal_name: journalData.name || '',
        journal_issn: journalData.issn || '',
        tab: window.activeTab || '',
      });
    },

    /** 收藏操作 */
    trackFavorite(journalKey, action) {
      this.trackInteraction('favorite_' + action, {
        journal_key: journalKey,
      });
    },

    /** 登录事件 */
    trackLogin(provider) {
      this.trackInteraction('login', {
        metadata: { provider: provider || 'unknown' },
      });
    },

    /** 评分事件 */
    trackRating(journalKey, rating) {
      this.trackInteraction('rating', {
        journal_key: journalKey,
        metadata: { rating },
      });
    },

    /** 荐刊扣次 */
    trackPickConsumed(detail = {}) {
      this.trackInteraction('pick_consumed', {
        query: detail.query || '',
        result_count: detail.result_count || null,
        metadata: detail.metadata || {},
      });
    },
  };

  // 导出到全局
  window.__analytics = ANALYTICS;

  // 在页面加载后 500ms 确保 app.js 已初始化，然后 hook 原有函数
  setTimeout(function() {
    // Hook 原有 trackInteraction 调用 — 通过 Monkeypatch
    // app.js 中已有的 trackInteraction 仍然正常工作，
    // 这个 tracker 作为补充
  }, 500);

  console.log('[Analytics] Tracker v2 loaded, bot:', ANALYTICS.isBot);
})();
