// App v1.6: creators answer their reviews. The app cleans and checks a reply like the database (reply_to_review).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { cleanReply, REPLY_MAX, replyProblem, unanswered } from '../src/lib/review-logic';
import { WEB_DIR } from './web';

test('a reply is cleaned like the database does it', () => {
  assert.equal(cleanReply('  Thank you!\u0007  '), 'Thank you!');
  assert.equal(cleanReply('Line 1\n\n\n\nLine 2\tend'), 'Line 1\n\nLine 2end');
  assert.equal(cleanReply('a\r\nb'), 'a\nb');
  assert.equal(cleanReply(null), '');
});
test('2 to 1000 characters', () => {
  assert.equal(replyProblem('Thanks'), '');
  assert.equal(replyProblem('x'), 'Your reply can be 2 to 1000 characters.');
  assert.equal(replyProblem(' \u0001x '), 'Your reply can be 2 to 1000 characters.');
  assert.equal(replyProblem('x'.repeat(REPLY_MAX)), '');
  assert.equal(replyProblem('x'.repeat(REPLY_MAX + 1)), 'Your reply can be 2 to 1000 characters.');
});
test('reviews without a reply are counted only when the database knows replies', () => {
  assert.equal(unanswered([{ reply: null }, { reply: 'Thanks!' }, { reply: '' }]), 2);
  assert.equal(unanswered([{ id: 'old database' } as { reply?: string | null }]), 0);
  assert.equal(unanswered([]), 0);
});
test('the same rule and wording as the database', { skip: !existsSync(`${WEB_DIR}/database.sql`) && 'website not next to the app' }, () => {
  const sql = readFileSync(`${WEB_DIR}/database.sql`, 'utf8');
  const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION reply_to_review'), sql.indexOf('REVOKE ALL ON FUNCTION reply_to_review'));
  assert.ok(fn.includes("RAISE EXCEPTION 'Your reply can be 2 to 1000 characters.'"));
  assert.ok(fn.includes('char_length(txt) < 2 OR char_length(txt) > 1000'));
  assert.ok(sql.includes('CHECK (reply IS NULL OR char_length(reply) BETWEEN 2 AND 1000)'));
  assert.ok(fn.includes("E'[\\\\x01-\\\\x09\\\\x0b-\\\\x1f\\\\x7f]'") && fn.includes("E'\\\\n{3,}', E'\\n\\n'"), 'same characters removed, same empty-line rule');
});
