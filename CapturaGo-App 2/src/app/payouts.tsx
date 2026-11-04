import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { color, space } from '../theme';
import { Button, Card, Empty, Loading, Reveal, SelectField, Txt, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CLIENT_FEE_PCT, CREATOR_FEE_PCT } from '../lib/config';
import { PAYOUT_COUNTRIES } from '../lib/listing-logic';
import type { Listing } from '../lib/logic';

type Status = { kind: 'loading' } | { kind: 'not-set-up-yet' } | { kind: 'error'; message: string } | { kind: 'none' } | { kind: 'pending'; due: number } | { kind: 'ready' };

export default function PayoutsScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [country, setCountry] = useState('SK');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const mine = await api.listings.mine(user.id);
    setListing(mine.data ?? null);
    if (!mine.data) return;
    setStatus({ kind: 'loading' });
    const { data, error } = await api.pay.connect('status');
    if (error) { setStatus(error.status === 503 ? { kind: 'not-set-up-yet' } : { kind: 'error', message: error.message }); return; }
    setStatus(data?.ready ? { kind: 'ready' } : data?.connected ? { kind: 'pending', due: Number(data.due) || 0 } : { kind: 'none' });
  }, [user]);
  // Re-checks when you come back from Stripe
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function open(action: 'onboard' | 'dashboard') {
    setBusy(true);
    const { data, error } = await api.pay.connect(action, action === 'onboard' ? country : undefined);
    setBusy(false);
    if (error || !data?.url) { toast(error?.message || 'Could not open Stripe.', 'error'); return; }
    await WebBrowser.openBrowserAsync(data.url);   // Stripe opens inside the app; closing it brings you back here
    load();
  }

  if (!user) return <Empty title="Sign in first" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (listing === undefined) return <Loading />;
  if (!listing) return <Empty title="Create your listing first" text="Then connect payouts so travellers can book and pay you." action="Create my listing" onAction={() => router.replace('/listing')} />;

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
      <Txt v="h1">Payouts</Txt>
      <Txt v="muted" style={{ marginTop: 4 }}>Get paid for bookings made through CapturaGo.</Txt>

      <Reveal>
        <Card style={{ marginTop: space.xl }} testID="payout-status">
          {status.kind === 'loading' && <Loading label="Checking your payout status…" />}
          {status.kind === 'not-set-up-yet' && (
            <>
              <Txt v="h3">Online payments are coming soon</Txt>
              <Txt v="muted" style={{ marginTop: 4 }}>We’re finishing the payment setup. Until then travellers can message you to arrange shoots.</Txt>
            </>
          )}
          {status.kind === 'error' && (
            <>
              <Txt v="h3">Couldn’t check your payouts</Txt>
              <Txt v="muted" style={{ marginTop: 4 }}>{status.message}</Txt>
              <Button title="Try again" kind="secondary" small onPress={load} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />
            </>
          )}
          {status.kind === 'ready' && (
            <>
              <Txt v="h3" style={{ color: color.ok }}>✓ Payouts active</Txt>
              <Txt v="muted" style={{ marginTop: 4 }}>Travellers can book and pay you online.</Txt>
              <Button testID="stripe-dashboard" title="Open my Stripe payout dashboard" kind="secondary" loading={busy} onPress={() => open('dashboard')} style={{ marginTop: space.md }} />
            </>
          )}
          {status.kind === 'pending' && (
            <>
              <Txt v="h3">Almost there</Txt>
              <Txt v="muted" style={{ marginTop: 4 }}>Stripe needs a few more details{status.due ? ` (${status.due} item${status.due > 1 ? 's' : ''})` : ''} before you can be paid.</Txt>
              <Button testID="stripe-continue" title="Continue setup with Stripe" loading={busy} onPress={() => open('onboard')} style={{ marginTop: space.md }} />
            </>
          )}
          {status.kind === 'none' && (
            <>
              <Txt v="h3">Connect a payout account</Txt>
              <Txt v="muted" style={{ marginTop: 4, marginBottom: space.lg }}>Needed to accept online bookings.</Txt>
              <SelectField testID="payout-country" label="Country you live in" value={country} options={PAYOUT_COUNTRIES} onChange={setCountry} />
              <Button testID="stripe-start" title="Set up payouts with Stripe" loading={busy} onPress={() => open('onboard')} />
              <Txt v="small" style={{ marginTop: space.sm }}>Your country can’t be changed later. If Stripe doesn’t support your country, you can still receive messages.</Txt>
            </>
          )}
        </Card>
      </Reveal>

      <Reveal delay={120}>
        <View style={{ marginTop: space.xl, gap: space.sm }}>
          <Txt v="muted">💶 You keep {100 - CREATOR_FEE_PCT}% of your package price. Travellers pay a {CLIENT_FEE_PCT}% service fee on top.</Txt>
          <Txt v="muted">🔒 Travellers pay upfront; the money is released to you after the shoot (or when they approve remote work).</Txt>
          <Txt v="muted">🏦 Stripe verifies your identity and pays out to your bank. CapturaGo never sees your bank details.</Txt>
        </View>
      </Reveal>
    </ScrollView>
  );
}
