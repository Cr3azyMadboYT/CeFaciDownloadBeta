// Independent connections and synthetic accounts; never run against a live project.
import {prepareAuthSchema,authenticateFixture,seedAuthFixture} from '../tests/fixtures/auth.mjs';
import pg from 'pg';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const url=process.env.CEFACI_TEST_DATABASE_URL;
if(!url)throw new Error('Setează CEFACI_TEST_DATABASE_URL către PostgreSQL 17 local.');
const target=new URL(url);
if(!['127.0.0.1','localhost'].includes(target.hostname))throw new Error('Testele GDPR sunt limitate la localhost.');
const master=new pg.Client({connectionString:url});await master.connect();
const dbname='cefaci_privacy_test_'+process.pid+'_'+Date.now();let pool,closing=false;
try{
 await master.query(`create database ${dbname}`);target.pathname='/'+dbname;pool=new pg.Pool({connectionString:target.toString(),max:12});
 pool.on('error',e=>{if(!closing||e.code!=='57P01')throw e;});
 await pool.query(`DO $$ BEGIN IF NOT EXISTS(select 1 from pg_roles where rolname='anon')THEN CREATE ROLE anon;END IF;IF NOT EXISTS(select 1 from pg_roles where rolname='authenticated')THEN CREATE ROLE authenticated;END IF;IF NOT EXISTS(select 1 from pg_roles where rolname='service_role')THEN CREATE ROLE service_role;END IF;END $$;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
 create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid()to authenticated;create publication supabase_realtime;`);
 await prepareAuthSchema(pool);
 for(const file of fs.readdirSync('supabase/migrations').sort())await pool.query(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 const run=async(user,sql,args=[],scopes=false)=>{
  const c=await pool.connect();try{
   await c.query('begin');await authenticateFixture(c,user,{local:true,scopes});await c.query('set local role authenticated');
   const r=await c.query(sql,args);await c.query('commit');return r.rows[0]?.r;
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}
 };
 const identity=async(name,role)=>{
  const id=crypto.randomUUID();await pool.query('insert into auth.users(id)values($1)',[id]);await seedAuthFixture(pool,id);
  await run(id,"select complete_signup($1,$1,'1990-01-01')r",[name]);if(role)await pool.query('insert into staff(user_id,role)values($1,$2)',[id,role]);return id;
 };
 const user=await identity('gdprrequester'),a=await identity('gdprreviewera','admin'),b=await identity('gdprreviewerb','admin');
 const key=crypto.randomUUID(),description='Doresc acces la toate datele mele personale aplicabile.';
 const requests=await Promise.all(Array.from({length:8},()=>run(user,"select privacy_request_submit('client','access',$1,$2)r",[description,key])));
 assert.equal(new Set(requests.map(r=>r.id)).size,1);const id=requests[0].id;
 assert.equal((await pool.query('select count(*)::int n from private.privacy_requests where user_id=$1',[user])).rows[0].n,1);
 assert.equal((await pool.query('select count(*)::int n from private.privacy_request_log where request_id=$1',[id])).rows[0].n,1);
 await assert.rejects(run(user,"select privacy_request_submit('business','access',$1,$2)r",[description,key]),/cheie/);
 console.log('PASS: 8 cereri simultane folosesc o singură înregistrare și un singur eveniment; payloadul este imuabil.');
 // Establish the two independent verified reviewer sessions before competing writes.
 await run(a,'select admin_privacy_requests()r',[],true);await run(b,'select admin_privacy_requests()r',[],true);
 const reviews=await Promise.allSettled([
  run(a,"select admin_privacy_request_respond($1,1,'answered','Copiile aplicabile sunt pregătite și răspunsul este înregistrat.')r",[id],true),
  run(b,"select admin_privacy_request_respond($1,1,'refused','Acest refuz este motivat individual și explică dreptul la plângere.')r",[id],true),
 ]);
 assert.equal(reviews.filter(r=>r.status==='fulfilled').length,1);assert.equal(reviews.filter(r=>r.status==='rejected').length,1);
 assert.equal(reviews.find(r=>r.status==='rejected').reason.code,'40001');
 const own=(await run(user,'select privacy_my_requests()r')).find(r=>r.id===id);assert.equal(own.version,2);assert(own.response);
 assert.equal((await pool.query('select count(*)::int n from private.privacy_request_log where request_id=$1',[id])).rows[0].n,2);
 console.log('PASS: răspunsuri concurente au un singur câștigător, conflictul de versiune nu pierde răspunsuri.');
 await pool.query('delete from auth.sessions where user_id=$1',[user]);
 const revoked=await Promise.allSettled(Array.from({length:8},(_,i)=>run(user,i%2?'select privacy_export_my_data()r':'select privacy_my_requests()r')));
 assert(revoked.every(r=>r.status==='rejected'&&r.reason.code==='28000'));
 assert.equal((await pool.query('select count(*)::int n from auth.sessions where user_id=$1',[user])).rows[0].n,0);
 console.log('PASS: 8 citiri/exporturi cu sesiunea revocată sunt respinse și nu recreează sesiunea.');
 await pool.query("update staff set role='suport'where user_id=$1",[a]);
 const downgraded=await Promise.allSettled(Array.from({length:8},(_,i)=>run(a,i%2?'select admin_privacy_request_detail($1)r':'select admin_privacy_requests()r',i%2?[id]:[],true)));
 assert(downgraded.every(r=>r.status==='rejected'&&r.reason.code==='42501'));
 assert.equal((await pool.query('select role from staff where user_id=$1',[a])).rows[0].role,'suport');
 console.log('PASS: retrogradarea Admin la suport blochează imediat toate citirile GDPR cu aceeași sesiune MFA.');
}finally{
 closing=true;if(pool)await pool.end();await master.query(`drop database if exists ${dbname} with(force)`);await master.end();
}
