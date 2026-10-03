/* ================================================================
   CapturaGo — creator categories (single source of truth)
   Services, vibes and occasions used by the filters, the sign-up
   form, the dashboard and the quick (non-AI) match.
   To add a category: add it here, then mirror it in
   supabase/functions/_src/ai-match.js (AI prompt) and
   supabase/functions/notify-inquiry/index.ts (email label).
   Keep values short and lowercase: they are stored in the database.
================================================================ */

(function () {
  /* What a creator offers. `plural` is used in filters ("Drone pilots"). */
  const SERVICES = [
    { id: 'photo', icon: '📷', label: 'Photography',             plural: 'Photographers',
      words: ['photo', 'portrait', 'pictures', 'photographer'] },
    { id: 'video', icon: '🎬', label: 'Videography',             plural: 'Videographers',
      words: ['video', 'videographer', 'clip', 'reel', 'travel film', 'short film'] },
    { id: 'phone', icon: '📱', label: 'Phone content',           plural: 'Phone content creators',
      hint: 'Casual Reels, TikToks and photo dumps shot on the client\'s phone',
      words: ['phone', 'iphone', 'photo dump', 'tiktok', 'instagram', 'reels', 'stories', 'casual'] },
    { id: 'event', icon: '💍', label: 'Wedding & event content', plural: 'Wedding & event creators',
      hint: 'Same-day Reels and behind-the-scenes alongside the official photographer',
      words: ['wedding', 'event', 'bride', 'groom', 'party', 'same-day', 'same day', 'behind the scenes', 'bts'] },
    { id: 'drone', icon: '🚁', label: 'Drone',                   plural: 'Drone pilots', needsCert: true,
      words: ['drone', 'aerial', 'from above', 'bird\'s eye', 'birds eye'] },
    { id: 'edit',  icon: '✏️', label: 'Editing',                 plural: 'Editors',
      words: ['edit', 'retouch', 'colour', 'color grad'] },
    { id: 'guide', icon: '🗺️', label: 'Local guide',             plural: 'Local guides',
      hint: 'Show people the best spots — no camera needed',
      words: ['guide', 'spots', 'locations', 'show us around', 'fixer', 'local tips'] }
  ];

  /* Visual style. Keep this list at 10–12 so the filter stays usable. */
  const VIBES = [
    { id: 'moody',     icon: '🌑', label: 'Dark & moody',        words: ['moody', 'dark', 'dramatic'] },
    { id: 'airy',      icon: '☀️', label: 'Bright & airy',       words: ['bright', 'airy', 'light and airy'] },
    { id: 'film',      icon: '🎞️', label: 'Film / vintage',      words: ['film', 'vintage', 'analog', 'analogue', 'grain', 'retro'] },
    { id: 'cinematic', icon: '🎬', label: 'Cinematic',           words: ['cinematic', 'movie'] },
    { id: 'flash',     icon: '⚡', label: 'Flash / paparazzi',   words: ['flash', 'paparazzi', 'night out'] },
    { id: 'digicam',   icon: '📸', label: 'Digicam / Y2K',       words: ['digicam', 'y2k', 'point and shoot', 'point-and-shoot', '2000s'] },
    { id: 'candid',    icon: '🌿', label: 'Candid / documentary', words: ['candid', 'documentary', 'natural', 'no posing', 'unposed'] },
    { id: 'golden',    icon: '🌅', label: 'Golden hour',         words: ['golden hour', 'golden', 'sunset', 'sunrise', 'sun-kissed', 'sunkissed', 'warm'] },
    { id: 'bw',        icon: '🖤', label: 'Black & white',       words: ['black and white', 'black & white', 'b&w', 'monochrome', 'timeless'] },
    { id: 'editorial', icon: '👗', label: 'Editorial / fashion', words: ['editorial', 'fashion', 'magazine', 'vogue'] },
    { id: 'vibrant',   icon: '🌈', label: 'Vibrant / colourful', words: ['vibrant', 'colourful', 'colorful', 'saturated', 'bold'] },
    { id: 'dreamy',    icon: '☁️', label: 'Dreamy / soft',       words: ['dreamy', 'soft', 'ethereal', 'romantic'] }
  ];

  /* Who it's for — what clients book creators for. */
  const OCCASIONS = [
    { id: 'travel',     icon: '✈️', label: 'Holiday & travel',        words: ['holiday', 'vacation', 'trip', 'travel'] },
    { id: 'couples',    icon: '❤️', label: 'Couples & honeymoon',     words: ['couple', 'honeymoon', 'anniversary', 'engagement', 'girlfriend', 'boyfriend', 'partner'] },
    { id: 'proposal',   icon: '💍', label: 'Proposal',                words: ['proposal', 'propose', 'marry me', 'surprise'] },
    { id: 'wedding',    icon: '🥂', label: 'Wedding & events',        words: ['wedding', 'elopement', 'event', 'bride', 'groom'] },
    { id: 'birthday',   icon: '🎂', label: 'Birthday & celebrations', words: ['birthday', 'celebrat', 'party'] },
    { id: 'solo',       icon: '🧳', label: 'Solo travellers',         words: ['solo', 'alone', 'by myself', 'on my own'] },
    { id: 'family',     icon: '👨‍👩‍👧', label: 'Family',             words: ['family', 'kids', 'children', 'baby'] },
    { id: 'dating',     icon: '💘', label: 'Dating profile',          words: ['dating', 'tinder', 'bumble', 'hinge'] },
    { id: 'headshots',  icon: '💼', label: 'Headshots & LinkedIn',    words: ['headshot', 'linkedin', 'corporate', 'cv photo', 'professional photo'] },
    { id: 'graduation', icon: '🎓', label: 'Graduation',              words: ['graduat'] },
    { id: 'content',    icon: '🤳', label: 'Influencers & content',   words: ['influencer', 'content creator', 'ugc', 'brand deal', 'nomad'] },
    { id: 'business',   icon: '🏪', label: 'Business & Airbnb',       words: ['business', 'café', 'cafe', 'restaurant', 'airbnb', 'hotel', 'menu', 'shop'] }
  ];

  const toMap = (list, key) => Object.fromEntries(list.map(x => [x.id, x[key]]));
  const ids = (list) => new Set(list.map(x => x.id));
  const SERVICE_IDS = ids(SERVICES), VIBE_IDS = ids(VIBES), OCCASION_IDS = ids(OCCASIONS);

  /* Checkbox chips for a form: <label><input type=checkbox name=… value=…> icon label</label> */
  function checkboxes(list, name) {
    return list.map(x => `<label class="service-check-label"${x.hint ? ` title="${esc(x.hint)}"` : ''}><input type="checkbox" name="${esc(name)}" value="${esc(x.id)}" /> ${x.icon} ${esc(x.label)}</label>`).join('');
  }

  /* Fill a container (by id) only if it exists on the page. */
  function fill(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
    return el;
  }

  /* Keep only known values, in canonical order, without duplicates. */
  function clean(values, idSet) {
    const want = new Set(Array.isArray(values) ? values : []);
    return [...idSet].filter(v => want.has(v));
  }

  window.CG_CATS = {
    SERVICES, VIBES, OCCASIONS,
    SERVICE_LABELS: toMap(SERVICES, 'label'),
    SERVICE_ICONS: toMap(SERVICES, 'icon'),
    VIBE_LABELS: toMap(VIBES, 'label'),
    OCCASION_LABELS: toMap(OCCASIONS, 'label'),
    OCCASION_ICONS: toMap(OCCASIONS, 'icon'),
    cleanServices: (v) => clean(v, SERVICE_IDS),
    cleanVibes: (v) => clean(v, VIBE_IDS),
    cleanOccasions: (v) => clean(v, OCCASION_IDS),
    checkboxes, fill,

    /* <option>s for a service <select>. `plural` → "Drone pilots" wording. */
    serviceOptions: (plural) => SERVICES.map(s => `<option value="${esc(s.id)}">${s.icon} ${esc(plural ? s.plural : s.label)}</option>`).join(''),
    occasionOptions: () => OCCASIONS.map(o => `<option value="${esc(o.id)}">${o.icon} ${esc(o.label)}</option>`).join('')
  };
})();
