// Time as people going out think of it (decision Cornel, 04.10: "după ora 8 logica nu e bună"): the night belongs to
// the evening it started in — at 01:00 on Sunday, "acum" is still Saturday night and "diseară" is Sunday evening — so
// the day turns at 05:00, not at midnight. And daylight: a park, a palace or a lake is not a plan after dark.
// All times are the phone's wall clock in București (the venues' weekly hours are written the same way).

export const DAY_TURNS_AT = 5; // hours: 00:00–04:59 belong to the evening before

/** yyyy-mm-dd of a wall-clock date. */
export const isoDay = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const dayFromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const hhmm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
/** Hours as a number that keeps growing after midnight: 01:30 → 25.5 (night hours count after the evening). */
export const nightHour = (d: Date) => d.getHours() + d.getMinutes() / 60 + (d.getHours() < DAY_TURNS_AT ? 24 : 0);

/** The evening a moment belongs to: before 05:00 it is still the previous day's night. */
export function eveningOf(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < DAY_TURNS_AT) d.setDate(d.getDate() - 1);
  return isoDay(d);
}

/** The real moment of "that evening at that hour": hours before 05:00 are after midnight, on the next calendar day. */
export function momentOf(evening: string, hour: string): Date {
  const d = dayFromIso(evening);
  const [h, m] = hour.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  if ((h || 0) < DAY_TURNS_AT) d.setDate(d.getDate() + 1);
  return d;
}

/** Whole days between two evenings (yyyy-mm-dd). */
export const daysBetween = (a: string, b: string) => Math.round((dayFromIso(b).getTime() - dayFromIso(a).getTime()) / 864e5);
export const addDays = (evening: string, n: number) => { const d = dayFromIso(evening); d.setDate(d.getDate() + n); return isoDay(d); };

// ---------- saying it ----------
const DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What an evening is called, seen from `now`, like the phone's calendar: "Azi" or "Diseară" (by the hour), "Mâine",
 * "Poimâine", the weekday; after midnight the night that is still going is "Noaptea asta". */
export function eveningWord(evening: string, now: Date, hour?: number): string {
  const diff = daysBetween(isoDay(now), evening);
  if (diff < 0) return 'Noaptea asta';
  if (diff === 0) return hour !== undefined && hour >= DAY_TURNS_AT && hour < 17 ? 'Azi' : 'Diseară';
  if (diff === 1) return 'Mâine';
  if (diff === 2) return 'Poimâine';
  return cap(DAYS[dayFromIso(evening).getDay()]);
}
/** "sâm. 4 oct." — the evening's calendar date, short. */
export const dateShort = (evening: string) => { const d = dayFromIso(evening); return DAYS[d.getDay()].slice(0, 3) + '. ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
/** "Diseară la 21:00", "Mâine la 20:00", "Joi, 8 oct., la 20:00", "Noaptea asta, la 02:00". */
export function whenWords(evening: string, hour: string, now: Date): string {
  const h = Number(hour.split(':')[0]);
  const word = eveningWord(evening, now, h);
  const d = dayFromIso(evening);
  if (word === 'Noaptea asta') return word + ', la ' + hour;
  if (daysBetween(isoDay(now), evening) > 2) return word + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ', la ' + hour;
  return word + ' la ' + hour;
}

// ---------- the sun over București ----------
const LAT = 44.43;
const LON = 26.1;
const rad = (x: number) => (x * Math.PI) / 180;
const deg = (x: number) => (x * 180) / Math.PI;
const mod = (x: number, m: number) => ((x % m) + m) % m;

/** Summer time in Romania: from the last Sunday of March to the last Sunday of October (01:00 UTC). */
function summer(y: number, m: number, d: number): boolean {
  const lastSunday = (month: number) => { const t = new Date(Date.UTC(y, month + 1, 0)); return t.getUTCDate() - t.getUTCDay(); };
  if (m < 2 || m > 9) return false;
  if (m > 2 && m < 9) return true;
  return m === 2 ? d >= lastSunday(2) : d < lastSunday(9);
}

/** Sunrise or sunset as wall-clock minutes in București for a calendar day (the "Almanac for Computers" method, ±2 min). */
function sunMinutes(y: number, m: number, d: number, rising: boolean): number {
  const n = Math.floor((Date.UTC(y, m, d) - Date.UTC(y, 0, 0)) / 864e5);
  const lngHour = LON / 15;
  const t = n + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  const L = mod(M + 1.916 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 282.634, 360);
  let RA = mod(deg(Math.atan(0.91764 * Math.tan(rad(L)))), 360);
  RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
  const sinDec = 0.39782 * Math.sin(rad(L));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(rad(90.833)) - sinDec * Math.sin(rad(LAT))) / (cosDec * Math.cos(rad(LAT)));
  const H = (rising ? 360 - deg(Math.acos(Math.max(-1, Math.min(1, cosH)))) : deg(Math.acos(Math.max(-1, Math.min(1, cosH))))) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const ut = mod(T - lngHour, 24);
  return Math.round(mod(ut + (summer(y, m, d) ? 3 : 2), 24) * 60);
}

const sunCache = new Map<string, [number, number]>();
/** [sunrise, sunset] in wall-clock minutes for the calendar day of `t`. */
export function sunOf(t: Date): [number, number] {
  const key = t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate();
  let s = sunCache.get(key);
  if (!s) { s = [sunMinutes(t.getFullYear(), t.getMonth(), t.getDate(), true), sunMinutes(t.getFullYear(), t.getMonth(), t.getDate(), false)]; sunCache.set(key, s); }
  return s;
}

/** Too dark for a park or a palace: from 20 minutes after sunset to sunrise. */
export function isDark(t: Date): boolean {
  const [rise, set] = sunOf(t);
  const m = t.getHours() * 60 + t.getMinutes();
  return m > set + 20 || m < rise;
}

/** "18:52" — the sunset of that day, to say it. */
export function sunsetText(t: Date): string {
  const set = sunOf(t)[1];
  return String(Math.floor(set / 60)).padStart(2, '0') + ':' + String(set % 60).padStart(2, '0');
}
