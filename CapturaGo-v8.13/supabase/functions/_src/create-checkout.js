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
    let pid = String(body.photographer_id || '');
    const pkgId = String(body.package_id || '');
    let date = String(body.shoot_date || '');
    let note = String(body.note || '').trim().slice(0, 1000);
    // Booking a creator's offer on my shoot request: the price, day and details come from the offer (database)
    let offer = null;
    if (body.offer_id !== undefined && body.offer_id !== null && body.offer_id !== '') {
      const oid = String(body.offer_id);
      if (!UUID_RE.test(oid)) throw new HttpError(404, 'Offer not found.');
      [offer] = await ctx.db(`request_offers?id=eq.${oid}&select=id,photographer_id,price_eur,shoot_date,minutes,photos,edit_days,status,shoot_requests(id,user_id,status,service,people,note)`);
      const q = offer && offer.shoot_requests;
      if (!offer || !q || q.user_id !== user.id) throw new HttpError(404, 'Offer not found.');
      if (offer.status !== 'open' || q.status !== 'open') throw new HttpError(409, 'This offer is no longer open.');
      const used = await ctx.db(`bookings?offer_id=eq.${offer.id}&status=in.(paid,confirmed,delivered,completed,disputed)&select=id&limit=1`);
      if ((used || []).length) throw new HttpError(409, 'This offer is already booked.');
      pid = offer.photographer_id; date = String(offer.shoot_date);
      if (!note && q.note) note = String(q.note).slice(0, 1000);
    }
    const giftCode = String(body.gift_code || '').trim().slice(0, 40);
    const split = body.split === undefined || body.split === null || body.split === '' ? 1 : Math.round(Number(body.split));
    if (!Number.isInteger(split) || split < 1 || split > 6) throw new HttpError(400, 'Split the cost between 2 and 6 people.');
    if (split > 1 && giftCode) throw new HttpError(400, "A gift card can't be combined with splitting the cost.");

    if (!UUID_RE.test(pid)) throw new HttpError(400, 'Creator not found.');
    const filesUrl = cleanHttpsUrl(body.files_url);
    if (filesUrl === null) throw new HttpError(400, 'The link to your files must start with https://');

    const COLS = 'id,user_id,name,packages,payouts_enabled,stripe_account_id,available,hidden,unavailable_dates,max_per_day,instant_book';
    let l;
    try { [l] = await ctx.db(`photographers?id=eq.${pid}&select=${COLS},external_busy_dates,trips`); }
    catch (e) { if (!/external_busy_dates|trips/.test(String(e && e.message))) throw e; [l] = await ctx.db(`photographers?id=eq.${pid}&select=${COLS}`); }   // database update not run yet
    if (!l || l.hidden) throw new HttpError(404, 'Creator not found.');
    if (l.user_id === user.id) throw new HttpError(400, "You can't book your own listing.");
    if (!l.payouts_enabled || !l.stripe_account_id) throw new HttpError(400, "This creator doesn't take online bookings yet. Send them an inquiry instead.");
    if (l.available === false) throw new HttpError(400, 'This creator is not available right now.');

    const pkg = offer
      ? { id: `offer-${offer.id.slice(0, 8)}`, name: 'Your custom offer', type: 'session', price_eur: offer.price_eur, minutes: offer.minutes,
          ...(offer.photos !== null ? { photos: offer.photos } : {}), ...(offer.edit_days !== null ? { edit_days: offer.edit_days } : {}) }
      : (Array.isArray(l.packages) ? l.packages : []).find((p) => p && String(p.id) === pkgId);
    if (!pkg) throw new HttpError(400, 'This package no longer exists. Please refresh.');
    const price = Number(pkg.price_eur);
    if (!Number.isFinite(price) || price < 10 || price > (offer ? 10000 : 5000)) throw new HttpError(400, 'This package has an invalid price.');

    // Session = meet on a date. Delivery = remote work, due date set by the package.
    const isDelivery = pkg.type === 'delivery';
    let shootDate = date;
    let revisions = 0;
    let timeSlot = null;
    if (isDelivery) {
      const turnaround = Math.round(Number(pkg.delivery_days));
      if (!Number.isFinite(turnaround) || turnaround < 1 || turnaround > 30) throw new HttpError(400, 'This package has an invalid delivery time.');
      revisions = Math.min(Math.max(Math.round(Number(pkg.revisions)) || 0, 0), 5);
      shootDate = ctx.isoInDays(turnaround);
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new HttpError(400, 'Choose a date for your shoot.');
      const days = ctx.daysUntil(date);
      if (days < 1) throw new HttpError(400, 'Choose a date from tomorrow onwards.');
      if (days > 365) throw new HttpError(400, 'You can book up to one year ahead.');
      // Availability: the creator's days off, and days already fully booked
      if ([...(Array.isArray(l.unavailable_dates) ? l.unavailable_dates : []), ...(Array.isArray(l.external_busy_dates) ? l.external_busy_dates : [])].includes(date)) throw new HttpError(409, `${String(l.name).split(' ')[0]} isn't available on that day. Please choose another date.`);
      const taken = await ctx.db(`bookings?photographer_id=eq.${l.id}&shoot_date=eq.${date}&booking_type=eq.session&${dayHoldFilter(ctx)}&select=id&limit=10`);
      if ((taken || []).length >= Math.min(Math.max(Number(l.max_per_day) || 1, 1), 6)) throw new HttpError(409, 'That day was just booked. Please choose another date.');
      const slot = String(body.time_slot || '');
      if (slot && !TIME_SLOTS[slot]) throw new HttpError(400, 'Choose a time of day.');
      timeSlot = slot || null;
    }

    // Split between friends: in-person shoots only, at least 3 days ahead; everyone pays within 48 hours (and a day before the shoot)
    let splitDeadline = null;
    if (split > 1) {
      if (isDelivery) throw new HttpError(400, 'Splitting the cost is possible for in-person shoots.');
      if (ctx.daysUntil(shootDate) < 3) throw new HttpError(400, 'To split the cost, choose a shoot date at least 3 days away — your friends need time to pay.');
      // The day is held like any checkout (30 minutes) until the organiser has paid their share;
      // then the friends get up to 48 hours (set when that payment arrives).
      splitDeadline = new Date(ctx.nowMs() + 31 * 60000).toISOString();
    }

    // Last-minute deal: the creator lowered the price for this day (tomorrow or the day after). Read from the
    // database here, never from the browser; not for custom offers or remote work.
    let dealPct = 0;
    if (!offer && !isDelivery && ctx.daysUntil(shootDate) <= 2) {
      try {
        const p = Math.round(Number(await ctx.db('rpc/deal_pct_for', { method: 'POST', body: { p_photographer: l.id, p_day: shootDate } })));
        if (p >= 10 && p <= 50) dealPct = p;
      } catch { dealPct = 0; }   // database update not run yet
    }
    const priceCents = Math.round((price * 100 * (100 - dealPct)) / 100);
    // Booked through the creator's own link (capturago.com/c/<handle>) → lower service fee for their clients
    const viaLink = body.ref === l.id;
    // Sent by a partner (hotel / hostel link or QR card): lower service fee too; the partner gets a thank-you when the shoot is done
    let partner = null;
    const pcode = String(body.partner || '').toUpperCase().trim();
    if (/^[A-Z0-9]{4,12}$/.test(pcode)) {
      try {
        [partner] = await ctx.db(`partners?code=eq.${pcode}&status=eq.approved&select=id,user_id`);
        if (partner && (partner.user_id === user.id || partner.user_id === l.user_id)) partner = null;   // not for your own bookings
      } catch { partner = null; }   // database update not run yet
    }
    const basePct = ctx.pct('CLIENT_FEE_PCT', 10);
    const clientPct = viaLink || partner ? Math.min(ctx.pct(viaLink ? 'CREATOR_LINK_CLIENT_FEE_PCT' : 'PARTNER_CLIENT_FEE_PCT', 5), basePct) : basePct;
    const fees = computeFees(priceCents, clientPct, ctx.pct('CREATOR_FEE_PCT', 0));
    const clientName = String((user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0]).slice(0, 80);

    const bookingRow = {
      photographer_id: l.id,
      creator_user_id: l.user_id,
      creator_stripe_account_id: l.stripe_account_id,
      client_user_id: user.id,
      client_name: clientName,
      client_email: user.email,
      package_id: String(pkg.id),
      package_name: String(pkg.name || 'Shoot').slice(0, 60),
      package_minutes: Number.isFinite(Number(pkg.minutes)) ? Number(pkg.minutes) : null,
      package_details: packageSnapshot(pkg),
      shoot_date: shootDate,
      note: note || null,
      booking_type: isDelivery ? 'delivery' : 'session',
      client_files_url: filesUrl || null,
      revisions_allowed: revisions,
      time_slot: timeSlot,
      via_link: viaLink,
      surprise: !isDelivery && body.surprise === true,
      ...(offer ? { offer_id: offer.id } : {}),
      ...(partner ? { partner_id: partner.id } : {}),
      ...(dealPct ? { deal_pct: dealPct } : {}),
      currency: 'eur',
      ...(split > 1 ? { split_count: split, split_deadline: splitDeadline } : {}),
      price_cents: priceCents,
      client_fee_cents: fees.clientFee,
      creator_fee_cents: fees.creatorFee,
      total_cents: fees.total,
    };
    let booking;
    try { [booking] = await ctx.db('bookings', { method: 'POST', body: bookingRow }); }
    catch (e) {
      if (!/package_details|deal_pct/.test(String(e && e.message))) throw e;
      if (/deal_pct/.test(String(e && e.message))) throw new HttpError(409, 'Last-minute prices need the latest database update. Please try again later.');
      const { package_details: _d, ...rest } = bookingRow;   // database update not run yet
      [booking] = await ctx.db('bookings', { method: 'POST', body: rest });
    }
    const giveUp = async () => {   // the booking can't go ahead: free the day and any gift money
      await ctx.db(`bookings?id=eq.${booking.id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'expired' }, prefer: 'return=minimal' }).catch(() => {});
      await ctx.db('rpc/release_gift', { method: 'POST', body: { p_booking: booking.id } }).catch(() => {});
    };
    const productName = `${String(pkg.name || 'Shoot').slice(0, 60)} with ${String(l.name).slice(0, 60)}`;
    const okUrl = body.from === 'app' ? `${ctx.siteUrl}/app-return.html?to=booking&s=ok` : `${ctx.siteUrl}/booking.html?b=${booking.id}&s=ok`;
    const cancelUrl = body.from === 'app' ? `${ctx.siteUrl}/app-return.html?to=booking&s=cancel` : `${ctx.siteUrl}/booking.html?b=${booking.id}&s=cancel`;
    const expiresAt = Math.floor(ctx.nowMs() / 1000) + 31 * 60;   // the day is held for 30 minutes while paying

    // ── Split: the organiser pays share 1 now; the friends get their own links ──
    if (split > 1) {
      const each = Math.floor(fees.total / split);
      const shareRows = Array.from({ length: split }, (_, i) => ({ booking_id: booking.id, share_no: i + 1, amount_cents: i === 0 ? fees.total - each * (split - 1) : each }));
      if (each < 50) { await giveUp(); throw new HttpError(400, 'This package is too small to split.'); }
      let shares;
      try { shares = await ctx.db('booking_shares', { method: 'POST', body: shareRows }); }
      catch (e) { await giveUp(); throw e; }
      const mine = shares.find((x) => x.share_no === 1);
      let session;
      try {
        session = await ctx.stripe('checkout/sessions', {
          mode: 'payment', customer_email: user.email, client_reference_id: booking.id, expires_at: expiresAt,
          line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: mine.amount_cents, product_data: { name: `Your share (1 of ${split}): ${productName}`,
            description: `Shoot date: ${shootDate}${booking.shoot_city ? ` · in ${String(booking.shoot_city).split(',')[0].slice(0, 60)}` : ''} · held safely until ${payoutHold(booking).promised ? 'your photos arrive' : 'your shoot is done'}; refunded if not everyone pays in time` } } }],
          payment_intent_data: { transfer_group: booking.id, metadata: { booking_id: booking.id, share_id: mine.id } },
          metadata: { kind: 'share', booking_id: booking.id, share_id: mine.id, payer: user.id },
          success_url: okUrl, cancel_url: cancelUrl,
        }, { idempotencyKey: `checkout-share-${mine.id}` });
      } catch (e) { await giveUp(); throw e; }
      await ctx.db(`booking_shares?id=eq.${mine.id}`, { method: 'PATCH', body: { stripe_checkout_session_id: session.id }, prefer: 'return=minimal' });
      return json({ url: session.url, booking_id: booking.id, split, share_cents: mine.amount_cents });
    }

    // ── Gift card: take what's needed from it (the database checks and locks the card) ──
    if (giftCode) {
      const check = await ctx.db('rpc/gift_check_as', { method: 'POST', body: { p_user: user.id, p_code: giftCode } });
      if (!check || !check.ok) { await giveUp(); throw new HttpError(400, (check && check.error) || 'We couldn\'t find that gift card. Please check the code.'); }
      let used;
      try { used = Number(await ctx.db('rpc/reserve_gift', { method: 'POST', body: { p_code: giftCode, p_booking: booking.id, p_total: fees.total } })); }
      catch (e) { await giveUp(); throw new HttpError(400, String((e && e.message) || '').replace(/^Database error: /, '') || 'This gift card can\'t be used right now.'); }
      booking.gift_cents = used;
      if (used >= fees.total) {   // fully paid by the gift card — no card payment needed
        const done = await ctx.db(`bookings?id=eq.${booking.id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'paid', paid_at: new Date(ctx.nowMs()).toISOString() } });
        if (!done || !done[0]) { await giveUp(); throw new HttpError(409, 'This booking was just updated. Please try again.'); }
        await afterBookingPaid(ctx, deps, done[0]);
        return json({ url: okUrl, booking_id: booking.id, paid: true, gift_cents: used });
      }
      let session;
      try {
        session = await ctx.stripe('checkout/sessions', {
          mode: 'payment', customer_email: user.email, client_reference_id: booking.id, expires_at: expiresAt,
          line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: fees.total - used, product_data: { name: productName,
            description: `Package ${euro(priceCents)}${dealPct ? ` (last-minute −${dealPct}%)` : ''}${fees.clientFee ? ` + service fee ${euro(fees.clientFee)}` : ''} − gift card ${euro(used)}${isDelivery ? '' : ` · shoot date ${shootDate}`}` } } }],
          payment_intent_data: { transfer_group: booking.id, metadata: { booking_id: booking.id } },
          metadata: { kind: 'booking', booking_id: booking.id },
          success_url: okUrl, cancel_url: cancelUrl,
        }, { idempotencyKey: `checkout-${booking.id}` });
      } catch (e) { await giveUp(); throw e; }
      await ctx.db(`bookings?id=eq.${booking.id}`, { method: 'PATCH', body: { stripe_checkout_session_id: session.id }, prefer: 'return=minimal' });
      return json({ url: session.url, booking_id: booking.id, gift_cents: used });
    }

    const lineItems = [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: priceCents,
        product_data: { name: `${String(pkg.name || 'Shoot').slice(0, 60)} with ${String(l.name).slice(0, 60)}`, description: isDelivery ? `Delivered by ${shootDate}${revisions ? ` · ${revisions} revision${revisions > 1 ? 's' : ''}` : ''}` : `Shoot date: ${shootDate}${timeSlot ? ` · ${slotLabel(timeSlot)}` : ''}${booking.shoot_city ? ` · in ${String(booking.shoot_city).split(',')[0].slice(0, 60)}` : ''}${dealPct ? ` · last-minute price (−${dealPct}%)` : ''}${l.instant_book ? ' · confirmed instantly' : ''}` },
      },
    }];
    if (fees.clientFee > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: fees.clientFee,
          product_data: { name: 'CapturaGo service fee', description: isDelivery ? 'Secure payment, held until you approve the delivery' : payoutHold(booking.package_details ? booking : bookingRow).promised ? 'Secure payment, held until your photos arrive' : 'Secure payment, held until your shoot is done' },
        },
      });
    }

    let session;
    try {
      session = await ctx.stripe('checkout/sessions', {
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: booking.id,
        expires_at: expiresAt,
        line_items: lineItems,
        payment_intent_data: { transfer_group: booking.id, metadata: { booking_id: booking.id } },
        metadata: { kind: 'booking', booking_id: booking.id },
        // From the app: a simple "done, close this window" page instead of the website booking page
        success_url: okUrl,
        cancel_url: cancelUrl,
      }, { idempotencyKey: `checkout-${booking.id}` });
    } catch (e) {
      await giveUp();
      throw e;
    }

    await ctx.db(`bookings?id=eq.${booking.id}`, { method: 'PATCH', body: { stripe_checkout_session_id: session.id }, prefer: 'return=minimal' });
    return json({ url: session.url, booking_id: booking.id, ...(dealPct ? { deal_pct: dealPct } : {}) });
  });
}

startServer(createHandler);
