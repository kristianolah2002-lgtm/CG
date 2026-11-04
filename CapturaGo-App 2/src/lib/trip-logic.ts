// Creators on the road, payment held until the photos arrive, calendar sync.
// Same rules as the website (site.js) and the database (database.sql Part 12).
import type { Booking, Trip } from './logic';

export const TRIP_MAX = 10;
export const TRIP_MAX_DAYS = 61;

const pad = (n: number) => String(n).padStart(2, '0');
export const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoLocal(new Date());
export const validIso = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
/** Same as the database's city_key(): first part before the comma, lower case, single spaces. */
export const cityKey = (c: unknown) => String(c ?? '').split(',')[0].trim().toLowerCase().replace(/\s+/g, ' ');
export const citySlug = (c: unknown) => String(c ?? '').split(',')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Trips that haven't ended yet (by `today`), soonest first. */
export function upcomingTrips(trips: Trip[] | null | undefined, today = todayIso()): Trip[] {
  return (Array.isArray(trips) ? trips : []).filter((t) => t && typeof t.city === 'string' && validIso(t.from) && validIso(t.to) && t.to >= today)
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}
/** The trip on a day, or null when the creator is at home. */
export function tripOn(trips: Trip[] | null | undefined, iso: string): Trip | null {
  return (Array.isArray(trips) ? trips : []).find((t) => t && typeof t.from === 'string' && iso >= t.from && iso <= t.to) ?? null;
}
export const tripCity = (t: Trip | null | undefined) => String(t?.city ?? '').split(',')[0].trim();
/** "3–10 Nov", "28 Nov – 2 Dec", "3 Nov" */
export function tripDates(t: Trip | null | undefined): string {
  if (!t) return '';
  const f = new Date(`${t.from}T12:00:00Z`), e = new Date(`${t.to}T12:00:00Z`);
  const dm = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (t.from === t.to) return dm(f);
  if (f.getUTCMonth() === e.getUTCMonth() && f.getUTCFullYear() === e.getUTCFullYear()) return `${f.getUTCDate()}–${dm(e)}`;
  return `${dm(f)} – ${dm(e)}`;
}
/** Does a trip go to the city someone searched for? */
export function tripMatches(t: Trip | null | undefined, q: string): boolean {
  const s = String(q || '').trim().toLowerCase();
  if (!t || s.length < 2) return false;
  return cityKey(t.city) === cityKey(s) || citySlug(t.city) === citySlug(s) || String(t.city).toLowerCase().includes(s);
}
/** Problems with a list of trips, or '' when the database will accept it. */
export function tripsProblem(trips: Trip[]): string {
  if (!Array.isArray(trips)) return 'Something went wrong with your trips. Please reload.';
  if (trips.length > TRIP_MAX) return `Up to ${TRIP_MAX} trips at a time.`;
  const sorted = [...trips].sort((a, b) => (a.from < b.from ? -1 : 1));
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const city = String(t.city || '');
    if (city.trim().length < 2 || city.length > 80) return 'Enter the city of your trip (e.g. "Lisbon, Portugal").';
    if (/[<>"\n\r]/.test(city)) return 'The city name contains characters we can’t use.';
    if (!validIso(t.from) || !validIso(t.to)) return 'Choose the first and last day of your trip.';
    if (t.to < t.from) return 'The last day of your trip is before the first day.';
    if ((Date.parse(`${t.to}T00:00:00Z`) - Date.parse(`${t.from}T00:00:00Z`)) / 86400000 > TRIP_MAX_DAYS - 1) return `A trip can be up to ${TRIP_MAX_DAYS} days.`;
    if (i > 0 && t.from <= sorted[i - 1].to) return `Your trips to ${tripCity(sorted[i - 1])} and ${tripCity(t)} overlap.`;
  }
  return '';
}
/** Trips kept when saving: everything from yesterday on (a time-zone difference never drops a trip with a shoot today). */
export function keptTrips(trips: Trip[] | null | undefined, now = new Date()): Trip[] {
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const from = isoLocal(y);
  return (Array.isArray(trips) ? trips : []).filter((t) => t && typeof t.to === 'string' && t.to >= from);
}
/** Only the fields the database accepts. */
export const cleanTrip = ({ city, from, to, lat, lon }: Trip): Trip => ({ city, from, to, ...(lat !== undefined && lon !== undefined ? { lat, lon } : {}) });

/* ── Payment held until the photos arrive ── */
export function photosPromised(b: Booking): boolean {
  if (!b || b.booking_type === 'delivery') return false;
  if (typeof b.photos_promised === 'boolean') return b.photos_promised;
  const d = Math.round(Number(b.package_details?.edit_days));
  return d >= 1 && d <= 60;
}
export interface Hold { sent: boolean; release: number | null; dueIso: string; waiting: boolean }
export function holdState(b: Booking, now = Date.now()): Hold | null {
  if (!photosPromised(b)) return null;
  const shoot = Date.parse(`${b.shoot_date}T00:00:00Z`);
  const sent = b.photos_delivered_at ? Date.parse(b.photos_delivered_at) : NaN;
  const release = Number.isFinite(sent) ? Math.max(shoot, sent) + 3 * 86400000 : null;
  const dueIso = new Date(shoot + Math.round(Number(b.package_details?.edit_days) || 0) * 86400000).toISOString().slice(0, 10);
  return { sent: Number.isFinite(sent), release, dueIso, waiting: release === null || now < release };
}
/** One line about the held payment on a booking ('' when it doesn't apply). Same wording as the website. */
export function payoutNote(b: Booking, asCreator: boolean): string {
  const h = holdState(b);
  if (!h || !['paid', 'confirmed'].includes(b.status)) return '';
  const nice = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const due = b.package_details?.edit_days ? ` (promised by ${nice(Date.parse(`${h.dueIso}T00:00:00Z`))})` : '';
  const who = String(b.photographers?.name || 'the creator').split(' ')[0];
  if (!h.sent) return asCreator ? `💶 Paid out 3 days after you send the photos${due}.` : `🔒 Your payment stays on hold until your photos arrive${due}.`;
  return asCreator ? `💶 Payout on ${nice(h.release!)} — 3 days after you sent the photos.` : `🔒 Photos received. The payment goes to ${who} on ${nice(h.release!)} unless you report a problem.`;
}
/** "The photos are late" can be reported once the promised day has passed (server rule, by UTC date). */
export function canReportLate(b: Booking, now = Date.now()): boolean {
  const h = holdState(b, now);
  return !!h && !h.sent && b.status === 'confirmed' && new Date(now).toISOString().slice(0, 10) > h.dueIso;
}

/* ── Calendar sync ── */
export const CALENDAR_HOSTS = /^(calendar\.google\.com|([a-z0-9-]+\.)*icloud\.com|outlook\.live\.com|outlook\.office365\.com|outlook\.office\.com|calendar\.proton\.me|user\.fm)$/i;
export function calendarUrlOk(raw: string): boolean {
  let s = String(raw || '').trim();
  if (/^webcal:\/\//i.test(s)) s = 'https://' + s.slice(9);
  if (s.length < 20 || s.length > 1000 || /[\s<>"\\]/.test(s)) return false;
  let u: URL;
  try { u = new URL(s); } catch { return false; }
  return u.protocol === 'https:' && !u.username && !u.password && !u.port && CALENDAR_HOSTS.test(u.hostname) && s.toLowerCase().startsWith(`https://${u.hostname.toLowerCase()}/`);
}
export const webcalUrl = (https: string) => https.replace(/^https:/, 'webcal:');
export const googleSubscribeUrl = (https: string) => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(https))}`;
export function syncedAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'reading soon';
  const m = Math.round((now - Date.parse(iso)) / 60000);
  return m < 1 ? 'read just now' : m < 60 ? `read ${m} min ago` : m < 1440 ? `read ${Math.round(m / 60)} h ago` : `read ${Math.round(m / 1440)} days ago`;
}
export interface CalendarSync { import: { host: string; last_synced_at: string | null; last_error: string | null; busy_count: number } | null; busy_dates: string[] }
