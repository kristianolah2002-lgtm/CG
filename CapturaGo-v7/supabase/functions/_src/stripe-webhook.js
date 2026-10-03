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
