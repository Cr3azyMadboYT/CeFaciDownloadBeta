// Isolated public-site UI tests. No requests to live application/Auth services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
const directory=path.resolve('website/dist');
assert.ok(fs.existsSync(directory+'/index.html'),'Build the complete public site first.');
const csp="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'";
let server;let root=process.env.CEFACI_TEST_SITE_URL;
if(root&&!['localhost','127.0.0.1'].includes(new URL(root).hostname))throw new Error('Only localhost test fixtures are allowed.');
if(!root){
  server=http.createServer((request,response)=>{
    let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400).end();return;}
    let file=path.resolve(directory,'.'+pathname);
    if(file!==directory&&!file.startsWith(directory+path.sep)){response.writeHead(403).end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    let status=200;if(!fs.existsSync(file)||!fs.statSync(file).isFile()){file=directory+'/404.html';status=404;}
    const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'};
    response.writeHead(status,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));root='http://127.0.0.1:'+server.address().port;
}
const headers=process.env.CEFACI_TEST_PROXY_HTTPS==='1'?{'X-Forwarded-Proto':'https'}:{};
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light',reducedMotion:'reduce',extraHTTPHeaders:headers});
  const page=await context.newPage();const errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  context.on('request',request=>{if(new URL(request.url()).origin!==new URL(root).origin)external.push(request.url());});
  await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(root).origin?route.continue():route.abort());
  const response=await page.goto(root);assert.equal(response.status(),200);assert.match(response.headers()['content-security-policy'],/connect-src 'none'/);
  await page.evaluate(()=>document.fonts.ready);await page.getByRole('heading',{name:'Planuri bune. Oameni faini. Hai că mergem.'}).waitFor();
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto','Reduced motion disables smooth scrolling');
  for(const asset of await page.locator('[src]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('src'))))if(asset.startsWith('/'))assert.equal((await fetch(root+asset,{headers})).status,200,asset);
  assert.equal((await context.cookies()).length,0);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
  const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
  const paths=['/confidentialitate/','/termeni/','/cookies/','/business/termeni/','/admin/reguli/','/drepturile-tale/','/securitate/','/contact/','/sterge-contul/'];
  for(const url of paths){assert.ok(links.includes(url),'Missing homepage legal link '+url);const result=await fetch(root+url,{headers});assert.equal(result.status,200,url);assert.match(await result.text(),/<html[^>]*lang="ro"/);}
  assert.ok(links.includes('https://business.cefaci.app/'));assert.ok(!links.some(url=>/\.apk|\.aab|\.ipa/.test(url)),'No premature public native release');
  for(const url of [...new Set(links.filter(url=>url.startsWith('/')&&!url.startsWith('//')))])assert.equal((await fetch(root+url,{headers})).status,200,url);
  await page.getByRole('button',{name:'Surprinde-mă',exact:true}).click();assert.match(await page.locator('#app-screen').getAttribute('src'),/surpriza.webp$/);assert.match(await page.locator('#screen-caption').innerText(),/spontan/);
  await page.getByRole('button',{name:'Un loc nou',exact:true}).focus();await page.keyboard.press('Enter');assert.match(await page.locator('#app-screen').getAttribute('src'),/loc.webp$/);
  await page.getByRole('button',{name:'Activează tema de noapte'}).click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  await page.reload();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  await page.evaluate(()=>localStorage.setItem('unrelated.account.fixture','preserve'));
  const opener=page.locator('[data-storage-open]').first();await opener.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#storage-dialog').evaluate(node=>node.open),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#storage-dialog').evaluate(node=>node.open),false);assert.equal(await opener.evaluate(node=>node===document.activeElement),true);
  await opener.click();await page.getByRole('button',{name:'Șterge preferința temei'}).click();assert.match(await page.locator('#storage-result').innerText(),/ștearsă/);assert.equal(await page.evaluate(()=>localStorage.getItem('cefaci.site.theme')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated.account.fixture')),'preserve');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  await page.evaluate(()=>{globalThis.__inlineRan=false;const script=document.createElement('script');script.textContent='globalThis.__inlineRan=true';document.body.appendChild(script);});assert.equal(await page.evaluate(()=>globalThis.__inlineRan),false);
  fs.mkdirSync('release/site-ui',{recursive:true});
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:width<768?844:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal scroll '+width);await page.screenshot({path:`release/site-ui/site-${width}.png`,fullPage:true});}
  await page.goto(root+'/confidentialitate/');await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await page.locator('h1').innerText());
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'release/site-ui/legal-390.png',fullPage:true});
  await page.getByRole('button',{name:'Setări stocare'}).click();assert.equal(await page.locator('#storage-dialog').evaluate(node=>node.open),true);await page.keyboard.press('Escape');
  await page.setViewportSize({width:320,height:844});
  for(const url of paths){await page.goto(root+url);await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Legal page on narrow phone '+url);}
  assert.equal((await fetch(root+'/this-page-does-not-exist',{headers})).status,404);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: site/legal navigation, 4 viewport widths, keyboard/Escape dialog, persisted theme/scoped reset, no cookies/tracking requests, CSP blocking inline script and real 404.');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
