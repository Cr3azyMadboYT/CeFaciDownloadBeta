// What the OpenStreetMap import keeps (scripts/osm-kinds.mjs) and how the engine treats the outdoor and sport places.
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module
import { classify, overpassQuery } from '../scripts/osm-kinds.mjs';
import { KINDS } from '../src/engine/catalog';
import { dayOnly, parseQuery, recommend, search } from '../src/engine/core';
import type { Ctx, Venue } from '../src/engine/types';

describe('OSM kinds', () => {
  it('keeps parks, courts, sights and the old kinds', () => {
    expect(classify({ amenity: 'restaurant' })).toEqual({ k: 'restaurant', cat: 'mancare', label: 'Restaurant' });
    expect(classify({ leisure: 'park' })?.cat).toBe('natura');
    expect(classify({ leisure: 'pitch', sport: 'padel' })?.k).toBe('padel');
    expect(classify({ leisure: 'sports_centre', sport: 'fitness;tennis' })?.k).toBe('tennis');
    expect(classify({ leisure: 'track', sport: 'karting' })?.k).toBe('karting');
    expect(classify({ leisure: 'swimming_pool' })?.k).toBe('swimming');
    expect(classify({ historic: 'palace', tourism: 'museum' })?.k).toBe('museum');
    expect(classify({ historic: 'palace', wikidata: 'Q1' })?.k).toBe('palace');
    expect(classify({ historic: 'castle', ruins: 'yes', website: 'x' })?.cat).toBe('cultura');
  });
  it('drops what nobody goes out to', () => {
    expect(classify({ leisure: 'sports_centre', sport: 'fitness' })).toBeNull();
    expect(classify({ leisure: 'pitch', sport: 'soccer', access: 'private' })).toBeNull();
    expect(classify({ leisure: 'track', sport: 'running' })).toBeNull();
    expect(classify({ historic: 'palace' })).toBeNull(); // an office in an old palace: not a visit
    expect(classify({ amenity: 'bank' })).toBeNull();
  });
  it('every kind it makes is known to the engine', () => {
    const tags = [{ leisure: 'park' }, { leisure: 'nature_reserve' }, { leisure: 'garden', 'garden:type': 'botanical' }, { leisure: 'beach_resort' },
      { leisure: 'golf_course' }, { leisure: 'horse_riding' }, { amenity: 'planetarium' }, { amenity: 'monastery' }, { tourism: 'aquarium' },
      ...['padel', 'tennis', 'soccer', 'swimming', 'climbing', 'squash', 'karting', 'paintball', 'billiards', 'golf', 'equestrian'].map((sport) => ({ leisure: 'sports_centre', sport })),
      ...['castle', 'palace', 'manor', 'monastery'].map((historic) => ({ historic, wikidata: 'Q' }))];
    for (const t of tags) { const c = classify(t); expect(c, JSON.stringify(t)).not.toBeNull(); expect(KINDS[c.k], c.k).toBeDefined(); expect(KINDS[c.k].cat).toBe(c.cat); }
  });
  it('asks Overpass for all of it', () => {
    const q = overpassQuery();
    for (const w of ['restaurant', 'padel', 'park', 'castle', 'swimming_pool', 'out center', 'out bb']) expect(q).toContain(w);
  });
});

const V = (id: string, name: string, k: string, cat: Venue['cat'], extra: Partial<Venue> = {}): Venue =>
  ({ id, name, k, kind: KINDS[k].label, cat, cuisines: [], lat: 44.568, lon: 25.948, zone: 'buftea', ...extra });
const F: Venue[] = [
  V('a', 'Restaurant Unu', 'restaurant', 'mancare', { hours: 'Mo-Su 10:00-23:00' }),
  V('b', 'Restaurant Doi', 'restaurant', 'mancare', { hours: 'Mo-Su 10:00-23:00', lat: 44.569 }),
  V('c', 'Cafeneaua', 'cafe', 'cafea', { hours: 'Mo-Su 08:00-22:00' }),
  V('d', 'Parcul Palatului Știrbey', 'park', 'natura'),
  V('e', 'Padel Club Buftea', 'padel', 'sport', { hours: 'Mo-Su 08:00-23:00' }),
  V('f', 'Palatul Știrbey', 'palace', 'cultura'),
];
const ctx = (now: Date): Ctx => ({ prefs: { zone: 'buftea', likes: [] }, origin: { lat: 44.568, lon: 25.948 }, now, history: [] });
const sat = new Date(2026, 9, 3, 11, 0);

describe('outdoor and sport places', () => {
  it('mixes them into the ideas for a small town', () => {
    const r = recommend(F, { who: '34', when: 'weekend', budget: Infinity, maxKm: 8, vibes: [] }, ctx(sat), 0, 5);
    const cats = new Set(r.picks.map((p) => p.v.cat));
    expect(cats.size).toBeGreaterThanOrEqual(4);
  });
  it('a park is free and not offered at midnight', () => {
    const late = new Date(2026, 9, 3, 23, 30);
    expect(dayOnly(F[3], late)).toBe(true);
    expect(dayOnly(F[3], sat)).toBe(false);
    expect(dayOnly(F[4], late)).toBe(false); // has hours
    const r = recommend(F, { who: '2', when: 'acum', budget: 0, maxKm: 8, vibes: [] }, ctx(sat), 0, 5);
    expect(r.picks.map((p) => p.v.id)).toEqual(['d']);
  });
  it('finds them by what people type', () => {
    expect(parseQuery('padel buftea').kinds).toContain('padel');
    expect(parseQuery('o plimbare in parc').topics).toContain('parc');
    expect(parseQuery('teren de fotbal').topics).toContain('fotbal');
    expect(parseQuery('castel').topics).toContain('castel');
    expect(parseQuery('piscina').topics).toContain('piscina');
    expect(search(F, 'padel', ctx(sat)).results[0].v.id).toBe('e');
    expect(search(F, 'palat', ctx(sat)).results[0].v.id).toBe('f');
    expect(search(F, 'ceva in aer liber', ctx(sat)).results.map((x) => x.v.id)).toContain('d');
  });
});
