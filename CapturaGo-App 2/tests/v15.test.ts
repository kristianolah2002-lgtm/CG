// App v1.5: push notifications. A tapped notification only opens our own screens with well-formed ids, and the
// app accepts exactly the tokens the database accepts (register_push_token in database.sql) and the server sends to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PUSH_TOKEN_RE, routeFor, validPushToken } from '../src/lib/push-logic';
import { WEB_DIR } from './web';

const C = '0b6f1a2e-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
test('a tapped notification opens the right screen', () => {
  assert.deepEqual(routeFor({ url: '/bookings', booking_id: C }), { pathname: '/bookings' });
  assert.deepEqual(routeFor({ url: `/chat/${C.toUpperCase()}`, conversation_id: C }), { pathname: '/chat/[id]', params: { id: C } });
  assert.deepEqual(routeFor({ url: `/creator/${C}`, date: '2026-11-06' }), { pathname: '/creator/[id]', params: { id: C, date: '2026-11-06' } });
  assert.deepEqual(routeFor({ url: `/creator/${C}`, date: 'soon' }), { pathname: '/creator/[id]', params: { id: C } });
});
test('anything else opens nothing', () => {
  for (const d of [null, undefined, 'x', 42, {}, { url: 5 }, { url: 'https://evil.example/' }, { url: '/chat/123' }, { url: `/chat/${C}/x` }, { url: '/delete-account' },
    { url: `//evil.example/chat/${C}` }, { url: `/creator/${C}?x=1` }]) assert.equal(routeFor(d), null, JSON.stringify(d));
});
test('push tokens: Expo format only', () => {
  assert.ok(validPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'));
  assert.ok(validPushToken('ExpoPushToken[AbC_12-xyzABCDEF]'));
  for (const t of ['', 'ExponentPushToken[]', 'ExponentPushToken[short]', 'ExponentPushToken[a b c d e f g h]', 'fcm:abc', 'ExponentPushToken[xxxxxxxxxxxx]x', null, 7]) assert.equal(validPushToken(t), false, String(t));
});
test('the same token rule as the database and the server', { skip: !existsSync(`${WEB_DIR}/database.sql`) && 'website not next to the app' }, () => {
  const sql = readFileSync(`${WEB_DIR}/database.sql`, 'utf8');
  const m = sql.match(/token ~ '(\^\(Expo[^']+)'/);
  assert.ok(m, 'push_tokens check in database.sql');
  assert.equal(m![1], PUSH_TOKEN_RE.source.replace(/\\\//g, '/'));
  const lib = readFileSync(`${WEB_DIR}/supabase/functions/_src/lib.js`, 'utf8');
  assert.ok(lib.includes(`const PUSH_TOKEN_RE = /${PUSH_TOKEN_RE.source}/;`), 'lib.js sendPush uses the same rule');
});
