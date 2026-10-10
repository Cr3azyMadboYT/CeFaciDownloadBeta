// Synthetic Auth/API only; no email, MFA enrollment or real session is created.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixtureClaims,fixtureFactors,fixtureSecureStatus,seedCompletedTutorials} from './security-fixtures.mjs';
const roots={admin:process.env.CEFACI_TEST_ADMIN_URL??'http://127.0.0.1:4175',business:process.env.CEFACI_TEST_WEB_URL??'http://127.0.0.1:4173'};
for(const root of Object.values(roots))assert(['127.0.0.1','localhost'].includes(new URL(root).hostname));
const uid='00000000-0000-4000-8000-000000000123',ms=15*24*60*60*1000,label='Ține-mă minte 15 zile pe acest dispozitiv';
const user={id:uid,email:'remember@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString(),factors:fixtureFactors()};
const session={access_token:'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify(fixtureClaims(uid))).toString('base64url')+'.fixture',refresh_token:'synthetic',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const browser=await chromium.launch({headless:true}),errors=[],unexpected=[];
fs.mkdirSync('release/remember-ui',{recursive:true});
try{
 for(const app of ['admin','business'])for(const mode of ['tab','remember','remember-expiry','registration-failed']){
 const calls=[],ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await ctx.addInitScript(seedCompletedTutorials,[{app:'admin',userId:uid,role:'admin'},{app:'business',userId:uid,role:'applicant'}]);
 await ctx.routeWebSocket(/supabase\.co/,ws=>ws.close());
 await ctx.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();if(url.hostname!=='vqrmwuarjjntusfbqprx.supabase.co'){unexpected.push(url.hostname);return route.abort();}const name=url.pathname.split('/').pop();let p={};try{p=req.postDataJSON()??{};}catch{}calls.push({name,p});let data=null,status=200;
 if(name==='otp'||name==='logout')data={};else if(name==='verify'||name==='token')data=session;else if(name==='user')data=user;
 else if(name==='remember_web_session'){assert.equal(p.p_scope,app);if(mode==='registration-failed'){status=503;data={message:'Test fixture unavailable'};}else data={expires_at:new Date(Date.now()+ms-1000).toISOString()};}
 else if(name==='secure_access_status')data={admin_role:app==='admin'?'admin':null,business_access:false};
 else if(['secure_session_status','secure_session_open','secure_session_close','secure_session_touch'].includes(name))data=fixtureSecureStatus(p.p_scope);
 else if(name==='admin_me')data={user_id:uid,username:'remembertest',role:'admin',permissions:['reports.read']};
 else if(name==='admin_dashboard')data={support_new:0,missing_place_new:0,partner_pending:0,places:1};
 else if(name==='biz_identity_status')data={has_profile:true,username:'remembertest',first_name:'Test'};
 else if(name==='biz_partner_requests')data=[];
 else{unexpected.push(name);return route.abort();}
 return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});});
 let page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(roots[app]);await page.evaluate(()=>document.fonts.ready);
 if(app==='business')await page.getByRole('button',{name:'Ai deja cont? Intră',exact:true}).click();
 const choice=page.getByRole(app==='admin'?'checkbox':'switch',{name:label,exact:true});await choice.waitFor();assert.equal(await choice.isChecked(),false);
 if(mode!=='tab')await choice.check();
 if(app==='admin')await page.getByLabel('Emailul contului CeFaci',{exact:true}).fill(user.email);else await page.getByLabel('Email',{exact:true}).fill(user.email);
 await page.getByRole('button',{name:'Trimite codul',exact:true}).click();const code=page.getByLabel(app==='admin'?'Codul primit pe email':'Codul primit prin email',{exact:true});await code.fill('123456');await page.screenshot({path:`release/remember-ui/${app}-${mode}-login.png`,fullPage:true});await page.getByRole('button',{name:app==='admin'?'Intră în Admin':'Intră',exact:true}).click();
 const ready=async()=>{if(app==='admin')await page.getByRole('button',{name:'Acasă',exact:true}).waitFor();else await page.getByText('Hai să găsim localul tău',{exact:true}).waitFor();};await ready();
 const key=app==='admin'?'cefaci-admin-auth':'cefaci-business-auth';
 if(mode.startsWith('remember')){
  await page.waitForFunction(k=>!!localStorage.getItem(k+'.remember'),key);const marker=await page.evaluate(k=>localStorage.getItem(k+'.remember'),key);assert(await page.evaluate(k=>!!localStorage.getItem(k)&&!sessionStorage.getItem(k),key));
  await page.close();page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));if(mode==='remember-expiry')await page.clock.install();await page.goto(roots[app]);await ready();assert.equal(await page.evaluate(k=>localStorage.getItem(k+'.remember'),key),marker,'Reopening must not extend deadline');
  if(mode==='remember-expiry'){await page.clock.fastForward(ms+1000);}else await page.getByRole('button',{name:'Ieși din cont',exact:true}).click();if(app==='admin')await page.getByRole('button',{name:'Trimite codul',exact:true}).waitFor();else await page.getByRole('button',{name:'Ai deja cont? Intră',exact:true}).waitFor();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),null);assert.equal(await page.evaluate(k=>localStorage.getItem(k+'.remember'),key),null);
 }else{
  if(mode==='registration-failed')await page.getByText('Nu am putut activa „Ține-mă minte”. Contul rămâne autentificat numai în acest tab.',{exact:true}).waitFor();
  assert(await page.evaluate(k=>!!sessionStorage.getItem(k)&&!localStorage.getItem(k),key));const before=calls.filter(c=>c.name==='remember_web_session').length;assert.equal(before,mode==='tab'?0:1);await page.close();page=await ctx.newPage();await page.goto(roots[app]);if(app==='admin')await page.getByRole('button',{name:'Trimite codul',exact:true}).waitFor();else await page.getByRole('button',{name:'Ai deja cont? Intră',exact:true}).waitFor();
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await ctx.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS: Admin/Business opt-in unchecked, tab-only default, server-confirmed persistent login, reopening browser tab without OTP, fixed deadline, open-tab expiry after 15 days, failed-registration fallback, scoped logout and phone layout.');
}finally{await browser.close();}
