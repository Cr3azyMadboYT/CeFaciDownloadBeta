// Shared types for the CeFaci client and its recommendation/search engine.

export type Cat = 'mancare' | 'cafea' | 'desert' | 'bar' | 'club' | 'film' | 'teatru' | 'cultura' | 'activitate' | 'natura' | 'sport';
export type Vibe = 'Mâncare bună' | 'Chill' | 'Party' | 'Fun' | 'Competitiv' | 'Cultură' | 'Aer liber';
export type When = 'acum' | 'diseara' | 'maine' | 'weekend';
export type Who = '1' | '2' | '34' | '5';

/** One real venue, normalised from OpenStreetMap. */
export interface Venue {
  id: string;          // osm type + id, e.g. "n123456"
  name: string;
  cat: Cat;
  kind: string;        // human label, e.g. "Restaurant", "Bowling"
  k: string;           // kind key from OSM, e.g. "restaurant", "bowling_alley"
  cuisines: string[];  // normalised cuisine keys, e.g. ["pizza", "italian"]
  lat: number;
  lon: number;
  zone: string;        // nearest zone id, e.g. "s1", "buftea"
  street?: string;     // "Strada Lipscani 12"
  city?: string;
  hours?: string;      // raw OSM opening_hours
  wk?: number[][][];   // the same hours as a weekly table (scripts/build-hours.mjs): wk[day 0=Sun][i] = [fromMin, toMin]
  outdoor?: boolean;
  website?: string;
  phone?: string;
  brand?: string;      // set for chains
  wheelchair?: boolean;
  wheelLimited?: boolean; // partly accessible (OSM wheelchair=limited)
  wifi?: boolean;      // OSM internet_access
  smoke?: 'no' | 'outside' | 'yes'; // OSM smoking
  ac?: boolean;        // OSM air_conditioning
  famous?: boolean;
  gone?: string;       // yyyy-mm-dd: dropped from the map then (src/data/gone.json); kept so old plans and stamps still open    // has a Wikidata entry (OSM wikidata=*): a known place
  fast?: boolean;      // fast food
  story?: string;      // why go (src/data/curated.json, researched 05.10): one or two sentences, real facts
  crowd?: string;      // when people are there ("vineri–duminică seara")
  pick?: boolean;      // chosen by hand for CeFaci (curated.json): only these are shown
  vibes?: Vibe[];      // researched vibes, instead of the kind's usual ones
  price?: number;      // researched price per person, lei
  minAge?: number;     // the place asks for ID at the door (OSM min_age)
}

export interface Zone { id: string; name: string; area: 'București' | 'Ilfov'; lat: number; lon: number; }

export interface Prefs {
  zone: string;        // where the user usually starts from
  likes: string[];     // vibes and cuisine/kind keys the user picked
}

export interface Ask {
  who: Who;
  when: When;
  budget: number;      // max lei per person, Infinity for any
  budgetMin?: number;  // min lei per person ("de la 50 la 120 lei")
  maxKm: number;
  vibes: Vibe[];
  at?: Date;           // the exact moment of the plan ("Creează plan": a day and an hour); else `when` decides
  people?: number;     // how many exactly ("Câți sunteți?"); else `who` decides
  wants?: Vibe[];      // what they asked for themselves (a step of an evening scores with the evening's vibes)
  avoid?: string[];    // places left out ("Altă surpriză": the ones already shown)
}

export interface Ctx {
  prefs: Prefs;
  origin: { lat: number; lon: number };
  now: Date;
  history: string[];   // venue ids already planned or visited
  minor?: boolean;     // under 18: no clubs, hookah or other 18+ places
  liked?: string[];    // venue ids the person said "da" to at sign-up
  disliked?: string[]; // venue ids the person said "nu prea" to
  weather?: import('./weather').Weather | null; // the forecast (public.weather): rain or cold → a roof, sun → outside
  taste?: Taste;       // what the crew the plan is for liked (votes after outings and before them)
}

/** A crew's taste, from its votes: per place and per kind of place (positive: liked, negative: not). */
export interface Taste { name: string; venues: Record<string, number>; kinds: Record<string, number> }

export interface Scored {
  v: Venue;
  score: number;       // 0..100
  km: number;
  open: OpenInfo;
  reasons: string[];
  parts: Record<'gust' | 'ocazie' | 'calitate' | 'aproape' | 'nou' | 'gasca', number>;
}

export interface OpenInfo { known: boolean; open: boolean; label: string; }
