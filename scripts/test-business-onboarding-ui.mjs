// All HTTP/WebSocket calls to Supabase are intercepted. These tests never send email or live documents.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixtureClaims,fixtureFactors,fixtureSecureStatus,seedCompletedTutorials} from './security-fixtures.mjs';
const root = process.env.CEFACI_TEST_WEB_URL ?? 'http://127.0.0.1:4173';
if (!['localhost','127.0.0.1'].includes(new URL(root).hostname)) throw new Error('Use isolated localhost fixtures.');
const browser = await chromium.launch({headless:true});
const user = {id:'00000000-0000-0000-0000-000000000011',email:'owner@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString(),factors:fixtureFactors()};
const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify(fixtureClaims(user.id))).toString('base64url') + '.fixture';
const session = {access_token:token,refresh_token:'synthetic',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const calls = [], requests = [];
const unexpected = [];
let failUpload = true, profileReady = false;
const context = await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(seedCompletedTutorials,[{app:'business',userId:user.id,role:'applicant'}]);
await context.routeWebSocket(/supabase\.co/, ws=>ws.close());
await context.route('**/*', async route=>{
  const req=route.request(), url=new URL(req.url()), path=url.pathname, name=path.split('/').pop();
  if (['localhost','127.0.0.1'].includes(url.hostname)) return route.continue();
  if (url.hostname!=='vqrmwuarjjntusfbqprx.supabase.co') {unexpected.push(`${req.method()} ${url.origin}${path}`);return route.abort();}
  let p={};try {p=req.postDataJSON()??{};} catch {}
  calls.push({name,path,p,method:req.method()});
  let data=null,status=200;
  if (name==='otp') data={};
  else if (name==='verify') data=session;
  else if (name==='user') data=user;
  else if (name==='logout') data={};
  else if (name==='secure_access_status') data={admin_role:null,business_access:false};
  else if (['secure_session_status','secure_session_open','secure_session_touch','secure_session_close'].includes(name)) data=fixtureSecureStatus(p.p_scope);
  else if (name==='biz_identity_status') data={has_profile:profileReady,username:profileReady?'patron_test':null,first_name:profileReady?'Ana':null};
  else if (name==='biz_identity_complete') { profileReady=true;data={has_profile:true,username:p.p_username,first_name:p.p_first_name}; }
  else if (name==='biz_my_venues') data=[];
  else if (name==='biz_partner_requests') data=requests;
  else if (name==='biz_venue_search') data=p.p_query==='Lipsa'?[]:[{id:'unclaimed',name:'Local disponibil',address:'Strada Test 1',city:'București',claimed:false},{id:'claimed',name:'Local revendicat',address:'Strada Test 2',city:'București',claimed:true}];
  else if (name==='biz_partner_request_create') {
    data=requests.find(r=>r.key===p.p_key);
    if(!data) {data={id:`00000000-0000-0000-0000-${String(requests.length+1).padStart(12,'0')}`,key:p.p_key,kind:p.p_kind,venue_id:p.p_venue,venue_name:p.p_venue==='claimed'?'Local revendicat':p.p_venue==='unclaimed'?'Local disponibil':p.p_details.venue_name,details:p.p_details,status:'draft',created_at:new Date().toISOString()}; requests.push(data);}
  }
  else if (path.includes('/storage/v1/object/business-proofs/')) {
    assert(path.includes(user.id+'/'));assert.equal(req.headers()['x-upsert'],'false');
    assert.equal(req.headers()['content-type'],'application/pdf');
    assert(req.postDataBuffer().subarray(0,5).equals(Buffer.from('%PDF-')));
    if(failUpload) {failUpload=false;status=503;data={statusCode:'503',message:'Încărcarea este temporar indisponibilă'};}
    else data={Key:path};
  }
  else if (name==='biz_partner_request_submit') { data=requests.find(r=>r.id===p.p_id);assert(p.p_path.endsWith('/proof.pdf'));data.status='pending';if(data.kind==='dispute')data.owner_response_deadline=new Date(Date.now()+3*86400000).toISOString(); }
  else if (name==='biz_partner_request_cancel') { data=requests.find(r=>r.id===p.p_id);data.status='cancelled'; }
  else throw new Error(`Unexpected backend call ${req.method()} ${path}`);
  await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
async function fillCompany(){
  for(const [label,value] of [['Numele tău complet','Ana Test'],['Rolul tău în firmă','Administrator'],['Denumirea firmei','Firma Test SRL'],['CUI','18547290'],['Telefonul tău de contact','0712345678']]) await page.getByLabel(label,{exact:true}).fill(value);
}
async function chooseDocument(valid=true){
  const choice=page.waitForEvent('filechooser');
  await button('Încarcă documentul').click();
  await (await choice).setFiles({name:'certificat.pdf',mimeType:'application/pdf',buffer:Buffer.from(valid?'%PDF-1.7\n% Synthetic local verification proof\n%%EOF':'<html>renamed file</html>')});
}
try {
  await page.goto(root);
  await button('Revendică localul').waitFor();
  await page.screenshot({path:'release/screenshots/business-entry-phone.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await button('Mod noapte').click();
  await page.screenshot({path:'release/screenshots/business-entry-phone-night.png',fullPage:true});
  await button('Mod zi').click();await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'release/screenshots/business-entry-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await button('Ai deja cont? Intră').click();
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await button('Trimite codul').click();await page.getByLabel('Codul primit prin email',{exact:true}).waitFor();
  assert.equal(calls.filter(c=>c.name==='otp').at(-1).p.create_user,false);
  await button('Înapoi').click();await button('Revendică localul').click();
  await button('Trimite codul').click();await page.getByLabel('Codul primit prin email',{exact:true}).waitFor();
  assert.equal(calls.filter(c=>c.name==='otp').at(-1).p.create_user,true);
  await page.getByLabel('Codul primit prin email',{exact:true}).fill('123456');await button('Intră').click();
  await button('Revendică localul').waitFor();
  // A new Business account can complete its real CeFaci profile here; no invented birth date.
  const profileCard=page.getByText('Completează contul CeFaci',{exact:true});
  await profileCard.waitFor();
  {
    await page.getByLabel('Prenume',{exact:true}).fill('Ana');
    await page.getByLabel('Username CeFaci',{exact:true}).fill('patron_test');
    await page.getByLabel('Data nașterii (AAAA-LL-ZZ)',{exact:true}).fill('1990-01-01');
    await button('Salvează profilul contului').click();
    await page.waitForFunction(()=>!document.body.innerText.includes('Salvează profilul contului'));
    assert(calls.some(c=>c.name==='biz_identity_complete'&&c.p.p_birth_date==='1990-01-01'));
  }
  await button('Revendică localul').click();await page.getByLabel('Numele localului sau orașul',{exact:true}).fill('Lipsa');await button('Caută').click();
  await page.getByText('Nu am găsit un local pentru această căutare.',{exact:false}).waitFor();
  await button('Nu găsesc localul · Solicit adăugarea').click();
  for(const [label,value] of [['Numele localului','Local nou de test'],['Adresa completă','Strada Test 3'],['Oraș','București'],['Categoria localului','Restaurant']]) await page.getByLabel(label,{exact:true}).fill(value);
  await fillCompany();assert(await button('Trimite cererea pentru verificare').isDisabled());
  await chooseDocument(false);await page.getByText('Tipul fișierului nu este recunoscut.',{exact:false}).waitFor();assert.equal(calls.filter(c=>c.name==='biz_partner_request_create').length,0);
  await chooseDocument();await page.getByText('certificat.pdf',{exact:false}).waitFor();
  await button('Trimite cererea pentru verificare').click();await page.getByText('Încărcarea este temporar indisponibilă',{exact:false}).waitFor();
  assert(await button('Schimbă documentul').isDisabled());
  await button('Trimite cererea pentru verificare').click();
  await page.getByText('Adăugare local · În verificare',{exact:true}).waitFor();
  const newCalls=calls.filter(c=>c.name==='biz_partner_request_create');assert.equal(new Set(newCalls.map(c=>c.p.p_key)).size,1);assert.equal(requests.length,1);assert.equal(requests[0].kind,'new');
  await page.screenshot({path:'release/screenshots/business-onboarding-pending-phone.png',fullPage:true});
  await button('Revendică localul').click();await page.getByLabel('Numele localului sau orașul',{exact:true}).fill('Local');await button('Caută').click();
  await button('Deschide dispută').click();await page.getByText('Proprietarul actual are 3 zile să răspundă',{exact:false}).first().waitFor();
  await fillCompany();assert(await button('Trimite cererea pentru verificare').isDisabled());await chooseDocument();await button('Trimite cererea pentru verificare').click();
  await page.getByText('Dispută · În verificare',{exact:true}).waitFor();assert.equal(requests.at(-1).kind,'dispute');assert.equal(requests.at(-1).venue_id,'claimed');
  await button('Revendică localul').click();await page.getByLabel('Numele localului sau orașul',{exact:true}).fill('Local');await button('Caută').click();
  await button('Acesta este localul meu').click();await fillCompany();await chooseDocument();await button('Trimite cererea pentru verificare').click();
  await page.getByText('Revendicare · În verificare',{exact:true}).waitFor();assert.equal(requests.at(-1).kind,'claim');
  requests[0].status='verified';requests[0].decision_note='Document verificat; contractul urmează separat.';
  await button('Actualizează cererile și accesul').click();await page.getByText('contract și activare în așteptare',{exact:false}).waitFor();
  assert.equal(await button('Financiar').count(),0);assert.equal(await button('Scanner').count(),0);
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'release/screenshots/business-onboarding-requests-desktop.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await button('Retrage cererea').first().click();await page.getByText('Cerere retrasă',{exact:false}).waitFor();
  await button('Ieși din cont').click();await button('Ai deja cont? Intră').waitFor();assert.equal(await page.getByText('Cererile tale',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);assert.equal(calls.filter(c=>c.name==='complete_signup').length,0);
  assert.deepEqual(unexpected,[]);
  assert.equal(calls.filter(c=>c.name==='biz_my_venues').length,0,'Pending applicants never query protected venue access.');
  console.log('PASS: existing/new OTP options, missing-venue request, claim/dispute proof, invalid document, upload retry/idempotence, statuses/cancel, no premature access, responsive layout and logout; zero live writes.');
}finally{await context.close();await browser.close();}
