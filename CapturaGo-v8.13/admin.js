/* ================================================================
   CapturaGo — admin panel
   All data and actions go through the `admin` server function,
   which refuses anyone who isn't in the admins table.
================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const euro = (c) => `€${((c || 0) / 100).toFixed(2)}`;
  const fmt = (d) => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const call = (action, payload) => CG.admin(action, payload);

  const gate = (html) => { $('adminGate').hidden = false; $('adminGate').innerHTML = html; };
  const user = await CG.auth.getUser();
  if (!user) { gate('Please <a href="/">sign in on the homepage</a> first, then come back.'); return; }
  const who = await call('whoami');
  if (who.error) { gate(who.error.status === 403 ? 'This account has no admin access.' : `Could not check access: ${esc(who.error.message)}`); return; }
  $('adminGate').hidden = true;
  $('adminSidebar').hidden = false;

  /* ── navigation ── */
  const loaders = { overview: loadOverview, bookings: loadBookings, creators: loadCreators, reviews: loadReviews, reports: loadReports, insights: loadInsights, profiles: loadProfileReports, founding: loadFounding, partners: loadPartners, gifts: loadGifts };
  function showPanel(name) {
    document.querySelectorAll('.dash-panel').forEach((p) => { p.hidden = p.dataset.panelId !== name; });
    document.querySelectorAll('.dash-nav-item').forEach((b) => b.classList.toggle('active', b.dataset.panel === name));
    loaders[name]();
  }
  document.querySelectorAll('.dash-nav-item').forEach((b) => b.addEventListener('click', () => showPanel(b.dataset.panel)));

  /* ── 🏨 partners ── */
  const KIND = { hotel: 'Hotel', hostel: 'Hostel', guesthouse: 'Guesthouse', apartments: 'Apartments', tours: 'Tours / desk', other: 'Other' };
  async function loadPartners() {
    const box = $('ptList');
    const { data, error } = await call('partners');
    if (error) { box.innerHTML = `<p class="muted">${esc(error.message)}</p>`; return; }
    const list = data.partners || [];
    box.innerHTML = list.length ? list.map((p) => `<div class="dash-card" style="margin-bottom:12px" data-pt="${esc(p.id)}">
        <div class="admin-row" style="justify-content:space-between;gap:10px;flex-wrap:wrap"><strong>${esc(p.name)} · ${esc(KIND[p.kind] || p.kind)} · ${esc(p.city)}</strong>
          <span class="status-pill status-${p.status === 'approved' ? 'confirmed' : p.status === 'pending' ? 'paid' : 'cancelled'}">${esc(p.status)}</span></div>
        <p class="small" style="margin:6px 0">${esc(p.contact_name)} · <a href="mailto:${encodeURIComponent(p.email || '')}">${esc(p.email || '—')}</a>${p.website && safeUrl(p.website) ? ` · <a href="${esc(safeUrl(p.website))}" target="_blank" rel="noopener nofollow">${esc(p.website)}</a>` : ''}${p.code ? ` · code <strong>${esc(p.code)}</strong>` : ''}</p>
        ${p.message ? `<p class="muted small">“${esc(p.message)}”</p>` : ''}
        ${p.payout_note ? `<p class="small">💶 Payout details: ${esc(p.payout_note)}</p>` : ''}
        <p class="small">Thank-yous owed: <strong>${euro(p.owed_cents)}</strong></p>
        <div class="admin-row" style="gap:8px;flex-wrap:wrap">
          ${p.status !== 'approved' ? `<button class="primary-btn" data-dec="approve">Approve</button>` : ''}
          ${p.status === 'pending' ? `<button class="secondary-btn" data-dec="reject">Reject</button>` : ''}
          ${p.status === 'approved' ? `<button class="secondary-btn" data-dec="pause">Pause</button>` : ''}
          ${p.owed_cents ? `<button class="secondary-btn" data-paid="1">Mark ${euro(p.owed_cents)} as paid</button>` : ''}
        </div></div>`).join('') : '<p class="muted">No applications yet. Partners apply on capturago.com/partners.html.</p>';
    box.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.closest('[data-pt]').dataset.pt;
      if (b.dataset.dec !== 'approve' && !confirm(`${b.dataset.dec === 'reject' ? 'Reject' : 'Pause'} this partner?`)) return;
      b.disabled = true;
      const { error: err } = await call('partner_decide', { partner_id: id, decision: b.dataset.dec });
      if (err) { b.disabled = false; showToast(err.message, 'error'); return; }
      showToast('Saved ✓', 'success'); loadPartners();
    }));
    box.querySelectorAll('[data-paid]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Have you sent the bank transfer? This marks all owed thank-yous of this partner as paid.')) return;
      const { data: d, error: err } = await call('partner_paid', { partner_id: b.closest('[data-pt]').dataset.pt });
      if (err) { showToast(err.message, 'error'); return; }
      showToast(`${d.paid} thank-you${d.paid === 1 ? '' : 's'} marked paid (${euro(d.amount_cents)}).`, 'success'); loadPartners();
    }));
  }

  /* ── 🎁 gift cards ── */
  async function loadGifts(q = '') {
    const box = $('gcList');
    const { data, error } = await call('gifts', { q });
    if (error) { box.innerHTML = `<p class="muted">${esc(error.message)}</p>`; return; }
    const list = data.gifts || [];
    box.innerHTML = list.length ? list.map((g) => `<div class="dash-card admin-row" style="justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px" data-gc="${esc(g.id)}">
        <span><strong translate="no">${esc(g.code)}</strong> · ${euro(g.amount_cents)} (${euro(g.balance_cents)} left) · ${esc(g.status)}<br/><span class="muted small">${esc(g.buyer_email || '')}${g.recipient_name ? ` → ${esc(g.recipient_name)}` : ''} · ${fmt(g.created_at)}</span></span>
        ${g.status === 'active' && g.balance_cents === g.amount_cents ? '<button class="secondary-btn" data-refund="1">Refund</button>' : ''}</div>`).join('') : '<p class="muted">No gift cards.</p>';
    box.querySelectorAll('[data-refund]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Refund this unused gift card? The code stops working.')) return;
      const { error: err } = await call('gift_refund', { gift_id: b.closest('[data-gc]').dataset.gc });
      if (err) { showToast(err.message, 'error'); return; }
      showToast('Refunded ✓', 'success'); loadGifts($('gcQ').value.trim());
    }));
  }
  $('gcSearch').addEventListener('submit', (e) => { e.preventDefault(); loadGifts($('gcQ').value.trim()); });

  /* ── overview ── */
  async function loadOverview() {
    $('ovStats').innerHTML = '<p class="muted">Loading…</p>';
    const { data, error } = await call('overview');
    if (error) { $('ovStats').innerHTML = `<p class="muted">${esc(error.message)}</p>`; return; }
    const s = data.bookings.by_status || {};
    const stat = (v, l) => `<div class="admin-stat"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`;
    $('ovStats').innerHTML = [
      stat(data.creators.total, `creators (${data.creators.visible} visible, ${data.creators.new_30d} new in 30 days)`),
      stat(data.creators.with_packages, 'creators with packages'),
      stat(data.creators.payouts_enabled, 'creators with payouts on'),
      stat(data.bookings.total, 'bookings in total'),
      stat(s.disputed || 0, 'open disputes'),
      stat(s.paid || 0, 'paid, awaiting creator'),
      stat(euro(data.money.gmv_cents), `booking value (GMV) · ${euro(data.money.gmv_30d_cents)} in 30 days`),
      stat(euro(data.money.fee_revenue_cents + data.money.boost_revenue_cents), `your revenue · ${euro(data.money.fee_revenue_30d_cents + data.money.boost_revenue_30d_cents)} in 30 days`),
      stat(euro(data.money.boost_revenue_cents), 'of which boosts'),
      stat(data.inquiries_30d, 'inquiries in 30 days'),
      stat(data.conversations_30d || 0, 'new conversations in 30 days'),
      stat(data.open_reports || 0, 'open message reports'),
      stat(data.open_listing_reports || 0, 'open profile reports'),
    ].join('');
    const runs = data.job_runs || [];
    const lastOk = runs.find((r) => r.finished_at);
    const stale = !lastOk || Date.now() - Date.parse(lastOk.finished_at) > 2 * 3600000;
    $('ovJobs').innerHTML = (stale ? `<p class="admin-job bad">⚠ The automatic jobs haven't run in the last 2 hours. Check the hourly schedule in Supabase (setup guide, Part 9).</p>` : '') +
      (runs.length ? runs.map((r) => {
        const sm = r.summary || {};
        const parts = Object.entries(sm).filter(([, v]) => v).map(([k, v]) => `${esc(k.replace(/_/g, ' '))}: ${esc(v)}`);
        return `<div class="admin-job">${fmt(r.started_at)} — ${r.finished_at ? (parts.length ? parts.join(' · ') : 'nothing to do') : '<span class="bad">did not finish</span>'}${r.error ? `<br/><span class="bad">${esc(r.error)}</span>` : ''}</div>`;
      }).join('') : '<p class="admin-job">No runs yet.</p>');
    $('ovCities').innerHTML = (data.creators.top_cities || []).length
      ? data.creators.top_cities.map(([c, n]) => `<span class="status-pill" style="margin:0 6px 6px 0">${esc(c)} · ${esc(n)}</span>`).join('')
      : '<p class="muted">No creators yet.</p>';
  }
  $('runJobs').addEventListener('click', async () => {
    const b = $('runJobs'); b.disabled = true; b.textContent = 'Running…';
    const { data, error } = await CG.jobs.run();
    b.disabled = false; b.textContent = 'Run jobs now';
    if (error) { showToast(error.message, 'error', 6000); return; }
    const done = Object.entries(data.summary || {}).filter(([, v]) => v).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
    showToast(done.length ? `Jobs done — ${done.join(', ')}` : 'Jobs done — nothing to do', 'success', 6000);
    loadOverview();
  });

  /* ── bookings ── */
  async function loadBookings() {
    $('bkList').innerHTML = '<p class="muted" style="padding:14px">Loading…</p>';
    const { data, error } = await call('bookings', { status: $('bkStatus').value });
    if (error) { $('bkList').innerHTML = `<p class="muted" style="padding:14px">${esc(error.message)}</p>`; return; }
    const rows = data.bookings || [];
    if (!rows.length) { $('bkList').innerHTML = '<p class="muted" style="padding:14px">No bookings.</p>'; return; }
    $('bkList').innerHTML = `<table class="admin-table"><thead><tr><th>Created</th><th>Status</th><th>Booking</th><th>Client</th><th>Creator</th><th>Total</th><th>Actions</th></tr></thead><tbody>${
      rows.map((b) => {
        const canRefund = ['paid', 'confirmed', 'delivered', 'disputed'].includes(b.status);
        const canRelease = ['confirmed', 'delivered', 'disputed'].includes(b.status);
        return `<tr>
          <td>${fmtDate(b.created_at)}</td>
          <td><span class="status-pill status-${esc(b.status)}">${esc(b.status)}</span></td>
          <td>${esc(b.package_name)}<span class="muted small">${b.booking_type === 'delivery' ? 'Remote · due' : 'Shoot'} ${esc(b.shoot_date)}</span>${b.dispute_reason ? `<span class="muted small bad">⚠ ${esc({ no_show: 'Creator did not show up', quality: 'Not what was agreed', photos_late: 'Photos are late', other: 'Other problem' }[b.dispute_reason] || b.dispute_reason)}${b.dispute_note ? `: “${esc(b.dispute_note)}”` : ''}</span>` : ''}${b.package_details && packageFacts(b.package_details).length ? `<span class="muted small">Agreed: ${esc(packageFacts(b.package_details).join(' · '))}</span>` : ''}${b.shoot_city ? `<span class="muted small">🌍 In ${esc(String(b.shoot_city).split(',')[0])} (creator's trip)</span>` : ''}${b.photos_promised && b.status === 'confirmed' ? `<span class="muted small">${b.photos_delivered_at ? `🔒 Photos sent ${esc(String(b.photos_delivered_at).slice(0, 10))} — payout 3 days later` : '🔒 Payout held until the photos are sent'}</span>` : ''}</td>
          <td>${esc(b.client_name)}<span class="muted small">${esc(b.client_email)}</span></td>
          <td>${esc(b.photographers ? b.photographers.name : '—')}<span class="muted small">${esc(b.photographers ? b.photographers.city : '')}</span></td>
          <td>${euro(b.total_cents)}<span class="muted small">fee ${euro(b.client_fee_cents + b.creator_fee_cents)}</span></td>
          <td>${canRefund ? `<button class="danger-btn" data-act="booking_refund" data-id="${esc(b.id)}" data-msg="Refund ${esc(euro(b.total_cents))} to ${esc(b.client_name)}?">Refund</button>` : ''}${canRelease ? `<button class="primary-btn" data-act="booking_release" data-id="${esc(b.id)}" data-msg="Pay ${esc(euro(b.price_cents - b.creator_fee_cents))} out to the creator?">Release payout</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
    $('bkList').querySelectorAll('button[data-act]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm(`${btn.dataset.msg}\nThis can't be undone.`)) return;
      btn.disabled = true;
      const { error } = await call(btn.dataset.act, { booking_id: btn.dataset.id });
      if (error) { btn.disabled = false; showToast(error.message, 'error', 6000); return; }
      showToast(btn.dataset.act === 'booking_refund' ? 'Refunded ✓' : 'Payout released ✓', 'success');
      loadBookings();
    }));
  }
  $('bkStatus').addEventListener('change', loadBookings);

  /* ── creators ── */
  async function loadCreators() {
    $('crList').innerHTML = '<p class="muted" style="padding:14px">Loading…</p>';
    const { data, error } = await call('creators', { q: $('crSearch').value.trim() });
    if (error) { $('crList').innerHTML = `<p class="muted" style="padding:14px">${esc(error.message)}</p>`; return; }
    const rows = data.creators || [];
    if (!rows.length) { $('crList').innerHTML = '<p class="muted" style="padding:14px">No creators found.</p>'; return; }
    $('crList').innerHTML = `<table class="admin-table"><thead><tr><th>Creator</th><th>Joined</th><th>Setup</th><th>Rating</th><th>Verified</th><th>Featured</th><th>Visibility</th></tr></thead><tbody>${
      rows.map((c) => `<tr data-id="${esc(c.id)}">
        <td>${esc(c.name)}<span class="muted small">${esc(c.city)} · <a href="mailto:${encodeURIComponent(c.email || '')}">${esc(c.email || '')}</a></span></td>
        <td>${fmtDate(c.created_at)}</td>
        <td><span class="muted small">${esc((c.services || []).length)} services · ${esc(c.packages)} packages<br/>${c.payouts_enabled ? 'payouts on' : 'payouts off'}</span></td>
        <td>${esc(Number(c.rating || 0).toFixed(1))}<span class="muted small">${esc(c.reviews_count || 0)} reviews</span></td>
        <td><select class="cr-verified" aria-label="Verified level">${[0, 1, 2, 3].map((v) => `<option value="${v}" ${Number(c.verified) === v ? 'selected' : ''}>${['Not verified', '✓ Verified', '✓✓ Portfolio reviewed', '✓✓✓ ID verified'][v]}</option>`).join('')}</select></td>
        <td><input type="checkbox" class="cr-featured" aria-label="Featured" ${c.featured ? 'checked' : ''} /></td>
        <td><button class="${c.hidden ? 'primary-btn' : 'danger-btn'} cr-hide" data-hidden="${c.hidden ? '1' : '0'}">${c.hidden ? 'Unhide' : 'Hide'}</button></td>
      </tr>`).join('')}</tbody></table>`;
    const update = async (row, patch, okMsg) => {
      const { error } = await call('creator_update', { id: row.dataset.id, ...patch });
      if (error) { showToast(error.message, 'error', 6000); loadCreators(); return; }
      showToast(okMsg, 'success');
    };
    $('crList').querySelectorAll('tr[data-id]').forEach((row) => {
      row.querySelector('.cr-verified').addEventListener('change', (e) => update(row, { verified: Number(e.target.value) }, 'Verification updated ✓'));
      row.querySelector('.cr-featured').addEventListener('change', (e) => update(row, { featured: e.target.checked }, e.target.checked ? 'Featured ✓' : 'No longer featured'));
      row.querySelector('.cr-hide').addEventListener('click', async (e) => {
        const hide = e.target.dataset.hidden !== '1';
        if (hide && !confirm('Hide this listing? It disappears from search, the map and AI match, and can no longer be booked.')) return;
        await update(row, { hidden: hide }, hide ? 'Listing hidden' : 'Listing visible again');
        loadCreators();
      });
    });
  }
  let searchTimer;
  $('crSearch').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadCreators, 300); });

  /* ── reviews ── */
  async function loadReviews() {
    $('rvList').innerHTML = '<p class="muted" style="padding:14px">Loading…</p>';
    const { data, error } = await call('reviews');
    if (error) { $('rvList').innerHTML = `<p class="muted" style="padding:14px">${esc(error.message)}</p>`; return; }
    const rows = data.reviews || [];
    if (!rows.length) { $('rvList').innerHTML = '<p class="muted" style="padding:14px">No reviews yet.</p>'; return; }
    $('rvList').innerHTML = `<table class="admin-table"><thead><tr><th>Date</th><th>Creator</th><th>Reviewer</th><th>Rating</th><th>Comment</th><th></th></tr></thead><tbody>${
      rows.map((r) => `<tr>
        <td>${fmtDate(r.created_at)}</td>
        <td>${esc(r.photographers ? r.photographers.name : '—')}</td>
        <td>${esc(r.reviewer_name)}</td>
        <td>${'★'.repeat(Math.max(0, Math.min(5, Number(r.rating) || 0)))}</td>
        <td style="max-width:380px">${esc(r.comment || '')}</td>
        <td><button class="danger-btn" data-id="${esc(r.id)}">Delete</button></td>
      </tr>`).join('')}</tbody></table>`;
    $('rvList').querySelectorAll('button[data-id]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Delete this review? The creator\'s rating will be recalculated.')) return;
      const { error } = await call('review_delete', { id: btn.dataset.id });
      if (error) { showToast(error.message, 'error', 6000); return; }
      showToast('Review deleted ✓', 'success');
      loadReviews();
    }));
  }

  /* ── reported conversations ── */
  async function loadReports() {
    $('rpView').hidden = true;
    $('rpList').innerHTML = '<p class="muted" style="padding:14px">Loading…</p>';
    const { data, error } = await call('reports', { status: $('rpStatus').value });
    if (error) { $('rpList').innerHTML = `<p class="muted" style="padding:14px">${esc(error.message)}</p>`; return; }
    const rows = data.reports || [];
    if (!rows.length) { $('rpList').innerHTML = '<p class="muted" style="padding:14px">No reports. 🎉</p>'; return; }
    $('rpList').innerHTML = `<table class="admin-table"><thead><tr><th>Date</th><th>Between</th><th>Reported by</th><th>Reason</th><th></th></tr></thead><tbody>${
      rows.map((r) => `<tr>
        <td>${fmt(r.created_at)}</td>
        <td>${esc(r.client_name)} (traveller)<span class="muted small">${esc(r.creator_name)} (creator)${r.blocked ? ' · blocked' : ''}</span></td>
        <td>${esc(r.reported_by)}</td>
        <td style="max-width:320px">${esc(r.reason)}</td>
        <td><button class="primary-btn" data-view="${esc(r.id)}">Read conversation</button>${r.status === 'open' ? ` <button class="danger-btn" data-resolve="${esc(r.id)}">Mark resolved</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>`;
    $('rpList').querySelectorAll('button[data-view]').forEach((btn) => btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { data: d, error: err } = await call('report_view', { report_id: btn.dataset.view });
      btn.disabled = false;
      if (err) { showToast(err.message, 'error', 6000); return; }
      const msgs = d.messages || [];
      $('rpView').hidden = false;
      $('rpView').innerHTML = `<h3 style="margin:0 0 12px">Conversation (${msgs.length} messages)</h3>` + (msgs.length
        ? msgs.map((m) => `<div class="admin-job"><strong>${esc(m.from)}</strong> · <span class="muted small" style="display:inline">${fmt(m.created_at)}</span><br/>${esc(m.body)}</div>`).join('')
        : '<p class="muted">No messages.</p>');
      $('rpView').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    $('rpList').querySelectorAll('button[data-resolve]').forEach((btn) => btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error: err } = await call('report_resolve', { report_id: btn.dataset.resolve });
      if (err) { btn.disabled = false; showToast(err.message, 'error', 6000); return; }
      showToast('Report resolved ✓', 'success');
      loadReports();
    }));
  }
  $('rpStatus').addEventListener('change', loadReports);

  /* ── search insights ── */
  async function loadInsights() {
    $('inFunnel').innerHTML = '<p class="muted">Loading…</p>';
    $('inUnmet').innerHTML = ''; $('inCities').innerHTML = '';
    const { data, error } = await call('insights', { days: Number($('inDays').value) });
    if (error) { $('inFunnel').innerHTML = `<p class="muted">${esc(error.message)}</p>`; return; }
    const f = data.funnel || {};
    const stat = (v, l) => `<div class="admin-stat"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`;
    const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
    $('inFunnel').innerHTML = [
      stat(f.searches || 0, 'city searches'),
      stat(f.zero_results || 0, `found nobody (${pct(f.zero_results || 0, f.searches || 0)})`),
      stat(f.profile_views || 0, 'profile views'),
      stat(f.conversations || 0, 'new conversations'),
      stat(f.book_starts || 0, 'opened the booking form'),
      stat(f.paid_bookings || 0, `paid bookings (${pct(f.paid_bookings || 0, f.book_starts || 0)} of booking forms)`),
      stat(f.completed || 0, 'completed shoots'),
      stat(data.waiting_alerts || 0, 'people waiting for a city'),
      ...(data.growth ? [
        stat(data.growth.share_views || 0, 'shared galleries opened by friends'),
        stat(data.growth.share_clicks || 0, `clicks to book from a shared gallery (${pct(data.growth.share_clicks || 0, data.growth.share_views || 0)})`),
        stat(data.growth.city_pages || 0, 'city page visits'),
        stat(data.growth.founders || 0, `founding creators (${data.growth.founding_open || 0} spots still open)`),
      ] : []),
    ].join('');
    const unmet = data.unmet || [];
    $('inUnmet').innerHTML = unmet.length ? `<table class="admin-table"><thead><tr><th>City</th><th>Service</th><th>Searches</th></tr></thead><tbody>${
      unmet.map((u) => `<tr><td>${esc(u.city)}</td><td>${esc(u.service || 'any')}</td><td>${esc(u.n)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted" style="padding:14px">Nothing yet — every search found someone, or nobody searched.</p>';
    const cities = data.cities || [];
    $('inCities').innerHTML = cities.length ? `<table class="admin-table"><thead><tr><th>City</th><th>Searches</th><th>Found nobody</th><th>Creators</th><th>Waiting</th><th></th></tr></thead><tbody>${
      cities.map((c) => {
        const gap = c.searches >= 3 && c.creators < 2;
        const action = c.founding ? '<span class="status-pill status-completed">🏅 founding open</span>'
          : gap ? `<span class="status-pill status-disputed">recruit here</span> <button type="button" class="link-btn in-found" data-city="${esc(c.city)}">Open founding spots</button>` : '';
        return `<tr><td>${esc(c.city)}</td><td>${esc(c.searches)}</td><td>${esc(c.zero)}</td><td>${esc(c.creators)}</td><td>${esc(c.waiting)}</td><td>${action}</td></tr>`;
      }).join('')}</tbody></table>` : '<p class="muted" style="padding:14px">No data yet.</p>';
  }
  $('inDays').addEventListener('change', loadInsights);
  $('inCities').addEventListener('click', (e) => {
    const btn = e.target.closest('.in-found'); if (!btn) return;
    const city = btn.dataset.city || '';
    showPanel('founding');
    $('fdCity').value = city.replace(/\b\p{L}/gu, (m) => m.toUpperCase());
    $('fdCity').focus();
  });

  /* ── founding creators ── */
  async function loadFounding() {
    $('fdCities').innerHTML = '<p class="muted" style="padding:14px">Loading…</p>'; $('fdClaims').innerHTML = '';
    const { data, error } = await call('founding');
    if (error) { $('fdCities').innerHTML = `<p class="muted" style="padding:14px">${esc(error.message)}</p>`; return; }
    const cities = data.cities || [], claims = data.claims || [];
    $('fdCities').innerHTML = cities.length ? `<table class="admin-table"><thead><tr><th>City</th><th>Status</th><th>Spots taken</th><th>Free boost</th><th>Listed creators</th><th></th></tr></thead><tbody>${
      cities.map((c) => `<tr><td><a href="/in/${esc(citySlug(c.city_label))}" target="_blank" rel="noopener">${esc(c.city_label)}</a></td>
        <td>${c.active ? '<span class="status-pill status-completed">Open</span>' : '<span class="status-pill">Closed</span>'}</td>
        <td>${esc(c.taken)} / ${esc(c.slots)}</td><td>${c.perk_days ? `${esc(c.perk_days)} days` : '—'}</td><td>${esc(c.listed ?? 0)}</td>
        <td><button type="button" class="link-btn fd-edit" data-k="${esc(c.city_key)}">Edit</button>
          ${c.active ? `<button type="button" class="link-btn fd-invite" data-k="${esc(c.city_key)}" title="${c.invited_at ? `Last emailed ${esc(fmt(c.invited_at))}` : 'Never emailed'}">Email creators in this city</button>` : ''}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted" style="padding:14px">No founding cities yet. Open one above — Search insights shows where travellers find nobody.</p>';
    $('fdClaims').innerHTML = claims.length ? `<table class="admin-table"><thead><tr><th>Claimed</th><th>Creator</th><th>Email</th><th>Free boost until</th><th></th></tr></thead><tbody>${
      claims.map((c) => `<tr><td>${esc(fmtDate(c.claimed_at))}</td>
        <td>${c.photographer_id ? `<a href="/?creator=${encodeURIComponent(c.photographer_id)}" target="_blank" rel="noopener">${esc(c.name || '—')}</a>` : '<span class="muted">listing deleted</span>'}<br /><span class="muted small">${esc(c.city || c.city_key)}</span></td>
        <td>${c.email ? `<a href="mailto:${encodeURIComponent(c.email)}">${esc(c.email)}</a>` : '—'}</td>
        <td>${c.boost_until ? esc(fmtDate(c.boost_until)) : '—'}</td>
        <td>${c.revoked_at ? `<span class="muted small">Removed ${esc(fmtDate(c.revoked_at))}${c.revoked_reason ? ` — ${esc(c.revoked_reason)}` : ''}</span>` : `<button type="button" class="link-btn danger-link fd-revoke" data-id="${esc(c.id)}" data-name="${esc(c.name || '')}">Remove spot</button>`}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted" style="padding:14px">Nobody has claimed a spot yet.</p>';
    $('fdCities').querySelectorAll('.fd-edit').forEach((b) => b.addEventListener('click', () => {
      const c = cities.find((x) => x.city_key === b.dataset.k); if (!c) return;
      $('fdCity').value = c.city_label; $('fdSlots').value = c.slots; $('fdDays').value = c.perk_days; $('fdActive').checked = c.active;
      $('fdCity').scrollIntoView({ block: 'center' }); $('fdCity').focus();
    }));
    $('fdCities').querySelectorAll('.fd-invite').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Email every creator already listed in this city (who isn’t a founder yet) about the founding spots? Possible once a week.')) return;
      b.disabled = true;
      const { data: r, error: e } = await call('founding_invite', { city_key: b.dataset.k });
      b.disabled = false;
      if (e) { showToast(e.message, 'error', 6000); return; }
      showToast(r.sent ? `Emailed ${r.sent} creator${r.sent > 1 ? 's' : ''} ✓` : 'Nobody to email in this city yet.', r.sent ? 'success' : 'info');
      loadFounding();
    }));
    $('fdClaims').querySelectorAll('.fd-revoke').forEach((b) => b.addEventListener('click', async () => {
      const reason = prompt(`Remove ${b.dataset.name || 'this creator'}'s founding spot? The badge and the free boost end now, and they can't claim again.\n\nReason (for your records):`, '');
      if (reason === null) return;
      b.disabled = true;
      const { error: e } = await call('founding_revoke', { claim_id: b.dataset.id, reason });
      if (e) { b.disabled = false; showToast(e.message, 'error', 6000); return; }
      showToast('Founding spot removed.', 'success');
      loadFounding();
    }));
  }
  $('fdForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const city = $('fdCity').value.trim();
    if (city.length < 2) { showToast('Enter a city.', 'error'); return; }
    $('fdSave').disabled = true;
    const { error } = await call('founding_save', { city, slots: Number($('fdSlots').value), perk_days: Number($('fdDays').value), active: $('fdActive').checked });
    $('fdSave').disabled = false;
    if (error) { showToast(error.message, 'error', 6000); return; }
    showToast(`${city} saved ✓`, 'success');
    $('fdCity').value = '';
    loadFounding();
  });

  /* ── reported profiles / photos ── */
  const LR_REASONS = { fake: 'Fake profile', stolen_photos: "Photos that aren't theirs", inappropriate: 'Inappropriate content', scam: 'Scam / pay outside', other: 'Other' };
  async function loadProfileReports() {
    $('lrList').innerHTML = '<p class="muted" style="padding:14px">Loading…</p>';
    const { data, error } = await call('listing_reports', { status: $('lrStatus').value });
    if (error) { $('lrList').innerHTML = `<p class="muted" style="padding:14px">${esc(error.message)}</p>`; return; }
    const rows = data.reports || [];
    if (!rows.length) { $('lrList').innerHTML = '<p class="muted" style="padding:14px">No reports. 🎉</p>'; return; }
    $('lrList').innerHTML = `<table class="admin-table"><thead><tr><th>Date</th><th>Profile</th><th>Reason</th><th>Photo</th><th></th></tr></thead><tbody>${
      rows.map((r) => `<tr>
        <td>${fmt(r.created_at)}</td>
        <td><a href="/?creator=${encodeURIComponent(r.photographer_id)}" target="_blank" rel="noopener">${esc(r.name)}</a><span class="muted small">${esc(r.city)}${r.hidden ? ' · hidden' : ''}</span></td>
        <td style="max-width:300px"><strong>${esc(LR_REASONS[r.reason] || r.reason)}</strong>${r.details ? `<span class="muted small">${esc(r.details)}</span>` : ''}</td>
        <td>${r.photo_url && safeUrl(r.photo_url) ? `<a href="${esc(safeUrl(r.photo_url))}" target="_blank" rel="noopener"><img src="${esc(safeUrl(r.photo_url))}" alt="Reported photo" class="admin-thumb" /></a>` : '—'}</td>
        <td>${r.photo_url && r.status === 'open' ? `<button class="danger-btn" data-rmphoto="${esc(r.id)}">Remove photo</button> ` : ''}${r.status === 'open' ? `<button class="primary-btn" data-lrresolve="${esc(r.id)}">Mark resolved</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>`;
    $('lrList').querySelectorAll('button[data-rmphoto]').forEach((btn) => btn.addEventListener('click', async () => {
      const r = rows.find((x) => x.id === btn.dataset.rmphoto); if (!r) return;
      if (!confirm(`Remove this photo from ${r.name}'s profile? (Review photos: delete the review under Reviews instead.)`)) return;
      btn.disabled = true;
      const { error: err } = await call('gallery_photo_remove', { photographer_id: r.photographer_id, url: r.photo_url });
      if (err) { btn.disabled = false; showToast(err.message, 'error', 6000); return; }
      await call('listing_report_resolve', { report_id: r.id });
      showToast('Photo removed and report resolved ✓', 'success');
      loadProfileReports();
    }));
    $('lrList').querySelectorAll('button[data-lrresolve]').forEach((btn) => btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error: err } = await call('listing_report_resolve', { report_id: btn.dataset.lrresolve });
      if (err) { btn.disabled = false; showToast(err.message, 'error', 6000); return; }
      showToast('Report resolved ✓', 'success');
      loadProfileReports();
    }));
  }
  $('lrStatus').addEventListener('change', loadProfileReports);

  showPanel('overview');
});
