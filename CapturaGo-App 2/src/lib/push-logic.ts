// v1.5 pure logic — push notifications. Which screen a tapped notification opens (only our own screens, only
// well-formed ids), and which tokens the server accepts (same rule as register_push_token in database.sql).
export const PUSH_TOKEN_RE = /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,200}\]$/;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CHAT = new RegExp(`^/chat/(${UUID})$`, 'i');
const CREATOR = new RegExp(`^/creator/(${UUID})$`, 'i');

export type PushRoute =
  | { pathname: '/bookings' }
  | { pathname: '/chat/[id]'; params: { id: string } }
  | { pathname: '/creator/[id]'; params: { id: string; date?: string } };

/** The screen for a notification's data ({ url, date? }) — or null for anything unexpected. */
export function routeFor(data: unknown): PushRoute | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const url = typeof d.url === 'string' ? d.url.trim() : '';
  if (url === '/bookings') return { pathname: '/bookings' };
  let m = url.match(CHAT);
  if (m) return { pathname: '/chat/[id]', params: { id: m[1].toLowerCase() } };
  m = url.match(CREATOR);
  if (m) {
    const date = typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : undefined;
    return { pathname: '/creator/[id]', params: { id: m[1].toLowerCase(), ...(date ? { date } : {}) } };
  }
  return null;
}
export const validPushToken = (t: unknown): t is string => typeof t === 'string' && PUSH_TOKEN_RE.test(t);
