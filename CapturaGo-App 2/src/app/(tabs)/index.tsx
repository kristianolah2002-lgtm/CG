import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, font, radius, space } from '../../theme';
import { animateLayout, Button, Card, Chip, ChipRow, DateField, Empty, Loading, Reveal, Txt, useToast } from '../../components/ui';
import { CreatorCard } from '../../components/CreatorCard';
import { api } from '../../lib/api';
import { EXAMPLES } from '../../lib/examples';
import { SHOW_EXAMPLES_BELOW } from '../../lib/config';
import { occasions, services, vibes } from '../../lib/taxonomy-data';
import { canBook, clientFilter, isBoosted, isRemoteSearch, isRemoteService, localMatch, sponsoredFirst, type Listing } from '../../lib/logic';
import { addLocalDays, daySpan, localIso, nextWeekend, searchKey, tripProblem, tripReason, tripWhen } from '../../lib/plan-logic';
import { useAuth } from '../../lib/auth';
import { tripCity, tripDates, tripMatches, upcomingTrips } from '../../lib/trip-logic';
import { tr as trx } from '../../lib/i18n';
import { replyRank } from '../../lib/reply-logic';

type AiState = { matches: { id: string; reason: string }[]; note: string; basic: boolean } | null;
type TripState = { from: string; to: string; city: string; rows: { l: Listing; reason: string; date: string }[] } | null;

/* Search insights: each city/service/result kind is logged once per app session. */
const logged = new Set<string>();
/* "Notify me" pressed while signed out → finished right after signing in (within 15 minutes). */
let pendingAlert: { city: string; service: string; at: number } | null = null;

export default function Explore() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [vibe, setVibe] = useState('');
  const [occasion, setOccasion] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [ai, setAi] = useState<AiState>(null);
  const { user } = useAuth();
  const params = useLocalSearchParams<{ trip?: string }>();
  const [tripOpen, setTripOpen] = useState(false);
  // "Where to next?" from a completed booking opens the trip planner
  const [tripParam, setTripParam] = useState('');
  if ((params.trip ?? '') !== tripParam) { setTripParam(params.trip ?? ''); if (params.trip === '1') setTripOpen(true); }
  const [tripFrom, setTripFrom] = useState<string | null>(null);
  const [tripTo, setTripTo] = useState<string | null>(null);
  const [tripBusy, setTripBusy] = useState(false);
  const [trip, setTrip] = useState<TripState>(null);
  const [alerted, setAlerted] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    const { data, error } = await api.listings.all();
    if (error) { setLoadError(true); } else { setLoadError(false); setAll(data ?? []); }
  }, []);
  // Async: state is only set after the request finishes
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const remote = isRemoteSearch(type);
  const { list, travelling, examples } = useMemo(() => {
    const c = city.trim().toLowerCase();
    // Remote work: the creator's location doesn't matter
    const inCity = !c || remote ? all : all.filter((l) => String(l.city ?? '').toLowerCase().includes(c));
    const real = sponsoredFirst(clientFilter(inCity, { type, vibe, occasion, availableOnly }));
    // Creators on the road: planning a trip to the searched city (after the locals)
    const tomorrowIso = localIso(addLocalDays(new Date(), 1));
    const away = !c || remote ? [] : clientFilter(all.filter((l) => !inCity.includes(l) && upcomingTrips(l.trips).some((t) => tripMatches(t, c))), { type, vibe, occasion, availableOnly })
      .map((l) => { const t = upcomingTrips(l.trips).find((x) => tripMatches(x, c))!; return { l, reason: `✈️ In ${tripCity(t)} ${tripDates(t)}`, date: t.from >= tomorrowIso ? t.from : tomorrowIso }; });
    const showExamples = (!c || remote) && all.length < SHOW_EXAMPLES_BELOW;
    return { list: real, travelling: away, examples: showExamples ? clientFilter(EXAMPLES, { type, vibe, occasion, availableOnly }) : [] };
  }, [all, city, type, vibe, occasion, availableOnly, remote]);

  const aiList = useMemo(() => {
    if (!ai) return null;
    const byId = new Map(all.map((l) => [l.id, l]));
    return ai.matches.filter((m) => byId.has(m.id)).map((m) => ({ l: byId.get(m.id)!, reason: m.reason }));
  }, [ai, all]);

  const serviceId = type && type !== 'remote' ? type : '';
  // Log what people search for (anonymous) — after they stop typing, once per kind of result
  useEffect(() => {
    const c = city.trim();
    if (ai || trip || c.length < 2 || loading) return;
    const n = list.length + travelling.length;
    const key = searchKey(c, serviceId, n);
    if (logged.has(key)) return;
    const t = setTimeout(() => { logged.add(key); api.logEvent('search', c, serviceId, n); }, 1500);
    return () => clearTimeout(t);
  }, [city, serviceId, list.length, travelling.length, ai, trip, loading]);

  // Finish a "Notify me" that started before signing in
  useEffect(() => {
    const a = pendingAlert;
    if (!user || !a) return;
    pendingAlert = null;
    if (Date.now() - a.at > 15 * 60000) return;
    api.alerts.create(a.city, a.service || null).then(({ error }) => {
      if (error) { toast(error.message || 'Could not save your alert.', 'error'); return; }
      setAlerted((cur) => new Set(cur).add(a.city.toLowerCase()));
      toast(`Done — we'll email you once when a creator joins ${a.city}.`, 'success');
    });
  }, [user, toast]);

  async function notifyCity(c: string) {
    const name = c.trim();
    if (name.length < 2) return;
    if (!user) {
      pendingAlert = { city: name, service: serviceId, at: Date.now() };
      toast(`Sign in and we'll email you when a creator joins ${name}.`);
      router.push('/sign-in');
      return;
    }
    const { error } = await api.alerts.create(name, serviceId || null);
    if (error) { toast(error.message || 'Could not save your alert.', 'error'); return; }
    setAlerted((cur) => new Set(cur).add(name.toLowerCase()));
    toast(`Done — we'll email you once when a creator joins ${name}.`, 'success');
  }

  async function runTrip(from: string | null, to: string | null) {
    const problem = tripProblem(from, to);
    if (problem) { toast(problem); return; }
    const end = to && to >= from! ? to : from!;
    setTripFrom(from); setTripTo(end);
    const c = cityInput.trim();
    setTripBusy(true);
    const { data, error } = await api.availableCreators(c, from!, end);
    setTripBusy(false);
    if (error) { toast(error.message || 'Could not check availability. Please try again.', 'error'); return; }
    const span = daySpan(from!, end);
    const byId = new Map(all.map((l) => [l.id, l]));
    const rows = (data ?? []).filter((x) => byId.has(x.photographer_id))
      .map((x) => {
        const l = byId.get(x.photographer_id)!;
        // Free here because of a trip (not their home city)
        const t = c && !tripMatches({ city: String(l.city ?? ''), from: '', to: '' }, c) ? upcomingTrips(l.trips).find((y) => tripMatches(y, c) && y.from <= end && y.to >= from!) : undefined;
        const why = tripReason(span, from!, x);
        return { l, reason: t ? `✈️ In ${tripCity(t)} ${tripDates(t)} · ${why}` : why, date: x.first_free, free: x.free_days };
      })
      .filter((r) => !serviceId || isRemoteService(serviceId) || (r.l.services ?? []).includes(serviceId))
      .sort((a, b) => Number(isBoosted(b.l)) - Number(isBoosted(a.l)) || Number(canBook(b.l)) - Number(canBook(a.l)) || replyRank(b.l) - replyRank(a.l) || b.free - a.free)
      .map(({ l, reason, date }) => ({ l, reason, date }));
    api.logEvent('trip_search', c, serviceId, rows.length);
    animateLayout();
    setAi(null);
    if (c) setCity(c);
    setTrip({ from: from!, to: end, city: c, rows });
  }
  const tomorrow = localIso(addLocalDays(new Date(), 1));
  const yearAhead = localIso(addLocalDays(new Date(), 365));

  const anyFilter = !!(city || type || vibe || occasion || availableOnly);
  const clearFilters = () => { setCity(''); setCityInput(''); setType(''); setVibe(''); setOccasion(''); setAvailableOnly(false); };

  async function runAi() {
    const q = aiQuery.trim();
    if (q.length < 3) { toast('Tell us a little more about your shoot.'); return; }
    setAiBusy(true);
    const { data, error } = await api.ai.match(q);
    setAiBusy(false);
    if (error && (error.status === 429 || error.status === 400)) { toast(error.message, 'error'); return; }
    if (error) setAi({ matches: localMatch(q, all), note: '', basic: true }); // AI unavailable → keyword match
    else setAi({ matches: data?.matches ?? [], note: data?.note ?? '', basic: false });
  }

  const open = (l: Listing, date?: string) => router.push({ pathname: '/creator/[id]', params: { id: l.id, ...(date ? { date } : {}) } });
  const rows: { l: Listing; reason?: string; date?: string }[] = trip ? trip.rows : aiList ?? [...list.map((l) => ({ l })), ...travelling, ...examples.map((l) => ({ l }))];

  const header = (
    <View>
      <View style={{ paddingTop: insets.top + space.lg, marginBottom: space.lg }}>
        <Txt v="label" style={{ color: color.clay }}>✦ CapturaGo</Txt>
        <Txt v="h1" style={{ marginTop: space.sm }}>Find a creator</Txt>
        <Txt v="h1" style={{ fontFamily: font.displayItalic, color: color.clay }}>wherever you’re going.</Txt>
      </View>

      <View style={s.search}>
        <Ionicons name="search" size={20} color={color.dim} />
        <TextInput testID="city-input" value={cityInput} onChangeText={setCityInput} placeholder={trx("Where are you going?")} placeholderTextColor={color.dim}
          accessibilityLabel={trx("City or country")} style={s.searchInput} returnKeyType="search" autoCorrect={false}
          onSubmitEditing={() => { setCity(cityInput.trim()); setAi(null); setTrip(null); }} />
        {cityInput ? (
          <Pressable onPress={() => { setCityInput(''); setCity(''); setTrip(null); }} accessibilityRole="button" accessibilityLabel={trx("Clear city")} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={color.dim} />
          </Pressable>
        ) : null}
      </View>

      <Card style={{ marginTop: space.lg }} testID="trip-box">
        <Pressable testID="trip-toggle" onPress={() => { animateLayout(); setTripOpen(!tripOpen); }} accessibilityRole="button" accessibilityState={{ expanded: tripOpen }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt v="label" style={{ color: color.clay }}>🗓 Trip planner</Txt>
            <Txt v="h3" style={{ marginTop: 4 }}>Who’s free on my dates?</Txt>
          </View>
          <Ionicons name={tripOpen ? 'chevron-up' : 'chevron-down'} size={20} color={color.dim} />
        </Pressable>
        <View style={s.quick}>
          <Chip testID="trip-tomorrow" label="⚡ Free tomorrow" onPress={() => runTrip(tomorrow, tomorrow)} />
          <Chip testID="trip-weekend" label="This weekend" onPress={() => { const w = nextWeekend(); runTrip(w.from, w.to); }} />
          <Chip testID="deals-chip" label="⚡ Last-minute deals" onPress={() => router.push({ pathname: '/deals', params: { city: cityInput.trim() } })} />
        </View>
        {tripOpen && (
          <View testID="trip-form">
            <Txt v="small" style={{ marginTop: space.sm }}>{cityInput.trim() ? `In ${cityInput.trim()} — days off and fully booked days are left out.` : 'Type your city above first, or search everywhere.'}</Txt>
            <View style={s.dates}>
              <Txt v="label">From</Txt>
              <DateField testID="trip-from" value={tripFrom} min={tomorrow} max={yearAhead} placeholder={trx("The day you arrive")}
                onChange={(d) => { setTripFrom(d); if (!tripTo || tripTo < d) setTripTo(d); }} />
              {tripFrom ? (
                <>
                  <Txt v="label" style={{ marginTop: space.sm }}>To</Txt>
                  <DateField key={`to-${tripFrom}`} testID="trip-to" value={tripTo} min={tripFrom} max={yearAhead} placeholder={trx("The day you leave")} onChange={setTripTo} />
                </>
              ) : null}
            </View>
            <Button testID="trip-btn" title={tripBusy ? 'Checking calendars…' : 'Find free creators'} loading={tripBusy} onPress={() => runTrip(tripFrom, tripTo)} />
            <Button testID="trip-request" title="📣 Post a request — creators send you offers" kind="ghost" small style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: space.sm }}
              onPress={() => router.push({ pathname: '/request-new', params: { city: cityInput.trim(), from: tripFrom ?? '', to: tripTo ?? '' } })} />
          </View>
        )}
      </Card>

      {trip && (
        <View style={s.aiStatus} testID="trip-status">
          <View style={{ flex: 1 }}>
            <Txt v="h3">{trip.rows.length ? `🗓 ${trip.rows.length} creator${trip.rows.length > 1 ? 's' : ''} free${trip.city ? ` in ${trip.city}` : ''} · ${tripWhen(trip.from, trip.to)}` : `No one is free${trip.city ? ` in ${trip.city}` : ''} on ${tripWhen(trip.from, trip.to)}`}</Txt>
            <Txt v="muted">{trip.rows.length ? 'Book to lock in your day — the first free day is already picked.' : 'Try other dates or a nearby city.'}</Txt>
            {!trip.rows.length && trip.city ? (
              <Button testID="trip-ask" title="📣 Ask creators for offers" small onPress={() => router.push({ pathname: '/request-new', params: { city: trip.city, from: trip.from, to: trip.to } })} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
            ) : null}
            {!trip.rows.length && trip.city ? (
              <Button testID="trip-notify" title={alerted.has(trip.city.toLowerCase()) ? `✓ We'll email you about ${trip.city}` : `🔔 Notify me about ${trip.city}`} kind="secondary" small
                disabled={alerted.has(trip.city.toLowerCase())} onPress={() => notifyCity(trip.city)} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
            ) : null}
          </View>
          <Button testID="trip-clear" title="Show all" kind="ghost" small onPress={() => { animateLayout(); setTrip(null); }} />
        </View>
      )}

      <Card style={{ marginTop: space.lg }} testID="ai-box">
        <Txt v="label" style={{ color: color.clay }}>✦ AI match</Txt>
        <Txt v="h3" style={{ marginTop: 4 }}>Describe your shoot — we’ll find your creator</Txt>
        <TextInput testID="ai-input" value={aiQuery} onChangeText={setAiQuery} multiline maxLength={500} accessibilityLabel={trx("Describe your shoot")}
          placeholder={trx("e.g. Surprise proposal in Kyoto next April, natural and cinematic")} placeholderTextColor={color.dim} style={s.aiInput} />
        <Button testID="ai-btn" title="Find my match" onPress={() => { setTrip(null); runAi(); }} loading={aiBusy} />
        <Txt v="small" style={{ marginTop: space.sm }}>Processed by our AI provider to rank creators. Please don’t include personal details.</Txt>
      </Card>

      {ai && (
        <View style={s.aiStatus} testID="ai-status">
          <View style={{ flex: 1 }}>
            <Txt v="h3">{aiList!.length ? `✦ ${aiList!.length} best match${aiList!.length > 1 ? 'es' : ''} for you` : 'No creators match that yet'}{ai.basic ? '  · quick match' : ''}</Txt>
            {!aiList!.length && <Txt v="muted">Try a nearby city or a broader style — or browse everyone.</Txt>}
            {ai.note ? <Txt v="muted">{ai.note}</Txt> : null}
          </View>
          <Button testID="ai-clear" title="Show all" kind="ghost" small onPress={() => setAi(null)} />
        </View>
      )}

      {!ai && !trip && (
        <>
          <Reveal delay={80}>
            <Txt v="label" style={s.groupLabel}>Service</Txt>
            <ChipRow testID="row-service" selectedKey={remote ? 'remote' : type || 'all'}>
              {(at) => (
                <>
                  <Chip testID="type-all" label="All creators" active={!type} onPress={() => setType('')} onLayout={at('all')} />
                  {services.filter((x) => x.group === 'onsite').map((x) =>
                    <Chip key={x.id} testID={`type-${x.id}`} label={`${x.icon} ${x.short}`} active={type === x.id} onPress={() => setType(type === x.id ? '' : x.id)} onLayout={at(x.id)} />)}
                  <Chip testID="type-remote" label="🌐 Remote services" active={remote} onPress={() => { animateLayout(); setType(remote ? '' : 'remote'); }} onLayout={at('remote')} />
                </>
              )}
            </ChipRow>
            {remote && (
              <View style={{ marginTop: space.sm }}>
                <ChipRow testID="row-remote" selectedKey={type}>
                  {(at) => services.filter((x) => x.group === 'remote').map((x) =>
                    <Chip key={x.id} testID={`type-${x.id}`} label={`${x.icon} ${x.short}`} active={type === x.id} onPress={() => setType(type === x.id ? 'remote' : x.id)} onLayout={at(x.id)} />)}
                </ChipRow>
              </View>
            )}
          </Reveal>
          <Reveal delay={140}>
            <Txt v="label" style={s.groupLabel}>Occasion</Txt>
            <ChipRow testID="row-occasion" selectedKey={occasion}>
              {(at) => occasions.map((o) => <Chip key={o.id} testID={`occ-${o.id}`} label={`${o.icon} ${o.label}`} active={occasion === o.id} onPress={() => setOccasion(occasion === o.id ? '' : o.id)} onLayout={at(o.id)} />)}
            </ChipRow>
          </Reveal>
          <Reveal delay={200}>
            <Txt v="label" style={s.groupLabel}>Vibe</Txt>
            <ChipRow testID="row-vibe" selectedKey={vibe}>
              {(at) => vibes.map((v) => <Chip key={v.id} testID={`vibe-${v.id}`} label={`${v.icon} ${v.label}`} active={vibe === v.id} onPress={() => setVibe(vibe === v.id ? '' : v.id)} onLayout={at(v.id)} />)}
            </ChipRow>
          </Reveal>
          <View style={s.toggleRow}>
            <Txt v="body">Available now</Txt>
            <Switch testID="available-switch" value={availableOnly} onValueChange={setAvailableOnly} accessibilityLabel={trx("Only show creators available now")}
              trackColor={{ true: color.clay, false: color.borderStrong }} thumbColor={color.card} />
          </View>
          {anyFilter && <Button testID="clear-filters" title="Clear filters" kind="ghost" small onPress={clearFilters} style={{ alignSelf: 'flex-start' }} />}
          {remote && !!city && <Txt v="muted" testID="remote-notice" style={s.notice}>🌐 Remote creators work online from anywhere, so we show all of them, wherever they live.</Txt>}
          {loadError && (
            <Card style={{ marginBottom: space.lg, borderColor: 'rgba(164,38,56,0.3)' }} testID="load-error">
              <Txt v="h3">Couldn’t load creators</Txt>
              <Txt v="muted">Check your connection and try again.</Txt>
              <Button title="Try again" kind="secondary" small onPress={() => { setLoading(true); load().finally(() => setLoading(false)); }} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />
            </Card>
          )}
          {examples.length > 0 && (
            <Txt v="muted" testID="example-notice" style={s.notice}>We’re just launching. Profiles marked “Example” show how CapturaGo works — they aren’t real creators and can’t be booked.</Txt>
          )}
        </>
      )}
      <View style={{ height: space.md }} />
    </View>
  );

  if (loading) return <View style={{ flex: 1, backgroundColor: color.canvas }}>{<Loading />}</View>;

  return (
    <FlatList
      testID="explore-list"
      style={{ backgroundColor: color.canvas }}
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
      data={rows}
      keyExtractor={(r) => r.l.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => <CreatorCard l={item.l} reason={item.reason} onPress={() => open(item.l, item.date)} />}
      ListEmptyComponent={ai || trip ? null : city && !remote ? (
        <Empty testID="empty" title={`No creators in ${city} yet`} text="Try fewer filters or a nearby city — or we'll email you once when a creator joins."
          action={alerted.has(city.toLowerCase()) ? undefined : `🔔 Notify me about ${city}`} onAction={() => notifyCity(city)} />
      ) : (
        <Empty testID="empty" title="No creators match yet" text={anyFilter ? 'Try fewer filters or a nearby city.' : 'Be the first creator here — list yourself free on capturago.com.'}
          action={anyFilter ? 'Clear filters' : undefined} onAction={clearFilters} />
      )}
      ListFooterComponent={!ai && !trip && city && !remote && rows.length === 0 && alerted.has(city.toLowerCase())
        ? <Txt v="small" testID="notify-done" style={{ textAlign: 'center' }}>✓ We’ll email you when a creator joins {city}.</Txt> : null}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={color.clay} />}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.card, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, minHeight: 52 },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 16, color: color.text, paddingVertical: 12 },
  aiInput: { marginVertical: space.md, minHeight: 72, borderRadius: radius.sm, backgroundColor: color.input, borderWidth: 1, borderColor: color.border, padding: space.md, fontFamily: font.body, fontSize: 15, color: color.text, textAlignVertical: 'top' },
  aiStatus: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.sand, borderRadius: radius.md, padding: space.md, marginTop: space.lg },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  dates: { gap: 6, marginTop: space.md, marginBottom: space.md },
  groupLabel: { marginTop: space.lg, marginBottom: space.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, minHeight: 48 },
  notice: { backgroundColor: color.sand, borderRadius: radius.sm, padding: space.md, marginVertical: space.sm },
});
