// Filmează scenele pentru reclama CeFaci, din aplicația web (aceeași ca pe telefon), cu un cont de test.
// node --import pw.mjs rec.mjs <outdir> [scena...]
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.argv[2];
const ONLY = process.argv.slice(3);
const ME = '11111111-1111-4111-8111-111111111111';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: ME, exp: Math.floor(Date.now() / 1000) + 7200, role: 'authenticated', aud: 'authenticated' }) + '.sig';
const T0 = new Date('2026-10-23T19:24:00+03:00').getTime();
const iso = (m) => new Date(T0 + m * 60e3).toISOString();
const venues = JSON.parse(fs.readFileSync('/home/user/CeFaciDownloadBeta/src/data/venues.json', 'utf8'));
const V = (id) => venues.find((v) => v.id === id);

const people = [
  { id: 'a2', first_name: 'Mihai', username: 'mihai', starts_at: iso(-10), ends_at: iso(110), moods: ['pahar'], zone: 'Sector 2', friend: true, via: null, muted: false, outing: null },
  { id: 'a3', first_name: 'Ioana', username: 'ioana', starts_at: iso(-4), ends_at: iso(150), moods: ['mancare', 'film'], zone: null, friend: true, via: null, muted: false, outing: null },
  { id: 'a4', first_name: 'Andrei', username: 'andrei.p', starts_at: iso(30), ends_at: iso(240), moods: ['joaca'], zone: null, friend: false, via: 'Mihai', muted: false, outing: null },
];
const VOTE = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const opts = ['n6943415085', 'n12368291207', 'n11638271659'].map((id, i) => ({ id: 'o' + i, venue_id: id, venue_name: V(id)?.name ?? id, details: { title: V(id)?.kind ?? '' }, position: i }));
let ballots = [
  { option_id: 'o0', user_id: 'a2', value: 'super' }, { option_id: 'o1', user_id: 'a2', value: 'da' },
  { option_id: 'o0', user_id: 'a3', value: 'da' }, { option_id: 'o2', user_id: 'a3', value: 'nu' },
];

async function ctxFor(b, { signed = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.62, locale: 'ro-RO', timezoneId: 'Europe/Bucharest' });
  await ctx.addInitScript(() => {
    // un cerc care arată atingerea, ca într-un walkthrough
    const draw = (x, y) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.6);border:2px solid rgba(14,20,64,.35);z-index:2147483647;pointer-events:none`; document.documentElement.appendChild(d); const t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - t0) / 500); d.style.transform = 'scale(' + (1 + k * 0.7) + ')'; d.style.opacity = String(1 - k); if (k < 1) requestAnimationFrame(step); else d.remove(); }; requestAnimationFrame(step); };
    window.addEventListener('pointerdown', (e) => draw(e.clientX, e.clientY), true);
    // pe web harta nu se încarcă (fără internet aici): pun în loc poza hărții reale (OpenFreeMap), făcută separat
    const fix = () => { for (const e of document.querySelectorAll('div')) { if (e.childElementCount === 0 && e.textContent.trim() === 'Harta se vede în aplicația de telefon.') { const box = e.parentElement; const k = location.pathname.startsWith('/loc') ? 'place' : location.pathname.startsWith('/freenow') ? 'free' : 'dice'; box.style.backgroundImage = 'url(/admap/' + k + '.jpg)'; box.style.backgroundSize = 'cover'; box.style.backgroundPosition = 'center'; box.style.overflow = 'hidden'; e.style.visibility = 'hidden'; } } };
    new MutationObserver(fix).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await ctx.route('**/admap/*', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(new URL('./maps/' + route.request().url().split('/').pop(), import.meta.url)) }));
  await ctx.route('**/*.supabase.co/**', (route) => {
    const req = route.request(); const u = req.url();
    if (process.env.LOGR) console.log('R', req.method(), u.replace(/^.*supabase.co/, '').slice(0, 140), req.headers()['accept']);
    const single = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
    let body = single ? null : [];
    if (u.includes('/rpc/free_now_list')) body = { me: null, outing: null, people, quiet: false };
    else if (u.includes('/rpc/free_now_set')) body = { notified: 3, others: 3 };
    else if (u.includes('/vote_sessions')) { const o = { id: VOTE, title: 'Unde mergem?', crew_id: null, closes_at: iso(12), created_by: 'a2', plan_id: null }; body = single ? o : [o]; }
    else if (u.includes('/vote_options')) body = opts;
    else if (u.includes('/vote_voters')) body = [{ user_id: ME }, { user_id: 'a2' }, { user_id: 'a3' }];
    else if (u.includes('/ballots')) {
      if (req.method() === 'POST' || req.method() === 'PATCH') { try { const d = JSON.parse(req.postData() || '{}'); const r = Array.isArray(d) ? d[0] : d; ballots = ballots.filter((x) => !(x.user_id === ME && x.option_id === r.option_id)).concat([{ option_id: r.option_id, user_id: ME, value: r.value }]); } catch {} body = null; }
      else body = ballots;
    }
    else if (u.includes('/profiles?') && u.includes('in.')) body = [{ id: ME, username: 'cornel', first_name: 'Cornel' }, { id: 'a2', username: 'mihai', first_name: 'Mihai' }, { id: 'a3', username: 'ioana', first_name: 'Ioana' }];
    else if (u.includes('/profiles?')) body = single ? { username: 'cornel', first_name: 'Cornel' } : [];
    else if (u.includes('/profile_private?')) body = single ? { birth_date: '1999-01-01', prefs: { zone: 'centru', likes: ['food'], dist: '20', moves: ['walk'], name: 'Cornel', user: 'cornel', birth: '1999-01-01' }, app_state: { tut: { on: false, done: true, step: 0 }, plus: 'locked', welcomeXp: true, xp: 150, lang: 'ro' }, plus_trial_started_at: null } : [];
    else if (u.includes('/auth/v1/user')) body = { id: ME, email: 'c@x.ro', aud: 'authenticated', role: 'authenticated' };
    else if (u.includes('/functions/v1/')) body = { results: [] };
    else if (u.includes('/rpc/')) body = null;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.clock.install({ time: new Date('2026-10-23T19:24:00+03:00') });
  const pg = await ctx.newPage();
  if (signed) {
    await pg.goto('http://localhost:8791/');
    await pg.evaluate(([jwt, ME]) => {
      localStorage.setItem('sb-vqrmwuarjjntusfbqprx-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id: ME, email: 'c@x.ro', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }));
      localStorage.setItem('cefaci.owner', ME); localStorage.setItem('cefaci.onboarded', '1');
      localStorage.setItem('cefaci.prefs', JSON.stringify({ zone: 'centru', likes: ['food'], dist: '20', moves: ['walk'], name: 'Cornel', user: 'cornel', birth: '1999-01-01', done: true }));
      localStorage.setItem('cefaci.state', JSON.stringify({ tut: { on: false, done: true, step: 0 }, plus: 'locked', welcomeXp: true, xp: 150, lang: 'ro' }));
    }, [jwt, ME]);
  }
  return { ctx, pg };
}
// filmarea: ceasul paginii e oprit și înaintează câte 1/30 s; după fiecare pas, o poză la 1080×2398 → 30 fps fluid
const wait = async (pg, ms) => {
  if (!pg._rec) return pg.waitForTimeout(ms);
  const n = Math.max(1, Math.round(ms / 33.333));
  for (let i = 0; i < n; i++) {
    const r = pg._rec; const step = r.n % 3 === 2 ? 34 : 33;
    await pg.clock.runFor(step);
    await pg.screenshot({ path: r.dir + '/' + String(r.n++).padStart(5, '0') + '.jpg', type: 'jpeg', quality: 90 });
  }
};
const startRec = async (pg, name) => { await pg.waitForTimeout(300); const now = await pg.evaluate(() => Date.now()); await pg.clock.pauseAt(now + 20); name = name ?? CUR; const dir = OUT + '/f-' + name; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); pg._rec = { dir, n: 0, name }; };
const press = async (pg, x, y) => { await pg.mouse.move(x, y); await pg.mouse.down(); await wait(pg, 90); await pg.mouse.up(); };
// apasă textul vizibil (exact), ignorând copiile ascunse ale ecranelor anterioare
const tapT = async (pg, text, last = false) => {
  const p = await pg.evaluate(([t, last]) => { const els = [...document.querySelectorAll('*')].filter((e) => e.childElementCount === 0 && e.textContent.trim() === t).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0 && r.y < innerHeight && r.bottom > 0); const r = last ? els[els.length - 1] : els[0]; return r ? [r.x + r.width / 2, r.y + r.height / 2] : null; }, [text, last]);
  if (!p) throw new Error('nu găsesc ' + text); await press(pg, p[0], p[1]);
};
const tap = async (pg, loc) => { if (typeof loc === 'string') return tapT(pg, loc); const l = loc; await l.scrollIntoViewIfNeeded().catch(() => {}); const bx = await l.boundingBox({ timeout: 3000 }); await press(pg, bx.x + bx.width / 2, bx.y + bx.height / 2); };
const smoothScroll = async (pg, dy, ms) => { await pg.mouse.move(206, 520); const steps = Math.round(ms / 30); for (let i = 0; i < steps; i++) { await pg.mouse.wheel(0, dy / steps); await wait(pg, 30); } };

let CUR = '';
const DBG = process.env.DBG; let si = 0;
const shot = async (pg, n) => { if (DBG) await pg.screenshot({ path: OUT + '/dbg-' + (si++) + '-' + n + '.png' }); };
const SCENES = {
  // 1. grupul de prieteni care nu se hotărăște (o conversație inventată, fără marca vreunei aplicații)
  async chat(b) {
    const { ctx, pg } = await ctxFor(b, { signed: false });
    await pg.goto('about:blank'); await startRec(pg);
    await pg.setContent(fs.readFileSync(new URL('./chat.html', import.meta.url), 'utf8'));
    await wait(pg, 6600);
    return ctx;
  },
  // 3+4+9. Creează plan → 3 planuri gata → Facem așa → biletul, dintr-o bucată (se taie la montaj)
  async plan(b) {
    const { ctx, pg } = await ctxFor(b);
    const t0 = Date.now();
    const log = (n) => console.log('  ' + n + ' @' + ((pg._rec?.n ?? 0) / 30).toFixed(1));
    await pg.goto('http://localhost:8791/acasa'); await pg.waitForTimeout(3000); await startRec(pg); await wait(pg, 700); log('acasa');
    await tap(pg, pg.getByLabel('Creează plan').first()); await wait(pg, 1100); await shot(pg, 'ce'); log('ce');
    await tapT(pg, 'Toată seara'); await wait(pg, 700);
    await tapT(pg, 'Mai departe', true); await wait(pg, 1000); log('cand');
    await tapT(pg, 'Acum'); await wait(pg, 600);
    await tapT(pg, 'Mai departe', true); await wait(pg, 1000); log('cati');
    await tapT(pg, '3'); await wait(pg, 600);
    await tapT(pg, 'Mai departe', true); await wait(pg, 1000); log('buget');
    await tapT(pg, 'Normal'); await wait(pg, 700); await shot(pg, 'buget');
    await tapT(pg, 'Mai departe', true); await wait(pg, 1000); log('vibe');
    await tapT(pg, 'Party', true); await wait(pg, 450);
    await tapT(pg, 'Fun', true); await wait(pg, 700); await shot(pg, 'vibes');
    await tapT(pg, 'Gata, fă-mi planul', true); log('gata');
    await wait(pg, 3200); await shot(pg, 'planuri'); log('planuri');
    await smoothScroll(pg, 560, 2600); await wait(pg, 700);
    await smoothScroll(pg, -560, 1200); await wait(pg, 600); log('sus');
    await tapT(pg, 'Facem așa'); await wait(pg, 2600); await shot(pg, 'bilet'); log('bilet');
    await smoothScroll(pg, 420, 2000); await wait(pg, 1200); await shot(pg, 'bilet2'); log('final');
    return ctx;
  },
  // 5. pagina unui loc: de ce merită, când e lume
  async place(b) {
    const { ctx, pg } = await ctxFor(b);
    await pg.goto('http://localhost:8791/loc/n6943415085'); await pg.waitForTimeout(1800); await startRec(pg); await wait(pg, 700);
    await smoothScroll(pg, 430, 3200); await wait(pg, 1500);
    return ctx;
  },
  // 6. votul cu gașca
  async vote(b) {
    const { ctx, pg } = await ctxFor(b);
    await pg.goto('http://localhost:8791/vot/' + VOTE); await pg.waitForTimeout(2200); await startRec(pg); await wait(pg, 700); await shot(pg, 'vot');
    await tapT(pg, 'Super'); await wait(pg, 1100);
    await tapT(pg, 'Da', true); await wait(pg, 900);
    await smoothScroll(pg, 260, 1200); await wait(pg, 1600);
    return ctx;
  },
  // 7. FreeNow: ții apăsat pe bilet, se umple, Bilu zboară
  async freenow(b) {
    const { ctx, pg } = await ctxFor(b);
    await pg.goto('http://localhost:8791/acasa'); await pg.waitForTimeout(3500); await startRec(pg); await wait(pg, 700);
    await tapT(pg, 'FreeNow ⚡').catch(async () => { const bx = await pg.getByLabel(/FreeNow/).first().boundingBox(); await press(pg, bx.x + bx.width / 2, bx.y + bx.height / 2); });
    await wait(pg, 3200);
    await smoothScroll(pg, 300, 1400); await wait(pg, 1800);
    return ctx;
  },
  // 8. zarul: Surprinde-mă
  async dice(b) {
    const { ctx, pg } = await ctxFor(b);
    await pg.goto('http://localhost:8791/acasa'); await pg.waitForTimeout(3500); await startRec(pg); await wait(pg, 700);
    await tap(pg, pg.getByLabel(/Surprinde-mă/).first()); await wait(pg, 3800);
    return ctx;
  },
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--force-device-scale-factor=2.62'] });
fs.mkdirSync(OUT + '/raw', { recursive: true });
for (const [name, fn] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  CUR = name;
  try {
    const ctx = await fn(b);
    const page = ctx.pages()[0]; const r = page._rec;
    await ctx.close();
    const { execSync } = await import('node:child_process');
    execSync(`ffmpeg -loglevel error -y -framerate 30 -i ${r.dir}/%05d.jpg -vf "scale=1080:2398,format=yuv420p" -c:v libx264 -crf 16 -preset veryfast ${OUT}/${name}.mp4`);
    console.log('ok', name, r.n + ' cadre = ' + (r.n / 30).toFixed(1) + ' s');
  } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); }
}
await b.close();
