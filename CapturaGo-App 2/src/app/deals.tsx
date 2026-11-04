// Last-minute deals: creators with a free day tomorrow or the day after, 10–50% off. Check a gift card to see what it
// covers, or press "Surprise me" and we pick one. Same as the website's gift page finder (gift.js).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { color, font, radius, space } from '../theme';
import { animateLayout, Button, Card, Empty, Field, Loading, Txt, TText, useToast } from '../components/ui';
import { coverSource } from '../components/CreatorCard';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dealDay } from '../lib/deal-logic';
import { giftCodeNorm } from '../lib/gift-logic';
import { euroCents, firstName } from '../lib/logic';
import { coverOf, dealRows, dealsIn, pickSurprise, type DealRow } from '../lib/watch-logic';

export default function DealsScreen() {
  const params = useLocalSearchParams<{ gift?: string; city?: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<DealRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState(String(params.city ?? ''));
  const [code, setCode] = useState(giftCodeNorm(String(params.gift ?? '')));
  const [card, setCard] = useState<{ code: string; balance: number } | null>(null);
  const [cardMsg, setCardMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [pick, setPick] = useState<DealRow | null>(null);

  const load = useCallback(async () => {
    const [d, l] = await Promise.all([api.deals.active(), api.listings.all()]);
    if (d.error || l.error) { setFailed(true); setRows((cur) => cur ?? []); return; }
    setFailed(false);
    setRows(dealRows(d.data ?? [], l.data ?? []));
  }, []);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const shown = useMemo(() => dealsIn(rows ?? [], city), [rows, city]);
  const balance = card ? card.balance : null;

  async function check() {
    const c = giftCodeNorm(code);
    if (!c) { setCard(null); setCardMsg(null); return; }
    if (!user) { setCardMsg({ text: 'Sign in to check your gift card — or leave the code empty to just browse.', bad: true }); return; }
    setChecking(true);
    const { data, error } = await api.gifts.check(c);
    setChecking(false);
    if (error || !data?.ok) { setCard(null); setCardMsg({ text: data?.error || error?.message || 'Could not check the code. Please try again.', bad: true }); return; }
    const b = Number(data.balance_cents) || 0;
    setCard({ code: c, balance: b }); setCode(c);
    setCardMsg({ text: `✓ ${euroCents(b)} on this card — we show what it covers and fill it in when you book.`, bad: false });
  }
  function surprise() {
    const p = pickSurprise(shown, balance);
    if (!p) { toast('No last-minute deals right now.'); return; }
    animateLayout();
    setPick(p);
  }
  function open(r: DealRow) {
    router.push({ pathname: '/creator/[id]', params: { id: r.listing.id, date: r.day, ...(card ? { gift: card.code } : {}) } });
  }

  if (rows === null) return <Loading label="Looking for last-minute deals…" />;

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled" testID="deals-screen"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={color.clay} />}>
      <Txt v="muted">Creators lower their price by 10–50% for a free day tomorrow or the day after. Every CapturaGo gift card works on these deals — or press Surprise me and we pick one for you.</Txt>
      <Card style={{ marginTop: space.lg }}>
        <Field testID="deals-city" label="City" value={city} onChangeText={(v) => { setCity(v); setPick(null); }} placeholder="City, or leave empty for everywhere" autoCorrect={false} maxLength={80} />
        <Field testID="deals-gift" label="Gift card code" value={code} onChangeText={(v) => { setCode(v); setCard(null); setCardMsg(null); }} autoCapitalize="characters" autoCorrect={false}
          placeholder="CG-XXXX-XXXX-XXXX-XXXX" maxLength={30} onSubmitEditing={check} style={{ marginBottom: space.sm }} />
        {cardMsg ? <Txt v="small" testID="deals-gift-msg" style={{ color: cardMsg.bad ? color.err : color.ok, marginBottom: space.sm }}>{cardMsg.text}</Txt> : null}
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
          <Button testID="deals-check" title={card ? '✓ Checked' : 'Check my card'} kind="secondary" small loading={checking} disabled={!code.trim() || !!card} onPress={check} style={{ flex: 1 }} />
          <Button testID="deals-surprise" title="🎲 Surprise me" small onPress={surprise} disabled={!shown.length} style={{ flex: 1 }} />
        </View>
      </Card>

      {pick && shown.includes(pick) ? (
        <View style={{ marginTop: space.lg }} testID="deals-pick">
          <Txt v="label" style={{ color: color.clay, marginBottom: space.sm }}>🎲 We picked for you</Txt>
          <DealCard r={pick} balance={balance} onPress={() => open(pick)} highlight />
          <Button testID="deals-again" title="Pick again" kind="ghost" small onPress={surprise} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
        </View>
      ) : null}

      {failed && !shown.length ? (
        <Empty title="Couldn't load the deals" text="Check your connection and try again." action="Try again" onAction={load} />
      ) : !shown.length ? (
        <Empty testID="deals-empty" title="No last-minute deals right now." text="Deals are for tomorrow and the day after — check again tomorrow, or use your card on any shoot."
          action="Explore creators" onAction={() => router.push('/(tabs)')} />
      ) : (
        <View style={{ marginTop: space.lg }} testID="deals-list">
          {shown.map((r) => <DealCard key={`${r.listing.id}-${r.day}`} r={r} balance={balance} onPress={() => open(r)} />)}
        </View>
      )}
    </ScrollView>
  );
}

function DealCard({ r, balance, onPress, highlight }: { r: DealRow; balance: number | null; onPress: () => void; highlight?: boolean }) {
  const cover = coverOf(r, balance);
  return (
    <Pressable testID={`deal-${r.listing.id}-${r.day}`} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${r.listing.name}, ${r.city}, ${dealDay(r.day)}, −${r.pct}%`}
      style={({ pressed }) => [s.card, highlight && s.cardOn, pressed && { opacity: 0.9 }]}>
      <Image source={coverSource(r.listing)} style={s.img} contentFit="cover" transition={120} accessibilityIgnoresInvertColors />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt v="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{r.listing.name}</Txt>
          <TText style={s.pct}>{`−${r.pct}%`}</TText>
        </View>
        <Txt v="small" numberOfLines={1}>{`📍 ${r.city} · ${dealDay(r.day)}`}</Txt>
        <Txt v="small" numberOfLines={1}>{r.pkgName}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Txt v="h3" style={{ color: color.clay }}>{euroCents(r.totalCents)}</Txt>
          <Txt v="small" style={{ textDecorationLine: 'line-through' }}>{euroCents(r.wasCents)}</Txt>
        </View>
        {cover ? (
          <Txt v="small" testID={`deal-cover-${r.listing.id}`} style={{ color: cover.covered ? color.ok : color.text, fontFamily: font.bold }}>
            {cover.covered ? '✓ Fully covered by your card' : `${euroCents(cover.fromCard)} from your card · ${euroCents(cover.toPay)} to pay`}
          </Txt>
        ) : null}
        <Txt v="small" style={{ color: color.clay, fontFamily: font.bold, marginTop: 2 }}>{`Book this deal with ${firstName(r.listing.name)} →`}</Txt>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, backgroundColor: color.card, marginBottom: space.md },
  cardOn: { borderColor: color.clay, borderWidth: 2 },
  img: { width: 84, height: 104, borderRadius: radius.md, backgroundColor: color.sand },
  pct: { backgroundColor: '#B04722', color: '#FFFBF5', fontFamily: font.bold, fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
});
