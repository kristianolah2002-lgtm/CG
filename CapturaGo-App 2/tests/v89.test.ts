// v8.9 rules: reply-time badge, quick replies, "waiting for your reply" — must match the website and database.sql Part 10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DEFAULT_TEMPLATES, fillTemplate, replyLabel, templateProblem, waitingLabel } from '../src/lib/reply-logic';

const WEB = '/home/claude/cg9';
const web = (f: string) => (existsSync(`${WEB}/${f}`) ? readFileSync(`${WEB}/${f}`, 'utf8') : '');
const NOW = Date.parse('2026-10-28T12:00:00Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

test('reply badge: only with 3+ answers, never for slow replies', () => {
  assert.equal(replyLabel({ reply_minutes: 25, reply_samples: 5 }), 'Usually replies within an hour');
  assert.equal(replyLabel({ reply_minutes: 60, reply_samples: 3 }), 'Usually replies within an hour');
  assert.equal(replyLabel({ reply_minutes: 61, reply_samples: 3 }), 'Usually replies within a few hours');
  assert.equal(replyLabel({ reply_minutes: 1440, reply_samples: 3 }), 'Usually replies within a day');
  assert.equal(replyLabel({ reply_minutes: 1441, reply_samples: 9 }), '', 'slow: no badge rather than a bad one');
  assert.equal(replyLabel({ reply_minutes: 10, reply_samples: 2 }), '', 'too few answers');
  assert.equal(replyLabel({ reply_minutes: null, reply_samples: 5 }), '');
  assert.equal(replyLabel(null), '');
  const site = web('site.js');
  if (site) for (const t of ['Usually replies within an hour', 'Usually replies within a few hours', 'Usually replies within a day']) assert.ok(site.includes(t), t);
});

test('quick replies: {name} → first name, plain text', () => {
  assert.equal(fillTemplate('Hi {name}, thanks! {NAME}', 'Tom Traveller'), 'Hi Tom, thanks! Tom');
  assert.equal(fillTemplate('Hi {name}', ''), 'Hi there');
  assert.equal(fillTemplate('Hi {name}', '<b>Eve</b> X'), 'Hi <b>Eve</b>', 'goes into a text box, never rendered as HTML');
  assert.equal(templateProblem('', 'x'), 'Add a name and a message.');
  assert.match(templateProblem('x'.repeat(41), 'x'), /40/);
  assert.match(templateProblem('x', 'x'.repeat(1001)), /1000/);
  assert.equal(templateProblem('Thanks', 'Hi {name}'), '');
});

test('built-in quick replies are the same as on the website', () => {
  const dash = web('dashboard.js');
  if (!dash) return;
  for (const [t, b] of [...DEFAULT_TEMPLATES.creator, ...DEFAULT_TEMPLATES.traveller]) {
    assert.ok(dash.includes(JSON.stringify(t).slice(1, -1)) || dash.includes(t), `title ${t}`);
    assert.ok(dash.includes(b), `body ${t}`);
  }
});

test('"Waiting for your reply" only for the creator, after 10 minutes', () => {
  const c = { creator_user_id: 'ana', client_user_id: 'tom', last_sender_id: 'tom', blocked_by: null, last_message_at: minsAgo(185) };
  assert.equal(waitingLabel(c, 'ana', NOW), 'Waiting for your reply · 3 h');
  assert.equal(waitingLabel({ ...c, last_message_at: minsAgo(25) }, 'ana', NOW), 'Waiting for your reply · 25 min');
  assert.equal(waitingLabel({ ...c, last_message_at: minsAgo(5) }, 'ana', NOW), '');
  assert.equal(waitingLabel({ ...c, last_message_at: minsAgo(60 * 50) }, 'ana', NOW), 'Waiting for your reply · 2 days');
  assert.equal(waitingLabel(c, 'tom', NOW), '', 'the traveller never sees it');
  assert.equal(waitingLabel({ ...c, last_sender_id: 'ana' }, 'ana', NOW), '', 'already answered');
  assert.equal(waitingLabel({ ...c, blocked_by: 'ana' }, 'ana', NOW), '');
});

test('database: reply time is computed by the server only, quick replies are private', () => {
  const sql = web('database.sql');
  if (!sql) return;
  assert.ok(/REVOKE ALL ON FUNCTION refresh_reply_stats\(\) FROM PUBLIC, anon, authenticated/.test(sql));
  assert.ok(!/GRANT UPDATE \([^)]*reply_minutes/.test(sql), 'reply_minutes never writable by users');
  assert.ok(/GRANT INSERT \(title, body\) ON reply_templates TO authenticated/.test(sql), 'user_id comes from the login, not the request');
});
