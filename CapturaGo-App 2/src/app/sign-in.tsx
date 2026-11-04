import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { color, space } from '../theme';
import { Button, Checkbox, Chip, Field, Txt, useToast } from '../components/ui';
import { api } from '../lib/api';
import { SITE_URL } from '../lib/config';
import { firstName, friendlyAuthError, isEmail } from '../lib/logic';

type Mode = 'signin' | 'signup' | 'forgot';

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchTo = (m: Mode) => { setMode(m); setError(null); setSuccess(null); };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function submit() {
    setError(null); setSuccess(null);
    const mail = email.trim();
    if (!isEmail(mail)) { setError('Please enter a valid email.'); return; }
    if (mode === 'signin') {
      if (!password) { setError('Please enter your password.'); return; }
      setBusy(true);
      const { error: err } = await api.auth.signIn(mail, password);
      setBusy(false);
      if (err) { setError(friendlyAuthError(err.message)); return; }
      toast('Welcome back! 👋', 'success'); close();
    } else if (mode === 'signup') {
      if (!name.trim()) { setError('Please enter your name.'); return; }
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (!consent) { setError('Please confirm you are 18+ and accept the Terms and Privacy Policy.'); return; }
      setBusy(true);
      const { data, error: err } = await api.auth.signUp(mail, password, name.trim());
      setBusy(false);
      if (err) { setError(friendlyAuthError(err.message)); return; }
      if (data?.session) { toast(`Welcome to CapturaGo, ${firstName(name)}! 🎉`, 'success'); close(); }
      else {
        // Email confirmation is on: switch to sign-in and explain the next step
        setPassword(''); setMode('signin');
        setSuccess("Almost done! We sent a confirmation link to your email. Open it, then sign in here. (Check spam if you don't see it.)");
      }
    } else {
      setBusy(true);
      const { error: err } = await api.auth.resetPassword(mail);
      setBusy(false);
      if (err) { setError(friendlyAuthError(err.message)); return; }
      setSuccess("If there's an account for this email, we've sent a reset link. Open it to choose a new password.");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {mode !== 'forgot' && (
          <View style={{ flexDirection: 'row', marginBottom: space.xl }}>
            <Chip testID="mode-signin" label="Sign in" active={mode === 'signin'} onPress={() => switchTo('signin')} />
            <Chip testID="mode-signup" label="Create account" active={mode === 'signup'} onPress={() => switchTo('signup')} />
          </View>
        )}
        <Txt v="h1">{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</Txt>
        <Txt v="muted" style={{ marginTop: 4, marginBottom: space.xl }}>
          {mode === 'signin' ? 'Sign in to your CapturaGo account.' : mode === 'signup' ? 'Book creators, save favourites and track your bookings.' : "Enter your email and we'll send you a link."}
        </Txt>
        {mode === 'signup' && <Field testID="su-name" label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />}
        <Field testID="auth-email" label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          autoComplete="email" textContentType={mode === 'signup' ? 'username' : 'emailAddress'} />
        {mode !== 'forgot' && (
          <Field testID="auth-password" label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined} />
        )}
        {mode === 'signup' && (
          <Checkbox testID="su-consent" checked={consent} onChange={setConsent} label={
            <Txt v="muted">I’m 18 or older and accept the{' '}
              <Txt v="link" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/terms.html`)}>Terms</Txt> and{' '}
              <Txt v="link" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/privacy.html`)}>Privacy Policy</Txt>.</Txt>
          } />
        )}
        {error ? <Txt testID="auth-error" v="body" style={{ color: color.err, marginTop: space.sm }}>{error}</Txt> : null}
        {success ? <Txt testID="auth-success" v="body" style={{ color: color.ok, marginTop: space.sm }}>{success}</Txt> : null}
        <Button testID="auth-submit" title={mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'} onPress={submit} loading={busy} style={{ marginTop: space.lg }} />
        {mode === 'signin' && <Button testID="forgot" title="Forgot password?" kind="ghost" small onPress={() => switchTo('forgot')} style={{ marginTop: space.sm }} />}
        {mode === 'forgot' && <Button title="Back to sign in" kind="ghost" small onPress={() => switchTo('signin')} style={{ marginTop: space.sm }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
