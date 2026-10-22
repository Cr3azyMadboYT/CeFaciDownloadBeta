// Evenimente (22.10): who sees what, and the ticket link can only go to an official seller (no money through CeFaci).
import { prepareAuthSchema, authenticateFixture, seedAuthFixture } from './fixtures/auth.mjs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let db: PGlite;
const U = { client: '00000000-0000-0000-0000-000000000011', editor: '00000000-0000-0000-0000-000000000012', support: '00000000-0000-0000-0000-000000000013' };
const q = (sql: string, args: unknown[] = []) => db.query<any>(sql, args);
async function as(who: keyof typeof U, sql: string, args: unknown[] = []) { await db.exec('reset role'); await authenticateFixture(db, U[who]); await db.exec('set role authenticated'); try { return await q(sql, args); } finally { await db.exec('reset role'); } }
const ev = (over: Record<string, unknown> = {}) => JSON.stringify({ title: 'Concert de test', kind: 'concert', starts_at: new Date(Date.now() + 3 * 86400e3).toISOString(), place_name: 'Arenele Romane', lat: 44.42, lon: 26.1, price_from: 80, ticket_url: 'https://www.iabilet.ro/bilete-concert-test-123/', status: 'published', ...over });
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;`);
  await prepareAuthSchema(db);
  for (const f of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
  await db.exec('grant usage on schema public to anon,authenticated');
  for (const [name, id] of Object.entries(U)) { await q('insert into auth.users(id)values($1)', [id]); await seedAuthFixture(db, id); await as(name as keyof typeof U, "select complete_signup($1,$1,'2000-01-01')", [name]); }
  await q("insert into staff(user_id,role)values($1,'editor'),($2,'suport')", [U.editor, U.support]);
  await q("insert into venues(id,name,cat,lat,lon,data)values('arene','Arenele Romane','cultura',44.41,26.1,'{}')");
}, 60000);
afterAll(() => db?.close());

it('only an editor adds events, only with an official https seller link', async () => {
  await expect(as('client', 'select admin_event_save(null,$1::jsonb)', [ev()])).rejects.toThrow(/Nu ai voie|Sesiunea securizată/);
  await expect(as('support', 'select admin_event_save(null,$1::jsonb)', [ev()])).rejects.toThrow(/Nu ai voie|Sesiunea securizată/);
  for (const bad of ['http://www.iabilet.ro/x', 'https://iabilet.ro.evil.com/x', 'https://iabilet.ro@evil.com/x', 'https://evil.com/?r=iabilet.ro', 'javascript:alert(1)', 'https://fake-iabilet.ro/x'])
    await expect(as('editor', 'select admin_event_save(null,$1::jsonb)', [ev({ ticket_url: bad })]), bad).rejects.toThrow(/vânzător oficial/);
  await expect(as('editor', 'select admin_event_save(null,$1::jsonb)', [ev({ ticket_url: '' })])).rejects.toThrow(/linkul vânzătorului/);
  const e = (await as('editor', 'select * from admin_event_save(null,$1::jsonb)', [ev()])).rows[0];
  expect(e.seller).toBe('iaBilet');
  const v = (await as('editor', 'select * from admin_event_save(null,$1::jsonb)', [ev({ title: 'La arene', venue_id: 'arene', place_name: '', lat: '', lon: '', ticket_url: 'https://bilete.eventbook.ro/x' })])).rows[0];
  expect([v.place_name, v.seller]).toEqual(['Arenele Romane', 'Eventbook']);
  expect((await q('select count(*)::int n from private.event_log')).rows[0].n).toBe(2);
});

it('clients see published events, not drafts or old ones; nobody without an account sees anything', async () => {
  await as('editor', 'select admin_event_save(null,$1::jsonb)', [ev({ title: 'Ciornă', status: 'draft', ticket_url: '' })]);
  await q("insert into events(title,kind,starts_at,place_name,lat,lon,status) values('Vechi','concert',now()-interval '5 days','Undeva',44.4,26.1,'published')");
  const seen = (await as('client', 'select title from events order by title')).rows.map((r: any) => r.title);
  expect(seen).toContain('Concert de test');
  expect(seen).not.toContain('Ciornă');
  expect(seen).not.toContain('Vechi');
  await db.exec('set role anon');
  try { await expect(q('select * from events')).rejects.toThrow(/permission denied/); } finally { await db.exec('reset role'); }
  await expect(as('client', "update events set ticket_url='https://evil.com' where title='Concert de test'")).rejects.toThrow(/permission denied/);
  await expect(as('client', 'select * from private.event_clicks')).rejects.toThrow(/permission denied/);
});

it('"Cumpără bilete" gives the checked link and counts the person once a day', async () => {
  const id = (await q("select id from events where title='Concert de test'")).rows[0].id;
  const r = (await as('client', 'select event_ticket_url($1) r', [id])).rows[0].r;
  expect(r).toEqual({ url: 'https://www.iabilet.ro/bilete-concert-test-123/', seller: 'iaBilet' });
  await as('client', 'select event_ticket_url($1)', [id]);
  expect((await q('select count(*)::int n from private.event_clicks where event_id=$1', [id])).rows[0].n).toBe(1);
  const draft = (await q("select id from events where title='Ciornă'")).rows[0].id;
  await expect(as('client', 'select event_ticket_url($1)', [draft])).rejects.toThrow(/nu sunt disponibile/);
  // a link changed by hand in the table (not through Admin) to another site is refused at the door
  await q("update events set ticket_url='https://evil.com/x' where id=$1", [id]);
  await expect(as('client', 'select event_ticket_url($1)', [id])).rejects.toThrow(/nu sunt disponibile/);
});

it('the admin list shows drafts and the clicks', async () => {
  const list = (await as('editor', 'select admin_events() l')).rows[0].l;
  expect(list.map((x: any) => x.title)).toEqual(expect.arrayContaining(['Concert de test', 'Ciornă', 'La arene']));
  expect(list.find((x: any) => x.title === 'Concert de test').clicks).toBe(1);
  await expect(as('client', 'select admin_events()')).rejects.toThrow(/Nu ai voie|Sesiunea securizată/);
});
