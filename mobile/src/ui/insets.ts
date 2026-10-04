// Safe-area insets that never let the bottom bar sit under the phone's own buttons (decision Cornel, 04.10:
// "ca la Instagram"). Some Android phones (Samsung with the 3 buttons, edge-to-edge) report a bottom inset of 0
// while the system bar is drawn over the app; then we use the bar's real height from the window metrics.
import { Dimensions, Platform, StatusBar } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets as useRaw } from 'react-native-safe-area-context';

function androidNavBar() {
  const screen = Dimensions.get('screen').height, win = Dimensions.get('window').height;
  const gap = screen - win - (StatusBar.currentHeight ?? 0);
  if (gap > 8) return gap;                     // the window stops above the bar: its height
  return initialWindowMetrics?.insets.bottom || 48; // edge-to-edge with no inset reported: the 3-button bar is 48dp
}

export function useSafeAreaInsets() {
  const ins = useRaw();
  if (Platform.OS !== 'android' || ins.bottom >= 1) return ins;
  return { ...ins, bottom: androidNavBar() };
}
