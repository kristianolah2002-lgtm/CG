import React, { useCallback, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { color, font, radius, space } from '../../theme';
import { Button, Card, confirmAsync, Empty, Loading, PromptModal, Txt, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { setBookingBadge } from '../../lib/badge';
import { PlanBox, ProposalBox } from '../../components/PlanBox';
import { canPlan, canPropose, isoNice } from '../../lib/plan-logic';
import { packageFacts, photosDue } from '../../lib/trust-logic';
import { holdState, payoutNote } from '../../lib/trip-logic';
import { clientAmountText, splitNote } from '../../lib/gift-logic';
import {
  bookingButtons, bookingHint, clientSeesPhotos, creatorPhotoButton, euroCents, fmtDate, httpsUrl, isDelivery, needsAction, PHOTO_STATUSES,
  photosKeptUntil, slotLabel, statusText, type Booking, type BookingAction,
} from '../../lib/logic';

const CONFIRM: Partial<Record<BookingAction, (n: string, d: string) => [string, string, boolean]>> = {
  decline: (n, d) => ['Decline this booking?', `"${n}" on ${d}. The traveller will be refunded in full.`, true],
  cancel: (n, d) => ['Cancel this booking?', `"${n}" on ${d}.`, true],
  complete: (n) => ['Release the payment?', `The payment for "${n}" goes to the creator. This can't be undone.`, false],
};
const DONE: Record<BookingAction, string> = {
  confirm: 'Booking confirmed ✓', decline: 'Declined — the traveller is being refunded.', cancel: 'Booking cancelled.',
  complete: 'Payment released ✓', dispute: "Thanks — we'll be in touch within 48 hours.", deliver: 'Delivered ✓ — the client has been notified.', revise: 'Revision requested ✓',
};
const PILL: Record<string, { bg: string; fg: string }> = {
  paid: { bg: color.clayDim, fg: color.clay }, pending_payment: { bg: color.clayDim, fg: color.clay },
  confirmed: { bg: color.okDim, fg: color.ok }, completed: { bg: color.okDim, fg: color.ok }, delivered: { bg: color.clayDim, fg: color.clay },
  disputed: { bg: color.errDim, fg: color.err },
};

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, ready } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<Booking[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ b: Booking; action: 'revise' } | null>(null);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: err } = await api.bookings.list();
    if (err) { setError(true); return; }
    setError(false);
    const rows = (data ?? []).filter((b) => b.status !== 'expired' || b.client_user_id === user.id);
    const [counts, mine] = await Promise.all([
      api.photos.counts(rows.filter((b) => PHOTO_STATUSES.includes(b.status)).map((b) => b.id)),
      rows.some((b) => b.client_user_id === user.id && b.status === 'completed') ? api.reviews.myBookingIds(user.id) : Promise.resolve([] as string[]),
    ]);
    setPhotoCounts(counts);
    setReviewed(new Set(mine));
    setList(rows);
    setBookingBadge(needsAction(rows, user.id));
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const plan = (b: Booking, mode: 'reschedule' | 'meeting' | 'brief' | 'dispute', weather = false) =>
    router.push({ pathname: '/plan/[id]', params: { id: b.id, mode, ...(weather ? { weather: '1' } : {}) } });

  async function answer(b: Booking, action: 'accept_date' | 'decline_date' | 'withdraw_date') {
    if (action === 'accept_date' && !(await confirmAsync('Move the shoot?', `"${b.package_name}" moves to ${isoNice(b.proposed_date!)}.`, 'Accept new date'))) return;
    setBusyId(b.id);
    const { error: err } = await api.bookings.action(b.id, action);
    setBusyId(null);
    if (err) { toast(err.message || 'Something went wrong.', 'error'); load(); return; }
    toast({ accept_date: 'New date confirmed ✓', decline_date: 'You kept the original date.', withdraw_date: 'Proposal withdrawn.' }[action], 'success');
    load();
  }

  async function act(b: Booking, action: BookingAction, extra: Record<string, unknown> = {}) {
    if (action === 'dispute') { plan(b, 'dispute'); return; }
    const h = action === 'complete' && b.client_user_id === user?.id ? holdState(b) : null;
    if (h && !h.sent) {   // photos promised but not sent yet: say so clearly
      if (!(await confirmAsync('Release the payment?', `Your photos for "${b.package_name}" haven't been sent yet. Release the payment to the creator anyway? This can't be undone.`, 'Release anyway', true))) return;
    } else if (CONFIRM[action] && !extra.delivery_url && !extra.message) {
      const c = CONFIRM[action]!;
      const [title, msg, destructive] = c(b.package_name, fmtDate(b.shoot_date));
      if (!(await confirmAsync(title, msg, 'Continue', destructive))) return;
    }
    setBusyId(b.id);
    const { data, error: err } = await api.bookings.action(b.id, action, extra);
    setBusyId(null);
    if (err) { toast(err.message || 'Something went wrong.', 'error'); return; }
    toast(action === 'cancel' && data?.refunded ? 'Cancelled — your refund is on its way.' : DONE[action], 'success');
    load();
  }

  function openPhotos(b: Booking) {
    router.push({ pathname: '/photos/[id]', params: { id: b.id } });
  }

  async function openChat(b: Booking) {
    const { data, error: err } = await api.chat.forBooking(b.id);
    if (err || !data) { toast(err?.message || 'Could not open the conversation.', 'error'); return; }
    router.push({ pathname: '/chat/[id]', params: { id: data } });
  }

  if (!ready) return <Loading />;
  if (!user) return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Empty testID="bookings-signed-out" title="Your bookings" text="Sign in to see the shoots you've booked — or bookings travellers made with you." action="Sign in" onAction={() => router.push('/sign-in')} />
    </View>
  );
  if (list === null && !error) return <Loading />;

  const renderItem = ({ item: b }: { item: Booking }) => {
    const asCreator = b.creator_user_id === user.id;
    const remote = isDelivery(b);
    const btns = bookingButtons(b, asCreator);
    const nPhotos = photoCounts[b.id] ?? 0;
    const kept = !asCreator && nPhotos > 0 && clientSeesPhotos(b) ? photosKeptUntil(b) : null;
    const hint = bookingHint(b, asCreator)
      || (asCreator && !remote && b.status === 'confirmed' && creatorPhotoButton(b, nPhotos) && !nPhotos ? 'After the shoot, upload the photos here — your client gets a private gallery to view and save them.' : '')
      || (kept ? `Your photos are kept until ${fmtDate(kept)}. Save your favourites before then.` : '');
    const showCreatorPhotos = asCreator && creatorPhotoButton(b, nPhotos);
    const showClientGallery = !asCreator && nPhotos > 0 && clientSeesPhotos(b);
    const canReview = !asCreator && b.status === 'completed' && !!b.photographer_id;
    const planning = canPlan(b);
    const hasMeeting = !!(b.meeting_point || b.meeting_time);
    const hasBrief = (b.shot_list ?? []).length > 0 || (b.ref_links ?? []).length > 0;
    const showPropose = canPropose(b, user.id);
    const pill = PILL[b.status] ?? { bg: color.input, fg: color.dim };
    const files = b.client_files_url ? httpsUrl(b.client_files_url) : null;
    const delivery = b.delivery_url ? httpsUrl(b.delivery_url) : null;
    return (
      <Card testID={`booking-${b.id}`} style={{ marginBottom: space.lg }}>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Txt v="h3">{b.package_name}</Txt>
            <Txt v="small">{asCreator ? 'Booked with you' : 'Your booking'}</Txt>
          </View>
          <View style={[s.pill, { backgroundColor: pill.bg }]}><Txt v="small" style={{ color: pill.fg, fontFamily: font.bold }}>{statusText(b)}</Txt></View>
        </View>
        <Txt v="muted" style={{ marginTop: space.sm }}>{remote ? '🌐 Remote · due' : '📅'} {fmtDate(b.shoot_date)}{!remote && b.time_slot ? ` · ${slotLabel(b.time_slot)}` : ''}</Txt>
        {!remote && b.shoot_city ? <Txt v="small" testID={`city-${b.id}`} style={{ fontFamily: font.bold, color: color.text }}>✈️ In {String(b.shoot_city).split(',')[0]} (the creator’s trip)</Txt> : null}
        {(asCreator && b.via_link) || (b.surprise && !remote) ? (
          <View style={s.tags}>
            {asCreator && b.via_link ? <View style={s.tag}><Txt v="small" style={{ color: color.clay, fontFamily: font.bold }}>✨ Booked via your link</Txt></View> : null}
            {Number(b.deal_pct) > 0 ? <View style={s.tag} testID={`deal-tag-${b.id}`}><Txt v="small" style={{ color: color.clay, fontFamily: font.bold }}>{`⚡ Last-minute −${Number(b.deal_pct)}%`}</Txt></View> : null}
            {b.surprise && !remote ? <View style={s.tag} testID={`surprise-${b.id}`}><Txt v="small" style={{ color: color.clay, fontFamily: font.bold }}>🤫 Surprise{asCreator ? ' — keep it secret' : ''}</Txt></View> : null}
          </View>
        ) : null}
        <Txt v="muted">{asCreator ? `🧳 ${b.client_name} · ${b.client_email}` : `📷 ${b.photographers ? `${b.photographers.name}, ${b.photographers.city}` : 'Creator'}`}</Txt>
        <Txt v="muted" testID={`amount-${b.id}`}>💶 {asCreator ? `You receive ${euroCents(b.price_cents - b.creator_fee_cents)}` : clientAmountText(b, euroCents)}</Txt>
        {b.note ? <Txt v="muted" style={s.note}>“{b.note}”</Txt> : null}
        {files && <Button title="📁 Open client's files" kind="ghost" small style={s.link} onPress={() => WebBrowser.openBrowserAsync(files)} />}
        {delivery && <Button title="✅ Open delivery" kind="ghost" small style={s.link} onPress={() => WebBrowser.openBrowserAsync(delivery)} />}
        {b.photographer_id && b.client_user_id && b.creator_user_id ? (
          <Button testID={`msg-${b.id}`} title={asCreator ? `💬 Message ${b.client_name.split(' ')[0] || 'the client'}` : '💬 Message the creator'} kind="ghost" small style={s.link} onPress={() => openChat(b)} />
        ) : asCreator ? <Button title="✉️ Email the client" kind="ghost" small style={s.link} onPress={() => Linking.openURL(`mailto:${encodeURIComponent(b.client_email)}`)} /> : null}
        {(() => {
          const facts = b.package_details ? packageFacts(b.package_details) : [];
          const due = photosDue(b);
          const waiting = !!due && !b.photos_ready_at && ['paid', 'confirmed', 'completed'].includes(b.status);
          if (!facts.length && !waiting) return null;
          return (
            <View style={s.included} testID={`included-${b.id}`}>
              <Txt v="small" style={{ fontFamily: font.bold, color: color.text }}>What’s included{waiting ? ` · 📬 photos by ${fmtDate(due)}` : ''}</Txt>
              {facts.map((f) => <Txt key={f} v="small">{f}</Txt>)}
            </View>
          );
        })()}
        {!asCreator && splitNote(b) ? <Txt v="small" testID={`split-${b.id}`} style={{ marginTop: space.sm, color: color.clay, fontFamily: font.bold }}>{splitNote(b)}</Txt> : null}
        {payoutNote(b, asCreator) ? <View style={s.included} testID={`hold-${b.id}`}><Txt v="small" style={{ color: color.text }}>{payoutNote(b, asCreator)}</Txt></View> : null}
        <ProposalBox b={b} userId={user.id} asCreator={asCreator} busy={busyId === b.id} onAnswer={(a) => answer(b, a)} />
        <PlanBox b={b} userId={user.id} asCreator={asCreator} onWeatherMove={() => plan(b, 'reschedule', true)} />
        {hint ? <Txt v="small" style={{ marginTop: space.sm }}>{hint}</Txt> : null}
        {!asCreator && Number(b.split_count) > 1 && b.status === 'pending_payment' && (
          <Button testID={`links-${b.id}`} title="👯 Friends’ payment links" small onPress={() => router.push({ pathname: '/split/[id]', params: { id: b.id } })} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />
        )}
        {(btns.length > 0 || showCreatorPhotos || showClientGallery || canReview || planning) && (
          <View style={s.actions}>
            {btns.map((x) => (
              <Button key={x.action} testID={`act-${b.id}-${x.action}`} title={x.label} small kind={x.kind} loading={busyId === b.id}
                onPress={() => (x.action === 'deliver' ? openPhotos(b) : x.action === 'revise' ? setPrompt({ b, action: 'revise' }) : act(b, x.action))} />
            ))}
            {showCreatorPhotos && (
              <Button testID={`photos-${b.id}`} title={`📷 ${remote ? 'Delivered photos' : 'Photos for the client'}${nPhotos ? ` (${nPhotos})` : ''}`} small
                kind={remote || nPhotos ? 'secondary' : 'primary'} onPress={() => openPhotos(b)} />
            )}
            {showClientGallery && <Button testID={`gallery-${b.id}`} title={`📸 Your photos (${nPhotos})`} small onPress={() => router.push({ pathname: '/gallery/[id]', params: { id: b.id } })} />}
            {planning && asCreator && <Button testID={`meet-${b.id}`} title={hasMeeting ? '📍 Edit meeting point' : '📍 Set meeting point'} small kind={hasMeeting ? 'secondary' : 'primary'} onPress={() => plan(b, 'meeting')} />}
            {planning && !asCreator && <Button testID={`brief-${b.id}`} title={hasBrief ? '📝 Edit shot list' : '📝 Shot list & references'} small kind="secondary" onPress={() => plan(b, 'brief')} />}
            {showPropose && <Button testID={`move-${b.id}`} title="📅 Propose a new date" small kind="secondary" onPress={() => plan(b, 'reschedule')} />}
            {canReview && b.photographers ? <Button testID={`again-${b.id}`} title={`📅 Book ${String(b.photographers.name || '').split(' ')[0] || 'them'} again`} small kind="secondary"
              onPress={() => router.push({ pathname: '/creator/[id]', params: { id: String(b.photographer_id) } })} /> : null}
            {canReview && <Button testID={`next-${b.id}`} title="🧭 Where to next?" small kind="secondary" onPress={() => router.navigate({ pathname: '/', params: { trip: '1' } })} />}
            {canReview && (reviewed.has(b.id)
              ? <View style={s.reviewed}><Txt v="small" style={{ color: color.ok, fontFamily: font.bold }}>✓ Reviewed</Txt></View>
              : <Button testID={`review-${b.id}`} title="⭐ Leave a review" small kind="secondary" onPress={() => router.push({ pathname: '/review/[id]', params: { id: b.id } })} />)}
          </View>
        )}
      </Card>
    );
  };

  return (
    <>
      <FlatList
        testID="bookings-list"
        style={{ backgroundColor: color.canvas }}
        contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, flexGrow: 1 }}
        data={list ?? []}
        keyExtractor={(b) => b.id}
        renderItem={renderItem}
        ListHeaderComponent={<Txt v="h1" style={{ marginBottom: space.lg }}>Bookings</Txt>}
        ListEmptyComponent={error
          ? <Empty title="Couldn't load your bookings" text="Check your connection and try again." action="Try again" onAction={load} />
          : <Empty testID="bookings-empty" title="No bookings yet" text="Find a creator for your next trip and book them here." action="Explore creators" onAction={() => router.navigate('/')} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={color.clay} />}
      />
      <PromptModal
        visible={prompt?.action === 'revise'}
        title="Request a revision"
        message="Tell the creator what to change."
        label="What should change?" multiline confirmLabel="Send request"
        validate={(v) => (v.length >= 3 ? null : 'Tell the creator what to change.')}
        onCancel={() => setPrompt(null)}
        onSubmit={(v) => { const b = prompt!.b; setPrompt(null); act(b, 'revise', { message: v.slice(0, 1000) }); }}
      />
    </>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, maxWidth: '50%' },
  note: { marginTop: space.sm, fontStyle: 'italic' },
  link: { alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 36 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  included: { marginTop: space.sm, padding: space.sm, borderRadius: radius.sm, backgroundColor: color.sand, gap: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { alignSelf: 'flex-start', backgroundColor: color.clayDim, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  reviewed: { minHeight: 40, justifyContent: 'center', paddingHorizontal: space.sm },
});
