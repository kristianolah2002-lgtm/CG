// @ts-nocheck
// CapturaGo edge function: stripe-connect
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

// ── stripe-connect: creators connect a payout account (Stripe Express) ──
// actions: "onboard" (create/continue setup), "status", "dashboard"
const EUROPE = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH']);

function payoutsReady(acct) {
  return !!(acct && acct.details_submitted && acct.capabilities && acct.capabilities.transfers === 'active');
}

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    const action = String(body.action || 'status');

    const [listing] = await ctx.db(`photographers?user_id=eq.${user.id}&select=id,name,stripe_account_id,payouts_enabled`);
    if (!listing) throw new HttpError(400, 'Create your creator listing first.');

    if (action === 'onboard') {
      let acctId = listing.stripe_account_id;
      if (!acctId) {
        const country = String(body.country || 'SK').toUpperCase();
        if (!/^[A-Z]{2}$/.test(country)) throw new HttpError(400, 'Choose your country.');
        const params = {
          type: 'express',
          country,
          email: user.email,
          business_type: 'individual',
          capabilities: { transfers: { requested: true } },
          business_profile: {
            url: `${ctx.siteUrl}/`,
            product_description: 'Photography, videography and editing services booked through CapturaGo',
          },
          metadata: { photographer_id: listing.id, user_id: user.id },
        };
        if (EUROPE.has(country)) params.capabilities.card_payments = { requested: true };
        else params.tos_acceptance = { service_agreement: 'recipient' };
        const acct = await ctx.stripe('accounts', params, { idempotencyKey: `acct-${listing.id}` });
        acctId = acct.id;
        await ctx.db(`photographers?id=eq.${listing.id}`, { method: 'PATCH', body: { stripe_account_id: acctId }, prefer: 'return=minimal' });
      }
      const link = await ctx.stripe('account_links', {
        account: acctId,
        refresh_url: `${ctx.siteUrl}/dashboard.html?stripe=refresh`,
        return_url: `${ctx.siteUrl}/dashboard.html?stripe=return`,
        type: 'account_onboarding',
      });
      return json({ url: link.url });
    }

    if (action === 'status') {
      if (!listing.stripe_account_id) return json({ connected: false, ready: false });
      const acct = await ctx.stripe(`accounts/${listing.stripe_account_id}`, null, { method: 'GET' });
      const ready = payoutsReady(acct);
      if (ready !== !!listing.payouts_enabled) {
        await ctx.db(`photographers?id=eq.${listing.id}`, { method: 'PATCH', body: { payouts_enabled: ready }, prefer: 'return=minimal' });
      }
      return json({
        connected: true,
        ready,
        details_submitted: !!acct.details_submitted,
        due: ((acct.requirements && acct.requirements.currently_due) || []).length,
      });
    }

    if (action === 'dashboard') {
      if (!listing.stripe_account_id) throw new HttpError(400, 'Connect payouts first.');
      const link = await ctx.stripe(`accounts/${listing.stripe_account_id}/login_links`, {});
      return json({ url: link.url });
    }

    throw new HttpError(400, 'Unknown action.');
  });
}

startServer(createHandler);

export { createHandler };
