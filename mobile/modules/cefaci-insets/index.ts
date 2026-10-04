// The phone's own navigation bar (decision Cornel, 04.10: the bottom bar must never sit under the 3 buttons, like
// Instagram). On Android the app is padded above it natively (fitNavBar); null / false on web, iOS, or if the native
// part is missing.
import { requireOptionalNativeModule } from 'expo-modules-core';

const native = requireOptionalNativeModule<{ navBarBottom(): number; fitNavBar(lightBg: boolean): Promise<boolean> }>('CefaciInsets');

/** True when Android keeps the whole app above the navigation bar. */
export const fitsNavBar = !!native;

/** Keeps the app above the navigation bar; `lightBg` picks dark buttons on a light background. */
export function fitNavBar(lightBg: boolean) {
  native?.fitNavBar(lightBg).catch(() => {});
}

/** Height of the navigation bar at the bottom, in dp; null when unknown. */
export function navBarBottom(): number | null {
  try { const v = native?.navBarBottom(); return typeof v === 'number' && v >= 0 ? v : null; } catch { return null; }
}
