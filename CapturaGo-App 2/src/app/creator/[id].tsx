import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, font, radius, space } from '../../theme';
import { Badge, Button, Card, Empty, Loading, Stars, Txt, useToast, TText } from '../../components/ui';
import { coverSource } from '../../components/CreatorCard';
import { api, type Review } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PhotoViewer } from '../../components/PhotoViewer';
import { EXAMPLES } from '../../lib/examples';
import { SITE_URL } from '../../lib/config';
import { reviewPhotosOf } from '../../lib/plan-logic';
import { replyLabel } from '../../lib/reply-logic';
import { introVideoOk, packageFacts, packageRules, trustLine } from '../../lib/trust-logic';
import { tripCity, tripDates, upcomingTrips } from '../../lib/trip-logic';
import {
  canBook, droneBadge, euroCents, firstName, fmtDate, galleryOf, hasRemote, httpsUrl, isBoosted, isFounding, money, occasionLabel, packagesOf,
  plural, PRICE_LABELS, serviceIcon, serviceLabel, spotsOf, verifiedLabel, vibeLabel, type Listing,
} from '../../lib/logic';
import { tr as trx } from '../../lib/i18n';
import { dealCents, dealDay } from '../../lib/deal-logic';
import { useDeals } from '../../lib/deals';

export default function CreatorScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [l, setL] = useState<Listing | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [reviews, setReviews] = useState<Review[]>([]);
  // Favourite state is tied to (user, listing) so it never leaks between accounts or profiles
  const [favState, setFavState] = useState<{ key: string; on: boolean } | null>(null);
  const [opening, setOpening] = useState(false);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [reviewView, setReviewView] = useState<{ urls: string[]; at: number; name: string } | null>(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const dealMap = useDeals();

  const load = useCallback(async () => {
    const pid = String(id ?? '');
    if (pid.startsWith('ex-')) {
      const ex = EXAMPLES.find((e) => e.id === pid);
      setL(ex ?? null); setState(ex ? 'ok' : 'missing'); return;
    }
    const { data, error } = await api.listings.byId(pid);
    if (error) { setState('error'); return; }
    if (!data) { setState('missing'); return; }
    setL(data); setState('ok');
    const r = await api.reviews.list(pid);
    setReviews(r.data ?? []);
  }, [id]);

  // load() fetches from the server; only example profiles resolve instantly from bundled data
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!l || l.isExample || (user && l.user_id === user.id)) return;
    api.listings.incrementViews(l.id);
    api.logEvent('profile_view', l.city);
  }, [l?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const favKey = user && l && !l.isExample ? `${user.id}:${l.id}` : '';
  const fav = !!favKey && favState?.key === favKey && favState.on;
  useEffect(() => {
    if (!favKey || !user || !l) return;
    let alive = true;
    api.favorites.ids(user.id).then((ids) => { if (alive) setFavState({ key: favKey, on: ids.includes(l.id) }); });
    return () => { alive = false; };
  }, [favKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'loading') return <Loading />;
  if (state === 'missing') return <Empty title="Creator not found" text="This profile may have been removed." action="Back to Explore" onAction={() => router.back()} />;
  if (state === 'error' || !l) return <Empty title="Couldn't load this profile" text="Check your connection and try again." action="Try again" onAction={() => { setState('loading'); load(); }} />;

  const isOwn = !!user && l.user_id === user.id;
  const pkgs = packagesOf(l);
  const bookable = canBook(l) && !isOwn;
  const spots = spotsOf(l);
  const portfolio = l.portfolio_url ? httpsUrl(l.portfolio_url) : null;
  const ratingNum = Number(l.rating ?? 0);

  const needSignIn = (why: string) => { toast(why); router.push('/sign-in'); };
  const toggleFav = async () => {
    if (!user) return needSignIn('Sign in to save favourites.');
    const { added, error } = await api.favorites.toggle(user.id, l.id);
    if (error) { toast('Could not update favourites. Please try again.', 'error'); return; }
    setFavState({ key: favKey, on: added }); toast(added ? 'Saved to favourites ♥' : 'Removed from favourites');
  };
  const message = async () => {
    if (!user) return needSignIn('Sign in to message creators — it takes 30 seconds.');
    setOpening(true);
    const { data, error } = await api.chat.start(l.id);
    setOpening(false);
    if (error || !data) { toast(error?.message || 'Could not open the conversation. Please try again.', 'error'); return; }
    router.push({ pathname: '/chat/[id]', params: { id: data } });
  };
  const book = (pkgId: string) => {
    if (!user) return needSignIn('Sign in to book — it takes 30 seconds.');
    router.push({ pathname: '/book/[id]', params: { id: l.id, pkg: pkgId, ...(date ? { date: String(date) } : {}) } });
  };
  const canReport = !l.isExample && !isOwn;
  const report = (photo?: string) => {
    if (!user) return needSignIn('Sign in to report a profile.');
    setViewerAt(null); setReviewView(null);
    router.push({ pathname: '/report/[id]', params: { id: l.id, name: firstName(l.name), ...(photo ? { photo } : {}) } });
  };
  const gallery = galleryOf(l);
  const sample = galleryOf(l, 'sample_gallery').slice(0, 40);

  return (
    <>
      <Stack.Screen options={{
        title: firstName(l.name),
        headerRight: l.isExample || isOwn ? undefined : () => (
          <Pressable testID="fav-btn" onPress={toggleFav} hitSlop={10} accessibilityRole="button" accessibilityLabel={trx(fav ? 'Remove from favourites' : 'Save to favourites')} style={{ padding: 8 }}>
            <Ionicons name={fav ? 'heart' : 'heart-outline'} size={24} color={color.clay} />
          </Pressable>
        ),
      }} />
      <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Image source={coverSource(l)} style={s.cover} contentFit="cover" accessibilityIgnoresInvertColors />
        <View style={{ padding: space.lg }}>
          {l.isExample && <View style={s.example}><Txt v="small" style={{ color: color.clay }}>Example profile — not a real creator, can’t be booked.</Txt></View>}
          <Txt v="h1" testID="creator-name">{l.name}</Txt>
          <Txt v="muted" style={{ marginTop: 4 }}>📍 {l.city}{l.travel_available ? ' · ✈ Travels' : ''}</Txt>
          <View style={s.badges}>
            {verifiedLabel(l.verified) ? <Badge label={verifiedLabel(l.verified)} tone="ok" /> : null}
            {isBoosted(l) ? <Badge label="Sponsored" /> : null}
            {isFounding(l) ? <View style={s.founding} testID="founding-badge"><TText style={s.foundingText}>🏅 Founding creator · {l.founding_city}</TText></View> : null}
            {hasRemote(l.services) ? <Badge label="🌐 Works remotely" /> : null}
            {(l.services ?? []).includes('drone') && l.drone_certified ? <Badge label={`🚁 ${droneBadge(l.drone_region)} (declared)`} /> : null}
            {l.available === false ? <Badge label="Not available right now" /> : <Badge label="● Available" tone="ok" />}
          </View>
          {!l.isExample ? <Txt v="small" testID="trust-line" style={{ marginTop: space.sm }}>{trustLine(l)}{isOwn ? '' : ' · 🌍 Chat in any language — we translate'}</Txt> : null}
          {replyLabel(l) ? <Txt v="small" testID="reply-time" style={{ color: color.ok, marginTop: space.sm, fontFamily: font.bold }}>💬 {replyLabel(l)}</Txt> : null}
          {!l.isExample && upcomingTrips(l.trips).length ? (
            <Txt v="small" testID="trip-line" style={{ marginTop: space.sm, color: color.text }}>✈️ On the road: {upcomingTrips(l.trips).slice(0, 4).map((t) => `${tripCity(t)} ${tripDates(t)}`).join(' · ')}</Txt>
          ) : null}
          {bookable && l.instant_book ? (
            <View style={s.instant} testID="instant-tag"><TText style={s.instantText}>⚡ Instant booking — confirmed as soon as you pay</TText></View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
            {ratingNum > 0 ? <><Stars value={Math.round(ratingNum)} /><Txt v="small">{ratingNum.toFixed(1)} · {plural(l.reviews_count ?? 0, 'review')}</Txt></> : <Txt v="small">New on CapturaGo</Txt>}
          </View>
          {l.description ? <Txt v="body" raw style={{ marginTop: space.lg }}>{l.description}</Txt> : null}
          {gallery.length > 0 && (
            <View style={{ marginTop: space.lg }} testID="gallery">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -space.lg }}>
                <View style={{ width: space.lg - 8 }} />
                {gallery.map((g, i) => (
                  <Pressable key={g.url} testID={`gallery-${i}`} onPress={() => setViewerAt(i)} accessibilityRole="imagebutton" accessibilityLabel={trx(`Open photo ${i + 1} of ${gallery.length}`)}
                    style={({ pressed }) => [s.thumb, i === 0 && s.thumbFirst, pressed && { opacity: 0.85 }]}>
                    <Image source={{ uri: g.thumb || g.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={g.url} accessibilityIgnoresInvertColors />
                  </Pressable>
                ))}
                <View style={{ width: space.lg - 8 }} />
              </ScrollView>
              <Txt v="small" style={{ marginTop: 6 }}>📷 {plural(gallery.length, 'photo')} by {firstName(l.name)} · tap to view</Txt>
            </View>
          )}
          {sample.length > 0 && (
            <Pressable testID="sample-btn" onPress={() => setSampleOpen(true)} accessibilityRole="button" accessibilityLabel={trx(`See a full shoot: ${sample.length} photos`)}
              style={({ pressed }) => [s.sample, pressed && { opacity: 0.85 }]}>
              <View style={{ flexDirection: 'row' }}>
                {sample.slice(0, 3).map((g, i) => <Image key={g.url} source={{ uri: g.thumb || g.url }} style={[s.sampleThumb, i > 0 && { marginLeft: -12 }]} contentFit="cover" accessibilityIgnoresInvertColors />)}
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="h3">📂 See a full shoot</Txt>
                <Txt v="small" numberOfLines={2}>{l.sample_title || 'Every photo from one real shoot'} · {sample.length} photos</Txt>
              </View>
            </Pressable>
          )}
          {(l.occasions ?? []).length > 0 && <Txt v="muted" style={{ marginTop: space.md }}><Txt v="h3">Great for: </Txt>{l.occasions!.map(occasionLabel).join(' · ')}</Txt>}

          <View style={[s.badges, { marginTop: space.lg }]}>
            {(l.services ?? []).map((x) => <Badge key={x} label={`${serviceIcon(x)} ${serviceLabel(x)}`} tone="clay" />)}
            {(l.vibes ?? []).map((v) => <Badge key={v} label={vibeLabel(v)} />)}
            {l.price && PRICE_LABELS[l.price] ? <Badge label={PRICE_LABELS[l.price]} /> : null}
          </View>
          {l.languages ? <Txt v="small" style={{ marginTop: space.sm }}>Speaks: {l.languages}</Txt> : null}

          {pkgs.length > 0 && (
            <Card style={{ marginTop: space.xl }} testID="packages">
              <Txt v="h2">Packages</Txt>
              {bookable && pkgs.some((k) => k.type !== 'delivery') ? (dealMap.get(l.id) ?? []).map((d) => (
                <View key={d.day} style={s.dealNote} testID={`deal-note-${d.day}`}>
                  <Txt v="small" style={{ color: '#7A2E12', fontFamily: font.bold }}>{`⚡ Last-minute deal: −${d.pct}% on in-person packages for ${dealDay(d.day)} — pick that day when you book.`}</Txt>
                </View>)) : null}
              {pkgs.map((k, i) => (
                <View key={k.id} style={[s.pkg, i > 0 && s.pkgBorder]}>
                  <View style={{ flex: 1 }}>
                    <Txt v="h3">{k.name}</Txt>
                    {k.type === 'delivery' ? <Txt v="small">🌐 Remote — delivered online</Txt> : null}
                    <View style={s.facts} testID={`facts-${k.id}`}>{packageFacts(k).map((f) => <TText key={f} style={s.fact}>{f}</TText>)}</View>
                    {k.desc ? <Txt v="small">{k.desc}</Txt> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Txt v="h2">{money(Number(k.price_eur))}</Txt>
                    {bookable && k.type !== 'delivery' && (dealMap.get(l.id) ?? []).length > 0
                      ? <Txt v="small" style={{ color: color.clay, fontFamily: font.bold }} testID={`deal-price-${k.id}`}>{`⚡ ${euroCents(dealCents(Number(k.price_eur), Math.max(...(dealMap.get(l.id) ?? []).map((d) => d.pct))))} last-minute`}</Txt> : null}
                    {bookable && <Button testID={`book-${k.id}`} title="Book" small onPress={() => book(k.id)} />}
                  </View>
                </View>
              ))}
              {!l.isExample && (
                <View style={s.rules} testID="pkg-rules">
                  <Txt v="h3" style={{ fontSize: 14 }}>If something goes wrong</Txt>
                  {[...new Set(pkgs.map((k) => (k.type === 'delivery' ? 'delivery' : 'session')))].flatMap((t) => packageRules(t)).map((r) => <Txt key={r} v="small" style={{ color: color.text }}>✓ {r}</Txt>)}
                </View>
              )}
              <Txt v="small" style={{ marginTop: space.md }}>
                {l.isExample ? 'Example packages — this profile is not bookable.'
                  : isOwn ? 'This is how travellers see your packages.'
                  : bookable ? `🔒 Your payment is held by CapturaGo and only released to ${firstName(l.name)} after your shoot — or, for remote work, once you approve the delivery.`
                  : `${firstName(l.name)} takes bookings by message for now — send a message to arrange a date.`}
              </Txt>
            </Card>
          )}

          {!l.isExample && !isOwn && (
            <Button testID="message-btn" title={`Message ${firstName(l.name)}`} kind={bookable ? 'secondary' : 'primary'} style={{ marginTop: space.lg }}
              loading={opening} onPress={message} />
          )}
          {isOwn && <Button testID="edit-own" title="Edit my listing" kind="secondary" style={{ marginTop: space.lg }} onPress={() => router.push('/listing')} />}
          {introVideoOk(l.intro_video_url) && <Button testID="intro-btn" title={`▶ Watch ${firstName(l.name)}’s intro`} kind="secondary" style={{ marginTop: space.sm }} onPress={() => WebBrowser.openBrowserAsync(l.intro_video_url!.trim())} />}
          {portfolio && <Button title="View portfolio ↗" kind="ghost" style={{ marginTop: space.sm }} onPress={() => WebBrowser.openBrowserAsync(portfolio)} />}

          {spots.length > 0 && (
            <View style={{ marginTop: space.xl }}>
              <Txt v="h2">Favourite local spots</Txt>
              {spots.map((sp, i) => (
                <Card key={`${sp.name}-${i}`} style={{ marginTop: space.md }}>
                  <Txt v="h3">📍 {sp.name}</Txt>
                  {sp.desc ? <Txt v="muted" style={{ marginTop: 2 }}>{sp.desc}</Txt> : null}
                </Card>
              ))}
            </View>
          )}

          {!l.isExample && (
            <View style={{ marginTop: space.xl }} testID="reviews">
              <Txt v="h2">Reviews ({reviews.length})</Txt>
              {reviews.length === 0 && <Txt v="muted" style={{ marginTop: space.sm }}>No reviews yet.</Txt>}
              {reviews.map((r) => (
                <Card key={r.id} style={{ marginTop: space.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Txt v="h3">{r.reviewer_name}</Txt>
                      {r.booking_id ? <View style={s.verified}><TText style={s.verifiedText}>✓ Verified booking</TText></View> : null}
                    </View>
                    <Stars value={r.rating} size={14} />
                  </View>
                  {r.comment ? <Txt v="muted" style={{ marginTop: 4 }}>{r.comment}</Txt> : null}
                  {reviewPhotosOf(r).length > 0 && (
                    <View style={s.rvPhotos} testID={`review-photos-${r.id}`}>
                      {reviewPhotosOf(r).map((u, k, all) => (
                        <Pressable key={u} testID={`rv-photo-${r.id}-${k}`} onPress={() => setReviewView({ urls: all, at: k, name: r.reviewer_name })} style={s.rvThumb}
                          accessibilityRole="imagebutton" accessibilityLabel={trx(`Photo ${k + 1} from ${r.reviewer_name}'s review`)}>
                          <Image source={{ uri: u }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} accessibilityIgnoresInvertColors />
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Txt v="small">{fmtDate(r.created_at)}</Txt>
                    {isOwn ? (
                      <Pressable testID={`share-review-${r.id}`} hitSlop={8} accessibilityRole="button" accessibilityLabel={trx("Share this review")}
                        onPress={() => {
                          const link = l.handle ? `${SITE_URL}/c/${l.handle}` : SITE_URL;
                          const quote = r.comment ? `“${r.comment}”` : `${'★'.repeat(r.rating)} review`;
                          Share.share({ message: `${'★'.repeat(r.rating)} ${quote} — ${r.reviewer_name}${r.booking_id ? ' (verified booking)' : ''}\nBook me on CapturaGo: ${link}` }).catch(() => {});
                        }}>
                        <TText style={s.shareLink}>📣 Share</TText>
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              ))}
              <Txt v="small" style={{ marginTop: space.md }} testID="reviews-note">
                Only travellers who booked and paid through CapturaGo can leave a review — after their shoot, from Bookings.
              </Txt>
            </View>
          )}
          {canReport && (
            <Button testID="report-profile" title="⚑ Report this profile" kind="ghost" small onPress={() => report()} style={{ alignSelf: 'flex-start', marginTop: space.xl, paddingHorizontal: 0 }} />
          )}
        </View>
      </ScrollView>
      <PhotoViewer items={viewerAt === null ? null : gallery.map((g) => ({ key: g.url, uri: g.url }))} start={viewerAt ?? 0} onClose={() => setViewerAt(null)}
        onReport={canReport ? (i) => report(gallery[i]?.url) : undefined} />
      <PhotoViewer items={sampleOpen ? sample.map((g) => ({ key: g.url, uri: g.url })) : null} start={0} onClose={() => setSampleOpen(false)} slideshow
        caption={(i) => `${l.sample_title || 'A full shoot'} · ${i + 1}/${sample.length}`}
        onReport={canReport ? (i) => report(sample[i]?.url) : undefined} />
      <PhotoViewer items={reviewView ? reviewView.urls.map((u) => ({ key: u, uri: u })) : null} start={reviewView?.at ?? 0} onClose={() => setReviewView(null)}
        caption={(i) => (reviewView ? `From ${reviewView.name}'s review · ${i + 1}/${reviewView.urls.length}` : '')}
        onReport={canReport ? (i) => report(reviewView?.urls[i]) : undefined} />
    </>
  );
}

const s = StyleSheet.create({
  cover: { width: '100%', aspectRatio: 4 / 3, backgroundColor: color.sand },
  dealNote: { backgroundColor: '#FBEADF', borderRadius: radius.sm, padding: space.md, marginTop: space.sm },
  example: { backgroundColor: color.clayDim, borderRadius: radius.sm, padding: space.md, marginBottom: space.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md },
  pkg: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, alignItems: 'center' },
  pkgBorder: { borderTopWidth: 1, borderTopColor: color.border },
  thumb: { width: 132, height: 132, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.sand },
  thumbFirst: { width: 200 },
  instant: { marginTop: space.sm, alignSelf: 'flex-start', backgroundColor: color.clayDim, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  instantText: { fontFamily: font.bold, fontSize: 13, color: color.clay },
  shareLink: { fontFamily: font.bold, fontSize: 13, color: color.clay },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2, marginTop: 4 },
  fact: { fontFamily: font.body, fontSize: 13, color: color.text },
  rules: { marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.okDim, gap: 2 },
  sample: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.card },
  sampleThumb: { width: 44, height: 44, borderRadius: 8, borderWidth: 2, borderColor: color.card, backgroundColor: color.sand },
  rvPhotos: { flexDirection: 'row', gap: 6, marginTop: space.sm },
  rvThumb: { width: 72, height: 72, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color.sand },
  founding: { backgroundColor: '#FBEFD5', borderColor: '#EBCB8B', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 6, alignSelf: 'flex-start' },
  foundingText: { fontFamily: font.bold, fontSize: 12, color: '#7A4A06' },
  verified: { backgroundColor: color.okDim, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  verifiedText: { fontFamily: font.bold, fontSize: 11, color: color.ok },
});
