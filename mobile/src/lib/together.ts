// Plans shared with a crew or with friends (Supabase plans + plan_members): they answer "Vin" or "Nu pot",
// and the one who made it sees who comes. A vote's winner arrives here too.
import { APP } from '../../../src/app/bridge';
import { sb } from './auth';
import type { Person } from './friends';
import { createPlanAt, hhmm, removePlan, startsAt, updPlan, type Plan } from './plans';
import { getApp } from './session';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => sb() as any;

export type Answer = 'pending' | 'vin' | 'nu_pot';
export interface Invite { planId: string; venueId: string; venueName: string; startsAt: string; owner: Person; answer: Answer; crewId: string | null }
export interface Going { person: Person; answer: Answer; owner?: boolean }

/** Sends a plan to a crew (its members) or to friends; they get it in Planuri with Vin / Nu pot. */
export async function sharePlan(pl: Plan, me: string, to: { crewId?: string | null; friendIds?: string[] }): Promise<string | null> {
  const p = APP.byId(pl.placeId);
  if (!p) return 'Nu mai găsim locul ăsta.';
  let sid = pl.sid;
  if (!sid) {
    const { data, error } = await db().from('plans').insert({ owner_id: me, crew_id: to.crewId ?? null, venue_id: pl.placeId, venue_name: p.name, starts_at: startsAt(pl).toISOString() }).select('id').single();
    if (error || !data) return 'Nu am putut trimite planul. Încearcă iar.';
    sid = (data as { id: string }).id;
    updPlan(pl.pid, { sid, owner: true });
  }
  let ids = to.friendIds ?? [];
  if (to.crewId) {
    const { data } = await db().from('crew_members').select('user_id').eq('crew_id', to.crewId).eq('status', 'member');
    ids = [...new Set([...ids, ...((data ?? []) as { user_id: string }[]).map((r) => r.user_id)])];
  }
  ids = ids.filter((u) => u !== me);
  if (!ids.length) return 'Nu e nimeni de chemat.';
  const { error } = await db().from('plan_members').upsert(ids.map((user_id) => ({ plan_id: sid, user_id })), { onConflict: 'plan_id,user_id', ignoreDuplicates: true });
  return error ? 'Nu am putut chema pe toată lumea. Încearcă iar.' : null;
}

/** Plans other people called me to, from today on. */
export async function listInvites(me: string): Promise<Invite[]> {
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
  const { error } = await db().from('plan_members').update({ answer: a, answered_at: new Date().toISOString() }).eq('plan_id', inv.planId).eq('user_id', me);
  if (error) return 'Nu am putut trimite răspunsul. Încearcă iar.';
  if (a === 'vin' && APP.byId(inv.venueId)) createPlanAt(inv.venueId, new Date(inv.startsAt), 2, { sid: inv.planId, owner: false });
  return null;
}

/** I opened a shared plan from its vote: that counts as "Vin" (no-op for the one who made it). */
export async function comeTo(sid: string, me: string) {
  await db().from('plan_members').update({ answer: 'vin', answered_at: new Date().toISOString() }).eq('plan_id', sid).eq('user_id', me).eq('answer', 'pending');
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
    .on('postgres_changes' as never, { event: '*', schema: 'public', table: 'plan_members' } as never, cb)
    .on('postgres_changes' as never, { event: 'UPDATE', schema: 'public', table: 'plans' } as never, cb)
    .subscribe();
  return () => { void sb().removeChannel(ch); };
}

/** The one who made a shared plan drops it: it is gone for everyone. Someone called to it only leaves. */
export async function dropShared(pl: Plan, me: string) {
  if (!pl.sid) return;
  // each only changes what the database lets that person change: the maker cancels, the others answer "Nu pot"
  await db().from('plan_members').update({ answer: 'nu_pot', answered_at: new Date().toISOString() }).eq('plan_id', pl.sid).eq('user_id', me);
  if (pl.owner !== false) await db().from('plans').update({ status: 'cancelled' }).eq('id', pl.sid).eq('owner_id', me);
}

const isoDay = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** Brings the shared plans on this phone in step with the server: a plan the maker cancelled goes away, a new time
 *  is copied. Returns the names of the cancelled ones (to tell the person). */
export async function syncShared(): Promise<string[]> {
  const mine = ((getApp().board.plans as Plan[] | undefined) ?? []).filter((x) => x.sid && x.owner === false);
  if (!mine.length) return [];
  const { data } = await db().from('plans').select('id, status, starts_at, venue_name').in('id', mine.map((x) => x.sid));
  const rows = (data ?? []) as { id: string; status: string; starts_at: string; venue_name: string }[];
  const gone: string[] = [];
  for (const pl of mine) {
    const r = rows.find((x) => x.id === pl.sid);
    if (!r) continue;
    if (r.status === 'cancelled') { removePlan(pl.pid); gone.push(r.venue_name); continue; }
    const at = new Date(r.starts_at);
    if (hhmm(at) !== pl.slot || isoDay(at) !== pl.date) updPlan(pl.pid, { slot: hhmm(at), date: isoDay(at) });
  }
  return gone;
}

/** The maker changed the time on the ticket: everyone called to it gets the new time. */
export async function moveShared(pl: Plan, slot: string) {
  if (!pl.sid || pl.owner === false) return;
  await db().from('plans').update({ starts_at: startsAt({ ...pl, slot }).toISOString() }).eq('id', pl.sid);
}
