// 📅 Your bookings in your calendar: a private .ics link for Google, Apple or Outlook Calendar (same as the website).
import React, { useState } from 'react';
import { Linking, Platform, ScrollView, Share, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { color, font, radius, space } from '../theme';
import { Button, Card, confirmAsync, Empty, Txt, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { googleSubscribeUrl, webcalUrl } from '../lib/trip-logic';

export default function CalendarFeedScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return <Empty title="Sign in first" action="Sign in" onAction={() => router.push('/sign-in')} />;

  async function get(reset: boolean) {
    if (reset && !(await confirmAsync('Make a new calendar link?', 'The old link stops working — calendars subscribed to it stop updating.', 'Make a new link', true))) return;
    setBusy(true);
    const { data, error } = await api.calendar.feedToken(reset);
    setBusy(false);
    if (error || !data) { toast(error?.code === 'PGRST202' ? 'Calendar links need the latest database update.' : 'Could not get your calendar link. Please try again.', 'error'); return; }
    setUrl(api.calendar.feedUrl(data));
    if (reset) toast('New link ready ✓ — subscribe to it again in your calendar.', 'success');
  }
  async function share() {
    if (!url) return;
    try { await Share.share(Platform.OS === 'ios' ? { url } : { message: url }); } catch { /* dismissed */ }
  }

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} testID="calendar-feed">
      <Txt v="muted">Subscribe once and every CapturaGo booking shows up in Google, Apple or Outlook Calendar — and stays up to date.</Txt>
      {!url ? (
        <Button testID="feed-get" title="Get my calendar link" onPress={() => get(false)} loading={busy} style={{ marginTop: space.lg }} />
      ) : (
        <Card style={{ marginTop: space.lg }}>
          <Txt v="label">Your private calendar link</Txt>
          <View style={{ marginTop: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: color.input }}>
            <Txt v="small" testID="feed-url" selectable style={{ fontFamily: font.body, color: color.text }}>{url}</Txt>
          </View>
          <Button testID="feed-apple" title="Add to Apple Calendar / Outlook" onPress={() => Linking.openURL(webcalUrl(url)).catch(() => toast('No calendar app could open it — share the link instead.', 'error'))} style={{ marginTop: space.md }} />
          <Button testID="feed-google" title="Add to Google Calendar" kind="secondary" onPress={() => WebBrowser.openBrowserAsync(googleSubscribeUrl(url))} style={{ marginTop: space.sm }} />
          <Button testID="feed-share" title="Share or copy the link" kind="secondary" onPress={share} style={{ marginTop: space.sm }} />
          <Txt v="small" style={{ marginTop: space.md }}>🔒 Keep this link private — anyone who has it can see your booking dates. Calendars refresh it every few hours.</Txt>
          <Button testID="feed-reset" title="Make a new link" kind="ghost" small onPress={() => get(true)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
        </Card>
      )}
    </ScrollView>
  );
}
