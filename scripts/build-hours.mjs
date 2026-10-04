// Turns each venue's OpenStreetMap opening_hours into a ready weekly table (`wk`), once, when the data is built.
// The phone then never parses opening_hours: on a phone that library takes many seconds for 1.700 places.
// wk[day] (0 = Sunday … 6 = Saturday) = [[from, to], …] in minutes of that day (0–1440); past midnight continues
// on the next day's list. Rules that depend on the season or public holidays are read for the coming week, so
// re-run this with the monthly data update: TZ=Europe/Bucharest node scripts/build-hours.mjs
import fs from 'fs';
import opening_hours from 'opening_hours';

const file = 'src/data/venues.json';
const venues = JSON.parse(fs.readFileSync(file, 'utf8'));
const now = new Date();
const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((8 - now.getDay()) % 7 || 7));
const end = new Date(monday.getTime() + 7 * 864e5);
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
let made = 0, bad = 0, unknownOnly = 0;
for (const v of venues) {
  delete v.wk;
  if (!v.hours) continue;
  let o;
  try { o = new opening_hours(v.hours, { lat: v.lat, lon: v.lon, address: { country_code: 'ro', state: 'București' } }, { locale: 'ro' }); } catch { bad++; continue; }
  const wk = [[], [], [], [], [], [], []];
  let known = 0;
  for (const [a, b, unknown] of o.getOpenIntervals(monday, end)) {
    if (unknown) continue;
    known++;
    // split at midnights so every piece belongs to one day
    let s = a;
    while (s < b) {
      const d0 = dayStart(s);
      const next = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1);
      const e = b < next ? b : next;
      const from = s.getHours() * 60 + s.getMinutes();
      const to = e.getTime() === next.getTime() ? 1440 : e.getHours() * 60 + e.getMinutes();
      if (to > from) wk[s.getDay()].push([from, to]);
      s = e;
    }
  }
  if (!known) { unknownOnly++; continue; }
  v.wk = wk;
  made++;
}
fs.writeFileSync(file, JSON.stringify(venues));
console.log(JSON.stringify({ week: monday.toDateString(), withHours: venues.filter((v) => v.hours).length, tables: made, unparsable: bad, unknownOnly, bytes: fs.statSync(file).size }));
