// Pure helpers for private messages — no React Native imports, unit-tested in tests/chat.test.ts.

export interface Conversation {
  id: string;
  photographer_id: string;
  client_user_id: string;
  creator_user_id: string;
  client_name: string;
  last_message_at: string;
  last_message: string | null;
  last_sender_id: string | null;
  client_read_at: string;
  creator_read_at: string;
  blocked_by: string | null;
  created_at: string;
  photographers?: { name: string; city: string; cover_image_url?: string | null } | null;
}
export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  /** Local-only: still sending / failed to send */
  pending?: boolean;
  failed?: boolean;
}

export const MSG_MAX = 2000;

const myReadAt = (c: Conversation, uid: string) => (uid === c.client_user_id ? c.client_read_at : c.creator_read_at);

/** The other person wrote last, after I last opened the conversation. */
export const isUnread = (c: Conversation, uid: string) =>
  !!c.last_sender_id && c.last_sender_id !== uid && Date.parse(c.last_message_at) > Date.parse(myReadAt(c, uid));

export const unreadCount = (list: Conversation[], uid: string) => list.filter((c) => isUnread(c, uid)).length;

/** Who I'm talking to: the creator (for a traveller) or the traveller (for a creator). */
export function otherParty(c: Conversation, uid: string): { name: string; role: 'creator' | 'traveller'; city: string } {
  if (uid === c.creator_user_id) return { name: c.client_name || 'Traveller', role: 'traveller', city: '' };
  return { name: c.photographers?.name || 'Creator', role: 'creator', city: c.photographers?.city || '' };
}

const pad = (n: number) => String(n).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Inbox time: "14:05" today, "Yesterday", "Mon" this week, "12 Oct" this year, "12 Oct 2025" older. Local time. */
export function chatTime(iso: string, now = Date.now()): string {
  const d = new Date(iso), n = new Date(now);
  if (Number.isNaN(d.getTime())) return '';
  if (sameDay(d, n)) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  const ageDays = (n.getTime() - d.getTime()) / 86400000;
  if (ageDays > 0 && ageDays < 6) return WEEKDAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === n.getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}

/** Clock time under a bubble. */
export const bubbleTime = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** Separator between days in a conversation. */
export function dayLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso), n = new Date(now);
  if (sameDay(d, n)) return 'Today';
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** Merge server messages into what's on screen: no duplicates, oldest first, unsent ones kept at the end. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of current) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, { ...m, pending: false, failed: false });
  const all = [...byId.values()];
  const sent = all.filter((m) => !m.pending && !m.failed).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
  const local = all.filter((m) => m.pending || m.failed);
  return [...sent, ...local];
}

/** Rows for the chat list (newest first, for an inverted list), with a day separator above each new day. */
export type ChatRow = { kind: 'msg'; key: string; m: ChatMessage; mine: boolean; first: boolean } | { kind: 'day'; key: string; label: string };
export function chatRows(messages: ChatMessage[], uid: string, now = Date.now()): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastDay = '', lastSender = '';
  for (const m of messages) {
    const d = new Date(m.created_at);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== lastDay) { rows.push({ kind: 'day', key: `day-${dayKey}`, label: dayLabel(m.created_at, now) }); lastDay = dayKey; lastSender = ''; }
    rows.push({ kind: 'msg', key: m.id, m, mine: m.sender_id === uid, first: m.sender_id !== lastSender });
    lastSender = m.sender_id;
  }
  return rows.reverse();
}

/** Messages that try to move payment off CapturaGo get a gentle safety tip (they are not blocked). */
const OFF_PLATFORM = /\b(pay\s*pal|revolut|western\s*union|money\s*gram|wise\.com|iban|bank\s*transfer|wire\s*transfer|crypto|bitcoin|usdt|pay\s+(me\s+)?(directly|in\s+cash|outside)|cash\s+only|whats\s*app|telegram)\b/i;
export const looksOffPlatform = (text: string) => OFF_PLATFORM.test(text);

/** Clean up text before sending. Returns an error message or the text to send. */
export function prepareMessage(raw: string): { error: string } | { text: string } {
  const text = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return { error: 'Write a message first.' };
  if (text.length > MSG_MAX) return { error: `Messages can be up to ${MSG_MAX} characters.` };
  return { text };
}
