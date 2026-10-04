import opening_hours from 'opening_hours';
import { CUISINES, KINDS, NAME_ALIASES, NUMBERS, PLACES, STOP, TOPICS, VIBES, ZONES } from './catalog';
import type { Place } from './catalog';
import { exposure, wxAt, wxScore } from './weather';
import type { Ask, Cat, Ctx, OpenInfo, Scored, Venue, Vibe, When, Who } from './types';

// ---------- text ----------
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[șş]/g, 's').replace(/[țţ]/g, 't').toLowerCase();

// ---------- geometry ----------
export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const nearestZone = (p: { lat: number; lon: number }) => ZONES.reduce((best, z) => (km(p, z) < km(p, best) ? z : best), ZONES[0]);
export const zoneById = (id: string) => ZONES.find((z) => z.id === id) ?? ZONES[0];

// ---------- kinds ----------
export const kindKey = (v: Venue) => v.k;
export const info = (v: Venue) => KINDS[v.k] ?? KINDS.restaurant;

export function vibesOf(v: Venue): Vibe[] {
  const out = new Set<Vibe>(info(v).vibes);
  if (v.outdoor) out.add('Aer liber');
  if (v.cat === 'desert' || v.cuisines.some((c) => c === 'cake' || c === 'dessert')) out.add('Mâncare bună');
  return [...out];
}
export const priceOf = (v: Venue) => {
  const base = info(v).price;
  if (v.cat !== 'mancare') return base;
  if (v.cuisines.some((c) => c === 'steak_house' || c === 'seafood' || c === 'french' || c === 'japanese' || c === 'sushi')) return Math.round(base * 1.4);
  if (v.cuisines.some((c) => c === 'kebab' || c === 'shawarma' || c === 'sandwich' || c === 'pizza' || c === 'burger')) return Math.round(base * 0.65);
  return base;
};
export const cuisineLabels = (v: Venue) => [...new Set(v.cuisines.map((c) => CUISINES[c]).filter(Boolean))];

// ---------- opening hours ----------
const ohCache = new Map<string, opening_hours | null>();
function oh(v: Venue): opening_hours | null {
  if (!v.hours) return null;
  if (ohCache.has(v.id)) return ohCache.get(v.id)!;
  let o: opening_hours | null = null;
  try { o = new opening_hours(v.hours, { lat: v.lat, lon: v.lon, address: { country_code: 'ro', state: 'București' } } as never, { locale: 'ro' } as never); } catch { o = null; }
  ohCache.set(v.id, o);
  return o;
}
const hhmm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

// The weekly table made at build time (wk): reading it is instant, even on a slow phone.
const minuteOf = (t: Date) => t.getHours() * 60 + t.getMinutes();
function wkOpen(wk: number[][][], t: Date) {
  const m = minuteOf(t);
  return wk[t.getDay()].some(([a, b]) => a <= m && m < b);
}
/** Minutes from `t` to the next change of state, within two days; null if it never changes (24/7, always closed). */
function wkNext(wk: number[][][], t: Date): number | null {
  const d = t.getDay();
  const m = minuteOf(t);
  const spans: [number, number][] = [];
  for (let k = 0; k < 3; k++) for (const [a, b] of wk[(d + k) % 7]) spans.push([a + k * 1440, b + k * 1440]);
  spans.sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const sp of spans) { const l = merged[merged.length - 1]; if (l && sp[0] <= l[1]) l[1] = Math.max(l[1], sp[1]); else merged.push([sp[0], sp[1]]); }
  for (const [a, b] of merged) {
    if (a <= m && m < b) return b >= 3 * 1440 ? null : b - m; // open now: until the end of this stretch
    if (a > m) return a - m;                                   // closed now: until the next opening
  }
  return null;
}

export function openAt(v: Venue, t: Date): OpenInfo {
  if (v.wk) {
    const open = wkOpen(v.wk, t);
    const left = wkNext(v.wk, t);
    const next = left === null ? null : new Date(t.getTime() + left * 60000);
    const gap = left === null ? Infinity : left * 60000;
    const sameDay = gap < 20 * 3600e3 && !(open && gap > 12 * 3600e3);
    if (open) return { known: true, open: true, label: next && sameDay ? 'Deschis până la ' + hhmm(next) : 'Deschis' };
    return { known: true, open: false, label: next && sameDay ? 'Se deschide la ' + hhmm(next) : 'Închis' };
  }
  const o = oh(v);
  if (!o) return { known: false, open: true, label: 'Program necunoscut' };
  try {
    const open = o.getState(t);
    const next = o.getNextChange(t, new Date(t.getTime() + 2 * 864e5)); // bounded: 24/7 places never change
    const gap = next ? next.getTime() - t.getTime() : Infinity;
    const sameDay = gap < 20 * 3600e3 && !(open && gap > 12 * 3600e3); // odd data like 14:00-12:00 would read as 'open until noon'
    if (open) return { known: true, open: true, label: next && sameDay ? 'Deschis până la ' + hhmm(next) : 'Deschis' };
    return { known: true, open: false, label: next && sameDay ? 'Se deschide la ' + hhmm(next) : 'Închis' };
  } catch { return { known: false, open: true, label: 'Program necunoscut' }; }
}

/** When an open place closes, seen from `t` (within two days); null when closed at `t`, open around the clock or unknown. */
export function closesAt(v: Venue, t: Date): Date | null {
  if (v.wk) {
    if (!wkOpen(v.wk, t)) return null;
    const left = wkNext(v.wk, t);
    return left === null ? null : new Date(t.getTime() + left * 60000);
  }
  const o = oh(v);
  if (!o) return null;
  try {
    if (!o.getState(t)) return null;
    return o.getNextChange(t, new Date(t.getTime() + 2 * 864e5)) ?? null;
  } catch { return null; }
}

/** The moment a plan is for: now, tonight, tomorrow evening, or next Saturday. Daytime kinds look at the afternoon. */
export function targetTime(when: When, night: number, now: Date): Date {
  const t = new Date(now.getTime());
  if (when === 'acum') return t;
  const hour = night === 0 ? 15 : night === 1 ? 20 : 23;
  const min = night === 2 ? 30 : 0;
  if (when === 'maine') t.setDate(t.getDate() + 1);
  if (when === 'weekend') { const add = (6 - t.getDay() + 7) % 7; t.setDate(t.getDate() + (add === 0 && now.getHours() >= 22 ? 7 : add)); }
  t.setHours(hour, min, 0, 0);
  if (when === 'diseara' && t.getTime() < now.getTime()) return new Date(now.getTime());
  return t;
}

/** A daytime place (park, museum, court) with no hours on the map is not offered late at night: it is likely closed or dark. */
export const dayOnly = (v: Venue, t: Date) => !v.wk && !v.hours && info(v).night === 0 && (t.getHours() >= 22 || t.getHours() < 7);

// ---------- scoring ----------
export const WHO_N: Record<Who, number> = { '1': 1, '2': 2, '34': 4, '5': 6 };

/**
 * score = 35 gust + 20 ocazie + 15 calitate + 10 aproape + 10 nou + 10 gașcă
 * (the weights from the "Versiunea 1" document). Returns null when a hard filter fails.
 */
/**
 * Under 18 people see only places for everyone (decision Cornel, 03.10): no clubs, bars, pubs, beer gardens, hookah,
 * adult venues, nor any place that says on the map it lets in only 18+ (min_age).
 */
export const adultOnly = (v: Venue) =>
  (v.minAge ?? 0) >= 18 || v.k === 'nightclub' || v.k === 'bar' || v.k === 'pub' || v.k === 'biergarten' || v.cuisines.includes('shisha')
  || /shisha|hookah|narghil|pussy|strip|gentlemen|erotic|\bsexy\b|\bxxx\b|cigars club|casino|cazino|pariuri/.test(fold(v.name));

export function scoreVenue(v: Venue, ask: Ask, ctx: Ctx): Scored | null {
  if (ctx.minor && adultOnly(v)) return null;
  const k = info(v);
  const d = km(ctx.origin, v);
  if (d > ask.maxKm) return null;
  const price = priceOf(v);
  if (price > ask.budget) return null;
  if (ask.budgetMin && price < ask.budgetMin) return null;
  const n = WHO_N[ask.who];
  if (n > k.max) return null;
  const t = ask.at ?? targetTime(ask.when, k.night, ctx.now);
  if (dayOnly(v, t)) return null;
  const open = openAt(v, t);
  if (open.known && !open.open) return null;

  const vibes = vibesOf(v);
  const likes = ctx.prefs.likes;
  const want: Vibe[] = ask.vibes.length ? ask.vibes : (likes.filter((l) => (VIBES as string[]).includes(l)) as Vibe[]);
  const vibeHit = want.length ? want.filter((w) => vibes.includes(w)).length / want.length : 0.5;
  const likeHit = likes.some((l) => v.cuisines.includes(l) || kindKeyOf(v) === l) ? 1 : 0;
  const gust = 35 * Math.min(1, vibeHit * 0.8 + likeHit * 0.35);

  const hourNow = t.getHours() + (t.getHours() < 5 ? 24 : 0);
  const nightFit = k.night === 0 ? (hourNow <= 19 ? 1 : 0.3) : k.night === 2 ? (hourNow >= 22 ? 1 : 0.35) : (hourNow >= 17 ? 1 : 0.6);
  const ocazie = 20 * (0.55 * nightFit + 0.45 * (open.known ? 1 : 0.6));

  const complete = Math.min(1, [v.hours, v.website || v.phone, v.street, v.famous].filter(Boolean).length / 3);
  const calitate = 15 * (0.4 + 0.6 * complete) * (v.brand ? 0.7 : 1) * (v.fast ? 0.75 : 1);
  const aproape = 10 * Math.max(0, 1 - d / Math.max(ask.maxKm, 1));
  const nou = ctx.history.includes(v.id) ? 0 : 10;
  const said = ctx.liked?.includes(v.id) ? 6 : ctx.disliked?.includes(v.id) ? -15 : 0;
  const gasca = 10 * (n >= k.min && n <= k.max ? (n >= 3 && (k.cat === 'activitate' || k.cat === 'sport' || k.cat === 'bar') ? 1 : 0.8) : 0.3);

  // a court or a park is a good idea for those who like sport or the outdoors; for the others it comes after a place to sit
  const niche = (k.cat === 'sport' || k.cat === 'natura') && !want.some((w) => w === 'Competitiv' || w === 'Aer liber') ? -8 : 0;

  const wx = wxScore(v, wxAt(ctx.weather, t));

  const parts = { gust, ocazie, calitate, aproape, nou, gasca };
  const score = Object.values(parts).reduce((a, b) => a + b, 0) + said + niche + wx.pts;
  const reasons: string[] = [];
  if (wx.why) reasons.push(wx.why);
  const hits = want.filter((w) => vibes.includes(w));
  if (hits.length) reasons.push('Se potrivește cu ' + hits.slice(0, 2).join(' și '));
  const liked = likes.find((l) => v.cuisines.includes(l) || kindKeyOf(v) === l);
  if (liked) reasons.push('Ai zis că îți place ' + (CUISINES[liked] ?? k.label).toLowerCase());
  if (open.known) reasons.push(open.label);
  reasons.push(d < 1 ? 'La ' + Math.round(d * 1000) + ' m' : 'La ' + d.toFixed(1).replace('.', ',') + ' km');
  if (n >= 3 && k.cat === 'activitate') reasons.push('Bun pentru ' + n + ' persoane');
  if (!ctx.history.includes(v.id)) reasons.push('N-ai mai fost');
  return { v, score, km: d, open, reasons: reasons.slice(0, 3), parts };
}
const kindKeyOf = (v: Venue) => v.k;

/** Three different ideas, not three pizzerias: the best, then the best of other categories. */
export function recommend(all: Venue[], ask: Ask, ctx: Ctx, page = 0, per = 3): { picks: Scored[]; total: number } {
  const ranked = all.map((v) => scoreVenue(v, ask, ctx)).filter((x): x is Scored => !!x).sort((a, b) => b.score - a.score);
  const ordered: Scored[] = [];
  const pool = ranked.slice();
  while (pool.length) {
    const recent = ordered.slice(-2).map((x) => x.v.cat);
    const i = pool.findIndex((x) => !recent.includes(x.v.cat));
    ordered.push(pool.splice(i === -1 ? 0 : i, 1)[0]);
    if (ordered.length > 60) { ordered.push(...pool); break; }
  }
  const start = (page * per) % Math.max(ordered.length, 1);
  return { picks: ordered.slice(start, start + per), total: ordered.length };
}

// ---------- search ----------
// A query is read in two passes: first the modifiers (where, when, how many, how much), then what is left is matched
// against topics ("pizza", "bar", "escape room") and against venue names ("caru cu bere", "mc donalds").

export interface TimeAsk { label: string; now?: boolean; day?: number; hour?: number; min?: number; nonstop?: boolean; after?: boolean; before?: boolean }
/** Things a place should have, said in the search: wifi, no smoking / smoking, wheelchair access, air conditioning. */
export type Need = 'wifi' | 'nosmoke' | 'smoke' | 'wheel' | 'ac';
const NEED_SAY: Record<Need, string> = { wifi: 'Are wifi', nosmoke: 'Nefumători', smoke: 'Se poate fuma', wheel: 'Accesibil cu scaun cu rotile', ac: 'Are aer condiționat' };
const NEED_WORD: Record<Need, string> = { wifi: 'wifi', nosmoke: 'nefumători', smoke: 'loc de fumat', wheel: 'acces cu scaun cu rotile', ac: 'aer condiționat' };
/** How well a place answers one need: points, and whether the map says so. */
export function needFit(v: Venue, n: Need): { pts: number; ok: boolean; no?: boolean } {
  if (n === 'wifi') return v.wifi ? { pts: 14, ok: true } : { pts: -3, ok: false };
  if (n === 'ac') return v.ac ? { pts: 12, ok: true } : { pts: -2, ok: false };
  if (n === 'wheel') return v.wheelchair ? { pts: 16, ok: true } : v.wheelLimited ? { pts: 6, ok: true } : { pts: -6, ok: false };
  if (n === 'nosmoke') return v.smoke === 'yes' || v.cuisines.includes('shisha') ? { pts: 0, ok: false, no: true } : v.smoke === 'no' ? { pts: 12, ok: true } : { pts: 0, ok: false };
  return v.smoke === 'no' ? { pts: 0, ok: false, no: true } : v.smoke === 'yes' || v.cuisines.includes('shisha') ? { pts: 14, ok: true } : v.smoke === 'outside' || v.outdoor ? { pts: 6, ok: true } : { pts: 0, ok: false };
}
export interface Parsed {
  raw: string[];        // content words, folded, in order (topics and names)
  words: string[];      // content words that are not a known topic (names, streets)
  topics: string[];     // TOPICS ids
  kinds: string[]; cuisines: string[]; cats: Cat[]; vibes: Vibe[];
  outdoor: boolean; openNow: boolean; cheap: boolean;
  near: boolean;        // "aproape", "lângă mine": the closest first
  zone?: string;        // zone id when the place is a zone (sector, Ilfov town)
  place?: Place;
  street?: string;      // "strada X" / "calea X"
  time?: TimeAsk;
  budget?: number;      // max lei per person
  budgetMin?: number;   // min lei per person, for a range
  people?: number;
  needs: Need[];        // wifi, nefumători, scaun cu rotile…
  fancy: boolean; family: boolean; romantic: boolean;
  fixes: string[];      // typo corrections, e.g. "bowlng → bowling"
  fuzzy: Record<string, string>; // typed word -> topic id, when the topic was guessed from a typo
  note: string;         // shown when we had to relax the request
}

const DAYS: Record<string, number> = { duminica: 0, luni: 1, marti: 2, miercuri: 3, joi: 4, vineri: 5, sambata: 6, sambeta: 6 };
const PARTS: [RegExp, number, number, string][] = [ // pattern, hour, minute, label
  [/ dupa miezul noptii /, 1, 0, 'după miezul nopții'],
  [/ (dimineata|dimineatza|dimi) /, 10, 0, 'dimineața'],
  [/ (la )?pranz /, 13, 0, 'la prânz'],
  [/ (dupa amiaza|dupa amiaz|dupaamiaza|dupa masa|dupamasa) /, 16, 0, 'după-amiază'],
  [/ (la noapte|noaptea|noapte|tarziu|late) /, 23, 30, 'noaptea'],
  [/ (diseara|deseara|disara|diseara asta|in seara asta|seara asta|seara|searã) /, 20, 0, 'seara'],
];
const ADULT = /pussy|strip|gentlemen|erotic|\bsexy\b|\bxxx\b|cigars club/;
const FOODISH = new Set<Cat>(['mancare', 'cafea', 'desert']);
const OUTDOOR_HINT = /teras|gradin|garden|rooftop|beach|curte|summer|\bparc|\bpark\b|lac\b|outdoor/;

// --- lexicon lookups, built once ---
const TOPIC_ALIAS = new Map<string, string>(); // single-word alias -> topic id
const TOPIC_PHRASES: [string, string][] = [];  // multi-word alias -> topic id
for (const [id, t] of Object.entries(TOPICS)) for (const w of t.words) (w.includes(' ') ? TOPIC_PHRASES.push([w, id]) : TOPIC_ALIAS.set(w, id));
TOPIC_PHRASES.sort((a, b) => b[0].length - a[0].length);
const PLACE_PHRASES: [string, Place][] = PLACES.flatMap((p) => p.words.map((w) => [w, p] as [string, Place])).sort((a, b) => b[0].length - a[0].length);
const HINTS = new Map(Object.entries(TOPICS).filter(([, t]) => t.hint).map(([id, t]) => [id, new RegExp(t.hint!)]));

export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev[j - 2] + 1); // swapped letters
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
const allowed = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);
const SUFFIXES = ['urile', 'ului', 'ilor', 'elor', 'uri', 'ele', 'ul', 'ii', 'le', 'ua', 'ea', 'a', 'e', 'i'];

/** A word to a topic: exactly, by dropping a Romanian ending, or with a typo. */
function topicOf(w: string): { id: string; fixed?: string } | null {
  const exact = TOPIC_ALIAS.get(w);
  if (exact) return { id: exact };
  for (const suf of SUFFIXES) if (w.length - suf.length >= 3 && w.endsWith(suf)) { const id = TOPIC_ALIAS.get(w.slice(0, -suf.length)); if (id) return { id }; }
  const max = allowed(w.length);
  if (!max) return null;
  let best: { id: string; fixed: string; d: number } | null = null;
  for (const [alias, id] of TOPIC_ALIAS) {
    if (alias.length < 4) continue;
    const d = editDistance(w, alias, max);
    if (d <= max && (!best || d < best.d)) best = { id, fixed: alias, d };
  }
  return best ? { id: best.id, fixed: best.fixed } : null;
}
function placeOf(w: string): Place | null {
  if (w.length < 5) return null;
  let best: { p: Place; d: number } | null = null;
  for (const [alias, p] of PLACE_PHRASES) {
    if (alias.includes(' ') || alias.length < 5) continue;
    const d = editDistance(w, alias, 1);
    if (d <= 1 && (!best || d < best.d)) best = { p, d };
  }
  return best?.p ?? null;
}

export function parseQuery(q: string): Parsed {
  const p: Parsed = { raw: [], words: [], topics: [], kinds: [], cuisines: [], cats: [], vibes: [], needs: [], outdoor: false, openNow: false, cheap: false, near: false, fancy: false, family: false, romantic: false, fixes: [], fuzzy: {}, note: '' };
  let s = ' ' + fold(q).replace(/(\d{1,2})[:.](\d{2})/g, '$1h$2').replace(/['’`´]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  for (const [k, v] of Object.entries(NAME_ALIASES)) s = s.replace(' ' + k + ' ', ' ' + v + ' ');
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => { const m = s.match(re); if (m) { fn(m); s = s.replace(re, ' '); return true; } return false; };
  const num = (x: string) => (/^\d+$/.test(x) ? Number(x) : NUMBERS[x] ?? NaN);
  const NUMW = '(\\d{1,3}|' + Object.keys(NUMBERS).join('|') + ')';

  // street names: "strada X", "calea X", "bulevardul X"
  take(/ (?:strada|str|calea|bulevardul|bd|bdul|soseaua|sos|aleea|splaiul) ([a-z0-9]+(?: [a-z0-9]+)?) /, (m) => {
    const known = PLACE_PHRASES.find(([w]) => w === m[1] || w === m[1].split(' ')[0] || m[0].trim() === w);
    if (known) { p.place = known[1]; } else p.street = m[1].split(' ')[0];
  });
  // what the place should have
  const needs: [RegExp, Need][] = [
    [/ (?:cu )?(?:wi ?fi|internet|net bun|sa (?:pot )?lucra|sa lucrez|de lucru|cu laptopul|laptopul|laptop|remote) /, 'wifi'],
    [/ (?:fara fumat|fara fum|nefumatori|pentru nefumatori|sa nu se fumeze|fara tigari|smoke free|non smoking|(?:unde |in care )?nu se fumeaza|nu (?:vreau|suport|imi place) (?:fumul|fum|fumat|tigari)) /, 'nosmoke'],
    [/ (?:unde se fumeaza|se fumeaza|cu fumat|fumatori|pentru fumatori|pot fuma|sa pot fuma|sa se poata fuma|fumat) /, 'smoke'],
    [/ (?:accesibil |acces )?(?:pentru |cu )?(?:scaun cu rotile|scaun rulant|carucior|caruciorul|dizabilitati|handicap|fara trepte|wheelchair) /, 'wheel'],
    [/ (?:cu )?(?:aer conditionat|aerul conditionat|racoare|climatizat|cu clima|cu ac) /, 'ac'],
  ];
  for (const [re, n] of needs) while (take(re, () => {})) if (!p.needs.includes(n)) p.needs.push(n);
  // close by: "aproape", "mai aproape", "lângă mine" (not "aproape de Unirii": that is a place)
  if (take(/ (?:cat mai |mai |foarte )?(?:aproape(?: de (?:mine|noi|casa|acasa))?(?! de )|langa mine|langa noi|in apropiere|prin apropiere|pe aproape|prin preajma|in preajma|in zona mea|nu departe|nu prea departe) /, () => {})) p.near = true;
  // budget
  const PER = '(?: (?:de )?(?:persoana|pers|om|cap))?';
  take(new RegExp(' (?:intre|de la) ' + NUMW + ' (?:si|la|pana la) ' + NUMW + ' (?:de )?(?:lei|ron)?' + PER + ' '), (m) => { p.budgetMin = num(m[1]); p.budget = num(m[2]); });
  take(new RegExp(' (\\d{2,4}) (\\d{2,4}) (?:de )?(?:lei|ron)' + PER + ' '), (m) => { p.budgetMin = Number(m[1]); p.budget = Number(m[2]); }); // "50-100 lei"
  take(new RegExp(' (?:sub|maxim|max|cel mult|nu mai mult de|pana (?:in|la)) ' + NUMW + ' (?:de )?(?:lei|ron)' + PER + ' '), (m) => { p.budget = num(m[1]); });
  take(new RegExp(' (?:sub|maxim|max|cel mult|nu mai mult de|pana in) (\\d{2,4})' + PER + ' '), (m) => { p.budget = num(m[1]); }); // "sub 50": lei is implied
  take(new RegExp(' ' + NUMW + ' (?:de )?(?:lei|ron)(?: (?:de )?(?:persoana|pers|om|cap))? '), (m) => { p.budget = num(m[1]); });
  if (take(/ (ieftin|ieftina|ieftine|ieftini|ieftinut|ieftinica|buget|low cost|lowcost|studentesc|studenteasca|accesibil|accesibile|preturi accesibile|preturi mici|preturi bune|nu prea scump|nu scump|pe buget|pe bani putini|economic) /, () => {})) { p.cheap = true; p.budget = Math.min(p.budget ?? 50, 50); }
  if (take(/ (scump|scumpa|lux|luxos|luxoasa|elegant|eleganta|fancy|fine dining|gourmet|de fite|select|exclusivist) /, () => {})) p.fancy = true;
  if (p.budget !== undefined && p.budget < 50) p.cheap = true;

  // clock times, before people ("înainte de 9" is a time, not nine people) and with the right half of the day:
  // "la 8" is the evening for a bar, "la 10" the morning for brunch, "la 1 noaptea" is 01:00
  const t: TimeAsk = { label: '' };
  const daytime = /brunch|mic dejun|micul dejun|cafea|cafenea|cafele|muzeu|muzee|parc|plimbare|zoo|gradina|dimineata|pranz|copii|tenis|padel|piscina/.test(s);
  const nightlife = /club|party|petrecere|disco|shisha|narghil|noaptea|la noapte|dupa miezul/.test(s);
  const clock = (h: number, part?: string) => {
    if (part === 'noaptea') return h === 12 ? 0 : h <= 5 ? h : h < 12 ? h + 12 : h;
    if (part === 'dimineata') return h % 12;
    if (part === 'seara') return h < 12 ? h + 12 : h;
    if (part === 'pranz' || part === 'dupa amiaza') return h <= 6 ? h + 12 : h;
    if (h >= 12) return h % 24;
    if (h === 0) return 0;
    if (h <= 5) return nightlife ? h : h + 12;
    return daytime ? h : h + 12;
  };
  const hm = (h: number, m: number) => String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  const PART = '(?: (seara|noaptea|dimineata|pranz|dupa amiaza))?';
  take(new RegExp(' dupa (?:ora )?(\\d{1,2})(?:h(\\d{2})?)?(?! (?:de )?(?:persoane|persoana|pers|oameni|insi|prieteni|prietene|colegi|copii|adulti|baieti|fete)\\b)' + PART + ' '), (m) => {
    const h = Number(m[1]); if (h > 24) return;
    t.hour = clock(h, m[3]); t.min = m[2] ? Number(m[2]) : 0; t.after = true; t.label = 'după ' + hm(t.hour, t.min);
  });
  take(new RegExp(' (?:inainte de|inainte sa fie|pana la|pana in) (?:ora )?(\\d{1,2})(?:h(\\d{2})?)?(?! (?:de )?(?:persoane|persoana|pers|oameni|insi|prieteni|prietene|colegi|copii|adulti|baieti|fete)\\b)' + PART + ' '), (m) => {
    const h = Number(m[1]); if (h > 24) return;
    const end = clock(h, m[3]) * 60 + (m[2] ? Number(m[2]) : 0);
    const at = Math.max(0, end - 60);
    t.hour = Math.floor(at / 60); t.min = at % 60; t.before = true; t.label = 'înainte de ' + hm(Math.floor(end / 60) % 24, end % 60);
  });
  take(new RegExp(' (?:la |pe la |pela |ora |la ora |in jur de |pe la ora )(\\d{1,2})(?:h(\\d{2})?)?(?! (?:de )?(?:persoane|persoana|pers|oameni|insi|prieteni|prietene|colegi|copii|adulti|baieti|fete)\\b)' + PART + ' '), (m) => {
    const h = Number(m[1]); if (h > 24) return;
    t.hour = clock(h, m[3]); t.min = m[2] ? Number(m[2]) : 0; t.label = 'la ' + hm(t.hour, t.min);
  });

  // people
  const setPeople = (n: number) => { if (n >= 1 && n <= 40) p.people = n; };
  if (take(/ (in doi|in 2|cuplu|cu iubita|cu iubitul|cu prietena|cu prietenul|date|intalnire|prima intalnire|romantic|romantica|romantice|romantik|aniversare) /, () => {})) { p.romantic = true; p.people ??= 2; p.vibes.push('Chill'); }
  take(new RegExp(' ' + NUMW + ' (?:persoane|persoana|pers|oameni|prieteni|prietene|insi|inși|adulti|colegi|baieti|fete) '), (m) => setPeople(num(m[1])));
  take(new RegExp(' (?:gasca|grup|grupul|gasca mea|echipa) (?:de )?' + NUMW + ' '), (m) => setPeople(num(m[1])));
  take(new RegExp(' (?:de|pt|pentru|in|cu) ' + NUMW + ' (?!(?:de )?(?:lei|ron|ani)\\b)'), (m) => { const n = num(m[1]); if (n >= 2 && n <= 30) setPeople(n); });
  if (take(/ (singur|singura|solo) /, () => {})) p.people ??= 1;
  if (take(/ (cu copiii|cu copii|copii|copiii|copil|cu cel mic|cu cei mici|familie|familia|in familie|kids|family|pentru copii|pt copii) /, () => {})) p.family = true;
  if (take(/ (cu gasca|gasca|grup|grupul|cu prietenii|prietenii|cu baietii|cu fetele|colegii|cu colegii|echipa) /, () => {})) p.people ??= 5;

  // time
  if (take(/ (non ?stop|24 ?7|24 din 24|deschis toata noaptea) /, () => {})) { t.now = true; t.nonstop = true; t.label = 'non-stop'; }
  if (take(/ (deschis acum|deschisa acum|deschise acum|deschisi acum|chiar acum|acum|in momentul asta|imediat|open now|open) /, () => {})) { t.now = true; t.label ||= 'acum'; }
  if (take(/ (azi|astazi|azi seara) /, () => {})) { t.day = -1; }
  if (take(/ (poimaine) /, () => {})) t.day = -3;
  else if (take(/ (maine|mâine|mine seara) /, () => {})) t.day = -2;
  for (const [w, d] of Object.entries(DAYS)) if (take(new RegExp(' ' + w + '(a|ea)? '), () => {})) { t.day = d; t.label = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'][d] + (t.label ? ' ' + t.label : ''); }
  if (take(/ (in )?(weekend|weekendul|week end|wekend|weekend asta|weekendul asta) /, () => {})) { t.day = 6; t.label = 'în weekend'; }
  for (const [re, h, mm, label] of PARTS) {
    const was = s;
    if (take(re, () => {})) {
      if (t.hour === undefined) { t.hour = h; t.min = mm; t.label = (t.label ? t.label + ' ' : '') + label; }
      else if (!/^(la|după|înainte)/.test(t.label)) t.label = (t.label ? t.label + ' ' : '') + label;
      if (/diseara|deseara|disara|seara asta|la noapte/.test(was) && t.day === undefined) t.day = -1;
      break;
    }
  }
  take(/ (\d{1,2})h(\d{2})? /, (m) => { t.hour = Number(m[1]) % 24; t.min = m[2] ? Number(m[2]) : 0; t.label ||= 'la ' + m[1] + ':' + (m[2] ?? '00'); });
  if (take(/ (deschis|deschisa|deschise|deschisi|deschide) /, () => {})) { if (t.day === undefined && t.hour === undefined) { t.now = true; t.label ||= 'acum'; } else t.label ||= 'deschis'; }
  if (t.day === -1 && !t.label) t.label = 'azi';
  if (t.day === -2 && !/maine/.test(t.label)) t.label = 'mâine' + (t.label ? ' ' + t.label : '');
  if (t.now || t.day !== undefined || t.hour !== undefined) { p.time = t; p.openNow = !!t.now; }

  // places (longest phrase first), then topic phrases
  if (!p.place) for (const [w, pl] of PLACE_PHRASES) { if (s.includes(' ' + w + ' ')) { p.place = pl; s = s.replace(' ' + w + ' ', ' '); break; } }
  const OUT = / (cu terasa|terasa|terase|terasei|afara|gradina|gradini|in aer liber|aer liber|outdoor|curte|curtea|vara)(?= )/g;
  if (OUT.test(s)) { p.outdoor = true; s = s.replace(OUT, ' '); }
  const content = s.trim(); // what is left for names and topics
  for (const [w, id] of TOPIC_PHRASES) if (s.includes(' ' + w + ' ')) { addTopic(p, id); s = s.replace(' ' + w + ' ', ' § '); }

  for (const w of content.split(' ').filter(Boolean)) if (!STOP.has(w) && w !== '§') p.raw.push(w);
  for (const w of s.trim().split(' ').filter(Boolean)) {
    if (w === '§' || STOP.has(w)) continue;
    if (/^\d+$/.test(w)) { p.words.push(w); continue; }
    const tp = topicOf(w);
    if (tp) { addTopic(p, tp.id); if (tp.fixed) { p.fixes.push(w + ' → ' + tp.fixed); p.fuzzy[w] = tp.id; p.words.push(w); } continue; }
    if (!p.place) { const pl = placeOf(w); if (pl) { p.place = pl; p.fixes.push(w + ' → ' + pl.name); p.raw = p.raw.filter((x) => x !== w); continue; } }
    p.words.push(w);
  }
  if (p.place?.zone) p.zone = p.place.zone;
  return p;
}
function addTopic(p: Parsed, id: string) {
  if (p.topics.includes(id)) return;
  const t = TOPICS[id];
  p.topics.push(id);
  if (t.kinds) p.kinds.push(...t.kinds);
  if (t.cuisines) p.cuisines.push(...t.cuisines);
  if (t.cats) p.cats.push(...t.cats);
  if (t.vibe) p.vibes.push(t.vibe);
}

/** The moment the query is about, for one kind of venue. */
export function askTime(t: TimeAsk | undefined, night: number, now: Date, topicHour?: number): Date {
  if (!t || t.now) return new Date(now.getTime());
  const d = new Date(now.getTime());
  if (t.day === -2) d.setDate(d.getDate() + 1);
  else if (t.day === -3) d.setDate(d.getDate() + 2);
  else if (t.day !== undefined && t.day >= 0) d.setDate(d.getDate() + ((t.day - now.getDay() + 7) % 7));
  const hour = t.hour ?? topicHour ?? (night === 0 ? 15 : night === 1 ? 20 : 23);
  const min = t.hour !== undefined ? t.min ?? 0 : night === 2 && topicHour === undefined ? 30 : 0;
  d.setHours(hour, min, 0, 0);
  if (hour < 5 && (t.day === undefined || t.day === -1) && now.getHours() >= 5) d.setDate(d.getDate() + 1); // "after 2 at night" means tonight
  else if (hour < 5 && t.day !== undefined && t.day >= 0) d.setDate(d.getDate() + 1); // "friday night, 2am" is saturday 2am
  if (d.getTime() < now.getTime() && (t.day === undefined || t.day === -1 || t.day === now.getDay())) {
    if (t.day === undefined && t.hour !== undefined && now.getTime() - d.getTime() > 3 * 3600e3) d.setDate(d.getDate() + 1);
    else if (now.getTime() - d.getTime() < 3 * 3600e3) return new Date(now.getTime());
  }
  return d;
}

// --- names ---
const squash = (s: string) => fold(s).replace(/[^a-z0-9]/g, '');
const nameTokens = new Map<string, string[]>();
function toks(v: Venue): string[] {
  let t = nameTokens.get(v.id);
  if (!t) { t = fold(v.name).replace(/['’`´]/g, '').split(/[^a-z0-9]+/).filter(Boolean); nameTokens.set(v.id, t); }
  return t;
}
/** How well the typed words name this venue, 0..1. Handles "mc donalds", "carucubere", typos and missing words. */
export function nameScore(words: string[], v: Venue): number {
  if (!words.length) return 0;
  const nt = toks(v);
  const qs = words.join('');
  const ns = nt.join('');
  let best = 0;
  if (qs.length >= 3) {
    if (ns === qs) best = 1;
    else if (qs.length >= 4 && ns.startsWith(qs)) best = 0.93;
    else if (qs.length >= 6 && editDistance(qs, ns, allowed(qs.length)) <= allowed(qs.length)) best = 0.9;
    else if (qs.length >= 6 && editDistance(qs, ns.slice(0, qs.length), 1) <= 1) best = 0.86;
    else if (qs.length >= 6 && ns.includes(qs)) best = 0.84;
  }
  let sum = 0, need = 0, used = 0;
  for (const w of words) {
    const optional = STOP.has(w);
    let m = 0;
    for (const t of nt) {
      if (t === w) { m = 1; break; }
      if (w.length >= 3 && t.startsWith(w)) m = Math.max(m, 0.9);
      else if (t.length >= 5 && w.startsWith(t)) m = Math.max(m, 0.85);
      else if (w.length >= 4 && editDistance(w, t, allowed(w.length)) <= allowed(w.length)) m = Math.max(m, 0.78);
    }
    if (!m && !optional) return best;
    if (m) used++;
    if (!optional) { sum += m; need++; }
  }
  if (!need) return best;
  const tokenScore = (sum / need) * (0.88 + 0.12 * Math.min(1, used / nt.length));
  return Math.max(best, tokenScore);
}

// --- chains ---
let chainSet: Set<string> | null = null;
const baseName = (v: Venue) => fold(v.name).replace(/['’`´]/g, '').replace(/\s*[-–|(,].*$/, '').trim();
function isChain(v: Venue, all: Venue[]): boolean {
  if (!chainSet) {
    const c = new Map<string, number>();
    for (const x of all) c.set(baseName(x), (c.get(baseName(x)) ?? 0) + 1);
    chainSet = new Set([...c].filter(([, n]) => n >= 4).map(([k]) => k));
  }
  return !!v.brand || chainSet.has(baseName(v));
}

// --- opening hours, fast: the state only (labels are computed for the results shown) ---
const stateCache = new Map<string, { known: boolean; open: boolean }>();
export function openState(v: Venue, t: Date): { known: boolean; open: boolean } {
  if (!v.hours) return { known: false, open: true };
  if (v.wk) return { known: true, open: wkOpen(v.wk, t) };
  const key = v.id + '@' + Math.floor(t.getTime() / 60000);
  let st = stateCache.get(key);
  if (!st) {
    const o = oh(v);
    if (!o) st = { known: false, open: true };
    else { try { st = { known: true, open: o.getState(t) }; } catch { st = { known: false, open: true }; } }
    if (stateCache.size > 200000) stateCache.clear();
    stateCache.set(key, st);
  }
  return st;
}

/** How strongly a venue is what a topic asks for, 0..1.1. */
function topicFit(id: string, v: Venue, name: string, related: boolean): number {
  const t = TOPICS[id];
  let fit = 0;
  const ki = t.kinds ? t.kinds.indexOf(v.k) : -1;
  if (ki >= 0) fit = ki === 0 ? 1 : 0.92;
  if (t.cuisines?.length) {
    let best = 0;
    v.cuisines.forEach((c, i) => { const ti = t.cuisines!.indexOf(c); if (ti >= 0) best = Math.max(best, (i === 0 ? 1 : 0.88) * (ti < 2 ? 1 : 0.85)); });
    fit = Math.max(fit, best);
  }
  if (!fit && t.cats?.includes(v.cat)) fit = 0.9;
  const hint = HINTS.get(id);
  const hinted = !!hint && hint.test(name);
  if (hinted) fit = fit ? Math.min(1.1, fit + 0.1) : t.kinds && !t.cuisines && !t.related ? 0 : 0.9;
  if (!fit && related && t.related?.includes(v.k)) fit = 0.5 - 0.1 * t.related.indexOf(v.k);
  // a cafe or bar listed with a pizza cuisine is not a pizzeria
  if (fit && t.cuisines && !t.kinds && !t.cats && v.cat !== 'mancare' && !hinted && !t.related?.includes(v.k)) fit *= 0.6;
  return fit;
}

const FOOD_TOPICS = new Set(Object.entries(TOPICS).filter(([, t]) => t.cuisines && !t.kinds).map(([id]) => id));
const label = (n: number) => (n < 1 ? 'La ' + Math.max(50, Math.round(n * 1000 / 50) * 50) + ' m' : 'La ' + n.toFixed(1).replace('.', ',') + ' km');
const ROMANTIC_NAME = /wine|\bvin|rooftop|sky|garden|gradin|bistro|trattori|osteri|brasserie|lounge|terrace|teras|cuisine|gourmet|atelier/;
const ROMANTIC_CUISINE = new Set(['italian', 'french', 'mediterranean', 'fine_dining', 'seafood', 'fish', 'sushi', 'japanese', 'spanish', 'greek', 'wine']);
const NOT_ROMANTIC = /\bpub\b|\bbere\b|beer|berar|sport|kebab|kebap|shaorm|doner|grill\b|cantina|autoservire|bufet|fast|bistro la minut|non ?stop/;

interface Cand { v: Venue; sc: number; d: number; t: Date; known: boolean; fit: number; price: number }

export function search(all: Venue[], q: string, ctx: Ctx, limit = 40): { results: Scored[]; parsed: Parsed } {
  const p = parseQuery(q);
  const origin = p.place ?? ctx.origin;
  const nearWhat = p.place ? ' de ' + p.place.name : '';
  const n = p.people;
  const empty = { gust: 0, ocazie: 0, calitate: 0, aproape: 0, nou: 0, gasca: 0 };
  const topicHour = p.topics.map((id) => TOPICS[id].hour).find((h) => h !== undefined);
  const timeFor = (v: Venue) => askTime(p.time, info(v).night, ctx.now, topicHour);

  // 1) names: "caru cu bere", "mc donalds unirii", "teatrul national"
  const nameWords = p.raw;
  const nameHits: { v: Venue; s: number }[] = [];
  if (nameWords.length) for (const v of all) { const sc = nameScore(nameWords, v); if (sc >= 0.78) nameHits.push({ v, s: sc }); }
  const strongest = nameHits.reduce((m, h) => Math.max(m, h.s), 0);
  // a typo'd topic word stays a topic unless some venue is really called that ("green hours" is not "greek")
  const exactToken = (w: string) => nameHits.some((h) => toks(h.v).includes(w));
  const realWords = p.words.filter((w) => (!/^\d+$/.test(w) || nameWords.length > 1) && (!p.fuzzy[w] || exactToken(w)));
  const nameIntent = strongest >= 0.84 && (realWords.length > 0 || nameHits.some((h) => h.s >= 0.93 && nameWords.length > 1) || !p.topics.length);
  if (nameIntent) for (const [w, id] of Object.entries(p.fuzzy)) if (realWords.includes(w)) p.topics = p.topics.filter((x) => x !== id);
  const named: Scored[] = [];
  if (nameIntent) {
    for (const { v, s } of nameHits) {
      if (s < strongest - 0.12) continue;
      if (ctx.minor && adultOnly(v)) continue;
      const d = km(origin, v);
      if (p.place && d > p.place.r * 4) continue;
      const t = timeFor(v);
      const st = openState(v, t);
      if (p.time && st.known && !st.open) continue;
      const score = (st.known && !st.open ? -4 : 0) + 200 + 60 * s - (p.place ? d * 4 : d * 0.6) + (st.known && st.open ? 3 : 0) - (ADULT.test(fold(v.name)) ? 5 : 0);
      const o = openAt(v, t);
      named.push({ v, score, km: d, open: o, reasons: [o.label, label(d) + nearWhat].filter((x) => x !== 'Program necunoscut'), parts: empty });
    }
    named.sort((a, b) => b.score - a.score);
  }
  const namedIds = new Set(named.map((x) => x.v.id));

  // 2) topics and modifiers
  const brandAsked = (v: Venue) => namedIds.has(v.id);
  const topics = p.topics.filter((id) => id !== 'chill');
  const food = topics.filter((id) => FOOD_TOPICS.has(id));
  const venueTopics = topics.filter((id) => !FOOD_TOPICS.has(id));
  const wantsSomething = topics.length > 0;
  const anyModifier = !!(p.near || p.place || p.time || p.budget !== undefined || n || p.outdoor || p.family || p.romantic || p.fancy || p.street || p.vibes.length || p.needs.length);
  if (nameIntent && !wantsSomething) return { results: named.slice(0, limit), parsed: p };
  if (!wantsSomething && !anyModifier && !nameIntent) {
    // nothing understood: loose name matches, so the person still sees something
    const loose = nameHits.sort((a, b) => b.s - a.s).slice(0, limit);
    if (loose.length) p.note = 'Nu am înțeles exact, uite ce seamănă.';
    return { results: loose.map(({ v, s }) => { const o = openAt(v, ctx.now); const d = km(origin, v); return { v, score: 100 * s, km: d, open: o, reasons: [o.label, label(d)], parts: empty }; }), parsed: p };
  }

  const rank = (radius: number, useRelated: boolean, relaxOpen: boolean, relaxOutdoor: boolean): Cand[] => {
    const res: Cand[] = [];
    for (const v of all) {
      if (namedIds.has(v.id)) continue;
      const k = info(v);
      const name = fold(v.name);
      if (ADULT.test(name) || (ctx.minor && adultOnly(v))) continue;
      // what
      let fit = 0.6;
      if (wantsSomething) {
        const ff = food.length ? Math.max(...food.map((id) => topicFit(id, v, name, useRelated))) : 0;
        const vf = venueTopics.length ? Math.max(...venueTopics.map((id) => topicFit(id, v, name, useRelated))) : 0;
        if (food.length && venueTopics.length) {
          if (!ff) continue;
          if (!vf && venueTopics.some((id) => !['restaurant', 'mancare', 'fastfood', 'cafe'].includes(id))) continue;
          fit = ff * (vf ? 1 : 0.8);
        } else fit = food.length ? ff : vf;
        if (!fit) continue;
        if (p.raw.some((w) => w.length >= 4 && toks(v).includes(w))) fit += 0.12; // "opera", "jazz", "bistro" in the name itself
      } else if (v.k === 'water_park' || v.k === 'zoo' || v.k === 'theme_park') fit = 0.45; // seasonal or day trips: not a default idea
      else if (v.cat === 'natura' || v.cat === 'sport') fit = 0.5; // a walk or a game: an idea, but not ahead of a place to sit
      // where
      const d = km(origin, v);
      if (p.place && d > radius) continue;
      if (!p.place && d > (p.near ? 12 : 30)) continue;
      if (p.street && !fold(v.street ?? '').includes(p.street)) continue;
      // how many, how much, with whom
      if (n && (n > k.max || (n > 1 && n < k.min))) continue;
      const price = priceOf(v);
      if (p.budget !== undefined && price > p.budget) continue;
      if (p.budgetMin !== undefined && price < p.budgetMin) continue;
      if (p.family && (v.cat === 'bar' || v.cat === 'club')) continue;
      if (p.romantic && (v.fast || v.cat === 'sport' || (v.cat === 'activitate' && v.k !== 'ice_rink'))) continue;
      if (p.outdoor && !relaxOutdoor && !(v.outdoor || OUTDOOR_HINT.test(name) || k.vibes.includes('Aer liber'))) continue;
      // when
      const t = timeFor(v);
      if (dayOnly(v, t)) continue;
      const st = openState(v, t);
      if (st.known && !st.open && p.time) continue;
      if (p.openNow && !st.known && !relaxOpen) continue;
      if (p.time?.nonstop && !relaxOpen && !/24\/7|00:00-24:00|00:00\+/.test(v.hours ?? '')) continue;

      const chain = isChain(v, all) && FOODISH.has(v.cat) && !brandAsked(v);
      const complete = Math.min(1, [v.hours, v.website || v.phone, v.street, v.famous].filter(Boolean).length / 3);
      const hourNow = t.getHours() + (t.getHours() < 5 ? 24 : 0);
      const nightFit = k.night === 0 ? (hourNow <= 19 ? 1 : 0.3) : k.night === 2 ? (hourNow >= 22 ? 1 : 0.35) : (hourNow >= 17 ? 1 : 0.6);
      let sc = 40 * Math.min(fit, 1.2);
      sc += 12 * (0.4 + 0.6 * complete);
      if (chain) sc -= p.fancy ? 30 : 20;
      if (v.fast && (p.romantic || p.fancy || venueTopics.includes('restaurant') || (!wantsSomething && !p.cheap))) sc -= 8;
      sc += p.place ? 22 * Math.max(0, 1 - d / (radius * 1.15)) : 14 * Math.max(0, 1 - d / 12);
      if (p.near && !p.place) sc += 22 * Math.max(0, 1 - d / 5);
      // closed now (no time asked): still shown, lower; a park without hours on the map is simply open by day
      sc += !st.known ? (v.cat === 'natura' ? 10 : p.time ? 3 : 5) : st.open ? 12 : -12;
      if (p.time && !wantsSomething) sc += 14 * nightFit;
      if (p.cheap) sc += 6 * Math.max(0, 1 - price / 60);
      if (p.fancy) sc += Math.min(8, price / 15);
      if (n && n >= 5 && (v.cat === 'activitate' || v.cat === 'bar' || v.k === 'restaurant' || v.k === 'soccer')) sc += 6;
      if (n && n >= 5 && v.cat === 'cafea') sc -= 6;
      if (p.romantic) {
        if (v.k === 'restaurant' || v.k === 'bar') sc += 8;
        if (ROMANTIC_NAME.test(name)) sc += 6;
        if (v.cuisines.some((c) => ROMANTIC_CUISINE.has(c))) sc += 6;
        if (NOT_ROMANTIC.test(name) || v.k === 'pub' || v.cuisines.some((c) => ['kebab', 'shawarma', 'burger', 'fast_food', 'chicken'].includes(c))) sc -= 10;
        if (v.k === 'ice_cream' || v.k === 'cafe') sc -= v.k === 'cafe' ? 3 : 10;
      }
      if (p.family && (v.cat === 'activitate' || v.cat === 'natura' || v.cat === 'desert' || v.k === 'museum' || v.k === 'cinema')) sc += 8;
      const vibes = vibesOf(v);
      if (p.vibes.some((x) => vibes.includes(x))) sc += 5;
      if (p.outdoor && v.outdoor) sc += 3;
      const likes = ctx.prefs.likes;
      if (likes.some((l) => v.cuisines.includes(l) || v.k === l || (vibes as string[]).includes(l))) sc += 3;
      if (ctx.history.includes(v.id)) sc -= 2;
      // wifi, no smoking, wheelchair…: a place the map says has it goes up; one that says the opposite is left out
      let refused = false;
      for (const need of p.needs) { const nf = needFit(v, need); if (nf.no) refused = true; sc += nf.pts; }
      if (refused) continue;
      // the weather: full weight for "ceva diseară"; asked for a park by name, the rain only nudges it down
      const wx = wxScore(v, wxAt(ctx.weather, t));
      sc += wantsSomething ? (wx.pts < 0 ? wx.pts / 3 : wx.pts / 2) : wx.pts;
      res.push({ v, sc, d, t, known: st.known, fit, price });
    }
    return res.sort((a, b) => b.sc - a.sc);
  };

  // relax step by step until there are at least three ideas, and say what was relaxed
  const r0 = p.place ? p.place.r : 30;
  const hasRelated = topics.some((id) => TOPICS[id].related);
  const tries: [number, boolean, boolean, boolean, string][] = [[r0, false, false, false, '']];
  if (hasRelated) tries.push([r0, true, false, false, 'related']);
  if (p.place) tries.push([r0 * 2, hasRelated, false, false, 'far']);
  if (p.outdoor) tries.push([p.place ? r0 * 2 : r0, hasRelated, false, true, 'Puține locuri au terasa trecută pe hartă, așa că îți arăt și altele.']);
  if (p.openNow) tries.push([p.place ? r0 * 2 : r0, hasRelated, true, p.outdoor, 'Unele nu au programul pe hartă: sună înainte să pleci.']);
  if (p.place) tries.push([r0 * 4, hasRelated, p.openNow, p.outdoor, 'far']);
  let list: Cand[] = [];
  let used = tries[0];
  for (const tr of tries) { list = rank(tr[0], tr[1], tr[2], tr[3]); used = tr; if (list.length >= 3) break; }
  const notes: string[] = [];
  if (used[1] && wantsSomething) {
    const exact = list.filter((c) => c.fit > 0.5).length;
    if (exact < 3) notes.push((exact ? 'Am găsit puține locuri cu ' : 'Nu am găsit ') + topics.map((id) => TOPICS[id].label.toLowerCase()).join(', ') + (p.place ? ' în zonă' : '') + (exact ? ', așa că am pus și ceva asemănător.' : ', așa că îți arăt ceva asemănător.'));
  }
  if (used[4] && used[4] !== 'far' && used[4] !== 'related') notes.push(used[4]);

  // the same place mapped twice (a node and a building) shows once
  const seen = new Map<string, Venue[]>();
  let ordered = list.slice(0, limit * 3).filter((c) => {
    const b = baseName(c.v);
    const same = seen.get(b) ?? [];
    if (same.some((y) => km(y, c.v) < 0.15)) return false;
    seen.set(b, [...same, c.v]);
    return true;
  });
  // with nothing specific asked, mix the kinds so the top three are three different ideas
  if (!wantsSomething) {
    const pool = ordered.slice();
    ordered = [];
    while (pool.length && ordered.length < limit) {
      const recent = ordered.slice(-2).map((x) => x.v.cat);
      const i = pool.findIndex((x) => !recent.includes(x.v.cat));
      ordered.push(pool.splice(i === -1 ? 0 : i, 1)[0]);
    }
  }
  const top = ordered.slice(0, Math.max(0, limit - named.length));
  if (p.place && top.slice(0, 3).some((c) => c.d > p.place!.r * 1.05)) notes.push('Am căutat puțin mai departe' + nearWhat + '.');
  p.note = notes.join(' ');

  const results: Scored[] = top.map((c) => {
    const o = openAt(c.v, c.t);
    const name = fold(c.v.name);
    const reasons: string[] = [];
    const hit = topics.find((id) => topicFit(id, c.v, name, false) >= 0.85);
    if (hit) reasons.push(TOPICS[hit].label);
    else if (wantsSomething && c.fit <= 0.62) reasons.push('Ceva asemănător: ' + info(c.v).label.toLowerCase());
    if (o.known) reasons.push(p.time && !p.time.now && o.label === 'Deschis' ? 'Deschis ' + p.time.label : o.label);
    reasons.push(label(c.d) + nearWhat);
    if (p.budget !== undefined) reasons.push('Cam ' + c.price + ' lei de persoană (estimat)');
    if (n && n >= 3) reasons.push('Bun pentru ' + n + ' persoane');
    const wx = wxScore(c.v, wxAt(ctx.weather, c.t));
    if (wx.why) reasons.splice(1, 0, wx.why);
    const met = p.needs.filter((need) => needFit(c.v, need).ok);
    if (met.length) reasons.splice(hit ? 1 : 0, 0, met.map((need) => NEED_SAY[need]).join(', '));
    return { v: c.v, score: c.sc, km: c.d, open: o, reasons: reasons.slice(0, 3), parts: empty };
  });
  // the map knows wifi, smoking and access only for some places: say so when the top ones cannot promise it
  const unsure = p.needs.filter((need) => top.slice(0, 3).filter((c) => needFit(c.v, need).ok).length < Math.min(2, top.length));
  if (unsure.length) p.note = (p.note ? p.note + ' ' : '') + 'Puține localuri au trecut pe hartă ' + unsure.map((need) => NEED_WORD[need]).join(' și ') + ': sună înainte să pleci.';
  // asked for something outside while it will rain: say so once
  const wet = top.slice(0, 3).map((c) => ({ c, w: wxAt(ctx.weather, c.t) })).find(({ c, w }) => w?.wet && exposure(c.v) === 'out');
  if (wet) p.note = (p.note ? p.note + ' ' : '') + 'Atenție: la ora aia e ' + wet.w!.text + '. Ia umbrela sau alege ceva la adăpost.';
  return { results: [...named, ...results].slice(0, limit), parsed: p };
}
