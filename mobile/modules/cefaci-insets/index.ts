// The phone's own navigation bar (decision Cornel, 04.10: the bottom bar must never sit under the 3 buttons, like
// Instagram). On Android the app is padded above it natively (fitNavBar), and the native side says how much it padded
// ("onFit"); null / 0 on web, iOS, or if the native part is missing.
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NavFit { nav: number; fitted: number; screen?: number; app?: number }
type Native = {
  navBarBottom(): number;
  state(): NavFit;
  fitNavBar(lightBg: boolean): Promise<boolean>;
  addListener(event: 'onFit', fn: (e: NavFit) => void): { remove(): void };
};
const native = requireOptionalNativeModule<Native>('CefaciInsets');

/** True when the native part is in the app (Android). */
export const hasNative = !!native;

/** Keeps the app above the navigation bar; `lightBg` picks dark buttons on a light background. */
export function fitNavBar(lightBg: boolean) {
  native?.fitNavBar(lightBg).catch(() => {});
}

/** Height of the navigation bar at the bottom, in dp; null when unknown. */
export function navBarBottom(): number | null {
  try { const v = native?.navBarBottom(); return typeof v === 'number' && v >= 0 ? v : null; } catch { return null; }
}

/** What Android measured: the bar's height and how much the app is padded above it (dp). */
export function navFit(): NavFit {
  try { const s = native?.state(); if (s && typeof s.fitted === 'number') return s; } catch { /* missing */ }
  return { nav: -1, fitted: 0 };
}

/** Called each time the padding or the bar changes (rotation, gesture/buttons switched in the settings). */
export function onNavFit(fn: (s: NavFit) => void): () => void {
  try { const sub = native?.addListener('onFit', fn); return () => sub?.remove(); } catch { return () => {}; }
}
