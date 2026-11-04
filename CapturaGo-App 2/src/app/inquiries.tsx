import React, { useCallback, useState } from 'react';
import { FlatList, Linking, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { color, space } from '../theme';
import { Badge, Button, Card, Empty, Loading, Txt } from '../components/ui';
import { api, type Inquiry } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtDate, serviceLabel } from '../lib/logic';

export default function InquiriesScreen() {
  const { user } = useAuth();
  const [list, setList] = useState<Inquiry[] | null>(null);
  const [noListing, setNoListing] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const mine = await api.listings.mine(user.id);
    if (mine.error) { setError(true); return; }
    if (!mine.data) { setNoListing(true); return; }
    const { data, error: err } = await api.inquiries.forListing(mine.data.id);
    if (err) { setError(true); return; }
    setError(false);
    setList(data ?? []);
    // Opening the inbox marks new messages as read (same as the website dashboard)
    (data ?? []).filter((q) => !q.read).forEach((q) => { api.inquiries.markRead(q.id); });
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) return <Empty title="Sign in to see inquiries" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (noListing) return <Empty title="No listing yet" text="Create your creator listing on capturago.com to receive inquiries." />;
  if (error) return <Empty title="Couldn't load inquiries" text="Check your connection and try again." action="Try again" onAction={load} />;
  if (list === null) return <Loading />;

  return (
    <FlatList
      testID="inquiries-list"
      style={{ backgroundColor: color.canvas }}
      contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
      data={list}
      keyExtractor={(q) => q.id}
      ListEmptyComponent={<Empty title="No inquiries yet" text="When travellers message you, they'll appear here and in your email." />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={color.clay} />}
      renderItem={({ item: q }) => (
        <Card testID={`inquiry-${q.id}`} style={{ marginBottom: space.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt v="h3" style={{ flex: 1 }}>{q.sender_name}</Txt>
            {!q.read && <Badge label="New" tone="clay" />}
          </View>
          <Txt v="small">{fmtDate(q.created_at)} · {q.sender_email}</Txt>
          {(q.shoot_type || q.shoot_date) ? (
            <Txt v="muted" style={{ marginTop: 4 }}>{[q.shoot_type ? serviceLabel(q.shoot_type) : '', q.shoot_date ? `📅 ${fmtDate(q.shoot_date)}` : ''].filter(Boolean).join(' · ')}</Txt>
          ) : null}
          <Txt v="body" style={{ marginTop: space.sm }}>{q.message}</Txt>
          <Button title="Reply by email" small kind="secondary" style={{ marginTop: space.md, alignSelf: 'flex-start' }}
            onPress={() => Linking.openURL(`mailto:${encodeURIComponent(q.sender_email)}?subject=${encodeURIComponent('Your CapturaGo inquiry')}`)} />
        </Card>
      )}
    />
  );
}
