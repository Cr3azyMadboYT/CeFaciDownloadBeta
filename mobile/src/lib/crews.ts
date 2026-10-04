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
