/* Gift cards and split payments — the same rules as the website (site.js) and the server. */
import type { Booking } from './logic';

export interface GiftCard {
  id: string;
  code: string | null;   // only while active
  amount_cents: number;
  balance_cents: number;
  status: 'pending_payment' | 'active' | 'refunded' | 'expired_checkout';
  recipient_name: string | null;
  recipient_email: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
}
export interface BookingShare {
  share_no: number;
  amount_cents: number;
  status: 'pending' | 'paid' | 'refunded';
  token: string | null;   // the payment link, while the share is open
  paid_at: string | null;
  paid_by_me: boolean;
}

/** How much of a total a gift card balance pays: everything, or leaves at least €0.50 to pay by card. */
export function giftCover(totalCents: number, balanceCents: number): number {
  const t = Math.max(0, Math.round(Number(totalCents) || 0)), g = Math.max(0, Math.round(Number(balanceCents) || 0));
  if (!t || !g) return 0;
  if (g >= t) return t;
  return t - g < 50 ? Math.max(0, t - 50) : g;
}
/** Shares of a split booking: equal; the organiser (share 1) takes the cents that don't divide. */
export function splitShares(totalCents: number, n: number): number[] {
  const t = Math.round(Number(totalCents) || 0), k = Math.min(Math.max(Math.round(Number(n) || 1), 1), 6);
  const each = Math.floor(t / k);
  return Array.from({ length: k }, (_, i) => (i === 0 ? t - each * (k - 1) : each));
}
/** "cg abcd efgh…" → "CG-ABCD-EFGH-JKMN-PQRS", or '' if it can't be a code. */
export function giftCodeNorm(v: string): string {
  const x = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^CG[A-HJ-NP-Z2-9]{16}$/.test(x) ? `CG-${x.slice(2, 6)}-${x.slice(6, 10)}-${x.slice(10, 14)}-${x.slice(14, 18)}` : '';
}
/** One line about a split booking that is still collecting payments ('' otherwise). */
export function splitNote(b: Pick<Booking, 'split_count' | 'status' | 'split_deadline'>, paidCount?: number | null, now = Date.now()): string {
  if (!b || Number(b.split_count) <= 1 || b.status !== 'pending_payment' || !b.split_deadline) return '';
  const left = Date.parse(b.split_deadline) - now;
  if (!(left > 0)) return '⏳ The time to pay has run out — everyone who paid is refunded.';
  const mins = Math.max(1, Math.round(left / 60000)), h = Math.floor(mins / 60), m = mins % 60;   // never "60 min"
  const time = h >= 1 ? `${h} h ${m} min` : `${m} min`;
  return `👯 ${paidCount == null ? `Split ${b.split_count} ways` : `${Number(paidCount) || 0} of ${b.split_count} paid`} · ${time} left for everyone to pay`;
}
/** Friends are paying (the organiser paid; more than the first 30 minutes left). */
export const friendsPaying = (b: Booking, now = Date.now()) =>
  b.status === 'pending_payment' && Number(b.split_count) > 1 && !!b.split_deadline && Date.parse(b.split_deadline) - now > 31 * 60000;
/** The amount line on a traveller's booking card. */
export function clientAmountText(b: Booking, euro: (c: number) => string): string {
  if (Number(b.split_count) > 1) return `${euro(b.total_cents)} split ${b.split_count} ways`;
  if (b.status === 'pending_payment') return `${euro(b.total_cents)} to pay`;
  const g = Number(b.gift_cents) || 0;
  return g ? `You paid ${euro(b.total_cents)} (${euro(g)} gift card)` : `You paid ${euro(b.total_cents)}`;
}
/** Shoot at least 3 days away (split needs time for friends to pay) — same rule as the server. */
export const splitDateOk = (date: string | null, now = Date.now()) => !!date && date >= new Date(now + 3 * 86400000).toISOString().slice(0, 10);
