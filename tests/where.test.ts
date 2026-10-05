// Where you set off from and how far (decision Cornel, 04.10): București → the sectors, Ilfov → the towns (with real
// centres), Bilu's radius, the account's radius used by the plans; and the crew that learns from its votes.
import { describe, expect, it } from 'vitest';
import { APP, RADII } from '../src/app/bridge';
import { km } from '../src/engine/core';

const at = (dayAdd: number, h: number) => { const d = new Date(); d.setDate(d.getDate() + dayAdd); d.setHours(h, 0, 0, 0); return d; };

describe('de unde pleci și cât de departe', () => {
  it('București: doar sectoarele; Ilfov: orașele, și localitățile din adresele de pe hartă', () => {
    expect(APP.homes('București').map((h) => h.name)).toEqual(['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 5', 'Sector 6']);
    const ilfov = APP.homes('Ilfov').map((h) => h.name);
    expect(ilfov).toEqual(expect.arrayContaining(['Buftea', 'Otopeni', 'Snagov', 'Jilava', 'Balotești', 'Cernica']));
    for (const h of APP.homes('Ilfov')) expect(km(h, { lat: 44.43, lon: 26.1 })).toBeLessThan(45);
  });
  it('un punct de pe hartă primește numele celui mai apropiat sector sau oraș', () => {
    expect(APP.homeAt({ lat: 44.5675, lon: 25.94 }).name).toBe('Buftea');
    expect(APP.homeAt({ lat: 44.4535, lon: 26.137 }).area).toBe('București');
  });
  it('raza lui Bilu: cea mai mică rază cu destule locuri de destule feluri', () => {
    const centre = APP.bestRadius({ lat: 44.4312, lon: 26.101 });
    const buftea = APP.bestRadius({ lat: 44.568, lon: 25.948 });
    const snagov = APP.bestRadius({ lat: 44.7, lon: 26.17 });
    expect(centre).toBe(5);
    expect(buftea).toBeGreaterThanOrEqual(10);
    expect(snagov).toBeGreaterThanOrEqual(buftea);
    expect(RADII).toContain(snagov);
    expect(APP.bestRadius({ lat: 44.568, lon: 25.948 }, ['walk'])).toBe(5); // on foot: no more than 5 km
    expect(APP.circle({ lat: 44.4312, lon: 26.101 }, 5).count).toBeGreaterThan(150);
  });
  it('planurile țin cont de raza din cont; „doar până la” nu caută mai departe', () => {
    const home = { lat: 44.568, lon: 25.948, name: 'Buftea', area: 'Ilfov' as const };
    APP.savePrefs({ zone: 'buftea', home, radiusKm: 5, here: undefined, live: false, moves: ['walk', 'car'] } as never);
    expect(APP.zoneName()).toBe('Buftea');
    expect(APP.radiusKm()).toBe(5);
    const loose = APP.makePlans({ mode: 'loc', at: at(1, 21), people: 2, budget: [0, Infinity], vibes: [] });
    const strict = APP.makePlans({ mode: 'loc', at: at(1, 21), people: 2, budget: [0, Infinity], vibes: [], strict: true });
    for (const p of strict.plans) expect(km(home, p.steps[0].place.real)).toBeLessThanOrEqual(5.01);
    expect(strict.relaxed).not.toContain('far');
    if (loose.relaxed.includes('far')) expect(loose.note).toMatch(/m-am uitat până la/);
    APP.savePrefs({ home: undefined, radiusKm: undefined, zone: 'centru' } as never);
  });
  it('toată seara rămâne în rază (fără să spună, nu caută mai departe); pe jos nu urci în mașină', () => {
    for (const [name, lat, lon] of [['Buftea', 44.568, 25.948], ['Snagov', 44.7, 26.17], ['Pantelimon', 44.453, 26.2], ['Sector 2', 44.4535, 26.137]] as const) {
      const home = { lat, lon, name, area: 'Ilfov' as const };
      for (const moves of [['walk'], ['walk', 'car']]) {
        APP.savePrefs({ zone: 'buftea', home, radiusKm: 5, here: undefined, live: false, moves } as never);
        for (const h of [19, 21, 23]) {
          for (const strict of [false, true]) {
            const r = APP.makePlans({ mode: 'seara', at: at(1, h), people: 2, budget: [0, Infinity], vibes: [], strict });
            const far = r.relaxed.includes('far') || r.relaxed.includes('wider');
            if (strict) expect(far, name + ' ' + h).toBe(false);
            for (const p of r.plans) {
              if (!far) expect(km(home, p.steps[0].place.real), name + ' ' + h + ' ' + p.title).toBeLessThanOrEqual(5.01);
              if (moves.length === 1) for (const st of p.steps) expect(st.by, name + ' ' + h + ' ' + p.title).toBe('walk');
            }
          }
        }
      }
    }
    APP.savePrefs({ home: undefined, radiusKm: undefined, zone: 'centru', moves: ['walk', 'car'] } as never);
  });
});

describe('gașca învață din voturi', () => {
  it('un loc votat de gașcă urcă primul și spune de ce', () => {
    APP.savePrefs({ zone: 'centru', home: undefined, radiusKm: 10, here: undefined } as never);
    const ask = { mode: 'loc' as const, at: at(1, 20), people: 4, budget: [0, Infinity] as [number, number], vibes: [] };
    const before = APP.makePlans(ask).plans;
    const pick = before[2].steps[0].place; // the third plan's place: the crew loved it
    const taste = APP.tasteOf('Burlacii', [{ venue_id: pick.id, score: 4 }]);
    const after = APP.makePlans(ask, [], taste).plans;
    expect(after[0].steps[0].place.id).toBe(pick.id);
    expect(after[0].steps[0].reason).toMatch(/Gașcii Burlacii i-a plăcut aici/);
    const hated = APP.tasteOf('Burlacii', [{ venue_id: before[0].steps[0].place.id, score: -3 }]);
    expect(APP.makePlans(ask, [], hated).plans.some((p) => p.steps[0].place.id === before[0].steps[0].place.id)).toBe(false);
  });
});
