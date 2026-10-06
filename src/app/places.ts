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
  const sample = base[0] as unknown as Record<string, unknown> | undefined;
  for (const r of rows) {
    try {
      if (!r || typeof r.id !== 'string') continue;
      if (r.status !== 'on') { byId.delete(r.id); continue; }
      const had = byId.get(r.id) as unknown as Record<string, unknown> | undefined;
      const v: Record<string, unknown> = { ...(had ?? {}) };
      // a field from the server is taken only with the same type the app knows (a bad edit from Admin, a text where a
      // list should be, must not crash the app for everyone)
      for (const part of [r.data, r.edit]) {
        if (!part || typeof part !== 'object' || Array.isArray(part)) continue;
        for (const [k, x] of Object.entries(part)) {
          if (k === '__proto__' || k === 'constructor' || k === 'prototype' || x === null || x === undefined) continue;
          const ref = had?.[k] ?? sample?.[k];
          if (ref !== undefined && (Array.isArray(ref) !== Array.isArray(x) || typeof ref !== typeof x)) continue;
          v[k] = x;
        }
      }
      v.id = r.id;
      const kind = KINDS[v.k as string];
      if (typeof v.name !== 'string' || !v.name || !kind || typeof v.lat !== 'number' || typeof v.lon !== 'number'
          || !Number.isFinite(v.lat) || !Number.isFinite(v.lon)) continue;
      v.cat = kind.cat;
      if (!Array.isArray(v.cuisines)) v.cuisines = [];
      if (typeof v.kind !== 'string' || !v.kind) v.kind = kind.label;
      byId.set(r.id, v as unknown as Venue);
    } catch { /* a bad row leaves the place as it was */ }
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
