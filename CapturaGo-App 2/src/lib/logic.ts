// Pure business logic — no React Native imports, so it is unit-tested directly
// (tests/logic.test.ts). Mirrors the website's rules exactly.
import { services, vibes, occasions, type Service } from './taxonomy-data';
import { holdState, photosPromised } from './trip-logic';
import { CLIENT_FEE_PCT, LINK_FEE_PCT } from './config';
import { replyRank } from './reply-logic';

export interface Trip { city: string; from: string; to: string; lat?: number; lon?: number }

export interface Package {
  id: string;
  name: string;
  price_eur: number;
  desc?: string;
  type?: 'session' | 'delivery';
  minutes?: number | null;
  delivery_days?: number;
  revisions?: number;
  photos?: number;
  edit_days?: number;
  includes?: string[];
}
export interface Spot { name: string; desc?: string }
export interface Listing {
  id: string;
  user_id?: string;
  name: string;
  city: string;
  coords?: { lat: number; lon: number } | null;
  type?: string | null;
  services?: string[];
  vibes?: string[];
  occasions?: string[];
  price?: string | null;
  level?: string | null;
  languages?: string | null;
  description?: string | null;
  tags?: string[];
  local_spots?: (Spot | string)[] | null;
  portfolio_url?: string | null;
  cover_image_url?: string | null;
  available?: boolean;
  travel_available?: boolean;
  rating?: number | null;
  reviews_count?: number | null;
  verified?: number | null;
  featured?: boolean;
  packages?: Package[] | null;
  payouts_enabled?: boolean;
  boosted_until?: string | null;
  drone_certified?: boolean;
  drone_region?: string | null;
  gallery?: GalleryItem[] | string | null;
  handle?: string | null;
  unavailable_dates?: string[] | null;
  max_per_day?: number | null;
  instant_book?: boolean | null;
  founding_city?: string | null;
  founding_at?: string | null;
  reply_minutes?: number | null;
  reply_samples?: number | null;
  sample_gallery?: GalleryItem[] | string | null;
  sample_title?: string | null;
  intro_video_url?: string | null;
  completed_shoots?: number | null;
  /** Trips: "I'm in Lisbon 3–10 Nov" (public; checked by the database) */
  trips?: Trip[] | null;
  created_at?: string;
  isExample?: boolean;
}
export interface GalleryItem { url: string; thumb?: string }
export type BookingStatus =
  | 'pending_payment' | 'paid' | 'confirmed' | 'delivered' | 'completed'
  | 'declined' | 'cancelled' | 'refunded' | 'expired' | 'disputed';
export interface Booking {
  id: string;
  photographer_id: string | null;
  creator_user_id: string | null;
  client_user_id: string | null;
  client_name: string;
  client_email: string;
  package_name: string;
  shoot_date: string;
  note?: string | null;
  price_cents: number;
  client_fee_cents: number;
  creator_fee_cents: number;
  total_cents: number;
  status: BookingStatus;
  created_at: string;
  booking_type?: 'session' | 'delivery';
  client_files_url?: string | null;
  delivery_url?: string | null;
  delivered_at?: string | null;
  revisions_allowed?: number;
  revisions_used?: number;
  last_revision_note?: string | null;
  time_slot?: string | null;
  via_link?: boolean | null;
  photos_ready_at?: string | null;
  completed_at?: string | null;
  /* v8.7: new date (both sides agree), problems, shoot plan */
  proposed_date?: string | null;
  proposed_slot?: string | null;
  proposed_by?: string | null;
  proposed_reason?: 'weather' | 'other' | null;
  proposed_at?: string | null;
  reschedules?: number | null;
  dispute_reason?: 'no_show' | 'quality' | 'other' | null;
  shot_list?: string[] | null;
  ref_links?: string[] | null;
  meeting_point?: string | null;
  meeting_time?: string | null;
  surprise?: boolean | null;
  package_details?: Partial<Package> | null;
  /** Set by the database: photos promised in the package → payment held until they're sent */
  photos_promised?: boolean | null;
  photos_delivered_at?: string | null;
  /** Set by the database: a shoot on one of the creator's trips (null = their home city) */
  shoot_city?: string | null;
  shoot_coords?: { lat: number; lon: number } | null;
  /* v8.12: part paid with a gift card; split between friends (each pays a share by the deadline) */
  gift_cents?: number | null;
  deal_pct?: number | null;
  split_count?: number | null;
  split_deadline?: string | null;
  photographers?: { name: string; city: string; coords?: { lat: number; lon: number } | null } | null;
}

/* ── categories ── */
const S = Object.fromEntries(services.map((s) => [s.id, s])) as Record<string, Service>;
export const serviceLabel = (id: string) => S[id]?.label ?? id;
export const serviceIcon = (id: string) => S[id]?.icon ?? '';
export const vibeLabel = (id: string) => vibes.find((v) => v.id === id)?.label ?? id;
export const occasionLabel = (id: string) => occasions.find((o) => o.id === id)?.label ?? id;
export const isRemoteService = (id: string) => S[id]?.group === 'remote';
export const hasRemote = (list?: string[]) => (list ?? []).some(isRemoteService);
export const PRICE_LABELS: Record<string, string> = { budget: 'Under €80', mid: '€80–€250', premium: '€250+' };
const DRONE_BADGES: Record<string, string> = { easa: 'EU-registered drone operator', faa: 'FAA Part 107 drone pilot' };
export const droneBadge = (region?: string | null) => DRONE_BADGES[region ?? ''] ?? 'Drone pilot';

/* ── small helpers ── */
export const firstName = (name?: string | null) => String(name ?? '').trim().split(/\s+/)[0] || 'the creator';
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export function httpsUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.length > 500) return null;
  try { const u = new URL(v); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
}
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const money = (eur: number) => `€${Number.isInteger(eur) ? eur : eur.toFixed(2)}`;
export const euroCents = (c: number) => `€${((c || 0) / 100).toFixed(2)}`;
export function spotsOf(l: Listing): Spot[] {
  return (Array.isArray(l.local_spots) ? l.local_spots : [])
    .map((s) => (typeof s === 'string' ? { name: s } : s))
    .filter((s): s is Spot => !!s && !!s.name);
}

/* ── packages & booking ── */
export function packagesOf(l?: Listing | null): Package[] {
  return (Array.isArray(l?.packages) ? l!.packages! : []).filter((k) =>
    k && k.id && Number(k.price_eur) >= 10 && Number(k.price_eur) <= 5000 &&
    (k.type !== 'delivery' || (Number(k.delivery_days) >= 1 && Number(k.delivery_days) <= 30)));
}
export function fromPrice(l: Listing): number | null {
  const ps = packagesOf(l).map((k) => Number(k.price_eur));
  return ps.length ? Math.min(...ps) : null;
}
export const isBoosted = (l: Listing, now = Date.now()) => !!(l.boosted_until && Date.parse(l.boosted_until) > now);
/** Same matching as the database: "Lisbon, Portugal" → "lisbon" */
export const cityKey = (city?: string | null) => String(city ?? '').split(',')[0].trim().toLowerCase().replace(/\s+/g, ' ');
/** 🏅 Founding creator — shown while the listing is still in the city where the spot was given */
export const isFounding = (l?: Listing | null) => !!(l && l.founding_at && l.founding_city && cityKey(l.city) === cityKey(l.founding_city));
export const canBook = (l?: Listing | null) => !!l && !l.isExample && !!l.payouts_enabled && packagesOf(l).length > 0;
export function pkgMeta(k: Package): string {
  if (k.type === 'delivery') {
    const d = Number(k.delivery_days) || 0, r = Number(k.revisions) || 0;
    return `Remote · delivered in ${plural(d, 'day')}${r ? ` · ${plural(r, 'revision')}` : ''}${k.desc ? ' · ' + k.desc : ''}`;
  }
  return [k.minutes ? `${k.minutes} min` : '', k.desc ?? ''].filter(Boolean).join(' · ');
}
/** Same rounding as the server: fee = round(price × pct) in cents. */
export function fees(priceEur: number, pct = CLIENT_FEE_PCT) {
  const priceCents = Math.round(priceEur * 100);
  const feeCents = Math.round((priceCents * pct) / 100);
  return { priceCents, feeCents, totalCents: priceCents + feeCents };
}

/** Booked through the creator's own link → the lower link fee (never above the normal fee). */
export const feePctFor = (viaLink: boolean) => (viaLink ? Math.min(LINK_FEE_PCT, CLIENT_FEE_PCT) : CLIENT_FEE_PCT);

/* ── portfolio gallery, time of day, booking link (same rules as the website) ── */
export const GALLERY_MAX = 30;
export function galleryOf(l?: Listing | null, key: 'gallery' | 'sample_gallery' = 'gallery'): GalleryItem[] {
  let g: unknown = l?.[key];
  if (typeof g === 'string') { try { g = JSON.parse(g); } catch { g = []; } }
  return (Array.isArray(g) ? g : [])
    .filter((x): x is GalleryItem => !!x && typeof (x as GalleryItem).url === 'string' && /^https:\/\//.test((x as GalleryItem).url))
    .map((x) => (x.thumb && /^https:\/\//.test(x.thumb) ? { url: x.url, thumb: x.thumb } : { url: x.url }));
}
export const TIME_SLOTS: [string, string][] = [
  ['sunrise', 'Sunrise'], ['morning', 'Morning'], ['midday', 'Midday'], ['afternoon', 'Afternoon'],
  ['golden_hour', 'Golden hour'], ['evening', 'Evening'], ['flexible', 'Flexible'],
];
export const slotLabel = (k?: string | null) => TIME_SLOTS.find(([id]) => id === k)?.[1] ?? '';
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const RESERVED_HANDLES = ['admin', 'api', 'app', 'dashboard', 'help', 'support', 'capturago', 'login', 'signup', 'settings', 'about', 'terms', 'privacy', 'www', 'blog', 'creators', 'search'];
/** Turns a name into a link-friendly suggestion: "Ana Kováč" → "ana-kovac". */
export const slugify = (v: string) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 30).replace(/-+$/, '');
/** Cleans what the creator types into the link field (lower case, dashes instead of spaces). */
export const cleanHandleInput = (v: string) => v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30);
export function handleProblem(h: string): string {
  if (!h) return '';
  if (!HANDLE_RE.test(h)) return '3–30 characters: lowercase letters, numbers and dashes (not at the start or end).';
  if (RESERVED_HANDLES.includes(h)) return 'That word is reserved — please choose another.';
  return '';
}
export const isHandleTaken = (e?: { message?: string; code?: string } | null) =>
  !!e && /handle/i.test(e.message ?? '') && (e.code === '23505' || /duplicate|unique/i.test(e.message ?? ''));

/* ── photo delivery ── */
export const PHOTO_STATUSES = ['confirmed', 'delivered', 'completed'];
export const MAX_BOOKING_PHOTOS = 300;
export const PHOTO_KEEP_DAYS = 90;
/** The client sees the gallery once the creator sends it (session) or delivers (remote order). */
export const clientSeesPhotos = (b: Booking) => (isDelivery(b)
  ? b.status === 'delivered' || b.status === 'completed' || (b.revisions_used ?? 0) > 0
  : !!b.photos_ready_at || b.status === 'completed');
/** The creator may fix the photos while working and for 30 days after completion (same as the database rule). */
export const creatorCanRemovePhotos = (b: Booking, now = Date.now()) =>
  b.status === 'confirmed' || b.status === 'delivered' || (b.status === 'completed' && !!b.completed_at && now - Date.parse(b.completed_at) < 30 * 86400000);
export const photosKeptUntil = (b: Booking) => (b.completed_at ? new Date(Date.parse(b.completed_at) + PHOTO_KEEP_DAYS * 86400000).toISOString() : null);
export const thumbPath = (path: string) => { const [dir, file] = String(path).split('/'); return `${dir}/t_${file}`; };
/** Shown on the creator's bookings: when to offer the photo upload. */
export const creatorPhotoButton = (b: Booking, count: number, now = Date.now()) =>
  PHOTO_STATUSES.includes(b.status) && (isDelivery(b) ? b.status !== 'confirmed' : daysUntil(b.shoot_date, now) <= 0 || count > 0);

/* ── dates (UTC day boundaries, same as the server) ── */
export const isoInDays = (n: number, now = Date.now()) => new Date(now + n * 86400000).toISOString().slice(0, 10);
export function daysUntil(iso: string, now = Date.now()): number {
  const today = new Date(now).toISOString().slice(0, 10);
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── filtering ── */
export interface Filters { type?: string; vibe?: string; occasion?: string; availableOnly?: boolean }
export const isRemoteSearch = (type?: string) => type === 'remote' || isRemoteService(type ?? '');
export function clientFilter(list: Listing[], f: Filters): Listing[] {
  return list.filter((c) =>
    (!f.type || (f.type === 'remote' ? hasRemote(c.services) : (c.services ?? []).includes(f.type))) &&
    (!f.vibe || (c.vibes ?? []).includes(f.vibe)) &&
    (!f.occasion || (c.occasions ?? []).includes(f.occasion)) &&
    (!f.availableOnly || c.available !== false));
}
/** Sponsored (boosted) listings first, then fast responders (v8.14, same as the website); otherwise keeps the
 *  server order (stable sort — newest first within each group). */
export const sponsoredFirst = (list: Listing[], now = Date.now()) =>
  [...list].sort((a, b) => Number(isBoosted(b, now)) - Number(isBoosted(a, now)) || replyRank(b) - replyRank(a));

/* ── keyword matcher (fallback when the AI service is unavailable) ── */
const PRICE_WORDS: Record<string, string[]> = { budget: ['cheap', 'budget', 'affordable', 'student'], premium: ['luxury', 'premium', 'high-end'] };
export interface Match { id: string; reason: string }
export function localMatch(q: string, creators: Listing[]): Match[] {
  const t = q.toLowerCase();
  const hit = (x: { kw: string[] }) => x.kw.some((w) => t.includes(w));
  const wantSvc = services.filter(hit).map((s) => s.id);
  const wantVibe = vibes.filter(hit).map((v) => v.id);
  const wantOcc = occasions.filter(hit).map((o) => o.id);
  const wantsRemote = wantSvc.length > 0 && wantSvc.every(isRemoteService);
  const words = t.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
  const scored = creators.filter((c) => c.available !== false).map((c) => {
    const cityParts = String(c.city ?? '').toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length > 2);
    const cityHit = cityParts.some((w) => t.includes(w));
    const svcHits = wantSvc.filter((id) => (c.services ?? []).includes(id));
    let score = cityHit ? 10 : 0;
    score += svcHits.length * 4;
    score += wantVibe.filter((id) => (c.vibes ?? []).includes(id)).length * 2;
    score += wantOcc.filter((id) => (c.occasions ?? []).includes(id)).length * 3;
    for (const [k, ws] of Object.entries(PRICE_WORDS)) if (ws.some((w) => t.includes(w)) && c.price === k) score += 1;
    const hay = `${c.description ?? ''} ${c.languages ?? ''} ${spotsOf(c).map((x) => x.name).join(' ')}`.toLowerCase();
    score += words.filter((w) => hay.includes(w)).length * 0.5;
    return { c, score, cityHit, svcHits };
  });
  let pool: typeof scored, min: number;
  if (wantsRemote) { pool = scored.filter((x) => x.svcHits.length); min = 4; }
  else {
    const local = scored.filter((x) => x.cityHit);
    pool = local.length ? local : scored.filter((x) => x.c.travel_available);
    min = local.length ? 10 : 2;
  }
  return pool.filter((x) => x.score >= min).sort((a, b) => b.score - a.score).slice(0, 6).map((x) => ({
    id: x.c.id,
    reason: wantsRemote ? `Remote · ${x.svcHits.map(serviceLabel).join(', ')}`
      : x.cityHit ? `Based in ${x.c.city}` : `Travels — based in ${x.c.city}`,
  }));
}

/* ── bookings: which buttons each side sees (identical to the website dashboard) ── */
export type BookingAction = 'confirm' | 'decline' | 'deliver' | 'revise' | 'cancel' | 'complete' | 'dispute';
export interface ActionButton { action: BookingAction; label: string; kind: 'primary' | 'secondary' | 'danger' }
const STATUS_TEXT: Record<string, string> = {
  pending_payment: 'Awaiting payment', paid: 'Paid — awaiting confirmation', confirmed: 'Confirmed',
  delivered: 'Delivered — awaiting approval', completed: 'Completed', declined: 'Declined — refunded',
  cancelled: 'Cancelled', refunded: 'Refunded', expired: 'Payment not completed', disputed: 'Under review',
};
export const isDelivery = (b: Booking) => b.booking_type === 'delivery';
export function statusText(b: Booking, now = Date.now()): string {
  if (b.status === 'pending_payment' && Number(b.split_count) > 1 && b.split_deadline && Date.parse(b.split_deadline) - now > 31 * 60000) return 'Friends are paying';
  if (isDelivery(b) && b.status === 'confirmed') return 'Accepted — in progress';
  if (isDelivery(b) && b.status === 'paid') return 'Paid — awaiting acceptance';
  return STATUS_TEXT[b.status] ?? b.status;
}
const hoursSince = (iso: string | null | undefined, now: number) => (iso ? (now - Date.parse(iso)) / 3600000 : 0);

export function bookingButtons(b: Booking, asCreator: boolean, now = Date.now()): ActionButton[] {
  const d = daysUntil(b.shoot_date, now);
  const out: ActionButton[] = [];
  const add = (action: BookingAction, label: string, kind: ActionButton['kind']) => out.push({ action, label, kind });
  if (isDelivery(b)) {
    const left = (b.revisions_allowed ?? 0) - (b.revisions_used ?? 0);
    if (asCreator) {
      if (b.status === 'paid') { add('confirm', 'Accept order', 'primary'); add('decline', 'Decline & refund', 'danger'); }
      if (b.status === 'confirmed') { add('deliver', 'Deliver files', 'primary'); add('decline', 'Cancel & refund', 'danger'); }
      if (b.status === 'delivered' && hoursSince(b.delivered_at, now) >= 72) add('complete', 'Release my payment', 'primary');
    } else {
      if (b.status === 'pending_payment') add('cancel', 'Cancel', 'secondary');
      if (b.status === 'paid') add('cancel', 'Cancel — full refund', 'secondary');
      if (b.status === 'confirmed' && d < 0) add('cancel', 'Cancel — not delivered on time', 'secondary');
      if (b.status === 'delivered') {
        add('complete', 'Approve & release payment', 'primary');
        if (left > 0) add('revise', `Request a revision (${left} left)`, 'secondary');
        if (hoursSince(b.delivered_at, now) <= 72) add('dispute', 'Report a problem', 'danger');
      }
      if (b.status === 'paid' || b.status === 'confirmed') add('dispute', 'Report a problem', 'danger');
    }
    return out;
  }
  const hold = holdState(b, now);   // photos promised: the payout waits for them (3 days after they were sent)
  if (asCreator) {
    if (b.status === 'paid') { add('confirm', 'Confirm booking', 'primary'); add('decline', 'Decline & refund', 'danger'); }
    if (b.status === 'confirmed' && d > 0) add('decline', 'Cancel & refund', 'danger');
    if (b.status === 'confirmed' && d <= -3 && !(hold && hold.waiting)) add('complete', 'Release my payment', 'primary');
  } else {
    if (b.status === 'pending_payment') add('cancel', 'Cancel', 'secondary');
    if (b.status === 'paid') add('cancel', 'Cancel — full refund', 'secondary');
    if (b.status === 'confirmed' && d >= 7) add('cancel', 'Cancel — full refund', 'secondary');
    if (b.status === 'confirmed' && d <= 0) add('complete', 'Shoot happened — release payment', 'primary');
    if ((b.status === 'paid' || b.status === 'confirmed') && d <= 0 && (d >= -3 || (b.status === 'confirmed' && !!hold && hold.waiting))) add('dispute', 'Report a problem', 'danger');
  }
  return out;
}

export function bookingHint(b: Booking, asCreator: boolean, now = Date.now()): string {
  const d = daysUntil(b.shoot_date, now);
  if (isDelivery(b)) {
    if (asCreator && b.status === 'confirmed' && (b.revisions_used ?? 0) > 0 && b.last_revision_note) return `Revision requested: “${b.last_revision_note}”`;
    if (asCreator && b.status === 'delivered') return 'Payment is released when the client approves, or can be released 3 days after delivery.';
    if (!asCreator && b.status === 'delivered') return "Check the files, then approve to release the payment. If you don't respond within 3 days, the creator can release it.";
    if (!asCreator && b.status === 'confirmed' && d >= 0) return `Due ${fmtDate(b.shoot_date)}. If it's late, you can cancel for a full refund.`;
  } else {
    if (asCreator && b.status === 'confirmed' && d > -3 && !photosPromised(b)) return 'Payment is released 3 days after the shoot, or as soon as the traveller confirms.';
    if (!asCreator && b.status === 'confirmed' && d > 0 && d < 7) return 'Free cancellation has ended. You can still propose a new date — free if you both agree.';
  }
  if (b.status === 'disputed') return "We're reviewing this booking and will contact both of you by email.";
  return '';
}
/** Bookings that need the user's action now: new paid bookings (creator) or deliveries to approve (client). */
export const needsAction = (list: Booking[], userId: string) =>
  list.filter((b) => (b.creator_user_id === userId && b.status === 'paid') || (b.client_user_id === userId && b.status === 'delivered')).length;

/* ── auth error wording (same as the website) ── */
export function friendlyAuthError(msg = ''): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Wrong email or password.';
  if (m.includes('not confirmed')) return 'Please confirm your email first — check your inbox (and spam folder).';
  if (m.includes('already registered')) return 'This email already has an account. Try signing in.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (m.includes('password')) return msg;
  return msg || 'Something went wrong. Please try again.';
}

/* ── verification badge (same labels as the website profile and admin panel) ── */
const VERIFIED_LABELS: Record<number, string> = { 1: '✓ Verified', 2: '✓✓ Portfolio reviewed', 3: '✓✓✓ ID verified' };
export const verifiedLabel = (lvl?: number | null) => VERIFIED_LABELS[Math.min(Number(lvl) || 0, 3)] ?? '';
