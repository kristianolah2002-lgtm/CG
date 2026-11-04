// 💬 A creator sends (or changes) an offer on a traveller's shoot request.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { color, space } from '../../theme';
import { Button, Card, Chip, Empty, Field, Loading, Txt, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtDate } from '../../lib/logic';
import { todayIso } from '../../lib/trip-logic';
import { minutesText, OFFER_MINUTES, offerDays, offerProblem, requestHead, type NearRequest } from '../../lib/request-logic';
import { tr as trx } from '../../lib/i18n';

export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState<NearRequest | null | undefined>(undefined);
  const [price, setPrice] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [photos, setPhotos] = useState('');
  const [edit, setEdit] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.requests.forMe().then(({ data }) => {
      const x = (Array.isArray(data) ? data : []).find((r) => r.id === id) ?? null;
      setQ(x);
      if (!x) return;
      const o = x.my_offer;
      setPrice(String(o?.price_eur ?? x.budget_eur ?? ''));
      setDate(o?.shoot_date && offerDays(x, todayIso()).includes(o.shoot_date) ? o.shoot_date : offerDays(x, todayIso())[0] ?? null);
      setMinutes(o?.minutes ?? 60);
      setPhotos(o?.photos != null ? String(o.photos) : '');
      setEdit(o?.edit_days != null ? String(o.edit_days) : '');
      setMessage(o?.message ?? '');
    });
  }, [id]);
  if (!user) return <Empty title="Sign in first" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (q === undefined) return <Loading />;
  if (!q) return <Empty title="This request is no longer open" action="Back" onAction={() => router.back()} />;
  const days = offerDays(q, todayIso());

  async function send() {
    const num = (v: string) => (v.trim() === '' ? null : Math.round(Number(v)));
    const p = num(price), ph = num(photos), ed = num(edit);
    const problem = offerProblem({ price: p, photos: ph, edit: ed, date });
    if (problem) { toast(problem, 'error'); return; }
    setBusy(true);
    const { error } = await api.requests.offer({ request: q!.id, price: p!, date: date!, minutes, photos: ph, edit_days: ed, message: message.trim() });
    setBusy(false);
    if (error) { toast(error.message || 'Could not send your offer.', 'error'); return; }
    toast(`Offer sent ✓ — we'll email ${q!.first_name}.`, 'success');
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled" testID="offer-form">
        <Card style={{ marginBottom: space.lg, backgroundColor: color.sand }}>
          <Txt v="h3">{q.first_name} · {requestHead(q)}</Txt>
          {q.note ? <Txt v="small" style={{ marginTop: space.sm, fontStyle: 'italic' }}>“{q.note}”</Txt> : null}
        </Card>
        <Field testID="of-price" label="Price in € *" value={price} onChangeText={setPrice} keyboardType="number-pad" maxLength={5} />
        <Txt v="label">Day *</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm, marginBottom: space.lg }} testID="of-days">
          {days.map((d) => <View key={d} style={{ marginBottom: space.sm }}><Chip testID={`of-day-${d}`} label={fmtDate(d)} active={date === d} onPress={() => setDate(d)} /></View>)}
        </View>
        <Txt v="label">Length</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm, marginBottom: space.lg }}>
          {OFFER_MINUTES.map((m) => <View key={m} style={{ marginBottom: space.sm }}><Chip testID={`of-min-${m}`} label={minutesText(m)} active={minutes === m} onPress={() => setMinutes(m)} /></View>)}
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Field testID="of-photos" label="Edited photos" value={photos} onChangeText={setPhotos} keyboardType="number-pad" maxLength={4} placeholder="e.g. 40" style={{ flex: 1 }} />
          <Field testID="of-edit" label="Within (days)" value={edit} onChangeText={setEdit} keyboardType="number-pad" maxLength={2} placeholder="e.g. 5" style={{ flex: 1 }} />
        </View>
        <Field testID="of-message" label={`Message to ${q.first_name}`} value={message} onChangeText={setMessage} multiline maxLength={600} placeholder={trx("Why you, what you'd plan, the best spots…")} />
        <Txt v="small" style={{ marginBottom: space.lg }}>They pay through CapturaGo when they book; the money is held safely and paid out after the shoot, like any booking. If you promise the photos within some days, the payout waits until you send them.</Txt>
        <Button testID="of-send" title={q.my_offer?.status === 'open' ? 'Update my offer' : 'Send offer'} onPress={send} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
