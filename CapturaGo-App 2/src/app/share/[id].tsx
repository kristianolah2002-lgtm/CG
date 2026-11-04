// Traveller: view-only links to a delivered gallery, for friends and family. Links expire and can be turned off.
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { color, radius, space } from '../../theme';
import { Button, Card, Checkbox, confirmAsync, Empty, Loading, Segmented, Txt, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { clientSeesPhotos, fmtDate, type Booking } from '../../lib/logic';
import { activeShares, expiresIn, shareUrl, type GalleryShare } from '../../lib/plan-logic';

export default function ShareGalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [b, setB] = useState<Booking | null | undefined>(undefined);
  const [links, setLinks] = useState<GalleryShare[]>([]);
  const [favCount, setFavCount] = useState(0);
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [favOnly, setFavOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [bk, sh, ph] = await Promise.all([api.bookings.list(), api.shares.list(String(id)), api.photos.list(String(id))]);
    setB((bk.data ?? []).find((x) => x.id === id) ?? null);
    setLinks(activeShares(sh.data ?? []));
    setFavCount((ph.data ?? []).filter((p) => p.favorite).length);
  }, [id]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (b === undefined) return <Loading />;
  if (!b || !user || b.client_user_id !== user.id || !clientSeesPhotos(b)) return <Empty title="Nothing to share yet" text="You can share your gallery once your creator has sent the photos." action="Back" onAction={() => router.back()} />;

  async function send(url: string) {
    const city = b!.photographers?.city?.split(',')[0]?.trim();
    const by = b!.photographers?.name ? ` by ${b!.photographers.name.split(' ')[0]}` : '';
    const msg = `Our photos from ${city || 'our trip'}${by} 📸 — shot with CapturaGo`;
    try { await Share.share(Platform.OS === 'ios' ? { url, message: msg } : { message: `${msg}\n${url}` }); } catch { /* dismissed */ }
  }
  async function create() {
    if (favOnly && !favCount) { toast('Mark some favourites first (♡ in your gallery).', 'error'); return; }
    setBusy(true);
    const { data, error } = await api.shares.create(b!.id, days, favOnly);
    setBusy(false);
    if (error || !data) { toast(error?.message || 'Could not create the link. Please try again.', 'error'); return; }
    await load();
    toast('Link ready ✓', 'success');
    send(shareUrl(data));
  }
  async function turnOff(token: string) {
    if (!(await confirmAsync('Turn off this link?', 'Anyone who has it will no longer see the photos.', 'Turn off', true))) return;
    const { error } = await api.shares.remove(token);
    if (error) { toast('Could not turn it off. Please try again.', 'error'); return; }
    setLinks((cur) => cur.filter((x) => x.token !== token));
    toast('Link turned off.');
  }

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }}>
      <Txt v="h2">Share with friends</Txt>
      <Txt v="muted" style={{ marginTop: 4 }}>A view-only link to your photos — no account needed. It stops working when it expires, or when you turn it off.</Txt>
      <Card style={{ marginTop: space.lg }} testID="share-create">
        <Txt v="label" style={{ marginBottom: space.sm }}>Link works for</Txt>
        <Segmented testID="share-days" options={[[1, '1 day'], [7, '7 days'], [30, '30 days']] as [1 | 7 | 30, string][]} value={days} onChange={setDays} />
        <View style={{ marginTop: space.sm }}>
          <Checkbox testID="share-fav" checked={favOnly} onChange={setFavOnly} label={`Only my favourites (${favCount})`} />
        </View>
        <Button testID="share-make" title="Create link & share" loading={busy} onPress={create} style={{ marginTop: space.sm }} />
      </Card>
      <Txt v="label" style={{ marginTop: space.xl, marginBottom: space.sm }}>Active links ({links.length})</Txt>
      {links.length === 0 ? <Txt v="muted" testID="share-none">No active links.</Txt> : links.map((x) => (
        <Card key={x.token} style={{ marginBottom: space.md }} testID={`share-${x.token.slice(0, 8)}`}>
          <Txt v="h3">{x.favorites_only ? '♥ Favourites' : 'All photos'} · {expiresIn(x.expires_at)}</Txt>
          <Txt v="small" style={{ marginTop: 2 }}>Created {fmtDate(x.created_at)} · opened {x.views} time{x.views === 1 ? '' : 's'}</Txt>
          <View style={s.row}>
            <Button testID="share-send" title="Share again" small kind="secondary" onPress={() => send(shareUrl(x.token))} />
            <Button testID="share-off" title="Turn off" small kind="ghost" onPress={() => turnOff(x.token)} style={{ paddingHorizontal: space.sm }} />
          </View>
        </Card>
      ))}
      <Txt v="small" style={{ marginTop: space.lg, textAlign: 'center' }}>🔒 Friends see the photos, the shoot date and your creator — never your name, email or what you paid. Up to 5 active links.</Txt>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md, alignItems: 'center', borderRadius: radius.sm },
});
