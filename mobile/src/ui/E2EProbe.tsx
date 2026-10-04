// Only in the test build (EXPO_PUBLIC_E2E=1): a thin line at the top with what each side measured for the bottom bar,
// so one screenshot from the emulator says whether the app stops above the phone's buttons, and why.
import { useEffect } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { useSafeAreaInsets as useRaw } from 'react-native-safe-area-context';
import { refreshNavFit, useInsetDebug, useSafeAreaInsets } from './insets';

export function E2EProbe() {
  const d = useInsetDebug();
  const used = useSafeAreaInsets();
  const raw = useRaw();
  const win = Dimensions.get('window');
  const scr = Dimensions.get('screen');
  useEffect(() => { const id = setInterval(refreshNavFit, 1000); return () => clearInterval(id); }, []);
  const line = 'raw=' + raw.bottom.toFixed(0) + ' nav=' + d.nav.toFixed(0) + ' fit=' + d.fitted.toFixed(0) + ' used=' + used.bottom.toFixed(0) + ' win=' + win.height.toFixed(0) + ' scr=' + scr.height.toFixed(0) + (d.app ? ' app=' + d.app.toFixed(0) : '');
  useEffect(() => { console.log('E2E insets ' + line); }, [line]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: raw.top, left: 0, right: 0, alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: '#FFFFFF', backgroundColor: 'rgba(200,0,0,0.75)', paddingHorizontal: 4 }}>{line}</Text>
    </View>
  );
}
