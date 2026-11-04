// Account → Creator: a founding-creator spot in the creator's city (opened by the CapturaGo team).
// The database checks every rule again when claiming; this card only explains and offers the button.
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { color, font, radius, space } from '../theme';
import { Button, Txt, useToast, TText } from './ui';
import { api, type FoundingStatus } from '../lib/api';
import { fmtDate } from '../lib/logic';
import { FOUNDING_NEEDS, foundingView, stillRunning } from '../lib/plan-logic';

export function FoundingCard({ onClaimed }: { onClaimed?: () => void }) {
  const toast = useToast();
  const [st, setSt] = useState<FoundingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const { data } = await api.founding.status(); setSt(data ?? null); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const view = foundingView(st);
  if (view === 'hidden' || !st) return null;

  async function claim() {
    setBusy(true);
    const { data, error } = await api.founding.claim();
    setBusy(false);
    if (error) { toast(error.message || 'Could not claim the spot.', 'error'); load(); return; }
    setSt(data);
    toast("🏅 You're a founding creator!", 'success');
    onClaimed?.();
  }

  if (view === 'claimed') {
    const boost = stillRunning(st.boost_until);
    return (
      <View style={s.card} testID="founding-card">
        <TText style={s.title}>🏅 You’re a founding creator{st.founding_city ? ` in ${st.founding_city}` : ''}</TText>
        <Txt v="small" style={{ marginTop: 4 }}>Your profile shows the 🏅 Founding badge{boost ? `, and your free boost runs until ${fmtDate(boost)}` : ''}. Thank you for being one of the first!</Txt>
      </View>
    );
  }
  const missing = (st.missing ?? []).filter((m) => FOUNDING_NEEDS[m]);
  return (
    <View style={s.card} testID="founding-card">
      <TText style={s.title}>🏅 Founding creator spots in {st.city}: {st.spots_left} of {st.slots} left</TText>
      <Txt v="small" style={{ marginTop: 4 }}>
        Be one of the first creators in {st.city}: a 🏅 badge on your profile{st.perk_days ? ` and a free ${st.perk_days}-day boost to the top of the results (labelled “Sponsored”)` : ''}. First come, first served — one spot per person.
      </Txt>
      {view === 'missing' ? (
        <>
          <Txt v="small" style={{ marginTop: space.sm, fontFamily: font.bold }}>Finish your listing first:</Txt>
          {missing.map((m) => <Txt key={m} v="small" testID={`founding-need-${m}`}>• {FOUNDING_NEEDS[m]}</Txt>)}
          <Button testID="founding-edit" title="Edit my listing" kind="secondary" small onPress={() => router.push('/listing')} style={{ alignSelf: 'flex-start', marginTop: space.md }} />
        </>
      ) : (
        <Button testID="founding-claim" title="Claim my founding spot" small loading={busy} onPress={claim} style={{ alignSelf: 'flex-start', marginTop: space.md }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFBF2', borderColor: '#EBCB8B', borderWidth: 1, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  title: { fontFamily: font.bold, fontSize: 15, color: color.text, lineHeight: 21 },
});
