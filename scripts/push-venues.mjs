// Sends all the places to Supabase's public.venues (decision Cornel, 06.10: "toate în Supabase, modificabile din
// admin"), through import_places: new places in, changed ones updated, the ones gone from the map marked gone. What
// was changed by hand in Admin, hidden or added there stays as it is. The rows carry the time the app's copy was made
// (venues-meta.json), so the app does not download again what it already has.
// Run by the OSM and Google workflows when the secret SUPABASE_SERVICE_ROLE_KEY is set.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/push-venues.mjs
import fs from 'node:fs';

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log('Fără SUPABASE_SERVICE_ROLE_KEY: sar peste.'); process.exit(0); }
const venues = JSON.parse(fs.readFileSync('src/data/venues.json', 'utf8'));
const { builtAt } = JSON.parse(fs.readFileSync('src/data/venues-meta.json', 'utf8'));
const res = await fetch(url + '/rest/v1/rpc/import_places', {
  method: 'POST',
  headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_rows: venues, p_at: builtAt, p_full: true }),
});
if (!res.ok) { console.error('Eroare', res.status, await res.text()); process.exit(1); }
console.log('Locuri trimise în Supabase:', venues.length, await res.text());
