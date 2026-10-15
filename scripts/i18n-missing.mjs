// Arată textele românești încă netraduse (fără tr(...)) din fișierele date:
//   node scripts/i18n-missing.mjs mobile/src/app/cont.tsx mobile/src/ui/WherePick.tsx
// Euristic: un literal sau un text JSX cu litere românești ori cuvinte românești uzuale, care nu e în tr( și nu e comentariu.
import fs from 'node:fs';
const RO = /[ăâîșțĂÂÎȘȚ]|\b(?:și|sau|pentru|care|nu|cu|la|din|pe|mai|ai|te|ți|Înapoi|Gata|Da|Nu)\b/;
let n = 0;
for (const f of process.argv.slice(2)) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const s = line.trim();
    if (!s || s.startsWith('//') || s.startsWith('*') || s.startsWith('/*') || s.startsWith('import ')) return;
    const code = line.replace(/\/\/.*$/, '').replace(/\{\/\*.*?\*\/\}/g, '');
    // literalele de pe rând, fără cele aflate deja într-un tr( sau trServer(
    const lits = [...code.matchAll(/(tr|trServer)?\(?\s*(['"`])((?:\\.|(?!\2).)*)\2/g)].filter((m) => !m[1]).map((m) => m[3]);
    const jsx = [...code.matchAll(/>([^<>{}]*[A-Za-zăâîșțĂÂÎȘȚ][^<>{}]*)</g)].map((m) => m[1].trim());
    const hits = [...lits, ...jsx].filter((t) => RO.test(t) && !/^[\w./@:-]+$/.test(t));
    if (hits.length) { n++; console.log(`${f}:${i + 1}: ${hits.join(' | ').slice(0, 160)}`); }
  });
}
console.log(n ? `\n${n} rânduri de verificat.` : 'Nimic netradus găsit.');
