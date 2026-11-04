// v8.14 rules in the app: fast responders ranked higher, clients' favourite shots, "Notify me" on fully booked
// creators, last-minute deals with "Surprise me". They must match the website (site.js, script.js, gift.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { replyLabel, replyRank } from '../src/lib/reply-logic';
import { sponsoredFirst, type Listing } from '../src/lib/logic';
import { canWatch, clientShots, coverOf, dealRows, dealsIn, isFullyBooked, nextDays, pickSurprise, watchStatus } from '../src/lib/watch-logic';
import { WEB_DIR } from './web';

const SITE = `${WEB_DIR}/site.js`;
const W: Record<string, (...a: unknown[]) => unknown> | null = (() => {
  if (!existsSync(SITE)) return null;
  const win: Record<string, unknown> = { CG_CONFIG: { social: {} } };
  const ctx = { window: win, document: { addEventListener() {}, getElementById: () => null }, navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, URL, Date, Math, JSON, console, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(SITE, 'utf8'), ctx);
  return win as Record<string, (...a: unknown[]) => unknown>;
})();
const NOW = Date.parse('2026-11-04T10:00:00Z');
const L = (o: Partial<Listing>): Listing => ({ id: 'x', user_id: 'u', name: 'Ana Novak', city: 'Vienna, Austria', created_at: '2026-01-01T00:00:00Z', payouts_enabled: true, available: true,
  packages: [{ id: 'k1', name: 'Portraits', price_eur: 120 }, { id: 'k2', name: 'Mini', price_eur: 90 }, { id: 'r', name: 'Edit', price_eur: 30, type: 'delivery', delivery_days: 3 }], ...o } as Listing);

test('reply rank: same bands as the badge (3+ answers, slow = 0)', () => {
  const cases: [number | null, number, number][] = [[25, 5, 3], [60, 3, 3], [61, 3, 2], [180, 4, 2], [181, 4, 1], [1440, 3, 1], [1441, 9, 0], [10, 2, 0], [null, 5, 0], [0, 5, 0]];
  for (const [m, n, want] of cases) {
    assert.equal(replyRank({ reply_minutes: m, reply_samples: n }), want, `${m}/${n}`);
    assert.equal(replyRank({ reply_minutes: m, reply_samples: n }) > 0, replyLabel({ reply_minutes: m, reply_samples: n }) !== '', 'rank and badge agree');
  }
  assert.equal(replyRank(null), 0);
});
test('reply rank: same as the website', { skip: !W && 'website not next to the app' }, () => {
  for (const [m, n] of [[25, 5], [60, 3], [61, 3], [181, 4], [1441, 9], [10, 2], [null, 5]] as const) assert.equal(W!.replyRank({ reply_minutes: m, reply_samples: n }), replyRank({ reply_minutes: m, reply_samples: n }));
});
test('ranking: boosted first, then fast responders, otherwise the server order (newest first)', () => {
  const list = [
    L({ id: 'newest' }), L({ id: 'fast', reply_minutes: 20, reply_samples: 5 }), L({ id: 'boost', boosted_until: '2030-01-01T00:00:00Z' }),
    L({ id: 'day', reply_minutes: 600, reply_samples: 4 }), L({ id: 'few', reply_minutes: 120, reply_samples: 4 }), L({ id: 'old' }),
  ];
  assert.deepEqual(sponsoredFirst(list, NOW).map((l) => l.id), ['boost', 'fast', 'few', 'day', 'newest', 'old']);
});

test("clients' favourite shots: the first photo of each review, https only, up to 8", () => {
  const rv = (id: string, photos: string[] | null) => ({ id, photos, rating: 5, reviewer_name: 'A' });
  const out = clientShots([rv('a', ['https://x/a1.jpg', 'https://x/a2.jpg']), rv('b', []), rv('c', null), rv('d', ['javascript:alert(1)']), rv('e', ['https://x/e.jpg'])]);
  assert.deepEqual(out.map((x) => [x.review.id, x.url]), [['a', 'https://x/a1.jpg'], ['e', 'https://x/e.jpg']]);
  assert.equal(clientShots(Array.from({ length: 12 }, (_, i) => rv(String(i), [`https://x/${i}.jpg`]))).length, 8);
});

test('notify me: shown for online-bookable creators (also when paused), never for my own or examples', () => {
  assert.equal(canWatch(L({}), 'me'), true);
  assert.equal(canWatch(L({ available: false }), 'me'), true);
  assert.equal(canWatch(L({ user_id: 'me' }), 'me'), false);
  assert.equal(canWatch(L({ payouts_enabled: false }), 'me'), false);
  assert.equal(canWatch(L({ isExample: true }), 'me'), false);
  assert.equal(canWatch(null, 'me'), false);
});
test('notify me: fully booked = no free day in the next 14 days, no deal; paused counts', () => {
  const days = nextDays(14, NOW);
  assert.equal(days.length, 14);
  assert.ok(days[0] > new Date(NOW).toISOString().slice(0, 10), 'starts tomorrow');
  assert.equal(isFullyBooked(L({}), days, false, NOW), true);
  assert.equal(isFullyBooked(L({}), days.slice(1), false, NOW), false, 'one free day → not full');
  assert.equal(isFullyBooked(L({}), days, true, NOW), false, 'a deal means a free day');
  assert.equal(isFullyBooked(L({ available: false }), [], false, NOW), true);
  assert.equal(watchStatus({ notified_at: null, notified_reason: null }), 'Waiting');
  assert.equal(watchStatus({ notified_at: 'x', notified_reason: 'deal' }), '✓ We told you about a deal');
  assert.equal(watchStatus({ notified_at: 'x', notified_reason: 'free' }), '✓ We told you about a free day');
});

test('deals: cheapest in-person package at the deal price + 10% fee (as the checkout), sorted by day then discount', () => {
  const ana = L({ id: 'ana' }), bo = L({ id: 'bo', city: 'Lisbon, Portugal', packages: [{ id: 'p', name: 'Walk', price_eur: 200 }] });
  const rows = dealRows([{ photographer_id: 'bo', day: '2026-11-06', pct: 30 }, { photographer_id: 'ana', day: '2026-11-05', pct: 20 }, { photographer_id: 'ana', day: '2026-11-06', pct: 40 },
    { photographer_id: 'gone', day: '2026-11-05', pct: 20 }, { photographer_id: 'ana', day: '2026-11-05', pct: 70 }], [ana, bo], 10);
  assert.deepEqual(rows.map((r) => [r.listing.id, r.day, r.pct]), [['ana', '2026-11-05', 20], ['ana', '2026-11-06', 40], ['bo', '2026-11-06', 30]]);
  assert.equal(rows[0].pkgName, 'Mini');
  assert.equal(rows[0].wasCents, 9000);
  assert.equal(rows[0].priceCents, 7200);
  assert.equal(rows[0].totalCents, 7920);
  assert.equal(rows[2].city, 'Lisbon');
  assert.deepEqual(dealRows([{ photographer_id: 'x', day: '2026-11-05', pct: 20 }], [L({ id: 'x', available: false })]), [], 'paused creators have no deal');
  assert.deepEqual(dealRows([{ photographer_id: 'x', day: '2026-11-05', pct: 20 }], [L({ id: 'x', payouts_enabled: false })]), []);
  assert.deepEqual(dealsIn(rows, 'lisbon').map((r) => r.listing.id), ['bo']);
  assert.equal(dealsIn(rows, '').length, 3);
});
test('deals: same price as the website (site.js dealCents)', { skip: !W && 'website not next to the app' }, () => {
  const rows = dealRows([{ photographer_id: 'a', day: '2026-11-05', pct: 25 }], [L({ id: 'a', packages: [{ id: 'k', name: 'P', price_eur: 99.99 }] })], 10);
  assert.equal(rows[0].priceCents, W!.dealCents(99.99, 25));
});
test('surprise me: prefers deals the card fully covers, otherwise any; what the card covers', () => {
  const rows = dealRows([{ photographer_id: 'a', day: '2026-11-05', pct: 20 }, { photographer_id: 'b', day: '2026-11-05', pct: 10 }],
    [L({ id: 'a' }), L({ id: 'b', packages: [{ id: 'k', name: 'Big', price_eur: 500 }] })], 10);
  for (let i = 0; i < 20; i++) assert.equal(pickSurprise(rows, 8000, () => i / 20)?.listing.id, 'a', 'only a fits in €80');
  assert.equal(pickSurprise(rows, 100, () => 0.99)?.listing.id, 'b', 'nothing covered → any deal');
  assert.equal(pickSurprise(rows, null, () => 0)?.listing.id, 'a');
  assert.equal(pickSurprise([], 5000), null);
  assert.deepEqual(coverOf(rows[0], 5000), { covered: false, fromCard: 5000, toPay: 2920 });
  assert.deepEqual(coverOf(rows[0], 10000), { covered: true, fromCard: 7920, toPay: 0 });
  assert.equal(coverOf(rows[0], null), null);
});
