// Real React lifecycle + Chromium, isolated synthetic auth. No remote service calls.
import assert from 'node:assert/strict';
import http from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const result = await build({
  stdin: {resolveDir: process.cwd(), loader: 'tsx', contents: `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useSecureAccess} from './shared/use-secure-access';
import {publishSecurityFailure} from './shared/security-events';
import {safeQrGeometry} from './admin/src/security-qr';
const control = window.control = {revoked:false, paused:false, pending:[], touchRelease:null, counts:{}, renders:[]};
const deadline = () => new Date(Date.now()+120000).toISOString();
const call = async (name,args) => {
  control.counts[name] = (control.counts[name]||0)+1;
  if(name==='secure_access_status') {
    if(control.paused) await new Promise(resolve => control.pending.push(resolve));
    return {admin_role:control.revoked?null:'fondator',business_access:false};
  }
  if(name==='secure_session_status') return {active:!control.revoked,idle_expires_at:deadline(),expires_at:deadline()};
  if(name==='secure_session_open') return {active:true,idle_expires_at:deadline(),expires_at:deadline()};
  if(name==='secure_session_touch') return new Promise(resolve => {control.touchRelease=()=>resolve({active:true,idle_expires_at:deadline(),expires_at:deadline()});});
  throw new Error('Unexpected synthetic endpoint');
};
function App() {
  const [identity,setIdentity] = useState({user:'first',sid:'one'});
  const security = useSecureAccess(identity.user,'admin',call,identity.sid);
  window.replaceSession = (user,sid) => setIdentity({user,sid});
  window.touch = () => security.activity();
  window.verify = () => security.verified();
  window.fail = () => publishSecurityFailure('admin');
  const output = {...identity,active:security.active,role:security.identity?.admin_role??null,forced:security.forcedChallenge};
  control.renders.push(output);
  return <output id="state">{JSON.stringify(output)}</output>;
}
window.safeQr = safeQrGeometry;
createRoot(document.getElementById('root')).render(<App/>);
`},
  bundle:true, write:false, platform:'browser', format:'iife', target:'es2020',
});
const server = http.createServer((request, response) => {
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.url === '/fixture.js') {
    response.setHeader('Content-Type', 'application/javascript; charset=utf-8'); response.end(result.outputFiles[0].text); return;
  }
  if (request.url === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><html lang="ro"><head><title>Isolated security fixture</title></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); return;
  }
  response.writeHead(404); response.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({headless:true});
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.routeWebSocket(/.*/, socket => socket.close());
  const page = await context.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).active);
  const snapshot = async () => JSON.parse(await page.locator('#state').textContent());

  // Render-time binding must remove access before effects and network checks finish.
  await page.evaluate(() => {control.paused=true;replaceSession('second','two');});
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).user === 'second');
  assert.equal((await snapshot()).active,false);
  assert.equal(await page.evaluate(() => control.renders.find(value => value.user==='second').active),false);
  await page.evaluate(() => {control.paused=false;control.pending.splice(0).forEach(resolve => resolve());});
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).active);
  await page.evaluate(() => {control.paused=true;replaceSession('second','new-auth-session');});
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).sid === 'new-auth-session');
  assert.equal((await snapshot()).active,false);
  assert.equal(await page.evaluate(() => control.renders.find(value => value.sid==='new-auth-session').active),false);
  await page.evaluate(() => {control.paused=false;control.pending.splice(0).forEach(resolve => resolve());});
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).active);

  // The older pending activity response cannot restore a revoked role.
  await page.evaluate(() => touch());
  await page.waitForFunction(() => !!control.touchRelease);
  await page.evaluate(() => {control.revoked=true;fail();});
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).role === null);
  await page.evaluate(() => control.touchRelease());
  await page.waitForTimeout(30);
  assert.equal((await snapshot()).active,false);
  const verificationError = await page.evaluate(async () => {try {await verify();return '';} catch(error) {return error.message;}});
  assert.match(verificationError,/Accesul securizat/);
  assert.equal((await snapshot()).active,false);

  // Safe geometry reconstruction must never accept executable SVG or URL attributes.
  const qr = await page.evaluate(() => {
    const valid = '<svg xmlns="http://www.w3.org/2000/svg" width="225" height="225"><path fill="#fff" d="M0 0h225v225z"/><path stroke="#000" d="M10 10h2M20 20h2"/></svg>';
    const attacks = [
      '<svg width="200" height="200"><script>alert(1)</script></svg>',
      '<svg width="200" height="200" onload="alert(1)"/>',
      '<svg width="200" height="200"><foreignObject><iframe src="https://example.invalid"/></foreignObject></svg>',
      '<svg width="200" height="200"><path href="https://example.invalid" d="M0 0"/></svg>',
      '<!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///etc/passwd">]><svg width="200" height="200">&secret;</svg>',
      '<svg width="200" height="200"><path fill="url(https://example.invalid)" d="M0 0"/></svg>',
      '<svg width="200" height="200"><path style="background:url(https://example.invalid)" d="M0 0"/></svg>',
      '<svg width="200" height="200"><rect><animate attributeName="href"/></rect></svg>',
    ];
    return {valid:safeQr(valid),prefixed:safeQr('data:image/svg+xml;utf-8,'+valid),rejected:attacks.map(safeQr),oversized:safeQr('<svg>'+' '.repeat(250001)+'</svg>')};
  });
  assert.equal(qr.valid.tag,'svg');assert.equal(qr.valid.attributes.viewBox,'0 0 225 225');assert.ok(qr.prefixed);
  assert.ok(qr.rejected.every(value => value === null));assert.equal(qr.oversized,null);
  console.log('Security hook/QR browser checks passed: account/session switch, role revocation, stale activity, denied final verification, 8 SVG injections and size bounds.');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
}
