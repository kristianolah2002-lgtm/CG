// Tax details (EU DAC7): what a platform must collect from the creators it pays. Same form and rules as the
// website's dashboard; the database (save_tax_info) checks everything again.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { color, space } from '../theme';
import { Button, Card, Checkbox, Empty, Field, Loading, Segmented, SelectField, Txt, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { getLang } from '../lib/i18n';
import { fmtDate } from '../lib/logic';
import { COUNTRIES, countryName, taxPayload, taxProblem, type MyTax, type TaxForm, type TaxKind } from '../lib/tax-logic';

const KINDS: [TaxKind, string][] = [['individual', 'A private person'], ['business', 'A business (company or registered sole trader)']];
const EMPTY: TaxForm = { kind: 'individual', address: '', city: '', country: '' };

export default function TaxScreen() {
  const { user, ready } = useAuth();
  const toast = useToast();
  const [me, setMe] = useState<MyTax | null | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);
  const [f, setF] = useState<TaxForm>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const lang = getLang();
  const countries = useMemo<[string, string][]>(() => COUNTRIES.map((c): [string, string] => [c, countryName(c, lang)]).sort((a, b) => a[1].localeCompare(b[1], lang)), [lang]);
  const tinCountries = useMemo<[string, string][]>(() => [['', 'Same as above'], ...countries], [countries]);

  const load = useCallback(async () => {
    const { data, error } = await api.tax.mine();
    if (error) { setUnavailable(true); setMe(null); return; }
    setMe(data ?? null);
    if (data?.info) { const { confirmed_at: _c, ...rest } = data.info; setF({ ...EMPTY, ...stripNulls(rest) }); }
    setEditing(!data?.info);
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (!ready) return <Loading />;
  if (!user) return <Empty title="Sign in first" text="Tax details are for creators who are paid through CapturaGo." action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (me === undefined) return <Loading />;
  if (unavailable) return <Empty title="Not available yet" text="Tax details need the latest update. Please try again later." />;

  const set = (k: keyof TaxForm) => (v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setErr(''); };
  const biz = f.kind === 'business';

  async function save() {
    const problem = taxProblem(f);
    if (problem) { setErr(problem); return; }
    if (!confirm) { setErr('Please confirm that your details are correct.'); return; }
    setBusy(true);
    const { data, error } = await api.tax.save(taxPayload(f));
    setBusy(false);
    if (error || !data) { setErr(error?.message || 'Could not save your tax details.'); return; }
    toast('Tax details saved ✓', 'success');
    setMe(data); setEditing(false); setConfirm(false);
  }

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled" testID="tax-screen">
      <Txt v="muted">EU law (DAC7) requires platforms to collect the tax details of creators who are paid through them and to report their earnings to the tax authority once a year. You get a copy every January. Only you and the CapturaGo team can see these details.</Txt>
      {me?.hold && !me.info ? (
        <Card style={{ marginTop: space.lg, borderColor: color.err }} testID="tax-hold"><Txt v="h3" style={{ color: color.err }}>Your payouts are on hold until you add these details.</Txt></Card>
      ) : me?.required && !me.info ? (
        <Card style={{ marginTop: space.lg }} testID="tax-required"><Txt v="body">Please add your details — we need them before we can report your earnings.</Txt></Card>
      ) : !me?.info ? (
        <Txt v="small" style={{ marginTop: space.md }}>{"You'll need these once you can be paid online. You can add them now."}</Txt>
      ) : null}

      {me?.info && !editing ? (
        <Card style={{ marginTop: space.lg }} testID="tax-saved">
          <Txt v="h3" style={{ color: color.ok }}>✓ Saved</Txt>
          <Txt v="body" raw style={{ marginTop: space.sm }}>{me.info.kind === 'business' ? me.info.business_name : `${me.info.first_name ?? ''} ${me.info.last_name ?? ''}`.trim()}</Txt>
          <Txt v="small" raw>{[me.info.address, [me.info.postal_code, me.info.city].filter(Boolean).join(' '), countryName(me.info.country, lang)].filter(Boolean).join(', ')}</Txt>
          {me.info.tin ? <Txt v="small" raw>{`TIN ${me.info.tin}${me.info.tin_country ? ` (${me.info.tin_country})` : ''}`}</Txt> : null}
          {me.info.vat_number ? <Txt v="small" raw>{`VAT ${me.info.vat_number}`}</Txt> : null}
          <Txt v="small" style={{ marginTop: space.xs }}>{fmtDate(me.info.confirmed_at)}</Txt>
          <Button testID="tax-edit" title="Edit my tax details" kind="secondary" small onPress={() => setEditing(true)} style={{ alignSelf: 'flex-start', marginTop: space.md }} />
        </Card>
      ) : (
        <Card style={{ marginTop: space.lg }} testID="tax-form">
          <Segmented testID="tax-kind" options={KINDS} value={f.kind} onChange={(v) => set('kind')(v)} />
          <View style={{ height: space.lg }} />
          {biz ? (
            <>
              <Field testID="tax-bname" label="Registered business name" value={f.business_name ?? ''} onChangeText={set('business_name')} maxLength={200} autoComplete="organization" />
              <Field testID="tax-bnum" label="Business registration number" value={f.business_number ?? ''} onChangeText={set('business_number')} maxLength={40} autoCapitalize="characters" />
            </>
          ) : (
            <>
              <Field testID="tax-first" label="First name(s)" hint="As on your ID." value={f.first_name ?? ''} onChangeText={set('first_name')} maxLength={100} autoComplete="given-name" textContentType="givenName" />
              <Field testID="tax-last" label="Last name" value={f.last_name ?? ''} onChangeText={set('last_name')} maxLength={100} autoComplete="family-name" textContentType="familyName" />
              <Field testID="tax-birth" label="Date of birth" value={f.birth_date ?? ''} onChangeText={set('birth_date')} placeholder="YYYY-MM-DD" maxLength={12} keyboardType="numbers-and-punctuation" autoComplete="birthdate-full" />
            </>
          )}
          <Field testID="tax-address" label="Street and number" value={f.address} onChangeText={set('address')} maxLength={200} autoComplete="street-address" textContentType="streetAddressLine1" />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Field testID="tax-postal" label="Postal code" value={f.postal_code ?? ''} onChangeText={set('postal_code')} maxLength={20} autoComplete="postal-code" style={{ flex: 1 }} />
            <Field testID="tax-city" label="City" value={f.city} onChangeText={set('city')} maxLength={100} style={{ flex: 2 }} />
          </View>
          <SelectField testID="tax-country" label="Country where you live" value={f.country} options={countries} onChange={set('country')} />
          {biz ? <Txt v="small" style={{ marginTop: -space.md, marginBottom: space.lg }}>For a business: where it is registered.</Txt> : null}
          {!biz ? <Checkbox testID="tax-notin" checked={!!f.no_tin} onChange={set('no_tin')} label="My country doesn't issue tax numbers" /> : null}
          {!biz && f.no_tin ? (
            <Field testID="tax-bplace" label="Place of birth (city and country)" value={f.birth_place ?? ''} onChangeText={set('birth_place')} maxLength={120} style={{ marginTop: space.md }} />
          ) : (
            <>
              <Field testID="tax-tin" label="Tax number (TIN)" hint="The number your tax office gave you (in Slovakia: rodné číslo or DIČ; in Germany: Steuer-ID)." value={f.tin ?? ''} onChangeText={set('tin')} maxLength={30} autoCapitalize="characters" autoCorrect={false} style={{ marginTop: biz ? 0 : space.md }} />
              <SelectField testID="tax-tin-country" label="Issued by" value={f.tin_country ?? ''} options={tinCountries} onChange={set('tin_country')} />
            </>
          )}
          <Field testID="tax-vat" label="VAT number" value={f.vat_number ?? ''} onChangeText={set('vat_number')} maxLength={20} autoCapitalize="characters" autoCorrect={false} placeholder="SK2020123456" />
          <Checkbox testID="tax-confirm" checked={confirm} onChange={(v) => { setConfirm(v); setErr(''); }} label="I confirm these details are correct and complete." />
          {err ? <Txt v="small" testID="tax-err" style={{ color: color.err, marginTop: space.sm }}>{err}</Txt> : null}
          <Button testID="tax-save" title="Save tax details" loading={busy} onPress={save} style={{ marginTop: space.md }} />
          {me?.info ? <Button title="Cancel" kind="ghost" small onPress={() => { load(); }} style={{ alignSelf: 'flex-start', marginTop: space.sm, paddingHorizontal: 0 }} /> : null}
        </Card>
      )}
    </ScrollView>
  );
}

function stripNulls<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}
