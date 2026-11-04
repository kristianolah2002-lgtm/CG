/* Last-minute deals and text-reminder numbers — the same rules as the website (site.js) and the server. */
import type { Deal } from './api';

/** The package price on a deal day, in cents (the server rounds the same way). */
export function dealCents(priceEur: number, pct: number | null | undefined): number {
  const p = Math.round(Number(pct) || 0);
  return Math.round((Number(priceEur) * 100 * (100 - (p >= 10 && p <= 50 ? p : 0))) / 100);
}
/** "tomorrow" or "Fri 6 Nov" (dates in UTC, like the server's days). */
export function dealDay(iso: string, nowMs: number = Date.now()): string {
  const t = new Date(nowMs + 86400000).toISOString().slice(0, 10);
  return iso === t ? 'tomorrow' : new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
/** Live deals by creator; ignores anything odd. */
export function dealsByCreator(list: Deal[] | null | undefined): Map<string, { day: string; pct: number }[]> {
  const out = new Map<string, { day: string; pct: number }[]>();
  for (const d of list ?? []) {
    const pct = Math.round(Number(d && d.pct));
    if (!d || !(pct >= 10 && pct <= 50) || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.day))) continue;
    if (!out.has(d.photographer_id)) out.set(d.photographer_id, []);
    out.get(d.photographer_id)!.push({ day: d.day, pct });
  }
  return out;
}
export const DEAL_PCTS = [10, 15, 20, 25, 30, 40, 50];

/** "+421 900 123 456" / "00421900123456" → "+421900123456"; '' if it can't be a mobile number (same as the server). */
export function normPhone(raw: string): string {
  let s = String(raw || '').trim().replace(/[\s().\-/]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  return /^\+[1-9][0-9]{6,14}$/.test(s) ? s : '';
}
