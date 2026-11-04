// 📣 Post a shoot request: city, dates, what you need — creators in that city send offers.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { color, space } from '../theme';
import { Button, Card, Chip, DateField, Empty, Field, Txt, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isIsoDate, isoInDays } from '../lib/logic';
import { todayIso } from '../lib/trip-logic';
import { REQUEST_SERVICES, requestProblem, type RequestService } from '../lib/request-logic';
import { tr as trx } from '../lib/i18n';

export default function NewRequestScreen() {
  const params = useLocalSearchParams<{ city?: string; from?: string; to?: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [city, setCity] = useState(String(params.city ?? '').slice(0, 120));
  const [from, setFrom] = useState<string | null>(isIsoDate(String(params.from ?? '')) ? String(params.from) : null);
  const [to, setTo] = useState<string | null>(isIsoDate(String(params.to ?? '')) ? String(params.to) : null);
  const [service, setService] = useState<RequestService>('photo');
  const [people, setPeople] = useState('2');
  const [budget, setBudget] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  if (!user) return <Empty title="Sign in to post a request" text="Creators reply with offers — free, no obligation." action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (done) return <Empty testID="req-done" title="Request posted! 📣" text={`Creators who are in ${done} on your dates are told right away. We'll email you when offers arrive.`} action="See my requests" onAction={() => router.replace('/requests')} />;

  async function post() {
    const p = Math.round(Number(people)), b = budget.trim() ? Math.round(Number(budget)) : null;
    const problem = requestProblem({ city, from, to, people: p, budget: b }, todayIso());
    if (problem) { toast(problem, 'error'); return; }
    setBusy(true);
    const { error } = await api.requests.create({ city: city.trim(), from: from!, to: to || from!, service, people: p, budget: b, note: note.trim() });
    setBusy(false);
    if (error) { toast(error.message || 'Could not post your request. Please try again.', 'error'); return; }
    setDone(city.trim().split(',')[0]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled" testID="request-new">
        <Txt v="muted" style={{ marginBottom: space.lg }}>Tell creators what you need. Those who are in the city on your dates send you offers — you compare them and book the one you like. Free, no obligation.</Txt>
        <Field testID="rq-city" label="Where? *" value={city} onChangeText={setCity} maxLength={120} placeholder={trx("City, e.g. Lisbon")} autoCorrect={false} />
        <Txt v="label">When? *</Txt>
        <View style={{ marginTop: space.sm, gap: space.sm }}>
          <DateField testID="rq-from" value={from} onChange={(d) => { setFrom(d); if (!to || to < d) setTo(d); }} min={isoInDays(1)} max={isoInDays(365)} placeholder={trx("From which day?")} collapsed />
          <DateField testID="rq-to" value={to} onChange={setTo} min={from ?? isoInDays(1)} max={isoInDays(365)} placeholder={trx("Until which day?")} collapsed />
        </View>
        <Txt v="small" style={{ marginTop: 6, marginBottom: space.lg }}>Any day in this range works for you — creators pick a day they’re free.</Txt>
        <Txt v="label">What do you need? *</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm, marginBottom: space.lg }} testID="rq-services">
          {REQUEST_SERVICES.map(([id, ic, l]) => <View key={id} style={{ marginBottom: space.sm }}><Chip testID={`rq-s-${id}`} label={`${ic} ${l}`} active={service === id} onPress={() => setService(id)} /></View>)}
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Field testID="rq-people" label="People" value={people} onChangeText={setPeople} keyboardType="number-pad" maxLength={2} style={{ flex: 1 }} />
          <Field testID="rq-budget" label="Budget € (optional)" value={budget} onChangeText={setBudget} keyboardType="number-pad" maxLength={5} placeholder="e.g. 150" style={{ flex: 1 }} />
        </View>
        <Field testID="rq-note" label="Anything else?" value={note} onChangeText={setNote} multiline maxLength={1000} placeholder={trx("Occasion, style, places you love, how many photos…")}
          hint="Don't share phone numbers or emails here — creators reply on CapturaGo." />
        <Card style={{ marginBottom: space.lg, backgroundColor: color.sand }}><Txt v="small">When you book an offer you pay through CapturaGo, like any booking — held safely until your shoot is done.</Txt></Card>
        <Button testID="rq-post" title="Post my request" onPress={post} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
