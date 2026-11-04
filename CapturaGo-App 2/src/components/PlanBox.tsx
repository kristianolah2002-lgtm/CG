// Booking card extras (in-person sessions): a proposed new date to answer, and the shoot plan —
// meeting point, shot list, references, surprise note and the weather forecast for the day.
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { color, font, radius, space } from '../theme';
import { Button, Txt, TText } from './ui';
import { api } from '../lib/api';
import { daysUntil, httpsUrl, type Booking } from '../lib/logic';
import { bestMeetTime, canPlan, forecastLine, isoNice, mapsLink, offerWeatherMove, otherName, planTitle, proposalOf, sunLine, type Forecast } from '../lib/plan-logic';
import { tr as trx } from '../lib/i18n';

export function ProposalBox({ b, userId, asCreator, busy, onAnswer }: {
  b: Booking; userId: string; asCreator: boolean; busy: boolean;
  onAnswer: (action: 'accept_date' | 'decline_date' | 'withdraw_date') => void;
}) {
  const p = proposalOf(b, userId);
  if (p.kind === 'none') return null;
  const who = otherName(b, asCreator);
  const why = p.weather ? ' because of the weather' : '';
  if (p.kind === 'mine') {
    return (
      <View style={[s.prop, s.propMine]} testID={`proposal-${b.id}`}>
        <Txt v="body">📅 You proposed moving the shoot to <Txt v="h3">{p.when}</Txt>{why}. Waiting for {who}.</Txt>
        <Button testID={`prop-withdraw-${b.id}`} title="Withdraw" kind="ghost" small disabled={busy} onPress={() => onAnswer('withdraw_date')} style={s.inlineBtn} />
      </View>
    );
  }
  return (
    <View style={s.prop} testID={`proposal-${b.id}`}>
      <Txt v="body">📅 <Txt v="h3">{who}</Txt> proposes moving the shoot to <Txt v="h3">{p.when}</Txt>{why}.</Txt>
      <View style={s.row}>
        <Button testID={`prop-accept-${b.id}`} title="Accept new date" small loading={busy} onPress={() => onAnswer('accept_date')} />
        <Button testID={`prop-decline-${b.id}`} title={`Keep ${isoNice(b.shoot_date)}`} kind="secondary" small disabled={busy} onPress={() => onAnswer('decline_date')} />
      </View>
    </View>
  );
}

export function PlanBox({ b, userId, asCreator, onWeatherMove }: { b: Booking; userId: string; asCreator: boolean; onWeatherMove: () => void }) {
  const [w, setW] = useState<Forecast | null | undefined>(undefined);
  const coords = b.shoot_city ? (b.shoot_coords ?? null) : (b.photographers?.coords ?? null);   // a trip: the trip city's weather (or none)
  const d = daysUntil(b.shoot_date);
  const wantsWeather = canPlan(b) && d >= 0 && d <= 15 && !!coords;
  useEffect(() => {
    if (!wantsWeather) return;
    let alive = true;
    api.forecast(coords, b.shoot_date).then((v) => { if (alive) setW(v); });
    return () => { alive = false; };
  }, [wantsWeather, coords?.lat, coords?.lon, b.shoot_date]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!canPlan(b)) return null;

  const shots = Array.isArray(b.shot_list) ? b.shot_list : [];
  const refs = (Array.isArray(b.ref_links) ? b.ref_links : []).map((u) => httpsUrl(u)).filter((u): u is string => !!u);
  const soon = d >= 0 && d <= 1;
  return (
    <View style={[s.plan, soon && s.planSoon]} testID={`plan-${b.id}`}>
      <TText style={s.title}>{planTitle(b)}</TText>
      {b.meeting_point || b.meeting_time ? (
        <Txt v="body" style={s.lineText} testID={`plan-meet-${b.id}`}>
          📍 {b.meeting_point ? (
            <Text style={s.link} onPress={() => Linking.openURL(mapsLink(b.meeting_point!))} accessibilityRole="link" accessibilityHint={trx("Opens the map")}>{b.meeting_point}</Text>
          ) : 'Meeting point not set yet'}
          {b.meeting_time ? ` · 🕒 ${b.meeting_time}` : ''}
        </Txt>
      ) : (
        <Txt v="muted" style={s.lineText}>📍 {asCreator ? 'Share where and when to meet — the traveller gets an email with a map link.' : `${otherName(b, asCreator)} will share the meeting point here.`}</Txt>
      )}
      {shots.length > 0 && <Txt v="body" style={s.lineText} testID={`plan-shots-${b.id}`}>📝 <Txt v="h3">Shot list:</Txt> {shots.join(' · ')}</Txt>}
      {refs.length > 0 && (
        <Txt v="body" style={s.lineText}>
          🔗 <Txt v="h3">References: </Txt>
          {refs.map((u, i) => (
            <Text key={u}>{i > 0 ? ' · ' : ''}<Text style={s.link} onPress={() => WebBrowser.openBrowserAsync(u)} accessibilityRole="link">{trx(`Link ${i + 1}`)}</Text></Text>
          ))}
        </Txt>
      )}
      {asCreator && b.surprise ? <Txt v="body" style={s.lineText}>🤫 <Txt v="h3">Surprise:</Txt> the other person doesn’t know — don’t contact or tag them before the moment.</Txt> : null}
      {wantsWeather && w === undefined ? <Txt v="small" style={s.lineText}>🌤 Checking the forecast…</Txt> : null}
      {w ? (
        <View style={[s.wx, w.bad && s.wxBad]} testID={`plan-weather-${b.id}`}>
          <Txt v="body" style={{ fontFamily: font.bold }}>{forecastLine(w)}</Txt>
          {sunLine(w, b.time_slot) ? <Txt v="small" testID={`plan-sun-${b.id}`} style={{ marginTop: 2, color: color.text }}>{sunLine(w, b.time_slot)}</Txt> : null}
          {asCreator && !b.meeting_time && bestMeetTime(w, b.time_slot) ? (
            <Txt v="small" testID={`plan-meet-tip-${b.id}`} style={{ marginTop: 2 }}>{`💡 For the best light, meet at ${bestMeetTime(w, b.time_slot)}.`}</Txt>
          ) : null}
          {offerWeatherMove(b, userId, w) ? (
            <Txt v="small" style={{ marginTop: 2 }}>
              {trx('Bad weather?')} <Text testID={`wx-move-${b.id}`} style={[s.link, { fontSize: 13 }]} onPress={onWeatherMove} accessibilityRole="button">{trx('Propose a new date')}</Text>{trx(' — free, if you both agree.')}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  prop: { marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.clayDim, borderWidth: 1, borderColor: 'rgba(176,71,34,0.25)' },
  propMine: { backgroundColor: color.sand, borderColor: color.border },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  inlineBtn: { alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 36 },
  plan: { marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.sand, gap: 6 },
  planSoon: { backgroundColor: '#FBF1EA', borderWidth: 1, borderColor: 'rgba(176,71,34,0.35)' },
  title: { fontFamily: font.bold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: color.clay },
  lineText: { lineHeight: 21 },
  link: { fontFamily: font.bold, fontSize: 15, color: color.clay, textDecorationLine: 'underline' },
  wx: { marginTop: 2, padding: space.sm, borderRadius: radius.sm, backgroundColor: color.card },
  wxBad: { backgroundColor: color.errDim },
});
