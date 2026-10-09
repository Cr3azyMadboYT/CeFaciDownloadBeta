import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let db:PGlite;
const U={applicant:'00000000-0000-0000-0000-000000000001',other:'00000000-0000-0000-0000-000000000002',owner:'00000000-0000-0000-0000-000000000003',admin:'00000000-0000-0000-0000-000000000004',support:'00000000-0000-0000-0000-000000000005'};
const q=(sql:string,args:unknown[]=[])=>db.query<any>(sql,args);
async function as(who:keyof typeof U,sql:string,args:unknown[]=[]){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${U[who]}',false);set role authenticated`);try{return await q(sql,args)}finally{await db.exec('reset role')}}
async function rpc(who:keyof typeof U,sql:string,args:unknown[]=[]){return (await as(who,`select ${sql} result`,args)).rows[0].result}
const details={requester_name:'Patron Test',requester_role:'Administrator',firm:'Firma Test SRL',cui:'18547290',phone:'+40721000111'};
async function create(key:string,kind='claim',venue:string|null='unclaimed',extra={}){return rpc('applicant','biz_partner_request_create($1,$2,$3,$4)',[key,kind,venue,{...details,...extra}])}
async function uploaded(id:string,who:keyof typeof U='applicant',mime='application/pdf',size=1000,extension='pdf'){
 const path=`${U[who]}/${id}/proof.${extension}`;
 await as(who,"insert into storage.objects(bucket_id,name,metadata) values('business-proofs',$1,$2)",[path,{size,mimetype:mime,eTag:'trusted-storage-etag'}]);return path;
}
async function submitted(key:string,kind='claim',venue:string|null='unclaimed',extra={}){const r=await create(key,kind,venue,extra);const path=await uploaded(r.id);return rpc('applicant','biz_partner_request_submit($1,$2)',[r.id,path]);}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;create schema storage;create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 for(const f of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec('grant usage on schema public to anon,authenticated');
 for(const [name,id]of Object.entries(U)){await q('insert into auth.users(id) values($1)',[id]);if(name!=='applicant'&&name!=='other')await as(name as keyof typeof U,"select complete_signup($1,$1,'2000-01-01')",[name]);}
 await db.exec(`insert into venues(id,name,cat,lat,lon,data) values('unclaimed','Local Liber','mancare',44,26,'{"street":"Strada Test 1","city":"Buftea"}'),('claimed','Local Revendicat','mancare',44,26,'{}'),('hidden','Local Ascuns','mancare',44,26,'{}');update venues set status='hidden' where id='hidden';insert into partners(venue_id,firm,cui,rate,activated_at,free_until) values('claimed','Firm SRL','18547290',.1,current_date,current_date);`);
 await q("insert into partner_members(venue_id,user_id,role)values('claimed',$1,'proprietar')",[U.owner]);
 await q("insert into staff(user_id,role) values($1,'admin'),($2,'suport')",[U.admin,U.support]);
},60000);
beforeEach(async()=>{await q("update private.partner_requests set created_at=now()-interval '2 days'");});
afterAll(()=>db?.close());
it('provides whitelisted authenticated unclaimed/claimed search, without hidden venues or owner/company identities',async()=>{
 const results=await rpc('applicant',"biz_venue_search('Local')");expect(results).toHaveLength(2);expect(results.find((x:any)=>x.id==='claimed').claimed).toBe(true);expect(results.find((x:any)=>x.id==='unclaimed').claimed).toBe(false);expect(Object.keys(results[0]).sort()).toEqual(['address','city','claimed','id','name']);expect(await rpc('applicant',"biz_venue_search('%')")).toEqual([]);expect(await rpc('applicant',"biz_venue_search('')")).toEqual([]);
});
it('denies anon endpoints and direct access to internal requests/logs',async()=>{
 await db.exec("reset role;set role anon");try{await expect(q("select biz_venue_search('Local')")).rejects.toThrow(/permission denied/);await expect(q('select business_proofs_retention_candidates()')).rejects.toThrow(/permission denied/)}finally{await db.exec('reset role')}
 await expect(as('applicant','select * from private.partner_requests')).rejects.toThrow(/permission denied/);await expect(as('applicant','select * from private.partner_request_log')).rejects.toThrow(/permission denied/);
 expect((await q("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and relname in('partner_requests','partner_request_log','partner_proof_access') and not relrowsecurity")).rows).toEqual([]);
});
it('lets a verified Auth account request partnership without inventing a public Client profile',async()=>{
 const r=await create('no-profile');expect(r.status).toBe('draft');expect((await q('select * from profiles where id=$1',[U.applicant])).rows).toEqual([]);expect((await q('select * from partner_members where user_id=$1',[U.applicant])).rows).toEqual([]);await rpc('applicant','biz_partner_request_cancel($1)',[r.id]);
});
it('validates identity, Romanian CUI checksum and new venue fields on the server',async()=>{
 await expect(create('bad-cui','claim','unclaimed',{cui:'18547291'})).rejects.toThrow(/CUI invalid/);await expect(create('missing-name','claim','unclaimed',{requester_name:''})).rejects.toThrow(/Completează/);await expect(create('metadata-roles','claim','unclaimed',{role:'admin'})).rejects.toThrow(/nu sunt valide/);await expect(create('new-missing','new',null)).rejects.toThrow(/Completează numele, adresa/);
});
it('is idempotent but refuses key reuse with another payload and duplicate open venue requests',async()=>{
 const a=await create('idempotent');expect((await create('idempotent')).id).toBe(a.id);await expect(create('idempotent','claim','unclaimed',{firm:'Other SRL'})).rejects.toThrow(/cheie/);await expect(create('other-key')).rejects.toThrow(/deja o cerere/);await rpc('applicant','biz_partner_request_cancel($1)',[a.id]);
});
it('protects request list/submit/cancel against IDOR and requires actual upload',async()=>{
 const r=await create('idor');expect(await rpc('other','biz_partner_requests()')).toEqual([]);await expect(rpc('other','biz_partner_request_cancel($1)',[r.id])).rejects.toThrow(/disponibilă/);await expect(rpc('other','biz_partner_request_submit($1,$2)',[r.id,`${U.applicant}/${r.id}/proof.pdf`])).rejects.toThrow(/disponibilă/);await expect(rpc('applicant','biz_partner_request_submit($1,$2)',[r.id,`${U.applicant}/${r.id}/proof.pdf`])).rejects.toThrow(/Încarcă documentul/);await rpc('applicant','biz_partner_request_cancel($1)',[r.id]);
});
it('uses a private size/MIME restricted bucket and rejects foreign upload paths and immutable file replacement',async()=>{
 const b=(await q("select * from storage.buckets where id='business-proofs'")).rows[0];expect(b.public).toBe(false);expect(Number(b.file_size_limit)).toBe(8388608);expect(b.allowed_mime_types).toEqual(['application/pdf','image/jpeg','image/png']);
 const r=await create('storage');await expect(uploaded(r.id,'other')).rejects.toThrow(/row-level security/);await expect(as('applicant',"insert into storage.objects(bucket_id,name,metadata) values('business-proofs',$1,'{}')",[`${U.applicant}/${r.id}/evil.html`])).rejects.toThrow(/row-level security/);const p=await uploaded(r.id);expect((await as('other','select * from storage.objects')).rows).toEqual([]);expect((await as('applicant','update storage.objects set metadata=$1 where name=$2',[{size:999,mimetype:'image/png'},p])).affectedRows).toBe(0);expect((await as('applicant','delete from storage.objects where name=$1',[p])).affectedRows).toBe(0);await rpc('applicant','biz_partner_request_cancel($1)',[r.id]);
});
it('rejects extension/MIME mismatch and oversized metadata when submitting',async()=>{
 const a=await create('mime');const path=await uploaded(a.id,'applicant','text/html',1000);await expect(rpc('applicant','biz_partner_request_submit($1,$2)',[a.id,path])).rejects.toThrow(/PDF, JPEG sau PNG/);await rpc('applicant','biz_partner_request_cancel($1)',[a.id]);
 const b=await create('size');const p=await uploaded(b.id,'applicant','application/pdf',8388609);await expect(rpc('applicant','biz_partner_request_submit($1,$2)',[b.id,p])).rejects.toThrow(/8 MB/);await rpc('applicant','biz_partner_request_cancel($1)',[b.id]);
});
it('stores a real pending request with provider fingerprint without granting ownership or publishing anything',async()=>{
 const r=await submitted('real-new','new',null,{venue_name:'Local Nou',address:'Strada Noua 10',city:'Buftea',category:'mancare'});expect(r.status).toBe('pending');expect((await q('select proof_fingerprint from private.partner_requests where id=$1',[r.id])).rows[0].proof_fingerprint).toBe('trusted-storage-etag');expect((await q("select id from venues where name='Local Nou'")).rows).toEqual([]);expect((await q('select * from partner_members where user_id=$1',[U.applicant])).rows).toEqual([]);expect((await rpc('applicant','biz_partner_request_submit($1,$2)',[r.id,`${U.applicant}/${r.id}/proof.pdf`])).id).toBe(r.id);await rpc('applicant','biz_partner_request_cancel($1)',[r.id]);
});
it('never bypasses claimed-owner disputes or lets owners request their own local',async()=>{
 await expect(create('claim-claimed','claim','claimed')).rejects.toThrow(/revendicat/);await expect(create('dispute-unclaimed','dispute','unclaimed')).rejects.toThrow(/nu este revendicat/);await expect(rpc('owner','biz_partner_request_create($1,$2,$3,$4)',['self','dispute','claimed',details])).rejects.toThrow(/deja acces/);
});
it('logs short-lived proof access and restricts it to applicant or partnership reviewers',async()=>{
 const r=await submitted('access');await expect(rpc('other','biz_partner_proof_access($1)',[r.id])).rejects.toThrow(/disponibil/);await expect(rpc('support','biz_partner_proof_access($1)',[r.id])).rejects.toThrow(/disponibil/);expect((await as('admin',"select * from storage.objects where name=$1",[`${U.applicant}/${r.id}/proof.pdf`])).rows).toEqual([]);const grant=await rpc('admin','biz_partner_proof_access($1)',[r.id]);expect(grant.expires_in).toBe(300);expect((await as('admin','select * from storage.objects where name=$1',[grant.path])).rows).toHaveLength(1);expect((await q("select * from private.partner_request_log where request_id=$1 and action='proof_access_authorized'",[r.id])).rows).toHaveLength(1);await q("update private.partner_proof_access set expires_at=now()-interval '1 minute' where request_id=$1",[r.id]);expect((await as('admin','select * from storage.objects where name=$1',[grant.path])).rows).toEqual([]);await rpc('applicant','biz_partner_request_cancel($1)',[r.id]);
});
it('requires authorized reviewer, actual firm confirmation and recorded document access before verification',async()=>{
 const r=await submitted('review');await expect(rpc('applicant','admin_partner_requests()')).rejects.toThrow(/Doar echipa/);await expect(rpc('support','admin_partner_request_decide($1,$2,$3,true)',[r.id,'verified','Am verificat documentele.'])).rejects.toThrow(/Doar echipa/);await expect(rpc('admin','admin_partner_request_decide($1,$2,$3,false)',[r.id,'verified','Am verificat documentele.'])).rejects.toThrow(/ANAF/);await expect(rpc('admin','admin_partner_request_decide($1,$2,$3,true)',[r.id,'verified','Am verificat documentele.'])).rejects.toThrow(/documentul/);await rpc('admin','biz_partner_proof_access($1)',[r.id]);const v=await rpc('admin','admin_partner_request_decide($1,$2,$3,true)',[r.id,'verified','Firma verificată manual la ANAF; document verificat.']);expect(v.status).toBe('verified');expect(v.activation_pending).toBe(true);expect((await q("select * from partners where venue_id='unclaimed'")).rows).toEqual([]);expect((await q('select * from partner_members where user_id=$1',[U.applicant])).rows).toEqual([]);
});
it('forbids staff self-approval even if staff permissions were granted after request creation',async()=>{
 const r=await rpc('other','biz_partner_request_create($1,$2,$3,$4)',['promoted','claim','unclaimed',details]);const p=await uploaded(r.id,'other');await rpc('other','biz_partner_request_submit($1,$2)',[r.id,p]);await as('other',"select complete_signup('other','other','2000-01-01')");await q("insert into staff(user_id,role)values($1,'admin')",[U.other]);await expect(rpc('other','admin_partner_request_decide($1,$2,$3,true)',[r.id,'verified','Am verificat documentele.'])).rejects.toThrow(/propria cerere/);await q('delete from staff where user_id=$1',[U.other]);await rpc('other','biz_partner_request_cancel($1)',[r.id]);
});
it('supports private owner notice/reply with a full 3-day hold and no automatic ownership transfer',async()=>{
 const r=await submitted('dispute','dispute','claimed');expect(r.owner_response_deadline).toBeNull();const inbox=await rpc('owner',"biz_ownership_disputes('claimed')");expect(inbox[0].id).toBe(r.id);expect(inbox[0].deadline).toBeTruthy();expect(inbox[0].details).toBeUndefined();expect(inbox[0].applicant_id).toBeUndefined();await expect(rpc('applicant',"biz_ownership_disputes('claimed')")).rejects.toThrow(/Doar proprietarul/);await expect(rpc('applicant','biz_ownership_dispute_reply($1,$2)',[r.id,'Sunt proprietarul localului.'])).rejects.toThrow(/Doar proprietarul/);await rpc('owner','biz_ownership_dispute_reply($1,$2)',[r.id,'Firma actuală este proprietarul; pot prezenta actele.']);await expect(rpc('owner','biz_ownership_dispute_reply($1,$2)',[r.id,'Un alt răspuns aici.'])).rejects.toThrow(/deja trimis/);await rpc('admin','biz_partner_proof_access($1)',[r.id]);await expect(rpc('admin','admin_partner_request_decide($1,$2,$3,true)',[r.id,'verified','Am verificat documentele.'])).rejects.toThrow(/3 zile/);await q("update private.partner_requests set owner_response_deadline=now()-interval '1 minute' where id=$1",[r.id]);await rpc('admin','admin_partner_request_decide($1,$2,$3,true)',[r.id,'verified','Firma verificată și disputa documentată.']);expect((await q("select user_id from partner_members where venue_id='claimed' and role='proprietar' and active")).rows[0].user_id).toBe(U.owner);
});
it('requires an administrator-created venue before verifying a missing venue',async()=>{
 const r=await submitted('new-admin','new',null,{venue_name:'Local Nou Admin',address:'Strada Noua 12',city:'Buftea',category:'mancare'});await rpc('admin','biz_partner_proof_access($1)',[r.id]);await expect(rpc('admin','admin_partner_request_decide($1,$2,$3,true)',[r.id,'verified','Firma și documentele verificate.'])).rejects.toThrow(/adăugat și verificat/);await expect(rpc('admin','admin_partner_request_decide($1,$2,$3,true,$4)',[r.id,'verified','Firma și documentele verificate.','made-up'])).rejects.toThrow(/adăugat și verificat/);await q("insert into venues(id,name,cat,lat,lon,source) values('admin-new','Local Nou Admin','mancare',44,26,'admin')");expect((await rpc('admin','admin_partner_request_decide($1,$2,$3,true,$4)',[r.id,'verified','Firma și documentele verificate.','admin-new'])).venue_id).toBe('admin-new');
});
it('expires proof access at 90 days and keeps review note/fingerprint; only service can acknowledge actual deletion',async()=>{
 const r=await submitted('retention');await rpc('admin','biz_partner_proof_access($1)',[r.id]);await q("update private.partner_requests set proof_uploaded_at=now()-interval '91 days' where id=$1",[r.id]);await q("update storage.objects set created_at=now()-interval '91 days' where name=$1",[`${U.applicant}/${r.id}/proof.pdf`]);await expect(rpc('admin','biz_partner_proof_access($1)',[r.id])).rejects.toThrow(/disponibil/);expect((await as('admin','select * from storage.objects where name=$1',[`${U.applicant}/${r.id}/proof.pdf`])).rows).toEqual([]);await expect(rpc('applicant','business_proof_deleted($1)',[r.id])).rejects.toThrow(/permission denied/);await db.exec('set role service_role');try{expect((await q('select business_proofs_retention_candidates() result')).rows[0].result).toContainEqual({request_id:r.id,path:`${U.applicant}/${r.id}/proof.pdf`});await expect(q('select business_proof_deleted($1)',[r.id])).rejects.toThrow(/API-ul Storage/)}finally{await db.exec('reset role')};await q('delete from storage.objects where name=$1',[`${U.applicant}/${r.id}/proof.pdf`]);await db.exec('set role service_role');try{expect((await q('select business_proofs_retention_candidates() result')).rows[0].result).toContainEqual({request_id:r.id,path:`${U.applicant}/${r.id}/proof.pdf`});await q('select business_proof_deleted($1)',[r.id])}finally{await db.exec('reset role')};const saved=(await q('select proof_deleted_at,proof_fingerprint from private.partner_requests where id=$1',[r.id])).rows[0];expect(saved.proof_deleted_at).toBeTruthy();expect(saved.proof_fingerprint).toBe('trusted-storage-etag');await rpc('applicant','biz_partner_request_cancel($1)',[r.id]);
});

it('blocks anonymous Auth users using trusted JWT claims, including Storage inserts',async()=>{
 await db.exec(`select set_config('request.jwt.claims','{"is_anonymous":true}',false)`);
 try {await expect(create('anon-auth')).rejects.toThrow(/Intră întâi/);await expect(rpc('applicant','biz_identity_status()')).rejects.toThrow(/Intră întâi/);}finally{await db.exec("select set_config('request.jwt.claims','{}',false)")}
});
it('lets Business create a real shared profile with validated birthday and preserves an existing Client profile',async()=>{
 expect(await rpc('applicant','biz_identity_status()')).toEqual({has_profile:false,username:null,first_name:null});
 await expect(rpc('applicant','biz_identity_complete($1,$2,$3)',['patron','Patron','2020-01-01'])).rejects.toThrow(/16/);
 const complete=await rpc('applicant','biz_identity_complete($1,$2,$3)',['patron','Patron','1990-01-01']);expect(complete).toEqual({has_profile:true,username:'patron',first_name:'Patron'});
 expect(await rpc('applicant','biz_identity_complete($1,$2,$3)',['overwritten','Other','1991-01-01'])).toEqual(complete);
 expect((await q('select birth_date::text birth_date from profile_private where id=$1',[U.applicant])).rows[0].birth_date).toBe('1990-01-01');
});
it('limits pending request count and daily creation server-side',async()=>{
 const ds={...details,venue_name:'FiveRequests',address:'Street one',city:'Buftea',category:'mancare'};
 for(let i=0;i<5;i++)await create(`quota-${i}`,'new',null,{...ds,venue_name:`FiveRequests${i}`});
 await expect(create('quota-six','new',null,{...ds,venue_name:'Six'})).rejects.toThrow(/deja cereri/);
 await q("update private.partner_requests set status='cancelled' where user_id=$1 and status='draft'",[U.applicant]);
 for(let i=5;i<10;i++){const r=await create(`quota-${i}`,'new',null,{...ds,venue_name:`FiveRequests${i}`});await rpc('applicant','biz_partner_request_cancel($1)',[r.id]);}
 await expect(create('quota-eleven','new',null,{...ds,venue_name:'Eleven'})).rejects.toThrow(/deja cereri/);
});
it('includes abandoned draft uploads in the 90-day retention scan',async()=>{
 const r=await create('orphan-retention');const p=await uploaded(r.id);await rpc('applicant','biz_partner_request_cancel($1)',[r.id]);await q("update storage.objects set created_at=now()-interval '91 days' where name=$1",[p]);await q("update private.partner_requests set created_at=now()-interval '91 days' where id=$1",[r.id]);
 await db.exec('set role service_role');try{expect((await q('select business_proofs_retention_candidates() result')).rows[0].result).toContainEqual({request_id:r.id,path:p});await expect(q('select business_proof_deleted($1)',[r.id])).rejects.toThrow(/API-ul Storage/)}finally{await db.exec('reset role')}
 await q('delete from storage.objects where name=$1',[p]);await db.exec('set role service_role');try{await q('select business_proof_deleted($1)',[r.id])}finally{await db.exec('reset role')}
});
it('does not allow a new listing to bypass a claimed-venue dispute',async()=>{
 const r=await submitted('new-claim-bypass','new',null,{venue_name:'Another Venue',address:'Street 99',city:'Buftea',category:'mancare'});await rpc('admin','biz_partner_proof_access($1)',[r.id]);await expect(rpc('admin','admin_partner_request_decide($1,$2,$3,true,$4)',[r.id,'verified','Firma și documentele verificate.','claimed'])).rejects.toThrow(/dispută/);await rpc('applicant','biz_partner_request_cancel($1)',[r.id]);
});
it('preserves audit rows without preventing a Client user from deleting their account',async()=>{
 await expect(q('delete from auth.users where id=$1',[U.applicant])).resolves.toBeTruthy();expect((await q('select user_id from private.partner_requests where request_key=$1',['no-profile'])).rows[0].user_id).toBeNull();
});

it('keeps verification journal immutable even for accidental privileged updates',async()=>{
 await expect(q("update private.partner_request_log set action='rewritten' where id=(select min(id) from private.partner_request_log)")).rejects.toThrow(/nu se poate modifica/);await expect(q('delete from private.partner_request_log')).rejects.toThrow(/nu se poate modifica/);
});
