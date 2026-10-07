// The bugs found by the hunt of 07.10 (Cornel: „vezi ce buguri găsești”), so they do not come back.
process.env.TZ = 'Europe/Bucharest';
import { describe, expect, it } from 'vitest';
import { closesAt, openAt, parseQuery, search, stayAt } from '../src/engine/core';
import { wxAt, wxScore } from '../src/engine/weather';
import V0 from '../src/data/venues.json';
import type { Ctx, Venue } from '../src/engine/types';

const V = V0 as Venue[];
const ctxAt = (now: Date, minor = false): Ctx => ({ prefs: { zone: 'centru', likes: [] }, origin: { lat: 44.4325, lon: 26.1039 }, now, history: [], minor } as Ctx);
const club: Venue = { id: 'x1', name: 'Club X', cat: 'club', kind: 'Club', k: 'nightclub', cuisines: [], lat: 44.43, lon: 26.1, zone: 'centru', hours: 'Fr-Sa 22:00-04:00',
  wk: [[[0, 240]], [], [], [], [], [[1320, 1440]], [[0, 240], [1320, 1440]]] } as Venue;

describe('vânătoarea de buguri, 07.10', () => {
  it('un minor nu primește baruri când scrie greșit un nume („novax”)', () => {
    for (const q of ['novax', 'pxint', 'the vaultx', 'la donnax']) {
      const r = search(V, q, ctxAt(new Date(2026, 9, 9, 20, 0), true), 30).results;
      expect(r.filter((x) => ['bar', 'pub', 'nightclub', 'hookah_lounge'].includes(x.v.k)).map((x) => x.v.name), q).toEqual([]);
    }
  });
  it('în nopțile cu ora schimbată, „deschis până la” e ora de pe ceas', () => {
    expect(closesAt(club, new Date(2027, 2, 27, 23, 0))!.getHours()).toBe(4);   // primăvara, ora sare înainte
    expect(closesAt(club, new Date(2026, 9, 24, 23, 0))!.getHours()).toBe(4);   // 25 octombrie, ora se dă înapoi
    expect(openAt(club, new Date(2026, 9, 24, 23, 0)).label).toBe('Deschis până la 04:00');
    const s = stayAt(club, new Date(2027, 2, 28, 1, 30), 180);
    expect(s.until.getHours() * 60 + s.until.getMinutes()).toBeLessThanOrEqual(240);
  });
  it('„restaurant pentru 15 persoane” găsește restaurante; „20 de persoane” e înțeles', () => {
    expect(search(V, 'restaurant pentru 15 persoane', ctxAt(new Date(2026, 9, 9, 19, 0)), 30).results.length).toBeGreaterThan(0);
    expect(parseQuery('20 de persoane').people).toBe(20);
  });
  it('un buget scris invers („intre 100 si 50 lei”) e întors', () => {
    const p = parseQuery('restaurant intre 100 si 50 lei');
    expect([p.budgetMin, p.budget]).toEqual([50, 100]);
  });
  it('„restaurant azi” la 23:30 nu arată locuri închise de la 22:00', () => {
    const r = search(V, 'restaurant azi', ctxAt(new Date(2026, 9, 9, 23, 30)), 30).results;
    expect(r.filter((x) => x.open.known && !x.open.open).length).toBe(0);
  });
  it('pe ploaie, o piață nu e „la adăpost”, dar un mall da', () => {
    const rain = { at: '', hours: [], days: [{ d: '2026-10-20', max: 12, min: 6, cd: 'HEAVY_RAIN', cn: 'HEAVY_RAIN', rd: 90, rn: 90 }] };
    const at = new Date(2026, 9, 20, 15, 0);
    const piata = V.find((v) => v.name === 'Piața Constituției')!, mall = V.find((v) => v.name === 'Sun Plaza')!;
    expect(wxScore(piata, wxAt(rain as never, at)).pts).toBeLessThanOrEqual(0);
    expect(wxScore(mall, wxAt(rain as never, at)).pts).toBeGreaterThan(0);
  });
  it('la 01:00 vremea e cea din noaptea de dinainte', () => {
    const w = { at: '', hours: [], days: [{ d: '2026-10-20', max: 12, min: 6, cd: 'CLEAR', cn: 'HEAVY_RAIN', rd: 0, rn: 90 }, { d: '2026-10-21', max: 12, min: 6, cd: 'CLEAR', cn: 'CLEAR', rd: 0, rn: 0 }] };
    expect(wxAt(w as never, new Date(2026, 9, 21, 1, 0))!.rain).toBeGreaterThan(50);
  });
  it('un club de shoturi nu mai poartă povestea Cărturești Carusel', () => {
    expect(V.find((v) => v.name === 'El Comandante Junior')).toBeUndefined();
    expect(V.find((v) => v.name === 'Cărturești Carusel')?.story).toMatch(/Librăria/);
    expect(V.find((v) => v.name === 'Sun Plaza')?.hours).toBe('Mo-Su 10:00-22:00');
  });
});
