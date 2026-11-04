// Report a creator's profile — or one of its photos. Reviewed by the CapturaGo team; the creator isn't told who reported.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, font, radius, space, TOUCH } from '../../theme';
import { Button, Card, Empty, Field, Txt, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { httpsUrl } from '../../lib/logic';
import { REPORT_REASONS, reportProblem } from '../../lib/plan-logic';
import { tr as trx } from '../../lib/i18n';

export default function ReportScreen() {
  const { id, photo, name } = useLocalSearchParams<{ id: string; photo?: string; name?: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const photoUrl = photo ? httpsUrl(String(photo)) : null;
  const [reason, setReason] = useState(photoUrl ? 'stolen_photos' : '');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user) return <Empty title="Sign in to report a profile" text="So our team can follow up if needed. The creator isn't told who reported them." action="Sign in" onAction={() => router.replace('/sign-in')} />;
  if (sent) {
    return <Empty testID="report-sent" title="Thank you" text="Our team reviews every report within 48 hours. The creator isn't told who reported them." action="Done" onAction={() => router.back()} />;
  }

  async function send() {
    const problem = reportProblem(reason, details);
    if (problem) { toast(problem, 'error'); return; }
    setSending(true);
    const { error } = await api.reportListing(String(id), reason, details, photoUrl);
    setSending(false);
    if (error) { toast(error.message || 'Could not send the report. Please try again.', 'error'); return; }
    toast('Report sent — thank you.', 'success');
    setSent(true);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Txt v="h1">What’s wrong?</Txt>
        <Txt v="muted" style={{ marginTop: space.sm }}>{photoUrl ? 'You’re reporting this photo' : `You’re reporting ${name ? `${name}’s profile` : 'this profile'}`}. Our team checks every report.</Txt>
        {photoUrl ? (
          <Card style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }} testID="report-photo">
            <Image source={{ uri: photoUrl }} style={s.thumb} contentFit="cover" accessibilityIgnoresInvertColors />
            <Txt v="small" style={{ flex: 1 }}>This photo</Txt>
          </Card>
        ) : null}
        <View style={{ marginTop: space.lg }} accessibilityRole="radiogroup" accessibilityLabel={trx("Reason")}>
          {REPORT_REASONS.map(([k, label]) => {
            const on = reason === k;
            return (
              <Pressable key={k} testID={`reason-${k}`} onPress={() => setReason(k)} style={[s.option, on && s.optionOn]}
                accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={trx(label)}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? color.clay : color.dim} />
                <Txt v="body" style={{ flex: 1, fontFamily: on ? font.bold : font.body }}>{label}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Field testID="report-details" label="Details (optional)" value={details} onChangeText={(v) => setDetails(v.slice(0, 1000))} multiline maxLength={1000}
          placeholder={trx("Anything that helps us check it")} style={{ marginTop: space.lg }} />
        <Button testID="report-send" title="Send report" kind="danger" onPress={send} loading={sending} />
        <Txt v="small" style={{ marginTop: space.md, textAlign: 'center' }}>The creator isn’t told who reported them. For anything urgent, email hello@capturago.com.</Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: color.sand },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.card, marginBottom: space.sm },
  optionOn: { borderColor: color.clay, backgroundColor: color.clayDim },
});
