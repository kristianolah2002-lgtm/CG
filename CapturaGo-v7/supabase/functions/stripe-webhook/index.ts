// @ts-nocheck
// CapturaGo edge function: stripe-webhook
// GENERATED from supabase/functions/_src — edit there and re-run build.py

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

  function pct(name, def) {
    const n = Number(env(name, def));
    return Number.isFinite(n) && n >= 0 && n <= 30 ? n : def;
  }

  return {
    env, db, getUser, stripe, daysUntil, pct, nowMs,
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

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function euro(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}

function startServer(createHandler) {
  if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
    Deno.serve(createHandler({ env: (k) => Deno.env.get(k), fetch: (...a) => fetch(...a) }));
  }
}

// ── stripe-webhook: Stripe tells us what really happened ──
// Must be deployed WITHOUT JWT verification (Stripe has no user token).
async function verifyStripeSignature(raw, header, secret, nowSec, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim());
  const t = (parts.find((p) => p.startsWith('t=')) || '').slice(2);
  const sigs = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${raw}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => {
    if (s.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

function payoutsReady(acct) {
  return !!(acct && acct.details_submitted && acct.capabilities && acct.capabilities.transfers === 'active');
}

async function handleEvent(ctx, deps, event) {
  const obj = (event.data && event.data.object) || {};
  const meta = obj.metadata || {};

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    if (event.type === 'checkout.session.completed' && obj.payment_status !== 'paid') return; // delayed payment method, wait

    if (meta.kind === 'booking' && UUID_RE.test(meta.booking_id || '')) {
      const updated = await ctx.db(`bookings?id=eq.${meta.booking_id}&status=eq.pending_payment`, {
        method: 'PATCH',
        body: { status: 'paid', stripe_payment_intent_id: obj.payment_intent },
      });
      if (!updated.length) {
        // Paid after the booking was cancelled/expired → give the money back automatically.
        const [b] = await ctx.db(`bookings?id=eq.${meta.booking_id}&select=id,status`);
        if (b && (b.status === 'cancelled' || b.status === 'expired') && obj.payment_intent) {
          const refund = await ctx.stripe('refunds', { payment_intent: obj.payment_intent, metadata: { booking_id: b.id } }, { idempotencyKey: `late-refund-${b.id}` });
          await ctx.db(`bookings?id=eq.${b.id}`, { method: 'PATCH', body: { stripe_payment_intent_id: obj.payment_intent, stripe_refund_id: refund.id }, prefer: 'return=minimal' });
        }
        return;
      }
      const b = updated[0];
      const [creator] = await ctx.db(`photographers?id=eq.${b.photographer_id}&select=email,name`);
      const when = escHtml(b.shoot_date);
      await sendEmail(ctx, deps, creator && creator.email, `New booking: ${b.package_name} on ${b.shoot_date}`,
        `<p>Hi ${escHtml(creator && creator.name)},</p><p><strong>${escHtml(b.client_name)}</strong> booked <strong>${escHtml(b.package_name)}</strong> for <strong>${when}</strong> and paid ${euro(b.total_cents)}.</p>` +
        (b.note ? `<p>Their note: “${escHtml(b.note)}”</p>` : '') +
        `<p>Please <a href="${ctx.siteUrl}/dashboard.html">confirm the booking in your dashboard</a>. The payment is held safely and released to you after the shoot.</p>`);
      await sendEmail(ctx, deps, b.client_email, `Booking received — ${b.package_name} on ${b.shoot_date}`,
        `<p>Hi ${escHtml(b.client_name)},</p><p>Your payment of ${euro(b.total_cents)} for <strong>${escHtml(b.package_name)}</strong> on <strong>${when}</strong> is confirmed and held safely by CapturaGo until your shoot is done.</p>` +
        `<p>The creator will confirm shortly. Track it in <a href="${ctx.siteUrl}/dashboard.html">your bookings</a>.</p>`);
      return;
    }

    if (meta.kind === 'boost' && UUID_RE.test(meta.photographer_id || '')) {
      const days = Math.min(Math.max(parseInt(meta.days, 10) || 0, 1), 90);
      const [l] = await ctx.db(`photographers?id=eq.${meta.photographer_id}&select=id,boosted_until`);
      if (!l) return;
      const now = ctx.nowMs();
      const current = l.boosted_until ? Date.parse(l.boosted_until) : 0;
      const until = new Date(Math.max(now, current) + days * 86400000).toISOString();
      await ctx.db(`photographers?id=eq.${l.id}`, { method: 'PATCH', body: { boosted_until: until }, prefer: 'return=minimal' });
    }
    return;
  }

  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    if (meta.kind === 'booking' && UUID_RE.test(meta.booking_id || '')) {
      await ctx.db(`bookings?id=eq.${meta.booking_id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'expired' }, prefer: 'return=minimal' });
    }
    return;
  }

  if (event.type === 'account.updated' && obj.id) {
    await ctx.db(`photographers?stripe_account_id=eq.${encodeURIComponent(obj.id)}`, {
      method: 'PATCH', body: { payouts_enabled: payoutsReady(obj) }, prefer: 'return=minimal',
    });
  }
}

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return async (req) => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const raw = await req.text();
    // Two Stripe endpoints point here: one for your own account's events and one for
    // connected (creator) accounts. Each has its own signing secret.
    const secrets = [ctx.env('STRIPE_WEBHOOK_SECRET', ''), ctx.env('STRIPE_CONNECT_WEBHOOK_SECRET', '')].filter(Boolean);
    const sigHeader = req.headers.get('stripe-signature');
    const nowSec = Math.floor(ctx.nowMs() / 1000);
    let ok = false;
    for (const sec of secrets) { if (await verifyStripeSignature(raw, sigHeader, sec, nowSec)) { ok = true; break; } }
    if (!ok) return json({ error: 'Invalid signature' }, 400);

    let event;
    try { event = JSON.parse(raw); } catch { return json({ error: 'Invalid payload' }, 400); }
    if (!event || !event.id || !event.type) return json({ error: 'Invalid payload' }, 400);

    // Process each event exactly once
    const inserted = await ctx.db('stripe_events?on_conflict=id', {
      method: 'POST', body: { id: event.id, type: event.type }, prefer: 'resolution=ignore-duplicates,return=representation',
    });
    if (!inserted || !inserted.length) return json({ received: true, duplicate: true });

    try {
      await handleEvent(ctx, deps, event);
    } catch (e) {
      console.error('[webhook]', event.type, e);
      // Forget the event so Stripe's automatic retry processes it again
      await ctx.db(`stripe_events?id=eq.${encodeURIComponent(event.id)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
      return json({ error: 'Processing failed, will retry' }, 500);
    }
    return json({ received: true });
  };
}

startServer(createHandler);

export { createHandler };
