import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { color, font, radius, space } from '../theme';
import { animateLayout, Button, Card, Checkbox, Chip, confirmAsync, Empty, Field, Loading, Reveal, Segmented, SelectField, Txt, useToast, TText } from '../components/ui';
import { api } from '../lib/api';
import { displayName, useAuth } from '../lib/auth';
import { services, vibes, occasions } from '../lib/taxonomy-data';
import { cleanHandleInput, GALLERY_MAX, galleryOf, handleProblem, httpsUrl, isHandleTaken, slugify, type GalleryItem, type Listing } from '../lib/logic';
import { pickPhotos, prepareUpload } from '../lib/photo-io';
import { introVideoOk, SAMPLE_MAX } from '../lib/trust-logic';
import { SITE_URL } from '../lib/config';
import {
  BIO_MAX, buildListingPayload, draftFrom, DRONE_REGIONS, emptyPackage, LEVELS, MAX_PACKAGES, MAX_SPOTS, minutesLabel,
  PKG_EDIT_DAYS, PKG_MINUTES, PKG_REVISIONS, PKG_TURNAROUND, PRICES, type DroneDraft, type ListingDraft, type PackageDraft,
} from '../lib/listing-logic';
import { tr as trx } from '../lib/i18n';

const DEFAULT_COVER = require('../../assets/default-cover.jpg');

function Section({ title, hint, children, delay = 0 }: { title: string; hint?: string; children: React.ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay} style={{ marginTop: space.xl }}>
      <Txt v="label">{title}</Txt>
      {hint ? <Txt v="small" style={{ marginTop: 2 }}>{hint}</Txt> : null}
      <View style={{ marginTop: space.sm }}>{children}</View>
    </Reveal>
  );
}
const Wrap = ({ children }: { children: React.ReactNode }) => <View style={s.wrap}>{children}</View>;
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function ListingEditor() {
  const { user } = useAuth();
  const toast = useToast();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [d, setD] = useState<ListingDraft | null>(null);
  const [cover, setCover] = useState<{ uri: string; base64: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryRemoved, setGalleryRemoved] = useState<string[]>([]);
  const [galleryBusy, setGalleryBusy] = useState<string | null>(null);
  // "A full shoot": every photo from one real delivery (optional)
  const [sample, setSample] = useState<GalleryItem[]>([]);
  const [sampleRemoved, setSampleRemoved] = useState<string[]>([]);
  const [sampleBusy, setSampleBusy] = useState<string | null>(null);
  const [sampleTitle, setSampleTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [handle, setHandle] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await api.listings.mine(user.id);
      if (error) { setLoadError(true); return; }
      const l = data ?? null;
      const [email, drone] = l ? await Promise.all([api.listing.myEmail(), l.drone_region ? api.listing.myDrone() : Promise.resolve(null)]) : [null, null];
      setListing(l);
      setD(draftFrom(l, displayName(user), email || user.email || '', drone));
      setGallery(galleryOf(l));
      setSample(galleryOf(l, 'sample_gallery'));
      setSampleTitle(l?.sample_title || '');
      setIntro(l?.intro_video_url || '');
      setHandle(l?.handle || '');
    })();
  }, [user]);

  if (!user) return <Empty title="Sign in to create your listing" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (loadError) return <Empty title="Couldn't load your listing" text="Check your connection and try again." action="Back" onAction={() => router.back()} />;
  if (listing === undefined || !d) return <Loading />;

  const set = (patch: Partial<ListingDraft>) => setD((cur) => (cur ? { ...cur, ...patch } : cur));
  const setDrone = (patch: Partial<DroneDraft>) => setD((cur) => (cur ? { ...cur, drone: { ...cur.drone, ...patch } } : cur));
  const setPkg = (i: number, patch: Partial<PackageDraft>) => setD((cur) => (cur ? { ...cur, packages: cur.packages.map((p, j) => (j === i ? { ...p, ...patch } : p)) } : cur));
  const hasDrone = d.services.includes('drone');

  async function pickCover() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 1 });
    if (r.canceled || !r.assets?.[0]) return;
    try {
      setBusy('photo');
      // Always a JPEG, max 1600 px wide — small, fast, and accepted by the storage rules (JPG/PNG/WebP, 5 MB)
      const ctx = ImageManipulator.manipulate(r.assets[0].uri);
      if ((r.assets[0].width || 0) > 1600) ctx.resize({ width: 1600 });
      const img = await ctx.renderAsync();
      const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      if (!out.base64) throw new Error('no data');
      setCover({ uri: out.uri, base64: out.base64 });
    } catch {
      toast('Could not use that photo. Please try another one.', 'error');
    } finally { setBusy(null); }
  }

  // Two photo sets share the same editing: the portfolio gallery and "a full shoot"
  const SETS = {
    gallery: { items: gallery, set: setGallery, setRemoved: setGalleryRemoved, setBusy: setGalleryBusy, max: GALLERY_MAX, prefix: ['g', 'gt'] as const },
    sample: { items: sample, set: setSample, setRemoved: setSampleRemoved, setBusy: setSampleBusy, max: SAMPLE_MAX, prefix: ['s', 'st'] as const },
  };
  type SetKey = keyof typeof SETS;
  async function addPhotos(key: SetKey) {
    if (!user || galleryBusy || sampleBusy) return;
    const st = SETS[key];
    const room = st.max - st.items.length;
    if (room <= 0) { toast(`Up to ${st.max} photos.`); return; }
    const picked = await pickPhotos(room);
    if (!picked.length) return;
    let failed = 0;
    for (let i = 0; i < picked.length; i++) {
      st.setBusy(`Uploading ${i + 1} of ${picked.length}…`);
      try {
        const { full, thumb } = await prepareUpload(picked[i], 2000, 500);
        const a = await api.listing.uploadPublic(full.base64, user.id, st.prefix[0]);
        if (a.error || !a.url) throw new Error(a.error?.message);
        const t = thumb ? await api.listing.uploadPublic(thumb.base64, user.id, st.prefix[1]) : { url: null };
        const item: GalleryItem = t.url ? { url: a.url, thumb: t.url } : { url: a.url };
        animateLayout();
        st.set((cur) => [...cur, item]);
      } catch { failed++; }
    }
    st.setBusy(null);
    toast(failed ? `${failed} photo${failed > 1 ? 's' : ''} couldn't be added. Please try again.` : 'Photos added — tap “Save listing” to publish them.', failed ? 'error' : 'info');
  }
  function movePhoto(key: SetKey, i: number, dir: -1 | 1) {
    const st = SETS[key];
    const j = i + dir;
    if (j < 0 || j >= st.items.length) return;
    animateLayout();
    st.set((cur) => { const n = [...cur]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  }
  function removePhoto(key: SetKey, i: number) {
    const st = SETS[key];
    const g = st.items[i]; if (!g || !user) return;
    const urls = [g.url, g.thumb].filter((x): x is string => !!x);
    const saved = new Set([...galleryOf(listing), ...galleryOf(listing, 'sample_gallery')].flatMap((x) => [x.url, x.thumb]));
    if (urls.some((u) => saved.has(u))) st.setRemoved((cur) => [...cur, ...urls]); // deleted after saving
    else api.listing.removePublic(urls, user.id);                                    // never saved → delete now
    animateLayout();
    st.set((cur) => cur.filter((_, j) => j !== i));
  }
  const photoSetEditor = (key: SetKey, testPrefix: string) => {
    const items = SETS[key].items;
    return items.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} testID={`${key}-editor`}>
        {items.map((g, i) => (
          <View key={g.url} style={[s.gItem, i === 0 && key === 'gallery' && s.gFirst]}>
            <Image source={{ uri: g.thumb || g.url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
            <View style={s.gTools}>
              <Pressable testID={`${testPrefix}-left-${i}`} onPress={() => movePhoto(key, i, -1)} disabled={i === 0} style={[s.gBtn, i === 0 && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel={trx(`Move photo ${i + 1} left`)}><Text style={s.gBtnText}>‹</Text></Pressable>
              <Pressable testID={`${testPrefix}-del-${i}`} onPress={() => removePhoto(key, i)} style={s.gBtn} accessibilityRole="button" accessibilityLabel={trx(`Remove photo ${i + 1}`)}><Text style={s.gBtnText}>✕</Text></Pressable>
              <Pressable testID={`${testPrefix}-right-${i}`} onPress={() => movePhoto(key, i, 1)} disabled={i === items.length - 1} style={[s.gBtn, i === items.length - 1 && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel={trx(`Move photo ${i + 1} right`)}><Text style={s.gBtnText}>›</Text></Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    ) : null;
  };

  async function save() {
    if (!d || !user) return;
    const built = buildListingPayload(d);
    if ('error' in built) { toast(built.error, 'error'); return; }
    const h = handle.trim();
    const hp = handleProblem(h);
    if (hp) { setHandleError(hp); toast(hp, 'error'); return; }
    if (galleryBusy || sampleBusy) { toast('Please wait until the photos are uploaded.'); return; }
    const introUrl = intro.trim();
    if (introUrl && !introVideoOk(introUrl)) { toast('Intro video: paste a link to YouTube, Instagram, TikTok or Vimeo (https://…).', 'error'); return; }
    const payload: Record<string, unknown> = {
      ...built.payload, gallery: gallery.slice(0, GALLERY_MAX), handle: h || null,
      sample_gallery: sample.slice(0, SAMPLE_MAX), sample_title: sample.length ? (sampleTitle.trim().slice(0, 80) || null) : null, intro_video_url: introUrl || null,
    };
    try {
      let coords = listing?.coords ?? null;
      if (!listing || d.city.trim() !== listing.city || !coords) {
        setBusy('Finding your city…');
        coords = await api.listing.geocode(d.city);
      }
      payload.coords = coords;
      payload.cover_image_url = listing?.cover_image_url ?? null;
      if (cover) {
        setBusy('Uploading photo…');
        const up = await api.listing.uploadCover(cover.base64, user.id);
        if (up.error) toast(`Photo upload failed: ${up.error.message}`, 'error');
        else payload.cover_image_url = up.url;
      }
      setBusy('Saving…');
      let res = await api.listing.save(listing?.id ?? null, payload, user.id);
      if (isHandleTaken(res.error)) { setHandleError('That link is already taken — please choose another.'); toast('That booking link is already taken — please choose another.', 'error'); return; }
      let needsDb = false;
      if (res.error?.code && ['42703', 'PGRST204'].includes(res.error.code) && /sample_|intro_video/i.test(res.error.message)) {
        const { sample_gallery: _s, sample_title: _t, intro_video_url: _v, ...rest } = payload; // database not updated yet (v8.10)
        res = await api.listing.save(listing?.id ?? null, rest, user.id); needsDb = true;
      }
      if (res.error?.code && ['42703', 'PGRST204'].includes(res.error.code) && /gallery|handle/i.test(res.error.message)) {
        const { gallery: _g, handle: _h, sample_gallery: _s, sample_title: _t, intro_video_url: _v, ...rest } = payload; // database not updated yet (v8.6)
        res = await api.listing.save(listing?.id ?? null, rest, user.id); needsDb = true;
      }
      const { data, error } = res;
      if (error || !data) { toast(`Could not save: ${error?.message || 'please try again.'}`, 'error'); return; }
      if (!needsDb && galleryRemoved.length) { api.listing.removePublic(galleryRemoved, user.id); setGalleryRemoved([]); }
      if (!needsDb && sampleRemoved.length) { api.listing.removePublic(sampleRemoved, user.id); setSampleRemoved([]); }
      const isNew = !listing;
      setListing(data);
      if (!needsDb) { setGallery(galleryOf(data)); setSample(galleryOf(data, 'sample_gallery')); }
      setHandle(data.handle || '');
      setCover(null);
      if (needsDb) { toast('Saved — but the gallery and booking link need the latest database update.', 'info'); return; }
      toast(!coords ? "Saved — but we couldn't find that city on the map. Try “City, Country”." : isNew ? 'Your listing is live ✓' : 'Listing saved ✓', coords ? 'success' : 'info');
      if (isNew && d.packages.length && (await confirmAsync('Next: get paid online', 'Set up payouts so travellers can book and pay you through CapturaGo.', 'Set up payouts'))) {
        router.replace('/payouts');
      }
    } finally { setBusy(null); }
  }

  async function remove() {
    if (!listing) return;
    if (!(await confirmAsync('Delete your listing?', 'Your profile, packages, reviews and messages with travellers will be permanently removed.', 'Delete', true))) return;
    setBusy('Deleting…');
    const { error } = await api.listing.remove(listing.id);
    setBusy(null);
    if (error) { toast(/active bookings/i.test(error.message) ? error.message : 'Could not delete your listing.', 'error'); return; }
    toast('Listing deleted.');
    router.back();
  }

  const coverSrc = cover ? { uri: cover.uri } : listing?.cover_image_url && httpsUrl(listing.cover_image_url) ? { uri: httpsUrl(listing.cover_image_url)! } : DEFAULT_COVER;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Stack.Screen options={{ title: trx(listing ? 'My listing' : 'Create your listing') }} />
      <ScrollView testID="listing-form" style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
        {!listing && (
          <Card style={{ backgroundColor: color.sand, marginBottom: space.md }}>
            <Txt v="h3">List yourself for free</Txt>
            <Txt v="muted" style={{ marginTop: 4 }}>Travellers find you in the app and on capturago.com. Fields marked * are required.</Txt>
          </Card>
        )}

        <Reveal>
          <Pressable testID="cover-pick" onPress={pickCover} accessibilityRole="button" accessibilityLabel={trx("Choose cover photo")} style={s.cover}>
            <Image source={coverSrc} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
            <View style={s.coverBadge}><TText style={s.coverBadgeText}>{busy === 'photo' ? 'Preparing…' : cover ? '✓ New photo · tap to change' : '📷 Choose cover photo'}</TText></View>
          </Pressable>
        </Reveal>

        <Section title="About you" delay={60}>
          <Field testID="el-name" label="Name *" value={d.name} onChangeText={(v) => set({ name: v })} maxLength={80} autoComplete="name" />
          <Field testID="el-city" label="City *" value={d.city} onChangeText={(v) => set({ city: v })} maxLength={80} placeholder={trx("e.g. Kyoto, Japan")} hint="City and country, so travellers find you on the map." />
          <Field testID="el-email" label="Contact email *" value={d.email} onChangeText={(v) => set({ email: v })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} hint="Private — only used to notify you about bookings and messages." />
          <Field testID="el-portfolio" label="Portfolio link *" value={d.portfolio} onChangeText={(v) => set({ portfolio: v })} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder={trx("https://instagram.com/yourname")} />
          <Field label="Languages" value={d.languages} onChangeText={(v) => set({ languages: v })} maxLength={120} placeholder={trx("e.g. English, Slovak")} />
          <Field testID="el-bio" label={`About your work (${d.bio.length}/${BIO_MAX})`} value={d.bio} onChangeText={(v) => set({ bio: v.slice(0, BIO_MAX) })} multiline maxLength={BIO_MAX}
            placeholder={trx("Your style, what a session with you is like, what's included…")} />
        </Section>

        <Section title={`Portfolio gallery (${gallery.length}/${GALLERY_MAX})`} hint="Your best work — travellers decide by looking at it. Add 6–12 photos; the first one is shown first." delay={70}>
          {photoSetEditor('gallery', 'g')}
          {gallery.length < GALLERY_MAX && (
            <Button testID="gallery-add" title={galleryBusy ?? '+ Add photos'} kind="secondary" onPress={() => addPhotos('gallery')} disabled={!!galleryBusy || !!sampleBusy} style={{ marginTop: space.sm }} />
          )}
        </Section>

        <Section title={`A full shoot (${sample.length}/${SAMPLE_MAX})`} hint="Optional: every photo from one real shoot (with your client's permission), so travellers see what a whole delivery looks like." delay={72}>
          <Field testID="el-sample-title" label="Title" value={sampleTitle} onChangeText={(v) => setSampleTitle(v.slice(0, 80))} maxLength={80} placeholder={trx("e.g. Proposal in Gion — all 32 delivered photos")} />
          {photoSetEditor('sample', 's')}
          {sample.length < SAMPLE_MAX && (
            <Button testID="sample-add" title={sampleBusy ?? '+ Add photos'} kind="secondary" onPress={() => addPhotos('sample')} disabled={!!galleryBusy || !!sampleBusy} style={{ marginTop: space.sm }} />
          )}
        </Section>

        <Section title="15-second intro video" hint="Optional: a link to a short video of you on YouTube, Instagram, TikTok or Vimeo — travellers trust a face." delay={74}>
          <Field testID="el-intro" label="Video link" value={intro} onChangeText={setIntro} maxLength={300} keyboardType="url" autoCapitalize="none" autoCorrect={false}
            placeholder={trx("https://www.instagram.com/reel/…")} error={intro.trim() && !introVideoOk(intro) ? 'Use a YouTube, Instagram, TikTok or Vimeo link (https://…).' : null} style={{ marginBottom: 0 }} />
        </Section>

        <Section title="Your booking link" hint="Share it anywhere — travellers who book through it pay a lower service fee." delay={75}>
          <Field testID="el-handle" label={`${SITE_URL.replace(/^https?:\/\//, '')}/c/${handle || '…'}`} value={handle}
            onChangeText={(v) => { setHandle(cleanHandleInput(v)); setHandleError(null); }} onFocus={() => { if (!handle && d.name) setHandle(slugify(d.name)); }}
            autoCapitalize="none" autoCorrect={false} maxLength={30} placeholder={trx(slugify(d.name) || 'your-name')} error={handleError}
            hint="3–30 characters: lowercase letters, numbers and dashes. Leave empty if you don't want a link yet." />
        </Section>

        <Section title="Services *" hint="On location" delay={80}>
          <Wrap>{services.filter((x) => x.group === 'onsite').map((x) => (
            <View key={x.id} style={s.chip}><Chip testID={`svc-${x.id}`} label={`${x.icon} ${x.short}`} active={d.services.includes(x.id)} onPress={() => { animateLayout(); set({ services: toggle(d.services, x.id) }); }} /></View>
          ))}</Wrap>
          <Txt v="small" style={{ marginTop: space.sm, marginBottom: 6 }}>Remote — work for clients anywhere</Txt>
          <Wrap>{services.filter((x) => x.group === 'remote').map((x) => (
            <View key={x.id} style={s.chip}><Chip testID={`svc-${x.id}`} label={`${x.icon} ${x.short}`} active={d.services.includes(x.id)} onPress={() => set({ services: toggle(d.services, x.id) })} /></View>
          ))}</Wrap>
        </Section>

        {hasDrone && (
          <Card style={{ marginTop: space.lg, borderColor: 'rgba(176,71,34,0.35)' }} testID="drone-box">
            <Txt v="h3">🚁 Drone rules</Txt>
            <View style={{ marginTop: space.md }}>
              <SelectField testID="drone-region" label="Where do you fly for clients? *" value={d.drone.region} options={DRONE_REGIONS.map((r) => [r.id, r.label])}
                onChange={(v) => { animateLayout(); setDrone({ region: v as DroneDraft['region'] }); }} />
            </View>
            {d.drone.region === 'easa' && (
              <>
                <Txt v="small" style={{ marginBottom: space.md }}>In the EU, anyone flying a drone with a camera must be registered as an operator — any weight, paid or hobby. Drones of 250 g or more also need the A1/A3 (or A2) certificate.</Txt>
                <Field testID="drone-euop" label="Operator registration number *" value={d.drone.euOp} onChangeText={(v) => setDrone({ euOp: v })} maxLength={24} autoCapitalize="characters" autoCorrect={false}
                  placeholder={trx("16 characters, e.g. SVK…")} hint="The public number shown on your drone. Never enter the 3 secret characters after the dash." />
                <Txt v="label">Your drone’s weight *</Txt>
                <View style={{ marginTop: 6, marginBottom: space.lg }}>
                  <Segmented testID="drone-weight" options={[['sub250', 'Under 250 g'], ['250plus', '250 g or more']]} value={d.drone.euWeight || ('' as 'sub250')}
                    onChange={(v) => { animateLayout(); setDrone({ euWeight: v }); }} />
                </View>
                {d.drone.euWeight === '250plus' && <Field testID="drone-eucert" label="A1/A3 or A2 certificate number *" value={d.drone.euCert} onChangeText={(v) => setDrone({ euCert: v })} maxLength={40} autoCapitalize="characters" autoCorrect={false} />}
              </>
            )}
            {d.drone.region === 'faa' && (
              <>
                <Txt v="small" style={{ marginBottom: space.md }}>Paid drone work in the US requires an FAA Part 107 Remote Pilot Certificate and a Part 107 drone registration — even for drones under 250 g.</Txt>
                <Field testID="drone-uscert" label="Part 107 certificate number *" value={d.drone.usCert} onChangeText={(v) => setDrone({ usCert: v })} maxLength={20} autoCapitalize="characters" autoCorrect={false} />
                <Field testID="drone-usreg" label="FAA drone registration number *" value={d.drone.usReg} onChangeText={(v) => setDrone({ usReg: v })} maxLength={20} autoCapitalize="characters" autoCorrect={false} placeholder={trx("FA…")} />
              </>
            )}
            {d.drone.region === 'other' && (
              <>
                <Txt v="small" style={{ marginBottom: space.md }}>Drone rules differ by country. Add your permit or registration number if your country requires one.</Txt>
                <Field label="Permit / registration number" value={d.drone.otherReg} onChangeText={(v) => setDrone({ otherReg: v })} maxLength={60} autoCorrect={false} />
              </>
            )}
            <Checkbox testID="drone-declare" checked={d.drone.declared} onChange={(v) => setDrone({ declared: v })}
              label="I confirm these details are correct and I follow the drone rules where I fly (no-fly zones, Remote ID where required). *" />
            <Txt v="small">Your numbers stay private. Travellers only see a “declared” badge.</Txt>
          </Card>
        )}

        <Section title="Your style" delay={100}>
          <Wrap>{vibes.map((v) => (
            <View key={v.id} style={s.chip}><Chip testID={`vb-${v.id}`} label={`${v.icon} ${v.label}`} active={d.vibes.includes(v.id)} onPress={() => set({ vibes: toggle(d.vibes, v.id) })} /></View>
          ))}</Wrap>
        </Section>

        <Section title="Great for" delay={120}>
          <Wrap>{occasions.map((o) => (
            <View key={o.id} style={s.chip}><Chip testID={`oc-${o.id}`} label={`${o.icon} ${o.label}`} active={d.occasions.includes(o.id)} onPress={() => set({ occasions: toggle(d.occasions, o.id) })} /></View>
          ))}</Wrap>
        </Section>

        <Section title="Price range & experience">
          <Segmented testID="el-price" options={PRICES} value={d.price} onChange={(v) => set({ price: v })} />
          <View style={{ height: space.sm }} />
          <Segmented testID="el-level" options={LEVELS} value={d.level} onChange={(v) => set({ level: v })} />
          <View style={s.switchRow}>
            <Txt v="body" style={{ flex: 1 }}>I travel to other cities for shoots</Txt>
            <Switch testID="el-travel" value={d.travel} onValueChange={(v) => set({ travel: v })} trackColor={{ true: color.clay, false: color.borderStrong }} thumbColor={color.card} accessibilityLabel={trx("I travel for shoots")} />
          </View>
        </Section>

        <Section title={`Packages (${d.packages.length}/${MAX_PACKAGES})`} hint="With a price, travellers can book and pay you online (once payouts are set up).">
          {d.packages.map((p, i) => (
            <Card key={p.id ?? `new-${i}`} style={{ marginBottom: space.md }} testID={`pkg-${i}`}>
              <View style={s.cardHead}>
                <Txt v="h3" style={{ flex: 1 }}>Package {i + 1}</Txt>
                <Pressable testID={`pkg-remove-${i}`} onPress={() => { animateLayout(); set({ packages: d.packages.filter((_, j) => j !== i) }); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={trx(`Remove package ${i + 1}`)}>
                  <TText style={s.remove}>Remove</TText>
                </Pressable>
              </View>
              <Field testID={`pkg-name-${i}`} label="Name *" value={p.name} onChangeText={(v) => setPkg(i, { name: v })} maxLength={60} placeholder={trx("e.g. Golden hour portraits")} />
              <Segmented testID={`pkg-type-${i}`} options={[['session', '📍 In person'], ['delivery', '🌐 Remote delivery']]} value={p.type} onChange={(v) => { animateLayout(); setPkg(i, { type: v }); }} />
              <Field testID={`pkg-price-${i}`} label="Price in € *" value={p.price} onChangeText={(v) => setPkg(i, { price: v.replace(/[^0-9.,]/g, '') })} keyboardType="decimal-pad" placeholder="10 – 5000" style={{ marginTop: space.lg }} />
              {p.type === 'session' ? (
                <>
                  <Txt v="label">Duration</Txt>
                  <View style={[s.wrap, { marginTop: 6, marginBottom: space.lg }]}>{PKG_MINUTES.map((m) => (
                    <View key={m} style={s.chip}><Chip label={minutesLabel(m)} active={p.minutes === m} onPress={() => setPkg(i, { minutes: m })} /></View>
                  ))}</View>
                </>
              ) : (
                <>
                  <Txt v="label">Delivered in</Txt>
                  <View style={[s.wrap, { marginTop: 6, marginBottom: space.md }]}>{PKG_TURNAROUND.map((x) => (
                    <View key={x} style={s.chip}><Chip label={`${x} day${x > 1 ? 's' : ''}`} active={p.days === x} onPress={() => setPkg(i, { days: x })} /></View>
                  ))}</View>
                  <Txt v="label">Revisions included</Txt>
                  <View style={[s.wrap, { marginTop: 6, marginBottom: space.lg }]}>{PKG_REVISIONS.map((x) => (
                    <View key={x} style={s.chip}><Chip label={String(x)} active={p.revisions === x} onPress={() => setPkg(i, { revisions: x })} /></View>
                  ))}</View>
                </>
              )}
              <Field testID={`pkg-photos-${i}`} label="Edited photos" value={p.photos} onChangeText={(v) => setPkg(i, { photos: v.replace(/[^0-9]/g, '').slice(0, 4) })} keyboardType="number-pad" placeholder="e.g. 30" />
              {p.type === 'session' ? (
                <>
                  <Txt v="label">Photos delivered within</Txt>
                  <View style={[s.wrap, { marginTop: 6, marginBottom: space.lg }]}>{PKG_EDIT_DAYS.map((x) => (
                    <View key={x} style={s.chip}><Chip testID={`pkg-edit-${i}-${x}`} label={`${x} day${x > 1 ? 's' : ''}`} active={p.editDays === x} onPress={() => setPkg(i, { editDays: p.editDays === x ? 0 : x })} /></View>
                  ))}</View>
                </>
              ) : null}
              <Field testID={`pkg-incl-${i}`} label="Also included (separate with commas)" value={p.includes} onChangeText={(v) => setPkg(i, { includes: v })} maxLength={400} placeholder={trx("e.g. Location scouting, 2 outfits, Posing help")} />
              <Field label="Short description (optional)" value={p.desc} onChangeText={(v) => setPkg(i, { desc: v })} maxLength={200} placeholder={trx("e.g. Sunrise at the temple, before the crowds")} style={{ marginBottom: 0 }} />
            </Card>
          ))}
          {d.packages.length < MAX_PACKAGES && (
            <Button testID="pkg-add" title="+ Add a package" kind="secondary" onPress={() => { animateLayout(); set({ packages: [...d.packages, emptyPackage()] }); }} />
          )}
        </Section>

        <Section title={`Favourite local spots (${d.spots.length}/${MAX_SPOTS})`} hint="Places you love to shoot — travellers love this.">
          {d.spots.map((sp, i) => (
            <Card key={i} style={{ marginBottom: space.md }}>
              <View style={s.cardHead}>
                <Txt v="h3" style={{ flex: 1 }}>📍 Spot {i + 1}</Txt>
                <Pressable onPress={() => { animateLayout(); set({ spots: d.spots.filter((_, j) => j !== i) }); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={trx(`Remove spot ${i + 1}`)}><TText style={s.remove}>Remove</TText></Pressable>
              </View>
              <Field label="Spot name" value={sp.name} onChangeText={(v) => set({ spots: d.spots.map((x, j) => (j === i ? { ...x, name: v } : x)) })} maxLength={80} />
              <Field label="Why is it special?" value={sp.desc} onChangeText={(v) => set({ spots: d.spots.map((x, j) => (j === i ? { ...x, desc: v } : x)) })} maxLength={200} multiline style={{ marginBottom: 0 }} />
            </Card>
          ))}
          {d.spots.length < MAX_SPOTS && <Button title="+ Add a spot" kind="secondary" onPress={() => { animateLayout(); set({ spots: [...d.spots, { name: '', desc: '' }] }); }} />}
        </Section>

        <Button testID="listing-save" title={listing ? 'Save listing' : 'Publish my listing'} onPress={save} loading={!!busy && busy !== 'photo'} style={{ marginTop: space.xxl }} />
        {busy && busy !== 'photo' ? <Txt v="small" style={{ textAlign: 'center', marginTop: space.sm }}>{busy}</Txt> : null}
        {listing && <Button testID="listing-delete" title="Delete listing" kind="danger" onPress={remove} style={{ marginTop: space.xl }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { marginBottom: space.sm },
  cover: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.sand, justifyContent: 'flex-end' },
  coverBadge: { margin: space.md, alignSelf: 'flex-start', backgroundColor: 'rgba(33,25,17,0.75)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  coverBadgeText: { color: color.inkText, fontFamily: font.bold, fontSize: 13 },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  remove: { fontFamily: font.bold, fontSize: 14, color: color.err },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, marginTop: space.md },
  gItem: { width: 112, height: 112, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.sand, justifyContent: 'flex-end' },
  gFirst: { borderWidth: 2, borderColor: color.clay },
  gTools: { flexDirection: 'row', justifyContent: 'space-between', padding: 4, backgroundColor: 'rgba(20,15,10,0.35)' },
  gBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,251,245,0.94)', alignItems: 'center', justifyContent: 'center' },
  gBtnText: { fontFamily: font.bold, fontSize: 15, color: color.text, lineHeight: 18 },
});
