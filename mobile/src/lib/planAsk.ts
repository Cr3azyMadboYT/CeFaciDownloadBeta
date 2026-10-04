// "Creează plan" (decision Cornel, 04.10): the answers to the five questions, the three plans made from them, and the
// last answers kept on the phone ("Ca data trecută", and ticked already the next time).
// Rethought for every hour (decision Cornel, 04.10 seara): the day is an evening (yyyy-mm-dd) and the night after
// midnight still belongs to it; "Acum" means you leave now; an hour that has passed while the screen stayed open
// becomes "acum", so a plan is never for a moment that is gone; the plans are made a moment after the tap, with Bilu
// checking on screen, so nothing freezes.
import { useSyncExternalStore } from 'react';
import type { PlanAsk } from '../../../src/app/bridge';
import { addDays, dateShort, eveningOf, eveningWord, isoDay, momentOf, whenWords } from '../../../src/engine/time';
import { APP } from './session';

export type Made = ReturnType<typeof APP.makePlans>;
export type Shown = Made['plans'][number];
/** The answers as the screens hold them. */
export interface Draft {
  mode: 'loc' | 'seara';
  evening: string;          // yyyy-mm-dd: the evening; 01:00 belongs to the evening before
  hour: string;             // 'acum' or 'HH:MM'
  people: number;
  budget: [number, number]; // lei per person; BUDGET_TOP = any
  vibes: string[];
  crewId?: string;
  extra?: Pick<PlanAsk, 'outdoor' | 'needs' | 'near'>; // from "Mai vrei ceva?"
}

export const BUDGET_TOP = 300; // the bar's right end: 300 means "300+", any price
const KEY = 'cefaci.planAsk';

/** Leaving now: in 5 minutes (shoes, keys). */
const soon = (now: Date) => { const t = new Date(now.getTime() + 5 * 60e3); t.setSeconds(0, 0); return t; };
/** The plan's moment: when you set off ("acum"), or that evening at that hour. */
export const atOf = (d: Pick<Draft, 'evening' | 'hour'>, now = new Date()) => (d.hour === 'acum' ? soon(now) : momentOf(d.evening, d.hour));
/** The hour asked has passed (the screen stayed open, "ca data trecută"): the plan is for now. */
export const isPast = (d: Pick<Draft, 'evening' | 'hour'>, now = new Date()) => d.hour !== 'acum' && momentOf(d.evening, d.hour).getTime() < now.getTime() - 10 * 60e3;
export function askOf(d: Draft, now = new Date()): PlanAsk {
  const nowish = d.hour === 'acum' || isPast(d, now);
  return { mode: d.mode, at: nowish ? soon(now) : atOf(d, now), now: nowish, people: d.people, budget: [d.budget[0], d.budget[1] >= BUDGET_TOP ? Infinity : d.budget[1]], vibes: d.vibes, ...d.extra };
}

// ---------- when ----------
export const HOUR_ROWS: [string, string[]][] = [
  ['Ziua', ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']],
  ['Seara', ['17:00', '18:00', '19:00', '20:00', '21:00']],
  ['Noaptea', ['22:00', '23:00', '00:00', '01:00', '02:00']],
];
/** The hours still ahead on that evening (at least 15 minutes away), by part of the day. */
export function hoursFor(evening: string, now = new Date()): [string, string[]][] {
  return HOUR_ROWS.map(([k, hs]) => [k, hs.filter((h) => momentOf(evening, h).getTime() > now.getTime() + 15 * 60e3)] as [string, string[]]).filter(([, hs]) => hs.length > 0);
}
/** The evenings to pick from: the one going on (while it has hours left), then the next ones — 7 in all. */
export function eveningsFrom(now = new Date()): string[] {
  const e0 = eveningOf(now);
  const first = hoursFor(e0, now).length ? e0 : addDays(e0, 1);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}
/** The hour picked for an evening: the one you had, if still ahead; 20:00; else the first one still ahead. */
export function hourFor(evening: string, had: string, now = new Date()): string {
  const all = hoursFor(evening, now).flatMap(([, hs]) => hs);
  if (had !== 'acum' && all.includes(had)) return had;
  if (all.includes('20:00')) return '20:00';
  return all[0] ?? 'acum';
}
/** "Acum", "Diseară la 21:00", "Mâine la 20:00", "Joi, 8 oct., la 20:00", "Noaptea asta, la 02:00". */
export const whenText = (d: Pick<Draft, 'evening' | 'hour'>, now = new Date()) => (d.hour === 'acum' ? 'Acum' : whenWords(d.evening, d.hour, now));
/** The word and the date on a day card. */
export const dayCard = (evening: string, now = new Date(), hour?: string) => ({ word: eveningWord(evening, now, hour ? Number(hour.split(':')[0]) : 20), date: dateShort(evening) });
/** "Toată seara", or "Toată noaptea" / "Toată ziua" by the hour it starts. */
export function wholeLabel(d: Pick<Draft, 'evening' | 'hour'>, now = new Date()) {
  const h = atOf(d, now).getHours();
  return h >= 22 || h < 5 ? 'Toată noaptea' : h < 16 ? 'Toată ziua' : 'Toată seara';
}

// ---------- the first answers ----------
function fromSignup(now: Date): Draft {
  const d = APP.homeDefaults();
  const max = d.budget === '0' ? 0 : d.budget === '50' ? 50 : d.budget === '100' ? 100 : BUDGET_TOP;
  const h = now.getHours();
  return { mode: h >= 16 || h < 5 ? 'seara' : 'loc', evening: eveningOf(now), hour: '20:00', people: d.who === '1' ? 1 : d.who === '2' ? 2 : 4, budget: [0, max], vibes: d.vibes };
}
export function loadLast(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft & { day?: number };
    if (!d.evening) d.evening = eveningOf(new Date()); // saved before the evenings (a day number)
    delete d.day;
    return d;
  } catch { return null; }
}
export function saveLast(d: Draft) { try { localStorage.setItem(KEY, JSON.stringify({ ...d, extra: undefined })); } catch { /* storage blocked */ } }

/** "Creează plan": last time's answers (or the sign-up's), for tonight — from 19:00 on, for now. */
export function firstDraft(now = new Date()): Draft {
  const base = loadLast() ?? fromSignup(now);
  const e0 = eveningOf(now);
  const h = now.getHours();
  const late = h >= 19 || h < 5;
  const keep = base.hour !== 'acum' && momentOf(e0, base.hour).getTime() > now.getTime() + 30 * 60e3;
  return { ...base, evening: e0, hour: late ? 'acum' : keep ? base.hour : hourFor(e0, '20:00', now), extra: undefined };
}

/** What Bilu says over the plans, with a one-tap change when it helps ("Vreau acum"). */
export interface Notice { text: string; label?: string; patch?: Partial<Draft> }

/** "Ca data trecută": the same answers today; if last time's hour has passed, now (a little while ago) or tomorrow. */
export function againDraft(now = new Date()): { draft: Draft; notice?: Notice } | null {
  const last = loadLast();
  if (!last) return null;
  const e0 = eveningOf(now);
  const d = { ...last, evening: e0, extra: undefined };
  if (last.hour === 'acum') return { draft: { ...d, hour: 'acum' } };
  const at = momentOf(e0, last.hour);
  if (at.getTime() > now.getTime() + 15 * 60e3) return { draft: { ...d, hour: last.hour } };
  if (now.getTime() - at.getTime() < 4 * 3600e3) return { draft: { ...d, hour: 'acum' }, notice: { text: 'Data trecută a fost la ' + last.hour + '. Ora a trecut, așa că l-am făcut de acum.', label: 'Mâine la ' + last.hour, patch: { evening: addDays(e0, 1), hour: last.hour } } };
  return { draft: { ...d, evening: addDays(e0, 1), hour: last.hour }, notice: { text: 'Data trecută a fost la ' + last.hour + '; azi ora a trecut, așa că l-am făcut pentru mâine.', label: 'Vreau acum', patch: { evening: e0, hour: 'acum' } } };
}

/** "Surprinde-mă": a whole outing, any vibe (your taste decides), now — or tonight at 20:00 in the late afternoon. */
export function surpriseDraft(now = new Date()): Draft {
  const base = loadLast() ?? fromSignup(now);
  const h = now.getHours();
  return { ...base, mode: 'seara', evening: eveningOf(now), hour: h >= 17 && h < 19 ? '20:00' : 'acum', vibes: [], extra: undefined, crewId: undefined };
}

/** "Ai chef de Party": the usual answers, with that vibe. */
export const moodDraft = (vibe: string, now = new Date()): Draft => ({ ...firstDraft(now), vibes: [vibe] });

// ---------- the plans on screen ----------
type S = { draft: Draft | null; plans: Shown[]; chips: string[]; note?: string; empty?: string; notice?: Notice; loading: boolean; madeAt: number; pick: number; seen: string[] };
let s: S = { draft: null, plans: [], chips: [], loading: false, madeAt: 0, pick: 0, seen: [] };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const usePlans = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => s, () => s);
export const getPlans = () => s;

/** Makes the three plans for the draft a moment after the tap (the screen shows Bilu checking meanwhile).
 *  `surprise`: one of them is picked to be opened; `avoid`: places already shown ("Altă surpriză"). */
export function runPlans(d: Draft, o: { chips?: string[]; notice?: Notice; surprise?: boolean; avoid?: string[] } = {}): Promise<S> {
  saveLast(d);
  s = { ...s, draft: d, chips: o.chips ?? [], notice: o.notice, loading: true, seen: o.avoid ?? [] };
  emit();
  return new Promise((done) => setTimeout(() => {
    const r = APP.makePlans(askOf(d), o.avoid ?? []);
    // a surprise: the best plan most of the time, sometimes the second or third
    const roll = Math.random();
    const pick = o.surprise && r.plans.length ? Math.min(r.plans.length - 1, roll < 0.55 ? 0 : roll < 0.85 ? 1 : 2) : 0;
    s = { ...s, plans: r.plans, note: r.note, empty: r.empty, loading: false, madeAt: Date.now(), pick, seen: [...(o.avoid ?? []), ...(o.surprise && r.plans[pick] ? r.plans[pick].steps.map((x) => x.place.id) : [])] };
    emit();
    done(s);
  }, 30));
}
/** "Altă surpriză": the next plan of the three, then three new ones without the places already shown. */
export function nextSurprise(): Promise<S> | null {
  if (!s.draft || s.loading) return null;
  const seen = new Set(s.seen);
  const i = s.plans.findIndex((p) => !p.steps.some((x) => seen.has(x.place.id)));
  if (i >= 0) {
    s = { ...s, pick: i, seen: [...s.seen, ...s.plans[i].steps.map((x) => x.place.id)] };
    emit();
    return Promise.resolve(s);
  }
  return runPlans(s.draft, { surprise: true, avoid: s.seen });
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
  s = { draft: d, plans: [APP.showPlan(APP.lastPlans[0])], chips: [], loading: false, madeAt: Date.now(), pick: 0, seen: [] };
  emit();
  return true;
}
const hhmm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
/** Plans made "acum" more than 20 minutes ago (the app was in the background), or for an hour now gone, are made
 *  again for the time it is: never a ticket for a moment that has passed. */
export function refreshIfStale(now = new Date()): boolean {
  if (!s.draft || s.loading || !s.plans.length) return false;
  const first = s.plans[0]?.steps[0]?.at;
  const gone = first ? new Date(first).getTime() < now.getTime() - 15 * 60e3 : false;
  const old = askOf(s.draft, now).now && now.getTime() - s.madeAt > 20 * 60e3;
  if (!gone && !old) return false;
  void runPlans(s.draft, { chips: s.chips, notice: { text: 'Am refăcut planurile pentru ora de acum: cele de dinainte erau pentru ' + hhmm(new Date(first ?? now)) + '.' } });
  return true;
}

export const budgetLabel = (b: [number, number]) => (b[1] >= BUDGET_TOP ? (b[0] ? 'de la ' + b[0] + ' lei' : 'orice buget') : b[1] === 0 ? 'gratis' : (b[0] ? b[0] + '–' : 'până în ') + b[1] + ' lei');
export { isoDay };
