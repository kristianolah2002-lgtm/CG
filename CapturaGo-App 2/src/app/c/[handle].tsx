// Personal booking link: capturago.com/c/<name> or capturago://c/<name> → the creator's profile.
import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Empty, Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { HANDLE_RE } from '../../lib/logic';
import { setRef } from '../../lib/ref';

export default function HandleScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const h = String(handle ?? '').toLowerCase();
    if (!HANDLE_RE.test(h)) { setMissing(true); return; } // eslint-disable-line react-hooks/set-state-in-effect
    let alive = true;
    api.listings.byHandle(h).then(async ({ data }) => {
      if (!alive) return;
      if (!data) { setMissing(true); return; }
      await setRef(data.id);
      router.replace({ pathname: '/creator/[id]', params: { id: data.id } });
    });
    return () => { alive = false; };
  }, [handle]);
  if (missing) return <Empty title="Creator not found" text="This link may have changed. Browse all creators instead." action="Explore creators" onAction={() => router.replace('/')} />;
  return <Loading />;
}
