import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { type Lang, useLang } from './i18n';

/** Keep the account's language (used for our emails and text messages) the same as the app's — once per
 *  account and language. A language chosen in the app counts; so does the phone's language unless it is
 *  English (then the account keeps what was chosen on the website). */
export async function syncLanguage(userId: string, lang: Lang): Promise<void> {
  let chosen: string | null = null, saved: string | null = null;
  try { [chosen, saved] = await Promise.all([AsyncStorage.getItem('cg_lang'), AsyncStorage.getItem('cg_lang_saved')]); } catch { /* storage unavailable */ }
  if (!chosen && lang === 'en') return;
  if (saved === `${userId}:${lang}`) return;
  const { error } = await supabase.rpc('set_my_language', { p_lang: lang });
  if (!error) { try { await AsyncStorage.setItem('cg_lang_saved', `${userId}:${lang}`); } catch { /* next time */ } }
}

interface AuthState { user: User | null; ready: boolean }
const AuthCtx = createContext<AuthState>({ user: null, ready: false });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false });
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (alive) setState({ user: data.session?.user ?? null, ready: true }); })
      .catch(() => { if (alive) setState({ user: null, ready: true }); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setState({ user: session?.user ?? null, ready: true });
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  const lang = useLang();
  const uid = state.user?.id;
  useEffect(() => { if (uid) syncLanguage(uid, lang).catch(() => {}); }, [uid, lang]);
  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const displayName = (u: User | null) =>
  String((u?.user_metadata as { full_name?: string } | undefined)?.full_name || u?.email?.split('@')[0] || '');
