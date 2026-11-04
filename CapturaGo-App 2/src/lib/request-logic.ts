/* Shoot requests — the same rules and wording as the website (site.js / dashboard.js) and the database (Part 14). */
import { tripDates } from './trip-logic';

export type RequestService = 'photo' | 'video' | 'phone' | 'drone' | 'guide' | 'event';
export const REQUEST_SERVICES: [RequestService, string, string][] = [['photo', '📷', 'Photographer'], ['video', '🎥', 'Videographer'], ['phone', '📱', 'Phone content'], ['drone', '🚁', 'Drone'], ['guide', '🗺️', 'Local guide'], ['event', '💍', 'Wedding & event']];
export interface OfferCreator { id: string; name: string; city: string; handle: string | null; cover_image_url: string | null; rating: number | null; reviews_count: number | null; verified: number | null }
export interface Offer { id: string; price_eur: number; shoot_date: string; minutes: number; photos: number | null; edit_days: number | null; message: string; status: 'open' | 'withdrawn' | 'declined' | 'accepted'; created_at?: string; creator?: OfferCreator }
export interface ShootRequest { id: string; city: string; date_from: string; date_to: string; service: RequestService; people: number; budget_eur: number | null; note: string; status: 'open' | 'closed' | 'booked'; created_at: string; offers: Offer[] }
export interface NearRequest { id: string; first_name: string; city: string; date_from: string; date_to: string; service: RequestService; people: number; budget_eur: number | null; note: string; created_at: string; offers_count: number; my_offer: Offer | null }

export const requestService = (id: string) => { const x = REQUEST_SERVICES.find((s) => s[0] === id); return x ? `${x[1]} ${x[2]}` : String(id || ''); };
export const requestWhen = (q: { date_from: string; date_to: string }) => tripDates({ city: '', from: q.date_from, to: q.date_to });
export const minutesText = (m: number) => { const n = Math.round(Number(m) || 0), h = Math.floor(n / 60), r = n % 60; return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`; };
export const requestHead = (q: { service: string; city: string; date_from: string; date_to: string; people: number; budget_eur: number | null }) =>
  `${requestService(q.service)} in ${String(q.city).split(',')[0]} · ${requestWhen(q)} · ${q.people} ${q.people === 1 ? 'person' : 'people'}${q.budget_eur ? ` · budget about €${q.budget_eur}` : ''}`;
export const offerFacts = (o: Pick<Offer, 'shoot_date' | 'minutes' | 'photos' | 'edit_days'>, fmt: (d: string) => string) =>
  [`📅 ${fmt(o.shoot_date)}`, `⏱ ${minutesText(o.minutes)}`, o.photos ? `📸 ${o.photos} photos` : '', o.edit_days ? `📬 within ${o.edit_days} days` : ''].filter(Boolean).join(' · ');
export const OFFER_STATUS: Record<string, string> = { open: '', declined: 'Declined', accepted: '✓ Booked', withdrawn: 'Withdrawn' };
export const OFFER_MINUTES = [30, 45, 60, 90, 120, 180, 240, 360, 480];

/** Same checks as create_shoot_request (the database checks again). '' when fine. */
export function requestProblem(r: { city: string; from: string | null; to: string | null; people: number; budget: number | null }, today: string): string {
  if (String(r.city).trim().length < 2) return 'Tell us the city.';
  if (!r.from) return 'Choose your dates.';
  if (r.from <= today) return 'Choose dates from tomorrow on.';
  const to = r.to || r.from;
  if (to < r.from) return 'The end date is before the start date.';
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86400000 > 30) return 'Choose up to 31 days.';
  if (!Number.isInteger(r.people) || r.people < 1 || r.people > 30) return 'How many people? (1–30)';
  if (r.budget !== null && (!Number.isFinite(r.budget) || r.budget < 20 || r.budget > 10000)) return 'The budget can be from €20 to €10,000.';
  return '';
}
/** Same checks as make_offer (the database also checks the day, the city and the creator's calendar). */
export function offerProblem(o: { price: number | null; photos: number | null; edit: number | null; date: string | null }): string {
  if (!o.price || o.price < 20 || o.price > 10000) return 'The price can be from €20 to €10,000.';
  if (o.photos !== null && (o.photos < 0 || o.photos > 2000)) return 'Up to 2000 photos.';
  if (o.edit !== null && (o.edit < 1 || o.edit > 60)) return 'Photos can be promised within 1 to 60 days.';
  if (!o.date) return 'Choose a day.';
  return '';
}
/** The days a creator can offer: within the request, from tomorrow. */
export function offerDays(q: { date_from: string; date_to: string }, today: string): string[] {
  const out: string[] = [];
  for (let d = q.date_from; d <= q.date_to && out.length < 40; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) if (d > today) out.push(d);
  return out;
}
