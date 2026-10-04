// How people say times and needs (decision Cornel, 04.10: "căutare mult mai avansată, dar ușor de folosit").
import { describe, expect, it } from 'vitest';
import venues from '../src/data/venues.json';
import { parseQuery, search, zoneById } from '../src/engine/core';
import type { Ctx, Venue } from '../src/engine/types';

const time = (q: string) => { const t = parseQuery(q).time; return t ? [t.hour, t.min] : null; };
describe('times as people say them', () => {
  it.each([
    ['bar după 22', [22, 0]], ['restaurant după ora 10 seara', [22, 0]], ['cafenea înainte de 9', [8, 0]],
    ['club la 1 noaptea', [1, 0]], ['club la 2', [2, 0]], ['bar la 8', [20, 0]], ['cină la 8 seara', [20, 0]],
    ['brunch duminică la 11', [11, 0]], ['muzeu la 11', [11, 0]], ['mâine dimineață la 10 cafea', [10, 0]], ['diseară la 9', [21, 0]],
  ])('%s', (q, hm) => expect(time(q)).toEqual(hm));
  it('"înainte de 9" is not nine people', () => expect(parseQuery('cafenea înainte de 9').people).toBeUndefined());
  it('keeps the day and the hour together', () => expect(parseQuery('brunch duminică la 11').time?.label).toBe('duminică la 11:00'));
});

describe('needs', () => {
  it.each([
    ['cafenea cu wifi', 'wifi'], ['loc liniștit să lucrez cu laptopul', 'wifi'], ['restaurant fără fumat', 'nosmoke'], ['bar unde se fumează', 'smoke'],
    ['restaurant accesibil cu scaun cu rotile', 'wheel'], ['ceva cu aer condiționat', 'ac'],
  ])('%s', (q, need) => expect(parseQuery(q).needs).toContain(need));
  it('"accesibil" with a wheelchair is access, with prices it is cheap', () => {
    expect(parseQuery('restaurant accesibil cu scaun cu rotile').cheap).toBe(false);
    expect(parseQuery('restaurant cu prețuri accesibile').cheap).toBe(true);
  });
  const ctx: Ctx = { prefs: { zone: 'centru', likes: [] }, origin: zoneById('centru'), now: new Date(2026, 9, 4, 18), history: [] };
  const all = venues as Venue[];
  it('finds places with wifi and says so', () => {
    const r = search(all, 'cafenea cu wifi', ctx).results.slice(0, 3);
    expect(r.every((x) => x.v.wifi)).toBe(true);
    expect(r[0].reasons).toContain('Are wifi');
  });
  it('never sends a non-smoker where the map says people smoke', () => {
    expect(search(all, 'bar fără fumat', ctx).results.some((x) => x.v.smoke === 'yes')).toBe(false);
  });
});

describe('things the review caught', () => {
  it('"la 4 persoane" is four people, not 16:00', () => {
    const p = parseQuery('masă la 4 persoane');
    expect(p.people).toBe(4);
    expect(p.time).toBeUndefined();
  });
  it('"la 8h" is the evening', () => expect(time('bar la 8h')).toEqual([20, 0]));
  it.each(['cafenea în care nu se fumează', 'restaurant nu vreau fumat', 'bar fără fum'])('%s → nefumători', (q) => {
    expect(parseQuery(q).needs).toEqual(['nosmoke']);
  });
});
