/**
 * AILatest suite first-party beacon + optional GA4
 * Drop-in on any product host. Site key = hostname (canonicalized by API).
 *
 * Optional before load:
 *   window.AILATEST_GA4_ID = 'G-XXXXXXXX'
 *   window.AILATEST_API_BASE = 'https://api.ailatest.org'
 */
(function () {
  'use strict';
  if (window.__AILATEST_BEACON_LOADED) return;
  window.__AILATEST_BEACON_LOADED = true;

  var API = window.AILATEST_API_BASE
    || (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:8787'
      : 'https://api.ailatest.org');
  var GA4 = window.AILATEST_GA4_ID || '';

  function uuid() {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  function id(key, storage) {
    try {
      var v = storage.getItem(key);
      if (!v) { v = uuid(); storage.setItem(key, v); }
      return v;
    } catch (_) { return uuid(); }
  }
  function cleanPath() {
    try {
      var u = new URL(location.href);
      ['token', 'state', 'code', 'access_token', 'id_token'].forEach(function (k) {
        u.searchParams.delete(k);
      });
      return u.pathname + (u.search ? u.search.slice(0, 180) : '');
    } catch (_) {
      return location.pathname || '/';
    }
  }
  function host() {
    return String(location.hostname || '').toLowerCase().replace(/^www\./, '');
  }

  function sendPageview() {
    var h = host();
    if (!h || h === 'api.ailatest.org') return;
    var payload = {
      event_type: 'page_view',
      event_ts: Math.floor(Date.now() / 1000),
      site: h,
      hostname: h,
      path: cleanPath(),
      referrer: document.referrer || '',
      visitor_id: id('ailatest.analytics.visitor', localStorage),
      session_id: id('ailatest.analytics.session', sessionStorage),
      client_timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone) || '',
      client_language: navigator.language || '',
      screen_resolution: (screen.width || 0) + 'x' + (screen.height || 0),
      page_title: document.title || '',
    };
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(
        API + '/analytics/pageview',
        new Blob([body], { type: 'application/json' })
      )) return;
    } catch (_) {}
    fetch(API + '/analytics/pageview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body,
      keepalive: true,
    }).catch(function () {});
  }

  function loadGa4() {
    if (!GA4 || !/^G-[A-Z0-9]+$/i.test(GA4)) return;
    if (window.gtag) {
      try {
        window.gtag('config', GA4, {
          anonymize_ip: true,
          page_location: location.href,
          page_title: document.title,
          send_page_view: true,
        });
      } catch (_) {}
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4, {
      anonymize_ip: true,
      send_page_view: true,
    });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4);
    document.head.appendChild(s);
  }

  function boot() {
    sendPageview();
    loadGa4();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // SPA route changes (Todo / major)
  var last = location.href;
  setInterval(function () {
    if (location.href !== last) {
      last = location.href;
      sendPageview();
      if (window.gtag && GA4) {
        try {
          window.gtag('event', 'page_view', {
            page_location: location.href,
            page_path: cleanPath(),
            page_title: document.title,
          });
        } catch (_) {}
      }
    }
  }, 800);
})();
