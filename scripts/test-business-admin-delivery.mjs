// Actual PostgreSQL functions/RLS, isolated database and synthetic Auth/Storage records only.
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prepareAuthSchema,seedAuthFixture,authenticateFixture} from '../tests/fixtures/auth.mjs';

const target=new URL(process.env.CEFACI_TEST_DATABASE_URL ?? '');
if(!['127.0.0.1','localhost'].includes(target.hostname))throw new Error('Use isolated localhost PostgreSQL only.');
const master=new pg.Client({connectionString:target.toString()});await master.connect();
const dbname='cefaci_delivery_'+process.pid+'_'+Date.now();let db;
try{
 await master.query(`create database ${dbname}`);target.pathname='/'+dbname;
 db=new pg.Client({connectionString:target.toString()});await db.connect();
 await db.query(`do $$begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;
 end$$;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
 create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create publication supabase_realtime;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 await prepareAuthSchema(db);
 for(const f of fs.readdirSync('supabase/migrations').sort())await db.query(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 const ids={applicant:randomUUID(),owner:randomUUID(),admin:randomUUID(),other:randomUUID()};
 for(const id of Object.values(ids)){await db.query('insert into auth.users(id)values($1)',[id]);await seedAuthFixture(db,id);}
 const as=async(who,sql,args=[])=>{
  await db.query('reset role');await authenticateFixture(db,ids[who]);await db.query('set role authenticated');
  try{return await db.query(sql,args);}finally{await db.query('reset role');}
 };
 const rpc=async(who,sql,args=[])=> (await as(who,'select '+sql+' as result',args)).rows[0].result;
 for(const who of ['admin','owner'])await rpc(who,"complete_signup($1,$1,'1990-01-01')",['delivery_'+who]);
 await db.query("insert into staff(user_id,role)values($1,'admin')",[ids.admin]);
 await db.query(`insert into venues(id,name,cat,lat,lon,data)values('free','Free','mancare',44,26,'{}'),('owned','Owned','mancare',44,26,'{}');
 insert into partners(venue_id,firm,cui,rate,activated_at,free_until)values('owned','Test SRL','18547290',.1,current_date,current_date);`);
 await db.query("insert into partner_members(venue_id,user_id,role)values('owned',$1,'proprietar')",[ids.owner]);
 const details={requester_name:'Ana Test',requester_role:'Administrator',firm:'Test SRL',cui:'18547290',phone:'0712345678',venue_name:'New Venue',address:'Test Street 1',city:'Buftea',category:'Restaurant'};
 await assert.rejects(rpc('applicant','biz_partner_request_create($1,$2,$3,$4)',['invalid','new',null,{...details,phone:'telefon invalid'}]),/telefonul/);
 for(const [kind,venue,ext,mime] of [['claim','free','pdf','application/pdf'],['new',null,'jpg','image/jpeg'],['dispute','owned','png','image/png']]){
  const r=await rpc('applicant','biz_partner_request_create($1,$2,$3,$4)',['delivery-'+kind,kind,venue,details]);
  assert(!(await rpc('admin',"admin_partner_requests('pending')")).some(x=>x.id===r.id));
  const path=`${ids.applicant}/${r.id}/proof.${ext}`;
  await assert.rejects(rpc('applicant','biz_partner_request_submit($1,$2)',[r.id,path]),/Încarcă documentul/);
  await assert.rejects(as('other',"insert into storage.objects(bucket_id,name,metadata)values('business-proofs',$1,$2)",[path,{size:100,mimetype:mime}]),/row-level security/);
  await as('applicant',"insert into storage.objects(bucket_id,name,metadata)values('business-proofs',$1,$2)",[path,{size:100,mimetype:mime,eTag:'synthetic'}]);
  for(let i=0;i<2;i++)assert.equal((await rpc('applicant','biz_partner_request_submit($1,$2)',[r.id,path])).status,'pending');
  assert.equal((await rpc('admin',"admin_partner_requests('pending')")).filter(x=>x.id===r.id).length,1);
  assert(!(await rpc('other','biz_partner_requests()')).some(x=>x.id===r.id));
  console.log(`PASS: ${kind} ${ext} → Admin once; drafts/missing proof/foreign upload denied.`);
 }
 {
  const r=await rpc('applicant','biz_partner_request_create($1,$2,$3,$4)',['delivery-multiple','new',null,{...details,venue_name:'Multiple files'}]);
  const files=[{name:'Firma.pdf',content_type:'application/pdf',size:100},{name:'Foto.jpg',content_type:'image/jpeg',size:100}];
  const manifest=await rpc('applicant','biz_partner_request_files($1,$2)',[r.id,JSON.stringify(files)]);
  for(const [i,f] of manifest.entries()){
   await as('applicant',"insert into storage.objects(bucket_id,name,metadata)values('business-proofs',$1,$2)",[f.path,{size:f.size,mimetype:f.content_type,eTag:'synthetic'}]);
   if(i===0)await assert.rejects(rpc('applicant','biz_partner_request_submit($1,$2)',[r.id,manifest[0].path]),/toate fișierele/);
  }
  assert.equal((await rpc('applicant','biz_partner_request_submit($1,$2)',[r.id,manifest[0].path])).status,'pending');
  assert.equal((await rpc('admin','biz_partner_proof_files($1)',[r.id])).length,2);
  await assert.rejects(rpc('other','biz_partner_proof_file_access($1,2)',[r.id]),/disponibil/);
  assert.equal((await rpc('admin','biz_partner_proof_file_access($1,2)',[r.id])).path,manifest[1].path);
  assert.equal((await as('other','select * from storage.objects where name=$1',[manifest[1].path])).rows.length,0);
  console.log('PASS: two-file dossier → Admin; incomplete uploads and foreign reads denied.');
 }
 for(const photo of [false,true]){

  const r=await rpc('applicant','support_report_create($1,$2,$3,$4,$5,$6,$7)',['issue-'+photo,'issue','business','Problemă test','Descriere sintetică pentru test',null,photo?'image/jpeg':null]);
  assert(!(await rpc('admin','admin_support_reports()')).some(x=>x.id===r.id));
  if(photo)await as('applicant',"insert into storage.objects(bucket_id,name,metadata)values('support-photos',$1,$2)",[r.photo_path,{size:100,mimetype:'image/jpeg',eTag:'synthetic'}]);
  for(let i=0;i<2;i++)assert.equal((await rpc('applicant','support_report_submit($1,$2)',[r.id,r.photo_path??null])).status,'new');
  assert.equal((await rpc('admin','admin_support_reports()')).filter(x=>x.id===r.id).length,1);
  console.log(`PASS: Business issue photo=${photo} → Admin once; draft hidden.`);
 }
 console.log('PASS: actual PostgreSQL Business → Admin delivery; no production data or email writes.');
}finally{
 if(db)await db.end();
 await master.query(`drop database if exists ${dbname} with(force)`);await master.end();
}
