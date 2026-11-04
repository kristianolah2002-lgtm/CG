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
        body: { status: 'paid', stripe_payment_intent_id: obj.payment_intent, paid_at: new Date(ctx.nowMs()).toISOString() },
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
      await afterBookingPaid(ctx, deps, updated[0]);
      return;
    }

    // A gift card was bought → active for 3 years; the buyer (and the recipient, if asked) get the code
    if (meta.kind === 'gift' && UUID_RE.test(meta.gift_id || '')) {
      const nowIso = new Date(ctx.nowMs()).toISOString();
      const rows = await ctx.db(`gift_cards?id=eq.${meta.gift_id}&status=in.(pending_payment,expired_checkout)`, {
        method: 'PATCH', body: { status: 'active', paid_at: nowIso, stripe_payment_intent_id: obj.payment_intent || null, expires_at: new Date(ctx.nowMs() + 3 * 365 * 86400000).toISOString() },
      });
      const g = rows && rows[0];
      if (!g) return;   // already handled
      const until = new Date(Date.parse(g.expires_at)).toISOString().slice(0, 10);
      const card = `<p style="font-size:22px;letter-spacing:2px;font-family:monospace;background:#F6EDE0;padding:14px 18px;border-radius:12px;display:inline-block"><strong>${escHtml(g.code)}</strong></p>`;
      const l = await mailLang(ctx, g.buyer_user_id, g.buyer_email);   // the recipient gets the buyer's language too
      const amount = `<strong>${euro(g.amount_cents)}</strong>`;
      if (g.buyer_email) {
        await sendEmail(ctx, deps, g.buyer_email, L(l, 'Your CapturaGo gift card ({amount})', { amount: euro(g.amount_cents) }),
          `<p>${L(l, 'Hi,')}</p><p>${g.recipient_name ? L(l, 'Thank you! Here is your gift card for {amount} for {name}:', { amount, name: `<strong>${escHtml(g.recipient_name)}</strong>` }) : L(l, 'Thank you! Here is your gift card for {amount}:', { amount })}</p>${card}`
          + `<p>${L(l, 'It can be used for any shoot on CapturaGo until {date} — enter the code when booking. {link}.', { date: escHtml(until), link: `<a href="${ctx.siteUrl}/gift.html?g=${g.id}">${L(l, 'Download a printable card')}</a>` })}</p>`
          + (g.surprise ? `<p>${L(l, '🎲 It\'s a “Surprise me” gift: they can let us pick a last-minute deal for them on {link}.', { link: `<a href="${ctx.siteUrl}/gift.html#deals">${L(l, 'the deals page')}</a>` })}</p>` : '')
          + (g.recipient_email ? `<p>${L(l, 'We\'ve also emailed it to {email}.', { email: escHtml(g.recipient_email) })}</p>` : ''));
      }
      if (g.recipient_email) {
        const sent = await sendEmail(ctx, deps, g.recipient_email, L(l, '🎁 You\'ve got a CapturaGo gift card'),
          hiP(l, g.recipient_name ? escHtml(g.recipient_name) : '').replace(L(l, 'Hi there,'), L(l, 'Hi,')) + `<p>${L(l, 'Someone gave you a photo shoot! Here is your CapturaGo gift card for {amount}:', { amount })}</p>${card}`
          + (g.message ? `<p style="font-style:italic">“${escHtml(g.message)}”</p>` : '')
          + `<p>${L(l, 'Find a photographer, videographer or local guide wherever you travel on {site} and enter the code when you book. Valid until {date}.', { site: `<a href="${ctx.siteUrl}/">CapturaGo</a>`, date: escHtml(until) })}</p>`
          + (g.surprise ? `<p>${L(l, '🎲 <strong>Feeling spontaneous?</strong> This is a “Surprise me” gift: {link}, press “Surprise me” and we pick a last-minute shoot for you — often at a lower price.', { link: `<a href="${ctx.siteUrl}/gift.html#deals">${L(l, 'open the last-minute deals')}</a>` })}</p>` : '')
          + `<p>${L(l, 'It also works for last-minute deals: {link}.', { link: `<a href="${ctx.siteUrl}/gift.html#deals">${L(l, 'see who has a lower price tomorrow')}</a>` })}</p>`);
        if (sent) await ctx.db(`gift_cards?id=eq.${g.id}`, { method: 'PATCH', body: { recipient_emailed_at: nowIso }, prefer: 'return=minimal' });
      }
      return;
    }

    // A friend paid their share of a split booking
    if (meta.kind === 'share' && UUID_RE.test(meta.share_id || '') && UUID_RE.test(meta.booking_id || '')) {
      const nowIso = new Date(ctx.nowMs()).toISOString();
      const email = (obj.customer_details && obj.customer_details.email) || obj.customer_email || null;
      const rows = await ctx.db(`booking_shares?id=eq.${meta.share_id}&booking_id=eq.${meta.booking_id}&status=eq.pending`, {
        method: 'PATCH', body: { status: 'paid', paid_at: nowIso, stripe_payment_intent_id: obj.payment_intent || null, payer_email: email ? String(email).slice(0, 254) : null, ...(UUID_RE.test(meta.payer || '') ? { payer_user_id: meta.payer } : {}) },
      });
      const share = rows && rows[0];
      if (!share) return;
      const [b] = await ctx.db(`bookings?id=eq.${meta.booking_id}&select=*`);
      if (!b || b.status !== 'pending_payment') {
        // Too late (deadline passed or the booking was cancelled) → this share goes straight back
        if (share.stripe_payment_intent_id) {
          const r = await ctx.stripe('refunds', { payment_intent: share.stripe_payment_intent_id, metadata: { booking_id: meta.booking_id, share_id: share.id } }, { idempotencyKey: `refund-share-${share.id}` });
          await ctx.db(`booking_shares?id=eq.${share.id}`, { method: 'PATCH', body: { status: 'refunded', stripe_refund_id: r.id }, prefer: 'return=minimal' });
        }
        if (email) {
          const l = b ? await mailLang(ctx, b.client_user_id, b.client_email) : 'en';
          await sendEmail(ctx, deps, email, L(l, 'Your share was refunded'), `<p>${L(l, 'Hi,')}</p><p>${L(l, 'The booking you paid a share of ({pkg}) is no longer open, so we refunded your payment in full. It can take 5–10 days to appear.', { pkg: escHtml(b ? b.package_name : L(l, 'a CapturaGo booking')) })}</p>`);
        }
        return;
      }
      const shares = await ctx.db(`booking_shares?booking_id=eq.${b.id}&select=id,share_no,status,token,amount_cents&order=share_no`);
      const paid = (shares || []).filter((x) => x.status === 'paid').length;
      if (paid >= Number(b.split_count)) {
        const done = await ctx.db(`bookings?id=eq.${b.id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'paid', paid_at: nowIso } });   // the deadline stays (the database requires one for a split)
        if (done && done[0]) await afterBookingPaid(ctx, deps, done[0]);
        return;
      }
      if (share.share_no === 1) {   // the organiser paid their part: the friends get up to 48 hours (and until the day before the shoot)
        const dayBefore = Date.parse(`${b.shoot_date}T00:00:00Z`) - 86400000;
        const deadline = new Date(Math.max(Math.min(ctx.nowMs() + 48 * 3600000, dayBefore), ctx.nowMs() + 3600000)).toISOString();
        await ctx.db(`bookings?id=eq.${b.id}&status=eq.pending_payment`, { method: 'PATCH', body: { split_deadline: deadline }, prefer: 'return=minimal' });
        b.split_deadline = deadline;
        const l = await mailLang(ctx, b.client_user_id, b.client_email);
        const links = (shares || []).filter((x) => x.status === 'pending').map((x) => `<li>${L(l, 'Share {n}', { n: x.share_no })} · ${euro(x.amount_cents)}: <a href="${ctx.siteUrl}/pay.html#t=${x.token}">${ctx.siteUrl}/pay.html#t=${x.token}</a></li>`).join('');
        await sendEmail(ctx, deps, b.client_email, clientSubject(b, L(l, 'Send your friends their payment links — {pkg}', { pkg: b.package_name }), l),
          hiP(l, escHtml(String(b.client_name || '').split(' ')[0])) + `<p>${L(l, 'Your share is paid. Send each friend one of these links — every link can be paid once:')}</p><ul>${links}</ul>`
          + `<p>${L(l, 'Everyone needs to pay by {time}. If someone doesn\'t, everyone is refunded automatically and the day is released.', { time: `<strong>${escHtml(new Date(b.split_deadline).toISOString().slice(0, 16).replace('T', ' '))} UTC</strong>` })}</p>`
          + `<p>${L(l, 'You can also find the links in {link}.', { link: `<a href="${ctx.siteUrl}/dashboard.html#bookings">${L(l, 'your bookings')}</a>` })}</p>`);
      }
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
      // Revenue record (unique per checkout session, so retries never double-count)
      await ctx.db('boost_purchases?on_conflict=stripe_session_id', {
        method: 'POST',
        body: { photographer_id: l.id, days, amount_cents: Number(obj.amount_total) || 0, stripe_session_id: obj.id || null },
        prefer: 'resolution=ignore-duplicates,return=minimal',
      });
    }
    return;
  }

  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    if (meta.kind === 'booking' && UUID_RE.test(meta.booking_id || '')) {
      const rows = await ctx.db(`bookings?id=eq.${meta.booking_id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'expired' } });
      if (rows && rows[0] && Number(rows[0].gift_cents) > 0) await ctx.db('rpc/release_gift', { method: 'POST', body: { p_booking: meta.booking_id } });
    }
    if (meta.kind === 'gift' && UUID_RE.test(meta.gift_id || '')) {
      await ctx.db(`gift_cards?id=eq.${meta.gift_id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'expired_checkout' }, prefer: 'return=minimal' });
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
