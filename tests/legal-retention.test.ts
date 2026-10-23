// Partea legală (23.10): deleting the account does not lose paid tickets; the deadlines in the privacy policy run
// (notifications 180 days, ticket link opens 13 months, FreeNow day counters 30 days); „Datele mele” shows the activity.
import { prepareAuthSchema, authenticateFixture, seedAuthFixture } from './fixtures/auth.mjs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let db: PGlite;
const U = { ana: '00000000-0000-0000-0000-000000000051', dan: '00000000-0000-0000-0000-000000000052' };
type Who = keyof typeof U;
const q = (sql: string, args: unknown[] = []) => db.query<any>(sql, args);
async function as(who: Who, sql: string, args: unknown[] = []) { await db.exec('reset role'); await authenticateFixture(db, U[who]); await db.exec('set role authenticated'); try { return await q(sql, args); } finally { await db.exec('reset role'); } }
let ev = '', type = '';
async function ticket(who: Who, status = 'valid', orderStatus = 'platit') {
  const o = (await q("insert into ticket_orders(event_id,venue_id,user_id,status,tickets,subtotal,fee,total,commission,test,expires_at) values($1,'a',$2,$3,1,50,2,52,4,false,now()+interval '15 minutes') returning id", [ev, U[who], orderStatus])).rows[0].id;
  await q('insert into tickets(order_id,event_id,type_id,holder,status,test) values($1,$2,$3,$4,$5,false)', [o, ev, type, U[who], status]);
  return o;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;`);
  await prepareAuthSchema(db);
  for (const f of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
  await db.exec('grant usage on schema public to anon,authenticated');
  for (const [name, id] of Object.entries(U)) { await q('insert into auth.users(id)values($1)', [id]); await seedAuthFixture(db, id); await as(name as Who, "select complete_signup($1,$1,'2000-01-01')", [name]); }
  await q("insert into venues(id,name,cat,lat,lon,data)values('a','A','club',44.4,26.1,'{}')");
  ev = (await q("insert into events(title,kind,starts_at,venue_id,place_name,lat,lon,status,sale_mode) values('Concert','concert',now()+interval '3 days','a','Club A',44.4,26.1,'published','cefaci') returning id")).rows[0].id;
  type = (await q("insert into ticket_types(event_id,name,price,qty) values($1,'Intrare',50,100) returning id", [ev])).rows[0].id;
}, 60000);
afterAll(() => db?.close());

it('an account with a valid ticket or a refund on the way is not deleted; a used ticket does not stop it', async () => {
  await ticket('ana');
  await expect(as('ana', 'select delete_my_account()')).rejects.toThrow(/Ai bilete valabile sau o rambursare/);
  await q("update tickets set status='folosit' where holder=$1", [U.ana]);
  await ticket('ana', 'rambursat', 'de_rambursat');
  await expect(as('ana', 'select delete_my_account()')).rejects.toThrow(/Ai bilete valabile sau o rambursare/);
  await q("update ticket_orders set status='rambursat' where user_id=$1", [U.ana]);
  await as('ana', 'select delete_my_account()');
  expect((await q('select count(*)::int n from auth.users where id=$1', [U.ana])).rows[0].n).toBe(0);
  // the paid orders stay, without the account (accounting)
  expect((await q('select count(*)::int n, count(user_id)::int who from ticket_orders')).rows[0]).toEqual({ n: 2, who: 0 });
});

it('the daily cleanup keeps only what the policy says', async () => {
  const add = (days: number) => q("insert into notifications(user_id,kind,ref,title,body,url,created_at) values($1,'friend',gen_random_uuid(),'t','b','/prieteni',now()-make_interval(days=>$2))", [U.dan, days]);
  await add(10); await add(181);
  await q("insert into private.event_clicks(event_id,user_id,day) values($1,$2,current_date-10),($1,$2,current_date-400)", [ev, U.dan]);
  await q("insert into private.free_starts(user_id,day,n) values($1,current_date-1,1),($1,current_date-40,1)", [U.dan]);
  const r = (await q('select private.retention_daily() r')).rows[0].r;
  expect([r.notifications, r.event_clicks, r.free_starts]).toEqual([1, 1, 1]);
  expect((await q('select count(*)::int n from notifications where user_id=$1', [U.dan])).rows[0].n).toBe(1);
  await expect(as('dan', 'select private.retention_daily()')).rejects.toThrow(/permission denied/);
});

it('„Datele mele” shows the activity, without the push token', async () => {
  await ticket('dan');
  await q("insert into push_tokens(user_id,token) values($1,'secret-token')", [U.dan]).catch(() => {});
  const d = (await as('dan', 'select privacy_export_my_data() r')).rows[0].r;
  expect(d.format).toBe('cefaci-personal-core-v1');
  expect(d.notifications).toHaveLength(1);
  expect(d.tickets).toHaveLength(1);
  expect(d.ticket_orders).toHaveLength(1);
  expect(JSON.stringify(d)).not.toContain('secret-token');
  expect(d.coverage).toContain('100');
});
