// Rules for the portfolio gallery, booking link, time of day, link fee and photo delivery.
// They must match the website (site.js / dashboard.js) and the database rules (database.sql Part 7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  cleanHandleInput, clientSeesPhotos, creatorCanRemovePhotos, creatorPhotoButton, feePctFor, fees, galleryOf, handleProblem,
  HANDLE_RE, isHandleTaken, photosKeptUntil, slotLabel, slugify, thumbPath, TIME_SLOTS, type Booking, type Listing,
} from '../src/lib/logic';
import { CLIENT_FEE_PCT, LINK_FEE_PCT } from '../src/lib/config';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const day = (n: number) => new Date(NOW + n * 86400000).toISOString().slice(0, 10);
const bk = (over: Partial<Booking>): Booking => ({
  id: 'b1', photographer_id: 'p1', creator_user_id: 'c', client_user_id: 't', client_name: 'Tom', client_email: 't@x.com', package_name: 'Mini',
  shoot_date: day(0), price_cents: 10000, client_fee_cents: 1000, creator_fee_cents: 0, total_cents: 11000, status: 'confirmed', created_at: '2026-10-01T00:00:00Z', ...over,
});

test('gallery: only https photos, thumbs optional, JSON strings accepted', () => {
  const l = { id: 'p', name: 'A', city: 'B', gallery: [
    { url: 'https://x.co/a.jpg', thumb: 'https://x.co/ta.jpg' }, { url: 'http://x.co/b.jpg' }, { url: 'javascript:alert(1)' },
    { url: 'https://x.co/c.jpg', thumb: 'http://bad' }, null, 'https://x.co/d.jpg',
  ] } as unknown as Listing;
  assert.deepEqual(galleryOf(l), [{ url: 'https://x.co/a.jpg', thumb: 'https://x.co/ta.jpg' }, { url: 'https://x.co/c.jpg' }]);
  assert.deepEqual(galleryOf({ id: 'p', name: 'A', city: 'B', gallery: '[{"url":"https://x.co/e.jpg"}]' }), [{ url: 'https://x.co/e.jpg' }]);
  assert.deepEqual(galleryOf({ id: 'p', name: 'A', city: 'B', gallery: 'not json' }), []);
  assert.deepEqual(galleryOf(null), []);
});

test('booking link: same pattern as the database, reserved words, friendly cleaning', () => {
  for (const ok of ['ana', 'ana-kyoto', 'a1b', 'x'.repeat(30)]) assert.equal(handleProblem(ok), '', ok);
  for (const bad of ['ab', '-ana', 'ana-', 'Ana', 'ana_k', 'x'.repeat(31), 'ana kyoto']) assert.notEqual(handleProblem(bad), '', bad);
  assert.match(handleProblem('admin'), /reserved/);
  assert.equal(handleProblem(''), '');
  assert.equal(cleanHandleInput('Ana Kováč!'), 'ana-kov');
  assert.equal(cleanHandleInput('Marek  Edit'), 'marek-edit');
  assert.equal(slugify('Ana Kováč'), 'ana-kovac');
  assert.equal(slugify('  --Žofia & Co.--  '), 'zofia-co');
  assert.equal(slugify('x'.repeat(40)).length, 30);
  assert.ok(HANDLE_RE.test(slugify('Peter Novák')));
  assert.ok(isHandleTaken({ code: '23505', message: 'duplicate key value violates unique constraint "photographers_handle_unique"' }));
  assert.ok(!isHandleTaken({ code: '23505', message: 'duplicate key value violates unique constraint "reviews_booking_unique"' }));
  assert.ok(!isHandleTaken(null));
});

test('the database rule for handles is the same pattern', () => {
  const sql = '../cg9/database.sql';
  if (!existsSync(sql)) return; // website folder not next to the app
  const src = readFileSync(sql, 'utf8');
  assert.ok(src.includes("'^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$'"));
});

test('time of day: same options as the website and the server', () => {
  assert.deepEqual(TIME_SLOTS.map(([k]) => k), ['sunrise', 'morning', 'midday', 'afternoon', 'golden_hour', 'evening', 'flexible']);
  assert.equal(slotLabel('golden_hour'), 'Golden hour');
  assert.equal(slotLabel('nonsense'), '');
  assert.equal(slotLabel(null), '');
});

test('link fee: lower when booked through the creator link, never above the normal fee', () => {
  assert.equal(feePctFor(false), CLIENT_FEE_PCT);
  assert.equal(feePctFor(true), Math.min(LINK_FEE_PCT, CLIENT_FEE_PCT));
  assert.deepEqual(fees(120, feePctFor(true)), { priceCents: 12000, feeCents: 600, totalCents: 12600 });
  assert.deepEqual(fees(99.99, feePctFor(true)), { priceCents: 9999, feeCents: 500, totalCents: 10499 });
});

test('client sees the gallery only after the creator sends it', () => {
  assert.equal(clientSeesPhotos(bk({ status: 'confirmed' })), false);
  assert.equal(clientSeesPhotos(bk({ status: 'confirmed', photos_ready_at: '2026-10-14T10:00:00Z' })), true);
  assert.equal(clientSeesPhotos(bk({ status: 'completed' })), true);
  assert.equal(clientSeesPhotos(bk({ booking_type: 'delivery', status: 'confirmed' })), false);
  assert.equal(clientSeesPhotos(bk({ booking_type: 'delivery', status: 'confirmed', revisions_used: 1 })), true);
  assert.equal(clientSeesPhotos(bk({ booking_type: 'delivery', status: 'delivered' })), true);
});

test('creator can fix photos while working and for 30 days after completion (database rule)', () => {
  assert.equal(creatorCanRemovePhotos(bk({ status: 'confirmed' }), NOW), true);
  assert.equal(creatorCanRemovePhotos(bk({ status: 'delivered' }), NOW), true);
  assert.equal(creatorCanRemovePhotos(bk({ status: 'completed', completed_at: new Date(NOW - 29 * 86400000).toISOString() }), NOW), true);
  assert.equal(creatorCanRemovePhotos(bk({ status: 'completed', completed_at: new Date(NOW - 31 * 86400000).toISOString() }), NOW), false);
  assert.equal(creatorCanRemovePhotos(bk({ status: 'completed', completed_at: null }), NOW), false);
  assert.equal(creatorCanRemovePhotos(bk({ status: 'cancelled' }), NOW), false);
});

test('photo upload button: after the shoot day for sessions, after delivery for remote orders', () => {
  assert.equal(creatorPhotoButton(bk({ shoot_date: day(3) }), 0, NOW), false);
  assert.equal(creatorPhotoButton(bk({ shoot_date: day(3) }), 2, NOW), true);
  assert.equal(creatorPhotoButton(bk({ shoot_date: day(0) }), 0, NOW), true);
  assert.equal(creatorPhotoButton(bk({ shoot_date: day(-5), status: 'completed' }), 0, NOW), true);
  assert.equal(creatorPhotoButton(bk({ status: 'paid' }), 0, NOW), false);
  assert.equal(creatorPhotoButton(bk({ booking_type: 'delivery', status: 'confirmed' }), 0, NOW), false); // "Deliver files" opens it
  assert.equal(creatorPhotoButton(bk({ booking_type: 'delivery', status: 'delivered' }), 1, NOW), true);
});

test('photos are kept 90 days after completion; preview file naming matches the website', () => {
  assert.equal(photosKeptUntil(bk({ completed_at: '2026-10-01T00:00:00.000Z' })), '2026-12-30T00:00:00.000Z');
  assert.equal(photosKeptUntil(bk({ completed_at: null })), null);
  assert.equal(thumbPath('b1/123-abc.jpg'), 'b1/t_123-abc.jpg');
});

test('website uses the same link fee', () => {
  const site = '../cg9/site.js';
  if (!existsSync(site)) return;
  assert.match(readFileSync(site, 'utf8'), new RegExp(`creatorLinkFeePercent:\\s*${LINK_FEE_PCT}\\b`));
});
