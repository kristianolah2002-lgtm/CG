import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { color, space } from '../theme';
import { Empty, Loading } from '../components/ui';
import { CreatorCard } from '../components/CreatorCard';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { goToTab } from '../lib/nav';
import type { Listing } from '../lib/logic';

export default function FavoritesScreen() {
  const { user } = useAuth();
  const [list, setList] = useState<Listing[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const ids = await api.favorites.ids(user.id);
    if (!ids.length) { setList([]); return; }
    const { data, error: err } = await api.listings.all();
    if (err) { setError(true); return; }
    setError(false);
    const set = new Set(ids);
    setList((data ?? []).filter((l) => set.has(l.id)));
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) return <Empty title="Sign in to see favourites" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (error) return <Empty title="Couldn't load favourites" text="Check your connection and try again." action="Try again" onAction={load} />;
  if (list === null) return <Loading />;
  return (
    <FlatList
      testID="favorites-list"
      style={{ backgroundColor: color.canvas }}
      contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
      data={list}
      keyExtractor={(l) => l.id}
      renderItem={({ item }) => <CreatorCard l={item} onPress={() => router.push({ pathname: '/creator/[id]', params: { id: item.id } })} />}
      ListEmptyComponent={<Empty testID="favorites-empty" title="No favourites yet" text="Tap the ♥ on a creator's profile to save them here." action="Explore creators" onAction={() => goToTab('/')} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={color.clay} />}
    />
  );
}
