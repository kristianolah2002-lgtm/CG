// QR code drawn with plain Views (no extra native module). Dark runs in each row are merged,
// so a typical link needs only a few hundred views.
import React, { useMemo } from 'react';
import { View } from 'react-native';
import qrcode from 'qrcode-generator';
import { tr as trx } from '../lib/i18n';

export function QrCode({ value, size = 160, fg = '#211911', bg = '#FFFFFF', testID }: { value: string; size?: number; fg?: string; bg?: string; testID?: string }) {
  const rows = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const out: { n: number; runs: [number, number][] }[] = [];
    for (let r = 0; r < n; r++) {
      const runs: [number, number][] = [];
      let c = 0;
      while (c < n) {
        if (qr.isDark(r, c)) { const s = c; while (c < n && qr.isDark(r, c)) c++; runs.push([s, c - s]); } else c++;
      }
      out.push({ n, runs });
    }
    return out;
  }, [value]);
  const n = rows.length;
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={trx(`QR code for ${value}`)}
      style={{ width: size, height: size, backgroundColor: bg, padding: cell * quiet }}>
      {rows.map((row, r) => (
        <View key={r} style={{ height: cell, flexDirection: 'row', position: 'relative' }}>
          {row.runs.map(([start, len]) => (
            <View key={start} style={{ position: 'absolute', left: start * cell, width: len * cell + 0.5, top: 0, height: cell + 0.5, backgroundColor: fg }} />
          ))}
        </View>
      ))}
    </View>
  );
}
