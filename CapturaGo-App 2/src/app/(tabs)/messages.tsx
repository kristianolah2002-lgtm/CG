import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { color, font, space } from '../../theme';
import { Empty, Loading, Reveal, Txt, TText } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { refreshInbox, useInbox } from '../../lib/inbox';
import { chatTime, isUnread, otherParty, type Conversation } from '../../lib/chat-logic';
import { httpsUrl } from '../../lib/logic';
import { waitingLabel } from '../../lib/reply-logic';
import { tr as trx } from '../../lib/i18n';

function Avatar({ name, uri }: { name: string; uri?: string | null }) {
  const src = uri ? httpsUrl(uri) : null;
  if (src) return <Image source={{ uri: src }} style={s.avatar} contentFit="cover" accessibilityIgnoresInvertColors />;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  return <View style={[s.avatar, s.initials]}><Text style={s.initialsText}>{initials}</Text></View>;
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { user, ready } = useAuth();
  const inbox = useInbox();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { refreshInbox(); }, []));

  if (!ready) return <Loading />;
  if (!user) return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Empty testID="messages-signed-out" title="Messages" text="Sign in to message creators and travellers — your conversations stay private between the two of you." action="Sign in" onAction={() => router.push('/sign-in')} />
    </View>
  );
  if (inbox.list === null && !inbox.error) return <Loading />;

  const renderItem = ({ item: c, index }: { item: Conversation; index: number }) => {
    const other = otherParty(c, user.id);
    const unread = isUnread(c, user.id);
    const mine = c.last_sender_id === user.id;
    const preview = c.last_message ? `${mine ? 'You: ' : ''}${c.last_message}` : 'No messages yet — say hello 👋';
    const waiting = waitingLabel(c, user.id);
    return (
      <Reveal delay={Math.min(index, 8) * 40}>
        <Pressable testID={`conv-${c.id}`} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
          accessibilityRole="button" accessibilityLabel={trx(`${other.name}${unread ? ', new message' : ''}. ${preview}`)}
          style={({ pressed }) => [s.row, pressed && { backgroundColor: color.sand }]}>
          <Avatar name={other.name} uri={other.role === 'creator' ? c.photographers?.cover_image_url : null} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.top}>
              <Text style={[s.name, unread && s.bold]} numberOfLines={1}>{other.name}</Text>
              <Text style={[s.time, unread && { color: color.clay }]}>{chatTime(c.last_message_at)}</Text>
            </View>
            <TText style={s.role} numberOfLines={1}>{other.role === 'creator' ? `Creator${other.city ? ` · ${other.city}` : ''}` : 'Traveller · your client'}{c.blocked_by ? ' · blocked' : ''}</TText>
            <View style={s.top}>
              <Text style={[s.preview, unread && s.previewUnread]} numberOfLines={1}>{preview}</Text>
              {unread ? <View style={s.dot} accessibilityLabel={trx("Unread")} /> : null}
            </View>
            {waiting ? <View style={s.waiting} testID={`waiting-${c.id}`}><TText style={s.waitingText}>⏳ {waiting}</TText></View> : null}
          </View>
        </Pressable>
      </Reveal>
    );
  };

  return (
    <FlatList
      testID="messages-list"
      style={{ backgroundColor: color.canvas }}
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: space.xxl, flexGrow: 1 }}
      data={inbox.list ?? []}
      keyExtractor={(c) => c.id}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={s.sep} />}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
          <Txt v="h1">Messages</Txt>
          <Txt v="small" style={{ marginTop: 4 }}>🔒 Private between you and the other person. Keep payments on CapturaGo — that’s what protects your money.</Txt>
        </View>
      }
      ListEmptyComponent={inbox.error
        ? <Empty title="Couldn't load messages" text="Check your connection and try again." action="Try again" onAction={() => refreshInbox()} />
        : <Empty testID="messages-empty" title="No messages yet" text="Open a creator's profile and tap “Message” to ask about dates, prices or spots." action="Explore creators" onAction={() => router.navigate('/')} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refreshInbox(); setRefreshing(false); }} tintColor={color.clay} />}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 76 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.sand },
  initials: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.clayDim },
  initialsText: { fontFamily: font.bold, fontSize: 17, color: color.clay },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontFamily: font.body, fontSize: 16, color: color.text },
  bold: { fontFamily: font.bold },
  time: { fontFamily: font.body, fontSize: 12, color: color.dim },
  role: { fontFamily: font.body, fontSize: 12, color: color.dim, marginTop: 1 },
  preview: { flex: 1, fontFamily: font.body, fontSize: 14, color: color.muted, marginTop: 2 },
  previewUnread: { color: color.text, fontFamily: font.bold },
  waiting: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: color.clayDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  waitingText: { fontFamily: font.bold, fontSize: 12, color: color.clay },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.clay },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: color.border, marginLeft: space.lg + 52 + space.md },
});
