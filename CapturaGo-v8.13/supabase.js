/* ================================================================
   CapturaGo — Supabase data layer
   Keys verified against your project (ref: drpugnclcgfmrfhxujwu).
   The anon key is designed to be public; security comes from the
   Row Level Security rules in schema.sql / security-patch.sql.
   NEVER put the secret / service_role key in this file.
================================================================ */

const SUPABASE_URL = 'https://drpugnclcgfmrfhxujwu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRycHVnbmNsY2dmbXJmaHh1and1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0ODY5MDQsImV4cCI6MjEwNTA2MjkwNH0.jRH2hrvxqlvBK6zx0AzQCZTEksVhfTpA9UUkwbmh_qc';

(function () {
  let db = null;
  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  } catch (err) {
    console.error('[CapturaGo] Could not start Supabase client:', err);
  }
  window.db = db;

  const OFFLINE = { data: null, error: { message: 'Service unavailable. Please try again later.' } };

  /* Every call returns { data, error } and never throws. */
  async function run(fn, timeoutMs = 20000) {
    if (!db) return OFFLINE;
    try {
      let timer;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), timeoutMs); });
      const res = await Promise.race([Promise.resolve(fn(db)), timeout]).finally(() => clearTimeout(timer));
      return { data: res?.data ?? null, error: res?.error ?? null };
    } catch (err) {
      console.error('[CapturaGo]', err);
      return { data: null, error: { message: err?.message || 'Unexpected error.' } };
    }
  }

  const origin = () => window.location.origin;

  /* Public listing columns. "email" is deliberately excluded — it is private
     and readable only by its owner via my_listing_email(). */
  const BASE_COLS = 'id,user_id,name,city,coords,languages,type,services,vibes,specialties,level,description,tags,local_spots,portfolio_url,cover_image_url,price,available,travel_available,rating,reviews_count,views_count,verified,featured,created_at,updated_at';
  const V8_COLS = BASE_COLS + ',packages,payouts_enabled,boosted_until,occasions,drone_certified,drone_region';
  const V9_COLS = V8_COLS + ',gallery,handle,unavailable_dates,max_per_day,instant_book';
  const V10_COLS = V9_COLS + ',founding_city,founding_at';
  const V11_COLS = V10_COLS + ',reply_minutes,reply_samples';
  const V12_COLS = V11_COLS + ',sample_gallery,sample_title,intro_video_url,completed_shoots';
  const LISTING_COLS = V12_COLS + ',trips';
  /* If the latest database.sql hasn't been run yet, newer columns don't exist (or aren't
     readable). Retry with older column sets so the site keeps working. */
  const COLUMN_ERRORS = ['42703', '42501', 'PGRST204'];
  async function withCols(make) {
    let res;
    for (const cols of [LISTING_COLS, V12_COLS, V11_COLS, V10_COLS, V9_COLS, V8_COLS, BASE_COLS]) {
      res = await run(d => make(d, cols));
      if (!(res.error && COLUMN_ERRORS.includes(res.error.code))) return res;
    }
    return res;
  }

  /* Server functions (payments, AI). Errors carry the server's message. */
  async function fn(name, body) {
    if (!db) return OFFLINE;
    try {
      const { data, error } = await db.functions.invoke(name, { body });
      if (error) {
        let message = error.message || 'Request failed.';
        let status = 0;
        try {
          status = error.context?.status || 0;
          const payload = await error.context?.json?.();
          if (payload?.error) message = payload.error;
        } catch {}
        return { data: null, error: { message, status } };
      }
      return { data, error: null };
    } catch (err) {
      return { data: null, error: { message: err?.message || 'Network error.' } };
    }
  }
  const REVIEW_COLS = 'id,photographer_id,user_id,reviewer_name,rating,comment,created_at';

  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  window.CG = {
    isConfigured: !!db,

    auth: {
      signUp: (email, password, fullName) => run(d => d.auth.signUp({
        email, password,
        options: { data: { full_name: fullName }, emailRedirectTo: origin() + '/' }
      })),
      signIn: (email, password) => run(d => d.auth.signInWithPassword({ email, password })),
      signOut: () => run(d => d.auth.signOut()),
      resetPassword: (email) => run(d => d.auth.resetPasswordForEmail(email, {
        redirectTo: origin() + '/reset-password.html'
      })),
      updatePassword: (password) => run(d => d.auth.updateUser({ password })),
      getUser: async () => {
        if (!db) return null;
        try { const { data } = await db.auth.getUser(); return data?.user || null; }
        catch { return null; }
      },
      onChange: (cb) => {
        if (!db) return;
        try { db.auth.onAuthStateChange((event, session) => cb(event, session)); } catch {}
      }
    },

    photographers: {
      getAll: (filters = {}) => withCols((d, cols) => {
        let q = d.from('photographers').select(cols)
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false });
        if (filters.city) q = q.ilike('city', `%${filters.city}%`);
        if (filters.price) q = q.eq('price', filters.price);
        return q;
      }, 5000),
      getById: (id) => withCols((d, cols) => d.from('photographers').select(cols).eq('id', id).maybeSingle()),
      getByUserId: (uid) => withCols((d, cols) => d.from('photographers').select(cols).eq('user_id', uid).maybeSingle()),
      getByHandle: (handle) => withCols((d, cols) => d.from('photographers').select(cols).eq('handle', String(handle).toLowerCase()).maybeSingle()),
      busyDates: async (pid) => {
        const { data, error } = await run(d => d.rpc('creator_busy_dates', { p_photographer_id: pid }));
        if (error) return [];
        return (data || []).map(x => (typeof x === 'string' ? x : x.creator_busy_dates)).filter(Boolean);
      },
      myDroneInfo: async () => {
        const { data, error } = await run(d => d.rpc('my_drone_info'));
        return error ? null : (data || null);
      },
      myEmail: async () => {
        const { data, error } = await run(d => d.rpc('my_listing_email'));
        return error ? null : (data || null);
      },
      insert: (payload) => withCols((d, cols) => d.from('photographers').insert([payload]).select(cols).single()),
      update: (id, payload) => withCols((d, cols) => d.from('photographers').update(payload).eq('id', id).select(cols).single()),
      remove: (id) => run(d => d.from('photographers').delete().eq('id', id))
    },

    storage: {
      MAX_UPLOAD_BYTES, ALLOWED_TYPES,
      /** Upload an already-resized JPEG blob into the creator's own public folder. */
      uploadPublicJpeg: async (blob, userId, prefix = 'g') => {
        if (!db) return { url: null, path: null, error: OFFLINE.error };
        if (!blob || blob.size > MAX_UPLOAD_BYTES) return { url: null, path: null, error: { message: 'Image is too large (max 5 MB).' } };
        try {
          const path = `${userId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const { error } = await db.storage.from('photographer-covers').upload(path, blob, { upsert: false, contentType: 'image/jpeg' });
          if (error) return { url: null, path: null, error };
          return { url: db.storage.from('photographer-covers').getPublicUrl(path).data.publicUrl, path, error: null };
        } catch (err) { return { url: null, path: null, error: { message: err?.message || 'Upload failed.' } }; }
      },
      /** Remove the creator's own public files (old gallery photos). Best effort. */
      removePublic: async (urls, userId) => {
        if (!db) return;
        const marker = '/photographer-covers/';
        const paths = (urls || []).map(u => { const i = String(u).indexOf(marker); return i < 0 ? null : decodeURIComponent(String(u).slice(i + marker.length).split('?')[0]); })
          .filter(p => p && p.startsWith(`${userId}/`));
        if (paths.length) { try { await db.storage.from('photographer-covers').remove(paths); } catch {} }
      },
      uploadCover: async (file, userId) => {
        if (!db) return { url: null, error: OFFLINE.error };
        if (!ALLOWED_TYPES.includes(file.type)) return { url: null, error: { message: 'Please upload a JPG, PNG or WebP image.' } };
        if (file.size > MAX_UPLOAD_BYTES) return { url: null, error: { message: 'Image is too large (max 5 MB).' } };
        try {
          const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
          const path = `${userId}/${Date.now()}.${ext}`;
          const { error } = await db.storage.from('photographer-covers')
            .upload(path, file, { upsert: false, contentType: file.type });
          if (error) return { url: null, error };
          const { data } = db.storage.from('photographer-covers').getPublicUrl(path);
          return { url: data.publicUrl, error: null };
        } catch (err) {
          return { url: null, error: { message: err?.message || 'Upload failed.' } };
        }
      }
    },

    geo: {
      geocode: async (city) => {
        if (!city || city.trim().length < 2) return null;
        try {
          const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
            encodeURIComponent(city.trim()), { headers: { 'Accept-Language': 'en' } });
          if (!r.ok) return null;
          const j = await r.json();
          return j?.length ? [parseFloat(j[0].lat), parseFloat(j[0].lon)] : null;
        } catch { return null; }
      },
      reverse: async (lat, lon) => {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            { headers: { 'Accept-Language': 'en' } });
          if (!r.ok) return null;
          const j = await r.json();
          return j?.address?.city || j?.address?.town || j?.address?.village || null;
        } catch { return null; }
      }
    },

    inquiries: {
      send: (p) => run(d => d.from('inquiries').insert([p])),
      get: (pid) => run(d => d.from('inquiries').select('*').eq('photographer_id', pid).order('created_at', { ascending: false })),
      markRead: (id) => run(d => d.from('inquiries').update({ read: true }).eq('id', id))
    },

    favorites: {
      get: async (uid) => {
        const { data } = await run(d => d.from('favorites').select('photographer_id').eq('user_id', uid));
        return (data || []).map(r => r.photographer_id);
      },
      toggle: async (uid, pid) => {
        const found = await run(d => d.from('favorites').select('id').eq('user_id', uid).eq('photographer_id', pid).maybeSingle());
        if (found.error) return { added: false, error: found.error };
        if (found.data) {
          const del = await run(d => d.from('favorites').delete().eq('id', found.data.id));
          return { added: false, error: del.error };
        }
        const ins = await run(d => d.from('favorites').insert([{ user_id: uid, photographer_id: pid }]));
        return { added: !ins.error, error: ins.error };
      }
    },

    reviews: {
      get: async (pid) => {
        const q = (cols) => run(d => d.from('reviews').select(cols).eq('photographer_id', pid).order('created_at', { ascending: false }));
        for (const cols of [REVIEW_COLS + ',booking_id,photos', REVIEW_COLS + ',booking_id']) {
          const res = await q(cols);
          if (!(res.error && COLUMN_ERRORS.includes(res.error.code))) return res;
        }
        return q(REVIEW_COLS);
      },
      add: (p) => run(d => d.from('reviews').insert([p])),
      /** booking ids I have already reviewed */
      myBookingIds: async (uid) => {
        const { data } = await run(d => d.from('reviews').select('booking_id').eq('user_id', uid).not('booking_id', 'is', null));
        return (data || []).map(r => r.booking_id);
      }
    },

    /* Photo delivery: private bucket "deliveries", <booking id>/<file> + a small preview t_<file> */
    deliveries: {
      list: (bookingId) => run(d => d.from('booking_photos').select('id,booking_id,path,width,height,favorite,created_at').eq('booking_id', bookingId).order('created_at', { ascending: true }).limit(300)),
      counts: async (bookingIds) => {
        if (!bookingIds.length) return {};
        const { data } = await run(d => d.from('booking_photos').select('booking_id').in('booking_id', bookingIds).limit(5000));
        const out = {}; (data || []).forEach(r => { out[r.booking_id] = (out[r.booking_id] || 0) + 1; }); return out;
      },
      thumbPath: (path) => { const [dir, file] = String(path).split('/'); return `${dir}/t_${file}`; },
      signedUrls: async (paths, seconds = 3600) => {
        if (!db || !paths.length) return {};
        try {
          const { data } = await db.storage.from('deliveries').createSignedUrls(paths, seconds);
          const out = {}; (data || []).forEach(x => { if (x && x.signedUrl && !x.error) out[x.path] = x.signedUrl; }); return out;
        } catch { return {}; }
      },
      /** full: JPEG blob (max 3000 px), thumb: JPEG blob (max 600 px) */
      upload: async (bookingId, full, thumb, size) => {
        if (!db) return { error: OFFLINE.error };
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const path = `${bookingId}/${name}`;
        try {
          const up = await db.storage.from('deliveries').upload(path, full, { upsert: false, contentType: 'image/jpeg' });
          if (up.error) return { error: up.error };
          if (thumb) await db.storage.from('deliveries').upload(`${bookingId}/t_${name}`, thumb, { upsert: false, contentType: 'image/jpeg' });
          const row = await run(d => d.from('booking_photos').insert([{ booking_id: bookingId, path, width: size?.w || null, height: size?.h || null }]).select('id,booking_id,path,width,height,favorite,created_at').single());
          if (row.error) { try { await db.storage.from('deliveries').remove([path, `${bookingId}/t_${name}`]); } catch {} }
          return row;
        } catch (err) { return { error: { message: err?.message || 'Upload failed.' } }; }
      },
      remove: async (photo) => {
        const r = await run(d => d.from('booking_photos').delete().eq('id', photo.id).select('id'));
        if (r.error || !(r.data || []).length) return { error: r.error || { message: 'This photo can no longer be removed.' } };
        try { await db.storage.from('deliveries').remove([photo.path, window.CG.deliveries.thumbPath(photo.path)]); } catch {}
        return { error: null };
      },
      favorite: (id, on) => run(d => d.from('booking_photos').update({ favorite: !!on }).eq('id', id))
    },

    incrementViews: (pid) => run(d => d.rpc('increment_views', { photographer_id: pid })),

    /* Report a profile or one of its photos (reviewed by the CapturaGo team) */
    reportListing: (photographerId, reason, details, photoUrl) => run(d => d.rpc('report_listing', {
      p_photographer_id: photographerId, p_reason: reason, p_details: details || null, p_photo_url: photoUrl || null })),

    /* Anonymous search insights — no names, emails or IP addresses. Never blocks or fails the page. */
    logEvent: (kind, city, service, results) => {
      if (!db) return;
      try { db.rpc('log_search_event', { p_kind: kind, p_city: city || null, p_service: service || null, p_results: Number.isInteger(results) ? results : null }).then(() => {}, () => {}); } catch {}
    },

    /* "Notify me when a creator joins <city>" */
    alerts: {
      create: (city, service) => run(d => d.rpc('create_city_alert', { p_city: city, p_service: service || null })),
      mine: () => run(d => d.from('city_alerts').select('id,city_label,service,created_at,notified_at').order('created_at', { ascending: false })),
      remove: (id) => run(d => d.from('city_alerts').delete().eq('id', id))
    },

    /* Quick replies: my own saved messages (private; max 20, checked by the database) */
    templates: {
      list: () => run(d => d.from('reply_templates').select('id,title,body,updated_at').order('created_at', { ascending: true })),
      add: (title, body) => run(d => d.from('reply_templates').insert([{ title, body }]).select('id,title,body,updated_at').single()),
      update: (id, title, body) => run(d => d.from('reply_templates').update({ title, body }).eq('id', id).select('id,title,body,updated_at').single()),
      remove: (id) => run(d => d.from('reply_templates').delete().eq('id', id))
    },

    /* Optional emails (review reminder, "a year ago"): my setting, and the one-click unsubscribe link */
    emailPrefs: {
      mine: () => run(d => d.rpc('my_email_prefs')),
      setTips: (on) => run(d => d.rpc('set_email_tips', { p_on: !!on })),
      unsubscribe: (token) => run(d => d.rpc('email_unsubscribe', { p_token: String(token || '') }))
    },

    /* My language (English, Deutsch, Español, Français) on my account — our emails and text messages use it */
    prefs: {
      setLanguage: async (lang) => {
        if (!db || !['en', 'de', 'es', 'fr'].includes(lang)) return { data: null, error: null };
        try { const { data } = await db.auth.getSession(); if (!data?.session) return { data: null, error: null }; } catch { return { data: null, error: null }; }
        const res = await run(d => d.rpc('set_my_language', { p_lang: lang }));
        if (!res.error) { try { localStorage.setItem('cg_lang_saved', `${(await db.auth.getUser()).data?.user?.id || ''}:${lang}`); } catch {} }
        return res;
      }
    },

    /* Calendar sync: a private feed of my bookings for my calendar app, and busy days read from my own calendar */
    calendar: {
      feedToken: (reset) => run(d => d.rpc('my_calendar_feed', { p_reset: !!reset })),
      feedUrl: (token) => `${SUPABASE_URL}/functions/v1/calendar?t=${encodeURIComponent(token)}`,
      status: () => run(d => d.rpc('my_calendar_sync')),
      connect: (url) => run(d => d.rpc('set_calendar_import', { p_url: String(url || '').trim() })),
      disconnect: () => run(d => d.rpc('remove_calendar_import')),
      syncNow: () => fn('calendar', { action: 'sync' })
    },

    /* Founding creators: open cities (public), my status, claim a spot (checked by the database) */
    founding: {
      cities: () => run(d => d.rpc('founding_cities_public')),
      status: () => run(d => d.rpc('founding_status')),
      claim: () => run(d => d.rpc('claim_founding_spot'))
    },

    /* Trip planner: who is free in <city> between two dates (sessions only) */
    availableCreators: (city, from, to) => run(d => d.rpc('available_creators', { p_city: city || null, p_from: from, p_to: to })),

    /* Share a delivered gallery with friends (view-only link that expires) */
    shares: {
      create: (bookingId, days, favoritesOnly) => run(d => d.rpc('create_gallery_share', { p_booking_id: bookingId, p_days: days, p_favorites_only: !!favoritesOnly })),
      list: (bookingId) => run(d => d.from('gallery_shares').select('token,expires_at,favorites_only,views,created_at').eq('booking_id', bookingId).order('created_at', { ascending: false })),
      remove: (token) => run(d => d.from('gallery_shares').delete().eq('token', token)),
      open: (token) => fn('shared-gallery', { token })
    },

    ai: {
      match: (query) => fn('ai-match', { query })
    },

    /* Gift cards: buy one (Stripe), check a code before booking, the cards I bought (with their codes) */
    gifts: {
      buy: (p) => fn('create-gift', p),
      check: (code) => run(d => d.rpc('check_gift', { p_code: String(code || '').slice(0, 40) })),
      mine: () => run(d => d.rpc('my_gift_cards'))
    },

    /* 🧾 EU DAC7: my tax details (private — only I and the server can read them) */
    tax: {
      mine: () => run(d => d.rpc('my_tax_info')),
      save: (p) => run(d => d.rpc('save_tax_info', { p }))
    },

    /* 🔔 "Notify me" on a fully booked creator: one email (or text) when a day opens up or a deal appears */
    watches: {
      add: (pid, byText) => run(d => d.rpc('watch_creator', { p_photographer: pid, p_text: !!byText })),
      remove: (pid) => run(d => d.rpc('unwatch_creator', { p_photographer: pid })),
      mine: async () => {
        const res = await run(d => d.rpc('my_creator_watches'));
        return res.error ? { data: [], error: null } : res;   // database update not run yet → nothing to show
      }
    },

    /* Last-minute deals: the live ones (public), and mine — a lower price tomorrow or the day after */
    deals: {
      active: () => run(d => d.rpc('active_deals')),
      mine: () => run(d => d.rpc('my_last_minute')),
      set: (day, pct) => run(d => d.rpc('set_last_minute', { p_day: day, p_pct: Math.round(Number(pct)) })),
      remove: (day) => run(d => d.rpc('remove_last_minute', { p_day: day }))
    },

    /* Text reminders on the shoot day: my number (confirmed with a code), SMS or WhatsApp */
    phone: {
      mine: () => run(d => d.rpc('my_phone')),
      start: (phone, channel) => fn('phone', { action: 'start', phone, channel, consent: true }),
      verify: (code) => fn('phone', { action: 'verify', code }),
      prefs: (reminders, channel) => run(d => d.rpc('set_phone_prefs', { p_reminders: reminders, p_channel: channel || null })),
      remove: () => run(d => d.rpc('remove_my_phone'))
    },

    /* Invite a creator: my code + stats, who invited me (public: first name + city), claim an invite once */
    invites: {
      mine: () => run(d => d.rpc('my_invite')),
      info: (code) => run(d => d.rpc('invite_info', { p_code: String(code || '').slice(0, 12) })),
      claim: (code) => run(d => d.rpc('claim_invite', { p_code: String(code || '').slice(0, 12) }))
    },

    /* Partners (hotels, hostels, tour desks): apply, my partner page, the public name for the welcome note */
    partners: {
      apply: (a) => run(d => d.rpc('apply_partner', { p_name: a.name, p_kind: a.kind, p_city: a.city, p_website: a.website || null, p_contact: a.contact, p_message: a.message || '', p_payout: a.payout || '' })),
      mine: () => run(d => d.rpc('my_partner')),
      info: (code) => run(d => d.rpc('partner_info', { p_code: String(code || '').slice(0, 12) }))
    },

    /* Shoot requests: a traveller describes the shoot, creators send offers (every rule is checked by the database) */
    requests: {
      create: (r) => run(d => d.rpc('create_shoot_request', { p_city: r.city, p_from: r.from, p_to: r.to, p_service: r.service, p_people: r.people, p_budget: r.budget ?? null, p_note: r.note || '' })),
      mine: () => run(d => d.rpc('my_shoot_requests')),
      close: (id) => run(d => d.rpc('close_shoot_request', { p_id: id })),
      decline: (offerId) => run(d => d.rpc('decline_offer', { p_offer: offerId })),
      forMe: () => run(d => d.rpc('requests_for_me')),
      offer: (o) => run(d => d.rpc('make_offer', { p_request: o.request, p_price: o.price, p_date: o.date, p_minutes: o.minutes, p_photos: o.photos ?? null, p_edit_days: o.edit_days ?? null, p_message: o.message || '' })),
      withdraw: (offerId) => run(d => d.rpc('withdraw_offer', { p_offer: offerId })),
      book: (offerId) => fn('create-checkout', { offer_id: offerId })
    },

    /* Split the cost with friends: the organiser's shares (with payment links), and a friend's link */
    split: {
      mine: (bookingId) => run(d => d.rpc('my_booking_shares', { p_booking: bookingId })),
      info: (token) => run(d => d.rpc('share_info', { p_token: token })),
      pay: (token) => fn('pay-share', { token })
    },

    pay: {
      connect: (action, country) => fn('stripe-connect', { action, country }),
      checkout: (p) => fn('create-checkout', p),
      boost: (plan) => fn('create-boost', { plan })
    },

    account: { remove: () => fn('delete-account', { confirm: 'DELETE' }) },

    /* Private messages — only the two people in a conversation can read it (database security rules). */
    chat: {
      COLS: 'id,photographer_id,client_user_id,creator_user_id,client_name,last_message_at,last_message,last_sender_id,client_read_at,creator_read_at,blocked_by,created_at,photographers(name,city,cover_image_url)',
      list: () => run(d => d.from('conversations').select(window.CG.chat.COLS).order('last_message_at', { ascending: false }).limit(200)),
      get: (id) => run(d => d.from('conversations').select(window.CG.chat.COLS).eq('id', id).maybeSingle()),
      messages: async (id, after) => {
        const r = await run(d => {
          let q = d.from('messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', id);
          if (after) q = q.gt('created_at', after);
          return q.order('created_at', { ascending: false }).limit(300);
        });
        return { data: r.data ? [...r.data].reverse() : null, error: r.error };
      },
      send: (id, body) => run(d => d.from('messages').insert([{ conversation_id: id, body }]).select('id,conversation_id,sender_id,body,created_at').single()),
      start: (photographerId) => run(d => d.rpc('start_conversation', { p_photographer_id: photographerId })),
      forBooking: (bookingId) => run(d => d.rpc('booking_conversation', { p_booking_id: bookingId })),
      markRead: (id) => run(d => d.rpc('mark_conversation_read', { p_conversation_id: id })),
      block: (id, blocked) => run(d => d.rpc('set_conversation_blocked', { p_conversation_id: id, p_blocked: blocked })),
      report: (id, reason) => run(d => d.rpc('report_conversation', { p_conversation_id: id, p_reason: reason })),
      translate: (messageId, lang) => fn('translate', { message_id: messageId, lang }),
      /** Live updates; returns an unsubscribe function. Polling in the page keeps working without it. */
      subscribe: (name, table, filter, cb) => {
        if (!db) return () => {};
        try {
          const ch = db.channel(name).on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, cb).subscribe();
          return () => { try { db.removeChannel(ch); } catch {} };
        } catch { return () => {}; }
      }
    },

    admin: (action, payload = {}) => fn('admin', { ...payload, action }),
    jobs: { run: () => fn('scheduled-jobs', {}) },

    bookings: {
      list: async () => {
        const base = 'id,photographer_id,creator_user_id,client_user_id,client_name,client_email,package_name,package_minutes,shoot_date,note,currency,price_cents,client_fee_cents,creator_fee_cents,total_cents,status,created_at,photographers(name,city)';
        const extra = ',booking_type,client_files_url,delivery_url,delivered_at,revisions_allowed,revisions_used,last_revision_note';
        const v9 = ',time_slot,via_link,photos_ready_at,completed_at';
        const v10 = ',proposed_date,proposed_slot,proposed_by,proposed_reason,proposed_at,reschedules,dispute_reason,shot_list,ref_links,meeting_point,meeting_time,surprise';
        const q = (cols) => run(d => d.from('bookings').select(cols).order('created_at', { ascending: false }));
        const latest = (base + extra + v9 + v10).replace('photographers(name,city)', 'photographers(name,city,coords)');
        const v12 = ',package_details,photos_promised,photos_delivered_at,shoot_city,shoot_coords';
        const v13 = ',gift_cents,split_count,split_deadline';
        const v14 = ',deal_pct';
        for (const cols of [latest + v12 + v13 + v14, latest + v12 + v13, latest + v12, latest + ',package_details', latest, base + extra + v9, base + extra, base]) {
          const res = await q(cols);
          if (!(res.error && COLUMN_ERRORS.includes(res.error.code))) return res;
        }
        return q(base);
      },
      get: async (id) => {
        const base = 'id,photographer_id,package_name,shoot_date,total_cents,status,photographers(name,city)';
        const q = (cols) => run(d => d.from('bookings').select(cols).eq('id', id).maybeSingle());
        for (const cols of [base + ',booking_type,gift_cents,split_count,split_deadline,client_user_id', base + ',booking_type']) {
          const res = await q(cols);
          if (!(res.error && COLUMN_ERRORS.includes(res.error.code))) return res;
        }
        return q(base);
      },
      action: (booking_id, action, extra = {}) => fn('booking-action', { ...extra, booking_id, action })
    }
  };

  /* Signed in: keep the account's language the same as the one shown here (once per account and language).
     A language chosen on this site counts; so does the browser's language, unless that is English (then the
     account keeps whatever was chosen in the app). */
  if (db) {
    const syncLang = async (session) => {
      const lang = window.CG_LANG, uid = session && session.user && session.user.id;
      if (!uid || !lang) return;
      let chosen = null, saved = null;
      try { chosen = localStorage.getItem('cg_lang'); saved = localStorage.getItem('cg_lang_saved'); } catch {}
      if (!chosen && lang === 'en') return;
      if (saved === `${uid}:${lang}`) return;
      const res = await run(d => d.rpc('set_my_language', { p_lang: lang }));
      if (!res.error) { try { localStorage.setItem('cg_lang_saved', `${uid}:${lang}`); } catch {} }
    };
    try { db.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') setTimeout(() => syncLang(session), 0); }); } catch {}
  }
})();
