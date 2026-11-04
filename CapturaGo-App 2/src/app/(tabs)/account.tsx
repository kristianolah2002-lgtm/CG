import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, font, radius, space, TOUCH } from '../../theme';
import { Button, Card, confirmAsync, Loading, Segmented, Txt, useToast } from '../../components/ui';
import { LANGS, setLang, tr as trx, useLang } from '../../lib/i18n';
import { api, type CityAlert, type FoundingCity } from '../../lib/api';
import { FoundingCard } from '../../components/FoundingCard';
import { useAuth, displayName } from '../../lib/auth';
import { SITE_URL, SUPPORT_EMAIL } from '../../lib/config';
import { serviceLabel, type Listing } from '../../lib/logic';
import { watchStatus, type WatchRow } from '../../lib/watch-logic';
import type { MyTax } from '../../lib/tax-logic';
import { disablePush, enablePush, pushState, type PushState } from '../../lib/push';

function Row({ icon, label, onPress, testID, detail }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; testID?: string; detail?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={color.clay} />
      <Txt v="body" style={{ flex: 1 }}>{label}</Txt>
      {detail ? <Txt v="small">{detail}</Txt> : null}
      <Ionicons name="chevron-forward" size={18} color={color.dim} />
    </Pressable>
  );
}
const web = (path: string) => WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, ready } = useAuth();
  const toast = useToast();
  const lang = useLang();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);
  const [inquiryCount, setInquiryCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [alerts, setAlerts] = useState<CityAlert[]>([]);
  const [openCities, setOpenCities] = useState<FoundingCity[]>([]);
  const [tips, setTips] = useState<boolean | null>(null);
  const [watches, setWatches] = useState<WatchRow[]>([]);
  const [tax, setTax] = useState<MyTax | null>(null);
  const [push, setPush] = useState<PushState>('unsupported');

  const load = useCallback(async () => {
    if (!user) { setListing(null); setAlerts([]); setWatches([]); setTax(null); return; }
    api.watches.mine().then(({ data }) => setWatches(data ?? []));
    pushState().then(setPush);
    api.alerts.mine().then(({ data }) => setAlerts(data ?? []));
    api.emailPrefs.mine().then(({ data }) => setTips(data ? data.tips !== false : null));
    const { data } = await api.listings.mine(user.id);
    setListing(data ?? null);
    if (!data) api.founding.cities().then(({ data: fc }) => setOpenCities((fc ?? []).filter((c) => c.spots_left > 0).slice(0, 6)));
    if (data) {
      api.tax.mine().then(({ data: t }) => setTax(t ?? null));
      const inq = await api.inquiries.forListing(data.id);
      setUnread((inq.data ?? []).filter((q) => !q.read).length);
      setInquiryCount((inq.data ?? []).length);
    }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleAvailable(v: boolean) {
    if (!listing) return;
    setSaving(true);
    const { data, error } = await api.listings.setAvailable(listing.id, v);
    setSaving(false);
    if (error || !data) { toast('Could not update your availability.', 'error'); return; }
    setListing(data);
    toast(v ? "You're shown as available ✓" : "You're shown as not available");
  }
  async function toggleTips(on: boolean) {
    setTips(on);
    const { error } = await api.emailPrefs.setTips(on);
    if (error) { setTips(!on); toast('Could not save your choice.', 'error'); return; }
    toast(on ? 'Tips & reminders on ✓' : "Done — we won't send tips & reminders.");
  }
  async function togglePush(on: boolean) {
    if (!on) { setPush('off'); await disablePush(true); toast('Notifications off on this phone.'); return; }
    const st = await enablePush(true);
    setPush(st === 'unsupported' ? 'off' : st);
    if (st === 'on') toast('Notifications on ✓', 'success');
    else if (st === 'denied') toast('Notifications are blocked — turn them on for CapturaGo in your phone settings.', 'error');
    else toast('Notifications are not available on this phone yet.', 'error');
  }
  async function removeWatch(w: WatchRow) {
    const { error } = await api.watches.remove(w.photographer_id);
    if (error) { toast('Could not change it. Please try again.', 'error'); return; }
    toast('Done — no more alerts about this creator.', 'info');
    setWatches((cur) => cur.filter((x) => x.id !== w.id));
  }
  async function removeAlert(a: CityAlert) {
    const { error } = await api.alerts.remove(a.id);
    if (error) { toast('Could not remove it.', 'error'); return; }
    setAlerts((cur) => cur.filter((x) => x.id !== a.id));
  }
  async function signOut() {
    if (!(await confirmAsync('Sign out?', 'You can sign in again any time.', 'Sign out'))) return;
    await disablePush(false).catch(() => {});   // this phone stops getting the account's notifications
    await api.auth.signOut();
    toast('Signed out.');
  }

  if (!ready) return <Loading />;
  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: 48 }}>
      <Txt v="h1">Account</Txt>
      {!user ? (
        <Card style={{ marginTop: space.lg }} testID="signed-out">
          <Txt v="h2">Welcome to CapturaGo</Txt>
          <Txt v="muted" style={{ marginTop: 4, marginBottom: space.lg }}>Sign in to book creators, save favourites and see your bookings.</Txt>
          <Button testID="go-sign-in" title="Sign in" onPress={() => router.push('/sign-in')} />
          <Button testID="go-sign-up" title="Create account" kind="secondary" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signup' } })} style={{ marginTop: space.md }} />
        </Card>
      ) : (
        <>
          <Card style={{ marginTop: space.lg }}>
            <Txt v="h2" testID="account-name">{displayName(user)}</Txt>
            <Txt v="muted">{user.email}</Txt>
          </Card>

          <Txt v="label" style={s.section}>Creator</Txt>
          {listing ? <FoundingCard onClaimed={load} /> : null}
          {listing === undefined ? <Loading /> : listing ? (
            <>
            {tax && tax.required && !tax.info ? (
              <Pressable testID="tax-reminder" onPress={() => router.push('/tax')} accessibilityRole="button" style={[s.taxNote, tax.hold && { borderColor: color.err }]}>
                <Txt v="h3">🧾 Add your tax details</Txt>
                <Txt v="small" style={{ marginTop: 2 }}>EU law (DAC7) requires us to collect them from creators who are paid through CapturaGo. It takes about two minutes.</Txt>
                {tax.hold ? <Txt v="small" style={{ color: color.err, fontFamily: font.bold, marginTop: 4 }}>Your payouts are on hold until you add them.</Txt> : null}
              </Pressable>
            ) : null}
            <Card testID="creator-card">
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Txt v="h3">Show me as available</Txt>
                  <Txt v="small">{listing.available === false ? 'Travellers see you as not available' : 'Travellers can contact and book you'}</Txt>
                </View>
                <Switch testID="available-toggle" value={listing.available !== false} onValueChange={toggleAvailable} disabled={saving}
                  accessibilityLabel={trx("Show me as available")} trackColor={{ true: color.clay, false: color.borderStrong }} thumbColor={color.card} />
              </View>
              <Row testID="my-profile" icon="person-circle-outline" label="View my profile" onPress={() => router.push({ pathname: '/creator/[id]', params: { id: listing.id } })} />
              <Row testID="edit-listing" icon="create-outline" label="Edit listing, photos & packages" onPress={() => router.push('/listing')} />
              <Row testID="availability" icon="calendar-number-outline" label="Availability, trips & calendar sync" detail={listing.instant_book ? '⚡ On' : undefined} onPress={() => router.push('/availability')} />
              <Row testID="booking-link" icon="link-outline" label="My booking link, QR code & invites" detail={listing.handle ? `/c/${listing.handle}` : 'Set up'} onPress={() => router.push('/link')} />
              <Row testID="earnings" icon="stats-chart-outline" label="Earnings & CSV export" onPress={() => router.push('/earnings')} />
              <Row testID="payouts" icon="card-outline" label="Payouts" detail={listing.payouts_enabled ? 'Active' : 'Not set up'} onPress={() => router.push('/payouts')} />
              <Row testID="tax-link" icon="receipt-outline" label="Tax details (EU DAC7)" detail={tax?.info ? '✓ Saved' : tax?.required ? 'Needed' : undefined} onPress={() => router.push('/tax')} />
              {inquiryCount > 0 && <Row testID="my-inquiries" icon="mail-outline" label="Email inquiries" detail={unread ? `${unread} new` : undefined} onPress={() => router.push('/inquiries')} />}
            </Card>
            </>
          ) : (
            <Card testID="become-creator">
              <Txt v="h3">Are you a photographer, videographer or editor?</Txt>
              <Txt v="muted" style={{ marginTop: 4 }}>Create a free listing — travellers find you in the app and on capturago.com.</Txt>
              {openCities.length > 0 && (
                <View style={s.open} testID="founding-open">
                  <Txt v="small" style={{ fontFamily: font.bold }}>🏅 Founding creator spots are open in:</Txt>
                  <Txt v="small">{openCities.map((c) => `${c.city_label} (${c.spots_left} left)`).join(' · ')}</Txt>
                  <Txt v="small" style={{ marginTop: 2 }}>The first creators there get a badge{openCities.some((c) => c.perk_days > 0) ? ' and a free boost' : ''}.</Txt>
                </View>
              )}
              <Button testID="create-listing" title="Create my listing" kind="secondary" small onPress={() => router.push('/listing')} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />
            </Card>
          )}

          <Txt v="label" style={s.section}>You</Txt>
          <Card style={{ paddingVertical: 4 }}>
            <Row testID="my-favorites" icon="heart-outline" label="Favourites" onPress={() => router.push('/favorites')} />
            <Row icon="calendar-outline" label="Bookings" onPress={() => router.navigate('/bookings')} />
            <Row testID="requests-link" icon="megaphone-outline" label="Shoot requests & offers" onPress={() => router.push('/requests')} />
            <Row testID="quick-replies" icon="flash-outline" label="Quick replies for chats" onPress={() => router.push('/templates')} />
            <Row testID="calendar-link" icon="today-outline" label="Bookings in your calendar" onPress={() => router.push('/calendar')} />
            <Row testID="phone-link" icon="chatbox-ellipses-outline" label="Text reminders on the shoot day" onPress={() => router.push('/phone')} />
            <Row testID="deals-link" icon="flash-outline" label="Last-minute deals & 🎲 Surprise me" onPress={() => router.push('/deals')} />
            <Row testID="gift-link" icon="gift-outline" label="Gift a shoot — gift cards" onPress={() => web('/gift.html')} />
            {push !== 'unsupported' && (
              <View style={s.tipsRow} testID="push-row">
                <View style={{ flex: 1 }}>
                  <Txt v="body">Notifications on this phone</Txt>
                  <Txt v="small">{push === 'denied' ? 'Blocked in your phone settings — allow notifications for CapturaGo there.' : 'New bookings, messages and replies, free days of creators you wait for.'}</Txt>
                </View>
                <Switch testID="push-toggle" value={push === 'on'} onValueChange={togglePush} disabled={push === 'denied'} accessibilityLabel={trx('Notifications on this phone')}
                  trackColor={{ true: color.clay, false: color.borderStrong }} thumbColor={color.card} />
              </View>
            )}
            {tips !== null && (
              <View style={s.tipsRow}>
                <View style={{ flex: 1 }}>
                  <Txt v="body">Tips & reminders by email</Txt>
                  <Txt v="small">Review reminder and a “one year ago” note. Booking emails always arrive.</Txt>
                </View>
                <Switch testID="tips-toggle" value={tips} onValueChange={toggleTips} accessibilityLabel={trx("Tips and reminders by email")}
                  trackColor={{ true: color.clay, false: color.borderStrong }} thumbColor={color.card} />
              </View>
            )}
          </Card>
          {watches.length > 0 && (
            <>
              <Txt v="label" style={s.section}>{"Creators you're waiting for"}</Txt>
              <Card style={{ paddingVertical: 4 }} testID="watches-card">
                <Txt v="small" style={{ paddingTop: space.sm }}>We tell you once when one of them has a free day again or posts a last-minute deal.</Txt>
                {watches.map((w) => (
                  <View key={w.id} style={s.alert} testID={`watch-${w.photographer_id}`}>
                    <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/creator/[id]', params: { id: w.photographer_id } })} accessibilityRole="button">
                      <Txt v="body">🔔 {w.name}{w.city ? ` · ${String(w.city).split(',')[0]}` : ''}</Txt>
                      <Txt v="small" style={w.notified_at ? { color: color.ok } : undefined}>{watchStatus(w)}{w.by_text && !w.notified_at ? ' · 📱' : ''}</Txt>
                    </Pressable>
                    <Pressable testID={`watch-del-${w.photographer_id}`} onPress={() => removeWatch(w)} hitSlop={8} accessibilityRole="button" accessibilityLabel={trx('Stop notifying me')} style={s.alertDel}>
                      <Ionicons name="close" size={20} color={color.dim} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            </>
          )}
          {alerts.length > 0 && (
            <>
              <Txt v="label" style={s.section}>Cities you follow</Txt>
              <Card style={{ paddingVertical: 4 }} testID="alerts-card">
                {alerts.map((a) => (
                  <View key={a.id} style={s.alert} testID={`alert-${a.id}`}>
                    <View style={{ flex: 1 }}>
                      <Txt v="body">📍 {a.city_label}{a.service ? ` · ${serviceLabel(a.service)}` : ''}</Txt>
                      <Txt v="small">{a.notified_at ? '✓ We emailed you — a creator joined' : "We'll email you once when a creator joins"}</Txt>
                    </View>
                    <Pressable testID={`alert-del-${a.id}`} onPress={() => removeAlert(a)} hitSlop={8} accessibilityRole="button" accessibilityLabel={trx(`Stop following ${a.city_label}`)} style={s.alertDel}>
                      <Ionicons name="close" size={20} color={color.dim} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      <Txt v="label" style={s.section}>Language</Txt>
      <Card style={{ paddingVertical: space.md }}>
        <Segmented testID="lang" options={LANGS} value={lang} onChange={(l) => { setLang(l); }} />
        <Txt v="small" style={{ marginTop: space.sm }}>Emails, legal pages and some creator screens are in English.</Txt>
      </Card>

      <Txt v="label" style={s.section}>Help & legal</Txt>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="mail-outline" label="Contact support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        <Row testID="privacy" icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
        <Row testID="terms" icon="document-text-outline" label="Terms of Service" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
        <Row icon="globe-outline" label="capturago.com" onPress={() => web('/')} />
      </Card>

      {user && (
        <>
          <Button testID="sign-out" title="Sign out" kind="secondary" onPress={signOut} style={{ marginTop: space.xl }} />
          <Button testID="delete-account" title="Delete account" kind="danger" onPress={() => router.push('/delete-account')} style={{ marginTop: space.md }} />
        </>
      )}
      <Txt v="small" style={{ textAlign: 'center', marginTop: space.xl }}>CapturaGo {Constants.expoConfig?.version ?? ''}</Txt>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  section: { marginTop: space.xl, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH, paddingVertical: 6 },
  tipsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH, paddingVertical: 8, borderTopWidth: 1, borderTopColor: color.border, marginTop: 4 },
  open: { marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: '#FFFBF2', borderWidth: 1, borderColor: '#EBCB8B', gap: 2 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH, paddingVertical: 6 },
  alertDel: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  taxNote: { backgroundColor: color.clayDim, borderRadius: radius.lg, borderWidth: 1, borderColor: color.clay, padding: space.lg, marginBottom: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.sm, marginBottom: space.sm, borderBottomWidth: 1, borderBottomColor: color.border },
});
