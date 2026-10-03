/* ================================================================
   CapturaGo — creator dashboard
   Depends on: vendor/supabase.umd.js, supabase.js, site.js
================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const SERVICE_LABELS = { photo: 'Photography', video: 'Videography', edit: 'Editing', guide: 'Location guide' };
  const PRICE_LABELS = { budget: 'Under €80', mid: '€80–€250', premium: '€250+' };
  const VIBE_LABELS = { moody: 'Dark & moody', airy: 'Bright & airy', film: 'Film / vintage', cinematic: 'Cinematic' };
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
    if (name === 'inquiries') loadInquiries();
    if (name === 'reviews') loadReviews();
    if (name === 'bookings') loadBookings();
    if (name === 'payments') loadPayments();
    if (name === 'boost') loadBoost();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('.dash-nav-item').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.goto)));

  /* ── OVERVIEW ─────────────────────────────────────── */
  function renderOverview() {
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
    $('previewCity').textContent = `📍 ${listing.city || ''} · ${(listing.services || []).map(s => SERVICE_LABELS[s] || s).join(', ')} · ${PRICE_LABELS[listing.price] || ''}`;
    $('previewDesc').textContent = listing.description || '';
    $('noMapWarning').hidden = !!listing.coords;

    const t = $('availabilityToggle');
    t.checked = listing.available !== false;
    paintAvailability();
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
    $('elSpots').innerHTML = '';
    spotsOf(l).forEach(s => addSpotRow(typeof s === 'string' ? { name: s } : s));
    $('elPackages').innerHTML = '';
    (Array.isArray(l.packages) ? l.packages : []).forEach(k => addPackageRow(k));
    showCoverPreview(safeUrl(l.cover_image_url));
    $('elCover').value = '';
  }

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
    const spots = [...document.querySelectorAll('#elSpots .spot-entry')]
      .map(el => ({ name: el.querySelector('.spot-name').value.trim(), desc: el.querySelector('.spot-desc').value.trim() }))
      .filter(s => s.name);

    if (!name || !city || !email || !portfolio) return showToast('Please fill in all fields marked *.', 'error');
    if (!services.length) return showToast('Select at least one service.', 'error');
    const packages = [];
    for (const row of document.querySelectorAll('#elPackages .package-entry')) {
      const name = row.querySelector('.pk-name').value.trim();
      const priceRaw = row.querySelector('.pk-price').value.trim().replace(',', '.');
      if (!name && !priceRaw) continue;
      const price = Number(priceRaw);
      if (!name) return showToast('Every package needs a name.', 'error');
      if (!Number.isFinite(price) || price < 10 || price > 5000) return showToast(`"${name}": price must be between €10 and €5000.`, 'error');
      packages.push({
        id: row.dataset.id || `p${Date.now().toString(36)}${packages.length}`,
        name: name.slice(0, 60),
        minutes: Number(row.querySelector('.pk-min').value) || null,
        price_eur: Math.round(price * 100) / 100,
        desc: row.querySelector('.pk-desc').value.trim().slice(0, 200),
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Please enter a valid email.', 'error');
    if (!/^https?:\/\//i.test(portfolio) || !safeUrl(portfolio)) return showToast('Portfolio link must start with https://', 'error');

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
        type: services[0], services, vibes,
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
        packages
      };

      const save = (pl) => listing
        ? CG.photographers.update(listing.id, pl)
        : CG.photographers.insert({ ...pl, user_id: user.id });
      let res = await save(payload);
      if (res.error && /packages/i.test(res.error.message || '')) {
        // Database not updated yet (payments-patch.sql) — save everything except packages
        const { packages: _skip, ...rest } = payload;
        res = await save(rest);
        if (!res.error) showToast('Saved — but packages need the latest database update (payments-patch.sql).', 'info', 7000);
      }

      if (res.error) { showToast('Could not save: ' + res.error.message, 'error', 6000); return; }
      listing = { ...res.data, email };   // email is private, so it isn't returned by the API
      renderOverview();
      fillForm();
      if (!coords) showToast("Saved — but we couldn't find that city on the map. Try 'City, Country'.", 'info', 7000);
      else showToast('Listing saved ✓', 'success');
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
            <span class="inquiry-sender">${esc(q.sender_name)} ${q.read ? '' : '<span class="unread-dot"></span>'}</span>
            <span class="inquiry-date">${fmtDate(q.created_at)}</span>
          </div>
          <div class="inquiry-meta">
            <span>📧 ${esc(q.sender_email)}</span>
            ${q.shoot_type ? `<span>📷 ${esc(SERVICE_LABELS[q.shoot_type] || q.shoot_type)}</span>` : ''}
            ${q.shoot_date ? `<span>📅 ${fmtDate(q.shoot_date)}</span>` : ''}
          </div>
          <div class="inquiry-message" style="white-space:pre-line">${esc(q.message)}</div>
          <a href="${mail}" class="inquiry-reply-btn">Reply by email →</a>
        </div>`;
    }).join('');

    const unreadIds = list.filter(q => !q.read).map(q => q.id);
    await Promise.all(unreadIds.map(id => CG.inquiries.markRead(id)));
    $('unreadBadge').hidden = true;
  }

  /* ── REVIEWS ──────────────────────────────────────── */
  async function loadReviews() {
    const box = $('reviewsList');
    if (!listing) { box.innerHTML = '<div class="empty-state">Create your listing first to receive reviews.</div>'; return; }
    const { data } = await CG.reviews.get(listing.id);
    const list = data || [];
    if (!list.length) { box.innerHTML = '<div class="empty-state">No reviews yet. After a shoot, ask your client to leave one on your CapturaGo profile.</div>'; return; }
    box.innerHTML = list.map(r => `
      <div class="review-item">
        <div class="review-header">
          <strong>${esc(r.reviewer_name)}</strong>
          <span style="color:var(--amber)">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          <span class="muted small">${fmtDate(r.created_at)}</span>
        </div>
        ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
      </div>`).join('');
  }

  /* ── PACKAGES EDITOR ──────────────────────────────── */
  function addPackageRow(k = {}) {
    const box = $('elPackages');
    if (box.children.length >= 5) { showToast('Up to 5 packages.', 'info'); return; }
    const div = document.createElement('div');
    div.className = 'package-entry';
    if (k.id) div.dataset.id = k.id;
    const mins = [30, 45, 60, 90, 120, 180, 240, 480];
    div.innerHTML = `
      <button type="button" class="spot-remove-btn" aria-label="Remove package">×</button>
      <div class="pk-grid">
        <input type="text" class="pk-name" maxlength="60" placeholder="Package name (e.g. Golden hour portraits)" />
        <select class="pk-min" aria-label="Duration">${mins.map(m => `<option value="${m}">${m < 60 ? m + ' min' : (m / 60) + ' h'}</option>`).join('')}</select>
        <div class="pk-price-wrap"><span>€</span><input type="number" class="pk-price" min="10" max="5000" step="1" placeholder="Price" /></div>
      </div>
      <input type="text" class="pk-desc" maxlength="200" placeholder="What's included? (e.g. 2 locations, 40 edited photos)" />`;
    div.querySelector('.pk-name').value = k.name || '';
    div.querySelector('.pk-min').value = String(k.minutes || 60);
    div.querySelector('.pk-price').value = k.price_eur != null ? k.price_eur : '';
    div.querySelector('.pk-desc').value = k.desc || '';
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
  const STATUS_TEXT = { pending_payment: 'Awaiting payment', paid: 'Paid — awaiting confirmation', confirmed: 'Confirmed', completed: 'Completed', declined: 'Declined — refunded', cancelled: 'Cancelled', refunded: 'Refunded', expired: 'Payment not completed', disputed: 'Under review' };
  const daysUntil = (iso) => {
    const today = new Date().toISOString().slice(0, 10);
    return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  };

  function bookingButtons(b, asCreator) {
    const d = daysUntil(b.shoot_date);
    const btns = [];
    if (asCreator) {
      if (b.status === 'paid') btns.push(['confirm', 'Confirm booking', 'primary-btn'], ['decline', 'Decline & refund', 'danger-btn']);
      if (b.status === 'confirmed' && d > 0) btns.push(['decline', 'Cancel & refund', 'danger-btn']);
      if (b.status === 'confirmed' && d <= -3) btns.push(['complete', 'Release my payment', 'primary-btn']);
    } else {
      if (b.status === 'pending_payment') btns.push(['cancel', 'Cancel', 'secondary-btn']);
      if (b.status === 'paid') btns.push(['cancel', 'Cancel — full refund', 'secondary-btn']);
      if (b.status === 'confirmed' && d >= 7) btns.push(['cancel', 'Cancel — full refund', 'secondary-btn']);
      if (b.status === 'confirmed' && d <= 0) btns.push(['complete', 'Shoot happened — release payment', 'primary-btn']);
      if ((b.status === 'paid' || b.status === 'confirmed') && d >= -3 && d <= 0) btns.push(['dispute', 'Report a problem', 'danger-btn']);
    }
    return btns;
  }

  function bookingHint(b, asCreator) {
    const d = daysUntil(b.shoot_date);
    if (asCreator && b.status === 'confirmed' && d > -3) return 'Payment is released 3 days after the shoot, or as soon as the traveller confirms.';
    if (!asCreator && b.status === 'confirmed' && d > 0 && d < 7) return 'Free cancellation has ended. Message the creator to reschedule.';
    if (b.status === 'disputed') return "We're reviewing this booking and will contact both of you by email.";
    return '';
  }

  async function loadBookings() {
    const box = $('bookingsList');
    box.innerHTML = '<p class="muted">Loading…</p>';
    const { data, error } = await CG.bookings.list();
    if (error) { box.innerHTML = '<div class="empty-state">Bookings are not available yet. Please try again later.</div>'; return; }
    const list = (data || []).filter(b => b.status !== 'expired' || b.client_user_id === user.id);
    if (!list.length) {
      box.innerHTML = `<div class="empty-state">No bookings yet. ${listing ? 'Add packages and connect payouts so travellers can book you.' : '<a href="/">Find a creator</a> for your next trip.'}</div>`;
      return;
    }
    box.innerHTML = list.map(b => {
      const asCreator = b.creator_user_id === user.id;
      const other = asCreator ? `${esc(b.client_name)} · <a href="mailto:${encodeURIComponent(b.client_email)}">${esc(b.client_email)}</a>` : esc(b.photographers ? `${b.photographers.name}, ${b.photographers.city}` : 'Creator');
      const amount = asCreator ? `You receive ${euro(b.price_cents - b.creator_fee_cents)}` : `You paid ${euro(b.total_cents)}`;
      const btns = bookingButtons(b, asCreator).map(([a, label, cls]) => `<button class="${cls} bk-act" data-id="${esc(b.id)}" data-act="${a}" data-name="${esc(b.package_name)}" data-date="${esc(b.shoot_date)}">${label}</button>`).join('');
      const hint = bookingHint(b, asCreator);
      return `
        <div class="inquiry-item booking-item">
          <div class="inquiry-header">
            <span class="inquiry-sender">${esc(b.package_name)} <span class="muted small">· ${asCreator ? 'Booked with you' : 'Your booking'}</span></span>
            <span class="status-pill status-${esc(b.status)}">${STATUS_TEXT[b.status] || esc(b.status)}</span>
          </div>
          <div class="inquiry-meta"><span>📅 ${fmtDate(b.shoot_date)}</span><span>${asCreator ? '🧳' : '📷'} ${other}</span><span>💶 ${amount}</span></div>
          ${b.note ? `<div class="inquiry-message" style="white-space:pre-line">“${esc(b.note)}”</div>` : ''}
          ${hint ? `<p class="muted small">${hint}</p>` : ''}
          ${btns ? `<div class="booking-actions">${btns}</div>` : ''}
        </div>`;
    }).join('');
    box.querySelectorAll('.bk-act').forEach(btn => btn.addEventListener('click', () => doBookingAction(btn)));
  }

  const CONFIRM_TEXT = {
    decline: (n, d) => `Decline "${n}" on ${d}? The traveller will be refunded in full.`,
    cancel: (n, d) => `Cancel "${n}" on ${d}?`,
    complete: (n, d) => `Confirm "${n}" on ${d} is done? The payment will be released to the creator. This can't be undone.`,
    dispute: (n, d) => `Report a problem with "${n}" on ${d}? The payment will be frozen while we review it.`,
  };

  async function doBookingAction(btn) {
    const { id, act, name, date } = btn.dataset;
    if (CONFIRM_TEXT[act] && !confirm(CONFIRM_TEXT[act](name, fmtDate(date)))) return;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Working…';
    const { data, error } = await CG.bookings.action(id, act);
    if (error) {
      btn.disabled = false; btn.textContent = original;
      showToast(error.message || 'Something went wrong.', 'error', 6000);
      return;
    }
    const msgs = { confirm: 'Booking confirmed ✓', decline: 'Declined — the traveller is being refunded.', cancel: data?.refunded ? 'Cancelled — your refund is on its way.' : 'Booking cancelled.', complete: 'Payment released ✓', dispute: "Thanks — we'll be in touch within 48 hours." };
    showToast(msgs[act] || 'Done', 'success', 5000);
    loadBookings();
    refreshBookingBadge();
  }

  async function refreshBookingBadge() {
    const { data } = await CG.bookings.list();
    const n = (data || []).filter(b => b.creator_user_id === user.id && b.status === 'paid').length;
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

  /* ── RETURN FROM STRIPE / DEEP LINKS ──────────────── */
  function handleReturnParams() {
    const q = new URLSearchParams(location.search);
    if (q.get('stripe')) { showPanel('payments'); if (q.get('stripe') === 'return') showToast('Welcome back — checking your payout status…', 'info'); }
    else if (q.get('boost') === 'ok') {
      showPanel('boost');
      showToast('Payment received — your boost activates within a minute.', 'success', 6000);
      setTimeout(async () => { const { data } = await CG.photographers.getByUserId(user.id); if (data) { listing = { ...data, email: listing?.email }; loadBoost(); } }, 4000);
    } else if (location.hash === '#bookings') showPanel('bookings');
    if (q.toString()) history.replaceState(null, '', location.pathname + location.hash);
  }

  await init();
});
