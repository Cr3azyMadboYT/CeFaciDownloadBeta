// The phone's own navigation bar (decision Cornel, 04.10: the bottom bar must never sit under the 3 buttons, like
// Instagram). Android measures the bar's height and where it starts; null / -1 on web, iOS, or if the native part is
// missing. The screens leave that height free at the bottom (src/ui/insets.ts).
import { requireOptionalNativeModule } from 'expo-modules-core';

/** In dp: the bar's height, where it starts (from the window's top), how much the app is padded above it (0). */
export interface NavFit { nav: number; fitted: number; navTop?: number; screen?: number; app?: number }
type Native = {
  navBarBottom(): number;
  state(): NavFit;
  watchNavBar(lightBg: boolean): Promise<boolean>;
  addListener(event: 'onFit', fn: (e: NavFit) => void): { remove(): void };
};
const native = requireOptionalNativeModule<Native>('CefaciInsets');

/** True when the native part is in the app (Android). */
export const hasNative = !!native;

/** Takes away Android's grey layer over the bar and watches its height; `lightBg` picks dark buttons. */
export function watchNavBar(lightBg: boolean) {
  native?.watchNavBar(lightBg).catch(() => {});
}

/** Height of the navigation bar at the bottom, in dp; null when unknown. */
export function navBarBottom(): number | null {
  try { const v = native?.navBarBottom(); return typeof v === 'number' && v >= 0 ? v : null; } catch { return null; }
}

/** What Android measured right now. */
export function navFit(): NavFit {
  try { const s = native?.state(); if (s && typeof s.nav === 'number') return s; } catch { /* missing */ }
  return { nav: -1, fitted: 0 };
}

/** Called each time the bar changes (rotation, gesture/buttons switched in the settings). */
export function onNavFit(fn: (s: NavFit) => void): () => void {
  try { const sub = native?.addListener('onFit', fn); return () => sub?.remove(); } catch { return () => {}; }
}
