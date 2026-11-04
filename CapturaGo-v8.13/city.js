/* ================================================================
   CapturaGo — live city pages: /in/<city>
   Static pages (built by tools/build_pages.py) and /city.html (any other
   city) both use this: real creators in the city, founding-creator spots,
   and an anonymous "city page" count. Everything from the database is
   escaped before it is shown.
================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const box = $('cityLive');
  if (!box || !window.CG) return;
  const TAX = window.CG_TAX;

  // Which city? Static pages say it in data-city; /city.html reads it from the address (/in/lisbon)
  let name = String(box.dataset.city || '').trim();
  let slug = name ? citySlug(name) : '';
  if (!name) {
    let raw = '';
    try { raw = decodeURIComponent(location.pathname.replace(/^\/in\//, '').replace(/\.html$/, '').replace(/\/+$/, '')); } catch { raw = ''; }
    slug = citySlug(raw.replace(/-/g, ' '));
    if (!/^[a-z0-9-]{2,60}$/.test(slug)) { location.replace('/'); return; }
    name = slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    // dynamic page: fill the headline and the browser title (textContent — never HTML)
    document.title = `Photographers & creators in ${name} – CapturaGo`;
    const h1 = $('cityTitle'); if (h1) h1.textContent = `Photographers & creators in ${name}`;
    const eb = $('cityEyebrow'); if (eb) eb.textContent = name;
    const lead = $('cityLead'); if (lead) lead.textContent = `Book a local photographer, videographer, phone content creator or guide in ${name} — someone who knows the golden-hour spots and the hidden corners.`;
    const cta = $('cityCta'); if (cta) { cta.href = `/?city=${encodeURIComponent(name)}#portfolio-section`; cta.textContent = `See creators in ${name}`; }
  }
  CG.logEvent('city_page', name, '', null);

  box.innerHTML = '<p class="muted">Loading creators…</p>';
  const [{ data: all, error }, { data: founding }] = await Promise.all([CG.photographers.getAll({}), CG.founding.cities()]);
  const locals = (all || []).filter((p) => p && p.city && citySlug(p.city) === slug && p.available !== false);
  // Creators on the road: coming here on a trip (shown after the locals)
  const visiting = (all || []).filter((p) => p && p.available !== false && !locals.includes(p))
    .map((p) => { const t = upcomingTrips(p.trips).find((x) => citySlug(x.city) === slug); return t ? { ...p, _trip: t } : null; }).filter(Boolean);
  const here = [...locals];
  // label as the creators write it ("Kraków" rather than "Krakow")
  if (here.length && !box.dataset.city) {
    const real = String(here[0].city).split(',')[0].trim();
    if (real) { const h1 = $('cityTitle'); if (h1) h1.textContent = `Photographers & creators in ${real}`; name = real; }
  }
  const isBoosted = (p) => !!(p.boosted_until && Date.parse(p.boosted_until) > Date.now());
  // Boosted, then founding creators, then fast responders (usually reply within an hour / a few hours / a day), then rating
  here.sort((a, b) => Number(isBoosted(b)) - Number(isBoosted(a)) || Number(isFounding(b)) - Number(isFounding(a)) || replyRank(b) - replyRank(a) || (Number(b.rating) || 0) - (Number(a.rating) || 0));
  visiting.sort((a, b) => (a._trip.from < b._trip.from ? -1 : 1));
  here.push(...visiting);
  const fromPrice = (p) => {
    const prices = (Array.isArray(p.packages) ? p.packages : []).map((k) => Number(k && k.price_eur)).filter((n) => n >= 10 && n <= 5000);
    return prices.length ? Math.min(...prices) : null;
  };
  const link = (p) => (p.handle && /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(p.handle) ? `/c/${p.handle}` : `/?creator=${encodeURIComponent(p.id)}`);
  const serviceText = (p) => (p.services || []).slice(0, 3).map((s) => (TAX && TAX.service(s) ? `${TAX.service(s).icon} ${TAX.service(s).label}` : s)).join(' · ');

  const f = (founding || []).find((c) => citySlug(c.city_label) === slug);
  const foundingHtml = f && f.spots_left > 0 ? `
    <div class="founding-open city-founding">
      <strong>🏅 Are you a creator in ${esc(f.city_label)}? ${esc(f.spots_left)} of ${esc(f.slots)} founding spots left</strong>
      <p class="muted small">The first creators here get a 🏅 badge on their profile${f.perk_days ? ` and a free ${esc(f.perk_days)}-day boost to the top of the results` : ''}. Listing yourself is free.</p>
      <a class="primary-btn" href="/#join-section" style="text-decoration:none">List yourself free</a>
    </div>` : '';

  if (error) { box.innerHTML = '<p class="muted">Could not load the creators right now. <a href="/">Browse everyone</a>.</p>'; return; }
  if (!here.length) {
    box.innerHTML = `<div class="city-empty">
        <h2>No creators in ${esc(name)} yet</h2>
        <p class="muted">We're growing city by city. Search for ${esc(name)} on CapturaGo and press <strong>🔔 Notify me</strong> — we'll email you once when a creator joins.</p>
        <a class="secondary-btn" href="/?city=${encodeURIComponent(name)}#portfolio-section" style="text-decoration:none">Notify me about ${esc(name)}</a>
      </div>${foundingHtml}`;
    return;
  }
  box.innerHTML = `
    <h2 class="city-live-title">${locals.length ? `${locals.length} creator${locals.length > 1 ? 's' : ''} in ${esc(name)}` : `Coming to ${esc(name)}`}${locals.length && visiting.length ? ` <span class="muted small">+ ${visiting.length} visiting soon</span>` : ''}</h2>
    <div class="city-grid">${here.slice(0, 24).map((p) => {
      const cover = safeUrl(p.cover_image_url);
      const price = fromPrice(p);
      const rating = Number(p.rating) || 0;
      return `<a class="city-card" href="${esc(link(p))}">
        <span class="city-card-img">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" />` : `<span class="city-card-initial" aria-hidden="true">${esc(String(p.name || '?').trim().charAt(0).toUpperCase())}</span>`}</span>
        <span class="city-card-body">
          <span class="city-card-tags">${isFounding(p) ? '<span class="badge badge-founding">🏅 Founding</span>' : ''}${isBoosted(p) ? '<span class="badge">Sponsored</span>' : ''}</span>
          <strong>${esc(p.name)}</strong>
          ${p._trip ? `<span class="small trip-tag">✈️ Here ${esc(tripDates(p._trip))} · from ${esc(String(p.city || '').split(',')[0])}</span>` : ''}
          <span class="muted small">${esc(serviceText(p))}</span>
          ${replyLabel(p) ? `<span class="small reply-time">💬 ${esc(replyLabel(p))}</span>` : ''}
          <span class="small">${rating > 0 ? `★ ${esc(rating.toFixed(1))} (${esc(p.reviews_count || 0)})` : 'New on CapturaGo'}${Number(p.completed_shoots) > 0 ? ` · 📸 ${esc(Number(p.completed_shoots))} shoot${Number(p.completed_shoots) === 1 ? '' : 's'}` : ''}${price ? ` · from €${esc(price)}` : ''}</span>
        </span>
      </a>`;
    }).join('')}</div>
    ${here.length > 24 ? `<p><a href="/?city=${encodeURIComponent(name)}#portfolio-section">See all ${esc(here.length)} creators in ${esc(name)} →</a></p>` : ''}
    ${foundingHtml}`;
});
