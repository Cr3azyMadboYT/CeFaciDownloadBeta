import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
async function loadTrustedModule(name) {
  if (cache.has(name)) return cache.get(name);
  const source = await readFile(join(root, 'shared', `${name}.ts`), 'utf8');
  const compiled = transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
  const config = name === 'legal-content' ? await loadTrustedModule('legal-config') : null;
  const mod = { exports: {} };
  // Compile only repository-owned TypeScript, never request or user input.
  const require = id => id === './legal-config' ? config : nativeRequire(id);
  new Function('require', 'module', 'exports', compiled)(require, mod, mod.exports);
  cache.set(name, mod.exports);
  return mod.exports;
}
const { LEGAL_DOCUMENTS, LEGAL_VERSION, LEGAL_CONTACT_EMAIL, LEGAL_OPERATOR } = await loadTrustedModule('legal-content');
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function paragraph(value) {
  return esc(value).replace(/https:\/\/[^\s<]+/g, escapedUrl => {
    const trailing = /[.,;]$/.test(escapedUrl) ? escapedUrl.slice(-1) : '';
    const url = trailing ? escapedUrl.slice(0,-1) : escapedUrl;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
  });
}
const nav = LEGAL_DOCUMENTS.map(doc => `<a href="${esc(doc.path)}">${esc(doc.title)}</a>`).join('\n');
for (const doc of LEGAL_DOCUMENTS) {
  if (!/^\/(?:[a-z-]+\/)+$/.test(doc.path)) throw new Error(`Unsafe legal path: ${doc.path}`);
  const output = join(root, 'website', doc.path.slice(1), 'index.html');
  const content = `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#E8EBF2"><title>${esc(doc.title)} · CeFaci</title><meta name="description" content="${esc(doc.title)} pentru CeFaci Client, Business și Admin. Versiunea ${esc(LEGAL_VERSION)}."><link rel="canonical" href="https://cefaci.app${esc(doc.path)}"><link rel="icon" href="/assets/favicon.png"><link rel="stylesheet" href="/assets/fonts.css"><link rel="stylesheet" href="/assets/site.css"><script src="/assets/site.js" defer></script></head>
<body><a class="skip" href="#continut">Mergi la conținut</a><header class="header wrap"><a class="brand" href="/" aria-label="CeFaci, pagina principală"><img src="/assets/bilu.webp" alt="" width="48" height="48"><span>CeFaci</span></a><a class="button" href="/">Înapoi la CeFaci</a><button type="button" class="theme-toggle" data-theme-toggle aria-label="Schimbă tema"><span data-theme-icon aria-hidden="true">☾</span></button></header>
<main id="continut" class="legal-page"><article class="legal-article"><p class="eyebrow">CeFaci · Informații clare</p><h1>${esc(doc.title)}</h1><p class="legal-meta">Versiunea ${esc(LEGAL_VERSION)} · Client, Business, Admin și site</p>${LEGAL_OPERATOR.operatorPending ? '<p class="notice">Proiect în beta, înaintea lansării comerciale. Datele operatorului și adresa de corespondență trebuie completate; plățile platformei nu sunt activate.</p>' : ''}${doc.sections.map((section,index)=>`<section aria-labelledby="sectiune-${index}"><h2 id="sectiune-${index}">${esc(section.title)}</h2>${section.paragraphs.map(p=>`<p>${paragraph(p)}</p>`).join('\n')}</section>`).join('\n')}<p class="legal-meta">Contact: <a href="mailto:${esc(LEGAL_CONTACT_EMAIL)}">${esc(LEGAL_CONTACT_EMAIL)}</a></p></article><nav class="legal-nav" aria-label="Documentele CeFaci">${nav}</nav></main>
<footer class="wrap footer"><div><a class="brand" href="/">CeFaci</a><p>Un loc bun. O seară împreună.</p><button type="button" data-storage-open>Setări stocare</button><p><a href="/contact/">Contact</a> · <a href="/confidentialitate/">Confidențialitate</a> · <a href="/termeni/">Termeni</a></p></div></footer></body></html>\n`;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, content);
  const filename = ({privacy:'confidentialitate',clientTerms:'termeni',businessTerms:'business-termeni',adminRules:'admin-reguli',deleteAccount:'sterge-contul',rights:'drepturile-tale'})[doc.id] ?? doc.id;
  await mkdir(join(root, 'docs', 'legal', 'site'), { recursive: true });
  await writeFile(join(root, 'docs', 'legal', 'site', `${filename}.html`), content);
  await writeFile(join(root, 'docs', 'legal', `${filename}.md`), `# ${doc.title}\n\nVersiunea: ${LEGAL_VERSION}. Conținut comun cu aplicațiile și site-ul.\n\n${doc.sections.map(section=>`## ${section.title}\n\n${section.paragraphs.join('\n\n')}`).join('\n\n')}\n`);
}
console.log(`Generated ${LEGAL_DOCUMENTS.length} legal pages and Markdown documents (${LEGAL_VERSION}).`);
