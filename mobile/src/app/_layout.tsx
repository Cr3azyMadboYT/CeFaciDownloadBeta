import '../lib/boot';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, router } from 'expo-router';
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
import { AskHost } from '../ui/Ask';
import { LevelUp } from '../ui/LevelUp';
import { onReminderTap, syncArrive } from '../lib/remind';
import { startsAt, type Plan } from '../lib/plans';
import { isPartnerPlan } from '../lib/entry';
import { APP } from '../../../src/app/bridge';
import { watchNavBar } from '../../modules/cefaci-insets';
import { refreshNavFit } from '../ui/insets';
import { E2E } from '../lib/e2e';
import '../lib/places'; // the places changed from Admin (Supabase) come in at start
import { E2EProbe } from '../ui/E2EProbe';
import { watchIcon } from '../lib/season';
import { useLang } from '../lib/i18n';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Root() {
  const [loaded] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold, Caveat_700Bold });
  const lng = useLang(); // limba se pune înaintea oricărui ecran; la schimbare, tot arborele se redesenează (key)
  const mode = useApp((s) => s.board.theme ?? 'zi');
  const sys = useColorScheme();
  const name: 'zi' | 'noapte' = mode === 'noapte' || (mode === 'auto' && sys === 'dark') ? 'noapte' : 'zi';
  const t = name === 'noapte' ? noapte : zi;
  const ctx = useMemo(() => ({ t, name, set: (n: 'zi' | 'noapte') => setBoard({ theme: n }) }), [t, name]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  // „bon” opens the ticket at the receipt, „arrive” at the table code (docs/flux-intrare-bon.md)
  useEffect(() => onReminderTap((pid, kind) => router.push({ pathname: '/bilet/[pid]', params: { pid: String(pid), ...(kind === 'bon' || kind === 'arrive' ? { step: kind } : {}) } }), (url) => router.push(url as never)), []);
  const plans = useApp((s) => s.board.plans as Plan[] | undefined);
  useEffect(() => {
    // „Ai ajuns la X?” at the plan's time, for the partner venues not reached yet; gone with the plan or the arrival
    const id = setTimeout(() => void syncArrive((plans ?? []).filter((pl) => !pl.inAt && isPartnerPlan(pl)).map((pl) => ({ pid: pl.pid, at: startsAt(pl), name: APP.byId(pl.placeId)?.name ?? '' }))), 1500);
    return () => clearTimeout(id);
  }, [plans]);
  useEffect(() => { SystemUI.setBackgroundColorAsync(t.bg).catch(() => {}); }, [t.bg]);
  // the phone's buttons on the app's own background (no grey layer), dark on the light theme, light on the dark one;
  // the screens leave the bar's height free at the bottom (ui/insets.ts)
  useEffect(() => watchIcon(), []); // the season's icon, put on the launcher when the app goes to the background
  useEffect(() => { watchNavBar(!t.dark); const id = setTimeout(refreshNavFit, 400); return () => clearTimeout(id); }, [t.dark]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeCtx.Provider value={ctx} key={lng}>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="cont" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="zona" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        <Toast />
        <AskHost />
        <LevelUp />
        {E2E ? <E2EProbe /> : null}
      </ThemeCtx.Provider>
    </SafeAreaProvider>
  );
}
