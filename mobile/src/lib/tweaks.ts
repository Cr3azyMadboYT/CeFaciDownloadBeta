// One-tap changes on the results (decision Cornel, 04.10): cheaper, closer, open now, outside or with a roof,
// without opening the filters. With a search typed, they add words the search understands.
import { APP } from '../../../src/app/bridge';
import type { Filters, Place } from './filters';

export interface Tweak { id: string; label: string; icon?: string; apply: { f?: Partial<Filters>; q?: string } }

const has = (q: string, re: RegExp) => re.test(q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());

export function tweaksFor(f: Filters, sq: string, shown: Place[]): Tweak[] {
  const out: Tweak[] = [];
  const wx = APP.weatherFor(f.when);
  const q = sq.trim();
  if (q.length > 1) {
    if (!has(q, /ieftin|buget|lei/)) out.push({ id: 'cheap', label: 'Mai ieftin', icon: 'wallet', apply: { q: q + ' ieftin' } });
    if (!has(q, /deschis|acum/)) out.push({ id: 'open', label: 'Deschis acum', icon: 'clock', apply: { q: q + ' deschis acum' } });
    if (!wx?.wet && !has(q, /teras|afara|aer liber/)) out.push({ id: 'out', label: 'Cu terasă', icon: 'sun', apply: { q: q + ' cu terasa' } });
    return out;
  }
  const prices = shown.map((p) => p.price).filter((p) => p > 0);
  if (prices.length) {
    const cap = Math.max(10, Math.min(...prices) - 5);
    out.push({ id: 'cheap', label: 'Mai ieftin', icon: 'wallet', apply: { f: { budget: '-' + cap } } });
  }
  if (f.dist !== '5') out.push({ id: 'near', label: 'Mai aproape', icon: 'pin', apply: { f: { dist: f.dist === '40' ? '20' : f.dist === '30' ? '20' : f.dist === '20' ? '10' : '5' } } });
  if (f.when !== 'now') out.push({ id: 'open', label: 'Deschis acum', icon: 'clock', apply: { f: { when: 'now' } } });
  if (wx?.wet && f.where !== 'in') out.push({ id: 'roof', label: 'La adăpost', icon: 'rain', apply: { f: { where: 'in' } } });
  else if (!wx?.wet && f.where !== 'out') out.push({ id: 'out', label: wx?.nice ? 'Afară, e frumos' : 'Afară sau terasă', icon: 'sun', apply: { f: { where: 'out' } } });
  if (f.where) out.push({ id: 'any', label: 'Oriunde', apply: { f: { where: undefined } } });
  return out;
}
