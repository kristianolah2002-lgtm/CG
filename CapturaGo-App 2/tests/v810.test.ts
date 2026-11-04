// v8.10 rules: what's included, protection rules, intro video links, trust line, photos due, package editor.
// Must match the website (site.js) and database.sql Part 11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { introVideoOk, packageFacts, packageRules, photosDue, trustLine } from '../src/lib/trust-logic';
import { buildListingPayload, draftFrom, emptyPackage } from '../src/lib/listing-logic';
import type { Booking } from '../src/lib/logic';
import { WEB_DIR } from './web';

const WEB = WEB_DIR;
const web = (f: string) => (existsSync(`${WEB}/${f}`) ? readFileSync(`${WEB}/${f}`, 'utf8') : '');

test("what's included: short lines, same as the website", () => {
  assert.deepEqual(packageFacts({ minutes: 60, photos: 30, edit_days: 5, includes: [' Location scouting ', '', '2 outfits'] }),
    ['⏱ 1 h shoot', '📷 30 edited photos', '📬 Photos within 5 days', '✓ Location scouting', '✓ 2 outfits']);
  assert.deepEqual(packageFacts({ minutes: 45, photos: 1 }), ['⏱ 45 min shoot', '📷 1 edited photo']);
  assert.deepEqual(packageFacts({ type: 'delivery', delivery_days: 3, revisions: 1, edit_days: 9 }), ['📬 Delivered in 3 days', '✏️ 1 revision']);
  assert.equal(packageFacts({ includes: Array(9).fill('x') }).length, 6);
  assert.deepEqual(packageFacts(null), []);
  const site = web('site.js');
  if (site) for (const t of ['edited photo', 'Photos within', 'Delivered in', '✏️', 'shoot`']) assert.ok(site.includes(t), t);
});

test('protection rules shown on every package', () => {
  assert.equal(packageRules('session').length, 3);
  assert.match(packageRules('session').join(' '), /7 days.*weather.*doesn’t show up/);
  assert.match(packageRules('delivery').join(' '), /delivered on time.*approve/);
  const site = web('site.js');
  if (site) for (const r of [...packageRules('session'), ...packageRules('delivery')]) assert.ok(site.includes(r), r);
});

test('intro video: only links to video sites (same as the database check)', () => {
  for (const u of ['https://www.youtube.com/shorts/abc', 'https://youtu.be/x', 'https://www.instagram.com/reel/x/', 'https://www.tiktok.com/@a/video/1', 'https://vimeo.com/1', 'https://WWW.YOUTUBE.COM/watch?v=1'])
    assert.equal(introVideoOk(u), true, u);
  for (const u of ['', 'http://youtube.com/x', 'https://evil.com/youtube.com', 'https://youtube.com.evil.com/', 'https://youtube.com@evil.com/', 'https://user@youtube.com/', 'javascript:alert(1)', 'https://notyoutube.com/', `https://youtube.com/${'x'.repeat(300)}`])
    assert.equal(introVideoOk(u), false, u);
});

test('trust line: completed shoots only when there are some', () => {
  assert.equal(trustLine({ completed_shoots: 12, created_at: '2026-10-05T00:00:00Z' }), '📸 12 completed shoots on CapturaGo · On CapturaGo since October 2026');
  assert.equal(trustLine({ completed_shoots: 1, created_at: '2026-10-05T00:00:00Z' }), '📸 1 completed shoot on CapturaGo · On CapturaGo since October 2026');
  assert.equal(trustLine({ completed_shoots: 0, created_at: '2026-10-05T00:00:00Z' }), 'On CapturaGo since October 2026');
});

test('photos promised by: shoot day + "within N days" (sessions only)', () => {
  const b = { shoot_date: '2026-10-20', booking_type: 'session', package_details: { edit_days: 5 } } as unknown as Booking;
  assert.equal(photosDue(b), '2026-10-25');
  assert.equal(photosDue({ ...b, package_details: null } as Booking), '');
  assert.equal(photosDue({ ...b, booking_type: 'delivery' } as Booking), '');
  assert.equal(photosDue({ ...b, package_details: { edit_days: 99 } } as unknown as Booking), '');
});

test('package editor: photos, delivery days and included items are checked like the database', () => {
  const base = draftFrom(null, 'Ana', 'a@t.com');
  const d = { ...base, name: 'Ana', city: 'Kyoto', portfolio: 'https://x.com', services: ['photo'] };
  const ok = buildListingPayload({ ...d, packages: [{ ...emptyPackage(), name: 'Mini', price: '120', photos: '30', editDays: 5, includes: ' Location scouting ,  2 outfits ,' }] });
  assert.ok('payload' in ok);
  const pk = (ok as { payload: { packages: Record<string, unknown>[] } }).payload.packages[0];
  assert.deepEqual([pk.photos, pk.edit_days, pk.includes], [30, 5, ['Location scouting', '2 outfits']]);
  for (const [label, patch, re] of [
    ['0 photos', { photos: '0' }, /edited photos/], ['2001 photos', { photos: '2001' }, /edited photos/],
    ['7 items', { includes: 'a,b,c,d,e,f,g' }, /up to 6/], ['long item', { includes: 'x'.repeat(61) }, /60 characters/],
  ] as const) {
    const r = buildListingPayload({ ...d, packages: [{ ...emptyPackage(), name: 'Mini', price: '120', ...patch }] });
    assert.ok('error' in r && re.test(r.error), label);
  }
  const remote = buildListingPayload({ ...d, packages: [{ ...emptyPackage(), name: 'Reel', type: 'delivery', price: '70', editDays: 5 }] });
  assert.ok('payload' in remote && !('edit_days' in (remote as { payload: { packages: Record<string, unknown>[] } }).payload.packages[0]), 'remote packages have no "photos within"');
  const back = draftFrom({ id: 'p', name: 'Ana', city: 'Kyoto', packages: [{ id: 'k', name: 'Mini', price_eur: 120, photos: 30, edit_days: 5, includes: ['A', 'B'] }] }, '', '');
  assert.deepEqual([back.packages[0].photos, back.packages[0].editDays, back.packages[0].includes], ['30', 5, 'A, B']);
});
