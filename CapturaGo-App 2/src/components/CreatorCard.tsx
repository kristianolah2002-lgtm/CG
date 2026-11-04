import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { color, font, radius, space } from '../theme';
import { Badge, Txt, TText } from './ui';
import {
  canBook, fromPrice, galleryOf, hasRemote, isBoosted, isFounding, money, plural, PRICE_LABELS, serviceIcon, serviceLabel, type Listing,
} from '../lib/logic';
import { tr as trx } from '../lib/i18n';
import { useDeals } from '../lib/deals';

const FALLBACK = require('../../assets/default-cover.jpg');

/** Cover photo; without one, the first portfolio photo; otherwise the default picture. */
export function coverSource(l: Listing) {
  const url = l.cover_image_url && /^https:\/\//i.test(l.cover_image_url) ? l.cover_image_url : galleryOf(l)[0]?.url;
  return url ? { uri: url } : FALLBACK;
}

export function CreatorCard({ l, reason, onPress }: { l: Listing; reason?: string; onPress: () => void }) {
  const price = fromPrice(l);
  const rating = Number(l.rating ?? 0);
  const deals = useDeals().get(l.id) ?? [];
  return (
    <Pressable testID={`card-${l.id}`} onPress={onPress} accessibilityRole="button"
      accessibilityLabel={trx(`${l.name}, ${l.city}${l.isExample ? ', example profile' : ''}`)}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }]}>
      <View style={s.mat}>
        <Image source={coverSource(l)} placeholder={FALLBACK} style={s.img} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
        <View style={s.tags}>
          {l.isExample && <TText style={s.tag}>Example</TText>}
          {isBoosted(l) && <TText style={[s.tag, s.sponsored]}>Sponsored</TText>}
          {isFounding(l) && <TText style={[s.tag, s.founding]} testID={`founding-${l.id}`}>🏅 Founding</TText>}
          {!l.isExample && deals.length > 0 && <TText style={[s.tag, s.deal]} testID={`deal-${l.id}`}>{`⚡ Last-minute −${Math.max(...deals.map((d) => d.pct))}%`}</TText>}
          {(l.services ?? []).slice(0, 3).map((id) => <TText key={id} style={s.tag}>{serviceIcon(id)} {serviceLabel(id)}</TText>)}
        </View>
      </View>
      <View style={s.body}>
        <Txt v="h2" numberOfLines={1}>{l.name}</Txt>
        <Txt v="muted" numberOfLines={1} style={{ marginTop: 2 }}>
          📍 {l.city}{l.travel_available ? ' · ✈ Travels' : ''}{hasRemote(l.services) ? ' · 🌐 Remote' : ''}
        </Txt>
        {reason ? <View style={s.reason}><Text style={s.reasonText}>✦ {reason}</Text></View> : null}
        {l.description ? <Txt v="muted" numberOfLines={2} style={{ marginTop: space.sm }}>{l.description}</Txt> : null}
        <View style={s.foot}>
          <Txt v="small">{rating > 0 ? `★ ${rating.toFixed(1)} · ${l.reviews_count ?? 0} review${l.reviews_count === 1 ? '' : 's'}` : 'New on CapturaGo'}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Txt v="h3">{price ? `From ${money(price)}` : (PRICE_LABELS[l.price ?? ''] ?? '')}</Txt>
          </View>
        </View>
        {canBook(l) || galleryOf(l).length ? (
          <View style={{ marginTop: space.sm, flexDirection: 'row', flexWrap: 'wrap' }}>
            {canBook(l) ? <Badge label={l.instant_book ? '⚡ Instant book' : 'Book online'} tone="ok" /> : null}
            {galleryOf(l).length ? <Badge label={`📷 ${plural(galleryOf(l).length, 'photo')}`} /> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: color.card, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, marginBottom: space.lg, overflow: 'hidden' },
  mat: { padding: 8, paddingBottom: 0 },
  img: { width: '100%', aspectRatio: 16 / 10, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: color.sand },
  tags: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: 'rgba(33,25,17,0.78)', color: color.inkText, fontFamily: font.body, fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  sponsored: { backgroundColor: 'rgba(255,255,255,0.94)', color: color.text },
  founding: { backgroundColor: '#FBEFD5', color: '#7A4A06' },
  deal: { backgroundColor: '#B04722', color: '#FFFBF5', fontFamily: font.bold },
  body: { padding: space.lg },
  reason: { backgroundColor: color.clayDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: space.sm },
  reasonText: { fontFamily: font.body, fontSize: 13, color: color.clay },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md },
});
