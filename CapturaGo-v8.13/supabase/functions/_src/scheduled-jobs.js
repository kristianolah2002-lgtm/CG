// ── scheduled-jobs: runs every hour (Supabase Cron) or from the admin panel ──
// Deploy WITHOUT JWT verification; it checks its own secret (x-cron-secret) or an admin login.
//  1. Unpaid checkouts older than 2 h                   → expired (gift card amount goes back on the card)
//     Split payments past their deadline               → expired, everyone who paid refunded
//  2. Paid but unconfirmed by the creator:
//       after 24 h                                       → reminder email to creator (once)
//       after 72 h, or session starts within 1 day       → cancelled + full refund (traveller protected)
//  3. In-person shoots 3+ days in the past (confirmed)   → payout released → completed
//     Remote deliveries 72 h+ after delivery             → payout released → completed
//  4. Shoot tomorrow / delivery due tomorrow            → reminder emails (once)
//  5. Remote delivery past its due date                 → "you can cancel for a refund" email (once)
//  6. Housekeeping (old rate-limit records)
//  7. Unread private messages (10 min+ old)              → one email per unread streak, without the message text
//  8. Delivered photos: reminder 14 days before deletion; deleted 90 days after completion,
//     30 days after a cancelled/declined/refunded booking, or when the traveller deleted their account
//  9. "Notify me" city alerts: a creator joined the city → one email, then the alert is done
// 10. Housekeeping: search insights older than 180 days, share links expired a week ago
// 11. Reply times: recalculated for every creator (badge "usually replies within …")
// 12. A traveller has waited 2+ hours for the creator's answer → one reminder to the creator per waiting period
// 13. Review request 2 days after a completed booking (once; optional email with one-click unsubscribe)
// 14. "A year ago" email on the first anniversary of an in-person shoot (once; optional, one-click unsubscribe)
// 15. Photos promised "within N days" (package) and not sent yet → one reminder to the creator;
//     2 days later still not sent → one email to the traveller (payment still on hold, how to report it)
//  3. (Packages that promise photos: the payout waits until 3 days after the photos were sent)
//  9. (also) a creator plans a trip to a followed city → one email
// 16. Calendar sync: busy days read from creators' own calendars (every 3 hours)
// 18. Invite rewards: both creators emailed about their free 7-day boost (the database gives it)
// 17. Shoot requests: new request → matching creators emailed once; new offers → one email to the traveller; past requests closed
// 19. Last-minute deals → one email to travellers in that city   20. Text reminders on the shoot day (SMS / WhatsApp)
//  4. + 20. (v8.14) Heavy rain forecast for the shoot day → the reminder email and text suggest moving it (one tap)
// 21. (v8.14) "Notify me" on a fully booked creator → one email (and a text, if asked) when a day opens up or a deal appears
// 23. (v8.17) A new review → the creator (email + push, link to reply); the creator replied → the traveller, once.
// (v1.5 app) Booking emails, "Notify me" alerts and the new-booking email also go to the user's phones as a push (lib.js sendPush).
// 22. (v8.15) EU DAC7: creators who can be paid online are asked for their tax details (then 2 reminders: day 14 and 45).
//     With the secret TAX_INFO_HOLD=on, payouts wait for creators still without details 60 days after the first request.
const BATCH = 50;
const HOUR = 3600000;

/** Email address of an account (service role → Supabase Auth admin API). */
async function authUser(ctx, deps, id) {
  const base = String(ctx.env('SUPABASE_URL', '')).replace(/\/$/, '');
  const key = ctx.env('SUPABASE_SERVICE_ROLE_KEY', '');
  const r = await deps.fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(id)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return r.ok ? r.json() : null;
}

async function runJobs(ctx, deps) {
  const now = ctx.nowMs();
  const nowIso = new Date(now).toISOString();
  const summary = { expired: 0, nudged: 0, auto_refunded: 0, released: 0, reminders: 0, late_notices: 0, message_emails: 0, photo_reminders: 0, photos_deleted: 0, city_alerts: 0,
    reply_stats: 0, reply_nudges: 0, review_requests: 0, anniversaries: 0, photos_due: 0, photos_late: 0, trip_alerts: 0, split_expired: 0, split_refunds: 0, request_alerts: 0, offer_alerts: 0, invite_rewards: 0, calendars_synced: 0, deal_emails: 0, texts: 0, rain_warnings: 0, watch_alerts: 0, tax_requests: 0, tax_held: 0, review_alerts: 0, reply_alerts: 0, errors: 0 };
  const errors = [];
  const fail = (what, id, e) => { summary.errors++; errors.push(`${what} ${id}: ${e && e.message ? e.message : e}`); console.error('[jobs]', what, id, e); };
  const mark = (b, key) => ctx.db(`bookings?id=eq.${b.id}`, { method: 'PATCH', body: { notices: { ...(b.notices || {}), [key]: nowIso } }, prefer: 'return=minimal' });
  // Emails: make(lang) → [subject, html], written in the reader's language
  const dash = (l) => `<p><a href="${ctx.siteUrl}/dashboard.html#bookings">${L(l, 'Open your bookings')}</a></p>`;
  const pkgOf = (b) => `<strong>${escHtml(b.package_name)}</strong>`;
  async function mailClient(b, make) {
    const l = await mailLang(ctx, b.client_user_id, b.client_email);
    const [subject, html] = make(l);
    await sendPush(ctx, deps, b.client_user_id, subject, html, { url: '/bookings', booking_id: b.id });
    return sendEmail(ctx, deps, b.client_email, clientSubject(b, subject, l), `${hiP(l, escHtml(b.client_name))}<p>${html}</p>${dash(l)}`);
  }
  async function mailCreator(b, make) {
    const c = await creatorContact(ctx, b);
    if (!c || !c.email) return;
    const [subject, html] = make(c.lang);
    await sendPush(ctx, deps, c.user_id || b.creator_user_id, subject, html, { url: '/bookings', booking_id: b.id });
    await sendEmail(ctx, deps, c.email, subject, `${hiP(c.lang, escHtml(c.name))}<p>${html}</p>${dash(c.lang)}`);
  }
  const LOCALE = { en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };
  // Weather-aware reminders: heavy rain on the shoot day → offer to move it (free when both agree; max 3 moves)
  const moveLink = (b) => `${ctx.siteUrl}/dashboard.html?move=${b.id}#bookings`;
  const canMove = (b) => b.booking_type !== 'delivery' && ['paid', 'confirmed'].includes(b.status) && !b.proposed_date && (Number(b.reschedules) || 0) < 3;
  const shootCoords = (b) => (b.shoot_city ? b.shoot_coords : (b.photographers && b.photographers.coords)) || null;   // a trip: the trip city
  async function heavyRainFor(b) {
    if (!canMove(b)) return null;
    const w = await rainForecast(ctx, deps, shootCoords(b), b.shoot_date);
    return w && w.heavy ? w : null;
  }
  const rainHtml = (w, b, l) => `<p style="background:#EEF3F8;border-radius:12px;padding:12px 14px">${L(l, '🌧 <strong>Heavy rain is forecast</strong> for the shoot day{detail}.', { detail: w.pct !== null ? L(l, ' ({pct}% chance of rain)', { pct: w.pct }) : '' })} `
    + `${L(l, 'Want to move it? {link} — moving is free if you both agree, and the other person is asked right away.', { link: `<a href="${moveLink(b)}"><strong>${L(l, '📅 Propose a new date')}</strong></a>` })}</p>`;

  const [run] = await ctx.db('job_runs', { method: 'POST', body: { started_at: nowIso } });

  // 1. stale unpaid checkouts (checkout links expire after 30 minutes; split bookings wait for their own deadline)
  const stale = await ctx.db(`bookings?status=eq.pending_payment&split_deadline=is.null&created_at=lt.${encodeURIComponent(new Date(now - 2 * HOUR).toISOString())}&select=id,stripe_checkout_session_id,gift_cents&limit=${BATCH}`);
  for (const b of stale || []) {
    try {
      if (b.stripe_checkout_session_id) await ctx.stripe(`checkout/sessions/${b.stripe_checkout_session_id}/expire`, {}).catch(() => {});
      if (await moveBooking(ctx, b.id, 'pending_payment', 'expired')) {
        summary.expired++;
        if (Number(b.gift_cents) > 0) await ctx.db('rpc/release_gift', { method: 'POST', body: { p_booking: b.id } });
      }
    } catch (e) { fail('expire', b.id, e); }
  }

  // 1b. split payments: not everyone paid before the deadline → everyone who paid is refunded, the day is released
  const lapsed = await ctx.db(`bookings?status=eq.pending_payment&split_deadline=lt.${encodeURIComponent(nowIso)}&select=*&limit=${BATCH}`);
  for (const b of lapsed || []) {
    try {
      if (!(await moveBooking(ctx, b.id, 'pending_payment', 'expired'))) continue;
      summary.split_expired++;
      const shares = await ctx.db(`booking_shares?booking_id=eq.${b.id}&select=id,status,payer_email,stripe_checkout_session_id`);
      for (const s of shares || []) if (s.status === 'pending' && s.stripe_checkout_session_id) await ctx.stripe(`checkout/sessions/${s.stripe_checkout_session_id}/expire`, {}).catch(() => {});
      const paidBy = (shares || []).filter((s) => s.status === 'paid');
      if (paidBy.length) await refundBooking(ctx, b);
      if (paidBy.length) {
        await mailClient(b, (l) => [L(l, 'Split payment didn\'t complete — everyone refunded'), L(l, 'Not everyone paid their share of {pkg} ({date}) in time, so the booking was cancelled and every payment was refunded in full. Refunds can take 5–10 days to appear. You can book again any time — alone or split again.', { pkg: pkgOf(b), date: escHtml(b.shoot_date) })]);
        const lf = await mailLang(ctx, b.client_user_id, b.client_email);   // friends: the language of the person who booked
        const told = new Set([String(b.client_email || '').toLowerCase()]);
        for (const s of paidBy) {
          const e = String(s.payer_email || '').toLowerCase();
          if (!e || told.has(e)) continue;
          told.add(e);
          await sendEmail(ctx, deps, e, L(lf, 'Your share was refunded'), `<p>${L(lf, 'Hi,')}</p><p>${L(lf, 'Not everyone paid their share of {pkg} in time, so the booking was cancelled and your payment was refunded in full. It can take 5–10 days to appear.', { pkg: pkgOf(b) })}</p>`);
        }
      }
    } catch (e) { fail('split', b.id, e); }
  }

  // 1c. safety net: a friend's paid share on a booking that is no longer open (a refund failed earlier) → refund now
  const stranded = await ctx.db(`booking_shares?status=eq.paid&select=booking_id,bookings!inner(status)&bookings.status=in.(expired,cancelled)&limit=${BATCH}`);
  for (const id of [...new Set((stranded || []).map((x) => x.booking_id))]) {
    try { await refundBooking(ctx, { id, split_count: 2 }); summary.split_refunds++; } catch (e) { fail('share refund', id, e); }
  }

  // 2. paid but not confirmed by the creator
  const unconfirmed = await ctx.db(`bookings?status=eq.paid&select=*&order=created_at.asc&limit=${BATCH}`);
  for (const b of unconfirmed || []) {
    try {
      const paidAt = Date.parse(b.paid_at || b.updated_at || b.created_at);
      const hours = (now - paidAt) / HOUR;
      const sessionSoon = b.booking_type !== 'delivery' && ctx.daysUntil(b.shoot_date) <= 1;
      if (hours >= 72 || sessionSoon) {
        const refundId = await refundBooking(ctx, b);
        if (await moveBooking(ctx, b.id, 'paid', 'declined', { stripe_refund_id: refundId })) {
          summary.auto_refunded++;
          await mailClient(b, (l) => [L(l, 'Booking cancelled — full refund'), L(l, 'The creator didn\'t confirm {pkg} in time, so we cancelled it and refunded you in full ({amount}). Refunds can take 5–10 days to appear. Sorry about that — you can book another creator any time.', { pkg: pkgOf(b), amount: refundText(b, l) })]);
          await mailCreator(b, (l) => [L(l, 'Booking cancelled: {pkg}', { pkg: b.package_name }), L(l, 'You didn\'t confirm this booking in time, so it was cancelled and the client was refunded. Please confirm new bookings within 24 hours.')]);
        }
      } else if (hours >= 24 && !(b.notices && b.notices.confirm_nudge)) {
        await mailCreator(b, (l) => [L(l, 'Please confirm: {pkg}', { pkg: b.package_name }), L(l, b.booking_type === 'delivery' ? '{name} paid for {pkg} (due {date}). Please confirm or decline — unconfirmed bookings are cancelled and refunded after 72 hours.' : '{name} paid for {pkg} on {date}. Please confirm or decline — unconfirmed bookings are cancelled and refunded after 72 hours.', { name: escHtml(b.client_name), pkg: pkgOf(b), date: escHtml(b.shoot_date) })]);
        await mark(b, 'confirm_nudge');
        summary.nudged++;
      }
    } catch (e) { fail('unconfirmed', b.id, e); }
  }

  // 3. automatic payouts
  // DAC7 (only when switched on): no payout for creators who still haven't given their tax details after the request and 2 reminders
  let taxHeld = new Set();
  if (String(ctx.env('TAX_INFO_HOLD', '')).toLowerCase() === 'on') {
    try {
      const ids = await ctx.db('rpc/tax_payout_holds', { method: 'POST', body: {} });
      taxHeld = new Set((ids || []).map((x) => (typeof x === 'string' ? x : x && x.tax_payout_holds)).filter(Boolean));
    } catch (e) { if (!/tax_payout_holds/.test(String(e && e.message))) fail('tax-holds', '-', e); }
  }
  const cutoffDate = ctx.isoInDays(-3);
  // Photos promised in the package: not before 3 days after they were sent (the database marks these bookings)
  const sentBefore = encodeURIComponent(new Date(now - RELEASE_DAYS * 86400000).toISOString());
  let sessionsDone;
  try { sessionsDone = await ctx.db(`bookings?status=eq.confirmed&booking_type=eq.session&shoot_date=lte.${cutoffDate}&or=(photos_promised.eq.false,photos_delivered_at.lt.${sentBefore})&select=*&order=shoot_date.asc&limit=${BATCH}`); }
  catch (e) { if (!/photos_promised|photos_delivered_at/.test(String(e && e.message))) throw e; sessionsDone = await ctx.db(`bookings?status=eq.confirmed&booking_type=eq.session&shoot_date=lte.${cutoffDate}&select=*&limit=${BATCH}`); }
  sessionsDone = (sessionsDone || []).filter((b) => { const h = payoutHold(b); return h.releaseAt !== null && h.releaseAt <= now; });   // double check
  const deliveriesDone = await ctx.db(`bookings?status=eq.delivered&delivered_at=lt.${encodeURIComponent(new Date(now - 72 * HOUR).toISOString())}&select=*&limit=${BATCH}`);
  for (const b of [...(sessionsDone || []), ...(deliveriesDone || [])]) {
    if (taxHeld.has(b.creator_user_id)) { summary.tax_held++; continue; }   // released as soon as the details are in
    try {
      const transferId = await releaseBooking(ctx, b);
      if (await moveBooking(ctx, b.id, b.status, 'completed', { stripe_transfer_id: transferId })) {
        summary.released++;
        await mailCreator(b, (l) => [L(l, 'Payment released: {pkg}', { pkg: b.package_name }), L(l, '{amount} is on its way to your payout account. Thank you for a great job!', { amount: euro(b.price_cents - b.creator_fee_cents) })]);
      }
    } catch (e) { fail('release', b.id, e); }
  }

  // 4. reminders for tomorrow
  const tomorrow = ctx.isoInDays(1);
  let due;
  try { due = await ctx.db(`bookings?status=eq.confirmed&shoot_date=eq.${tomorrow}&select=*,photographers(coords)&limit=${BATCH}`); }
  catch { due = await ctx.db(`bookings?status=eq.confirmed&shoot_date=eq.${tomorrow}&select=*&limit=${BATCH}`); }
  for (const b of due || []) {
    if (b.notices && b.notices.reminder) continue;
    try {
      const rain = b.booking_type === 'delivery' ? null : await heavyRainFor(b);
      if (rain) summary.rain_warnings++;
      if (b.booking_type === 'delivery') {
        await mailCreator(b, (l) => [L(l, 'Due tomorrow: {pkg}', { pkg: b.package_name }), L(l, 'Delivery for {pkg} is due tomorrow ({date}). Deliver the files from your dashboard.', { pkg: pkgOf(b), date: escHtml(b.shoot_date) })]);
      } else {
        await mailClient(b, (l) => [rain ? L(l, 'Your shoot is tomorrow — heavy rain forecast: {pkg}', { pkg: b.package_name }) : L(l, 'Your shoot is tomorrow: {pkg}', { pkg: b.package_name }), `${L(l, 'Just a reminder — your shoot {pkg} is tomorrow ({date}).', { pkg: pkgOf(b), date: escHtml(b.shoot_date) })}</p>${rain ? rainHtml(rain, b, l) : ''}${planHtml(b, false, l) || `<p>${L(l, 'Your creator hasn\'t shared a meeting point yet — message them on CapturaGo.')}`}<p>${L(l, 'Enjoy it!')}`]);
        await mailCreator(b, (l) => [rain ? L(l, 'Shoot tomorrow — heavy rain forecast: {pkg}', { pkg: b.package_name }) : L(l, 'Shoot tomorrow: {pkg}', { pkg: b.package_name }), `${L(l, 'Reminder: you\'re shooting {pkg} with {name} tomorrow ({date}).', { pkg: pkgOf(b), name: escHtml(b.client_name), date: escHtml(b.shoot_date) })}</p>${rain ? rainHtml(rain, b, l) : ''}${planHtml(b, true, l) || `<p>${L(l, 'Tip: share a meeting point and time from your bookings so the traveller knows where to go.')}`}<p>`]);
      }
      await mark(b, 'reminder');
      summary.reminders++;
    } catch (e) { fail('reminder', b.id, e); }
  }

  // 5. late remote deliveries
  const late = await ctx.db(`bookings?status=eq.confirmed&booking_type=eq.delivery&shoot_date=lt.${ctx.isoInDays(0)}&select=*&limit=${BATCH}`);
  for (const b of late || []) {
    if (b.notices && b.notices.late) continue;
    try {
      await mailClient(b, (l) => [L(l, 'Delivery is late: {pkg}', { pkg: b.package_name }), L(l, '{pkg} was due on {date} and hasn\'t been delivered yet. You can wait, or cancel for a full refund from your dashboard.', { pkg: pkgOf(b), date: escHtml(b.shoot_date) })]);
      await mailCreator(b, (l) => [L(l, 'Overdue: {pkg}', { pkg: b.package_name }), L(l, 'This order was due on {date}. Please deliver as soon as possible — the client can now cancel for a full refund.', { date: escHtml(b.shoot_date) })]);
      await mark(b, 'late');
      summary.late_notices++;
    } catch (e) { fail('late', b.id, e); }
  }

  // 7. unread private messages → a short email (the text stays private; read it on CapturaGo)
  try {
    const from = encodeURIComponent(new Date(now - 48 * HOUR).toISOString());
    const to = encodeURIComponent(new Date(now - 10 * 60000).toISOString());
    const convs = await ctx.db(`conversations?last_message_at=gte.${from}&last_message_at=lte.${to}&blocked_by=is.null&last_sender_id=not.is.null&select=id,client_user_id,creator_user_id,client_name,last_message_at,last_sender_id,client_read_at,creator_read_at,client_notified_at,creator_notified_at,photographers(name,email,user_id)&order=last_message_at.asc&limit=200`);
    for (const c of convs || []) {
      const toCreator = c.last_sender_id === c.client_user_id;
      const readAt = toCreator ? c.creator_read_at : c.client_read_at;
      const notifiedAt = toCreator ? c.creator_notified_at : c.client_notified_at;
      if (Date.parse(readAt) >= Date.parse(c.last_message_at)) continue;              // already read
      if (notifiedAt && Date.parse(notifiedAt) > Date.parse(readAt)) continue;        // already emailed since they last read
      try {
        let email = null, name = '', sender = '', l = 'en';
        if (toCreator) { email = c.photographers && c.photographers.email; name = c.photographers ? c.photographers.name : ''; l = await mailLang(ctx, c.creator_user_id || (c.photographers && c.photographers.user_id), email); sender = c.client_name || L(l, 'A traveller'); }
        else { const u = await authUser(ctx, deps, c.client_user_id); email = u && u.email; name = c.client_name || ''; l = await mailLang(ctx, c.client_user_id, email); sender = c.photographers ? c.photographers.name : L(l, 'Your creator'); }
        if (!email) continue;
        const sent = await sendEmail(ctx, deps, email, L(l, 'New message from {name}', { name: sender }),
          hiP(l, escHtml(String(name).split(' ')[0])) + `<p>${L(l, '{name} sent you a message on CapturaGo.', { name: `<strong>${escHtml(sender)}</strong>` })}</p><p>${L(l, '{link} — or open the CapturaGo app.', { link: `<a href="${ctx.siteUrl}/dashboard.html?c=${encodeURIComponent(c.id)}">${L(l, 'Read and reply')}</a>` })}</p><p style="color:#7D6A53;font-size:13px">${L(l, 'For your privacy we don\'t include messages in emails. Never pay outside CapturaGo — bookings paid on CapturaGo are protected.')}</p>`);
        if (!sent) continue;
        await ctx.db(`conversations?id=eq.${c.id}`, { method: 'PATCH', body: { [toCreator ? 'creator_notified_at' : 'client_notified_at']: nowIso }, prefer: 'return=minimal' });
        summary.message_emails++;
      } catch (e) { fail('message-email', c.id, e); }
    }
  } catch (e) { fail('message-emails', '-', e); }

  // 8. delivered photos: reminder, then clean-up (keeps storage costs bounded; travellers are told up front)
  try {
    const withPhotos = await ctx.db('booking_photos?select=booking_id&limit=20000');
    const ids = [...new Set((withPhotos || []).map((r) => r.booking_id))];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const rows = await ctx.db(`bookings?id=in.(${chunk.join(',')})&select=id,status,client_user_id,client_name,client_email,package_name,completed_at,updated_at,notices`);
      const purge = [];
      for (const b of rows || []) {
        const since = (iso) => (iso ? (now - Date.parse(iso)) / 86400000 : 0);
        const done = since(b.completed_at || b.updated_at);
        if (!b.client_user_id || (b.status === 'completed' && done >= 90) || (['cancelled', 'declined', 'refunded', 'expired'].includes(b.status) && since(b.updated_at) >= 30)) { purge.push(b.id); continue; }
        if (b.status === 'completed' && done >= 76 && !(b.notices && b.notices.photos_expiring)) {
          try {
            await mailClient(b, (l) => [L(l, 'Your photos will be deleted in 14 days — {pkg}', { pkg: b.package_name }), L(l, 'Your photos from {pkg} are kept for 90 days. Please {link} within the next 14 days.', { pkg: pkgOf(b), link: `<a href="${ctx.siteUrl}/dashboard.html?b=${b.id}#bookings">${L(l, 'download the ones you want to keep')}</a>` })]);
            await mark(b, 'photos_expiring');
            summary.photo_reminders++;
          } catch (e) { fail('photo-reminder', b.id, e); }
        }
      }
      if (purge.length) {
        try { summary.photos_deleted += await purgeBookingPhotos(ctx, deps, purge); } catch (e) { fail('photo-purge', purge.join(','), e); }
      }
    }
  } catch (e) { fail('photos', '-', e); }

  // 9. "notify me" city alerts
  try {
    const due = await ctx.db('rpc/due_city_alerts', { method: 'POST', body: { p_limit: 100 } });
    for (const a of due || []) {
      try {
        const u = await authUser(ctx, deps, a.user_id);
        const link = a.photographer_handle ? `${ctx.siteUrl}/c/${encodeURIComponent(a.photographer_handle)}` : `${ctx.siteUrl}/?creator=${encodeURIComponent(a.photographer_id)}`;
        if (u && u.email) {
          const l = await mailLang(ctx, a.user_id, u.email);
          const sent = await sendEmail(ctx, deps, u.email, L(l, 'A creator joined {city}', { city: a.city_label }),
            `<p>${L(l, 'Hi,')}</p><p>${L(l, 'You asked us to tell you when a creator joins {city}. {name} just did.', { city: `<strong>${escHtml(a.city_label)}</strong>`, name: `<strong>${escHtml(a.photographer_name)}</strong>` })}</p><p>${L(l, '{link} — or browse everyone in {city} on {site}.', { link: `<a href="${link}">${L(l, 'See their profile')}</a>`, city: escHtml(a.city_label), site: `<a href="${ctx.siteUrl}/in/${citySlug(a.city_label) || 'all'}">CapturaGo</a>` })}</p><p style="color:#7D6A53;font-size:13px">${L(l, 'This was a one-time alert. You can follow other cities from the CapturaGo search.')}</p>`);
          if (!sent) continue; // try again next hour
        }
        await ctx.db(`city_alerts?id=eq.${a.alert_id}`, { method: 'PATCH', body: { notified_at: nowIso }, prefer: 'return=minimal' });
        summary.city_alerts++;
      } catch (e) { fail('city-alert', a.alert_id, e); }
    }
  } catch (e) { fail('city-alerts', '-', e); }
  try {
    const due = await ctx.db('rpc/due_trip_alerts', { method: 'POST', body: { p_limit: 100 } });
    const nice = (iso, l) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALE[l] || 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    for (const a of due || []) {
      try {
        const u = await authUser(ctx, deps, a.user_id);
        const link = a.photographer_handle ? `${ctx.siteUrl}/c/${encodeURIComponent(a.photographer_handle)}` : `${ctx.siteUrl}/?creator=${encodeURIComponent(a.photographer_id)}`;
        if (u && u.email) {
          const l = await mailLang(ctx, a.user_id, u.email);
          const when = a.trip_from === a.trip_to ? nice(a.trip_from, l) : `${nice(a.trip_from, l)} – ${nice(a.trip_to, l)}`;
          const sent = await sendEmail(ctx, deps, u.email, L(l, '{name} is coming to {city}', { name: String(a.photographer_name).split(' ')[0], city: a.city_label }),
            `<p>${L(l, 'Hi,')}</p><p>${L(l, 'You asked us to tell you about creators in {city}. {name} will be there {when} and takes bookings for those days.', { city: `<strong>${escHtml(a.city_label)}</strong>`, name: `<strong>${escHtml(a.photographer_name)}</strong>`, when: `<strong>${escHtml(when)}</strong>` })}</p><p>${L(l, '{link} — or browse everyone in {city} on {site}.', { link: `<a href="${link}">${L(l, 'See their profile and book')}</a>`, city: escHtml(a.city_label), site: `<a href="${ctx.siteUrl}/in/${citySlug(a.city_label) || 'all'}">CapturaGo</a>` })}</p><p style="color:#7D6A53;font-size:13px">${L(l, 'This was a one-time alert. You can follow other cities from the CapturaGo search.')}</p>`);
          if (!sent) continue;
        }
        await ctx.db(`city_alerts?id=eq.${a.alert_id}&notified_at=is.null`, { method: 'PATCH', body: { notified_at: nowIso }, prefer: 'return=minimal' });
        summary.trip_alerts++;
      } catch (e) { fail('trip-alert', a.alert_id, e); }
    }
  } catch (e) { if (!/due_trip_alerts/.test(String(e && e.message))) fail('trip-alerts', '-', e); }

  // 11. reply times
  try { summary.reply_stats = Number(await ctx.db('rpc/refresh_reply_stats', { method: 'POST', body: {} })) || 0; }
  catch (e) { fail('reply-stats', '-', e); }

  // 12. "a traveller is waiting for your reply" — the creator hasn't answered for 2 hours (within the last day)
  try {
    const from = encodeURIComponent(new Date(now - 24 * HOUR).toISOString());
    const to = encodeURIComponent(new Date(now - 2 * HOUR).toISOString());
    const convs = await ctx.db(`conversations?last_message_at=gte.${from}&last_message_at=lte.${to}&blocked_by=is.null&select=id,client_user_id,creator_user_id,client_name,last_message_at,last_sender_id,creator_nudged_at,photographers(name,email,user_id)&order=last_message_at.asc&limit=200`);
    for (const c of convs || []) {
      if (c.last_sender_id !== c.client_user_id) continue;                                         // the creator spoke last
      if (c.creator_nudged_at && Date.parse(c.creator_nudged_at) >= Date.parse(c.last_message_at)) continue; // already reminded
      const ph = c.photographers || {};
      if (!ph.email) continue;
      try {
        const hours = Math.max(2, Math.floor((now - Date.parse(c.last_message_at)) / HOUR));
        const l = await mailLang(ctx, c.creator_user_id || ph.user_id, ph.email);
        const who = String(c.client_name || L(l, 'A traveller')).split(' ')[0];
        const sent = await sendEmail(ctx, deps, ph.email, L(l, '{name} is waiting for your reply', { name: who }),
          hiP(l, escHtml(String(ph.name || '').split(' ')[0])) + `<p>${L(l, '{name} has been waiting about {n} hours for your answer on CapturaGo.', { name: `<strong>${escHtml(who)}</strong>`, n: hours })}</p>`
          + `<p>${L(l, '{link} — or open the CapturaGo app. Tip: save your usual answers as <strong>quick replies</strong>.', { link: `<a href="${ctx.siteUrl}/dashboard.html?c=${encodeURIComponent(c.id)}">${L(l, 'Reply now')}</a>` })}</p>`
          + `<p style="color:#7D6A53;font-size:13px">${L(l, 'Travellers see how quickly you usually reply on your profile. Fast answers win more bookings.')}</p>`);
        if (!sent) continue;
        await ctx.db(`conversations?id=eq.${c.id}`, { method: 'PATCH', body: { creator_nudged_at: nowIso }, prefer: 'return=minimal' });
        summary.reply_nudges++;
      } catch (e) { fail('reply-nudge', c.id, e); }
    }
  } catch (e) { fail('reply-nudges', '-', e); }

  // 13. + 14. optional emails to travellers (review reminder, "a year ago") — only with an unsubscribe token
  const optionalFooter = (token, l) => `<p style="color:#7D6A53;font-size:13px">${L(l, 'You get tips like this because you booked on CapturaGo. {link} (booking emails still arrive).', { link: `<a href="${ctx.siteUrl}/unsubscribe.html#t=${token}">${L(l, 'Unsubscribe from tips &amp; reminders')}</a>` })}</p>`;
  async function tipsToken(userId) {
    const t = await ctx.db('rpc/email_tips_token', { method: 'POST', body: { p_user: userId } });
    return typeof t === 'string' && /^[0-9a-f-]{36}$/i.test(t) ? t : null;
  }
  const creatorLink = (b) => {
    const ph = b.photographers || {};
    return ph.handle ? `${ctx.siteUrl}/c/${encodeURIComponent(ph.handle)}` : (b.photographer_id ? `${ctx.siteUrl}/?creator=${encodeURIComponent(b.photographer_id)}` : `${ctx.siteUrl}/`);
  };
  try {
    const from = encodeURIComponent(new Date(now - 14 * 86400000).toISOString());
    const to = encodeURIComponent(new Date(now - 2 * 86400000).toISOString());
    const done = await ctx.db(`bookings?status=eq.completed&completed_at=gte.${from}&completed_at=lte.${to}&client_user_id=not.is.null&photographer_id=not.is.null&select=id,photographer_id,client_user_id,client_name,client_email,package_name,notices,photographers(name,handle,city)&limit=${BATCH}`);
    const todo = (done || []).filter((b) => !(b.notices && b.notices.review_ask));
    const reviewed = todo.length ? await ctx.db(`reviews?booking_id=in.(${todo.map((b) => b.id).join(',')})&select=booking_id`) : [];
    const has = new Set((reviewed || []).map((r) => r.booking_id));
    for (const b of todo) {
      try {
        if (!has.has(b.id)) {
          const token = await tipsToken(b.client_user_id);
          if (token) {
            const l = await mailLang(ctx, b.client_user_id, b.client_email);
            const creator = String((b.photographers && b.photographers.name) || L(l, 'your creator')).split(' ')[0];
            const sent = await sendEmail(ctx, deps, b.client_email, L(l, 'How was your shoot with {name}?', { name: creator }),
              hiP(l, escHtml(String(b.client_name || '').split(' ')[0])) + `<p>${L(l, 'We hope you love your photos from {pkg}. Would you tell other travellers how it was? It takes a minute and helps {name} a lot.', { pkg: pkgOf(b), name: escHtml(creator) })}</p>`
              + `<p>${L(l, '{link} — you can add up to 3 of your photos.', { link: `<a href="${ctx.siteUrl}/dashboard.html?review=${b.id}#bookings">${L(l, '⭐ Leave a review')}</a>` })}</p>` + optionalFooter(token, l));
            if (!sent) continue;   // try again next hour
            summary.review_requests++;
          }
        }
        await mark(b, 'review_ask');
      } catch (e) { fail('review-ask', b.id, e); }
    }
  } catch (e) { fail('review-asks', '-', e); }
  try {
    const day = (n) => new Date(now - n * 86400000).toISOString().slice(0, 10);
    const old = await ctx.db(`bookings?status=eq.completed&booking_type=eq.session&shoot_date=gte.${day(372)}&shoot_date=lte.${day(365)}&client_user_id=not.is.null&select=id,photographer_id,client_user_id,client_name,client_email,package_name,shoot_date,notices,photographers(name,handle,city)&limit=${BATCH}`);
    for (const b of (old || []).filter((x) => !(x.notices && x.notices.anniversary))) {
      try {
        const token = await tipsToken(b.client_user_id);
        if (token) {
          const ph = b.photographers || {};
          const city = String(ph.city || '').split(',')[0].trim();
          const l = await mailLang(ctx, b.client_user_id, b.client_email);
          const creator = String(ph.name || L(l, 'your creator')).split(' ')[0];
          const sent = await sendEmail(ctx, deps, b.client_email, city ? L(l, 'A year ago in {city} 📸', { city }) : L(l, 'A year ago today 📸'),
            hiP(l, escHtml(String(b.client_name || '').split(' ')[0])) + `<p>${city ? L(l, 'One year ago you had your shoot in {city} with {name}. We hope the photos still make you smile.', { city: `<strong>${escHtml(city)}</strong>`, name: `<strong>${escHtml(creator)}</strong>` }) : L(l, 'One year ago you had your shoot with {name}. We hope the photos still make you smile.', { name: `<strong>${escHtml(creator)}</strong>` })}</p>`
            + `<p>${L(l, 'Going back? {again}. Somewhere new? {free} in your next city.', { again: `<a href="${creatorLink(b)}">${L(l, 'Book {name} again', { name: escHtml(creator) })}</a>`, free: `<a href="${ctx.siteUrl}/#tripPlanner">${L(l, 'See who\'s free on your dates')}</a>` })}</p>` + optionalFooter(token, l));
          if (!sent) continue;
          summary.anniversaries++;
        }
        await mark(b, 'anniversary');
      } catch (e) { fail('anniversary', b.id, e); }
    }
  } catch (e) { fail('anniversaries', '-', e); }

  // 15. photos promised by a date in the package, not sent yet
  try {
    const dayIso = (n) => new Date(now - n * 86400000).toISOString().slice(0, 10);
    const rows = await ctx.db(`bookings?booking_type=eq.session&status=in.(confirmed,completed)&photos_ready_at=is.null&package_details=not.is.null&shoot_date=gte.${dayIso(60)}&shoot_date=lt.${dayIso(0)}&select=id,photographer_id,creator_user_id,client_user_id,client_name,client_email,package_name,shoot_date,package_details,booking_type,status,surprise,notices&limit=${BATCH}`);
    for (const b of rows || []) {
      const days = Math.round(Number(b.package_details && b.package_details.edit_days));
      if (!(days >= 1 && days <= 60)) continue;
      const due = new Date(Date.parse(`${b.shoot_date}T00:00:00Z`) + days * 86400000);
      if (due.getTime() > now) continue;
      if (!(b.notices && b.notices.photos_due)) {
        try {
          await mailCreator(b, (l) => [L(l, 'Photos for {name} are due', { name: String(b.client_name || L(l, 'your client')).split(' ')[0] }),
            L(l, days > 1 ? 'Your package {pkg} promises the photos within {n} days of the shoot ({date}). Please upload and send them in your bookings — your client is waiting.' : 'Your package {pkg} promises the photos within {n} day of the shoot ({date}). Please upload and send them in your bookings — your client is waiting.', { pkg: pkgOf(b), n: days, date: escHtml(b.shoot_date) })
            + (b.status === 'confirmed' ? ` ${L(l, 'Your payment is released 3 days after you send them.')}` : '')]);
          await mark(b, 'photos_due');
          b.notices = { ...(b.notices || {}), photos_due: nowIso };
          summary.photos_due++;
        } catch (e) { fail('photos-due', b.id, e); }
      } else if (b.status === 'confirmed' && !b.notices.photos_late_client && due.getTime() + 2 * 86400000 <= now) {
        try {
          await mailClient(b, (l) => [L(l, 'Your photos are late — {pkg}', { pkg: b.package_name }), L(l, 'Your photos from {pkg} were promised by {date} and haven\'t arrived yet. <strong>Your payment is still on hold</strong> — nothing goes to the creator until you have them.', { pkg: pkgOf(b), date: escHtml(due.toISOString().slice(0, 10)) })
            + `<br/>${L(l, 'Message your creator on CapturaGo, or {link} and we\'ll step in.', { link: `<a href="${ctx.siteUrl}/dashboard.html?b=${b.id}#bookings">${L(l, 'report a problem')}</a>` })}`]);
          await mark(b, 'photos_late_client');
          summary.photos_late++;
        } catch (e) { fail('photos-late', b.id, e); }
      }
    }
  } catch (e) { fail('photos-due', '-', e); }

  // 16. calendar sync: creators' own calendars, every 3 hours (a few at a time)
  try {
    const before = encodeURIComponent(new Date(now - 3 * HOUR).toISOString());
    const imports = await ctx.db(`calendar_imports?or=(last_synced_at.is.null,last_synced_at.lt.${before})&select=user_id,url&order=last_synced_at.asc.nullsfirst&limit=20`);
    const list = imports || [];
    for (let i = 0; i < list.length; i += 4) {
      const outs = await Promise.all(list.slice(i, i + 4).map((row) => syncCalendarImport(ctx, deps, row).catch((e) => ({ error: String(e) }))));
      summary.calendars_synced += outs.filter((o) => o && !o.error && !o.skipped).length;
    }
  } catch (e) { if (!/calendar_imports/.test(String(e && e.message))) fail('calendars', '-', e); }

  // 17. shoot requests: tell matching creators about a new request (once); tell travellers about new offers (one email per request)
  try {
    const SERVICE_NAME = { photo: 'Photographer', video: 'Videographer', phone: 'Phone content creator', drone: 'Drone pilot', guide: 'Photo guide', event: 'Event photographer' };
    const fresh = await ctx.db(`shoot_requests?status=eq.open&notified_at=is.null&select=*&order=created_at.asc&limit=20`);
    for (const q of fresh || []) {
      try {
        const claimed = await ctx.db(`shoot_requests?id=eq.${q.id}&notified_at=is.null`, { method: 'PATCH', body: { notified_at: nowIso } });
        if (!claimed || !claimed.length) continue;
        const who = await ctx.db('rpc/request_matches', { method: 'POST', body: { p_request: q.id } });
        const when = q.date_from === q.date_to ? q.date_from : `${q.date_from} – ${q.date_to}`;
        const city = String(q.city).split(',')[0];
        for (const c of who || []) {
          const l = await mailLang(ctx, c.user_id, c.email);
          await sendEmail(ctx, deps, c.email, L(l, 'New shoot request in {city} ({when})', { city, when }),
            hiP(l, escHtml(String(c.name || '').split(' ')[0])) + `<p>${L(l, '{name} is looking for a {service} in {city}, {when}', { name: `<strong>${escHtml(q.first_name)}</strong>`, service: `<strong>${escHtml(L(l, (SERVICE_NAME[q.service] || q.service).toLowerCase()))}</strong>`, city: `<strong>${escHtml(city)}</strong>`, when: escHtml(when) })}`
            + ` · ${L(l, q.people === 1 ? '{n} person' : '{n} people', { n: q.people })}${q.budget_eur ? ` · ${L(l, 'budget about €{n}', { n: q.budget_eur })}` : ''}.</p>`
            + (q.note ? `<p style="font-style:italic">“${escHtml(String(q.note).slice(0, 300))}${String(q.note).length > 300 ? '…' : ''}”</p>` : '')
            + `<p>${L(l, '{link} — the first good offers usually get booked.', { link: `<a href="${ctx.siteUrl}/dashboard.html#requests">${L(l, 'Send an offer')}</a>` })}</p>`);
        }
        summary.request_alerts += (who || []).length;
      } catch (e) { fail('request', q.id, e); }
    }
    const offers = await ctx.db(`request_offers?status=eq.open&notified_at=is.null&select=id,request_id,shoot_requests(user_id,city,status)&limit=200`);
    const byRequest = new Map();
    for (const o of offers || []) { if (!byRequest.has(o.request_id)) byRequest.set(o.request_id, []); byRequest.get(o.request_id).push(o); }
    for (const [rid, list] of byRequest) {
      try {
        const q = list[0].shoot_requests;
        const ids = list.map((o) => o.id);
        await ctx.db(`request_offers?id=in.(${ids.join(',')})`, { method: 'PATCH', body: { notified_at: nowIso }, prefer: 'return=minimal' });
        if (!q || q.status !== 'open') continue;
        const u = await authUser(ctx, deps, q.user_id);
        if (!u || !u.email) continue;
        const l = await mailLang(ctx, q.user_id, u.email);
        const qc = String(q.city).split(',')[0];
        await sendEmail(ctx, deps, u.email, list.length === 1 ? L(l, 'A new offer for your shoot in {city}', { city: qc }) : L(l, '{n} new offers for your shoot in {city}', { n: list.length, city: qc }),
          `<p>${L(l, 'Hi,')}</p><p>${list.length === 1 ? L(l, 'A creator has sent you an offer for your shoot request in {city}.', { city: `<strong>${escHtml(qc)}</strong>` }) : L(l, '{n} creators have sent you an offer for your shoot request in {city}.', { n: list.length, city: `<strong>${escHtml(qc)}</strong>` })}</p>`
          + `<p>${L(l, '{link} — you can message the creators before you book.', { link: `<a href="${ctx.siteUrl}/dashboard.html#requests">${L(l, 'Compare the offers')}</a>` })}</p>`);
        summary.offer_alerts++;
      } catch (e) { fail('offers', rid, e); }
    }
    // requests whose dates have passed are closed
    await ctx.db(`shoot_requests?status=eq.open&date_to=lt.${ctx.isoInDays(0)}`, { method: 'PATCH', body: { status: 'closed' }, prefer: 'return=minimal' });
  } catch (e) { if (!/shoot_requests|request_offers/.test(String(e && e.message))) fail('requests', '-', e); }

  // 18. invite rewards: tell both creators about their free boost (once)
  try {
    const rewards = await ctx.db(`invite_rewards?emailed_at=is.null&select=id,inviter_id,invitee_id,inviter_boosted,days&limit=50`);
    for (const r of rewards || []) {
      try {
        const done = await ctx.db(`invite_rewards?id=eq.${r.id}&emailed_at=is.null`, { method: 'PATCH', body: { emailed_at: nowIso } });
        if (!done || !done.length) continue;
        const ids = [r.invitee_id, r.inviter_id].filter(Boolean);
        const people = await ctx.db(`photographers?id=in.(${ids.join(',')})&select=id,user_id,name,email,boosted_until`);
        const invitee = people.find((x) => x.id === r.invitee_id), inviter = people.find((x) => x.id === r.inviter_id);
        const until = (x) => escHtml(String(x && x.boosted_until || '').slice(0, 10));
        const first = (x) => escHtml(String(x && x.name || '').split(' ')[0]);
        if (invitee && invitee.email) {
          const l = await mailLang(ctx, invitee.user_id, invitee.email);
          await sendEmail(ctx, deps, invitee.email, L(l, '🚀 Your first booking is done — enjoy a free boost'),
            hiP(l, first(invitee)) + `<p>${inviter ? L(l, 'Congratulations on your first completed booking on CapturaGo! As a thank-you for joining through {name}’s invite, your listing is boosted to the top of the results for {n} days (until {until}).', { name: first(inviter), n: r.days, until: until(invitee) }) : L(l, 'Congratulations on your first completed booking on CapturaGo! As a thank-you for joining through an invite, your listing is boosted to the top of the results for {n} days (until {until}).', { n: r.days, until: until(invitee) })}</p><p><a href="${ctx.siteUrl}/dashboard.html">${L(l, 'Open your dashboard')}</a></p>`);
        }
        if (r.inviter_boosted && inviter && inviter.email) {
          const l = await mailLang(ctx, inviter.user_id, inviter.email);
          const who = first(invitee) || L(l, 'A creator you invited');
          await sendEmail(ctx, deps, inviter.email, L(l, '🚀 {name} completed their first booking — free boost for you', { name: invitee && invitee.name ? String(invitee.name).split(' ')[0] : L(l, 'A creator you invited').replace(/,$/, '') }),
            hiP(l, first(inviter)) + `<p>${L(l, '{name} just completed their first booking on CapturaGo. Thank you for inviting them — your listing is boosted for {n} days (until {until}).', { name: who, n: r.days, until: until(inviter) })}</p><p>${L(l, 'Know more great creators? {link}.', { link: `<a href="${ctx.siteUrl}/dashboard.html#overview">${L(l, 'Share your invite link')}</a>` })}</p>`);
        }
        summary.invite_rewards++;
      } catch (e) { fail('invite', r.id, e); }
    }
  } catch (e) { if (!/invite_rewards/.test(String(e && e.message))) fail('invites', '-', e); }

  // 19. last-minute deals: travellers in the creator's city that day get one email (at most one deal email a day each).
  //     Ten minutes after the creator sets it, so a mistake can still be taken back.
  try {
    const due19 = await ctx.db(`last_minute_deals?notified_at=is.null&removed_at=is.null&day=gte.${ctx.isoInDays(1)}&day=lte.${ctx.isoInDays(2)}&created_at=lt.${encodeURIComponent(new Date(now - 10 * 60000).toISOString())}&select=photographer_id,day,pct,photographers(id,name,handle,city,trips,hidden,available,payouts_enabled)&order=created_at.asc&limit=20`);
    const niceDay = (iso, l) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALE[l] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    for (const d of due19 || []) {
      try {
        const claimed = await ctx.db(`last_minute_deals?photographer_id=eq.${d.photographer_id}&day=eq.${d.day}&notified_at=is.null&removed_at=is.null`, { method: 'PATCH', body: { notified_at: nowIso } });
        if (!claimed || !claimed.length) continue;
        const ph = d.photographers || {};
        if (ph.hidden || ph.available === false || !ph.payouts_enabled) continue;
        if (!(await ctx.db('rpc/creator_day_free', { method: 'POST', body: { p_photographer: d.photographer_id, p_day: d.day } }))) continue;
        const trip = tripOn(ph.trips, d.day);
        const city = String((trip && trip.city) || ph.city || '').split(',')[0].trim();
        if (!city) continue;
        const link = `${ph.handle ? `${ctx.siteUrl}/c/${encodeURIComponent(ph.handle)}` : `${ctx.siteUrl}/?creator=${encodeURIComponent(ph.id)}`}`;
        const first = String(ph.name || '').split(' ')[0];
        const people = await ctx.db('rpc/deal_recipients', { method: 'POST', body: { p_photographer: d.photographer_id, p_day: d.day } });
        for (const u of people || []) {
          if (!(await ctx.db('rpc/claim_deal_email', { method: 'POST', body: { p_user: u.user_id } }))) continue;   // already had one today
          const token = await tipsToken(u.user_id);
          if (!token) continue;
          const l = await mailLang(ctx, u.user_id, u.email);
          const when = niceDay(d.day, l);
          const sent = await sendEmail(ctx, deps, u.email, L(l, '⚡ Last-minute in {city}: {name} −{pct}% on {date}', { city, name: first, pct: d.pct, date: when }),
            `<p>${L(l, 'Hi,')}</p><p>${L(l, '{name} is free on {date} in {city} and lowered the price by {pct}% for that day.', { name: `<strong>${escHtml(ph.name)}</strong>`, date: `<strong>${escHtml(when)}</strong>`, city: `<strong>${escHtml(city)}</strong>`, pct: d.pct })}</p>`
            + `<p>${L(l, '{link} — the lower price is for that day only, and the payment is protected as always.', { link: `<a href="${link}">${L(l, 'See the profile and book')}</a>` })}</p>`
            + `<p style="color:#7D6A53;font-size:13px">${L(l, 'You get this because you\'re in {city} around these days (a booking, a shoot request or a city you follow). We send at most one deal a day.', { city: escHtml(city) })} ${L(l, '{link} (booking emails still arrive).', { link: `<a href="${ctx.siteUrl}/unsubscribe.html#t=${token}">${L(l, 'Unsubscribe from deals, tips &amp; reminders')}</a>` })}</p>`);
          if (sent) summary.deal_emails++;
        }
      } catch (e) { fail('deal', `${d.photographer_id}/${d.day}`, e); }
    }
  } catch (e) { if (!/last_minute_deals/.test(String(e && e.message))) fail('deals', '-', e); }

  // 20. text reminders on the shoot day (SMS / WhatsApp) for travellers and creators who added and confirmed a number:
  //     about 7:00 local time on the day — or about 19:00 the evening before when they meet before 9:00.
  //     Local time is estimated from the place's longitude (no time zone is stored).
  if (textsConfigured(ctx)) {
    try {
      const rows = await ctx.db(`bookings?status=eq.confirmed&booking_type=eq.session&shoot_date=gte.${ctx.isoInDays(-1)}&shoot_date=lte.${ctx.isoInDays(2)}&notices->>text_reminder=is.null&select=id,status,booking_type,client_user_id,creator_user_id,client_name,package_name,shoot_date,time_slot,meeting_point,meeting_time,shoot_city,shoot_coords,surprise,notices,proposed_date,reschedules,photographers(name,coords)&order=shoot_date.asc&limit=300`);
      for (const b of rows || []) {
        try {
          const ph = b.photographers || {};
          const lon = Number((b.shoot_coords && b.shoot_coords.lon) ?? (ph.coords && ph.coords.lon));
          const offH = Number.isFinite(lon) ? Math.max(-12, Math.min(14, Math.round(lon / 15))) : 1;
          const local = new Date(now + offH * HOUR);
          const localDay = local.toISOString().slice(0, 10), localHour = local.getUTCHours();
          const dayBefore = new Date(Date.parse(`${b.shoot_date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
          const early = MEETING_TIME_RE.test(String(b.meeting_time || '')) && b.meeting_time < '09:00';
          if (localDay > b.shoot_date) continue;   // too late — never text after the day
          const due = early ? (localDay === b.shoot_date || (localDay === dayBefore && localHour >= 19)) : (localDay === b.shoot_date && localHour >= 7);
          if (!due) continue;
          const claimed = await ctx.db(`bookings?id=eq.${b.id}&notices->>text_reminder=is.null`, { method: 'PATCH', body: { notices: { ...(b.notices || {}), text_reminder: nowIso } } });
          if (!claimed || !claimed.length) continue;
          const ids = [b.client_user_id, b.creator_user_id].filter((x) => UUID_RE.test(String(x || '')));
          if (!ids.length) continue;
          const rain = await heavyRainFor(b);   // heavy rain → the text offers to move it (one tap)
          const phones = await ctx.db(`phone_numbers?user_id=in.(${ids.join(',')})&verified_at=not.is.null&reminders=is.true&select=user_id,phone,channel`);
          for (const pn of phones || []) {
            if (!(await ctx.db('rpc/claim_text', { method: 'POST', body: { p_user: pn.user_id } }))) continue;   // max 4 a day
            const l = await mailLang(ctx, pn.user_id, null);
            const forCreator = pn.user_id === b.creator_user_id && pn.user_id !== b.client_user_id;
            const when = localDay === b.shoot_date ? L(l, 'today') : L(l, 'tomorrow');
            const time = MEETING_TIME_RE.test(String(b.meeting_time || '')) ? L(l, 'at {time}', { time: b.meeting_time }) : (b.time_slot ? `(${L(l, slotLabel(b.time_slot))})` : '');
            const other = String(forCreator ? (b.client_name || '') : (ph.name || '')).split(' ')[0];
            const place = b.meeting_point ? String(b.meeting_point).slice(0, 120) : L(l, 'not shared yet — message each other in CapturaGo');
            const link = rain ? moveLink(b) : `${ctx.siteUrl}/dashboard.html#bookings`;
            const what0 = !forCreator && b.surprise
              ? L(l, 'your plans {when} {time}', { when, time }).replace(/\s+/g, ' ').trim()
              : L(l, 'your shoot with {name} {when} {time}', { name: other, when, time }).replace(/\s+/g, ' ').trim();
            // Heavy rain: said in the same message (also fits the approved WhatsApp template: {{1}} and the link in {{3}})
            const what = rain ? `${what0} — ${L(l, 'heavy rain forecast; to move it, tap the link')}` : what0;
            const text = !forCreator && b.surprise
              ? L(l, 'CapturaGo reminder: {what}. Details: {link}', { what, link })
              : L(l, 'CapturaGo reminder: {what}. Meeting point: {place}. Details: {link}', { what, place, link });
            const ok = await sendText(ctx, deps, pn.phone, pn.channel, text, { 1: what, 2: !forCreator && b.surprise ? '—' : place, 3: link }, l);
            if (ok) summary.texts++;
          }
          if (rain) summary.rain_warnings++;
        } catch (e) { fail('text', b.id, e); }
      }
    } catch (e) { if (!/phone_numbers|text_reminder/.test(String(e && e.message))) fail('texts', '-', e); }
  }

  // 21. "Notify me" on a fully booked creator: a day opened up, or a last-minute deal appeared → one email
  //     (+ one text if the traveller asked for it and confirmed their number), then the watch is done.
  try {
    const due21 = await ctx.db('rpc/due_creator_watches', { method: 'POST', body: { p_limit: 100 } });
    const niceDay = (iso, l) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALE[l] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    for (const w of due21 || []) {
      try {
        const u = await authUser(ctx, deps, w.user_id);
        const email = u && u.email;
        const l = await mailLang(ctx, w.user_id, email);
        const name = String(w.photographer_name || '');
        const first = name.split(' ')[0] || L(l, 'Your creator');
        const profile = w.photographer_handle ? `${ctx.siteUrl}/c/${encodeURIComponent(w.photographer_handle)}` : `${ctx.siteUrl}/?creator=${encodeURIComponent(w.photographer_id)}`;
        const book = `${ctx.siteUrl}/?creator=${encodeURIComponent(w.photographer_id)}&day=${encodeURIComponent(w.day)}`;
        const when = niceDay(w.day, l);
        const deal = w.reason === 'deal';
        let sent = false;
        if (email) {
          const subject = deal ? L(l, '⚡ {name} has a last-minute deal: −{pct}% on {date}', { name: first, pct: w.pct, date: when })
            : L(l, '🔔 {name} has a free day again', { name: first });
          const body = deal
            ? L(l, 'You asked us to tell you when {name} has something for you. They just lowered their price by {pct}% for {date}.', { name: `<strong>${escHtml(name)}</strong>`, pct: w.pct, date: `<strong>${escHtml(when)}</strong>` })
            : (Number(w.free_count) > 1
              ? L(l, 'You asked us to tell you when {name} has a free day. {n} days just opened up — the first is {date}.', { name: `<strong>${escHtml(name)}</strong>`, n: Number(w.free_count), date: `<strong>${escHtml(when)}</strong>` })
              : L(l, 'You asked us to tell you when {name} has a free day. {date} just opened up.', { name: `<strong>${escHtml(name)}</strong>`, date: `<strong>${escHtml(when)}</strong>` }));
          sent = await sendEmail(ctx, deps, email, subject,
            `<p>${L(l, 'Hi,')}</p><p>${body}</p><p>${L(l, '{link} — free days go quickly, and the payment is protected as always.', { link: `<a href="${book}"><strong>${L(l, 'Book {name}', { name: escHtml(first) })}</strong></a>` })}</p>`
            + `<p style="color:#7D6A53;font-size:13px">${L(l, 'This was a one-time alert. Watch again any time from {link}.', { link: `<a href="${profile}">${L(l, '{name}’s profile', { name: escHtml(first) })}</a>` })}</p>`);
          if (sent) await sendPush(ctx, deps, w.user_id, subject, body, { url: `/creator/${w.photographer_id}`, date: w.day });   // only once: a failed email is retried next hour
        }
        if (w.by_text && textsConfigured(ctx)) {
          const [pn] = await ctx.db(`phone_numbers?user_id=eq.${w.user_id}&verified_at=not.is.null&select=phone,channel`);
          if (pn && (await ctx.db('rpc/claim_text', { method: 'POST', body: { p_user: w.user_id } }))) {
            const text = deal ? L(l, 'CapturaGo: {name} has a last-minute deal, −{pct}% on {date}. Book: {link}', { name: first, pct: w.pct, date: when, link: book })
              : L(l, 'CapturaGo: {name} has a free day again ({date}). Book: {link}', { name: first, date: when, link: book });
            if (await sendText(ctx, deps, pn.phone, 'sms', text, null, l)) sent = true;   // an alert, not a reminder: always SMS
          }
        }
        if (!sent && email) continue;   // email failed → try again next hour
        await ctx.db(`creator_watches?id=eq.${w.watch_id}&notified_at=is.null`, { method: 'PATCH', body: { notified_at: nowIso, notified_reason: deal ? 'deal' : 'free' }, prefer: 'return=minimal' });
        summary.watch_alerts++;
      } catch (e) { fail('watch', w.watch_id, e); }
    }
  } catch (e) { if (!/due_creator_watches|creator_watches/.test(String(e && e.message))) fail('watches', '-', e); }

  // 22. DAC7 tax details: ask once, then 2 reminders (the law requires them before payouts may be held)
  try {
    const due22 = await ctx.db('rpc/due_tax_requests', { method: 'POST', body: { p_limit: 100 } });
    for (const r of due22 || []) {
      try {
        const l = await mailLang(ctx, r.user_id, r.email);
        const link = `<a href="${ctx.siteUrl}/dashboard.html#payments"><strong>${L(l, 'Add my tax details')}</strong></a>`;
        const sent = await sendEmail(ctx, deps, r.email,
          r.step === 'ask' ? L(l, 'Please add your tax details for CapturaGo') : L(l, 'Reminder: your tax details for CapturaGo are still missing'),
          hiP(l, escHtml(String(r.name || '').split(' ')[0]))
          + `<p>${L(l, 'EU law (the DAC7 directive) requires platforms like CapturaGo to collect the tax details of everyone who earns money through them, and to report those earnings to the tax authority once a year. You also get a copy of what we report.')}</p>`
          + `<p>${L(l, 'It takes about two minutes: {link} (Dashboard → Payments). We need your name, address, date of birth and tax number — or, for a business, its registration details.', { link })}</p>`
          + (r.step === 'reminder2' ? `<p><strong>${L(l, 'This is our last reminder. If we still don\'t have your details 60 days after our first request, the law may require us to hold your payouts until you add them.')}</strong></p>` : '')
          + `<p style="color:#7D6A53;font-size:13px">${L(l, 'Your details are private: only you and the CapturaGo team can see them, and they are used only for tax reporting.')}</p>`);
        if (!sent) continue;   // try again next hour
        await ctx.db('rpc/mark_tax_request', { method: 'POST', body: { p_user: r.user_id, p_step: r.step } });
        summary.tax_requests++;
      } catch (e) { fail('tax-request', r.user_id, e); }
    }
  } catch (e) { if (!/due_tax_requests/.test(String(e && e.message))) fail('tax-requests', '-', e); }

  // 23. Reviews: tell the creator about each new review (email + push, with a link to reply), and the traveller once
  //     when the creator replied (10 minutes after the last edit, so a quick typo fix doesn't send two messages).
  const notYet = (e) => /creator_notified_at|reply_notified_at|reply_at|42703/.test(String(e && e.message));   // PART 23 not run yet
  const quote = (t, max = 300) => { const x = String(t || '').trim(); return escHtml(x.length > max ? `${x.slice(0, max - 1).trimEnd()}…` : x); };
  try {
    const since = encodeURIComponent(new Date(now - 3 * 86400000).toISOString());
    const fresh = await ctx.db(`reviews?creator_notified_at=is.null&created_at=gte.${since}&select=id,photographer_id,reviewer_name,rating,comment,booking_id,photographers(user_id,email,name)&order=created_at.asc&limit=100`);
    for (const r of fresh || []) {
      try {
        const c = r.photographers || {};
        const l = await mailLang(ctx, c.user_id, c.email);
        const who = String(r.reviewer_name || '').trim() || L(l, 'A traveller');
        const stars = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)));
        const subject = L(l, '⭐ New review from {name}: {stars}', { name: who, stars: '★'.repeat(stars) + '☆'.repeat(5 - stars) });
        const text = r.comment ? L(l, '{name} left you a {n}-star review: “{text}”', { name: escHtml(who), n: stars, text: quote(r.comment) }) : L(l, '{name} left you a {n}-star review.', { name: escHtml(who), n: stars });
        let sent = true;
        if (c.email) {
          sent = await sendEmail(ctx, deps, c.email, subject, `${hiP(l, escHtml(String(c.name || '').split(' ')[0]))}<p>${text}</p>`
            + (stars <= 3 ? `<p>${L(l, 'A short, friendly reply helps the next travellers more than the stars do: thank them, explain briefly what happened, and don\'t argue.')}</p>` : '')
            + `<p><a href="${ctx.siteUrl}/dashboard.html#reviews"><strong>${L(l, 'Read it and reply')}</strong></a></p>`);
        }
        if (!sent) continue;   // try again next hour
        await sendPush(ctx, deps, c.user_id, subject, text, { url: `/creator/${r.photographer_id}` });
        await ctx.db(`reviews?id=eq.${r.id}&creator_notified_at=is.null`, { method: 'PATCH', body: { creator_notified_at: nowIso }, prefer: 'return=minimal' });
        summary.review_alerts++;
      } catch (e) { fail('review-alert', r.id, e); }
    }
  } catch (e) { if (!notYet(e)) fail('review-alerts', '-', e); }
  try {
    const settled = encodeURIComponent(new Date(now - 10 * 60000).toISOString());
    const replied = await ctx.db(`reviews?reply_notified_at=is.null&reply_at=lte.${settled}&user_id=not.is.null&select=id,photographer_id,user_id,reviewer_name,reply,photographers(name,handle)&order=reply_at.asc&limit=100`);
    for (const r of replied || []) {
      try {
        if (!r.reply) continue;
        const u = await authUser(ctx, deps, r.user_id);
        const email = u && u.email;
        const l = await mailLang(ctx, r.user_id, email);
        const c = r.photographers || {};
        const name = String(c.name || '').trim() || L(l, 'Your creator');
        const profile = c.handle ? `${ctx.siteUrl}/c/${encodeURIComponent(c.handle)}` : `${ctx.siteUrl}/?creator=${encodeURIComponent(r.photographer_id)}`;
        const subject = L(l, '{name} replied to your review', { name });
        const text = L(l, '{name} replied to your review on CapturaGo: “{text}”', { name: escHtml(name), text: quote(r.reply) });
        let sent = true;
        if (email) sent = await sendEmail(ctx, deps, email, subject, `${hiP(l, escHtml(String(r.reviewer_name || '').split(' ')[0]))}<p>${text}</p><p><a href="${profile}">${L(l, 'See it on {name}’s profile', { name: escHtml(name.split(' ')[0]) })}</a></p>`);
        if (!sent) continue;
        await sendPush(ctx, deps, r.user_id, subject, text, { url: `/creator/${r.photographer_id}` });
        await ctx.db(`reviews?id=eq.${r.id}&reply_notified_at=is.null`, { method: 'PATCH', body: { reply_notified_at: nowIso }, prefer: 'return=minimal' });
        summary.reply_alerts++;
      } catch (e) { fail('reply-alert', r.id, e); }
    }
  } catch (e) { if (!notYet(e)) fail('reply-alerts', '-', e); }

  // 6. + 10. housekeeping
  await ctx.db(`ai_requests?created_at=lt.${encodeURIComponent(new Date(now - HOUR).toISOString())}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
  await ctx.db(`search_events?created_at=lt.${encodeURIComponent(new Date(now - 180 * 86400000).toISOString())}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
  await ctx.db(`gallery_shares?expires_at=lt.${encodeURIComponent(new Date(now - 7 * 86400000).toISOString())}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
  await ctx.db(`gift_attempts?created_at=lt.${encodeURIComponent(new Date(now - 86400000).toISOString())}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
  await ctx.db(`last_minute_deals?day=lt.${ctx.isoInDays(-14)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
  await ctx.db(`deal_emails?sent_on=lt.${ctx.isoInDays(-7)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
  await ctx.db(`phone_code_log?created_at=lt.${encodeURIComponent(new Date(now - 2 * 86400000).toISOString())}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
  await ctx.db(`creator_watches?or=(until_day.lt.${ctx.isoInDays(-7)},notified_at.lt.${encodeURIComponent(new Date(now - 60 * 86400000).toISOString())})`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
  await ctx.db(`phone_numbers?verified_at=is.null&created_at=lt.${encodeURIComponent(new Date(now - 2 * 86400000).toISOString())}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});   // never confirmed
  await ctx.db('rpc/prune_push_tokens', { method: 'POST', body: {} }).catch(() => {});   // app phones not seen for 120 days

  if (run && run.id) {
    await ctx.db(`job_runs?id=eq.${run.id}`, { method: 'PATCH', body: { finished_at: new Date(ctx.nowMs()).toISOString(), summary, error: errors.length ? errors.slice(0, 10).join('\n').slice(0, 2000) : null }, prefer: 'return=minimal' });
  }
  return summary;
}

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      let allowed = safeEqual(req.headers.get('x-cron-secret'), ctx.env('CRON_SECRET', ''));
      if (!allowed && (req.headers.get('Authorization') || '').startsWith('Bearer ')) {
        try { const u = await ctx.getUser(req); allowed = await isAdmin(ctx, u.id); } catch { allowed = false; }
      }
      if (!allowed) return json({ error: 'Not allowed' }, 401);
      const summary = await runJobs(ctx, deps);
      return json({ ok: true, summary });
    } catch (e) {
      console.error('[jobs] fatal', e);
      return json({ error: 'Job run failed: ' + (e && e.message ? e.message : 'unknown') }, 500);
    }
  };
}

startServer(createHandler);
