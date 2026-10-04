// Bilu's reminder for the receipt (decision Cornel, 30.09): 40 minutes after check-in, then, if the receipt is still
// missing, the next day at noon. At most two, both cancelled as soon as the receipt is in. Local notifications only.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function allowed() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bon', { name: 'Amintiri pentru bon', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#FFD43B' }).catch(() => {});
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Schedules the two reminders after a check-in. Returns their ids (to cancel), or [] if notifications are off. */
export async function remindBill(placeName: string, at = new Date(), pid?: number): Promise<string[]> {
  try {
    if (!(await allowed())) return [];
    const first = await Notifications.scheduleNotificationAsync({
      content: { title: 'Bilu de la CeFaci', body: 'Nu uita de bon, ne ajută și pe noi și pe tine :)', data: { kind: 'bon', pid } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 40 * 60, channelId: 'bon' },
    });
    const noon = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, 12, 0);
    const second = await Notifications.scheduleNotificationAsync({
      content: { title: 'Bilu de la CeFaci', body: 'Ai uitat bonul de ' + (at.getHours() >= 17 || at.getHours() < 5 ? 'aseară' : 'ieri') + ' de la ' + placeName + '? Îl mai poți pune până diseară: +25 XP.', data: { kind: 'bon', pid } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: noon, channelId: 'bon' },
    });
    return [first, second];
  } catch {
    return [];
  }
}

export async function cancelReminders(ids: string[] | undefined) {
  for (const id of ids ?? []) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Tapping a receipt reminder opens that ticket. Returns a stop function. */
export function onReminderTap(open: (pid: number) => void) {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const pid = Number((r.notification.request.content.data as { pid?: number } | undefined)?.pid);
    if (pid) open(pid);
  });
  return () => sub.remove();
}
