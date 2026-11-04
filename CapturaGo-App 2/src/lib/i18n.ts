/* CapturaGo in German, Spanish and French — the same dictionary as the website (built by the website's
   tools/build-i18n.py into i18n-data.ts). The screens are written in English; tr() replaces known
   interface text with its translation and leaves everything else (names, descriptions, messages) as is. */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18N_DATA } from './i18n-data';

export type Lang = 'en' | 'de' | 'es' | 'fr';
export const LANGS: [Lang, string][] = [['en', 'English'], ['de', 'Deutsch'], ['es', 'Español'], ['fr', 'Français']];
const LOCALE: Record<Lang, string> = { en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };
const KEY = 'cg_lang';

let lang: Lang = 'en';
let dict: Record<string, string> = {};
let patterns: [RegExp, string][] = [];
const listeners = new Set<(l: Lang) => void>();

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'de' || v === 'es' || v === 'fr';
// Unicode classes written the long way (some JavaScript engines on phones lack \p{…})
const LETTER = 'A-Za-zÀ-ÖØ-öø-ÿĀ-žА-я';
const UPPER = 'A-ZÀ-ÖØ-ÞĀ-Ž';
const portable = (src: string) => src.replace(/\\p\{Lu\}/g, `[${UPPER}]`).replace(/\\p\{L\}/g, `[${LETTER}]`).replace(/\\p\{N\}/g, '[0-9]')
  .replace(/\[([^\]]*)\[([^\]]+)\]([^\]]*)\]/g, '[$1$2$3]');   // a class inside a class → one class

function apply(l: Lang) {
  lang = l;
  const col = { de: 0, es: 1, fr: 2 }[l as 'de' | 'es' | 'fr'];
  dict = {};
  patterns = [];
  if (l === 'en') return;
  for (const [k, v] of Object.entries(I18N_DATA.dict)) if (v[col]) dict[k] = v[col];
  for (const [src, t] of I18N_DATA.patterns) {
    if (!t[col]) continue;
    try { patterns.push([new RegExp(`^${portable(src)}$`), t[col]]); } catch { /* a pattern this engine can't read is skipped */ }
  }
}

export const getLang = () => lang;
export const locale = () => LOCALE[lang];

/** Read the saved language (or the phone's language) once at start. */
export async function initLang(): Promise<Lang> {
  let l: Lang = 'en';
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (isLang(saved)) l = saved;
    else {
      const device = String(Intl.DateTimeFormat().resolvedOptions().locale || 'en').slice(0, 2).toLowerCase();
      if (isLang(device)) l = device;
    }
  } catch { /* storage unavailable → English */ }
  apply(l);
  return l;
}
export async function setLang(l: Lang) {
  if (!isLang(l)) return;
  try { await AsyncStorage.setItem(KEY, l); } catch { /* not saved */ }
  apply(l);
  listeners.forEach((f) => f(l));
}
/** Re-render when the language changes. */
export function useLang(): Lang {
  const [l, setL] = useState(lang);
  useEffect(() => { listeners.add(setL); return () => { listeners.delete(setL); }; }, []);
  return l;
}

/* Dates: the screens ask for English dates ('en-GB') — show them in the chosen language */
const swap = (l?: string | string[]) => (l === undefined || l === null || /^en/i.test(String(l)) ? LOCALE[lang] : l);
for (const m of ['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString'] as const) {
  const orig = Date.prototype[m] as (l?: string | string[], o?: Intl.DateTimeFormatOptions) => string;
  (Date.prototype as unknown as Record<string, unknown>)[m] = function (this: Date, l?: string | string[], o?: Intl.DateTimeFormatOptions) { return orig.call(this, swap(l), o); };
}

function core(s: string): string | null {
  const alt = s.includes('’') ? s.replace(/’/g, "'") : null;   // ’ and ' are the same
  const hit = dict[s] || (alt !== null ? dict[alt] : undefined);
  if (hit) return hit;
  const dot = s.includes(' · ');
  for (const x of alt !== null ? [s, alt] : [s]) {
    for (const [re, t] of patterns) {
      if (dot && !re.source.includes('·')) continue;   // a list "a · b" is translated piece by piece
      const m = x.match(re);
      if (m) return t.replace(/\{(\d)\}|\$(\d)/g, (_, a, b) => (a ? tr(m[+a] || '') : (m[+b] || '')));
    }
  }
  return null;
}
const LEAD = new RegExp(`^([^${LETTER}0-9<"“¿¡(]+)(.+)$`, 's');
const TRAIL = new RegExp(`^(.+?)(\\s*[→…*:]+|\\s+[^${LETTER}0-9\\s]+)$`, 's');
const PUNCT = /^(.+?)([.!?)]+)$/s;
function attempt(s: string, depth: number): string | null {
  let c = core(s);
  if (c !== null || depth > 3) return c;
  let m = s.match(LEAD);
  if (m) { c = attempt(m[2], depth + 1); if (c !== null) return m[1] + c; }
  m = s.match(TRAIL);
  if (m) { c = attempt(m[1], depth + 1); if (c !== null) return c + m[2]; }
  m = s.match(PUNCT);
  if (m) { c = core(m[1]); if (c !== null) return c + m[2]; }
  if (s.includes(' · ')) {
    const parts = s.split(' · '), out = parts.map((p) => attempt(p, depth + 1) ?? p);
    if (out.some((x, i) => x !== parts[i])) return out.join(' · ');
  }
  return null;
}
/** Translate a piece of interface text; unknown text comes back unchanged. */
export function tr(text: string): string;
export function tr(text: string | undefined | null): string | undefined | null;
export function tr(text: string | undefined | null) {
  if (lang === 'en' || !text || typeof text !== 'string' || !/[A-Za-zÀ-ÿ]{2}/.test(text)) return text;
  const lead = text.match(/^\s*/)![0], trail = text.match(/\s*$/)![0];
  const out = attempt(text.trim().replace(/\s+/g, ' '), 0);
  return out === null ? text : lead + out + trail;
}
/** Translate the children of a text element: plain strings as one sentence, mixed content piece by piece. */
export function trChildren(children: unknown): unknown {
  if (lang === 'en') return children;
  if (typeof children === 'string') return tr(children);
  if (Array.isArray(children)) {
    if (children.every((c) => typeof c === 'string' || typeof c === 'number')) return tr(children.join(''));
    return children.map((c) => (typeof c === 'string' ? tr(c) : c));
  }
  return children;
}
