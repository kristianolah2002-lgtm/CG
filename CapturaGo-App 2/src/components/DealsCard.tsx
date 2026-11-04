// Creator: ⚡ Last-minute deals — a lower price tomorrow or the day after (the database checks every rule).
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { color, font, radius, space } from '../theme';
import { Button, Card, Chip, Txt, useToast } from './ui';
import { api, type MyDealDay } from '../lib/api';
import { DEAL_PCTS, dealDay } from '../lib/deal-logic';
import { loadDeals } from '../lib/deals';
import { tripOn } from '../lib/trip-logic';
import type { Listing } from '../lib/logic';

export function DealsCard({ listing }: { listing: Listing }) {
  const toast = useToast();
  const [days, setDays] = useState<MyDealDay[] | null>(null);
  const [problem, setProblem] = useState('');
  const [pick, setPick] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await api.deals.mine();
    if (error) { setProblem(/my_last_minute/.test(error.message || '') ? 'Last-minute deals need the latest database update.' : 'Could not load your deals. Please try again.'); return; }
    setProblem(''); setDays(Array.isArray(data) ? data : []);
  }, []);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const city = (iso: string) => String(tripOn(listing.trips, iso)?.city || listing.city || '').split(',')[0];
  async function setDeal(day: string) {
    const pct = pick[day] ?? 20;
    setBusy(day);
    const { error } = await api.deals.set(day, pct);
    setBusy('');
    if (error) { toast(error.message || 'Could not set the deal.', 'error'); return; }
    toast(`Deal live ✓ — −${pct}% for ${dealDay(day)}.`, 'success');
    loadDeals(true); load();
  }
  async function takeBack(day: string) {
    setBusy(day);
    const { error } = await api.deals.remove(day);
    setBusy('');
    if (error) { toast('Could not take the deal back.', 'error'); return; }
    toast('Deal taken back.', 'info');
    loadDeals(true); load();
  }

  return (
    <Card style={s.card} testID="deals-card">
      <Txt v="h3">⚡ Last-minute deals</Txt>
      <Txt v="small" style={{ marginTop: 2 }}>Free tomorrow or the day after? Lower your in-person prices for that day. Travellers who are in your city then get one email, and the deal shows on your profile.</Txt>
      {problem ? <Txt v="small" style={{ marginTop: space.sm, color: color.err }}>{problem}</Txt> : null}
      {!listing.payouts_enabled ? <Txt v="small" style={{ marginTop: space.sm }}>You need payouts set up — deals are for online bookings.</Txt> : null}
      {(days ?? []).map((d) => {
        const w = dealDay(d.day);
        const when = new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
        return (
          <View key={d.day} style={[s.day, d.pct ? s.on : null]} testID={`deal-day-${d.day}`}>
            <Txt v="h3">{w === 'tomorrow' ? 'Tomorrow' : 'The day after'} <Txt v="small" raw>{when}</Txt></Txt>
            {d.pct ? (
              <>
                <Txt v="body" style={{ color: color.clay, fontFamily: font.bold, marginTop: 2 }}>{`⚡ −${d.pct}% live`}</Txt>
                <Txt v="small">{d.notified ? `Travellers in ${city(d.day)} were told.` : `Travellers in ${city(d.day)} are told in about 10 minutes.`}</Txt>
                <Button testID={`deal-off-${d.day}`} title="Take back" kind="ghost" small loading={busy === d.day} onPress={() => takeBack(d.day)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
              </>
            ) : !d.free ? (
              <Txt v="small" style={{ marginTop: 2 }}>Not free — a day off, busy in your calendar or fully booked.</Txt>
            ) : (
              <>
                <View style={s.chips}>
                  {DEAL_PCTS.map((n) => <Chip key={n} testID={`deal-${d.day}-${n}`} label={`−${n}%`} active={(pick[d.day] ?? 20) === n} onPress={() => setPick((x) => ({ ...x, [d.day]: n }))} />)}
                </View>
                <Button testID={`deal-on-${d.day}`} title="Offer this price" kind="secondary" small loading={busy === d.day} onPress={() => setDeal(d.day)} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
              </>
            )}
          </View>
        );
      })}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { marginBottom: space.lg, borderColor: 'rgba(176,71,34,0.35)', backgroundColor: '#FFF6EF' },
  day: { marginTop: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.card },
  on: { borderColor: color.clay, backgroundColor: '#FBEADF' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm },
});
