import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  bookingButtons, bookingHint, canBook, clientFilter, daysUntil, fees, friendlyAuthError, fromPrice, httpsUrl, isEmail,
  isIsoDate, isoInDays, localMatch, needsAction, packagesOf, pkgMeta, sponsoredFirst, statusText, verifiedLabel,
  type Booking, type Listing,
} from '../src/lib/logic';
import { occasions, services, vibes } from '../src/lib/taxonomy-data';
import { EXAMPLES } from '../src/lib/examples';
import { WEB_DIR } from './web';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const day = (n: number) => isoInDays(n, NOW);
const L = (o: Partial<Listing>): Listing => ({ id: o.id ?? 'x', name: 'Alice Novak', city: 'Kyoto, Japan', ...o });
const B = (o: Partial<Booking>): Booking => ({
  id: 'b1', photographer_id: 'p', creator_user_id: 'C', client_user_id: 'T', client_name: 'Tom', client_email: 't@t.com',
  package_name: 'Pkg', shoot_date: day(10), price_cents: 12000, client_fee_cents: 1200, creator_fee_cents: 0, total_cents: 13200,
  status: 'paid', created_at: '2026-10-01T00:00:00Z', ...o,
});
const actions = (b: Booking, creator: boolean) => bookingButtons(b, creator, NOW).map((x) => x.action);

test('categories are identical to the website taxonomy.js', { skip: !existsSync(process.env.WEBSITE_TAXONOMY ?? `${WEB_DIR}/taxonomy.js`) }, () => {
  const web = readFileSync(process.env.WEBSITE_TAXONOMY ?? `${WEB_DIR}/taxonomy.js`, 'utf8');
  const ids = (name: string) => {
    const i = web.indexOf(`const ${name} = [`); const block = web.slice(i, web.indexOf('];', i));
    return [...block.matchAll(/\{ id: '([a-z_]+)'/g)].map((m) => m[1]);
  };
  assert.deepEqual(services.map((s) => s.id), ids('services'));
  assert.deepEqual(vibes.map((v) => v.id), ids('vibes'));
  assert.deepEqual(occasions.map((o) => o.id), ids('occasions'));
  assert.equal(services.length, 11); assert.equal(vibes.length, 12); assert.equal(occasions.length, 12);
});

test('example profiles only use real categories and show bookable-looking packages', () => {
  const S = new Set(services.map((s) => s.id)), V = new Set(vibes.map((v) => v.id)), O = new Set(occasions.map((o) => o.id));
  assert.equal(EXAMPLES.length, 6);
  for (const e of EXAMPLES) {
    assert.ok(e.isExample && e.id.startsWith('ex-'), e.id);
    (e.services ?? []).forEach((x) => assert.ok(S.has(x), `${e.id} service ${x}`));
    (e.vibes ?? []).forEach((x) => assert.ok(V.has(x), `${e.id} vibe ${x}`));
    (e.occasions ?? []).forEach((x) => assert.ok(O.has(x), `${e.id} occasion ${x}`));
    assert.equal(canBook(e), false, 'examples are never bookable');
    if (e.packages?.length) assert.equal(packagesOf(e).length, e.packages.length, `${e.id} packages valid`);
  }
});

test('fees match the server exactly (10%, rounded in cents)', () => {
  assert.deepEqual(fees(120, 10), { priceCents: 12000, feeCents: 1200, totalCents: 13200 });
  assert.deepEqual(fees(70, 10), { priceCents: 7000, feeCents: 700, totalCents: 7700 });
  assert.deepEqual(fees(99.99, 10), { priceCents: 9999, feeCents: 1000, totalCents: 10999 });
  assert.deepEqual(fees(10.05, 10), { priceCents: 1005, feeCents: 101, totalCents: 1106 });
});

test('packages: invalid prices / turnaround are hidden, "from" price and meta text', () => {
  const l = L({ packages: [
    { id: 'a', name: 'Ok', price_eur: 120, minutes: 60, desc: '30 photos' },
    { id: 'b', name: 'Too cheap', price_eur: 5 },
    { id: 'c', name: 'Remote', type: 'delivery', price_eur: 70, delivery_days: 3, revisions: 2 },
    { id: 'd', name: 'Bad turnaround', type: 'delivery', price_eur: 50, delivery_days: 0 },
    { id: 'e', name: 'Too pricey', price_eur: 9000 },
  ] });
  assert.deepEqual(packagesOf(l).map((k) => k.id), ['a', 'c']);
  assert.equal(fromPrice(l), 70);
  assert.equal(pkgMeta(packagesOf(l)[0]), '60 min · 30 photos');
  assert.equal(pkgMeta(packagesOf(l)[1]), 'Remote · delivered in 3 days · 2 revisions');
  assert.equal(fromPrice(L({})), null);
});

test('canBook needs payouts + a valid package, never examples', () => {
  const pk = [{ id: 'a', name: 'Ok', price_eur: 100 }];
  assert.equal(canBook(L({ payouts_enabled: true, packages: pk })), true);
  assert.equal(canBook(L({ payouts_enabled: false, packages: pk })), false);
  assert.equal(canBook(L({ payouts_enabled: true, packages: [] })), false);
  assert.equal(canBook(L({ payouts_enabled: true, packages: pk, isExample: true })), false);
});

test('filters: remote, occasion, availability; sponsored first and otherwise stable', () => {
  const list = [
    L({ id: '1', services: ['photo'], occasions: ['proposal'] }),
    L({ id: '2', services: ['video_edit'], available: false }),
    L({ id: '3', services: ['clip', 'photo'], boosted_until: '2026-12-01T00:00:00Z' }),
    L({ id: '4', services: ['photo'], boosted_until: '2026-01-01T00:00:00Z' }),
  ];
  assert.deepEqual(clientFilter(list, { type: 'remote' }).map((l) => l.id), ['2', '3']);
  assert.deepEqual(clientFilter(list, { type: 'photo' }).map((l) => l.id), ['1', '3', '4']);
  assert.deepEqual(clientFilter(list, { occasion: 'proposal' }).map((l) => l.id), ['1']);
  assert.deepEqual(clientFilter(list, { availableOnly: true }).map((l) => l.id), ['1', '3', '4']);
  assert.deepEqual(sponsoredFirst(list, NOW).map((l) => l.id), ['3', '1', '2', '4'], 'expired boost is not sponsored');
});

test('keyword matcher (AI fallback)', () => {
  const list = [
    L({ id: 'k', city: 'Kyoto, Japan', services: ['photo'], vibes: ['moody'] }),
    L({ id: 'p', city: 'Prague, Czechia', services: ['video_edit', 'clip'] }),
    L({ id: 't', city: 'Bali, Indonesia', services: ['photo'], travel_available: true }),
    L({ id: 'off', city: 'Kyoto, Japan', services: ['photo'], available: false }),
  ];
  assert.deepEqual(localMatch('Moody portraits in Kyoto', list), [{ id: 'k', reason: 'Based in Kyoto, Japan' }]);
  assert.deepEqual(localMatch('Edit my trip footage into a reel', list), [{ id: 'p', reason: 'Remote · Video editing' }]);
  assert.deepEqual(localMatch('Photographer for my trip to Lisbon', list).map((m) => m.id), ['t']);
  assert.deepEqual(localMatch('Something in Atlantis', list), []);
});

test('booking buttons — in-person shoot, traveller side', () => {
  assert.deepEqual(actions(B({ status: 'pending_payment' }), false), ['cancel']);
  assert.deepEqual(actions(B({ status: 'paid' }), false), ['cancel']);
  assert.deepEqual(actions(B({ status: 'confirmed', shoot_date: day(7) }), false), ['cancel'], 'free cancel ≥ 7 days');
  assert.deepEqual(actions(B({ status: 'confirmed', shoot_date: day(6) }), false), [], 'no free cancel < 7 days');
  assert.deepEqual(actions(B({ status: 'confirmed', shoot_date: day(0) }), false), ['complete', 'dispute']);
  assert.deepEqual(actions(B({ status: 'confirmed', shoot_date: day(-3) }), false), ['complete', 'dispute']);
  assert.deepEqual(actions(B({ status: 'confirmed', shoot_date: day(-4) }), false), ['complete'], 'dispute window closed');
  assert.deepEqual(actions(B({ status: 'completed' }), false), []);
});

test('booking buttons — in-person shoot, creator side', () => {
  assert.deepEqual(actions(B({ status: 'paid' }), true), ['confirm', 'decline']);
  assert.deepEqual(actions(B({ status: 'confirmed', shoot_date: day(2) }), true), ['decline']);
  assert.deepEqual(actions(B({ status: 'confirmed', shoot_date: day(-2) }), true), [], 'client protection window');
  assert.deepEqual(actions(B({ status: 'confirmed', shoot_date: day(-3) }), true), ['complete']);
  assert.deepEqual(actions(B({ status: 'disputed' }), true), []);
});

test('booking buttons — remote delivery', () => {
  const R = (o: Partial<Booking>) => B({ booking_type: 'delivery', revisions_allowed: 2, revisions_used: 0, ...o });
  const hoursAgo = (h: number) => new Date(NOW - h * 3600000).toISOString();
  assert.deepEqual(actions(R({ status: 'paid' }), true), ['confirm', 'decline']);
  assert.deepEqual(actions(R({ status: 'confirmed' }), true), ['deliver', 'decline']);
  assert.deepEqual(actions(R({ status: 'delivered', delivered_at: hoursAgo(10) }), true), []);
  assert.deepEqual(actions(R({ status: 'delivered', delivered_at: hoursAgo(73) }), true), ['complete']);
  assert.deepEqual(actions(R({ status: 'confirmed', shoot_date: day(2) }), false), ['dispute'], 'cannot cancel while in progress');
  assert.deepEqual(actions(R({ status: 'confirmed', shoot_date: day(-1) }), false), ['cancel', 'dispute'], 'late → cancel');
  const del = bookingButtons(R({ status: 'delivered', delivered_at: hoursAgo(10) }), false, NOW);
  assert.deepEqual(del.map((x) => x.action), ['complete', 'revise', 'dispute']);
  assert.equal(del[1].label, 'Request a revision (2 left)');
  assert.deepEqual(actions(R({ status: 'delivered', revisions_used: 2, delivered_at: hoursAgo(80) }), false), ['complete'], 'no revisions left, dispute window closed');
  assert.equal(statusText(R({ status: 'confirmed' })), 'Accepted — in progress');
  assert.equal(statusText(R({ status: 'paid' })), 'Paid — awaiting acceptance');
  assert.match(bookingHint(R({ status: 'confirmed', revisions_used: 1, last_revision_note: 'Shorter intro' }), true, NOW), /Shorter intro/);
});

test('needs-action badge counts new paid bookings (creator) and deliveries to approve (client)', () => {
  const list = [B({ status: 'paid' }), B({ id: 'b2', status: 'delivered', booking_type: 'delivery' }), B({ id: 'b3', status: 'confirmed' })];
  assert.equal(needsAction(list, 'C'), 1);
  assert.equal(needsAction(list, 'T'), 1);
  assert.equal(needsAction(list, 'nobody'), 0);
});

test('dates use UTC day boundaries like the server', () => {
  assert.equal(daysUntil(day(0), NOW), 0);
  assert.equal(daysUntil(day(7), NOW), 7);
  assert.equal(daysUntil(day(-3), NOW), -3);
  assert.equal(isIsoDate('2026-02-28'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026-2-3'), false);
});

test('validation helpers', () => {
  assert.equal(httpsUrl('https://drive.google.com/x'), 'https://drive.google.com/x');
  assert.equal(httpsUrl('http://insecure.com'), null);
  assert.equal(httpsUrl('javascript:alert(1)'), null);
  assert.equal(httpsUrl('https://' + 'a'.repeat(600)), null);
  assert.equal(isEmail('a@b.co'), true);
  assert.equal(isEmail('nope'), false);
  assert.equal(friendlyAuthError('Invalid login credentials'), 'Wrong email or password.');
  assert.equal(friendlyAuthError('Email not confirmed'), 'Please confirm your email first — check your inbox (and spam folder).');
  assert.equal(verifiedLabel(2), '✓✓ Portfolio reviewed');
  assert.equal(verifiedLabel(0), '');
  assert.equal(verifiedLabel(9), '✓✓✓ ID verified');
});
