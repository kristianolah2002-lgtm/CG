// 📣 Shoot requests: my requests with the offers I got, and (creators) requests near me — same as the website dashboard.
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { color, font, radius, space } from '../theme';
import { Button, Card, confirmAsync, Empty, Loading, Txt, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtDate, type Listing } from '../lib/logic';
import { OFFER_STATUS, offerFacts, requestHead, type NearRequest, type Offer, type ShootRequest } from '../lib/request-logic';

export default function RequestsScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [mine, setMine] = useState<ShootRequest[] | null>(null);
  const [near, setNear] = useState<NearRequest[] | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: m }, { data: l }] = await Promise.all([api.requests.mine(), api.listings.mine(user.id)]);
    setMine(Array.isArray(m) ? m : []);
    setListing(l ?? null);
    if (l) { const { data: n } = await api.requests.forMe(); setNear(Array.isArray(n) ? n : []); } else setNear(null);
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) return <Empty title="Sign in first" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (mine === null) return <Loading />;

  async function book(o: Offer) {
    setBusy(o.id);
    const { data, error } = await api.pay.checkout({ offer_id: o.id });
    setBusy('');
    if (error || !data?.url) { toast(error?.message || 'Could not start the payment.', 'error'); return; }
    await WebBrowser.openBrowserAsync(data.url);
    toast('Your booking status is in Bookings.');
    load();
  }
  async function message(creatorId: string) {
    const { data, error } = await api.chat.start(creatorId);
    if (error || !data) { toast(error?.message || 'Could not open the conversation.', 'error'); return; }
    router.push({ pathname: '/chat/[id]', params: { id: data } });
  }
  async function decline(o: Offer) {
    if (!(await confirmAsync('Decline this offer?', 'The creator is not told why.', 'Decline', true))) return;
    const { error } = await api.requests.decline(o.id);
    if (error) { toast(error.message || 'Could not decline.', 'error'); return; }
    toast('Offer declined.', 'success'); load();
  }
  async function close(q: ShootRequest) {
    if (!(await confirmAsync('Close this request?', 'Open offers are declined and creators can no longer send new ones.', 'Close request', true))) return;
    const { error } = await api.requests.close(q.id);
    if (error) { toast(error.message || 'Could not close the request.', 'error'); return; }
    toast('Request closed.', 'success'); load();
  }
  async function withdraw(o: Offer) {
    const { error } = await api.requests.withdraw(o.id);
    if (error) { toast(error.message || 'Could not withdraw.', 'error'); return; }
    toast('Offer withdrawn.', 'success'); load();
  }

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} testID="requests"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={color.clay} />}>
      <Txt v="muted">Travellers describe the shoot they want; creators who are in that city on those dates send offers.</Txt>

      {listing && near && (
        <>
          <Txt v="h2" style={s.section}>Requests near you</Txt>
          {near.length ? near.map((q) => (
            <Card key={q.id} style={s.card} testID={`near-${q.id}`}>
              <Txt v="h3">{q.first_name} · {requestHead(q)}</Txt>
              <Txt v="small" style={{ marginTop: 2 }}>{q.offers_count} offer{q.offers_count === 1 ? '' : 's'} so far</Txt>
              {q.note ? <Txt v="small" style={s.note}>“{q.note}”</Txt> : null}
              {q.my_offer ? <Txt v="small" testID={`my-offer-${q.id}`} style={{ marginTop: space.sm, color: color.text }}>Your offer: €{q.my_offer.price_eur} · {offerFacts(q.my_offer, fmtDate)}{q.my_offer.status !== 'open' ? ` · ${OFFER_STATUS[q.my_offer.status]}` : ''}</Txt> : null}
              <View style={s.actions}>
                {(!q.my_offer || q.my_offer.status === 'open' || q.my_offer.status === 'withdrawn') && (
                  <Button testID={`offer-${q.id}`} small kind={q.my_offer?.status === 'open' ? 'secondary' : 'primary'} title={q.my_offer?.status === 'open' ? '✏️ Change my offer' : '💬 Send an offer'}
                    onPress={() => router.push({ pathname: '/offer/[id]', params: { id: q.id } })} />
                )}
                {q.my_offer?.status === 'open' && <Button testID={`withdraw-${q.id}`} small kind="ghost" title="Withdraw" onPress={() => withdraw(q.my_offer!)} />}
              </View>
            </Card>
          )) : <Card style={s.card}><Txt v="muted" testID="near-empty">No open requests in {String(listing.city || 'your city').split(',')[0]} or on your trips right now. We email you when one comes in.</Txt></Card>}
        </>
      )}

      <View style={[s.section, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Txt v="h2">Your requests</Txt>
        <Button testID="req-new" small kind="secondary" title="📣 Post a request" onPress={() => router.push('/request-new')} />
      </View>
      {mine.length ? mine.map((q) => {
        const live = q.status === 'open';
        const open = q.offers.filter((o) => o.status === 'open').length;
        return (
          <Card key={q.id} style={s.card} testID={`req-${q.id}`}>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <Txt v="h3" style={{ flex: 1 }}>{requestHead(q)}</Txt>
              <View style={[s.pill, { backgroundColor: live ? color.clayDim : color.sand }]}><Txt v="small" style={{ fontFamily: font.bold, color: live ? color.clay : color.muted }}>{live ? `${open} offer${open === 1 ? '' : 's'}` : q.status === 'booked' ? 'Booked' : 'Closed'}</Txt></View>
            </View>
            {q.note ? <Txt v="small" style={s.note}>“{q.note}”</Txt> : null}
            {q.offers.length ? q.offers.map((o) => {
              const c = o.creator;
              return (
                <View key={o.id} style={[s.offer, o.status !== 'open' && { opacity: 0.6 }]} testID={`offer-card-${o.id}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    {c?.cover_image_url ? <Image source={{ uri: c.cover_image_url }} style={s.ava} contentFit="cover" /> : <View style={[s.ava, { alignItems: 'center', justifyContent: 'center' }]}><Txt v="h3" style={{ color: color.clay }}>{String(c?.name || '?').charAt(0)}</Txt></View>}
                    <View style={{ flex: 1 }}>
                      <Txt v="h3" onPress={() => c && router.push({ pathname: '/creator/[id]', params: { id: c.id } })}>{c?.name ?? 'Creator'}</Txt>
                      <Txt v="small">{c?.reviews_count ? `★ ${Number(c.rating || 0).toFixed(1)} (${c.reviews_count})` : 'New on CapturaGo'}{(c?.verified ?? 0) >= 2 ? ' · ✓ verified' : ''}</Txt>
                    </View>
                    <Txt v="h2" style={{ color: color.clay }}>€{o.price_eur}</Txt>
                  </View>
                  <Txt v="small" style={{ marginTop: space.sm, color: color.text }}>{offerFacts(o, fmtDate)}</Txt>
                  {o.message ? <Txt v="small" style={s.note}>“{o.message}”</Txt> : null}
                  {o.status === 'open' && live ? (
                    <View style={s.actions}>
                      <Button testID={`book-offer-${o.id}`} small title={`Book · €${o.price_eur} + fee`} loading={busy === o.id} onPress={() => book(o)} />
                      {c && <Button testID={`msg-offer-${o.id}`} small kind="secondary" title="💬 Message" onPress={() => message(c.id)} />}
                      <Button testID={`decline-${o.id}`} small kind="ghost" title="Decline" onPress={() => decline(o)} />
                    </View>
                  ) : <Txt v="small" style={{ marginTop: space.sm, fontFamily: font.bold }}>{OFFER_STATUS[o.status] || (live ? '' : 'Request closed')}</Txt>}
                </View>
              );
            }) : <Txt v="small" style={{ marginTop: space.sm }}>{live ? 'No offers yet — creators in that city are told right away. We’ll email you when offers arrive.' : 'No offers.'}</Txt>}
            {live && <Button testID={`close-${q.id}`} small kind="ghost" title="Close this request" onPress={() => close(q)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: space.sm }} />}
          </Card>
        );
      }) : <Card style={s.card}><Txt v="muted" testID="req-empty">No requests yet. Can’t decide on a creator? Post a request and let creators send you offers.</Txt></Card>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  section: { marginTop: space.xl, marginBottom: space.sm },
  card: { marginBottom: space.md },
  note: { marginTop: space.sm, fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  offer: { marginTop: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.card },
  ava: { width: 42, height: 42, borderRadius: 21, backgroundColor: color.clayDim },
});
