// The second level of places (decision Cornel, 05.10: "nu sunt cam puține locuri?" → "dai drumu"): the map's places
// that the research did not choose (it kept only the ones somebody wrote about, so the towns and the outer
// neighbourhoods came out almost empty) are checked on Google Maps, and the ones people rate well stay in the app,
// after the chosen ones. Only our own verdict per OSM id is kept (src/data/rated.json): no rating, no count, nothing
// of Google's (their terms allow keeping the place id only). The monthly check (verify-places.mjs) then also looks
// at these, so a closed one leaves.
// Rule: open, rated at least 4.4 by at least 150 people (60 in the Ilfov towns, where fewer people review); not a
// chain, not a place the research left out for a reason (closed, moved, a duplicate, not open to the public).
// Usage: PLACES_API_KEY=… node scripts/rate-places.mjs [--limit N]   (needs data-raw/candidates.json from import-osm)
//        node scripts/rate-places.mjs --dry   (how many would be checked, without calling Google)
import fs from 'node:fs';

const key = process.env.PLACES_API_KEY;
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
const read = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);

const all = read('data-raw/candidates.json', null);
if (!all) { console.error('Lipsește data-raw/candidates.json: rulează întâi scripts/import-osm.mjs.'); process.exit(1); }
const curated = read('src/data/curated.json', { keep: {}, drop: {} });
const checked = read('src/data/checked.json', {});
const shut = new Set([...(checked.closed ?? []), ...(checked.temporary ?? [])]);
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
// chains: a brand on the map, or the same name three times or more
const base = (n) => fold(n).replace(/\s*(-|\||\().*$/, '').trim();
const seen = new Map();
for (const v of all) seen.set(base(v.name), (seen.get(base(v.name)) ?? 0) + 1);
const chain = (v) => !!v.brand || (seen.get(base(v.name)) ?? 0) >= 3;
// the research left these out for a reason a good rating does not change
const REASON = /inchis|închis|duplicat|mutat|nu e (un )?loc|nu e deschis|privat|nunt|nunț|scoal|școal|universit|fast|lant|lanț|chain|delivery|livrare/i;
const ILFOV = new Set(['voluntari', 'popesti', 'otopeni', 'chitila', 'magurele', 'chiajna', 'pantelimon', 'buftea', 'bragadiru', 'mogosoaia', 'snagov', 'corbeanca']);
// what people go out for (a playground or a school gym is not)
const CATS = new Set(['mancare', 'cafea', 'desert', 'bar', 'club', 'activitate', 'cultura', 'teatru', 'film', 'sport', 'natura']);

const todo = all.filter((v) => !curated.keep?.[v.id] && CATS.has(v.cat) && !chain(v) && !shut.has(v.id) && !REASON.test(curated.drop?.[v.id] ?? '')).slice(0, limit);
if (process.argv.includes('--dry')) {
  const z = {}; for (const v of todo) z[v.zone] = (z[v.zone] ?? 0) + 1;
  console.log(JSON.stringify({ deVerificat: todo.length, peZone: z }));
  process.exit(0);
}
if (!key) { console.error('Lipsește PLACES_API_KEY.'); process.exit(1); }
const km = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const STOP = new Set(['restaurant', 'cafe', 'cafenea', 'bar', 'pub', 'the', 'si', 'de', 'la', 'and', 'bistro', 'club', 'pizzeria', 'parcul', 'parc', 'muzeul']);
const words = (s) => fold(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
const sameName = (a, b) => { const fa = fold(a), fb = fold(b); if (fa.includes(fb) || fb.includes(fa)) return true; const wb = new Set(words(b)); return words(a).some((w) => wb.has(w)); };

/** Google's view of one place: open or not, and whether people rate it well (the verdict only leaves this function). */
async function verdict(v) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.displayName,places.businessStatus,places.location,places.rating,places.userRatingCount' },
      body: JSON.stringify({ textQuery: v.name, languageCode: 'ro', regionCode: 'RO', maxResultCount: 5, locationBias: { circle: { center: { latitude: v.lat, longitude: v.lon }, radius: 300 } } }),
    });
    if (res.status === 429 || res.status >= 500) { await new Promise((ok) => setTimeout(ok, 2000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error('Places ' + res.status + ': ' + (await res.text()).slice(0, 300));
    const data = await res.json();
    const p = (data.places ?? []).map((x) => ({ x, m: km(v, { lat: x.location.latitude, lon: x.location.longitude }) * 1000 }))
      .filter(({ x, m }) => m < 250 && (m < 60 || sameName(v.name, x.displayName?.text ?? '')))
      .sort((a, b) => a.m - b.m)[0]?.x;
    if (!p) return 'negasit';
    if ((p.businessStatus ?? 'OPERATIONAL') !== 'OPERATIONAL') return 'inchis';
    const need = ILFOV.has(v.zone) ? 60 : 150;
    return (p.rating ?? 0) >= 4.4 && (p.userRatingCount ?? 0) >= need ? 'bun' : 'slab';
  }
  return 'eroare';
}

const out = { checkedAt: new Date().toISOString().slice(0, 10), rule: 'deschis, notă ≥ 4,4 de la ≥ 150 de oameni (≥ 60 în orașele din Ilfov), fără lanțuri', good: [], counts: { bun: 0, slab: 0, inchis: 0, negasit: 0, eroare: 0 }, total: todo.length };
let i = 0;
async function worker() {
  while (i < todo.length) {
    const v = todo[i++];
    let s;
    try { s = await verdict(v); } catch (e) { console.error(v.id, e.message); s = 'eroare'; if (/40[13]/.test(e.message)) process.exit(1); }
    out.counts[s]++;
    if (s === 'bun') out.good.push(v.id);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
out.good.sort();
fs.writeFileSync('src/data/rated.json', JSON.stringify(out, null, 1));
const byZone = {};
const name = new Map(all.map((v) => [v.id, v]));
for (const id of out.good) { const z = name.get(id).zone; byZone[z] = (byZone[z] ?? 0) + 1; }
const lines = ['## Locuri bine cotate (' + out.checkedAt + ')', '', 'Regula: ' + out.rule + '.', '', `Verificate: ${out.total}. Bune: **${out.counts.bun}**. Sub notă: ${out.counts.slab}. Închise: ${out.counts.inchis}. Negăsite: ${out.counts.negasit}. Erori: ${out.counts.eroare}.`, '', '### Pe zone', ...Object.entries(byZone).sort((a, b) => b[1] - a[1]).map(([z, n]) => '- ' + z + ': ' + n), '', '### Locurile', ...out.good.map((id) => '- ' + name.get(id).name + ' (' + name.get(id).kind + ', ' + name.get(id).zone + ')')];
fs.writeFileSync('docs/locuri-bine-cotate.md', lines.join('\n'));
console.log(lines.slice(0, 5).join('\n'));
