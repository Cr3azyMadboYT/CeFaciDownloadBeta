// "Creează plan" (decision Cornel, 04.10): the answers to the five questions, the three plans made from them, and the
// last answers kept on the phone ("Ca data trecută", and ticked already the next time).
import { useSyncExternalStore } from 'react';
import type { PlanAsk } from '../../../src/app/bridge';
import { APP } from './session';

export type Shown = ReturnType<typeof APP.makePlans>['plans'][number];
/** The answers as the screens hold them: a day (0 = today) and an hour ("acum" or "20:00"). */
export interface Draft { mode: 'loc' | 'seara'; day: number; hour: string; people: number; budget: [number, number]; vibes: string[]; crewId?: string; extra?: Pick<PlanAsk, 'outdoor' | 'needs' | 'near'> }

export const BUDGET_TOP = 300; // the bar's right end: 300 means "300+", any price
const KEY = 'cefaci.planAsk';

/** The plan's moment from the draft: now (rounded up a quarter), or that day at that hour (after midnight: the next day). */
export function atOf(d: Pick<Draft, 'day' | 'hour'>, now = new Date()): Date {
  if (d.hour === 'acum') { const t = new Date(now.getTime() + 10 * 60e3); t.setSeconds(0, 0); t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15); return t; }
  const [h, m] = d.hour.split(':').map(Number);
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d.day + (h < 5 ? 1 : 0), h, m || 0);
  return t;
}
export function askOf(d: Draft): PlanAsk {
  return { mode: d.mode, at: atOf(d), people: d.people, budget: [d.budget[0], d.budget[1] >= BUDGET_TOP ? Infinity : d.budget[1]], vibes: d.vibes, ...d.extra };
}

/** The first draft: what was answered last time, else the sign-up answers; tonight at 20:00 (now, late in the evening). */
export function firstDraft(now = new Date()): Draft {
  const last = loadLast();
  const h = now.getHours();
  const hour = h >= 20 || h < 5 ? 'acum' : '20:00';
  if (last) return { ...last, day: 0, hour: last.hour === 'acum' || atOf({ day: 0, hour: last.hour }, now).getTime() < now.getTime() ? hour : last.hour, extra: undefined };
  const d = APP.homeDefaults();
  const max = d.budget === '0' ? 0 : d.budget === '50' ? 50 : d.budget === '100' ? 100 : BUDGET_TOP;
  return { mode: h >= 16 || h < 5 ? 'seara' : 'loc', day: 0, hour, people: d.who === '1' ? 1 : d.who === '2' ? 2 : 4, budget: [0, max], vibes: d.vibes };
}
export function loadLast(): Draft | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Draft) : null; } catch { return null; }
}
export function saveLast(d: Draft) { try { localStorage.setItem(KEY, JSON.stringify({ ...d, extra: undefined })); } catch { /* storage blocked */ } }

// ---------- the plans on screen ----------
type S = { draft: Draft | null; plans: Shown[]; chips: string[] };
let s: S = { draft: null, plans: [], chips: [] };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const usePlans = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => s, () => s);
export const getPlans = () => s;

/** Makes the three plans for the draft and keeps them for the screens that follow. */
export function runPlans(d: Draft, chips: string[] = []) {
  saveLast(d);
  s = { draft: d, plans: APP.makePlans(askOf(d)).plans, chips };
  emit();
  return s.plans;
}
/** One step of plan i changed (the tip, "Alt bar"). */
export function setPlan(i: number, p: Shown | null) {
  if (!p) return false;
  const plans = s.plans.slice(); plans[i] = p;
  s = { ...s, plans }; emit();
  return true;
}
/** A single place as the plan on screen (a suggestion from Acasă). */
export function runPlace(id: string, d: Draft) {
  const i = APP.planForPlace(id, askOf(d));
  if (i < 0) return false;
  s = { draft: d, plans: [APP.showPlan(APP.lastPlans[0])], chips: [] };
  emit();
  return true;
}

const DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
/** "Diseară", "Mâine la 20:00", "Joi, 8 oct., la 20:00". */
export function whenText(d: Pick<Draft, 'day' | 'hour'>, now = new Date()): string {
  if (d.hour === 'acum') return 'Acum';
  const at = atOf(d, now);
  const day = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 864e5) - (at.getHours() < 5 ? 1 : 0);
  const word = day === 0 ? (at.getHours() >= 17 || at.getHours() < 5 ? 'Diseară' : 'Azi') : day === 1 ? 'Mâine' : day === 2 ? 'Poimâine' : DAYS[at.getDay()].charAt(0).toUpperCase() + DAYS[at.getDay()].slice(1) + ', ' + at.getDate() + ' ' + MONTHS[at.getMonth()] + ',';
  return word + ' la ' + d.hour;
}
export const dayName = (day: number, now = new Date()) => {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
  return { word: day === 0 ? 'Azi' : day === 1 ? 'Mâine' : day === 2 ? 'Poimâine' : DAYS[t.getDay()].charAt(0).toUpperCase() + DAYS[t.getDay()].slice(1), date: (day < 3 ? DAYS[t.getDay()].slice(0, 3) + '. ' : '') + t.getDate() + (day >= 3 ? ' ' + MONTHS[t.getMonth()] : '') };
};
export const budgetLabel = (b: [number, number]) => (b[1] >= BUDGET_TOP ? (b[0] ? 'de la ' + b[0] + ' lei' : 'orice buget') : b[1] === 0 ? 'gratis' : (b[0] ? b[0] + '–' : 'până în ') + b[1] + ' lei');
