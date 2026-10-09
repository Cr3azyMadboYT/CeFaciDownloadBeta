// Local synthetic Auth/API only. Never enrolls a factor or sends mail to a real account.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const roots={admin:process.env.CEFACI_TEST_ADMIN_URL??'http://127.0.0.1:4175',business:process.env.CEFACI_TEST_WEB_URL??'http://127.0.0.1:4173'};
for(const root of Object.values(roots))assert(['localhost','127.0.0.1'].includes(new URL(root).hostname));
const browser=await chromium.launch({headless:true}), opened=[], fixtures=[], errors=[], unexpected=[];
fs.mkdirSync('release/screenshots',{recursive:true});
const uid='70000000-0000-0000-0000-000000000001',sid='71000000-0000-0000-0000-000000000001',fid='72000000-0000-0000-0000-000000000001';
const now=new Date().toISOString(),epoch=()=>Math.floor(Date.now()/1000);
const permissions={fondator:['staff.read','places.edit','places.hide','reports.read','reports.close','support.manage','staff.manage','partners','partners.read','founder','money','operations.read','operations.decide','money.read','users.read','plus.manage','suggestions.read','audit.read'],admin:['staff.read','places.edit','places.hide','reports.read','reports.close','support.manage','staff.manage','partners','partners.read','operations.read','operations.decide','users.read','plus.manage','suggestions.read','audit.read'],editor:['staff.read','places.edit','places.hide','reports.read','reports.close','suggestions.read'],moderator:['staff.read','places.hide','reports.read','reports.close','users.read'],suport:['staff.read','reports.read','support.manage','partners.read','operations.read','users.read','plus.manage'],contabil:['staff.read','partners.read','money','money.read']};
function auth(state){
 const user={id:uid,email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{role:'fondator'},created_at:now,factors:state.factor?[{id:fid,factor_type:'totp',status:state.factor,friendly_name:'CeFaci test',created_at:now,updated_at:now}]:[]};
 const access_token='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+Buffer.from(JSON.stringify({sub:uid,session_id:sid,exp:epoch()+3600,iat:epoch(),role:'authenticated',aal:state.aal,amr:state.aal==='aal2'?[{method:'totp',timestamp:state.proof}]:[{method:'otp',timestamp:epoch()}]})).toString('base64url')+'.fixture';
 return {access_token,refresh_token:'synthetic',expires_in:3600,expires_at:epoch()+3600,token_type:'bearer',user};
}
async function fixture(app,{role=app==='admin'?'fondator':'proprietar',aal='aal1',factor=null,active=false,mobile=false,done=false}={}){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},reducedMotion:'reduce'});opened.push(context);
 const state={app,role,aal,factor,proof:epoch()-5,cutoff:0,active,deadline:Date.now()+300000,revoked:false,calls:[],wrong:0};
 await context.routeWebSocket(/supabase\.co/,ws=>ws.close());
 const secure=()=>({scope:app,active:state.active&&!state.revoked&&Date.now()<state.deadline,reason:state.revoked?'role_revoked':state.active&&Date.now()>=state.deadline?'expired':state.active?null:'not_open',reauthentication_required:!state.active||Date.now()>=state.deadline,idle_expires_at:new Date(state.deadline).toISOString(),expires_at:new Date(state.deadline).toISOString(),absolute_expires_at:new Date(Date.now()+3600000).toISOString()});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,name=path.split('/').pop();
  if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
  if(url.hostname!=='vqrmwuarjjntusfbqprx.supabase.co'){unexpected.push(url.origin+path);return route.abort();}
  let p={};try{p=req.postDataJSON()??{};}catch{}
  state.calls.push({name,path,p,method:req.method()});let data=null,status=200;
  if(name==='secure_access_status')data={admin_role:app==='admin'&&!state.revoked&&permissions[state.role]?state.role:null,business_access:app==='business'&&!state.revoked};
  else if(name==='secure_session_status')data=secure();
  else if(name==='secure_session_open'){
   if(state.aal!=='aal2'||state.factor!=='verified'||state.proof<=state.cutoff){data={...secure(),active:false,reason:'fresh_mfa_required',reauthentication_required:true};}
   else{state.active=true;state.deadline=Date.now()+300000;data=secure();}
  }
  else if(name==='secure_session_touch'){data=secure();if(data.active){state.deadline=Date.now()+300000;data=secure();}}
  else if(name==='secure_session_close'){state.active=false;state.cutoff=state.proof;data={...secure(),reason:'closed'};}
  else if(name==='user')data=auth(state).user;
  else if(name==='logout')data={};
  else if(path==='/auth/v1/factors'&&req.method()==='POST'){
   state.factor='unverified';data={id:fid,type:'totp',totp:{secret:'JBSWY3DPEHPK3PXP',qr_code:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="white"/><path d="M1 1h20v20H1z" fill="black"/></svg>',uri:'otpauth://totp/Synthetic?secret=JBSWY3DPEHPK3PXP'}};
  }
  else if(path===`/auth/v1/factors/${fid}/challenge`)data={id:'challenge-fixture',expires_at:epoch()+60};
  else if(path===`/auth/v1/factors/${fid}/verify`){
   if(p.code!=='123456'){state.wrong++;status=422;data={error_code:'mfa_verification_failed',msg:'Invalid code'};}
   else{state.factor='verified';state.aal='aal2';state.proof=Math.max(epoch(),state.cutoff+1);data=auth(state);}
  }
  else if(path===`/auth/v1/factors/${fid}`&&req.method()==='DELETE'){assert.equal(state.factor,'unverified');state.factor=null;data={id:fid};}
  else if(name==='admin_me'&&state.revoked){status=403;data={message:'Accesul în Admin este rezervat echipei CeFaci.',code:'42501'};}
  else if(name==='admin_me')data={user_id:uid,username:'synthetic',role:state.role,permissions:permissions[state.role]??[]};
  else if(name==='admin_dashboard')data={support_new:0,support_in_progress:0,missing_place_new:0,legacy_new:0,partner_pending:0,places:1};
  else if(name==='admin_operations_summary')data={visits_today:0,reservations_pending:0,counts_awaiting:0,counts_disputed:0,benefits_pending:0,unclosed:0};
  else if(name==='admin_operations')data={visits:[],reservations:[],total_visits:0,total_reservations:0};
  else if(name==='admin_finance'||name==='biz_finance_v2')data={billing_ready:false,estimate:true,partial:false,missing:0,blocked:0,revenue:0,discounts:0,fee:0,remaining:0,would_pay:0,visits:0,venues:[],lines:[]};
  else if(name==='biz_identity_status')data={has_profile:true,username:'synthetic',first_name:'Test'};
  else if(name==='biz_my_venues')data=[{venue_id:'security-one',name:'Local sintetic',role:state.role,status:'active',founder:false,rate:0.1,free_until:null}];
  else if(name==='biz_dashboard_v2')data={role:state.role,day:'2026-10-09',word:'Bilu',token:null,partner:{firm:'Firmă sintetică',cui:'18547290'},settings:{mode:'recommended',on:true,paused:false,capacity:20,duration:120,auto:6,hours:[]},requests:[],visits:[],drops:[],statistics:{visits:0,people:0,unclosed:0,reservations:0},plus_program:{current_pct:0,base_pct:0,current_schedule:[],today_off:false,off_days_this_month:0,next:null}};
  else if(['admin_support_reports','admin_partner_requests','admin_places','admin_partners','admin_staff_list','admin_activity','admin_partner_suggestions','biz_ownership_disputes','biz_partner_requests','biz_team','support_reports'].includes(name))data=[];
  else{unexpected.push(`${req.method()} ${path}`);status=418;data={message:`Unexpected ${name}`};}
  await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
 });
 await context.addInitScript(({session,app,role,done})=>{
  sessionStorage.setItem(`cefaci-${app}-auth`,JSON.stringify(session));
  if(done)localStorage.setItem(['cefaci',app,'tutorial','1',session.user.id,role,app==='business'?'security-one':''].map(encodeURIComponent).join(':'),'done');
 },{session:auth(state),app,role,done});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);await page.goto(roots[app]);
 const result={page,state,context};fixtures.push(result);return result;
}
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const privateCalls=s=>s.calls.filter(c=>c.name==='admin_dashboard'||c.name==='biz_my_venues'||c.name==='biz_dashboard_v2');
async function verify(page,code='123456'){await page.getByLabel('Codul din aplicația de autentificare',{exact:true}).fill(code);await button(page,'Verifică și continuă').click();}
async function tour(page){
 await button(page,'Arată-mi!').waitFor();await button(page,'Arată-mi!').click();
 for(let i=0;i<20;i++){
  if(await button(page,'Hai la treabă!').count()){await button(page,'Hai la treabă!').click();return;}
  await button(page,'Mai departe').click();
 }
 throw new Error('Tutorial did not finish');
}
try{
 const denied=await fixture('admin',{role:'ordinary',aal:'aal2',factor:'verified'});
 await denied.page.getByRole('heading',{name:'Acest cont nu are acces la Admin.',exact:true}).waitFor();
 assert.equal(privateCalls(denied.state).length,0);assert(!denied.state.calls.some(c=>c.path.includes('/factors')));
 for(const app of ['admin','business']){
  const f=await fixture(app,{mobile:app==='business',done:true});
  await button(f.page,'Configurează autentificarea').waitFor();assert.equal(privateCalls(f.state).length,0);assert(!f.state.calls.some(c=>c.path==='/auth/v1/factors'));
  await f.page.screenshot({path:`release/screenshots/${app}-mfa-setup.png`,fullPage:true});
  await button(f.page,'Configurează autentificarea').click();await button(f.page,'Arată cheia manuală').click();
  assert((await f.page.textContent('body')).includes('JBSWY3DPEHPK3PXP')||await f.page.getByLabel('Cheia de configurare').count());
  await f.page.getByLabel('Codul din aplicația de autentificare',{exact:true}).fill('000000');await button(f.page,'Activează protecția').click();
  await f.page.getByText('Codul nu este valid sau a expirat.',{exact:false}).waitFor();assert.equal(privateCalls(f.state).length,0);
  await f.page.getByLabel('Codul din aplicația de autentificare',{exact:true}).fill('123456');await button(f.page,'Activează protecția').click();
  await button(f.page,'Tur cu Bilu').waitFor();assert(privateCalls(f.state).length>0);assert(!(await f.page.textContent('body')).includes('JBSWY3DPEHPK3PXP'));
  assert.equal(await f.page.evaluate(app=>localStorage.getItem(`cefaci-${app}-auth`),app),null);
  f.state.deadline=Date.now()+800;await f.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await button(f.page,'Verifică și continuă').waitFor();assert.equal(await button(f.page,'Tur cu Bilu').count(),0);
  const opens=f.state.calls.filter(c=>c.name==='secure_session_open').length;
  await f.page.waitForTimeout(100);assert.equal(f.state.calls.filter(c=>c.name==='secure_session_open').length,opens);
  await verify(f.page);await button(f.page,'Tur cu Bilu').waitFor();
  await f.page.screenshot({path:`release/screenshots/${app}-secured-dashboard.png`,fullPage:true});
  f.state.revoked=true;await f.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  if(app==='admin')await f.page.getByRole('heading',{name:'Acest cont nu are acces la Admin.',exact:true}).waitFor();
  else await button(f.page,'Tur cu Bilu').waitFor();
 }
 for(const role of Object.keys(permissions)){
  const f=await fixture('admin',{role,aal:'aal2',factor:'verified',active:true,mobile:role==='suport'});
  await f.page.getByRole('dialog').waitFor();assert((await f.page.textContent('body')).includes(`rolul de ${role==='admin'?'administrator':role}`));
  await tour(f.page);assert.equal(await f.page.getByRole('dialog').count(),0);
  const marker=await f.page.evaluate(({uid,role})=>localStorage.getItem(['cefaci','admin','tutorial','1',uid,role,''].map(encodeURIComponent).join(':')),{uid,role});assert.equal(marker,'done');
  await button(f.page,'Tur cu Bilu').click();await button(f.page,'Arată-mi!').waitFor();await button(f.page,'Închide turul').click();
  assert(!f.state.calls.some(c=>/_(save|change|update|decide|grant|set)$/.test(c.name)));
  await f.page.screenshot({path:`release/screenshots/admin-role-${role}.png`,fullPage:true});
 }
 for(const role of ['proprietar','manager','receptie','scanare']){
  const f=await fixture('business',{role,aal:'aal2',factor:'verified',active:true,mobile:true});
  await button(f.page,'Arată-mi!').waitFor();await tour(f.page);
  if(['receptie','scanare'].includes(role))assert.equal(await button(f.page,'Financiar').count(),0);
  if(role==='scanare')assert.equal(await button(f.page,'Rezervări').count(),0);
  await button(f.page,'Tur cu Bilu').click();await button(f.page,'Arată-mi!').waitFor();await button(f.page,'Închide turul').click();
  assert(!f.state.calls.some(c=>/_(save|change|update|decide|grant|set|scan_v2)$/.test(c.name)));
  await f.page.screenshot({path:`release/screenshots/business-role-${role}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 console.log('PASS: MFA enrollment/wrong code/fresh challenge/expiry/role revocation; no private fetch before gate; 6 Admin + 4 Business role tutorials, replay and no data mutation.');
}catch(error){for(const f of fixtures){console.error(f.state.app, f.state.role, f.state.aal, f.state.factor, f.state.active, f.state.calls.map(c=>c.name));console.error((await f.page.textContent('body')).slice(-2200));}throw error;}finally{for(const context of opened)await context.close();await browser.close();}
