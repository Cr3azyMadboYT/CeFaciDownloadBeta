// The season's look on the phone (src/app/season.ts), always the date's (decision Cornel, 06.10: it comes on by
// itself, nothing to set). Bilu dresses for it,
// Acasă gets what falls in it, and the app's icon follows it (setIcon, when the app goes to the background).
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { LOOKS, lookFor, type Look, type LookInfo } from '../../../src/app/season';

export { LOOKS, type Look, type LookInfo };

/** The look now (re-read when the day may have changed: each time the app comes back). */
export function useLook(): Look {
  const [, setDay] = useState(() => new Date().toDateString());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') setDay(new Date().toDateString()); });
    return () => sub.remove();
  }, []);
  return lookFor('auto');
}

type IconNative = { current(): string | null; set(name: string): Promise<boolean> };
const icon = requireOptionalNativeModule<IconNative>('CefaciIcon');

/** Android: the launcher icon for the look, changed only while the app is in the background (changing the
 *  launcher entry of a running app can close it on some phones). */
export function watchIcon() {
  if (!icon) return () => {};
  const sub = AppState.addEventListener('change', (st) => {
    if (st !== 'background') return;
    const want = LOOKS[lookFor('auto')].icon;
    try { if (icon.current() !== want) void icon.set(want).catch(() => {}); } catch { /* missing */ }
  });
  return () => sub.remove();
}
