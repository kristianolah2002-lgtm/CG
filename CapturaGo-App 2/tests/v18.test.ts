// App v1.7: extra photos for sale. The app shows the same prices and locks as the server (buy-photos) and the
// database (set_photo_extras, delivery_visible), which decide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { beyondPromised, isLocked, photoTotal, priceToCents, saleCounts } from '../src/lib/photo-sale-logic';
import { WEB_DIR } from './web';

const ph = (id: string, o: { extra?: boolean; unlocked_at?: string | null } = {}) => ({ id, ...o });
test('locked = for sale, not bought, and selling is on', () => {
  assert.equal(isLocked(ph('a', { extra: true }), 500), true);
  assert.equal(isLocked(ph('a', { extra: true, unlocked_at: '2026-11-04' }), 500), false, 'bought');
  assert.equal(isLocked(ph('a', { extra: true }), null), false, 'selling stopped → part of the gallery');
  assert.equal(isLocked(ph('a', {}), 500), false);
});
test('what the traveller pays (price × photos + service fee, rounded like the server)', () => {
  assert.deepEqual(photoTotal(2, 500), { price: 1000, fee: 100, total: 1100 });
  assert.deepEqual(photoTotal(3, 450), { price: 1350, fee: 135, total: 1485 });
  assert.deepEqual(photoTotal(1, 105), { price: 105, fee: 11, total: 116 }, '10.5 → 11 (Math.round)');
  assert.deepEqual(photoTotal(0, 500), { price: 0, fee: 0, total: 0 });
});
test('price typed by the creator', () => {
  assert.equal(priceToCents('5'), 500);
  assert.equal(priceToCents('4,50'), 450);
  assert.equal(priceToCents(' 100 '), 10000);
  for (const bad of ['0.99', '101', 'abc', '', '-3']) assert.equal(priceToCents(bad), null, bad);
});
test('sell the photos beyond the promise; counts', () => {
  const list = [ph('1'), ph('2'), ph('3'), ph('4', { extra: true }), ph('5', { extra: true, unlocked_at: 'x' }), ph('6')];
  assert.deepEqual(beyondPromised(list, 3).map((p) => p.id), ['6'], 'photo 4 is already for sale, bought photo 5 is left alone');
  assert.deepEqual(beyondPromised([ph('1'), ph('2', { extra: true })], 1), [], 'all for sale → nothing left to do (the button hides)');
  assert.deepEqual(beyondPromised(list, 0), [], 'no promise → nothing automatic');
  assert.deepEqual(saleCounts(list, 500), { included: 4, extra: 1, bought: 1 });
  assert.deepEqual(saleCounts(list, null), { included: 5, extra: 0, bought: 1 });
});
const SRV = `${WEB_DIR}/supabase/functions/_src/buy-photos.js`, DB = `${WEB_DIR}/database.sql`;
test('same rules as the server and the database', { skip: !existsSync(SRV) && 'website not next to the app' }, () => {
  const srv = readFileSync(SRV, 'utf8'), sql = readFileSync(DB, 'utf8');
  assert.ok(srv.includes("const fee = Math.round((price * ctx.pct('CLIENT_FEE_PCT', 10)) / 100);"), 'server fee rounding');
  assert.ok(srv.includes('unit < 100 || unit > 10000'), 'server price range €1–€100');
  assert.ok(sql.includes('CHECK (extra_photo_cents IS NULL OR extra_photo_cents BETWEEN 100 AND 10000)'), 'database price range');
  assert.ok(sql.includes("RAISE EXCEPTION 'Choose a price from €1 to €100 per photo.'"), 'database message');
  const vis = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION delivery_visible'), sql.indexOf('REVOKE ALL ON FUNCTION delivery_visible'));
  assert.ok(vis.includes('ph.extra AND ph.unlocked_at IS NULL AND b.extra_photo_cents IS NOT NULL'), 'the database locks exactly what isLocked() locks');
});
