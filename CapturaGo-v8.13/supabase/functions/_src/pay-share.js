// ── pay-share: a friend pays their share of a split booking (signed in; the link's token says which share) ──
function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    const token = String(body.token || '');
    if (!UUID_RE.test(token)) throw new HttpError(404, 'This payment link is not valid.');
    const [share] = await ctx.db(`booking_shares?token=eq.${token}&select=id,booking_id,share_no,amount_cents,status`);
    if (!share) throw new HttpError(404, 'This payment link is not valid.');
    if (share.status !== 'pending') throw new HttpError(409, 'This share is already paid. Thank you!');
    const [b] = await ctx.db(`bookings?id=eq.${share.booking_id}&select=id,status,package_name,shoot_date,shoot_city,split_count,split_deadline,creator_user_id,photographer_id,photographers(name)`);
    if (!b || b.status !== 'pending_payment' || !b.split_deadline) throw new HttpError(409, 'This booking is no longer collecting payments.');
    if (b.creator_user_id === user.id) throw new HttpError(400, "Creators can't pay for a booking with themselves.");
    const left = Date.parse(b.split_deadline) - ctx.nowMs();
    if (left <= 0) throw new HttpError(409, 'The time to pay has run out — everyone who paid is refunded.');
    if (left < 31 * 60000) throw new HttpError(409, 'Less than 30 minutes are left to pay — ask the organiser to book again.');
    const [first] = await ctx.db(`booking_shares?booking_id=eq.${b.id}&share_no=eq.1&select=status`);
    if (!first || first.status !== 'paid') throw new HttpError(409, 'The organiser hasn\'t paid their share yet.');
    const creator = String((b.photographers && b.photographers.name) || 'your creator').split(' ')[0];
    const session = await ctx.stripe('checkout/sessions', {
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: b.id,
      expires_at: Math.floor(Math.min(ctx.nowMs() + 24 * 3600000, Date.parse(b.split_deadline)) / 1000),
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: share.amount_cents, product_data: {
        name: `Your share (${share.share_no} of ${b.split_count}): ${String(b.package_name).slice(0, 60)} with ${String(creator).slice(0, 40)}`,
        description: `Shoot date: ${b.shoot_date}${b.shoot_city ? ` · in ${String(b.shoot_city).split(',')[0].slice(0, 60)}` : ''} · refunded automatically if not everyone pays in time` } } }],
      payment_intent_data: { transfer_group: b.id, metadata: { booking_id: b.id, share_id: share.id } },
      metadata: { kind: 'share', booking_id: b.id, share_id: share.id, payer: user.id },
      success_url: `${ctx.siteUrl}/pay.html?s=ok#t=${token}`,
      cancel_url: `${ctx.siteUrl}/pay.html#t=${token}`,
    }, { idempotencyKey: `checkout-share-${share.id}-${Math.floor(ctx.nowMs() / 1800000)}` });
    await ctx.db(`booking_shares?id=eq.${share.id}&status=eq.pending`, { method: 'PATCH', body: { stripe_checkout_session_id: session.id }, prefer: 'return=minimal' });
    return json({ url: session.url });
  });
}

startServer(createHandler);
