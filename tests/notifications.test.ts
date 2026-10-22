// Clopoțelul (22.10): fiecare își vede doar notificările lui, le marchează citite, nu le poate scrie sau muta;
// cererea de prietenie și „ați devenit prieteni” pornesc notificarea (prin private.push, care nu blochează nimic).
import { prepareAuthSchema, authenticateFixture, seedAuthFixture } from './fixtures/auth.mjs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let db: PGlite;
const U = { ana: '00000000-0000-0000-0000-000000000031', dan: '00000000-0000-0000-0000-000000000032' };
const q = (sql: string, args: unknown[] = []) => db.query<any>(sql, args);
async function as(who: keyof typeof U, sql: string, args: unknown[] = []) { await db.exec('reset role'); await authenticateFixture(db, U[who]); await db.exec('set role authenticated'); try { return await q(sql, args); } finally { await db.exec('reset role'); } }
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;`);
  await prepareAuthSchema(db);
  for (const f of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
  await db.exec('grant usage on schema public to anon,authenticated');
  for (const [name, id] of Object.entries(U)) { await q('insert into auth.users(id)values($1)', [id]); await seedAuthFixture(db, id); await as(name as keyof typeof U, "select complete_signup($1,$1,'2000-01-01')", [name]); }
}, 60000);
afterAll(() => db?.close());

it('a friend request and its acceptance never fail because of the notification', async () => {
  await as('ana', 'insert into friendships(requester,addressee) values($1,$2)', [U.ana, U.dan]);
  await as('dan', "update friendships set status='accepted',accepted_at=now() where requester=$1 and addressee=$2", [U.ana, U.dan]);
  expect((await q('select status from friendships')).rows[0].status).toBe('accepted');
});

it('each person sees and reads only their own notifications, and cannot write any', async () => {
  await q("insert into notifications(user_id,kind,ref,title,body,url) values($1,'friend',$2,'Dan vrea să fiți prieteni','x','/prieteni'),($2,'friend_ok',$1,'Tu și Ana','y','/prieten/'||$1)", [U.ana, U.dan]);
  expect((await as('ana', 'select title from notifications')).rows.map((r: any) => r.title)).toEqual(['Dan vrea să fiți prieteni']);
  await as('ana', 'select notifications_read()');
  expect((await q('select user_id, read_at is not null r from notifications order by id')).rows.map((r: any) => r.r)).toEqual([true, false]);
  await expect(as('ana', "insert into notifications(user_id,kind,ref,title,body,url) values($1,'friend',$1,'x','x','/')", [U.ana])).rejects.toThrow(/permission denied/);
  await expect(as('ana', 'update notifications set user_id=$1', [U.dan])).rejects.toThrow(/permission denied/);
  await expect(q("insert into notifications(user_id,kind,ref,title,body,url) values($1,'friend',$1,'x','x','https://evil.com')", [U.ana])).rejects.toThrow(/check/);
  await db.exec('set role anon');
  try { await expect(q('select * from notifications')).rejects.toThrow(/permission denied/); } finally { await db.exec('reset role'); }
});
