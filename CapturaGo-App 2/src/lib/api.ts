// Data layer — the same requests the website makes (supabase.js), so the backend's
// security rules and tests cover the app too. Every call returns { data, error } and never throws.
import { supabase } from './supabase';
import { SITE_URL, SUPABASE_URL } from './config';
import type { Booking, Listing } from './logic';
import type { ChatMessage, Conversation } from './chat-logic';
import { base64ToBytes } from './listing-logic';
import { forecastUrl, parseForecast, type FreeCreator, type Forecast, type GalleryShare } from './plan-logic';
import type { ReplyTemplate } from './reply-logic';
import type { CalendarSync } from './trip-logic';
import type { BookingShare, GiftCard } from './gift-logic';
import type { WatchRow } from './watch-logic';
import type { MyTax } from './tax-logic';
import type { NearRequest, ShootRequest } from './request-logic';

export interface ApiError { message: string; status?: number; code?: string }
export interface Result<T> { data: T | null; error: ApiError | null }

async function run<T>(make: () => PromiseLike<{ data?: unknown; error: unknown }>, timeoutMs = 20000): Promise<Result<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), timeoutMs); });
    const res = await Promise.race([Promise.resolve(make()), timeout]);
    const err = res.error as { message?: string; code?: string } | null;
    return { data: (res.data as T) ?? null, error: err ? { message: err.message || 'Request failed.', code: err.code } : null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'Unexpected error.' } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* Listing columns. "email" and Stripe IDs are private and never requested. */
const BASE_COLS = 'id,user_id,name,city,coords,languages,type,services,vibes,specialties,level,description,tags,local_spots,portfolio_url,cover_image_url,price,available,travel_available,rating,reviews_count,views_count,verified,featured,created_at,updated_at';
const V8_COLS = BASE_COLS + ',packages,payouts_enabled,boosted_until,occasions,drone_certified,drone_region';
const V9_COLS = V8_COLS + ',gallery,handle,unavailable_dates,max_per_day,instant_book';
const V10_COLS = V9_COLS + ',founding_city,founding_at';
const V11_COLS = V10_COLS + ',reply_minutes,reply_samples';
const V12_COLS = V11_COLS + ',sample_gallery,sample_title,intro_video_url,completed_shoots';
const LISTING_COLS = V12_COLS + ',trips';
const COLUMN_ERRORS = ['42703', '42501', 'PGRST204'];
/** Newest columns first; falls back step by step while the database update hasn't been run yet. */
async function withCols<T>(make: (cols: string) => PromiseLike<{ data: unknown; error: unknown }>, timeoutMs?: number): Promise<Result<T>> {
  let res: Result<T> = { data: null, error: null };
  for (const cols of [LISTING_COLS, V12_COLS, V11_COLS, V10_COLS, V9_COLS, V8_COLS, BASE_COLS]) {
    res = await run<T>(() => make(cols), timeoutMs);
    if (!(res.error?.code && COLUMN_ERRORS.includes(res.error.code))) return res;
  }
  return res;
}
const PHOTO_COLS = 'id,booking_id,path,width,height,favorite,created_at';
const randomName = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
async function uploadBytes(bucket: string, path: string, base64: string, maxBytes: number): Promise<ApiError | null> {
  const bytes = base64ToBytes(base64);
  if (!bytes.length) return { message: 'Could not read that photo.' };
  if (bytes.length > maxBytes) return { message: `That photo is over ${Math.round(maxBytes / 1048576)} MB.` };
  const up = await run(() => supabase.storage.from(bucket).upload(path, bytes, { contentType: 'image/jpeg', upsert: false }), 90000);
  return up.error;
}

/* Server functions: errors carry the server's own message and HTTP status. */
async function fn<T>(name: string, body: Record<string, unknown>): Promise<Result<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      let message = error.message || 'Request failed.';
      let status = 0;
      try {
        const ctx = (error as { context?: Response }).context;
        status = ctx?.status ?? 0;
        const payload = ctx ? await ctx.json() : null;
        if (payload?.error) message = payload.error;
      } catch { /* not JSON */ }
      return { data: null, error: { message, status } };
    }
    return { data: data as T, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'Network error.' } };
  }
}

export interface Review { id: string; photographer_id: string; user_id: string | null; reviewer_name: string; rating: number; comment: string | null; created_at: string; booking_id?: string | null; photos?: string[] | null; reply?: string | null; reply_at?: string | null }
export interface FoundingCity { city_key: string; city_label: string; slots: number; spots_left: number; perk_days: number }
export interface FoundingStatus {
  listing: boolean; claimed?: boolean; revoked?: boolean; used?: boolean; founding_city?: string | null; boost_until?: string | null;
  open?: boolean; city?: string; slots?: number; spots_left?: number; perk_days?: number; missing?: string[];
}
export interface CityAlert { id: string; city_label: string; service: string | null; created_at: string; notified_at: string | null }
export interface SharedGallery { title: string; date: string; creator: { name: string; city: string; link: string }; expires_at: string; favorites_only: boolean; photos: { full: string; thumb: string; w: number | null; h: number | null }[] }
const forecastCache = new Map<string, { at: number; v: Forecast | null }>();
export interface BookingPhoto { id: string; booking_id: string; path: string; width: number | null; height: number | null; favorite: boolean; created_at: string; extra?: boolean; unlocked_at?: string | null }
export interface Inquiry { id: string; photographer_id: string; sender_name: string; sender_email: string; shoot_type: string | null; shoot_date: string | null; message: string; read: boolean; created_at: string }

export interface Deal { photographer_id: string; day: string; pct: number }
export interface MyDealDay { day: string; pct: number | null; free: boolean; notified: boolean }
export interface MyPhone { phone: string; channel: 'sms' | 'whatsapp'; reminders: boolean; verified: boolean; pending: boolean }

export const api = {
  auth: {
    signIn: (email: string, password: string) => run(() => supabase.auth.signInWithPassword({ email, password })),
    signUp: (email: string, password: string, fullName: string) => run<{ session: unknown; user: unknown }>(() => supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName }, emailRedirectTo: SITE_URL + '/' },
    })),
    resetPassword: (email: string) => run(() => supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL + '/reset-password.html' })),
    signOut: () => run(() => supabase.auth.signOut()),
  },
  listings: {
    all: (city?: string) => withCols<Listing[]>((cols) => {
      let q = supabase.from('photographers').select(cols).order('featured', { ascending: false }).order('created_at', { ascending: false });
      if (city) q = q.ilike('city', `%${city}%`);
      return q;
    }, 8000),
    byId: (id: string) => withCols<Listing>((cols) => supabase.from('photographers').select(cols).eq('id', id).maybeSingle()),
    mine: (uid: string) => withCols<Listing>((cols) => supabase.from('photographers').select(cols).eq('user_id', uid).maybeSingle()),
    setAvailable: (id: string, available: boolean) => withCols<Listing>((cols) => supabase.from('photographers').update({ available }).eq('id', id).select(cols).single()),
    incrementViews: (id: string) => run(() => supabase.rpc('increment_views', { photographer_id: id })),
    byHandle: (handle: string) => withCols<Listing>((cols) => supabase.from('photographers').select(cols).eq('handle', handle.toLowerCase()).maybeSingle()),
    /** Days the creator can't be booked (days off + fully booked days). */
    busyDates: async (pid: string): Promise<string[]> => {
      const r = await run<(string | { creator_busy_dates: string })[]>(() => supabase.rpc('creator_busy_dates', { p_photographer_id: pid }));
      return (r.data ?? []).map((x) => (typeof x === 'string' ? x : x.creator_busy_dates)).filter(Boolean);
    },
    update: (id: string, payload: Record<string, unknown>) => withCols<Listing>((cols) => supabase.from('photographers').update(payload).eq('id', id).select(cols).single()),
  },
  reviews: {
    list: async (pid: string) => {
      const q = (cols: string) => run<Review[]>(() => supabase.from('reviews').select(cols).eq('photographer_id', pid).order('created_at', { ascending: false }));
      const cols = 'id,photographer_id,user_id,reviewer_name,rating,comment,created_at';
      let res = await q(cols + ',booking_id,photos,reply,reply_at');
      for (const c of [cols + ',booking_id,photos', cols + ',booking_id', cols]) {
        if (!(res.error?.code && COLUMN_ERRORS.includes(res.error.code))) break;
        res = await q(c);
      }
      return res;
    },
    /** The creator's public reply to a review of their own listing ('' removes it). */
    reply: (id: string, text: string) => run<{ reply: string | null; reply_at: string | null }>(() => supabase.rpc('reply_to_review', { p_review: id, p_text: text.slice(0, 1200) })),
    /** Only travellers with a completed booking can review (database rule); one review per booking. Up to 3 public photo URLs. */
    add: async (p: { photographer_id: string; user_id: string; booking_id: string; reviewer_name: string; rating: number; comment: string | null; photos?: string[] }) => {
      const { photos, ...rest } = p;
      const first = await run(() => supabase.from('reviews').insert([photos?.length ? { ...rest, photos } : rest]));
      // database update not run yet → publish the text review without photos
      if (photos?.length && first.error?.code && COLUMN_ERRORS.includes(first.error.code)) return { ...(await run(() => supabase.from('reviews').insert([rest]))), photosDropped: true };
      return { ...first, photosDropped: false };
    },
    myBookingIds: async (uid: string): Promise<string[]> => {
      const r = await run<{ booking_id: string }[]>(() => supabase.from('reviews').select('booking_id').eq('user_id', uid).not('booking_id', 'is', null));
      return (r.data ?? []).map((x) => x.booking_id);
    },
  },
  inquiries: {
    send: (p: { photographer_id: string; sender_name: string; sender_email: string; shoot_type: string | null; shoot_date: string | null; message: string }) =>
      run(() => supabase.from('inquiries').insert([p])),
    forListing: (pid: string) => run<Inquiry[]>(() => supabase.from('inquiries').select('*').eq('photographer_id', pid).order('created_at', { ascending: false })),
    markRead: (id: string) => run(() => supabase.from('inquiries').update({ read: true }).eq('id', id)),
  },
  favorites: {
    ids: async (uid: string): Promise<string[]> => {
      const { data } = await run<{ photographer_id: string }[]>(() => supabase.from('favorites').select('photographer_id').eq('user_id', uid));
      return (data ?? []).map((r) => r.photographer_id);
    },
    toggle: async (uid: string, pid: string): Promise<{ added: boolean; error: ApiError | null }> => {
      const found = await run<{ id: string }>(() => supabase.from('favorites').select('id').eq('user_id', uid).eq('photographer_id', pid).maybeSingle());
      if (found.error) return { added: false, error: found.error };
      if (found.data) {
        const del = await run(() => supabase.from('favorites').delete().eq('id', found.data!.id));
        return { added: false, error: del.error };
      }
      const ins = await run(() => supabase.from('favorites').insert([{ user_id: uid, photographer_id: pid }]));
      return { added: !ins.error, error: ins.error };
    },
  },
  bookings: {
    list: async () => {
      const base = 'id,photographer_id,creator_user_id,client_user_id,client_name,client_email,package_name,package_minutes,shoot_date,note,currency,price_cents,client_fee_cents,creator_fee_cents,total_cents,status,created_at,photographers(name,city)';
      const extra = ',booking_type,client_files_url,delivery_url,delivered_at,revisions_allowed,revisions_used,last_revision_note';
      const v9 = ',time_slot,via_link,photos_ready_at,completed_at';
      const v10 = ',proposed_date,proposed_slot,proposed_by,proposed_reason,proposed_at,reschedules,dispute_reason,shot_list,ref_links,meeting_point,meeting_time,surprise';
      const q = (cols: string) => run<Booking[]>(() => supabase.from('bookings').select(cols).order('created_at', { ascending: false }));
      const latest = (base + extra + v9 + v10).replace('photographers(name,city)', 'photographers(name,city,coords)');
      const v12 = ',package_details,photos_promised,photos_delivered_at,shoot_city,shoot_coords';
      let res = await q(latest + v12 + ',gift_cents,split_count,split_deadline,deal_pct,extra_photo_cents');
      for (const cols of [latest + v12 + ',gift_cents,split_count,split_deadline,deal_pct', latest + v12 + ',gift_cents,split_count,split_deadline', latest + v12, latest + ',package_details', latest, base + extra + v9, base + extra, base]) {
        if (!(res.error?.code && COLUMN_ERRORS.includes(res.error.code))) break;
        res = await q(cols);
      }
      return res;
    },
    action: (booking_id: string, action: string, extra: Record<string, unknown> = {}) =>
      fn<{ booking: Booking; refunded?: boolean }>('booking-action', { ...extra, booking_id, action }),
  },
  listing: {
    /** Create (no id) or update the signed-in creator's listing. */
    save: (id: string | null, payload: Record<string, unknown>, uid: string) => withCols<Listing>((cols) => (id
      ? supabase.from('photographers').update(payload).eq('id', id).select(cols).single()
      : supabase.from('photographers').insert([{ ...payload, user_id: uid }]).select(cols).single())),
    remove: (id: string) => run(() => supabase.from('photographers').delete().eq('id', id)),
    myEmail: async (): Promise<string | null> => { const r = await run<string>(() => supabase.rpc('my_listing_email')); return r.error ? null : r.data; },
    myDrone: async (): Promise<{ region: string | null; info: Record<string, string | null> | null } | null> => {
      const r = await run<{ region: string | null; info: Record<string, string | null> | null }>(() => supabase.rpc('my_drone_info'));
      return r.error ? null : r.data;
    },
    /** Upload a JPEG (as base64) into the creator's own folder; returns its public URL. */
    uploadCover: async (base64: string, uid: string): Promise<{ url: string | null; error: ApiError | null }> => {
      const bytes = base64ToBytes(base64);
      if (!bytes.length) return { url: null, error: { message: 'Could not read that photo.' } };
      if (bytes.length > 5 * 1024 * 1024) return { url: null, error: { message: 'That photo is over 5 MB.' } };
      const path = `${uid}/${Date.now()}.jpg`;
      const up = await run(() => supabase.storage.from('photographer-covers').upload(path, bytes, { contentType: 'image/jpeg', upsert: false }), 60000);
      if (up.error) return { url: null, error: up.error };
      return { url: supabase.storage.from('photographer-covers').getPublicUrl(path).data.publicUrl, error: null };
    },
    /** Portfolio photo (already resized JPEG, base64) into the creator's own public folder. */
    uploadPublic: async (base64: string, uid: string, prefix: 'g' | 'gt' | 'r' | 's' | 'st'): Promise<{ url: string | null; error: ApiError | null }> => {
      const path = `${uid}/${prefix}-${randomName()}`;
      const err = await uploadBytes('photographer-covers', path, base64, 5 * 1024 * 1024);
      if (err) return { url: null, error: err };
      return { url: supabase.storage.from('photographer-covers').getPublicUrl(path).data.publicUrl, error: null };
    },
    /** Remove the creator's own public files (old gallery photos). Best effort. */
    removePublic: async (urls: string[], uid: string) => {
      const marker = '/photographer-covers/';
      const paths = urls.map((u) => { const i = u.indexOf(marker); return i < 0 ? '' : decodeURIComponent(u.slice(i + marker.length).split('?')[0]); })
        .filter((x) => x.startsWith(`${uid}/`));
      if (paths.length) await run(() => supabase.storage.from('photographer-covers').remove(paths));
    },
    /** City → map position (same OpenStreetMap service as the website). */
    geocode: async (city: string): Promise<{ lat: number; lon: number } | null> => {
      if (!city || city.trim().length < 2) return null;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city.trim())}`, { headers: { 'Accept-Language': 'en' } });
        if (!r.ok) return null;
        const j = (await r.json()) as { lat: string; lon: string }[];
        return j?.length ? { lat: parseFloat(j[0].lat), lon: parseFloat(j[0].lon) } : null;
      } catch { return null; }
    },
  },
  chat: {
    list: () => run<Conversation[]>(() => supabase.from('conversations')
      .select('id,photographer_id,client_user_id,creator_user_id,client_name,last_message_at,last_message,last_sender_id,client_read_at,creator_read_at,blocked_by,created_at,photographers(name,city,cover_image_url)')
      .order('last_message_at', { ascending: false }).limit(200)),
    get: (id: string) => run<Conversation>(() => supabase.from('conversations')
      .select('id,photographer_id,client_user_id,creator_user_id,client_name,last_message_at,last_message,last_sender_id,client_read_at,creator_read_at,blocked_by,created_at,photographers(name,city,cover_image_url)')
      .eq('id', id).maybeSingle()),
    /** Latest 300 messages, oldest first. With `after`, only newer ones. */
    messages: async (id: string, after?: string) => {
      const r = await run<ChatMessage[]>(() => {
        let q = supabase.from('messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', id);
        if (after) q = q.gt('created_at', after);
        return q.order('created_at', { ascending: false }).limit(300);
      });
      return { data: r.data ? [...r.data].reverse() : null, error: r.error };
    },
    send: async (id: string, body: string) => {
      const r = await run<ChatMessage>(() => supabase.from('messages').insert([{ conversation_id: id, body }]).select('id,conversation_id,sender_id,body,created_at').single());
      // "New message from …" on the other person's phone; never waits, never fails the send (the server decides)
      if (!r.error) fn<{ sent: boolean }>('push', { conversation_id: id }).catch(() => {});
      return r;
    },
    start: (photographerId: string) => run<string>(() => supabase.rpc('start_conversation', { p_photographer_id: photographerId })),
    forBooking: (bookingId: string) => run<string>(() => supabase.rpc('booking_conversation', { p_booking_id: bookingId })),
    markRead: (id: string) => run(() => supabase.rpc('mark_conversation_read', { p_conversation_id: id })),
    block: (id: string, blocked: boolean) => run(() => supabase.rpc('set_conversation_blocked', { p_conversation_id: id, p_blocked: blocked })),
    report: (id: string, reason: string) => run(() => supabase.rpc('report_conversation', { p_conversation_id: id, p_reason: reason })),
    translate: (messageId: string, lang: string) => fn<{ text: string; lang: string }>('translate', { message_id: messageId, lang }),
  },
  /* Private photo delivery: bucket "deliveries", <booking id>/<file> plus a small preview t_<file> */
  photos: {
    list: async (bookingId: string) => {
      const q = (cols: string) => run<BookingPhoto[]>(() => supabase.from('booking_photos').select(cols).eq('booking_id', bookingId).order('created_at', { ascending: true }).limit(300));
      const res = await q(PHOTO_COLS + ',extra,unlocked_at');   // extra photos for sale (website v8.18 database)
      return res.error?.code && COLUMN_ERRORS.includes(res.error.code) ? q(PHOTO_COLS) : res;
    },
    /** Creator: photos for sale (extra) or included, and the price per photo in cents (null = stop selling). */
    setExtras: (bookingId: string, ids: string[], extra: boolean, priceCents: number | null) =>
      run<{ price_cents: number | null; extra: number; included: number; promised: number }>(() => supabase.rpc('set_photo_extras', { p_booking: bookingId, p_ids: ids, p_extra: extra, p_price_cents: priceCents })),
    /** Traveller: buy extra photos (ids or 'all') → the secure payment page. */
    buy: (bookingId: string, ids: string[] | 'all') => fn<{ url: string; order_id: string; count: number; total_cents: number }>('buy-photos', { booking_id: bookingId, photo_ids: ids, from: 'app' }),
    counts: async (bookingIds: string[]): Promise<Record<string, number>> => {
      if (!bookingIds.length) return {};
      const r = await run<{ booking_id: string }[]>(() => supabase.from('booking_photos').select('booking_id').in('booking_id', bookingIds).limit(5000));
      const out: Record<string, number> = {};
      (r.data ?? []).forEach((x) => { out[x.booking_id] = (out[x.booking_id] ?? 0) + 1; });
      return out;
    },
    /** Temporary links (default 3 hours) — the bucket is private. */
    signedUrls: async (paths: string[], seconds = 10800): Promise<Record<string, string>> => {
      if (!paths.length) return {};
      const r = await run<{ path: string | null; signedUrl: string; error: string | null }[]>(() => supabase.storage.from('deliveries').createSignedUrls(paths, seconds));
      const out: Record<string, string> = {};
      (r.data ?? []).forEach((x) => { if (x.path && x.signedUrl && !x.error) out[x.path] = x.signedUrl; });
      return out;
    },
    /** full: JPEG ≤ 3000 px, thumb: JPEG ≤ 600 px (both base64). Storage first, then the database row. */
    upload: async (bookingId: string, full: string, thumb: string | null, size: { w: number; h: number }): Promise<Result<BookingPhoto>> => {
      const name = randomName();
      const path = `${bookingId}/${name}`;
      const err = await uploadBytes('deliveries', path, full, 15 * 1024 * 1024);
      if (err) return { data: null, error: err };
      if (thumb) await uploadBytes('deliveries', `${bookingId}/t_${name}`, thumb, 15 * 1024 * 1024);
      const row = await run<BookingPhoto>(() => supabase.from('booking_photos').insert([{ booking_id: bookingId, path, width: size.w || null, height: size.h || null }]).select(PHOTO_COLS).single());
      if (row.error) await run(() => supabase.storage.from('deliveries').remove([path, `${bookingId}/t_${name}`]));
      return row;
    },
    remove: async (photo: BookingPhoto): Promise<ApiError | null> => {
      const r = await run<{ id: string }[]>(() => supabase.from('booking_photos').delete().eq('id', photo.id).select('id'));
      if (r.error || !(r.data ?? []).length) return r.error ?? { message: 'This photo can no longer be removed.' };
      const [dir, file] = photo.path.split('/');
      await run(() => supabase.storage.from('deliveries').remove([photo.path, `${dir}/t_${file}`]));
      return null;
    },
    favorite: (id: string, on: boolean) => run(() => supabase.from('booking_photos').update({ favorite: on }).eq('id', id)),
  },
  ai: { match: (query: string) => fn<{ matches: { id: string; reason: string }[]; note?: string }>('ai-match', { query }) },
  pay: {
    checkout: (p: Record<string, unknown>) => fn<{ url: string; booking_id: string; paid?: boolean; split?: number; share_cents?: number; gift_cents?: number }>('create-checkout', { ...p, from: 'app' }),
    connect: (action: 'status' | 'onboard' | 'dashboard', country?: string) =>
      fn<{ url?: string; connected?: boolean; ready?: boolean; due?: number }>('stripe-connect', { action, country, from: 'app' }),
  },
  account: { remove: () => fn<{ deleted: boolean }>('delete-account', { confirm: 'DELETE' }) },

  /* ── v8.7 ── */
  /** Report a profile or one of its photos (reviewed by the CapturaGo team; signed-in users only). */
  reportListing: (photographerId: string, reason: string, details: string, photoUrl: string | null) => run(() => supabase.rpc('report_listing', {
    p_photographer_id: photographerId, p_reason: reason, p_details: details.trim() || null, p_photo_url: photoUrl || null })),
  /** Anonymous search insights — no names, emails or IP addresses. Never blocks or fails a screen. */
  logEvent: (kind: 'search' | 'profile_view' | 'book_start' | 'trip_search', city?: string | null, service?: string | null, results?: number | null) => {
    try {
      Promise.resolve(supabase.rpc('log_search_event', { p_kind: kind, p_city: city || null, p_service: service || null, p_results: Number.isInteger(results) ? results : null }))
        .then(() => {}, () => {});
    } catch { /* never mind */ }
  },
  /** "Notify me when a creator joins <city>" */
  alerts: {
    create: (city: string, service?: string | null) => run(() => supabase.rpc('create_city_alert', { p_city: city, p_service: service || null })),
    mine: () => run<CityAlert[]>(() => supabase.from('city_alerts').select('id,city_label,service,created_at,notified_at').order('created_at', { ascending: false })),
    remove: (id: string) => run(() => supabase.from('city_alerts').delete().eq('id', id)),
  },
  /** Quick replies: my own saved messages (private; up to 20 — checked by the database). */
  templates: {
    list: () => run<ReplyTemplate[]>(() => supabase.from('reply_templates').select('id,title,body,updated_at').order('created_at', { ascending: true })),
    add: (title: string, body: string) => run<ReplyTemplate>(() => supabase.from('reply_templates').insert([{ title, body }]).select('id,title,body,updated_at').single()),
    update: (id: string, title: string, body: string) => run<ReplyTemplate>(() => supabase.from('reply_templates').update({ title, body }).eq('id', id).select('id,title,body,updated_at').single()),
    remove: (id: string) => run(() => supabase.from('reply_templates').delete().eq('id', id)),
  },
  /** Tips & reminders emails (review reminder, "a year ago"): on by default. */
  /** Calendar sync: a private feed of my bookings for my calendar app, and busy days read from my own calendar */
  calendar: {
    feedToken: (reset = false) => run<string>(() => supabase.rpc('my_calendar_feed', { p_reset: reset })),
    feedUrl: (token: string) => `${SUPABASE_URL}/functions/v1/calendar?t=${encodeURIComponent(token)}`,
    status: () => run<CalendarSync>(() => supabase.rpc('my_calendar_sync')),
    connect: (url: string) => run<string>(() => supabase.rpc('set_calendar_import', { p_url: url.trim() })),
    disconnect: () => run(() => supabase.rpc('remove_calendar_import')),
    syncNow: () => fn<{ busy_count?: number; last_error?: string | null }>('calendar', { action: 'sync' }),
  },
  /** Gift cards: check a code before booking; the cards I bought (buying happens on the website). */
  gifts: {
    check: (code: string) => run<{ ok: boolean; error?: string; balance_cents?: number; expires_at?: string }>(() => supabase.rpc('check_gift', { p_code: code.slice(0, 40) })),
    mine: () => run<GiftCard[]>(() => supabase.rpc('my_gift_cards')),
  },
  /** Last-minute deals: the live ones (public) and mine — a lower price tomorrow or the day after. */
  deals: {
    active: () => run<Deal[]>(() => supabase.rpc('active_deals')),
    mine: () => run<MyDealDay[]>(() => supabase.rpc('my_last_minute')),
    set: (day: string, pct: number) => run<MyDealDay[]>(() => supabase.rpc('set_last_minute', { p_day: day, p_pct: Math.round(pct) })),
    remove: (day: string) => run<MyDealDay[]>(() => supabase.rpc('remove_last_minute', { p_day: day })),
  },
  /** "Notify me" on a fully booked creator: an email (or a text) when a day frees up or a deal appears. */
  watches: {
    add: (photographerId: string, byText: boolean) => run<{ watching: boolean; by_text: boolean; free_days: number }>(() => supabase.rpc('watch_creator', { p_photographer: photographerId, p_text: byText })),
    remove: (photographerId: string) => run<boolean>(() => supabase.rpc('unwatch_creator', { p_photographer: photographerId })),
    mine: () => run<WatchRow[]>(() => supabase.rpc('my_creator_watches')),
  },
  /** Push notifications on this phone (booking news, "Notify me" alerts, new messages). */
  push: {
    register: (token: string, platform: string) => run<boolean>(() => supabase.rpc('register_push_token', { p_token: token, p_platform: platform })),
    unregister: (token: string) => run<boolean>(() => supabase.rpc('unregister_push_token', { p_token: token })),
  },
  /** EU DAC7: the tax details a platform must collect from the people it pays (checked again by the database). */
  tax: {
    mine: () => run<MyTax | null>(() => supabase.rpc('my_tax_info')),
    save: (p: Record<string, unknown>) => run<MyTax>(() => supabase.rpc('save_tax_info', { p })),
  },
  /** Text reminders on the shoot day: my number (confirmed with a code by SMS), SMS or WhatsApp. */
  phone: {
    mine: () => run<MyPhone | null>(() => supabase.rpc('my_phone')),
    start: (phone: string, channel: 'sms' | 'whatsapp') => fn<{ sent: boolean; phone: string }>('phone', { action: 'start', phone, channel, consent: true }),
    verify: (code: string) => fn<{ verified: boolean }>('phone', { action: 'verify', code }),
    prefs: (reminders: boolean | null, channel: 'sms' | 'whatsapp' | null) => run<MyPhone>(() => supabase.rpc('set_phone_prefs', { p_reminders: reminders, p_channel: channel })),
    remove: () => run<boolean>(() => supabase.rpc('remove_my_phone')),
  },
  /** Invite a creator: my invite code (made on first use) and how my invites are going. */
  invites: {
    mine: () => run<{ code: string; joined: number; rewarded: number; max: number; days: number; invited_by: string | null; my_reward: boolean }>(() => supabase.rpc('my_invite')),
  },
  /** Shoot requests: a traveller describes the shoot, creators send offers (every rule is checked by the database). */
  requests: {
    create: (r: { city: string; from: string; to: string; service: string; people: number; budget: number | null; note: string }) =>
      run<string>(() => supabase.rpc('create_shoot_request', { p_city: r.city, p_from: r.from, p_to: r.to, p_service: r.service, p_people: r.people, p_budget: r.budget, p_note: r.note })),
    mine: () => run<ShootRequest[]>(() => supabase.rpc('my_shoot_requests')),
    close: (id: string) => run<boolean>(() => supabase.rpc('close_shoot_request', { p_id: id })),
    decline: (offerId: string) => run<boolean>(() => supabase.rpc('decline_offer', { p_offer: offerId })),
    forMe: () => run<NearRequest[]>(() => supabase.rpc('requests_for_me')),
    offer: (o: { request: string; price: number; date: string; minutes: number; photos: number | null; edit_days: number | null; message: string }) =>
      run<string>(() => supabase.rpc('make_offer', { p_request: o.request, p_price: o.price, p_date: o.date, p_minutes: o.minutes, p_photos: o.photos, p_edit_days: o.edit_days, p_message: o.message })),
    withdraw: (offerId: string) => run<boolean>(() => supabase.rpc('withdraw_offer', { p_offer: offerId })),
  },
  /** Split the cost: the organiser's shares with the friends' payment links (while open). */
  split: {
    mine: (bookingId: string) => run<BookingShare[]>(() => supabase.rpc('my_booking_shares', { p_booking: bookingId })),
  },
  emailPrefs: {
    mine: () => run<{ tips: boolean }>(() => supabase.rpc('my_email_prefs')),
    setTips: (on: boolean) => run<boolean>(() => supabase.rpc('set_email_tips', { p_on: on })),
  },
  /** Founding creators: open cities (public), my status, claim a spot (every rule is checked by the database). */
  founding: {
    cities: () => run<FoundingCity[]>(() => supabase.rpc('founding_cities_public')),
    status: () => run<FoundingStatus>(() => supabase.rpc('founding_status')),
    claim: () => run<FoundingStatus>(() => supabase.rpc('claim_founding_spot')),
  },
  /** Trip planner: who is free in <city> between two dates (in-person sessions only). */
  availableCreators: (city: string, from: string, to: string) =>
    run<FreeCreator[]>(() => supabase.rpc('available_creators', { p_city: city || null, p_from: from, p_to: to })),
  /** View-only links to a delivered gallery, for friends and family. They expire. */
  shares: {
    create: (bookingId: string, days: number, favoritesOnly: boolean) => run<string>(() => supabase.rpc('create_gallery_share', { p_booking_id: bookingId, p_days: days, p_favorites_only: favoritesOnly })),
    list: (bookingId: string) => run<GalleryShare[]>(() => supabase.from('gallery_shares').select('token,expires_at,favorites_only,views,created_at').eq('booking_id', bookingId).order('created_at', { ascending: false })),
    remove: (token: string) => run(() => supabase.from('gallery_shares').delete().eq('token', token)),
    open: (token: string) => fn<SharedGallery>('shared-gallery', { token }),
  },
  /** Forecast for a shoot day (Open-Meteo: free, no account; receives only the city's coordinates). Cached 3 hours. */
  forecast: async (coords: { lat: number; lon: number } | null | undefined, iso: string): Promise<Forecast | null> => {
    const url = forecastUrl(coords, iso);
    if (!url) return null;
    const hit = forecastCache.get(url);
    if (hit && Date.now() - hit.at < 3 * 3600000) return hit.v;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
      const v = r.ok ? parseForecast(await r.json()) : null;
      if (r.ok) forecastCache.set(url, { at: Date.now(), v });
      return v;
    } catch { return null; }
  },
};
