// Safe-area insets that never let anything sit under the phone's own buttons (decision Cornel, 04.10: "ca la
// Instagram"). The app is drawn down to the screen's edge (as React Native expects); whatever sits at the bottom
// (the bottom bar, the buttons at the bottom of a screen, the sheets) leaves the navigation bar's height free. That
// height is the larger of what React Native reports and what Android measures (modules/cefaci-insets), and 48 (the
// 3-button bar) when both say nothing: some Samsung phones with 3 buttons report 0. The bottom bar also checks where
// it really ended up on screen (useBarBottom).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform, type View } from 'react-native';
import { useSafeAreaInsets as useRaw } from 'react-native-safe-area-context';
import { hasNative, navFit, onNavFit, type NavFit } from '../../modules/cefaci-insets';

/** The bottom inset for content drawn down to the screen's edge: what Android measures; 48 (3 buttons) if unknown. */
export function androidBottom(reported: number, measured: number | null) {
  if (measured !== null && measured > 0) return Math.max(reported, measured);
  return reported >= 16 ? reported : 48;
}

// what Android measured, kept up to date (the first measure comes a moment after the app starts)
let fit: NavFit = navFit();
const subs = new Set<() => void>();
const same = (a: NavFit, b: NavFit) => a.nav === b.nav && a.navTop === b.navTop && a.fitted === b.fitted;
if (hasNative) onNavFit((s) => { const n = { ...fit, ...s }; if (!same(n, fit)) { fit = n; subs.forEach((f) => f()); } });
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const useFit = () => useSyncExternalStore(subscribe, () => fit, () => fit);
/** Read once more (the first measure can come before the event listener). */
export function refreshNavFit() { const s = navFit(); if (!same(s, fit)) { fit = { ...fit, ...s }; subs.forEach((f) => f()); } }

/** The bottom inset a screen must leave free: the navigation bar's height (none if the app is padded above it). */
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

/**
 * For the bottom bar: the space to leave under it. The inset above, or more if the bar really ends lower on screen
 * (measured): a screen laid out taller than the window would push it under the phone's buttons, and that must
 * never show. `ref` and `onLayout` go on the bar.
 */
export function useBarBottom(onMeasure?: (m: { y: number; h: number; navTop: number; lift: number }) => void) {
  const ins = useSafeAreaInsets();
  const f = useFit();
  const ref = useRef<View>(null);
  const [lift, setLift] = useState(0);
  const navTop = f.navTop ?? -1;
  const measure = useCallback(() => {
    if (Platform.OS !== 'android' || navTop <= 0) return;
    ref.current?.measureInWindow((_x, y, _w, h) => {
      if (!(h > 0)) return;
      const l = Math.max(0, Math.round(y + h - navTop));
      setLift(l);
      onMeasure?.({ y, h, navTop, lift: l });
    });
  }, [navTop, onMeasure]);
  useEffect(() => { const id = setTimeout(measure, 60); return () => clearTimeout(id); }, [measure]);
  return { ref, onLayout: measure, bottom: Math.max(ins.bottom, lift) };
}

/** For the test build: what each side measured (shown on screen, so a screenshot says it all). */
export function useInsetDebug() {
  const ins = useRaw();
  const f = useFit();
  return { raw: ins.bottom, ...f };
}
