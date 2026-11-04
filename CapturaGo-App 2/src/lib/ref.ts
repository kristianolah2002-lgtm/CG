// Remembers which creator's personal link brought the traveller here (30 days) — that creator's
// bookings get the lower link fee. Same rule as the website (localStorage "cg_ref").
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cg_ref';
const DAYS_30 = 30 * 86400000;

export async function setRef(photographerId: string): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify({ pid: photographerId, at: Date.now() })); } catch { /* storage full or unavailable */ }
}
export async function getRef(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const r = raw ? (JSON.parse(raw) as { pid?: string; at?: number }) : null;
    return r && r.pid && typeof r.at === 'number' && Date.now() - r.at < DAYS_30 ? r.pid : null;
  } catch { return null; }
}
