// Full-screen photo viewer: swipe between photos, optional favourite, save, report and slideshow.
// Works the same on iOS, Android and web (paging FlatList inside a Modal).
import React, { useEffect, useRef, useState } from 'react';
import { motionOff, TText } from './ui';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { font } from '../theme';
import { tr as trx } from '../lib/i18n';

export interface ViewerItem { key: string; uri: string; favorite?: boolean }

const SLIDE_MS = 3500;

export function PhotoViewer({ items, start, onClose, onFavorite, onSave, saving, onReport, slideshow, autoplay, caption }: {
  items: ViewerItem[] | null; start: number; onClose: () => void;
  onFavorite?: (index: number, on: boolean) => void; onSave?: (index: number) => void; saving?: boolean;
  /** Shows a ⚑ button (report this photo). */
  onReport?: (index: number) => void;
  /** Shows a play/pause button; `autoplay` starts playing when opened. */
  slideshow?: boolean; autoplay?: boolean;
  caption?: (index: number) => string;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start);
  const [playing, setPlaying] = useState(false);
  const list = useRef<FlatList<ViewerItem>>(null);
  // While we scroll to a photo ourselves (arrow, slideshow), the scroll events on the way would show the old number — ignore them until we arrive.
  const target = useRef<{ i: number; until: number } | null>(null);
  const scrollTo = (n: number, animated: boolean) => { target.current = animated ? { i: n, until: Date.now() + 1000 } : null; list.current?.scrollToIndex({ index: n, animated }); setIndex(n); };
  const visible = !!items && items.length > 0;
  const count = items?.length ?? 0;
  useEffect(() => { if (visible) { setIndex(start); setPlaying(!!autoplay && !!slideshow && count > 1); } }, [visible, start, autoplay, slideshow, count]); // eslint-disable-line react-hooks/set-state-in-effect
  // Slideshow: next photo every 3.5 s; stops at the last one. Without animation when the system asks for reduced motion.
  useEffect(() => {
    if (!playing || !visible) return;
    const t = setTimeout(() => {
      if (index >= count - 1) { setPlaying(false); return; }
      scrollTo(index + 1, !motionOff());
    }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [playing, index, visible, count]);
  if (!visible) return null;
  const cur = items[Math.min(index, items.length - 1)];
  const go = (d: number) => {
    const n = Math.min(Math.max(index + d, 0), items.length - 1);
    if (n !== index) scrollTo(n, true);
  };
  const togglePlay = () => {
    if (!playing && index >= count - 1) scrollTo(0, false);
    setPlaying(!playing);
  };
  const close = () => { setPlaying(false); onClose(); };
  const cap = caption ? caption(index) : '';
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={close} statusBarTranslucent supportedOrientations={['portrait']}>
      <View style={v.wrap} testID="photo-viewer">
        <FlatList
          ref={list}
          data={items}
          keyExtractor={(it) => it.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(start, items.length - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          scrollEventThrottle={32}
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
            const t = target.current;
            if (t) { if (i === t.i || Date.now() > t.until) target.current = null; else return; }
            if (i !== index && i >= 0 && i < items.length) setIndex(i);
          }}
          onScrollBeginDrag={() => { target.current = null; setPlaying(false); }}
          renderItem={({ item }) => (
            <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: item.uri }} style={{ width, height: height - insets.top - insets.bottom - 120 }} contentFit="contain" transition={150} accessibilityIgnoresInvertColors />
            </View>
          )}
        />
        <View style={[v.top, { paddingTop: insets.top + 8 }]}>
          <Text style={v.count} testID="viewer-count">{index + 1} / {items.length}</Text>
          <View style={v.tools}>
            {slideshow && items.length > 1 && (
              <Pressable testID="viewer-play" onPress={togglePlay} style={v.btn} accessibilityRole="button" accessibilityLabel={trx(playing ? 'Pause slideshow' : 'Play slideshow')}>
                <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#FFFBF5" />
              </Pressable>
            )}
            {onReport && (
              <Pressable testID="viewer-report" onPress={() => { setPlaying(false); onReport(index); }} style={v.btn} accessibilityRole="button" accessibilityLabel={trx("Report this photo")}>
                <Ionicons name="flag-outline" size={21} color="#FFFBF5" />
              </Pressable>
            )}
            {onFavorite && (
              <Pressable testID="viewer-fav" onPress={() => onFavorite(index, !cur.favorite)} style={v.btn} accessibilityRole="button" accessibilityLabel={trx(cur.favorite ? 'Remove from favourites' : 'Add to favourites')}>
                <Ionicons name={cur.favorite ? 'heart' : 'heart-outline'} size={24} color={cur.favorite ? '#F28B82' : '#FFFBF5'} />
              </Pressable>
            )}
            {onSave && (
              <Pressable testID="viewer-save" onPress={() => onSave(index)} style={v.btn} accessibilityRole="button" accessibilityLabel={trx("Save or share this photo")} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFFBF5" /> : <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'download-outline'} size={24} color="#FFFBF5" />}
              </Pressable>
            )}
            <Pressable testID="viewer-close" onPress={close} style={v.btn} accessibilityRole="button" accessibilityLabel={trx("Close")}>
              <Ionicons name="close" size={26} color="#FFFBF5" />
            </Pressable>
          </View>
        </View>
        {cap ? <View pointerEvents="none" style={[v.capWrap, { bottom: insets.bottom + 20 }]}><TText style={v.cap} numberOfLines={2} testID="viewer-caption">{cap}</TText></View> : null}
        {Platform.OS === 'web' && items.length > 1 && (
          <>
            {index > 0 && <Pressable testID="viewer-prev" onPress={() => go(-1)} style={[v.nav, { left: 8 }]} accessibilityLabel={trx("Previous photo")}><Ionicons name="chevron-back" size={30} color="#FFFBF5" /></Pressable>}
            {index < items.length - 1 && <Pressable testID="viewer-next" onPress={() => go(1)} style={[v.nav, { right: 8 }]} accessibilityLabel={trx("Next photo")}><Ionicons name="chevron-forward" size={30} color="#FFFBF5" /></Pressable>}
          </>
        )}
      </View>
    </Modal>
  );
}

const v = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#140F0A' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  count: { color: '#FFFBF5', fontFamily: font.bold, fontSize: 14 },
  tools: { flexDirection: 'row', gap: 4 },
  btn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,251,245,0.12)' },
  capWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  cap: { color: '#FFFBF5', fontFamily: font.body, fontSize: 14, textAlign: 'center', backgroundColor: 'rgba(20,15,10,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, overflow: 'hidden' },
  nav: { position: 'absolute', top: '45%', width: 48, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,251,245,0.1)' },
});
