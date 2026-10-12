// The season's look on the phone (src/app/season.ts), always the date's (decision Cornel, 06.10: it comes on by
// itself, nothing to set). Bilu dresses for it,
// Acasă gets what falls in it, and the app's icon follows it (setIcon, when the app goes to the background).
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { LOOKS, lookFor, type Look, type LookInfo } from '../../../src/app/season';
import {watchSeasonalIcon} from '../../../shared/seasonal-icon';

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

/** Android switches in background; UIKit switches while active, using the same season calendar. */
export function watchIcon() {
  return watchSeasonalIcon({native: icon, platform: Platform.OS, appState: AppState});
}
