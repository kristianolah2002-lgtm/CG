// Tiny shared store for the Bookings tab badge (number of bookings needing the user's action).
import { useEffect, useState } from 'react';
let count = 0;
const listeners = new Set<(n: number) => void>();
export function setBookingBadge(n: number) {
  count = Math.max(0, n | 0);
  listeners.forEach((l) => l(count));
}
export function useBookingBadge() {
  const [n, setN] = useState(count);
  useEffect(() => { listeners.add(setN); return () => { listeners.delete(setN); }; }, []);
  return n;
}
