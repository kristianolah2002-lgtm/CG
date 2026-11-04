// Text reminders on the shoot day: add a mobile number (confirmed with a 6-digit code by SMS),
// SMS or WhatsApp, turn the reminders off, or remove the number. Same as the website's dashboard card.
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { color, space } from '../theme';
import { Button, Card, Checkbox, confirmAsync, Empty, Field, Loading, Segmented, Txt, useToast } from '../components/ui';
import { api, type MyPhone } from '../lib/api';
import { useAuth } from '../lib/auth';
import { normPhone } from '../lib/deal-logic';
import { tr as trx } from '../lib/i18n';

const CHANNELS: ['sms' | 'whatsapp', string][] = [['sms', 'SMS'], ['whatsapp', 'WhatsApp']];

export default function PhoneScreen() {
  const { user, ready } = useAuth();
  const toast = useToast();
  const [ph, setPh] = useState<MyPhone | null | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);
  const [num, setNum] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error } = await api.phone.mine();
    if (error) { setUnavailable(true); setPh(null); return; }
    setPh(data ?? null);
    if (data && !data.verified) { setNum(data.phone); setChannel(data.channel); if (data.pending) setSentTo(data.phone); }
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (!ready) return <Loading />;
  if (!user) return <Empty title="Sign in first" text="Text reminders are for your bookings." action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (ph === undefined) return <Loading />;
  if (unavailable) return <Empty title="Not available yet" text="Text reminders need the latest update. Please try again later." />;

  async function send() {
    const e: Record<string, string> = {};
    const p = normPhone(num);
    if (!p) e.num = 'Enter your mobile number with the country code, e.g. +421 900 123 456.';
    if (!consent) e.consent = 'Please agree to receive text reminders.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy('send');
    const { data, error } = await api.phone.start(p, channel);
    setBusy('');
    if (error) { toast(error.message || 'Could not send the code.', 'error'); return; }
    setSentTo(data?.phone || p);
    toast(`Code sent to ${data?.phone || p} ✓`, 'success');
  }
  async function verify() {
    const c = code.replace(/\D/g, '');
    if (c.length !== 6) { setErr({ code: 'Enter the 6-digit code from the text.' }); return; }
    setErr({}); setBusy('verify');
    const { error } = await api.phone.verify(c);
    setBusy('');
    if (error) { toast(error.message || 'Could not check the code.', 'error'); return; }
    toast("Number confirmed ✓ — we'll text you on your shoot days.", 'success');
    setCode(''); setSentTo('');
    load();
  }
  async function prefs(reminders: boolean | null, ch: 'sms' | 'whatsapp' | null) {
    const { data, error } = await api.phone.prefs(reminders, ch);
    if (error || !data) { toast('Could not save your choice.', 'error'); return; }
    setPh(data);
    if (reminders !== null) toast(reminders ? 'Text reminders on ✓' : 'Text reminders off.', 'success');
  }
  async function remove() {
    if (!(await confirmAsync('Remove your number?', "You won't get text reminders any more.", 'Remove', true))) return;
    const { error } = await api.phone.remove();
    if (error) { toast('Could not remove it.', 'error'); return; }
    toast('Number removed.', 'info');
    setNum(''); setConsent(false); setSentTo('');
    load();
  }

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled" testID="phone-screen">
      <Txt v="muted">The meeting point and time by SMS or WhatsApp on the day of your shoot — so nobody misses it.</Txt>
      {ph && ph.verified ? (
        <Card style={{ marginTop: space.lg }} testID="phone-on">
          <Txt v="h3" raw>{ph.phone}</Txt>
          <Txt v="small" style={{ color: color.ok }}>✓ confirmed</Txt>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Txt v="body">Text me on the day of my shoots</Txt>
              <Txt v="small">Meeting point and time, about 7:00 on the day (or the evening before an early start).</Txt>
            </View>
            <Switch testID="phone-reminders" value={ph.reminders} onValueChange={(v) => prefs(v, null)} accessibilityLabel={trx('Text me on the day of my shoots')}
              trackColor={{ true: color.clay, false: color.border }} thumbColor="#fff" />
          </View>
          <Txt v="label" style={{ marginTop: space.md, marginBottom: 6 }}>Send by</Txt>
          <Segmented testID="phone-channel" options={CHANNELS} value={ph.channel} onChange={(v) => prefs(null, v)} />
          <Button testID="phone-remove" title="Remove my number" kind="ghost" small onPress={remove} style={{ alignSelf: 'flex-start', marginTop: space.md, paddingHorizontal: 0 }} />
        </Card>
      ) : (
        <Card style={{ marginTop: space.lg }} testID="phone-add">
          <Field testID="phone-num" label="Mobile number (with country code)" value={num} onChangeText={setNum} placeholder="+421 900 123 456" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={20} error={err.num} />
          <Txt v="label" style={{ marginBottom: 6 }}>Send by</Txt>
          <Segmented testID="phone-channel" options={CHANNELS} value={channel} onChange={setChannel} />
          <View style={{ marginTop: space.md }}>
            <Checkbox testID="phone-consent" checked={consent} onChange={setConsent} label="Text me reminders about my CapturaGo shoots on the shoot day. I can turn this off any time. Standard message rates may apply." />
            {err.consent ? <Txt v="small" style={{ color: color.err }}>{err.consent}</Txt> : null}
          </View>
          <Button testID="phone-send" title="Send me a code" kind="secondary" loading={busy === 'send'} onPress={send} style={{ marginTop: space.md }} />
          {sentTo ? (
            <View style={{ marginTop: space.lg }} testID="phone-verify">
              <Field testID="phone-code" label="6-digit code from the text" value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={9} error={err.code} />
              <Button testID="phone-check" title="Confirm my number" loading={busy === 'verify'} onPress={verify} />
            </View>
          ) : null}
        </Card>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
});
