// Isolated Apache fixture. Proxy header represents HTTPS termination, not a certificate test.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.env.CEFACI_TEST_ADMIN_HOSTING_URL??'http://127.0.0.1:4176';
if(!['localhost','127.0.0.1'].includes(new URL(root).hostname))throw new Error('Use an isolated localhost hosting fixture.');
const headers={'X-Forwarded-Proto':'https'};
const redirect=await fetch(root,{redirect:'manual'});assert.equal(redirect.status,301);assert.ok(redirect.headers.get('location').startsWith('https://'));
const response=await fetch(root+'/a/deep/link',{headers});assert.equal(response.status,200);
assert.match(response.headers.get('content-security-policy'),/script-src 'self';/);
assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
assert.match(response.headers.get('strict-transport-security'),/max-age=31536000/);
assert.match(response.headers.get('cache-control'),/no-store/);
const html=await response.text();assert.match(html,/<html[^>]*lang="ro"/);
const script=html.match(/<script[^>]*src="([^"]+)"/)[1];
const asset=await fetch(new URL(script,root+'/'),{headers});assert.equal(asset.status,200);assert.match(asset.headers.get('cache-control'),/immutable/);
assert.match((await fetch(root+'/manifest.webmanifest',{headers})).headers.get('content-type'),/application\/manifest\+json/);
const browser=await chromium.launch({headless:true});
try{const context=await browser.newContext({extraHTTPHeaders:headers});await context.route('**/*.supabase.co/**',r=>r.abort());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(root);await page.getByRole('textbox').first().waitFor();await page.evaluate(()=>document.fonts.ready);assert.deepEqual(errors,[]);await page.evaluate(()=>{globalThis.__unsafeInlineExecuted=false;const script=document.createElement('script');script.textContent='globalThis.__unsafeInlineExecuted=true';document.body.appendChild(script);});assert.equal(await page.evaluate(()=>globalThis.__unsafeInlineExecuted),false);await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);console.log('PASS: Admin Apache HTTPS redirect/fallback/cache/MIME, CSP/HSTS, fonts and phone width.');}finally{await browser.close();}
