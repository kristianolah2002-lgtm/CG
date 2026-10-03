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
