// Turns an Overpass JSON export (OpenStreetMap) into the compact venue list the app ships with.
// Usage: node scripts/import-osm.mjs <overpass.json> [out=src/data/venues.json]
// What is kept and how it is labelled: scripts/osm-kinds.mjs. The query: node scripts/osm-query.mjs.
import fs from 'node:fs';
import { classify } from './osm-kinds.mjs';

const [, , inFile, outFile = 'src/data/venues.json'] = process.argv;
const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const centre = (g) => {
  if (!g) return [null, null];
  if (g.type === 'Point') return [g.coordinates[1], g.coordinates[0]];
  const pts = JSON.stringify(g.coordinates).match(/-?\d+\.\d+,-?\d+\.\d+/g).map((p) => p.split(',').map(Number));
  return [pts.reduce((a, p) => a + p[1], 0) / pts.length, pts.reduce((a, p) => a + p[0], 0) / pts.length];
};
const els = raw.elements ?? raw.features?.map((f) => { const [lat, lon] = centre(f.geometry); const [type, id] = (f.id || f.properties['@id'] || '').split('/'); return { type, id, tags: f.properties, lat, lon }; }) ?? [];

// Same zones as src/engine/catalog.ts (kept in sync by the test).
const ZONES = JSON.parse(fs.readFileSync(new URL('../src/data/zones.json', import.meta.url), 'utf8'));
const km = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const AIRPORT = { lat: 44.5711, lon: 26.085 }; // Henri Coandă, the terminal
const BAD_NAME = /^(bar|restaurant|cafenea|cafe|pub|fast ?food|terasa|bistro|test|parc|park|scuar|teren(ul|uri)?( de)?( \S+){0,2}|baz[aă] sportiv[aă]|piscin[aă]|bazin(ul)?( de)? [iî]not|\?|-)$/i;
// size of a mapped area (km, corner to corner), from Overpass "out bb"
const spanKm = (b) => (b ? km({ lat: b.minlat, lon: b.minlon }, { lat: b.maxlat, lon: b.maxlon }) : 0);
// places Google Maps says closed (scripts/verify-places.mjs): left out, so they go to gone.json
const checkedFile = new URL('../src/data/checked.json', import.meta.url);
const checked = fs.existsSync(checkedFile) ? JSON.parse(fs.readFileSync(checkedFile, 'utf8')) : {};
const shut = new Set([...(checked.closed ?? []), ...(checked.temporary ?? [])]);
const out = [];
const seen = new Map();
let skipped = { noName: 0, noPos: 0, generic: 0, closed: 0, dupe: 0, kind: 0, small: 0 };
const seenId = new Set();

for (const e of els) {
  const t = e.tags ?? {};
  const name = clean(t['name:ro'] || t.name);
  if (!name) { skipped.noName++; continue; }
  if (BAD_NAME.test(name)) { skipped.generic++; continue; }
  if (t['disused:amenity'] || t.disused === 'yes' || t['was:amenity'] || /closed|inchis definitiv/i.test(t.note ?? '') || /^fost(a|ul)?\b|scoase? din uz|dezafectat|abandonat/i.test(name)) { skipped.closed++; continue; }
  if (shut.has(e.type[0] + e.id)) { skipped.shut = (skipped.shut || 0) + 1; continue; }
  const kind = classify(t);
  if (!kind) { skipped.kind++; continue; }
  if (kind.k === 'soccer' && /^stadion/i.test(name)) { skipped.kind++; continue; } // a club's stadium: nobody rents it for a game
  const key = kind.k, cat = kind.cat;
  const uid = e.type + e.id;
  if (seenId.has(uid)) { skipped.dupe++; continue; }
  seenId.add(uid);
  // a park is a place to go only when it is a real park, not a patch of grass between blocks (or it is well known)
  if ((key === 'park' || key === 'nature_reserve') && !t.wikidata && spanKm(e.bounds) < 0.25) { skipped.small++; continue; }
  const lat = e.lat ?? e.center?.lat ?? (e.bounds && (e.bounds.minlat + e.bounds.maxlat) / 2);
  const lon = e.lon ?? e.center?.lon ?? (e.bounds && (e.bounds.minlon + e.bounds.maxlon) / 2);
  if (lat == null || lon == null) { skipped.noPos++; continue; }
  const p = { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
  const dk = name.toLowerCase();
  const prev = seen.get(dk);
  if (prev && prev.some((q) => km(q, p) < 0.3)) { skipped.dupe++; continue; }
  seen.set(dk, (prev ?? []).concat([p]));
  const zone = ZONES.reduce((b, z) => (km(p, z) < km(p, b) ? z : b), ZONES[0]);
  if (km(p, zone) > 11) { skipped.outside = (skipped.outside || 0) + 1; continue; } // bounding box spills into neighbouring counties
  if (kind.cityOnlyIfSight && zone.area === 'București') { skipped.kind++; continue; }
  // the cafés and bars inside Otopeni airport (open 24/7, most of them after security) are not a night out
  if (km(p, AIRPORT) < 0.8) { skipped.airport = (skipped.airport || 0) + 1; continue; }
  const cuisines = (t.cuisine ?? '').split(/[;,]/).map((c) => c.trim().toLowerCase()).filter(Boolean).slice(0, 4);
  const street = clean([t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '));
  const v = { id: e.type[0] + e.id, name, cat, kind: kind.label, k: key, cuisines, lat: p.lat, lon: p.lon, zone: zone.id };
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
  else if (t.wheelchair === 'limited') v.wheelLimited = true;
  if (/^(wlan|yes|wifi|public)$/.test(t.internet_access ?? '')) v.wifi = true;
  const smoke = t.smoking ?? '';
  if (smoke === 'no') v.smoke = 'no'; else if (smoke === 'outside') v.smoke = 'outside'; else if (/^(yes|separated|isolated|dedicated)$/.test(smoke)) v.smoke = 'yes';
  if (t.air_conditioning === 'yes') v.ac = true;
  for (const d of ['vegan', 'vegetarian', 'gluten_free']) if (/^(yes|only)$/.test(t['diet:' + d] ?? '') && !v.cuisines.includes(d)) v.cuisines.push(d);
  if (t.wikidata) v.famous = true; // has its own Wikipedia/Wikidata page: a known place even when the map lacks hours
  const minAge = parseInt(t.min_age || t['age:min'] || '', 10); // a place that asks for ID at the door
  if (minAge >= 16) v.minAge = minAge;
  if (key === 'fast_food') v.fast = true;
  out.push(v);
}
// every place still on the map and open (closed ones were left out above), before the hand-picked list narrows it
const onMap = new Set(out.map((v) => v.id));
// The hand-picked list (src/data/curated.json, scripts/curate.mjs, decision Cornel 05.10): only the map's places the
// research kept stay (with their story), and the good places the map lacks are added. Without the file, all stay.
const curatedFile = new URL('../src/data/curated.json', import.meta.url);
const curated = fs.existsSync(curatedFile) ? JSON.parse(fs.readFileSync(curatedFile, 'utf8')) : null;
// the engine's kinds (src/engine/catalog.ts KINDS): category and label, for the added places (checked by a test)
export const KIND_CAT = {
  restaurant: ['mancare', 'Restaurant'], fast_food: ['mancare', 'Fast food'], food_market: ['mancare', 'Food market'], cafe: ['cafea', 'Cafenea'],
  ice_cream: ['desert', 'Desert'], bar: ['bar', 'Bar'], pub: ['bar', 'Pub'], biergarten: ['bar', 'Grădină cu bere'], nightclub: ['club', 'Club'],
  cinema: ['film', 'Cinema'], theatre: ['teatru', 'Teatru'], arts_centre: ['cultura', 'Centru cultural'], museum: ['cultura', 'Muzeu'],
  gallery: ['cultura', 'Galerie'], event_space: ['cultura', 'Spațiu de evenimente'], planetarium: ['cultura', 'Planetariu'], castle: ['cultura', 'Castel'],
  palace: ['cultura', 'Palat'], manor: ['cultura', 'Conac'], monastery: ['cultura', 'Mănăstire'], bowling_alley: ['activitate', 'Bowling'],
  escape_game: ['activitate', 'Escape room'], amusement_arcade: ['activitate', 'Jocuri'], trampoline_park: ['activitate', 'Trambuline'],
  miniature_golf: ['activitate', 'Minigolf'], ice_rink: ['activitate', 'Patinoar'], water_park: ['activitate', 'Parc acvatic'],
  theme_park: ['activitate', 'Parc de distracții'], zoo: ['activitate', 'Grădină zoologică'], aquarium: ['activitate', 'Acvariu'],
  karting: ['activitate', 'Karting'], paintball: ['activitate', 'Paintball'], billiards: ['activitate', 'Biliard'], park: ['natura', 'Parc'],
  square: ['natura', 'Loc de întâlnire'], promenade: ['natura', 'Promenadă'], nature_reserve: ['natura', 'Rezervație naturală'],
  botanical_garden: ['natura', 'Grădină botanică'], beach_resort: ['natura', 'Plajă'], padel: ['sport', 'Padel'], tennis: ['sport', 'Tenis'],
  soccer: ['sport', 'Fotbal'], squash: ['sport', 'Squash'], swimming: ['sport', 'Piscină'], climbing: ['sport', 'Escaladă'],
  golf_course: ['sport', 'Golf'], horse_riding: ['sport', 'Călărie'],
};
const CUISINE_WORDS = { 'pizza': 'pizza', 'burger': 'burger', 'sushi': 'sushi', 'japonez': 'japanese', 'italian': 'italian', 'românesc': 'romanian', 'romanesc': 'romanian', 'româneasc': 'romanian', 'grecesc': 'greek', 'grecească': 'greek', 'turcesc': 'turkish', 'libanez': 'lebanese', 'asiatic': 'asian', 'chinezesc': 'chinese', 'thai': 'thai', 'indian': 'indian', 'mexican': 'mexican', 'american': 'american', 'steak': 'steak_house', 'pește': 'seafood', 'peste': 'seafood', 'kebab': 'kebab', 'shaorma': 'shawarma', 'vegan': 'vegan', 'vegetarian': 'vegetarian', 'franțuz': 'french', 'francez': 'french', 'spaniol': 'spanish', 'cafea': 'coffee_shop', 'prăjitur': 'cake', 'desert': 'dessert', 'înghețat': 'ice_cream', 'gelato': 'ice_cream', 'grătar': 'grill', 'brunch': 'breakfast', 'mic dejun': 'breakfast', 'coreean': 'korean', 'vietnamez': 'vietnamese', 'oriental': 'middle_eastern', 'chinezeasc': 'chinese', 'turceasc': 'turkish', 'grec': 'greek', 'japon': 'japanese', 'liban': 'lebanese', 'arab': 'lebanese', 'sirian': 'middle_eastern', 'thailandez': 'thai', 'italia': 'italian', 'napolitan': 'pizza' };
/** The engine's cuisine keys named in the research's words ("sushi, japoneză" → sushi, japanese). */
const cuisinesIn = (text) => { const words = (text ?? '').toLowerCase(); return [...new Set(Object.entries(CUISINE_WORDS).filter(([w]) => words.includes(w)).map(([, k]) => k))]; };
if (curated) {
  const picked = curated.keep ?? {};
  let dropped = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    const f = picked[out[i].id];
    if (!f) { out.splice(i, 1); dropped++; continue; }
    const v = out[i];
    v.pick = true;
    if (f.story) v.story = f.story;
    if (f.crowd) v.crowd = f.crowd;
    if (f.vibes?.length) v.vibes = f.vibes;
    if (typeof f.price === 'number') v.price = f.price;
    // the cuisine the research names (the map often lacks it: a Thai place with no cuisine is not found by "thai")
    if (f.cuisine) v.cuisines = [...new Set([...v.cuisines, ...cuisinesIn(f.cuisine)])].slice(0, 4);
    // the research saw what it really is: a billiard hall the map calls a bar, a bowling club mapped as its terrace
    if (f.k && KIND_CAT[f.k] && KIND_CAT[f.k][0] !== v.cat) { v.k = f.k; v.cat = KIND_CAT[f.k][0]; v.kind = f.kind || KIND_CAT[f.k][1]; if (f.k !== 'fast_food') delete v.fast; }
    if (f.terrace) v.outdoor = true;
  }
  let added = 0;
  for (const c of curated.add ?? []) {
    const kc = KIND_CAT[c.k];
    if (!kc) continue;
    const p = { lat: c.lat, lon: c.lon };
    const zone = ZONES.reduce((b, z) => (km(p, z) < km(p, b) ? z : b), ZONES[0]);
    if (km(p, zone) > 25) continue;
    const cuisines = cuisinesIn(c.cuisine).slice(0, 3);
    const v = { id: c.id, name: c.name, cat: kc[0], kind: c.kind || kc[1], k: c.k, cuisines, lat: c.lat, lon: c.lon, zone: zone.id, pick: true };
    if (c.city) v.city = c.city;
    if (c.story) v.story = c.story;
    if (c.crowd) v.crowd = c.crowd;
    if (c.vibes?.length) v.vibes = c.vibes;
    if (typeof c.price === 'number') v.price = c.price;
    if (c.terrace) v.outdoor = true;
    if (c.k === 'fast_food') v.fast = true;
    out.push(v);
    added++;
  }
  skipped.notPicked = dropped;
  skipped.addedByHand = added;
}
// pools inside an aqua park (Therme maps each one) are the aqua park itself
const parks = out.filter((v) => v.k === 'water_park');
for (let i = out.length - 1; i >= 0; i--) if (out[i].k === 'swimming' && parks.some((w) => km(w, out[i]) < 0.6)) { out.splice(i, 1); skipped.dupe++; }
out.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
// Places that vanished from the map since the last import go to gone.json (kept 6 months), so plans and stamps made
// for them still open and say the place looks closed; a place that comes back leaves gone.json.
const goneFile = new URL('../src/data/gone.json', import.meta.url);
const today = new Date().toISOString().slice(0, 10);
const keep = new Date(Date.now() - 183 * 864e5).toISOString().slice(0, 10);
const before = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : [];
const ids = new Set(out.map((v) => v.id));
// a place we did not choose is still on the map: it is not "gone" (old plans for it just no longer find it)
const unpicked = (id) => !!curated && onMap.has(id);
const gone = (fs.existsSync(goneFile) ? JSON.parse(fs.readFileSync(goneFile, 'utf8')) : []).filter((v) => !ids.has(v.id) && v.gone >= keep && !unpicked(v.id));
const goneIds = new Set(gone.map((v) => v.id));
for (const v of before) if (!ids.has(v.id) && !goneIds.has(v.id) && !unpicked(v.id)) { const { wk, hours, ...rest } = v; void wk; void hours; gone.push({ ...rest, gone: today }); }
fs.writeFileSync(goneFile, JSON.stringify(gone));
fs.writeFileSync(outFile, JSON.stringify(out));
const byCat = out.reduce((m, v) => ((m[v.cat] = (m[v.cat] || 0) + 1), m), {});
console.log(JSON.stringify({ in: els.length, kept: out.length, gone: gone.length, skipped, byCat, withHours: out.filter((v) => v.hours).length, bytes: fs.statSync(outFile).size }, null, 1));
