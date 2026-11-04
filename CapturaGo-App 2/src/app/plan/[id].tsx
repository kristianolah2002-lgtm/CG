// Planning a booking: propose a new date, set the meeting point (creator), shot list & references (traveller),
// or report a problem (freezes the payment). Every change goes through the server (booking-action).
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, font, radius, space, TOUCH } from '../../theme';
import { Button, Checkbox, Chip, DateField, Empty, Field, Loading, Txt, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { firstName, isDelivery, isoInDays, slotLabel, TIME_SLOTS, type Booking } from '../../lib/logic';
import {
  briefProblem, canPlan, canPropose, cleanTime, disputeProblem, disputeReasons, isoNice, lines, meetingProblem, otherName,
} from '../../lib/plan-logic';
import { tr as trx } from '../../lib/i18n';

type Mode = 'reschedule' | 'meeting' | 'brief' | 'dispute';
const TITLES: Record<Mode, string> = { reschedule: 'New date', meeting: 'Meeting point', brief: 'Shot list', dispute: 'Report a problem' };

function Radio({ on, label, onPress, testID }: { on: boolean; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[r.opt, on && r.on]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={trx(label)}>
      <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? color.clay : color.dim} />
      <Txt v="body" style={{ flex: 1, fontFamily: on ? font.bold : font.body }}>{label}</Txt>
    </Pressable>
  );
}
const r = StyleSheet.create({
  opt: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.card, marginBottom: space.sm },
  on: { borderColor: color.clay, backgroundColor: color.clayDim },
});

export default function PlanScreen() {
  const { id, mode: rawMode, weather } = useLocalSearchParams<{ id: string; mode: string; weather?: string }>();
  const mode = (['reschedule', 'meeting', 'brief', 'dispute'].includes(String(rawMode)) ? rawMode : 'reschedule') as Mode;
  const { user } = useAuth();
  const toast = useToast();
  const [b, setB] = useState<Booking | null | undefined>(undefined);
  const [busyDays, setBusyDays] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  // reschedule
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState('');
  const [reason, setReason] = useState<'weather' | 'other'>(weather === '1' ? 'weather' : 'other');
  const [msg, setMsg] = useState('');
  // meeting
  const [point, setPoint] = useState('');
  const [time, setTime] = useState('');
  // brief
  const [shots, setShots] = useState('');
  const [refs, setRefs] = useState('');
  const [surprise, setSurprise] = useState(false);
  // dispute
  const [dReason, setDReason] = useState<string>('');

  useEffect(() => {
    api.bookings.list().then(({ data }) => {
      const found = (data ?? []).find((x) => x.id === id) ?? null;
      setB(found);
      if (!found) return;
      setSlot(found.time_slot || '');
      setPoint(found.meeting_point || ''); setTime(found.meeting_time || '');
      setShots((found.shot_list ?? []).join('\n')); setRefs((found.ref_links ?? []).join('\n')); setSurprise(!!found.surprise);
      setDReason(disputeReasons(found)[0][0]);
      if (mode === 'reschedule' && found.photographer_id) api.listings.busyDates(found.photographer_id).then((d) => setBusyDays(new Set(d)));
    });
  }, [id, mode]);

  if (b === undefined || !user) return <Loading />;
  const asCreator = !!b && b.creator_user_id === user.id;
  const allowed = !!b && (
    mode === 'reschedule' ? canPropose(b, user.id)
      : mode === 'meeting' ? canPlan(b) && asCreator
        : mode === 'brief' ? canPlan(b) && b.client_user_id === user.id
          : b.client_user_id === user.id && ['paid', 'confirmed', 'delivered'].includes(b.status));
  if (!b || !allowed) return <Empty title="This can't be changed any more" text="The booking may have moved on. Pull to refresh your bookings." action="Back" onAction={() => router.back()} />;

  const who = otherName(b, asCreator);
  async function send(action: string, extra: Record<string, unknown>, ok: string) {
    setSending(true);
    const { error } = await api.bookings.action(b!.id, action, extra);
    setSending(false);
    if (error) { toast(error.message || 'Something went wrong.', 'error'); return; }
    toast(ok, 'success');
    router.back();
  }

  let body: React.ReactNode;
  if (mode === 'reschedule') {
    const tomorrow = isoInDays(1), max = isoInDays(365);
    body = (
      <>
        <Txt v="muted">{b.package_name} · now <Txt v="h3">{isoNice(b.shoot_date)}</Txt>{b.time_slot ? ` · ${slotLabel(b.time_slot)}` : ''}. {who} has to accept before anything changes — moving the shoot is free.</Txt>
        <View style={{ marginTop: space.lg }} accessibilityRole="radiogroup" accessibilityLabel={trx("Why")}>
          <Radio testID="rs-weather" on={reason === 'weather'} label="🌧 Bad weather forecast" onPress={() => setReason('weather')} />
          <Radio testID="rs-other" on={reason === 'other'} label="Something else" onPress={() => setReason('other')} />
        </View>
        <Txt v="label" style={{ marginTop: space.md, marginBottom: space.sm }}>New date</Txt>
        <DateField testID="rs-date" value={date} onChange={setDate} min={tomorrow} max={max} isOff={(d) => busyDays.has(d) || d === b.shoot_date}
          placeholder={trx("Pick a day — crossed-out days are taken.")} />
        <Txt v="label" style={{ marginTop: space.lg, marginBottom: space.sm }}>Time of day</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {TIME_SLOTS.map(([k, label]) => <View key={k} style={{ marginBottom: space.sm }}><Chip testID={`rs-slot-${k}`} label={label} active={slot === k} onPress={() => setSlot(slot === k ? '' : k)} /></View>)}
        </View>
        <Field testID="rs-msg" label="Message (optional)" value={msg} onChangeText={(v) => setMsg(v.slice(0, 300))} multiline maxLength={300} placeholder={trx("e.g. Heavy rain all day — would Thursday work?")} style={{ marginTop: space.md }} />
        <Button testID="rs-send" title="Send proposal" loading={sending} disabled={!date}
          onPress={() => (date ? send('propose_date', { date, time_slot: slot || undefined, reason, message: msg.trim() }, `Sent ✓ — ${who} can accept or decline it.`) : toast('Pick a day first.', 'error'))} />
      </>
    );
  } else if (mode === 'meeting') {
    body = (
      <>
        <Txt v="muted">{b.package_name} · {isoNice(b.shoot_date)}{b.time_slot ? ` · ${slotLabel(b.time_slot)}` : ''}. {firstName(b.client_name)} gets an email with a map link.</Txt>
        <Field testID="mt-place" label="Meeting point" value={point} onChangeText={(v) => setPoint(v.slice(0, 300))} maxLength={300} placeholder={trx("e.g. Yasaka Shrine, main gate")}
          hint="A landmark or an address works best." style={{ marginTop: space.lg }} />
        <Field testID="mt-time" label="Time (HH:MM)" value={time} onChangeText={(v) => setTime(v.replace(/[^\d:.h]/g, '').slice(0, 5))} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="09:30" />
        <Button testID="mt-save" title={`Save and tell ${firstName(b.client_name)}`} loading={sending} onPress={() => {
          const problem = meetingProblem(point, time);
          if (problem) { toast(problem, 'error'); return; }
          send('set_meeting', { meeting_point: point.trim(), meeting_time: cleanTime(time) ?? '' }, 'Saved ✓ — the traveller has been told.');
        }} />
      </>
    );
  } else if (mode === 'brief') {
    const creator = b.photographers?.name ? firstName(b.photographers.name) : 'your creator';
    body = (
      <>
        <Txt v="muted">Help {creator} plan: the moments you don’t want to miss, and photos you love.</Txt>
        <Field testID="br-shots" label="Must-have shots — one per line, up to 20" value={shots} onChangeText={setShots} multiline
          placeholder={trx('The ring moment\nWide shot with the pagoda\nCandid laughing photos')} style={{ marginTop: space.lg }} inputStyle={{ minHeight: 120 }} />
        <Field testID="br-refs" label="Reference links — one per line, up to 6" value={refs} onChangeText={setRefs} multiline autoCapitalize="none" autoCorrect={false} keyboardType="url"
          placeholder={trx("https://pinterest.com/pin/…")} hint="Pinterest, Instagram or any photo you love." />
        <Checkbox testID="br-surprise" checked={surprise} onChange={setSurprise}
          label={<View><Txt v="h3">🤫 It’s a surprise</Txt><Txt v="small" style={{ marginTop: 2 }}>{creator} is told to keep it secret, and our emails to you have neutral subjects.</Txt></View>} />
        <Button testID="br-save" title="Save" loading={sending} style={{ marginTop: space.md }} onPress={() => {
          const sl = lines(shots), rl = lines(refs);
          const problem = briefProblem(sl, rl);
          if (problem) { toast(problem, 'error'); return; }
          send('set_brief', { shot_list: sl, ref_links: rl, surprise }, 'Saved ✓ — your creator can see it.');
        }} />
      </>
    );
  } else {
    const reasons = disputeReasons(b);
    body = (
      <>
        <Txt v="muted">{b.package_name} · {isoNice(b.shoot_date)}. The payment is <Txt v="h3">frozen</Txt> while our team reviews it — we contact you both by email within 48 hours.</Txt>
        <View style={{ marginTop: space.lg }} accessibilityRole="radiogroup" accessibilityLabel={trx("What happened")}>
          {reasons.map(([k, label]) => <Radio key={k} testID={`dp-${k}`} on={dReason === k} label={label} onPress={() => setDReason(k)} />)}
        </View>
        <Field testID="dp-msg" label={dReason === 'no_show' ? 'What happened? (optional)' : 'What happened?'} value={msg} onChangeText={(v) => setMsg(v.slice(0, 1000))} multiline maxLength={1000}
          placeholder={trx("A few sentences help us decide quickly and fairly.")} style={{ marginTop: space.md }} />
        {dReason === 'no_show' && !isDelivery(b) ? <Txt v="small" style={{ marginBottom: space.md }}>If the creator didn’t come, you get a full refund once we’ve checked it.</Txt> : null}
        <Button testID="dp-send" title="Report and freeze the payment" kind="danger" loading={sending} onPress={() => {
          const problem = disputeProblem(dReason, msg);
          if (problem) { toast(problem, 'error'); return; }
          send('dispute', { reason: dReason, message: msg.trim() }, "Thanks — the payment is on hold and we'll be in touch within 48 hours.");
        }} />
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: TITLES[mode] }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled" testID={`plan-${mode}`}>
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
