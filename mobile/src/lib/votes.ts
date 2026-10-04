// Votul cu gașca, through Supabase: up to three places, everyone votes Da / Nu / Super (one Super each) from their own
// phone, the results move live, and when time is up (or everyone voted) the winner becomes one plan for all.
import { sb } from './auth';
import type { Person } from './friends';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => sb() as any;

export type Ballot = 'da' | 'nu' | 'super';
export interface VoteOption { id: string; venueId: string; name: string; details: { title?: string; price?: number; dist?: number; starts_at?: string; slot?: string } }
export interface VoteRow { id: string; title: string; crewId: string | null; crewName?: string; closesAt: string; createdBy: string | null; planId: string | null }
export interface VoteFull extends VoteRow {
  options: VoteOption[];
  voters: Person[];
  ballots: { optionId: string; userId: string; value: Ballot }[];
}
export interface Score { optionId: string; da: number; nu: number; super: number; score: number }

export const DEADLINES: [string, string, number][] = [['30m', '30 min', 30], ['1h', 'o oră', 60], ['3h', '3 ore', 180], ['24h', 'până mâine', 1440]];

/** Starts a vote for a crew or for friends picked one by one. Returns the vote id or an error to show. */
export async function startVote(o: { crewId?: string | null; friendIds?: string[]; minutes: number; options: { venueId: string; name: string; details: VoteOption['details'] }[] }): Promise<{ id?: string; err?: string }> {
  if (o.options.length < 2) return { err: 'Votul are nevoie de cel puțin 2 variante.' };
  const closes = new Date(Date.now() + o.minutes * 60000).toISOString();
  const { data, error } = await db().rpc('start_vote', {
    p_crew: o.crewId ?? null, p_friends: o.friendIds ?? [], p_closes_at: closes, p_title: 'Unde mergem?',
    p_options: o.options.map((x) => ({ venue_id: x.venueId, venue_name: x.name, details: x.details })),
  });
  if (error) return { err: String(error.message || 'Nu am putut porni votul. Încearcă iar.') };
  return { id: data as string };
}

const row = (s: { id: string; title: string; crew_id: string | null; closes_at: string; created_by: string | null; plan_id: string | null }, crews: Map<string, string>): VoteRow =>
  ({ id: s.id, title: s.title, crewId: s.crew_id, crewName: s.crew_id ? crews.get(s.crew_id) : undefined, closesAt: s.closes_at, createdBy: s.created_by, planId: s.plan_id });

async function crewNames(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const { data } = await db().from('crews').select('id, name').in('id', ids);
  return new Map(((data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
}

/** Votes I am in that are open, or closed in the last day without a plan yet. */
export async function listVotes(): Promise<VoteRow[]> {
  const since = new Date(Date.now() - 864e5).toISOString();
  const { data, error } = await db().from('vote_sessions').select('id, title, crew_id, closes_at, created_by, plan_id').gt('closes_at', since).order('closes_at');
  if (error || !data) return [];
  const rows = data as { id: string; title: string; crew_id: string | null; closes_at: string; created_by: string | null; plan_id: string | null }[];
  const crews = await crewNames([...new Set(rows.flatMap((r) => (r.crew_id ? [r.crew_id] : [])))]);
  return rows.map((r) => row(r, crews)).filter((r) => !r.planId || new Date(r.closesAt).getTime() > Date.now());
}

export async function getVote(id: string): Promise<VoteFull | null> {
  const [{ data: s }, { data: opts }, { data: vv }, { data: bb }] = await Promise.all([
    db().from('vote_sessions').select('id, title, crew_id, closes_at, created_by, plan_id').eq('id', id).maybeSingle(),
    db().from('vote_options').select('id, venue_id, venue_name, details, position').eq('session_id', id).order('position'),
    db().from('vote_voters').select('user_id').eq('session_id', id),
    db().from('ballots').select('option_id, user_id, value').eq('session_id', id),
  ]);
  if (!s) return null;
  const ids = ((vv ?? []) as { user_id: string }[]).map((v) => v.user_id);
  const { data: people } = ids.length ? await db().from('profiles').select('id, username, first_name').in('id', ids) : { data: [] };
  const known = new Map(((people ?? []) as Person[]).map((p) => [p.id, p]));
  const crews = await crewNames(s.crew_id ? [s.crew_id] : []);
  return {
    ...row(s, crews),
    options: ((opts ?? []) as { id: string; venue_id: string; venue_name: string; details: VoteOption['details'] }[]).map((o) => ({ id: o.id, venueId: o.venue_id, name: o.venue_name, details: o.details ?? {} })),
    voters: ids.map((u) => known.get(u) ?? { id: u, username: '', first_name: 'Cineva' }),
    ballots: ((bb ?? []) as { option_id: string; user_id: string; value: Ballot }[]).map((b) => ({ optionId: b.option_id, userId: b.user_id, value: b.value })),
  };
}

/** Super = 2, Da = 1, Nu = -1; ties go to the option listed first (same as the server's vote_results). */
export function scores(v: VoteFull): Score[] {
  return v.options.map((o) => {
    const mine = v.ballots.filter((b) => b.optionId === o.id);
    const da = mine.filter((b) => b.value === 'da').length, nu = mine.filter((b) => b.value === 'nu').length, sup = mine.filter((b) => b.value === 'super').length;
    return { optionId: o.id, da, nu, super: sup, score: 2 * sup + da - nu };
  });
}
export function winner(v: VoteFull): VoteOption | null {
  const sc = scores(v);
  let best = -1, at = -Infinity;
  sc.forEach((s, i) => { if (s.score > at) { at = s.score; best = i; } });
  return best >= 0 ? v.options[best] : null;
}
/** Done when time is up or everyone gave an answer to every place. */
export function isOver(v: VoteFull, now = Date.now()) {
  if (new Date(v.closesAt).getTime() <= now) return true;
  return v.voters.every((p) => v.options.every((o) => v.ballots.some((b) => b.userId === p.id && b.optionId === o.id)));
}
export const votedAll = (v: VoteFull, userId: string) => v.options.every((o) => v.ballots.some((b) => b.userId === userId && b.optionId === o.id));

/** My answer for one place; pressing the same one again takes it back. A second Super moves the first one to Da. */
export async function cast(v: VoteFull, me: string, optionId: string, value: Ballot | null): Promise<string | null> {
  if (value === 'super') {
    const old = v.ballots.find((b) => b.userId === me && b.value === 'super' && b.optionId !== optionId);
    if (old) {
      const { error } = await db().from('ballots').update({ value: 'da', updated_at: new Date().toISOString() }).eq('session_id', v.id).eq('option_id', old.optionId).eq('user_id', me);
      if (error) return 'Nu am putut muta Super-ul. Încearcă iar.';
    }
  }
  const q = value === null
    ? db().from('ballots').delete().eq('session_id', v.id).eq('option_id', optionId).eq('user_id', me)
    : db().from('ballots').upsert({ session_id: v.id, option_id: optionId, user_id: me, value, updated_at: new Date().toISOString() });
  const { error } = await q;
  if (!error) return null;
  return /closes_at|row-level|policy/i.test(error.message ?? '') ? 'Votul s-a închis.' : 'Nu am putut trimite votul. Verifică internetul.';
}

/** Live updates for one vote: every change of a ballot or of the vote itself calls `cb`. Returns a stop function. */
export function watchVote(id: string, cb: () => void) {
  const ch = sb().channel('vote-' + id)
    .on('postgres_changes' as never, { event: '*', schema: 'public', table: 'ballots', filter: 'session_id=eq.' + id } as never, cb)
    .on('postgres_changes' as never, { event: 'UPDATE', schema: 'public', table: 'vote_sessions', filter: 'id=eq.' + id } as never, cb)
    .subscribe();
  const poll = setInterval(cb, 15000); // in case the live channel drops (a phone on the move)
  return () => { clearInterval(poll); void sb().removeChannel(ch); };
}

/** Turns the winner into one plan for everyone in the vote (made once, whoever asks first). Returns the plan id. */
export async function planFromVote(id: string): Promise<{ planId?: string; err?: string }> {
  const { data, error } = await db().rpc('plan_from_vote', { p_session: id });
  if (error) return { err: 'Nu am putut face planul. Încearcă iar.' };
  return { planId: data as string };
}
