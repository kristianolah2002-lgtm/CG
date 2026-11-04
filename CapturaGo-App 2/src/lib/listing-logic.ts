// Creator listing editor rules — a 1:1 copy of the website dashboard (dashboard.js + taxonomy.js),
// same limits and the same error messages. Pure; unit-tested in tests/listing.test.ts.
import { services as SERVICES, vibes as VIBES } from './taxonomy-data';
import type { Listing, Package } from './logic';

export const MAX_SPOTS = 8;
export const MAX_PACKAGES = 5;
export const BIO_MAX = 600;
export const PKG_MINUTES = [30, 45, 60, 90, 120, 180, 240, 480];
export const PKG_TURNAROUND = [1, 2, 3, 5, 7, 10, 14, 21, 30];
export const PKG_REVISIONS = [0, 1, 2, 3];
export const LEVELS: [string, string][] = [['enthusiast', 'Enthusiast'], ['semipro', 'Semi-pro'], ['pro', 'Professional']];
export const PRICES: [string, string][] = [['budget', 'Under €80'], ['mid', '€80–€250'], ['premium', '€250+']];
export const minutesLabel = (m: number) => (m < 60 ? `${m} min` : `${m / 60} h`);

export const DRONE_REGIONS = [
  { id: 'easa', label: 'EU / EEA / Switzerland (EASA rules)' },
  { id: 'faa', label: 'United States (FAA rules)' },
  { id: 'other', label: 'Another country' },
] as const;
export type DroneRegion = '' | 'easa' | 'faa' | 'other';

export interface DroneDraft {
  region: DroneRegion; euOp: string; euWeight: '' | 'sub250' | '250plus'; euCert: string;
  usCert: string; usReg: string; otherReg: string; declared: boolean;
}
export interface PackageDraft {
  id?: string; name: string; type: 'session' | 'delivery'; price: string;
  minutes: number; days: number; revisions: number; desc: string;
  photos: string; editDays: number; includes: string;
}
export interface SpotDraft { name: string; desc: string }
export interface ListingDraft {
  name: string; city: string; email: string; portfolio: string; languages: string;
  price: string; level: string; travel: boolean; bio: string;
  services: string[]; vibes: string[]; occasions: string[];
  spots: SpotDraft[]; packages: PackageDraft[]; drone: DroneDraft;
}

export const emptyDrone = (): DroneDraft => ({ region: '', euOp: '', euWeight: '', euCert: '', usCert: '', usReg: '', otherReg: '', declared: false });
export const emptyPackage = (): PackageDraft => ({ name: '', type: 'session', price: '', minutes: 60, days: 3, revisions: 1, desc: '', photos: '', editDays: 0, includes: '' });
export const PKG_EDIT_DAYS = [1, 2, 3, 5, 7, 10, 14, 21, 30];

/** Pre-fill the editor from a saved listing (or a new, empty one). */
export function draftFrom(l: Listing | null, fallbackName: string, email: string, drone?: { region?: string | null; info?: Record<string, string | null> | null } | null): ListingDraft {
  const spots = l ? (Array.isArray(l.local_spots) ? l.local_spots : []).map((s) => (typeof s === 'string' ? { name: s, desc: '' } : { name: s.name || '', desc: s.desc || (s as { description?: string }).description || '' })) : [];
  const info = drone?.info ?? {};
  const region = (drone?.region ?? l?.drone_region ?? '') as DroneRegion;
  return {
    name: l?.name || fallbackName || '', city: l?.city || '', email, portfolio: l?.portfolio_url || '',
    languages: l?.languages || '', price: l?.price || 'mid', level: l?.level || 'semipro', travel: !!l?.travel_available,
    bio: l?.description || '',
    services: l?.services?.length ? [...l.services] : l?.type ? [l.type] : [],
    vibes: [...(l?.vibes ?? [])], occasions: [...(l?.occasions ?? [])],
    spots: spots.slice(0, MAX_SPOTS),
    packages: (Array.isArray(l?.packages) ? l!.packages! : []).slice(0, MAX_PACKAGES).map((k: Package) => ({
      id: k.id, name: k.name || '', type: k.type === 'delivery' ? 'delivery' : 'session', price: k.price_eur != null ? String(k.price_eur) : '',
      minutes: Number(k.minutes) || 60, days: Number(k.delivery_days) || 3, revisions: k.revisions ?? 1, desc: k.desc || '',
      photos: Number(k.photos) > 0 ? String(k.photos) : '', editDays: Number(k.edit_days) > 0 ? Number(k.edit_days) : 0,
      includes: (Array.isArray(k.includes) ? k.includes : []).join(', '),
    })),
    drone: {
      region, declared: !!region,
      euOp: region === 'easa' ? info.operator || '' : '', euWeight: region === 'easa' ? ((info.weight as DroneDraft['euWeight']) || '') : '', euCert: region === 'easa' ? info.cert || '' : '',
      usCert: region === 'faa' ? info.cert || '' : '', usReg: region === 'faa' ? info.registration || '' : '',
      otherReg: region === 'other' ? info.registration || '' : '',
    },
  };
}

const clean = (v: string) => String(v || '').trim().toUpperCase().replace(/\s+/g, '');

/** Same checks as the website's readDrone(). */
export function readDrone(d: DroneDraft): { error: string } | { region: DroneRegion; info: Record<string, string | null> } {
  if (!DRONE_REGIONS.some((r) => r.id === d.region)) return { error: 'Choose where you fly your drone for clients.' };
  let info: Record<string, string | null>;
  if (d.region === 'easa') {
    const raw = clean(d.euOp);
    if (/-/.test(raw)) return { error: 'Enter only the public 16-character operator number, without the secret part after the dash.' };
    if (!/^[A-Z]{3}[A-Z0-9]{13}$/.test(raw)) return { error: 'EU operator numbers have 16 characters and start with a 3-letter country code (e.g. SVK…).' };
    if (d.euWeight !== 'sub250' && d.euWeight !== '250plus') return { error: "Choose your drone's weight." };
    const cert = clean(d.euCert);
    if (d.euWeight === '250plus' && !/^[A-Z0-9./-]{4,40}$/.test(cert)) return { error: 'Drones of 250 g or more need an A1/A3 or A2 certificate number.' };
    info = { operator: raw, weight: d.euWeight, cert: d.euWeight === '250plus' ? cert : null };
  } else if (d.region === 'faa') {
    const cert = clean(d.usCert), reg = clean(d.usReg);
    if (!/^[A-Z0-9-]{4,20}$/.test(cert)) return { error: 'Enter your FAA Part 107 certificate number.' };
    if (!/^FA[A-Z0-9]{6,14}$/.test(reg)) return { error: 'FAA drone registration numbers start with "FA".' };
    info = { cert, registration: reg };
  } else {
    const reg = String(d.otherReg || '').trim().slice(0, 60);
    if (reg && !/^[\p{L}\p{N} ./-]{2,60}$/u.test(reg)) return { error: 'The permit number can only contain letters, numbers, spaces, dots, slashes and dashes.' };
    info = { registration: reg || null };
  }
  if (!d.declared) return { error: 'Please confirm your drone details and that you follow the local drone rules.' };
  return { region: d.region, info };
}

const isHttpUrl = (s: string) => { try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; } };
const SERVICE_LABELS = Object.fromEntries(SERVICES.map((x) => [x.id, x.label]));
const VIBE_LABELS = Object.fromEntries(VIBES.map((x) => [x.id, x.label]));

/** Validate the editor and build the database payload (without coords and cover photo, added by the screen).
 *  Same order of checks and messages as the website, so creators get the same answers everywhere. */
export function buildListingPayload(d: ListingDraft, now = Date.now()): { error: string } | { payload: Record<string, unknown> } {
  const name = d.name.trim(), city = d.city.trim(), email = d.email.trim(), portfolio = d.portfolio.trim();
  const spots = d.spots.map((s) => ({ name: s.name.trim().slice(0, 80), desc: s.desc.trim().slice(0, 200) })).filter((s) => s.name).slice(0, MAX_SPOTS);
  if (!name || !city || !email || !portfolio) return { error: 'Please fill in all fields marked *.' };
  const services = d.services.filter((s) => SERVICE_LABELS[s]);
  if (!services.length) return { error: 'Select at least one service.' };
  let drone: { region: DroneRegion | null; info: Record<string, string | null> | null } = { region: null, info: null };
  if (services.includes('drone')) {
    const r = readDrone(d.drone);
    if ('error' in r) return { error: r.error };
    drone = r;
  }
  const packages: Package[] = [];
  for (const row of d.packages.slice(0, MAX_PACKAGES)) {
    const pname = row.name.trim();
    const priceRaw = row.price.trim().replace(',', '.');
    if (!pname && !priceRaw) continue;
    const price = Number(priceRaw);
    if (!pname) return { error: 'Every package needs a name.' };
    if (!priceRaw || !Number.isFinite(price) || price < 10 || price > 5000) return { error: `"${pname}": price must be between €10 and €5000.` };
    const pkg: Package = {
      id: row.id || `p${now.toString(36)}${packages.length}`,
      name: pname.slice(0, 60),
      price_eur: Math.round(price * 100) / 100,
      desc: row.desc.trim().slice(0, 200),
    };
    if (row.photos.trim()) {
      const n = Number(row.photos.trim());
      if (!Number.isInteger(n) || n < 1 || n > 2000) return { error: `"${pname}": edited photos must be a whole number from 1 to 2000.` };
      pkg.photos = n;
    }
    const incl = row.includes.split(',').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (incl.length > 6) return { error: `"${pname}": up to 6 things in "Also included".` };
    if (incl.some((x) => x.length > 60)) return { error: `"${pname}": keep each "Also included" item under 60 characters.` };
    if (incl.length) pkg.includes = incl;
    if (row.type === 'delivery') {
      pkg.type = 'delivery';
      pkg.delivery_days = PKG_TURNAROUND.includes(row.days) ? row.days : 3;
      pkg.revisions = PKG_REVISIONS.includes(row.revisions) ? row.revisions : 0;
    } else {
      pkg.minutes = PKG_MINUTES.includes(row.minutes) ? row.minutes : null;
      if (PKG_EDIT_DAYS.includes(row.editDays)) pkg.edit_days = row.editDays;
    }
    packages.push(pkg);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email.' };
  if (!/^https?:\/\//i.test(portfolio) || !isHttpUrl(portfolio)) return { error: 'Portfolio link must start with https://' };
  const vibes = d.vibes.filter((v) => VIBE_LABELS[v]);
  return {
    payload: {
      name: name.slice(0, 80), city: city.slice(0, 80), email,
      type: services[0], services, vibes, occasions: [...d.occasions],
      drone_certified: !!drone.region, drone_region: drone.region, drone_info: drone.info,
      specialties: services.map((s) => SERVICE_LABELS[s]).join(', '),
      tags: vibes.map((v) => VIBE_LABELS[v]),
      description: d.bio.trim().slice(0, BIO_MAX) || null,
      local_spots: spots,
      portfolio_url: portfolio,
      price: PRICES.some(([k]) => k === d.price) ? d.price : 'mid',
      level: LEVELS.some(([k]) => k === d.level) ? d.level : 'semipro',
      languages: d.languages.trim().slice(0, 120) || null,
      travel_available: d.travel,
      packages,
    },
  };
}

/** What a creator still needs before travellers can book online (website "Get booked online" checklist). */
export function bookableChecklist(l: Listing | null): { packages: boolean; payouts: boolean } | null {
  if (!l) return null;
  return { packages: Array.isArray(l.packages) && l.packages.length > 0, payouts: !!l.payouts_enabled };
}

/** Stripe payout countries offered on the website. */
export const PAYOUT_COUNTRIES: [string, string][] = [['SK', 'Slovakia'], ['CZ', 'Czechia'], ['AT', 'Austria'], ['DE', 'Germany'], ['HU', 'Hungary'], ['PL', 'Poland'], ['FR', 'France'], ['IT', 'Italy'], ['ES', 'Spain'], ['PT', 'Portugal'], ['GR', 'Greece'], ['NL', 'Netherlands'], ['BE', 'Belgium'], ['IE', 'Ireland'], ['GB', 'United Kingdom'], ['CH', 'Switzerland'], ['HR', 'Croatia'], ['SI', 'Slovenia'], ['RO', 'Romania'], ['BG', 'Bulgaria'], ['DK', 'Denmark'], ['SE', 'Sweden'], ['NO', 'Norway'], ['FI', 'Finland'], ['US', 'United States'], ['CA', 'Canada'], ['AU', 'Australia'], ['JP', 'Japan'], ['TH', 'Thailand'], ['ID', 'Indonesia'], ['MX', 'Mexico']];

/** Minimal base64 → bytes decoder (used to upload the cover photo; works the same on every platform). */
export function base64ToBytes(b64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean64 = b64.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean64.length * 3) / 4));
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < clean64.length; i++) {
    buf = (buf << 6) | alphabet.indexOf(clean64[i]);
    bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xff; }
  }
  return out.slice(0, o);
}
