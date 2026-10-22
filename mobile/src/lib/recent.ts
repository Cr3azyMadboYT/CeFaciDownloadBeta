// The last searches in Explorează (Cornel, 22.10): in place of the examples, newest first, at most 6. Kept on the phone
// only ('cefaci.' key: another account signing in on this phone wipes it, session.ts forgetOtherAccount).
import { useSyncExternalStore } from 'react';

export const RECENT_KEY = 'cefaci.recentSearches';
export const RECENT_MAX = 6;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[șş]/g, 's').replace(/[țţ]/g, 't').toLowerCase();
/** "  Pizza   sector 2 " → "Pizza sector 2" (what is shown and searched again). */
export const tidy = (q: string) => q.replace(/\s+/g, ' ').trim().slice(0, 60);

/** `list` with `q` on top: the same search typed again (case, diacritics) moves up instead of repeating. */
export function addRecent(list: string[], q: string): string[] {
  const x = tidy(q);
  if (x.length < 2) return list;
  return [x, ...list.filter((y) => fold(tidy(y)) !== fold(x))].slice(0, RECENT_MAX);
}

let mem: string[] | null = null;
const subs = new Set<() => void>();
function load(): string[] {
  if (mem) return mem;
  try { const v = JSON.parse(globalThis.localStorage?.getItem(RECENT_KEY) || '[]'); mem = Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, RECENT_MAX) : []; }
  catch { mem = []; }
  return mem;
}
function save(next: string[]) {
  mem = next;
  try { globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage blocked: kept for this session */ }
  subs.forEach((f) => f());
}
export const rememberSearch = (q: string) => { const next = addRecent(load(), q); if (next !== mem) save(next); };
export const forgetSearches = () => save([]);
export function useRecentSearches(): string[] {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, load, load);
}
