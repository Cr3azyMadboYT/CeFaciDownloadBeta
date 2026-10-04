// Which OpenStreetMap things become CeFaci places, shared by the Overpass query (osm-query.mjs) and the import (import-osm.mjs).
// classify(tags) -> { k, cat, label } or null. k is the kind key in src/engine/catalog.ts KINDS.

const AMENITY = {
  restaurant: ['mancare', 'Restaurant'], fast_food: ['mancare', 'Fast food'], cafe: ['cafea', 'Cafenea'], ice_cream: ['desert', 'Gelaterie'],
  bar: ['bar', 'Bar'], pub: ['bar', 'Pub'], biergarten: ['bar', 'Grădină de bere'], nightclub: ['club', 'Club'],
  cinema: ['film', 'Cinema'], theatre: ['teatru', 'Teatru'], arts_centre: ['cultura', 'Centru cultural'], planetarium: ['cultura', 'Planetariu'],
};
const LEISURE = {
  bowling_alley: ['activitate', 'Bowling'], escape_game: ['activitate', 'Escape room'], amusement_arcade: ['activitate', 'Jocuri arcade'],
  trampoline_park: ['activitate', 'Trambuline'], water_park: ['activitate', 'Parc acvatic'], miniature_golf: ['activitate', 'Minigolf'],
  ice_rink: ['activitate', 'Patinoar'], park: ['natura', 'Parc'], nature_reserve: ['natura', 'Rezervație naturală'],
  beach_resort: ['natura', 'Plajă'], golf_course: ['sport', 'Golf'], horse_riding: ['sport', 'Călărie'],
};
const TOURISM = {
  museum: ['cultura', 'Muzeu'], gallery: ['cultura', 'Galerie'], zoo: ['activitate', 'Grădină zoologică'],
  theme_park: ['activitate', 'Parc de distracții'], aquarium: ['activitate', 'Acvariu'],
};
const HISTORIC = { castle: ['cultura', 'Castel'], palace: ['cultura', 'Palat'], manor: ['cultura', 'Conac'], monastery: ['cultura', 'Mănăstire'] };
// sport=* on a sports centre or a pitch: the first one we know wins ("padel;tennis" is a padel place)
const SPORT = {
  padel: ['sport', 'Padel'], tennis: ['sport', 'Tenis'], soccer: ['sport', 'Fotbal'], swimming: ['sport', 'Piscină'],
  climbing: ['sport', 'Escaladă'], squash: ['sport', 'Squash'], karting: ['activitate', 'Karting'], paintball: ['activitate', 'Paintball'],
  billiards: ['activitate', 'Biliard'], golf: ['sport', 'Golf'], equestrian: ['sport', 'Călărie'],
};
const SPORT_KEY = { golf: 'golf_course', equestrian: 'horse_riding' };

const pick = (k, [cat, label]) => ({ k, cat, label });
const sportOf = (t) => (t.sport ?? '').split(';').map((s) => s.trim()).find((s) => SPORT[s]);
// A historic building counts only when people can visit it. In the city most "palaces" are banks, offices or
// hotels, so there the map must say it is a sight or give opening hours (strict); in Ilfov a known palace or manor
// (Mogoșoaia, Știrbey, Snagov) is the outing itself. The import applies the strict rule by zone.
const visitable = (t) => t.tourism !== 'hotel' && !/^(office|apartments|residential|retail|hotel|commercial)$/.test(t.building ?? '')
  && !!(t.tourism || t.wikidata || t.website || t['contact:website'] || t.opening_hours);
const sight = (t) => /^(attraction|museum)$/.test(t.tourism ?? '') || !!t.opening_hours;

export function classify(t) {
  if (AMENITY[t.amenity]) return pick(t.amenity, AMENITY[t.amenity]);
  if (t.amenity === 'monastery') return pick('monastery', HISTORIC.monastery);
  if (LEISURE[t.leisure]) return pick(t.leisure, LEISURE[t.leisure]);
  if (t.leisure === 'garden' && t['garden:type'] === 'botanical') return pick('botanical_garden', ['natura', 'Grădină botanică']);
  if (t.leisure === 'sports_centre' || t.leisure === 'pitch' || t.leisure === 'track' || t.leisure === 'swimming_pool') {
    if (t.access === 'private' || t.access === 'no' || (t.access === 'customers' && t.leisure === 'swimming_pool')) return null;
    const s = t.leisure === 'swimming_pool' ? 'swimming' : sportOf(t);
    if (!s) return null;
    if (t.leisure === 'track' && s !== 'karting') return null;
    return pick(SPORT_KEY[s] ?? s, SPORT[s]);
  }
  if (TOURISM[t.tourism]) return pick(t.tourism, TOURISM[t.tourism]);
  if (HISTORIC[t.historic] && visitable(t)) return { ...pick(t.historic, HISTORIC[t.historic]), cityOnlyIfSight: t.historic !== 'monastery' && !sight(t) };
  return null;
}

/** The Overpass query for București + Ilfov (the import drops what falls outside the zones). */
export function overpassQuery(bbox = '44.20,25.80,44.75,26.45') {
  const re = (o) => '^(' + Object.keys(o).join('|') + ')$';
  const sports = Object.keys(SPORT).join('|');
  return `[out:json][timeout:600][bbox:${bbox}];
(
  nwr["amenity"~"${re(AMENITY)}"]["name"];
  nwr["amenity"="monastery"]["name"];
  nwr["leisure"~"${re(Object.fromEntries(Object.entries(LEISURE).filter(([k]) => k !== 'park' && k !== 'nature_reserve')))}"]["name"];
  nwr["leisure"="garden"]["garden:type"="botanical"]["name"];
  nwr["leisure"~"^(sports_centre|pitch|track)$"]["sport"~"(^|;)(${sports})(;|$)"]["name"];
  nwr["leisure"="swimming_pool"]["name"];
  nwr["tourism"~"${re(TOURISM)}"]["name"];
  nwr["historic"~"${re(HISTORIC)}"]["name"];
);
out center;
(
  nwr["leisure"~"^(park|nature_reserve)$"]["name"];
);
out bb;
`;
}
