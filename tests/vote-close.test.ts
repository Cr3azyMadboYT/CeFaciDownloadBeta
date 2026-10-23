// Votul (23.10): no second vote with the same people while one is open; the one who started it can close it; an
// opened notification is read.
import { prepareAuthSchema, authenticateFixture, seedAuthFixture } from './fixtures/auth.mjs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let db: PGlite;
const U = { ana: '00000000-0000-0000-0000-000000000041', dan: '00000000-0000-0000-0000-000000000042', ion: '00000000-0000-0000-0000-000000000043' };
type Who = keyof typeof U;
const q = (sql: string, args: unknown[] = []) => db.query<any>(sql, args);
async function as(who: Who, sql: string, args: unknown[] = []) { await db.exec('reset role'); await authenticateFixture(db, U[who]); await db.exec('set role authenticated'); try { return await q(sql, args); } finally { await db.exec('reset role'); } }
const opts = JSON.stringify([{ venue_id: 'a', venue_name: 'A', details: {} }, { venue_id: 'b', venue_name: 'B', details: {} }]);
const start = (who: Who, friends: string[]) => as(who, "select start_vote(null,$1::uuid[],$2::jsonb,now()+interval '1 hour') r", [friends, opts]);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;`);
  await prepareAuthSchema(db);
  for (const f of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
  await db.exec('grant usage on schema public to anon,authenticated');
  for (const [name, id] of Object.entries(U)) { await q('insert into auth.users(id)values($1)', [id]); await seedAuthFixture(db, id); await as(name as Who, "select complete_signup($1,$1,'2000-01-01')", [name]); }
  await q("insert into venues(id,name,cat,lat,lon,data)values('a','A','mancare',44.4,26.1,'{}'),('b','B','bar',44.4,26.1,'{}')");
  await q('insert into friendships(requester,addressee) values($1,$2),($1,$3)', [U.ana, U.dan, U.ion]); await q("update friendships set status='accepted'");
}, 60000);
afterAll(() => db?.close());

it('a second vote with the same people is refused and points to the open one', async () => {
  const first = (await start('ana', [U.dan])).rows[0].r;
  let caught: any;
  try { await start('ana', [U.dan]); } catch (e) { caught = e; }
  expect(String(caught?.message)).toMatch(/Ai deja un vot deschis cu ei/);
  expect(caught?.detail).toBe(first);
  // other people: a new vote is fine
  expect((await start('ana', [U.dan, U.ion])).rows[0].r).toBeTruthy();
});

it('only the one who started it closes it, and only after someone voted; then the plan can be made', async () => {
  const v = (await q("select id from vote_sessions where created_by=$1 and (select count(*) from vote_voters where session_id=vote_sessions.id)=2", [U.ana])).rows[0].id;
  await expect(as('ana', 'select vote_close_now($1)', [v])).rejects.toThrow(/Nimeni n-a votat/);
  const opt = (await q("select id from vote_options where session_id=$1 and venue_id='b'", [v])).rows[0].id;
  await as('dan', "insert into ballots(session_id,option_id,user_id,value) values($1,$2,$3,'super')", [v, opt, U.dan]);
  await expect(as('dan', 'select vote_close_now($1)', [v])).rejects.toThrow(/Doar cine a pornit/);
  await as('ana', 'select vote_close_now($1)', [v]);
  expect((await q('select closes_at <= now() c from vote_sessions where id=$1', [v])).rows[0].c).toBe(true);
  // closed: a second vote with Dan is allowed again
  expect((await start('ana', [U.dan])).rows[0].r).toBeTruthy();
});

it('an opened notification is read; the others stay new', async () => {
  await q("insert into notifications(user_id,kind,ref,title,body,url) values($1,'vote',$1,'a','a','/vot/x'),($1,'friend',$1,'b','b','/prieteni')", [U.dan]);
  await as('dan', "select notifications_seen('/vot/x')");
  expect((await q('select url, read_at is not null r from notifications where user_id=$1 order by url', [U.dan])).rows).toEqual([{ url: '/prieteni', r: false }, { url: '/vot/x', r: true }]);
  await as('ana', "select notifications_seen('/prieteni')");
  expect((await q("select read_at from notifications where url='/prieteni'")).rows[0].read_at).toBeNull();
});
