// Reads the opening hours a venue publishes on its OWN website (schema.org JSON-LD / microdata) for the places the map
// has no hours for, and keeps them in src/data/hours-sites.json with the page they came from (31.10, Cornel).
// import-osm.mjs puts them in venues.json only where OpenStreetMap has none. Nothing here comes from Google.
// Polite: one request per site, our own User-Agent, robots.txt respected, 4 at a time.
// Usage: node scripts/hours-from-sites.mjs [--limit N] [--dry]
import fs from 'node:fs';
import opening_hours from 'opening_hours';

const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const dry = args.includes('--dry');
const venuesFile = 'src/data/venues.json';
const outFile = 'src/data/hours-sites.json';
const UA = 'CeFaciBot/1.0 (+https://cefaci.app; contact@cornacidev.ro)';
const SOCIAL = /(^|\.)(facebook|instagram|tiktok|linktr\.ee|linktree|booking|tripadvisor|google|goo\.gl|maps\.app)\b/i;

const venues = JSON.parse(fs.readFileSync(venuesFile, 'utf8'));
const previous = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
const hasHours = (v) => !!v.hours;
// theatres and concert halls publish the box office hours, not when the place is open for a show: left out
const SHOW_HALL = /sala palatului|teatr|opera|filarmonic|ateneul|sală de concert|sala de concert/i;
const targets = venues.filter((v) => !hasHours(v) && v.cat !== 'teatru' && !SHOW_HALL.test(`${v.name} ${v.kind ?? ''}`) && v.website && /^https?:\/\//i.test(v.website) && !SOCIAL.test(new URL(v.website).hostname)).slice(0, limit);

const DAY = { monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th', friday: 'Fr', saturday: 'Sa', sunday: 'Su' };
const ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const hhmm = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? '').trim()); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null; };

/** schema.org OpeningHoursSpecification[] → OSM opening_hours text, grouping days with the same times. */
function fromSpecs(specs) {
  const per = Object.fromEntries(ORDER.map((d) => [d, []]));
  for (const s of specs) {
    const o = hhmm(s.opens), c0 = hhmm(s.closes);
    if (!o || !c0) continue;
    const c = c0 === '00:00' || c0 === '23:59' ? '24:00' : c0;
    const days = [].concat(s.dayOfWeek ?? []).map((d) => DAY[String(d).split('/').pop().toLowerCase()]).filter(Boolean);
    for (const d of days) per[d].push(`${o}-${c}`);
  }
  const groups = new Map();
  for (const d of ORDER) if (per[d].length) { const k = per[d].join(','); groups.set(k, [...(groups.get(k) ?? []), d]); }
  return [...groups].map(([times, ds]) => `${ds.join(',')} ${times}`).join('; ');
}

function candidates(html) {
  const found = new Set();
  const scan = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(scan);
    if (node.openingHoursSpecification) { const t = fromSpecs([].concat(node.openingHoursSpecification)); if (t) found.add(t); }
    if (node.openingHours) { const t = normDays([].concat(node.openingHours).map((x) => String(x).trim()).filter(Boolean).join('; ')); if (t) found.add(t); }
    for (const k of Object.keys(node)) if (typeof node[k] === 'object') scan(node[k]);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { scan(JSON.parse(m[1].trim())); } catch { /* invalid JSON-LD: skip */ }
  }
  const micro = [...html.matchAll(/itemprop=["']openingHours["'][^>]*?(?:content|datetime)=["']([^"']+)["']/gi)].map((m) => m[1].trim());
  if (micro.length) found.add(micro.join('; '));
  return [...found];
}

const EN_DAYS = { monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th', friday: 'Fr', saturday: 'Sa', sunday: 'Su' };
const normDays = (t) => t.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, (d) => EN_DAYS[d.toLowerCase()]);

/** A day named in two rules (Garden8 had "Mo-Su" three times with different times) means we cannot tell which is right: skip. */
function overlaps(text) {
  const seen = new Set();
  for (const rule of text.split(';')) {
    const days = rule.trim().split(/\s\d/)[0];
    for (const part of days.split(',')) {
      const [a, b = a] = part.trim().split('-');
      const i = ORDER.indexOf(a), j = ORDER.indexOf(b);
      if (i < 0 || j < 0) return true; // a day we do not recognise: not safe
      for (let k = i; ; k = (k + 1) % 7) { if (seen.has(ORDER[k])) return true; seen.add(ORDER[k]); if (k === j) break; }
    }
  }
  return false;
}

/** Keep it only if the opening_hours library reads it and it really opens on some days (and is not "always open" by accident). */
function valid(text, v) {
  if (overlaps(text)) return false;
  // "every day 09:00-17:00" is what the WordPress SEO plugins fill in by default (a nightclub and a park had it): not real hours
  if (/^Mo,Tu,We,Th,Fr,Sa,Su 09:00-17:00$/.test(text) || /^Mo-Su 09:00-17:00$/.test(text)) return false;
  try {
    const o = new opening_hours(text, { lat: v.lat, lon: v.lon, address: { country_code: 'ro', state: 'București' } }, { locale: 'ro' });
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 7 * 864e5);
    const it = o.getOpenIntervals(from, to);
    return it.length > 0;
  } catch { return false; }
}

async function robotsAllow(url) {
  try {
    const u = new URL(url);
    const r = await fetch(`${u.origin}/robots.txt`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return true;
    const lines = (await r.text()).split(/\r?\n/);
    let applies = false, blocked = false;
    for (const raw of lines) {
      const l = raw.split('#')[0].trim();
      if (/^user-agent:/i.test(l)) applies = /:\s*(\*|cefacibot)\s*$/i.test(l);
      else if (applies && /^disallow:\s*\/\s*$/i.test(l)) blocked = true;
    }
    return !blocked;
  } catch { return true; }
}

async function one(v) {
  try {
    if (!(await robotsAllow(v.website))) return { id: v.id, name: v.name, why: 'robots.txt' };
    const r = await fetch(v.website, { headers: { 'User-Agent': UA, 'Accept-Language': 'ro,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { id: v.id, name: v.name, why: `HTTP ${r.status}` };
    const html = (await r.text()).slice(0, 2_000_000);
    const c = candidates(html);
    if (!c.length) return { id: v.id, name: v.name, why: 'fără program pe pagină' };
    if (c.length > 1) return { id: v.id, name: v.name, why: 'mai multe programe diferite pe pagină (nesigur)' };
    if (!valid(c[0], v)) return { id: v.id, name: v.name, why: 'program ilizibil' };
    return { id: v.id, name: v.name, hours: c[0], source: r.url };
  } catch (e) { return { id: v.id, name: v.name, why: String(e.cause?.code || e.name || e.message).slice(0, 40) }; }
}

const results = [];
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < targets.length) { const v = targets[next++]; results.push(await one(v)); await new Promise((r) => setTimeout(r, 300)); }
}));

const today = new Date().toISOString().slice(0, 10);
const kept = { ...previous };
let added = 0;
for (const r of results) if (r.hours) { kept[r.id] = { hours: r.hours, source: r.source, checked: today, name: r.name }; added++; }
const why = {};
for (const r of results) if (!r.hours) why[r.why] = (why[r.why] ?? 0) + 1;
console.log(JSON.stringify({ tried: targets.length, found: added, notFound: targets.length - added, why }, null, 1));
if (!dry) fs.writeFileSync(outFile, JSON.stringify(Object.fromEntries(Object.entries(kept).sort(([a], [b]) => a.localeCompare(b))), null, 1));
