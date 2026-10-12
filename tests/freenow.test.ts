// FreeNow (Cornel, 12.10): cine te vede (prietenii + prietenii lor, 2 pași), ieșirea, votul, limitele, minorii.
import { prepareAuthSchema, authenticateFixture, seedAuthFixture } from './fixtures/auth.mjs';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let db: PGlite;
const U = {
  cornel: '00000000-0000-0000-0000-0000000000f1', mihai: '00000000-0000-0000-0000-0000000000f2',
  andrei: '00000000-0000-0000-0000-0000000000f3', gabi: '00000000-0000-0000-0000-0000000000f4',
  teen: '00000000-0000-0000-0000-0000000000f5', ana: '00000000-0000-0000-0000-0000000000f6',
};
type Who = keyof typeof U;
const q = (sql: string, args: unknown[] = []) => db.query<any>(sql, args);
async function as(u: Who, sql: string, args: unknown[] = []) {
  await db.exec('reset role'); await authenticateFixture(db, U[u]); await db.exec('set role authenticated');
  try { return await q(sql, args); } finally { await db.exec('reset role'); }
}
async function befriend(a: Who, b: Who) { await q('insert into friendships(requester,addressee) values($1,$2)', [U[a], U[b]]); await q("update friendships set status='accepted' where requester=$1 and addressee=$2", [U[a], U[b]]); }
const one = async (u: Who, sql: string, args: unknown[] = []) => Object.values((await as(u, sql, args)).rows[0] ?? {})[0] as any;
const list = (u: Who) => one(u, 'select free_now_list() r');
const seen = async (u: Who) => (await list(u)).people.map((p: any) => p.first_name).sort();
const start = (u: Who, audience = 'fof', extra = '') => one(u, `select free_now_set(now() + interval '2 hours', null, array['pahar'], '${audience}'${extra}) r`);
const quiet = () => { const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Bucharest' }).format(new Date())); return h >= 2 && h < 9; };
const late = () => { const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Bucharest' }).format(new Date())); return h >= 22 || h < 5; };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;`);
  await prepareAuthSchema(db);
  for (const f of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
  await db.exec('grant usage on schema public to anon,authenticated');
  for (const [name, id] of Object.entries(U)) {
    await q("insert into auth.users(id,created_at) values($1,now()-interval '30 days')", [id]);
    await seedAuthFixture(db, id);
    await as(name as Who, 'select complete_signup($1,$2,$3::date)', [name, name[0].toUpperCase() + name.slice(1), name === 'teen' ? '2010-01-01' : '2000-01-01']);
  }
  // Cornel–Mihai, Mihai–Andrei, Andrei–Gabi, Mihai–Teen
  for (const [a, b] of [['cornel', 'mihai'], ['mihai', 'andrei'], ['andrei', 'gabi'], ['mihai', 'teen']] as [Who, Who][])
    await befriend(a, b);
  await db.exec(`insert into venues(id,name,cat,lat,lon,data) values('v1','Bar unu','bar',44.43,26.1,'{}'),('v2','Bar doi','bar',44.44,26.1,'{}');`);
}, 90000);
beforeEach(async () => {
  await db.exec(`update free_now set starts_at = least(starts_at, now()) - interval '1 hour', ends_at = least(starts_at, now()) - interval '1 minute';
    update free_outings set status = 'closed'; truncate private.free_starts, private.free_pushes; update free_mutes set active = false;`);
});
afterAll(() => db?.close());

it('prietenii prietenilor: Cornel îl văd Mihai și Andrei, dar nu și Gabi', async () => {
  const r = await start('cornel');
  expect(r.ends_at).toBeTruthy();
  expect(await seen('mihai')).toEqual(['Cornel']);
  expect(await seen('andrei')).toEqual(['Cornel']);
  expect((await list('andrei')).people[0].via).toBe('Mihai');
  expect((await list('mihai')).people[0].via).toBeNull();
  expect(await seen('gabi')).toEqual([]);
  expect(await seen('ana')).toEqual([]);
  if (!quiet()) expect((await q('select count(*)::int n from private.free_pushes where sender=$1', [U.cornel])).rows[0].n).toBe(2);
});

it('doar prietenii: Andrei nu-l mai vede; doar pe cine aleg', async () => {
  await start('cornel', 'friends');
  expect(await seen('mihai')).toEqual(['Cornel']);
  expect(await seen('andrei')).toEqual([]);
  await one('cornel', 'select free_now_stop() r');
  await one('mihai', `select free_now_set(now()+interval '1 hour', null, '{}', 'pick', null, array[$1]::uuid[]) r`, [U.cornel]);
  expect(await seen('cornel')).toEqual(['Mihai']);
  expect(await seen('andrei')).toEqual([]);
  await expect(one('cornel', `select free_now_set(now()+interval '1 hour', null, '{}', 'pick', null, array[$1]::uuid[]) r`, [U.gabi])).rejects.toThrow(/doar prieteni/);
});

it('sub 18: nu trece prin prietenii prietenilor, nici nu e văzut așa', async () => {
  await start('cornel');
  expect(await seen('teen')).toEqual([]);                      // Teen e prieten cu Mihai, nu cu Cornel
  if (late()) return;                                          // după 23:00 minorii nu pot intra (verificat mai jos)
  await start('teen');
  expect(await seen('mihai')).toEqual(['Cornel', 'Teen']);
  expect(await seen('andrei')).toEqual(['Cornel']);            // prietenul lui Mihai nu-l vede pe minor
});

it('minorii: cel târziu la 23:00', async () => {
  if (late()) { await expect(start('teen')).rejects.toThrow(/până la 23:00/); return; }
  const r = await one('teen', `select free_now_set(now()+interval '10 hours', null, '{}', 'friends') r`);
  const end = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Bucharest' }).format(new Date(r.ends_at));
  expect(end <= '23:00').toBe(true);
});

it('cel mult 3 intrări pe zi; schimbarea (+1 oră) nu se numără', async () => {
  await start('cornel');
  await one('cornel', `select free_now_set(now()+interval '3 hours', null, array['film'], 'fof') r`);
  await one('cornel', 'select free_now_stop() r');
  await start('cornel'); await one('cornel', 'select free_now_stop() r');
  await start('cornel'); await one('cornel', 'select free_now_stop() r');
  await expect(start('cornel')).rejects.toThrow(/de 3 ori/);
});

it('ieșirea: Andrei vine, apoi Mihai; Gabi nu poate; votul și planul cu „Vin”', async () => {
  await start('cornel');
  const o = await one('andrei', 'select free_join($1) r', [U.cornel]);
  expect(await one('mihai', 'select free_join($1) r', [U.cornel])).toBe(o);
  await expect(one('gabi', 'select free_join($1) r', [U.cornel])).rejects.toThrow(/Nu mai e pe FreeNow/);
  const mine = (await list('cornel')).outing;
  expect(mine.members.map((m: any) => m.first_name)).toEqual(['Cornel', 'Andrei', 'Mihai']);
  expect(mine.host).toBe(U.cornel);
  const v = await one('andrei', `select free_vote('[{"venue_id":"v1","venue_name":"x"},{"venue_id":"v2","venue_name":"y"}]'::jsonb) r`);
  expect((await q('select count(*)::int n from vote_voters where session_id=$1', [v])).rows[0].n).toBe(3);
  await expect(one('andrei', 'select free_vote_end() r')).rejects.toThrow(/Doar cine a pornit/);
  const opt = (await q("select id from vote_options where session_id=$1 and venue_id='v2'", [v])).rows[0].id;
  await as('mihai', "insert into ballots(session_id,option_id,user_id,value) values($1,$2,auth.uid(),'super')", [v, opt]);
  await one('cornel', 'select free_vote_end() r');
  await db.exec('select pg_sleep(1.1)');
  const p = await one('andrei', 'select plan_from_vote($1) r', [v]);
  const plan = (await list('mihai')).outing.plan;
  expect(plan.venue_name).toBe('Bar doi');
  expect((await q("select count(*)::int n from plan_members where plan_id=$1 and answer='vin'", [p])).rows[0].n).toBe(2);
  // cine intră după plan: direct pe plan, cu „Vin”; prietenii văd „merg la Bar doi”
  await start('ana', 'friends');
  await befriend('cornel', 'ana');
  expect((await list('ana')).people.find((x: any) => x.first_name === 'Cornel').outing.plan.venue_name).toBe('Bar doi');
  await one('ana', 'select free_join($1) r', [U.cornel]);
  expect((await q("select answer from plan_members where plan_id=$1 and user_id=$2", [p, U.ana])).rows[0].answer).toBe('vin');
});

it('cine pleacă: gazda trece la următorul; rămas singur, ieșirea se închide', async () => {
  await start('cornel');
  const o = await one('andrei', 'select free_join($1) r', [U.cornel]);
  await one('mihai', 'select free_join($1) r', [U.cornel]);
  await one('cornel', 'select free_now_stop() r');
  expect((await q('select host from free_outings where id=$1', [o])).rows[0].host).toBe(U.andrei);
  await one('mihai', 'select free_leave() r');
  expect((await q('select status from free_outings where id=$1', [o])).rows[0].status).toBe('closed');
  expect((await list('andrei')).outing).toBeNull();
});

it('într-o ieșire cu un minor intră doar prietenii lui', async () => {
  if (late()) return;
  await start('teen', 'friends');
  await one('mihai', 'select free_join($1) r', [U.teen]);
  await one('mihai', 'select free_now_set(now()+interval \'1 hour\', null, \'{}\', \'fof\') r');
  await expect(one('cornel', 'select free_join($1) r', [U.mihai])).rejects.toThrow(/sub 18/);
  expect((await list('mihai')).outing.has_minor).toBe(true);
});

it('notificări: oprite de la un om sau toate; 1 pe zi de la același om', async () => {
  if (quiet()) return;
  await one('mihai', 'select free_mute($1, true) r', [U.cornel]);
  await start('cornel'); await one('cornel', 'select free_now_stop() r');
  const got = (await q('select receiver from private.free_pushes where sender=$1', [U.cornel])).rows.map((r: any) => r.receiver);
  expect(got).toContain(U.andrei); expect(got).not.toContain(U.mihai);
  await start('cornel');
  expect((await q('select count(*)::int n from private.free_pushes where sender=$1', [U.cornel])).rows[0].n).toBe(got.length);
  await one('mihai', 'select free_mute($1, false) r', [U.cornel]);
  await one('andrei', 'select free_mute($1, true) r', [U.andrei]);
  expect((await list('andrei')).quiet).toBe(true);
});

it('nimeni nu scrie direct în tabele și nimeni nu vede rândul altuia', async () => {
  await start('cornel');
  await expect(as('mihai', "insert into free_now(user_id,starts_at,ends_at) values($1,now(),now()+interval '1 hour')", [U.mihai])).rejects.toThrow();
  await expect(as('cornel', "update free_now set user_id=$1", [U.mihai])).resolves.toMatchObject({ affectedRows: 0 });
  expect((await as('mihai', 'select * from free_now where user_id <> auth.uid()')).rows).toEqual([]);
  expect((await as('gabi', 'select * from free_outings')).rows).toEqual([]);
  const anyOuting = (await q('select id from free_outings limit 1')).rows[0]?.id ?? '00000000-0000-0000-0000-000000000000';
  await expect(as('gabi', 'insert into free_outing_members(outing_id,user_id) values($1,auth.uid())', [anyOuting])).rejects.toThrow();
  await db.exec('set role anon');
  try { await expect(q('select free_now_list()')).rejects.toThrow(/permission denied/); } finally { await db.exec('reset role'); }
});
