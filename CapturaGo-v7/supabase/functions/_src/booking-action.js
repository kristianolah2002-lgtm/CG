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
