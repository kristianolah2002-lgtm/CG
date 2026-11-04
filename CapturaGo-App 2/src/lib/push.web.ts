// Web build: no push notifications (expo-notifications' native calls throw on the web). Same API as push.ts.
export type PushState = 'on' | 'off' | 'denied' | 'unsupported';
export const pushSupported = () => false;
export async function enablePush(_ask: boolean): Promise<PushState> { return 'unsupported'; }
export async function disablePush(_remember: boolean): Promise<void> { /* nothing registered on the web */ }
export async function pushState(): Promise<PushState> { return 'unsupported'; }
export function usePushRegistration(_userId: string | undefined) { /* not on the web */ }
export function usePushRouting() { /* not on the web */ }
