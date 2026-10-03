// The search, checked on the real OpenStreetMap venues with the searches people really type (see queries.ts).
import { describe, expect, it } from 'vitest';
import venues from '../data/venues.json';
import { PLACES, TOPICS } from './catalog';
import { askTime, fold, info, km, openState, parseQuery, priceOf, search, zoneById } from './core';
import { QUERIES } from './queries';
import type { Ctx, Venue } from './types';

const V = venues as Venue[];
const NOW = new Date(2026, 9, 2, 18, 30); // Friday
const ctx: Ctx = { prefs: { zone: 'centru', likes: [] }, origin: zoneById('centru'), now: NOW, history: [] };
const counts = new Map<string, number>();
for (const v of V) { const b = fold(v.name).replace(/['’`´]/g, '').replace(/\s*[-–|(,].*$/, '').trim(); counts.set(b, (counts.get(b) ?? 0) + 1); }
const chain = (v: Venue) => !!v.brand || (counts.get(fold(v.name).replace(/['’`´]/g, '').replace(/\s*[-–|(,].*$/, '').trim()) ?? 0) >= 4;
const serves = (topic: string, v: Venue) => {
  const t = TOPICS[topic];
  return (t.cuisines ?? []).some((c) => v.cuisines.includes(c)) || (!!t.hint && new RegExp(t.hint).test(fold(v.name))) || (t.kinds ?? []).includes(v.k) || (t.cats ?? []).includes(v.cat);
};
const outside = (v: Venue) => !!v.outdoor || /teras|gradin|garden|rooftop|beach|curte|summer|\bparc|\bpark\b|lac\b|outdoor/.test(fold(v.name)) || ['biergarten', 'zoo', 'water_park', 'theme_park', 'miniature_golf'].includes(v.k);

describe('search on real venues', () => {
  for (const { q, e } of QUERIES) {
    it(q, () => {
      const { results, parsed } = search(V, q, ctx);
      const n = e.n ?? (e.first ? 1 : 3);
      const top = results.slice(0, n);
      const show = top.map((r) => r.v.name + ' [' + r.v.k + ' ' + r.km.toFixed(1) + 'km ' + r.v.cuisines.join('/') + ']').join(' | ');
      expect(top.length, 'too few results: ' + show).toBe(n);
      if (e.first) expect(top[0].v.name, show).toMatch(e.first);
      for (const r of top) {
        const v = r.v;
        const why = v.name + ' — ' + show;
        if (e.kinds && !e.cats) expect(e.kinds, why).toContain(v.k);
        if (e.cats && !e.kinds) expect(e.cats, why).toContain(v.cat);
        if (e.kinds && e.cats) expect(e.kinds.includes(v.k) || e.cats.includes(v.cat), why).toBe(true);
        if (e.food) expect(serves(e.food, v), why).toBe(true);
        if (e.near) { const p = PLACES.find((x) => x.id === e.near)!; expect(km(p, v), why).toBeLessThanOrEqual(e.within ?? p.r * 2); }
        const t = askTime(parsed.time, info(v).night, NOW, parsed.topics.map((id) => TOPICS[id].hour).find((h) => h !== undefined));
        const st = openState(v, t);
        if (e.open) expect(st.known && st.open, why + ' @ ' + t.toString()).toBe(true);
        if (e.notClosed) expect(!st.known || st.open, why).toBe(true);
        if (e.maxPrice) expect(priceOf(v), why).toBeLessThanOrEqual(e.maxPrice);
        if (e.people) expect(info(v).max, why).toBeGreaterThanOrEqual(e.people);
        if (e.outdoor) expect(outside(v), why).toBe(true);
        if (e.noChain) expect(chain(v), why).toBe(false);
        if (e.notKinds) expect(e.notKinds, why).not.toContain(v.k);
      }
      if (e.note) expect(parsed.note, show).not.toBe('');
    });
  }
  it('has 60+ real searches', () => expect(QUERIES.length).toBeGreaterThanOrEqual(60));
  it('is fast enough for a phone', () => {
    const t = performance.now();
    for (const { q } of QUERIES) search(V, q, ctx);
    expect((performance.now() - t) / QUERIES.length).toBeLessThan(60);
  });
});

describe('reading a query', () => {
  it('understands budget, group, time and place', () => {
    const p = parseQuery('restaurant sub 80 de lei pt 5 vineri la 9 in floreasca');
    expect(p.budget).toBe(80); expect(p.people).toBe(5); expect(p.time?.day).toBe(5); expect(p.time?.hour).toBe(21); expect(p.place?.id).toBe('floreasca'); expect(p.topics).toContain('restaurant');
  });
  it('keeps "la 11" a time, not a budget', () => {
    const p = parseQuery('club vineri la 11');
    expect(p.budget).toBeUndefined(); expect(p.time?.hour).toBe(23);
    expect(parseQuery('sub 50').budget).toBe(50);
    expect(parseQuery('pana in 80 de lei').budget).toBe(80);
  });
  it('reads number words and the gang', () => {
    expect(parseQuery('gasca de sase').people).toBe(6);
    expect(parseQuery('cu gasca').people).toBe(5);
    expect(parseQuery('8 persoane').people).toBe(8);
  });
  it('tonight, tomorrow, the weekend', () => {
    const d = askTime(parseQuery('diseara').time, 1, NOW);
    expect(d.getDate()).toBe(2); expect(d.getHours()).toBe(20);
    expect(askTime(parseQuery('maine seara').time, 1, NOW).getDate()).toBe(3);
    expect(askTime(parseQuery('in weekend').time, 1, NOW).getDay()).toBe(6);
    const late = askTime(parseQuery('dupa 2 noaptea').time, 2, NOW);
    expect(late.getDate()).toBe(3); expect(late.getHours()).toBe(2);
  });
  it('fixes typos and keeps real names', () => {
    expect(parseQuery('bowlng').topics).toContain('bowling');
    expect(parseQuery('restaurnt').topics).toContain('restaurant');
    expect(parseQuery('floresca').place?.id).toBe('floreasca');
    expect(search(V, 'green hours', ctx).results[0].v.name).toMatch(/Green Hours/);
  });
  it('does not mistake a cheap word for a place or a time', () => {
    const p = parseQuery('5 to go');
    expect(p.people).toBeUndefined(); expect(p.time).toBeUndefined();
  });
  it('never puts adult clubs in plain results', () => {
    for (const r of search(V, 'club', ctx, 40).results) expect(r.v.name).not.toMatch(/Pussy|Sexy/);
  });
});
