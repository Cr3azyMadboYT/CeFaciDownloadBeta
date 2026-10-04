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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb() as any).from('push_tokens').upsert({ token, platform: 'android', updated_at: new Date().toISOString() });
    if (!error) saved = token;
  } catch {
    /* no Firebase in this build yet, or no network: try again next time */
  }
}

/** Signing out: this phone stops getting that account's notifications. */
export async function forgetPush() {
  if (!saved) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb() as any).from('push_tokens').delete().eq('token', saved).then(() => {}, () => {});
  saved = '';
}
