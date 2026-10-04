// A short report of src/data/venues.json in Markdown: places per category and, for every zone, how varied it is
// (used in the monthly OSM update's summary on GitHub; also handy locally).
import fs from 'node:fs';

const venues = JSON.parse(fs.readFileSync(process.argv[2] ?? 'src/data/venues.json', 'utf8'));
const zones = JSON.parse(fs.readFileSync(new URL('../src/data/zones.json', import.meta.url), 'utf8'));
const count = (list, f) => list.reduce((m, v) => ((m[f(v)] = (m[f(v)] || 0) + 1), m), {});
const byCat = count(venues, (v) => v.cat);
const lines = ['## Localuri: ' + venues.length, '', '| Categorie | Câte |', '|---|---|'];
for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) lines.push(`| ${c} | ${n} |`);
lines.push('', '## Pe zone', '', '| Zonă | Localuri | Categorii |', '|---|---|---|');
for (const z of zones) {
  const here = venues.filter((v) => v.zone === z.id);
  const cats = count(here, (v) => v.cat);
  lines.push(`| ${z.name} | ${here.length} | ${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => c + ' ' + n).join(', ')} |`);
}
console.log(lines.join('\n'));
