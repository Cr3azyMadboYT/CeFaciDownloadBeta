import {beforeAll, afterAll, it, expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';

let db: PGlite;
const ids = {client: '90000000-0000-0000-0000-000000000001', editor: '90000000-0000-0000-0000-000000000002', support: '90000000-0000-0000-0000-000000000003', accountant: '90000000-0000-0000-0000-000000000004', admin: '90000000-0000-0000-0000-000000000005', quota: '90000000-0000-0000-0000-000000000006'};
const q = (sql: string, args: unknown[] = []) => db.query<any>(sql, args);
async function as(who: keyof typeof ids, sql: string, args: unknown[] = []) {
  await q("select set_config('request.jwt.claim.sub',$1,false)", [ids[who]]);
  await db.exec('set role authenticated');
  try { return await q(sql, args); } finally { await db.exec('reset role'); }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
    create schema auth; create table auth.users(id uuid primary key,created_at timestamptz default now());
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create publication supabase_realtime;`);
  for (const file of fs.readdirSync('supabase/migrations').sort())
    await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
  await db.exec('grant usage on schema public to anon,authenticated');
  for (const [name, id] of Object.entries(ids)) {
    await q('insert into auth.users(id) values($1)', [id]);
    await as(name as keyof typeof ids, "select complete_signup($1,$1,'2000-01-01')", ['review' + name]);
  }
  for (const [name, role] of [['editor','editor'], ['support','suport'], ['accountant','contabil'], ['admin','admin']] as const)
    await q('insert into staff(user_id,role) values($1,$2)', [ids[name], role]);
  await db.exec("insert into venues(id,name,cat,lat,lon,data) values('review-venue','Review Local','mancare',44,26,'{}')");
  await q(`insert into venue_log(venue_id,by_user,action,after) values
    ('review-venue',$1,'partener','{"firm":"Confidential SRL","cui":"18547290"}'),
    ('review-venue',$1,'edit','{"name":"Public catalog edit"}')`, [ids.admin]);
}, 60000);
afterAll(() => db?.close());

it('prevents direct REST-equivalent venue_log reads from bypassing partner-sensitive RPC filtering', async () => {
  for (const who of ['editor', 'support', 'accountant'] as const) {
    try {
      const rows = (await as(who, 'select action,after from venue_log')).rows;
      expect(rows.some(row => row.action === 'partener')).toBe(false);
      if (who !== 'editor') expect(rows).toHaveLength(0);
    } catch (error) { expect(String(error)).toMatch(/permission denied/); }
  }
  expect((await as('admin', 'select action from venue_log')).rows.some(row => row.action === 'partener')).toBe(true);
});

it('preserves legacy insert compatibility but never trusts client-supplied lifecycle, revision or staff attribution', async () => {
  await as('client', `insert into reports(venue_id,kind,note,status,answer,handled_by,handled_at,revision,created_at)
    values('nou','altceva','LOC NOU: Loc de test','rezolvat','Pretins răspuns Admin',$1,now(),999,now()+interval '1 year')`, [ids.admin]);
  const r = (await q('select id,status,answer,handled_by,handled_at,revision,created_at from reports where user_id=$1', [ids.client])).rows[0];
  expect(r).toMatchObject({status: 'nou', answer: null, handled_by: null, handled_at: null, revision: 1});
  expect(new Date(r.created_at).getTime()).toBeLessThanOrEqual(Date.now());
  expect((await as('client', 'select support_reports() result')).rows[0].result.find((row:any) => row.id === r.id).answer).toBeNull();
});

it('rejects anonymous legacy queue submissions even when the JWT has an authenticated database role', async () => {
  await db.exec(`select set_config('request.jwt.claims','{"is_anonymous":true,"user_metadata":{"role":"fondator"}}',false)`);
  try { await expect(as('client', "insert into reports(venue_id,kind,note) values('nou','altceva','Loc anonymous')")).rejects.toThrow(/cont|anonim|autentific/i); }
  finally { await db.exec("select set_config('request.jwt.claims','{}',false)"); }
});

it('counts typed reports and legacy inserts against one daily budget rather than two independent quotas', async () => {
  for (let i = 0; i < 19; i++) await as('quota', "insert into reports(venue_id,kind,note) values('nou','altceva',$1)", ['Loc de test ' + i]);
  await as('quota', "select support_report_create('combined-last','issue','client','Problemă test','Descriere completă pentru problema test')");
  await expect(as('quota', "insert into reports(venue_id,kind,note) values('nou','altceva','Peste limita comună')")).rejects.toThrow(/limita|destule|multe|20|așteapt/i);
  await expect(as('quota', "select support_report_create('combined-over','issue','client','Problemă test','Descriere completă pentru problema test')")).rejects.toThrow(/limita|destule|multe|20|așteapt/i);
});

it('cannot manually erase an audit actor while account deletion still anonymizes the retained history', async () => {
  await as('admin', "select admin_staff_change($1,'editor','Ajută echipa cu localurile.',null)", [ids.client]);
  await expect(q('update private.admin_staff_log set by_user=null where target_user=$1', [ids.client])).rejects.toThrow(/jurnal|modifica/i);
  await q('delete from auth.users where id=$1', [ids.admin]);
  const log = (await q('select by_user,note from private.admin_staff_log where target_user=$1', [ids.client])).rows;
  expect(log).toHaveLength(1); expect(log[0].by_user).toBeNull();
  expect(log[0].note).toBe('Ajută echipa cu localurile.');
});
