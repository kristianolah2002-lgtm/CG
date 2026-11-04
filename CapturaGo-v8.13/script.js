/* ================================================================
   CapturaGo — homepage logic
   Depends on: vendor/supabase.umd.js, supabase.js (window.CG),
               vendor/leaflet (window.L), site.js (esc, safeUrl, showToast)
================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);

  /* ── LABELS ─────────────────────────────────────────── */
  const TAX = window.CG_TAX;
  const SERVICE_LABELS = Object.fromEntries(TAX.services.map(s => [s.id, s.label]));
  const SERVICE_ICONS  = Object.fromEntries(TAX.services.map(s => [s.id, s.icon]));
  const PRICE_LABELS   = { budget: 'Under €80', mid: '€80–€250', premium: '€250+' };
  const LEVEL_LABELS   = { enthusiast: 'Enthusiast', semipro: 'Semi-pro', pro: 'Professional' };
  const VIBE_LABELS    = Object.fromEntries(TAX.vibes.map(v => [v.id, v.label]));
  const OCC_LABELS     = Object.fromEntries(TAX.occasions.map(o => [o.id, o.label]));
  const EUROPE_VIEW    = { center: [49, 12], zoom: 3.3 };
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
      services: ['photo', 'guide'], price: 'mid', level: 'semipro', rating: 4.9, reviews_count: 0, vibes: ['moody', 'cinematic'], occasions: ['proposal', 'couples', 'solo'], available: true, travel_available: false,
      description: 'Born and raised in Kyoto. Temple spots most tourists never find — bamboo groves at dawn, mossy stone paths. Soft, cinematic, deeply Japanese.',
      tags: ['Travel', 'Portraits', 'Golden hour'], languages: 'English, Japanese',
      local_spots: [{ name: 'Fushimi Inari back gate', desc: 'Almost empty at 6am' }, { name: "Philosopher's Path at dawn", desc: 'Cherry blossom reflections in spring' }],
      packages: [{ id: 'e1', name: 'Sunrise temple walk', minutes: 90, price_eur: 140, desc: '2 locations, 40 edited photos' }, { id: 'e2', name: 'Mini portrait session', minutes: 45, price_eur: 85, desc: '20 edited photos' }],
      cover_image_url: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1200&q=70' },
    { id: 'ex-2', isExample: true, name: 'Marco D.', city: 'Bali, Indonesia', coords: { lat: -8.4095, lon: 115.1889 },
      services: ['photo', 'drone', 'guide'], drone_certified: true, price: 'budget', level: 'enthusiast', rating: 4.8, reviews_count: 0, vibes: ['golden', 'film'], occasions: ['solo', 'couples', 'family'], available: true, travel_available: true,
      description: 'Not a pro — but I know every sunset spot, rice terrace and waterfall on the island. Warm, honest, alive photos.',
      tags: ['Travel', 'Lifestyle', 'Sunset'], languages: 'English, Italian',
      local_spots: [{ name: 'Tegallalang at sunrise', desc: 'Go at 5am for empty terraces' }, { name: 'Uluwatu cliffs at dusk', desc: 'Temple silhouette at blue hour' }],
      cover_image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=70' },
    { id: 'ex-3', isExample: true, name: 'Elena M.', city: 'Vienna, Austria', coords: { lat: 48.2082, lon: 16.3738 },
      services: ['photo', 'event', 'edit'], price: 'premium', level: 'pro', rating: 5.0, reviews_count: 0, vibes: ['editorial', 'airy'], occasions: ['wedding', 'couples', 'headshots', 'business'], available: true, travel_available: true,
      description: 'Portrait and editorial photographer. Clean, cinematic and timeless. Couples, weddings and brand shoots across Central Europe.',
      tags: ['Weddings', 'Portraits', 'Editorial'], languages: 'English, German',
      local_spots: [{ name: 'Belvedere gardens', desc: 'Best at 7am before crowds' }, { name: 'Prater chestnut alley', desc: 'Blossom tunnel in spring' }],
      cover_image_url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=70' },
    { id: 'ex-4', isExample: true, name: 'Lena B.', city: 'Berlin, Germany', coords: { lat: 52.52, lon: 13.405 },
      services: ['video', 'video_edit'], price: 'premium', level: 'pro', rating: 4.8, reviews_count: 0, vibes: ['moody', 'cinematic'], occasions: ['content', 'business', 'events'], available: true, travel_available: true,
      description: 'Cinematic videographer and editor — travel films, reels and brand content that feel like a series.',
      tags: ['Cinematic', 'Reels', 'Brand'], languages: 'English, German',
      local_spots: [{ name: 'Tempelhof airfield', desc: 'Huge sky, brutalist backdrop' }, { name: 'Neukölln canal at night', desc: 'Neon reflections for reels' }],
      cover_image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=70' },
    { id: 'ex-5', isExample: true, name: 'Nina R.', city: 'Barcelona, Spain', coords: { lat: 41.3874, lon: 2.1686 },
      services: ['phone', 'photo'], price: 'budget', level: 'semipro', rating: 4.9, reviews_count: 0, vibes: ['photodump', 'flash', 'candid'], occasions: ['solo', 'content', 'birthday', 'dating'], available: true, travel_available: false,
      description: 'I shoot on YOUR phone so you can post the same day — candid, flash-at-night, photo-dump style. Gothic Quarter alleys and rooftop sunsets.',
      tags: ['Phone content', 'Reels', 'Night'], languages: 'English, Spanish, Catalan',
      local_spots: [{ name: 'Bunkers del Carmel', desc: 'Sunset over the whole city' }, { name: 'El Born side streets', desc: 'Perfect for night flash' }],
      packages: [{ id: 'e5', name: 'Phone content walk', minutes: 60, price_eur: 60, desc: '100+ shots straight on your phone' }],
      cover_image_url: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1200&q=70' },
    { id: 'ex-6', isExample: true, name: 'Tomáš K.', city: 'Prague, Czechia', coords: { lat: 50.0755, lon: 14.4378 },
      services: ['video_edit', 'clip', 'thumbnail'], price: 'mid', level: 'pro', rating: 5.0, reviews_count: 0, vibes: ['cinematic', 'vibrant'], occasions: ['content', 'business', 'wedding'], available: true, travel_available: false,
      description: 'Send me raw trip footage or a long video — I edit travel films, cut podcasts and streams into Shorts and Reels, and design thumbnails. Remote, worldwide.',
      tags: ['Remote', 'Clipping', 'Editing'], languages: 'English, Czech, Slovak', local_spots: [],
      packages: [{ id: 'e6', type: 'delivery', name: 'Trip footage → 60s reel', price_eur: 70, delivery_days: 3, revisions: 2, desc: 'Music, colour, captions' },
                 { id: 'e7', type: 'delivery', name: '10 clips from a long video', price_eur: 90, delivery_days: 4, revisions: 1, desc: 'Hooks + captions' }],
      cover_image_url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1200&q=70' }
  ];

  /* ── STATE ──────────────────────────────────────────── */
  let currentUser = null;
  let userListing = null;
  let userFavorites = [];
  let allReal = [];          // every real creator (for counts/ticker)
  let deals = new Map();     // last-minute deals: photographer id → [{ day, pct }] (tomorrow / the day after)
  const dealsOf = (p) => (p && !p.isExample ? deals.get(p.id) || [] : []);
  const dealOn = (p, iso) => dealsOf(p).find((d) => d.day === iso) || null;
  let shown = [];            // what's currently on screen
  let activeType = '';
  let activeVibe = '';
  let activeOccasion = '';

  /* ── CATEGORY UI (generated from taxonomy.js) ─────────── */
  (function renderTaxonomyUI() {
    $('heroService').innerHTML = TAX.serviceOptions('Any service');
    $('stickyType').innerHTML = TAX.serviceOptions('All creators');
    $('typePills').innerHTML = [
      '<button class="pill active" data-type="">All creators</button>',
      ...TAX.services.filter(s => s.group === 'onsite').map(s => `<button class="pill" data-type="${s.id}">${s.icon} ${esc(s.short)}</button>`),
      '<button class="pill pill-remote" data-type="remote">🌐 Remote services</button>'
    ].join('');
    $('vibePills').innerHTML = ['<button class="vibe-pill active" data-vibe="">✦ All vibes</button>',
      ...TAX.vibes.map(v => `<button class="vibe-pill" data-vibe="${v.id}">${v.icon} ${esc(v.label)}</button>`)].join('');
    $('occasionFilter').innerHTML = '<option value="">Any occasion</option>' +
      TAX.occasions.map(o => `<option value="${o.id}">${o.icon} ${esc(o.label)}</option>`).join('');
    $('occasionGrid').innerHTML = TAX.occasions.map(o =>
      `<button type="button" class="occasion-card" data-occ="${o.id}"><span class="occ-icon">${o.icon}</span><strong>${esc(o.label)}</strong><span>${esc(o.blurb)}</span></button>`).join('');
    TAX.renderChecks($('svcOnsite'), 'service', 'services', 'onsite');
    TAX.renderChecks($('svcRemote'), 'service', 'services', 'remote');
    TAX.renderChecks($('vibeChecks'), 'vibe', 'vibes');
    TAX.renderChecks($('occChecks'), 'occasion', 'occasions');
    $('addDrone').innerHTML = TAX.droneFields('ad');
    TAX.wireDrone('ad', document.querySelector('#svcOnsite input[value="drone"]'));
  })();
  const isRemoteSearch = () => activeType === 'remote' || TAX.isRemote(activeType);
  let allRealReady = Promise.resolve();   // resolves once allReal is loaded

  /* ── SMALL HELPERS ──────────────────────────────────── */
  const starRating = (r) => { const f = Math.round(Number(r) || 0); return '★'.repeat(f) + '☆'.repeat(5 - f); };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'the creator';
  const coordsOf = (p) => {
    if (p && p._trip) {   // on the road: the trip city's position (or none)
      const t = p._trip;
      return t.lat !== undefined && Number.isFinite(+t.lat) && Number.isFinite(+t.lon) ? [+t.lat, +t.lon] : null;
    }
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
  // No cover photo yet → the first portfolio photo, then the default picture
  const coverOf = (p) => safeUrl(p?.cover_image_url) || safeUrl(galleryOf(p)[0]?.url) || 'images/default.jpg';
  const galleryOf = (p) => (Array.isArray(p?.gallery) ? p.gallery : []).filter(g => g && safeUrl(g.url)).slice(0, 30);
  /* Booked through a creator's own link (capturago.com/c/<handle>) → lower service fee, remembered for 30 days */
  const REF_KEY = 'cg_ref';
  const getRef = () => { try { const r = JSON.parse(localStorage.getItem(REF_KEY) || 'null'); return r && Date.now() - r.at < 30 * 86400000 ? r.pid : null; } catch { return null; } };
  const setRef = (pid) => { try { localStorage.setItem(REF_KEY, JSON.stringify({ pid, at: Date.now() })); } catch {} };
  const LINK_FEE = Number(window.CG_CONFIG?.creatorLinkFeePercent ?? 5);
  const imgFallback = `onerror="this.onerror=null;this.src='images/default.jpg'"`;
  const timeAgo = (d) => {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const servicesBadges = (services = []) => services.map(s =>
    `<span class="ctb ctb-${esc(s)}">${SERVICE_ICONS[s] || ''} ${esc(SERVICE_LABELS[s] || s)}</span>`).join('');
  const verifiedBadge = (v) => {
    const lvl = Number(v) || 0;
    if (!lvl) return '';
    const labels = { 1: '✓ Verified', 2: '✓✓ Portfolio reviewed', 3: '✓✓✓ ID verified' };
    return `<span class="verified-badge verified-${Math.min(lvl, 3)}">${labels[Math.min(lvl, 3)]}</span>`;
  };
  const exampleTag = (p) => p.isExample ? '<span class="example-tag">Example</span>' : '';
  const CLIENT_FEE = Number(window.CG_CONFIG?.clientFeePercent ?? 10);
  const packagesOf = (p) => (Array.isArray(p?.packages) ? p.packages : []).filter(k => k && k.id && Number(k.price_eur) >= 10 && Number(k.price_eur) <= 5000
    && (k.type !== 'delivery' || (Number(k.delivery_days) >= 1 && Number(k.delivery_days) <= 30)));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const pkgMeta = (k) => {
    if (k.type === 'delivery') {
      const d = Number(k.delivery_days) || 0, r = Number(k.revisions) || 0;
      return `🌐 Remote · delivered in ${plural(d, 'day')}${r ? ` · ${plural(r, 'revision')}` : ''}${k.desc ? ' · ' + esc(k.desc) : ''}`;
    }
    return `${k.minutes ? `${esc(k.minutes)} min` : ''}${k.minutes && k.desc ? ' · ' : ''}${esc(k.desc || '')}`;
  };
  const fromPrice = (p) => { const ps = packagesOf(p).map(k => Number(k.price_eur)); return ps.length ? Math.min(...ps) : null; };
  const isBoosted = (p) => !!(p && p.boosted_until && Date.parse(p.boosted_until) > Date.now());
  const canBook = (p) => !!p && !p.isExample && !!p.payouts_enabled && packagesOf(p).length > 0;
  const money = (eur) => { const n = Number(eur); return `€${Number.isInteger(n) ? n : n.toFixed(2)}`; };

  /* ── MODALS ─────────────────────────────────────────── */
  function openModal(id) { $(id)?.classList.add('modal-open'); document.body.style.overflow = 'hidden'; }
  function closeModal(id) {
    $(id)?.classList.remove('modal-open');
    if (!document.querySelector('.modal.modal-open')) document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-close]').forEach(el =>
    el.addEventListener('click', () => closeModal(el.dataset.close)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('.lightbox')) ['detailModal', 'inquiryModal', 'authModal'].forEach(closeModal);
  });

  /* ── AUTH ───────────────────────────────────────────── */
  async function refreshAuth() {
    currentUser = await CG.auth.getUser();
    if (currentUser) { const back = takeReturn(); if (back) { location.href = back; return; } }   // signed up on a payment / gift page
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
      // Phones: no room in the bar — "Sign out" lives in the ☰ menu instead
      const links = document.querySelector('.nav-links');
      if (links && !links.querySelector('.nav-menu-signout')) links.insertAdjacentHTML('beforeend', '<button type="button" class="nav-menu-signout">Sign out</button>');
      const doSignOut = async () => {
        await CG.auth.signOut();
        await refreshAuth();
        loadCreators();
        showToast('Signed out.', 'info');
      };
      $('navSignOut').addEventListener('click', doSignOut);
      const ms = document.querySelector('.nav-menu-signout');
      if (ms) ms.onclick = () => { document.querySelector('.nav-links').classList.remove('nav-open'); document.querySelector('.nav-toggle')?.setAttribute('aria-expanded', 'false'); doSignOut(); };
    } else {
      document.querySelector('.nav-menu-signout')?.remove();
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
    continuePendingMessage();
    continuePendingAlert();
    continuePendingWatch();
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
    track('sign_up');
    if (data?.session) {
      closeModal('authModal');
      await refreshAuth();
      showToast(`Welcome to CapturaGo, ${firstName(name)}! 🎉`, 'success');
      continuePendingMessage();
      continuePendingAlert();
      continuePendingWatch();
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
  const track = (name, params) => { try { window.CGConsent?.track(name, params); } catch {} };

  function runSearch(city, type) {
    if (city) track('search', { search_term: city });
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
  const map = createCgMap($('map'), { center: EUROPE_VIEW.center, zoom: EUROPE_VIEW.zoom });

  function refreshMarkers(list, fitToResults) {
    map.setMarkers(list.map((p) => {
      const c = coordsOf(p);
      return c ? {
        id: p.id, lat: c[0], lon: c[1], name: p.name,
        line: p._trip ? `✈️ In ${tripCity(p._trip)} ${tripDates(p._trip)}` : `📍 ${p.city}`,
        services: (p.services || []).map(s => SERVICE_LABELS[s] || s).join(' · '),
        price: fromPrice(p), img: p.cover_image_url, initial: String(p.name || '?').trim().charAt(0).toUpperCase(),
        rating: Number(p.rating) || 0, reviews: p.reviews_count, example: !!p.isExample,
        onOpen: () => openDetail(p.id),
      } : null;
    }).filter(Boolean), fitToResults);
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
        <div class="result-meta">${p._trip ? `✈️ ${esc(tripCity(p._trip))} · ${esc(tripDates(p._trip))}` : `📍 ${esc(p.city)}`}</div>
        <div class="result-type">${esc((p.services || []).map(s => SERVICE_LABELS[s] || s).join(' · '))}</div>
        ${PRICE_LABELS[p.price] ? `<span class="result-price">${PRICE_LABELS[p.price]}</span>` : ''}
      </li>`).join('');
    ul.querySelectorAll('li[data-id]').forEach(li => li.addEventListener('click', () => {
      const p = shown.find(x => String(x.id) === li.dataset.id);
      const c = coordsOf(p);
      if (c) map.focus(c[0], c[1], 12);
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
            ${city ? `<button class="primary-btn" id="emptyNotify">🔔 Notify me when someone joins ${esc(city)}</button>` : ''}
            <button class="secondary-btn" id="emptyClear">Clear filters</button>
            ${city ? '<button class="secondary-btn" id="emptyShare">Copy invite link</button>' : ''}
          </div>
        </div>`;
      $('emptyClear').addEventListener('click', clearFilters);
      $('emptyNotify')?.addEventListener('click', (e) => notifyCity(city, e.currentTarget));
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
            <div class="creator-type-badges">${p.isExample ? '<span class="ctb ctb-example">Example</span>' : ''}${isBoosted(p) ? '<span class="ctb ctb-sponsored" title="Promoted placement — a paid boost or a founding-creator perk">Sponsored</span>' : ''}${isFounding(p) ? `<span class="ctb ctb-founding" title="One of the first creators in ${esc(p.founding_city)} on CapturaGo">🏅 Founding</span>` : ''}${dealsOf(p).length ? `<span class="ctb ctb-deal" title="Lower price ${esc(dealsOf(p).map((d) => dealDay(d.day)).join(' / '))}">⚡ Last-minute −${Math.max(...dealsOf(p).map((d) => d.pct))}%</span>` : ''}${servicesBadges(p.services || [])}</div>
            <div class="portfolio-image-overlay"><span class="portfolio-overlay-btn">View profile</span></div>
            ${p.available !== false ? '<div class="available-dot" title="Available"></div>' : ''}
            ${p.isExample ? '' : `<button class="fav-btn ${isFav ? 'fav-active' : ''}" data-fav="${esc(p.id)}" aria-label="Save to favourites">♥</button>`}
          </div>
          <div class="portfolio-body">
            <h3><span translate="no">${esc(p.name)}</span>${verifiedBadge(p.verified)}</h3>
            <div class="portfolio-rating">${p.reviews_count > 0 ? `${starRating(p.rating)} <small>${Number(p.rating).toFixed(1)} · ${p.reviews_count} review${p.reviews_count > 1 ? 's' : ''}</small>` : '<small class="muted">New on CapturaGo</small>'}</div>
            <p class="portfolio-location">📍 ${esc(p.city)}${p.travel_available ? ' · <span class="travels">✈ Travels</span>' : ''}${TAX.hasRemote(p.services) ? ' · <span class="remote-chip">🌐 Remote</span>' : ''}</p>
            ${replyRank(p) === 3 ? '<p class="fast-reply-chip" title="Measured from their replies on CapturaGo">💬 Replies within an hour</p>' : ''}
            ${spots.length || galleryOf(p).length ? `<div class="spots-count-pill">${galleryOf(p).length ? `📷 ${galleryOf(p).length} photo${galleryOf(p).length > 1 ? 's' : ''}` : ''}${spots.length && galleryOf(p).length ? ' · ' : ''}${spots.length ? `🗺️ ${spots.length} local spot${spots.length > 1 ? 's' : ''}` : ''}</div>` : ''}
            ${p._reason ? `<p class="ai-reason">✦ ${esc(p._reason)}</p>` : ''}
            <p class="portfolio-description" translate="no">${esc(desc.slice(0, 120))}${desc.length > 120 ? '…' : ''}</p>
            <div class="portfolio-tags">${(p.vibes || []).slice(0, 3).map(v => `<span>${esc(VIBE_LABELS[v] || v)}</span>`).join('')}</div>
            <div class="portfolio-footer">
              ${p.isExample
                ? '<span class="muted small">Example profile</span>'
                : `<button class="secondary-btn inquiry-btn" data-inq="${esc(p.id)}">Message</button>`}
              <span class="portfolio-price">${fromPrice(p) ? `From ${money(fromPrice(p))}` : (PRICE_LABELS[p.price] || '')}${canBook(p) ? ` <span class="book-chip">${p.instant_book ? '⚡ Instant book' : 'Book online'}</span>` : ''}</span>
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
    activeType = type === 'remote' || TAX.service(type) ? type : '';
    const pillValue = TAX.isRemote(activeType) ? 'remote' : activeType;
    document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.type === pillValue));
  }
  function setOccasion(occ) {
    activeOccasion = TAX.occasion(occ) ? occ : '';
    $('occasionFilter').value = activeOccasion;
    document.querySelectorAll('.occasion-card').forEach(c => c.classList.toggle('active', c.dataset.occ === activeOccasion));
  }
  function setVibe(vibe) {
    activeVibe = vibe || '';
    document.querySelectorAll('.vibe-pill').forEach(p => p.classList.toggle('active', p.dataset.vibe === activeVibe));
  }
  function clearFilters() {
    $('cityFilter').value = ''; $('priceFilter').value = ''; $('availableFilter').checked = false;
    setType(''); setVibe(''); setOccasion('');
    loadCreators();
  }
  document.querySelectorAll('.pill').forEach(p => p.addEventListener('click', () => { setType(p.dataset.type); loadCreators(); }));
  document.querySelectorAll('.vibe-pill').forEach(p => p.addEventListener('click', () => { setVibe(p.dataset.vibe); loadCreators(); }));
  $('cityFilter').addEventListener('input', debounce(loadCreators, 400));
  $('priceFilter').addEventListener('change', loadCreators);
  $('occasionFilter').addEventListener('change', () => { setOccasion($('occasionFilter').value); loadCreators(); });
  document.querySelectorAll('.occasion-card').forEach(c => c.addEventListener('click', () => {
    setOccasion(activeOccasion === c.dataset.occ ? '' : c.dataset.occ);
    $('portfolio-section').scrollIntoView({ behavior: 'smooth' });
    loadCreators();
  }));
  $('availableFilter').addEventListener('change', loadCreators);
  $('clearFilters').addEventListener('click', clearFilters);

  function clientFilter(list) {
    const price = $('priceFilter').value, onlyAvailable = $('availableFilter').checked;
    return list.filter(c =>
      (!activeType || (activeType === 'remote' ? TAX.hasRemote(c.services) : (c.services || []).includes(activeType))) &&
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
    const remote = isRemoteSearch();   // remote work: location doesn't matter
    $('remoteNotice').hidden = !(remote && city);
    const { data, error } = await CG.photographers.getAll({ city: (!remote && city) || undefined, price: $('priceFilter').value || undefined });
    if (token !== loadToken) return;            // a newer search started — ignore this one
    if (error) showToast("Couldn't load creators right now. Please refresh.", 'error');

    await allRealReady;
    if (token !== loadToken) return;
    const real = clientFilter(data || []);
    // Boosted first, then fast responders (usually reply within an hour / a few hours / a day); stable, so newest first within each group
    real.sort((a, b) => Number(isBoosted(b)) - Number(isBoosted(a)) || replyRank(b) - replyRank(a));
    // Creators on the road: planning a trip to the searched city (listed after the locals)
    const travelling = city && !remote
      ? clientFilter(allReal.filter((c) => !real.some((r) => r.id === c.id) && upcomingTrips(c.trips).some((t) => tripMatches(t, city))))
        .map((c) => { const t = upcomingTrips(c.trips).find((x) => tripMatches(x, city)); return { ...c, _trip: t, _reason: `✈️ In ${tripCity(t)} ${tripDates(t)}` }; })
      : [];
    aiActive = false;
    $('aiStatus').hidden = true;
    $('tripStatus').hidden = true; tripRange = null;
    let examples = [];
    if ((!city || remote) && allReal.length < SHOW_EXAMPLES_BELOW) examples = clientFilter(EXAMPLES);

    shown = [...real, ...travelling, ...examples];
    $('exampleNotice').hidden = examples.length === 0;
    if (city && !remote) logSearch(city, TAX.service(activeType) ? activeType : '', real.length + travelling.length);
    renderGrid(shown);
    renderMapList(shown);
    refreshMarkers(shown, !!city && !remote);
  }

  /* Anonymous search insights: logged once the visitor stops typing (no names, emails or IP addresses) */
  const loggedSearches = new Set();
  let logTimer = null;
  function logSearch(city, service, n) {
    clearTimeout(logTimer);
    if (!city || city.length < 2) return;
    logTimer = setTimeout(() => {
      const key = `${city.toLowerCase()}|${service}|${n === 0}`;
      if (loggedSearches.has(key)) return;
      loggedSearches.add(key);
      CG.logEvent('search', city, service, n);
    }, 1500);
  }

  /* "Notify me when a creator joins <city>" */
  let pendingAlert = null;
  async function notifyCity(city, btn) {
    const c = String(city || '').trim();
    if (c.length < 2) return;
    const service = TAX.service(activeType) ? activeType : '';
    if (!currentUser) {
      pendingAlert = { city: c, service, at: Date.now() };
      openAuth('signin');
      showToast(`Sign in and we'll email you when a creator joins ${c}.`, 'info', 5000);
      return;
    }
    if (btn) btn.disabled = true;
    const { error } = await CG.alerts.create(c, service || null);
    if (error) { if (btn) btn.disabled = false; showToast(error.message || 'Could not save your alert.', 'error', 6000); return; }
    if (btn) btn.textContent = `✓ We'll email you about ${c}`;
    showToast(`Done — we'll email you once when a creator joins ${c}.`, 'success', 5000);
  }
  function continuePendingAlert() {
    const a = pendingAlert; pendingAlert = null;
    if (!a || !currentUser || Date.now() - a.at > 15 * 60000) return;
    CG.alerts.create(a.city, a.service || null).then(({ error }) => {
      showToast(error ? (error.message || 'Could not save your alert.') : `Done — we'll email you once when a creator joins ${a.city}.`, error ? 'error' : 'success', 5000);
    });
  }

  /* ── TRIP PLANNER: who is free in a city on my dates ── */
  let tripRange = null;   // { from, to } — the booking calendar opens there
  let wantDay = null;     // { id, day } from a deal / "a day opened up" link — that day is picked in the booking window
  const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const niceDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  let tpDates = null;
  (function setupTripPlanner() {
    const tomorrow = () => localIso(addDays(new Date(), 1)), max = () => localIso(addDays(new Date(), 365));
    tpDates = createDateRange($('tpDates'), { fromId: 'tpFrom', toId: 'tpTo', min: tomorrow, max, maxDays: 31, placeholder: 'Add your dates', label: 'Your travel dates',
      firstHint: 'When do you arrive?', secondHint: 'And when do you leave?' });
    $('tripForm').addEventListener('submit', (e) => { e.preventDefault(); runTrip($('tpCity').value.trim(), $('tpFrom').value, $('tpTo').value || $('tpFrom').value); });
    $('tpTomorrow').addEventListener('click', () => { const t = tomorrow(); tpDates.set(t, t); runTrip($('tpCity').value.trim(), t, t); });
    $('tpWeekend').addEventListener('click', () => {
      let d = addDays(new Date(), 1);
      while (d.getDay() !== 6 && d.getDay() !== 0) d = addDays(d, 1);
      const from = localIso(d), to = localIso(d.getDay() === 6 ? addDays(d, 1) : d);
      tpDates.set(from, to);
      runTrip($('tpCity').value.trim(), from, to);
    });
  })();
  /* ── 📣 SHOOT REQUEST: describe the shoot, creators in that city send offers ── */
  let reqRange = null;
  function openRequest(prefill = {}) {
    if (!currentUser) { openAuth('signup'); showToast('Create a free account to post a request — creators reply with offers.', 'info', 5000); return; }
    const tomorrow = localIso(addDays(new Date(), 1)), max = localIso(addDays(new Date(), 365));
    let service = prefill.service && REQUEST_SERVICES.some((x) => x[0] === prefill.service) ? prefill.service : 'photo';
    $('requestContent').innerHTML = `
      <h2 class="inq-title">Post a shoot request</h2>
      <p class="muted" style="margin-bottom:18px">Tell creators what you need. Those who are in the city on your dates send you offers — you compare them and book the one you like. Free, no obligation.</p>
      <form id="reqForm" novalidate>
        <div class="form-row"><label for="reqCity">Where? *</label><input id="reqCity" maxlength="120" autocomplete="off" placeholder="City, e.g. Lisbon" value="${esc(prefill.city || '')}" /></div>
        <div class="form-row"><label id="reqDatesLabel">When? *</label><div id="reqDates" aria-labelledby="reqDatesLabel"></div><input type="hidden" id="reqFrom" /><input type="hidden" id="reqTo" />
          <p class="form-note">Any day in this range works for you — creators pick a day they're free.</p></div>
        <div class="form-row"><label>What do you need? *</label>
          <div class="slot-chips" id="reqService" role="group" aria-label="Service">${REQUEST_SERVICES.map(([id, ic, l]) => `<button type="button" data-s="${id}" class="${id === service ? 'on' : ''}" aria-pressed="${id === service}">${ic} ${l}</button>`).join('')}</div></div>
        <div class="req-two">
          <div class="form-row"><label for="reqPeople">People</label><input id="reqPeople" type="number" inputmode="numeric" min="1" max="30" value="${Number(prefill.people) || 2}" /></div>
          <div class="form-row"><label for="reqBudget">Budget in € <span class="muted">(optional)</span></label><input id="reqBudget" type="number" inputmode="numeric" min="20" max="10000" placeholder="e.g. 150" /></div>
        </div>
        <div class="form-row"><label for="reqNote">Anything else?</label><textarea id="reqNote" rows="3" maxlength="1000" placeholder="Occasion, style, places you love, how many photos…"></textarea>
          <p class="form-note">Don't share phone numbers or emails here — creators reply on CapturaGo.</p></div>
        <button type="submit" class="primary-btn" style="width:100%">Post my request</button>
      </form>`;
    reqRange = createDateRange($('reqDates'), { fromId: 'reqFrom', toId: 'reqTo', min: () => tomorrow, max: () => max, maxDays: 31, placeholder: 'Add your dates', label: 'Your dates',
      firstHint: 'From which day?', secondHint: 'Until which day?' });
    if (prefill.from) reqRange.set(prefill.from, prefill.to || prefill.from);
    $('reqService').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      service = b.dataset.s;
      $('reqService').querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    }));
    $('reqForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const city = $('reqCity').value.trim(), from = $('reqFrom').value, to = $('reqTo').value || from;
      const people = Math.round(Number($('reqPeople').value) || 0), budgetRaw = $('reqBudget').value.trim(), budget = budgetRaw ? Math.round(Number(budgetRaw)) : null;
      if (city.length < 2) return showToast('Tell us the city.', 'error');
      if (!from) { showToast('Choose your dates.', 'error'); reqRange.open(); return; }
      if (people < 1 || people > 30) return showToast('How many people? (1–30)', 'error');
      if (budget !== null && (!Number.isFinite(budget) || budget < 20 || budget > 10000)) return showToast('The budget can be from €20 to €10,000.', 'error');
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Posting…';
      const { error } = await CG.requests.create({ city, from, to, service, people, budget, note: $('reqNote').value.trim() });
      btn.disabled = false; btn.textContent = 'Post my request';
      if (error) return showToast(error.message || 'Could not post your request. Please try again.', 'error', 6000);
      $('requestContent').innerHTML = `<div class="req-done"><div class="req-done-icon">📣</div><h2 class="inq-title">Request posted!</h2>
        <p class="muted">Creators who are in <strong>${esc(city.split(',')[0])}</strong> on your dates are told right away. We'll email you when offers arrive — compare them, message the creators, and book the one you like.</p>
        <a href="/dashboard.html#requests" class="primary-btn" style="text-decoration:none;display:inline-flex;justify-content:center;width:100%">See my requests</a></div>`;
    });
    openModal('requestModal');
  }
  $('tpRequest')?.addEventListener('click', () => openRequest({ city: $('tpCity').value.trim(), from: $('tpFrom').value, to: $('tpTo').value }));

  async function runTrip(city, from, to) {
    const status = $('tripStatus');
    const tomorrow = localIso(addDays(new Date(), 1));
    if (!from) { showToast('Choose your dates.', 'info'); tpDates.open(); return; }
    if (from < tomorrow) { showToast('Choose dates from tomorrow on.', 'info'); return; }
    if (to < from) { showToast('The end date is before the start date.', 'info'); return; }
    const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
    if (span > 31) { showToast('Choose up to 31 days at a time.', 'info'); return; }
    const btn = $('tpBtn'); btn.disabled = true; btn.textContent = 'Checking calendars…';
    showSkeletons(3);
    await allRealReady;
    const { data, error } = await CG.availableCreators(city, from, to);
    btn.disabled = false; btn.textContent = 'Find free creators';
    if (error) { showToast(error.message || 'Could not check availability. Please try again.', 'error', 6000); loadCreators(); return; }
    const byId = new Map(allReal.map((c) => [c.id, c]));
    const list = (data || []).filter((x) => byId.has(x.photographer_id))
      .map((x) => {
        const c = byId.get(x.photographer_id);
        // Free here because of a trip (not their home city): the calendar and map follow the trip
        const t = city && !tripMatches({ city: c.city }, city) ? upcomingTrips(c.trips).find((y) => tripMatches(y, city) && y.from <= to && y.to >= from) : null;
        const free = span === 1 ? `Free on ${niceDay(from)}` : `Free ${x.free_days} of ${span} days · from ${niceDay(x.first_free)}`;
        return { ...c, ...(t ? { _trip: t } : {}), _reason: t ? `✈️ In ${tripCity(t)} ${tripDates(t)} · ${free}` : free, _free: x.free_days };
      })
      .filter((c) => !activeType || activeType === 'remote' || TAX.isRemote(activeType) || (c.services || []).includes(activeType))
      .sort((a, b) => Number(isBoosted(b)) - Number(isBoosted(a)) || Number(canBook(b)) - Number(canBook(a)) || replyRank(b) - replyRank(a) || b._free - a._free);
    CG.logEvent('trip_search', city, TAX.service(activeType) ? activeType : '', list.length);
    tripRange = { from, to };
    aiActive = true; shown = list;
    $('aiStatus').hidden = true; $('exampleNotice').hidden = true;
    const when = span === 1 ? niceDay(from) : `${niceDay(from)} – ${niceDay(to)}`;
    status.hidden = false;
    status.innerHTML = `
      <div><strong>${list.length ? `🗓 ${list.length} creator${list.length > 1 ? 's' : ''} free${city ? ` in ${esc(city)}` : ''} · ${esc(when)}` : `No one is free${city ? ` in ${esc(city)}` : ''} on ${esc(when)}`}</strong>
      <p class="muted small">${list.length ? 'Days off and fully booked days are already left out. Book to lock in your day.' : 'Try other dates or a nearby city.'}</p></div>
      <div class="tp-status-actions">
        ${!list.length && city ? `<button type="button" class="primary-btn" id="tpAsk">📣 Ask creators for offers</button><button type="button" class="secondary-btn" id="tpNotify">🔔 Notify me about ${esc(city)}</button>` : ''}
        <button type="button" class="link-btn" id="tpClear">Show all creators</button>
      </div>`;
    $('tpClear').addEventListener('click', () => { status.hidden = true; tripRange = null; loadCreators(); });
    $('tpNotify')?.addEventListener('click', (e) => notifyCity(city, e.currentTarget));
    $('tpAsk')?.addEventListener('click', () => openRequest({ city, from, to, service: TAX.service(activeType) && !TAX.isRemote(activeType) ? activeType : '' }));
    if (city) $('cityFilter').value = city;   // the normal filters continue from here
    if (list.length) renderGrid(list); else $('portfolioGrid').innerHTML = '';
    renderMapList(list);
    refreshMarkers(list, list.length > 0);
    status.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadAllReal() {
    const [{ data }, dl] = await Promise.all([CG.photographers.getAll({}), CG.deals.active()]);
    allReal = data || [];
    deals = new Map();
    for (const d of (dl && dl.data) || []) {
      const pct = Math.round(Number(d.pct));
      if (!(pct >= 10 && pct <= 50) || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.day))) continue;
      if (!deals.has(d.photographer_id)) deals.set(d.photographer_id, []);
      deals.get(d.photographer_id).push({ day: d.day, pct });
    }
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
    if (!String(id).startsWith('ex-')) track('view_creator', { id: String(id) });
    const box = $('detailContent');
    box.innerHTML = '<div class="modal-loading">Loading…</div>';
    openModal('detailModal');

    const p = await findCreator(id);
    if (!p) { box.innerHTML = '<div class="modal-loading">This profile is no longer available.</div>'; return; }
    const isOwn = !!(currentUser && p.user_id === currentUser.id);
    if (!p.isExample && !isOwn) { CG.incrementViews(p.id); CG.logEvent('profile_view', p.city, '', null); }

    const spots = spotsOf(p);
    const reviewsRes = p.isExample ? { data: [] } : await CG.reviews.get(p.id);
    const reviews = reviewsRes.data || [];
    const portfolio = safeUrl(p.portfolio_url);
    const isFav = userFavorites.includes(p.id);

    const gallery = galleryOf(p);
    const sample = galleryOf({ gallery: p.sample_gallery }).slice(0, 40);
    const verifiedCount = reviews.filter(r => r.booking_id).length;
    // Clients' favourite shots: the first photo of each review (the one the traveller picked first), newest first
    const clientPhotos = reviews.filter(r => Array.isArray(r.photos) && safeUrl(r.photos[0])).slice(0, 8);
    const canWatch = !p.isExample && !isOwn && !!p.payouts_enabled && (canBook(p) || p.available === false);
    box.innerHTML = `
      <img class="modal-img" src="${esc(coverOf(p))}" ${imgFallback} alt="${esc(p.name)}" />
      <div class="modal-body">
        ${p.isExample ? '<div class="example-notice compact">This is an <strong>example profile</strong> showing how CapturaGo works. It is not a real creator.</div>' : ''}
        <h2><span translate="no">${esc(p.name)}</span>${verifiedBadge(p.verified)}</h2>
        <div class="modal-meta">
          <span>📍 ${esc(p.city)}</span>
          ${(p.services || []).map(s => `<span class="badge">${SERVICE_ICONS[s] || ''} ${esc(SERVICE_LABELS[s] || s)}</span>`).join('')}
          ${(p.vibes || []).map(v => `<span class="badge badge-soft">${esc(VIBE_LABELS[v] || v)}</span>`).join('')}
          ${(p.services || []).includes('drone') && p.drone_certified ? `<span class="badge badge-soft" title="Declared by the creator, not verified by CapturaGo">🚁 ${esc(TAX.droneBadge(p.drone_region))} (declared)</span>` : ''}
          ${isFounding(p) ? `<span class="badge badge-founding" title="One of the first creators in ${esc(p.founding_city)} on CapturaGo">🏅 Founding creator · ${esc(p.founding_city)}</span>` : ''}
          ${TAX.hasRemote(p.services) ? '<span class="badge badge-soft">🌐 Works remotely</span>' : ''}
          ${PRICE_LABELS[p.price] ? `<span class="badge">${PRICE_LABELS[p.price]}</span>` : ''}
          ${LEVEL_LABELS[p.level] ? `<span class="badge badge-soft">${LEVEL_LABELS[p.level]}</span>` : ''}
          ${p.available !== false ? '<span class="ok">● Available</span>' : '<span class="muted">Not available right now</span>'}
          ${p.travel_available ? '<span class="travels">✈ Travels</span>' : ''}
          ${p.languages ? `<span class="muted">🗣 ${esc(p.languages)}</span>` : ''}
          ${p.reviews_count > 0 ? `<span class="stars-inline">${starRating(p.rating)} ${Number(p.rating).toFixed(1)} (${p.reviews_count})</span>` : ''}
        </div>
        ${canBook(p) && p.instant_book ? '<p style="margin:10px 0 0"><span class="instant-tag">⚡ Instant booking — confirmed as soon as you pay</span></p>' : ''}
        ${replyLabel(p) ? `<p class="reply-time" style="margin:8px 0 0">💬 ${esc(replyLabel(p))}</p>` : ''}
        ${!p.isExample && upcomingTrips(p.trips).length ? `<p class="trip-line">✈️ On the road: ${upcomingTrips(p.trips).slice(0, 4).map((t) => `<strong>${esc(tripCity(t))}</strong> ${esc(tripDates(t))}`).join(' · ')}</p>` : ''}
        ${p.isExample ? '' : `<p class="trust-line">${Number(p.completed_shoots) > 0 ? `📸 <strong>${esc(Number(p.completed_shoots))}</strong> completed shoot${Number(p.completed_shoots) === 1 ? '' : 's'} on CapturaGo · ` : ''}On CapturaGo since ${esc(new Date(p.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))}${isOwn ? '' : ' · 🌍 Chat in any language — we translate'}</p>`}
        <p class="modal-desc" translate="no">${esc(p.description || '')}</p>
        ${gallery.length ? `<div class="gallery-grid" aria-label="Portfolio">${gallery.slice(0, 6).map((g, i) => `
          <button type="button" data-gi="${i}" aria-label="Open photo ${i + 1} of ${gallery.length}"><img src="${esc(safeUrl(g.thumb) || safeUrl(g.url))}" alt="" loading="lazy" ${imgFallback} />${i === 5 && gallery.length > 6 ? `<span class="more">+${gallery.length - 6}</span>` : ''}</button>`).join('')}</div>
          <p class="gallery-count">📷 ${gallery.length} photo${gallery.length > 1 ? 's' : ''} by ${esc(firstName(p.name))} · tap to view</p>` : ''}
        ${sample.length ? `<button type="button" class="sample-btn" id="mSample"><span class="sample-thumbs">${sample.slice(0, 3).map(g => `<img src="${esc(safeUrl(g.thumb) || safeUrl(g.url))}" alt="" loading="lazy" />`).join('')}</span>
          <span><strong>📂 See a full shoot</strong><span class="muted small">${esc(p.sample_title || `Every photo from one real shoot`)} · ${sample.length} photos</span></span></button>` : ''}
        ${clientPhotos.length ? `<div class="client-photos"><strong class="client-photos-title">📸 Clients' favourite shots</strong>
          <div class="client-photos-row">${clientPhotos.map(r => `<button type="button" data-rv="${esc(r.id)}" data-rk="0" aria-label="Open the favourite photo from ${esc(r.reviewer_name)}'s review"><img src="${esc(safeUrl(r.photos[0]))}" alt="" loading="lazy" ${imgFallback} /><span class="cp-stars" aria-hidden="true">${'★'.repeat(Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0))))}</span></button>`).join('')}</div>
          <p class="muted small">Picked by travellers who booked ${esc(firstName(p.name))} — tap to see their review photos.</p></div>` : ''}
        ${(p.occasions || []).length ? `<p class="occasion-line"><strong>Great for:</strong> ${p.occasions.map(o => esc(OCC_LABELS[o] || o)).join(' · ')}</p>` : ''}
        ${renderPackages(p, isOwn)}
        ${canWatch ? '<div class="watch-box" id="mWatch" hidden></div>' : ''}
        <div class="modal-actions">
          ${p.isExample || isOwn ? '' : `<button class="primary-btn" id="mInquiry">Message ${esc(firstName(p.name))}</button>`}
          ${isOwn ? '<a class="primary-btn" href="/dashboard.html" style="text-decoration:none">Edit my listing</a>' : ''}
          ${introVideoOk(p.intro_video_url) ? `<a class="secondary-btn" id="mIntro" href="${esc(p.intro_video_url.trim())}" target="_blank" rel="noopener nofollow noreferrer" style="text-decoration:none">▶ Watch ${esc(firstName(p.name))}’s intro</a>` : ''}
          ${portfolio ? `<a class="secondary-btn" href="${esc(portfolio)}" target="_blank" rel="noopener nofollow" style="text-decoration:none">View portfolio →</a>` : ''}
          ${p.isExample ? '' : `<button class="fav-btn fav-inline ${isFav ? 'fav-active' : ''}" id="mFav" data-fav="${esc(p.id)}" aria-label="Save to favourites">♥</button>`}
        </div>
        <div class="detail-tabs" role="tablist">
          <button class="detail-tab active" data-panel="spots">🗺️ Local spots (${spots.length})</button>
          <button class="detail-tab" data-panel="reviews">⭐ Reviews (${reviews.length})</button>
        </div>
        <div class="detail-panel active" data-panel-id="spots">
          ${spots.length
            ? `<div class="spots-grid">${spots.map(s => `<div class="spot-card" translate="no"><strong>${esc(s.name || s)}</strong>${s.desc ? `<p>${esc(s.desc)}</p>` : ''}</div>`).join('')}</div>
               <p class="muted small" style="margin-top:12px">Book ${esc(firstName(p.name))} and ask to include these spots in your shoot.</p>`
            : '<p class="muted">No local spots listed yet.</p>'}
        </div>
        <div class="detail-panel" data-panel-id="reviews">
          ${reviews.length
            ? reviews.slice(0, 30).map(r => `
              <div class="review-item">
                <div class="review-header"><strong>${esc(r.reviewer_name)}</strong>${r.booking_id ? '<span class="verified-tag" title="This traveller booked and paid through CapturaGo">✓ Verified booking</span>' : ''}<span class="stars-inline">${starRating(r.rating)}</span><span class="muted small">${timeAgo(r.created_at)}</span></div>
                ${r.comment ? `<p translate="no">${esc(r.comment)}</p>` : ''}
                ${Array.isArray(r.photos) && r.photos.filter(safeUrl).length ? `<div class="review-photos">${r.photos.filter(safeUrl).slice(0, 3).map((u, k) => `<button type="button" data-rv="${esc(r.id)}" data-rk="${k}" aria-label="Open photo ${k + 1} from ${esc(r.reviewer_name)}'s review"><img src="${esc(safeUrl(u))}" alt="" loading="lazy" ${imgFallback} /></button>`).join('')}</div>` : ''}
                ${r.reply ? `<div class="review-reply"><div class="review-reply-head"><strong>↩ Reply from ${esc(firstName(p.name))}</strong>${r.reply_at ? `<span class="muted small">${timeAgo(r.reply_at)}</span>` : ''}</div><p translate="no">${esc(r.reply)}</p></div>`
                  : isOwn ? '<a class="link-btn small review-reply-link" href="dashboard.html#reviews">↩ Reply to this review</a>' : ''}
              </div>`).join('')
            : '<p class="muted">No reviews yet.</p>'}
          <p class="muted small" style="margin-top:12px">${p.isExample ? 'Example profiles have no reviews.' : `Only travellers who booked ${esc(firstName(p.name))} through CapturaGo can leave a review${verifiedCount ? ` — ${verifiedCount} of these are from verified bookings` : ''}. After your shoot you'll find “Leave a review” in your bookings.`}</p>
        </div>
        ${p.isExample || isOwn ? '' : `
        <div class="report-wrap">
          <button type="button" class="link-btn report-link" id="mReport">⚑ Report this profile</button>
          <form class="report-box" id="reportBox" hidden>
            <strong>What's wrong?</strong>
            <div class="report-photo" id="reportPhoto" hidden></div>
            <div class="report-reasons" role="radiogroup" aria-label="Reason">
              ${[['fake', 'Fake profile or impersonation'], ['stolen_photos', "Photos that aren't theirs"], ['inappropriate', 'Inappropriate content'], ['scam', 'Scam or asks to pay outside CapturaGo'], ['other', 'Something else']]
                .map(([v, l]) => `<label><input type="radio" name="reportReason" value="${v}" /> ${l}</label>`).join('')}
            </div>
            <label for="reportDetails" class="sr-only">Details</label>
            <textarea id="reportDetails" rows="3" maxlength="1000" placeholder="Anything that helps us check it (optional)"></textarea>
            <div class="report-actions"><button type="submit" class="danger-btn">Send report</button><button type="button" class="link-btn" id="reportCancel">Cancel</button></div>
            <p class="muted small">Our team reviews every report. The creator isn't told who reported them.</p>
          </form>
        </div>`}
      </div>`;

    box.querySelectorAll('.detail-tab').forEach(tab => tab.addEventListener('click', () => {
      box.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t === tab));
      box.querySelectorAll('.detail-panel').forEach(pn => pn.classList.toggle('active', pn.dataset.panelId === tab.dataset.panel));
    }));
    $('mInquiry')?.addEventListener('click', () => { closeModal('detailModal'); openInquiry(p.id); });
    box.querySelectorAll('.book-btn').forEach(btn => btn.addEventListener('click', () => { closeModal('detailModal'); openBooking(p, btn.dataset.pkg); }));
    $('mFav')?.addEventListener('click', () => toggleFav(p.id, $('mFav')));
    const canReport = !p.isExample && !isOwn;
    let reportUrl = null;
    const openReport = (photoUrl) => {
      if (!currentUser) { openAuth('signin'); showToast('Sign in to report a profile.', 'info'); return; }
      if (!$('reportBox')) return;
      reportUrl = photoUrl || null;
      const ph = $('reportPhoto');
      ph.hidden = !reportUrl;
      ph.innerHTML = reportUrl ? `<img src="${esc(reportUrl)}" alt="Reported photo" /><span class="muted small">This photo</span>` : '';
      if (reportUrl) { const r = box.querySelector('input[name="reportReason"][value="stolen_photos"]'); if (r) r.checked = true; }
      $('reportBox').hidden = false; $('mReport').hidden = true;
      $('reportBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    $('mReport')?.addEventListener('click', () => openReport(null));
    $('reportCancel')?.addEventListener('click', () => { $('reportBox').hidden = true; $('mReport').hidden = false; });
    $('reportBox')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reason = box.querySelector('input[name="reportReason"]:checked')?.value;
      if (!reason) { showToast('Please choose what is wrong.', 'error'); return; }
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
      const { error } = await CG.reportListing(p.id, reason, $('reportDetails').value.trim(), reportUrl);
      btn.disabled = false;
      if (error) { showToast(error.message || 'Could not send the report.', 'error', 6000); return; }
      $('reportBox').innerHTML = '<p><strong>Thank you.</strong> Our team will review it within 48 hours.</p>';
      showToast('Report sent — thank you.', 'success');
    });
    const reportOpt = canReport ? { onReport: (k) => openReport(safeUrl(gallery[k].url)) } : {};
    $('mSample')?.addEventListener('click', () => openLightbox(sample.map((g, k) => ({ src: safeUrl(g.url), caption: `${p.sample_title || 'A full shoot'} · ${k + 1}/${sample.length}` })), 0, { slideshow: true, ...(canReport ? { onReport: (k) => openReport(safeUrl(sample[k].url)) } : {}) }));
    box.querySelectorAll('[data-gi]').forEach(btn => btn.addEventListener('click', () =>
      openLightbox(gallery.map((g, k) => ({ src: safeUrl(g.url), caption: `${p.name} · ${k + 1}/${gallery.length}` })), +btn.dataset.gi, reportOpt)));
    box.querySelectorAll('[data-rv]').forEach(btn => btn.addEventListener('click', () => {
      const r = reviews.find((x) => String(x.id) === btn.dataset.rv);
      const urls = (r?.photos || []).filter(safeUrl).slice(0, 3);
      if (!urls.length) return;
      openLightbox(urls.map((u, k) => ({ src: safeUrl(u), caption: `From ${r.reviewer_name}'s review · ${k + 1}/${urls.length}` })), +btn.dataset.rk,
        canReport ? { onReport: (k) => openReport(safeUrl(urls[k])) } : {});
    }));
    if (canWatch) renderWatch(p);
  }

  /* ── 🔔 "NOTIFY ME" on a fully booked creator: one email (or text) when a day opens up or a deal appears ── */
  const WATCH_DAYS = 14;   // "fully booked" = no free day in the next two weeks (or not taking bookings right now)
  let pendingWatch = null;
  async function renderWatch(p) {
    const el = $('mWatch');
    if (!el) return;
    const busy = new Set(await CG.photographers.busyDates(p.id));
    const days = Array.from({ length: WATCH_DAYS }, (_, i) => localIso(addDays(new Date(), i + 1)));
    const off = p.available === false;
    const full = off || (!dealsOf(p).length && days.every((d) => busy.has(d)));
    if (!$('mWatch') || !full) return;
    const first = esc(firstName(p.name));
    let watching = false, phoneOk = false;
    if (currentUser) {
      const [{ data: mine }, { data: ph }] = await Promise.all([CG.watches.mine(), CG.phone.mine()]);
      watching = (mine || []).some((w) => w.photographer_id === p.id && !w.notified_at);
      phoneOk = !!(ph && ph.verified);
    }
    if (!$('mWatch')) return;
    el.hidden = false;
    const title = off ? `${firstName(p.name)} isn't taking bookings right now` : 'Fully booked for the next 2 weeks';   // escaped once, below
    if (watching) {
      el.innerHTML = `<div><strong>🔔 We'll tell you</strong><p class="muted small">You'll get one message when ${first} has a free day again or posts a last-minute deal.</p></div>
        <button type="button" class="link-btn" id="mWatchStop">Stop notifying me</button>`;
      $('mWatchStop').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        const { error } = await CG.watches.remove(p.id);
        if (error) { e.currentTarget.disabled = false; showToast('Could not change it. Please try again.', 'error'); return; }
        showToast('Done — no more alerts about this creator.', 'info');
        renderWatch(p);
      });
      return;
    }
    el.innerHTML = `<div><strong>📅 ${esc(title)}</strong><p class="muted small">Get one message when ${first} has a free day again or posts a last-minute deal.</p>
        ${phoneOk ? '<label class="watch-text"><input type="checkbox" id="mWatchText" /> Also send me a text message</label>' : ''}</div>
      <button type="button" class="primary-btn" id="mWatchBtn">🔔 Notify me</button>`;
    $('mWatchBtn').addEventListener('click', () => watchCreator(p, $('mWatchText')?.checked === true, $('mWatchBtn')));
  }
  async function watchCreator(p, byText, btn) {
    if (!currentUser) {
      pendingWatch = { p, at: Date.now() };
      openAuth('signin');
      showToast(`Sign in and we'll tell you when ${firstName(p.name)} has a free day.`, 'info', 5000);
      return;
    }
    if (btn) btn.disabled = true;
    const { error } = await CG.watches.add(p.id, byText);
    if (error) { if (btn) btn.disabled = false; showToast(error.message || 'Could not save it. Please try again.', 'error', 6000); return; }
    showToast(`Done — we'll tell you once when ${firstName(p.name)} has a free day or a deal.`, 'success', 5000);
    if ($('mWatch')) renderWatch(p);
  }
  function continuePendingWatch() {
    const w = pendingWatch; pendingWatch = null;
    if (w && currentUser && Date.now() - w.at < 15 * 60000 && w.p.user_id !== currentUser.id) watchCreator(w.p, false, null);
  }

  /* ── MESSAGE A CREATOR (private chat in the dashboard and the app) ── */
  let pendingMessage = null;   // creator to message right after signing in
  async function openInquiry(id) {
    const p = await findCreator(id);
    if (!p) return;
    if (p.isExample) { showToast("That's an example profile — it can't receive messages.", 'info'); return; }
    if (!currentUser) {
      pendingMessage = { id: p.id, at: Date.now() };
      openAuth('signin');
      showToast(`Sign in or create a free account to message ${firstName(p.name)}.`, 'info', 5000);
      return;
    }
    if (p.user_id === currentUser.id) { showToast("That's your own listing 🙂", 'info'); return; }
    showToast('Opening your conversation…', 'info');
    const { data, error } = await CG.chat.start(p.id);
    if (error || !data) { showToast(error?.message || 'Could not open the conversation. Please try again.', 'error', 6000); return; }
    track('lead');
    window.location.href = `/dashboard.html?c=${encodeURIComponent(data)}`;
  }
  function continuePendingMessage() {
    const p = pendingMessage; pendingMessage = null;
    if (p && currentUser && Date.now() - p.at < 15 * 60000) openInquiry(p.id);
  }

  /* ── GEOLOCATION ────────────────────────────────────── */
  $('geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) { showToast('Your browser does not support location.', 'error'); return; }
    showToast('Finding your location…', 'info');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const city = await CG.geo.reverse(pos.coords.latitude, pos.coords.longitude);
      if (city) { $('cityFilter').value = city; loadCreators(); showToast(`Showing creators near ${city}`, 'success'); }
      else { map.focus(pos.coords.latitude, pos.coords.longitude, 10); showToast('Location found on the map.', 'info'); }
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
    const services = [...document.querySelectorAll('input[name="services"]:checked')].map(i => i.value);
    const vibes = [...document.querySelectorAll('input[name="vibes"]:checked')].map(i => i.value);
    const occasions = [...document.querySelectorAll('input[name="occasions"]:checked')].map(i => i.value);
    const spots = [...document.querySelectorAll('#spotsContainer .spot-entry')]
      .map(el => ({ name: el.querySelector('.spot-name').value.trim(), desc: el.querySelector('.spot-desc').value.trim() }))
      .filter(s => s.name);

    if (!name || !city || !email || !portfolio) return showToast('Please fill in all fields marked *.', 'error');
    if (!services.length) return showToast('Select at least one service you offer.', 'error');
    let drone = { region: null, info: null };
    if (services.includes('drone')) {
      drone = TAX.readDrone('ad');
      if (drone.error) return showToast(drone.error, 'error', 6000);
    }
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
      const { data, error } = await CG.photographers.insert({
        user_id: currentUser.id,
        name, city,
        coords: coords ? { lat: coords[0], lon: coords[1] } : null,
        type: services[0],
        services, vibes, occasions,
        drone_certified: !!drone.region,
        drone_region: drone.region,
        drone_info: drone.info,
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
      $('charCount').textContent = '0';
      $('coverPreview').innerHTML = '';
      $('spotsContainer').innerHTML = '';
      renderAddFormState();
      track('creator_listed');
      claimPendingInvite().then((who) => { if (who) showToast(`Welcome! ${who} invited you — after your first completed booking you both get a free 7-day boost.`, 'success', 7000); });
      if (!coords) showToast("Listing saved! We couldn't place your city on the map — edit it in your dashboard (e.g. 'Kyoto, Japan').", 'info', 7000);
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
          <strong translate="no">${esc(k.name)}</strong>
          ${k.type === 'delivery' ? '<span class="muted small">🌐 Remote — delivered online</span>' : ''}
          <ul class="pkg-facts">${packageFacts(k).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
          ${k.desc ? `<span class="muted small" translate="no">${esc(k.desc)}</span>` : ''}
        </div>
        <div class="package-buy">
          <span class="package-price">${money(k.price_eur)}</span>
          ${bookable && k.type !== 'delivery' && dealsOf(p).length ? `<span class="package-deal">⚡ ${money(dealCents(k.price_eur, Math.max(...dealsOf(p).map((d) => d.pct))) / 100)} last-minute</span>` : ''}
          ${bookable ? `<button class="primary-btn book-btn" data-pkg="${esc(k.id)}">Book</button>` : ''}
        </div>
      </div>`).join('');
    let note;
    if (p.isExample) note = 'Example packages — this profile is not bookable.';
    else if (isOwn) note = 'This is how travellers see your packages.';
    else if (bookable) note = `🔒 Your payment is held by CapturaGo and only released to ${esc(firstName(p.name))} after your shoot — or, for remote work, once you approve the delivery.`;
    else note = `${esc(firstName(p.name))} takes bookings by message for now — send a message to arrange a date.`;
    const kinds = [...new Set(pkgs.map(k => (k.type === 'delivery' ? 'delivery' : 'session')))];
    const rules = p.isExample ? '' : `<div class="pkg-rules"><strong>If something goes wrong</strong>${kinds.map(t => `<ul>${packageRules({ type: t }).map(r => `<li>✓ ${esc(r)}</li>`).join('')}</ul>`).join('')}</div>`;
    const dealNote = bookable && dealsOf(p).length && pkgs.some((k) => k.type !== 'delivery')
      ? dealsOf(p).map((d) => `<p class="deal-note" data-deal-day="${esc(d.day)}">⚡ Last-minute deal: −${d.pct}% on in-person packages for ${esc(dealDay(d.day))} — pick that day when you book.</p>`).join('') : '';
    return `<div class="packages"><h4>Packages</h4>${dealNote}${rows}${rules}<p class="muted small">${note}</p></div>`;
  }

  async function openBooking(p, pkgId) {
    if (!currentUser) { openAuth('signin'); showToast('Sign in to book — it takes 30 seconds.', 'info'); return; }
    const pkg = packagesOf(p).find(k => String(k.id) === String(pkgId));
    if (!pkg || !canBook(p)) { showToast('This package is no longer available.', 'error'); return; }
    const remote = pkg.type === 'delivery';
    const price = Number(pkg.price_eur);
    const viaLink = getRef() === p.id;
    const partner = getPartner();
    CG.logEvent('book_start', p.city, '', null);
    const feePct = viaLink || partner ? Math.min(LINK_FEE, CLIENT_FEE) : CLIENT_FEE;
    // Last-minute deal on the chosen day (in-person packages only; the server applies the same)
    const dealFor = (iso) => (remote || !iso ? null : dealOn(p, iso));
    const priceFor = (iso) => { const d = dealFor(iso); return d ? dealCents(price, d.pct) / 100 : price; };
    const feeFor = (iso) => Math.round(priceFor(iso) * feePct) / 100;
    const totalFor = (iso) => Math.round((priceFor(iso) + feeFor(iso)) * 100) / 100;
    const fee = feeFor(''), total = totalFor('');
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const maxDate = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const days = Number(pkg.delivery_days) || 0;
    const revisions = Number(pkg.revisions) || 0;
    const dueText = new Date(Date.now() + days * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    const who = esc(firstName(p.name));

    const fields = remote ? `
        <p class="remote-due">🌐 Remote — delivered by <strong>${dueText}</strong>${revisions ? ` · ${plural(revisions, 'revision')} included` : ''}</p>
        <div class="form-row"><label for="bkFiles">Link to your files</label>
          <input id="bkFiles" type="url" maxlength="500" placeholder="https://drive.google.com/…" />
          <p class="form-note">Google Drive, Dropbox or WeTransfer link to the footage or photos ${who} should work on. You can also send it later.</p></div>
        <div class="form-row"><label for="bkNote">What do you need? *</label>
          <textarea id="bkNote" rows="4" maxlength="1000" placeholder="Format (9:16 / 16:9), length, music, style references…"></textarea></div>` : `
        <div class="form-row"><label id="bkDateLabel">Shoot date *</label>
          <div id="bkDateBox" aria-labelledby="bkDateLabel"></div>
          ${p.instant_book ? '<p class="form-note">⚡ Instant booking — your shoot is confirmed as soon as you pay.</p>' : ''}</div>
        <div class="form-row"><label>Time of day</label>
          <div class="slot-chips" id="bkSlots">${window.CG_TIME_SLOTS.map(([k, l]) => `<button type="button" data-slot="${k}" aria-pressed="false">${l}</button>`).join('')}</div></div>
        <div class="form-row"><label for="bkNote">Note for ${who}</label>
          <textarea id="bkNote" rows="3" maxlength="1000" placeholder="Number of people, spots you'd love, anything ${who} should know…"></textarea></div>
        <label class="surprise-row"><input type="checkbox" id="bkSurprise" /> <span><strong>🤫 It's a surprise</strong> (e.g. a proposal)<br/><span class="muted small">${who} is told to keep it secret, and our emails to you won't mention the shoot in the subject.</span></span></label>`;
    const promised = !remote && Number(pkg.edit_days) >= 1 && Number(pkg.edit_days) <= 60;
    const trips = remote ? [] : upcomingTrips(p.trips).filter((t) => t.to >= tomorrow && t.from <= maxDate);
    const promises = remote ? `
          <li>🔒 Payment held safely until you approve the delivery</li>
          ${revisions ? `<li>✏️ ${plural(revisions, 'revision')} included</li>` : ''}
          <li>⏰ Full refund if it isn't delivered on time</li>` : `
          <li>🔒 Payment held safely until ${promised ? 'your photos arrive' : 'your shoot is done'}</li>
          <li>📸 Photos delivered to your private CapturaGo gallery</li>
          <li>↩ Full refund if the creator declines or hasn't confirmed yet</li>
          <li>📅 Free cancellation up to 7 days before a confirmed shoot</li>`;

    $('bookContent').innerHTML = `
      <h2 class="inq-title">Book ${who}</h2>
      <p class="muted" style="margin-bottom:18px" id="bkPlace">📍 ${esc(p.city)}${remote ? ' · works remotely' : ''}</p>
      <div class="book-summary"><strong translate="no">${esc(pkg.name)}</strong><span class="muted small">${pkgMeta(pkg)}</span></div>
      <form id="bookForm" novalidate>
        ${fields}
        <div class="pay-options">
          <details class="pay-opt" id="bkGiftBox"><summary><span>🎁 Pay with a gift card</span></summary>
            <div class="pay-opt-body"><label for="bkGift" class="sr-only">Gift card code</label>
              <div class="gift-apply"><input id="bkGift" type="text" maxlength="30" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CG-XXXX-XXXX-XXXX-XXXX" translate="no" />
                <button type="button" class="secondary-btn" id="bkGiftApply">Apply</button></div>
              <p class="form-note" id="bkGiftMsg" aria-live="polite"></p></div></details>
          ${remote ? '' : `<details class="pay-opt" id="bkSplitBox"><summary><span>👯 Split the cost with friends</span></summary>
            <div class="pay-opt-body"><div class="slot-chips" id="bkSplit" role="group" aria-label="Number of people paying">${[1, 2, 3, 4, 5, 6].map((n) => `<button type="button" data-n="${n}" aria-pressed="${n === 1}" class="${n === 1 ? 'on' : ''}">${n === 1 ? 'Just me' : n}</button>`).join('')}</div>
              <p class="form-note" id="bkSplitNote">You pay your share now and get a payment link for each friend. Everyone has 48 hours to pay — if someone doesn't, everyone is refunded automatically. For shoots at least 3 days away.</p></div></details>`}
        </div>
        <div class="price-breakdown" id="bkPrice">
          <div><span>Package</span><span>${money(price)}</span></div>
          <div class="deal-line" id="bkDealLine" hidden><span id="bkDealLabel"></span><span id="bkDealAmt"></span></div>
          ${fee > 0 ? `<div><span>Service fee (${feePct}%)${feePct < CLIENT_FEE ? ` <span class="book-chip">reduced — ${viaLink ? `via ${who}’s link` : `recommended by ${esc(partner.name || 'your stay')}`}</span>` : ''}</span><span id="bkFeeAmt">${money(fee)}</span></div>` : ''}
          <div class="total"><span>Total</span><span id="bkTotalAmt">${money(total)}</span></div>
          <div class="gift-line" id="bkGiftLine" hidden><span>Gift card</span><span id="bkGiftAmt"></span></div>
          <div class="total pay-now" id="bkPayNowRow" hidden><span id="bkPayNowLabel">To pay now</span><span id="bkPayNow"></span></div>
        </div>
        <ul class="book-promises">${promises}</ul>
        ${packageFacts(pkg).length ? `<div class="book-included"><strong>What's included</strong><ul>${packageFacts(pkg).map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
        <details class="book-faq"><summary>What happens if…?</summary>
          ${remote ? `<p><strong>…it's late?</strong> If it isn't delivered by the due date, you can cancel for a full refund.</p>
          <p><strong>…I don't like it?</strong> Ask for the included revisions. If it isn't what you agreed, report a problem — the payment stays frozen until we've checked it.</p>`
          : `<p><strong>…it rains?</strong> Either of you can propose a new date. It's free if you both agree; if no date works, the creator cancels and you get a full refund.</p>
          <p><strong>…I need to cancel?</strong> Free up to 7 days before a confirmed shoot (full refund, including the service fee).</p>
          <p><strong>…the creator doesn't show up?</strong> Report it from your bookings — after our check you get a full refund.</p>
          ${promised ? `<p><strong>…the photos are late?</strong> Your payment stays on hold until they arrive. If they're late, report it from your bookings and we'll step in.</p>` : ''}
          <p><strong>…I'm shy in front of a camera?</strong> Most travellers are! Tell ${who} in a message — they'll guide you through the poses.</p>`}
        </details>
        <button type="submit" class="primary-btn" style="width:100%">Continue to secure payment</button>
        <p class="muted small" style="text-align:center;margin-top:10px">Payments are processed by Stripe. <a href="/terms.html#bookings" target="_blank">Booking terms</a></p>
      </form>`;
    openModal('bookModal');

    // Date: calendar with the creator's busy days; folds into one line once picked
    let date = '', slot = '';
    if (!remote) {
      const busy = new Set(await CG.photographers.busyDates(p.id));
      const box = $('bkDateBox');
      const showPlace = () => {   // where the shoot is: home city, or the trip city on trip days
        const t = date ? tripOn(p.trips, date) : null;
        $('bkPlace').innerHTML = t ? `✈️ <strong>${esc(t.city)}</strong> — on ${who}’s trip` : `📍 ${esc(p.city)}`;
      };
      const showSummary = () => {
        showPlace();
        const nice = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
        box.innerHTML = `<button type="button" class="date-summary" id="bkDateSummary"><span>📅</span><strong>${esc(nice)}</strong><span>Change</span></button>`;
        $('bkDateSummary').addEventListener('click', showCal);
      };
      function showCal() {
        box.innerHTML = `<div class="calendar" id="bkCal"></div>${busy.size ? '<p class="form-note">Crossed-out days are already booked or unavailable.</p>' : ''}`
          + (trips.length ? `<p class="form-note trip-note" id="bkTrips">✈️ ${trips.slice(0, 3).map((t) => `${who} is in <strong>${esc(tripCity(t))}</strong> ${esc(tripDates(t))}`).join(' · ')} — shoots on those days take place there.</p>` : '');
        const inRange = (d) => d && d >= tomorrow && d <= maxDate;
        const tripStart = p._trip ? (p._trip.from >= tomorrow ? p._trip.from : tomorrow) : '';
        const startAt = date || (tripRange && inRange(tripRange.from) ? tripRange.from : inRange(tripStart) ? tripStart : tomorrow);
        renderCalendar($('bkCal'), { min: tomorrow, max: maxDate, start: startAt, isOff: (iso) => busy.has(iso), selected: new Set(date ? [date] : []), onPick: (iso) => { date = iso; showSummary(); repriced(); },
          dayClass: (iso) => [tripOn(trips, iso) ? 'trip' : '', dealFor(iso) && !busy.has(iso) ? 'deal' : ''].filter(Boolean).join(' '),
          dayLabel: (iso) => { const t = tripOn(trips, iso), d = dealFor(iso); return [t ? `in ${tripCity(t)}` : '', d && !busy.has(iso) ? `last-minute −${d.pct}%` : ''].filter(Boolean).join(', '); } });
        if (dealsOf(p).length && !remote) box.insertAdjacentHTML('beforeend', `<p class="form-note deal-cal-note">⚡ ${dealsOf(p).map((d) => { const w = dealDay(d.day); return `${esc(w.charAt(0).toUpperCase() + w.slice(1))}: −${d.pct}% last-minute price`; }).join(' · ')}</p>`);
      }
      // Opened from a deal / "a day opened up" link: that day is already chosen (if it's still free)
      const want = wantDay && wantDay.id === String(p.id).toLowerCase() ? wantDay.day : '';
      wantDay = null;
      if (want && want >= tomorrow && want <= maxDate && !busy.has(want)) { date = want; showSummary(); }
      else showCal();
      $('bkSlots').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        slot = slot === b.dataset.slot ? '' : b.dataset.slot;
        $('bkSlots').querySelectorAll('button').forEach(x => { x.classList.toggle('on', x.dataset.slot === slot); x.setAttribute('aria-pressed', x.dataset.slot === slot ? 'true' : 'false'); });
      }));
    }

    // Gift card and split: one or the other (the server checks the same)
    let totalCents = Math.round(total * 100);
    let gift = null, split = 1;
    function repriced() {   // a day with a last-minute deal was (un)chosen → new price, fee and total
      const d = dealFor(date);
      totalCents = Math.round(totalFor(date) * 100);
      $('bkDealLine').hidden = !d;
      $('bkDealLabel').textContent = d ? `⚡ Last-minute (−${d.pct}%)` : '';
      $('bkDealAmt').textContent = d ? `−${money(Math.round((price - priceFor(date)) * 100) / 100)}` : '';
      if ($('bkFeeAmt')) $('bkFeeAmt').textContent = money(feeFor(date));
      $('bkTotalAmt').textContent = money(totalFor(date));
      if (gift) { const used = giftCover(totalCents, gift.balance); $('bkGiftMsg').textContent = `✓ ${money(gift.balance / 100)} on this card — ${money(used / 100)} is used for this booking${gift.balance > used ? `, ${money((gift.balance - used) / 100)} stays on it` : ''}.`; }
      payNow();
    }
    const payNow = () => {
      const g = gift ? giftCover(totalCents, gift.balance) : 0;
      const share = split > 1 ? splitShares(totalCents, split)[0] : 0;
      $('bkGiftLine').hidden = !g;
      $('bkGiftAmt').textContent = g ? `−${money(g / 100)}` : '';
      $('bkPayNowRow').hidden = !g && split === 1;
      $('bkPayNowLabel').textContent = split > 1 ? `Your share (1 of ${split})` : 'To pay now';
      $('bkPayNow').textContent = money((split > 1 ? share : totalCents - g) / 100);
      const btn = $('bookForm').querySelector('button[type=submit]');
      if (!btn.disabled) btn.textContent = g >= totalCents ? 'Book with my gift card' : split > 1 ? `Pay my share — ${money(share / 100)}` : 'Continue to secure payment';
      if ($('bkSplitBox')) $('bkSplitBox').classList.toggle('pay-opt-off', !!gift);
      $('bkGiftBox').classList.toggle('pay-opt-off', split > 1);
    };
    const giftMsg = (t, bad) => { const m = $('bkGiftMsg'); m.textContent = t; m.classList.toggle('form-error', !!bad); };
    $('bkGiftApply').addEventListener('click', async () => {
      if (gift) { gift = null; $('bkGift').value = ''; $('bkGift').disabled = false; $('bkGiftApply').textContent = 'Apply'; giftMsg(''); payNow(); return; }
      if (split > 1) return giftMsg("A gift card can't be combined with splitting the cost.", true);
      const code = giftCodeNorm($('bkGift').value);
      if (!code) return giftMsg('Enter the code from your gift card (CG-XXXX-XXXX-XXXX-XXXX).', true);
      $('bkGiftApply').disabled = true;
      const { data, error } = await CG.gifts.check(code);
      $('bkGiftApply').disabled = false;
      if (error || !data?.ok) return giftMsg(data?.error || error?.message || 'Could not check the code. Please try again.', true);
      gift = { code, balance: Number(data.balance_cents) || 0 };
      $('bkGift').value = code; $('bkGift').disabled = true; $('bkGiftApply').textContent = 'Remove';
      const used = giftCover(totalCents, gift.balance);
      giftMsg(`✓ ${money(gift.balance / 100)} on this card — ${money(used / 100)} is used for this booking${gift.balance > used ? `, ${money((gift.balance - used) / 100)} stays on it` : ''}.`);
      payNow();
    });
    $('bkGift').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); $('bkGiftApply').click(); } });
    if (date) repriced();   // a day was chosen up front (deal link) → its price, fee and total
    // Came from the gift card page ("Use it on a last-minute deal"): the code is filled in and checked
    let carried = '';
    try { carried = giftCodeNorm(sessionStorage.getItem('cg_gift_code') || '') || ''; } catch { carried = ''; }
    if (carried) { $('bkGift').value = carried; $('bkGiftBox').open = true; $('bkGiftApply').click(); }
    $('bkSplit')?.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (gift) { showToast("Remove the gift card first — it can't be combined with splitting the cost.", 'info'); return; }
      split = Number(b.dataset.n);
      $('bkSplit').querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      payNow();
    }));

    $('bookForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const note = $('bkNote').value.trim();
      const payload = { photographer_id: p.id, package_id: pkg.id, note, ...(viaLink ? { ref: p.id } : {}), ...(partner ? { partner: partner.code } : {}) };
      if (remote) {
        const files = $('bkFiles').value.trim();
        if (files && !/^https:\/\/[^\s]+$/i.test(files)) return showToast('The link to your files must start with https://', 'error');
        if (note.length < 10) return showToast(`Tell ${firstName(p.name)} what you need (at least a sentence).`, 'error');
        payload.files_url = files;
      } else {
        if (!date) return showToast('Choose a date for your shoot.', 'error');
        if (date < tomorrow || date > maxDate) return showToast('Choose a date between tomorrow and one year ahead.', 'error');
        payload.shoot_date = date;
        if (slot) payload.time_slot = slot;
        if ($('bkSurprise')?.checked) payload.surprise = true;
        if (split > 1) {
          if (date < new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)) return showToast('To split the cost, choose a shoot date at least 3 days away — your friends need time to pay.', 'error', 6000);
          payload.split = split;
        }
      }
      if (gift) payload.gift_code = gift.code;
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = gift && giftCover(totalCents, gift.balance) >= totalCents ? 'Booking…' : 'Opening secure payment…';
      const { data, error } = await CG.pay.checkout(payload);
      if (error || !data?.url) {
        btn.disabled = false; btn.textContent = 'Continue to secure payment'; payNow();
        showToast(error?.message || 'Could not start the payment. Please try again.', 'error', 6000);
        return;
      }
      track('begin_checkout', { value: totalCents / 100, id: String(pkg.id) });
      if (gift) { try { sessionStorage.removeItem('cg_gift_code'); } catch {} }
      window.location.href = data.url;
    });
  }

  /* ── AI MATCH ───────────────────────────────────────── */
  let aiActive = false;
  const PRICE_WORDS = { budget: ['cheap', 'budget', 'affordable', 'student'], premium: ['luxury', 'premium', 'high-end'] };

  // Keyword fallback when the AI service is unavailable — uses the same taxonomy keywords
  function localMatch(q) {
    const t = q.toLowerCase();
    const hit = (x) => x.kw.some(w => t.includes(w));
    const wantSvc = TAX.services.filter(hit).map(s => s.id);
    const wantVibe = TAX.vibes.filter(hit).map(v => v.id);
    const wantOcc = TAX.occasions.filter(hit).map(o => o.id);
    const wantsRemote = wantSvc.length > 0 && wantSvc.every(id => TAX.isRemote(id));
    const words = t.split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3);
    const scored = allReal.filter(c => c.available !== false).map(c => {
      const cityParts = String(c.city || '').toLowerCase().split(/[^\p{L}]+/u).filter(w => w.length > 2);
      const cityHit = cityParts.some(w => t.includes(w));
      const svcHits = wantSvc.filter(id => (c.services || []).includes(id));
      let score = cityHit ? 10 : 0;
      score += svcHits.length * 4;
      score += wantVibe.filter(id => (c.vibes || []).includes(id)).length * 2;
      score += wantOcc.filter(id => (c.occasions || []).includes(id)).length * 3;
      for (const [k, ws] of Object.entries(PRICE_WORDS)) if (ws.some(w => t.includes(w)) && c.price === k) score += 1;
      const hay = `${c.description || ''} ${c.languages || ''} ${spotsOf(c).map(x => x.name).join(' ')}`.toLowerCase();
      score += words.filter(w => hay.includes(w)).length * 0.5;
      return { c, score, cityHit, svcHits };
    });
    let pool, min;
    if (wantsRemote) { pool = scored.filter(x => x.svcHits.length); min = 4; }
    else {
      const local = scored.filter(x => x.cityHit);
      pool = local.length ? local : scored.filter(x => x.c.travel_available);
      min = local.length ? 10 : 2;
    }
    return pool.filter(x => x.score >= min).sort((a, b) => b.score - a.score).slice(0, 6).map(x => ({
      id: x.c.id,
      reason: wantsRemote ? `Remote · ${x.svcHits.map(id => SERVICE_LABELS[id]).join(', ')}`
        : x.cityHit ? `Based in ${x.c.city}` : `Travels — based in ${x.c.city}`
    }));
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
      if (entry.target.querySelector('#map')) setTimeout(() => map.resize(), 700);
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ── START ──────────────────────────────────────────── */
  renderDestinations();
  const qp = new URLSearchParams(location.search);
  const deepLink = ['city', 'service', 'vibe', 'occasion'].some(k => qp.get(k));
  if (qp.get('city')) $('cityFilter').value = qp.get('city').slice(0, 80);
  if (qp.get('service')) setType(qp.get('service'));
  if (qp.get('vibe') && TAX.vibe(qp.get('vibe'))) setVibe(qp.get('vibe'));
  if (qp.get('occasion')) setOccasion(qp.get('occasion'));
  await refreshAuth();
  allRealReady = loadAllReal();

  /* 🏅 Founding creator spots open in a few cities (set by the CapturaGo team) */
  (async function loadFounding() {
    const box = $('foundingOpen');
    if (!box) return;
    const { data } = await CG.founding.cities();
    const open = (data || []).filter((c) => c.spots_left > 0).slice(0, 8);
    if (!open.length) return;
    box.hidden = false;
    box.innerHTML = `<strong>🏅 Founding creator spots are open</strong>
      <p class="muted small">The first creators in these cities get a 🏅 badge on their profile${open.some((c) => c.perk_days > 0) ? ' and a free boost to the top of the results' : ''}. Finish your listing, then claim your spot in the dashboard. One spot per person.</p>
      <div class="founding-cities">${open.map((c) => `<a href="/in/${esc(citySlug(c.city_label))}" class="founding-chip"><span>${esc(c.city_label)}</span><small>${c.spots_left} of ${c.slots} left${c.perk_days ? ` · ${c.perk_days}-day boost` : ''}</small></a>`).join('')}</div>`;
  })();
  await loadCreators();
  if (deepLink) $('portfolio-section').scrollIntoView({ behavior: 'smooth' });
  if (/^[0-9a-f-]{36}$/i.test(qp.get('creator') || '')) {
    // From a deal / "a day opened up" link: ?creator=<id>&day=YYYY-MM-DD → the booking calendar opens on that day
    const day = String(qp.get('day') || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day >= localIso(addDays(new Date(), 1))) { tripRange = { from: day, to: day }; wantDay = { id: qp.get('creator').toLowerCase(), day }; }
    openDetail(qp.get('creator'));
  }
  // Sent by a partner (hotel / hostel QR card): capturago.com/?p=CODE → lower service fee for 30 days
  if (qp.get('p')) {
    const { data: pi } = await CG.partners.info(qp.get('p'));
    if (pi && pi.name) {
      rememberPartner(qp.get('p'), pi.name);
      showToast(`Welcome, guest of ${pi.name}! You get a lower service fee on every booking for 30 days.`, 'success', 7000);
    }
    history.replaceState(null, '', location.pathname + location.hash);
  }
  // Invited by a creator: capturago.com/?invite=CODE
  if (qp.get('invite') && rememberInvite(qp.get('invite'))) {
    const { data: inv } = await CG.invites.info(qp.get('invite'));
    const box = $('inviteBanner');
    if (inv && box) {
      box.hidden = false;
      box.innerHTML = `<div><strong>🎁 ${esc(inv.name)}${inv.city ? ` from ${esc(inv.city)}` : ''} invited you to CapturaGo</strong>
        <p class="muted small">Create your free creator listing. After your first completed booking, you both get a free 7-day boost to the top of the results.</p></div>
        <a class="primary-btn" href="#join-section" style="text-decoration:none">Create my listing</a>
        <button type="button" class="invite-x" aria-label="Close">&times;</button>`;
      box.querySelector('a').addEventListener('click', () => { box.hidden = true; });
      box.querySelector('.invite-x').addEventListener('click', () => { box.hidden = true; });
    }
    history.replaceState(null, '', location.pathname + location.hash);
  }
  if (userListing) claimPendingInvite();
  if (qp.get('request') === '1') openRequest({ city: String(qp.get('city') || '').slice(0, 80) });
  // Personal booking link: capturago.com/c/<handle> → /?handle=<handle>
  const handle = String(qp.get('handle') || '').toLowerCase();
  if (/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(handle)) {
    const { data: hp } = await CG.photographers.getByHandle(handle);
    if (hp) { setRef(hp.id); openDetail(hp.id); history.replaceState(null, '', '/'); }
    else showToast("We couldn't find that creator. Browse everyone below.", 'info', 6000);
  }
  setTimeout(() => map.resize(), 400);

  CG.auth.onChange(async (event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') { await refreshAuth(); }
  });
});
