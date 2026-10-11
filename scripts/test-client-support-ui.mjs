// All remote requests are intercepted. This test never creates production data.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=process.env.CEFACI_TEST_CLIENT_URL??'http://127.0.0.1:4177';
if(!['localhost','127.0.0.1'].includes(new URL(root).hostname))throw new Error('Use localhost fixtures.');
const html=fs.readFileSync(process.env.CEFACI_TEST_CLIENT_DIST??'/tmp/cefaci-client-admin-web/index.html','utf8');
const uid='00000000-0000-0000-0000-000000000701', now=new Date().toISOString();
const user={id:uid,email:'client@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{given_name:'Ana'},created_at:now};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.fixture';
const session={access_token:token,refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const prefs={name:'Ana',user:'client_test',google:uid,zone:'centru',dist:'20',moves:['walk','car'],likes:[],prefsAt:Date.now()};
const board={theme:'zi',calm:true,tut:{on:false},plans:[],xp:150,welcomeXp:true,plus:'locked',savedAt:Date.now()};
const reports=[],calls=[],unexpected=[],errors=[];let failCreate=true;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.routeWebSocket(/supabase\.co/,ws=>ws.close());
await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
  if(['localhost','127.0.0.1'].includes(url.hostname)){
    if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
    return route.continue();
  }
  if(url.hostname!=='vqrmwuarjjntusfbqprx.supabase.co'){unexpected.push(req.url());return route.abort();}
  let p={};try{p=req.postDataJSON()??{};}catch{}
  calls.push({name,p,method:req.method()});let data,status=200;
  if(name==='user')data=user;
  else if(name==='logout')data={};
  else if(name==='profiles')data={id:uid,username:'client_test',first_name:'Ana',xp:150,friend_code:'abcdef'};
  else if(name==='profile_private'){
    if(req.method()==='PATCH')return route.fulfill({status:204});
    data={birth_date:'1990-01-01',prefs,app_state:board,plus_trial_started_at:null};
  }
  else if(name==='weather')data={data:null,updated_at:now};
  else if(['friendships','venues','partner_catalog','my_plus_status','drop_catalog'].includes(name))data=[];
  else if(name==='support_reports')data=reports.filter(r=>r.status!=='cancelled');
  else if(name==='support_report_create'){
    data=reports.find(r=>r.key===p.p_key);
    if(!data){data={origin:'support',id:`00000000-0000-0000-0000-${String(800+reports.length).padStart(12,'0')}`,key:p.p_key,kind:p.p_kind,source:p.p_source,title:p.p_title,description:p.p_description,status:'draft',version:1,created_at:now,updated_at:now,photo_available:false,answer:null};reports.push(data);}
    if(failCreate){failCreate=false;status=503;data={message:'Răspuns pierdut după salvarea ciornei.'};}
  }
  else if(name==='support_report_submit'){data=reports.find(r=>r.id===p.p_id);assert(data);assert.equal(p.p_path,null);data.status='new';data.version=2;}
  else {unexpected.push(`${req.method()} ${url.pathname}`);status=418;data={message:`Unexpected fixture ${name}`};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
});
await context.addInitScript(({session,prefs,board,uid})=>{
  localStorage.setItem('sb-vqrmwuarjjntusfbqprx-auth-token',JSON.stringify(session));
  localStorage.setItem('cefaci.onboarded','1');localStorage.setItem('cefaci.owner',uid);
  localStorage.setItem('cefaci.prefs',JSON.stringify(prefs));localStorage.setItem('cefaci.state',JSON.stringify(board));
},{session,prefs,board,uid});
const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
try{
  await page.goto(root+'/profil');
  await button('Raportează o problemă').click();
  await page.getByLabel('Titlul problemei',{exact:true}).waitFor();
  assert(await button('Trimite problema').isDisabled());
  await page.getByLabel('Titlul problemei',{exact:true}).fill('Problema din Client');
  await page.getByLabel('Descrie problema',{exact:true}).fill('Ecranul nu se actualizează după ce modific preferințele.');
  await button('Trimite problema').click();
  await page.getByText('Răspuns pierdut după salvarea ciornei.',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Titlul problemei',{exact:true}).isEditable(),false);
  await button('Reîncearcă trimiterea').click();
  await page.getByText('Problema a fost trimisă echipei CeFaci. Răspunsul va apărea mai jos.',{exact:true}).waitFor();
  const creates=calls.filter(c=>c.name==='support_report_create');assert.equal(creates.length,2);assert.equal(new Set(creates.map(c=>c.p.p_key)).size,1);assert.equal(creates[0].p.p_source,'client');
  reports[0].status='resolved';reports[0].answer='Problema a fost verificată și rezolvată.';
  await button('Actualizează cererile').click();await page.getByText('Răspuns CeFaci: Problema a fost verificată și rezolvată.',{exact:true}).waitFor();
  fs.mkdirSync('release/screenshots',{recursive:true});await page.screenshot({path:'release/screenshots/client-help-phone.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.goto(root+'/rezultate');await button('Lipsește un loc? Spune-ne').click();
  await page.getByLabel('Numele locului',{exact:true}).fill('Cafeneaua de test');
  await page.getByLabel('Unde e locul',{exact:true}).fill('Strada de test 1');
  await page.getByLabel('De ce merită',{exact:true}).fill('Cafea bună și terasă.');
  await button('Trimite').click();
  await page.getByText('Mersi! Cererea a ajuns la CeFaci. Urmărești răspunsul din Profil → Raportează o problemă.',{exact:true}).waitFor();
  assert.equal(reports.length,2);assert.equal(reports[1].kind,'missing_place');assert.equal(reports[1].status,'new');
  await page.goto(root+'/raporteaza-problema');await page.getByText('Local lipsă: Cafeneaua de test',{exact:true}).waitFor();
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  console.log('PASS: Client Profile entry, required fields, lost-response stable-key retry, own history and Admin answer, responsive layout, missing-place submission and shared history; zero live writes.');
}catch(e){console.error('Fixture unexpected:',unexpected,'Browser errors:',errors);await page.screenshot({path:'/tmp/client-support-failure.png',fullPage:true});throw e;}
finally{await context.close();await browser.close();}
