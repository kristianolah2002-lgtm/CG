// Traveller: the private gallery of a booking — view, favourite, save one photo or all of them.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { color, font, radius, space } from '../../theme';
import { Button, Empty, Loading, Segmented, Txt, useToast, TText } from '../../components/ui';
import { PhotoViewer } from '../../components/PhotoViewer';
import { api, type BookingPhoto } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { clientSeesPhotos, fmtDate, httpsUrl, photosKeptUntil, slugify, thumbPath, type Booking } from '../../lib/logic';
import { savePhoto, saveZip } from '../../lib/photo-io';
import { tr as trx } from '../../lib/i18n';

const PART = 60; // photos per ZIP — keeps each file small enough for phones

export default function GalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [b, setB] = useState<Booking | null | undefined>(undefined);
  const [photos, setPhotos] = useState<BookingPhoto[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [fulls, setFulls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'fav'>('all');
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zipping, setZipping] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    const [bk, ph] = await Promise.all([api.bookings.list(), api.photos.list(String(id))]);
    const found = (bk.data ?? []).find((x) => x.id === id) ?? null;
    const list = ph.data ?? [];
    const [t, f] = await Promise.all([api.photos.signedUrls(list.map((p) => thumbPath(p.path))), api.photos.signedUrls(list.map((p) => p.path))]);
    const tm: Record<string, string> = {};
    list.forEach((p) => { const u = t[thumbPath(p.path)] || f[p.path]; if (u) tm[p.path] = u; });
    setThumbs(tm); setFulls(f); setPhotos(list); setB(found);
    // First visit: the photos are revealed as a slideshow
    if (found && list.length && user && found.client_user_id === user.id && clientSeesPhotos(found)) {
      const key = `cg_revealed_${found.id}`;
      const seen = await AsyncStorage.getItem(key).catch(() => '1');
      if (!seen && alive.current) {
        AsyncStorage.setItem(key, '1').catch(() => {});
        setAutoplay(true); setViewerAt(0);
      }
    }
  }, [id, user]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (b === undefined) return <Loading />;
  if (!b || !user || b.client_user_id !== user.id || !clientSeesPhotos(b)) return <Empty title="No photos here yet" text="You'll get an email as soon as your creator sends the photos." action="Back" onAction={() => router.back()} />;

  const view = filter === 'fav' ? photos.filter((p) => p.favorite) : photos;
  const favs = photos.filter((p) => p.favorite).length;
  const cols = width > 600 ? 4 : 3;
  const size = (Math.min(width, 900) - space.lg * 2 - (cols - 1) * 4) / cols;
  const base = slugify(`${b.package_name}-${b.shoot_date}`) || 'capturago-photos';
  const fileName = (p: BookingPhoto) => `${base}-${String(photos.indexOf(p) + 1).padStart(3, '0')}.jpg`;
  const kept = photosKeptUntil(b);
  const creator = b.photographers?.name || 'your creator';
  const extraLink = b.delivery_url ? httpsUrl(b.delivery_url) : null;

  async function setFavorite(p: BookingPhoto, on: boolean) {
    setPhotos((cur) => cur.map((x) => (x.id === p.id ? { ...x, favorite: on } : x)));
    const { error } = await api.photos.favorite(p.id, on);
    if (error) { setPhotos((cur) => cur.map((x) => (x.id === p.id ? { ...x, favorite: !on } : x))); toast('Could not save your favourite.', 'error'); }
  }
  async function urlFor(p: BookingPhoto): Promise<string | null> {
    if (fulls[p.path]) return fulls[p.path];
    const fresh = await api.photos.signedUrls([p.path]);
    if (fresh[p.path]) setFulls((cur) => ({ ...cur, ...fresh }));
    return fresh[p.path] ?? null;
  }
  async function saveOne(p: BookingPhoto) {
    setSaving(true);
    try { const u = await urlFor(p); if (!u) throw new Error('missing'); await savePhoto(u, fileName(p)); }
    catch { toast('Could not save this photo. Please try again.', 'error'); }
    finally { if (alive.current) setSaving(false); }
  }
  async function saveAll() {
    const list = view;
    if (!list.length || zipping) return;
    const parts = Math.ceil(list.length / PART);
    let failed = 0;
    try {
      // fresh links so long downloads never hit an expired one
      const fresh = await api.photos.signedUrls(list.map((p) => p.path));
      for (let part = 0; part < parts && alive.current; part++) {
        const chunk = list.slice(part * PART, (part + 1) * PART);
        const r = await saveZip(chunk.map((p) => ({ url: fresh[p.path] || fulls[p.path], name: fileName(p) })).filter((x) => x.url),
          parts > 1 ? `${base}-part-${part + 1}-of-${parts}.zip` : `${base}.zip`,
          (d) => { if (alive.current) setZipping(`Preparing ${part * PART + d} of ${list.length}…`); });
        failed += r.failed;
      }
      if (alive.current) toast(failed ? `${failed} photo${failed > 1 ? 's' : ''} couldn't be saved. Please try again.` : 'Saved ✓', failed ? 'error' : 'success');
    } catch {
      toast('Could not prepare the download. Please try again.', 'error');
    } finally { if (alive.current) setZipping(null); }
  }

  const header = (
    <View style={{ marginBottom: space.md }}>
      <Txt v="h2">📸 Your photos</Txt>
      <Txt v="muted" style={{ marginTop: 4 }}>{b.package_name} with {creator} · {fmtDate(b.shoot_date)}</Txt>
      <View style={{ marginTop: space.lg }}>
        <Segmented testID="gallery-filter" options={[['all', `All (${photos.length})`], ['fav', `♥ Favourites (${favs})`]]} value={filter} onChange={setFilter} />
      </View>
      <View style={s.tools}>
        <Button testID="g-play" title="▶ Slideshow" kind="secondary" small disabled={!view.length} onPress={() => { setAutoplay(true); setViewerAt(0); }} style={{ flex: 1 }} />
        <Button testID="g-share" title="🔗 Share with friends" kind="secondary" small onPress={() => router.push({ pathname: '/share/[id]', params: { id: b.id } })} style={{ flex: 1 }} />
      </View>
      <Button testID="save-all" title={zipping ?? (filter === 'fav' ? `⬇ Save favourites (${view.length})` : `⬇ Save all (${view.length})`)} onPress={saveAll} disabled={!view.length || !!zipping} style={{ marginTop: space.md }} />
      <Txt v="small" style={{ marginTop: 6, textAlign: 'center' }}>Saved as a ZIP file. Tap a photo to save it on its own.</Txt>
      {extraLink && <Button title={`📁 More files from ${creator}`} kind="ghost" small onPress={() => WebBrowser.openBrowserAsync(extraLink)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />}
    </View>
  );

  return (
    <>
      <FlatList
        testID="client-gallery"
        style={{ backgroundColor: color.canvas }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 64, maxWidth: 900, width: '100%', alignSelf: 'center' }}
        data={view}
        key={`${cols}-${filter}`}
        numColumns={cols}
        columnWrapperStyle={{ gap: 4 }}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<Txt v="muted" style={{ textAlign: 'center', marginTop: space.xl }}>{filter === 'fav' ? 'Tap ♡ on the photos you love — they appear here.' : 'No photos yet.'}</Txt>}
        ListFooterComponent={
          <Txt v="small" style={{ marginTop: space.lg, textAlign: 'center' }}>
            🔒 Private gallery — only you and {creator} can see it. {kept ? `Available until ${fmtDate(kept)} — please save your photos before then.` : "It's kept for 90 days after the booking is completed."}
          </Txt>
        }
        renderItem={({ item, index }) => (
          <View style={{ width: size, height: size, marginBottom: 4 }}>
            <Pressable testID={`gphoto-${index}`} onPress={() => setViewerAt(index)} style={s.tile} accessibilityRole="imagebutton" accessibilityLabel={trx(`Photo ${photos.indexOf(item) + 1}`)}>
              {thumbs[item.path] ? <Image source={{ uri: thumbs[item.path] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} recyclingKey={item.id} accessibilityIgnoresInvertColors /> : null}
            </Pressable>
            <Pressable testID={`gheart-${index}`} onPress={() => setFavorite(item, !item.favorite)} hitSlop={6} style={[s.heart, item.favorite && s.heartOn]}
              accessibilityRole="button" accessibilityState={{ selected: item.favorite }} accessibilityLabel={trx(item.favorite ? 'Remove from favourites' : 'Add to favourites')}>
              <Ionicons name={item.favorite ? 'heart' : 'heart-outline'} size={16} color={item.favorite ? '#fff' : color.err} />
            </Pressable>
          </View>
        )}
      />
      <PhotoViewer
        items={viewerAt === null ? null : view.map((p) => ({ key: p.id, uri: fulls[p.path] || thumbs[p.path] || '', favorite: p.favorite }))}
        start={viewerAt ?? 0}
        onClose={() => { setViewerAt(null); setAutoplay(false); }}
        slideshow autoplay={autoplay}
        onFavorite={(i, on) => { const p = view[i]; if (p) setFavorite(p, on); }}
        onSave={(i) => { const p = view[i]; if (p) saveOne(p); }}
        saving={saving}
      />
      {zipping ? <View pointerEvents="none" style={s.zip}><TText style={s.zipText}>{zipping}</TText></View> : null}
    </>
  );
}

const s = StyleSheet.create({
  tools: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  tile: { flex: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color.sand },
  heart: { position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,251,245,0.94)', alignItems: 'center', justifyContent: 'center' },
  heartOn: { backgroundColor: color.err },
  zip: { position: 'absolute', left: space.lg, right: space.lg, bottom: 32, backgroundColor: color.ink, borderRadius: radius.md, padding: space.md, alignItems: 'center' },
  zipText: { color: color.inkText, fontFamily: font.body, fontSize: 14 },
});
