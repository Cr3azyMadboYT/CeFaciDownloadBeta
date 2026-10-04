// Plans ("Biletul serii"): kept in the saved board state (plans), so they survive closing the app and, with an
// account, reinstalling. A plan is a real venue, a calendar day and a time; past days drop off on their own.
import { APP } from '../../../src/app/bridge';
import { getApp, setBoard } from './session';
import { WHO, type Filters } from './filters';

export interface Plan {
  pid: number; placeId: string; when: string; slot: string; people: number;
  res: 'none' | 'ext' | 'noted'; resVia?: string; createdAt: number;
  date?: string; // yyyy-mm-dd, the real day of the outing
  inAt?: string;  // check-in time at the place ("20:04")
  bonDone?: boolean; // the receipt photo was confirmed
  sid?: string;      // the shared plan on the server (sent to a crew or friends, or made from a vote)
  owner?: boolean;   // false when someone else made the shared plan
  remind?: string[]; // the scheduled receipt reminders (cancelled when the receipt is in)
  rated?: 'super' | 'yes' | 'no'; // "Cum a fost?" after the outing (the vote also teaches the crew, for a shared plan)
  route?: string;    // the steps of one "Seara completă" share this id (they follow each other, no clash)
}
/** One shared empty list, so screens reading "no plans" get the same value every time. */
export const NO_PLANS: Plan[] = [];

const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
const DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The calendar day a "când" choice means, counted from `from`: now/diseară = today, mâine, weekend = the next Saturday (today on Saturday). */
export function dayFor(when: string, from = new Date()) {
  const d = startOfDay(from);
  if (when === 'tom') d.setDate(d.getDate() + 1);
  if (when === 'we') d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return d;
}
/** The plan's day as a Date (older plans without a date: counted from when they were made). */
export function planDay(pl: Plan) {
  if (pl.date) { const [y, m, d] = pl.date.split('-').map(Number); return new Date(y, m - 1, d); }
  return dayFor(pl.when, new Date(pl.createdAt));
}
/** "azi", "mâine" or the weekday, as people say it. */
export function dayWord(pl: Plan, now = new Date()) {
  const diff = Math.round((planDay(pl).getTime() - startOfDay(now).getTime()) / 864e5);
  return diff < 0 ? 'ieri' : diff === 0 ? 'azi' : diff === 1 ? 'mâine' : DAYS[planDay(pl).getDay()];
}
/** "azi", "mâine", "sâm.": short, for the little day box. */
export function dayShort(pl: Plan, now = new Date()) { const w = dayWord(pl, now); return w === 'azi' || w === 'mâine' || w === 'ieri' ? w : w.slice(0, 3) + '.'; }
/** "Azi, 4 oct.", "Mâine, 5 oct.", "Sâmbătă, 10 oct." */
export function dateText(pl: Plan, now = new Date()) {
  const d = planDay(pl);
  const w = dayWord(pl, now);
  return w.charAt(0).toUpperCase() + w.slice(1) + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
}
/** Plans whose day has not passed, plus yesterday's outing while its receipt can still be added (until tonight). */
export const upcoming = (list: Plan[], now = new Date()) => list.filter((pl) => {
  const day = planDay(pl).getTime(), today = startOfDay(now).getTime();
  return day >= today || (!!pl.inAt && !pl.bonDone && day >= today - 864e5);
});

const plans = () => ((getApp().board.plans as unknown as Plan[] | undefined) ?? []);

/** The time a plan starts: now, or the usual evening slot of that kind of place. */
function slotFor(placeId: string, when: string) {
  if (when === 'now') return 'acum';
  return APP.byId(placeId)?.t ?? '20:00';
}

/** Makes a plan for a venue (or opens the one already made for the same day). Returns its id. */
export function createPlan(placeId: string, f: Filters): number {
  const date = iso(dayFor(f.when));
  const same = plans().find((x) => x.placeId === placeId && iso(planDay(x)) === date);
  if (same) return same.pid;
  const pid = Math.max(0, ...plans().map((x) => x.pid)) + 1;
  const pl: Plan = { pid, placeId, when: f.when, date, slot: slotFor(placeId, f.when), people: WHO[f.who]?.n ?? 2, res: 'none', createdAt: Date.now() };
  setBoard((b) => ({ plans: [...upcoming((b.plans as Plan[] | undefined) ?? []), pl] }));
  return pid;
}
/** When a plan starts, as a real moment (for the shared copy on the server and for overlapping plans). */
export function startsAt(pl: Pick<Plan, 'slot'> & Partial<Plan>, now = new Date()) {
  if (pl.slot === 'acum') return pl.createdAt ? new Date(pl.createdAt) : now;
  const d = pl.date || pl.when ? planDay(pl as Plan) : startOfDay(now);
  const [h, m] = pl.slot.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 20, m || 0);
}
/** "20:00" for a moment, local time. */
export const hhmm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
/** A plan for a set moment (a shared plan someone else made, or a vote's winner). Opens the existing one if any. */
export function createPlanAt(placeId: string, at: Date, people: number, extra: Partial<Plan> = {}): number {
  const date = iso(at);
  const same = plans().find((x) => (extra.sid && x.sid === extra.sid) || (x.placeId === placeId && iso(planDay(x)) === date));
  if (same) { if (extra.sid && !same.sid) updPlan(same.pid, extra); return same.pid; }
  const pid = Math.max(0, ...plans().map((x) => x.pid)) + 1;
  const diff = Math.round((startOfDay(at).getTime() - startOfDay(new Date()).getTime()) / 864e5);
  const pl: Plan = { pid, placeId, when: diff <= 0 ? 'eve' : diff === 1 ? 'tom' : 'we', date, slot: hhmm(at), people, res: 'none', createdAt: Date.now(), ...extra };
  setBoard((b) => ({ plans: [...upcoming((b.plans as Plan[] | undefined) ?? []), pl] }));
  return pid;
}
/** Two plans closer than 2 hours on the same day: the second one would clash. */
export function clashWith(pl: Plan, list: Plan[]): Plan | null {
  const a = startsAt(pl).getTime();
  return upcoming(list).find((x) => x.pid !== pl.pid && !(pl.route && x.route === pl.route) && Math.abs(startsAt(x).getTime() - a) < 2 * 3600e3) ?? null;
}
export function updPlan(pid: number, patch: Partial<Plan>) {
  setBoard((b) => ({ plans: ((b.plans as Plan[] | undefined) ?? []).map((x) => (x.pid === pid ? { ...x, ...patch } : x)) }));
}
export function removePlan(pid: number) {
  setBoard((b) => ({ plans: ((b.plans as Plan[] | undefined) ?? []).filter((x) => x.pid !== pid) }));
}
const mins = (t: string) => { if (t === 'acum') return -1; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
/** Upcoming plans, soonest first. */
export const sortPlans = (list: Plan[]) => upcoming(list).sort((a, b) => planDay(a).getTime() - planDay(b).getTime() || mins(a.slot) - mins(b.slot));
