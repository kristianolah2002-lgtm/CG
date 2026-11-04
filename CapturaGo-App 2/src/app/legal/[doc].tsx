import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { color, font, radius, space } from '../../theme';
import { Empty, Txt } from '../../components/ui';
import { privacy, terms, type LegalBlock } from '../../lib/legal-data';

const DOCS: Record<string, { title: string; blocks: LegalBlock[] }> = {
  privacy: { title: 'Privacy Policy', blocks: privacy },
  terms: { title: 'Terms of Service', blocks: terms },
};

/** Emails and web addresses inside the text become tappable. */
const LINK = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|https?:\/\/[^\s)]+|capturago\.com(?:\/[^\s),]*)?)/g;
function Rich({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const parts = text.split(LINK);
  return (
    <Text style={style}>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p;
        const url = p.includes('@') && !p.startsWith('http') ? `mailto:${p}` : p.startsWith('http') ? p : `https://${p}`;
        return <Text key={i} style={s.link} onPress={() => Linking.openURL(url)} accessibilityRole="link">{p}</Text>;
      })}
    </Text>
  );
}

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = DOCS[String(doc)];
  if (!d) return <Empty title="Page not found" />;
  return (
    <>
      <Stack.Screen options={{ title: d.title }} />
      <ScrollView testID={`legal-${doc}`} style={{ backgroundColor: color.canvas }} contentContainerStyle={{ padding: space.lg, paddingBottom: 56 }}>
        {d.blocks.map((b, i) => {
          if (b.t === 'row') {
            return (
              <View key={i} style={s.row}>
                {b.cells.map((c, j) => (
                  <View key={j} style={{ marginTop: j ? space.sm : 0 }}>
                    {b.heads[j] ? <Text style={s.head}>{b.heads[j]}</Text> : null}
                    <Rich text={c} style={j === 0 ? s.rowMain : s.rowText} />
                  </View>
                ))}
              </View>
            );
          }
          switch (b.t) {
            case 'h1': return <Txt key={i} v="h1">{b.text}</Txt>;
            case 'updated': return <Txt key={i} v="small" style={{ marginTop: 4, marginBottom: space.md }}>{b.text}</Txt>;
            case 'h2': return <Txt key={i} v="h2" style={{ marginTop: space.xl, marginBottom: space.sm }}>{b.text}</Txt>;
            case 'h3': return <Txt key={i} v="h3" style={{ marginTop: space.lg, marginBottom: 4 }}>{b.text}</Txt>;
            case 'li': return <View key={i} style={s.li}><Text style={s.bullet}>•</Text><Rich text={b.text} style={s.p} /></View>;
            case 'callout': return <View key={i} style={s.callout}><Rich text={b.text} style={s.p} /></View>;
            default: return <Rich key={i} text={b.text} style={[s.p, { marginBottom: space.md }]} />;
          }
        })}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  p: { fontFamily: font.body, fontSize: 15, lineHeight: 23, color: color.text, flex: 1 },
  link: { color: color.clay, textDecorationLine: 'underline' },
  li: { flexDirection: 'row', gap: space.sm, marginBottom: 6, paddingRight: space.sm },
  bullet: { fontFamily: font.bold, fontSize: 15, lineHeight: 23, color: color.clay },
  callout: { backgroundColor: color.sand, borderRadius: radius.md, padding: space.lg, marginBottom: space.md },
  row: { backgroundColor: color.card, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.lg, marginBottom: space.md },
  head: { fontFamily: font.bold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: color.dim, marginBottom: 2 },
  rowMain: { fontFamily: font.bold, fontSize: 15, lineHeight: 22, color: color.text },
  rowText: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: color.muted },
});
