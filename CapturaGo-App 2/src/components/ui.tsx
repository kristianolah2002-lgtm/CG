import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Alert, Animated, Easing, FlatList, LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type LayoutChangeEvent, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space, TOUCH } from '../theme';
import { tr, trChildren } from '../lib/i18n';

/* ── Text ── */
type TxtVariant = 'h1' | 'h2' | 'h3' | 'body' | 'muted' | 'small' | 'label' | 'link';
const txt = StyleSheet.create({
  h1: { fontFamily: font.display, fontSize: 30, lineHeight: 36, color: color.text },
  h2: { fontFamily: font.display, fontSize: 22, lineHeight: 28, color: color.text },
  h3: { fontFamily: font.bold, fontSize: 16, lineHeight: 22, color: color.text },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: color.text },
  muted: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: color.muted },
  small: { fontFamily: font.body, fontSize: 12, lineHeight: 17, color: color.dim },
  label: { fontFamily: font.bold, fontSize: 11, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase', color: color.muted },
  link: { fontFamily: font.bold, fontSize: 14, lineHeight: 20, color: color.clay, textDecorationLine: 'underline' },
});
/** Text in the app's style. Interface text is translated (i18n); pass raw for text people wrote (names, messages…). */
export function Txt({ v = 'body', style, children, raw, ...rest }: { v?: TxtVariant; style?: StyleProp<TextStyle>; children: React.ReactNode; raw?: boolean } & React.ComponentProps<typeof Text>) {
  return <Text {...rest} style={[txt[v], style]}>{raw ? children : trChildren(children) as React.ReactNode}</Text>;
}

/** Plain text (no typography preset) in the chosen language — for small labels styled by their screen. */
export function TText({ children, ...rest }: React.ComponentProps<typeof Text>) {
  return <Text {...rest}>{trChildren(children) as React.ReactNode}</Text>;
}

/* ── Button ── */
type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost';
export function Button({ title, onPress, kind = 'primary', loading, disabled, style, testID, small, accessibilityLabel }: {
  title: string; onPress: () => void; kind?: BtnKind; loading?: boolean; disabled?: boolean;
  style?: StyleProp<ViewStyle>; testID?: string; small?: boolean; accessibilityLabel?: string;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={tr(accessibilityLabel ?? title)}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [b.base, small && b.small, b[kind], off && b.off, pressed && !off && b.pressed, style]}
    >
      {loading ? <ActivityIndicator color={kind === 'primary' ? color.onClay : color.clay} />
        : <Text style={[b.text, small && b.smallText, b[`${kind}Text` as const]]} numberOfLines={2}>{tr(title)}</Text>}
    </Pressable>
  );
}
const b = StyleSheet.create({
  base: { minHeight: TOUCH, borderRadius: 12, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  small: { minHeight: 40, paddingHorizontal: space.lg },
  primary: { backgroundColor: color.clay },
  secondary: { backgroundColor: color.card, borderWidth: 1, borderColor: color.borderStrong },
  danger: { backgroundColor: color.errDim, borderWidth: 1, borderColor: 'rgba(164,38,56,0.3)' },
  ghost: { backgroundColor: 'transparent' },
  off: { opacity: 0.55 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  text: { fontFamily: font.bold, fontSize: 15, textAlign: 'center' },
  smallText: { fontSize: 14 },
  primaryText: { color: color.onClay },
  secondaryText: { color: color.text },
  dangerText: { color: color.err },
  ghostText: { color: color.clay },
});

/* ── Motion: same feel as the website (colour fades in .2s, sections rise in .65s), off when "Reduce motion" is on ── */
const NATIVE = Platform.OS !== 'web';
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reduceMotion = !!v; }).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => { reduceMotion = !!v; });
export const motionOff = () => reduceMotion;
/** Smoothly animate the next layout change (expand/collapse). */
export function animateLayout() {
  if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

/** Fades content up into place when it first appears (website ".reveal"). */
export function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) { v.setValue(1); return; }
    const a = Animated.timing(v, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE });
    a.start();
    return () => a.stop();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/* ── Chip (filters): colour fades like the website pills, a soft press bounce ── */
export function Chip({ label, active, onPress, testID, onLayout }: { label: string; active?: boolean; onPress: () => void; testID?: string; onLayout?: (e: LayoutChangeEvent) => void }) {
  const [on] = useState(() => new Animated.Value(active ? 1 : 0));
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(on, { toValue: active ? 1 : 0, duration: reduceMotion ? 0 : 200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [active, on]);
  const press = (to: number) => { if (!reduceMotion) Animated.spring(scale, { toValue: to, speed: 40, bounciness: to === 1 ? 8 : 0, useNativeDriver: NATIVE }).start(); };
  const bg = on.interpolate({ inputRange: [0, 1], outputRange: [color.card, '#F8E9DF'] });
  const border = on.interpolate({ inputRange: [0, 1], outputRange: ['rgba(36,26,16,0.11)', 'rgba(176,71,34,0.45)'] });
  const fg = on.interpolate({ inputRange: [0, 1], outputRange: [color.text, color.clay] });
  return (
    <Pressable testID={testID} onPress={onPress} onPressIn={() => press(0.94)} onPressOut={() => press(1)} onLayout={onLayout}
      accessibilityRole="button" accessibilityState={{ selected: !!active }} aria-selected={!!active} hitSlop={4} style={{ marginRight: space.sm }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Animated.View style={[c.chip, { backgroundColor: bg, borderColor: border }]}>
          <Animated.Text style={[c.text, { color: fg }, active && c.onText]} numberOfLines={1}>{tr(label)}</Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
const c = StyleSheet.create({
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  text: { fontFamily: font.body, fontSize: 14 },
  onText: { fontFamily: font.bold },
});

/** A horizontal row of chips that glides the selected chip into view, and on first show
 *  gently peeks to the side so people see there's more to scroll (once per app start). */
let peeked = false;
export function ChipRow({ children, selectedKey, testID }: { children: (onLayoutFor: (key: string) => (e: LayoutChangeEvent) => void) => React.ReactNode; selectedKey?: string; testID?: string }) {
  const ref = useRef<ScrollView>(null);
  const pos = useRef<Record<string, { x: number; w: number }>>({});
  const width = useRef(0);
  const onLayoutFor = useCallback((key: string) => (e: LayoutChangeEvent) => { pos.current[key] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width }; }, []);
  useEffect(() => {
    if (!selectedKey) return;
    const p = pos.current[selectedKey];
    if (p && width.current) ref.current?.scrollTo({ x: Math.max(0, p.x - (width.current - p.w) / 2), animated: !reduceMotion });
  }, [selectedKey]);
  const onContent = (w: number) => {
    if (peeked || reduceMotion || Platform.OS === 'web' || w <= width.current + 40) return;
    peeked = true;
    setTimeout(() => { ref.current?.scrollTo({ x: 56, animated: true }); setTimeout(() => ref.current?.scrollTo({ x: 0, animated: true }), 450); }, 700);
  };
  return (
    <ScrollView ref={ref} testID={testID} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
      onLayout={(e) => { width.current = e.nativeEvent.layout.width; }} onContentSizeChange={(w) => onContent(w)}>
      {children(onLayoutFor)}
    </ScrollView>
  );
}

/* ── Field (always a visible label) ── */
export function Field({ label, error, hint, style, inputStyle, testID, ...input }: TextInputProps & {
  label: string; error?: string | null; hint?: string; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle>; testID?: string;
}) {
  return (
    <View style={[{ marginBottom: space.lg }, style]}>
      <Text style={txt.label}>{tr(label)}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={tr(label)}
        placeholderTextColor={color.dim}
        {...input}
        placeholder={tr(input.placeholder) ?? undefined}
        style={[f.input, input.multiline && f.multi, !!error && f.bad, inputStyle]}
      />
      {error ? <Text style={f.err}>{tr(error)}</Text> : hint ? <Text style={[txt.small, { marginTop: 4 }]}>{tr(hint)}</Text> : null}
    </View>
  );
}
const f = StyleSheet.create({
  input: { marginTop: 6, minHeight: TOUCH, borderRadius: radius.sm, borderWidth: 1, borderColor: color.border, backgroundColor: color.input, paddingHorizontal: 14, paddingVertical: 10, fontFamily: font.body, fontSize: 16, color: color.text },
  multi: { minHeight: 110, textAlignVertical: 'top' },
  bad: { borderColor: color.err },
  err: { marginTop: 4, fontFamily: font.body, fontSize: 13, color: color.err },
});

/* ── Checkbox ── */
export function Checkbox({ checked, onChange, label, testID }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }} aria-checked={checked}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: TOUCH, paddingVertical: space.sm }}>
      <View style={[cb.box, checked && cb.on]}>{checked && <Text style={cb.tick}>✓</Text>}</View>
      <View style={{ flex: 1 }}>{typeof label === 'string' ? <Txt v="muted">{label}</Txt> : label}</View>
    </Pressable>
  );
}
const cb = StyleSheet.create({
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: color.borderStrong, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  on: { backgroundColor: color.clay, borderColor: color.clay },
  tick: { color: color.onClay, fontFamily: font.bold, fontSize: 14, lineHeight: 16 },
});

/* ── Card / Badge / Pill / states ── */
export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[u.card, style]}>{children}</View>;
}
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'clay' | 'ok' }) {
  return (
    <View style={[u.badge, tone === 'clay' && { backgroundColor: color.clayDim }, tone === 'ok' && { backgroundColor: color.okDim }]}>
      <Text style={[u.badgeText, tone === 'clay' && { color: color.clay }, tone === 'ok' && { color: color.ok }]} numberOfLines={1}>{tr(label)}</Text>
    </View>
  );
}
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <View style={u.center} accessibilityLabel={tr(label)}><ActivityIndicator color={color.clay} size="large" /></View>;
}
export function Empty({ title, text, action, onAction, testID }: { title: string; text?: string; action?: string; onAction?: () => void; testID?: string }) {
  return (
    <View testID={testID} style={[u.center, { paddingHorizontal: space.xl }]}>
      <Txt v="h2" style={{ textAlign: 'center' }}>{title}</Txt>
      {text ? <Txt v="muted" style={{ textAlign: 'center', marginTop: space.sm }}>{text}</Txt> : null}
      {action && onAction ? <Button testID={testID ? `${testID}-action` : undefined} title={action} onPress={onAction} kind="secondary" style={{ marginTop: space.lg }} /> : null}
    </View>
  );
}
const u = StyleSheet.create({
  card: { backgroundColor: color.card, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, padding: space.lg },
  badge: { backgroundColor: color.input, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 6, alignSelf: 'flex-start' },
  badgeText: { fontFamily: font.body, fontSize: 12, color: color.muted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
});

/* ── Stars ── */
export function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }} accessibilityRole={onChange ? 'adjustable' : undefined} accessibilityLabel={tr(`${value} out of 5 stars`)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const star = <Text style={{ fontSize: size, color: i <= value ? color.clay : color.borderStrong }}>★</Text>;
        return onChange
          ? <Pressable key={i} testID={`star-${i}`} onPress={() => onChange(i)} hitSlop={6} style={{ padding: 4 }} accessibilityRole="button" accessibilityLabel={tr(`${i} star${i > 1 ? 's' : ''}`)}>{star}</Pressable>
          : <View key={i}>{star}</View>;
      })}
    </View>
  );
}

/* ── Toast ── */
type ToastKind = 'info' | 'success' | 'error';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((msg: string, kind: ToastKind = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, kind });
    timer.current = setTimeout(() => setToast(null), kind === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <View pointerEvents="none" style={[t.wrap, { bottom: insets.bottom + 72 }]}>
          <View testID="toast" accessibilityLiveRegion="polite" accessibilityRole="alert" style={t.box}>
            <Text style={[t.text, toast.kind === 'error' && { color: '#E8A3AE' }, toast.kind === 'success' && { color: '#8FD4A8' }]}>{tr(toast.msg)}</Text>
          </View>
        </View>
      )}
    </ToastCtx.Provider>
  );
}
const t = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  box: { backgroundColor: color.ink, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, maxWidth: 520 },
  text: { fontFamily: font.body, fontSize: 14, lineHeight: 20, color: color.inkText, textAlign: 'center' },
});

/* ── Confirm (native dialog; browser confirm on web) ── */
/** Web: no open/close animation for dialogs and sheets. React Native Web keeps a dialog's focus trap on while the closing
 *  animation runs, so a field tapped right after picking an option (e.g. a country) would not get the typing. */
const SHEET_ANIM = Platform.OS === 'web' ? 'none' : 'slide';
const FADE_ANIM = Platform.OS === 'web' ? 'none' : 'fade';
export function confirmAsync(title0: string, message0: string, confirmLabel0 = 'Continue', destructive = false): Promise<boolean> {
  const title = tr(title0), message = tr(message0), confirmLabel = tr(confirmLabel0);
  if (Platform.OS === 'web') return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/* ── Prompt (text input dialog — Alert.prompt only exists on iOS, so this is custom) ── */
export function PromptModal({ visible, title, message, label, placeholder, confirmLabel, multiline, keyboardType, validate, onCancel, onSubmit }: {
  visible: boolean; title: string; message?: string; label: string; placeholder?: string; confirmLabel: string; multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType']; validate: (v: string) => string | null; onCancel: () => void; onSubmit: (v: string) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const close = () => { setValue(''); setError(null); onCancel(); };
  const submit = () => {
    const err = validate(value.trim());
    if (err) { setError(err); return; }
    const v = value.trim(); setValue(''); setError(null); onSubmit(v);
  };
  return (
    <Modal visible={visible} transparent animationType={FADE_ANIM} onRequestClose={close}>
      <View style={p.backdrop}>
        <View style={p.box} testID="prompt">
          <Txt v="h2">{title}</Txt>
          {message ? <Txt v="muted" style={{ marginTop: space.sm, marginBottom: space.md }}>{message}</Txt> : null}
          <Field testID="prompt-input" label={label} value={value} onChangeText={(v) => { setValue(v); if (error) setError(null); }}
            placeholder={placeholder} multiline={multiline} keyboardType={keyboardType} autoCapitalize="none" autoCorrect={!keyboardType} error={error} autoFocus />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button title="Cancel" kind="secondary" onPress={close} style={{ flex: 1 }} />
            <Button testID="prompt-ok" title={confirmLabel} onPress={submit} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const p = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(33,25,17,0.55)', justifyContent: 'center', padding: space.lg },
  box: { backgroundColor: color.card, borderRadius: radius.lg, padding: space.xl, width: '100%', maxWidth: 480, alignSelf: 'center' },
});

/* ── Calendar date picker (works identically on iOS, Android and web) ── */
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** isOff: days that can't be picked (crossed out). multi: a set of marked days (availability calendar) — tapping toggles them, crossed-out days stay tappable.
 *  mark: extra marker for a day — 'trip' (an underline: the creator is away) or 'ext' (busy in the creator's own calendar); note: told to screen readers. */
export type DayMark = 'trip' | 'ext' | 'deal' | '';
export function DatePicker({ value, onChange, min, max, testID, isOff, multi, mark, note }: {
  value: string | null; onChange: (iso: string) => void; min: string; max: string; testID?: string;
  isOff?: (iso: string) => boolean; multi?: Set<string>; mark?: (iso: string) => DayMark[]; note?: (iso: string) => string;
}) {
  const start = value ?? min;
  const [todayIso] = useState(localToday);
  const [ym, setYm] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));
  const days = useMemo(() => {
    const first = new Date(Date.UTC(ym.y, ym.m, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Monday first
    const count = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)] as (number | null)[];
  }, [ym]);
  const iso = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const monthKey = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`;
  const canPrev = monthKey > min.slice(0, 7);
  const canNext = monthKey < max.slice(0, 7);
  const shift = (n: number) => setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  return (
    <View testID={testID} style={dp.wrap}>
      <View style={dp.head}>
        <Pressable testID="cal-prev" onPress={canPrev ? () => shift(-1) : undefined} accessibilityRole="button" accessibilityLabel={tr('Previous month')} style={({ pressed }) => [dp.nav, !canPrev && { opacity: 0.3 }, pressed && canPrev && dp.navPressed]}><Text style={dp.navText}>‹</Text></Pressable>
        <Text style={dp.month} testID="cal-month">{MONTHS[ym.m]} {ym.y}</Text>
        <Pressable testID="cal-next" onPress={canNext ? () => shift(1) : undefined} accessibilityRole="button" accessibilityLabel={tr('Next month')} style={({ pressed }) => [dp.nav, !canNext && { opacity: 0.3 }, pressed && canNext && dp.navPressed]}><Text style={dp.navText}>›</Text></Pressable>
      </View>
      <View style={dp.grid}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {   // Monday first, in the chosen language (1 Jan 2024 was a Monday)
          const w = new Date(Date.UTC(2024, 0, 1 + i, 12)).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }).replace(/\.$/, '').slice(0, 2);
          return <Text key={i} style={dp.wd}>{w.toUpperCase()}</Text>;
        })}
        {days.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={dp.cell} />;
          const v = iso(d); const out = v < min || v > max;
          const busy = !out && !!isOff?.(v);
          const marked = !!multi?.has(v);
          const off = out || (busy && !multi);
          const on = multi ? false : v === value;
          const marks = out || !mark ? [] : mark(v);
          const extra = out || !note ? '' : note(v);
          return (
            <Pressable key={v} testID={`day-${v}`} disabled={off} onPress={() => onChange(v)} style={dp.cell}
              accessibilityRole="button" accessibilityState={{ selected: on || marked, disabled: off }}
              accessibilityLabel={`${v}${busy ? (multi ? (marks.includes('ext') ? ', busy in your calendar' : ', fully booked') : ', not available') : ''}${marked ? ', day off' : ''}${extra ? `, ${extra}` : ''}`}>
              <View style={[dp.day, marks.includes('ext') && !marked && dp.dayExt, marks.includes('deal') && !busy && dp.dayDeal, marks.includes('trip') && dp.dayTrip, on && dp.dayOn, marked && dp.dayMarked]}
                {...(marks.length ? { dataSet: { mark: marks.join(' ') } } : {})}>
                <Text style={[dp.dayText, off && { color: color.borderStrong }, busy && dp.struck, on && { color: color.onClay, fontFamily: font.bold }, marked && dp.markedText]}>{d}</Text>
                {v === todayIso && !on ? <View style={dp.todayDot} /> : null}
                {marks.includes('deal') && !busy && !on ? <Text style={dp.dealBolt} accessibilityElementsHidden importantForAccessibility="no">⚡</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const dp = StyleSheet.create({
  wrap: { backgroundColor: color.card, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, padding: space.lg, paddingTop: space.md,
    shadowColor: '#593E21', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  month: { fontFamily: font.display, fontSize: 20, color: color.text },
  nav: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  navPressed: { backgroundColor: color.clayDim },
  navText: { fontSize: 24, lineHeight: 28, color: color.text, fontFamily: font.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: font.bold, fontSize: 10.5, letterSpacing: 0.6, color: color.dim, paddingBottom: 8 },
  cell: { width: `${100 / 7}%`, height: 50, alignItems: 'center', justifyContent: 'center' },
  day: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: color.clay, shadowColor: color.clay, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  todayDot: { position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: color.clay },
  dayTrip: { borderBottomWidth: 3, borderBottomColor: color.clay },
  dayExt: { backgroundColor: 'rgba(60,90,140,0.14)' },
  dayDeal: { backgroundColor: '#FBEADF' },
  dealBolt: { position: 'absolute', top: 1, right: 3, fontSize: 9 },
  dayMarked: { backgroundColor: color.errDim, borderWidth: 1, borderColor: 'rgba(164,38,56,0.35)' },
  dayText: { fontFamily: font.body, fontSize: 16, color: color.text },
  struck: { textDecorationLine: 'line-through', color: color.dim },
  markedText: { color: color.err, fontFamily: font.bold, textDecorationLine: 'line-through' },
});

/* ── Date field: a compact row once a date is chosen; tap to open the calendar again ── */
/** collapsed: start as a one-line "choose a date" row even without a value (for forms with several dates). */
export function DateField({ value, onChange, min, max, testID, placeholder = 'Choose a date', isOff, mark, note, collapsed }: { value: string | null; onChange: (iso: string) => void; min: string; max: string; testID?: string; placeholder?: string; isOff?: (iso: string) => boolean; mark?: (iso: string) => DayMark[]; note?: (iso: string) => string; collapsed?: boolean }) {
  const [open, setOpen] = useState(!value && !collapsed);
  const label = value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
  if (!open) {
    return (
      <Pressable testID={`${testID}-summary`} onPress={() => { animateLayout(); setOpen(true); }} accessibilityRole="button" accessibilityLabel={value ? `Date: ${label}. Change date` : placeholder}
        style={({ pressed }) => [df.row, !value && df.rowEmpty, pressed && { opacity: 0.8 }]}>
        <Text style={df.icon}>📅</Text>
        <Text style={[df.value, !value && df.placeholder]}>{value ? label : tr(placeholder)}</Text>
        <Text style={df.change}>{value ? 'Change' : 'Choose'}</Text>
      </Pressable>
    );
  }
  return (
    <View>
      {!value ? <Text style={[txt.small, { marginBottom: 6 }]}>{tr(placeholder)}</Text> : null}
      <DatePicker testID={testID} value={value} min={min} max={max} isOff={isOff} mark={mark} note={note} onChange={(d) => { animateLayout(); onChange(d); setOpen(false); }} />
    </View>
  );
}
const df = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(176,71,34,0.35)', backgroundColor: '#FBF1EA' },
  icon: { fontSize: 18 },
  value: { flex: 1, fontFamily: font.bold, fontSize: 15, color: color.text },
  change: { fontFamily: font.bold, fontSize: 14, color: color.clay },
  rowEmpty: { borderColor: color.border, backgroundColor: color.input },
  placeholder: { fontFamily: font.body, color: color.dim },
});

/* ── Bottom sheet menu (actions like Report / Block) ── */
export interface MenuItem { label: string; onPress: () => void; destructive?: boolean; testID?: string }
export function MenuSheet({ visible, title, items, onClose }: { visible: boolean; title?: string; items: MenuItem[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={SHEET_ANIM} onRequestClose={onClose}>
      <Pressable style={ms.backdrop} onPress={onClose} accessibilityLabel={tr('Close menu')} />
      <View style={[ms.sheet, { paddingBottom: insets.bottom + space.md }]} testID="menu-sheet">
        {title ? <Text style={[txt.label, { marginBottom: space.sm }]}>{tr(title)}</Text> : null}
        {items.map((it) => (
          <Pressable key={it.label} testID={it.testID} onPress={() => { onClose(); it.onPress(); }} accessibilityRole="button" style={({ pressed }) => [ms.item, pressed && { backgroundColor: color.input }]}>
            <Text style={[ms.itemText, it.destructive && { color: color.err }]}>{tr(it.label)}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} accessibilityRole="button" style={[ms.item, { justifyContent: 'center' }]}><Text style={[ms.itemText, { color: color.muted, textAlign: 'center', flex: 1 }]}>Cancel</Text></Pressable>
      </View>
    </Modal>
  );
}
const ms = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(33,25,17,0.45)' },
  sheet: { backgroundColor: color.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg },
  item: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, paddingHorizontal: space.sm },
  itemText: { fontFamily: font.body, fontSize: 16, color: color.text },
});

/* ── Choose one option from a list (e.g. country) ── */
export function SelectField({ label, value, options, onChange, testID, placeholder = 'Choose…' }: {
  label: string; value: string; options: [string, string][]; onChange: (v: string) => void; testID?: string; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(([k]) => k === value)?.[1];
  const insets = useSafeAreaInsets();
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={txt.label}>{tr(label)}</Text>
      <Pressable testID={testID} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${tr(label)}: ${tr(current ?? placeholder)}`} style={[f.input, sf.box]}>
        <Text style={[sf.value, !current && { color: color.dim }]} numberOfLines={1}>{tr(current ?? placeholder)}</Text>
        <Text style={sf.chev}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType={SHEET_ANIM} onRequestClose={() => setOpen(false)}>
        <Pressable style={ms.backdrop} onPress={() => setOpen(false)} accessibilityLabel={tr('Close')} />
        <View style={[ms.sheet, { maxHeight: '70%', paddingBottom: insets.bottom + space.md }]}>
          <Text style={[txt.label, { marginBottom: space.sm }]}>{tr(label)}</Text>
          <FlatList data={options} keyExtractor={([k]) => k} renderItem={({ item: [k, v] }) => (
            <Pressable testID={testID ? `${testID}-${k}` : undefined} onPress={() => { onChange(k); setOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: k === value }}
              style={({ pressed }) => [ms.item, pressed && { backgroundColor: color.input }]}>
              <Text style={[ms.itemText, { flex: 1 }, k === value && { color: color.clay, fontFamily: font.bold }]}>{tr(v)}</Text>
              {k === value ? <Text style={{ color: color.clay, fontFamily: font.bold }}>✓</Text> : null}
            </Pressable>
          )} />
        </View>
      </Modal>
    </View>
  );
}
const sf = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { flex: 1, fontFamily: font.body, fontSize: 16, color: color.text },
  chev: { color: color.dim, fontSize: 14, marginLeft: space.sm },
});

/* ── Segmented choice (2–4 options) ── */
export function Segmented<T extends string | number>({ options, value, onChange, testID }: { options: [T, string][]; value: T; onChange: (v: T) => void; testID?: string }) {
  return (
    <View style={sg.wrap} testID={testID}>
      {options.map(([k, l]) => {
        const on = k === value;
        return (
          <Pressable key={String(k)} testID={testID ? `${testID}-${k}` : undefined} onPress={() => onChange(k)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={[sg.item, on && sg.on]}>
            <Text style={[sg.text, on && sg.onText]} numberOfLines={1}>{tr(l)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const sg = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: color.input, borderRadius: radius.sm, padding: 3, gap: 3 },
  item: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  on: { backgroundColor: color.card, borderWidth: 1, borderColor: color.border },
  text: { fontFamily: font.body, fontSize: 13, color: color.muted },
  onText: { color: color.text, fontFamily: font.bold },
});
