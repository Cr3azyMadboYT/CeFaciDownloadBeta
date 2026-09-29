// Turns dist/index.html into the page fragment the Artifact host expects (it adds doctype/head/body itself).
import fs from 'node:fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const links = html.match(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts[^>]*>/g) ?? [];
const styles = html.match(/<style[\s\S]*?<\/style>/g) ?? [];
const scripts = html.match(/<script type="module"[\s\S]*?<\/script>/g) ?? [];
const out = [title, ...links, ...styles, '<div id="root"></div>', ...scripts.map((s) => s.replace('type="module" crossorigin', 'type="module"'))].join('\n');
fs.mkdirSync('artifact', { recursive: true });
fs.writeFileSync('artifact/cefaci.html', out);
console.log('artifact/cefaci.html', out.length);
