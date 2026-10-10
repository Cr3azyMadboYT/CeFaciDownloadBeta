// Isolated synthetic fixtures: no Supabase request or WebSocket can reach the network.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixtureClaims, fixtureFactors, fixtureSecureStatus, seedCompletedTutorials} from './security-fixtures.mjs';

const root = process.env.CEFACI_TEST_ADMIN_URL ?? 'http://127.0.0.1:4175';
if (!['localhost', '127.0.0.1'].includes(new URL(root).hostname)) throw new Error('Use isolated localhost fixtures.');
fs.mkdirSync('release/screenshots', {recursive: true});
const browser = await chromium.launch({headless: true});
const now = new Date().toISOString();
const uid = '00000000-0000-0000-0000-000000000001';
const issueId = '00000000-0000-0000-0000-000000000101';
const legacyId = '00000000-0000-0000-0000-000000000102';
const partnerId = '00000000-0000-0000-0000-000000000103';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');
const permissions = {
  admin: ['staff.read','places.edit','places.hide','reports.read','reports.close','support.manage','staff.manage','partners','partners.read','operations.read','operations.decide','users.read','plus.manage','suggestions.read','audit.read'],
  suport: ['staff.read','reports.read','support.manage','partners.read','operations.read','users.read','plus.manage'],
  contabil: ['staff.read','partners.read','money','money.read'],
};
const calls = [], unexpected = [], errors = [];
const reports = [
  {origin:'support',id:issueId,kind:'issue',source:'business',title:'Scannerul nu deschide camera',description:'Camera nu pornește pe ecranul Scanner, după alegerea localului.',status:'new',version:2,answer:null,venue_id:'local-test',username:'owner_test',photo_available:true,created_at:now,submitted_at:now},
  {origin:'legacy',id:legacyId,kind:'missing_place',source:'client',title:'Lipsește un loc',description:'LOC NOU: Cafenea de test · Strada Test 1 · București',status:'new',version:1,answer:null,venue_id:null,username:'client_test',photo_available:false,created_at:now},
];
const places = [{id:'local-test',name:'Local de test',cat:'restaurant',lat:44.4268,lon:26.1025,data:{address:'Strada Test 1',city:'București'},edit:{},status:'on',source:'admin',edited_at:null}];
const partnerRequest = {id:partnerId,kind:'claim',status:'pending',venue_id:'local-test',venue_name:'Local de test',applicant_id:uid,applicant_username:'owner_test',details:{requester_name:'Ana Test',requester_role:'Administrator',firm:'Firma Test SRL',cui:'18547290',phone:'0712345678'},proof_available:true,submitted_at:now};
const visit={id:'00000000-0000-0000-0000-000000000104',venue_id:'local-test',venue_name:'Local de test',work_day:'2026-10-09',created_at:now,kind:'drop',people:6,outcome:'deschis',closed_at:null,proof:'staff_ticket',discount_pct:20,discount_scope:'bill',bill:null,discount_amount:null,count:{version:2,people:6,adults:6,drop_adults:4,state:'disputed',deadline:now,reason:'Localul și grupul declară numere diferite.'},benefit:{version:1,state:'pending',reason:'Reducerea promisă nu a fost acordată.',reply:'Verificăm cu echipa.',decision_reason:null}};

function session() {
  const user={id:uid,email:'staff@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:now,factors:fixtureFactors()};
  const access_token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify(fixtureClaims(uid))).toString('base64url')+'.fixture';
  return {access_token,refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
}

async function context({role='admin',auth=true,viewport={width:1440,height:1000},conflict=false,late=false}={}) {
  const ctx=await browser.newContext({viewport});
  const state={role,conflict,late,revoked:false,plusFailed:false,plusKey:null};
  await ctx.routeWebSocket(/supabase\.co/,ws=>ws.close());
  await ctx.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,name=path.split('/').pop();
    if (['localhost','127.0.0.1'].includes(url.hostname)) return route.continue();
    if (url.hostname!=='vqrmwuarjjntusfbqprx.supabase.co') {
      unexpected.push(`External request ${req.method()} ${url.origin}${path}`);return route.abort();
    }
    let p={};try{p=req.postDataJSON()??{};}catch{}
    calls.push({name,path,p,method:req.method(),role:state.role});
    let data=null,status=200;
    if(name==='user')data=session().user;
    else if(name==='logout')data={};
    else if(name==='otp')data={};
    else if(name==='verify')data=session();
    else if(name==='secure_access_status')data={admin_role:state.revoked||!permissions[state.role]?null:state.role,business_access:false};
    else if(['secure_session_status','secure_session_open','secure_session_touch','secure_session_close'].includes(name))data=fixtureSecureStatus(p.p_scope);
    else if(name==='admin_me') {
      if(state.revoked||!permissions[state.role]){status=403;data={message:'Accesul în Admin este rezervat echipei CeFaci.',code:'42501'};}
      else data={user_id:uid,username:'staff_test',role:state.role,permissions:permissions[state.role]};
    }
    else if(name==='admin_launch_interests')data={summary:{total:1,yes:1,maybe:0,no:0,email:1},rows:[{id:issueId,vote:'yes',name:'Vizitator quiz',email:'quiz@example.invalid',created_at:now,email_consent_at:now,expires_at:now,consent_text:'Acord de test pentru anunțul lansării.',notice_version:'launch-test'}]};
    else if(name==='admin_launch_interest_delete')data=null;
    else if(name==='admin_dashboard')data={support_new:1,support_in_progress:0,missing_place_new:0,legacy_new:1,partner_pending:1,places:1093,partners:0,open_visits:1,contested_visits:1,unclosed_visits:1,pending_reservations:1,founder_places:0};
    else if(name==='admin_support_reports') {
      if(state.late)await new Promise(r=>setTimeout(r,1200));
      data=reports.filter(r=>(!p.p_status||r.status===p.p_status)&&(!p.p_kind||r.kind===p.p_kind)&&(!p.p_source||r.source===p.p_source));
    }
    else if(name==='admin_support_report_update'||name==='admin_legacy_report_update') {
      const report=reports.find(r=>r.id===p.p_id);assert(report);
      if(state.conflict){state.conflict=false;status=409;data={message:'Raportarea a fost modificată între timp. Reîncarcă lista.',code:'40001'};}
      else {assert.equal(p.p_version,report.version);report.status=p.p_status;report.answer=p.p_answer;report.version++;data=report;}
    }
    else if(name==='support_report_photo_access')data={bucket:'support-photos',path:`${uid}/${issueId}/photo.png`,expires_in:300};
    else if(name==='biz_partner_proof_access')data={bucket:'business-proofs',path:`${uid}/${partnerId}/proof.png`,expires_in:300};
    else if(/^\/storage\/v1\/object\/(?:authenticated\/)?(?:support-photos|business-proofs)\//.test(path)) {
      assert.equal(req.method(),'GET');assert(req.headers().authorization?.startsWith('Bearer '));
      assert(!path.includes('/public/')&&!path.includes('/sign/'));
      return route.fulfill({status:200,contentType:'image/png',body:png});
    }
    else if(name==='admin_partner_requests')data=(p.p_status??'pending')===partnerRequest.status?[partnerRequest]:[];
    else if(name==='admin_partner_request_decide'){assert.equal(p.p_id,partnerId);partnerRequest.status=p.p_decision;partnerRequest.decision_note=p.p_note;data=partnerRequest;}
    else if(name==='admin_places')data=places.filter(v=>!p.p_query||v.name.toLowerCase().includes(p.p_query.toLowerCase())||v.id===p.p_query);
    else if(name==='admin_place_log')data=[];
    else if(name==='admin_place_save'){const v=places.find(v=>v.id===p.p_id);assert(v);v.edit={...v.edit,...p.p_edit};v.edited_at=now;data=v;}
    else if(name==='admin_place_status'){const v=places.find(v=>v.id===p.p_id);assert(v);v.status=p.p_hidden?'hidden':'on';data=null;}
    else if(name==='admin_partners')data=[];
    else if(name==='admin_operations_summary')data={visits_today:1,reservations_pending:1,counts_awaiting:0,counts_disputed:1,benefits_pending:1,unclosed:1,work_day:'2026-10-09',time_zone:'Europe/Bucharest',day_boundary:'05:00'};
    else if(name==='admin_operations')data={visits:[visit],reservations:[],total_visits:1,total_reservations:0};
    else if(name==='admin_count_resolve_v2'){assert.equal(p.p_visit,visit.id);assert.equal(p.p_version,visit.count.version);visit.count={...visit.count,version:visit.count.version+1,people:p.p_people,adults:p.p_adults,drop_adults:p.p_drop_adults,state:'confirmed',reason:p.p_reason};}
    else if(name==='admin_benefit_decide_v2'){assert.equal(p.p_visit,visit.id);assert.equal(p.p_version,visit.benefit.version);visit.benefit={...visit.benefit,version:visit.benefit.version+1,state:p.p_uphold?'upheld':'dismissed',decision_reason:p.p_reason};}
    else if(name==='admin_finance')data={billing_ready:false,estimate:true,partial:true,missing:1,blocked:1,revenue:100,discounts:20,fee:12,remaining:null,would_pay:0,visits:1,venues:[]};
    else if(name==='admin_staff_list')data=[{user_id:uid,username:'staff_test',first_name:'Ana',role:'admin',added_by:null,created_at:now}];
    else if(name==='admin_activity')data=[];
    else if(name==='admin_partner_suggestions')data=[];
    else if(name==='admin_user_lookup')data={id:'00000000-0000-0000-0000-000000000105',username:p.p_username,first_name:'Ana',plus_until:null,created_at:now,staff_role:null,no_shows:0,plus_grant_allowed:true};
    else if(name==='admin_plus_grant'){
      assert.equal(p.p_days,1);assert(p.p_reason.length>=5);
      if(!state.plusFailed){state.plusFailed=true;state.plusKey=p.p_key;status=503;data={message:'Răspuns pierdut după acordarea zilei Plus.'};}
      else{assert.equal(p.p_key,state.plusKey);data={id:'grant-test',user_id:p.p_user,days:p.p_days,plus_until:now,reason:p.p_reason,created_at:now};}
    }
    else {unexpected.push(`${req.method()} ${path}`);status=418;data={message:`Unexpected fixture endpoint ${name}`};}
    await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
  });
  if(auth)await ctx.addInitScript(s=>sessionStorage.setItem('cefaci-admin-auth',JSON.stringify(s)),session());
  await ctx.addInitScript(seedCompletedTutorials,[{app:'admin',userId:uid,role}]);
  await ctx.addInitScript(()=>{
    window.__objectURLs={created:[],revoked:[]};
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=b=>{const u=create(b);window.__objectURLs.created.push(u);return u;};
    URL.revokeObjectURL=u=>{window.__objectURLs.revoked.push(u);return revoke(u);};
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  return {ctx,page,state};
}

const button=(page,name)=>page.getByRole('button',{name,exact:true});
const opened=[];
try {
  // The login path cannot silently create new accounts; Admin access comes from the staff table.
  const login=await context({auth:false});opened.push(login.ctx);await login.page.goto(root);
  await login.page.getByLabel('Emailul contului CeFaci',{exact:true}).fill('staff@example.invalid');
  await button(login.page,'Trimite codul').click();
  await login.page.getByLabel('Codul primit pe email',{exact:true}).waitFor();
  assert.equal(calls.filter(c=>c.name==='otp').at(-1).p.create_user,false);
  await login.page.screenshot({path:'release/screenshots/admin-login-desktop.png',fullPage:true});

  const denied=await context({role:'ordinary'});opened.push(denied.ctx);await denied.page.goto(root);
  await denied.page.getByText('Acest cont nu are acces la Admin.',{exact:true}).waitFor();
  assert.equal(await button(denied.page,'Semnalări').count(),0);
  assert.equal(calls.some(c=>c.role==='ordinary'&&c.name==='admin_me'),false);

  const admin=await context({conflict:true});opened.push(admin.ctx);const page=admin.page;await page.goto(root);
  await button(page,'Semnalări').waitFor();
  await page.getByText('1093',{exact:true}).waitFor();
  await page.screenshot({path:'release/screenshots/admin-dashboard-desktop.png',fullPage:true});
  await button(page,'Lansare CeFaci').click();await page.getByRole('heading',{name:'Vizitator quiz',exact:true}).waitFor();
  await page.getByText('quiz@example.invalid',{exact:true}).waitFor();await page.screenshot({path:'release/screenshots/admin-launch-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'release/screenshots/admin-launch-phone.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
  await button(page,'Șterge răspunsul').click();assert.equal(calls.filter(c=>c.name==='admin_launch_interest_delete').length,0);await button(page,'Păstrează răspunsul').click();
  await button(page,'Șterge răspunsul').click();await button(page,'Confirmă ștergerea răspunsului').click();await page.getByText('Răspunsul și datele asociate au fost șterse.',{exact:true}).waitFor();assert.equal(calls.filter(c=>c.name==='admin_launch_interest_delete').length,1);
  await button(page,'Semnalări').click();
  await button(page,'Deschide: Scannerul nu deschide camera').click();
  await button(page,'Vezi poza').click();
  await page.getByAltText('Poza problemei raportate',{exact:true}).waitFor();
  const photoURL=await page.getByAltText('Poza problemei raportate',{exact:true}).getAttribute('src');assert(photoURL.startsWith('blob:'));
  await page.getByLabel('Starea cererii',{exact:true}).selectOption('resolved');
  await page.getByLabel('Răspuns pentru solicitant',{exact:true}).fill('Am verificat camera și am corectat problema raportată.');
  await button(page,'Salvează răspunsul').click();
  await page.getByText('Raportarea a fost modificată între timp. Reîncarcă lista.',{exact:false}).waitFor();
  assert.equal(reports[0].version,2);assert.equal(reports[0].answer,null);
  await button(page,'Salvează răspunsul').click();
  await button(page,'Deschide: Scannerul nu deschide camera').waitFor({state:'hidden'});
  assert.equal(reports[0].status,'resolved');assert.equal(reports[0].version,3);
  await button(page,'Deschide: Lipsește un loc').click();
  await page.getByLabel('Starea cererii',{exact:true}).selectOption('resolved');
  await page.getByLabel('Răspuns pentru solicitant',{exact:true}).fill('Localul a fost verificat și adăugat în catalog.');
  await button(page,'Salvează răspunsul').click();
  await button(page,'Deschide: Lipsește un loc').waitFor({state:'hidden'});
  assert.equal(reports[1].status,'resolved');assert.equal(reports[1].answer,'Localul a fost verificat și adăugat în catalog.');
  assert(calls.some(c=>c.name==='admin_legacy_report_update'&&c.p.p_id===legacyId&&c.p.p_version===1));
  await button(page,'Locuri').click();
  assert((await page.evaluate(()=>window.__objectURLs.revoked)).includes(photoURL));
  await button(page,'Editează localul: Local de test').click();
  await page.getByLabel('Telefon',{exact:true}).fill('0712345678');
  await page.getByLabel('Motivul modificării',{exact:true}).fill('Telefon verificat cu reprezentantul localului.');
  await button(page,'Salvează localul').click();
  await button(page,'Editează localul: Local de test').click();
  assert.equal(await page.getByLabel('Telefon',{exact:true}).inputValue(),'0712345678');
  const edit=calls.filter(c=>c.name==='admin_place_save').at(-1);assert.equal(edit.p.p_id,'local-test');assert.equal(edit.p.p_edit.phone,'0712345678');
  assert.equal('lat' in edit.p.p_edit,false);assert.equal('lon' in edit.p.p_edit,false);
  await page.getByLabel('Motivul modificării',{exact:true}).fill('Ascundem temporar localul pentru verificare.');
  await button(page,'Ascunde localul').click();
  await button(page,'Editează localul: Local de test').click();
  await button(page,'Arată localul').waitFor();
  assert(calls.some(c=>c.name==='admin_place_status'&&c.p.p_hidden===true));
  await page.screenshot({path:'release/screenshots/admin-places-desktop.png',fullPage:true});

  await button(page,'Cereri Business').click();await button(page,'Deschide cererea: Local de test').click();
  assert(await button(page,'Verifică dosarul').isDisabled());
  await button(page,'Vezi dovada').click();await page.getByAltText('Dovada solicitantului',{exact:true}).waitFor();
  await page.getByLabel('Am verificat manual firma, reprezentarea și documentul solicitantului.',{exact:true}).check();
  await page.getByLabel('Răspunsul deciziei',{exact:true}).fill('Documentele și firma sunt verificate. Contractul urmează separat.');
  await button(page,'Verifică dosarul').click();await button(page,'Deschide cererea: Local de test').waitFor({state:'hidden'});
  assert.equal(partnerRequest.status,'verified');
  const decision=calls.filter(c=>c.name==='admin_partner_request_decide').at(-1);assert.equal(decision.p.p_firm_verified,true);assert.equal(decision.p.p_decision,'verified');
  assert.equal(calls.some(c=>c.name==='admin_partner_save'||c.name==='staff_set'),false);

  await button(page,'Sosiri').click();await button(page,'Verifică sosirea: '+visit.id).click();
  await page.getByLabel('Persoane confirmate',{exact:true}).fill('5');
  await page.getByLabel('Persoane eligibile de minimum 12 ani',{exact:true}).fill('5');
  await page.getByLabel('Persoane cu sursă Drop',{exact:true}).fill('3');
  await page.getByLabel('Motivul deciziei',{exact:true}).fill('Am verificat numărul cu ambele părți și documentul de sosire.');
  await button(page,'Confirmă numărul').click();await button(page,'Verifică sosirea: '+visit.id).click();
  assert.equal(visit.count.state,'confirmed');assert.equal(visit.count.version,3);
  assert.equal(await button(page,'Confirmă numărul').count(),0);
  await page.getByLabel('Motivul deciziei privind reducerea',{exact:true}).fill('Bonul confirmă lipsa reducerii promise pentru grup.');
  await button(page,'Admite plângerea').click();await button(page,'Verifică sosirea: '+visit.id).click();
  assert.equal(visit.benefit.state,'upheld');assert.equal(visit.benefit.version,2);
  assert.equal(await button(page,'Admite plângerea').count(),0);
  assert.equal(await button(page,'Bani').count(),0);

  await button(page,'Plus').click();await page.getByLabel('Username exact',{exact:true}).fill('client_test');
  await button(page,'Caută utilizatorul').click();await page.getByLabel('Motivul acordării',{exact:true}).fill('Compensare punctuală pentru problema tehnică verificată.');
  await button(page,'Acordă o zi Plus').click();await page.getByText('Răspuns pierdut după acordarea zilei Plus.',{exact:true}).waitFor();
  assert(await page.getByLabel('Motivul acordării',{exact:true}).isDisabled());
  await button(page,'Acordă o zi Plus').click();await button(page,'Zi Plus acordată').waitFor();
  const grants=calls.filter(c=>c.name==='admin_plus_grant');assert.equal(grants.length,2);assert.equal(new Set(grants.map(c=>c.p.p_key)).size,1);

  await page.setViewportSize({width:390,height:844});
  await button(page,'Acasă').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'release/screenshots/admin-dashboard-phone.png',fullPage:true});

  const support=await context({role:'suport'});opened.push(support.ctx);await support.page.goto(root);
  await button(support.page,'Semnalări').waitFor();
  assert.equal(await button(support.page,'Lansare CeFaci').count(),0);
  assert.equal(await button(support.page,'Bani').count(),0);assert.equal(await button(support.page,'Jurnal').count(),0);
  assert.equal(await button(support.page,'Cereri Business').count(),0);
  await button(support.page,'Echipa').click();await support.page.getByRole('heading',{name:'Echipa CeFaci',exact:true}).waitFor();
  assert.equal(await button(support.page,'Salvează rolul').count(),0);

  // Revocation is confirmed against the server, and removes cached private queues immediately.
  await button(page,'Semnalări').click();await page.getByLabel('Stare',{exact:true}).selectOption('resolved');
  await button(page,'Deschide: Scannerul nu deschide camera').click();
  admin.state.revoked=true;await button(page,'Actualizează datele').click();
  await page.getByText('Acest cont nu are acces la Admin.',{exact:true}).waitFor();
  assert.equal(await page.getByText('Scannerul nu deschide camera',{exact:true}).count(),0);

  const stale=await context({late:true});opened.push(stale.ctx);await stale.page.goto(root);
  await button(stale.page,'Semnalări').click();await button(stale.page,'Ieși din cont').click();
  await button(stale.page,'Trimite codul').waitFor();await new Promise(r=>setTimeout(r,1500));
  assert.equal(await button(stale.page,'Deschide: Scannerul nu deschide camera').count(),0);

  const accountant=await context({role:'contabil'});opened.push(accountant.ctx);await accountant.page.goto(root);
  await button(accountant.page,'Bani').waitFor();assert.equal(await button(accountant.page,'Semnalări').count(),0);
  await button(accountant.page,'Bani').click();await accountant.page.getByText('Total parțial',{exact:true}).waitFor();
  assert.equal(calls.some(c=>c.role==='contabil'&&c.name==='admin_support_reports'),false);
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  console.log('PASS: Admin staff access, noncreating OTP, server permissions, real dashboard counts, private attachment/download revocation, optimistic report conflict and reply, accountant/support separation and responsive layout; zero live writes.');
} catch(error) {
  console.error('Admin fixture calls:',calls.slice(-20).map(c=>`${c.method} ${c.path}`));
  console.error('Unexpected intercepted requests:',unexpected);
  for(const ctx of opened)for(const page of ctx.pages())console.error('Synthetic page:',(await page.locator('body').innerText()).slice(-2000));
  throw error;
} finally {
  await Promise.allSettled(opened.map(c=>c.close()));await browser.close();
}
