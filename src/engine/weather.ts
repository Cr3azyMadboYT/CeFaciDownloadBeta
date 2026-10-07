// The weather in the recommendations (decision Cornel, 04.10): rain or cold sends people to places with a roof,
// sun and warmth to terraces and parks. The forecast comes from the server (public.weather, Google Weather API):
// the next 48 hours, then 7 days (day and night).
import type { Venue } from './types';

export interface WxHour { t: string; c: string; temp: number | null; feel: number | null; rain: number; mm: number; wind: number; storm: number; day: boolean }
export interface WxDay { d: string; max: number | null; min: number | null; cd: string; cn: string; rd: number; rn: number }
export interface Weather { at: string; hours: WxHour[]; days: WxDay[] }

/** The weather at one moment, read for going out. */
export interface WxAt {
  temp: number; rain: number; type: string;
  wet: boolean; storm: boolean; snow: boolean; cold: boolean; hot: boolean; nice: boolean;
  text: string;  // "senin", "ploaie", "averse"…
  icon: 'sun' | 'moon' | 'cloud' | 'rain' | 'snow' | 'storm';
}

const WET = /RAIN|SHOWER|THUNDER|HAIL|SNOW/;
const CLEARISH = /^(CLEAR|MOSTLY_CLEAR|PARTLY_CLOUDY)$/;
export function conditionText(type: string): string {
  if (/THUNDER/.test(type)) return 'furtună';
  if (/HAIL/.test(type)) return 'grindină';
  if (/RAIN_AND_SNOW/.test(type)) return 'lapoviță';
  if (/SNOW/.test(type)) return 'ninsoare';
  if (/SHOWER/.test(type)) return 'averse';
  if (/RAIN/.test(type)) return /LIGHT/.test(type) ? 'ploaie slabă' : 'ploaie';
  if (/WIND/.test(type)) return 'vânt';
  if (type === 'CLEAR' || type === 'MOSTLY_CLEAR') return 'senin';
  if (type === 'PARTLY_CLOUDY') return 'parțial înnorat';
  return 'înnorat';
}

function read(type: string, temp: number, feel: number, rain: number, mm: number, wind: number, storm: number, day: boolean): WxAt {
  const snow = /SNOW/.test(type);
  const st = storm >= 40 || /THUNDER|HAIL/.test(type);
  const wet = st || rain >= 50 || mm >= 0.3 || WET.test(type);
  const cold = feel < 6;
  const hot = temp >= 30;
  const nice = !wet && !cold && temp >= 17 && temp < 33 && wind < 30 && CLEARISH.test(type);
  const icon = st ? 'storm' : snow ? 'snow' : wet ? 'rain' : CLEARISH.test(type) ? (day ? 'sun' : 'moon') : 'cloud';
  return { temp: Math.round(temp), rain, type, wet, storm: st, snow, cold, hot, nice, text: conditionText(type), icon };
}

const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** The weather at `t`: the hour that contains it (next 48 h), else that day's day or night forecast; null if unknown. */
export function wxAt(w: Weather | null | undefined, t: Date): WxAt | null {
  if (!w) return null;
  const ms = t.getTime();
  const h = w.hours.find((x) => { const a = Date.parse(x.t); return a <= ms && ms < a + 3600e3; });
  if (h && h.temp !== null) return read(h.c, h.temp, h.feel ?? h.temp, h.rain, h.mm, h.wind, h.storm, h.day);
  // Google's night of a day runs 19:00 to 07:00 the next morning: 01:00 belongs to the night before
  const early = t.getHours() < 7;
  const d = w.days.find((x) => x.d === iso(early ? new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1, 12) : t));
  if (!d || d.max === null || d.min === null) return null;
  const day = t.getHours() >= 7 && t.getHours() < 19;
  const temp = day ? d.max - 2 : d.min + 3; // the hours people go out, not the extremes
  return read(day ? d.cd : d.cn, temp, temp, day ? d.rd : d.rn, 0, 0, 0, day);
}

// places with no roof, and places that are mostly outdoors
const OUT = new Set(['square', 'promenade', 'park', 'nature_reserve', 'botanical_garden', 'beach_resort', 'golf_course', 'horse_riding', 'miniature_golf', 'zoo', 'theme_park', 'water_park', 'biergarten', 'karting', 'paintball', 'soccer', 'tennis']);
const WATER = new Set(['water_park', 'beach_resort', 'swimming']);
const TERRACE = /teras|gradin|garden|rooftop|beach|curte|summer/;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export type Exposure = 'out' | 'terrace' | 'in';
export function exposure(v: Venue): Exposure {
  if (/^Mall/.test(v.kind ?? '')) return 'in'; // a mall counted as a meeting place: shelter, not a square
  if (OUT.has(v.k)) return 'out';
  if (v.outdoor || TERRACE.test(fold(v.name))) return 'terrace';
  return 'in';
}

/** Points for the weather at the place's moment, and the reason to show (if any). */
export function wxScore(v: Venue, wx: WxAt | null): { pts: number; why?: string } {
  if (!wx) return { pts: 0 };
  const e = exposure(v);
  if (e === 'out') {
    if (wx.storm) return { pts: -35 };
    if (wx.wet) return { pts: -25 };
    if (wx.cold) return { pts: -12 };
    if (wx.hot && WATER.has(v.k)) return { pts: 12, why: 'E cald: bun de stat la apă' };
    if (wx.nice) return { pts: 8, why: 'Vreme bună de stat afară' };
    return { pts: 0 };
  }
  if (WATER.has(v.k) && (wx.cold || wx.wet)) return { pts: -6 };
  if (e === 'terrace') return wx.nice ? { pts: 5, why: 'Are terasă și e vreme bună' } : { pts: 0 };
  if (wx.wet) return { pts: 6, why: 'La adăpost de ' + (wx.snow ? 'ninsoare' : 'ploaie') };
  if (wx.cold) return { pts: 4, why: 'La căldură' };
  return { pts: 0 };
}

/** One short line for Acasă: "Diseară 14°, ploaie după 21:00" — the weather for the moment people plan for. */
export function wxLine(w: Weather | null | undefined, from: Date, until: Date, label: string): string | null {
  const start = wxAt(w, from);
  if (!start) return null;
  let change: { at: Date; wx: WxAt } | null = null;
  for (let t = new Date(from.getTime() + 3600e3); t < until; t = new Date(t.getTime() + 3600e3)) {
    const x = wxAt(w, t);
    if (x && x.wet && !start.wet) { change = { at: t, wx: x }; break; }
  }
  const hh = (d: Date) => String(d.getHours()).padStart(2, '0') + ':00';
  if (change) return label + ' ' + start.temp + '°, ' + change.wx.text + ' de la ' + hh(change.at);
  return label + ' ' + start.temp + '°, ' + start.text;
}
