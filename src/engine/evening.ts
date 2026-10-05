// "Seara completă" (decision Cornel, 04.10): not one place but an outing — dinner, then a bar, then a club — with
// times that follow each other, every place open when you get there and long enough, the next one a short walk away.
// Rethought for the hour (decision Cornel, 04.10 seara: "după ora 8 logica nu e bună"): each part of the evening has
// the hours it makes sense at — dinner until 22:15, a club from 22:30, a museum or a park only by day, a snack after the
// club — so at 23:00 Bilu builds a night ("un pahar, apoi club", "club până târziu"), not a dinner. Each step is
// scored by the same engine as single ideas (taste, open, weather), from the previous place.
import { KINDS } from './catalog';
import { adultOnly, km, learnHours, priceOf, scoreVenue, stayAt } from './core';
import { nightHour } from './time';
import { wxAt } from './weather';
import type { Ask, Ctx, Venue, Vibe, When, Who } from './types';

export type SlotId = 'masa' | 'pahar' | 'club' | 'joaca' | 'spectacol' | 'film' | 'dulce' | 'cafea' | 'plimbare' | 'cultura' | 'gustare';
interface Slot {
  kinds: string[];
  min: number;                   // how long you usually stay, minutes
  windows: [number, number][];   // when it makes sense to start it (hours; after midnight > 24)
  why: (h: number) => string;
  adult?: boolean;               // not for under 18
  stretch?: boolean;             // you can stay longer, waiting for the next part (a bar before the club opens)
  whole?: number;                // it cannot be cut short: at least this many minutes (a film, a show, a game)
}
const PLAY = ['escape_game', 'amusement_arcade', 'bowling_alley', 'billiards', 'karting', 'trampoline_park', 'ice_rink', 'climbing', 'padel', 'tennis', 'soccer', 'squash', 'miniature_golf', 'paintball'];
export const SLOTS: Record<SlotId, Slot> = {
  masa: { kinds: ['restaurant'], min: 95, windows: [[12, 15.5], [17.5, 22.25]], why: (h) => (h < 16 ? 'Prânzul' : 'Cina') },
  pahar: { kinds: ['bar', 'pub', 'biergarten'], min: 105, windows: [[16, 26]], why: () => 'Un pahar', adult: true, stretch: true },
  club: { kinds: ['nightclub'], min: 180, windows: [[22.5, 27.5]], why: () => 'Dansul', adult: true },
  joaca: { kinds: PLAY, min: 85, windows: [[10, 21.75]], why: () => 'Joacă', whole: 60 },
  spectacol: { kinds: ['theatre', 'arts_centre'], min: 130, windows: [[17.5, 20.25]], why: () => 'Spectacolul', whole: 120 },
  film: { kinds: ['cinema'], min: 130, windows: [[11, 22]], why: () => 'Filmul', whole: 120 },
  dulce: { kinds: ['ice_cream', 'cafe'], min: 50, windows: [[11, 21.5]], why: () => 'Ceva dulce' },
  cafea: { kinds: ['cafe'], min: 60, windows: [[8, 20]], why: () => 'O cafea' },
  plimbare: { kinds: ['park', 'botanical_garden', 'nature_reserve'], min: 80, windows: [[8, 20]], why: () => 'Plimbarea' },
  cultura: { kinds: ['museum', 'gallery', 'planetarium', 'castle', 'palace', 'manor'], min: 90, windows: [[9.5, 17.5]], why: () => 'Muzeul' },
  gustare: { kinds: ['fast_food'], min: 35, windows: [[22, 29]], why: () => 'Ceva de mâncat' },
};

export type TemplateId = 'cina-bar' | 'noaptea' | 'pahar-club' | 'club-gustare' | 'doua-baruri' | 'cultura' | 'film-cina' | 'film-pahar' | 'activ' | 'joaca-pahar' | 'dulce' | 'afara' | 'cultura-zi';
export interface Template {
  id: TemplateId; label: string; sub: string;
  alone?: string;                // the title when the optional part is left out ("Spectacol și cină" without the dinner)
  steps: { slot: SlotId; optional?: boolean }[];
  vibes: Vibe[];
  ideal: number;                 // the hour it fits best (for "diseară" without an hour, and to rank by the hour asked)
  family: 'food' | 'night' | 'culture' | 'play' | 'day';
  outdoor?: boolean;
}
export const TEMPLATES: Template[] = [
  { id: 'cina-bar', label: 'Cină și un pahar', sub: 'restaurant, apoi un bar aproape', steps: [{ slot: 'masa' }, { slot: 'pahar' }], vibes: ['Mâncare bună', 'Chill'], ideal: 20, family: 'food' },
  { id: 'noaptea', label: 'Seara lungă', sub: 'cină, bar, apoi club', steps: [{ slot: 'masa' }, { slot: 'pahar' }, { slot: 'club' }], vibes: ['Party', 'Mâncare bună'], ideal: 20.5, family: 'night' },
  { id: 'pahar-club', label: 'Un pahar, apoi club', sub: 'încălzirea la bar, apoi dansul', steps: [{ slot: 'pahar' }, { slot: 'club' }], vibes: ['Party'], ideal: 22, family: 'night' },
  { id: 'club-gustare', label: 'Club până târziu', sub: 'dansul, apoi ceva de mâncat', steps: [{ slot: 'club' }, { slot: 'gustare', optional: true }], vibes: ['Party'], ideal: 23.5, family: 'night' },
  { id: 'doua-baruri', label: 'Două baruri, la pas', sub: 'un pahar, apoi altul aproape', steps: [{ slot: 'pahar' }, { slot: 'pahar' }], vibes: ['Chill', 'Party'], ideal: 21.5, family: 'night' },
  { id: 'cultura', label: 'Spectacol și cină', alone: 'Un spectacol', sub: 'teatru, apoi cină', steps: [{ slot: 'spectacol' }, { slot: 'masa', optional: true }], vibes: ['Cultură'], ideal: 19, family: 'culture' },
  { id: 'film-cina', label: 'Cină și film', sub: 'întâi masa, apoi filmul', steps: [{ slot: 'masa' }, { slot: 'film' }], vibes: ['Chill', 'Cultură'], ideal: 18.5, family: 'culture' },
  { id: 'film-pahar', label: 'Film, apoi un pahar', sub: 'cinema, apoi un bar aproape', steps: [{ slot: 'film' }, { slot: 'pahar' }], vibes: ['Chill', 'Cultură'], ideal: 19.5, family: 'culture' },
  { id: 'activ', label: 'Joacă, apoi masă', sub: 'escape, jocuri sau sport, apoi mâncare și un pahar', steps: [{ slot: 'joaca' }, { slot: 'masa' }, { slot: 'pahar', optional: true }], vibes: ['Fun', 'Competitiv'], ideal: 18, family: 'play' },
  { id: 'joaca-pahar', label: 'Joacă, apoi un pahar', sub: 'escape, jocuri sau sport, apoi un bar', steps: [{ slot: 'joaca' }, { slot: 'pahar' }], vibes: ['Fun', 'Competitiv'], ideal: 20.5, family: 'play' },
  { id: 'dulce', label: 'Ceva dulce și un film', sub: 'desert sau cafea, apoi cinema', steps: [{ slot: 'dulce' }, { slot: 'film' }], vibes: ['Chill'], ideal: 17.5, family: 'culture' },
  { id: 'afara', label: 'Parc, cafea și masă', sub: 'o plimbare, o cafea, apoi masa', steps: [{ slot: 'plimbare' }, { slot: 'cafea' }, { slot: 'masa', optional: true }], vibes: ['Aer liber', 'Chill'], ideal: 12, family: 'day', outdoor: true },
  { id: 'cultura-zi', label: 'Muzeu și o cafea', sub: 'cultură, apoi o cafea aproape', steps: [{ slot: 'cultura' }, { slot: 'cafea' }, { slot: 'masa', optional: true }], vibes: ['Cultură', 'Chill'], ideal: 12.5, family: 'day' },
];

export interface RouteStep { v: Venue; at: Date; until: Date; walk: number; why: string; price: number; reasons: string[]; closes?: Date; sure: boolean }
/** `drive`: the places are too far apart to walk (a small town): minutes between them are by car. */
export interface Route { id: TemplateId; label: string; sub: string; steps: RouteStep[]; price: number; score: number; note?: string; drive?: boolean; over?: number; family: Template['family']; vibes: Vibe[] }
/** `at`: the exact start ("Creează plan"); `now`: you leave now, so you get to the first place after the way there;
 * `total`: the budget is for the whole evening, per person (a route may go up to a third over it, and says by how much);
 * `accept`: what else a place must have ("cu terasă", "fără fum", not already in another plan): null leaves it out,
 * a number adds to its score. */
export interface EveningAsk { who: Who; when: When; budget: number; maxKm: number; walkKm: number; vibes: Vibe[]; at?: Date; now?: boolean; total?: boolean; people?: number; accept?: (v: Venue) => number | null; car?: boolean }

const roundUp5 = (d: Date) => { const t = new Date(d.getTime()); t.setSeconds(0, 0); t.setMinutes(Math.ceil(t.getMinutes() / 5) * 5); return t; };
const roundUp15 = (d: Date) => { const t = new Date(d.getTime()); t.setSeconds(0, 0); t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15); return t; };
/** When the evening starts: now (rounded up), or the template's usual hour on the chosen day. */
export function startOf(when: When, hour: number, now: Date): Date {
  if (when === 'acum') return roundUp15(new Date(now.getTime() + 10 * 60e3));
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (when === 'maine') d.setDate(d.getDate() + 1);
  if (when === 'weekend') d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
  if (d.getTime() < now.getTime()) return roundUp15(new Date(now.getTime() + 10 * 60e3));
  return d;
}

export const walkMin = (kmDist: number) => Math.max(2, Math.round((kmDist * 1000) / 80));
export const carMin = (kmDist: number) => Math.max(3, Math.round(3 + kmDist * 2.4));
const inWindow = (slot: Slot, t: Date) => { const h = nightHour(t); return slot.windows.some(([a, b]) => h >= a && h <= b); };
const windowStart = (slot: Slot, t: Date) => { const h = nightHour(t); const w = slot.windows.find(([a]) => a > h); return w ? w[0] : null; };
/** Whether the evening can begin at this hour at all (a museum at 23:00 cannot): saves building it for nothing.
 * Leaving now, the first place is reached up to ~45 minutes later. */
export function canStart(tpl: Template, at: Date, now = false): boolean {
  const slot = SLOTS[tpl.steps[0].slot];
  const h = nightHour(at);
  return slot.windows.some(([a, b]) => (now ? h + 0.75 >= a : h >= a) && h <= b);
}

// the venues of each kind, made once: a step looks only at the kinds it needs (fast on a phone)
let indexed: Venue[] | null = null;
const byKind = new Map<string, Venue[]>();
function kindsOf(all: Venue[], kinds: string[]): Venue[] {
  if (indexed !== all) {
    indexed = all; byKind.clear();
    for (const v of all) { const a = byKind.get(v.k); if (a) a.push(v); else byKind.set(v.k, [v]); }
  }
  return kinds.flatMap((k) => byKind.get(k) ?? []);
}

/** One route for a template, or null when some part finds nothing open, near and at a sensible hour. `skip` makes
 * other variants (the n-th best first place). */
export function buildRoute(all: Venue[], tpl: Template, ask: EveningAsk, ctx: Ctx, skip = 0, drive = false): Route | null {
  learnHours(all);
  const steps0 = tpl.steps.filter((s) => !(ctx.minor && SLOTS[s.slot].adult && s.optional));
  if (steps0.some((s) => ctx.minor && SLOTS[s.slot].adult)) return null; // a bar or a club is the point of it: not for under 18
  const start = ask.at ? new Date(ask.at.getTime()) : startOf(ask.when, tpl.ideal, ctx.now);
  let from: { lat: number; lon: number } = ctx.origin;
  const used = new Set<string>();
  const steps: RouteStep[] = [];
  let total = 0;
  let clock = start; // when the previous part ends (or when you set off)
  const picked: number[] = []; // the score of each place chosen
  for (let i = 0; i < steps0.length; i++) {
    const spec = steps0[i];
    const slot = SLOTS[spec.slot];
    const radius = i === 0 ? ask.maxKm : drive ? Math.max(ask.walkKm, 10) : ask.walkKm;
    const stepAsk: Ask = { who: ask.who, when: 'acum', budget: ask.budget, maxKm: radius, vibes: tpl.vibes.length ? tpl.vibes : ask.vibes, people: ask.people };
    const ranked: Cand[] = [];
    for (const v of kindsOf(all, slot.kinds)) {
      if (used.has(v.id) || (ctx.minor && adultOnly(v))) continue;
      const d = km(from, v);
      if (d > radius) continue;
      // every place stays within how far they would go (a walk past its edge is fine; a drive is not)
      if (i > 0 && km(ctx.origin, v) > ask.maxKm + (drive ? 0 : 1.2)) continue;
      const extra = ask.accept ? ask.accept(v) : 0;
      if (extra === null) continue;
      // when you get there: the time asked for the first place (or now + the way there), after the way for the next ones
      const travel = i === 0 ? (ask.now ? (d <= 1.2 || ask.car === false ? walkMin(d) : carMin(d)) : 0) : drive ? carMin(d) : walkMin(d);
      let arrive = i === 0 ? (ask.now ? roundUp5(new Date(start.getTime() + travel * 60e3)) : start) : new Date(clock.getTime() + travel * 60e3);
      let stretched = 0;
      if (!inWindow(slot, arrive)) {
        // too early for this part (a club before 22:30): stay longer at the bar before, up to 75 minutes
        const ws = i > 0 ? windowStart(slot, arrive) : null;
        const prev = steps[i - 1];
        if (ws === null || !prev || !SLOTS[steps0[i - 1].slot].stretch) continue;
        const need = Math.round((ws - nightHour(arrive)) * 60);
        if (need > 75) continue;
        const longer = stayAt(prev.v, prev.at, (prev.until.getTime() - prev.at.getTime()) / 60e3 + need);
        if (!longer.ok || longer.until.getTime() < prev.until.getTime() + need * 60e3) continue;
        stretched = need;
        arrive = new Date(arrive.getTime() + need * 60e3);
      }
      const stay = stayAt(v, arrive, slot.min);
      if (!stay.ok) continue;
      const minutes = (stay.until.getTime() - arrive.getTime()) / 60e3;
      if (slot.whole && minutes < slot.whole) continue; // a film is not left halfway because the cinema closes
      const sc = scoreVenue(v, { ...stepAsk, at: arrive }, { ...ctx, now: arrive, origin: from });
      if (!sc) continue;
      // the next place close by matters more than in a single idea: a short walk keeps the group together
      // a short walk keeps the group together; a place open for the whole stay beats one that closes soon after you come
      const score = sc.score + extra + (i > 0 ? 12 * (1 - d / Math.max(radius, 0.1)) : 0) + (stay.sure ? 6 : 0) + 8 * Math.min(1, minutes / slot.min);
      ranked.push({ v, arrive, until: stay.until, travel, sure: stay.sure, closes: stay.closes, score, reasons: sc.reasons, stretched });
    }
    ranked.sort((a, b) => b.score - a.score);
    const best = ranked[i === 0 ? Math.min(skip, Math.max(0, ranked.length - 1)) : 0];
    if (!best) {
      if (spec.optional && steps.length) break; // the last, optional part (a snack, a drink) is left out
      return null;
    }
    // waited for this part at the place before (a bar until the club opens)
    if (best.stretched && steps.length) steps[steps.length - 1] = { ...steps[steps.length - 1], until: new Date(steps[steps.length - 1].until.getTime() + best.stretched * 60e3) };
    const price = priceOf(best.v);
    total += price;
    steps.push({ v: best.v, at: best.arrive, until: best.until, walk: best.travel, why: slot.why(nightHour(best.arrive)), price, reasons: best.reasons, closes: best.closes ?? undefined, sure: best.sure });
    used.add(best.v.id);
    picked.push(best.score);
    from = best.v;
    clock = best.until;
  }
  if (!steps.length) return null;
  if (ask.budget !== Infinity && total > (ask.total ? ask.budget * 1.35 : ask.budget * Math.max(1, steps.length))) return null;
  const over = ask.total && ask.budget !== Infinity && total > ask.budget ? total - ask.budget : undefined;
  const score = picked.reduce((a, x) => a + x, 0) / Math.max(1, picked.length);
  let note: string | undefined;
  const wet = steps.find((s) => wxAt(ctx.weather, s.at)?.wet && (tpl.outdoor || s.v.outdoor));
  if (wet) note = 'Pe la ' + String(wet.at.getHours()).padStart(2, '0') + ':00 plouă: stați înăuntru.';
  if (drive && !note) note = 'Locurile sunt mai departe unul de altul: între ele mergeți cu mașina sau cu taxiul.';
  // by day the meal is lunch: "Prânz și film", not "Cină și film"
  const lunch = steps.some((s) => s.why === 'Prânzul');
  const say = (s: string) => (lunch ? s.replace('Cină', 'Prânz').replace('cină', 'prânz').replace('Cina', 'Prânzul') : s);
  // a part left out (the snack after the club) is not promised in the title
  const sub = steps.length < steps0.length ? steps.map((s) => s.why.toLowerCase()).join(', apoi ') : tpl.sub;
  // by car between the places: not "la pas"
  const label = (steps.length < steps0.length && tpl.alone ? tpl.alone : tpl.label).replace(', la pas', drive ? '' : ', la pas');
  return { id: tpl.id, label: say(label), sub: say(sub), steps, price: total, score, note, drive, over, family: tpl.family, vibes: tpl.vibes };
}
type Cand = { v: Venue; arrive: Date; until: Date; travel: number; sure: boolean; closes: Date | null; score: number; reasons: string[]; stretched: number };

/** How well a template fits the ask: the vibes, the hour, who comes, the weather. */
function fitOf(tpl: Template, r: Route, ask: EveningAsk, ctx: Ctx): number {
  let fit = 0;
  const likes = ctx.prefs.likes as string[];
  fit += tpl.vibes.filter((v) => ask.vibes.includes(v)).length * 4 + tpl.vibes.filter((v) => likes.includes(v)).length * 2;
  if (ask.vibes.length && !tpl.vibes.some((v) => ask.vibes.includes(v))) fit -= 8; // asked for party: a film is not first
  // the hour it is best at; a night out too early (two bars at 18:00) costs more than a dinner a little late
  const dh = nightHour(r.steps[0].at) - tpl.ideal;
  fit -= Math.min(12, Math.abs(dh) * (dh < 0 && tpl.family === 'night' ? 3 : 2));
  const wx = wxAt(ctx.weather, r.steps[0].at);
  if (tpl.outdoor) fit += wx?.nice ? 6 : wx && (wx.wet || wx.cold) ? -20 : 0;
  const n = ask.people ?? (ask.who === '1' ? 1 : ask.who === '2' ? 2 : ask.who === '34' ? 4 : 6);
  if (n === 1 && (tpl.family === 'night' || tpl.id === 'activ' || tpl.id === 'joaca-pahar')) fit -= 4;
  if (n === 2 && (tpl.id === 'cina-bar' || tpl.id === 'cultura' || tpl.id === 'film-cina' || tpl.id === 'dulce')) fit += 3;
  if (n >= 3 && (tpl.family === 'play' || tpl.family === 'night')) fit += 3;
  if (r.drive) fit -= 2;
  if (r.over) fit -= (r.over / Math.max(ask.budget, 1)) * 18; // over the budget: after the ones that fit (5 lei over is almost in)
  if (r.steps.length < tpl.steps.length) fit -= 1;
  fit += r.steps.filter((s) => s.sure).length * 0.8; // hours on the map: a surer evening
  return fit + r.score * 0.08;
}

/** One evening that can be made, with how well it fits the ask. */
export interface EveningCand { tpl: Template; r: Route; fit: number }

/** Builds one template for the ask: on foot first, then — a small town may have no bar a walk away from the
 * restaurant — the same evening by car (not for those who only walk: `car: false`). The first place stays within
 * `maxKm` either way: going further is the planner's call, said out loud. */
export function buildEvening(all: Venue[], tpl: Template, ask: EveningAsk, ctx: Ctx, skip = 0): EveningCand | null {
  const start = ask.at ?? startOf(ask.when, tpl.ideal, ctx.now);
  if (!canStart(tpl, start, ask.now || !ask.at)) return null;
  const r = buildRoute(all, tpl, ask, ctx, skip) ?? (ask.car === false ? null : buildRoute(all, tpl, { ...ask, walkKm: Math.max(ask.walkKm, 10) }, ctx, skip, true));
  return r ? { tpl, r, fit: fitOf(tpl, r, ask, ctx) } : null;
}

/** Every evening that works for this ask, the best fitting first (time of day, taste, weather). */
export function eveningCands(all: Venue[], ask: EveningAsk, ctx: Ctx, skip: Partial<Record<TemplateId, number>> = {}): EveningCand[] {
  const out: EveningCand[] = [];
  for (const tpl of TEMPLATES) { const c = buildEvening(all, tpl, ask, ctx, skip[tpl.id] ?? 0); if (c) out.push(c); }
  return out.sort((a, b) => b.fit - a.fit);
}

/** The evenings that work for this ask, the best fitting first. */
export function evenings(all: Venue[], ask: EveningAsk, ctx: Ctx, skip: Partial<Record<TemplateId, number>> = {}): Route[] {
  return eveningCands(all, ask, ctx, skip).map((c) => c.r);
}

export const STEP_LABEL = (v: Venue) => KINDS[v.k]?.label ?? v.kind;
