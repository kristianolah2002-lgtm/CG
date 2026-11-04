// v8.11 rules: trips (creators on the road), payment held until the photos arrive, calendar sync.
// The app must behave exactly like the website (site.js is loaded and compared) and the database (Part 12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as T from '../src/lib/trip-logic';
import { bookingButtons, bookingHint, type Booking } from '../src/lib/logic';
import { disputeProblem, disputeReasons } from '../src/lib/plan-logic';
import { WEB_DIR } from './web';

const SITE = `${WEB_DIR}/site.js`;
// The website's helpers, run as-is in a sandbox
const W: Record<string, (...a: unknown[]) => unknown> | null = (() => {
  if (!existsSync(SITE)) return null;
  const win: Record<string, unknown> = { CG_CONFIG: { social: {} } };
  const ctx = { window: win, document: { addEventListener() {}, getElementById: () => null }, navigator: {}, localStorage: { getItem: () => null, setItem() {} }, URL, Date, Math, JSON, console, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(SITE, 'utf8'), ctx);
  return win as Record<string, (...a: unknown[]) => unknown>;
})();
const day = (n: number) => T.isoLocal(new Date(Date.now() + n * 86400000));
const trip = (city: string, f: number, t: number, extra = {}) => ({ city, from: day(f), to: day(t), ...extra });

test('trips: dates, matching and the trip on a day', () => {
  if (existsSync(SITE)) assert.ok(W && typeof W.tripsProblem === 'function' && typeof W.payoutNote === 'function', 'the website helpers loaded for comparison');
  assert.equal(T.tripDates({ city: 'x', from: '2026-11-03', to: '2026-11-10' }), '3–10 Nov');
  assert.equal(T.tripDates({ city: 'x', from: '2026-11-28', to: '2026-12-02' }), '28 Nov – 2 Dec');
  assert.equal(T.tripDates({ city: 'x', from: '2026-12-30', to: '2027-01-02' }), '30 Dec – 2 Jan');
  assert.equal(T.tripDates({ city: 'x', from: '2026-11-03', to: '2026-11-03' }), '3 Nov');
  const lis = trip('Lisbon, Portugal', 10, 16);
  for (const q of ['Lisbon', 'lisbon', ' LISBON ', 'Lisb', 'lisbon, portugal']) assert.equal(T.tripMatches(lis, q), true, q);
  for (const q of ['', 'L', 'Porto', 'Paris']) assert.equal(T.tripMatches(lis, q), false, q);
  assert.equal(T.tripMatches({ city: 'Kraków, Poland', from: '', to: '' }, 'krakow'), true, 'accents');
  const trips = [trip('Porto', 20, 22), lis, trip('Old', -9, -2)];
  assert.deepEqual(T.upcomingTrips(trips).map((t) => t.city), ['Lisbon, Portugal', 'Porto'], 'soonest first, past dropped');
  assert.equal(T.tripOn(trips, day(12))?.city, 'Lisbon, Portugal');
  assert.equal(T.tripOn(trips, day(17)), null);
  assert.equal(T.tripOn(null, day(1)), null);
  assert.deepEqual(T.keptTrips([trip('A', -5, -2), trip('B', -3, -1), trip('C', 2, 3)]).map((t) => t.city), ['B', 'C'], 'yesterday\'s trip is kept when saving');
  assert.deepEqual(T.cleanTrip({ city: 'A', from: 'x', to: 'y', lat: 1, lon: 2, extra: 1 } as unknown as Parameters<typeof T.cleanTrip>[0]), { city: 'A', from: 'x', to: 'y', lat: 1, lon: 2 });
  assert.deepEqual(T.cleanTrip({ city: 'A', from: 'x', to: 'y', lat: 1 }), { city: 'A', from: 'x', to: 'y' }, 'half a position is dropped');
});

test('trips: the same problems as the database (and the website)', () => {
  const cases: [string, ReturnType<typeof trip>[] | unknown, RegExp | ''][] = [
    ['ok', [trip('Lisbon', 10, 16), trip('Porto', 20, 22)], ''],
    ['11 trips', Array.from({ length: 11 }, (_, i) => trip('X', 30 + i * 3, 31 + i * 3)), /Up to 10/],
    ['overlap', [trip('Lisbon', 10, 16), trip('Porto', 16, 18)], /Lisbon and Porto overlap/],
    ['backwards', [trip('Lisbon', 10, 8)], /before the first day/],
    ['62 days', [trip('Lisbon', 10, 71)], /up to 61 days/],
    ['61 days ok', [trip('Lisbon', 10, 70)], ''],
    ['bad date', [{ city: 'Lisbon', from: '2027-02-30', to: '2027-03-01' }], /first and last day/],
    ['no city', [trip(' L ', 10, 12)], /city of your trip/],
    ['markup', [trip('<b>Lisbon', 10, 12)], /characters/],
  ];
  for (const [label, list, re] of cases) {
    const got = T.tripsProblem(list as Parameters<typeof T.tripsProblem>[0]);
    if (re) assert.match(got, re, label); else assert.equal(got, '', label);
    if (W) assert.equal(Boolean(W.tripsProblem(list)), Boolean(got), `website agrees: ${label}`);
  }
  if (W) for (const t of [{ city: 'x', from: '2026-11-28', to: '2026-12-02' }, { city: 'x', from: '2026-11-03', to: '2026-11-10' }]) assert.equal(W.tripDates(t), T.tripDates(t));
});

const bk = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', photographer_id: 'p', creator_user_id: 'c', client_user_id: 'u', client_name: 'Tom', client_email: 't@t', package_name: 'Mini', shoot_date: day(-10),
  price_cents: 12000, client_fee_cents: 1200, creator_fee_cents: 0, total_cents: 13200, status: 'confirmed', booking_type: 'session', created_at: '', currency: 'eur',
  package_details: { edit_days: 5 }, photos_promised: true, photos_delivered_at: null, photographers: { name: 'Ana Kovac', city: 'Kyoto' }, ...over,
} as unknown as Booking);

test('payment held until the photos arrive: buttons, notes and late reports', () => {
  const waiting = bk();
  assert.ok(!bookingButtons(waiting, true).some((x) => x.action === 'complete'), 'creator can\'t release before sending the photos');
  assert.ok(bookingButtons(waiting, false).some((x) => x.action === 'dispute'), 'traveller can report 10 days after the shoot while waiting');
  assert.ok(bookingButtons(waiting, false).some((x) => x.action === 'complete'), 'traveller may still release it themselves');
  assert.equal(bookingHint(bk({ shoot_date: day(1) }), true), '', 'no "released 3 days after the shoot" hint for held bookings');
  assert.match(T.payoutNote(waiting, false), /^🔒 Your payment stays on hold until your photos arrive \(promised by/);
  assert.match(T.payoutNote(waiting, true), /^💶 Paid out 3 days after you send the photos/);
  assert.equal(T.canReportLate(waiting), true);
  assert.equal(disputeReasons(waiting)[0][0], 'photos_late');
  assert.equal(disputeProblem('photos_late', ''), '', 'no message needed for late photos');
  assert.equal(T.canReportLate(bk({ shoot_date: day(-2) })), false, 'not before the promised day');

  const sent = bk({ photos_delivered_at: new Date(Date.now() - 86400000).toISOString() });
  assert.match(T.payoutNote(sent, false), /Photos received\. The payment goes to Ana on .+ unless you report a problem\./);
  assert.ok(!bookingButtons(sent, true).some((x) => x.action === 'complete'), 'still 2 days to go');
  assert.ok(bookingButtons(sent, false).some((x) => x.action === 'dispute'));
  assert.ok(!disputeReasons(sent).some(([k]) => k === 'photos_late'), 'photos were sent');

  const old = bk({ photos_delivered_at: new Date(Date.now() - 4 * 86400000).toISOString() });
  assert.ok(bookingButtons(old, true).some((x) => x.action === 'complete'), 'creator can release 3 days after sending');
  assert.ok(!bookingButtons(old, false).some((x) => x.action === 'dispute'), 'report window closed');

  const plain = bk({ package_details: null, photos_promised: false });
  assert.equal(T.payoutNote(plain, false), '');
  assert.ok(bookingButtons(plain, true).some((x) => x.action === 'complete'), 'old packages: 3 days after the shoot as before');
  assert.ok(!bookingButtons(plain, false).some((x) => x.action === 'dispute'), 'old packages: report window 3 days');
  assert.equal(T.photosPromised(bk({ photos_promised: undefined })), true, 'works before the database update (from the package)');
  assert.equal(T.photosPromised(bk({ booking_type: 'delivery' })), false);

  if (W) for (const [b, asCreator] of [[waiting, false], [waiting, true], [sent, false], [sent, true], [plain, false]] as const) {
    assert.equal(W.payoutNote(b, asCreator), T.payoutNote(b, asCreator), 'same words as the website');
  }
});

test('calendar links: only well-known calendar providers (same as the server and database)', () => {
  const ok = ['https://calendar.google.com/calendar/ical/x%40gmail.com/private-abc/basic.ics', 'webcal://p52-caldav.icloud.com/published/2/MTIz', 'https://outlook.office365.com/owa/calendar/abc/reachcalendar.ics', 'https://calendar.proton.me/api/calendar/v1/url/abc/calendar.ics?CacheKey=1'];
  const bad = ['http://calendar.google.com/calendar/ical/x/basic.ics', 'https://evil.com/calendar.google.com/x.ics', 'https://calendar.google.com.evil.com/x.ics', 'https://user@calendar.google.com/x/basic.ics',
    'https://calendar.google.com:8443/x/basic.ics', 'https://169.254.169.254/latest/meta-data/x', 'javascript:alert(1)//calendar.google.com', 'https://calendar.google.com/x y.ics', 'https://evil-icloud.com/abc/def/ghi'];
  for (const u of ok) { assert.equal(T.calendarUrlOk(u), true, u); if (W) assert.equal(W.calendarUrlOk(u), true, `website: ${u}`); }
  for (const u of bad) { assert.equal(T.calendarUrlOk(u), false, u); if (W) assert.equal(W.calendarUrlOk(u), false, `website: ${u}`); }
  const db = readFileSync(`${WEB_DIR}/database.sql`, 'utf8');
  for (const host of ['calendar\\.google\\.com', 'icloud\\.com', 'outlook\\.live\\.com', 'outlook\\.office365\\.com', 'outlook\\.office\\.com', 'calendar\\.proton\\.me', 'user\\.fm']) assert.ok(db.includes(host), `database allows ${host}`);
  assert.equal(T.webcalUrl('https://x.supabase.co/functions/v1/calendar?t=1'), 'webcal://x.supabase.co/functions/v1/calendar?t=1');
  assert.equal(T.googleSubscribeUrl('https://x.co/c?t=1'), 'https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fx.co%2Fc%3Ft%3D1');
  const now = Date.parse('2026-10-31T12:00:00Z');
  assert.equal(T.syncedAgo(null, now), 'reading soon');
  assert.equal(T.syncedAgo('2026-10-31T11:59:40Z', now), 'read just now');
  assert.equal(T.syncedAgo('2026-10-31T11:20:00Z', now), 'read 40 min ago');
  assert.equal(T.syncedAgo('2026-10-31T09:00:00Z', now), 'read 3 h ago');
});
