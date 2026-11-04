// v8.13 rules: last-minute deal prices and phone numbers. The app must match the website (site.js)
// and the server (create-checkout's price, lib normPhone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as D from '../src/lib/deal-logic';
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
const LIB = `${WEB_DIR}/supabase/functions/_src/lib.js`;

test('deal price: −pct of the package, rounded to the cent like the server', () => {
  assert.equal(D.dealCents(120, 25), 9000);
  assert.equal(D.dealCents(99.99, 15), 8499);
  assert.equal(D.dealCents(85, 10), 7650);
  assert.equal(D.dealCents(10, 50), 500);
  assert.equal(D.dealCents(120, 0), 12000);      // no deal
  assert.equal(D.dealCents(120, 60), 12000);     // out of range → ignored
  assert.equal(D.dealCents(120, 5), 12000);
  // same as create-checkout: Math.round((price * 100 * (100 - pct)) / 100)
  for (const [p, pct] of [[120, 25], [99.99, 15], [57.5, 30], [4999, 50], [10, 10]] as const) assert.equal(D.dealCents(p, pct), Math.round((p * 100 * (100 - pct)) / 100));
});

test('deal price: same as the website', { skip: !W && 'website not next to the app' }, () => {
  for (const [p, pct] of [[120, 25], [99.99, 15], [57.5, 30], [10, 50], [120, 0], [120, 70]] as const) assert.equal(W!.dealCents(p, pct), D.dealCents(p, pct));
});

test('deal day: "tomorrow", otherwise a short date', () => {
  const now = Date.parse('2026-11-04T10:00:00Z');
  assert.equal(D.dealDay('2026-11-05', now), 'tomorrow');
  assert.match(D.dealDay('2026-11-06', now), /Fri.*6.*Nov/);
});

test('deals by creator: only sane rows', () => {
  const m = D.dealsByCreator([{ photographer_id: 'a', day: '2026-11-05', pct: 20 }, { photographer_id: 'a', day: '2026-11-06', pct: 15 }, { photographer_id: 'b', day: 'x', pct: 20 }, { photographer_id: 'c', day: '2026-11-05', pct: 80 }]);
  assert.deepEqual([...m.keys()], ['a']);
  assert.equal(m.get('a')!.length, 2);
  assert.equal(D.dealsByCreator(null).size, 0);
});

test('phone numbers: normalised like the server', () => {
  assert.equal(D.normPhone('+421 900 123 456'), '+421900123456');
  assert.equal(D.normPhone('00421 900-123-456'), '+421900123456');
  assert.equal(D.normPhone('(+44) 7700 900123'), '+447700900123');
  assert.equal(D.normPhone('+44 abc'), '');
  assert.equal(D.normPhone('0900 123 456'), '');         // no country code
  assert.equal(D.normPhone('+0123456789'), '');
  assert.equal(D.normPhone('+1234567890123456'), '');    // too long
  if (existsSync(LIB)) {
    const src = readFileSync(LIB, 'utf8');
    const body = src.slice(src.indexOf('const PHONE_RE'), src.indexOf('function maskPhone'));
    const serverNorm = new Function(`${body}; return normPhone;`)() as (s: string) => string;
    for (const x of ['+421 900 123 456', '00421 900-123-456', '0900 123 456', '+1 (555) 010-0199', '+44.7700.900.123', '+0123456789', '']) assert.equal(D.normPhone(x), serverNorm(x), x);
  }
});
