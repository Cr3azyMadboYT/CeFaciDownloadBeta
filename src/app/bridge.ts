// The bridge between the design boards' logic and the real app: real venues, the engine, saved preferences.
import venuesJson from '../data/venues.json';
import { KINDS, ZONES } from '../engine/catalog';
import { adultOnly, cuisineLabels, fold, nearestZone, info, km, openAt, priceOf, recommend, search, targetTime, vibesOf, zoneById } from '../engine/core';
import type { Ask, Ctx, Scored, Venue, When, Who } from '../engine/types';

const VENUES = venuesJson as Venue[];
const BY_ID = new Map(VENUES.map((v) => [v.id, v]));

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
}
const PKEY = 'cefaci.prefs';
const SKEY = 'cefaci.state';
// what the main board keeps between launches: plans, XP and stamps, theme, the tour seen, the Plus free week
const KEEP = ['plans', 'theme', 'doodles', 'xp', 'welcomeXp', 'stamps', 'tut', 'plus', 'plusSaved', 'removed', 'ended', 'dropTaken', 'billXp', 'bills', 'avatar'];
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
};
const ICON_OF: Record<string, string> = {
  restaurant: 'fork', fast_food: 'burger', cafe: 'coffee', ice_cream: 'sweet', bar: 'cocktail', pub: 'beer', biergarten: 'beer',
  nightclub: 'club', cinema: 'film', theatre: 'smile', arts_centre: 'star', museum: 'landmark', gallery: 'star',
  bowling_alley: 'bowl', escape_game: 'key', amusement_arcade: 'dice', trampoline_park: 'bolt', miniature_golf: 'target',
  ice_rink: 'bolt', water_park: 'waves', theme_park: 'star', zoo: 'heart',
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
  const needsRes = v.k === 'escape_game' || v.k === 'bowling_alley' ? 'required' : v.k === 'restaurant' && (phone || v.website) ? 'recommended' : 'none';
  return {
    id: v.id, name: v.name, title, icon: CUISINE_ICON[v.cuisines[0]] ?? ICON_OF[v.k] ?? 'star', bg, fg, dot,
    price: priceOf(v), dur: k.hours, dist: Math.max(3, Math.round(3 + d * 2.4)), km: d, vibes: vibesOf(v), min: k.min, max: k.max,
    when: ['now', 'eve', 'tom', 'we'], res: phone || v.website ? needsRes : 'none', verified: false, partner: false,
    age: v.k === 'nightclub', t: SLOT[k.night], zone: zoneById(v.zone).name, real: v,
    contact: phone || v.website ? { phone, wa: false, web: !!v.website, site: v.website ?? '', unit: v.cat === 'activitate' ? 'o rezervare' : 'o masă' } : undefined,
  };
}
type Place = ReturnType<typeof toPlace>;

const WHEN_MAP: Record<string, When> = { now: 'acum', eve: 'diseara', tom: 'maine', we: 'weekend' };
const WHO_MAP: Record<string, Who> = { 1: '1', 2: '2', 34: '34', 5: '5' };
const BUDGET_MAX: Record<string, number> = { 0: 0, 50: 50, 100: 100, 200: 200, any: Infinity };
const DUR_MAX: Record<string, number> = { 1: 1.5, 23: 3, 4: 99 };
const VIBE_LIKES: Record<string, string[]> = { bowl: ['Fun', 'Competitiv'], escape: ['Fun', 'Competitiv'], film: ['Cultură', 'Chill'], party: ['Party'], karaoke: ['Fun', 'Party'], food: ['Mâncare bună'], cafe: ['Chill'], sport: ['Competitiv'], nature: ['Aer liber'], culture: ['Cultură'], board: ['Fun'], standup: ['Cultură', 'Fun'] };

export const APP = {
  prefs: loadPrefs(),
  places: [] as Place[],
  byIdMap: new Map<string, Place>(),
  reasons: new Map<string, string>(),
  cache: new Map<string, Place[]>(),
  restart: () => {},

  savePrefs(p: Partial<Prefs>) {
    this.prefs = { ...this.prefs, ...p };
    try { localStorage.setItem(PKEY, JSON.stringify(this.prefs)); } catch { /* ignore */ }
    this.rebuild();
  },
  // where distances start: the phone's location if asked for in the last 6 hours, else the chosen zone
  hasHere() { const h = this.prefs.here; return !!h && Date.now() - h.at < 6 * 3600e3; },
  origin(): { lat: number; lon: number } { return this.hasHere() ? { lat: this.prefs.here!.lat, lon: this.prefs.here!.lon } : zoneById(this.prefs.zone); },
  zoneName() { return this.hasHere() ? 'Lângă tine' : zoneById(this.prefs.zone).name; },
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
    this.cache.clear();
  },
  byId(id: string) { return this.byIdMap.get(id); },
  ctx(): Ctx {
    const likes = this.prefs.likes.flatMap((l) => VIBE_LIKES[l] ?? [l]);
    return { prefs: { zone: this.prefs.zone, likes }, origin: this.origin(), now: new Date(), history: [], minor: this.isMinor(), liked: this.prefs.liked, disliked: this.prefs.disliked };
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
    const vibes = p.mood === 'chill' ? ['Chill'] : p.mood === 'party' ? ['Party'] : fromLikes.slice(0, 2);
    return { who, when, dur: '23', budget, vibes, dist: p.dist || '20' };
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
  matches(f: { who: string; when: string; dur: string; budget: string; vibes: string[]; dist: string }): Place[] {
    const key = JSON.stringify(f) + this.prefs.zone + new Date().getHours();
    const hit = this.cache.get(key);
    if (hit) return hit;
    const b = budgetRange(f.budget);
    const ask: Ask = { who: WHO_MAP[f.who] ?? '2', when: WHEN_MAP[f.when] ?? 'diseara', budget: b.max, budgetMin: b.min || undefined, maxKm: this.kmFor(f.dist), vibes: f.vibes as Ask['vibes'] };
    const r = recommend(VENUES, ask, this.ctx(), 0, 200);
    const list = r.picks.filter((s) => info(s.v).hours <= (DUR_MAX[f.dur] ?? 99)).map((s) => { this.reasons.set(s.v.id, s.reasons.join(' · ')); return this.byIdMap.get(s.v.id)!; });
    this.cache.set(key, list);
    return list;
  },
  reason(id: string) { return this.reasons.get(id); },
  /** Free-text search, same card shape. */
  search(q: string): Place[] {
    const r = search(VENUES, q, this.ctx(), 30);
    return r.results.map((s: Scored) => { this.reasons.set(s.v.id, s.reasons.join(' · ')); return this.byIdMap.get(s.v.id)!; });
  },
  searchNote(q: string) {
    const n = fold(q).trim();
    return n ? '' : '';
  },
  openLabel(id: string, when: string) {
    const p = this.byIdMap.get(id);
    if (!p) return '';
    const t = targetTime(WHEN_MAP[when] ?? 'acum', KINDS[p.real.k]?.night ?? 1, new Date());
    return openAt(p.real, t).label;
  },
  /** Five real places for the "Da / Poate / Nu" step of sign-up, matched to what the person likes. */
  picks(likes: string[]) {
    const ask: Ask = { who: '34', when: 'weekend', budget: Infinity, maxKm: 12, vibes: [...new Set(likes.flatMap((l) => VIBE_LIKES[l] ?? []))] as Ask['vibes'] };
    return recommend(VENUES, ask, this.ctx(), 0, 5).picks.map((s) => this.byIdMap.get(s.v.id)!);
  },
  pickMemo: new Map<string, { id: string; name: string; tag: string; sub: string; bg: string; fg: string; dot: string; like: string }[]>(),
  /** Real places for the sign-up "Da / Poate / Nu" cards, near the chosen zone and matched to the chosen likes. */
  picksFor(likes: string[], zoneId: string, more: { budget?: string; when?: string[]; birth?: string; who?: string } = {}) {
    const key = likes.join(',') + '@' + zoneId + JSON.stringify(more);
    const hit = this.pickMemo.get(key);
    if (hit) return hit;
    const origin = zoneById(zoneId);
    const vibes = [...new Set(likes.flatMap((l) => VIBE_LIKES[l] ?? []))] as Ask['vibes'];
    const age = ageOn(more.birth);
    const ctx: Ctx = { prefs: { zone: zoneId, likes: vibes }, origin, now: new Date(), history: [], minor: age !== null && age < 18 };
    const w = more.when ?? [];
    const when: When = w.includes('eve') || w.includes('late') ? 'diseara' : 'weekend';
    const who: Who = more.who === 'solo' ? '1' : more.who === 'duo' ? '2' : '34';
    const r = recommend(VENUES, { who, when, budget: budgetRange(more.budget ?? 'any').max, maxKm: 8, vibes }, ctx, 0, 5);
    const LIKE_OF: Record<string, string> = { mancare: 'food', cafea: 'cafe', desert: 'cafe', bar: 'party', club: 'party', film: 'film', teatru: 'culture', cultura: 'culture', activitate: 'bowl' };
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
  count: VENUES.length,
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
