// "O construiesc eu" (decision Cornel, 06.10): the evening step by step — each next place open from the time it
// starts, near the place before, and the steps make a plan like the others.
import { describe, expect, it } from 'vitest';
import { APP } from '../src/app/bridge';
import { km, openAt } from '../src/engine/core';

const at = (dayAdd: number, h: number) => { const d = new Date(); d.setDate(d.getDate() + dayAdd); d.setHours(h, 0, 0, 0); return d; };

describe('O construiesc eu', () => {
  it('cină, apoi un pahar aproape, deschis când termini cina; planul are amândouă', () => {
    APP.savePrefs({ zone: 'centru', dist: '20', moves: ['walk', 'car'], here: undefined } as never);
    APP.buildStart({ mode: 'loc', at: at(1, 20), people: 2, budget: [0, Infinity], vibes: [] });
    const parts = APP.buildParts();
    expect(parts.find((p) => p.id === 'masa')!.ok).toBe(true);
    const food = APP.buildOptions('masa');
    expect(food.length).toBe(3);
    expect(APP.buildAdd('masa', food[0].place.id)).toBe(true);
    const drinks = APP.buildOptions('pahar');
    expect(drinks.length).toBeGreaterThan(0);
    const first = APP.built.steps[0];
    for (const d of drinks) {
      expect(km(first.v, d.place.real)).toBeLessThanOrEqual(8);
      expect(d.slot >= APP.buildSteps()[0].until || d.slot < '05:00').toBe(true);
    }
    expect(APP.buildAdd('pahar', drinks[0].place.id)).toBe(true);
    for (const st of APP.built.steps) { const o = openAt(st.v, st.at); if (o.known) expect(o.open, st.v.name).toBe(true); }
    const plan = APP.buildPlan()!;
    expect(plan.steps.length).toBe(2);
    expect(plan.price).toBe(plan.steps.reduce((a, x) => a + x.place.price, 0));
    APP.buildCut(1);
    expect(APP.built.steps.length).toBe(1);
  });
  it('„Altele” arată alte locuri, iar un loc ales nu mai apare', () => {
    APP.buildStart({ mode: 'loc', at: at(1, 20), people: 2, budget: [0, Infinity], vibes: [] });
    const a = APP.buildOptions('masa');
    const b = APP.buildOptions('masa', a.map((x) => x.place.id));
    for (const x of b) expect(a.map((y) => y.place.id)).not.toContain(x.place.id);
  });
  it('un loc găsit închis pe Google nu mai apare și nu mai poate fi ales (07.10: London Club revenea ca alegerea lui Bilu)', () => {
    APP.buildStart({ mode: 'loc', at: at(1, 20), people: 2, budget: [0, Infinity], vibes: [] });
    const first = APP.buildOptions('masa')[0].place.id;
    APP.skipLive = () => [first];
    try {
      expect(APP.buildOptions('masa').map((x) => x.place.id)).not.toContain(first);
      expect(APP.buildAdd('masa', first)).toBe(false);
    } finally { APP.skipLive = () => []; }
  });
  it('pentru o gașcă cu cineva sub 18 ani nu sunt baruri sau cluburi', () => {
    APP.buildStart({ mode: 'loc', at: at(1, 22), people: 4, budget: [0, Infinity], vibes: [] }, true);
    const parts = APP.buildParts();
    expect(parts.find((p) => p.id === 'pahar')!.ok).toBe(false);
    expect(parts.find((p) => p.id === 'club')!.ok).toBe(false);
  });
});
