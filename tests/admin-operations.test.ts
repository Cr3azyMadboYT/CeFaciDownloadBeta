import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
let db:PGlite;
const U={client:'00000000-0000-0000-0000-000000000001',other:'00000000-0000-0000-0000-000000000002',biz:'00000000-0000-0000-0000-000000000003',admin:'00000000-0000-0000-0000-000000000004',support:'00000000-0000-0000-0000-000000000005',accountant:'00000000-0000-0000-0000-000000000006',editor:'00000000-0000-0000-0000-000000000007',founder:'00000000-0000-0000-0000-000000000008',moderator:'00000000-0000-0000-0000-000000000009'};
const q=(sql:string,args:unknown[]=[])=>db.query<any>(sql,args);
async function as(who:keyof typeof U,sql:string,args:unknown[]=[]){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${U[who]}',false);set role authenticated`);try{return await q(sql,args)}finally{await db.exec('reset role')}}
async function rpc(who:keyof typeof U,sql:string,args:unknown[]=[]){return(await as(who,`select ${sql} result`,args)).rows[0].result}
const V={mixed:'10000000-0000-0000-0000-000000000001',simple:'10000000-0000-0000-0000-000000000002',blocked:'10000000-0000-0000-0000-000000000003'};
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;`);
 for(const f of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec('grant usage on schema public to anon,authenticated');
 for(const[name,id]of Object.entries(U)){await q('insert into auth.users(id)values($1)',[id]);await as(name as keyof typeof U,"select complete_signup($1,$1,'2000-01-01')",[name]);}
 await q("insert into staff(user_id,role)values($1,'admin'),($2,'suport'),($3,'contabil'),($4,'editor'),($5,'fondator'),($6,'moderator')",[U.admin,U.support,U.accountant,U.editor,U.founder,U.moderator]);
 await db.exec(`insert into venues(id,name,cat,lat,lon,data)values('v','Partener','mancare',44,26,'{}'),('w','Gratuit','mancare',44,26,'{}'),('suggest','Sugestie','mancare',44,26,'{}'),('small','Mic','mancare',44,26,'{}');insert into partners(venue_id,firm,cui,rate,activated_at,free_until,price_tier)values('v','Test SRL','18547290',.1,current_date-90,current_date-30,2),('w','Free SRL','18547290',.1,current_date,current_date+30,2);`);
 await q("insert into partner_members(venue_id,user_id,role)values('v',$1,'proprietar')",[U.biz]);
 await q("insert into visits(id,venue_id,user_id,kind,people,group_visit,work_day,outcome,bill,bill_source,discount_amount,closed_at,proof)values($1,'v',$4,'rezervare',6,true,current_date,'a venit',200,'local',30,now(),'staff_ticket'),($2,'v',$4,'plus',6,true,current_date,'a venit',100,'local',15,now(),'staff_ticket'),($3,'v',$4,'drop',6,true,current_date,'deschis',null,null,null,null,'staff_ticket')",[V.mixed,V.simple,V.blocked,U.client]);
 await q("update private.visit_pricing set reservation_unit=5,drop_unit=7,reservation_limit=2,drop_limit=4 where visit_id in($1,$2)",[V.mixed,V.blocked]);
 await q("insert into private.visit_counts(visit_id,people,adults,drop_adults,state)values($1,6,6,4,'confirmed'),($2,6,6,0,'confirmed'),($3,6,6,4,'disputed')",[V.mixed,V.simple,V.blocked]);
 await q("insert into private.benefit_cases(visit_id,reason,reporter)values($1,'Reducere refuzată',$2)",[V.blocked,U.client]);
 await q("insert into reservations(venue_id,user_id,people,at,status)values('v',$1,6,now(),'cerută')",[U.client]);
},60000);
afterAll(()=>db?.close());
it('denies public endpoints to anon, clients, business owners and revoked staff',async()=>{
 const queries=["admin_operations_summary()","admin_operations(current_date,current_date)","admin_finance(current_date,current_date)","admin_user_lookup('client')","admin_plus_grant(gen_random_uuid(),1,'Motiv test','anon')","admin_partner_suggestions()"];
 await db.exec('set role anon');try{for(const s of queries)await expect(q(`select ${s}`)).rejects.toThrow(/permission denied/)}finally{await db.exec('reset role')}
 for(const who of['client','biz']as const)for(const s of queries)await expect(rpc(who,s)).rejects.toThrow(/Nu ai acces/);
 await q('delete from staff where user_id=$1',[U.support]);await expect(rpc('support','admin_operations_summary()')).rejects.toThrow(/Nu ai acces/);await q("insert into staff(user_id,role)values($1,'suport')",[U.support]);
 await db.exec(`select set_config('request.jwt.claims','{"is_anonymous":true,"user_metadata":{"role":"fondator"}}',false)`);try{await expect(rpc('accountant','admin_finance(current_date,current_date)')).rejects.toThrow(/Nu ai acces/)}finally{await db.exec("select set_config('request.jwt.claims','{}',false)")}
});
it('exposes private audit only through scoped server APIs and preserves RLS',async()=>{
 await expect(as('admin','select * from private.admin_plus_grants')).rejects.toThrow(/permission denied/);
 expect((await q("select relrowsecurity from pg_class where oid='private.admin_plus_grants'::regclass")).rows[0].relrowsecurity).toBe(true);
 const admin=await rpc('admin','admin_me()');expect(admin.permissions).toContain('operations.read');expect(admin.permissions).not.toContain('money.read');
 const support=await rpc('support','admin_me()');expect(support.permissions).toContain('operations.read');expect(support.permissions).not.toContain('money.read');expect(support.permissions).not.toContain('operations.decide');
});
it('reads both Client and Business canonical queues with safe paging and no money for support',async()=>{
 const support=await rpc('support','admin_operations(current_date,current_date)');expect(support.total_visits).toBe(1);expect(support.total_reservations).toBe(1);expect(support.visits[0].id).toBe(V.blocked);expect(support.visits[0].count.state).toBe('disputed');expect(support.visits[0].benefit.state).toBe('pending');expect(support.visits[0].bill).toBeNull();expect(support.visits[0].user_id).toBeUndefined();
 const all=await rpc('admin',"admin_operations(current_date,current_date,null,'all',1,0)");expect(all.total_visits).toBe(3);expect(all.visits).toHaveLength(1);
 await expect(rpc('accountant','admin_operations_summary()')).rejects.toThrow(/Nu ai acces/);await expect(rpc('moderator','admin_operations_summary()')).rejects.toThrow(/Nu ai acces/);
 for(const s of["admin_operations(current_date,current_date,null,null)","admin_operations(current_date,current_date,null,'all',null)","admin_operations(current_date,current_date,null,'all',101)","admin_operations(current_date,current_date-1)","admin_operations(current_date,current_date,'unknown')"])await expect(rpc('admin',s)).rejects.toThrow(/invalid|nu există/);
 const summary=await rpc('support','admin_operations_summary()');expect(summary.counts_disputed).toBe(1);expect(summary.benefits_pending).toBe(1);expect(summary.day_boundary).toBe('05:00');
});
it('calculates global partial financial totals using frozen per-person fees and includes zero-fee Plus revenues',async()=>{
 const finance=await rpc('accountant','admin_finance(current_date,current_date)');expect(finance.billing_ready).toBe(false);expect(finance.estimate).toBe(true);expect(finance.partial).toBe(true);expect(finance.remaining).toBeNull();expect(finance.revenue).toBe(300);expect(finance.discounts).toBe(45);expect(finance.fee).toBe(38);expect(finance.missing).toBe(1);expect(finance.blocked).toBe(1);expect(finance.venues).toHaveLength(2);
 await q("update partners set price_tier=3 where venue_id='v'");expect((await rpc('accountant','admin_finance(current_date,current_date)')).fee).toBe(38);
 await expect(rpc('admin','admin_finance(current_date,current_date)')).rejects.toThrow(/Nu ai acces/);await expect(rpc('admin',"biz_finance_v2('v',current_date,current_date)")).rejects.toThrow(/Nu ai voie/);expect((await rpc('admin','admin_partners()')).every((p:any)=>p.month===null)).toBe(true);expect((await rpc('biz',"biz_finance_v2('v',current_date,current_date)")).fee).toBe(38);await expect(rpc('support','admin_finance(current_date,current_date)')).rejects.toThrow(/Nu ai acces/);await expect(rpc('editor','admin_finance(current_date,current_date)')).rejects.toThrow(/Nu ai acces/);
 await expect(rpc('accountant','admin_finance(current_date,current_date+367)')).rejects.toThrow(/Perioadă/);await expect(rpc('accountant',"admin_finance(current_date,current_date,'unknown')")).rejects.toThrow(/nu există/);
});
it('reuses versioned count and benefit decisions, so stale and support decisions fail and unresolved cases stay blocked',async()=>{
 await expect(rpc('support','admin_count_resolve_v2($1,1,6,6,4,$2)',[V.blocked,'Număr verificat'])).rejects.toThrow(/echipa/);
 await expect(rpc('admin','admin_count_resolve_v2($1,null,6,6,4,$2)',[V.blocked,'Număr verificat'])).rejects.toThrow(/versiune/);
 await rpc('admin','admin_count_resolve_v2($1,1,6,6,4,$2)',[V.blocked,'Număr verificat']);await expect(rpc('admin','admin_count_resolve_v2($1,1,6,6,4,$2)',[V.blocked,'Număr verificat'])).rejects.toThrow(/versiune/);
 await expect(rpc('support','admin_benefit_decide_v2($1,1,true,$2)',[V.blocked,'Refuz verificat'])).rejects.toThrow(/echipa/);
 await rpc('admin','admin_benefit_decide_v2($1,1,true,$2)',[V.blocked,'Refuz verificat']);
 expect((await q('select state,version,compensated from private.benefit_cases where visit_id=$1',[V.blocked])).rows[0]).toMatchObject({state:'upheld',version:2,compensated:true});expect((await q('select count(*) n from private.review_log where visit_id=$1',[V.blocked])).rows[0].n).toBe(2);
 // A resolved complaint still needs an actual closed visit and canonical amount before charging.
 expect((await rpc('accountant','admin_finance(current_date,current_date)')).blocked).toBe(1);
});
it('returns complete net without subtracting discounts twice and keeps contractual free commissions informational',async()=>{
 await q("update visits set outcome='a venit',bill=100,bill_source='local',discount_amount=10,closed_at=now()where id=$1",[V.blocked]);
 const free=(await q("insert into visits(venue_id,user_id,kind,people,group_visit,work_day,outcome,bill,bill_source,discount_amount,closed_at,proof)values('w',$1,'rezervare',6,true,current_date,'a venit',80,'local',12,now(),'staff_ticket')returning id",[U.client])).rows[0].id;
 await q("update private.visit_pricing set reservation_unit=5,reservation_limit=6 where visit_id=$1",[free]);
 await q("insert into private.visit_counts(visit_id,people,adults,drop_adults,state)values($1,6,6,0,'confirmed')",[free]);
 const finance=await rpc('accountant','admin_finance(current_date,current_date)');expect(finance.partial).toBe(false);expect(finance.revenue).toBe(480);expect(finance.discounts).toBe(67);expect(finance.fee).toBe(76);expect(finance.remaining).toBe(404);expect(finance.would_pay).toBe(30);expect(finance.billing_ready).toBe(false);
 expect(finance.venues.find((x:any)=>x.venue_id==='w').finance.fee).toBe(0);
});
it('returns exact minimal profiles without birth date, email, preferences or friend codes',async()=>{
 await q('update profiles set username=$1 where id=$2',['valid-name-123456789',U.other]);expect((await rpc('support',"admin_user_lookup('@valid-name-123456789')")).id).toBe(U.other);await expect(rpc('support',"admin_user_lookup('username-too-long-12345')")).rejects.toThrow(/exact/);
 const p=await rpc('moderator',"admin_user_lookup('@client')");expect(p.id).toBe(U.client);expect(p.username).toBe('client');for(const key of['birth_date','email','prefs','friend_code','app_state','avatar_path'])expect(p[key]).toBeUndefined();
 expect(await rpc('support',"admin_user_lookup('doesnotexist')")).toBeNull();await expect(rpc('admin',"admin_user_lookup('cl%')")).rejects.toThrow(/exact/);await expect(rpc('accountant',"admin_user_lookup('client')")).rejects.toThrow(/Nu ai acces/);
});
it('adds one real server Plus day, retries idempotently, prevents payload reuse, staff gifts and duplicate compensations',async()=>{
 const grant=await rpc('support','admin_plus_grant($1,1,$2,$3)',[U.other,'Problemă confirmată la suport','goodwill-1']);expect(grant.days).toBe(1);
 const before=(await q('select plus_until from profile_private where id=$1',[U.other])).rows[0].plus_until;expect(before).not.toBeNull();expect((await rpc('support','admin_plus_grant($1,1,$2,$3)',[U.other,'Problemă confirmată la suport','goodwill-1'])).id).toBe(grant.id);
 expect((await q('select plus_until from profile_private where id=$1',[U.other])).rows[0].plus_until).toEqual(before);
 await expect(rpc('support','admin_plus_grant($1,1,$2,$3)',[U.client,'Problemă confirmată la suport','goodwill-1'])).rejects.toThrow(/altă cerere/);
 await expect(rpc('admin','admin_plus_grant($1,7,$2,$3)',[U.other,'Problemă verificată','seven'])).rejects.toThrow(/singură zi/);
 await expect(rpc('support','admin_plus_grant($1,1,$2,$3)',[U.other,'Al doilea suport','goodwill-2'])).rejects.toThrow(/60 de zile/);
 await expect(rpc('support','admin_plus_grant($1,1,$2,$3)',[U.client,'Are plângere deja','complaint-repeat'])).rejects.toThrow(/60 de zile/);
 await expect(rpc('support','admin_plus_grant($1,1,$2,$3)',[U.admin,'Cadou pentru echipă','staff-gift'])).rejects.toThrow(/echipe/);
 await expect(rpc('moderator','admin_plus_grant($1,1,$2,$3)',[U.other,'Alt rol interzis','moderator'])).rejects.toThrow(/Nu ai acces/);
 await as('other',"update profile_private set plus_until=now()+interval '100 years' where id=$1",[U.other]);expect((await q('select plus_until from profile_private where id=$1',[U.other])).rows[0].plus_until).toEqual(before);
});
it('shares the 60-day compensation cap between manual support and verified complaint decisions in both orders',async()=>{
 const before=(await q('select plus_until from profile_private where id=$1',[U.other])).rows[0].plus_until;
 await q("insert into private.benefit_cases(visit_id,reason,reporter)values($1,'Plângere după ziua de suport',$2)",[V.simple,U.other]);
 await rpc('admin','admin_benefit_decide_v2($1,1,true,$2)',[V.simple,'Refuz verificat după suport']);
 expect((await q('select plus_until from profile_private where id=$1',[U.other])).rows[0].plus_until).toEqual(before);
 expect((await q('select state,compensated from private.benefit_cases where visit_id=$1',[V.simple])).rows[0]).toEqual({state:'upheld',compensated:false});
 await expect(rpc('support','admin_plus_grant($1,1,$2,$3)',[U.client,'Suport după compensarea verificată','after-verified'])).rejects.toThrow(/60 de zile/);
});
it('limits support grants to ten per staff member in a rolling day and preserves immutable audit across account deletion',async()=>{
 for(let i=0;i<10;i++){const id=`20000000-0000-0000-0000-${String(i).padStart(12,'0')}`;await q('insert into auth.users(id)values($1)',[id]);await q('insert into profiles(id,username,first_name)values($1,$2,$3)',[id,`quota${i}`,'Quota']);await q("insert into profile_private(id,birth_date)values($1,'2000-01-01')",[id]);if(i<9)await rpc('support','admin_plus_grant($1,1,$2,$3)',[id,'Suport verificat pentru limită',`quota-${i}`]);else await expect(rpc('support','admin_plus_grant($1,1,$2,$3)',[id,'Suport verificat pentru limită',`quota-${i}`])).rejects.toThrow(/10 acordări/);}
 await expect(q("update private.admin_plus_grants set reason='Rescris'")).rejects.toThrow(/nu poate fi modificat/);await expect(q('delete from private.admin_plus_grants')).rejects.toThrow(/nu poate fi modificat/);
 await q('delete from auth.users where id=$1',[U.support]);expect((await q('select by_user from private.admin_plus_grants')).rows.every((r:any)=>r.by_user===null)).toBe(true);
 await q('delete from auth.users where id=$1',[U.other]);expect((await q("select user_id from private.admin_plus_grants where request_key='goodwill-1'")).rows[0].user_id).toBeNull();
});
it('suggests nonpartners using actual server check-ins, excludes small cohorts, and never returns individual identities',async()=>{
 for(const[key,id]of Object.entries(U).filter(([key])=>!['support','other'].includes(key))){await q("insert into xp_log(user_id,venue_id,kind,amount,day)values($1,'suggest','checkin',100,current_date),($1,'small','checkin',100,current_date)",[id]);if(key==='moderator')break;}
 // Reduce the second venue below the privacy threshold.
 await q("delete from xp_log where venue_id='small' and user_id<>$1",[U.client]);
 const suggestions=await rpc('editor','admin_partner_suggestions()');expect(suggestions).toHaveLength(1);expect(suggestions[0].venue_id).toBe('suggest');expect(suggestions[0].people).toBeGreaterThanOrEqual(5);expect(suggestions[0].receipts).toBe(0);expect(suggestions[0].user_id).toBeUndefined();expect(suggestions[0].username).toBeUndefined();await expect(rpc('accountant','admin_partner_suggestions()')).rejects.toThrow(/Nu ai acces/);
});
it('filters reservation queues at the real local 05:00 boundary after autumn DST',async()=>{
 await q("insert into reservations(venue_id,user_id,people,at,status,note)values('v',$1,6,'2026-10-25 02:59:59+00','cerută','Before 05'),('v',$1,6,'2026-10-25 03:00:00+00','cerută','At 05')",[U.client]);
 const before=await rpc('admin',"admin_operations('2026-10-24','2026-10-24',null,'all')");expect(before.reservations).toHaveLength(1);expect(before.reservations[0].reason).toBe('Before 05');
 const after=await rpc('admin',"admin_operations('2026-10-25','2026-10-25',null,'all')");expect(after.reservations).toHaveLength(1);expect(after.reservations[0].reason).toBe('At 05');
});
it('retains Europe/Bucharest financial 05:00 boundary across spring and autumn DST transitions',async()=>{
 expect((await q("select private.work_day('2026-03-29 01:30+00')::text a,private.work_day('2026-03-29 02:00+00')::text b,private.work_day('2026-10-25 02:00+00')::text c,private.work_day('2026-10-25 03:00+00')::text d")).rows[0]).toEqual({a:'2026-03-28',b:'2026-03-29',c:'2026-10-24',d:'2026-10-25'});
});
