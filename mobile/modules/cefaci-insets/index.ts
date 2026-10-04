// The phone's own navigation bar, measured by Android itself (decision Cornel, 04.10: the bottom bar must never sit
// under the 3 buttons). null on web, iOS, or if the native part is missing.
import { requireOptionalNativeModule } from 'expo-modules-core';

const native = requireOptionalNativeModule<{ navBarBottom(): number }>('CefaciInsets');

/** Height of the navigation bar at the bottom, in dp; null when unknown. */
export function navBarBottom(): number | null {
  try { const v = native?.navBarBottom(); return typeof v === 'number' && v >= 0 ? v : null; } catch { return null; }
}
