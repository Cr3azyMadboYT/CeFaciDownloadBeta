// Engleza: fiecare tr('…') din cod are traducere, cu aceleași {variabile}, și traducerile nu mai conțin română.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EN, setLang, tr, trServer } from '../src/i18n';

const ROOTS = ['mobile/src', 'src/engine', 'src/app', 'src/i18n'];
function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'en' ? [] : files(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [p] : [];
  });
}
/** Cheile scrise literal: tr('…'), tr("…"), tr(`…`) fără ${}. */
function keys(): { key: string; file: string }[] {
  const out: { key: string; file: string }[] = [];
  const re = /\btr\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g;
  for (const f of ROOTS.flatMap(files)) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(re)) {
      const raw = m[1] ?? m[2] ?? m[3] ?? '';
      out.push({ key: raw.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n'), file: f });
    }
  }
  return out;
}
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('engleza', () => {
  const all = keys();
  it('fiecare text din cod are traducere', () => {
    const missing = [...new Set(all.filter((k) => !(k.key in EN)).map((k) => k.file + ': ' + k.key))];
    expect(missing).toEqual([]);
  });
  it('traducerile păstrează aceleași {variabile}', () => {
    const bad = Object.entries(EN).filter(([ro, en]) => vars(ro) !== vars(en)).map(([ro]) => ro);
    expect(bad).toEqual([]);
  });
  it('în engleză nu rămân litere românești', () => {
    // numele de locuri și cartiere (Herăstrău, Floreasca…) pot apărea; restul nu
    const NAMES = /Herăstrău|Băneasa|Mogoșoaia|Văcărești|Tineretului|Cișmigiu|Bălan|Știrbei|Dâmbovița|Pipera|Ștefan|Brâncoveanu|Unirii|Victoriei|Romană|Pantelimon|Drumul Taberei|București|Snagov|Băile|Otopeni|Chitila|Măgurele|Bragadiru|Popești|Voluntari|Floreasca|Cotroceni|Dorobanți|Aviației|Grădina|Piața|Calea|Strada|Bulevardul|Șoseaua|Lacul|Parcul/g;
    const bad = Object.entries(EN).filter(([, en]) => /[ăâîșțĂÂÎȘȚşţŞŢ]/.test(en.replace(NAMES, ''))).map(([ro, en]) => ro + ' → ' + en);
    expect(bad).toEqual([]);
  });
  it('tr și trServer schimbă limba', () => {
    setLang('en');
    const k = Object.keys(EN)[0];
    if (k) expect(tr(k)).toBe(EN[k].replace(/\{\w+\}/g, (m) => m));
    expect(trServer('mesaj necunoscut')).toBe('mesaj necunoscut');
    setLang('ro');
    if (k) expect(tr(k)).toBe(k);
  });
});
