// Push notifications on this phone: booking news, "Notify me" alerts and "New message from …" (never the text).
// The phone's Expo push token is saved for the signed-in account (register_push_token) and removed when the user
// turns notifications off or signs out. Taps open the right screen (push-logic routeFor). Not on the web.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { api } from './api';
import { routeFor, validPushToken } from './push-logic';

const TOKEN_KEY = 'cg_push_token';
const OFF_KEY = 'cg_push_off';   // "1" = the user turned notifications off on this phone
export type PushState = 'on' | 'off' | 'denied' | 'unsupported';

// (The web build uses push.web.ts instead: no notifications there.)
export const pushSupported = () => Platform.OS !== 'web' && Device.isDevice;

// While the app is open: still show it (a new message while you're on another screen)
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function get(key: string): Promise<string | null> { try { return await AsyncStorage.getItem(key); } catch { return null; } }
async function put(key: string, v: string | null) { try { if (v === null) await AsyncStorage.removeItem(key); else await AsyncStorage.setItem(key, v); } catch { /* storage unavailable */ } }

/** Ask (if allowed to) and save this phone's token for the signed-in account. */
export async function enablePush(ask: boolean): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'CapturaGo', importance: Notifications.AndroidImportance.HIGH });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return 'denied';
    const token = (await Notifications.getExpoPushTokenAsync()).data;   // projectId comes from app.json (extra.eas.projectId)
    if (!validPushToken(token)) return 'unsupported';
    const { error } = await api.push.register(token, Platform.OS);
    if (error) return 'unsupported';
    await put(TOKEN_KEY, token);
    await put(OFF_KEY, null);
    return 'on';
  } catch {
    return 'unsupported';   // e.g. Expo Go on Android, no EAS project id yet, offline
  }
}
/** Stop notifications on this phone. `remember` = the user chose it (stays off after the next sign-in). */
export async function disablePush(remember: boolean): Promise<void> {
  const token = await get(TOKEN_KEY);
  if (token) await api.push.unregister(token);   // needs the session: call before signing out
  await put(TOKEN_KEY, null);
  if (remember) await put(OFF_KEY, '1');
}
export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if ((await get(OFF_KEY)) === '1') return 'off';
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return perm.canAskAgain ? 'off' : 'denied';
  } catch { return 'unsupported'; }
  return (await get(TOKEN_KEY)) ? 'on' : 'off';
}

/** After sign-in: register this phone unless the user turned notifications off here. */
export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (!userId || !pushSupported()) return;
    let alive = true;
    get(OFF_KEY).then((off) => { if (alive && off !== '1') enablePush(true).catch(() => {}); });
    return () => { alive = false; };
  }, [userId]);
}
/** A tapped notification opens its screen (also when the tap started the app). */
export function usePushRouting() {
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef('');
  useEffect(() => {
    if (!last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const to = routeFor(last.notification.request.content.data);
    if (to) router.push(to);
  }, [last]);
}
