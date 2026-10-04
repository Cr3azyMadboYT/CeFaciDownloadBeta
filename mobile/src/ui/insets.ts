// Safe-area insets that never let the bottom bar sit under the phone's own buttons (decision Cornel, 04.10:
// "ca la Instagram"). On Android the app's window is padded above the navigation bar natively
// (modules/cefaci-insets, fitNavBar) and the native side says how much it padded. When it did, the screens add
// nothing at the bottom; when it did not (the native part missing or Android not padding), the screens pad
// themselves by the bar's height: the larger of what React Native reports and what Android measures, and 48 (the
// 3-button bar) when both say nothing. The bottom sheets, which Android draws over the whole screen, always add the
// bar's height (useModalInsets).
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets as useRaw } from 'react-native-safe-area-context';
import { hasNative, navFit, onNavFit, type NavFit } from '../../modules/cefaci-insets';

/** The bottom inset for content drawn down to the screen's edge: what Android measures; 48 (3 buttons) if unknown. */
export function androidBottom(reported: number, measured: number | null) {
  if (measured !== null && measured > 0) return Math.max(reported, measured);
  return reported >= 16 ? reported : 48;
}

// what Android measured, kept up to date (the padding comes a moment after the app starts)
let fit: NavFit = navFit();
const subs = new Set<() => void>();
if (hasNative) onNavFit((s) => { fit = { ...fit, ...s }; subs.forEach((f) => f()); });
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const useFit = () => useSyncExternalStore(subscribe, () => fit, () => fit);
/** Read once more (the first measure can come before the event listener). */
export function refreshNavFit() { const s = navFit(); if (s.fitted !== fit.fitted || s.nav !== fit.nav) { fit = s; subs.forEach((f) => f()); } }

/** The bottom inset a screen must leave free: 0 when Android already keeps the app above the bar. */
export function bottomFor(reported: number, f: NavFit): number {
  if (f.fitted > 0) return 0;
  return androidBottom(reported, f.nav >= 0 ? f.nav : null);
}

/** Insets for the screens. */
export function useSafeAreaInsets() {
  const ins = useRaw();
  const f = useFit();
  if (Platform.OS !== 'android') return ins;
  const bottom = bottomFor(ins.bottom, f);
  return bottom === ins.bottom ? ins : { ...ins, bottom };
}

/** Insets inside a Modal (bottom sheets, the tour): those cover the whole screen, navigation bar included. */
export function useModalInsets() {
  const ins = useRaw();
  const f = useFit();
  if (Platform.OS !== 'android') return ins;
  const bottom = androidBottom(ins.bottom, f.nav > 0 ? f.nav : null);
  return bottom === ins.bottom ? ins : { ...ins, bottom };
}

/** For the test build: what each side measured (shown on screen, so a screenshot says it all). */
export function useInsetDebug() {
  const ins = useRaw();
  const f = useFit();
  return { raw: ins.bottom, ...f };
}
