// "Creează plan" (decision Cornel, 04.10): not a list of 183 places but three plans ready to go, each one checked —
// open at its hour and long enough, how far and how long the way, the budget for the whole outing, the weather.
// "Un singur loc" gives three different places; "Toată seara" gives three different evenings (dinner then a bar, a
// show, a game…), from different families when the hour allows it, never the same place twice.
// Rethought for every hour (decision Cornel, 04.10 seara: "după ora 8 logica nu e bună… vreau perfecțiune"):
// - "Acum" means you leave now: each place is reached after the way there, and must be open then;
// - a place is kept only if it is open (hours on the map) or very likely open (its kind at that hour), and for long
//   enough (a film to its end, a dinner, not ten minutes before closing);
// - when the hour, the zone or the budget leave fewer than three plans, Bilu looks further, then wider, and says
//   what he changed; when there is really nothing (04:30), he says why instead of an empty screen.
import { KINDS } from './catalog';
import { closesAt, info, km, learnHours, needFit, openAt, priceOf, scoreVenue, stayAt, vibesOf, type Need } from './core';
import { buildEvening, carMin, eveningCands, walkMin, type EveningAsk, type EveningCand } from './evening';
import { hhmm, nightHour } from './time';
import { exposure, wxAt } from './weather';
import type { Ask, Ctx, OpenInfo, Scored, Venue, Vibe, Who } from './types';

export interface PlanReq {
  mode: 'loc' | 'seara';
  at: Date;                 // when you meet at the first place; with `now`, when you set off
  now?: boolean;            // "Acum": you leave now, so each place is reached after the way there
  people: number;
  budgetMin: number;        // lei per person
  budgetMax: number;        // lei per person for the whole outing; Infinity for any
  vibes: Vibe[];
  maxKm: number;            // how far the first place may be
  walkKm: number;           // how far the next place may be, on foot (small towns fall back to the car)
  outdoor?: boolean;        // "cu terasă"
  needs?: Need[];           // "fără fum", "wifi"…
  near?: boolean;           // "aproape"
  strict?: boolean;         // only within maxKm: no looking further
  car?: boolean;            // false: they only walk, so no driving between places
}
export type Way = 'walk' | 'car';
export interface PlanStep { v: Venue; at: Date; until: Date; travel: number; by: Way; why: string; price: number; open: OpenInfo; sure: boolean; reasons: string[] }
export interface Check { ok: boolean; text: string }
export interface MadePlan {
  id: string;
  title: string;
  sub: string;
  steps: PlanStep[];
  price: number;
  over?: number;            // lei over the budget, per person
  drive: boolean;           // the places are far apart: by car between them
  checks: Check[];
  tip?: { text: string; step: number; v: Venue };
  family: string;           // food, night, culture, play, day…: the three plans are different outings
  fits: boolean;            // it matches the vibes asked (or none were asked)
  note?: string;            // from the evening: rain at one step, the car between places
}
/** What Bilu changed to find plans: further away, wider still, without "fără fum"/"terasă", over the budget, not
 * only "aproape". */
export type Relax = 'far' | 'wider' | 'needs' | 'budget' | 'near';
export interface PlanSet { plans: MadePlan[]; req: PlanReq; relaxed: Relax[]; note?: string; empty?: string }

export const whoOf = (n: number): Who => (n <= 1 ? '1' : n === 2 ? '2' : n <= 4 ? '34' : '5');
export { carMin };
/** On foot up to 1,2 km, else by car or taxi. */
/** How they get to a place `d` km away: on foot when it is close, or always when they only walk (`car` false). */
export const wayOf = (d: number, car = true): Way => (d <= 1.2 || !car ? 'walk' : 'car');
export const minutesBy = (d: number, by: Way = wayOf(d)) => (by === 'walk' ? walkMin(d) : carMin(d));
const roundUp5 = (d: Date) => { const t = new Date(d.getTime()); t.setSeconds(0, 0); t.setMinutes(Math.ceil(t.getMinutes() / 5) * 5); return t; };
const kmText = (d: number) => (d < 1 ? Math.max(50, Math.round((d * 1000) / 50) * 50) + ' m' : d.toFixed(d < 10 ? 1 : 0).replace('.', ',') + ' km');

// one outing of each kind first, then the rest: "Altceva" is really something else
const GROUP: Record<string, string> = { mancare: 'food', cafea: 'food', desert: 'food', bar: 'night', club: 'night', film: 'culture', teatru: 'culture', cultura: 'culture', activitate: 'play', sport: 'play', natura: 'day' };
const groupOf = (v: Venue) => GROUP[v.cat] ?? v.cat;
/** How long you stay at one place (minutes), and the least that still makes sense: a film to its end, a game. */
const stayOf = (v: Venue) => Math.round(info(v).hours * 60);
const WHOLE: Record<string, number> = { cinema: 120, theatre: 120, escape_game: 60, bowling_alley: 60 };
const leastOf = (v: Venue) => Math.min(stayOf(v), WHOLE[v.k] ?? 45);

/** What "cu terasă", "fără fum" and "aproape" ask of one place: left out, or points. */
function extraFit(v: Venue, req: PlanReq): number | null {
  let pts = 0;
  if (req.outdoor && exposure(v) === 'in') return null;
  for (const n of req.needs ?? []) { const f = needFit(v, n); if (f.no) return null; pts += f.pts; }
  return pts;
}

const reach = (req: PlanReq) => (req.near ? Math.min(req.maxKm, 6) : req.maxKm);
function askOf(req: PlanReq): Ask {
  return { who: whoOf(req.people), when: 'acum', at: req.at, budget: req.budgetMax, budgetMin: req.budgetMin || undefined, maxKm: reach(req), vibes: req.vibes, people: req.people };
}

/** When you get to a place `d` km away: the hour asked, or — leaving now — after the way there. */
const arrival = (req: PlanReq, d: number) => (req.now ? roundUp5(new Date(req.at.getTime() + minutesBy(d, wayOf(d, req.car !== false)) * 60e3)) : new Date(req.at.getTime()));

/** "Deschis până la 23:00", "Deschis", or unknown hours. */
function openInfo(v: Venue, at: Date): OpenInfo {
  const o = openAt(v, at);
  if (!o.known) return o;
  const c = closesAt(v, at);
  return c ? { ...o, label: 'Deschis până la ' + hhmm(c) } : o;
}

interface Cand { s: Scored; at: Date; until: Date; sure: boolean; score: number }
/** Every place that works for the ask, best first: open (or very likely open) when you get there and for as long as
 * you would stay, within the budget and the distance, with what was asked of it. */
function rankAt(all: Venue[], req: PlanReq, ctx: Ctx): Cand[] {
  learnHours(all);
  const ask = askOf(req);
  const out: Cand[] = [];
  for (const v of all) {
    const d = km(ctx.origin, v);
    if (d > ask.maxKm) continue;
    const at = arrival(req, d);
    const s = scoreVenue(v, { ...ask, at }, ctx);
    if (!s) continue;
    const want = stayOf(v);
    const stay = stayAt(v, at, want);
    if (!stay.ok) continue;
    const minutes = (stay.until.getTime() - at.getTime()) / 60e3;
    if (minutes < leastOf(v)) continue;
    const extra = extraFit(v, req);
    if (extra === null) continue;
    // a plan is a promise: hours on the map and the whole stay come first
    const score = s.score + extra + (stay.sure ? 8 : 0) + 4 * Math.min(1, minutes / want) + (req.near ? 15 * Math.max(0, 1 - d / 5) : 0);
    out.push({ s, at, until: stay.until, sure: stay.sure, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

const vibeFit = (vibes: Vibe[], req: PlanReq) => !req.vibes.length || vibes.some((x) => req.vibes.includes(x));

function single(c: Cand, req: PlanReq, ctx: Ctx, title: string, sub: string, id: string): MadePlan {
  const v = c.s.v;
  const by = wayOf(c.s.km, req.car !== false);
  const step: PlanStep = { v, at: c.at, until: c.until, travel: minutesBy(c.s.km, by), by, why: KINDS[v.k]?.label ?? v.kind, price: priceOf(v), open: openInfo(v, c.at), sure: c.sure, reasons: c.s.reasons };
  return finish({ id, title, sub, steps: [step], price: step.price, drive: false, checks: [], family: groupOf(v), fits: vibeFit(vibesOf(v), req) }, req, ctx);
}

function fromRoute(c: EveningCand, req: PlanReq, ctx: Ctx): MadePlan {
  const r = c.r;
  const steps: PlanStep[] = r.steps.map((s, i) => {
    const d = km(i === 0 ? ctx.origin : r.steps[i - 1].v, s.v);
    const by: Way = i === 0 ? wayOf(d, req.car !== false) : r.drive ? 'car' : 'walk';
    return { v: s.v, at: s.at, until: s.until, travel: i === 0 ? minutesBy(d, by) : s.walk, by, why: s.why, price: s.price, open: openInfo(s.v, s.at), sure: s.sure, reasons: s.reasons };
  });
  return finish({ id: r.id, title: r.label, sub: r.sub, steps, price: r.price, over: r.over, drive: !!r.drive, checks: [], family: r.family, fits: vibeFit(r.vibes, req), note: r.note }, req, ctx);
}

/** The checks shown on the plan ("✓ Deschis la 20:00", "⚠ +35 peste buget"…) and the price over the budget. */
function finish(p: MadePlan, req: PlanReq, ctx: Ctx): MadePlan {
  const checks: Check[] = [];
  const shut = p.steps.find((s) => { const o = openAt(s.v, s.at); return o.known && !o.open; });
  const unsure = p.steps.filter((s) => !s.sure);
  if (shut) checks.push({ ok: false, text: shut.v.name + ' e închis la ' + hhmm(shut.at) });
  else if (!unsure.length) checks.push({ ok: true, text: p.steps.length > 1 ? 'Toate deschise la ora lor' : 'Deschis la ' + hhmm(p.steps[0].at) });
  else checks.push({ ok: false, text: 'Program neconfirmat la ' + unsure[0].v.name + (unsure[0].v.phone ? ': sunați înainte' : unsure[0].v.website ? ': vedeți pe site' : '') });
  const first = p.steps[0];
  const d = km(ctx.origin, first.v);
  if (req.now) checks.push({ ok: true, text: kmText(d) + ', ajungeți pe la ' + hhmm(first.at) });
  else checks.push({ ok: true, text: kmText(d) + ', ~' + first.travel + ' min ' + (first.by === 'walk' ? 'pe jos' : 'cu mașina') });
  const price = p.steps.reduce((a, s) => a + s.price, 0);
  const over = req.budgetMax !== Infinity && price > req.budgetMax ? price - req.budgetMax : undefined;
  if (req.budgetMax === Infinity) checks.push({ ok: true, text: '~' + price + ' lei de persoană' });
  else if (!over) checks.push({ ok: true, text: '~' + price + ' lei, în buget' });
  else checks.push({ ok: false, text: '~' + price + ' lei, +' + over + ' peste buget' });
  const wet = p.steps.map((s) => ({ s, w: wxAt(ctx.weather, s.at) })).find(({ s, w }) => w?.wet && exposure(s.v) !== 'in');
  const w0 = wxAt(ctx.weather, first.at);
  if (wet) checks.push({ ok: false, text: 'La ' + hhmm(wet.s.at) + ': ' + wet.w!.text + ', stați înăuntru' });
  else if (w0) checks.push({ ok: !w0.wet, text: w0.temp + '°, ' + w0.text });
  // a big group: a table for nine does not wait for you
  if (req.people >= 7 && p.steps.some((s) => s.v.cat === 'mancare' || s.v.cat === 'bar' || s.v.cat === 'club' || s.v.cat === 'activitate' || s.v.cat === 'sport')) checks.push({ ok: false, text: 'Sunteți ' + req.people + ': sunați să rezervați' });
  return { ...p, price, over, checks };
}

/** Whether `v` can take step `i` of a plan: open for that whole part, close to the places before and after, with what
 * was asked of it. Returns its score, or null. */
function fitsStep(v: Venue, p: MadePlan, i: number, req: PlanReq, ctx: Ctx, budget: number): { score: number; at: Date; until: Date; sure: boolean } | null {
  const s = p.steps[i];
  if (p.steps.some((x) => x.v.id === v.id)) return null;
  const from = i === 0 ? ctx.origin : p.steps[i - 1].v;
  const radius = i === 0 ? reach(req) : p.drive ? 10 : Math.max(req.walkKm, 1.2);
  const d = km(from, v);
  if (d > radius) return null;
  const after = p.steps[i + 1]?.v;
  if (after && km(v, after) > (p.drive ? 10 : Math.max(req.walkKm, 1.2))) return null; // still a walk to the next place
  // leaving now, a place further away is reached later: not later than the plan allows
  const at = i === 0 && req.now ? arrival(req, km(ctx.origin, v)) : s.at;
  if (at.getTime() > s.at.getTime() + 10 * 60e3) return null;
  const minutes = (s.until.getTime() - at.getTime()) / 60e3;
  const stay = stayAt(v, at, minutes);
  if (!stay.ok || stay.until.getTime() < s.until.getTime() - 5 * 60e3) return null;
  const sc = scoreVenue(v, { ...askOf(req), at, maxKm: Infinity, budget }, { ...ctx, origin: from });
  if (!sc) return null;
  const extra = extraFit(v, req);
  if (extra === null) return null;
  return { score: sc.score + extra + (stay.sure ? 8 : 0), at, until: stay.until.getTime() < s.until.getTime() ? stay.until : s.until, sure: stay.sure };
}

/** A cheaper place of the same kind for the dearest step, so the evening fits the budget (or comes closer). */
function cheaperTip(p: MadePlan, all: Venue[], req: PlanReq, ctx: Ctx): MadePlan['tip'] {
  if (!p.over || p.steps.length < 2) return undefined;
  let best: { step: number; v: Venue; save: number; score: number } | undefined;
  p.steps.forEach((s, i) => {
    for (const v of all) {
      if (v.cat !== s.v.cat || priceOf(v) >= s.price) continue;
      if (s.sure && !v.wk && !v.hours) continue; // not an unsure place for a sure one
      const f = fitsStep(v, p, i, req, ctx, s.price - 1);
      if (!f) continue;
      const save = s.price - priceOf(v);
      if (!best || save > best.save || (save === best.save && f.score > best.score)) best = { step: i, v, save, score: f.score };
    }
  });
  if (!best) return undefined;
  const total = p.price - best.save;
  return { step: best.step, v: best.v, text: 'Cu ' + best.v.name + ' în loc de ' + p.steps[best.step].v.name + ': ~' + total + ' lei' + (total <= req.budgetMax ? ', în buget.' : '.') };
}

/** Puts another place in one step (the tip, or "Alt bar") and checks the plan again. */
export function swapStep(p: MadePlan, i: number, v: Venue, req: PlanReq, ctx: Ctx): MadePlan {
  const s = p.steps[i];
  const at = i === 0 && req.now ? arrival(req, km(ctx.origin, v)) : s.at;
  const c = closesAt(v, at);
  const until = c && c.getTime() < s.until.getTime() ? c : s.until;
  const o = openAt(v, at);
  const sure = o.known && o.open;
  const steps = p.steps.map((x, k) => (k === i ? { ...x, v, at, until, open: openInfo(v, at), sure, price: priceOf(v), reasons: [] as string[] } : x)).map((x, k, list) => {
    // the way to this place and to the next one changed with the swap
    if (k !== i && k !== i + 1) return x;
    const d = km(k === 0 ? ctx.origin : list[k - 1].v, x.v);
    const by: Way = k === 0 ? wayOf(d, req.car !== false) : p.drive ? 'car' : 'walk';
    return { ...x, by, travel: minutesBy(d, by) };
  });
  return finish({ ...p, steps, tip: undefined }, req, ctx);
}

/** "Alt bar": the next best place of the same kind for one step, open for the whole step, not one already used or
 * shown, still a walk from the places before and after. */
export function altStep(p: MadePlan, i: number, all: Venue[], req: PlanReq, ctx: Ctx, seen: Set<string>): Venue | null {
  const s = p.steps[i];
  let best: { v: Venue; score: number } | null = null;
  for (const v of all) {
    if (seen.has(v.id) || groupOf(v) !== groupOf(s.v)) continue;
    const f = fitsStep(v, p, i, req, ctx, req.budgetMax === Infinity ? Infinity : Math.max(s.price, req.budgetMax - (p.price - s.price)));
    if (!f) continue;
    const score = f.score + (v.cat === s.v.cat ? 6 : 0) + (v.k === s.v.k ? 4 : 0);
    if (!best || score > best.score) best = { v, score };
  }
  return best?.v ?? null;
}

/** Three single places: the best, something else, the closest. */
function singles(ranked: Cand[], n: number, used: Set<string>, req: PlanReq, ctx: Ctx, topUp: boolean): MadePlan[] {
  const pool = ranked.filter((c) => !used.has(c.s.v.id));
  const first = pool[0];
  if (!first || n <= 0) return [];
  const take: [Cand, string, string][] = [[first, topUp ? 'Un singur loc' : 'Cel mai potrivit', KINDS[first.s.v.k]?.label ?? first.s.v.kind]];
  // "Altceva": another kind of outing that still has the vibe asked (Mâncare bună: a dessert after a restaurant)
  const fits = (c: Cand) => vibeFit(vibesOf(c.s.v), req);
  const other = pool.find((c) => groupOf(c.s.v) !== groupOf(first.s.v) && fits(c)) ?? pool.find((c) => c.s.v.k !== first.s.v.k && fits(c))
    ?? pool.find((c) => groupOf(c.s.v) !== groupOf(first.s.v)) ?? pool[1];
  if (other && n >= 2) take.push([other, 'Altceva', KINDS[other.s.v.k]?.label ?? other.s.v.kind]);
  // the closest of the good ones — of a third kind, when one is about as close
  const good = pool.slice(0, 40).filter((c) => !take.some(([x]) => x === c));
  const near = (good.some(fits) ? good.filter(fits) : good).sort((a, b) => a.s.km - b.s.km);
  const third = near.find((c) => !take.some(([x]) => x.s.v.k === c.s.v.k) && c.s.km <= (near[0]?.s.km ?? 0) + 0.6);
  const close = third ?? near[0];
  if (close && n >= 3) take.push([close, 'Cel mai aproape', kmText(close.s.km) + ' de tine']);
  return take.map(([c, title, sub], k) => single(c, req, ctx, title, sub, 'loc-' + (k + 1) + '-' + c.s.v.id));
}

/** Three evenings: the best fitting, then — when it costs little — other kinds of evening; never a place twice. */
function eveningsFor(all: Venue[], req: PlanReq, ctx: Ctx): MadePlan[] {
  const accept = (v: Venue) => extraFit(v, req);
  const eAsk: EveningAsk = { who: whoOf(req.people), when: 'acum', at: req.at, now: req.now, total: true, budget: req.budgetMax, maxKm: reach(req), walkKm: req.walkKm, vibes: req.vibes, people: req.people, accept, car: req.car };
  const cands = eveningCands(all, eAsk, ctx);
  const picked: EveningCand[] = [];
  const used = new Set<string>();
  const rebuilt = new Set<string>();
  while (picked.length < 3 && cands.length) {
    const adj = (c: EveningCand) => c.fit - 6 * picked.filter((x) => x.r.family === c.r.family).length;
    cands.sort((a, b) => adj(b) - adj(a));
    const c = cands.shift()!;
    if (c.r.steps.some((s) => used.has(s.v.id))) {
      // the same restaurant or bar as a plan above: the same evening, built again without them
      if (rebuilt.has(c.tpl.id)) continue;
      rebuilt.add(c.tpl.id);
      const again = buildEvening(all, c.tpl, { ...eAsk, accept: (v) => (used.has(v.id) ? null : accept(v)) }, ctx);
      if (again) cands.push(again);
      continue;
    }
    picked.push(c);
    for (const s of c.r.steps) used.add(s.v.id);
  }
  return picked.map((c) => fromRoute(c, req, ctx));
}

/** One pass: three plans for the request as it is. */
function tryPlans(all: Venue[], req: PlanReq, ctx: Ctx): MadePlan[] {
  const ranked = rankAt(all, req, ctx);
  if (req.mode === 'loc') return singles(ranked, 3, new Set(), req, ctx, false);
  const plans = eveningsFor(all, req, ctx);
  const used = new Set(plans.flatMap((p) => p.steps.map((s) => s.v.id)));
  return [...plans, ...singles(ranked, 3 - plans.length, used, req, ctx, true)];
}

const NEED_TEXT: Record<Need, string> = { wifi: 'wifi', nosmoke: 'fără fum', smoke: 'loc de fumat', wheel: 'acces cu scaun cu rotile', ac: 'aer condiționat' };

/** Three plans for the request, with what Bilu had to change to find them, or why there is none. */
export function makePlans(all: Venue[], req0: PlanReq, ctx: Ctx): PlanSet {
  let req = req0;
  let plans = tryPlans(all, req, ctx);
  let relaxed: Relax[] = [];
  // fewer than three: look further (a small town at night); nothing at all: let go, one more thing each time, of what
  // keeps them out — "aproape", "cu terasă", the budget (twice it, then any), then 40 km. Each step keeps the ones
  // before it, and Bilu says the ones that were needed.
  const ladder: [Relax, (r: PlanReq) => PlanReq | null][] = [
    ['far', (r) => (!r.near && !r.strict && r.maxKm < 40 ? { ...r, maxKm: [10, 20, 30, 40].find((k) => k >= r.maxKm * 2) ?? 40 } : null)],
    ['near', (r) => (r.near ? { ...r, near: false, maxKm: r.strict ? r.maxKm : Math.max(r.maxKm, 10) } : null)],
    ['needs', (r) => (r.outdoor || r.needs?.length ? { ...r, outdoor: undefined, needs: undefined } : null)],
    ['budget', (r) => (r.budgetMax !== Infinity && r.budgetMax < Math.max(50, req0.budgetMax * 2) ? { ...r, budgetMin: 0, budgetMax: Math.max(50, req0.budgetMax * 2) } : r.budgetMin > 0 ? { ...r, budgetMin: 0 } : null)],
    ['budget', (r) => (r.budgetMax !== Infinity ? { ...r, budgetMin: 0, budgetMax: Infinity } : null)],
    ['wider', (r) => (!r.strict && r.maxKm < 40 ? { ...r, near: false, maxKm: 40 } : null)],
  ];
  let cur = req0;
  const chain: Relax[] = [];
  for (const [why, step] of ladder) {
    if (plans.length >= 3 || (plans.length && why !== 'far')) break; // with something to show, only the distance grows
    const next = step(cur);
    if (!next) continue;
    cur = next;
    if (!chain.includes(why)) chain.push(why);
    const more = tryPlans(all, next, ctx);
    if (more.length > plans.length) { plans = more; req = next; relaxed = [...chain]; }
  }

  for (const p of plans) p.tip = cheaperTip(p, all, req, ctx);

  const notes: string[] = [];
  if (relaxed.includes('needs')) notes.push('N-am găsit nimic ' + [...(req0.outdoor ? ['cu terasă'] : []), ...(req0.needs ?? []).map((n) => 'cu ' + NEED_TEXT[n])].join(', ').replace('cu fără', 'fără') + ' deschis atunci: uite ce e deschis.');
  if (relaxed.includes('budget')) notes.push(req0.budgetMax === 0 ? 'Gratis nu e nimic deschis la ora asta: uite ce e mai ieftin.' : req0.budgetMin > 0 && req0.budgetMax === Infinity ? 'De la ' + req0.budgetMin + ' lei în sus nu e nimic deschis la ora asta: uite ce e.' : 'Cu ' + req0.budgetMax + ' lei de persoană nu iese nimic la ora asta: uite ce e cel mai aproape de buget.');
  if (relaxed.includes('near')) notes.push('Chiar lângă tine nu e nimic deschis atunci, așa că m-am uitat puțin mai departe.');
  else if (relaxed.includes('far') || relaxed.includes('wider')) notes.push('Prin apropiere n-am găsit destule la ora asta, așa că m-am uitat până la ' + req.maxKm + ' km.');
  const lone = plans.filter((p) => p.id.startsWith('loc-')).length;
  const linked = plans.length - lone;
  if (req.mode === 'seara' && lone) notes.push(!linked ? 'La ora asta nu se leagă o ieșire cu mai multe locuri: îți dau locuri bune, câte unul.' : 'Doar ' + (linked === 1 ? 'o ieșire' : linked + ' ieșiri') + ' cu mai multe locuri se leagă la ora asta; ' + (lone === 1 ? 'al treilea plan e un singur loc.' : 'restul sunt câte un singur loc.'));
  const hit = plans.filter((p) => p.fits).length;
  if (req.vibes.length && plans.length && hit < plans.length) {
    const said = '„' + req.vibes.join('”, „') + '”';
    notes.push(hit === 0 ? 'Pe ' + said + ' nu e nimic deschis la ora asta: uite ce e bun.' : 'Pe ' + said + (hit === 1 ? ' e un plan' : ' sunt ' + hit + ' planuri') + '; celelalte sunt ce mai e bun deschis la ora asta.');
  }
  if (plans.length && plans.length < 3 && !notes.length) notes.push('La ora asta am găsit doar ' + (plans.length === 1 ? 'un plan care se potrivește.' : 'două planuri care se potrivesc.'));
  let empty: string | undefined;
  if (!plans.length) {
    const h = nightHour(req0.at);
    empty = h >= 26.5 && h < 29 ? 'E ' + hhmm(req0.at) + ': aproape tot e închis acum. Hai să facem planul pentru diseară sau mâine.'
      : ctx.minor && h >= 21.5 ? 'La ora asta, pentru cei sub 18 ani, nu mai e nimic deschis prin apropiere.'
      : 'N-am găsit nimic deschis atunci, nici până la 40 km.';
  }
  // Bilu says one or two things, the most important first: a long speech is not read
  return { plans, req, relaxed, note: notes.slice(0, 2).join(' ') || undefined, empty };
}

export interface Suggestion { v: Venue; tag: string; line: string; at: Date }
/** "Bilu îți sugerează" on Acasă: two or three ideas without asking anything — by the weather, close by, by taste. */
export function suggest(all: Venue[], req: PlanReq, ctx: Ctx): Suggestion[] {
  const ranked = rankAt(all, req, ctx);
  const out: Suggestion[] = [];
  const used = new Set<string>();
  const add = (c: Cand | undefined, tag: string, line: (v: Venue) => string) => { if (c && !used.has(c.s.v.id)) { used.add(c.s.v.id); out.push({ v: c.s.v, tag, line: line(c.s.v), at: c.at }); } };
  const w = wxAt(ctx.weather, req.at);
  const evening = req.at.getHours() >= 17 || req.at.getHours() < 5;
  const when = req.now ? 'Acum' : evening ? 'Diseară' : 'Azi';
  if (w?.nice) add(ranked.find((x) => exposure(x.s.v) !== 'in'), when + ' e ' + w.text + ', ' + w.temp + '°', (v) => (exposure(v) === 'out' ? 'Afară la ' : 'Terasă la ') + v.name);
  else if (w?.wet) add(ranked.find((x) => exposure(x.s.v) === 'in'), when + ': ' + w.text + ', ' + w.temp + '°', (v) => 'La adăpost: ' + v.name);
  add(ranked.slice(0, 12).sort((a, b) => a.s.km - b.s.km)[0], 'Lângă tine', (v) => v.name);
  add(ranked.find((x) => !used.has(x.s.v.id)), 'Pe gustul tău', (v) => v.name);
  // still fewer than three (a quiet hour): the next best of another kind
  for (const c of ranked) { if (out.length >= 3) break; if (!used.has(c.s.v.id) && !out.some((o) => groupOf(o.v) === groupOf(c.s.v))) add(c, 'Altceva', (v) => v.name); }
  return out.slice(0, 3);
}

/** One place as a plan (a suggestion from Acasă). */
export function planForPlace(v: Venue, req: PlanReq, ctx: Ctx): MadePlan {
  const d = km(ctx.origin, v);
  const at = arrival(req, d);
  const stay = stayAt(v, at, stayOf(v));
  const until = stay.ok ? stay.until : new Date(at.getTime() + stayOf(v) * 60e3);
  const s = scoreVenue(v, { ...askOf(req), at, maxKm: Infinity, budget: Infinity, budgetMin: undefined }, ctx);
  const sc: Scored = s ?? { v, score: 0, km: d, open: openAt(v, at), reasons: [], parts: { gust: 0, ocazie: 0, calitate: 0, aproape: 0, nou: 0, gasca: 0 } };
  return single({ s: sc, at, until, sure: stay.sure, score: sc.score }, req, ctx, 'Ideea lui Bilu', KINDS[v.k]?.label ?? v.kind, 'loc-' + v.id);
}

/** The first places that fit, for the line under each question ("Se potrivesc: A · B · C"). */
export function previewNames(all: Venue[], req: PlanReq, ctx: Ctx, n = 3): string[] {
  return rankAt(all, { ...req, mode: 'loc' }, ctx).slice(0, n).map((c) => c.s.v.name);
}

/** How many places fit each vibe at that hour ("Ai chef de…": Party · 41 locuri). */
export function vibeCounts(all: Venue[], req: PlanReq, ctx: Ctx): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of rankAt(all, { ...req, vibes: [] }, ctx)) for (const x of vibesOf(c.s.v)) out[x] = (out[x] ?? 0) + 1;
  return out;
}
