// The season's look on the phone (src/app/season.ts): the date's, or the one fixed in Setări. Bilu dresses for it,
// Acasă gets what falls in it, and the app's icon follows it (setIcon, when the app goes to the background).
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { LOOKS, lookFor, type Look, type LookInfo } from '../../../src/app/season';
import { getApp, useApp } from './session';

export { LOOKS, type Look, type LookInfo };

/** The look now (re-read when the day may have changed: each time the app comes back). */
export function useLook(): Look {
  const choice = useApp((s) => s.board.season);
  const [, setDay] = useState(() => new Date().toDateString());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') setDay(new Date().toDateString()); });
    return () => sub.remove();
  }, []);
  return lookFor(choice);
}

type IconNative = { current(): string | null; set(name: string): Promise<boolean> };
const icon = requireOptionalNativeModule<IconNative>('CefaciIcon');

/** Android: the launcher icon for the look, changed only while the app is in the background (changing the
 *  launcher entry of a running app can close it on some phones). */
export function watchIcon() {
  if (!icon) return () => {};
  const sub = AppState.addEventListener('change', (st) => {
    if (st !== 'background') return;
    const want = LOOKS[lookFor(getApp().board.season)].icon;
    try { if (icon.current() !== want) void icon.set(want).catch(() => {}); } catch { /* missing */ }
  });
  return () => sub.remove();
}
