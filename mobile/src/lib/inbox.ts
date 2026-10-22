// The bell (22.10, Cornel: „un buton de notificări să vezi tot ce ai primit”): everything trimite-notificare sent you
// (votes, plans, crews, friends, FreeNow), from public.notifications. Kept on the phone for offline; refreshed when
// Acasă opens, when the app comes back and when a notification arrives. Opening the list marks everything read.
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { sb } from './auth';
import { getApp } from './session';

export interface Inbox { id: number; kind: string; title: string; body: string; title_en: string | null; body_en: string | null; url: string; created_at: string; read_at: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => sb() as any;
const KEY = 'cefaci.inbox';
let mem: { who: string; list: Inbox[] } | null = null;
const subs = new Set<() => void>();
const EMPTY: Inbox[] = [];
const who = () => getApp().who?.id ?? '';

function load(): Inbox[] {
  const me = who();
  if (!mem || mem.who !== me) {
    try { const v = JSON.parse(globalThis.localStorage?.getItem(KEY) || 'null'); mem = v && v.who === me && Array.isArray(v.list) ? v : { who: me, list: [] }; }
    catch { mem = { who: me, list: [] }; }
  }
  return me ? mem!.list : EMPTY;
}
function save(list: Inbox[]) {
  mem = { who: who(), list };
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(mem)); } catch { /* storage blocked */ }
  subs.forEach((f) => f());
}

let busy: Promise<void> | null = null;
export function refreshInbox(): Promise<void> {
  if (!who()) return Promise.resolve();
  busy ??= (async () => {
    try {
      const { data, error } = await db().from('notifications').select('id,kind,title,body,title_en,body_en,url,created_at,read_at').order('created_at', { ascending: false }).limit(60);
      if (!error && Array.isArray(data)) save(data as Inbox[]);
    } finally { busy = null; }
  })();
  return busy;
}

/** Opening the bell: everything is read (here at once, on the server in the background). */
export function readAll() {
  const list = load();
  if (!list.some((x) => !x.read_at)) return;
  const now = new Date().toISOString();
  save(list.map((x) => (x.read_at ? x : { ...x, read_at: now })));
  void db().rpc('notifications_read');
}

export function useInbox(): Inbox[] {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, load, load);
}
export const useUnread = () => useInbox().filter((x) => !x.read_at).length;

/** Keeps the list fresh: now, when the app comes back to the front and when a notification arrives. */
export function useInboxWatch() {
  useEffect(() => {
    void refreshInbox();
    const a = AppState.addEventListener('change', (s) => { if (s === 'active') void refreshInbox(); });
    const n = Platform.OS === 'web' ? null : Notifications.addNotificationReceivedListener(() => { setTimeout(() => void refreshInbox(), 1500); });
    return () => { a.remove(); n?.remove(); };
  }, []);
}
