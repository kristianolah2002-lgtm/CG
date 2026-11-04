/* ================================================================
   CapturaGo — creator dashboard
   Depends on: vendor/supabase.umd.js, supabase.js, site.js
================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const TAX = window.CG_TAX;
  const SERVICE_LABELS = Object.fromEntries(TAX.services.map(x => [x.id, x.label]));
  TAX.renderChecks($('elSvcOnsite'), 'service', 'elServices', 'onsite');
  TAX.renderChecks($('elSvcRemote'), 'service', 'elServices', 'remote');
  TAX.renderChecks($('elVibesBox'), 'vibe', 'elVibes');
  TAX.renderChecks($('elOccasions'), 'occasion', 'elOccasions');
  $('elDrone').innerHTML = TAX.droneFields('el');
  const syncDrone = TAX.wireDrone('el', document.querySelector('input[name="elServices"][value="drone"]'));
  const PRICE_LABELS = { budget: 'Under €80', mid: '€80–€250', premium: '€250+' };
  const VIBE_LABELS = Object.fromEntries(TAX.vibes.map(x => [x.id, x.label]));
  const MAX_SPOTS = 8;

  let user = null;
  let listing = null;

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const spotsOf = (p) => {
    let s = p?.local_spots;
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = []; } }
    return Array.isArray(s) ? s : [];
  };

  /* ── AUTH / START ─────────────────────────────────── */
  async function init() {
    user = await CG.auth.getUser();
    const signedIn = !!user;
    $('authGate').hidden = signedIn;
    $('dashContent').hidden = !signedIn;
    $('dashSidebar').hidden = !signedIn;
    document.body.classList.toggle('no-sidebar', !signedIn);
    if (!signedIn) return;

    $('helloName').textContent = (user.user_metadata?.full_name || user.email.split('@')[0]).split(' ')[0];
    const { data, error } = await CG.photographers.getByUserId(user.id);
    if (error) showToast('Could not load your listing. Please refresh.', 'error');
    listing = data || null;
    if (listing) listing.email = (await CG.photographers.myEmail()) || user.email || '';
    renderOverview();
    fillForm();
    refreshUnread();
    refreshBookingBadge();
    startInbox();
    loadAlerts(); loadWatches(); taxReminder();
    loadEmailPrefs(); loadGiftCards(); loadPhone();
    handleReturnParams();
  }

  $('dashSignInForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Signing in…';
    const { error } = await CG.auth.signIn($('dsEmail').value.trim(), $('dsPassword').value);
    btn.disabled = false; btn.textContent = 'Sign in';
    if (error) {
      $('dsError').textContent = /invalid login/i.test(error.message) ? 'Wrong email or password.'
        : /not confirmed/i.test(error.message) ? 'Please confirm your email first (check spam too).' : error.message;
      return;
    }
    await init();
  });

  $('signOutBtn').addEventListener('click', async () => {
    await CG.auth.signOut();
    window.location.href = '/';
  });

  /* ── PANELS ───────────────────────────────────────── */
  function showPanel(name) {
    document.querySelectorAll('.dash-panel').forEach(p => { p.hidden = p.dataset.panelId !== name; });
    document.querySelectorAll('.dash-nav-item').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
    document.querySelector(`.dash-nav-item[data-panel="${name}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (name === 'inquiries') loadInquiries();
    if (name === 'reviews') loadReviews();
    if (name === 'bookings') loadBookings();
    if (name === 'payments') { loadPayments(); loadTax(); }
    if (name === 'boost') loadBoost();
    if (name === 'availability') loadAvailability();
    if (name === 'requests') loadRequests();
    if (name === 'earnings') loadEarnings();
    if (name === 'messages') { $('chatLayout').classList.remove('show-thread'); refreshInbox(); } else { stopThread(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('.dash-nav-item').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.goto)));

  /* ── OVERVIEW ─────────────────────────────────────── */
  /* ── 🏅 Founding creator spot (city opened by the CapturaGo team; every rule is checked by the database) ── */
  const FOUNDING_NEEDS = { cover: 'A cover photo', photos: 'At least 3 portfolio photos', package: 'A package with a price', description: 'A description of at least 80 characters', hidden: 'Your listing must be visible (contact us)' };
  let foundingTimer = null;
  function loadFounding() { clearTimeout(foundingTimer); foundingTimer = setTimeout(renderFounding, 250); }
  async function renderFounding() {
    const card = $('foundingCard');
    if (!card) return;
    if (!listing) { card.hidden = true; return; }
    const { data: st, error } = await CG.founding.status();
    if (error || !st || !st.listing) { card.hidden = true; return; }
    const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    if (st.claimed) {
      card.hidden = false;
      card.innerHTML = `<h3 style="margin:0 0 4px">🏅 You're a founding creator${st.founding_city ? ` in ${esc(st.founding_city)}` : ''}</h3>
        <p class="muted small" style="margin:0">Your profile shows the 🏅 Founding badge${st.boost_until && Date.parse(st.boost_until) > Date.now() ? `, and your free boost runs until <strong>${esc(fmt(st.boost_until))}</strong>` : ''}. Thank you for being one of the first!</p>`;
      return;
    }
    if (!st.open || st.used || st.spots_left <= 0) { card.hidden = true; return; }
    const missing = (st.missing || []).filter((m) => FOUNDING_NEEDS[m]);
    card.hidden = false;
    card.innerHTML = `<h3 style="margin:0 0 4px">🏅 Founding creator spots in ${esc(st.city)}: ${st.spots_left} of ${st.slots} left</h3>
      <p class="muted small" style="margin:0">Be one of the first creators in ${esc(st.city)}: a 🏅 badge on your profile${st.perk_days ? ` and a <strong>free ${st.perk_days}-day boost</strong> to the top of the results (labelled “Sponsored”)` : ''}. First come, first served — one spot per person.</p>
      ${missing.length ? `<p class="small" style="margin:10px 0 0"><strong>Finish your listing first:</strong></p><ul class="fc-missing small">${missing.map((m) => `<li>${esc(FOUNDING_NEEDS[m])}</li>`).join('')}</ul>
        <button type="button" class="secondary-btn" id="fcEdit" style="margin-top:10px">Edit my listing</button>`
      : '<button type="button" class="primary-btn" id="fcClaim" style="margin-top:12px">Claim my founding spot</button>'}`;
    $('fcEdit')?.addEventListener('click', () => showPanel('listing'));
    $('fcClaim')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Claiming…';
      const { error: err } = await CG.founding.claim();
      if (err) { btn.disabled = false; btn.textContent = 'Claim my founding spot'; showToast(err.message || 'Could not claim the spot.', 'error', 6000); renderFounding(); return; }
      const fresh = await CG.photographers.getByUserId(user.id);
      if (fresh.data) listing = { ...listing, ...fresh.data };
      showToast("🏅 You're a founding creator!", 'success', 5000);
      renderFounding();
    });
  }

  /* ── 🎁 Invite a creator (both get a 7-day boost after the invitee's first completed booking) ── */
  let inviteTimer = null;
  function loadInvite() { clearTimeout(inviteTimer); inviteTimer = setTimeout(renderInvite, 300); }
  async function renderInvite() {
    const card = $('inviteCard');
    if (!card || !listing) { if (card) card.hidden = true; return; }
    const who = await claimPendingInvite();
    if (who) showToast(`${who} invited you — after your first completed booking you both get a free 7-day boost.`, 'success', 7000);
    const { data, error } = await CG.invites.mine();
    if (error || !data || !data.code) { card.hidden = true; return; }
    card.hidden = false;
    const url = inviteLink(data.code);
    $('inviteBox').innerHTML = `<div class="invite-link"><span class="share-url" translate="no" id="inviteUrl">${esc(url)}</span>
        <span class="share-btns"><button type="button" class="secondary-btn" id="inviteCopy">Copy link</button>${navigator.share ? '<button type="button" class="secondary-btn" id="inviteShare">Share</button>' : ''}</span></div>
      <p class="small invite-stats" id="inviteStats">${data.joined ? `${data.joined} creator${data.joined === 1 ? '' : 's'} joined with your link · ${data.rewarded} boost${data.rewarded === 1 ? '' : 's'} earned` : 'Nobody has joined with your link yet.'}${data.rewarded >= data.max ? ` (that's the maximum of ${data.max})` : ''}</p>
      ${data.invited_by ? `<p class="muted small">You joined with ${esc(String(data.invited_by).split(' ')[0])}'s invite${data.my_reward ? ' — your boost was added ✓' : ' — your boost comes after your first completed booking'}.</p>` : ''}`;
    $('inviteCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(url); showToast('Invite link copied.', 'success'); } catch { showToast(url, 'info', 8000); } });
    $('inviteShare')?.addEventListener('click', () => navigator.share({ title: 'Join me on CapturaGo', text: 'I get bookings from travellers on CapturaGo — join with my link and we both get a free boost:', url }).catch(() => {}));
  }

  function renderOverview() {
    loadInvite();
    loadFounding();
    $('noListingMsg').hidden = !!listing;
    $('overviewWithListing').hidden = !listing;
    $('listingTitle').textContent = listing ? 'My listing' : 'Create your listing';
    $('deleteListingBtn').hidden = !listing;
    renderChecklist();
    if (!listing) return;

    $('statViews').textContent = listing.views_count || 0;
    $('statReviews').textContent = listing.reviews_count || 0;
    $('statRating').textContent = listing.reviews_count > 0 ? Number(listing.rating).toFixed(1) : '–';
    $('previewImg').src = safeUrl(listing.cover_image_url) || 'images/default.jpg';
    $('previewName').textContent = listing.name || '';
    $('previewCity').textContent = `📍 ${listing.city || ''} · ${(listing.services || []).map(s => SERVICE_LABELS[s] || s).join(' · ')} · ${PRICE_LABELS[listing.price] || ''}`;
    $('previewDesc').textContent = listing.description || '';
    $('noMapWarning').hidden = !!listing.coords;

    const t = $('availabilityToggle');
    t.checked = listing.available !== false;
    paintAvailability();
    renderLinkCard();
  }

  function paintAvailability() {
    const on = $('availabilityToggle').checked;
    $('availLabel').textContent = on ? 'Available' : 'Not available';
    $('availLabel').style.color = on ? 'var(--ok)' : 'var(--err)';
  }

  $('availabilityToggle').addEventListener('change', async () => {
    if (!listing) return;
    const val = $('availabilityToggle').checked;
    paintAvailability();
    const { data, error } = await CG.photographers.update(listing.id, { available: val });
    if (error) {
      $('availabilityToggle').checked = !val; paintAvailability();
      showToast('Could not update availability.', 'error');
      return;
    }
    listing = { ...data, email: listing.email };
    showToast(val ? "You're shown as available." : "You're shown as not available.", 'info');
  });

  /* ── LISTING FORM ─────────────────────────────────── */
  function addSpotRow(spot = { name: '', desc: '' }) {
    const box = $('elSpots');
    if (box.children.length >= MAX_SPOTS) { showToast(`Up to ${MAX_SPOTS} spots.`, 'info'); return; }
    const div = document.createElement('div');
    div.className = 'spot-entry';
    div.innerHTML = `
      <button type="button" class="spot-remove-btn" aria-label="Remove spot">×</button>
      <input type="text" class="spot-name" maxlength="80" placeholder="Spot name" />
      <textarea class="spot-desc" rows="2" maxlength="200" placeholder="Why is it special? Best time to go?"></textarea>`;
    div.querySelector('.spot-name').value = spot.name || '';
    div.querySelector('.spot-desc').value = spot.desc || spot.description || '';
    div.querySelector('.spot-remove-btn').addEventListener('click', () => div.remove());
    box.appendChild(div);
  }
  $('elAddSpot').addEventListener('click', () => addSpotRow());

  function setChecks(name, values = []) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(i => { i.checked = values.includes(i.value); });
  }
  const getChecks = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);

  function showCoverPreview(src) {
    const box = $('elCoverPreview');
    box.innerHTML = '';
    if (!src) return;
    const img = document.createElement('img');
    img.className = 'cover-preview-img';
    img.src = src;
    img.onerror = () => { img.onerror = null; img.src = 'images/default.jpg'; };
    box.appendChild(img);
  }

  function fillForm() {
    const l = listing || {};
    $('elName').value = l.name || user.user_metadata?.full_name || '';
    $('elCity').value = l.city || '';
    $('elEmail').value = l.email || user.email || '';
    $('elPortfolio').value = l.portfolio_url || '';
    $('elLang').value = l.languages || '';
    $('elPrice').value = l.price || 'mid';
    $('elLevel').value = l.level || 'semipro';
    $('elTravel').checked = !!l.travel_available;
    $('elBio').value = l.description || '';
    $('elCharCount').textContent = $('elBio').value.length;
    setChecks('elServices', l.services || (l.type ? [l.type] : []));
    setChecks('elVibes', l.vibes || []);
    setChecks('elOccasions', l.occasions || []);
    TAX.fillDrone('el', l.drone_region || '', null);
    syncDrone();
    // Drone numbers are private — load them through the secure function
    if (l.drone_region) CG.photographers.myDroneInfo().then(d => {
      if (d && d.region) { TAX.fillDrone('el', d.region, d.info); syncDrone(); }
    });
    $('elSpots').innerHTML = '';
    spotsOf(l).forEach(s => addSpotRow(typeof s === 'string' ? { name: s } : s));
    $('elPackages').innerHTML = '';
    (Array.isArray(l.packages) ? l.packages : []).forEach(k => addPackageRow(k));
    showCoverPreview(safeUrl(l.cover_image_url));
    $('elCover').value = '';
    portfolioSet.load(l);
    sampleSet.load(l);
    $('elSampleTitle').value = l.sample_title || '';
    $('elIntro').value = l.intro_video_url || '';
    $('elHandle').value = l.handle || '';
    updateHandleNote();
  }

  /* ── EARNINGS overview + CSV export (creator side of bookings) ── */
  const ON_HOLD = ['paid', 'confirmed', 'delivered', 'disputed'];
  const csvCell = (v) => {
    let t = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;            // never let a spreadsheet run it as a formula
    return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  async function loadEarnings() {
    const box = $('earningsBox');
    if (!listing) { box.innerHTML = '<div class="empty-state">Create your listing first — your earnings appear here.</div>'; return; }
    box.innerHTML = '<p class="muted">Loading…</p>';
    const { data, error } = await CG.bookings.list();
    if (error) { box.innerHTML = '<div class="empty-state">Could not load your earnings. Please try again.</div>'; return; }
    const mine = (data || []).filter(b => b.creator_user_id === user.id);
    const net = (b) => (b.price_cents || 0) - (b.creator_fee_cents || 0);
    const done = mine.filter(b => b.status === 'completed');
    const hold = mine.filter(b => ON_HOLD.includes(b.status));
    const year = new Date().getFullYear();
    const doneDate = (b) => b.completed_at || b.shoot_date;
    const thisYear = done.filter(b => String(doneDate(b)).slice(0, 4) === String(year));
    const viaLink = mine.filter(b => b.via_link && (b.status === 'completed' || ON_HOLD.includes(b.status)));
    const sum = (list) => list.reduce((n, b) => n + net(b), 0);
    // last 12 months, by the month the payment was released
    const months = [];
    const now = new Date();
    for (let k = 11; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
    const byMonth = Object.fromEntries(months.map(m => [m, 0]));
    done.forEach(b => { const m = String(doneDate(b)).slice(0, 7); if (m in byMonth) byMonth[m] += net(b); });
    const maxMonth = Math.max(1, ...Object.values(byMonth));
    const years = [...new Set(mine.map(b => String(b.shoot_date).slice(0, 4)))].sort().reverse();
    box.innerHTML = `
      <div class="dash-stats-grid earn-stats">
        <div class="dash-stat-card"><div class="dash-stat-value">${euro(sum(thisYear))}</div><div class="dash-stat-label">Paid out in ${year}</div></div>
        <div class="dash-stat-card"><div class="dash-stat-value">${euro(sum(hold))}</div><div class="dash-stat-label">On hold (${hold.length})</div></div>
        <div class="dash-stat-card"><div class="dash-stat-value">${done.length}</div><div class="dash-stat-label">Completed bookings</div></div>
        <div class="dash-stat-card"><div class="dash-stat-value">${viaLink.length}</div><div class="dash-stat-label">Clients via your link</div></div>
      </div>
      <div class="dash-card">
        <h3 style="margin:0 0 12px">Last 12 months</h3>
        <div class="earn-chart" role="img" aria-label="Earnings per month for the last 12 months">
          ${months.map(m => `<div class="earn-col" title="${esc(m)}: ${euro(byMonth[m])}"><div class="earn-bar" style="height:${Math.round((byMonth[m] / maxMonth) * 100)}%"></div><span>${new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</span></div>`).join('')}
        </div>
        <p class="muted small" style="margin:10px 0 0">Shown when the payment is released to you (after the shoot or after the client approves). On hold = paid by the client, not released yet.</p>
      </div>
      <div class="dash-card earn-export">
        <div>
          <h3 style="margin:0 0 4px">Export for your accountant</h3>
          <p class="muted small" style="margin:0">A CSV file that opens in Excel, Numbers or Google Sheets. Stripe's payout reports remain the official record.</p>
        </div>
        <div class="earn-export-actions">
          <label class="sr-only" for="earnYear">Year</label>
          <select id="earnYear">${['all', ...years].map(y => `<option value="${y}">${y === 'all' ? 'All years' : y}</option>`).join('')}</select>
          <button type="button" class="primary-btn" id="earnCsv" ${mine.length ? '' : 'disabled'}>⬇ Download CSV</button>
        </div>
      </div>`;
    $('earnCsv').addEventListener('click', () => {
      const y = $('earnYear').value;
      const rows = mine.filter(b => y === 'all' || String(b.shoot_date).slice(0, 4) === y)
        .sort((a, b) => String(a.shoot_date).localeCompare(String(b.shoot_date)));
      const head = ['Booking ID', 'Booked on', 'Shoot / due date', 'Package', 'Type', 'Client', 'Status', 'Package price (EUR)', 'CapturaGo fee from you (EUR)', 'You receive (EUR)', 'Paid out on', 'Via your link'];
      const lines = [head, ...rows.map(b => [
        b.id, String(b.created_at || '').slice(0, 10), b.shoot_date, b.package_name, isRemote(b) ? 'Remote' : 'In person',
        firstName(b.client_name), statusText(b), ((b.price_cents || 0) / 100).toFixed(2), ((b.creator_fee_cents || 0) / 100).toFixed(2),
        (net(b) / 100).toFixed(2), b.status === 'completed' ? String(b.completed_at || '').slice(0, 10) : '', b.via_link ? 'yes' : 'no',
      ])].map(r => r.map(csvCell).join(',')).join('\r\n');
      downloadBlob(new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8' }), `capturago-earnings-${y}.csv`);
    });
  }

  /* ── 🎁 Gift cards I bought ── */
  async function loadGiftCards() {
    const { data, error } = await CG.gifts.mine();
    const list = (!error && Array.isArray(data) ? data : []).filter((g) => g.status === 'active');
    if (!list.length || !$('giftMini')) return;
    $('giftMini').hidden = false;
    $('giftMini').innerHTML = list.slice(0, 5).map((g) => `<li><a href="/gift.html?g=${esc(g.id)}">${euro(g.amount_cents)}${g.recipient_name ? ` for ${esc(g.recipient_name)}` : ''}</a><span class="muted small">${euro(g.balance_cents)} left</span></li>`).join('');
  }

  /* ── Optional emails (review reminder, "a year ago") ── */
  async function loadEmailPrefs() {
    const { data, error } = await CG.emailPrefs.mine();
    if (error || !data) return;
    $('emailPrefsCard').hidden = false;
    $('tipsToggle').checked = data.tips !== false;
  }
  $('tipsToggle')?.addEventListener('change', async (e) => {
    const on = e.target.checked; e.target.disabled = true;
    const { error } = await CG.emailPrefs.setTips(on);
    e.target.disabled = false;
    if (error) { e.target.checked = !on; showToast('Could not save your choice.', 'error'); return; }
    showToast(on ? 'Tips & reminders on ✓' : "Done — we won't send tips & reminders.", 'success');
  });

  /* ── ⚡ Last-minute deals: a lower price tomorrow or the day after (the database checks every rule) ── */
  const DEAL_PCTS = [10, 15, 20, 25, 30, 40, 50];
  async function loadDeals() {
    const box = $('dealBox');
    if (!box) return;
    const { data, error } = await CG.deals.mine();
    if (!$('dealBox')) return;
    if (error) { box.innerHTML = `<p class="muted small">${/my_last_minute/.test(error.message || '') ? 'Last-minute deals need the latest database update (database.sql).' : 'Could not load your deals. Please refresh.'}</p>`; return; }
    const days = Array.isArray(data) ? data : [];
    const city = (d) => { const t = tripOn(listing && listing.trips, d.day); return String((t && t.city) || (listing && listing.city) || '').split(',')[0]; };
    box.innerHTML = `<ul class="deal-days">${days.map((d) => {
      const label = dealDay(d.day) === 'tomorrow' ? 'Tomorrow' : 'The day after';
      const when = new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
      if (d.pct) return `<li class="deal-day on" data-day="${esc(d.day)}"><div><strong>${label}</strong> <span class="muted small">${esc(when)}</span><br/>
          <span class="deal-live">⚡ −${Number(d.pct)}% live</span> <span class="muted small">${d.notified ? `· travellers in ${esc(city(d))} were told` : `· travellers in ${esc(city(d))} are told in about 10 minutes`}</span></div>
          <button type="button" class="link-btn danger-link deal-off">Take back</button></li>`;
      if (!d.free) return `<li class="deal-day" data-day="${esc(d.day)}"><div><strong>${label}</strong> <span class="muted small">${esc(when)}</span><br/><span class="muted small">Not free — a day off, busy in your calendar or fully booked.</span></div></li>`;
      return `<li class="deal-day" data-day="${esc(d.day)}"><div><strong>${label}</strong> <span class="muted small">${esc(when)}</span></div>
          <div class="deal-set"><label class="sr-only" for="dealPct-${esc(d.day)}">Discount</label><select id="dealPct-${esc(d.day)}" class="deal-pct">${DEAL_PCTS.map((n) => `<option value="${n}" ${n === 20 ? 'selected' : ''}>−${n}%</option>`).join('')}</select>
          <button type="button" class="secondary-btn deal-on">Offer this price</button></div></li>`;
    }).join('')}</ul>${(listing && !listing.payouts_enabled) ? '<p class="muted small">You need payouts set up — deals are for online bookings.</p>' : ''}`;
    box.querySelectorAll('.deal-on').forEach((btn) => btn.addEventListener('click', async () => {
      const li = btn.closest('.deal-day'), pct = Number(li.querySelector('.deal-pct').value);
      btn.disabled = true;
      const { error: e } = await CG.deals.set(li.dataset.day, pct);
      btn.disabled = false;
      if (e) { showToast(e.message || 'Could not set the deal.', 'error', 6000); return; }
      showToast(`Deal live ✓ — −${pct}% for ${dealDay(li.dataset.day)}.`, 'success', 5000);
      loadDeals();
    }));
    box.querySelectorAll('.deal-off').forEach((btn) => btn.addEventListener('click', async () => {
      const li = btn.closest('.deal-day');
      btn.disabled = true;
      const { error: e } = await CG.deals.remove(li.dataset.day);
      if (e) { btn.disabled = false; showToast('Could not take the deal back.', 'error'); return; }
      showToast('Deal taken back.', 'info');
      loadDeals();
    }));
  }

  /* ── 📱 Text reminders on the shoot day: add a number (code by SMS), SMS or WhatsApp, turn off, remove ── */
  async function loadPhone() {
    const card = $('phoneCard'), box = $('phoneBox');
    const { data, error } = await CG.phone.mine();
    if (error) { card.hidden = true; return; }   // not available yet (database update not run)
    card.hidden = false;
    const ph = data || null;
    if (ph && ph.verified) {
      box.innerHTML = `<p class="phone-line"><strong translate="no">${esc(ph.phone)}</strong> <span class="muted small">✓ confirmed</span></p>
        <label class="email-pref-row"><input type="checkbox" id="phoneOn" ${ph.reminders ? 'checked' : ''} /><span><strong>Text me on the day of my shoots</strong><br/><span class="muted small">Meeting point and time, about 7:00 on the day (or the evening before an early start).</span></span></label>
        <div class="phone-channel" role="group" aria-label="Send by"><span class="muted small">Send by</span>
          <button type="button" class="chip-btn ${ph.channel === 'sms' ? 'on' : ''}" data-ch="sms" aria-pressed="${ph.channel === 'sms'}">SMS</button>
          <button type="button" class="chip-btn ${ph.channel === 'whatsapp' ? 'on' : ''}" data-ch="whatsapp" aria-pressed="${ph.channel === 'whatsapp'}">WhatsApp</button></div>
        <button type="button" class="link-btn danger-link" id="phoneRemove">Remove my number</button>`;
      $('phoneOn').addEventListener('change', async (e) => {
        const { error: err } = await CG.phone.prefs(e.target.checked, null);
        if (err) { e.target.checked = !e.target.checked; showToast('Could not save your choice.', 'error'); return; }
        showToast(e.target.checked ? 'Text reminders on ✓' : 'Text reminders off.', 'success');
      });
      box.querySelectorAll('[data-ch]').forEach((b) => b.addEventListener('click', async () => {
        const { error: err } = await CG.phone.prefs(null, b.dataset.ch);
        if (err) { showToast('Could not save your choice.', 'error'); return; }
        loadPhone();
      }));
      $('phoneRemove').addEventListener('click', async () => {
        if (!confirm('Remove your number? You won\'t get text reminders any more.')) return;
        const { error: err } = await CG.phone.remove();
        if (err) { showToast('Could not remove it.', 'error'); return; }
        showToast('Number removed.', 'info');
        loadPhone();
      });
      return;
    }
    box.innerHTML = `<form id="phoneForm" class="phone-form" novalidate>
        <div class="form-row"><label for="phoneNum">Mobile number (with country code)</label>
          <input id="phoneNum" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="+421 900 123 456" value="${ph ? esc(ph.phone) : ''}" translate="no" /></div>
        <div class="phone-channel" role="group" aria-label="Send by"><span class="muted small">Send by</span>
          <button type="button" class="chip-btn on" data-ch="sms" aria-pressed="true">SMS</button>
          <button type="button" class="chip-btn" data-ch="whatsapp" aria-pressed="false">WhatsApp</button></div>
        <label class="email-pref-row"><input type="checkbox" id="phoneConsent" /><span class="small">Text me reminders about my CapturaGo shoots on the shoot day. I can turn this off any time. Standard message rates may apply.</span></label>
        <button type="submit" class="secondary-btn" id="phoneSend">Send me a code</button>
      </form>
      <form id="phoneVerify" class="phone-form" novalidate ${ph && ph.pending ? '' : 'hidden'}>
        <div class="form-row"><label for="phoneCode">6-digit code from the text</label>
          <input id="phoneCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="9" placeholder="123456" /></div>
        <button type="submit" class="primary-btn" id="phoneCheck">Confirm my number</button>
      </form>`;
    let channel = 'sms';
    box.querySelectorAll('[data-ch]').forEach((b) => b.addEventListener('click', () => {
      channel = b.dataset.ch;
      box.querySelectorAll('[data-ch]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    }));
    $('phoneForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const num = $('phoneNum').value.trim();
      if (!/^(\+|00)[1-9][0-9 ()./-]{6,20}$/.test(num)) { showToast('Enter your mobile number with the country code, e.g. +421 900 123 456.', 'error', 6000); return; }
      if (!$('phoneConsent').checked) { showToast('Please agree to receive text reminders.', 'error'); return; }
      const btn = $('phoneSend'); btn.disabled = true;
      const { data: r, error: err } = await CG.phone.start(num, channel);
      btn.disabled = false;
      if (err) { showToast(err.message || 'Could not send the code.', 'error', 6000); return; }
      $('phoneVerify').hidden = false;
      $('phoneCode').focus();
      showToast(`Code sent to ${r && r.phone ? r.phone : 'your phone'} ✓`, 'success', 5000);
    });
    $('phoneVerify').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = $('phoneCode').value.replace(/\D/g, '');
      if (code.length !== 6) { showToast('Enter the 6-digit code from the text.', 'error'); return; }
      const btn = $('phoneCheck'); btn.disabled = true;
      const { error: err } = await CG.phone.verify(code);
      btn.disabled = false;
      if (err) { showToast(err.message || 'Could not check the code.', 'error', 6000); return; }
      showToast('Number confirmed ✓ — we\'ll text you on your shoot days.', 'success', 5000);
      loadPhone();
    });
  }

  /* ── 📅 Your bookings in your calendar (a private .ics link for Google / Apple / Outlook) ── */
  function renderCalFeed(token) {
    const url = CG.calendar.feedUrl(token);
    const webcal = url.replace(/^https:/, 'webcal:');
    $('calFeedBox').innerHTML = `
      <div class="cal-feed-row"><input type="text" id="calFeedUrl" readonly value="${esc(url)}" aria-label="Your private calendar link" />
        <button type="button" class="secondary-btn" id="calFeedCopy">Copy</button></div>
      <div class="cal-feed-actions">
        <a class="secondary-btn" id="calFeedGoogle" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener" style="text-decoration:none">Add to Google Calendar</a>
        <a class="secondary-btn" id="calFeedApple" href="${esc(webcal)}" style="text-decoration:none">Apple / Outlook</a>
      </div>
      <p class="muted small" style="margin:8px 0 0">🔒 Keep this link private — anyone who has it can see your booking dates. Calendars refresh it every few hours.
        <button type="button" class="link-btn" id="calFeedReset">Make a new link</button></p>`;
    $('calFeedCopy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); showToast('Calendar link copied ✓', 'success'); }
      catch { $('calFeedUrl').select(); showToast('Select the link and copy it.', 'info'); }
    });
    $('calFeedReset').addEventListener('click', async () => {
      if (!confirm('Make a new calendar link? The old link stops working — calendars subscribed to it stop updating.')) return;
      const { data, error } = await CG.calendar.feedToken(true);
      if (error || !data) { showToast('Could not make a new link. Please try again.', 'error'); return; }
      renderCalFeed(data); showToast('New link ready ✓ — subscribe to it again in your calendar.', 'success', 5000);
    });
  }
  $('calFeedGet')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    const { data, error } = await CG.calendar.feedToken(false);
    e.target.disabled = false;
    if (error || !data) { showToast(/my_calendar_feed/.test(error?.message || '') ? 'Calendar links need the latest database update (database.sql).' : 'Could not get your calendar link. Please try again.', 'error', 6000); return; }
    renderCalFeed(data);
  });

  /* ── "Cities you follow" (notify me when a creator joins) ── */
  async function loadAlerts() {
    const card = $('alertsCard');
    const { data, error } = await CG.alerts.mine();
    if (error || !data || !data.length) { card.hidden = true; return; }
    card.hidden = false;
    $('alertsList').innerHTML = data.map(a => `
      <li><span>📍 ${esc(a.city_label)}${a.service ? ` · ${esc(SERVICE_LABELS[a.service] || a.service)}` : ''}</span>
        ${a.notified_at ? '<span class="muted small">✓ We emailed you</span>' : '<span class="muted small">Waiting</span>'}
        <button type="button" class="link-btn danger-link al-del" data-id="${esc(a.id)}">Remove</button></li>`).join('');
    $('alertsList').querySelectorAll('.al-del').forEach(btn => btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error: e } = await CG.alerts.remove(btn.dataset.id);
      if (e) { btn.disabled = false; showToast('Could not remove it.', 'error'); return; }
      loadAlerts();
    }));
  }

  /* ── "Creators you're waiting for" (notify me when a fully booked creator has a free day or a deal) ── */
  async function loadWatches() {
    const card = $('watchesCard');
    if (!card) return;
    const { data } = await CG.watches.mine();
    if (!data || !data.length) { card.hidden = true; return; }
    card.hidden = false;
    $('watchesList').innerHTML = data.map(w => `
      <li><span><a href="${w.handle ? `/c/${esc(encodeURIComponent(w.handle))}` : `/?creator=${esc(w.photographer_id)}`}" translate="no">${esc(w.name)}</a>${w.city ? ` · ${esc(String(w.city).split(',')[0])}` : ''}${w.by_text ? ' · 📱' : ''}</span>
        ${w.notified_at ? `<span class="muted small">${w.notified_reason === 'deal' ? '✓ We told you about a deal' : '✓ We told you about a free day'}</span>` : '<span class="muted small">Waiting</span>'}
        <button type="button" class="link-btn danger-link wt-del" data-id="${esc(w.photographer_id)}">Remove</button></li>`).join('');
    $('watchesList').querySelectorAll('.wt-del').forEach(btn => btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error: e } = await CG.watches.remove(btn.dataset.id);
      if (e) { btn.disabled = false; showToast('Could not remove it.', 'error'); return; }
      loadWatches();
    }));
  }

  /* ── Printable QR card (PNG): name, QR code and link ── */
  async function downloadQrCard(url) {
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch {}
    const W = 1200, H = 1600;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#FAF3E7'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#FFFFFF'; g.strokeStyle = 'rgba(36,26,16,0.12)'; g.lineWidth = 4;
    const r = 48, x = 80, y = 80, w = W - 160, h = H - 160;
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill(); g.stroke();
    g.textAlign = 'center';
    g.fillStyle = '#B04722'; g.font = '600 40px Inter, Arial, sans-serif';
    g.fillText('✦ CapturaGo', W / 2, 200);
    g.fillStyle = '#241A10'; g.font = '400 84px Fraunces, Georgia, serif';
    const name = String(listing.name || '').slice(0, 28);
    g.fillText(name, W / 2, 330, W - 240);
    g.fillStyle = '#6B5842'; g.font = '500 40px Inter, Arial, sans-serif';
    g.fillText('Scan to book a photo shoot with me', W / 2, 410, W - 240);
    const qr = drawQr(url, 22, 2);
    if (qr) g.drawImage(qr, (W - 760) / 2, 480, 760, 760);
    g.fillStyle = '#241A10'; g.font = '600 44px Inter, Arial, sans-serif';
    g.fillText(url.replace(/^https?:\/\//, ''), W / 2, 1330, W - 200);
    g.fillStyle = '#7D6A53'; g.font = '500 32px Inter, Arial, sans-serif';
    g.fillText('Secure payment · private photo gallery · verified reviews', W / 2, 1410, W - 200);
    c.toBlob((blob) => { if (blob) downloadBlob(blob, `capturago-${listing.handle}-card.png`); else showToast('Could not create the card.', 'error'); }, 'image/png');
  }

  /* ── PHOTO SETS in the listing form: portfolio gallery + "a full shoot" sample gallery ── */
  const GALLERY_MAX = 30, SAMPLE_MAX = 40;
  function galleryOf(l, key = 'gallery') {
    let g = l?.[key];
    if (typeof g === 'string') { try { g = JSON.parse(g); } catch { g = []; } }
    return Array.isArray(g) ? g.filter(x => x && typeof x.url === 'string' && /^https:\/\//.test(x.url)) : [];
  }
  /** One editable photo set: upload (resized, with a small preview), reorder, remove. Files of removed photos
      are deleted after saving (or at once if they were never saved). */
  function photoSet({ key, max, prefix, box, input, count, label, emptyText }) {
    const st = { items: [], removed: [], busy: false };
    const saved = () => galleryOf(listing, key);
    st.load = (l) => { st.items = galleryOf(l, key).map(g => (g.thumb ? { url: g.url, thumb: g.thumb } : { url: g.url })); st.removed = []; st.render(); };
    st.dirty = () => JSON.stringify(st.items.map(g => g.url)) !== JSON.stringify(saved().map(g => g.url));
    st.render = () => {
      if (!st.busy) $(count).textContent = `(${st.items.length}/${max})`;
      $(box).innerHTML = st.items.length ? st.items.map((g, i) => `
        <div class="ge-item">
          <img src="${esc(g.thumb || g.url)}" alt="${esc(label)} ${i + 1}" loading="lazy" />
          <div class="ge-tools">
            <button type="button" data-ge="left" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move photo ${i + 1} left">‹</button>
            <button type="button" data-ge="del" data-i="${i}" aria-label="Remove photo ${i + 1}">✕</button>
            <button type="button" data-ge="right" data-i="${i}" ${i === st.items.length - 1 ? 'disabled' : ''} aria-label="Move photo ${i + 1} right">›</button>
          </div>
        </div>`).join('') : `<p class="muted small ge-empty">${esc(emptyText)}</p>`;
    };
    $(box).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-ge]');
      if (!b || st.busy) return;
      const i = Number(b.dataset.i);
      if (!st.items[i]) return;
      if (b.dataset.ge === 'del') {
        const [g] = st.items.splice(i, 1);
        const urls = [g.url, g.thumb].filter(Boolean);
        const keep = new Set([...galleryOf(listing, 'gallery'), ...galleryOf(listing, 'sample_gallery')].flatMap(x => [x.url, x.thumb]));
        if (urls.some(u => keep.has(u))) st.removed.push(...urls);   // deleted after saving
        else CG.storage.removePublic(urls, user.id);                   // never saved → delete now
      } else {
        const j = b.dataset.ge === 'left' ? i - 1 : i + 1;
        if (j < 0 || j >= st.items.length) return;
        [st.items[i], st.items[j]] = [st.items[j], st.items[i]];
      }
      st.render();
      $(box).querySelector(`button[data-ge="${b.dataset.ge}"][data-i="${b.dataset.ge === 'left' ? i - 1 : b.dataset.ge === 'right' ? i + 1 : i}"]:not(:disabled)`)?.focus();
    });
    $(input).addEventListener('change', async () => {
      const el = $(input);
      const files = [...el.files];
      el.value = '';
      if (!files.length || anyBusy()) return;
      const room = max - st.items.length;
      if (room <= 0) { showToast(`Up to ${max} photos.`, 'info'); return; }
      if (files.length > room) showToast(`Only ${room} more photo${room > 1 ? 's' : ''} fit (max ${max}).`, 'info', 5000);
      const todo = files.slice(0, room);
      st.busy = true; $('elSave').disabled = true;
      let failed = 0;
      for (let k = 0; k < todo.length; k++) {
        $(count).textContent = `Uploading ${k + 1} of ${todo.length}…`;
        try {
          const full = await resizeImage(todo[k], 2000, 0.85);
          const small = await resizeImage(full.blob, 500, 0.8);
          const a = await CG.storage.uploadPublicJpeg(full.blob, user.id, prefix);
          if (a.error) throw new Error(a.error.message);
          const t = await CG.storage.uploadPublicJpeg(small.blob, user.id, prefix + 't');
          st.items.push(t.error ? { url: a.url } : { url: a.url, thumb: t.url });
          st.render();
        } catch (err) { failed++; console.warn('[photos]', err); }
      }
      st.busy = false; $('elSave').disabled = false;
      st.render();
      if (failed) showToast(`${failed} photo${failed > 1 ? 's' : ''} couldn't be added. Please use JPG, PNG or WebP.`, 'error', 6000);
      else showToast('Photos added — click “Save listing” to publish them.', 'info', 5000);
    });
    return st;
  }
  const portfolioSet = photoSet({ key: 'gallery', max: GALLERY_MAX, prefix: 'g', box: 'elGallery', input: 'elGalleryInput', count: 'elGalleryCount', label: 'Portfolio photo', emptyText: 'No photos yet. Add 6–12 of your best shots — the first one is shown first.' });
  const sampleSet = photoSet({ key: 'sample_gallery', max: SAMPLE_MAX, prefix: 's', box: 'elSample', input: 'elSampleInput', count: 'elSampleCount', label: 'Sample shoot photo', emptyText: 'Optional: all the photos from one real shoot (with the client’s permission), so travellers see what a whole delivery looks like.' });
  const anyBusy = () => portfolioSet.busy || sampleSet.busy;
  const galleryDirty = () => portfolioSet.dirty() || sampleSet.dirty();

  /* ── BOOKING LINK HANDLE ──────────────────────────── */
  const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
  const RESERVED_HANDLES = ['admin', 'api', 'app', 'dashboard', 'help', 'support', 'capturago', 'login', 'signup', 'settings', 'about', 'terms', 'privacy', 'www', 'blog', 'creators', 'search'];
  const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 30).replace(/-+$/, '');
  const linkBase = () => location.origin.replace(/\/$/, '');
  function handleProblem(h) {
    if (!h) return '';
    if (!HANDLE_RE.test(h)) return '3–30 characters: lowercase letters, numbers and dashes (not at the start or end).';
    if (RESERVED_HANDLES.includes(h)) return 'That word is reserved — please choose another.';
    return '';
  }
  function updateHandleNote() {
    const h = $('elHandle').value.trim();
    const problem = handleProblem(h);
    const suggestion = slugify($('elName').value);
    $('elHandle').placeholder = suggestion.length >= 3 ? suggestion : 'your-name';
    const note = $('elHandleNote');
    note.classList.toggle('bad', !!problem);
    note.textContent = problem || (h ? `Your link: ${linkBase().replace(/^https?:\/\//, '')}/c/${h}` : '3–30 characters: lowercase letters, numbers and dashes. Leave empty if you don’t want a link yet.');
  }
  $('elHandle').addEventListener('input', () => {
    const el = $('elHandle');
    const clean = el.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30);
    if (clean !== el.value) el.value = clean;
    updateHandleNote();
  });
  $('elHandle').addEventListener('focus', () => {
    const el = $('elHandle');
    if (!el.value && el.placeholder !== 'your-name') { el.value = el.placeholder; el.select(); updateHandleNote(); }
  });
  $('elName').addEventListener('input', updateHandleNote);

  $('elBio').addEventListener('input', () => { $('elCharCount').textContent = $('elBio').value.length; });

  $('elCover').addEventListener('change', () => {
    const f = $('elCover').files[0];
    if (!f) return;
    if (!CG.storage.ALLOWED_TYPES.includes(f.type)) { showToast('Please choose a JPG, PNG or WebP image.', 'error'); $('elCover').value = ''; return; }
    if (f.size > CG.storage.MAX_UPLOAD_BYTES) { showToast('That image is over 5 MB.', 'error'); $('elCover').value = ''; return; }
    showCoverPreview(URL.createObjectURL(f));
  });

  $('listingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('elName').value.trim();
    const city = $('elCity').value.trim();
    const email = $('elEmail').value.trim();
    const portfolio = $('elPortfolio').value.trim();
    const services = getChecks('elServices');
    const vibes = getChecks('elVibes');
    const occasions = getChecks('elOccasions');
    const spots = [...document.querySelectorAll('#elSpots .spot-entry')]
      .map(el => ({ name: el.querySelector('.spot-name').value.trim(), desc: el.querySelector('.spot-desc').value.trim() }))
      .filter(s => s.name);

    if (!name || !city || !email || !portfolio) return showToast('Please fill in all fields marked *.', 'error');
    if (!services.length) return showToast('Select at least one service.', 'error');
    let drone = { region: null, info: null };
    if (services.includes('drone')) {
      drone = TAX.readDrone('el');
      if (drone.error) return showToast(drone.error, 'error', 6000);
    }
    const packages = [];
    for (const row of document.querySelectorAll('#elPackages .package-entry')) {
      const name = row.querySelector('.pk-name').value.trim();
      const priceRaw = row.querySelector('.pk-price').value.trim().replace(',', '.');
      if (!name && !priceRaw) continue;
      const price = Number(priceRaw);
      if (!name) return showToast('Every package needs a name.', 'error');
      if (!Number.isFinite(price) || price < 10 || price > 5000) return showToast(`"${name}": price must be between €10 and €5000.`, 'error');
      const remote = row.querySelector('.pk-type').value === 'delivery';
      const pkg = {
        id: row.dataset.id || `p${Date.now().toString(36)}${packages.length}`,
        name: name.slice(0, 60),
        price_eur: Math.round(price * 100) / 100,
        desc: row.querySelector('.pk-desc').value.trim().slice(0, 200),
      };
      const photosRaw = row.querySelector('.pk-photos').value.trim();
      if (photosRaw) {
        const n = Number(photosRaw);
        if (!Number.isInteger(n) || n < 1 || n > 2000) return showToast(`"${name}": edited photos must be a whole number from 1 to 2000.`, 'error');
        pkg.photos = n;
      }
      const incl = row.querySelector('.pk-incl').value.split(',').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (incl.length > 6) return showToast(`"${name}": up to 6 things in "Also included".`, 'error');
      if (incl.some(x => x.length > 60)) return showToast(`"${name}": keep each "Also included" item under 60 characters.`, 'error');
      if (incl.length) pkg.includes = incl;
      if (remote) {
        pkg.type = 'delivery';
        pkg.delivery_days = Number(row.querySelector('.pk-days').value) || 3;
        pkg.revisions = Number(row.querySelector('.pk-rev').value) || 0;
      } else {
        pkg.minutes = Number(row.querySelector('.pk-min').value) || null;
        const ed = Number(row.querySelector('.pk-edit').value);
        if (ed > 0) pkg.edit_days = ed;
      }
      packages.push(pkg);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Please enter a valid email.', 'error');
    if (!/^https?:\/\//i.test(portfolio) || !safeUrl(portfolio)) return showToast('Portfolio link must start with https://', 'error');
    const handle = $('elHandle').value.trim().toLowerCase();
    const handleErr = handleProblem(handle);
    if (handleErr) { $('elHandle').focus(); return showToast(handleErr, 'error', 6000); }
    if (anyBusy()) return showToast('Please wait until the photos are uploaded.', 'info');
    const introUrl = $('elIntro').value.trim();
    if (introUrl && !introVideoOk(introUrl)) { $('elIntro').focus(); return showToast('Intro video: paste a link to YouTube, Instagram, TikTok or Vimeo (https://…).', 'error', 6000); }
    const sampleTitle = $('elSampleTitle').value.trim().slice(0, 80);

    const btn = $('elSave');
    btn.disabled = true;
    try {
      let coords = listing?.coords || null;
      if (!listing || city !== listing.city || !coords) {
        btn.textContent = 'Finding your city…';
        const c = await CG.geo.geocode(city);
        coords = c ? { lat: c[0], lon: c[1] } : null;
      }

      let cover = listing?.cover_image_url || null;
      const file = $('elCover').files[0];
      if (file) {
        btn.textContent = 'Uploading photo…';
        const up = await CG.storage.uploadCover(file, user.id);
        if (up.error) showToast('Photo upload failed: ' + up.error.message, 'error', 6000);
        else cover = up.url;
      }

      btn.textContent = 'Saving…';
      const payload = {
        name, city, coords, email,
        type: services[0], services, vibes, occasions,
        drone_certified: !!drone.region,
        drone_region: drone.region,
        drone_info: drone.info,
        specialties: services.map(s => SERVICE_LABELS[s]).join(', '),
        tags: vibes.map(v => VIBE_LABELS[v]),
        description: $('elBio').value.trim() || null,
        local_spots: spots,
        portfolio_url: portfolio,
        cover_image_url: cover,
        price: $('elPrice').value,
        level: $('elLevel').value,
        languages: $('elLang').value.trim() || null,
        travel_available: $('elTravel').checked,
        packages,
        gallery: portfolioSet.items.slice(0, GALLERY_MAX),
        handle: handle || null,
        sample_gallery: sampleSet.items.slice(0, SAMPLE_MAX),
        sample_title: sampleSet.items.length ? (sampleTitle || null) : null,
        intro_video_url: introUrl || null
      };

      const save = (pl) => listing
        ? CG.photographers.update(listing.id, pl)
        : CG.photographers.insert({ ...pl, user_id: user.id });
      let current = payload;
      let res = await save(current);
      const msgOf = (r) => (r.error && r.error.message) || '';
      if (res.error && /handle/i.test(msgOf(res)) && (res.error.code === '23505' || /duplicate|unique/i.test(msgOf(res)))) {
        $('elHandle').focus();
        $('elHandleNote').textContent = 'That link is already taken — please choose another.';
        $('elHandleNote').classList.add('bad');
        showToast('That booking link is already taken — please choose another.', 'error', 6000);
        return;
      }
      let needsDbUpdate = false;
      if (res.error && ['42703', 'PGRST204'].includes(res.error.code) && /sample_|intro_video/i.test(msgOf(res))) {
        // Database not updated yet (v8.10) — save without the sample shoot and intro video
        const { sample_gallery: _s, sample_title: _t, intro_video_url: _v, ...rest } = current;
        current = rest; res = await save(current); needsDbUpdate = true;
      }
      if (res.error && ['42703', 'PGRST204'].includes(res.error.code) && /gallery|handle/i.test(msgOf(res))) {
        // Database not updated yet (v8.6) — save without the gallery and booking link
        const { gallery: _g, handle: _h, ...rest } = current;
        current = rest; res = await save(current); needsDbUpdate = true;
      }
      if (res.error && /packages|occasions|drone_/i.test(msgOf(res))) {
        // Database not updated yet — save everything except the new fields
        const { packages: _p, occasions: _o, drone_certified: _d, drone_region: _r, drone_info: _i, ...rest } = current;
        res = await save(rest); needsDbUpdate = true;
      }
      if (!res.error && needsDbUpdate) showToast('Saved — but some new fields need the latest database update (database.sql).', 'info', 8000);

      if (res.error) {
        const m = msgOf(res);
        showToast(/gallery/i.test(m) ? 'Could not save the gallery. Please remove the last photo and try again.' : 'Could not save: ' + m, 'error', 6000);
        return;
      }
      if (portfolioSet.removed.length && 'gallery' in current) { CG.storage.removePublic(portfolioSet.removed, user.id); portfolioSet.removed = []; }
      if (sampleSet.removed.length && 'sample_gallery' in current) { CG.storage.removePublic(sampleSet.removed, user.id); sampleSet.removed = []; }
      listing = { ...res.data, email };   // email is private, so it isn't returned by the API
      renderOverview();
      fillForm();
      if (!coords) showToast("Saved — but we couldn't find that city on the map. Try 'City, Country'.", 'info', 7000);
      else if (!needsDbUpdate) showToast('Listing saved ✓', 'success');
    } finally {
      btn.disabled = false; btn.textContent = 'Save listing';
    }
  });

  $('deleteListingBtn').addEventListener('click', async () => {
    if (!listing) return;
    if (!confirm('Delete your listing? Your profile, inquiries and reviews will be permanently removed.')) return;
    const { error } = await CG.photographers.remove(listing.id);
    if (error) { showToast(error.message && /active bookings/i.test(error.message) ? error.message : 'Could not delete listing.', 'error', 6000); return; }
    listing = null;
    renderOverview();
    fillForm();
    showPanel('overview');
    showToast('Listing deleted.', 'info');
  });

  /* ── INQUIRIES ────────────────────────────────────── */
  async function refreshUnread() {
    if (!listing) return;
    const { data } = await CG.inquiries.get(listing.id);
    const all = data || [];
    $('statInquiries').textContent = all.length;
    $('inquiriesNav').hidden = all.length === 0;
    const unread = all.filter(i => !i.read).length;
    $('unreadBadge').hidden = unread === 0;
    $('unreadBadge').textContent = unread;
  }

  async function loadInquiries() {
    const box = $('inquiriesList');
    if (!listing) { box.innerHTML = '<div class="empty-state">Create your listing first to receive inquiries.</div>'; return; }
    box.innerHTML = '<p class="muted">Loading…</p>';
    const { data, error } = await CG.inquiries.get(listing.id);
    if (error) { box.innerHTML = '<div class="empty-state">Could not load inquiries. Please refresh.</div>'; return; }
    const list = data || [];
    if (!list.length) { box.innerHTML = '<div class="empty-state">No inquiries yet. Share your CapturaGo listing on your Instagram to get your first one.</div>'; return; }

    box.innerHTML = list.map(q => {
      const subject = encodeURIComponent('Re: your CapturaGo inquiry');
      const mail = `mailto:${encodeURIComponent(q.sender_email)}?subject=${subject}`;
      return `
        <div class="inquiry-item ${q.read ? '' : 'unread'}">
          <div class="inquiry-header">
            <span class="inquiry-sender"><span translate="no">${esc(q.sender_name)}</span> ${q.read ? '' : '<span class="unread-dot"></span>'}</span>
            <span class="inquiry-date">${fmtDate(q.created_at)}</span>
          </div>
          <div class="inquiry-meta">
            <span>📧 ${esc(q.sender_email)}</span>
            ${q.shoot_type ? `<span>📷 ${esc(SERVICE_LABELS[q.shoot_type] || q.shoot_type)}</span>` : ''}
            ${q.shoot_date ? `<span>📅 ${fmtDate(q.shoot_date)}</span>` : ''}
          </div>
          <div class="inquiry-message" translate="no" style="white-space:pre-line">${esc(q.message)}</div>
          <a href="${mail}" class="inquiry-reply-btn">Reply by email →</a>
        </div>`;
    }).join('');

    const unreadIds = list.filter(q => !q.read).map(q => q.id);
    await Promise.all(unreadIds.map(id => CG.inquiries.markRead(id)));
    $('unreadBadge').hidden = true;
  }


  /* ── MESSAGES (same rules as the app) ─────────────── */
  const OFF_PLATFORM = /\b(pay\s*pal|revolut|western\s*union|money\s*gram|wise\.com|iban|bank\s*transfer|wire\s*transfer|crypto|bitcoin|usdt|pay\s+(me\s+)?(directly|in\s+cash|outside)|cash\s+only|whats\s*app|telegram)\b/i;
  const MSG_MAX = 2000;
  let convs = [], activeId = null, thread = [], threadTimer = null, unsubThread = () => {}, tipHidden = false, sending = false;
  const pad2 = (n) => String(n).padStart(2, '0');
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const myReadAt = (c) => (user.id === c.client_user_id ? c.client_read_at : c.creator_read_at);
  const isUnreadConv = (c) => !!c.last_sender_id && c.last_sender_id !== user.id && Date.parse(c.last_message_at) > Date.parse(myReadAt(c));
  const otherOf = (c) => (user.id === c.creator_user_id
    ? { name: c.client_name || 'Traveller', role: 'Traveller', city: '' }
    : { name: c.photographers?.name || 'Creator', role: 'Creator', city: c.photographers?.city || '' });
  function chatTime(iso) {
    const d = new Date(iso), n = new Date();
    if (isNaN(d)) return '';
    if (sameDay(d, n)) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const y = new Date(n); y.setDate(n.getDate() - 1);
    if (sameDay(d, y)) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) });
  }
  function dayLabel(iso) {
    const d = new Date(iso), n = new Date(); const y = new Date(n); y.setDate(n.getDate() - 1);
    return sameDay(d, n) ? 'Today' : sameDay(d, y) ? 'Yesterday' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function startInbox() {
    refreshInbox();
    CG.chat.subscribe(`inbox-${user.id}`, 'conversations', null, () => refreshInbox());
    setInterval(() => { if (document.visibilityState === 'visible') refreshInbox(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshInbox(); });
  }
  async function refreshInbox() {
    const { data, error } = await CG.chat.list();
    if (error) { if (!convs.length) $('chatList').innerHTML = '<div class="empty-state">Messages aren\'t available right now. Please refresh.</div>'; return; }
    convs = data || [];
    const unread = convs.filter(isUnreadConv).length;
    $('msgBadge').hidden = unread === 0; $('msgBadge').textContent = unread;
    renderInbox();
    const c = convs.find((x) => x.id === activeId);
    if (c) renderThreadHeader(c);
  }
  /* A traveller is waiting for my answer (I'm the creator in this chat) */
  function waitingLabel(c) {
    if (!c || c.blocked_by || c.creator_user_id !== user.id || !c.last_sender_id || c.last_sender_id !== c.client_user_id) return '';
    const mins = (Date.now() - Date.parse(c.last_message_at)) / 60000;
    if (!(mins >= 10)) return '';
    const h = Math.floor(mins / 60);
    return `Waiting for your reply · ${h < 1 ? `${Math.round(mins)} min` : h < 48 ? `${h} h` : `${Math.floor(h / 24)} days`}`;
  }

  /* ── Quick replies (saved messages; {name} = the other person's first name) ── */
  let templates = null;
  const DEFAULT_TEMPLATES = {
    creator: [
      ['Thanks!', "Hi {name}, thanks for your message! I'd love to photograph you. Which date and time of day are you thinking of?"],
      ['Free that day', "Hi {name}, yes, I'm free that day! You can book my package directly on my CapturaGo profile — your payment is protected until the shoot."],
      ['Meeting point', "Hi {name}, let's meet at … at … . I'll wear … so you can find me easily."],
    ],
    client: [
      ['Are you free?', 'Hi {name}! Are you free on … ? We would love a … shoot.'],
      ['Thank you', 'Thank you so much, {name}! See you soon.'],
    ],
  };
  async function loadTemplates(force) {
    if (templates && !force) return templates;
    const { data } = await CG.templates.list();
    templates = data || [];
    return templates;
  }
  async function toggleQuickReplies() {
    const box = $('chatQuick'); if (!box) return;
    if (!box.hidden) { box.hidden = true; $('chatQuickBtn').setAttribute('aria-expanded', 'false'); return; }
    const c = convs.find((x) => x.id === activeId); if (!c) return;
    const mine = await loadTemplates();
    const role = c.creator_user_id === user.id ? 'creator' : 'client';
    const items = mine.length ? mine.map((t) => [t.title, t.body]) : DEFAULT_TEMPLATES[role];
    box.innerHTML = `<div class="chat-quick-list">${items.map(([t], i) => `<button type="button" class="chip-btn qr-use" data-i="${i}">${esc(t)}</button>`).join('')}</div>
      <button type="button" class="link-btn" id="qrManage">${mine.length ? 'Edit quick replies' : '+ Save your own quick replies'}</button>`;
    box.hidden = false; $('chatQuickBtn').setAttribute('aria-expanded', 'true');
    box.querySelectorAll('.qr-use').forEach((b) => b.addEventListener('click', () => {
      const [, body] = items[Number(b.dataset.i)] || [];
      const input = $('chatInput'); if (!input || !body) return;
      input.value = fillTemplate(body, otherOf(c).name).slice(0, MSG_MAX);
      box.hidden = true; $('chatQuickBtn').setAttribute('aria-expanded', 'false');
      input.focus(); input.setSelectionRange(input.value.length, input.value.length);
    }));
    $('qrManage').addEventListener('click', () => { box.hidden = true; openTemplates(); });
  }
  async function openTemplates() {
    const list = await loadTemplates(true);
    openDashModal(`
      <h2 id="dashModalTitle" class="pm-title">⚡ Quick replies</h2>
      <p class="muted small pm-sub">Save the answers you send often. <strong>{name}</strong> becomes the other person's first name. Only you can see them. Up to 20.</p>
      <div class="qr-list" id="qrList">${list.length ? list.map((t) => `<div class="qr-item" data-id="${esc(t.id)}"><div translate="no"><strong>${esc(t.title)}</strong><p class="muted small">${esc(t.body)}</p></div>
        <div class="qr-item-actions"><button type="button" class="link-btn qr-edit">Edit</button><button type="button" class="link-btn danger-link qr-del">Delete</button></div></div>`).join('') : '<p class="muted small">No quick replies yet.</p>'}</div>
      <form id="qrForm" class="qr-form">
        <input type="hidden" id="qrId" />
        <label for="qrTitle" class="small"><strong>Name</strong></label>
        <input id="qrTitle" class="dm-input" type="text" maxlength="40" placeholder="e.g. Thanks!" />
        <label for="qrBody" class="small" style="margin-top:8px;display:block"><strong>Message</strong></label>
        <textarea id="qrBody" class="dm-input" rows="3" maxlength="1000" placeholder="Hi {name}, thanks for your message! …"></textarea>
        <div class="pm-actions" style="margin-top:10px"><button type="submit" class="primary-btn" id="qrSave">Save quick reply</button></div>
      </form>`);
    $('qrList').querySelectorAll('.qr-edit').forEach((b) => b.addEventListener('click', () => {
      const t = list.find((x) => x.id === b.closest('.qr-item').dataset.id); if (!t) return;
      $('qrId').value = t.id; $('qrTitle').value = t.title; $('qrBody').value = t.body; $('qrSave').textContent = 'Save changes'; $('qrTitle').focus();
    }));
    $('qrList').querySelectorAll('.qr-del').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const { error } = await CG.templates.remove(b.closest('.qr-item').dataset.id);
      if (error) { b.disabled = false; showToast('Could not delete it.', 'error'); return; }
      openTemplates();
    }));
    $('qrForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = $('qrTitle').value.trim(), body = $('qrBody').value.trim();
      if (!title || !body) { showToast('Add a name and a message.', 'error'); return; }
      $('qrSave').disabled = true;
      const id = $('qrId').value;
      const { error } = id ? await CG.templates.update(id, title, body) : await CG.templates.add(title, body);
      $('qrSave').disabled = false;
      if (error) { showToast(error.message || 'Could not save it.', 'error', 6000); return; }
      showToast('Saved ✓', 'success');
      openTemplates();
    });
  }

  function renderInbox() {
    const box = $('chatList');
    if (!convs.length) {
      box.innerHTML = `<div class="empty-state">No messages yet. ${listing ? 'When travellers message you, conversations appear here.' : '<a href="/">Find a creator</a> and tap “Message” on their profile.'}</div>`;
      return;
    }
    box.innerHTML = convs.map((c) => {
      const o = otherOf(c), unread = isUnreadConv(c);
      const preview = c.last_message ? `${c.last_sender_id === user.id ? 'You: ' : ''}${c.last_message}` : 'No messages yet — say hello 👋';
      return `<button class="chat-row${c.id === activeId ? ' active' : ''}${unread ? ' unread' : ''}" data-conv="${esc(c.id)}">
        <span class="chat-avatar">${esc(o.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?')}</span>
        <span class="chat-row-main">
          <span class="chat-row-top"><strong translate="no">${esc(o.name)}</strong><span class="chat-time">${esc(chatTime(c.last_message_at))}</span></span>
          <span class="chat-role">${esc(o.role)}${o.city ? ' · ' + esc(o.city) : ''}${c.blocked_by ? ' · blocked' : ''}</span>
          <span class="chat-preview" translate="no">${esc(preview)}</span>
          ${waitingLabel(c) ? `<span class="chat-waiting">⏳ ${esc(waitingLabel(c))}</span>` : ''}
        </span>${unread ? '<span class="chat-dot" aria-label="Unread"></span>' : ''}
      </button>`;
    }).join('');
    box.querySelectorAll('[data-conv]').forEach((b) => b.addEventListener('click', () => openConversation(b.dataset.conv)));
  }

  function stopThread() {
    if (threadTimer) { clearInterval(threadTimer); threadTimer = null; }
    unsubThread(); unsubThread = () => {};
  }
  async function openConversation(id) {
    stopThread();
    activeId = id; thread = []; tipHidden = false;
    $('chatLayout').classList.add('show-thread');
    $('chatThread').innerHTML = '<div class="chat-empty">Loading…</div>';
    let c = convs.find((x) => x.id === id);
    if (!c) { const r = await CG.chat.get(id); c = r.data; if (c) convs = [c, ...convs.filter((x) => x.id !== id)]; }
    if (!c) { $('chatThread').innerHTML = '<div class="chat-empty">This conversation doesn\'t exist anymore.</div>'; return; }
    $('chatThread').innerHTML = `
      <div class="chat-head" id="chatHead"></div>
      <div class="chat-msgs" id="chatMsgs" aria-live="polite"></div>
      <div class="chat-tip" id="chatTip" hidden>🛡️ Payments by PayPal, bank transfer, cash or chat apps aren't protected. Book through CapturaGo so your money is held safely until the shoot. <button class="link-btn" id="chatTipHide" aria-label="Hide tip">✕</button></div>
      <div class="chat-quick" id="chatQuick" hidden></div>
      <form class="chat-compose" id="chatCompose">
        <button type="button" class="chat-quick-btn" id="chatQuickBtn" aria-expanded="false" aria-controls="chatQuick" title="Quick replies" aria-label="Quick replies">⚡</button>
        <textarea id="chatInput" rows="1" maxlength="${MSG_MAX}" placeholder="Write a message…" aria-label="Message"></textarea>
        <button type="submit" class="primary-btn" id="chatSend">Send</button>
      </form>
      <div class="chat-closed" id="chatClosed" hidden></div>`;
    renderThreadHeader(c);
    $('chatTipHide').addEventListener('click', () => { tipHidden = true; $('chatTip').hidden = true; });
    $('chatMsgs').addEventListener('click', (e) => { const b = e.target.closest('.chat-tr'); if (b) translateMsg(b.dataset.id); });
    $('chatCompose').addEventListener('submit', (e) => { e.preventDefault(); sendMessage(); });
    $('chatQuickBtn').addEventListener('click', toggleQuickReplies);
    $('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    renderInbox();
    await loadThread(true);
    markRead();
    unsubThread = CG.chat.subscribe(`chat-${id}`, 'messages', `conversation_id=eq.${id}`, () => loadThread());
    threadTimer = setInterval(() => { if (document.visibilityState === 'visible') loadThread(); }, 8000);
  }
  function renderThreadHeader(c) {
    const head = $('chatHead'); if (!head) return;
    const o = otherOf(c), iBlocked = c.blocked_by === user.id;
    head.innerHTML = `
      <button class="link-btn chat-back" id="chatBack" aria-label="Back to conversations">‹ Back</button>
      <div class="chat-head-main"><strong translate="no">${esc(o.name)}</strong><span class="muted small">${esc(o.role)}${o.city ? ' · ' + esc(o.city) : ''}</span></div>
      <div class="chat-actions">
        ${o.role === 'Creator' ? `<a class="link-btn" href="/?creator=${encodeURIComponent(c.photographer_id)}">Profile</a>` : ''}
        ${!c.blocked_by || iBlocked ? `<button class="link-btn" id="chatBlock">${iBlocked ? 'Unblock' : 'Block'}</button>` : ''}
        <button class="link-btn danger-link" id="chatReport">Report</button>
      </div>`;
    $('chatBack').addEventListener('click', () => $('chatLayout').classList.remove('show-thread'));
    $('chatBlock')?.addEventListener('click', () => toggleBlock(c));
    $('chatReport').addEventListener('click', () => reportConv(c));
    const closed = !!c.blocked_by;
    $('chatCompose').hidden = closed;
    $('chatClosed').hidden = !closed;
    $('chatClosed').innerHTML = closed ? (iBlocked ? `You blocked ${esc(o.name)}. <button class="link-btn" id="chatUnblock2">Unblock</button>` : 'This conversation is closed.') : '';
    $('chatUnblock2')?.addEventListener('click', () => toggleBlock(c));
  }
  async function loadThread(full) {
    const id = activeId; if (!id) return;
    const sent = thread.filter((m) => !m.pending);
    const after = full || !sent.length ? undefined : sent[sent.length - 1].created_at;
    const { data, error } = await CG.chat.messages(id, after);
    if (id !== activeId) return;
    if (error) { if (full) $('chatMsgs').innerHTML = '<div class="chat-empty">Could not load messages. Please refresh.</div>'; return; }
    const fresh = (data || []).filter((m) => !thread.some((t) => t.id === m.id));
    if (!fresh.length && !full) return;
    thread = [...thread.filter((m) => !m.pending), ...fresh].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    renderThread();
    if (fresh.some((m) => m.sender_id !== user.id) && !full) markRead();
  }
  function renderThread() {
    const box = $('chatMsgs'); if (!box) return;
    const c = convs.find((x) => x.id === activeId); const o = c ? otherOf(c) : { name: 'them' };
    let html = `<div class="chat-intro">🔒 Only you and ${esc(o.name)} can read this conversation. Never pay outside CapturaGo — bookings paid here are protected.</div>`;
    let lastDay = '';
    for (const m of thread) {
      const day = new Date(m.created_at).toDateString();
      if (day !== lastDay) { html += `<div class="chat-day">${esc(dayLabel(m.created_at))}</div>`; lastDay = day; }
      const mine = m.sender_id === user.id, d = new Date(m.created_at);
      const tr = !mine ? translations.get(m.id) : null;
      const shown = tr && tr.show && tr.text;
      const trBtn = !mine && !m.pending ? ` · <button type="button" class="link-btn chat-tr" data-id="${esc(m.id)}">${tr && tr.loading ? 'Translating…' : shown ? 'Show original' : 'Translate'}</button>` : '';
      html += `<div class="chat-bubble-wrap ${mine ? 'mine' : 'theirs'}"><div class="chat-bubble${shown ? ' translated' : ''}" translate="no">${esc(shown ? tr.text : m.body)}</div><div class="chat-meta">${m.pending ? 'Sending…' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`}${shown ? ' · <span class="chat-tr-label">Translated</span>' : ''}${trBtn}</div></div>`;
    }
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    box.innerHTML = html;
    if (nearBottom || thread.length < 3 || thread.at(-1)?.sender_id === user.id) box.scrollTop = box.scrollHeight;
    $('chatTip').hidden = tipHidden || !thread.slice(-40).some((m) => OFF_PLATFORM.test(m.body));
  }
  /* Translate an incoming message into the reader's language (cached on the server) */
  const translations = new Map();
  async function translateMsg(id) {
    const cur = translations.get(id);
    if (cur && cur.loading) return;
    if (cur && cur.text) { cur.show = !cur.show; renderThread(); return; }
    translations.set(id, { loading: true }); renderThread();
    const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
    const { data, error } = await CG.chat.translate(id, lang);
    if (error || !data || !data.text) {
      translations.delete(id); renderThread();
      showToast((error && error.message) || 'Translation is not available right now.', 'error', 5000);
      return;
    }
    translations.set(id, { text: data.text, show: true }); renderThread();
  }

  async function markRead() {
    const id = activeId; if (!id) return;
    await CG.chat.markRead(id);
    const c = convs.find((x) => x.id === id);
    if (c) { if (user.id === c.client_user_id) c.client_read_at = new Date().toISOString(); else c.creator_read_at = new Date().toISOString(); }
    const unread = convs.filter(isUnreadConv).length;
    $('msgBadge').hidden = unread === 0; $('msgBadge').textContent = unread;
    renderInbox();
  }
  async function sendMessage() {
    if (sending) return;
    const text = $('chatInput').value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return;
    if (text.length > MSG_MAX) { showToast(`Messages can be up to ${MSG_MAX} characters.`, 'error'); return; }
    sending = true; $('chatSend').disabled = true;
    const temp = { id: `local-${Date.now()}`, sender_id: user.id, body: text, created_at: new Date().toISOString(), pending: true };
    thread.push(temp); renderThread(); $('chatInput').value = '';
    const { data, error } = await CG.chat.send(activeId, text);
    sending = false; $('chatSend').disabled = false;
    thread = thread.filter((m) => m.id !== temp.id);
    if (error || !data) {
      renderThread(); $('chatInput').value = text;
      const msg = error?.message || '';
      showToast(/fast|wait a minute/i.test(msg) ? msg : /row-level|permission|policy/i.test(msg) ? 'This conversation is closed.' : "Couldn't send your message. Please try again.", 'error', 6000);
      if (/row-level|permission|policy/i.test(msg)) refreshInbox();
      return;
    }
    if (!thread.some((m) => m.id === data.id)) thread.push(data);
    renderThread(); refreshInbox();
  }
  async function toggleBlock(c) {
    const iBlocked = c.blocked_by === user.id, o = otherOf(c);
    if (!iBlocked && !confirm(`Block ${o.name}? Neither of you will be able to send messages in this conversation. You can unblock later.`)) return;
    const { error } = await CG.chat.block(c.id, !iBlocked);
    if (error) { showToast('Something went wrong. Please try again.', 'error'); return; }
    showToast(iBlocked ? 'Unblocked.' : 'Blocked. They can no longer message you here.', 'success');
    await refreshInbox();
  }
  async function reportConv(c) {
    const reason = (prompt('Report this conversation. Tell us what happened — our team will read this conversation to investigate (they can\'t see it otherwise).') || '').trim();
    if (!reason) return;
    if (reason.length < 3) { showToast('Please describe the problem in a few words.', 'error'); return; }
    const { error } = await CG.chat.report(c.id, reason.slice(0, 500));
    if (error) { showToast(error.message || 'Could not send the report.', 'error'); return; }
    showToast("Thanks — we'll review it within 48 hours.", 'success', 5000);
    if (!c.blocked_by && confirm(`Also block ${otherOf(c).name}?`)) { await CG.chat.block(c.id, true); refreshInbox(); }
  }

  /* ── REVIEWS ──────────────────────────────────────── */
  async function loadReviews() {
    const box = $('reviewsList');
    if (!listing) { box.innerHTML = '<div class="empty-state">Create your listing first to receive reviews.</div>'; return; }
    const { data } = await CG.reviews.get(listing.id);
    const list = data || [];
    if (!list.length) { box.innerHTML = '<div class="empty-state">No reviews yet. After a shoot, ask your client to leave one on your CapturaGo profile.</div>'; return; }
    const canReply = list.some((r) => 'reply' in r);   // the database has PART 23
    const open = list.filter((r) => canReply && !r.reply).length;
    box.innerHTML = (canReply ? `<p class="muted small reviews-hint" id="reviewsHint">${open
        ? `↩ ${open} review${open === 1 ? '' : 's'} without a reply. A short, friendly reply shows future travellers that you care — it appears under the review on your profile.`
        : '✓ You replied to every review.'}</p>` : '') + list.map(r => `
      <div class="review-item" data-review="${esc(r.id)}">
        <div class="review-header">
          <strong translate="no">${esc(r.reviewer_name)}</strong>
          <span style="color:var(--amber)">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          <span class="muted small">${fmtDate(r.created_at)}</span>
        </div>
        ${r.comment ? `<p translate="no">${esc(r.comment)}</p>` : ''}
        <div class="rv-reply-slot">${canReply ? replyView(r) : ''}</div>
        <button type="button" class="link-btn rv-card" data-id="${esc(r.id)}">📣 Share as an image</button>
      </div>`).join('');
    box.querySelectorAll('.rv-card').forEach((b) => b.addEventListener('click', () => {
      const r = list.find((x) => String(x.id) === b.dataset.id); if (r) shareReviewCard(r);
    }));
    if (!canReply) return;
    const rerender = (r) => {
      const slot = box.querySelector(`[data-review="${CSS.escape(String(r.id))}"] .rv-reply-slot`);
      if (slot) { slot.innerHTML = replyView(r); wire(r, slot); }
      const left = list.filter((x) => !x.reply).length, hint = $('reviewsHint');
      if (hint) hint.textContent = left ? `↩ ${left} review${left === 1 ? '' : 's'} without a reply. A short, friendly reply shows future travellers that you care — it appears under the review on your profile.` : '✓ You replied to every review.';
    };
    const wire = (r, slot) => {
      slot.querySelector('.rv-reply-btn')?.addEventListener('click', () => {
        slot.innerHTML = `<form class="reply-form">
            <label class="sr-only" for="rt-${esc(r.id)}">Your reply</label>
            <textarea id="rt-${esc(r.id)}" maxlength="1000" placeholder="Thank ${esc(String(r.reviewer_name || '').split(' ')[0] || 'them')} — and if something went wrong, explain briefly and politely.">${esc(r.reply || '')}</textarea>
            <div class="reply-actions">
              <button type="submit" class="primary-btn small">Publish reply</button>
              <button type="button" class="link-btn rv-cancel">Cancel</button>
              <span class="muted small reply-count"></span>
            </div>
            <p class="muted small">Public, under the review on your profile. ${esc(String(r.reviewer_name || '').split(' ')[0] || 'The traveller')} gets an email once.</p>
          </form>`;
        const ta = slot.querySelector('textarea'), count = slot.querySelector('.reply-count');
        const upd = () => { count.textContent = `${ta.value.length}/1000`; };
        ta.addEventListener('input', upd); upd(); ta.focus();
        slot.querySelector('.rv-cancel').addEventListener('click', () => rerender(r));
        slot.querySelector('form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const text = ta.value.trim();
          if (text.length < 2) { showToast('Write a reply first (at least 2 characters).', 'error'); ta.focus(); return; }
          const btn = e.submitter || slot.querySelector('[type=submit]'); btn.disabled = true;
          const { data: res, error } = await CG.reviews.reply(r.id, text);
          btn.disabled = false;
          if (error) { showToast(error.message || 'Could not save your reply.', 'error'); return; }
          r.reply = res && res.reply; r.reply_at = res && res.reply_at;
          showToast('Reply published ✓', 'success');
          rerender(r);
        });
      });
      slot.querySelector('.rv-reply-del')?.addEventListener('click', async () => {
        if (!confirm('Remove your reply? It disappears from your profile.')) return;
        const { error } = await CG.reviews.reply(r.id, '');
        if (error) { showToast(error.message || 'Could not remove it.', 'error'); return; }
        r.reply = null; r.reply_at = null;
        showToast('Reply removed.', 'info');
        rerender(r);
      });
    };
    list.forEach((r) => { const slot = box.querySelector(`[data-review="${CSS.escape(String(r.id))}"] .rv-reply-slot`); if (slot) wire(r, slot); });
  }
  /** Under a review in the dashboard: my reply with Edit / Remove, or a Reply button. */
  function replyView(r) {
    return r.reply
      ? `<div class="review-reply"><div class="review-reply-head"><strong>↩ Your reply</strong>${r.reply_at ? `<span class="muted small">${fmtDate(r.reply_at)}</span>` : ''}</div><p translate="no">${esc(r.reply)}</p>
          <div class="reply-actions"><button type="button" class="link-btn rv-reply-btn">Edit</button> · <button type="button" class="link-btn rv-reply-del">Remove</button></div></div>`
      : '<button type="button" class="secondary-btn small rv-reply-btn">↩ Reply</button>';
  }

  /* ── A review as a 1080×1350 image for Instagram / stories (drawn in the browser; text only, no HTML) ── */
  function wrapLines(g, text, maxW, maxLines) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (g.measureText(t).width <= maxW) { cur = t; continue; }
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
      let last = lines[maxLines - 1];
      while (last && g.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/[\s,.;:]+$/, '') + '…';
    }
    return lines;
  }
  async function shareReviewCard(r) {
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch {}
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#FAF3E7'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#FFFFFF'; g.strokeStyle = 'rgba(36,26,16,0.12)'; g.lineWidth = 4;
    const x = 70, y = 70, w = W - 140, h = H - 140, rad = 44;
    g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad); g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); g.fill(); g.stroke();
    g.textAlign = 'center';
    g.fillStyle = '#B04722'; g.font = '600 34px Inter, Arial, sans-serif';
    g.fillText('CAPTURAGO', W / 2, 190);
    g.font = '64px Arial, sans-serif'; g.fillText('★'.repeat(Math.max(0, Math.min(5, r.rating || 0))) + '☆'.repeat(5 - Math.max(0, Math.min(5, r.rating || 0))), W / 2, 300);
    g.fillStyle = '#211911';
    const quote = r.comment ? `“${r.comment}”` : `A ${r.rating || 5}-star shoot`;
    // short reviews big, long ones smaller; the text block sits in the middle of the card
    let size = 72, lines = [];
    for (const [px, max] of [[72, 5], [58, 7], [46, 9]]) {
      g.font = `${px}px Fraunces, Georgia, serif`; size = px;
      lines = wrapLines(g, quote, w - 140, max);
      if (!lines[lines.length - 1].endsWith('…') || px === 46) break;
    }
    const lh = Math.round(size * 1.38), areaTop = 370, areaBottom = H - 360;
    const top = areaTop + (areaBottom - areaTop - lines.length * lh) / 2 + size;
    lines.forEach((ln, i) => g.fillText(ln, W / 2, top + i * lh));
    g.fillStyle = '#6B5D4F'; g.font = '600 36px Inter, Arial, sans-serif';
    g.fillText(`— ${String(r.reviewer_name || 'A traveller').slice(0, 40)}${r.booking_id ? '  ✓ Verified booking' : ''}`, W / 2, H - 290);
    g.fillStyle = '#211911'; g.font = '40px Fraunces, Georgia, serif';
    g.fillText(String(listing.name || '').slice(0, 40), W / 2, H - 200);
    g.fillStyle = '#B04722'; g.font = '32px Inter, Arial, sans-serif';
    g.fillText(listing.handle ? `capturago.com/c/${listing.handle}` : 'capturago.com', W / 2, H - 145);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    if (!blob) { showToast('Could not create the image.', 'error'); return; }
    const file = new File([blob], 'capturago-review.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'My CapturaGo review' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    downloadBlob(blob, 'capturago-review.png');
    showToast('Image saved — post it to your Instagram story or feed.', 'success', 5000);
  }

  /* ── PACKAGES EDITOR ──────────────────────────────── */
  function addPackageRow(k = {}) {
    const box = $('elPackages');
    if (box.children.length >= 5) { showToast('Up to 5 packages.', 'info'); return; }
    const div = document.createElement('div');
    div.className = 'package-entry';
    if (k.id) div.dataset.id = k.id;
    const mins = [30, 45, 60, 90, 120, 180, 240, 480];
    const turnaround = [1, 2, 3, 5, 7, 10, 14, 21, 30];
    div.innerHTML = `
      <button type="button" class="spot-remove-btn" aria-label="Remove package">×</button>
      <div class="pk-grid">
        <input type="text" class="pk-name" maxlength="60" placeholder="Package name (e.g. Golden hour portraits)" />
        <select class="pk-type" aria-label="Package type"><option value="session">📍 In person</option><option value="delivery">🌐 Remote delivery</option></select>
        <div class="pk-price-wrap"><span>€</span><input type="number" class="pk-price" min="10" max="5000" step="1" placeholder="Price" /></div>
      </div>
      <div class="pk-grid pk-grid-2">
        <select class="pk-min" aria-label="Duration">${mins.map(m => `<option value="${m}">${m < 60 ? m + ' min' : (m / 60) + ' h'} session</option>`).join('')}</select>
        <select class="pk-days" aria-label="Delivery time" hidden>${turnaround.map(d => `<option value="${d}">Delivered in ${d} day${d > 1 ? 's' : ''}</option>`).join('')}</select>
        <select class="pk-rev" aria-label="Revisions" hidden>${[0, 1, 2, 3].map(r => `<option value="${r}">${r} revision${r === 1 ? '' : 's'}</option>`).join('')}</select>
      </div>
      <div class="pk-grid pk-grid-2">
        <label class="pk-small">Edited photos <input type="number" class="pk-photos" min="1" max="2000" step="1" placeholder="e.g. 30" /></label>
        <label class="pk-small pk-edit-wrap">Photos delivered within <select class="pk-edit" aria-label="Photos delivered within"><option value="">—</option>${[1, 2, 3, 5, 7, 10, 14, 21, 30].map(d => `<option value="${d}">${d} day${d > 1 ? 's' : ''}</option>`).join('')}</select></label>
      </div>
      <input type="text" class="pk-incl" maxlength="400" placeholder="Also included, separated by commas (e.g. Location scouting, 2 outfits, Posing help)" />
      <input type="text" class="pk-desc" maxlength="200" placeholder="Short description (optional)" />`;
    const typeSel = div.querySelector('.pk-type');
    const sync = () => {
      const remote = typeSel.value === 'delivery';
      div.querySelector('.pk-min').hidden = remote;
      div.querySelector('.pk-days').hidden = !remote;
      div.querySelector('.pk-rev').hidden = !remote;
      div.querySelector('.pk-edit-wrap').hidden = remote;
    };
    div.querySelector('.pk-name').value = k.name || '';
    typeSel.value = k.type === 'delivery' ? 'delivery' : 'session';
    div.querySelector('.pk-min').value = String(k.minutes || 60);
    div.querySelector('.pk-days').value = String(k.delivery_days || 3);
    div.querySelector('.pk-rev').value = String(k.revisions ?? 1);
    div.querySelector('.pk-price').value = k.price_eur != null ? k.price_eur : '';
    div.querySelector('.pk-desc').value = k.desc || '';
    div.querySelector('.pk-photos').value = Number(k.photos) > 0 ? String(k.photos) : '';
    div.querySelector('.pk-edit').value = Number(k.edit_days) > 0 ? String(k.edit_days) : '';
    div.querySelector('.pk-incl').value = (Array.isArray(k.includes) ? k.includes : []).join(', ');
    typeSel.addEventListener('change', sync);
    sync();
    div.querySelector('.spot-remove-btn').addEventListener('click', () => div.remove());
    box.appendChild(div);
  }
  $('elAddPackage').addEventListener('click', () => addPackageRow());

  /* ── BOOKABLE CHECKLIST ───────────────────────────── */
  function renderChecklist() {
    const el = $('bookableChecklist');
    if (!listing) { el.hidden = true; return; }
    const hasPkgs = Array.isArray(listing.packages) && listing.packages.length > 0;
    const payouts = !!listing.payouts_enabled;
    if (hasPkgs && payouts) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `
      <strong>Get booked online</strong>
      <p class="muted small">Travellers can pay you securely through CapturaGo once these are done:</p>
      <ul>
        <li class="${hasPkgs ? 'done' : ''}">${hasPkgs ? '✓' : '○'} Add at least one package with a price <button class="link-btn" data-goto2="listing">${hasPkgs ? 'Edit' : 'Add'}</button></li>
        <li class="${payouts ? 'done' : ''}">${payouts ? '✓' : '○'} Connect payouts with Stripe <button class="link-btn" data-goto2="payments">${payouts ? 'View' : 'Connect'}</button></li>
      </ul>`;
    el.querySelectorAll('[data-goto2]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.goto2)));
  }

  /* ── BOOKINGS ─────────────────────────────────────── */
  const euro = (c) => `€${(c / 100).toFixed(2)}`;
  const STATUS_TEXT = { pending_payment: 'Awaiting payment', paid: 'Paid — awaiting confirmation', confirmed: 'Confirmed', delivered: 'Delivered — awaiting approval', completed: 'Completed', declined: 'Declined — refunded', cancelled: 'Cancelled', refunded: 'Refunded', expired: 'Payment not completed', disputed: 'Under review' };
  const isRemote = (b) => b.booking_type === 'delivery';
  const PHOTO_STATUSES = ['confirmed', 'delivered', 'completed'];
  let bookingMap = new Map();
  let photoCounts = {};
  let pendingBooking = null;   // ?b=<id> from an email → open that booking's photos
  let pendingReview = null;    // ?review=<id> from the review reminder email → open the review form
  let pendingMove = null;      // ?move=<id> from a heavy-rain email or text → "Propose a new date" (bad weather)
  // The client sees the gallery once the creator sends it (session) or delivers (remote order)
  const clientSeesPhotos = (b) => isRemote(b)
    ? (b.status === 'delivered' || b.status === 'completed' || (b.revisions_used || 0) > 0)
    : (!!b.photos_ready_at || b.status === 'completed');
  const statusText = (b) => b.status === 'pending_payment' && Number(b.split_count) > 1 && b.split_deadline && Date.parse(b.split_deadline) - Date.now() > 31 * 60000 ? 'Friends are paying'
    : isRemote(b) && b.status === 'confirmed' ? 'Accepted — in progress'
    : isRemote(b) && b.status === 'paid' ? 'Paid — awaiting acceptance' : (STATUS_TEXT[b.status] || b.status);
  const hoursSince = (iso) => iso ? (Date.now() - Date.parse(iso)) / 3600000 : 0;
  const daysUntil = (iso) => {
    const today = new Date().toISOString().slice(0, 10);
    return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  };

  /* Packages that promise photos: the payout waits until 3 days after the photos were sent (same rule as the server) */
  function holdState(b) {
    if (!photosPromised(b)) return null;
    const sent = b.photos_delivered_at ? Date.parse(b.photos_delivered_at) : NaN;
    const release = Number.isFinite(sent) ? Math.max(Date.parse(`${b.shoot_date}T00:00:00Z`), sent) + 3 * 86400000 : null;
    const dueIso = new Date(Date.parse(`${b.shoot_date}T00:00:00Z`) + Math.round(Number(b.package_details && b.package_details.edit_days) || 0) * 86400000).toISOString().slice(0, 10);
    return { sent: Number.isFinite(sent), release, dueIso, waiting: release === null || Date.now() < release };
  }

  function bookingButtons(b, asCreator) {
    const d = daysUntil(b.shoot_date);
    const hold = holdState(b);
    const btns = [];
    if (isRemote(b)) {
      const left = (b.revisions_allowed || 0) - (b.revisions_used || 0);
      if (asCreator) {
        if (b.status === 'paid') btns.push(['confirm', 'Accept order', 'primary-btn'], ['decline', 'Decline & refund', 'danger-btn']);
        if (b.status === 'confirmed') btns.push(['deliver', 'Deliver files', 'primary-btn'], ['decline', 'Cancel & refund', 'danger-btn']);
        if (b.status === 'delivered' && hoursSince(b.delivered_at) >= 72) btns.push(['complete', 'Release my payment', 'primary-btn']);
      } else {
        if (b.status === 'pending_payment') btns.push(['cancel', 'Cancel', 'secondary-btn']);
        if (b.status === 'paid') btns.push(['cancel', 'Cancel — full refund', 'secondary-btn']);
        if (b.status === 'confirmed' && d < 0) btns.push(['cancel', 'Cancel — not delivered on time', 'secondary-btn']);
        if (b.status === 'delivered') {
          btns.push(['complete', 'Approve & release payment', 'primary-btn']);
          if (left > 0) btns.push(['revise', `Request a revision (${left} left)`, 'secondary-btn']);
          if (hoursSince(b.delivered_at) <= 72) btns.push(['dispute', 'Report a problem', 'danger-btn']);
        }
        if (b.status === 'paid' || b.status === 'confirmed') btns.push(['dispute', 'Report a problem', 'danger-btn']);
      }
      return btns;
    }
    if (asCreator) {
      if (b.status === 'paid') btns.push(['confirm', 'Confirm booking', 'primary-btn'], ['decline', 'Decline & refund', 'danger-btn']);
      if (b.status === 'confirmed' && d > 0) btns.push(['decline', 'Cancel & refund', 'danger-btn']);
      if (b.status === 'confirmed' && d <= -3 && !(hold && hold.waiting)) btns.push(['complete', 'Release my payment', 'primary-btn']);
    } else {
      if (b.status === 'pending_payment') btns.push(['cancel', 'Cancel', 'secondary-btn']);
      if (b.status === 'paid') btns.push(['cancel', 'Cancel — full refund', 'secondary-btn']);
      if (b.status === 'confirmed' && d >= 7) btns.push(['cancel', 'Cancel — full refund', 'secondary-btn']);
      if (b.status === 'confirmed' && d <= 0) btns.push(['complete', 'Shoot happened — release payment', 'primary-btn']);
      if ((b.status === 'paid' || b.status === 'confirmed') && d <= 0 && (d >= -3 || (b.status === 'confirmed' && hold && hold.waiting))) btns.push(['dispute', 'Report a problem', 'danger-btn']);
    }
    return btns;
  }

  function bookingHint(b, asCreator) {
    const d = daysUntil(b.shoot_date);
    if (isRemote(b)) {
      if (asCreator && b.status === 'confirmed' && b.revisions_used > 0 && b.last_revision_note) return `Revision requested: “${esc(b.last_revision_note)}”`;
      if (asCreator && b.status === 'delivered') return 'Payment is released when the client approves, or automatically eligible 3 days after delivery.';
      if (!asCreator && b.status === 'delivered') return "Check the files, then approve to release the payment. If you don't respond within 3 days, the creator can release it.";
      if (!asCreator && b.status === 'confirmed' && d >= 0) return `Due ${fmtDate(b.shoot_date)}. If it's late, you can cancel for a full refund.`;
    } else {
      if (asCreator && b.status === 'confirmed' && d > -3 && !photosPromised(b)) return 'Payment is released 3 days after the shoot, or as soon as the traveller confirms.';
      if (!asCreator && b.status === 'confirmed' && d > 0 && d < 7) return 'Free cancellation has ended. You can still propose a new date — free if you both agree.';
    }
    if (b.status === 'disputed') return "We're reviewing this booking and will contact both of you by email.";
    return '';
  }

  // Split booking: the friends' payment links (organiser only; links only while a share is open)
  async function openShares(b) {
    const { data, error } = await CG.split.mine(b.id);
    if (error) { showToast(error.message || 'Could not load the payment links.', 'error'); return; }
    const list = Array.isArray(data) ? data : [];
    const paid = list.filter((x) => x.status === 'paid').length;
    const row = (x) => {
      const url = x.token ? `${location.origin}/pay.html#t=${x.token}` : '';
      return `<li class="share-link"><span class="share-no">${x.share_no === 1 ? 'Your share' : `Friend ${x.share_no - 1}`} · ${euro(x.amount_cents)} — ${x.status === 'paid' ? '✓ paid' : x.status === 'refunded' ? 'refunded' : 'waiting'}</span>
        ${url ? `<span class="share-url" translate="no">${esc(url)}</span><span class="share-btns"><button type="button" class="secondary-btn" data-copy="${esc(url)}">Copy link</button></span>` : ''}</li>`;
    };
    openDashModal(`<h2>Friends' payment links</h2>
      <p class="split-status">${esc(splitNote(b, paid) || `${paid} of ${b.split_count} paid`)}</p>
      <p class="muted small">Send each friend one link. Every link can be paid once. If not everyone pays in time, everyone is refunded automatically and the day is released.</p>
      <ul class="share-links">${list.map(row).join('')}</ul>`);
    $('dashModalBody').querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copy); showToast('Link copied — send it to your friend.', 'success'); } catch { showToast(btn.dataset.copy, 'info', 8000); }
    }));
  }

  async function loadBookings() {
    const box = $('bookingsList');
    box.innerHTML = '<p class="muted">Loading…</p>';
    const { data, error } = await CG.bookings.list();
    if (error) { box.innerHTML = '<div class="empty-state">Bookings are not available yet. Please try again later.</div>'; return; }
    const list = (data || []).filter(b => b.status !== 'expired' || b.client_user_id === user.id);
    bookingMap = new Map(list.map(b => [b.id, b]));
    if (!list.length) {
      box.innerHTML = `<div class="empty-state">No bookings yet. ${listing ? 'Add packages and connect payouts so travellers can book you.' : '<a href="/">Find a creator</a> for your next trip.'}</div>`;
      pendingBooking = null;
      return;
    }
    const photoIds = list.filter(b => PHOTO_STATUSES.includes(b.status)).map(b => b.id);
    const needReviewCheck = list.some(b => b.client_user_id === user.id && b.status === 'completed');
    const [counts, reviewed] = await Promise.all([
      CG.deliveries.counts(photoIds).catch(() => ({})),
      needReviewCheck ? CG.reviews.myBookingIds(user.id).catch(() => []) : []
    ]);
    photoCounts = counts || {};
    const reviewedSet = new Set(reviewed || []);
    box.innerHTML = list.map(b => {
      const asCreator = b.creator_user_id === user.id;
      const nPhotos = photoCounts[b.id] || 0;
      const extraBtns = [];
      if (asCreator && PHOTO_STATUSES.includes(b.status) && (isRemote(b) ? b.status !== 'confirmed' : (daysUntil(b.shoot_date) <= 0 || nPhotos > 0))) {
        extraBtns.push(['photos', `📷 ${isRemote(b) ? 'Delivered photos' : 'Photos for the client'}${nPhotos ? ` (${nPhotos})` : ''}`, isRemote(b) || nPhotos ? 'secondary-btn' : 'primary-btn']);
      }
      if (!asCreator && nPhotos > 0 && clientSeesPhotos(b)) extraBtns.push(['gallery', `📸 Your photos (${nPhotos})`, 'primary-btn']);
      if (!asCreator && b.status === 'completed' && b.photographer_id) {
        if (reviewedSet.has(b.id)) extraBtns.push(['', '✓ Reviewed', 'reviewed-tag']);
        else extraBtns.push(['review', '⭐ Leave a review', 'secondary-btn']);
        extraBtns.push(['next', '🧭 Where to next?', 'secondary-btn']);
      }
      if (canPlan(b)) {
        if (asCreator) extraBtns.push(['meeting', b.meeting_point || b.meeting_time ? '📍 Edit meeting point' : '📍 Set meeting point', b.meeting_point || b.meeting_time ? 'secondary-btn' : 'primary-btn']);
        else extraBtns.push(['brief', (b.shot_list || []).length || (b.ref_links || []).length ? '📝 Edit shot list' : '📝 Shot list & references', 'secondary-btn']);
        if (daysUntil(b.shoot_date) >= 0 && (b.reschedules || 0) < 3 && !(b.proposed_date && b.proposed_by !== user.id)) extraBtns.push(['reschedule', '📅 Propose a new date', 'secondary-btn']);
      }
      const other = asCreator ? `${esc(b.client_name)} · <a href="mailto:${encodeURIComponent(b.client_email)}">${esc(b.client_email)}</a>` : esc(b.photographers ? `${b.photographers.name}, ${b.photographers.city}` : 'Creator');
      const split = Number(b.split_count) > 1, giftC = Number(b.gift_cents) || 0;
      const amount = asCreator ? `You receive ${euro(b.price_cents - b.creator_fee_cents)}`
        : split ? `${euro(b.total_cents)} split ${b.split_count} ways`
        : b.status === 'pending_payment' ? `${euro(b.total_cents)} to pay`
        : giftC ? `You paid ${euro(b.total_cents)} (${euro(giftC)} gift card)` : `You paid ${euro(b.total_cents)}`;
      if (!asCreator && split && b.status === 'pending_payment') extraBtns.unshift(['shares', '👯 Friends\' payment links', 'primary-btn']);
      const btns = bookingButtons(b, asCreator).map(([a, label, cls]) => `<button class="${cls} bk-act" data-id="${esc(b.id)}" data-act="${a}" data-name="${esc(b.package_name)}" data-date="${esc(b.shoot_date)}">${esc(label)}</button>`).join('')
        + extraBtns.map(([a, label, cls]) => a ? `<button class="${cls} bk-extra" data-id="${esc(b.id)}" data-x="${a}">${esc(label)}</button>` : `<span class="${cls}">${esc(label)}</span>`).join('')
        + (b.photographer_id && b.client_user_id && b.creator_user_id ? `<button class="secondary-btn bk-msg" data-id="${esc(b.id)}">💬 Message ${asCreator ? esc(String(b.client_name || 'the client').split(' ')[0]) : 'the creator'}</button>` : '');
      const hint = bookingHint(b, asCreator) || photoHint(b, asCreator, nPhotos);
      const slot = b.time_slot ? ` · ${esc(timeSlotLabel(b.time_slot))}` : '';
      const tags = (b.via_link && asCreator ? '<span class="bk-tag">✨ Via your link</span>' : '')
        + (b.surprise && !isRemote(b) ? `<span class="bk-tag bk-surprise" title="${asCreator ? 'The other person must not find out — plan everything with the traveller only.' : 'Our emails to you have neutral subjects.'}">🤫 Surprise</span>` : '');
      return `
        <div class="inquiry-item booking-item" data-bk="${esc(b.id)}">
          <div class="inquiry-header">
            <span class="inquiry-sender"><span translate="no">${esc(b.package_name)}</span> <span class="muted small">· ${asCreator ? 'Booked with you' : 'Your booking'}</span></span>
            <span class="status-pill status-${esc(b.status)}">${esc(statusText(b))}</span>
          </div>
          <div class="inquiry-meta"><span>${isRemote(b) ? '🌐 Remote · due' : '📅'} ${fmtDate(b.shoot_date)}${isRemote(b) ? '' : slot}</span>${b.shoot_city && !isRemote(b) ? `<span class="bk-city">✈️ In ${esc(String(b.shoot_city).split(',')[0])}</span>` : ''}${tags}<span>${asCreator ? '🧳' : '📷'} ${other}</span><span>💶 ${amount}</span>${Number(b.deal_pct) > 0 ? `<span class="bk-tag">⚡ Last-minute −${Number(b.deal_pct)}%</span>` : ''}</div>
          ${b.client_files_url && safeUrl(b.client_files_url) ? `<p class="small">📁 Client's files: <a href="${esc(safeUrl(b.client_files_url))}" target="_blank" rel="noopener nofollow">${esc(b.client_files_url)}</a></p>` : ''}
          ${b.delivery_url && safeUrl(b.delivery_url) ? `<p class="small">✅ Delivery: <a href="${esc(safeUrl(b.delivery_url))}" target="_blank" rel="noopener nofollow">${esc(b.delivery_url)}</a></p>` : ''}
          ${b.note ? `<div class="inquiry-message" translate="no" style="white-space:pre-line">“${esc(b.note)}”</div>` : ''}
          ${includedHtml(b)}
          ${payoutNote(b, asCreator) ? `<p class="small bk-hold">${esc(payoutNote(b, asCreator))}</p>` : ''}
          ${!asCreator && splitNote(b) ? `<p class="small bk-split">${esc(splitNote(b))}</p>` : ''}
          ${proposalHtml(b, asCreator)}
          ${planBoxHtml(b, asCreator)}
          ${hint ? `<p class="muted small">${hint}</p>` : ''}
          ${btns ? `<div class="booking-actions">${btns}</div>` : ''}
        </div>`;
    }).join('');
    box.querySelectorAll('.bk-prop').forEach(btn => btn.addEventListener('click', () => answerProposal(btn)));
    fillWeather(box);
    box.querySelectorAll('.bk-act').forEach(btn => btn.addEventListener('click', () => doBookingAction(btn)));
    box.querySelectorAll('.bk-extra').forEach(btn => btn.addEventListener('click', () => {
      const b = bookingMap.get(btn.dataset.id); if (!b) return;
      if (btn.dataset.x === 'photos') openPhotoManager(b);
      else if (btn.dataset.x === 'gallery') openClientGallery(b);
      else if (btn.dataset.x === 'review') openReview(b);
      else if (btn.dataset.x === 'reschedule') openReschedule(b);
      else if (btn.dataset.x === 'meeting') openMeeting(b);
      else if (btn.dataset.x === 'brief') openBrief(b);
      else if (btn.dataset.x === 'next') location.href = '/#tripPlanner';
      else if (btn.dataset.x === 'shares') openShares(b);
    }));
    if (pendingReview) {
      const b = bookingMap.get(pendingReview);
      pendingReview = null;
      if (b && b.client_user_id === user.id && b.status === 'completed' && b.photographer_id) {
        if (reviewedSet.has(b.id)) showToast("You've already reviewed this booking — thank you!", 'info');
        else openReview(b);
      }
    }
    if (pendingMove) {
      const b = bookingMap.get(pendingMove);
      pendingMove = null;
      if (b) {
        const card = box.querySelector(`[data-bk="${CSS.escape(b.id)}"]`);
        if (card) { card.classList.add('bk-flash'); card.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        if (!canPlan(b) || daysUntil(b.shoot_date) < 0) showToast('This shoot can no longer be moved.', 'info', 6000);
        else if (b.proposed_date && b.proposed_by && b.proposed_by !== user.id) showToast('A new date was already proposed to you — accept or keep the original date below.', 'info', 7000);
        else if ((b.reschedules || 0) >= 3) showToast('This booking was already moved 3 times. Please message each other.', 'info', 7000);
        else openReschedule(b, true);
      } else showToast('Booking not found — are you signed in with the right account?', 'error', 6000);
    }
    if (pendingBooking) {
      const b = bookingMap.get(pendingBooking);
      pendingBooking = null;
      if (b) {
        const card = box.querySelector(`[data-bk="${CSS.escape(b.id)}"]`);
        if (card) { card.classList.add('bk-flash'); card.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        if (b.creator_user_id === user.id && PHOTO_STATUSES.includes(b.status)) openPhotoManager(b);
        else if (b.client_user_id === user.id && (photoCounts[b.id] || 0) > 0 && clientSeesPhotos(b)) openClientGallery(b);
      }
    }
    box.querySelectorAll('.bk-msg').forEach(btn => btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { data, error } = await CG.chat.forBooking(btn.dataset.id);
      btn.disabled = false;
      if (error || !data) { showToast(error?.message || 'Could not open the conversation.', 'error'); return; }
      showPanel('messages');
      openConversation(data);
    }));
  }

  const CONFIRM_TEXT = {
    decline: (n, d) => `Decline "${n}" on ${d}? The traveller will be refunded in full.`,
    cancel: (n, d) => `Cancel "${n}" on ${d}?`,
    complete: (n) => `Release the payment for "${n}" to the creator? This can't be undone.`,
    dispute: (n) => `Report a problem with "${n}"? The payment will be frozen while we review it.`,
  };

  async function doBookingAction(btn) {
    const { id, act, name, date } = btn.dataset;
    const extra = {};
    if (act === 'deliver') {
      const b = bookingMap.get(id);
      if (b) openPhotoManager(b);
      return;
    } else if (act === 'dispute') {
      const b = bookingMap.get(id);
      if (b) openDispute(b);
      return;
    } else if (act === 'revise') {
      const msg = (prompt('What should the creator change?') || '').trim();
      if (!msg) return;
      if (msg.length < 3) { showToast('Tell the creator what to change.', 'error'); return; }
      extra.message = msg.slice(0, 1000);
    } else if (act === 'complete' && (() => { const b = bookingMap.get(id); const h = b && b.client_user_id === user.id ? holdState(b) : null; return h && !h.sent; })()) {
      if (!confirm(`Your photos for "${name}" haven't been sent yet. Release the payment to the creator anyway? This can't be undone.`)) return;
    } else if (CONFIRM_TEXT[act] && !confirm(CONFIRM_TEXT[act](name, fmtDate(date)))) return;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Working…';
    const { data, error } = await CG.bookings.action(id, act, extra);
    if (error) {
      btn.disabled = false; btn.textContent = original;
      showToast(error.message || 'Something went wrong.', 'error', 6000);
      return;
    }
    const msgs = { confirm: 'Booking confirmed ✓', decline: 'Declined — the traveller is being refunded.', cancel: data?.refunded ? 'Cancelled — your refund is on its way.' : 'Booking cancelled.', complete: 'Payment released ✓', dispute: "Thanks — we'll be in touch within 48 hours.", deliver: 'Delivered ✓ — the client has been notified.', revise: 'Revision requested ✓' };
    showToast(msgs[act] || 'Done', 'success', 5000);
    loadBookings();
    refreshBookingBadge();
  }

  /* ── PLANNING: new date (both agree), meeting point, shot list, problems, weather ── */
  const PLAN_STATUSES = ['paid', 'confirmed'];
  const canPlan = (b) => !isRemote(b) && PLAN_STATUSES.includes(b.status);
  const isoNice = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const mapsLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const otherName = (b, asCreator) => (asCreator ? firstName(b.client_name) : (b.photographers?.name ? firstName(b.photographers.name) : 'your creator'));

  /* What was agreed when the traveller paid (kept with the booking) + when the photos are promised */
  function photosDueIso(b) {
    const d = Math.round(Number(b.package_details && b.package_details.edit_days));
    if (isRemote(b) || !(d >= 1 && d <= 60)) return '';
    return new Date(Date.parse(`${b.shoot_date}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
  }
  function includedHtml(b) {
    const facts = b.package_details ? packageFacts(b.package_details) : [];
    const due = photosDueIso(b);
    const waiting = due && !b.photos_ready_at && ['paid', 'confirmed', 'completed'].includes(b.status);
    if (!facts.length && !waiting) return '';
    return `<details class="bk-included"><summary>What's included${waiting ? ` · 📬 photos by ${esc(fmtDate(`${due}T12:00:00Z`))}` : ''}</summary><ul>${facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <p class="muted small">This is what the package said when it was booked.</p></details>`;
  }

  function proposalHtml(b, asCreator) {
    if (!b.proposed_date || !canPlan(b)) return '';
    const when = `${isoNice(b.proposed_date)}${b.proposed_slot ? ` · ${timeSlotLabel(b.proposed_slot)}` : ''}`;
    const why = b.proposed_reason === 'weather' ? ' because of the weather' : '';
    if (b.proposed_by === user.id) {
      return `<div class="bk-proposal mine">📅 You proposed moving the shoot to <strong>${esc(when)}</strong>${why}. Waiting for ${esc(otherName(b, asCreator))}.
        <button class="link-btn bk-prop" data-id="${esc(b.id)}" data-a="withdraw_date">Withdraw</button></div>`;
    }
    return `<div class="bk-proposal">📅 <strong>${esc(otherName(b, asCreator))}</strong> proposes moving the shoot to <strong>${esc(when)}</strong>${why}.
      <div class="bk-prop-actions"><button class="primary-btn bk-prop" data-id="${esc(b.id)}" data-a="accept_date">Accept new date</button>
      <button class="secondary-btn bk-prop" data-id="${esc(b.id)}" data-a="decline_date">Keep ${esc(isoNice(b.shoot_date))}</button></div></div>`;
  }

  function planBoxHtml(b, asCreator) {
    if (!canPlan(b)) return '';
    const d = daysUntil(b.shoot_date);
    const rows = [];
    if (b.meeting_point || b.meeting_time) {
      rows.push(`<div>📍 ${b.meeting_point ? `<a href="${esc(mapsLink(b.meeting_point))}" target="_blank" rel="noopener">${esc(b.meeting_point)}</a>` : 'Meeting point not set yet'}${b.meeting_time ? ` · 🕒 ${esc(b.meeting_time)}` : ''}</div>`);
    } else {
      rows.push(`<div class="muted">📍 ${asCreator ? 'Share where and when to meet — the traveller gets an email with a map link.' : `${esc(otherName(b, asCreator))} will share the meeting point here.`}</div>`);
    }
    const shots = Array.isArray(b.shot_list) ? b.shot_list : [];
    if (shots.length) rows.push(`<div>📝 <strong>Shot list:</strong> ${shots.map(esc).join(' · ')}</div>`);
    const refs = (Array.isArray(b.ref_links) ? b.ref_links : []).map(safeUrl).filter(Boolean);
    if (refs.length) rows.push(`<div>🔗 <strong>References:</strong> ${refs.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener nofollow">Link ${i + 1}</a>`).join(' · ')}</div>`);
    if (asCreator && b.surprise) rows.push(`<div>🤫 <strong>Surprise:</strong> the other person doesn't know — don't contact or tag them before the moment.</div>`);
    const coords = b.shoot_city ? b.shoot_coords : (b.photographers && b.photographers.coords);   // a trip: the trip city's weather (or none)
    const wx = d >= 0 && d <= 15 && coords && Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lon))
      ? `<div class="bk-weather" data-lat="${Number(coords.lat)}" data-lon="${Number(coords.lon)}" data-date="${esc(b.shoot_date)}" data-id="${esc(b.id)}"><span class="muted">🌤 Checking the forecast…</span></div>` : '';
    const title = d === 0 ? "Today's shoot" : d === 1 ? "Tomorrow's shoot" : 'Shoot plan';
    return `<div class="bk-plan${d >= 0 && d <= 1 ? ' soon' : ''}"><strong class="bk-plan-title">${title}</strong>${rows.join('')}${wx}</div>`;
  }

  async function fillWeather(root) {
    for (const el of [...root.querySelectorAll('.bk-weather')]) {
      const w = await getForecast({ lat: el.dataset.lat, lon: el.dataset.lon }, el.dataset.date);
      if (!el.isConnected) continue;
      if (!w) { el.remove(); continue; }
      const b = bookingMap.get(el.dataset.id);
      const offer = w.bad && b && canPlan(b) && daysUntil(b.shoot_date) >= 1 && !b.proposed_date && (b.reschedules || 0) < 3;
      el.innerHTML = `<span>${w.icon} <strong>${esc(w.text)}</strong> · ${w.min}–${w.max}°C${w.rain != null ? ` · ${w.rain}% chance of rain` : ''}</span>`
        + (offer ? `<span class="bk-wx-tip">Bad weather? <button class="link-btn bk-wx-move" data-id="${esc(el.dataset.id)}">Propose a new date</button> — free, if you both agree.</span>` : '');
      el.classList.toggle('bad', !!w.bad);
      el.querySelector('.bk-wx-move')?.addEventListener('click', () => { const bk = bookingMap.get(el.dataset.id); if (bk) openReschedule(bk, true); });
    }
  }

  async function answerProposal(btn) {
    const b = bookingMap.get(btn.dataset.id); if (!b) return;
    const a = btn.dataset.a;
    if (a === 'accept_date' && !confirm(`Move "${b.package_name}" to ${isoNice(b.proposed_date)}?`)) return;
    btn.disabled = true;
    const { error } = await CG.bookings.action(b.id, a);
    if (error) { btn.disabled = false; showToast(error.message || 'Something went wrong.', 'error', 6000); loadBookings(); return; }
    showToast({ accept_date: 'New date confirmed ✓', decline_date: 'You kept the original date.', withdraw_date: 'Proposal withdrawn.' }[a] || 'Done', 'success');
    loadBookings();
  }

  async function planAction(b, action, extra, okMsg, btn) {
    if (btn) { btn.disabled = true; }
    const { error } = await CG.bookings.action(b.id, action, extra);
    if (btn) btn.disabled = false;
    if (error) { showToast(error.message || 'Something went wrong.', 'error', 6000); return false; }
    closeDashModal(true);
    showToast(okMsg, 'success', 5000);
    loadBookings();
    return true;
  }

  async function openReschedule(b, weather = false) {
    const asCreator = b.creator_user_id === user.id;
    const now = new Date();
    const tomorrow = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const max = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 365));
    const st = { date: '', slot: b.time_slot || '' };
    openDashModal(`
      <h2 id="dashModalTitle" class="pm-title">📅 Propose a new date</h2>
      <p class="muted small pm-sub"><span translate="no">${esc(b.package_name)}</span> · now <strong>${esc(isoNice(b.shoot_date))}</strong>. ${esc(otherName(b, asCreator))} has to accept before anything changes — moving the shoot is free.</p>
      <div class="rs-reason" role="radiogroup" aria-label="Why">
        <label><input type="radio" name="rsReason" value="weather" ${weather ? 'checked' : ''} /> 🌧 Bad weather forecast</label>
        <label><input type="radio" name="rsReason" value="other" ${weather ? '' : 'checked'} /> Something else</label>
      </div>
      <div class="calendar" id="rsCal"><p class="muted small">Loading the calendar…</p></div>
      <p class="small rs-picked" id="rsPicked">Pick a day — crossed-out days are taken.</p>
      <div class="slot-chips" id="rsSlots" aria-label="Time of day">${CG_TIME_SLOTS.map(([k, l]) => `<button type="button" data-slot="${k}" class="${st.slot === k ? 'on' : ''}" aria-pressed="${st.slot === k}">${l}</button>`).join('')}</div>
      <label for="rsMsg" class="small"><strong>Message</strong> <span class="muted">(optional)</span></label>
      <textarea id="rsMsg" class="dm-input" rows="2" maxlength="300" placeholder="e.g. Heavy rain all day — would Thursday work?"></textarea>
      <div class="pm-actions" style="margin-top:12px"><button type="button" class="primary-btn" id="rsSend" disabled>Send proposal</button></div>`);
    const busy = new Set(b.photographer_id ? await CG.photographers.busyDates(b.photographer_id) : []);
    if (!$('rsCal')) return;
    const selected = new Set();
    renderCalendar($('rsCal'), {
      min: tomorrow, max, start: b.shoot_date >= tomorrow ? b.shoot_date : tomorrow,
      isOff: (iso) => busy.has(iso) || iso === b.shoot_date, selected,
      onPick: (iso) => { selected.clear(); selected.add(iso); st.date = iso; $('rsPicked').innerHTML = `New date: <strong>${esc(isoNice(iso))}</strong>`; $('rsSend').disabled = false; }
    });
    $('rsSlots').querySelectorAll('button').forEach(x => x.addEventListener('click', () => {
      st.slot = st.slot === x.dataset.slot ? '' : x.dataset.slot;
      $('rsSlots').querySelectorAll('button').forEach(y => { y.classList.toggle('on', y.dataset.slot === st.slot); y.setAttribute('aria-pressed', y.dataset.slot === st.slot ? 'true' : 'false'); });
    }));
    $('rsSend').addEventListener('click', () => {
      if (!st.date) { showToast('Pick a day first.', 'error'); return; }
      const reason = $('dashModalBody').querySelector('input[name="rsReason"]:checked')?.value === 'weather' ? 'weather' : 'other';
      planAction(b, 'propose_date', { date: st.date, time_slot: st.slot || undefined, reason, message: $('rsMsg').value.trim() },
        `Sent ✓ — ${otherName(b, asCreator)} can accept or decline it.`, $('rsSend'));
    });
  }

  function openMeeting(b) {
    openDashModal(`
      <h2 id="dashModalTitle" class="pm-title">📍 Where and when to meet</h2>
      <p class="muted small pm-sub"><span translate="no">${esc(b.package_name)}</span> · ${esc(isoNice(b.shoot_date))}${b.time_slot ? ` · ${esc(timeSlotLabel(b.time_slot))}` : ''}. ${esc(firstName(b.client_name))} gets an email with a map link.</p>
      <label for="mtPlace" class="small"><strong>Meeting point</strong></label>
      <input id="mtPlace" class="dm-input" type="text" maxlength="300" placeholder="e.g. Yasaka Shrine, main gate" value="${esc(b.meeting_point || '')}" />
      <p class="muted small" style="margin:4px 0 12px">A landmark or an address works best.</p>
      <label for="mtTime" class="small"><strong>Time</strong></label>
      <input id="mtTime" class="dm-input" type="time" value="${esc(b.meeting_time || '')}" style="max-width:160px" />
      <div class="pm-actions" style="margin-top:16px"><button type="button" class="primary-btn" id="mtSave">Save and tell ${esc(firstName(b.client_name))}</button></div>`);
    $('mtSave').addEventListener('click', () => {
      const point = $('mtPlace').value.trim(), time = $('mtTime').value.trim().slice(0, 5);
      if (!point && !time) { showToast('Enter a meeting point or a time.', 'error'); $('mtPlace').focus(); return; }
      planAction(b, 'set_meeting', { meeting_point: point, meeting_time: time }, 'Saved ✓ — the traveller has been told.', $('mtSave'));
    });
  }

  function openBrief(b) {
    const creator = b.photographers?.name ? firstName(b.photographers.name) : 'your creator';
    openDashModal(`
      <h2 id="dashModalTitle" class="pm-title">📝 Shot list &amp; references</h2>
      <p class="muted small pm-sub">Help ${esc(creator)} plan: the moments you don't want to miss, and photos you love.</p>
      <label for="brShots" class="small"><strong>Must-have shots</strong> <span class="muted">— one per line, up to 20</span></label>
      <textarea id="brShots" class="dm-input" rows="5" placeholder="The ring moment&#10;Wide shot with the pagoda&#10;Candid laughing photos">${esc((b.shot_list || []).join('\n'))}</textarea>
      <label for="brRefs" class="small" style="margin-top:12px;display:block"><strong>Reference links</strong> <span class="muted">— Pinterest, Instagram… one per line, up to 6</span></label>
      <textarea id="brRefs" class="dm-input" rows="3" placeholder="https://pinterest.com/pin/…">${esc((b.ref_links || []).join('\n'))}</textarea>
      <label class="surprise-row" style="margin-top:14px"><input type="checkbox" id="brSurprise" ${b.surprise ? 'checked' : ''} /> <span><strong>🤫 It's a surprise</strong><br/><span class="muted small">${esc(creator)} is told to keep it secret, and our emails to you have neutral subjects.</span></span></label>
      <div class="pm-actions"><button type="button" class="primary-btn" id="brSave">Save</button></div>`);
    $('brSave').addEventListener('click', () => {
      const shots = $('brShots').value.split('\n').map(x => x.trim()).filter(Boolean);
      const refs = $('brRefs').value.split('\n').map(x => x.trim()).filter(Boolean);
      if (shots.length > 20) { showToast('Up to 20 shots, please.', 'error'); return; }
      if (refs.length > 6) { showToast('Up to 6 reference links, please.', 'error'); return; }
      if (refs.some(u => !/^https:\/\/\S+$/i.test(u))) { showToast('Reference links must start with https://', 'error'); return; }
      planAction(b, 'set_brief', { shot_list: shots, ref_links: refs, surprise: $('brSurprise').checked }, 'Saved ✓ — your creator can see it.', $('brSave'));
    });
  }

  function openDispute(b) {
    const remote = isRemote(b);
    const canNoShow = !remote && daysUntil(b.shoot_date) <= 0;
    const hold = holdState(b);
    const lateOk = !remote && hold && !hold.sent && b.status === 'confirmed' && new Date().toISOString().slice(0, 10) > hold.dueIso;
    const reasons = [
      ...(lateOk ? [['photos_late', `The photos are late (promised by ${isoNice(hold.dueIso)})`]] : []),
      ...(canNoShow ? [['no_show', "The creator didn't show up"]] : []),
      ['quality', remote ? "The delivery isn't what we agreed" : "It wasn't what we agreed"],
      ['other', 'Something else'],
    ];
    openDashModal(`
      <h2 id="dashModalTitle" class="pm-title">Report a problem</h2>
      <p class="muted small pm-sub"><span translate="no">${esc(b.package_name)}</span> · ${esc(isoNice(b.shoot_date))}. The payment is <strong>frozen</strong> while our team reviews it — we contact you both by email within 48 hours.</p>
      <div class="rs-reason" role="radiogroup" aria-label="What happened">
        ${reasons.map(([v, l], i) => `<label><input type="radio" name="dpReason" value="${v}" ${i === 0 ? 'checked' : ''} /> ${l}</label>`).join('')}
      </div>
      <label for="dpMsg" class="small"><strong>What happened?</strong></label>
      <textarea id="dpMsg" class="dm-input" rows="4" maxlength="1000" placeholder="A few sentences help us decide quickly and fairly."></textarea>
      <div class="pm-actions" style="margin-top:12px"><button type="button" class="danger-btn" id="dpSend">Report and freeze the payment</button></div>`);
    $('dpSend').addEventListener('click', () => {
      const reason = $('dashModalBody').querySelector('input[name="dpReason"]:checked')?.value || 'other';
      const msg = $('dpMsg').value.trim();
      if (reason !== 'no_show' && reason !== 'photos_late' && msg.length < 10) { showToast('Please describe the problem in a sentence or two.', 'error'); $('dpMsg').focus(); return; }
      planAction(b, 'dispute', { reason, message: msg }, "Thanks — the payment is on hold and we'll be in touch within 48 hours.", $('dpSend'));
    });
  }


  function photoHint(b, asCreator, n) {
    if (asCreator && !isRemote(b) && b.status === 'confirmed' && daysUntil(b.shoot_date) <= 0 && !n) return 'After the shoot, upload the photos here — your client gets a private gallery to view and download them.';
    if (!asCreator && n > 0 && b.completed_at && clientSeesPhotos(b)) {
      const until = new Date(Date.parse(b.completed_at) + 90 * 86400000);
      return `Your photos are kept until ${fmtDate(until.toISOString())}. Download your favourites before then.`;
    }
    return '';
  }

  async function refreshBookingBadge() {
    const { data } = await CG.bookings.list();
    // Needs your action: new bookings to accept (creator) or deliveries to approve (client)
    const n = (data || []).filter(b => (b.creator_user_id === user.id && b.status === 'paid') || (b.client_user_id === user.id && b.status === 'delivered')).length;
    $('bookingBadge').hidden = n === 0;
    $('bookingBadge').textContent = n;
  }

  /* ── PAYMENTS (Stripe Connect) ────────────────────── */
  const COUNTRIES = [['SK', 'Slovakia'], ['CZ', 'Czechia'], ['AT', 'Austria'], ['DE', 'Germany'], ['HU', 'Hungary'], ['PL', 'Poland'], ['FR', 'France'], ['IT', 'Italy'], ['ES', 'Spain'], ['PT', 'Portugal'], ['GR', 'Greece'], ['NL', 'Netherlands'], ['BE', 'Belgium'], ['IE', 'Ireland'], ['GB', 'United Kingdom'], ['CH', 'Switzerland'], ['HR', 'Croatia'], ['SI', 'Slovenia'], ['RO', 'Romania'], ['BG', 'Bulgaria'], ['DK', 'Denmark'], ['SE', 'Sweden'], ['NO', 'Norway'], ['FI', 'Finland'], ['US', 'United States'], ['CA', 'Canada'], ['AU', 'Australia'], ['JP', 'Japan'], ['TH', 'Thailand'], ['ID', 'Indonesia'], ['MX', 'Mexico']];

  async function loadPayments() {
    const box = $('paymentsBox');
    if (!listing) { box.innerHTML = '<div class="empty-state">Create your listing first, then connect payouts.</div>'; return; }
    const fee = window.CG_CONFIG?.clientFeePercent ?? 10;
    const creatorFee = window.CG_CONFIG?.creatorFeePercent ?? 0;
    const explainer = `
      <ul class="book-promises" style="margin-top:14px">
        <li>💶 You keep ${100 - creatorFee}% of your package price. Travellers pay a ${fee}% service fee on top.</li>
        <li>🔒 Travellers pay upfront; the money is released to you after the shoot.</li>
        <li>🏦 Stripe verifies your identity and pays out to your bank account. CapturaGo never sees your bank details.</li>
      </ul>`;
    box.innerHTML = '<p class="muted">Checking your payout status…</p>';
    const { data, error } = await CG.pay.connect('status');
    if (error) {
      box.innerHTML = `<p class="muted">${error.status === 503 ? 'Online payments are being set up — check back soon.' : esc(error.message)}</p>${explainer}`;
      return;
    }
    if (data.ready) {
      listing.payouts_enabled = true; renderChecklist();
      box.innerHTML = `<p><strong class="ok">✓ Payouts active</strong> — travellers can book and pay you online.</p>
        <button class="secondary-btn" id="stripeDash">Open my Stripe payout dashboard</button>${explainer}`;
      $('stripeDash').addEventListener('click', () => goStripe('dashboard'));
    } else if (data.connected) {
      box.innerHTML = `<p><strong>Almost there.</strong> Stripe needs a few more details${data.due ? ` (${data.due} item${data.due > 1 ? 's' : ''})` : ''} before you can be paid.</p>
        <button class="primary-btn" id="stripeGo">Continue setup with Stripe</button>${explainer}`;
      $('stripeGo').addEventListener('click', () => goStripe('onboard'));
    } else {
      box.innerHTML = `<p>Connect a payout account to accept online bookings.</p>
        <div class="form-row" style="max-width:320px;margin-top:12px"><label for="stripeCountry">Country you live in</label>
          <select id="stripeCountry">${COUNTRIES.map(([c, n]) => `<option value="${c}">${n}</option>`).join('')}</select></div>
        <button class="primary-btn" id="stripeGo">Set up payouts with Stripe</button>
        <p class="form-note" style="margin-top:10px">Your country can't be changed later. Stripe supports most countries; if yours isn't supported you can still receive inquiries.</p>${explainer}`;
      $('stripeGo').addEventListener('click', () => goStripe('onboard', $('stripeCountry').value));
    }
  }

  /* ── 🧾 TAX DETAILS (EU DAC7): needed once a creator can be paid online; reported once a year ── */
  const ISO = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
  const countryName = (() => {
    let dn = null;
    try { dn = new Intl.DisplayNames([window.CG_LANG || 'en', 'en'], { type: 'region' }); } catch {}
    return (c) => { try { return (dn && dn.of(c)) || c; } catch { return c; } };
  })();
  const countryOptions = (sel) => ISO.map((c) => [c, countryName(c)]).sort((a, b) => a[1].localeCompare(b[1]))
    .map(([c, n]) => `<option value="${c}"${c === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');
  async function taxReminder() {
    const box = $('taxReminder');
    if (!box || !listing) return;
    const { data } = await CG.tax.mine();
    if (!data || !data.required || data.info) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<div><strong>🧾 Add your tax details</strong><p class="muted small">EU law (DAC7) requires us to collect them from creators who are paid through CapturaGo. It takes about two minutes.${data.hold ? ' <strong class="tax-hold">Your payouts are on hold until you add them.</strong>' : ''}</p></div>
      <button type="button" class="primary-btn" id="taxGo">Add my tax details</button>`;
    $('taxGo').addEventListener('click', () => showPanel('payments'));
  }
  async function loadTax(editing = false) {
    const box = $('taxBox');
    if (!box) return;
    if (!listing) { box.hidden = true; return; }
    const { data, error } = await CG.tax.mine();
    if (error || !data) { box.hidden = true; return; }   // database update not run yet
    box.hidden = false;
    const t = data.info;
    const head = `<h3 style="margin:0 0 4px">🧾 Tax details <span class="muted small">(EU DAC7)</span></h3>`;
    const why = `<p class="muted small">EU law (DAC7) requires platforms to collect the tax details of creators who are paid through them and to report their earnings to the tax authority once a year. You get a copy every January. Only you and the CapturaGo team can see these details. <a href="/privacy.html#tax" target="_blank">Privacy Policy</a></p>`;
    if (t && !editing) {
      const who = t.kind === 'business' ? `${t.business_name} · ${t.business_number}` : `${t.first_name} ${t.last_name}`;
      box.innerHTML = `${head}<p><strong class="ok">✓ Saved</strong> <span class="muted small">— ${esc(fmtDate(t.confirmed_at))}</span></p>
        <p class="small" translate="no">${esc(who)}<br/>${esc([t.address, [t.postal_code, t.city].filter(Boolean).join(' '), countryName(t.country)].filter(Boolean).join(', '))}<br/>${t.no_tin ? '—' : `${esc(t.tin_country)} ${esc(t.tin)}`}${t.vat_number ? ` · ${esc(t.vat_number)}` : ''}</p>
        <button type="button" class="secondary-btn" id="taxEdit">Edit my tax details</button>${why}`;
      $('taxEdit').addEventListener('click', () => loadTax(true));
      return;
    }
    if (!t && !data.required && !editing) {
      box.innerHTML = `${head}<p class="small">You'll need these once you can be paid online. You can add them now.</p>
        <button type="button" class="secondary-btn" id="taxEdit">Add my tax details</button>${why}`;
      $('taxEdit').addEventListener('click', () => loadTax(true));
      return;
    }
    const v = t || { kind: 'individual', country: '' };
    const biz = v.kind === 'business';
    box.innerHTML = `${head}${!t ? `<p class="small">${data.hold ? '<strong class="tax-hold">Your payouts are on hold until you add these details.</strong> ' : ''}Please add your details — we need them before we can report your earnings.</p>` : ''}
      <form id="taxForm" class="tax-form" novalidate>
        <div class="tax-kind" role="radiogroup" aria-label="I work as">
          <label><input type="radio" name="taxKind" value="individual" ${biz ? '' : 'checked'} /> A private person</label>
          <label><input type="radio" name="taxKind" value="business" ${biz ? 'checked' : ''} /> A business (company or registered sole trader)</label>
        </div>
        <div class="tax-ind" ${biz ? 'hidden' : ''}>
          <div class="tax-two"><div class="form-row"><label for="txFirst">First name(s) *</label><input id="txFirst" maxlength="100" autocomplete="given-name" value="${esc(v.first_name || '')}" /></div>
            <div class="form-row"><label for="txLast">Last name *</label><input id="txLast" maxlength="100" autocomplete="family-name" value="${esc(v.last_name || '')}" /></div></div>
          <div class="form-row"><label for="txBirth">Date of birth *</label><input id="txBirth" type="date" autocomplete="bday" value="${esc(v.birth_date || '')}" style="max-width:220px" /></div>
          <p class="form-note">As on your ID.</p>
        </div>
        <div class="tax-biz" ${biz ? '' : 'hidden'}>
          <div class="form-row"><label for="txBizName">Registered business name *</label><input id="txBizName" maxlength="200" autocomplete="organization" value="${esc(v.business_name || '')}" /></div>
          <div class="form-row"><label for="txBizNo">Business registration number *</label><input id="txBizNo" maxlength="40" value="${esc(v.business_number || '')}" placeholder="e.g. IČO, trade register number" /></div>
        </div>
        <div class="form-row"><label for="txAddr">Street and number *</label><input id="txAddr" maxlength="200" autocomplete="street-address" value="${esc(v.address || '')}" /></div>
        <div class="tax-two"><div class="form-row"><label for="txZip">Postal code</label><input id="txZip" maxlength="20" autocomplete="postal-code" value="${esc(v.postal_code || '')}" /></div>
          <div class="form-row"><label for="txCity">City *</label><input id="txCity" maxlength="100" autocomplete="address-level2" value="${esc(v.city || '')}" /></div></div>
        <div class="form-row"><label for="txCountry">Country where you live *</label><select id="txCountry" translate="no"><option value="">Choose…</option>${countryOptions(v.country)}</select>
          <p class="form-note tax-biz-note" ${biz ? '' : 'hidden'}>For a business: where it is registered.</p></div>
        <div class="tax-tin" ${v.no_tin ? 'hidden' : ''}>
          <div class="tax-two"><div class="form-row"><label for="txTin">Tax number (TIN) *</label><input id="txTin" maxlength="30" autocomplete="off" spellcheck="false" value="${esc(v.tin || '')}" /></div>
            <div class="form-row"><label for="txTinCountry">Issued by *</label><select id="txTinCountry" translate="no"><option value="">Same as above</option>${countryOptions(v.tin_country && v.tin_country !== v.country ? v.tin_country : '')}</select></div></div>
          <p class="form-note">The number your tax office gave you (in Slovakia: rodné číslo or DIČ; in Germany: Steuer-ID).</p>
        </div>
        <label class="tax-check tax-ind" ${biz ? 'hidden' : ''}><input type="checkbox" id="txNoTin" ${v.no_tin ? 'checked' : ''} /> My country doesn't issue tax numbers</label>
        <div class="form-row tax-bp" ${v.no_tin && !biz ? '' : 'hidden'}><label for="txBirthPlace">Place of birth (city and country) *</label><input id="txBirthPlace" maxlength="120" value="${esc(v.birth_place || '')}" /></div>
        <div class="form-row"><label for="txVat">VAT number <span class="muted">(optional)</span></label><input id="txVat" maxlength="20" autocomplete="off" spellcheck="false" value="${esc(v.vat_number || '')}" placeholder="e.g. SK2020123456" /></div>
        <label class="tax-check"><input type="checkbox" id="txOk" /> I confirm these details are correct and complete.</label>
        <div class="pm-actions"><button type="submit" class="primary-btn" id="txSave">Save tax details</button>${t ? '<button type="button" class="link-btn" id="txCancel">Cancel</button>' : ''}</div>
      </form>${why}`;
    const f = $('taxForm');
    const kind = () => f.querySelector('input[name="taxKind"]:checked')?.value || 'individual';
    const sync = () => {
      const b = kind() === 'business', nt = !b && $('txNoTin').checked;
      f.querySelectorAll('.tax-ind').forEach((x) => { x.hidden = b; });
      f.querySelectorAll('.tax-biz, .tax-biz-note').forEach((x) => { x.hidden = !b; });
      f.querySelector('.tax-tin').hidden = nt;
      f.querySelector('.tax-bp').hidden = !nt;
    };
    f.querySelectorAll('input[name="taxKind"]').forEach((x) => x.addEventListener('change', sync));
    $('txNoTin').addEventListener('change', sync);
    $('txCancel')?.addEventListener('click', () => loadTax(false));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!$('txOk').checked) { showToast('Please confirm that your details are correct.', 'error'); $('txOk').focus(); return; }
      const b = kind() === 'business', nt = !b && $('txNoTin').checked;
      const p = {
        kind: kind(), address: $('txAddr').value, postal_code: $('txZip').value, city: $('txCity').value, country: $('txCountry').value,
        vat_number: $('txVat').value, no_tin: nt,
        ...(b ? { business_name: $('txBizName').value, business_number: $('txBizNo').value } : { first_name: $('txFirst').value, last_name: $('txLast').value, birth_date: $('txBirth').value }),
        ...(nt ? { birth_place: $('txBirthPlace').value } : { tin: $('txTin').value, tin_country: $('txTinCountry').value || $('txCountry').value }),
      };
      const btn = $('txSave'); btn.disabled = true;
      const { error: err } = await CG.tax.save(p);
      btn.disabled = false;
      if (err) { showToast(err.message || 'Could not save your tax details.', 'error', 7000); return; }
      showToast('Tax details saved ✓', 'success');
      loadTax(false); taxReminder();
    });
  }

  async function goStripe(action, country) {
    const btn = $(action === 'dashboard' ? 'stripeDash' : 'stripeGo');
    if (btn) { btn.disabled = true; btn.textContent = 'Opening Stripe…'; }
    const { data, error } = await CG.pay.connect(action, country);
    if (error || !data?.url) {
      if (btn) btn.disabled = false;
      showToast(error?.message || 'Could not open Stripe.', 'error', 6000);
      loadPayments();
      return;
    }
    window.location.href = data.url;
  }

  /* ── BOOST ────────────────────────────────────────── */
  function loadBoost() {
    const box = $('boostBox');
    if (!listing) { box.innerHTML = '<div class="empty-state">Create your listing first.</div>'; return; }
    const until = listing.boosted_until && Date.parse(listing.boosted_until) > Date.now() ? new Date(listing.boosted_until) : null;
    const week = window.CG_CONFIG?.boostWeekEur ?? 9;
    const month = window.CG_CONFIG?.boostMonthEur ?? 24;
    box.innerHTML = `
      ${until ? `<p><strong class="ok">🚀 Boost active</strong> until ${fmtDate(until.toISOString())}. Buying more adds to it.</p>` : '<p>Appear at the top of search results and destination pages.</p>'}
      <div class="boost-plans">
        <button class="boost-plan" data-plan="week"><strong>7 days</strong><span>€${week}</span></button>
        <button class="boost-plan" data-plan="month"><strong>30 days</strong><span>€${month}</span><em>Best value</em></button>
      </div>
      <p class="form-note">Boosted listings are labelled "Sponsored", as EU consumer law requires. A boost changes your position, not your reviews or rating.</p>`;
    box.querySelectorAll('.boost-plan').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      const { data, error } = await CG.pay.boost(b.dataset.plan);
      if (error || !data?.url) { b.disabled = false; showToast(error?.message || 'Could not start payment.', 'error', 6000); return; }
      window.location.href = data.url;
    }));
  }

  /* ── SHARED WINDOW (photos, reviews) ──────────────── */
  let modalBeforeClose = null, modalOnClose = null, modalLastFocus = null;
  function openDashModal(html, { beforeClose = null, onClose = null } = {}) {
    const m = $('dashModal');
    $('dashModalBody').innerHTML = html;
    modalBeforeClose = beforeClose; modalOnClose = onClose;
    modalLastFocus = document.activeElement;
    m.classList.add('modal-open'); m.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => m.querySelector('.modal-close')?.focus(), 60);
  }
  function closeDashModal(force = false) {
    const m = $('dashModal');
    if (!m.classList.contains('modal-open')) return;
    if (!force && modalBeforeClose && modalBeforeClose() === false) return;
    m.classList.remove('modal-open'); m.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    $('dashModalBody').innerHTML = '';
    const cb = modalOnClose;
    modalBeforeClose = null; modalOnClose = null;
    if (cb) cb();
    if (modalLastFocus && modalLastFocus.isConnected && modalLastFocus.focus) modalLastFocus.focus();
  }
  $('dashModal').setAttribute('aria-hidden', 'true');
  document.querySelectorAll('[data-close="dashModal"]').forEach(el => el.addEventListener('click', () => closeDashModal()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('.lightbox')) closeDashModal();
  });

  /* ── BOOKING LINK CARD + QR (overview) ────────────── */
  const CLIENT_FEE = window.CG_CONFIG?.clientFeePercent ?? 10;
  const LINK_FEE = Math.min(window.CG_CONFIG?.creatorLinkFeePercent ?? 5, CLIENT_FEE);
  function drawQr(text, scale, margin = 2) {
    if (typeof window.qrcode !== 'function') return null;
    const qr = window.qrcode(0, 'M');
    qr.addData(text); qr.make();
    const n = qr.getModuleCount();
    const size = (n + margin * 2) * scale;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#211911';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect((k + margin) * scale, (r + margin) * scale, scale, scale);
    return c;
  }
  function renderLinkCard() {
    const body = $('linkCardBody'), qrBox = $('linkQr');
    if (!listing) return;
    if (!listing.handle) {
      qrBox.innerHTML = ''; qrBox.hidden = true;
      body.innerHTML = '<button type="button" class="primary-btn" id="linkPick">Choose my link</button>';
      $('linkPick').addEventListener('click', () => { showPanel('listing'); setTimeout(() => { $('elHandle').scrollIntoView({ block: 'center' }); $('elHandle').focus(); }, 350); });
      return;
    }
    const url = `${linkBase()}/c/${listing.handle}`;
    body.innerHTML = `
      <div class="link-url" id="linkUrl">${esc(url.replace(/^https?:\/\//, ''))}</div>
      <div class="link-actions">
        <button type="button" class="primary-btn" id="linkCopy">Copy link</button>
        ${navigator.share ? '<button type="button" class="secondary-btn" id="linkShare">Share</button>' : ''}
        <button type="button" class="secondary-btn" id="linkQrDl">Download QR code</button>
        <button type="button" class="secondary-btn" id="linkPrint">🖨 Printable card</button>
        <button type="button" class="secondary-btn" id="linkEmbed">&lt;/&gt; Button for your website</button>
      </div>
      ${LINK_FEE < CLIENT_FEE ? `<p class="muted small" style="margin:10px 0 0">Booked through your link, travellers pay a ${LINK_FEE}% service fee instead of ${CLIENT_FEE}%. You still keep 100%.</p>` : ''}`;
    const canvas = drawQr(url, 4);
    qrBox.innerHTML = '';
    if (canvas) { qrBox.appendChild(canvas); qrBox.hidden = false; } else qrBox.hidden = true;
    $('linkCopy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); showToast('Link copied ✓', 'success'); }
      catch { window.prompt('Copy your booking link:', url); }
    });
    $('linkShare')?.addEventListener('click', () => {
      navigator.share({ title: `Book ${listing.name} on CapturaGo`, text: `Book a photo shoot with ${listing.name}`, url }).catch(() => {});
    });
    $('linkPrint').addEventListener('click', () => downloadQrCard(url));
    $('linkEmbed').addEventListener('click', async () => {
      // A plain link styled as a button — no script, works on any website builder (Wix, Squarespace, WordPress…)
      const snippet = `<a href="${esc(url)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#B04722;color:#ffffff;font:600 15px/1.2 Arial,sans-serif;text-decoration:none">Book me on CapturaGo</a>`;
      try { await navigator.clipboard.writeText(snippet); showToast('Button code copied ✓ — paste it into your website as HTML.', 'success', 5000); }
      catch { window.prompt('Copy this code into your website (HTML block):', snippet); }
    });
    $('linkQrDl').addEventListener('click', () => {
      const big = drawQr(url, 16, 4);
      if (!big) { showToast('QR code is not available.', 'error'); return; }
      big.toBlob((blob) => { if (blob) downloadBlob(blob, `capturago-${listing.handle}-qr.png`); }, 'image/png');
    });
  }

  /* ── AVAILABILITY CALENDAR ────────────────────────── */
  const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let availState = null;
  async function loadAvailability() {
    const box = $('availBox');
    if (!listing) { box.innerHTML = '<div class="empty-state">Create your listing first.</div>'; availState = null; return; }
    if (availState && availState.dirty) return;   // keep unsaved changes when coming back to the panel
    box.innerHTML = '<p class="muted">Loading your calendar…</p>';
    const now = new Date();
    const today = isoOf(now);
    const max = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 365));
    const blocked = new Set((Array.isArray(listing.unavailable_dates) ? listing.unavailable_dates : []).filter(d => d >= today && d <= max));
    const [busy, sync] = await Promise.all([CG.photographers.busyDates(listing.id), CG.calendar.status()]);
    const ext = new Set(((sync.data && sync.data.busy_dates) || []).filter(d => typeof d === 'string'));
    const full = new Set(busy.filter(d => !blocked.has(d) && !ext.has(d)));
    const st = availState = { blocked, full, ext, dirty: false };
    const perDay = Math.min(Math.max(Number(listing.max_per_day) || 1, 1), 6);
    box.innerHTML = `
      <div class="dash-card deal-card" id="dealCard">
        <h3 style="margin:0 0 4px">⚡ Last-minute deals</h3>
        <p class="muted small" style="margin:0 0 12px">Free tomorrow or the day after? Lower your in-person prices for that day. Travellers who are in your city then get one email, and the deal shows on your profile.</p>
        <div id="dealBox"><p class="muted small">Loading…</p></div>
      </div>
      <div class="avail-layout">
        <div>
          <div class="calendar cal-block" id="availCal"></div>
          <div class="cal-legend"><span><i class="lg lg-off"></i> Day off</span><span><i class="lg lg-full"></i> Fully booked</span><span><i class="lg lg-ext"></i> Busy in your calendar</span><span><i class="lg lg-trip"></i> On a trip</span><span><i class="lg lg-free"></i> Bookable</span></div>
        </div>
        <div class="avail-side">
          <div class="dash-card avail-card">
            <p class="avail-sum" id="availSum"></p>
            <button type="button" class="link-btn" id="availClear">Clear all days off</button>
          </div>
          <div class="dash-card avail-card">
            <label for="availMax"><strong>Shoots per day</strong></label>
            <p class="muted small">When a day has this many bookings, it closes for new ones.</p>
            <select id="availMax">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${n === perDay ? 'selected' : ''}>${n} shoot${n > 1 ? 's' : ''} per day</option>`).join('')}</select>
          </div>
          <div class="dash-card avail-card">
            <div class="avail-toggle-row">
              <div><strong>⚡ Instant booking</strong><p class="muted small">Paid bookings on free days are confirmed automatically — travellers love not waiting. You can still cancel with a full refund if something comes up.</p></div>
              <label class="toggle-switch"><input type="checkbox" id="availInstant" ${listing.instant_book ? 'checked' : ''} aria-label="Instant booking" /><span class="toggle-track"></span></label>
            </div>
          </div>
          <button type="button" class="primary-btn" id="availSave" disabled>Save availability</button>
          <p class="muted small" id="availState" aria-live="polite"></p>
        </div>
      </div>
      <div class="avail-extra">
        <div class="dash-card avail-card" id="tripsCard">
          <h3 style="margin:0 0 4px">✈️ Trips</h3>
          <p class="muted small" style="margin:0 0 12px">Going somewhere? Travellers searching that city find you, and bookings on those days take place there. Days at home stay bookable as usual.</p>
          <ul class="trip-list" id="tripList"></ul>
          <form class="trip-form" id="tripForm" novalidate>
            <label class="trip-city">City <input type="text" id="tripCity" maxlength="80" placeholder="e.g. Lisbon, Portugal" autocomplete="off" /></label>
            <div class="trip-dates"><span class="trip-dates-label" id="tripDatesLabel">Dates</span><div id="tripDates" aria-labelledby="tripDatesLabel"></div>
              <input type="hidden" id="tripFrom" /><input type="hidden" id="tripTo" /></div>
            <button type="submit" class="secondary-btn" id="tripAdd">Add trip</button>
          </form>
        </div>
        <div class="dash-card avail-card" id="calSyncCard">
          <h3 style="margin:0 0 4px">📅 Sync your own calendar</h3>
          <div id="calSyncBox"></div>
        </div>
      </div>`;
    const paintSum = () => {
      const n = st.blocked.size;
      $('availSum').innerHTML = n ? `<strong>${n}</strong> day${n > 1 ? 's' : ''} off in the next 12 months.` : 'No days off — travellers can book any free day.';
      $('availClear').hidden = n === 0;
      $('availSave').disabled = !st.dirty;
      $('availState').textContent = st.dirty ? 'You have unsaved changes.' : '';
    };
    const touch = () => { st.dirty = true; paintSum(); };
    const cal = renderCalendar($('availCal'), {
      min: today, max, multi: true, selected: st.blocked,
      isOff: (iso) => st.full.has(iso) || st.ext.has(iso),
      onPick: (iso) => { if (st.blocked.has(iso)) st.blocked.delete(iso); else st.blocked.add(iso); touch(); },
      dayClass: (iso) => [st.ext.has(iso) ? 'ext' : '', tripOn(listing.trips, iso) ? 'trip' : ''].filter(Boolean).join(' '),
      dayLabel: (iso) => { const t = tripOn(listing.trips, iso); return [st.ext.has(iso) ? 'busy in your calendar' : '', t ? `trip to ${tripCity(t)}` : ''].filter(Boolean).join(', '); }
    });
    st.cal = cal;
    loadDeals();
    renderTrips(today);
    renderCalSync(sync.data, sync.error);
    $('availClear').addEventListener('click', () => { st.blocked.clear(); cal.redraw(); touch(); });
    $('availMax').addEventListener('change', touch);
    $('availInstant').addEventListener('change', touch);
    $('availSave').addEventListener('click', async () => {
      const btn = $('availSave');
      btn.disabled = true; btn.textContent = 'Saving…';
      const payload = {
        unavailable_dates: [...st.blocked].sort().slice(0, 400),
        max_per_day: Number($('availMax').value) || 1,
        instant_book: $('availInstant').checked
      };
      const { data, error } = await CG.photographers.update(listing.id, payload);
      btn.textContent = 'Save availability';
      if (error || !data) {
        btn.disabled = false;
        const m = (error && error.message) || '';
        showToast(['42703', 'PGRST204'].includes(error?.code) || /unavailable_dates|max_per_day|instant_book/.test(m) ? 'Availability needs the latest database update (database.sql).' : 'Could not save: ' + (m || 'please try again.'), 'error', 7000);
        return;
      }
      listing = { ...data, email: listing.email };
      st.dirty = false; paintSum();
      showToast(payload.instant_book ? 'Saved ✓ — instant booking is on.' : 'Availability saved ✓', 'success');
    });
    paintSum();
  }

  /* ── ✈️ Trips: "I'm in Lisbon 3–10 Nov" (saved straight away; the database checks booked shoots) ── */
  // Trips kept when saving: everything from yesterday on (so a time-zone difference never drops a trip with a shoot today)
  let tripPicker = null;
  const keptTrips = () => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const from = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    return (Array.isArray(listing.trips) ? listing.trips : []).filter((t) => t && typeof t.to === 'string' && t.to >= from);
  };
  function renderTrips(today) {
    const list = upcomingTrips(listing.trips);
    $('tripList').innerHTML = list.length ? list.map((t, i) => `
      <li><span><strong>${esc(t.city)}</strong> · ${esc(tripDates(t))}</span>
        <button type="button" class="link-btn danger-link" data-trip="${i}">Remove</button></li>`).join('')
      : '<li class="muted small">No trips planned.</li>';
    $('tripList').querySelectorAll('[data-trip]').forEach((b) => b.addEventListener('click', async () => {
      const t = list[Number(b.dataset.trip)];
      if (!t || !confirm(`Remove your trip to ${tripCity(t)} (${tripDates(t)})?`)) return;
      await saveTrips(keptTrips().filter((x) => !(x.from === t.from && x.to === t.to && x.city === t.city)), `Trip to ${tripCity(t)} removed.`);
    }));
    const form = $('tripForm');
    if (form.dataset.ready) return;
    form.dataset.ready = '1';
    const inYear = () => { const d = new Date(); d.setDate(d.getDate() + 365); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    tripPicker = createDateRange($('tripDates'), { fromId: 'tripFrom', toId: 'tripTo', min: todayIso, max: inYear, maxDays: TRIP_MAX_DAYS, placeholder: 'Choose the dates of your trip', label: 'Trip dates',
      firstHint: 'When do you arrive?', secondHint: 'And when do you leave?' });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const city = $('tripCity').value.replace(/\s+/g, ' ').trim();
      const trip = { city, from: $('tripFrom').value, to: $('tripTo').value || $('tripFrom').value };
      if (!trip.from) { showToast('Choose the dates of your trip.', 'error'); tripPicker.open(); return; }
      if (trip.from < todayIso()) { showToast('Choose dates from today on.', 'error'); return; }
      const next = [...keptTrips(), trip];
      const problem = tripsProblem(next);
      if (problem) { showToast(problem, 'error', 6000); return; }
      const btn = $('tripAdd'); btn.disabled = true; btn.textContent = 'Finding the city…';
      const c = await CG.geo.geocode(city);
      if (c && Number.isFinite(c[0]) && Number.isFinite(c[1])) { trip.lat = Math.round(c[0] * 1e4) / 1e4; trip.lon = Math.round(c[1] * 1e4) / 1e4; }
      btn.textContent = 'Saving…';
      const ok = await saveTrips(next, `Trip to ${tripCity(trip)} added ✓ — travellers searching ${tripCity(trip)} will find you.`);
      btn.disabled = false; btn.textContent = 'Add trip';
      if (ok) { $('tripCity').value = ''; tripPicker.set('', ''); }
    });
  }
  async function saveTrips(trips, okText) {
    const clean = trips.map(({ city, from, to, lat, lon }) => ({ city, from, to, ...(lat !== undefined && lon !== undefined ? { lat, lon } : {}) }));
    const { data, error } = await CG.photographers.update(listing.id, { trips: clean });
    if (error || !data) {
      const m = (error && error.message) || '';
      showToast(/trips/.test(m) && /column|schema/i.test(m) ? 'Trips need the latest database update (database.sql).' : /shoot/.test(m) ? m : 'Could not save your trips: ' + (m || 'please try again.'), 'error', 8000);
      return false;
    }
    listing = { ...data, email: listing.email };
    renderTrips(todayIso());
    if (availState && availState.cal) availState.cal.redraw();
    showToast(okText, 'success', 5000);
    return true;
  }

  /* ── 📅 Sync your own calendar: busy days from Google / Apple / Outlook block bookings here ── */
  function renderCalSync(info, error) {
    const box = $('calSyncBox');
    if (error) { box.innerHTML = '<p class="muted small">Calendar sync needs the latest database update (database.sql).</p>'; return; }
    const imp = info && info.import;
    const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
    if (!imp) {
      box.innerHTML = `
        <p class="muted small" style="margin:0 0 10px">Paste the private iCal link of your Google, Apple (iCloud), Outlook, Proton or Fastmail calendar. All-day events and events of 3 hours or more block that day on CapturaGo — we only read the dates, never the titles.</p>
        <form id="calSyncForm" class="cal-sync-form" novalidate>
          <input type="url" id="calSyncUrl" maxlength="1000" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" aria-label="Your calendar's private iCal link" autocomplete="off" />
          <button type="submit" class="secondary-btn" id="calSyncConnect">Connect</button>
        </form>
        <details class="cal-help"><summary>Where do I find this link?</summary>
          <p><strong>Google Calendar</strong> (computer): Settings → your calendar → Integrate calendar → <em>Secret address in iCal format</em>.</p>
          <p><strong>Apple iCloud</strong>: Calendar app → share icon next to the calendar → <em>Public Calendar</em> → Copy link (starts with webcal://).</p>
          <p><strong>Outlook</strong>: Settings → Calendar → Shared calendars → <em>Publish a calendar</em> → ICS link.</p>
        </details>`;
      $('calSyncForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = $('calSyncUrl').value.trim();
        if (!calendarUrlOk(url)) { showToast('Paste the secret iCal link from Google Calendar, Apple iCloud, Outlook, Proton or Fastmail (it starts with https:// or webcal://).', 'error', 7000); return; }
        const btn = $('calSyncConnect'); btn.disabled = true; btn.textContent = 'Connecting…';
        const { error: err } = await CG.calendar.connect(url);
        if (err) { btn.disabled = false; btn.textContent = 'Connect'; showToast(err.message || 'Could not connect your calendar.', 'error', 7000); return; }
        btn.textContent = 'Reading your calendar…';
        await CG.calendar.syncNow();
        await refreshCalSync(true);
      });
      return;
    }
    box.innerHTML = `
      <p class="cal-sync-status">${imp.last_error ? '⚠️' : '✅'} Connected to <strong>${esc(imp.host)}</strong>${imp.last_synced_at ? ` · read ${esc(ago(imp.last_synced_at))}` : ' · reading soon'}</p>
      ${imp.last_error ? `<p class="small bad" role="alert">${esc(imp.last_error)}</p>` : `<p class="muted small">${Number(imp.busy_count) || 0} busy day${Number(imp.busy_count) === 1 ? '' : 's'} in the next 12 months block bookings. We check your calendar every 3 hours.</p>`}
      <div class="cal-feed-actions"><button type="button" class="secondary-btn" id="calSyncNow">Sync now</button>
        <button type="button" class="link-btn danger-link" id="calSyncOff">Disconnect</button></div>`;
    $('calSyncNow').addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = 'Reading your calendar…';
      const { error: err } = await CG.calendar.syncNow();
      if (err) { e.target.disabled = false; e.target.textContent = 'Sync now'; showToast(err.message || 'Could not sync right now.', err.status === 429 ? 'info' : 'error', 6000); return; }
      await refreshCalSync(true);
    });
    $('calSyncOff').addEventListener('click', async () => {
      if (!confirm('Disconnect your calendar? Days blocked by it become bookable again.')) return;
      const { error: err } = await CG.calendar.disconnect();
      if (err) { showToast('Could not disconnect. Please try again.', 'error'); return; }
      showToast('Calendar disconnected.', 'success');
      await refreshCalSync(false);
    });
  }
  async function refreshCalSync(announce) {
    const { data, error } = await CG.calendar.status();
    if (availState) {
      availState.ext = new Set(((data && data.busy_dates) || []).filter(d => typeof d === 'string'));
      availState.full.forEach((d) => { if (availState.ext.has(d)) availState.full.delete(d); });
      if (availState.cal) availState.cal.redraw();
    }
    renderCalSync(data, error);
    const imp = data && data.import;
    if (announce && imp) showToast(imp.last_error ? imp.last_error : `Calendar connected ✓ — ${Number(imp.busy_count) || 0} busy day${Number(imp.busy_count) === 1 ? '' : 's'} found.`, imp.last_error ? 'error' : 'success', 6000);
  }

  /* ── PHOTO DELIVERY: creator uploads ──────────────── */
  const MAX_BOOKING_PHOTOS = 300;
  const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'your client';
  async function openPhotoManager(b) {
    const remote = isRemote(b);
    const canAdd = PHOTO_STATUSES.includes(b.status);
    const removable = ['confirmed', 'delivered'].includes(b.status) || (b.status === 'completed' && b.completed_at && Date.now() - Date.parse(b.completed_at) < 30 * 86400000);
    const st = { photos: [], thumbs: {}, busy: false, closed: false, seen: new Set() };
    openDashModal(`
      <h2 id="dashModalTitle" class="pm-title">📷 ${remote ? 'Deliver' : 'Photos for'} ${esc(b.client_name || 'your client')}</h2>
      <p class="muted small pm-sub"><span translate="no">${esc(b.package_name)}</span> · ${fmtDate(b.shoot_date)}. Only you and ${esc(firstName(b.client_name))} can see these photos. Full resolution up to 3000 px; they're kept for 90 days after the booking is completed.</p>
      ${canAdd ? `<label class="pm-drop" id="pmDrop">
          <input type="file" id="pmInput" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden />
          <span class="pm-drop-icon" aria-hidden="true">⬆</span>
          <strong>Add photos</strong>
          <span class="muted small">Click or drop them here · JPG, PNG or WebP · up to ${MAX_BOOKING_PHOTOS}</span>
        </label>` : ''}
      <div class="pm-progress" id="pmProgress" hidden><div class="pm-bar"><i id="pmBar"></i></div><span id="pmProgText" class="small"></span></div>
      <div class="pm-head"><strong id="pmCount">Loading…</strong></div>
      <div class="pm-grid" id="pmGrid"></div>
      <div class="pm-foot" id="pmFoot"></div>`, {
      beforeClose: () => !st.busy || confirm('Photos are still uploading. Stop uploading and close?'),
      onClose: () => { st.closed = true; Object.values(st.thumbs).forEach(u => { if (String(u).startsWith('blob:')) URL.revokeObjectURL(u); }); loadBookings(); }
    });

    const grid = $('pmGrid');
    function paintGrid() {
      if (st.closed) return;
      $('pmCount').textContent = st.photos.length ? `${st.photos.length} photo${st.photos.length > 1 ? 's' : ''}` : 'No photos yet';
      grid.innerHTML = st.photos.map((p, i) => `
        <div class="pm-item${st.seen.has(p.id) ? '' : ' pm-new'}">
          <button type="button" class="pm-open" data-i="${i}" aria-label="View photo ${i + 1}">${st.thumbs[p.path] ? `<img src="${esc(st.thumbs[p.path])}" alt="" loading="lazy" />` : '<span class="pm-ph"></span>'}</button>
          ${p.favorite ? '<span class="pm-fav" title="Client favourite">♥</span>' : ''}
          ${removable ? `<button type="button" class="pm-del" data-id="${esc(p.id)}" aria-label="Remove photo ${i + 1}">✕</button>` : ''}
        </div>`).join('');
      st.photos.forEach(p => { if (st.thumbs[p.path]) st.seen.add(p.id); });
      paintFoot();
    }
    function paintFoot() {
      const foot = $('pmFoot'); if (!foot) return;
      const n = st.photos.length;
      if (remote) {
        if (b.status === 'confirmed') {
          foot.innerHTML = `
            <label for="pmLink" class="small"><strong>Link to the files</strong> <span class="muted">(optional — e.g. videos or RAW files on Google Drive, Dropbox, WeTransfer)</span></label>
            <input type="url" id="pmLink" placeholder="https://" value="${esc(b.delivery_url || '')}" />
            <div class="pm-actions"><button type="button" class="primary-btn" id="pmDeliver">✅ Deliver to ${esc(firstName(b.client_name))}</button></div>
            <p class="muted small">The client gets an email, can approve the delivery${(b.revisions_allowed || 0) - (b.revisions_used || 0) > 0 ? ' or ask for a revision' : ''}. The payment is released when they approve, or 3 days after delivery.</p>`;
          $('pmDeliver').addEventListener('click', deliverRemote);
        } else {
          foot.innerHTML = `<p class="muted small">${b.status === 'delivered' ? 'Delivered — the client is reviewing it.' : 'This order is completed.'}${removable ? ' You can still fix mistakes in the photos.' : ''}</p>`;
        }
        return;
      }
      const notified = b.photos_ready_at ? `Client notified ${fmtDate(b.photos_ready_at)}.` : '';
      foot.innerHTML = `
        <div class="pm-actions"><button type="button" class="primary-btn" id="pmSend" ${n ? '' : 'disabled'}>📨 ${b.photos_ready_at ? 'Notify again' : `Send to ${esc(firstName(b.client_name))}`}</button></div>
        <p class="muted small">${notified || 'When you\'re done uploading, send the gallery — the client gets an email with a link to view and download their photos.'}</p>`;
      $('pmSend').addEventListener('click', sendReady);
    }
    async function sendReady() {
      const btn = $('pmSend'); if (!btn || st.busy) return;
      btn.disabled = true; btn.textContent = 'Sending…';
      const { data, error } = await CG.bookings.action(b.id, 'photos_ready', {});
      if (error) { showToast(error.message || 'Could not notify the client.', 'error', 6000); paintFoot(); return; }
      b.photos_ready_at = data?.booking?.photos_ready_at || new Date().toISOString();
      showToast(`Sent ✓ — ${firstName(b.client_name)} got an email with the gallery link.`, 'success', 5000);
      paintFoot();
    }
    async function deliverRemote() {
      if (st.busy) return;
      const link = ($('pmLink').value || '').trim();
      if (link && !/^https:\/\/\S+$/i.test(link)) { showToast('The link must start with https://', 'error'); $('pmLink').focus(); return; }
      if (!link && !st.photos.length) { showToast('Upload the finished photos, or add a link to the files.', 'error', 5000); return; }
      if (!confirm(`Deliver "${b.package_name}" to ${firstName(b.client_name)} now?`)) return;
      const btn = $('pmDeliver'); btn.disabled = true; btn.textContent = 'Delivering…';
      const { data, error } = await CG.bookings.action(b.id, 'deliver', link ? { delivery_url: link } : {});
      if (error) { btn.disabled = false; btn.textContent = `✅ Deliver to ${firstName(b.client_name)}`; showToast(error.message || 'Something went wrong.', 'error', 6000); return; }
      Object.assign(b, data?.booking || { status: 'delivered' });
      showToast('Delivered ✓ — the client has been notified.', 'success', 5000);
      refreshBookingBadge();
      closeDashModal(true);
    }

    async function addFiles(fileList) {
      if (st.busy || !canAdd) return;
      const files = [...fileList].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
      if (!files.length) { showToast('Please choose photos (JPG, PNG or WebP).', 'error'); return; }
      const room = MAX_BOOKING_PHOTOS - st.photos.length;
      if (room <= 0) { showToast(`Up to ${MAX_BOOKING_PHOTOS} photos per booking.`, 'info'); return; }
      const todo = files.slice(0, room);
      if (files.length > room) showToast(`Only ${room} more photo${room > 1 ? 's' : ''} fit (max ${MAX_BOOKING_PHOTOS}).`, 'info', 5000);
      st.busy = true;
      let done = 0, failed = 0, lastErr = '', next = 0;
      $('pmProgress').hidden = false;
      const paintProgress = () => {
        if (st.closed) return;
        $('pmBar').style.width = `${Math.round((done / todo.length) * 100)}%`;
        $('pmProgText').textContent = done < todo.length ? `Uploading ${done + 1} of ${todo.length}…` : `Uploaded ${todo.length - failed} of ${todo.length}`;
      };
      paintProgress();
      const worker = async () => {
        while (next < todo.length && !st.closed) {
          const f = todo[next++];
          try {
            const full = await resizeImage(f, 3000, 0.9);
            const small = await resizeImage(full.blob, 600, 0.8);
            const r = await CG.deliveries.upload(b.id, full.blob, small.blob, { w: full.w, h: full.h });
            if (r.error || !r.data) throw new Error(r.error?.message || 'Upload failed.');
            st.thumbs[r.data.path] = URL.createObjectURL(small.blob);
            st.photos.push(r.data);
            paintGrid();
          } catch (err) { failed++; lastErr = err?.message || ''; console.warn('[photos]', err); }
          done++; paintProgress();
        }
      };
      await Promise.all([worker(), worker()]);
      st.busy = false;
      if (st.closed) return;
      setTimeout(() => { if (!st.busy && $('pmProgress')) $('pmProgress').hidden = true; }, 2500);
      if (failed) {
        const why = /row-level|policy|permission/i.test(lastErr) ? 'This booking can no longer receive photos.' : /limit|300/i.test(lastErr) ? `Up to ${MAX_BOOKING_PHOTOS} photos per booking.` : /large|size|exceed/i.test(lastErr) ? 'A photo is too large.' : 'Please check your connection and use JPG, PNG or WebP.';
        showToast(`${failed} photo${failed > 1 ? 's' : ''} couldn't be uploaded. ${why}`, 'error', 7000);
      } else {
        showToast(`${todo.length} photo${todo.length > 1 ? 's' : ''} uploaded ✓${!remote && !b.photos_ready_at ? ' — send them when you\'re ready.' : ''}`, 'success', 5000);
      }
      photoCounts[b.id] = st.photos.length;
    }

    if (canAdd) {
      $('pmInput').addEventListener('change', (e) => { const fl = [...e.target.files]; e.target.value = ''; addFiles(fl); });
      const drop = $('pmDrop');
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
    }
    grid.addEventListener('click', async (e) => {
      const del = e.target.closest('.pm-del');
      if (del) {
        const p = st.photos.find(x => x.id === del.dataset.id);
        if (!p || st.busy) return;
        del.disabled = true;
        const { error } = await CG.deliveries.remove(p);
        if (error) { del.disabled = false; showToast(error.message || 'Could not remove the photo.', 'error'); return; }
        st.photos = st.photos.filter(x => x.id !== p.id);
        photoCounts[b.id] = st.photos.length;
        paintGrid();
        return;
      }
      const open = e.target.closest('.pm-open');
      if (open) {
        const urls = await CG.deliveries.signedUrls(st.photos.map(p => p.path), 3600);
        const items = st.photos.map((p, i) => ({ src: urls[p.path] || st.thumbs[p.path], caption: `${i + 1} of ${st.photos.length}${p.favorite ? ' · ♥ client favourite' : ''}` })).filter(x => x.src);
        if (items.length) openLightbox(items, Number(open.dataset.i));
      }
    });

    // Load what's already uploaded
    const { data, error } = await CG.deliveries.list(b.id);
    if (st.closed) return;
    if (error) { $('pmCount').textContent = 'Could not load the photos. Please try again.'; return; }
    st.photos = [...(data || []), ...st.photos.filter(p => !(data || []).some(d => d.id === p.id))];
    const thumbs = await CG.deliveries.signedUrls(st.photos.map(p => CG.deliveries.thumbPath(p.path)), 3600);
    st.photos.forEach(p => { if (!st.thumbs[p.path]) st.thumbs[p.path] = thumbs[CG.deliveries.thumbPath(p.path)] || null; });
    const missing = st.photos.filter(p => !st.thumbs[p.path]).map(p => p.path);
    if (missing.length) { const fulls = await CG.deliveries.signedUrls(missing, 3600); missing.forEach(path => { st.thumbs[path] = fulls[path] || null; }); }
    paintGrid();
  }

  /* ── PHOTO DELIVERY: client gallery ───────────────── */
  async function openClientGallery(b) {
    const st = { photos: [], thumbs: {}, fulls: {}, filter: 'all', busy: false, closed: false, seen: new Set() };
    const creator = b.photographers?.name || 'your creator';
    const baseName = slugify(`${b.package_name || 'capturago'}-${b.shoot_date || ''}`) || 'capturago-photos';
    openDashModal(`
      <h2 id="dashModalTitle" class="pm-title">📸 Your photos</h2>
      <p class="muted small pm-sub"><span translate="no">${esc(b.package_name)}</span> with <span translate="no">${esc(creator)}</span> · ${fmtDate(b.shoot_date)}</p>
      <div class="cg-bar">
        <div class="cg-seg" role="tablist" aria-label="Show">
          <button type="button" role="tab" data-f="all" class="on" aria-selected="true">All</button>
          <button type="button" role="tab" data-f="fav" aria-selected="false">♥ Favourites</button>
        </div>
        <button type="button" class="primary-btn" id="cgZip" disabled>⬇ Download all</button>
      </div>
      <div class="cg-tools">
        <button type="button" class="secondary-btn" id="cgPlay" disabled>▶ Slideshow</button>
        <button type="button" class="secondary-btn" id="cgShare" disabled>🔗 Share with friends</button>
      </div>
      <div class="cg-share" id="cgShareBox" hidden></div>
      <div class="pm-progress" id="cgProgress" hidden><div class="pm-bar"><i id="cgBar"></i></div><span id="cgProgText" class="small"></span></div>
      ${b.delivery_url && safeUrl(b.delivery_url) ? `<p class="small">📁 More files from ${esc(creator)}: <a href="${esc(safeUrl(b.delivery_url))}" target="_blank" rel="noopener nofollow">${esc(b.delivery_url)}</a></p>` : ''}
      <div class="pm-grid" id="cgGrid"><p class="muted">Loading your photos…</p></div>
      <p class="muted small" id="cgNote" style="margin-top:14px"></p>`, {
      beforeClose: () => !st.busy || confirm('Your download is still being prepared. Stop and close?'),
      onClose: () => { st.closed = true; }
    });
    const view = () => st.filter === 'fav' ? st.photos.filter(p => p.favorite) : st.photos;
    const fileName = (p) => `${baseName}-${String(st.photos.indexOf(p) + 1).padStart(3, '0')}.jpg`;
    function paint() {
      if (st.closed) return;
      const list = view();
      const favs = st.photos.filter(p => p.favorite).length;
      const segs = $('dashModalBody').querySelectorAll('.cg-seg button');
      segs[0].textContent = `All (${st.photos.length})`;
      segs[1].textContent = `♥ Favourites (${favs})`;
      $('cgZip').disabled = st.busy || !list.length;
      if (!st.busy) $('cgZip').textContent = st.filter === 'fav' ? `⬇ Download favourites (${list.length})` : `⬇ Download all (${list.length})`;
      $('cgGrid').innerHTML = list.length ? list.map((p, i) => `
        <div class="pm-item${st.seen.has(p.id) ? '' : ' pm-new'}">
          <button type="button" class="pm-open" data-i="${i}" aria-label="View photo ${st.photos.indexOf(p) + 1}">${st.thumbs[p.path] ? `<img src="${esc(st.thumbs[p.path])}" alt="" loading="lazy" />` : '<span class="pm-ph"></span>'}</button>
          <button type="button" class="pm-heart ${p.favorite ? 'on' : ''}" data-id="${esc(p.id)}" aria-pressed="${p.favorite ? 'true' : 'false'}" aria-label="Favourite">${p.favorite ? '♥' : '♡'}</button>
        </div>`).join('') : `<p class="muted">${st.filter === 'fav' ? 'Tap ♡ on the photos you love — they appear here.' : 'No photos yet.'}</p>`;
      list.forEach(p => st.seen.add(p.id));
    }
    async function setFavorite(p, on) {
      const prev = p.favorite;
      p.favorite = on; paint();
      const { error } = await CG.deliveries.favorite(p.id, on);
      if (error) { p.favorite = prev; paint(); showToast('Could not save your favourite.', 'error'); return false; }
      return true;
    }
    async function fetchBlob(p) {
      let url = st.fulls[p.path];
      let r = url ? await fetch(url).catch(() => null) : null;
      if (!r || !r.ok) {   // the link may have expired — get a fresh one
        const fresh = await CG.deliveries.signedUrls([p.path], 10800);
        url = st.fulls[p.path] = fresh[p.path];
        r = url ? await fetch(url).catch(() => null) : null;
      }
      if (!r || !r.ok) throw new Error('download failed');
      return r.blob();
    }
    async function downloadOne(p) {
      try { downloadBlob(await fetchBlob(p), fileName(p)); }
      catch { showToast('Could not download this photo. Please try again.', 'error'); }
    }
    $('dashModalBody').querySelectorAll('.cg-seg button').forEach(btn => btn.addEventListener('click', () => {
      st.filter = btn.dataset.f;
      $('dashModalBody').querySelectorAll('.cg-seg button').forEach(x => { x.classList.toggle('on', x === btn); x.setAttribute('aria-selected', x === btn ? 'true' : 'false'); });
      paint();
    }));
    $('cgGrid').addEventListener('click', (e) => {
      const heart = e.target.closest('.pm-heart');
      if (heart) { const p = st.photos.find(x => x.id === heart.dataset.id); if (p) setFavorite(p, !p.favorite); return; }
      const open = e.target.closest('.pm-open');
      if (!open) return;
      const list = view();
      const items = list.map(p => ({ src: st.fulls[p.path] || st.thumbs[p.path], favorite: !!p.favorite, caption: `${st.photos.indexOf(p) + 1} of ${st.photos.length}` }));
      openViewer(list, Number(open.dataset.i), false);
    });
    function openViewer(list, start, autoplay) {
      const items = list.map(p => ({ src: st.fulls[p.path] || st.thumbs[p.path], favorite: !!p.favorite, caption: `${st.photos.indexOf(p) + 1} of ${st.photos.length}` }));
      openLightbox(items, start, {
        slideshow: true, autoplay,
        onFavorite: async (i, on) => { const p = list[i]; return p ? setFavorite(p, on) : false; },
        onDownload: (i) => { const p = list[i]; if (p) downloadOne(p); },
        onClose: () => paint()
      });
    }
    $('cgPlay').addEventListener('click', () => { const list = view(); if (list.length) openViewer(list, 0, true); });

    // ── Share with friends: a view-only link that expires (no sign-in needed to look)
    const shareUrl = (token) => `${location.origin}/share.html#t=${token}`;
    async function paintShares() {
      const box = $('cgShareBox'); if (!box || st.closed) return;
      const { data, error } = await CG.shares.list(b.id);
      if (st.closed) return;
      const active = (data || []).filter(x => Date.parse(x.expires_at) > Date.now());
      box.innerHTML = `
        <p class="small" style="margin:0 0 10px">Friends and family can <strong>look</strong> at the photos with this link — no account needed. They can't see your name or email, and the link stops working when it expires.</p>
        <div class="cg-share-new">
          <label class="small">Works for
            <select id="shDays"><option value="1">1 day</option><option value="7" selected>7 days</option><option value="30">30 days</option></select></label>
          <label class="small cg-check"><input type="checkbox" id="shFav" /> Only my favourites</label>
          <button type="button" class="primary-btn" id="shCreate">Create link</button>
        </div>
        ${error ? '<p class="muted small">Share links need the latest database update.</p>' : ''}
        <ul class="cg-share-list">${active.map(x => `
          <li>
            <input type="text" readonly value="${esc(shareUrl(x.token))}" aria-label="Share link" />
            <button type="button" class="secondary-btn sh-copy" data-t="${esc(x.token)}">Copy</button>
            <button type="button" class="link-btn danger-link sh-off" data-t="${esc(x.token)}">Turn off</button>
            <span class="muted small">${x.favorites_only ? '♥ favourites · ' : ''}until ${fmtDate(x.expires_at)} · ${x.views} view${x.views === 1 ? '' : 's'}</span>
          </li>`).join('')}</ul>`;
      $('shCreate').addEventListener('click', async () => {
        const btn = $('shCreate'); btn.disabled = true;
        const res = await CG.shares.create(b.id, Number($('shDays').value), $('shFav').checked);
        btn.disabled = false;
        if (res.error || !res.data) { showToast(res.error?.message || 'Could not create the link.', 'error', 6000); return; }
        try { await navigator.clipboard.writeText(shareUrl(res.data)); showToast('Link created and copied ✓', 'success'); } catch { showToast('Link created ✓', 'success'); }
        paintShares();
      });
      box.querySelectorAll('.sh-copy').forEach(btn => btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(shareUrl(btn.dataset.t)); showToast('Link copied ✓', 'success'); }
        catch { window.prompt('Copy this link:', shareUrl(btn.dataset.t)); }
      }));
      box.querySelectorAll('.sh-off').forEach(btn => btn.addEventListener('click', async () => {
        btn.disabled = true;
        const { error: e } = await CG.shares.remove(btn.dataset.t);
        if (e) { btn.disabled = false; showToast('Could not turn the link off.', 'error'); return; }
        showToast('Link turned off.', 'info');
        paintShares();
      }));
    }
    $('cgShare').addEventListener('click', () => {
      const box = $('cgShareBox');
      box.hidden = !box.hidden;
      if (!box.hidden) { box.innerHTML = '<p class="muted small">Loading…</p>'; paintShares(); }
    });
    $('cgZip').addEventListener('click', async () => {
      const list = view();
      if (!list.length || st.busy) return;
      if (!window.fflate || !window.fflate.zipSync) { showToast('Download is not available in this browser.', 'error'); return; }
      st.busy = true; $('cgZip').disabled = true; $('cgZip').textContent = 'Preparing…';
      $('cgProgress').hidden = false;
      const PART = 60;   // keeps each ZIP small enough for phones
      const parts = Math.ceil(list.length / PART);
      let done = 0, failed = 0;
      try {
        for (let part = 0; part < parts && !st.closed; part++) {
          const files = {};
          for (const p of list.slice(part * PART, (part + 1) * PART)) {
            if (st.closed) break;
            try { files[fileName(p)] = new Uint8Array(await (await fetchBlob(p)).arrayBuffer()); }
            catch { failed++; }
            done++;
            $('cgBar').style.width = `${Math.round((done / list.length) * 100)}%`;
            $('cgProgText').textContent = `Preparing ${done} of ${list.length}…`;
          }
          if (st.closed || !Object.keys(files).length) continue;
          const zipped = window.fflate.zipSync(files, { level: 0 });   // JPEGs are already compressed
          downloadBlob(new Blob([zipped], { type: 'application/zip' }), parts > 1 ? `${baseName}-part-${part + 1}-of-${parts}.zip` : `${baseName}.zip`);
        }
        if (!st.closed) {
          $('cgProgText').textContent = failed ? `Done — ${failed} photo${failed > 1 ? 's' : ''} couldn't be downloaded.` : `Done ✓ ${parts > 1 ? `${parts} ZIP files` : 'Saved as a ZIP file'}.`;
          if (failed) showToast(`${failed} photo${failed > 1 ? 's' : ''} couldn't be downloaded. Please try again.`, 'error', 6000);
        }
      } finally {
        st.busy = false;
        if (!st.closed) paint();
      }
    });

    const { data, error } = await CG.deliveries.list(b.id);
    if (st.closed) return;
    if (error) { $('cgGrid').innerHTML = '<p class="muted">Could not load your photos. Please try again.</p>'; return; }
    st.photos = data || [];
    const paths = st.photos.map(p => p.path);
    const [thumbs, fulls] = await Promise.all([
      CG.deliveries.signedUrls(paths.map(p => CG.deliveries.thumbPath(p)), 10800),
      CG.deliveries.signedUrls(paths, 10800)
    ]);
    st.photos.forEach(p => { st.thumbs[p.path] = thumbs[CG.deliveries.thumbPath(p.path)] || fulls[p.path] || null; st.fulls[p.path] = fulls[p.path] || null; });
    const until = b.completed_at ? new Date(Date.parse(b.completed_at) + 90 * 86400000) : null;
    $('cgNote').textContent = until
      ? `🔒 Private gallery — only you, ${creator} and anyone you send a share link to can see it. Available until ${fmtDate(until.toISOString())}; please download your photos before then.`
      : `🔒 Private gallery — only you, ${creator} and anyone you send a share link to can see it. It's kept for 90 days after the booking is completed.`;
    paint();
    $('cgPlay').disabled = st.photos.length < 2;
    $('cgShare').disabled = !st.photos.length;
    // The first time the photos open, they're revealed as a slideshow
    const revealKey = `cg_revealed_${b.id}`;
    let seenBefore = true;
    try { seenBefore = !!localStorage.getItem(revealKey); localStorage.setItem(revealKey, '1'); } catch {}
    if (!seenBefore && st.photos.length > 1 && !st.closed) openViewer(st.photos, 0, true);
  }

  /* ── VERIFIED REVIEW (client, after a completed booking) ── */
  function openReview(b) {
    const creator = b.photographers?.name || 'your creator';
    const LABELS = ['', 'Poor', 'Could be better', 'Good', 'Great', 'Amazing'];
    let rating = 0;
    openDashModal(`
      <h2 id="dashModalTitle" class="pm-title">How was your shoot with ${esc(creator)}?</h2>
      <p class="muted small pm-sub">Your review appears on their profile as a <strong>✓ Verified booking</strong>, under the name ${esc(b.client_name || 'you')}.</p>
      <form id="rvForm" class="rv-form">
        <div class="rv-stars" role="radiogroup" aria-label="Your rating">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="rv-star" data-n="${n}" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
          <span class="rv-label muted small" id="rvLabel">Tap to rate</span>
        </div>
        <label for="rvText" class="small"><strong>Tell other travellers about it</strong> <span class="muted">(optional)</span></label>
        <textarea id="rvText" rows="4" maxlength="1000" placeholder="What made it special? Would you book them again?"></textarea>
        <div class="char-counter"><span id="rvCount">0</span>/1000</div>
        <div class="rv-photos" id="rvPhotos" hidden>
          <strong class="small">Add up to 3 of your photos <span class="muted">(optional)</span></strong>
          <p class="muted small" style="margin:2px 0 8px">They're shown publicly with your review. The first one you pick is your favourite — it's also shown on the creator's profile.</p>
          <div class="rv-photo-grid" id="rvPhotoGrid"></div>
        </div>
        <button type="submit" class="primary-btn" id="rvSend">Publish review</button>
      </form>`);
    // Photos from this booking's private gallery that the traveller can attach (copied to public storage only if chosen)
    const pick = { photos: [], thumbs: {}, chosen: [] };
    if ((photoCounts[b.id] || 0) > 0 && clientSeesPhotos(b)) {
      CG.deliveries.list(b.id).then(async ({ data }) => {
        const list = (data || []).slice().sort((x, y) => Number(y.favorite) - Number(x.favorite)).slice(0, 24);
        if (!list.length || !$('rvPhotoGrid')) return;
        const thumbs = await CG.deliveries.signedUrls(list.map(p => CG.deliveries.thumbPath(p.path)), 3600);
        if (!$('rvPhotoGrid')) return;
        pick.photos = list;
        list.forEach(p => { pick.thumbs[p.path] = thumbs[CG.deliveries.thumbPath(p.path)] || ''; });
        $('rvPhotos').hidden = false;
        const paintPick = () => {
          $('rvPhotoGrid').innerHTML = pick.photos.map((p) => {
            const n = pick.chosen.indexOf(p.id);
            return `<button type="button" class="rv-pick${n >= 0 ? ' on' : ''}${n === 0 ? ' fav' : ''}" data-id="${esc(p.id)}" aria-pressed="${n >= 0}" aria-label="${n >= 0 ? 'Remove photo from review' : 'Add photo to review'}">${pick.thumbs[p.path] ? `<img src="${esc(pick.thumbs[p.path])}" alt="" loading="lazy" />` : ''}${n === 0 ? '<span title="Your favourite — shown on the profile">★</span>' : n > 0 ? `<span>${n + 1}</span>` : ''}${p.favorite ? '<i>♥</i>' : ''}</button>`;
          }).join('');
        };
        $('rvPhotoGrid').addEventListener('click', (e) => {
          const btn = e.target.closest('.rv-pick'); if (!btn) return;
          const id = btn.dataset.id, at = pick.chosen.indexOf(id);
          if (at >= 0) pick.chosen.splice(at, 1);
          else if (pick.chosen.length >= 3) { showToast('Up to 3 photos.', 'info'); return; }
          else pick.chosen.push(id);
          paintPick();
        });
        paintPick();
      });
    }
    async function uploadChosen() {
      const urls = [];
      for (const id of pick.chosen) {
        const p = pick.photos.find(x => x.id === id); if (!p) continue;
        const signed = await CG.deliveries.signedUrls([p.path], 600);
        const r = signed[p.path] ? await fetch(signed[p.path]).catch(() => null) : null;
        if (!r || !r.ok) throw new Error('Could not read one of the photos.');
        const { blob } = await resizeImage(await r.blob(), 1600, 0.85);
        const up = await CG.storage.uploadPublicJpeg(blob, user.id, 'r');
        if (up.error || !up.url) throw new Error(up.error?.message || 'Upload failed.');
        urls.push(up.url);
      }
      return urls;
    }
    const stars = [...$('dashModalBody').querySelectorAll('.rv-star')];
    const paintStars = (hover) => {
      const v = hover || rating;
      stars.forEach((s, i) => { s.classList.toggle('on', i < v); s.setAttribute('aria-checked', i + 1 === rating ? 'true' : 'false'); });
      $('rvLabel').textContent = v ? LABELS[v] : 'Tap to rate';
    };
    stars.forEach(s => {
      s.addEventListener('click', () => { rating = Number(s.dataset.n); paintStars(); });
      s.addEventListener('mouseenter', () => paintStars(Number(s.dataset.n)));
      s.addEventListener('mouseleave', () => paintStars());
      s.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); rating = Math.min(5, rating + 1); paintStars(); stars[rating - 1].focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); rating = Math.max(1, rating - 1); paintStars(); stars[rating - 1].focus(); }
      });
    });
    $('rvText').addEventListener('input', () => { $('rvCount').textContent = $('rvText').value.length; });
    $('rvForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!rating) { showToast('Please choose 1 to 5 stars.', 'error'); stars[0].focus(); return; }
      const btn = $('rvSend'); btn.disabled = true; btn.textContent = pick.chosen.length ? 'Adding your photos…' : 'Publishing…';
      let photos = [];
      try { photos = await uploadChosen(); }
      catch (err) { btn.disabled = false; btn.textContent = 'Publish review'; showToast(`${err.message} Try again, or publish without photos.`, 'error', 6000); return; }
      btn.textContent = 'Publishing…';
      const review = {
        photographer_id: b.photographer_id, user_id: user.id, booking_id: b.id,
        reviewer_name: String(b.client_name || 'Traveller').slice(0, 80),
        rating, comment: $('rvText').value.trim().slice(0, 1000) || null
      };
      let { error } = await CG.reviews.add(photos.length ? { ...review, photos } : review);
      if (error && photos.length && ['42703', 'PGRST204'].includes(error.code)) ({ error } = await CG.reviews.add(review)); // database not updated yet
      if (error && photos.length) CG.storage.removePublic(photos, user.id);
      if (error) {
        btn.disabled = false; btn.textContent = 'Publish review';
        const m = error.message || '';
        showToast(/duplicate|unique/i.test(m) ? 'You have already reviewed this booking.' : /row-level|policy|permission/i.test(m) ? 'Reviews can be left after a completed booking.' : 'Could not publish your review. Please try again.', 'error', 6000);
        if (/duplicate|unique/i.test(m)) { closeDashModal(true); loadBookings(); }
        return;
      }
      closeDashModal(true);
      showToast(`Thank you! Your review is live on ${creator}'s profile.`, 'success', 6000);
      loadBookings();
    });
  }

  // Warn before leaving with unsaved gallery or calendar changes
  window.addEventListener('beforeunload', (e) => {
    if (galleryDirty() || anyBusy() || (availState && availState.dirty)) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ── 📣 SHOOT REQUESTS: my requests + offers (traveller), requests near me (creator) ── */
  const OFFER_STATUS = { open: '', declined: 'Declined', accepted: '✓ Booked', withdrawn: 'Withdrawn' };
  const offerFacts = (o) => [`📅 ${fmtDate(o.shoot_date)}`, `⏱ ${minutesText(o.minutes)}`, o.photos ? `📸 ${o.photos} photos` : '', o.edit_days ? `📬 within ${o.edit_days} days` : ''].filter(Boolean).join(' · ');
  const reqHead = (q) => `${esc(requestService(q.service))} in ${esc(String(q.city).split(',')[0])} · ${esc(requestWhen(q))} · ${q.people} ${q.people === 1 ? 'person' : 'people'}${q.budget_eur ? ` · budget about €${q.budget_eur}` : ''}`;
  async function loadRequests() {
    const [mine, near] = await Promise.all([CG.requests.mine(), listing ? CG.requests.forMe() : Promise.resolve({ data: null })]);
    renderReqForMe(near.error ? null : near.data);
    renderReqMine(mine.error ? null : mine.data, mine.error);
  }
  function renderReqMine(list, error) {
    const box = $('reqMineBox');
    if (error) { box.innerHTML = '<div class="empty-state">Requests are not available yet. Please try again later.</div>'; return; }
    const reqs = Array.isArray(list) ? list : [];
    box.innerHTML = `<div class="req-section-head"><h2>Your requests</h2><a class="secondary-btn" href="/?request=1" style="text-decoration:none">📣 Post a request</a></div>`
      + (reqs.length ? reqs.map((q) => {
        const live = q.status === 'open';
        const offers = (q.offers || []);
        return `<div class="dash-card req-card" data-req="${esc(q.id)}">
          <div class="req-card-head"><strong>${reqHead(q)}</strong><span class="status-pill status-${live ? 'paid' : q.status === 'booked' ? 'confirmed' : 'cancelled'}">${live ? `${offers.filter((o) => o.status === 'open').length} offer${offers.filter((o) => o.status === 'open').length === 1 ? '' : 's'}` : q.status === 'booked' ? 'Booked' : 'Closed'}</span></div>
          ${q.note ? `<p class="muted small req-note" translate="no">“${esc(q.note)}”</p>` : ''}
          ${offers.length ? `<ul class="offer-list">${offers.map((o) => {
            const c = o.creator || {};
            const img = safeUrl(c.cover_image_url);
            return `<li class="offer${o.status !== 'open' ? ' offer-done' : ''}" data-offer="${esc(o.id)}">
              <a class="offer-who" href="/?creator=${esc(c.id)}" target="_blank" rel="noopener">${img ? `<img src="${esc(img)}" alt="" loading="lazy" />` : `<span class="offer-ava">${esc(String(c.name || '?').charAt(0))}</span>`}
                <span><strong>${esc(c.name || 'Creator')}</strong><span class="muted small">${c.reviews_count ? `★ ${Number(c.rating || 0).toFixed(1)} (${c.reviews_count})` : 'New on CapturaGo'}${c.verified >= 2 ? ' · ✓ verified' : ''}</span></span></a>
              <div class="offer-price">€${esc(o.price_eur)}</div>
              <p class="small offer-facts">${esc(offerFacts(o))}</p>
              ${o.message ? `<p class="small offer-msg" translate="no">“${esc(o.message)}”</p>` : ''}
              ${o.status === 'open' && live ? `<div class="booking-actions"><button class="primary-btn" data-ob="${esc(o.id)}">Book · €${esc(o.price_eur)} + fee</button><button class="secondary-btn" data-om="${esc(c.id)}">💬 Message</button><button class="link-btn" data-od="${esc(o.id)}">Decline</button></div>`
                : `<p class="small offer-state">${esc(OFFER_STATUS[o.status] || (live ? '' : 'Request closed'))}</p>`}
            </li>`;
          }).join('')}</ul>` : `<p class="muted small">${live ? 'No offers yet — creators in that city are told right away. We\'ll email you when offers arrive.' : 'No offers.'}</p>`}
          ${live ? `<button class="link-btn req-close" data-rc="${esc(q.id)}">Close this request</button>` : ''}
        </div>`;
      }).join('') : `<div class="empty-state">No requests yet. Can't decide on a creator? <a href="/?request=1">Post a request</a> and let creators send you offers.</div>`);
    box.querySelectorAll('[data-ob]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = 'Opening secure payment…';
      const { data, error: err } = await CG.requests.book(b.dataset.ob);
      if (err || !data?.url) { b.disabled = false; b.textContent = 'Book'; showToast(err?.message || 'Could not start the payment.', 'error', 6000); return; }
      location.href = data.url;
    }));
    box.querySelectorAll('[data-om]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const { data, error: err } = await CG.chat.start(b.dataset.om);
      b.disabled = false;
      if (err || !data) { showToast(err?.message || 'Could not open the conversation.', 'error'); return; }
      showPanel('messages'); openConversation(data);
    }));
    box.querySelectorAll('[data-od]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Decline this offer? The creator is not told why.')) return;
      const { error: err } = await CG.requests.decline(b.dataset.od);
      if (err) { showToast(err.message || 'Could not decline.', 'error'); return; }
      showToast('Offer declined.', 'success'); loadRequests();
    }));
    box.querySelectorAll('[data-rc]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Close this request? Open offers are declined and creators can no longer send new ones.')) return;
      const { error: err } = await CG.requests.close(b.dataset.rc);
      if (err) { showToast(err.message || 'Could not close the request.', 'error'); return; }
      showToast('Request closed.', 'success'); loadRequests();
    }));
  }
  function renderReqForMe(list) {
    const box = $('reqForMeBox');
    if (!listing) { box.innerHTML = ''; return; }
    const reqs = Array.isArray(list) ? list : [];
    box.innerHTML = `<div class="req-section-head"><h2>Requests near you</h2></div>`
      + (reqs.length ? reqs.map((q) => {
        const mineO = q.my_offer;
        return `<div class="dash-card req-card" data-near="${esc(q.id)}">
          <div class="req-card-head"><strong>${esc(q.first_name)} · ${reqHead(q)}</strong><span class="muted small">${q.offers_count} offer${q.offers_count === 1 ? '' : 's'} so far</span></div>
          ${q.note ? `<p class="muted small req-note" translate="no">“${esc(q.note)}”</p>` : ''}
          ${mineO ? `<p class="small offer-mine">Your offer: <strong>€${esc(mineO.price_eur)}</strong> · ${esc(offerFacts(mineO))}${mineO.status !== 'open' ? ` · <strong>${esc(OFFER_STATUS[mineO.status])}</strong>` : ''}</p>` : ''}
          <div class="booking-actions">${!mineO || mineO.status === 'open' || mineO.status === 'withdrawn' ? `<button class="${mineO && mineO.status === 'open' ? 'secondary-btn' : 'primary-btn'}" data-of="${esc(q.id)}">${mineO && mineO.status === 'open' ? '✏️ Change my offer' : '💬 Send an offer'}</button>` : ''}
            ${mineO && mineO.status === 'open' ? `<button class="link-btn" data-ow="${esc(mineO.id)}">Withdraw</button>` : ''}</div>
          <div class="offer-form-box"></div>
        </div>`;
      }).join('') : `<div class="empty-state">No open requests in ${esc(String(listing.city || 'your city').split(',')[0])} or on your trips right now. We email you when one comes in.</div>`);
    box.querySelectorAll('[data-of]').forEach((b) => b.addEventListener('click', () => {
      const q = reqs.find((x) => x.id === b.dataset.of);
      openOfferForm(b.closest('.req-card').querySelector('.offer-form-box'), q);
    }));
    box.querySelectorAll('[data-ow]').forEach((b) => b.addEventListener('click', async () => {
      const { error: err } = await CG.requests.withdraw(b.dataset.ow);
      if (err) { showToast(err.message || 'Could not withdraw.', 'error'); return; }
      showToast('Offer withdrawn.', 'success'); loadRequests();
    }));
  }
  function openOfferForm(host, q) {
    const o = q.my_offer && q.my_offer.status !== 'withdrawn' ? q.my_offer : (q.my_offer || {});
    const today = new Date().toISOString().slice(0, 10);
    const days = [];
    for (let d = q.date_from; d <= q.date_to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) if (d > today) days.push(d);
    const mins = [30, 45, 60, 90, 120, 180, 240, 360, 480];
    host.innerHTML = `<form class="offer-form" novalidate>
      <div class="req-two">
        <div class="form-row"><label>Price in € *</label><input name="price" type="number" inputmode="numeric" min="20" max="10000" value="${esc(o.price_eur || q.budget_eur || '')}" required /></div>
        <div class="form-row"><label>Day *</label><select name="date">${days.map((d) => `<option value="${d}" ${d === o.shoot_date ? 'selected' : ''}>${esc(fmtDate(d))}</option>`).join('')}</select></div>
        <div class="form-row"><label>Length</label><select name="minutes">${mins.map((m) => `<option value="${m}" ${m === (o.minutes || 60) ? 'selected' : ''}>${esc(minutesText(m))}</option>`).join('')}</select></div>
        <div class="form-row"><label>Edited photos</label><input name="photos" type="number" inputmode="numeric" min="0" max="2000" value="${esc(o.photos ?? '')}" placeholder="e.g. 40" /></div>
      </div>
      <div class="form-row"><label>Photos delivered within (days)</label><input name="edit" type="number" inputmode="numeric" min="1" max="60" value="${esc(o.edit_days ?? '')}" placeholder="e.g. 5 — your payment waits until you send them" /></div>
      <div class="form-row"><label>Message to ${esc(q.first_name)}</label><textarea name="message" rows="3" maxlength="600" placeholder="Why you, what you'd plan, the best spots…">${esc(o.message || '')}</textarea></div>
      <p class="muted small">They pay through CapturaGo when they book; the money is held safely and paid out after the shoot, like any booking.</p>
      <button type="submit" class="primary-btn">Send offer</button>
    </form>`;
    const f = host.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const num = (v) => (String(v).trim() === '' ? null : Math.round(Number(v)));
      const price = num(f.price.value), photos = num(f.photos.value), edit = num(f.edit.value);
      if (!price || price < 20 || price > 10000) return showToast('The price can be from €20 to €10,000.', 'error');
      if (photos !== null && (photos < 0 || photos > 2000)) return showToast('Up to 2000 photos.', 'error');
      if (edit !== null && (edit < 1 || edit > 60)) return showToast('Photos can be promised within 1 to 60 days.', 'error');
      if (!f.date.value) return showToast('This request has no days left.', 'error');
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      const { error: err } = await CG.requests.offer({ request: q.id, price, date: f.date.value, minutes: Number(f.minutes.value), photos, edit_days: edit, message: f.message.value.trim() });
      btn.disabled = false;
      if (err) { showToast(err.message || 'Could not send your offer.', 'error', 6000); return; }
      showToast(`Offer sent ✓ — we'll email ${q.first_name}.`, 'success'); loadRequests();
    });
    f.price.focus();
  }

  /* ── RETURN FROM STRIPE / DEEP LINKS ──────────────── */
  const DEEP_PANELS = ['messages', 'bookings', 'requests', 'listing', 'availability', 'earnings', 'payments', 'boost', 'reviews', 'overview'];
  function handleReturnParams() {
    const q = new URLSearchParams(location.search);
    if (q.get('c')) { showPanel('messages'); openConversation(q.get('c')); }
    else if (q.get('b') && /^[0-9a-f-]{36}$/i.test(q.get('b'))) { pendingBooking = q.get('b').toLowerCase(); showPanel('bookings'); }
    else if (q.get('review') && /^[0-9a-f-]{36}$/i.test(q.get('review'))) { pendingReview = q.get('review').toLowerCase(); showPanel('bookings'); }
    else if (q.get('move') && /^[0-9a-f-]{36}$/i.test(q.get('move'))) { pendingMove = q.get('move').toLowerCase(); showPanel('bookings'); }
    else if (q.get('stripe')) { showPanel('payments'); if (q.get('stripe') === 'return') showToast('Welcome back — checking your payout status…', 'info'); }
    else if (q.get('boost') === 'ok') {
      showPanel('boost');
      showToast('Payment received — your boost activates within a minute.', 'success', 6000);
      setTimeout(async () => { const { data } = await CG.photographers.getByUserId(user.id); if (data) { listing = { ...data, email: listing?.email }; loadBoost(); } }, 4000);
    } else if (DEEP_PANELS.includes(location.hash.slice(1))) showPanel(location.hash.slice(1));   // e.g. #payments from the tax email
    if (q.toString()) history.replaceState(null, '', location.pathname + location.hash);
  }

  // Links like dashboard.html#messages also work when you're already on the dashboard
  window.addEventListener('hashchange', () => {
    const name = location.hash.slice(1);
    if (user && DEEP_PANELS.includes(name)) showPanel(name);
  });

  await init();
});
