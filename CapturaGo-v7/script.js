/* ================================================================
   CapturaGo — homepage logic
   Depends on: vendor/supabase.umd.js, supabase.js (window.CG),
               vendor/leaflet (window.L), site.js (esc, safeUrl, showToast)
================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);

  /* ── LABELS ─────────────────────────────────────────── */
  const { SERVICES, VIBES, OCCASIONS, SERVICE_LABELS, SERVICE_ICONS, VIBE_LABELS, OCCASION_LABELS, OCCASION_ICONS } = CG_CATS;
  const PRICE_LABELS   = { budget: 'Under €80', mid: '€80–€250', premium: '€250+' };
  const LEVEL_LABELS   = { enthusiast: 'Enthusiast', semipro: 'Semi-pro', pro: 'Professional' };
  const EUROPE_VIEW    = { center: [49, 12], zoom: 4 };
  const SHOW_EXAMPLES_BELOW = 6;   // examples are shown until there are this many real creators

  const DESTINATIONS = [
    { city: 'Bali',        country: 'Indonesia', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=60' },
    { city: 'Kyoto',       country: 'Japan',     img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=60' },
    { city: 'Vienna',      country: 'Austria',   img: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=600&q=60' },
    { city: 'Santorini',   country: 'Greece',    img: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=600&q=60' },
    { city: 'Marrakech',   country: 'Morocco',   img: 'https://images.unsplash.com/photo-1539020140153-e479b8f01beb?auto=format&fit=crop&w=600&q=60' },
    { city: 'Bangkok',     country: 'Thailand',  img: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=60' },
    { city: 'Berlin',      country: 'Germany',   img: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=600&q=60' },
    { city: 'Mexico City', country: 'Mexico',    img: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&w=600&q=60' }
  ];

  /* ── EXAMPLE PROFILES (clearly labelled, never bookable) ── */
  const EXAMPLES = [
    { id: 'ex-1', isExample: true, name: 'Yuki T.', city: 'Kyoto, Japan', coords: { lat: 35.0116, lon: 135.7681 },
      services: ['photo', 'guide'], price: 'mid', level: 'semipro', rating: 4.9, reviews_count: 0, vibes: ['moody', 'cinematic'], occasions: ['travel', 'proposal', 'couples'], available: true, travel_available: false,
      description: 'Born and raised in Kyoto. Temple spots most tourists never find — bamboo groves at dawn, mossy stone paths. Soft, cinematic, deeply Japanese.',
      tags: ['Travel', 'Portraits', 'Golden hour'], languages: 'English, Japanese',
      local_spots: [{ name: 'Fushimi Inari back gate', desc: 'Almost empty at 6am' }, { name: "Philosopher's Path at dawn", desc: 'Cherry blossom reflections in spring' }],
      packages: [{ id: 'e1', name: 'Sunrise temple walk', minutes: 90, price_eur: 140, desc: '2 locations, 40 edited photos' }, { id: 'e2', name: 'Mini portrait session', minutes: 45, price_eur: 85, desc: '20 edited photos' }],
      cover_image_url: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1200&q=70' },
    { id: 'ex-2', isExample: true, name: 'Marco D.', city: 'Bali, Indonesia', coords: { lat: -8.4095, lon: 115.1889 },
      services: ['photo', 'video', 'guide'], price: 'budget', level: 'enthusiast', rating: 4.8, reviews_count: 0, vibes: ['golden', 'film'], occasions: ['travel', 'solo', 'couples'], available: true, travel_available: true,
      description: 'Not a pro — but I know every sunset spot, rice terrace and waterfall on the island. Warm, honest, alive photos.',
      tags: ['Travel', 'Lifestyle', 'Sunset'], languages: 'English, Italian',
      local_spots: [{ name: 'Tegallalang at sunrise', desc: 'Go at 5am for empty terraces' }, { name: 'Uluwatu cliffs at dusk', desc: 'Temple silhouette at blue hour' }],
      cover_image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=70' },
    { id: 'ex-3', isExample: true, name: 'Elena M.', city: 'Vienna, Austria', coords: { lat: 48.2082, lon: 16.3738 },
      services: ['photo', 'edit'], price: 'premium', level: 'pro', rating: 5.0, reviews_count: 0, vibes: ['editorial', 'airy'], occasions: ['wedding', 'couples', 'headshots'], available: true, travel_available: true,
      description: 'Portrait and editorial photographer. Clean, cinematic and timeless. Couples, weddings and brand shoots across Central Europe.',
      tags: ['Weddings', 'Portraits', 'Editorial'], languages: 'English, German',
      local_spots: [{ name: 'Belvedere gardens', desc: 'Best at 7am before crowds' }, { name: 'Prater chestnut alley', desc: 'Blossom tunnel in spring' }],
      cover_image_url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=70' },
    { id: 'ex-4', isExample: true, name: 'Lena B.', city: 'Berlin, Germany', coords: { lat: 52.52, lon: 13.405 },
      services: ['video', 'edit'], price: 'premium', level: 'pro', rating: 4.8, reviews_count: 0, vibes: ['moody', 'cinematic'], occasions: ['content', 'business', 'travel'], available: true, travel_available: true,
      description: 'Cinematic videographer and editor — travel films, reels and brand content that feel like a series.',
      tags: ['Cinematic', 'Reels', 'Brand'], languages: 'English, German',
      local_spots: [{ name: 'Tempelhof airfield', desc: 'Huge sky, brutalist backdrop' }, { name: 'Neukölln canal at night', desc: 'Neon reflections for reels' }],
      cover_image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=70' },
    { id: 'ex-5', isExample: true, name: 'Nina P.', city: 'Mexico City, Mexico', coords: { lat: 19.4326, lon: -99.1332 },
      services: ['phone', 'guide'], price: 'budget', level: 'enthusiast', rating: 4.9, reviews_count: 0, vibes: ['flash', 'digicam', 'candid'], occasions: ['solo', 'birthday', 'content'], available: true, travel_available: false,
      description: 'I shoot on YOUR phone, so the photos and Reels are ready to post before dinner. Flash at night, candid by day — taco spots included.',
      tags: ['Phone content', 'Photo dumps', 'Reels'], languages: 'English, Spanish',
      local_spots: [{ name: 'Roma Norte at night', desc: 'Neon and murals for flash shots' }, { name: 'Casa Azul street', desc: 'Cobalt walls, best mid-morning' }],
      packages: [{ id: 'e3', name: 'Photo dump walk', minutes: 60, price_eur: 45, desc: 'Shot on your phone, 3 spots, 1 Reel' }],
      cover_image_url: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&w=1200&q=70' },
    { id: 'ex-6', isExample: true, name: 'Nikos A.', city: 'Santorini, Greece', coords: { lat: 36.3932, lon: 25.4615 },
      services: ['drone', 'photo'], price: 'premium', level: 'pro', rating: 5.0, reviews_count: 0, vibes: ['golden', 'vibrant'], occasions: ['proposal', 'wedding', 'business'], drone_certified: true, available: true, travel_available: true,
      description: 'Certified drone pilot. Caldera views from above at sunset — proposals, weddings and villa shoots, on the ground and in the air.',
      tags: ['Drone', 'Aerial', 'Sunset'], languages: 'English, Greek',
      local_spots: [{ name: 'Imerovigli cliffs', desc: 'Skaros Rock from above at golden hour' }, { name: 'Amoudi Bay', desc: 'Turquoise water, early morning' }],
      cover_image_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=70' }
  ];

  /* ── STATE ──────────────────────────────────────────── */
  let currentUser = null;
  let userListing = null;
  let userFavorites = [];
  let allReal = [];          // every real creator (for counts/ticker)
  let shown = [];            // what's currently on screen
  let activeType = '';
  let activeVibe = '';
  let activeOccasion = '';
  let allRealReady = Promise.resolve();   // resolves once allReal is loaded

  /* ── SMALL HELPERS ──────────────────────────────────── */
  const starRating = (r) => { const f = Math.round(Number(r) || 0); return '★'.repeat(f) + '☆'.repeat(5 - f); };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'the creator';
  const coordsOf = (p) => {
    const c = p?.coords;
    if (!c) return null;
    const lat = Array.isArray(c) ? c[0] : c.lat, lon = Array.isArray(c) ? c[1] : c.lon;
    return (Number.isFinite(+lat) && Number.isFinite(+lon)) ? [+lat, +lon] : null;
  };
  const spotsOf = (p) => {
    let s = p?.local_spots;
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = []; } }
    return Array.isArray(s) ? s.filter(x => x && (x.name || typeof x === 'string')) : [];
  };
  const coverOf = (p) => safeUrl(p?.cover_image_url) || 'images/default.jpg';
  const imgFallback = `onerror="this.onerror=null;this.src='images/default.jpg'"`;
  const timeAgo = (d) => {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const servicesBadges = (services = []) => services.slice(0, 3).map(s =>
    `<span class="ctb ctb-svc">${SERVICE_ICONS[s] || ''} ${esc(SERVICE_LABELS[s] || s)}</span>`).join('')
    + (services.length > 3 ? `<span class="ctb ctb-svc">+${services.length - 3}</span>` : '');
  const verifiedBadge = (v) => {
    const lvl = Number(v) || 0;
    if (!lvl) return '';
    const labels = { 1: '✓ Verified', 2: '✓✓ Portfolio reviewed', 3: '✓✓✓ ID verified' };
    return `<span class="verified-badge verified-${Math.min(lvl, 3)}">${labels[Math.min(lvl, 3)]}</span>`;
  };
  const exampleTag = (p) => p.isExample ? '<span class="example-tag">Example</span>' : '';
  const CLIENT_FEE = Number(window.CG_CONFIG?.clientFeePercent ?? 10);
  const packagesOf = (p) => (Array.isArray(p?.packages) ? p.packages : []).filter(k => k && k.id && Number(k.price_eur) >= 10 && Number(k.price_eur) <= 5000);
  const fromPrice = (p) => { const ps = packagesOf(p).map(k => Number(k.price_eur)); return ps.length ? Math.min(...ps) : null; };
  const isBoosted = (p) => !!(p && p.boosted_until && Date.parse(p.boosted_until) > Date.now());
  const canBook = (p) => !!p && !p.isExample && !!p.payouts_enabled && packagesOf(p).length > 0;
  const money = (eur) => { const n = Number(eur); return `€${Number.isInteger(n) ? n : n.toFixed(2)}`; };

  /* ── CATEGORY CONTROLS (built from categories.js) ───── */
  $('heroService').insertAdjacentHTML('beforeend', CG_CATS.serviceOptions(false));
  $('stickyType').insertAdjacentHTML('beforeend', CG_CATS.serviceOptions(true));
  $('occasionFilter').insertAdjacentHTML('beforeend', CG_CATS.occasionOptions());
  $('typePills').insertAdjacentHTML('beforeend', SERVICES.map(s => `<button class="pill" data-type="${esc(s.id)}">${s.icon} ${esc(s.plural)}</button>`).join(''));
  $('vibePills').insertAdjacentHTML('beforeend', VIBES.map(v => `<button class="vibe-pill" data-vibe="${esc(v.id)}">${v.icon} ${esc(v.label)}</button>`).join(''));
  CG_CATS.fill('servicesChecks', CG_CATS.checkboxes(SERVICES, 'services'));
  CG_CATS.fill('vibesChecks', CG_CATS.checkboxes(VIBES, 'vibes'));
  CG_CATS.fill('occasionsChecks', CG_CATS.checkboxes(OCCASIONS, 'occasions'));
  if ($('statCreatorTypes')) $('statCreatorTypes').textContent = SERVICES.length;
  const syncDroneRow = () => {
    const on = !!document.querySelector('input[name="services"][value="drone"]:checked');
    $('droneCertRow').hidden = !on;
    if (!on) $('droneCertInput').checked = false;
  };
  document.querySelectorAll('input[name="services"]').forEach(i => i.addEventListener('change', syncDroneRow));

  /* ── MODALS ─────────────────────────────────────────── */
  function openModal(id) { $(id)?.classList.add('modal-open'); document.body.style.overflow = 'hidden'; }
  function closeModal(id) {
    $(id)?.classList.remove('modal-open');
    if (!document.querySelector('.modal.modal-open')) document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-close]').forEach(el =>
    el.addEventListener('click', () => closeModal(el.dataset.close)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ['detailModal', 'inquiryModal', 'authModal'].forEach(closeModal);
  });

  /* ── AUTH ───────────────────────────────────────────── */
  async function refreshAuth() {
    currentUser = await CG.auth.getUser();
    userListing = null; userFavorites = [];
    if (currentUser) {
      const [{ data: listing }, favs] = await Promise.all([
        CG.photographers.getByUserId(currentUser.id),
        CG.favorites.get(currentUser.id)
      ]);
      userListing = listing || null;
      userFavorites = favs || [];
    }
    renderNavAuth();
    renderAddFormState();
  }

  function renderNavAuth() {
    const nav = $('navAuth'), sticky = $('stickyAuth');
    if (currentUser) {
      const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
      nav.innerHTML = `
        <a href="/dashboard.html" class="ghost-btn nav-auth-btn" style="text-decoration:none">Dashboard</a>
        <span class="nav-user-name">${esc(name)}</span>
        <button class="nav-signout-btn" id="navSignOut" title="Sign out" aria-label="Sign out">↪</button>`;
      sticky.innerHTML = `<a href="/dashboard.html" class="sticky-link">Dashboard →</a>`;
      $('navSignOut').addEventListener('click', async () => {
        await CG.auth.signOut();
        await refreshAuth();
        loadCreators();
        showToast('Signed out.', 'info');
      });
    } else {
      nav.innerHTML = `<button class="ghost-btn nav-auth-btn" id="navSignIn">Sign in</button>`;
      sticky.innerHTML = `<button class="sticky-signin" id="stickySignIn">Sign in</button>`;
      $('navSignIn').addEventListener('click', () => openAuth('signin'));
      $('stickySignIn').addEventListener('click', () => openAuth('signin'));
    }
  }

  function renderAddFormState() {
    $('addFormAuthGate').hidden = !!currentUser;
    $('addFormHasListing').hidden = !(currentUser && userListing);
    $('addFormFields').hidden = !(currentUser && !userListing);
    if (currentUser && !userListing) {
      if (!$('nameInput').value) $('nameInput').value = currentUser.user_metadata?.full_name || '';
      if (!$('emailInput').value) $('emailInput').value = currentUser.email || '';
    }
  }

  function openAuth(tab = 'signin') { switchAuthTab(tab); openModal('authModal'); }
  function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('signInForm').style.display = tab === 'signin' ? 'block' : 'none';
    $('signUpForm').style.display = tab === 'signup' ? 'block' : 'none';
    $('forgotForm').style.display = tab === 'forgot' ? 'block' : 'none';
    document.querySelector('.auth-tabs').style.display = tab === 'forgot' ? 'none' : 'flex';
    ['signInError', 'signUpError', 'signUpSuccess', 'forgotError', 'forgotSuccess'].forEach(id => { $(id).textContent = ''; });
  }
  document.querySelectorAll('.auth-tab').forEach(b => b.addEventListener('click', () => switchAuthTab(b.dataset.tab)));
  $('forgotBtn').addEventListener('click', () => { $('fpEmail').value = $('siEmail').value; switchAuthTab('forgot'); });
  document.querySelectorAll('[data-tab-link]').forEach(b => b.addEventListener('click', () => switchAuthTab(b.dataset.tabLink)));
  $('addFormSignIn').addEventListener('click', () => openAuth('signup'));

  function friendlyAuthError(msg = '') {
    const m = msg.toLowerCase();
    if (m.includes('invalid login')) return 'Wrong email or password.';
    if (m.includes('not confirmed')) return 'Please confirm your email first — check your inbox (and spam folder).';
    if (m.includes('already registered')) return 'This email already has an account. Try signing in.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a few minutes and try again.';
    if (m.includes('password')) return msg;
    return msg || 'Something went wrong. Please try again.';
  }

  $('signInForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Signing in…';
    const { error } = await CG.auth.signIn($('siEmail').value.trim(), $('siPassword').value);
    btn.disabled = false; btn.textContent = 'Sign in';
    if (error) { $('signInError').textContent = friendlyAuthError(error.message); return; }
    closeModal('authModal');
    await refreshAuth();
    loadCreators();
    showToast('Welcome back! 👋', 'success');
  });

  $('signUpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('suName').value.trim(), email = $('suEmail').value.trim(), pw = $('suPassword').value;
    if (!name) { $('signUpError').textContent = 'Please enter your name.'; return; }
    if (pw.length < 8) { $('signUpError').textContent = 'Password must be at least 8 characters.'; return; }
    if (!$('suConsent').checked) { $('signUpError').textContent = 'Please confirm you are 18+ and accept the Terms and Privacy Policy.'; return; }
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Creating…';
    const { data, error } = await CG.auth.signUp(email, pw, name);
    btn.disabled = false; btn.textContent = 'Create account';
    if (error) { $('signUpError').textContent = friendlyAuthError(error.message); return; }
    $('signUpError').textContent = '';
    if (data?.session) {
      closeModal('authModal');
      await refreshAuth();
      showToast(`Welcome to CapturaGo, ${firstName(name)}! 🎉`, 'success');
    } else {
      $('signUpSuccess').textContent = 'Almost done! We sent a confirmation link to your email. Open it, then sign in here. (Check spam if you don\'t see it.)';
      e.target.reset();
    }
  });

  $('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Sending…';
    const { error } = await CG.auth.resetPassword($('fpEmail').value.trim());
    btn.disabled = false; btn.textContent = 'Send reset link';
    if (error) { $('forgotError').textContent = friendlyAuthError(error.message); return; }
    $('forgotSuccess').textContent = 'If an account exists for this email, a reset link is on its way.';
  });

  /* ── NAV ────────────────────────────────────────────── */
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = navLinks.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('nav-open') && !e.target.closest('.nav-links')) {
      navLinks.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
  navLinks.addEventListener('click', (e) => { if (e.target.tagName === 'A') navLinks.classList.remove('nav-open'); });

  /* Sticky bar appears once the hero scrolls away */
  const stickyObs = new IntersectionObserver(([entry]) => {
    $('stickyBar').classList.toggle('visible', !entry.isIntersecting);
  }, { threshold: 0.05 });
  stickyObs.observe(document.querySelector('.hero'));

  /* ── SEARCH ENTRY POINTS ────────────────────────────── */
  function runSearch(city, type) {
    $('cityFilter').value = city || '';
    if (type !== undefined) setType(type);
    $('portfolio-section').scrollIntoView({ behavior: 'smooth' });
    loadCreators();
  }
  $('heroSearchBtn').addEventListener('click', () => runSearch($('heroDestination').value.trim(), $('heroService').value));
  $('heroDestination').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('heroSearchBtn').click(); });
  $('stickySearchBtn').addEventListener('click', () => runSearch($('stickyCity').value.trim(), $('stickyType').value));
  $('stickyCity').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('stickySearchBtn').click(); });

  /* ── DESTINATIONS ───────────────────────────────────── */
  function renderDestinations() {
    $('destTrack').innerHTML = DESTINATIONS.map(d => {
      const n = allReal.filter(c => String(c.city || '').toLowerCase().includes(d.city.toLowerCase())).length;
      const count = n > 0 ? `${n} creator${n > 1 ? 's' : ''}` : 'Be the first here';
      return `
        <button class="dest-card" data-city="${esc(d.city)}" aria-label="Show creators in ${esc(d.city)}">
          <div class="dest-img" style="background-image:linear-gradient(160deg,rgba(0,0,0,.25),rgba(0,0,0,.65)),url('${esc(d.img)}')">
            <div class="dest-card-content"><strong>${esc(d.city)}</strong><span>${esc(d.country)}</span></div>
          </div>
          <div class="dest-meta"><span class="dest-count">${count}</span><span class="dest-from">View →</span></div>
        </button>`;
    }).join('');
    $('destTrack').querySelectorAll('.dest-card').forEach(c =>
      c.addEventListener('click', () => runSearch(c.dataset.city)));
  }

  /* ── RECENTLY JOINED TICKER (real creators only) ────── */
  function renderTicker() {
    const recent = allReal.slice(0, 12);
    if (recent.length < 3) { $('tickerSection').hidden = true; return; }
    const item = (c) => `
      <div class="ticker-item">
        <div class="ticker-avatar">${esc(firstName(c.name).charAt(0).toUpperCase())}</div>
        <span><strong>${esc(firstName(c.name))}</strong> from <strong>${esc(c.city)}</strong> joined CapturaGo</span>
      </div>`;
    const html = recent.map(item).join('');
    $('tickerInner').innerHTML = html + html;   // doubled for a seamless loop
    $('tickerSection').hidden = false;
  }

  /* ── MAP ────────────────────────────────────────────── */
  const map = L.map('map', { worldCopyJump: true, minZoom: 2 }).setView(EUROPE_VIEW.center, EUROPE_VIEW.zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  const markersLayer = L.layerGroup().addTo(map);
  const pinIcon = L.divIcon({ className: '', html: '<div class="custom-marker"></div>', iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -28] });

  function refreshMarkers(list, fitToResults) {
    markersLayer.clearLayers();
    const points = [];
    list.forEach(p => {
      const c = coordsOf(p);
      if (!c) return;
      const popup = document.createElement('div');
      popup.className = 'map-popup';
      popup.innerHTML = `
        <strong>${esc(p.name)}</strong> ${p.isExample ? '<em>(example)</em>' : ''}<br/>
        <span>📍 ${esc(p.city)}</span><br/>
        <span>${esc((p.services || []).map(s => SERVICE_LABELS[s] || s).join(', '))}</span><br/>
        <a href="#">View profile →</a>`;
      popup.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); openDetail(p.id); });
      L.marker(c, { icon: pinIcon }).addTo(markersLayer).bindPopup(popup, { maxWidth: 240 });
      points.push(c);
    });
    if (fitToResults && points.length) {
      map.fitBounds(L.latLngBounds(points).pad(0.5), { maxZoom: 11 });
    } else if (!fitToResults) {
      map.setView(EUROPE_VIEW.center, EUROPE_VIEW.zoom);
    }
  }

  function renderMapList(list) {
    const ul = $('mapResults');
    $('resultCount').textContent = list.length;
    if (!list.length) {
      ul.innerHTML = '<li class="map-empty">No creators here yet.</li>';
      return;
    }
    ul.innerHTML = list.map(p => `
      <li data-id="${esc(p.id)}">
        <div class="result-name">${esc(p.name)} ${exampleTag(p)}${p.available !== false ? '<span class="dot-available" title="Available"></span>' : ''}</div>
        <div class="result-meta">📍 ${esc(p.city)}</div>
        <div class="result-type">${esc((p.services || []).map(s => SERVICE_LABELS[s] || s).join(' · '))}</div>
        ${PRICE_LABELS[p.price] ? `<span class="result-price">${PRICE_LABELS[p.price]}</span>` : ''}
      </li>`).join('');
    ul.querySelectorAll('li[data-id]').forEach(li => li.addEventListener('click', () => {
      const p = shown.find(x => String(x.id) === li.dataset.id);
      const c = coordsOf(p);
      if (c) map.setView(c, 12);
      openDetail(li.dataset.id);
    }));
  }

  /* ── CREATOR GRID ───────────────────────────────────── */
  function showSkeletons(n = 6) {
    $('portfolioGrid').innerHTML = Array(n).fill(
      '<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-body"><div class="skeleton-line w60"></div><div class="skeleton-line w40"></div><div class="skeleton-line w80"></div><div class="skeleton-line w50"></div></div></div>'
    ).join('');
  }

  function renderGrid(list) {
    const grid = $('portfolioGrid');
    if (!list.length) {
      const city = $('cityFilter').value.trim();
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-icon">🔭</div>
          <h3>${city ? `No creators in ${esc(city)} yet` : 'No creators match these filters'}</h3>
          <p>${city ? 'Know a great photographer, videographer or editor there? Send them CapturaGo — listing is free.' : 'Try removing a filter.'}</p>
          <div class="empty-actions">
            <button class="secondary-btn" id="emptyClear">Clear filters</button>
            ${city ? '<button class="primary-btn" id="emptyShare">Copy invite link</button>' : ''}
          </div>
        </div>`;
      $('emptyClear').addEventListener('click', clearFilters);
      $('emptyShare')?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText('https://capturago.com/#join-section'); showToast('Invite link copied!', 'success'); }
        catch { showToast('Copy this link: capturago.com', 'info'); }
      });
      return;
    }

    grid.innerHTML = list.map((p, i) => {
      const spots = spotsOf(p);
      const isFav = userFavorites.includes(p.id);
      const desc = String(p.description || '');
      return `
        <article class="portfolio-card reveal ${p.isExample ? 'is-example' : ''}" data-id="${esc(p.id)}" style="transition-delay:${Math.min(i, 8) * 0.06}s" tabindex="0">
          <div class="portfolio-image-wrapper">
            <img src="${esc(coverOf(p))}" ${imgFallback} alt="${esc(p.name)} — cover photo" loading="lazy" />
            <div class="creator-type-badges">${p.isExample ? '<span class="ctb ctb-example">Example</span>' : ''}${isBoosted(p) ? '<span class="ctb ctb-sponsored" title="Paid placement">Sponsored</span>' : ''}${servicesBadges(p.services || [])}</div>
            <div class="portfolio-image-overlay"><span class="portfolio-overlay-btn">View profile</span></div>
            ${p.available !== false ? '<div class="available-dot" title="Available"></div>' : ''}
            ${p.isExample ? '' : `<button class="fav-btn ${isFav ? 'fav-active' : ''}" data-fav="${esc(p.id)}" aria-label="Save to favourites">♥</button>`}
          </div>
          <div class="portfolio-body">
            <h3>${esc(p.name)}${verifiedBadge(p.verified)}</h3>
            <div class="portfolio-rating">${p.reviews_count > 0 ? `${starRating(p.rating)} <small>${Number(p.rating).toFixed(1)} · ${p.reviews_count} review${p.reviews_count > 1 ? 's' : ''}</small>` : '<small class="muted">New on CapturaGo</small>'}</div>
            <p class="portfolio-location">📍 ${esc(p.city)}${p.travel_available ? ' · <span class="travels">✈ Travels</span>' : ''}</p>
            ${spots.length ? `<div class="spots-count-pill">🗺️ ${spots.length} local spot${spots.length > 1 ? 's' : ''}</div>` : ''}
            ${p._reason ? `<p class="ai-reason">✦ ${esc(p._reason)}</p>` : ''}
            <p class="portfolio-description">${esc(desc.slice(0, 120))}${desc.length > 120 ? '…' : ''}</p>
            <div class="portfolio-tags">${(p.vibes || []).slice(0, 3).map(v => `<span>${esc(VIBE_LABELS[v] || v)}</span>`).join('')}</div>
            <div class="portfolio-footer">
              ${p.isExample
                ? '<span class="muted small">Example profile</span>'
                : `<button class="secondary-btn inquiry-btn" data-inq="${esc(p.id)}">Send inquiry</button>`}
              <span class="portfolio-price">${fromPrice(p) ? `From ${money(fromPrice(p))}` : (PRICE_LABELS[p.price] || '')}${canBook(p) ? ' <span class="book-chip">Book online</span>' : ''}</span>
            </div>
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('.portfolio-card').forEach(card => {
      const open = () => openDetail(card.dataset.id);
      card.addEventListener('click', (e) => { if (!e.target.closest('.fav-btn,.inquiry-btn')) open(); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === card) open(); });
    });
    grid.querySelectorAll('[data-fav]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(btn.dataset.fav, btn); }));
    grid.querySelectorAll('[data-inq]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openInquiry(btn.dataset.inq); }));
    grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  }

  async function toggleFav(id, btn) {
    if (!currentUser) { openAuth('signin'); showToast('Sign in to save favourites.', 'info'); return; }
    const { added, error } = await CG.favorites.toggle(currentUser.id, id);
    if (error) { showToast('Could not update favourites. Try again.', 'error'); return; }
    if (added) userFavorites.push(id); else userFavorites = userFavorites.filter(f => f !== id);
    document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach(b => b.classList.toggle('fav-active', added));
    if (btn) btn.classList.toggle('fav-active', added);
    showToast(added ? 'Saved to favourites ♥' : 'Removed from favourites.', added ? 'success' : 'info');
  }

  /* ── FILTERS ────────────────────────────────────────── */
  function setType(type) {
    activeType = type || '';
    document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.type === activeType));
  }
  function setVibe(vibe) {
    activeVibe = vibe || '';
    document.querySelectorAll('.vibe-pill').forEach(p => p.classList.toggle('active', p.dataset.vibe === activeVibe));
  }
  function clearFilters() {
    $('cityFilter').value = ''; $('priceFilter').value = ''; $('occasionFilter').value = ''; $('availableFilter').checked = false;
    activeOccasion = '';
    setType(''); setVibe('');
    loadCreators();
  }
  document.querySelectorAll('.pill').forEach(p => p.addEventListener('click', () => { setType(p.dataset.type); loadCreators(); }));
  document.querySelectorAll('.vibe-pill').forEach(p => p.addEventListener('click', () => { setVibe(p.dataset.vibe); loadCreators(); }));
  $('cityFilter').addEventListener('input', debounce(loadCreators, 400));
  $('priceFilter').addEventListener('change', loadCreators);
  $('occasionFilter').addEventListener('change', () => { activeOccasion = $('occasionFilter').value; loadCreators(); });
  $('availableFilter').addEventListener('change', loadCreators);
  $('clearFilters').addEventListener('click', clearFilters);

  function clientFilter(list) {
    const price = $('priceFilter').value, onlyAvailable = $('availableFilter').checked;
    return list.filter(c =>
      (!activeType || (c.services || []).includes(activeType)) &&
      (!activeVibe || (c.vibes || []).includes(activeVibe)) &&
      (!activeOccasion || (c.occasions || []).includes(activeOccasion)) &&
      (!price || c.price === price) &&
      (!onlyAvailable || c.available !== false));
  }

  let loadToken = 0;
  async function loadCreators() {
    const token = ++loadToken;
    showSkeletons(6);
    const city = $('cityFilter').value.trim();
    const { data, error } = await CG.photographers.getAll({ city: city || undefined, price: $('priceFilter').value || undefined });
    if (token !== loadToken) return;            // a newer search started — ignore this one
    if (error) showToast("Couldn't load creators right now. Please refresh.", 'error');

    await allRealReady;
    if (token !== loadToken) return;
    const real = clientFilter(data || []);
    real.sort((a, b) => Number(isBoosted(b)) - Number(isBoosted(a)));   // stable: keeps the rest in order
    aiActive = false;
    $('aiStatus').hidden = true;
    let examples = [];
    if (!city && allReal.length < SHOW_EXAMPLES_BELOW) examples = clientFilter(EXAMPLES);

    shown = [...real, ...examples];
    $('exampleNotice').hidden = examples.length === 0;
    renderGrid(shown);
    renderMapList(shown);
    refreshMarkers(shown, !!city);
  }

  async function loadAllReal() {
    const { data } = await CG.photographers.getAll({});
    allReal = data || [];
    renderDestinations();
    renderTicker();
  }

  /* ── DETAIL MODAL ───────────────────────────────────── */
  async function findCreator(id) {
    const local = shown.find(p => String(p.id) === String(id)) || EXAMPLES.find(p => p.id === id);
    if (local) return local;
    const { data } = await CG.photographers.getById(id);
    return data;
  }

  async function openDetail(id) {
    const box = $('detailContent');
    box.innerHTML = '<div class="modal-loading">Loading…</div>';
    openModal('detailModal');

    const p = await findCreator(id);
    if (!p) { box.innerHTML = '<div class="modal-loading">This profile is no longer available.</div>'; return; }
    const isOwn = !!(currentUser && p.user_id === currentUser.id);
    if (!p.isExample && !isOwn) CG.incrementViews(p.id);

    const spots = spotsOf(p);
    const reviewsRes = p.isExample ? { data: [] } : await CG.reviews.get(p.id);
    const reviews = reviewsRes.data || [];
    const portfolio = safeUrl(p.portfolio_url);
    const isFav = userFavorites.includes(p.id);

    let writeReview;
    if (p.isExample) writeReview = '<p class="muted">Example profiles can\'t be reviewed.</p>';
    else if (!currentUser) writeReview = '<p class="muted">Only signed-in users can leave reviews. <button class="link-btn" id="rvSignIn">Sign in</button></p>';
    else if (isOwn) writeReview = '<p class="muted">You can\'t review your own listing.</p>';
    else writeReview = `
      <form id="reviewForm" class="review-form">
        <div class="star-picker" id="starPicker" data-rating="5" role="radiogroup" aria-label="Rating">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-val="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
        </div>
        <textarea id="rvComment" rows="3" maxlength="1000" placeholder="How was your experience with ${esc(firstName(p.name))}?"></textarea>
        <p class="form-note">Only review creators you actually worked with. Your name will be shown publicly.</p>
        <button type="submit" class="secondary-btn">Submit review</button>
      </form>`;

    box.innerHTML = `
      <img class="modal-img" src="${esc(coverOf(p))}" ${imgFallback} alt="${esc(p.name)}" />
      <div class="modal-body">
        ${p.isExample ? '<div class="example-notice compact">This is an <strong>example profile</strong> showing how CapturaGo works. It is not a real creator.</div>' : ''}
        <h2>${esc(p.name)}${verifiedBadge(p.verified)}</h2>
        <div class="modal-meta">
          <span>📍 ${esc(p.city)}</span>
          ${(p.services || []).map(s => `<span class="badge">${esc(SERVICE_LABELS[s] || s)}</span>`).join('')}
          ${(p.vibes || []).map(v => `<span class="badge badge-soft">${esc(VIBE_LABELS[v] || v)}</span>`).join('')}
          ${(p.services || []).includes('drone') && p.drone_certified ? '<span class="badge badge-soft" title="Confirmed by the creator">🚁 Certified drone pilot</span>' : ''}
          ${PRICE_LABELS[p.price] ? `<span class="badge">${PRICE_LABELS[p.price]}</span>` : ''}
          ${LEVEL_LABELS[p.level] ? `<span class="badge badge-soft">${LEVEL_LABELS[p.level]}</span>` : ''}
          ${p.available !== false ? '<span class="ok">● Available</span>' : '<span class="muted">Not available right now</span>'}
          ${p.travel_available ? '<span class="travels">✈ Travels</span>' : ''}
          ${p.languages ? `<span class="muted">🗣 ${esc(p.languages)}</span>` : ''}
          ${p.reviews_count > 0 ? `<span class="stars-inline">${starRating(p.rating)} ${Number(p.rating).toFixed(1)} (${p.reviews_count})</span>` : ''}
        </div>
        <p class="modal-desc">${esc(p.description || '')}</p>
        ${(p.occasions || []).length ? `<div class="occasion-row"><span class="occasion-label">Great for</span>${p.occasions.map(o => `<span class="badge badge-soft">${OCCASION_ICONS[o] || ''} ${esc(OCCASION_LABELS[o] || o)}</span>`).join('')}</div>` : ''}
        ${renderPackages(p, isOwn)}
        <div class="modal-actions">
          ${p.isExample || isOwn ? '' : '<button class="primary-btn" id="mInquiry">Send inquiry</button>'}
          ${isOwn ? '<a class="primary-btn" href="/dashboard.html" style="text-decoration:none">Edit my listing</a>' : ''}
          ${portfolio ? `<a class="secondary-btn" href="${esc(portfolio)}" target="_blank" rel="noopener nofollow" style="text-decoration:none">View portfolio →</a>` : ''}
          ${p.isExample ? '' : `<button class="fav-btn fav-inline ${isFav ? 'fav-active' : ''}" id="mFav" data-fav="${esc(p.id)}" aria-label="Save to favourites">♥</button>`}
        </div>
        <div class="detail-tabs" role="tablist">
          <button class="detail-tab active" data-panel="spots">🗺️ Local spots (${spots.length})</button>
          <button class="detail-tab" data-panel="reviews">⭐ Reviews (${reviews.length})</button>
          <button class="detail-tab" data-panel="write">Write a review</button>
        </div>
        <div class="detail-panel active" data-panel-id="spots">
          ${spots.length
            ? `<div class="spots-grid">${spots.map(s => `<div class="spot-card"><strong>${esc(s.name || s)}</strong>${s.desc ? `<p>${esc(s.desc)}</p>` : ''}</div>`).join('')}</div>
               <p class="muted small" style="margin-top:12px">Book ${esc(firstName(p.name))} and ask to include these spots in your shoot.</p>`
            : '<p class="muted">No local spots listed yet.</p>'}
        </div>
        <div class="detail-panel" data-panel-id="reviews">
          ${reviews.length
            ? reviews.slice(0, 20).map(r => `
              <div class="review-item">
                <div class="review-header"><strong>${esc(r.reviewer_name)}</strong><span class="stars-inline">${starRating(r.rating)}</span><span class="muted small">${timeAgo(r.created_at)}</span></div>
                ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
              </div>`).join('')
            : '<p class="muted">No reviews yet.</p>'}
        </div>
        <div class="detail-panel" data-panel-id="write">${writeReview}</div>
      </div>`;

    box.querySelectorAll('.detail-tab').forEach(tab => tab.addEventListener('click', () => {
      box.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t === tab));
      box.querySelectorAll('.detail-panel').forEach(pn => pn.classList.toggle('active', pn.dataset.panelId === tab.dataset.panel));
    }));
    $('mInquiry')?.addEventListener('click', () => { closeModal('detailModal'); openInquiry(p.id); });
    box.querySelectorAll('.book-btn').forEach(btn => btn.addEventListener('click', () => { closeModal('detailModal'); openBooking(p, btn.dataset.pkg); }));
    $('mFav')?.addEventListener('click', () => toggleFav(p.id, $('mFav')));
    $('rvSignIn')?.addEventListener('click', () => { closeModal('detailModal'); openAuth('signin'); });

    const picker = $('starPicker');
    if (picker) {
      const paint = (v) => picker.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i < v));
      paint(5);
      picker.querySelectorAll('button').forEach(b => {
        b.addEventListener('mouseenter', () => paint(+b.dataset.val));
        b.addEventListener('click', () => { picker.dataset.rating = b.dataset.val; paint(+b.dataset.val); });
      });
      picker.addEventListener('mouseleave', () => paint(+picker.dataset.rating));
    }

    $('reviewForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Submitting…';
      const { error } = await CG.reviews.add({
        photographer_id: p.id,
        user_id: currentUser.id,
        reviewer_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
        rating: +picker.dataset.rating,
        comment: $('rvComment').value.trim() || null
      });
      btn.disabled = false; btn.textContent = 'Submit review';
      if (error) {
        const dup = (error.code === '23505') || /duplicate|unique/i.test(error.message || '');
        showToast(dup ? "You've already reviewed this creator." : 'Could not submit your review. Please try again.', 'error');
        return;
      }
      showToast('Thank you for your review! ⭐', 'success');
      await loadAllReal();
      await loadCreators();
      openDetail(p.id);
    });
  }

  /* ── INQUIRY MODAL ──────────────────────────────────── */
  async function openInquiry(id) {
    const p = await findCreator(id);
    if (!p) return;
    if (p.isExample) { showToast("That's an example profile — it can't receive inquiries.", 'info'); return; }
    if (currentUser && p.user_id === currentUser.id) { showToast("That's your own listing 🙂", 'info'); return; }

    const name = currentUser?.user_metadata?.full_name || '';
    const email = currentUser?.email || '';
    const today = new Date().toISOString().slice(0, 10);

    $('inquiryContent').innerHTML = `
      <h2 class="inq-title">Contact ${esc(p.name)}</h2>
      <p class="muted" style="margin-bottom:20px">📍 ${esc(p.city)} · ${esc((p.services || []).map(s => SERVICE_LABELS[s] || s).join(', '))}</p>
      <form id="inquiryForm" novalidate>
        <div class="form-row-split">
          <div class="form-row"><label for="iqName">Your name *</label><input id="iqName" type="text" maxlength="80" required value="${esc(name)}" /></div>
          <div class="form-row"><label for="iqEmail">Your email *</label><input id="iqEmail" type="email" required value="${esc(email)}" /></div>
        </div>
        <div class="form-row-split">
          <div class="form-row"><label for="iqService">Service</label>
            <select id="iqService">
              <option value="">Select…</option>
              ${(p.services || []).map(s => `<option value="${esc(s)}">${esc(SERVICE_LABELS[s] || s)}</option>`).join('')}
            </select></div>
          <div class="form-row"><label for="iqDate">Preferred date</label><input id="iqDate" type="date" min="${today}" /></div>
        </div>
        <div class="form-row"><label for="iqMessage">Message *</label>
          <textarea id="iqMessage" rows="5" maxlength="3000" required placeholder="What would you like to shoot? How many people? Any spots you're interested in?"></textarea></div>
        <label class="consent-row">
          <input type="checkbox" id="iqConsent" required />
          <span>I agree that my name, email and message are shared with ${esc(firstName(p.name))} so they can reply. <a href="/privacy.html" target="_blank">Privacy Policy</a></span>
        </label>
        <button type="submit" class="primary-btn" style="width:100%">Send inquiry</button>
        <p class="muted small" style="text-align:center;margin-top:10px">Messaging is free. When you book through CapturaGo, your payment is protected until the shoot is done.</p>
      </form>`;
    openModal('inquiryModal');

    $('inquiryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        photographer_id: p.id,
        sender_name: $('iqName').value.trim(),
        sender_email: $('iqEmail').value.trim(),
        shoot_type: $('iqService').value || null,
        shoot_date: $('iqDate').value || null,
        message: $('iqMessage').value.trim()
      };
      if (!payload.sender_name) return showToast('Please enter your name.', 'error');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.sender_email)) return showToast('Please enter a valid email.', 'error');
      if (payload.message.length < 5) return showToast('Please write a short message.', 'error');
      if (!$('iqConsent').checked) return showToast('Please tick the box so we can share your details with the creator.', 'error');

      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Sending…';
      const { error } = await CG.inquiries.send(payload);
      btn.disabled = false; btn.textContent = 'Send inquiry';
      if (error) { showToast('Could not send your inquiry. Please try again.', 'error'); return; }
      closeModal('inquiryModal');
      showToast(`Inquiry sent to ${firstName(p.name)}! 📬`, 'success', 5000);
    });
  }

  /* ── GEOLOCATION ────────────────────────────────────── */
  $('geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) { showToast('Your browser does not support location.', 'error'); return; }
    showToast('Finding your location…', 'info');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const city = await CG.geo.reverse(pos.coords.latitude, pos.coords.longitude);
      if (city) { $('cityFilter').value = city; loadCreators(); showToast(`Showing creators near ${city}`, 'success'); }
      else { map.setView([pos.coords.latitude, pos.coords.longitude], 10); showToast('Location found on the map.', 'info'); }
    }, () => showToast('Location permission was denied.', 'error'), { timeout: 10000 });
  });

  /* ── ADD LISTING FORM ───────────────────────────────── */
  const MAX_SPOTS = 8;
  $('bioInput').addEventListener('input', () => { $('charCount').textContent = $('bioInput').value.length; });

  $('coverImageInput').addEventListener('change', () => {
    const f = $('coverImageInput').files[0];
    $('coverPreview').innerHTML = '';
    if (!f) return;
    if (!CG.storage.ALLOWED_TYPES.includes(f.type)) { showToast('Please choose a JPG, PNG or WebP image.', 'error'); $('coverImageInput').value = ''; return; }
    if (f.size > CG.storage.MAX_UPLOAD_BYTES) { showToast('That image is over 5 MB — please choose a smaller one.', 'error'); $('coverImageInput').value = ''; return; }
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    img.className = 'cover-preview-img';
    $('coverPreview').appendChild(img);
  });

  $('addSpotBtn').addEventListener('click', () => {
    const container = $('spotsContainer');
    if (container.children.length >= MAX_SPOTS) { showToast(`Up to ${MAX_SPOTS} spots.`, 'info'); return; }
    const div = document.createElement('div');
    div.className = 'spot-entry';
    div.innerHTML = `
      <button type="button" class="spot-remove-btn" aria-label="Remove spot">×</button>
      <input type="text" class="spot-name" maxlength="80" placeholder="Spot name (e.g. Castle Hill at sunset)" />
      <textarea class="spot-desc" rows="2" maxlength="200" placeholder="Why is it special? Best time to go?"></textarea>`;
    div.querySelector('.spot-remove-btn').addEventListener('click', () => div.remove());
    container.appendChild(div);
  });

  $('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) { openAuth('signin'); return; }
    if (userListing) { showToast('You already have a listing — edit it in your dashboard.', 'info'); return; }

    const name = $('nameInput').value.trim();
    const city = $('cityInput').value.trim();
    const email = $('emailInput').value.trim();
    const portfolio = $('portfolioInput').value.trim();
    const services = CG_CATS.cleanServices([...document.querySelectorAll('input[name="services"]:checked')].map(i => i.value));
    const vibes = CG_CATS.cleanVibes([...document.querySelectorAll('input[name="vibes"]:checked')].map(i => i.value));
    const occasions = CG_CATS.cleanOccasions([...document.querySelectorAll('input[name="occasions"]:checked')].map(i => i.value));
    const droneCertified = services.includes('drone') && $('droneCertInput').checked;
    const spots = [...document.querySelectorAll('#spotsContainer .spot-entry')]
      .map(el => ({ name: el.querySelector('.spot-name').value.trim(), desc: el.querySelector('.spot-desc').value.trim() }))
      .filter(s => s.name);

    if (!name || !city || !email || !portfolio) return showToast('Please fill in all fields marked *.', 'error');
    if (!services.length) return showToast('Select at least one service you offer.', 'error');
    if (services.includes('drone') && !droneCertified) return showToast('To offer drone shoots, confirm you hold the required drone certificate.', 'error', 6000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Please enter a valid email.', 'error');
    if (!safeUrl(portfolio) || !/^https?:\/\//i.test(portfolio)) return showToast('Portfolio link must start with https://', 'error');

    const btn = e.target.querySelector('.form-submit-btn');
    btn.disabled = true;
    try {
      btn.textContent = 'Finding your city on the map…';
      const coords = await CG.geo.geocode(city);

      let coverUrl = null;
      const file = $('coverImageInput').files[0];
      if (file) {
        btn.textContent = 'Uploading your photo…';
        const up = await CG.storage.uploadCover(file, currentUser.id);
        if (up.error) showToast('Photo upload failed (' + up.error.message + '). Your listing will be saved — add a photo later in your dashboard.', 'error', 6000);
        else coverUrl = up.url;
      }

      btn.textContent = 'Saving your listing…';
      const { data, error, skipped } = await CG.photographers.insert({
        user_id: currentUser.id,
        name, city,
        coords: coords ? { lat: coords[0], lon: coords[1] } : null,
        type: services[0],
        services, vibes, occasions,
        drone_certified: droneCertified,
        specialties: services.map(s => SERVICE_LABELS[s]).join(', '),
        description: $('bioInput').value.trim() || null,
        tags: vibes.map(v => VIBE_LABELS[v]),
        local_spots: spots,
        portfolio_url: portfolio,
        cover_image_url: coverUrl,
        email,
        price: $('priceInput').value,
        level: $('levelInput').value,
        languages: $('langInput').value.trim() || null,
        travel_available: $('travelInput').checked
      });

      if (error) {
        const dup = error.code === '23505' || /duplicate|unique/i.test(error.message || '');
        showToast(dup ? 'You already have a listing — edit it in your dashboard.' : 'Could not save your listing: ' + error.message, 'error', 6000);
        if (dup) await refreshAuth();
        return;
      }

      userListing = data;
      e.target.reset();
      syncDroneRow();
      $('charCount').textContent = '0';
      $('coverPreview').innerHTML = '';
      $('spotsContainer').innerHTML = '';
      renderAddFormState();
      if (!coords) showToast("Listing saved! We couldn't place your city on the map — edit it in your dashboard (e.g. 'Kyoto, Japan').", 'info', 7000);
      else if (skipped?.length) showToast('Listing saved — but occasions and drone details need the latest database update (categories-patch.sql).', 'info', 7000);
      else showToast(`You're live on CapturaGo, ${firstName(name)}! 🎉`, 'success', 5000);
      await loadAllReal();
      await loadCreators();
    } finally {
      btn.disabled = false;
      btn.textContent = 'List myself for free';
    }
  });

  /* ── PACKAGES & BOOKING ─────────────────────────────── */
  function renderPackages(p, isOwn) {
    const pkgs = packagesOf(p);
    if (!pkgs.length) return '';
    const bookable = canBook(p) && !isOwn;
    const rows = pkgs.map(k => `
      <div class="package-row">
        <div class="package-info">
          <strong>${esc(k.name)}</strong>
          <span class="muted small">${k.minutes ? `${esc(k.minutes)} min` : ''}${k.minutes && k.desc ? ' · ' : ''}${esc(k.desc || '')}</span>
        </div>
        <div class="package-buy">
          <span class="package-price">${money(k.price_eur)}</span>
          ${bookable ? `<button class="primary-btn book-btn" data-pkg="${esc(k.id)}">Book</button>` : ''}
        </div>
      </div>`).join('');
    let note;
    if (p.isExample) note = 'Example packages — this profile is not bookable.';
    else if (isOwn) note = 'This is how travellers see your packages.';
    else if (bookable) note = `🔒 Your payment is held by CapturaGo and only released to ${esc(firstName(p.name))} after your shoot.`;
    else note = `${esc(firstName(p.name))} takes bookings by message for now — send an inquiry to arrange a date.`;
    return `<div class="packages"><h4>Packages</h4>${rows}<p class="muted small">${note}</p></div>`;
  }

  function openBooking(p, pkgId) {
    if (!currentUser) { openAuth('signin'); showToast('Sign in to book — it takes 30 seconds.', 'info'); return; }
    const pkg = packagesOf(p).find(k => String(k.id) === String(pkgId));
    if (!pkg || !canBook(p)) { showToast('This package is no longer available.', 'error'); return; }
    const price = Number(pkg.price_eur);
    const fee = Math.round(price * CLIENT_FEE) / 100;
    const total = Math.round((price + fee) * 100) / 100;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const maxDate = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    $('bookContent').innerHTML = `
      <h2 class="inq-title">Book ${esc(firstName(p.name))}</h2>
      <p class="muted" style="margin-bottom:18px">📍 ${esc(p.city)}</p>
      <div class="book-summary"><strong>${esc(pkg.name)}</strong><span class="muted small">${pkg.minutes ? `${esc(pkg.minutes)} min` : ''}${pkg.minutes && pkg.desc ? ' · ' : ''}${esc(pkg.desc || '')}</span></div>
      <form id="bookForm" novalidate>
        <div class="form-row"><label for="bkDate">Shoot date *</label><input id="bkDate" type="date" min="${tomorrow}" max="${maxDate}" required /></div>
        <div class="form-row"><label for="bkNote">Note for ${esc(firstName(p.name))}</label>
          <textarea id="bkNote" rows="3" maxlength="1000" placeholder="Time of day, number of people, spots you'd love…"></textarea></div>
        <div class="price-breakdown">
          <div><span>Package</span><span>${money(price)}</span></div>
          ${fee > 0 ? `<div><span>Service fee (${CLIENT_FEE}%)</span><span>${money(fee)}</span></div>` : ''}
          <div class="total"><span>Total</span><span>${money(total)}</span></div>
        </div>
        <ul class="book-promises">
          <li>🔒 Payment held safely until your shoot is done</li>
          <li>↩ Full refund if the creator declines or hasn't confirmed yet</li>
          <li>📅 Free cancellation up to 7 days before a confirmed shoot</li>
        </ul>
        <button type="submit" class="primary-btn" style="width:100%">Continue to secure payment</button>
        <p class="muted small" style="text-align:center;margin-top:10px">Payments are processed by Stripe. <a href="/terms.html#bookings" target="_blank">Booking terms</a></p>
      </form>`;
    openModal('bookModal');
    $('bookForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = $('bkDate').value;
      if (!date) return showToast('Choose a date for your shoot.', 'error');
      if (date < tomorrow || date > maxDate) return showToast('Choose a date between tomorrow and one year ahead.', 'error');
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Opening secure payment…';
      const { data, error } = await CG.pay.checkout({ photographer_id: p.id, package_id: pkg.id, shoot_date: date, note: $('bkNote').value.trim() });
      if (error || !data?.url) {
        btn.disabled = false; btn.textContent = 'Continue to secure payment';
        showToast(error?.message || 'Could not start the payment. Please try again.', 'error', 6000);
        return;
      }
      window.location.href = data.url;
    });
  }

  /* ── AI MATCH ───────────────────────────────────────── */
  let aiActive = false;
  const wordsOf = (list) => Object.fromEntries(list.map(x => [x.id, x.words || []]));
  const SVC_WORDS = wordsOf(SERVICES), VIBE_WORDS = wordsOf(VIBES), OCCASION_WORDS = wordsOf(OCCASIONS);
  const PRICE_WORDS = { budget: ['cheap', 'budget', 'affordable'], premium: ['luxury', 'premium', 'high-end'] };

  // Keyword fallback when the AI service is unavailable
  function localMatch(q) {
    const t = q.toLowerCase();
    const words = t.split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3);
    const scored = allReal.filter(c => c.available !== false).map(c => {
      const cityParts = String(c.city || '').toLowerCase().split(/[^\p{L}]+/u).filter(w => w.length > 2);
      const cityHit = cityParts.some(w => t.includes(w));
      let score = cityHit ? 10 : 0;
      for (const [k, ws] of Object.entries(SVC_WORDS)) if (ws.some(w => t.includes(w)) && (c.services || []).includes(k)) score += 3;
      for (const [k, ws] of Object.entries(VIBE_WORDS)) if (ws.some(w => t.includes(w)) && (c.vibes || []).includes(k)) score += 2;
      for (const [k, ws] of Object.entries(OCCASION_WORDS)) if (ws.some(w => t.includes(w)) && (c.occasions || []).includes(k)) score += 2;
      for (const [k, ws] of Object.entries(PRICE_WORDS)) if (ws.some(w => t.includes(w)) && c.price === k) score += 1;
      const hay = `${c.description || ''} ${c.languages || ''} ${spotsOf(c).map(x => x.name).join(' ')}`.toLowerCase();
      score += words.filter(w => hay.includes(w)).length * 0.5;
      return { c, score, cityHit };
    });
    const local = scored.filter(x => x.cityHit);
    const pool = local.length ? local : scored.filter(x => x.c.travel_available);
    return pool.filter(x => x.score >= (local.length ? 10 : 2))
      .sort((a, b) => b.score - a.score).slice(0, 6)
      .map(x => ({ id: x.c.id, reason: x.cityHit ? `Based in ${x.c.city}` : `Travels — based in ${x.c.city}` }));
  }

  function showAiStatus(count, note, basic) {
    const el = $('aiStatus');
    el.hidden = false;
    el.innerHTML = `
      <div><strong>${count ? `✦ ${count} best match${count > 1 ? 'es' : ''} for you` : 'No creators match that yet'}</strong>
      ${basic ? '<span class="muted small"> · quick match</span>' : ''}
      ${!count ? '<p class="muted small">Try a nearby city or a broader style — or browse everyone below.</p>' : ''}
      ${note ? `<p class="muted small">${esc(note)}</p>` : ''}</div>
      <button type="button" class="link-btn" id="aiClear">Show all creators</button>`;
    $('aiClear').addEventListener('click', () => { $('aiQuery').value = ''; loadCreators(); });
  }

  $('aiForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('aiQuery').value.trim();
    if (q.length < 3) { showToast('Tell us a little more about your shoot.', 'info'); return; }
    const btn = $('aiBtn');
    btn.disabled = true; btn.textContent = 'Matching…';
    showSkeletons(3);
    await allRealReady;
    const { data, error } = await CG.ai.match(q);
    btn.disabled = false; btn.textContent = 'Find my match';
    if (error && error.status === 429) { showToast(error.message, 'error'); loadCreators(); return; }
    if (error && error.status === 400) { showToast(error.message, 'info'); loadCreators(); return; }
    const basic = !!error;
    const matches = basic ? localMatch(q) : (data?.matches || []);
    const byId = new Map(allReal.map(c => [c.id, c]));
    const list = matches.filter(m => byId.has(m.id)).map(m => ({ ...byId.get(m.id), _reason: m.reason }));
    aiActive = true;
    shown = list;
    $('exampleNotice').hidden = true;
    showAiStatus(list.length, basic ? '' : (data?.note || ''), basic);
    renderGrid(list);
    renderMapList(list);
    refreshMarkers(list, list.length > 0);
  });

  /* ── SCROLL REVEAL ──────────────────────────────────── */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
      if (entry.target.querySelector('#map')) setTimeout(() => map.invalidateSize(), 700);
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ── START ──────────────────────────────────────────── */
  renderDestinations();
  await refreshAuth();
  allRealReady = loadAllReal();
  await loadCreators();
  setTimeout(() => map.invalidateSize(), 400);

  CG.auth.onChange(async (event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') { await refreshAuth(); }
  });
});
