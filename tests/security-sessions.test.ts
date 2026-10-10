import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
let db:PGlite;
const A='80000000-0000-0000-0000-000000000001',B='80000000-0000-0000-0000-000000000002',C='80000000-0000-0000-0000-000000000003';
const S='81000000-0000-0000-0000-000000000001',T='81000000-0000-0000-0000-000000000002',V='81000000-0000-0000-0000-000000000003';
const F='82000000-0000-0000-0000-000000000001',G='82000000-0000-0000-0000-000000000002';
const q=(sql:string,args:unknown[]=[])=>db.query<any>(sql,args);
async function jwt(uid=A,sid=S,aal='aal2',proof=Math.floor(Date.now()/1000)-3,extra:any={}){await q("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uid,JSON.stringify({sub:uid,session_id:sid,aal,is_anonymous:false,amr:[{method:'totp',timestamp:proof}],...extra})]);}
async function api(name:string,args:unknown[]=[]){await db.exec('set role authenticated');try{return(await q(`select ${name} result`,args)).rows[0]?.result;}finally{await db.exec('reset role')}}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
 create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now(),deleted_at timestamptz,banned_until timestamptz,is_anonymous boolean default false);
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),updated_at timestamptz default now(),factor_id uuid,aal text,not_after timestamptz);
 create table auth.mfa_factors(id uuid primary key,user_id uuid,status text,factor_type text);
 create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid()to authenticated;create publication supabase_realtime;`);
 for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 await db.exec('grant usage on schema public to anon,authenticated');
 for(const [id,name]of[[A,'secureadmin'],[B,'secureowner'],[C,'secureclient']]){await q('insert into auth.users(id)values($1)',[id]);await jwt(id,id===A?S:id===B?T:V,'aal1');await api("complete_signup($1,$1,'2000-01-01')",[name]);}
 await q("insert into staff(user_id,role)values($1,'admin')",[A]);
 await db.exec("insert into venues(id,name,cat,lat,lon,data)values('secure-v','Local securizat','mancare',44,26,'{}');insert into partners(venue_id,firm,cui,rate,activated_at,free_until)values('secure-v','Firm SRL','18547290',.1,current_date,current_date)");
 await q("insert into partner_members(venue_id,user_id,role)values('secure-v',$1,'proprietar')",[B]);
 await q("insert into auth.mfa_factors values($1,$2,'verified','totp'),($3,$4,'verified','totp')",[F,A,G,B]);
 await q("insert into auth.sessions(id,user_id,factor_id,aal)values($1,$2,$3,'aal2'),($4,$5,$6,'aal2'),($7,$8,null,'aal1')",[S,A,F,T,B,G,V,C]);
},60000);
beforeEach(async()=>{await db.exec('delete from private.security_sessions');await q("update auth.users set banned_until=null,deleted_at=null,is_anonymous=false");await q("update auth.mfa_factors set status='verified'");await q("update auth.sessions set aal='aal2',not_after=null where id in($1,$2)",[S,T]);await jwt();});
afterAll(()=>db?.close());
it('bootstrap is minimal at aal1 and neither metadata nor aal claim alone creates a capability',async()=>{
 await jwt(A,S,'aal1',0,{user_metadata:{role:'fondator'}});expect(await api('secure_access_status()')).toEqual({admin_role:'admin',business_access:false});expect((await api('admin_me()')).permissions).toEqual([]);
 expect((await api("secure_session_open('admin')")).active).toBe(false);await expect(api('admin_dashboard()')).rejects.toThrow(/securizată/);
 await jwt(C,V,'aal2');expect((await api("secure_session_open('admin')")).active).toBe(false);await expect(api('admin_me()')).rejects.toThrow(/rezervat/);
});
it('verified TOTP plus signed session and AMR opens only the authorized scope and retains absolute expiry',async()=>{
 const s=await api("secure_session_open('admin')");expect(s.active).toBe(true);expect(s.reauthentication_required).toBe(false);expect(s.idle_seconds).toBe(900);expect(s.absolute_seconds).toBe(28800);expect((await api('admin_me()')).permissions).toContain('partners');
 expect((await api("secure_session_open('business')")).active).toBe(false);expect((await api("secure_session_touch('admin')")).absolute_expires_at).toEqual(s.absolute_expires_at);
 await jwt(B,T);const b=await api("secure_session_open('business')");expect(b.active).toBe(true);expect(b.idle_seconds).toBe(1800);expect(b.absolute_seconds).toBe(43200);
 expect((await api('to_jsonb(biz_my_venues())')).venue_id).toBe('secure-v');
});
it('expired idle and absolute sessions cannot be touched or reopened using the old MFA proof',async()=>{
 await api("secure_session_open('admin')");await q("update private.security_sessions set touched_at=now()-interval '16 minutes'");expect((await api("secure_session_touch('admin')")).reason).toBe('expired');expect((await api("secure_session_open('admin')")).active).toBe(false);
 await jwt(A,S,'aal2',Math.floor(Date.now()/1000));expect((await api("secure_session_open('admin')")).active).toBe(true);
 await q("update private.security_sessions set absolute_expires_at=now()-interval '1 second'");expect((await api("secure_session_touch('admin')")).active).toBe(false);
 await expect(api('admin_support_reports()')).rejects.toThrow(/securizată/);
});
it('close works at aal1 and irreversibly invalidates old proofs while a new challenge permits reopening',async()=>{
 await api("secure_session_open('admin')");await jwt(A,S,'aal1');expect((await api("secure_session_close('admin')")).reason).toBe('closed');await jwt();expect((await api("secure_session_open('admin')")).active).toBe(false);
 await jwt(A,S,'aal2',Math.floor(Date.now()/1000)+1);expect((await api("secure_session_open('admin')")).active).toBe(true);
});
it('revoked MFA, banned/deleted users and absent or mismatched Auth sessions fail immediately',async()=>{
 await api("secure_session_open('admin')");await q("update auth.mfa_factors set status='unverified' where id=$1",[F]);expect((await api("secure_session_status('admin')")).active).toBe(false);
 await q("update auth.mfa_factors set status='verified' where id=$1",[F]);await q("update auth.users set banned_until=now()+interval '1 day' where id=$1",[A]);await expect(api('secure_access_status()')).rejects.toThrow(/cont/);
 await q('update auth.users set banned_until=null,deleted_at=now() where id=$1',[A]);expect((await api("secure_session_status('admin')")).active).toBe(false);await q('update auth.users set deleted_at=null where id=$1',[A]);
 await jwt(A,T);await expect(api('secure_access_status()')).rejects.toThrow(/cont/);await jwt(A,'ffffffff-ffff-ffff-ffff-ffffffffffff');expect((await api("secure_session_status('admin')")).reason).toBe('session_revoked');
});
it('fresh proof cannot be fabricated from non-TOTP AMR, an old timestamp, or another user factor',async()=>{
 await jwt(A,S,'aal2',Math.floor(Date.now()/1000)-301);expect((await api("secure_session_open('admin')")).active).toBe(false);
 await jwt(A,S,'aal2',0,{amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]});expect((await api("secure_session_open('admin')")).active).toBe(false);
 await q('update auth.sessions set factor_id=$1 where id=$2',[G,S]);await jwt();expect((await api("secure_session_open('admin')")).active).toBe(false);await q('update auth.sessions set factor_id=$1 where id=$2',[F,S]);
 await jwt(A,S,'aal2',0,{is_anonymous:true});await expect(api('secure_access_status()')).rejects.toThrow(/cont/);
});
it('role revocation blocks access using an otherwise valid JWT and cannot turn Business membership into Admin',async()=>{
 await api("secure_session_open('admin')");await q('delete from staff where user_id=$1',[A]);await expect(api('admin_dashboard()')).rejects.toThrow(/rezervat/);await q("insert into staff(user_id,role)values($1,'admin')",[A]);
 await jwt(B,T);await api("secure_session_open('business')");await q('update partner_members set active=false where user_id=$1',[B]);await expect(api("biz_dashboard_v2('secure-v')")).rejects.toThrow(/Nu ai voie|echipa/);await q('update partner_members set active=true where user_id=$1',[B]);expect((await api("secure_session_open('admin')")).active).toBe(false);
});
it('guards legacy and versioned Business routes and staff RLS without altering raw anti-self-benefit roles',async()=>{
 await jwt(B,T,'aal1');for(const sql of["biz_dashboard_v2('secure-v')","biz_today('secure-v')","biz_month('secure-v')","biz_team('secure-v')","drop_stop(gen_random_uuid())","reservation_decide(gen_random_uuid(),true)","visit_close(gen_random_uuid(),true)"])await expect(api(sql)).rejects.toThrow(/securizată/);
 await db.exec('set role authenticated');try{expect((await q('select * from partner_members')).rows).toEqual([]);await expect(q('select * from private.security_sessions')).rejects.toThrow(/permission denied/);}finally{await db.exec('reset role')}
 expect((await q("select private.member_role('secure-v') role")).rows[0].role).toBe('proprietar');expect((await q('select private.staff_role($1) role',[A])).rows[0].role).toBe('admin');
});
it('every operational membership RLS branch uses the secure role, while Client plan access remains independent',async()=>{
 const raw=(await q("select polname,pg_get_expr(polqual,polrelid) qual,pg_get_expr(polwithcheck,polrelid) check_expr from pg_policy where coalesce(pg_get_expr(polqual,polrelid),'')||coalesce(pg_get_expr(polwithcheck,polrelid),'') like '%member_role(%'")).rows;
 expect(raw.every(p=>!(/\bprivate\.member_role\(/.test((p.qual??'')+(p.check_expr??''))))).toBe(true);
 const policy=(await q("select pg_get_expr(polqual,polrelid) qual from pg_policy where polname='outing_events_read'")).rows[0].qual;
 expect(policy).toContain('plan_access');expect(policy).toContain('secured_member_role');
 await jwt(A,S,'aal2',Math.floor(Date.now()/1000),{sub:B});await expect(api('secure_access_status()')).rejects.toThrow(/cont/);
 expect((await q("select has_function_privilege('authenticated','private.arrive(uuid,boolean,text)','execute') allowed")).rows[0].allowed).toBe(false);
});
it('an employee still cannot claim their own venue Drop from Client after losing Business MFA access',async()=>{
 await jwt(B,T,'aal1');
 const plan=(await q("insert into plans(owner_id,venue_id,venue_name,starts_at,people)values($1,'secure-v','Local securizat',now(),1)returning id",[B])).rows[0].id;
 const drop=(await q("insert into drops(venue_id,title,pct_all,pct_plus,seats,min_group,starts_at,ends_at)values('secure-v','Ofertă test',10,20,4,1,now()-interval '11 minutes',now()+interval '2 hours')returning id")).rows[0].id;
 await expect(api("drop_claim_v2($1,$2,1,44.1,26.1,'employee-blocked')",[drop,plan])).rejects.toThrow(/Echipa localului/);
 expect((await q('select count(*) n from drop_claims where drop_id=$1',[drop])).rows[0].n).toBe(0);
});
