// The Acasă filters (who, when, how long, budget, vibe, how far), started from the sign-up answers, and the
// free-text search. Results come from the engine through APP.matches / APP.search.
import { useSyncExternalStore } from 'react';
import { APP } from '../../../src/app/bridge';

export const WHO: Record<string, { label: string; n: number; text: string }> = { 1: { label: 'Doar eu', n: 1, text: 'Doar tu' }, 2: { label: 'În doi', n: 2, text: 'În doi' }, 34: { label: '3–4', n: 4, text: 'Gașca, 4' }, 5: { label: '5+', n: 5, text: 'Gașca' } };
export const WHEN: Record<string, { label: string; word: string; day: string }> = { now: { label: 'Acum', word: 'acum?', day: 'azi' }, eve: { label: 'Diseară', word: 'diseară?', day: 'azi' }, tom: { label: 'Mâine', word: 'mâine?', day: 'mâine' }, we: { label: 'Weekend', word: 'în weekend?', day: 'sâm.' } };
export const DUR: Record<string, { label: string; text: string }> = { 1: { label: '1 oră', text: '1 oră' }, 23: { label: '2–3 ore', text: '2–3 ore' }, 4: { label: '4+ ore', text: '4+ ore' } };
export const BUDGET: Record<string, { label: string; text: string }> = { 0: { label: 'Gratuit', text: 'gratuit' }, 50: { label: '≤ 50', text: 'până în 50 lei' }, 100: { label: '≤ 100', text: 'până în 100 lei' }, 200: { label: '≤ 200', text: 'până în 200 lei' }, any: { label: 'Oricât', text: 'orice buget' } };
export const DIST: Record<string, { label: string; max: number }> = { 10: { label: '10 min', max: 10 }, 20: { label: '20 min', max: 20 }, 30: { label: '30 min', max: 30 } };
export const VIBES = ['Chill', 'Fun', 'Competitiv', 'Party', 'Aer liber', 'Mâncare bună', 'Cultură'];

export interface Filters { who: string; when: string; dur: string; budget: string; vibes: string[]; dist: string; where?: 'in' | 'out' }
export type Place = ReturnType<typeof APP.matches>[number];

export type Phase = 'morning' | 'day' | 'dusk' | 'night' | 'late';
export function phaseOfHour(h: number): Phase {
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'dusk';
  if (h >= 21) return 'night';
  return 'late';
}

/** "50-120" style ranges typed in the filter sheet read as text too. */
export function budgetText(key: string) {
  const r = /^(\d*)-(\d*)$/.exec(key);
  if (!r) return (BUDGET[key] ?? BUDGET.any).text;
  const [lo, hi] = [r[1], r[2]];
  return lo && hi ? 'între ' + lo + ' și ' + hi + ' lei' : lo ? 'de la ' + lo + ' lei' : 'până în ' + hi + ' lei';
}
export const summaryOf = (f: Filters) => DUR[f.dur].text + ', ' + budgetText(f.budget) + ', ' + (f.vibes.length ? f.vibes.join(', ') : 'orice vibe') + ', max. ' + DIST[f.dist].max + ' min';

type S = { f: Filters; sq: string; page: number };
/** The sign-up answers as filters; in the evening "când" starts at "diseară". */
function initial(): Filters {
  const d = APP.homeDefaults() as Filters;
  const ph = phaseOfHour(new Date().getHours());
  return { ...d, when: ph === 'dusk' || ph === 'night' ? 'eve' : d.when };
}
let s: S = { f: initial(), sq: '', page: 0 };
const subs = new Set<() => void>();
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useFilters = () => useSyncExternalStore(subscribe, () => s, () => s);
export function setFilters(p: Partial<Filters>, extra: Partial<Omit<S, 'f'>> = {}) { s = { ...s, ...extra, f: { ...s.f, ...p }, page: extra.page ?? 0 }; subs.forEach((x) => x()); }
export function setSearch(sq: string) { s = { ...s, sq, page: 0 }; subs.forEach((x) => x()); }
export function setPage(page: number) { s = { ...s, page }; subs.forEach((x) => x()); }
/** After the sign-up answers change (a new account restored, for example). */
export function resetFilters() { s = { ...s, f: initial(), page: 0 }; subs.forEach((x) => x()); }

/** What the results screen shows: the search when there is one, else the filters' ranking. */
export function listFor(f: Filters, sq: string): Place[] {
  return sq.trim().length > 1 ? APP.search(sq.trim()) : APP.matches(f);
}

export function fmtDur(h: number) {
  if (h >= 4) return '4+ h';
  if (h === Math.floor(h)) return h + ' h';
  return Math.floor(h) + ' h 30';
}
