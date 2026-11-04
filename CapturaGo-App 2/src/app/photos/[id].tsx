// Creator: upload the finished photos into the client's private gallery, then send it
// (sessions) or deliver the order (remote work). Same rules as the website dashboard.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, font, radius, space } from '../../theme';
import { Button, Card, confirmAsync, Empty, Field, Loading, Txt, useToast, TText } from '../../components/ui';
import { PhotoViewer } from '../../components/PhotoViewer';
import { api, type BookingPhoto } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { creatorCanRemovePhotos, firstName, fmtDate, httpsUrl, isDelivery, MAX_BOOKING_PHOTOS, PHOTO_STATUSES, thumbPath, type Booking } from '../../lib/logic';
import { pickPhotos, prepareUpload } from '../../lib/photo-io';
import { tr as trx } from '../../lib/i18n';

export default function PhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [b, setB] = useState<Booking | null | undefined>(undefined);
  const [photos, setPhotos] = useState<BookingPhoto[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [viewer, setViewer] = useState<{ items: { key: string; uri: string }[]; start: number } | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    const [bk, ph] = await Promise.all([api.bookings.list(), api.photos.list(String(id))]);
    const found = (bk.data ?? []).find((x) => x.id === id) ?? null;
    setB(found);
    if (found?.delivery_url) setLink(found.delivery_url);
    const list = ph.data ?? [];
    setPhotos(list);
    const signed = await api.photos.signedUrls(list.map((p) => thumbPath(p.path)));
    const missing = list.filter((p) => !signed[thumbPath(p.path)]).map((p) => p.path);
    const fulls = missing.length ? await api.photos.signedUrls(missing) : {};
    const map: Record<string, string> = {};
    list.forEach((p) => { const u = signed[thumbPath(p.path)] || fulls[p.path]; if (u) map[p.path] = u; });
    setThumbs((cur) => ({ ...map, ...cur }));
  }, [id]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (b === undefined) return <Loading />;
  if (!b || !user || b.creator_user_id !== user.id) return <Empty title="Booking not found" text="Only the creator of a booking can add photos." action="Back" onAction={() => router.back()} />;
  if (!PHOTO_STATUSES.includes(b.status)) return <Empty title="Photos can't be added" text="Photos can be added to confirmed, delivered and completed bookings." action="Back" onAction={() => router.back()} />;

  const remote = isDelivery(b);
  const removable = creatorCanRemovePhotos(b);
  const who = firstName(b.client_name);
  const busy = !!progress && progress.done < progress.total;
  const cols = width > 600 ? 5 : 3;
  const size = (Math.min(width, 900) - space.lg * 2 - (cols - 1) * 6) / cols;

  async function add() {
    const room = MAX_BOOKING_PHOTOS - photos.length;
    if (room <= 0) { toast(`Up to ${MAX_BOOKING_PHOTOS} photos per booking.`); return; }
    const picked = await pickPhotos(room);
    if (!picked.length) return;
    setProgress({ done: 0, total: picked.length });
    let failed = 0, lastErr = '';
    for (let i = 0; i < picked.length && alive.current; i++) {
      try {
        const { full, thumb } = await prepareUpload(picked[i], 3000, 600);
        const r = await api.photos.upload(b!.id, full.base64, thumb?.base64 ?? null, { w: full.w, h: full.h });
        if (r.error || !r.data) throw new Error(r.error?.message || 'Upload failed.');
        const row = r.data;
        if (thumb) setThumbs((cur) => ({ ...cur, [row.path]: thumb.uri }));
        setPhotos((cur) => [...cur, row]);
      } catch (e) { failed++; lastErr = e instanceof Error ? e.message : ''; }
      if (alive.current) setProgress({ done: i + 1, total: picked.length });
    }
    if (!alive.current) return;
    if (failed) {
      const why = /row-level|policy|permission/i.test(lastErr) ? 'This booking can no longer receive photos.' : /300|limit/i.test(lastErr) ? `Up to ${MAX_BOOKING_PHOTOS} photos per booking.` : 'Please check your connection and try again.';
      toast(`${failed} photo${failed > 1 ? 's' : ''} couldn't be uploaded. ${why}`, 'error');
    } else toast(`${picked.length} photo${picked.length > 1 ? 's' : ''} uploaded ✓${!remote && !b!.photos_ready_at ? ' — send them when you’re ready.' : ''}`, 'success');
    setTimeout(() => { if (alive.current) setProgress(null); }, 1500);
  }

  async function remove(p: BookingPhoto) {
    if (!(await confirmAsync('Remove this photo?', 'The client will no longer see it.', 'Remove', true))) return;
    const err = await api.photos.remove(p);
    if (err) { toast(err.message || 'Could not remove the photo.', 'error'); return; }
    setPhotos((cur) => cur.filter((x) => x.id !== p.id));
  }

  async function open(i: number) {
    const urls = await api.photos.signedUrls(photos.map((p) => p.path), 3600);
    setViewer({ items: photos.map((p) => ({ key: p.id, uri: urls[p.path] || thumbs[p.path] || '' })).filter((x) => x.uri), start: i });
  }

  async function sendReady() {
    setSending(true);
    const { data, error } = await api.bookings.action(b!.id, 'photos_ready');
    setSending(false);
    if (error) { toast(error.message || 'Could not notify the client.', 'error'); return; }
    setB({ ...b!, photos_ready_at: data?.booking?.photos_ready_at || new Date().toISOString() });
    toast(`Sent ✓ — ${who} got an email with the gallery link.`, 'success');
  }

  async function deliver() {
    const url = link.trim();
    if (url && !httpsUrl(url)) { setLinkError('The link must start with https://'); return; }
    if (!url && !photos.length) { toast('Upload the finished photos, or add a link to the files.', 'error'); return; }
    if (!(await confirmAsync('Deliver now?', `${who} gets an email and can approve the delivery${(b!.revisions_allowed ?? 0) - (b!.revisions_used ?? 0) > 0 ? ' or ask for a revision' : ''}.`, 'Deliver'))) return;
    setSending(true);
    const { error } = await api.bookings.action(b!.id, 'deliver', url ? { delivery_url: url } : {});
    setSending(false);
    if (error) { toast(error.message || 'Something went wrong.', 'error'); return; }
    toast('Delivered ✓ — the client has been notified.', 'success');
    router.back();
  }

  const header = (
    <View style={{ marginBottom: space.md }}>
      <Txt v="h2">{remote ? `Deliver to ${b.client_name}` : `Photos for ${b.client_name}`}</Txt>
      <Txt v="muted" style={{ marginTop: 4 }}>{b.package_name} · {fmtDate(b.shoot_date)}</Txt>
      <Txt v="small" style={{ marginTop: space.sm }}>🔒 Only you and {who} can see these photos. Full quality up to 3000 px. They’re kept for 90 days after the booking is completed.</Txt>
      <Pressable testID="photos-add" onPress={busy ? undefined : add} accessibilityRole="button" accessibilityLabel={trx("Add photos")} style={({ pressed }) => [s.drop, pressed && { opacity: 0.8 }, busy && { opacity: 0.6 }]}>
        <Ionicons name="cloud-upload-outline" size={28} color={color.clay} />
        <TText style={s.dropTitle}>{busy ? `Uploading ${Math.min(progress!.done + 1, progress!.total)} of ${progress!.total}…` : 'Add photos'}</TText>
        <TText style={s.dropSub}>From your library · up to {MAX_BOOKING_PHOTOS}</TText>
      </Pressable>
      {progress && <View style={s.bar}><View style={[s.barFill, { width: `${Math.round((progress.done / progress.total) * 100)}%` }]} /></View>}
      <Txt v="h3" style={{ marginTop: space.lg }} testID="photos-count">{photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : 'No photos yet'}</Txt>
    </View>
  );

  const footer = (
    <View style={{ marginTop: space.lg }}>
      {remote ? (b.status === 'confirmed' ? (
        <Card>
          <Field testID="deliver-link" label="Link to the files (optional)" value={link} onChangeText={(v) => { setLink(v); setLinkError(null); }} keyboardType="url" autoCapitalize="none" autoCorrect={false}
            placeholder={trx("https://drive.google.com/…")} error={linkError} hint="For videos or RAW files — Google Drive, Dropbox or WeTransfer." />
          <Button testID="deliver-btn" title={`✅ Deliver to ${who}`} onPress={deliver} loading={sending} disabled={busy} />
        </Card>
      ) : <Txt v="muted">{b.status === 'delivered' ? 'Delivered — the client is reviewing it.' : 'This order is completed.'}</Txt>) : (
        <>
          <Button testID="send-photos" title={b.photos_ready_at ? '📨 Notify again' : `📨 Send to ${who}`} onPress={sendReady} loading={sending} disabled={!photos.length || busy} />
          <Txt v="small" style={{ marginTop: space.sm, textAlign: 'center' }}>
            {b.photos_ready_at ? `Client notified ${fmtDate(b.photos_ready_at)}.` : 'When you’re done uploading, send the gallery — the client gets an email with a link.'}
          </Txt>
        </>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: trx(remote ? 'Deliver' : 'Photos') }} />
      <FlatList
        testID="photos-grid"
        style={{ backgroundColor: color.canvas }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 64, maxWidth: 900, width: '100%', alignSelf: 'center' }}
        data={photos}
        key={cols}
        numColumns={cols}
        columnWrapperStyle={{ gap: 6 }}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={({ item, index }) => (
          <View style={{ width: size, height: size, marginBottom: 6 }}>
            <Pressable testID={`photo-${index}`} onPress={() => open(index)} style={s.tile} accessibilityRole="imagebutton" accessibilityLabel={trx(`Photo ${index + 1}`)}>
              {thumbs[item.path] ? <Image source={{ uri: thumbs[item.path] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} recyclingKey={item.id} accessibilityIgnoresInvertColors /> : null}
            </Pressable>
            {item.favorite ? <View style={s.fav}><Text style={s.favText}>♥</Text></View> : null}
            {removable && (
              <Pressable testID={`photo-del-${index}`} onPress={() => remove(item)} hitSlop={6} style={s.del} accessibilityRole="button" accessibilityLabel={trx(`Remove photo ${index + 1}`)}>
                <Ionicons name="close" size={16} color={color.text} />
              </Pressable>
            )}
          </View>
        )}
      />
      <PhotoViewer items={viewer?.items ?? null} start={viewer?.start ?? 0} onClose={() => setViewer(null)} />
    </>
  );
}

const s = StyleSheet.create({
  drop: { marginTop: space.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(176,71,34,0.35)', borderRadius: radius.lg, backgroundColor: color.input, alignItems: 'center', paddingVertical: space.xl, gap: 4 },
  dropTitle: { fontFamily: font.bold, fontSize: 16, color: color.text },
  dropSub: { fontFamily: font.body, fontSize: 12, color: color.dim },
  bar: { height: 6, borderRadius: 3, backgroundColor: color.sand, marginTop: space.md, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: color.clay },
  tile: { flex: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color.sand },
  del: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,251,245,0.94)', alignItems: 'center', justifyContent: 'center' },
  fav: { position: 'absolute', top: 6, left: 6, backgroundColor: color.err, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  favText: { color: '#fff', fontSize: 11, fontFamily: font.bold },
});
