// Creator: earnings overview — paid out this year, on hold, last 12 months — and a CSV export for the accountant.
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { color, font, radius, space } from '../theme';
import { Button, Card, Chip, Empty, Loading, Txt, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { euroCents, type Booking } from '../lib/logic';
import { earningsCsv, earningsOf } from '../lib/plan-logic';
import { saveTextFile } from '../lib/photo-io';
import { tr as trx } from '../lib/i18n';

function Stat({ value, label, testID }: { value: string; label: string; testID?: string }) {
  return (
    <View style={s.stat} testID={testID}>
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Txt v="small">{label}</Txt>
    </View>
  );
}

export default function EarningsScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<Booking[] | null>(null);
  const [error, setError] = useState(false);
  const [year, setYear] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await api.bookings.list();
    if (err) { setError(true); return; }
    setError(false); setList(data ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) return <Empty title="Sign in first" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (error && !list) return <Empty title="Couldn't load your earnings" text="Check your connection and try again." action="Try again" onAction={load} />;
  if (!list) return <Loading />;

  const e = earningsOf(list, user.id);
  const max = Math.max(1, ...e.months.map((m) => m.cents));
  async function exportCsv() {
    setSaving(true);
    try { await saveTextFile(earningsCsv(list!, user!.id, year), `capturago-earnings-${year}.csv`, 'text/csv', 'public.comma-separated-values-text'); }
    catch { toast('Could not create the file. Please try again.', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={color.clay} />}>
      <View style={s.grid} testID="earn-stats">
        <Stat testID="earn-year" value={euroCents(e.paidThisYear)} label={`Paid out in ${e.year}`} />
        <Stat testID="earn-hold" value={euroCents(e.onHold)} label={`On hold (${e.onHoldCount})`} />
        <Stat testID="earn-done" value={String(e.completed)} label="Completed bookings" />
        <Stat testID="earn-link" value={String(e.viaLink)} label="Clients via your link" />
      </View>

      <Card style={{ marginTop: space.lg }} testID="earn-chart">
        <Txt v="h3">Last 12 months</Txt>
        <View style={s.chart} accessible accessibilityRole="image"
          accessibilityLabel={trx(`Earnings per month: ${e.months.filter((m) => m.cents).map((m) => `${m.label} ${euroCents(m.cents)}`).join(', ') || 'none yet'}`)}>
          {e.months.map((m) => (
            <View key={m.key} style={s.col}>
              <View style={s.barArea}><View style={[s.bar, { height: `${Math.round((m.cents / max) * 100)}%` }, !m.cents && s.barEmpty]} /></View>
              <Text style={s.month}>{m.label.slice(0, 1)}</Text>
            </View>
          ))}
        </View>
        <Txt v="small" style={{ marginTop: space.sm }}>Shown when the payment is released to you (after the shoot or after the client approves). On hold = paid by the client, not released yet.</Txt>
      </Card>

      <Card style={{ marginTop: space.lg }} testID="earn-export">
        <Txt v="h3">Export for your accountant</Txt>
        <Txt v="small" style={{ marginTop: 2 }}>A CSV file that opens in Excel, Numbers or Google Sheets. Stripe’s payout reports remain the official record.</Txt>
        <View style={s.years}>
          {['all', ...e.years].map((y) => <Chip key={y} testID={`earn-y-${y}`} label={y === 'all' ? 'All years' : y} active={year === y} onPress={() => setYear(y)} />)}
        </View>
        <Button testID="earn-csv" title="⬇ Download CSV" onPress={exportCsv} loading={saving} disabled={!e.total} />
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: color.card, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.md, gap: 2 },
  statValue: { fontFamily: font.display, fontSize: 24, color: color.text },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 140, marginTop: space.md },
  col: { flex: 1, alignItems: 'center', height: '100%' },
  barArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: color.clay, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2 },
  barEmpty: { backgroundColor: color.border },
  month: { fontFamily: font.body, fontSize: 11, color: color.dim, marginTop: 4 },
  years: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md },
});
