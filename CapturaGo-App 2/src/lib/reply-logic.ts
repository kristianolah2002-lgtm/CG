// v8.9 pure logic — reply-time badge, quick replies, "waiting for your reply". Same rules and wording as the website.
import type { Conversation } from './chat-logic';

/** "Usually replies within …" from the time the server measured (3+ answers; no badge for slow replies). */
export function replyLabel(l?: { reply_minutes?: number | null; reply_samples?: number | null } | null): string {
  const m = Number(l?.reply_minutes);
  if (!l || !Number.isFinite(m) || m <= 0 || Number(l.reply_samples) < 3) return '';
  if (m <= 60) return 'Usually replies within an hour';
  if (m <= 180) return 'Usually replies within a few hours';
  if (m <= 1440) return 'Usually replies within a day';
  return '';
}

/** Ranking (v8.14): fast responders first after boosted listings — 3 = within an hour, 2 = a few hours, 1 = a day,
 *  0 = slower or not measured yet. Same bands as replyLabel and the website (site.js replyRank). */
export function replyRank(l?: { reply_minutes?: number | null; reply_samples?: number | null } | null): number {
  const m = Number(l?.reply_minutes);
  if (!l || !Number.isFinite(m) || m <= 0 || Number(l.reply_samples) < 3) return 0;
  return m <= 60 ? 3 : m <= 180 ? 2 : m <= 1440 ? 1 : 0;
}

/** {name} becomes the other person's first name. Plain text — it goes into the message box. */
export const fillTemplate = (body: string, name: string) =>
  String(body ?? '').replace(/\{name\}/gi, String(name ?? '').trim().split(/\s+/)[0] || 'there');

export interface ReplyTemplate { id: string; title: string; body: string; updated_at?: string }
export const TEMPLATE_MAX = 20;
export const DEFAULT_TEMPLATES: Record<'creator' | 'traveller', [string, string][]> = {
  creator: [
    ['Thanks!', "Hi {name}, thanks for your message! I'd love to photograph you. Which date and time of day are you thinking of?"],
    ['Free that day', "Hi {name}, yes, I'm free that day! You can book my package directly on my CapturaGo profile — your payment is protected until the shoot."],
    ['Meeting point', "Hi {name}, let's meet at … at … . I'll wear … so you can find me easily."],
  ],
  traveller: [
    ['Are you free?', 'Hi {name}! Are you free on … ? We would love a … shoot.'],
    ['Thank you', 'Thank you so much, {name}! See you soon.'],
  ],
};
export function templateProblem(title: string, body: string): string {
  if (!title.trim() || !body.trim()) return 'Add a name and a message.';
  if (title.trim().length > 40) return 'Keep the name under 40 characters.';
  if (body.trim().length > 1000) return 'Keep the message under 1000 characters.';
  return '';
}

/** On the creator's side of a chat: the traveller wrote last and is waiting (10+ minutes). */
export function waitingLabel(c: Pick<Conversation, 'creator_user_id' | 'client_user_id' | 'last_sender_id' | 'last_message_at' | 'blocked_by'>, uid: string, now = Date.now()): string {
  if (!c || c.blocked_by || c.creator_user_id !== uid || !c.last_sender_id || c.last_sender_id !== c.client_user_id) return '';
  const mins = (now - Date.parse(c.last_message_at)) / 60000;
  if (!(mins >= 10)) return '';
  const h = Math.floor(mins / 60);
  return `Waiting for your reply · ${h < 1 ? `${Math.round(mins)} min` : h < 48 ? `${h} h` : `${Math.floor(h / 24)} days`}`;
}
