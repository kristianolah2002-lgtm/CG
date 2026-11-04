// ── buy-photos: the traveller buys extra photos from their gallery (PART 24) ──
// Deploy WITH JWT verification. Body: { booking_id, photo_ids: [..] | "all", from?: "app" }.
// The price is ALWAYS the creator's price per photo from the database; the traveller pays it plus the usual service
// fee. Stripe confirms the payment → stripe-webhook unlocks the photos and pays the creator right away.
function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    const id = String(body.booking_id || '');
    if (!UUID_RE.test(id)) throw new HttpError(404, 'Booking not found.');
    const [b] = await ctx.db(`bookings?id=eq.${id}&select=id,status,client_user_id,client_email,creator_user_id,photographer_id,package_name,extra_photo_cents,photographers(name,stripe_account_id,payouts_enabled)`);
    if (!b || b.client_user_id !== user.id) throw new HttpError(404, 'Booking not found.');
    if (!['confirmed', 'delivered', 'completed'].includes(b.status)) throw new HttpError(400, 'Extra photos can only be bought for an active or completed booking.');
    const unit = Number(b.extra_photo_cents);
    if (!Number.isInteger(unit) || unit < 100 || unit > 10000) throw new HttpError(400, 'These photos are not for sale.');
    const ph = b.photographers || {};
    if (!ph.payouts_enabled || !ph.stripe_account_id) throw new HttpError(400, `${String(ph.name || 'The creator').split(' ')[0]} can't take payments right now. Please message them.`);

    const locked = await ctx.db(`booking_photos?booking_id=eq.${id}&extra=is.true&unlocked_at=is.null&select=id&limit=300`);
    const lockedIds = new Set((locked || []).map((p) => p.id));
    let ids;
    if (body.photo_ids === 'all') ids = [...lockedIds];
    else {
      if (!Array.isArray(body.photo_ids) || !body.photo_ids.length || body.photo_ids.length > 300) throw new HttpError(400, 'Choose the photos you want.');
      ids = [...new Set(body.photo_ids.map(String))].filter((x) => UUID_RE.test(x));
      if (ids.some((x) => !lockedIds.has(x))) throw new HttpError(409, 'Some of these photos are already yours or no longer for sale. Please refresh.');
    }
    if (!ids.length) throw new HttpError(409, 'These photos are already yours.');

    // A few unpaid checkouts at most (stops piles of open orders)
    const since = encodeURIComponent(new Date(ctx.nowMs() - 3600000).toISOString());
    const open = await ctx.db(`photo_orders?client_user_id=eq.${user.id}&status=eq.pending_payment&created_at=gt.${since}&select=id&limit=6`);
    if ((open || []).length >= 5) throw new HttpError(429, 'You have several unfinished photo payments. Please try again in an hour.');

    const price = unit * ids.length;
    const fee = Math.round((price * ctx.pct('CLIENT_FEE_PCT', 10)) / 100);
    const creatorFee = Math.round((price * ctx.pct('CREATOR_FEE_PCT', 0)) / 100);
    const [order] = await ctx.db('photo_orders', { method: 'POST', body: {
      booking_id: b.id, photographer_id: b.photographer_id, client_user_id: user.id, creator_user_id: b.creator_user_id,
      creator_stripe_account_id: ph.stripe_account_id, photo_ids: ids, unit_cents: unit, price_cents: price, fee_cents: fee,
      creator_fee_cents: creatorFee, total_cents: price + fee,
    } });
    const first = String(ph.name || 'your creator').split(' ')[0];
    const back = body.from === 'app' ? `${ctx.siteUrl}/app-return.html?to=photos` : `${ctx.siteUrl}/dashboard.html?b=${b.id}`;
    let session;
    try {
      session = await ctx.stripe('checkout/sessions', {
        mode: 'payment',
        customer_email: b.client_email || user.email,
        client_reference_id: order.id,
        line_items: [
          { quantity: ids.length, price_data: { currency: 'eur', unit_amount: unit, product_data: { name: `Extra photo${ids.length > 1 ? 's' : ''} from ${first}`, description: `${b.package_name || 'Your shoot'} — full size, yours to keep.` } } },
          ...(fee > 0 ? [{ quantity: 1, price_data: { currency: 'eur', unit_amount: fee, product_data: { name: 'CapturaGo service fee' } } }] : []),
        ],
        payment_intent_data: { metadata: { photo_order_id: order.id, booking_id: b.id } },
        metadata: { kind: 'photos', photo_order_id: order.id },
        success_url: body.from === 'app' ? `${back}&s=ok` : `${back}&bought=1#bookings`,
        cancel_url: body.from === 'app' ? `${back}&s=cancel` : `${back}#bookings`,
      }, { idempotencyKey: `photos-${order.id}` });
    } catch (e) {
      await ctx.db(`photo_orders?id=eq.${order.id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'expired' }, prefer: 'return=minimal' }).catch(() => {});
      throw e;
    }
    await ctx.db(`photo_orders?id=eq.${order.id}`, { method: 'PATCH', body: { stripe_checkout_session_id: session.id }, prefer: 'return=minimal' });
    return json({ url: session.url, order_id: order.id, count: ids.length, total_cents: price + fee });
  });
}

startServer(createHandler);
