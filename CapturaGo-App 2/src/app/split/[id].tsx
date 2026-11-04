// 👯 Split booking: the friends' payment links (organiser only — the database returns nothing to anyone else).
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, RefreshControl, ScrollView, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { color, font, radius, space } from '../../theme';
import { Button, Card, Empty, Loading, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { SITE_URL } from '../../lib/config';
import { euroCents, type Booking } from '../../lib/logic';
import { splitNote, type BookingShare } from '../../lib/gift-logic';

export default function SplitLinksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [b, setB] = useState<Booking | null | undefined>(undefined);
  const [shares, setShares] = useState<BookingShare[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const [{ data: list }, { data: rows }] = await Promise.all([api.bookings.list(), api.split.mine(String(id ?? ''))]);
    setB((list ?? []).find((x) => x.id === id && x.client_user_id === user?.id) ?? null);
    setShares(Array.isArray(rows) ? rows : []);
  }, [id, user?.id]);
  useEffect(() => { if (user) load(); }, [user, load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (!user) return <Empty title="Sign in first" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (b === undefined) return <Loading />;
  if (!b || Number(b.split_count) <= 1) return <Empty title="No payment links here" text="This booking isn't split between friends." action="Back" onAction={() => router.back()} />;
  const paid = shares.filter((x) => x.status === 'paid').length;
  const note = splitNote(b, paid) || (b.status === 'pending_payment' ? '' : ['paid', 'confirmed', 'completed'].includes(b.status) ? '✓ Everyone has paid — the shoot is booked.' : 'This booking is no longer collecting payments.');
  const share = async (url: string, n: number) => {
    const message = `Here's your share of our ${b.package_name} shoot on ${b.shoot_date} (friend ${n}):`;
    try { await Share.share(Platform.OS === 'ios' ? { url, message } : { message: `${message}\n${url}` }); } catch { /* dismissed */ }
  };

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} testID="split-links"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={color.clay} />}>
      <Txt v="h2">{b.package_name}</Txt>
      {note ? <Txt v="body" testID="split-note" style={{ marginTop: space.sm, color: color.clay, fontFamily: font.bold }}>{note}</Txt> : null}
      <Txt v="muted" style={{ marginTop: space.sm }}>Send each friend one link. Every link can be paid once. If not everyone pays in time, everyone is refunded automatically and the day is released.</Txt>
      {shares.map((x) => {
        const url = x.token ? `${SITE_URL}/pay.html#t=${x.token}` : '';
        return (
          <Card key={x.share_no} style={{ marginTop: space.md }} testID={`share-${x.share_no}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Txt v="h3">{x.share_no === 1 ? 'Your share' : `Friend ${x.share_no - 1}`} · {euroCents(x.amount_cents)}</Txt>
              <Txt v="small" style={{ color: x.status === 'paid' ? color.ok : color.muted, fontFamily: font.bold }}>{x.status === 'paid' ? '✓ paid' : x.status === 'refunded' ? 'refunded' : 'waiting'}</Txt>
            </View>
            {url ? (
              <>
                <View style={{ marginTop: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: color.input }}>
                  <Txt v="small" selectable testID={`share-url-${x.share_no}`} style={{ color: color.text }}>{url}</Txt>
                </View>
                <Button testID={`share-send-${x.share_no}`} title="Send this link" small kind="secondary" onPress={() => share(url, x.share_no - 1)} style={{ marginTop: space.sm, alignSelf: 'flex-start' }} />
              </>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}
