// Draws the app icon and splash from Bilu's SVG (run from the repo root: node scripts/mobile-icons.mjs).
import fs from 'fs';
import { chromium } from 'playwright';
const m = fs.readFileSync('src/boards/Cont.view.js', 'utf8');
const T = JSON.parse(m.match(/export const TPL = (.*);\n/)[1]);
const i = T.indexOf('<svg class="bilu-svg'); const raw = T.slice(i, T.indexOf('</svg>', i) + 6);
const pose = { armL: 'M24 88Q12 94 13 106', hLx: 13, hLy: 107, armR: 'M96 86Q112 76 112 58', hRx: 112, hRy: 56, pLx: 46, pLy: 41, pRx: 74, pRy: 41, gLx: 47.6, gLy: 38.6, gRx: 75.6, gRy: 38.6, eL: 1, eR: 1, arcs: '', brow: 0, wand: 0, mouth: 'M48 52Q60 70 72 52Z', tongue: 'M53 60Q60 67 67 60Q60 57 53 60Z' };
const svg = raw.replace(/\{\{startBl\.(\w+)\}\}/g, (_, k) => String(pose[k])).replace('<ellipse class="bl-shadow"', '<ellipse opacity="0"')
  // on the navy icon only the ticket body reads: no arms, legs or shadow
  .replace(/<path d="M48 110L46 127[^>]*><\/path><ellipse[^>]*><\/ellipse><ellipse[^>]*><\/ellipse>/, '')
  .replace(/<g class="bl-arm[LR]">[\s\S]*?<\/g>/g, '').replace(/<g class="bl-wand"[\s\S]*?<\/g>/, '')
  .replace('viewBox="0 0 120 144"', 'viewBox="18 10 84 108"');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const pg = await b.newPage();
async function shot(file, size, bg, w, radius = 0) {
  await pg.setViewportSize({ width: size, height: size });
  await pg.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;background:transparent;display:flex;align-items:center;justify-content:center"><div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${bg};display:flex;align-items:center;justify-content:center"><div style="width:${w}px">${svg.replace('class="bilu-svg"', 'style="display:block;width:100%;height:auto;overflow:visible"')}</div></div></body></html>`);
  await pg.screenshot({ path: file, omitBackground: true });
}
await shot('mobile/assets/icon.png', 1024, '#0E1440', 520);
await shot('mobile/assets/android-icon-foreground.png', 1024, 'transparent', 400);
await shot('mobile/assets/splash-icon.png', 512, 'transparent', 360);
await b.close();
