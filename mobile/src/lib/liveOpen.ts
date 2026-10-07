// The check on Google before a plan is shown (decision Cornel, 06.10: "bagă la verificat dacă s-au închis, în afară
// de parcuri și locuri în aer liber"): the Supabase function e-deschis asks Google Maps whether each place is open at
// the time of its step, for the whole step. Parks, squares and promenades are not asked: they do not close. Nothing of
// Google's is kept; a place found closed is only left out of the plans for the next 3 hours (in memory). Only the id
// and the time leave the phone: the server takes the name and the position from its own list (07.10).
import { sb } from './auth';

export type Live = { open: boolean | null; closes?: string; status?: string };
const OPEN_AIR = new Set(['park', 'botanical_garden', 'nature_reserve', 'promenade', 'square', 'beach_resort']);
const closedUntil = new Map<string, number>();

/** The places found closed in the last 3 hours (left out of the next plans). */
export function closedNow(now = Date.now()): string[] {
  return [...closedUntil].filter(([, t]) => t > now).map(([id]) => id);
}
export const needsCheck = (k: string, cat: string) => !OPEN_AIR.has(k) && cat !== 'natura';

// what this phone already asked in the last hour (the same place, the same half hour): asked again only after that, so
// rebuilding a plan or "Altă surpriză" does not ask Google again for the same places (only on the phone, for an hour)
const asked = new Map<string, { at: number; v: Live }>();
let pausedUntil = 0;
const keyOf = (x: { id: string; at: Date; until?: Date }) => x.id + '|' + Math.floor(x.at.getTime() / 18e5) + '|' + (x.until ? Math.floor(x.until.getTime() / 18e5) : '');

/** Why a place cannot be used then, in Bilu's words (it may be open when you arrive but close before you leave). */
export function closedWhy(name: string, v: Live | undefined): string {
  return v?.closes ? name + ' se închide la ' + v.closes + ', înainte să terminați acolo (am verificat pe Google)' : name + ' e închis la ora aia (am verificat pe Google)';
}

export async function checkOpen(items: { id: string; name: string; lat: number; lon: number; at: Date; until?: Date }[]): Promise<Record<string, Live>> {
  if (!items.length) return {};
  const now = Date.now();
  const out: Record<string, Live> = {};
  const ask = items.filter((x) => { const h = asked.get(keyOf(x)); if (h && now - h.at < 3600e3) { out[x.id] = h.v; return false; } return true; });
  if (!ask.length || now < pausedUntil) return out;
  try {
    const call = (sb() as any).functions.invoke('e-deschis', { body: { items: ask.slice(0, 12).map((x) => ({ id: x.id, at: x.at.toISOString(), until: x.until?.toISOString() })) } }); // eslint-disable-line @typescript-eslint/no-explicit-any
    const r = await Promise.race([call, new Promise<null>((ok) => setTimeout(() => ok(null), 6000))]);
    const data = (r as { data?: { checked?: Record<string, Live>; limit?: boolean } } | null)?.data;
    if (data?.limit) pausedUntil = now + 3600e3; // the day's free checks are used up: no more calls for an hour
    const got = data?.checked ?? {};
    for (const x of ask) { const v = got[x.id]; if (v && v.open !== null) asked.set(keyOf(x), { at: now, v }); }
    for (const [id, v] of Object.entries(got)) if (v.open === false) closedUntil.set(id, now + 3 * 3600e3);
    return { ...out, ...got };
  } catch { return out; }
}
