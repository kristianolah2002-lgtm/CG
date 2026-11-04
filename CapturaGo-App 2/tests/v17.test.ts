// Polish release: light on the shoot day (sunrise, sunset, golden hour) — the app, the website (site.js) and the
// reminder email (lib.js) must say exactly the same thing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { addMinutes, bestMeetTime, forecastUrl, hhmm, parseForecast, sunLine } from '../src/lib/plan-logic';
import { WEB_DIR } from './web';

const W = { sunrise: '06:58', sunset: '16:31' };
test('times from Open-Meteo (local time of the shoot city)', () => {
  assert.equal(hhmm('2026-11-06T06:58'), '06:58');
  assert.equal(hhmm('2026-11-06T16:31:00'), '16:31');
  for (const bad of ['', null, undefined, '2026-11-06', '25:00', 'T07:61', 'x06:58y']) assert.equal(hhmm(bad), null, String(bad));
  assert.equal(addMinutes('16:31', -60), '15:31');
  assert.equal(addMinutes('00:10', -20), '00:00', 'stays in the day');
  assert.equal(addMinutes('23:50', 30), '23:59');
});
test('one line about the light, fitted to the time of day', () => {
  assert.equal(sunLine(W, 'sunrise'), '🌅 Sunrise 06:58 · golden light until 07:58');
  assert.equal(sunLine(W, 'golden_hour'), '🌇 Golden hour 15:31–16:31 · sunset 16:31');
  assert.equal(sunLine(W, 'evening'), '🌇 Golden hour 15:31–16:31 · sunset 16:31');
  assert.equal(sunLine(W, 'midday'), '🌅 Sunrise 06:58 · 🌇 Sunset 16:31 (golden hour from 15:31)');
  assert.equal(sunLine(W, null), sunLine(W, 'flexible'));
  assert.equal(sunLine({ sunrise: null, sunset: '16:31' }, null), '', 'polar day/night: nothing');
  assert.equal(sunLine({ sunrise: '17:00', sunset: '06:00' }, null), '');
  assert.equal(sunLine(null), '');
});
test('a meeting time for the best light (creators)', () => {
  assert.equal(bestMeetTime(W, 'sunrise'), '06:38');
  assert.equal(bestMeetTime(W, 'golden_hour'), '15:16');
  assert.equal(bestMeetTime(W, 'evening'), '15:16');
  assert.equal(bestMeetTime(W, 'morning'), null);
  assert.equal(bestMeetTime({ sunrise: null, sunset: null }, 'sunrise'), null);
});
test('the forecast asks for sunrise and sunset in the same request', () => {
  const url = forecastUrl({ lat: 48.2, lon: 16.37 }, new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10))!;
  assert.match(url, /daily=[^&]*sunrise,sunset/);
  assert.match(url, /timezone=auto/);
  const f = parseForecast({ daily: { weather_code: [1], temperature_2m_max: [12], temperature_2m_min: [4], precipitation_probability_max: [10], sunrise: ['2026-11-06T06:58'], sunset: ['2026-11-06T16:31'] } })!;
  assert.deepEqual([f.sunrise, f.sunset], ['06:58', '16:31']);
  assert.equal(parseForecast({ daily: { weather_code: [1], temperature_2m_max: [12], temperature_2m_min: [4] } })!.sunrise, null, 'older answer without sun times');
});
const SITE = `${WEB_DIR}/site.js`, LIB = `${WEB_DIR}/supabase/functions/_src/lib.js`, MAIL = `${WEB_DIR}/supabase/functions/_src/mail-i18n.js`;
test('the website and the reminder email say the same', { skip: !existsSync(SITE) && 'website not next to the app' }, () => {
  const win: Record<string, unknown> = { CG_CONFIG: { social: {} } };
  const ctx = { window: win, document: { addEventListener() {}, getElementById: () => null }, navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, URL, Date, Math, JSON, console, setTimeout, clearTimeout };
  vm.createContext(ctx); vm.runInContext(readFileSync(SITE, 'utf8'), ctx);
  const site = win as unknown as { sunLine: typeof sunLine; bestMeetTime: typeof bestMeetTime };
  const srv = vm.createContext({ console });
  vm.runInContext(`${readFileSync(MAIL, 'utf8')}\nconst MAIL_LANGS = ['en','de','es','fr'];\n${readFileSync(LIB, 'utf8').match(/function L\([\s\S]*?\n\}\n/)![0]}\n${readFileSync(LIB, 'utf8').match(/function hhmm[\s\S]*?\nasync function rainForecast/)![0].replace(/\nasync function rainForecast$/, '')}\nthis.sunText = sunText; this.hhmm = hhmm;`, srv);
  const s = srv as unknown as { sunText: (w: unknown, slot: unknown, l: string) => string; hhmm: (v: unknown) => string | null };
  for (const slot of ['sunrise', 'golden_hour', 'evening', 'morning', null]) {
    assert.equal(site.sunLine(W, slot), sunLine(W, slot), `website, ${slot}`);
    assert.equal(s.sunText(W, slot, 'en'), sunLine(W, slot), `email, ${slot}`);
    assert.equal(site.bestMeetTime(W, slot), bestMeetTime(W, slot));
  }
  for (const v of ['2026-11-06T06:58', 'x', '24:00', '2026-11-06T16:31:00']) assert.equal(s.hhmm(v), hhmm(v));
  assert.equal(s.sunText(W, 'golden_hour', 'de'), '🌇 Goldene Stunde 15:31–16:31 · Sonnenuntergang 16:31');
});
