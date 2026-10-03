// @ts-nocheck
// CapturaGo edge function: booking-action
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

// ── booking-action: the escrow rules ──
//  confirm  (creator)  paid → confirmed
//  decline  (creator)  paid|confirmed → declined + full refund
//  cancel   (client)   pending → cancelled; paid → cancelled + full refund;
//                      confirmed → cancelled + full refund only if ≥ 7 days before the shoot
//  complete (client on/after shoot day, or creator ≥ 3 days after) confirmed → completed + payout to creator
//  dispute  (client)   paid|confirmed, until 3 days after the shoot → disputed (payout frozen)
const FREE_CANCEL_DAYS = 7;
const RELEASE_AFTER_DAYS = 3;

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    const id = String(body.booking_id || '');
    const action = String(body.action || '');
    if (!UUID_RE.test(id)) throw new HttpError(404, 'Booking not found.');

    const [b] = await ctx.db(`bookings?id=eq.${id}&select=*`);
    const isCreator = !!b && b.creator_user_id === user.id;
    const isClient = !!b && b.client_user_id === user.id;
    if (!b || (!isCreator && !isClient)) throw new HttpError(404, 'Booking not found.');

    const days = ctx.daysUntil(b.shoot_date);

    async function move(from, to, extra = {}) {
      const rows = await ctx.db(`bookings?id=eq.${id}&status=eq.${from}`, { method: 'PATCH', body: { status: to, ...extra } });
      if (!rows.length) throw new HttpError(409, 'This booking was just updated. Please refresh.');
      return rows[0];
    }
    async function refundAll() {
      if (!b.stripe_payment_intent_id) throw new HttpError(409, 'Payment not found for this booking.');
      const r = await ctx.stripe('refunds', { payment_intent: b.stripe_payment_intent_id, metadata: { booking_id: id } }, { idempotencyKey: `refund-${id}` });
      return r.id;
    }
    const notifyClient = (subject, text) => sendEmail(ctx, deps, b.client_email, subject, `<p>Hi ${escHtml(b.client_name)},</p><p>${text}</p><p><a href="${ctx.siteUrl}/dashboard.html">View your bookings</a></p>`);

    if (action === 'confirm') {
      if (!isCreator) throw new HttpError(403, 'Only the creator can confirm.');
      if (b.status !== 'paid') throw new HttpError(400, 'Only new paid bookings can be confirmed.');
      const nb = await move('paid', 'confirmed');
      await notifyClient(`Confirmed: ${b.package_name} on ${b.shoot_date}`, `Great news — your shoot <strong>${escHtml(b.package_name)}</strong> on <strong>${escHtml(b.shoot_date)}</strong> is confirmed. Your payment stays protected until the shoot is done.`);
      return json({ booking: nb });
    }

    if (action === 'decline') {
      if (!isCreator) throw new HttpError(403, 'Only the creator can decline.');
      if (b.status !== 'paid' && b.status !== 'confirmed') throw new HttpError(400, 'This booking can no longer be declined.');
      const refundId = await refundAll();
      const nb = await move(b.status, 'declined', { stripe_refund_id: refundId });
      await notifyClient(`Booking declined — full refund`, `Unfortunately the creator can't do your shoot on ${escHtml(b.shoot_date)}. You've been refunded in full (${euro(b.total_cents)}); it can take 5–10 days to appear.`);
      return json({ booking: nb });
    }

    if (action === 'cancel') {
      if (!isClient) throw new HttpError(403, 'Only the traveller can cancel. Creators can decline instead.');
      if (b.status === 'pending_payment') {
        if (b.stripe_checkout_session_id) {
          await ctx.stripe(`checkout/sessions/${b.stripe_checkout_session_id}/expire`, {}).catch(() => {});
        }
        return json({ booking: await move('pending_payment', 'cancelled') });
      }
      if (b.status === 'paid' || (b.status === 'confirmed' && days >= FREE_CANCEL_DAYS)) {
        const refundId = await refundAll();
        return json({ booking: await move(b.status, 'cancelled', { stripe_refund_id: refundId }), refunded: true });
      }
      if (b.status === 'confirmed') throw new HttpError(400, `Free cancellation ends ${FREE_CANCEL_DAYS} days before the shoot. Please message the creator to reschedule.`);
      throw new HttpError(400, 'This booking can no longer be cancelled.');
    }

    if (action === 'complete') {
      if (b.status !== 'confirmed') throw new HttpError(400, 'Only confirmed bookings can be completed.');
      if (isClient && days > 0) throw new HttpError(400, 'You can confirm the shoot on or after the shoot date.');
      if (isCreator && days > -RELEASE_AFTER_DAYS) throw new HttpError(400, `Payment is released ${RELEASE_AFTER_DAYS} days after the shoot date, or sooner if the client confirms.`);
      if (!b.creator_stripe_account_id || !b.stripe_payment_intent_id) throw new HttpError(409, 'Payout details missing. Please contact support.');
      const pi = await ctx.stripe(`payment_intents/${b.stripe_payment_intent_id}`, null, { method: 'GET' });
      const charge = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge && pi.latest_charge.id);
      if (!charge) throw new HttpError(409, 'Payment not settled yet. Please try again later.');
      const transfer = await ctx.stripe('transfers', {
        amount: b.price_cents - b.creator_fee_cents,
        currency: b.currency || 'eur',
        destination: b.creator_stripe_account_id,
        source_transaction: charge,
        transfer_group: id,
        metadata: { booking_id: id },
      }, { idempotencyKey: `transfer-${id}` });
      return json({ booking: await move('confirmed', 'completed', { stripe_transfer_id: transfer.id }) });
    }

    if (action === 'dispute') {
      if (!isClient) throw new HttpError(403, 'Only the traveller can report a problem.');
      if (b.status !== 'paid' && b.status !== 'confirmed') throw new HttpError(400, 'This booking can no longer be disputed.');
      if (days < -RELEASE_AFTER_DAYS) throw new HttpError(400, `Problems must be reported within ${RELEASE_AFTER_DAYS} days after the shoot.`);
      const nb = await move(b.status, 'disputed');
      await sendEmail(ctx, deps, ctx.env('SUPPORT_EMAIL', 'hello@capturago.com'), `Dispute opened: booking ${id}`,
        `<p>${escHtml(b.client_name)} (${escHtml(b.client_email)}) reported a problem with booking ${id} (${escHtml(b.package_name)}, ${escHtml(b.shoot_date)}, ${euro(b.total_cents)}). Payout is frozen until resolved.</p>`);
      return json({ booking: nb });
    }

    throw new HttpError(400, 'Unknown action.');
  });
}

startServer(createHandler);

export { createHandler };
