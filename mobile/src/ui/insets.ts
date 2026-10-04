// Safe-area insets that never let the bottom bar sit under the phone's own buttons (decision Cornel, 04.10:
// "ca la Instagram"). On some Android phones (Samsung with the 3 buttons) the inset the app gets is too small, so on
// Android we also ask Android itself for the navigation bar's height (modules/cefaci-insets) and take the larger one.
import { Platform } from 'react-native';
import { useSafeAreaInsets as useRaw } from 'react-native-safe-area-context';
import { navBarBottom } from '../../modules/cefaci-insets';

/** The bottom inset to use: the larger of what the app got and what Android measures; 48 (3 buttons) if both fail. */
export function androidBottom(reported: number, measured: number | null) {
  if (measured !== null && measured > 0) return Math.max(reported, measured);
  return reported >= 16 ? reported : 48;
}

export function useSafeAreaInsets() {
  const ins = useRaw();
  if (Platform.OS !== 'android') return ins;
  const bottom = androidBottom(ins.bottom, navBarBottom());
  return bottom === ins.bottom ? ins : { ...ins, bottom };
}
