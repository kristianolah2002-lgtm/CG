// ── booking-action: the escrow rules ──
// IN-PERSON SESSION (booking_type = 'session')
//  confirm  (creator)  paid → confirmed
//  decline  (creator)  paid|confirmed → declined + full refund
//  cancel   (client)   pending → cancelled; paid → refund; confirmed → refund only if ≥ 7 days before the shoot
//  complete (client on/after shoot day, or creator ≥ 3 days after) confirmed → completed + payout
//           Packages that promise photos "within N days": the creator's side waits until 3 days after the photos were sent
//  dispute  (client)   paid|confirmed, until 3 days after the shoot → disputed (payout frozen)
//           (photos promised: until 3 days after the photos were sent; "photos_late" once the promised date has passed)
//  photos_ready (creator) confirmed|completed, with photos uploaded → client is emailed (at most once an hour)
// REMOTE DELIVERY (booking_type = 'delivery'; shoot_date = due date)
//  confirm  (creator)  paid → confirmed (= accepted, work starts)
//  decline  (creator)  paid|confirmed → declined + full refund
//  deliver  (creator)  confirmed → delivered (photos uploaded to CapturaGo and/or an https link to the files)
//  revise   (client)   delivered → confirmed, if revisions are left
//  complete (client any time after delivery, or creator 3 days after delivery) delivered → completed + payout
//  cancel   (client)   pending → cancelled; paid → refund; confirmed AND past the due date → refund (late)
//  dispute  (client)   paid|confirmed, or within 3 days of delivery → disputed
// PLANNING (in-person sessions, paid|confirmed)
//  propose_date (either side) → a new date (weather or other reason); the booking moves only when
//  accept_date  (the other side) accepts. decline_date (other side) / withdraw_date (proposer) clear it.
//  set_meeting  (creator) meeting point + time      set_brief (client) shot list, reference links, surprise
const FREE_CANCEL_DAYS = 7;
const MAX_RESCHEDULES = 3;
const PLAN_STATUSES = ['paid', 'confirmed'];
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

    const remote = b.booking_type === 'delivery';
    const days = ctx.daysUntil(b.shoot_date); // session: days to shoot; delivery: days to due date
    const hoursSinceDelivery = b.delivered_at ? (ctx.nowMs() - Date.parse(b.delivered_at)) / 3600000 : null;
    const when = escHtml(b.shoot_date);

    async function move(from, to, extra = {}) {
      const rows = await ctx.db(`bookings?id=eq.${id}&status=eq.${from}`, { method: 'PATCH', body: { status: to, ...extra } });
      if (!rows.length) throw new HttpError(409, 'This booking was just updated. Please refresh.');
      return rows[0];
    }
    // Money helpers in lib: handle one card, a gift card, or a booking split between friends
    const refundAll = () => refundBooking(ctx, b);
    const releasePayout = () => releaseBooking(ctx, b);
    // Emails: make(lang) → [subject, text], written in the reader's language
    const link = (lang) => `<p><a href="${ctx.siteUrl}/dashboard.html#bookings">${L(lang, 'View your bookings')}</a></p>`;
    const pkg = `<strong>${escHtml(b.package_name)}</strong>`;
    async function notifyClient(make) {
      const lang = await mailLang(ctx, b.client_user_id, b.client_email);
      const [subject, text] = make(lang);
      return sendEmail(ctx, deps, b.client_email, clientSubject(b, subject, lang), `${hiP(lang, escHtml(b.client_name))}<p>${text}</p>${link(lang)}`);
    }
    async function notifyCreator(make) {
      const c = await creatorContact(ctx, b);
      if (!c || !c.email) return;
      const [subject, text] = make(c.lang);
      await sendEmail(ctx, deps, c.email, subject, `${hiP(c.lang, escHtml(c.name))}<p>${text}</p>${link(c.lang)}`);
    }

    if (action === 'confirm') {
      if (!isCreator) throw new HttpError(403, 'Only the creator can confirm.');
      if (b.status !== 'paid') throw new HttpError(400, 'Only new paid bookings can be confirmed.');
      const nb = await move('paid', 'confirmed');
      await notifyClient((l) => [L(l, 'Confirmed: {pkg}', { pkg: b.package_name }), remote
        ? L(l, 'Your order {pkg} was accepted. Delivery is due by {date}. Your payment stays protected until you approve the result.', { pkg, date: `<strong>${when}</strong>` })
        : L(l, 'Great news — your shoot {pkg} on {date} is confirmed. Your payment stays protected until the shoot is done.', { pkg, date: `<strong>${when}</strong>` })]);
      return json({ booking: nb });
    }

    if (action === 'decline') {
      if (!isCreator) throw new HttpError(403, 'Only the creator can decline.');
      if (b.status !== 'paid' && b.status !== 'confirmed') throw new HttpError(400, 'This booking can no longer be declined.');
      const refundId = await refundAll();
      const nb = await move(b.status, 'declined', { stripe_refund_id: refundId });
      await notifyClient((l) => [L(l, 'Booking declined — full refund'), L(l, 'Unfortunately the creator can\'t take {pkg}. You\'ve been refunded in full ({amount}); it can take 5–10 days to appear.', { pkg, amount: refundText(b, l) })]);
      return json({ booking: nb });
    }

    if (action === 'deliver') {
      if (!remote) throw new HttpError(400, 'Only remote orders are delivered online.');
      if (!isCreator) throw new HttpError(403, 'Only the creator can deliver.');
      if (b.status !== 'confirmed') throw new HttpError(400, 'Accept the order before delivering.');
      const rawUrl = String(body.delivery_url || '').trim();
      const url = rawUrl ? cleanHttpsUrl(rawUrl) : '';
      if (url === null) throw new HttpError(400, 'The link must start with https://');
      const photos = await ctx.db(`booking_photos?booking_id=eq.${id}&select=id&limit=1`);
      const hasPhotos = (photos || []).length > 0;
      if (!url && !hasPhotos) throw new HttpError(400, 'Upload the finished photos, or add a link to the files (it must start with https://).');
      const nb = await move('confirmed', 'delivered', { delivery_url: url || b.delivery_url || null, delivered_at: new Date(ctx.nowMs()).toISOString() });
      const left = b.revisions_allowed - b.revisions_used;
      await notifyClient((l) => {
        const where = [hasPhotos ? `<a href="${ctx.siteUrl}/dashboard.html?b=${id}#bookings">${L(l, 'your CapturaGo gallery')}</a>` : '', url ? `<a href="${escHtml(url)}">${escHtml(url)}</a>` : ''].filter(Boolean).join(L(l, ' and '));
        return [L(l, 'Delivered: {pkg}', { pkg: b.package_name }), `${L(l, 'Your files are ready in {where}.', { where })}<br/>`
          + (left > 0 ? L(l, 'Please approve the delivery or request a revision ({n} left) in your dashboard.', { n: left }) : L(l, 'Please approve the delivery in your dashboard.'))
          + ' ' + L(l, 'If we don\'t hear from you within {n} days, the payment is released to the creator.', { n: RELEASE_AFTER_DAYS })];
      });
      return json({ booking: nb });
    }

    if (action === 'photos_ready') {
      if (remote) throw new HttpError(400, 'For remote orders, use “Deliver” instead.');
      if (!isCreator) throw new HttpError(403, 'Only the creator can send the photos.');
      if (b.status !== 'confirmed' && b.status !== 'completed') throw new HttpError(400, 'Photos can be sent for confirmed or completed bookings.');
      const photos = await ctx.db(`booking_photos?booking_id=eq.${id}&select=id&limit=301`);
      const n = (photos || []).length;
      if (!n) throw new HttpError(400, 'Upload the photos first.');
      if (b.photos_ready_at && ctx.nowMs() - Date.parse(b.photos_ready_at) < 3600000) throw new HttpError(429, 'The client was just notified. You can notify them again in an hour.');
      const nowIso = new Date(ctx.nowMs()).toISOString();
      const first = !b.photos_delivered_at;
      const rows = await ctx.db(`bookings?id=eq.${id}&status=eq.${b.status}`, { method: 'PATCH', body: { photos_ready_at: nowIso, ...(first ? { photos_delivered_at: nowIso } : {}) } });
      if (!rows.length) throw new HttpError(409, 'This booking was just updated. Please refresh.');
      const hold = payoutHold(rows[0]);
      const held = hold.promised && b.status === 'confirmed' && first;
      await notifyClient((l) => [L(l, '📸 Your photos are ready — {pkg}', { pkg: b.package_name }),
        L(l, n > 1 ? '{n} photos are waiting for you in your private CapturaGo gallery: {link} (or open the CapturaGo app → Bookings).' : '{n} photo is waiting for you in your private CapturaGo gallery: {link} (or open the CapturaGo app → Bookings).', { n, link: `<a href="${ctx.siteUrl}/dashboard.html?b=${id}#bookings">${L(l, 'view &amp; download')}</a>` })
        + `<br/>${L(l, 'Please download your favourites — the gallery is kept for 90 days after the booking is completed.')}`
        + (held ? `<br/>${L(l, 'Your payment stays on hold for {n} more days. If something isn\'t right, report a problem in your bookings before then.', { n: RELEASE_DAYS })}` : '')]);
      return json({ booking: rows[0], photos: n });
    }

    if (action === 'revise') {
      if (!remote) throw new HttpError(400, 'Revisions apply to remote orders only.');
      if (!isClient) throw new HttpError(403, 'Only the client can request a revision.');
      if (b.status !== 'delivered') throw new HttpError(400, 'You can request a revision after the delivery.');
      if (b.revisions_used >= b.revisions_allowed) throw new HttpError(400, 'No revisions left on this package. Message the creator, or report a problem.');
      const note = String(body.message || '').trim().slice(0, 1000);
      if (note.length < 3) throw new HttpError(400, 'Tell the creator what to change.');
      const nb = await move('delivered', 'confirmed', { revisions_used: b.revisions_used + 1, last_revision_note: note, delivered_at: null });
      await notifyCreator((l) => [L(l, 'Revision requested: {pkg}', { pkg: b.package_name }), `${L(l, '{name} asked for changes:', { name: escHtml(b.client_name) })}<br/>“${escHtml(note)}”<br/>${L(l, 'Please deliver the updated files from your dashboard.')}`]);
      return json({ booking: nb });
    }

    if (action === 'cancel') {
      if (!isClient) throw new HttpError(403, 'Only the client can cancel. Creators can decline instead.');
      if (b.status === 'pending_payment') {
        const nb = await move('pending_payment', 'cancelled');   // first: a payment arriving now is refunded by the webhook
        if (b.stripe_checkout_session_id) {
          await ctx.stripe(`checkout/sessions/${b.stripe_checkout_session_id}/expire`, {}).catch(() => {});
        }
        let refunded = false;
        if (Number(b.split_count) > 1) {
          const open = await ctx.db(`booking_shares?booking_id=eq.${id}&status=eq.pending&stripe_checkout_session_id=not.is.null&select=stripe_checkout_session_id`);
          for (const s of open || []) await ctx.stripe(`checkout/sessions/${s.stripe_checkout_session_id}/expire`, {}).catch(() => {});
          refunded = !!(await refundBooking(ctx, b));   // friends who already paid get their money back
        } else {
          await ctx.db('rpc/release_gift', { method: 'POST', body: { p_booking: id } });   // gift card amount goes back on the card
        }
        return json({ booking: nb, refunded });
      }
      const late = remote && b.status === 'confirmed' && days < 0;
      const freeSession = !remote && b.status === 'confirmed' && days >= FREE_CANCEL_DAYS;
      if (b.status === 'paid' || late || freeSession) {
        const refundId = await refundAll();
        const nb = await move(b.status, 'cancelled', { stripe_refund_id: refundId });
        if (late) await notifyCreator((l) => [L(l, 'Order cancelled (missed delivery date)'), L(l, 'The client cancelled {pkg} because it wasn\'t delivered by {date}. They were refunded.', { pkg, date: when })]);
        return json({ booking: nb, refunded: true });
      }
      if (remote && b.status === 'confirmed') throw new HttpError(400, `The creator has started working. If it isn't delivered by ${b.shoot_date}, you can cancel for a full refund.`);
      if (b.status === 'confirmed') throw new HttpError(400, `Free cancellation ends ${FREE_CANCEL_DAYS} days before the shoot. Please message the creator to reschedule.`);
      throw new HttpError(400, 'This booking can no longer be cancelled.');
    }

    if (action === 'complete') {
      if (remote) {
        if (b.status !== 'delivered') throw new HttpError(400, 'The work has to be delivered first.');
        if (isCreator && hoursSinceDelivery < RELEASE_AFTER_DAYS * 24) throw new HttpError(400, `Payment is released ${RELEASE_AFTER_DAYS} days after delivery, or sooner if the client approves.`);
        const transferId = await releasePayout();
        const nb = await move('delivered', 'completed', { stripe_transfer_id: transferId });
        if (isClient) await notifyCreator((l) => [L(l, 'Approved & paid: {pkg}', { pkg: b.package_name }), L(l, '{name} approved your delivery. {amount} is on its way to your payout account.', { name: escHtml(b.client_name), amount: euro(b.price_cents - b.creator_fee_cents) })]);
        return json({ booking: nb });
      }
      if (b.status !== 'confirmed') throw new HttpError(400, 'Only confirmed bookings can be completed.');
      if (isClient && days > 0) throw new HttpError(400, 'You can confirm the shoot on or after the shoot date.');
      if (isCreator && days > -RELEASE_AFTER_DAYS) throw new HttpError(400, `Payment is released ${RELEASE_AFTER_DAYS} days after the shoot date, or sooner if the client confirms.`);
      const hold = payoutHold(b);
      if (isCreator && hold.promised && (hold.releaseAt === null || ctx.nowMs() < hold.releaseAt)) {
        throw new HttpError(400, hold.delivered ? `Payment is released ${RELEASE_AFTER_DAYS} days after you sent the photos, or sooner if the client confirms.` : 'Your package promises the photos — send them first. Payment is released 3 days later, or sooner if the client confirms.');
      }
      return json({ booking: await move('confirmed', 'completed', { stripe_transfer_id: await releasePayout() }) });
    }

    if (action === 'dispute') {
      if (!isClient) throw new HttpError(403, 'Only the client can report a problem.');
      const allowed = remote ? ['paid', 'confirmed', 'delivered'] : ['paid', 'confirmed'];
      if (!allowed.includes(b.status)) throw new HttpError(400, 'This booking can no longer be disputed.');
      if (remote && b.status === 'delivered' && hoursSinceDelivery > RELEASE_AFTER_DAYS * 24) throw new HttpError(400, `Problems must be reported within ${RELEASE_AFTER_DAYS} days after delivery.`);
      const hold = payoutHold(b);
      if (!remote && hold.promised && b.status === 'confirmed') {
        if (hold.delivered && ctx.nowMs() > hold.releaseAt) throw new HttpError(400, `Problems must be reported within ${RELEASE_AFTER_DAYS} days after the photos were sent.`);
      } else if (!remote && days < -RELEASE_AFTER_DAYS) throw new HttpError(400, `Problems must be reported within ${RELEASE_AFTER_DAYS} days after the shoot.`);
      const reason = ['no_show', 'quality', 'photos_late', 'other'].includes(body.reason) ? body.reason : 'other';
      if (reason === 'no_show' && (remote || days > 0)) throw new HttpError(400, 'You can report a no-show on or after the shoot day.');
      if (reason === 'photos_late' && (remote || !hold.promised || hold.delivered || ctx.isoInDays(0) <= hold.dueIso)) {
        throw new HttpError(400, hold.promised && !hold.delivered ? `The photos are promised by ${hold.dueIso}. You can report them as late after that day.` : 'This booking has no late photos to report.');
      }
      const note = String(body.message || '').trim().slice(0, 1000);
      const nb = await move(b.status, 'disputed', { dispute_reason: reason, dispute_note: note || null });
      const label = { no_show: 'Creator did not show up', quality: 'Not what was agreed', photos_late: 'Photos are late', other: 'Other problem' }[reason];
      await sendEmail(ctx, deps, ctx.env('SUPPORT_EMAIL', 'hello@capturago.com'), `Dispute opened (${label}): booking ${id}`,
        `<p>${escHtml(b.client_name)} (${escHtml(b.client_email)}) reported a problem with booking ${id} (${remote ? 'remote' : 'in-person'}, ${escHtml(b.package_name)}, ${when}, ${euro(b.total_cents)}). Payout is frozen until resolved.</p><p><strong>${escHtml(label)}</strong>${note ? `: “${escHtml(note)}”` : ''}</p>`);
      await notifyCreator((l) => [L(l, 'Problem reported: {pkg}', { pkg: b.package_name }), L(l, '{name} reported a problem with the booking on {date} ({problem}). The payment is on hold while our team reviews it — we\'ll contact you both by email. You can reply to the traveller in your CapturaGo messages.', { name: escHtml(b.client_name), date: when, problem: `<strong>${escHtml(L(l, label))}</strong>` })]);
      return json({ booking: nb });
    }

    // ── Planning: reschedule (both sides agree), meeting point, shot list ──
    const other = isCreator ? 'client' : 'creator';
    async function notifyOther(make) { if (other === 'client') await notifyClient(make); else await notifyCreator(make); }
    async function patchPlan(fields) {
      const rows = await ctx.db(`bookings?id=eq.${id}&status=eq.${b.status}`, { method: 'PATCH', body: fields });
      if (!rows.length) throw new HttpError(409, 'This booking was just updated. Please refresh.');
      return rows[0];
    }
    async function dayIsFree(date) {
      let p;
      try { [p] = await ctx.db(`photographers?id=eq.${b.photographer_id}&select=unavailable_dates,max_per_day,external_busy_dates,trips`); }
      catch (e) { if (!/external_busy_dates|trips/.test(String(e && e.message))) throw e; [p] = await ctx.db(`photographers?id=eq.${b.photographer_id}&select=unavailable_dates,max_per_day`); }
      if (!p) return false;
      if ((Array.isArray(p.unavailable_dates) ? p.unavailable_dates : []).includes(date)) return false;
      if ((Array.isArray(p.external_busy_dates) ? p.external_busy_dates : []).includes(date)) return false;
      const there = tripOn(p.trips, date);
      if (cityKey(there ? there.city : '') !== cityKey(b.shoot_city || '')) throw new HttpError(409, 'The creator is in another city on that day. Please choose another date.');
      const taken = await ctx.db(`bookings?photographer_id=eq.${b.photographer_id}&shoot_date=eq.${date}&booking_type=eq.session&id=neq.${id}&${dayHoldFilter(ctx)}&select=id&limit=10`);
      return (taken || []).length < Math.min(Math.max(Number(p.max_per_day) || 1, 1), 6);
    }
    const planGuard = () => {
      if (remote) throw new HttpError(400, 'This is for in-person shoots.');
      if (!PLAN_STATUSES.includes(b.status)) throw new HttpError(400, 'This booking can no longer be changed.');
    };

    if (action === 'propose_date') {
      planGuard();
      if (days < 0) throw new HttpError(400, 'The shoot date has passed. Please report a problem instead.');
      if ((b.reschedules || 0) >= MAX_RESCHEDULES) throw new HttpError(400, `This booking was already moved ${MAX_RESCHEDULES} times. Please message each other, or the creator can cancel with a full refund.`);
      if (b.proposed_date && b.proposed_by && b.proposed_by !== user.id) throw new HttpError(409, 'There is already a new date proposed to you — accept or decline it first.');
      const date = String(body.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new HttpError(400, 'Choose a valid date.');
      if (date < ctx.isoInDays(1) || date > ctx.isoInDays(365)) throw new HttpError(400, 'Choose a date between tomorrow and one year ahead.');
      if (date === b.shoot_date) throw new HttpError(400, 'That is already the shoot date.');
      const slot = String(body.time_slot || '');
      if (slot && !TIME_SLOTS[slot]) throw new HttpError(400, 'Choose a time of day.');
      const reason = body.reason === 'weather' ? 'weather' : 'other';
      const msg = String(body.message || '').trim().slice(0, 300);
      if (!(await dayIsFree(date))) throw new HttpError(409, 'The creator isn\'t available on that day. Please choose another date.');
      const nb = await patchPlan({ proposed_date: date, proposed_slot: slot || null, proposed_by: user.id, proposed_reason: reason, proposed_at: new Date(ctx.nowMs()).toISOString() });
      await notifyOther((l) => {
        const who = isCreator ? L(l, 'Your creator') : escHtml(b.client_name);
        const to = `<strong>${escHtml(date)}</strong>${slot ? ` (${escHtml(L(l, slotLabel(slot)))})` : ''}`;
        return [L(l, 'New date proposed: {pkg}', { pkg: b.package_name }),
          L(l, reason === 'weather' ? '{who} proposed moving the shoot from {from} to {to} because of the weather.' : '{who} proposed moving the shoot from {from} to {to}.', { who, from: `<strong>${when}</strong>`, to })
          + (msg ? `<br/>“${escHtml(msg)}”` : '') + `<br/>${L(l, 'Please accept or decline it in your bookings.')}`];
      });
      return json({ booking: nb });
    }

    if (action === 'accept_date' || action === 'decline_date' || action === 'withdraw_date') {
      planGuard();
      if (!b.proposed_date) throw new HttpError(400, 'There is no new date to answer.');
      const mine = b.proposed_by === user.id;
      if (action === 'withdraw_date' && !mine) throw new HttpError(403, 'Only the person who proposed the date can withdraw it.');
      if (action !== 'withdraw_date' && mine) throw new HttpError(403, 'The other side has to answer your proposal.');
      const clear = { proposed_date: null, proposed_slot: null, proposed_by: null, proposed_reason: null, proposed_at: null };
      if (action === 'accept_date') {
        if (b.proposed_date < ctx.isoInDays(1)) throw new HttpError(400, 'That date has passed. Please propose a new one.');
        if (!(await dayIsFree(b.proposed_date))) throw new HttpError(409, 'That day is no longer free. Please propose another date.');
        const notices = { ...(b.notices || {}) }; delete notices.reminder;
        const nb = await patchPlan({ ...clear, shoot_date: b.proposed_date, time_slot: b.proposed_slot || b.time_slot || null, reschedules: (b.reschedules || 0) + 1, notices });
        const make = (l) => [L(l, 'New date confirmed: {pkg}', { pkg: b.package_name }), L(l, 'The shoot {pkg} was moved to {date}. Your payment stays protected as before.', { pkg, date: `<strong>${escHtml(b.proposed_date)}</strong>${b.proposed_slot ? ` (${escHtml(L(l, slotLabel(b.proposed_slot)))})` : ''}` })];
        if (isCreator) await notifyClient(make); else await notifyCreator(make);
        return json({ booking: nb });
      }
      const nb = await patchPlan(clear);
      if (action === 'decline_date') {
        const make = (l) => [L(l, 'New date declined: {pkg}', { pkg: b.package_name }), L(l, 'The proposal to move {pkg} to {date} was declined, so the shoot stays on {old}. Message each other to find another date.', { pkg, date: escHtml(b.proposed_date), old: `<strong>${when}</strong>` })];
        if (isCreator) await notifyClient(make); else await notifyCreator(make);
      }
      return json({ booking: nb });
    }

    if (action === 'set_meeting') {
      planGuard();
      if (!isCreator) throw new HttpError(403, 'Only the creator sets the meeting point.');
      const point = String(body.meeting_point || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      const time = String(body.meeting_time || '').trim();
      if (time && !MEETING_TIME_RE.test(time)) throw new HttpError(400, 'Enter the time as HH:MM, e.g. 18:30.');
      if (!point && !time) throw new HttpError(400, 'Enter a meeting point or a time.');
      const changed = point !== (b.meeting_point || '') || time !== (b.meeting_time || '');
      const nb = await patchPlan({ meeting_point: point || null, meeting_time: time || null });
      if (changed) await notifyClient((l) => [L(l, 'Where to meet: {pkg}', { pkg: b.package_name }), `${L(l, 'Your creator shared the plan for {date}:', { date: `<strong>${when}</strong>` })}</p>${planHtml(nb, false, l)}<p>${L(l, 'Questions? Message them on CapturaGo.')}`]);
      return json({ booking: nb });
    }

    if (action === 'set_brief') {
      planGuard();
      if (!isClient) throw new HttpError(403, 'Only the traveller can edit the shot list.');
      const shots = (Array.isArray(body.shot_list) ? body.shot_list : []).map((x) => String(x || '').replace(/\s+/g, ' ').trim().slice(0, 120)).filter(Boolean);
      if (shots.length > 20) throw new HttpError(400, 'Up to 20 shots on the list.');
      const links = [];
      for (const raw of Array.isArray(body.ref_links) ? body.ref_links : []) {
        if (!String(raw || '').trim()) continue;
        const u = cleanHttpsUrl(raw);
        if (!u) throw new HttpError(400, 'Reference links must start with https://');
        links.push(u);
      }
      if (links.length > 6) throw new HttpError(400, 'Up to 6 reference links.');
      const nb = await patchPlan({ shot_list: shots, ref_links: links, surprise: body.surprise === true });
      return json({ booking: nb });
    }

    throw new HttpError(400, 'Unknown action.');
  });
}

startServer(createHandler);
