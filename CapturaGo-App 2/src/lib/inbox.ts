// Shared inbox state: the conversation list + unread badge, kept fresh by live updates
// (Supabase Realtime) with a periodic refresh as a fallback. One subscription for the whole app.
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { api } from './api';
import { unreadCount, type Conversation } from './chat-logic';

interface InboxState { list: Conversation[] | null; error: boolean; unread: number }
let state: InboxState = { list: null, error: false, unread: 0 };
let uid: string | null = null;
let channel: RealtimeChannel | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function refreshInbox(): Promise<void> {
  if (!uid) return Promise.resolve();
  if (inflight) return inflight;
  const me = uid;
  inflight = api.chat.list().then(({ data, error }) => {
    if (uid !== me) return;                                   // signed out meanwhile
    if (error) { state = { ...state, error: true }; emit(); return; }
    const list = data ?? [];
    state = { list, error: false, unread: unreadCount(list, me) };
    emit();
  }).finally(() => { inflight = null; });
  return inflight;
}

/** Locally mark a conversation as read right away (the server is updated by the chat screen). */
export function markReadLocally(id: string) {
  if (!state.list || !uid) return;
  const now = new Date().toISOString();
  const list = state.list.map((c) => (c.id !== id ? c : uid === c.client_user_id ? { ...c, client_read_at: now } : { ...c, creator_read_at: now }));
  state = { ...state, list, unread: unreadCount(list, uid) };
  emit();
}

/** Called by the tab layout whenever the signed-in user changes. */
export function startInbox(userId: string | null) {
  if (userId === uid) return;
  if (channel) { supabase.removeChannel(channel).catch(() => {}); channel = null; }
  if (timer) { clearInterval(timer); timer = null; }
  uid = userId;
  state = { list: null, error: false, unread: 0 };
  emit();
  if (!userId) return;
  refreshInbox();
  try {
    // RLS on the server makes sure only conversations you're part of are delivered.
    channel = supabase.channel(`inbox-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => { refreshInbox(); })
      .subscribe();
  } catch { /* live updates unavailable — the periodic refresh still works */ }
  timer = setInterval(() => { if (AppState.currentState === 'active') refreshInbox(); }, 30000);
}

AppState.addEventListener('change', (s) => { if (s === 'active') refreshInbox(); });

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const snapshot = () => state;
export function useInbox(): InboxState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
