// v8.8 rules: founding creators (badge, card states, wording) — must match the website and database.sql Part 9.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { cityKey, isFounding, type Listing } from '../src/lib/logic';
import { FOUNDING_NEEDS, foundingView, stillRunning } from '../src/lib/plan-logic';

const WEB = '/home/claude/cg9';
const web = (f: string) => (existsSync(`${WEB}/${f}`) ? readFileSync(`${WEB}/${f}`, 'utf8') : '');
const L = (o: Partial<Listing>): Listing => ({ id: 'p', name: 'Ana', city: 'Kyoto, Japan', ...o });

test('city key: same as the database (first part, lower case, single spaces)', () => {
  assert.equal(cityKey('  Mexico   City , Mexico'), 'mexico city');
  assert.equal(cityKey('Kyoto'), 'kyoto');
  assert.equal(cityKey(null), '');
});

test('founding badge only while the listing stays in the founding city', () => {
  assert.equal(isFounding(L({ founding_city: 'Kyoto', founding_at: '2026-10-01T00:00:00Z' })), true);
  assert.equal(isFounding(L({ city: 'kyoto ,Japan', founding_city: 'Kyoto', founding_at: '2026-10-01T00:00:00Z' })), true);
  assert.equal(isFounding(L({ city: 'Osaka', founding_city: 'Kyoto', founding_at: '2026-10-01T00:00:00Z' })), false, 'moved away');
  assert.equal(isFounding(L({ founding_city: 'Kyoto', founding_at: null })), false, 'removed by the admin');
  assert.equal(isFounding(L({})), false);
  assert.equal(isFounding(null), false);
});

test('founding card: hidden / claimed / missing / claim', () => {
  assert.equal(foundingView(null), 'hidden');
  assert.equal(foundingView({ listing: false }), 'hidden');
  assert.equal(foundingView({ listing: true, claimed: true, open: false }), 'claimed');
  assert.equal(foundingView({ listing: true, open: false, spots_left: 0 }), 'hidden', 'no spots in this city');
  assert.equal(foundingView({ listing: true, open: true, spots_left: 0, missing: [] }), 'hidden', 'all taken');
  assert.equal(foundingView({ listing: true, open: true, spots_left: 3, used: true, missing: [] }), 'hidden', 'one spot per person');
  assert.equal(foundingView({ listing: true, open: true, spots_left: 3, missing: ['photos'] }), 'missing');
  assert.equal(foundingView({ listing: true, open: true, spots_left: 3, missing: [] }), 'claim');
  assert.equal(foundingView({ listing: true, open: true, spots_left: 3, missing: ['unknown_future_rule'] }), 'claim', 'unknown codes are left to the server');
});

test('founding requirements: same codes and wording as the website and the database', () => {
  assert.deepEqual(Object.keys(FOUNDING_NEEDS).sort(), ['cover', 'description', 'hidden', 'package', 'photos']);
  const dash = web('dashboard.js');
  if (dash) for (const [k, v] of Object.entries(FOUNDING_NEEDS)) assert.ok(dash.includes(`${k}: '${v}'`), `dashboard.js ${k}`);
  const sql = web('database.sql');
  if (sql) for (const k of ['cover', 'photos', 'package', 'description', 'hidden']) assert.ok(sql.includes(`THEN '${k}' END`), `database.sql ${k}`);
});

test('a free boost that already ended is not mentioned', () => {
  const now = Date.parse('2026-10-28T12:00:00Z');
  assert.equal(stillRunning('2026-12-01T00:00:00Z', now), '2026-12-01T00:00:00Z');
  assert.equal(stillRunning('2026-10-01T00:00:00Z', now), null);
  assert.equal(stillRunning(null, now), null);
});

test('website and app use the same city slug for /in/<city> pages', () => {
  const site = web('site.js'), lib = web('supabase/functions/_src/lib.js');
  for (const src of [site, lib].filter(Boolean)) assert.ok(src.includes(".normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()"), 'same slug rules');
});
