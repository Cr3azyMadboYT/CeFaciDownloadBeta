// "Creează plan" (decision Cornel, 04.10): not a list of 183 places but three plans ready to go, each one checked —
// open at its hour, how far, the budget for the whole outing, the weather. "Un singur loc" gives three different
// places; "Toată seara" gives three different evenings (dinner then a bar, a show then dinner…), with a tip when an
// evening goes over the budget. The places are chosen by the same engine as everywhere else (scoreVenue, evenings).
import { KINDS } from './catalog';
import { closesAt, info, km, needFit, openAt, priceOf, scoreVenue, type Need } from './core';
import { evenings, type Route, type TemplateId } from './evening';
import { exposure, wxAt } from './weather';
import type { Ask, Ctx, OpenInfo, Scored, Venue, Vibe, Who } from './types';

export interface PlanReq {
  mode: 'loc' | 'seara';
  at: Date;                 // the day and hour
  people: number;
  budgetMin: number;        // lei per person
  budgetMax: number;        // lei per person for the whole outing; Infinity for any
  vibes: Vibe[];
  maxKm: number;            // how far the first place may be
  walkKm: number;           // how far the next place may be, on foot (small towns fall back to the car)
  outdoor?: boolean;        // "cu terasă"
  needs?: Need[];           // "fără fum", "wifi"…
  near?: boolean;           // "aproape"
}
export interface PlanStep { v: Venue; at: Date; until: Date; travel: number; why: string; price: number; open: OpenInfo; reasons: string[] }
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
}

export const whoOf = (n: number): Who => (n <= 1 ? '1' : n === 2 ? '2' : n <= 4 ? '34' : '5');
/** Minutes by car (or taxi) for a distance, as on the place cards. */
export const carMin = (d: number) => Math.max(3, Math.round(3 + d * 2.4));
const hh = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const kmText = (d: number) => (d < 1 ? Math.max(50, Math.round((d * 1000) / 50) * 50) + ' m' : d.toFixed(d < 10 ? 1 : 0).replace('.', ',') + ' km');

// one outing of each kind first, then the rest: "Altceva" is really something else
const GROUP: Record<string, string> = { mancare: 'food', cafea: 'food', desert: 'food', bar: 'night', club: 'night', film: 'culture', teatru: 'culture', cultura: 'culture', activitate: 'play', sport: 'play', natura: 'out' };
const groupOf = (v: Venue) => GROUP[v.cat] ?? v.cat;

/** What "cu terasă", "fără fum" and "aproape" ask of one place: left out, or points. */
function extraFit(v: Venue, req: PlanReq): number | null {
  let pts = 0;
  if (req.outdoor && exposure(v) === 'in') return null;
  for (const n of req.needs ?? []) { const f = needFit(v, n); if (f.no) return null; pts += f.pts; }
  return pts;
}

function askOf(req: PlanReq): Ask {
  return {
    who: whoOf(req.people), when: 'acum', at: req.at,
    budget: req.budgetMax, budgetMin: req.budgetMin || undefined,
    maxKm: req.near ? Math.min(req.maxKm, 6) : req.maxKm, vibes: req.vibes,
  };
}

/** Every place that works at that hour for that ask, best first; open at least an hour after you arrive. */
export function rankAt(all: Venue[], req: PlanReq, ctx: Ctx): Scored[] {
  const ask = askOf(req);
  const out: Scored[] = [];
  for (const v of all) {
    const s = scoreVenue(v, ask, ctx);
    if (!s || (s.open.known && !s.open.open)) continue;
    const c = closesAt(v, req.at);
    if (c && c.getTime() - req.at.getTime() < 60 * 60e3) continue;
    const extra = extraFit(v, req);
    if (extra === null) continue;
    // a plan is a promise: places whose hours we know come first
    out.push({ ...s, score: s.score + extra + (s.open.known ? 8 : 0) + (req.near ? 15 * Math.max(0, 1 - s.km / 5) : 0) });
  }
  return out.sort((a, b) => b.score - a.score);
}

function single(s: Scored, req: PlanReq, ctx: Ctx, title: string, sub: string, id: string): MadePlan {
  const c = closesAt(s.v, req.at);
  const until = new Date(Math.min(req.at.getTime() + info(s.v).hours * 3600e3, c ? c.getTime() : Infinity));
  const step: PlanStep = { v: s.v, at: req.at, until, travel: carMin(s.km), why: KINDS[s.v.k]?.label ?? s.v.kind, price: priceOf(s.v), open: s.open, reasons: s.reasons };
  return finish({ id, title, sub, steps: [step], price: step.price, drive: false, checks: [] }, req, ctx);
}

function fromRoute(r: Route, req: PlanReq, ctx: Ctx): MadePlan {
  const steps: PlanStep[] = r.steps.map((s, i) => ({
    v: s.v, at: s.at, until: s.until, travel: i === 0 ? carMin(km(ctx.origin, s.v)) : s.walk, why: s.why, price: s.price,
    open: { known: !!s.closes || !!s.v.wk || !!s.v.hours, open: true, label: s.closes ? 'Deschis până la ' + hh(s.closes) : s.v.wk || s.v.hours ? 'Deschis' : 'Program necunoscut' },
    reasons: s.reasons,
  }));
  return finish({ id: r.id, title: r.label, sub: r.sub, steps, price: r.price, over: r.over, drive: !!r.drive, checks: [] }, req, ctx);
}

/** The checks shown on the plan ("✓ Deschis la 20:00", "⚠ +35 peste buget"…) and the price over the budget. */
function finish(p: MadePlan, req: PlanReq, ctx: Ctx): MadePlan {
  const checks: Check[] = [];
  const unknown = p.steps.filter((s) => !s.v.wk && !s.v.hours);
  if (!unknown.length) checks.push({ ok: true, text: p.steps.length > 1 ? 'Toate deschise la ora lor' : 'Deschis la ' + hh(p.steps[0].at) });
  else checks.push({ ok: false, text: 'Program necunoscut la ' + unknown[0].v.name + ': sună înainte' });
  const d = km(ctx.origin, p.steps[0].v);
  checks.push({ ok: true, text: kmText(d) + ', ~' + carMin(d) + ' min' });
  const price = p.steps.reduce((a, s) => a + s.price, 0);
  const over = req.budgetMax !== Infinity && price > req.budgetMax ? price - req.budgetMax : undefined;
  if (req.budgetMax === Infinity) checks.push({ ok: true, text: '~' + price + ' lei de persoană' });
  else if (!over) checks.push({ ok: true, text: '~' + price + ' lei, în buget' });
  else checks.push({ ok: false, text: '~' + price + ' lei, +' + over + ' peste buget' });
  const wet = p.steps.map((s) => ({ s, w: wxAt(ctx.weather, s.at) })).find(({ s, w }) => w?.wet && exposure(s.v) !== 'in');
  const w0 = wxAt(ctx.weather, p.steps[0].at);
  if (wet) checks.push({ ok: false, text: 'La ' + hh(wet.s.at) + ': ' + wet.w!.text + ', stați înăuntru' });
  else if (w0) checks.push({ ok: !w0.wet, text: w0.temp + '°, ' + w0.text });
  return { ...p, price, over, checks };
}

/** A cheaper place of the same kind for the dearest step, so the evening fits the budget (or comes closer). */
function cheaperTip(p: MadePlan, all: Venue[], req: PlanReq, ctx: Ctx): MadePlan['tip'] {
  if (!p.over || p.steps.length < 2) return undefined;
  let best: { step: number; v: Venue; save: number; score: number } | undefined;
  p.steps.forEach((s, i) => {
    const from = i === 0 ? ctx.origin : p.steps[i - 1].v;
    const radius = i === 0 ? req.maxKm : p.drive ? 10 : req.walkKm;
    const used = new Set(p.steps.map((x) => x.v.id));
    const ask: Ask = { ...askOf(req), at: s.at, maxKm: radius, budget: s.price - 1 };
    const known = !!(s.v.wk || s.v.hours);
    for (const v of all) {
      if (used.has(v.id) || v.cat !== s.v.cat) continue;
      if (known && !v.wk && !v.hours) continue; // not a sure place for an unsure one
      const sc = scoreVenue(v, ask, { ...ctx, origin: from });
      if (!sc || (sc.open.known && !sc.open.open)) continue;
      const c = closesAt(v, s.at);
      if (c && c.getTime() < s.until.getTime()) continue;
      if (extraFit(v, req) === null) continue;
      const save = s.price - priceOf(v);
      if (!best || save > best.save || (save === best.save && sc.score > best.score)) best = { step: i, v, save, score: sc.score };
    }
  });
  if (!best) return undefined;
  const total = p.price - best.save;
  return { step: best.step, v: best.v, text: 'Cu ' + best.v.name + ' în loc de ' + p.steps[best.step].v.name + ': ~' + total + ' lei' + (total <= req.budgetMax ? ', în buget.' : '.') };
}

/** Puts another place in one step (the tip, or "Alt bar") and checks the plan again. */
export function swapStep(p: MadePlan, i: number, v: Venue, req: PlanReq, ctx: Ctx): MadePlan {
  const steps = p.steps.map((s, k) => {
    if (k !== i) return s;
    const o = openAt(v, s.at);
    const c = closesAt(v, s.at);
    const open = c ? { ...o, label: 'Deschis până la ' + hh(c) } : o;
    const until = c && c.getTime() < s.until.getTime() ? c : s.until;
    return { ...s, v, until, open, price: priceOf(v), travel: k === 0 ? carMin(km(ctx.origin, v)) : s.travel, reasons: [] };
  });
  const next = finish({ ...p, steps, tip: undefined }, req, ctx);
  return next;
}

/** Three plans for the request: three places, or three evenings (topped up with single places if the hour leaves fewer). */
export function makePlans(all: Venue[], req: PlanReq, ctx: Ctx): MadePlan[] {
  const ranked = rankAt(all, req, ctx);
  const singles = (n: number, skip: Set<string>): MadePlan[] => {
    const out: MadePlan[] = [];
    const pool = ranked.filter((s) => !skip.has(s.v.id));
    const first = pool[0];
    if (!first) return out;
    if (n >= 1) out.push(single(first, req, ctx, 'Cel mai potrivit', KINDS[first.v.k]?.label ?? first.v.kind, 'loc-1'));
    const other = pool.find((s) => groupOf(s.v) !== groupOf(first.v)) ?? pool[1];
    if (n >= 2 && other) out.push(single(other, req, ctx, 'Altceva', KINDS[other.v.k]?.label ?? other.v.kind, 'loc-2'));
    const usedIds = new Set(out.map((p) => p.steps[0].v.id));
    const close = pool.slice(0, 40).filter((s) => !usedIds.has(s.v.id)).sort((a, b) => a.km - b.km)[0];
    if (n >= 3 && close) out.push(single(close, req, ctx, 'Cel mai aproape', kmText(close.km) + ' de tine', 'loc-3'));
    return out;
  };
  if (req.mode === 'loc') return singles(3, new Set());

  const eAsk = { who: whoOf(req.people), when: 'acum' as const, at: req.at, total: true, budget: req.budgetMax, maxKm: req.near ? Math.min(req.maxKm, 6) : req.maxKm, walkKm: req.walkKm, vibes: req.vibes };
  const ectx = { ...ctx };
  let routes = evenings(all, eAsk, ectx);
  // two evenings starting at the same restaurant: the second one starts somewhere else
  const firsts = new Set<string>();
  const skip: Partial<Record<TemplateId, number>> = {};
  for (const r of routes) { const id = r.steps[0].v.id; if (firsts.has(id)) skip[r.id] = 1; firsts.add(id); }
  if (Object.keys(skip).length) routes = evenings(all, eAsk, ectx, skip);
  const fits = (r: Route) => r.steps.every((s) => extraFit(s.v, req) !== null);
  const plans = routes.filter(fits).slice(0, 3).map((r) => fromRoute(r, req, ctx));
  for (const p of plans) p.tip = cheaperTip(p, all, req, ctx);
  if (plans.length < 3) {
    const used = new Set(plans.flatMap((p) => p.steps.map((s) => s.v.id)));
    for (const s of singles(3 - plans.length, used)) plans.push({ ...s, title: s.title === 'Cel mai potrivit' ? 'Un singur loc, bun' : s.title });
  }
  return plans;
}

export interface Suggestion { v: Venue; tag: string; line: string; at: Date }
/** "Bilu îți sugerează" on Acasă: two or three ideas without asking anything — by the weather, close by, by taste. */
export function suggest(all: Venue[], req: PlanReq, ctx: Ctx): Suggestion[] {
  const ranked = rankAt(all, req, ctx);
  const out: Suggestion[] = [];
  const used = new Set<string>();
  const add = (s: Scored | undefined, tag: string, line: string) => { if (s && !used.has(s.v.id)) { used.add(s.v.id); out.push({ v: s.v, tag, line, at: req.at }); } };
  const w = wxAt(ctx.weather, req.at);
  const evening = req.at.getHours() >= 17 || req.at.getHours() < 5;
  const when = evening ? 'Diseară' : 'Azi';
  if (w?.nice) {
    const s = ranked.find((x) => exposure(x.v) !== 'in');
    add(s, when + ' e ' + w.text + ', ' + w.temp + '°', s ? (exposure(s.v) === 'out' ? 'Afară la ' : 'Terasă la ') + s.v.name : '');
  } else if (w?.wet) {
    const s = ranked.find((x) => exposure(x.v) === 'in');
    add(s, when + ': ' + w.text + ', ' + w.temp + '°', s ? 'La adăpost: ' + s.v.name : '');
  }
  const close = ranked.slice(0, 12).sort((a, b) => a.km - b.km)[0];
  add(close, 'Lângă tine', close ? close.v.name : '');
  add(ranked.find((x) => !used.has(x.v.id)), 'Pe gustul tău', ranked.find((x) => !used.has(x.v.id))?.v.name ?? '');
  return out.slice(0, 3);
}

/** "Alt bar": the next best place of the same kind for one step, open for the whole step, not one already used or shown. */
export function altStep(p: MadePlan, i: number, all: Venue[], req: PlanReq, ctx: Ctx, seen: Set<string>): Venue | null {
  const s = p.steps[i];
  const from = i === 0 ? ctx.origin : p.steps[i - 1].v;
  const radius = i === 0 ? req.maxKm : p.drive ? 10 : Math.max(req.walkKm, 3);
  const used = new Set(p.steps.map((x) => x.v.id));
  const ask: Ask = { ...askOf(req), at: s.at, maxKm: radius, budget: req.budgetMax };
  let best: { v: Venue; score: number } | null = null;
  for (const v of all) {
    if (used.has(v.id) || seen.has(v.id) || groupOf(v) !== groupOf(s.v)) continue;
    const sc = scoreVenue(v, ask, { ...ctx, origin: from });
    if (!sc || (sc.open.known && !sc.open.open) || extraFit(v, req) === null) continue;
    const c = closesAt(v, s.at);
    if (c && c.getTime() < s.until.getTime()) continue;
    const score = sc.score + (v.cat === s.v.cat ? 6 : 0) + (sc.open.known ? 8 : 0);
    if (!best || score > best.score) best = { v, score };
  }
  return best?.v ?? null;
}

/** One place as a plan (a suggestion from Acasă, "Asta!" in the list). */
export function planForPlace(v: Venue, req: PlanReq, ctx: Ctx): MadePlan {
  const s = scoreVenue(v, { ...askOf(req), maxKm: 999, budget: Infinity, budgetMin: undefined }, ctx);
  const sc: Scored = s ?? { v, score: 0, km: km(ctx.origin, v), open: { known: false, open: true, label: 'Program necunoscut' }, reasons: [], parts: { gust: 0, ocazie: 0, calitate: 0, aproape: 0, nou: 0, gasca: 0 } };
  return single(sc, req, ctx, 'Ideea lui Bilu', KINDS[v.k]?.label ?? v.kind, 'loc-' + v.id);
}

/** The first places that fit, for the line under each question ("Se potrivesc: A · B · C"). */
export function previewNames(all: Venue[], req: PlanReq, ctx: Ctx, n = 3): string[] {
  return rankAt(all, { ...req, mode: 'loc' }, ctx).slice(0, n).map((s) => s.v.name);
}
