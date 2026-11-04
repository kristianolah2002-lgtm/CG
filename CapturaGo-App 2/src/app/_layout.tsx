import React, { useEffect, useState } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { AuthProvider, useAuth } from '../lib/auth';
import { usePushRegistration, usePushRouting } from '../lib/push';
import { ToastProvider } from '../components/ui';
import { color, font } from '../theme';
import { initLang, tr, useLang } from '../lib/i18n';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Push notifications: register this phone after sign-in; a tapped notification opens its screen. */
function PushBridge() {
  const { user } = useAuth();
  usePushRegistration(user?.id);
  usePushRouting();
  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ Fraunces_400Regular, Fraunces_400Regular_Italic, Inter_500Medium, Inter_600SemiBold });
  // If a font fails to load, continue with system fonts rather than staying on the splash screen
  const [langReady, setLangReady] = useState(false);
  useEffect(() => { initLang().finally(() => setLangReady(true)); }, []);
  const lang = useLang();   // the whole app is drawn again in the new language when it changes
  const ready = (loaded || !!error) && langReady;
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider key={lang}>
          <StatusBar style="dark" />
          <PushBridge />
          <Stack
            screenOptions={{
              headerTintColor: color.clay,
              headerStyle: { backgroundColor: color.canvas },
              headerTitleStyle: { fontFamily: font.bold, color: color.text },
              headerShadowVisible: false,
              headerBackTitle: tr('Back'),
              contentStyle: { backgroundColor: color.canvas },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'CapturaGo' }} />
            <Stack.Screen name="creator/[id]" options={{ title: '' }} />
            <Stack.Screen name="book/[id]" options={{ title: tr('Book') }} />
            <Stack.Screen name="chat/[id]" options={{ headerShown: false, title: tr('Chat') }} />
            <Stack.Screen name="listing" options={{ title: tr('My listing') }} />
            <Stack.Screen name="payouts" options={{ title: tr('Payouts') }} />
            <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
            <Stack.Screen name="sign-in" options={{ title: tr('Sign in'), presentation: 'modal' }} />
            <Stack.Screen name="inquiries" options={{ title: tr('Email inquiries') }} />
            <Stack.Screen name="favorites" options={{ title: tr('Favourites') }} />
            <Stack.Screen name="delete-account" options={{ title: tr('Delete account') }} />
            <Stack.Screen name="c/[handle]" options={{ title: '' }} />
            <Stack.Screen name="photos/[id]" options={{ title: tr('Photos') }} />
            <Stack.Screen name="gallery/[id]" options={{ title: tr('Your photos') }} />
            <Stack.Screen name="review/[id]" options={{ title: tr('Leave a review'), presentation: 'modal' }} />
            <Stack.Screen name="availability" options={{ title: tr('Availability') }} />
            <Stack.Screen name="link" options={{ title: tr('My booking link') }} />
            <Stack.Screen name="report/[id]" options={{ title: tr('Report'), presentation: 'modal' }} />
            <Stack.Screen name="plan/[id]" options={{ title: '' }} />
            <Stack.Screen name="share/[id]" options={{ title: tr('Share your photos') }} />
            <Stack.Screen name="earnings" options={{ title: tr('Earnings') }} />
            <Stack.Screen name="templates" options={{ title: tr('Quick replies') }} />
            <Stack.Screen name="phone" options={{ title: tr('Text reminders') }} />
            <Stack.Screen name="calendar" options={{ title: tr('Your calendar') }} />
            <Stack.Screen name="split/[id]" options={{ title: tr('Payment links') }} />
            <Stack.Screen name="requests" options={{ title: tr('Requests') }} />
            <Stack.Screen name="request-new" options={{ title: tr('Post a request') }} />
            <Stack.Screen name="offer/[id]" options={{ title: tr('Your offer') }} />
            <Stack.Screen name="deals" options={{ title: tr('Last-minute deals') }} />
            <Stack.Screen name="tax" options={{ title: tr('Tax details') }} />
          </Stack>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
