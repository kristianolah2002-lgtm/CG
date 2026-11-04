import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { color, font, radius, space, TOUCH } from '../../theme';
import { confirmAsync, Empty, Loading, MenuSheet, PromptModal, Txt, useToast, type MenuItem, TText } from '../../components/ui';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { markReadLocally, refreshInbox } from '../../lib/inbox';
import { goToTab } from '../../lib/nav';
import { DEFAULT_TEMPLATES, fillTemplate, type ReplyTemplate } from '../../lib/reply-logic';
import {
  bubbleTime, chatRows, looksOffPlatform, mergeMessages, MSG_MAX, otherParty, prepareMessage,
  type ChatMessage, type ChatRow, type Conversation,
} from '../../lib/chat-logic';
import { tr as trx } from '../../lib/i18n';

let localSeq = 0;
/** Temporary id for a message that is still being sent. */
const localId = () => `local-${Date.now()}-${++localSeq}`;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const convId = String(id ?? '');
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [conv, setConv] = useState<Conversation | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [tipHidden, setTipHidden] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [templates, setTemplates] = useState<ReplyTemplate[] | null>(null);
  // Translations of incoming messages: id → { text, show } (cached on the server too)
  const [tr, setTr] = useState<Record<string, { text?: string; show?: boolean; loading?: boolean }>>({});
  const msgsRef = useRef<ChatMessage[]>([]);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  const focused = useRef(false);

  const loadConv = useCallback(async () => {
    const { data, error } = await api.chat.get(convId);
    if (error) { setLoadError(true); return; }
    setLoadError(false);
    setConv(data ?? null);
  }, [convId]);

  /** Fetch new messages (all on first load, then only newer ones). */
  const loadMessages = useCallback(async (full = false) => {
    const sent = msgsRef.current.filter((m) => !m.pending && !m.failed);
    const after = full || !sent.length ? undefined : sent[sent.length - 1].created_at;
    const { data, error } = await api.chat.messages(convId, after);
    if (error) { if (full) setLoadError(true); return; }
    if (data && data.length) setMsgs((cur) => mergeMessages(cur, data));
    if (data && data.some((m) => m.sender_id !== user?.id) && focused.current) {
      api.chat.markRead(convId); markReadLocally(convId);
    }
  }, [convId, user?.id]);

  // First load (async: state is only set once the requests finish)
  useEffect(() => { loadConv(); loadMessages(true); }, [loadConv, loadMessages]); // eslint-disable-line react-hooks/set-state-in-effect

  // While the chat is open: mark read, live updates, and a refresh every 8 s as a fallback
  useFocusEffect(useCallback(() => {
    focused.current = true;
    api.chat.markRead(convId).then(() => refreshInbox()); markReadLocally(convId);
    let channel: RealtimeChannel | null = null;
    try {
      channel = supabase.channel(`chat-${convId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` }, (p) => {
          const m = p.new as ChatMessage;
          setMsgs((cur) => mergeMessages(cur, [m]));
          if (m.sender_id !== user?.id) { api.chat.markRead(convId); markReadLocally(convId); }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${convId}` }, (p) => {
          setConv((c) => (c ? { ...c, ...(p.new as Partial<Conversation>) } : c));
        })
        .subscribe();
    } catch { /* the polling below still keeps the chat fresh */ }
    const t = setInterval(() => { loadMessages(); }, 8000);
    return () => {
      focused.current = false;
      clearInterval(t);
      if (channel) supabase.removeChannel(channel).catch(() => {});
    };
  }, [convId, loadMessages, user?.id]));

  // My quick replies (reloaded when coming back from the editor)
  useFocusEffect(useCallback(() => { api.templates.list().then(({ data }) => setTemplates(data ?? [])); }, []));

  const rows = useMemo(() => (user ? chatRows(msgs, user.id) : []), [msgs, user]);
  const showTip = !tipHidden && msgs.slice(-40).some((m) => looksOffPlatform(m.body));

  if (!user) return <Empty title="Sign in to see messages" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (loadError && conv === undefined) return <Empty title="Couldn't load this conversation" text="Check your connection and try again." action="Try again" onAction={() => { loadConv(); loadMessages(true); }} />;
  if (conv === undefined) return <Loading />;
  if (conv === null) return <Empty title="Conversation not found" text="It may have been deleted." action="Back to messages" onAction={() => goToTab('/messages')} />;

  const other = otherParty(conv, user.id);
  const blocked = !!conv.blocked_by;
  const iBlocked = conv.blocked_by === user.id;

  async function send(retry?: ChatMessage) {
    const prepared = prepareMessage(retry ? retry.body : text);
    if ('error' in prepared) { toast(prepared.error); return; }
    const temp: ChatMessage = retry
      ? { ...retry, pending: true, failed: false }
      : { id: localId(), conversation_id: convId, sender_id: user!.id, body: prepared.text, created_at: new Date().toISOString(), pending: true };
    setMsgs((cur) => [...cur.filter((m) => m.id !== temp.id), temp]);
    if (!retry) setText('');
    const { data, error } = await api.chat.send(convId, prepared.text);
    if (error || !data) {
      setMsgs((cur) => cur.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      const msg = error?.message || '';
      toast(/fast|wait a minute/i.test(msg) ? msg : /row-level|permission|policy/i.test(msg) ? 'This conversation is closed.' : "Couldn't send. Tap the message to try again.", 'error');
      if (/row-level|permission|policy/i.test(msg)) loadConv();
      return;
    }
    setMsgs((cur) => mergeMessages(cur.filter((m) => m.id !== temp.id), [data]));
    refreshInbox();
  }

  async function toggleBlock() {
    if (!iBlocked && !(await confirmAsync(`Block ${other.name}?`, 'Neither of you will be able to send messages in this conversation. You can unblock later.', 'Block', true))) return;
    const { error } = await api.chat.block(convId, !iBlocked);
    if (error) { toast('Something went wrong. Please try again.', 'error'); return; }
    toast(iBlocked ? 'Unblocked.' : 'Blocked. They can no longer message you here.', 'success');
    loadConv(); refreshInbox();
  }

  const menuItems: MenuItem[] = [
    ...(other.role === 'creator' ? [{ label: 'View profile', testID: 'menu-profile', onPress: () => router.push({ pathname: '/creator/[id]', params: { id: conv.photographer_id } }) }] : []),
    ...(!blocked || iBlocked ? [{ label: iBlocked ? 'Unblock' : `Block ${other.name}`, testID: 'menu-block', destructive: !iBlocked, onPress: toggleBlock }] : []),
    { label: 'Report this conversation', testID: 'menu-report', destructive: true, onPress: () => setReporting(true) },
  ];

  async function translate(messageId: string) {
    const cur = tr[messageId];
    if (cur?.loading) return;
    if (cur?.text) { setTr((x) => ({ ...x, [messageId]: { ...cur, show: !cur.show } })); return; }
    setTr((x) => ({ ...x, [messageId]: { loading: true } }));
    const lang = (Intl.DateTimeFormat().resolvedOptions().locale || 'en').slice(0, 2).toLowerCase();
    const { data, error } = await api.chat.translate(messageId, lang);
    if (error || !data?.text) {
      setTr((x) => { const n = { ...x }; delete n[messageId]; return n; });
      toast(error?.message || 'Translation is not available right now.', 'error');
      return;
    }
    setTr((x) => ({ ...x, [messageId]: { text: data.text, show: true } }));
  }

  const renderRow = ({ item }: { item: ChatRow }) => {
    if (item.kind === 'day') return <TText style={s.day}>{item.label}</TText>;
    const { m, mine, first } = item;
    const shown = !mine && tr[m.id]?.show;
    return (
      <View style={[s.bubbleWrap, mine ? s.right : s.left, first && { marginTop: space.sm }]}>
        <Pressable testID={m.failed ? 'msg-failed' : undefined} disabled={!m.failed} onPress={() => send(m)}
          accessibilityRole={m.failed ? 'button' : undefined}
          accessibilityLabel={trx(`${mine ? 'You' : other.name}: ${shown ? tr[m.id].text : m.body}${m.failed ? '. Not sent, tap to retry' : ''}`)}
          style={[s.bubble, mine ? s.mine : s.theirs, m.failed && s.failedBubble]}>
          <Text style={[s.body, mine && { color: color.onClay }, shown && { fontStyle: 'italic' }]} selectable>{shown ? tr[m.id].text : m.body}</Text>
        </Pressable>
        <View style={[s.metaRow, mine && { justifyContent: 'flex-end' }]}>
          <TText style={s.meta}>{m.failed ? 'Not sent · tap to retry' : m.pending ? 'Sending…' : bubbleTime(m.created_at)}{shown ? ' · Translated' : ''}</TText>
          {!mine && !m.pending && !m.failed ? (
            <Pressable testID={`tr-${m.id}`} onPress={() => translate(m.id)} hitSlop={8} accessibilityRole="button"
              accessibilityLabel={trx(tr[m.id]?.show ? 'Show the original message' : 'Translate this message')}>
              <TText style={s.trLink}>{tr[m.id]?.loading ? 'Translating…' : shown ? 'Show original' : 'Translate'}</TText>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : goToTab('/messages'))} hitSlop={8} accessibilityRole="button" accessibilityLabel={trx("Back")} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={color.clay} />
        </Pressable>
        <Pressable style={{ flex: 1, minWidth: 0 }} disabled={other.role !== 'creator'} accessibilityRole={other.role === 'creator' ? 'button' : undefined}
          onPress={() => router.push({ pathname: '/creator/[id]', params: { id: conv.photographer_id } })}>
          <Text style={s.title} numberOfLines={1} testID="chat-title">{other.name}</Text>
          <TText style={s.subtitle} numberOfLines={1}>{other.role === 'creator' ? `Creator${other.city ? ` · ${other.city}` : ''}` : 'Traveller'}</TText>
        </Pressable>
        <Pressable testID="chat-menu" onPress={() => setMenu(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={trx("More options")} style={s.iconBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={color.text} />
        </Pressable>
      </View>

      <FlatList
        testID="chat-list"
        inverted
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        extraData={tr}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.md, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          <View style={s.intro}>
            <Ionicons name="lock-closed" size={16} color={color.muted} />
            <Txt v="small" style={{ flex: 1 }}>Only you and {other.name} can read this conversation. Never pay outside CapturaGo — bookings paid here are protected.</Txt>
          </View>
        }
      />

      {showTip && (
        <View style={s.tip} testID="safety-tip">
          <Txt v="small" style={{ flex: 1, color: color.text }}>🛡️ Payments by PayPal, bank transfer, cash or chat apps aren’t protected. Book through CapturaGo so your money is held safely until the shoot.</Txt>
          <Pressable onPress={() => setTipHidden(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={trx("Hide tip")}><Ionicons name="close" size={18} color={color.muted} /></Pressable>
        </View>
      )}

      {blocked ? (
        <View style={[s.closed, { paddingBottom: insets.bottom + space.md }]} testID="chat-blocked">
          <Txt v="muted" style={{ textAlign: 'center' }}>{iBlocked ? `You blocked ${other.name}. ` : 'This conversation is closed. '}</Txt>
          {iBlocked ? <Pressable onPress={toggleBlock} accessibilityRole="button" hitSlop={6}><TText style={s.link}>Unblock</TText></Pressable> : null}
        </View>
      ) : (
        <View>
        {quickOpen && (
          <View style={s.quick} testID="quick-panel">
            <View style={s.quickRow}>
              {(templates && templates.length ? templates.map((t) => [t.title, t.body] as [string, string]) : DEFAULT_TEMPLATES[other.role === 'traveller' ? 'creator' : 'traveller']).map(([title, body], i) => (
                <Pressable key={`${title}-${i}`} testID={`quick-${i}`} onPress={() => { setText(fillTemplate(body, other.name).slice(0, MSG_MAX)); setQuickOpen(false); }}
                  accessibilityRole="button" accessibilityLabel={trx(`Insert quick reply: ${title}`)} style={({ pressed }) => [s.quickChip, pressed && { opacity: 0.7 }]}>
                  <Text style={s.quickChipText} numberOfLines={1}>{title}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable testID="quick-manage" onPress={() => { setQuickOpen(false); router.push('/templates'); }} accessibilityRole="button" hitSlop={6}>
              <TText style={s.link}>{templates && templates.length ? 'Edit quick replies' : '+ Save your own quick replies'}</TText>
            </Pressable>
          </View>
        )}
        <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
          <Pressable testID="quick-btn" onPress={() => setQuickOpen(!quickOpen)} accessibilityRole="button" accessibilityLabel={trx("Quick replies")}
            accessibilityState={{ expanded: quickOpen }} style={[s.quickBtn, quickOpen && { borderColor: color.clay }]}>
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </Pressable>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder={trx("Write a message…")}
            placeholderTextColor={color.dim}
            multiline
            maxLength={MSG_MAX}
            accessibilityLabel={trx("Message")}
            style={s.input}
          />
          <Pressable testID="chat-send" onPress={() => send()} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel={trx("Send")}
            style={({ pressed }) => [s.send, !text.trim() && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.94 }] }]}>
            {msgs.some((m) => m.pending) ? <ActivityIndicator color={color.onClay} size="small" /> : <Ionicons name="arrow-up" size={22} color={color.onClay} />}
          </Pressable>
        </View>
        </View>
      )}

      <MenuSheet visible={menu} title={other.name} items={menuItems} onClose={() => setMenu(false)} />
      <PromptModal
        visible={reporting}
        title="Report this conversation"
        message="Tell us what happened. Our team will read this conversation to investigate — they can't see it otherwise."
        label="What's wrong?"
        multiline
        confirmLabel="Send report"
        validate={(v) => (v.length >= 3 ? null : 'Please describe the problem in a few words.')}
        onCancel={() => setReporting(false)}
        onSubmit={async (v) => {
          setReporting(false);
          const { error } = await api.chat.report(convId, v.slice(0, 500));
          if (error) { toast(error.message || 'Could not send the report.', 'error'); return; }
          toast('Thanks — we’ll review it within 48 hours.', 'success');
          if (!blocked && (await confirmAsync(`Also block ${other.name}?`, 'They won’t be able to message you here.', 'Block', true))) {
            await api.chat.block(convId, true); loadConv(); refreshInbox();
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm, backgroundColor: color.canvas, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bold, fontSize: 17, color: color.text },
  subtitle: { fontFamily: font.body, fontSize: 12, color: color.dim },
  day: { alignSelf: 'center', fontFamily: font.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: color.dim, marginVertical: space.md },
  bubbleWrap: { maxWidth: '82%', marginTop: 3 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  mine: { backgroundColor: color.clay, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: color.card, borderWidth: 1, borderColor: color.border, borderBottomLeftRadius: 6 },
  failedBubble: { opacity: 0.6, borderWidth: 1, borderColor: color.err },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 21, color: color.text },
  meta: { fontFamily: font.body, fontSize: 11, color: color.dim, marginTop: 2, marginHorizontal: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trLink: { fontFamily: font.bold, fontSize: 11, color: color.clay, marginTop: 2, textDecorationLine: 'underline' },
  intro: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', backgroundColor: color.sand, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  quick: { backgroundColor: color.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border, paddingHorizontal: space.md, paddingTop: space.sm, gap: space.sm },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quickChip: { borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, backgroundColor: color.input, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', maxWidth: '100%' },
  quickChipText: { fontFamily: font.body, fontSize: 14, color: color.text },
  quickBtn: { width: TOUCH - 4, height: TOUCH - 4, borderRadius: 22, borderWidth: 1, borderColor: color.border, backgroundColor: color.input, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', backgroundColor: '#FFF4D6', borderTopWidth: 1, borderTopColor: 'rgba(36,26,16,0.08)', paddingHorizontal: space.lg, paddingVertical: space.sm },
  closed: { paddingTop: space.md, paddingHorizontal: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border, backgroundColor: color.card, alignItems: 'center' },
  link: { fontFamily: font.bold, fontSize: 14, color: color.clay, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, backgroundColor: color.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  input: { flex: 1, minHeight: 44, maxHeight: 140, borderRadius: 22, borderWidth: 1, borderColor: color.border, backgroundColor: color.input, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: font.body, fontSize: 16, color: color.text },
  send: { width: TOUCH - 4, height: TOUCH - 4, borderRadius: 22, backgroundColor: color.clay, alignItems: 'center', justifyContent: 'center' },
});
