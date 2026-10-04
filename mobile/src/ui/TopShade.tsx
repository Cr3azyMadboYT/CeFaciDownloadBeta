import { View } from 'react-native';
import { useSafeAreaInsets } from './insets';
import { useTheme } from './theme';

/** A strip of background under the status bar, so scrolled content never runs under the clock and battery. */
export function TopShade({ color }: { color?: string }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ins.top, backgroundColor: color ?? t.bg }} />;
}
