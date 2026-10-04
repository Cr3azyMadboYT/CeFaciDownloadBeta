// Checks every place against Google Maps (Places API, Text Search) to find the ones that closed for good or for a
// while, so the app never sends anyone to a closed door (decision Cornel, 04.10: "vrem să surprindem oamenii").
// Keeps only our own verdict per OSM id in src/data/checked.json (no Google content is stored); import-osm.mjs then
// leaves out the closed ones (they move to gone.json, so old plans still open).
// Usage: PLACES_API_KEY=… node scripts/verify-places.mjs [--limit N]
import fs from 'node:fs';

const key = process.env.PLACES_API_KEY;
if (!key) { console.error('Lipsește PLACES_API_KEY.'); process.exit(1); }
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
const read = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const before = read('src/data/checked.json', { temporary: [] });
// the places shown in the app, plus the ones hidden last time as closed for a while (they may have reopened)
const venues = [...read('src/data/venues.json', []), ...read('src/data/gone.json', []).filter((v) => before.temporary?.includes(v.id))].slice(0, limit);
const km = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['restaurant', 'cafe', 'cafenea', 'bar', 'pub', 'the', 'si', 'de', 'la', 'and', 'bistro', 'club', 'pizzeria', 'parcul', 'parc', 'muzeul']);
const words = (s) => fold(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
/** The names are about the same place: a real word in common, or one name contains the other. */
function sameName(a, b) {
  const fa = fold(a), fb = fold(b);
  if (fa.includes(fb) || fb.includes(fa)) return true;
  const wb = new Set(words(b));
  return words(a).some((w) => wb.has(w));
}

async function lookup(v) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.businessStatus,places.location' },
      body: JSON.stringify({ textQuery: v.name, languageCode: 'ro', regionCode: 'RO', maxResultCount: 5, locationBias: { circle: { center: { latitude: v.lat, longitude: v.lon }, radius: 300 } } }),
    });
    if (res.status === 429 || res.status >= 500) { await new Promise((ok) => setTimeout(ok, 2000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error('Places ' + res.status + ': ' + (await res.text()).slice(0, 300));
    const data = await res.json();
    const found = (data.places ?? []).map((p) => ({ status: p.businessStatus ?? 'OPERATIONAL', m: km(v, { lat: p.location.latitude, lon: p.location.longitude }) * 1000, name: p.displayName?.text ?? '' }))
      .filter((p) => p.m < 250 && (p.m < 60 || sameName(v.name, p.name)))
      .sort((a, b) => a.m - b.m);
    return found[0]?.status ?? 'NOT_FOUND';
  }
  return 'ERROR';
}

const out = { checkedAt: new Date().toISOString().slice(0, 10), closed: [], temporary: [], notFound: [], errors: 0, total: venues.length };
let i = 0;
async function worker() {
  while (i < venues.length) {
    const v = venues[i++];
    let s;
    try { s = await lookup(v); } catch (e) { console.error(v.id, e.message); s = 'ERROR'; if (/40[13]/.test(e.message)) process.exit(1); }
    if (s === 'CLOSED_PERMANENTLY') out.closed.push(v.id);
    else if (s === 'CLOSED_TEMPORARILY') out.temporary.push(v.id);
    else if (s === 'NOT_FOUND') out.notFound.push(v.id);
    else if (s === 'ERROR') out.errors++;
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
for (const k of ['closed', 'temporary', 'notFound']) out[k].sort();
fs.writeFileSync('src/data/checked.json', JSON.stringify(out, null, 1));
const name = new Map(venues.map((v) => [v.id, v.name + ' (' + v.kind + ', ' + v.zone + ')']));
const lines = ['## Verificarea locurilor (' + out.checkedAt + ')', '', `Verificate: ${out.total}. Închise definitiv: **${out.closed.length}**. Închise temporar: **${out.temporary.length}**. Negăsite pe Google: ${out.notFound.length}. Erori: ${out.errors}.`, '', '### Închise definitiv (scoase din aplicație)', ...out.closed.map((id) => '- ' + name.get(id)), '', '### Închise temporar (ascunse până la următoarea verificare)', ...out.temporary.map((id) => '- ' + name.get(id))];
fs.writeFileSync('verificare.md', lines.join('\n'));
console.log(lines.slice(0, 3).join('\n'));
