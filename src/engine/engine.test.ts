// Unit tests use a tiny made-up fixture; the app itself ships only real OpenStreetMap venues.
import { describe, expect, it } from 'vitest';
import { fold, km, openAt, parseQuery, recommend, search, targetTime } from './core';
import type { Ctx, Venue } from './types';

const V = (id: string, name: string, k: string, cat: Venue['cat'], lat: number, lon: number, extra: Partial<Venue> = {}): Venue =>
  ({ id, name, k, kind: k, cat, cuisines: [], lat, lon, zone: 'centru', ...extra });
const F: Venue[] = [
  V('t1', 'Pizzeria Test Unu', 'restaurant', 'mancare', 44.432, 26.101, { cuisines: ['pizza'], hours: 'Mo-Su 12:00-23:00' }),
  V('t2', 'Bowling Test', 'bowling_alley', 'activitate', 44.44, 26.1, { hours: 'Mo-Su 14:00-24:00' }),
  V('t3', 'Cafeneaua Test', 'cafe', 'cafea', 44.43, 26.09, { hours: 'Mo-Su 08:00-18:00' }),
  V('t4', 'Club Test', 'nightclub', 'club', 44.43, 26.1, { hours: 'Th-Sa 23:00-05:00' }),
  V('t5', 'Muzeul Test', 'museum', 'cultura', 44.45, 26.08, { hours: 'Tu-Su 10:00-18:00' }),
  V('t6', 'Bar Departe', 'bar', 'bar', 44.70, 26.17, {}),
];
const ctx = (now: Date): Ctx => ({ prefs: { zone: 'centru', likes: ['Chill', 'pizza'] }, origin: { lat: 44.4312, lon: 26.101 }, now, history: [] });
const fri = new Date(2026, 9, 2, 18, 30); // Friday 2 Oct 2026, 18:30

describe('engine', () => {
  it('folds diacritics', () => expect(fold('Șură Țară ÎĂâ')).toBe('sura tara iaa'));
  it('measures distance', () => expect(km({ lat: 44.4312, lon: 26.101 }, { lat: 44.568, lon: 25.948 })).toBeGreaterThan(18));
  it('reads opening hours', () => {
    expect(openAt(F[2], new Date(2026, 9, 2, 20, 0)).open).toBe(false);
    expect(openAt(F[0], fri).label).toBe('Deschis până la 23:00');
    expect(openAt(F[5], fri).known).toBe(false);
  });
  it('targets the evening for "diseara"', () => expect(targetTime('diseara', 1, fri).getHours()).toBe(20));
  it('recommends open, near, varied places', () => {
    const r = recommend(F, { who: '34', when: 'diseara', budget: Infinity, maxKm: 10, vibes: [] }, ctx(fri));
    const ids = r.picks.map((p) => p.v.id);
    expect(ids).not.toContain('t3'); // cafe closes at 18
    expect(ids).not.toContain('t6'); // too far
    expect(new Set(r.picks.map((p) => p.v.cat)).size).toBe(r.picks.length);
    expect(r.picks[0].reasons.length).toBeGreaterThan(0);
  });
  it('drops places over budget', () => {
    const r = recommend(F, { who: '2', when: 'diseara', budget: 50, maxKm: 10, vibes: [] }, ctx(fri));
    expect(r.picks.every((p) => p.v.k !== 'restaurant')).toBe(true);
  });
  it('parses queries', () => {
    const p = parseQuery('pizza deschis sector 2 cu terasă');
    expect(p.cuisines).toContain('pizza'); expect(p.openNow).toBe(true); expect(p.zone).toBe('s2'); expect(p.outdoor).toBe(true);
    expect(parseQuery('escape room').kinds).toContain('escape_game');
  });
  it('searches names with typos', () => {
    expect(search(F, 'bowlng', ctx(fri)).results[0]?.v.id).toBe('t2');
    expect(search(F, 'pizza', ctx(fri)).results.map((r) => r.v.id)).toEqual(['t1']);
    expect(search(F, 'muzeu', ctx(fri)).results[0]?.v.id).toBe('t5');
  });
});
