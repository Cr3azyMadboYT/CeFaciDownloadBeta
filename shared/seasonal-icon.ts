import {lookOf, type Look} from '../src/app/season';
export type IconNative = {current(): string|null; set(look: Look): Promise<boolean>; later?(look: Look): boolean};
/** Android: the native module switches the launcher entry itself after 10 minutes in the background (`later`):
 *  a short „background” (the Google sign-in sheet, a permission question, the in-app browser) closed the app on
 *  Samsung when the entry changed (23.10). Without `later` Android does nothing. UIKit requires an active foreground. */
export function watchSeasonalIcon({native, platform, appState, now = () => new Date()}: {
  native: IconNative|null; platform: string;
  appState: {currentState: string|null; addEventListener(type: 'change', listener: (state: string) => void): {remove(): void}};
  now?: () => Date;
}): () => void {
  if (!native || !['android', 'ios'].includes(platform)) return () => {};
  let stopped = false, running = false, pending = false, state = appState.currentState;
  const eligible = () => platform === 'android' ? true : state === 'active';
  const sync = async () => {
    if (stopped || !eligible()) return;
    if (running) { pending = true; return; }
    running = true;
    try {
      const target = lookOf(now());
      if (platform === 'android') { native.later?.(target); return; }
      if (native.current() !== target) await native.set(target);
    }
    catch { /* An OS refusal is retried on the next eligible lifecycle event. */ }
    finally { running = false; if (pending) { pending = false; void sync(); } }
  };
  const listener = appState.addEventListener('change', next => { state = next; void sync(); });
  void sync();
  return () => { stopped = true; listener.remove(); };
}
