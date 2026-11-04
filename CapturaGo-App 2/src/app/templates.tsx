// Quick replies: save the answers you send often. {name} becomes the other person's first name. Only you can see them.
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { color, radius, space } from '../theme';
import { Button, Card, confirmAsync, Empty, Field, Loading, Txt, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TEMPLATE_MAX, templateProblem, type ReplyTemplate } from '../lib/reply-logic';
import { tr as trx } from '../lib/i18n';

export default function TemplatesScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<ReplyTemplate[] | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { const { data } = await api.templates.list(); setList(data ?? []); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) return <Empty title="Sign in first" action="Sign in" onAction={() => router.push('/sign-in')} />;
  if (!list) return <Loading />;

  const reset = () => { setEditId(null); setTitle(''); setBody(''); };
  async function save() {
    const problem = templateProblem(title, body);
    if (problem) { toast(problem, 'error'); return; }
    setSaving(true);
    const { error } = editId ? await api.templates.update(editId, title.trim(), body.trim()) : await api.templates.add(title.trim(), body.trim());
    setSaving(false);
    if (error) { toast(error.message || 'Could not save it.', 'error'); return; }
    toast('Saved ✓', 'success');
    reset(); load();
  }
  async function remove(t: ReplyTemplate) {
    if (!(await confirmAsync(`Delete “${t.title}”?`, 'This quick reply will be removed.', 'Delete', true))) return;
    const { error } = await api.templates.remove(t.id);
    if (error) { toast('Could not delete it.', 'error'); return; }
    if (editId === t.id) reset();
    load();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled" testID="templates">
        <Txt v="muted">Save the answers you send often and insert them with ⚡ in any chat. <Txt v="h3">{'{name}'}</Txt> becomes the other person’s first name. Only you can see them — up to {TEMPLATE_MAX}.</Txt>
        <View style={{ marginTop: space.lg, gap: space.md }}>
          {list.length === 0 ? <Txt v="small" testID="templates-none">No quick replies yet.</Txt> : list.map((t) => (
            <Card key={t.id} testID={`tpl-${t.id}`} style={editId === t.id ? s.editing : undefined}>
              <Txt v="h3">{t.title}</Txt>
              <Txt v="muted" style={{ marginTop: 2 }}>{t.body}</Txt>
              <View style={s.row}>
                <Button testID={`tpl-edit-${t.id}`} title="Edit" kind="ghost" small onPress={() => { setEditId(t.id); setTitle(t.title); setBody(t.body); }} style={s.inline} />
                <Button testID={`tpl-del-${t.id}`} title="Delete" kind="ghost" small onPress={() => remove(t)} style={s.inline} />
              </View>
            </Card>
          ))}
        </View>
        <Card style={{ marginTop: space.xl }} testID="template-form">
          <Txt v="h3" style={{ marginBottom: space.md }}>{editId ? 'Edit quick reply' : 'New quick reply'}</Txt>
          <Field testID="tpl-title" label="Name" value={title} onChangeText={(v) => setTitle(v.slice(0, 40))} maxLength={40} placeholder={trx("e.g. Thanks!")} />
          <Field testID="tpl-body" label="Message" value={body} onChangeText={(v) => setBody(v.slice(0, 1000))} maxLength={1000} multiline placeholder={trx("Hi {name}, thanks for your message! …")} />
          <Button testID="tpl-save" title={editId ? 'Save changes' : 'Save quick reply'} onPress={save} loading={saving} />
          {editId ? <Button title="Cancel" kind="ghost" small onPress={reset} style={{ alignSelf: 'center', marginTop: space.sm }} /> : null}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  inline: { paddingHorizontal: 0, minHeight: 36 },
  editing: { borderColor: color.clay, borderRadius: radius.lg },
});
