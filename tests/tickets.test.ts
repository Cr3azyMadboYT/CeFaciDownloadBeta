// Bilete, faza 3 (22.10): a partner club sells tickets in CeFaci. Only test payments for now; 8% for CeFaci,
// 2 lei per ticket for the buyer, 0 with Plus; a rotating QR that goes in once; refunds when the event is cancelled.
import { prepareAuthSchema, authenticateFixture, seedAuthFixture } from './fixtures/auth.mjs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { ticketCode, ticketQr } from '../src/events/tickets';
let db: PGlite;
const U = { owner: '00000000-0000-0000-0000-000000000021', door: '00000000-0000-0000-0000-000000000022', ana: '00000000-0000-0000-0000-000000000023', dan: '00000000-0000-0000-0000-000000000024', kid: '00000000-0000-0000-0000-000000000025', admin: '00000000-0000-0000-0000-000000000026', other: '00000000-0000-0000-0000-000000000027' };
type Who = keyof typeof U;
const q = (sql: string, args: unknown[] = []) => db.query<any>(sql, args);
async function as(who: Who, sql: string, args: unknown[] = []) { await db.exec('reset role'); await authenticateFixture(db, U[who]); await db.exec('set role authenticated'); try { return await q(sql, args); } finally { await db.exec('reset role'); } }
const one = async (who: Who, sql: string, args: unknown[] = []) => (await as(who, sql, args)).rows[0]?.r;
const when = (days: number) => new Date(Date.now() + days * 86400e3).toISOString();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
let ev = '', vip = '', gen = '';

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;`);
  await prepareAuthSchema(db);
  for (const f of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
  await db.exec('grant usage on schema public to anon,authenticated');
  await q("insert into venues(id,name,cat,lat,lon,data)values('club','Club Test','club',44.43,26.1,'{\"street\":\"Str. Test 1\",\"city\":\"București\"}'),('alt','Alt Club','club',44.43,26.1,'{}')");
  await q("insert into partners(venue_id,firm,cui,rate,activated_at,free_until,price_tier)values('club','Club SRL','18547290',.1,current_date-10,current_date,2)");
  for (const [name, id] of Object.entries(U)) {
    await q('insert into auth.users(id)values($1)', [id]); await seedAuthFixture(db, id);
    await as(name as Who, "select complete_signup($1,$1,$2)", [name, name === 'kid' ? '2009-06-01' : '2000-01-01']);
  }
  await q("insert into partner_members(venue_id,user_id,role)values('club',$1,'proprietar'),('club',$2,'scanare')", [U.owner, U.door]);
  await q("insert into staff(user_id,role)values($1,'admin')", [U.admin]);
  await q("insert into friendships(requester,addressee) values($1,$2),($1,$3)", [U.ana, U.dan, U.kid]);
  await q("update friendships set status='accepted'");
}, 60000);
afterAll(() => db?.close());

it('a club sells only after CeFaci approves its payout account, and only on test while real payments are off', async () => {
  const save = (p: object, id: string | null = null) => one('owner', 'select biz_ticket_event_save($1,$2,$3::jsonb) r', ['club', id, JSON.stringify(p)]);
  const base = { title: 'Noaptea de test', kind: 'party', starts_at: when(2), min_age: 18, types: [{ name: 'General', price: 50, qty: 100 }, { name: 'VIP', price: 150, qty: 2, max_per_order: 2 }] };
  await expect(save({ ...base, status: 'published' })).rejects.toThrow(/contul de încasare/);
  await expect(one('door', 'select biz_ticket_payout_request($1,$2::jsonb) r', ['club', '{}'])).rejects.toThrow(/proprietarul/);
  await one('owner', 'select biz_ticket_payout_request($1,$2::jsonb) r', ['club', JSON.stringify({ legal_name: 'Club SRL', cui: 'RO18547290', iban: 'RO49 AAAA 1B31 0075 9384 0000' })]);
  expect((await q('select status,cui,iban_tail from private.ticket_payouts')).rows[0]).toEqual({ status: 'cerut', cui: '18547290', iban_tail: '0000' });
  await expect(one('admin', "select admin_ticket_payout_set('club','activ','abc','') r")).rejects.toThrow(/Plățile reale nu sunt pornite/);
  await expect(one('owner', "select admin_ticket_payout_set('club','test','','') r")).rejects.toThrow(/Nu ai voie|Sesiunea/);
  await one('admin', "select admin_ticket_payout_set('club','test','','cont de probă') r");
  ev = await save({ ...base, status: 'published' });
  const types = (await q('select id,name from ticket_types where event_id=$1 order by sort', [ev])).rows;
  gen = types[0].id; vip = types[1].id;
  const e = (await q('select price_from,price_to,place_name,address,sale_mode from events where id=$1', [ev])).rows[0];
  expect(e).toEqual({ price_from: '50.00', price_to: '150.00', place_name: 'Club Test', address: 'Str. Test 1, București', sale_mode: 'cefaci' });
  // a test event: the venue's team and CeFaci's team see it, a client does not
  expect((await as('ana', 'select id from events where id=$1', [ev])).rows).toHaveLength(0);
  expect((await as('door', 'select id from events where id=$1', [ev])).rows).toHaveLength(1);
  expect((await as('admin', 'select id from events where id=$1', [ev])).rows).toHaveLength(1);
  await expect(as('ana', 'select ticket_order_start($1,$2::jsonb)', [ev, JSON.stringify([{ type: gen, qty: 1 }])])).rejects.toThrow(/nu sunt disponibile/);
  // Admin cannot rewrite a venue's ticketed event with the link editor
  await expect(one('admin', 'select admin_event_save($1,$2::jsonb) r', [ev, JSON.stringify({ ...base, place_name: 'x', lat: 44.4, lon: 26.1, status: 'published' })])).rejects.toThrow(/îl schimbă localul|Nu ai voie/);
});

it('the buyer pays 2 lei per ticket (0 with Plus), CeFaci keeps 8% of the tickets; one order waits at a time', async () => {
  // testers: the people from the venue's team buy in test mode
  await q("insert into partner_members(venue_id,user_id,role)values('club',$1,'scanare'),('club',$2,'scanare'),('club',$3,'scanare')", [U.ana, U.dan, U.kid]);
  const o = await one('ana', 'select ticket_order_start($1,$2::jsonb) r', [ev, JSON.stringify([{ type: gen, qty: 2 }, { type: vip, qty: 1 }])]);
  expect([o.tickets, o.subtotal, o.fee, o.total, o.plus, o.test]).toEqual([3, 250, 6, 256, false, true]);
  expect((await q('select commission from ticket_orders where id=$1', [o.order])).rows[0].commission).toBe('20.00');
  expect((await q('select sold from ticket_types where id=$1', [vip])).rows[0].sold).toBe(1);
  // a new „Cumpără” lets the old order go (the held tickets come back)
  await db.exec("set cefaci.plus='on'"); await q("update profile_private set plus_until=now()+interval '30 days' where id=$1", [U.ana]); await db.exec("reset cefaci.plus");
  const p = await one('ana', 'select ticket_order_start($1,$2::jsonb) r', [ev, JSON.stringify([{ type: vip, qty: 2 }])]);
  expect([p.subtotal, p.fee, p.total, p.plus]).toEqual([300, 0, 300, true]);
  expect((await q('select status from ticket_orders where id=$1', [o.order])).rows[0].status).toBe('anulat');
  expect((await q('select sold from ticket_types where id=$1', [vip])).rows[0].sold).toBe(2);
  await expect(as('dan', 'select ticket_order_start($1,$2::jsonb)', [ev, JSON.stringify([{ type: vip, qty: 1 }])])).rejects.toThrow(/Mai sunt doar 0/);
  await expect(as('dan', 'select ticket_order_start($1,$2::jsonb)', [ev, JSON.stringify([{ type: gen, qty: 7 }])])).rejects.toThrow(/Cel mult 6/);
  await expect(as('kid', 'select ticket_order_start($1,$2::jsonb)', [ev, JSON.stringify([{ type: gen, qty: 1 }])])).rejects.toThrow(/de la 18 ani/);
  // someone else cannot pay or cancel Ana's order; Ana pays (test, no money)
  await expect(as('dan', 'select ticket_order_test_pay($1)', [p.order])).rejects.toThrow(/nu există/);
  await as('dan', 'select ticket_order_cancel($1)', [p.order]);
  expect((await q('select status from ticket_orders where id=$1', [p.order])).rows[0].status).toBe('asteapta');
  await as('ana', 'select ticket_order_test_pay($1)', [p.order]);
  await expect(as('ana', 'select ticket_order_test_pay($1)', [p.order])).rejects.toThrow(/nu mai așteaptă/);
  expect((await q('select count(*)::int n from tickets where order_id=$1', [p.order])).rows[0].n).toBe(2);
  // an order not paid in 15 minutes gives its tickets back
  const d = await one('dan', 'select ticket_order_start($1,$2::jsonb) r', [ev, JSON.stringify([{ type: gen, qty: 4 }])]);
  await q("update ticket_orders set expires_at=now()-interval '1 minute' where id=$1", [d.order]);
  await expect(as('dan', 'select ticket_order_test_pay($1)', [d.order])).rejects.toThrow(/15 minute/);
  await as('owner', "select biz_ticket_events('club')"); // any later call lets expired orders go
  expect((await q('select sold from ticket_types where id=$1', [gen])).rows[0].sold).toBe(0);
  // nobody writes the tables directly; the real-payment confirmation is only for the service key
  await expect(as('ana', "update tickets set status='valid'")).rejects.toThrow(/permission denied/);
  await expect(as('ana', 'select * from ticket_orders')).rejects.toThrow(/permission denied/);
  await expect(as('ana', "select ticket_order_paid($1,'x',300)", [p.order])).rejects.toThrow(/permission denied/);
});

it('the QR changes every 30 seconds, goes in once, and a ticket given to a friend gets a new QR', async () => {
  const mine = await one('ana', 'select my_tickets() r');
  expect(mine).toHaveLength(2);
  expect(mine[0].secret).toMatch(/^[0-9a-f]{32}$/);
  expect((await one('dan', 'select my_tickets() r'))).toHaveLength(0);
  const w = Math.floor(Date.now() / 30000);
  // the phone and the server make the same code
  expect(ticketCode(mine[0].secret, w, sha)).toBe((await q('select private.ticket_code($1,$2) c', [mine[0].secret, w])).rows[0].c);
  await expect(one('door', 'select biz_ticket_scan($1,$2) r', ['club', ticketQr(mine[0].id, mine[0].secret, w - 20, sha)])).rejects.toThrow(/nu mai e valabil/);
  await expect(one('door', 'select biz_ticket_scan($1,$2) r', ['club', 'CFB1.' + mine[0].id + '.' + w + '.0000000000'])).rejects.toThrow(/nu mai e valabil/);
  await expect(one('door', 'select biz_ticket_scan($1,$2) r', ['club', 'https://evil.com'])).rejects.toThrow(/Nu e un bilet CeFaci/);
  await q("insert into partners(venue_id,firm,cui,rate,activated_at,free_until,price_tier)values('alt','Alt SRL','18547290',.1,current_date,current_date,2)");
  await q("insert into partner_members(venue_id,user_id,role)values('alt',$1,'proprietar')", [U.other]);
  await expect(one('other', 'select biz_ticket_scan($1,$2) r', ['alt', ticketQr(mine[0].id, mine[0].secret, w, sha)])).rejects.toThrow(/nu e pentru un eveniment de aici/);
  // the event starts in 2 days: not yet
  await expect(one('door', 'select biz_ticket_scan($1,$2) r', ['club', ticketQr(mine[0].id, mine[0].secret, w, sha)])).rejects.toThrow(/nu pentru acum/);
  await q("update events set starts_at=now()-interval '1 hour' where id=$1", [ev]);
  const r = await one('door', 'select biz_ticket_scan($1,$2) r', ['club', ticketQr(mine[0].id, mine[0].secret, w, sha)]);
  expect([r.ok, r.type, r.name, r.inside, r.test]).toEqual([true, 'VIP', 'ana', 1, true]);
  const again = await one('door', 'select biz_ticket_scan($1,$2) r', ['club', ticketQr(mine[0].id, mine[0].secret, w, sha)]);
  expect([again.ok, again.already]).toEqual([false, true]);
  // the second ticket goes to Dan (a friend), not to a stranger and not to a minor (18+)
  await expect(as('ana', 'select ticket_transfer($1,$2)', [mine[1].id, U.other])).rejects.toThrow(/doar unui prieten/);
  await expect(as('ana', 'select ticket_transfer($1,$2)', [mine[1].id, U.kid])).rejects.toThrow(/vârsta/);
  await expect(as('ana', 'select ticket_transfer($1,$2)', [mine[0].id, U.dan])).rejects.toThrow(/nu mai e valabil/);
  await as('ana', 'select ticket_transfer($1,$2)', [mine[1].id, U.dan]);
  const dans = await one('dan', 'select my_tickets() r');
  expect(dans).toHaveLength(1);
  expect(dans[0].secret).not.toBe(mine[1].secret);
  await expect(one('door', 'select biz_ticket_scan($1,$2) r', ['club', ticketQr(mine[1].id, mine[1].secret, w, sha)])).rejects.toThrow(/nu mai e valabil/);
  expect((await one('door', 'select biz_ticket_scan($1,$2) r', ['club', ticketQr(dans[0].id, dans[0].secret, w, sha)])).name).toBe('dan');
});

it('the club sees what it sold and what CeFaci keeps; a cancelled event gives the money back', async () => {
  const page = await one('owner', 'select biz_ticket_events($1) r', ['club']);
  expect([page.live, Number(page.commission), Number(page.fee), page.payout.status]).toEqual([false, 0.08, 2, 'test']);
  const e = page.events[0];
  expect([e.sold, e.scanned, Number(e.gross), Number(e.commission_lei)]).toEqual([2, 2, 300, 24]);
  await expect(one('door', 'select biz_ticket_events($1) r', ['club'])).rejects.toThrow(/Nu ai voie/);
  // the price of a kind with sales does not change; the count cannot go under what was sold
  const types = e.types.map((t: any) => ({ id: t.id, name: t.name, price: Number(t.price), qty: t.qty, max_per_order: t.max_per_order }));
  const p = { title: e.title, kind: e.kind, starts_at: e.starts_at, min_age: 18, status: 'published' };
  await expect(one('owner', 'select biz_ticket_event_save($1,$2,$3::jsonb) r', ['club', ev, JSON.stringify({ ...p, types: types.map((t: any) => t.name === 'VIP' ? { ...t, price: 200 } : t) })])).rejects.toThrow(/nu se mai schimbă/);
  await expect(one('owner', 'select biz_ticket_event_save($1,$2,$3::jsonb) r', ['club', ev, JSON.stringify({ ...p, types: types.map((t: any) => t.name === 'VIP' ? { ...t, qty: 1 } : t) })])).rejects.toThrow(/s-au vândut deja 2/);
  await one('owner', 'select biz_ticket_event_save($1,$2,$3::jsonb) r', ['club', ev, JSON.stringify({ ...p, status: 'cancelled', types })]);
  expect((await q("select status from ticket_orders where status in('platit','rambursat','de_rambursat')")).rows.map((r: any) => r.status)).toEqual(['rambursat']);
  expect((await q("select count(*)::int n from tickets where status='rambursat'")).rows[0].n).toBe(0); // both were used at the door already
  await expect(one('owner', 'select biz_ticket_event_save($1,$2,$3::jsonb) r', ['club', ev, JSON.stringify({ ...p, types })])).rejects.toThrow(/anulat/);
});

it('the QR format on the phone', () => {
  expect(ticketQr('a', 'b', 5, sha)).toBe('CFB1.a.5.' + sha('b.5').slice(0, 10));
});
