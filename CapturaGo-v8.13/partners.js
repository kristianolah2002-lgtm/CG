/* ── Partners (hotels, hostels, tour desks): apply, see the status, print the QR card, see bookings and thank-yous ── */
document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const box = $('ptBox');
  const KINDS = [['hotel', 'Hotel'], ['hostel', 'Hostel'], ['guesthouse', 'Guesthouse / B&B'], ['apartments', 'Apartments'], ['tours', 'Tours / travel desk'], ['other', 'Other']];
  const money = (c) => `€${(Number(c) / 100).toFixed(2)}`;

  function qrCanvas(text, scale) {
    if (typeof window.qrcode !== 'function') return null;
    const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), m = 2, size = (n + m * 2) * scale;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, size, size); g.fillStyle = '#211911';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect((k + m) * scale, (r + m) * scale, scale, scale);
    return c;
  }

  /* Reception card (A6 portrait, 1240 × 1748 px ≈ 300 dpi) */
  async function cardPng(p, url) {
    try { await document.fonts.ready; } catch {}
    const W = 1240, H = 1748, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#F6EDE0'); bg.addColorStop(1, '#EBDAC4');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#6B5842'; x.font = '600 34px Inter, system-ui, sans-serif';
    x.fillText(`${String(p.name).toUpperCase().slice(0, 40)} RECOMMENDS`, W / 2, 150);
    x.fillStyle = '#211911'; x.font = '600 92px Fraunces, Georgia, serif';
    x.fillText('Photos of your', W / 2, 290); x.fillText('trip, by a local', W / 2, 395);
    x.fillStyle = '#6B5842'; x.font = '400 40px Inter, system-ui, sans-serif';
    x.fillText('Photographers, videographers & local guides', W / 2, 480);
    const q = qrCanvas(url, 18);
    if (q) {
      const s = 640, qx = (W - s) / 2, qy = 560;
      x.fillStyle = '#FFFFFF'; x.beginPath(); if (x.roundRect) x.roundRect(qx - 30, qy - 30, s + 60, s + 60, 36); else x.rect(qx - 30, qy - 30, s + 60, s + 60); x.fill();
      x.imageSmoothingEnabled = false; x.drawImage(q, qx, qy, s, s);
    }
    x.fillStyle = '#B04722'; x.font = '600 56px Fraunces, Georgia, serif';
    x.fillText('Scan for a lower booking fee', W / 2, 1380);
    x.fillStyle = '#211911'; x.font = '500 38px Inter, system-ui, sans-serif';
    x.fillText('Payment protected until your shoot is done', W / 2, 1450);
    x.fillStyle = '#6B5842'; x.font = '500 34px ui-monospace, SFMono-Regular, Menlo, monospace';
    x.fillText(url.replace(/^https?:\/\//, ''), W / 2, 1600);
    x.fillStyle = '#211911'; x.font = '600 44px Fraunces, Georgia, serif';
    x.fillText('✦ CapturaGo', W / 2, 1680);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  function form(cur, user) {
    const v = (k) => esc(cur ? cur[k] || '' : '');
    box.innerHTML = `<h2>${cur ? 'Your application' : 'Apply as a partner'}</h2>
      <form id="ptForm" novalidate>
        <div class="form-row"><label for="ptName">Name of your place *</label><input id="ptName" maxlength="100" value="${v('name')}" placeholder="e.g. Hostel Zebra" /></div>
        <div class="form-row"><label for="ptKind">What is it? *</label><select id="ptKind">${KINDS.map(([k, l]) => `<option value="${k}" ${cur && cur.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="form-row"><label for="ptCity">City *</label><input id="ptCity" maxlength="120" value="${v('city')}" placeholder="e.g. Lisbon, Portugal" /></div>
        <div class="form-row"><label for="ptWeb">Website <span class="muted">(optional)</span></label><input id="ptWeb" type="url" maxlength="300" value="${v('website')}" placeholder="https://" /></div>
        <div class="form-row"><label for="ptContact">Your name *</label><input id="ptContact" maxlength="80" autocomplete="name" value="${cur ? v('contact_name') : esc((user.user_metadata && user.user_metadata.full_name) || '')}" /></div>
        <div class="form-row"><label for="ptMsg">Tell us about your guests <span class="muted">(optional)</span></label><textarea id="ptMsg" rows="3" maxlength="1000" placeholder="How many guests, where they come from…">${v('message')}</textarea></div>
        <div class="form-row"><label for="ptPayout">How should we pay your thank-you? <span class="muted">(optional, private)</span></label><input id="ptPayout" maxlength="300" value="${v('payout_note')}" placeholder="Bank account (IBAN) and account holder" /></div>
        <button type="submit" class="primary-btn" style="width:100%">${cur ? 'Save' : 'Send application'}</button>
      </form>`;
    $('ptForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const web = $('ptWeb').value.trim();
      if ($('ptName').value.trim().length < 2) return showToast('Tell us the name of your place.', 'error');
      if ($('ptCity').value.trim().length < 2) return showToast('Tell us the city.', 'error');
      if (web && !/^https:\/\/[^\s<>"]+$/.test(web)) return showToast('The website must start with https://', 'error');
      if ($('ptContact').value.trim().length < 2) return showToast('Tell us your name.', 'error');
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
      const { error } = await CG.partners.apply({ name: $('ptName').value.trim(), kind: $('ptKind').value, city: $('ptCity').value.trim(), website: web,
        contact: $('ptContact').value.trim(), message: $('ptMsg').value.trim(), payout: $('ptPayout').value.trim() });
      btn.disabled = false;
      if (error) return showToast(error.message || 'Could not send your application.', 'error', 6000);
      showToast(cur ? 'Saved ✓' : 'Application sent ✓ — we usually reply within 2 days.', 'success', 6000);
      load(user);
    });
  }

  async function load(user) {
    const { data: p, error } = await CG.partners.mine();
    if (error) { box.innerHTML = '<h2>Not available yet</h2><p class="muted">Please try again later.</p>'; return; }
    if (!p) { form(null, user); return; }
    if (p.status === 'pending') {
      box.innerHTML = `<h2>Thanks — we're checking your application</h2><p class="muted">${esc(p.name)} · ${esc(p.city)}. We usually reply within 2 days by email.</p><button type="button" class="secondary-btn" id="ptEdit">Edit my application</button>`;
      $('ptEdit').addEventListener('click', () => form(p, user));
      return;
    }
    if (p.status === 'rejected' || p.status === 'paused') {
      box.innerHTML = `<h2>${p.status === 'paused' ? 'Your partner link is paused' : 'Application not approved'}</h2><p class="muted">${p.status === 'paused' ? 'Guests don\'t get the lower fee through your link right now. Write to <a href="mailto:hello@capturago.com">hello@capturago.com</a>.' : 'You can apply again 30 days after your application. Questions? <a href="mailto:hello@capturago.com">hello@capturago.com</a>'}</p>`;
      return;
    }
    const url = `${location.origin}/?p=${p.code}`;
    box.innerHTML = `<h2>${esc(p.name)} 🤝</h2>
      <p class="muted small">Your partner link — guests who open it get a lower fee for 30 days:</p>
      <p class="gift-code" translate="no" id="ptUrl">${esc(url.replace(/^https?:\/\//, ''))}</p>
      <div class="partner-qr" id="ptQr"></div>
      <div class="gift-actions"><button type="button" class="primary-btn" id="ptCard">Download reception card (PNG)</button>
        <button type="button" class="secondary-btn" id="ptCopy">Copy link</button></div>
      <ul class="pay-facts" id="ptStats"><li><span>📅</span><span><strong>${p.bookings}</strong> booking${p.bookings === 1 ? '' : 's'} by your guests · ${p.completed} completed</span></li>
        <li><span>💶</span><span><strong>${money(p.owed_cents)}</strong> thank-you to be paid · ${money(p.paid_cents)} paid so far</span></li></ul>
      <details class="pt-payout"><summary>Payout details</summary>
        <form id="ptPayForm" class="gift-apply" style="margin-top:8px"><input id="ptPayout2" maxlength="300" value="${esc(p.payout_note || '')}" placeholder="IBAN and account holder" /><button class="secondary-btn" type="submit">Save</button></form></details>`;
    const q = qrCanvas(url, 6);
    if (q) { q.setAttribute('aria-label', 'QR code of your partner link'); q.setAttribute('role', 'img'); $('ptQr').appendChild(q); }
    $('ptCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(url); showToast('Link copied.', 'success'); } catch { showToast(url, 'info', 8000); } });
    $('ptCard').addEventListener('click', async () => {
      const blob = await cardPng(p, url);
      if (!blob) return showToast('Could not create the card on this device.', 'error');
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'capturago-reception-card.png';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
    $('ptPayForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error: err } = await CG.partners.apply({ name: p.name, kind: p.kind, city: p.city, website: p.website, contact: p.contact_name, message: p.message, payout: $('ptPayout2').value.trim() });
      showToast(err ? (err.message || 'Could not save.') : 'Saved ✓', err ? 'error' : 'success');
    });
  }

  const user = await CG.auth.getUser();
  if (!user) {
    box.innerHTML = '<h2>Apply as a partner</h2><div id="ptAuth"></div>';
    inlineAuth($('ptAuth'), { lead: 'Create a free account (or sign in) to apply — it takes a minute.', returnTo: '/partners.html', onDone: () => location.reload() });
    return;
  }
  load(user);
});
