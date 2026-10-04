// Safe-area insets that never let the bottom bar sit under the phone's own buttons (decision Cornel, 04.10:
// "ca la Instagram"). On Android the app's window is padded above the navigation bar natively
// (modules/cefaci-insets, fitNavBar), so the screens need no bottom inset; only the bottom sheets, which Android
// draws over the whole screen, add the bar's height themselves (useModalInsets).
import { Platform } from 'react-native';
import { useSafeAreaInsets as useRaw } from 'react-native-safe-area-context';
import { fitsNavBar, navBarBottom } from '../../modules/cefaci-insets';

/** The bottom inset for a window drawn over the navigation bar: what Android measures; 48 (3 buttons) if unknown. */
export function androidBottom(reported: number, measured: number | null) {
  if (measured !== null && measured > 0) return Math.max(reported, measured);
  return reported >= 16 ? reported : 48;
}

/** Insets for the screens. */
export function useSafeAreaInsets() {
  const ins = useRaw();
  if (Platform.OS !== 'android') return ins;
  if (fitsNavBar) return ins.bottom === 0 ? ins : { ...ins, bottom: 0 }; // Android already keeps the app above the bar
  const bottom = androidBottom(ins.bottom, navBarBottom());
  return bottom === ins.bottom ? ins : { ...ins, bottom };
}

/** Insets inside a Modal (bottom sheets, the tour): those cover the whole screen, navigation bar included. */
export function useModalInsets() {
  const ins = useRaw();
  if (Platform.OS !== 'android') return ins;
  const bottom = androidBottom(ins.bottom, navBarBottom());
  return bottom === ins.bottom ? ins : { ...ins, bottom };
}
