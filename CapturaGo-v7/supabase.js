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
  const PAYMENT_COLS = BASE_COLS + ',packages,payouts_enabled,boosted_until';
  const LISTING_COLS = PAYMENT_COLS + ',occasions,drone_certified';
  /* If payments-patch.sql or categories-patch.sql hasn't been run yet, the newer
     columns don't exist (or aren't readable). Retry with fewer columns so the site
     keeps working. */
  const COLUMN_ERRORS = ['42703', '42501', 'PGRST204'];
  const COL_TIERS = [LISTING_COLS, PAYMENT_COLS, BASE_COLS];
  async function withCols(make) {
    let res;
    for (const cols of COL_TIERS) {
      res = await run(d => make(d, cols));
      if (!res.error || !COLUMN_ERRORS.includes(res.error.code)) return res;
    }
    return res;
  }
  /* Writes: if the categories columns aren't in the database yet, save
     everything else and report which fields were skipped. */
  const CATEGORY_FIELDS = ['occasions', 'drone_certified'];
  async function writeListing(make, payload) {
    const res = await withCols((d, cols) => make(d, payload, cols));
    const has = CATEGORY_FIELDS.filter(k => k in payload);
    if (!res.error || !has.length || !COLUMN_ERRORS.includes(res.error.code)) return res;
    const rest = { ...payload };
    has.forEach(k => delete rest[k]);
    const retry = await withCols((d, cols) => make(d, rest, cols));
    if (!retry.error) retry.skipped = has;
    return retry;
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
      myEmail: async () => {
        const { data, error } = await run(d => d.rpc('my_listing_email'));
        return error ? null : (data || null);
      },
      insert: (payload) => writeListing((d, pl, cols) => d.from('photographers').insert([pl]).select(cols).single(), payload),
      update: (id, payload) => writeListing((d, pl, cols) => d.from('photographers').update(pl).eq('id', id).select(cols).single(), payload),
      remove: (id) => run(d => d.from('photographers').delete().eq('id', id))
    },

    storage: {
      MAX_UPLOAD_BYTES, ALLOWED_TYPES,
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
      get: (pid) => run(d => d.from('reviews').select(REVIEW_COLS).eq('photographer_id', pid).order('created_at', { ascending: false })),
      add: (p) => run(d => d.from('reviews').insert([p]))
    },

    incrementViews: (pid) => run(d => d.rpc('increment_views', { photographer_id: pid })),

    ai: {
      match: (query) => fn('ai-match', { query })
    },

    pay: {
      connect: (action, country) => fn('stripe-connect', { action, country }),
      checkout: (p) => fn('create-checkout', p),
      boost: (plan) => fn('create-boost', { plan })
    },

    bookings: {
      list: () => run(d => d.from('bookings')
        .select('id,photographer_id,creator_user_id,client_user_id,client_name,client_email,package_name,package_minutes,shoot_date,note,currency,price_cents,client_fee_cents,creator_fee_cents,total_cents,status,created_at,photographers(name,city)')
        .order('created_at', { ascending: false })),
      get: (id) => run(d => d.from('bookings')
        .select('id,photographer_id,package_name,shoot_date,total_cents,status,photographers(name,city)')
        .eq('id', id).maybeSingle()),
      action: (booking_id, action) => fn('booking-action', { booking_id, action })
    }
  };
})();
