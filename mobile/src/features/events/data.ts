// Evenimente: the list from Supabase (public.events, only what is published and coming), kept on the phone for 10
// minutes, and the ticket link. CeFaci never sells or takes money: "Cumpără bilete" opens the official seller.
import { useEffect, useSyncExternalStore } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { sb } from '../../lib/auth';
import { sellerOf, type CfEvent } from '../../../../src/events/events';
import { EVENTS_ON } from './flag';

const KEY = 'cefaci.events';
const FRESH_MS = 10 * 60e3;
const COLS = 'id,title,kind,starts_at,ends_at,venue_id,place_name,address,lat,lon,price_from,price_to,ticket_url,seller,min_age,about,about_en,status,sale_mode';

let mem: { at: number; list: CfEvent[] } | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
function load() {
  if (mem) return mem;
  try { const v = JSON.parse(globalThis.localStorage?.getItem(KEY) || 'null'); mem = v && Array.isArray(v.list) ? v : { at: 0, list: [] }; }
  catch { mem = { at: 0, list: [] }; }
  return mem!;
}
const EMPTY: CfEvent[] = [];
const snapshot = () => (EVENTS_ON ? load().list : EMPTY);

export function refreshEvents(force = false): Promise<void> {
  if (!EVENTS_ON) return Promise.resolve();
  if (!force && Date.now() - load().at < FRESH_MS) return Promise.resolve();
  loading ??= (async () => {
    try {
      const { data, error } = await sb().from('events').select(COLS).order('starts_at').limit(200);
      if (error || !Array.isArray(data)) return; // no account, no network: the last list stays
      mem = { at: Date.now(), list: data as unknown as CfEvent[] };
      try { globalThis.localStorage?.setItem(KEY, JSON.stringify(mem)); } catch { /* storage blocked */ }
      subs.forEach((f) => f());
    } finally { loading = null; }
  })();
  return loading;
}

/** The events (refreshed in the background when older than 10 minutes). */
export function useEvents(): CfEvent[] {
  useEffect(() => { void refreshEvents(); }, []);
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, snapshot, snapshot);
}
export const eventById = (id: string) => load().list.find((e) => e.id === id) ?? null;

/** "Cumpără bilete": the server checks the link and counts the click; the app checks the seller again before opening. */
export async function openTickets(e: CfEvent): Promise<string | null> {
  const { data, error } = await sb().rpc('event_ticket_url', { p_event: e.id } as never);
  if (error) return error.message || 'Nu am putut deschide biletele acum.';
  const url = (data as { url?: string } | null)?.url ?? '';
  if (!sellerOf(url)) return 'Biletele nu sunt disponibile pentru acest eveniment.';
  try { await WebBrowser.openBrowserAsync(url); } catch { await Linking.openURL(url).catch(() => {}); }
  return null;
}
