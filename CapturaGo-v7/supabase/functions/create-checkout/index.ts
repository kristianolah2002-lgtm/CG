// @ts-nocheck
// CapturaGo edge function: create-checkout
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

// ── create-checkout: traveller books a creator's package ──
// Price is ALWAYS read from the database, never from the browser.
// Money is collected by CapturaGo and only transferred to the creator after the shoot.
function computeFees(priceCents, clientPct, creatorPct) {
  const clientFee = Math.round((priceCents * clientPct) / 100);
  const creatorFee = Math.round((priceCents * creatorPct) / 100);
  return { clientFee, creatorFee, total: priceCents + clientFee, payout: priceCents - creatorFee };
}

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    const pid = String(body.photographer_id || '');
    const pkgId = String(body.package_id || '');
    const date = String(body.shoot_date || '');
    const note = String(body.note || '').trim().slice(0, 1000);

    if (!UUID_RE.test(pid)) throw new HttpError(400, 'Creator not found.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new HttpError(400, 'Choose a date for your shoot.');
    const days = ctx.daysUntil(date);
    if (days < 1) throw new HttpError(400, 'Choose a date from tomorrow onwards.');
    if (days > 365) throw new HttpError(400, 'You can book up to one year ahead.');

    const [l] = await ctx.db(`photographers?id=eq.${pid}&select=id,user_id,name,packages,payouts_enabled,stripe_account_id,available`);
    if (!l) throw new HttpError(404, 'Creator not found.');
    if (l.user_id === user.id) throw new HttpError(400, "You can't book your own listing.");
    if (!l.payouts_enabled || !l.stripe_account_id) throw new HttpError(400, "This creator doesn't take online bookings yet. Send them an inquiry instead.");
    if (l.available === false) throw new HttpError(400, 'This creator is not available right now.');

    const pkg = (Array.isArray(l.packages) ? l.packages : []).find((p) => p && String(p.id) === pkgId);
    if (!pkg) throw new HttpError(400, 'This package no longer exists. Please refresh.');
    const price = Number(pkg.price_eur);
    if (!Number.isFinite(price) || price < 10 || price > 5000) throw new HttpError(400, 'This package has an invalid price.');

    const priceCents = Math.round(price * 100);
    const fees = computeFees(priceCents, ctx.pct('CLIENT_FEE_PCT', 10), ctx.pct('CREATOR_FEE_PCT', 0));
    const clientName = String((user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0]).slice(0, 80);

    const [booking] = await ctx.db('bookings', {
      method: 'POST',
      body: {
        photographer_id: l.id,
        creator_user_id: l.user_id,
        creator_stripe_account_id: l.stripe_account_id,
        client_user_id: user.id,
        client_name: clientName,
        client_email: user.email,
        package_id: String(pkg.id),
        package_name: String(pkg.name || 'Shoot').slice(0, 60),
        package_minutes: Number.isFinite(Number(pkg.minutes)) ? Number(pkg.minutes) : null,
        shoot_date: date,
        note: note || null,
        currency: 'eur',
        price_cents: priceCents,
        client_fee_cents: fees.clientFee,
        creator_fee_cents: fees.creatorFee,
        total_cents: fees.total,
      },
    });

    const lineItems = [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: priceCents,
        product_data: { name: `${String(pkg.name || 'Shoot').slice(0, 60)} with ${String(l.name).slice(0, 60)}`, description: `Shoot date: ${date}` },
      },
    }];
    if (fees.clientFee > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: fees.clientFee,
          product_data: { name: 'CapturaGo service fee', description: 'Secure payment, held until your shoot is done' },
        },
      });
    }

    let session;
    try {
      session = await ctx.stripe('checkout/sessions', {
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: booking.id,
        line_items: lineItems,
        payment_intent_data: { transfer_group: booking.id, metadata: { booking_id: booking.id } },
        metadata: { kind: 'booking', booking_id: booking.id },
        success_url: `${ctx.siteUrl}/booking.html?b=${booking.id}&s=ok`,
        cancel_url: `${ctx.siteUrl}/booking.html?b=${booking.id}&s=cancel`,
      }, { idempotencyKey: `checkout-${booking.id}` });
    } catch (e) {
      await ctx.db(`bookings?id=eq.${booking.id}`, { method: 'PATCH', body: { status: 'expired' }, prefer: 'return=minimal' }).catch(() => {});
      throw e;
    }

    await ctx.db(`bookings?id=eq.${booking.id}`, { method: 'PATCH', body: { stripe_checkout_session_id: session.id }, prefer: 'return=minimal' });
    return json({ url: session.url, booking_id: booking.id });
  });
}

startServer(createHandler);

export { createHandler };
