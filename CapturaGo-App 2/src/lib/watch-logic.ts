// v8.14 pure logic — "Notify me" on fully booked creators, clients' favourite shots, last-minute deals with
// "Surprise me". Same rules as the website (script.js, gift.js) and the database (watch_creator, active_deals).
import { canBook, packagesOf, type Listing } from './logic';
import { dealCents } from './deal-logic';
import { CLIENT_FEE_PCT } from './config';
import { tripOn } from './trip-logic';

export const WATCH_DAYS = 14;   // "fully booked" = no free day in the next two weeks (or not taking bookings right now)

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Tomorrow and the following days, as YYYY-MM-DD (local dates, like the booking calendar). */
export function nextDays(n = WATCH_DAYS, now = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i + 1); return isoLocal(d); });
}

/** Show "Notify me"? Only for creators who take online bookings (or normally do and are paused). */
export function canWatch(l: Listing | null | undefined, myId?: string | null): boolean {
  return !!l && !l.isExample && !!l.payouts_enabled && l.user_id !== myId && (canBook(l) || l.available === false);
}
/** No free day in the next two weeks (busy = crossed-out days), no live deal — or not taking bookings at all. */
export function isFullyBooked(l: Listing, busy: Iterable<string>, hasDeal: boolean, now = Date.now()): boolean {
  if (l.available === false) return true;
  if (hasDeal) return false;
  const taken = new Set(busy);
  return nextDays(WATCH_DAYS, now).every((d) => taken.has(d));
}

export interface WatchRow { id: string; photographer_id: string; name: string; handle: string | null; city: string | null; by_text: boolean; until_day?: string; created_at: string; notified_at: string | null; notified_reason: 'free' | 'deal' | null }
export function watchStatus(w: Pick<WatchRow, 'notified_at' | 'notified_reason'>): string {
  if (!w.notified_at) return 'Waiting';
  return w.notified_reason === 'deal' ? '✓ We told you about a deal' : '✓ We told you about a free day';
}

/** Clients' favourite shots: the first photo of each review (the one the traveller picked first), newest first. */
export function clientShots<T extends { id: string; photos?: string[] | null; rating: number; reviewer_name: string }>(reviews: T[], max = 8): { review: T; url: string }[] {
  return (reviews ?? [])
    .map((r) => ({ review: r, url: Array.isArray(r.photos) ? String(r.photos[0] ?? '') : '' }))
    .filter((x) => /^https:\/\/[^\s]+$/i.test(x.url))
    .slice(0, max);
}

/* ── Last-minute deals for the deals screen (and "Surprise me") ── */
export interface DealRow { listing: Listing; day: string; pct: number; pkgName: string; wasCents: number; priceCents: number; totalCents: number; city: string }
/** One row per live deal: the cheapest in-person package at the deal price + the service fee (as the checkout). */
export function dealRows(deals: { photographer_id: string; day: string; pct: number }[], listings: Listing[], feePct = CLIENT_FEE_PCT): DealRow[] {
  const byId = new Map(listings.map((l) => [l.id, l]));
  const out: DealRow[] = [];
  for (const d of deals ?? []) {
    const l = byId.get(d.photographer_id);
    const pct = Math.round(Number(d.pct) || 0);
    if (!l || l.available === false || !l.payouts_enabled || !(pct >= 10 && pct <= 50)) continue;
    const pkgs = packagesOf(l).filter((k) => k.type !== 'delivery');
    if (!pkgs.length) continue;
    const k = pkgs.reduce((a, b) => (Number(b.price_eur) < Number(a.price_eur) ? b : a));
    const priceCents = dealCents(Number(k.price_eur), pct);
    const trip = tripOn(l.trips, d.day);
    out.push({ listing: l, day: d.day, pct, pkgName: String(k.name || ''), wasCents: Math.round(Number(k.price_eur) * 100), priceCents,
      totalCents: priceCents + Math.round((priceCents * feePct) / 100), city: String(trip?.city || l.city || '').split(',')[0].trim() });
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : b.pct - a.pct));
}
const cityKey = (c: string) => String(c ?? '').split(',')[0].trim().toLowerCase().replace(/\s+/g, ' ');
export function dealsIn(rows: DealRow[], city: string): DealRow[] {
  const c = cityKey(city);
  return c ? rows.filter((r) => cityKey(r.city).includes(c) || cityKey(r.listing.city).includes(c)) : rows;
}
/** "Surprise me": a deal at random — one the gift card fully covers when there is one (same as the website). */
export function pickSurprise(rows: DealRow[], balanceCents: number | null, rand: () => number = Math.random): DealRow | null {
  if (!rows.length) return null;
  const covered = balanceCents === null ? [] : rows.filter((r) => r.totalCents <= balanceCents);
  const pool = covered.length ? covered : rows;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}
/** What the gift card covers for a deal: '' (no card), 'covered', or the amount left to pay in cents. */
export function coverOf(r: DealRow, balanceCents: number | null): { covered: boolean; fromCard: number; toPay: number } | null {
  if (balanceCents === null) return null;
  const fromCard = Math.min(balanceCents, r.totalCents);
  return { covered: balanceCents >= r.totalCents, fromCard, toPay: r.totalCents - fromCard };
}
