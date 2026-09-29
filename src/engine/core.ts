import opening_hours from 'opening_hours';
import { CUISINES, KINDS, SYNONYMS, VIBES, ZONES } from './catalog';
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

export function openAt(v: Venue, t: Date): OpenInfo {
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

// ---------- scoring ----------
export const WHO_N: Record<Who, number> = { '1': 1, '2': 2, '34': 4, '5': 6 };

/**
 * score = 35 gust + 20 ocazie + 15 calitate + 10 aproape + 10 nou + 10 gașcă
 * (the weights from the "Versiunea 1" document). Returns null when a hard filter fails.
 */
export function scoreVenue(v: Venue, ask: Ask, ctx: Ctx): Scored | null {
  const k = info(v);
  const d = km(ctx.origin, v);
  if (d > ask.maxKm) return null;
  const price = priceOf(v);
  if (price > ask.budget) return null;
  const n = WHO_N[ask.who];
  if (n > k.max) return null;
  const t = targetTime(ask.when, k.night, ctx.now);
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

  const complete = [v.hours, v.website || v.phone, v.street].filter(Boolean).length / 3;
  const calitate = 15 * (0.4 + 0.6 * complete) * (v.brand ? 0.7 : 1) * (v.fast ? 0.75 : 1);
  const aproape = 10 * Math.max(0, 1 - d / Math.max(ask.maxKm, 1));
  const nou = ctx.history.includes(v.id) ? 0 : 10;
  const gasca = 10 * (n >= k.min && n <= k.max ? (n >= 3 && (k.cat === 'activitate' || k.cat === 'bar') ? 1 : 0.8) : 0.3);

  const parts = { gust, ocazie, calitate, aproape, nou, gasca };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  const reasons: string[] = [];
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
export interface Parsed { raw: string[]; words: string[]; kinds: string[]; cuisines: string[]; cats: Cat[]; vibes: Vibe[]; outdoor: boolean; openNow: boolean; zone?: string; cheap: boolean; }

export function parseQuery(q: string): Parsed {
  const p: Parsed = { raw: [], words: [], kinds: [], cuisines: [], cats: [], vibes: [], outdoor: false, openNow: false, cheap: false };
  let s = ' ' + fold(q).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const zoneHit = (re: RegExp, id: string) => { if (re.test(s)) { p.zone = id; s = s.replace(re, ' '); } };
  for (let i = 1; i <= 6; i++) zoneHit(new RegExp(' (sector(ul)? ?' + i + '|s' + i + ') '), 's' + i);
  zoneHit(/ centru(l)?( vechi)? /, 'centru');
  for (const z of ['buftea', 'chitila', 'mogosoaia', 'otopeni', 'corbeanca', 'voluntari', 'pipera', 'pantelimon', 'popesti', 'bragadiru', 'chiajna', 'militari', 'snagov', 'magurele']) {
    const id = z === 'pipera' ? 'voluntari' : z === 'militari' ? 'chiajna' : z;
    zoneHit(new RegExp(' ' + z + ' '), id);
  }
  if (/ (deschis[aei]?|acum|non ?stop) /.test(s)) { p.openNow = true; s = s.replace(/ (deschis[aei]?|acum|non ?stop)(?= )/g, ''); }
  if (/ (ieftin|ieftine|buget) /.test(s)) { p.cheap = true; s = s.replace(/ (ieftin|ieftine|buget)(?= )/g, ''); }
  s = s.replace(/ escape room /g, ' escaperoom ').replace(/ fast food /g, ' fastfood ');
  const stop = new Set(['cu', 'si', 'in', 'la', 'de', 'pe', 'un', 'o', 'ceva', 'unde', 'bun', 'buna', 'bune', 'loc', 'locuri', 'aproape', 'lange', 'langa', 'din', 'pentru', 'cel', 'mai']);
  for (const w of s.trim().split(' ').filter(Boolean)) {
    if (!stop.has(w)) p.raw.push(w);
    const syn = SYNONYMS[w] ?? SYNONYMS[w.replace(/(uri|ele|e|i)$/, '')];
    if (syn) {
      if (syn.kind) p.kinds.push(...syn.kind);
      if (syn.cuisine) p.cuisines.push(...syn.cuisine);
      if (syn.cat) p.cats.push(...syn.cat);
      if (syn.vibe) p.vibes.push(syn.vibe as Vibe);
      if (syn.outdoor) p.outdoor = true;
    } else if (!stop.has(w)) p.words.push(w);
  }
  return p;
}

/** Word match on the venue name: every typed word must start a word of the name, allowing one typo in longer words. */
function nameMatch(words: string[], name: string): number {
  if (!words.length) return 1;
  const toks = fold(name).split(/[^a-z0-9]+/).filter(Boolean);
  const full = toks.join(' ');
  if (words.length > 1 && toks.join('').includes(words.join(''))) return 1;
  let total = 0;
  for (const w of words) {
    if (full.includes(w)) { total += toks.some((t) => t.startsWith(w)) ? 1 : 0.8; continue; }
    if (w.length >= 4 && toks.some((t) => near(t.slice(0, w.length), w) || near(t.slice(0, w.length + 1), w))) { total += 0.6; continue; }
    return 0;
  }
  return total / words.length;
}
function near(a: string, b: string): boolean { // edit distance <= 1
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
}

export function search(all: Venue[], q: string, ctx: Ctx, limit = 40): { results: Scored[]; parsed: Parsed } {
  const p = parseQuery(q);
  const origin = p.zone ? zoneById(p.zone) : ctx.origin;
  const ask: Ask = { who: '2', when: 'acum', budget: p.cheap ? 50 : Infinity, maxKm: p.zone ? 6 : 80, vibes: p.vibes };
  const c2: Ctx = { ...ctx, origin };
  const out: Scored[] = [];
  for (const v of all) {
    const kk = kindKeyOf(v);
    const byName = p.words.length ? nameMatch(p.raw, v.name) : 0; // only when something besides known words was typed
    if (byName >= 0.8) { const d0 = km(origin, v); const o0 = openAt(v, ctx.now); const lead = fold(v.name).startsWith(p.raw[0]) ? 15 : 0; if (!p.openNow || (o0.known && o0.open)) out.push({ v, score: 100 + 40 * byName + lead - v.name.length * 0.15 - d0 * 0.3, km: d0, open: o0, reasons: [o0.label], parts: { gust: 0, ocazie: 0, calitate: 0, aproape: 0, nou: 0, gasca: 0 } }); continue; }
    if (p.kinds.length && !p.kinds.includes(kk) && !(p.kinds.includes('restaurant') && v.cat === 'mancare')) continue;
    if (p.cuisines.length && !v.cuisines.some((c) => p.cuisines.includes(c)) && !(p.cuisines.includes('ice_cream') && kk === 'ice_cream')) continue;
    if (p.cats.length && !p.cats.includes(v.cat)) continue;
    if (p.outdoor && !v.outdoor && !['biergarten', 'zoo', 'water_park', 'theme_park', 'miniature_golf'].includes(kk)) continue;
    const text = nameMatch(p.words, v.name) || (p.words.length && p.words.every((w) => fold((v.street ?? '') + ' ' + (v.city ?? '')).includes(w)) ? 0.5 : 0);
    if (!text) continue;
    const d = km(origin, v);
    if (d > ask.maxKm) continue;
    const open = openAt(v, ctx.now);
    if (p.openNow && !(open.known && open.open)) continue;
    const s = scoreVenue(v, { ...ask, who: '1' }, { ...c2, now: ctx.now });
    const base = s ? s.score : 40;
    const foodFit = p.cuisines.length && v.cat === 'mancare' ? 12 : 0;
    const rel = 60 * text + 0.4 * base + foodFit - (p.words.length ? 0 : d * 1.2);
    out.push({ v, score: rel, km: d, open, reasons: s ? s.reasons : [open.label], parts: s ? s.parts : { gust: 0, ocazie: 0, calitate: 0, aproape: 0, nou: 0, gasca: 0 } });
  }
  out.sort((a, b) => b.score - a.score);
  return { results: out.slice(0, limit), parsed: p };
}
