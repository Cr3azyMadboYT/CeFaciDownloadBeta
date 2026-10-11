// Historical V1 contract, preserved for backup compatibility; business-v2.test.ts validates the complete current schema and intentional legacy retirement.
import { beforeAll, afterAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let db: PGlite;
const U = { alice:'00000000-0000-0000-0000-00000000000a', bob:'00000000-0000-0000-0000-00000000000b', scanner:'00000000-0000-0000-0000-00000000000c', teen:'00000000-0000-0000-0000-00000000000d', payer:'00000000-0000-0000-0000-00000000000e' };
const q = (sql: string, args: any[] = []) => db.query<any>(sql,args);
async function as(user: keyof typeof U, sql: string, args: any[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[user]}',false); set role authenticated;`);
  try { return await q(sql,args); } finally { await db.exec('reset role'); }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    create schema auth; create table auth.users(id uuid primary key,created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create publication supabase_realtime;`);
  for (const f of fs.readdirSync('supabase/migrations').filter(f=>f<'20261008000000').sort()) await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
  await db.exec('grant usage on schema public to anon,authenticated');
  for(const [name,id] of Object.entries(U)) {
    await q('insert into auth.users(id) values($1)',[id]);
    await as(name as keyof typeof U, 'select complete_signup($1,$2,$3::date)',[name,name,name==='teen'?'2009-01-01':'2000-01-01']);
  }
  await db.exec(`insert into venues(id,name,cat,lat,lon,data) values('test','Local','mancare',44.43,26.1,'{}');
    insert into partners(venue_id,firm,cui,rate,activated_at,free_until,plus_pct) values('test','Firma test','1234567',0.10,current_date-60,current_date-30,15);
    insert into venue_codes(venue_id,token) values('test','test-token-123');`);
  await q("insert into partner_members(venue_id,user_id,role) values('test',$1,'scanare'),('test',$2,'proprietar')",[U.scanner,U.bob]);
},60000);
afterAll(async () => { await db?.close(); });
it('does not auto-confirm a forged account age; normal profile editing still works',async () => {
  const before=(await q('select created_at from profiles where id=$1',[U.alice])).rows[0].created_at;
  await as('alice',"update profiles set created_at=now()-interval '30 days',first_name='Alina' where id=auth.uid()");
  const profile=(await q('select created_at,first_name from profiles where id=$1',[U.alice])).rows[0];
  expect(profile.created_at).toEqual(before); expect(profile.first_name).toBe('Alina');
  const r=(await as('alice',"select * from reservation_request('test',now()+interval '2 hours',2)")).rows[0];
  expect(r.status).toBe('cerută');
  await as('alice','select reservation_cancel($1)',[r.id]);
});
it('keeps the daily quota when requests are deleted; the ledger is private',async () => {
  for(let i=0;i<40;i++) {
    await as('alice','insert into friendships(requester,addressee) values($1,$2)',[U.alice,U.bob]);
    await as('alice','delete from friendships where requester=$1 and addressee=$2',[U.alice,U.bob]);
  }
  await expect(as('alice','insert into friendships(requester,addressee) values($1,$2)',[U.alice,U.bob])).rejects.toThrow(/destule cereri/);
  await expect(as('alice','select * from private.friend_request_events')).rejects.toThrow(/permission denied/);
});
it('limits Business payloads by role and revokes access immediately',async () => {
  await q("insert into visits(venue_id,user_id,kind,work_day,bill,bill_source,outcome) values('test',$1,'plan',private.work_day(now()),200,'local','a venit')",[U.teen]);
  const data=(await as('scanner',"select biz_today('test') data")).rows[0].data;
  expect(data.partner.cui).toBeUndefined(); expect(data.partner.rate).toBeUndefined();
  expect(data.visits[0].bill).toBeNull(); expect(data.requests).toEqual([]); expect(data.noshow).toEqual([]); expect(data.drops).toEqual([]);
  expect((await as('scanner','select * from biz_my_venues()')).rows[0].rate).toBeNull();
  await q("update partner_members set role='manager' where user_id=$1",[U.scanner]);
  const manager=(await as('scanner',"select biz_today('test') data")).rows[0].data;
  expect(manager.partner.cui).toBeUndefined(); expect(manager.visits[0].bill).toBe(200);
  await q('update partner_members set active=false where user_id=$1',[U.scanner]);
  await expect(as('scanner',"select biz_today('test')")).rejects.toThrow(/echipa/);
  await q("update partner_members set active=true,role='scanare' where user_id=$1",[U.scanner]);
});
it('hides adult offers, refuses own staff, waits ten minutes and weights the discount',async () => {
  const d=(await q("insert into drops(venue_id,title,pct_all,pct_plus,seats,starts_at,ends_at,adult) values('test','Oferta 18+',10,20,10,now()-interval '11 minutes',now()+interval '2 hours',true) returning id")).rows[0].id;
  expect((await as('teen','select * from drops')).rows).toEqual([]);
  await expect(as('teen','select drop_claim($1,1)',[d])).rejects.toThrow(/18 ani/);
  await expect(as('scanner','select drop_claim($1,1)',[d])).rejects.toThrow(/Echipa/);
  const c=(await as('alice','select * from drop_claim($1,1)',[d])).rows[0];
  await expect(as('alice',"select visit_scan('test-token-123',44.43,26.1,null,6)")).rejects.toThrow(/10 minute/);
  await q("update drop_claims set created_at=now()-interval '11 minutes' where id=$1",[c.id]);
  const v=(await as('alice',"select visit_scan('test-token-123',44.43,26.1,null,6) data")).rows[0].data;
  expect(v.kind).toBe('drop'); expect(v.discount).toBe(1); expect(v.people).toBe(6);
  const updated=(await as('alice',"select visit_scan('test-token-123',44.43,26.1,null,2) data")).rows[0].data;
  expect(updated.discount).toBe(5);
});
it('per-person pricing needs contracted tier and explicit attendance; bills do not drive fees',async () => {
  // Two already-created visits have no tier: assigning one now must never back-price them.
  await q("insert into staff(user_id,role) values($1,'fondator')",[U.bob]);
  await as('bob',"select admin_partner_tier_set('test',2)");
  await expect(as('scanner',"select admin_partner_tier_set('test',1)")).rejects.toThrow(/Nu ai voie/);
  await expect(as('bob',"select admin_partner_tier_set('test',1)")).rejects.toThrow(/contract/);
  const old=(await q('select id from visits where user_id=$1',[U.alice])).rows[0].id;
  await as('bob','select visit_close($1,true,999)',[old]);
  await as('bob','select biz_visit_attendance($1,2,1)',[old]);
  expect((await as('bob',"select biz_month('test') m")).rows[0].m.fee).toBe(0);
  const r=(await q("insert into reservations(venue_id,user_id,people,at,status) values('test',$1,6,now(),'confirmată') returning id",[U.payer])).rows[0].id;
  const id=(await q("insert into visits(venue_id,user_id,kind,reservation_id,people,work_day) values('test',$1,'rezervare',$2,6,private.work_day(now())) returning id",[U.payer,r])).rows[0].id;
  await as('bob','select visit_close($1,true)',[id]);
  expect((await as('bob',"select biz_month('test') m")).rows[0].m.fee).toBe(0);
  await expect(as('scanner','select biz_visit_attendance($1,4)',[id])).rejects.toThrow(/Nu ai voie/);
  await as('bob','select biz_visit_attendance($1,4)',[id]);
  expect((await as('bob',"select biz_month('test') m")).rows[0].m.fee).toBe(20);
  await q("update partners set founder=true,free_until=current_date+100 where venue_id='test'");
  expect((await as('bob',"select biz_month('test') m")).rows[0].m.fee).toBe(20); // frozen conditions
  await expect(as('alice','update private.visit_pricing set unit_fee=0')).rejects.toThrow(/permission denied/);
});
it('applies all tariff tiers, founders, seat limits, the ten-person cap and free visits',async () => {
  for(const tier of [1,2,3]) for(const founder of [false,true]) for(const kind of ['rezervare','drop','plus','plan']) {
    const venue=`fee-${tier}-${founder}-${kind}`;
    await q("insert into partners(venue_id,firm,cui,rate,activated_at,free_until,price_tier,founder) values($1,'Firma','1234567',0.10,current_date-60,current_date-30,$2,$3)",[venue,tier,founder]);
    let reservation=null,claim=null;
    if(kind==='rezervare') reservation=(await q("insert into reservations(venue_id,user_id,people,at,status) values($1,$2,14,now(),'confirmată') returning id",[venue,U.payer])).rows[0].id;
    if(kind==='drop') {
      const d=(await q("insert into drops(venue_id,title,pct_all,pct_plus,seats,starts_at,ends_at) values($1,'Oferta',10,20,10,now(),now()+interval '1 hour') returning id",[venue])).rows[0].id;
      claim=(await q("insert into drop_claims(drop_id,user_id,seats,expires_at,status) values($1,$2,4,now()+interval '1 hour','folosit') returning id",[d,U.payer])).rows[0].id;
    }
    const id=(await q("insert into visits(venue_id,user_id,kind,reservation_id,claim_id,people,work_day,outcome,closed_at) values($1,$2,$3,$4,$5,20,private.work_day(now()),'a venit',now()) returning id",[venue,U.payer,kind,reservation,claim])).rows[0].id;
    await q('insert into private.visit_attendance(visit_id,adults,discounted,confirmed_by) values($1,14,3,$2)',[id,U.bob]);
    const fees=(await q('select * from private.visit_fees($1,current_date-1,current_date)',[venue])).rows;
    if(kind==='plan'||kind==='plus') { expect(fees).toHaveLength(0); continue; }
    const rate=(kind==='rezervare'?[2,5,8]:[3,7,10])[tier-1]-(founder?1:0);
    expect(Number(fees[0].fee)).toBe(rate*(kind==='rezervare'?10:3)); expect(fees[0].free).toBe(false);
  }
  await q("insert into partners(venue_id,firm,cui,rate,activated_at,free_until,price_tier) values('free','Firma','1234567',0.10,current_date,current_date+90,2)");
  const r=(await q("insert into reservations(venue_id,user_id,people,at) values('free',$1,6,now()) returning id",[U.payer])).rows[0].id;
  const id=(await q("insert into visits(venue_id,user_id,kind,reservation_id,people,work_day,outcome,closed_at) values('free',$1,'rezervare',$2,6,private.work_day(now()),'a venit',now()) returning id",[U.payer,r])).rows[0].id;
  await q('insert into private.visit_attendance(visit_id,adults,discounted) values($1,4,4)',[id]);
  await q("insert into partner_members(venue_id,user_id,role) values('free',$1,'proprietar')",[U.bob]);
  const m=(await as('bob',"select biz_month('free') m")).rows[0].m;
  expect(m.fee).toBe(0); expect(m.would_pay).toBe(20); expect(m.billing_ready).toBe(false);
  await q("update visits set outcome='n-a venit' where id=$1",[id]);
  expect((await as('bob',"select biz_month('free') m")).rows[0].m.would_pay).toBe(0);
});
it('does not consume an undersized group claim and returns unused seats when a valid group arrives',async () => {
  await db.exec(`insert into venues(id,name,cat,lat,lon,data) values('group','Local','mancare',44.43,26.1,'{}');
    insert into partners(venue_id,firm,cui,rate,activated_at,free_until) values('group','Firma','1234567',0.10,current_date,current_date+30);
    insert into venue_codes(venue_id,token) values('group','group-token-123');`);
  const d=(await q("insert into drops(venue_id,title,pct_all,pct_plus,seats,min_group,starts_at,ends_at) values('group','Oferta grup',10,20,10,4,now()-interval '11 minutes',now()+interval '2 hours') returning id")).rows[0].id;
  const c=(await as('payer','select * from drop_claim($1,6)',[d])).rows[0].id;
  await q("update drop_claims set created_at=now()-interval '11 minutes' where id=$1",[c]);
  await expect(as('payer',"select visit_scan('group-token-123',44.43,26.1,null,3)")).rejects.toThrow(/Grupul/);
  expect((await q('select status,seats from drop_claims where id=$1',[c])).rows[0]).toEqual({status:'activ',seats:6});
  const v=(await as('payer',"select visit_scan('group-token-123',44.43,26.1,null,4) data")).rows[0].data;
  expect(v.discount).toBe(10);
  expect((await q('select status,seats from drop_claims where id=$1',[c])).rows[0]).toEqual({status:'folosit',seats:4});
  expect((await as('bob','select * from drop_claim($1,6)',[d])).rows[0].seats).toBe(6);
  await q("insert into partner_members(venue_id,user_id,role) values('group',$1,'proprietar')",[U.bob]);
  await as('bob','select visit_close($1,true)',[v.visit]);
  const again=(await as('payer',"select visit_scan('group-token-123',44.43,26.1,null,8) data")).rows[0].data;
  expect(again.people).toBe(4); expect(again.discount).toBe(10);
  await expect(as('alice',"select visit_scan('group-token-123',999,26.1)")).rejects.toThrow(/când ești la local/);
});
