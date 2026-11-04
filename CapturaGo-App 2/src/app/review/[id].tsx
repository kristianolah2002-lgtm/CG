// Traveller: verified review after a completed booking (one per booking — database rule).
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { color, font, radius, space } from '../../theme';
import { Button, Empty, Field, Loading, Stars, Txt, useToast } from '../../components/ui';
import { api, type BookingPhoto } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { clientSeesPhotos, thumbPath, type Booking } from '../../lib/logic';
import { remoteToJpeg } from '../../lib/photo-io';
import { tr as trx } from '../../lib/i18n';

const LABELS = ['', 'Poor', 'Could be better', 'Good', 'Great', 'Amazing'];

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [b, setB] = useState<Booking | null | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  // Photos from this booking's private gallery the traveller can attach (copied to public storage only if chosen)
  const [pool, setPool] = useState<BookingPhoto[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    api.bookings.list().then(async ({ data }) => {
      const found = (data ?? []).find((x) => x.id === id) ?? null;
      setB(found);
      if (!found || !clientSeesPhotos(found)) return;
      const ph = await api.photos.list(found.id);
      const list = (ph.data ?? []).slice().sort((x, y) => Number(y.favorite) - Number(x.favorite)).slice(0, 24);
      if (!list.length) return;
      const t = await api.photos.signedUrls(list.map((p) => thumbPath(p.path)), 3600);
      const tm: Record<string, string> = {};
      list.forEach((p) => { tm[p.path] = t[thumbPath(p.path)] || ''; });
      setThumbs(tm); setPool(list);
    });
  }, [id]);

  if (b === undefined) return <Loading />;
  if (!b || !user || b.client_user_id !== user.id || b.status !== 'completed' || !b.photographer_id) {
    return <Empty title="Reviews open after the shoot" text="You can review a creator once your booking is completed." action="Back" onAction={() => router.back()} />;
  }
  const creator = b.photographers?.name || 'your creator';

  const toggle = (pid: string) => setChosen((cur) => {
    if (cur.includes(pid)) return cur.filter((x) => x !== pid);
    if (cur.length >= 3) { toast('Up to 3 photos.'); return cur; }
    return [...cur, pid];
  });
  async function uploadChosen(): Promise<string[]> {
    const urls: string[] = [];
    const picks = chosen.map((c) => pool.find((p) => p.id === c)).filter((p): p is BookingPhoto => !!p);
    const signed = await api.photos.signedUrls(picks.map((p) => p.path), 600);
    for (const [i, p] of picks.entries()) {
      setStatus(`Adding photo ${i + 1} of ${picks.length}…`);
      if (!signed[p.path]) throw new Error('Could not read one of the photos.');
      const jpg = await remoteToJpeg(signed[p.path], 1600, 0.85);
      const up = await api.listing.uploadPublic(jpg.base64, user!.id, 'r');
      if (up.error || !up.url) throw new Error(up.error?.message || 'Upload failed.');
      urls.push(up.url);
    }
    return urls;
  }

  async function submit() {
    if (!rating) { toast('Please choose 1 to 5 stars.', 'error'); return; }
    setSending(true);
    let photos: string[] = [];
    try { photos = chosen.length ? await uploadChosen() : []; }
    catch (e) { setSending(false); setStatus(''); toast(`${e instanceof Error ? e.message : 'Upload failed.'} Your review wasn't published — please try again.`, 'error'); return; }
    setStatus('');
    const { error, photosDropped } = await api.reviews.add({
      photographer_id: b!.photographer_id!, user_id: user!.id, booking_id: b!.id,
      reviewer_name: String(b!.client_name || 'Traveller').slice(0, 80), rating, comment: comment.trim().slice(0, 1000) || null, photos,
    });
    setSending(false);
    if (error && photos.length) api.listing.removePublic(photos, user!.id);
    if (error) {
      const dup = error.code === '23505' || /duplicate|unique/i.test(error.message);
      toast(dup ? 'You have already reviewed this booking.' : /row-level|policy|permission/i.test(error.message) ? 'Reviews can be left after a completed booking.' : 'Could not publish your review. Please try again.', 'error');
      if (dup) router.back();
      return;
    }
    if (photosDropped) api.listing.removePublic(photos, user!.id);
    toast(`Thank you! Your review is live on ${creator}'s profile.`, 'success');
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Txt v="h1">How was your shoot with {creator}?</Txt>
        <Txt v="muted" style={{ marginTop: space.sm }}>Your review appears on their profile as a ✓ Verified booking, under the name {b.client_name}.</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xl }}>
          <Stars value={rating} onChange={setRating} size={36} />
          <Txt v="muted" testID="rating-label">{rating ? LABELS[rating] : 'Tap to rate'}</Txt>
        </View>
        <Field testID="review-text" label={`Tell other travellers about it (${comment.length}/1000)`} value={comment} onChangeText={(v) => setComment(v.slice(0, 1000))} multiline maxLength={1000}
          placeholder={trx("What made it special? Would you book them again?")} />
        {pool.length > 0 && (
          <View style={{ marginBottom: space.lg }} testID="rv-photos">
            <Txt v="h3">Add up to 3 of your photos <Txt v="muted">(optional)</Txt></Txt>
            <Txt v="small" style={{ marginTop: 2, marginBottom: space.sm }}>They’re shown publicly with your review. Your favourites come first.</Txt>
            <View style={s.grid}>
              {pool.map((p, i) => {
                const n = chosen.indexOf(p.id);
                return (
                  <Pressable key={p.id} testID={`rv-pick-${i}`} onPress={() => toggle(p.id)} style={[s.pick, n >= 0 && s.pickOn]}
                    accessibilityRole="checkbox" accessibilityState={{ checked: n >= 0 }} aria-checked={n >= 0} accessibilityLabel={trx(n >= 0 ? 'Remove photo from review' : 'Add photo to review')}>
                    {thumbs[p.path] ? <Image source={{ uri: thumbs[p.path] }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={p.id} accessibilityIgnoresInvertColors /> : null}
                    {n >= 0 ? <View style={s.num}><Text style={s.numText}>{n + 1}</Text></View> : null}
                    {p.favorite ? <Text style={s.fav}>♥</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        <Button testID="review-send" title={status || 'Publish review'} onPress={submit} loading={sending && !status} disabled={sending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pick: { width: 76, height: 76, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color.sand, borderWidth: 2, borderColor: 'transparent' },
  pickOn: { borderColor: color.clay },
  num: { position: 'absolute', top: 4, left: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: color.clay, alignItems: 'center', justifyContent: 'center' },
  numText: { color: '#fff', fontFamily: font.bold, fontSize: 12 },
  fav: { position: 'absolute', bottom: 2, right: 5, color: '#fff', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
});
