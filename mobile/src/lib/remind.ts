// Bilu's reminder for the receipt (decision Cornel, 30.09): 40 minutes after check-in, then, if the receipt is still
// missing, the next day at noon. At most two, both cancelled as soon as the receipt is in. Local notifications only.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { tr } from '../../../src/i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function allowed() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bon', { name: tr('Amintiri pentru bon'), importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#FFD43B' }).catch(() => {});
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
      content: { title: tr('Bilu de la CeFaci'), body: tr('Nu uita de bon, ne ajută și pe noi și pe tine :)'), data: { kind: 'bon', pid } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 40 * 60, channelId: 'bon' },
    });
    // the next noon: the same day for a check-in after midnight (07.10: it came 35 hours later)
    const noon = new Date(at.getFullYear(), at.getMonth(), at.getDate() + (at.getHours() < 5 ? 0 : 1), 12, 0);
    const second = await Notifications.scheduleNotificationAsync({
      content: { title: tr('Bilu de la CeFaci'), body: at.getHours() >= 17 || at.getHours() < 5 ? tr('Ai uitat bonul de aseară de la {p}? Îl mai poți pune până diseară: +25 XP.', { p: placeName }) : tr('Ai uitat bonul de ieri de la {p}? Îl mai poți pune până diseară: +25 XP.', { p: placeName }), data: { kind: 'bon', pid } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: noon, channelId: 'bon' },
    });
    return [first, second];
  } catch {
    return [];
  }
}

/** „Ai ajuns la X?” la ora planului, pentru planurile la localuri partenere (docs/flux-intrare-bon.md, pasul 2).
 *  Nu cere voie pentru notificări (doar dacă sunt deja permise). Se ține pe pas cu planurile: cele șterse, mutate sau
 *  cu sosirea făcută își pierd notificarea, cele noi o primesc. `due` = planurile care o mai au de primit. */
let arriveLane: Promise<unknown> = Promise.resolve();
export function syncArrive(due: { pid: number; at: Date; name: string }[]) {
  arriveLane = arriveLane.catch(() => {}).then(async () => {
    if (Platform.OS === 'web') return;
    const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    const have = new Map<string, string>(); // "pid|at" → id
    for (const n of all) {
      const d = n.content.data as { kind?: string; pid?: number; at?: string } | undefined;
      if (d?.kind === 'arrive') have.set(d.pid + '|' + d.at, n.identifier);
    }
    const want = new Set(due.filter((x) => x.at.getTime() > Date.now()).map((x) => x.pid + '|' + x.at.toISOString()));
    for (const [k, id] of have) if (!want.has(k)) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    if (![...want].some((k) => !have.has(k))) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('sosire', { name: tr('Ai ajuns?'), importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#FFD43B' }).catch(() => {});
    for (const x of due) {
      const k = x.pid + '|' + x.at.toISOString();
      if (!want.has(k) || have.has(k)) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: tr('Bilu de la CeFaci'), body: tr('Ai ajuns la {name}? Scanează codul de pe masă.', { name: x.name }), data: { kind: 'arrive', pid: x.pid, at: x.at.toISOString() } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: x.at, channelId: 'sosire' },
      }).catch(() => {});
    }
  });
  return arriveLane;
}

export async function cancelReminders(ids: string[] | undefined) {
  for (const id of ids ?? []) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Tapping a receipt (or „Ai ajuns?”) reminder opens that ticket, at that step. Returns a stop function. */
export function onReminderTap(open: (pid: number, kind?: string) => void, go?: (url: string) => void) {
  if (Platform.OS === 'web') return () => {};
  const handle = (r: Notifications.NotificationResponse) => {
    const data = r.notification.request.content.data as { pid?: number; url?: string; kind?: string } | undefined;
    const pid = Number(data?.pid);
    if (pid) open(pid, data?.kind);
    else if (data?.url && go) go(data.url); // a friend's vote, plan or crew invitation
  };
  // the app was closed and opened by tapping the notification
  Notifications.getLastNotificationResponseAsync().then((r) => { if (r) setTimeout(() => handle(r), 600); }).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
