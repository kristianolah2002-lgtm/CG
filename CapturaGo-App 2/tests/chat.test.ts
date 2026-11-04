import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chatRows, chatTime, dayLabel, isUnread, looksOffPlatform, mergeMessages, otherParty, prepareMessage, unreadCount,
  type ChatMessage, type Conversation,
} from '../src/lib/chat-logic';

const C = (o: Partial<Conversation> = {}): Conversation => ({
  id: 'c1', photographer_id: 'p1', client_user_id: 'T', creator_user_id: 'A', client_name: 'Tom Traveller',
  last_message_at: '2026-10-14T10:00:00Z', last_message: 'Hi', last_sender_id: 'T',
  client_read_at: '2026-10-14T10:00:00Z', creator_read_at: '2026-10-14T09:00:00Z', blocked_by: null, created_at: '2026-10-14T08:00:00Z',
  photographers: { name: 'Ana Kovac', city: 'Kyoto, Japan' }, ...o,
});
const M = (id: string, sender: string, at: string, body = 'x'): ChatMessage => ({ id, conversation_id: 'c1', sender_id: sender, body, created_at: at });

test('unread: only when the other person wrote after I last opened the chat', () => {
  assert.equal(isUnread(C(), 'A'), true, 'creator has not read the traveller message');
  assert.equal(isUnread(C(), 'T'), false, 'my own message is never unread');
  assert.equal(isUnread(C({ creator_read_at: '2026-10-14T10:00:01Z' }), 'A'), false, 'read after the message');
  assert.equal(isUnread(C({ last_sender_id: null, last_message: null }), 'A'), false, 'empty conversation');
  assert.equal(unreadCount([C(), C({ id: 'c2', last_sender_id: 'A' }), C({ id: 'c3' })], 'A'), 2);
});

test('the other party is shown correctly to each side', () => {
  assert.deepEqual(otherParty(C(), 'T'), { name: 'Ana Kovac', role: 'creator', city: 'Kyoto, Japan' });
  assert.deepEqual(otherParty(C(), 'A'), { name: 'Tom Traveller', role: 'traveller', city: '' });
  assert.equal(otherParty(C({ photographers: null }), 'T').name, 'Creator');
});

test('inbox times read naturally (local time)', () => {
  const now = new Date(2026, 9, 14, 15, 30).getTime();            // Wed 14 Oct 2026, 15:30 local
  assert.equal(chatTime(new Date(2026, 9, 14, 9, 5).toISOString(), now), '09:05');
  assert.equal(chatTime(new Date(2026, 9, 13, 22, 0).toISOString(), now), 'Yesterday');
  assert.equal(chatTime(new Date(2026, 9, 10, 12, 0).toISOString(), now), 'Sat');
  assert.equal(chatTime(new Date(2026, 8, 2, 12, 0).toISOString(), now), '2 Sep');
  assert.equal(chatTime(new Date(2025, 11, 31, 12, 0).toISOString(), now), '31 Dec 2025');
  assert.equal(chatTime('not a date', now), '');
  assert.equal(dayLabel(new Date(2026, 9, 14, 1, 0).toISOString(), now), 'Today');
  assert.equal(dayLabel(new Date(2026, 9, 13, 23, 59).toISOString(), now), 'Yesterday');
  assert.equal(dayLabel(new Date(2026, 9, 1, 12, 0).toISOString(), now), '1 October 2026');
});

test('merging messages: no duplicates, oldest first, unsent ones stay at the end', () => {
  const a = M('a', 'T', '2026-10-14T10:00:00Z'), b = M('b', 'A', '2026-10-14T10:01:00Z');
  const local: ChatMessage = { ...M('local-1', 'T', '2026-10-14T10:02:00Z', 'sending…'), pending: true };
  let list = mergeMessages([], [b, a]);
  assert.deepEqual(list.map((m) => m.id), ['a', 'b']);
  list = mergeMessages([...list, local], [b]);                   // realtime repeats b
  assert.deepEqual(list.map((m) => m.id), ['a', 'b', 'local-1']);
  const c = M('c', 'A', '2026-10-14T10:00:30Z');                  // arrives late but is older
  list = mergeMessages(list, [c]);
  assert.deepEqual(list.map((m) => m.id), ['a', 'c', 'b', 'local-1']);
  const failed = mergeMessages([{ ...a, failed: true }], [a]);
  assert.equal(failed[0].failed, false, 'server copy replaces a failed local copy');
});

test('chat rows: day separators, grouping, newest first for the inverted list', () => {
  const now = new Date(2026, 9, 14, 15, 0).getTime();
  const msgs = [
    M('1', 'T', new Date(2026, 9, 13, 10, 0).toISOString()),
    M('2', 'T', new Date(2026, 9, 13, 10, 1).toISOString()),
    M('3', 'A', new Date(2026, 9, 14, 9, 0).toISOString()),
  ];
  const rows = chatRows(msgs, 'T', now);
  assert.deepEqual(rows.map((r) => (r.kind === 'day' ? `day:${r.label}` : `${r.m.id}:${r.mine ? 'me' : 'them'}:${r.first ? 'first' : 'cont'}`)),
    ['3:them:first', 'day:Today', '2:me:cont', '1:me:first', 'day:Yesterday']);
});

test('safety tip appears for off-platform payment attempts only', () => {
  for (const t of ['Pay me on PayPal please', 'send it by bank transfer', 'my IBAN is SK31…', 'add me on WhatsApp', 'Revolut works', 'cash only', 'pay me directly and skip the fee'])
    assert.equal(looksOffPlatform(t), true, t);
  for (const t of ['Can we shoot at sunrise?', 'Is the price per person?', 'I will book through the app', 'paying is easy here'])
    assert.equal(looksOffPlatform(t), false, t);
});

test('message text is cleaned and limited', () => {
  assert.deepEqual(prepareMessage('   '), { error: 'Write a message first.' });
  assert.deepEqual(prepareMessage('  Hello\r\n\n\n\nthere  '), { text: 'Hello\n\nthere' });
  assert.deepEqual(prepareMessage('x'.repeat(2001)), { error: 'Messages can be up to 2000 characters.' });
  assert.deepEqual(prepareMessage('x'.repeat(2000)), { text: 'x'.repeat(2000) });
});
