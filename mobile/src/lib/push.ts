// Notifications from other people (votes, plans, crew invitations): the phone's Firebase token goes to Supabase
// (push_tokens); the server sends through Firebase (Edge Function "trimite-notificare"). Works once the build has
// google-services.json; before that, getting the token fails quietly.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { sb } from './auth';

let saved = '';

export async function registerPush(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('social', { name: 'Voturi, planuri și gășci', importance: Notifications.AndroidImportance.HIGH, lightColor: '#FFD43B' });
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (!token || token === saved) return;
    // the phone's token belongs to the account signed in on it now (07.10: after a failed sign-out it stayed with the
    // old account, which kept getting its notifications here)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { error } = await (sb() as any).rpc('push_token_save', { p_token: token });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (error && /push_token_save|function/i.test(error.message ?? '')) ({ error } = await (sb() as any).from('push_tokens').upsert({ token, platform: 'android', updated_at: new Date().toISOString() }));
    if (!error) saved = token;
  } catch {
    /* no Firebase in this build yet, or no network: try again next time */
  }
}

/** Signing out: this phone stops getting that account's notifications. */
export async function forgetPush() {
  // the receipt reminders name the place: they go too (07.10)
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  if (!saved) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb() as any).from('push_tokens').delete().eq('token', saved).then(() => {}, () => {});
  saved = '';
}

/** The account is gone (deleted, or another one signed in on this phone): nothing of it stays here. */
export async function resetPush() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  saved = '';
}
