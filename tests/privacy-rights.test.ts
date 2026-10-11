import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import {prepareAuthSchema,seedAuthFixture,authenticateFixture} from './fixtures/auth.mjs';
import {privacyAdminAllowed,privacyCall,submitPrivacyRequest} from '../shared/privacy';
let db:PGlite;
const A='99000000-0000-0000-0000-000000000001',B='99000000-0000-0000-0000-000000000002',C='99000000-0000-0000-0000-000000000003';
const key='99000000-0000-0000-0000-000000000011';
const q=(sql:string,args:unknown[]=[])=>db.query<any>(sql,args);
async function as(uid:string,sql:string,args:unknown[]=[],scopes=true){await authenticateFixture(db,uid,{scopes});await db.exec('set role authenticated');try{return(await q(sql,args)).rows[0]?.result;}finally{await db.exec('reset role');}}
const submit=(uid=A,scope='client',kind='access',description='Doresc acces la datele mele personale.',requestKey=key)=>as(uid,'select privacy_request_submit($1,$2,$3,$4) result',[scope,kind,description,requestKey],false);
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
 create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid()to authenticated;create publication supabase_realtime;`);
 await prepareAuthSchema(db);
 for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 await db.exec('grant usage on schema public to anon,authenticated');
},60000);
beforeEach(async()=>{
 await q("select set_config('request.jwt.claims','{}',false),set_config('request.jwt.claim.sub','',false)");
 // Reinitialize this isolated fixture; immutable event logs are deliberately not directly deleted.
 await db.exec('truncate private.privacy_request_log,private.privacy_requests,private.security_sessions,public.staff,public.partner_members,public.profile_private,public.profiles,auth.sessions,auth.mfa_factors,auth.users cascade');
 for(const[uid,name]of[[A,'privana'],[B,'privbob'],[C,'privadmin']]){
  await q('insert into auth.users(id)values($1)',[uid]);await seedAuthFixture(db,uid);
  await as(uid,"select complete_signup($1,$1,'2000-01-01') result",[name],false);
 }
 await q("insert into staff(user_id,role)values($1,'admin')",[C]);
});
afterAll(()=>db?.close());
it('personal rights remain usable at aal1 for every application scope without creating a dashboard capability',async()=>{
 for(const scope of['client','business','admin']){
  const r=await submit(A,scope,'access',undefined,crypto.randomUUID());expect(r.scope).toBe(scope);expect(r.status).toBe('new');
 }
 expect((await as(A,'select privacy_my_requests(null) result',[],false)).length).toBe(3);
 await expect(as(A,'select admin_privacy_requests() result',[],false)).rejects.toThrow(/Nu ai voie/);
 expect(await as(A,'select secure_access_status() result',[],false)).toEqual({admin_role:null,business_access:false});
});
it('idempotent retries preserve the first immutable payload and reject key reuse; keys belong to their owner',async()=>{
 const one=await submit();expect(await submit()).toEqual(one);
 await expect(submit(A,'business')).rejects.toThrow(/cheie/);
 await expect(submit(A,'client','erasure')).rejects.toThrow(/cheie/);
 await expect(submit(A,'client','access','Un mesaj diferit despre toate datele.')).rejects.toThrow(/cheie/);
 expect((await submit(B)).id).not.toBe(one.id);
 expect((await q('select count(*)::int n from private.privacy_requests')).rows[0].n).toBe(2);
 expect((await q('select count(*)::int n from private.privacy_request_log')).rows[0].n).toBe(2);
});
it('anonymous, banned/deleted identities and revoked or mismatched sessions cannot use any personal endpoint',async()=>{
 await submit();await authenticateFixture(db,A,{scopes:false});
 const session=(await q("select current_setting('request.jwt.claims') claims")).rows[0].claims;
 for(const patch of[{session_id:crypto.randomUUID()},{sub:B},{is_anonymous:true}]){
  await q("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({...JSON.parse(session),...patch})]);
  await db.exec('set role authenticated');
  try{for(const sql of['select privacy_my_requests()','select privacy_export_my_data()','select delete_my_account()'])await expect(q(sql)).rejects.toThrow(/Intră întâi/);}finally{await db.exec('reset role');}
 }
 await q('update auth.users set banned_until=now()+interval\'1 day\' where id=$1',[A]);await expect(submit()).rejects.toThrow(/Intră întâi/);
 await q('update auth.users set banned_until=null,deleted_at=now() where id=$1',[A]);await expect(submit()).rejects.toThrow(/Intră întâi/);
 await q('update auth.users set deleted_at=null where id=$1',[A]);await q('delete from auth.sessions where user_id=$1',[A]);await expect(submit()).rejects.toThrow(/Intră întâi/);
 expect((await q('select id from auth.users where id=$1',[A])).rows).toHaveLength(1);
});
it('ownership filtering prevents cross-account reads; no direct tables, helpers, or anonymous RPC access exists',async()=>{
 const own=await submit();await submit(B);
 expect(await as(A,'select privacy_my_requests() result',[],false)).toEqual([own]);
 await db.exec('set role authenticated');try{
  await expect(q('select * from private.privacy_requests')).rejects.toThrow(/permission denied/);
  await expect(q('select * from private.privacy_request_log')).rejects.toThrow(/permission denied/);
  await expect(q('select private.privacy_require_user()')).rejects.toThrow(/permission denied/);
 }finally{await db.exec('reset role');}
 await db.exec('set role anon');try{await expect(q('select privacy_my_requests()')).rejects.toThrow(/permission denied/);}finally{await db.exec('reset role');}
 const metadata=(await q("select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'and relname in('privacy_requests','privacy_request_log')")).rows;
 expect(metadata).toHaveLength(2);expect(metadata.every(r=>r.relrowsecurity)).toBe(true);
});
it('calendar-month deadlines use Romanian calendar days, including February and DST, rather than 30 days',async()=>{
 const r=await submit();const correct=(await q("select ((created_at at time zone 'Europe/Bucharest')+interval'1 month')at time zone'Europe/Bucharest' due from private.privacy_requests where id=$1",[r.id])).rows[0].due;
 expect(new Date(r.due_at).getTime()).toBe(new Date(correct).getTime());
 expect((await q("select to_char(((timestamptz'2027-01-31 10:00:00+02'at time zone'Europe/Bucharest')+interval'1 month'),'YYYY-MM-DD HH24:MI') due")).rows[0].due).toBe('2027-02-28 10:00');
});
it('only founder and admin with verified MFA and active scoped session can access the queue',async()=>{
 await submit();await expect(as(C,'select admin_privacy_requests() result',[],false)).rejects.toThrow(/securizată/);
 expect((await as(C,'select admin_privacy_requests() result')).length).toBe(1);
 for(const role of['editor','moderator','suport','contabil']){
  await q('update staff set role=$1 where user_id=$2',[role,C]);
  await expect(as(C,'select admin_privacy_requests() result')).rejects.toThrow(/Nu ai voie/);
 }
 await q("update staff set role='fondator' where user_id=$1",[C]);expect((await as(C,'select admin_privacy_requests() result')).length).toBe(1);
 await q('delete from staff where user_id=$1',[C]);await expect(as(C,'select admin_privacy_requests() result')).rejects.toThrow(/Nu ai voie/);
});
it('version conflicts do not overwrite responses and final response never executes erasure',async()=>{
 const r=await submit(A,'client','erasure');
 const inWork=await as(C,'select admin_privacy_request_respond($1,1,\'in_progress\',$2) result',[r.id,'Verificăm datele și temeiurile aplicabile.']);expect(inWork.version).toBe(2);
 await expect(as(C,'select admin_privacy_request_respond($1,1,\'answered\',$2) result',[r.id,'Un răspuns trimis folosind versiunea veche.'])).rejects.toThrow(/s-a schimbat/);
 const final=await as(C,'select admin_privacy_request_respond($1,2,\'answered\',$2) result',[r.id,'Acesta este răspunsul nostru înregistrat, nu o comandă automată de ștergere.']);expect(final.status).toBe('answered');
 expect((await q('select id from auth.users where id=$1',[A])).rows).toHaveLength(1);
 await expect(as(C,'select admin_privacy_request_respond($1,3,\'refused\',$2) result',[r.id,'Un refuz după răspunsul final transmis.'])).rejects.toThrow(/deja/);
 const detail=await as(C,'select admin_privacy_request_detail($1) result',[r.id]);expect(detail.history).toHaveLength(3);
 expect((await as(A,'select privacy_my_requests() result',[],false))[0].response).toBe(final.response);
});
it('extensions require a reason in the first month, add at most two months once, and survive later status changes',async()=>{
 const r=await submit();
 await expect(as(C,"select admin_privacy_request_respond($1,1,'extended','Motiv',2) result",[r.id])).rejects.toThrow(/20–8000/);
 await expect(as(C,"select admin_privacy_request_respond($1,1,'extended','Complexitatea solicitării necesită mai mult timp.',3) result",[r.id])).rejects.toThrow(/invalid/);
 const ext=await as(C,"select admin_privacy_request_respond($1,1,'extended','Complexitatea solicitării și verificarea arhivelor impun această prelungire.',2) result",[r.id]);
 expect(ext.extension_months).toBe(2);expect(new Date(ext.due_at).getTime()).toBeGreaterThan(new Date(r.due_at).getTime());
 await expect(as(C,"select admin_privacy_request_respond($1,2,'extended','Încercăm încă o prelungire fără să răspundem.',1) result",[r.id])).rejects.toThrow(/singură dată/);
 const updated=await as(C,"select admin_privacy_request_respond($1,2,'in_progress','Evaluarea arhivelor este în desfășurare și continuă verificările.',0) result",[r.id]);expect(updated.due_at).toBe(ext.due_at);expect(updated.extension_reason).toBe(ext.extension_reason);
 const overdue=await submit(B);await q("update private.privacy_requests set original_due_at=now()-interval'1 second',due_at=now()-interval'1 second'where id=$1",[overdue.id]);
 await expect(as(C,"select admin_privacy_request_respond($1,1,'extended','Am depășit termenul inițial și cerem acum prelungire.',1) result",[overdue.id])).rejects.toThrow(/prima lună/);
});
it('exports only the owner core, excluding other accounts, storage links, device IDs and Auth/MFA material',async()=>{
 await submit();await submit(B,'business','objection','Text confidențial Bob care nu aparține Anei.');
 await q('update profile_private set prefs=$2,app_state=$3 where id=$1',[A,JSON.stringify({zone:'centru',likes:['cafe'],secret:'forbidden-secret',other_email:'bob@example.invalid'}),JSON.stringify({device_id:'forbidden-device',friends:[B],avatar:'private-photo-url'})]);
 const data=await as(A,'select privacy_export_my_data() result',[],false);expect(data.user_id).toBe(A);expect(data.profile.username).toBe('privana');expect(data.preferences.zone).toBe('centru');
 const json=JSON.stringify(data);for(const value of[B,'privbob','bob@example.invalid','forbidden-secret','forbidden-device','private-photo-url','friend_code','factor_id','amr','access_token'])expect(json).not.toContain(value);
 expect(data.coverage).toContain('Nu este răspunsul integral');expect(data.requests).toHaveLength(1);
});
it('deletion revokes live Auth sessions and deletes an uncomplicated Client, but cannot cascade a privileged identity',async()=>{
 await as(A,'select delete_my_account() result',[],false);
 expect((await q('select id from auth.users where id=$1',[A])).rows).toHaveLength(0);expect((await q('select id from auth.sessions where user_id=$1',[A])).rows).toHaveLength(0);expect((await q('select id from profiles where id=$1',[A])).rows).toHaveLength(0);
 await expect(as(C,'select delete_my_account() result',[],false)).rejects.toThrow(/verificare/);expect((await q('select id from auth.users where id=$1',[C])).rows).toHaveLength(1);
 await submit(B,'business','erasure');await expect(as(B,'select delete_my_account() result',[],false)).rejects.toThrow(/verificare/);
});
it('technical validation and anti-abuse keep legitimate retries and contact channel available',async()=>{
 await expect(submit(A,'other')).rejects.toThrow(/valid/);await expect(submit(A,'client','whatever')).rejects.toThrow(/valid/);await expect(submit(A,'client','access','short')).rejects.toThrow(/10–4000/);
 const first=await submit();for(let i=0;i<19;i++)await submit(A,'client','access',undefined,crypto.randomUUID());
 expect(await submit()).toEqual(first);await expect(submit(A,'client','access',undefined,crypto.randomUUID())).rejects.toThrow(/contact@cornacidev.ro/);
 await expect(as(C,"select admin_privacy_requests(null,201,0) result")).rejects.toThrow(/Paginare/);
 expect((await as(C,"select admin_privacy_requests(null,5,5) result")).length).toBe(5);
});
it('pending reservations, Drop claims and draft photos require review before a destructive Auth cascade',async()=>{
 await db.exec("insert into venues(id,name,cat,lat,lon,data)values('privacy-v','Local GDPR','mancare',44,26,'{}');insert into partners(venue_id,firm,cui,rate,activated_at,free_until)values('privacy-v','Privacy SRL','18547290',.1,current_date,current_date)");
 const reservation=(await q("insert into reservations(venue_id,user_id,people,at)values('privacy-v',$1,2,now()+interval'1 day')returning id",[A])).rows[0].id;
 await expect(as(A,'select delete_my_account() result',[],false)).rejects.toThrow(/verificare/);
 expect((await q('select user_id from reservations where id=$1',[reservation])).rows[0].user_id).toBe(A);
 await q('delete from reservations where id=$1',[reservation]);
 const drop=(await q("insert into drops(venue_id,title,pct_all,pct_plus,seats,starts_at,ends_at)values('privacy-v','Drop de test',10,15,4,now(),now()+interval'1 hour')returning id")).rows[0].id;
 await q("insert into drop_claims(drop_id,user_id,seats,expires_at)values($1,$2,2,now()+interval'1 hour')",[drop,A]);
 await expect(as(A,'select delete_my_account() result',[],false)).rejects.toThrow(/verificare/);
 await q('delete from drop_claims where user_id=$1',[A]);
 const draft=await as(A,"select support_report_create('draft-photo','issue','client','Poza pentru suport','Descriu problema complet înainte de a atașa poza.',null,'image/png')result",[],false);
 expect(draft.photo_path).toBeTruthy();expect((await q('select photo_uploaded_at from private.support_reports where id=$1',[draft.id])).rows[0].photo_uploaded_at).toBeNull();
 await expect(as(A,'select delete_my_account() result',[],false)).rejects.toThrow(/verificare/);
 expect((await q('select id from auth.users where id=$1',[A])).rows).toHaveLength(1);
});
it('personal request pagination and bounded exports explicitly report incomplete request history',async()=>{
 await q("insert into private.privacy_requests(user_id,request_key,scope,kind,description,created_at) select $1,gen_random_uuid(),'client','access','Cerere istorică de acces la datele mele.',now()-make_interval(days=>n) from generate_series(1,105)n",[A]);
 const first=await as(A,'select privacy_my_requests(null,100,0)result',[],false),next=await as(A,'select privacy_my_requests(null,100,100)result',[],false);
 expect(first).toHaveLength(100);expect(next).toHaveLength(5);expect(new Set([...first,...next].map(r=>r.id)).size).toBe(105);
 const data=await as(A,'select privacy_export_my_data()result',[],false);expect(data.requests_count).toBe(105);expect(data.requests_truncated).toBe(true);expect(data.requests).toHaveLength(100);expect(data.coverage).toContain('100');
 await expect(as(A,'select privacy_my_requests(null,201,0)result',[],false)).rejects.toThrow(/Paginare/);
});
it('queue operations reject an expired scoped session even while the original MFA Auth session is valid',async()=>{
 const r=await submit();await as(C,'select admin_privacy_requests()result');
 await q("update private.security_sessions set touched_at=now()-interval'16 minutes'where user_id=$1",[C]);
 for(const [sql,args]of[
  ['select admin_privacy_requests()result',[]],['select admin_privacy_request_detail($1)result',[r.id]],
  ["select admin_privacy_request_respond($1,1,'answered','Nu trebuie să treacă acest răspuns fără sesiune.')result",[r.id]],
 ]as const)await expect(as(C,sql,[...args])).rejects.toThrow(/securizată/);
 expect((await q('select version from private.privacy_requests where id=$1',[r.id])).rows[0].version).toBe(1);
});
it('avatar files and free-text support records require manual erasure review instead of orphaning personal data',async()=>{
 await q('update profiles set avatar_path=$2 where id=$1',[A,'private/avatar.png']);
 await expect(as(A,'select delete_my_account()result',[],false)).rejects.toThrow(/verificare/);
 await q('update profiles set avatar_path=null where id=$1',[A]);
 await as(A,"select support_report_create('text-only','issue','client','Cerere de suport','Descrierea mea cu date personale pentru suport.')result",[],false);
 await expect(as(A,'select delete_my_account()result',[],false)).rejects.toThrow(/verificare/);
 expect((await q('select id from auth.users where id=$1',[A])).rows).toHaveLength(1);
});
it('all exposed privacy RPCs have empty search paths, restricted execute grants and immutable history',async()=>{
 const funcs=(await q("select p.oid::regprocedure::text name,p.proconfig,has_function_privilege('anon',p.oid,'execute') anon_allowed,has_function_privilege('authenticated',p.oid,'execute') auth_allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and(p.proname like 'privacy_%'or p.proname like 'admin_privacy_%')")).rows;
 expect(funcs).toHaveLength(6);for(const f of funcs){expect(f.proconfig).toContain('search_path=""');expect(f.anon_allowed).toBe(false);expect(f.auth_allowed).toBe(true);}
 const r=await submit();await expect(q("update private.privacy_request_log set response='Alterare nepermisă'where request_id=$1",[r.id])).rejects.toThrow(/Jurnalul/);
 await expect(q('delete from private.privacy_request_log where request_id=$1',[r.id])).rejects.toThrow(/Jurnalul/);
});
it('shared API preserves key and parameters, throws failures and never invents Admin permission',async()=>{
 let sent:any;const client={rpc:async(name:string,args:any)=>{sent={name,args};return{data:{id:'x'},error:null}}};
 expect(await submitPrivacyRequest(client,{scope:'business',kind:'erasure',description:'  Șterge datele mele.  ',key})).toEqual({id:'x'});
 expect(sent.args).toEqual({p_scope:'business',p_kind:'erasure',p_description:'Șterge datele mele.',p_request_key:key});
 await expect(privacyCall({rpc:async()=>({data:null,error:{message:'denied'}})},'privacy_my_requests')).rejects.toThrow('denied');
 for(const role of['editor','moderator','suport','contabil',null,undefined])expect(privacyAdminAllowed(role)).toBe(false);expect(privacyAdminAllowed('admin')).toBe(true);expect(privacyAdminAllowed('fondator')).toBe(true);
});
