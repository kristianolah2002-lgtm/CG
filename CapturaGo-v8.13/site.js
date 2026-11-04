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
  /* Must match CREATOR_LINK_CLIENT_FEE_PCT: service fee for travellers who book through a creator's own link */
  creatorLinkFeePercent: 5,
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

  /* Cities: "Mexico City, Mexico" → key "mexico city", page slug "mexico-city" (same rules as the database) */
  window.cityKey = function (city) {
    return String(city ?? '').split(',')[0].trim().toLowerCase().replace(/\s+/g, ' ');
  };
  window.citySlug = function (city) {
    return String(city ?? '').split(',')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  };
  /* "Usually replies within …" — the typical answer time the server measured (only with 3+ answers; slow ones get no badge) */
  window.replyLabel = function (p) {
    const m = Number(p && p.reply_minutes);
    if (!p || !Number.isFinite(m) || m <= 0 || Number(p.reply_samples) < 3) return '';
    if (m <= 60) return 'Usually replies within an hour';
    if (m <= 180) return 'Usually replies within a few hours';
    if (m <= 1440) return 'Usually replies within a day';
    return '';
  };
  /* Intro video: a link to YouTube, Instagram, TikTok or Vimeo only (opened on their site, never embedded) */
  const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com', 'vimeo.com'];
  window.introVideoOk = function (u) {
    const s = String(u ?? '').trim();
    if (!s || s.length > 300) return false;
    try { const x = new URL(s); return x.protocol === 'https:' && !x.username && !x.password && VIDEO_HOSTS.some(h => x.hostname === h || x.hostname.endsWith('.' + h)); } catch { return false; }
  };
  /* What a package includes, as short lines (same rules as the database and the app) */
  window.packageFacts = function (k) {
    if (!k) return [];
    const out = [];
    const remote = k.type === 'delivery';
    if (!remote && Number(k.minutes) > 0) out.push(`⏱ ${Number(k.minutes) < 60 ? `${Number(k.minutes)} min` : `${Number(k.minutes) / 60} h`} shoot`);
    if (Number(k.photos) > 0) out.push(`📷 ${Math.round(Number(k.photos))} edited photo${Number(k.photos) === 1 ? '' : 's'}`);
    if (!remote && Number(k.edit_days) > 0) out.push(`📬 Photos within ${Math.round(Number(k.edit_days))} day${Number(k.edit_days) === 1 ? '' : 's'}`);
    if (remote && Number(k.delivery_days) > 0) out.push(`📬 Delivered in ${Math.round(Number(k.delivery_days))} day${Number(k.delivery_days) === 1 ? '' : 's'}`);
    if (remote) out.push(`✏️ ${Math.round(Number(k.revisions) || 0)} revision${Math.round(Number(k.revisions) || 0) === 1 ? '' : 's'}`);
    (Array.isArray(k.includes) ? k.includes : []).filter(x => typeof x === 'string' && x.trim()).slice(0, 6).forEach(x => out.push(`✓ ${x.trim().slice(0, 60)}`));
    return out;
  };
  /* The rules that protect the traveller, shown on every package */
  window.packageRules = function (k) {
    if (k && k.type === 'delivery') return ['Full refund if it isn’t delivered on time', 'Payment released only when you approve'];
    return ['Free cancellation up to 7 days before', 'Bad weather? Move the date for free if you both agree', 'Full refund if the creator cancels or doesn’t show up'];
  };

  /* Quick replies: {name} becomes the other person's first name (plain text — goes into a text box, never HTML) */
  window.fillTemplate = function (body, name) {
    const first = String(name || '').trim().split(/\s+/)[0] || 'there';
    return String(body || '').replace(/\{name\}/gi, first);
  };

  /* 🏅 Founding creator — shown while the listing is still in the city where the spot was given */
  window.isFounding = function (p) {
    return !!(p && p.founding_at && p.founding_city && window.cityKey(p.city) === window.cityKey(p.founding_city));
  };

  /* ── Creators on the road: "I'm in Lisbon 3–10 Nov" (same rules as the database) ── */
  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  window.todayIso = () => isoLocal(new Date());
  const validIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  window.TRIP_MAX = 10;
  window.TRIP_MAX_DAYS = 61;
  /** Trips that haven't ended yet, soonest first */
  window.upcomingTrips = function (trips) {
    const today = window.todayIso();
    return (Array.isArray(trips) ? trips : []).filter(t => t && typeof t.city === 'string' && validIso(t.from) && validIso(t.to) && t.to >= today)
      .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  };
  /** The trip on a day (ISO date), or null when the creator is at home */
  window.tripOn = function (trips, iso) {
    return (Array.isArray(trips) ? trips : []).find(t => t && typeof t.from === 'string' && iso >= t.from && iso <= t.to) || null;
  };
  /** "3–10 Nov", "28 Nov – 2 Dec", "3 Nov" */
  window.tripDates = function (t) {
    if (!t) return '';
    const f = new Date(`${t.from}T12:00:00Z`), e = new Date(`${t.to}T12:00:00Z`);
    const dm = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    if (t.from === t.to) return dm(f);
    if (f.getUTCMonth() === e.getUTCMonth() && f.getUTCFullYear() === e.getUTCFullYear()) return `${f.getUTCDate()}–${dm(e)}`;
    return `${dm(f)} – ${dm(e)}`;
  };
  window.tripCity = (t) => String((t && t.city) || '').split(',')[0].trim();
  /** Does a trip go to the city someone searched for? */
  window.tripMatches = function (t, q) {
    const s = String(q || '').trim().toLowerCase();
    if (!t || s.length < 2) return false;
    return window.cityKey(t.city) === window.cityKey(s) || window.citySlug(t.city) === window.citySlug(s) || String(t.city).toLowerCase().includes(s);
  };
  /** Problems with a list of trips, or '' when the database will accept it */
  window.tripsProblem = function (trips) {
    if (!Array.isArray(trips)) return 'Something went wrong with your trips. Please reload.';
    if (trips.length > window.TRIP_MAX) return `Up to ${window.TRIP_MAX} trips at a time.`;
    const sorted = [...trips].sort((a, b) => (a.from < b.from ? -1 : 1));
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      const city = String(t.city || '');
      if (city.trim().length < 2 || city.length > 80) return 'Enter the city of your trip (e.g. "Lisbon, Portugal").';
      if (/[<>"\n\r]/.test(city)) return 'The city name contains characters we can\'t use.';
      if (!validIso(t.from) || !validIso(t.to)) return 'Choose the first and last day of your trip.';
      if (t.to < t.from) return 'The last day of your trip is before the first day.';
      if ((Date.parse(`${t.to}T00:00:00Z`) - Date.parse(`${t.from}T00:00:00Z`)) / 86400000 > window.TRIP_MAX_DAYS - 1) return `A trip can be up to ${window.TRIP_MAX_DAYS} days.`;
      if (i > 0 && t.from <= sorted[i - 1].to) return `Your trips to ${window.tripCity(sorted[i - 1])} and ${window.tripCity(t)} overlap.`;
    }
    return '';
  };

  /* ── Invite a creator: the code from capturago.com/?invite=CODE is kept until the listing exists, then claimed once ── */
  const INVITE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
  window.inviteLink = (code) => `${location.origin}/?invite=${encodeURIComponent(code)}`;
  window.rememberInvite = function (code) {
    const c = String(code || '').toUpperCase().trim();
    if (!INVITE_RE.test(c)) return false;
    try { localStorage.setItem('cg_invite', JSON.stringify({ code: c, at: Date.now() })); } catch {}
    return true;
  };
  /** After the listing exists: claim the remembered invite (once). Returns the inviter's first name, or ''. */
  window.claimPendingInvite = async function () {
    let v = null;
    try { v = JSON.parse(localStorage.getItem('cg_invite') || 'null'); } catch {}
    if (!v || !INVITE_RE.test(v.code || '') || Date.now() - v.at > 30 * 86400000) { try { localStorage.removeItem('cg_invite'); } catch {} return ''; }
    const { data, error } = await window.CG.invites.claim(v.code);
    if (error && /listing first/i.test(error.message || '')) return '';   // keep it until the listing exists
    try { localStorage.removeItem('cg_invite'); } catch {}
    return error ? '' : String(data || '');
  };

  /* ── Partner link (capturago.com/?p=CODE): remembered for 30 days; the server checks it again at checkout ── */
  window.rememberPartner = function (code, name) {
    const c = String(code || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{4,12}$/.test(c)) return;
    try { localStorage.setItem('cg_partner', JSON.stringify({ code: c, name: String(name || '').slice(0, 100), at: Date.now() })); } catch {}
  };
  window.getPartner = function () {
    try { const v = JSON.parse(localStorage.getItem('cg_partner') || 'null'); return v && /^[A-Z0-9]{4,12}$/.test(v.code) && Date.now() - v.at < 30 * 86400000 ? v : null; } catch { return null; }
  };

  /* ── Shoot requests ── */
  window.REQUEST_SERVICES = [['photo', '📷', 'Photographer'], ['video', '🎥', 'Videographer'], ['phone', '📱', 'Phone content'], ['drone', '🚁', 'Drone'], ['guide', '🗺️', 'Local guide'], ['event', '💍', 'Wedding & event']];
  window.requestService = function (id) { const x = window.REQUEST_SERVICES.find((s) => s[0] === id); return x ? `${x[1]} ${x[2]}` : String(id || ''); };
  /** "12–14 Nov" or "3 Nov" */
  window.requestWhen = function (q) { return window.tripDates({ from: q.date_from, to: q.date_to }); };
  /** "1 h", "1 h 30 min", "45 min" */
  window.minutesText = function (m) { const n = Math.round(Number(m) || 0), h = Math.floor(n / 60), r = n % 60; return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`; };

  /* ── Gift cards and split payments (same rules as the server) ── */
  /** How much of a total a gift card balance pays: everything, or leaves at least €0.50 to pay by card */
  window.giftCover = function (totalCents, balanceCents) {
    const t = Math.max(0, Math.round(Number(totalCents) || 0)), g = Math.max(0, Math.round(Number(balanceCents) || 0));
    if (!t || !g) return 0;
    if (g >= t) return t;
    return t - g < 50 ? Math.max(0, t - 50) : g;
  };
  /** Shares of a split booking: equal, the organiser (share 1) takes the cents that don't divide */
  window.splitShares = function (totalCents, n) {
    const t = Math.round(Number(totalCents) || 0), k = Math.min(Math.max(Math.round(Number(n) || 1), 1), 6);
    const each = Math.floor(t / k);
    return Array.from({ length: k }, (_, i) => (i === 0 ? t - each * (k - 1) : each));
  };
  /** "cg abcd efgh…" → "CG-ABCD-EFGH-JKMN-PQRS", or '' if it can't be a code */
  window.giftCodeNorm = function (v) {
    const x = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^CG[A-HJ-NP-Z2-9]{16}$/.test(x) ? `CG-${x.slice(2, 6)}-${x.slice(6, 10)}-${x.slice(10, 14)}-${x.slice(14, 18)}` : '';
  };
  /** One line about a split booking that is still collecting payments ('' otherwise) */
  window.splitNote = function (b, paidCount) {
    if (!b || Number(b.split_count) <= 1 || b.status !== 'pending_payment' || !b.split_deadline) return '';
    const left = Date.parse(b.split_deadline) - Date.now();
    if (!(left > 0)) return '⏳ The time to pay has run out — everyone who paid is refunded.';
    const mins = Math.max(1, Math.round(left / 60000)), h = Math.floor(mins / 60), m = mins % 60;   // never "60 min"
    const time = h >= 1 ? `${h} h ${m} min` : `${m} min`;
    return `👯 ${paidCount == null ? `Split ${b.split_count} ways` : `${Number(paidCount) || 0} of ${b.split_count} paid`} · ${time} left for everyone to pay`;
  };

  /* ── Last-minute deals (same rounding as the server) ── */
  /** The package price on a deal day, in cents */
  window.dealCents = function (priceEur, pct) { const p = Math.round(Number(pct) || 0); return Math.round((Number(priceEur) * 100 * (100 - (p >= 10 && p <= 50 ? p : 0))) / 100); };
  /** "tomorrow" or "Fri 6 Nov" */
  window.dealDay = function (iso) {
    const t = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return iso === t ? 'tomorrow' : new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  };

  /* ── Small sign-in / create-account card for simple pages (pay a share, buy a gift card) ── */
  const RETURN_RE = /^\/(pay\.html#t=[0-9a-f-]{36}|gift\.html|partners\.html)$/i;
  window.rememberReturn = function (path) { try { if (RETURN_RE.test(path)) localStorage.setItem('cg_return', JSON.stringify({ path, at: Date.now() })); } catch {} };
  /** After signing in (e.g. from the confirmation email): the page the person came from, if recent and safe */
  window.takeReturn = function () {
    try {
      const v = JSON.parse(localStorage.getItem('cg_return') || 'null');
      localStorage.removeItem('cg_return');
      return v && RETURN_RE.test(v.path) && Date.now() - v.at < 2 * 86400000 ? v.path : '';
    } catch { return ''; }
  };
  window.inlineAuth = function (host, { lead = '', returnTo = '', onDone } = {}) {
    let tab = 'signup';
    const draw = () => {
      host.innerHTML = `<div class="inline-auth">
        ${lead ? `<p class="muted">${lead}</p>` : ''}
        <div class="ia-tabs" role="tablist"><button type="button" role="tab" data-t="signup" aria-selected="${tab === 'signup'}">Create account</button><button type="button" role="tab" data-t="signin" aria-selected="${tab === 'signin'}">Sign in</button></div>
        <form class="ia-form" novalidate>
          ${tab === 'signup' ? '<div class="form-row"><label for="iaName">Your name</label><input id="iaName" autocomplete="name" maxlength="80" required /></div>' : ''}
          <div class="form-row"><label for="iaEmail">Email</label><input id="iaEmail" type="email" autocomplete="email" required /></div>
          <div class="form-row"><label for="iaPw">Password</label><input id="iaPw" type="password" autocomplete="${tab === 'signup' ? 'new-password' : 'current-password'}" minlength="8" required /></div>
          ${tab === 'signup' ? '<label class="ia-consent"><input type="checkbox" id="iaConsent" /> <span>I\'m 18+ and accept the <a href="/terms.html" target="_blank">Terms</a> and <a href="/privacy.html" target="_blank">Privacy Policy</a>.</span></label>' : ''}
          <p class="form-note form-error" id="iaError" aria-live="polite"></p>
          <button type="submit" class="primary-btn" style="width:100%">${tab === 'signup' ? 'Create account' : 'Sign in'}</button>
        </form></div>`;
      host.querySelectorAll('.ia-tabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; draw(); }));
      host.querySelector('.ia-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = host.querySelector('#iaError'), btn = e.target.querySelector('button[type=submit]');
        const email = host.querySelector('#iaEmail').value.trim(), pw = host.querySelector('#iaPw').value;
        const say = (t) => { err.textContent = t; };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('Please enter your email.');
        if (pw.length < 8) return say('The password needs at least 8 characters.');
        btn.disabled = true;
        if (tab === 'signin') {
          const { error } = await window.CG.auth.signIn(email, pw);
          btn.disabled = false;
          if (error) return say(/invalid/i.test(error.message) ? 'Wrong email or password.' : /confirm/i.test(error.message) ? 'Please confirm your email first (check your inbox).' : error.message);
          return onDone && onDone();
        }
        const name = host.querySelector('#iaName').value.trim();
        if (!name) { btn.disabled = false; return say('Please enter your name.'); }
        if (!host.querySelector('#iaConsent').checked) { btn.disabled = false; return say('Please confirm you are 18+ and accept the Terms and Privacy Policy.'); }
        if (returnTo) window.rememberReturn(returnTo);
        const { data, error } = await window.CG.auth.signUp(email, pw, name);
        btn.disabled = false;
        if (error) return say(/registered|already/i.test(error.message) ? 'This email already has an account — sign in instead.' : error.message);
        if (data && data.session) { window.takeReturn(); return onDone && onDone(); }
        host.innerHTML = `<div class="inline-auth"><p><strong>Almost done!</strong> We sent a confirmation link to <strong>${window.esc(email)}</strong>. Open it on this device and you'll come right back here. (Check spam if you don't see it.)</p></div>`;
      });
    };
    draw();
  };

  /* ── Payment held until the photos arrive (packages that promise photos "within N days") ── */
  window.photosPromised = function (b) {
    if (!b || b.booking_type === 'delivery') return false;
    if (typeof b.photos_promised === 'boolean') return b.photos_promised;
    const d = Math.round(Number(b.package_details && b.package_details.edit_days));
    return d >= 1 && d <= 60;
  };
  /** One line about the held payment on a booking card ('' when it doesn't apply) */
  window.payoutNote = function (b, asCreator) {
    if (!window.photosPromised(b) || !['paid', 'confirmed'].includes(b.status)) return '';
    const day = 86400000, shoot = Date.parse(`${b.shoot_date}T00:00:00Z`);
    const due = new Date(shoot + Math.round(Number(b.package_details && b.package_details.edit_days) || 0) * day);
    const nice = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const sent = b.photos_delivered_at ? Date.parse(b.photos_delivered_at) : NaN;
    const who = String((b.photographers && b.photographers.name) || 'the creator').split(' ')[0];
    if (!Number.isFinite(sent)) {
      return asCreator
        ? `💶 Paid out 3 days after you send the photos${b.package_details && b.package_details.edit_days ? ` (promised by ${nice(due)})` : ''}.`
        : `🔒 Your payment stays on hold until your photos arrive${b.package_details && b.package_details.edit_days ? ` (promised by ${nice(due)})` : ''}.`;
    }
    const release = new Date(Math.max(shoot + 3 * day, sent + 3 * day));
    return asCreator ? `💶 Payout on ${nice(release)} — 3 days after you sent the photos.` : `🔒 Photos received. The payment goes to ${who} on ${nice(release)} unless you report a problem.`;
  };

  /* ── Calendar sync: only these calendar links are read (same list as the server and database) ── */
  window.calendarUrlOk = function (raw) {
    let s = String(raw || '').trim();
    if (/^webcal:\/\//i.test(s)) s = 'https://' + s.slice(9);
    if (s.length < 20 || s.length > 1000 || /[\s<>"\\]/.test(s)) return false;
    let u; try { u = new URL(s); } catch { return false; }
    return u.protocol === 'https:' && !u.username && !u.password && !u.port
      && /^(calendar\.google\.com|([a-z0-9-]+\.)*icloud\.com|outlook\.live\.com|outlook\.office365\.com|outlook\.office\.com|calendar\.proton\.me|user\.fm)$/i.test(u.hostname)
      && s.toLowerCase().startsWith(`https://${u.hostname.toLowerCase()}/`);
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

  /* ── Shared helpers for galleries, photo delivery and booking (v8.6) ── */
  window.CG_TIME_SLOTS = [
    ['sunrise', 'Sunrise'], ['morning', 'Morning'], ['midday', 'Midday'], ['afternoon', 'Afternoon'],
    ['golden_hour', 'Golden hour'], ['evening', 'Evening'], ['flexible', 'Flexible']
  ];
  window.timeSlotLabel = (k) => (window.CG_TIME_SLOTS.find(([id]) => id === k) || [, ''])[1];

  /** Resize any photo to a JPEG (keeps orientation). Returns { blob, w, h } or throws a friendly Error. */
  window.resizeImage = async function (file, maxSide = 2000, quality = 0.85) {
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      src = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`“${file.name}” can't be opened. Please use JPG, PNG or WebP.`));
        img.src = URL.createObjectURL(file);
      });
    }
    const w0 = src.width, h0 = src.height;
    if (!w0 || !h0) throw new Error(`“${file.name}” can't be opened.`);
    const scale = Math.min(1, maxSide / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    if (src.close) src.close();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error(`“${file.name}” can't be converted.`);
    return { blob, w, h };
  };

  window.downloadBlob = function (blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  /** Full-screen photo viewer. items: [{ src, caption?, favorite? }].
   *  opts: { onFavorite(i, on), onDownload(i), onReport(i), slideshow: bool (play button), autoplay: bool, onClose } */
  window.openLightbox = function (items, start = 0, opts = {}) {
    if (!items || !items.length) return;
    let i = Math.min(Math.max(start, 0), items.length - 1);
    const prevFocus = document.activeElement;
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Photo viewer');
    box.innerHTML = `
      <div class="lb-top">
        <span class="lb-count" aria-live="polite"></span>
        <div class="lb-tools">
          ${opts.slideshow && items.length > 1 ? '<button class="lb-btn lb-play" aria-label="Play slideshow">▶</button>' : ''}
          ${opts.onFavorite ? '<button class="lb-btn lb-fav" aria-label="Favourite">♡</button>' : ''}
          ${opts.onDownload ? '<button class="lb-btn lb-dl" aria-label="Download">↓</button>' : ''}
          ${opts.onReport ? '<button class="lb-btn lb-report" aria-label="Report this photo" title="Report this photo">⚑</button>' : ''}
          <button class="lb-btn lb-close" aria-label="Close">✕</button>
        </div>
      </div>
      <button class="lb-nav lb-prev" aria-label="Previous photo">‹</button>
      <figure class="lb-stage"><img alt="" /><figcaption></figcaption></figure>
      <button class="lb-nav lb-next" aria-label="Next photo">›</button>`;
    document.body.appendChild(box);
    document.body.style.overflow = 'hidden';
    const img = box.querySelector('img'), cap = box.querySelector('figcaption'), count = box.querySelector('.lb-count');
    const paint = () => {
      const it = items[i];
      img.classList.remove('lb-in'); void img.offsetWidth; img.classList.add('lb-in');
      img.src = it.src; img.alt = it.caption || `Photo ${i + 1}`;
      cap.textContent = it.caption || ''; cap.hidden = !it.caption;
      count.textContent = `${i + 1} / ${items.length}`;
      box.querySelector('.lb-prev').hidden = items.length < 2; box.querySelector('.lb-next').hidden = items.length < 2;
      const fav = box.querySelector('.lb-fav'); if (fav) { fav.textContent = it.favorite ? '♥' : '♡'; fav.classList.toggle('on', !!it.favorite); fav.setAttribute('aria-pressed', it.favorite ? 'true' : 'false'); }
      [items[i + 1], items[i - 1]].forEach((n) => { if (n) { const pre = new Image(); pre.src = n.src; } });
    };
    let timer = null;
    const playBtn = box.querySelector('.lb-play');
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } if (playBtn) { playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play slideshow'); } box.classList.remove('lb-playing'); };
    const play = () => {
      if (items.length < 2) return;
      stop();
      timer = setInterval(() => { i = (i + 1) % items.length; paint(); }, 3500);
      if (playBtn) { playBtn.textContent = '❚❚'; playBtn.setAttribute('aria-label', 'Pause slideshow'); }
      box.classList.add('lb-playing');
    };
    const go = (d) => { stop(); i = (i + d + items.length) % items.length; paint(); };
    const close = () => { stop(); document.removeEventListener('keydown', onKey); box.remove(); document.body.style.overflow = ''; if (prevFocus && prevFocus.focus && prevFocus.isConnected) prevFocus.focus(); if (opts.onClose) opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === ' ' && playBtn) { e.preventDefault(); if (timer) stop(); else play(); } };
    document.addEventListener('keydown', onKey);
    box.querySelector('.lb-close').addEventListener('click', close);
    box.querySelector('.lb-prev').addEventListener('click', () => go(-1));
    box.querySelector('.lb-next').addEventListener('click', () => go(1));
    box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('lb-stage')) close(); });
    box.querySelector('.lb-fav')?.addEventListener('click', async () => { const it = items[i]; it.favorite = !it.favorite; paint(); if (await opts.onFavorite(i, it.favorite) === false) { it.favorite = !it.favorite; paint(); } });
    box.querySelector('.lb-dl')?.addEventListener('click', () => opts.onDownload(i));
    box.querySelector('.lb-report')?.addEventListener('click', () => { const at = i; close(); opts.onReport(at); });
    playBtn?.addEventListener('click', () => { if (timer) stop(); else play(); });
    let x0 = null;
    box.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); x0 = null; });
    paint();
    box.querySelector('.lb-close').focus();
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (opts.autoplay && !reduced) play();
    return { close };
  };

  /* ── Weather for an upcoming shoot (Open-Meteo, free, no key; forecasts up to 16 days ahead) ── */
  const WEATHER = [[0, '☀️', 'Clear'], [1, '🌤️', 'Mostly clear'], [2, '⛅', 'Partly cloudy'], [3, '☁️', 'Cloudy'], [45, '🌫️', 'Fog'], [48, '🌫️', 'Fog'],
    [51, '🌦️', 'Drizzle'], [53, '🌦️', 'Drizzle'], [55, '🌦️', 'Drizzle'], [56, '🌧️', 'Freezing drizzle'], [57, '🌧️', 'Freezing drizzle'],
    [61, '🌧️', 'Rain'], [63, '🌧️', 'Rain'], [65, '🌧️', 'Heavy rain'], [66, '🌧️', 'Freezing rain'], [67, '🌧️', 'Freezing rain'],
    [71, '🌨️', 'Snow'], [73, '🌨️', 'Snow'], [75, '❄️', 'Heavy snow'], [77, '🌨️', 'Snow'], [80, '🌦️', 'Showers'], [81, '🌧️', 'Showers'], [82, '⛈️', 'Heavy showers'],
    [85, '🌨️', 'Snow showers'], [86, '🌨️', 'Snow showers'], [95, '⛈️', 'Thunderstorm'], [96, '⛈️', 'Thunderstorm'], [99, '⛈️', 'Thunderstorm']];
  /** Returns { icon, text, max, min, rain, bad } or null (no coordinates, too far ahead, offline). */
  window.getForecast = async function (coords, isoDate) {
    const lat = Number(coords && coords.lat), lon = Number(coords && coords.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate))) return null;
    const days = Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 86400000);
    if (days < 0 || days > 15) return null;
    const key = `cg_wx_${lat.toFixed(2)}_${lon.toFixed(2)}_${isoDate}`;
    try { const c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && Date.now() - c.at < 3 * 3600000) return c.v; } catch {}
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${isoDate}&end_date=${isoDate}`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const d = (await r.json()).daily || {};
      const code = Number(d.weather_code && d.weather_code[0]);
      if (!Number.isFinite(code)) return null;
      const w = WEATHER.find(([c]) => c === code) || [code, '🌡️', 'Forecast'];
      const rain = Number(d.precipitation_probability_max && d.precipitation_probability_max[0]);
      const v = { icon: w[1], text: w[2], max: Math.round(d.temperature_2m_max[0]), min: Math.round(d.temperature_2m_min[0]), rain: Number.isFinite(rain) ? rain : null, bad: code >= 61 || (Number.isFinite(rain) && rain >= 70) };
      try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), v })); } catch {}
      return v;
    } catch { return null; }
  };

  /** Month calendar. opts: { min, max (YYYY-MM-DD), isOff(iso) → bool, selected: Set, onPick(iso), multi: bool } */
  window.renderCalendar = function (el, opts) {
    const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, i, 15)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }));   // in the page's language (i18n.js)
    const startIso = opts.start || opts.min;
    let y = +startIso.slice(0, 4), m = +startIso.slice(5, 7) - 1;
    const pad = (n) => String(n).padStart(2, '0');
    const todayIso = window.todayIso ? window.todayIso() : new Date().toISOString().slice(0, 10);
    function draw() {
      const first = new Date(Date.UTC(y, m, 1));
      const lead = (first.getUTCDay() + 6) % 7;
      const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const key = `${y}-${pad(m + 1)}`;
      const canPrev = key > opts.min.slice(0, 7), canNext = key < opts.max.slice(0, 7);
      let cells = '';
      for (let k = 0; k < lead; k++) cells += '<span class="cal-cell"></span>';
      for (let d = 1; d <= count; d++) {
        const iso = `${key}-${pad(d)}`;
        const out = iso < opts.min || iso > opts.max;
        const off = !out && opts.isOff && opts.isOff(iso);
        const on = opts.selected && opts.selected.has(iso);
        const disabled = out || (off && !opts.multi);
        const extra = !out && opts.dayClass ? String(opts.dayClass(iso) || '').replace(/[^a-z -]/g, '') : '';   // e.g. "trip", "ext"
        const note = !out && opts.dayLabel ? String(opts.dayLabel(iso) || '') : '';
        cells += `<button type="button" class="cal-cell cal-day${on ? ' on' : ''}${off ? ' off' : ''}${iso === todayIso ? ' today' : ''}${extra ? ' ' + extra : ''}" data-iso="${iso}" ${disabled ? 'disabled' : ''} aria-pressed="${on ? 'true' : 'false'}" aria-label="${d} ${MONTHS[m]}${off && !opts.multi ? ' — not available' : ''}${note ? ' — ' + esc(note) : ''}"${note ? ` title="${esc(note)}"` : ''}>${d}</button>`;
      }
      el.innerHTML = `
        <div class="cal-head">
          <button type="button" class="cal-nav" data-d="-1" ${canPrev ? '' : 'disabled'} aria-label="Previous month">‹</button>
          <strong>${MONTHS[m]} ${y}</strong>
          <button type="button" class="cal-nav" data-d="1" ${canNext ? '' : 'disabled'} aria-label="Next month">›</button>
        </div>
        <div class="cal-grid">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w) => `<span class="cal-wd">${w}</span>`).join('')}${cells}</div>`;
      el.querySelectorAll('.cal-nav').forEach((b) => b.addEventListener('click', () => { const d = new Date(Date.UTC(y, m + +b.dataset.d, 1)); y = d.getUTCFullYear(); m = d.getUTCMonth(); draw(); }));
      el.querySelectorAll('.cal-day:not([disabled])').forEach((b) => b.addEventListener('click', () => { opts.onPick(b.dataset.iso); draw(); }));
    }
    draw();
    return { redraw: draw };
  };

  /* ── Date range picker: one field ("Wed 25 Nov → Sat 28 Nov") that opens a large two-month calendar
     (one month on phones, as a sheet from the bottom). Writes YYYY-MM-DD into the two hidden inputs. ── */
  const MONTHS_LONG = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, i, 15)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }));   // in the page's language (i18n.js)
  const niceIso = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  window.createDateRange = function (host, opts) {
    const fromIn = document.getElementById(opts.fromId), toIn = document.getElementById(opts.toId);
    const id = host.id || ('dr' + Math.random().toString(36).slice(2, 7));
    let from = fromIn.value || '', to = toIn.value || '', hover = '', open = false;
    let view = (from || opts.min()).slice(0, 7);
    host.classList.add('dr');
    host.innerHTML = `
      <button type="button" class="dr-field" id="${id}Btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="${id}Pop">
        <span class="dr-ico" aria-hidden="true">📅</span><span class="dr-text"></span><span class="dr-caret" aria-hidden="true">▾</span></button>
      <div class="dr-backdrop" hidden></div>
      <div class="dr-pop" id="${id}Pop" role="dialog" aria-modal="false" aria-label="${esc(opts.label || 'Choose dates')}" hidden>
        <div class="dr-top"><strong class="dr-title"></strong><button type="button" class="dr-x" aria-label="Close">✕</button></div>
        <div class="dr-nav"><button type="button" class="cal-nav dr-prev" aria-label="Previous month">‹</button><button type="button" class="cal-nav dr-next" aria-label="Next month">›</button></div>
        <div class="dr-months"></div>
        <div class="dr-foot"><span class="dr-sum" aria-live="polite"></span><span class="dr-actions"><button type="button" class="link-btn dr-clear">Clear</button><button type="button" class="primary-btn dr-done">Done</button></span></div>
      </div>`;
    const btn = host.querySelector('.dr-field'), pop = host.querySelector('.dr-pop'), back = host.querySelector('.dr-backdrop');
    // The calendar lives at the top of the page (not inside cards that animate or lay out buttons in a grid)
    document.querySelectorAll(`[data-dr-for="${id}"]`).forEach((x) => x.remove());   // left over from an earlier render
    back.dataset.drFor = id; pop.dataset.drFor = id;
    document.body.appendChild(back); document.body.appendChild(pop);
    const inside = (t) => host.contains(t) || pop.contains(t);
    const months = pop.querySelector('.dr-months');
    const pad = (n) => String(n).padStart(2, '0');
    const shift = (ym, n) => { const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
    const many = () => (window.innerWidth >= 760 ? 2 : 1);
    const paintField = () => {
      host.querySelector('.dr-text').textContent = from ? (to && to !== from ? `${niceIso(from)} → ${niceIso(to)}` : niceIso(from)) : (opts.placeholder || 'Add dates');
      btn.classList.toggle('dr-empty', !from);
    };
    const write = () => { fromIn.value = from; toIn.value = to || from; paintField(); if (opts.onChange) opts.onChange(from, to || from); };
    function monthHtml(ym) {
      const y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
      const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const min = opts.min(), max = opts.max(), today = window.todayIso();
      const end = to || (from && hover && hover > from ? hover : '');
      let cells = '';
      for (let k = 0; k < lead; k++) cells += '<span class="cal-cell"></span>';
      for (let d = 1; d <= count; d++) {
        const iso = `${ym}-${pad(d)}`, out = iso < min || iso > max;
        const cls = ['cal-cell', 'cal-day'];
        if (iso === today) cls.push('today');
        if (from && iso === from) cls.push('range-start', 'on');
        if (end && iso === end) cls.push('range-end', 'on');
        if (from && end && iso > from && iso < end) cls.push('in-range');
        cells += `<button type="button" class="${cls.join(' ')}" data-iso="${iso}" ${out ? 'disabled' : ''} aria-pressed="${from === iso || end === iso ? 'true' : 'false'}" aria-label="${d} ${MONTHS_LONG[m]} ${y}">${d}</button>`;
      }
      return `<div class="dr-month"><div class="dr-mtitle">${MONTHS_LONG[m]} ${y}</div><div class="cal-grid">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w) => `<span class="cal-wd">${w}</span>`).join('')}${cells}</div></div>`;
    }
    function draw() {
      const n = many(), min = opts.min().slice(0, 7), max = opts.max().slice(0, 7);
      if (view < min) view = min;
      if (shift(view, n - 1) > max) view = shift(max, -(n - 1)) < min ? min : shift(max, -(n - 1));
      months.innerHTML = Array.from({ length: n }, (_, i) => monthHtml(shift(view, i))).join('');
      pop.querySelector('.dr-prev').disabled = view <= min;
      pop.querySelector('.dr-next').disabled = shift(view, n - 1) >= max;
      pop.querySelector('.dr-title').textContent = !from ? (opts.firstHint || 'Choose the first day') : !to ? (opts.secondHint || 'Now choose the last day') : 'Your dates';
      pop.querySelector('.dr-sum').textContent = from ? (to && to !== from ? `${niceIso(from)} → ${niceIso(to)} · ${Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1} days` : `${niceIso(from)}`) : '';
      months.querySelectorAll('.cal-day:not([disabled])').forEach((b) => {
        b.addEventListener('click', () => pick(b.dataset.iso));
        b.addEventListener('mouseenter', () => { if (from && !to && hover !== b.dataset.iso) { hover = b.dataset.iso; paintHover(); } });
      });
    }
    function paintHover() {   // live preview of the range without re-rendering
      const end = from && hover && hover > from ? hover : '';
      months.querySelectorAll('.cal-day').forEach((b) => {
        const iso = b.dataset.iso;
        b.classList.toggle('in-range', !!(end && iso > from && iso < end));
        b.classList.toggle('range-end', !!(end && iso === end));
      });
    }
    function pick(iso) {
      if (!from || to) { from = iso; to = ''; }
      else if (iso < from) from = iso;
      else if (opts.maxDays && (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1 > opts.maxDays) {
        window.showToast(`Choose up to ${opts.maxDays} days at a time.`, 'info'); return;
      } else to = iso;
      hover = '';
      write(); draw();
      if (to && opts.closeOnRange !== false) setTimeout(close, 180);
    }
    function place() {   // under the field on desktop (kept inside the window); a sheet from the bottom on phones
      pop.style.left = ''; pop.style.top = '';
      if (window.innerWidth < 760) return;
      const f = btn.getBoundingClientRect();
      const w = pop.offsetWidth;
      const left = Math.max(16, Math.min(f.left, window.innerWidth - 16 - w));
      pop.style.left = `${Math.round(left + window.scrollX)}px`;
      pop.style.top = `${Math.round(f.bottom + 10 + window.scrollY)}px`;
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    function onDoc(e) { if (open && !inside(e.target)) close(); }
    function openPop() {
      if (open) return;
      open = true; view = (from || opts.min()).slice(0, 7);
      pop.hidden = false; back.hidden = false; btn.setAttribute('aria-expanded', 'true'); host.classList.add('dr-open');
      draw();
      place();
      setTimeout(() => { document.addEventListener('mousedown', onDoc); document.addEventListener('touchstart', onDoc, { passive: true }); }, 0);
      pop.addEventListener('keydown', onKey);
      (months.querySelector('.cal-day.on:not([disabled])') || months.querySelector('.cal-day:not([disabled])'))?.focus({ preventScroll: true });
    }
    function close() {
      if (!open) return;
      open = false;
      if (from && !to) { to = from; write(); }
      pop.hidden = true; back.hidden = true; btn.setAttribute('aria-expanded', 'false'); host.classList.remove('dr-open');
      document.removeEventListener('mousedown', onDoc); document.removeEventListener('touchstart', onDoc);
      pop.removeEventListener('keydown', onKey);
      btn.focus({ preventScroll: true });
    }
    btn.addEventListener('click', () => (open ? close() : openPop()));
    back.addEventListener('click', close);
    pop.querySelector('.dr-x').addEventListener('click', close);
    pop.querySelector('.dr-done').addEventListener('click', close);
    pop.querySelector('.dr-clear').addEventListener('click', () => { from = ''; to = ''; hover = ''; write(); draw(); });
    pop.querySelector('.dr-prev').addEventListener('click', () => { view = shift(view, -1); draw(); });
    pop.querySelector('.dr-next').addEventListener('click', () => { view = shift(view, 1); draw(); });
    window.addEventListener('resize', () => { if (open) { draw(); place(); } });
    paintField();
    return {
      set(f, t) { from = f || ''; to = f ? (t && t >= f ? t : f) : ''; write(); if (open) draw(); },
      get: () => ({ from, to: to || from }),
      open: openPop, close,
    };
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


  });
})();
