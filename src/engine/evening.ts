// "Seara completă" (decision Cornel, 04.10): not one place but an evening — dinner, then a bar, then a club — with
// times that follow each other, every place open at its moment and a short walk from the one before. Each step is
// scored by the same engine as single ideas (taste, open, the weather at that hour), with the previous place as the
// starting point.
import { KINDS } from './catalog';
import { adultOnly, km, priceOf, scoreVenue } from './core';
import { wxAt } from './weather';
import type { Ask, Cat, Ctx, Venue, Vibe, When, Who } from './types';

export type TemplateId = 'cina-bar' | 'noaptea' | 'cultura' | 'activ' | 'afara' | 'dulce';
interface StepSpec { cats?: Cat[]; kinds?: string[]; min: number; why: string }
interface Template { id: TemplateId; label: string; sub: string; steps: StepSpec[]; start: number; latest: number; earliest?: number; adult?: boolean; outdoor?: boolean; vibes: Vibe[] }

const FOOD = ['restaurant'];
const DRINK = ['bar', 'pub', 'biergarten'];
const PLAY = ['bowling_alley', 'escape_game', 'amusement_arcade', 'karting', 'billiards', 'trampoline_park', 'ice_rink', 'paintball', 'miniature_golf'];
export const TEMPLATES: Template[] = [
  { id: 'cina-bar', label: 'Cină și un pahar', sub: 'restaurant, apoi un bar aproape', start: 19.5, latest: 22.5, vibes: ['Mâncare bună', 'Chill'],
    steps: [{ kinds: FOOD, min: 100, why: 'Cina' }, { kinds: DRINK, min: 120, why: 'Un pahar după' }] },
  { id: 'noaptea', label: 'Seara lungă', sub: 'cină, bar, apoi club', start: 20, latest: 23, earliest: 18, adult: true, vibes: ['Party'],
    steps: [{ kinds: FOOD, min: 90, why: 'Cina' }, { kinds: DRINK, min: 100, why: 'Încălzirea' }, { kinds: ['nightclub'], min: 180, why: 'Dansul' }] },
  { id: 'cultura', label: 'Spectacol și cină', sub: 'film, teatru sau muzeu, apoi cină', start: 18.5, latest: 21, vibes: ['Cultură'],
    steps: [{ kinds: ['theatre', 'cinema', 'arts_centre', 'museum', 'gallery', 'planetarium'], min: 120, why: 'Spectacolul' }, { kinds: FOOD, min: 90, why: 'Cina' }] },
  { id: 'activ', label: 'Joacă, apoi masă', sub: 'bowling, escape sau sport, apoi mâncare și un pahar', start: 18, latest: 21.5, vibes: ['Fun', 'Competitiv'],
    steps: [{ kinds: [...PLAY, 'padel', 'tennis', 'soccer', 'climbing', 'squash'], min: 90, why: 'Joaca' }, { kinds: [...FOOD, 'fast_food'], min: 75, why: 'Masa' }, { kinds: DRINK, min: 90, why: 'Un pahar' }] },
  { id: 'afara', label: 'Ziua afară', sub: 'parc, o cafea, apoi masă', start: 12, latest: 17, earliest: 8, outdoor: true, vibes: ['Aer liber', 'Chill'],
    steps: [{ kinds: ['park', 'botanical_garden', 'nature_reserve', 'zoo'], min: 100, why: 'Plimbarea' }, { kinds: ['cafe', 'ice_cream'], min: 60, why: 'Cafeaua' }, { kinds: FOOD, min: 90, why: 'Masa' }] },
  { id: 'dulce', label: 'Ceva dulce și un film', sub: 'desert sau cafea, apoi cinema', start: 17, latest: 21, vibes: ['Chill'],
    steps: [{ kinds: ['ice_cream', 'cafe'], min: 60, why: 'Ceva dulce' }, { kinds: ['cinema'], min: 140, why: 'Filmul' }] },
];

export interface RouteStep { v: Venue; at: Date; until: Date; walk: number; why: string; price: number; reasons: string[] }
/** `drive`: the places are too far apart to walk (a small town): minutes between them are by car. */
export interface Route { id: TemplateId; label: string; sub: string; steps: RouteStep[]; price: number; score: number; note?: string; drive?: boolean }
export interface EveningAsk { who: Who; when: When; budget: number; maxKm: number; walkKm: number; vibes: Vibe[] }

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

const walkMin = (kmDist: number) => Math.max(2, Math.round((kmDist * 1000) / 80));
const inKinds = (v: Venue, s: StepSpec) => (s.kinds ? s.kinds.includes(v.k) : false) || (s.cats ? s.cats.includes(v.cat) : false);

/** One route for a template, or null when some step finds nothing open and near. `skip` makes other variants. */
export function buildRoute(all: Venue[], tpl: Template, ask: EveningAsk, ctx: Ctx, skip = 0, drive = false): Route | null {
  if (tpl.adult && ctx.minor) return null;
  let at = startOf(ask.when, tpl.start, ctx.now);
  // a night out does not start at 4 in the afternoon, a walk in the park not at midnight
  const h = at.getHours() + at.getMinutes() / 60 + (at.getHours() < 5 ? 24 : 0);
  if (h > tpl.latest || h < (tpl.earliest ?? 0)) return null;
  let from = ctx.origin;
  const used = new Set<string>();
  const steps: RouteStep[] = [];
  let total = 0;
  for (let i = 0; i < tpl.steps.length; i++) {
    const spec = tpl.steps[i];
    const radius = i === 0 ? ask.maxKm : ask.walkKm;
    const stepCtx: Ctx = { ...ctx, now: at, origin: from };
    const stepAsk: Ask = { who: ask.who, when: 'acum', budget: ask.budget, maxKm: radius, vibes: tpl.vibes.length ? tpl.vibes : ask.vibes };
    const ranked = all
      .filter((v) => inKinds(v, spec) && !used.has(v.id) && !(ctx.minor && adultOnly(v)))
      .map((v) => scoreVenue(v, stepAsk, stepCtx))
      .filter((s): s is NonNullable<typeof s> => !!s && (s.open.known ? s.open.open : true))
      // the next place close by matters more than in a single idea: a short walk keeps the group together
      .map((s) => ({ s, rank: s.score + (i > 0 ? 12 * (1 - s.km / Math.max(radius, 0.1)) : 0) }))
      .sort((a, b) => b.rank - a.rank);
    const pick = ranked[i === 0 ? Math.min(skip, ranked.length - 1) : 0]?.s;
    if (!pick) return null;
    const v = pick.v;
    const d = km(from, v);
    const walk = i === 0 ? 0 : drive ? Math.max(5, Math.round(3 + d * 2.4)) : walkMin(d);
    if (i > 0) at = new Date(at.getTime() + walk * 60e3);
    const until = new Date(at.getTime() + spec.min * 60e3);
    const price = priceOf(v);
    total += price;
    steps.push({ v, at, until, walk, why: spec.why, price, reasons: pick.reasons });
    used.add(v.id);
    from = v;
    at = until;
  }
  if (total > ask.budget * Math.max(1, steps.length) && ask.budget !== Infinity) return null;
  const score = steps.reduce((a, s) => a + s.reasons.length, 0);
  let note: string | undefined;
  const wet = steps.find((s) => wxAt(ctx.weather, s.at)?.wet && (tpl.outdoor || s.v.outdoor));
  if (wet) note = 'Pe la ' + String(wet.at.getHours()).padStart(2, '0') + ':00 plouă: stați înăuntru.';
  if (drive && !note) note = 'Locurile sunt mai departe unul de altul: între ele mergeți cu mașina sau cu taxiul.';
  return { id: tpl.id, label: tpl.label, sub: tpl.sub, steps, price: total, score, note, drive };
}

/** The evenings that work for this ask, the best fitting first (time of day, taste, weather). */
export function evenings(all: Venue[], ask: EveningAsk, ctx: Ctx, skip: Partial<Record<TemplateId, number>> = {}): Route[] {
  const out: { r: Route; fit: number }[] = [];
  for (const tpl of TEMPLATES) {
    // a small town may have no bar a walk away from the restaurant: then the same evening, by car
    const r = buildRoute(all, tpl, ask, ctx, skip[tpl.id] ?? 0) ?? buildRoute(all, tpl, { ...ask, walkKm: Math.max(ask.walkKm, 10), maxKm: Math.max(ask.maxKm, 10) }, ctx, skip[tpl.id] ?? 0, true);
    if (!r) continue;
    let fit = 0;
    const likes = [...ask.vibes, ...(ctx.prefs.likes as string[])];
    fit += tpl.vibes.filter((v) => likes.includes(v)).length * 3;
    const wx = wxAt(ctx.weather, r.steps[0].at);
    if (tpl.outdoor) fit += wx?.nice ? 6 : wx && (wx.wet || wx.cold) ? -20 : 0;
    if (ask.who === '1' && tpl.id === 'noaptea') fit -= 4;
    if ((ask.who === '34' || ask.who === '5') && (tpl.id === 'activ' || tpl.id === 'noaptea')) fit += 3;
    if (ask.who === '2' && (tpl.id === 'cina-bar' || tpl.id === 'cultura' || tpl.id === 'dulce')) fit += 3;
    if (r.drive) fit -= 2;
    out.push({ r, fit: fit + r.score * 0.2 });
  }
  return out.sort((a, b) => b.fit - a.fit).map((x) => x.r);
}

export const STEP_LABEL = (v: Venue) => KINDS[v.k]?.label ?? v.kind;
