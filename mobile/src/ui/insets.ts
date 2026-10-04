// Safe-area insets that never let the bottom bar sit under the phone's own buttons (decision Cornel, 04.10:
// "ca la Instagram"). Some Android phones (Samsung with the 3 buttons, edge-to-edge) report a bottom inset of 0
// or too small while the system bar is drawn over the app. A real gesture bar reports at least ~16dp and the
// 3-button bar 48dp, so anything smaller than 16 is not trusted and becomes 48 (the 3-button bar's height).
import { Platform } from 'react-native';
import { useSafeAreaInsets as useRaw } from 'react-native-safe-area-context';

export const androidBottom = (reported: number) => (reported >= 16 ? reported : 48);

export function useSafeAreaInsets() {
  const ins = useRaw();
  if (Platform.OS !== 'android') return ins;
  const bottom = androidBottom(ins.bottom);
  return bottom === ins.bottom ? ins : { ...ins, bottom };
}
