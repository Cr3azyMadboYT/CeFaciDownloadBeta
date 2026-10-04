// Friends, through Supabase (etapa 2): find someone by exact @username (adults only) or by their code,
// send a request, accept or refuse (refusing deletes it quietly), remove.
import { sb } from './auth';

// no generated database types yet: rows are typed by hand below
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => sb() as any;

export interface Person { id: string; username: string; first_name: string }
export interface FriendRow { person: Person; status: 'pending' | 'accepted'; incoming: boolean }

export async function myCode(me: string): Promise<string | null> {
  const { data } = await db().from('profiles').select('friend_code').eq('id', me).maybeSingle();
  return (data as { friend_code?: string } | null)?.friend_code ?? null;
}

export async function listFriends(me: string): Promise<FriendRow[]> {
  const { data, error } = await db().from('friendships').select('requester, addressee, status');
  if (error || !data) return [];
  const rows = data as { requester: string; addressee: string; status: 'pending' | 'accepted' }[];
  const ids = rows.map((r) => (r.requester === me ? r.addressee : r.requester));
  if (!ids.length) return [];
  const { data: people } = await db().from('profiles').select('id, username, first_name').in('id', ids);
  const byId = new Map(((people ?? []) as Person[]).map((p) => [p.id, p]));
  return rows.flatMap((r) => {
    const other = r.requester === me ? r.addressee : r.requester;
    const person = byId.get(other);
    return person ? [{ person, status: r.status, incoming: r.addressee === me }] : [];
  });
}

export async function findUser(username: string): Promise<Person | null> {
  const { data } = await db().rpc('find_user', { p_username: username.replace(/^@+/, '').toLowerCase() });
  return ((data as Person[] | null) ?? [])[0] ?? null;
}

export async function ask(me: string, them: string): Promise<string | null> {
  const { error } = await db().from('friendships').insert({ requester: me, addressee: them });
  if (!error) return null;
  return /duplicate|unique/i.test(error.message) ? 'Sunteți deja prieteni sau cererea e trimisă.' : 'Nu am putut trimite cererea. Încearcă iar.';
}
export async function addByCode(code: string): Promise<string | null> {
  const { error } = await db().rpc('add_friend_by_code', { p_code: code.trim().toLowerCase() });
  return error ? 'Codul nu e bun.' : null;
}
export async function accept(me: string, them: string) {
  await db().from('friendships').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('requester', them).eq('addressee', me);
}
export async function remove(me: string, them: string) {
  await db().from('friendships').delete().or(`and(requester.eq.${me},addressee.eq.${them}),and(requester.eq.${them},addressee.eq.${me})`);
}

export interface Profile extends Person { xp: number; stamps: number }
/** A friend's card: name, level (XP) and stamps; null if we may not see them. */
export async function profileOf(id: string): Promise<Profile | null> {
  const { data } = await db().from('profiles').select('id, username, first_name, xp, stamps').eq('id', id).maybeSingle();
  return (data as Profile | null) ?? null;
}
export async function mutual(id: string): Promise<Person[]> {
  const { data } = await db().rpc('mutual_friends', { p_other: id });
  return (data as Person[] | null) ?? [];
}
