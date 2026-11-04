// Translations: the app uses the website's dictionary; text people wrote stays as it is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { setLang, tr, trChildren } from '../src/lib/i18n';
import { WEB_DIR } from './web';

test('German / Spanish / French: interface text, patterns, emoji and arrows kept, unknown text untouched', async () => {
  await setLang('de');
  assert.equal(tr('Explore'), 'Entdecken');
  assert.equal(tr('  Sign in  '), '  Anmelden  ');
  assert.equal(tr('📣 Post a request — creators send you offers'), '📣 Anfrage posten — Creator senden dir Angebote');
  assert.equal(tr('Be one of the first real creators →'), 'Sei einer der ersten echten Creator →');
  assert.equal(tr('What do you need? *'), 'Was brauchst du? *');
  assert.equal(tr('2 creators in Kyoto'), '2 Creator in Kyoto');
  assert.equal(tr('Free 2 of 4 days · from Mon 3 Nov'), 'Frei an 2 von 4 Tagen · ab Mon 3 Nov');
  assert.equal(tr('Photography · Local guide'), 'Fotografie · Local Guide');
  assert.equal(tr('Our sunset walk was magic'), 'Our sunset walk was magic');   // not interface text
  assert.equal(tr('In the EU, anyone flying a drone with a camera must be registered as an operator — any weight, paid or hobby. Drones of 250 g or more also need the A1/A3 (or A2) certificate.').startsWith('In der EU'), true);
  assert.equal(trChildren(['Note for ', 'Ana']), 'Notiz für Ana');
  await setLang('es');
  assert.equal(tr('Messages'), 'Mensajes');
  assert.equal(tr('In Lisbon 20–26 Nov'), 'En Lisbon 20–26 Nov');
  await setLang('fr');
  assert.equal(tr('Bookings'), 'Réservations');
  assert.equal(new Date(Date.UTC(2026, 10, 3, 12)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }), 'novembre');
  await setLang('en');
  assert.equal(tr('Explore'), 'Explore');
  assert.equal(new Date(Date.UTC(2026, 10, 3, 12)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }), 'November');
});

test('the website translates the same way (i18n.js + /i18n/de.js)', async () => {
  const SITE = WEB_DIR;
  if (!existsSync(`${SITE}/i18n.js`)) return;
  const store: Record<string, string> = { cg_lang: 'de' };
  const win: Record<string, unknown> = {};
  const doc = { documentElement: { lang: 'en' }, readyState: 'complete', querySelectorAll: () => [], addEventListener() {}, write() {}, title: '', body: null };
  const ctx = { window: win, document: doc, navigator: { language: 'de' }, localStorage: { getItem: (k: string) => store[k] ?? null, setItem() {} }, location: {}, Date, Intl, RegExp, console, MutationObserver: class { observe() {} }, NodeFilter: { SHOW_TEXT: 4 } };
  (ctx as Record<string, unknown>).self = win;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(`${SITE}/i18n/de.js`, 'utf8'), ctx);
  try { vm.runInContext(readFileSync(`${SITE}/i18n.js`, 'utf8'), ctx); } catch { /* document.body is not there — the translator functions are enough */ }
  const wtr = win.tr as (s: string) => string;
  await setLang('de');
  for (const s of ['Explore', '📣 Post a request — creators send you offers', 'What do you need? *', '2 creators in Kyoto', 'Photography · Local guide']) {
    assert.equal(wtr(s), tr(s), s);
  }
  await setLang('en');
});
