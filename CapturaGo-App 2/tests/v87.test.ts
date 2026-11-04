// v8.7 rules: shoot plan, new dates, problems, weather, trip planner, earnings CSV, share links, reports, QR card.
// They must match the website (dashboard.js / script.js / site.js), the server (booking-action.js) and database.sql Part 8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { type Booking } from '../src/lib/logic';
import {
  activeShares, briefProblem, canPlan, canPropose, cleanTime, csvCell, daySpan, disputeProblem, disputeReasons, earningsCsv, earningsOf,
  expiresIn, forecastLine, forecastUrl, lines, MAX_RESCHEDULES, meetingProblem, MEETING_TIME_RE, nextWeekend, offerWeatherMove,
  parseForecast, planTitle, proposalOf, qrCardSvg, REPORT_REASONS, reportProblem, reviewPhotosOf, searchKey, shareUrl, tripProblem, tripReason,
} from '../src/lib/plan-logic';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const day = (n: number) => new Date(NOW + n * 86400000).toISOString().slice(0, 10);
const bk = (over: Partial<Booking>): Booking => ({
  id: 'b1', photographer_id: 'p1', creator_user_id: 'c', client_user_id: 't', client_name: 'Tom Traveller', client_email: 't@x.com', package_name: 'Mini',
  shoot_date: day(5), price_cents: 10000, client_fee_cents: 1000, creator_fee_cents: 0, total_cents: 11000, status: 'confirmed', created_at: '2026-10-01T00:00:00Z',
  booking_type: 'session', photographers: { name: 'Ana Kovac', city: 'Kyoto, Japan', coords: { lat: 35, lon: 135.7 } }, ...over,
});
const WEB = '/home/claude/cg9';
const web = (f: string) => (existsSync(`${WEB}/${f}`) ? readFileSync(`${WEB}/${f}`, 'utf8') : '');

test('plan: sessions that are paid or confirmed only', () => {
  assert.equal(canPlan(bk({})), true);
  assert.equal(canPlan(bk({ status: 'paid' })), true);
  for (const st of ['pending_payment', 'delivered', 'completed', 'cancelled', 'disputed'] as const) assert.equal(canPlan(bk({ status: st })), false, st);
  assert.equal(canPlan(bk({ booking_type: 'delivery' })), false);
  assert.equal(planTitle(bk({ shoot_date: day(0) }), NOW), "Today's shoot");
  assert.equal(planTitle(bk({ shoot_date: day(1) }), NOW), "Tomorrow's shoot");
  assert.equal(planTitle(bk({ shoot_date: day(4) }), NOW), 'Shoot plan');
});

test('new date: who answers, when it can be proposed (same as the server)', () => {
  assert.deepEqual(proposalOf(bk({}), 't'), { kind: 'none' });
  const p = bk({ proposed_date: day(9), proposed_slot: 'golden_hour', proposed_by: 'c', proposed_reason: 'weather' });
  const mine = proposalOf(p, 'c'), theirs = proposalOf(p, 't');
  assert.equal(mine.kind, 'mine'); assert.equal(theirs.kind, 'theirs');
  assert.ok(theirs.kind === 'theirs' && theirs.weather && /Golden hour/.test(theirs.when));
  assert.equal(canPropose(bk({}), 't', NOW), true);
  assert.equal(canPropose(bk({ shoot_date: day(0) }), 't', NOW), true, 'still on the shoot day');
  assert.equal(canPropose(bk({ shoot_date: day(-1) }), 't', NOW), false, 'not after the shoot');
  assert.equal(canPropose(bk({ reschedules: MAX_RESCHEDULES }), 't', NOW), false);
  assert.equal(canPropose(p, 't', NOW), false, "the other side's proposal waits");
  assert.equal(canPropose(p, 'c', NOW), true, 'the proposer may replace their own');
  assert.equal(MAX_RESCHEDULES, Number((web('supabase/functions/_src/booking-action.js').match(/MAX_RESCHEDULES = (\d+)/) ?? [0, 3])[1]));
});

test('meeting point and time', () => {
  assert.equal(cleanTime('9:30'), '09:30'); assert.equal(cleanTime('0930'), '09:30'); assert.equal(cleanTime('18.05'), '18:05');
  assert.equal(cleanTime(''), ''); assert.equal(cleanTime('25:00'), null); assert.equal(cleanTime('noon'), null);
  assert.match(meetingProblem('', ''), /meeting point or a time/);
  assert.equal(meetingProblem('Yasaka Shrine', ''), ''); assert.equal(meetingProblem('', '07:15'), '');
  assert.match(meetingProblem('x', '7pm'), /HH:MM/);
  assert.ok(MEETING_TIME_RE.test('23:59') && !MEETING_TIME_RE.test('24:00'));
  const server = web('supabase/functions/_src/lib.js').match(/const MEETING_TIME_RE = (\/.+\/);/);
  if (server) assert.equal(server[1], String(MEETING_TIME_RE));
});

test('shot list and references', () => {
  assert.deepEqual(lines(' a \n\n b\n'), ['a', 'b']);
  assert.equal(briefProblem(['a'], ['https://pin.it/x']), '');
  assert.match(briefProblem(Array(21).fill('x'), []), /20/);
  assert.match(briefProblem([], Array(7).fill('https://a.b')), /6/);
  assert.match(briefProblem([], ['http://a.b']), /https/);
  assert.match(briefProblem(['x'.repeat(121)], []), /120/);
});

test('problems: "didn\'t show up" only from the shoot day, a description otherwise', () => {
  assert.deepEqual(disputeReasons(bk({ shoot_date: day(2) }), NOW).map((x) => x[0]), ['quality', 'other']);
  assert.deepEqual(disputeReasons(bk({ shoot_date: day(0) }), NOW).map((x) => x[0]), ['no_show', 'quality', 'other']);
  assert.deepEqual(disputeReasons(bk({ booking_type: 'delivery', shoot_date: day(-1) }), NOW).map((x) => x[0]), ['quality', 'other']);
  assert.equal(disputeProblem('no_show', ''), '');
  assert.match(disputeProblem('quality', 'bad'), /sentence/);
  assert.equal(disputeProblem('quality', 'Only 5 photos instead of 30.'), '');
});

test('weather: forecast window, parsing, bad days and the move offer', () => {
  const c = { lat: 35.0116, lon: 135.7681 };
  assert.match(forecastUrl(c, day(3), NOW)!, /latitude=35\.012&longitude=135\.768.*start_date=2026-10-17&end_date=2026-10-17/);
  assert.equal(forecastUrl(c, day(16), NOW), null);
  assert.equal(forecastUrl(c, day(-1), NOW), null);
  assert.equal(forecastUrl(null, day(1), NOW), null);
  assert.equal(forecastUrl({ lat: 95, lon: 0 }, day(1), NOW), null);
  const rain = parseForecast({ daily: { weather_code: [63], temperature_2m_max: [17.6], temperature_2m_min: [11.2], precipitation_probability_max: [90] } })!;
  assert.deepEqual(rain, { icon: '🌧️', text: 'Rain', max: 18, min: 11, rain: 90, bad: true });
  assert.equal(forecastLine(rain), '🌧️ Rain · 11–18°C · 90% chance of rain');
  const sun = parseForecast({ daily: { weather_code: [1], temperature_2m_max: [22], temperature_2m_min: [14], precipitation_probability_max: [null] } })!;
  assert.equal(sun.bad, false); assert.equal(sun.rain, null);
  assert.equal(parseForecast({ daily: { weather_code: [3], temperature_2m_max: [20], temperature_2m_min: [10], precipitation_probability_max: [75] } })!.bad, true, '≥70% rain');
  assert.equal(parseForecast({}), null); assert.equal(parseForecast(null), null);
  assert.equal(offerWeatherMove(bk({ shoot_date: day(3) }), 't', rain, NOW), true);
  assert.equal(offerWeatherMove(bk({ shoot_date: day(0) }), 't', rain, NOW), false, 'not on the day');
  assert.equal(offerWeatherMove(bk({ shoot_date: day(3) }), 't', sun, NOW), false);
  assert.equal(offerWeatherMove(bk({ shoot_date: day(3), proposed_date: day(6), proposed_by: 't' }), 't', rain, NOW), false);
  const site = web('site.js');
  if (site) for (const [code, icon, text] of [[63, '🌧️', 'Rain'], [95, '⛈️', 'Thunderstorm'], [45, '🌫️', 'Fog']] as const) assert.ok(site.includes(`[${code}, '${icon}', '${text}']`), `site.js weather ${code}`);
});

test('trip planner: dates and wording', () => {
  const now = new Date(2026, 9, 14, 10); // Wed 14 Oct 2026, local time
  assert.match(tripProblem(null, null, now), /Choose your dates/);
  assert.match(tripProblem('2026-10-14', null, now), /tomorrow/);
  assert.equal(tripProblem('2026-10-15', null, now), '');
  assert.match(tripProblem('2026-10-20', '2026-10-18', now), /before the start/);
  assert.match(tripProblem('2026-10-15', '2026-11-20', now), /31 days/);
  assert.equal(tripProblem('2026-10-15', '2026-11-14', now), '');
  assert.match(tripProblem('2027-12-01', null, now), /next year/);
  assert.equal(daySpan('2026-10-30', '2026-11-02'), 4);
  assert.deepEqual(nextWeekend(now), { from: '2026-10-17', to: '2026-10-18' });
  assert.deepEqual(nextWeekend(new Date(2026, 9, 17, 9)), { from: '2026-10-18', to: '2026-10-18' }, 'Saturday → Sunday only');
  assert.match(tripReason(1, '2026-10-15', { photographer_id: 'p', free_days: 1, first_free: '2026-10-15' }), /^Free on Thu,? 15 Oct$/);
  assert.match(tripReason(4, '2026-10-15', { photographer_id: 'p', free_days: 3, first_free: '2026-10-16' }), /^Free 3 of 4 days · from Fri,? 16 Oct$/);
});

test('earnings: year, on hold, via link, 12 months, CSV like the website', () => {
  const now = new Date(2026, 9, 14, 12);
  const list = [
    bk({ id: 'a', status: 'completed', completed_at: '2026-09-03T10:00:00Z', shoot_date: '2026-08-30', price_cents: 12000, creator_fee_cents: 0, via_link: true }),
    bk({ id: 'b', status: 'completed', completed_at: '2025-12-20T10:00:00Z', shoot_date: '2025-12-17', price_cents: 8000 }),
    bk({ id: 'c', status: 'confirmed', price_cents: 5000, via_link: true }),
    bk({ id: 'd', status: 'disputed', price_cents: 3000 }),
    bk({ id: 'e', status: 'refunded', price_cents: 9900, via_link: true }),
    bk({ id: 'x', creator_user_id: 'someone-else', status: 'completed', completed_at: '2026-09-01T00:00:00Z', price_cents: 99999 }),
  ];
  const e = earningsOf(list, 'c', now);
  assert.equal(e.paidThisYear, 12000);
  assert.equal(e.onHold, 8000); assert.equal(e.onHoldCount, 2);
  assert.equal(e.completed, 2); assert.equal(e.viaLink, 2);
  assert.equal(e.months.length, 12); assert.equal(e.months[11].key, '2026-10'); assert.equal(e.months[0].key, '2025-11');
  assert.equal(e.months.find((m) => m.key === '2026-09')!.cents, 12000);
  assert.equal(e.months.find((m) => m.key === '2025-12')!.cents, 8000);
  assert.deepEqual(e.years, ['2026', '2025']);
  const csv = earningsCsv(list, 'c', '2026');
  assert.ok(csv.startsWith('﻿Booking ID,Booked on,'));
  const rows = csv.split('\r\n');
  assert.equal(rows.length, 1 + 4, 'header + the 2026 bookings of this creator');
  assert.ok(rows[1].startsWith('a,2026-10-01,2026-08-30,Mini,In person,Tom,Completed,120.00,0.00,120.00,2026-09-03,yes'));
  assert.equal(earningsCsv(list, 'c', 'all').split('\r\n').length, 6);
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)"); assert.equal(csvCell('-5'), "'-5"); assert.equal(csvCell('a,b'), '"a,b"'); assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  const dash = web('dashboard.js');
  if (dash) assert.ok(dash.includes("['Booking ID', 'Booked on', 'Shoot / due date', 'Package', 'Type', 'Client', 'Status', 'Package price (EUR)', 'CapturaGo fee from you (EUR)', 'You receive (EUR)', 'Paid out on', 'Via your link']"), 'same CSV columns as the website');
});

test('share links: url, expiry wording, active only', () => {
  const tok = 'a'.repeat(64);
  assert.equal(shareUrl(tok), `https://capturago.com/share.html#t=${tok}`);
  assert.equal(expiresIn(new Date(NOW + 5 * 3600000).toISOString(), NOW), 'Expires in 5 h');
  assert.equal(expiresIn(new Date(NOW + 7 * 86400000).toISOString(), NOW), 'Expires in 7 days');
  assert.equal(expiresIn(new Date(NOW + 1 * 86400000 + 60000).toISOString(), NOW), 'Expires in 1 day');
  assert.equal(expiresIn(new Date(NOW - 1000).toISOString(), NOW), 'Expired');
  const mk = (h: number) => ({ token: String(h), expires_at: new Date(NOW + h * 3600000).toISOString(), favorites_only: false, views: 0, created_at: '' });
  assert.deepEqual(activeShares([mk(2), mk(-1), mk(48)], NOW).map((x) => x.token), ['2', '48']);
});

test('reports, review photos, search keys', () => {
  assert.deepEqual(REPORT_REASONS.map((x) => x[0]), ['fake', 'stolen_photos', 'inappropriate', 'scam', 'other']);
  const sql = web('database.sql');
  if (sql) assert.ok(sql.includes("p_reason NOT IN ('fake', 'stolen_photos', 'inappropriate', 'scam', 'other')"), 'same reasons as the database');
  assert.match(reportProblem('', ''), /choose/);
  assert.equal(reportProblem('scam', ''), '');
  assert.match(reportProblem('other', 'x'.repeat(1001)), /1000/);
  assert.deepEqual(reviewPhotosOf({ photos: ['https://a/1.jpg', 'http://b', 3, 'https://a/2.jpg', 'https://a/3.jpg', 'https://a/4.jpg'] }), ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg']);
  assert.deepEqual(reviewPhotosOf({}), []);
  assert.equal(searchKey(' Kyoto ', 'photo', 0), 'kyoto|photo|true');
  assert.notEqual(searchKey('Kyoto', '', 3), searchKey('Kyoto', '', 0));
});

test('printable QR card: valid SVG, escaped text, link shown', () => {
  const svg = qrCardSvg('https://capturago.com/c/ana-kyoto', 'Ana <Kovac> & Co', 'Kyoto, Japan');
  assert.ok(svg.startsWith('<?xml') && svg.trim().endsWith('</svg>'));
  assert.ok(svg.includes('Ana &lt;Kovac&gt; &amp; Co'));
  assert.ok(svg.includes('Photo shoots in Kyoto'));
  assert.ok(svg.includes('capturago.com/c/ana-kyoto'));
  assert.ok((svg.match(/h[\d.]+v[\d.]+h-[\d.]+z/g) ?? []).length > 100, 'QR modules drawn');
});
