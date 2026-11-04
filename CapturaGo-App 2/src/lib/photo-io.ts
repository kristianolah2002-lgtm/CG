// Picking, resizing, saving and sharing photos — the device side of the private photo gallery.
// Native: Expo image picker / manipulator / file system / share sheet. Web: browser downloads.
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zipSync } from 'fflate';

export interface Picked { uri: string; width: number; height: number }
export interface Jpeg { base64: string; uri: string; w: number; h: number }

/** Let the user choose several photos from their library (up to `max`). */
export async function pickPhotos(max: number): Promise<Picked[]> {
  if (max <= 0) return [];
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.min(max, 100), quality: 1, orderedSelection: true });
  if (r.canceled || !r.assets) return [];
  return r.assets.slice(0, max).map((a) => ({ uri: a.uri, width: a.width || 0, height: a.height || 0 }));
}

/** Resize so the longest side is at most `maxSide`, always as JPEG (base64). */
export async function toJpeg(p: Picked, maxSide: number, compress: number): Promise<Jpeg> {
  const ctx = ImageManipulator.manipulate(p.uri);
  const long = Math.max(p.width, p.height);
  if (long > maxSide) ctx.resize(p.width >= p.height ? { width: maxSide } : { height: maxSide });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  if (!out.base64) throw new Error('Could not read that photo.');
  return { base64: out.base64, uri: out.uri, w: out.width, h: out.height };
}

/** A photo from a (signed) link, resized to a JPEG — used to copy delivered photos into a public review. */
export async function remoteToJpeg(url: string, maxSide: number, compress = 0.85): Promise<Jpeg> {
  let uri: string;
  let revoke: string | null = null;
  if (Platform.OS === 'web') {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Could not read one of the photos.');
    uri = revoke = URL.createObjectURL(await r.blob()); // a local copy, so the canvas isn't blocked by the other domain
  } else {
    const file = await File.downloadFileAsync(url, new File(Paths.cache, `rv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`), { idempotent: true });
    uri = file.uri;
  }
  try {
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    return await toJpeg({ uri, width: probe.width, height: probe.height }, maxSide, compress);
  } finally {
    if (revoke) URL.revokeObjectURL(revoke);
  }
}

/** A text file (CSV, SVG): a normal download on the web, the share sheet on phones (Save to Files, Mail…). */
export async function saveTextFile(text: string, name: string, mimeType: string, uti: string): Promise<void> {
  if (Platform.OS === 'web') { webDownload(new Blob([text], { type: `${mimeType};charset=utf-8` }), name); return; }
  const out = new File(Paths.cache, name);
  if (out.exists) out.delete();
  out.create();
  out.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(out.uri, { mimeType, UTI: uti, dialogTitle: name });
}

/** Full photo + small preview, ready to upload. */
export async function prepareUpload(p: Picked, fullSide: number, thumbSide: number): Promise<{ full: Jpeg; thumb: Jpeg | null }> {
  const full = await toJpeg(p, fullSide, 0.9);
  let thumb: Jpeg | null = null;
  try { thumb = await toJpeg(p, thumbSide, 0.8); } catch { thumb = null; }
  return { full, thumb };
}

function webDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** One photo: share sheet on phones ("Save Image" puts it in Photos), a normal download on the web. */
export async function savePhoto(url: string, name: string): Promise<void> {
  if (Platform.OS === 'web') {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Download failed.');
    webDownload(await r.blob(), name);
    return;
  }
  const file = await File.downloadFileAsync(url, new File(Paths.cache, name), { idempotent: true });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Save photo' });
}

/** Several photos as one ZIP file (no recompression — JPEGs are already compressed). */
export async function saveZip(entries: { url: string; name: string }[], zipName: string, onProgress?: (done: number) => void): Promise<{ saved: number; failed: number }> {
  const files: Record<string, Uint8Array> = {};
  let done = 0, failed = 0;
  for (const e of entries) {
    try {
      const r = await fetch(e.url);
      if (!r.ok) throw new Error(String(r.status));
      files[e.name] = new Uint8Array(await r.arrayBuffer());
    } catch { failed++; }
    done++; onProgress?.(done);
  }
  const names = Object.keys(files);
  if (!names.length) return { saved: 0, failed };
  const zipped = zipSync(files, { level: 0 });
  if (Platform.OS === 'web') {
    webDownload(new Blob([zipped as BlobPart], { type: 'application/zip' }), zipName);
  } else {
    const out = new File(Paths.cache, zipName);
    if (out.exists) out.delete();
    out.create();
    out.write(zipped);
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(out.uri, { mimeType: 'application/zip', UTI: 'public.zip-archive', dialogTitle: 'Save your photos' });
  }
  return { saved: names.length, failed };
}
