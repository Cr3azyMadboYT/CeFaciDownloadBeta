// Fills the server cache of e-deschis (public.place_hours) for the businesses (no parks, museums, theatres or public
// places), by hand (workflow "Programul localurilor"); normally e-deschis fills it when a place is in a plan.
// Nothing is written to the repo. Usage: PLACES_API_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/fetch-hours.mjs [--limit N]
import fs from 'node:fs';

const key = process.env.PLACES_API_KEY, url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || !url || !service) { console.error('Lipsește PLACES_API_KEY, SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
const BUSINESS = new Set(['mancare', 'cafea', 'bar', 'club', 'desert', 'activitate', 'sport', 'film']);
const MAX_DAYS = 3, FRESH_DAYS = 1;

const db = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  .then(async (r) => { if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`); return r.status === 204 ? null : r.json().catch(() => null); });
const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();

await db(`place_hours?fetched_at=lt.${ago(MAX_DAYS)}`, { method: 'DELETE' });
const fresh = new Set((await db(`place_hours?select=venue_id&fetched_at=gte.${ago(FRESH_DAYS)}`)).map((r) => r.venue_id));
const pid = new Map((await db('venue_google?select=venue_id,place_id')).map((r) => [r.venue_id, r.place_id]));
const venues = JSON.parse(fs.readFileSync('src/data/venues.json', 'utf8')).filter((v) => BUSINESS.has(v.cat) && !fresh.has(v.id)).slice(0, limit);

const km = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['restaurant', 'cafe', 'cafenea', 'bar', 'pub', 'the', 'si', 'de', 'la', 'and', 'bistro', 'club', 'pizzeria']);
const words = (s) => fold(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
const sameName = (a, b) => { const fa = fold(a), fb = fold(b); if (fa.includes(fb) || fb.includes(fa)) return true; const wb = new Set(words(b)); return words(a).some((w) => wb.has(w)); };

async function google(u, init) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(u, init);
    if (res.status === 429 || res.status >= 500) { await new Promise((ok) => setTimeout(ok, 2000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error('Places ' + res.status + ': ' + (await res.text()).slice(0, 300));
    return res.json();
  }
  throw new Error('Places: prea multe încercări');
}
/** The place on Google: by its kept id (Place Details), otherwise found by name near our position (Text Search). */
async function lookup(v) {
  const known = pid.get(v.id);
  if (known) return google('https://places.googleapis.com/v1/places/' + known, { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,regularOpeningHours.periods,utcOffsetMinutes' } });
  const data = await google('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.regularOpeningHours.periods,places.utcOffsetMinutes' },
    body: JSON.stringify({ textQuery: v.name, languageCode: 'ro', regionCode: 'RO', maxResultCount: 5, locationBias: { circle: { center: { latitude: v.lat, longitude: v.lon }, radius: 300 } } }),
  });
  const p = (data.places ?? []).map((p) => ({ p, m: km(v, { lat: p.location.latitude, lon: p.location.longitude }) * 1000 }))
    .filter(({ p, m }) => m < 250 && (m < 60 || sameName(v.name, p.displayName?.text ?? ''))).sort((a, b) => a.m - b.m)[0]?.p;
  if (p) await db('venue_google', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ venue_id: v.id, place_id: p.id, checked_at: new Date().toISOString() }) });
  return p ?? null;
}

const stats = { asked: venues.length, withHours: 0, noHours: 0, notFound: 0, errors: 0 };
const rows = [];
let i = 0;
async function worker() {
  while (i < venues.length) {
    const v = venues[i++];
    try {
      const p = await lookup(v);
      if (!p) { stats.notFound++; continue; }
      const periods = p.regularOpeningHours?.periods?.length ? p.regularOpeningHours.periods : null;
      stats[periods ? 'withHours' : 'noHours']++;
      rows.push({ venue_id: v.id, periods, utc_offset: typeof p.utcOffsetMinutes === 'number' ? p.utcOffsetMinutes : 180, fetched_at: new Date().toISOString() });
    } catch (e) { console.error(v.id, e.message); stats.errors++; if (/Places 40[13]/.test(e.message)) process.exit(1); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
for (let k = 0; k < rows.length; k += 200) await db('place_hours', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows.slice(k, k + 200)) });
console.log(JSON.stringify({ ...stats, skippedFresh: fresh.size }, null, 1));
