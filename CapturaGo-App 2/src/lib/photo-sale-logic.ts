// v1.7 pure logic — extra photos for sale in the gallery. Same rules as the database (set_photo_extras,
// delivery_visible) and the server (buy-photos), which check everything again.
import { CLIENT_FEE_PCT } from './config';

export interface SalePhoto { id: string; extra?: boolean | null; unlocked_at?: string | null }
/** For sale and not bought yet → the traveller only sees the small preview. Selling stopped → part of the gallery. */
export const isLocked = (p: SalePhoto, priceCents: number | null | undefined) => !!(p.extra && !p.unlocked_at && priceCents);
/** What the traveller pays: the creator's price per photo × photos, plus the service fee (rounded like the server). */
export function photoTotal(count: number, unitCents: number, feePct = CLIENT_FEE_PCT): { price: number; fee: number; total: number } {
  const price = Math.max(0, Math.round(count)) * unitCents;
  const fee = Math.round((price * feePct) / 100);
  return { price, fee, total: price + fee };
}
/** Euros typed by the creator → cents (€1–€100), or null when it isn't a valid price. */
export function priceToCents(v: string): number | null {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 1 || n > 100) return null;
  return Math.round(n * 100);
}
/** The photos beyond the number the package promised (in upload order) that aren't for sale or bought yet —
 *  what "sell the rest" would still change (empty once they're all for sale). */
export function beyondPromised<T extends SalePhoto>(photos: T[], promised: number): T[] {
  return promised > 0 ? photos.slice(promised).filter((p) => !p.unlocked_at && !p.extra) : [];
}
/** Included / for sale / bought, for the creator's summary line. */
export function saleCounts(photos: SalePhoto[], priceCents: number | null | undefined) {
  const bought = photos.filter((p) => p.unlocked_at).length;
  const extra = photos.filter((p) => isLocked(p, priceCents)).length;
  return { included: photos.length - bought - extra, extra, bought };
}
