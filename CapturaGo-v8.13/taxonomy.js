/* ================================================================
   CapturaGo taxonomy — the ONE place where categories are defined.
   Filters, sign-up form, dashboard, cards, AI match fallback and the
   landing pages all read from here. To add a category, add it here
   (and to AI_SERVICES in supabase/functions/_src/ai-match.js).
================================================================ */
(function () {
  const services = [
    // On location — you meet on a date
    { id: 'photo',      group: 'onsite', icon: '📷', label: 'Photography',          short: 'Photographers',      kw: ['photo', 'photographer', 'portrait', 'pictures', 'photoshoot'] },
    { id: 'video',      group: 'onsite', icon: '🎬', label: 'Videography',          short: 'Videographers',      kw: ['videograph', 'video shoot', 'filmed', 'film us', 'film our', 'film me'] },
    { id: 'phone',      group: 'onsite', icon: '📱', label: 'Phone content',        short: 'Phone content',      kw: ['phone', 'iphone', 'reels', 'instagram', 'tiktok', 'content creator', 'photo dump'] },
    { id: 'event',      group: 'onsite', icon: '💍', label: 'Wedding & event content', short: 'Weddings & events', kw: ['wedding', 'elopement', 'event', 'party', 'same-day', 'behind the scenes'] },
    { id: 'drone',      group: 'onsite', icon: '🚁', label: 'Drone / aerial',       short: 'Drone pilots',       kw: ['drone', 'aerial', 'from above', 'bird'] },
    { id: 'guide',      group: 'onsite', icon: '🗺️', label: 'Local guide',          short: 'Local guides',       kw: ['guide', 'show us', 'hidden spots', 'locations', 'fixer', 'local tips'] },
    // Remote — delivered online, from anywhere
    { id: 'edit',       group: 'remote', icon: '✏️', label: 'Photo retouching & colour', short: 'Retouchers',     kw: ['retouch', 'edit my photos', 'photo editing', 'colour grad', 'color grad', 'lightroom', 'preset'] },
    { id: 'video_edit', group: 'remote', icon: '🎞️', label: 'Video editing',        short: 'Video editors',      kw: ['video edit', 'edit my video', 'travel film', 'montage', 'trip video', 'footage into'] },
    { id: 'clip',       group: 'remote', icon: '✂️', label: 'Clipping (short-form)', short: 'Clippers',          kw: ['clip', 'clipping', 'shorts', 'podcast', 'stream', 'long video', 'short-form'] },
    { id: 'thumbnail',  group: 'remote', icon: '🖼️', label: 'Thumbnail design',     short: 'Thumbnail designers', kw: ['thumbnail', 'youtube cover'] },
    { id: 'ugc',        group: 'remote', icon: '🛍️', label: 'UGC for brands',       short: 'UGC creators',       kw: ['ugc', 'product video', 'brand', 'ad creative', 'testimonial video'] },
  ];

  const vibes = [
    { id: 'moody',     icon: '🌑', label: 'Dark & moody',     kw: ['moody', 'dark', 'dramatic'] },
    { id: 'airy',      icon: '☁️', label: 'Airy & dreamy',    kw: ['airy', 'bright', 'dreamy', 'soft', 'ethereal', 'romantic'] },
    { id: 'golden',    icon: '🌅', label: 'Golden hour',      kw: ['golden', 'sunset', 'sunrise', 'sun-kissed', 'warm'] },
    { id: 'candid',    icon: '🫶', label: 'Candid',           kw: ['candid', 'natural', 'documentary', 'unposed', 'real moments'] },
    { id: 'film',      icon: '🎞️', label: 'Film / analog',    kw: ['film', 'analog', 'analogue', 'vintage', 'grain', '35mm'] },
    { id: 'digicam',   icon: '📸', label: 'Digicam / Y2K',    kw: ['digicam', 'y2k', 'point and shoot', 'point-and-shoot', '2000s'] },
    { id: 'flash',     icon: '⚡', label: 'Flash / paparazzi', kw: ['flash', 'paparazzi', 'night out'] },
    { id: 'cinematic', icon: '🎥', label: 'Cinematic',        kw: ['cinematic', 'movie', 'film look'] },
    { id: 'editorial', icon: '🗞️', label: 'Editorial',        kw: ['editorial', 'fashion', 'magazine', 'vogue'] },
    { id: 'vibrant',   icon: '🌈', label: 'Vibrant',          kw: ['vibrant', 'colourful', 'colorful', 'bold', 'saturated'] },
    { id: 'bw',        icon: '🖤', label: 'Black & white',    kw: ['black and white', 'black & white', 'b&w', 'monochrome', 'timeless'] },
    { id: 'photodump', icon: '🤳', label: 'Photo dump',       kw: ['photo dump', 'casual', 'carousel', 'iphone look'] },
  ];

  const occasions = [
    { id: 'proposal',   icon: '💍', label: 'Proposal',            blurb: 'Capture the yes — without them noticing.', kw: ['proposal', 'propose', 'engagement', 'engaged', 'pop the question'] },
    { id: 'couples',    icon: '💞', label: 'Couples & honeymoon', blurb: 'Photos of you two, not just selfies.',      kw: ['couple', 'honeymoon', 'anniversary', 'girlfriend', 'boyfriend', 'wife', 'husband'] },
    { id: 'wedding',    icon: '👰', label: 'Wedding & elopement', blurb: 'Elopements and destination weddings.',      kw: ['wedding', 'elope', 'elopement', 'bride'] },
    { id: 'solo',       icon: '🧳', label: 'Solo travel',         blurb: 'Finally be in your own travel photos.',     kw: ['solo', 'alone', 'by myself', 'myself'] },
    { id: 'family',     icon: '👨‍👩‍👧', label: 'Family & friends', blurb: 'Everyone in the picture for once.',        kw: ['family', 'kids', 'children', 'friends', 'group', 'bachelorette'] },
    { id: 'birthday',   icon: '🎂', label: 'Birthday & celebrations', blurb: 'Make the milestone look the part.',    kw: ['birthday', 'celebration', 'graduation party', 'turning'] },
    { id: 'headshots',  icon: '💼', label: 'Headshots & LinkedIn', blurb: 'Professional photos in under an hour.',   kw: ['headshot', 'linkedin', 'cv', 'resume', 'corporate', 'professional photo'] },
    { id: 'dating',     icon: '❤️', label: 'Dating profile',      blurb: 'Natural photos that actually get matches.', kw: ['dating', 'tinder', 'hinge', 'bumble', 'profile pic'] },
    { id: 'graduation', icon: '🎓', label: 'Graduation',          blurb: 'Cap, gown and the whole campus.',          kw: ['graduation', 'graduate', 'graduating', 'diploma', 'convocation'] },
    { id: 'content',    icon: '✨', label: 'Influencer content',  blurb: 'A content partner who knows the angles.',  kw: ['influencer', 'content', 'instagram', 'tiktok', 'feed', 'creator', 'youtube'] },
    { id: 'business',   icon: '🏨', label: 'Business & Airbnb',   blurb: 'Cafés, hotels, Airbnbs and products.',     kw: ['business', 'airbnb', 'hotel', 'restaurant', 'cafe', 'café', 'product', 'menu', 'real estate', 'shop'] },
    { id: 'events',     icon: '🎉', label: 'Events & parties',    blurb: 'Parties, launches and conferences.',       kw: ['event', 'party', 'conference', 'launch', 'festival', 'concert'] },
  ];

  const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  const S = byId(services), V = byId(vibes), O = byId(occasions);
  const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ── Drone rules (checked Oct 2026: EASA + FAA) ──────────────────
     EU/EEA/CH: every operator of a camera drone must register (any weight,
       paid or hobby; only toys / sub-250 g without camera are exempt).
       250 g or more also needs the A1/A3 (or A2) certificate of competency.
     US: paid work = FAA Part 107 → Remote Pilot Certificate + Part 107
       drone registration, regardless of weight.
     Numbers are stored privately and shown publicly only as a badge. */
  const DRONE_REGIONS = [
    { id: 'easa',  label: 'EU / EEA / Switzerland (EASA rules)', badge: 'EU-registered drone operator' },
    { id: 'faa',   label: 'United States (FAA rules)',           badge: 'FAA Part 107 drone pilot' },
    { id: 'other', label: 'Another country',                     badge: 'Drone pilot' },
  ];
  const clean = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, '');

  function droneFields(p) {
    return `
      <div class="drone-box" id="${p}DroneBox" hidden>
        <p class="drone-title">🚁 Drone rules</p>
        <div class="form-row"><label for="${p}DroneRegion">Where do you fly for clients? *</label>
          <select id="${p}DroneRegion"><option value="">Choose…</option>${DRONE_REGIONS.map((r) => `<option value="${r.id}">${escHtml(r.label)}</option>`).join('')}</select></div>
        <div data-drone-region="easa" hidden>
          <p class="form-note">In the EU, anyone flying a drone with a camera must be registered as an operator — any weight, paid or hobby. Drones of 250 g or more also need the A1/A3 (or A2) certificate.</p>
          <div class="form-row"><label for="${p}EuOp">Operator registration number *</label>
            <input id="${p}EuOp" maxlength="24" placeholder="16 characters, e.g. SVK…" autocomplete="off" />
            <p class="form-note">The public number shown on your drone. Never enter the 3 secret characters after the dash.</p></div>
          <div class="form-row"><label for="${p}EuWeight">Your drone's weight *</label>
            <select id="${p}EuWeight"><option value="">Choose…</option><option value="sub250">Under 250 g (e.g. DJI Mini series)</option><option value="250plus">250 g or more</option></select></div>
          <div class="form-row" id="${p}EuCertRow" hidden><label for="${p}EuCert">A1/A3 or A2 certificate number *</label>
            <input id="${p}EuCert" maxlength="40" autocomplete="off" /></div>
        </div>
        <div data-drone-region="faa" hidden>
          <p class="form-note">Paid drone work in the US requires an FAA Part 107 Remote Pilot Certificate and a Part 107 drone registration — even for drones under 250 g.</p>
          <div class="form-row"><label for="${p}UsCert">Part 107 certificate number *</label><input id="${p}UsCert" maxlength="20" autocomplete="off" /></div>
          <div class="form-row"><label for="${p}UsReg">FAA drone registration number *</label><input id="${p}UsReg" maxlength="20" placeholder="FA…" autocomplete="off" /></div>
        </div>
        <div data-drone-region="other" hidden>
          <p class="form-note">Drone rules differ by country. Add your permit or registration number if your country requires one.</p>
          <div class="form-row"><label for="${p}OtherReg">Permit / registration number</label><input id="${p}OtherReg" maxlength="60" autocomplete="off" /></div>
        </div>
        <label class="service-check-label"><input type="checkbox" id="${p}DroneDeclare" /> I confirm these details are correct and I follow the drone rules where I fly (no-fly zones, Remote ID where required). *</label>
      </div>`;
  }

  function wireDrone(p, droneCheckbox) {
    const $ = (id) => document.getElementById(p + id);
    const sync = () => {
      $('DroneBox').hidden = !droneCheckbox.checked;
      const region = $('DroneRegion').value;
      document.querySelectorAll(`#${p}DroneBox [data-drone-region]`).forEach((el) => { el.hidden = el.dataset.droneRegion !== region; });
      $('EuCertRow').hidden = $('EuWeight').value !== '250plus';
    };
    droneCheckbox.addEventListener('change', sync);
    $('DroneRegion').addEventListener('change', sync);
    $('EuWeight').addEventListener('change', sync);
    sync();
    return sync;
  }

  /** Validates the drone fields. Returns { error } or { region, info }. */
  function readDrone(p) {
    const $ = (id) => document.getElementById(p + id);
    const region = $('DroneRegion').value;
    if (!DRONE_REGIONS.some((r) => r.id === region)) return { error: 'Choose where you fly your drone for clients.' };
    let info;
    if (region === 'easa') {
      const raw = clean($('EuOp').value);
      if (/-/.test(raw)) return { error: 'Enter only the public 16-character operator number, without the secret part after the dash.' };
      if (!/^[A-Z]{3}[A-Z0-9]{13}$/.test(raw)) return { error: 'EU operator numbers have 16 characters and start with a 3-letter country code (e.g. SVK…).' };
      const weight = $('EuWeight').value;
      if (weight !== 'sub250' && weight !== '250plus') return { error: "Choose your drone's weight." };
      const cert = clean($('EuCert').value);
      if (weight === '250plus' && !/^[A-Z0-9./-]{4,40}$/.test(cert)) return { error: 'Drones of 250 g or more need an A1/A3 or A2 certificate number.' };
      info = { operator: raw, weight, cert: weight === '250plus' ? cert : null };
    } else if (region === 'faa') {
      const cert = clean($('UsCert').value), reg = clean($('UsReg').value);
      if (!/^[A-Z0-9-]{4,20}$/.test(cert)) return { error: 'Enter your FAA Part 107 certificate number.' };
      if (!/^FA[A-Z0-9]{6,14}$/.test(reg)) return { error: 'FAA drone registration numbers start with "FA".' };
      info = { cert, registration: reg };
    } else {
      const reg = String($('OtherReg').value || '').trim().slice(0, 60);
      if (reg && !/^[\p{L}\p{N} ./-]{2,60}$/u.test(reg)) return { error: 'The permit number can only contain letters, numbers, spaces, dots, slashes and dashes.' };
      info = { registration: reg || null };
    }
    if (!$('DroneDeclare').checked) return { error: 'Please confirm your drone details and that you follow the local drone rules.' };
    return { region, info };
  }

  function fillDrone(p, region, info) {
    const $ = (id) => document.getElementById(p + id);
    info = info || {};
    $('DroneRegion').value = region || '';
    $('EuOp').value = region === 'easa' ? info.operator || '' : '';
    $('EuWeight').value = region === 'easa' ? info.weight || '' : '';
    $('EuCert').value = region === 'easa' ? info.cert || '' : '';
    $('UsCert').value = region === 'faa' ? info.cert || '' : '';
    $('UsReg').value = region === 'faa' ? info.registration || '' : '';
    $('OtherReg').value = region === 'other' ? info.registration || '' : '';
    $('DroneDeclare').checked = !!region;
  }

  const droneBadge = (region) => (DRONE_REGIONS.find((r) => r.id === region) || DRONE_REGIONS[2]).badge;

  window.CG_TAX = {
    droneRegions: DRONE_REGIONS, droneFields, wireDrone, readDrone, fillDrone, droneBadge,
    services, vibes, occasions,
    service: (id) => S[id], vibe: (id) => V[id], occasion: (id) => O[id],
    isRemote: (id) => !!(S[id] && S[id].group === 'remote'),
    hasRemote: (list) => (list || []).some((id) => S[id] && S[id].group === 'remote'),
    hasOnsite: (list) => (list || []).some((id) => S[id] && S[id].group === 'onsite'),
    label: (kind, id) => {
      const x = (kind === 'service' ? S : kind === 'vibe' ? V : O)[id];
      return x ? x.label : id;
    },
    /** Render checkboxes. kind: 'service' | 'vibe' | 'occasion'. group filters services. */
    renderChecks(container, kind, name, group) {
      if (!container) return;
      const list = kind === 'service' ? services.filter((s) => !group || s.group === group) : kind === 'vibe' ? vibes : occasions;
      container.innerHTML = list.map((x) =>
        `<label class="service-check-label"><input type="checkbox" name="${escHtml(name)}" value="${escHtml(x.id)}" /> ${x.icon} ${escHtml(x.label)}</label>`).join('');
    },
    /** <option> list for a service <select>, grouped. */
    serviceOptions(allLabel) {
      const opt = (s) => `<option value="${s.id}">${s.icon} ${escHtml(s.label)}</option>`;
      return `<option value="">${escHtml(allLabel)}</option>
        <optgroup label="On location">${services.filter((s) => s.group === 'onsite').map(opt).join('')}</optgroup>
        <optgroup label="Remote — from anywhere"><option value="remote">🌐 Any remote service</option>${services.filter((s) => s.group === 'remote').map(opt).join('')}</optgroup>`;
    },
  };
})();
