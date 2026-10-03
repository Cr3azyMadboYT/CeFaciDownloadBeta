// Turns an Overpass JSON export (OpenStreetMap) into the compact venue list the app ships with.
// Usage: node scripts/import-osm.mjs <overpass.json> [out=src/data/venues.json]
import fs from 'node:fs';

const [, , inFile, outFile = 'src/data/venues.json'] = process.argv;
const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const centre = (g) => {
  if (!g) return [null, null];
  if (g.type === 'Point') return [g.coordinates[1], g.coordinates[0]];
  const pts = JSON.stringify(g.coordinates).match(/-?\d+\.\d+,-?\d+\.\d+/g).map((p) => p.split(',').map(Number));
  return [pts.reduce((a, p) => a + p[1], 0) / pts.length, pts.reduce((a, p) => a + p[0], 0) / pts.length];
};
const els = raw.elements ?? raw.features?.map((f) => { const [lat, lon] = centre(f.geometry); const [type, id] = (f.id || f.properties['@id'] || '').split('/'); return { type, id, tags: f.properties, lat, lon }; }) ?? [];

const KIND = {
  amenity: { restaurant: 'mancare', fast_food: 'mancare', cafe: 'cafea', ice_cream: 'desert', bar: 'bar', pub: 'bar', biergarten: 'bar', nightclub: 'club', cinema: 'film', theatre: 'teatru', arts_centre: 'cultura' },
  leisure: { bowling_alley: 'activitate', escape_game: 'activitate', amusement_arcade: 'activitate', trampoline_park: 'activitate', water_park: 'activitate', miniature_golf: 'activitate', ice_rink: 'activitate' },
  tourism: { museum: 'cultura', gallery: 'cultura', zoo: 'activitate', theme_park: 'activitate' },
};
const LABEL = { restaurant: 'Restaurant', fast_food: 'Fast food', cafe: 'Cafenea', ice_cream: 'Gelaterie', bar: 'Bar', pub: 'Pub', biergarten: 'Grădină de bere', nightclub: 'Club', cinema: 'Cinema', theatre: 'Teatru', arts_centre: 'Centru cultural', museum: 'Muzeu', gallery: 'Galerie', bowling_alley: 'Bowling', escape_game: 'Escape room', amusement_arcade: 'Jocuri arcade', trampoline_park: 'Trambuline', miniature_golf: 'Minigolf', ice_rink: 'Patinoar', water_park: 'Parc acvatic', theme_park: 'Parc de distracții', zoo: 'Grădină zoologică' };

// Same zones as src/engine/catalog.ts (kept in sync by the test).
const ZONES = JSON.parse(fs.readFileSync(new URL('../src/data/zones.json', import.meta.url), 'utf8'));
const km = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const BAD_NAME = /^(bar|restaurant|cafenea|cafe|pub|fast ?food|terasa|bistro|test|\?|-)$/i;
const out = [];
const seen = new Map();
let skipped = { noName: 0, noPos: 0, generic: 0, closed: 0, dupe: 0, kind: 0 };

for (const e of els) {
  const t = e.tags ?? {};
  const name = clean(t['name:ro'] || t.name);
  if (!name) { skipped.noName++; continue; }
  if (BAD_NAME.test(name)) { skipped.generic++; continue; }
  if (t['disused:amenity'] || t.disused === 'yes' || t['was:amenity'] || /closed|inchis definitiv/i.test(t.note ?? '')) { skipped.closed++; continue; }
  let key = null, cat = null;
  for (const k of ['amenity', 'leisure', 'tourism']) if (KIND[k][t[k]]) { key = t[k]; cat = KIND[k][t[k]]; break; }
  if (!key) { skipped.kind++; continue; }
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  if (lat == null || lon == null) { skipped.noPos++; continue; }
  const p = { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
  const dk = name.toLowerCase();
  const prev = seen.get(dk);
  if (prev && prev.some((q) => km(q, p) < 0.3)) { skipped.dupe++; continue; }
  seen.set(dk, (prev ?? []).concat([p]));
  const zone = ZONES.reduce((b, z) => (km(p, z) < km(p, b) ? z : b), ZONES[0]);
  if (km(p, zone) > 11) { skipped.outside = (skipped.outside || 0) + 1; continue; } // bounding box spills into neighbouring counties
  const cuisines = (t.cuisine ?? '').split(/[;,]/).map((c) => c.trim().toLowerCase()).filter(Boolean).slice(0, 4);
  const street = clean([t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '));
  const v = { id: e.type[0] + e.id, name, cat, kind: LABEL[key], k: key, cuisines, lat: p.lat, lon: p.lon, zone: zone.id };
  if (street) v.street = street;
  if (t['addr:city']) v.city = clean(t['addr:city']);
  if (t.opening_hours) v.hours = t.opening_hours;
  if (t.outdoor_seating === 'yes') v.outdoor = true;
  const site = t.website || t['contact:website'];
  if (site) v.website = /^https?:\/\//.test(site) ? site : 'https://' + site;
  const phone = t.phone || t['contact:phone'];
  if (phone) v.phone = phone.split(';')[0].trim();
  if (t.brand || t['brand:wikidata']) v.brand = t.brand || name;
  if (t.wheelchair === 'yes') v.wheelchair = true;
  const minAge = parseInt(t.min_age || t['age:min'] || '', 10); // a place that asks for ID at the door
  if (minAge >= 16) v.minAge = minAge;
  if (key === 'fast_food') v.fast = true;
  out.push(v);
}
out.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
fs.writeFileSync(outFile, JSON.stringify(out));
const byCat = out.reduce((m, v) => ((m[v.cat] = (m[v.cat] || 0) + 1), m), {});
console.log(JSON.stringify({ in: els.length, kept: out.length, skipped, byCat, withHours: out.filter((v) => v.hours).length, bytes: fs.statSync(outFile).size }, null, 1));
