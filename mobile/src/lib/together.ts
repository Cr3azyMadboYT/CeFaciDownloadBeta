// Plans shared with a crew or with friends (Supabase plans + plan_members): they answer "Vin" or "Nu pot",
// and the one who made it sees who comes. A vote's winner arrives here too.
import { APP } from '../../../src/app/bridge';
import {AppState} from 'react-native';
import { sb } from './auth';
import type { Person } from './friends';
import { createPlanAt, hhmm, removePlan, startsAt, updPlan, type Plan } from './plans';
import { captureAccount, getApp } from './session';
import { ensurePlan, stateOf } from './partner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => sb() as any;

export type Answer = 'pending' | 'vin' | 'nu_pot' | 'timed_out';
export interface Invite { planId: string; venueId: string; venueName: string; startsAt: string; owner: Person; answer: Answer; crewId: string | null }
export interface Going { person: Person; answer: Answer; owner?: boolean }

/** Sends a plan to a crew (its members) or to friends; they get it in Planuri with Vin / Nu pot. */
export async function sharePlan(pl: Plan, me: string, to: { crewId?: string | null; friendIds?: string[] }): Promise<string | null> {
  const p = APP.byId(pl.placeId);
  if (!p) return 'Nu mai găsim locul ăsta.';
  try {
    let ids = to.friendIds ?? [];
    if (to.crewId) {
      const { data, error } = await db().from('crew_members').select('user_id').eq('crew_id', to.crewId).eq('status', 'member');
      if(error) throw error;
      ids=[...new Set([...ids,...((data??[]) as {user_id:string}[]).map(r=>r.user_id)])];
    }
    ids=ids.filter(u=>u!==me);
    if(!ids.length)return 'Nu e nimeni de chemat.';
    await ensurePlan(pl,{...to,guests:Math.max(0,pl.people-1-ids.length)});
    return null;
  } catch(e){return String((e as Error).message);}

}

/** Plans other people called me to, from today on. */
export async function listInvites(me: string): Promise<Invite[]> {
  const {error}=await db().rpc('plan_expire_mine_v2');if(error)throw new Error(error.message);
  const { data: mine } = await db().from('plan_members').select('plan_id, answer').eq('user_id', me);
  const rows = (mine ?? []) as { plan_id: string; answer: Answer }[];
  if (!rows.length) return [];
  const since = new Date(Date.now() - 12 * 3600e3).toISOString();
  const { data: plans } = await db().from('plans').select('id, owner_id, crew_id, venue_id, venue_name, starts_at, status').in('id', rows.map((r) => r.plan_id)).gt('starts_at', since).eq('status', 'active');
  const list = (plans ?? []) as { id: string; owner_id: string; crew_id: string | null; venue_id: string; venue_name: string; starts_at: string }[];
  const owners = [...new Set(list.map((p) => p.owner_id))];
  const { data: people } = owners.length ? await db().from('profiles').select('id, username, first_name').in('id', owners) : { data: [] };
  const byId = new Map(((people ?? []) as Person[]).map((p) => [p.id, p]));
  return list.map((p) => ({
    planId: p.id, venueId: p.venue_id, venueName: p.venue_name, startsAt: p.starts_at, crewId: p.crew_id,
    owner: byId.get(p.owner_id) ?? { id: p.owner_id, username: '', first_name: 'Cineva' },
    answer: rows.find((r) => r.plan_id === p.id)?.answer ?? 'pending',
  })).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** "Vin" puts the plan in my Planuri too; "Nu pot" only tells the others. */
export async function answer(inv: Invite, me: string, a: 'vin' | 'nu_pot'): Promise<string | null> {
  const valid = captureAccount();
  if (getApp().who?.id !== me) return 'Contul s-a schimbat.';
  const {data, error}=await db().rpc('plan_answer_v2',{p_plan:inv.planId,p_answer:a});
  if (!valid()) return 'Contul s-a schimbat.';
  if(error)return error.message;
  if (a === 'nu_pot') {
    for (const pl of (getApp().board.plans as Plan[] | undefined) ?? []) if (pl.sid === inv.planId && pl.owner === false) removePlan(pl.pid);
  }
  if(a==='vin' && APP.byId(inv.venueId)) {
    const state=await stateOf(inv.planId);
    if(valid())createPlanAt(inv.venueId,new Date(inv.startsAt),state.attendance?.people ?? data ?? 1,{sid:inv.planId,owner:false});
  }
  return null;
}

/** Who was called to a shared plan and what they answered (the one who made it first). */
export async function going(sid: string): Promise<Going[]> {
  const [{ data: plan }, { data: mem }] = await Promise.all([
    db().from('plans').select('owner_id').eq('id', sid).maybeSingle(),
    db().from('plan_members').select('user_id, answer').eq('plan_id', sid),
  ]);
  if (!plan) return [];
  const rows = (mem ?? []) as { user_id: string; answer: Answer }[];
  const ids = [plan.owner_id as string, ...rows.map((r) => r.user_id)];
  const { data: people } = await db().from('profiles').select('id, username, first_name').in('id', ids);
  const byId = new Map(((people ?? []) as Person[]).map((p) => [p.id, p]));
  const who = (id: string) => byId.get(id) ?? { id, username: '', first_name: 'Cineva' };
  return [{ person: who(plan.owner_id), answer: 'vin', owner: true }, ...rows.map((r) => ({ person: who(r.user_id), answer: r.answer }))];
}

/** Live: someone answered to a plan of mine, or called me to one. */
export function watchPlans(me: string, cb: () => void) {
  const ch = sb().channel('plans-' + me + '-' + Math.random().toString(36).slice(2))
    // an answer or a new person on a plan touches the plan (plans.changed_at), which comes only to the people in it
    .on('postgres_changes' as never, { event: 'UPDATE', schema: 'public', table: 'plans' } as never, cb)
    .subscribe(status=>{if(status==='SUBSCRIBED')cb();});
  const timer=setInterval(cb,15000);const app=AppState.addEventListener('change',s=>{if(s==='active')cb();});
  return()=>{clearInterval(timer);app.remove();void sb().removeChannel(ch);};
}

/** The one who made a shared plan drops it: it is gone for everyone. Someone called to it only leaves. */
export async function dropShared(pl: Plan, me: string) {
  if (!pl.sid) return;
  const {error}=await db().rpc(pl.owner===false?'plan_answer_v2':'plan_cancel_v2',pl.owner===false?{p_plan:pl.sid,p_answer:'nu_pot'}:{p_plan:pl.sid});
  if(error)throw new Error(error.message);
}

const isoDay = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** Brings the shared plans on this phone in step with the server: a plan the maker cancelled goes away, a new time
 *  is copied. Returns the names of the cancelled ones (to tell the person). */
export async function syncShared(): Promise<string[]> {
  const user=getApp().who?.id;
  const mine = ((getApp().board.plans as Plan[] | undefined) ?? []).filter((x) => x.sid);
  if (!mine.length) return [];
  const { data } = await db().from('plans').select('id, status, starts_at, venue_name').in('id', mine.map((x) => x.sid));
  const rows = (data ?? []) as { id: string; status: string; starts_at: string; venue_name: string }[];
  if(user!==getApp().who?.id)return [];
  const gone: string[] = [];
  for (const pl of mine) {
    const r = rows.find((x) => x.id === pl.sid);
    if (!r) continue;
    if (r.status === 'cancelled') { removePlan(pl.pid); gone.push(r.venue_name); continue; }
    const state=await stateOf(r.id);
    if(user!==getApp().who?.id)return [];
    if(state.attendance)updPlan(pl.pid,{people:state.attendance.people});
    const at = new Date(r.starts_at);
    if (hhmm(at) !== pl.slot || isoDay(at) !== pl.date) updPlan(pl.pid, { slot: hhmm(at), date: isoDay(at) });
  }
  return gone;
}

/** The maker changed the time on the ticket: everyone called to it gets the new time. */
export async function moveShared(pl: Plan, slot: string) {
  if (!pl.sid || pl.owner === false) return;
  const {error}=await db().rpc('plan_edit_v2',{p_plan:pl.sid,p_at:startsAt({...pl,slot}).toISOString(),p_people:pl.people});if(error)throw new Error(error.message);
}
