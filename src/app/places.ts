// The places from Supabase over the copy in the app (decision Cornel, 06.10: "toate în Supabase, modificabile din
// admin"). The app ships with src/data/venues.json, so it starts at once and works without a connection; from
// public.venues it takes only the rows changed after that copy was made (src/data/venues-meta.json builtAt): a place
// corrected or added from Admin, one hidden, one gone from the map. The changes are kept on the phone (cefaci.places)
// and put over the copy at every start, before the first screen.
import { KINDS } from '../engine/catalog';
import type { Venue } from '../engine/types';

export interface PlaceRow { id: string; data: Partial<Venue>; edit?: Partial<Venue> | null; status: 'on' | 'hidden' | 'gone'; updated_at: string }
export interface PlaceCache { at: string; rows: Record<string, PlaceRow> }

/** The places with the changes put over them: hidden or gone ones out, changed ones replaced, new ones in. A row that
 *  would not make a usable place (no name, unknown kind, no position) leaves the place as it was. */
export function mergePlaces(base: Venue[], rows: PlaceRow[]): Venue[] {
  const byId = new Map(base.map((v) => [v.id, v]));
  for (const r of rows) {
    if (r.status !== 'on') { byId.delete(r.id); continue; }
    const v = { ...(byId.get(r.id) ?? {}), ...(r.data ?? {}), ...(r.edit ?? {}), id: r.id } as Venue;
    const kind = KINDS[v.k];
    if (!v.name || !kind || typeof v.lat !== 'number' || typeof v.lon !== 'number') continue;
    v.cat = kind.cat;
    if (!Array.isArray(v.cuisines)) v.cuisines = [];
    if (!v.kind) v.kind = kind.label;
    byId.set(r.id, v);
  }
  return [...byId.values()];
}

/** Adds newly fetched rows to the ones kept on the phone (the newest row of each place wins). */
export function addRows(cache: PlaceCache, rows: PlaceRow[]): PlaceCache {
  const out: PlaceCache = { at: cache.at, rows: { ...cache.rows } };
  for (const r of rows) {
    const had = out.rows[r.id];
    if (!had || had.updated_at <= r.updated_at) out.rows[r.id] = r;
    if (r.updated_at > out.at) out.at = r.updated_at;
  }
  return out;
}
