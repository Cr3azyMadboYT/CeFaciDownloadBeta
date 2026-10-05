// The check on Google before a plan is shown (decision Cornel, 06.10: "bagă la verificat dacă s-au închis, în afară
// de parcuri și locuri în aer liber"): the Supabase function e-deschis asks Google Maps whether each place is open at
// the time of its step, for the whole step. Parks, squares and promenades are not asked: they do not close. Nothing of
// Google's is kept; a place found closed is only left out of the plans for the next 3 hours (in memory).
import { sb } from './auth';

export type Live = { open: boolean | null; closes?: string; status?: string };
const OPEN_AIR = new Set(['park', 'botanical_garden', 'nature_reserve', 'promenade', 'square', 'beach_resort']);
const closedUntil = new Map<string, number>();

/** The places found closed in the last 3 hours (left out of the next plans). */
export function closedNow(now = Date.now()): string[] {
  return [...closedUntil].filter(([, t]) => t > now).map(([id]) => id);
}
export const needsCheck = (k: string, cat: string) => !OPEN_AIR.has(k) && cat !== 'natura';

export async function checkOpen(items: { id: string; name: string; lat: number; lon: number; at: Date; until?: Date }[]): Promise<Record<string, Live>> {
  if (!items.length) return {};
  try {
    const call = (sb() as any).functions.invoke('e-deschis', { body: { items: items.slice(0, 12).map((x) => ({ ...x, at: x.at.toISOString(), until: x.until?.toISOString() })) } }); // eslint-disable-line @typescript-eslint/no-explicit-any
    const r = await Promise.race([call, new Promise<null>((ok) => setTimeout(() => ok(null), 6000))]);
    const got = ((r as { data?: { checked?: Record<string, Live> } } | null)?.data?.checked) ?? {};
    for (const [id, v] of Object.entries(got)) if (v.open === false) closedUntil.set(id, Date.now() + 3 * 3600e3);
    return got;
  } catch { return {}; }
}
