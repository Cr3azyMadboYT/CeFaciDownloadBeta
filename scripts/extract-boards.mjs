// Pulls each design board (.dc.html from the CeFaci canvas) apart into template, CSS and logic,
// applies the app patches (real venues, search, persistence), and writes src/boards/*.
import fs from 'node:fs';
import { PATCHES } from './board-patches.mjs';

fs.mkdirSync('src/boards', { recursive: true });
for (const name of ['Cont', 'Demo']) {
  const src = fs.readFileSync(`design/${name}.dc.html`, 'utf8');
  const xdc = src.slice(src.indexOf('<x-dc>') + 6, src.lastIndexOf('</x-dc>'));
  const helmet = (xdc.match(/<helmet>([\s\S]*?)<\/helmet>/) || [])[1] ?? '';
  let tpl = xdc.replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();
  const css = (helmet.match(/<style>([\s\S]*?)<\/style>/) || [])[1] ?? '';
  const fonts = (helmet.match(/<link rel="stylesheet" href="([^"]+)"/) || [])[1]?.replace(/&amp;/g, '&') ?? '';
  const script = src.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  let code = script;
  for (const [where, from, to] of PATCHES[name] ?? []) {
    const target = where === 'tpl' ? tpl : code;
    if (!target.includes(from)) throw new Error(`${name}: patch anchor not found: ${from.slice(0, 90)}`);
    const next = target.split(from).join(to);
    if (where === 'tpl') tpl = next; else code = next;
  }
  fs.writeFileSync(`src/boards/${name}.logic.js`, `// Generated from design/${name}.dc.html by scripts/extract-boards.mjs. Do not edit; change the patches.\n/* eslint-disable */\nimport { APP } from '../app/bridge';\nexport function make(DCLogic) {\n${code}\nreturn Component;\n}\n`);
  fs.writeFileSync(`src/boards/${name}.view.js`, `// Generated. Template and styles of design/${name}.dc.html.\nexport const TPL = ${JSON.stringify(tpl)};\nexport const CSS = ${JSON.stringify(css)};\nexport const FONTS = ${JSON.stringify(fonts)};\n`);
  console.log(name, 'tpl', tpl.length, 'css', css.length, 'code', code.length, 'patches', (PATCHES[name] ?? []).length);
}
