// "Amestecă" in Explorează (Cornel, 22.10): the list in another order, but the first places still fit the person.
// The ranked list already follows what the app knows about them (likes from the account, the crew's votes, where they
// went); a mix draws the top from the best ~24 (better ranked = more likely, the ones just shown less likely) and
// only stirs the rest a little, so quality still goes down the list. Same seed, same order: the list does not jump on
// every render.

/** A small seeded random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `list` in a new order for `seed` (0 = as ranked). `before`: the ids that were on top, to show other ones first. */
export function mix<T extends { id: string }>(list: T[], seed: number, before: string[] = [], top = 8, pool = 24): T[] {
  if (!seed || list.length < 3) return list;
  const r = rng(seed);
  const cand = list.slice(0, Math.min(pool, list.length)).map((x, i) => ({ x, w: (1 / (1 + i * 0.15)) * (before.includes(x.id) ? 0.35 : 1) }));
  const first: T[] = [];
  while (first.length < Math.min(top, cand.length)) {
    const sum = cand.reduce((s, c) => s + c.w, 0);
    let pickAt = r() * sum;
    const i = cand.findIndex((c) => (pickAt -= c.w) <= 0);
    first.push(cand.splice(i === -1 ? cand.length - 1 : i, 1)[0].x);
  }
  const taken = new Set(first.map((x) => x.id));
  const rest = list.filter((x) => !taken.has(x.id));
  // the rest: shuffled inside windows of 8, so a good place never sinks to the bottom
  for (let s = 0; s < rest.length; s += 8) {
    const end = Math.min(rest.length, s + 8);
    for (let i = end - 1; i > s; i--) { const j = s + Math.floor(r() * (i - s + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  }
  return [...first, ...rest];
}

/** How long "Amestecă" waits before it can be pressed again (Cornel: „o dată la 2–3 secunde”). */
export const MIX_WAIT_MS = 2500;
