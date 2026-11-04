// v8.7 pure logic — shoot plan, new dates, problems, weather, trip planner, earnings, shares, QR card.
// No React Native imports, so everything here is unit-tested (tests/v87.test.ts). Same rules as the website.
import qrcode from 'qrcode-generator';
import { SITE_URL } from './config';
import { daysUntil, firstName, isDelivery, isIsoDate, slotLabel, statusText, type Booking } from './logic';
import { canReportLate, holdState } from './trip-logic';

/* ── shoot plan ── */
export const PLAN_STATUSES = ['paid', 'confirmed'];
export const MAX_RESCHEDULES = 3;
export const canPlan = (b: Booking) => !isDelivery(b) && PLAN_STATUSES.includes(b.status);
/** "Tue, 3 Nov 2026" — date-only values are read as UTC so the day never shifts. */
export const isoNice = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
/** "Tue, 3 Nov" */
export const niceDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const otherName = (b: Booking, asCreator: boolean) =>
  (asCreator ? firstName(b.client_name) : b.photographers?.name ? firstName(b.photographers.name) : 'your creator');
export const planTitle = (b: Booking, now = Date.now()) => {
  const d = daysUntil(b.shoot_date, now);
  return d === 0 ? "Today's shoot" : d === 1 ? "Tomorrow's shoot" : 'Shoot plan';
};

/** Who has to answer a proposed new date. */
export type Proposal = { kind: 'none' } | { kind: 'mine' | 'theirs'; when: string; weather: boolean };
export function proposalOf(b: Booking, userId: string): Proposal {
  if (!b.proposed_date || !canPlan(b)) return { kind: 'none' };
  const when = `${isoNice(b.proposed_date)}${b.proposed_slot ? ` · ${slotLabel(b.proposed_slot)}` : ''}`;
  return { kind: b.proposed_by === userId ? 'mine' : 'theirs', when, weather: b.proposed_reason === 'weather' };
}
/** "Propose a new date" is offered until the shoot day, at most 3 times, and not while the other side's proposal waits. */
export const canPropose = (b: Booking, userId: string, now = Date.now()) =>
  canPlan(b) && daysUntil(b.shoot_date, now) >= 0 && (b.reschedules ?? 0) < MAX_RESCHEDULES && !(b.proposed_date && b.proposed_by !== userId);

export const MEETING_TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
/** Accepts "9:30", "09.30" or "0930" and returns "09:30"; '' when empty; null when it isn't a time. */
export function cleanTime(raw: string): string | null {
  const v = raw.trim();
  if (!v) return '';
  const m = v.match(/^(\d{1,2})[:.h]?(\d{2})$/);
  if (!m) return null;
  const t = `${m[1].padStart(2, '0')}:${m[2]}`;
  return MEETING_TIME_RE.test(t) ? t : null;
}
export function meetingProblem(point: string, time: string): string {
  if (!point.trim() && !time.trim()) return 'Enter a meeting point or a time.';
  if (point.trim().length > 300) return 'Keep the meeting point under 300 characters.';
  if (cleanTime(time) === null) return 'Enter the time as HH:MM, for example 09:30.';
  return '';
}
export const lines = (text: string) => text.split('\n').map((x) => x.trim()).filter(Boolean);
export function briefProblem(shots: string[], refs: string[]): string {
  if (shots.length > 20) return 'Up to 20 shots, please.';
  if (shots.some((s) => s.length > 120)) return 'Keep each shot under 120 characters.';
  if (refs.length > 6) return 'Up to 6 reference links, please.';
  if (refs.some((u) => !/^https:\/\/\S+$/i.test(u) || u.length > 500)) return 'Reference links must start with https://';
  return '';
}

/** Reasons a client can give when reporting a problem ("didn't show up" only from the shoot day on). */
export function disputeReasons(b: Booking, now = Date.now()): [('photos_late' | 'no_show' | 'quality' | 'other'), string][] {
  const remote = isDelivery(b);
  const h = holdState(b, now);
  return [
    ...(canReportLate(b, now) && h ? [['photos_late', `The photos are late (promised by ${isoNice(h.dueIso)})`] as ['photos_late', string]] : []),
    ...(!remote && daysUntil(b.shoot_date, now) <= 0 ? [['no_show', "The creator didn't show up"] as ['no_show', string]] : []),
    ['quality', remote ? "The delivery isn't what we agreed" : "It wasn't what we agreed"],
    ['other', 'Something else'],
  ];
}
export const disputeProblem = (reason: string, msg: string) => (reason !== 'no_show' && reason !== 'photos_late' && msg.trim().length < 10 ? 'Please describe the problem in a sentence or two.' : '');

/* ── weather (Open-Meteo, free, no key) ── */
export interface Forecast { icon: string; text: string; max: number; min: number; rain: number | null; bad: boolean; sunrise?: string | null; sunset?: string | null }
const WEATHER: [number, string, string][] = [[0, '☀️', 'Clear'], [1, '🌤️', 'Mostly clear'], [2, '⛅', 'Partly cloudy'], [3, '☁️', 'Cloudy'], [45, '🌫️', 'Fog'], [48, '🌫️', 'Fog'],
  [51, '🌦️', 'Drizzle'], [53, '🌦️', 'Drizzle'], [55, '🌦️', 'Drizzle'], [56, '🌧️', 'Freezing drizzle'], [57, '🌧️', 'Freezing drizzle'],
  [61, '🌧️', 'Rain'], [63, '🌧️', 'Rain'], [65, '🌧️', 'Heavy rain'], [66, '🌧️', 'Freezing rain'], [67, '🌧️', 'Freezing rain'],
  [71, '🌨️', 'Snow'], [73, '🌨️', 'Snow'], [75, '❄️', 'Heavy snow'], [77, '🌨️', 'Snow'], [80, '🌦️', 'Showers'], [81, '🌧️', 'Showers'], [82, '⛈️', 'Heavy showers'],
  [85, '🌨️', 'Snow showers'], [86, '🌨️', 'Snow showers'], [95, '⛈️', 'Thunderstorm'], [96, '⛈️', 'Thunderstorm'], [99, '⛈️', 'Thunderstorm']];
/** Forecasts exist up to 16 days ahead (today = day 0). */
export function forecastUrl(coords: { lat: number; lon: number } | null | undefined, iso: string, now = Date.now()): string | null {
  const lat = Number(coords?.lat), lon = Number(coords?.lon);
  if (!coords || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !isIsoDate(iso)) return null;
  const d = daysUntil(iso, now);
  if (d < 0 || d > 15) return null;
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&start_date=${iso}&end_date=${iso}`;
}
export function parseForecast(j: unknown): Forecast | null {
  const d = (j as { daily?: Record<string, unknown[]> } | null)?.daily;
  if (!d) return null;
  const code = Number(d.weather_code?.[0]);
  const max = Number(d.temperature_2m_max?.[0]), min = Number(d.temperature_2m_min?.[0]);
  if (!Number.isFinite(code) || !Number.isFinite(max) || !Number.isFinite(min)) return null;
  const w = WEATHER.find(([c]) => c === code) ?? [code, '🌡️', 'Forecast'];
  const rainRaw = d.precipitation_probability_max?.[0];
  const rain = rainRaw === null || rainRaw === undefined || !Number.isFinite(Number(rainRaw)) ? null : Number(rainRaw);
  return { icon: w[1], text: w[2], max: Math.round(max), min: Math.round(min), rain, bad: code >= 61 || (rain !== null && rain >= 70),
    sunrise: hhmm(d.sunrise?.[0]), sunset: hhmm(d.sunset?.[0]) };
}

/* ── light on the shoot day: sunrise, sunset, golden hour (the same rules on the website and in the reminder email).
   Times are the shoot city's own local time (Open-Meteo, timezone=auto). Golden hour = the hour after sunrise and the
   hour before sunset. No line near the poles, where the sun doesn't rise or set. */
/** "2026-11-06T06:58" → "06:58" (null for anything else). */
export function hhmm(v: unknown): string | null {
  const m = String(v ?? '').match(/(?:^|T)([01]\d|2[0-3]):([0-5]\d)(?::\d\d)?$/);
  return m ? `${m[1]}:${m[2]}` : null;
}
/** "15:31" + n minutes, kept inside the same day. */
export function addMinutes(t: string, n: number): string {
  const [h, m] = t.split(':').map(Number);
  const x = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + n));
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}
const EVENING = ['golden_hour', 'evening'];
/** One line about the light, fitted to the booked time of day. */
export function sunLine(w: Pick<Forecast, 'sunrise' | 'sunset'> | null | undefined, slot?: string | null): string {
  const sr = w?.sunrise ?? null, ss = w?.sunset ?? null;
  if (!sr || !ss || sr >= ss) return '';
  if (slot === 'sunrise') return `🌅 Sunrise ${sr} · golden light until ${addMinutes(sr, 60)}`;
  if (EVENING.includes(String(slot))) return `🌇 Golden hour ${addMinutes(ss, -60)}–${ss} · sunset ${ss}`;
  return `🌅 Sunrise ${sr} · 🌇 Sunset ${ss} (golden hour from ${addMinutes(ss, -60)})`;
}
/** For the creator: a meeting time that catches the best light (only for sunrise / golden-hour / evening shoots). */
export function bestMeetTime(w: Pick<Forecast, 'sunrise' | 'sunset'> | null | undefined, slot?: string | null): string | null {
  const sr = w?.sunrise ?? null, ss = w?.sunset ?? null;
  if (!sr || !ss || sr >= ss) return null;
  if (slot === 'sunrise') return addMinutes(sr, -20);        // set up before the light
  if (EVENING.includes(String(slot))) return addMinutes(ss, -75);   // 15 minutes before golden hour starts
  return null;
}
export const forecastLine = (w: Forecast) => `${w.icon} ${w.text} · ${w.min}–${w.max}°C${w.rain !== null ? ` · ${w.rain}% chance of rain` : ''}`;
/** Offer "Propose a new date" under a bad forecast (not on the shoot day itself). */
export const offerWeatherMove = (b: Booking, userId: string, w: Forecast | null, now = Date.now()) =>
  !!w?.bad && canPropose(b, userId, now) && daysUntil(b.shoot_date, now) >= 1 && !b.proposed_date;

/* ── trip planner (local calendar days, like the date pickers) ── */
export const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addLocalDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const daySpan = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
export function tripProblem(from: string | null, to: string | null, now = new Date()): string {
  const tomorrow = localIso(addLocalDays(now, 1));
  if (!from) return 'Choose your dates.';
  if (from < tomorrow) return 'Choose dates from tomorrow on.';
  const end = to || from;
  if (end < from) return 'The end date is before the start date.';
  if (from > localIso(addLocalDays(now, 365))) return 'Choose dates within the next year.';
  if (daySpan(from, end) > 31) return 'Choose up to 31 days at a time.';
  return '';
}
/** The next Saturday + Sunday (or just Sunday when tomorrow is Sunday). */
export function nextWeekend(now = new Date()): { from: string; to: string } {
  let d = addLocalDays(now, 1);
  while (d.getDay() !== 6 && d.getDay() !== 0) d = addLocalDays(d, 1);
  return { from: localIso(d), to: localIso(d.getDay() === 6 ? addLocalDays(d, 1) : d) };
}
export interface FreeCreator { photographer_id: string; free_days: number; first_free: string }
export const tripReason = (span: number, from: string, x: FreeCreator) =>
  (span === 1 ? `Free on ${niceDay(from)}` : `Free ${x.free_days} of ${span} days · from ${niceDay(x.first_free)}`);
export const tripWhen = (from: string, to: string) => (from === to ? niceDay(from) : `${niceDay(from)} – ${niceDay(to)}`);

/* ── earnings (creator side of bookings) ── */
export const ON_HOLD = ['paid', 'confirmed', 'delivered', 'disputed'];
const net = (b: Booking) => (b.price_cents || 0) - (b.creator_fee_cents || 0);
const doneDate = (b: Booking) => String(b.completed_at || b.shoot_date);
export interface Earnings {
  year: number; paidThisYear: number; onHold: number; onHoldCount: number; completed: number; viaLink: number;
  months: { key: string; label: string; cents: number }[]; years: string[]; total: number;
}
export function earningsOf(all: Booking[], userId: string, now = new Date()): Earnings {
  const mine = all.filter((b) => b.creator_user_id === userId);
  const done = mine.filter((b) => b.status === 'completed');
  const hold = mine.filter((b) => ON_HOLD.includes(b.status));
  const year = now.getFullYear();
  const sum = (list: Booking[]) => list.reduce((n, b) => n + net(b), 0);
  const months: Earnings['months'] = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: new Date(`${key}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }), cents: 0 });
  }
  done.forEach((b) => { const m = months.find((x) => x.key === doneDate(b).slice(0, 7)); if (m) m.cents += net(b); });
  return {
    year, paidThisYear: sum(done.filter((b) => doneDate(b).slice(0, 4) === String(year))), onHold: sum(hold), onHoldCount: hold.length,
    completed: done.length, viaLink: mine.filter((b) => b.via_link && (b.status === 'completed' || ON_HOLD.includes(b.status))).length,
    months, years: [...new Set(mine.map((b) => String(b.shoot_date).slice(0, 4)))].sort().reverse(), total: mine.length,
  };
}
export function csvCell(v: unknown): string {
  let t = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // never let a spreadsheet run it as a formula
  return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
/** Same columns as the website export; starts with a BOM so Excel reads € and accents. */
export function earningsCsv(all: Booking[], userId: string, year: string): string {
  const rows = all.filter((b) => b.creator_user_id === userId && (year === 'all' || String(b.shoot_date).slice(0, 4) === year))
    .sort((a, b) => String(a.shoot_date).localeCompare(String(b.shoot_date)));
  const head = ['Booking ID', 'Booked on', 'Shoot / due date', 'Package', 'Type', 'Client', 'Status', 'Package price (EUR)', 'CapturaGo fee from you (EUR)', 'You receive (EUR)', 'Paid out on', 'Via your link'];
  const body = rows.map((b) => [
    b.id, String(b.created_at || '').slice(0, 10), b.shoot_date, b.package_name, isDelivery(b) ? 'Remote' : 'In person',
    firstName(b.client_name), statusText(b), ((b.price_cents || 0) / 100).toFixed(2), ((b.creator_fee_cents || 0) / 100).toFixed(2),
    (net(b) / 100).toFixed(2), b.status === 'completed' ? String(b.completed_at || '').slice(0, 10) : '', b.via_link ? 'yes' : 'no',
  ]);
  return '﻿' + [head, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/* ── shared gallery links ── */
export interface GalleryShare { token: string; expires_at: string; favorites_only: boolean; views: number; created_at: string }
export const shareUrl = (token: string) => `${SITE_URL}/share.html#t=${token}`;
export const activeShares = (list: GalleryShare[], now = Date.now()) => list.filter((x) => Date.parse(x.expires_at) > now);
export function expiresIn(iso: string, now = Date.now()): string {
  const h = (Date.parse(iso) - now) / 3600000;
  if (h <= 0) return 'Expired';
  if (h < 24) return `Expires in ${Math.max(1, Math.round(h))} h`;
  const d = Math.round(h / 24);
  return `Expires in ${d} day${d === 1 ? '' : 's'}`;
}

/* ── reports ── */
export const REPORT_REASONS: [string, string][] = [
  ['fake', 'Fake profile or impersonation'], ['stolen_photos', "Photos that aren't theirs"], ['inappropriate', 'Inappropriate content'],
  ['scam', 'Scam or asks to pay outside CapturaGo'], ['other', 'Something else'],
];
export const reportProblem = (reason: string, details: string) =>
  (!REPORT_REASONS.some(([k]) => k === reason) ? 'Please choose what is wrong.' : details.length > 1000 ? 'Keep it under 1000 characters.' : '');

/* ── review photos ── */
export const reviewPhotosOf = (r: { photos?: unknown }): string[] =>
  (Array.isArray(r.photos) ? r.photos : []).filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u)).slice(0, 3);

/* ── search insights: one event per city/service/result-kind per session ── */
export const searchKey = (city: string, service: string, results: number) => `${city.trim().toLowerCase()}|${service}|${results === 0}`;

/* ── printable QR card (SVG — sharp at any print size) ── */
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function qrCardSvg(url: string, name: string, city: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(url); qr.make();
  const n = qr.getModuleCount();
  const size = 760, cell = size / n, x0 = (1200 - size) / 2, y0 = 470;
  let path = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${(x0 + c * cell).toFixed(2)} ${(y0 + r * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
  const short = url.replace(/^https?:\/\//, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
<rect width="1200" height="1600" fill="#FAF3E7"/>
<rect x="80" y="80" width="1040" height="1440" rx="48" fill="#FFFFFF" stroke="#E6DCCB" stroke-width="4"/>
<text x="600" y="210" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="600" font-size="40" fill="#B04722" letter-spacing="6">CAPTURAGO</text>
<text x="600" y="320" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="76" fill="#211911">${xml(name.slice(0, 32))}</text>
<text x="600" y="395" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="36" fill="#6B5D4F">${xml(city ? `Photo shoots in ${city.split(',')[0].slice(0, 30)}` : 'Book a photo shoot')}</text>
<rect x="${x0 - 30}" y="${y0 - 30}" width="${size + 60}" height="${size + 60}" fill="#FFFFFF"/>
<path d="${path}" fill="#211911"/>
<text x="600" y="1340" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="600" font-size="44" fill="#211911">Scan to book me</text>
<text x="600" y="1410" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" fill="#B04722">${xml(short)}</text>
</svg>`;
}

/* ── founding creators (same wording as the website dashboard) ── */
export const FOUNDING_NEEDS: Record<string, string> = {
  cover: 'A cover photo', photos: 'At least 3 portfolio photos', package: 'A package with a price',
  description: 'A description of at least 80 characters', hidden: 'Your listing must be visible (contact us)',
};
export interface FoundingStatusLike {
  listing: boolean; claimed?: boolean; used?: boolean; open?: boolean; spots_left?: number; missing?: string[];
}
/** What the founding card shows: nothing, "you're a founder", what's missing, or the claim button. */
export function foundingView(st: FoundingStatusLike | null | undefined): 'hidden' | 'claimed' | 'missing' | 'claim' {
  if (!st || !st.listing) return 'hidden';
  if (st.claimed) return 'claimed';
  if (!st.open || st.used || !st.spots_left || st.spots_left <= 0) return 'hidden';
  return (st.missing ?? []).some((m) => FOUNDING_NEEDS[m]) ? 'missing' : 'claim';
}
/** The end date if it's still in the future, otherwise null (a free boost that already ended isn't mentioned). */
export const stillRunning = (iso?: string | null, now = Date.now()) => (iso && Date.parse(iso) > now ? iso : null);
