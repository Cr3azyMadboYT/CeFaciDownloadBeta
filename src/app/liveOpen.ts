// The check on Google before a plan is shown (decision Cornel, 06.10: "bagă la verificat dacă s-au închis, în afară
// de parcuri și locuri în aer liber"): the Supabase function e-deschis asks Google Maps whether each place is open at
// the time of its step, for the whole step. Parks, squares and promenades are not asked: they do not close.
// Results are cached for the exact requested interval, for an hour in memory. Only the id
// and the time leave the phone: the server takes the name and the position from its own list (07.10).


export type Live = { open: boolean | null; closes?: string; status?: string; checkedAt?: number; checkedUntil?: number };
export const checkedFor = (v: Live | undefined, at: Date, until?: Date) => !!v && v.checkedAt === at.getTime() && v.checkedUntil === until?.getTime();
const OPEN_AIR = new Set(['park', 'botanical_garden', 'nature_reserve', 'promenade', 'square', 'beach_resort']);
export const needsCheck = (k: string, cat: string) => !OPEN_AIR.has(k) && cat !== 'natura';

// what this phone already asked in the last hour (the same place, the exact same interval): asked again only after that, so
// rebuilding a plan or "Altă surpriză" does not ask Google again for the same places (only on the phone, for an hour)
/** Why a place cannot be used then, in Bilu's words (it may be open when you arrive but close before you leave). */
export function closedWhy(name: string, v: Live | undefined): string {
  return v?.closes ? name + ' se închide la ' + v.closes + ', înainte să terminați acolo (am verificat pe Google)' : name + ' e închis la ora aia (am verificat pe Google)';
}

export function createLiveChecker(invoke: (body: { items: { id: string; at: string; until?: string }[] }) => PromiseLike<{ data?: { checked?: Record<string, Live>; limit?: boolean } | null }>) {
  const asked = new Map<string, { at: number; v: Live }>();
  let pausedUntil = 0;
  const keyOf = (x: { id: string; at: Date; until?: Date }) => x.id + '|' + x.at.getTime() + '|' + (x.until ? x.until.getTime() : '');

  async function checkOpen(items: { id: string; name: string; lat: number; lon: number; at: Date; until?: Date }[]): Promise<Record<string, Live>> {
    if (!items.length) return {};
    const now = Date.now();
    const out: Record<string, Live> = {};
    const ask = items.filter((x) => { const h = asked.get(keyOf(x)); if (h && now - h.at < 3600e3) { out[x.id] = h.v; return false; } return true; });
    if (!ask.length || now < pausedUntil) return out;
    try {
      const call = invoke({ items: ask.slice(0, 12).map((x) => ({ id: x.id, at: x.at.toISOString(), until: x.until?.toISOString() })) });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const r = await Promise.race([call, new Promise<null>((ok) => { timeout = setTimeout(() => ok(null), 6000); })]).finally(() => clearTimeout(timeout));
      const data = (r as { data?: { checked?: Record<string, Live>; limit?: boolean } } | null)?.data;
      if (data?.limit) pausedUntil = now + 3600e3; // the day's free checks are used up: no more calls for an hour
      const got: Record<string, Live> = {};
      for (const x of ask) {
        const v = data?.checked?.[x.id];
        if (!v) continue;
        got[x.id] = { ...v, checkedAt: x.at.getTime(), checkedUntil: x.until?.getTime() };
        if (v.open !== null) asked.set(keyOf(x), { at: now, v: got[x.id] });
      }
      for (const [key, h] of asked) if (now - h.at >= 3600e3) asked.delete(key);
      return { ...out, ...got };
    } catch { return out; }
  }

  return { checkOpen, isClosed: (id: string, at: Date, until?: Date) => {
    const h = asked.get(keyOf({ id, at, until }));
    return !!h && Date.now() - h.at < 3600e3 && h.v.open === false;
  } };
}
