// The weather in the recommendations: rain or cold → a roof, sun → outside (src/engine/weather.ts).
import { describe, expect, it } from 'vitest';
import { KINDS } from '../src/engine/catalog';
import { recommend, search } from '../src/engine/core';
import { exposure, wxAt, wxLine, wxScore, type Weather } from '../src/engine/weather';
import type { Ctx, Venue } from '../src/engine/types';

const day = new Date(2026, 9, 3); // Saturday 3 Oct 2026
const at = (h: number) => new Date(2026, 9, 3, h, 0);
const hours = (type: string, rain: number, temp: number) => Array.from({ length: 48 }, (_, i) => ({ t: new Date(day.getTime() + i * 3600e3).toISOString(), c: type, temp, feel: temp, rain, mm: rain > 50 ? 2 : 0, wind: 8, storm: 0, day: i % 24 >= 7 && i % 24 < 19 }));
const W = (type: string, rain: number, temp: number): Weather => ({ at: day.toISOString(), hours: hours(type, rain, temp), days: [{ d: '2026-10-05', max: 12, min: 4, cd: 'RAIN', cn: 'RAIN', rd: 80, rn: 70 }] });
const V = (id: string, name: string, k: string, extra: Partial<Venue> = {}): Venue => ({ id, name, k, kind: KINDS[k].label, cat: KINDS[k].cat, cuisines: [], lat: 44.4312, lon: 26.101, zone: 'centru', ...extra });
const F = [V('p', 'Parcul Mare', 'park'), V('c', 'Cinema Test', 'cinema', { hours: 'Mo-Su 10:00-24:00' }), V('m', 'Muzeul Test', 'museum', { hours: 'Mo-Su 10:00-20:00' }), V('t', 'Terasa Test', 'bar', { outdoor: true, hours: 'Mo-Su 12:00-24:00' })];
const ctx = (weather: Weather | null): Ctx => ({ prefs: { zone: 'centru', likes: [] }, origin: { lat: 44.4312, lon: 26.101 }, now: at(11), history: [], weather });

describe('weather', () => {
  it('reads the hour, then the day', () => {
    expect(wxAt(W('RAIN', 90, 12), at(15))?.wet).toBe(true);
    expect(wxAt(W('CLEAR', 0, 24), at(15))?.nice).toBe(true);
    expect(wxAt(W('CLEAR', 0, 24), new Date(2026, 9, 5, 15))?.text).toBe('ploaie'); // beyond 48 h: the day forecast
    expect(wxAt(null, at(15))).toBeNull();
  });
  it('knows what has a roof', () => {
    expect(exposure(F[0])).toBe('out');
    expect(exposure(F[1])).toBe('in');
    expect(exposure(F[3])).toBe('terrace');
  });
  it('rain puts the park last and gives the cinema a reason', () => {
    const rain = W('RAIN', 90, 12);
    expect(wxScore(F[0], wxAt(rain, at(15))).pts).toBeLessThan(0);
    expect(wxScore(F[1], wxAt(rain, at(15))).why).toBe('La adăpost de ploaie');
    const r = recommend(F, { who: '2', when: 'acum', budget: Infinity, maxKm: 10, vibes: [] }, ctx(rain), 0, 4);
    expect(r.picks[r.picks.length - 1].v.id).toBe('p');
  });
  it('sun brings the park up', () => {
    const park = (w: Weather) => recommend(F, { who: '2', when: 'acum', budget: Infinity, maxKm: 10, vibes: [] }, ctx(w), 0, 4).picks.find((x) => x.v.id === 'p')!;
    expect(park(W('CLEAR', 0, 24)).score - park(W('RAIN', 90, 12)).score).toBeGreaterThan(30);
    expect(park(W('CLEAR', 0, 24)).reasons[0]).toBe('Vreme bună de stat afară');
  });
  it('warns when someone asks for a park in the rain', () => {
    const r = search(F, 'parc', ctx(W('RAIN', 90, 12)));
    expect(r.results[0].v.id).toBe('p');
    expect(r.parsed.note).toMatch(/umbrela/);
  });
  it('says the weather in one line', () => {
    const w = W('CLEAR', 0, 18);
    w.hours.forEach((h) => { if (Date.parse(h.t) >= at(21).getTime()) { h.c = 'RAIN'; h.rain = 80; } });
    expect(wxLine(w, at(19), at(24), 'Diseară')).toBe('Diseară 18°, ploaie de la 21:00');
    expect(wxLine(W('CLEAR', 0, 18), at(19), at(24), 'Diseară')).toBe('Diseară 18°, senin');
  });
});
