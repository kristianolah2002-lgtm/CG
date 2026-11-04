// ── CapturaGo server helpers (inlined into every function by build.py) ──
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Only allow https links (files, deliveries) — never javascript: or http:
function cleanHttpsUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (v.length > 500) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Stripe expects nested form encoding: a[b][0][c]=1
function formEncode(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') formEncode(item, `${key}[${i}]`, out);
        else out.append(`${key}[${i}]`, String(item));
      });
    } else if (typeof v === 'object') {
      formEncode(v, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

function makeCtx(deps) {
  const env = (k, d) => {
    const v = deps.env(k);
    return v === undefined || v === null || v === '' ? d : v;
  };
  const nowMs = () => (deps.now ? deps.now() : Date.now());
  const SUPABASE_URL = String(env('SUPABASE_URL', '')).replace(/\/$/, '');
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY', '');

  async function db(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
    const r = await deps.fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: prefer,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      const msg = (data && data.message) || text || `status ${r.status}`;
      const err = new Error(`Database error: ${msg}`);
      err.code = data && data.code;
      throw err;
    }
    return data;
  }

  async function getUser(req) {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in first.');
    const r = await deps.fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: env('SUPABASE_ANON_KEY', SERVICE_KEY) },
    });
    if (!r.ok) throw new HttpError(401, 'Your session expired. Please sign in again.');
    const u = await r.json();
    if (!u || !u.id || !u.email) throw new HttpError(401, 'Your session expired. Please sign in again.');
    return u;
  }

  async function stripe(path, params, { method = 'POST', idempotencyKey } = {}) {
    const key = env('STRIPE_SECRET_KEY', '');
    if (!key) throw new HttpError(503, 'Online payments are not set up yet.');
    const headers = { Authorization: `Bearer ${key}` };
    let body;
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = formEncode(params || {}).toString();
    }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const r = await deps.fetch(`https://api.stripe.com/v1/${path}`, { method, headers, body });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || `Stripe error ${r.status}`;
      console.error('[stripe]', path, msg);
      throw new HttpError(502, `Payment provider error: ${msg}`);
    }
    return data;
  }

  // Whole days between today (UTC) and an ISO date (YYYY-MM-DD)
  function daysUntil(isoDate) {
    const today = new Date(nowMs()).toISOString().slice(0, 10);
    return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  }

  // ISO date (YYYY-MM-DD) n days from today (UTC)
  function isoInDays(n) {
    return new Date(nowMs() + n * 86400000).toISOString().slice(0, 10);
  }

  function pct(name, def) {
    const n = Number(env(name, def));
    return Number.isFinite(n) && n >= 0 && n <= 30 ? n : def;
  }

  return {
    env, db, getUser, stripe, daysUntil, isoInDays, pct, nowMs,
    siteUrl: String(env('SITE_URL', 'https://capturago.com')).replace(/\/$/, ''),
  };
}

async function readJson(req) {
  try { return (await req.json()) || {}; }
  catch { throw new HttpError(400, 'Invalid request.'); }
}

function wrap(fn) {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error('[unhandled]', e);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}

async function sendEmail(ctx, deps, to, subject, html) {
  const key = ctx.env('RESEND_API_KEY', '');
  if (!key || !to) return false;
  try {
    const r = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: ctx.env('EMAIL_FROM', 'CapturaGo <noreply@capturago.com>'), to, subject, html }),
    });
    return r.ok;
  } catch (e) {
    console.error('[email]', e);
    return false;
  }
}

/* ── Text messages (SMS / WhatsApp) through Twilio — keys only in Supabase secrets ──
   SMS: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID).
   WhatsApp (optional): TWILIO_WHATSAPP_FROM and an approved template TWILIO_WHATSAPP_TEMPLATE_SID
   (optional per language: TWILIO_WHATSAPP_TEMPLATE_SID_DE / _ES / _FR). Without WhatsApp, texts go by SMS. */
const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;
/** "+421 900 123 456", "00421900123456" → "+421900123456"; anything else → '' */
function normPhone(raw) {
  let s = String(raw || '').trim().replace(/[\s().\-\/]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  return PHONE_RE.test(s) ? s : '';
}
function maskPhone(p) { const s = String(p || ''); return s.length > 6 ? `${s.slice(0, 4)} ••• ${s.slice(-3)}` : s; }
function textsConfigured(ctx) {
  return !!(ctx.env('TWILIO_ACCOUNT_SID', '') && ctx.env('TWILIO_AUTH_TOKEN', '') && (ctx.env('TWILIO_FROM', '') || ctx.env('TWILIO_MESSAGING_SERVICE_SID', '')));
}
/** Sends one text. WhatsApp only with an approved template (wa = its variables); otherwise SMS. true = accepted by Twilio. */
async function sendText(ctx, deps, to, channel, body, wa, lang) {
  const sid = ctx.env('TWILIO_ACCOUNT_SID', ''), tok = ctx.env('TWILIO_AUTH_TOKEN', '');
  if (!sid || !tok || !PHONE_RE.test(String(to || ''))) return false;
  const params = new URLSearchParams();
  const waFrom = ctx.env('TWILIO_WHATSAPP_FROM', '');
  const waTpl = ctx.env(`TWILIO_WHATSAPP_TEMPLATE_SID_${String(lang || '').toUpperCase()}`, '') || ctx.env('TWILIO_WHATSAPP_TEMPLATE_SID', '');
  if (channel === 'whatsapp' && wa && waFrom && waTpl) {
    params.set('To', `whatsapp:${to}`);
    params.set('From', `whatsapp:${waFrom.replace(/^whatsapp:/, '')}`);
    params.set('ContentSid', waTpl);
    params.set('ContentVariables', JSON.stringify(wa));
  } else {
    const ms = ctx.env('TWILIO_MESSAGING_SERVICE_SID', ''), from = ctx.env('TWILIO_FROM', '');
    if (!ms && !from) return false;
    params.set('To', to);
    if (ms) params.set('MessagingServiceSid', ms); else params.set('From', from);
    params.set('Body', String(body).slice(0, 600));
  }
  try {
    const r = await deps.fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${sid}:${tok}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!r.ok) console.error('[text]', r.status, (await r.text().catch(() => '')).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error('[text]', e);
    return false;
  }
}

/* ── Weather-aware reminders: heavy rain on a shoot day (Open-Meteo, free, no key) ──
   Heavy = a heavy-rain / violent-shower / thunderstorm forecast, or lots of rain that is very likely.
   Light drizzle or a "40 % chance" is not heavy — many shoots go ahead in that. */
const HEAVY_RAIN_CODES = [65, 67, 82, 95, 96, 99];   // heavy rain, heavy freezing rain, violent showers, thunderstorms
function isHeavyRain(code, pct, mm) {
  const c = Number(code), p = Number(pct), m = Number(mm);
  if (HEAVY_RAIN_CODES.includes(c)) return true;
  if ((c === 63 || c === 81) && Number.isFinite(p) && p >= 70) return true;   // moderate rain / showers, very likely
  return Number.isFinite(m) && m >= 10 && Number.isFinite(p) && p >= 60;      // 10 mm+ of rain, likely
}
/** { heavy, pct, mm } for a place and day (0–15 days ahead), or null when unknown. Cached per run; never throws. */
async function rainForecast(ctx, deps, coords, isoDate) {
  const lat = Number(coords && coords.lat), lon = Number(coords && coords.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) return null;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${isoDate}`;
  if (!ctx._wx) ctx._wx = new Map();
  if (ctx._wx.has(key)) return ctx._wx.get(key);
  let out = null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&daily=weather_code,precipitation_probability_max,precipitation_sum&timezone=auto&start_date=${isoDate}&end_date=${isoDate}`;
    const r = await Promise.race([deps.fetch(url), new Promise((_, no) => setTimeout(() => no(new Error('weather timeout')), 6000))]);
    if (r && r.ok) {
      const d = ((await r.json()) || {}).daily || {};
      const code = Number(d.weather_code && d.weather_code[0]);
      const pct = Number(d.precipitation_probability_max && d.precipitation_probability_max[0]);
      const mm = Number(d.precipitation_sum && d.precipitation_sum[0]);
      if (Number.isFinite(code)) out = { heavy: isHeavyRain(code, pct, mm), pct: Number.isFinite(pct) ? Math.round(pct) : null, mm: Number.isFinite(mm) ? Math.round(mm) : null };
    }
  } catch (e) { console.error('[weather]', e && e.message ? e.message : e); }
  ctx._wx.set(key, out);
  return out;
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** The package as the traveller saw it when paying — kept with the booking (fair for problems and refunds). */
function packageSnapshot(pkg) {
  const num = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined; };
  const out = {
    name: String(pkg.name || 'Shoot').slice(0, 60),
    price_eur: Number(pkg.price_eur),
    type: pkg.type === 'delivery' ? 'delivery' : 'session',
    minutes: num(pkg.minutes, 1, 1440),
    photos: num(pkg.photos, 1, 2000),
    edit_days: pkg.type === 'delivery' ? undefined : num(pkg.edit_days, 1, 60),
    delivery_days: pkg.type === 'delivery' ? num(pkg.delivery_days, 1, 30) : undefined,
    revisions: pkg.type === 'delivery' ? num(pkg.revisions, 0, 5) : undefined,
    includes: (Array.isArray(pkg.includes) ? pkg.includes : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 6).map((x) => x.trim().slice(0, 60)),
    desc: pkg.desc ? String(pkg.desc).slice(0, 200) : undefined,
  };
  if (!out.includes.length) delete out.includes;
  return JSON.parse(JSON.stringify(out));   // drops the undefined fields
}

/** "Mexico City, Mexico" → "mexico-city" — the city page at /in/<slug> */
function citySlug(city) {
  return String(city || '').split(',')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function euro(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}

function startServer(createHandler) {
  if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
    Deno.serve(createHandler({ env: (k) => Deno.env.get(k), fetch: (...a) => fetch(...a) }));
  }
}

// ── Shared booking money movements (used by booking-action, scheduled-jobs and admin) ──
// Idempotency keys make retries and races safe: Stripe executes each at most once.
/** Gives all the money of a booking back: the card payment (or every friend's share of a split booking)
 *  and the gift card part (back onto the card it came from). Returns a refund id for the record (or 'gift'). */
async function refundBooking(ctx, b) {
  let refundId = null;
  if (Number(b.split_count) > 1) {
    const shares = await ctx.db(`booking_shares?booking_id=eq.${b.id}&status=eq.paid&select=id,stripe_payment_intent_id`);
    for (const s of shares || []) {
      if (!s.stripe_payment_intent_id) continue;
      const r = await ctx.stripe('refunds', { payment_intent: s.stripe_payment_intent_id, metadata: { booking_id: b.id, share_id: s.id } }, { idempotencyKey: `refund-share-${s.id}` });
      await ctx.db(`booking_shares?id=eq.${s.id}&status=eq.paid`, { method: 'PATCH', body: { status: 'refunded', stripe_refund_id: r.id }, prefer: 'return=minimal' });
      refundId = refundId || r.id;
    }
  } else if (b.stripe_payment_intent_id) {
    const r = await ctx.stripe('refunds', { payment_intent: b.stripe_payment_intent_id, metadata: { booking_id: b.id } }, { idempotencyKey: `refund-${b.id}` });
    refundId = r.id;
  }
  const gift = Number(await ctx.db('rpc/release_gift', { method: 'POST', body: { p_booking: b.id } })) || 0;
  if (!refundId && !gift && Number(b.split_count) <= 1) throw new HttpError(409, 'Payment not found for this booking.');
  return refundId || (gift ? 'gift' : null);
}
/** Pays the creator. Paid by one card: from that payment. Paid partly by gift card or by several friends:
 *  from CapturaGo's Stripe balance (the money of those payments). */
async function releaseBooking(ctx, b) {
  const pooled = Number(b.gift_cents) > 0 || Number(b.split_count) > 1;
  if (!b.creator_stripe_account_id || (!pooled && !b.stripe_payment_intent_id)) throw new HttpError(409, 'Payout details missing for this booking.');
  let charge = null;
  if (!pooled) {
    const pi = await ctx.stripe(`payment_intents/${b.stripe_payment_intent_id}`, null, { method: 'GET' });
    charge = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge && pi.latest_charge.id);
    if (!charge) throw new HttpError(409, 'Payment not settled yet.');
  }
  const t = await ctx.stripe('transfers', {
    amount: b.price_cents - b.creator_fee_cents,
    currency: b.currency || 'eur',
    destination: b.creator_stripe_account_id,
    ...(charge ? { source_transaction: charge } : {}),
    transfer_group: b.id,
    metadata: { booking_id: b.id },
  }, { idempotencyKey: `transfer-${b.id}` });
  return t.id;
}
/** Bookings that keep a creator's day (same rule as the database's booking_holds_day) — a PostgREST filter. */
function dayHoldFilter(ctx) {
  const since = encodeURIComponent(new Date(ctx.nowMs() - 30 * 60000).toISOString());
  const now = encodeURIComponent(new Date(ctx.nowMs()).toISOString());
  return `or=(status.in.(paid,confirmed),and(status.eq.pending_payment,created_at.gt.${since}),and(status.eq.pending_payment,split_deadline.gt.${now}))`;
}
/** "€132.00" or "€132.00 (€50.00 from a gift card)" */
function paidText(b, lang) {
  return Number(b.gift_cents) > 0 ? L(lang, '{amount} ({gift} from a gift card)', { amount: euro(b.total_cents), gift: euro(b.gift_cents) }) : euro(b.total_cents);
}

/** "€132.00" or "€82.00 to your card and €50.00 back on your gift card" */
function refundText(b, lang) {
  const g = Number(b.gift_cents) || 0;
  return g > 0 ? L(lang, '{card} to your card and {gift} back on your gift card', { card: euro(b.total_cents - g), gift: euro(g) }) : euro(b.total_cents);
}

/* ── Emails in the reader's language (English, German, Spanish, French) ──
   The language is the one the person chose on the website or in the app (email_prefs.lang); people
   without an account (a friend paying a share, a gift card's recipient) get the language of the person
   who booked or bought. Texts: MAIL_TEXT in mail-i18n.js — the English sentence is the key. */
const MAIL_LANGS = ['en', 'de', 'es', 'fr'];
function L(lang, en, vars) {
  const row = MAIL_TEXT[en];
  const s = (lang && lang !== 'en' && row && row[lang]) || en;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m)) : s;
}
/** The language for emails to an account (by its id, or else by its email address). Never fails: 'en'. */
async function mailLang(ctx, userId, email) {
  const uid = UUID_RE.test(String(userId || '')) ? String(userId) : null;
  const em = email ? String(email).trim().toLowerCase().slice(0, 254) : null;
  if (!uid && !em) return 'en';
  const key = `${uid || ''}|${em || ''}`;
  if (!ctx._mailLangs) ctx._mailLangs = new Map();
  if (ctx._mailLangs.has(key)) return ctx._mailLangs.get(key);
  let lang = 'en';
  try {
    const r = await ctx.db('rpc/email_lang', { method: 'POST', body: { p_user: uid, p_email: em } });
    if (MAIL_LANGS.includes(r)) lang = r;
  } catch { /* not set up yet → English */ }
  ctx._mailLangs.set(key, lang);
  return lang;
}
/** "Hi Ana," as its own paragraph */
const hiP = (lang, name) => `<p>${name ? L(lang, 'Hi {name},', { name }) : L(lang, 'Hi there,')}</p>`;

/** After a booking is fully paid (card, gift card, or the last friend's share): instant booking + emails. */
async function afterBookingPaid(ctx, deps, booking) {
  let b = booking;
  if (b.offer_id) {   // a creator's offer on a shoot request was booked → the request is done, other offers are declined
    try {
      const [acc] = await ctx.db(`request_offers?id=eq.${b.offer_id}&status=eq.open`, { method: 'PATCH', body: { status: 'accepted', updated_at: new Date(ctx.nowMs()).toISOString() } });
      const rid = acc && acc.request_id;
      if (rid) {
        await ctx.db(`shoot_requests?id=eq.${rid}&status=eq.open`, { method: 'PATCH', body: { status: 'booked' }, prefer: 'return=minimal' });
        await ctx.db(`request_offers?request_id=eq.${rid}&status=eq.open`, { method: 'PATCH', body: { status: 'declined', updated_at: new Date(ctx.nowMs()).toISOString() }, prefer: 'return=minimal' });
      }
    } catch (e) { console.error('[offer] could not close the request', e); }
  }
  const [creator] = await ctx.db(`photographers?id=eq.${b.photographer_id}&select=user_id,email,name,instant_book,max_per_day`);
  const remote = b.booking_type === 'delivery';
  // Instant booking: confirmed right away if the day still has room (otherwise the creator decides as usual)
  let instant = false;
  if (!remote && creator && creator.instant_book) {
    const others = await ctx.db(`bookings?photographer_id=eq.${b.photographer_id}&shoot_date=eq.${b.shoot_date}&booking_type=eq.session&status=in.(paid,confirmed)&id=neq.${b.id}&select=id&limit=10`);
    if ((others || []).length < Math.min(Math.max(Number(creator.max_per_day) || 1, 1), 6)) {
      const moved = await ctx.db(`bookings?id=eq.${b.id}&status=eq.paid`, { method: 'PATCH', body: { status: 'confirmed' } });
      if (moved && moved[0]) { b = moved[0]; instant = true; }
    }
  }
  const whenText = (lang) => {
    const when = escHtml(b.shoot_date) + (b.time_slot ? ` (${escHtml(L(lang, slotLabel(b.time_slot)))})` : '');
    if (remote) return L(lang, 'due by {date}', { date: `<strong>${when}</strong>` });
    return b.shoot_city ? L(lang, 'on {date} in {city}', { date: `<strong>${when}</strong>`, city: `<strong>${escHtml(String(b.shoot_city).split(',')[0])}</strong>` }) : L(lang, 'on {date}', { date: `<strong>${when}</strong>` });
  };
  const releaseText = (lang) => (remote ? L(lang, 'when the client approves your delivery') : payoutHold(b).promised ? L(lang, '{n} days after you send the photos', { n: RELEASE_DAYS }) : L(lang, 'after the shoot'));
  const pkg = `<strong>${escHtml(b.package_name)}</strong>`;
  // to the creator
  const lc = await mailLang(ctx, creator && creator.user_id, creator && creator.email);
  const viaLink = (b.via_link ? `<p>${L(lc, '✨ Booked through your personal CapturaGo link.')}</p>` : '')
    + (Number(b.split_count) > 1 ? `<p>${L(lc, '👥 {n} friends shared the cost.', { n: Number(b.split_count) })}</p>` : '')
    + (Number(b.deal_pct) > 0 ? `<p>${L(lc, '⚡ Booked at your last-minute price (−{n}%).', { n: Number(b.deal_pct) })}</p>` : '')
    + (b.surprise ? `<p>${L(lc, '🤫 <strong>It\'s a surprise</strong> (for example a proposal) — the other person doesn\'t know. Please don\'t contact or tag them before the moment; plan everything with the traveller in your CapturaGo messages.')}</p>` : '');
  const bookingsLink = (lang, text) => `<a href="${ctx.siteUrl}/dashboard.html#bookings">${L(lang, text)}</a>`;
  await sendEmail(ctx, deps, creator && creator.email,
    instant ? L(lc, 'Confirmed booking: {pkg} on {date}', { pkg: b.package_name, date: b.shoot_date }) : remote ? L(lc, 'New order: {pkg} (due {date})', { pkg: b.package_name, date: b.shoot_date }) : L(lc, 'New booking: {pkg} on {date}', { pkg: b.package_name, date: b.shoot_date }),
    hiP(lc, escHtml(creator && creator.name)) + `<p>${L(lc, '{client} booked {pkg} {when} and paid {amount}.', { client: `<strong>${escHtml(b.client_name)}</strong>`, pkg, when: whenText(lc), amount: euro(b.total_cents) })}</p>` + viaLink +
    (b.note ? `<p>${L(lc, 'Their note: “{note}”', { note: escHtml(b.note) })}</p>` : '') +
    (b.client_files_url ? `<p>${L(lc, 'Their files: {link}', { link: `<a href="${escHtml(b.client_files_url)}">${escHtml(b.client_files_url)}</a>` })}</p>` : '') +
    (instant
      ? `<p>${L(lc, '⚡ It\'s <strong>confirmed automatically</strong> because you use instant booking. {open} to message {first}. The payment is released to you {release}.', { open: bookingsLink(lc, 'Open your bookings'), first: escHtml(String(b.client_name).split(' ')[0]), release: releaseText(lc) })}</p>`
      : `<p>${L(lc, 'Please {action}. The payment is held safely and released to you {release}.', { action: bookingsLink(lc, remote ? 'accept the order in your dashboard' : 'confirm the booking in your dashboard'), release: releaseText(lc) })}</p>`));
  // to the traveller
  const lt = await mailLang(ctx, b.client_user_id, b.client_email);
  const heldUntil = remote ? L(lt, 'you approve the delivery') : payoutHold(b).promised ? L(lt, 'your photos arrive') : L(lt, 'your shoot is done');
  const split = Number(b.split_count) > 1;
  const payLine = split
    ? (instant ? 'Everyone has paid their share — {amount} in total for {pkg} {when} is received and held safely by CapturaGo until {until}.' : 'Everyone has paid their share — {amount} in total for {pkg} {when} is confirmed and held safely by CapturaGo until {until}.')
    : (instant ? 'Your payment of {amount} for {pkg} {when} is received and held safely by CapturaGo until {until}.' : 'Your payment of {amount} for {pkg} {when} is confirmed and held safely by CapturaGo until {until}.');
  await sendEmail(ctx, deps, b.client_email, clientSubject(b, instant ? L(lt, 'Confirmed — {pkg} on {date}', { pkg: b.package_name, date: b.shoot_date }) : L(lt, 'Booking received — {pkg}', { pkg: b.package_name }), lt),
    hiP(lt, escHtml(b.client_name)) + `<p>${L(lt, payLine, { amount: split ? euro(b.total_cents) : paidText(b, lt), pkg, when: whenText(lt), until: heldUntil })}</p>` +
    (instant ? `<p>${L(lt, '⚡ <strong>Your shoot is confirmed.</strong> Message your creator in {link} to plan the details.', { link: `<a href="${ctx.siteUrl}/dashboard.html#messages">CapturaGo</a>` })}</p>`
      : `<p>${L(lt, 'The creator will confirm shortly. Track it in {link}.', { link: bookingsLink(lt, 'your bookings') })}</p>`));
  return { booking: b, instant };
}

// ── Gift card codes: CG-XXXX-XXXX-XXXX-XXXX (80 random bits; no 0/O or 1/I/L) ──
const GIFT_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newGiftCode() {
  const chars = [];
  while (chars.length < 16) {                     // rejection sampling: every symbol equally likely
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    for (const x of bytes) if (x < 248 && chars.length < 16) chars.push(GIFT_ALPHABET[x % 31]);   // 31 symbols: no 0/O, 1/I/L
  }
  return `CG-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}-${chars.slice(12, 16).join('')}`;
}
/** Email address of an account (service role → Supabase Auth admin API); '' if unknown. */
async function accountEmail(ctx, deps, userId) {
  if (!UUID_RE.test(String(userId || ''))) return '';
  const base = String(ctx.env('SUPABASE_URL', '')).replace(/\/$/, '');
  const key = ctx.env('SUPABASE_SERVICE_ROLE_KEY', '');
  try {
    const r = await deps.fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return '';
    const u = await r.json();
    return String((u && u.email) || '');
  } catch { return ''; }
}
// Conditional status change: only succeeds if the booking is still in `from`
async function moveBooking(ctx, id, from, to, extra = {}) {
  const rows = await ctx.db(`bookings?id=eq.${id}&status=eq.${from}`, { method: 'PATCH', body: { status: to, ...extra } });
  return rows && rows[0] ? rows[0] : null;
}
async function isAdmin(ctx, userId) {
  if (!UUID_RE.test(String(userId || ''))) return false;
  const rows = await ctx.db(`admins?user_id=eq.${userId}&select=user_id`);
  return Array.isArray(rows) && rows.length === 1;
}
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function creatorContact(ctx, b) {
  if (!b.photographer_id) return null;
  const [c] = await ctx.db(`photographers?id=eq.${b.photographer_id}&select=user_id,email,name`);
  if (!c) return null;
  c.lang = await mailLang(ctx, c.user_id, c.email);
  return c;
}

// ── Time of day for in-person sessions (same list as the website and app) ──
const TIME_SLOTS = { sunrise: 'Sunrise', morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', golden_hour: 'Golden hour', evening: 'Evening', flexible: 'Flexible time' };
const slotLabel = (s) => TIME_SLOTS[s] || '';

// ── Photo delivery storage (private bucket "deliveries", files at <booking id>/<file>) ──
async function deleteDeliveryFiles(ctx, deps, paths) {
  // Each photo has a small preview next to it: <booking>/t_<file>
  const valid = (paths || []).filter((p) => typeof p === 'string' && /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/.test(p));
  const list = [...new Set(valid.flatMap((p) => { const [dir, file] = p.split('/'); return file.startsWith('t_') ? [p] : [p, `${dir}/t_${file}`]; }))];
  if (!list.length) return 0;
  const base = String(ctx.env('SUPABASE_URL', '')).replace(/\/$/, '');
  const key = ctx.env('SUPABASE_SERVICE_ROLE_KEY', '');
  for (let i = 0; i < list.length; i += 500) {
    const r = await deps.fetch(`${base}/storage/v1/object/deliveries`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: list.slice(i, i + 500) }),
    });
    if (!r.ok) throw new Error(`Could not delete delivered photos (${r.status}).`);
  }
  return valid.length;
}
/** Deletes all delivered photos (files + records) of the given bookings. */
async function purgeBookingPhotos(ctx, deps, bookingIds) {
  const ids = (bookingIds || []).filter((id) => UUID_RE.test(String(id)));
  if (!ids.length) return 0;
  const rows = await ctx.db(`booking_photos?booking_id=in.(${ids.join(',')})&select=path&limit=5000`);
  const n = await deleteDeliveryFiles(ctx, deps, (rows || []).map((r) => r.path));
  await ctx.db(`booking_photos?booking_id=in.(${ids.join(',')})`, { method: 'DELETE', prefer: 'return=minimal' });
  return n;
}

// ── Surprise mode: email subjects to the traveller don't give the plan away
//    (a partner may see notifications on a shared phone or laptop) ──
function clientSubject(b, subject, lang) {
  return b && b.surprise ? L(lang, 'An update from CapturaGo') : subject;
}

// ── Shoot plan helpers ──
const MEETING_TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
function mapsLink(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(place || '').slice(0, 300))}`;
}
/** HTML block with the meeting point/time (and the surprise reminder) for emails. */
function planHtml(b, forCreator, lang) {
  const parts = [];
  if (b.shoot_city && b.booking_type !== 'delivery') parts.push(L(lang, '🌍 City: {city} (the creator\'s trip)', { city: escHtml(String(b.shoot_city).split(',')[0]) }));
  if (b.meeting_point) parts.push(L(lang, '📍 Meeting point: {place}', { place: `<a href="${escHtml(mapsLink(b.meeting_point))}">${escHtml(b.meeting_point)}</a>` }));
  if (b.meeting_time) parts.push(L(lang, '🕒 Time: {time}', { time: escHtml(b.meeting_time) }));
  else if (b.time_slot) parts.push(`🕒 ${escHtml(L(lang, slotLabel(b.time_slot)))}`);
  if (forCreator && b.surprise) parts.push(L(lang, '🤫 <strong>Surprise:</strong> the other person doesn\'t know — don\'t contact or tag them before the moment.'));
  if (forCreator && Array.isArray(b.shot_list) && b.shot_list.length) parts.push(L(lang, '📝 Shot list: {list}', { list: b.shot_list.map(escHtml).join(' · ') }));
  return parts.length ? `<p>${parts.join('<br/>')}</p>` : '';
}

// ── Signed (temporary) links to private delivered photos ──
async function signDeliveryUrls(ctx, deps, paths, seconds = 3600) {
  const list = (paths || []).filter((p) => typeof p === 'string' && /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/.test(p));
  if (!list.length) return {};
  const base = String(ctx.env('SUPABASE_URL', '')).replace(/\/$/, '');
  const key = ctx.env('SUPABASE_SERVICE_ROLE_KEY', '');
  const out = {};
  for (let i = 0; i < list.length; i += 200) {
    const r = await deps.fetch(`${base}/storage/v1/object/sign/deliveries`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: seconds, paths: list.slice(i, i + 200) }),
    });
    if (!r.ok) throw new Error(`Could not prepare the photos (${r.status}).`);
    for (const x of (await r.json()) || []) {
      if (x && x.path && x.signedURL && !x.error) out[x.path] = `${base}/storage/v1${x.signedURL.startsWith('/') ? '' : '/'}${x.signedURL}`;
    }
  }
  return out;
}

// ── Payment held until the photos arrive (packages that promise photos "within N days") ──
const RELEASE_DAYS = 3;
/** { promised, delivered, dueIso, releaseAt (ms, or null while waiting for the photos) } for an in-person booking. */
function payoutHold(b) {
  const days = Math.round(Number(b && b.package_details && b.package_details.edit_days));
  const promised = !!b && b.booking_type !== 'delivery' && days >= 1 && days <= 60;
  const shootMs = b && b.shoot_date ? Date.parse(`${b.shoot_date}T00:00:00Z`) : NaN;
  const afterShoot = shootMs + RELEASE_DAYS * 86400000;
  if (!promised) return { promised: false, delivered: false, dueIso: '', releaseAt: afterShoot };
  const dueIso = new Date(shootMs + days * 86400000).toISOString().slice(0, 10);
  const deliveredMs = b.photos_delivered_at ? Date.parse(b.photos_delivered_at) : NaN;
  if (!Number.isFinite(deliveredMs)) return { promised: true, delivered: false, dueIso, releaseAt: null };
  return { promised: true, delivered: true, dueIso, releaseAt: Math.max(afterShoot, deliveredMs + RELEASE_DAYS * 86400000) };
}

// ── Creators on the road: where a creator is on a given day ──
/** Same rule as the database's city_key(): first part before the comma, lower case, single spaces. */
function cityKey(c) {
  return String(c || '').split(',')[0].trim().toLowerCase().replace(/\s+/g, ' ');
}
/** The trip covering an ISO date, or null when the creator is at home. */
function tripOn(trips, iso) {
  return (Array.isArray(trips) ? trips : []).find((t) => t && typeof t.from === 'string' && typeof t.to === 'string' && iso >= t.from && iso <= t.to) || null;
}

// ── Calendar sync: read busy days from a creator's own calendar (iCal link) ──
// Only these providers are fetched — the server never visits any other address (same list as the database).
const CALENDAR_HOST_RE = /^(calendar\.google\.com|([a-z0-9-]+\.)*icloud\.com|outlook\.live\.com|outlook\.office365\.com|outlook\.office\.com|calendar\.proton\.me|user\.fm)$/i;
function calendarUrlOk(raw) {
  const s = String(raw || '');
  if (s.length < 20 || s.length > 1000 || /[\s<>"\\]/.test(s)) return false;
  let u;
  try { u = new URL(s); } catch { return false; }
  return u.protocol === 'https:' && !u.username && !u.password && !u.port && CALENDAR_HOST_RE.test(u.hostname) && s.toLowerCase().startsWith(`https://${u.hostname.toLowerCase()}/`);
}
const CAL_MAX_BYTES = 3 * 1024 * 1024;
class CalendarError extends Error {}
async function fetchCalendar(deps, url) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!calendarUrlOk(current)) throw new CalendarError(hop ? 'Your calendar link redirects somewhere we can\'t read.' : 'This calendar link isn\'t supported.');
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ac ? setTimeout(() => ac.abort(), 10000) : null;
    let r;
    try { r = await deps.fetch(current, { redirect: 'manual', headers: { Accept: 'text/calendar, text/plain;q=0.8' }, ...(ac ? { signal: ac.signal } : {}) }); }
    catch { throw new CalendarError('Your calendar didn\'t answer. We\'ll try again later.'); }
    finally { if (timer) clearTimeout(timer); }
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location');
      if (!loc) throw new CalendarError('Your calendar link doesn\'t work any more. Copy it again from your calendar app.');
      try { current = new URL(loc, current).href; } catch { throw new CalendarError('Your calendar link doesn\'t work any more.'); }
      continue;
    }
    if (!r.ok) throw new CalendarError(`Your calendar link doesn't work any more (error ${r.status}). Copy it again from your calendar app.`);
    const len = Number(r.headers.get('content-length'));
    if (Number.isFinite(len) && len > CAL_MAX_BYTES) throw new CalendarError('Your calendar is too big to read (over 3 MB).');
    const buf = await r.arrayBuffer();
    if (buf.byteLength > CAL_MAX_BYTES) throw new CalendarError('Your calendar is too big to read (over 3 MB).');
    const text = new TextDecoder().decode(buf);
    if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 2000))) throw new CalendarError('This link isn\'t a calendar. Use the secret iCal link (it ends in .ics).');
    return text;
  }
  throw new CalendarError('Your calendar link redirects too many times.');
}

/** Days (YYYY-MM-DD, between fromIso and toIso) blocked by the calendar: all-day events, and events of 3 hours or more.
 *  Events marked "free" or cancelled don't count. Repeats: daily, weekly (with days), monthly and yearly. */
function parseIcsBusy(text, fromIso, toIso, maxDays = 400) {
  const lines = String(text || '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const busy = new Set();
  const fromMs = Date.parse(`${fromIso}T00:00:00Z`), toMs = Date.parse(`${toIso}T00:00:00Z`) + 86400000;
  const DAY = 86400000, MIN_TIMED = 3 * 3600000;
  const parseDt = (params, v) => {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(v || '').trim());
    if (!m) return null;
    const allDay = !m[4] || /VALUE=DATE(;|$)/i.test(params);
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], allDay ? 0 : +m[4], allDay ? 0 : +m[5], allDay ? 0 : +(m[6] || 0));
    return Number.isFinite(ms) ? { ms, allDay } : null;
  };
  const parseDur = (v) => {
    const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
    if (!m || m[1] === '-') return null;
    return ((+(m[2] || 0) * 7 + +(m[3] || 0)) * 24 * 3600 + +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000;
  };
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const addBusy = (startMs, durMs, allDay) => {
    if (allDay) {
      const end = startMs + Math.max(durMs, DAY);
      for (let d = startMs; d < end && busy.size < maxDays * 4; d += DAY) if (d >= fromMs && d < toMs) busy.add(iso(d));
    } else if (durMs >= MIN_TIMED) {
      const first = Date.parse(`${iso(startMs)}T00:00:00Z`), last = startMs + durMs - 1;
      for (let d = first; d <= last && busy.size < maxDays * 4; d += DAY) if (d >= fromMs && d < toMs) busy.add(iso(d));
    }
  };
  const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  function occurrences(start, rule, exdates) {
    const out = [];
    const p = {};
    for (const part of String(rule || '').split(';')) { const [k, v] = part.split('='); if (k && v) p[k.toUpperCase()] = v.toUpperCase(); }
    const freq = p.FREQ;
    const interval = Math.min(Math.max(parseInt(p.INTERVAL || '1', 10) || 1, 1), 1000);
    const count = p.COUNT ? Math.min(Math.max(parseInt(p.COUNT, 10) || 0, 0), 5000) : Infinity;
    const untilDt = p.UNTIL ? parseDt('', p.UNTIL) : null;
    const until = untilDt ? (untilDt.allDay ? untilDt.ms + DAY - 1 : untilDt.ms) : Infinity;
    const unsupported = Object.keys(p).some((k) => !['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'WKST'].includes(k))
      || (p.BYDAY && freq !== 'WEEKLY') || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq);
    if (unsupported) return [start];             // only the first date we can be sure of
    const days = p.BYDAY ? p.BYDAY.split(',').map((d) => WD[d.replace(/^[+-]?\d+/, '')]).filter((d) => d !== undefined) : [];
    const d0 = new Date(start);
    const timeOfDay = start - Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate());
    let n = 0;
    const push = (ms) => { if (ms > until || n >= count) return false; n++; if (!exdates.has(iso(ms))) out.push(ms); return true; };
    // Open-ended repeats that began long ago: jump close to the window (a COUNT has to be counted from the start)
    let k0 = 0;
    if (count === Infinity && fromMs > start) {
      const f = new Date(fromMs);
      const steps = freq === 'DAILY' ? (fromMs - start) / (interval * DAY)
        : freq === 'WEEKLY' ? (fromMs - start) / (interval * 7 * DAY)
        : freq === 'MONTHLY' ? ((f.getUTCFullYear() - d0.getUTCFullYear()) * 12 + f.getUTCMonth() - d0.getUTCMonth()) / interval
        : (f.getUTCFullYear() - d0.getUTCFullYear()) / interval;
      k0 = Math.max(0, Math.floor(steps) - 1);
    }
    for (let k = k0; k < k0 + 5000 && n < count; k++) {
      let batch;
      if (freq === 'DAILY') batch = [start + k * interval * DAY];
      else if (freq === 'WEEKLY') {
        if (!days.length) batch = [start + k * interval * 7 * DAY];
        else {
          const monday = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() - ((d0.getUTCDay() + 6) % 7)) + k * interval * 7 * DAY;
          batch = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((wd) => monday + ((wd + 6) % 7) * DAY + timeOfDay).filter((ms) => ms >= start);
        }
      } else if (freq === 'MONTHLY') {
        const y = d0.getUTCFullYear(), m = d0.getUTCMonth() + k * interval, dd = d0.getUTCDate();
        const ms = Date.UTC(y, m, dd) + timeOfDay;
        batch = new Date(ms).getUTCDate() === dd ? [ms] : [];        // months without that day are skipped
      } else {
        const y = d0.getUTCFullYear() + k * interval;
        const ms = Date.UTC(y, d0.getUTCMonth(), d0.getUTCDate()) + timeOfDay;
        batch = new Date(ms).getUTCMonth() === d0.getUTCMonth() ? [ms] : [];
      }
      let stop = false;
      for (const ms of batch) { if (ms >= toMs || !push(ms)) { stop = true; break; } }
      if (stop) break;
    }
    return out;
  }
  let ev = null, depth = 0, events = 0;
  for (const line of lines) {
    const u = line.toUpperCase();
    if (u.startsWith('BEGIN:VEVENT')) { ev = { ex: new Set() }; depth = 0; continue; }
    if (!ev) continue;
    if (u.startsWith('BEGIN:')) { depth++; continue; }               // VALARM etc.
    if (u.startsWith('END:') && depth > 0) { depth--; continue; }
    if (depth > 0) continue;
    if (u.startsWith('END:VEVENT')) {
      if (++events > 20000) break;
      if (ev.start && !ev.free && !ev.cancelled) {
        let dur = ev.end ? ev.end.ms - ev.start.ms : (ev.dur != null ? ev.dur : (ev.start.allDay ? DAY : 0));
        if (!(dur >= 0)) dur = 0;
        const starts = ev.rrule ? occurrences(ev.start.ms, ev.rrule, ev.ex) : [ev.start.ms];
        for (const s of starts) if (s < toMs && s + Math.max(dur, 1) > fromMs) addBusy(s, dur, ev.start.allDay);
      }
      ev = null; continue;
    }
    const i = line.indexOf(':');
    if (i < 1) continue;
    const head = line.slice(0, i), value = line.slice(i + 1);
    const [name, ...rest] = head.split(';');
    const params = rest.join(';');
    switch (name.toUpperCase()) {
      case 'DTSTART': ev.start = parseDt(params, value); break;
      case 'DTEND': ev.end = parseDt(params, value); break;
      case 'DURATION': ev.dur = parseDur(value); break;
      case 'RRULE': ev.rrule = value; break;
      case 'EXDATE': for (const v of value.split(',')) { const d = parseDt(params, v); if (d) ev.ex.add(iso(d.ms)); } break;
      case 'TRANSP': ev.free = value.trim().toUpperCase() === 'TRANSPARENT'; break;
      case 'STATUS': ev.cancelled = value.trim().toUpperCase() === 'CANCELLED'; break;
      default: break;
    }
  }
  return [...busy].sort().slice(0, maxDays);
}

/** Reads one creator's calendar and stores the busy days (keeps the old ones if the calendar can't be read). */
async function syncCalendarImport(ctx, deps, row) {
  const nowIso = new Date(ctx.nowMs()).toISOString();
  const enc = encodeURIComponent(row.url);
  try {
    const text = await fetchCalendar(deps, row.url);
    const dates = parseIcsBusy(text, ctx.isoInDays(0), ctx.isoInDays(365));
    const done = await ctx.db(`calendar_imports?user_id=eq.${row.user_id}&url=eq.${enc}`, { method: 'PATCH', body: { last_synced_at: nowIso, last_error: null, busy_count: dates.length } });
    if (!done || !done.length) return { skipped: true };           // the link was changed or removed meanwhile
    await ctx.db(`photographers?user_id=eq.${row.user_id}`, { method: 'PATCH', body: { external_busy_dates: dates }, prefer: 'return=minimal' });
    return { busy_count: dates.length, last_synced_at: nowIso, last_error: null };
  } catch (e) {
    const msg = e instanceof CalendarError ? e.message : 'We couldn\'t read your calendar. We\'ll try again later.';
    if (!(e instanceof CalendarError)) console.error('[calendar]', row.user_id, e);
    await ctx.db(`calendar_imports?user_id=eq.${row.user_id}&url=eq.${enc}`, { method: 'PATCH', body: { last_synced_at: nowIso, last_error: msg.slice(0, 200) }, prefer: 'return=minimal' }).catch(() => {});
    return { error: msg, last_synced_at: nowIso, last_error: msg };
  }
}

// ── Calendar feed: your CapturaGo bookings as an .ics file for Google / Apple / Outlook ──
function icsText(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
/** Lines longer than 75 bytes are folded (RFC 5545), never splitting a character. */
function icsFold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '', size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}
function buildIcsFeed(bookings, userId, siteUrl, nowMs) {
  const ymd = (iso) => String(iso).replace(/-/g, '');
  const next = (iso) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const stamp = new Date(nowMs).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CapturaGo//Bookings//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:CapturaGo bookings', 'X-PUBLISHED-TTL:PT1H', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
  for (const b of bookings || []) {
    if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.shoot_date || ''))) continue;
    const asCreator = b.creator_user_id === userId;
    const remote = b.booking_type === 'delivery';
    const creator = first(b.photographers && b.photographers.name) || 'your creator';
    const client = first(b.client_name) || 'your client';
    const time = b.meeting_time || slotLabel(b.time_slot);
    let summary;
    if (!asCreator && b.surprise) summary = 'CapturaGo booking';         // calendars are often shared — keep the surprise
    else if (remote) summary = asCreator ? `🎬 Due: ${b.package_name} for ${client}` : `🎬 ${b.package_name} from ${creator} (due)`;
    else summary = (asCreator ? `📸 ${b.package_name} with ${client}` : `📸 ${b.package_name} with ${creator}`) + (time ? ` · ${time}` : '');
    const place = remote ? '' : (b.meeting_point || b.shoot_city || (b.photographers && b.photographers.city) || '');
    const desc = [
      !remote && time ? `Time: ${time}` : '',
      !remote && b.meeting_point ? `Meeting point: ${b.meeting_point}` : '',
      asCreator && b.surprise ? 'Surprise — the other person doesn\'t know.' : '',
      b.status === 'paid' ? 'Waiting for the creator to confirm.' : '',
      `Open in CapturaGo: ${siteUrl}/dashboard.html?b=${b.id}#bookings`,
    ].filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT', `UID:${b.id}@capturago.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(b.shoot_date)}`, `DTEND;VALUE=DATE:${ymd(next(b.shoot_date))}`,
      `SUMMARY:${icsText(summary)}`, ...(place ? [`LOCATION:${icsText(place)}`] : []), `DESCRIPTION:${icsText(desc)}`,
      `URL:${siteUrl}/dashboard.html?b=${b.id}#bookings`, `STATUS:${b.status === 'paid' ? 'TENTATIVE' : 'CONFIRMED'}`, 'TRANSP:OPAQUE', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
