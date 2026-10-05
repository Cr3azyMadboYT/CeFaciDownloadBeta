// Gășcile, through Supabase: a permanent crew needs at least 2 friends; friends are invited and show as
// "Invitat" until they accept. The admin can delete the crew; anyone can leave (the oldest member becomes admin).
import { sb } from './auth';
import type { Person } from './friends';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => sb() as any;

export const STAMP_ICONS: [string, string, string][] = [
  ['star', 'star', 'Stea'], ['dice', 'dice', 'Zar'], ['notes', 'club', 'Note muzicale'], ['target', 'target', 'Țintă'], ['cocktail', 'cocktail', 'Cocktail'],
  ['pizza', 'pizza', 'Pizza'], ['bolt', 'bolt', 'Fulger'], ['heart', 'heart', 'Inimă'], ['smile', 'smile', 'Zâmbet'], ['mic', 'mic', 'Microfon'],
]; // [stored key, icon name, label]
export const STAMP_COLORS: [string, string][] = [['#8C6CFF', 'Violet'], ['#2F5BFF', 'Albastru'], ['#FF6A4D', 'Coral'], ['#FFD43B', 'Galben'], ['#0E1440', 'Cerneală']];
export const iconOf = (key: string) => (STAMP_ICONS.find((x) => x[0] === key) ?? STAMP_ICONS[0])[1];

export interface Member { person: Person; status: 'invited' | 'member' }
export interface Crew { id: string; name: string; icon: string; color: string; adminId: string | null; mine: 'invited' | 'member'; members: Member[] }

/** Whether someone in the crew is under 18 (the server says only yes or no). */
export async function crewHasMinor(crewId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb() as any).rpc('crew_has_minor', { p_crew: crewId });
  return data === true;
}
export async function listCrews(me: string): Promise<Crew[]> {
  const { data: crews, error } = await db().from('crews').select('id, name, stamp_icon, stamp_color, admin_id, temporary');
  if (error || !crews?.length) return [];
  const ids = crews.map((c: { id: string }) => c.id);
  const { data: rows } = await db().from('crew_members').select('crew_id, user_id, status').in('crew_id', ids);
  const users = [...new Set(((rows ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  const { data: people } = users.length ? await db().from('profiles').select('id, username, first_name').in('id', users) : { data: [] };
  const byId = new Map(((people ?? []) as Person[]).map((p) => [p.id, p]));
  return (crews as { id: string; name: string; stamp_icon: string; stamp_color: string; admin_id: string | null; temporary: boolean }[])
    .filter((c) => !c.temporary)
    .map((c) => {
      const mem = ((rows ?? []) as { crew_id: string; user_id: string; status: 'invited' | 'member' }[]).filter((r) => r.crew_id === c.id);
      const mine = mem.find((r) => r.user_id === me)?.status ?? 'member';
      return {
        id: c.id, name: c.name, icon: c.stamp_icon, color: c.stamp_color, adminId: c.admin_id, mine,
        members: mem.filter((r) => r.user_id !== me).flatMap((r) => (byId.get(r.user_id) ? [{ person: byId.get(r.user_id)!, status: r.status }] : [])),
      };
    });
}

export async function createCrew(name: string, icon: string, color: string, friendIds: string[]): Promise<{ id?: string; err?: string }> {
  const { data, error } = await db().rpc('create_crew', { p_name: name, p_icon: icon, p_color: color, p_friends: friendIds, p_temporary: false });
  if (error) return { err: String(error.message || 'Nu am putut face gașca. Încearcă iar.') };
  return { id: data as string };
}
export async function acceptCrew(crewId: string, me: string) {
  const { error } = await db().from('crew_members').update({ status: 'member', joined_at: new Date().toISOString() }).eq('crew_id', crewId).eq('user_id', me);
  return error ? 'Nu am putut intra în gașcă. Încearcă iar.' : null;
}
export async function leaveCrew(crewId: string, me: string) {
  const { error } = await db().from('crew_members').delete().eq('crew_id', crewId).eq('user_id', me);
  return error ? 'Nu am putut ieși din gașcă. Încearcă iar.' : null;
}
export async function deleteCrew(crewId: string) {
  const { error } = await db().from('crews').delete().eq('id', crewId);
  return error ? 'Nu am putut șterge gașca. Încearcă iar.' : null;
}

/** Invites friends into a crew I am in (they show as "Invitat" until they accept). */
export async function inviteToCrew(crewId: string, me: string, ids: string[]) {
  if (!ids.length) return null;
  const { error } = await db().from('crew_members').insert(ids.map((user_id) => ({ crew_id: crewId, user_id, status: 'invited', invited_by: me })));
  if (!error) return null;
  return /15/.test(error.message ?? '') ? 'O gașcă are maximum 15 oameni.' : /duplicate|unique/i.test(error.message ?? '') ? 'E deja în gașcă sau invitat.' : 'Nu am putut trimite invitația. Încearcă iar.';
}
/** The crew's invite code (valid 7 days); the admin can make a new one, which stops the old one. */
export async function crewCode(crewId: string): Promise<{ code: string; until: string } | null> {
  const { data } = await db().from('crews').select('invite_token, invite_expires_at').eq('id', crewId).maybeSingle();
  return data ? { code: data.invite_token as string, until: data.invite_expires_at as string } : null;
}
export async function newCrewCode(crewId: string): Promise<string | null> {
  const { data, error } = await db().rpc('reset_crew_link', { p_crew: crewId });
  return error ? null : (data as string);
}
/** Joins a crew with the code someone sent. Returns the crew id or an error to show. */
export async function joinWithCode(code: string): Promise<{ id?: string; err?: string }> {
  const { data, error } = await db().rpc('join_crew', { p_token: code.trim().toLowerCase() });
  if (error) return { err: /expirat/i.test(error.message ?? '') ? 'Codul a expirat sau nu e bun. Cere unul nou.' : /15/.test(error.message ?? '') ? 'Gașca e plină (15 oameni).' : 'Nu am putut intra. Verifică codul.' };
  return { id: data as string };
}
/** The crew's carnet: the outings planned together, newest first. */
export async function crewOutings(crewId: string): Promise<{ id: string; venueId: string; name: string; at: string }[]> {
  const { data } = await db().from('plans').select('id, venue_id, venue_name, starts_at, status').eq('crew_id', crewId).neq('status', 'cancelled').lt('starts_at', new Date().toISOString()).order('starts_at', { ascending: false }).limit(30);
  return ((data ?? []) as { id: string; venue_id: string; venue_name: string; starts_at: string }[]).map((p) => ({ id: p.id, venueId: p.venue_id, name: p.venue_name, at: p.starts_at }));
}

// ---------- the crew learns (decision Cornel, 04.10: „aplicația să învețe ce-i place unui grup votând după fiecare ieșire”) ----------
/** After an outing planned together: how it was (−1 nu prea, 1 mi-a plăcut, 2 super), on the server. */
export async function voteOuting(planId: string, vote: -1 | 1 | 2): Promise<boolean> {
  const { error } = await db().from('outing_votes').upsert({ plan_id: planId, vote }, { onConflict: 'plan_id,user_id' });
  return !error;
}
const tasteMemo = new Map<string, { at: number; rows: { venue_id: string; score: number }[] }>();
/** The crew's votes, per place (after outings and in the votes before them); cached for 10 minutes. */
export async function crewTaste(crewId: string): Promise<{ venue_id: string; score: number }[]> {
  const hit = tasteMemo.get(crewId);
  if (hit && Date.now() - hit.at < 10 * 60e3) return hit.rows;
  const { data, error } = await db().rpc('crew_taste', { p_crew: crewId });
  const rows = error ? [] : ((data ?? []) as { venue_id: string; score: number }[]);
  tasteMemo.set(crewId, { at: Date.now(), rows });
  return rows;
}
