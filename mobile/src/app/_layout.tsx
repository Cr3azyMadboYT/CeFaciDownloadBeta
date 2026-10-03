import '../lib/boot';
import { useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans';
import { Caveat_700Bold } from '@expo-google-fonts/caveat';
import { noapte, ThemeCtx, zi } from '../ui/theme';
import { setBoard, useApp } from '../lib/session';
import { Toast } from '../ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Root() {
  const [loaded] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold, Caveat_700Bold });
  const name = useApp((s) => (s.board.theme === 'noapte' ? 'noapte' : 'zi')) as 'zi' | 'noapte';
  const t = name === 'noapte' ? noapte : zi;
  const ctx = useMemo(() => ({ t, name, set: (n: 'zi' | 'noapte') => setBoard({ theme: n }) }), [t, name]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  useEffect(() => { SystemUI.setBackgroundColorAsync(t.bg).catch(() => {}); }, [t.bg]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeCtx.Provider value={ctx}>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="cont" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="zona" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        <Toast />
      </ThemeCtx.Provider>
    </SafeAreaProvider>
  );
}
