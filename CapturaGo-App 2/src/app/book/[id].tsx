import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { color, font, space } from '../../theme';
import { animateLayout, Button, Card, Checkbox, Chip, DateField, Empty, Field, Loading, Txt, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { goToTab } from '../../lib/nav';
import { CLIENT_FEE_PCT } from '../../lib/config';
import { getRef } from '../../lib/ref';
import { packageFacts } from '../../lib/trust-logic';
import { tripCity, tripDates, tripOn, upcomingTrips } from '../../lib/trip-logic';
import { giftCodeNorm, giftCover, splitDateOk, splitShares } from '../../lib/gift-logic';
import { dealCents, dealDay } from '../../lib/deal-logic';
import { useDeals } from '../../lib/deals';
import { canBook, euroCents, feePctFor, fees, firstName, fmtDate, httpsUrl, isIsoDate, isoInDays, packagesOf, pkgMeta, plural, TIME_SLOTS, type Listing } from '../../lib/logic';
import { tr as trx } from '../../lib/i18n';

export default function BookScreen() {
  const { id, pkg, date: tripDate, gift: giftParam } = useLocalSearchParams<{ id: string; pkg: string; date?: string; gift?: string }>();
  const { user, ready } = useAuth();
  const toast = useToast();
  const [l, setL] = useState<Listing | null | undefined>(undefined);
  // From the trip planner: the creator's first free day on your dates (checked again below and by the server)
  const [date, setDate] = useState<string | null>(() => {
    const d = String(tripDate ?? '');
    return isIsoDate(d) && d >= isoInDays(1) && d <= isoInDays(365) ? d : null;
  });
  const [surprise, setSurprise] = useState(false);
  const [faq, setFaq] = useState(false);
  const [note, setNote] = useState('');
  const [files, setFiles] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [slot, setSlot] = useState('');
  const [busyDays, setBusyDays] = useState<Set<string>>(() => new Set());
  const [refId, setRefId] = useState<string | null>(null);
  // Pay with a gift card, or split the cost with friends (one or the other — the server checks the same)
  // From the deals screen: the gift card the traveller checked there is filled in and applied (checked again here and by the server)
  const giftFromDeals = giftCodeNorm(String(giftParam ?? ''));
  const [payOpt, setPayOpt] = useState<'' | 'gift' | 'split'>(giftFromDeals ? 'gift' : '');
  const [giftInput, setGiftInput] = useState(giftFromDeals);
  const [gift, setGift] = useState<{ code: string; balance: number } | null>(null);
  const [giftMsg, setGiftMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const [split, setSplit] = useState(1);
  const dealMap = useDeals();

  useEffect(() => {
    const pid = String(id ?? '');
    api.listings.byId(pid).then(({ data }) => { setL(data ?? null); if (data && !data.isExample) api.logEvent('book_start', data.city); });
    api.listings.busyDates(pid).then((d) => {
      setBusyDays(new Set(d));
      setDate((cur) => (cur && d.includes(cur) ? null : cur)); // taken meanwhile → choose again
    });
    getRef().then(setRefId);
  }, [id]);
  useEffect(() => {
    if (!giftFromDeals || !user) return;
    let live = true;
    api.gifts.check(giftFromDeals).then(({ data, error }) => {
      if (!live) return;
      if (error || !data?.ok) { setGiftMsg({ text: data?.error || error?.message || 'Could not check the code. Please try again.', bad: true }); return; }
      const balance = Number(data.balance_cents) || 0;
      setGift({ code: giftFromDeals, balance });
      setGiftMsg({ text: `✓ ${euroCents(balance)} on this card.`, bad: false });
    });
    return () => { live = false; };
  }, [giftFromDeals, user]);

  if (!ready || l === undefined) return <Loading />;
  if (!user) return <Empty title="Sign in to book" text="It takes 30 seconds." action="Sign in" onAction={() => router.push('/sign-in')} />;
  const k = l ? packagesOf(l).find((p) => String(p.id) === String(pkg)) : undefined;
  if (!l || !k || !canBook(l)) return <Empty title="This package is no longer available" text="The creator may have changed their packages." action="Back" onAction={() => router.back()} />;
  if (l.user_id === user.id) return <Empty title="That's your own listing 🙂" action="Back" onAction={() => router.back()} />;

  const remote = k.type === 'delivery';
  const who = firstName(l.name);
  const viaLink = refId === l.id;
  const feePct = feePctFor(viaLink);
  const base = fees(Number(k.price_eur), feePct);
  // Last-minute deal on the chosen day (in-person packages only; the server applies the same)
  const deals = remote ? [] : dealMap.get(l.id) ?? [];
  const deal = date ? deals.find((d) => d.day === date) : undefined;
  const priceCents = deal ? dealCents(Number(k.price_eur), deal.pct) : base.priceCents;
  const feeCents = deal ? Math.round((priceCents * feePct) / 100) : base.feeCents;
  const totalCents = priceCents + feeCents;
  const tomorrow = isoInDays(1), maxDate = isoInDays(365);
  const days = Number(k.delivery_days) || 0, revisions = Number(k.revisions) || 0;
  const promised = !remote && Number(k.edit_days) >= 1 && Number(k.edit_days) <= 60;
  const trips = remote ? [] : upcomingTrips(l.trips).filter((t) => t.to >= tomorrow && t.from <= maxDate);
  const away = date && !remote ? tripOn(trips, date) : null;   // where the shoot is: the trip city on trip days

  const giftUsed = gift ? giftCover(totalCents, gift.balance) : 0;
  const myShare = split > 1 ? splitShares(totalCents, split)[0] : 0;
  const payLabel = giftUsed >= totalCents && giftUsed > 0 ? 'Book with my gift card' : split > 1 ? `Pay my share — ${euroCents(myShare)}` : 'Continue to secure payment';

  async function applyGift() {
    if (gift) { setGift(null); setGiftInput(''); setGiftMsg(null); return; }
    if (split > 1) { setGiftMsg({ text: "A gift card can't be combined with splitting the cost.", bad: true }); return; }
    const code = giftCodeNorm(giftInput);
    if (!code) { setGiftMsg({ text: 'Enter the code from your gift card (CG-XXXX-XXXX-XXXX-XXXX).', bad: true }); return; }
    setGiftBusy(true);
    const { data, error } = await api.gifts.check(code);
    setGiftBusy(false);
    if (error || !data?.ok) { setGiftMsg({ text: data?.error || error?.message || 'Could not check the code. Please try again.', bad: true }); return; }
    const balance = Number(data.balance_cents) || 0, used = giftCover(totalCents, balance);
    setGift({ code, balance }); setGiftInput(code);
    setGiftMsg({ text: `✓ ${euroCents(balance)} on this card — ${euroCents(used)} is used for this booking${balance > used ? `, ${euroCents(balance - used)} stays on it` : ''}.`, bad: false });
  }

  async function pay() {
    const e: Record<string, string> = {};
    const payload: Record<string, unknown> = { photographer_id: l!.id, package_id: k!.id, note: note.trim(), ...(viaLink ? { ref: l!.id } : {}) };
    if (remote) {
      if (files.trim() && !httpsUrl(files)) e.files = 'The link to your files must start with https://';
      if (note.trim().length < 10) e.note = `Tell ${who} what you need (at least a sentence).`;
      payload.files_url = files.trim();
    } else {
      if (!date) e.date = 'Choose a date for your shoot.';
      else if (date < tomorrow || date > maxDate) e.date = 'Choose a date between tomorrow and one year ahead.';
      else if (busyDays.has(date)) e.date = `${who} isn't available on that day. Please choose another date.`;
      payload.shoot_date = date;
      if (slot) payload.time_slot = slot;
      if (surprise) payload.surprise = true;
      if (split > 1) {
        if (date && !splitDateOk(date)) e.date = 'To split the cost, choose a shoot date at least 3 days away — your friends need time to pay.';
        payload.split = split;
      }
    }
    if (gift) payload.gift_code = gift.code;
    setErrors(e);
    if (Object.keys(e).length) { toast(Object.values(e)[0], 'error'); return; }
    setBusy(true);
    const { data, error } = await api.pay.checkout(payload);
    setBusy(false);
    if (error || !data?.url) { toast(error?.message || 'Could not start the payment. Please try again.', 'error'); return; }
    if (data.paid) { toast('Booked with your gift card 🎉', 'success'); goToTab('/bookings'); return; }   // nothing left to pay by card
    await WebBrowser.openBrowserAsync(data.url);
    toast('Your booking status is in Bookings.');
    goToTab('/bookings');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Txt v="h1">Book {who}</Txt>
        <Txt v="muted" testID="bk-place" style={{ marginTop: 4 }}>{away ? `✈️ ${away.city} — on ${who}’s trip` : `📍 ${l.city}${remote ? ' · works remotely' : ''}`}</Txt>
        <Card style={{ marginVertical: space.lg, backgroundColor: color.sand }}>
          <Txt v="h3">{k.name}</Txt>
          <Txt v="small">{pkgMeta(k)}</Txt>
        </Card>

        {remote ? (
          <>
            <Txt v="muted" testID="due-note" style={{ marginBottom: space.lg }}>🌐 Delivered by <Txt v="h3">{fmtDate(isoInDays(days))}</Txt>{revisions ? ` · ${plural(revisions, 'revision')} included` : ''}</Txt>
            <Field testID="bk-files" label="Link to your files" value={files} onChangeText={(v) => { setFiles(v); setErrors((x) => ({ ...x, files: '' })); }} keyboardType="url" autoCapitalize="none" autoCorrect={false}
              placeholder={trx("https://drive.google.com/…")} error={errors.files} hint={`Google Drive, Dropbox or WeTransfer link to the footage or photos ${who} should work on. You can also send it later.`} />
            <Field testID="bk-note" label="What do you need? *" value={note} onChangeText={(v) => { setNote(v); setErrors((x) => ({ ...x, note: '' })); }} multiline maxLength={1000}
              placeholder={trx("Format (9:16 / 16:9), length, music, style references…")} error={errors.note} />
          </>
        ) : (
          <>
            <Txt v="label">Shoot date *</Txt>
            <View style={{ marginTop: space.sm, marginBottom: space.lg }}>
              <DateField testID="bk-date" value={date} onChange={(d) => { setDate(d); setErrors((x) => ({ ...x, date: '' })); }} min={tomorrow} max={maxDate}
                isOff={(d) => busyDays.has(d)} placeholder={trx(busyDays.size ? 'Pick the day of your shoot — crossed-out days are taken' : 'Pick the day of your shoot')}
                mark={(d) => [...(tripOn(trips, d) ? ['trip' as const] : []), ...(deals.some((x) => x.day === d) ? ['deal' as const] : [])]}
                note={(d) => { const t = tripOn(trips, d), x = deals.find((y) => y.day === d); return [t ? `in ${tripCity(t)}` : '', x ? `last-minute −${x.pct}%` : ''].filter(Boolean).join(', '); }} />
              {deals.length > 0 ? <Txt v="small" testID="deal-note" style={{ color: color.clay, fontFamily: font.bold, marginTop: 4 }}>⚡ {deals.map((x) => { const w = dealDay(x.day); return `${w.charAt(0).toUpperCase()}${w.slice(1)}: −${x.pct}% last-minute price`; }).join(' · ')}</Txt> : null}
              {trips.length ? <Txt v="small" testID="bk-trips" style={{ marginTop: 6, color: color.text }}>✈️ {trips.slice(0, 3).map((t) => `${who} is in ${tripCity(t)} ${tripDates(t)}`).join(' · ')} — shoots on those days take place there.</Txt> : null}
              {errors.date ? <Txt v="small" style={{ color: color.err, marginTop: 4 }}>{errors.date}</Txt> : null}
              {l.instant_book ? <Txt v="small" testID="instant-note" style={{ marginTop: 6 }}>⚡ Instant booking — your shoot is confirmed as soon as you pay.</Txt> : null}
            </View>
            <Txt v="label">Time of day</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm, marginBottom: space.lg }} testID="bk-slots">
              {TIME_SLOTS.map(([key, label]) => (
                <View key={key} style={{ marginBottom: space.sm }}>
                  <Chip testID={`slot-${key}`} label={label} active={slot === key} onPress={() => setSlot(slot === key ? '' : key)} />
                </View>
              ))}
            </View>
            <Field testID="bk-note" label={`Note for ${who}`} value={note} onChangeText={setNote} multiline maxLength={1000} placeholder={trx("Time of day, number of people, spots you'd love…")} />
            <View style={{ marginBottom: space.lg }}>
              <Checkbox testID="bk-surprise" checked={surprise} onChange={setSurprise}
                label={<View><Txt v="h3">🤫 It’s a surprise <Txt v="muted">(e.g. a proposal)</Txt></Txt><Txt v="small" style={{ marginTop: 2 }}>{who} is told to keep it secret, and our emails to you won’t mention the shoot in the subject.</Txt></View>} />
            </View>
          </>
        )}

        <Card testID="pay-gift" style={{ marginBottom: space.sm, paddingVertical: space.md, opacity: split > 1 ? 0.55 : 1 }}>
          <Pressable testID="pay-gift-toggle" onPress={() => { animateLayout(); setPayOpt(payOpt === 'gift' ? '' : 'gift'); }} accessibilityRole="button" accessibilityState={{ expanded: payOpt === 'gift' }} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}>
            <Txt v="h3" style={{ flex: 1 }}>🎁 Pay with a gift card</Txt><Txt v="h3">{payOpt === 'gift' || gift ? '−' : '+'}</Txt>
          </Pressable>
          {(payOpt === 'gift' || gift) && (
            <View style={{ marginTop: space.sm }}>
              <Field testID="gift-code" label="Gift card code" value={giftInput} onChangeText={(v) => { setGiftInput(v); setGiftMsg(null); }} editable={!gift} autoCapitalize="characters" autoCorrect={false}
                placeholder={trx("CG-XXXX-XXXX-XXXX-XXXX")} maxLength={30} style={{ marginBottom: space.sm }} onSubmitEditing={applyGift} />
              <Button testID="gift-apply" title={gift ? 'Remove gift card' : 'Apply gift card'} kind="secondary" small onPress={applyGift} loading={giftBusy} style={{ alignSelf: 'flex-start' }} />
              {giftMsg ? <Txt v="small" testID="gift-msg" style={{ marginTop: 6, color: giftMsg.bad ? color.err : color.ok }}>{giftMsg.text}</Txt> : null}
            </View>
          )}
        </Card>
        {!remote && (
          <Card testID="pay-split" style={{ marginBottom: space.lg, paddingVertical: space.md, opacity: gift ? 0.55 : 1 }}>
            <Pressable testID="pay-split-toggle" onPress={() => { animateLayout(); setPayOpt(payOpt === 'split' ? '' : 'split'); }} accessibilityRole="button" accessibilityState={{ expanded: payOpt === 'split' }} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}>
              <Txt v="h3" style={{ flex: 1 }}>👯 Split the cost with friends</Txt><Txt v="h3">{payOpt === 'split' || split > 1 ? '−' : '+'}</Txt>
            </Pressable>
            {(payOpt === 'split' || split > 1) && (
              <View style={{ marginTop: space.sm }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }} testID="split-chips">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <View key={n} style={{ marginBottom: space.sm }}>
                      <Chip testID={`split-${n}`} label={n === 1 ? 'Just me' : String(n)} active={split === n}
                        onPress={() => { if (gift) { toast("Remove the gift card first — it can't be combined with splitting the cost.", 'info'); return; } setSplit(n); }} />
                    </View>
                  ))}
                </View>
                <Txt v="small">You pay your share now and get a payment link for each friend. Everyone has 48 hours to pay — if someone doesn’t, everyone is refunded automatically. For shoots at least 3 days away.</Txt>
              </View>
            )}
          </Card>
        )}
        <Card testID="price-breakdown">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="muted">Package</Txt><Txt v="muted">{euroCents(base.priceCents)}</Txt></View>
          {deal ? <View testID="deal-line" style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}><Txt v="muted" style={{ color: color.clay, fontFamily: font.bold }}>{`⚡ Last-minute (−${deal.pct}%)`}</Txt><Txt v="muted" style={{ color: color.clay, fontFamily: font.bold }}>−{euroCents(base.priceCents - priceCents)}</Txt></View> : null}
          {feeCents > 0 && <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}><Txt v="muted">Service fee ({feePct}%)</Txt><Txt v="muted">{euroCents(feeCents)}</Txt></View>}
          {viaLink && feePct < CLIENT_FEE_PCT ? <Txt v="small" testID="link-fee" style={{ color: color.ok, marginTop: 2 }}>Reduced fee — you came through {who}’s own link</Txt> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.border }}>
            <Txt v="h3">Total</Txt><Txt v="h3">{euroCents(totalCents)}</Txt>
          </View>
          {giftUsed > 0 && <View testID="gift-line" style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}><Txt v="muted" style={{ color: color.ok }}>Gift card</Txt><Txt v="muted" style={{ color: color.ok }}>−{euroCents(giftUsed)}</Txt></View>}
          {(giftUsed > 0 || split > 1) && (
            <View testID="pay-now" style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Txt v="h3" style={{ color: color.clay }}>{split > 1 ? `Your share (1 of ${split})` : 'To pay now'}</Txt>
              <Txt v="h3" style={{ color: color.clay }}>{euroCents(split > 1 ? myShare : totalCents - giftUsed)}</Txt>
            </View>
          )}
        </Card>
        <View style={{ marginVertical: space.lg, gap: 6 }}>
          {(remote
            ? ['🔒 Payment held safely until you approve the delivery', ...(revisions ? [`✏️ ${plural(revisions, 'revision')} included`] : []), "⏰ Full refund if it isn't delivered on time"]
            : [`🔒 Payment held safely until ${promised ? 'your photos arrive' : 'your shoot is done'}`, '📸 Photos delivered to your private CapturaGo gallery', "↩ Full refund if the creator declines or hasn't confirmed yet", '📅 Free cancellation up to 7 days before a confirmed shoot']
          ).map((t) => <Txt key={t} v="muted">{t}</Txt>)}
        </View>
        {packageFacts(k).length > 0 && (
          <Card style={{ marginBottom: space.lg }} testID="bk-included">
            <Txt v="h3">What’s included</Txt>
            {packageFacts(k).map((f) => <Txt key={f} v="body" style={{ marginTop: 2 }}>{f}</Txt>)}
          </Card>
        )}
        <Card style={{ marginBottom: space.lg, paddingVertical: space.md }} testID="bk-faq">
          <Pressable testID="bk-faq-toggle" onPress={() => { animateLayout(); setFaq(!faq); }} accessibilityRole="button" accessibilityState={{ expanded: faq }} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}>
            <Txt v="h3" style={{ flex: 1 }}>What happens if…?</Txt>
            <Txt v="h3">{faq ? '−' : '+'}</Txt>
          </Pressable>
          {faq && (remote ? [
            ['…it’s late?', 'If it isn’t delivered by the due date, you can cancel for a full refund.'],
            ['…I don’t like it?', 'Ask for the included revisions. If it isn’t what you agreed, report a problem — the payment stays frozen until we’ve checked it.'],
          ] : [
            ['…it rains?', 'Either of you can propose a new date. It’s free if you both agree; if no date works, the creator cancels and you get a full refund.'],
            ['…I need to cancel?', 'Free up to 7 days before a confirmed shoot (full refund, including the service fee).'],
            ['…the creator doesn’t show up?', 'Report it from your bookings — after our check you get a full refund.'],
            ...(promised ? [['…the photos are late?', 'Your payment stays on hold until they arrive. If they’re late, report it from your bookings and we’ll step in.']] : []),
            ['…I’m shy in front of a camera?', `Most travellers are! Tell ${who} in a message — they’ll guide you through the poses.`],
          ]).map(([q, a]) => <Txt key={q} v="small" style={{ marginTop: space.sm }}><Txt v="small" style={{ fontFamily: font.bold, color: color.text }}>{q} </Txt>{a}</Txt>)}
        </Card>
        <Button testID="bk-pay" title={payLabel} onPress={pay} loading={busy} />
        <Txt v="small" style={{ textAlign: 'center', marginTop: space.sm }}>Payments are processed by Stripe on a secure page.</Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
