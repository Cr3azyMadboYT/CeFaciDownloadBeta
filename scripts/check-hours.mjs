// Compares the opening hours we have (OpenStreetMap / the venue's own site, the weekly `wk` table) with Google Maps,
// for the businesses only (31.10, Cornel: "doar restaurant, cafenea, arcade, businessuri", no parks or public places).
// One Text Search call per place. Only our verdict is kept (src/data/hours-check.json: which places agree, which
// differ and on which days); Google's hours are never written anywhere, so the report names the days, not the times.
// Usage: PLACES_API_KEY=… node scripts/check-hours.mjs [--limit N]
import fs from 'node:fs';

const key = process.env.PLACES_API_KEY;
if (!key) { console.error('Lipsește PLACES_API_KEY.'); process.exit(1); }
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
const BUSINESS = new Set(['mancare', 'cafea', 'bar', 'club', 'desert', 'activitate', 'sport', 'film']);
const venues = JSON.parse(fs.readFileSync('src/data/venues.json', 'utf8')).filter((v) => BUSINESS.has(v.cat)).slice(0, limit);
const TOL = 30; // minutes: a closing at 23:00 vs 23:30 still counts as the same
const DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

const km = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['restaurant', 'cafe', 'cafenea', 'bar', 'pub', 'the', 'si', 'de', 'la', 'and', 'bistro', 'club', 'pizzeria']);
const words = (s) => fold(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
const sameName = (a, b) => { const fa = fold(a), fb = fold(b); if (fa.includes(fb) || fb.includes(fa)) return true; const wb = new Set(words(b)); return words(a).some((w) => wb.has(w)); };

/** Google's weekly periods → the same shape as `wk`: per day (0 = Sunday), [from, to] minutes, split at midnight. */
function toWk(periods) {
  const wk = [[], [], [], [], [], [], []];
  if (periods.length === 1 && !periods[0].close) { for (const d of wk) d.push([0, 1440]); return wk; }
  for (const p of periods) {
    let s = p.open.day * 1440 + p.open.hour * 60 + p.open.minute;
    let e = p.close ? p.close.day * 1440 + p.close.hour * 60 + p.close.minute : s + 1440;
    if (e <= s) e += 7 * 1440;
    while (s < e) {
      const day = Math.floor(s / 1440), end = Math.min(e, (day + 1) * 1440);
      wk[day % 7].push([s - day * 1440, end - day * 1440]);
      s = end;
    }
  }
  return wk;
}
/** Merge touching pieces and drop the ones shorter than the tolerance (a few minutes past midnight). */
const norm = (list) => {
  const out = [];
  for (const [a, b] of [...list].sort((x, y) => x[0] - y[0])) { const l = out.at(-1); if (l && a <= l[1] + 1) l[1] = Math.max(l[1], b); else out.push([a, b]); }
  return out.filter(([a, b]) => b - a > TOL);
};
const sameDay = (x, y) => { const a = norm(x), b = norm(y); return a.length === b.length && a.every(([s, e], i) => Math.abs(s - b[i][0]) <= TOL && Math.abs(e - b[i][1]) <= TOL); };

async function lookup(v) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.businessStatus,places.regularOpeningHours.periods' },
      body: JSON.stringify({ textQuery: v.name, languageCode: 'ro', regionCode: 'RO', maxResultCount: 5, locationBias: { circle: { center: { latitude: v.lat, longitude: v.lon }, radius: 300 } } }),
    });
    if (res.status === 429 || res.status >= 500) { await new Promise((ok) => setTimeout(ok, 2000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error('Places ' + res.status + ': ' + (await res.text()).slice(0, 300));
    const found = ((await res.json()).places ?? []).map((p) => ({ p, m: km(v, { lat: p.location.latitude, lon: p.location.longitude }) * 1000 }))
      .filter(({ p, m }) => m < 250 && (m < 60 || sameName(v.name, p.displayName?.text ?? ''))).sort((a, b) => a.m - b.m)[0]?.p;
    return found ?? null;
  }
  throw new Error('Places: prea multe încercări');
}

const out = { checkedAt: new Date().toISOString().slice(0, 10), total: venues.length, agree: [], differ: {}, onlyGoogle: [], onlyOurs: [], neither: [], closed: [], notFound: [], errors: 0 };
let i = 0;
async function worker() {
  while (i < venues.length) {
    const v = venues[i++];
    try {
      const p = await lookup(v);
      if (!p) { out.notFound.push(v.id); continue; }
      if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') { out.closed.push(v.id); continue; }
      const g = p.regularOpeningHours?.periods?.length ? toWk(p.regularOpeningHours.periods) : null;
      if (!g && !v.wk) out.neither.push(v.id);
      else if (!g) out.onlyOurs.push(v.id);
      else if (!v.wk) out.onlyGoogle.push(v.id);
      else {
        const bad = [1, 2, 3, 4, 5, 6, 0].filter((d) => !sameDay(v.wk[d], g[d]));
        // our own hours text is kept next to it: import-osm.mjs drops it only while it is still that text
        if (bad.length) out.differ[v.id] = { days: bad, ours: v.hours }; else out.agree.push(v.id);
      }
    } catch (e) { console.error(v.id, e.message); out.errors++; if (/Places 40[13]/.test(e.message)) process.exit(1); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
for (const k of ['agree', 'onlyGoogle', 'onlyOurs', 'neither', 'closed', 'notFound']) out[k].sort();
fs.writeFileSync('src/data/hours-check.json', JSON.stringify(out, null, 1));

const name = new Map(venues.map((v) => [v.id, `${v.name} (${v.kind}, ${v.zone})`]));
const nDiff = Object.keys(out.differ).length;
const lines = [
  `## Programul comparat cu Google Maps (${out.checkedAt})`, '',
  `Localuri verificate: ${out.total} (fără parcuri, muzee, teatre, locuri publice).`, '',
  `- Programul nostru se potrivește: **${out.agree.length}**`,
  `- Diferă (cel puțin o zi, cu peste ${TOL} min): **${nDiff}**`,
  `- Google are program, noi nu: **${out.onlyGoogle.length}**`,
  `- Noi avem program, Google nu: ${out.onlyOurs.length}`,
  `- Niciunul nu are program: ${out.neither.length}`,
  `- Închise pe Google: ${out.closed.length} · negăsite: ${out.notFound.length} · erori: ${out.errors}`, '',
  '### Diferă (zilele în care nu se potrivește)',
  ...Object.entries(out.differ).sort((a, b) => b[1].days.length - a[1].days.length).map(([id, { days: d }]) => `- ${name.get(id)}: ${d.length === 7 ? 'toate zilele' : d.map((x) => DAYS[x]).join(', ')}`),
];
fs.writeFileSync('docs/verificare-program.md', lines.join('\n'));
console.log(lines.slice(0, 10).join('\n'));
