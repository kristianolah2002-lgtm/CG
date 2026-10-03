/* ================================================================
   CapturaGo — shared helpers for every page
================================================================ */

/* ── EDIT THIS: your social accounts. Leave "" to hide an icon.
   Only fill these in AFTER you've created the accounts. ── */
window.CG_CONFIG = {
  contactEmail: 'hello@capturago.com',
  /* Must match CLIENT_FEE_PCT / CREATOR_FEE_PCT in your Supabase function secrets */
  clientFeePercent: 10,
  creatorFeePercent: 0,
  /* Must match BOOST_WEEK_CENTS / BOOST_MONTH_CENTS (900 = €9) */
  boostWeekEur: 9,
  boostMonthEur: 24,
  social: {
    instagram: '',   // e.g. 'https://instagram.com/capturago'
    tiktok: '',      // e.g. 'https://tiktok.com/@capturago'
  }
};

(function () {
  /* Escape any text that came from users before putting it in HTML.
     This blocks people from injecting scripts through their listing. */
  window.esc = function (value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* Only allow real web links (blocks javascript: and other tricks). */
  window.safeUrl = function (url) {
    const s = String(url ?? '').trim();
    if (!s) return '';                       // empty/missing — never resolve to the page itself
    try {
      const u = new URL(s, window.location.origin);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch { return ''; }
  };

  /* Toast messages */
  let toastTimer;
  window.showToast = function (msg, type = 'info', duration = 3800) {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = msg;
    el.className = `toast toast-show toast-${type}`;
    toastTimer = setTimeout(() => { el.className = 'toast'; }, duration);
  };

  document.addEventListener('DOMContentLoaded', () => {
    /* Footer year */
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    /* Social icons — only shown when configured */
    const soc = document.getElementById('footerSocial');
    if (soc) {
      const s = window.CG_CONFIG.social;
      const links = [];
      if (safeUrl(s.instagram)) links.push(`<a href="${esc(safeUrl(s.instagram))}" target="_blank" rel="noopener" aria-label="Instagram">Instagram</a>`);
      if (safeUrl(s.tiktok)) links.push(`<a href="${esc(safeUrl(s.tiktok))}" target="_blank" rel="noopener" aria-label="TikTok">TikTok</a>`);
      soc.innerHTML = links.join('');
      soc.hidden = links.length === 0;
    }

    /* Storage notice (informational — we set no tracking cookies) */
    const notice = document.getElementById('cookieNotice');
    let dismissed = false;
    try { dismissed = localStorage.getItem('cg_notice_ok') === '1'; } catch {}
    if (notice && !dismissed) {
      notice.hidden = false;
      document.body.classList.add('notice-open');
      document.getElementById('cookieOk')?.addEventListener('click', () => {
        try { localStorage.setItem('cg_notice_ok', '1'); } catch {}
        notice.hidden = true;
        document.body.classList.remove('notice-open');
      });
    }

  });
})();
