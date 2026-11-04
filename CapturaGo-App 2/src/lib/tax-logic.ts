// v8.15 pure logic — EU DAC7 tax details. The same rules and messages as the database (save_tax_info), which
// checks everything again; the app only catches mistakes early.
export type TaxKind = 'individual' | 'business';
export interface TaxForm {
  kind: TaxKind; first_name?: string; last_name?: string; birth_date?: string; birth_place?: string; business_name?: string; business_number?: string;
  address: string; postal_code?: string; city: string; country: string; tin?: string; tin_country?: string; no_tin?: boolean; vat_number?: string;
}
export interface TaxInfo extends TaxForm { confirmed_at: string }
export interface MyTax { info: TaxInfo | null; required: boolean; asked_at: string | null; hold: boolean }

export const EU = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];
export const COUNTRIES = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');

const clean = (v?: string) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
const isIso = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
/** Age in whole years on `today` (YYYY-MM-DD). */
function ageOn(birth: string, today: string): number {
  const [by, bm, bd] = birth.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
export const normTin = (v?: string) => clean(v).toUpperCase().replace(/\s+/g, ' ');
export const normVat = (v?: string) => clean(v).toUpperCase().replace(/[\s.-]/g, '');

/** The first problem with the form (the database's own wording), or '' when it can be sent. */
export function taxProblem(f: TaxForm, today = new Date().toISOString().slice(0, 10)): string {
  if (f.kind !== 'individual' && f.kind !== 'business') return 'Choose whether you work as a private person or a business.';
  if (f.kind === 'individual') {
    const fn = clean(f.first_name), ln = clean(f.last_name);
    if (!fn || !ln || fn.length > 100 || ln.length > 100) return 'Enter your first and last name as on your ID.';
    const b = clean(f.birth_date);
    if (!isIso(b)) return 'Enter your date of birth.';
    const age = ageOn(b, today);
    if (age < 18 || age > 120) return 'Enter your date of birth (you must be 18 or older).';
  } else {
    const bn = clean(f.business_name), bz = clean(f.business_number);
    if (bn.length < 2 || bn.length > 200) return 'Enter the registered name of your business.';
    if (bz.length < 2 || bz.length > 40) return 'Enter your business registration number (e.g. IČO / trade register number).';
  }
  const ad = clean(f.address);
  if (ad.length < 3 || ad.length > 200) return 'Enter your street address.';
  const ci = clean(f.city);
  if (!ci || ci.length > 100) return 'Enter your city.';
  const pc = clean(f.postal_code);
  if (pc && (pc.length < 2 || pc.length > 20)) return 'Check your postal code.';
  if (!/^[A-Z]{2}$/.test(String(f.country ?? '').trim().toUpperCase())) return 'Choose the country where you live (for a business: where it is registered).';
  if (f.kind === 'individual' && f.no_tin) {
    const bp = clean(f.birth_place);
    if (bp.length < 2 || bp.length > 120) return 'Without a tax number, enter your place of birth (city and country).';
  } else {
    if (!/^[A-Z0-9][A-Z0-9 ./-]{2,29}$/.test(normTin(f.tin))) return 'Enter your tax identification number (TIN) — letters and numbers, as your tax office gave it to you.';
    const tc = String(f.tin_country || f.country || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(tc)) return 'Choose the country that issued your tax number.';
  }
  const vat = normVat(f.vat_number);
  if (vat && !/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(vat)) return 'A VAT number starts with the country code, e.g. SK2020123456. Leave it empty if you have none.';
  return '';
}
/** What is sent to save_tax_info: only the fields for this kind of seller. */
export function taxPayload(f: TaxForm): Record<string, unknown> {
  const biz = f.kind === 'business', noTin = !biz && !!f.no_tin;
  return {
    kind: f.kind, address: clean(f.address), postal_code: clean(f.postal_code), city: clean(f.city), country: String(f.country ?? '').trim().toUpperCase(),
    vat_number: normVat(f.vat_number), no_tin: noTin,
    ...(biz ? { business_name: clean(f.business_name), business_number: clean(f.business_number) } : { first_name: clean(f.first_name), last_name: clean(f.last_name), birth_date: clean(f.birth_date) }),
    ...(noTin ? { birth_place: clean(f.birth_place) } : { tin: normTin(f.tin), tin_country: String(f.tin_country || f.country || '').trim().toUpperCase() }),
  };
}
/** Country name in the reader's language (the phone knows them all). */
export function countryName(code: string, lang = 'en'): string {
  try { return new Intl.DisplayNames([lang, 'en'], { type: 'region' }).of(code) || code; } catch { return code; }
}
