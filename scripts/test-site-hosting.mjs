// Isolated real Apache fixture. Proxy header simulates TLS termination, not a certificate audit.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=process.env.CEFACI_TEST_SITE_HOSTING_URL??'http://127.0.0.1:4178';
if(!['127.0.0.1','localhost'].includes(new URL(root).hostname))throw new Error('Use an isolated localhost Apache fixture.');
const headers={'X-Forwarded-Proto':'https'};
const redirect=await fetch(root,{redirect:'manual'});assert.equal(redirect.status,301);assert.ok(redirect.headers.get('location').startsWith('https://'));
const index=await fetch(root,{headers});assert.equal(index.status,200);
const csp=index.headers.get('content-security-policy');assert.match(csp,/script-src 'self'/);assert.match(csp,/connect-src 'none'/);assert.match(csp,/frame-ancestors 'none'/);assert.ok(!/unsafe-inline|unsafe-eval|https:/.test(csp));
assert.match(index.headers.get('strict-transport-security'),/max-age=31536000/);assert.match(index.headers.get('cache-control'),/no-store/);assert.equal(index.headers.get('x-content-type-options'),'nosniff');assert.equal(index.headers.get('referrer-policy'),'no-referrer');
assert.match(index.headers.get('permissions-policy'),/camera=\(\)/);
const pages=['confidentialitate','termeni','cookies','business/termeni','admin/reguli','drepturile-tale','securitate','contact','sterge-contul'];
for(const page of pages){const response=await fetch(root+'/'+page+'/',{headers});assert.equal(response.status,200,page);assert.match(response.headers.get('cache-control'),/no-store/);assert.match(await response.text(),/<html[^>]*lang="ro"/);}
for(const [old,next]of [['/termeni.html','/termeni/'],['/confidentialitate.html','/confidentialitate/'],['/legal/confidentialitate.html','/confidentialitate/'],['/privacy.html','/confidentialitate/'],['/terms','/termeni/']]){const response=await fetch(root+old,{headers,redirect:'manual'});assert.equal(response.status,301,old);assert.equal(new URL(response.headers.get('location'),root).pathname,next);}
for(const [file,mime]of [['/assets/site.js','javascript'],['/assets/site.css','text/css'],['/assets/bricolage-grotesque-latin-standard-normal.woff2','font/woff2'],['/assets/bilu.webp','image/webp']]){const response=await fetch(root+file,{headers});assert.equal(response.status,200);assert.ok(response.headers.get('content-type').includes(mime));assert.match(response.headers.get('cache-control'),/max-age=3600/);}
assert.equal((await fetch(root+'/nonexistent-legal-page',{headers})).status,404);
for(const url of ['/docs/livrare/backend-before-security.sql','/.env','/backup/','/node_modules/','/package.json'])assert.ok([403,404].includes((await fetch(root+url,{headers})).status),url);
const result=spawnSync(process.execPath,['scripts/test-site-ui.mjs'],{stdio:'inherit',env:{...process.env,CEFACI_TEST_SITE_URL:root,CEFACI_TEST_PROXY_HTTPS:'1'}});assert.equal(result.status,0,'UI checks on actual Apache');
console.log('PASS: public site Apache HTTPS redirect, legal and legacy301 paths, real404, strict CSP/HSTS, private files absent, MIME/cache and browser UI.');
