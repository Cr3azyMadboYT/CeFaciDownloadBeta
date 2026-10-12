// Echipa localului (verificarea Business, 13.10): proprietarul nu face pe nimeni proprietar și nu scoate alt proprietar;
// oamenii CeFaci nu intră în echipa unui local; fiecare schimbare rămâne în jurnal.
import { prepareAuthSchema, authenticateFixture, seedAuthFixture } from './fixtures/auth.mjs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let db: PGlite;
const U = { owner: '00000000-0000-0000-0000-0000000000b1', owner2: '00000000-0000-0000-0000-0000000000b2', ana: '00000000-0000-0000-0000-0000000000b3', crew: '00000000-0000-0000-0000-0000000000b4' };
type Who = keyof typeof U;
const q = (sql: string, args: unknown[] = []) => db.query<any>(sql, args);
async function as(u: Who, sql: string, args: unknown[] = []) {
  await db.exec('reset role'); await authenticateFixture(db, U[u]); await db.exec('set role authenticated');
  try { return await q(sql, args); } finally { await db.exec('reset role'); }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;`);
  await prepareAuthSchema(db);
  for (const f of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
  await db.exec('grant usage on schema public to anon,authenticated');
  for (const [name, id] of Object.entries(U)) {
    await q("insert into auth.users(id,created_at) values($1,now()-interval '30 days')", [id]);
    await seedAuthFixture(db, id);
    await as(name as Who, "select complete_signup($1,$1,'2000-01-01')", [name]);
  }
  await db.exec(`insert into venues(id,name,cat,lat,lon,data) values('t','Local','mancare',44.43,26.1,'{}');
    insert into partners(venue_id,firm,cui,rate,activated_at,free_until) values('t','Firma SRL','1234567',.1,current_date-60,current_date-30);`);
  await q("insert into partner_members(venue_id,user_id,role) values('t',$1,'proprietar'),('t',$2,'proprietar')", [U.owner, U.owner2]);
  await q("insert into staff(user_id,role) values($1,'suport')", [U.crew]);
}, 90000);
afterAll(() => db?.close());

it('proprietarul nu face pe nimeni proprietar și nu scoate alt proprietar', async () => {
  await expect(as('owner', "select biz_team_set('t','@ana','proprietar')")).rejects.toThrow(/doar prin CeFaci/);
  await expect(as('owner', "select biz_team_set('t','@owner2','scos')")).rejects.toThrow(/doar prin CeFaci/);
  await expect(as('owner', "select biz_team_set('t','@owner2','scanare')")).rejects.toThrow(/doar prin CeFaci/);
  expect((await q("select count(*)::int n from partner_members where venue_id='t' and role='proprietar' and active")).rows[0].n).toBe(2);
});

it('oamenii CeFaci nu intră în echipa localului; schimbările rămân în jurnal', async () => {
  await expect(as('owner', "select biz_team_set('t','@crew','manager')")).rejects.toThrow(/echipei CeFaci/);
  await as('owner', "select biz_team_set('t','@ana','manager')");
  await as('owner', "select biz_team_set('t','@ana','scos')");
  expect((await q("select role from private.team_log where venue_id='t' order by at")).rows.map((r: any) => r.role)).toEqual(['manager', 'scos']);
});
