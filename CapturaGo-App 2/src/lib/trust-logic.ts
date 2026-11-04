// v8.10 pure logic — what's included in a package, the rules that protect travellers, intro video links,
// "a full shoot" and the trust line. Same rules and wording as the website (site.js) and database.sql Part 11.
import type { Booking, Package } from './logic';
import { isDelivery } from './logic';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** Short lines: ⏱ 1 h shoot · 📷 30 edited photos · 📬 Photos within 5 days · ✓ Location scouting … */
export function packageFacts(k?: Partial<Package> | null): string[] {
  if (!k) return [];
  const out: string[] = [];
  const remote = k.type === 'delivery';
  const m = Number(k.minutes);
  if (!remote && m > 0) out.push(`⏱ ${m < 60 ? `${m} min` : `${m / 60} h`} shoot`);
  if (Number(k.photos) > 0) out.push(`📷 ${plural(Math.round(Number(k.photos)), 'edited photo')}`);
  if (!remote && Number(k.edit_days) > 0) out.push(`📬 Photos within ${plural(Math.round(Number(k.edit_days)), 'day')}`);
  if (remote && Number(k.delivery_days) > 0) out.push(`📬 Delivered in ${plural(Math.round(Number(k.delivery_days)), 'day')}`);
  if (remote) out.push(`✏️ ${plural(Math.round(Number(k.revisions) || 0), 'revision')}`);
  (Array.isArray(k.includes) ? k.includes : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 6).forEach((x) => out.push(`✓ ${x.trim().slice(0, 60)}`));
  return out;
}
/** The rules that protect the traveller — shown on every package. */
export function packageRules(type?: string): string[] {
  if (type === 'delivery') return ['Full refund if it isn’t delivered on time', 'Payment released only when you approve'];
  return ['Free cancellation up to 7 days before', 'Bad weather? Move the date for free if you both agree', 'Full refund if the creator cancels or doesn’t show up'];
}

const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com', 'vimeo.com'];
/** Intro video: a link to YouTube, Instagram, TikTok or Vimeo only (opened there, never embedded). */
export function introVideoOk(u?: string | null): boolean {
  const s = String(u ?? '').trim();
  if (!s || s.length > 300) return false;
  try {
    const x = new URL(s);
    const host = x.hostname.toLowerCase();
    return x.protocol === 'https:' && !x.username && !x.password && VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch { return false; }
}

/** "📸 12 completed shoots on CapturaGo · On CapturaGo since October 2026" */
export function trustLine(l: { completed_shoots?: number | null; created_at?: string }): string {
  const n = Number(l.completed_shoots) || 0;
  const since = l.created_at ? new Date(l.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '';
  return [n > 0 ? `📸 ${plural(n, 'completed shoot')} on CapturaGo` : '', since ? `On CapturaGo since ${since}` : ''].filter(Boolean).join(' · ');
}

/** When the photos are promised for an in-person shoot ("within N days" in the package), or '' */
export function photosDue(b: Booking): string {
  const d = Math.round(Number(b.package_details?.edit_days));
  if (isDelivery(b) || !(d >= 1 && d <= 60)) return '';
  return new Date(Date.parse(`${b.shoot_date}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
}
export const SAMPLE_MAX = 40;
