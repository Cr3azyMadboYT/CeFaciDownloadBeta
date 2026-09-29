import { describe, expect, it } from 'vitest';
import venues from '../data/venues.json';
import { recommend, search } from './core';
import { zoneById } from './core';
import type { Ctx, Venue } from './types';
const V = venues as Venue[];
const ctx: Ctx = { prefs: { zone: 's1', likes: ['Chill', 'pizza', 'Fun'] }, origin: zoneById('s1'), now: new Date(2026, 9, 2, 18, 30), history: [] };
describe('real data', () => {
  it('recommends', () => {
    const t = performance.now();
    const r = recommend(V, { who: '34', when: 'diseara', budget: 100, maxKm: 10, vibes: [] }, ctx);
    console.log('recommend ms', Math.round(performance.now() - t), r.total, r.picks.map((p) => p.v.name + ' [' + p.v.kind + '] ' + Math.round(p.score) + ' ' + p.reasons.join(' | ')));
    expect(r.picks.length).toBe(3);
  });
  it('searches', () => {
    for (const q of ['pizza sector 2', 'bar cu terasa', 'escape room', 'muzeu', 'cafenea deschisa acum', 'sushi pipera', 'caru cu bere', 'teatrul national', 'club', 'mc donalds']) {
      const t = performance.now();
      const r = search(V, q, ctx);
      console.log(q, '→', Math.round(performance.now() - t) + 'ms', r.results.length, r.results.slice(0, 4).map((x) => x.v.name + ' (' + x.v.zone + ')').join('; '));
    }
  });
});
