// ── create-gift: buy a CapturaGo gift card (signed-in buyer) ──
// The code is created by the server (80 random bits) and only becomes usable after Stripe confirms the payment.
const GIFT_MIN = 25, GIFT_MAX = 1000;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    const amount = Number(body.amount_eur);
    if (!Number.isInteger(amount) || amount < GIFT_MIN || amount > GIFT_MAX) throw new HttpError(400, `Choose an amount from €${GIFT_MIN} to €${GIFT_MAX} (whole euros).`);
    const clean = (v, max) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
    const recipientName = clean(body.recipient_name, 60);
    const message = String(body.message || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, 300);
    const recipientEmail = clean(body.recipient_email, 254).toLowerCase();
    if (recipientEmail && !EMAIL_RE.test(recipientEmail)) throw new HttpError(400, "The recipient's email doesn't look right.");

    // A few unpaid gift checkouts at most (stops someone from creating thousands of codes)
    const since = encodeURIComponent(new Date(ctx.nowMs() - 3600000).toISOString());
    const open = await ctx.db(`gift_cards?buyer_user_id=eq.${user.id}&status=eq.pending_payment&created_at=gt.${since}&select=id&limit=6`);
    if ((open || []).length >= 5) throw new HttpError(429, 'You have several unfinished gift card payments. Please try again in an hour.');

    let gift = null;
    for (let i = 0; i < 4 && !gift; i++) {
      try {
        [gift] = await ctx.db('gift_cards', { method: 'POST', body: {
          code: newGiftCode(), buyer_user_id: user.id, buyer_email: user.email, amount_cents: amount * 100, balance_cents: amount * 100,
          recipient_name: recipientName || null, recipient_email: recipientEmail || null, message: message || null,
        } });
      } catch (e) { if (!/duplicate|unique/i.test(String(e && e.message))) throw e; }   // code already taken → new code
    }
    if (!gift) throw new HttpError(500, 'Could not create the gift card. Please try again.');

    let session;
    try {
      session = await ctx.stripe('checkout/sessions', {
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: gift.id,
        line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: amount * 100,
          product_data: { name: `CapturaGo gift card — €${amount}`, description: `${recipientName ? `For ${recipientName}. ` : ''}Valid 3 years for any shoot on CapturaGo.` } } }],
        payment_intent_data: { metadata: { gift_id: gift.id } },
        metadata: { kind: 'gift', gift_id: gift.id },
        success_url: `${ctx.siteUrl}/gift.html?g=${gift.id}&s=ok`,
        cancel_url: `${ctx.siteUrl}/gift.html?s=cancel`,
      }, { idempotencyKey: `gift-${gift.id}` });
    } catch (e) {
      await ctx.db(`gift_cards?id=eq.${gift.id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'expired_checkout' }, prefer: 'return=minimal' }).catch(() => {});
      throw e;
    }
    await ctx.db(`gift_cards?id=eq.${gift.id}`, { method: 'PATCH', body: { stripe_checkout_session_id: session.id }, prefer: 'return=minimal' });
    return json({ url: session.url, gift_id: gift.id });
  });
}

startServer(createHandler);
