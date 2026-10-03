// Plans ("Biletul serii"): kept in the saved board state (plans), so they survive closing the app and, with an
// account, reinstalling. A plan is a real venue, a day and a time.
import { APP } from '../../../src/app/bridge';
import { getApp, setBoard } from './session';
import { WHO, type Filters } from './filters';

export interface Plan {
  pid: number; placeId: string; when: string; slot: string; people: number;
  res: 'none' | 'ext' | 'noted'; resVia?: string; createdAt: number;
}
/** One shared empty list, so screens reading "no plans" get the same value every time. */
export const NO_PLANS: Plan[] = [];
export const DAYKEY: Record<string, string> = { now: 'azi', eve: 'azi', tom: 'mâine', we: 'sâm' };

const plans = () => ((getApp().board.plans as unknown as Plan[] | undefined) ?? []);

/** The time a plan starts: now, or the usual evening slot of that kind of place. */
function slotFor(placeId: string, when: string) {
  if (when === 'now') return 'acum';
  return APP.byId(placeId)?.t ?? '20:00';
}

/** Makes a plan for a venue (or opens the one already made for the same day). Returns its id. */
export function createPlan(placeId: string, f: Filters): number {
  const same = plans().find((x) => x.placeId === placeId && DAYKEY[x.when] === DAYKEY[f.when]);
  if (same) return same.pid;
  const pid = Math.max(0, ...plans().map((x) => x.pid)) + 1;
  const pl: Plan = { pid, placeId, when: f.when, slot: slotFor(placeId, f.when), people: WHO[f.who]?.n ?? 2, res: 'none', createdAt: Date.now() };
  setBoard((b) => ({ plans: [...((b.plans as Plan[] | undefined) ?? []), pl] }));
  return pid;
}
export function updPlan(pid: number, patch: Partial<Plan>) {
  setBoard((b) => ({ plans: ((b.plans as Plan[] | undefined) ?? []).map((x) => (x.pid === pid ? { ...x, ...patch } : x)) }));
}
export function removePlan(pid: number) {
  setBoard((b) => ({ plans: ((b.plans as Plan[] | undefined) ?? []).filter((x) => x.pid !== pid) }));
}
const mins = (t: string) => { if (t === 'acum') return -1; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const sortPlans = (list: Plan[]) => list.slice().sort((a, b) => (DAYKEY[a.when] === DAYKEY[b.when] ? mins(a.slot) - mins(b.slot) : a.when === 'we' ? 1 : b.when === 'we' ? -1 : a.when === 'tom' ? 1 : -1));
