// Builds src/data/curated.json, the hand-picked list of places CeFaci shows (decision Cornel, 05.10: "degeaba avem
// 3000 dacă doar 200 sunt bune": only places open now, worth going to, with a story; parks people really go to;
// the places where people gather). Input: the research files (JSON, one per area: nightlife, food, culture and
// activities, nature, gathering spots), each with "places" (and "decisions" for the map's places it checked).
// A place from the map is kept only when the research kept it; places the map lacks are added with their own id.
// Usage: node scripts/curate.mjs out-*.json  → src/data/curated.json (import-osm.mjs then keeps only these)
import fs from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) { console.error('Usage: node scripts/curate.mjs <research.json>…'); process.exit(1); }
const venues = JSON.parse(fs.readFileSync('src/data/venues.json', 'utf8'));
const gone = JSON.parse(fs.readFileSync('src/data/gone.json', 'utf8'));
const known = new Map([...gone, ...venues].map((v) => [v.id, v]));
const before = fs.existsSync('src/data/curated.json') ? JSON.parse(fs.readFileSync('src/data/curated.json', 'utf8')) : null;

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const km = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const VIBES = new Set(['Mâncare bună', 'Chill', 'Party', 'Fun', 'Competitiv', 'Cultură', 'Aer liber']);

/** The engine's kind for a researched place (src/engine/catalog.ts KINDS), from its category and label. */
function kindOf(p) {
  const t = fold((p.kind ?? '') + ' ' + (p.name ?? '') + ' ' + (p.cuisine ?? ''));
  const has = (re) => re.test(t);
  switch (p.cat) {
    case 'loc':
      if (has(/food|street food|market|piata de|piața de/)) return 'food_market';
      if (has(/promenad|faleza|malul|lac|canal/)) return 'promenade';
      return 'square';
    case 'natura':
      if (has(/botanic/)) return 'botanical_garden';
      if (has(/padure|rezervat|delta|natura 2000|forest/)) return 'nature_reserve';
      if (has(/plaja|beach|strand/)) return 'beach_resort';
      if (has(/promenad|faleza/)) return 'promenade';
      return 'park';
    case 'bar': return has(/club/) && !has(/club de jazz|jazz club|book club/) ? 'nightclub' : has(/pub|bere|beer|craft/) ? 'pub' : has(/gradin|biergarten|terasa/) ? 'biergarten' : 'bar';
    case 'club': return 'nightclub';
    case 'cafea': return 'cafe';
    case 'desert': return 'ice_cream';
    case 'mancare':
      if (has(/food market|food court|food hall|piata|piața|market/)) return 'food_market';
      if (has(/fast|shaorma|shawarma|kebab|burger|street|hot ?dog|pizza la felie|sandvis|covrig|gogos/)) return 'fast_food';
      return 'restaurant';
    case 'teatru': return 'theatre';
    case 'film': return 'cinema';
    case 'cultura':
      if (has(/muzeu|museum|expozit/)) return 'museum';
      if (has(/galeri/)) return 'gallery';
      if (has(/palat/)) return 'palace';
      if (has(/castel/)) return 'castle';
      if (has(/conac/)) return 'manor';
      if (has(/manastir/)) return 'monastery';
      if (has(/planetar/)) return 'planetarium';
      if (has(/teatr|stand-?up|comedy/)) return 'theatre';
      if (has(/cinema/)) return 'cinema';
      if (has(/concert|arena|sala de|evenimente|festival/)) return 'event_space';
      return 'arts_centre';
    case 'activitate':
      if (has(/escape/)) return 'escape_game';
      if (has(/bowling/)) return 'bowling_alley';
      if (has(/karting/)) return 'karting';
      if (has(/trambulin|jump/)) return 'trampoline_park';
      if (has(/patinoar|skating|ice/)) return 'ice_rink';
      if (has(/biliard|snooker/)) return 'billiards';
      if (has(/paintball|airsoft/)) return 'paintball';
      if (has(/minigolf/)) return 'miniature_golf';
      if (has(/therme|acva|aqua|strand|parc acvatic/)) return 'water_park';
      if (has(/zoo/)) return 'zoo';
      if (has(/acvariu|aquarium/)) return 'aquarium';
      if (has(/distractii|lunapark|parc tematic/)) return 'theme_park';
      if (has(/padel/)) return 'padel';
      if (has(/escalad|climb|boulder/)) return 'climbing';
      return 'amusement_arcade';
    case 'sport':
      if (has(/padel/)) return 'padel';
      if (has(/tenis/)) return 'tennis';
      if (has(/squash/)) return 'squash';
      if (has(/escalad|climb|boulder/)) return 'climbing';
      if (has(/inot|piscin|swim|bazin/)) return 'swimming';
      if (has(/fotbal|minifotbal/)) return 'soccer';
      if (has(/golf/)) return 'golf_course';
      if (has(/calari|cai|horse|echit/)) return 'horse_riding';
      if (has(/karting/)) return 'karting';
      if (has(/bowling/)) return 'bowling_alley';
      return null;
    default: return null;
  }
}

const keep = {};
const add = [];
const drop = {};
const skipped = [];
const usedIds = new Set();
const say = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : undefined);
const facts = (p) => {
  const o = {};
  if (say(p.story)) o.story = say(p.story);
  if (say(p.when)) o.crowd = say(p.when);
  const vibes = (p.vibes ?? []).filter((x) => VIBES.has(x));
  if (vibes.length) o.vibes = vibes;
  if (typeof p.price === 'number' && p.price >= 0 && p.price < 2000) o.price = Math.round(p.price);
  if (p.free === true) o.price = 0;
  if (p.sources?.length) o.sources = p.sources.slice(0, 3);
  return o;
};

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  const places = Array.isArray(data) ? data : data.places ?? [];
  for (const d of Array.isArray(data) ? [] : data.decisions ?? []) {
    if (!known.has(d.osm_id)) continue;
    if (d.decision === 'drop') drop[d.osm_id] = say(d.why) ?? 'scos';
    else if (d.decision === 'keep' && !keep[d.osm_id]) keep[d.osm_id] = {};
  }
  for (const p of places) {
    if (p.confidence === 'low') { skipped.push(p.name + ' (nesigur)'); continue; }
    const id = p.osm_id && known.has(p.osm_id) ? p.osm_id : null;
    if (id) { keep[id] = { ...keep[id], ...facts(p) }; delete drop[id]; continue; }
    // the same place may already be on the map without the research noticing: within 120 m and a name in common
    const near = typeof p.lat === 'number' ? venues.find((v) => km(v, p) < 0.12 && (fold(v.name).includes(fold(p.name).split(' ')[0]) || fold(p.name).includes(fold(v.name).split(' ')[0]))) : null;
    if (near) { keep[near.id] = { ...keep[near.id], ...facts(p) }; delete drop[near.id]; continue; }
    const k = kindOf(p);
    if (!k || typeof p.lat !== 'number' || typeof p.lon !== 'number' || !p.name) { skipped.push(p.name + ' (fără fel sau poziție)'); continue; }
    let nid = 'c-' + slug(p.name);
    while (usedIds.has(nid)) nid += '-2';
    usedIds.add(nid);
    add.push({ id: nid, name: say(p.name), k, kind: say(p.kind) || undefined, cuisine: say(p.cuisine) || undefined, lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), city: say(p.city) || undefined, ...facts(p) });
  }
}
for (const id of Object.keys(drop)) if (keep[id]) delete drop[id];
// a place stays only with its story: kept by a check but left without one (the research was not sure) goes
for (const [id, k] of Object.entries(keep)) if (!k.story) { delete keep[id]; drop[id] = 'fără poveste verificată'; }

const out = {
  updated: new Date().toISOString().slice(0, 10),
  about: 'Locurile alese pentru CeFaci (05.10): deschise acum, care merită, cu povestea lor (fapte verificate, surse la fiecare). Doar acestea apar în aplicație.',
  keep, add, drop,
};
fs.writeFileSync('src/data/curated.json', JSON.stringify(out, null, 1));
const n = Object.keys(keep).length;
console.log(JSON.stringify({ keptFromMap: n, withStory: Object.values(keep).filter((x) => x.story).length, added: add.length, dropped: Object.keys(drop).length, skipped: skipped.length, before: before ? Object.keys(before.keep ?? {}).length + (before.add?.length ?? 0) : 0 }, null, 1));
if (skipped.length) console.log('Lăsate deoparte:', skipped.slice(0, 40).join('; '));
