// "Seara completă": a whole evening, each step open at its moment and a short walk from the previous one.
import { describe, expect, it } from 'vitest';
import venues from '../src/data/venues.json';
import { KINDS } from '../src/engine/catalog';
import { km, openAt, zoneById } from '../src/engine/core';
import { evenings, startOf } from '../src/engine/evening';
import type { Ctx, Venue } from '../src/engine/types';

const all = venues as Venue[];
const sat = new Date(2026, 9, 3, 17, 0);
const ctx = (zone: string, now = sat, minor = false): Ctx => ({ prefs: { zone, likes: [] }, origin: zoneById(zone), now, history: [], minor });
const ask = { who: '34' as const, when: 'diseara' as const, budget: Infinity, maxKm: 8, walkKm: 1.2, vibes: [] };

describe('seara completă', () => {
  const routes = evenings(all, ask, ctx('centru'));
  it('offers several kinds of evening in the centre', () => expect(routes.length).toBeGreaterThanOrEqual(4));
  it('every step is open at its time, follows the previous one and is a short walk away', () => {
    for (const r of routes) {
      for (let i = 0; i < r.steps.length; i++) {
        const s = r.steps[i];
        const o = openAt(s.v, s.at);
        expect(!o.known || o.open, r.label + ': ' + s.v.name + ' la ' + s.at.toTimeString()).toBe(true);
        if (i > 0) {
          expect(s.at.getTime()).toBeGreaterThanOrEqual(r.steps[i - 1].until.getTime());
          if (!r.drive) expect(km(r.steps[i - 1].v, s.v)).toBeLessThanOrEqual(1.2);
        }
      }
      expect(new Set(r.steps.map((s) => s.v.id)).size).toBe(r.steps.length);
    }
  });
  it('a long night ends in a club, after 22:00', () => {
    const n = routes.find((r) => r.id === 'noaptea')!;
    expect(n.steps.map((s) => KINDS[s.v.k].cat)).toEqual(['mancare', 'bar', 'club']);
    expect(n.steps[2].at.getHours()).toBeGreaterThanOrEqual(22);
  });
  it('no clubs for under 18', () => expect(evenings(all, ask, ctx('centru', sat, true)).some((r) => r.id === 'noaptea')).toBe(false));
  it('a small town gets an evening by car, every place within how far they would go', () => {
    const wide = { ...ask, maxKm: 20 };
    const b = evenings(all, wide, ctx('buftea'));
    expect(b.length).toBeGreaterThan(0);
    expect(b.some((r) => r.drive)).toBe(true);
    for (const r of b) for (const st of r.steps) expect(km(zoneById('buftea'), st.v), r.label + ': ' + st.v.name).toBeLessThanOrEqual(r.drive ? 20 : 21.2);
    for (const r of b) if (r.drive) expect(r.label).not.toMatch(/la pas/);
    // 8 km around Buftea: no evening that ends further away
    for (const r of evenings(all, ask, ctx('buftea'))) for (const st of r.steps) expect(km(zoneById('buftea'), st.v)).toBeLessThanOrEqual(r.drive ? 8 : 9.2);
    // only on foot: no driving between places
    expect(evenings(all, { ...wide, car: false }, ctx('buftea')).some((r) => r.drive)).toBe(false);
  });
  it('another variant changes the first place', () => {
    const a = evenings(all, ask, ctx('centru')).find((r) => r.id === 'cina-bar')!;
    const b = evenings(all, ask, ctx('centru'), { 'cina-bar': 1 }).find((r) => r.id === 'cina-bar')!;
    expect(b.steps[0].v.id).not.toBe(a.steps[0].v.id);
  });
  it('starts at the usual hour, or soon after now', () => {
    expect(startOf('diseara', 19.5, sat).getHours()).toBe(19);
    expect(startOf('acum', 19.5, sat).getTime()).toBeGreaterThan(sat.getTime());
    expect(startOf('weekend', 12, new Date(2026, 9, 1, 10)).getDay()).toBe(6);
  });
});
