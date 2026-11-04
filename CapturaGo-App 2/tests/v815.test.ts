// v8.15 rules in the app: EU DAC7 tax details. The app checks the form with the same rules and wording as the
// database (save_tax_info in database.sql), which checks everything again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { COUNTRIES, EU, taxPayload, taxProblem, type TaxForm } from '../src/lib/tax-logic';
import { WEB_DIR } from './web';

const DB = `${WEB_DIR}/database.sql`;
const TODAY = '2026-11-04';
const ok: TaxForm = { kind: 'individual', first_name: ' Ana ', last_name: 'Novak', birth_date: '1990-05-01', address: 'Hauptstraße 1', postal_code: '1010', city: 'Wien', country: 'at', tin: '12-345/6789', vat_number: 'at u12345678' };

test('tax form: a complete private person passes', () => assert.equal(taxProblem(ok, TODAY), ''));
test('tax form: the same refusals as the database', () => {
  const p = (o: Partial<TaxForm>) => taxProblem({ ...ok, ...o } as TaxForm, TODAY);
  assert.match(p({ kind: 'robot' as never }), /private person or a business/);
  assert.match(p({ last_name: '' }), /first and last name/);
  assert.match(p({ birth_date: '1990-02-31' }), /^Enter your date of birth\.$/);
  assert.match(p({ birth_date: '2008-11-05' }), /18 or older/, 'one day before 18');
  assert.equal(p({ birth_date: '2008-11-04' }), '', 'exactly 18');
  assert.match(p({ address: 'ab' }), /street address/);
  assert.match(p({ city: ' ' }), /your city/);
  assert.match(p({ postal_code: 'X' }), /postal code/);
  assert.match(p({ country: 'Austria' }), /country where you live/);
  assert.match(p({ tin: '!!' }), /tax identification number/);
  assert.match(p({ vat_number: '12345' }), /VAT number starts with the country code/);
  assert.match(p({ no_tin: true, tin: '' }), /place of birth/);
  assert.equal(p({ no_tin: true, tin: '', birth_place: 'Brno, Czechia' }), '');
  assert.match(taxProblem({ kind: 'business', business_name: 'Bo Studio', address: 'Jl. Raya 5', city: 'Ubud', country: 'ID', tin: '01.234' }, TODAY), /registration number/);
  assert.equal(taxProblem({ kind: 'business', business_name: 'Bo Studio', business_number: 'AHU-1', address: 'Jl. Raya 5', city: 'Ubud', country: 'ID', tin: '01.234.567.8-901.000' }, TODAY), '');
});
test('tax form: what is sent (only the fields for this kind of seller, normalised like the database)', () => {
  assert.deepEqual(taxPayload(ok), { kind: 'individual', address: 'Hauptstraße 1', postal_code: '1010', city: 'Wien', country: 'AT', vat_number: 'ATU12345678', no_tin: false,
    first_name: 'Ana', last_name: 'Novak', birth_date: '1990-05-01', tin: '12-345/6789', tin_country: 'AT' });
  const nt = taxPayload({ ...ok, no_tin: true, birth_place: 'Brno' });
  assert.equal(nt.birth_place, 'Brno'); assert.ok(!('tin' in nt));
  const biz = taxPayload({ kind: 'business', business_name: 'X', business_number: 'Y', address: 'A', city: 'B', country: 'id', tin: 'z1', no_tin: true });
  assert.equal(biz.no_tin, false, 'a business always gives a tax number'); assert.ok(!('first_name' in biz)); assert.equal(biz.tin, 'Z1');
});
test('tax form: every message is the database\'s own wording, and the EU list is the report\'s', { skip: !existsSync(DB) && 'website not next to the app' }, () => {
  const sql = readFileSync(DB, 'utf8');
  const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION save_tax_info'), sql.indexOf('REVOKE ALL ON FUNCTION save_tax_info'));
  const msgs = [...fn.matchAll(/RAISE EXCEPTION '((?:[^']|'')+)'/g)].map((m) => m[1].replace(/''/g, "'")).filter((m) => !/sign in|listing first/i.test(m));
  const p = (o: Partial<TaxForm>) => taxProblem({ ...ok, ...o } as TaxForm, TODAY);
  const app = new Set([p({ kind: 'robot' as never }), p({ last_name: '' }), p({ birth_date: 'x' }), p({ birth_date: '2015-01-01' }), p({ address: '' }), p({ city: '' }), p({ postal_code: 'X' }),
    p({ country: '' }), p({ no_tin: true, tin: '' }), p({ tin: '!' }), p({ vat_number: '1' }), taxProblem({ kind: 'business', address: 'A 1', city: 'B', country: 'ID', tin: 'X12' }, TODAY),
    taxProblem({ kind: 'business', business_name: 'Bo', address: 'A 1', city: 'B', country: 'ID', tin: 'X12' }, TODAY)]);
  for (const m of msgs) if (m !== 'Choose the country that issued your tax number.') assert.ok(app.has(m), `app says: ${m}`);
  const eu = (sql.match(/'reportable', t\.country = ANY\(ARRAY\[([^\]]+)\]/) || [])[1];
  assert.deepEqual(eu.replace(/'/g, '').split(',').map((x) => x.trim()), EU);
  for (const c of EU) assert.ok(COUNTRIES.includes(c), c);
});
