import React, { useEffect } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font } from '../../theme';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { needsAction } from '../../lib/logic';
import { setBookingBadge, useBookingBadge } from '../../lib/badge';
import { startInbox, useInbox } from '../../lib/inbox';
import { tr } from '../../lib/i18n';

export default function TabsLayout() {
  const { user } = useAuth();
  const badge = useBookingBadge();
  const insets = useSafeAreaInsets();
  const inbox = useInbox();

  useEffect(() => { startInbox(user?.id ?? null); }, [user?.id]);

  useEffect(() => {
    let alive = true;
    if (!user) { setBookingBadge(0); return; }
    api.bookings.list().then(({ data }) => { if (alive && data) setBookingBadge(needsAction(data, user.id)); });
    return () => { alive = false; };
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.clay,
        tabBarInactiveTintColor: color.dim,
        // Room for icon + label, plus the phone's own bottom safe area (home indicator / gesture bar)
        tabBarStyle: { backgroundColor: color.card, borderTopColor: color.border, height: 66 + insets.bottom, paddingTop: 6, paddingBottom: 6 + insets.bottom },
        // Fixed line height and no shrinking, so the label is never cut off under the icon
        tabBarLabelStyle: { fontFamily: font.body, fontSize: 12, lineHeight: 16, flexShrink: 0 },
        sceneStyle: { backgroundColor: color.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: tr('Explore'),
        tabBarIcon: ({ focused, color: c, size }) => <Ionicons name={focused ? 'compass' : 'compass-outline'} size={size} color={c} />,
      }} />
      <Tabs.Screen name="messages" options={{
        title: tr('Messages'),
        tabBarBadge: inbox.unread > 0 ? inbox.unread : undefined,
        tabBarBadgeStyle: { backgroundColor: color.clay, color: color.onClay, fontFamily: font.bold },
        tabBarIcon: ({ focused, color: c, size }) => <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={size} color={c} />,
      }} />
      <Tabs.Screen name="bookings" options={{
        title: tr('Bookings'),
        tabBarBadge: badge > 0 ? badge : undefined,
        tabBarBadgeStyle: { backgroundColor: color.clay, color: color.onClay, fontFamily: font.bold },
        tabBarIcon: ({ focused, color: c, size }) => <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={c} />,
      }} />
      <Tabs.Screen name="account" options={{
        title: tr('Account'),
        tabBarIcon: ({ focused, color: c, size }) => <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size} color={c} />,
      }} />
    </Tabs>
  );
}
