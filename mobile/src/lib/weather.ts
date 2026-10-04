// The forecast on the phone: read from Supabase (public.weather, one row), refreshed by the Edge Function "vremea"
// when it is older than an hour. It goes into the engine (APP.setWeather) and the screens re-render.
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { APP } from '../../../src/app/bridge';
import type { Weather } from '../../../src/engine/weather';
import { sb } from './auth';

let version = 0;
const subs = new Set<() => void>();
const bump = () => { version++; subs.forEach((f) => f()); };
export const useWeatherVersion = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => version, () => version);

let busy = false;
let last = 0;
export async function loadWeather(force = false) {
  if (busy || (!force && Date.now() - last < 20 * 60e3)) return;
  busy = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = sb() as any;
    let { data } = await db.from('weather').select('data, updated_at').eq('id', 1).maybeSingle();
    if (!data || Date.now() - new Date(data.updated_at).getTime() > 70 * 60e3) {
      await sb().functions.invoke('vremea', { body: {} }).catch(() => null);
      ({ data } = await db.from('weather').select('data, updated_at').eq('id', 1).maybeSingle());
    }
    if (data?.data) { APP.setWeather(data.data as Weather); last = Date.now(); bump(); }
  } catch {
    /* no network: the app works without the weather */
  } finally {
    busy = false;
  }
}
AppState.addEventListener('change', (s) => { if (s === 'active') void loadWeather(); });
