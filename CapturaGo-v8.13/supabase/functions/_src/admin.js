// ── admin: everything the admin panel needs. Only users in the `admins` table. ──
const LIVE = ['paid', 'confirmed', 'delivered', 'completed', 'disputed'];

async function overview(ctx) {
  const now = ctx.nowMs();
  const since30 = new Date(now - 30 * 86400000).toISOString();
  const [creators, bookings, boosts, inquiries, runs, reports, convs, listingReports] = await Promise.all([
    ctx.db('photographers?select=id,city,packages,payouts_enabled,hidden,created_at&limit=10000'),
    ctx.db('bookings?select=status,total_cents,client_fee_cents,creator_fee_cents,created_at&limit=20000'),
    ctx.db('boost_purchases?select=amount_cents,created_at&limit=20000'),
    ctx.db(`inquiries?select=id&created_at=gte.${encodeURIComponent(since30)}&limit=20000`),
    ctx.db('job_runs?select=started_at,finished_at,summary,error&order=started_at.desc&limit=5'),
    ctx.db('message_reports?select=id&status=eq.open&limit=1000').catch(() => []),
    ctx.db(`conversations?select=id&created_at=gte.${encodeURIComponent(since30)}&limit=20000`).catch(() => []),
    ctx.db('listing_reports?select=id&status=eq.open&limit=1000').catch(() => []),
  ]);
  const cities = {};
  for (const c of creators) { const k = String(c.city || '').split(',')[0].trim() || '—'; cities[k] = (cities[k] || 0) + 1; }
  const byStatus = {};
  let gmv = 0, gmv30 = 0, revenue = 0, revenue30 = 0;
  for (const b of bookings) {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    if (LIVE.includes(b.status)) { gmv += b.total_cents; if (b.created_at >= since30) gmv30 += b.total_cents; }
    if (b.status === 'completed') { const fee = b.client_fee_cents + b.creator_fee_cents; revenue += fee; if (b.created_at >= since30) revenue30 += fee; }
  }
  let boostRevenue = 0, boostRevenue30 = 0;
  for (const p of boosts) { boostRevenue += p.amount_cents; if (p.created_at >= since30) boostRevenue30 += p.amount_cents; }
  return {
    creators: {
      total: creators.length,
      visible: creators.filter((c) => !c.hidden).length,
      with_packages: creators.filter((c) => Array.isArray(c.packages) && c.packages.length).length,
      payouts_enabled: creators.filter((c) => c.payouts_enabled).length,
      new_30d: creators.filter((c) => c.created_at >= since30).length,
      top_cities: Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 8),
    },
    bookings: { by_status: byStatus, total: bookings.length },
    money: { gmv_cents: gmv, gmv_30d_cents: gmv30, fee_revenue_cents: revenue, fee_revenue_30d_cents: revenue30, boost_revenue_cents: boostRevenue, boost_revenue_30d_cents: boostRevenue30 },
    inquiries_30d: inquiries.length,
    conversations_30d: convs.length,
    open_reports: reports.length,
    open_listing_reports: listingReports.length,
    job_runs: runs,
  };
}

/** The statement a creator gets for one year: the details and amounts we report (DAC7). */
function dac7StatementHtml(r, year, l, siteUrl) {
  const t = r.tax || {};
  const name = t.kind === 'business' ? t.business_name : `${t.first_name || ''} ${t.last_name || ''}`.trim();
  const tin = t.tin ? `•••• ${escHtml(String(t.tin).replace(/\s/g, '').slice(-4))}` : escHtml(L(l, 'none (place of birth: {place})', { place: t.birth_place || '—' }));
  const row = (label, value) => `<tr><td style="padding:4px 12px 4px 0;color:#7D6A53">${escHtml(label)}</td><td style="padding:4px 0">${value}</td></tr>`;
  const q = (r.quarters || []).map((x, i) => `<tr><td style="padding:4px 12px 4px 0">Q${i + 1}</td><td style="padding:4px 12px 4px 0;text-align:right">${euro(Number(x.amount_cents) || 0)}</td><td style="padding:4px 12px 4px 0;text-align:right">${Number(x.count) || 0}</td><td style="padding:4px 0;text-align:right">${euro(Number(x.fees_cents) || 0)}</td></tr>`).join('');
  return `<p>${L(l, 'Hi,')}</p>`
    + `<p>${r.reportable ? L(l, 'As required by EU law (the DAC7 directive), CapturaGo reports the earnings of creators who live in the EU to the Slovak tax authority (Finančná správa), which shares them with the tax authority of your country. This is what we report for {year}:', { year })
      : L(l, 'Here is the summary of your earnings on CapturaGo in {year}. You live outside the EU, so it isn\'t reported to an EU tax authority — keep it for your own tax return:', { year })}</p>`
    + `<table style="border-collapse:collapse;font-size:14px">${row(L(l, 'Name'), escHtml(name))}${row(L(l, 'Address'), escHtml([t.address, [t.postal_code, t.city].filter(Boolean).join(' '), t.country].filter(Boolean).join(', ')))}${row(L(l, 'Tax number'), tin)}${t.vat_number ? row(L(l, 'VAT number'), escHtml(t.vat_number)) : ''}${t.business_number ? row(L(l, 'Registration number'), escHtml(t.business_number)) : ''}</table>`
    + `<table style="border-collapse:collapse;font-size:14px;margin-top:12px"><tr><th style="text-align:left;padding:4px 12px 4px 0">${L(l, 'Quarter')}</th><th style="text-align:right;padding:4px 12px 4px 0">${L(l, 'Paid to you')}</th><th style="text-align:right;padding:4px 12px 4px 0">${L(l, 'Jobs')}</th><th style="text-align:right;padding:4px 0">${L(l, 'Our fees')}</th></tr>${q}`
    + `<tr><td style="padding:6px 12px 4px 0"><strong>${L(l, 'Total')}</strong></td><td style="padding:6px 12px 4px 0;text-align:right"><strong>${euro(Number(r.amount_cents) || 0)}</strong></td><td style="padding:6px 12px 4px 0;text-align:right"><strong>${Number(r.jobs) || 0}</strong></td><td style="padding:6px 0;text-align:right"><strong>${euro(Number(r.fees_cents) || 0)}</strong></td></tr></table>`
    + `<p>${L(l, '“Paid to you” is the price of the shoots that were paid out to you in that quarter, before our fees; tips and payments outside CapturaGo aren\'t included.')}</p>`
    + `<p>${L(l, 'If anything is wrong, correct it in {link} and reply to this email so we can update the report.', { link: `<a href="${siteUrl}/dashboard.html#payments">${L(l, 'your tax details')}</a>` })}</p>`;
}

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    if (!(await isAdmin(ctx, user.id))) throw new HttpError(403, 'Not allowed.');
    const body = await readJson(req);
    const action = String(body.action || '');

    if (action === 'whoami') return json({ admin: true, email: user.email });
    if (action === 'overview') return json(await overview(ctx));

    if (action === 'bookings') {
      const status = String(body.status || '');
      const filter = /^[a-z_]{3,20}$/.test(status) ? `&status=eq.${status}` : '';
      const cols = 'id,created_at,status,booking_type,shoot_date,package_name,client_name,client_email,price_cents,client_fee_cents,creator_fee_cents,total_cents,delivery_url,paid_at,photographers(name,city)';
      let rows;
      try { rows = await ctx.db(`bookings?select=${cols},dispute_reason,dispute_note,package_details,photos_promised,photos_delivered_at,shoot_city${filter}&order=created_at.desc&limit=200`); }
      catch { rows = null; }
      if (!rows) try { rows = await ctx.db(`bookings?select=${cols},dispute_reason,dispute_note,package_details${filter}&order=created_at.desc&limit=200`); }
      catch { rows = null; }
      if (!rows) try { rows = await ctx.db(`bookings?select=${cols},dispute_reason,dispute_note${filter}&order=created_at.desc&limit=200`); }
      catch { rows = await ctx.db(`bookings?select=${cols}${filter}&order=created_at.desc&limit=200`); } // database not updated yet
      return json({ bookings: rows });
    }

    // ── Search insights: unmet demand, supply vs demand per city, funnel
    if (action === 'insights') {
      const daysBack = [7, 30, 90, 365].includes(Number(body.days)) ? Number(body.days) : 30;
      const data = await ctx.db('rpc/admin_insights', { method: 'POST', body: { p_days: daysBack } });
      return json(data || {});
    }

    // ── Reported profiles / portfolio photos
    if (action === 'listing_reports') {
      const status = body.status === 'resolved' ? 'resolved' : 'open';
      const rows = await ctx.db(`listing_reports?select=id,created_at,reason,details,photo_url,status,photographer_id,photographers(name,city,hidden,handle)&status=eq.${status}&order=created_at.desc&limit=200`);
      return json({ reports: rows.map((r) => ({
        id: r.id, created_at: r.created_at, reason: r.reason, details: r.details, photo_url: r.photo_url, status: r.status,
        photographer_id: r.photographer_id, name: r.photographers ? r.photographers.name : '—', city: r.photographers ? r.photographers.city : '',
        hidden: !!(r.photographers && r.photographers.hidden),
      })) });
    }
    if (action === 'listing_report_resolve') {
      const id = String(body.report_id || '');
      if (!UUID_RE.test(id)) throw new HttpError(404, 'Report not found.');
      const rows = await ctx.db(`listing_reports?id=eq.${id}&select=id`, { method: 'PATCH', body: { status: 'resolved' } });
      if (!rows.length) throw new HttpError(404, 'Report not found.');
      return json({ resolved: id });
    }
    // Remove one reported portfolio photo from a listing (the creator keeps the rest)
    if (action === 'gallery_photo_remove') {
      const id = String(body.photographer_id || '');
      const url = String(body.url || '');
      if (!UUID_RE.test(id) || !/^https:\/\//.test(url)) throw new HttpError(400, 'Invalid request.');
      const [p] = await ctx.db(`photographers?id=eq.${id}&select=gallery,cover_image_url`);
      if (!p) throw new HttpError(404, 'Creator not found.');
      const gallery = (Array.isArray(p.gallery) ? p.gallery : []).filter((g) => g && g.url !== url && g.thumb !== url);
      const patch = { gallery };
      if (p.cover_image_url === url) patch.cover_image_url = null;
      if (gallery.length === (p.gallery || []).length && !patch.hasOwnProperty('cover_image_url')) throw new HttpError(404, 'That photo is not on this profile any more.');
      await ctx.db(`photographers?id=eq.${id}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
      return json({ removed: true });
    }



    // ── Founding creators: open cities, see who claimed a spot, remove a spot, invite listed creators
    if (action === 'founding') {
      const data = await ctx.db('rpc/admin_founding_overview', { method: 'POST', body: {} });
      return json(data || { cities: [], claims: [] });
    }
    if (action === 'founding_save') {
      const city = String(body.city || '').trim();
      if (city.length < 2 || city.length > 80) throw new HttpError(400, 'Enter a city name.');
      const slots = Math.round(Number(body.slots)), perk = Math.round(Number(body.perk_days));
      if (!Number.isFinite(slots) || slots < 1 || slots > 100) throw new HttpError(400, 'Spots: 1 to 100.');
      if (!Number.isFinite(perk) || perk < 0 || perk > 365) throw new HttpError(400, 'Free boost: 0 to 365 days.');
      const row = await ctx.db('rpc/admin_founding_save', { method: 'POST', body: { p_city: city, p_slots: slots, p_perk_days: perk, p_active: body.active !== false } });
      return json({ city: row });
    }
    if (action === 'founding_revoke') {
      const id = String(body.claim_id || '');
      if (!UUID_RE.test(id)) throw new HttpError(404, 'Founding spot not found.');
      const ok = await ctx.db('rpc/admin_founding_revoke', { method: 'POST', body: { p_claim_id: id, p_reason: String(body.reason || '').slice(0, 300) } });
      if (ok !== true) throw new HttpError(404, 'This spot was already removed.');
      return json({ revoked: id });
    }
    if (action === 'founding_invite') {
      const key = String(body.city_key || '');
      if (!/^[^,]{2,60}$/.test(key) || key !== key.toLowerCase()) throw new HttpError(400, 'Invalid city.');
      const [city] = await ctx.db(`founding_cities?city_key=eq.${encodeURIComponent(key)}&select=city_label,slots,perk_days,active,invited_at`);
      if (!city || !city.active) throw new HttpError(404, 'Open the city first.');
      const people = await ctx.db('rpc/admin_founding_invitees', { method: 'POST', body: { p_key: key } });
      if (!people || !people.length) {
        if (city.invited_at && ctx.nowMs() - Date.parse(city.invited_at) < 7 * 86400000) throw new HttpError(429, 'Creators in this city were emailed in the last 7 days.');
        return json({ sent: 0 });
      }
      let sent = 0;
      for (const p of people) {
        const l = await mailLang(ctx, null, p.email);
        const spots = L(l, '<strong>{n} founding creator spots</strong>', { n: city.slots }), where = `<strong>${escHtml(city.city_label)}</strong>`;
        const ok = await sendEmail(ctx, deps, p.email, L(l, 'Founding creator spots are open in {city}', { city: city.city_label }),
          hiP(l, escHtml(p.name)) + `<p>${city.perk_days ? L(l, 'We\'re opening {spots} in {city}. Founding creators get a 🏅 badge on their profile and a <strong>free {n}-day boost</strong> to the top of the results.', { spots, city: where, n: city.perk_days }) : L(l, 'We\'re opening {spots} in {city}. Founding creators get a 🏅 badge on their profile.', { spots, city: where })}</p>`
          + `<p>${L(l, 'To claim yours: finish your listing (a cover photo, at least 3 portfolio photos, one package and a description), then press <strong>Claim my spot</strong> in your dashboard.')}</p>`
          + `<p><a href="${ctx.siteUrl}/dashboard.html#overview">${L(l, 'Open my dashboard')}</a></p><p style="color:#7D6A53;font-size:13px">${L(l, 'First come, first served. One spot per person.')}</p>`);
        if (ok) sent++;
      }
      return json({ sent, total: people.length });
    }

    if (action === 'booking_refund' || action === 'booking_release') {
      const id = String(body.booking_id || '');
      if (!UUID_RE.test(id)) throw new HttpError(404, 'Booking not found.');
      const [b] = await ctx.db(`bookings?id=eq.${id}&select=*`);
      if (!b) throw new HttpError(404, 'Booking not found.');
      if (action === 'booking_refund') {
        if (!['paid', 'confirmed', 'delivered', 'disputed'].includes(b.status)) throw new HttpError(400, `A ${b.status} booking can't be refunded here.`);
        const refundId = await refundBooking(ctx, b);
        const nb = await moveBooking(ctx, id, b.status, 'refunded', { stripe_refund_id: refundId });
        if (!nb) throw new HttpError(409, 'The booking changed meanwhile. Refresh and check.');
        const l = await mailLang(ctx, b.client_user_id, b.client_email);
        await sendEmail(ctx, deps, b.client_email, clientSubject(b, L(l, 'Refund issued: {pkg}', { pkg: b.package_name }), l), hiP(l, escHtml(b.client_name)) + `<p>${L(l, 'We\'ve refunded {amount} for {pkg}. It can take 5–10 days to appear.', { amount: refundText(b, l), pkg: `<strong>${escHtml(b.package_name)}</strong>` })}</p>`);
        return json({ booking: nb });
      }
      if (!['confirmed', 'delivered', 'disputed'].includes(b.status)) throw new HttpError(400, `A ${b.status} booking can't be paid out.`);
      const transferId = await releaseBooking(ctx, b);
      const nb = await moveBooking(ctx, id, b.status, 'completed', { stripe_transfer_id: transferId });
      if (!nb) throw new HttpError(409, 'The booking changed meanwhile. Refresh and check.');
      return json({ booking: nb });
    }

    // ── EU DAC7: the yearly report (per creator and quarter) and the statement every creator must get ──
    if (action === 'dac7' || action === 'dac7_statements') {
      const year = Math.round(Number(body.year));
      if (!Number.isInteger(year) || year < 2023 || year > 2100) throw new HttpError(400, 'Choose a year.');
      const rows = (await ctx.db('rpc/dac7_report', { method: 'POST', body: { p_year: year } })) || [];
      if (action === 'dac7') return json({ year, rows, hold_on: String(ctx.env('TAX_INFO_HOLD', '')).toLowerCase() === 'on' });
      const resend = body.resend === true;
      let sent = 0, skipped = 0, failed = 0;
      for (const r of rows) {
        if (!r.tax || !r.email || (r.statement_sent_at && !resend)) { skipped++; continue; }
        if (sent >= 200) break;   // a batch at a time; press again for the rest
        const l = await mailLang(ctx, r.user_id, r.email);
        if (!(await sendEmail(ctx, deps, r.email, L(l, 'Your CapturaGo earnings statement for {year} (DAC7)', { year }), dac7StatementHtml(r, year, l, ctx.siteUrl)))) { failed++; continue; }
        await ctx.db('dac7_statements', { method: 'POST', body: { tax_info_id: r.tax.id, year }, prefer: 'resolution=merge-duplicates,return=minimal' });
        sent++;
      }
      return json({ year, sent, skipped, failed });
    }

    if (action === 'gifts') {
      const q = String(body.q || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
      const code = q ? await ctx.db('rpc/gift_code_norm', { method: 'POST', body: { p: q } }).catch(() => null) : null;
      const filter = code ? `&code=eq.${encodeURIComponent(code)}` : '';
      const rows = await ctx.db(`gift_cards?select=id,code,buyer_email,recipient_name,recipient_email,amount_cents,balance_cents,status,created_at,paid_at,expires_at${filter}&status=neq.expired_checkout&order=created_at.desc&limit=200`);
      return json({ gifts: rows });
    }
    if (action === 'gift_refund') {
      const id = String(body.gift_id || '');
      if (!UUID_RE.test(id)) throw new HttpError(404, 'Gift card not found.');
      const [g] = await ctx.db(`gift_cards?id=eq.${id}&select=*`);
      if (!g) throw new HttpError(404, 'Gift card not found.');
      if (g.status !== 'active' || !g.stripe_payment_intent_id) throw new HttpError(400, `A ${g.status} gift card can't be refunded.`);
      if (g.balance_cents !== g.amount_cents) throw new HttpError(400, 'This gift card has already been used, so it can\'t be refunded.');
      // Lock it first (a booking can't use it any more), then refund; if Stripe fails, it becomes usable again
      const locked = await ctx.db(`gift_cards?id=eq.${id}&status=eq.active&balance_cents=eq.${g.amount_cents}`, { method: 'PATCH', body: { status: 'refunded', balance_cents: 0 } });
      if (!locked.length) throw new HttpError(409, 'The gift card changed meanwhile. Refresh and check.');
      let r;
      try { r = await ctx.stripe('refunds', { payment_intent: g.stripe_payment_intent_id, metadata: { gift_id: id } }, { idempotencyKey: `refund-gift-${id}` }); }
      catch (e) { await ctx.db(`gift_cards?id=eq.${id}&status=eq.refunded`, { method: 'PATCH', body: { status: 'active', balance_cents: g.amount_cents }, prefer: 'return=minimal' }); throw e; }
      const [ng] = await ctx.db(`gift_cards?id=eq.${id}`, { method: 'PATCH', body: { stripe_refund_id: r.id } });
      if (g.buyer_email) {
        const l = await mailLang(ctx, g.buyer_user_id, g.buyer_email);
        await sendEmail(ctx, deps, g.buyer_email, L(l, 'Gift card refunded'), `<p>${L(l, 'Hi,')}</p><p>${L(l, 'We\'ve refunded your CapturaGo gift card ({amount}). The code no longer works. The refund can take 5–10 days to appear.', { amount: euro(g.amount_cents) })}</p>`);
      }
      return json({ gift: ng });
    }

    if (action === 'partners') {
      const rows = await ctx.db('partners?select=*&order=created_at.desc&limit=300');
      const owed = await ctx.db('partner_earnings?status=eq.owed&select=partner_id,amount_cents&limit=10000');
      const sum = {};
      for (const e of owed || []) sum[e.partner_id] = (sum[e.partner_id] || 0) + e.amount_cents;
      const emails = await Promise.all(rows.map((p) => accountEmail(ctx, deps, p.user_id)));
      return json({ partners: rows.map((p, i) => ({ ...p, email: emails[i], owed_cents: sum[p.id] || 0 })) });
    }
    if (action === 'partner_decide') {
      const id = String(body.partner_id || ''), decision = String(body.decision || '');
      if (!UUID_RE.test(id)) throw new HttpError(404, 'Partner not found.');
      if (!['approve', 'reject', 'pause'].includes(decision)) throw new HttpError(400, 'Unknown decision.');
      const [p] = await ctx.db(`partners?id=eq.${id}&select=*`);
      if (!p) throw new HttpError(404, 'Partner not found.');
      let patch;
      if (decision === 'approve') {
        let code = p.code;
        if (!code) {   // a short, readable code from the name + 4 random symbols
          const stem = String(p.name).normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'CG';
          const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
          for (let i = 0; i < 6 && !code; i++) {
            const bytes = new Uint8Array(4); crypto.getRandomValues(bytes);
            const c = stem + Array.from(bytes, (x) => A[x % A.length]).join('');
            const taken = await ctx.db(`partners?code=eq.${c}&select=id`);
            if (!taken.length) code = c;
          }
          if (!code) throw new HttpError(500, 'Could not make a code. Try again.');
        }
        patch = { status: 'approved', code, approved_at: p.approved_at || new Date(ctx.nowMs()).toISOString() };
      } else patch = { status: decision === 'reject' ? 'rejected' : 'paused' };
      const [np] = await ctx.db(`partners?id=eq.${id}`, { method: 'PATCH', body: patch });
      const email = await accountEmail(ctx, deps, p.user_id);
      const l = email ? await mailLang(ctx, p.user_id, email) : 'en';
      if (email && decision === 'approve' && p.status !== 'approved') {
        await sendEmail(ctx, deps, email, L(l, 'Welcome to the CapturaGo partner program'),
          hiP(l, escHtml(String(p.contact_name).split(' ')[0])) + `<p>${L(l, '{name} is now a CapturaGo partner. Your guests get a lower service fee when they book through your link, and you get a 3% thank-you of the package price for every completed shoot.', { name: `<strong>${escHtml(p.name)}</strong>` })}</p>`
          + `<p>${L(l, 'Your link: {link}', { link: `<a href="${ctx.siteUrl}/?p=${np.code}">${ctx.siteUrl}/?p=${np.code}</a>` })}<br/>${L(l, 'Print your QR card and see your bookings on {page}.', { page: `<a href="${ctx.siteUrl}/partners.html">${L(l, 'your partner page')}</a>` })}</p>`);
      }
      if (email && decision === 'reject' && p.status === 'pending') {
        await sendEmail(ctx, deps, email, L(l, 'Your CapturaGo partner application'),
          hiP(l, escHtml(String(p.contact_name).split(' ')[0])) + `<p>${L(l, 'Thank you for applying. We can\'t add {name} as a partner right now. You can apply again in 30 days, or reply to this email if you have questions.', { name: escHtml(p.name) })}</p>`);
      }
      return json({ partner: np });
    }
    if (action === 'partner_paid') {
      const id = String(body.partner_id || '');
      if (!UUID_RE.test(id)) throw new HttpError(404, 'Partner not found.');
      const rows = await ctx.db(`partner_earnings?partner_id=eq.${id}&status=eq.owed`, { method: 'PATCH', body: { status: 'paid', paid_at: new Date(ctx.nowMs()).toISOString() } });
      return json({ paid: rows.length, amount_cents: rows.reduce((a, r) => a + r.amount_cents, 0) });
    }

    if (action === 'creators') {
      const q = String(body.q || '').trim().slice(0, 60).replace(/[,()*%]/g, ' ');
      const filter = q ? `&or=(name.ilike.*${encodeURIComponent(q)}*,city.ilike.*${encodeURIComponent(q)}*,email.ilike.*${encodeURIComponent(q)}*)` : '';
      const rows = await ctx.db(`photographers?select=id,name,city,email,services,verified,featured,hidden,payouts_enabled,rating,reviews_count,packages,created_at${filter}&order=created_at.desc&limit=200`);
      return json({ creators: rows.map((c) => ({ ...c, packages: Array.isArray(c.packages) ? c.packages.length : 0 })) });
    }

    if (action === 'creator_update') {
      const id = String(body.id || '');
      if (!UUID_RE.test(id)) throw new HttpError(404, 'Creator not found.');
      const patch = {};
      if (typeof body.hidden === 'boolean') patch.hidden = body.hidden;
      if (typeof body.featured === 'boolean') patch.featured = body.featured;
      if (body.verified !== undefined) {
        const v = Number(body.verified);
        if (!Number.isInteger(v) || v < 0 || v > 3) throw new HttpError(400, 'Verified level must be 0–3.');
        patch.verified = v;
      }
      if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to change.');
      const rows = await ctx.db(`photographers?id=eq.${id}&select=id,name,hidden,featured,verified`, { method: 'PATCH', body: patch });
      if (!rows.length) throw new HttpError(404, 'Creator not found.');
      return json({ creator: rows[0] });
    }

    if (action === 'reviews') {
      const rows = await ctx.db('reviews?select=id,created_at,rating,comment,reviewer_name,photographer_id,photographers(name,city)&order=created_at.desc&limit=200');
      return json({ reviews: rows });
    }

    if (action === 'review_delete') {
      const id = String(body.id || '');
      if (!UUID_RE.test(id)) throw new HttpError(404, 'Review not found.');
      const rows = await ctx.db(`reviews?id=eq.${id}&select=id`, { method: 'DELETE' });
      if (!rows.length) throw new HttpError(404, 'Review not found.');
      return json({ deleted: id });
    }

    // ── Reported conversations. Staff can read a conversation ONLY when one of the two people reported it.
    if (action === 'reports') {
      const status = body.status === 'resolved' ? 'resolved' : 'open';
      const rows = await ctx.db(`message_reports?select=id,created_at,reason,status,reporter_id,conversation_id,conversations(client_name,client_user_id,creator_user_id,blocked_by,photographers(name,city))&status=eq.${status}&order=created_at.desc&limit=200`);
      return json({ reports: rows.map((r) => {
        const c = r.conversations || {};
        return {
          id: r.id, created_at: r.created_at, reason: r.reason, status: r.status, conversation_id: r.conversation_id,
          client_name: c.client_name || '—', creator_name: c.photographers ? c.photographers.name : '—',
          reported_by: r.reporter_id && r.reporter_id === c.client_user_id ? 'traveller' : r.reporter_id && r.reporter_id === c.creator_user_id ? 'creator' : '—',
          blocked: !!c.blocked_by,
        };
      }) });
    }

    if (action === 'report_view') {
      const id = String(body.report_id || '');
      if (!UUID_RE.test(id)) throw new HttpError(404, 'Report not found.');
      const [rep] = await ctx.db(`message_reports?id=eq.${id}&select=conversation_id,conversations(client_user_id,creator_user_id,client_name,photographers(name))`);
      if (!rep || !rep.conversations) throw new HttpError(404, 'This conversation no longer exists.');
      const c = rep.conversations;
      const msgs = await ctx.db(`messages?conversation_id=eq.${rep.conversation_id}&select=sender_id,body,created_at&order=created_at.asc&limit=500`);
      return json({ messages: msgs.map((m) => ({
        from: m.sender_id === c.client_user_id ? `${c.client_name} (traveller)` : m.sender_id === c.creator_user_id ? `${c.photographers ? c.photographers.name : 'Creator'} (creator)` : '—',
        body: m.body, created_at: m.created_at,
      })) });
    }

    if (action === 'report_resolve') {
      const id = String(body.report_id || '');
      if (!UUID_RE.test(id)) throw new HttpError(404, 'Report not found.');
      const rows = await ctx.db(`message_reports?id=eq.${id}&select=id`, { method: 'PATCH', body: { status: 'resolved' } });
      if (!rows.length) throw new HttpError(404, 'Report not found.');
      return json({ resolved: id });
    }

    throw new HttpError(400, 'Unknown action.');
  });
}

startServer(createHandler);
