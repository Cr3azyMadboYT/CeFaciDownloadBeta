// Browser fixtures intercept all external traffic; no real report, document or email is sent.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixtureClaims,fixtureFactors,fixtureSecureStatus,seedCompletedTutorials} from './security-fixtures.mjs';
const root=process.env.CEFACI_TEST_WEB_URL??'http://127.0.0.1:4173';
if(!['localhost','127.0.0.1'].includes(new URL(root).hostname))throw new Error('Use isolated localhost fixtures.');
const browser=await chromium.launch({headless:true});
fs.mkdirSync('release/screenshots',{recursive:true});
const now=new Date().toISOString(),uid='00000000-0000-0000-0000-000000000201';
const user={id:uid,email:'owner@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:now,factors:fixtureFactors()};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify(fixtureClaims(uid))).toString('base64url')+'.fixture';
const session={access_token:token,refresh_token:'synthetic',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64');
const calls=[],unexpected=[],errors=[],contexts=[];
const legacy={origin:'legacy',id:'00000000-0000-0000-0000-000000000202',kind:'missing_place',source:'client',title:'Lipsește un loc',description:'LOC NOU: Cafeneaua de test · Strada Test 1',status:'resolved',version:2,answer:'Localul a fost verificat și adăugat în catalog.',venue_id:null,photo_available:false,created_at:now,updated_at:now};

async function create({venue=false,failCreate=false,failUpload=false}={}){
  const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);
  const state={reports:[structuredClone(legacy)],failCreate,failUpload,late:false};
  await context.routeWebSocket(/supabase\.co/,ws=>ws.close());
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,name=path.split('/').pop();
    if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
    if(url.hostname!=='vqrmwuarjjntusfbqprx.supabase.co'){unexpected.push(`${req.method()} ${url.origin}${path}`);return route.abort();}
    let p={};try{p=req.postDataJSON()??{};}catch{}
    calls.push({name,path,p,method:req.method()});
    let data=null,status=200;
    if(name==='user')data=user;
    else if(name==='logout')data={};
    else if(name==='secure_access_status')data={admin_role:null,business_access:venue};
    else if(['secure_session_status','secure_session_open','secure_session_touch','secure_session_close'].includes(name))data=fixtureSecureStatus(p.p_scope);
    else if(name==='biz_identity_status')data={has_profile:true,username:'owner_test',first_name:'Ana'};
    else if(name==='biz_partner_requests'||name==='biz_ownership_disputes')data=[];
    else if(name==='biz_my_venues')data=venue?[{venue_id:'local-test',name:'Local de test',role:'proprietar',status:'activ'}]:[];
    else if(name==='biz_dashboard_v2')data={role:'proprietar',day:'2026-10-09',word:'Bilu',token:null,partner:{firm:'Firma Test SRL',cui:'18547290'},settings:{mode:'recommended',on:true,paused:false,capacity:20,duration:120,auto:6,hours:[]},requests:[],visits:[],drops:[],statistics:{visits:0,people:0,unclosed:0,reservations:0},plus_program:null};
    else if(name==='support_reports'){
      const snapshot=structuredClone(state.reports.filter(r=>r.status!=='cancelled'));
      if(state.late)await new Promise(r=>setTimeout(r,1200));
      data=snapshot;
    }
    else if(name==='support_report_create'){
      data=state.reports.find(r=>r.key===p.p_key);
      if(!data){data={origin:'support',id:`00000000-0000-0000-0000-${String(300+state.reports.length).padStart(12,'0')}`,key:p.p_key,kind:p.p_kind,source:p.p_source,title:p.p_title,description:p.p_description,venue_id:p.p_venue,status:'draft',version:1,answer:null,photo_available:false,created_at:now,updated_at:now};if(p.p_photo_mime)data.photo_path=`${uid}/${data.id}/photo.${p.p_photo_mime==='image/jpeg'?'jpg':'png'}`;state.reports.push(data);}
      if(state.failCreate){state.failCreate=false;status=503;data={message:'Răspuns pierdut după salvarea ciornei.'};}
    }
    else if(path.startsWith('/storage/v1/object/support-photos/')){
      assert.equal(req.method(),'POST');assert.equal(req.headers()['x-upsert'],'false');
      assert(path.includes(uid+'/'));assert.equal(req.headers()['content-type'],'image/jpeg');
      const bytes=req.postDataBuffer();assert(bytes.length<=5*1024*1024);assert.deepEqual([...bytes.subarray(0,3)],[255,216,255]);assert.deepEqual([...bytes.subarray(-2)],[255,217]);
      // The original PNG is decoded and recompressed, so original metadata/format is never stored.
      assert(!bytes.equals(png));
      if(state.failUpload){state.failUpload=false;status=503;data={statusCode:'503',message:'Încărcarea pozei este temporar indisponibilă.'};}
      else data={Key:path};
    }
    else if(name==='support_report_submit'){
      data=state.reports.find(r=>r.id===p.p_id);assert(data);assert.equal(p.p_path,data.photo_path??null);data.status='new';data.photo_available=Boolean(p.p_path);data.version=2;
    }
    else if(name==='support_report_cancel'){data=state.reports.find(r=>r.id===p.p_id);assert(data);data.status='cancelled';}
    else {unexpected.push(`${req.method()} ${path}`);status=418;data={message:`Unexpected fixture endpoint ${name}`};}
    await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
  });
  await context.addInitScript(s=>sessionStorage.setItem('cefaci-business-auth',JSON.stringify(s)),session);
  await context.addInitScript(seedCompletedTutorials,[{app:'business',userId:uid,role:'applicant'},{app:'business',userId:uid,role:'proprietar',venueId:'local-test'}]);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  return {page,state,context};
}
const button=(page,name)=>page.getByRole('button',{name,exact:true});
async function fill(page,title='Camera nu pornește',description='Camera nu pornește când deschid scannerul în aplicație.'){
  await page.getByLabel('Titlul problemei',{exact:true}).fill(title);
  await page.getByLabel('Descrie problema',{exact:true}).fill(description);
}
async function choose(page){
  const picker=page.waitForEvent('filechooser');await button(page,'Atașează o poză').click();
  await(await picker).setFiles({name:'poza.png',mimeType:'image/png',buffer:png});
  await page.getByLabel('Poza atașată problemei',{exact:true}).waitFor();
}
try{
  const onboarding=await create({failCreate:true});const page=onboarding.page;await page.goto(root);
  await button(page,'Ajutor · Raportează o problemă').click();await page.getByText('CeFaci este încă în dezvoltare. Ai găsit o problemă? Spune-ne.',{exact:true}).waitFor();
  await page.getByText('Răspuns CeFaci: Localul a fost verificat și adăugat în catalog.',{exact:true}).waitFor();
  assert(await button(page,'Trimite problema').isDisabled());
  await fill(page,'ab','prea mic');assert(await button(page,'Trimite problema').isDisabled());
  const before=calls.filter(c=>c.name==='support_report_create').length;
  await fill(page);await button(page,'Trimite problema').click();
  await page.getByText('Răspuns pierdut după salvarea ciornei.',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Titlul problemei',{exact:true}).isEditable(),false);
  assert(await button(page,'Atașează o poză').isDisabled());
  await button(page,'Reîncearcă trimiterea').click();
  await page.getByText('Problema a fost trimisă echipei CeFaci. Răspunsul va apărea mai jos.',{exact:true}).waitFor();
  const retry=calls.filter(c=>c.name==='support_report_create').slice(before);assert.equal(retry.length,2);assert.equal(new Set(retry.map(c=>c.p.p_key)).size,1);
  assert.equal(retry[0].p.p_source,'business');assert.equal(retry[0].p.p_venue,null);assert.equal(retry[0].p.p_photo_mime,null);
  assert.equal(onboarding.state.reports.filter(r=>r.kind==='issue').length,1);
  onboarding.state.reports.at(-1).status='resolved';onboarding.state.reports.at(-1).answer='Camera a fost verificată și funcționează din nou.';
  await button(page,'Actualizează cererile').click();await page.getByText('Răspuns CeFaci: Camera a fost verificată și funcționează din nou.',{exact:true}).waitFor();
  await page.screenshot({path:'release/screenshots/business-help-history-phone.png',fullPage:true});
  await page.evaluate(()=>{for(const e of document.querySelectorAll('*'))if(e.scrollHeight>e.clientHeight)e.scrollTop=0;});
  await page.screenshot({path:'release/screenshots/business-help-onboarding-phone.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // A lost create response still leaves a real draft in own history, which can be withdrawn.
  onboarding.state.failCreate=true;await fill(page,'Ciornă retrasă','Acest raport de test este retras înainte să fie trimis.');
  await button(page,'Trimite problema').click();await page.getByText('Răspuns pierdut după salvarea ciornei.',{exact:true}).waitFor();
  await button(page,'Actualizează cererile').click();await button(page,'Retrage ciorna').click();
  await page.getByText('Ciorna a fost retrasă.',{exact:true}).waitFor();
  assert.equal(onboarding.state.reports.at(-1).status,'cancelled');
  await page.waitForFunction(()=>{
    const input=document.querySelector('[aria-label="Titlul problemei"]');
    return input&&!input.disabled&&!input.readOnly;
  });
  assert.equal(await page.getByLabel('Titlul problemei',{exact:true}).isEditable(),true);
  assert.equal(await page.getByLabel('Titlul problemei',{exact:true}).inputValue(),'');
  assert.equal(await button(page,'Retrage ciorna').count(),0);

  const workspace=await create({venue:true,failUpload:true});const desktop=workspace.page;await desktop.setViewportSize({width:1440,height:1000});await desktop.goto(root);
  await button(desktop,'Ajutor').click();await fill(desktop,'Problema cu poza','Imaginea explică problema apărută în scanner.');
  const invalidPicker=desktop.waitForEvent('filechooser');await button(desktop,'Atașează o poză').click();
  await(await invalidPicker).setFiles({name:'poza.txt',mimeType:'text/plain',buffer:Buffer.from('This is not an image.')});
  await desktop.getByText('Nu am putut pregăti poza. Alege o imagine JPEG sau PNG validă.',{exact:true}).waitFor();
  assert.equal(await desktop.getByLabel('Poza atașată problemei',{exact:true}).count(),0);
  assert.equal(calls.filter(c=>c.name==='support_report_create'&&c.p.p_title==='Problema cu poza').length,0);
  await choose(desktop);
  await button(desktop,'Trimite problema').click();await desktop.getByText('Încărcarea pozei este temporar indisponibilă.',{exact:true}).waitFor();
  assert(await button(desktop,'Schimbă poza').isDisabled());
  const photoCalls=calls.filter(c=>c.name==='support_report_create'&&c.p.p_title==='Problema cu poza');
  await button(desktop,'Reîncearcă trimiterea').click();await desktop.getByText('Problema a fost trimisă echipei CeFaci. Răspunsul va apărea mai jos.',{exact:true}).waitFor();
  const retriedPhoto=calls.filter(c=>c.name==='support_report_create'&&c.p.p_title==='Problema cu poza');assert.equal(retriedPhoto.length,2);assert.equal(new Set(retriedPhoto.map(c=>c.p.p_key)).size,1);
  assert.equal(photoCalls[0].p.p_venue,'local-test');assert.equal(photoCalls[0].p.p_photo_mime,'image/jpeg');assert(workspace.state.reports.at(-1).photo_available);
  await desktop.evaluate(()=>{for(const e of document.querySelectorAll('*'))if(e.scrollHeight>e.clientHeight)e.scrollTop=0;});
  await desktop.screenshot({path:'release/screenshots/business-help-desktop.png',fullPage:true});

  // A response belonging to a signed-out account must never restore private history.
  workspace.state.late=true;await button(desktop,'Actualizează cererile').click();
  await button(desktop,'Ieși din cont').click();await button(desktop,'Ai deja cont? Intră').waitFor();
  await new Promise(r=>setTimeout(r,1500));
  assert.equal(await desktop.getByText('Problema cu poza',{exact:true}).count(),0);
  assert.equal(await desktop.getByText('Cererile și problemele tale',{exact:true}).count(),0);
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  console.log('PASS: Business Ajutor before partnership and in workspace, required fields, optional photo recompression/private immutable upload, lost create/upload retries with stable keys, legacy missing-place answer, own report/status/answer history, responsive layout and stale result after logout; zero live writes.');
}finally{await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();}
