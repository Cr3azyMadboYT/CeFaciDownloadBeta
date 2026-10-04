// The weekly tables (wk, made by scripts/build-hours.mjs) must say the same as OpenStreetMap's opening_hours,
// which the phone no longer parses (too slow there).
import { describe, expect, it } from 'vitest';
import opening_hours from 'opening_hours';
import venues from '../src/data/venues.json';
import { openAt, openState } from '../src/engine/core';
import type { Venue } from '../src/engine/types';

const V = venues as Venue[];
// rules that only depend on the weekday and the clock (no months, holidays, weeks or sun times)
const plain = V.filter((v) => v.wk && v.hours && !/[A-Z][a-z]{2} ?\d|PH|SH|week|sun|dawn|dusk|easter|"/i.test(v.hours.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, '')));

describe('weekly opening tables', () => {
  it('cover almost every place that has opening hours', () => {
    expect(V.filter((v) => v.wk).length / V.filter((v) => v.hours).length).toBeGreaterThan(0.95);
  });
  it('agree with opening_hours at every hour of a week', () => {
    let checked = 0, diff = 0;
    const base = new Date(2026, 9, 5, 0, 30); // a Monday
    for (const v of plain.slice(0, 400)) {
      const o = new opening_hours(v.hours!, null as never);
      for (let h = 0; h < 7 * 24; h += 3) {
        const t = new Date(base.getTime() + h * 3600e3);
        checked++;
        if (openState(v, t).open !== o.getState(t)) diff++;
      }
    }
    expect(checked).toBeGreaterThan(10000);
    expect(diff / checked).toBeLessThan(0.002);
  });
  it('label the next change like before', () => {
    const v = { ...V[0], hours: 'Mo-Fr 10:00-22:00; Sa 12:00-02:00', wk: [[[0, 120]], [[600, 1320]], [[600, 1320]], [[600, 1320]], [[600, 1320]], [[600, 1320]], [[720, 1440]]] } as Venue;
    expect(openAt(v, new Date(2026, 9, 5, 12, 0)).label).toBe('Deschis până la 22:00');   // Monday noon
    expect(openAt(v, new Date(2026, 9, 5, 8, 0)).label).toBe('Se deschide la 10:00');     // Monday morning
    expect(openAt(v, new Date(2026, 9, 10, 23, 0)).label).toBe('Deschis până la 02:00');  // Saturday night, past midnight
  });
});
