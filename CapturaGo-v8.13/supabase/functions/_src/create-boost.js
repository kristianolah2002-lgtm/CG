// ── create-boost: creators pay for featured placement ──
// The boost is activated only by the Stripe webhook after payment succeeds.
function boostPlans(ctx) {
  const cents = (name, def) => {
    const n = Number(ctx.env(name, def));
    return Number.isInteger(n) && n >= 100 ? n : def;
  };
  return {
    week: { days: 7, cents: cents('BOOST_WEEK_CENTS', 900), label: '7-day boost' },
    month: { days: 30, cents: cents('BOOST_MONTH_CENTS', 2400), label: '30-day boost' },
  };
}

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    const plan = boostPlans(ctx)[String(body.plan || '')];
    if (!plan) throw new HttpError(400, 'Choose a boost plan.');

    const [listing] = await ctx.db(`photographers?user_id=eq.${user.id}&select=id,name`);
    if (!listing) throw new HttpError(400, 'Create your creator listing first.');

    const session = await ctx.stripe('checkout/sessions', {
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: listing.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: plan.cents,
          product_data: {
            name: `CapturaGo ${plan.label}`,
            description: 'Your listing appears first in search results, labelled "Sponsored".',
          },
        },
      }],
      metadata: { kind: 'boost', photographer_id: listing.id, days: String(plan.days) },
      success_url: `${ctx.siteUrl}/dashboard.html?boost=ok`,
      cancel_url: `${ctx.siteUrl}/dashboard.html?boost=cancel`,
    });
    return json({ url: session.url });
  });
}

startServer(createHandler);
