/* ================================================================
   CapturaGo — cookie consent + analytics/marketing tags
   Self-contained: include on every page BEFORE other scripts:
     <script src="/consent.js"></script>

   Rules it follows (EU ePrivacy + GDPR):
   • Nothing except strictly-necessary storage runs before consent.
   • "Reject all" is as easy and as visible as "Accept all".
   • Choice can be changed or withdrawn any time ("Cookie settings").
   • Consent is asked again after 12 months or when VERSION changes.
   • Google Consent Mode v2: everything "denied" until the visitor agrees.

   TO TURN ON A TOOL: paste its ID below. Empty = never loaded.
================================================================ */
(function () {
  'use strict';

  const CONFIG = Object.assign({
    ga4: '',                    // Google Analytics 4 — e.g. 'G-ABC123XYZ9'
    googleAds: '',              // Google Ads — e.g. 'AW-1234567890'
    googleAdsPurchaseLabel: '', // Google Ads conversion label for paid bookings
    metaPixel: '',              // Meta (Facebook/Instagram) Pixel — e.g. '123456789012345'
    tiktokPixel: '',            // TikTok Pixel — e.g. 'C1ABCDEF2GHIJKL3MNOP'
  }, window.CG_TRACKING || {});

  const KEY = 'cg_consent';
  const VERSION = 1;               // bump when you add a new tool, to ask everyone again
  const MAX_AGE = 365 * 86400000;  // 12 months
  const TRACKING_COOKIES = ['_ga', '_gid', '_gat', '_gcl_', '_fbp', '_fbc', '_ttp', '_tt_', 'ttcsid'];

  /* ── Google Consent Mode v2: deny by default, before any tag exists ── */
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', functionality_storage: 'granted', security_storage: 'granted',
    wait_for_update: 500,
  });

  /* ── Stored choice ── */
  function read() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!c || c.v !== VERSION || typeof c.ts !== 'number' || Date.now() - c.ts > MAX_AGE) return null;
      return { analytics: !!c.analytics, marketing: !!c.marketing, ts: c.ts };
    } catch { return null; }
  }
  function write(choice) {
    const c = { v: VERSION, analytics: !!choice.analytics, marketing: !!choice.marketing, ts: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {}
    return c;
  }

  /* ── Loading tags (only after consent) ── */
  const loaded = { google: false, meta: false, tiktok: false };
  function addScript(src) {
    const s = document.createElement('script');
    s.async = true; s.src = src;
    document.head.appendChild(s);
  }
  function loadGoogle(c) {
    const wantGa = c.analytics && CONFIG.ga4;
    const wantAds = c.marketing && CONFIG.googleAds;
    if (!wantGa && !wantAds) return;
    if (!loaded.google) {
      addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(wantGa ? CONFIG.ga4 : CONFIG.googleAds));
      window.gtag('js', new Date());
      loaded.google = true;
    }
    if (wantGa) window.gtag('config', CONFIG.ga4);
    if (wantAds) window.gtag('config', CONFIG.googleAds);
  }
  function loadMeta() {
    if (loaded.meta || !CONFIG.metaPixel) return;
    /* Official Meta Pixel base code */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; (s ? s.parentNode.insertBefore(t, s) : b.head.appendChild(t)); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', CONFIG.metaPixel);
    window.fbq('track', 'PageView');
    loaded.meta = true;
  }
  function loadTikTok() {
    if (loaded.tiktok || !CONFIG.tiktokPixel) return;
    /* Official TikTok Pixel base code */
    !function (w, d, t) { w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent']; ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; }; for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]); ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e; }; ttq.load = function (e, n) { var r = 'https://analytics.tiktok.com/i18n/pixel/events.js'; ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r; ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = n || {}; var s = d.createElement('script'); s.type = 'text/javascript'; s.async = !0; s.src = r + '?sdkid=' + e + '&lib=' + t; var f = d.getElementsByTagName('script')[0]; (f ? f.parentNode.insertBefore(s, f) : d.head.appendChild(s)); }; ttq.load(CONFIG.tiktokPixel); ttq.page(); }(window, document, 'ttq');
    loaded.tiktok = true;
  }

  function apply(c) {
    window.gtag('consent', 'update', {
      analytics_storage: c.analytics ? 'granted' : 'denied',
      ad_storage: c.marketing ? 'granted' : 'denied',
      ad_user_data: c.marketing ? 'granted' : 'denied',
      ad_personalization: c.marketing ? 'granted' : 'denied',
    });
    loadGoogle(c);
    if (c.marketing) { loadMeta(); loadTikTok(); }
  }

  /* Remove tracking cookies on this domain and its parent (used when consent is withdrawn) */
  function deleteTrackingCookies() {
    const host = location.hostname;
    const domains = ['', host, '.' + host];
    const parts = host.split('.');
    if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
    document.cookie.split(';').map((x) => x.split('=')[0].trim()).filter(Boolean).forEach((name) => {
      if (!TRACKING_COOKIES.some((p) => name === p || name.startsWith(p))) return;
      domains.forEach((dm) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${dm ? '; domain=' + dm : ''}`;
      });
    });
  }

  /* ── Conversion events (sent only to tools the visitor agreed to) ──
     Never send personal data (names, emails, free text) to these tools. */
  const EVENTS = {
    search:          { ga: 'search',         meta: 'Search',               tt: 'Search' },
    view_creator:    { ga: 'view_item',      meta: 'ViewContent',          tt: 'ViewContent' },
    lead:            { ga: 'generate_lead',  meta: 'Lead',                 tt: 'SubmitForm' },
    sign_up:         { ga: 'sign_up',        meta: 'CompleteRegistration', tt: 'CompleteRegistration' },
    creator_listed:  { ga: 'creator_listed', metaCustom: 'CreatorListed',  tt: 'CompleteRegistration' },
    begin_checkout:  { ga: 'begin_checkout', meta: 'InitiateCheckout',     tt: 'InitiateCheckout' },
    purchase:        { ga: 'purchase',       meta: 'Purchase',             tt: 'CompletePayment' },
  };
  function track(name, params) {
    const c = read();
    const ev = EVENTS[name];
    if (!c || !ev) return false;
    const p = params || {};
    const money = typeof p.value === 'number' ? { value: Math.round(p.value * 100) / 100, currency: 'EUR' } : {};
    let sent = false;
    if (c.analytics && CONFIG.ga4) {
      window.gtag('event', ev.ga, { ...money, ...(p.id ? { transaction_id: p.id, item_id: p.id } : {}), ...(p.search_term ? { search_term: String(p.search_term).slice(0, 50) } : {}) });
      sent = true;
    }
    if (c.marketing && CONFIG.googleAds && CONFIG.googleAdsPurchaseLabel && name === 'purchase') {
      window.gtag('event', 'conversion', { send_to: `${CONFIG.googleAds}/${CONFIG.googleAdsPurchaseLabel}`, ...money, transaction_id: p.id || '' });
      sent = true;
    }
    if (c.marketing && CONFIG.metaPixel && window.fbq) {
      if (ev.meta) window.fbq('track', ev.meta, money); else window.fbq('trackCustom', ev.metaCustom, money);
      sent = true;
    }
    if (c.marketing && CONFIG.tiktokPixel && window.ttq) {
      window.ttq.track(ev.tt, money);
      sent = true;
    }
    return sent;
  }

  /* ── Banner + settings UI ── */
  const CSS = `
  .cgc-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:99995;max-width:720px;margin:0 auto;background:var(--ink,#211911);color:var(--ink-text,#F6ECDD);border-radius:16px;padding:18px 20px;box-shadow:0 18px 40px rgba(33,25,17,.35);font:inherit;font-size:.86rem;line-height:1.55}
  .cgc-banner h2{font-family:"Fraunces",Georgia,serif;font-weight:400;font-size:1.15rem;margin:0 0 6px;color:inherit}
  .cgc-banner p{margin:0 0 14px;color:var(--ink-text-dim,#B6A68E)}
  .cgc-banner a{color:var(--amber-light,#D97A4C)}
  .cgc-actions{display:flex;gap:10px;flex-wrap:wrap}
  .cgc-btn{flex:1 1 140px;border-radius:10px;padding:11px 16px;font:inherit;font-weight:600;font-size:.86rem;cursor:pointer;border:1px solid transparent}
  .cgc-btn-main{background:var(--amber,#B04722);color:#FFFBF5}
  .cgc-btn-alt{background:transparent;color:inherit;border-color:rgba(246,236,221,.35)}
  .cgc-btn:focus-visible{outline:2px solid var(--amber-light,#D97A4C);outline-offset:2px}
  .cgc-overlay{position:fixed;inset:0;z-index:99996;background:rgba(33,25,17,.55);display:flex;align-items:center;justify-content:center;padding:16px}
  .cgc-panel{background:var(--bg-card,#fff);color:var(--text,#241a10);border-radius:16px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:22px 24px;font-size:.9rem;line-height:1.55}
  .cgc-panel h2{font-family:"Fraunces",Georgia,serif;font-weight:400;font-size:1.4rem;margin:0 0 8px}
  .cgc-cat{border:1px solid var(--border,rgba(36,26,16,.11));border-radius:12px;padding:12px 14px;margin:10px 0}
  .cgc-cat label{display:flex;justify-content:space-between;align-items:center;gap:12px;font-weight:600;cursor:pointer}
  .cgc-cat p{margin:6px 0 0;color:var(--text-muted,#6B5842);font-size:.82rem}
  .cgc-cat input{width:20px;height:20px;accent-color:var(--amber,#B04722)}
  .cgc-panel .cgc-btn-alt{color:var(--text,#241a10);border-color:var(--border-hover,rgba(36,26,16,.22))}
  .cgc-panel .cgc-actions{margin-top:16px}
  .cgc-link{background:none;border:none;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}`;

  let bannerEl = null, overlayEl = null, lastFocus = null;

  function injectCss() {
    if (document.getElementById('cgc-css')) return;
    const st = document.createElement('style');
    st.id = 'cgc-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function decide(choice) {
    const before = read();
    const now = write(choice);
    closeBanner(); closePanel();
    const withdrew = before && ((before.analytics && !now.analytics) || (before.marketing && !now.marketing));
    if (withdrew) {
      // Tags already running can't be unloaded — clean their cookies and reload the page
      deleteTrackingCookies();
      location.reload();
      return;
    }
    apply(now);
    document.dispatchEvent(new CustomEvent('cg:consent', { detail: now }));
  }

  function showBanner() {
    if (bannerEl) return;
    bannerEl = document.createElement('div');
    bannerEl.className = 'cgc-banner';
    bannerEl.id = 'cgcBanner';
    bannerEl.setAttribute('role', 'region');
    bannerEl.setAttribute('aria-label', 'Cookie consent');
    bannerEl.innerHTML = `
      <h2>Cookies on CapturaGo</h2>
      <p>We use necessary storage to keep you signed in. With your permission we'd also like to use analytics cookies to improve CapturaGo and marketing cookies to measure our ads. You can change your choice any time under "Cookie settings". <a href="/privacy.html#storage">Learn more</a></p>
      <div class="cgc-actions">
        <button type="button" class="cgc-btn cgc-btn-alt" data-cgc="reject">Reject all</button>
        <button type="button" class="cgc-btn cgc-btn-alt" data-cgc="customize">Customize</button>
        <button type="button" class="cgc-btn cgc-btn-main" data-cgc="accept">Accept all</button>
      </div>`;
    bannerEl.addEventListener('click', (e) => {
      const a = e.target.closest('[data-cgc]');
      if (!a) return;
      if (a.dataset.cgc === 'accept') decide({ analytics: true, marketing: true });
      if (a.dataset.cgc === 'reject') decide({ analytics: false, marketing: false });
      if (a.dataset.cgc === 'customize') openPanel();
    });
    document.body.appendChild(bannerEl);
    document.body.classList.add('notice-open');
  }
  function closeBanner() {
    if (bannerEl) { bannerEl.remove(); bannerEl = null; }
    document.body.classList.remove('notice-open');
  }

  function openPanel() {
    if (overlayEl) return;
    lastFocus = document.activeElement;
    const c = read() || { analytics: false, marketing: false };
    overlayEl = document.createElement('div');
    overlayEl.className = 'cgc-overlay';
    overlayEl.innerHTML = `
      <div class="cgc-panel" role="dialog" aria-modal="true" aria-labelledby="cgcTitle">
        <h2 id="cgcTitle">Cookie settings</h2>
        <p>Choose which cookies CapturaGo may use. You can change this any time.</p>
        <div class="cgc-cat"><label>Necessary <input type="checkbox" checked disabled /></label>
          <p>Keeps you signed in and remembers this choice. Always on — the site can't work without it.</p></div>
        <div class="cgc-cat"><label for="cgcAnalytics">Analytics <input type="checkbox" id="cgcAnalytics" ${c.analytics ? 'checked' : ''} /></label>
          <p>Helps us understand how visitors use CapturaGo (e.g. Google Analytics), so we can improve it.</p></div>
        <div class="cgc-cat"><label for="cgcMarketing">Marketing <input type="checkbox" id="cgcMarketing" ${c.marketing ? 'checked' : ''} /></label>
          <p>Lets advertising partners (e.g. Google Ads, Meta, TikTok) measure our ads and show you relevant ones.</p></div>
        <div class="cgc-actions">
          <button type="button" class="cgc-btn cgc-btn-alt" data-cgc="reject">Reject all</button>
          <button type="button" class="cgc-btn cgc-btn-alt" data-cgc="save">Save choices</button>
          <button type="button" class="cgc-btn cgc-btn-main" data-cgc="accept">Accept all</button>
        </div>
      </div>`;
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) { closePanel(); return; }
      const a = e.target.closest('[data-cgc]');
      if (!a) return;
      if (a.dataset.cgc === 'accept') decide({ analytics: true, marketing: true });
      if (a.dataset.cgc === 'reject') decide({ analytics: false, marketing: false });
      if (a.dataset.cgc === 'save') decide({ analytics: overlayEl.querySelector('#cgcAnalytics').checked, marketing: overlayEl.querySelector('#cgcMarketing').checked });
    });
    overlayEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
    document.body.appendChild(overlayEl);
    overlayEl.querySelector('#cgcAnalytics').focus();
  }
  function closePanel() {
    if (!overlayEl) return;
    overlayEl.remove(); overlayEl = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* "Cookie settings" links: anything with [data-cookie-settings] or href="#cookie-settings".
     A link is also added automatically to every page footer. */
  function addFooterLink() {
    if (document.querySelector('[data-cookie-settings]')) return;
    const target = document.querySelector('.footer-links') || document.querySelector('footer');
    if (!target) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cgc-link'; b.dataset.cookieSettings = '';
    b.textContent = 'Cookie settings';
    if (target.tagName === 'FOOTER') { const p = document.createElement('p'); p.appendChild(b); target.appendChild(p); }
    else target.appendChild(b);
  }

  function init() {
    injectCss();
    addFooterLink();
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-cookie-settings], a[href="#cookie-settings"]');
      if (t) { e.preventDefault(); openPanel(); }
    });
    const c = read();
    if (c) apply(c); else showBanner();
  }

  window.CGConsent = { get: read, open: openPanel, track, config: CONFIG };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
