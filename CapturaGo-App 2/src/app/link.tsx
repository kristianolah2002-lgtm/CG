// Creator: personal booking link + QR code. Travellers who book through it pay a lower service fee.
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { color, radius, space } from '../theme';
import { Button, Card, Empty, Field, Loading, Txt, useToast } from '../components/ui';
import { QrCode } from '../components/QrCode';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CLIENT_FEE_PCT, SITE_URL } from '../lib/config';
import { cleanHandleInput, feePctFor, handleProblem, isHandleTaken, slugify, type Listing } from '../lib/logic';
import { qrCardSvg } from '../lib/plan-logic';
import { saveTextFile } from '../lib/photo-io';
import { tr as trx } from '../lib/i18n';

export default function LinkScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [l, setL] = useState<Listing | null | undefined>(undefined);
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viaLink, setViaLink] = useState(0);
  const [invite, setInvite] = useState<{ code: string; joined: number; rewarded: number; max: number; invited_by: string | null; my_reward: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;
    api.bookings.list().then(({ data }) => setViaLink((data ?? []).filter((b) => b.creator_user_id === user.id && b.via_link && !['pending_payment', 'expired', 'cancelled', 'declined', 'refunded'].includes(b.status)).length));
    api.listings.mine(user.id).then(({ data }) => {
      setL(data ?? null);
      if (data) api.invites.mine().then(({ data: inv }) => setInvite(inv && inv.code ? inv : null));
      setHandle(data?.handle || (data ? slugify(data.name) : ''));
    });
  }, [user]);

  if (!user) return <Empty title="Sign in first" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (l === undefined) return <Loading />;
  if (!l) return <Empty title="Create your listing first" action="Create my listing" onAction={() => router.replace('/listing')} />;

  const saved = l.handle || '';
  const url = saved ? `${SITE_URL}/c/${saved}` : '';
  const linkFee = feePctFor(true);

  async function save() {
    const h = handle.trim();
    const problem = h ? handleProblem(h) : 'Choose your link first.';
    if (problem) { setError(problem); return; }
    setSaving(true);
    const { data, error: err } = await api.listings.update(l!.id, { handle: h });
    setSaving(false);
    if (isHandleTaken(err)) { setError('That link is already taken — please choose another.'); return; }
    if (err || !data) { toast(err?.code && ['42703', 'PGRST204'].includes(err.code) ? 'Booking links need the latest database update.' : `Could not save: ${err?.message || 'please try again.'}`, 'error'); return; }
    setL(data); toast('Your link is ready ✓', 'success');
  }
  async function printCard() {
    try { await saveTextFile(qrCardSvg(url, l!.name, l!.city), `capturago-qr-${saved}.svg`, 'image/svg+xml', 'public.svg-image'); }
    catch { toast('Could not create the card. Please try again.', 'error'); }
  }
  async function share() {
    try { await Share.share(Platform.OS === 'ios' ? { url, message: `Book a photo shoot with me on CapturaGo` } : { message: `Book a photo shoot with me on CapturaGo: ${url}` }); } catch { /* dismissed */ }
  }

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
      <Txt v="muted">Put it in your Instagram bio, on business cards or send it to clients.{linkFee < CLIENT_FEE_PCT ? ` Travellers who book through it pay a ${linkFee}% service fee instead of ${CLIENT_FEE_PCT}% — you still keep 100%.` : ''}</Txt>
      {saved ? (
        <Card style={{ marginTop: space.lg, alignItems: 'center' }} testID="link-card">
          <View style={s.qr}><QrCode value={url} size={200} testID="link-qr" /></View>
          <Txt v="h3" selectable style={{ marginTop: space.md, textAlign: 'center' }} testID="link-url">{url.replace(/^https?:\/\//, '')}</Txt>
          <Button testID="link-share" title="Share my link" onPress={share} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
          <Button testID="link-print" title="🖨 Printable QR card" kind="secondary" onPress={printCard} style={{ marginTop: space.sm, alignSelf: 'stretch' }} />
          <Txt v="small" style={{ marginTop: space.sm, textAlign: 'center' }}>A sharp card with your name and QR code (SVG) — print it for your stand, business cards or a sign at events.</Txt>
          <Txt v="body" testID="link-count" style={{ marginTop: space.md, textAlign: 'center' }}>{viaLink ? `✨ ${viaLink} client${viaLink > 1 ? 's' : ''} booked through your link` : 'No bookings through your link yet'}</Txt>
        </Card>
      ) : null}
      <Card style={{ marginTop: space.lg }}>
        <Txt v="h3">{saved ? 'Change your link' : 'Choose your link'}</Txt>
        <Txt v="small" style={{ marginTop: 2, marginBottom: space.md }}>{saved ? 'Old links stop working when you change it.' : '3–30 characters: lowercase letters, numbers and dashes.'}</Txt>
        <Field testID="handle-input" label={`capturago.com/c/${handle || '…'}`} value={handle} onChangeText={(v) => { setHandle(cleanHandleInput(v)); setError(null); }}
          autoCapitalize="none" autoCorrect={false} maxLength={30} placeholder={trx("your-name")} error={error} />
        <Button testID="handle-save" title={saved ? 'Save new link' : 'Create my link'} onPress={save} loading={saving} disabled={handle === saved} kind={saved ? 'secondary' : 'primary'} />
      </Card>
      {invite && (
        <Card style={{ marginTop: space.lg }} testID="invite-card">
          <Txt v="h3">🎁 Invite a creator — you both get a boost</Txt>
          <Txt v="small" style={{ marginTop: 4 }}>When a creator joins with your link and completes their first booking, you both get a free 7-day boost to the top of the results.</Txt>
          <View style={{ marginTop: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: color.input }}>
            <Txt v="small" selectable testID="invite-url" style={{ color: color.text }}>{`${SITE_URL}/?invite=${invite.code}`}</Txt>
          </View>
          <Txt v="small" testID="invite-stats" style={{ marginTop: space.sm, color: color.text }}>{invite.joined ? `${invite.joined} creator${invite.joined === 1 ? '' : 's'} joined with your link · ${invite.rewarded} boost${invite.rewarded === 1 ? '' : 's'} earned` : 'Nobody has joined with your link yet.'}{invite.rewarded >= invite.max ? ` (that's the maximum of ${invite.max})` : ''}</Txt>
          {invite.invited_by ? <Txt v="small" style={{ marginTop: 4 }}>You joined with {invite.invited_by.split(' ')[0]}’s invite{invite.my_reward ? ' — your boost was added ✓' : ' — your boost comes after your first completed booking'}.</Txt> : null}
          <Button testID="invite-share" small kind="secondary" title="Share my invite link" style={{ marginTop: space.md, alignSelf: 'flex-start' }}
            onPress={() => { const u = `${SITE_URL}/?invite=${invite.code}`; Share.share(Platform.OS === 'ios' ? { url: u, message: 'Join me on CapturaGo — we both get a free boost' } : { message: `Join me on CapturaGo — we both get a free boost: ${u}` }).catch(() => {}); }} />
        </Card>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  qr: { padding: space.sm, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: color.border },
});
