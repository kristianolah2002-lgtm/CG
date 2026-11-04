/* Live last-minute deals, loaded once and shared by the screens (refreshed every 5 minutes). */
import { useEffect, useState } from 'react';
import { api } from './api';
import { dealsByCreator } from './deal-logic';

type DealMap = Map<string, { day: string; pct: number }[]>;
let cache: { at: number; map: DealMap } | null = null;
let pending: Promise<DealMap> | null = null;

export function loadDeals(force = false): Promise<DealMap> {
  if (!force && cache && Date.now() - cache.at < 5 * 60000) return Promise.resolve(cache.map);
  if (!pending) {
    pending = api.deals.active()
      .then(({ data }) => { cache = { at: Date.now(), map: dealsByCreator(data ?? []) }; return cache.map; })
      .catch(() => cache?.map ?? new Map())
      .finally(() => { pending = null; });
  }
  return pending;
}
/** Deals by creator id (empty until loaded, or when none). */
export function useDeals(): DealMap {
  const [m, setM] = useState<DealMap>(() => cache?.map ?? new Map());
  useEffect(() => { let alive = true; loadDeals().then((x) => { if (alive) setM(x); }); return () => { alive = false; }; }, []);
  return m;
}
