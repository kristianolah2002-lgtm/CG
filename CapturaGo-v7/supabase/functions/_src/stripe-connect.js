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
