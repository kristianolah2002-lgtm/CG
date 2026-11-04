/* ── Gift cards: buy one, see it after paying, download a printable card, my gift cards ── */
document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const box = $('giftBox');
  const params = new URLSearchParams(location.search);
  const giftId = /^[0-9a-f-]{36}$/i.test(params.get('g') || '') ? params.get('g') : '';
  const outcome = params.get('s');
  const money = (c) => `€${(Number(c) / 100).toFixed(Number(c) % 100 ? 2 : 0)}`;
  const AMOUNTS = [50, 100, 150, 250];
  const niceDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  let amount = 100;

  const preview = (eur, name) => {
    $('gvAmount').textContent = `€${eur || '—'}`;
    $('gvFor').textContent = name ? `For ${name}` : 'A photo shoot, anywhere you travel';
  };

  if (outcome === 'cancel') { showToast('Payment cancelled — nothing was charged.', 'info'); history.replaceState(null, '', '/gift.html'); }

  /* ── Printable card (PNG, 1800 × 1100 — prints nicely on A6 / postcard) ── */
  async function cardImage(g) {
    try { await document.fonts.ready; } catch {}
    const W = 1800, H = 1100, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#F6EDE0'); bg.addColorStop(1, '#EBDAC4');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.fillStyle = '#B04722'; x.globalAlpha = 0.08;
    x.beginPath(); x.arc(W - 120, 140, 420, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;
    // star logo
    const star = (cx, cy, r) => {
      x.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 - Math.PI / 2;
        const tip = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        const nxt = (i + 1) * Math.PI / 2 - Math.PI / 2;
        const mid = (a + nxt) / 2;
        if (i === 0) x.moveTo(...tip); else x.lineTo(...tip);
        x.quadraticCurveTo(cx + Math.cos(mid) * r * 0.2, cy + Math.sin(mid) * r * 0.2, cx + Math.cos(nxt) * r, cy + Math.sin(nxt) * r);
      }
      x.closePath(); x.fill();
    };
    x.fillStyle = '#211911'; star(150, 150, 46);
    x.font = '600 52px Fraunces, Georgia, serif'; x.textBaseline = 'middle';
    x.fillText('CapturaGo', 220, 152);
    x.fillStyle = '#6B5842'; x.font = '500 34px Inter, system-ui, sans-serif';
    x.fillText('GIFT CARD', 110, 290);
    x.fillStyle = '#B04722'; x.font = '600 220px Fraunces, Georgia, serif'; x.textBaseline = 'alphabetic';
    x.fillText(money(g.amount_cents), 100, 520);
    x.fillStyle = '#211911'; x.font = '500 54px Fraunces, Georgia, serif';
    x.fillText(g.recipient_name ? `For ${g.recipient_name}` : 'A photo shoot, anywhere you travel', 110, 620);
    // message (wrapped, max 3 lines)
    if (g.message) {
      x.fillStyle = '#6B5842'; x.font = 'italic 38px Inter, system-ui, sans-serif';
      const words = `“${g.message}”`.split(/\s+/); const lines = []; let line = '';
      for (const w of words) { const t = line ? `${line} ${w}` : w; if (x.measureText(t).width > W - 220 && line) { lines.push(line); line = w; } else line = t; }
      if (line) lines.push(line);
      lines.slice(0, 3).forEach((l, i) => x.fillText(i === 2 && lines.length > 3 ? `${l}…` : l, 110, 700 + i * 52));
    }
    // code panel
    x.fillStyle = '#FFFFFF'; x.globalAlpha = 0.85;
    const py = 880; x.beginPath(); if (x.roundRect) x.roundRect(100, py, W - 200, 130, 28); else x.rect(100, py, W - 200, 130); x.fill(); x.globalAlpha = 1;
    x.fillStyle = '#211911'; x.font = '600 64px ui-monospace, SFMono-Regular, Menlo, monospace'; x.textBaseline = 'middle';
    x.fillText(g.code, 150, py + 66);
    x.fillStyle = '#6B5842'; x.font = '500 30px Inter, system-ui, sans-serif'; x.textAlign = 'right';
    x.fillText(`Valid until ${niceDate(g.expires_at)}`, W - 150, py + 46);
    x.fillText('Redeem at capturago.com', W - 150, py + 90);
    x.textAlign = 'left';
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  async function downloadCard(g) {
    const blob = await cardImage(g);
    if (!blob) return showToast('Could not create the card on this device.', 'error');
    const file = new File([blob], 'capturago-gift-card.png', { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'CapturaGo gift card' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ── A bought card (after paying, or from the email link) ── */
  async function showCard(id) {
    let g = null;
    for (let i = 0; i < 12; i++) {
      const { data } = await CG.gifts.mine();
      g = (Array.isArray(data) ? data : []).find((x) => x.id === id) || null;
      if (!g || g.status === 'active') break;   // not mine (or not found), or ready
      if (outcome !== 'ok') break;
      box.innerHTML = '<h2>Confirming your payment…</h2><p class="muted">This takes a few seconds.</p>';
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!g) { box.innerHTML = `<h2>Gift card not found</h2><p class="muted">Sign in with the account that bought it to see the code.</p><a class="secondary-btn" href="/gift.html" style="text-decoration:none">Buy a gift card</a>`; return; }
    if (g.status !== 'active') {
      box.innerHTML = g.status === 'refunded' ? '<h2>This gift card was refunded</h2><p class="muted">The code no longer works.</p>'
        : '<h2>Payment processing</h2><p class="muted">Your payment is still being confirmed. You\'ll get the code by email in a minute — it will also appear here.</p>';
      return;
    }
    preview(g.amount_cents / 100, g.recipient_name || '');
    $('giftVisual').querySelector('.gv-code').textContent = g.code;
    box.innerHTML = `<h2>${outcome === 'ok' ? 'Thank you! Your gift card is ready 🎁' : 'Your gift card'}</h2>
      <p class="gift-code" translate="no">${esc(g.code)}</p>
      <ul class="pay-facts"><li><span>💶</span><span><strong>${money(g.balance_cents)}</strong>${g.balance_cents < g.amount_cents ? ` left of ${money(g.amount_cents)}` : ''}</span></li>
        <li><span>📅</span><span>Valid until ${esc(niceDate(g.expires_at))}</span></li>
        ${g.recipient_email ? `<li><span>✉️</span><span>We emailed it to ${esc(g.recipient_email)}</span></li>` : ''}</ul>
      <div class="gift-actions"><button type="button" class="primary-btn" id="gDownload">Download printable card</button>
        <button type="button" class="secondary-btn" id="gCopy">Copy code</button></div>
      <p class="muted small">Anyone with the code can use it, so keep it like cash until you give it.</p>
      <p><a href="/gift.html">Buy another gift card</a></p>`;
    $('gDownload').addEventListener('click', () => downloadCard({ ...g, message: '' }));
    $('gCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(g.code); showToast('Code copied.', 'success'); } catch { showToast(g.code, 'info', 8000); } });
  }

  /* ── Buy form ── */
  function showForm() {
    box.innerHTML = `<h2>Choose an amount</h2>
      <form id="giftForm" novalidate>
        <div class="slot-chips gift-amounts" id="gAmounts" role="group" aria-label="Amount">${AMOUNTS.map((a) => `<button type="button" data-a="${a}" class="${a === amount ? 'on' : ''}" aria-pressed="${a === amount}">€${a}</button>`).join('')}
          <button type="button" data-a="other" aria-pressed="false">Other</button></div>
        <div class="form-row" id="gOtherRow" hidden><label for="gOther">Amount in euros (25–1000)</label><input id="gOther" type="number" inputmode="numeric" min="25" max="1000" step="1" /></div>
        <div class="form-row"><label for="gName">Who is it for? <span class="muted">(optional)</span></label><input id="gName" maxlength="60" autocomplete="off" placeholder="Their first name" /></div>
        <div class="form-row"><label for="gEmail">Email it to them <span class="muted">(optional)</span></label><input id="gEmail" type="email" maxlength="254" autocomplete="off" placeholder="We'll send it right after you pay" />
          <p class="form-note">Leave empty to give it yourself — you'll get a printable card.</p></div>
        <div class="form-row"><label for="gMsg">Personal message <span class="muted">(optional)</span></label><textarea id="gMsg" rows="3" maxlength="300" placeholder="Happy birthday! Have the best trip 📸"></textarea></div>
        <button type="submit" class="primary-btn" id="gBuy">Buy gift card — €${amount}</button>
        <p class="muted small" style="text-align:center;margin-top:10px">Payments are processed by Stripe. <a href="/terms.html#gift-cards" target="_blank">Gift card terms</a></p>
      </form>`;
    const btnText = () => { $('gBuy').textContent = `Buy gift card — €${amount || '…'}`; preview(amount, $('gName').value.trim()); };
    $('gAmounts').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      $('gAmounts').querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      const other = b.dataset.a === 'other';
      $('gOtherRow').hidden = !other;
      amount = other ? (Number($('gOther').value) || 0) : Number(b.dataset.a);
      if (other) $('gOther').focus();
      btnText();
    }));
    $('gOther').addEventListener('input', () => { amount = Number($('gOther').value) || 0; btnText(); });
    $('gName').addEventListener('input', btnText);
    $('giftForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Number.isInteger(amount) || amount < 25 || amount > 1000) return showToast('Choose an amount from €25 to €1000 (whole euros).', 'error');
      const email = $('gEmail').value.trim();
      if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return showToast("The recipient's email doesn't look right.", 'error');
      const btn = $('gBuy'); btn.disabled = true; btn.textContent = 'Opening secure payment…';
      const { data, error } = await CG.gifts.buy({ amount_eur: amount, recipient_name: $('gName').value.trim(), recipient_email: email, message: $('gMsg').value.trim() });
      if (error || !data?.url) { btn.disabled = false; btnText(); showToast(error?.message || 'Could not start the payment. Please try again.', 'error', 6000); return; }
      location.href = data.url;
    });
    btnText();
  }

  async function showMine() {
    const { data } = await CG.gifts.mine();
    const list = (Array.isArray(data) ? data : []).filter((g) => g.status === 'active' || g.status === 'refunded');
    if (!list.length) return;
    $('giftMine').hidden = false;
    $('giftMineList').innerHTML = list.map((g) => `<li><a href="/gift.html?g=${esc(g.id)}"><strong>${money(g.amount_cents)}</strong>${g.recipient_name ? ` for ${esc(g.recipient_name)}` : ''}</a>
      <span class="muted small">${g.status === 'refunded' ? 'Refunded' : `${money(g.balance_cents)} left · valid until ${esc(niceDate(g.expires_at))}`}</span></li>`).join('');
  }

  const user = await CG.auth.getUser();
  if (!user) {
    if (giftId) { box.innerHTML = '<h2>Sign in to see your gift card</h2><div id="gAuth"></div>'; }
    else { box.innerHTML = '<h2>Buy a gift card</h2><div id="gAuth"></div>'; }
    inlineAuth($('gAuth'), { lead: giftId ? 'Use the account you bought it with.' : 'Create a free account (or sign in) — you get the receipt and the code is kept safe in your account.', returnTo: '/gift.html', onDone: () => location.reload() });
    preview(100, '');
    return;
  }
  if (giftId) await showCard(giftId); else showForm();
  showMine();
});
