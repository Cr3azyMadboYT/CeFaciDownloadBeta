// One short message at the bottom of the screen, for ~4 seconds.
import { useSyncExternalStore } from 'react';

let msg = '';
let t: ReturnType<typeof setTimeout> | undefined;
const subs = new Set<() => void>();
export function toast(m: string) {
  msg = m; subs.forEach((f) => f());
  clearTimeout(t);
  t = setTimeout(() => { msg = ''; subs.forEach((f) => f()); }, 4200);
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useToast = () => useSyncExternalStore(subscribe, () => msg, () => msg);
