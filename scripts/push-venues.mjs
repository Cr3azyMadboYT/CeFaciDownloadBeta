// Sends the places (id, name, kind, position) to Supabase's public.venues, which the server uses to check that a
// check-in really happened at the place. Run by .github/workflows/osm.yml when the secret SUPABASE_SERVICE_ROLE_KEY
// is set. Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/push-venues.mjs
import fs from 'node:fs';

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log('Fără SUPABASE_SERVICE_ROLE_KEY: sar peste.'); process.exit(0); }
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []);
const rows = [...read('src/data/venues.json'), ...read('src/data/gone.json')]
  .map((v) => ({ id: v.id, name: v.name.slice(0, 120), cat: v.cat, lat: v.lat, lon: v.lon, updated_at: new Date().toISOString() }));
for (let i = 0; i < rows.length; i += 500) {
  const res = await fetch(url + '/rest/v1/venues?on_conflict=id', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows.slice(i, i + 500)),
  });
  if (!res.ok) { console.error('Eroare la', i, res.status, await res.text()); process.exit(1); }
}
console.log('Locuri trimise în Supabase:', rows.length);
