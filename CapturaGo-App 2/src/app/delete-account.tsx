import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { color, space } from '../theme';
import { Button, Card, confirmAsync, Empty, Field, Txt, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { goToTab } from '../lib/nav';

// In-app account deletion — required by the App Store (guideline 5.1.1(v)) and Google Play.
export default function DeleteAccount() {
  const { user } = useAuth();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <Empty title="You're signed out" text="Sign in to delete your account." action="Sign in" onAction={() => router.push('/sign-in')} />;

  async function remove() {
    setError(null);
    if (typed.trim() !== 'DELETE') { setError('Type DELETE to confirm.'); return; }
    if (!(await confirmAsync('Delete your account?', "This can't be undone.", 'Delete', true))) return;
    setBusy(true);
    const { error: err } = await api.account.remove();
    if (err) { setBusy(false); setError(err.message); return; }
    await api.auth.signOut();
    setBusy(false);
    toast('Your account has been deleted.', 'success');
    goToTab('/');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Txt v="h1">Delete your account</Txt>
        <Txt v="muted" style={{ marginTop: 4 }}>Signed in as {user.email}</Txt>
        <Card style={{ marginTop: space.xl }}>
          <Txt v="h3">What is deleted</Txt>
          <Txt v="muted" style={{ marginTop: 4 }}>• Your login (email and password){'\n'}• Your creator listing, its photos, packages and spots{'\n'}• Inquiries sent to your listing, your favourites and the reviews you wrote{'\n'}• Your private conversations (they disappear for the other person too)</Txt>
          <Txt v="h3" style={{ marginTop: space.lg }}>What we keep</Txt>
          <Txt v="muted" style={{ marginTop: 4 }}>• Records of paid bookings, as accounting law requires — no longer linked to an account{'\n'}• Inquiries you sent with the old email form stay with the creators who received them</Txt>
          <Txt v="small" style={{ marginTop: space.lg }}>If you have an active booking (paid, confirmed, delivered or under review), finish or cancel it first.</Txt>
        </Card>
        <Field testID="delete-confirm" label="Type DELETE to confirm" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false}
          style={{ marginTop: space.xl }} error={error} />
        <Button testID="delete-submit" title="Permanently delete my account" kind="danger" onPress={remove} loading={busy} />
        <Txt v="small" style={{ marginTop: space.lg, color: color.dim }}>You can also delete your account at capturago.com/delete-account.html.</Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
