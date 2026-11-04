import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base64ToBytes, buildListingPayload, draftFrom, emptyDrone, emptyPackage, readDrone, type ListingDraft } from '../src/lib/listing-logic';

const base = (o: Partial<ListingDraft> = {}): ListingDraft => ({
  name: 'Ana Kovac', city: 'Kyoto, Japan', email: 'ana@test.com', portfolio: 'https://instagram.com/ana', languages: 'English',
  price: 'mid', level: 'pro', travel: false, bio: 'Golden hour portraits.', services: ['photo'], vibes: ['moody'], occasions: ['proposal'],
  spots: [], packages: [], drone: emptyDrone(), ...o,
});
const err = (d: ListingDraft) => { const r = buildListingPayload(d, 1_700_000_000_000); return 'error' in r ? r.error : null; };
const ok = (d: ListingDraft) => { const r = buildListingPayload(d, 1_700_000_000_000); if ('error' in r) throw new Error(r.error); return r.payload; };

test('required fields and services — same messages as the website', () => {
  assert.equal(err(base({ name: '  ' })), 'Please fill in all fields marked *.');
  assert.equal(err(base({ portfolio: '' })), 'Please fill in all fields marked *.');
  assert.equal(err(base({ services: [] })), 'Select at least one service.');
  assert.equal(err(base({ services: ['made-up'] })), 'Select at least one service.');
  assert.equal(err(base({ email: 'nope' })), 'Please enter a valid email.');
  assert.equal(err(base({ portfolio: 'instagram.com/ana' })), 'Portfolio link must start with https://');
  assert.equal(err(base({ portfolio: 'javascript:alert(1)' })), 'Portfolio link must start with https://');
  assert.equal(err(base()), null);
});

test('payload matches what the website saves', () => {
  const p = ok(base({ vibes: ['moody', 'bogus'], spots: [{ name: ' Gion ', desc: ' Lanterns ' }, { name: '', desc: 'ignored' }] }));
  assert.equal(p.type, 'photo');
  assert.deepEqual(p.vibes, ['moody'], 'unknown vibes are dropped');
  assert.equal(p.specialties, 'Photography');
  assert.deepEqual(p.local_spots, [{ name: 'Gion', desc: 'Lanterns' }]);
  assert.equal(p.drone_certified, false);
  assert.equal(p.drone_region, null);
  assert.equal(p.description, 'Golden hour portraits.');
  assert.equal(ok(base({ bio: '   ' })).description, null);
  assert.equal(String(ok(base({ bio: 'x'.repeat(900) })).description).length, 600);
  assert.equal(ok(base({ price: 'weird', level: 'weird' })).price, 'mid');
});

test('packages: same validation and shape as the website', () => {
  assert.equal(err(base({ packages: [{ ...emptyPackage(), price: '120' }] })), 'Every package needs a name.');
  assert.equal(err(base({ packages: [{ ...emptyPackage(), name: 'Mini', price: '5' }] })), '"Mini": price must be between €10 and €5000.');
  assert.equal(err(base({ packages: [{ ...emptyPackage(), name: 'Mini', price: '' }] })), '"Mini": price must be between €10 and €5000.');
  assert.equal(err(base({ packages: [{ ...emptyPackage(), name: 'Mini', price: '5001' }] })), '"Mini": price must be between €10 and €5000.');
  const p = ok(base({ packages: [
    { ...emptyPackage(), name: 'Mini session', price: '119,99', minutes: 90, desc: ' 30 photos ' },
    { ...emptyPackage() },                                                     // empty row is skipped
    { ...emptyPackage(), id: 'keep-me', name: 'Reel', type: 'delivery', price: '70', days: 5, revisions: 2 },
  ] }));
  assert.deepEqual(p.packages, [
    { id: 'ployw3v280', name: 'Mini session', price_eur: 119.99, desc: '30 photos', minutes: 90 },
    { id: 'keep-me', name: 'Reel', price_eur: 70, desc: '', type: 'delivery', delivery_days: 5, revisions: 2 },
  ]);
});

test('drone rules — EU (EASA)', () => {
  const D = (o: object) => ({ ...emptyDrone(), region: 'easa' as const, declared: true, ...o });
  assert.equal(err(base({ services: ['drone'], drone: emptyDrone() })), 'Choose where you fly your drone for clients.');
  assert.deepEqual(readDrone(D({ euOp: 'SVK87654321abcde-xyz', euWeight: 'sub250' })), { error: 'Enter only the public 16-character operator number, without the secret part after the dash.' });
  assert.deepEqual(readDrone(D({ euOp: 'SK123', euWeight: 'sub250' })), { error: 'EU operator numbers have 16 characters and start with a 3-letter country code (e.g. SVK…).' });
  assert.deepEqual(readDrone(D({ euOp: 'svk 8765 4321 abcd e' })), { error: "Choose your drone's weight." });
  assert.deepEqual(readDrone(D({ euOp: 'SVK87654321ABCDE', euWeight: '250plus' })), { error: 'Drones of 250 g or more need an A1/A3 or A2 certificate number.' });
  assert.deepEqual(readDrone(D({ euOp: 'svk 8765 4321 abcd e', euWeight: 'sub250' })), { region: 'easa', info: { operator: 'SVK87654321ABCDE', weight: 'sub250', cert: null } });
  assert.deepEqual(readDrone(D({ euOp: 'SVK87654321ABCDE', euWeight: '250plus', euCert: 'svk-rp-123' })), { region: 'easa', info: { operator: 'SVK87654321ABCDE', weight: '250plus', cert: 'SVK-RP-123' } });
  assert.deepEqual(readDrone(D({ euOp: 'SVK87654321ABCDE', euWeight: 'sub250', declared: false })), { error: 'Please confirm your drone details and that you follow the local drone rules.' });
  const p = ok(base({ services: ['drone', 'photo'], drone: D({ euOp: 'SVK87654321ABCDE', euWeight: 'sub250' }) }));
  assert.equal(p.drone_certified, true); assert.equal(p.drone_region, 'easa');
  assert.equal(p.type, 'drone');
});

test('drone rules — US (FAA) and other countries', () => {
  const F = (o: object) => ({ ...emptyDrone(), region: 'faa' as const, declared: true, ...o });
  assert.deepEqual(readDrone(F({ usCert: '1', usReg: 'FA12345678' })), { error: 'Enter your FAA Part 107 certificate number.' });
  assert.deepEqual(readDrone(F({ usCert: '4567890', usReg: 'XY12345678' })), { error: 'FAA drone registration numbers start with "FA".' });
  assert.deepEqual(readDrone(F({ usCert: '4567890', usReg: 'fa12345678' })), { region: 'faa', info: { cert: '4567890', registration: 'FA12345678' } });
  const O = (o: object) => ({ ...emptyDrone(), region: 'other' as const, declared: true, ...o });
  assert.deepEqual(readDrone(O({})), { region: 'other', info: { registration: null } });
  assert.deepEqual(readDrone(O({ otherReg: 'ŠK/2026-14' })), { region: 'other', info: { registration: 'ŠK/2026-14' } });
  assert.deepEqual(readDrone(O({ otherReg: '<script>' })), { error: 'The permit number can only contain letters, numbers, spaces, dots, slashes and dashes.' });
});

test('editor is pre-filled from a saved listing', () => {
  const d = draftFrom({ id: 'x', name: 'Ana', city: 'Kyoto', services: ['photo'], local_spots: ['Gion', { name: 'Arashiyama', desc: 'Bamboo' }],
    packages: [{ id: 'k1', name: 'Reel', price_eur: 70, type: 'delivery', delivery_days: 5, revisions: 2 }], drone_region: 'faa' }, 'Fallback', 'a@t.com',
    { region: 'faa', info: { cert: '123456', registration: 'FA1234567' } });
  assert.deepEqual(d.spots, [{ name: 'Gion', desc: '' }, { name: 'Arashiyama', desc: 'Bamboo' }]);
  assert.deepEqual(d.packages[0], { id: 'k1', name: 'Reel', type: 'delivery', price: '70', minutes: 60, days: 5, revisions: 2, desc: '', photos: '', editDays: 0, includes: '' });
  assert.equal(d.drone.usReg, 'FA1234567'); assert.equal(d.drone.declared, true);
  const fresh = draftFrom(null, 'Tom Traveller', 't@t.com');
  assert.equal(fresh.name, 'Tom Traveller'); assert.equal(fresh.price, 'mid'); assert.deepEqual(fresh.packages, []);
  assert.equal(draftFrom({ id: 'y', name: 'Old', city: 'X', type: 'video' }, '', '').services[0], 'video', 'old listings with only "type"');
});

test('base64 decoding for photo upload', () => {
  const bytes = base64ToBytes(Buffer.from('CapturaGo ✓ photo bytes').toString('base64'));
  assert.equal(Buffer.from(bytes).toString(), 'CapturaGo ✓ photo bytes');
  const jpegHeader = base64ToBytes('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  assert.deepEqual([...jpegHeader.slice(0, 3)], [0xff, 0xd8, 0xff]);
  for (const len of [0, 1, 2, 3, 4, 5, 100]) {
    const buf = Buffer.from(Array.from({ length: len }, (_, i) => (i * 37) % 256));
    assert.deepEqual(Buffer.from(base64ToBytes(buf.toString('base64'))), buf, `length ${len}`);
  }
});
