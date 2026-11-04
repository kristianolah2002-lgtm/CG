// Creator: days off, shoots per day, instant booking, trips and calendar sync (same as the website's Availability panel).
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { color, font, radius, space } from '../theme';
import { Button, Card, Chip, confirmAsync, DateField, DatePicker, Empty, Field, Loading, Txt, useToast, type DayMark } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isoInDays, type Listing, type Trip } from '../lib/logic';
import { calendarUrlOk, cleanTrip, keptTrips, syncedAgo, tripCity, tripDates, tripOn, tripsProblem, upcomingTrips, type CalendarSync } from '../lib/trip-logic';
import { tr as trx } from '../lib/i18n';
import { DealsCard } from '../components/DealsCard';

export default function AvailabilityScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [l, setL] = useState<Listing | null | undefined>(undefined);
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set());
  const [full, setFull] = useState<Set<string>>(() => new Set());
  const [perDay, setPerDay] = useState(1);
  const [instant, setInstant] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ext, setExt] = useState<Set<string>>(() => new Set());
  const [sync, setSync] = useState<CalendarSync | null>(null);
  const [syncUnavailable, setSyncUnavailable] = useState(false);
  const [calUrl, setCalUrl] = useState('');
  const [calBusy, setCalBusy] = useState('');
  const [tripCityIn, setTripCityIn] = useState('');
  const [tripFrom, setTripFrom] = useState<string | null>(null);
  const [tripTo, setTripTo] = useState<string | null>(null);
  const [tripBusy, setTripBusy] = useState(false);
  const today = isoInDays(0), max = isoInDays(365);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await api.listings.mine(user.id);
      if (!data) { setL(null); return; }
      const off = new Set((data.unavailable_dates ?? []).filter((d) => d >= today && d <= max));
      const [busy, st] = await Promise.all([api.listings.busyDates(data.id), api.calendar.status()]);
      const fromCal = new Set((st.data?.busy_dates ?? []).filter((d) => typeof d === 'string'));
      setBlocked(off);
      setExt(fromCal);
      setSync(st.data ?? null);
      setSyncUnavailable(!!st.error);
      setFull(new Set(busy.filter((d) => !off.has(d) && !fromCal.has(d))));
      setPerDay(Math.min(Math.max(Number(data.max_per_day) || 1, 1), 6));
      setInstant(!!data.instant_book);
      setL(data);
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return <Empty title="Sign in first" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (l === undefined) return <Loading />;
  if (!l) return <Empty title="Create your listing first" action="Create my listing" onAction={() => router.replace('/listing')} />;

  const toggle = (iso: string) => {
    setBlocked((cur) => { const n = new Set(cur); if (n.has(iso)) n.delete(iso); else n.add(iso); return n; });
    setDirty(true);
  };
  async function save() {
    setSaving(true);
    const { data, error } = await api.listings.update(l!.id, { unavailable_dates: [...blocked].sort().slice(0, 400), max_per_day: perDay, instant_book: instant });
    setSaving(false);
    if (error || !data) {
      toast(error?.code && ['42703', 'PGRST204'].includes(error.code) ? 'Availability needs the latest database update.' : `Could not save: ${error?.message || 'please try again.'}`, 'error');
      return;
    }
    setL(data); setDirty(false);
    toast(instant ? 'Saved ✓ — instant booking is on.' : 'Availability saved ✓', 'success');
  }

  // ── Trips: saved straight away (the database refuses a change that would move a booked shoot) ──
  async function saveTrips(next: Trip[], ok: string): Promise<boolean> {
    setTripBusy(true);
    const { data, error } = await api.listings.update(l!.id, { trips: next.map(cleanTrip) });
    setTripBusy(false);
    if (error || !data) {
      const m = error?.message || '';
      toast(/shoot/.test(m) ? m : error?.code && ['42703', 'PGRST204'].includes(error.code) ? 'Trips need the latest database update.' : `Could not save your trips: ${m || 'please try again.'}`, 'error');
      return false;
    }
    setL(data);
    toast(ok, 'success');
    return true;
  }
  async function addTrip() {
    const city = tripCityIn.replace(/\s+/g, ' ').trim();
    const t: Trip = { city, from: tripFrom ?? '', to: tripTo ?? tripFrom ?? '' };
    const next = [...keptTrips(l!.trips), t];
    const problem = tripsProblem(next);
    if (problem) { toast(problem, 'error'); return; }
    setTripBusy(true);
    const c = await api.listing.geocode(city);
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) { t.lat = Math.round(c.lat * 1e4) / 1e4; t.lon = Math.round(c.lon * 1e4) / 1e4; }
    if (await saveTrips(next, `Trip to ${tripCity(t)} added ✓ — travellers searching ${tripCity(t)} will find you.`)) { setTripCityIn(''); setTripFrom(null); setTripTo(null); }
  }
  async function removeTrip(t: Trip) {
    if (!(await confirmAsync('Remove this trip?', `${tripCity(t)} · ${tripDates(t)}`, 'Remove', true))) return;
    await saveTrips(keptTrips(l!.trips).filter((x) => !(x.from === t.from && x.to === t.to && x.city === t.city)), `Trip to ${tripCity(t)} removed.`);
  }

  // ── Calendar sync: busy days from the creator's own calendar ──
  async function refreshSync(announce: boolean) {
    const st = await api.calendar.status();
    const fromCal = new Set((st.data?.busy_dates ?? []).filter((d) => typeof d === 'string'));
    setExt(fromCal);
    setFull((cur) => new Set([...cur].filter((d) => !fromCal.has(d))));
    setSync(st.data ?? null);
    const imp = st.data?.import;
    if (announce && imp) toast(imp.last_error ? imp.last_error : `Calendar connected ✓ — ${imp.busy_count} busy day${imp.busy_count === 1 ? '' : 's'} found.`, imp.last_error ? 'error' : 'success');
  }
  async function connectCal() {
    if (!calendarUrlOk(calUrl)) { toast('Paste the secret iCal link from Google Calendar, Apple iCloud, Outlook, Proton or Fastmail (it starts with https:// or webcal://).', 'error'); return; }
    setCalBusy('connect');
    const { error } = await api.calendar.connect(calUrl);
    if (error) { setCalBusy(''); toast(error.message || 'Could not connect your calendar.', 'error'); return; }
    await api.calendar.syncNow();
    await refreshSync(true);
    setCalBusy(''); setCalUrl('');
  }
  async function syncCal() {
    setCalBusy('sync');
    const { error } = await api.calendar.syncNow();
    if (error) { setCalBusy(''); toast(error.message || 'Could not sync right now.', error.status === 429 ? 'info' : 'error'); return; }
    await refreshSync(true);
    setCalBusy('');
  }
  async function disconnectCal() {
    if (!(await confirmAsync('Disconnect your calendar?', 'Days blocked by it become bookable again.', 'Disconnect', true))) return;
    const { error } = await api.calendar.disconnect();
    if (error) { toast('Could not disconnect. Please try again.', 'error'); return; }
    toast('Calendar disconnected.', 'success');
    await refreshSync(false);
  }
  const marks = (d: string): DayMark[] => [...(ext.has(d) ? ['ext' as const] : []), ...(tripOn(l.trips, d) ? ['trip' as const] : [])];
  const dayNote = (d: string) => { const t = tripOn(l.trips, d); return t ? `trip to ${tripCity(t)}` : ''; };
  const trips = upcomingTrips(l.trips);
  const imp = sync?.import ?? null;

  return (
    <ScrollView style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
      <DealsCard listing={l} />
      <Txt v="muted">Tap the days you can’t shoot. Travellers can’t book those days, and days that are fully booked close automatically.</Txt>
      <View style={{ marginTop: space.lg }}>
        <DatePicker testID="avail-cal" value={null} min={today} max={max} multi={blocked} isOff={(d) => full.has(d) || ext.has(d)} onChange={toggle} mark={marks} note={dayNote} />
      </View>
      <View style={s.legend}>
        <View style={s.legendItem}><View style={[s.dot, { backgroundColor: color.errDim, borderColor: 'rgba(164,38,56,0.35)' }]} /><Txt v="small">Day off</Txt></View>
        <View style={s.legendItem}><View style={[s.dot, { backgroundColor: color.sand }]} /><Txt v="small">Crossed out = fully booked</Txt></View>
        <View style={s.legendItem}><View style={[s.dot, { backgroundColor: 'rgba(60,90,140,0.14)' }]} /><Txt v="small">Busy in your calendar</Txt></View>
        <View style={s.legendItem}><View style={[s.dot, { borderBottomWidth: 3, borderBottomColor: color.clay }]} /><Txt v="small">On a trip</Txt></View>
      </View>
      <Card style={{ marginTop: space.lg }}>
        <Txt v="h3" testID="avail-sum">{blocked.size ? `${blocked.size} day${blocked.size > 1 ? 's' : ''} off in the next 12 months` : 'No days off — travellers can book any free day'}</Txt>
        {blocked.size > 0 && <Button title="Clear all days off" kind="ghost" small onPress={() => { setBlocked(new Set()); setDirty(true); }} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />}
      </Card>
      <Card style={{ marginTop: space.md }}>
        <Txt v="h3">Shoots per day</Txt>
        <Txt v="small" style={{ marginTop: 2 }}>When a day has this many bookings, it closes for new ones.</Txt>
        <View style={s.chips}>{[1, 2, 3, 4, 5, 6].map((n) => (
          <View key={n} style={{ marginBottom: space.sm }}><Chip testID={`perday-${n}`} label={String(n)} active={perDay === n} onPress={() => { setPerDay(n); setDirty(true); }} /></View>
        ))}</View>
      </Card>
      <Card style={{ marginTop: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt v="h3">⚡ Instant booking</Txt>
            <Txt v="small" style={{ marginTop: 2 }}>Paid bookings on free days are confirmed automatically — travellers love not waiting. You can still cancel with a full refund if something comes up.</Txt>
          </View>
          <Switch testID="instant-toggle" value={instant} onValueChange={(v) => { setInstant(v); setDirty(true); }} accessibilityLabel={trx("Instant booking")}
            trackColor={{ true: color.clay, false: color.borderStrong }} thumbColor={color.card} />
        </View>
      </Card>
      <Button testID="avail-save" title="Save availability" onPress={save} loading={saving} disabled={!dirty} style={{ marginTop: space.xl }} />
      {dirty ? <Txt v="small" style={{ textAlign: 'center', marginTop: space.sm }}>You have unsaved changes.</Txt> : null}

      <Card style={{ marginTop: space.xl }} testID="trips-card">
        <Txt v="h3">✈️ Trips</Txt>
        <Txt v="small" style={{ marginTop: 2 }}>Going somewhere? Travellers searching that city find you, and bookings on those days take place there. Days at home stay bookable as usual.</Txt>
        <View style={{ marginTop: space.md, gap: space.sm }} testID="tr-list">
          {trips.length ? trips.map((t, i) => (
            <View key={`${t.from}-${t.city}`} style={s.tripRow}>
              <Txt v="body" style={{ flex: 1 }}><Txt v="body" style={{ fontFamily: font.bold }}>{t.city}</Txt> · {tripDates(t)}</Txt>
              <Button testID={`tr-del-${i}`} title="Remove" kind="ghost" small onPress={() => removeTrip(t)} disabled={tripBusy} style={{ paddingHorizontal: 0, minHeight: 36 }} />
            </View>
          )) : <Txt v="small">No trips planned.</Txt>}
        </View>
        <View style={{ marginTop: space.lg }}>
          <Field testID="tr-city" label="City" value={tripCityIn} onChangeText={setTripCityIn} maxLength={80} placeholder={trx("e.g. Lisbon, Portugal")} />
          <Txt v="label" style={{ marginBottom: space.sm }}>First day</Txt>
          <DateField testID="tr-from" value={tripFrom} onChange={(d) => { setTripFrom(d); if (!tripTo || tripTo < d) setTripTo(d); }} min={today} max={max} placeholder={trx("When do you arrive?")} collapsed />
          <Txt v="label" style={{ marginVertical: space.sm }}>Last day</Txt>
          <DateField testID="tr-to" value={tripTo} onChange={setTripTo} min={tripFrom ?? today} max={max} placeholder={trx("When do you leave?")} collapsed />
          <Button testID="tr-add" title="Add trip" kind="secondary" onPress={addTrip} loading={tripBusy} style={{ marginTop: space.md }} />
        </View>
      </Card>

      <Card style={{ marginTop: space.md }} testID="calsync-card">
        <Txt v="h3">📅 Sync your own calendar</Txt>
        {syncUnavailable ? <Txt v="small" style={{ marginTop: 2 }}>Calendar sync needs the latest database update.</Txt> : imp ? (
          <View style={{ marginTop: space.sm }}>
            <Txt v="body" testID="cal-status">{imp.last_error ? '⚠️' : '✅'} Connected to <Txt v="body" style={{ fontFamily: font.bold }}>{imp.host}</Txt> · {syncedAgo(imp.last_synced_at)}</Txt>
            {imp.last_error ? <Txt v="small" style={{ color: color.err, marginTop: 4 }} testID="cal-error">{imp.last_error}</Txt>
              : <Txt v="small" style={{ marginTop: 4 }}>{imp.busy_count} busy day{imp.busy_count === 1 ? '' : 's'} in the next 12 months block bookings. We check your calendar every 3 hours.</Txt>}
            <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md, flexWrap: 'wrap' }}>
              <Button testID="cal-sync" title="Sync now" kind="secondary" small onPress={syncCal} loading={calBusy === 'sync'} />
              <Button testID="cal-off" title="Disconnect" kind="ghost" small onPress={disconnectCal} />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: space.sm }}>
            <Txt v="small">Paste the private iCal link of your Google, Apple (iCloud), Outlook, Proton or Fastmail calendar. All-day events and events of 3 hours or more block that day on CapturaGo — we only read the dates, never the titles.</Txt>
            <Field testID="cal-url" label="Calendar link" value={calUrl} onChangeText={setCalUrl} maxLength={1000} autoCapitalize="none" autoCorrect={false} keyboardType="url"
              placeholder={trx("https://calendar.google.com/calendar/ical/…/basic.ics")} style={{ marginTop: space.md }}
              hint="Google: Settings → your calendar → Integrate calendar → Secret address in iCal format. Apple: Calendar → share → Public Calendar. Outlook: Settings → Shared calendars → Publish." />
            <Button testID="cal-connect" title="Connect" kind="secondary" onPress={connectCal} loading={calBusy === 'connect'} />
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: color.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md },
});
