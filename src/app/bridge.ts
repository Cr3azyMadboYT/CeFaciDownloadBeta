// The bridge between the design boards' logic and the real app: real venues, the engine, saved preferences.
import venuesJson from '../data/venues.json';
import goneJson from '../data/gone.json';
import venuesMeta from '../data/venues-meta.json';
import { addRows, mergePlaces, type PlaceCache, type PlaceRow } from './places';
import { KINDS, ZONES } from '../engine/catalog';
import { adultOnly, cuisineLabels, fold, nearestZone, info, km, openAt, parseQuery, priceOf, recommend, search, targetTime, vibesOf, zoneById, type Need } from '../engine/core';
import type { Ask, Ctx, Scored, Taste, Venue, When, Who } from '../engine/types';
import { exposure, wxAt, wxLine, type Weather } from '../engine/weather';
import { evenings, type TemplateId } from '../engine/evening';
import { altStep, makePlans, planForPlace, previewNames, suggest, swapStep, vibeCounts, type MadePlan, type PlanReq, type PlanSet } from '../engine/planner';
import { addDays, dayFromIso, eveningOf, isoDay, momentOf, whenWords } from '../engine/time';

// the places: the copy in the app, with the changes from Supabase (Admin) kept on the phone put over it (places.ts)
const BUNDLED = venuesJson as Venue[];
const PLACES_KEY = 'cefaci.places';
const BUILT_AT = (venuesMeta as { builtAt: string }).builtAt;
function readPlaceCache(): PlaceCache {
  try { const c = JSON.parse(localStorage.getItem(PLACES_KEY) || 'null') as PlaceCache | null; if (c && c.rows) return c; } catch { /* storage blocked */ }
  return { at: '', rows: {} };
}
let placeCache = readPlaceCache();
let VENUES = mergePlaces(BUNDLED, Object.values(placeCache.rows));
// places that left the map (closed): never recommended, but old plans and stamps still find them
const GONE = goneJson as Venue[];
const BY_ID = new Map([...GONE, ...BUNDLED, ...VENUES].map((v) => [v.id, v]));

/** Everything the sign-up asked, kept on the phone (accounts with Supabase come in etapa 2). */
export interface Prefs {
  zone: string; likes: string[]; dist: string; name?: string; user?: string;
  birth?: string;                 // yyyy-mm-dd
  budget?: string;                // '0' | '50' | '100' | 'any'
  who?: string;                   // 'solo' | 'duo' | 'group'
  when?: string[];                // 'day' | 'eve' | 'late' | 'we'
  mood?: string;                  // 'chill' | 'mix' | 'party'
  moves?: string[];               // 'walk' | 'car' | 'bus' | 'bike'
  liked?: string[]; disliked?: string[]; // venue ids from the "Ai merge aici?" cards
  google?: string;                // Supabase user id, when signed in with Google
  here?: { lat: number; lon: number; at: number }; // the phone's location, when the person chose "Folosește locația mea"
  prefsAt?: number;               // when the answers last changed (the newer copy, phone or account, wins)
  home?: Home;                    // where they usually set off from (sign-up: their location, or a sector / an Ilfov town, the pin moved)
  radiusKm?: number;              // how far they would go, km (5–40)
  live?: boolean;                 // count from where the phone is (chosen "Folosește locația mea"), else from home
}
/** Where someone usually sets off from: a point, its name and whether it is in București or Ilfov. */
export interface Home { lat: number; lon: number; name: string; area: 'București' | 'Ilfov' }
/** The radius choices (decision Cornel, 04.10: „5, 10, 20, 30, 40 km”). */
export const RADII = [5, 10, 20, 30, 40];
// Ilfov places besides the zones, for "Unde mai exact?": their centre is where the map's places with that town in their
// address are (real data, kept up to date by the OSM import; a town with no place on the map is not offered)
// more Ilfov towns to set off from, placed at the middle of their places' addresses on the map (OpenStreetMap, 10.2026,
// before the places were narrowed to the chosen ones: where you live does not depend on which places we show)
const ILFOV_MORE: [string, number, number][] = [
  ['Balotești', 44.6043, 26.0705], ['Cernica', 44.4301, 26.2541], ['Domnești', 44.4251, 25.9495], ['Berceni', 44.3214, 26.1808],
  ['Brănești', 44.463, 26.334], ['Ciolpani', 44.729, 26.0842], ['1 Decembrie', 44.2895, 26.0611], ['Jilava', 44.3227, 26.0715],
  ['Ciorogârla', 44.4418, 25.9067], ['Moara Vlăsiei', 44.6756, 26.2676], ['Afumați', 44.5177, 26.2406], ['Cornetu', 44.3555, 25.9603],
  ['Ștefăneștii de Jos', 44.5378, 26.1703], ['Dobroești', 44.4716, 26.1729], ['Dragomirești-Vale', 44.4403, 25.9433],
];
const PKEY = 'cefaci.prefs';
const SKEY = 'cefaci.state';
// what the main board keeps between launches: plans, XP and stamps, theme, the tour seen, the Plus free week
const KEEP = ['plans', 'theme', 'calm', 'billRemind', 'doodles', 'xp', 'welcomeXp', 'stamps', 'tut', 'plus', 'plusSaved', 'removed', 'ended', 'dropTaken', 'billXp', 'bills', 'avatar', 'levelUp'];
const DEFAULTS: Prefs = { zone: 'centru', likes: [], dist: '20', moves: ['walk', 'car'] };
function loadPrefs(): Prefs {
  try { const raw = localStorage.getItem(PKEY); if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }; } catch { /* storage blocked */ }
  return { ...DEFAULTS };
}

/** Age in whole years on `now`, from yyyy-mm-dd; null when unknown. */
export function ageOn(birth: string | undefined, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age;
}
// how far one gets in a minute, by the fastest way the person said they move (km)
const KM_PER_MIN: Record<string, number> = { walk: 0.08, bike: 0.25, bus: 0.3, car: 0.5 };
/** A budget filter key: '0', '50', '100', '200', 'any', or a range 'min-max' ('50-', '-120'). */
export function budgetRange(key: string): { min: number; max: number } {
  const r = /^(\d*)-(\d*)$/.exec(key);
  if (r) return { min: r[1] ? Number(r[1]) : 0, max: r[2] ? Number(r[2]) : Infinity };
  return { min: 0, max: BUDGET_MAX[key] ?? Infinity };
}

// Colours and icons in the design's own palette, chosen by kind so the cards stay varied but predictable.
const LOOK: Record<string, [string, string, string][]> = {
  mancare: [['#FF6A4D', '#0E1440', '#FFD43B'], ['#FFD43B', '#0E1440', '#FF6A4D'], ['#FF8A73', '#0E1440', '#FFE58A']],
  cafea: [['#DCE0EA', '#0E1440', '#FF6A4D'], ['#FFE58A', '#0E1440', '#8C6CFF']],
  desert: [['#FF8A73', '#0E1440', '#FFE58A']],
  bar: [['#8C6CFF', '#0E1440', '#FFD43B'], ['#FF6A4D', '#0E1440', '#8C6CFF']],
  club: [['#0E1440', '#FFD43B', '#8C6CFF']],
  film: [['#1D2660', '#F3F5FF', '#2F5BFF']],
  teatru: [['#B7A3FF', '#0E1440', '#FFD43B']],
  cultura: [['#FFD43B', '#0E1440', '#8EA6FF'], ['#8EA6FF', '#0E1440', '#FFD43B']],
  activitate: [['#2F5BFF', '#FFFFFF', '#8EA6FF'], ['#B7A3FF', '#0E1440', '#FFD43B']],
  natura: [['#5FD39A', '#0E1440', '#FFD43B'], ['#B8F0D2', '#0E1440', '#2F5BFF']],
  sport: [['#5FD39A', '#0E1440', '#2F5BFF'], ['#2F5BFF', '#FFFFFF', '#5FD39A']],
};
const ICON_OF: Record<string, string> = {
  restaurant: 'fork', fast_food: 'burger', cafe: 'coffee', ice_cream: 'sweet', bar: 'cocktail', pub: 'beer', biergarten: 'beer',
  nightclub: 'club', cinema: 'film', theatre: 'smile', arts_centre: 'star', museum: 'landmark', gallery: 'star',
  bowling_alley: 'bowl', escape_game: 'key', amusement_arcade: 'dice', trampoline_park: 'bolt', miniature_golf: 'target',
  ice_rink: 'bolt', water_park: 'waves', theme_park: 'star', zoo: 'heart', aquarium: 'waves', karting: 'bolt', paintball: 'target',
  billiards: 'target', planetarium: 'star', castle: 'castle', palace: 'castle', manor: 'castle', monastery: 'landmark',
  park: 'tree', nature_reserve: 'tree', botanical_garden: 'tree', beach_resort: 'waves',
  square: 'users', promenade: 'waves', food_market: 'fork', event_space: 'star',
  padel: 'ball', tennis: 'ball', soccer: 'ball', squash: 'ball', swimming: 'waves', climbing: 'bolt', golf_course: 'target', horse_riding: 'heart',
};
const CUISINE_ICON: Record<string, string> = { pizza: 'pizza', burger: 'burger', coffee_shop: 'coffee', cake: 'sweet', dessert: 'sweet', ice_cream: 'sweet' };
const hash = (s: string) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x); };
const SLOT = ['15:00', '20:00', '23:00'];

/** One venue in the shape the design's screens expect (PLACES entries). */
function toPlace(v: Venue, origin: { lat: number; lon: number }) {
  const k = info(v);
  const looks = LOOK[v.cat] ?? LOOK.mancare;
  const [bg, fg, dot] = looks[hash(v.id) % looks.length];
  const cl = cuisineLabels(v);
  const title = cl.length ? (v.k === 'restaurant' ? 'Restaurant, ' + cl.slice(0, 2).join(' și ').toLowerCase() : v.kind + ', ' + cl[0].toLowerCase()) : v.kind;
  const d = km(origin, v);
  const phone = v.phone ?? '';
  const needsRes = v.k === 'escape_game' || v.k === 'bowling_alley' || v.k === 'padel' || v.k === 'tennis' || v.k === 'soccer' || v.k === 'squash' ? 'required' : v.k === 'restaurant' && (phone || v.website) ? 'recommended' : 'none';
  return {
    id: v.id, name: v.name, title, icon: CUISINE_ICON[v.cuisines[0]] ?? ICON_OF[v.k] ?? 'star', bg, fg, dot,
    price: priceOf(v), dur: k.hours, dist: Math.max(3, Math.round(3 + d * 2.4)), km: d, vibes: vibesOf(v), min: k.min, max: k.max,
    when: ['now', 'eve', 'tom', 'we'], res: phone || v.website ? needsRes : 'none', verified: false, partner: false,
    age: v.k === 'nightclub', t: SLOT[k.night], zone: zoneById(v.zone).name, real: v, story: v.story, crowd: v.crowd,
    contact: phone || v.website ? { phone, wa: false, web: !!v.website, site: v.website ?? '', unit: v.cat === 'activitate' || v.cat === 'sport' ? (v.cat === 'sport' && v.k !== 'swimming' ? 'un teren' : 'o rezervare') : 'o masă' } : undefined,
  };
}
type Place = ReturnType<typeof toPlace>;

/** What the "Creează plan" steps ask (decision Cornel, 04.10). `at`: when you meet at the first place; with `now`
 * ("Acum"), when you set off — each place is then reached after the way there. */
export interface PlanAsk {
  mode: 'loc' | 'seara';
  at: Date;
  now?: boolean;
  people: number;
  budget: [number, number];       // lei per person, for the whole outing; max Infinity = any
  vibes: string[];
  outdoor?: boolean; needs?: Need[]; near?: boolean; // from "Mai vrei ceva?"
  strict?: boolean;               // only within their radius: Bilu does not look further
}
const hhmm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

const WHEN_MAP: Record<string, When> = { now: 'acum', eve: 'diseara', tom: 'maine', we: 'weekend' };
const WHO_MAP: Record<string, Who> = { 1: '1', 2: '2', 34: '34', 5: '5' };
const BUDGET_MAX: Record<string, number> = { 0: 0, 50: 50, 100: 100, 200: 200, any: Infinity };
const DUR_MAX: Record<string, number> = { 1: 1.5, 23: 3, 4: 99 };
// the kinds of places each answer at "Ce-ți place?" is about: a like for escape rooms lifts escape rooms, not every
// place that is "Fun" (karaoke, board games and stand-up are not kinds on the map: their vibes say it)
const LIKE_KINDS: Record<string, string[]> = {
  bowl: ['bowling_alley', 'amusement_arcade', 'billiards'], escape: ['escape_game'], film: ['cinema'], party: ['nightclub'],
  cafe: ['cafe', 'ice_cream'], sport: ['padel', 'tennis', 'soccer', 'squash', 'climbing', 'swimming'],
  nature: ['park', 'botanical_garden', 'nature_reserve', 'promenade'], culture: ['museum', 'theatre', 'gallery', 'arts_centre'], standup: ['theatre', 'arts_centre'],
};
const VIBE_LIKES: Record<string, string[]> = { bowl: ['Fun', 'Competitiv'], escape: ['Fun', 'Competitiv'], film: ['Cultură', 'Chill'], party: ['Party'], karaoke: ['Fun', 'Party'], food: ['Mâncare bună'], cafe: ['Chill'], sport: ['Competitiv'], nature: ['Aer liber'], culture: ['Cultură'], board: ['Fun'], standup: ['Cultură', 'Fun'] };

// Sign-up and "for you" picks: one idea from each kind of outing first (eat, drink, culture, play, outdoors), best
// first, then the next best. A small town may have only restaurants and cafés nearby: then look further (14, 22 km)
// until there are at least three kinds.
const GROUP: Record<string, string> = { mancare: 'food', cafea: 'food', desert: 'food', bar: 'night', club: 'night', film: 'culture', teatru: 'culture', cultura: 'culture', activitate: 'play', sport: 'play', natura: 'out' };
function variedPicks(ask: Ask, ctx: Ctx, n = 5): { picks: Scored[] } {
  let picks: Scored[] = [];
  for (const maxKm of [ask.maxKm, 14, 22]) {
    if (maxKm < ask.maxKm) continue;
    const ranked = recommend(VENUES, { ...ask, maxKm }, ctx, 0, 1e5).picks.sort((a, b) => b.score - a.score);
    const out: Scored[] = [];
    const used = new Set<string>();
    for (const s of ranked) { const g = GROUP[s.v.cat] ?? s.v.cat; if (!used.has(g) && out.length < n) { used.add(g); out.push(s); } }
    // then the next best, at most two of a kind (not four ice-cream shops) and never the same kind twice in a row
    for (const s of ranked) {
      if (out.length >= n) break;
      if (out.includes(s) || out.filter((x) => x.v.k === s.v.k).length >= 2 || out[out.length - 1]?.v.k === s.v.k) continue;
      out.push(s);
    }
    for (const s of ranked) { if (out.length >= n) break; if (!out.includes(s)) out.push(s); }
    picks = out;
    if (used.size >= 3) break;
  }
  return { picks };
}

export const APP = {
  prefs: loadPrefs(),
  places: [] as Place[],
  byIdMap: new Map<string, Place>(),
  reasons: new Map<string, string>(),
  cache: new Map<string, Place[]>(),
  weather: null as Weather | null,
  /** New forecast from the server: the lists are made again with it. */
  setWeather(w: Weather | null) {
    if (w?.at === this.weather?.at) return;
    this.weather = w; this.cache.clear(); this.pickMemo.clear();
  },
  /** The weather line for Acasă and the moment the "când" filter means. */
  weatherFor(when: string): { line: string; wet: boolean; nice: boolean; icon: string } | null {
    const now = new Date();
    const at = (d: number, h: number) => { const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, 0); return t; };
    const sat = (6 - now.getDay() + 7) % 7;
    const [from, until, label] = when === 'now' ? [now, new Date(now.getTime() + 4 * 3600e3), 'Acum']
      : when === 'tom' ? [at(1, 19), at(1, 24), 'Mâine seară']
      : when === 'we' ? [at(sat, 13), at(sat, 23), sat === 0 ? 'Azi' : 'Sâmbătă']
      : [now.getHours() >= 19 ? now : at(0, 19), at(0, 24), 'Diseară'];
    const line = wxLine(this.weather, from as Date, until as Date, label as string);
    const w = wxAt(this.weather, from as Date);
    if (!line || !w) return null;
    let wet = w.wet;
    for (let t = (from as Date).getTime(); t < (until as Date).getTime(); t += 3600e3) if (wxAt(this.weather, new Date(t))?.wet) wet = true;
    return { line, wet, nice: w.nice && !wet, icon: w.icon };
  },
  /** Rain or snow at a plan's moment at an outdoor place: the warning for the ticket. */
  weatherWarn(id: string, at: Date): string | null {
    const p = this.byIdMap.get(id);
    const w = wxAt(this.weather, at);
    if (!p || !w) return null;
    const e = exposure(p.real);
    if (w.wet && e !== 'in') return 'La ora planului: ' + w.text + ', ' + w.temp + '°. ' + (e === 'out' ? 'E în aer liber: ia umbrela sau alege Plan B.' : 'Stați înăuntru, nu pe terasă.');
    if (w.cold && e === 'out') return 'La ora planului sunt doar ' + w.temp + '°: îmbracă-te gros.';
    if (w.hot) return 'La ora planului sunt ' + w.temp + '°: ia apă.';
    return null;
  },
  restart: () => {},

  savePrefs(p: Partial<Prefs>) {
    this.prefs = { ...this.prefs, ...p };
    try { localStorage.setItem(PKEY, JSON.stringify(this.prefs)); } catch { /* ignore */ }
    this.rebuild();
  },
  // where distances start: the phone's location from the last 6 hours, else where they usually set off from, else the zone
  hasHere() { const h = this.prefs.here; return !!h && Date.now() - h.at < 6 * 3600e3; },
  origin(): { lat: number; lon: number } {
    if (this.hasHere()) return { lat: this.prefs.here!.lat, lon: this.prefs.here!.lon };
    if (this.prefs.home) return { lat: this.prefs.home.lat, lon: this.prefs.home.lon };
    return zoneById(this.prefs.zone);
  },
  zoneName() { return this.hasHere() ? 'Lângă tine' : this.prefs.home?.name ?? zoneById(this.prefs.zone).name; },
  /** How far they would go (km): what they chose, else the old answer in minutes turned into km. */
  radiusKm(): number {
    if (this.prefs.radiusKm) return this.prefs.radiusKm;
    const km = this.kmFor(this.prefs.dist || '20');
    return RADII.find((r) => r >= km) ?? 40;
  },
  /** The places to pick from for "Unde mai exact?": București's sectors, or Ilfov's towns (A–Z). */
  homes(area: 'București' | 'Ilfov'): Home[] {
    if (area === 'București') return ZONES.filter((z) => z.area === 'București' && /^s\d$/.test(z.id)).map((z) => ({ lat: z.lat, lon: z.lon, name: z.name, area }));
    const towns: Home[] = ZONES.filter((z) => z.area === 'Ilfov').map((z) => ({ lat: z.lat, lon: z.lon, name: z.name, area }));
    for (const [name, lat, lon] of ILFOV_MORE) towns.push({ lat, lon, name, area });
    return towns.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  },
  /** A point (the phone's location, a moved pin) as a Home: named after the nearest sector or town. */
  homeAt(p: { lat: number; lon: number }, name?: string): Home {
    const z = nearestZone(p);
    const area = z.area as Home['area'];
    const near = name ?? [...this.homes('București'), ...this.homes('Ilfov')].reduce((b, h) => (km(p, h) < km(p, b) ? h : b)).name;
    return { lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5), name: near, area };
  },
  /** How many places, and of how many kinds, are within `r` km of a point (for the circle on the map). */
  circle(p: { lat: number; lon: number }, r: number): { count: number; kinds: number } {
    let count = 0;
    const kinds = new Set<string>();
    for (const v of VENUES) if (km(p, v) <= r) { count++; kinds.add(v.cat); }
    return { count, kinds: kinds.size };
  },
  /** Bilu's radius: the smallest one with at least 150 places of at least 6 kinds (on foot only: at most 5 km). */
  bestRadius(p: { lat: number; lon: number }, moves?: string[]): number {
    const onFoot = !!moves && moves.length > 0 && moves.every((m) => m === 'walk');
    for (const r of RADII) { const c = this.circle(p, r); if (c.count >= 150 && c.kinds >= 6) return onFoot ? Math.min(r, 5) : r; }
    return onFoot ? 5 : 40;
  },
  useHere(): Promise<string | null> {
    return new Promise((done) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) { done('Telefonul nu ne dă locația. Alege zona din listă.'); return; }
      navigator.geolocation.getCurrentPosition((p) => {
        const here = { lat: p.coords.latitude, lon: p.coords.longitude, at: Date.now() };
        const z = nearestZone(here);
        if (km(here, z) > 40) { done('Ești în afara Bucureștiului și Ilfovului. Alege zona din listă.'); return; }
        this.savePrefs({ here, zone: z.id }); done(null);
      }, () => done('N-am primit locația. Poți s-o permiți din setări sau alegi zona din listă.'), { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
    });
  },
  zones() { return ZONES; },
  rebuild() {
    const o = this.origin();
    this.places.length = 0; // the boards hold this array, so it is refilled in place
    const minor = this.isMinor();
    for (const v of VENUES) if (!(minor && adultOnly(v))) this.places.push(toPlace(v, o)); // under 18: no clubs, hookah, 18+
    this.byIdMap = new Map(this.places.map((p) => [p.id, p]));
    for (const v of GONE) if (!this.byIdMap.has(v.id)) this.byIdMap.set(v.id, toPlace(v, o));
    this.cache.clear();
  },
  byId(id: string) { return this.byIdMap.get(id); },
  ctx(): Ctx {
    const likes = [...new Set(this.prefs.likes.flatMap((l) => [...(VIBE_LIKES[l] ?? [l]), ...(LIKE_KINDS[l] ?? [])]))];
    return { prefs: { zone: this.prefs.zone, likes }, origin: this.origin(), now: new Date(), history: this.history(), minor: this.isMinor(), liked: this.prefs.liked, disliked: this.prefs.disliked, weather: this.weather };
  },
  histMemo: null as string[] | null,
  /** The places already planned or stamped: "N-ai mai fost" counts, and a surprise is somewhere new. */
  history(): string[] {
    if (this.histMemo) return this.histMemo;
    let saved: { plans?: { placeId?: string }[]; stamps?: { id?: string }[] } = {};
    try { saved = JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch { saved = {}; }
    const ids = new Set<string>();
    for (const p of Array.isArray(saved.plans) ? saved.plans : []) if (p?.placeId) ids.add(p.placeId);
    for (const st of Array.isArray(saved.stamps) ? saved.stamps : []) if (st?.id) ids.add(st.id);
    this.histMemo = [...ids];
    return this.histMemo;
  },
  /** The main board's state that must survive closing the app (and, once signed in, reinstalling it). */
  loadBoardState(now = Date.now()): Record<string, unknown> {
    let saved: Record<string, any> = {};
    try { saved = JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch { saved = {}; }
    const out: Record<string, unknown> = {};
    for (const k of KEEP) if (saved[k] !== undefined) out[k] = saved[k];
    if (saved.tut && saved.tut.on === false) out.tut = { step: 0, bump: 0, replay: false, lv: false, ...saved.tut, on: false }; else delete out.tut; // a tour left halfway starts again
    // the free Plus week counts real days from the moment Bilu gave it
    if (saved.plus === 'trial' && saved.plusStart) {
      const day = Math.floor((now - saved.plusStart) / 864e5) + 1;
      if (day > 7) { out.plus = 'off'; out.plusDay = 7; if (!saved.expiredShown) { out.plusModal = 'expired'; saved.expiredShown = true; } }
      else { out.plusDay = day; if (day >= 5 && !saved.day5Shown) { out.plusModal = 'day5'; saved.day5Shown = true; } }
      try { localStorage.setItem(SKEY, JSON.stringify(saved)); } catch { /* storage blocked */ }
    }
    return out;
  },
  saveBoardState(st: Record<string, any>, now = Date.now()) {
    let prev: Record<string, any> = {};
    try { prev = JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch { prev = {}; }
    const next: Record<string, any> = { ...prev };
    for (const k of KEEP) if (st[k] !== undefined) next[k] = st[k];
    if (st.plus === 'trial' && !prev.plusStart) next.plusStart = now;
    next.savedAt = now;
    try { localStorage.setItem(SKEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    this.histMemo = null;
    this.onSaved(next);
  },
  onSaved: (_state: Record<string, unknown>) => {},
  age: ageOn,
  google: async (): Promise<string | null> => 'Google nu e pornit.',
  /** Deletes the account (when there is one) and everything on the phone, then starts from the beginning. */
  deleteAccount: async () => { try { localStorage.clear(); } catch { /* storage blocked */ } APP.restart(); },
  emailStart: async (_email: string): Promise<string | null> => 'Emailul nu e pornit.',
  emailVerify: async (_email: string, _code: string): Promise<string | null> => 'Emailul nu e pornit.',
  isMinor() { const a = ageOn(this.prefs.birth); return a !== null && a < 18; },
  /** Minutes to km, by the fastest way the person moves. */
  kmFor(min: string, moves?: string[]) {
    moves ??= this.prefs.moves;
    const speed = Math.max(...(moves?.length ? moves : ['car']).map((m: string) => KM_PER_MIN[m] ?? 0.5));
    return Math.max(1.5, Number(min || 20) * speed);
  },
  /** The home filters, started from what the person said at sign-up. */
  homeDefaults() {
    const p = this.prefs;
    const who = p.who === 'solo' ? '1' : p.who === 'duo' ? '2' : '34';
    const w = p.when ?? [];
    const when = w.includes('eve') || w.includes('late') ? 'eve' : w.includes('we') ? 'we' : w.includes('day') ? 'now' : 'eve';
    const budget = p.budget === '0' || p.budget === '50' || p.budget === '100' || p.budget === 'any' ? p.budget : '100';
    const fromLikes = [...new Set(p.likes.flatMap((l) => VIBE_LIKES[l] ?? []))];
    // under 18 there is no party to have: the vibes come from what they like instead
    const party = !this.isMinor();
    const vibes = p.mood === 'chill' ? ['Chill'] : p.mood === 'party' && party ? ['Party'] : fromLikes.filter((x) => party || x !== 'Party').slice(0, 2);
    // the hour a first plan starts at: by day for those who go out by day, late for night owls, else 20:00
    const hour = w.length && !w.includes('eve') && !w.includes('we') ? (w.includes('day') ? '14:00' : '22:00') : '20:00';
    return { who, when, dur: '23', budget, vibes, hour, mood: p.mood, dist: p.dist || '20', km: this.radiusKm() };
  },
  pickVotes: new Map<string, string>(),
  notePick(id: string | undefined, vote: string) { if (id) this.pickVotes.set(id, vote); },
  /** Said under results when prices matter: they are estimates per kind of place, not menus. */
  priceNote(q: string, budgetKey: string) {
    const r = search(VENUES, q || '', this.ctx(), 1).parsed;
    const asked = q && q.trim().length > 1 ? r.budget !== undefined || r.budgetMin !== undefined : budgetKey !== 'any';
    return asked ? ' · Atenție: prețurile sunt estimate și pot varia.' : '';
  },
  /** The design's matches(f): real ranking from the engine, as PLACES entries. */
  /** `where`: 'in' only places with a roof (rain), 'out' only outside or with a terrace. */
  matches(f: { who: string; when: string; dur: string; budget: string; vibes: string[]; dist: string; km?: number; where?: 'in' | 'out' }): Place[] {
    const key = JSON.stringify(f) + this.prefs.zone + new Date().getHours();
    const hit = this.cache.get(key);
    if (hit) return hit;
    const b = budgetRange(f.budget);
    const ask: Ask = { who: WHO_MAP[f.who] ?? '2', when: WHEN_MAP[f.when] ?? 'diseara', budget: b.max, budgetMin: b.min || undefined, maxKm: f.km ?? this.kmFor(f.dist), vibes: f.vibes as Ask['vibes'] };
    const r = recommend(VENUES, ask, this.ctx(), 0, 200);
    const list = r.picks.filter((s) => info(s.v).hours <= (DUR_MAX[f.dur] ?? 99) && (!f.where || (f.where === 'in') === (exposure(s.v) === 'in'))).map((s) => { this.reasons.set(s.v.id, s.reasons.join(' · ')); return this.byIdMap.get(s.v.id)!; });
    this.cache.set(key, list);
    return list;
  },
  reason(id: string) { return this.reasons.get(id); },
  /** "Seara completă": evenings of 2–3 places for the filters, as cards. `skip` asks for another variant of a route. */
  evenings(f: { who: string; when: string; budget: string; vibes: string[]; dist: string }, skip: Partial<Record<TemplateId, number>> = {}) {
    const moves = (this.prefs.moves as string[] | undefined) ?? ['walk'];
    const walkKm = moves.includes('walk') || moves.length === 0 ? 1.2 : 3;
    const ask = { who: WHO_MAP[f.who] ?? '2', when: WHEN_MAP[f.when] ?? 'diseara', budget: budgetRange(f.budget).max, maxKm: this.kmFor(f.dist), walkKm, vibes: f.vibes as Ask['vibes'] };
    const hh = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return evenings(VENUES, ask, this.ctx(), skip).map((r) => ({
      id: r.id, label: r.label, sub: r.sub, note: r.note, price: r.price, drive: !!r.drive,
      from: hh(r.steps[0].at), to: hh(r.steps[r.steps.length - 1].until),
      steps: r.steps.map((s) => ({ place: toPlace(s.v, this.origin()), at: s.at, slot: hh(s.at), until: hh(s.until), walk: s.walk, why: s.why, reason: s.reasons.slice(0, 2).join(' · ') })),
    }));
  },
  /** Free-text search, same card shape; `at`: as if it were then (the plan's moment). */
  search(q: string, at?: Date): Place[] {
    const ctx = this.ctx();
    const r = search(VENUES, q, at ? { ...ctx, now: at } : ctx, 30);
    return r.results.map((s: Scored) => { this.reasons.set(s.v.id, s.reasons.join(' · ')); return this.byIdMap.get(s.v.id)!; });
  },
  searchNote(q: string) {
    const n = fold(q).trim();
    return n ? '' : '';
  },
  /** Open or closed at the plan's moment: `at` (the plan's real day and time), else the "când" choice. */
  openLabel(id: string, when: string, at?: Date) {
    const p = this.byIdMap.get(id);
    if (!p) return '';
    const t = at ?? targetTime(WHEN_MAP[when] ?? 'acum', KINDS[p.real.k]?.night ?? 1, new Date());
    return openAt(p.real, t).label;
  },
  /** Five real places for the "Da / Poate / Nu" step of sign-up, matched to what the person likes. */
  picks(likes: string[]) {
    const ask: Ask = { who: '34', when: 'weekend', budget: Infinity, maxKm: 12, vibes: [...new Set(likes.flatMap((l) => VIBE_LIKES[l] ?? []))] as Ask['vibes'] };
    return variedPicks(ask, this.ctx()).picks.map((s) => this.byIdMap.get(s.v.id)!);
  },
  pickMemo: new Map<string, { id: string; name: string; tag: string; sub: string; bg: string; fg: string; dot: string; like: string }[]>(),
  /** Real places for the sign-up "Da / Poate / Nu" cards, near the chosen zone and matched to the chosen likes. */
  picksFor(likes: string[], zoneId: string, more: { budget?: string; when?: string[]; birth?: string; who?: string; at?: { lat: number; lon: number } } = {}) {
    const key = likes.join(',') + '@' + zoneId + JSON.stringify(more);
    const hit = this.pickMemo.get(key);
    if (hit) return hit;
    const origin = more.at ?? zoneById(zoneId);
    const vibes = [...new Set(likes.flatMap((l) => VIBE_LIKES[l] ?? []))] as Ask['vibes'];
    const age = ageOn(more.birth);
    const ctx: Ctx = { prefs: { zone: zoneId, likes: vibes }, origin, now: new Date(), history: [], minor: age !== null && age < 18, weather: this.weather };
    const w = more.when ?? [];
    const when: When = w.includes('eve') || w.includes('late') ? 'diseara' : 'weekend';
    const who: Who = more.who === 'solo' ? '1' : more.who === 'duo' ? '2' : '34';
    const r = variedPicks({ who, when, budget: budgetRange(more.budget ?? 'any').max, maxKm: 8, vibes }, ctx);
    const LIKE_OF: Record<string, string> = { mancare: 'food', cafea: 'cafe', desert: 'cafe', bar: 'party', club: 'party', film: 'film', teatru: 'culture', cultura: 'culture', activitate: 'bowl', natura: 'nature', sport: 'sport' };
    const out = r.picks.map((s) => {
      const p = toPlace(s.v, origin);
      return { id: s.v.id, name: p.name, tag: s.v.kind + ' · ' + p.dist + ' min', sub: (p.title !== s.v.kind ? p.title + '. ' : '') + (p.price ? 'Cam ' + p.price + ' lei de persoană. ' : '') + (s.reasons[0] ?? ''), bg: p.bg, fg: p.fg, dot: p.dot, like: s.v.k === 'escape_game' ? 'escape' : LIKE_OF[s.v.cat] ?? 'food' };
    });
    this.pickMemo.set(key, out);
    return out;
  },
  fixWhen(WHEN: Record<string, { date: string }>) {
    const months = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
    const fmt = (d: Date) => d.getDate() + ' ' + months[d.getMonth()];
    const now = new Date();
    const tom = new Date(now.getTime() + 864e5);
    const sat = new Date(now.getTime()); sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7));
    if (WHEN.eve) WHEN.eve.date = 'Azi, ' + fmt(now);
    if (WHEN.tom) WHEN.tom.date = 'Mâine, ' + fmt(tom);
    if (WHEN.we) WHEN.we.date = 'Sâmbătă, ' + fmt(sat);
  },
  /** The PlanAsk as the planner's request: how far comes from the sign-up answers (at least 10 km, Ilfov is wide). */
  planReq(a: PlanAsk): PlanReq {
    const moves = (this.prefs.moves as string[] | undefined) ?? ['walk', 'car'];
    const walkKm = moves.includes('walk') || moves.length === 0 ? 1.2 : 3;
    const maxKm = this.radiusKm();
    const car = !(moves.length > 0 && moves.every((m) => m === 'walk'));
    // further than a walk: by car if they drive, else by bus, else by bike
    const go: PlanReq['go'] = moves.includes('car') || !moves.length ? 'car' : moves.includes('bus') ? 'bus' : moves.includes('bike') ? 'bike' : undefined;
    return { mode: a.mode, at: a.at, now: a.now, people: a.people, budgetMin: a.budget[0], budgetMax: a.budget[1], vibes: a.vibes as PlanReq['vibes'], maxKm, walkKm, outdoor: a.outdoor, needs: a.needs, near: a.near, strict: a.strict, car, go };
  },
  lastPlans: [] as MadePlan[],
  lastReq: null as PlanReq | null,
  /** Three plans ready to go, with Bilu's note on what he had to change (further away, over the budget…) or why there
   * is nothing. `avoid`: places to leave out ("Altă surpriză" after the three shown). */
  makePlans(a: PlanAsk, avoid: string[] = [], taste?: Taste) {
    const ctx0 = this.ctx();
    const ctx = { ...ctx0, taste };
    const set: PlanSet = makePlans(VENUES, { ...this.planReq(a), avoid: avoid.length ? avoid : undefined }, ctx);
    this.lastPlans = set.plans; this.lastReq = set.req; this.altSeen.clear();
    return { plans: set.plans.map((p) => this.showPlan(p)), note: set.note, empty: set.empty, relaxed: set.relaxed };
  },
  /** A crew's votes (crew_taste rows) as a taste: per place, and per kind of place for the places it went to. */
  tasteOf(name: string, rows: { venue_id: string; score: number }[]): Taste {
    const venues: Record<string, number> = {};
    const kinds: Record<string, number> = {};
    for (const r of rows) {
      venues[r.venue_id] = r.score;
      const v = BY_ID.get(r.venue_id);
      if (v) kinds[v.k] = (kinds[v.k] ?? 0) + Math.sign(r.score);
    }
    return { name, venues, kinds };
  },
  /** One place as the only plan (a suggestion on Acasă): returns its index in lastPlans. */
  planForPlace(id: string, a: PlanAsk) {
    const v = BY_ID.get(id); if (!v) return -1;
    const req = this.planReq(a);
    this.lastPlans = [planForPlace(v, req, this.ctx())]; this.lastReq = req; this.altSeen.clear();
    return 0;
  },
  altSeen: new Set<string>(),
  /** "Alt bar": another place for one step of plan i; null when there is no other. */
  altPlan(i: number, step: number) {
    const p = this.lastPlans[i];
    if (!p || !this.lastReq) return null;
    for (const s of this.lastPlans.flatMap((x) => x.steps)) this.altSeen.add(s.v.id); // not a place of another plan either
    const v = altStep(p, step, VENUES, this.lastReq, this.ctx(), this.altSeen);
    if (!v) return null;
    this.lastPlans[i] = swapStep(p, step, v, this.lastReq, this.ctx());
    return this.showPlan(this.lastPlans[i]);
  },
  /** The first names that fit so far (under each question). */
  preview(a: PlanAsk) { return previewNames(VENUES, this.planReq(a), this.ctx()); },
  /** How many places fit each vibe at that moment ("Ai chef de…"). */
  vibeCounts(a: PlanAsk) { return vibeCounts(VENUES, this.planReq(a), this.ctx()); },
  /** Puts another place in one step of the last plans (the tip "Cu X în loc de Y"). */
  swapPlan(i: number, step: number, id: string) {
    const p = this.lastPlans[i]; const v = BY_ID.get(id);
    if (!p || !v || !this.lastReq) return null;
    this.lastPlans[i] = swapStep(p, step, v, this.lastReq, this.ctx());
    return this.showPlan(this.lastPlans[i]);
  },
  showPlan(p: MadePlan) {
    const o = this.origin();
    return {
      id: p.id, title: p.title, sub: p.sub, price: p.price, over: p.over, drive: p.drive, checks: p.checks, family: p.family, fits: p.fits, note: p.note,
      tip: p.tip ? { text: p.tip.text, step: p.tip.step, id: p.tip.v.id } : undefined,
      from: hhmm(p.steps[0].at), to: hhmm(p.steps[p.steps.length - 1].until),
      steps: p.steps.map((s) => ({ place: this.byIdMap.get(s.v.id) ?? toPlace(s.v, o), at: s.at, slot: hhmm(s.at), until: hhmm(s.until), travel: s.travel, by: s.by, sure: s.sure, why: s.why, open: s.open.label, reason: s.reasons.slice(0, 2).join(' · ') })),
    };
  },
  /** When "Bilu îți sugerează" looks: tonight at 20:00 in the late afternoon (dinner is what people plan then), else
   * now — by day a coffee or a park, by night what is still open. */
  ideasAt(now = new Date()): { at: Date; now: boolean } {
    const h = now.getHours();
    if (h >= 16 && h < 19) { const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0); return { at, now: false }; }
    return { at: new Date(now.getTime() + 5 * 60e3), now: true };
  },
  /** "Bilu îți sugerează": ideas from the sign-up answers, the weather and the zone, open when you would get there. */
  suggestions(now = new Date()) {
    const d = this.homeDefaults();
    const people = d.who === '1' ? 1 : d.who === '2' ? 2 : 4;
    const run = (when: { at: Date; now: boolean }) => {
      const req = this.planReq({ mode: 'loc', at: when.at, now: when.now, people, budget: [0, budgetRange(d.budget).max], vibes: d.vibes });
      return suggest(VENUES, req, this.ctx()).map((s) => ({ place: this.byIdMap.get(s.v.id)!, tag: s.tag, line: s.line, at: s.at, now: when.now })).filter((s) => s.place);
    };
    const first = this.ideasAt(now);
    const out = run(first);
    if (out.length || !first.now) return out;
    // nothing open on the way right now (the early morning, the last hours of the night): ideas for later today
    const h = now.getHours();
    const later = h < 5 || (h >= 10 && h < 20) ? 20 : h < 10 ? 10 : null;
    return later === null ? out : run({ at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), later, 0), now: false });
  },
  /** The weather on a day at an hour, for the "Când ieșiți?" cards; null if there is no forecast that far. */
  dayWeather(at: Date) {
    const w = wxAt(this.weather, at);
    return w ? { temp: w.temp, text: w.text, icon: w.icon, wet: w.wet, nice: w.nice } : null;
  },
  /** "Spune-i lui Bilu": what the words change in the plan, and the chips that say so. `slot` is the plan's evening
   * (yyyy-mm-dd) and hour ("acum" or "21:00"); the words may move it ("mâine la 9", "după 22", "acum"). */
  refine(text: string, a: PlanAsk, slot: { evening: string; hour: string }, now = new Date()): { ask: PlanAsk; chips: string[]; slot: { evening: string; hour: string } } {
    const p = parseQuery(text);
    const next: PlanAsk = { ...a, budget: [...a.budget] as [number, number], vibes: [...a.vibes] };
    const chips: string[] = [];
    if (p.outdoor) { next.outdoor = true; chips.push('Cu terasă'); }
    if (p.needs.length) { next.needs = [...new Set([...(a.needs ?? []), ...p.needs])]; chips.push(...p.needs.map((n) => ({ wifi: 'Wifi', nosmoke: 'Fără fum', smoke: 'Se poate fuma', wheel: 'Scaun cu rotile', ac: 'Aer condiționat' })[n])); }
    if (p.near) { next.near = true; chips.push('Aproape'); }
    if (p.budget !== undefined || p.cheap) { const max = p.budget ?? (a.budget[1] === 0 ? 0 : Math.max(30, Math.round(a.budget[1] === Infinity ? 60 : a.budget[1] * 0.6))); next.budget = [p.budgetMin ?? 0, max]; chips.push('Până în ' + max + ' lei'); }
    let { evening, hour } = slot;
    const t = p.time;
    if (t?.now) { evening = eveningOf(now); hour = 'acum'; chips.push('Acum'); }
    else if (t && (t.day !== undefined || t.hour !== undefined)) {
      const today = isoDay(now);
      if (t.day === -1) evening = eveningOf(now);
      else if (t.day === -2) evening = addDays(today, 1);
      else if (t.day === -3) evening = addDays(today, 2);
      else if (t.day !== undefined && t.day >= 0) evening = addDays(today, (t.day - dayFromIso(today).getDay() + 7) % 7);
      if (t.hour !== undefined) hour = String(t.hour).padStart(2, '0') + ':' + String(t.min ?? 0).padStart(2, '0');
      else if (hour === 'acum') hour = '20:00'; // a day without an hour: the evening
      // an hour already gone today: now, if it was a little while ago; else the next evening
      const m = momentOf(evening, hour);
      if (m.getTime() < now.getTime() - 10 * 60e3) {
        if (t.day === undefined && now.getTime() - m.getTime() < 3 * 3600e3) { evening = eveningOf(now); hour = 'acum'; }
        else if (t.day === undefined || t.day === -1) evening = addDays(evening, 1);
      }
      chips.push(hour === 'acum' ? 'Acum' : (t.after ? 'De la ' : '') + whenWords(evening, hour, now));
    }
    next.now = hour === 'acum';
    next.at = hour === 'acum' ? new Date(now.getTime() + 5 * 60e3) : momentOf(evening, hour);
    if (p.people) { next.people = p.people; chips.push(p.people + (p.people === 1 ? ' persoană' : ' persoane')); }
    const vibes = p.vibes.filter((v) => !next.vibes.includes(v));
    if (vibes.length) { next.vibes.push(...vibes); chips.push(...vibes); }
    return { ask: next, chips, slot: { evening, hour } };
  },
  get count() { return VENUES.length; },
  /** Where to start asking Supabase for changes: after the last change kept, else (first time) everything changed by
   *  hand plus what changed after the app's copy was made. */
  placesSince(): { since: string; first: boolean; builtAt: string } { return { since: placeCache.at || BUILT_AT, first: !placeCache.at, builtAt: BUILT_AT }; },
  /** New rows from public.venues: kept on the phone and put over the places at once. */
  applyPlaces(rows: PlaceRow[]) {
    if (!rows.length) { if (!placeCache.at) { placeCache = { at: BUILT_AT, rows: {} }; try { localStorage.setItem(PLACES_KEY, JSON.stringify(placeCache)); } catch { /* storage blocked */ } } return 0; }
    placeCache = addRows(placeCache.at ? placeCache : { at: BUILT_AT, rows: {} }, rows);
    try { localStorage.setItem(PLACES_KEY, JSON.stringify(placeCache)); } catch { /* storage blocked */ }
    VENUES = mergePlaces(BUNDLED, Object.values(placeCache.rows));
    for (const v of VENUES) BY_ID.set(v.id, v);
    this.rebuild();
    return rows.length;
  },
  todayText() {
    const days = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
    const months = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
    const d = new Date();
    return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()];
  },
};
APP.rebuild();

export function initBridge(extra: Record<string, unknown>) { Object.assign(APP, extra); }
export { BY_ID };
