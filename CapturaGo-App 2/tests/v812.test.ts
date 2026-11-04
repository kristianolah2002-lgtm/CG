// v8.12 rules: gift cards and split payments. The app must match the website (site.js, compared below)
// and the server (reserve_gift in the database; create-checkout's shares).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as G from '../src/lib/gift-logic';
import { euroCents, statusText, type Booking } from '../src/lib/logic';

const SITE = `${WEB_DIR}/site.js`;
const W: Record<string, (...a: unknown[]) => unknown> | null = (() => {
  if (!existsSync(SITE)) return null;
  const win: Record<string, unknown> = { CG_CONFIG: { social: {} } };
  const ctx = { window: win, document: { addEventListener() {}, getElementById: () => null }, navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, URL, Date, Math, JSON, console, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(SITE, 'utf8'), ctx);
  return win as Record<string, (...a: unknown[]) => unknown>;
})();
const bk = (x: Partial<Booking>): Booking => ({ id: 'b', photographer_id: 'p', creator_user_id: 'c', client_user_id: 't', client_name: 'Tom', client_email: 't@x', package_name: 'Mini', shoot_date: '2026-12-01',
  price_cents: 12000, client_fee_cents: 1200, creator_fee_cents: 0, total_cents: 13200, status: 'paid', created_at: '2026-10-01T00:00:00Z', ...x } as Booking);

test('gift card: how much it pays (same as reserve_gift in the database)', () => {
  assert.equal(G.giftCover(13200, 15000), 13200);   // covers everything
  assert.equal(G.giftCover(9900, 1800), 1800);      // part; the rest by card
  assert.equal(G.giftCover(4020, 4000), 3970);      // never leaves less than €0.50 to pay by card
  assert.equal(G.giftCover(4050, 4000), 4000);      // exactly €0.50 left is fine
  assert.equal(G.giftCover(0, 5000), 0);
  assert.equal(G.giftCover(5000, 0), 0);
  assert.equal(G.giftCover(30, 20), 0);             // can't leave €0.50 → nothing used
  for (const [t, g] of [[13200, 15000], [9900, 1800], [4020, 4000], [4050, 4000], [100, 70], [30, 20], [99999, 12345]]) {
    if (W) assert.equal(W.giftCover(t, g), G.giftCover(t, g), `website differs for ${t}/${g}`);
  }
});

test('split: shares add up, the organiser takes the odd cents (same as create-checkout)', () => {
  assert.deepEqual(G.splitShares(9900, 3), [3300, 3300, 3300]);
  assert.deepEqual(G.splitShares(10001, 3), [3335, 3333, 3333]);
  assert.deepEqual(G.splitShares(13200, 1), [13200]);
  assert.equal(G.splitShares(13200, 9).length, 6);   // at most 6
  for (const [t, n] of [[9900, 3], [10001, 3], [12345, 6], [5001, 2], [13200, 4]]) {
    const s = G.splitShares(t, n);
    assert.equal(s.reduce((a, b) => a + b, 0), t);
    if (W) assert.deepEqual([...(W.splitShares(t, n) as number[])], s, `website differs for ${t}/${n}`);
  }
});

test('gift codes: any spelling is tidied; confusable letters are refused', () => {
  assert.equal(G.giftCodeNorm('cg abcd efgh jkmn pqrs'), 'CG-ABCD-EFGH-JKMN-PQRS');
  assert.equal(G.giftCodeNorm('CG-ABCD-EFGH-JKMN-PQRS'), 'CG-ABCD-EFGH-JKMN-PQRS');
  assert.equal(G.giftCodeNorm('CG-OOOO-1111-2222-3333'), '');   // no O, 0, 1, I
  assert.equal(G.giftCodeNorm('hello'), '');
  assert.equal(G.giftCodeNorm("x'; drop table --"), '');
  for (const c of ['cg abcd efgh jkmn pqrs', 'CG-OOOO-1111-2222-3333', 'cgABCDEFGHJKMNPQRS', '']) if (W) assert.equal(W.giftCodeNorm(c), G.giftCodeNorm(c));
});

test('split status line, "Friends are paying", amounts on the booking card', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  const pending = bk({ status: 'pending_payment', split_count: 3, split_deadline: '2026-11-02T03:30:00Z' });
  assert.equal(G.splitNote(pending, 1, now), '👯 1 of 3 paid · 39 h 30 min left for everyone to pay');
  assert.equal(G.splitNote(pending, null, now), '👯 Split 3 ways · 39 h 30 min left for everyone to pay');
  assert.equal(G.splitNote({ ...pending, split_deadline: '2026-10-31T12:20:00Z' }, 1, now), '👯 1 of 3 paid · 20 min left for everyone to pay');
  assert.equal(G.splitNote({ ...pending, split_deadline: '2026-11-01T11:59:50Z' }, 1, now), '👯 1 of 3 paid · 24 h 0 min left for everyone to pay');   // never "23 h 60 min"
  assert.equal(G.splitNote({ ...pending, split_deadline: '2026-10-31T11:00:00Z' }, 1, now), '⏳ The time to pay has run out — everyone who paid is refunded.');
  assert.equal(G.splitNote({ ...pending, status: 'paid' }, 3, now), '');
  assert.equal(G.splitNote(bk({ status: 'pending_payment' }), 0, now), '');
  if (W) {
    const realNow = Date.now();
    const p2 = { ...pending, split_deadline: new Date(realNow + 5 * 3600000 + 10 * 60000).toISOString() };
    assert.equal(W.splitNote(p2, 2), G.splitNote(p2, 2, realNow));
    assert.equal(W.splitNote(p2), G.splitNote(p2, undefined, realNow));
  }
  assert.equal(statusText({ ...pending, split_deadline: new Date(Date.now() + 40 * 3600000).toISOString() }), 'Friends are paying');
  assert.equal(statusText({ ...pending, split_deadline: new Date(Date.now() + 20 * 60000).toISOString() }), 'Awaiting payment');   // organiser still paying
  assert.equal(G.clientAmountText(bk({ split_count: 3, status: 'pending_payment' }), euroCents), '€132.00 split 3 ways');
  assert.equal(G.clientAmountText(bk({ gift_cents: 5000 }), euroCents), 'You paid €132.00 (€50.00 gift card)');
  assert.equal(G.clientAmountText(bk({ status: 'pending_payment' }), euroCents), '€132.00 to pay');
  assert.equal(G.clientAmountText(bk({}), euroCents), 'You paid €132.00');
  assert.equal(G.splitDateOk(null), false);
  assert.equal(G.splitDateOk(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)), false);
  assert.equal(G.splitDateOk(new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10)), true);
});

import * as R from '../src/lib/request-logic';
import { WEB_DIR } from './web';
test('shoot requests: wording and checks match the website and the database', () => {
  for (const m of [30, 45, 60, 90, 120, 480, 75]) if (W) assert.equal(W.minutesText(m), R.minutesText(m));
  assert.equal(R.minutesText(90), '1 h 30 min');
  assert.equal(R.minutesText(45), '45 min');
  if (W) for (const id of ['photo', 'video', 'drone', 'x']) assert.equal(W.requestService(id), R.requestService(id));
  const q = { service: 'video', city: 'Lisbon, Portugal', date_from: '2026-11-12', date_to: '2026-11-14', people: 3, budget_eur: 200 };
  assert.equal(R.requestHead(q), '🎥 Videographer in Lisbon · 12–14 Nov · 3 people · budget about €200');
  if (W) assert.equal(W.requestWhen(q), R.requestWhen(q));
  const today = '2026-10-31';
  assert.equal(R.requestProblem({ city: 'L', from: '2026-11-02', to: null, people: 2, budget: null }, today), 'Tell us the city.');
  assert.equal(R.requestProblem({ city: 'Lisbon', from: null, to: null, people: 2, budget: null }, today), 'Choose your dates.');
  assert.equal(R.requestProblem({ city: 'Lisbon', from: '2026-10-31', to: null, people: 2, budget: null }, today), 'Choose dates from tomorrow on.');
  assert.equal(R.requestProblem({ city: 'Lisbon', from: '2026-11-01', to: '2026-12-05', people: 2, budget: null }, today), 'Choose up to 31 days.');
  assert.equal(R.requestProblem({ city: 'Lisbon', from: '2026-11-01', to: '2026-12-01', people: 2, budget: null }, today), '');   // 31 days is fine
  assert.equal(R.requestProblem({ city: 'Lisbon', from: '2026-11-01', to: null, people: 0, budget: null }, today), 'How many people? (1–30)');
  assert.equal(R.requestProblem({ city: 'Lisbon', from: '2026-11-01', to: null, people: 2, budget: 5 }, today), 'The budget can be from €20 to €10,000.');
  assert.equal(R.offerProblem({ price: 10, photos: null, edit: null, date: '2026-11-02' }), 'The price can be from €20 to €10,000.');
  assert.equal(R.offerProblem({ price: 100, photos: 5000, edit: null, date: '2026-11-02' }), 'Up to 2000 photos.');
  assert.equal(R.offerProblem({ price: 100, photos: null, edit: 90, date: '2026-11-02' }), 'Photos can be promised within 1 to 60 days.');
  assert.equal(R.offerProblem({ price: 100, photos: 40, edit: 5, date: null }), 'Choose a day.');
  assert.equal(R.offerProblem({ price: 100, photos: 40, edit: 5, date: '2026-11-02' }), '');
  assert.deepEqual(R.offerDays({ date_from: '2026-10-30', date_to: '2026-11-02' }, today), ['2026-11-01', '2026-11-02']);   // from tomorrow
  assert.equal(R.offerFacts({ shoot_date: '2026-11-13', minutes: 90, photos: 50, edit_days: 7 }, (d) => d), '📅 2026-11-13 · ⏱ 1 h 30 min · 📸 50 photos · 📬 within 7 days');
});
