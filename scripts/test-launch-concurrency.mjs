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
const dbname='cefaci_launch_test_'+process.pid+'_'+Date.now();let pool,closing=false;
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
 const proof=token=>{for(let i=0;;i++)if(crypto.createHash('sha256').update(token+':'+i).digest('hex').startsWith('000'))return ''+i;};
 const anon=async(sql,args=[])=>{const c=await pool.connect();try{await c.query('begin');await c.query('set local role anon');const r=await c.query(sql,args);await c.query('commit');return r.rows[0]?.r;}catch(e){await c.query('rollback');throw e;}finally{c.release();}};
 const submitSql="select launch_interest_submit($1,$2,'yes','Concurrent tester','test@example.invalid',true,true)r";
 const token=crypto.randomUUID(),nonce=proof(token);
 const all=await Promise.all(Array.from({length:8},()=>anon(submitSql,[token,nonce])));assert(all.every(r=>r.saved));assert.equal((await pool.query('select count(*)::int n from private.launch_interests')).rows[0].n,1);assert.equal((await pool.query('select sum(submissions)::int n from private.launch_quotas')).rows[0].n,1);
 console.log('PASS: 8 concurrent submissions produce one vote, one consent and one quota increment.');
 const r=await Promise.allSettled([anon('select launch_interest_withdraw($1,$2)r',[token,nonce]),...Array.from({length:8},()=>anon(submitSql,[token,nonce]))]);assert.equal(r[0].status,'fulfilled');assert.equal((await pool.query('select count(*)::int n from private.launch_interests')).rows[0].n,0);await assert.rejects(anon(submitSql,[token,nonce]),/retrasă/);
 console.log('PASS: concurrent withdrawal wins against retries; deleted consent never reappears.');
 await pool.query('update private.launch_quotas set submissions=99');const tokens=Array.from({length:8},()=>crypto.randomUUID());const race=await Promise.allSettled(tokens.map(t=>anon(submitSql,[t,proof(t)])));assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal((await pool.query('select sum(submissions)::int n from private.launch_quotas')).rows[0].n,100);
 console.log('PASS: shared submission cap is atomic across connections.');
 const reviewer=await identity('launchreviewer','admin');const records=await run(reviewer,'select admin_launch_interests()r',[],true);assert.equal(records.rows.length,1);await pool.query("update staff set role='suport'where user_id=$1",[reviewer]);await assert.rejects(run(reviewer,'select admin_launch_interests()r',[],true),/Nu ai voie/);
 console.log('PASS: private list authorized with MFA; role downgrade takes effect immediately.');
}finally{
 closing=true;if(pool)await pool.end();await master.query(`drop database if exists ${dbname} with(force)`);await master.end();
}
