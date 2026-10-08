// The places from Supabase (decision Cornel, 06.10): at every start and every return to the app, the rows of
// public.venues changed since the last time (a place corrected, added or hidden from Admin) come in and are put over
// the copy in the app (src/app/places.ts, APP.applyPlaces). Readable without an account; quietly skipped offline.
import { AppState } from 'react-native';
import type { PlaceRow } from '../../../src/app/places';
import { sb } from './auth';
import { syncPartners } from './partner';
import { APP, notify } from './session';

let busy = false;
let lastTry = 0;
export async function syncPlaces(force = false) {
  if (busy || (!force && Date.now() - lastTry < 10 * 60e3)) return;
  busy = true; lastTry = Date.now();
  try {
    await syncPartners(); notify();
    const { since, first, builtAt } = APP.placesSince();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = sb() as any;
    const rows: PlaceRow[] = [];
    const page = async (q: (x: unknown) => unknown) => {
      for (let from = 0; ; from += 500) {
        const { data, error } = await (q(db.from('venues').select('id,data,edit,status,updated_at')) as any).order('updated_at').order('id').range(from, from + 499); // id: rows of one import share a time // eslint-disable-line @typescript-eslint/no-explicit-any
        if (error || !data) return false;
        rows.push(...(data as PlaceRow[]));
        if (data.length < 500) return true;
      }
    };
    // the first time: what was changed by hand at any time, and what changed after the app's copy was made
    if (first && !(await page((x: any) => x.or('edited_at.not.is.null,status.neq.on,source.eq.admin')))) return; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!(await page((x: any) => x.gt('updated_at', first ? builtAt : since)))) return; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (APP.applyPlaces(rows)) notify();
  } catch { /* offline: the copy in the app stays */ } finally { busy = false; }
}
setTimeout(() => { void syncPlaces(true); }, 2000);
AppState.addEventListener('change', (st) => { if (st === 'active') void syncPlaces(); });
