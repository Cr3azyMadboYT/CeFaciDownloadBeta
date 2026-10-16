// English search, for tourists: the same engine, English words (catalog.ts TOPICS / STOP / PLACES, core.ts parseQuery).
import { describe, expect, it } from 'vitest';
import venues from '../src/data/venues.json';
import { PLACES } from '../src/engine/catalog';
import { km, parseQuery, search, zoneById } from '../src/engine/core';
import type { Ctx, Venue } from '../src/engine/types';

const V = venues as Venue[];
const NOW = new Date(2026, 9, 2, 18, 30); // Friday
const ctx: Ctx = { prefs: { zone: 'centru', likes: [] }, origin: zoneById('centru'), now: NOW, history: [] };
const top = (q: string, n = 3) => search(V, q, ctx).results.slice(0, n).map((r) => r.v);
const show = (vs: Venue[]) => vs.map((v) => v.name + ' [' + v.k + ' ' + v.cuisines.join('/') + ']').join(' | ');

describe('English search', () => {
  const kinds: [string, string[]][] = [
    ['bowling', ['bowling_alley']],
    ['escape room', ['escape_game']],
    ['museum', ['museum', 'gallery']],
    ['museums in the old town', ['museum', 'gallery']],
    ['cinema', ['cinema']],
    ['a movie tonight', ['cinema']],
    ['theatre', ['theatre', 'arts_centre']],
    ['nightclub', ['nightclub']],
    ['clubs open late', ['nightclub']],
    ['pub', ['pub']],
    ['cocktail bar', ['bar']],
    ['coffee', ['cafe']],
    ['cafe near me', ['cafe']],
    ['ice cream', ['ice_cream']],
    ['park', ['park', 'botanical_garden']],
    ['ice skating', ['ice_rink']],
    ['climbing', ['climbing']],
    ['billiards', ['billiards']],
    ['arcade', ['amusement_arcade']],
    ['swimming pool', ['swimming', 'water_park']],
  ];
  for (const [q, ks] of kinds) it(q, () => { const t = top(q); expect(t.length, show(t)).toBeGreaterThan(0); expect(ks, show(t)).toContain(t[0].k); });

  const foods: [string, RegExp][] = [
    ['pizza', /pizz|italian/], ['burger', /burger/], ['sushi', /sushi|japanese/], ['vegan food', /vegan|vegetarian/], ['dessert', /cake|dessert|ice_cream|pastry|crepe|chocolate|donut|pancake/],
  ];
  for (const [q, re] of foods) it(q, () => { const t = top(q, 1); expect(t.length).toBe(1); expect(t[0].cuisines.join('/') + ' ' + t[0].name.toLowerCase() + ' ' + t[0].k, show(t)).toMatch(re); });

  it('rooftop bar: a bar or a place with a terrace up high', () => {
    const t = top('rooftop bar');
    expect(t.length, show(t)).toBeGreaterThan(0);
    expect(['bar', 'restaurant', 'cafe', 'pub'], show(t)).toContain(t[0].k);
  });
  it('bar with a terrace: outdoors', () => {
    const p = parseQuery('bar with a terrace');
    expect(p.outdoor).toBe(true);
    expect(p.kinds).toContain('bar');
  });
  it('old town is Centrul Vechi', () => {
    const p = parseQuery('bars in the old town');
    expect(p.place?.id).toBe('centru');
    const t = top('bars in the old town');
    const c = PLACES.find((x) => x.id === 'centru')!;
    for (const v of t) expect(km(c, v), show(t)).toBeLessThan(c.r * 2);
  });
  it('the modifiers: open now, cheap, for 4, romantic, kids, wifi, smoking, wheelchair', () => {
    expect(parseQuery('open now').openNow).toBe(true);
    expect(parseQuery('restaurants open right now').openNow).toBe(true);
    const c = parseQuery('cheap eats');
    expect(c.cheap).toBe(true);
    expect(parseQuery('dinner for 4').people).toBe(4);
    expect(parseQuery('table for four people').people).toBe(4);
    expect(parseQuery('romantic dinner').romantic).toBe(true);
    expect(parseQuery('date night').romantic).toBe(true);
    expect(parseQuery('with kids').family).toBe(true);
    expect(parseQuery('cafe with wifi').needs).toContain('wifi');
    expect(parseQuery('bar where i can smoke').needs).toContain('smoke');
    expect(parseQuery('non smoking restaurant').needs).toEqual(['nosmoke']);
    expect(parseQuery('wheelchair accessible').needs).toContain('wheel');
    expect(parseQuery('with friends').people).toBe(5);
    expect(parseQuery('under 50 lei').budget).toBe(50);
    expect(parseQuery('karaoke').topics).toContain('karaoke');
    expect(parseQuery('live music').topics).toContain('live');
    expect(parseQuery('jazz').topics).toContain('jazz');
    expect(parseQuery('board games').topics).toContain('boardgames');
    expect(parseQuery('darts').topics).toContain('biliard');
    expect(parseQuery('lake').topics).toContain('natura');
    expect(parseQuery('beer').topics).toContain('bere');
    expect(parseQuery('wine').topics).toContain('vin');
    expect(parseQuery('vegetarian').topics).toContain('vegetarian');
    expect(parseQuery('brunch').topics).toContain('brunch');
    expect(parseQuery('breakfast').topics).toContain('brunch');
  });
  it('times: late night, after 10pm, tomorrow at 8pm, saturday', () => {
    expect(parseQuery('late night food').time?.hour).toBe(23);
    const a = parseQuery('bar after 10pm');
    expect(a.time?.after).toBe(true);
    expect(a.time?.hour).toBe(22);
    const b = parseQuery('dinner tomorrow at 8pm');
    expect(b.time?.day).toBe(-2);
    expect(b.time?.hour).toBe(20);
    expect(parseQuery('brunch at 10am').time?.hour).toBe(10);
    expect(parseQuery('club on saturday').time?.day).toBe(6);
    expect(parseQuery('something tonight').time?.day).toBe(-1);
  });
  it('the English words leave nothing to match a name with', () => {
    expect(parseQuery('a good place for pizza near me').words).toEqual([]);
    expect(parseQuery('where can we go for cocktails').words).toEqual([]);
  });
});
