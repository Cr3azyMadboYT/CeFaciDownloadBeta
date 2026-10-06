// Draws the app's icons for each season (decision Cornel, 06.10) into mobile/assets/icons/:
//   <look>.png         1024×1024, the whole icon (the store, app.json's "icon" for "vara")
//   <look>-bg.png      432×432, Android's adaptive background (the season's sky, what falls, the ground)
//   <look>-fg.png      432×432, transparent, Bilu inside the safe circle (the launcher cuts the rest)
//   <look>-legacy.png  192×192, rounded, for Android before 8
// Bilu's clothes mirror LOOKS in src/app/season.ts and the drawing mirrors mobile/src/ui/Bilu.tsx.
// Run: node scripts/season-icons.mjs  (needs Playwright's Chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('mobile/assets/icons');
const N = '#0E1440', Y = '#FFD43B';
const LOOKS = {
  primavara: { hat: 'flowers', bg: ['#0C3440', '#1F7A6A'], fall: 'petals' },
  vara: { shades: true, cone: true, bg: ['#0E1440', '#26318A'], fall: 'sun' },
  toamna: { hat: 'leaf', scarf: '#F28C28', bg: ['#24123A', '#5A2448'], fall: 'leaves' },
  iarna: { hat: 'beanie', scarf: '#2F7BD9', mittens: '#2F7BD9', bg: ['#0C2148', '#245C9A'], fall: 'snow' },
  craciun: { hat: 'santa', scarf: '#E23B3B', mittens: '#E23B3B', bg: ['#0C2148', '#245C9A'], fall: 'snow' },
};

function petals(x, y, c, r) {
  let p = '';
  for (let i = 0; i < 5; i++) { const a = i * 72 * Math.PI / 180; p += `<circle cx="${(x + Math.cos(a) * r).toFixed(1)}" cy="${(y + Math.sin(a) * r).toFixed(1)}" r="${r * 0.8}" fill="${c}" stroke="${N}" stroke-width="2"/>`; }
  return p + `<circle cx="${x}" cy="${y}" r="${r * 0.6}" fill="#FF9F43" stroke="${N}" stroke-width="2"/>`;
}
function bilu(o) {
  const hand = o.mittens || Y;
  let s = `<path d="M48 110L46 127M72 110L74 127" fill="none" stroke="${N}" stroke-width="6" stroke-linecap="round"/><ellipse cx="44" cy="130" rx="8" ry="4.5" fill="${N}"/><ellipse cx="76" cy="130" rx="8" ry="4.5" fill="${N}"/>`;
  s += `<path d="M24 88Q12 94 13 106" fill="none" stroke="${N}" stroke-width="6" stroke-linecap="round"/><circle cx="13" cy="107" r="6.5" fill="${hand}" stroke="${N}" stroke-width="3.5"/>`;
  if (o.cone) s += `<path d="M104 46l8 22 8-22z" fill="#E9B26A" stroke="${N}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="108" cy="42" r="6" fill="#FF9EC4" stroke="${N}" stroke-width="2.5"/><circle cx="116" cy="42" r="6" fill="#9FE3C6" stroke="${N}" stroke-width="2.5"/><circle cx="112" cy="35" r="6" fill="#fff" stroke="${N}" stroke-width="2.5"/>`;
  s += `<path d="M96 86Q112 76 112 58" fill="none" stroke="${N}" stroke-width="6" stroke-linecap="round"/><circle cx="112" cy="56" r="6.5" fill="${hand}" stroke="${N}" stroke-width="3.5"/>`;
  s += `<path d="M38 14H82A16 16 0 0 1 98 30V61A9 9 0 0 0 98 79V98A16 16 0 0 1 82 114H38A16 16 0 0 1 22 98V79A9 9 0 0 0 22 61V30A16 16 0 0 1 38 14Z" fill="${Y}" stroke="${N}" stroke-width="4" stroke-linejoin="round"/>`;
  s += `<path d="M26 26Q30 18 40 17" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".55"/><path d="M33 70H87" stroke="${N}" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 6" opacity=".35"/><path d="M52 92l3 3 7-7" fill="none" stroke="${N}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".28"/>`;
  s += `<ellipse cx="35" cy="55" rx="5.5" ry="3.2" fill="#FF6A4D" opacity=".6"/><ellipse cx="85" cy="55" rx="5.5" ry="3.2" fill="#FF6A4D" opacity=".6"/>`;
  s += `<path d="M48 52Q60 70 72 52Z" fill="${N}"/><path d="M53 60Q60 67 67 60Q60 57 53 60Z" fill="#FF6A4D"/>`;
  if (o.shades) s += `<path d="M34 32h24v9a9 9 0 0 1-9 9h-6a9 9 0 0 1-9-9zM62 32h24v9a9 9 0 0 1-9 9h-6a9 9 0 0 1-9-9z" fill="${N}"/><path d="M58 35h4" stroke="${N}" stroke-width="3"/><path d="M38 36h6M66 36h6" stroke="#5C7FFF" stroke-width="2.5" stroke-linecap="round"/>`;
  else for (const cx of [46, 74]) s += `<ellipse cx="${cx}" cy="40" rx="9" ry="11" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="${cx}" cy="41" r="5" fill="${N}"/><circle cx="${cx + 1.6}" cy="38.6" r="1.8" fill="#fff"/>`;
  if (o.scarf) s += `<path d="M74 72l4 30 11-2-3-28z" fill="${o.scarf}" stroke="${N}" stroke-width="2.5" stroke-linejoin="round"/><path d="M77 84l10-2M78 92l10-2" stroke="#fff" stroke-width="2.5" opacity=".7"/><path d="M76 100l2 6M81 99l2 6M86 98l2 6" stroke="${N}" stroke-width="2" stroke-linecap="round"/><rect x="18" y="63" width="84" height="13" rx="6.5" fill="${o.scarf}" stroke="${N}" stroke-width="2.5"/><path d="M34 63v13M50 63v13M66 63v13M82 63v13" stroke="#fff" stroke-width="2.5" opacity=".6"/>`;
  if (o.hat === 'santa') s += `<path d="M28 18Q40 -26 86 -18Q106 -13 110 6L94 18Z" fill="#E23B3B" stroke="${N}" stroke-width="3" stroke-linejoin="round"/><path d="M44 2Q58 -14 82 -12" fill="none" stroke="#fff" stroke-width="3" opacity=".35" stroke-linecap="round"/><circle cx="110" cy="8" r="9" fill="#fff" stroke="${N}" stroke-width="3"/><rect x="18" y="8" width="84" height="15" rx="7.5" fill="#fff" stroke="${N}" stroke-width="3"/>`;
  if (o.hat === 'beanie') s += `<path d="M24 20Q24 -16 60 -16Q96 -16 96 20Z" fill="#2F7BD9" stroke="${N}" stroke-width="3" stroke-linejoin="round"/><path d="M42 -10V18M60 -14V18M78 -10V18" stroke="#fff" stroke-width="2.5" opacity=".35"/><circle cx="60" cy="-20" r="9" fill="#fff" stroke="${N}" stroke-width="3"/><rect x="18" y="8" width="84" height="15" rx="7.5" fill="#1E5FB0" stroke="${N}" stroke-width="3"/><path d="M28 15.5h64" stroke="#fff" stroke-width="2.5" stroke-dasharray="3 5" opacity=".6"/>`;
  if (o.hat === 'flowers') s += `<path d="M30 15q6-10 14-6M86 15q-6-10-14-6" fill="none" stroke="#3DAA6E" stroke-width="3" stroke-linecap="round"/><path d="M50 8q-6-8 2-12q4 6-2 12z" fill="#5FD39A" stroke="${N}" stroke-width="2"/>` + petals(34, 12, '#FF9EC4', 5.5) + petals(60, 6, '#fff', 6.5) + petals(86, 12, '#B7A3FF', 5.5);
  if (o.hat === 'leaf') s += `<g transform="rotate(-25 82 8)"><path d="M82 -6c10 4 14 14 8 24c-10-2-14-12-8-24z" fill="#F28C28" stroke="${N}" stroke-width="2.5" stroke-linejoin="round"/><path d="M84 0l3 16" stroke="${N}" stroke-width="2"/></g>`;
  return s;
}
function rnd(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function fall(kind, W, H) {
  const r = rnd(11); let s = '';
  if (kind === 'snow') {
    for (let i = 0; i < 110; i++) s += `<circle cx="${r() * W}" cy="${r() * H}" r="${1 + r() * 3.2}" fill="#fff" opacity="${0.45 + r() * 0.5}"/>`;
    s += `<path d="M0 860Q260 790 512 840T1024 820V1024H0z" fill="#fff"/><path d="M0 900Q300 850 560 890T1024 880" fill="none" stroke="#DCE8F7" stroke-width="10"/>`;
  }
  if (kind === 'leaves') {
    const cs = ['#F28C28', '#D9472B', '#FFC94A', '#B5452A'];
    for (let i = 0; i < 28; i++) s += `<g transform="translate(${r() * W} ${r() * H}) rotate(${r() * 360}) scale(${0.6 + r() * 0.9})" opacity=".9"><path d="M0 -14c10 4 14 14 0 28c-14-14-10-24 0-28z" fill="${cs[i % 4]}"/></g>`;
    s += `<path d="M0 900Q300 860 600 900T1024 880V1024H0z" fill="#B5452A" opacity=".55"/>`;
  }
  if (kind === 'petals') {
    const cs = ['#FFB3D1', '#FFFFFF', '#FFD1E3', '#C9F0DA'];
    for (let i = 0; i < 40; i++) s += `<g transform="translate(${r() * W} ${r() * H}) rotate(${r() * 360}) scale(${0.5 + r() * 0.8})" opacity=".9"><ellipse rx="9" ry="5" fill="${cs[i % 4]}"/></g>`;
    s += `<path d="M0 900Q300 850 600 895T1024 870V1024H0z" fill="#5FD39A" opacity=".45"/>`;
  }
  if (kind === 'sun') {
    s += `<circle cx="${W * 0.76}" cy="${H * 0.22}" r="${W * 0.16}" fill="#FFD43B" opacity=".14"/><circle cx="${W * 0.76}" cy="${H * 0.22}" r="${W * 0.09}" fill="#FFD43B" opacity=".55"/>`;
    for (let i = 0; i < 16; i++) { const z = 6 + r() * 8; s += `<path transform="translate(${r() * W} ${r() * H})" d="M0 ${-z}L${z * 0.3} ${-z * 0.3}L${z} 0L${z * 0.3} ${z * 0.3}L0 ${z}L${-z * 0.3} ${z * 0.3}L${-z} 0L${-z * 0.3} ${-z * 0.3}Z" fill="#FFE58A" opacity=".7"/>`; }
  }
  return s;
}
const sky = (k, o) => `<defs><radialGradient id="g${k}" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${o.bg[1]}"/><stop offset="1" stop-color="${o.bg[0]}"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#g${k})"/>${fall(o.fall, 1024, 1024)}`;
// Bilu around (60, 64) in his own units; `scale` in px per unit
const him = (o, scale) => `<g transform="translate(512 540) rotate(-7) scale(${scale}) translate(-60 -64)">${bilu(o)}</g>`;

const page = (svg, size, round = 0) => `<!doctype html><html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;border-radius:${round}px;overflow:hidden"><svg width="${size}" height="${size}" viewBox="0 0 1024 1024">${svg}</svg></div></body></html>`;

fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ deviceScaleFactor: 1 });
async function shot(html, size, file) {
  await pg.setViewportSize({ width: size, height: size });
  await pg.setContent(html);
  await pg.screenshot({ path: path.join(OUT, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
for (const [k, o] of Object.entries(LOOKS)) {
  await shot(page(sky(k, o) + him(o, 5.0), 1024), 1024, k + '.png');
  await shot(page(sky(k, o), 432), 432, k + '-bg.png');
  // the safe circle is 66 of 108 units: Bilu (hat and ice cream included) stays inside it, as big as it allows (06.10: "zoom")
  await shot(page(him(o, 3.3), 432), 432, k + '-fg.png');
  await shot(page(sky(k, o) + him(o, 5.0), 192, 42), 192, k + '-legacy.png');
}
await b.close();
console.log('icons in', OUT);
